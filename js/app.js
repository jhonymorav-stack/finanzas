// ── App ──────────────────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const GOAL_TYPE_LABEL = { ahorro: 'Ahorro', reduccion: 'Reducción de gasto', inversion: 'Inversión' };
const GOAL_TYPE_ICON = { ahorro: '🐷', reduccion: '📉', inversion: '📈' };

const App = (() => {
  const state = {
    session: null,
    transactions: [],
    goals: [],
    customCategories: [],
    customAccounts: [],
    budgets: {}, // { categoryId: monthlyAmount }
    currentMonth: startOfMonth(new Date()),
    activeTab: 'resumen',
    rate: null,
    // sheet/form state — transacción
    editingId: null,
    formType: 'egreso',
    formAmount: '',
    formDate: todayISO(),
    formCategory: 'comida',
    formAccount: 'efectivo',
    formNote: '',
    formReceiptFile: null,       // dataURL de una foto nueva sin subir aún
    formReceiptPath: null,       // path/dataURL ya guardado (transacción existente)
    formReceiptPreview: null,    // URL a mostrar en el <img> (resuelta)
    formReceiptRemoved: false,
    // sheet/form state — meta
    editingGoalId: null,
    goalType: 'ahorro',
    goalTitle: '',
    goalAmount: '',
    goalCategory: '',
    goalDate: '',
    // sheet — gestionar categorías/cuentas
    listSheetKind: 'categories'
  };

  // ── Date helpers ─────────────────────────────────────────────────────────
  function todayISO() { return toISO(new Date()); }
  function toISO(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
  function addDaysISO(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return toISO(dt);
  }

  // ── Formatting ───────────────────────────────────────────────────────────
  function formatCOP(n) { return 'COP ' + Math.round(Math.abs(n)).toLocaleString('es-CO'); }
  function formatUSD(n) { return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD'; }
  function formatCOPShort(n) {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e3) return Math.round(n / 1e3) + 'k';
    return String(Math.round(n));
  }
  function usdFor(cop) {
    if (!state.rate) return null;
    return Rates.copToUsd(cop, state.rate);
  }

  function dayGroupLabel(iso) {
    const t = todayISO();
    const y = addDaysISO(t, -1);
    if (iso === t) return 'HOY · ' + formatDateCaps(iso);
    if (iso === y) return 'AYER · ' + formatDateCaps(iso);
    return formatDateCaps(iso);
  }
  function formatDateCaps(iso) {
    const [, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES[m - 1].toUpperCase()}`;
  }
  function formatDateHuman(iso) {
    const t = todayISO();
    if (iso === t) return 'Hoy';
    if (iso === addDaysISO(t, -1)) return 'Ayer';
    if (iso === addDaysISO(t, 1)) return 'Mañana';
    const [, m, d] = iso.split('-').map(Number);
    return `${d} de ${MESES[m - 1]}`;
  }
  function formatDateShort(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES_CORTO[m - 1]} ${y}`;
  }

  function allCategories() { return [...window.CATEGORIES, ...state.customCategories]; }
  function allAccounts() { return [...window.ACCOUNTS, ...state.customAccounts]; }
  function categoryById(id) { return allCategories().find((c) => c.id === id) || window.CATEGORIES[window.CATEGORIES.length - 1]; }
  function accountById(id) { return allAccounts().find((a) => a.id === id) || window.ACCOUNTS[0]; }
  function goalCategoryLabel(id) { return id ? categoryById(id).label : 'Todas las categorías'; }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ── Íconos (SVG para categorías built-in, emoji para cuentas, letra para
  //    todo lo personalizado que no trae ícono) ─────────────────────────────
  function letterAvatarHTML(label, size) {
    const s = size || 20;
    return `<span class="letter-avatar" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.55)}px">${(label || '?').charAt(0).toUpperCase()}</span>`;
  }
  function categoryIconHTML(cat, size) {
    if (cat.icon) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:${size || 20}px;height:${size || 20}px">${cat.icon}</svg>`;
    return letterAvatarHTML(cat.label, size);
  }
  function accountIconHTML(acc, size) {
    if (acc.icon) return `<span class="pill-emoji" style="font-size:${size || 20}px">${acc.icon}</span>`;
    return letterAvatarHTML(acc.label, size);
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function loadAll() {
    return Promise.all([loadTransactions(), loadGoals(), loadCategories(), loadAccounts(), loadBudgets()]);
  }

  async function init() {
    bindConfirmDialogButtons();
    bindPromptDialogButtons();
    Rates.refresh().then((r) => { state.rate = r; renderAll(); });

    if (DB.isConfigured) {
      DB.onAuthChange(async (session) => {
        state.session = session;
        if (session) { await loadAll(); renderAll(); }
        render();
      });
      state.session = await DB.getSession();
      if (state.session) await loadAll();
    } else {
      state.session = await DB.getSession();
      await loadAll();
    }
    render();
  }

  async function loadTransactions() {
    try { state.transactions = await DB.listTransactions(); }
    catch (e) { console.error(e); toast('No se pudieron cargar las transacciones'); }
  }

  async function loadGoals() {
    try { state.goals = await DB.listGoals(); }
    catch (e) { console.error(e); toast('No se pudieron cargar las metas'); }
  }

  async function loadCategories() {
    try { state.customCategories = await DB.listCategories(); }
    catch (e) { console.error(e); }
  }

  async function loadAccounts() {
    try { state.customAccounts = await DB.listAccounts(); }
    catch (e) { console.error(e); }
  }

  async function loadBudgets() {
    try {
      const rows = await DB.listBudgets();
      const map = {};
      rows.forEach((b) => { map[b.category] = Number(b.monthly_amount); });
      state.budgets = map;
    } catch (e) { console.error(e); }
  }

  // ── Render dispatcher ────────────────────────────────────────────────────
  function render() {
    document.getElementById('auth-screen').classList.toggle('hidden', !!state.session);
    document.getElementById('app-shell').classList.toggle('hidden', !state.session);
    if (state.session) renderAll();
  }

  function renderAll() {
    renderMonthBar();
    renderBalanceCard();
    renderTxList();
    renderMetrics();
    renderGoals();
  }

  function renderMonthBar() {
    document.getElementById('month-title').textContent =
      `${MESES[state.currentMonth.getMonth()]} ${state.currentMonth.getFullYear()}`;
  }

  function txInMonth(monthDate) {
    const d = monthDate || state.currentMonth;
    const y = d.getFullYear(), m = d.getMonth();
    return state.transactions.filter((t) => {
      const [ty, tm] = t.tx_date.split('-').map(Number);
      return ty === y && tm === m + 1;
    });
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  function switchTab(tab) {
    state.activeTab = tab;
    document.getElementById('panel-resumen').classList.toggle('hidden', tab !== 'resumen');
    document.getElementById('panel-metricas').classList.toggle('hidden', tab !== 'metricas');
    document.getElementById('panel-metas').classList.toggle('hidden', tab !== 'metas');
    document.getElementById('panel-ajustes').classList.toggle('hidden', tab !== 'ajustes');
    document.querySelectorAll('.tab-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('fab-btn').classList.toggle('hidden', tab === 'metricas' || tab === 'ajustes');
    if (tab === 'ajustes') renderAjustes();
  }

  function renderAjustes() {
    const el = document.getElementById('ajustes-mode');
    if (el) el.textContent = DB.mode === 'supabase' ? 'Sincronizado con Supabase' : 'Local (solo este dispositivo)';
  }

  function handleFabClick() {
    if (state.activeTab === 'metas') openGoalSheet();
    else openSheet();
  }

  // ── Resumen: balance + lista ─────────────────────────────────────────────
  function renderBalanceCard() {
    const list = txInMonth();
    const income = list.filter((t) => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0);
    const expense = list.filter((t) => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0);
    const net = income - expense;

    const prev = addMonths(state.currentMonth, -1);
    const prevList = txInMonth(prev);
    const prevNet = prevList.filter((t) => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)
                  - prevList.filter((t) => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0);
    const delta = net - prevNet;
    const prevMonthName = MESES[prev.getMonth()].toLowerCase();

    const netUsd = usdFor(net);
    const amountEl = document.getElementById('balance-amount');
    amountEl.textContent = (net >= 0 ? '+' : '−') + formatCOP(net);
    amountEl.className = 'balance-amount ' + (net >= 0 ? 'positive' : 'negative');

    document.getElementById('balance-usd').textContent = netUsd !== null ? '≈ ' + formatUSD(netUsd) : '';
    document.getElementById('balance-usd').classList.toggle('hidden', netUsd === null);

    const deltaEl = document.getElementById('balance-delta');
    if (list.length === 0 && prevList.length === 0) {
      deltaEl.innerHTML = `<span class="delta-muted">Sin movimientos el mes pasado</span>`;
      deltaEl.className = 'balance-delta';
    } else {
      deltaEl.className = 'balance-delta ' + (delta >= 0 ? 'positive' : 'negative');
      deltaEl.innerHTML = `${delta >= 0 ? '↑' : '↓'} ${delta >= 0 ? '+' : '−'}${formatCOP(delta)} <span class="delta-muted">vs. ${prevMonthName} ${prev.getFullYear()}</span>`;
    }

    document.getElementById('income-amount').textContent = '+' + formatCOP(income);
    document.getElementById('expense-amount').textContent = '−' + formatCOP(expense);

    const ratesNote = document.getElementById('rates-note');
    ratesNote.textContent = state.rate ? `Tasas actualizadas ${Rates.hoursAgoLabel(state.rate.fetchedAt)}` : 'Tasas no disponibles (sin conexión)';
  }

  function renderTxList() {
    const list = txInMonth().sort((a, b) => b.tx_date.localeCompare(a.tx_date) || (b.created_at || '').localeCompare(a.created_at || ''));
    const container = document.getElementById('tx-list');
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Sin transacciones este mes.<br>Toca “+” para agregar la primera.</p></div>`;
      return;
    }

    const groups = {};
    list.forEach((t) => { (groups[t.tx_date] = groups[t.tx_date] || []).push(t); });

    Object.keys(groups).sort().reverse().forEach((iso) => {
      const group = document.createElement('div');
      group.className = 'day-group';
      const header = document.createElement('div');
      header.className = 'day-header';
      header.textContent = dayGroupLabel(iso);
      group.appendChild(header);

      groups[iso].forEach((t) => {
        const cat = categoryById(t.category);
        const usd = usdFor(Number(t.amount));
        const card = document.createElement('button');
        card.className = 'tx-card';
        card.innerHTML = `
          <div class="tx-icon">${categoryIconHTML(cat, 20)}</div>
          <div class="tx-info">
            <div class="tx-category">${cat.label}${t.receipt_path ? ' <span class="tx-receipt-flag">📎</span>' : ''}</div>
            ${t.note ? `<div class="tx-note">${escapeHtml(t.note)}</div>` : ''}
          </div>
          <div class="tx-right">
            <div class="tx-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">${t.type === 'ingreso' ? '+' : '−'}${formatCOP(t.amount)}</div>
            ${usd !== null ? `<div class="tx-usd">≈ ${formatUSD(usd)}</div>` : ''}
          </div>`;
        card.addEventListener('click', () => openEditSheet(t));
        group.appendChild(card);
      });

      container.appendChild(group);
    });
  }

  // ── Métricas: por categoría + por mes ────────────────────────────────────
  function renderMetrics() {
    const container = document.getElementById('metrics-content');
    if (!container) return;

    const list = txInMonth().filter((t) => t.type === 'egreso');
    const byCat = {};
    list.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount); });
    const totalExpense = Object.values(byCat).reduce((a, b) => a + b, 0);
    // Categorías con gasto este mes + categorías con presupuesto definido (aunque
    // todavía no tengan gasto), para que el presupuesto siempre sea visible.
    const catIds = Array.from(new Set([...Object.keys(byCat), ...Object.keys(state.budgets)]));
    const rows = catIds.map((id) => [id, byCat[id] || 0]).sort((a, b) => b[1] - a[1]);
    const maxCat = rows.length ? Math.max(...rows.map((r) => r[1]), 1) : 0;

    const monthsBack = 6;
    const months = [];
    for (let i = monthsBack - 1; i >= 0; i--) months.push(addMonths(state.currentMonth, -i));
    const monthTotals = months.map((m) => {
      const total = txInMonth(m).filter((t) => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0);
      const isCurrent = m.getFullYear() === state.currentMonth.getFullYear() && m.getMonth() === state.currentMonth.getMonth();
      return { m, total, isCurrent };
    });
    const maxMonth = Math.max(...monthTotals.map((x) => x.total), 1);

    container.innerHTML = `
      <div class="metrics-section-header">
        <div class="metrics-title">Gastos por categoría</div>
        <div class="metrics-subtitle">${MESES[state.currentMonth.getMonth()]} ${state.currentMonth.getFullYear()} · ${formatCOP(totalExpense)}</div>
      </div>
      <div class="metrics-cat-list">
        ${rows.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📊</div><p>Sin egresos este mes todavía.</p></div>`
          : rows.map(([catId, amount]) => {
              const cat = categoryById(catId);
              const pct = totalExpense ? Math.round((amount / totalExpense) * 100) : 0;
              const barPct = maxCat ? Math.round((amount / maxCat) * 100) : 0;
              const budget = state.budgets[catId];
              let barClass = '';
              let statusHTML = `<button class="metric-budget-link" onclick="App.editCategoryBudget('${catId}')">+ Definir presupuesto</button>`;
              if (budget) {
                const budgetPct = Math.round((amount / budget) * 100);
                barClass = budgetPct >= 100 ? 'over' : budgetPct >= 70 ? 'warn' : 'safe';
                const statusText = budgetPct >= 100
                  ? `Te pasaste por ${formatCOP(amount - budget)} del presupuesto`
                  : `${formatCOP(budget - amount)} disponibles de tu presupuesto`;
                statusHTML = `<button class="metric-budget-status ${barClass}" onclick="App.editCategoryBudget('${catId}')">${statusText} · ${formatCOP(budget)}/mes</button>`;
              }
              return `
                <div class="metric-row">
                  <div class="metric-row-top">
                    <div class="metric-cat">
                      <span class="metric-icon">${categoryIconHTML(cat, 16)}</span>
                      ${cat.label}
                    </div>
                    <div class="metric-amount">${formatCOP(amount)} <span class="metric-pct">${pct}%</span></div>
                  </div>
                  <div class="metric-bar-track"><div class="metric-bar-fill ${barClass}" style="width:${budget ? Math.min(100, Math.round((amount / budget) * 100)) : barPct}%"></div></div>
                  ${statusHTML}
                </div>`;
            }).join('')
        }
      </div>

      <div class="metrics-section-header" style="margin-top:30px;">
        <div class="metrics-title">Egresos por mes</div>
        <div class="metrics-subtitle">Últimos ${monthsBack} meses</div>
      </div>
      <div class="metrics-months">
        ${monthTotals.map(({ m, total, isCurrent }) => {
          const h = total ? Math.max(6, Math.round((total / maxMonth) * 110)) : 3;
          return `
            <button class="month-col ${isCurrent ? 'current' : ''}" onclick="App.jumpToMonth(${m.getFullYear()}, ${m.getMonth()})">
              <div class="month-col-value">${total ? formatCOPShort(total) : ''}</div>
              <div class="month-col-bar" style="height:${h}px"></div>
              <div class="month-col-label">${MESES_CORTO[m.getMonth()]}</div>
            </button>`;
        }).join('')}
      </div>
    `;
  }

  function jumpToMonth(year, month) {
    state.currentMonth = new Date(year, month, 1);
    renderAll();
    switchTab('resumen');
  }

  async function editCategoryBudget(catId) {
    const cat = categoryById(catId);
    const current = state.budgets[catId] || 0;
    const amount = await promptValue(`Presupuesto mensual para "${cat.label}" (déjalo en 0 para quitarlo)`, {
      okLabel: 'Guardar', type: 'number', defaultValue: current
    });
    if (amount === null) return;
    try {
      if (amount <= 0) await DB.deleteBudget(catId);
      else await DB.setBudget(catId, amount);
      await loadBudgets();
      renderMetrics();
      toast(amount > 0 ? 'Presupuesto actualizado' : 'Presupuesto eliminado');
    } catch (e) { console.error(e); toast('No se pudo guardar el presupuesto'); }
  }

  // ── Metas ────────────────────────────────────────────────────────────────
  function renderGoals() {
    const container = document.getElementById('goals-content');
    if (!container) return;

    if (state.goals.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>Aún no tienes metas.<br>Toca “+” para crear tu primera meta de ahorro,<br>reducción de gasto o inversión.</p></div>`;
      return;
    }

    container.innerHTML = state.goals.map((g) => goalCardHtml(g)).join('');
  }

  function goalCardHtml(g) {
    const icon = GOAL_TYPE_ICON[g.type] || '🎯';
    const target = Number(g.target_amount);

    if (g.type === 'reduccion') {
      const spent = txInMonth().filter((t) => t.type === 'egreso' && (!g.category || t.category === g.category))
        .reduce((s, t) => s + Number(t.amount), 0);
      const pct = target ? Math.round((spent / target) * 100) : 0;
      const over = spent > target;
      const statusText = over
        ? `Te pasaste por ${formatCOP(spent - target)}`
        : `Te quedan ${formatCOP(target - spent)} este mes`;
      return `
        <div class="goal-card">
          <div class="goal-card-top" onclick="App.openEditGoalSheet('${g.id}')">
            <div class="goal-icon ${g.type}">${icon}</div>
            <div class="goal-info">
              <div class="goal-title">${escapeHtml(g.title)}</div>
              <div class="goal-sub">${goalCategoryLabel(g.category)} · por mes</div>
            </div>
            <div class="goal-pct ${over ? 'over' : ''}">${pct}%</div>
          </div>
          <div class="goal-bar-track"><div class="goal-bar-fill ${over ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>
          <div class="goal-bottom">
            <span class="goal-amounts">${formatCOP(spent)} de ${formatCOP(target)}</span>
          </div>
          <div class="goal-status ${over ? 'over' : 'ok'}">${statusText}</div>
        </div>`;
    }

    const current = Number(g.current_amount) || 0;
    const pct = target ? Math.round((current / target) * 100) : 0;
    const sub = g.target_date ? `Meta para el ${formatDateShort(g.target_date)}` : GOAL_TYPE_LABEL[g.type];
    return `
      <div class="goal-card">
        <div class="goal-card-top" onclick="App.openEditGoalSheet('${g.id}')">
          <div class="goal-icon ${g.type}">${icon}</div>
          <div class="goal-info">
            <div class="goal-title">${escapeHtml(g.title)}</div>
            <div class="goal-sub">${sub}</div>
          </div>
          <div class="goal-pct">${pct}%</div>
        </div>
        <div class="goal-bar-track"><div class="goal-bar-fill ${g.type}" style="width:${Math.min(pct, 100)}%"></div></div>
        <div class="goal-bottom">
          <span class="goal-amounts">${formatCOP(current)} de ${formatCOP(target)}</span>
          <button class="goal-add-btn" onclick="event.stopPropagation(); App.addContribution('${g.id}')">+ Agregar</button>
        </div>
      </div>`;
  }

  async function addContribution(goalId) {
    const g = state.goals.find((x) => x.id === goalId);
    if (!g) return;
    const amount = await promptAmount(`¿Cuánto quieres agregar a "${g.title}"?`, 'Agregar');
    if (!amount) return;
    try {
      await DB.updateGoal(goalId, { current_amount: (Number(g.current_amount) || 0) + amount });
      await loadGoals();
      renderGoals();
      toast(`+${formatCOP(amount)} agregado a "${g.title}"`);
    } catch (e) { console.error(e); toast('No se pudo actualizar la meta'); }
  }

  function openGoalSheet() {
    state.editingGoalId = null;
    state.goalType = 'ahorro';
    state.goalTitle = '';
    state.goalAmount = '';
    state.goalCategory = '';
    state.goalDate = '';
    document.getElementById('goal-sheet-title').textContent = 'Nueva meta';
    document.getElementById('goal-delete-btn').classList.add('hidden');
    document.getElementById('goal-save-btn').textContent = 'Guardar meta';
    document.getElementById('goal-title-input').value = '';
    document.getElementById('goal-date-input').value = '';
    document.getElementById('goal-sheet-overlay').classList.remove('hidden');
    renderGoalSheet();
  }

  function openEditGoalSheet(id) {
    const g = state.goals.find((x) => x.id === id);
    if (!g) return;
    state.editingGoalId = g.id;
    state.goalType = g.type;
    state.goalTitle = g.title;
    state.goalAmount = String(Math.round(Number(g.target_amount)));
    state.goalCategory = g.category || '';
    state.goalDate = g.target_date || '';
    document.getElementById('goal-sheet-title').textContent = 'Editar meta';
    document.getElementById('goal-delete-btn').classList.remove('hidden');
    document.getElementById('goal-save-btn').textContent = 'Guardar cambios';
    document.getElementById('goal-title-input').value = g.title;
    document.getElementById('goal-date-input').value = g.target_date || '';
    document.getElementById('goal-sheet-overlay').classList.remove('hidden');
    renderGoalSheet();
  }

  function closeGoalSheet() {
    document.getElementById('goal-sheet-overlay').classList.add('hidden');
  }

  function setGoalType(type) {
    state.goalType = type;
    renderGoalSheet();
  }

  function setGoalCategory(id) {
    state.goalCategory = id;
    renderGoalSheet();
  }

  function onGoalTitleInput(v) { state.goalTitle = v.slice(0, 60); renderGoalSheet(true); }
  function onGoalAmountInput(raw) { state.goalAmount = raw.replace(/[^\d]/g, ''); renderGoalSheet(true); }
  function onGoalDateInput(v) { state.goalDate = v; }

  const GOAL_CAPTIONS = {
    ahorro: 'Meta de ahorro · COP',
    reduccion: 'Límite mensual de gasto · COP',
    inversion: 'Meta de inversión · COP'
  };

  function renderGoalSheet(skipAmountRefocus) {
    const toggle = document.getElementById('goal-type-toggle');
    toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.type === state.goalType));

    document.getElementById('goal-amount-caption').textContent = GOAL_CAPTIONS[state.goalType];
    document.getElementById('goal-amount-row').className = 'amount-row ' + state.goalType;

    const amountInput = document.getElementById('goal-amount-input');
    const formatted = state.goalAmount ? Number(state.goalAmount).toLocaleString('es-CO') : '0';
    if (!skipAmountRefocus || document.activeElement !== amountInput) amountInput.value = formatted;
    amountInput.style.width = (formatted.length + 1) + 'ch';
    amountInput.classList.toggle('filled', !!state.goalAmount && Number(state.goalAmount) > 0);

    document.getElementById('goal-category-block').classList.toggle('hidden', state.goalType !== 'reduccion');
    document.getElementById('goal-date-block').classList.toggle('hidden', state.goalType === 'reduccion');

    if (state.goalType === 'reduccion') {
      const grid = document.getElementById('goal-category-grid');
      grid.innerHTML = '';
      const allOption = { id: '', label: 'Todas', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>' };
      [allOption, ...allCategories()].forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'category-pill' + (c.id === state.goalCategory ? ' selected' : '');
        btn.innerHTML = `${categoryIconHTML(c, 20)}<span>${c.label}</span>`;
        btn.addEventListener('click', () => setGoalCategory(c.id));
        grid.appendChild(btn);
      });
      grid.appendChild(newCategoryPillHTML(async () => {
        const c = await addCustomCategory();
        if (c) setGoalCategory(c.id);
      }));
    }

    const valid = state.goalTitle.trim() && state.goalAmount && Number(state.goalAmount) > 0;
    document.getElementById('goal-save-btn').disabled = !valid;
  }

  async function saveGoal() {
    const amount = Number(state.goalAmount);
    const title = state.goalTitle.trim();
    if (!title || !amount || amount <= 0) return;
    const btn = document.getElementById('goal-save-btn');
    const wasEditing = !!state.editingGoalId;
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    const patch = {
      type: state.goalType,
      title,
      target_amount: amount,
      category: state.goalType === 'reduccion' ? (state.goalCategory || null) : null,
      target_date: state.goalType !== 'reduccion' && state.goalDate ? state.goalDate : null
    };
    try {
      if (wasEditing) await DB.updateGoal(state.editingGoalId, patch);
      else await DB.addGoal(patch);
      await loadGoals();
      renderGoals();
      closeGoalSheet();
      toast(wasEditing ? 'Meta actualizada' : 'Meta creada');
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar la meta. Intenta de nuevo.');
    } finally {
      btn.textContent = wasEditing ? 'Guardar cambios' : 'Guardar meta';
      renderGoalSheet();
    }
  }

  async function deleteGoalFromSheet() {
    if (!state.editingGoalId) return;
    const ok = await confirmDialog('¿Eliminar esta meta? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      await DB.deleteGoal(state.editingGoalId);
      await loadGoals();
      renderGoals();
      closeGoalSheet();
      toast('Meta eliminada');
    } catch (e) { console.error(e); toast('No se pudo eliminar'); }
  }

  // ── Gestionar categorías / cuentas personalizadas ────────────────────────
  const LIST_SHEET_CONFIG = {
    categories: {
      title: 'Categorías', hint: 'Predeterminadas — no se pueden eliminar',
      builtIn: () => window.CATEGORIES, custom: () => state.customCategories,
      iconHTML: (item) => categoryIconHTML(item, 18),
      add: () => addCustomCategory(), del: (id) => DB.deleteCategory(id), reload: () => loadCategories(),
      addLabel: '+ Agregar categoría'
    },
    accounts: {
      title: 'Cuentas', hint: 'Predeterminadas — no se pueden eliminar',
      builtIn: () => window.ACCOUNTS, custom: () => state.customAccounts,
      iconHTML: (item) => accountIconHTML(item, 18),
      add: () => addCustomAccount(), del: (id) => DB.deleteAccount(id), reload: () => loadAccounts(),
      addLabel: '+ Agregar cuenta'
    }
  };

  function openListSheet(kind) {
    state.listSheetKind = kind;
    document.getElementById('list-sheet-overlay').classList.remove('hidden');
    renderListSheet();
  }
  function closeListSheet() {
    document.getElementById('list-sheet-overlay').classList.add('hidden');
  }

  function renderListSheet() {
    const cfg = LIST_SHEET_CONFIG[state.listSheetKind];
    document.getElementById('list-sheet-title').textContent = cfg.title;
    document.getElementById('list-sheet-hint').textContent = cfg.hint;
    document.getElementById('list-sheet-add-btn').textContent = cfg.addLabel;

    const builtinEl = document.getElementById('list-sheet-builtin');
    builtinEl.innerHTML = cfg.builtIn().map((item) => `
      <div class="list-sheet-item">
        ${cfg.iconHTML(item)}
        <span class="list-sheet-item-label">${item.label}</span>
        <span class="list-sheet-item-tag">Predeterminada</span>
      </div>`).join('');

    const customEl = document.getElementById('list-sheet-custom');
    const customItems = cfg.custom();
    customEl.innerHTML = customItems.length === 0
      ? `<div class="list-sheet-empty">Aún no has agregado ninguna.</div>`
      : customItems.map((item) => `
        <div class="list-sheet-item">
          ${cfg.iconHTML(item)}
          <span class="list-sheet-item-label">${item.label}</span>
          <button class="list-sheet-item-delete" onclick="App.deleteListItem('${item.id}')">🗑️</button>
        </div>`).join('');
  }

  async function addListItem() {
    const cfg = LIST_SHEET_CONFIG[state.listSheetKind];
    await cfg.add();
    renderListSheet();
  }

  async function deleteListItem(id) {
    const cfg = LIST_SHEET_CONFIG[state.listSheetKind];
    const ok = await confirmDialog('¿Eliminar esta opción? Las transacciones que ya la usan no se modifican.');
    if (!ok) return;
    try {
      await cfg.del(id);
      await cfg.reload();
      renderListSheet();
      toast('Eliminada');
    } catch (e) { console.error(e); toast('No se pudo eliminar'); }
  }

  // ── Exportar a Excel ─────────────────────────────────────────────────────
  function exportExcel() {
    try {
      Export.transactionsToExcel(state.transactions);
      toast('Descargando Excel…');
    } catch (e) {
      console.error(e);
      toast(e.message || 'No se pudo exportar');
    }
  }

  // ── Month navigation ─────────────────────────────────────────────────────
  function prevMonth() { state.currentMonth = addMonths(state.currentMonth, -1); renderAll(); }
  function nextMonth() { state.currentMonth = addMonths(state.currentMonth, 1); renderAll(); }

  // ── Sheet: nueva / editar transacción ────────────────────────────────────
  function openSheet() {
    state.editingId = null;
    state.formType = 'egreso';
    state.formAmount = '';
    state.formDate = todayISO();
    state.formCategory = 'comida';
    state.formAccount = 'efectivo';
    state.formNote = '';
    state.formReceiptFile = null;
    state.formReceiptPath = null;
    state.formReceiptPreview = null;
    state.formReceiptRemoved = false;
    document.getElementById('sheet-title').textContent = 'Nueva transacción';
    document.getElementById('sheet-delete-btn').classList.add('hidden');
    document.getElementById('save-btn').textContent = 'Guardar transacción';
    document.getElementById('sheet-overlay').classList.remove('hidden');
    renderSheet();
  }

  function openEditSheet(t) {
    state.editingId = t.id;
    state.formType = t.type;
    state.formAmount = String(Math.round(Number(t.amount)));
    state.formDate = t.tx_date;
    state.formCategory = t.category;
    state.formAccount = t.account || 'efectivo';
    state.formNote = t.note || '';
    state.formReceiptFile = null;
    state.formReceiptPath = t.receipt_path || null;
    state.formReceiptPreview = null;
    state.formReceiptRemoved = false;
    document.getElementById('sheet-title').textContent = 'Editar transacción';
    document.getElementById('sheet-delete-btn').classList.remove('hidden');
    document.getElementById('save-btn').textContent = 'Guardar cambios';
    document.getElementById('sheet-overlay').classList.remove('hidden');
    renderSheet();
    if (state.formReceiptPath) {
      DB.getReceiptSrc(state.formReceiptPath).then((src) => {
        if (state.editingId !== t.id) return; // el usuario ya cerró/cambió de transacción
        state.formReceiptPreview = src;
        renderReceiptUI();
      }).catch((e) => console.error(e));
    }
  }

  function closeSheet() {
    document.getElementById('sheet-overlay').classList.add('hidden');
  }

  function setType(type) {
    state.formType = type;
    renderSheet();
  }

  function setCategory(id) {
    state.formCategory = id;
    renderSheet();
  }

  function shiftFormDate(n) {
    state.formDate = addDaysISO(state.formDate, n);
    renderSheet();
  }

  function onAmountInput(raw) {
    state.formAmount = raw.replace(/[^\d]/g, '');
    renderSheet(true);
  }

  function onNoteInput(v) {
    state.formNote = v.slice(0, 120);
    renderSheet(true);
  }

  function renderSheet(skipAmountRefocus) {
    const typeToggle = document.getElementById('type-toggle');
    typeToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.type === state.formType));

    const amountRow = document.getElementById('amount-row');
    amountRow.className = 'amount-row ' + state.formType;

    const amountInput = document.getElementById('amount-input');
    const formatted = state.formAmount ? Number(state.formAmount).toLocaleString('es-CO') : '0';
    if (!skipAmountRefocus || document.activeElement !== amountInput) amountInput.value = formatted;
    amountInput.style.width = (formatted.length + 1) + 'ch';
    amountInput.classList.toggle('filled', !!state.formAmount && Number(state.formAmount) > 0);

    document.getElementById('date-label').textContent = formatDateHuman(state.formDate);

    const accGrid = document.getElementById('account-grid');
    accGrid.innerHTML = '';
    allAccounts().forEach((a) => {
      const btn = document.createElement('button');
      btn.className = 'category-pill' + (a.id === state.formAccount ? ' selected' : '');
      btn.innerHTML = `${accountIconHTML(a, 20)}<span>${a.label}</span>`;
      btn.addEventListener('click', () => setAccount(a.id));
      accGrid.appendChild(btn);
    });
    accGrid.appendChild(newCategoryPillHTML(async () => {
      const c = await addCustomAccount();
      if (c) setAccount(c.id);
    }));

    const grid = document.getElementById('category-grid');
    grid.innerHTML = '';
    allCategories().forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'category-pill' + (c.id === state.formCategory ? ' selected' : '');
      btn.innerHTML = `${categoryIconHTML(c, 20)}<span>${c.label}</span>`;
      btn.addEventListener('click', () => setCategory(c.id));
      grid.appendChild(btn);
    });
    grid.appendChild(newCategoryPillHTML(async () => {
      const c = await addCustomCategory();
      if (c) setCategory(c.id);
    }));

    renderReceiptUI();

    document.getElementById('note-input').value = state.formNote;
    document.getElementById('note-count').textContent = `${state.formNote.length}/120`;

    document.getElementById('save-btn').disabled = !state.formAmount || Number(state.formAmount) <= 0;
  }

  function newCategoryPillHTML(onClick) {
    const btn = document.createElement('button');
    btn.className = 'category-pill add-pill';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Nueva</span>`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function setAccount(id) {
    state.formAccount = id;
    renderSheet();
  }

  async function addCustomCategory() {
    const label = await promptText('Nombre de la nueva categoría', 'ej. Mascotas');
    if (!label) return null;
    try {
      const cat = await DB.addCategory({ label });
      await loadCategories();
      toast(`Categoría "${label}" creada`);
      return cat;
    } catch (e) { console.error(e); toast('No se pudo crear la categoría'); return null; }
  }

  async function addCustomAccount() {
    const label = await promptText('Nombre de la nueva cuenta', 'ej. Nequi');
    if (!label) return null;
    try {
      const acc = await DB.addAccount({ label });
      await loadAccounts();
      toast(`Cuenta "${label}" creada`);
      return acc;
    } catch (e) { console.error(e); toast('No se pudo crear la cuenta'); return null; }
  }

  // ── Foto del recibo ───────────────────────────────────────────────────────
  function downscaleImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Archivo de imagen inválido'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function onReceiptFileChange(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file, 1000, 0.72);
      state.formReceiptFile = dataUrl;
      state.formReceiptRemoved = false;
      renderReceiptUI();
    } catch (e) { console.error(e); toast('No se pudo procesar la imagen'); }
    input.value = '';
  }

  function removeReceipt() {
    state.formReceiptFile = null;
    state.formReceiptRemoved = true;
    renderReceiptUI();
  }

  function renderReceiptUI() {
    const hasNew = !!state.formReceiptFile;
    const hasExisting = !!state.formReceiptPath && !state.formReceiptRemoved && !hasNew;
    const src = hasNew ? state.formReceiptFile : (hasExisting ? state.formReceiptPreview : null);
    document.getElementById('receipt-empty').classList.toggle('hidden', !!src);
    document.getElementById('receipt-preview-wrap').classList.toggle('hidden', !src);
    if (src) document.getElementById('receipt-preview-img').src = src;
  }

  async function saveTransaction() {
    const amount = Number(state.formAmount);
    if (!amount || amount <= 0) return;
    const btn = document.getElementById('save-btn');
    const wasEditing = !!state.editingId;
    const txId = state.editingId || crypto.randomUUID();
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    const patch = {
      type: state.formType,
      amount,
      currency: 'COP',
      category: state.formCategory,
      account: state.formAccount,
      note: state.formNote || null,
      tx_date: state.formDate
    };
    try {
      // Foto del recibo: subir la nueva / borrar la que se quitó, antes de guardar la fila.
      let receiptPath = state.formReceiptPath;
      if (state.formReceiptFile) {
        if (state.formReceiptPath) DB.deleteReceipt(state.formReceiptPath).catch(() => {});
        receiptPath = await DB.uploadReceipt(state.formReceiptFile, txId);
      } else if (state.formReceiptRemoved && state.formReceiptPath) {
        await DB.deleteReceipt(state.formReceiptPath).catch(() => {});
        receiptPath = null;
      }
      patch.receipt_path = receiptPath;

      if (wasEditing) await DB.updateTransaction(state.editingId, patch);
      else await DB.addTransaction({ id: txId, ...patch });
      await loadTransactions();
      state.currentMonth = startOfMonth(new Date(state.formDate + 'T00:00:00'));
      renderAll();
      closeSheet();
      toast(wasEditing ? 'Transacción actualizada' : 'Transacción guardada');
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar. Intenta de nuevo.');
    } finally {
      btn.textContent = wasEditing ? 'Guardar cambios' : 'Guardar transacción';
      renderSheet();
    }
  }

  async function deleteFromSheet() {
    if (!state.editingId) return;
    const ok = await confirmDialog('¿Eliminar esta transacción? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      await DB.deleteTransaction(state.editingId);
      if (state.formReceiptPath) DB.deleteReceipt(state.formReceiptPath).catch(() => {});
      await loadTransactions();
      renderAll();
      closeSheet();
      toast('Transacción eliminada');
    } catch (e) { console.error(e); toast('No se pudo eliminar'); }
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  async function sendMagicLink() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) return;
    const btn = document.getElementById('auth-send-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      await DB.signInWithMagicLink(email);
      document.getElementById('auth-form').classList.add('hidden');
      document.getElementById('auth-sent').classList.remove('hidden');
    } catch (e) {
      console.error(e);
      toast(e.message || 'No se pudo enviar el enlace');
      btn.disabled = false;
      btn.textContent = 'Enviar enlace mágico';
    }
  }

  async function signOut() {
    const ok = await confirmDialog('¿Cerrar sesión?', 'Cerrar sesión');
    if (!ok) return;
    await DB.signOut();
    state.session = null;
    render();
  }

  // ── Confirm dialog (reemplaza confirm() nativo) ──────────────────────────
  let confirmResolve = null;
  function bindConfirmDialogButtons() {
    document.getElementById('confirm-ok').addEventListener('click', () => resolveConfirm(true));
    document.getElementById('confirm-cancel').addEventListener('click', () => resolveConfirm(false));
    document.getElementById('confirm-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'confirm-overlay') resolveConfirm(false);
    });
  }
  function resolveConfirm(result) {
    document.getElementById('confirm-overlay').classList.add('hidden');
    if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(result); }
  }
  function confirmDialog(message, okLabel) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent = okLabel || 'Eliminar';
    document.getElementById('confirm-overlay').classList.remove('hidden');
    return new Promise((resolve) => { confirmResolve = resolve; });
  }

  // ── Prompt dialog genérico (monto o texto libre) ─────────────────────────
  let promptResolve = null;
  let promptMode = 'number';
  function bindPromptDialogButtons() {
    const input = document.getElementById('prompt-input');
    input.addEventListener('input', () => {
      if (promptMode !== 'number') return;
      const digits = input.value.replace(/[^\d]/g, '');
      input.value = digits ? Number(digits).toLocaleString('es-CO') : '';
    });
    document.getElementById('prompt-ok').addEventListener('click', () => resolvePrompt(true));
    document.getElementById('prompt-cancel').addEventListener('click', () => resolvePrompt(false));
    document.getElementById('prompt-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'prompt-overlay') resolvePrompt(false);
    });
  }
  function resolvePrompt(confirmed) {
    const overlay = document.getElementById('prompt-overlay');
    const input = document.getElementById('prompt-input');
    let result = null;
    if (confirmed) {
      if (promptMode === 'number') {
        const digits = input.value.replace(/[^\d]/g, '');
        result = digits ? Number(digits) : null;
      } else {
        const v = input.value.trim();
        result = v || null;
      }
    }
    overlay.classList.add('hidden');
    if (promptResolve) { const r = promptResolve; promptResolve = null; r(result); }
  }
  function promptValue(message, opts) {
    opts = opts || {};
    promptMode = opts.type === 'text' ? 'text' : 'number';
    const input = document.getElementById('prompt-input');
    input.setAttribute('inputmode', promptMode === 'number' ? 'numeric' : 'text');
    input.placeholder = opts.placeholder || (promptMode === 'number' ? '0' : '');
    document.getElementById('prompt-prefix').classList.toggle('hidden', promptMode !== 'number');
    input.value = promptMode === 'number' && opts.defaultValue
      ? Number(opts.defaultValue).toLocaleString('es-CO')
      : (opts.defaultValue || '');
    document.getElementById('prompt-message').textContent = message;
    document.getElementById('prompt-ok').textContent = opts.okLabel || 'Guardar';
    document.getElementById('prompt-overlay').classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
    return new Promise((resolve) => { promptResolve = resolve; });
  }
  function promptAmount(message, okLabel, defaultValue) {
    return promptValue(message, { okLabel: okLabel || 'Agregar', type: 'number', defaultValue });
  }
  function promptText(message, placeholder) {
    return promptValue(message, { okLabel: 'Agregar', type: 'text', placeholder });
  }

  // ── Toast ────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  return {
    init, prevMonth, nextMonth, switchTab, jumpToMonth, handleFabClick,
    openSheet, openEditSheet, closeSheet, deleteFromSheet, setType, setCategory,
    shiftFormDate, onAmountInput, onNoteInput, saveTransaction,
    onReceiptFileChange, removeReceipt,
    openGoalSheet, openEditGoalSheet, closeGoalSheet, setGoalType,
    onGoalTitleInput, onGoalAmountInput, onGoalDateInput, saveGoal,
    deleteGoalFromSheet, addContribution, exportExcel, editCategoryBudget,
    openListSheet, closeListSheet, addListItem, deleteListItem,
    sendMagicLink, signOut
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
