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
    activeTab: 'hoy',
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
    listSheetKind: 'categories',
    // perfil
    profile: {},
    profileFormName: '',
    profileFormAge: '',
    // hábitos
    habits: [],
    habitLogs: [],       // filas { habit_id, log_date } de los últimos ~90 días
    // running
    runningBlocks: [],   // filas { id, day_number, sort_order, text }
    runningCompletions: [], // filas { block_id, done_date } de los últimos ~30 días
    freeRuns: [],
    runningMode: 'programa', // 'programa' | 'libre'
    runningDay: 1,            // 1-4, elegido a mano por el usuario
    runningEditing: false,
    entrenoType: null,        // 'running' | 'pesas' — se resuelve de localStorage al primer render
    // pesas
    gymRoutines: [],      // filas { id, name, sort_order } — hasta 3
    gymActiveRoutineId: null, // se resuelve de localStorage al primer render
    gymExercises: [],   // filas { id, routine_id, name, sets, reps, sort_order }
    gymSetLogs: []       // filas { exercise_id, set_number, log_date } de los últimos ~30 días
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
    return Promise.all([
      loadTransactions(), loadGoals(), loadCategories(), loadAccounts(), loadBudgets(), loadProfile(),
      loadHabits(), loadHabitLogs(), loadRunningBlocks(), loadRunningCompletions(), loadFreeRuns(),
      loadGymRoutines(), loadGymExercises(), loadGymSetLogs()
    ]).then(seedRunningProgramIfNeeded).then(ensureDefaultGymRoutine);
  }

  async function init() {
    bindConfirmDialogButtons();
    bindPromptDialogButtons();
    applyTheme(getStoredTheme());
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

  async function loadProfile() {
    try { state.profile = await DB.getProfile() || {}; }
    catch (e) { console.error(e); }
  }

  async function loadHabits() {
    try { state.habits = await DB.listHabits(); }
    catch (e) { console.error(e); }
  }

  async function loadHabitLogs() {
    // 180 días = margen para navegar varios meses atrás en el calendario de Hoy
    // sin tener que ir a pedir más datos cada vez que cambias de mes.
    try { state.habitLogs = await DB.listHabitLogs(addDaysISO(todayISO(), -180)); }
    catch (e) { console.error(e); }
  }

  async function loadRunningBlocks() {
    try { state.runningBlocks = await DB.listRunningBlocks(); }
    catch (e) { console.error(e); }
  }

  async function loadRunningCompletions() {
    try { state.runningCompletions = await DB.listRunningCompletions(addDaysISO(todayISO(), -30)); }
    catch (e) { console.error(e); }
  }

  async function loadFreeRuns() {
    try { state.freeRuns = await DB.listFreeRuns(); }
    catch (e) { console.error(e); }
  }

  async function loadGymRoutines() {
    try { state.gymRoutines = await DB.listGymRoutines(); }
    catch (e) { console.error(e); }
  }

  async function loadGymExercises() {
    try { state.gymExercises = await DB.listGymExercises(); }
    catch (e) { console.error(e); }
  }

  async function loadGymSetLogs() {
    try { state.gymSetLogs = await DB.listGymSetLogs(addDaysISO(todayISO(), -30)); }
    catch (e) { console.error(e); }
  }

  // Igual que con el programa de running: sin este guardado, loadAll() puede
  // correr dos veces en el mismo login y crear dos "Entreno 1" duplicados.
  let gymRoutineSeedAttempted = false;
  async function ensureDefaultGymRoutine() {
    if (gymRoutineSeedAttempted) return;
    gymRoutineSeedAttempted = true;
    if (state.gymRoutines.length > 0) return;
    try {
      const row = await DB.addGymRoutine({ name: 'Entreno 1', sort_order: 0 });
      state.gymRoutines.push(row);
    } catch (e) { console.error(e); }
  }

  // La primera vez que alguien entra, precarga tu programa real de running
  // (Fase 1, Días 1-3 — el Día 4 repite el Día 2) para que Entreno no arranque vacío.
  // Se marca con running_seeded=true para no volver a insertar si luego borras todo a propósito.
  //
  // NOTA: init() puede llamar a loadAll() dos veces en el mismo login (una vez al
  // pedir la sesión directo, y otra vez por el callback de onAuthChange) — sin este
  // guardado en memoria, esta función se ejecutaría dos veces en paralelo y
  // duplicaría los bloques (esto pasó una vez: 9 bloques reales → 18 duplicados).
  // El guardado es síncrono (sin await antes de fijarlo) así que la segunda llamada
  // siempre ve runningSeedAttempted=true y sale de inmediato.
  let runningSeedAttempted = false;
  async function seedRunningProgramIfNeeded() {
    if (runningSeedAttempted) return;
    runningSeedAttempted = true;
    if (state.profile.running_seeded) return;
    if (state.runningBlocks.length > 0) {
      await DB.upsertProfile({ running_seeded: true });
      state.profile.running_seeded = true;
      return;
    }
    const seed = {
      1: [
        '10 min de caminata a 5.5',
        '3 min de trote a 6.0 + 2 min de caminata a 4.0. Repetir 5 veces.',
        '5 min de caminata a 5.0'
      ],
      2: [
        'Técnica de carrera: elevación de rodillas 30 seg a 5.0. Repetir 10 veces + 30 seg caminando entre cada una.',
        '1 min de trote a 8.0 + 2 min de caminata a 5.5. Repetir 15 veces.',
        '10 min de caminata a 5.5'
      ],
      3: [
        '5 min de caminata a 5.5',
        '5 min de trote a 6.0 con 2 min de descanso total. Repetir 4 veces.',
        '5 min de caminata a 5.5'
      ]
    };
    try {
      for (const dayNumber of [1, 2, 3]) {
        let order = 0;
        for (const text of seed[dayNumber]) {
          await DB.addRunningBlock({ day_number: dayNumber, sort_order: order++, text });
        }
      }
      await DB.upsertProfile({ running_seeded: true });
      state.profile.running_seeded = true;
      state.runningBlocks = await DB.listRunningBlocks();
    } catch (e) { console.error(e); }
  }

  // ── Render dispatcher ────────────────────────────────────────────────────
  function render() {
    document.getElementById('auth-screen').classList.toggle('hidden', !!state.session);
    document.getElementById('app-shell').classList.toggle('hidden', !state.session);
    if (state.session) { renderAll(); switchTab(state.activeTab); }
  }

  function renderAll() {
    renderHoy();
    renderEntreno();
    renderMonthBar();
    renderBalanceCard();
    renderTxList();
    renderMetrics();
    renderGoals();
  }

  // ── Hoy: hábitos + frase/versículo ───────────────────────────────────────
  const CHECK_SVG = '<svg viewBox="0 0 16 16"><polyline points="3,8 7,12 13,4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const FLAME_SVG = '<svg viewBox="0 0 16 16"><path d="M8 1c1 3-2 4-2 7a3 3 0 1 0 6 0c0-1-1-1.5-1-1.5.5 2-1 2.5-1 2.5 1-2-1-3-2-4.5C7.5 6 6 7 6 8.5 6 5 8 3 8 1z"/></svg>';

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function habitStreak(habitId) {
    const dates = new Set(state.habitLogs.filter((l) => l.habit_id === habitId).map((l) => l.log_date));
    let streak = 0;
    let cursor = todayISO();
    // si hoy no está marcado, la racha cuenta desde ayer hacia atrás.
    if (!dates.has(cursor)) cursor = addDaysISO(cursor, -1);
    while (dates.has(cursor)) { streak++; cursor = addDaysISO(cursor, -1); }
    return streak;
  }

  function renderHoy() {
    const el = document.getElementById('hoy-content');
    if (!el) return;
    const today = todayISO();
    const quote = window.quoteForDate ? window.quoteForDate(today) : '';
    const verse = window.verseForDate ? window.verseForDate(today) : { ref: '', text: '' };
    const doneToday = new Set(state.habitLogs.filter((l) => l.log_date === today).map((l) => l.habit_id));
    const total = state.habits.length;
    const done = state.habits.filter((h) => doneToday.has(h.id)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    el.innerHTML = `
      <div class="hoy-head">
        <div>
          <div class="hoy-date">${dayGroupLabel(today).replace('HOY · ', '')}</div>
          <h1 class="hoy-title">${greeting()}</h1>
        </div>
        <div class="ring" style="--pct:${pct}%"><span class="ring-label">${done}/${total || 0}</span></div>
      </div>
      <div class="word-card">
        <div class="quote-row"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h4v4c0 2-1.3 3.4-4 4M13 8h4v4c0 2-1.3 3.4-4 4"/></svg><p>${escapeHtml(quote)}</p></div>
        <hr>
        <div class="verse-row"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 014 18.5v-13zM20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 001.5-1.5v-13z"/></svg><p><b>${escapeHtml(verse.ref)}</b>${escapeHtml(verse.text)}</p></div>
      </div>
      <ul class="habit-list" id="habit-list"></ul>
      <button type="button" class="add-habit-btn" id="add-habit-btn">+ agregar hábito</button>
      <div class="section-label">Avance diario</div>
      <div id="habit-heatmap"></div>
    `;

    const list = document.getElementById('habit-list');
    if (total === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>Todavía no tienes hábitos.<br>Toca “+ agregar hábito” para crear el primero.</p></div>`;
    } else {
      state.habits.forEach((h) => {
        const isDone = doneToday.has(h.id);
        const li = document.createElement('li');
        li.className = 'habit' + (isDone ? ' done' : '');
        li.innerHTML = `
          <button class="habit-check" aria-pressed="${isDone}">${CHECK_SVG}</button>
          <div class="habit-body">
            <span class="habit-name">${escapeHtml(h.name)}</span>
            ${h.meta ? `<span class="habit-meta">${escapeHtml(h.meta)}</span>` : ''}
          </div>
          <span class="streak">${FLAME_SVG}${habitStreak(h.id)}</span>
          <button class="habit-remove" aria-label="Eliminar ${escapeHtml(h.name)}">&times;</button>
        `;
        li.querySelector('.habit-check').addEventListener('click', () => toggleHabit(h.id, isDone));
        li.querySelector('.habit-remove').addEventListener('click', () => removeHabit(h.id, h.name));
        list.appendChild(li);
      });
    }

    document.getElementById('add-habit-btn').addEventListener('click', addHabitPrompt);
    renderHabitHeatmap();
  }

  // Calendario del mes (no una franja de semanas) para que se vea el avance día a
  // día. Se puede navegar mes a mes; no deja ir más adelante del mes actual.
  function renderHabitHeatmap() {
    const el = document.getElementById('habit-heatmap');
    if (!el) return;
    const monthDate = state.habitCalendarMonth || (state.habitCalendarMonth = startOfMonth(new Date()));
    const total = state.habits.length || 1;
    const countsByDate = {};
    state.habitLogs.forEach((l) => { countsByDate[l.log_date] = (countsByDate[l.log_date] || 0) + 1; });

    const year = monthDate.getFullYear(), month = monthDate.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lunes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayISO();
    const atCurrentMonth = monthDate.getTime() === startOfMonth(new Date()).getTime();

    let cellsHTML = '';
    for (let i = 0; i < firstWeekday; i++) cellsHTML += `<i class="cal-empty"></i>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isFuture = iso > today;
      const ratio = (countsByDate[iso] || 0) / total;
      const lvl = !countsByDate[iso] ? 0 : ratio < 0.35 ? 1 : ratio < 0.65 ? 2 : ratio < 1 ? 3 : 4;
      const cls = [iso === today ? 'cal-today' : '', isFuture ? 'cal-future' : ''].filter(Boolean).join(' ');
      cellsHTML += `<i class="${cls}" data-lvl="${isFuture ? '' : lvl}" title="${iso}">${d}</i>`;
    }

    el.innerHTML = `
      <div class="cal-head">
        <button type="button" class="month-nav-btn" id="cal-prev" aria-label="Mes anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="cal-month-title">${MESES[month]} ${year}</span>
        <button type="button" class="month-nav-btn" id="cal-next" aria-label="Mes siguiente" ${atCurrentMonth ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div class="cal-grid cal-dow"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="cal-grid">${cellsHTML}</div>
    `;

    document.getElementById('cal-prev').addEventListener('click', () => { state.habitCalendarMonth = addMonths(monthDate, -1); renderHabitHeatmap(); });
    const nextBtn = document.getElementById('cal-next');
    if (!atCurrentMonth) nextBtn.addEventListener('click', () => { state.habitCalendarMonth = addMonths(monthDate, 1); renderHabitHeatmap(); });
  }

  async function toggleHabit(id, wasDone) {
    const today = todayISO();
    try {
      if (wasDone) { await DB.unlogHabit(id, today); state.habitLogs = state.habitLogs.filter((l) => !(l.habit_id === id && l.log_date === today)); }
      else { await DB.logHabit(id, today); state.habitLogs.push({ habit_id: id, log_date: today }); }
      renderHoy();
    } catch (e) { console.error(e); toast('No se pudo actualizar el hábito'); }
  }

  async function addHabitPrompt() {
    const name = await promptText('Nombre del hábito', 'ej. Meditar');
    if (!name) return;
    const meta = await promptText('Detalle (opcional)', 'ej. 10 min · respiración');
    try {
      const row = await DB.addHabit({ name, meta: meta || null });
      state.habits.push(row);
      renderHoy();
    } catch (e) { console.error(e); toast('No se pudo agregar el hábito'); }
  }

  async function removeHabit(id, name) {
    const ok = await confirmDialog(`¿Eliminar “${name}”? Se borra también su historial.`, 'Eliminar');
    if (!ok) return;
    try {
      await DB.deleteHabit(id);
      state.habits = state.habits.filter((h) => h.id !== id);
      state.habitLogs = state.habitLogs.filter((l) => l.habit_id !== id);
      renderHoy();
    } catch (e) { console.error(e); toast('No se pudo eliminar el hábito'); }
  }

  // ── Entreno: running (programa de intervalos + carrera libre) ────────────
  function resolvedDayNumber(day) { return day === 4 ? 2 : day; }

  function blocksForDay(day) {
    const dn = resolvedDayNumber(day);
    return state.runningBlocks.filter((b) => b.day_number === dn).sort((a, b) => a.sort_order - b.sort_order);
  }

  function fmtPace(secsPerKm) {
    if (!isFinite(secsPerKm) || secsPerKm <= 0) return '—';
    const m = Math.floor(secsPerKm / 60), s = Math.round(secsPerKm % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtDuration(secs) {
    const m = Math.floor(secs / 60), s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function parseTimeToSecs(str) {
    const parts = String(str).trim().split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
    const n = Number(str);
    return isFinite(n) ? Math.round(n * 60) : 0;
  }

  // ── Meta semanal (min. 2 entrenos/semana, tanto pesas como running) ───────
  function weekRange(dateISO) {
    const d = new Date(dateISO + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7; // 0 = lunes
    const monday = addDaysISO(dateISO, -dow);
    return { monday, sunday: addDaysISO(monday, 6) };
  }
  function inWeek(dateISO, monday, sunday) { return dateISO >= monday && dateISO <= sunday; }

  function gymWeeklyCount() {
    const { monday, sunday } = weekRange(todayISO());
    const dates = new Set(state.gymSetLogs.filter((l) => inWeek(l.log_date, monday, sunday)).map((l) => l.log_date));
    return dates.size;
  }
  function runningWeeklyCount() {
    const { monday, sunday } = weekRange(todayISO());
    const dates = new Set();
    state.runningCompletions.forEach((c) => { if (inWeek(c.done_date, monday, sunday)) dates.add(c.done_date); });
    state.freeRuns.forEach((r) => { if (inWeek(r.run_date, monday, sunday)) dates.add(r.run_date); });
    return dates.size;
  }
  function weekGoalCardHTML(count, goal, label) {
    const pct = Math.min(100, Math.round((count / goal) * 100));
    const met = count >= goal;
    return `
      <div class="week-goal-card${met ? ' met' : ''}">
        <div class="week-goal-top">
          <span class="week-goal-label">${label}</span>
          <span class="week-goal-count">${count}/${goal}${met ? ' ✅' : ''}</span>
        </div>
        <div class="week-goal-bar"><div class="week-goal-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  const ENTRENO_TYPE_KEY = 'finanzas_entreno_type';
  function getEntrenoType() {
    try { return localStorage.getItem(ENTRENO_TYPE_KEY) || 'running'; } catch (e) { return 'running'; }
  }
  function setEntrenoType(type) {
    try { localStorage.setItem(ENTRENO_TYPE_KEY, type); } catch (e) {}
    state.entrenoType = type;
    renderEntreno();
  }

  function renderEntreno() {
    const el = document.getElementById('entreno-content');
    if (!el) return;
    const type = state.entrenoType || (state.entrenoType = getEntrenoType());

    el.innerHTML = `
      <div class="ent-head">
        <div class="ent-date">Entreno</div>
        <h1 class="ent-title" id="ent-title">${type === 'pesas' ? 'Pesas' : 'Running'}</h1>
      </div>
      <div class="type-toggle ent-type-row" id="ent-type-switch">
        <button type="button" data-etype="running" class="${type === 'running' ? 'active' : ''}">Running</button>
        <button type="button" data-etype="pesas" class="${type === 'pesas' ? 'active' : ''}">Pesas</button>
      </div>
      <div id="ent-sub"></div>
      <div id="ent-body"></div>
    `;
    document.querySelectorAll('#ent-type-switch button').forEach((b) => {
      b.addEventListener('click', () => setEntrenoType(b.dataset.etype));
    });

    if (type === 'pesas') {
      renderPesas();
    } else {
      document.getElementById('ent-sub').innerHTML = `
        ${weekGoalCardHTML(runningWeeklyCount(), 2, 'Entrenos de running esta semana')}
        <div class="plan-switch" id="ent-mode-switch">
          <button type="button" data-rmode="programa" aria-pressed="${state.runningMode === 'programa'}">Programa</button>
          <button type="button" data-rmode="libre" aria-pressed="${state.runningMode === 'libre'}">Carrera libre</button>
        </div>
      `;
      document.querySelectorAll('#ent-mode-switch button').forEach((b) => {
        b.addEventListener('click', () => { state.runningMode = b.dataset.rmode; renderEntreno(); });
      });
      if (state.runningMode === 'libre') renderRunningLibre(); else renderRunningPrograma();
    }
  }

  function renderRunningPrograma() {
    const body = document.getElementById('ent-body');
    const week = state.profile.running_week || 1;
    const totalWeeks = state.profile.running_total_weeks || 4;
    const fase = state.profile.running_fase || 'Fase 1 · Adaptación deportiva';
    const day = state.runningDay || 1;
    const blocks = blocksForDay(day);
    const today = todayISO();
    const doneIds = new Set(state.runningCompletions.filter((c) => c.done_date === today).map((c) => c.block_id));
    const doneCount = blocks.filter((b) => doneIds.has(b.id)).length;
    const pct = blocks.length ? Math.round((doneCount / blocks.length) * 100) : 0;

    body.innerHTML = `
      <p class="sub">${escapeHtml(fase)}</p>
      <div class="week-row">
        <button type="button" class="week-btn" id="week-prev" ${week <= 1 ? 'disabled' : ''}>−</button>
        <p class="plan-count">Semana ${week} de ${totalWeeks}</p>
        <button type="button" class="week-btn" id="week-next" ${week >= totalWeeks ? 'disabled' : ''}>+</button>
      </div>
      <div class="prog-head-row">
        <div class="day-pills" id="day-pills">
          ${[1, 2, 3, 4].map((d) => `<button type="button" data-day="${d}" aria-pressed="${d === day}">Día ${d}</button>`).join('')}
        </div>
        <button type="button" class="edit-plan-btn" id="edit-prog-btn" aria-pressed="${state.runningEditing}" aria-label="Editar bloques">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
        </button>
      </div>
      <div class="warmup-row">
        <span class="warmup-pill">Movilidad</span><span class="warmup-pill">Activación muscular</span><span class="warmup-pill">Preparación</span>
      </div>
      ${day === 4 ? '<p class="prog-repeat-note">Este día repite exactamente el Día 2 — edítalo desde ahí.</p>' : ''}
      <div class="prog-today-row">
        <p>${doneCount}/${blocks.length} bloques</p>
        <div class="ring ring-sm" style="--pct:${pct}%"><span class="ring-label">${doneCount}/${blocks.length}</span></div>
      </div>
      <ul class="habit-list" id="prog-blocks"></ul>
      <button type="button" class="add-blk-btn${state.runningEditing ? ' show' : ''}" id="add-blk-btn">+ agregar bloque</button>
    `;

    const list = document.getElementById('prog-blocks');
    if (blocks.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏃</div><p>Sin bloques para este día todavía.</p></div>`;
    } else {
      blocks.forEach((b) => {
        const isDone = doneIds.has(b.id);
        const li = document.createElement('li');
        li.className = 'habit' + (isDone ? ' done' : '');
        li.innerHTML = `
          <button class="habit-check" aria-pressed="${isDone}">${CHECK_SVG}</button>
          <div class="habit-body"><span class="habit-name blk-text">${escapeHtml(b.text)}</span></div>
          <button class="blk-remove" aria-label="Quitar bloque">&times;</button>
        `;
        li.querySelector('.habit-check').addEventListener('click', () => toggleBlock(b.id, isDone));
        li.querySelector('.blk-remove').addEventListener('click', () => removeBlock(b.id));
        list.appendChild(li);
      });
    }
    list.classList.toggle('editing-prog', state.runningEditing);

    document.querySelectorAll('#day-pills button').forEach((btn) => {
      btn.addEventListener('click', () => { state.runningDay = Number(btn.dataset.day); renderRunningPrograma(); });
    });
    document.getElementById('edit-prog-btn').addEventListener('click', () => { state.runningEditing = !state.runningEditing; renderRunningPrograma(); });
    document.getElementById('add-blk-btn').addEventListener('click', () => addBlockPrompt(day));
    document.getElementById('week-prev').addEventListener('click', () => shiftRunningWeek(-1));
    document.getElementById('week-next').addEventListener('click', () => shiftRunningWeek(1));
  }

  async function toggleBlock(blockId, wasDone) {
    const today = todayISO();
    try {
      if (wasDone) { await DB.unmarkBlockDone(blockId, today); state.runningCompletions = state.runningCompletions.filter((c) => !(c.block_id === blockId && c.done_date === today)); }
      else { await DB.markBlockDone(blockId, today); state.runningCompletions.push({ block_id: blockId, done_date: today }); }
      renderRunningPrograma();
    } catch (e) { console.error(e); toast('No se pudo actualizar el bloque'); }
  }

  async function addBlockPrompt(day) {
    const text = await promptText('Describe el bloque', 'ej. 5 min de trote a 6.0. Repetir 4 veces.');
    if (!text) return;
    const dn = resolvedDayNumber(day);
    try {
      const row = await DB.addRunningBlock({ day_number: dn, sort_order: blocksForDay(day).length, text });
      state.runningBlocks.push(row);
      renderRunningPrograma();
    } catch (e) { console.error(e); toast('No se pudo agregar el bloque'); }
  }

  async function removeBlock(blockId) {
    const ok = await confirmDialog('¿Quitar este bloque del plan?', 'Quitar');
    if (!ok) return;
    try {
      await DB.deleteRunningBlock(blockId);
      state.runningBlocks = state.runningBlocks.filter((b) => b.id !== blockId);
      renderRunningPrograma();
    } catch (e) { console.error(e); toast('No se pudo quitar el bloque'); }
  }

  async function shiftRunningWeek(delta) {
    const totalWeeks = state.profile.running_total_weeks || 4;
    const next = Math.min(totalWeeks, Math.max(1, (state.profile.running_week || 1) + delta));
    if (next === state.profile.running_week) return;
    state.profile.running_week = next;
    renderRunningPrograma();
    try { await DB.upsertProfile({ running_week: next }); }
    catch (e) { console.error(e); toast('No se pudo guardar la semana'); }
  }

  function renderRunningLibre() {
    const body = document.getElementById('ent-body');
    const today = todayISO();
    const weekAgo = addDaysISO(today, -7);
    const weekRuns = state.freeRuns.filter((r) => r.run_date >= weekAgo);
    const weekKm = weekRuns.reduce((s, r) => s + Number(r.km), 0);
    const totalSecs = weekRuns.reduce((s, r) => s + Number(r.duration_seconds), 0);
    const avgPace = weekKm ? fmtPace(totalSecs / weekKm) : '—';

    body.innerHTML = `
      <div class="stat-row">
        <div class="stat-tile"><span class="v">${weekKm.toFixed(1)}</span><span class="k">km esta semana</span></div>
        <div class="stat-tile"><span class="v">${weekRuns.length}</span><span class="k">carreras</span></div>
        <div class="stat-tile"><span class="v">${avgPace}</span><span class="k">ritmo prom. /km</span></div>
      </div>
      <button type="button" class="save-run-btn" id="add-run-btn">+ registrar carrera</button>
      <p class="section-label">Historial</p>
      <div id="run-history"></div>
    `;
    const hist = document.getElementById('run-history');
    if (state.freeRuns.length === 0) {
      hist.innerHTML = `<div class="empty-state"><div class="empty-icon">🏃</div><p>Todavía no registras carreras libres.</p></div>`;
    } else {
      state.freeRuns.slice(0, 20).forEach((r) => {
        const pace = fmtPace(r.duration_seconds / r.km);
        const row = document.createElement('div');
        row.className = 'run-row';
        row.innerHTML = `
          <span class="rdate">${formatDateShort(r.run_date)}</span>
          <div class="rbody"><span class="rdist">${Number(r.km).toFixed(1)} km</span><span class="rmeta">${fmtDuration(r.duration_seconds)} · ${pace} /km</span></div>
          <span class="rterrain">${escapeHtml(r.terrain || 'Asfalto')}</span>
        `;
        hist.appendChild(row);
      });
    }
    document.getElementById('add-run-btn').addEventListener('click', addFreeRunPrompt);
  }

  async function addFreeRunPrompt() {
    const kmStr = await promptValue('Distancia (km)', { type: 'text', placeholder: '5.0', okLabel: 'Siguiente' });
    if (!kmStr) return;
    const km = parseFloat(String(kmStr).replace(',', '.'));
    if (!km || km <= 0) { toast('Distancia inválida'); return; }
    const timeStr = await promptValue('Tiempo (mm:ss)', { type: 'text', placeholder: '28:00', okLabel: 'Siguiente' });
    if (!timeStr) return;
    const secs = parseTimeToSecs(timeStr);
    if (!secs || secs <= 0) { toast('Tiempo inválido'); return; }
    const terrainStr = await promptValue('Terreno', { type: 'text', placeholder: 'Asfalto / Trail / Pista / Cinta', defaultValue: 'Asfalto', okLabel: 'Guardar carrera' });
    try {
      const row = await DB.addFreeRun({ run_date: todayISO(), km, duration_seconds: secs, terrain: terrainStr || 'Asfalto' });
      state.freeRuns.unshift(row);
      renderRunningLibre();
      toast('Carrera guardada');
    } catch (e) { console.error(e); toast('No se pudo guardar la carrera'); }
  }

  // ── Pesas ──────────────────────────────────────────────────────────────────
  const GYM_ROUTINE_KEY = 'finanzas_gym_active_routine';

  function ensureActiveRoutine() {
    if (state.gymActiveRoutineId === null) {
      try { state.gymActiveRoutineId = localStorage.getItem(GYM_ROUTINE_KEY); } catch (e) { state.gymActiveRoutineId = null; }
    }
    if (!state.gymActiveRoutineId || !state.gymRoutines.some((r) => r.id === state.gymActiveRoutineId)) {
      state.gymActiveRoutineId = state.gymRoutines[0] ? state.gymRoutines[0].id : null;
    }
  }
  function setActiveRoutine(id) {
    state.gymActiveRoutineId = id;
    try { localStorage.setItem(GYM_ROUTINE_KEY, id); } catch (e) {}
  }

  function renderPesas() {
    const sub = document.getElementById('ent-sub');
    const body = document.getElementById('ent-body');
    if (!sub || !body) return;
    ensureActiveRoutine();

    const pillsHTML = state.gymRoutines.map((r) => `
      <button type="button" data-routine="${r.id}" aria-pressed="${r.id === state.gymActiveRoutineId}">${escapeHtml(r.name)}</button>
    `).join('');

    sub.innerHTML = `
      ${weekGoalCardHTML(gymWeeklyCount(), 2, 'Entrenos de pesas esta semana')}
      <div class="prog-head-row">
        <div class="day-pills" id="routine-pills">${pillsHTML}</div>
        ${state.gymRoutines.length < 3 ? '<button type="button" class="edit-plan-btn" id="add-routine-btn" aria-label="Agregar entreno">+</button>' : ''}
        ${state.gymRoutines.length > 1 ? '<button type="button" class="edit-plan-btn" id="del-routine-btn" aria-label="Eliminar este entreno">🗑</button>' : ''}
      </div>
    `;
    document.querySelectorAll('#routine-pills button').forEach((b) => {
      b.addEventListener('click', () => { setActiveRoutine(b.dataset.routine); renderPesas(); });
    });
    const addRoutineBtn = document.getElementById('add-routine-btn');
    if (addRoutineBtn) addRoutineBtn.addEventListener('click', addGymRoutinePrompt);
    const delRoutineBtn = document.getElementById('del-routine-btn');
    if (delRoutineBtn) delRoutineBtn.addEventListener('click', removeActiveRoutine);

    const today = todayISO();
    const doneSet = new Set(state.gymSetLogs.filter((l) => l.log_date === today).map((l) => l.exercise_id + '#' + l.set_number));
    const exercises = state.gymExercises
      .filter((e) => e.routine_id === state.gymActiveRoutineId)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (exercises.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">🏋️</div><p>Este entreno todavía no tiene ejercicios.<br>Toca "+ agregar ejercicio" para crear el primero.</p></div><button type="button" class="add-gym-btn" id="add-gym-btn">+ agregar ejercicio</button>`;
      document.getElementById('add-gym-btn').addEventListener('click', addGymExercisePrompt);
      return;
    }

    body.innerHTML = exercises.map((ex) => `
      <div class="gym-row" data-ex="${ex.id}">
        <div class="gym-row-head">
          <div>
            <div class="gym-row-name">${escapeHtml(ex.name)}</div>
            <div class="gym-row-target">${ex.sets} series · ${escapeHtml(ex.reps)} reps</div>
          </div>
          <button class="gym-remove" aria-label="Eliminar ${escapeHtml(ex.name)}">&times;</button>
        </div>
        <div class="gym-sets-row">
          ${Array.from({ length: ex.sets }, (_, i) => i + 1).map((n) => `
            <button type="button" class="gym-set-btn${doneSet.has(ex.id + '#' + n) ? ' done' : ''}" data-set="${n}">${n}</button>
          `).join('')}
        </div>
      </div>
    `).join('') + `<button type="button" class="add-gym-btn" id="add-gym-btn">+ agregar ejercicio</button>`;

    document.querySelectorAll('.gym-row').forEach((row) => {
      const exId = row.dataset.ex;
      row.querySelector('.gym-remove').addEventListener('click', () => removeGymExercise(exId, row.querySelector('.gym-row-name').textContent));
      row.querySelectorAll('.gym-set-btn').forEach((btn) => {
        btn.addEventListener('click', () => toggleGymSet(exId, Number(btn.dataset.set), btn.classList.contains('done')));
      });
    });
    document.getElementById('add-gym-btn').addEventListener('click', addGymExercisePrompt);
  }

  async function addGymRoutinePrompt() {
    if (state.gymRoutines.length >= 3) { toast('Máximo 3 entrenos'); return; }
    const name = await promptText('Nombre del entreno', `ej. Entreno ${state.gymRoutines.length + 1}`);
    if (!name) return;
    try {
      const row = await DB.addGymRoutine({ name, sort_order: state.gymRoutines.length });
      state.gymRoutines.push(row);
      setActiveRoutine(row.id);
      renderPesas();
    } catch (e) { console.error(e); toast('No se pudo agregar el entreno'); }
  }

  async function removeActiveRoutine() {
    const routine = state.gymRoutines.find((r) => r.id === state.gymActiveRoutineId);
    if (!routine) return;
    const ok = await confirmDialog(`¿Eliminar "${routine.name}"? También se borran sus ejercicios.`, 'Eliminar');
    if (!ok) return;
    try {
      await DB.deleteGymRoutine(routine.id);
      state.gymRoutines = state.gymRoutines.filter((r) => r.id !== routine.id);
      state.gymExercises = state.gymExercises.filter((e) => e.routine_id !== routine.id);
      state.gymActiveRoutineId = null;
      renderPesas();
    } catch (e) { console.error(e); toast('No se pudo eliminar el entreno'); }
  }

  async function addGymExercisePrompt() {
    const name = await promptText('Nombre del ejercicio', 'ej. Press banca');
    if (!name) return;
    const setsStr = await promptValue('Series', { type: 'text', placeholder: '4', defaultValue: '4', okLabel: 'Siguiente' });
    const sets = Math.max(1, Math.min(20, parseInt(setsStr, 10) || 4));
    const reps = await promptText('Repeticiones por serie', 'ej. 10-12') || '10-12';
    const sortOrder = state.gymExercises.filter((e) => e.routine_id === state.gymActiveRoutineId).length;
    try {
      const row = await DB.addGymExercise({ name, sets, reps, sort_order: sortOrder, routine_id: state.gymActiveRoutineId });
      state.gymExercises.push(row);
      renderPesas();
    } catch (e) { console.error(e); toast('No se pudo agregar el ejercicio'); }
  }

  async function removeGymExercise(id, name) {
    const ok = await confirmDialog(`¿Eliminar "${name}"? También se borra su historial de series.`, 'Eliminar');
    if (!ok) return;
    try {
      await DB.deleteGymExercise(id);
      state.gymExercises = state.gymExercises.filter((e) => e.id !== id);
      state.gymSetLogs = state.gymSetLogs.filter((l) => l.exercise_id !== id);
      renderPesas();
    } catch (e) { console.error(e); toast('No se pudo eliminar el ejercicio'); }
  }

  async function toggleGymSet(exerciseId, setNumber, wasDone) {
    const today = todayISO();
    try {
      if (wasDone) {
        await DB.unmarkSetDone(exerciseId, setNumber, today);
        state.gymSetLogs = state.gymSetLogs.filter((l) => !(l.exercise_id === exerciseId && l.set_number === setNumber && l.log_date === today));
      } else {
        await DB.markSetDone(exerciseId, setNumber, today);
        state.gymSetLogs.push({ exercise_id: exerciseId, set_number: setNumber, log_date: today });
        showRestTimer();
      }
      renderPesas();
    } catch (e) { console.error(e); toast('No se pudo actualizar la serie'); }
  }

  // ── Temporizador de descanso ───────────────────────────────────────────────
  function showRestTimer() {
    const overlay = document.getElementById('timer-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('visible');

    const duration = 60;
    const countdown = document.getElementById('timer-countdown');
    const circle = document.getElementById('timer-ring-circle');
    const circumference = 2 * Math.PI * 42;
    circle.style.strokeDasharray = circumference;

    Timer.start(duration,
      (remaining, total) => {
        countdown.textContent = remaining;
        circle.style.strokeDashoffset = circumference * (1 - remaining / total);
      },
      () => hideRestTimer()
    );
  }

  function hideRestTimer() {
    const overlay = document.getElementById('timer-overlay');
    overlay.classList.remove('visible');
    overlay.classList.add('hidden');
  }

  function skipTimer() {
    Timer.skip();
    hideRestTimer();
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
    document.getElementById('panel-hoy').classList.toggle('hidden', tab !== 'hoy');
    document.getElementById('panel-entreno').classList.toggle('hidden', tab !== 'entreno');
    document.getElementById('panel-resumen').classList.toggle('hidden', tab !== 'resumen');
    document.getElementById('panel-metricas').classList.toggle('hidden', tab !== 'metricas');
    document.getElementById('panel-metas').classList.toggle('hidden', tab !== 'metas');
    document.getElementById('panel-ajustes').classList.toggle('hidden', tab !== 'ajustes');
    document.querySelectorAll('.tab-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('fab-btn').classList.toggle('hidden', tab === 'hoy' || tab === 'entreno' || tab === 'metricas' || tab === 'ajustes');
    if (tab === 'ajustes') renderAjustes();
  }

  function renderAjustes() {
    const el = document.getElementById('ajustes-mode');
    if (el) el.textContent = DB.mode === 'supabase' ? 'Sincronizado con Supabase' : 'Local (solo este dispositivo)';
    renderProfileCard();
    renderThemeToggle();
  }

  // ── Apariencia: claro / oscuro / sistema ──────────────────────────────────
  const THEME_KEY = 'finanzas_theme';
  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
  }
  function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    const meta = document.getElementById('meta-theme-color');
    if (meta) {
      const isLight = theme === 'light' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
      meta.setAttribute('content', isLight ? '#ffffff' : '#000000');
    }
  }
  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    applyTheme(theme);
    renderThemeToggle();
  }
  function renderThemeToggle() {
    const current = getStoredTheme();
    document.querySelectorAll('#theme-toggle button').forEach((b) => {
      b.classList.toggle('active', b.dataset.themeChoice === current);
    });
  }

  // ── Atajo: gestionar el plan de running desde Ajustes ─────────────────────
  function openRunningManage() {
    switchTab('entreno');
    try { localStorage.setItem(ENTRENO_TYPE_KEY, 'running'); } catch (e) {}
    state.entrenoType = 'running';
    state.runningMode = 'programa';
    state.runningEditing = true;
    renderEntreno();
  }

  function currentEmail() {
    return (state.session && state.session.user && state.session.user.email) || '';
  }

  function renderProfileCard() {
    const name = (state.profile && state.profile.full_name) || '';
    const age = state.profile && state.profile.age;
    const email = currentEmail();
    document.getElementById('profile-name').textContent = name || 'Agregar tu nombre';
    document.getElementById('profile-email').textContent = email;
    document.getElementById('profile-avatar').textContent = (name || email || '?').charAt(0).toUpperCase();
    document.getElementById('profile-age').textContent = age ? `${age} años` : '';
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
    },
    habits: {
      title: 'Hábitos', hint: '', customLabel: 'Tus hábitos diarios',
      builtIn: () => [],
      custom: () => state.habits.map((h) => ({ id: h.id, label: h.name + (h.meta ? ' · ' + h.meta : '') })),
      iconHTML: (item) => letterAvatarHTML(item.label, 18),
      add: () => addHabitPrompt(), del: (id) => DB.deleteHabit(id),
      reload: async () => { await loadHabits(); renderHoy(); },
      addLabel: '+ Agregar hábito',
      confirmMsg: '¿Eliminar este hábito? También se borra su historial y racha.'
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
    document.getElementById('list-sheet-custom-label').textContent = cfg.customLabel || 'Personalizadas';

    const builtIn = cfg.builtIn();
    document.getElementById('list-sheet-builtin-block').classList.toggle('hidden', builtIn.length === 0);
    const builtinEl = document.getElementById('list-sheet-builtin');
    builtinEl.innerHTML = builtIn.map((item) => `
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
    const ok = await confirmDialog(cfg.confirmMsg || '¿Eliminar esta opción? Las transacciones que ya la usan no se modifican.');
    if (!ok) return;
    try {
      await cfg.del(id);
      await cfg.reload();
      renderListSheet();
      toast('Eliminada');
    } catch (e) { console.error(e); toast('No se pudo eliminar'); }
  }

  // ── Perfil ───────────────────────────────────────────────────────────────
  function openProfileSheet() {
    state.profileFormName = (state.profile && state.profile.full_name) || '';
    state.profileFormAge = (state.profile && state.profile.age) ? String(state.profile.age) : '';
    document.getElementById('profile-name-input').value = state.profileFormName;
    document.getElementById('profile-age-input').value = state.profileFormAge;
    document.getElementById('profile-email-readonly').textContent = currentEmail() || 'Sin correo';
    document.getElementById('profile-sheet-overlay').classList.remove('hidden');
  }

  function closeProfileSheet() {
    document.getElementById('profile-sheet-overlay').classList.add('hidden');
  }

  function onProfileNameInput(v) { state.profileFormName = v.slice(0, 60); }
  function onProfileAgeInput(v) {
    const digits = v.replace(/[^\d]/g, '').slice(0, 3);
    state.profileFormAge = digits;
    document.getElementById('profile-age-input').value = digits;
  }

  async function saveProfile() {
    const name = state.profileFormName.trim();
    const ageNum = state.profileFormAge ? Number(state.profileFormAge) : null;
    if (ageNum !== null && (ageNum <= 0 || ageNum >= 130)) {
      toast('Ingresa una edad válida');
      return;
    }
    const btn = document.getElementById('profile-save-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await DB.upsertProfile({ full_name: name || null, age: ageNum });
      await loadProfile();
      renderProfileCard();
      closeProfileSheet();
      toast('Perfil actualizado');
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar el perfil');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar perfil';
    }
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
    openProfileSheet, closeProfileSheet, onProfileNameInput, onProfileAgeInput, saveProfile,
    sendMagicLink, signOut,
    setTheme, openRunningManage, skipTimer
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
