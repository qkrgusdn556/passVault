const elements = {
  domain: document.getElementById("domain"),
  status: document.getElementById("status"),
  authPanel: document.getElementById("authPanel"),
  vaultPanel: document.getElementById("vaultPanel"),
  authUser: document.getElementById("authUser"),
  authPassword: document.getElementById("authPassword"),
  unlock: document.getElementById("unlock"),
  lock: document.getElementById("lock"),
  manager: document.getElementById("manager"),
  savedUsername: document.getElementById("savedUsername"),
  fill: document.getElementById("fill")
};

let activeTab = null;
let currentDomain = "";
let currentCredential = null;
let unlocked = false;

function setStatus(text) { elements.status.textContent = text; }
function normalizeDomain(url) { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
function send(message) { return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve)); }
function setUnlocked(value) { unlocked = value; elements.authPanel.hidden = value; elements.vaultPanel.hidden = !value; elements.lock.disabled = !value; }

async function loadCredential() {
  if (!activeTab?.url) return;
  const response = await send({ type: "PASSVAULT_GET_FOR_URL", url: activeTab.url });
  if (!response?.ok) {
    currentCredential = null;
    elements.savedUsername.textContent = "-";
    setUnlocked(false);
    setStatus(response?.error || "먼저 PassVault 로그인을 하세요.");
    return;
  }
  setUnlocked(true);
  currentCredential = response.credential || null;
  if (!currentCredential) {
    elements.savedUsername.textContent = "저장된 아이디 없음";
    setStatus("이 사이트에 저장된 계정이 없습니다. 계정 관리는 관리 화면에서만 가능합니다.");
    return;
  }
  elements.savedUsername.textContent = currentCredential.username || "(아이디 없음)";
  setStatus("로그인 완료. 자동입력할 수 있습니다.");
}

function fillPage() {
  if (!unlocked) { setStatus("먼저 PassVault 로그인을 하세요."); return; }
  if (!currentCredential?.password) { setStatus("자동입력할 계정이 없습니다."); return; }
  const credential = { username: currentCredential.username || "", password: currentCredential.password };
  chrome.tabs.sendMessage(activeTab.id, { type: "PASSVAULT_FILL", credential }, (response) => {
    if (chrome.runtime.lastError) { setStatus("페이지를 새로고침한 뒤 다시 시도하세요."); return; }
    setStatus(response?.ok ? "로그인 폼에 자동입력했습니다." : (response?.error || "자동입력하지 못했습니다."));
  });
}

async function login() {
  const response = await send({ type: "PASSVAULT_UNLOCK", username: elements.authUser.value, password: elements.authPassword.value });
  if (!response?.ok) { setStatus(response?.error || "로그인 실패"); return; }
  elements.authPassword.value = "";
  await loadCredential();
}

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tabs[0];
  try { currentDomain = normalizeDomain(activeTab.url); elements.domain.textContent = currentDomain; } catch { setStatus("웹사이트 탭에서 PassVault를 열어주세요."); return; }
  const status = await send({ type: "PASSVAULT_STATUS" });
  if (status?.authUser) elements.authUser.value = status.authUser;
  if (!status?.hasAuth) { setUnlocked(false); setStatus("관리 화면에서 관리 아이디와 비밀번호를 먼저 설정하세요."); return; }
  if (status.unlocked) await loadCredential(); else { setUnlocked(false); setStatus("자동입력 전 PassVault 로그인이 필요합니다."); }
}

elements.manager.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.fill.addEventListener("click", fillPage);
elements.unlock.addEventListener("click", login);
elements.authPassword.addEventListener("keydown", (event) => { if (event.key === "Enter") login(); });
elements.lock.addEventListener("click", async () => { await send({ type: "PASSVAULT_LOCK" }); currentCredential = null; elements.savedUsername.textContent = "-"; setUnlocked(false); setStatus("잠금 처리했습니다."); });

init();
