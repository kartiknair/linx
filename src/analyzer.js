const { walk } = require('./walk')
const { Environment } = require('./environment')
const { builtins } = require('./builtins')

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
	statements = statements.map(analyze)
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
			initializer: analyze(initializer),
			type: 'VariableDeclaration',
		}
	},
	ConstantDeclaration: (ident, initializer) => {
		env.define(ident.lexeme, null, false)
		return {
			ident,
			initializer: analyze(initializer),
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
			iterable: analyze(iterable),
			body: analyze(body),
			type: 'ForStatement',
		}
	},
	WhileStatement: (condition, body) => {
		return {
			condition: analyze(condition),
			body: analyze(body),
			type: 'WhileStatement',
		}
	},
	IfStatement: (condition, thenBlock, elseBlock) => {
		return {
			condition: analyze(condition),
			thenBlock: analyze(thenBlock),
			elseBlock: analyze(elseBlock),
			type: 'IfStatement',
		}
	},
	PrintStatement: (expression) => {
		return {
			expression: analyze(expression),
			type: 'PrintStatement',
		}
	},
	ExpressionStatement: (expression) => {
		return {
			expression: analyze(expression),
			type: 'ExpressionStatement',
		}
	},
	ReturnStatement: (expression) => {
		return {
			expression: analyze(expression),
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
			value: analyze(value),
			type: 'AssignmentExpression',
		}
	},
	BinaryExpression: (left, operator, right) => {
		return {
			left: analyze(left),
			operator,
			right: analyze(right),
			type: 'BinaryExpression',
		}
	},
	UnaryExpression: (operator, expression) => {
		return {
			operator,
			expression: analyze(expression),
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
			object: analyze(object),
			ident,
			type: 'GetExpression',
		}
	},
	IndexExpression: (array, index) => {
		return {
			array: analyze(array),
			index: analyze(index),
			type: 'IndexExpression',
		}
	},
	CallExpression: (callee, args) => {
		// console.log('callee: ', callee)
		return {
			callee: analyze(callee),
			args: args.map(analyze),
			type: 'CallExpression',
		}
	},
	GroupExpression: (expression) => {
		return { expression: analyze(expression), type: 'GroupExpression' }
	},

	// literals
	ArrayLiteral: (values) => {
		return { values: values.map(analyze), type: 'ArrayLiteral' }
	},
	ObjectLiteral: (pairs) => {
		return {
			pairs: pairs.map((pair) => [pair[0], analyze(pair[1])]),
			type: 'ObjectLiteral',
		}
	},
}

function analyze(node) {
	return walk(node, analyzeVisitor)
}

module.exports = { analyze }
