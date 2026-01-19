/**
 * MuseSampler Library Wrapper Implementation
 *
 * Handles dynamic loading of the MuseSampler library and resolves
 * function pointers for all API calls.
 */

#include "musesampler_wrapper.h"

#include <iostream>

#ifdef _WIN32
#include <windows.h>
#define LOAD_LIB(path) LoadLibraryA(path)
#define GET_FUNC(lib, name) GetProcAddress((HMODULE)lib, name)
#define CLOSE_LIB(lib) FreeLibrary((HMODULE)lib)
#else
#include <dlfcn.h>
#define LOAD_LIB(path) dlopen(path, RTLD_NOW)
#define GET_FUNC(lib, name) dlsym(lib, name)
#define CLOSE_LIB(lib) dlclose(lib)
#endif

namespace abc {

// MuseSampler C API types (from apitypes.h)
using ms_MuseSampler = void*;
using ms_Track = void*;
using ms_InstrumentList = void*;
using ms_InstrumentInfo = void*;

struct ms_OutputBuffer {
    float** _channels;
    int _num_data_pts;
    int _num_channels;
};

struct ms_NoteEvent_5 {
    int _voice;
    long long _location_us;
    long long _duration_us;
    int _pitch;
    double _tempo;
    int _offset_cents;
    uint64_t _articulation;
    uint64_t _articulation_2;
    int16_t _notehead;
};

struct ms_DynamicsEvent_2 {
    long long _location_us;
    double _value;
};

struct ms_PedalEvent_2 {
    long long _location_us;
    double _value;
};

// Function pointer types
using ms_get_version_major_t = int (*)();
using ms_get_version_minor_t = int (*)();
using ms_get_version_revision_t = int (*)();
using ms_init_t = int (*)();
using ms_disable_reverb_t = int (*)();

using ms_get_instrument_list_t = ms_InstrumentList (*)();
using ms_InstrumentList_get_next_t = ms_InstrumentInfo (*)(ms_InstrumentList);
using ms_Instrument_get_id_t = int (*)(ms_InstrumentInfo);
using ms_Instrument_get_name_t = const char* (*)(ms_InstrumentInfo);
using ms_Instrument_get_category_t = const char* (*)(ms_InstrumentInfo);
using ms_Instrument_get_pack_name_t = const char* (*)(ms_InstrumentInfo);

using ms_MuseSampler_create_t = ms_MuseSampler (*)();
using ms_MuseSampler_destroy_t = void (*)(ms_MuseSampler);
using ms_MuseSampler_init_t = int (*)(ms_MuseSampler, double, int, int);
using ms_MuseSampler_init_2_t = int (*)(ms_MuseSampler, double, int, int);

using ms_MuseSampler_add_track_t = ms_Track (*)(ms_MuseSampler, int);
using ms_MuseSampler_finalize_track_t = int (*)(ms_MuseSampler, ms_Track);
using ms_MuseSampler_clear_track_t = int (*)(ms_MuseSampler, ms_Track);

using ms_MuseSampler_add_track_note_event_6_t = int (*)(ms_MuseSampler, ms_Track, ms_NoteEvent_5, long long&);
using ms_MuseSampler_add_track_dynamics_event_2_t = int (*)(ms_MuseSampler, ms_Track, ms_DynamicsEvent_2);
using ms_MuseSampler_add_track_pedal_event_2_t = int (*)(ms_MuseSampler, ms_Track, ms_PedalEvent_2);

using ms_MuseSampler_set_position_t = void (*)(ms_MuseSampler, long long);
using ms_MuseSampler_set_playing_t = void (*)(ms_MuseSampler, int);
using ms_MuseSampler_process_t = int (*)(ms_MuseSampler, ms_OutputBuffer, long long);
using ms_MuseSampler_all_notes_off_t = int (*)(ms_MuseSampler);
using ms_MuseSampler_ready_to_play_t = bool (*)(ms_MuseSampler);

using ms_MuseSampler_start_offline_mode_t = int (*)(ms_MuseSampler, double);
using ms_MuseSampler_stop_offline_mode_t = int (*)(ms_MuseSampler);
using ms_MuseSampler_process_offline_t = int (*)(ms_MuseSampler, ms_OutputBuffer);

// Implementation class
class MuseSamplerWrapper::Impl {
public:
    void* lib = nullptr;
    Version version{0, 0, 0};
    bool initialized = false;

    // Function pointers
    ms_get_version_major_t getVersionMajor = nullptr;
    ms_get_version_minor_t getVersionMinor = nullptr;
    ms_get_version_revision_t getVersionRevision = nullptr;
    ms_init_t initLib = nullptr;
    ms_disable_reverb_t disableReverb = nullptr;

