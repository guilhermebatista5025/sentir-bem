"use strict";

/* ========================================================================== 
   Preparação do ambiente de testes
   ========================================================================== */

process.env.DISABLE_WHATSAPP = "true";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isCrisisMessage, isStartKeywordMessage, isStartMessage, normalize } = require("../chatbot");

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
