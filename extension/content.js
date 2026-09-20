function visibleInput(input) {
  const style = window.getComputedStyle(input);
  return style.display !== "none" && style.visibility !== "hidden" && input.offsetParent !== null;
}

function randomInt(max) {
  const bucket = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  do {
    crypto.getRandomValues(bucket);
  } while (bucket[0] >= limit);
  return bucket[0] % max;
}

function generatePassword(length = 22) {
  const groups = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%^&*()-_=+[]{}"];
  const all = groups.join("");
  const chars = groups.map((group) => group[randomInt(group.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    const temp = chars[index];
    chars[index] = chars[swap];
    chars[swap] = temp;
  }
  return chars.join("");
}

function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function allInputs() {
  return Array.from(document.querySelectorAll("input")).filter(visibleInput);
}

function inputName(input) {
  return [input.id, input.name, input.autocomplete, input.placeholder, input.getAttribute("aria-label")].filter(Boolean).join(" ").toLowerCase();
}

function isUsernameInput(input) {
  const type = (input.type || "text").toLowerCase();
  const name = inputName(input);
  return ["email", "text", "tel"].includes(type) && (/user|email|login|account|id|아이디|이메일|계정/.test(name) || type === "email" || input.autocomplete === "username");
}

function findUsernameBefore(target) {
  const candidates = allInputs().filter(isUsernameInput);
  return candidates.filter((input) => input.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).pop() || candidates[0] || null;
}

function findFields() {
  const inputs = allInputs();
  const passwords = inputs.filter((input) => input.type === "password");
  if (!passwords.length) return null;
  return { username: findUsernameBefore(passwords[0]), password: passwords[0], confirmPassword: passwords[1] || null, passwords };
}

function setNativeValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function pageText() {
  return document.body.innerText.toLowerCase();
}

function nearbyText(input) {
  const container = input.closest("form, main, section, article, div") || document.body;
  return (container.innerText || "").toLowerCase();
}

function signupUrlHint() {
  return /signup|sign-up|register|join|create-account|createaccount|webcreateaccount|회원가입|가입/.test(location.href.toLowerCase());
}

function loginUrlHint() {
  return !signupUrlHint() && /login|signin|sign-in|session|로그인/.test(location.href.toLowerCase());
}

function isSignupLike(fields) {
  const passwordMeta = inputName(fields.password);
  const localText = nearbyText(fields.password);
  if (fields.passwords.length >= 2) return true;
  if ((fields.password.autocomplete || "").includes("new-password")) return true;
  if (/new|signup|sign-up|register|create|join|passwd|confirm|가입|회원가입|계정 만들기|새 비밀번호/.test(passwordMeta)) return true;
  if (signupUrlHint()) return true;
  if (loginUrlHint()) return false;
  return /sign up|signup|create account|register|join now|create.*password|choose.*password|confirm.*password|가입|회원가입|계정 만들기|비밀번호.*만들|비밀번호.*확인/.test(localText);
}

function positionNear(panel, target) {
  const rect = target.getBoundingClientRect();
  panel.style.left = `${Math.max(12, rect.left + window.scrollX)}px`;
  panel.style.top = `${rect.bottom + window.scrollY + 8}px`;
}

function shouldRememberSignupUsername(input) {
  if (loginUrlHint()) return false;
  return signupUrlHint() || /sign up|signup|create account|register|join now|가입|회원가입|계정 만들기/.test(nearbyText(input));
}

async function rememberUsernameFromInput(input) {
  if (!(input instanceof HTMLInputElement) || !isUsernameInput(input) || !shouldRememberSignupUsername(input)) return;
  const username = input.value.trim();
  if (!username || username.length < 2) return;
  await send({ type: "PASSVAULT_REMEMBER_SIGNUP_USERNAME", url: location.href, username });
}

async function getPendingUsername() {
  const response = await send({ type: "PASSVAULT_GET_PENDING_SIGNUP_USERNAME", url: location.href });
  return response?.ok ? response.username || "" : "";
}

function cleanUsernameCandidate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 254) return "";
  const email = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  if (email) return email;
  if (/^[a-z0-9._%+-]{3,64}$/i.test(trimmed) && /accounts\.google\./i.test(location.hostname)) {
    return `${trimmed}@gmail.com`;
  }
  return "";
}

function usernameFromPageContext() {
  const inputHints = /email|identifier|username|login|account|아이디|이메일|계정/i;
  for (const input of Array.from(document.querySelectorAll("input"))) {
    const meta = [input.id, input.name, input.autocomplete, input.getAttribute("aria-label")].filter(Boolean).join(" ");
    if (!inputHints.test(meta)) continue;
    const candidate = cleanUsernameCandidate(input.value);
    if (candidate) return candidate;
  }

  const textCandidate = cleanUsernameCandidate(document.body.innerText);
  if (textCandidate) return textCandidate;

  for (const element of Array.from(document.querySelectorAll("[data-email], [data-identifier], [aria-label], [title]"))) {
    const candidate = cleanUsernameCandidate(
      element.getAttribute("data-email") ||
      element.getAttribute("data-identifier") ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title")
    );
    if (candidate) return candidate;
  }
  return "";
}

