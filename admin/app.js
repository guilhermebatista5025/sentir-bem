"use strict";

const API = "/api/admin";
const state = {
  sessions: [],
  patients: [],
  appointments: [],
  conversations: [],
  conversationMessages: [],
  selectedConversationId: null,
  conversationFilter: "all",
  conversationSignature: "",
  config: {},
  services: [],
  periods: [],
  startMessages: [],
  startKeywords: [],
  selectedDate: isoDate(new Date()),
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  zoom: 1,
  editingField: null,
  loading: false,
  status: "",
  toastTimer: null,
  logStream: null
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindNavigation();
  bindInterface();
  bindConversationInterface();
  bindConfiguration();
  bindModals();
  openInitialView();
  renderCalendar();
  loadConfig();
  refreshAll();
  refreshConversations();
  checkStatus();
  checkHealth();
  startLogs();
  setInterval(checkStatus, 5000);
  setInterval(refreshAll, 12000);
  setInterval(() => refreshConversations(true), 8000);
  setInterval(checkHealth, 30000);
  setInterval(() => setText("overview-clock", formatTime(new Date())), 1000);
}

function bindNavigation() {
  document.querySelectorAll("[data-view], [data-view-link]").forEach((element) => {
    element.addEventListener("click", () => showView(element.dataset.view || element.dataset.viewLink));
  });
  document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  window.addEventListener("hashchange", openInitialView);
}

function openInitialView() {
  const view = location.hash.replace("#", "");
  showView(document.getElementById(`view-${view}`) ? view : "chatbot", false);
}

