/**
 * JSON Protocol
 *
 * Defines the IPC protocol for communication between the mscore binary
 * and Node.js via stdin/stdout.
 */

#pragma once

#include "../vendor/nlohmann/json.hpp"
#include "musesampler_wrapper.h"

#include <string>
#include <optional>

namespace abc {

using json = nlohmann::json;

/**
 * Command types sent from Node.js to mscore.
 */
enum class CommandType {
    LoadLibrary,
    GetInstruments,
    CreateSession,
    DestroySession,
    AddTrack,
    FinalizeTrack,
    ClearTrack,
    AddNoteEvent,
    AddDynamicsEvent,
    Play,
    Pause,
    Seek,
    Stop,
    Quit,
    Unknown
};

/**
 * Parsed command from JSON input.
 */
struct Command {
    CommandType type = CommandType::Unknown;
    std::string raw;

    // Optional parameters based on command type
    std::optional<std::string> path;
    std::optional<int> sessionId;
    std::optional<int> trackId;
    std::optional<int> instrumentId;
    std::optional<double> sampleRate;
    std::optional<int> blockSize;
    std::optional<int> channels;
    std::optional<int64_t> positionUs;
    std::optional<NoteEvent> noteEvent;
    std::optional<DynamicsEvent> dynamicsEvent;
};

/**
 * Response to send back to Node.js.
 */
struct Response {
    bool ok = true;
    std::string error;
    json data;

    json toJson() const {
        json j;
        j["ok"] = ok;
        if (!ok && !error.empty()) {
            j["error"] = error;
        }
        if (!data.is_null()) {
            for (auto& [key, value] : data.items()) {
                j[key] = value;
            }
        }
        return j;
    }
};

/**
 * Parse a JSON command from string input.
 */
Command parseCommand(const std::string& line);

/**
 * Create a success response.
 */
Response successResponse(json data = nullptr);

/**
 * Create an error response.
 */
Response errorResponse(const std::string& message);

/**
 * Convert an InstrumentInfo to JSON.
 */
json instrumentToJson(const InstrumentInfo& inst);

/**
 * Convert a NoteEvent from JSON.
 */
NoteEvent noteEventFromJson(const json& j);

/**
 * Convert a DynamicsEvent from JSON.
 */
DynamicsEvent dynamicsEventFromJson(const json& j);

} // namespace abc
