# Central de Solicitações

Aplicação web para registrar solicitações internas e acompanhar sua resolução, desenvolvida para o **Processo Seletivo 2026.2 da Loading Desenvolvimento Jr. (Full Stack)**.

Interface web → API REST → banco SQLite local. Tudo roda com um único comando.

## Tecnologias

| Parte | Tecnologia |
|---|---|
| Backend / API | Node.js (≥ 22.14) + [Express 5](https://expressjs.com/) |
| Banco de dados | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (arquivo local `data/solicitacoes.db`) |
| Interface | HTML, CSS e JavaScript puro (sem framework), servidos pelo próprio Express |
| Testes | Test runner nativo do Node (`node:test`) + `fetch` |

Dependências de produção: apenas `express` e `better-sqlite3`.

## Como executar

Pré-requisito: **Node.js 22.14 ou superior** — a versão LTS atual serve (`node -v` mostra a sua).

```bash
git clone <url-do-repositorio>
cd central-solicitacoes
npm install
npm start
```

Acesse **http://localhost:3000**.

- O banco é criado automaticamente em `data/solicitacoes.db` na primeira execução.
- Para usar outra porta: `PORT=4000 npm start` (no Windows PowerShell: `$env:PORT=4000; npm start`).
- Modo desenvolvimento (reinicia ao salvar): `npm run dev`.
- Para zerar os dados, pare o servidor e apague a pasta `data/`.

> **Nota sobre o `better-sqlite3`:** o pacote já traz binários prontos para Windows, macOS e Linux (x64 e ARM), então nada precisa ser compilado. O arquivo `.npmrc` do projeto (`ignore-scripts=true`) impede que o `npm install` tente compilá-lo com node-gyp, o que exigiria Python e Visual Studio Build Tools no Windows. Se aparecer um erro de `node-gyp` ou de `Node-API`, confira se o `.npmrc` está na pasta do projeto e se o Node é 22.14 ou mais novo.

## Testes

```bash
npm test
```

São 14 testes: regras de domínio (transições e validação) e testes de integração da API, que sobem o servidor com um banco em memória e fazem requisições HTTP reais cobrindo RF01 a RF06.

## Funcionalidades

### Requisitos obrigatórios

| Requisito | Como foi atendido |
|---|---|
| **RF01 — Cadastro** | Formulário com título, descrição, categoria e prioridade (Baixa/Média/Alta). O status inicial é sempre **Aberta**, definido pelo servidor (mesmo que outro valor seja enviado). |
| **RF02 — Consulta** | Lista de solicitações com status, prioridade, categoria e data; ao clicar, abre o detalhe completo. |
| **RF03 — Filtros** | Filtros por status e por prioridade (combináveis). Os contadores do topo também filtram por status ao clicar. |
| **RF04 — Regra de negócio** | Fluxo Aberta → Em andamento → Concluída validado **na API**. Saltar (Aberta → Concluída), voltar ou alterar uma concluída retorna erro 422. A interface só oferece o próximo passo válido. |
| **RF05 — Persistência** | SQLite em arquivo; os dados permanecem após reiniciar a aplicação. |
| **RF06 — Integração e validação** | A interface consome a API via `fetch`. Campos vazios (inclusive só espaços), prioridade inválida e transições inválidas são rejeitados com mensagens claras, exibidas junto a cada campo e em avisos. |

### Opcionais implementados

- Histórico de mudanças de status (com data/hora de cada mudança)
- Busca textual (título, descrição e categoria)
- Ordenação (mais recentes, mais antigas, maior prioridade)
- Exclusão de solicitação (com confirmação)
- Sugestão de categorias já usadas
- Contadores por status no topo
- Testes automatizados
- Layout responsivo (funciona no celular)

## API

Base: `http://localhost:3000/api`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/solicitacoes?status=&prioridade=&busca=&ordenacao=` | Lista (filtros opcionais) |
| `POST` | `/solicitacoes` | Cria uma solicitação |
| `GET` | `/solicitacoes/:id` | Detalha, com histórico de status |
| `PATCH` | `/solicitacoes/:id/status` | Avança o status |
| `DELETE` | `/solicitacoes/:id` | Exclui |
| `GET` | `/categorias` | Categorias já utilizadas |

Valores aceitos — `status`: `ABERTA`, `EM_ANDAMENTO`, `CONCLUIDA` · `prioridade`: `BAIXA`, `MEDIA`, `ALTA` · `ordenacao`: `recentes`, `antigas`, `prioridade`.

**Exemplo — criar:**

```bash
curl -X POST http://localhost:3000/api/solicitacoes \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Notebook não liga","descricao":"Notebook do RH","categoria":"TI","prioridade":"ALTA"}'
```

**Exemplo — transição inválida (Aberta → Concluída):**

```bash
curl -X PATCH http://localhost:3000/api/solicitacoes/1/status \
  -H "Content-Type: application/json" -d '{"status":"CONCLUIDA"}'
```

```json
{
  "erro": {
    "codigo": "TRANSICAO_INVALIDA",
    "mensagem": "Transição inválida: de \"Aberta\" só é possível ir para \"Em andamento\" (não é permitido pular ou voltar etapas)."
  }
}
```

Todos os erros seguem o mesmo formato `{ erro: { codigo, mensagem, detalhes? } }`. Em erros de validação, `detalhes` traz a mensagem de cada campo (`{ "titulo": "O título é obrigatório." }`).

| HTTP | Código | Quando |
|---|---|---|
| 400 | `VALIDACAO` | Campo obrigatório vazio, valor fora do permitido, filtro inválido |
| 400 | `JSON_INVALIDO` / `REQUISICAO_INVALIDA` | Corpo malformado ou id não numérico |
| 404 | `NAO_ENCONTRADO` | Solicitação ou rota inexistente |
| 422 | `TRANSICAO_INVALIDA` | Mudança de status fora do fluxo |

## Arquitetura

```
central-solicitacoes/
├── src/
│   ├── server.js                      # Ponto de entrada: abre o banco e sobe o servidor
│   ├── app.js                         # Monta o Express: JSON, rotas, arquivos estáticos e tratamento de erros
│   ├── database.js                    # Conexão SQLite e criação das tabelas
│   ├── errors.js                      # AppError: erros com status HTTP e código
│   ├── domain/solicitacao.js          # Regras de negócio puras: status, transições, validação
│   ├── services/solicitacaoService.js # Orquestra domínio + repositório
│   ├── repositories/solicitacaoRepository.js  # SQL e mapeamento de dados
│   └── routes/solicitacoes.js         # Rotas HTTP (só traduzem HTTP ↔ serviço)
├── public/                            # Interface web
│   ├── index.html
│   ├── styles.css
│   ├── api.js                         # Cliente HTTP da API
│   └── app.js                         # Renderização e eventos
├── test/                              # Testes de domínio e de integração
└── data/                              # Banco SQLite (criado na execução, ignorado pelo Git)
```

Fluxo de uma requisição: **rota → serviço → domínio (valida) → repositório (persiste)**.

### Decisões

- **A regra de status fica no backend.** A interface esconde transições inválidas por usabilidade, mas quem garante a regra é a API — qualquer cliente (curl, Postman) recebe o mesmo bloqueio.
- **Fluxo declarado em um mapa** (`PROXIMO_STATUS` em `domain/solicitacao.js`). Adicionar uma etapa, como "Em revisão", exige mudar só esse mapa, a lista de status e o `CHECK` do banco.
- **Domínio sem dependências.** `domain/solicitacao.js` não conhece Express nem SQLite, então é testado isoladamente.
- **Proteção contra concorrência.** A atualização de status só ocorre se o status no banco ainda for o lido (`WHERE status = statusAtual`), evitando que duas requisições simultâneas pulem uma etapa.
- **Histórico em transação.** A mudança de status e o registro no histórico são gravados juntos; se um falhar, nenhum é salvo.
- **`CHECK` no banco.** Status e prioridade também são restringidos no SQLite, como segunda camada de proteção.
- **Injeção do banco.** `criarApp(db)` recebe a conexão por parâmetro; os testes usam `:memory:` sem tocar no banco real.
- **SQLite** porque não exige instalar servidor de banco e atende ao requisito de execução local. Trocar por PostgreSQL afetaria apenas `database.js` e o repositório.
- **Front sem framework** para manter o projeto pequeno e sem etapa de build.

## Uso de IA

> ✏️ *Usei o claude para a estilização do front e o copilot para a verificação de erros nas APIs .*
