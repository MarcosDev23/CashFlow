import os
from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import pandas as pd
import io

app = Flask(__name__)

# --- CONFIGURAÇÃO DO BANCO DE DADOS ---
# Define o caminho absoluto para o arquivo database.db na mesma pasta do projeto
base_dir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(base_dir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- MODELO DE DADOS (TABELA) ---
class Transacao(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False) # entrada, saida, despesa_fixa, investimento
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Float, nullable=False)
    data = db.Column(db.String(10), nullable=False) # Formato YYYY-MM-DD
    fixo = db.Column(db.Boolean, default=False)

# Cria o banco de dados caso ele não exista ao iniciar o app
with app.app_context():
    db.create_all()

# --- ROTAS ---

@app.route('/')
def index():
    """Renderiza a página principal do dashboard."""
    return render_template('index.html')

@app.route('/api/transacoes', methods=['GET', 'POST'])
def gerenciar_transacoes():
    """Lida com a criação e listagem de transações."""
    if request.method == 'POST':
        dados = request.json
        nova_transacao = Transacao(
            tipo=dados['tipo'],
            descricao=dados['descricao'],
            valor=float(dados['valor']),
            data=dados['data'],
            fixo=dados.get('fixo', False)
        )
        db.session.add(nova_transacao)
        db.session.commit()
        return jsonify({"status": "sucesso", "id": nova_transacao.id}), 201

    # Método GET: Retorna todas as transações ordenadas pela data mais recente
    transacoes = Transacao.query.order_by(Transacao.data.desc()).all()
    resultado = [{
        "id": t.id,
        "tipo": t.tipo,
        "descricao": t.descricao,
        "valor": t.valor,
        "data": t.data,
        "fixo": t.fixo
    } for t in transacoes]
    return jsonify(resultado)

@app.route('/api/transacoes/<int:id>', methods=['DELETE'])
def excluir_transacao(id):
    """Exclui uma transação específica pelo ID."""
    transacao = Transacao.query.get_or_404(id)
    db.session.delete(transacao)
    db.session.commit()
    return jsonify({"status": "sucesso", "mensagem": "Lançamento removido"}), 200

@app.route('/api/resumo')
def obter_resumo():
    # 1. Identificar datas (Mês Atual e Mês Anterior)
    hoje = datetime.now()
    mes_atual_str = hoje.strftime('%Y-%m')
    
    primeiro_dia_mes_atual = hoje.replace(day=1)
    ultimo_dia_mes_anterior = primeiro_dia_mes_atual - timedelta(days=1)
    mes_anterior_str = ultimo_dia_mes_anterior.strftime('%Y-%m')

    # 2. Buscar transações do banco
    todas_transacoes = Transacao.query.all()

    # 3. Inicializar contadores
    resumo = {
        "total_entradas": 0, "total_saidas": 0, "investimentos": 0,
        "entradas_anterior": 0, "saidas_anterior": 0, "invest_anterior": 0
    }

    for t in todas_transacoes:
        # Extrair o ano-mês da transação (assumindo formato YYYY-MM-DD)
        mes_transacao = t.data[:7] 
        
        valor = t.valor
        tipo = t.tipo

        # Lógica para Mês Atual
        if mes_transacao == mes_atual_str:
            if tipo == 'entrada':
                resumo["total_entradas"] += valor
            elif tipo in ['saida', 'despesa_fixa', 'custo_variavel']:
                resumo["total_saidas"] += valor
            elif tipo == 'investimento':
                resumo["investimentos"] += valor

        # Lógica para Mês Anterior
        elif mes_transacao == mes_anterior_str:
            if tipo == 'entrada':
                resumo["entradas_anterior"] += valor
            elif tipo in ['saida', 'despesa_fixa', 'custo_variavel']:
                resumo["saidas_anterior"] += valor
            elif tipo == 'investimento':
                resumo["invest_anterior"] += valor

    resumo["saldo_final"] = resumo["total_entradas"] - resumo["total_saidas"] - resumo["investimentos"]
    
    # 4. Alerta de Gastos (Opcional: envia um booleano se as saídas subiram > 20%)
    resumo["alerta_gastos"] = False
    if resumo["saidas_anterior"] > 0:
        if resumo["total_saidas"] > (resumo["saidas_anterior"] * 1.2):
            resumo["alerta_gastos"] = True

    return jsonify(resumo)


@app.route('/api/insights')
def obter_insights():
    hoje = datetime.now()
    mes_atual = hoje.strftime('%Y-%m')
    mes_anterior = (hoje.replace(day=1) - timedelta(days=1)).strftime('%Y-%m')

    # Busca transações para os dois meses
    transacoes_atual = Transacao.query.filter(Transacao.data.like(f"{mes_atual}%")).all()
    transacoes_anterior = Transacao.query.filter(Transacao.data.like(f"{mes_anterior}%")).all()

    saidas_atual = sum(t.valor for t in transacoes_atual if t.tipo in ['saida', 'despesa_fixa'])
    saidas_anterior = sum(t.valor for t in transacoes_anterior if t.tipo in ['saida', 'despesa_fixa'])

    # Alerta de Gastos: Se o gasto atual for 20% maior que o anterior
    alerta = False
    if saidas_anterior > 0 and saidas_atual > (saidas_anterior * 1.2):
        alerta = True

    # Cálculo da variação percentual
    variacao = 0
    if saidas_anterior > 0:
        variacao = ((saidas_atual - saidas_anterior) / saidas_anterior) * 100

    return jsonify({
        "variacao_percentual": round(variacao, 2),
        "alerta_excesso": alerta,
        "saidas_mes_anterior": saidas_anterior
    })

@app.route('/api/relatorio_detalhado')
def relatorio_detalhado():
    mes = request.args.get('mes') # Formato YYYY-MM
    query = Transacao.query
    if mes:
        query = query.filter(Transacao.data.like(f"{mes}%"))
    
    transacoes = query.order_by(Transacao.data.asc()).all()
    
    # Cálculo de saldo acumulado para o relatório
    resultado = []
    saldo_acumulado = 0
    for t in transacoes:
        valor_efetivo = t.valor if t.tipo == 'entrada' else -t.valor
        saldo_acumulado += valor_efetivo
        resultado.append({
            "id": t.id,
            "data": t.data,
            "descricao": t.descricao,
            "tipo": t.tipo,
            "valor": t.valor,
            "saldo_pos": saldo_acumulado
        })
    
    return jsonify(resultado)

@app.route('/api/exportar')
def exportar_planilha():
    mes_selecionado = request.args.get('mes')  # Recebe o mês do frontend (YYYY-MM)
    
    # Busca os dados no SQLite
    query = Transacao.query
    if mes_selecionado:
        query = query.filter(Transacao.data.like(f"{mes_selecionado}%"))
    
    transacoes = query.all()
    
    if not transacoes:
        return "Nenhum dado encontrado para este período", 404

    # Criar a lista de dados para o Excel
    dados_excel = []
    for t in transacoes:
        dados_excel.append({
            'Data': t.data,
            'Descrição': t.descricao,
            'Tipo': t.tipo.capitalize(),
            'Valor (R$)': t.valor if t.tipo == 'entrada' else -t.valor
        })

    # Transformar em DataFrame do Pandas
    df = pd.DataFrame(dados_excel)

    # Gerar o arquivo Excel em memória (BytesIO)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Fluxo de Caixa')
    
    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'Relatorio_Financeiro_{mes_selecionado}.xlsx'
    )

# --- INICIALIZAÇÃO ---
if __name__ == '__main__':
    # Rodar em modo debug facilita o desenvolvimento no Linux Mint
    app.run(debug=True)