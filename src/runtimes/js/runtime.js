function type(value) {
	if (value === null) return 'nil'

	switch (typeof value) {
		case 'boolean':
		case 'number':
		case 'string':
		case 'function':
			return typeof value
		case 'object':
			if (Array.isArray(value)) return 'list'
			return typeof value
	}
}

function len(value) {
	if (type(value) !== 'object' && type(value) !== 'list') {
		return null
	}

	if (type(value) === 'object') {
		return Object.keys(value).length
	} else return value.length
}

function range(start, end, step) {
	if (start === end) return []

	let forwards = true
	if (start > end) forwards = false

	let result = []

	let i = start
	while (forwards ? i <= end : i >= end) {
		result.push(i)
		i = forwards ? i + step : i - step
	}

	return result
}

function toString(value) {
	switch (type(value)) {
		case 'nil':
			return 'nil'
		case 'boolean':
		case 'number':
			return '' + value
		case 'string':
			return value
		case 'object':
			return (
				'[' +
				Object.entries
					.map(([key, value]) => `${key}: ${toString(value)}`)
					.join(', ') +
				']'
			)
		case 'list':
			return '[' + value.map((val) => toString(val)).join(', ') + ']'
		case 'function':
			return '<function>'
	}
}

function linx__truthy(value) {
	if (value === null) return false

	typeof value === ''

	switch (type(value)) {
		case 'boolean':
			return value
		case 'number':
			return value !== 0
		case 'string':
		case 'list':
			return value.length !== 0
		case 'object':
			return Object.keys(value).length !== 0
		case 'function':
			return true
	}
}

function print(value) {
	console.log(toString(value))
}