    ms_get_instrument_list_t getInstrumentList = nullptr;
    ms_InstrumentList_get_next_t getNextInstrument = nullptr;
    ms_Instrument_get_id_t getInstrumentId = nullptr;
    ms_Instrument_get_name_t getInstrumentName = nullptr;
    ms_Instrument_get_category_t getInstrumentCategory = nullptr;
    ms_Instrument_get_pack_name_t getInstrumentPackName = nullptr;

    ms_MuseSampler_create_t create = nullptr;
    ms_MuseSampler_destroy_t destroy = nullptr;
    ms_MuseSampler_init_t initSampler = nullptr;
    ms_MuseSampler_init_2_t initSampler2 = nullptr;

    ms_MuseSampler_add_track_t addTrack = nullptr;
    ms_MuseSampler_finalize_track_t finalizeTrack = nullptr;
    ms_MuseSampler_clear_track_t clearTrack = nullptr;

    ms_MuseSampler_add_track_note_event_6_t addNoteEvent6 = nullptr;
    ms_MuseSampler_add_track_dynamics_event_2_t addDynamicsEvent = nullptr;
    ms_MuseSampler_add_track_pedal_event_2_t addPedalEvent = nullptr;

    ms_MuseSampler_set_position_t setPosition = nullptr;
    ms_MuseSampler_set_playing_t setPlaying = nullptr;
    ms_MuseSampler_process_t process = nullptr;
    ms_MuseSampler_all_notes_off_t allNotesOff = nullptr;
    ms_MuseSampler_ready_to_play_t readyToPlay = nullptr;

    ms_MuseSampler_start_offline_mode_t startOfflineMode = nullptr;
    ms_MuseSampler_stop_offline_mode_t stopOfflineMode = nullptr;
    ms_MuseSampler_process_offline_t processOffline = nullptr;

    template<typename T>
    T loadFunc(const char* name) {
        return reinterpret_cast<T>(GET_FUNC(lib, name));
    }

    bool loadApi() {
        // Version functions
        getVersionMajor = loadFunc<ms_get_version_major_t>("ms_get_version_major");
        getVersionMinor = loadFunc<ms_get_version_minor_t>("ms_get_version_minor");
        getVersionRevision = loadFunc<ms_get_version_revision_t>("ms_get_version_revision");

        if (!getVersionMajor || !getVersionMinor || !getVersionRevision) {
            std::cerr << "Failed to load version functions" << std::endl;
            return false;
        }

        version.major = getVersionMajor();
        version.minor = getVersionMinor();
        version.revision = getVersionRevision();

        std::cerr << "MuseSampler version: " << version.toString() << std::endl;

        // Core functions
        initLib = loadFunc<ms_init_t>("ms_init");
        disableReverb = loadFunc<ms_disable_reverb_t>("ms_disable_reverb");

        // Instrument functions
        getInstrumentList = loadFunc<ms_get_instrument_list_t>("ms_get_instrument_list");
        getNextInstrument = loadFunc<ms_InstrumentList_get_next_t>("ms_InstrumentList_get_next");
        getInstrumentId = loadFunc<ms_Instrument_get_id_t>("ms_Instrument_get_id");
        getInstrumentName = loadFunc<ms_Instrument_get_name_t>("ms_Instrument_get_name");
        getInstrumentCategory = loadFunc<ms_Instrument_get_category_t>("ms_Instrument_get_category");
        getInstrumentPackName = loadFunc<ms_Instrument_get_pack_name_t>("ms_Instrument_get_pack_name");

        // Session functions
        create = loadFunc<ms_MuseSampler_create_t>("ms_MuseSampler_create");
        destroy = loadFunc<ms_MuseSampler_destroy_t>("ms_MuseSampler_destroy");
        initSampler = loadFunc<ms_MuseSampler_init_t>("ms_MuseSampler_init");
        initSampler2 = loadFunc<ms_MuseSampler_init_2_t>("ms_MuseSampler_init_2");

        // Track functions
        addTrack = loadFunc<ms_MuseSampler_add_track_t>("ms_MuseSampler_add_track");
        finalizeTrack = loadFunc<ms_MuseSampler_finalize_track_t>("ms_MuseSampler_finalize_track");
        clearTrack = loadFunc<ms_MuseSampler_clear_track_t>("ms_MuseSampler_clear_track");

        // Event functions
        addNoteEvent6 = loadFunc<ms_MuseSampler_add_track_note_event_6_t>("ms_MuseSampler_add_track_note_event_6");
        addDynamicsEvent = loadFunc<ms_MuseSampler_add_track_dynamics_event_2_t>("ms_MuseSampler_add_track_dynamics_event_2");
        addPedalEvent = loadFunc<ms_MuseSampler_add_track_pedal_event_2_t>("ms_MuseSampler_add_track_pedal_event_2");

        // Playback functions
        setPosition = loadFunc<ms_MuseSampler_set_position_t>("ms_MuseSampler_set_position");
        setPlaying = loadFunc<ms_MuseSampler_set_playing_t>("ms_MuseSampler_set_playing");
        process = loadFunc<ms_MuseSampler_process_t>("ms_MuseSampler_process");
        allNotesOff = loadFunc<ms_MuseSampler_all_notes_off_t>("ms_MuseSampler_all_notes_off");
        readyToPlay = loadFunc<ms_MuseSampler_ready_to_play_t>("ms_MuseSampler_ready_to_play");

        // Offline rendering
        startOfflineMode = loadFunc<ms_MuseSampler_start_offline_mode_t>("ms_MuseSampler_start_offline_mode");
        stopOfflineMode = loadFunc<ms_MuseSampler_stop_offline_mode_t>("ms_MuseSampler_stop_offline_mode");
        processOffline = loadFunc<ms_MuseSampler_process_offline_t>("ms_MuseSampler_process_offline");

        // Validate required functions
        if (!initLib || !create || !destroy || !addTrack || !finalizeTrack) {
            std::cerr << "Missing required API functions" << std::endl;
            return false;
        }

        return true;
    }

