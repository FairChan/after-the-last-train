/* 末班之后 · 小样：合成音效（Web Audio，不用音频文件）和一段低音氛围 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  let ac = null, master = null, noiseBuf = null, last = {};
  const S = D.Sfx = { muted: false };
  S.init = function () {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    drone();
  };
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, fq, q, type, f1, delay) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.setValueAtTime(fq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    env(g, t, 0.003, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  }
  const SOUNDS = {
    shot: () => { tone('square', 900, 180, 0.08, 0.18); noise(0.06, 0.25, 3000, 1, 'highpass'); },
    scatter: () => { noise(0.18, 0.5, 2400, 0.7, 'lowpass', 300); tone('square', 300, 60, 0.12, 0.2); },
    lunge: () => { noise(0.14, 0.35, 800, 2, 'bandpass', 4000); tone('sawtooth', 200, 800, 0.1, 0.08); },
    throw: () => { noise(0.1, 0.2, 1200, 3, 'bandpass', 2400); },
    zap: () => { tone('sawtooth', 1400, 200, 0.16, 0.14); noise(0.12, 0.2, 5000, 1, 'highpass'); },
    charge: () => { tone('sine', 300, 1400, 0.25, 0.15); },
    rail: () => { tone('sawtooth', 1800, 90, 0.3, 0.22); noise(0.25, 0.4, 6000, 0.5, 'lowpass', 400); },
    slam: () => { tone('sine', 140, 35, 0.4, 0.6); noise(0.35, 0.6, 900, 0.7, 'lowpass', 80); },
    boom: () => { tone('sine', 120, 30, 0.35, 0.5); noise(0.4, 0.5, 2000, 0.6, 'lowpass', 100); },
    shield: () => { tone('triangle', 500, 1100, 0.18, 0.15); tone('sine', 1100, 1600, 0.15, 0.06, 0.05); },
    draw: () => { noise(0.05, 0.12, 4000, 2, 'bandpass'); tone('triangle', 900, 1200, 0.05, 0.05); },
    power: () => { tone('triangle', 400, 800, 0.2, 0.15); tone('triangle', 600, 1200, 0.2, 0.12, 0.08); },
    cool: () => { noise(0.4, 0.3, 6000, 0.5, 'highpass', 1500); },
    nope: () => { tone('square', 140, 110, 0.09, 0.12); },
    swing: () => { noise(0.07, 0.15, 1500, 2, 'bandpass', 600); },
    hit: () => { tone('square', 220, 60, 0.06, 0.18); noise(0.05, 0.3, 2500, 1, 'lowpass'); },
    hurt: () => { tone('sawtooth', 300, 70, 0.2, 0.3); noise(0.15, 0.3, 1200, 1); },
    dash: () => { noise(0.12, 0.25, 600, 1, 'bandpass', 3000); },
    coin: () => { tone('square', 1600, 2400, 0.04, 0.04); },
    warn: () => { tone('square', 700, 700, 0.05, 0.05); },
    bosswarn: () => { tone('sawtooth', 220, 220, 0.18, 0.12); tone('sawtooth', 233, 233, 0.18, 0.1); },
    eshot: () => { tone('square', 600, 300, 0.06, 0.08); },
    orb: () => { tone('sine', 400, 200, 0.15, 0.15); },
    leap: () => { noise(0.1, 0.15, 900, 3, 'bandpass', 300); },
    charge2: () => { tone('sawtooth', 100, 300, 0.4, 0.15); noise(0.4, 0.2, 400, 1, 'lowpass', 2000); },
    laser: () => { tone('sawtooth', 90, 110, 1.3, 0.18); tone('square', 180, 220, 1.3, 0.06); },
    summon: () => { tone('triangle', 200, 600, 0.3, 0.15); },
    die: () => { tone('sawtooth', 400, 40, 0.8, 0.35); noise(0.8, 0.4, 1500, 0.7, 'lowpass', 60); },
    bossdie: () => { tone('sine', 100, 25, 1.4, 0.7); noise(1.4, 0.6, 3000, 0.5, 'lowpass', 50); },
    win: () => { [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12, i * 0.08)); },
    click: () => { tone('square', 1200, 900, 0.03, 0.06); },
    pick: () => { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.12, 0.1, i * 0.05)); },
    heal: () => { [392, 523, 659].forEach((f, i) => tone('sine', f, f, 0.3, 0.12, i * 0.1)); },
  };
  S.play = function (name) {
    if (!ac || S.muted || !SOUNDS[name]) return;
    const now = ac.currentTime; if (last[name] && now - last[name] < 0.03) return; last[name] = now;
    try { SOUNDS[name](); } catch (e) { /* 忽略 */ }
  };
  // 低沉的环境底噪 + 远处列车回声
  function drone() {
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.6; f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = 0.05;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 90; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  }
})(D);
