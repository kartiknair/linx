const { join } = require('path')
const { readFileSync } = require('fs')

const { walk } = require('./walk')
const { Lexer } = require('./lexer')
const { Parser } = require('./parser')
const { bundle } = require('./bundler')
const { analyze } = require('./analyzer')

function varOrConstDeclaration(ident, initializer, type) {
	return `${type} ${ident.lexeme} = ${codegen(initializer)};`
}

const codegenVisitor = {
	// decls
	FunctionDeclaration: (ident, parameters, body, _func) => {
		/*
            while we have closure information from our analysis
            we don't need to use it when codegenning javascript
            since our closure rules matches its.
        */
		return `function ${ident.lexeme}(${parameters
			.map((param) => param.lexeme)
			.join(', ')}) {
           ${body.statements.map(codegen).join('\n')}
       }`
	},
	VariableDeclaration: (ident, initializer) =>
		varOrConstDeclaration(ident, initializer, 'let'),
	ConstantDeclaration: (ident, initializer) =>
		varOrConstDeclaration(ident, initializer, 'const'),

	// stmts
	ExpressionStatement: (expression) => {
		return codegen(expression) + ';'
	},
	IfStatement: (condition, thenBlock, elseBlock) => {
		return `if (linx__truthy(${codegen(condition)})) ${codegen(
			thenBlock
		)} ${elseBlock ? `else ${codegen(elseBlock)}` : ''}`
	},
	PrintStatement: (expression) => {
		return `print(${codegen(expression)});`
	},
	ReturnStatement: (expression) => {
		return `return ${codegen(expression)};`
	},
	ForStatement: (ident, iterable, body) => {
		let iteratorSignature = Date.now()
		return `let iterator__${iteratorSignature} = list.iterator(${codegen(
			iterable
		)})
        
        while (iterator__${iteratorSignature}.valid()) {
            let ${ident.lexeme} = iterator__${iteratorSignature}.next();
            ${body.statements.map(codegen).join('\n')}
        }`
	},
	WhileStatement: (condition, body) => {
		return `while (${codegen(condition)}) ${codegen(body)}`
	},
	Block: (statements) => {
		return `{${statements.map((stmt) => codegen(stmt)).join('\n')}}`
	},

	// exprs
	AssignmentExpression: (target, value) => {
		return `${codegen(target)} = ${codegen(value)}`
	},
	BinaryExpression: (left, operator, right) => {
		return `${codegen(left)} ${
			operator.lexeme === '==' || operator.lexeme === '!='
				? operator.lexeme + '='
				: operator.lexeme
		} ${codegen(right)}`
	},
	UnaryExpression: (operator, expression) => {
		return `${operator.lexeme}${codegen(expression)}`
	},
	IndexExpression: (array, index) => {
		return `${codegen(array)}[${codegen(index)})]`
	},
	GetExpression: (object, ident) => {
		return `${codegen(object)}.${ident.lexeme}`
	},
	CallExpression: (callee, args) => {
		return `${codegen(callee)}(${codegen(args).join(', ')})`
	},
	FunctionExpression: (parameters, body, func) => {
		return `(${parameters.join(', ')}) => ${codegen(body)}`
	},
	VariableExpression: (ident) => {
		return ident.lexeme
	},
	GroupExpression: (expression) => {
		return `(${codegen(expression)})`
	},

	// literals
	ArrayLiteral: (values) => {
		return `[${values.map(codegen).join(', ')}]`
	},
	ObjectLiteral: (pairs) => {
		return `{
            ${pairs
				.map(([key, value]) => `${key.lexeme}: ${codegen(value)}`)
				.join(', ')}
        }`
	},
	Literal: (value) => {
		if (typeof value === 'string') {
			return `"${value.split('\n').join('\\n')}"`
		} else if (typeof value === 'number') {
			return '' + value
		}

		switch (value) {
			case true:
				return 'true'
			case false:
				return 'false'
			case null:
				return 'null'
			default: {
				console.error(`[Compiler Error] Unknown literal type: ${value}`)
				process.exit(1)
			}
		}
	},
}

function codegen(node) {
	return walk(node, codegenVisitor)
}

function compile(source) {
	let lexer = new Lexer(source)
	const tokens = lexer.scanTokens()

	let parser = new Parser(tokens)
	let ast = parser.parse()
	ast = bundle(ast)
	ast = analyze(ast)

	let program = codegen(ast).join('\n')
	let runtime = readFileSync(join(__dirname, '../runtime.js'))

	return `${runtime} (function main() {${program}})()`
}

module.exports = { compile }
