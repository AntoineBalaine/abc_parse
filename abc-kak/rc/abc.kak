# ABC notation plugin for Kakoune
# Provides AST-based multi-selection through the ABC LSP server's selector system.

# ============================================================================
# Global Options
# ============================================================================

# Path to the abc-kak-client.js script
declare-option -docstring "Path to the ABC Kakoune client script" \
    str abc_client_path "%sh{dirname $(dirname $kak_source)}/bin/abc-kak-client.js"

# Socket path (computed using the same logic as the server)
declare-option -docstring "Unix socket path for ABC LSP server" \
    str abc_socket_path %sh{
    if [ -n "$XDG_RUNTIME_DIR" ]; then
        echo "$XDG_RUNTIME_DIR/abc-lsp.sock"
    else
        echo "/tmp/abc-lsp-$USER/lsp.sock"
    fi
}

# Request timeout in milliseconds
declare-option -docstring "Timeout for selector requests (ms)" \
    int abc_timeout 5000

# ============================================================================
# Buffer-Scoped Options
# ============================================================================

# These options track the state of the selector/transform system for each buffer.

declare-option -hidden bool abc_pending false
declare-option -hidden str abc_tmpfile ""
declare-option -hidden str abc_resultfile ""

# ============================================================================
# Filetype Detection
# ============================================================================

hook global BufCreate .*\.abc %{
    set-option buffer filetype abc
}

hook global BufCreate .*\.abcx %{
    set-option buffer filetype abcx
}

# ============================================================================
# LSP Integration (via kak-lsp)
# ============================================================================
# Note: LSP setup (lsp-enable-window, semantic tokens) should be configured
# in your kakrc alongside the lsp_servers option. This plugin only provides
# the selector commands.

# ============================================================================
# Include Selector, Transform, and Mode Commands
# ============================================================================

# Kakoune's autoload mechanism loads all .kak files when the rc/ directory
# is placed in ~/.config/kak/autoload/. For explicit loading, source this
# file and the commands below will be available.
#
# The selector commands are defined in abc-selectors.kak
# The transform commands are defined in abc-transforms.kak
# The mode definitions are defined in abc-modes.kak

source "%val{source}/abc-selectors.kak"
source "%val{source}/abc-transforms.kak"
source "%val{source}/abc-modes.kak"
