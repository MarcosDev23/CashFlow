// --- 1. CONFIGURAÇÃO DE NAVEGAÇÃO (SPA) ---
document.querySelectorAll(".sidebar nav a").forEach((link) => {
  link.addEventListener("click", function (e) {
    const targetId = this.getAttribute("data-target");

    // Se o link não tiver data-target (ex: Configurações), ignora
    if (!targetId) return;

    e.preventDefault();

    // Remove classe active de todos e adiciona no atual
    document
      .querySelectorAll(".sidebar nav a")
      .forEach((l) => l.classList.remove("active"));
    this.classList.add("active");

    // Esconde todas as seções e mostra a selecionada
    document.querySelectorAll(".view-section").forEach((section) => {
      section.style.display = "none";
    });

    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      targetSection.style.display = "block";
    }

    // Se voltar para o Dashboard, atualiza os gráficos
    if (targetId === "view-dashboard") {
      atualizarTudo();
    }
    // Se for para Relatórios, carrega a tabela de relatório
    else if (targetId === "view-relatorios") {
      carregarRelatorioTela();
    }
  });
});

// --- 2. LÓGICA DE LANÇAMENTOS ---
document
  .getElementById("finance-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      tipo: document.getElementById("tipo").value,
      descricao: document.getElementById("descricao").value,
      valor: parseFloat(document.getElementById("valor").value),
      data: document.getElementById("data").value,
    };

    await fetch("/api/transacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    e.target.reset();
    document.getElementById("data").valueAsDate = new Date(); // Reseta data para hoje
    atualizarTudo();
    alert("Lançamento salvo com sucesso!");
  });

// --- 3. ATUALIZAÇÃO DO DASHBOARD ---
async function atualizarTudo() {
  try {
    const res = await fetch("/api/resumo");
    const resumo = await res.json();

    // Atualiza Cards
    document.getElementById(
      "res-entradas"
    ).innerText = `R$ ${resumo.total_entradas.toFixed(2)}`;
    document.getElementById(
      "res-saidas"
    ).innerText = `R$ ${resumo.total_saidas.toFixed(2)}`;
    document.getElementById(
      "res-invest"
    ).innerText = `R$ ${resumo.investimentos.toFixed(2)}`;
    document.getElementById(
      "res-saldo"
    ).innerText = `R$ ${resumo.saldo_final.toFixed(2)}`;

    // Cores do Saldo
    document.getElementById("res-saldo").style.color =
      resumo.saldo_final >= 0 ? "#2ecc71" : "#e74c3c";

    renderizarGraficos(resumo);
    carregarTabelaTransacoes();
  } catch (e) {
    console.error("Erro ao atualizar:", e);
  }
}

// --- 4. GRÁFICOS (BARRA E LINHA) ---
function renderizarGraficos(resumo) {
  // Gráfico de Barras
  const ctxBarra = document.getElementById("canvasBarra").getContext("2d");
  if (window.chartBarra) window.chartBarra.destroy();
  window.chartBarra = new Chart(ctxBarra, {
    type: "bar",
    data: {
      labels: ["Entradas", "Saídas", "Invest"],
      datasets: [
        {
          label: "Mês Atual",
          data: [
            resumo.total_entradas,
            resumo.total_saidas,
            resumo.investimentos,
          ],
          backgroundColor: ["#2ecc71", "#e74c3c", "#3498db"],
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  // Gráfico de Linha (Simulação de evolução básica)
  const ctxLinha = document.getElementById("canvasLinha").getContext("2d");
  if (window.chartLinha) window.chartLinha.destroy();
  window.chartLinha = new Chart(ctxLinha, {
    type: "line",
    data: {
      labels: ["Início", "Atual"],
      datasets: [
        {
          label: "Saldo",
          data: [0, resumo.saldo_final],
          borderColor: "#3498db",
          fill: true,
          backgroundColor: "rgba(52, 152, 219, 0.1)",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

// --- 5. TABELA DE LANÇAMENTOS ---
async function carregarTabelaTransacoes() {
  const res = await fetch("/api/transacoes");
  const transacoes = await res.json();
  const tbody = document.getElementById("transactions-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  transacoes.forEach((t) => {
    const row = tbody.insertRow();
    row.innerHTML = `
            <td>${t.data}</td>
            <td>${t.descricao}</td>
            <td><span class="badge-${t.tipo}">${t.tipo}</span></td>
            <td style="color:${
              t.tipo === "entrada" ? "#2ecc71" : "#e74c3c"
            }">R$ ${t.valor.toFixed(2)}</td>
            <td><button onclick="excluirTransacao(${
              t.id
            })" class="btn-delete"><i class="fas fa-trash"></i></button></td>
        `;
  });
}

async function excluirTransacao(id) {
  if (confirm("Excluir este lançamento?")) {
    await fetch(`/api/transacoes/${id}`, { method: "DELETE" });
    atualizarTudo();
  }
}

// --- 6. EXPORTAÇÃO E RELATÓRIO ---
async function carregarRelatorioTela() {
  const mes = document.getElementById("filtro-mes-relatorio").value;
  const res = await fetch(`/api/relatorio_detalhado?mes=${mes}`);
  const dados = await res.json();
  const tbody = document.getElementById("report-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  dados.forEach((t) => {
    const row = tbody.insertRow();
    row.innerHTML = `
            <td>${t.data}</td>
            <td>${t.descricao}</td>
            <td>${t.tipo}</td>
            <td>R$ ${t.valor.toFixed(2)}</td>
            <td>R$ ${t.saldo_pos.toFixed(2)}</td>
        `;
  });
}

function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório CashFlow Pro", 14, 15);
  doc.autoTable({ html: "#tabela-relatorio", startY: 25 });
  doc.save("relatorio.pdf");
}

function baixarPlanilha() {
  const mes = document.getElementById("filtro-mes-relatorio").value;
  if (!mes) {
    alert("Selecione um mês primeiro!");
    return;
  }
  // Redireciona o navegador para a rota de download
  window.location.href = `/api/exportar?mes=${mes}`;
}

// Inicialização
atualizarTudo();
