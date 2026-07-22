"use strict";

/* ========================================================================== 
   Dependências e configuração global
   ========================================================================== */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const qrcode = require("qrcode-terminal");
const WebSocket = require("ws");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const CONFIG_PATH = path.join(ROOT, "config", "bot.json");
const SITE_PATH = ROOT;
const ADMIN_PATH = path.join(ROOT, "admin");
const MAX_MESSAGE_LENGTH = 1000;

/* ========================================================================== 
   Configuração do assistente e estado em memória
   ========================================================================== */

function readConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (!config.nomeEmpresa || !Array.isArray(config.servicos) || !config.emergencia) {
    throw new Error("config/bot.json está incompleto");
  }
  return config;
}

let botConfig = readConfig();
const sessions = new Map();
const systemLogs = [];
const sseClients = new Set();

function addLog(message, type = "info") {
  const entry = { timestamp: new Date().toISOString(), type, message: String(message) };
  systemLogs.push(entry);
  if (systemLogs.length > 200) systemLogs.shift();
  for (const response of sseClients) response.write(`data: ${JSON.stringify(entry)}\n\n`);
  console[type === "error" ? "error" : "log"](`[${type.toUpperCase()}] ${entry.message}`);
}

/* ========================================================================== 
   Integração com o Supabase
   ========================================================================== */

const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
const supabase = supabaseConfigured
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket }
    })
  : null;

if (!supabaseConfigured) addLog("Supabase não configurado; registros não serão persistidos.", "warn");

