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

define-command abc-add-voice -params 1..2 \
    -docstring "abc-add-voice <voice-id> [params-json]: Add a new voice with selected notes" %{
    evaluate-commands %sh{
        voice_id="$1"
        params="${2:-{}}"
        printf '%s\n' "abc-transform-impl addVoice '[\"$voice_id\", $params]'"
    }
}

# ============================================================================
# Pitch Transform Commands
# ============================================================================

define-command abc-transpose -params 1 \
    -docstring "abc-transpose <semitones>: Transpose selected notes by semitone count" %{
    abc-transform-impl transpose "[$1]"
}

define-command abc-enharmonize \
    -docstring "Convert selected notes to their enharmonic equivalents" %{
    abc-transform-impl enharmonize
}

define-command abc-harmonize -params 1 \
    -docstring "abc-harmonize <interval>: Harmonize selected notes at the given interval" %{
    abc-transform-impl harmonize "[$1]"
}

# ============================================================================
# Rhythm Transform Commands
# ============================================================================

define-command abc-set-rhythm -params 2 \
    -docstring "abc-set-rhythm <num> <denom>: Set rhythm to the specified fraction (e.g., 1 2 for 1/2)" %{
    abc-transform-impl setRhythm "[{\"num\": $1, \"denom\": $2}]"
}

define-command abc-add-to-rhythm -params 2 \
    -docstring "abc-add-to-rhythm <num> <denom>: Add the specified fraction to current rhythm" %{
    abc-transform-impl addToRhythm "[{\"num\": $1, \"denom\": $2}]"
}

# ============================================================================
# Conversion Transform Commands
# ============================================================================

define-command abc-to-rest \
    -docstring "Convert selected notes to rests" %{
    abc-transform-impl toRest
}

define-command abc-consolidate-rests \
    -docstring "Consolidate consecutive rests into a single rest" %{
    abc-transform-impl consolidateRests
}

# ============================================================================
# Structural Transform Commands
# ============================================================================

define-command abc-unwrap-single \
    -docstring "Unwrap single-note chords (e.g., [C] becomes C)" %{
    abc-transform-impl unwrapSingle
}

define-command abc-remove \
    -docstring "Remove selected elements" %{
    abc-transform-impl remove
}
