"use client";

let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function chime() {
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  [880, 1174.66, 1567.98].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, now + i * 0.18);
    g.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 1.2);
    o.connect(g).connect(a.destination);
    o.start(now + i * 0.18);
    o.stop(now + i * 0.18 + 1.3);
  });
}

export function tick() {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = 1200;
  g.gain.setValueAtTime(0.06, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.05);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.06);
}

/** A tiny generative background-music engine: soft chord pads per genre. */
const GENRES: Record<string, { bpm: number; wave: OscillatorType; chords: number[][]; volume: number }> = {
  acoustic: { bpm: 80, wave: "triangle", chords: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], volume: 0.05 },
  chilled: { bpm: 64, wave: "sine", chords: [[62, 65, 69, 72], [60, 64, 67, 71], [57, 60, 64, 67], [59, 62, 65, 69]], volume: 0.06 },
  classical: { bpm: 72, wave: "triangle", chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], volume: 0.045 },
  global: { bpm: 90, wave: "square", chords: [[62, 66, 69], [64, 67, 71], [59, 62, 66], [61, 64, 68]], volume: 0.02 },
  inspiring: { bpm: 70, wave: "sawtooth", chords: [[60, 67, 72, 76], [57, 64, 69, 72], [65, 72, 77, 81], [67, 74, 79, 83]], volume: 0.018 },
  upbeat: { bpm: 112, wave: "triangle", chords: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], volume: 0.05 },
  "lo-fi": { bpm: 70, wave: "sine", chords: [[57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71]], volume: 0.06 },
};

let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicGain: GainNode | null = null;
let current: string | null = null;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export function playMusic(genre: string | null) {
  if (genre === current) return;
  stopMusic();
  if (!genre || !GENRES[genre]) return;
  const a = audio();
  if (!a) return;
  current = genre;
  const g = GENRES[genre];
  musicGain = a.createGain();
  musicGain.gain.value = 1;
  musicGain.connect(a.destination);
  let step = 0;
  const beat = 60 / g.bpm;
  const play = () => {
    if (!musicGain) return;
    const chord = g.chords[step % g.chords.length];
    const t = a.currentTime;
    const len = beat * 4;
    chord.forEach((n) => {
      const o = a.createOscillator();
      const env = a.createGain();
      o.type = g.wave;
      o.frequency.value = midi(n - 12);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(g.volume, t + 0.4);
      env.gain.linearRampToValueAtTime(g.volume * 0.6, t + len * 0.7);
      env.gain.linearRampToValueAtTime(0, t + len);
      o.connect(env).connect(musicGain!);
      o.start(t);
      o.stop(t + len + 0.05);
    });
    // a gentle melody note on the off beat
    const o = a.createOscillator();
    const env = a.createGain();
    o.type = "sine";
    o.frequency.value = midi(chord[(step * 7) % chord.length] + 12);
    env.gain.setValueAtTime(0, t + beat * 2);
    env.gain.linearRampToValueAtTime(g.volume * 0.8, t + beat * 2 + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t + beat * 3.5);
    o.connect(env).connect(musicGain!);
    o.start(t + beat * 2);
    o.stop(t + beat * 3.6);
    step++;
  };
  play();
  musicTimer = setInterval(play, beat * 4 * 1000);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (musicGain) {
    try {
      musicGain.disconnect();
    } catch {
      /* noop */
    }
  }
  musicGain = null;
  current = null;
}
