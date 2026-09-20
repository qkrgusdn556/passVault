# PassVault Windows build

This folder was verified on Windows with Visual Studio 2022 and vcpkg libsodium.

## Run

```powershell
.\build-direct\passvault_core.exe
```

Keep `build-direct\libsodium.dll` next to the executable.

## Test

```powershell
.\build-direct\passvault_tests.exe
```

Expected output:

```text
All PassVault tests passed.
```

## Rebuild

```powershell
.\build_windows.bat
```

The script expects:

- Visual Studio 2022 Community at `C:\Program Files\Microsoft Visual Studio\2022\Community`
- vcpkg x64-windows libsodium at `C:\vcpkg\installed\x64-windows`
