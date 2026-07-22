// Configuração da URL da API do backend
// Deixe vazio ("") se o frontend e o backend estiverem rodando no mesmo servidor.
// Caso contrário, informe a URL do seu backend implantado na nuvem (ex: "https://seu-chatbot-backend.up.railway.app").
const API_URL = "";

// Função auxiliar para obter a cor correspondente a cada tipo de serviço
function getServiceColor(servico) {
  if (!servico) return "#2563EB";
  const name = servico.toLowerCase();
  
  if (name.includes("lavagem")) {
    return "#3B82F6"; // Azul brilhante
  } else if (name.includes("higienização") || name.includes("higienizacao") || name.includes("detalhamento interno")) {
    return "#10B981"; // Verde esmeralda
  } else if (name.includes("polimento") || name.includes("lustro")) {
    return "#F59E0B"; // Laranja / Âmbar
  } else if (name.includes("vitrificação") || name.includes("vitrificacao")) {
    return "#8B5CF6"; // Roxo violeta
  } else if (name.includes("verniz") || name.includes("motor")) {
    return "#06B6D4"; // Ciano
  } else if (name.includes("farol") || name.includes("faróis") || name.includes("farois")) {
    return "#EAB308"; // Amarelo ouro
  } else if (name.includes("mecanica") || name.includes("mecânica")) {
    return "#EF4444"; // Vermelho
  }
  
  // Hash consistente para serviços dinâmicos cadastrados pelo usuário
  const hash = servico.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4", "#EAB308", "#EF4444", "#EC4899", "#14B8A6"];
  return colors[hash % colors.length];
}

function getServiceColorGlow(color) {
  // Retorna a cor com 15% de opacidade para a sombra (glow)
  return color + "26";
}

// Caches globais compartilhados para sincronismo em tempo real
let activeSessionsCache = [];
let completedAppointmentsCache = [];

// Função auxiliar para formatar números de telefone no padrão: +55 (DDD) 999999-999 ou +55 (DDD) 99999-999
function formatPhoneNumber(num) {
  if (!num) return "";
  const clean = num.replace(/\D/g, "");
  
  if (clean.startsWith("55") && clean.length >= 11) {
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 6)}-${rest.slice(6)}`;
    } else {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
  }
  
  if (clean.length >= 10) {
    const ddd = clean.slice(0, 2);
    const rest = clean.slice(2);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 6)}-${rest.slice(6)}`;
    } else {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
  }

  return num;
}

document.addEventListener("DOMContentLoaded", () => {
  // Inicializações
  initThemeManager();
  initNavigation();
  initStatusMonitoring();
  initLogsStream();
  initSessionsMonitoring();
  initCalendarMonitoring();
  initClientsMonitoring();
  initConfigurationManager();
});

// ==========================================================================
// 0. GERENCIADOR DE TEMAS (TEMA CLARO FORÇADO)
// ==========================================================================
function initThemeManager() {
  // Forçar sempre o belíssimo tema claro institucional de seções brancas
  document.body.classList.add("light-theme");
  localStorage.setItem("theme", "light");
  
  // Atualizar o gráfico em tempo real para o tema claro
  setTimeout(() => {
    updateChartTheme();
  }, 200);
}

function updateChartTheme() {
  if (!servicesChart) return;
  const isLight = document.body.classList.contains("light-theme");
  
  // Atualizar cores das labels das escalas
  servicesChart.options.scales.x.ticks.color = isLight ? "#475569" : "#9ca3af";
  servicesChart.options.scales.y.ticks.color = isLight ? "#475569" : "#9ca3af";
  servicesChart.options.scales.y.grid.color = isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.03)";
  
  // Atualizar cores do tooltip
  servicesChart.options.plugins.tooltip.backgroundColor = isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(12, 17, 28, 0.95)";
  servicesChart.options.plugins.tooltip.titleColor = isLight ? "#0f172a" : "#fff";
  servicesChart.options.plugins.tooltip.bodyColor = isLight ? "#475569" : "#f3f4f6";
  servicesChart.options.plugins.tooltip.borderColor = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)";

  // Atualizar cores das barras com base nos serviços
  const labels = servicesChart.data.labels || [];
  const barColors = labels.map(label => getServiceColor(label));
  servicesChart.data.datasets[0].backgroundColor = barColors;
  servicesChart.data.datasets[0].borderColor = barColors;
  servicesChart.data.datasets[0].hoverBackgroundColor = barColors;
  servicesChart.data.datasets[0].hoverBorderColor = barColors;
  
  servicesChart.update();
}

// ==========================================================================
// 1. GERENCIADOR DE ROTAS / NAVEGAÇÃO DA SIDEBAR
// ==========================================================================
function initNavigation() {
  const menuButtons = document.querySelectorAll(".menu-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");

  const pageMeta = {
    "section-overview": {
      title: "Visão Geral",
      subtitle: "Monitore o status e a saúde de seu assistente virtual."
    },
    "section-connection": {
      title: "Conectividade do WhatsApp",
      subtitle: "Gerencie a conexão e vincule novos aparelhos por QR Code."
    },
    "section-config": {
      title: "Configurações do Chatbot",
      subtitle: "Personalize saudações, serviços, formas de pagamento e localização do seu bot."
    },
    "section-sessions": {
      title: "Sessões Ativas no Funil",
      subtitle: "Monitore e interaja com os clientes que estão respondendo ao funil de agendamento."
    },
    "section-completed": {
      title: "Agendamentos Confirmados",
      subtitle: "Consulte e gerencie os agendamentos confirmados pelo chatbot em tempo real em formato de cards premium."
    },
    "section-ready": {
      title: "Prontos para Retirada",
      subtitle: "Monitore os veículos que já foram finalizados pelos colaboradores e entre em contato com os clientes para entrega."
    },
    "section-clients": {
      title: "CRM - Clientes Cadastrados",
      subtitle: "Consulte CPFs, contatos e a frota de veículos registrados por seus clientes."
    },
    "section-calendar": {
      title: "Calendário de Agendamentos",
      subtitle: "Monitore os dias e horários de serviços agendados de forma visual e intuitiva."
    },
    "section-logs": {
      title: "Console de Logs do Sistema",
      subtitle: "Logs em tempo real de mensagens recebidas, conexões e processamentos."
    }
  };

  menuButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      if (!targetId) return;

      // Troca active button
      menuButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      // Troca active tab
      tabContents.forEach(content => content.classList.remove("active"));
      document.getElementById(targetId).classList.add("active");

      // Atualiza títulos
      if (pageMeta[targetId]) {
        pageTitle.textContent = pageMeta[targetId].title;
        pageSubtitle.textContent = pageMeta[targetId].subtitle;
      }
    });
  });

  // Torna os cards de métricas da visão geral clicáveis para navegação nas abas
  document.querySelectorAll(".clickable-metric-card").forEach(card => {
    card.addEventListener("click", () => {
      const targetId = card.getAttribute("data-target");
      const menuBtn = document.querySelector(`.menu-item[data-target="${targetId}"]`);
      if (menuBtn) {
        menuBtn.click();
      }
    });
  });
}

// ==========================================================================
// 2. MONITORAMENTO DE STATUS E CONEXÃO DO WHATSAPP
// ==========================================================================
let currentStatus = "DESCONECTADO";
let lastQrString = null;
let systemUptimeStart = new Date();

