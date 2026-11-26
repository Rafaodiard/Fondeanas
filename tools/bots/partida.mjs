// Partida de prueba con bots: levanta el servidor, entra como espectador, pone bots y mira qué hacen.
// Uso: node tools/bots/partida.mjs [total=12] [dificultad=normal] [segundos=420]
// Revisa que salten del bus, caigan, junten loot, abran cofres, se peleen, construyan, que ninguno se quede trabado
// y que la partida termine con un ganador.
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import WebSocket from 'ws';
import { BOT_TOTALES, BOT_DIFICULTADES, totalValido, dificultadValida } from '../../public/js/opcionesBots.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const total = Number(process.argv[2]) || 12, dif = process.argv[3] || 'normal', maxSeg = Number(process.argv[4]) || 420;
if (!totalValido(total) || total === 0 || !dificultadValida(dif)) {
  console.error(`total tiene que ser uno de ${BOT_TOTALES.filter(Boolean).join(', ')} y la dificultad una de ${Object.keys(BOT_DIFICULTADES).join(', ')}`);
  process.exit(1);
}
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
const srv = spawn(process.execPath, ['server.js'], { cwd: raiz, env: { ...process.env, PORT, SF_BOTS_HASTA_EL_FINAL: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
// SF_BOTS_DEBUG=1 muestra qué hace cada bot cada 10 s
srv.stdout.on('data', (d) => { if (process.env.SF_BOTS_DEBUG) process.stdout.write(String(d).split('\n').filter((l) => l.startsWith('[bot]')).map((l) => l + '\n').join('')); });
let errores = '';
srv.stderr.on('data', (d) => { errores += d; process.stderr.write(d); });
await new Promise((ok) => srv.stdout.on('data', (d) => { if (String(d).includes('Salto Final')) ok(); }));

const ws = new WebSocket(`ws://localhost:${PORT}`);
await new Promise((ok) => ws.on('open', ok));
ws.send(JSON.stringify({ t: 'create', name: 'Espectador' }));
const send = (m) => ws.send(JSON.stringify(m));
const st = { saltos: 0, aterrizan: new Set(), agarra: 0, cofres: 0, tiros: 0, golpes: 0, construye: 0, muertes: [], ganador: null, bots: new Map(), mios: null };
const t0 = Date.now();
let fin = null, miId = null;
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'welcome') { miId = m.id; send({ t: 'bots', total, dif }); }
  if (m.t === 'room' && m.room.phase === 'lobby' && m.room.bots.total === total && !st.empezo) { st.empezo = true; send({ t: 'start' }); }
  if (m.t === 'matchStart') {
    for (const p of m.room.players) if (p.bot) st.bots.set(p.id, { name: p.name, pos: null, hist: [], vivo: true });
    console.log(`partida con ${st.bots.size} bots (${dif})`);
  }
  if (m.t === 'jumped' || m.t === 'forceJump') st.saltos++;
  if (m.t === 'state') {
    const b = st.bots.get(m.id);
    if (!b) return;
    b.pos = m.p; b.s = m.s;
    if (m.s === 'ground') st.aterrizan.add(m.id);
    const t = Date.now();
    if (!b.hist.length || t - b.hist[b.hist.length - 1][0] > 1000) b.hist.push([t, m.p, m.s]);
  }
  if (m.t === 'itemsDel') st.agarra += m.ids.length;
  if (m.t === 'chestOpen') st.cofres++;
  if (m.t === 'shot') st.tiros++;
  if (m.t === 'swing') st.golpes++;
  if (m.t === 'structAdd') st.construye++;
  if (m.t === 'death') {
    const b = st.bots.get(m.id);
    if (b) b.vivo = false;
    st.muertes.push([((Date.now() - t0) / 1000).toFixed(0), st.bots.get(m.id)?.name || 'yo', m.by ? st.bots.get(m.by)?.name || 'yo' : '-', m.cause]);
  }
  if (m.t === 'matchEnd') { st.ganador = m.winner ? st.bots.get(m.winner)?.name : null; fin = Date.now(); }
});
// el espectador se queda quieto lejos, en el agua, para no meterse en la pelea
const lejos = setInterval(() => send({ t: 'state', p: [1100, -1.3, 1100], r: 0, s: 'ground' }), 500);

const trabados = new Map();
const rev = setInterval(() => {
  const seg = (Date.now() - t0) / 1000;
  const vivos = [...st.bots.values()].filter((b) => b.vivo).length;
  // trabado: vivo en el piso y se movió menos de 2 m en los últimos 25 s
  for (const [id, b] of st.bots) {
    if (!b.vivo || b.hist.length < 26) continue;
    const a = b.hist[b.hist.length - 26], z = b.hist[b.hist.length - 1];
    if (a[2] !== 'ground' || z[2] !== 'ground') continue;
    const d = Math.hypot(a[1][0] - z[1][0], a[1][2] - z[1][2]);
    if (d < 2) trabados.set(id, `${b.name} en (${z[1].map((v) => v.toFixed(1)).join(', ')})`);
  }
  console.log(`${seg.toFixed(0)} s: vivos ${vivos}, saltaron ${st.saltos}, en el piso ${st.aterrizan.size}, loot ${st.agarra}, cofres ${st.cofres}, tiros ${st.tiros}, picadas ${st.golpes}, construcciones ${st.construye}, muertes ${st.muertes.length}`);
  if (fin || seg > maxSeg) terminar();
}, 15000);

function terminar() {
  clearInterval(rev); clearInterval(lejos);
  console.log('muertes [seg, quién, por quién, causa]:');
  for (const m of st.muertes) console.log('  ', m.join(' · '));
  console.log('ganador:', st.ganador || '(ninguno)');
  if (trabados.size) console.log('trabados en algún momento:', [...trabados.values()].join('; '));
  const fallas = [];
  if (st.saltos < st.bots.size) fallas.push('no saltaron todos');
  if (st.aterrizan.size < st.bots.size * 0.9) fallas.push('no cayeron todos');
  if (st.agarra < st.bots.size) fallas.push('casi no juntaron loot');
  if (st.cofres < 3) fallas.push('casi no abrieron cofres');
  if (st.tiros < 20) fallas.push('casi no se dispararon');
  if (!fin) fallas.push('la partida no terminó');
  if (errores) fallas.push('el servidor tiró errores');
  console.log(fallas.length ? 'FALLAS: ' + fallas.join(', ') : 'todo OK');
  ws.close(); srv.kill();
  process.exit(fallas.length ? 1 : 0);
}
