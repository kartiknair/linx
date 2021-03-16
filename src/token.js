class Token {
	constructor(type, lexeme, literal, lineNo, columnNo) {
		this.type = type
		this.lexeme = lexeme
		this.literal = literal
		this.lineNo = lineNo
		this.columnNo = columnNo
	}

	toString() {
		return `[Token] {${this.type}, ${this.lexeme}, ${this.literal}} on [line: ${this.lineNo}, column: ${this.columnNo}]`
	}
}

module.exports = { Token }
