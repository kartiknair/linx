class Environment {
	constructor(enclosing) {
		this.enclosing = enclosing ? enclosing : null
		this.values = {}
	}

	define(name, value, mutable = true) {
		this.values[name] = { value, mutable }
	}

	assign(name, value) {
		if (name in this.values) {
			if (this.values[name].mutable) {
				this.values[name].value = value
				return
			} else throw new Error(`Assigning to const variable '${name}'.`)
		}

		if (this.enclosing !== null) {
			this.enclosing.assign(name, value)
			return
		}

		throw new Error(`Undefined variable '${name}'.`)
	}

	get(name) {
		if (name in this.values) {
			return this.values[name]
		}

		if (this.enclosing !== null) return this.enclosing.get(name)

		throw new Error(`Undefined variable '${name}'.`)
	}

	clone() {
		let result = new Environment()
		result.values = { ...this.values }
		result.enclosing =
			this.enclosing === null ? null : this.enclosing.clone()
		return result
	}
}

module.exports = { Environment }