function fillCredential(credential) {
  const fields = findFields();
  if (!fields) return { ok: false, error: "No login form was found on this page." };
  if (fields.username && credential.username) setNativeValue(fields.username, credential.username);
  setNativeValue(fields.password, credential.password);
  if (fields.confirmPassword && isSignupLike(fields)) setNativeValue(fields.confirmPassword, credential.password);
  return { ok: true };
}

function looksLikeSignupPage() {
  if (signupUrlHint()) return true;
  if (loginUrlHint()) return false;
  return /sign up|signup|create account|register|join now|가입|회원가입|계정 만들기/.test(pageText());
}

function findUsernameFieldOnly() {
  const fields = findFields();
  const username = fields?.username || allInputs().find(isUsernameInput) || null;
  if (!username || looksLikeSignupPage()) return null;
  if (username.dataset.passvaultUsernamePrompted === "true") return null;
  return username;
}

function showUsernamePrompt(input, username) {
  if (!username || document.getElementById("passvault-username-panel")) return;
  input.dataset.passvaultUsernamePrompted = "true";
  const panel = document.createElement("div");
  panel.id = "passvault-username-panel";
  panel.style.cssText = "position:absolute;z-index:2147483646;width:280px;border:1px solid #cfd8d1;border-radius:8px;background:#fff;color:#151817;box-shadow:0 16px 40px rgba(20,30,25,.18);padding:12px;font:13px system-ui,-apple-system,Segoe UI,sans-serif;";
  const safeUsername = username.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  panel.innerHTML = `
    <div style="font-weight:850;margin-bottom:5px;">저장된 아이디가 있습니다</div>
    <div style="margin-bottom:9px;color:#34403a;word-break:break-all;">${safeUsername}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button type="button" data-passvault-use-id style="border:0;border-radius:6px;background:#267365;color:white;font-weight:800;padding:8px;cursor:pointer;">아이디 사용</button>
      <button type="button" data-passvault-close-id style="border:0;border-radius:6px;background:#e5ece6;color:#1d3732;font-weight:800;padding:8px;cursor:pointer;">닫기</button>
    </div>
    <div data-passvault-note style="margin-top:8px;color:#59645d;font-size:12px;line-height:1.35;">PassVault 로그인이 되어 있으면 비밀번호도 같이 입력됩니다.</div>
  `;
  document.body.appendChild(panel);
  positionNear(panel, input);
  panel.querySelector("[data-passvault-use-id]").addEventListener("click", async () => {
    setNativeValue(input, username);
    sessionStorage.setItem("passvault.selectedLoginUsername", username);
    const response = await send({ type: "PASSVAULT_GET_FOR_URL", url: location.href });
    if (response?.ok && response.credential?.password) {
      const result = fillCredential(response.credential);
      if (result.ok) {
        panel.remove();
        return;
      }
    }
    const note = panel.querySelector("[data-passvault-note]");
    if (note) note.textContent = "아이디를 넣었습니다. 비밀번호 화면에서 다시 자동입력됩니다.";
  });
  panel.querySelector("[data-passvault-close-id]").addEventListener("click", () => panel.remove());
}

function maybePromptSavedUsername(target) {
  const usernameInput = target instanceof HTMLInputElement && target.type !== "password" ? findUsernameFieldOnly() : null;
  if (!usernameInput) return;
  chrome.runtime.sendMessage({ type: "PASSVAULT_PEEK_USERNAME_FOR_URL", url: location.href }, (response) => {
    if (response?.ok && response.hasCredential && response.username) showUsernamePrompt(usernameInput, response.username);
  });
}

function suggestionPanelExists() {
  return document.getElementById("passvault-suggestion-panel");
}

