"use strict";

/* ========================================================================== 
   Preparação do ambiente de testes
   ========================================================================== */

process.env.DISABLE_WHATSAPP = "true";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifySupabaseKey,
  isAttendancePayment,
  isCrisisMessage,
  isFinancialAppointment,
  isValidCpf,
  isStartKeywordMessage,
  isStartMessage,
  normalize
} = require("../chatbot");

test("valida CPF antes de avançar para o pagamento", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("123"), false);
});

/* ========================================================================== 
   Testes de normalização de mensagens
   ========================================================================== */

test("normaliza texto em português", () => {
  assert.equal(normalize("  NÃO ESTOU BEM  "), "nao estou bem");
});

/* ========================================================================== 
   Testes de identificação de crise
   ========================================================================== */

test("identifica mensagens prioritárias de crise", () => {
  [
    "quero morrer",
    "vou me matar",
    "penso em suicídio",
    "não quero viver",
    "estou em perigo",
    "tive uma overdose"
  ].forEach((message) => assert.equal(isCrisisMessage(message), true, message));
});

test("não classifica temas cotidianos como crise", () => {
  ["estou ansioso", "não consigo dormir", "estou estressado no trabalho"]
    .forEach((message) => assert.equal(isCrisisMessage(message), false, message));
});

test("inicia somente com uma mensagem configurada", () => {
  const triggers = ["Oi", "Quero agendar", "Bom dia"];
  assert.equal(isStartMessage("  QUERO AGENDAR  ", triggers), true);
  assert.equal(isStartMessage("bom dia", triggers), true);
  assert.equal(isStartMessage("preciso de informações", triggers), false);
  assert.equal(isStartMessage("oi, tudo bem?", triggers), false);
});

test("identifica palavras de início dentro de uma frase completa", () => {
  const keywords = ["ansiedade", "dor no peito", "não estou bem"];
  assert.equal(isStartKeywordMessage("Estou com muita ansiedade hoje", keywords), true);
  assert.equal(isStartKeywordMessage("Acordei com DOR NO PEITO", keywords), true);
  assert.equal(isStartKeywordMessage("eu não estou bem desde ontem", keywords), true);
  assert.equal(isStartKeywordMessage("eu adoraria conversar", ["dor"]), false);
  assert.equal(isStartKeywordMessage("quero informações sobre horários", keywords), false);
});

test("diferencia chaves públicas e privadas do Supabase", () => {
  assert.equal(classifySupabaseKey("sb_publishable_exemplo"), "anon");
  assert.equal(classifySupabaseKey("sb_secret_exemplo"), "secret");
  assert.equal(classifySupabaseKey("valor-invalido"), "unknown");
});
test("inclui Pix e pagamento presencial no controle de presença", () => {
  assert.equal(isAttendancePayment("Pix"), true);
  assert.equal(isAttendancePayment("Presencialmente"), true);
  assert.equal(isAttendancePayment("presencial"), true);
  assert.equal(isAttendancePayment("Cartão"), false);
});

test("retira cancelamentos e faltas do total financeiro", () => {
  assert.equal(isFinancialAppointment({ status: "Confirmado", valor_final: 150 }), true);
  assert.equal(isFinancialAppointment({ status: "Não compareceu", valor_final: 150 }), false);
  assert.equal(isFinancialAppointment({ status: "Cancelado", valor_final: 150 }), false);
  assert.equal(isFinancialAppointment({ status: "Pendente", valor_final: 0 }), false);
});
