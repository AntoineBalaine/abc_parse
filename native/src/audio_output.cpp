/**
 * Audio Output Implementation
 *
 * Uses miniaudio for cross-platform audio playback.
 */

#define MINIAUDIO_IMPLEMENTATION
#include "../vendor/miniaudio.h"

#include "audio_output.h"

#include <iostream>
#include <mutex>

namespace abc {

class AudioOutput::Impl {
public:
    ma_device device;
    ma_device_config deviceConfig;
    bool initialized = false;
    bool playing = false;

    AudioCallback callback;
    std::mutex callbackMutex;

    int sampleRate = 44100;
    int channels = 2;

    static void dataCallback(ma_device* pDevice, void* pOutput, const void* pInput, ma_uint32 frameCount) {
        (void)pInput;  // Unused

        Impl* impl = static_cast<Impl*>(pDevice->pUserData);
        float* output = static_cast<float*>(pOutput);

        std::lock_guard<std::mutex> lock(impl->callbackMutex);
        if (impl->callback) {
            impl->callback(output, frameCount);
        } else {
            // No callback, output silence
            size_t sampleCount = frameCount * impl->channels;
            for (size_t i = 0; i < sampleCount; i++) {
                output[i] = 0.0f;
            }
        }
    }
};

AudioOutput::AudioOutput() : m_impl(new Impl()) {}

AudioOutput::~AudioOutput() {
    shutdown();
    delete m_impl;
}

bool AudioOutput::initialize(int sampleRate, int channels, int blockSize) {
    if (m_impl->initialized) {
        shutdown();
    }

    m_impl->sampleRate = sampleRate;
    m_impl->channels = channels;

    m_impl->deviceConfig = ma_device_config_init(ma_device_type_playback);
    m_impl->deviceConfig.playback.format = ma_format_f32;
    m_impl->deviceConfig.playback.channels = channels;
    m_impl->deviceConfig.sampleRate = sampleRate;
    m_impl->deviceConfig.periodSizeInFrames = blockSize;
    m_impl->deviceConfig.dataCallback = Impl::dataCallback;
    m_impl->deviceConfig.pUserData = m_impl;

    ma_result result = ma_device_init(nullptr, &m_impl->deviceConfig, &m_impl->device);
    if (result != MA_SUCCESS) {
        std::cerr << "Failed to initialize audio device: " << result << std::endl;
        return false;
    }

    m_impl->initialized = true;
    m_impl->sampleRate = m_impl->device.sampleRate;

    std::cerr << "Audio initialized: " << m_impl->sampleRate << " Hz, "
              << m_impl->channels << " channels" << std::endl;

    return true;
}

void AudioOutput::shutdown() {
    if (m_impl->initialized) {
        if (m_impl->playing) {
            stop();
        }
        ma_device_uninit(&m_impl->device);
        m_impl->initialized = false;
    }
}

bool AudioOutput::isInitialized() const {
    return m_impl->initialized;
}

void AudioOutput::setCallback(AudioCallback callback) {
    std::lock_guard<std::mutex> lock(m_impl->callbackMutex);
    m_impl->callback = std::move(callback);
}

bool AudioOutput::start() {
    if (!m_impl->initialized) {
        std::cerr << "Audio not initialized" << std::endl;
        return false;
    }

    if (m_impl->playing) {
        return true;  // Already playing
    }

    ma_result result = ma_device_start(&m_impl->device);
    if (result != MA_SUCCESS) {
        std::cerr << "Failed to start audio device: " << result << std::endl;
        return false;
    }

    m_impl->playing = true;
    return true;
}

bool AudioOutput::stop() {
    if (!m_impl->initialized || !m_impl->playing) {
        return true;
    }

    ma_result result = ma_device_stop(&m_impl->device);
    if (result != MA_SUCCESS) {
        std::cerr << "Failed to stop audio device: " << result << std::endl;
        return false;
    }

    m_impl->playing = false;
    return true;
}

bool AudioOutput::isPlaying() const {
    return m_impl->playing;
}

int AudioOutput::getSampleRate() const {
    return m_impl->sampleRate;
}

int AudioOutput::getChannels() const {
    return m_impl->channels;
}

} // namespace abc
