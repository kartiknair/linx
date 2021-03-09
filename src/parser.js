function panic(token, message) {
	console.error(`[Parser Error: ${token.line}] ${message}`)
	process.exit(1)
}

class Parser {
	constructor(tokens) {
		this.tokens = tokens || []
		this.current = 0
	}

	peek() {
		return this.tokens[this.current]
	}

	isAtEnd() {
		return this.peek().type === 'EOF'
	}

	previous() {
		return this.tokens[this.current - 1]
	}

	advance() {
		if (!this.isAtEnd()) this.current++
		return this.previous()
	}

	check(type) {
		if (this.isAtEnd()) return false
		return this.peek().type === type
	}

	consume(type, message) {
		if (this.check(type)) return this.advance()
		panic(this.peek(), message)
	}

	match(...types) {
		for (const type of types) {
			if (this.check(type)) {
				this.advance()
				return true
			}
		}

		return false
	}

	declaration() {
		if (this.match('FN')) return this.func('function')
		if (this.match('LET')) return this.varDeclaration()
		return this.statement()
	}

	func(kind) {
		const name = this.consume('IDENTIFIER', `Expect ${kind} name.`)

		this.consume('LEFT_PAREN', `Expect '(' after ${kind} name.`)
		const parameters = []
		if (!this.check('RIGHT_PAREN')) {
			do {
				if (parameters.length >= 255) {
					this.error(
						this.peek(),
						"Can't have more than 255 parameters."
					)
				}

				parameters.push(
					this.consume('IDENTIFIER', 'Expect parameter name.')
				)
			} while (this.match('COMMA'))
		}
		this.consume('RIGHT_PAREN', "Expect ')' after parameters.")

		this.consume('LEFT_BRACE', `Expect '{' before ${kind} body.`)
		const body = this.block()

		return { ident: name, parameters, body, type: 'FunctionDeclaration' }
	}

	varDeclaration() {
		const name = this.consume('IDENTIFIER', 'Expect variable name.')

		let initializer = null

		if (this.match('EQUAL')) {
			initializer = this.expression()
		}

		return {
			ident: name,
			initializer,
			type: 'VariableDeclaration',
		}
	}

	statement() {
		if (this.match('FOR')) return this.forStatement()
		if (this.match('IF')) return this.ifStatement()
		if (this.match('PRINT')) return this.printStatement()
		if (this.match('RETURN')) return this.returnStatement()
		if (this.match('WHILE')) return this.whileStatement()
		if (this.match('LEFT_BRACE')) return this.block()
		return this.expressionStatement()
	}

	expressionStatement() {
		const expr = this.expression()
		return {
			expression: expr,
			type: 'ExpressionStatement',
		}
	}

	forStatement() {
		const ident = this.consume(
			'IDENTIFIER',
			'Expect identifier when defining for loop.'
		)
		this.consume('IN', 'Expect keyword `in` when using for loop.')
		const iterable = this.expression()

		this.consume('LEFT_BRACE', 'Expect block after for loop definition.')
		const body = this.block()

		return { ident, iterable, body, type: 'ForStatement' }
	}

	ifStatement() {
		const condition = this.expression()

		this.consume('LEFT_BRACE', 'Expect block after for if statement.')
		const thenBlock = this.block()

		let elseBlock = null

		if (this.match('ELSE')) {
			this.consume('LEFT_BRACE', 'Expect block after for else statement.')
			elseBlock = this.block()
		}

		return { condition, thenBlock, elseBlock, type: 'IfStatement' }
	}

	printStatement() {
		const value = this.expression()
		return {
			expression: value,
			type: 'PrintStatement',
		}
	}

	returnStatement() {
		let value = null
		value = this.expression()
		return { expression: value, type: 'ReturnStatement' }
	}

	whileStatement() {
		const condition = this.expression()
		this.consume('LEFT_BRACE', 'Expect block after while statement.')
		const body = this.block()
		return { condition, body, type: 'WhileStatement' }
	}

	block() {
		const statements = []

		while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
			statements.push(this.declaration())
		}

