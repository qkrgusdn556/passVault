const defaultState = {
  credentials: {},
  authUser: "",
  authHash: "",
  unlockedUntil: 0,
  pendingUsernames: {}
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(defaultState, (state) => {
    chrome.storage.local.set({ ...defaultState, ...state });
  });
});

function normalizeDomain(url) {
  const parsed = new URL(url);
  return parsed.hostname.replace(/^www\./, "").toLowerCase();
}

function credentialList(value) {
  if (Array.isArray(value)) return value.filter((item) => item && item.username && item.password);
  if (value && value.username && value.password) return [value];
  return [];
}

function firstCredential(value) {
  return credentialList(value)[0] || null;
}

function findCredential(value, username) {
  const list = credentialList(value);
  const normalized = String(username || "").trim().toLowerCase();
  return list.find((item) => String(item.username || "").trim().toLowerCase() === normalized) || list[0] || null;
}

async function hashPassword(username, password) {
  const user = String(username || "").trim().toLowerCase();
  const data = new TextEncoder().encode(`passvault:${user}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getState(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setState(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function isUnlocked(unlockedUntil) {
  return Number(unlockedUntil || 0) > Date.now();
}

async function saveCredentialForUrl(url, credential) {
  const domain = normalizeDomain(url);
  const { credentials, pendingUsernames } = await getState({ credentials: {}, pendingUsernames: {} });
  const username = String(credential.username || "").trim();
  const list = credentialList(credentials[domain]);
  const existingIndex = list.findIndex((item) => String(item.username || "").trim().toLowerCase() === username.toLowerCase());
  const saved = {
    username,
    password: credential.password || "",
    memo: credential.memo || "",
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    list[existingIndex] = saved;
  } else {
    list.push(saved);
  }

  credentials[domain] = list;
  delete pendingUsernames[domain];
  await setState({ credentials, pendingUsernames });
  return { domain, credential: saved, credentials: list };
}

async function setAuth(username, password) {
  const authUser = String(username || "").trim();
  if (!authUser || String(password || "").length < 6) {
    return { ok: false, error: "아이디와 6자리 이상 비밀번호가 필요합니다." };
  }
  await setState({
    authUser,
    authHash: await hashPassword(authUser, String(password)),
    unlockedUntil: Date.now() + 10 * 60 * 1000
  });
  return { ok: true, authUser };
}

async function unlock(username, password) {
  const state = await getState(defaultState);
  if (!state.authHash || !state.authUser) return { ok: false, error: "먼저 관리용 아이디/비밀번호를 설정하세요." };
  const sameUser = String(username || "").trim().toLowerCase() === String(state.authUser).trim().toLowerCase();
  const sameHash = await hashPassword(state.authUser, String(password || "")) === state.authHash;
  if (!sameUser || !sameHash) return { ok: false, error: "아이디 또는 비밀번호가 틀렸습니다." };
  await setState({ unlockedUntil: Date.now() + 10 * 60 * 1000 });
  return { ok: true, authUser: state.authUser };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "PASSVAULT_STATUS") {
      const state = await getState(defaultState);
      sendResponse({ ok: true, hasAuth: Boolean(state.authUser && state.authHash), authUser: state.authUser || "", unlocked: isUnlocked(state.unlockedUntil) });
      return;
    }

    if (message.type === "PASSVAULT_SET_AUTH") {
      sendResponse(await setAuth(message.username, message.password));
      return;
    }

    if (message.type === "PASSVAULT_UNLOCK") {
      sendResponse(await unlock(message.username, message.password));
      return;
    }

    if (message.type === "PASSVAULT_LOCK") {
      await setState({ unlockedUntil: 0 });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "PASSVAULT_SAVE_FROM_PAGE") {
      const pageUrl = sender.tab?.url || message.url;
      if (!pageUrl || !message.credential?.password) {
        sendResponse({ ok: false, error: "Missing credential." });
        return;
      }
      const saved = await saveCredentialForUrl(pageUrl, message.credential);
      sendResponse({ ok: true, ...saved });
      return;
    }

    if (message.type === "PASSVAULT_REMEMBER_SIGNUP_USERNAME") {
      const domain = normalizeDomain(message.url);
      const username = String(message.username || "").trim();
      const { pendingUsernames } = await getState({ pendingUsernames: {} });
      if (username) {
        pendingUsernames[domain] = { username, updatedAt: Date.now() };
        await setState({ pendingUsernames });
      }
      sendResponse({ ok: true, domain });
      return;
    }

    if (message.type === "PASSVAULT_GET_PENDING_SIGNUP_USERNAME") {
      const domain = normalizeDomain(message.url);
      const { pendingUsernames } = await getState({ pendingUsernames: {} });
      const pending = pendingUsernames[domain];
      const fresh = pending && Date.now() - Number(pending.updatedAt || 0) < 60 * 60 * 1000;
      sendResponse({ ok: true, domain, username: fresh ? pending.username : "" });
      return;
    }

    if (message.type === "PASSVAULT_PEEK_USERNAME_FOR_URL") {
      const domain = normalizeDomain(message.url);
      const state = await getState(defaultState);
      const list = credentialList(state.credentials[domain]);
      const credential = list[0] || null;
      sendResponse({
        ok: true,
        domain,
        username: credential?.username || "",
        usernames: list.map((item) => item.username),
        hasCredential: list.length > 0
      });
      return;
    }

    if (message.type === "PASSVAULT_GET_FOR_URL") {
      const domain = normalizeDomain(message.url);
      const state = await getState(defaultState);
      if (!isUnlocked(state.unlockedUntil)) {
        sendResponse({ ok: false, locked: true, error: "먼저 PassVault 로그인을 하세요." });
        return;
      }
      const list = credentialList(state.credentials[domain]);
      sendResponse({ ok: true, domain, credential: findCredential(list, message.username), credentials: list });
      return;
    }

    sendResponse({ ok: false, error: "Unknown request." });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
