#include "passvault/crypto.hpp"

#include <array>
#include <stdexcept>

#include "passvault/sodium_compat.hpp"

namespace passvault {
namespace {

using Key = std::array<unsigned char, crypto_aead_xchacha20poly1305_ietf_KEYBYTES>;

Key deriveKey(const std::string& password, const Bytes& salt)
{
    if (password.empty()) {
        throw std::invalid_argument("Master password cannot be empty.");
    }
    if (salt.size() != crypto_pwhash_SALTBYTES) {
        throw std::runtime_error("Invalid vault salt.");
    }

    Key key{};
    const int result = crypto_pwhash(
        key.data(),
        key.size(),
        password.data(),
        static_cast<unsigned long long>(password.size()),
        salt.data(),
        crypto_pwhash_OPSLIMIT_INTERACTIVE,
        crypto_pwhash_MEMLIMIT_INTERACTIVE,
        crypto_pwhash_ALG_ARGON2ID13
    );

    if (result != 0) {
        throw std::runtime_error("Unable to derive encryption key.");
    }
    return key;
}

int hexValue(char ch)
{
    if (ch >= '0' && ch <= '9') return ch - '0';
    if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
    if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
    return -1;
}

} // namespace

EncryptedPayload encrypt(const Bytes& plaintext, const std::string& masterPassword)
{
    EncryptedPayload payload;
    payload.salt.resize(crypto_pwhash_SALTBYTES);
    payload.nonce.resize(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    randombytes_buf(payload.salt.data(), payload.salt.size());
    randombytes_buf(payload.nonce.data(), payload.nonce.size());

    auto key = deriveKey(masterPassword, payload.salt);
    payload.ciphertext.resize(plaintext.size() + crypto_aead_xchacha20poly1305_ietf_ABYTES);

    unsigned long long ciphertextLength = 0;
    const int result = crypto_aead_xchacha20poly1305_ietf_encrypt(
        payload.ciphertext.data(),
        &ciphertextLength,
        plaintext.data(),
        static_cast<unsigned long long>(plaintext.size()),
        nullptr,
        0,
        nullptr,
        payload.nonce.data(),
        key.data()
    );
    sodium_memzero(key.data(), key.size());

    if (result != 0) {
        throw std::runtime_error("Vault encryption failed.");
    }
    payload.ciphertext.resize(static_cast<std::size_t>(ciphertextLength));
    return payload;
}

Bytes decrypt(const EncryptedPayload& payload, const std::string& masterPassword)
{
    if (payload.nonce.size() != crypto_aead_xchacha20poly1305_ietf_NPUBBYTES ||
        payload.ciphertext.size() < crypto_aead_xchacha20poly1305_ietf_ABYTES) {
        throw std::runtime_error("Invalid encrypted vault.");
    }

    auto key = deriveKey(masterPassword, payload.salt);
    Bytes plaintext(payload.ciphertext.size() - crypto_aead_xchacha20poly1305_ietf_ABYTES);
    unsigned long long plaintextLength = 0;

    const int result = crypto_aead_xchacha20poly1305_ietf_decrypt(
        plaintext.data(),
        &plaintextLength,
        nullptr,
        payload.ciphertext.data(),
        static_cast<unsigned long long>(payload.ciphertext.size()),
        nullptr,
        0,
        payload.nonce.data(),
        key.data()
    );
    sodium_memzero(key.data(), key.size());

    if (result != 0) {
        sodium_memzero(plaintext.data(), plaintext.size());
        throw std::runtime_error("Wrong master password or corrupted vault.");
    }
    plaintext.resize(static_cast<std::size_t>(plaintextLength));
    return plaintext;
}

std::string toHex(const Bytes& bytes)
{
    static constexpr char digits[] = "0123456789abcdef";
    std::string result;
    result.reserve(bytes.size() * 2);
    for (unsigned char byte : bytes) {
        result.push_back(digits[byte >> 4]);
        result.push_back(digits[byte & 0x0f]);
    }
    return result;
}

Bytes fromHex(const std::string& hex)
{
    if (hex.size() % 2 != 0) {
        throw std::runtime_error("Invalid hexadecimal vault data.");
    }
    Bytes result(hex.size() / 2);
    for (std::size_t i = 0; i < result.size(); ++i) {
        const int high = hexValue(hex[i * 2]);
        const int low = hexValue(hex[i * 2 + 1]);
        if (high < 0 || low < 0) {
            throw std::runtime_error("Invalid hexadecimal vault data.");
        }
        result[i] = static_cast<unsigned char>((high << 4) | low);
    }
    return result;
}

} // namespace passvault

