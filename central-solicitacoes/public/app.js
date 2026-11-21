/**
 * Lógica da interface: renderiza a lista, o formulário e o detalhe.
 * As regras (validação e transição de status) são aplicadas pela API;
 * a interface apenas exibe o que a API permite e mostra os erros que ela devolve.
 */

const STATUS_LABEL = { ABERTA: 'Aberta', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' };
const PRIORIDADE_LABEL = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' };
const ACAO_LABEL = { EM_ANDAMENTO: 'Iniciar atendimento', CONCLUIDA: 'Marcar como concluída' };

const el = {
  form: document.getElementById('form-nova'),
  botaoSalvar: document.getElementById('botao-salvar'),
  filtros: document.getElementById('filtros'),
  limpar: document.getElementById('limpar-filtros'),
  lista: document.getElementById('lista'),
  vazio: document.getElementById('vazio'),
  resumo: document.getElementById('resumo'),
  categorias: document.getElementById('lista-categorias'),
  dialogo: document.getElementById('detalhe'),
  dialogoConteudo: document.getElementById('detalhe-conteudo'),
  toasts: document.getElementById('toasts'),
};

/* ---------- utilitários ---------- */

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function avisar(mensagem, tipo = 'sucesso') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  toast.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  toast.textContent = mensagem;
  el.toasts.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function seloStatus(status) {
  return `<span class="selo selo--${status.toLowerCase()}">${STATUS_LABEL[status]}</span>`;
}

function seloPrioridade(prioridade) {
  return `<span class="prioridade prioridade--${prioridade.toLowerCase()}">${PRIORIDADE_LABEL[prioridade]}</span>`;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ---------- listagem (RF02 / RF03) ---------- */

function lerFiltros() {
  return Object.fromEntries(new FormData(el.filtros));
}

async function carregarLista() {
  try {
    const filtros = lerFiltros();
    const [solicitacoes, todas] = await Promise.all([api.listar(filtros), api.listar()]);
    renderizarLista(solicitacoes, filtros);
    renderizarResumo(todas);
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
}

function renderizarLista(solicitacoes, filtros) {
  el.lista.innerHTML = solicitacoes
    .map(
      (s) => `
      <li>
        <button class="item" data-id="${s.id}" aria-label="Abrir solicitação ${s.id}: ${escapar(s.titulo)}">
          <div class="item__topo">
            <span class="item__id">#${s.id}</span>
            ${seloStatus(s.status)}
          </div>
          <strong class="item__titulo">${escapar(s.titulo)}</strong>
          <span class="item__descricao">${escapar(s.descricao)}</span>
          <div class="item__rodape">
            ${seloPrioridade(s.prioridade)}
            <span class="item__categoria">${escapar(s.categoria)}</span>
            <span class="item__data">${formatarData(s.criadoEm)}</span>
          </div>
        </button>
      </li>`
    )
    .join('');

  const temFiltro = Object.entries(filtros).some(([k, v]) => k !== 'ordenacao' && v);
  el.vazio.hidden = solicitacoes.length > 0;
  el.vazio.textContent = temFiltro
    ? 'Nenhuma solicitação corresponde aos filtros.'
    : 'Nenhuma solicitação registrada ainda. Use o formulário ao lado para criar a primeira.';
}

function renderizarResumo(todas) {
  const contagem = { ABERTA: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0 };
  todas.forEach((s) => contagem[s.status]++);
  el.resumo.innerHTML = Object.entries(contagem)
    .map(
      ([status, total]) => `
      <button type="button" class="resumo__item resumo__item--${status.toLowerCase()}" data-status="${status}"
              title="Filtrar por ${STATUS_LABEL[status]}">
        <span class="resumo__numero">${total}</span>
        <span class="resumo__rotulo">${STATUS_LABEL[status]}</span>
      </button>`
    )
    .join('');
}

async function carregarCategorias() {
  try {
    const categorias = await api.categorias();
    el.categorias.innerHTML = categorias.map((c) => `<option value="${escapar(c)}"></option>`).join('');
  } catch {
    /* sugestões são opcionais; ignora falha */
  }
}

/* ---------- cadastro (RF01 / RF06) ---------- */

function limparErros() {
  el.form.querySelectorAll('[data-erro]').forEach((s) => (s.textContent = ''));
  el.form.querySelectorAll('.invalido').forEach((c) => c.classList.remove('invalido'));
}

function mostrarErros(detalhes) {
  Object.entries(detalhes).forEach(([campo, mensagem]) => {
    const alvo = el.form.querySelector(`[data-erro="${campo}"]`);
    const input = el.form.elements[campo];
    if (alvo) alvo.textContent = mensagem;
    if (input) input.classList.add('invalido');
  });
  const primeiro = el.form.querySelector('.invalido');
  if (primeiro) primeiro.focus();
}

el.form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparErros();

  // Validação é feita pela API; a interface só envia e exibe a resposta.
  const dados = Object.fromEntries(new FormData(el.form));
  el.botaoSalvar.disabled = true;

  try {
    const criada = await api.criar(dados);
    el.form.reset();
    avisar(`Solicitação #${criada.id} registrada com status Aberta.`);
    await Promise.all([carregarLista(), carregarCategorias()]);
  } catch (erro) {
    if (erro.detalhes && Object.keys(erro.detalhes).length) mostrarErros(erro.detalhes);
    avisar(erro.message, 'erro');
  } finally {
    el.botaoSalvar.disabled = false;
  }
});

el.form.addEventListener('input', (evento) => {
  const campo = evento.target.name;
  if (!campo) return;
  evento.target.classList.remove('invalido');
  const alvo = el.form.querySelector(`[data-erro="${campo}"]`);
  if (alvo) alvo.textContent = '';
});

/* ---------- detalhe e mudança de status (RF02 / RF04) ---------- */

const ETAPAS = ['ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA'];

function renderizarEtapas(statusAtual) {
  const indiceAtual = ETAPAS.indexOf(statusAtual);
  return `
    <ol class="etapas" aria-label="Fluxo de status">
      ${ETAPAS.map((etapa, i) => {
        const estado = i < indiceAtual ? 'feita' : i === indiceAtual ? 'atual' : 'pendente';
        return `<li class="etapa etapa--${estado}" ${estado === 'atual' ? 'aria-current="step"' : ''}>
                  <span class="etapa__ponto"></span>${STATUS_LABEL[etapa]}
                </li>`;
      }).join('')}
    </ol>`;
}

function renderizarHistorico(historico) {
  return `
    <ul class="historico">
      ${historico
        .map(
          (h) => `
        <li>
          <span class="historico__data">${formatarData(h.alteradoEm)}</span>
          <span>${
            h.statusAnterior
              ? `${STATUS_LABEL[h.statusAnterior]} → <strong>${STATUS_LABEL[h.statusNovo]}</strong>`
              : `Criada como <strong>${STATUS_LABEL[h.statusNovo]}</strong>`
          }</span>
        </li>`
        )
        .join('')}
    </ul>`;
}

async function abrirDetalhe(id) {
  try {
    const s = await api.detalhar(id);
    el.dialogoConteudo.innerHTML = `
      <header class="detalhe__cabecalho">
        <div>
          <span class="item__id">#${s.id}</span>
          <h2 id="detalhe-titulo">${escapar(s.titulo)}</h2>
        </div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button>
      </header>

      ${renderizarEtapas(s.status)}

      <dl class="dados">
        <div><dt>Status</dt><dd>${seloStatus(s.status)}</dd></div>
        <div><dt>Prioridade</dt><dd>${seloPrioridade(s.prioridade)}</dd></div>
        <div><dt>Categoria</dt><dd>${escapar(s.categoria)}</dd></div>
        <div><dt>Criada em</dt><dd>${formatarData(s.criadoEm)}</dd></div>
        <div><dt>Atualizada em</dt><dd>${formatarData(s.atualizadoEm)}</dd></div>
      </dl>

      <h3>Descrição</h3>
      <p class="detalhe__descricao">${escapar(s.descricao)}</p>

      <h3>Histórico de status</h3>
      ${renderizarHistorico(s.historico)}

      <footer class="detalhe__acoes">
        <button class="botao botao--perigo" data-acao="excluir" data-id="${s.id}">Excluir</button>
        ${
          s.proximoStatus
            ? `<button class="botao botao--primario" data-acao="avancar" data-id="${s.id}" data-status="${s.proximoStatus}">
                 ${ACAO_LABEL[s.proximoStatus]} →
               </button>`
            : '<span class="finalizada">Solicitação finalizada</span>'
        }
      </footer>`;

    if (!el.dialogo.open) el.dialogo.showModal();
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
}

async function avancarStatus(id, status, botao) {
  botao.disabled = true;
  try {
    await api.alterarStatus(id, status);
    avisar(`Solicitação #${id} agora está "${STATUS_LABEL[status]}".`);
    await Promise.all([abrirDetalhe(id), carregarLista()]);
  } catch (erro) {
    avisar(erro.message, 'erro');
    botao.disabled = false;
  }
}

async function excluir(id) {
  if (!confirm(`Excluir a solicitação #${id}? Essa ação não pode ser desfeita.`)) return;
  try {
    await api.excluir(id);
    el.dialogo.close();
    avisar(`Solicitação #${id} excluída.`);
    await Promise.all([carregarLista(), carregarCategorias()]);
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
}

/* ---------- eventos ---------- */

el.lista.addEventListener('click', (evento) => {
  const item = evento.target.closest('.item');
  if (item) abrirDetalhe(Number(item.dataset.id));
});

el.dialogo.addEventListener('click', (evento) => {
  if (evento.target === el.dialogo) return el.dialogo.close(); // clique fora
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const id = Number(botao.dataset.id);
  if (botao.dataset.acao === 'fechar') el.dialogo.close();
  if (botao.dataset.acao === 'avancar') avancarStatus(id, botao.dataset.status, botao);
  if (botao.dataset.acao === 'excluir') excluir(id);
});

el.filtros.addEventListener('change', carregarLista);
el.filtros.addEventListener('input', debounce(carregarLista, 250));
el.filtros.addEventListener('submit', (e) => e.preventDefault());

el.limpar.addEventListener('click', () => {
  el.filtros.reset();
  carregarLista();
});

el.resumo.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-status]');
  if (!botao) return;
  el.filtros.elements.status.value = botao.dataset.status;
  carregarLista();
});

carregarLista();
carregarCategorias();
