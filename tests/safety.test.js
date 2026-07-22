"use strict";

/* ========================================================================== 
   Preparação do ambiente de testes
   ========================================================================== */

process.env.DISABLE_WHATSAPP = "true";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isCrisisMessage, normalize } = require("../chatbot");

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
