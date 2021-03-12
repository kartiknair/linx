const { walk } = require('./walk')
const { Lexer } = require('./lexer')
const { Parser } = require('./parser')
const { readFileSync } = require('fs')
const { Token } = require('./token')

/*
    removes instances of `ImportExpression` & `ExportDeclaration`
    nodes from an AST by performing file resolution & bundling.

    is shared by both the JS interpreter & the C compiled runtime.
*/
function bundle(ast) {
	let linxExports = []

	ast = walk(ast, {
		// decls
		FunctionDeclaration(ident, parameters, body) {
			return {
				ident,
				parameters,
				body: bundle(body),
				type: 'FunctionDeclaration',
			}
		},
		VariableDeclaration: (ident, initializer) => {
			return {
				ident,
				initializer: bundle(initializer),
				type: 'VariableDeclaration',
			}
		},
		ConstantDeclaration: (ident, initializer) => {
			return {
				ident,
				initializer: bundle(initializer),
				type: 'ConstantDeclaration',
			}
		},

		// stmts
		ExpressionStatement: (expression) => {
			return {
				expression: bundle(expression),
				type: 'ExpressionStatement',
			}
		},
		IfStatement: (condition, thenBlock, elseBlock) => {
			return {
				condition: bundle(condition),
				thenBlock: bundle(thenBlock),
				elseBlock: bundle(elseBlock),
				type: 'IfStatement',
			}
		},
		PrintStatement: (expression) => {
			return {
				expression: bundle(expression),
				type: 'PrintStatement',
			}
		},
		ReturnStatement: (expression) => {
			return {
				expression: bundle(expression),
				type: 'ReturnStatement',
			}
		},
		ForStatement: (ident, iterable, body) => {
			return {
				ident,
				iterable: bundle(iterable),
				body: bundle(body),
				type: 'ForStatement',
			}
		},
		WhileStatement: (condition, body) => {
			return {
				condition: bundle(condition),
				body: bundle(body),
				type: 'WhileStatement',
			}
		},
		Block: (statements) => {
			return {
				statements: bundle(statements),
				type: 'Block',
			}
		},

		// exprs
		AssignmentExpression: (expr, value) => {
			return {
				expression: bundle(expr),
				value: bundle(value),
				type: 'AssignmentExpression',
			}
		},
		BinaryExpression: (left, operator, right) => {
			return {
				left: bundle(left),
				operator,
				right: bundle(right),
				type: 'BinaryExpression',
			}
		},
		UnaryExpression: (operator, expression) => {
			return {
				operator,
				expression: bundle(expression),
				type: 'UnaryExpression',
			}
		},
		GetExpression: (object, ident) => {
			return { object: bundle(object), ident, type: 'GetExpression' }
		},
		IndexExpression: (array, index) => {
			return { array: bundle(array), index, type: 'IndexExpression' }
		},
		CallExpression: (callee, args) => {
			return {
				callee: bundle(callee),
				args: args.map(bundle),
				type: 'CallExpression',
			}
		},
		FunctionExpression: (parameters, body) => {
			return {
				parameters,
				body: bundle(body),
				type: 'FunctionExpression',
			}
		},
		GroupExpression: (expression) => {
			return {
				expression: bundle(expression),
				type: 'GroupExpression',
			}
		},

		// literals
		ArrayLiteral: (values) => {
			return { values: values.map(bundle), type: 'ArrayLiteral' }
		},
		ObjectLiteral: (pairs) => {
			return {
				pairs: pairs.map((pair) => [pair[0], bundle(pair[1])]),
				type: 'ObjectLiteral',
			}
		},

		// module system
		ExportDeclaration(declaration) {
			linxExports.push(declaration.ident.lexeme)
			return bundle(declaration)
		},
		ImportExpression(path) {
			const contents = readFileSync(path.lexeme.slice(1, -1), 'utf-8')

			let l = new Lexer(contents)
			let p = new Parser(l.scanTokens())

			return {
				callee: {
					expression: {
						parameters: [],
						body: {
							statements: bundle(p.parse()),
							type: 'Block',
						},
						type: 'FunctionExpression',
					},
					type: 'GroupExpression',
				},
				args: [],
				type: 'CallExpression',
			}
		},
	})

	if (linxExports.length > 0 && Array.isArray(ast)) {
		ast.push({
			expression: {
				pairs: linxExports.map((name) => [
					new Token('STRING', name, null),
					{
						ident: new Token('IDENTIFIER', name, null),
						type: 'VariableExpression',
					},
				]),
				type: 'ObjectLiteral',
			},
			type: 'ReturnStatement',
		})
	}

	return ast
}

module.exports = { bundle }