async function findClient(phone) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("clientes").select("*").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveClient({ phone, nome }) {
  if (!supabase) return null;
  const payload = {
    phone,
    nome: String(nome).slice(0, 120),
    consentimento_em: new Date().toISOString(),
    timestamp: new Date().toISOString()
  };
  const { data, error } = await supabase.from("clientes").upsert(payload, { onConflict: "phone" }).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function listClients() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("clientes").select("*").order("timestamp", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function deleteClient(phone) {
  if (!supabase) return false;
  const { error } = await supabase.from("clientes").delete().eq("phone", phone);
  if (error) throw error;
  return true;
}

async function saveAppointment(session) {
  if (!supabase) return null;
  const payload = {
    from: session.from,
    pushname: session.nome,
    servico: session.servico,
    agendamento_dia: session.diaLabel,
    agendamento_turno: session.periodo,
    agendamento_data_valor: session.diaValor,
    pagamento: "A combinar",
    valor_final: 0,
    observacoes: "Solicitação recebida pelo Assistente Sentir Bem",
    respostas: session.historico || [],
    status: "Pendente",
    timestamp: new Date().toISOString()
  };
  const { data, error } = await supabase.from("agendamentos").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function listAppointments() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("agendamentos").select("*").order("timestamp", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ========================================================================== 
   Normalização, segurança e utilitários de agenda
   ========================================================================== */

function normalize(text = "") {
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isCrisisMessage(text) {
  const value = normalize(text);
  return [
    "quero morrer", "vou me matar", "me matar", "suicid", "tirar minha vida",
    "acabar com minha vida", "nao quero viver", "me machucar", "me ferir",
    "estou em perigo", "estao me ameacando", "tentativa de suicidio", "overdose"
  ].some((term) => value.includes(term));
}

function nextWorkingDays(count) {
  const result = [];
  const names = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (result.length < count) {
    if (cursor.getDay() !== 0) {
      const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      result.push({ label: `${names[cursor.getDay()]} (${cursor.toLocaleDateString("pt-BR")})`, value });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/* ========================================================================== 
   Cliente do WhatsApp e eventos de conexão
   ========================================================================== */

const disabledWhatsApp = normalize(process.env.DISABLE_WHATSAPP) === "true";
let botStatus = disabledWhatsApp ? "DESATIVADO" : "DESCONECTADO";
let latestQrCode = null;
let client = null;

if (!disabledWhatsApp) {
  const puppeteerOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  };
  if (process.env.CHROME_EXECUTABLE_PATH) puppeteerOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: process.env.WHATSAPP_AUTH_PATH || path.join(ROOT, ".runtime", "whatsapp") }),
    authTimeoutMs: 90000,
    qrMaxRetries: 5,
    puppeteer: puppeteerOptions
  });

  client.on("qr", (qr) => {
    botStatus = "QR_CODE";
    latestQrCode = qr;
    qrcode.generate(qr, { small: true });
    addLog("QR Code do WhatsApp gerado.");
  });
  client.on("ready", () => {
    botStatus = "CONECTADO";
    latestQrCode = null;
    addLog("WhatsApp conectado.");
  });
  client.on("auth_failure", (message) => {
    botStatus = "ERRO_AUTENTICACAO";
    addLog(`Falha de autenticação do WhatsApp: ${message}`, "error");
  });
  client.on("disconnected", (reason) => {
    botStatus = "DESCONECTADO";
    latestQrCode = null;
    addLog(`WhatsApp desconectado: ${reason}`, "warn");
  });
}

/* ========================================================================== 
   Mensagens e fluxo de conversa
   ========================================================================== */

function menuText(name) {
  return `Olá${name ? `, *${name}*` : ""}! Como posso ajudar?\n\n` +
    "1️⃣ Solicitar agendamento\n" +
    "2️⃣ Como funciona o atendimento\n" +
    "3️⃣ Acolhimento e orientações gerais\n" +
    "4️⃣ Falar com a equipe\n" +
    "5️⃣ Privacidade e ajuda urgente\n\n" +
    "Digite apenas o número da opção. Você pode enviar *menu* a qualquer momento.";
}

async function sendMessage(to, text) {
  if (!client) return;
  await client.sendMessage(to, text);
  const session = sessions.get(to);
  if (session) session.historico.push({ autor: "bot", texto: text, timestamp: new Date().toISOString() });
}

async function startConversation(msg) {
  let knownClient = null;
  try { knownClient = await findClient(msg.from); } catch (error) { addLog(error.message, "error"); }
  const session = {
    from: msg.from,
    nome: knownClient?.nome || "",
    etapa: "consentimento",
    consentimento: false,
    historico: [{ autor: "cliente", texto: msg.body || "", timestamp: new Date().toISOString() }],
    timestamp: new Date().toISOString()
  };
  sessions.set(msg.from, session);
  await sendMessage(msg.from, `${botConfig.mensagemInicial}\n\n${botConfig.privacidade}\n\n1️⃣ Concordo e quero continuar\n2️⃣ Não concordo`);
}

async function handleWhatsAppMessage(msg) {
  if (!msg.from || msg.from.endsWith("@g.us") || !msg.body) return;
  const rawText = String(msg.body).trim().slice(0, MAX_MESSAGE_LENGTH);
  const text = normalize(rawText);

  if (isCrisisMessage(rawText)) {
    await sendMessage(msg.from, `Sinto muito que você esteja passando por isso. Sua segurança vem primeiro.\n\n${botConfig.emergencia.mensagem}\n\nSe puder, fique perto de alguém de confiança e afaste objetos ou substâncias que possam causar ferimentos. Este chatbot não acompanha emergências em tempo real.`);
    addLog(`Fluxo de emergência acionado para ${msg.from}`, "warn");
    return;
  }

  if (/^(oi|ola|olá|menu|inicio|início|bom dia|boa tarde|boa noite)$/.test(text) || !sessions.has(msg.from)) {
    await startConversation(msg);
    return;
  }

  const session = sessions.get(msg.from);
  session.timestamp = new Date().toISOString();
  session.historico.push({ autor: "cliente", texto: rawText, timestamp: session.timestamp });

  if (session.etapa === "consentimento") {
    if (text === "2" || text === "nao") {
      sessions.delete(msg.from);
      await sendMessage(msg.from, "Tudo bem. Nenhum dado desta conversa será salvo. Se precisar de atendimento, você pode falar diretamente com a equipe pelo WhatsApp.");
      return;
    }
    if (text !== "1" && text !== "sim") {
      await sendMessage(msg.from, "Para continuar, responda *1* para concordar ou *2* para encerrar.");
      return;
    }
    session.consentimento = true;
    session.etapa = "menu";
    await sendMessage(msg.from, menuText(session.nome));
    return;
  }

  if (session.etapa === "menu") {
    if (text === "1") {
      session.etapa = session.nome ? "servico" : "nome";
      await sendMessage(msg.from, session.nome ? serviceMenu() : "Para organizar o pedido de agendamento, qual é o seu nome completo?");
    } else if (text === "2") {
      await sendMessage(msg.from, `Os atendimentos com ${botConfig.profissional} (${botConfig.crp}) são realizados online, com duração e frequência combinadas diretamente com o profissional. Para valores e disponibilidade atualizados, escolha a opção 1 ou fale com a equipe.\n\n${menuText(session.nome)}`);
    } else if (text === "3") {
      await sendMessage(msg.from, `Posso oferecer apenas orientações gerais e ajudar você a encontrar atendimento humano. Não faço diagnóstico nem substituo terapia. Se quiser, conte em uma frase qual tema procura: ansiedade, sono, estresse ou outro.\n\nPara agendar, envie *menu* e escolha a opção 1.`);
      session.etapa = "acolhimento";
    } else if (text === "4") {
      await sendMessage(msg.from, "Sua mensagem será direcionada para atendimento humano. Informe apenas seu nome e o melhor período para retorno, sem enviar detalhes clínicos sensíveis.");
      session.etapa = session.nome ? "retorno_periodo" : "retorno_nome";
    } else if (text === "5") {
      await sendMessage(msg.from, `${botConfig.privacidade}\n\n${botConfig.emergencia.mensagem}\n\n${menuText(session.nome)}`);
    } else {
      await sendMessage(msg.from, menuText(session.nome));
    }
    return;
  }

  if (session.etapa === "acolhimento") {
    let guidance = "Obrigado por compartilhar. Posso ajudar você a organizar o próximo passo, mas não consigo avaliar ou diagnosticar sua situação.";
    if (text.includes("ansied") || text.includes("panico") || text.includes("nervos")) {
      guidance = "Quando a ansiedade aumenta, tente apoiar os pés no chão e observar lentamente cinco coisas que vê, quatro que pode tocar e três que consegue ouvir. Pare se houver desconforto.";
    } else if (text.includes("sono") || text.includes("dormir") || text.includes("insonia")) {
      guidance = "Para favorecer o sono, tente manter horários regulares, reduzir estímulos perto de dormir e procurar avaliação profissional se a dificuldade persistir ou afetar sua rotina.";
    } else if (text.includes("estress") || text.includes("trabalh") || text.includes("sobrecarga")) {
      guidance = "Em momentos de sobrecarga, escolha uma demanda possível para agora, faça uma pausa curta e anote o que pode ser reorganizado ou conversado com alguém de confiança.";
    }
    session.etapa = "menu";
    await sendMessage(msg.from, `${guidance}\n\nSe isso estiver intenso, persistente ou prejudicando sua rotina, procure atendimento profissional.\n\n${menuText(session.nome)}`);
    return;
  }

  if (session.etapa === "nome" || session.etapa === "retorno_nome") {
    if (rawText.length < 3 || rawText.length > 120) {
      await sendMessage(msg.from, "Informe um nome válido, com até 120 caracteres.");
      return;
    }
    session.nome = rawText.replace(/[<>]/g, "");
    try { await saveClient(session); } catch (error) { addLog(error.message, "error"); }
    if (session.etapa === "retorno_nome") {
      session.etapa = "retorno_periodo";
      await sendMessage(msg.from, "Qual o melhor período para a equipe retornar? Manhã, tarde ou noite?");
    } else {
      session.etapa = "servico";
      await sendMessage(msg.from, serviceMenu());
    }
    return;
  }

  if (session.etapa === "retorno_periodo") {
    session.periodo = rawText.slice(0, 60);
    session.servico = "Retorno da equipe";
    session.diaLabel = "A combinar";
    session.diaValor = null;
    try { await saveAppointment(session); } catch (error) { addLog(error.message, "error"); }
    await sendMessage(msg.from, "Solicitação registrada. A equipe responderá assim que possível dentro do horário de atendimento.");
    sessions.delete(msg.from);
    return;
  }

  if (session.etapa === "servico") {
    const index = Number(text) - 1;
    if (!botConfig.servicos[index]) {
      await sendMessage(msg.from, serviceMenu());
      return;
    }
    session.servico = botConfig.servicos[index];
    session.dias = nextWorkingDays(botConfig.diasParaExibir || 6);
    session.etapa = "dia";
    await sendMessage(msg.from, "Qual dia você prefere?\n\n" + session.dias.map((day, i) => `${i + 1}️⃣ ${day.label}`).join("\n"));
    return;
  }

  if (session.etapa === "dia") {
    const selected = session.dias?.[Number(text) - 1];
    if (!selected) {
      await sendMessage(msg.from, "Escolha um dos números de dia apresentados.");
      return;
    }
    session.diaLabel = selected.label;
    session.diaValor = selected.value;
    session.etapa = "periodo";
    await sendMessage(msg.from, "Qual período você prefere?\n\n" + botConfig.periodos.map((period, i) => `${i + 1}️⃣ ${period}`).join("\n"));
    return;
  }

  if (session.etapa === "periodo") {
    const period = botConfig.periodos[Number(text) - 1];
    if (!period) {
      await sendMessage(msg.from, "Escolha um dos períodos apresentados.");
      return;
    }
    session.periodo = period;
    session.etapa = "confirmacao";
    await sendMessage(msg.from, `Confira sua solicitação:\n\nNome: *${session.nome}*\nAtendimento: *${session.servico}*\nDia: *${session.diaLabel}*\nPeríodo: *${session.periodo}*\n\n1️⃣ Confirmar\n2️⃣ Cancelar`);
    return;
  }

  if (session.etapa === "confirmacao") {
    if (text === "2") {
      sessions.delete(msg.from);
      await sendMessage(msg.from, "Solicitação cancelada. Envie *menu* quando quiser começar novamente.");
      return;
    }
    if (text !== "1") {
      await sendMessage(msg.from, "Responda *1* para confirmar ou *2* para cancelar.");
      return;
    }
    try {
      await saveClient(session);
      await saveAppointment(session);
      await sendMessage(msg.from, `✅ Solicitação de agendamento registrada.\n\n${botConfig.mensagemFinal}`);
      addLog(`Nova solicitação de agendamento de ${session.nome}.`);
    } catch (error) {
      addLog(error.message, "error");
      await sendMessage(msg.from, "Não consegui registrar sua solicitação agora. Por favor, aguarde o atendimento da equipe ou tente novamente mais tarde.");
    }
    sessions.delete(msg.from);
  }
}

function serviceMenu() {
  return "Qual tipo de atendimento você procura?\n\n" + botConfig.servicos.map((service, index) => `${index + 1}️⃣ ${service}`).join("\n");
}

/* ========================================================================== 
   Inicialização dos eventos do WhatsApp
   ========================================================================== */

if (client) {
  client.on("message", (msg) => handleWhatsAppMessage(msg).catch((error) => addLog(error.stack || error.message, "error")));
  client.initialize().catch((error) => {
    botStatus = "ERRO";
    addLog(`Falha ao iniciar WhatsApp: ${error.message}`, "error");
  });
}

/* ========================================================================== 
   Servidor HTTP, proteções e limite de requisições
   ========================================================================== */

const app = express();
// Separa /admin de /admin/ para evitar que o redirecionamento abaixo
// tambem capture /admin/ e crie um loop infinito.
app.enable("strict routing");
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const origin = process.env.ALLOWED_ORIGIN;
  if (origin && req.headers.origin === origin) res.setHeader("Access-Control-Allow-Origin", origin);
  next();
});

const attempts = new Map();
app.use("/api", (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, reset: now + 60000 };
  if (now > record.reset) Object.assign(record, { count: 0, reset: now + 60000 });
  record.count += 1;
  attempts.set(key, record);
  if (record.count > 120) return res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
  next();
});

