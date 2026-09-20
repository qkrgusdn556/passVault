cmake_minimum_required(VERSION 3.20)

project(PassVault VERSION 0.5.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(unofficial-sodium CONFIG QUIET)

add_library(passvault_lib
    core/src/crypto.cpp
    core/src/password_audit.cpp
    core/src/password_generator.cpp
    core/src/vault.cpp
)

target_include_directories(passvault_lib PUBLIC core/include)

if(TARGET unofficial-sodium::sodium)
    target_link_libraries(passvault_lib PUBLIC unofficial-sodium::sodium)
else()
    find_library(SODIUM_LIBRARY NAMES sodium libsodium libsodium.so.23 REQUIRED)
    target_link_libraries(passvault_lib PUBLIC ${SODIUM_LIBRARY})
endif()

if(MSVC)
    target_compile_options(passvault_lib PRIVATE /W4 /permissive-)
else()
    target_compile_options(passvault_lib PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(passvault_core core/src/main.cpp)
target_link_libraries(passvault_core PRIVATE passvault_lib)

enable_testing()
add_executable(passvault_tests tests/test_core.cpp)
target_link_libraries(passvault_tests PRIVATE passvault_lib)
add_test(NAME passvault_tests COMMAND passvault_tests)

