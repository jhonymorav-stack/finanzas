// ── Capa de datos ────────────────────────────────────────────────────────────
// Si config.js tiene SUPABASE_URL + SUPABASE_ANON_KEY, usa Supabase (con login
// por magic link y sincronizado entre dispositivos). Si no, cae a localStorage
// para que puedas ver la app funcionando de inmediato mientras configuras la cuenta.

const DB = (() => {
  const cfg = window.FINANZAS_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const LOCAL_KEY = 'finanzas_transactions_v1';

  let client = null;
  if (configured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  // ── Modo local (sin backend) ──────────────────────────────────────────────
  function localList() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; }
    catch { return []; }
  }
  function localSave(list) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
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
        return localList().sort((a, b) => b.tx_date.localeCompare(a.tx_date) || b.created_at.localeCompare(a.created_at));
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
        const list = localList();
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...tx };
        list.push(row);
        localSave(list);
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
        const list = localList();
        const idx = list.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('Transacción no encontrada');
        list[idx] = { ...list[idx], ...patch };
        localSave(list);
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
        localSave(localList().filter((t) => t.id !== id));
        return;
      }
      const { error } = await client.from('transactions').delete().eq('id', id);
      if (error) throw error;
    }
  };
})();