function initStatusMonitoring() {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  
  // Elementos Overview
  const qrContainer = document.getElementById("qr-container");
  const qrSpinner = document.getElementById("qr-spinner");
  const qrGraphic = document.getElementById("qr-code-graphic");
  const connectedContainer = document.getElementById("connected-container");
  const connectedPhone = document.getElementById("connected-phone-number");
  
  // Elementos da Aba de Conexão
  const tabQrContainer = document.getElementById("tab-qr-container");
  const tabQrSpinner = document.getElementById("tab-qr-spinner");
  const tabQrGraphic = document.getElementById("tab-qr-code-graphic");
  const tabConnectedContainer = document.getElementById("tab-connected-container");
  const tabConnectedPhone = document.getElementById("tab-connected-phone-number");
  
  const btnLogoutWhatsapp = document.getElementById("btn-logout-whatsapp");
  const clockMetric = document.getElementById("metric-clock");

  // Real-time local clock ticker
  setInterval(() => {
    if (clockMetric) {
      clockMetric.textContent = new Date().toLocaleTimeString("pt-BR");
    }
  }, 1000);

  async function checkStatus() {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      const data = await res.json();

      if (data.status !== currentStatus || (data.status === "QR_CODE" && data.qr !== lastQrString)) {
        currentStatus = data.status;
        lastQrString = data.qr;

        // Resetar classes do dot
        statusDot.className = "status-dot pulsing";

        if (currentStatus === "CONECTADO") {
          statusDot.classList.add("connected");
          statusText.textContent = "CONECTADO";
          
          // Oculta QR, Mostra Conectado (Overview)
          if (qrContainer) qrContainer.classList.add("hidden");
          if (connectedContainer) connectedContainer.classList.remove("hidden");

          // Oculta QR, Mostra Conectado (Conexão Tab)
          if (tabQrContainer) tabQrContainer.classList.add("hidden");
          if (tabConnectedContainer) tabConnectedContainer.classList.remove("hidden");

          let phoneStr = "Linha ativa de atendimento";
          if (data.info && data.info.wid) {
            const num = data.info.wid.user;
            phoneStr = `Linha Ativa: ${formatPhoneNumber(num)}`;
          }

          if (connectedPhone) connectedPhone.textContent = phoneStr;
          if (tabConnectedPhone) tabConnectedPhone.textContent = phoneStr;
        } 
        else if (currentStatus === "QR_CODE") {
          statusDot.classList.add("qr_code");
          statusText.textContent = "ESCANEAR QR CODE";

          // Mostra QR, Oculta Conectado (Overview)
          if (connectedContainer) connectedContainer.classList.add("hidden");
          if (qrContainer) qrContainer.classList.remove("hidden");

          // Mostra QR, Oculta Conectado (Conexão Tab)
          if (tabConnectedContainer) tabConnectedContainer.classList.add("hidden");
          if (tabQrContainer) tabQrContainer.classList.remove("hidden");

          if (lastQrString) {
            if (qrSpinner) qrSpinner.classList.add("hidden");
            if (qrGraphic) qrGraphic.classList.remove("hidden");
            
            if (tabQrSpinner) tabQrSpinner.classList.add("hidden");
            if (tabQrGraphic) tabQrGraphic.classList.remove("hidden");

            renderQrCode(lastQrString);
          } else {
            if (qrSpinner) qrSpinner.classList.remove("hidden");
            if (qrGraphic) qrGraphic.classList.add("hidden");
            
            if (tabQrSpinner) tabQrSpinner.classList.remove("hidden");
            if (tabQrGraphic) tabQrGraphic.classList.add("hidden");
          }
        } 
        else {
          // DESCONECTADO
          statusDot.classList.add("disconnected");
          statusText.textContent = "DESCONECTADO";

          // Mostra QR (com loading), Oculta Conectado (Overview)
          if (connectedContainer) connectedContainer.classList.add("hidden");
          if (qrContainer) qrContainer.classList.remove("hidden");
          if (qrSpinner) {
            qrSpinner.classList.remove("hidden");
            qrSpinner.querySelector("span").textContent = "Aguardando inicialização do WhatsApp...";
          }
          if (qrGraphic) qrGraphic.classList.add("hidden");

          // Mostra QR (com loading), Oculta Conectado (Conexão Tab)
          if (tabConnectedContainer) tabConnectedContainer.classList.add("hidden");
          if (tabQrContainer) tabQrContainer.classList.remove("hidden");
          if (tabQrSpinner) {
            tabQrSpinner.classList.remove("hidden");
            tabQrSpinner.querySelector("span").textContent = "Aguardando inicialização do WhatsApp...";
          }
          if (tabQrGraphic) tabQrGraphic.classList.add("hidden");
        }
      }
    } catch (error) {
      statusDot.className = "status-dot disconnected pulsing";
      statusText.textContent = "DESCONECTADO (ERRO API)";
    }
  }

  function renderQrCode(qrText) {
    try {
      const typeNumber = 0; // auto-detect
      const errorCorrectionLevel = "M";
      
      // Renderiza na Visão Geral
      if (qrGraphic) {
        const qr1 = qrcode(typeNumber, errorCorrectionLevel);
        qr1.addData(qrText);
        qr1.make();
        qrGraphic.innerHTML = qr1.createImgTag(6, 12);
      }

      // Renderiza na aba Conexão
      if (tabQrGraphic) {
        const qr2 = qrcode(typeNumber, errorCorrectionLevel);
        qr2.addData(qrText);
        qr2.make();
        tabQrGraphic.innerHTML = qr2.createImgTag(6, 12);
      }
    } catch (e) {
      console.error("Erro ao desenhar QR Code:", e);
      const errMsg = `<span style="color: red; font-size: 12px;">Erro ao carregar imagem do QR Code.</span>`;
      if (qrGraphic) qrGraphic.innerHTML = errMsg;
      if (tabQrGraphic) tabQrGraphic.innerHTML = errMsg;
    }
  }

  // Listener para botão de Logout / Desconexão
  if (btnLogoutWhatsapp) {
    btnLogoutWhatsapp.addEventListener("click", async () => {
      if (confirm("Tem certeza que deseja desconectar o WhatsApp? Isso irá desvincular a conta atual e você precisará escanear o QR Code novamente para conectar.")) {
        try {
          showToast("Solicitando desconexão...");
          const res = await fetch(`${API_URL}/api/logout`, { method: "POST" });
          const data = await res.json();
          if (data.success) {
            showToast(data.message);
            // Força reset visual de status para aguardando
            currentStatus = "DESCONECTADO";
            lastQrString = null;
            checkStatus();
          } else {
            showToast("Falha ao solicitar desconexão.");
          }
        } catch (e) {
          showToast("Erro de rede ao desconectar.");
        }
      }
    });
  }

  // Verifica status imediatamente e de 3 em 3 segundos
  checkStatus();
  setInterval(checkStatus, 3000);
}