function showView(name, updateHash = true) {
  const target = document.getElementById(`view-${name}`);
  if (!target) return;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view === target));
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  document.getElementById("sidebar").classList.remove("open");
  document.title = `${target.dataset.title} — Sentir Bem`;
  if (updateHash && location.hash !== `#${name}`) history.pushState(null, "", `#${name}`);
  document.getElementById("global-search").value = "";
  applySearch("");
  if (name === "conversations") refreshConversations(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindInterface() {
  document.querySelectorAll(".refresh-data").forEach((button) => button.addEventListener("click", () => refreshAll(true)));
  document.getElementById("dismiss-safety").addEventListener("click", () => document.getElementById("safety-banner").hidden = true);
  document.getElementById("global-search").addEventListener("input", (event) => applySearch(event.target.value));
  document.getElementById("appointment-filter").addEventListener("change", renderAppointments);
  document.getElementById("prev-month").addEventListener("click", () => changeMonth(-1));
  document.getElementById("next-month").addEventListener("click", () => changeMonth(1));
  document.getElementById("clear-appointments").addEventListener("click", clearAppointments);
  document.getElementById("disconnect-whatsapp").addEventListener("click", disconnectWhatsApp);
  document.getElementById("clear-logs").addEventListener("click", () => {
    document.getElementById("logs-output").replaceChildren();
    appendLog({ type: "info", timestamp: new Date().toISOString(), message: "Console limpo pelo administrador." });
  });
  document.getElementById("notifications-button").addEventListener("click", () => {
    showView("agenda");
    document.getElementById("notification-count").hidden = true;
  });
  document.getElementById("help-button").addEventListener("click", () => toast("Use o menu lateral para acessar cada área. As alterações do bot só são aplicadas ao clicar em Publicar ou Salvar."));
  document.getElementById("logout-panel").addEventListener("click", () => {
    if (confirm("Deseja sair do painel administrativo?")) location.replace("/");
  });
  document.getElementById("test-chatbot").addEventListener("click", () => window.open("/?chatbot=open", "sentir-bem-chatbot", "noopener,noreferrer"));
  document.querySelectorAll("[data-zoom]").forEach((button) => button.addEventListener("click", () => zoomFlow(button.dataset.zoom)));
  document.addEventListener("click", handleDelegatedClick);
}

function bindConversationInterface() {
  document.getElementById("conversation-search").addEventListener("input", renderConversationList);
  document.querySelectorAll("[data-conversation-filter]").forEach((button) => button.addEventListener("click", () => {
    state.conversationFilter = button.dataset.conversationFilter;
    document.querySelectorAll("[data-conversation-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderConversationList();
  }));
  document.getElementById("chat-back").addEventListener("click", () => document.querySelector(".conversation-workspace").classList.remove("chat-open"));
  document.getElementById("takeover-chat").addEventListener("click", () => setConversationMode("human"));
  document.getElementById("return-chat-bot").addEventListener("click", () => setConversationMode("bot"));
  document.getElementById("chat-composer").addEventListener("submit", sendConversationMessage);
  const input = document.getElementById("chat-message-input");
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(120, input.scrollHeight)}px`;
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      document.getElementById("chat-composer").requestSubmit();
    }
  });
  document.querySelectorAll("[data-quick-reply]").forEach((button) => button.addEventListener("click", () => {
    input.value = button.dataset.quickReply;
    input.focus();
    input.dispatchEvent(new Event("input"));
  }));
  document.getElementById("emoji-button").addEventListener("click", () => {
    const start = input.selectionStart;
    input.setRangeText("🙂", start, input.selectionEnd, "end");
    input.focus();
    input.dispatchEvent(new Event("input"));
  });
}

function bindConfiguration() {
  document.getElementById("config-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveConfig();
  });
  document.getElementById("publish-config").addEventListener("click", saveConfig);
  document.getElementById("add-service").addEventListener("click", () => addCollectionItem("service"));
  document.getElementById("add-period").addEventListener("click", () => addCollectionItem("period"));
  document.getElementById("add-start-message").addEventListener("click", () => addCollectionItem("start"));
  document.getElementById("add-start-keyword").addEventListener("click", () => addCollectionItem("keyword"));
  document.getElementById("new-service").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addCollectionItem("service"); }
  });
  document.getElementById("new-period").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addCollectionItem("period"); }
  });
  document.getElementById("new-start-message").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addCollectionItem("start"); }
  });
  document.getElementById("new-start-keyword").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addCollectionItem("keyword"); }
  });
  ["toggle-active", "toggle-after-hours", "toggle-reminder"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => toast("Alteração pronta para publicar."));
  });
}

function bindModals() {
  document.querySelectorAll(".close-modal").forEach((button) => button.addEventListener("click", () => closeModal("edit-modal")));
  document.querySelectorAll(".close-details").forEach((button) => button.addEventListener("click", () => closeModal("details-modal")));
  document.getElementById("apply-block-edit").addEventListener("click", applyBlockEdit);
  document.querySelectorAll(".modal").forEach((modal) => modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.hidden = true;
  }));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelectorAll(".modal").forEach((modal) => { modal.hidden = true; });
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : { error: await response.text() };
  if (!response.ok) throw new Error(data.error || data.message || `Erro HTTP ${response.status}`);
  return data;
}

async function refreshAll(notify = false) {
  if (state.loading) return;
  state.loading = true;
  try {
    const [sessions, patients, appointments] = await Promise.all([
      api("/sessions"), api("/clients"), api("/appointments")
    ]);
    const oldCount = state.appointments.length;
    state.sessions = Array.isArray(sessions) ? sessions.map(normalizeSession) : [];
    state.patients = Array.isArray(patients) ? patients.map(normalizePatient) : [];
    state.appointments = Array.isArray(appointments) ? appointments.map(normalizeAppointment) : [];
    renderAllData();
    if (oldCount && state.appointments.length > oldCount) showNotification(state.appointments.length - oldCount);
    if (notify) toast("Dados atualizados com sucesso.");
  } catch (error) {
    if (notify) toast(error.message || "Não foi possível atualizar os dados.", true);
  } finally {
    state.loading = false;
  }
}

async function refreshConversations(refreshSelected = false) {
  try {
    const conversations = await api("/conversations");
    state.conversations = Array.isArray(conversations) ? conversations.map(normalizeConversation) : [];
    renderConversationList();
    const unread = state.conversations.reduce((total, item) => total + item.unreadCount, 0);
    setText("conversations-badge", unread);
    if (state.selectedConversationId) {
      const selected = state.conversations.find((item) => item.id === state.selectedConversationId);
      if (!selected) clearSelectedConversation();
      else {
        updateConversationHeader(selected);
        if (refreshSelected) await loadConversationMessages(true);
      }
    }
  } catch (error) {
    state.conversations = [];
    setText("conversations-badge", 0);
    renderConversationList(error.message || "Conecte o WhatsApp para carregar as conversas.");
    if (state.selectedConversationId) clearSelectedConversation();
  }
}

function renderConversationList(errorMessage = "") {
  const container = document.getElementById("conversation-list");
  const query = normalizeText(document.getElementById("conversation-search").value);
  const filtered = state.conversations.filter((conversation) => {
    if (state.conversationFilter === "unread" && conversation.unreadCount < 1) return false;
    return !query || normalizeText(`${conversation.name} ${conversation.phone} ${conversation.lastMessage?.body || ""}`).includes(query);
  });
  container.replaceChildren();
  if (!filtered.length) {
    const empty = create("div", "conversation-empty");
    empty.append(create("span", "material-symbols-outlined", errorMessage ? "link_off" : "forum"), create("p", "", errorMessage || "Nenhuma conversa encontrada."));
    container.append(empty);
    return;
  }
  filtered.forEach((conversation) => {
    const button = create("button", `conversation-item${conversation.id === state.selectedConversationId ? " active" : ""}`);
    button.type = "button";
    button.dataset.conversationId = conversation.id;
    const avatar = create("span", "contact-avatar", initials(conversation.name));
    const copy = create("span", "conversation-item-copy");
    const title = create("span", "conversation-item-title");
    title.append(create("strong", "", conversation.name), create("time", "", conversationListTime(conversation.timestamp)));
    const preview = create("span", "conversation-item-preview");
    preview.append(create("span", "", conversationPreview(conversation)));
    if (conversation.unreadCount) preview.append(create("b", "conversation-unread", conversation.unreadCount));
    copy.append(title, preview, create("span", `conversation-mode ${conversation.mode}`, conversation.mode === "human" ? "Atendimento humano" : "Chatbot"));
    button.append(avatar, copy);
    button.addEventListener("click", () => selectConversation(conversation.id));
    container.append(button);
  });
}

async function selectConversation(id) {
  state.selectedConversationId = id;
  state.conversationSignature = "";
  document.querySelector(".conversation-workspace").classList.add("chat-open");
  document.getElementById("chat-placeholder").hidden = true;
  document.getElementById("chat-content").hidden = false;
  document.getElementById("profile-content").hidden = false;
  document.querySelector(".profile-empty").hidden = true;
  renderConversationList();
  updateConversationHeader(state.conversations.find((item) => item.id === id));
  const messages = document.getElementById("chat-messages");
  messages.replaceChildren(emptyNode("Carregando mensagens…"));
  await loadConversationMessages();
}

async function loadConversationMessages(silent = false) {
  if (!state.selectedConversationId) return;
  const selectedId = state.selectedConversationId;
  try {
    const data = await api(`/conversations/${encodeURIComponent(selectedId)}/messages?limit=100`);
    if (selectedId !== state.selectedConversationId) return;
    const conversation = normalizeConversation(data.conversation || {});
    const index = state.conversations.findIndex((item) => item.id === selectedId);
    if (index >= 0) state.conversations[index] = conversation;
    state.conversationMessages = Array.isArray(data.messages) ? data.messages.map(normalizeConversationMessage) : [];
    const signature = state.conversationMessages.map((item) => item.id).join("|");
    if (signature !== state.conversationSignature) {
      state.conversationSignature = signature;
      renderConversationMessages();
    }
    updateConversationHeader(conversation);
  } catch (error) {
    if (!silent) {
      document.getElementById("chat-messages").replaceChildren(emptyNode(error.message || "Não foi possível carregar as mensagens."));
      toast(error.message || "Não foi possível carregar as mensagens.", true);
    }
  }
}

function renderConversationMessages() {
  const container = document.getElementById("chat-messages");
  container.replaceChildren();
  if (!state.conversationMessages.length) {
    container.append(emptyNode("Esta conversa ainda não possui mensagens disponíveis."));
    return;
  }
  let lastDay = "";
  state.conversationMessages.forEach((message) => {
    const day = formatMessageDay(message.timestamp);
    if (day !== lastDay) {
      container.append(create("div", "chat-day", day));
      lastDay = day;
    }
    const article = create("article", `chat-message ${message.fromMe ? "outgoing" : "incoming"}`);
    const bubble = create("div", "message-bubble");
    if (message.body) bubble.append(create("div", "", message.body));
    if (message.hasMedia) bubble.append(createMessageAttachment(message));
    if (!message.body && !message.hasMedia) bubble.append(create("div", "", messageTypeLabel(message.type)));
    const meta = create("span", "message-meta");
    meta.append(document.createTextNode(formatTime(message.timestamp)));
    if (message.fromMe) meta.append(create("span", "material-symbols-outlined", message.ack >= 2 ? "done_all" : "done"));
    article.append(bubble, meta);
    container.append(article);
  });
  requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
}

function createMessageAttachment(message) {
  const attachment = create("div", "message-attachment");
  attachment.append(create("span", "material-symbols-outlined", attachmentIcon(message.type)));
  const copy = create("span");
  copy.append(create("strong", "", message.mediaName || messageTypeLabel(message.type)), create("small", "", message.mediaType || "Anexo do WhatsApp"));
  const link = create("a");
  link.href = `${API}/messages/media?id=${encodeURIComponent(message.id)}`;
  link.setAttribute("download", message.mediaName || "anexo");
  link.setAttribute("aria-label", "Baixar anexo");
  link.append(create("span", "material-symbols-outlined", "download"));
  attachment.append(copy, link);
  return attachment;
}

function updateConversationHeader(conversation) {
  if (!conversation) return;
  const name = conversation.name || "Contato";
  const avatar = initials(name);
  setText("chat-avatar", avatar);
  setText("profile-avatar", avatar);
  setText("chat-name", name);
  setText("profile-name", name);
  setText("chat-phone", formatPhone(conversation.phone));
  setText("profile-phone", formatPhone(conversation.phone));
  setText("profile-status", conversation.isBusiness ? "Conta comercial do WhatsApp" : "Contato do WhatsApp");
  const human = conversation.mode === "human";
  setText("chat-mode-label", human ? "Atendimento humano" : "Chatbot ativo");
  setText("profile-mode", human ? "Equipe humana" : "Chatbot");
  document.getElementById("takeover-chat").hidden = human;
  document.getElementById("return-chat-bot").hidden = !human;
  const digits = String(conversation.phone).replace(/\D/g, "");
  document.getElementById("profile-call").href = digits ? `tel:+${digits.startsWith("55") ? digits : `55${digits}`}` : "#";
  const appointment = findNextAppointment(conversation.phone);
  setText("profile-appointment", appointment ? `${appointment.dayLabel || formatDateOnly(appointment.date)} · ${appointment.period || "a confirmar"}` : "Não agendado");
}

async function setConversationMode(mode) {
  const id = state.selectedConversationId;
  if (!id) return;
  const label = mode === "human" ? "assumir este atendimento e pausar o bot" : "devolver esta conversa ao bot";
  if (!confirm(`Deseja ${label}?`)) return;
  try {
    await api(`/conversations/${encodeURIComponent(id)}/mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    const conversation = state.conversations.find((item) => item.id === id);
    if (conversation) conversation.mode = mode;
    updateConversationHeader(conversation);
    renderConversationList();
    toast(mode === "human" ? "Atendimento assumido pela equipe." : "Conversa devolvida ao chatbot.");
  } catch (error) { toast(error.message, true); }
}

