function walk(ast, visitor) {
	if (Array.isArray(ast)) {
		ast.forEach((node) => {
			visitor[node.type](...Object.values(node))
		})
	} else {
		return visitor[ast.type](...Object.values(ast))
	}
}

module.exports = { walk }
