#pragma once

#include <string>
#include <vector>

namespace passvault {

struct VaultItem {
    std::string site;
    std::string username;
    std::string password;
    std::string memo;
};

using VaultItems = std::vector<VaultItem>;

bool vaultExists(const std::string& path);
void saveVault(const std::string& path, const VaultItems& items, const std::string& masterPassword);
VaultItems loadVault(const std::string& path, const std::string& masterPassword);
void clearVault(VaultItems& items);

} // namespace passvault

