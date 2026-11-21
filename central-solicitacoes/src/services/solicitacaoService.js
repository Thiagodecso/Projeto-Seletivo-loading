const { AppError } = require('../errors');
const {
  STATUS,
  PRIORIDADE,
  validarNovaSolicitacao,
  validarTransicao,
  proximoStatus,
} = require('../domain/solicitacao');
const { ORDENACOES } = require('../repositories/solicitacaoRepository');

/**
 * Camada de serviço: orquestra validação (domínio) e persistência (repositório).
 * As rotas só chamam estes métodos e devolvem o resultado.
 */
function criarSolicitacaoService(repo) {
  function obterOuFalhar(id) {
    const solicitacao = repo.buscarPorId(id);
    if (!solicitacao) throw AppError.naoEncontrado(`Solicitação #${id} não encontrada.`);
    return solicitacao;
  }

  /** Acrescenta ao objeto o próximo status permitido, útil para a interface. */
  function comProximoStatus(solicitacao) {
    return { ...solicitacao, proximoStatus: proximoStatus(solicitacao.status) };
  }

  return {
    criar(entrada) {
      const { dados, erros } = validarNovaSolicitacao(entrada);
      if (Object.keys(erros).length) throw AppError.validacao(erros);
      // RF01: o status inicial é sempre Aberta, independente do que vier na requisição.
      return comProximoStatus(repo.criar(dados, STATUS.ABERTA));
    },

    listar(filtros = {}) {
      const erros = {};
      const status = filtros.status ? String(filtros.status).toUpperCase() : undefined;
      const prioridade = filtros.prioridade ? String(filtros.prioridade).toUpperCase() : undefined;
      const busca = filtros.busca ? String(filtros.busca).trim() : undefined;
      const ordenacao = filtros.ordenacao ? String(filtros.ordenacao) : undefined;

      if (status && !STATUS[status]) erros.status = `Status inválido. Use: ${Object.keys(STATUS).join(', ')}.`;
      if (prioridade && !PRIORIDADE[prioridade])
        erros.prioridade = `Prioridade inválida. Use: ${Object.keys(PRIORIDADE).join(', ')}.`;
      if (ordenacao && !ORDENACOES[ordenacao])
        erros.ordenacao = `Ordenação inválida. Use: ${Object.keys(ORDENACOES).join(', ')}.`;
      if (Object.keys(erros).length) throw AppError.validacao(erros);

      return repo.listar({ status, prioridade, busca, ordenacao }).map(comProximoStatus);
    },

    detalhar(id) {
      const solicitacao = obterOuFalhar(id);
      return { ...comProximoStatus(solicitacao), historico: repo.listarHistorico(id) };
    },

    alterarStatus(id, entrada) {
      const novoStatus = entrada && typeof entrada.status === 'string' ? entrada.status.trim().toUpperCase() : '';
      if (!novoStatus) throw AppError.validacao({ status: 'Informe o novo status.' });

      const atual = obterOuFalhar(id);
      const resultado = validarTransicao(atual.status, novoStatus);
      if (!resultado.ok) throw AppError.transicaoInvalida(resultado.mensagem);

      const atualizado = repo.atualizarStatus(id, atual.status, novoStatus);
      if (!atualizado) {
        // Outra requisição alterou o status entre a leitura e a escrita.
        throw AppError.transicaoInvalida('O status foi alterado por outra operação. Atualize a página e tente novamente.');
      }

      return this.detalhar(id);
    },

    excluir(id) {
      obterOuFalhar(id);
      repo.excluir(id);
    },

    listarCategorias() {
      return repo.listarCategorias();
    },
  };
}

module.exports = { criarSolicitacaoService };
