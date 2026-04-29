const $ = (selector) => document.querySelector(selector);

const loginScreen = $("#login-screen");
const mainScreen = $("#main-screen");
const loginForm = $("#login-form");
const loginBtn = $("#login-btn");
const loginError = $("#login-error");
const logoutBtn = $("#logout-btn");
const emailInput = $("#email");
const passwordInput = $("#password");
const sessionTitle = $("#session-title");
const sessionUrl = $("#session-url");
const statusDot = $("#status-dot");
const statusTitle = $("#status-title");
const statusDetail = $("#status-detail");
const lastErrorRow = $("#last-error-row");

let refreshTimer = null;

function sendRuntimeMessage(message) {
  return chrome.runtime
    .sendMessage(message)
    .catch((error) => ({ ok: false, error: error?.message || String(error) }));
}

function setLoginError(message) {
  loginError.textContent = message || "";
  loginError.classList.toggle("hidden", !message);
}

function formatRelative(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h`;

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showLogin() {
  window.clearInterval(refreshTimer);
  refreshTimer = null;
  loginScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
}

function showMain(status) {
  const session = status.session || {};
  loginScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  sessionTitle.textContent = session.user?.email || session.label || "CRM";
  sessionUrl.textContent = "Pipa Driven CRM";
  renderStatus(status);

  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(loadStatus, 2500);
}

function setStatusVisual(kind, title, detail) {
  statusDot.className = `dot ${kind}`;
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
}

function renderStatus(status) {
  const stats = status.stats || {};

  $("#stat-lookups").textContent = String(stats.lookups || 0);
  $("#stat-eligible").textContent = String(stats.eligible || 0);
  $("#stat-ignored").textContent = String(stats.ignored || 0);
  $("#stat-synced").textContent = String(stats.synced || 0);
  $("#last-phone").textContent = stats.last_phone || "—";
  $("#last-contact").textContent = stats.last_contact_name || "—";
  $("#last-sync").textContent = formatRelative(stats.last_sync_at);
  $("#last-error").textContent = stats.last_error || "—";
  lastErrorRow.classList.toggle("hidden", !stats.last_error);

  if (stats.last_status === "message_synced") {
    setStatusVisual("ok", "Sincronização ativa", "O último evento aprovado foi enviado ao CRM.");
    return;
  }
  if (stats.last_status === "monitoring_contact") {
    setStatusVisual("ok", "Contato aprovado", "A conversa aberta está autorizada para espelhamento.");
    return;
  }
  if (stats.last_status === "ignored_contact") {
    setStatusVisual("warn", "Contato ignorado", "Esse número ainda não existe no CRM.");
    return;
  }
  if (stats.last_status === "sync_failed") {
    setStatusVisual("error", "Falha no envio", stats.last_error || "Verifique a conexão com o CRM.");
    return;
  }

  setStatusVisual("warn", "Aguardando conversa", "Abra uma conversa no WhatsApp Web para validar o telefone.");
}

async function loadStatus() {
  const response = await sendRuntimeMessage({ type: "CRM_GET_STATUS" });
  if (!response.ok || !response.data?.authenticated) {
    showLogin();
    return;
  }
  showMain(response.data);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError("");
  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  const payload = {
    email: emailInput.value.trim(),
    password: passwordInput.value,
  };

  try {
    const response = await sendRuntimeMessage({ type: "CRM_LOGIN", payload });
    if (!response.ok) throw new Error(response.error || "Não foi possível entrar.");
    passwordInput.value = "";
    await loadStatus();
  } catch (error) {
    setLoginError(error?.message || String(error));
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});

logoutBtn.addEventListener("click", async () => {
  await sendRuntimeMessage({ type: "CRM_LOGOUT" });
  showLogin();
});

loadStatus();