// ==========================================================================
// 3. STREAM DE LOGS EM TEMPO REAL (SERVER-SENT EVENTS)
// ==========================================================================
function initLogsStream() {
  const terminal = document.getElementById("terminal-output");
  const clearButton = document.getElementById("btn-clear-logs");

  clearButton.addEventListener("click", () => {
    terminal.innerHTML = `<div class="log-line system"><span class="log-time">${new Date().toLocaleTimeString()}</span><span class="log-msg">🧹 Console limpo pelo administrador.</span></div>`;
  });

  const eventSource = new EventSource(`${API_URL}/api/logs/stream`);

  eventSource.onmessage = (event) => {
    try {
      const log = JSON.parse(event.data);
      appendLog(log);
    } catch (e) {
      console.error("Erro ao fazer parse do log recebido por SSE:", e);
    }
  };

  eventSource.onerror = (err) => {
    const line = document.createElement("div");
    line.className = "log-line error";
    line.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span><span class="log-msg">❌ Desconectado do servidor de logs. Tentando reconectar automaticamente...</span>`;
    terminal.appendChild(line);
    eventSource.close();
    
    // Tenta reconectar após 5 segundos
    setTimeout(initLogsStream, 5000);
  };

  function appendLog(log) {
    const line = document.createElement("div");
    line.className = `log-line ${log.type || "info"}`;
    
    // Tratar tags do bot como coloração visual
    let formattedMsg = log.message;
    if (formattedMsg.includes("✅")) {
      line.classList.add("success");
    } else if (formattedMsg.includes("🛑") || formattedMsg.includes("❌") || formattedMsg.includes("⚠️")) {
      line.classList.add("error");
    }

    line.innerHTML = `
      <span class="log-time">${log.timestamp || new Date().toLocaleTimeString()}</span>
      <span class="log-msg">${formattedMsg}</span>
    `;

    terminal.appendChild(line);

    // Auto-scroll para o fundo se estiver perto
    const threshold = 120;
    const isNearBottom = terminal.scrollHeight - terminal.clientHeight - terminal.scrollTop < threshold;
    if (isNearBottom) {
      terminal.scrollTop = terminal.scrollHeight;
    }

    // Corta logs velhos do DOM para economizar memória
    if (terminal.children.length > 250) {
      terminal.removeChild(terminal.firstChild);
    }
  }
}

// ==========================================================================
// 4. MONITORAMENTO E RESET DE SESSÕES ATIVAS
// ==========================================================================
function initSessionsMonitoring() {
  const tbody = document.getElementById("sessions-tbody");
  const sessionsBadge = document.getElementById("sessions-badge");
  const sessionsCount = document.getElementById("metric-active-sessions");

  // Elementos do Histórico
  const completedCardsContainer = document.getElementById("completed-cards-container");
  const btnClearAppointments = document.getElementById("btn-clear-appointments");
  const completedBadge = document.getElementById("completed-badge");

  // Elementos de Prontos p/ Retirada
  const readyCardsContainer = document.getElementById("ready-cards-container");
  const readyBadge = document.getElementById("ready-badge");

  // Globais do Modal de Detalhes
  const modal = document.getElementById("details-modal");
  const modalClientName = document.getElementById("modal-client-name");
  const modalDetailPhone = document.getElementById("modal-detail-phone");
  const modalDetailStage = document.getElementById("modal-detail-stage");
  const modalDetailService = document.getElementById("modal-detail-service");
  const modalDetailVehicle = document.getElementById("modal-detail-vehicle");
  const modalDetailPayment = document.getElementById("modal-detail-payment");
  const modalDetailPaymentRow = document.getElementById("modal-detail-payment-row");
  const modalDetailObs = document.getElementById("modal-detail-obs");
  const modalDetailObsRow = document.getElementById("modal-detail-obs-row");
  const modalChatTimeline = document.getElementById("modal-chat-timeline");
  const btnCloseModal = document.getElementById("btn-close-modal");

  // Arrays locais referenciando o cache global compartilhado

  // Fecha o modal
  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }
  
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }

  // Função para abrir o modal de detalhes com a transcrição do chat em tempo real
  function openDetailsModal(title, phone, stage, service, vehicle, payment, respostas, observacoes) {
    modalClientName.textContent = title;
    modalDetailPhone.textContent = phone;
    modalDetailStage.textContent = stage;
    modalDetailService.innerHTML = service || '<span style="color: var(--text-muted); font-style: italic;">Aguardando...</span>';
    modalDetailVehicle.innerHTML = vehicle || '<span style="color: var(--text-muted); font-style: italic;">Aguardando...</span>';
    
    if (payment) {
      modalDetailPaymentRow.style.display = "flex";
      modalDetailPayment.innerHTML = payment;
    } else {
      modalDetailPaymentRow.style.display = "none";
    }

    if (observacoes && observacoes !== "N/A") {
      modalDetailObsRow.style.display = "flex";
      modalDetailObs.textContent = observacoes;
    } else {
      modalDetailObsRow.style.display = "none";
    }

    modalChatTimeline.innerHTML = "";
    const chatHistory = respostas || [];

    if (chatHistory.length === 0) {
      modalChatTimeline.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic; text-align: center; display: block; padding: 24px;">Nenhuma interação registrada nesta sessão.</span>`;
    } else {
      chatHistory.forEach(msg => {
        const bubble = document.createElement("div");
        bubble.className = `timeline-bubble ${msg.autor}`;
        
        // Formatar quebras de linha e negritos/itálicos estilo WhatsApp
        let formattedText = msg.texto
          .replace(/\n/g, "<br>")
          .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
          .replace(/_(.*?)_/g, "<em>$1</em>");

        const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : "";

        bubble.innerHTML = `
          <div class="msg-content">${formattedText}</div>
          <span class="timeline-meta">${timeStr}</span>
        `;
        modalChatTimeline.appendChild(bubble);
      });
      
      // Forçar timeline a rolar para as últimas mensagens
      setTimeout(() => {
        modalChatTimeline.scrollTop = modalChatTimeline.scrollHeight;
      }, 50);
    }

    modal.classList.remove("hidden");
  }
  window.openDetailsModal = openDetailsModal; // Expor globalmente

  async function fetchSessions() {
    try {
      const res = await fetch(`${API_URL}/api/sessions`);
      const sessions = await res.json();
      activeSessionsCache = sessions;

      sessionsBadge.textContent = sessions.length;
      sessionsCount.textContent = `${sessions.length} Cliente${sessions.length === 1 ? "" : "s"}`;

      if (sessions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="table-empty">Nenhum cliente ativo no funil neste momento.</td>
          </tr>
        `;
      } else {
        tbody.innerHTML = "";
        sessions.forEach(sess => {
          const tr = document.createElement("tr");
          
          // Formatar número
          const formattedNum = formatPhoneNumber(sess.from);
          
          // Se houver pushname salvo, exibe Nome (Número)
          const displayName = sess.pushname && sess.pushname !== "Cliente"
            ? `${sess.pushname} (${formattedNum})`
            : formattedNum;

          // Etapa Badge
          let badgeClass = "menu";
          if (sess.etapa === "servico") badgeClass = "servico";
          else if (sess.etapa === "veiculo") badgeClass = "veiculo";
          else if (sess.etapa === "pagamento") badgeClass = "pagamento";

          const badgeHtml = `<span class="stage-badge ${badgeClass}">${sess.etapa}</span>`;

          // Hora formatada
          const dateStr = sess.timestamp ? new Date(sess.timestamp).toLocaleTimeString() : "N/A";

          tr.innerHTML = `
            <td style="font-weight: 600;">${displayName}</td>
            <td>${badgeHtml}</td>
            <td>${sess.servico || '<span style="color: var(--text-muted);">Aguardando...</span>'}</td>
            <td>${sess.veiculo || '<span style="color: var(--text-muted);">Aguardando...</span>'}</td>
            <td style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted);">${dateStr}</td>
            <td class="actions-col" style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
              <button class="btn-primary view-details-btn" data-phone="${sess.from}" style="padding: 6px 10px; font-size: 0.72rem;">
                + Info
              </button>
              <button class="btn-secondary danger reset-session-btn" data-phone="${sess.from}" style="padding: 6px 10px; font-size: 0.72rem;">
                Reset
              </button>
            </td>
          `;

          tbody.appendChild(tr);
        });

        // Evento de clique para o botão + Info (Modal)
        document.querySelectorAll(".view-details-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            const phone = btn.getAttribute("data-phone");
            const sess = activeSessionsCache.find(s => s.from === phone);
            if (!sess) return;
            
            const formattedNum = formatPhoneNumber(sess.from);
            const title = sess.pushname && sess.pushname !== "Cliente" ? `${sess.pushname} (${formattedNum})` : formattedNum;
            
            openDetailsModal(
              title, 
              formattedNum, 
              sess.etapa.toUpperCase(), 
              sess.servico, 
              sess.veiculo, 
              sess.pagamento, 
              sess.respostas,
              sess.observacoes
            );
          });
        });

        // Evento de clique para os botões de Reset
        document.querySelectorAll(".reset-session-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const phone = btn.getAttribute("data-phone");
            if (!phone) return;
            
            if (confirm("Deseja realmente resetar o progresso deste usuário? Ele voltará para a etapa inicial do menu.")) {
              try {
                const resetRes = await fetch(`${API_URL}/api/sessions/reset`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ from: phone })
                });
                const resetData = await resetRes.json();
                if (resetData.success) {
                  showToast("Sessão do cliente resetada com sucesso!");
                  fetchSessions();
                } else {
                  showToast("Erro ao resetar sessão.");
                }
              } catch (err) {
                showToast("Falha na comunicação com a API.");
              }
            }
          });
        });
      }
      if (typeof updateAnalytics === "function") {
        updateAnalytics(activeSessionsCache, completedAppointmentsCache);
      }
    } catch (e) {
      console.error("Erro ao buscar sessões ativas:", e);
    }
  }

  async function fetchAppointments() {
    try {
      const res = await fetch(`${API_URL}/api/appointments`);
      const appointments = await res.json();
      completedAppointmentsCache = appointments;

      // Filtrar agendamentos ativos e prontos (ignora "Entregue")
      const activeApps = appointments.filter(app => app.status !== "Entregue");
      const readyApps = appointments.filter(app => app.status === "Finalizado");

      if (completedBadge) {
        completedBadge.textContent = activeApps.length;
      }
      if (readyBadge) {
        readyBadge.textContent = readyApps.length;
      }
      const totalBookingsCountEl = document.getElementById("metric-total-bookings-count");
      if (totalBookingsCountEl) {
        totalBookingsCountEl.textContent = `${activeApps.length} Ativo(s)`;
      }

      // 1. RENDERIZAR CONFIRMADOS/ATIVOS
      if (completedCardsContainer) {
        if (activeApps.length === 0) {
          completedCardsContainer.innerHTML = `
            <div class="completed-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <p>Nenhum agendamento concluído recentemente.</p>
            </div>
          `;
        } else {
          completedCardsContainer.innerHTML = "";
          activeApps.forEach((app, idx) => {
            const card = document.createElement("div");
            card.className = "completed-card";

            const serviceColor = getServiceColor(app.servico);
            card.style.setProperty('--service-color', serviceColor);
            card.style.setProperty('--service-color-glow', getServiceColorGlow(serviceColor));

            const formattedNum = formatPhoneNumber(app.from);
            const dateStr = app.timestamp ? new Date(app.timestamp).toLocaleString("pt-BR") : "N/A";
            const valor = app.valorFinal ? `R$ ${app.valorFinal},00` : "Orçamento Manual";
            const turno = app.agendamentoTurno || "Geral";
            const isManha = turno.toLowerCase().includes("manhã") || turno.toLowerCase().includes("manha");
            const badgeClass = isManha ? "manha" : "tarde";
            const badgeText = isManha ? "Manhã" : "Tarde";
            const displayName = app.pushname && app.pushname !== "Cliente" ? app.pushname : "Cliente";

            card.innerHTML = `
              <div class="completed-card-header">
                <div class="completed-client-info">
                  <span class="completed-client-name">${displayName}</span>
                  <span class="completed-client-phone">${formattedNum}</span>
                </div>
                <span class="completed-price">${valor}</span>
              </div>
              <div class="completed-card-body">
                <div class="completed-info-row">
                  <span class="completed-info-label">💎 Serviço:</span>
                  <span class="completed-info-value" style="color: var(--service-color, var(--primary)); font-weight: 700;">${app.servico}</span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">🚗 Veículo:</span>
                  <span class="completed-info-value"><span class="stage-badge veiculo" style="font-size: 0.7rem; padding: 2px 6px;">${app.veiculo}</span></span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">⏱️ Período:</span>
                  <span class="completed-info-value">
                    <span class="app-period-badge ${badgeClass}" style="font-size: 0.68rem; padding: 2px 6px;">${badgeText}</span>
                  </span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">📅 Data:</span>
                  <span class="completed-info-value"><span class="stage-badge menu" style="font-size: 0.7rem; padding: 2px 6px;">${app.agendamentoDia}</span></span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">💳 Pagamento:</span>
                  <span class="completed-info-value"><span class="stage-badge pagamento" style="font-size: 0.7rem; padding: 2px 6px;">${app.pagamento}</span></span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">🚦 Status:</span>
                  <span class="completed-info-value">
                    <span class="stage-badge" style="font-size: 0.7rem; padding: 2px 6px; font-weight: 700; ${app.status === 'Finalizado' ? 'background-color: #DEF7EC; color: #03543F;' : 'background-color: #FEF08A; color: #713F12;'}">
                      ${app.status === 'Finalizado' ? '🟢 Pronto para entrega' : '🟡 Em andamento'}
                    </span>
                  </span>
                </div>
              </div>
              <div class="completed-card-footer">
                <div class="completed-date-time">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span>Finalizado: ${dateStr}</span>
                </div>
                <button class="btn-primary view-history-details-btn" data-id="${app.id}" style="padding: 6px 12px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
                  <span>+ Info</span>
                </button>
              </div>
            `;
            completedCardsContainer.appendChild(card);
          });
        }
      }

      // 2. RENDERIZAR PRONTOS PARA RETIRADA
      if (readyCardsContainer) {
        if (readyApps.length === 0) {
          readyCardsContainer.innerHTML = `
            <div class="completed-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <p>Nenhum veículo aguardando retirada ou pronto para entrega.</p>
            </div>
          `;
        } else {
          readyCardsContainer.innerHTML = "";
          readyApps.forEach((app) => {
            const card = document.createElement("div");
            card.className = "completed-card";

            const serviceColor = getServiceColor(app.servico);
            card.style.setProperty('--service-color', serviceColor);
            card.style.setProperty('--service-color-glow', getServiceColorGlow(serviceColor));

            const formattedNum = formatPhoneNumber(app.from);
            const cleanPhone = app.from.replace(/\D/g, "");
            
            // Placa limpa
            let plateClean = app.placa || "N/A";
            if (plateClean === "N/A" && app.veiculo && app.veiculo.includes("[")) {
              const parts = app.veiculo.split("[");
              if (parts.length > 1) {
                plateClean = parts[1].replace("]", "").trim();
              }
            }

            const valorText = app.valorFinal ? `R$ ${app.valorFinal},00` : "Orçamento Manual";
            const displayName = app.pushname && app.pushname !== "Cliente" ? app.pushname : "Cliente";
            const dateStr = app.timestamp ? new Date(app.timestamp).toLocaleString("pt-BR") : "N/A";

            // Template do link de contato direto do WhatsApp
            const msgTemplate = `Olá *${displayName}*! Seu veículo *${app.veiculo.split("[")[0].trim()}* placa *${plateClean}* já está pronto para retirada na Auto Sport Estética Automotiva! 🚗💎 O valor total ficou em ${valorText}. Pode vir retirar quando desejar! Obrigado pela preferência.`;
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msgTemplate)}`;

            card.innerHTML = `
              <div class="completed-card-header">
                <div class="completed-client-info">
                  <span class="completed-client-name">${displayName}</span>
                  <span class="completed-client-phone">${formattedNum}</span>
                </div>
                <span class="completed-price" style="color: var(--primary); text-shadow: 0 0 8px var(--primary-glow);">${valorText}</span>
              </div>
              <div class="completed-card-body">
                <div class="completed-info-row">
                  <span class="completed-info-label">💎 Serviço:</span>
                  <span class="completed-info-value" style="color: var(--service-color, var(--primary)); font-weight: 700;">${app.servico}</span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">🚗 Veículo:</span>
                  <span class="completed-info-value"><span class="stage-badge veiculo" style="font-size: 0.7rem; padding: 2px 6px;">${app.veiculo}</span></span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">📅 Data Concluído:</span>
                  <span class="completed-info-value"><span class="stage-badge menu" style="font-size: 0.7rem; padding: 2px 6px;">${dateStr}</span></span>
                </div>
                <div class="completed-info-row">
                  <span class="completed-info-label">💳 Pagamento:</span>
                  <span class="completed-info-value"><span class="stage-badge pagamento" style="font-size: 0.7rem; padding: 2px 6px;">${app.pagamento}</span></span>
                </div>
              </div>
              <div class="completed-card-footer" style="gap: 8px;">
                <a href="${whatsappUrl}" target="_blank" class="btn-primary" style="text-decoration: none; padding: 8px 12px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; border-radius: var(--radius-sm);">
                  <span>💬 Contatar Cliente</span>
                </a>
                <button class="btn-secondary danger btn-deliver-car" data-id="${app.id}" style="padding: 8px 12px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <span>📦 Entregar Veículo</span>
                </button>
              </div>
            `;
            readyCardsContainer.appendChild(card);
          });

          // Eventos para o botão "Entregar Veículo" (status -> "Entregue")
          document.querySelectorAll(".btn-deliver-car").forEach(btn => {
            btn.addEventListener("click", async () => {
              const appId = btn.getAttribute("data-id");
              if (!appId) return;

              if (confirm("Confirmar a entrega deste veículo ao cliente? Ele será enviado para o histórico de entregues.")) {
                try {
                  const resStatus = await fetch(`${API_URL}/api/appointments/status`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: appId, status: "Entregue" })
                  });
                  const result = await resStatus.json();
                  if (result.success) {
                    showToast("Veículo entregue e arquivado com sucesso!");
                    fetchAppointments();
                  } else {
                    showToast("Erro ao processar entrega do veículo.");
                  }
                } catch (err) {
                  showToast("Falha na comunicação com o servidor.");
                }
              }
            });
          });
        }
      }

      // Evento de clique para o botão + Info do Histórico (Modal)
      document.querySelectorAll(".view-history-details-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const appId = btn.getAttribute("data-id");
          const app = completedAppointmentsCache.find(a => a.id === appId);
          if (!app) return;
          
          const formattedNum = formatPhoneNumber(app.from);
          const title = app.pushname && app.pushname !== "Cliente" ? `${app.pushname} (${formattedNum})` : formattedNum;
          
          openDetailsModal(
            title, 
            formattedNum, 
            "CONCLUÍDO", 
            app.servico, 
            app.veiculo, 
            app.pagamento, 
            app.respostas,
            app.observacoes
          );
        });
      });

      if (typeof updateAnalytics === "function") {
        updateAnalytics(activeSessionsCache, completedAppointmentsCache);
      }
      if (typeof window.refreshCalendar === "function") {
        window.refreshCalendar();
      }
    } catch (e) {
      console.error("Erro ao buscar histórico de agendamentos:", e);
    }
  }

  // Listener para botão de Limpar Histórico
  if (btnClearAppointments) {
    btnClearAppointments.addEventListener("click", async () => {
      if (confirm("Deseja realmente limpar todo o histórico de agendamentos concluídos? Isso limpa apenas a lista visual do painel.")) {
        try {
          const res = await fetch(`${API_URL}/api/appointments/clear`, { method: "POST" });
          const data = await res.json();
          if (data.success) {
            showToast("Histórico de agendamentos limpo com sucesso!");
            fetchAppointments();
          } else {
            showToast("Falha ao limpar histórico.");
          }
        } catch (err) {
          showToast("Erro ao se comunicar com o servidor.");
        }
      }
    });
  }

  // Inicializa dados e polling
  fetchSessions();
  fetchAppointments();
  setInterval(() => {
    fetchSessions();
    fetchAppointments();
  }, 3000);
}

