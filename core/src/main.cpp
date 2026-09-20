#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <unordered_map>

#include "passvault/password_audit.hpp"
#include "passvault/password_generator.hpp"
#include "passvault/sodium_compat.hpp"
#include "passvault/vault.hpp"

namespace {

constexpr const char* vaultFile = "vault.json";

std::string readLine(const std::string& prompt)
{
    std::cout << prompt;
    std::string value;
    std::getline(std::cin, value);
    return value;
}

int readChoice(const std::string& prompt)
{
    while (true) {
        const std::string input = readLine(prompt);
        try {
            std::size_t consumed = 0;
            const int value = std::stoi(input, &consumed);
            if (consumed == input.size()) return value;
        } catch (...) {
        }
        std::cout << "[ERROR] Please enter a number.\n";
    }
}

std::size_t readLength()
{
    while (true) {
        const std::string input = readLine("Password length (12-128): ");
        try {
            std::size_t consumed = 0;
            const auto value = std::stoull(input, &consumed);
            if (consumed == input.size()) return static_cast<std::size_t>(value);
        } catch (...) {
        }
        std::cout << "[ERROR] Please enter a valid number.\n";
    }
}

void listAccounts(const passvault::VaultItems& items)
{
    std::cout << "\n=== ACCOUNTS ===\n";
    if (items.empty()) {
        std::cout << "No accounts stored.\n";
        return;
    }
    for (std::size_t i = 0; i < items.size(); ++i) {
        std::cout << i + 1 << ". " << items[i].site << " [" << items[i].username << "]\n";
    }
}

std::size_t selectAccount(const passvault::VaultItems& items, const std::string& prompt)
{
    listAccounts(items);
    if (items.empty()) return items.size();
    while (true) {
        const int choice = readChoice(prompt);
        if (choice > 0 && static_cast<std::size_t>(choice) <= items.size()) {
            return static_cast<std::size_t>(choice - 1);
        }
        std::cout << "[ERROR] Invalid account number.\n";
    }
}

void printAudit(const std::string& password)
{
    const auto audit = passvault::auditPassword(password);
    std::cout << "Password strength: " << passvault::strengthLabel(audit.strength) << '\n';
    for (const auto& warning : audit.warnings) std::cout << "  - " << warning << '\n';
}

bool isReused(const passvault::VaultItems& items, const std::string& password, std::size_t ignoredIndex)
{
    for (std::size_t i = 0; i < items.size(); ++i) {
        if (i != ignoredIndex && items[i].password == password) return true;
    }
    return false;
}

std::string choosePassword(const passvault::VaultItems& items, std::size_t ignoredIndex)
{
    while (true) {
        const int option = readChoice("1. Enter password\n2. Generate secure password\n> ");
        std::string password;
        if (option == 1) {
            password = readLine("Password: ");
            if (password.empty()) {
                std::cout << "[ERROR] Password cannot be empty.\n";
                continue;
            }
        } else if (option == 2) {
            try {
                password = passvault::generatePassword(readLength());
                std::cout << "Generated: " << password << '\n';
                if (readChoice("1. Use\n2. Generate again\n> ") != 1) {
                    sodium_memzero(password.data(), password.size());
                    continue;
                }
            } catch (const std::exception& error) {
                std::cout << "[ERROR] " << error.what() << '\n';
                continue;
            }
        } else {
            std::cout << "[ERROR] Invalid option.\n";
            continue;
        }

        printAudit(password);
        if (isReused(items, password, ignoredIndex)) {
            std::cout << "[WARNING] This password is already used by another account.\n";
        }
        return password;
    }
}

void auditAll(const passvault::VaultItems& items)
{
    std::unordered_map<std::string, std::size_t> counts;
    for (const auto& item : items) ++counts[item.password];

    std::cout << "\n=== SECURITY AUDIT ===\n";
    if (items.empty()) {
        std::cout << "No accounts stored.\n";
        return;
    }
    for (const auto& item : items) {
        const auto audit = passvault::auditPassword(item.password);
        std::cout << item.site << " [" << item.username << "]: "
                  << passvault::strengthLabel(audit.strength);
        if (counts[item.password] > 1) std::cout << " / REUSED";
        std::cout << '\n';
    }
}

long autoLockSeconds()
{
    constexpr long defaultSeconds = 300;
    const char* value = std::getenv("PASSVAULT_AUTO_LOCK_SECONDS");
    if (value == nullptr) return defaultSeconds;
    try {
        const long parsed = std::stol(value);
        return parsed > 0 ? parsed : defaultSeconds;
    } catch (...) {
        return defaultSeconds;
    }
}

void vaultMenu(passvault::VaultItems& items, const std::string& masterPassword)
{
    while (true) {
        std::cout << "\n=== PASSVAULT v0.5 ===\n"
                  << "1. List accounts\n2. Add account\n3. View account\n4. Edit account\n"
                  << "5. Delete account\n6. Generate password\n7. Search accounts\n"
                  << "8. Security audit\n9. Lock vault\n";

        const auto promptStarted = std::chrono::steady_clock::now();
        const int choice = readChoice("> ");
        const auto waited = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::steady_clock::now() - promptStarted
        ).count();
        if (waited >= autoLockSeconds()) {
            passvault::clearVault(items);
            std::cout << "[OK] Vault automatically locked after inactivity.\n";
            return;
        }

        if (choice == 1) {
            listAccounts(items);
        } else if (choice == 2) {
            passvault::VaultItem item;
            item.site = readLine("Site/domain: ");
            item.username = readLine("Username: ");
            item.password = choosePassword(items, items.size());
            item.memo = readLine("Memo: ");
            items.push_back(item);
            try {
                passvault::saveVault(vaultFile, items, masterPassword);
                std::cout << "[OK] Account encrypted and saved.\n";
            } catch (...) {
                sodium_memzero(items.back().password.data(), items.back().password.size());
                items.pop_back();
                sodium_memzero(item.password.data(), item.password.size());
                throw;
            }
            sodium_memzero(item.password.data(), item.password.size());
        } else if (choice == 3) {
            const auto index = selectAccount(items, "Account number: ");
            if (index == items.size()) continue;
            const auto& item = items[index];
            std::cout << "Site: " << item.site << "\nUsername: " << item.username
                      << "\nPassword: " << item.password << "\nMemo: " << item.memo << '\n';
        } else if (choice == 4) {
            const auto index = selectAccount(items, "Edit account number: ");
            if (index == items.size()) continue;
            auto backup = items[index];
            auto& item = items[index];
            std::string input = readLine("Site [" + item.site + "]: ");
            if (!input.empty()) item.site = input;
            input = readLine("Username [" + item.username + "]: ");
            if (!input.empty()) item.username = input;
            if (readChoice("1. Keep password\n2. Change password\n> ") == 2) {
                std::string replacement = choosePassword(items, index);
                sodium_memzero(item.password.data(), item.password.size());
                item.password = std::move(replacement);
            }
            input = readLine("Memo [" + item.memo + "]: ");
            if (!input.empty()) item.memo = input;
            try {
                passvault::saveVault(vaultFile, items, masterPassword);
                sodium_memzero(backup.password.data(), backup.password.size());
                std::cout << "[OK] Account updated.\n";
            } catch (...) {
                sodium_memzero(item.password.data(), item.password.size());
                item = std::move(backup);
                throw;
            }
        } else if (choice == 5) {
            const auto index = selectAccount(items, "Delete account number: ");
            if (index == items.size()) continue;
            auto removed = items[index];
            items.erase(items.begin() + static_cast<std::ptrdiff_t>(index));
            try {
                passvault::saveVault(vaultFile, items, masterPassword);
                sodium_memzero(removed.password.data(), removed.password.size());
                std::cout << "[OK] Account deleted.\n";
            } catch (...) {
                items.insert(items.begin() + static_cast<std::ptrdiff_t>(index), std::move(removed));
                throw;
            }
        } else if (choice == 6) {
            try {
                std::string password = passvault::generatePassword(readLength());
                std::cout << "Generated: " << password << '\n';
                printAudit(password);
                sodium_memzero(password.data(), password.size());
            } catch (const std::exception& error) {
                std::cout << "[ERROR] " << error.what() << '\n';
            }
        } else if (choice == 7) {
            std::string keyword = readLine("Search: ");
            std::transform(keyword.begin(), keyword.end(), keyword.begin(), [](unsigned char ch) {
                return static_cast<char>(std::tolower(ch));
            });
            for (std::size_t i = 0; i < items.size(); ++i) {
                std::string text = items[i].site + " " + items[i].username + " " + items[i].memo;
                std::transform(text.begin(), text.end(), text.begin(), [](unsigned char ch) {
                    return static_cast<char>(std::tolower(ch));
                });
                if (text.find(keyword) != std::string::npos) {
                    std::cout << i + 1 << ". " << items[i].site << " [" << items[i].username << "]\n";
                }
            }
        } else if (choice == 8) {
            auditAll(items);
        } else if (choice == 9) {
            passvault::clearVault(items);
            std::cout << "[OK] Vault locked.\n";
            return;
        } else {
            std::cout << "[ERROR] Invalid menu.\n";
        }
    }
}

} // namespace

