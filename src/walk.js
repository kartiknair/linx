function walk(ast, visitor) {
	const walkNode = (node) => {
		if (node.type in visitor) {
			return visitor[node.type](...Object.values(node))
		} else {
			return node
		}
	}

	if (Array.isArray(ast)) {
		return ast.map(walkNode)
	} else {
		return walkNode(ast)
	}
}

module.exports = { walk }
