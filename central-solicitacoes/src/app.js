const path = require('path');
const express = require('express');
const { AppError } = require('./errors');
const { criarSolicitacaoRepository } = require('./repositories/solicitacaoRepository');
const { criarSolicitacaoService } = require('./services/solicitacaoService');
const { criarRotas } = require('./routes/solicitacoes');

/**
 * Monta a aplicação Express a partir de uma conexão de banco.
 * Recebe o banco por parâmetro para que os testes usem um banco em memória.
 */
function criarApp(db) {
  const app = express();
  const service = criarSolicitacaoService(criarSolicitacaoRepository(db));

  app.use(express.json({ limit: '100kb' }));

  app.use('/api', criarRotas(service));

  // Rota /api desconhecida → 404 em JSON (em vez da página HTML padrão).
  app.use('/api', (req, res, next) => {
    next(AppError.naoEncontrado(`Rota ${req.method} ${req.originalUrl} não existe.`));
  });

  // Interface web estática.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Middleware de erros: toda falha vira um JSON no mesmo formato.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        erro: { codigo: err.codigo, mensagem: err.message, detalhes: err.detalhes },
      });
    }

    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({
        erro: { codigo: 'JSON_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido.' },
      });
    }

    console.error(err);
    return res.status(500).json({
      erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado no servidor. Tente novamente.' },
    });
  });

  return app;
}

module.exports = { criarApp };
