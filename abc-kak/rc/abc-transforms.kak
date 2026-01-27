# ABC Transform Commands for Kakoune
# These commands invoke the ABC LSP server's transform system and apply
# the resulting edits to the buffer.

# ============================================================================
# Internal Helper
# ============================================================================

# Common implementation for all transform commands.
# Arguments:
#   $1 - transform name
#   $2 - transform args as JSON array (default: [])
define-command -hidden abc-transform-impl -params 1..2 %{
    # Check pending flag first to prevent concurrent requests
    evaluate-commands %sh{
        if [ "$kak_opt_abc_pending" = "true" ]; then
            printf '%s\n' "echo -markup '{Information}Transform request in progress'"
            exit 0
        fi
        printf '%s\n' "set-option buffer abc_pending true"
    }

    # Create temp files for buffer content and result
    evaluate-commands %sh{
        tmpfile=$(mktemp)
        resultfile=$(mktemp)
        printf '%s\n' "set-option buffer abc_tmpfile '$tmpfile'"
        printf '%s\n' "set-option buffer abc_resultfile '$resultfile'"
    }

    # Capture buffer content to temp file (handles unsaved changes)
    execute-keys -draft '%' "<a-|>cat > %opt{abc_tmpfile}<ret>"

    # Build and send request, process response
    evaluate-commands %sh{
        transform="$1"
        args="${2:-[]}"
        selections_desc="$kak_selections_desc"
        uri="file://${kak_buffile}"

        # Invoke the client in transform mode
        node "$kak_opt_abc_client_path" \
            --socket="$kak_opt_abc_socket_path" \
            --uri="$uri" \
            --transform="$transform" \
            --args="$args" \
            --ranges="$selections_desc" \
            --buffer-file="$kak_opt_abc_tmpfile" \
            --timeout="$kak_opt_abc_timeout" > "$kak_opt_abc_resultfile" 2>&1
        exit_code=$?

        # Clean up input temp file
        rm -f "$kak_opt_abc_tmpfile"

        # Clear pending flag
        printf '%s\n' "set-option buffer abc_pending false"

        # Handle result
        if [ $exit_code -ne 0 ]; then
            # Read error message from result file
            error_msg=$(cat "$kak_opt_abc_resultfile")
            rm -f "$kak_opt_abc_resultfile"
            # Escape single quotes and Kakoune markup characters in error message
            escaped=$(printf '%s' "$error_msg" | sed "s/'/''/g; s/{/{{/g; s/}/}}/g")
            printf '%s\n' "echo -markup '{Error}$escaped'"
            exit 0
        fi

        # Check if result file has content (transform produced changes)
        if [ -s "$kak_opt_abc_resultfile" ]; then
            # Replace entire buffer with result
            printf '%s\n' "execute-keys '%d'"
            printf '%s\n' "execute-keys '!cat %opt{abc_resultfile}<ret>'"
        fi

        # Clean up result file
        printf '%s\n' "nop %sh{ rm -f \"$kak_opt_abc_resultfile\" }"
    }
}

# ============================================================================
# Voice Transform Commands
# ============================================================================

define-command abc-insert-voice-line -params 1 \
    -docstring "abc-insert-voice-line <voice-id>: Insert a voice line from selected notes" %{
    abc-transform-impl insertVoiceLine "[\"$1\"]"
}
