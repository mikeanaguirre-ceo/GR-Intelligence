// ============================================================
// GR REVENUE INTELLIGENCE DASHBOARD
// ============================================================
// Fetches live data from n8n webhook and renders 9 tabs.
// Hard-coded operational knowledge (team, clients, alerts) is
// defined as JS constants — not fetched — because that data
// lives in people's heads, not in HubSpot.
// ============================================================

const DATA_URL = 'https://mikea.app.n8n.cloud/webhook/gr-dashboard';
const TASKS_URL = './tasks.json';

// --- Operational knowledge (hardcoded, curated) ---

const ACTIVE_CLIENTS = {
  STIL: {
    name: 'STIL',
    contact: 'Estela Escalante',
    email: 'eescalante@stil.mx',
    phone: '+1 656-308-4410',
    owner: 'Mike/Migue',
    note: 'WB sin respuesta'
  },
  IMMMU: {
    name: 'IMMMU',
    contact: 'María Santoyo',
    email: 'maria@immmu.mx',
    phone: '+525611731945',
    owner: 'Mike',
    note: 'Factura abril pendiente'
  },
  CETES: {
    name: 'CETES',
    contact: 'Óscar Morales',
    email: 'omorales@cetesdirecto.com',
    phone: '+52 55 2413 5515',
    owner: 'Mike',
    note: 'El más grande del pipeline'
  },
  GPV: {
    name: 'GPV',
    contact: 'Ney Galicia',
    email: 'ngaliciaa@sapv.com.mx',
    phone: '+52 55 5683 4900',
    owner: 'Mike',
    note: 'Propuesta 13-abr sin respuesta'
  },
  COMIR: {
    name: 'COMIR',
    contact: 'Anai Cruz',
    owner: 'Migue',
    note: 'Reunión 22-abr'
  }
};

// ALERTS: se genera dinámicamente desde DATA.deals + TASKS en buildAlerts()

// --- State ---
let DATA = null;
let TASKS = null;
let currentTab = 'recap';
let pipelineFilters = { prod: 'ALL', owner: 'ALL', excludeP: false };
let pendientesFilters = { persona: 'Todos', urgency: 'ALL', scope: 'ALL' };

// --- Utilities ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtK(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return '$' + Math.round(n);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((d - now) / (1000 * 60 * 60 * 24));
}

function tagForStage(stage, stageLabel) {
  // Prefer the label from the webhook (handles custom stage IDs correctly)
  const map = {
    presentationscheduled: 'tag-propuesta',
    qualifiedtobuy: 'tag-educacion',
    appointmentscheduled: 'tag-atraccion',
    closedwon: 'tag-won',
    decisionmakerboughtin: 'tag-won',
    '1332596061': 'tag-atraccion',    // Señal Detectada
    '1332596062': 'tag-atraccion',    // Reply
    '1332596063': 'tag-atraccion',    // Contactado
    '1332596064': 'tag-educacion',    // En Conv.
    '1092009814': 'tag-perdida'       // Perdida
  };
  const cls = map[stage] || 'tag-perdida';
  const label = stageLabel || stage || '—';
  return `<span class="tag ${cls}">${label}</span>`;
}

// --- Data fetch ---
async function loadData() {
  try {
    const [dealsRes, tasksRes] = await Promise.all([
      fetch(DATA_URL),
      fetch(TASKS_URL).catch(() => null)
    ]);
    if (!dealsRes.ok) throw new Error('HTTP ' + dealsRes.status);
    DATA = await dealsRes.json();
    if (!DATA.ok) throw new Error('Webhook returned ok:false');

    // Tasks are optional — dashboard works without them
    if (tasksRes && tasksRes.ok) {
      try { TASKS = await tasksRes.json(); } catch (e) { TASKS = null; }
    } else if (window.location.protocol === 'file:') {
      // Browsers block fetch of local files from file:// origin
      // User needs to serve via http:// (GitHub Pages, local server, etc.)
      console.warn('tasks.json no se puede cargar desde file:// — subir a GitHub Pages o usar un servidor local');
    }

    updateTimer();
    updateFooter();
    renderCurrentTab();
  } catch (err) {
    console.error('Load error:', err);
    $('#p-recap').innerHTML = `<div class="error">
      Error cargando datos: ${err.message}<br>
      <small>URL: ${DATA_URL}</small>
    </div>`;
  }
}

function updateTimer() {
  const d = new Date(DATA.generadoEn);
  $('#timer').textContent = d.toLocaleString('es-MX', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
  });
}

function updateFooter() {
  $('#ftr-deals').textContent = DATA.deals.length + ' deals live';
}

// --- Tab routing ---
function switchTab(tabId) {
  currentTab = tabId;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'p-' + tabId));
  renderCurrentTab();
}

