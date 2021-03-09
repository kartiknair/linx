const { interpret } = require('./interpreter')

let closureTest = `
		fn createCounter(initial) {
			let n = initial
			
			fn count() {
				n = n + 1
				return n
			}

			return count
		}

		let c = createCounter(3)
		let cc = createCounter(12)

		print c()
		print c()
		print cc()
		print cc()
    `

let constTest = `
		immutable := 42
		print immutable

		immutable = 34 // error
		print immutable
`

interpret(closureTest)