int main()
{
    if (sodium_init() < 0) {
        std::cerr << "[ERROR] libsodium initialization failed.\n";
        return 1;
    }

    while (true) {
        std::cout << "\n=== PASSVAULT ===\n1. Create vault\n2. Open vault\n3. Exit\n";
        const int choice = readChoice("> ");
        if (choice == 1) {
            if (passvault::vaultExists(vaultFile)) {
                std::cout << "[ERROR] vault.json already exists.\n";
                continue;
            }
            std::string masterPassword = readLine("Create master password: ");
            try {
                passvault::VaultItems items;
                passvault::saveVault(vaultFile, items, masterPassword);
                std::cout << "[OK] Vault created.\n";
                vaultMenu(items, masterPassword);
            } catch (const std::exception& error) {
                std::cout << "[ERROR] " << error.what() << '\n';
            }
            sodium_memzero(masterPassword.data(), masterPassword.size());
        } else if (choice == 2) {
            if (!passvault::vaultExists(vaultFile)) {
                std::cout << "[ERROR] vault.json does not exist.\n";
                continue;
            }
            std::string masterPassword = readLine("Master password: ");
            try {
                auto items = passvault::loadVault(vaultFile, masterPassword);
                std::cout << "[OK] Vault unlocked.\n";
                vaultMenu(items, masterPassword);
                passvault::clearVault(items);
            } catch (const std::exception& error) {
                std::cout << "[ERROR] " << error.what() << '\n';
            }
            sodium_memzero(masterPassword.data(), masterPassword.size());
        } else if (choice == 3) {
            std::cout << "PassVault terminated.\n";
            break;
        } else {
            std::cout << "[ERROR] Invalid menu.\n";
        }
    }
    return 0;
}

