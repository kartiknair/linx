const { walk } = require('./walk')
const { Lexer } = require('./lexer')
const { Parser } = require('./parser')
const { resolve, dirname } = require('path')
const { readFileSync, existsSync } = require('fs')
const { Token } = require('./token')

const cwd = process.cwd()

/*
    removes instances of `ImportExpression` & `ExportDeclaration`
    nodes from an AST by performing file resolution & bundling.

    is shared by both the JS interpreter & the C compiled runtime.
*/
function bundle(ast, path = cwd) {
	let linxExports = []

	ast = walk(ast, {
		// decls
		FunctionDeclaration(ident, parameters, body) {
			return {
				ident,
				parameters,
				body: bundle(body, path),
				type: 'FunctionDeclaration',
			}
		},
		VariableDeclaration: (ident, initializer) => {
			return {
				ident,
				initializer: bundle(initializer, path),
				type: 'VariableDeclaration',
			}
		},
		ConstantDeclaration: (ident, initializer) => {
			return {
				ident,
				initializer: bundle(initializer, path),
				type: 'ConstantDeclaration',
			}
		},

		// stmts
		ExpressionStatement: (expression) => {
			return {
				expression: bundle(expression, path),
				type: 'ExpressionStatement',
			}
		},
		IfStatement: (condition, thenBlock, elseBlock) => {
			return {
				condition: bundle(condition, path),
				thenBlock: bundle(thenBlock, path),
				elseBlock: bundle(elseBlock, path),
				type: 'IfStatement',
			}
		},
		PrintStatement: (expression) => {
			return {
				expression: bundle(expression, path),
				type: 'PrintStatement',
			}
		},
		ReturnStatement: (expression) => {
			return {
				expression: bundle(expression, path),
				type: 'ReturnStatement',
			}
		},
		ForStatement: (ident, iterable, body) => {
			return {
				ident,
				iterable: bundle(iterable, path),
				body: bundle(body, path),
				type: 'ForStatement',
			}
		},
		WhileStatement: (condition, body) => {
			return {
				condition: bundle(condition, path),
				body: bundle(body, path),
				type: 'WhileStatement',
			}
		},
		Block: (statements) => {
			return {
				statements: bundle(statements, path),
				type: 'Block',
			}
		},

		// exprs
		AssignmentExpression: (expr, value) => {
			return {
				target: bundle(expr, path),
				value: bundle(value, path),
				type: 'AssignmentExpression',
			}
		},
		BinaryExpression: (left, operator, right) => {
			return {
				left: bundle(left, path),
				operator,
				right: bundle(right, path),
				type: 'BinaryExpression',
			}
		},
		UnaryExpression: (operator, expression) => {
			return {
				operator,
				expression: bundle(expression, path),
				type: 'UnaryExpression',
			}
		},
		GetExpression: (object, ident) => {
			return {
				object: bundle(object, path),
				ident,
				type: 'GetExpression',
			}
		},
		IndexExpression: (array, index) => {
			return {
				array: bundle(array, path),
				index,
				type: 'IndexExpression',
			}
		},
		CallExpression: (callee, args) => {
			return {
				callee: bundle(callee, path),
				args: args.map(bundle),
				type: 'CallExpression',
			}
		},
		FunctionExpression: (parameters, body) => {
			return {
				parameters,
				body: bundle(body, path),
				type: 'FunctionExpression',
			}
		},
		GroupExpression: (expression) => {
			return {
				expression: bundle(expression, path),
				type: 'GroupExpression',
			}
		},

		// literals
		ArrayLiteral: (values) => {
			return { values: values.map(bundle), type: 'ArrayLiteral' }
		},
		ObjectLiteral: (pairs) => {
			return {
				pairs: pairs.map((pair) => [pair[0], bundle(pair[1])], path),
				type: 'ObjectLiteral',
			}
		},

		// module system
		ExportDeclaration(declaration) {
			linxExports.push(declaration.ident.lexeme)
			return bundle(declaration, path)
		},
		ImportExpression(importPath) {
			const importedPath = resolve(
				dirname(path),
				importPath.lexeme.slice(1, -1)
			)

			if (!existsSync(importedPath)) {
				throw new Error(
					`Imported file: '${importedPath}' does not exist.`
				)
			}

			const contents = readFileSync(importedPath, 'utf-8')

			let l = new Lexer(contents)
			let p = new Parser(l.scanTokens())

			return {
				callee: {
					expression: {
						parameters: [],
						body: {
							statements: bundle(p.parse(), importedPath),
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
