/* 末班之后 · 小样：合成音效（Web Audio，不用音频文件）和一段低音氛围 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  let ac = null, master = null, bus = null, amb = null, mus = null, comp = null, noiseBuf = null, last = {}, vol = { master: 0.8, sfx: 1, ambient: 0.7, music: 0.6 };
  const S = D.Sfx = { muted: false };
  S.init = function () {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination); // M6：总线最后挂一个压缩器
    try { comp.threshold.value = -18; comp.ratio.value = 4; comp.knee.value = 6; comp.attack.value = 0.005; comp.release.value = 0.2; } catch (e) { /* 老浏览器 */ }
    bus = ac.createGain(); bus.connect(master); amb = ac.createGain(); amb.connect(master); mus = ac.createGain(); mus.connect(master); // 音效、环境、音乐三条轨，各自调音量
    S.setVolume(vol);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    drone();
  };
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, fq, q, type, f1, delay) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.setValueAtTime(fq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    env(g, t, 0.003, vol, dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
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
    // 买下：收银机"叮——当"，再落几枚硬币；卖出：硬币一枚枚落进口袋（trade.js）
    buy: () => { noise(0.03, 0.3, 2600, 3, 'bandpass'); tone('square', 1568, 1568, 0.07, 0.07, 0.02); tone('square', 2093, 2093, 0.2, 0.07, 0.09); tone('sine', 4186, 3950, 0.55, 0.05, 0.09); for (let i = 0; i < 4; i++) tone('triangle', 2600 + i * 350, 0, 0.04, 0.035, 0.22 + i * 0.06); },
    sell: () => { for (let i = 0; i < 3; i++) tone('triangle', 2400 - i * 300, 0, 0.05, 0.05, i * 0.07); noise(0.08, 0.2, 900, 1, 'lowpass', 300, 0.22); tone('sine', 220, 120, 0.08, 0.12, 0.22); },
    warn: () => { tone('square', 700, 700, 0.05, 0.05); },
    bosswarn: () => { tone('sawtooth', 220, 220, 0.18, 0.12); tone('sawtooth', 233, 233, 0.18, 0.1); },
    eshot: () => { tone('square', 600, 300, 0.06, 0.08); },
    orb: () => { tone('sine', 400, 200, 0.15, 0.15); },
    leap: () => { noise(0.1, 0.15, 900, 3, 'bandpass', 300); },
    charge2: () => { tone('sawtooth', 100, 300, 0.4, 0.15); noise(0.4, 0.2, 400, 1, 'lowpass', 2000); },
    laser: () => { tone('sawtooth', 90, 110, 1.3, 0.18); tone('square', 180, 220, 1.3, 0.06); },
    summon: () => { tone('triangle', 200, 600, 0.3, 0.15); },
    // 剧情灵魂：打字音（dlg-view.js 每出一个字放一下），很短，不压音乐
    ty_lin: () => { tone('triangle', 300 + Math.random() * 40, 0, 0.035, 0.035); },
    ty_ahsun: () => { tone('square', 600 + Math.random() * 80, 0, 0.022, 0.016); },
    ty_lu: () => { tone('sine', 262, 0, 0.05, 0.04); },
    ty_pa: () => { tone('square', 430 + Math.random() * 20, 0, 0.03, 0.012); noise(0.03, 0.025, 2600, 2, 'bandpass'); },
    ty_op: () => { noise(0.018, 0.03, 5200, 3, 'bandpass'); },
    die: () => { tone('sawtooth', 400, 40, 0.8, 0.35); noise(0.8, 0.4, 1500, 0.7, 'lowpass', 60); },
    bossdie: () => { tone('sine', 100, 25, 1.4, 0.7); noise(1.4, 0.6, 3000, 0.5, 'lowpass', 50); },
    win: () => { [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12, i * 0.08)); },
    click: () => { tone('square', 1200, 900, 0.03, 0.06); },
    pick: () => { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.12, 0.1, i * 0.05)); },
    rare: () => { [784, 988, 1175, 1568].forEach((f, i) => tone("triangle", f, f, 0.35, 0.12, i * 0.07)); noise(0.5, 0.15, 6000, 0.5, "highpass", 2000); },
    beep: () => { tone("square", 1400, 1400, 0.06, 0.1); tone("square", 1400, 1400, 0.06, 0.1, 0.2); tone("square", 1800, 1800, 0.08, 0.12, 0.4); },
    snipe: () => { tone("sawtooth", 2200, 120, 0.25, 0.25); noise(0.3, 0.45, 4000, 0.6, "lowpass", 300); },
    ding: () => { tone("triangle", 2400, 1800, 0.08, 0.08); },
    // 开箱：先是锁扣，0.15 秒后箱子打开（和画面里的开箱动画对上）
    open_metal: () => { noise(0.03, 0.3, 3200, 4, 'bandpass'); tone('square', 900, 600, 0.03, 0.05); tone('sawtooth', 85, 140, 0.3, 0.05, 0.12); noise(0.28, 0.18, 1400, 6, 'bandpass', 2200, 0.12); noise(0.06, 0.25, 900, 1, 'lowpass', 300, 0.38); },
    open_wood: () => { tone('sine', 170, 70, 0.12, 0.3); noise(0.08, 0.3, 700, 1, 'lowpass'); tone('triangle', 240, 170, 0.35, 0.05, 0.12); noise(0.3, 0.2, 500, 3, 'bandpass', 900, 0.12); tone('sine', 120, 60, 0.12, 0.25, 0.4); },
    open_plastic: () => { noise(0.03, 0.3, 3500, 2, 'highpass'); tone('square', 520, 380, 0.04, 0.06); noise(0.06, 0.25, 1800, 2, 'bandpass', 900, 0.15); tone('square', 300, 200, 0.05, 0.05, 0.16); },
    open_glass: () => { noise(0.05, 0.4, 2500, 1, 'highpass', 0, 0.14); for (let i = 0; i < 9; i++) tone('sine', 2600 + Math.random() * 3200, 0, 0.06 + Math.random() * 0.12, 0.05, 0.15 + Math.random() * 0.25); noise(0.3, 0.12, 6000, 0.7, 'highpass', 3000, 0.2); },
    open_soft: () => { noise(0.25, 0.22, 900, 0.8, 'bandpass', 1800); for (let i = 0; i < 12; i++) noise(0.012, 0.18, 4000, 3, 'bandpass', 0, 0.12 + i * 0.022); },
    open_elec: () => { noise(0.03, 0.25, 3000, 3, 'bandpass'); tone('sine', 1200, 300, 0.3, 0.08, 0.12); tone('square', 1600, 1600, 0.04, 0.05, 0.3); tone('square', 2000, 2000, 0.05, 0.05, 0.38); noise(0.2, 0.08, 7000, 0.5, 'highpass', 0, 0.12); },
    open_vault: () => { tone('square', 1500, 1500, 0.04, 0.07); tone('square', 1500, 1500, 0.04, 0.07, 0.07); tone('square', 2000, 2000, 0.06, 0.08, 0.14); tone('sine', 110, 45, 0.35, 0.45, 0.2); noise(0.25, 0.4, 600, 1, 'lowpass', 120, 0.2); noise(0.5, 0.12, 5000, 0.5, 'highpass', 2000, 0.3); },
    open_fridge: () => { noise(0.04, 0.3, 1500, 2, 'bandpass'); tone('sine', 300, 120, 0.06, 0.2, 0.12); noise(0.6, 0.18, 6000, 0.6, 'highpass', 2500, 0.14); },
    open_scrap: () => { noise(0.2, 0.3, 2400, 5, 'bandpass', 900); tone('sawtooth', 220, 90, 0.25, 0.06, 0.05); for (let i = 0; i < 4; i++) tone('triangle', 1800 + i * 300, 0, 0.05, 0.04, 0.15 + i * 0.05); },
    // 翻找：一下一下的窸窸窣窣
    rummage: () => { noise(0.05 + Math.random() * 0.05, 0.12, 800 + Math.random() * 2400, 2, 'bandpass'); if (Math.random() < 0.3) tone('triangle', 1400 + Math.random() * 1200, 0, 0.03, 0.03); },
    // 好东西快揭开时往上爬的一声（三角洲那种"要出货了"）
    riser: () => { tone('sine', 300, 1400, 0.55, 0.06); tone('triangle', 450, 2100, 0.55, 0.04); noise(0.55, 0.06, 1500, 1, 'bandpass', 7000); },
    // 揭开：品质越高越响、越长
    reveal0: () => { tone('triangle', 700, 650, 0.06, 0.06); noise(0.04, 0.08, 3000, 2, 'bandpass'); },
    reveal1: () => { [660, 990].forEach((f, i) => tone('triangle', f, f, 0.1, 0.08, i * 0.05)); },
    reveal2: () => { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.14, 0.09, i * 0.05)); tone('sine', 2640, 2640, 0.2, 0.03, 0.15); },
    reveal3: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.3, 0.1, i * 0.06)); tone('sine', 2093, 2093, 0.5, 0.04, 0.25); noise(0.4, 0.08, 6000, 0.5, 'highpass', 2500, 0.1); },
    reveal4: () => { tone('sine', 130, 65, 0.5, 0.35); [784, 988, 1175, 1568, 1976].forEach((f, i) => tone('triangle', f, f, 0.45, 0.11, 0.05 + i * 0.07)); [3136, 3951].forEach((f, i) => tone('sine', f, f, 0.8, 0.03, 0.4 + i * 0.1)); noise(0.7, 0.15, 7000, 0.5, 'highpass', 2500, 0.05); },
    reveal5: () => { tone('sine', 98, 40, 0.9, 0.5); noise(0.6, 0.35, 900, 0.7, 'lowpass', 80); [659, 784, 988, 1319, 1568, 1976].forEach((f, i) => tone('sawtooth', f, f, 0.5, 0.06, 0.08 + i * 0.07)); [2637, 3136, 3951, 5274].forEach((f, i) => tone('sine', f, f, 1.2, 0.04, 0.5 + i * 0.08)); noise(1.2, 0.18, 8000, 0.4, 'highpass', 3000, 0.1); },
    // 打击分级：轻、重、暴击（背刺 / 处决 / 蓄力），击杀确认
    hit2: () => { tone('square', 170, 40, 0.1, 0.24); tone('sine', 95, 40, 0.14, 0.32); noise(0.09, 0.4, 1800, 1, 'lowpass', 200); },
    crit: () => { tone('sawtooth', 1300, 260, 0.14, 0.12); tone('square', 210, 45, 0.18, 0.26); noise(0.14, 0.4, 3000, 1, 'bandpass', 500); },
    kill: () => { tone('triangle', 1760, 2350, 0.05, 0.06); tone('triangle', 2350, 2350, 0.09, 0.05, 0.05); },
    heavy: () => { noise(0.18, 0.42, 500, 1.5, 'bandpass', 2600); tone('sawtooth', 130, 55, 0.2, 0.16); },
    chargeup: () => { tone('triangle', 500, 1250, 0.12, 0.09); tone('sine', 1250, 1250, 0.16, 0.05, 0.1); },
    perfect: () => { tone('sine', 1700, 380, 0.45, 0.12); tone('triangle', 820, 1640, 0.22, 0.08, 0.04); noise(0.4, 0.15, 5000, 0.6, 'highpass', 1200); },
    heart: () => { tone('sine', 72, 44, 0.13, 0.5); tone('sine', 66, 40, 0.15, 0.38, 0.17); },
    tink: () => { tone('triangle', 3000 + Math.random() * 900, 0, 0.03, 0.025); },
    hint: () => { [880, 1320].forEach((f, i) => tone('sine', f, f, 0.2, 0.07, i * 0.08)); },
    heal: () => { [392, 523, 659].forEach((f, i) => tone('sine', f, f, 0.3, 0.12, i * 0.1)); },
    // 楼梯和电梯（lift.js）：一步一声闷响；电梯门滑动；电梯运行的低嗡；到站"叮"
    step: () => { noise(0.05, 0.14, 380, 1, 'lowpass'); tone('sine', 120, 70, 0.06, 0.07); },
    stepm: () => { tone('square', 700, 520, 0.03, 0.04); noise(0.04, 0.1, 2400, 2, 'bandpass'); }, // 金属梯
    liftdoor: () => { noise(0.55, 0.12, 900, 0.8, 'bandpass', 500); tone('sine', 90, 80, 0.5, 0.05); },
    lift: () => { tone('sawtooth', 55, 52, 1.4, 0.05); noise(1.4, 0.06, 200, 0.7, 'lowpass'); },
    liftding: () => { tone('sine', 1320, 1320, 0.5, 0.09); tone('sine', 990, 990, 0.7, 0.07, 0.18); },
  };
  S.names = () => Object.keys(SOUNDS);
  // 音量：总音量 × 0.35 是原来的基准响度
  S.setVolume = v => { vol = Object.assign({}, vol, v); if (!ac) return; const t = ac.currentTime; master.gain.setTargetAtTime(S.muted ? 0 : vol.master * 0.35, t, 0.02); bus.gain.setTargetAtTime(vol.sfx, t, 0.02); amb.gain.setTargetAtTime(vol.ambient * (vol.music > 0.01 ? 0.6 : 1), t, 0.02); mus.gain.setTargetAtTime(vol.music, t, 0.02); };
  S.toggleMute = () => { S.muted = !S.muted; S.setVolume({}); return S.muted; };
  // M6：给 music.js 用的音频上下文和音乐轨；大响声时音乐压低到 45%，0.5 秒回来
  S.ctx = () => ac; S.musicBus = () => mus; S.vol = () => vol;
  const DUCK = { boom: 1, slam: 1, bosswarn: 1, bossdie: 1, hurt: 1, die: 1 };
  S.duck = function () { if (!mus || S.muted) return; const t = ac.currentTime, v = vol.music; mus.gain.cancelScheduledValues(t); mus.gain.setValueAtTime(Math.max(0.0001, mus.gain.value), t); mus.gain.linearRampToValueAtTime(v * 0.45, t + 0.03); mus.gain.linearRampToValueAtTime(v, t + 0.5); };
  S.play = function (name) {
    if (!ac || S.muted || !SOUNDS[name]) return;
    const now = ac.currentTime; if (last[name] && now - last[name] < 0.03) return; last[name] = now;
    try { SOUNDS[name](); } catch (e) { if (S.debug) console.error("sfx " + name, e); }
    if (DUCK[name]) S.duck();
  };
  // 剧情灵魂：剧情屋的环境声（scene.js 每帧调 S.ambTick(屋子的 amb, dt)），走环境轨；对话时音乐压低（S.musicDuck）
  function ambTone(type, f0, f1, dur, v) { const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, 0.01, v, dur); o.connect(g); g.connect(amb); o.start(t); o.stop(t + dur + 0.05); }
  function ambNoise(dur, v, fq, q, type, a) { const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.value = fq; f.Q.value = q || 1; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (a || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + (a || 0.01) + dur); s.connect(f); f.connect(g); g.connect(amb); s.start(t, Math.random() * 0.5); s.stop(t + dur + (a || 0.01) + 0.05); }
  const AMB = {
    gen: () => { if (Math.random() < 0.5) ambTone('square', 98, 0, 0.5, 0.012); if (Math.random() < 0.06) ambNoise(0.18, 0.05, 300, 2, 'bandpass'); }, // 发电机：低嗡 + 偶尔咳一下
    fire: () => { for (let i = 0; i < 3; i++) if (Math.random() < 0.5) ambNoise(0.03 + Math.random() * 0.05, 0.03 + Math.random() * 0.05, 1500 + Math.random() * 2500, 3); ambNoise(0.6, 0.02, 500, 0.7, 'lowpass', 0.2); },
    drip: () => { if (Math.random() < 0.18) ambTone('sine', 1400 + Math.random() * 500, 900, 0.18, 0.03); },
    wind: () => { ambNoise(0.9, 0.03, 380 + Math.random() * 200, 0.8, 'bandpass', 0.35); },
  };
  let ambAcc = 0;
  S.ambTick = function (kind, dt) { if (!ac || S.muted || !AMB[kind]) return; ambAcc += dt; if (ambAcc < 0.45) return; ambAcc = 0; try { AMB[kind](); } catch (e) { /* 没关系 */ } };
  S.musicDuck = function (k) { if (!mus || S.muted) return; mus.gain.setTargetAtTime(vol.music * (k == null ? 1 : k), ac.currentTime, 0.4); };
  // 低沉的环境底噪 + 远处列车回声
  function drone() {
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.6; f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = 0.05;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(amb); o1.start(); o2.start();
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 90; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  }
})(D);
