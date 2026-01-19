/**
 * MuseSampler Library Wrapper
 *
 * Provides a C++ interface to the MuseSampler library, which is loaded
 * dynamically at runtime. Based on MuseScore's libhandler.h.
 */

#pragma once

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace abc {

// Forward declarations for opaque handles
using SessionHandle = void*;
using TrackHandle = void*;

// Result codes from MuseSampler
enum class Result {
    Ok = 0,
    Error = -1,
    TimeoutError = -2
};

// Note articulation flags (from MuseScore apitypes.h)
enum NoteArticulation : uint64_t {
    Articulation_None = 0,
    Articulation_Staccato = 1ULL << 0,
    Articulation_Staccatissimo = 1ULL << 1,
    Articulation_Accent = 1ULL << 2,
    Articulation_Tenuto = 1ULL << 3,
    Articulation_Marcato = 1ULL << 4,
    Articulation_Harmonics = 1ULL << 5,
    Articulation_Mute = 1ULL << 6,
    Articulation_Trill = 1ULL << 7,
    Articulation_MordentSemi = 1ULL << 8,
    Articulation_MordentWhole = 1ULL << 9,
    Articulation_MordentInvertedSemi = 1ULL << 10,
    Articulation_MordentInvertedWhole = 1ULL << 11,
    Articulation_TurnSemiWhole = 1ULL << 12,
    Articulation_ArpeggioUp = 1ULL << 20,
    Articulation_ArpeggioDown = 1ULL << 21,
    Articulation_Tremolo1 = 1ULL << 22,
    Articulation_Tremolo2 = 1ULL << 23,
    Articulation_Tremolo3 = 1ULL << 24,
    Articulation_Open = 1ULL << 31,
    Articulation_Pizzicato = 1ULL << 37,
    Articulation_Glissando = 1ULL << 39,
    Articulation_SnapPizzicato = 1ULL << 42,
};

// Notehead types
enum class NoteHead : int16_t {
    Normal = 0,
    XNote = 1,
    Ghost = 6,
    Diamond = 8,
    Triangle = 9,
};

// Instrument information
struct InstrumentInfo {
    int id;
    std::string name;
    std::string category;
    std::string packName;
};

// Note event (matches ms_NoteEvent_5)
struct NoteEvent {
    int voice;              // 0-3
    int64_t location_us;    // microseconds from start
    int64_t duration_us;    // duration in microseconds
    int pitch;              // MIDI pitch (60 = C4)
    double tempo;           // BPM
    int offset_cents;       // pitch offset (-50 = quarter flat)
    uint64_t articulation;  // NoteArticulation flags
    uint64_t articulation_2; // Additional flags
    int16_t notehead;       // NoteHead value
};

// Dynamics event
struct DynamicsEvent {
    int64_t location_us;
    double value;  // 0.0 - 1.0
};

// Pedal event
struct PedalEvent {
    int64_t location_us;
    double value;  // 0.0 - 1.0
};

// Output buffer for audio rendering
struct OutputBuffer {
    float** channels;
    int numSamples;
    int numChannels;
};

// Version information
struct Version {
    int major;
    int minor;
    int revision;

    std::string toString() const {
        return std::to_string(major) + "." +
               std::to_string(minor) + "." +
               std::to_string(revision);
    }
};

/**
 * MuseSampler library wrapper.
 *
 * Loads the MuseSampler library dynamically and provides methods to:
 * - Enumerate available instruments
 * - Create playback sessions
 * - Add note events to tracks
 * - Control playback
 * - Render audio buffers
 */
class MuseSamplerWrapper {
public:
    MuseSamplerWrapper();
    ~MuseSamplerWrapper();

    // Library loading
    bool loadLibrary(const std::string& path);
    bool isLoaded() const;
    Version getVersion() const;

    // Instrument discovery
    std::vector<InstrumentInfo> getInstruments();

    // Session management
    SessionHandle createSession(double sampleRate, int blockSize, int channels);
    void destroySession(SessionHandle session);
    bool initSession(SessionHandle session, double sampleRate, int blockSize, int channels);

    // Track management
    TrackHandle addTrack(SessionHandle session, int instrumentId);
    bool finalizeTrack(SessionHandle session, TrackHandle track);
    bool clearTrack(SessionHandle session, TrackHandle track);

    // Event submission
    bool addNoteEvent(SessionHandle session, TrackHandle track, const NoteEvent& event);
    bool addDynamicsEvent(SessionHandle session, TrackHandle track, const DynamicsEvent& event);
    bool addPedalEvent(SessionHandle session, TrackHandle track, const PedalEvent& event);

    // Playback control
    void setPosition(SessionHandle session, int64_t samples);
    void setPlaying(SessionHandle session, bool playing);
    bool process(SessionHandle session, OutputBuffer& buffer, int64_t samples);
    bool allNotesOff(SessionHandle session);
    bool isReadyToPlay(SessionHandle session);

    // Offline rendering
    bool startOfflineMode(SessionHandle session, double sampleRate);
    bool stopOfflineMode(SessionHandle session);
    bool processOffline(SessionHandle session, OutputBuffer& buffer);

private:
    class Impl;
    Impl* m_impl;
};

} // namespace abc
