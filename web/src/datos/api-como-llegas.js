// FBE Esencial (v0.258): ¿la base admite «¿Cómo llegas hoy?» de un toque (migración 110)? Sin ella, quien va por su
// cuenta sigue con las tres preguntas de siempre. Lo que contesta se guarda con lo de siempre (api.guardarPreparacion).
const hay = new Map();
export const falta110 = (e) => {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''} ${e?.code || ''}`;
  return /preparacion_un_toque/.test(m) && /schema cache|does not exist|no existe|PGRST202|42883|function|funci\u00f3n/i.test(m);
};
export async function hay110(b) {
  if (hay.has(b)) return hay.get(b);
  try {
    const si = (await b.rpc('preparacion_un_toque', {})) === true;
    hay.set(b, si);
    return si;
  } catch (e) {
    // si falta la función, no la tiene; con otro fallo (sin red), de momento no, y se vuelve a mirar la próxima vez
    if (falta110(e)) hay.set(b, false);
    return false;
  }
}
