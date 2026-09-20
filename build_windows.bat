@echo off
setlocal

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1

if not exist build-direct mkdir build-direct

cl /nologo /std:c++20 /EHsc /W4 /D_CRT_SECURE_NO_WARNINGS ^
  /Icore\include /IC:\vcpkg\installed\x64-windows\include ^
  core\src\main.cpp core\src\crypto.cpp core\src\password_audit.cpp core\src\password_generator.cpp core\src\vault.cpp ^
  /link /LIBPATH:C:\vcpkg\installed\x64-windows\lib libsodium.lib /OUT:build-direct\passvault_core.exe
if errorlevel 1 exit /b 1

cl /nologo /std:c++20 /EHsc /W4 /D_CRT_SECURE_NO_WARNINGS ^
  /Icore\include /IC:\vcpkg\installed\x64-windows\include ^
  tests\test_core.cpp core\src\crypto.cpp core\src\password_audit.cpp core\src\password_generator.cpp core\src\vault.cpp ^
  /link /LIBPATH:C:\vcpkg\installed\x64-windows\lib libsodium.lib /OUT:build-direct\passvault_tests.exe
if errorlevel 1 exit /b 1

copy /Y C:\vcpkg\installed\x64-windows\bin\libsodium.dll build-direct\libsodium.dll >nul
exit /b 0