async function sendConversationMessage(event) {
  event.preventDefault();
  const id = state.selectedConversationId;
  const input = document.getElementById("chat-message-input");
  const text = input.value.trim();
  if (!id || !text) return;
  const button = document.getElementById("chat-send");
  button.disabled = true;
  try {
    const data = await api(`/conversations/${encodeURIComponent(id)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    input.value = "";
    input.style.height = "auto";
    const conversation = state.conversations.find((item) => item.id === id);
    if (conversation) {
      conversation.mode = "human";
      conversation.lastMessage = normalizeConversationMessage(data.message || {});
      conversation.timestamp = conversation.lastMessage.timestamp;
    }
    state.conversationMessages.push(normalizeConversationMessage(data.message || { body: text, fromMe: true, timestamp: new Date().toISOString() }));
    state.conversationSignature = state.conversationMessages.map((item) => item.id).join("|");
    renderConversationMessages();
    renderConversationList();
    updateConversationHeader(conversation);
  } catch (error) { toast(error.message || "Não foi possível enviar a mensagem.", true); }
  finally { button.disabled = false; input.focus(); }
}

function clearSelectedConversation() {
  state.selectedConversationId = null;
  state.conversationMessages = [];
  state.conversationSignature = "";
  document.getElementById("chat-placeholder").hidden = false;
  document.getElementById("chat-content").hidden = true;
  document.getElementById("profile-content").hidden = true;
  document.querySelector(".profile-empty").hidden = false;
  document.querySelector(".conversation-workspace").classList.remove("chat-open");
}

function renderAllData() {
  renderMetrics();
  renderRecentActivity();
  renderSessions();
  renderPatients();
  renderAppointments();
  renderCalendar();
  renderDayAppointments();
  renderFinance();
  const now = formatTime(new Date());
  setText("chatbot-sync", now);
}

function renderMetrics() {
  const completed = state.appointments.filter((item) => ["Confirmado", "Concluído"].includes(item.status)).length;
  const rate = state.appointments.length ? Math.round((completed / state.appointments.length) * 100) : 0;
  const values = {
    "overview-sessions": state.sessions.length,
    "overview-appointments": state.appointments.length,
    "overview-patients": state.patients.length,
    "chatbot-conversations": state.sessions.length,
    "chatbot-appointments": state.appointments.length,
    "chatbot-resolution": `${rate}%`,
    "agenda-badge": state.appointments.length,
    "sessions-badge": state.sessions.length,
    "active-session-count": `${state.sessions.length} ativa${state.sessions.length === 1 ? "" : "s"}`,
    "patient-count": `${state.patients.length} paciente${state.patients.length === 1 ? "" : "s"}`
  };
  Object.entries(values).forEach(([id, value]) => setText(id, value));
}

function renderRecentActivity() {
  const container = document.getElementById("recent-activity");
  const activities = [
    ...state.sessions.map((item) => ({ type: "session", title: displayName(item), text: `Conversa em ${stageLabel(item.stage)}`, timestamp: item.timestamp })),
    ...state.appointments.map((item) => ({ type: "event", title: displayName(item), text: item.service || "Solicitação de atendimento", timestamp: item.timestamp }))
  ].sort((a, b) => dateValue(b.timestamp) - dateValue(a.timestamp)).slice(0, 7);
  container.replaceChildren();
  if (!activities.length) return container.append(emptyNode("Nenhuma atividade registrada."));
  activities.forEach((activity) => {
    const row = create("div", "activity-item searchable");
    const icon = create("span", "material-symbols-outlined", activity.type === "session" ? "forum" : "event_available");
    const copy = create("div");
    copy.append(create("strong", "", activity.title), create("small", "", activity.text));
    row.append(icon, copy, create("time", "", relativeTime(activity.timestamp)));
    container.append(row);
  });
}

function renderSessions() {
  const body = document.getElementById("sessions-body");
  body.replaceChildren();
  if (!state.sessions.length) return body.append(emptyRow(5, "Nenhuma conversa ativa no momento."));
  state.sessions.forEach((session) => {
    const row = create("tr", "searchable");
    row.append(
      tablePerson(displayName(session), formatPhone(session.phone)),
      cellWith(statusBadge(stageLabel(session.stage))),
      create("td", "", session.service || "Aguardando escolha"),
      create("td", "", formatDateTime(session.timestamp)),
      actionCell([
        actionButton("Detalhes", "details", session.phone),
        actionButton("Reiniciar", "reset-session", session.phone, true)
      ])
    );
    body.append(row);
  });
}

function renderPatients() {
  const body = document.getElementById("patients-body");
  body.replaceChildren();
  if (!state.patients.length) return body.append(emptyRow(5, "Nenhum paciente cadastrado."));
  state.patients.forEach((patient) => {
    const row = create("tr", "searchable");
    row.append(
      create("td", "table-primary", patient.name || "Paciente"),
      create("td", "", formatPhone(patient.phone)),
      create("td", "", patient.consent ? formatDateTime(patient.consent) : "Não informado"),
      create("td", "", formatDateTime(patient.timestamp)),
      actionCell([actionButton("Excluir", "delete-patient", patient.phone, true)])
    );
    body.append(row);
  });
}

function renderAppointments() {
  const body = document.getElementById("appointments-body");
  const filter = document.getElementById("appointment-filter").value;
  const appointments = filter ? state.appointments.filter((item) => item.status === filter) : state.appointments;
  body.replaceChildren();
  if (!appointments.length) return body.append(emptyRow(5, "Nenhum agendamento encontrado."));
  appointments.forEach((item) => {
    const row = create("tr", "searchable");
    const date = item.dayLabel || (item.date ? formatDateOnly(item.date) : "Data a confirmar");
    row.append(
      tablePerson(displayName(item), formatPhone(item.phone)),
      create("td", "", item.service || "Não informado"),
      tablePerson(date, item.period || "Período a confirmar"),
      cellWith(statusBadge(item.status)),
      actionCell([
        actionButton("Detalhes", "details-appointment", item.id),
        actionButton("Avançar", "advance-appointment", item.id)
      ])
    );
    body.append(row);
  });
}

function renderFinance() {
  const values = state.appointments.map((item) => item.value).filter((value) => Number.isFinite(value) && value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  setText("finance-total", money(total));
  setText("finance-paid-count", values.length);
  setText("finance-average", money(values.length ? total / values.length : 0));
  const body = document.getElementById("finance-body");
  body.replaceChildren();
  if (!state.appointments.length) return body.append(emptyRow(5, "Nenhum lançamento disponível."));
  state.appointments.forEach((item) => {
    const row = create("tr", "searchable");
    row.append(
      tablePerson(displayName(item), formatPhone(item.phone)),
      create("td", "", item.service || "Não informado"),
      cellWith(statusBadge(item.status)),
      create("td", "", item.payment || "A combinar"),
      create("td", "table-primary", item.value > 0 ? money(item.value) : "Não informado")
    );
    body.append(row);
  });
}

function changeMonth(offset) {
  state.calendarMonth += offset;
  if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear -= 1; }
  if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear += 1; }
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const monthDate = new Date(state.calendarYear, state.calendarMonth, 1);
  document.getElementById("calendar-label").textContent = titleCase(monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
  grid.replaceChildren();
  const firstWeekday = monthDate.getDay();
  const totalDays = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  const previousDays = new Date(state.calendarYear, state.calendarMonth, 0).getDate();
  for (let index = firstWeekday - 1; index >= 0; index -= 1) grid.append(calendarButton(previousDays - index, "", true));
  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${state.calendarYear}-${String(state.calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    grid.append(calendarButton(day, date, false));
  }
  const used = firstWeekday + totalDays;
  for (let day = 1; day <= (7 - used % 7) % 7; day += 1) grid.append(calendarButton(day, "", true));
}

function calendarButton(day, date, muted) {
  const button = create("button", `calendar-day${muted ? " muted" : ""}`, day);
  button.type = "button";
  if (muted) { button.disabled = true; return button; }
  if (date === isoDate(new Date())) button.classList.add("today");
  if (date === state.selectedDate) button.classList.add("selected");
  if (state.appointments.some((item) => item.date === date)) button.classList.add("has-events");
  button.addEventListener("click", () => {
    state.selectedDate = date;
    renderCalendar();
    renderDayAppointments();
  });
  return button;
}

function renderDayAppointments() {
  const container = document.getElementById("day-appointments");
  const date = parseIsoDate(state.selectedDate);
  document.getElementById("selected-day-label").textContent = titleCase(date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  const items = state.appointments.filter((item) => item.date === state.selectedDate);
  container.replaceChildren();
  if (!items.length) return container.append(emptyNode("Nenhum atendimento para esta data."));
  items.forEach((item) => {
    const article = create("article", "appointment-item searchable");
    const header = create("header");
    header.append(create("strong", "", displayName(item)), statusBadge(item.status));
    article.append(header, create("p", "", `${item.service || "Atendimento"} • ${item.period || "Período a confirmar"}`));
    article.addEventListener("click", () => openAppointmentDetails(item));
    container.append(article);
  });
}

async function loadConfig() {
  try {
    state.config = await api("/config");
    state.services = normalizeCollection(state.config.servicos);
    state.periods = normalizeCollection(state.config.periodos);
    state.startMessages = normalizeCollection(state.config.mensagensInicio);
    state.startKeywords = normalizeCollection(state.config.palavrasInicio);
    fillConfigForm();
    renderConfigPreview();
  } catch (error) {
    toast("Não foi possível carregar as configurações do chatbot.", true);
  }
}

function fillConfigForm() {
  const values = {
    "config-company": state.config.nomeEmpresa,
    "config-assistant": state.config.nomeAssistente,
    "config-professional": state.config.profissional,
    "config-crp": state.config.crp,
    "config-welcome": state.config.mensagemInicial || state.config.saudacaoAdicional,
    "config-final": state.config.mensagemFinal,
    "config-privacy": state.config.privacidade,
    "config-days": state.config.diasParaExibir || 6,
    "config-samu": state.config.emergencia?.samu,
    "config-cvv": state.config.emergencia?.cvv,
    "config-emergency": state.config.emergencia?.mensagem
  };
  Object.entries(values).forEach(([id, value]) => { document.getElementById(id).value = value || ""; });
  document.getElementById("toggle-active").checked = state.config.chatbotAtivo !== false;
  document.getElementById("toggle-after-hours").checked = state.config.respostaForaHorario !== false;
  document.getElementById("toggle-reminder").checked = Boolean(state.config.lembreteAutomatico);
  renderChips("services-chips", state.services, "service");
  renderChips("periods-chips", state.periods, "period");
  renderChips("start-messages-chips", state.startMessages, "start");
  renderChips("start-keywords-chips", state.startKeywords, "keyword");
}

function collectConfig() {
  return {
    ...state.config,
    nomeEmpresa: value("config-company"),
    nomeAssistente: value("config-assistant"),
    profissional: value("config-professional"),
    crp: value("config-crp"),
    mensagemInicial: value("config-welcome"),
    mensagemFinal: value("config-final"),
    privacidade: value("config-privacy"),
    servicos: [...state.services],
    periodos: [...state.periods],
    mensagensInicio: [...state.startMessages],
    palavrasInicio: [...state.startKeywords],
    diasParaExibir: Number(value("config-days")) || 6,
    chatbotAtivo: document.getElementById("toggle-active").checked,
    respostaForaHorario: document.getElementById("toggle-after-hours").checked,
    lembreteAutomatico: document.getElementById("toggle-reminder").checked,
    emergencia: { samu: value("config-samu"), cvv: value("config-cvv"), mensagem: value("config-emergency") }
  };
}

async function saveConfig() {
  syncInlineEditsToForm();
  const form = document.getElementById("config-form");
  if (!form.checkValidity()) {
    showView("settings");
    form.reportValidity();
    return;
  }
  if (!state.services.length) { toast("Adicione pelo menos um serviço antes de publicar.", true); showView("settings"); return; }
  if (!state.startMessages.length) { toast("Adicione pelo menos uma mensagem de início.", true); showView("settings"); return; }
  const buttons = document.querySelectorAll("#publish-config, button[form='config-form']");
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const next = collectConfig();
    await api("/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    state.config = next;
    renderConfigPreview();
    toast("Configurações publicadas com sucesso.");
  } catch (error) {
    toast(error.message || "Não foi possível salvar as configurações.", true);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function renderConfigPreview() {
  setText("flow-welcome", state.config.mensagemInicial || "Configure a mensagem de boas-vindas.");
  setText("flow-privacy", state.config.privacidade || "Configure o aviso de privacidade.");
  setText("flow-schedule", `${state.periods.length ? state.periods.join(", ") : "Períodos a configurar"} • ${state.config.diasParaExibir || 6} dias úteis`);
  const container = document.getElementById("flow-services");
  container.replaceChildren();
  state.services.slice(0, 3).forEach((service) => container.append(create("span", "", service)));
  if (state.services.length > 3) container.append(create("span", "", `+${state.services.length - 3}`));
}

function syncInlineEditsToForm() {
  state.config.mensagemInicial = document.getElementById("flow-welcome").textContent;
  state.config.privacidade = document.getElementById("flow-privacy").textContent;
  document.getElementById("config-welcome").value = state.config.mensagemInicial || "";
  document.getElementById("config-privacy").value = state.config.privacidade || "";
}

function addCollectionItem(type) {
  const inputIds = { service: "new-service", period: "new-period", start: "new-start-message", keyword: "new-start-keyword" };
  const lists = { service: state.services, period: state.periods, start: state.startMessages, keyword: state.startKeywords };
  const containerIds = { service: "services-chips", period: "periods-chips", start: "start-messages-chips", keyword: "start-keywords-chips" };
  const input = document.getElementById(inputIds[type]);
  const list = lists[type];
  const item = input.value.trim();
  if (!item) return;
  if (list.some((existing) => existing.toLocaleLowerCase("pt-BR") === item.toLocaleLowerCase("pt-BR"))) return toast("Este item já foi adicionado.", true);
  list.push(item);
  input.value = "";
  renderChips(containerIds[type], list, type);
  renderConfigPreview();
  toast("Item adicionado. Publique para salvar.");
}

function renderChips(containerId, list, type) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  if (!list.length) return container.append(create("span", "table-secondary", "Nenhum item adicionado."));
  list.forEach((item, index) => {
    const chip = create("span", "chip");
    const remove = create("button", "", "×");
    remove.type = "button";
    remove.dataset.removeCollection = type;
    remove.dataset.index = index;
    remove.setAttribute("aria-label", `Remover ${item}`);
    chip.append(create("span", "", item), remove);
    container.append(chip);
  });
}

async function checkStatus() {
  try {
    const data = await api("/status");
    state.status = data.status || "DESCONECTADO";
    const connected = state.status === "CONECTADO";
    const waiting = state.status === "QR_CODE";
    const pill = document.getElementById("status-pill");
    pill.className = `status-pill ${connected ? "connected" : waiting ? "waiting" : "error"}`;
    setText("status-text", connected ? "WhatsApp conectado" : waiting ? "Escaneie o QR Code" : "WhatsApp desconectado");
    setText("connection-description", connected ? "Conexão ativa e pronta para receber mensagens." : waiting ? "Escaneie o código com o WhatsApp." : "Aguardando inicialização do WhatsApp.");
    document.getElementById("connected-box").hidden = !connected;
    document.getElementById("qr-box").hidden = connected;
    document.getElementById("disconnect-whatsapp").hidden = !connected;
    setHealth("health-whatsapp", "health-whatsapp-label", connected ? "ok" : waiting ? "warn" : "error", connected ? "Conectado" : waiting ? "Aguardando QR" : "Desconectado");
    if (waiting && data.qr) renderQr(data.qr);
  } catch {
    const pill = document.getElementById("status-pill");
    pill.className = "status-pill error";
    setText("status-text", "API indisponível");
    setHealth("health-whatsapp", "health-whatsapp-label", "error", "Indisponível");
  }
}

function renderQr(text) {
  const box = document.getElementById("qr-box");
  if (box.dataset.value === text) return;
  box.dataset.value = text;
  try {
    if (typeof qrcode !== "function") throw new Error("Biblioteca de QR Code indisponível");
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    box.innerHTML = qr.createImgTag(5, 10);
    box.append(create("span", "", "Abra o WhatsApp › Aparelhos conectados."));
  } catch {
    box.replaceChildren(create("span", "", "QR Code recebido, mas não foi possível desenhá-lo. Recarregue a página."));
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (!response.ok) throw new Error();
    setHealth("health-api", "health-api-label", "ok", "Operacional");
    setHealth("health-database", "health-database-label", data.database ? "ok" : "warn", data.database ? "Conectado" : "Não configurado");
  } catch {
    setHealth("health-api", "health-api-label", "error", "Indisponível");
    setHealth("health-database", "health-database-label", "error", "Não verificado");
  }
}

function startLogs() {
  if (state.logStream) state.logStream.close();
  state.logStream = new EventSource(`${API}/logs/stream`);
  state.logStream.onmessage = (event) => {
    try { appendLog(JSON.parse(event.data)); } catch { /* ignora eventos inválidos */ }
  };
  state.logStream.onerror = () => appendLog({ type: "warn", timestamp: new Date().toISOString(), message: "Conexão com os logs interrompida; o navegador tentará reconectar." });
}

function appendLog(log) {
  const output = document.getElementById("logs-output");
  const row = create("div", `log-line ${log.type || "info"}`);
  row.append(create("time", "", formatTime(log.timestamp)), create("span", "", String(log.message || "")));
  output.append(row);
  while (output.children.length > 200) output.firstElementChild.remove();
  output.scrollTop = output.scrollHeight;
}

async function disconnectWhatsApp() {
  if (!confirm("Desconectar o WhatsApp? Será necessário escanear um novo QR Code para reconectar.")) return;
  try {
    const result = await api("/logout", { method: "POST" });
    toast(result.message || "WhatsApp desconectado.");
    checkStatus();
  } catch (error) { toast(error.message, true); }
}

async function resetSession(phone) {
  if (!confirm("Reiniciar esta conversa? O paciente voltará ao início do fluxo.")) return;
  try {
    await api("/sessions/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: phone }) });
    toast("Sessão reiniciada.");
    refreshAll();
  } catch (error) { toast(error.message, true); }
}

async function deletePatient(phone) {
  const patient = state.patients.find((item) => item.phone === phone);
  if (!confirm(`Excluir definitivamente o cadastro de ${patient?.name || "este paciente"}?`)) return;
  try {
    await api("/clients/delete", { method: "POST", headers: { "Content-Type": "application/json", "X-Confirm-Action": "DELETE_CLIENT" }, body: JSON.stringify({ phone }) });
    toast("Paciente removido.");
    refreshAll();
  } catch (error) { toast(error.message, true); }
}

async function advanceAppointment(id) {
  const item = state.appointments.find((appointment) => String(appointment.id) === String(id));
  if (!item) return;
  const sequence = ["Pendente", "Confirmado", "Concluído"];
  const next = sequence[Math.min(sequence.indexOf(item.status) + 1, sequence.length - 1)];
  if (next === item.status) return toast("Este atendimento já está concluído.");
  if (!confirm(`Alterar o status para “${next}”?`)) return;
  try {
    await api("/appointments/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: next }) });
    item.status = next;
    renderAllData();
    toast(`Status alterado para ${next}.`);
  } catch (error) { toast(error.message, true); }
}

async function clearAppointments() {
  if (!state.appointments.length) return toast("Não há registros para limpar.");
  if (!confirm("Apagar definitivamente todo o histórico de agendamentos? Esta ação não pode ser desfeita.")) return;
  const confirmation = prompt("Para confirmar, digite LIMPAR:");
  if (confirmation !== "LIMPAR") return toast("Limpeza cancelada.", true);
  try {
    const result = await api("/appointments/clear", { method: "POST", headers: { "X-Confirm-Action": "CLEAR_APPOINTMENTS" } });
    state.appointments = [];
    renderAllData();
    toast(`${result.removed || 0} registro(s) removido(s).`);
  } catch (error) { toast(error.message, true); }
}

function handleDelegatedClick(event) {
  const edit = event.target.closest("[data-edit-field]");
  if (edit) return openEditModal(edit.dataset.editField, edit.dataset.editLabel);
  const remove = event.target.closest("[data-remove-collection]");
  if (remove) {
    const type = remove.dataset.removeCollection;
    const lists = { service: state.services, period: state.periods, start: state.startMessages, keyword: state.startKeywords };
    const containerIds = { service: "services-chips", period: "periods-chips", start: "start-messages-chips", keyword: "start-keywords-chips" };
    const list = lists[type];
    list.splice(Number(remove.dataset.index), 1);
    renderChips(containerIds[type], list, type);
    renderConfigPreview();
    return toast("Item removido. Publique para salvar.");
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const key = action.dataset.key;
  if (action.dataset.action === "details") openSessionDetails(state.sessions.find((item) => item.phone === key));
  if (action.dataset.action === "reset-session") resetSession(key);
  if (action.dataset.action === "delete-patient") deletePatient(key);
  if (action.dataset.action === "details-appointment") openAppointmentDetails(state.appointments.find((item) => String(item.id) === String(key)));
  if (action.dataset.action === "advance-appointment") advanceAppointment(key);
}

function openEditModal(field, label) {
  state.editingField = field;
  setText("edit-modal-title", label || "Editar bloco");
  const current = field === "mensagemInicial" ? document.getElementById("flow-welcome").textContent : document.getElementById("flow-privacy").textContent;
  document.getElementById("edit-modal-value").value = current;
  document.getElementById("edit-modal").hidden = false;
  document.getElementById("edit-modal-value").focus();
}

function applyBlockEdit() {
  const text = value("edit-modal-value");
  if (!text) return toast("O bloco não pode ficar vazio.", true);
  if (state.editingField === "mensagemInicial") {
    setText("flow-welcome", text);
    document.getElementById("config-welcome").value = text;
  } else if (state.editingField === "privacidade") {
    setText("flow-privacy", text);
    document.getElementById("config-privacy").value = text;
  }
  closeModal("edit-modal");
  toast("Bloco atualizado. Publique para salvar.");
}

function openSessionDetails(item) {
  if (!item) return;
  openDetails(displayName(item), formatPhone(item.phone), [
    ["Etapa", stageLabel(item.stage)], ["Serviço", item.service || "Aguardando"],
    ["Período", item.period || "Aguardando"], ["Atualização", formatDateTime(item.timestamp)]
  ], item.history);
}

function openAppointmentDetails(item) {
  if (!item) return;
  openDetails(displayName(item), formatPhone(item.phone), [
    ["Serviço", item.service || "Não informado"], ["Status", item.status],
    ["Data", item.dayLabel || formatDateOnly(item.date)], ["Período", item.period || "A confirmar"],
    ["Pagamento", item.payment || "A combinar"], ["Observações", item.notes || "Nenhuma"]
  ], item.history);
}

function openDetails(title, subtitle, details, history) {
  setText("details-title", title || "Detalhes do atendimento");
  setText("details-subtitle", subtitle || "");
  const grid = document.getElementById("details-grid");
  grid.replaceChildren();
  details.forEach(([label, content]) => {
    const card = create("div", "detail");
    card.append(create("small", "", label), create("strong", "", content || "Não informado"));
    grid.append(card);
  });
  const timeline = document.getElementById("details-timeline");
  timeline.replaceChildren();
  if (!history?.length) timeline.append(emptyNode("Nenhuma mensagem registrada."));
  else history.forEach((message) => {
    const bubble = create("div", `bubble ${message.author === "bot" ? "bot" : "client"}`);
    bubble.append(create("div", "", message.text || ""), create("time", "", formatDateTime(message.timestamp)));
    timeline.append(bubble);
  });
  document.getElementById("details-modal").hidden = false;
}

function zoomFlow(mode) {
  if (mode === "reset") state.zoom = 1;
  if (mode === "in") state.zoom = Math.min(1.35, state.zoom + .1);
  if (mode === "out") state.zoom = Math.max(.65, state.zoom - .1);
  document.getElementById("flow-track").style.transform = `scale(${state.zoom})`;
  setText("flow-mode-label", `Visualização do atendimento • ${Math.round(state.zoom * 100)}%`);
}

function applySearch(query) {
  const active = document.querySelector(".view.active");
  if (!active) return;
  const term = normalizeText(query);
  active.querySelectorAll(".searchable").forEach((element) => element.classList.toggle("search-hidden", term && !normalizeText(element.textContent).includes(term)));
}

function normalizeSession(raw) {
  return {
    phone: String(raw.from || raw.phone || ""), name: raw.nome || raw.pushname || "Paciente",
    stage: raw.etapa || "início", service: raw.servico || "", period: raw.periodo || "",
    timestamp: raw.timestamp, history: normalizeHistory(raw.historico || raw.respostas)
  };
}

function normalizeConversation(raw) {
  return {
    id: String(raw.id || ""),
    name: String(raw.name || "Contato"),
    phone: String(raw.phone || ""),
    isBusiness: Boolean(raw.isBusiness),
    unreadCount: Number(raw.unreadCount || 0),
    timestamp: raw.timestamp,
    mode: raw.mode === "human" ? "human" : "bot",
    lastMessage: raw.lastMessage ? normalizeConversationMessage(raw.lastMessage) : null
  };
}

function normalizeConversationMessage(raw) {
  return {
    id: String(raw.id || `local-${Date.now()}-${Math.random()}`),
    fromMe: Boolean(raw.fromMe),
    body: String(raw.body || ""),
    type: String(raw.type || "chat"),
    timestamp: raw.timestamp || new Date().toISOString(),
    hasMedia: Boolean(raw.hasMedia),
    mediaName: String(raw.mediaName || ""),
    mediaType: String(raw.mediaType || ""),
    ack: Number(raw.ack || 0)
  };
}

function normalizePatient(raw) {
  return { phone: String(raw.phone || raw.from || ""), name: raw.nome || raw.pushname || "Paciente", consent: raw.consentimento_em || raw.consentimentoEm, timestamp: raw.timestamp };
}

function normalizeAppointment(raw) {
  return {
    id: raw.id, phone: String(raw.from || raw.phone || ""), name: raw.pushname || raw.nome || "Paciente",
    service: raw.servico || "", dayLabel: raw.agendamento_dia || raw.agendamentoDia || "",
    period: raw.agendamento_turno || raw.agendamentoTurno || "", date: raw.agendamento_data_valor || raw.agendamentoDataValor || "",
    payment: raw.pagamento || "A combinar", value: Number(raw.valor_final ?? raw.valorFinal ?? 0),
    notes: raw.observacoes || "", status: raw.status || "Pendente", timestamp: raw.timestamp,
    history: normalizeHistory(raw.respostas || raw.historico)
  };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.map((message) => ({ author: message.autor || message.author || "cliente", text: String(message.texto || message.text || ""), timestamp: message.timestamp }));
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "SB").toUpperCase();
}

function conversationPreview(conversation) {
  const message = conversation.lastMessage;
  if (!message) return "Sem mensagens recentes";
  if (message.body) return `${message.fromMe ? "Você: " : ""}${message.body}`;
  return `${message.fromMe ? "Você: " : ""}${messageTypeLabel(message.type)}`;
}

function messageTypeLabel(type = "") {
  const labels = { image: "Imagem", video: "Vídeo", audio: "Áudio", ptt: "Mensagem de voz", document: "Documento", sticker: "Figurinha", location: "Localização", contact_card: "Contato" };
  return labels[type] || "Mensagem";
}

function attachmentIcon(type = "") {
  const icons = { image: "image", video: "videocam", audio: "audio_file", ptt: "mic", document: "description", sticker: "emoji_emotions" };
  return icons[type] || "attach_file";
}

function conversationListTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = isoDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate(date) === today) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (isoDate(date) === isoDate(yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatMessageDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Mensagens";
  if (isoDate(date) === isoDate(new Date())) return "Hoje";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate(date) === isoDate(yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function findNextAppointment(phone) {
  const target = String(phone || "").replace(/\D/g, "").replace(/^55/, "");
  return state.appointments
    .filter((item) => String(item.phone || "").replace(/\D/g, "").replace(/^55/, "") === target && !["Cancelado", "Concluído"].includes(item.status))
    .sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")))[0] || null;
}

function normalizeCollection(collection) {
  if (Array.isArray(collection)) return collection.map(String).filter(Boolean);
  if (collection && typeof collection === "object") return Object.values(collection).map((item) => String(item?.nome || item || "")).filter(Boolean);
  return [];
}

function tablePerson(primary, secondary) {
  const cell = create("td");
  cell.append(create("span", "table-primary", primary || "Não informado"), create("span", "table-secondary", secondary || ""));
  return cell;
}

function actionButton(label, action, key, danger = false) {
  const button = create("button", `table-action${danger ? " danger" : ""}`, label);
  button.type = "button";
  button.dataset.action = action;
  button.dataset.key = key ?? "";
  return button;
}

function actionCell(buttons) { const cell = create("td", "table-actions"); cell.append(...buttons); return cell; }
function cellWith(child) { const cell = create("td"); cell.append(child); return cell; }
function statusBadge(status) { return create("span", `status ${normalizeText(status).replaceAll(" ", "-")}`, status || "Pendente"); }
function emptyRow(columns, text) { const row = create("tr"); const cell = create("td", "empty", text); cell.colSpan = columns; row.append(cell); return row; }
function emptyNode(text) { return create("div", "empty", text); }

function create(tag, className = "", text = null) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== null && text !== undefined) element.textContent = String(text);
  return element;
}

function setText(id, text) { const element = document.getElementById(id); if (element) element.textContent = String(text); }
function value(id) { return document.getElementById(id).value.trim(); }
function closeModal(id) { document.getElementById(id).hidden = true; }
function displayName(item) { return item?.name && item.name !== "Cliente" ? item.name : "Paciente"; }
function stageLabel(stage = "") { const labels = { consentimento: "Consentimento", nome: "Identificação", servico: "Escolha de serviço", dia: "Escolha de data", periodo: "Escolha de período", confirmacao: "Confirmação", concluido: "Concluído" }; return labels[normalizeText(stage)] || titleCase(stage || "Início"); }
function normalizeText(text = "") { return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function titleCase(text = "") { return text ? text.charAt(0).toUpperCase() + text.slice(1) : ""; }
function isoDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function parseIsoDate(text) { const [year, month, day] = String(text).split("-").map(Number); return new Date(year, month - 1, day); }
function dateValue(value) { const date = new Date(value || 0); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); }
function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function formatDateOnly(value) { if (!value) return "Data a confirmar"; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseIsoDate(value) : new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR"); }
function relativeTime(value) { const difference = Date.now() - dateValue(value); if (!dateValue(value)) return ""; if (difference < 60000) return "agora"; if (difference < 3600000) return `há ${Math.floor(difference / 60000)} min`; if (difference < 86400000) return `há ${Math.floor(difference / 3600000)} h`; return formatDateOnly(value); }
function money(value) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatPhone(value = "") { const digits = String(value).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); if (digits.length === 11) return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`; if (digits.length === 10) return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`; return value || "Não informado"; }

function setHealth(dotId, labelId, type, label) {
  const dot = document.getElementById(dotId);
  dot.className = type;
  setText(labelId, label);
}

function showNotification(count) {
  const badge = document.getElementById("notification-count");
  badge.textContent = String(count);
  badge.hidden = false;
  toast(`${count} novo${count === 1 ? " agendamento" : "s agendamentos"}.`);
}

function toast(message, error = false) {
  const element = document.getElementById("toast");
  clearTimeout(state.toastTimer);
  element.classList.toggle("error", error);
  element.querySelector(".material-symbols-outlined").textContent = error ? "error" : "check_circle";
  setText("toast-message", message);
  element.hidden = false;
  state.toastTimer = setTimeout(() => { element.hidden = true; }, 4200);
}
