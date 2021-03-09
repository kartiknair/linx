const defaultVisitor = {
	// decls
	FunctionDeclaration: (ident, parameters, body) => ({
		ident,
		parameters,
		body,
		type: 'FunctionDeclaration',
	}),
	VariableDeclaration: (ident, initializer) => ({
		ident,
		initializer,
		type: 'VariableDeclaration',
	}),
	ConstantDeclaration: (ident, initializer) => ({
		ident,
		initializer,
		type: 'ConstantDeclaration',
	}),

	// stmts
	ExpressionStatement: (expression) => ({
		expression,
		type: 'ExpressionStatement',
	}),
	IfStatement: (condition, thenBlock, elseBlock) => ({
		condition,
		thenBlock,
		elseBlock,
		type: 'IfStatement',
	}),
	PrintStatement: (expression) => ({
		expression,
		type: 'PrintStatement',
	}),
	ReturnStatement: (expression) => ({
		expression,
		type: 'ReturnStatement',
	}),
	ForStatement: (ident, iterable, body) => ({
		ident,
		iterable,
		body,
		type: 'ForStatement',
	}),
	WhileStatement: (condition, body) => ({
		condition,
		body,
		type: 'WhileStatement',
	}),
	Block: (statements) => ({
		statements,
		type: 'Block',
	}),

	// exprs
	AssignmentExpression: (ident, value) => ({
		ident,
		value,
		type: 'AssignmentExpression',
	}),
	BinaryExpression: (left, operator, right) => ({
		left,
		operator,
		right,
		type: 'BinaryExpression',
	}),
	UnaryExpression: (operator, expression) => ({
		operator,
		expression,
		type: 'UnaryExpression',
	}),
	CallExpression: (callee, args) => ({
		callee,
		args,
		type: 'CallExpression',
	}),
	VariableExpression: (ident) => ({
		ident,
		type: 'VariableExpression',
	}),
	GroupExpression: (expression) => ({
		expression,
		type: 'GroupExpression',
	}),

	// literals
	ArrayLiteral: (values) => ({
		values,
		type: 'ArrayLiteral',
	}),
	ObjectLiteral: (pairs) => ({
		pairs,
		type: 'ObjectLiteral',
	}),
	Literal: (value) => ({
		value,
		type: 'Literal',
	}),
}

function walk(ast, visitor) {
	Object.keys(defaultVisitor).forEach((key) => {
		if (!(key in visitor)) {
			visitor[key] = defaultVisitor[key]
		}
	})

	function walkNode(node) {
		switch (node.type) {
			// decls
			case 'FunctionDeclaration':
				return visitor[node.type](node.name, walkNode(node.body))
			case 'VariableDeclaration':
			case 'ConstantDeclaration':
				return visitor[node.type](node.name, walkNode(node.initializer))

			// stmts
			case 'ExpressionStatement':
			case 'ReturnStatement':
			case 'PrintStatement':
				return visitor[node.type](walkNode(node.expression))
			case 'IfStatement':
				return visitor[node.type](
					walkNode(node.condition),
					walkNode(node.thenBlock),
					walkNode(node.elseBlock)
				)
			case 'ForStatement':
				return visitor[node.type](
					node.ident,
					walkNode(node.iterable),
					walkNode(node.body)
				)
			case 'WhileStatement':
				return visitor[node.type](
					walkNode(node.condition),
					walkNode(node.body)
				)
			case 'Block':
				return visitor[node.type](
					node.statements.map((stmt) => walkNode(stmt))
				)

			// exprs
			case 'AssignmentExpression':
				return visitor[node.type](node.ident, walkNode(node.value))
			case 'BinaryExpression':
				return visitor[node.type](
					walkNode(node.left),
					node.operator,
					walkNode(node.right)
				)
			case 'UnaryExpression':
				return visitor[node.type](
					node.operator,
					walkNode(node.expression)
				)
			case 'CallExpression':
				return visitor[node.type](
					walkNode(node.callee),
					node.args.map((arg) => walkNode(arg))
				)
			case 'VariableExpression':
				return visitor[node.type](node.ident)
			case 'GroupExpression':
				return visitor[node.type](node.expression)

			// literals
			case 'ArrayLiteral':
				return visitor[node.type](
					node.values.map((value) => walkNode(value))
				)
			case 'ObjectLiteral':
				return visitor[node.type](
					node.pairs.map(([key, value]) => [key, walkNode(value)])
				)
			case 'Literal':
				return visitor[node.type](node.value)
		}
	}

	if (Array.isArray(ast)) {
		ast.forEach((node) => {
			walkNode(node, visitor[node.type])
		})
	} else {
		walkNode(ast, visitor[ast.type])
	}
}

module.exports = { walk }
