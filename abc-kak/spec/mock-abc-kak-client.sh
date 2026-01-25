#!/bin/bash
# Mock client for kak-spec tests
# Returns predefined responses based on --selector argument

selector=""
for arg in "$@"; do
    case "$arg" in
        --selector=*) selector="${arg#--selector=}" ;;
    esac
done

case "$selector" in
    "selectChords")
        echo "1.3,1.7 1.10,1.14"
        echo "[42,87]"
        ;;
    "selectNotes")
        echo "1.1,1.2 1.5,1.6 1.8,1.9"
        echo "[10,20,30]"
        ;;
    "selectTop")
        echo "1.3,1.4"
        echo "[42]"
        ;;
    "selectBottom")
        echo "1.5,1.6"
        echo "[43]"
        ;;
    "selectRests")
        echo "1.12,1.14"
        echo "[99]"
        ;;
    "selectTune")
        echo "1.1,3.10"
        echo "[1]"
        ;;
    "_empty")
        echo ""
        echo "[]"
        ;;
    "_error")
        echo "Mock error message" >&2
        exit 1
        ;;
    *)
        echo ""
        echo "[]"
        ;;
esac
