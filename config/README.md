# Configuração do chatbot

Esta pasta contém `bot.json`, um arquivo de configuração em formato JSON.

JSON é uma forma organizada de guardar informações usando nomes e valores. Ele não executa código; apenas fornece dados para o `chatbot.js`.

## O que cada campo controla

- `nomeEmpresa`: nome exibido pelo atendimento.
- `nomeAssistente`: nome usado pelo bot.
- `profissional` e `crp`: identificação profissional.
- `timezone`: fuso horário utilizado nas datas.
- `mensagemInicial`: primeira explicação enviada ao usuário.
- `mensagemFinal`: texto enviado depois do registro.
- `servicos`: opções de atendimento oferecidas.
- `periodos`: turnos disponíveis.
- `diasParaExibir`: quantidade de dias sugeridos para agendamento.
- `privacidade`: aviso sobre uso seguro dos dados.
- `emergencia`: telefones e orientação para situações urgentes.

É importante manter aspas, vírgulas e colchetes corretos, pois um erro de formato impede o bot de iniciar.
