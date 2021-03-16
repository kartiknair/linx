const { join } = require('path')
const { spawn } = require('child_process')
const { readFileSync, existsSync, writeFileSync, mkdirSync } = require('fs')

const { compile } = require('./compiler')
const { compile: compileJS } = require('./js-compiler')

const progName = 'linx'
const commands = ['run', 'compile', 'emit-c', 'emit-js']
const args = process.argv.slice(2)

const globalHelpText = `
  Usage
    $ ${progName} <command> [options]

  Available Commands
    run        Runs the provided Linx file.
    compile    Compiles the Linx file to an executable.
    emit-c     Writes compiled C code to stdout.
    emit-js    Writes compile JS code to stdout.

  For more info, run any command with the \`--help\` flag
    $ ${progName} run --help`

const commandHelpTexts = {
	run: `
  Description
    Runs the provided Linx file directly after compilation.

  Usage
    $ ${progName} run <filename>`,
	compile: `
  Description
    Compiles the provided Linx file to C & then uses the
    systems C compiler to compile to an executable.

  Usage
    $ ${progName} compile <filename> [options]

  Options
    --cc    The program to use instead of $CC to compile the C code.`,
	'emit-c': ``,
}

if (!commands.includes(args[0])) {
	console.log(globalHelpText)
	process.exit(1)
} else {
	if (args.includes('--help') || args.includes('-h')) {
		console.log(commandHelpTexts[args[0]])
		process.exit(0)
	} else if (args.length < 2) {
		console.log(commandHelpTexts[args[0]])
		process.exit(1)
	}

	let fileName = args[1]
	if (!existsSync(fileName)) {
		console.error('File does not exist:', fileName)
		process.exit(1)
	}
	let fileContents = readFileSync(fileName, 'utf-8')

	switch (args[0]) {
		case 'run': {
			const JSOutput = compileJS(fileContents)
			eval(JSOutput)
			break
		}
		case 'compile': {
			const c = compile(fileContents)

			if (!existsSync(join(__dirname, '../tmp'))) {
				mkdirSync(join(__dirname, '../tmp'))
			}
			writeFileSync(join(__dirname, '../tmp/tempcache.c'), c)

			let cc = 'CC'
			if (args.includes('--cc')) {
				cc = args[args.indexOf('--cc') + 1]
			}

			const compileCommand = spawn(
				cc,
				[
					join(__dirname, '../tmp/tempcache.c'),
					'-Wall',
					'-Wpedantic',
					'-std=c99',
				],
				{
					cwd: process.cwd(),
					stdio: 'inherit',
				}
			)

			compileCommand.on('close', (code) => {
				if (code === 0) {
					console.log(
						'Program was compiled to executable successfully!'
					)
				}
			})

			break
		}
		case 'emit-c': {
			console.log(compile(fileContents))
			break
		}
		case 'emit-js': {
			console.log(compileJS(fileContents))
			break
		}
	}
}
