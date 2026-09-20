# PassVault v0.5

PassVault는 암호화된 비밀번호 금고 코어와 브라우저 확장 프로그램 프로토타입입니다. 현재 버전은 기능 흐름을 확인하기 위한 개발 단계이며, 실제 중요한 계정의 비밀번호 저장 용도로는 아직 권장하지 않습니다.

## 현재 진행상황

완료된 작업:

- C++ 암호화 vault 코어 구현
- Windows 빌드 스크립트 추가
- C++ 테스트 통과
- Chrome/Edge 확장 프로그램 구현
- 회원가입 시 추천 비밀번호 생성
- `사용 승인` 시 도메인/아이디/비밀번호 저장
- 아이디 입력 단계와 비밀번호 입력 단계가 분리된 회원가입 지원
- 로그인 시 저장된 아이디 사용 안내
- PassVault 관리 로그인 후 자동입력
- 확장 팝업에서는 계정 수정/저장/삭제 불가
- 계정 관리 화면 구현
- 테스트용 회원가입/단계형 회원가입/로그인 페이지 구현
- README 한글화
- GitHub 업로드 완료

GitHub 저장소:

```text
https://github.com/qkrgusdn556/passVault
```

## 포함된 기능

### C++ 코어

- Argon2id 기반 마스터 키 생성
- XChaCha20-Poly1305 인증 암호화
- 사이트/계정 추가, 조회, 수정, 삭제, 검색
- 안전한 랜덤 비밀번호 생성
- 약한 비밀번호 및 중복 비밀번호 점검
- 5분 비활성 자동 잠금
- 잠금 시 비밀번호 메모리 초기화
- 암호화, 잘못된 비밀번호, 생성기, 점검 테스트

### 브라우저 확장 프로그램

- 회원가입 화면에서 추천 비밀번호 표시
- 사용자가 승인하면 비밀번호 입력 및 도메인/아이디/비밀번호 저장
- 아이디와 비밀번호 입력 단계가 분리된 회원가입 화면 지원
- 로그인 화면에서 저장된 아이디 사용 안내
- PassVault 관리 로그인 후 자동입력
- 확장 팝업에서는 계정 수정/저장/삭제 불가
- 계정 관리는 별도 관리 화면에서만 가능

### 계정 관리 화면

- 저장된 도메인, 아이디, 비밀번호 목록 보기
- 계정 추가, 수정, 삭제
- 검색
- 약한 비밀번호 및 중복 비밀번호 표시
- JSON 내보내기/가져오기
- 관리 아이디/비밀번호 설정 및 변경

## 현재 한계

아직 실사용 비밀번호 관리자로 쓰기에는 위험합니다.

- 확장 프로그램 저장소에 사이트 비밀번호가 평문으로 저장됩니다.
- 관리 로그인은 간단한 해시 인증 수준입니다.
- JSON 내보내기 파일도 암호화되지 않습니다.
- C++ 암호화 vault와 확장 프로그램이 아직 연결되지 않았습니다.
- Native Messaging Bridge가 아직 없습니다.

현재 버전은 동작 흐름 확인용 프로토타입입니다.

## 향후 계획

1. Native Messaging Bridge 만들기
   - 확장 프로그램이 비밀번호를 직접 저장하지 않고 로컬 PassVault 프로그램에 요청하도록 변경합니다.

2. 확장 저장소 평문 저장 제거
   - `chrome.storage.local`에 민감한 비밀번호를 저장하지 않도록 변경합니다.

3. C++ `vault.json`과 확장 프로그램 연결
   - 실제 저장은 Argon2id + XChaCha20-Poly1305로 암호화된 vault에만 저장합니다.

4. 관리 로그인 강화
   - 마스터 비밀번호 또는 Windows Hello 인증을 도입합니다.

5. 도메인 검증 강화
   - 피싱 사이트 방지를 위해 origin, hostname, scheme 검증을 강화합니다.

6. 백업 암호화
   - JSON 내보내기를 평문이 아니라 암호화 백업으로 변경합니다.

7. 여러 계정 지원
   - 한 도메인에 여러 아이디가 있을 때 선택해서 자동입력할 수 있게 개선합니다.

## Windows에서 실행

빌드:

```powershell
cd C:\Users\qkrgu\Desktop\PassVault
.\build_windows.bat
```

실행:

```powershell
.\build-direct\passvault_core.exe
```

테스트:

```powershell
.\build-direct\passvault_tests.exe
```

정상 테스트 출력:

```text
All PassVault tests passed.
```

## 브라우저 확장 프로그램 설치

