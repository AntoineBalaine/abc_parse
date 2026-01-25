# ABC Selector Commands for Kakoune
# These commands invoke the ABC LSP server's selector system and convert
# the results to native Kakoune multi-selections.

# ============================================================================
# Internal Helper
# ============================================================================

# Common implementation for all selector commands.
# Arguments:
#   $1 - selector name
#   $2 - selector args as JSON array (default: [])
define-command -hidden abc-select-impl -params 1..2 %{
    # Check pending flag first to prevent concurrent requests
    evaluate-commands %sh{
        if [ "$kak_opt_abc_pending" = "true" ]; then
            printf '%s\n' "echo -markup '{Information}Selector request in progress'"
            exit 0
        fi
        printf '%s\n' "set-option buffer abc_pending true"
    }

    # Create temp file for buffer content
    evaluate-commands %sh{
        tmpfile=$(mktemp)
        printf '%s\n' "set-option buffer abc_tmpfile '$tmpfile'"
    }

    # Capture buffer content to temp file (handles unsaved changes)
    execute-keys -draft '%' "<a-|>cat > %opt{abc_tmpfile}<ret>"

    # Build and send request, process response
    evaluate-commands %sh{
        selector="$1"
        args="${2:-[]}"
        selections_desc="$kak_selections_desc"
        uri="file://${kak_buffile}"
        cursor_node_ids="$kak_opt_abc_cursor_node_ids"

        # Invoke the client
        result=$("$kak_opt_abc_client_cmd" \
            --socket="$kak_opt_abc_socket_path" \
            --uri="$uri" \
            --selector="$selector" \
            --args="$args" \
            --cursor-ids="$cursor_node_ids" \
            --scope="$selections_desc" \
            --buffer-file="$kak_opt_abc_tmpfile" \
            --timeout="$kak_opt_abc_timeout" 2>&1)
        exit_code=$?

        # Clean up temp file
        rm -f "$kak_opt_abc_tmpfile"

        # Clear pending flag
        printf '%s\n' "set-option buffer abc_pending false"

        # Handle result
        if [ $exit_code -ne 0 ]; then
            # Escape single quotes and Kakoune markup characters in error message
            escaped=$(printf '%s' "$result" | sed "s/'/''/g; s/{/{{/g; s/}/}}/g")
            printf '%s\n' "echo -markup '{Error}$escaped'"
            exit 0
        fi

        # Result format: line 1 = selection descriptors, line 2 = cursorNodeIds JSON
        new_selections=$(printf '%s' "$result" | head -n1)
        new_ids=$(printf '%s' "$result" | tail -n1)

        if [ -n "$new_selections" ]; then
            printf '%s\n' "select $new_selections"
            printf '%s\n' "set-option buffer abc_cursor_node_ids '$new_ids'"
            printf '%s\n' "set-option buffer abc_last_selections '$new_selections'"
        else
            printf '%s\n' "echo -markup '{Information}No matches found'"
        fi
    }
}

# ============================================================================
# Type Selectors
# ============================================================================

define-command abc-select-chords -docstring "Select all chord nodes" %{
    abc-select-impl selectChords
}

define-command abc-select-notes -docstring "Select all note nodes" %{
    abc-select-impl selectNotes
}

define-command abc-select-non-chord-notes \
    -docstring "Select notes not inside chords" %{
    abc-select-impl selectNonChordNotes
}

define-command abc-select-chord-notes \
    -docstring "Select notes inside chords" %{
    abc-select-impl selectChordNotes
}

define-command abc-select-rests -docstring "Select all rest nodes" %{
    abc-select-impl selectRests
}

# ============================================================================
# Structure Selectors
# ============================================================================

define-command abc-select-tune \
    -docstring "Select individual tunes (for multi-tune files)" %{
    abc-select-impl selectTune
}

# ============================================================================
# Chord Note Selectors
# ============================================================================

define-command abc-select-top \
    -docstring "Select the top note of each chord" %{
    abc-select-impl selectTop
}

define-command abc-select-bottom \
    -docstring "Select the bottom note of each chord" %{
    abc-select-impl selectBottom
}

define-command abc-select-nth-from-top -params 1 \
    -docstring "Select the Nth note from top (0-indexed)" %{
    abc-select-impl selectNthFromTop "[$1]"
}

define-command abc-select-all-but-top \
    -docstring "Select all notes except the top of each chord" %{
    abc-select-impl selectAllButTop
}

define-command abc-select-all-but-bottom \
    -docstring "Select all notes except the bottom of each chord" %{
    abc-select-impl selectAllButBottom
}
