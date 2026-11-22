/* 配乐第二代 · 底层工具：随机数、和弦、音阶、空间混响、饱和曲线。
   全部 Web Audio 现场合成，不用音频文件。设计：design/features/music-v2/design.md
   这一组文件挂在 D.Mus2 下；P0 只给点唱机（dev/music.html）和导出工具用，游戏里还是旧的 src/music.js。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2 = D.Mus2 || {};
  M2.hz = n => 440 * Math.pow(2, (n - 69) / 12);
  M2.clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  // 可复现的随机数（mulberry32）
  M2.prng = function (seed) {
    let a = seed >>> 0;
    return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };

  // 每个音频上下文一份缓存（预先算好的采样、混响、曲线）
  const CACHE = new WeakMap();
  M2.cache = ac => { let c = CACHE.get(ac); if (!c) { c = { buf: {}, ir: {}, curve: {} }; CACHE.set(ac, c); } return c; };

  // 总线最后的软天花板：进来前先乘 0.5（曲线覆盖 ±2），0.7 以下原样，往上慢慢弯到 1 为止（限幅器没接住的尖峰在这里收住）
  M2.ceilCurve = ac => {
    const C = M2.cache(ac); if (C.curve.ceil) return C.curve.ceil;
    const n = 4096, c = new Float32Array(n), k = 0.7;
    for (let i = 0; i < n; i++) { const a = Math.abs(i / (n - 1) * 2 - 1) * 2; c[i] = Math.sign(i - (n - 1) / 2) * (a < k ? a : k + (1 - k) * Math.tanh((a - k) / (1 - k))); }
    return (C.curve.ceil = c);
  };
  // ── 各乐器"响度 0 dB"时的 vol（P0、P2 校准出来的中位数）。M2.vol(乐器, 目标响度 dB) → vol；P3 起的曲子按这个算，再用 cal 微调
  M2.REF = { drone: 0.65, crackle: 61, pad: 0.57, piano: 4.2, musicbox: 3.8, pluck: 8.2, pluck_bass: 11, strings: 0.56, chime: 3.2, wind: 6.8, bell: 2.8, arp: 2.3, thump: 5.7, tick: 88,
    bass_sub: 1.7, bass: 0.74, kick: 4.7, snare: 19, hat: 27, ohat: 20, metal: 8.2, clank: 8.2, choir: 0.7, tom: 4.7, train: 18, siren: 1, riser: 8.8, clap: 12, lead: 0.71, shaker: 110,
    epiano: 4.2, blip: 10, accordion: 2.3, typewriter: 32, brass: 2.2, geiger: 210 };
  // 底噪类的声部（收音机杂音、风声）一律压到几乎听不见（用户 2026-11-22：背景底噪特别特别小）；player.js 播的时候乘上
  M2.HUSH = { crackle: 0.08, wind: 0.08 };
  M2.vol = (inst, lv) => +((M2.REF[inst] ?? 1) * Math.pow(10, lv / 20)).toPrecision(2);
  // 一个声部：pt('piano', -27, {...}) → { inst, lv, vol, ... }（低音 sub、拨弦当低音各有自己的一档）
  M2.pt = (inst, lv, d) => { d = d || {}; const k = inst === 'bass' && d.o && d.o.type === 'sub' ? 'bass_sub' : inst === 'pluck' && d.mode === 'bass' ? 'pluck_bass' : inst; return Object.assign({ inst, lv, vol: M2.vol(k, lv) }, d); };

  // ── 音阶（相对主音的半音）
  M2.SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
  };

  // ── 和弦：'Am9'、'Fmaj7#11'、'C/G'、'Esus4' …… → { root 音级, iv 音程, bass 音级 }
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
    mmaj7: [0, 3, 7, 11], '9': [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10], '7b9': [0, 4, 7, 10, 13], 'maj7#11': [0, 4, 7, 11, 18], aug: [0, 4, 8], '6add9': [0, 4, 7, 9, 14],
  };
  const pcOf = s => (PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
  const chordMemo = {};
  M2.chord = function (name) {
    if (chordMemo[name]) return chordMemo[name];
    const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(name);
    if (!m || !QUAL[m[2]]) throw new Error('配乐：认不出的和弦 ' + name);
    return (chordMemo[name] = { name, root: pcOf(m[1]), iv: QUAL[m[2]], bass: m[3] ? pcOf(m[3]) : pcOf(m[1]) });
  };
  // 排和弦：音的个数不超过 maxV（先去五音），挑平均音高离 center 最近的转位
  M2.voicing = function (ch, center, maxV) {
    const key = ch.name + '@' + center + '/' + maxV, c = M2.voicing.memo;
    if (c[key]) return c[key];
    let iv = ch.iv.slice();
    while (iv.length > maxV) { const k = iv.indexOf(7); iv.splice(k > 0 ? k : iv.length - 1, 1); }
    const base = center - 12 + (((ch.root - (center - 12)) % 12) + 12) % 12;
    let notes = iv.map(i => base + i).sort((a, b) => a - b), best = notes, bd = 1e9;
    const inv = (ns, k) => { let v = ns.slice(); for (let j = 0; j < Math.abs(k); j++) { if (k > 0) v.push(v.shift() + 12); else v.unshift(v.pop() - 12); } return v; };
    for (let k = -iv.length; k <= iv.length; k++) { const v = inv(notes, k), mean = v.reduce((a, b) => a + b, 0) / v.length, d = Math.abs(mean - center) + (v[v.length - 1] - v[0]) * 0.05; if (d < bd) { bd = d; best = v; } }
    return (c[key] = best);
  };
  M2.voicing.memo = {};

  // ── 空间混响：用代码生成脉冲响应。小屋 / 站厅 / 隧道
  // len 总长；decay 衰减 60dB 的时间；pre 预延迟；f0→f1 尾巴越来越暗；er 早期反射；slap 隧道里一下下的回声
  M2.SPACES = {
    room:   { len: 1.6, decay: 1.1, pre: 0.006, f0: 7000, f1: 2200, er: [[0.011, 0.5], [0.019, 0.35], [0.027, 0.3], [0.041, 0.2]] },
    hall:   { len: 3.8, decay: 2.9, pre: 0.018, f0: 8000, f1: 1900, er: [[0.023, 0.4], [0.037, 0.3], [0.052, 0.28], [0.071, 0.2], [0.094, 0.15]] },
    tunnel: { len: 6.0, decay: 4.6, pre: 0.03, f0: 5600, f1: 1100, er: [[0.031, 0.45], [0.058, 0.3]], slap: { every: 0.083, g: 0.3, n: 14 } },
  };
  M2.ir = function (ac, space) {
    const C = M2.cache(ac); if (C.ir[space]) return C.ir[space];
    const P = M2.SPACES[space] || M2.SPACES.hall, sr = ac.sampleRate, n = Math.floor(sr * P.len), b = ac.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = M2.prng(1234 + ch * 777);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; if (t < P.pre) continue;
        const u = t - P.pre, env = Math.exp(-u * 6.9 / P.decay);
        const fc = P.f0 * Math.pow(P.f1 / P.f0, Math.min(1, u / P.decay)), a = Math.exp(-2 * Math.PI * fc / sr);
        lp = lp * a + (r() * 2 - 1) * (1 - a);
        d[i] = lp * env * (u < 0.01 ? u / 0.01 : 1);
      }
      for (const [t, g] of P.er) { const i = Math.floor((t + (ch ? 0.0031 : 0)) * sr); if (i < n) d[i] += g * (ch ? -1 : 1) * 0.6; }
      if (P.slap) for (let k = 1; k <= P.slap.n; k++) { const i = Math.floor((P.pre + k * P.slap.every + (ch ? 0.004 : 0)) * sr), g = P.slap.g * Math.pow(0.78, k); for (let j = 0; j < 40 && i + j < n; j++) d[i + j] += g * Math.exp(-j / 8) * (r() * 2 - 1); }
    }
    return (C.ir[space] = b);
  };

  // ── 轻度饱和曲线（磁带 / 电子管那种，把峰削圆）
  M2.satCurve = function (ac, k) {
    const C = M2.cache(ac), key = k.toFixed(2); if (C.curve[key]) return C.curve[key];
    const n = 2048, c = new Float32Array(n), th = Math.tanh(k);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / th; }
    return (C.curve[key] = c);
  };
})(D);
