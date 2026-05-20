/**
 * Audio system - Synthesized sound effects using Web Audio API
 * No external audio files needed - all procedurally generated
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function getMasterGain(): GainNode {
  getAudioContext();
  return masterGain!;
}

// --- Sound Effect Generators ---

/** Laser shot - short rising tone with noise burst */
export function playLaserSound(pitch: number = 1.0) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(800 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(2400 * pitch, now + 0.03);
  osc.frequency.exponentialRampToValueAtTime(400 * pitch, now + 0.1);

  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 2;

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain());

  osc.start(now);
  osc.stop(now + 0.12);
}

/** Spread shot laser - wider, phaser-like */
export function playSpreadLaserSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    const basePitch = 600 + i * 200;
    osc.frequency.setValueAtTime(basePitch, now);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 3, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, now + 0.1);

    gain.gain.setValueAtTime(0.06, now + i * 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(getMasterGain());

    osc.start(now + i * 0.01);
    osc.stop(now + 0.15);
  }
}

/** Small explosion - noise burst with pitch down */
export function playExplosionSound(size: number = 1.0) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const duration = 0.2 + size * 0.3;

  // Noise component
  const bufferSize = ctx.sampleRate * duration;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(4000 * size, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(200, now + duration);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2 * size, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(getMasterGain());

  // Bass thump
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = "sine";
  bass.frequency.setValueAtTime(120 * size, now);
  bass.frequency.exponentialRampToValueAtTime(30, now + duration * 0.7);
  bassGain.gain.setValueAtTime(0.25 * size, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5);

  bass.connect(bassGain);
  bassGain.connect(getMasterGain());

  noise.start(now);
  bass.start(now);
  bass.stop(now + duration);
}

/** Boss explosion - massive layered rumble */
export function playBossExplosionSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Multiple layered explosions
  for (let i = 0; i < 4; i++) {
    setTimeout(() => playExplosionSound(2.0 - i * 0.3), i * 80);
  }

  // Deep rumble
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 1.5);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 1.5);
}

/** Power-up collect - rising chime arpeggio */
export function playPowerUpSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);

    osc.connect(gain);
    gain.connect(getMasterGain());

    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.3);
  });
}

/** Wave start fanfare - two-tone ascending */
export function playWaveStartSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const tones = [
    { freq: 440, start: 0, dur: 0.15 },
    { freq: 554.37, start: 0.12, dur: 0.15 },
    { freq: 659.25, start: 0.24, dur: 0.3 },
  ];

  tones.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.12, now + start + 0.02);
    gain.gain.setValueAtTime(0.12, now + start + dur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

    osc.connect(gain);
    gain.connect(getMasterGain());

    osc.start(now + start);
    osc.stop(now + start + dur);
  });
}

/** Boss warning alarm - ominous pulsing tone */
export function playBossWarningSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  for (let pulse = 0; pulse < 4; pulse++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, now + pulse * 0.25);
    osc.frequency.linearRampToValueAtTime(220, now + pulse * 0.25 + 0.12);

    gain.gain.setValueAtTime(0, now + pulse * 0.25);
    gain.gain.linearRampToValueAtTime(0.15, now + pulse * 0.25 + 0.03);
    gain.gain.setValueAtTime(0.15, now + pulse * 0.25 + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + pulse * 0.25 + 0.2);

    osc.connect(gain);
    gain.connect(getMasterGain());
    osc.start(now + pulse * 0.25);
    osc.stop(now + pulse * 0.25 + 0.25);
  }
}

/** Player hit / life lost - low thud with dissonant tone */
export function playPlayerHitSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Dissonant chord
  [110, 116.54, 155.56].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(getMasterGain());
    osc.start(now);
    osc.stop(now + 0.4);
  });

  // Impact noise
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(noiseGain);
  noiseGain.connect(getMasterGain());
  noise.start(now);
}

/** Game over - descending doom tone */
export function playGameOverSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const notes = [440, 349.23, 293.66, 220, 164.81];

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.25);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.25 + 0.03);
    gain.gain.setValueAtTime(0.12, now + i * 0.25 + 0.2);
    gain.gain.linearRampToValueAtTime(0, now + i * 0.25 + 0.25);
    osc.connect(gain);
    gain.connect(getMasterGain());
    osc.start(now + i * 0.25);
    osc.stop(now + i * 0.25 + 0.3);
  });
}

/** Combo milestone ding */
export function playComboSound(comboLevel: number) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const pitch = 800 + comboLevel * 100;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = Math.min(pitch, 2000);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.2);
}

/** Homing missile lock tone */
export function playHomingLockSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1000, now);
  osc.frequency.setValueAtTime(1500, now + 0.05);
  osc.frequency.setValueAtTime(1000, now + 0.1);
  osc.frequency.setValueAtTime(1500, now + 0.15);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.2);
}

/** Time slow activation - deep whoosh */
export function playTimeSlowSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.8);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.8);

  // Shimmer overlay
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(2000, now);
  osc2.frequency.exponentialRampToValueAtTime(500, now + 0.6);
  gain2.gain.setValueAtTime(0.04, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc2.connect(gain2);
  gain2.connect(getMasterGain());
  osc2.start(now);
  osc2.stop(now + 0.6);
}

/** Mega blast charge-up */
export function playMegaBlastSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Charge up
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(500, now);
  filter.frequency.exponentialRampToValueAtTime(8000, now + 0.3);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.5);

  // Blast noise
  setTimeout(() => playExplosionSound(2.5), 300);
}

/** Enemy hit but not killed - metallic ping */
export function playEnemyHitSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Shop purchase confirmation */
export function playPurchaseSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  [523.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
    osc.connect(gain);
    gain.connect(getMasterGain());
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.2);
  });
}

/** Boss laser sweep sound */
export function playBossLaserSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.linearRampToValueAtTime(600, now + 0.5);
  osc.frequency.linearRampToValueAtTime(200, now + 1.0);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.setValueAtTime(0.1, now + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 400;
  filter.Q.value = 5;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 1.0);
}

/** Asteroid warning rumble */
export function playAsteroidSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 60;
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.3);
}

/** Enemy shoots at player */
export function playEnemyShootSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.15);
}

/** New high score celebration jingle */
export function playNewHighScoreSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const start = now + i * 0.15;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain);
    gain.connect(getMasterGain());
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

/** Initialize audio on first user interaction */
export function initAudio() {
  const handler = () => {
    getAudioContext();
    document.removeEventListener("click", handler);
    document.removeEventListener("touchstart", handler);
    document.removeEventListener("keydown", handler);
  };
  document.addEventListener("click", handler);
  document.addEventListener("touchstart", handler);
  document.addEventListener("keydown", handler);
}

export function setMasterVolume(vol: number) {
  const gain = getMasterGain();
  gain.gain.value = Math.max(0, Math.min(1, vol));
}
