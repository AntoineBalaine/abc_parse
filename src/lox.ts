import { readFileSync } from "fs"
import readline from "readline"
import { getError, setError } from "./error"
import Scanner from "./Scanner"
import Token from "./token"

export let hadError = false

const main = (args: string[]) => {
  if (args.length > 1) {
    console.log("Usage: jlox [script]")
    return
  } else if (args.length === 1) {
    runFile(args[0])
  } else {
    runPrompt()
  }
}

function runFile(path: string) {
  const bytes = readFileSync(path, {
    encoding: "utf8",
  })
  run(bytes)
  if (getError()) return
}

function runPrompt() {
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.setPrompt("> ")
  rl.prompt()
  rl.on("line", (line) => {
    run(line)
    setError(false)
    rl.prompt()
  })
}

function run(source: string) {
  const scanner = new Scanner(source)
  const tokens: Array<Token> = scanner.scanTokens()
  for (const token in tokens) {
    if (Object.prototype.hasOwnProperty.call(tokens, token)) {
      const element = tokens[token]
      console.log("token", element)
    }
  }
}

main(process.argv.slice(2))