		this.consume('RIGHT_BRACE', "Expect '}' after block.")
		return {
			statements,
			type: 'Block',
		}
	}

	expression() {
		return this.assignment()
	}

	assignment() {
		const expr = this.or()

		if (this.match('EQUAL')) {
			const equals = this.previous()
			const value = this.assignment()

			if (expr.type === 'VariableExpression') {
				const name = expr.ident
				return {
					ident: name,
					value,
					type: 'AssignmentExpression',
				}
			}

			panic(equals, 'Invalid assignment target.')
		}

		return expr
	}

	or() {
		let expr = this.and()

		while (this.match('OR')) {
			const operator = this.previous()
			const right = this.and()
			expr = { left: expr, operator, right, type: 'BinaryExpression' }
		}

		return expr
	}

	and() {
		let expr = this.equality()

		while (this.match('AND')) {
			const operator = this.previous()
			const right = this.equality()
			expr = { left: expr, operator, right, type: 'BinaryExpression' }
		}

		return expr
	}

	equality() {
		let expr = this.comparison()

		while (this.match('BANG_EQUAL', 'EQUAL_EQUAL')) {
			const operator = this.previous()
			const right = this.comparison()
			expr = {
				left: expr,
				operator,
				right,
				type: 'BinaryExpression',
			}
		}

		return expr
	}

	comparison() {
		let expr = this.addition()

		while (this.match('GREATER', 'GREATER_EQUAL', 'LESS', 'LESS_EQUAL')) {
			const operator = this.previous()
			const right = this.addition()
			expr = {
				left: expr,
				operator,
				right,
				type: 'BinaryExpression',
			}
		}

		return expr
	}

	addition() {
		let expr = this.multiplication()

		while (this.match('MINUS', 'PLUS')) {
			const operator = this.previous()
			const right = this.multiplication()
			expr = {
				left: expr,
				operator,
				right,
				type: 'BinaryExpression',
			}
		}

		return expr
	}

	multiplication() {
		let expr = this.unary()

		while (this.match('SLASH', 'STAR')) {
			const operator = this.previous()
			const right = this.unary()
			expr = {
				left: expr,
				operator,
				right,
				type: 'BinaryExpression',
			}
		}

		return expr
	}

	unary() {
		if (this.match('BANG', 'MINUS')) {
			const operator = this.previous()
			const right = this.unary()
			return {
				operator,
				right,
				type: 'UnaryExpression',
			}
		}

		return this.call()
	}

	call() {
		let expr = this.primary()

		while (true) {
			if (this.match('LEFT_PAREN')) expr = this.finishCall(expr)
			else break
		}

		return expr
	}

	finishCall(callee) {
		const args = []

		if (!this.check('RIGHT_PAREN')) {
			do {
				args.push(this.expression())
			} while (this.match('COMMA'))
		}

		// TODO: why is this here?
		const paren = this.consume('RIGHT_PAREN', "Expect ')' after arguments.")

		return { callee, args, type: 'CallExpression' }
	}

	primary() {
		if (this.match('LEFT_BRACKET')) {
			let values = []
			if (!this.check('RIGHT_BRACKET')) {
				do {
					values.push(this.expression())
				} while (this.match('COMMA'))
			}
			this.consume('RIGHT_BRACKET', "Expect ']' after list.")

			return { values, type: 'ArrayLiteral' }
		}

		if (this.match('LEFT_BRACE')) {
			let pairs = []
			if (!this.check('RIGHT_BRACE')) {
				do {
					let key = null
					if (this.check('STRING')) {
						key = this.consume('STRING')
					} else if (this.check('IDENTIFIER')) {
						key = this.consume('IDENTIFIER')
					}

					if (key === null) {
						panic(
							this.previous(),
							'Expect string or identifier key in object literal.'
						)
					}

					this.consume(
						'COLON',
						'Expect colon after key in object literal.'
					)
					const value = this.expression()
					pairs.push([key, value])
				} while (this.match('COMMA'))
			}
			this.consume('RIGHT_BRACE', "Expect '}' after object literal.")

			return { pairs, type: 'ObjectLiteral' }
		}

		if (this.match('FALSE')) return { value: false, type: 'Literal' }
		if (this.match('TRUE')) return { value: true, type: 'Literal' }
		if (this.match('NIL')) return { value: null, type: 'Literal' }

		if (this.match('NUMBER', 'STRING')) {
			return {
				value: this.previous().literal,
				type: 'Literal',
			}
		}

		if (this.match('IDENTIFIER')) {
			return {
				ident: this.previous(),
				type: 'VariableExpression',
			}
		}

		if (this.match('LEFT_PAREN')) {
			const expr = this.expression()
			this.consume('RIGHT_PAREN', "Expect ')' after expression.")
			return {
				expression: expr,
				type: 'GroupExpression',
			}
		}

		panic(this.peek(), 'Expect expression.')
	}

	parse() {
		const statements = []

		while (!this.isAtEnd()) {
			statements.push(this.declaration())
		}

		return statements
	}
}

module.exports = { Parser }