1. Chrome 또는 Edge에서 확장 프로그램 관리 페이지를 엽니다.
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램 로드`를 누릅니다.
4. 아래 폴더를 선택합니다.

```text
C:\Users\qkrgu\Desktop\PassVault\extension
```

코드를 수정한 뒤에는 확장 프로그램 관리 페이지에서 PassVault를 새로고침해야 변경사항이 적용됩니다.

## 테스트 페이지

로컬 테스트 서버 실행:

```powershell
cd C:\Users\qkrgu\Desktop\PassVault\web
$env:PORT='8791'; node serve.js
```

테스트 주소:

- 회원가입 테스트: `http://127.0.0.1:8791/signup-demo.html`
- 단계형 회원가입 테스트: `http://127.0.0.1:8791/signup-step-demo.html`
- 로그인 테스트: `http://127.0.0.1:8791/login-demo.html`
- 웹 계정 관리 프로토타입: `http://127.0.0.1:8791/index.html`

## 사용 흐름

### 회원가입

1. 아이디 또는 이메일을 직접 입력합니다.
2. 비밀번호 칸을 클릭합니다.
3. PassVault 추천 비밀번호 패널이 뜹니다.
4. `사용 승인`을 누릅니다.
5. 비밀번호가 입력되고, 현재 도메인/아이디/비밀번호가 저장됩니다.
6. 사이트의 계정 생성 버튼은 사용자가 직접 누릅니다.

### 로그인

1. 로그인 페이지에서 아이디 칸을 클릭합니다.
2. 저장된 아이디가 있으면 작은 안내 패널이 뜹니다.
3. `아이디 사용`을 누릅니다.
4. PassVault 로그인이 이미 되어 있으면 비밀번호도 같이 입력됩니다.
5. 잠겨 있다면 확장 아이콘을 눌러 관리 아이디/비밀번호로 로그인한 뒤 `자동입력`을 누릅니다.
6. 사이트의 로그인 버튼은 사용자가 직접 누릅니다.

## 다른 컴퓨터에서 사용법

1. GitHub에서 코드 받기

```powershell
git clone https://github.com/qkrgusdn556/passVault.git
cd passVault
```

2. 필요한 프로그램 설치

- Visual Studio 2022 C++ 빌드 도구
- vcpkg
- libsodium `x64-windows`
- Node.js

3. C++ 앱 빌드

```powershell
.\build_windows.bat
```

4. 테스트 실행

```powershell
.\build-direct\passvault_tests.exe
```

5. 확장 프로그램 설치

Chrome 또는 Edge에서 확장 프로그램 관리 페이지를 엽니다.

```text
chrome://extensions
```

또는

```text
edge://extensions
```

그 다음:

- 개발자 모드 켜기
- `압축해제된 확장 프로그램 로드` 클릭
- `passVault\extension` 폴더 선택

6. 테스트 서버 실행

```powershell
cd web
$env:PORT='8791'; node serve.js
```

7. 테스트 페이지 열기

```text
http://127.0.0.1:8791/signup-demo.html
http://127.0.0.1:8791/signup-step-demo.html
http://127.0.0.1:8791/login-demo.html
```

주의: 다른 컴퓨터로 옮겨도 저장된 계정은 자동으로 따라가지 않습니다. 현재 저장 데이터는 브라우저 확장 프로그램 로컬 저장소에 있기 때문입니다. 계정을 옮기려면 계정 관리 화면에서 JSON으로 내보낸 뒤 다른 컴퓨터에서 가져와야 합니다. 단, 이 JSON은 아직 암호화되지 않았으므로 조심해서 다뤄야 합니다.

## 보안 상태

현재 확장 프로그램은 프로토타입입니다.

주의할 점:

- 확장 프로그램 저장소에 사이트 비밀번호가 평문으로 저장됩니다.
- 관리 로그인은 해시 기반이지만, 실제 비밀번호 관리자 수준의 강한 인증은 아닙니다.
- JSON 내보내기 파일도 암호화되지 않습니다.
- 실제 중요한 계정 저장에는 아직 적합하지 않습니다.

실사용 수준으로 가려면 다음 구조가 필요합니다.

```text
브라우저 확장 프로그램
→ Native Messaging Bridge
→ C++ PassVault 암호화 vault
→ 마스터 비밀번호 또는 Windows Hello 인증
→ 도메인 검증 후 1회성 자동입력
```

## vault 파일 형식 안내

C++ 코어가 만드는 `vault.json`에는 salt, nonce, 인증된 ciphertext만 저장됩니다. 웹사이트 아이디, 비밀번호, 메모는 암호화된 payload 안에 들어갑니다.

기존 `vault.json`이 있다면 백업해두세요. 이전 구현과 직렬화 형식이 다를 수 있으므로, 호환되지 않는 경우 새 vault를 만드는 것이 안전합니다.
