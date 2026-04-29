// ──────────────────────────────────────────────────────────
// Pipa Driven — Bridge client (content script → page)
// ──────────────────────────────────────────────────────────
// Injeta inject-wa.js no page context e expõe uma API
// baseada em Promise para o content_script.js consumir.
// ──────────────────────────────────────────────────────────

(function () {
  "use strict";

  const CHANNEL_REQ = "pipa-wa-req";
  const CHANNEL_RES = "pipa-wa-res";
  const REQUEST_TIMEOUT_MS = 30000;

  const pending = new Map();
  let seq = 0;
  let ready = false;
  let injectionStarted = false;
  const readyWaiters = [];

  function nextId() {
    seq += 1;
    return `${Date.now()}-${seq}`;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL_RES) return;

    if (data.event === "WA_READY") {
      ready = true;
      while (readyWaiters.length) readyWaiters.shift()();
      return;
    }
    if (data.event === "WA_ERROR") {
      console.error("[Pipa] bridge error:", data.error);
      return;
    }

    const entry = pending.get(data.requestId);
    if (!entry) return;
    pending.delete(data.requestId);
    clearTimeout(entry.timer);
    entry.resolve(data);
  });

  function injectOne(id, src) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) { resolve(); return; }
      const script = document.createElement("script");
      script.id = id;
      script.src = chrome.runtime.getURL(src);
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => reject(new Error(`Falha injetando ${src}`));
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function injectScript() {
    if (injectionStarted) return;
    injectionStarted = true;
    // Ordem importa: primeiro o bundle wa-js (expõe window.WPP), depois a bridge
    injectOne("pipa-wa-vendor", "vendor/wppconnect-wa.js")
      .then(() => injectOne("pipa-wa-inject", "inject-wa.js"))
      .catch((err) => {
        injectionStarted = false;
        console.error("[Pipa] inject error:", err);
      });
  }

  function whenReady(timeoutMs = 15000) {
    if (ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("wa-js não ficou pronto a tempo")), timeoutMs);
      readyWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  function request(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const requestId = nextId();
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Timeout em ${action}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(requestId, { resolve: (r) => (r.ok ? resolve(r.data) : reject(new Error(r.error))), timer });
      window.postMessage({ channel: CHANNEL_REQ, requestId, action, payload }, "*");
    });
  }

  window.PipaWaBridge = {
    injectScript,
    whenReady,
    ping: () => request("PING"),
    getCurrentChat: () => request("GET_CURRENT_CHAT"),
    getCurrentChatHistory: (count = 200) => request("GET_CURRENT_CHAT_HISTORY", { count }),
    getChatMessages: (chat_id, count = 200) => request("GET_CHAT_MESSAGES", { chat_id, count }),
    sendTextMessage: (chat_id, text, options = {}) => request("SEND_TEXT_MESSAGE", { chat_id, text, options }),
  };
})();
