/**
 * Regras de domínio da solicitação.
 *
 * Tudo que define "o que é uma solicitação válida" e "como o status pode mudar"
 * fica aqui, sem depender de Express nem do banco. Assim a regra de negócio
 * pode ser testada isoladamente e reaproveitada por qualquer camada.
 */

const STATUS = Object.freeze({
  ABERTA: 'ABERTA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  CONCLUIDA: 'CONCLUIDA',
});

const STATUS_LABEL = Object.freeze({
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
});

const PRIORIDADE = Object.freeze({
  BAIXA: 'BAIXA',
  MEDIA: 'MEDIA',
  ALTA: 'ALTA',
});

const PRIORIDADE_LABEL = Object.freeze({
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
});

/**
 * Fluxo permitido: cada status aponta para o único próximo status possível.
 * Aberta → Em andamento → Concluída. Concluída é estado final.
 * Para mudar o fluxo no futuro, basta alterar este mapa.
 */
const PROXIMO_STATUS = Object.freeze({
  [STATUS.ABERTA]: STATUS.EM_ANDAMENTO,
  [STATUS.EM_ANDAMENTO]: STATUS.CONCLUIDA,
  [STATUS.CONCLUIDA]: null,
});

const LIMITES = Object.freeze({
  titulo: 120,
  descricao: 2000,
  categoria: 60,
});

function proximoStatus(statusAtual) {
  return PROXIMO_STATUS[statusAtual] ?? null;
}

/**
 * Verifica se a transição é permitida.
 * Retorna { ok: true } ou { ok: false, mensagem }.
 */
function validarTransicao(statusAtual, novoStatus) {
  if (!Object.values(STATUS).includes(novoStatus)) {
    return {
      ok: false,
      mensagem: `Status "${novoStatus}" não existe. Valores aceitos: ${Object.values(STATUS).join(', ')}.`,
    };
  }

  if (statusAtual === novoStatus) {
    return { ok: false, mensagem: `A solicitação já está com status "${STATUS_LABEL[statusAtual]}".` };
  }

  const esperado = proximoStatus(statusAtual);

  if (esperado === null) {
    return {
      ok: false,
      mensagem: `A solicitação já está "${STATUS_LABEL[statusAtual]}" e não pode mais mudar de status.`,
    };
  }

  if (novoStatus !== esperado) {
    return {
      ok: false,
      mensagem:
        `Transição inválida: de "${STATUS_LABEL[statusAtual]}" só é possível ir para ` +
        `"${STATUS_LABEL[esperado]}" (não é permitido pular ou voltar etapas).`,
    };
  }

  return { ok: true };
}

/**
 * Valida e normaliza os dados de criação.
 * Retorna { dados, erros } — erros é um objeto { campo: mensagem }.
 */
function validarNovaSolicitacao(entrada) {
  const corpo = entrada && typeof entrada === 'object' ? entrada : {};
  const erros = {};

  const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

  const titulo = texto(corpo.titulo);
  const descricao = texto(corpo.descricao);
  const categoria = texto(corpo.categoria);
  const prioridade = texto(corpo.prioridade).toUpperCase();

  if (!titulo) erros.titulo = 'O título é obrigatório.';
  else if (titulo.length > LIMITES.titulo) erros.titulo = `O título deve ter no máximo ${LIMITES.titulo} caracteres.`;

  if (!descricao) erros.descricao = 'A descrição é obrigatória.';
  else if (descricao.length > LIMITES.descricao)
    erros.descricao = `A descrição deve ter no máximo ${LIMITES.descricao} caracteres.`;

  if (!categoria) erros.categoria = 'A categoria é obrigatória.';
  else if (categoria.length > LIMITES.categoria)
    erros.categoria = `A categoria deve ter no máximo ${LIMITES.categoria} caracteres.`;

  if (!prioridade) erros.prioridade = 'A prioridade é obrigatória.';
  else if (!PRIORIDADE[prioridade]) erros.prioridade = 'A prioridade deve ser BAIXA, MEDIA ou ALTA.';

  return {
    dados: { titulo, descricao, categoria, prioridade },
    erros,
  };
}

module.exports = {
  STATUS,
  STATUS_LABEL,
  PRIORIDADE,
  PRIORIDADE_LABEL,
  LIMITES,
  proximoStatus,
  validarTransicao,
  validarNovaSolicitacao,
};
