const { walk } = require('./walk')
const { Environment } = require('./environment')
const { builtins } = require('./builtins')

let compilingC = true
let inFunction = false
let closureCaptures = new Set()

let env = new Environment()

builtins.forEach((builtin) => {
	env.define(builtin, null, false)
})

function analyzeBlock({ statements }, localEnvironment, localClosureCaptures) {
	let prevCaptures = closureCaptures
	let prevEnvironment = env

	env = localEnvironment
	closureCaptures = localClosureCaptures
	statements = statements.map((stmt) => analyze(stmt, compilingC))
	env = prevEnvironment
	closureCaptures = prevCaptures

	return statements
}

const analyzeVisitor = {
	// decls
	FunctionDeclaration: (ident, parameters, body) => {
		inFunction = true

		const func = {
			closure: new Environment(env).clone(),
			arity: () => parameters.length,
			captures: [],
		}

		func.closure.define(ident.lexeme, null, false)

		parameters.forEach((param) => {
			func.closure.define(param.lexeme, null, true)
		})

		let funcCaptures = new Set()
		body.statements = analyzeBlock(body, func.closure, funcCaptures)
		func.captures = Array.from(funcCaptures)

		env.define(ident.lexeme, func)

		inFunction = false

		return {
			ident,
			parameters,
			body,
			func,
			type: 'FunctionDeclaration',
		}
	},
	VariableDeclaration: (ident, initializer) => {
		env.define(ident.lexeme, null, true)
		return {
			ident,
			initializer: analyze(initializer, compilingC),
			type: 'VariableDeclaration',
		}
	},
	ConstantDeclaration: (ident, initializer) => {
		env.define(ident.lexeme, null, false)
		return {
			ident,
			initializer: analyze(initializer, compilingC),
			type: 'ConstantDeclaration',
		}
	},

	// stmts
	Block: (statements) => {
		return {
			statements: analyzeBlock(
				{ statements },
				new Environment(env),
				closureCaptures
			),
			type: 'Block',
		}
	},
	ForStatement: (ident, iterable, body) => {
		return {
			ident,
			iterable: analyze(iterable, compilingC),
			body: analyze(body, compilingC),
			type: 'ForStatement',
		}
	},
	WhileStatement: (condition, body) => {
		return {
			condition: analyze(condition, compilingC),
			body: analyze(body, compilingC),
			type: 'WhileStatement',
		}
	},
	IfStatement: (condition, thenBlock, elseBlock) => {
		return {
			condition: analyze(condition, compilingC),
			thenBlock: analyze(thenBlock, compilingC),
			elseBlock: analyze(elseBlock, compilingC),
			type: 'IfStatement',
		}
	},
	PrintStatement: (expression) => {
		return {
			expression: analyze(expression, compilingC),
			type: 'PrintStatement',
		}
	},
	ExpressionStatement: (expression) => {
		return {
			expression: analyze(expression, compilingC),
			type: 'ExpressionStatement',
		}
	},
	ReturnStatement: (expression) => {
		return {
			expression: analyze(expression, compilingC),
			type: 'ReturnStatement',
		}
	},

	// exprs
	AssignmentExpression: (target, value) => {
		// TODO: handle other types like GetExpressions or IndexExpressions
		if (target.type === 'VariableExpression') {
			env.assign(target.ident.lexeme, null)
		} else if (
			target.type === 'GetExpression' ||
			target.type === 'IndexExpression'
		) {
			let obj =
				target.type === 'GetExpression' ? target.object : target.array

			// to find the root of a nested get (x.y[z].t => x)
			while (
				obj.type === 'GetExpression' ||
				obj.type === 'IndexExpression'
			) {
				obj = obj.type === 'GetExpression' ? obj.object : obj.array
			}

			/*
			obj is now a primary expression, meaning it can only be a few value.
			However only of these is an "assignable values", the Variable Expression.
		*/
			if (obj.type === 'VariableExpression') {
				env.assign(obj.ident.lexeme, null)
			} else {
				throw new Error('Assigning to a literal value.')
			}
		}

		if (
			compilingC &&
			inFunction &&
			!builtins.includes(target.ident.lexeme) &&
			env.get(target.ident.lexeme) &&
			env.get(target.ident.lexeme).steps > 0
		) {
			// the first time this external variable is used is when assigning to it
			if (!closureCaptures.has(target.ident.lexeme)) {
				closureCaptures.add(target.ident.lexeme)
			}

			target.ident.lexeme = `environment[${[...closureCaptures].indexOf(
				target.ident.lexeme
			)}]`
		}

		return {
			target,
			value: analyze(value, compilingC),
			type: 'AssignmentExpression',
		}
	},
	BinaryExpression: (left, operator, right) => {
		return {
			left: analyze(left, compilingC),
			operator,
			right: analyze(right, compilingC),
			type: 'BinaryExpression',
		}
	},
	UnaryExpression: (operator, expression) => {
		return {
			operator,
			expression: analyze(expression, compilingC),
			type: 'UnaryExpression',
		}
	},
	FunctionExpression: (parameters, body) => {
		inFunction = true

		const func = {
			closure: new Environment(env).clone(),
			arity: () => parameters.length,
			captures: [],
		}

		parameters.forEach((param) => {
			func.closure.define(param.lexeme, null, true)
		})

		let funcCaptures = new Set()
		body.statements = analyzeBlock(body, func.closure, funcCaptures)
		func.captures = Array.from(closureCaptures)

		inFunction = false

		return { parameters, body, func, type: 'FunctionExpression' }
	},
	VariableExpression: (ident) => {
		if (
			compilingC &&
			inFunction &&
			!builtins.includes(ident.lexeme) &&
			env.get(ident.lexeme) &&
			env.get(ident.lexeme).steps > 0
		) {
			if (!closureCaptures.has(ident.lexeme)) {
				closureCaptures.add(ident.lexeme)
			}

			ident.lexeme = `environment[${[...closureCaptures].indexOf(
				ident.lexeme
			)}]`
		}

		// variable being referenced was either not in a function, or was local to the function
		return {
			ident,
			type: 'VariableExpression',
		}
	},
	GetExpression: (object, ident) => {
		return {
			object: analyze(object, compilingC),
			ident,
			type: 'GetExpression',
		}
	},
	IndexExpression: (array, index) => {
		return {
			array: analyze(array, compilingC),
			index: analyze(index, compilingC),
			type: 'IndexExpression',
		}
	},
	CallExpression: (callee, args) => {
		// console.log('callee: ', callee)
		return {
			callee: analyze(callee, compilingC),
			args: args.map((arg) => analyze(arg, compilingC)),
			type: 'CallExpression',
		}
	},
	GroupExpression: (expression) => {
		return {
			expression: analyze(expression, compilingC),
			type: 'GroupExpression',
		}
	},

	// literals
	ArrayLiteral: (values) => {
		return {
			values: values.map((val) => analyze(val, compilingC)),
			type: 'ArrayLiteral',
		}
	},
	ObjectLiteral: (pairs) => {
		return {
			pairs: pairs.map((pair) => [pair[0], analyze(pair[1], compilingC)]),
			type: 'ObjectLiteral',
		}
	},
}

function analyze(node, compilingCArg) {
	compilingC = compilingCArg
	console.log('global compilingC is: ', compilingC)
	return walk(node, analyzeVisitor)
}

module.exports = { analyze }
