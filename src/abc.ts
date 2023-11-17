import { readFileSync } from "fs";
import readline from "readline";
// import { AstPrinter } from "./AstPrinter"
import { getError, setError } from "./error";
import { Parser } from "./Parser";
import Scanner from "./Scanner";
import Token from "./token";

export let hadError = false;

const main = (args: string[]) => {
  if (args.length > 1) {
    console.log("Usage: abc [script]");
    return;
  } else if (args.length === 1) {
    runFile(args[0]);
  } else {
    runPrompt();
  }
};

function runFile(path: string) {
  const bytes = readFileSync(path, {
    encoding: "utf8",
  });
  run(bytes);
  if (getError()) {
    return;
  }
}

function runPrompt() {
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.setPrompt("> ");
  rl.prompt();
  rl.on("line", (line) => {
    run(line);
    setError(false);
    rl.prompt();
  });
}

function run(source: string) {
  const scanner = new Scanner(source);
  const tokens: Array<Token> = scanner.scanTokens();
  const parser = new Parser(tokens, source);
  const expression = parser.parse();

  if (hadError) {
    console.log("\nhad error");
    return;
  }
  //console.log(new AstPrinter().print(expression as Expr))
}

main(process.argv.slice(2));