function renderCurrentTab() {
  if (!DATA) return;
  const renderers = {
    recap: renderRecap,
    overview: renderOverview,
    pipeline: renderPipeline,
    won: renderWon,
    clientes: renderClientes,
    pendientes: renderPendientes,
    alertas: renderAlertas,
    amplemarket: renderAmplemarket,
    forecast: renderForecast
  };
  const fn = renderers[currentTab];
  if (fn) fn();
}

// --- RECAP ---
function renderRecap() {
  const k = DATA.kpis;
  const propuestas = DATA.deals
    .filter(d => d.stage === 'presentationscheduled')
    .sort((a, b) => new Date(a.closedate || '2099') - new Date(b.closedate || '2099'));
  const educacion = DATA.deals
    .filter(d => d.stage === 'qualifiedtobuy')
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 6);

  let html = `
    <div class="kpi-grid">
      <div class="kpi kpi-purple">
        <div class="kpi-label">Pipeline Total</div>
        <div class="kpi-value">${fmtK(k.pipeline)}</div>
        <div class="kpi-sub">${k.totalDeals} deals activos</div>
      </div>
      <div class="kpi kpi-pink">
        <div class="kpi-label">Forecast</div>
        <div class="kpi-value">${fmtK(k.forecast)}</div>
        <div class="kpi-sub">weighted</div>
      </div>
      <div class="kpi kpi-cyan">
        <div class="kpi-label">Propuestas</div>
        <div class="kpi-value">${k.propuestasCount}</div>
        <div class="kpi-sub">${fmtK(k.propuestasTotal)}</div>
      </div>
      <div class="kpi kpi-mint">
        <div class="kpi-label">Educación</div>
        <div class="kpi-value">${k.educacionCount}</div>
        <div class="kpi-sub">${k.atraccionCount} en Atracción</div>
      </div>
      <div class="kpi kpi-yellow">
        <div class="kpi-label">Won Anual</div>
        <div class="kpi-value">${fmtK(k.wonAnual)}</div>
        <div class="kpi-sub">clientes cerrados</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Propuestas en vivo <span class="section-count">${propuestas.length}</span></div>
      <table class="tbl">
        <thead><tr><th>Deal</th><th>Owner</th><th>Close</th><th class="num">Monto</th></tr></thead>
        <tbody>
  `;
  propuestas.forEach(d => {
    html += `<tr>
      <td>${d.name}</td>
      <td>${d.owner || '—'}</td>
      <td>${d.closedate || '—'}</td>
      <td class="num">${fmt(d.amount)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>
    <div class="section">
      <div class="section-title">Top Educación <span class="section-count">${educacion.length}</span></div>
      <table class="tbl">
        <thead><tr><th>Deal</th><th>Owner</th><th>Close</th><th class="num">Monto</th></tr></thead>
        <tbody>
  `;
  educacion.forEach(d => {
    html += `<tr>
      <td>${d.name}</td>
      <td>${d.owner || '—'}</td>
      <td>${d.closedate || '—'}</td>
      <td class="num">${fmt(d.amount)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  $('#p-recap').innerHTML = html;
}

// --- OVERVIEW ---
function renderOverview() {
  const k = DATA.kpis;
  const deals = DATA.deals;
  const byProd = {};
  deals.forEach(d => {
    byProd[d.prod] = (byProd[d.prod] || 0) + (d.amount || 0);
  });
  const prods = Object.entries(byProd).sort((a, b) => b[1] - a[1]);
  const maxAmt = prods.length ? prods[0][1] : 1;

  let html = `
    <div class="kpi-grid">
      <div class="kpi kpi-purple"><div class="kpi-label">Pipeline</div><div class="kpi-value">${fmtK(k.pipeline)}</div></div>
      <div class="kpi kpi-pink"><div class="kpi-label">Forecast</div><div class="kpi-value">${fmtK(k.forecast)}</div></div>
      <div class="kpi kpi-cyan"><div class="kpi-label">Deals Totales</div><div class="kpi-value">${k.totalDeals}</div></div>
      <div class="kpi kpi-mint"><div class="kpi-label">Propuestas</div><div class="kpi-value">${k.propuestasCount}</div><div class="kpi-sub">${fmtK(k.propuestasTotal)}</div></div>
      <div class="kpi kpi-yellow"><div class="kpi-label">Educación</div><div class="kpi-value">${k.educacionCount}</div></div>
      <div class="kpi kpi-purple"><div class="kpi-label">Won Anual</div><div class="kpi-value">${fmtK(k.wonAnual)}</div></div>
    </div>
    <div class="section">
      <div class="section-title">Pipeline por Producto</div>
      <table class="tbl">
        <thead><tr><th>Producto</th><th style="width:60%">Distribución</th><th class="num">Monto</th></tr></thead>
        <tbody>
  `;
  prods.forEach(([prod, amt]) => {
    const pct = (amt / maxAmt * 100).toFixed(1);
    html += `<tr>
      <td><strong>${prod}</strong></td>
      <td><div style="background:var(--bg-3);border-radius:10px;height:18px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--purple),var(--pink));"></div></div></td>
      <td class="num">${fmtK(amt)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  $('#p-overview').innerHTML = html;
}

// --- PIPELINE ---
// Orden de stages para Kanban (columnas de izquierda a derecha)
const STAGE_ORDER = [
  { key: '1332596063', label: 'Contactado', id: '1332596063' },
  { key: '1332596064', label: 'En Conv.',   id: '1332596064' },
  { key: 'appointmentscheduled', label: 'Atracción', id: 'appointmentscheduled' },
  { key: 'qualifiedtobuy', label: 'Educación', id: 'qualifiedtobuy' },
  { key: 'presentationscheduled', label: 'Propuesta', id: 'presentationscheduled' },
  { key: 'decisionmakerboughtin', label: 'Aprobación', id: 'decisionmakerboughtin' }
];

function renderPipeline() {
  const prods = ['ALL', ...new Set(DATA.deals.map(d => d.prod).filter(Boolean))];
  const owners = ['ALL', ...new Set(DATA.deals.map(d => d.owner).filter(Boolean))];

  const filtered = DATA.deals.filter(d => {
    if (pipelineFilters.prod !== 'ALL' && d.prod !== pipelineFilters.prod) return false;
    if (pipelineFilters.owner !== 'ALL' && d.owner !== pipelineFilters.owner) return false;
    if (pipelineFilters.excludeP && d.name.startsWith('P_')) return false;
    // Excluir Closed Won y Perdida del Kanban de pipeline activo
    if (d.stage === 'closedwon' || d.stage === '1092009814') return false;
    return true;
  });

  const total = filtered.reduce((s, d) => s + (d.amount || 0), 0);

  // Agrupar por stage
  const byStage = {};
  STAGE_ORDER.forEach(s => byStage[s.key] = []);
  const otros = [];
  filtered.forEach(d => {
    const key = STAGE_ORDER.find(s => s.id === d.stage)?.key;
    if (key) byStage[key].push(d);
    else otros.push(d);
  });
  // Ordenar dentro de cada columna por monto descendente
  Object.values(byStage).forEach(arr => arr.sort((a, b) => (b.amount || 0) - (a.amount || 0)));
  otros.sort((a, b) => (b.amount || 0) - (a.amount || 0));

  let html = `
    <div class="section">
      <div class="filters">
        <span class="filter-label">Producto:</span>
        ${prods.map(p => `<button class="chip ${pipelineFilters.prod === p ? 'active' : ''}" data-pfilter="prod" data-pval="${p}">${p}</button>`).join('')}
      </div>
      <div class="filters">
        <span class="filter-label">Owner:</span>
        ${owners.map(o => `<button class="chip ${pipelineFilters.owner === o ? 'active' : ''}" data-pfilter="owner" data-pval="${o}">${o}</button>`).join('')}
        <button class="chip ${pipelineFilters.excludeP ? 'active' : ''}" data-pfilter="excludeP" data-pval="toggle">Excluir P_</button>
      </div>
      <div class="section-title">
        <span class="section-count">${filtered.length} deals activos</span>
        <span style="margin-left:auto;color:var(--text-dim);font-size:12px;">Total: <strong style="color:var(--text);">${fmtK(total)}</strong></span>
      </div>
      <div class="kanban">
  `;

  STAGE_ORDER.forEach(s => {
    const col = byStage[s.key];
    const colTotal = col.reduce((sum, d) => sum + (d.amount || 0), 0);
    html += `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">${s.label}</div>
          <div class="kanban-col-count">${col.length} · ${fmtK(colTotal)}</div>
        </div>
        <div class="kanban-col-body">
    `;
    if (col.length === 0) {
      html += `<div class="kanban-empty">—</div>`;
    } else {
      col.slice(0, 40).forEach(d => {
        const days = d.closedate ? daysUntil(d.closedate) : null;
        const dateClass = days !== null && days < 0 ? 'kanban-date-late' : '';
        html += `
          <div class="kanban-card">
            <div class="kanban-card-name">${d.name}</div>
            <div class="kanban-card-meta">
              <span class="kanban-card-amount">${fmtK(d.amount)}</span>
              <span class="kanban-card-owner">${d.owner || '—'}</span>
            </div>
            ${d.closedate ? `<div class="kanban-card-date ${dateClass}">${d.closedate}</div>` : ''}
          </div>
        `;
      });
      if (col.length > 40) {
        html += `<div class="kanban-empty">+ ${col.length - 40} más</div>`;
      }
    }
    html += `</div></div>`;
  });

  html += `</div>`;

  if (otros.length > 0) {
    html += `<div class="section-title" style="margin-top:20px;">Otros stages <span class="section-count">${otros.length}</span></div>
      <table class="tbl"><thead><tr><th>Deal</th><th>Stage</th><th>Owner</th><th>Close</th><th class="num">Monto</th></tr></thead><tbody>`;
    otros.slice(0, 20).forEach(d => {
      html += `<tr>
        <td>${d.name}</td>
        <td>${tagForStage(d.stage, d.stageLabel)}</td>
        <td>${d.owner || '—'}</td>
        <td>${d.closedate || '—'}</td>
        <td class="num">${fmt(d.amount)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  html += `</div>`;
  $('#p-pipeline').innerHTML = html;

  $$('[data-pfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.pfilter;
      const v = btn.dataset.pval;
      if (f === 'excludeP') pipelineFilters.excludeP = !pipelineFilters.excludeP;
      else pipelineFilters[f] = v;
      renderPipeline();
    });
  });
}

// --- WON ---
function renderWon() {
  const won = DATA.deals.filter(d => d.stage === 'closedwon');
  const total = won.reduce((s, d) => s + (d.amount || 0), 0);

  let html = `
    <div class="section">
      <div class="section-title">
        Clientes Won <span class="section-count">${won.length}</span>
        <span style="margin-left:auto;color:var(--text-dim);font-size:12px;">Total: <strong style="color:var(--text);">${fmtK(total)}</strong></span>
      </div>
      <table class="tbl">
        <thead><tr><th></th><th>Deal</th><th>Owner</th><th>Close</th><th class="num">Monto</th></tr></thead>
        <tbody>
  `;
  if (won.length === 0) {
    html += `<tr><td colspan="5" class="empty">No hay deals en Won en la vista actual</td></tr>`;
  }
  won.forEach(d => {
    const days = daysUntil(d.closedate);
    let urg = 'OK', cls = '';
    if (days !== null) {
      if (days <= 30) { urg = 'URG'; cls = 'urg-row'; }
      else if (days <= 60) { urg = 'ATN'; cls = 'atn-row'; }
    }
    html += `<tr class="${cls}">
      <td><strong>${urg}</strong></td>
      <td>${d.name}</td>
      <td>${d.owner || '—'}</td>
      <td>${d.closedate || '—'}</td>
      <td class="num">${fmt(d.amount)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  $('#p-won').innerHTML = html;
}

// --- CLIENTES ---
function renderClientes() {
  let html = `<div class="client-grid">`;
  Object.values(ACTIVE_CLIENTS).forEach(c => {
    const clientDeals = DATA.deals.filter(d =>
      d.name.toUpperCase().includes(c.name.toUpperCase())
    );
    const total = clientDeals.reduce((s, d) => s + (d.amount || 0), 0);
    html += `<div class="client-card">
      <div class="client-name">${c.name}</div>
      <div class="client-total">${fmtK(total)}</div>
      <div class="client-contact">${c.contact}${c.email ? ' · ' + c.email : ''}</div>
      <div class="client-contact" style="color:var(--yellow);">${c.note || ''}</div>
      <div class="client-deals">
        ${clientDeals.length === 0 ? '<div class="empty" style="padding:8px;font-size:11px;">Sin deals activos</div>' : ''}
        ${clientDeals.map(d => `
          <div class="client-deal">
            <span>${d.name}</span>
            <span>${fmt(d.amount)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  });
  html += `</div>`;
  $('#p-clientes').innerHTML = html;
}

// --- PENDIENTES ---
function renderPendientes() {
  if (!TASKS) {
    const isFile = window.location.protocol === 'file:';
    $('#p-pendientes').innerHTML = `
      <div class="section">
        <div class="section-title">Pendientes por Persona</div>
        <div class="empty">
          ${isFile
            ? 'El navegador bloquea cargar <code>tasks.json</code> cuando abres el archivo directamente.<br>Sube los archivos a GitHub Pages y ahí van a funcionar las 214 tareas.'
            : 'No se pudo cargar <code>tasks.json</code>.<br><small>Verificá que esté en la misma carpeta que <code>index.html</code>.</small>'}
        </div>
      </div>
    `;
    return;
  }

  const personas = Object.keys(TASKS.tareas);
  const current = pendientesFilters.persona;

  // Filter tasks based on current filters
  let filtered = [];
  if (current === 'Todos') {
    personas.forEach(p => {
      TASKS.tareas[p].forEach(t => filtered.push({ ...t, persona: p }));
    });
  } else {
    filtered = (TASKS.tareas[current] || []).map(t => ({ ...t, persona: current }));
  }

  if (pendientesFilters.urgency !== 'ALL') {
    filtered = filtered.filter(t => t.urgency === pendientesFilters.urgency);
  }
  if (pendientesFilters.scope === 'CLIENTE') {
    filtered = filtered.filter(t => !t.internal);
  } else if (pendientesFilters.scope === 'INTERNO') {
    filtered = filtered.filter(t => t.internal);
  }

  // Re-sort
  filtered.sort((a, b) => {
    const order = { vencida: 0, hoy: 1, proxima: 2, semana: 3, futuro: 4, sinfecha: 5 };
    const ua = order[a.urgency] ?? 6;
    const ub = order[b.urgency] ?? 6;
    if (ua !== ub) return ua - ub;
    return (a.date || '9999').localeCompare(b.date || '9999');
  });

  // Stats card
  const s = TASKS.stats;
  let html = `
    <div class="kpi-grid">
      <div class="kpi kpi-purple">
        <div class="kpi-label">Total Pendientes</div>
        <div class="kpi-value">${s.total}</div>
        <div class="kpi-sub">en HubSpot</div>
      </div>
      <div class="kpi kpi-pink" style="border-left-color: var(--red);">
        <div class="kpi-label">Vencidas</div>
        <div class="kpi-value" style="color:#FCA5A5;">${s.vencidas}</div>
        <div class="kpi-sub">requieren atención</div>
      </div>
      <div class="kpi kpi-yellow">
        <div class="kpi-label">Hoy</div>
        <div class="kpi-value">${s.hoy}</div>
        <div class="kpi-sub">cerrar hoy</div>
      </div>
      <div class="kpi kpi-cyan">
        <div class="kpi-label">Próximas (3d)</div>
        <div class="kpi-value">${s.proximas}</div>
        <div class="kpi-sub">planear</div>
      </div>
    </div>
  `;

  // Persona filter
  html += `<div class="section">
    <div class="filters">
      <span class="filter-label">Persona:</span>
      <button class="chip ${current === 'Todos' ? 'active' : ''}" data-pendfilter="persona" data-pval="Todos">Todos (${s.total})</button>
      ${personas.map(p => `
        <button class="chip ${current === p ? 'active' : ''}" data-pendfilter="persona" data-pval="${p}">${p} (${s.personas[p] || 0})</button>
      `).join('')}
    </div>
    <div class="filters">
      <span class="filter-label">Urgencia:</span>
      <button class="chip ${pendientesFilters.urgency === 'ALL' ? 'active' : ''}" data-pendfilter="urgency" data-pval="ALL">Todas</button>
      <button class="chip ${pendientesFilters.urgency === 'vencida' ? 'active' : ''}" data-pendfilter="urgency" data-pval="vencida" style="color:#FCA5A5;">🔴 Vencidas</button>
      <button class="chip ${pendientesFilters.urgency === 'hoy' ? 'active' : ''}" data-pendfilter="urgency" data-pval="hoy">🟡 Hoy</button>
      <button class="chip ${pendientesFilters.urgency === 'proxima' ? 'active' : ''}" data-pendfilter="urgency" data-pval="proxima">🟢 Próximas</button>
    </div>
    <div class="filters">
      <span class="filter-label">Scope:</span>
      <button class="chip ${pendientesFilters.scope === 'ALL' ? 'active' : ''}" data-pendfilter="scope" data-pval="ALL">Todo</button>
      <button class="chip ${pendientesFilters.scope === 'CLIENTE' ? 'active' : ''}" data-pendfilter="scope" data-pval="CLIENTE">Solo Cliente</button>
      <button class="chip ${pendientesFilters.scope === 'INTERNO' ? 'active' : ''}" data-pendfilter="scope" data-pval="INTERNO">Solo GR Interno</button>
    </div>
    <div class="section-title">
      <span class="section-count">${filtered.length} tareas</span>
      <span style="margin-left:auto;color:var(--text-dim);font-size:12px;">Ordenadas por urgencia</span>
    </div>
    <table class="tbl">
      <thead><tr>
        <th style="width:30px;"></th>
        <th>Tarea</th>
        <th>Cliente</th>
        ${current === 'Todos' ? '<th>Persona</th>' : ''}
        <th>Tipo</th>
        <th>Fecha</th>
      </tr></thead>
      <tbody>
  `;

  if (filtered.length === 0) {
    html += `<tr><td colspan="${current === 'Todos' ? 6 : 5}" class="empty">Sin tareas con estos filtros 🎉</td></tr>`;
  }

  filtered.slice(0, 150).forEach(t => {
    const urgColor = {
      vencida: '🔴',
      hoy: '🟡',
      proxima: '🟢',
      semana: '⚪',
      futuro: '⚪',
      sinfecha: '⚫'
    }[t.urgency] || '⚫';
    const rowClass = t.urgency === 'vencida' ? 'urg-row' : (t.urgency === 'hoy' ? 'atn-row' : '');
    const prioTag = t.priority === 'HIGH' ? '<span class="tag tag-propuesta">HIGH</span>' :
                    t.priority === 'LOW' ? '<span class="tag tag-perdida">LOW</span>' : '';
    const scopeTag = t.internal ? '<span class="tag tag-atraccion" style="margin-left:4px;">GR</span>' : '';
    html += `<tr class="${rowClass}">
      <td>${urgColor}</td>
      <td>${t.title} ${prioTag} ${scopeTag}</td>
      <td><small>${t.client || '—'}</small></td>
      ${current === 'Todos' ? `<td><strong>${t.persona}</strong></td>` : ''}
      <td><small>${t.type || '—'}</small></td>
      <td><small>${t.date || '—'}</small></td>
    </tr>`;
  });

  html += `</tbody></table>`;
  if (filtered.length > 150) {
    html += `<div class="empty" style="padding:12px;font-size:11px;">Mostrando 150 de ${filtered.length} · Filtrá para ver más</div>`;
  }
  html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--text-mute);">
    Fuente: ${TASKS.fuente || 'HubSpot'} · Actualizado: ${new Date(TASKS.generadoEn).toLocaleDateString('es-MX')}
  </div>`;
  html += `</div>`;

  $('#p-pendientes').innerHTML = html;

  $$('[data-pendfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.pendfilter;
      pendientesFilters[f] = btn.dataset.pval;
      renderPendientes();
    });
  });
}

// --- ALERTAS ---
// Genera alertas dinámicamente desde DATA.deals + TASKS
function buildAlerts() {
  const alerts = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // --- 1. Renovaciones próximas: tareas con "Renovación" o "VENCE" en el título ---
  const renovaciones = [];
  if (TASKS && TASKS.tareas) {
    for (const [persona, tareas] of Object.entries(TASKS.tareas)) {
      tareas.forEach(t => {
        if (/(VENCE|Renovación|URGENTE.*ren)/i.test(t.title)) {
          const days = daysUntil(t.date);
          if (days !== null && days <= 90 && days >= -30) {
            renovaciones.push({ ...t, persona, days });
          }
        }
      });
    }
  }
  // Dedup por cliente+date (evita la misma renovación aparezca 3 veces)
  const renSeen = new Set();
  const renUnicas = [];
  renovaciones.sort((a, b) => a.days - b.days).forEach(r => {
    const key = r.client + '|' + r.date;
    if (!renSeen.has(key)) { renSeen.add(key); renUnicas.push(r); }
  });

  renUnicas.slice(0, 6).forEach(r => {
    const level = r.days < 0 ? 'crit' : (r.days <= 30 ? 'crit' : 'imp');
    const diasTxt = r.days < 0 ? `VENCIDA hace ${Math.abs(r.days)} días` :
                     r.days === 0 ? 'VENCE HOY' :
                     `${r.days} días para vencimiento`;
    alerts.push({
      level,
      title: `Renovación — ${r.client}`,
      meta: `${diasTxt} · ${r.persona}`,
      body: r.title
    });
  });

  // --- 2. Propuestas sin movimiento (stage = Propuesta Enviada, closedate < hoy) ---
  const propuestasVencidas = DATA.deals.filter(d =>
    d.stage === 'presentationscheduled' &&
    d.closedate &&
    daysUntil(d.closedate) < 0
  ).sort((a, b) => (b.amount || 0) - (a.amount || 0));

  propuestasVencidas.slice(0, 5).forEach(d => {
    const dias = Math.abs(daysUntil(d.closedate));
    alerts.push({
      level: 'imp',
      title: `${d.name} — Propuesta sin respuesta`,
      meta: `Close date vencido hace ${dias} días · ${fmtK(d.amount)}`,
      body: `Propuesta enviada a ${d.owner || 'cliente'}. Close date era ${d.closedate}. Hacer seguimiento urgente.`
    });
  });

  // --- 3. Deals altos con close date pasada (cualquier stage activo) ---
  const dealsVencidos = DATA.deals.filter(d => {
    if (d.stage === 'closedwon' || d.stage === '1092009814') return false;
    if (d.stage === 'presentationscheduled') return false; // ya contados arriba
    if (!d.closedate) return false;
    if ((d.amount || 0) < 20000) return false;
    return daysUntil(d.closedate) < 0;
  }).sort((a, b) => (b.amount || 0) - (a.amount || 0));

  dealsVencidos.slice(0, 4).forEach(d => {
    const dias = Math.abs(daysUntil(d.closedate));
    alerts.push({
      level: 'imp',
      title: `${d.name} — Deal con fecha vencida`,
      meta: `${d.stageLabel || d.stage} · Close ${d.closedate} (hace ${dias} días) · ${fmtK(d.amount)}`,
      body: `Deal de ${fmtK(d.amount)} en ${d.stageLabel || d.stage}. Close date pasada. Revisar con ${d.owner || 'owner'} si sigue activo.`
    });
  });

  // --- 4. Tareas HIGH vencidas (top 5 más viejas) ---
  if (TASKS && TASKS.tareas) {
    const tareasVencidasHigh = [];
    for (const [persona, tareas] of Object.entries(TASKS.tareas)) {
      tareas.forEach(t => {
        if (t.urgency === 'vencida' && t.priority === 'HIGH') {
          tareasVencidasHigh.push({ ...t, persona });
        }
      });
    }
    tareasVencidasHigh.sort((a, b) => a.date.localeCompare(b.date));

    // Agrupar por persona para evitar saturar
    const porPersona = {};
    tareasVencidasHigh.forEach(t => {
      porPersona[t.persona] = (porPersona[t.persona] || 0) + 1;
    });

    // Una alerta resumen por persona con >= 5 HIGH vencidas
    Object.entries(porPersona)
      .filter(([, n]) => n >= 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .forEach(([persona, n]) => {
        alerts.push({
          level: 'op',
          title: `${persona} — ${n} tareas HIGH vencidas`,
          meta: `Revisar en tab Pendientes filtrando por ${persona}`,
          body: `${persona} tiene ${n} tareas marcadas HIGH con fecha pasada. Depurar: cerrar las completadas, repriorizar el resto.`
        });
      });
  }

  // --- 5. Deals grandes (>=$40K) sin actividad o sin owner ---
  const grandesSinOwner = DATA.deals.filter(d =>
    (d.amount || 0) >= 40000 &&
    d.stage !== 'closedwon' &&
    d.stage !== '1092009814' &&
    !d.owner
  );
  if (grandesSinOwner.length > 0) {
    alerts.push({
      level: 'op',
      title: `${grandesSinOwner.length} deal(s) grandes sin owner`,
      meta: `${fmtK(grandesSinOwner.reduce((s, d) => s + (d.amount || 0), 0))} en juego · asignar HOY`,
      body: grandesSinOwner.slice(0, 5).map(d => `· ${d.name} (${fmtK(d.amount)})`).join('<br>')
    });
  }

  return alerts;
}

function renderAlertas() {
  const alertList = buildAlerts();
  const grouped = {
    crit: alertList.filter(a => a.level === 'crit'),
    imp: alertList.filter(a => a.level === 'imp'),
    op: alertList.filter(a => a.level === 'op')
  };

  // Actualizar badge en la tab
  const badge = $('#alerts-count');
  if (badge) badge.textContent = alertList.length;

  let html = '';
  const groups = [
    ['crit', 'CRÍTICAS', 'crit'],
    ['imp', 'IMPORTANTES', 'imp'],
    ['op', 'OPERATIVAS', 'op']
  ];
  groups.forEach(([key, label]) => {
    if (grouped[key].length === 0) return;
    html += `<div class="section">
      <div class="section-title">${label} <span class="section-count">${grouped[key].length}</span></div>`;
    grouped[key].forEach((a, i) => {
      html += `<div class="alert alert-${a.level}" data-alert="${key}-${i}">
        <div class="alert-header">
          <div class="alert-title">${a.title}</div>
          <div class="alert-badge alert-badge-${a.level}">${a.level.toUpperCase()}</div>
        </div>
        <div class="alert-meta">${a.meta}</div>
        <div class="alert-body">${a.body}</div>
      </div>`;
    });
    html += `</div>`;
  });

  if (alertList.length === 0) {
    html = `<div class="section"><div class="empty">Sin alertas activas. Todo bajo control.</div></div>`;
  }

  $('#p-alertas').innerHTML = html;

  $$('[data-alert]').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('open'));
  });
}

// --- AMPLEMARKET ---
function renderAmplemarket() {
  const pDeals = DATA.deals.filter(d => d.name.startsWith('P_') || d.owner === 'Martha');
  const pTotal = pDeals.reduce((s, d) => s + (d.amount || 0), 0);

  const sequences = [
    { name: 'LT COBOL', replyRate: 61.6, meetings: 0 },
    { name: 'LT JAVA', replyRate: 49.6, meetings: 0 },
    { name: 'AEO Banking', replyRate: 62.2, meetings: 0 },
    { name: 'ITS Atlassian', replyRate: 58.0, meetings: 1 },
    { name: 'ITS AdviceGroup', replyRate: 100.0, meetings: 1 }
  ];

  let html = `
    <div class="kpi-grid">
      <div class="kpi kpi-purple"><div class="kpi-label">Deals AM/Martha</div><div class="kpi-value">${pDeals.length}</div></div>
      <div class="kpi kpi-pink"><div class="kpi-label">Pipeline AM</div><div class="kpi-value">${fmtK(pTotal)}</div></div>
      <div class="kpi kpi-cyan"><div class="kpi-label">Secuencias activas</div><div class="kpi-value">${sequences.length}</div></div>
      <div class="kpi kpi-mint"><div class="kpi-label">Meetings generados</div><div class="kpi-value">${sequences.reduce((s, x) => s + x.meetings, 0)}</div></div>
    </div>
    <div class="section">
      <div class="section-title">Secuencias Amplemarket</div>
      <table class="tbl">
        <thead><tr><th>Secuencia</th><th class="num">Reply Rate</th><th class="num">Meetings</th></tr></thead>
        <tbody>
  `;
  sequences.forEach(s => {
    html += `<tr>
      <td>${s.name}</td>
      <td class="num">${s.replyRate.toFixed(1)}%</td>
      <td class="num">${s.meetings}</td>
    </tr>`;
  });
  html += `</tbody></table></div>
    <div class="section">
      <div class="section-title">Pipeline AM <span class="section-count">${pDeals.length}</span></div>
      <table class="tbl">
        <thead><tr><th>Deal</th><th>Stage</th><th>Close</th><th class="num">Monto</th></tr></thead>
        <tbody>
  `;
  pDeals.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 50).forEach(d => {
    html += `<tr>
      <td>${d.name}</td>
      <td>${tagForStage(d.stage, d.stageLabel)}</td>
      <td>${d.closedate || '—'}</td>
      <td class="num">${fmt(d.amount)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  $('#p-amplemarket').innerHTML = html;
}

// --- FORECAST ---
function renderForecast() {
  const deals = DATA.deals;
  const propuestas = deals.filter(d => d.stage === 'presentationscheduled');
  const educacion = deals.filter(d => d.stage === 'qualifiedtobuy');
  const atraccion = deals.filter(d => d.stage === 'appointmentscheduled');

  const propTotal = propuestas.reduce((s, d) => s + (d.amount || 0), 0);
  const educTotal = educacion.reduce((s, d) => s + (d.amount || 0), 0);
  const atrTotal = atraccion.reduce((s, d) => s + (d.amount || 0), 0);

  const conservador = propTotal * 0.35;
  const base = conservador + educTotal * 0.20;
  const optimista = base + atrTotal * 0.10;

  // Closes próximos 30 días
  const close30 = deals.filter(d => {
    const days = daysUntil(d.closedate);
    return days !== null && days >= 0 && days <= 30;
  }).sort((a, b) => new Date(a.closedate) - new Date(b.closedate));

  let html = `
    <div class="kpi-grid">
      <div class="kpi kpi-mint">
        <div class="kpi-label">Conservador</div>
        <div class="kpi-value">${fmtK(conservador)}</div>
        <div class="kpi-sub">Propuestas × 35%</div>
      </div>
      <div class="kpi kpi-cyan">
        <div class="kpi-label">Base</div>
        <div class="kpi-value">${fmtK(base)}</div>
        <div class="kpi-sub">+ Educación × 20%</div>
      </div>
      <div class="kpi kpi-purple">
        <div class="kpi-label">Optimista</div>
        <div class="kpi-value">${fmtK(optimista)}</div>
        <div class="kpi-sub">+ Atracción × 10%</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Closes próximos 30 días <span class="section-count">${close30.length}</span></div>
      <table class="tbl">
        <thead><tr><th>Deal</th><th>Stage</th><th>Close</th><th>Días</th><th class="num">Monto</th></tr></thead>
        <tbody>
  `;
  if (close30.length === 0) {
    html += `<tr><td colspan="5" class="empty">Sin closes en los próximos 30 días</td></tr>`;
  }
  close30.forEach(d => {
    const days = daysUntil(d.closedate);
    const cls = days <= 7 ? 'urg-row' : (days <= 15 ? 'atn-row' : '');
    html += `<tr class="${cls}">
      <td>${d.name}</td>
      <td>${tagForStage(d.stage, d.stageLabel)}</td>
      <td>${d.closedate}</td>
      <td>${days}d</td>
      <td class="num">${fmt(d.amount)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  $('#p-forecast').innerHTML = html;
}

// --- INIT ---
function init() {
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  $('#btn-refresh').addEventListener('click', loadData);
  loadData();
  // Auto-refresh cada 5 minutos
  setInterval(loadData, 5 * 60 * 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
