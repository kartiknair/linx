const { Token } = require('./token')

function panic(line, message) {
	console.error(`[Lexer Error: ${line}] ${message}`)
	process.exit(1)
}

function isDigit(string) {
	return /^\d$/.test(string)
}

function isAlpha(string) {
	return /^[A-Za-z]+$/.test(string)
}

function isAlphaNumeric(string) {
	return isAlpha(string) || isDigit(string)
}

const keywords = [
	'and',
	'else',
	'false',
	'for',
	'fn',
	'if',
	'nil',
	'or',
	'print',
	'return',
	'true',
	'let',
	'while',
	'in',
	'import',
	'export',
]

class Lexer {
	constructor(source) {
		this.source = source

		this.start = 0
		this.current = 0
		this.line = 1

		this.tokens = []
	}

	isAtEnd() {
		return this.current >= this.source.length
	}

	advance() {
		this.current++
		return this.source[this.current - 1]
	}

	addToken(type, literal) {
		const text = this.source.substring(this.start, this.current)
		this.tokens.push(new Token(type, text, literal, this.line))
	}

	match(expected) {
		if (this.isAtEnd()) return false
		if (this.source[this.current] !== expected) return false

		this.current++
		return true
	}

	peek() {
		if (this.isAtEnd()) return '\0'
		return this.source[this.current]
	}

	peekNext() {
		if (this.current + 1 >= this.source.length) return '\0'
		return this.source[this.current + 1]
	}

	interpolation() {
		// skip the '${'
		this.advance()
		this.advance()

		while (this.peek() !== '}' && !this.isAtEnd()) {
			this.start = this.current
			this.scanToken()
		}

		this.start = this.current
		this.advance() // skip the '}'

		this.tokens.push(new Token('PLUS', '+', null, this.line))
		this.string()
	}

	string() {
		while (this.peek() !== '"' && !this.isAtEnd()) {
			if (this.peek() === '\n') this.line++
			else if (this.peek() === '$' && this.peekNext() === '{') {
				const value = this.source.substring(
					this.start + 1,
					this.current
				)
				this.addToken('STRING', value)
				this.tokens.push(new Token('PLUS', '+', null, this.line))

				return this.interpolation()
			}

			this.advance()
		}

		// Unterminated string.
		if (this.isAtEnd()) {
			panic(this.line, 'Unterminated string.')
			return
		}

		// The closing ".
		this.advance()

		// Trim the surrounding quotes.
		const value = this.source.substring(this.start + 1, this.current - 1)
		this.addToken('STRING', value)
	}

	number() {
		while (isDigit(this.peek())) this.advance()

		// Look for a fractional part.
		if (this.peek() == '.' && isDigit(this.peekNext())) {
			// Consume the "."
			this.advance()

			while (isDigit(this.peek())) this.advance()
		}

		this.addToken(
			'NUMBER',
			parseFloat(this.source.substring(this.start, this.current))
		)
	}

	identifier() {
		while (isAlphaNumeric(this.peek())) this.advance()

		const text = this.source.substring(this.start, this.current)

		let type = keywords.find((el) => el === text)
		if (!type) type = 'IDENTIFIER'
		this.addToken(type.toUpperCase())
	}

	scanToken() {
		const c = this.advance()

		switch (c) {
			case ':':
				this.addToken(this.match('=') ? 'COLON_EQUAL' : 'COLON')
				break
			case '(':
				this.addToken('LEFT_PAREN')
				break
			case ')':
				this.addToken('RIGHT_PAREN')
				break
			case '{':
				this.addToken('LEFT_BRACE')
				break
			case '}':
				this.addToken('RIGHT_BRACE')
				break
			case '[':
				this.addToken('LEFT_BRACKET')
				break
			case ']':
				this.addToken('RIGHT_BRACKET')
				break
			case ',':
				this.addToken('COMMA')
				break
			case '.':
				this.addToken('DOT')
				break
			case '-':
				this.addToken('MINUS')
				break
			case '+':
				this.addToken('PLUS')
				break
			case '*':
				this.addToken('STAR')
				break
			case '!':
				this.addToken(this.match('=') ? 'BANG_EQUAL' : 'BANG')
				break
			case '=':
				this.addToken(this.match('=') ? 'EQUAL_EQUAL' : 'EQUAL')
				break
			case '<':
				this.addToken(this.match('=') ? 'LESS_EQUAL' : 'LESS')
				break
			case '>':
				this.addToken(this.match('=') ? 'GREATER_EQUAL' : 'GREATER')
				break
			case '/':
				if (this.match('/')) {
					// A comment goes until the end of the line.
					while (this.peek() != '\n' && !this.isAtEnd())
						this.advance()
				} else if (isAlpha(c)) {
					identifier()
				} else {
					this.addToken('SLASH')
				}
				break
			case ' ':
			case '\r':
			case '\t':
				// Ignore whitespace.
				break
			case '\n':
				this.line++
				break
			case '"':
				this.string()
				break
			default:
				if (isDigit(c)) {
					this.number()
				} else if (isAlpha(c)) {
					this.identifier()
				} else {
					panic(this.line, 'Unexpected character: ' + c)
				}
				break
		}
	}

	scanTokens() {
		while (!this.isAtEnd()) {
			// We are at the beginning of the next lexeme.
			this.start = this.current
			this.scanToken()
		}

		this.tokens.push(new Token('EOF', '', null, this.line))
		return this.tokens
	}
}

module.exports = { Lexer }
