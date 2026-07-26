"use strict";

/* ==========================================================================
   BLOCO 1 — DEPENDÊNCIAS E CAMINHOS GLOBAIS
   ==========================================================================
   Este arquivo concentra duas aplicações que trabalham juntas:

   1. O BOT, que mantém uma sessão do WhatsApp Web, recebe mensagens e executa
      o fluxo de atendimento.
   2. O SERVIDOR, que publica o site, protege o painel administrativo e oferece
      as rotas HTTP usadas pelo painel.

   Dependências críticas:
   - whatsapp-web.js: conecta, recebe e envia mensagens no WhatsApp.
   - Express: cria as páginas e APIs HTTP.
   - Supabase: persiste clientes, CPF, configurações e agendamentos.
   - WebSocket: transporte exigido pelo cliente Supabase nesta versão do Node.

   ROOT é a raiz segura para todos os caminhos locais. CONFIG_PATH aponta para
   a configuração padrão; PIX_QR_PATH aponta para a imagem enviada no pagamento.
   Se Client/LocalAuth, ROOT ou PORT forem removidos, o bot ou o servidor deixa
   de iniciar. Nunca coloque a chave privada do Supabase no código-fonte: ela é
   lida exclusivamente das variáveis do arquivo .env.
   ========================================================================== */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const qrcode = require("qrcode-terminal");
const WebSocket = require("ws");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const CONFIG_PATH = path.join(ROOT, "config", "bot.json");
const SITE_PATH = ROOT;
const ADMIN_PATH = path.join(ROOT, "admin");
const PIX_QR_PATH = path.join(ROOT, "assets", "QR-CODE-PIX", "PIX.jpeg");
const PIX_KEY = "18817533793";
const MAX_MESSAGE_LENGTH = 1000;
const DEFAULT_SERVICE_VALUES = [180, 150, 90];
const DEFAULT_START_MESSAGES = ["oi", "olá", "ola", "menu", "início", "inicio", "bom dia", "boa tarde", "boa noite"];
const DEFAULT_START_KEYWORDS = [
  "ansiedade", "ansioso", "ansiosa", "crise de ansiedade", "pânico", "panico",
  "dor no peito", "cansaço", "cansaco", "cansado", "cansada", "tristeza", "triste",
  "depressão", "depressao", "estresse", "estressado", "estressada", "sobrecarregado",
  "sobrecarregada", "insônia", "insonia", "não consigo dormir", "nao consigo dormir",
  "medo", "angústia", "angustia", "desânimo", "desanimo", "solidão", "solidao", "luto",
  "aperto no peito", "falta de ar", "emocional", "saúde mental", "saude mental", "terapia",
  "psicólogo", "psicologo", "psicóloga", "psicologa", "chorando", "vontade de chorar",
  "nervoso", "nervosa", "preocupado", "preocupada", "sem esperança", "baixa autoestima",
  "trauma", "relacionamento", "término", "termino", "exausto", "exausta", "esgotado",
  "esgotada", "burnout", "quero conversar", "preciso de ajuda", "não estou bem", "nao estou bem"
];

/* ==========================================================================
   BLOCO 2 — CONFIGURAÇÃO DO BOT E ESTADO TEMPORÁRIO
   ==========================================================================
   readConfig() carrega config/bot.json como configuração inicial. Depois, na
   inicialização, loadPersistedConfig() substitui esses valores pelos dados mais
   recentes salvos no Supabase.

   Mapas e conjuntos deste bloco existem somente enquanto o processo está vivo:
   - sessions: etapa atual de cada pessoa no fluxo do WhatsApp.
   - adminSessions: tokens de login do painel e seus horários de expiração.
   - systemLogs: últimas ocorrências mostradas no console administrativo.
   - sseClients: navegadores que recebem logs em tempo real.

   O banco guarda dados permanentes; sessions não é o cadastro do cliente.
   Reiniciar o servidor limpa conversas incompletas, mas não remove clientes,
   configurações nem agendamentos já confirmados.
   ========================================================================== */

function readConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (!config.nomeEmpresa || !Array.isArray(config.servicos) || !config.emergencia) {
    throw new Error("config/bot.json está incompleto");
  }
  config.servicos = normalizeServiceCatalog(config.servicos);
  return config;
}

function normalizeServiceCatalog(services = []) {
  return services.map((service, index) => {
    const name = String(service?.nome || service || "").trim().slice(0, 120);
    const informedValue = Number(service?.valor);
    const value = Number.isFinite(informedValue) && informedValue > 0
      ? Math.round(informedValue * 100) / 100
      : DEFAULT_SERVICE_VALUES[index] || 100;
    return { nome: name, valor: value };
  }).filter((service) => service.nome);
}

let botConfig = readConfig();
const sessions = new Map();
const adminSessions = new Map();
const systemLogs = [];
const sseClients = new Set();
const DEFAULT_WORK_SCHEDULE = {
  "0": { ativo: false, inicio: "08:00", fim: "18:00" },
  "1": { ativo: true, inicio: "08:00", fim: "18:00" },
  "2": { ativo: true, inicio: "08:00", fim: "18:00" },
  "3": { ativo: true, inicio: "08:00", fim: "18:00" },
  "4": { ativo: true, inicio: "08:00", fim: "18:00" },
  "5": { ativo: true, inicio: "08:00", fim: "18:00" },
  "6": { ativo: false, inicio: "08:00", fim: "13:00" }
};

function addLog(message, type = "info") {
  const entry = { timestamp: new Date().toISOString(), type, message: String(message) };
  systemLogs.push(entry);
  if (systemLogs.length > 200) systemLogs.shift();
  for (const response of sseClients) response.write(`data: ${JSON.stringify(entry)}\n\n`);
  console[type === "error" ? "error" : "log"](`[${type.toUpperCase()}] ${entry.message}`);
}

