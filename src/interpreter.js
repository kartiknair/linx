const { walk } = require('./walk')
const { Lexer } = require('./lexer')
const { Parser } = require('./parser')
const { Environment } = require('./environment')
const { builtins, fns } = require('./builtins')
const { bundle } = require('./bundler')

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

builtins.forEach((builtin, i) => {
	env.define(builtin, fns[i], false)
})

function evaluateBlock({ statements }, localEnvironment) {
	console.log('evaluating block!!', localEnvironment.get('n'), '\n\n')
	let prevEnvironment = env
	env = localEnvironment
	for (let stmt of statements) {
		globalReturnValue = null
		evaluate(stmt)
		if (globalReturnValue !== null) break
	}
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
		func.closure.define(ident.lexeme, func, false)
		console.log('hello')
		env.define(ident.lexeme, func)
	},
	VariableDeclaration: (ident, initializer) => {
		const name = ident.lexeme
		let value = null
		if (initializer !== null) {
			value = evaluate(initializer)
		}

		if (typeof value === 'object' && value !== null) {
			if (Array.isArray(value)) value = Array.from(value)
			else value = Object.assign({}, value)
		}

		env.define(name, value, true)
	},
	ConstantDeclaration: (ident, initializer) => {
		const name = ident.lexeme
		let value = evaluate(initializer)

		if (typeof value === 'object' && value !== null) {
			if (Array.isArray(value)) value = Array.from(value)
			else value = Object.assign({}, value)
		}

		env.define(name, value, false)
	},

	// stmts
	ExpressionStatement: (expression) => {
		evaluate(expression)
	},
	IfStatement: (condition, thenBlock, elseBlock) => {
		if (evaluate(condition)) {
			console.log('\ncondition was true', condition)
			evaluate(thenBlock)
			return
		} else if (elseBlock !== null) {
			console.log('\ncondition was not true & we have else block')
			evaluate(elseBlock)
			return
		}

		console.log('\ncondition was not true & no else block')
	},
	PrintStatement: (expression) => {
		console.log(evaluate(expression))
	},
	ReturnStatement: (expression) => {
		globalReturnValue = evaluate(expression)
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
	AssignmentExpression: (target, value) => {
		if (target.type === 'GetExpression') {
			evaluate(target.object)[target.ident.lexeme] = evaluate(value)
		} else if (target.type === 'IndexExpression') {
			evaluate(target.array)[target.index.value] = evaluate(value)
		} else env.assign(target.ident.lexeme, evaluate(value))
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
		if (Array.isArray(evaluate(array)) || typeof array === 'object') {
			return evaluate(array)[evaluate(index)]
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
	let ast = parser.parse()
	console.log(ast[0].body.statements[0].condition)

	ast = bundle(ast)

	return evaluate(ast)
}

module.exports = { interpret, evalVisitor }
