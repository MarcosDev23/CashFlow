// static/js/charts.js

// 1. GERENCIAMENTO DE NAVEGAÇÃO (SPA)
document.querySelectorAll(".sidebar nav a").forEach((link) => {
  link.addEventListener("click", function (e) {
    e.preventDefault();

    // Remove active de todos e adiciona no clicado
    document
      .querySelectorAll(".sidebar nav a")
      .forEach((l) => l.classList.remove("active"));
    this.classList.add("active");

    // Lógica de esconder/mostrar seções
    const target = this.textContent.trim().toLowerCase();
    if (target === "dashboard") {
      document.querySelector(".dashboard-cards").style.display = "grid";
      document.querySelector(".charts-row").style.display = "grid";
      document.querySelector(".bottom-row").style.display = "none"; // Esconde lançamentos
    } else if (target === "lançamentos") {
      document.querySelector(".dashboard-cards").style.display = "none";
      document.querySelector(".charts-row").style.display = "none";
      document.querySelector(".bottom-row").style.display = "grid"; // Mostra formulário e tabela
    }
  });
});

// 2. ENVIO DE NOVO LANÇAMENTO
document
  .getElementById("finance-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      tipo: document.getElementById("tipo").value,
      descricao: document.getElementById("descricao").value,
      valor: parseFloat(document.getElementById("valor").value),
      data: document.getElementById("data").value,
      fixo: document.getElementById("fixo").checked,
    };

    await fetch("/api/transacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    e.target.reset();
    atualizarTudo();
  });

// 3. ATUALIZAÇÃO GERAL DOS DADOS
async function atualizarTudo() {
  try {
    const resResumo = await fetch("/api/resumo");
    const resumo = await resResumo.json();

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

    const saldoElem = document.getElementById("res-saldo");
    saldoElem.innerText = `R$ ${resumo.saldo_final.toFixed(2)}`;
    saldoElem.style.color =
      resumo.saldo_final >= 0 ? "var(--accent-green)" : "var(--accent-red)";

    // Renderiza Gráficos
    renderizarGraficoBarras(resumo);
    await carregarGraficoLinha();

    // Atualiza Tabela
    carregarTabelaTransacoes();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
  }
}

// 4. GRÁFICO DE BARRAS (COMPARATIVO)
function renderizarGraficoBarras(resumo) {
  const ctx = document.getElementById("canvasBarra").getContext("2d");
  if (window.chartBarra) window.chartBarra.destroy();

  window.chartBarra = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Entradas", "Saídas", "Investimentos"],
      datasets: [
        {
          label: "Mês Atual",
          data: [
            resumo.total_entradas,
            resumo.total_saidas,
            resumo.investimentos,
          ],
          backgroundColor: ["#2ecc71", "#e74c3c", "#3498db"],
          borderRadius: 5,
        },
        {
          label: "Mês Anterior",
          data: [
            resumo.entradas_anterior,
            resumo.saidas_anterior,
            resumo.invest_anterior,
          ],
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#fff" } } },
    },
  });
}

// 5. GRÁFICO DE LINHA (EVOLUÇÃO DE SALDO)
async function carregarGraficoLinha() {
  const res = await fetch("/api/transacoes");
  const transacoes = await res.json();

  // Organiza por data crescente
  const transacoesOrdenadas = transacoes.sort(
    (a, b) => new Date(a.data) - new Date(b.data)
  );

  let acumulado = 0;
  const labels = [];
  const dadosSaldo = [];

  transacoesOrdenadas.forEach((t) => {
    labels.push(t.data.split("-").reverse().slice(0, 2).join("/")); // Formato DD/MM
    acumulado += t.tipo === "entrada" ? t.valor : -t.valor;
    dadosSaldo.push(acumulado);
  });

  const ctx = document.getElementById("canvasLinha").getContext("2d");
  if (window.chartLinha) window.chartLinha.destroy();

  window.chartLinha = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Saldo Acumulado",
          data: dadosSaldo,
          borderColor: "#3498db",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

// 6. TABELA DE LANÇAMENTOS
async function carregarTabelaTransacoes() {
  const res = await fetch("/api/transacoes");
  const transacoes = await res.json();
  const tbody = document.getElementById("transactions-body");
  tbody.innerHTML = "";

  transacoes.forEach((t) => {
    const row = tbody.insertRow();
    row.innerHTML = `
            <td>${t.data}</td>
            <td>${t.descricao}</td>
            <td><span class="badge-${t.tipo}">${t.tipo}</span></td>
            <td style="color: ${
              t.tipo === "entrada" ? "var(--accent-green)" : "var(--accent-red)"
            }">
                R$ ${t.valor.toFixed(2)}
            </td>
            <td>
                <button onclick="excluirTransacao(${t.id})" class="btn-delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
  });
}

async function excluirTransacao(id) {
  if (confirm("Deseja excluir este lançamento?")) {
    await fetch(`/api/transacoes/${id}`, { method: "DELETE" });
    atualizarTudo();
  }
}

// Inicia o sistema
atualizarTudo();