/* ==========================================================================
   BLOCO 3 — CAMADA DE BANCO DE DADOS (SUPABASE)
   ==========================================================================
   Esta é a única camada que deve conhecer nomes de tabelas e colunas. O fluxo
   do WhatsApp chama estas funções em vez de executar consultas diretamente.

   Responsabilidades:
   - clientes: localizar por CPF, cadastrar, atualizar e excluir;
   - agendamentos: criar, consultar, remarcar, alterar status e limpar;
   - administradores: guardar somente hash de senha, nunca a senha em texto;
   - configuracoes_sistema: persistir tudo que é alterado no painel.

   Linhas lógicas essenciais:
   - supabaseAccessConfigured impede uso administrativo com chave pública.
   - findClientByCpf() transforma CPF em dígitos antes de consultar.
   - saveClient() atualiza um cadastro existente antes de tentar inserir outro.
   - saveAppointment() grava o histórico e a forma de pagamento.
   - rescheduleAppointment() altera o registro existente, sem duplicá-lo.

   Toda resposta do Supabase contém { data, error }. O teste de error é
   obrigatório: ignorá-lo faria o bot confirmar algo que não foi salvo.
   ========================================================================== */

const supabaseUrl = process.env.SUPABASE_URL || process.env.API_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.CHAVE_API;
const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

function classifySupabaseKey(key = "") {
  const value = String(key).trim();
  if (value.startsWith("sb_secret_")) return "secret";
  if (value.startsWith("sb_publishable_")) return "anon";

  const parts = value.split(".");
  if (parts.length !== 3) return "unknown";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : "unknown";
  } catch {
    return "unknown";
  }
}

const supabaseKeyRole = classifySupabaseKey(supabaseKey);
const supabaseAccessConfigured = supabaseConfigured && supabaseKeyRole !== "anon";
const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket }
    })
  : null;

if (!supabaseConfigured) addLog("Supabase não configurado; registros não serão persistidos.", "warn");

if (supabaseConfigured && !supabaseAccessConfigured) {
  addLog("A chave do Supabase é pública/anon e não pode acessar as tabelas administrativas. Configure SUPABASE_SERVICE_ROLE_KEY.", "warn");
}

async function findClient(phone) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("clientes").select("*").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data;
}

