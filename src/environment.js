class Environment {
	constructor(enclosing) {
		this.enclosing = enclosing ? enclosing : null
		this.values = {}
		this.steps = 0
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
			this.resetSteps()
			return { value: this.values[name], steps: this.steps }
		}

		if (this.enclosing !== null) {
			this.steps++
			let enclosingGet = this.enclosing.get(name)
			let steps = this.steps + enclosingGet.steps
			this.resetSteps()
			return { value: enclosingGet.value, steps }
		}

		throw new Error(`Undefined variable '${name}'.`)
	}

	clone() {
		let result = new Environment()
		result.values = { ...this.values }
		result.enclosing =
			this.enclosing === null ? null : this.enclosing.clone()
		return result
	}

	resetSteps() {
		this.steps = 0
		if (this.enclosing !== null) {
			this.enclosing.resetSteps()
		}
	}
}

module.exports = { Environment }
