// ── Cuentas / medios de pago ─────────────────────────────────────────────────
// Predeterminadas (no se pueden borrar). El usuario puede agregar las suyas
// desde el selector de cuenta o desde Ajustes → Cuentas (esas sí son borrables).

window.ACCOUNTS = [
  { id: 'cuenta_bancaria', label: 'Cuenta bancaria', icon: '🏦' },
  { id: 'efectivo', label: 'Efectivo', icon: '💵' },
  { id: 'tarjeta', label: 'Tarjeta', icon: '💳' },
  { id: 'tarjeta_credito', label: 'Tarjeta de crédito', icon: '💳' },
  { id: 'otro', label: 'Otro', icon: '📎' }
];
