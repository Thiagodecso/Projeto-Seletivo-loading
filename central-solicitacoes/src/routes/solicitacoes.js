const express = require('express');
const { AppError } = require('../errors');

/** Converte o parâmetro :id em inteiro positivo ou lança erro 400. */
function lerId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.requisicaoInvalida(`Identificador "${req.params.id}" inválido.`);
  }
  return id;
}

/**
 * Rotas HTTP. Cada rota só traduz HTTP ↔ serviço; nenhuma regra mora aqui.
 *
 *   GET    /api/solicitacoes?status=&prioridade=&busca=&ordenacao=
 *   POST   /api/solicitacoes
 *   GET    /api/solicitacoes/:id
 *   PATCH  /api/solicitacoes/:id/status   { "status": "EM_ANDAMENTO" }
 *   DELETE /api/solicitacoes/:id
 *   GET    /api/categorias
 */
function criarRotas(service) {
  const router = express.Router();

  router.get('/solicitacoes', (req, res) => {
    res.json(service.listar(req.query));
  });

  router.post('/solicitacoes', (req, res) => {
    const criada = service.criar(req.body);
    res.status(201).location(`/api/solicitacoes/${criada.id}`).json(criada);
  });

  router.get('/solicitacoes/:id', (req, res) => {
    res.json(service.detalhar(lerId(req)));
  });

  router.patch('/solicitacoes/:id/status', (req, res) => {
    res.json(service.alterarStatus(lerId(req), req.body));
  });

  router.delete('/solicitacoes/:id', (req, res) => {
    service.excluir(lerId(req));
    res.status(204).end();
  });

  router.get('/categorias', (req, res) => {
    res.json(service.listarCategorias());
  });

  return router;
}

module.exports = { criarRotas };
