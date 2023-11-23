import { readFileSync } from "fs";
import readline from "readline";
import { Parser } from "./Parser";
import { Scanner } from "./Scanner";

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
    rl.prompt();
  });
}

function run(source: string) {
  const scanner = new Scanner(source);
  const parser = new Parser(scanner.scanTokens(), source);
  const expression = parser.parse();

  // const semanticTokensVisitor = new TokensVisitor();
  // const semanticTokens = semanticTokensVisitor.analyze(expression).tokens;
  // console.log("SemanticTokens: \n", semanticTokens);
}

main(process.argv.slice(2));
