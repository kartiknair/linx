const builtins = ['len', 'type', 'range', 'toString']

const type = {
	call: (args) => {
		const val = args[0]

		switch (typeof val) {
			case 'number':
			case 'string':
			case 'boolean':
				return typeof val
			case 'object':
				if (val === null) {
					return 'nil'
				} else if (Array.isArray(val)) {
					return 'list'
				} else if (val.call && val.arity) {
					return 'function'
				} else {
					return 'object'
				}
		}
	},
	arity: () => 1,
	toString: () => `<fn type builtin>`,
}

const len = {
	call: (args) => {
		const arr = args[0]
		const arrType = type.call([arr])

		if (arrType !== 'object' && arrType !== 'list') {
			return null
		}

		if (arrType === 'object') {
			return Object.keys(arr).length
		} else return arr.length
	},
	arity: () => 1,
	toString: () => `<fn len builtin>`,
}

const range = {
	call: (args) => {
		const [start, end, step] = args

		if (start === end) return []

		let forwards = true
		if (start > end) forwards = false

		let result = []

		let i = start
		while (forwards ? i < end : i > end) {
			result.push(i)
			i = forwards ? i + step : i - step
		}

		return result
	},
	arity: () => 3,
	toString: () => `<fn toString builtin>`,
}

const toString = {
	call: (args) => {
		return '' + args[0]
	},
	arity: () => 1,
	toString: () => `<fn toString builtin>`,
}

const fns = [len, type, range, toString]

module.exports = { builtins, fns }
