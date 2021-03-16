const { walk } = require('./walk')
const { Lexer } = require('./lexer')
const { Parser } = require('./parser')
const { analyze } = require('./analyzer')
const { builtins } = require('./builtins')
const { bundle } = require('./bundler')

function anonymousFnId() {
	let count = -1
	return () => {
		count++
		return `linx__anonymous_fn$${count}`
	}
}

const getFnId = anonymousFnId()

function binaryOp(left, operator, right) {
	const operatorFunctionMap = {
		'+': 'linx__operator_add',
		'-': 'linx__operator_subtract',
		'*': 'linx__operator_multiply',
		'/': 'linx__operator_divide',
		'==': 'linx__operator_equals',
		'!=': 'linx__operator_nequals',
		'<': 'linx__operator_lesser',
		'>': 'linx__operator_greater',
		'<=': 'linx__operator_lequals',
		'>=': 'linx__operator_gequals',
		and: 'linx__operator_and',
		or: 'linx__operator_or',
	}

	return `${operatorFunctionMap[operator.lexeme]}(${codegen(left)}, ${codegen(
		right
	)})`
}

function unaryOp(operator, expr) {
	const operatorFunctionMap = {
		'-': 'linx__operator_negate',
		'!': 'linx__operator_not',
	}

	return `${operatorFunctionMap[operator.lexeme]}(${codegen(expr)})`
}

// list of function declarations in order. can be codegenned in reverse to lift closures
let fnDecls = []

function varOrConstDeclaration(ident, initializer) {
	return `Value* ${ident.lexeme} = Value__create_nil(); Value__copy(&${
		ident.lexeme
	}, ${codegen(initializer)});`
}

const codegenVisitor = {
	// decls
	FunctionDeclaration: (ident, parameters, body, func) => {
		fnDecls.push({
			name: ident.lexeme,
			parameters,
			body,
			captures: func.captures,
		})
		return `Value* ${ident.lexeme} = Value__create_fn(&${
			ident.lexeme
		}__linx_definition, ${
			func.captures.length > 0
				? `(Value*[]){${func.captures.join(', ')}}`
				: 'NULL'
		}, ${func.captures.length});`
	},
	VariableDeclaration: (ident, initializer) =>
		varOrConstDeclaration(ident, initializer),
	ConstantDeclaration: (ident, initializer) =>
		varOrConstDeclaration(ident, initializer),

	// stmts
	ExpressionStatement: (expression) => {
		return codegen(expression) + ';'
	},
	IfStatement: (condition, thenBlock, elseBlock) => {
		return `if (Value__to_bool(${codegen(condition)})) ${codegen(
			thenBlock
		)} ${elseBlock ? `else ${codegen(elseBlock)}` : ''}`
	},
	PrintStatement: (expression) => {
		return `print(${codegen(expression)});`
	},
	ReturnStatement: (expression) => {
		return `return ${codegen(expression)};`
	},
	ForStatement: (ident, iterable, body) => {},
	WhileStatement: (condition, body) => {
		return `while (${codegen(condition)}) ${codegen(body)}`
	},
	Block: (statements) => {
		return `{${statements.map((stmt) => codegen(stmt)).join('\n')}}`
	},

	// exprs
	AssignmentExpression: (expr, value) => {
		let gennedExpr = codegen(expr)

		if (
			gennedExpr.startsWith('linx__operator_dot') ||
			gennedExpr.startsWith('linx__operator_subscript')
		) {
			let variableSignature = Date.now()
			return `Value* $temp__${variableSignature} = ${gennedExpr};\nValue__copy(&$temp__${variableSignature}, ${codegen(
				value
			)})`
		}

		return `Value__copy(&${gennedExpr}, ${codegen(value)})`
	},
	BinaryExpression: (left, operator, right) => {
		return binaryOp(left, operator, right)
	},
	UnaryExpression: (operator, expression) => {
		return unaryOp(operator, expression)
	},
	IndexExpression: (array, index) => {
		return `linx__operator_subscript(${codegen(array)}, ${codegen(index)})`
	},
	GetExpression: (object, ident) => {
		return `linx__operator_dot(${codegen(object)}, Value__from_charptr("${
			ident.lexeme
		}"))`
	},
	CallExpression: (callee, args) => {
		return `linx__operator_call(${codegen(callee)}, ${
			args.length > 0 ? `(Value*[]){${codegen(args).join(', ')}}` : 'NULL'
		})`
	},
	FunctionExpression: (parameters, body, func) => {
		const name = getFnId()

		fnDecls.push({ name, parameters, body, captures: func.captures })
		return `Value__create_fn(&${name}__linx_definition, ${
			func.captures.length > 0
				? `(Value*[]){${func.captures.join(', ')}}`
				: 'NULL'
		}, ${func.captures.length})`
	},
	VariableExpression: (ident) => {
		return ident.lexeme
	},
	GroupExpression: (expression) => {
		return `(${codegen(expression)})`
	},

	// literals
	ArrayLiteral: (values) => {
		return `Value__from_array((Value*[]){${values
			.map(codegen)
			.join(', ')}}, ${values.length})`
	},
	ObjectLiteral: (pairs) => {
		if (pairs.length > 0) {
			return `Value__create_object_from_arrs((Value*[]){${pairs
				.map((p) => `Value__from_charptr("${p[0].lexeme}")`)
				.join(', ')}}, (Value*[]){${pairs
				.map((p) => codegen(p[1]))
				.join(', ')}}, ${pairs.length})`
		} else return 'Value__create_object()'
	},
	Literal: (value) => {
		if (typeof value === 'string') {
			return `Value__from_charptr("${value.split('\n').join('\\n')}")`
		} else if (typeof value === 'number') {
			return `Value__from_double(${value})`
		}

		switch (value) {
			case true:
				return 'Value__from_bool(true)'
			case false:
				return 'Value__from_bool(false)'
			case null:
				return 'Value__create_nil()'
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

function compile(source, path) {
	let lexer = new Lexer(source)
	const tokens = lexer.scanTokens()

	let parser = new Parser(tokens)
	let ast = parser.parse()
	ast = bundle(ast, path)
	ast = analyze(ast)

	const compiledStatements = codegen(ast)
	let compiledFunctions = ''

	while (fnDecls.length !== 0) {
		fnDecls.forEach((fn) => {
			console.log(fn)

			let fnDef = `Value* ${
				fn.name
			}__linx_definition(Value** environment, Value** arguments) {
					Value* ${fn.name} = Value__create_fn(&${
				fn.name
			}__linx_definition, environment, ${fn.captures.length});
					${fn.parameters
						.map(
							(param, i) =>
								`Value* ${param.lexeme} = arguments[${i}];`
						)
						.join('\n')} ${fn.body.statements
				.map(codegen)
				.join('\n')}}`

			compiledFunctions = fnDef + compiledFunctions + '\n'

			fnDecls = fnDecls.slice(1)
		})
	}

	return `
#include "../src/runtimes/c/runtime.h"

${compiledFunctions}

int main(int argc, char **argv) {
	tgc_start(&gc, &argc);
	${builtins
		.map(
			(fn) =>
				`Value* ${fn} = Value__create_fn(&${fn}__builtin_def, NULL, 0);`
		)
		.join('\n')}
    ${compiledStatements.join('\n')}
	tgc_stop(&gc);
	return 0;
}`
}

module.exports = { compile }
