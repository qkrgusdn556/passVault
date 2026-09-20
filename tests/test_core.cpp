#include <filesystem>
#include <iostream>
#include <stdexcept>
#include <string>

#include "passvault/password_audit.hpp"
#include "passvault/password_generator.hpp"
#include "passvault/sodium_compat.hpp"
#include "passvault/vault.hpp"

namespace {

void require(bool condition, const std::string& message)
{
    if (!condition) throw std::runtime_error(message);
}

} // namespace

int main()
{
    if (sodium_init() < 0) return 1;
    const std::string path = "passvault_test_vault.json";
    std::filesystem::remove(path);

    try {
        passvault::VaultItems original{{"example.com", "alice", "A9!veryStrongPassword", "demo"}};
        passvault::saveVault(path, original, "correct horse battery staple");
        require(passvault::vaultExists(path), "vault was not created");

        const auto loaded = passvault::loadVault(path, "correct horse battery staple");
        require(loaded.size() == 1, "vault item count mismatch");
        require(loaded[0].site == original[0].site, "site mismatch");
        require(loaded[0].password == original[0].password, "password mismatch");

        bool rejected = false;
        try {
            (void)passvault::loadVault(path, "wrong password");
        } catch (...) {
            rejected = true;
        }
        require(rejected, "wrong master password was accepted");

        const std::string generated = passvault::generatePassword(24);
        require(generated.size() == 24, "generated password length mismatch");
        require(passvault::auditPassword(generated).strength == passvault::PasswordStrength::Strong,
                "generated password should be strong");
        require(passvault::auditPassword("123456").strength == passvault::PasswordStrength::Weak,
                "common password should be weak");

        std::filesystem::remove(path);
        std::cout << "All PassVault tests passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::filesystem::remove(path);
        std::cerr << "Test failed: " << error.what() << '\n';
        return 1;
    }
}

