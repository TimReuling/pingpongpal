// Synthesized sound effects using Web Audio API — zero dependencies

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

/** Short pop for +1 score */
export function playScoreUp() {
  playTone(880, 0.12, 'sine', 0.25);
}

/** Lower blip for -1 score */
export function playScoreDown() {
  playTone(330, 0.1, 'triangle', 0.15);
}

/** Service change ping */
export function playServiceChange() {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.setValueAtTime(990, now + 0.06);
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(now + 0.15);
}

/** Victory fanfare — rising 3-note arpeggio */
export function playWin() {
  const notes = [523, 659, 784]; // C5 E5 G5
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.3), i * 120);
  });
  // Final shimmer
  setTimeout(() => playTone(1047, 0.5, 'sine', 0.2), 400);
}
