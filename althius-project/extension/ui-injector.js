(() => {
  "use strict";

  if (window.__pipaUiInjectorLoaded) return;
  window.__pipaUiInjectorLoaded = true;

  const SIDEBAR_HOST_ID = "pipa-driven-sidebar-host";
  const TOPBAR_HOST_ID = "pipa-driven-topbar-host";
  const LOCAL_UI_STATE_KEY = "pipa_ui_local_state_v1";
  const SIDEBAR_WIDTH = 340;
  const MAX_LOCAL_CHAT_STATES = 200;

  const ui = {
    sidebarHost: null,
    sidebarShadow: null,
    topbarHost: null,
    topbarShadow: null,
    layoutTimer: null,
    statusTimer: null,
    saveTimer: null,
    activeSidebarTab: "profile",
    activeInboxTab: "inbox",
    approving: false,
  };

  const state = {
    authenticated: false,
    status: "booting",
    chatKey: "",
    chatId: "",
    title: "",
    phone: "",
    source: "",
    monitoring: false,
    contact: null,
    stats: null,
    lastError: "",
    lastSyncAt: "",
    profile: {
      name: "",
      company: "",
      stage: "pre-venda",
      value: "",
    },
    draft: "",
    notes: "",
    followUpAt: "",
  };

  const statusLabels = {
    booting: ["warn", "Carregando", "Aguardando WhatsApp Web."],
    unauthenticated: ["warn", "CRM desconectado", "Conecte pelo popup da extensao."],
    no_chat: ["warn", "Abra um chat", "Selecione uma conversa para validar o contato."],
    checking_contact: ["warn", "Validando contato", "Consultando o CRM antes de espelhar."],
    monitoring_contact: ["ok", "CRM ativo", "Esta conversa esta autorizada para sync."],
    ignored_contact: ["muted", "Contato ignorado", "O CRM nao marcou esta conversa como oportunidade."],
    group_ignored: ["muted", "Grupo ignorado", "Conversas em grupo nao entram no sync."],
    missing_phone: ["warn", "Telefone ausente", "Nao foi possivel identificar o numero do contato."],
    message_synced: ["ok", "Mensagem sincronizada", "Ultima mensagem enviada ao CRM."],
    sync_failed: ["error", "Falha no sync", "Veja o popup para o erro mais recente."],
  };

  function sendRuntimeMessage(message) {
    return chrome.runtime
      .sendMessage(message)
      .catch((error) => ({ ok: false, error: error?.message || String(error) }));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    const raw = String(value || "").replace(/[^\d.,]/g, "");
    return raw;
  }

  function getMainPane() {
    return document.querySelector("#main");
  }

  function getPaneSide() {
    return document.querySelector("#pane-side");
  }

  function getStatusMeta() {
    if (!state.authenticated) return statusLabels.unauthenticated;
    return statusLabels[state.status] || statusLabels.no_chat;
  }

  function readContactField(...paths) {
    const root = state.contact?.raw?.contact || state.contact?.raw?.data || state.contact?.raw || state.contact || {};
    for (const path of paths) {
      let current = root;
      for (const key of path) current = current?.[key];
      if (current !== undefined && current !== null && current !== "") return current;
    }
    return "";
  }

  function hydrateProfileFromContact() {
    const name = state.contact?.name || readContactField(["name"], ["full_name"], ["display_name"]);
    const company = readContactField(["company"], ["company_name"], ["organization", "name"], ["deal", "company"]);
    const stage = readContactField(["stage"], ["status"], ["deal", "stage"], ["opportunity", "stage"]);
    const value = readContactField(["value"], ["deal_value"], ["amount"], ["deal", "value"], ["opportunity", "value"]);

    state.profile = {
      name: state.profile.name || String(name || state.title || ""),
      company: state.profile.company || String(company || ""),
      stage: state.profile.stage || String(stage || "pre-venda"),
      value: state.profile.value || String(value || ""),
    };
  }

  async function loadLocalChatState(chatKey) {
    if (!chatKey) return;
    const result = await chrome.storage.local.get(LOCAL_UI_STATE_KEY);
    const saved = result[LOCAL_UI_STATE_KEY]?.[chatKey];
    const savedProfile = saved?.profile || {};
    state.profile = {
      name: savedProfile.name || "",
      company: savedProfile.company || "",
      stage: savedProfile.stage || "",
      value: savedProfile.value || "",
    };
    state.draft = saved?.draft || "";
    state.notes = saved?.notes || "";
    state.followUpAt = saved?.followUpAt || "";
    hydrateProfileFromContact();
  }

  async function persistLocalChatState() {
    if (!state.chatKey) return;
    const result = await chrome.storage.local.get(LOCAL_UI_STATE_KEY);
    const all = result[LOCAL_UI_STATE_KEY] || {};
    all[state.chatKey] = {
      profile: state.profile,
      draft: state.draft,
      notes: state.notes,
      followUpAt: state.followUpAt,
      updatedAt: new Date().toISOString(),
    };
    pruneLocalChatStates(all);
    await chrome.storage.local.set({ [LOCAL_UI_STATE_KEY]: all });
  }

  function pruneLocalChatStates(all) {
    const entries = Object.entries(all);
    if (entries.length <= MAX_LOCAL_CHAT_STATES) return;

    entries
      .sort((left, right) => new Date(left[1]?.updatedAt || 0) - new Date(right[1]?.updatedAt || 0))
      .slice(0, entries.length - MAX_LOCAL_CHAT_STATES)
      .forEach(([key]) => delete all[key]);
  }

  function schedulePersist() {
    window.clearTimeout(ui.saveTimer);
    ui.saveTimer = window.setTimeout(() => {
      void persistLocalChatState();
    }, 350);
  }

  async function loadRuntimeStatus() {
    const response = await sendRuntimeMessage({ type: "CRM_GET_STATUS" });
    if (!response.ok) return;
    state.authenticated = Boolean(response.data?.authenticated);
    state.stats = response.data?.stats || null;
    if (!state.authenticated) state.status = "unauthenticated";
    renderAll();
  }

  function applyChatState(detail) {
    const previousChatKey = state.chatKey;
    if (ui.approving && (detail.status === "monitoring_contact" || detail.status === "ignored_contact")) {
      ui.approving = false;
    }
    state.authenticated = Boolean(detail.authenticated);
    state.status = detail.status || (state.authenticated ? "no_chat" : "unauthenticated");
    state.chatKey = detail.chatKey || "";
    state.chatId = detail.chatId || "";
    state.title = detail.title || "";
    state.phone = detail.phone || "";
    state.source = detail.source || "";
    state.monitoring = Boolean(detail.monitoring);
    state.contact = detail.contact || null;
    state.lastError = detail.lastError || "";
    state.lastSyncAt = detail.lastSyncAt || "";

    if (state.chatKey && state.chatKey !== previousChatKey) {
      void loadLocalChatState(state.chatKey).finally(renderAll);
      return;
    }

    if (state.contact) hydrateProfileFromContact();
    renderAll();
  }

  function createSidebarShadow(host) {
    const shadow = host.attachShadow({ mode: "open" });
    shadow.addEventListener("click", handleSidebarClick);
    shadow.addEventListener("input", handleSidebarInput);
    shadow.addEventListener("change", handleSidebarInput);
    return shadow;
  }

  function createTopbarShadow(host) {
    const shadow = host.attachShadow({ mode: "open" });
    shadow.addEventListener("click", handleTopbarClick);
    return shadow;
  }

  function ensureSidebar() {
    const main = getMainPane();
    if (!main?.parentElement) return false;

    const parent = main.parentElement;
    let host = document.getElementById(SIDEBAR_HOST_ID);

    if (!host) {
      host = document.createElement("aside");
      host.id = SIDEBAR_HOST_ID;
      host.setAttribute("data-pipa-ui", "sidebar");
      parent.appendChild(host);
      ui.sidebarHost = host;
      ui.sidebarShadow = createSidebarShadow(host);
    } else if (!ui.sidebarShadow) {
      ui.sidebarHost = host;
      ui.sidebarShadow = host.shadowRoot || createSidebarShadow(host);
    }

    if (!getComputedStyle(parent).display.includes("flex")) {
      parent.style.display = "flex";
      parent.style.alignItems = "stretch";
    }

    main.style.minWidth = "0";
    if (!main.style.flex || main.style.flex === "0 1 auto") {
      main.style.flex = "1 1 auto";
    }

    Object.assign(host.style, {
      display: "block",
      flex: `0 0 ${SIDEBAR_WIDTH}px`,
      width: `${SIDEBAR_WIDTH}px`,
      minWidth: `${SIDEBAR_WIDTH}px`,
      maxWidth: `${SIDEBAR_WIDTH}px`,
      height: "100%",
      overflow: "hidden",
      position: "relative",
      zIndex: "9",
    });

    return true;
  }

  function ensureTopbar() {
    const pane = getPaneSide();
    if (!pane?.parentElement) return false;

    const parent = pane.parentElement;
    let host = document.getElementById(TOPBAR_HOST_ID);

    if (!host) {
      host = document.createElement("div");
      host.id = TOPBAR_HOST_ID;
      host.setAttribute("data-pipa-ui", "topbar");
      parent.insertBefore(host, pane);
      ui.topbarHost = host;
      ui.topbarShadow = createTopbarShadow(host);
    } else if (!ui.topbarShadow) {
      ui.topbarHost = host;
      ui.topbarShadow = host.shadowRoot || createTopbarShadow(host);
    }

    Object.assign(host.style, {
      display: "block",
      flex: "0 0 auto",
      width: "100%",
      position: "relative",
      zIndex: "5",
    });

    return true;
  }

  function sidebarStyles() {
    return `
      :host {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      .shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        border-left: 1px solid #d9dee3;
        background: #f7f8fa;
        color: #17212b;
      }
      .head {
        padding: 14px 14px 12px;
        border-bottom: 1px solid #e1e6ea;
        background: #fff;
      }
      .brand {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }
      .brand-title {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 9px;
      }
      .mark {
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        border-radius: 8px;
        background: #1f7a5c;
        color: #fff;
        font-weight: 800;
      }
      h2, h3, p { margin: 0; }
      h2 {
        overflow: hidden;
        color: #111827;
        font-size: 14px;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub {
        margin-top: 2px;
        color: #667085;
        font-size: 11px;
      }
      .badge {
        flex: 0 0 auto;
        padding: 5px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
      }
      .badge.ok { color: #0f6848; background: #dff7eb; }
      .badge.warn { color: #8a5700; background: #fff1cf; }
      .badge.error { color: #aa1e1e; background: #ffe1e1; }
      .badge.muted { color: #53606d; background: #edf1f4; }
      .status {
        display: grid;
        grid-template-columns: 8px 1fr;
        gap: 8px;
        align-items: start;
        min-height: 38px;
      }
      .dot {
        width: 8px;
        height: 8px;
        margin-top: 5px;
        border-radius: 50%;
        background: #98a2b3;
      }
      .dot.ok { background: #1f7a5c; }
      .dot.warn { background: #d99000; }
      .dot.error { background: #d92d20; }
      .status strong {
        display: block;
        color: #111827;
        font-size: 12px;
      }
      .status span {
        display: block;
        margin-top: 2px;
        color: #667085;
        font-size: 11px;
        line-height: 1.35;
      }
      .tabs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 8px;
        border-bottom: 1px solid #e1e6ea;
        background: #fff;
      }
      .tab {
        min-height: 32px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: #53606d;
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .tab[aria-selected="true"] {
        background: #e8f3ef;
        color: #115c43;
      }
      .body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 12px;
      }
      .section {
        display: grid;
        gap: 12px;
      }
      .panel {
        padding: 12px;
        border: 1px solid #e1e6ea;
        border-radius: 8px;
        background: #fff;
      }
      .panel-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      h3 {
        color: #111827;
        font-size: 13px;
      }
      label {
        display: grid;
        gap: 5px;
        margin-bottom: 10px;
        color: #53606d;
        font-size: 11px;
        font-weight: 700;
      }
      input, select, textarea {
        width: 100%;
        min-width: 0;
        border: 1px solid #d0d7de;
        border-radius: 7px;
        background: #fff;
        color: #17212b;
        font: inherit;
        font-size: 12px;
        outline: none;
      }
      input, select { height: 34px; padding: 0 9px; }
      textarea {
        min-height: 116px;
        resize: vertical;
        padding: 9px;
        line-height: 1.45;
      }
      input:focus, select:focus, textarea:focus {
        border-color: #1f7a5c;
        box-shadow: 0 0 0 3px rgba(31, 122, 92, 0.12);
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
      }
      button {
        min-height: 34px;
        border: 0;
        border-radius: 7px;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .primary {
        padding: 0 12px;
        color: #fff;
        background: #1f7a5c;
      }
      .secondary {
        padding: 0 12px;
        color: #174b39;
        background: #dff7eb;
      }
      .ghost {
        padding: 0 10px;
        border: 1px solid #d0d7de;
        color: #344054;
        background: #fff;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .empty {
        padding: 14px;
        border: 1px dashed #cbd5df;
        border-radius: 8px;
        color: #667085;
        background: #fbfcfd;
        font-size: 12px;
        line-height: 1.45;
      }
      .approve-panel {
        display: grid;
        gap: 10px;
        padding: 14px;
        border: 1px solid #cfe5d9;
        border-radius: 10px;
        background: #f1faf5;
      }
      .approve-panel h3 { color: #115c43; font-size: 13px; }
      .approve-panel p {
        margin: 0;
        color: #3a6b57;
        font-size: 12px;
        line-height: 1.45;
      }
      .approve-panel .primary { width: 100%; min-height: 38px; }
      .metric-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        padding: 7px 0;
        border-bottom: 1px solid #eef2f5;
        font-size: 12px;
      }
      .metric-row:last-child { border-bottom: 0; }
      .metric-row span { color: #667085; }
      .metric-row strong { color: #111827; }
      .footer {
        padding: 10px 12px;
        border-top: 1px solid #e1e6ea;
        background: #fff;
        color: #667085;
        font-size: 11px;
      }
    `;
  }

  function topbarStyles() {
    return `
      :host {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      .bar {
        display: grid;
        gap: 8px;
        padding: 10px 12px 8px;
        border-bottom: 1px solid #e6e8eb;
        background: #fff;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .title {
        color: #111827;
        font-size: 12px;
        font-weight: 800;
      }
      .sync {
        color: #667085;
        font-size: 11px;
      }
      .tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }
      button {
        min-height: 30px;
        min-width: 0;
        overflow: hidden;
        border: 1px solid #dce3e8;
        border-radius: 7px;
        background: #fff;
        color: #475467;
        font: inherit;
        font-size: 11px;
        font-weight: 800;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }
      button[aria-selected="true"] {
        border-color: #1f7a5c;
        color: #115c43;
        background: #e8f3ef;
      }
    `;
  }

  function renderSidebar() {
    if (!ui.sidebarShadow) return;
    const [kind, title, detail] = getStatusMeta();
    const chatTitle = state.title || "Nenhuma conversa";
    const phone = state.phone || "sem telefone";
    const profileDisabled = state.chatKey ? "" : "disabled";
    const hasDraft = Boolean(state.draft.trim());

    ui.sidebarShadow.innerHTML = `
      <style>${sidebarStyles()}</style>
      <aside class="shell">
        <header class="head">
          <div class="brand">
            <div class="brand-title">
              <div class="mark">P</div>
              <div>
                <h2 title="${escapeHtml(chatTitle)}">${escapeHtml(chatTitle)}</h2>
                <p class="sub">${escapeHtml(phone)}</p>
              </div>
            </div>
            <span class="badge ${kind}">${escapeHtml(state.source || "Pipa")}</span>
          </div>
          <div class="status">
            <span class="dot ${kind}"></span>
            <div>
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(state.lastError || detail)}</span>
            </div>
          </div>
        </header>

        <nav class="tabs" role="tablist" aria-label="Pipa Driven CRM">
          ${sidebarTabButton("profile", "Perfil")}
          ${sidebarTabButton("copilot", "IA")}
          ${sidebarTabButton("notes", "Notas")}
        </nav>

        <main class="body">
          ${renderActiveSidebarPanel(profileDisabled, hasDraft)}
        </main>

        <footer class="footer">
          ${escapeHtml(renderFooterText())}
        </footer>
      </aside>
    `;
  }

  function sidebarTabButton(id, label) {
    return `
      <button class="tab" type="button" data-tab="${id}" role="tab" aria-selected="${ui.activeSidebarTab === id}">
        ${escapeHtml(label)}
      </button>
    `;
  }

  function renderActiveSidebarPanel(profileDisabled, hasDraft) {
    if (ui.activeSidebarTab === "copilot") return renderCopilotPanel(hasDraft);
    if (ui.activeSidebarTab === "notes") return renderNotesPanel(profileDisabled);
    return renderProfilePanel(profileDisabled);
  }

  function canApproveCurrentChat() {
    if (!state.authenticated) return false;
    if (state.monitoring) return false;
    if (!state.phone) return false;
    if (state.status === "group_ignored" || state.status === "missing_phone") return false;
    return state.status === "ignored_contact";
  }

  function renderApprovePanel() {
    if (!canApproveCurrentChat()) return "";
    const busy = ui.approving;
    const label = busy ? "Adicionando..." : "Adicionar ao CRM";
    const disabled = busy ? "disabled" : "";
    const phone = state.phone || "—";
    return `
      <div class="approve-panel">
        <h3>Começar a espelhar esta conversa</h3>
        <p>
          O número <strong>${escapeHtml(phone)}</strong> ainda não está no CRM.
          Ao adicionar, a conversa passa a ser espelhada em tempo real.
        </p>
        <button class="primary" type="button" data-action="approve-contact" ${disabled}>${escapeHtml(label)}</button>
        ${state.lastError ? `<p style="color:#aa1e1e;">${escapeHtml(state.lastError)}</p>` : ""}
      </div>
    `;
  }

  function renderProfilePanel(profileDisabled) {
    return `
      <section class="section">
        ${renderApprovePanel()}
        <div class="panel">
          <div class="panel-title">
            <h3>Perfil do lead</h3>
            <button class="ghost" type="button" data-action="refresh-status">Atualizar</button>
          </div>
          <label>
            Nome
            <input ${profileDisabled} data-field="profile.name" value="${escapeHtml(state.profile.name)}" placeholder="Nome do contato" />
          </label>
          <label>
            Empresa
            <input ${profileDisabled} data-field="profile.company" value="${escapeHtml(state.profile.company)}" placeholder="Empresa" />
          </label>
          <div class="grid-2">
            <label>
              Estagio
              <select ${profileDisabled} data-field="profile.stage">
                ${stageOption("pre-venda", "Pre-venda")}
                ${stageOption("comercial", "Comercial")}
                ${stageOption("negociacao", "Negociacao")}
                ${stageOption("fechado", "Fechado")}
                ${stageOption("pos-venda", "Pos-venda")}
              </select>
            </label>
            <label>
              Valor
              <input ${profileDisabled} data-field="profile.value" value="${escapeHtml(formatMoney(state.profile.value))}" placeholder="R$ 0,00" />
            </label>
          </div>
          <div class="actions">
            <button class="secondary" type="button" data-action="save-local" ${profileDisabled}>Salvar</button>
          </div>
        </div>

        <div class="panel">
          <h3>Resumo operacional</h3>
          ${metricRow("Consultas", state.stats?.lookups || 0)}
          ${metricRow("Elegiveis", state.stats?.eligible || 0)}
          ${metricRow("Ignorados", state.stats?.ignored || 0)}
          ${metricRow("Sincronizadas", state.stats?.synced || 0)}
        </div>
      </section>
    `;
  }

  function renderCopilotPanel(hasDraft) {
    const canSendViaWpp = state.monitoring && Boolean(state.chatId || state.chatKey.startsWith("wa:"));
    const disabled = canSendViaWpp ? "" : "disabled";
    return `
      <section class="section">
        <div class="panel">
          <div class="panel-title">
            <h3>IA Copilot</h3>
            <button class="ghost" type="button" data-action="make-draft" ${disabled}>Sugerir</button>
          </div>
          ${
            hasDraft
              ? `<textarea data-field="draft">${escapeHtml(state.draft)}</textarea>`
              : `<div class="empty">Nenhum rascunho gerado para esta conversa ainda.</div>`
          }
          <div class="actions" style="margin-top: 10px;">
            <button class="ghost" type="button" data-action="make-draft" ${disabled}>Refazer</button>
            <button class="primary" type="button" data-action="insert-and-send" ${hasDraft && canSendViaWpp ? "" : "disabled"}>Inserir e enviar</button>
          </div>
        </div>
      </section>
    `;
  }

  function renderNotesPanel(profileDisabled) {
    return `
      <section class="section">
        <div class="panel">
          <div class="panel-title">
            <h3>Notas internas</h3>
            <button class="ghost" type="button" data-action="clear-notes" ${profileDisabled}>Limpar</button>
          </div>
          <textarea ${profileDisabled} data-field="notes" placeholder="Observacoes que nao vao para o WhatsApp">${escapeHtml(state.notes)}</textarea>
        </div>
        <div class="panel">
          <h3>Follow-up</h3>
          <label>
            Lembrar em
            <input ${profileDisabled} type="datetime-local" data-field="followUpAt" value="${escapeHtml(state.followUpAt)}" />
          </label>
          <div class="actions">
            <button class="secondary" type="button" data-action="save-local" ${profileDisabled}>Agendar</button>
          </div>
        </div>
      </section>
    `;
  }

  function stageOption(value, label) {
    const selectedStage = state.profile.stage || "pre-venda";
    return `<option value="${escapeHtml(value)}" ${selectedStage === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function metricRow(label, value) {
    return `<div class="metric-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function renderFooterText() {
    if (!state.authenticated) return "Conecte o CRM no popup para ativar a extensao.";
    if (!state.chatKey) return "Aguardando uma conversa aberta.";
    if (state.monitoring) return "Monitorando apenas mensagens novas desta conversa.";
    return "Aguardando aprovacao do CRM para espelhar.";
  }

  function renderTopbar() {
    if (!ui.topbarShadow) return;
    const synced = state.stats?.synced || 0;
    const ignored = state.stats?.ignored || 0;
    ui.topbarShadow.innerHTML = `
      <style>${topbarStyles()}</style>
      <section class="bar">
        <div class="row">
          <span class="title">Pipa Driven</span>
          <span class="sync">${escapeHtml(synced)} sync · ${escapeHtml(ignored)} ignorados</span>
        </div>
        <nav class="tabs" role="tablist" aria-label="Filtros Pipa">
          ${topbarTab("inbox", "Inbox")}
          ${topbarTab("waiting", "Aguardando")}
          ${topbarTab("hot", "Hot Leads")}
          ${topbarTab("closed", "Fechados")}
        </nav>
      </section>
    `;
  }

  function topbarTab(id, label) {
    return `<button type="button" data-inbox-tab="${id}" role="tab" aria-selected="${ui.activeInboxTab === id}">${escapeHtml(label)}</button>`;
  }

  function renderAll() {
    if (isEditingInsideSidebar()) {
      renderTopbar();
      return;
    }
    renderSidebar();
    renderTopbar();
  }

  function isEditingInsideSidebar() {
    const active = ui.sidebarShadow?.activeElement;
    return Boolean(active?.matches?.("input, textarea, select"));
  }

  function setDeepField(path, value) {
    if (path === "draft") state.draft = value;
    if (path === "notes") state.notes = value;
    if (path === "followUpAt") state.followUpAt = value;
    if (path === "profile.name") state.profile.name = value;
    if (path === "profile.company") state.profile.company = value;
    if (path === "profile.stage") state.profile.stage = value;
    if (path === "profile.value") state.profile.value = value;
  }

  function handleSidebarInput(event) {
    const field = event.target?.getAttribute?.("data-field");
    if (!field) return;
    setDeepField(field, event.target.value);
    schedulePersist();
  }

  function handleSidebarClick(event) {
    const tab = event.target?.closest?.("[data-tab]")?.getAttribute("data-tab");
    if (tab) {
      ui.activeSidebarTab = tab;
      renderSidebar();
      return;
    }

    const action = event.target?.closest?.("[data-action]")?.getAttribute("data-action");
    if (!action) return;

    if (action === "refresh-status") {
      void loadRuntimeStatus();
      return;
    }
    if (action === "approve-contact") {
      if (ui.approving || !canApproveCurrentChat()) return;
      ui.approving = true;
      renderSidebar();
      window.dispatchEvent(new CustomEvent("pipa:approve-contact", {
        detail: {
          chatKey: state.chatKey,
          chatId: state.chatId,
          phone: state.phone,
          chatTitle: state.title,
          pushName: state.title,
        },
      }));
      window.setTimeout(() => {
        ui.approving = false;
        renderSidebar();
      }, 8000);
      return;
    }
    if (action === "save-local") {
      void persistLocalChatState().then(renderSidebar);
      return;
    }
    if (action === "clear-notes") {
      state.notes = "";
      schedulePersist();
      renderSidebar();
      return;
    }
    const canSendViaWpp = state.monitoring && Boolean(state.chatId || state.chatKey.startsWith("wa:"));

    if (action === "make-draft" && canSendViaWpp) {
      state.draft = buildLocalDraft();
      schedulePersist();
      renderSidebar();
      return;
    }
    if (action === "insert-and-send" && canSendViaWpp) {
      void insertDraftIntoWhatsApp(true);
    }
  }

  function handleTopbarClick(event) {
    const tab = event.target?.closest?.("[data-inbox-tab]")?.getAttribute("data-inbox-tab");
    if (!tab) return;
    ui.activeInboxTab = tab;
    renderTopbar();
  }

  function buildLocalDraft() {
    const name = state.profile.name || state.title || "tudo bem";
    const stage = state.profile.stage || "pre-venda";
    if (stage === "negociacao") {
      return `Oi, ${name}. Passei para alinhar os proximos passos e tirar qualquer duvida antes de avancarmos. Faz sentido seguirmos por aqui?`;
    }
    if (stage === "fechado" || stage === "pos-venda") {
      return `Oi, ${name}. Estou passando para confirmar se esta tudo certo por ai e se posso ajudar em algo.`;
    }
    return `Oi, ${name}. Vi sua mensagem e posso te ajudar por aqui. Me conta rapidinho qual e o principal objetivo agora?`;
  }

  async function insertDraftIntoWhatsApp(shouldSend) {
    const text = state.draft.trim();
    if (!text) return;
    if (!shouldSend) return;

    const bridge = window.PipaWaBridge;
    const chatId = state.chatId || (state.chatKey.startsWith("wa:") ? state.chatKey.slice(3) : "");
    if (!bridge?.sendTextMessage || !chatId) {
      state.lastError = "Envio via WPP indisponivel para esta conversa.";
      state.status = "sync_failed";
      renderSidebar();
      return;
    }

    try {
      bridge.injectScript?.();
      await bridge.whenReady?.(10000);
      await new Promise((resolve) => window.setTimeout(resolve, 1200 + Math.round(Math.random() * 900)));
      await bridge.sendTextMessage(chatId, text);
      state.draft = "";
      state.lastError = "";
      state.status = "message_synced";
      schedulePersist();
      renderSidebar();
    } catch (error) {
      state.lastError = error?.message || String(error);
      state.status = "sync_failed";
      renderSidebar();
    }
  }

  function ensureLayout() {
    const sidebarReady = ensureSidebar();
    const topbarReady = ensureTopbar();
    if (sidebarReady || topbarReady) renderAll();
  }

  function startLayoutObserver() {
    const observer = new MutationObserver(() => {
      window.clearTimeout(ui.layoutTimer);
      ui.layoutTimer = window.setTimeout(ensureLayout, 250);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ensureLayout();
  }

  window.addEventListener("pipa:crm-state", (event) => {
    applyChatState(event.detail || {});
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.pipa_crm_stats_v1) {
      state.stats = changes.pipa_crm_stats_v1.newValue || null;
      renderAll();
    }
  });

  startLayoutObserver();
  void loadRuntimeStatus();
  ui.statusTimer = window.setInterval(loadRuntimeStatus, 5000);
})();
