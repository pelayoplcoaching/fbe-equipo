// v0.58: casos del análisis automático que se guardan (analisis en video_revisiones) para comprobar que la app
// (analisisValido, en logica.test) y la base (analisis_valido, en permisos.test) dicen lo mismo. Cada caso es el texto
// JSON tal cual (la base lo recibe así).
const p2 = '[[0,0.5,0.5],[0.1,0.5,0.6]]';
const barra = `"barra":{"p":${p2}}`;
const poseOk = '"pose":{"lado":"izq","reps":[{"t":[0,1],"rodilla":90,"tronco":30}]}';

// Uno de verdad: 3 repeticiones de 900 puntos (el máximo), con su calibración y la pose
function grande() {
  const p = Array.from({ length: 900 }, (_, i) => [Math.round(i * (1 / 30) * 1000) / 1000, 0.5, Math.round((0.3 + 0.25 * (1 - Math.cos(i / 20)) / 2) * 1000) / 1000]);
  const reps = Array.from({ length: 30 }, (_, i) => ({ t: [i, i + 0.4, i + 0.9], dc: 0.5, vm: 0.85, vp: 1.3, rom: 62.5 }));
  const pose = { lado: 'der', reps: Array.from({ length: 30 }, (_, i) => ({ t: [i, i + 0.9], rodilla: 85, cadera: 70, tronco: 40, codo: 95 })) };
  return JSON.stringify({ v: 1, barra: { p }, cal: { cm: 45, px: 92.5, w: 1080, h: 1920 }, reps, pose });
}
// Demasiado grande (más de 64 kB en la base, aunque todo lo demás valga): números largos
function demasiado() {
  const p = Array.from({ length: 900 }, (_, i) => `[${i + 1}.1234567890123,0.12345678901234567,0.12345678901234567]`).join(',');
  const reps = Array.from({ length: 30 }, (_, i) => `{"t":[${i}.12345678901234,${i}.22345678901234,${i}.32345678901234],"dc":0.12345678901234,"vm":0.12345678901234,"vp":0.12345678901234,"rom":12.12345678901234}`).join(',');
  const pose = Array.from({ length: 30 }, (_, i) => `{"t":[${i}.12345678901234,${i}.32345678901234],"rodilla":90.12345678901234,"cadera":90.12345678901234,"tronco":30.12345678901234,"codo":90.12345678901234}`).join(',');
  return `{"v":1,"barra":{"p":[${p}]},"reps":[${reps}],"pose":{"lado":"izq","reps":[${pose}]}}`;
}

export const VALIDOS = [
  `{"v":1,${barra}}`,
  `{"v":1,${poseOk}}`,
  `{"v":1,${barra},"cal":{"cm":45,"px":90,"w":360,"h":640},"reps":[{"t":[0,0.02,0.1],"dc":0.08,"vm":0.52,"vp":0.91,"rom":40.5}],${poseOk}}`,
  `{"v":1,${barra},"cal":{"cm":10,"px":0.5,"w":1,"h":10000},"reps":[{"t":[0,0,0]},{"t":[0,0.05,0.1],"vm":3,"vp":0,"rom":150,"dc":60}]}`,
  `{"v":1,"pose":{"lado":"der","reps":[{"t":[0,0],"codo":180},{"t":[0,2],"rodilla":0}]}}`,
  grande(),
  // (revisión de seguridad) hasta 4 decimales, también escritos con exponente
  `{"v":1,"barra":{"p":[[0,0.1234,0.5],[1.5e-3,0.5,0.5678]]},"cal":{"cm":45.0001,"px":90.25,"w":360,"h":640},"reps":[{"t":[0,0.0015,0.1],"vm":2.9999,"rom":1.5e2}]}`,
];