// ==========================================================================
// 5. GERENCIADOR DE CONFIGURAÇÃO DO BOT (FORMULÁRIOS & CHIPS)
// ==========================================================================
let currentConfigData = {};

function initConfigurationManager() {
  const form = document.getElementById("bot-config-form");
  
  // Elementos do Form
  const inputNomeEmpresa = document.getElementById("input-nome-empresa");
  const inputSaudacao = document.getElementById("input-saudacao");
  const inputMsgFinal = document.getElementById("input-msg-final");
  const inputEndereco = document.getElementById("input-endereco");
  const inputLinkMapa = document.getElementById("input-link-mapa");
  const inputHorarioManha = document.getElementById("input-horario-manha");
  const inputHorarioTarde = document.getElementById("input-horario-tarde");
  
  // Chips de Pagamento
  const paymentChipsContainer = document.getElementById("payment-chips-container");
  const inputNewPayment = document.getElementById("input-new-payment");
  const btnAddPayment = document.getElementById("btn-add-payment");
  let localPayments = [];

  // Chips de Portfólio Geral
  const generalServicesChips = document.getElementById("general-services-chips");
  const inputNewGeneralService = document.getElementById("input-new-general-service");
  const btnAddGeneralService = document.getElementById("btn-add-general-service");
  let localGeneralServices = [];

  // Tabela de Serviços para Agendamento
  const servicesTbody = document.getElementById("services-tbody");
  const newServiceId = document.getElementById("new-service-id");
  const newServiceName = document.getElementById("new-service-name");
  const btnAddService = document.getElementById("btn-add-service");
  let localServicesMap = {};

  async function loadConfig() {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      currentConfigData = await res.json();

      // Preenche os Inputs básicos
      inputNomeEmpresa.value = currentConfigData.nomeEmpresa || "";
      inputSaudacao.value = currentConfigData.saudacaoAdicional || "";
      inputMsgFinal.value = currentConfigData.mensagemFinal || "";
      inputEndereco.value = currentConfigData.endereco || "";
      inputLinkMapa.value = currentConfigData.linkMapa || "";
      if (inputHorarioManha) inputHorarioManha.value = currentConfigData.horarioManha || "08:00 às 12:00";
      if (inputHorarioTarde) inputHorarioTarde.value = currentConfigData.horarioTarde || "13:00 às 17:00";

      // Salva em memória local para manusear antes do submit
      localPayments = [...(currentConfigData.formasPagamento || [])];
      localGeneralServices = [...(currentConfigData.todosServicos || [])];
      localServicesMap = { ...(currentConfigData.servicos || {}) };

      // Renderiza as sub-estruturas
      renderPayments();
      renderGeneralServices();
      renderServicesTable();
    } catch (e) {
      showToast("Erro ao carregar as configurações.");
    }
  }

  // ---- RENDERIZADORES ----
  function renderPayments() {
    paymentChipsContainer.innerHTML = "";
    if (localPayments.length === 0) {
      paymentChipsContainer.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nenhuma forma de pagamento adicionada.</span>`;
      return;
    }
    localPayments.forEach((p, idx) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `
        <span>${p}</span>
        <button type="button" data-idx="${idx}" class="remove-payment-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
      paymentChipsContainer.appendChild(chip);
    });

    document.querySelectorAll(".remove-payment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"));
        localPayments.splice(idx, 1);
        renderPayments();
        autoSaveConfig();
      });
    });
  }

  function renderGeneralServices() {
    generalServicesChips.innerHTML = "";
    if (localGeneralServices.length === 0) {
      generalServicesChips.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nenhum serviço geral no portfólio.</span>`;
      return;
    }
    localGeneralServices.forEach((s, idx) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `
        <span style="white-space: normal; text-align: left;">${s}</span>
        <button type="button" data-idx="${idx}" class="remove-general-btn" style="margin-left: auto;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
      generalServicesChips.appendChild(chip);
    });

    document.querySelectorAll(".remove-general-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"));
        localGeneralServices.splice(idx, 1);
        renderGeneralServices();
        autoSaveConfig();
      });
    });
  }

  function renderServicesTable() {
    servicesTbody.innerHTML = "";
    const keys = Object.keys(localServicesMap).sort();
    
    if (keys.length === 0) {
      servicesTbody.innerHTML = `
        <tr>
          <td colspan="3" class="table-empty">Nenhum serviço de agendamento cadastrado.</td>
        </tr>
      `;
      return;
    }

    keys.forEach(key => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">${key}️⃣</td>
        <td style="font-weight: 600;">${localServicesMap[key].nome}</td>
        <td class="actions-col">
          <button type="button" class="btn-icon-danger remove-service-btn" data-key="${key}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      `;
      servicesTbody.appendChild(tr);
    });

    document.querySelectorAll(".remove-service-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-key");
        delete localServicesMap[key];
        renderServicesTable();
        autoSaveConfig();
      });
    });
  }

  // ---- ADIÇÕES EM INTERFACE LOCAL ----
  btnAddPayment.addEventListener("click", () => {
    const val = inputNewPayment.value.trim();
    if (val && !localPayments.includes(val)) {
      localPayments.push(val);
      renderPayments();
      inputNewPayment.value = "";
      autoSaveConfig();
    }
  });

  btnAddGeneralService.addEventListener("click", () => {
    const val = inputNewGeneralService.value.trim();
    if (val && !localGeneralServices.includes(val)) {
      localGeneralServices.push(val);
      renderGeneralServices();
      inputNewGeneralService.value = "";
      autoSaveConfig();
    }
  });

  btnAddService.addEventListener("click", () => {
    const id = newServiceId.value.trim();
    const name = newServiceName.value.trim();
    
    if (!id || !name) {
      alert("Por favor, informe o atalho numérico (ID) e o nome do serviço.");
      return;
    }

    if (localServicesMap[id]) {
      alert(`O atalho "${id}" já está associado ao serviço "${localServicesMap[id].nome}". Use outro número.`);
      return;
    }

    localServicesMap[id] = { nome: name };
    renderServicesTable();

    newServiceId.value = "";
    newServiceName.value = "";
    autoSaveConfig();
  });

  // ---- FUNÇÃO DE AUTOSALVAMENTO AUTOMÁTICO REAL-TIME ----
  async function autoSaveConfig() {
    const updatedConfig = {
      nomeEmpresa: inputNomeEmpresa.value.trim(),
      saudacaoAdicional: inputSaudacao.value.trim(),
      mensagemFinal: inputMsgFinal.value.trim(),
      formasPagamento: localPayments,
      todosServicos: localGeneralServices,
      servicos: localServicesMap,
      endereco: inputEndereco.value.trim(),
      linkMapa: inputLinkMapa.value.trim(),
      horarioManha: inputHorarioManha ? inputHorarioManha.value.trim() : "08:00 às 12:00",
      horarioTarde: inputHorarioTarde ? inputHorarioTarde.value.trim() : "13:00 às 17:00"
    };

    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig)
      });
      const data = await res.json();
      
      if (data.success) {
        showToast("Configuração salva automaticamente!");
        currentConfigData = updatedConfig;
      }
    } catch (err) {
      console.error("Erro no autosalve em tempo real:", err);
    }
  }

  // Monitorar alterações nos campos de texto para salvar quando perder o foco (change)
  [inputNomeEmpresa, inputSaudacao, inputMsgFinal, inputEndereco, inputLinkMapa, inputHorarioManha, inputHorarioTarde].forEach(input => {
    if (input) input.addEventListener("change", autoSaveConfig);
  });

  // ---- SUBMIT DE REASSURANCE MANUAL ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await autoSaveConfig();
  });

  loadConfig();
}

