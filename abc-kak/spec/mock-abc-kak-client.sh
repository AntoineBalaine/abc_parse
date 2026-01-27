#!/bin/bash
# Mock client for kak-spec tests
# Returns predefined responses based on --selector argument
# Stateless API: only outputs selection descriptors (single line)

selector=""
for arg in "$@"; do
    case "$arg" in
        --selector=*) selector="${arg#--selector=}" ;;
    esac
done

case "$selector" in
    "selectChords")
        echo "1.3,1.7 1.10,1.14"
        ;;
    "selectNotes")
        echo "1.1,1.2 1.5,1.6 1.8,1.9"
        ;;
    "selectTop")
        echo "1.3,1.4"
        ;;
    "selectBottom")
        echo "1.5,1.6"
        ;;
    "selectRests")
        echo "1.12,1.14"
        ;;
    "selectRhythm")
        echo "3.2,3.2 3.7,3.8"
        ;;
    "selectRhythmParent")
        echo "3.1,3.2 3.6,3.8"
        ;;
    "selectTune")
        echo "1.1,3.10"
        ;;
    "_empty")
        echo ""
        ;;
    "_error")
        echo "Mock error message" >&2
        exit 1
        ;;
    *)
        echo ""
        ;;
esac
