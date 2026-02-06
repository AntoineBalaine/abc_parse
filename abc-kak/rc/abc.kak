# ABC notation plugin for Kakoune
# Provides AST-based multi-selection through the ABC LSP server's selector system.

# ============================================================================
# Global Options
# ============================================================================

# Path to the abc-kak-client.js script
declare-option -docstring "Path to the ABC Kakoune client script" \
    str abc_client_path "%sh{dirname $(dirname $kak_source)}/dist/abc-kak-client.js"

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

# Automatically open preview when ABC files are opened (default: false).
# To enable, pre-declare in your kakrc before the plugin loads:
#   declare-option bool abc_auto_preview true
declare-option -docstring "Automatically open preview when ABC files are opened" \
    bool abc_auto_preview false

# Path to the bundled LSP server
declare-option -docstring "Path to the ABC LSP server script" \
    str abc_server_path "%sh{dirname $(dirname $kak_source)}/dist/server.js"

# Key mappings for ABC modes (set to empty string to disable)
declare-option -docstring "Key to enter ABC select mode" \
    str abc_select_key "h"
declare-option -docstring "Key to enter ABC transform mode" \
    str abc_transform_key "k"

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

hook global WinSetOption filetype=(abc|abcx) %{
    # Configure LSP server for this buffer
    set-option buffer lsp_servers %sh{
        printf '[abc-lsp]\n'
        printf 'root_globs = [".git", ".hg"]\n'
        printf 'command = "node"\n'
        printf 'args = ["%s", "--stdio", "--socket=auto"]\n' "$kak_opt_abc_server_path"
    }

    # Enable LSP and semantic tokens
    lsp-enable-window
    hook window -group abc-semantic-tokens BufReload .* lsp-semantic-tokens
    hook window -group abc-semantic-tokens NormalIdle .* lsp-semantic-tokens
    hook window -group abc-semantic-tokens InsertIdle .* lsp-semantic-tokens
    lsp-semantic-tokens

    # Set up key mappings if configured
    evaluate-commands %sh{
        if [ -n "$kak_opt_abc_select_key" ]; then
            printf "map buffer normal %s ':abc-enter-select-mode<ret>' -docstring 'ABC select'\n" "$kak_opt_abc_select_key"
        fi
        if [ -n "$kak_opt_abc_transform_key" ]; then
            printf "map buffer normal %s ':abc-enter-transform-mode<ret>' -docstring 'ABC transform'\n" "$kak_opt_abc_transform_key"
        fi
    }
}

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

source "%sh{dirname $kak_source}/abc-selectors.kak"
source "%sh{dirname $kak_source}/abc-transforms.kak"
source "%sh{dirname $kak_source}/abc-modes.kak"
source "%sh{dirname $kak_source}/abc-preview.kak"