async function makePanel(fields, pendingUsername) {
  if (fields.password.dataset.passvaultAccepted === "true" || fields.password.dataset.passvaultDismissed === "true") return;
  if (suggestionPanelExists()) return;
  const password = generatePassword(22);
  const panel = document.createElement("div");
  panel.id = "passvault-suggestion-panel";
  panel.style.cssText = "position:absolute;z-index:2147483647;width:300px;border:1px solid #cfd8d1;border-radius:8px;background:#fff;color:#151817;box-shadow:0 16px 40px rgba(20,30,25,.18);padding:12px;font:13px system-ui,-apple-system,Segoe UI,sans-serif;";
  panel.innerHTML = `
    <div style="font-weight:850;margin-bottom:6px;">PassVault 추천 비밀번호</div>
    <input value="${password.replaceAll('"', '&quot;')}" readonly style="width:100%;box-sizing:border-box;border:1px solid #d5ddd4;border-radius:6px;padding:8px;margin-bottom:8px;font:13px monospace;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button type="button" data-passvault-use style="border:0;border-radius:6px;background:#267365;color:white;font-weight:800;padding:8px;cursor:pointer;">사용 승인</button>
      <button type="button" data-passvault-close style="border:0;border-radius:6px;background:#e5ece6;color:#1d3732;font-weight:800;padding:8px;cursor:pointer;">닫기</button>
    </div>
    <div data-passvault-status style="margin-top:8px;color:#59645d;font-size:12px;line-height:1.35;">승인하면 현재 도메인, 아이디, 비밀번호가 저장됩니다.</div>
  `;
  document.body.appendChild(panel);
  positionNear(panel, fields.password);

  panel.querySelector("[data-passvault-close]").addEventListener("click", () => {
    fields.password.dataset.passvaultDismissed = "true";
    panel.remove();
  });

  panel.querySelector("[data-passvault-use]").addEventListener("click", async () => {
    if (fields.username?.value?.trim()) await rememberUsernameFromInput(fields.username);
    const username = fields.username?.value?.trim() ||
      pendingUsername ||
      await getPendingUsername() ||
      usernameFromPageContext();
    const status = panel.querySelector("[data-passvault-status]");
    if (!username) {
      status.textContent = "이전 단계의 아이디를 찾지 못했습니다. 이전 화면으로 돌아가 아이디를 다시 입력한 뒤 진행하세요.";
      fields.username?.focus();
      return;
    }

    setNativeValue(fields.password, password);
    fields.password.dataset.passvaultAccepted = "true";
    if (fields.confirmPassword) {
      setNativeValue(fields.confirmPassword, password);
      fields.confirmPassword.dataset.passvaultAccepted = "true";
    }

    chrome.runtime.sendMessage({
      type: "PASSVAULT_SAVE_FROM_PAGE",
      credential: { username, password, memo: "Saved from signup form" }
    }, (response) => {
      if (response?.ok) {
        status.textContent = "저장 완료. 이제 계정 생성을 계속하세요.";
        window.setTimeout(() => panel.remove(), 450);
      } else {
        status.textContent = response?.error || "저장하지 못했습니다.";
      }
    });
  });
}

async function maybeSuggest() {
  const fields = findFields();
  if (!fields || fields.password.dataset.passvaultAccepted === "true" || fields.password.dataset.passvaultDismissed === "true") return;
  if (loginUrlHint() && !isSignupLike(fields)) return;
  if (fields.username?.value?.trim()) await rememberUsernameFromInput(fields.username);
  const pendingUsername = await getPendingUsername();
  if (!isSignupLike(fields) && !pendingUsername) return;
  await makePanel(fields, pendingUsername);
}

document.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement && isUsernameInput(event.target)) {
    window.clearTimeout(event.target.passvaultRememberTimer);
    event.target.passvaultRememberTimer = window.setTimeout(() => rememberUsernameFromInput(event.target), 250);
  }
});

document.addEventListener("change", (event) => {
  if (event.target instanceof HTMLInputElement) rememberUsernameFromInput(event.target);
});

document.addEventListener("focusout", (event) => {
  if (event.target instanceof HTMLInputElement) rememberUsernameFromInput(event.target);
});

async function maybeFillSelectedLoginPassword(target) {
  if (!(target instanceof HTMLInputElement) || target.type !== "password" || isSignupLike(findFields() || { passwords: [], password: target })) return;
  const selectedUsername = sessionStorage.getItem("passvault.selectedLoginUsername") || "";
  if (!selectedUsername) return;
  const response = await send({ type: "PASSVAULT_GET_FOR_URL", url: location.href });
  if (!response?.ok || !response.credential?.password) return;
  if (response.credential.username && response.credential.username.toLowerCase() !== selectedUsername.toLowerCase()) return;
  setNativeValue(target, response.credential.password);
  sessionStorage.removeItem("passvault.selectedLoginUsername");
}
document.addEventListener("focusin", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === "password") {
    maybeFillSelectedLoginPassword(event.target);
    maybeSuggest();
  } else if (event.target instanceof HTMLInputElement) {
    maybePromptSavedUsername(event.target);
  }
});

let scanTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(maybeSuggest, 400);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(maybeSuggest, 700);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PASSVAULT_FILL") {
    sendResponse(fillCredential(message.credential));
    return true;
  }
  if (message.type === "PASSVAULT_HAS_FORM") {
    sendResponse({ ok: true, hasForm: Boolean(findFields()) });
    return true;
  }
  return false;
});





