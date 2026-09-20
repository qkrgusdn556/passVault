#include "passvault/vault.hpp"

#include <cstdio>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <limits>
#include <sstream>
#include <stdexcept>

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

#include "passvault/crypto.hpp"
#include "passvault/sodium_compat.hpp"

namespace passvault {
namespace {

constexpr unsigned char magic[] = {'P', 'V', 'L', 'T', '1'};

void appendU32(Bytes& output, std::uint32_t value)
{
    for (int shift = 0; shift < 32; shift += 8) {
        output.push_back(static_cast<unsigned char>((value >> shift) & 0xff));
    }
}

std::uint32_t readU32(const Bytes& input, std::size_t& offset)
{
    if (offset + 4 > input.size()) throw std::runtime_error("Corrupted vault contents.");
    std::uint32_t value = 0;
    for (int shift = 0; shift < 32; shift += 8) {
        value |= static_cast<std::uint32_t>(input[offset++]) << shift;
    }
    return value;
}

void appendString(Bytes& output, const std::string& value)
{
    if (value.size() > std::numeric_limits<std::uint32_t>::max()) {
        throw std::runtime_error("Vault field is too large.");
    }
    appendU32(output, static_cast<std::uint32_t>(value.size()));
    output.insert(output.end(), value.begin(), value.end());
}

std::string readString(const Bytes& input, std::size_t& offset)
{
    const std::size_t length = readU32(input, offset);
    if (offset + length > input.size()) throw std::runtime_error("Corrupted vault contents.");
    std::string value(input.begin() + static_cast<std::ptrdiff_t>(offset),
                      input.begin() + static_cast<std::ptrdiff_t>(offset + length));
    offset += length;
    return value;
}

Bytes serialize(const VaultItems& items)
{
    Bytes data(std::begin(magic), std::end(magic));
    if (items.size() > std::numeric_limits<std::uint32_t>::max()) {
        throw std::runtime_error("Too many vault items.");
    }
    appendU32(data, static_cast<std::uint32_t>(items.size()));
    for (const auto& item : items) {
        appendString(data, item.site);
        appendString(data, item.username);
        appendString(data, item.password);
        appendString(data, item.memo);
    }
    return data;
}

VaultItems deserialize(const Bytes& data)
{
    if (data.size() < sizeof(magic) + 4 ||
        !std::equal(std::begin(magic), std::end(magic), data.begin())) {
        throw std::runtime_error("Unsupported or corrupted vault contents.");
    }

    std::size_t offset = sizeof(magic);
    const std::uint32_t count = readU32(data, offset);
    VaultItems items;
    items.reserve(count);
    for (std::uint32_t i = 0; i < count; ++i) {
        VaultItem item;
        item.site = readString(data, offset);
        item.username = readString(data, offset);
        item.password = readString(data, offset);
        item.memo = readString(data, offset);
        items.push_back(std::move(item));
    }
    if (offset != data.size()) throw std::runtime_error("Corrupted vault contents.");
    return items;
}

std::string jsonValue(const std::string& json, const std::string& key)
{
    const std::string marker = "\"" + key + "\"";
    const auto keyPosition = json.find(marker);
    if (keyPosition == std::string::npos) throw std::runtime_error("Invalid vault file.");
    const auto colon = json.find(':', keyPosition + marker.size());
    const auto begin = json.find('"', colon + 1);
    const auto end = json.find('"', begin + 1);
    if (colon == std::string::npos || begin == std::string::npos || end == std::string::npos) {
        throw std::runtime_error("Invalid vault file.");
    }
    return json.substr(begin + 1, end - begin - 1);
}

void replaceFile(const std::string& temporary, const std::string& destination)
{
#ifdef _WIN32
    if (!MoveFileExA(temporary.c_str(), destination.c_str(),
                     MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        std::filesystem::remove(temporary);
        throw std::runtime_error("Unable to replace vault file.");
    }
#else
    if (std::rename(temporary.c_str(), destination.c_str()) != 0) {
        std::filesystem::remove(temporary);
        throw std::runtime_error("Unable to replace vault file.");
    }
#endif
}

} // namespace

bool vaultExists(const std::string& path)
{
    return std::filesystem::is_regular_file(path);
}

void saveVault(const std::string& path, const VaultItems& items, const std::string& masterPassword)
{
    Bytes plaintext = serialize(items);
    EncryptedPayload payload;
    try {
        payload = encrypt(plaintext, masterPassword);
    } catch (...) {
        sodium_memzero(plaintext.data(), plaintext.size());
        throw;
    }
    sodium_memzero(plaintext.data(), plaintext.size());

    const std::string temporary = path + ".tmp";
    std::ofstream file(temporary, std::ios::binary | std::ios::trunc);
    if (!file) throw std::runtime_error("Unable to write temporary vault file.");

    file << "{\n"
         << "  \"format\": \"passvault\",\n"
         << "  \"version\": 1,\n"
         << "  \"kdf\": \"argon2id\",\n"
         << "  \"cipher\": \"xchacha20poly1305\",\n"
         << "  \"salt\": \"" << toHex(payload.salt) << "\",\n"
         << "  \"nonce\": \"" << toHex(payload.nonce) << "\",\n"
         << "  \"ciphertext\": \"" << toHex(payload.ciphertext) << "\"\n"
         << "}\n";
    file.close();
    if (!file) {
        std::filesystem::remove(temporary);
        throw std::runtime_error("Unable to finish writing vault file.");
    }
    replaceFile(temporary, path);
}

VaultItems loadVault(const std::string& path, const std::string& masterPassword)
{
    std::ifstream file(path, std::ios::binary);
    if (!file) throw std::runtime_error("Unable to open vault file.");
    std::ostringstream buffer;
    buffer << file.rdbuf();
    const std::string json = buffer.str();

    EncryptedPayload payload{
        fromHex(jsonValue(json, "salt")),
        fromHex(jsonValue(json, "nonce")),
        fromHex(jsonValue(json, "ciphertext"))
    };
    Bytes plaintext = decrypt(payload, masterPassword);
    try {
        VaultItems items = deserialize(plaintext);
        sodium_memzero(plaintext.data(), plaintext.size());
        return items;
    } catch (...) {
        sodium_memzero(plaintext.data(), plaintext.size());
        throw;
    }
}

void clearVault(VaultItems& items)
{
    for (auto& item : items) {
        sodium_memzero(item.password.data(), item.password.size());
    }
    items.clear();
}

} // namespace passvault