// ==========================================================================
// 6. UTILS & GLOBAIS (TOAST NOTIFIER)
// ==========================================================================
function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-message");

  toastMsg.textContent = message;
  toast.classList.remove("hidden");

  // Ocultar após 4 segundos
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

// ==========================================================================
// 7. PAINEL DE GRÁFICOS E METRICAS (REAL-TIME ANALYTICS)
// ==========================================================================
let servicesChart = null;

const ESTIMATED_PRICES = {
  "Lavagem Técnica Detalhada": 100,
  "Higienização e Detalhamento Interno": 250,
  "Polimento Técnico & Lustro": 500,
  "Vitrificação de Pintura 9H": 850,
  "Verniz e Detalhamento de Motor": 120,
  "Revitalização de Faróis": 120,
  "default": 120
};

function updateAnalytics(sessions, appointments) {
  const totalOrdersEl = document.getElementById("metric-total-orders");
  const weekOrdersEl = document.getElementById("metric-week-orders");
  const paidOrdersEl = document.getElementById("metric-paid-orders");
  const estimatedRevenueEl = document.getElementById("metric-estimated-revenue");

  if (!totalOrdersEl || !appointments) return;

  // 1. Calcular métricas básicas
  const totalBookings = appointments.length;
  
  // Filtrar pedidos da semana (desde o último Domingo até o próximo Sábado)
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const bookingsThisWeek = appointments.filter(app => {
    if (!app.timestamp) return false;
    const appDate = new Date(app.timestamp);
    return appDate >= startOfWeek && appDate < endOfWeek;
  });

  const weekBookingsCount = bookingsThisWeek.length;

  // Serviços pagos: todos os agendamentos concluídos
  const paidBookingsCount = appointments.filter(app => app.pagamento).length;

  // Faturamento estimado: somar preços reais calculados pelo bot!
  let estimatedRevenue = 0;
  appointments.forEach(app => {
    if (app.valorFinal) {
      estimatedRevenue += app.valorFinal;
    } else if (app.servico) {
      const price = ESTIMATED_PRICES[app.servico] || ESTIMATED_PRICES["default"];
      estimatedRevenue += price;
    }
  });

  // Atualizar elementos na tela
  totalOrdersEl.textContent = totalBookings;
  if (weekOrdersEl) weekOrdersEl.textContent = weekBookingsCount;
  if (paidOrdersEl) paidOrdersEl.textContent = paidBookingsCount;
  if (estimatedRevenueEl) {
    estimatedRevenueEl.textContent = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(estimatedRevenue);
  }

  // 2. Renderizar ou Atualizar Gráfico (Chart.js)
  const serviceCounts = {};
  appointments.forEach(app => {
    if (app.servico) {
      serviceCounts[app.servico] = (serviceCounts[app.servico] || 0) + 1;
    }
  });

  const labels = Object.keys(serviceCounts);
  const dataValues = Object.values(serviceCounts);

  const canvas = document.getElementById("services-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (labels.length === 0) {
    labels.push("Nenhum Serviço");
    dataValues.push(0);
  }

  if (servicesChart) {
    servicesChart.data.labels = labels;
    servicesChart.data.datasets[0].data = dataValues;
    servicesChart.data.datasets[0].backgroundColor = labels.map(label => getServiceColor(label));
    servicesChart.data.datasets[0].borderColor = labels.map(label => getServiceColor(label));
    servicesChart.data.datasets[0].hoverBackgroundColor = labels.map(label => getServiceColor(label));
    servicesChart.data.datasets[0].hoverBorderColor = labels.map(label => getServiceColor(label));
    servicesChart.update();
  } else {
    // Definir as cores correspondentes para cada serviço na barra
    const isLight = document.body.classList.contains("light-theme");
    const barColors = labels.map(label => getServiceColor(label));

    servicesChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Agendados",
          data: dataValues,
          backgroundColor: barColors,
          borderColor: barColors,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
          hoverBackgroundColor: barColors,
          hoverBorderColor: barColors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(12, 17, 28, 0.95)",
            titleColor: isLight ? "#0f172a" : "#fff",
            bodyColor: isLight ? "#475569" : "#f3f4f6",
            borderColor: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)",
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return ` ${context.parsed.y} agendamento(s)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: isLight ? "#475569" : "#9ca3af",
              font: {
                family: "Inter",
                size: 11
              },
              stepSize: 1
            },
            grid: {
              color: isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.03)"
            }
          },
          x: {
            ticks: {
              color: isLight ? "#475569" : "#9ca3af",
              font: {
                family: "Inter",
                size: 11
              }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
}

// ==========================================================================
// 8. MONITORAMENTO DE CLIENTES CADASTRADOS (CRM)
// ==========================================================================
function initClientsMonitoring() {
  const tbody = document.getElementById("clients-tbody");
  const badge = document.getElementById("clients-badge");
  
  // Elementos do Modal de Veículos
  const modal = document.getElementById("vehicles-modal");
  const modalClientName = document.getElementById("modal-vehicles-client-name");
  const modalVehiclesList = document.getElementById("modal-vehicles-list");
  const btnCloseModal = document.getElementById("btn-close-vehicles-modal");

  let clientsCache = [];

  if (btnCloseModal && modal) {
    btnCloseModal.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }

  async function fetchClients() {
    try {
      const res = await fetch(`${API_URL}/api/clients`);
      const clients = await res.json();
      clientsCache = clients;

      if (badge) badge.textContent = clients.length;
      const totalClientsEl = document.getElementById("metric-total-clients");
      if (totalClientsEl) {
        totalClientsEl.textContent = `${clients.length} Cliente(s)`;
      }
      if (!tbody) return;

      if (clients.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="table-empty">Nenhum cliente cadastrado no CRM no momento.</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = "";
      clients.forEach(cli => {
        const tr = document.createElement("tr");

        // Formatar número
        const formattedNum = formatPhoneNumber(cli.phone);

        const dateStr = (cli.created_at || cli.timestamp) ? new Date(cli.created_at || cli.timestamp).toLocaleDateString("pt-BR") : "N/A";
        const totalVehicles = cli.veiculos ? cli.veiculos.length : 0;

        tr.innerHTML = `
          <td style="font-weight: 600; color: var(--text-main);">${cli.nome}</td>
          <td>${formattedNum}</td>
          <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${cli.cpf || "N/A"}</td>
          <td>
            <span class="stage-badge veiculo" style="font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" data-phone="${cli.phone}">
              🚗 ${totalVehicles} Carro(s)
            </span>
          </td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${dateStr}</td>
          <td class="actions-col" style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
            <button class="btn-primary view-vehicles-btn" data-phone="${cli.phone}" style="padding: 6px 10px; font-size: 0.72rem;">
              Ver Carros
            </button>
            <button class="btn-secondary danger delete-client-btn" data-phone="${cli.phone}" style="padding: 6px 10px; font-size: 0.72rem;">
              Excluir
            </button>
          </td>
        `;

        tbody.appendChild(tr);
      });

      // Bind eventos para ver carros
      document.querySelectorAll(".view-vehicles-btn, [data-phone].veiculo").forEach(el => {
        el.addEventListener("click", () => {
          const phone = el.getAttribute("data-phone");
          const cli = clientsCache.find(c => c.phone === phone);
          if (!cli) return;

          modalClientName.textContent = `Veículos de ${cli.nome}`;
          modalVehiclesList.innerHTML = "";

          if (!cli.veiculos || cli.veiculos.length === 0) {
            modalVehiclesList.innerHTML = `<span style="color: var(--text-muted); font-style: italic; text-align: center; display: block; grid-column: span 2; padding: 24px;">Nenhum veículo cadastrado para este cliente.</span>`;
          } else {
            cli.veiculos.forEach(v => {
              const card = document.createElement("div");
              card.className = "vehicle-card-crm";

              const badgeClass = (v.porte || "Médio").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

              card.innerHTML = `
                <div class="vehicle-info-crm">
                  <div class="vehicle-model-crm">${v.modelo}</div>
                  <div class="vehicle-plate-crm">${v.placa}</div>
                </div>
                <span class="vehicle-porte-badge ${badgeClass}">${v.porte}</span>
              `;
              modalVehiclesList.appendChild(card);
            });
          }

          modal.classList.remove("hidden");
        });
      });

      // Bind eventos para excluir cliente do CRM
      document.querySelectorAll(".delete-client-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const phone = btn.getAttribute("data-phone");
          const cli = clientsCache.find(c => c.phone === phone);
          if (!cli) return;

          if (confirm(`Deseja realmente excluir ${cli.nome} do CRM de forma definitiva? Isso também apagará a frota de veículos dele.`)) {
            try {
              const res = await fetch(`${API_URL}/api/clients/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
              });
              const data = await res.json();
              if (data.success) {
                showToast("Cliente removido com sucesso!");
                fetchClients();
              } else {
                showToast("Erro ao remover cliente.");
              }
            } catch (err) {
              showToast("Falha na comunicação com a API.");
            }
          }
        });
      });

    } catch (e) {
      console.error("Erro ao buscar clientes no CRM:", e);
    }
  }

  // Polling
  fetchClients();
  setInterval(fetchClients, 3000);
}

