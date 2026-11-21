/**
 * Cliente HTTP da API. Toda comunicação com o backend passa por aqui.
 * Em caso de erro, lança um ApiError com a mensagem e os detalhes por campo
 * devolvidos pelo servidor, para a interface exibir ao usuário.
 */
class ApiError extends Error {
  constructor(mensagem, { status, codigo, detalhes } = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes || {};
  }
}

const api = (() => {
  async function requisitar(metodo, url, corpo) {
    let resposta;
    try {
      resposta = await fetch(url, {
        method: metodo,
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está rodando.');
    }

    if (resposta.status === 204) return null;

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      const erro = dados && dados.erro;
      throw new ApiError(erro?.mensagem || `Erro ${resposta.status} ao processar a requisição.`, {
        status: resposta.status,
        codigo: erro?.codigo,
        detalhes: erro?.detalhes,
      });
    }

    return dados;
  }

  return {
    listar(filtros = {}) {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([chave, valor]) => {
        if (valor) params.set(chave, valor);
      });
      const qs = params.toString();
      return requisitar('GET', `/api/solicitacoes${qs ? `?${qs}` : ''}`);
    },
    detalhar: (id) => requisitar('GET', `/api/solicitacoes/${id}`),
    criar: (dados) => requisitar('POST', '/api/solicitacoes', dados),
    alterarStatus: (id, status) => requisitar('PATCH', `/api/solicitacoes/${id}/status`, { status }),
    excluir: (id) => requisitar('DELETE', `/api/solicitacoes/${id}`),
    categorias: () => requisitar('GET', '/api/categorias'),
  };
})();
