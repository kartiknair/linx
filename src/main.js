const { compile } = require('./compiler')
const { interpret } = require('./interpreter')
const { Lexer } = require('./lexer')
const { Parser } = require('./parser')

let simple = `
	let x = 12
	let y = 24.34

	print x + y
`

let simpleFunc = `
	fn sayHello(name) {
		print "hello there \${name}!"
	}

	sayHello("john")
`

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

let fnExpressionTest = `
		sum := fn (a, b) {
			return a + b
		}

		print sum(34, 54)
`

let fieldAccessTest = `
		p := {
			name: "john doe",
			age: 45,
			greeting: fn () {
				return "hi there, i'm john doe!"
			}
		}

		print p.name
		print p.age
		print p.greeting()
`

let captures = `
	let x = 3

	fn inc() {
		x = x + 1
	}

	print x
	
	inc()
	print x
`

let changingClosures = `
	let a = "global"
	
	{
		fn showA() {
			print a
		}
		
		showA()
		a = "block"
		showA()
	}
`

let arraysTest = `
	let l = [1, 2, 3]
	
	print l
	print l[0]
`

let l = new Lexer(arraysTest)
let p = new Parser(l.scanTokens())

interpret(arraysTest)
console.log(compile(arraysTest))
