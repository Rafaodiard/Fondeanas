// Efectos de sonido sintetizados con WebAudio (sin archivos).
let ctx = null;
let master = null;
let volumen = 1;

/** Volumen general de 0 a 1 (sale de la opción del panel de configuración). */
export function setVolumen(v) {
  volumen = Math.max(0, Math.min(1, Number(v) || 0));
  if (master) master.gain.value = 0.35 * volumen;
}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35 * volumen;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(c, dur) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  return buf;
}

function burst({ dur = 0.15, freq = 1200, q = 0.8, vol = 1, type = 'lowpass', pan = 0 }) {
  const c = ac(); if (!c) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  const p = c.createStereoPanner ? c.createStereoPanner() : null;
  src.connect(f); f.connect(g);
  if (p) { p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
  src.start();
}

function tone({ f1 = 440, f2 = 440, dur = 0.12, vol = 0.3, type = 'sine', delay = 0 }) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); o.type = type;
  const g = c.createGain();
  const t = c.currentTime + delay;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

const SHOTS = {
  pistola: { dur: 0.12, freq: 2500, vol: 0.8 },
  subfusil: { dur: 0.08, freq: 3000, vol: 0.6 },
  rifle: { dur: 0.14, freq: 1800, vol: 0.9 },
  escopeta: { dur: 0.3, freq: 900, vol: 1.3 },
  francotirador: { dur: 0.5, freq: 1300, vol: 1.4 },
  lanzacohetes: { dur: 0.35, freq: 500, vol: 1.0 },
};

// Ruido que suena en loop (viento de la caída libre, roce al deslizarse): se crea una vez y solo cambia el volumen.
const loops = {};
function loop(nombre, freq, q, tipo) {
  if (loops[nombre]) return loops[nombre];
  const c = ac(); if (!c) return null;
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
  loops[nombre] = { g, f, nivel: 0 };
  return loops[nombre];
}
function nivelLoop(nombre, v, freq, q, tipo, vol, fmin, fmax) {
  if (!ctx && v <= 0) return;
  const L = loop(nombre, freq, q, tipo); if (!L) return;
  v = Math.max(0, Math.min(1, v));
  if (Math.abs(v - L.nivel) < 0.01) return;
  L.nivel = v;
  const t = ctx.currentTime;
  L.g.gain.setTargetAtTime(v * vol, t, 0.12);
  L.f.frequency.setTargetAtTime(fmin + (fmax - fmin) * v, t, 0.12);
}


// Motor del auto en el que se va (manejar.js): dos osciladores (el ronroneo y un armónico) por un pasabajos.
// v = 0 apagado, 1 encendido; rpm de 0 (ralentí) a 1 (a fondo).
let motorN = null;
function motorNodos() {
  if (motorN) return motorN;
  const c = ac(); if (!c) return null;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 3;
  const g = c.createGain(); g.gain.value = 0;
  const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 38;
  const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 76;
  const g2 = c.createGain(); g2.gain.value = 0.35;
  o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
  o1.start(); o2.start();
  motorN = { o1, o2, f, g, v: -1, rpm: -1 };
  return motorN;
}

