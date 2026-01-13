import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# Instancia as extensões fora da factory
db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__,
                template_folder='templates',
                static_folder='static')
    
    # Configuração via variáveis de ambiente
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///database.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Inicializa as extensões no app
    db.init_app(app)
    migrate.init_app(app, db)

    # --- Registro de Error Handlers (Dentro da função create_app) ---
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"erro": "Dados inválidos", "mensagem": str(error.description)}), 400

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({"erro": "Erro interno", "mensagem": "Ocorreu um erro inesperado no servidor"}), 500

    # --- Registro de Blueprints ---
    # Certifique-se de que o arquivo routes.py existe e possui o blueprint 'main'
    from .routes import main
    app.register_blueprint(main)

    return app