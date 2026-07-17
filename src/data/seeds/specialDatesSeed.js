/**
 * src/data/seeds/specialDatesSeed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fechas especiales del calendario peruano con su factor de demanda.
 *
 * El factor multiplica la proyección base del día: un domingo normal que
 * proyecta 30 pollos, en Día de la Madre (factor 2.5) proyecta 75.
 *
 * Dos tipos de regla:
 *   - fija:   { mes, dia }                     → ej. Fiestas Patrias 28/07
 *   - movil:  { mes, diaSemana, ordinal }      → ej. 2.º domingo de mayo
 *     (diaSemana: 0=domingo … 6=sábado; ordinal: 1=primero, 2=segundo, 3=tercero)
 *
 * `resolverFechaEspecial(fecha)` devuelve la regla que aplica ese día, o null.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SPECIAL_DATES = [
  { id: 'DIA_MADRE',   nombre: 'Día de la Madre',            tipo: 'movil', mes: 5,  diaSemana: 0, ordinal: 2, factor: 2.5,
    nota: 'El día de mayor demanda del año en pollerías junto con el Día del Pollo a la Brasa.' },
  { id: 'DIA_PADRE',   nombre: 'Día del Padre',              tipo: 'movil', mes: 6,  diaSemana: 0, ordinal: 3, factor: 2.0 },
  { id: 'DIA_POLLO',   nombre: 'Día del Pollo a la Brasa',   tipo: 'movil', mes: 7,  diaSemana: 0, ordinal: 3, factor: 3.0,
    nota: 'Tercer domingo de julio — feriado gastronómico oficial del Perú desde 2010.' },
  { id: 'FIESTAS_28',  nombre: 'Fiestas Patrias (28 julio)', tipo: 'fija',  mes: 7,  dia: 28, factor: 2.0 },
  { id: 'FIESTAS_29',  nombre: 'Fiestas Patrias (29 julio)', tipo: 'fija',  mes: 7,  dia: 29, factor: 1.8 },
  { id: 'SAN_VALENTIN', nombre: 'San Valentín',              tipo: 'fija',  mes: 2,  dia: 14, factor: 1.5 },
  { id: 'NAVIDAD_24',  nombre: 'Nochebuena',                 tipo: 'fija',  mes: 12, dia: 24, factor: 1.6 },
  { id: 'ANO_NUEVO_31', nombre: 'Fin de año',                tipo: 'fija',  mes: 12, dia: 31, factor: 1.6 },
]

/**
 * resolverFechaEspecial — ¿La fecha dada es especial? Devuelve la regla o null.
 * @param {Date|string} fecha  Date o 'YYYY-MM-DD'
 */
export function resolverFechaEspecial(fecha) {
  // 'YYYY-MM-DD' se parsea a mano: new Date(str) lo interpretaría como UTC y
  // en Lima (UTC-5) retrocedería un día — el mismo bug de fechas del CLAUDE.md.
  let y, m, d
  if (typeof fecha === 'string') {
    const [ys, ms, ds] = fecha.split('-').map(Number)
    if (!ys || !ms || !ds) return null
    y = ys; m = ms; d = ds
  } else {
    y = fecha.getFullYear(); m = fecha.getMonth() + 1; d = fecha.getDate()
  }
  const diaSemana = new Date(y, m - 1, d).getDay()
  const ordinal = Math.ceil(d / 7) // 1..5: qué n.º de ese día de semana es en el mes

  for (const regla of SPECIAL_DATES) {
    if (regla.tipo === 'fija' && regla.mes === m && regla.dia === d) return regla
    if (regla.tipo === 'movil' && regla.mes === m && regla.diaSemana === diaSemana && regla.ordinal === ordinal) return regla
  }
  return null
}

export default SPECIAL_DATES
