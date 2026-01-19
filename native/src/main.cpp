/**
 * mscore - MuseSampler Helper Binary
 *
 * This binary loads the MuseSampler library and provides a JSON-based
 * IPC interface for controlling audio playback from Node.js.
 *
 * IMPORTANT: The binary must be named "mscore" because MuseSampler
 * validates the calling process name.
 *
 * Communication is via stdin/stdout:
 * - Commands come in as JSON lines on stdin
 * - Responses go out as JSON lines on stdout
 * - Logging/errors go to stderr
 */

#include "musesampler_wrapper.h"
#include "audio_output.h"
#include "json_protocol.h"

#include <iostream>
#include <string>
#include <unordered_map>
#include <mutex>
#include <atomic>
#include <memory>
#include <vector>

namespace abc {

/**
 * Playback session state.
 * Manages the MuseSampler session, tracks, and audio output.
 */
struct PlaybackSession {
    SessionHandle msSession = nullptr;
    std::vector<TrackHandle> tracks;
    std::atomic<bool> playing{false};
    int64_t position = 0;  // Current position in samples

    double sampleRate = 44100.0;
    int blockSize = 512;
    int channels = 2;
};

/**
 * Application state.
 */
class AppState {
public:
    MuseSamplerWrapper wrapper;
    AudioOutput audio;

    std::unordered_map<int, std::unique_ptr<PlaybackSession>> sessions;
    int nextSessionId = 1;
    int nextTrackId = 1;  // Global track counter for IPC

    // Maps track IDs to session IDs
    std::unordered_map<int, int> trackToSession;

    std::mutex mutex;

    int createSession(double sampleRate, int blockSize, int channels) {
        auto session = std::make_unique<PlaybackSession>();
        session->sampleRate = sampleRate;
        session->blockSize = blockSize;
        session->channels = channels;

        session->msSession = wrapper.createSession(sampleRate, blockSize, channels);
        if (!session->msSession) {
            return -1;
        }

        if (!wrapper.initSession(session->msSession, sampleRate, blockSize, channels)) {
            wrapper.destroySession(session->msSession);
            return -1;
        }

        int id = nextSessionId++;
        sessions[id] = std::move(session);
        return id;
    }

    PlaybackSession* getSession(int id) {
        auto it = sessions.find(id);
        if (it != sessions.end()) {
            return it->second.get();
        }
        return nullptr;
    }

    void destroySession(int id) {
        auto it = sessions.find(id);
        if (it != sessions.end()) {
            if (it->second->msSession) {
                wrapper.destroySession(it->second->msSession);
            }
            sessions.erase(it);
        }
    }

    int addTrack(int sessionId, int instrumentId) {
        auto* session = getSession(sessionId);
        if (!session || !session->msSession) {
            return -1;
        }

        TrackHandle track = wrapper.addTrack(session->msSession, instrumentId);
        if (!track) {
            return -1;
        }

        session->tracks.push_back(track);
        int trackId = nextTrackId++;
        trackToSession[trackId] = sessionId;
        return trackId;
    }

