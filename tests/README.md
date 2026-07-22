# Testes automáticos

Testes são verificações executadas pelo computador para confirmar que partes importantes continuam funcionando depois de uma alteração.

`safety.test.js` verifica principalmente:

- a normalização de frases em português;
- a identificação de mensagens que indicam risco ou crise;
- a prevenção de falsos alertas em mensagens cotidianas.

Execute `npm test` na raiz do projeto. Quando todos os testes aparecem como `ok`, as regras verificadas estão funcionando.
