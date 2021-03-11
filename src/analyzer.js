const { walk } = require('./walk')
const { Environment } = require('./environment')

let inFunction = false
let closureCaptures = new Set()

let env = new Environment()

function analyzeBlock({ statements }, localEnvironment) {
	let prevEnvironment = env
	env = localEnvironment
	statements = statements.map(analyze)
	env = prevEnvironment
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

		parameters.forEach((param) => {
			func.closure.define(param.lexeme, null, true)
		})

		closureCaptures.clear()
		body.statements = analyzeBlock(body, func.closure)
		func.captures = Array.from(closureCaptures)
		closureCaptures.clear()

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
			statements: analyzeBlock({ statements }, new Environment(env)),
			type: 'Block',
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

	AssignmentExpression: (ident, value) => {
		if (
			inFunction &&
			env.get(ident.lexeme) &&
			env.get(ident.lexeme).steps > 0
		) {
			// the first time this external variable is used is when assigning to it
			if (!closureCaptures.has(ident.lexeme)) {
				closureCaptures.add(ident.lexeme)
			}

			ident.lexeme = `environment[${[...closureCaptures].indexOf(
				ident.lexeme
			)}]`
		}

		return { ident, value: analyze(value), type: 'AssignmentExpression' }
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

		closureCaptures.clear()
		body.statements = analyzeBlock(body, func.closure)
		func.captures = Array.from(closureCaptures)
		closureCaptures.clear()

		inFunction = false

		return { parameters, body, func, type: 'FunctionExpression' }
	},
	VariableExpression: (ident) => {
		if (
			inFunction &&
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
	CallExpression: (callee, args) => {
		return {
			callee: analyze(callee),
			args: args.map(analyze),
			type: 'CallExpression',
		}
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
