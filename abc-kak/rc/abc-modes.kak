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

# ============================================================================
# Selection Mode Mappings
# ============================================================================

# --- Type Selectors ---
map global abc-select c ':abc-select-chords<ret>'          -docstring 'chords'
map global abc-select n ':abc-select-notes<ret>'           -docstring 'notes'
map global abc-select N ':abc-select-non-chord-notes<ret>' -docstring 'non-chord notes'
map global abc-select C ':abc-select-chord-notes<ret>'     -docstring 'chord notes'
map global abc-select z ':abc-select-rests<ret>'           -docstring 'rests'

# --- Rhythm Selectors ---
map global abc-select r ':abc-select-rhythm<ret>'          -docstring 'rhythm expressions'
map global abc-select R ':abc-select-rhythm-parent<ret>'   -docstring 'rhythm parents'

# --- Structure Selectors ---
map global abc-select x ':abc-select-tune<ret>'            -docstring 'tune'
map global abc-select m ':abc-select-measures<ret>'        -docstring 'measures'
map global abc-select s ':abc-select-system<ret>'          -docstring 'system'
map global abc-select v ':prompt "Voice IDs: " %{ abc-select-voices %val{text} }<ret>' -docstring 'voices (prompts)'

# --- Chord Position Selectors ---
map global abc-select t ':abc-select-top<ret>'             -docstring 'top note'
map global abc-select T ':abc-select-all-but-top<ret>'     -docstring 'all but top'
map global abc-select b ':abc-select-bottom<ret>'          -docstring 'bottom note'
map global abc-select B ':abc-select-all-but-bottom<ret>'  -docstring 'all but bottom'

# --- Nth from Top (1-9) ---
map global abc-select 1 ':abc-select-nth-from-top 1<ret>'  -docstring '1st from top'
map global abc-select 2 ':abc-select-nth-from-top 2<ret>'  -docstring '2nd from top'
map global abc-select 3 ':abc-select-nth-from-top 3<ret>'  -docstring '3rd from top'
map global abc-select 4 ':abc-select-nth-from-top 4<ret>'  -docstring '4th from top'
map global abc-select 5 ':abc-select-nth-from-top 5<ret>'  -docstring '5th from top'
map global abc-select 6 ':abc-select-nth-from-top 6<ret>'  -docstring '6th from top'
map global abc-select 7 ':abc-select-nth-from-top 7<ret>'  -docstring '7th from top'
map global abc-select 8 ':abc-select-nth-from-top 8<ret>'  -docstring '8th from top'
map global abc-select 9 ':abc-select-nth-from-top 9<ret>'  -docstring '9th from top'

# --- Inside/Around Entry Points ---
map global abc-select i ':enter-user-mode abc-select-inside<ret>' -docstring 'inside...'
map global abc-select a ':enter-user-mode abc-select-around<ret>' -docstring 'around...'
