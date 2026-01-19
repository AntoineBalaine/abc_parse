# MuseSampler Integration Setup Guide

This guide explains how to build and test the MuseSampler integration for ABC playback.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install MuseHub and Muse Sounds](#install-musehub-and-muse-sounds)
3. [Verify MuseSampler Library Location](#verify-musesampler-library-location)
4. [Build the Native Binary](#build-the-native-binary)
5. [Build the TypeScript Client](#build-the-typescript-client)
6. [Test the Integration](#test-the-integration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

You need the following installed on your system:

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime for TypeScript client |
| CMake | 3.16+ | Build system for native code |
| C++ Compiler | C++17 support | Compile the mscore binary |

### Platform-Specific Requirements

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- CMake: `brew install cmake`

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install build-essential cmake libasound2-dev
```

**Linux (Fedora):**
```bash
sudo dnf install gcc-c++ cmake alsa-lib-devel
```

**Windows:**
- Visual Studio 2019+ with C++ workload, or
- MinGW-w64 with CMake

---

## Install MuseHub and Muse Sounds

MuseSampler is distributed via MuseHub. You must install it to get the library.

1. Download MuseHub from https://www.musehub.com/

2. Install MuseHub and create an account (free)

3. Open MuseHub and install at least one Muse Sounds instrument pack:
   - Muse Keys (piano) is recommended for testing
   - Any instrument pack will work

4. The MuseSampler library is installed automatically with any Muse Sounds pack

---

## Verify MuseSampler Library Location

After installing Muse Sounds, verify the library exists:

**macOS:**
```bash
ls -la ~/Library/Application\ Support/MuseSampler/lib/libMuseSamplerCoreLib.dylib
```

**Linux:**
```bash
ls -la ~/.local/share/MuseHub/MuseSampler/lib/libMuseSamplerCoreLib.so
```

**Windows (PowerShell):**
```powershell
Test-Path "$env:APPDATA\MuseHub\MuseSampler\lib\MuseSamplerCoreLib.dll"
```

If the file exists, you are ready to proceed.

---

## Build the Native Binary

The native binary must be named `mscore` because MuseSampler validates the calling process name.

### Step 1: Navigate to the native directory

```bash
cd native
```

### Step 2: Configure with CMake

```bash
cmake -B build
```

You should see output like:
```
-- mscore_helper configuration:
--   C++ Standard: 17
--   Build Type:
--   Platform: Darwin (or Linux, Windows)
```

### Step 3: Build the binary

```bash
cmake --build build
```

### Step 4: Verify the binary exists

```bash
ls -la build/mscore
```

On Windows, look for `build/mscore.exe`.

---

## Build the TypeScript Client

### Step 1: Install dependencies (from repo root)

```bash
cd ..
npm install
```

### Step 2: Build the TypeScript

```bash
cd native
npx tsc
```

This creates `native/dist/` with the compiled JavaScript.

---

## Test the Integration

### Quick Test: Verify Library Loading

You can test the mscore binary directly by sending JSON commands:

```bash
# Start the binary
./build/mscore

# Then type this JSON command (on one line):
{"cmd": "load_library", "path": "/path/to/libMuseSamplerCoreLib.dylib"}

# Expected response:
{"ok":true,"version":"0.104.0"}

# List instruments:
{"cmd": "get_instruments"}

# Quit:
{"cmd": "quit"}
```

Replace `/path/to/libMuseSamplerCoreLib.dylib` with your actual library path from the verification step above.

### Full Integration Test

Create a test script `test-playback.ts`:

```typescript
import { MuseSamplerClient } from './native/dist';

async function main() {
  const client = new MuseSamplerClient();

  try {
    // Start the mscore process
    await client.start();
    console.log('Started mscore process');

    // Load the library (uses default path)
    const version = await client.loadLibrary();
    console.log('MuseSampler version:', version);

    // List available instruments
    const instruments = await client.getInstruments();
    console.log('Available instruments:', instruments.length);

    for (const inst of instruments.slice(0, 5)) {
      console.log(`  - ${inst.name} (${inst.category})`);
    }

    // Create a session
    const session = await client.createSession();
    console.log('Created session');

    // Add a track with the first instrument
    if (instruments.length > 0) {
      const track = await session.addTrack(instruments[0].id);
      console.log('Added track with instrument:', instruments[0].name);

      // Add a simple C major scale
      const notes = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 to C5
      let position = 0n;
      const duration = 500000n; // 500ms per note

      for (const pitch of notes) {
        await track.addNoteEvent({
          voice: 0,
          location_us: position,
          duration_us: duration,
          pitch,
          tempo: 120,
          offset_cents: 0,
          articulation: 0n,
          articulation_2: 0n,
          notehead: 0,
        });
        position += duration;
      }

      await track.finalize();
      console.log('Added 8 notes');

      // Play!
      console.log('Playing...');
      await session.play();

      // Wait for playback to finish
      await new Promise(resolve => setTimeout(resolve, 5000));

      await session.stop();
      console.log('Stopped');
    }

    await client.quit();
    console.log('Done');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
```

Run it:
```bash
npx ts-node test-playback.ts
```

You should hear a C major scale played with the first available Muse Sounds instrument.

---

## Troubleshooting

### "Failed to load library" error

1. Verify the library path is correct
2. On macOS, you may need to allow the library in System Preferences > Security & Privacy
3. Ensure you have installed at least one Muse Sounds instrument pack

### "mscore: command not found" or process spawn error

1. Verify the binary was built: `ls native/build/mscore`
2. Ensure the binary is executable: `chmod +x native/build/mscore`

### No audio output

1. Check your system audio settings
2. Verify the audio device is not in use by another application
3. Try running with `ALSA_DEBUG=1` on Linux for debugging

### "Library not loaded" on macOS

If you see an error about the library not being loaded due to security restrictions:

```bash
# Allow the library to be loaded
xattr -d com.apple.quarantine ~/Library/Application\ Support/MuseSampler/lib/libMuseSamplerCoreLib.dylib
```

### Build errors

**Missing ALSA on Linux:**
```bash
sudo apt-get install libasound2-dev  # Debian/Ubuntu
sudo dnf install alsa-lib-devel      # Fedora
```

**CMake not finding compiler:**
```bash
# macOS
xcode-select --install

# Linux
sudo apt-get install build-essential
```

### TypeScript compilation errors

Ensure you have the correct Node.js version:
```bash
node --version  # Should be 18+
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│                    (TypeScript/Node.js)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MuseSamplerClient                         │  │
│  │  - Spawns mscore process                               │  │
│  │  - Sends JSON commands via stdin                       │  │
│  │  - Receives JSON responses via stdout                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ stdin/stdout (JSON)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    mscore binary (C++)                       │
│  - Loads MuseSampler library via dlopen                      │
│  - Manages sessions, tracks, and events                      │
│  - Renders audio via miniaudio                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ dlopen
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              libMuseSamplerCoreLib (Muse Sounds)             │
│              (closed-source, installed via MuseHub)          │
└─────────────────────────────────────────────────────────────┘
```

The binary is named `mscore` because MuseSampler checks the calling process name and refuses to load if it is not `mscore`. This is a limitation of the closed-source library.
