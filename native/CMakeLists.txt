cmake_minimum_required(VERSION 3.16)
project(mscore_helper VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/main.cpp
    src/musesampler_wrapper.cpp
    src/audio_output.cpp
    src/json_protocol.cpp
)

# Create the executable (must be named "mscore" for MuseSampler validation)
add_executable(mscore ${SOURCES})

# Include directories
target_include_directories(mscore PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/vendor
)

# Compiler warnings
if(MSVC)
    target_compile_options(mscore PRIVATE /W4)
else()
    target_compile_options(mscore PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Platform-specific configuration
if(APPLE)
    # macOS: Link AudioToolbox and CoreAudio frameworks for miniaudio
    target_link_libraries(mscore PRIVATE
        "-framework AudioToolbox"
        "-framework CoreAudio"
        "-framework CoreFoundation"
    )
    # Allow loading dynamic libraries at runtime
    target_link_options(mscore PRIVATE -undefined dynamic_lookup)

elseif(UNIX)
    # Linux: Link pthread, dl, and math libraries
    find_package(Threads REQUIRED)
    target_link_libraries(mscore PRIVATE
        Threads::Threads
        ${CMAKE_DL_LIBS}
        m
    )
    # ALSA for audio on Linux (miniaudio backend)
    find_package(ALSA QUIET)
    if(ALSA_FOUND)
        target_link_libraries(mscore PRIVATE ALSA::ALSA)
    endif()

elseif(WIN32)
    # Windows: Link winmm for audio
    target_link_libraries(mscore PRIVATE winmm ole32)
endif()

# Installation
install(TARGETS mscore
    RUNTIME DESTINATION bin
)

# Print configuration summary
message(STATUS "")
message(STATUS "mscore_helper configuration:")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "")