export const MALFORMADOS = [
  '[1]', '"x"', '5', 'null', '{}', 'true',
  `{"v":2,${barra}}`,
  `{"v":"1",${barra}}`,
  '{"v":1}',
  '{"v":1,"barra":{"p":[[0,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":"x"}}',
  '{"v":1,"barra":[1,2]}',
  '{"v":1,"barra":{"p":[[0,0.5],[0.1,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[0,"a",0.5],[0.1,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[0,1.5,0.5],[0.1,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[0,0.5,-0.1],[0.1,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[0.1,0.5,0.5],[0.1,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[-1,0.5,0.5],[0.1,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[0,0.5,0.5],[3601,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[0,0.5,0.5],[0.1,0.5,0.5]],"q":1}}',
  `{"v":1,${barra},"x":1}`,
  `{"v":1,"barra":{"p":[${Array.from({ length: 901 }, (_, i) => `[${i},0.5,0.5]`).join(',')}]}}`,
  `{"v":1,${barra},"cal":{"cm":45,"px":90,"w":360}}`,
  `{"v":1,${barra},"cal":{"cm":9,"px":90,"w":360,"h":640}}`,
  `{"v":1,${barra},"cal":{"cm":45,"px":0,"w":360,"h":640}}`,
  `{"v":1,${barra},"cal":{"cm":45,"px":90,"w":360.5,"h":640}}`,
  `{"v":1,${barra},"cal":{"cm":"45","px":90,"w":360,"h":640}}`,
  `{"v":1,${barra},"cal":[45,90,360,640]}`,
  `{"v":1,${poseOk},"reps":[{"t":[0,1,2]}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,2,1]}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1,2],"vm":3.5}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1,2],"rom":151}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1,2],"dc":-1}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1]}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1,2]},{"t":[1,1,3]}]}`,
  `{"v":1,${barra},"reps":[${Array.from({ length: 31 }, (_, i) => `{"t":[${i},${i + 0.5},${i + 0.9}]}`).join(',')}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1,2],"nota":"x"}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1,2],"vm":"0.5"}]}`,
  `{"v":1,${barra},"reps":[]}`,
  `{"v":1,${barra},"reps":{"t":[0,1,2]}}`,
  '{"v":1,"pose":{"lado":"centro","reps":[{"t":[0,1],"rodilla":90}]}}',
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":[0,1],"rodilla":181}]}}',
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":[0,1]}]}}',
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":[2,1],"rodilla":90}]}}',
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":[0,1],"rodilla":90}],"puntos":[[0.5,0.5,1]]}}',
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":["x",1],"rodilla":90}]}}',
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":[1,2],"rodilla":90},{"t":[0,1],"rodilla":90}]}}',
  '{"v":1,"pose":{"lado":1,"reps":[{"t":[0,1],"rodilla":90}]}}',
  '{"v":1,"pose":{"lado":"izq"}}',
  demasiado(),
  // (revisión de seguridad) más de 4 decimales o exponentes extremos: ni la base ni la app (1e-400 la app ya lo lee como 0:
  // ese, solo en la base, en permisos.test)
  '{"v":1,"barra":{"p":[[0,0.12345,0.5],[0.1,0.5,0.5]]}}',
  '{"v":1,"barra":{"p":[[1e-7,0.5,0.5],[0.1,0.5,0.5]]}}',
  `{"v":1,${barra},"cal":{"cm":45.00001,"px":90,"w":360,"h":640}}`,
  `{"v":1,${barra},"cal":{"cm":45,"px":90.123456789,"w":360,"h":640}}`,
  `{"v":1,${barra},"reps":[{"t":[0,1,2],"vm":5e-7}]}`,
  `{"v":1,${barra},"reps":[{"t":[0,1.00001,2]}]}`,
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":[0,1],"rodilla":90.00001}]}}',
  '{"v":1,"pose":{"lado":"izq","reps":[{"t":[0,1],"tronco":1E-10}]}}',
  '{"v":1.00001,"pose":{"lado":"izq","reps":[{"t":[0,1],"rodilla":90}]}}',
];
