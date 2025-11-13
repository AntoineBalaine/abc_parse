#!/usr/bin/env node
/**
 * ABC CLI Tool - Main entry point
 *
 * Command-line interface for ABC music notation processing
 */

import { Command } from "commander";
import { formatCommand } from "./commands/format";
import { checkCommand } from "./commands/check";
import { renderCommand } from "./commands/render";

const program = new Command();

program.name("abcls").description("Command-line tool for ABC music notation").version("0.1.0");

// Add commands
program.addCommand(formatCommand);
program.addCommand(checkCommand);
program.addCommand(renderCommand);

// Parse command-line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
