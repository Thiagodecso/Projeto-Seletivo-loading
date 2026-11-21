/**
 * Camada de acesso a dados: só SQL, nenhuma regra de negócio.
 * Converte linhas do banco (snake_case) para objetos da aplicação (camelCase).
 */

const ORDENACOES = Object.freeze({
  recentes: 's.criado_em DESC, s.id DESC',
  antigas: 's.criado_em ASC, s.id ASC',
  prioridade: `CASE s.prioridade WHEN 'ALTA' THEN 0 WHEN 'MEDIA' THEN 1 ELSE 2 END, s.criado_em DESC`,
});

function mapear(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    categoria: linha.categoria,
    prioridade: linha.prioridade,
    status: linha.status,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function criarSolicitacaoRepository(db) {
  const stmts = {
    inserir: db.prepare(`
      INSERT INTO solicitacoes (titulo, descricao, categoria, prioridade, status, criado_em, atualizado_em)
      VALUES (@titulo, @descricao, @categoria, @prioridade, @status, @agora, @agora)
    `),
    buscarPorId: db.prepare('SELECT * FROM solicitacoes WHERE id = ?'),
    atualizarStatus: db.prepare(`
      UPDATE solicitacoes SET status = @status, atualizado_em = @agora
      WHERE id = @id AND status = @statusAtual
    `),
    inserirHistorico: db.prepare(`
      INSERT INTO historico_status (solicitacao_id, status_anterior, status_novo, alterado_em)
      VALUES (?, ?, ?, ?)
    `),
    listarHistorico: db.prepare(`
      SELECT status_anterior, status_novo, alterado_em
      FROM historico_status WHERE solicitacao_id = ? ORDER BY id ASC
    `),
    excluir: db.prepare('DELETE FROM solicitacoes WHERE id = ?'),
    categorias: db.prepare('SELECT DISTINCT categoria FROM solicitacoes ORDER BY categoria COLLATE NOCASE'),
  };

  return {
    criar(dados, statusInicial) {
      const agora = new Date().toISOString();
      const criar = db.transaction(() => {
        const { lastInsertRowid } = stmts.inserir.run({ ...dados, status: statusInicial, agora });
        stmts.inserirHistorico.run(lastInsertRowid, null, statusInicial, agora);
        return lastInsertRowid;
      });
      return this.buscarPorId(criar());
    },

    buscarPorId(id) {
      return mapear(stmts.buscarPorId.get(id));
    },

    /** Filtros opcionais: status, prioridade, busca (título/descrição/categoria), ordenacao. */
    listar({ status, prioridade, busca, ordenacao } = {}) {
      const condicoes = [];
      const params = {};

      if (status) {
        condicoes.push('s.status = @status');
        params.status = status;
      }
      if (prioridade) {
        condicoes.push('s.prioridade = @prioridade');
        params.prioridade = prioridade;
      }
      if (busca) {
        condicoes.push(`(s.titulo LIKE @busca ESCAPE '\\' OR s.descricao LIKE @busca ESCAPE '\\' OR s.categoria LIKE @busca ESCAPE '\\')`);
        params.busca = `%${busca.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      }

      const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
      const orderBy = ORDENACOES[ordenacao] || ORDENACOES.recentes;

      return db.prepare(`SELECT s.* FROM solicitacoes s ${where} ORDER BY ${orderBy}`).all(params).map(mapear);
    },

    /**
     * Atualiza o status somente se ele ainda for o esperado (statusAtual).
     * Isso evita que duas requisições simultâneas pulem uma etapa.
     * Retorna true se a atualização aconteceu.
     */
    atualizarStatus(id, statusAtual, novoStatus) {
      const agora = new Date().toISOString();
      const atualizar = db.transaction(() => {
        const { changes } = stmts.atualizarStatus.run({ id, statusAtual, status: novoStatus, agora });
        if (changes === 0) return false;
        stmts.inserirHistorico.run(id, statusAtual, novoStatus, agora);
        return true;
      });
      return atualizar();
    },

    listarHistorico(id) {
      return stmts.listarHistorico.all(id).map((h) => ({
        statusAnterior: h.status_anterior,
        statusNovo: h.status_novo,
        alteradoEm: h.alterado_em,
      }));
    },

    excluir(id) {
      return stmts.excluir.run(id).changes > 0;
    },

    listarCategorias() {
      return stmts.categorias.all().map((l) => l.categoria);
    },
  };
}

module.exports = { criarSolicitacaoRepository, ORDENACOES };
