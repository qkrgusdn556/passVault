# PassVault v0.5

Codex and Windows builds of the encrypted PassVault core.

## Included

- Argon2id master-key derivation
- XChaCha20-Poly1305 authenticated vault encryption
- Site/account add, view, edit, delete, and search
- Cryptographically secure password generation
- Weak-password and password-reuse audit
- Five-minute inactivity lock (`PASSVAULT_AUTO_LOCK_SECONDS` can override it)
- Password memory clearing when the vault locks
- Automated encryption, wrong-password, generator, and audit tests

The vault file contains only salt, nonce, and authenticated ciphertext. Website usernames,
passwords, and memos are inside the encrypted payload.

## Run in Codex/Linux

The Codex runtime already provides the libsodium shared library:

```bash
make
./build/passvault_core
```

Run tests:

```bash
make test
```

## Build on Windows with the existing vcpkg setup

From a Visual Studio 2022 x64 Developer Command Prompt:

```powershell
cd C:\dev\PassVault
cmake -S . -B build -G "Visual Studio 17 2022" -A x64 `
  -DCMAKE_TOOLCHAIN_FILE=C:/vcpkg/scripts/buildsystems/vcpkg.cmake
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
.\build\Release\passvault_core.exe
```

## Important migration note

This reconstructed Codex project uses a documented v1 encrypted payload format. Keep a backup
of any existing `vault.json`. If the earlier local implementation used a different serialization
format, create a new vault with this build rather than overwriting the old file.


An ID management site is included in web/. Open web/index.html in a browser to add, edit, search, import, and export site accounts using local browser storage.

## Next integration phase

An initial browser extension is included in `extension/`. Load it as an unpacked Chrome or Edge
extension for password generation, per-site browser storage, and form filling.

The production browser extension should communicate with a local native-messaging bridge, not read
`vault.json` directly. The intended flow is:

1. Detect a signup/login form and normalize the exact domain.
2. Ask the local PassVault process for a generated password or a credential request.
3. For login, create a short-lived challenge and send only the approval request to the phone.
4. Verify the phone signature locally, recheck the domain, then release one credential to the extension.
5. Fill the fields; do not automatically click the final login or signup button.

Real background phone notifications require the Flutter app, Firebase project configuration,
and FCM/APNs credentials. Those secrets are intentionally not included in this core package.

