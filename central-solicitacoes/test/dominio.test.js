const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarTransicao, validarNovaSolicitacao } = require('../src/domain/solicitacao');

test('transições válidas seguem a ordem Aberta → Em andamento → Concluída', () => {
  assert.equal(validarTransicao('ABERTA', 'EM_ANDAMENTO').ok, true);
  assert.equal(validarTransicao('EM_ANDAMENTO', 'CONCLUIDA').ok, true);
});

test('não permite pular etapas', () => {
  const r = validarTransicao('ABERTA', 'CONCLUIDA');
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /não é permitido pular/);
});

test('não permite voltar etapas', () => {
  assert.equal(validarTransicao('EM_ANDAMENTO', 'ABERTA').ok, false);
  assert.equal(validarTransicao('CONCLUIDA', 'EM_ANDAMENTO').ok, false);
});

test('não permite manter o mesmo status nem usar status inexistente', () => {
  assert.equal(validarTransicao('ABERTA', 'ABERTA').ok, false);
  assert.equal(validarTransicao('ABERTA', 'CANCELADA').ok, false);
});

test('rejeita campos obrigatórios vazios ou só com espaços', () => {
  const { erros } = validarNovaSolicitacao({ titulo: '   ', descricao: '', categoria: null });
  assert.deepEqual(Object.keys(erros).sort(), ['categoria', 'descricao', 'prioridade', 'titulo']);
});

test('normaliza prioridade e remove espaços', () => {
  const { dados, erros } = validarNovaSolicitacao({
    titulo: '  Impressora  ',
    descricao: 'Sem toner',
    categoria: 'TI',
    prioridade: 'alta',
  });
  assert.deepEqual(erros, {});
  assert.equal(dados.titulo, 'Impressora');
  assert.equal(dados.prioridade, 'ALTA');
});
