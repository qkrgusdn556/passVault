#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace passvault {

enum class PasswordStrength {
    Weak,
    Fair,
    Strong
};

struct PasswordAudit {
    PasswordStrength strength;
    std::vector<std::string> warnings;
};

PasswordAudit auditPassword(const std::string& password);
std::string strengthLabel(PasswordStrength strength);

} // namespace passvault

