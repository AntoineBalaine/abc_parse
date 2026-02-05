# ABC Preview Server Integration for Kakoune
# Live browser preview of ABC notation via LSP-managed preview server

# ============================================================================
# Preview Commands
# ============================================================================

define-command abc-preview-open \
    -docstring "Start the ABC preview and open in browser" %{
    evaluate-commands %sh{
        url=$(node "$kak_opt_abc_client_path" \
            --socket="$kak_opt_abc_socket_path" \
            --method="abc.startPreview" \
            --uri="file://$kak_buffile" 2>&1)

        if [ $? -ne 0 ]; then
            # Escape single quotes for Kakoune markup
            escaped_url=$(printf '%s' "$url" | sed "s/'/''/g")
            printf '%s\n' "echo -markup '{Error}$escaped_url'"
            exit 0
        fi

        # Open browser with returned URL
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$url" > /dev/null 2>&1 &
        elif command -v open >/dev/null 2>&1; then
            open "$url" > /dev/null 2>&1 &
        fi

        printf '%s\n' "echo -markup '{Information}Preview opened: $url'"
    }
}

define-command abc-preview-close \
    -docstring "Stop the ABC preview" %{
    evaluate-commands %sh{
        node "$kak_opt_abc_client_path" \
            --socket="$kak_opt_abc_socket_path" \
            --method="abc.stopPreview" \
            --uri="file://$kak_buffile" 2>/dev/null

        printf '%s\n' "echo -markup '{Information}Preview closed'"
    }
}

# ============================================================================
# Cursor Sync
# ============================================================================

define-command -hidden abc-preview-cursor %{
    evaluate-commands %sh{
        node "$kak_opt_abc_client_path" \
            --socket="$kak_opt_abc_socket_path" \
            --method="abc.previewCursor" \
            --uri="file://$kak_buffile" \
            --positions="$kak_cursor_byte_offset" 2>/dev/null
    }
}

# ============================================================================
# Hooks for Cursor Sync
# ============================================================================

hook global WinSetOption filetype=(abc|abcx) %{
    hook buffer NormalIdle .* %{ abc-preview-cursor }
    hook buffer InsertIdle .* %{ abc-preview-cursor }
}
