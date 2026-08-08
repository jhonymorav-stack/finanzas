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
    }
  };
})();
