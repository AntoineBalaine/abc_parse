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

# ============================================================================
# Count-Aware Transform Wrappers
# ============================================================================

# These wrapper commands read Kakoune's count register and pass the value to
# the underlying transform commands. Commands default to 1 for pitch transforms
# and 2 for rhythm/explode transforms when no count is specified.

# --- Octave Transforms (default: 1 octave) ---

define-command -hidden abc-transform-octave-up %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-transpose $((count * 12))"
    }
}

define-command -hidden abc-transform-octave-down %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-transpose $((-count * 12))"
    }
}

define-command -hidden abc-transform-harmonize-octave-up %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-harmonize $((count * 7))"
    }
}

define-command -hidden abc-transform-harmonize-octave-down %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-harmonize $((-count * 7))"
    }
}

# --- Semitone Transforms (default: 1 semitone) ---

define-command -hidden abc-transform-transpose-up %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-transpose $count"
    }
}

define-command -hidden abc-transform-transpose-down %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-transpose $((-count))"
    }
}

# --- Diatonic Transforms (default: 1 step) ---

define-command -hidden abc-transform-harmonize-up %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-harmonize $count"
    }
}

define-command -hidden abc-transform-harmonize-down %{
    evaluate-commands %sh{
        count="${kak_count:-1}"
        if [ "$count" = "0" ]; then count=1; fi
        printf '%s\n' "abc-harmonize $((-count))"
    }
}

# --- Rhythm Transforms (default: factor of 2) ---

define-command -hidden abc-transform-multiply-rhythm %{
    evaluate-commands %sh{
        count="${kak_count:-2}"
        if [ "$count" = "0" ]; then count=2; fi
        printf '%s\n' "abc-multiply-rhythm $count"
    }
}

define-command -hidden abc-transform-divide-rhythm %{
    evaluate-commands %sh{
        count="${kak_count:-2}"
        if [ "$count" = "0" ]; then count=2; fi
        printf '%s\n' "abc-divide-rhythm $count"
    }
}

# --- Explode Transform (default: 2 parts) ---

define-command -hidden abc-transform-explode %{
    evaluate-commands %sh{
        count="${kak_count:-2}"
        if [ "$count" = "0" ]; then count=2; fi
        printf '%s\n' "abc-explode $count"
    }
}

# ============================================================================
# Transform Mode Mappings
# ============================================================================

# --- Pitch Transforms: Octave ---
map global abc-transform o ':abc-transform-octave-up<ret>'           -docstring '[count] octave up'
map global abc-transform O ':abc-transform-octave-down<ret>'         -docstring '[count] octave down'
map global abc-transform <a-o> ':abc-transform-harmonize-octave-up<ret>'   -docstring '[count] harmonize octave up'
map global abc-transform <a-O> ':abc-transform-harmonize-octave-down<ret>' -docstring '[count] harmonize octave down'

# --- Pitch Transforms: Semitone/Diatonic ---
map global abc-transform p ':abc-transform-transpose-up<ret>'        -docstring '[count] transpose up (semitone)'
map global abc-transform P ':abc-transform-transpose-down<ret>'      -docstring '[count] transpose down'
map global abc-transform <a-p> ':abc-transform-harmonize-up<ret>'    -docstring '[count] harmonize up (diatonic)'
map global abc-transform <a-P> ':abc-transform-harmonize-down<ret>'  -docstring '[count] harmonize down'

# --- Pitch Transforms: Accidentals ---
map global abc-transform + ':abc-add-sharp<ret>'                -docstring 'add sharp'
map global abc-transform <minus> ':abc-add-flat<ret>'           -docstring 'add flat'
map global abc-transform e ':abc-enharmonize<ret>'              -docstring 'enharmonize'

# --- Rhythm Transforms ---
map global abc-transform * ':abc-transform-multiply-rhythm<ret>'     -docstring '[count] multiply length'
map global abc-transform / ':abc-transform-divide-rhythm<ret>'       -docstring '[count] divide length'

# --- Voice Transforms ---
map global abc-transform v ':abc-voice-info-to-inline<ret>'     -docstring 'V:1 to [V:1]'
map global abc-transform V ':abc-voice-inline-to-info<ret>'     -docstring '[V:1] to V:1'
map global abc-transform <a-v> ':prompt "Voice ID: " %{ abc-insert-voice-line %val{text} }<ret>' -docstring 'insert voice line'
map global abc-transform <a-V> ':prompt "Voice ID: " %{ abc-add-voice %val{text} }<ret>'         -docstring 'add voice'

# --- Dynamics Transforms ---
map global abc-transform <lt> ':abc-wrap-crescendo<ret>'        -docstring 'wrap crescendo'
map global abc-transform <gt> ':abc-wrap-decrescendo<ret>'      -docstring 'wrap decrescendo'

# --- Explode Transform ---
map global abc-transform x ':abc-transform-explode<ret>'             -docstring '[count] explode chords'

# --- Convert Transforms ---
map global abc-transform r ':abc-to-rest<ret>'                  -docstring 'to rest'
map global abc-transform R ':abc-consolidate-rests<ret>'        -docstring 'consolidate rests'

# ============================================================================
# Inside/Around Submodes
# ============================================================================

# These submodes provide text-object-style selectors for delimited constructs.
# Enter via 'i' (inside) or 'a' (around) from the abc-select mode.

# --- Inside Submode ---
map global abc-select-inside c ':abc-select-inside-chord<ret>'        -docstring 'inside chord'
map global abc-select-inside g ':abc-select-inside-grace-group<ret>'  -docstring 'inside grace group'
map global abc-select-inside f ':abc-select-inside-inline-field<ret>' -docstring 'inside inline field'
map global abc-select-inside p ':abc-select-inside-grouping<ret>'     -docstring 'inside grouping'

# --- Around Submode ---
map global abc-select-around c ':abc-select-around-chord<ret>'        -docstring 'around chord'
map global abc-select-around g ':abc-select-around-grace-group<ret>'  -docstring 'around grace group'
map global abc-select-around f ':abc-select-around-inline-field<ret>' -docstring 'around inline field'
map global abc-select-around p ':abc-select-around-grouping<ret>'     -docstring 'around grouping'
