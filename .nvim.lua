-- Project-specific Neovim settings for abc-parser
-- This file is loaded automatically by Neovim when opening the project
-- in Lazyvim, don’t forget to install debug configs using :Mason

-- DAP (Debug Adapter Protocol) configurations for Mocha tests
local dap = require("dap")

-- Configure Node.js adapter
if not dap.adapters.node2 then
	dap.adapters.node2 = {
		type = "executable",
		command = "node",
		args = { vim.fn.stdpath("data") .. "/mason/packages/node-debug2-adapter/out/src/nodeDebug.js" },
	}
end

-- Add configurations for Mocha tests
dap.configurations.typescript = dap.configurations.typescript or {}
dap.configurations.javascript = dap.configurations.javascript or {}

-- Configuration for debugging all Mocha tests
local debug_all_tests = {
	name = "Debug Mocha Tests",
	type = "node2",
	request = "launch",
	program = "${workspaceFolder}/node_modules/mocha/bin/_mocha",
	args = {
		"-r",
		"ts-node/register",
		"src/**/*.spec.ts",
		"--timeout",
		"999999",
	},
	cwd = "${workspaceFolder}",
	sourceMaps = true,
	protocol = "inspector",
	console = "integratedTerminal",
	skipFiles = { "<node_internals>/**" },
}

-- Configuration for debugging the current test file
local debug_current_file = {
	name = "Debug Current Test File",
	type = "node2",
	request = "launch",
	program = "${workspaceFolder}/node_modules/mocha/bin/_mocha",
	args = {
		"-r",
		"ts-node/register",
		"${file}",
		"--timeout",
		"999999",
	},
	cwd = "${workspaceFolder}",
	sourceMaps = true,
	protocol = "inspector",
	console = "integratedTerminal",
	skipFiles = { "<node_internals>/**" },
}

-- Add the configurations to both TypeScript and JavaScript
table.insert(dap.configurations.typescript, debug_all_tests)
table.insert(dap.configurations.typescript, debug_current_file)
-- table.insert(dap.configurations.javascript, debug_all_tests)
-- table.insert(dap.configurations.javascript, debug_current_file)
-- Print a message to confirm the DAP configurations have been loaded
print("Loaded DAP configurations for abc-parser")

-- Check if dap-ui is available and configure REPL in split
local status_ok, dapui = pcall(require, "dapui")
if status_ok then
  -- Function to open just the REPL in a split window
  local function open_repl_in_split()
require('dap').repl.open({}, 'vsplit')
  end

  -- Create a user command to open REPL in split
  vim.api.nvim_create_user_command("DapReplSplit", open_repl_in_split, {})

  -- Add a keymapping to open REPL in split (adjust the key as needed)
  vim.keymap.set('n', '<leader>dr', open_repl_in_split, { desc = 'Debug: Open REPL in split' })

  print("Added REPL in split configuration")
else
  print("Warning: dap-ui not found, REPL in split configuration not added")
end

-- Configure prettier as the formatter for this project
vim.bo.formatexpr = ""
vim.bo.formatprg = "prettier --stdin-filepath=%"

-- Auto-format on save for TypeScript/JavaScript files
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = { "*.ts", "*.js", "*.tsx", "*.jsx", "*.json", "*.md" },
  callback = function()
    vim.lsp.buf.format({ async = false })
  end,
})

-- Set up prettier as the default formatter
vim.api.nvim_create_autocmd("FileType", {
  pattern = { "typescript", "javascript", "typescriptreact", "javascriptreact", "json", "markdown" },
  callback = function()
    vim.bo.formatprg = "prettier --stdin-filepath=" .. vim.fn.expand("%")
  end,
})
