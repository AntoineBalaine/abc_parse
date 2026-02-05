# ABC User Modes
#
# This file defines user-modes for ABC-aware selection and transformation.
# Users bind the entry commands to their preferred prefix keys in their kakrc.
#
# Modes defined:
#   abc-select        - Structural selection (notes, chords, measures, etc.)
#   abc-transform     - Pitch, rhythm, and other transformations
#   abc-select-inside - Text-object selectors for content inside delimiters
#   abc-select-around - Text-object selectors for content including delimiters
#
# Example usage in kakrc:
#   hook global WinSetOption filetype=abc %{
#       map buffer user s ':abc-enter-select-mode<ret>' -docstring 'ABC select'
#       map buffer user t ':abc-enter-transform-mode<ret>' -docstring 'ABC transform'
#   }

# ============================================================================
# User Mode Declarations
# ============================================================================

declare-user-mode abc-select
declare-user-mode abc-transform
declare-user-mode abc-select-inside
declare-user-mode abc-select-around

# ============================================================================
# Entry Commands
# ============================================================================

define-command abc-enter-select-mode \
    -docstring "Enter ABC selection mode for structural selection" %{
    enter-user-mode abc-select
}

define-command abc-enter-transform-mode \
    -docstring "Enter ABC transform mode for applying transformations" %{
    enter-user-mode abc-transform
}
