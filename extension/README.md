# PassVault browser extension

This is a Chrome/Edge Manifest V3 extension for the current PassVault project.

## Install locally

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this folder:

```text
C:\Users\qkrgu\Desktop\PassVault\extension
```

## What works now

- Detects the current website domain.
- Saves one credential per domain in browser local extension storage.
- Generates strong random passwords.
- Fills username and password fields on the active page.
- Leaves the final login or signup submit button for the user to press.

## Security note

This first extension version does not read `vault.json` directly. The existing C++ app encrypts
`vault.json`, while this extension stores its own local browser copy. The next step is a native
messaging bridge so the extension can request credentials from the encrypted PassVault core.
