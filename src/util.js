function createCounter(initial) {
	let number = initial

	function counter() {
		return number++
	}

	return counter
}

module.exports = { createCounter }
