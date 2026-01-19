/**
 * JSON Protocol Implementation
 *
 * Handles parsing and serialization of IPC messages.
 */

#include "json_protocol.h"

#include <iostream>
#include <unordered_map>

namespace abc {

namespace {

const std::unordered_map<std::string, CommandType> COMMAND_MAP = {
    {"load_library", CommandType::LoadLibrary},
    {"get_instruments", CommandType::GetInstruments},
    {"create_session", CommandType::CreateSession},
    {"destroy_session", CommandType::DestroySession},
    {"add_track", CommandType::AddTrack},
    {"finalize_track", CommandType::FinalizeTrack},
    {"clear_track", CommandType::ClearTrack},
    {"add_note_event", CommandType::AddNoteEvent},
    {"add_dynamics_event", CommandType::AddDynamicsEvent},
    {"play", CommandType::Play},
    {"pause", CommandType::Pause},
    {"seek", CommandType::Seek},
    {"stop", CommandType::Stop},
    {"quit", CommandType::Quit},
};

template<typename T>
std::optional<T> getOptional(const json& j, const std::string& key) {
    if (j.contains(key) && !j[key].is_null()) {
        return j[key].get<T>();
    }
    return std::nullopt;
}

} // anonymous namespace

Command parseCommand(const std::string& line) {
    Command cmd;
    cmd.raw = line;

    try {
        json j = json::parse(line);

        // Get command type
        if (j.contains("cmd") && j["cmd"].is_string()) {
            std::string cmdStr = j["cmd"].get<std::string>();
            auto it = COMMAND_MAP.find(cmdStr);
            if (it != COMMAND_MAP.end()) {
                cmd.type = it->second;
            }
        }

        // Parse optional parameters
        cmd.path = getOptional<std::string>(j, "path");
        cmd.sessionId = getOptional<int>(j, "session_id");
        cmd.trackId = getOptional<int>(j, "track_id");
        cmd.instrumentId = getOptional<int>(j, "instrument_id");
        cmd.sampleRate = getOptional<double>(j, "sample_rate");
        cmd.blockSize = getOptional<int>(j, "block_size");
        cmd.channels = getOptional<int>(j, "channels");
        cmd.positionUs = getOptional<int64_t>(j, "position_us");

        // Parse note event if present
        if (j.contains("event") && j["event"].is_object()) {
            cmd.noteEvent = noteEventFromJson(j["event"]);
        }

        // Parse dynamics event if present
        if (j.contains("dynamics") && j["dynamics"].is_object()) {
            cmd.dynamicsEvent = dynamicsEventFromJson(j["dynamics"]);
        }

    } catch (const json::parse_error& e) {
        std::cerr << "JSON parse error: " << e.what() << std::endl;
        cmd.type = CommandType::Unknown;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing command: " << e.what() << std::endl;
        cmd.type = CommandType::Unknown;
    }

    return cmd;
}

Response successResponse(json data) {
    Response resp;
    resp.ok = true;
    resp.data = std::move(data);
    return resp;
}

Response errorResponse(const std::string& message) {
    Response resp;
    resp.ok = false;
    resp.error = message;
    return resp;
}

json instrumentToJson(const InstrumentInfo& inst) {
    return json{
        {"id", inst.id},
        {"name", inst.name},
        {"category", inst.category},
        {"pack_name", inst.packName}
    };
}

NoteEvent noteEventFromJson(const json& j) {
    NoteEvent event;
    event.voice = j.value("voice", 0);
    event.location_us = j.value("location_us", 0LL);
    event.duration_us = j.value("duration_us", 0LL);
    event.pitch = j.value("pitch", 60);
    event.tempo = j.value("tempo", 120.0);
    event.offset_cents = j.value("offset_cents", 0);
    event.articulation = j.value("articulation", 0ULL);
    event.articulation_2 = j.value("articulation_2", 0ULL);
    event.notehead = j.value("notehead", 0);
    return event;
}

DynamicsEvent dynamicsEventFromJson(const json& j) {
    DynamicsEvent event;
    event.location_us = j.value("location_us", 0LL);
    event.value = j.value("value", 0.5);
    return event;
}

} // namespace abc
