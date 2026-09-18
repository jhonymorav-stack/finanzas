// ── Frase del día + versículo ───────────────────────────────────────────────
// Rotan solo (por día del año), sin depender de internet ni de Supabase.
// Para editarlas, agrega o cambia líneas en estas dos listas.

window.DAILY_QUOTES = [
  'Hoy no necesitas motivación, necesitas constancia.',
  'No tienes que ser perfecto, solo tienes que aparecer.',
  'Lo pequeño repetido todos los días vence a lo grande hecho una vez.',
  'La disciplina pesa gramos; el arrepentimiento pesa toneladas.',
  'Un día a la vez — esa es toda la estrategia.',
  'Nadie ve el proceso, todos ven el resultado. Confía en el proceso.',
  'Tu única competencia es quien eras ayer.',
  'Empieza antes de sentirte listo.',
  'La racha no se rompe por un mal día, se rompe por rendirse.',
  'Progreso, no perfección.',
  'Hazlo mal, pero hazlo hoy.',
  'Cada hábito es un voto por la persona que quieres ser.',
  'No cuentes los días, haz que los días cuenten.',
  'El descanso también es parte del entrenamiento.',
  'Lo que se mide, mejora.',
  'La motivación te trae aquí; el hábito te mantiene aquí.',
  'Ordena tu día antes de que el día te ordene a ti.',
  'Hoy es un buen día para no rendirte.',
  'Pequeños pasos, en la dirección correcta, todos los días.',
  'Tu futuro te está mirando — dale algo bueno que ver.'
];

window.DAILY_VERSES = [
  { ref: 'Filipenses 4:13', text: 'Todo lo puedo en Cristo que me fortalece.' },
  { ref: 'Salmos 23:1', text: 'El Señor es mi pastor, nada me faltará.' },
  { ref: 'Proverbios 3:5-6', text: 'Confía en el Señor de todo corazón y no te apoyes en tu propia prudencia.' },
  { ref: 'Isaías 41:10', text: 'No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios.' },
  { ref: 'Josué 1:9', text: 'Esfuérzate y sé valiente; no temas ni desmayes.' },
  { ref: 'Salmos 118:24', text: 'Este es el día que hizo el Señor; nos gozaremos y alegraremos en él.' },
  { ref: 'Jeremías 29:11', text: 'Yo sé los pensamientos que tengo acerca de ustedes, pensamientos de paz y no de mal.' },
  { ref: 'Salmos 37:5', text: 'Encomienda al Señor tu camino, confía en él y él hará.' },
  { ref: 'Romanos 8:28', text: 'A los que aman a Dios, todas las cosas les ayudan a bien.' },
  { ref: 'Gálatas 6:9', text: 'No nos cansemos de hacer el bien, que a su tiempo segaremos.' },
  { ref: 'Salmos 46:1', text: 'Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.' },
  { ref: 'Mateo 6:34', text: 'No te angusties por el mañana; cada día trae su propio afán.' },
  { ref: 'Proverbios 16:3', text: 'Encomienda al Señor tus obras y tus pensamientos serán afirmados.' },
  { ref: 'Salmos 27:1', text: 'El Señor es mi luz y mi salvación, ¿de quién temeré?' },
  { ref: 'Filipenses 4:6-7', text: 'Por nada estéis afanosos; y la paz de Dios guardará vuestros corazones.' },
  { ref: '1 Corintios 16:14', text: 'Todas vuestras cosas sean hechas con amor.' },
  { ref: 'Salmos 90:12', text: 'Enséñanos a contar nuestros días, para que traigamos al corazón sabiduría.' },
  { ref: 'Isaías 40:31', text: 'Los que esperan al Señor tendrán nuevas fuerzas; volarán como águilas.' },
  { ref: 'Colosenses 3:23', text: 'Todo lo que hagáis, hacedlo de corazón, como para el Señor.' },
  { ref: 'Salmos 143:8', text: 'Hazme oír por la mañana tu misericordia, porque en ti he confiado.' }
];

// dateISO: 'YYYY-MM-DD'. Determinista — la misma fecha siempre da la misma frase/versículo.
function dayOfYear(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
window.quoteForDate = function (dateISO) {
  const list = window.DAILY_QUOTES;
  return list[dayOfYear(dateISO) % list.length];
};
window.verseForDate = function (dateISO) {
  const list = window.DAILY_VERSES;
  return list[dayOfYear(dateISO) % list.length];
};
