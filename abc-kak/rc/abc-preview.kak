# ABC Preview Server Integration for Kakoune
# Phase 3 implementation - live preview of ABC notation

# ============================================================================
# Configuration
# ============================================================================

# Path to the preview server script
declare-option -docstring "Path to the ABC preview server" \
    str abc_preview_server_cmd "node /path/to/preview-server/dist/server.js"

# Preview server port
declare-option -docstring "Port for the ABC preview server" \
    int abc_preview_port 8088

# Session-specific PID file
declare-option -hidden str abc_preview_pidfile ""

# ============================================================================
# Preview Commands
# ============================================================================

define-command abc-preview-open \
    -docstring "Start the ABC preview server and open in browser" %{
    evaluate-commands %sh{
        pidfile="/tmp/abc-preview-$kak_session.pid"
        printf '%s\n' "set-option global abc_preview_pidfile '$pidfile'"

        # Start preview server in background
        $kak_opt_abc_preview_server_cmd --port=$kak_opt_abc_preview_port &
        echo $! > "$pidfile"
        disown

        # Wait briefly for server to start
        sleep 0.5

        # Open browser
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "http://localhost:$kak_opt_abc_preview_port/${kak_bufname##*/}" &
        elif command -v open >/dev/null 2>&1; then
            open "http://localhost:$kak_opt_abc_preview_port/${kak_bufname##*/}" &
        fi

        printf '%s\n' "echo -markup '{Information}Preview server started on port $kak_opt_abc_preview_port'"
    }
}

define-command abc-preview-close \
    -docstring "Stop the ABC preview server" %{
    evaluate-commands %sh{
        pidfile="$kak_opt_abc_preview_pidfile"
        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                printf '%s\n' "echo -markup '{Information}Preview server stopped'"
            fi
            rm -f "$pidfile"
        else
            printf '%s\n' "echo -markup '{Information}No preview server running'"
        fi
    }
}

# ============================================================================
# Live Update Hooks
# ============================================================================

# Send buffer content to preview server on idle
# This requires the preview server to accept content via stdin or a named pipe
# Implementation depends on preview server's communication protocol

hook global WinSetOption filetype=abc %{
    hook buffer NormalIdle .* %{ abc-preview-update }
    hook buffer InsertIdle .* %{ abc-preview-update }
}

define-command -hidden abc-preview-update %{
    # Only update if preview server is running
    evaluate-commands %sh{
        pidfile="$kak_opt_abc_preview_pidfile"
        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                # TODO: Send buffer content to preview server
                # The implementation depends on the preview server's stdin protocol
                :
            fi
        fi
    }
}
