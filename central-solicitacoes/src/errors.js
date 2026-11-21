/**
 * Erro de aplicação com status HTTP e código legível.
 * O middleware de erros converte isso em uma resposta JSON padronizada:
 *   { "erro": { "codigo": "...", "mensagem": "...", "detalhes": { campo: msg } } }
 */
class AppError extends Error {
  constructor(status, codigo, mensagem, detalhes = undefined) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  static validacao(detalhes) {
    return new AppError(400, 'VALIDACAO', 'Existem campos inválidos ou não preenchidos.', detalhes);
  }

  static naoEncontrado(mensagem) {
    return new AppError(404, 'NAO_ENCONTRADO', mensagem);
  }

  static transicaoInvalida(mensagem) {
    return new AppError(422, 'TRANSICAO_INVALIDA', mensagem);
  }

  static requisicaoInvalida(mensagem) {
    return new AppError(400, 'REQUISICAO_INVALIDA', mensagem);
  }
}

module.exports = { AppError };