    bool init() {
        if (!initLib) return false;

        if (initLib() != 0) {
            std::cerr << "ms_init failed" << std::endl;
            return false;
        }

        if (disableReverb) {
            disableReverb();
        }

        initialized = true;
        return true;
    }
};

MuseSamplerWrapper::MuseSamplerWrapper() : m_impl(new Impl()) {}

MuseSamplerWrapper::~MuseSamplerWrapper() {
    if (m_impl->lib) {
        CLOSE_LIB(m_impl->lib);
    }
    delete m_impl;
}

bool MuseSamplerWrapper::loadLibrary(const std::string& path) {
    m_impl->lib = LOAD_LIB(path.c_str());
    if (!m_impl->lib) {
#ifndef _WIN32
        std::cerr << "Failed to load library: " << dlerror() << std::endl;
#else
        std::cerr << "Failed to load library: error " << GetLastError() << std::endl;
#endif
        return false;
    }

    if (!m_impl->loadApi()) {
        CLOSE_LIB(m_impl->lib);
        m_impl->lib = nullptr;
        return false;
    }

    if (!m_impl->init()) {
        CLOSE_LIB(m_impl->lib);
        m_impl->lib = nullptr;
        return false;
    }

    return true;
}

bool MuseSamplerWrapper::isLoaded() const {
    return m_impl->lib != nullptr && m_impl->initialized;
}

Version MuseSamplerWrapper::getVersion() const {
    return m_impl->version;
}

std::vector<InstrumentInfo> MuseSamplerWrapper::getInstruments() {
    std::vector<InstrumentInfo> instruments;

    if (!m_impl->getInstrumentList || !m_impl->getNextInstrument) {
        return instruments;
    }

    ms_InstrumentList list = m_impl->getInstrumentList();
    if (!list) {
        std::cerr << "getInstrumentList returned null" << std::endl;
        return instruments;
    }

    ms_InstrumentInfo info;
    while ((info = m_impl->getNextInstrument(list)) != nullptr) {
        InstrumentInfo inst;
        inst.id = m_impl->getInstrumentId ? m_impl->getInstrumentId(info) : -1;
        inst.name = m_impl->getInstrumentName ? (m_impl->getInstrumentName(info) ?: "") : "";
        inst.category = m_impl->getInstrumentCategory ? (m_impl->getInstrumentCategory(info) ?: "") : "";
        inst.packName = m_impl->getInstrumentPackName ? (m_impl->getInstrumentPackName(info) ?: "") : "";
        instruments.push_back(inst);
    }

    return instruments;
}

SessionHandle MuseSamplerWrapper::createSession(double sampleRate, int blockSize, int channels) {
    if (!m_impl->create) return nullptr;
    return m_impl->create();
}

void MuseSamplerWrapper::destroySession(SessionHandle session) {
    if (m_impl->destroy && session) {
        m_impl->destroy(session);
    }
}

bool MuseSamplerWrapper::initSession(SessionHandle session, double sampleRate, int blockSize, int channels) {
    if (!session) return false;

    // Prefer init_2 if available (newer API)
    if (m_impl->initSampler2) {
        return m_impl->initSampler2(session, sampleRate, blockSize, channels) == 0;
    }
    if (m_impl->initSampler) {
        return m_impl->initSampler(session, sampleRate, blockSize, channels) == 0;
    }
    return false;
}

TrackHandle MuseSamplerWrapper::addTrack(SessionHandle session, int instrumentId) {
    if (!m_impl->addTrack || !session) return nullptr;
    return m_impl->addTrack(session, instrumentId);
}

bool MuseSamplerWrapper::finalizeTrack(SessionHandle session, TrackHandle track) {
    if (!m_impl->finalizeTrack || !session || !track) return false;
    return m_impl->finalizeTrack(session, track) == 0;
}

bool MuseSamplerWrapper::clearTrack(SessionHandle session, TrackHandle track) {
    if (!m_impl->clearTrack || !session || !track) return false;
    return m_impl->clearTrack(session, track) == 0;
}

bool MuseSamplerWrapper::addNoteEvent(SessionHandle session, TrackHandle track, const NoteEvent& event) {
    if (!m_impl->addNoteEvent6 || !session || !track) return false;

    ms_NoteEvent_5 msEvent;
    msEvent._voice = event.voice;
    msEvent._location_us = event.location_us;
    msEvent._duration_us = event.duration_us;
    msEvent._pitch = event.pitch;
    msEvent._tempo = event.tempo;
    msEvent._offset_cents = event.offset_cents;
    msEvent._articulation = event.articulation;
    msEvent._articulation_2 = event.articulation_2;
    msEvent._notehead = event.notehead;

    long long eventId;
    return m_impl->addNoteEvent6(session, track, msEvent, eventId) == 0;
}

bool MuseSamplerWrapper::addDynamicsEvent(SessionHandle session, TrackHandle track, const DynamicsEvent& event) {
    if (!m_impl->addDynamicsEvent || !session || !track) return false;

    ms_DynamicsEvent_2 msEvent;
    msEvent._location_us = event.location_us;
    msEvent._value = event.value;

    return m_impl->addDynamicsEvent(session, track, msEvent) == 0;
}

bool MuseSamplerWrapper::addPedalEvent(SessionHandle session, TrackHandle track, const PedalEvent& event) {
    if (!m_impl->addPedalEvent || !session || !track) return false;

    ms_PedalEvent_2 msEvent;
    msEvent._location_us = event.location_us;
    msEvent._value = event.value;

    return m_impl->addPedalEvent(session, track, msEvent) == 0;
}

void MuseSamplerWrapper::setPosition(SessionHandle session, int64_t samples) {
    if (m_impl->setPosition && session) {
        m_impl->setPosition(session, samples);
    }
}

void MuseSamplerWrapper::setPlaying(SessionHandle session, bool playing) {
    if (m_impl->setPlaying && session) {
        m_impl->setPlaying(session, playing ? 1 : 0);
    }
}

bool MuseSamplerWrapper::process(SessionHandle session, OutputBuffer& buffer, int64_t samples) {
    if (!m_impl->process || !session) return false;

    ms_OutputBuffer msBuffer;
    msBuffer._channels = buffer.channels;
    msBuffer._num_data_pts = buffer.numSamples;
    msBuffer._num_channels = buffer.numChannels;

    return m_impl->process(session, msBuffer, samples) == 0;
}

bool MuseSamplerWrapper::allNotesOff(SessionHandle session) {
    if (!m_impl->allNotesOff || !session) return false;
    return m_impl->allNotesOff(session) == 0;
}

bool MuseSamplerWrapper::isReadyToPlay(SessionHandle session) {
    if (!m_impl->readyToPlay || !session) return true;  // Assume ready if function not available
    return m_impl->readyToPlay(session);
}

bool MuseSamplerWrapper::startOfflineMode(SessionHandle session, double sampleRate) {
    if (!m_impl->startOfflineMode || !session) return false;
    return m_impl->startOfflineMode(session, sampleRate) == 0;
}

bool MuseSamplerWrapper::stopOfflineMode(SessionHandle session) {
    if (!m_impl->stopOfflineMode || !session) return false;
    return m_impl->stopOfflineMode(session) == 0;
}

bool MuseSamplerWrapper::processOffline(SessionHandle session, OutputBuffer& buffer) {
    if (!m_impl->processOffline || !session) return false;

    ms_OutputBuffer msBuffer;
    msBuffer._channels = buffer.channels;
    msBuffer._num_data_pts = buffer.numSamples;
    msBuffer._num_channels = buffer.numChannels;

    return m_impl->processOffline(session, msBuffer) == 0;
}

} // namespace abc