// ==========================================================================
// 9. SISTEMA DE CALENDÁRIO DE AGENDAMENTOS EM TEMPO REAL
// ==========================================================================
function initCalendarMonitoring() {
  const monthYearEl = document.getElementById("calendar-month-year");
  const daysContainer = document.getElementById("calendar-days-container");
  const btnPrev = document.getElementById("btn-prev-month");
  const btnNext = document.getElementById("btn-next-month");
  
  const selectedDayTitle = document.getElementById("selected-day-title");
  const dayAppointmentsContainer = document.getElementById("day-appointments-container");
  const calendarBadge = document.getElementById("calendar-badge");

  if (!daysContainer) return;

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  let today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();

  // Guarda qual data está selecionada atualmente no formato "YYYY-MM-DD"
  const formatIsoDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  let selectedDateStr = formatIsoDate(today);

  // Controle de filtro de serviços do dia
  let activeServiceFilter = "Todos";
  let lastLoadedDateStr = "";

  // Expõe a função de atualização para o polling de sessões
  window.refreshCalendar = function() {
    renderCalendar(currentMonth, currentYear);
    showDayAppointments(selectedDateStr);
    
    if (calendarBadge) {
      calendarBadge.textContent = completedAppointmentsCache.length;
    }
  };

  // Eventos dos botões de navegação
  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar(currentMonth, currentYear);
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar(currentMonth, currentYear);
    });
  }

  function renderCalendar(month, year) {
    if (monthYearEl) {
      monthYearEl.textContent = `${monthNames[month]} de ${year}`;
    }

    daysContainer.innerHTML = "";

    // Primeiro dia da semana do mês atual (0 = Domingo, 6 = Sábado)
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    // Total de dias no mês atual
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Total de dias no mês anterior
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Dias do mês anterior para preenchimento (padding)
    for (let i = firstDayIndex; i > 0; i--) {
      const dayNum = prevMonthDays - i + 1;
      const cell = document.createElement("div");
      cell.className = "calendar-day-cell other-month";
      cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
      daysContainer.appendChild(cell);
    }

    // Dias do mês atual
    const todayStr = formatIsoDate(new Date());
    
    for (let day = 1; day <= totalDays; day++) {
      const cellDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      
      const cell = document.createElement("div");
      cell.className = "calendar-day-cell";
      
      if (cellDateStr === todayStr) {
        cell.classList.add("today");
      }
      
      if (cellDateStr === selectedDateStr) {
        cell.classList.add("selected");
      }

      // Adiciona o número do dia
      cell.innerHTML = `<span class="day-number">${day}</span>`;

      // Filtrar agendamentos desse dia específico
      const dayApps = completedAppointmentsCache.filter(app => app.agendamentoDataValor === cellDateStr);

      if (dayApps.length > 0) {
        const indicator = document.createElement("div");
        indicator.className = "day-events-indicator";
        
        let hasManha = false;
        let hasTarde = false;

        dayApps.forEach(app => {
          const turno = (app.agendamentoTurno || "").toLowerCase();
          if (turno.includes("manhã") || turno.includes("manha")) {
            hasManha = true;
          } else if (turno.includes("tarde")) {
            hasTarde = true;
          } else {
            // Default se não especificado
            hasManha = true;
          }
        });

        if (hasManha) {
          const dot = document.createElement("span");
          dot.className = "event-dot manha";
          indicator.appendChild(dot);
        }
        if (hasTarde) {
          const dot = document.createElement("span");
          dot.className = "event-dot tarde";
          indicator.appendChild(dot);
        }

        cell.appendChild(indicator);
      }

      // Evento de clique na célula
      cell.addEventListener("click", () => {
        // Remover a classe selecionada das outras células
        document.querySelectorAll(".calendar-day-cell").forEach(c => {
          c.classList.remove("selected");
        });
        cell.classList.add("selected");
        selectedDateStr = cellDateStr;
        showDayAppointments(cellDateStr);
      });

      daysContainer.appendChild(cell);
    }

    // Dias do próximo mês para completar a grade de 7 colunas
    const totalCellsUsed = firstDayIndex + totalDays;
    const remainingCells = (7 - (totalCellsUsed % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const cell = document.createElement("div");
      cell.className = "calendar-day-cell other-month";
      cell.innerHTML = `<span class="day-number">${i}</span>`;
      daysContainer.appendChild(cell);
    }
  }

  function showDayAppointments(dateStr) {
    if (!dayAppointmentsContainer) return;

    // Resetar filtro se mudou o dia selecionado
    if (dateStr !== lastLoadedDateStr) {
      activeServiceFilter = "Todos";
      lastLoadedDateStr = dateStr;
    }

    // Formata o cabeçalho da coluna de detalhes
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const options = { weekday: "long", day: "numeric", month: "long" };
    const formattedTitleDate = dateObj.toLocaleDateString("pt-BR", options);
    const capitalizedTitle = formattedTitleDate.charAt(0).toUpperCase() + formattedTitleDate.slice(1);
    
    if (selectedDayTitle) {
      selectedDayTitle.textContent = `Serviços de ${capitalizedTitle}`;
    }

    // Filtra agendamentos para o dia selecionado
    const dayApps = completedAppointmentsCache.filter(app => app.agendamentoDataValor === dateStr);

    // Se for o dia de hoje, listar também os agendamentos sem data definida (legados)
    const todayStr = formatIsoDate(new Date());
    const isToday = (dateStr === todayStr);
    
    const legacyApps = isToday
      ? completedAppointmentsCache.filter(app => !app.agendamentoDataValor || app.agendamentoDataValor === "N/A" || !/^\d{4}-\d{2}-\d{2}$/.test(app.agendamentoDataValor))
      : [];

    const allApps = [...dayApps, ...legacyApps];
    const filterContainer = document.getElementById("calendar-service-filter-container");

    if (allApps.length === 0) {
      if (filterContainer) filterContainer.style.display = "none";
      dayAppointmentsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-style: italic; text-align: center; padding: 48px 16px; border: 1px dashed var(--border-color); border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.01);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); margin-bottom: 8px; opacity: 0.5;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <p style="font-size: 0.85rem;">Nenhum serviço agendado para este dia.</p>
        </div>
      `;
      return;
    }

    // Gerar os chips de filtro dinamicamente
    if (filterContainer) {
      filterContainer.style.display = "flex";
      filterContainer.innerHTML = "";

      const serviceCounts = { "Todos": allApps.length };
      allApps.forEach(app => {
        const sName = app.servico || "Outros";
        serviceCounts[sName] = (serviceCounts[sName] || 0) + 1;
      });

      // Renderiza botão "Todos" primeiro
      renderFilterPill("Todos", serviceCounts["Todos"]);

      // Demais serviços em ordem
      Object.keys(serviceCounts).sort().forEach(sName => {
        if (sName !== "Todos") {
          renderFilterPill(sName, serviceCounts[sName]);
        }
      });
    }

    function renderFilterPill(name, count) {
      const pill = document.createElement("div");
      pill.className = "filter-pill";
      if (name === activeServiceFilter) {
        pill.classList.add("active");
      }
      
      pill.innerHTML = `
        <span>${name}</span>
        <span class="pill-count">${count}</span>
      `;
      
      pill.addEventListener("click", () => {
        activeServiceFilter = name;
        showDayAppointments(dateStr);
      });
      
      filterContainer.appendChild(pill);
    }

    // Filtrar a lista que será exibida com base no filtro ativo
    const filteredDayApps = activeServiceFilter === "Todos" 
      ? dayApps 
      : dayApps.filter(app => (app.servico || "Outros") === activeServiceFilter);

    const filteredLegacyApps = activeServiceFilter === "Todos" 
      ? legacyApps 
      : legacyApps.filter(app => (app.servico || "Outros") === activeServiceFilter);

    dayAppointmentsContainer.innerHTML = "";

    if (filteredDayApps.length === 0 && filteredLegacyApps.length === 0) {
      dayAppointmentsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-style: italic; text-align: center; padding: 24px; font-size: 0.8rem;">
          Nenhum item encontrado para o filtro selecionado.
        </div>
      `;
      return;
    }

    // Renderiza agendamentos normais filtrados
    filteredDayApps.forEach(app => {
      renderAppointmentItem(app, false);
    });

    // Renderiza agendamentos legados filtrados (se for hoje)
    if (filteredLegacyApps.length > 0) {
      const divider = document.createElement("div");
      divider.style.cssText = "font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;";
      divider.innerHTML = `⚠️ Agendamentos sem data exata (Legados)`;
      dayAppointmentsContainer.appendChild(divider);

      filteredLegacyApps.forEach(app => {
        renderAppointmentItem(app, true);
      });
    }
  }

  function renderAppointmentItem(app, isLegacy) {
    const card = document.createElement("div");
    card.className = "completed-card";

    // Aplica cores dinâmicas com base no serviço
    const serviceColor = getServiceColor(app.servico);
    card.style.setProperty('--service-color', serviceColor);
    card.style.setProperty('--service-color-glow', getServiceColorGlow(serviceColor));

    const formattedNum = formatPhoneNumber(app.from);
    
    const dateStr = app.timestamp ? new Date(app.timestamp).toLocaleString("pt-BR") : "N/A";
    const valor = app.valorFinal ? `R$ ${app.valorFinal},00` : "Orçamento Manual";
    
    const turno = app.agendamentoTurno || "Geral";
    const isManha = turno.toLowerCase().includes("manhã") || turno.toLowerCase().includes("manha");
    
    const badgeClass = isManha ? "manha" : "tarde";
    const badgeText = isLegacy ? "Sem Data" : (isManha ? "Manhã" : "Tarde");

    const displayName = app.pushname && app.pushname !== "Cliente" ? app.pushname : "Cliente";

    card.innerHTML = `
      <div class="completed-card-header">
        <div class="completed-client-info">
          <span class="completed-client-name">${displayName}</span>
          <span class="completed-client-phone">${formattedNum}</span>
        </div>
        <span class="completed-price">${valor}</span>
      </div>
      
      <div class="completed-card-body">
        <div class="completed-info-row">
          <span class="completed-info-label">💎 Serviço:</span>
          <span class="completed-info-value" style="color: var(--service-color, var(--primary)); font-weight: 700;">${app.servico}</span>
        </div>
        <div class="completed-info-row">
          <span class="completed-info-label">🚗 Veículo:</span>
          <span class="completed-info-value"><span class="stage-badge veiculo" style="font-size: 0.7rem; padding: 2px 6px;">${app.veiculo}</span></span>
        </div>
        <div class="completed-info-row">
          <span class="completed-info-label">⏱️ Período:</span>
          <span class="completed-info-value">
            <span class="app-period-badge ${badgeClass}" style="font-size: 0.68rem; padding: 2px 6px;">${badgeText}</span>
          </span>
        </div>
        <div class="completed-info-row">
          <span class="completed-info-label">📅 Data:</span>
          <span class="completed-info-value"><span class="stage-badge menu" style="font-size: 0.7rem; padding: 2px 6px;">${app.agendamentoDia}</span></span>
        </div>
        <div class="completed-info-row">
          <span class="completed-info-label">💳 Pagamento:</span>
          <span class="completed-info-value"><span class="stage-badge pagamento" style="font-size: 0.7rem; padding: 2px 6px;">${app.pagamento}</span></span>
        </div>
        <div class="completed-info-row">
          <span class="completed-info-label">🚦 Status:</span>
          <span class="completed-info-value">
            <span class="stage-badge" style="font-size: 0.7rem; padding: 2px 6px; font-weight: 700; ${app.status === 'Finalizado' ? 'background-color: #DEF7EC; color: #03543F;' : 'background-color: #FEF08A; color: #713F12;'}">
              ${app.status === 'Finalizado' ? '🟢 Pronto para entrega' : '🟡 Em andamento'}
            </span>
          </span>
        </div>
      </div>
      
      <div class="completed-card-footer">
        <div class="completed-date-time">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>Finalizado: ${dateStr}</span>
        </div>
        <button class="btn-primary view-calendar-details-btn" style="padding: 6px 12px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
          <span>+ Info</span>
        </button>
      </div>
    `;

    const btnInfo = card.querySelector(".view-calendar-details-btn");
    if (btnInfo) {
      btnInfo.addEventListener("click", () => {
        if (typeof window.openDetailsModal === "function") {
          window.openDetailsModal(
            displayName + ` (${formattedNum})`, 
            formattedNum, 
            "CONCLUÍDO", 
            app.servico, 
            app.veiculo, 
            app.pagamento, 
            app.respostas,
            app.observacoes
          );
        }
      });
    }

    dayAppointmentsContainer.appendChild(card);
  }

  // Inicialização
  renderCalendar(currentMonth, currentYear);
  showDayAppointments(selectedDateStr);
}
