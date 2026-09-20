CXX ?= g++
CXXFLAGS ?= -std=c++20 -O2 -Wall -Wextra -Wpedantic
CPPFLAGS ?= -Icore/include
SODIUM_LIB ?= -l:libsodium.so.23

BUILD_DIR := build
LIB_SOURCES := core/src/crypto.cpp core/src/password_audit.cpp core/src/password_generator.cpp core/src/vault.cpp
APP_SOURCES := core/src/main.cpp $(LIB_SOURCES)
TEST_SOURCES := tests/test_core.cpp $(LIB_SOURCES)

.PHONY: all test clean

all: $(BUILD_DIR)/passvault_core

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/passvault_core: $(APP_SOURCES) | $(BUILD_DIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(APP_SOURCES) $(SODIUM_LIB) -o $@

$(BUILD_DIR)/passvault_tests: $(TEST_SOURCES) | $(BUILD_DIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(TEST_SOURCES) $(SODIUM_LIB) -o $@

test: $(BUILD_DIR)/passvault_tests
	./$(BUILD_DIR)/passvault_tests

clean:
	rm -f $(BUILD_DIR)/passvault_core $(BUILD_DIR)/passvault_tests