    std::pair<PlaybackSession*, TrackHandle> getTrack(int trackId) {
        auto it = trackToSession.find(trackId);
        if (it == trackToSession.end()) {
            return {nullptr, nullptr};
        }

        auto* session = getSession(it->second);
        if (!session) {
            return {nullptr, nullptr};
        }

        // Track ID maps to index in session's tracks vector
        // We use a simple scheme: trackId - firstTrackIdInSession
        // For now, just iterate
        for (auto& t : session->tracks) {
            // This is simplified - in production we'd need proper mapping
            return {session, t};
        }

        return {nullptr, nullptr};
    }
};

/**
 * Handle a single command and return a response.
 */
Response handleCommand(const Command& cmd, AppState& state) {
    std::lock_guard<std::mutex> lock(state.mutex);

    switch (cmd.type) {
        case CommandType::LoadLibrary: {
            if (!cmd.path) {
                return errorResponse("Missing 'path' parameter");
            }

            if (!state.wrapper.loadLibrary(*cmd.path)) {
                return errorResponse("Failed to load MuseSampler library");
            }

            auto version = state.wrapper.getVersion();
            json data;
            data["version"] = version.toString();
            return successResponse(data);
        }

        case CommandType::GetInstruments: {
            if (!state.wrapper.isLoaded()) {
                return errorResponse("Library not loaded");
            }

            auto instruments = state.wrapper.getInstruments();
            json data;
            data["instruments"] = json::array();
            for (const auto& inst : instruments) {
                data["instruments"].push_back(instrumentToJson(inst));
            }
            return successResponse(data);
        }

        case CommandType::CreateSession: {
            if (!state.wrapper.isLoaded()) {
                return errorResponse("Library not loaded");
            }

            double sampleRate = cmd.sampleRate.value_or(44100.0);
            int blockSize = cmd.blockSize.value_or(512);
            int channels = cmd.channels.value_or(2);

            int sessionId = state.createSession(sampleRate, blockSize, channels);
            if (sessionId < 0) {
                return errorResponse("Failed to create session");
            }

            // Initialize audio output
            if (!state.audio.isInitialized()) {
                if (!state.audio.initialize(static_cast<int>(sampleRate), channels, blockSize)) {
                    return errorResponse("Failed to initialize audio output");
                }
            }

            json data;
            data["session_id"] = sessionId;
            return successResponse(data);
        }

        case CommandType::DestroySession: {
            if (!cmd.sessionId) {
                return errorResponse("Missing 'session_id' parameter");
            }

            state.destroySession(*cmd.sessionId);
            return successResponse();
        }

        case CommandType::AddTrack: {
            if (!cmd.sessionId) {
                return errorResponse("Missing 'session_id' parameter");
            }
            if (!cmd.instrumentId) {
                return errorResponse("Missing 'instrument_id' parameter");
            }

            int trackId = state.addTrack(*cmd.sessionId, *cmd.instrumentId);
            if (trackId < 0) {
                return errorResponse("Failed to add track");
            }

            json data;
            data["track_id"] = trackId;
            return successResponse(data);
        }

        case CommandType::FinalizeTrack: {
            if (!cmd.sessionId || !cmd.trackId) {
                return errorResponse("Missing session_id or track_id");
            }

            auto* session = state.getSession(*cmd.sessionId);
            if (!session || session->tracks.empty()) {
                return errorResponse("Invalid session or track");
            }

            // Finalize the last track (simplified)
            TrackHandle track = session->tracks.back();
            if (!state.wrapper.finalizeTrack(session->msSession, track)) {
                return errorResponse("Failed to finalize track");
            }

            return successResponse();
        }

        case CommandType::AddNoteEvent: {
            if (!cmd.sessionId || !cmd.trackId || !cmd.noteEvent) {
                return errorResponse("Missing session_id, track_id, or event");
            }

            auto* session = state.getSession(*cmd.sessionId);
            if (!session || session->tracks.empty()) {
                return errorResponse("Invalid session or track");
            }

            TrackHandle track = session->tracks.back();
            if (!state.wrapper.addNoteEvent(session->msSession, track, *cmd.noteEvent)) {
                return errorResponse("Failed to add note event");
            }

            return successResponse();
        }

        case CommandType::AddDynamicsEvent: {
            if (!cmd.sessionId || !cmd.trackId || !cmd.dynamicsEvent) {
                return errorResponse("Missing session_id, track_id, or dynamics");
            }

            auto* session = state.getSession(*cmd.sessionId);
            if (!session || session->tracks.empty()) {
                return errorResponse("Invalid session or track");
            }

            TrackHandle track = session->tracks.back();
            if (!state.wrapper.addDynamicsEvent(session->msSession, track, *cmd.dynamicsEvent)) {
                return errorResponse("Failed to add dynamics event");
            }

            return successResponse();
        }

        case CommandType::Play: {
            if (!cmd.sessionId) {
                return errorResponse("Missing 'session_id' parameter");
            }

            auto* session = state.getSession(*cmd.sessionId);
            if (!session) {
                return errorResponse("Invalid session");
            }

            // Set up audio callback
            state.audio.setCallback([&state, session](float* output, uint32_t frameCount) {
                if (!session->playing) {
                    // Output silence
                    for (uint32_t i = 0; i < frameCount * session->channels; i++) {
                        output[i] = 0.0f;
                    }
                    return;
                }

                // Create output buffer
                std::vector<float*> channelPtrs(session->channels);
                std::vector<std::vector<float>> channelBuffers(session->channels);
                for (int c = 0; c < session->channels; c++) {
                    channelBuffers[c].resize(frameCount);
                    channelPtrs[c] = channelBuffers[c].data();
                }

                OutputBuffer buffer;
                buffer.channels = channelPtrs.data();
                buffer.numSamples = frameCount;
                buffer.numChannels = session->channels;

                // Process audio from MuseSampler
                state.wrapper.process(session->msSession, buffer, session->position);
                session->position += frameCount;

                // Interleave to output
                for (uint32_t i = 0; i < frameCount; i++) {
                    for (int c = 0; c < session->channels; c++) {
                        output[i * session->channels + c] = channelBuffers[c][i];
                    }
                }
            });

            // Start playback
            state.wrapper.setPlaying(session->msSession, true);
            session->playing = true;

            if (!state.audio.start()) {
                return errorResponse("Failed to start audio");
            }

            return successResponse();
        }

        case CommandType::Pause: {
            if (!cmd.sessionId) {
                return errorResponse("Missing 'session_id' parameter");
            }

            auto* session = state.getSession(*cmd.sessionId);
            if (!session) {
                return errorResponse("Invalid session");
            }

            state.wrapper.setPlaying(session->msSession, false);
            session->playing = false;

            return successResponse();
        }

        case CommandType::Stop: {
            if (!cmd.sessionId) {
                return errorResponse("Missing 'session_id' parameter");
            }

            auto* session = state.getSession(*cmd.sessionId);
            if (!session) {
                return errorResponse("Invalid session");
            }

            state.wrapper.setPlaying(session->msSession, false);
            state.wrapper.allNotesOff(session->msSession);
            session->playing = false;
            session->position = 0;

            state.audio.stop();

            return successResponse();
        }

        case CommandType::Seek: {
            if (!cmd.sessionId || !cmd.positionUs) {
                return errorResponse("Missing session_id or position_us");
            }

            auto* session = state.getSession(*cmd.sessionId);
            if (!session) {
                return errorResponse("Invalid session");
            }

            // Convert microseconds to samples
            int64_t samples = (*cmd.positionUs * static_cast<int64_t>(session->sampleRate)) / 1000000LL;
            state.wrapper.setPosition(session->msSession, samples);
            session->position = samples;

            return successResponse();
        }

        case CommandType::Quit: {
            // Signal to exit the main loop
            return successResponse(json{{"quit", true}});
        }

        case CommandType::Unknown:
        default: {
            return errorResponse("Unknown command: " + cmd.raw);
        }
    }
}

} // namespace abc

int main() {
    // Disable stdout buffering for immediate response delivery
    std::cout << std::unitbuf;

    abc::AppState state;

    std::cerr << "mscore helper started" << std::endl;

    // Main command loop
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) {
            continue;
        }

        auto cmd = abc::parseCommand(line);
        auto response = abc::handleCommand(cmd, state);

        // Output response as JSON
        std::cout << response.toJson().dump() << std::endl;

        // Check for quit command
        if (cmd.type == abc::CommandType::Quit) {
            break;
        }
    }

    // Cleanup
    state.audio.shutdown();

    std::cerr << "mscore helper exiting" << std::endl;
    return 0;
}
