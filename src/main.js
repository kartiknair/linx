const { bundle } = require('./bundler')
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
	let point = {
		x: 12,
		y: 45
	}
	let l = [1, 2, 3]
	
	print l
	print l[0]
	
	print point
	print point["x"]
`

let multilineStrings = `
	let adjective = "cool"
	let str = 
		"\${adjective}
string
is
very
\${adjective}"

	print str
`

let valuesOnAssignment = `
	p := {
		x: 12,
		y: 34
	}
	l := [1, 2, 3]

	pCopy := p
	lCopy := l

	p.x = 45
	print p
	print pCopy

	l[0] = 5
	print l
	print lCopy
`

let usingBuiltins = `
	let l = [1, 4, 3]
	let sum = fn (a, b) {
		return a + b
	}

	print len(l)
	print type(l)
	print range(10, 0, 3)
`

let importOutput = `
	math := (fn () {
		fn add(a, b) {
			return a + b
		}

		return {
			add: add
		}
	})()

	foo := (fn () {
		fn something(s) {
			print("s is '\${s}'!")
		}

		return {
			something: something
		}
	})()

	print(math.add(1, 3)) // 4
	foo.something("g") // s is 'g'!
`

let moduleSystem = `
	math := import "math.li"
	print math.add(1, 3)
`

interpret(moduleSystem)
console.log(compile(moduleSystem))
