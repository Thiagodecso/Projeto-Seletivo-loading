const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CAMINHO_PADRAO = path.join(__dirname, '..', 'data', 'solicitacoes.db');

/**
 * Abre (ou cria) o banco SQLite e garante que as tabelas existam.
 * O arquivo fica em data/solicitacoes.db, então os dados sobrevivem
 * ao reinício da aplicação. Use ":memory:" para testes.
 */
function abrirBanco(caminho = process.env.DB_PATH || CAMINHO_PADRAO) {
  if (caminho !== ':memory:') {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new Database(caminho);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS solicitacoes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo        TEXT    NOT NULL,
      descricao     TEXT    NOT NULL,
      categoria     TEXT    NOT NULL,
      prioridade    TEXT    NOT NULL CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA')),
      status        TEXT    NOT NULL DEFAULT 'ABERTA'
                            CHECK (status IN ('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA')),
      criado_em     TEXT    NOT NULL,
      atualizado_em TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historico_status (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitacao_id  INTEGER NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
      status_anterior TEXT,
      status_novo     TEXT    NOT NULL,
      alterado_em     TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_solicitacoes_status     ON solicitacoes(status);
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_prioridade ON solicitacoes(prioridade);
    CREATE INDEX IF NOT EXISTS idx_historico_solicitacao   ON historico_status(solicitacao_id);
  `);

  return db;
}

module.exports = { abrirBanco };
