// ── Exportar a Excel ─────────────────────────────────────────────────────────
// Usa SheetJS (cargado por CDN como `XLSX` global). Genera un .xlsx con dos
// hojas: el detalle de transacciones y un resumen mensual.

const Export = (() => {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function categoryLabel(id) {
    const c = (window.CATEGORIES || []).find((x) => x.id === id);
    return c ? c.label : id || '—';
  }

  function transactionsToExcel(transactions) {
    if (!window.XLSX) throw new Error('La librería de Excel no cargó (revisa tu conexión) e intenta de nuevo.');
    if (!transactions || transactions.length === 0) throw new Error('No hay transacciones para exportar todavía.');

    const sorted = [...transactions].sort((a, b) => a.tx_date.localeCompare(b.tx_date));

    // ── Hoja 1: detalle ──────────────────────────────────────────────────
    const detailRows = sorted.map((t) => ({
      'Fecha': t.tx_date,
      'Tipo': t.type === 'ingreso' ? 'Ingreso' : 'Egreso',
      'Categoría': categoryLabel(t.category),
      'Monto (COP)': Number(t.amount) * (t.type === 'egreso' ? -1 : 1),
      'Nota': t.note || ''
    }));
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];

    // ── Hoja 2: resumen mensual ──────────────────────────────────────────
    const byMonth = {};
    sorted.forEach((t) => {
      const key = t.tx_date.slice(0, 7); // YYYY-MM
      byMonth[key] = byMonth[key] || { ingresos: 0, egresos: 0 };
      if (t.type === 'ingreso') byMonth[key].ingresos += Number(t.amount);
      else byMonth[key].egresos += Number(t.amount);
    });
    const summaryRows = Object.keys(byMonth).sort().map((key) => {
      const [y, m] = key.split('-').map(Number);
      const { ingresos, egresos } = byMonth[key];
      return {
        'Mes': `${MESES[m - 1]} ${y}`,
        'Ingresos (COP)': ingresos,
        'Egresos (COP)': egresos,
        'Neto (COP)': ingresos - egresos
      };
    });
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen mensual');
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Transacciones');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `finanzas-${today}.xlsx`);
  }

  return { transactionsToExcel };
})();
