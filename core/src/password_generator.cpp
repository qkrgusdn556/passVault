#include "passvault/password_generator.hpp"

#include <stdexcept>

#include "passvault/sodium_compat.hpp"

namespace passvault {

std::string generatePassword(std::size_t length)
{
    if (length < 12 || length > 128) {
        throw std::invalid_argument("Password length must be between 12 and 128.");
    }

    static constexpr char lower[] = "abcdefghijkmnopqrstuvwxyz";
    static constexpr char upper[] = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    static constexpr char digits[] = "23456789";
    static constexpr char symbols[] = "!@#$%^&*()-_=+[]{}";
    static constexpr char all[] =
        "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()-_=+[]{}";

    auto pick = [](const char* chars, std::size_t count) {
        return chars[randombytes_uniform(static_cast<std::uint32_t>(count))];
    };

    std::string password;
    password.reserve(length);
    password.push_back(pick(lower, sizeof(lower) - 1));
    password.push_back(pick(upper, sizeof(upper) - 1));
    password.push_back(pick(digits, sizeof(digits) - 1));
    password.push_back(pick(symbols, sizeof(symbols) - 1));

    while (password.size() < length) {
        password.push_back(pick(all, sizeof(all) - 1));
    }

    for (std::size_t i = password.size() - 1; i > 0; --i) {
        const auto j = static_cast<std::size_t>(
            randombytes_uniform(static_cast<std::uint32_t>(i + 1))
        );
        const char temp = password[i];
        password[i] = password[j];
        password[j] = temp;
    }
    return password;
}

} // namespace passvault

