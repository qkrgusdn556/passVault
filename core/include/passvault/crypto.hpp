#pragma once

#include <string>
#include <vector>

namespace passvault {

using Bytes = std::vector<unsigned char>;

struct EncryptedPayload {
    Bytes salt;
    Bytes nonce;
    Bytes ciphertext;
};

EncryptedPayload encrypt(const Bytes& plaintext, const std::string& masterPassword);
Bytes decrypt(const EncryptedPayload& payload, const std::string& masterPassword);

std::string toHex(const Bytes& bytes);
Bytes fromHex(const std::string& hex);

} // namespace passvault

