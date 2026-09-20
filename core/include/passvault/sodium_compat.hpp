#pragma once

#include <cstddef>
#include <cstdint>

#if __has_include(<sodium.h>)
#include <sodium.h>
#else
extern "C" {
int sodium_init(void);
void sodium_memzero(void* pnt, std::size_t len);
void randombytes_buf(void* const buf, const std::size_t size);
std::uint32_t randombytes_uniform(const std::uint32_t upper_bound);

int crypto_pwhash(
    unsigned char* out,
    unsigned long long outlen,
    const char* passwd,
    unsigned long long passwdlen,
    const unsigned char* salt,
    unsigned long long opslimit,
    std::size_t memlimit,
    int alg
);

int crypto_aead_xchacha20poly1305_ietf_encrypt(
    unsigned char* c,
    unsigned long long* clen_p,
    const unsigned char* m,
    unsigned long long mlen,
    const unsigned char* ad,
    unsigned long long adlen,
    const unsigned char* nsec,
    const unsigned char* npub,
    const unsigned char* k
);

int crypto_aead_xchacha20poly1305_ietf_decrypt(
    unsigned char* m,
    unsigned long long* mlen_p,
    unsigned char* nsec,
    const unsigned char* c,
    unsigned long long clen,
    const unsigned char* ad,
    unsigned long long adlen,
    const unsigned char* npub,
    const unsigned char* k
);
}

inline constexpr std::size_t crypto_pwhash_SALTBYTES = 16;
inline constexpr int crypto_pwhash_ALG_ARGON2ID13 = 2;
inline constexpr unsigned long long crypto_pwhash_OPSLIMIT_INTERACTIVE = 2;
inline constexpr std::size_t crypto_pwhash_MEMLIMIT_INTERACTIVE = 67108864;
inline constexpr std::size_t crypto_aead_xchacha20poly1305_ietf_KEYBYTES = 32;
inline constexpr std::size_t crypto_aead_xchacha20poly1305_ietf_NPUBBYTES = 24;
inline constexpr std::size_t crypto_aead_xchacha20poly1305_ietf_ABYTES = 16;
#endif

