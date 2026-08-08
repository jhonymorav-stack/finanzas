// ── Tasa de cambio COP → USD ─────────────────────────────────────────────────
// API gratuita sin key. Se cachea 1h en localStorage; si falla, se usa el
// último valor conocido (o un estimado) y se oculta el equivalente en USD
// solo si nunca hubo un valor disponible.

const Rates = (() => {
  const KEY = 'finanzas_rate_cop_usd_v1';
  const TTL = 60 * 60 * 1000; // 1h

  function cached() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }

  async function refresh() {
    const c = cached();
    if (c && Date.now() - c.fetchedAt < TTL) return c;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
      clearTimeout(timeout);
      const json = await res.json();
      const copPerUsd = json?.rates?.COP;
      if (!copPerUsd) throw new Error('sin tasa');
      const data = { rate: 1 / copPerUsd, fetchedAt: Date.now() }; // USD por 1 COP
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    } catch {
      return c || null; // sin conexión: usa lo último conocido, o null
    }
  }

  function copToUsd(cop, data) {
    if (!data) return null;
    return cop * data.rate;
  }

  function hoursAgoLabel(fetchedAt) {
    const mins = Math.round((Date.now() - fetchedAt) / 60000);
    if (mins < 1) return 'hace instantes';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.round(mins / 60);
    return `hace ${hrs}h`;
  }

  return { refresh, copToUsd, hoursAgoLabel };
})();
