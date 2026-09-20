const el = {
  totalCount: document.getElementById("totalCount"), weakCount: document.getElementById("weakCount"), reuseCount: document.getElementById("reuseCount"), search: document.getElementById("search"), exportButton: document.getElementById("exportButton"), importInput: document.getElementById("importInput"), newButton: document.getElementById("newButton"), form: document.getElementById("form"), domainKey: document.getElementById("domainKey"), domain: document.getElementById("domain"), username: document.getElementById("username"), password: document.getElementById("password"), memo: document.getElementById("memo"), showButton: document.getElementById("showButton"), saveButton: document.getElementById("saveButton"), deleteButton: document.getElementById("deleteButton"), status: document.getElementById("status"), authForm: document.getElementById("authForm"), managerAuthUser: document.getElementById("managerAuthUser"), managerAuthPassword: document.getElementById("managerAuthPassword"), managerAuthConfirm: document.getElementById("managerAuthConfirm"), authStatus: document.getElementById("authStatus"), rows: document.getElementById("rows"), empty: document.getElementById("empty")
};
let credentials = {};
let query = "";
function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}
async function loadAuthStatus() {
  const status = await send({ type: "PASSVAULT_STATUS" });
  if (status?.authUser) el.managerAuthUser.value = status.authUser;
  el.authStatus.textContent = status?.hasAuth ? "관리 로그인이 설정되어 있습니다. 변경하려면 새 비밀번호를 입력하세요." : "아직 관리 로그인이 없습니다. 아이디와 비밀번호를 설정하세요.";
}
async function saveAuth(event) {
  event.preventDefault();
  if (el.managerAuthPassword.value !== el.managerAuthConfirm.value) {
    el.authStatus.textContent = "비밀번호 확인이 일치하지 않습니다.";
    return;
  }
  const response = await send({ type: "PASSVAULT_SET_AUTH", username: el.managerAuthUser.value, password: el.managerAuthPassword.value });
  if (!response?.ok) {
    el.authStatus.textContent = response?.error || "관리 로그인을 저장하지 못했습니다.";
    return;
  }
  el.managerAuthPassword.value = "";
  el.managerAuthConfirm.value = "";
  el.authStatus.textContent = "관리 로그인을 저장했습니다.";
}
function normalizeDomain(value) {
  return value.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
}
function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function getCredentials() {
  return new Promise((resolve) => chrome.storage.local.get({ credentials: {} }, ({ credentials }) => resolve(credentials || {})));
}
function setCredentials(next) {
  return new Promise((resolve) => chrome.storage.local.set({ credentials: next }, resolve));
}
function score(password) {
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^a-zA-Z0-9\s]/.test(password)].filter(Boolean).length;
  if (!password || password.length < 10 || classes < 3 || /1234|password|qwerty/i.test(password)) return "weak";
  if (password.length < 14 || classes < 4) return "fair";
  return "strong";
}
function duplicateMap() {
  const map = new Map();
  Object.values(credentials).forEach((item) => {
    if (item.password) map.set(item.password, (map.get(item.password) || 0) + 1);
  });
  return map;
}
function badge(domain, item, dupes) {
  if (dupes.get(item.password) > 1) return '<span class="badge danger">중복</span>';
  const s = score(item.password || "");
  if (s === "weak") return '<span class="badge danger">약함</span>';
  if (s === "fair") return '<span class="badge warn">보통</span>';
  return '<span class="badge">강함</span>';
}
function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function filteredEntries() {
  const entries = Object.entries(credentials).sort(([a], [b]) => a.localeCompare(b));
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(([domain, item]) => [domain, item.username, item.memo].join(" ").toLowerCase().includes(q));
}
function render() {
  const entries = filteredEntries();
  const dupes = duplicateMap();
  const allItems = Object.values(credentials);
  el.totalCount.textContent = String(allItems.length);
  el.weakCount.textContent = String(allItems.filter((item) => score(item.password || "") === "weak").length);
  el.reuseCount.textContent = String(allItems.filter((item) => dupes.get(item.password) > 1).length);
  el.rows.innerHTML = entries.map(([domain, item]) => `
    <tr data-domain="${escapeHtml(domain)}">
      <td><div class="domainCell">${escapeHtml(domain)}</div><div class="muted">${escapeHtml(item.memo || "")}</div></td>
      <td>${escapeHtml(item.username || "")}</td>
      <td>${badge(domain, item, dupes)}</td>
      <td class="muted">${formatDate(item.updatedAt)}</td>
    </tr>`).join("");
  el.empty.classList.toggle("visible", entries.length === 0);
}
function resetForm() {
  el.domainKey.value = "";
  el.domain.value = "";
  el.username.value = "";
  el.password.value = "";
  el.memo.value = "";
  el.domain.focus();
  el.status.textContent = "새 계정을 입력하세요.";
}
function selectDomain(domain) {
  const item = credentials[domain];
  if (!item) return;
  el.domainKey.value = domain;
  el.domain.value = domain;
  el.username.value = item.username || "";
  el.password.value = item.password || "";
  el.memo.value = item.memo || "";
  el.status.textContent = `${domain} 계정을 편집 중입니다.`;
}
async function saveForm(event) {
  event.preventDefault();
  const oldDomain = el.domainKey.value;
  const domain = normalizeDomain(el.domain.value);
  if (!domain || !el.username.value.trim() || !el.password.value) {
    el.status.textContent = "도메인, 아이디, 비밀번호를 모두 입력하세요.";
    return;
  }
  if (oldDomain && oldDomain !== domain) delete credentials[oldDomain];
  credentials[domain] = { username: el.username.value.trim(), password: el.password.value, memo: el.memo.value.trim(), updatedAt: new Date().toISOString() };
  await setCredentials(credentials);
  el.domainKey.value = domain;
  render();
  el.status.textContent = "저장했습니다.";
}
async function deleteSelected() {
  const domain = el.domainKey.value;
  if (!domain) { resetForm(); return; }
  delete credentials[domain];
  await setCredentials(credentials);
  render();
  resetForm();
  el.status.textContent = "삭제했습니다.";
}
function exportJson() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), credentials }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "passvault-extension-credentials.json";
  link.click();
  URL.revokeObjectURL(url);
  el.status.textContent = "내보냈습니다.";
}
function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const next = parsed.credentials || parsed;
      if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error("bad format");
      credentials = {};
      Object.entries(next).forEach(([domain, item]) => {
        const key = normalizeDomain(domain);
        if (key && item?.username && item?.password) credentials[key] = { username: String(item.username), password: String(item.password), memo: String(item.memo || ""), updatedAt: item.updatedAt || new Date().toISOString() };
      });
      await setCredentials(credentials);
      render();
      resetForm();
      el.status.textContent = "가져왔습니다.";
    } catch {
      el.status.textContent = "가져오기 파일을 읽지 못했습니다.";
    }
  });
  reader.readAsText(file);
}

el.authForm.addEventListener("submit", saveAuth);
el.form.addEventListener("submit", saveForm);
el.deleteButton.addEventListener("click", deleteSelected);
el.newButton.addEventListener("click", resetForm);
el.exportButton.addEventListener("click", exportJson);
el.importInput.addEventListener("change", (event) => importJson(event.target.files[0]));
el.search.addEventListener("input", (event) => { query = event.target.value; render(); });
el.showButton.addEventListener("click", () => { const show = el.password.type === "password"; el.password.type = show ? "text" : "password"; el.showButton.textContent = show ? "숨김" : "보기"; });
el.rows.addEventListener("click", (event) => { const row = event.target.closest("tr[data-domain]"); if (row) selectDomain(row.dataset.domain); });

loadAuthStatus();
getCredentials().then((loaded) => { credentials = loaded; render(); });



