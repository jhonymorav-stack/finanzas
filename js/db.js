// ── Capa de datos ────────────────────────────────────────────────────────────
// Si config.js tiene SUPABASE_URL + SUPABASE_ANON_KEY, usa Supabase (con login
// por magic link y sincronizado entre dispositivos). Si no, cae a localStorage
// para que puedas ver la app funcionando de inmediato mientras configuras la cuenta.

const DB = (() => {
  const cfg = window.FINANZAS_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const TX_KEY = 'finanzas_transactions_v1';
  const GOALS_KEY = 'finanzas_goals_v1';
  const CATEGORIES_KEY = 'finanzas_custom_categories_v1';
  const ACCOUNTS_KEY = 'finanzas_custom_accounts_v1';
  const BUDGETS_KEY = 'finanzas_budgets_v1';
  const PROFILE_KEY = 'finanzas_profile_v1';
  const HABITS_KEY = 'finanzas_habits_v1';
  const HABIT_LOGS_KEY = 'finanzas_habit_logs_v1';
  const RUNNING_BLOCKS_KEY = 'finanzas_running_blocks_v1';
  const RUNNING_COMPLETIONS_KEY = 'finanzas_running_completions_v1';
  const FREE_RUNS_KEY = 'finanzas_free_runs_v1';
  const GYM_EXERCISES_KEY = 'finanzas_gym_exercises_v1';
  const GYM_SET_LOGS_KEY = 'finanzas_gym_set_logs_v1';

  let client = null;
  if (configured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  // ── Modo local (sin backend) ──────────────────────────────────────────────
  function localList(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function localSave(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }
  function localGetObj(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  }
  function localSaveObj(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  return {
    isConfigured: configured,
    mode: configured ? 'supabase' : 'local',

    // ── Auth ─────────────────────────────────────────────────────────────
    async getSession() {
      if (!configured) return { user: { email: cfg.OWNER_EMAIL || 'local' } };
      const { data } = await client.auth.getSession();
      return data.session;
    },

    onAuthChange(cb) {
      if (!configured) { cb({ user: { email: cfg.OWNER_EMAIL || 'local' } }); return; }
      client.auth.onAuthStateChange((_event, session) => cb(session));
    },

    async signInWithMagicLink(email) {
      if (!configured) throw new Error('Supabase no está configurado todavía.');
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
    },

    async signOut() {
      if (!configured) return;
      await client.auth.signOut();
    },

    // ── Transacciones ────────────────────────────────────────────────────
    async listTransactions() {
      if (!configured) {
        return localList(TX_KEY).sort((a, b) => b.tx_date.localeCompare(a.tx_date) || b.created_at.localeCompare(a.created_at));
      }
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .order('tx_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async addTransaction(tx) {
      if (!configured) {
        const list = localList(TX_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...tx };
        list.push(row);
        localSave(TX_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client
        .from('transactions')
        .insert({ ...tx, user_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateTransaction(id, patch) {
      if (!configured) {
        const list = localList(TX_KEY);
        const idx = list.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('Transacción no encontrada');
        list[idx] = { ...list[idx], ...patch };
        localSave(TX_KEY, list);
        return list[idx];
      }
      const { data, error } = await client
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async deleteTransaction(id) {
      if (!configured) {
        localSave(TX_KEY, localList(TX_KEY).filter((t) => t.id !== id));
        return;
      }
      const { error } = await client.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },

    // ── Metas (ahorro / reducción de gastos / inversión) ───────────────────
    async listGoals() {
      if (!configured) {
        return localList(GOALS_KEY).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      }
      const { data, error } = await client
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async addGoal(goal) {
      if (!configured) {
        const list = localList(GOALS_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), current_amount: 0, ...goal };
        list.push(row);
        localSave(GOALS_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client
        .from('goals')
        .insert({ ...goal, user_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateGoal(id, patch) {
      if (!configured) {
        const list = localList(GOALS_KEY);
        const idx = list.findIndex((g) => g.id === id);
        if (idx === -1) throw new Error('Meta no encontrada');
        list[idx] = { ...list[idx], ...patch };
        localSave(GOALS_KEY, list);
        return list[idx];
      }
      const { data, error } = await client
        .from('goals')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async deleteGoal(id) {
      if (!configured) {
        localSave(GOALS_KEY, localList(GOALS_KEY).filter((g) => g.id !== id));
        return;
      }
      const { error } = await client.from('goals').delete().eq('id', id);
      if (error) throw error;
    },

    // ── Categorías personalizadas ───────────────────────────────────────────
    async listCategories() {
      if (!configured) return localList(CATEGORIES_KEY);
      const { data, error } = await client.from('categories').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },

    async addCategory(cat) {
      if (!configured) {
        const list = localList(CATEGORIES_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...cat };
        list.push(row);
        localSave(CATEGORIES_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client.from('categories').insert({ ...cat, user_id }).select().single();
      if (error) throw error;
      return data;
    },

    async deleteCategory(id) {
      if (!configured) { localSave(CATEGORIES_KEY, localList(CATEGORIES_KEY).filter((c) => c.id !== id)); return; }
      const { error } = await client.from('categories').delete().eq('id', id);
      if (error) throw error;
    },

    // ── Cuentas / medios de pago personalizados ─────────────────────────────
    async listAccounts() {
      if (!configured) return localList(ACCOUNTS_KEY);
      const { data, error } = await client.from('accounts').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },

    async addAccount(acc) {
      if (!configured) {
        const list = localList(ACCOUNTS_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...acc };
        list.push(row);
        localSave(ACCOUNTS_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client.from('accounts').insert({ ...acc, user_id }).select().single();
      if (error) throw error;
      return data;
    },

    async deleteAccount(id) {
      if (!configured) { localSave(ACCOUNTS_KEY, localList(ACCOUNTS_KEY).filter((a) => a.id !== id)); return; }
      const { error } = await client.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },

    // ── Presupuestos mensuales por categoría ────────────────────────────────
    async listBudgets() {
      if (!configured) return localList(BUDGETS_KEY);
      const { data, error } = await client.from('budgets').select('*');
      if (error) throw error;
      return data;
    },

    async setBudget(category, amount) {
      if (!configured) {
        const list = localList(BUDGETS_KEY);
        const idx = list.findIndex((b) => b.category === category);
        if (idx >= 0) list[idx].monthly_amount = amount;
        else list.push({ id: crypto.randomUUID(), category, monthly_amount: amount });
        localSave(BUDGETS_KEY, list);
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { error } = await client
        .from('budgets')
        .upsert({ user_id, category, monthly_amount: amount }, { onConflict: 'user_id,category' });
      if (error) throw error;
    },

    async deleteBudget(category) {
      if (!configured) { localSave(BUDGETS_KEY, localList(BUDGETS_KEY).filter((b) => b.category !== category)); return; }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { error } = await client.from('budgets').delete().eq('user_id', user_id).eq('category', category);
      if (error) throw error;
    },

    // ── Fotos de recibos ─────────────────────────────────────────────────────
    // Modo local: no hay Storage real, así que el "path" ES el dataURL en sí.
    // Modo Supabase: se sube al bucket privado 'receipts' y se guarda solo la ruta.
    async uploadReceipt(dataUrl, txId) {
      if (!configured) return dataUrl;
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${user_id}/${txId}.jpg`;
      const { error } = await client.storage.from('receipts').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      return path;
    },

    async getReceiptSrc(path) {
      if (!path) return null;
      if (!configured) return path;
      const { data, error } = await client.storage.from('receipts').createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },

    async deleteReceipt(path) {
      if (!path || !configured) return;
      await client.storage.from('receipts').remove([path]).catch(() => {});
    },

    // ── Perfil ───────────────────────────────────────────────────────────────
    async getProfile() {
      if (!configured) return localGetObj(PROFILE_KEY);
      const { data: sessionData } = await client.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return {};
      const { data, error } = await client.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (error) throw error;
      return data || {};
    },

    async upsertProfile(patch) {
      if (!configured) {
        localSaveObj(PROFILE_KEY, { ...localGetObj(PROFILE_KEY), ...patch });
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      const uid = sessionData.session?.user?.id;
      const { error } = await client
        .from('profiles')
        .upsert({ id: uid, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },

    // ── Hábitos diarios ──────────────────────────────────────────────────────
    async listHabits() {
      if (!configured) {
        return localList(HABITS_KEY).filter((h) => h.active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
      const { data, error } = await client.from('habits').select('*').eq('active', true).order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },

    async addHabit(habit) {
      if (!configured) {
        const list = localList(HABITS_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), active: true, sort_order: list.length, ...habit };
        list.push(row);
        localSave(HABITS_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client.from('habits').insert({ ...habit, user_id }).select().single();
      if (error) throw error;
      return data;
    },

    async deleteHabit(id) {
      if (!configured) {
        localSave(HABITS_KEY, localList(HABITS_KEY).filter((h) => h.id !== id));
        localSave(HABIT_LOGS_KEY, localList(HABIT_LOGS_KEY).filter((l) => l.habit_id !== id));
        return;
      }
      const { error } = await client.from('habits').delete().eq('id', id);
      if (error) throw error;
    },

    // sinceDate: 'YYYY-MM-DD' — trae los registros desde esa fecha (para racha + heatmap).
    async listHabitLogs(sinceDate) {
      if (!configured) {
        return localList(HABIT_LOGS_KEY).filter((l) => !sinceDate || l.log_date >= sinceDate);
      }
      let q = client.from('habit_logs').select('*');
      if (sinceDate) q = q.gte('log_date', sinceDate);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async logHabit(habitId, dateISO) {
      if (!configured) {
        const list = localList(HABIT_LOGS_KEY);
        if (!list.some((l) => l.habit_id === habitId && l.log_date === dateISO)) {
          list.push({ id: crypto.randomUUID(), habit_id: habitId, log_date: dateISO });
          localSave(HABIT_LOGS_KEY, list);
        }
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { error } = await client.from('habit_logs').upsert(
        { habit_id: habitId, log_date: dateISO, user_id },
        { onConflict: 'habit_id,log_date', ignoreDuplicates: true }
      );
      if (error) throw error;
    },

    async unlogHabit(habitId, dateISO) {
      if (!configured) {
        localSave(HABIT_LOGS_KEY, localList(HABIT_LOGS_KEY).filter((l) => !(l.habit_id === habitId && l.log_date === dateISO)));
        return;
      }
      const { error } = await client.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', dateISO);
      if (error) throw error;
    },

    // ── Running: programa de intervalos ──────────────────────────────────────
    async listRunningBlocks() {
      if (!configured) {
        return localList(RUNNING_BLOCKS_KEY).sort((a, b) => (a.day_number - b.day_number) || (a.sort_order - b.sort_order));
      }
      const { data, error } = await client.from('running_blocks').select('*').order('day_number', { ascending: true }).order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },

    async addRunningBlock(block) {
      if (!configured) {
        const list = localList(RUNNING_BLOCKS_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), sort_order: list.filter((b) => b.day_number === block.day_number).length, ...block };
        list.push(row);
        localSave(RUNNING_BLOCKS_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client.from('running_blocks').insert({ ...block, user_id }).select().single();
      if (error) throw error;
      return data;
    },

    async deleteRunningBlock(id) {
      if (!configured) {
        localSave(RUNNING_BLOCKS_KEY, localList(RUNNING_BLOCKS_KEY).filter((b) => b.id !== id));
        localSave(RUNNING_COMPLETIONS_KEY, localList(RUNNING_COMPLETIONS_KEY).filter((c) => c.block_id !== id));
        return;
      }
      const { error } = await client.from('running_blocks').delete().eq('id', id);
      if (error) throw error;
    },

    async listRunningCompletions(sinceDate) {
      if (!configured) {
        return localList(RUNNING_COMPLETIONS_KEY).filter((c) => !sinceDate || c.done_date >= sinceDate);
      }
      let q = client.from('running_completions').select('*');
      if (sinceDate) q = q.gte('done_date', sinceDate);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async markBlockDone(blockId, dateISO) {
      if (!configured) {
        const list = localList(RUNNING_COMPLETIONS_KEY);
        if (!list.some((c) => c.block_id === blockId && c.done_date === dateISO)) {
          list.push({ id: crypto.randomUUID(), block_id: blockId, done_date: dateISO });
          localSave(RUNNING_COMPLETIONS_KEY, list);
        }
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { error } = await client.from('running_completions').upsert(
        { block_id: blockId, done_date: dateISO, user_id },
        { onConflict: 'block_id,done_date', ignoreDuplicates: true }
      );
      if (error) throw error;
    },

    async unmarkBlockDone(blockId, dateISO) {
      if (!configured) {
        localSave(RUNNING_COMPLETIONS_KEY, localList(RUNNING_COMPLETIONS_KEY).filter((c) => !(c.block_id === blockId && c.done_date === dateISO)));
        return;
      }
      const { error } = await client.from('running_completions').delete().eq('block_id', blockId).eq('done_date', dateISO);
      if (error) throw error;
    },

    // ── Running: carreras libres ──────────────────────────────────────────────
    async listFreeRuns() {
      if (!configured) {
        return localList(FREE_RUNS_KEY).sort((a, b) => b.run_date.localeCompare(a.run_date) || (b.created_at || '').localeCompare(a.created_at || ''));
      }
      const { data, error } = await client.from('running_free_runs').select('*').order('run_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async addFreeRun(run) {
      if (!configured) {
        const list = localList(FREE_RUNS_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...run };
        list.push(row);
        localSave(FREE_RUNS_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client.from('running_free_runs').insert({ ...run, user_id }).select().single();
      if (error) throw error;
      return data;
    },

    // ── Pesas ─────────────────────────────────────────────────────────────────
    async listGymExercises() {
      if (!configured) {
        return localList(GYM_EXERCISES_KEY).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
      const { data, error } = await client.from('gym_exercises').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },

    async addGymExercise(ex) {
      if (!configured) {
        const list = localList(GYM_EXERCISES_KEY);
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), sort_order: list.length, ...ex };
        list.push(row);
        localSave(GYM_EXERCISES_KEY, list);
        return row;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { data, error } = await client.from('gym_exercises').insert({ ...ex, user_id }).select().single();
      if (error) throw error;
      return data;
    },

    async deleteGymExercise(id) {
      if (!configured) {
        localSave(GYM_EXERCISES_KEY, localList(GYM_EXERCISES_KEY).filter((e) => e.id !== id));
        localSave(GYM_SET_LOGS_KEY, localList(GYM_SET_LOGS_KEY).filter((l) => l.exercise_id !== id));
        return;
      }
      const { error } = await client.from('gym_exercises').delete().eq('id', id);
      if (error) throw error;
    },

    async listGymSetLogs(sinceDate) {
      if (!configured) {
        return localList(GYM_SET_LOGS_KEY).filter((l) => !sinceDate || l.log_date >= sinceDate);
      }
      let q = client.from('gym_set_logs').select('*');
      if (sinceDate) q = q.gte('log_date', sinceDate);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async markSetDone(exerciseId, setNumber, dateISO) {
      if (!configured) {
        const list = localList(GYM_SET_LOGS_KEY);
        if (!list.some((l) => l.exercise_id === exerciseId && l.set_number === setNumber && l.log_date === dateISO)) {
          list.push({ id: crypto.randomUUID(), exercise_id: exerciseId, set_number: setNumber, log_date: dateISO });
          localSave(GYM_SET_LOGS_KEY, list);
        }
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      const user_id = sessionData.session?.user?.id;
      const { error } = await client.from('gym_set_logs').upsert(
        { exercise_id: exerciseId, set_number: setNumber, log_date: dateISO, user_id },
        { onConflict: 'exercise_id,set_number,log_date', ignoreDuplicates: true }
      );
      if (error) throw error;
    },

    async unmarkSetDone(exerciseId, setNumber, dateISO) {
      if (!configured) {
        localSave(GYM_SET_LOGS_KEY, localList(GYM_SET_LOGS_KEY).filter((l) => !(l.exercise_id === exerciseId && l.set_number === setNumber && l.log_date === dateISO)));
        return;
      }
      const { error } = await client.from('gym_set_logs').delete().eq('exercise_id', exerciseId).eq('set_number', setNumber).eq('log_date', dateISO);
      if (error) throw error;
    }
  };
})();
