const { walk } = require('./walk')
const { Lexer } = require('./lexer')
const { Parser } = require('./parser')
const { Environment } = require('./environment')

function binaryOp(left, operator, right) {
	switch (operator.lexeme) {
		case '+':
			return left + right
		case '-':
			return left - right
		case '*':
			return left * right
		case '/':
			return left / right
		case '==':
			return left === right
		case '!=':
			return left !== right
		case '<':
			return left < right
		case '>':
			return left > right
		case '<=':
			return left <= right
		case '>=':
			return left >= right
	}
}

function unaryOp(operator, expr) {
	switch (operator.lexeme) {
		case '-':
			return -expr
		case '!':
			return !expr
	}
}

let env = new Environment()

function evaluateBlock({ statements }, localEnvironment) {
	let prevEnvironment = env
	env = localEnvironment
	statements.forEach(evaluate)
	env = prevEnvironment
}

// yep, this is a pretty dirty hack
let globalReturnValue = null

const evalVisitor = {
	// decls
	FunctionDeclaration: (ident, parameters, body) => {
		const func = {
			closure: new Environment(env).clone(),
			call: (args, closure) => {
				globalReturnValue = null

				args.forEach((arg, i) => {
					closure.define(parameters[i].lexeme, arg, true)
				})

				evaluateBlock(body, closure)
				return globalReturnValue
			},
			arity: () => parameters.length,
			toString: () => `<fn ${ident.lexeme}>`,
		}

		env.define(ident.lexeme, func)
	},
	VariableDeclaration: (ident, initializer) => {
		const name = ident.lexeme
		let value = null
		if (initializer !== null) {
			value = evaluate(initializer)
		}
		env.define(name, value, true)
	},
	ConstantDeclaration: (ident, initializer) => {
		const name = ident.lexeme
		const value = evaluate(initializer)
		env.define(name, value, false)
	},

	// stmts
	ExpressionStatement: (expression) => {
		evaluate(expression)
	},
	IfStatement: (condition, thenBlock, elseBlock) => {
		if (condition) {
			evaluate(thenBlock)
		} else if (elseBlock !== null) {
			evaluate(elseBlock)
		}
	},
	PrintStatement: (expression) => {
		console.log(evaluate(expression))
	},
	ReturnStatement: (expression) => {
		let value = null
		if (expression !== null) value = evaluate(expression)
		globalReturnValue = value
	},
	ForStatement: (ident, iterable, body) => {
		iterable = evaluate(iterable)

		for (let i = 0; i < iterable.length; i++) {
			let nestedEnvironment = new Environment(env)
			nestedEnvironment.define(ident.lexeme, iterable[i])
			evaluateBlock(body, nestedEnvironment)
		}
	},
	WhileStatement: (condition, body) => {
		while (evaluate(condition)) {
			evaluate(body)
		}
	},
	Block: (statements) => {
		evaluateBlock({ statements }, new Environment(env))
	},

	// exprs
	AssignmentExpression: (ident, value) => {
		env.assign(ident.lexeme, evaluate(value))
		return value
	},
	BinaryExpression: (left, operator, right) => {
		return binaryOp(evaluate(left), operator, evaluate(right))
	},
	UnaryExpression: (operator, expression) => {
		return unaryOp(operator, evaluate(expression))
	},
	GetExpression: (object, ident) => {
		const obj = evaluate(object)
		if (!(ident.lexeme in obj)) {
			throw Error(`Object does not have property '${ident.lexeme}'.`)
		}

		return obj[ident.lexeme]
	},
	IndexExpression: (array, index) => {
		if (Array.isArray(evaluate(array))) {
			return evaluate(array)[index.lexeme]
		} else return null
	},
	CallExpression: (callee, args) => {
		let func = evaluate(callee)
		return func.call(
			args.map((arg) => evaluate(arg)),
			func.closure
		)
	},
	FunctionExpression: (parameters, body) => {
		const func = {
			closure: new Environment(env).clone(),
			call: (args, closure) => {
				globalReturnValue = null

				args.forEach((arg, i) => {
					closure.define(parameters[i].lexeme, arg, true)
				})

				evaluateBlock(body, closure)
				return globalReturnValue
			},
			arity: () => parameters.length,
			toString: () => `<fn ${ident.lexeme}>`,
		}
		return func
	},
	VariableExpression: (ident) => {
		return env.get(ident.lexeme).value.value
	},
	GroupExpression: (expression) => {
		return evaluate(expression)
	},

	// literals
	ArrayLiteral: (values) => {
		return values.map((value) => evaluate(value))
	},
	ObjectLiteral: (pairs) => {
		let result = {}
		pairs.forEach((pair) => {
			result[pair[0].lexeme] = evaluate(pair[1])
		})
		return result
	},
	Literal: (value) => {
		return value
	},
}

function evaluate(node) {
	const result = walk(node, evalVisitor)
	// console.log(env)
	return result
}

function interpret(source) {
	let lexer = new Lexer(source)
	const tokens = lexer.scanTokens()
	// console.log(tokens)

	let parser = new Parser(tokens)
	const ast = parser.parse()

	return evaluate(ast)
}

module.exports = { interpret, evalVisitor }
