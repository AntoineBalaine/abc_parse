/**
 * Audio Output
 *
 * Cross-platform audio output using miniaudio library.
 * Provides a callback-based interface for playing audio buffers.
 */

#pragma once

#include <functional>
#include <cstdint>

namespace abc {

/**
 * Callback function type for audio data.
 * Called by the audio thread to request audio samples.
 *
 * @param output Pointer to output buffer (interleaved float samples)
 * @param frameCount Number of frames to fill
 */
using AudioCallback = std::function<void(float* output, uint32_t frameCount)>;

/**
 * Audio output device wrapper.
 *
 * Uses miniaudio for cross-platform audio playback.
 * The audio runs in a separate thread and calls the registered
 * callback to get audio data.
 */
class AudioOutput {
public:
    AudioOutput();
    ~AudioOutput();

    /**
     * Initialize the audio device.
     *
     * @param sampleRate Sample rate in Hz (e.g., 44100)
     * @param channels Number of channels (1 = mono, 2 = stereo)
     * @param blockSize Preferred buffer size in frames
     * @return true if initialization succeeded
     */
    bool initialize(int sampleRate, int channels, int blockSize);

    /**
     * Shut down the audio device and release resources.
     */
    void shutdown();

    /**
     * Check if the audio device is initialized.
     */
    bool isInitialized() const;

    /**
     * Set the callback function for audio data.
     * The callback will be called from the audio thread.
     */
    void setCallback(AudioCallback callback);

    /**
     * Start audio playback.
     * The callback will begin receiving requests for audio data.
     */
    bool start();

    /**
     * Stop audio playback.
     * The callback will no longer be called.
     */
    bool stop();

    /**
     * Check if audio is currently playing.
     */
    bool isPlaying() const;

    /**
     * Get the actual sample rate (may differ from requested).
     */
    int getSampleRate() const;

    /**
     * Get the number of channels.
     */
    int getChannels() const;

private:
    class Impl;
    Impl* m_impl;
};

} // namespace abc
