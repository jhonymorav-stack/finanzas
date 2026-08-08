// ── App ──────────────────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const App = (() => {
  const state = {
    session: null,
    transactions: [],
    currentMonth: startOfMonth(new Date()),
    activeTab: 'resumen',
    rate: null,
    // sheet/form state
    editingId: null,
    formType: 'egreso',
    formAmount: '',           // raw digits, in whole pesos
    formDate: todayISO(),
    formCategory: 'comida',
    formNote: ''
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

  function categoryById(id) { return window.CATEGORIES.find((c) => c.id === id) || window.CATEGORIES[window.CATEGORIES.length - 1]; }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    bindConfirmDialogButtons();
    Rates.refresh().then((r) => { state.rate = r; renderAll(); });

    if (DB.isConfigured) {
      DB.onAuthChange(async (session) => {
        state.session = session;
        if (session) { await loadTransactions(); renderAll(); }
        render();
      });
      state.session = await DB.getSession();
      if (state.session) await loadTransactions();
    } else {
      state.session = await DB.getSession();
      await loadTransactions();
    }
    render();
  }

  async function loadTransactions() {
    try { state.transactions = await DB.listTransactions(); }
    catch (e) { console.error(e); toast('No se pudieron cargar las transacciones'); }
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
    document.querySelectorAll('.tab-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
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
          <div class="tx-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${cat.icon}</svg></div>
          <div class="tx-info">
            <div class="tx-category">${cat.label}</div>
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
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = rows.length ? rows[0][1] : 0;

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
              return `
                <div class="metric-row">
                  <div class="metric-row-top">
                    <div class="metric-cat">
                      <span class="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${cat.icon}</svg></span>
                      ${cat.label}
                    </div>
                    <div class="metric-amount">${formatCOP(amount)} <span class="metric-pct">${pct}%</span></div>
                  </div>
                  <div class="metric-bar-track"><div class="metric-bar-fill" style="width:${barPct}%"></div></div>
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

  async function confirmDelete(t) {
    const ok = await confirmDialog(`¿Eliminar "${categoryById(t.category).label}" — ${t.type === 'ingreso' ? '+' : '−'}${formatCOP(t.amount)}?`);
    if (!ok) return;
    try {
      await DB.deleteTransaction(t.id);
      await loadTransactions();
      renderAll();
      toast('Transacción eliminada');
    } catch (e) { console.error(e); toast('No se pudo eliminar'); }
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
    state.formNote = '';
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
    state.formNote = t.note || '';
    document.getElementById('sheet-title').textContent = 'Editar transacción';
    document.getElementById('sheet-delete-btn').classList.remove('hidden');
    document.getElementById('save-btn').textContent = 'Guardar cambios';
    document.getElementById('sheet-overlay').classList.remove('hidden');
    renderSheet();
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
    amountInput.classList.toggle('filled', !!state.formAmount && Number(state.formAmount) > 0);

    document.getElementById('date-label').textContent = formatDateHuman(state.formDate);

    const grid = document.getElementById('category-grid');
    grid.innerHTML = '';
    window.CATEGORIES.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'category-pill' + (c.id === state.formCategory ? ' selected' : '');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${c.icon}</svg><span>${c.label}</span>`;
      btn.addEventListener('click', () => setCategory(c.id));
      grid.appendChild(btn);
    });

    document.getElementById('note-input').value = state.formNote;
    document.getElementById('note-count').textContent = `${state.formNote.length}/120`;

    document.getElementById('save-btn').disabled = !state.formAmount || Number(state.formAmount) <= 0;
  }

  async function saveTransaction() {
    const amount = Number(state.formAmount);
    if (!amount || amount <= 0) return;
    const btn = document.getElementById('save-btn');
    const wasEditing = !!state.editingId;
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    const patch = {
      type: state.formType,
      amount,
      currency: 'COP',
      category: state.formCategory,
      note: state.formNote || null,
      tx_date: state.formDate
    };
    try {
      if (wasEditing) await DB.updateTransaction(state.editingId, patch);
      else await DB.addTransaction(patch);
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
    init, prevMonth, nextMonth, switchTab, jumpToMonth,
    openSheet, openEditSheet, closeSheet, deleteFromSheet, setType, setCategory,
    shiftFormDate, onAmountInput, onNoteInput, saveTransaction, sendMagicLink, signOut
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