export const sfx = {
  unlock: () => ac(),
  // viento de la caída (0 = nada, 1 = picada a fondo)
  viento(v) { nivelLoop('viento', v, 500, 0.7, 'bandpass', 0.55, 300, 1300); },
  // roce contra el piso al deslizarse (v = velocidad relativa)
  deslizar(v) { nivelLoop('roce', v, 900, 1.2, 'bandpass', 0.45, 500, 1400); },
  deslizarInicio() { burst({ dur: 0.25, freq: 700, q: 0.8, vol: 0.7, type: 'bandpass' }); },
  paracaidasCierra() { burst({ dur: 0.3, freq: 1200, q: 0.6, vol: 0.5, type: 'highpass' }); },
  shot(w, distance = 0) {
    const s = SHOTS[w] || SHOTS.rifle;
    const att = Math.max(0.05, 1 - distance / 250);
    burst({ ...s, vol: s.vol * att, freq: s.freq * (distance > 60 ? 0.5 : 1) });
  },
  hit(head) { tone({ f1: head ? 1400 : 900, f2: head ? 1800 : 1100, dur: 0.06, vol: 0.25, type: 'square' }); },
  shieldHit() { tone({ f1: 1800, f2: 2400, dur: 0.07, vol: 0.18, type: 'triangle' }); },
  hurt() { tone({ f1: 180, f2: 90, dur: 0.18, vol: 0.4, type: 'sawtooth' }); },
  pickaxe(kind) {
    if (kind === 'tree') burst({ dur: 0.1, freq: 600, q: 4, vol: 0.9, type: 'bandpass' });
    else if (kind === 'rock' || kind === 'house') { burst({ dur: 0.08, freq: 3500, q: 6, vol: 0.7, type: 'bandpass' }); tone({ f1: 1200, f2: 800, dur: 0.1, vol: 0.1, type: 'triangle' }); }
    else burst({ dur: 0.08, freq: 1500, vol: 0.4 });
  },
  whiff() { burst({ dur: 0.12, freq: 800, q: 0.5, vol: 0.2, type: 'highpass' }); },
  build() { burst({ dur: 0.1, freq: 400, q: 2, vol: 0.8, type: 'bandpass' }); tone({ f1: 300, f2: 500, dur: 0.08, vol: 0.12, type: 'square' }); },
  // golpe de pico en el punto débil: "ting" brillante y un golpe seco
  critico() {
    tone({ f1: 1568, f2: 1568, dur: 0.14, vol: 0.22, type: 'triangle' });
    tone({ f1: 2349, f2: 2093, dur: 0.22, vol: 0.14, type: 'sine', delay: 0.04 });
    burst({ dur: 0.07, freq: 4200, q: 3, vol: 0.6, type: 'bandpass' });
  },
  structBreak() { burst({ dur: 0.35, freq: 700, q: 1, vol: 1 }); },
  pickup() { tone({ f1: 600, f2: 900, dur: 0.08, vol: 0.2, type: 'triangle' }); tone({ f1: 900, f2: 1300, dur: 0.08, vol: 0.2, type: 'triangle', delay: 0.07 }); },
  chest() { [523, 659, 784, 1046].forEach((f, i) => tone({ f1: f, f2: f, dur: 0.18, vol: 0.18, type: 'triangle', delay: i * 0.08 })); },
  reload() { burst({ dur: 0.05, freq: 3000, q: 3, vol: 0.4, type: 'bandpass' }); setTimeout(() => burst({ dur: 0.06, freq: 2000, q: 3, vol: 0.5, type: 'bandpass' }), 250); },
  heal() { tone({ f1: 500, f2: 1000, dur: 0.35, vol: 0.2, type: 'sine' }); },
  shield() { tone({ f1: 700, f2: 1600, dur: 0.4, vol: 0.2, type: 'sine' }); },
  boom(distance = 0) { const v = Math.max(0.08, 1 - distance / 200); burst({ dur: 0.8, freq: 300, vol: 2 * v }); tone({ f1: 90, f2: 30, dur: 0.6, vol: 0.6 * v, type: 'sine' }); },
  glider() { burst({ dur: 0.3, freq: 1200, q: 0.3, vol: 0.4, type: 'highpass' }); },
  elim() { tone({ f1: 400, f2: 400, dur: 0.12, vol: 0.25, type: 'square' }); tone({ f1: 800, f2: 800, dur: 0.2, vol: 0.25, type: 'square', delay: 0.12 }); },
  motor(v, rpm = 0) {
    if (!ctx && v <= 0) return;
    const M = motorNodos(); if (!M) return;
    if (Math.abs(v - M.v) < 0.01 && Math.abs(rpm - M.rpm) < 0.01) return;
    M.v = v; M.rpm = rpm;
    const t = ctx.currentTime, hz = 34 + rpm * 95;
    M.g.gain.setTargetAtTime(v * (0.32 + rpm * 0.25), t, 0.08);
    M.o1.frequency.setTargetAtTime(hz, t, 0.06);
    M.o2.frequency.setTargetAtTime(hz * 2.01, t, 0.06);
    M.f.frequency.setTargetAtTime(260 + rpm * 1300, t, 0.08);
  },
  // ruedas que patinan (freno de mano o derrape)
  derrape(v) { nivelLoop('derrape', v, 1600, 2.5, 'bandpass', 0.35, 1100, 2100); },
  bocina(distance = 0) {
    const v = Math.max(0.05, 1 - distance / 120) * 0.16;
    tone({ f1: 415, f2: 415, dur: 0.42, vol: v, type: 'square' });
    tone({ f1: 523, f2: 523, dur: 0.42, vol: v, type: 'square' });
  },
  choque(fuerza = 1, distance = 0) {
    const v = Math.max(0.05, 1 - distance / 120) * Math.min(1.4, 0.35 + fuerza * 0.06);
    burst({ dur: 0.3, freq: 650, q: 0.9, vol: v });
    burst({ dur: 0.18, freq: 3200, q: 2, vol: v * 0.5, type: 'bandpass' });
  },
  puerta() { burst({ dur: 0.09, freq: 900, q: 1.5, vol: 0.6, type: 'bandpass' }); tone({ f1: 160, f2: 90, dur: 0.1, vol: 0.25, type: 'sine', delay: 0.03 }); },
  turbo() { burst({ dur: 0.45, freq: 2200, q: 0.4, vol: 0.4, type: 'highpass' }); },
  click() { tone({ f1: 1200, f2: 1100, dur: 0.03, vol: 0.12, type: 'square' }); },
};
