/**
 * Testes de integração da API: sobe o app com um banco em memória
 * e faz requisições HTTP reais com fetch.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirBanco } = require('../src/database');
const { criarApp } = require('../src/app');

let servidor;
let base;
let db;

before(async () => {
  db = abrirBanco(':memory:');
  servidor = criarApp(db).listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(() => {
  servidor.close();
  db.close();
});

async function chamar(metodo, caminho, corpo) {
  const resposta = await fetch(base + caminho, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

const nova = (extra = {}) => ({
  titulo: 'Trocar lâmpada',
  descricao: 'Sala 2 sem iluminação',
  categoria: 'Manutenção',
  prioridade: 'MEDIA',
  ...extra,
});

test('RF01: cria solicitação com status inicial Aberta, mesmo que outro status seja enviado', async () => {
  const { status, corpo } = await chamar('POST', '/solicitacoes', nova({ status: 'CONCLUIDA' }));
  assert.equal(status, 201);
  assert.equal(corpo.status, 'ABERTA');
  assert.equal(corpo.proximoStatus, 'EM_ANDAMENTO');
});

test('RF06: rejeita campos obrigatórios vazios com detalhes por campo', async () => {
  const { status, corpo } = await chamar('POST', '/solicitacoes', { titulo: '', prioridade: 'URGENTE' });
  assert.equal(status, 400);
  assert.equal(corpo.erro.codigo, 'VALIDACAO');
  assert.ok(corpo.erro.detalhes.titulo);
  assert.ok(corpo.erro.detalhes.descricao);
  assert.ok(corpo.erro.detalhes.categoria);
  assert.ok(corpo.erro.detalhes.prioridade);
});

test('RF06: rejeita JSON malformado com mensagem compreensível', async () => {
  const resposta = await fetch(`${base}/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ titulo: ',
  });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 400);
  assert.equal(corpo.erro.codigo, 'JSON_INVALIDO');
});

test('RF02: consulta por id retorna dados e histórico; id inexistente retorna 404', async () => {
  const { corpo: criada } = await chamar('POST', '/solicitacoes', nova());
  const { status, corpo } = await chamar('GET', `/solicitacoes/${criada.id}`);
  assert.equal(status, 200);
  assert.equal(corpo.titulo, 'Trocar lâmpada');
  assert.equal(corpo.historico.length, 1);

  const inexistente = await chamar('GET', '/solicitacoes/99999');
  assert.equal(inexistente.status, 404);

  const idInvalido = await chamar('GET', '/solicitacoes/abc');
  assert.equal(idInvalido.status, 400);
});

test('RF04: segue o fluxo completo e bloqueia saltos e retornos', async () => {
  const { corpo: s } = await chamar('POST', '/solicitacoes', nova());

  const salto = await chamar('PATCH', `/solicitacoes/${s.id}/status`, { status: 'CONCLUIDA' });
  assert.equal(salto.status, 422);
  assert.equal(salto.corpo.erro.codigo, 'TRANSICAO_INVALIDA');

  const passo1 = await chamar('PATCH', `/solicitacoes/${s.id}/status`, { status: 'EM_ANDAMENTO' });
  assert.equal(passo1.status, 200);
  assert.equal(passo1.corpo.status, 'EM_ANDAMENTO');

  const volta = await chamar('PATCH', `/solicitacoes/${s.id}/status`, { status: 'ABERTA' });
  assert.equal(volta.status, 422);

  const passo2 = await chamar('PATCH', `/solicitacoes/${s.id}/status`, { status: 'CONCLUIDA' });
  assert.equal(passo2.corpo.status, 'CONCLUIDA');
  assert.equal(passo2.corpo.proximoStatus, null);
  assert.equal(passo2.corpo.historico.length, 3);

  const depoisDeConcluida = await chamar('PATCH', `/solicitacoes/${s.id}/status`, { status: 'EM_ANDAMENTO' });
  assert.equal(depoisDeConcluida.status, 422);

  const semStatus = await chamar('PATCH', `/solicitacoes/${s.id}/status`, {});
  assert.equal(semStatus.status, 400);
});

test('RF03: filtra por status e por prioridade, e rejeita filtros inválidos', async () => {
  const { corpo: alta } = await chamar('POST', '/solicitacoes', nova({ titulo: 'Servidor fora do ar', prioridade: 'ALTA' }));
  await chamar('PATCH', `/solicitacoes/${alta.id}/status`, { status: 'EM_ANDAMENTO' });
  await chamar('POST', '/solicitacoes', nova({ titulo: 'Pedido de cadeira', prioridade: 'BAIXA' }));

  const porStatus = await chamar('GET', '/solicitacoes?status=EM_ANDAMENTO');
  assert.ok(porStatus.corpo.length >= 1);
  assert.ok(porStatus.corpo.every((s) => s.status === 'EM_ANDAMENTO'));

  const porPrioridade = await chamar('GET', '/solicitacoes?prioridade=BAIXA');
  assert.ok(porPrioridade.corpo.every((s) => s.prioridade === 'BAIXA'));

  const combinado = await chamar('GET', '/solicitacoes?status=EM_ANDAMENTO&prioridade=ALTA');
  assert.deepEqual(combinado.corpo.map((s) => s.id), [alta.id]);

  const invalido = await chamar('GET', '/solicitacoes?status=PERDIDA');
  assert.equal(invalido.status, 400);
});

test('busca textual encontra por título e trata caracteres especiais', async () => {
  await chamar('POST', '/solicitacoes', nova({ titulo: 'Desconto de 50% no contrato' }));
  const { corpo } = await chamar('GET', `/solicitacoes?busca=${encodeURIComponent('50%')}`);
  assert.equal(corpo.length, 1);
  const nada = await chamar('GET', '/solicitacoes?busca=%25%25%25nada');
  assert.equal(nada.corpo.length, 0);
});

test('exclusão remove a solicitação', async () => {
  const { corpo: s } = await chamar('POST', '/solicitacoes', nova());
  const { status } = await chamar('DELETE', `/solicitacoes/${s.id}`);
  assert.equal(status, 204);
  assert.equal((await chamar('GET', `/solicitacoes/${s.id}`)).status, 404);
});
