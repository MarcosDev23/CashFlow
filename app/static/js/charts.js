let paginaAtual = 1;

async function atualizarTudo() {
  const res = await fetch("/api/resumo");
  const resumo = await res.json();
  document.getElementById(
    "res-entradas"
  ).innerText = `R$ ${resumo.entradas.toFixed(2)}`;
  document.getElementById("res-saidas").innerText = `R$ ${resumo.saidas.toFixed(
    2
  )}`;
  document.getElementById("res-saldo").innerText = `R$ ${resumo.saldo.toFixed(
    2
  )}`;
  carregarTabelaTransacoes(paginaAtual);
}

async function carregarTabelaTransacoes(pagina) {
  paginaAtual = pagina;
  const res = await fetch(`/api/transacoes?page=${pagina}`);
  const data = await res.json();

  const tbody = document.getElementById("transactions-body");
  tbody.innerHTML = "";

  data.transacoes.forEach((t) => {
    const row = `<tr>
            <td>${t.data}</td>
            <td>${t.descricao}</td>
            <td>${t.tipo}</td>
            <td>R$ ${t.valor.toFixed(2)}</td>
            <td><button onclick="excluir(${t.id})">Excluir</button></td>
        </tr>`;
    tbody.innerHTML += row;
  });
}

async function excluir(id) {
  if (confirm("Deseja excluir?")) {
    await fetch(`/api/transacoes/${id}`, { method: "DELETE" });
    atualizarTudo();
  }
}

// Inicializa
atualizarTudo();