async function findClientByCpf(cpf) {
  if (!supabase) return null;
  const digits = cpfDigits(cpf);
  if (!digits) return null;
  const variants = [digits, formatCpf(digits)];
  const { data, error } = await supabase.from("clientes").select("*").in("cpf", variants).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveClient({ phone, from, nome, cpf }) {
  if (!supabase) return null;
  const clientPhone = String(phone || from || "").trim();
  if (!clientPhone) throw new Error("Não foi possível identificar o telefone do cliente.");
  const normalizedCpf = cpfDigits(cpf);
  const payload = {
    phone: clientPhone,
    nome: String(nome).slice(0, 120),
    ...(normalizedCpf ? { cpf: normalizedCpf } : {}),
    consentimento_em: new Date().toISOString(),
    timestamp: new Date().toISOString()
  };
  let existing = normalizedCpf ? await findClientByCpf(normalizedCpf) : null;
  if (!existing) existing = await findClient(clientPhone);
  if (existing?.phone) payload.phone = existing.phone;
  const query = existing
    ? supabase.from("clientes").update(payload).eq("phone", existing.phone)
    : supabase.from("clientes").insert(payload);
  const { data, error } = await query.select().maybeSingle();
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
    from: session.clientePhone || session.from,
    pushname: session.nome,
    servico: session.servico,
    agendamento_dia: session.diaLabel,
    agendamento_turno: session.periodo,
    agendamento_data_valor: session.diaValor,
    pagamento: session.pagamento || "A combinar",
    valor_final: Number(session.valorFinal) || 0,
    observacoes: `Solicitação recebida pelo Assistente Sentir Bem. CPF informado e validado: ${session.cpf ? "sim" : "não"}. Comprovante Pix recebido: ${session.comprovanteRecebido ? "sim" : "não se aplica"}.`,
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

async function updateAppointmentStatus(id, status) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("agendamentos")
    .update({ status })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function clearAppointments() {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("agendamentos")
    .delete()
    .not("id", "is", null)
    .select("id");
  if (error) throw error;
  return (data || []).length;
}

async function findLatestAppointment(phone) {
  if (!supabase || !phone) return null;
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("from", phone)
    .or("status.is.null,status.neq.Cancelado")
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function rescheduleAppointment(id, session) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("agendamentos")
    .update({
      agendamento_dia: session.diaLabel,
      agendamento_turno: session.periodo,
      agendamento_data_valor: session.diaValor,
      status: "Pendente",
      observacoes: [session.appointmentObservacoes, "Reagendamento solicitado pelo chatbot e aguardando confirmação da equipe."]
        .filter(Boolean)
        .join("\n"),
      timestamp: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

function hashAdminPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyAdminPassword(password, encoded) {
  const [algorithm, salt, expected] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const received = crypto.scryptSync(String(password), salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

async function ensureAdminRecord() {
  if (!supabaseAccessConfigured || !process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) return;
  const username = process.env.ADMIN_USER.trim();
  const { data: current, error: readError } = await supabase
    .from("administradores")
    .select("id,senha_hash")
    .eq("usuario", username)
    .maybeSingle();
  if (readError) throw readError;
  const passwordHash = current && verifyAdminPassword(process.env.ADMIN_PASSWORD, current.senha_hash)
    ? current.senha_hash
    : hashAdminPassword(process.env.ADMIN_PASSWORD);
  const { error } = await supabase.from("administradores").upsert({
    usuario: username,
    nome_exibicao: "Administrador Sentir Bem",
    perfil: "administrador",
    senha_hash: passwordHash,
    ativo: true,
    atualizado_em: new Date().toISOString()
  }, { onConflict: "usuario" });
  if (error) throw error;
}

async function authenticateAdmin(username, password) {
  if (!supabaseAccessConfigured) {
    return safeEqual(username, process.env.ADMIN_USER) && safeEqual(password, process.env.ADMIN_PASSWORD);
  }
  const { data, error } = await supabase
    .from("administradores")
    .select("id,senha_hash,ativo")
    .eq("usuario", username)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.ativo || !verifyAdminPassword(password, data.senha_hash)) return false;
  await supabase.from("administradores").update({ ultimo_login_em: new Date().toISOString() }).eq("id", data.id);
  return true;
}

async function persistConfig(config, updatedBy) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  if (!supabaseAccessConfigured) return;
  const { error } = await supabase.from("configuracoes_sistema").upsert({
    id: "bot",
    dados: config,
    atualizado_em: new Date().toISOString(),
    atualizado_por: updatedBy || "administrador"
  }, { onConflict: "id" });
  if (error) throw error;
}

async function loadPersistedConfig() {
  if (!supabaseAccessConfigured) return;
  const { data, error } = await supabase
    .from("configuracoes_sistema")
    .select("dados")
    .eq("id", "bot")
    .maybeSingle();
  if (error) throw error;
  if (data?.dados && typeof data.dados === "object") {
    botConfig = { ...botConfig, ...data.dados };
    botConfig.servicos = normalizeServiceCatalog(botConfig.servicos);
    await persistConfig(botConfig, "sistema");
  } else {
    await persistConfig(botConfig, "sistema");
  }
}

/* ==========================================================================
   BLOCO 4 — NORMALIZAÇÃO, SEGURANÇA E DISPONIBILIDADE
   ==========================================================================
   normalize() remove diferenças de acento e maiúsculas para que "OLÁ", "ola"
   e "Olá" sejam entendidos da mesma forma.

   A ordem das regras de segurança é importante:
   - isCrisisMessage() identifica risco de morte, violência ou autoagressão.
   - hasUrgentPhysicalSymptom() identifica sinais físicos potencialmente graves.
   Essas verificações são executadas antes de CPF, pagamento ou agendamento.

   nextWorkingDays() lê o expediente configurado pelo administrador. Dias
   desativados nunca entram nas opções enviadas pelo bot, mantendo WhatsApp,
   calendário e configurações com a mesma regra de disponibilidade.
   ========================================================================== */

function normalize(text = "") {
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isStartMessage(text, configuredMessages = botConfig.mensagensInicio) {
  const messages = Array.isArray(configuredMessages) ? configuredMessages : DEFAULT_START_MESSAGES;
  const normalizedText = normalize(text);
  return messages.some((message) => normalize(message) === normalizedText);
}

function normalizeSearchText(text) {
  return normalize(text).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isStartKeywordMessage(text, configuredKeywords = botConfig.palavrasInicio) {
  const keywords = Array.isArray(configuredKeywords) ? configuredKeywords : DEFAULT_START_KEYWORDS;
  const searchableText = ` ${normalizeSearchText(text)} `;
  return keywords.some((keyword) => {
    const searchableKeyword = normalizeSearchText(keyword);
    return searchableKeyword && searchableText.includes(` ${searchableKeyword} `);
  });
}

function hasUrgentPhysicalSymptom(text) {
  const value = ` ${normalizeSearchText(text)} `;
  return ["dor no peito", "aperto no peito", "falta de ar", "desmaio"]
    .some((symptom) => value.includes(` ${symptom} `));
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
  let checkedDays = 0;
  while (result.length < count && checkedDays < 366) {
    const schedule = botConfig.expediente?.[String(cursor.getDay())] || DEFAULT_WORK_SCHEDULE[String(cursor.getDay())];
    if (schedule.ativo) {
      const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      result.push({ label: `${names[cursor.getDay()]} (${cursor.toLocaleDateString("pt-BR")})`, value });
    }
    cursor.setDate(cursor.getDate() + 1);
    checkedDays += 1;
  }
  return result;
}

/* ==========================================================================
   BLOCO 5 — CONEXÃO COM O WHATSAPP
   ==========================================================================
   Este bloco cria uma única instância de Client. LocalAuth guarda a sessão em
   .runtime/whatsapp para evitar novo QR Code em cada reinício.

   Eventos indispensáveis:
   - "qr": disponibiliza um novo código para vincular o aparelho.
   - "ready": confirma que envio e recebimento já podem funcionar.
   - "auth_failure": registra falha de autenticação.
   - "disconnected": impede o painel de exibir uma conexão inexistente.

   Não crie um segundo Client usando a mesma pasta: dois Chromes disputando
   LocalAuth corrompem a sessão e podem produzir QR inválido ou bloqueio do
   perfil. puppeteerOptions controla apenas o navegador interno do WhatsApp,
   não o navegador usado pelo visitante do site.
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
   BLOCO 6 — MOTOR DO CHATBOT
   ==========================================================================
   handleWhatsAppMessage() é o centro do atendimento. Cada mensagem passa por
   uma máquina de estados: session.etapa indica qual resposta é esperada.

   Caminho normal:
   início -> consentimento -> menu -> CPF -> cadastro/consulta -> serviço ->
   dia -> período -> pagamento -> confirmação -> banco.

   Caminho de reagendamento:
   menu -> CPF -> cliente existente -> agendamento existente -> novo dia ->
   novo período -> atualização do mesmo registro.

   Caminho Pix:
   pagamento -> QR Code -> comprovante com "feito" -> confirmação.

   Regras que não podem mudar de posição:
   1. Mensagens de crise e urgência são avaliadas antes de sessions.
   2. Dados só são solicitados depois do consentimento.
   3. CPF é validado antes de qualquer consulta por identidade.
   4. O bot só anuncia sucesso depois que o Supabase responde sem error.
   ========================================================================== */

function menuText(name) {
  return `Olá${name ? `, *${name}*` : ""}! Como posso ajudar?\n\n` +
    "1️⃣ Solicitar agendamento\n" +
    "2️⃣ Consultar meu agendamento\n" +
    "3️⃣ Reagendar atendimento\n" +
    "4️⃣ Como funciona o atendimento\n" +
    "5️⃣ Acolhimento e orientações gerais\n" +
    "6️⃣ Falar com a equipe\n" +
    "7️⃣ Privacidade e ajuda urgente\n\n" +
    "Digite apenas o número da opção. Você pode enviar *menu* a qualquer momento.";
}

async function sendMessage(to, text) {
  if (!client) return;
  await client.sendMessage(to, text);
  const session = sessions.get(to);
  if (session) session.historico.push({ autor: "bot", texto: text, timestamp: new Date().toISOString() });
}

async function sendPixInstructions(to) {
  const session = sessions.get(to);
  const caption = `Pagamento via *Pix*\n\nValor: *${formatMoney(session?.valorFinal)}*\nChave Pix: *${PIX_KEY}*\n\nQuando efetuar o pagamento, envie o comprovante aqui com a palavra *feito* na legenda.`;
  const media = MessageMedia.fromFilePath(PIX_QR_PATH);
  await client.sendMessage(to, media, { caption });
  if (session) session.historico.push({ autor: "bot", texto: `[QR Code Pix enviado]\n${caption}`, timestamp: new Date().toISOString() });
}

async function sendAppointmentConfirmation(to, session) {
  await sendMessage(to, `Confira sua solicitação:\n\nNome: *${session.nome}*\nCPF: *${maskedCpf(session.cpf)}*\nAtendimento: *${session.servico}*\nValor: *${formatMoney(session.valorFinal)}*\nDia: *${session.diaLabel}*\nPeríodo: *${session.periodo}*\nPagamento: *${session.pagamento}*\n\n1️⃣ Confirmar\n2️⃣ Cancelar`);
}

async function startConversation(msg) {
  /*
   * Cria a sessão mínima antes de pedir consentimento. Nenhum cadastro permanente
   * é criado aqui. `from` é o endereço técnico usado para responder no WhatsApp;
   * a identidade civil será localizada depois, exclusivamente pelo CPF.
   */
  const session = {
    from: msg.from,
    phone: msg.from,
    nome: "",
    etapa: "consentimento",
    consentimento: false,
    historico: [{ autor: "cliente", texto: msg.body || "", timestamp: new Date().toISOString() }],
    timestamp: new Date().toISOString()
  };
  sessions.set(msg.from, session);
  await sendMessage(msg.from, `${botConfig.mensagemInicial}\n\n${botConfig.privacidade}\n\n1️⃣ Concordo e quero continuar\n2️⃣ Não concordo`);
}

async function handleWhatsAppMessage(msg) {
  /*
   * FILTROS DE ENTRADA
   * Ignora grupos, mensagens sem texto/legenda e o bot desligado. O limite de
   * tamanho evita que uma mensagem enorme seja mantida inteira em memória.
   */
  if (!msg.from || msg.from.endsWith("@g.us") || !msg.body) return;
  if (botConfig.chatbotAtivo === false) return;
  const rawText = String(msg.body).trim().slice(0, MAX_MESSAGE_LENGTH);
  const text = normalize(rawText);

  if (isCrisisMessage(rawText)) {
    await sendMessage(msg.from, `Sinto muito que você esteja passando por isso. Sua segurança vem primeiro.\n\n${botConfig.emergencia.mensagem}\n\nSe puder, fique perto de alguém de confiança e afaste objetos ou substâncias que possam causar ferimentos. Este chatbot não acompanha emergências em tempo real.`);
    addLog(`Fluxo de emergência acionado para ${msg.from}`, "warn");
    return;
  }

  if (hasUrgentPhysicalSymptom(rawText)) {
    await sendMessage(msg.from, "⚠️ Dor no peito de início súbito, falta de ar intensa ou desmaio podem ser uma urgência médica. Ligue para o SAMU 192 ou procure imediatamente um serviço de emergência. Este chatbot não consegue avaliar sintomas físicos nem descartar uma emergência.");
    addLog(`Orientação de urgência física acionada para ${msg.from}`, "warn");
    return;
  }

  if (!sessions.has(msg.from)) {
    /*
     * Uma sessão só começa com saudação ou palavra configurada. Isso impede o
     * bot de responder espontaneamente a qualquer conversa do número conectado.
     */
    if (!isStartMessage(rawText) && !isStartKeywordMessage(rawText)) return;
    await startConversation(msg);
    return;
  }

  const session = sessions.get(msg.from);
  session.timestamp = new Date().toISOString();
  session.historico.push({ autor: "cliente", texto: rawText, timestamp: session.timestamp });

  if (session.consentimento && (text === "menu" || text === "inicio")) {
    session.etapa = "menu";
    await sendMessage(msg.from, menuText(session.nome));
    return;
  }

  if (session.etapa === "consentimento") {
    /*
     * BARREIRA DE PRIVACIDADE
     * Até o aceite, nenhuma chamada de saveClient/saveAppointment é realizada.
     */
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
    const customFlowMessages = Array.isArray(botConfig.fluxoPrincipal)
      ? botConfig.fluxoPrincipal.filter((step) => step.tipo === "mensagem" && step.conteudo)
      : [];
    for (const step of customFlowMessages) await sendMessage(msg.from, step.conteudo);
    await sendMessage(msg.from, menuText(session.nome));
    return;
  }

  if (session.etapa === "menu") {
    /*
     * ROTEADOR PRINCIPAL
     * As opções 1, 2 e 3 convergem para identificar_cpf. A ação desejada fica em
     * acaoPendente, permitindo que o mesmo bloco de CPF sirva aos três caminhos.
     */
    if (["1", "2", "3"].includes(text)) {
      session.acaoPendente = { "1": "agendar", "2": "consultar", "3": "reagendar" }[text];
      session.etapa = "identificar_cpf";
      await sendMessage(msg.from, "Para localizar seu cadastro, informe seu CPF. Envie somente os 11 números ou no formato 000.000.000-00.");
    } else if (text === "4") {
      await sendMessage(msg.from, `Os atendimentos com ${botConfig.profissional} (${botConfig.crp}) são realizados online, com duração e frequência combinadas diretamente com o profissional. Para valores e disponibilidade atualizados, escolha a opção 1 ou fale com a equipe.\n\n${menuText(session.nome)}`);
    } else if (text === "5") {
      await sendMessage(msg.from, `Posso oferecer apenas orientações gerais e ajudar você a encontrar atendimento humano. Não faço diagnóstico nem substituo terapia. Se quiser, conte em uma frase qual tema procura: ansiedade, sono, estresse ou outro.\n\nPara agendar, envie *menu* e escolha a opção 1.`);
      session.etapa = "acolhimento";
    } else if (text === "6") {
      await sendMessage(msg.from, "Sua mensagem será direcionada para atendimento humano. Informe apenas seu nome e o melhor período para retorno, sem enviar detalhes clínicos sensíveis.");
      session.etapa = session.nome ? "retorno_periodo" : "retorno_nome";
    } else if (text === "7") {
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
    const selectedService = botConfig.servicos[index];
    if (!selectedService) {
      await sendMessage(msg.from, serviceMenu());
      return;
    }
    session.servico = selectedService.nome;
    session.valorFinal = selectedService.valor;
    session.dias = nextWorkingDays(botConfig.diasParaExibir || 6);
    session.etapa = "dia";
    await sendMessage(msg.from, "Qual dia você prefere?\n\n" + session.dias.map((day, i) => `${i + 1}️⃣ ${day.label}`).join("\n"));
    return;
  }

  if (session.etapa === "reagendamento_dia") {
    /*
     * REAGENDAMENTO
     * appointmentId aponta para o registro encontrado pelo CPF. A etapa apenas
     * troca data/período; não cria outra cobrança nem outro agendamento.
     */
    const selected = session.dias?.[Number(text) - 1];
    if (!selected) {
      await sendMessage(msg.from, "Escolha um dos números de dia apresentados.");
      return;
    }
    session.diaLabel = selected.label;
    session.diaValor = selected.value;
    session.etapa = "reagendamento_periodo";
    await sendMessage(msg.from, "Qual novo período você prefere?\n\n" + botConfig.periodos.map((period, index) => `${index + 1}️⃣ ${period}`).join("\n"));
    return;
  }

  if (session.etapa === "reagendamento_periodo") {
    const period = botConfig.periodos[Number(text) - 1];
    if (!period) {
      await sendMessage(msg.from, "Escolha um dos períodos apresentados.");
      return;
    }
    session.periodo = period;
    try {
      await rescheduleAppointment(session.appointmentId, session);
      await sendMessage(msg.from, `✅ Reagendamento solicitado.\n\nNovo dia: *${session.diaLabel}*\nNovo período: *${session.periodo}*\nStatus: *Pendente de confirmação da equipe*`);
      addLog(`Reagendamento solicitado por ${session.nome}.`);
      sessions.delete(msg.from);
    } catch (error) {
      addLog(error.message, "error");
      await sendMessage(msg.from, "Não consegui salvar o reagendamento agora. Tente novamente em alguns instantes.");
    }
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
    if (session.cpf) {
      session.etapa = "pagamento";
      await sendMessage(msg.from, paymentMenu());
    } else {
      session.etapa = "cpf";
      await sendMessage(msg.from, "Para concluir a contratação, informe seu CPF. Você pode enviar somente os 11 números ou no formato 000.000.000-00.");
    }
    return;
  }

  if (session.etapa === "identificar_cpf") {
    /*
     * IDENTIDADE DO CLIENTE
     * O CPF é normalizado para 11 dígitos e consultado no índice único do banco.
     * Se não existir, o fluxo vai para cadastro_nome e depois retoma a ação.
     */
    if (!isValidCpf(rawText)) {
      await sendMessage(msg.from, "O CPF informado não é válido. Confira os 11 números e tente novamente.");
      return;
    }
    session.cpf = cpfDigits(rawText);
    let registeredClient = null;
    try { registeredClient = await findClientByCpf(session.cpf); } catch (error) {
      addLog(error.message, "error");
      await sendMessage(msg.from, "Não consegui consultar seu cadastro agora. Tente novamente em alguns instantes.");
      return;
    }
    if (!registeredClient) {
      session.etapa = "cadastro_nome";
      await sendMessage(msg.from, "Não encontrei um cadastro com esse CPF. Vou cadastrar você agora. Qual é o seu nome completo?");
      return;
    }
    session.nome = registeredClient.nome || "";
    session.clientePhone = registeredClient.phone;
    if (session.acaoPendente === "agendar") {
      session.etapa = "servico";
      await sendMessage(msg.from, `Cadastro encontrado, *${session.nome}*. Vamos ao seu pedido.\n\n${serviceMenu()}`);
      return;
    }
    let appointment = null;
    try { appointment = await findLatestAppointment(registeredClient.phone); } catch (error) {
      addLog(error.message, "error");
      await sendMessage(msg.from, "Encontrei seu cadastro, mas não consegui consultar o agendamento agora. Tente novamente em alguns instantes.");
      return;
    }
    if (!appointment) {
      if (session.acaoPendente === "reagendar") {
        session.acaoPendente = "agendar";
        session.etapa = "servico";
        await sendMessage(msg.from, `Cadastro encontrado, mas não há agendamento ativo para remarcar. Vamos criar um novo.\n\n${serviceMenu()}`);
      } else {
        session.etapa = "menu";
        await sendMessage(msg.from, `Cadastro encontrado, mas não há agendamento ativo para esse CPF.\n\n${menuText(session.nome)}`);
      }
      return;
    }
    if (session.acaoPendente === "consultar") {
      session.etapa = "menu";
      await sendMessage(msg.from, `Seu agendamento:\n\nServiço: *${appointment.servico || "A confirmar"}*\nDia: *${appointment.agendamento_dia || "A confirmar"}*\nPeríodo: *${appointment.agendamento_turno || "A confirmar"}*\nStatus: *${appointment.status || "Pendente"}*\nPagamento: *${appointment.pagamento || "A combinar"}*\n\n${menuText(session.nome)}`);
      return;
    }
    session.appointmentId = appointment.id;
    session.appointmentObservacoes = appointment.observacoes || "";
    session.dias = nextWorkingDays(botConfig.diasParaExibir || 6);
    session.etapa = "reagendamento_dia";
    await sendMessage(msg.from, "Encontrei seu agendamento. Para qual novo dia deseja remarcar?\n\n" + session.dias.map((day, index) => `${index + 1}️⃣ ${day.label}`).join("\n"));
    return;
  }

  if (session.etapa === "cadastro_nome") {
    if (rawText.length < 3 || rawText.length > 120) {
      await sendMessage(msg.from, "Informe um nome válido, com até 120 caracteres.");
      return;
    }
    session.nome = rawText.replace(/[<>]/g, "");
    try {
      const createdClient = await saveClient(session);
      session.clientePhone = createdClient?.phone || session.phone;
    } catch (error) {
      addLog(error.message, "error");
      await sendMessage(msg.from, "Não consegui criar seu cadastro agora. Confira os dados ou tente novamente mais tarde.");
      return;
    }
    if (session.acaoPendente === "consultar") {
      session.etapa = "menu";
      await sendMessage(msg.from, `Cadastro criado com sucesso. Como ele é novo, ainda não existe agendamento associado.\n\n${menuText(session.nome)}`);
      return;
    }
    session.acaoPendente = "agendar";
    session.etapa = "servico";
    await sendMessage(msg.from, `Cadastro criado com sucesso.\n\n${serviceMenu()}`);
    return;
  }

  if (session.etapa === "cpf") {
    if (!isValidCpf(rawText)) {
      await sendMessage(msg.from, "O CPF informado não é válido. Confira os 11 números e tente novamente.");
      return;
    }
    session.cpf = formatCpf(rawText);
    session.etapa = "pagamento";
    await sendMessage(msg.from, paymentMenu());
    return;
  }

  if (session.etapa === "pagamento") {
    /*
     * PAGAMENTO
     * Pix exige QR e comprovante antes da confirmação. Cartão e presencial
     * seguem diretamente, mas todos persistem a escolha no mesmo campo.
     */
    const paymentMethods = { "1": "Pix", "2": "Cartão", "3": "Presencialmente" };
    const payment = paymentMethods[text];
    if (!payment) {
      await sendMessage(msg.from, paymentMenu());
      return;
    }
    session.pagamento = payment;
    if (payment === "Pix") {
      session.etapa = "comprovante_pix";
      await sendPixInstructions(msg.from);
      return;
    }
    session.etapa = "confirmacao";
    await sendAppointmentConfirmation(msg.from, session);
    return;
  }

  if (session.etapa === "comprovante_pix") {
    if (!text.includes("feito") || !msg.hasMedia) {
      await sendMessage(msg.from, `Ainda estou aguardando o comprovante. Anexe a imagem ou o documento do pagamento e escreva *feito* na legenda.\n\nChave Pix: *${PIX_KEY}*`);
      return;
    }
    session.comprovanteRecebido = true;
    session.historico.push({ autor: "cliente", texto: "[Comprovante Pix recebido]", timestamp: new Date().toISOString() });
    session.etapa = "confirmacao";
    await sendMessage(msg.from, "✅ Comprovante recebido. A confirmação financeira será feita pela equipe.");
    await sendAppointmentConfirmation(msg.from, session);
    return;
  }

  if (session.etapa === "confirmacao") {
    /*
     * COMMIT DO ATENDIMENTO
     * Este é o ponto em que cliente e agendamento são realmente persistidos.
     * A mensagem de sucesso só é enviada depois das duas operações concluírem.
     */
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
  return "Qual tipo de atendimento você procura?\n\n" +
    botConfig.servicos.map((service, index) => `${index + 1}️⃣ ${service.nome} — ${formatMoney(service.valor)}`).join("\n");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function cpfDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpf(value) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return (remainder === 10 ? 0 : remainder) === Number(digits[length]);
  };
  return check(9) && check(10);
}

function formatCpf(value) {
  return cpfDigits(value).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function maskedCpf(value) {
  const digits = cpfDigits(value);
  return digits.length === 11 ? `***.***.${digits.slice(6, 9)}-${digits.slice(9)}` : "informado";
}

function paymentMenu() {
  return "Qual será a forma de pagamento?\n\n1️⃣ Pix\n2️⃣ Cartão\n3️⃣ Presencialmente";
}

/* ==========================================================================
   BLOCO 7 — RECEPÇÃO DE EVENTOS E INICIALIZAÇÃO DO BOT
   ==========================================================================
   O evento "message" entrega cada mensagem recebida ao motor do bloco anterior.
   O .catch() é obrigatório para uma falha isolada não encerrar o processo.

   client.initialize() abre o navegador interno, restaura LocalAuth e começa a
   sincronização com o WhatsApp. Esta chamada deve ocorrer uma única vez por
   processo. DISABLE_WHATSAPP=true é usado em testes ou manutenção para iniciar
   apenas o servidor HTTP, sem abrir o navegador interno.
   ========================================================================== */

if (client) {
  client.on("message", (msg) => {
    handleWhatsAppMessage(msg).catch((error) => addLog(error.stack || error.message, "error"));
  });
  client.initialize().catch((error) => {
    botStatus = "ERRO";
    addLog(`Falha ao iniciar WhatsApp: ${error.message}`, "error");
  });
}

/* ==========================================================================
   BLOCO 8 — SERVIDOR HTTP E PROTEÇÕES GERAIS
   ==========================================================================
   A partir de `const app = express()` começa a parte servidor deste arquivo.
   Tudo acima prepara dados e integrações; tudo abaixo recebe requisições web.

   Middlewares críticos:
   - express.json({ limit: "32kb" }): aceita JSON e limita payload abusivo.
   - cabeçalhos X-Content-Type-Options/X-Frame-Options: reduzem ataques comuns.
   - controle em /api: limita requisições por IP durante cada minuto.
   - strict routing: diferencia /admin de /admin/ e evita loop de redireção.

   A ordem dos middlewares é funcional. Proteções precisam ser registradas antes
   das rotas; o tratador de erros precisa ficar depois de todas elas.
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

/* --------------------------------------------------------------------------
   SUB-BLOCO 8.1 — AUTENTICAÇÃO ADMINISTRATIVA
   --------------------------------------------------------------------------
   O login cria um token aleatório, armazenado em adminSessions e enviado em
   cookie HttpOnly. O JavaScript da página não consegue ler esse cookie.
   safeEqual() usa comparação resistente a diferenças de tempo; protectAdmin()
   bloqueia tanto páginas /admin quanto APIs /api/admin sem sessão válida.

   Estas sessões são intencionalmente temporárias e somem ao reiniciar o Node.
   O usuário e o hash da senha continuam persistidos no Supabase.
   -------------------------------------------------------------------------- */

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function createAdminSession(remember) {
  const token = crypto.randomBytes(32).toString("hex");
  const maxAge = remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
  adminSessions.set(token, Date.now() + maxAge * 1000);
  return { token, maxAge };
}

function getAdminSession(req) {
  const token = parseCookies(req.headers.cookie).sentir_bem_admin;
  const expiresAt = token && adminSessions.get(token);
  if (!expiresAt) return null;
  if (expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return token;
}

function protectAdmin(req, res, next) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) return res.status(503).send("Painel administrativo não configurado.");
  if (getAdminSession(req)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Sessão expirada. Entre novamente." });
  return res.redirect(302, `/pages/login.html?next=${encodeURIComponent(req.originalUrl)}`);
}

/* ==========================================================================
   BLOCO 9 — ROTAS DA API E PAINEL ADMINISTRATIVO
   ==========================================================================
   Rotas públicas:
   - GET /api/health: informa se servidor, WhatsApp e banco estão disponíveis.
   - POST /api/auth/login: valida credenciais e cria o cookie administrativo.

   Rotas protegidas:
   - /api/admin/config: lê e salva fluxo, expediente e parâmetros do bot.
   - /api/admin/sessions: mostra somente atendimentos atualmente em andamento.
   - /api/admin/clients e /appointments: alimentam pacientes, agenda e financeiro.
   - rotas de status/clear/delete/reset: exigem validação e confirmação explícita.
   - /logs/stream: envia logs em tempo real por Server-Sent Events (SSE).

   A validação de config impede remover etapas estruturais ou salvar horários
   inválidos. A chave administrativa do Supabase nunca é enviada ao navegador:
   o painel conversa com estas rotas, e somente o servidor conversa com o banco.
   ========================================================================== */

app.get("/api/health", (req, res) => res.json({
  ok: true,
  whatsapp: botStatus,
  database: supabaseAccessConfigured,
  databaseStatus: !supabaseConfigured
    ? "not_configured"
    : supabaseAccessConfigured
      ? "configured"
      : "insufficient_key"
}));

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) {
      return res.status(503).json({ error: "Login administrativo não configurado." });
    }
    if (!await authenticateAdmin(username, password)) {
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }
    const { token, maxAge } = createAdminSession(Boolean(req.body.remember));
    res.setHeader("Set-Cookie", `sentir_bem_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`);
    res.json({ ok: true, redirect: "/admin/" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  const token = parseCookies(req.headers.cookie).sentir_bem_admin;
  if (token) adminSessions.delete(token);
  res.setHeader("Set-Cookie", "sentir_bem_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.use(["/admin", "/api/admin"], protectAdmin);
app.get("/admin", (req, res) => res.redirect(301, "/admin/"));
app.get("/admin/", (req, res) => res.sendFile(path.join(ADMIN_PATH, "index.html")));
app.use("/admin", express.static(ADMIN_PATH, { index: false, dotfiles: "deny" }));

app.get("/api/admin/status", (req, res) => res.json({ status: botStatus, qr: latestQrCode }));
app.get("/api/admin/config", (req, res) => res.json(botConfig));
app.post("/api/admin/config", async (req, res, next) => {
  try {
  const stringFields = ["nomeEmpresa", "nomeAssistente", "profissional", "crp", "mensagemInicial", "mensagemFinal", "saudacaoAdicional", "privacidade", "endereco", "linkMapa", "horarioManha", "horarioTarde"];
  const updates = Object.fromEntries(stringFields.filter((key) => typeof req.body[key] === "string").map((key) => [key, req.body[key].trim().slice(0, 500)]));
  for (const key of ["formasPagamento", "todosServicos", "periodos", "mensagensInicio", "palavrasInicio"]) {
    if (Array.isArray(req.body[key])) updates[key] = req.body[key].map((item) => String(item).trim().slice(0, 160)).filter(Boolean).slice(0, 100);
  }
  if (Array.isArray(req.body.fluxoPrincipal)) {
    updates.fluxoPrincipal = req.body.fluxoPrincipal.slice(0, 30).map((step, index) => ({
      id: String(step.id || `etapa-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80),
      tipo: ["boasVindas", "consentimento", "servicos", "agenda", "mensagem"].includes(step.tipo) ? step.tipo : "mensagem",
      titulo: String(step.titulo || `Etapa ${index + 1}`).trim().slice(0, 100),
      conteudo: String(step.conteudo || "").trim().slice(0, 500),
      obrigatoria: Boolean(step.obrigatoria)
    })).filter((step) => step.id && step.titulo);
    const requiredTypes = ["boasVindas", "consentimento", "servicos", "agenda"];
    if (requiredTypes.some((type) => !updates.fluxoPrincipal.some((step) => step.tipo === type))) {
      return res.status(400).json({ error: "O fluxo precisa manter as etapas estruturais de boas-vindas, consentimento, serviços e agenda." });
    }
    const positions = Object.fromEntries(requiredTypes.map((type) => [type, updates.fluxoPrincipal.findIndex((step) => step.tipo === type)]));
    if (!(positions.boasVindas < positions.consentimento && positions.consentimento < positions.servicos && positions.servicos < positions.agenda)) {
      return res.status(400).json({ error: "As etapas estruturais precisam manter a ordem segura do atendimento." });
    }
    if (updates.fluxoPrincipal.some((step, index) => step.tipo === "mensagem" && (index <= positions.consentimento || index >= positions.servicos))) {
      return res.status(400).json({ error: "Etapas personalizadas devem ficar entre o consentimento e a escolha de serviço." });
    }
  }
  for (const key of ["chatbotAtivo", "respostaForaHorario", "lembreteAutomatico"]) {
    if (typeof req.body[key] === "boolean") updates[key] = req.body[key];
  }
  if (Number.isInteger(req.body.diasParaExibir)) updates.diasParaExibir = Math.min(30, Math.max(1, req.body.diasParaExibir));
  if (Number.isInteger(req.body.duracaoConsultaMinutos)) updates.duracaoConsultaMinutos = Math.min(240, Math.max(10, req.body.duracaoConsultaMinutos));
  if (Number.isInteger(req.body.intervaloMinutos)) updates.intervaloMinutos = Math.min(120, Math.max(0, req.body.intervaloMinutos));
  if (req.body.expediente && typeof req.body.expediente === "object") {
    updates.expediente = Object.fromEntries(Object.keys(DEFAULT_WORK_SCHEDULE).map((day) => {
      const received = req.body.expediente[day] || {};
      const fallback = botConfig.expediente?.[day] || DEFAULT_WORK_SCHEDULE[day];
      const validTime = (value, defaultValue) => /^\d{2}:\d{2}$/.test(value) ? value : defaultValue;
      return [day, {
        ativo: typeof received.ativo === "boolean" ? received.ativo : fallback.ativo,
        inicio: validTime(received.inicio, fallback.inicio),
        fim: validTime(received.fim, fallback.fim)
      }];
    }));
    if (!Object.values(updates.expediente).some((schedule) => schedule.ativo)) {
      return res.status(400).json({ error: "Ative pelo menos um dia de trabalho." });
    }
    if (Object.values(updates.expediente).some((schedule) => schedule.ativo && schedule.inicio >= schedule.fim)) {
      return res.status(400).json({ error: "O horário final deve ser posterior ao horário inicial." });
    }
  }
  if (req.body.emergencia && typeof req.body.emergencia === "object") {
    updates.emergencia = {
      ...botConfig.emergencia,
      ...Object.fromEntries(["samu", "cvv", "mensagem"]
        .filter((key) => typeof req.body.emergencia[key] === "string")
        .map((key) => [key, req.body.emergencia[key].trim().slice(0, 500)]))
    };
  }
  if (Array.isArray(req.body.servicos)) {
    updates.servicos = normalizeServiceCatalog(req.body.servicos).slice(0, 100);
  } else if (req.body.servicos && typeof req.body.servicos === "object") {
    updates.servicos = normalizeServiceCatalog(Object.values(req.body.servicos)).slice(0, 100);
  }
  const next = { ...botConfig, ...updates };
  if (!next.nomeEmpresa || !Array.isArray(next.servicos) || next.servicos.length === 0) return res.status(400).json({ error: "Configuração inválida." });
  await persistConfig(next, process.env.ADMIN_USER);
  botConfig = next;
  res.json({ success: true, message: "Configuração atualizada." });
  } catch (error) {
    next(error);
  }
});
app.get("/api/admin/sessions", (req, res) => res.json(Array.from(sessions.values())));
app.get("/api/admin/clients", async (req, res, next) => { try { res.json(await listClients()); } catch (e) { next(e); } });
app.get("/api/admin/appointments", async (req, res, next) => { try { res.json(await listAppointments()); } catch (e) { next(e); } });
app.post("/api/admin/appointments/status", async (req, res, next) => {
  try {
    const allowed = ["Pendente", "Confirmado", "Concluído", "Cancelado"];
    if (!req.body.id || !allowed.includes(req.body.status)) return res.status(400).json({ error: "Status inválido." });
    const appointment = await updateAppointmentStatus(req.body.id, req.body.status);
    if (supabase && !appointment) return res.status(404).json({ error: "Agendamento não encontrado." });
    res.json({ success: true, appointment });
  } catch (e) { next(e); }
});
app.post("/api/admin/appointments/clear", async (req, res, next) => {
  try {
    if (req.headers["x-confirm-action"] !== "CLEAR_APPOINTMENTS") return res.status(400).json({ error: "Confirmação explícita necessária." });
    const removed = await clearAppointments();
    res.json({ success: true, removed });
  } catch (e) { next(e); }
});
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
   BLOCO 10 — SITE PÚBLICO E TRATAMENTO CENTRAL DE ERROS
   ==========================================================================
   express.static publica apenas assets, CSS, JavaScript, páginas e o diretório
   administrativo já protegido. O fallback entrega index.html para rotas do site
   institucional.

   O middleware final de erro registra a pilha no servidor, mas responde ao
   navegador somente "Erro interno do servidor". Isso evita expor caminhos,
   consultas ou detalhes do banco para visitantes.
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
   BLOCO 11 — CICLO DE VIDA DO SERVIDOR
   ==========================================================================
   http.createServer(app) transforma o aplicativo Express em um servidor real.

   startServer() segue esta ordem:
   1. garante o administrador no Supabase;
   2. carrega a configuração persistida;
   3. começa a escutar a PORT;
   4. imprime links do site e do painel.

   O teste `require.main === module` evita abrir a porta quando o arquivo é
   importado pelos testes. shutdown() destrói o Client e fecha o HTTP ao receber
   SIGINT/SIGTERM, reduzindo sessões travadas do navegador interno.
   ========================================================================== */

const server = http.createServer(app);

function showServerLinks() {
  const localUrl = `http://localhost:${PORT}`;
  console.log("\n============================================================");
  console.log("  SERVIDOR SENTIR BEM RODANDO");
  console.log("============================================================");
  console.log(`  Index principal: ${localUrl}/`);
  console.log(`  Tela de admin:    ${localUrl}/admin/`);
  console.log("============================================================\n");
}

async function startServer() {
  if (supabaseAccessConfigured) {
    try {
      await ensureAdminRecord();
      await loadPersistedConfig();
      addLog("Configurações e administrador sincronizados com o Supabase.");
    } catch (error) {
      addLog(`Falha ao sincronizar dados administrativos: ${error.message}`, "error");
    }
  }
  return server.listen(PORT, () => {
    addLog(`Servidor Sentir Bem ativo na porta ${PORT}.`);
    showServerLinks();
  });
}

if (require.main === module) startServer().catch((error) => {
  addLog(error.stack || error.message, "error");
  process.exit(1);
});

async function shutdown() {
  addLog("Encerrando servidor...");
  if (client) await client.destroy().catch(() => {});
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/* ==========================================================================
   BLOCO 12 — INTERFACE DE TESTES
   ==========================================================================
   Somente funções puras ou pontos controlados são exportados. Isso permite
   validar CPF, gatilhos, crise e chaves do Supabase sem enviar mensagens reais.
   startServer também é exportado para testes de integração, mas não executa
   automaticamente quando chatbot.js é apenas importado.
   ========================================================================== */

module.exports = {
  app,
  server,
  startServer,
  classifySupabaseKey,
  isCrisisMessage,
  isValidCpf,
  isStartKeywordMessage,
  isStartMessage,
  normalize
};