function safeEqual(received, expected) {
  const a = Buffer.from(received || "");
  const b = Buffer.from(expected || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function adminAuth(req, res, next) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) return res.status(503).send("Painel administrativo não configurado.");
  const [type, token] = (req.headers.authorization || "").split(" ");
  let credentials = ["", ""];
  if (type === "Basic" && token) credentials = Buffer.from(token, "base64").toString("utf8").split(":");
  if (!safeEqual(credentials[0], expectedUser) || !safeEqual(credentials.slice(1).join(":"), expectedPassword)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Sentir Bem Admin"');
    return res.status(401).send("Autenticação necessária.");
  }
  next();
}

/* ========================================================================== 
   Rotas de saúde e painel administrativo
   ========================================================================== */

app.get("/api/health", (req, res) => res.json({ ok: true, whatsapp: botStatus, database: supabaseConfigured }));
app.get("/admin", (req, res) => res.redirect(301, "/admin/"));
app.get("/admin/", (req, res) => res.sendFile(path.join(ADMIN_PATH, "index.html")));
app.use("/admin", express.static(ADMIN_PATH, { index: false, dotfiles: "deny" }));

app.get("/api/admin/status", (req, res) => res.json({ status: botStatus, qr: latestQrCode }));
app.get("/api/admin/config", (req, res) => res.json(botConfig));
app.post("/api/admin/config", (req, res) => {
  const stringFields = ["nomeEmpresa", "nomeAssistente", "profissional", "crp", "mensagemFinal", "saudacaoAdicional", "endereco", "linkMapa", "horarioManha", "horarioTarde"];
  const updates = Object.fromEntries(stringFields.filter((key) => typeof req.body[key] === "string").map((key) => [key, req.body[key].trim().slice(0, 500)]));
  for (const key of ["formasPagamento", "todosServicos"]) {
    if (Array.isArray(req.body[key])) updates[key] = req.body[key].map((item) => String(item).trim().slice(0, 160)).filter(Boolean).slice(0, 100);
  }
  if (Array.isArray(req.body.servicos)) {
    updates.servicos = req.body.servicos.map((item) => String(item).trim().slice(0, 160)).filter(Boolean).slice(0, 100);
  } else if (req.body.servicos && typeof req.body.servicos === "object") {
    updates.servicos = Object.values(req.body.servicos).map((item) => String(item && item.nome || "").trim().slice(0, 160)).filter(Boolean).slice(0, 100);
  }
  const next = { ...botConfig, ...updates };
  if (!next.nomeEmpresa || !Array.isArray(next.servicos) || next.servicos.length === 0) return res.status(400).json({ error: "Configuração inválida." });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  botConfig = readConfig();
  res.json({ success: true, message: "Configuração atualizada." });
});
app.get("/api/admin/sessions", (req, res) => res.json(Array.from(sessions.values())));
app.get("/api/admin/clients", async (req, res, next) => { try { res.json(await listClients()); } catch (e) { next(e); } });
app.get("/api/admin/appointments", async (req, res, next) => { try { res.json(await listAppointments()); } catch (e) { next(e); } });
app.post("/api/admin/clients/delete", async (req, res, next) => {
  try {
    if (req.headers["x-confirm-action"] !== "DELETE_CLIENT" || !req.body.phone) return res.status(400).json({ error: "Confirmação explícita necessária." });
    await deleteClient(String(req.body.phone));
    res.json({ success: true });
  } catch (e) { next(e); }
});
app.post("/api/admin/sessions/reset", (req, res) => {
  if (!req.body.from || !sessions.delete(String(req.body.from))) return res.status(404).json({ error: "Sessão não encontrada." });
  res.json({ success: true });
});
app.post("/api/admin/logout", async (req, res, next) => {
  try {
    if (!client) return res.status(409).json({ success: false, message: "WhatsApp não está ativo." });
    await client.logout();
    botStatus = "DESCONECTADO";
    latestQrCode = null;
    res.json({ success: true, message: "WhatsApp desconectado." });
  } catch (e) { next(e); }
});
app.get("/api/admin/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  systemLogs.forEach((entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`));
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

/* ========================================================================== 
   Arquivos públicos e tratamento de erros
   ========================================================================== */

app.use("/assets", express.static(path.join(SITE_PATH, "assets"), { dotfiles: "deny" }));
app.use("/css", express.static(path.join(SITE_PATH, "css"), { dotfiles: "deny" }));
app.use("/js", express.static(path.join(SITE_PATH, "js"), { dotfiles: "deny" }));
app.use("/pages", express.static(path.join(SITE_PATH, "pages"), { dotfiles: "deny", extensions: ["html"] }));
app.get("/", (req, res) => res.sendFile(path.join(SITE_PATH, "index.html")));
app.use((req, res) => res.sendFile(path.join(SITE_PATH, "index.html")));

app.use((error, req, res, next) => {
  addLog(error.stack || error.message, "error");
  res.status(500).json({ error: "Erro interno do servidor." });
});

/* ========================================================================== 
   Inicialização e encerramento seguro do servidor
   ========================================================================== */

const server = http.createServer(app);

function showServerLinks() {
  const localUrl = `http://localhost:${PORT}`;
  console.log("\n============================================================");
  console.log("  SENTIR BEM ESTÁ NO AR");
  console.log("============================================================");
  console.log(`  Site oficial: ${localUrl}/`);
  console.log(`  Abrir chatbot: ${localUrl}/admin/`);
  console.log("============================================================\n");
}

function startServer() {
  return server.listen(PORT, () => {
    addLog(`Servidor Sentir Bem ativo na porta ${PORT}.`);
    showServerLinks();
  });
}

if (require.main === module) startServer();

async function shutdown() {
  addLog("Encerrando servidor...");
  if (client) await client.destroy().catch(() => {});
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/* ========================================================================== 
   Exportações utilizadas pelos testes
   ========================================================================== */

module.exports = { app, server, startServer, isCrisisMessage, normalize };
