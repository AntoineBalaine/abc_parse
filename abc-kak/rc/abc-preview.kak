# ABC Preview Server Integration for Kakoune
# Live browser preview of ABC notation with content and cursor sync

# ============================================================================
# Configuration
# ============================================================================

# Path to the preview server (node dist/server.js)
declare-option -docstring "Path to the ABC preview server dist/server.js" \
    str abc_preview_server_path ""

# Preview server port
declare-option -docstring "Port for the ABC preview server" \
    int abc_preview_port 8088

# Session-specific FIFO path (internal)
declare-option -hidden str abc_preview_fifo ""

# Session-specific PID file (internal)
declare-option -hidden str abc_preview_pidfile ""

# ============================================================================
# Preview Commands
# ============================================================================

define-command abc-preview-open \
    -docstring "Start the ABC preview server and open in browser" %{
    evaluate-commands %sh{
        # Check if server path is configured
        if [ -z "$kak_opt_abc_preview_server_path" ]; then
            printf '%s\n' "echo -markup '{Error}abc_preview_server_path is not configured'"
            exit 0
        fi

        # Check if server file exists
        if [ ! -f "$kak_opt_abc_preview_server_path" ]; then
            printf '%s\n' "echo -markup '{Error}Preview server not found at: $kak_opt_abc_preview_server_path'"
            exit 0
        fi

        # Create session-specific paths
        fifo="/tmp/abc-preview-$kak_session.fifo"
        pidfile="/tmp/abc-preview-$kak_session.pid"

        # Clean up any existing FIFO
        rm -f "$fifo"

        # Create new FIFO
        mkfifo "$fifo"

        # Start server with stdin from FIFO in a subshell for process group management
        # Use set -m to enable job control, giving us a process group
        sh -c 'tail -f "$1" | node "$2" --port="$3" > /dev/null 2>&1' -- "$fifo" "$kak_opt_abc_preview_server_path" "$kak_opt_abc_preview_port" &
        echo $! > "$pidfile"
        disown

        # Wait for server to be ready (check port is listening)
        for i in 1 2 3 4 5 6 7 8 9 10; do
            if nc -z localhost "$kak_opt_abc_preview_port" 2>/dev/null; then
                break
            fi
            sleep 0.2
        done

        # Store paths in options
        printf '%s\n' "set-option global abc_preview_fifo '$fifo'"
        printf '%s\n' "set-option global abc_preview_pidfile '$pidfile'"

        # Open browser
        # Extract filename without path for the URL slug
        filename="${kak_bufname##*/}"
        # Remove .abc or .abcx extension for cleaner URL
        slug="${filename%.abc}"
        slug="${slug%.abcx}"
        # URL-encode common problematic characters
        slug=$(printf '%s' "$slug" | sed 's/ /%20/g; s/&/%26/g; s/?/%3F/g')
        url="http://localhost:$kak_opt_abc_preview_port/$slug"

        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$url" > /dev/null 2>&1 &
        elif command -v open >/dev/null 2>&1; then
            open "$url" > /dev/null 2>&1 &
        fi

        printf '%s\n' "echo -markup '{Information}Preview server started on port $kak_opt_abc_preview_port'"
    }

    # Send initial content
    evaluate-commands -draft %{
        execute-keys '%'
        abc-preview-update
    }
}

define-command abc-preview-close \
    -docstring "Stop the ABC preview server" %{
    evaluate-commands %sh{
        pidfile="$kak_opt_abc_preview_pidfile"
        fifo="$kak_opt_abc_preview_fifo"

        # Kill the shell process and all its children (tail and node)
        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                # Kill the process group by negating the PID
                # This kills the shell and all its children (tail, node)
                kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
                # Also try to kill any children directly
                pkill -P "$pid" 2>/dev/null
            fi
            rm -f "$pidfile"
        fi

        # Remove FIFO
        rm -f "$fifo"

        printf '%s\n' "set-option global abc_preview_fifo ''"
        printf '%s\n' "set-option global abc_preview_pidfile ''"
        printf '%s\n' "echo -markup '{Information}Preview server stopped'"
    }
}

define-command abc-preview-status \
    -docstring "Check the status of the ABC preview server" %{
    evaluate-commands %sh{
        fifo="$kak_opt_abc_preview_fifo"
        pidfile="$kak_opt_abc_preview_pidfile"
        port="$kak_opt_abc_preview_port"

        if [ -p "$fifo" ]; then
            if [ -f "$pidfile" ]; then
                pid=$(cat "$pidfile")
                if kill -0 "$pid" 2>/dev/null; then
                    if nc -z localhost "$port" 2>/dev/null; then
                        printf '%s\n' "echo -markup '{Information}Preview server running on port $port (PID $pid)'"
                    else
                        printf '%s\n' "echo -markup '{Information}Preview process running (PID $pid) but port $port not listening'"
                    fi
                else
                    printf '%s\n' "echo -markup '{Information}Preview FIFO exists but process not running'"
                fi
            else
                printf '%s\n' "echo -markup '{Information}Preview FIFO exists but no PID file'"
            fi
        else
            printf '%s\n' "echo -markup '{Information}Preview server not running'"
        fi
    }
}

# ============================================================================
# Content and Cursor Sync
# ============================================================================

define-command -hidden abc-preview-update %{
    evaluate-commands %sh{
        fifo="$kak_opt_abc_preview_fifo"
        pidfile="$kak_opt_abc_preview_pidfile"

        # Only update if FIFO exists and server process is running
        if [ -p "$fifo" ] && [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                # Get buffer content (passed via selection) and encode as base64
                # The selection should be the entire buffer (set by caller via execute-keys '%')
                content_base64=$(printf '%s' "$kak_selection" | base64 | tr -d '\n')

                # Get absolute path of buffer
                filepath="$kak_buffile"

                # Send content message to FIFO with timeout to avoid blocking
                timeout 1 sh -c "printf 'content:%s:%s\n' \"\$1\" \"\$2\" > \"\$3\"" -- "$filepath" "$content_base64" "$fifo" 2>/dev/null || true
            fi
        fi
    }
}

define-command -hidden abc-preview-cursor %{
    evaluate-commands %sh{
        fifo="$kak_opt_abc_preview_fifo"
        pidfile="$kak_opt_abc_preview_pidfile"

        # Only update if FIFO exists and server process is running
        if [ -p "$fifo" ] && [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                # Send cursor position (byte offset) with timeout
                timeout 1 sh -c "printf 'cursor:%s\n' \"\$1\" > \"\$2\"" -- "$kak_cursor_byte_offset" "$fifo" 2>/dev/null || true
            fi
        fi
    }
}

# ============================================================================
# Live Update Hooks
# ============================================================================

hook global WinSetOption filetype=abc %{
    # Auto-open preview if server path is configured and not already running
    evaluate-commands %sh{
        if [ -n "$kak_opt_abc_preview_server_path" ] && [ ! -p "$kak_opt_abc_preview_fifo" ]; then
            printf '%s\n' "abc-preview-open"
        fi
    }

    # Content sync on idle - select entire buffer and send
    hook buffer NormalIdle .* %{
        evaluate-commands -draft %{
            execute-keys '%'
            abc-preview-update
        }
    }
    hook buffer InsertIdle .* %{
        evaluate-commands -draft %{
            execute-keys '%'
            abc-preview-update
        }
    }

    # Cursor sync on idle
    hook buffer NormalIdle .* %{ abc-preview-cursor }
    hook buffer InsertIdle .* %{ abc-preview-cursor }
}
