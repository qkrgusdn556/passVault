#include "passvault/password_audit.hpp"

#include <algorithm>
#include <cctype>
#include <unordered_set>

namespace passvault {

PasswordAudit auditPassword(const std::string& password)
{
    bool lower = false;
    bool upper = false;
    bool digit = false;
    bool symbol = false;

    for (unsigned char ch : password) {
        lower = lower || std::islower(ch);
        upper = upper || std::isupper(ch);
        digit = digit || std::isdigit(ch);
        symbol = symbol || (!std::isalnum(ch) && !std::isspace(ch));
    }

    std::string normalized = password;
    std::transform(normalized.begin(), normalized.end(), normalized.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });

    static const std::unordered_set<std::string> common = {
        "123456", "12345678", "password", "qwerty", "admin", "abc123",
        "password1", "qwer1234", "111111", "000000"
    };

    PasswordAudit result{PasswordStrength::Strong, {}};
    if (password.size() < 12) result.warnings.push_back("Use at least 12 characters.");
    if (!lower) result.warnings.push_back("Add a lowercase letter.");
    if (!upper) result.warnings.push_back("Add an uppercase letter.");
    if (!digit) result.warnings.push_back("Add a number.");
    if (!symbol) result.warnings.push_back("Add a special character.");
    if (common.contains(normalized)) result.warnings.push_back("This is a commonly used password.");
    if (normalized.find("password") != std::string::npos ||
        normalized.find("qwerty") != std::string::npos ||
        normalized.find("1234") != std::string::npos) {
        result.warnings.push_back("Avoid predictable words or sequences.");
    }

    const int classes = static_cast<int>(lower) + static_cast<int>(upper) +
        static_cast<int>(digit) + static_cast<int>(symbol);
    if (password.size() < 10 || classes < 3 || common.contains(normalized)) {
        result.strength = PasswordStrength::Weak;
    } else if (password.size() < 14 || classes < 4 || !result.warnings.empty()) {
        result.strength = PasswordStrength::Fair;
    }
    return result;
}

std::string strengthLabel(PasswordStrength strength)
{
    switch (strength) {
    case PasswordStrength::Weak: return "WEAK";
    case PasswordStrength::Fair: return "FAIR";
    case PasswordStrength::Strong: return "STRONG";
    }
    return "UNKNOWN";
}

} // namespace passvault

