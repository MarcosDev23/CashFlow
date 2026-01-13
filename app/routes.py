from flask import Blueprint, render_template, request, jsonify, abort
from .models import Transacao
from . import db
from datetime import datetime

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/api/transacoes', methods=['GET', 'POST'])
def gerenciar_transacoes():
    if request.method == 'POST':
        dados = request.json
        
        # Validação de Dados
        try:
            valor = float(dados.get('valor', 0))
            if valor <= 0:
                return jsonify({"mensagem": "O valor deve ser maior que zero"}), 400
            
            data_validada = datetime.strptime(dados.get('data'), '%Y-%m-%d')
        except (ValueError, TypeError):
            return jsonify({"mensagem": "Dados inválidos ou campos vazios"}), 400

        nova_transacao = Transacao(
            tipo=dados['tipo'],
            descricao=dados['descricao'],
            valor=valor,
            data=dados['data']
        )
        db.session.add(nova_transacao)
        db.session.commit()
        return jsonify({"status": "sucesso"}), 201

    # Paginação para não travar o sistema
    page = request.args.get('page', 1, type=int)
    per_page = 10
    paginacao = Transacao.query.order_by(Transacao.data.desc()).paginate(page=page, per_page=per_page)

    return jsonify({
        "transacoes": [{
            "id": t.id, "tipo": t.tipo, "descricao": t.descricao,
            "valor": t.valor, "data": t.data
        } for t in paginacao.items],
        "paginas": paginacao.pages,
        "atual": paginacao.page
    })

@main.route('/api/resumo')
def obter_resumo():
    transacoes = Transacao.query.all()
    resumo = {"entradas": 0, "saidas": 0, "saldo": 0}
    for t in transacoes:
        if t.tipo == 'entrada': resumo["entradas"] += t.valor
        else: resumo["saidas"] += t.valor
    resumo["saldo"] = resumo["entradas"] - resumo["saidas"]
    return jsonify(resumo)

@main.route('/api/transacoes/<int:id>', methods=['DELETE'])
def excluir_transacao(id):
    t = Transacao.query.get_or_404(id)
    db.session.delete(t)
    db.session.commit()
    return jsonify({"status": "sucesso"})