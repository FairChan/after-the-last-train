/* 配乐第二代 · 乐器。两类：
   - 采样类（S）：第一次用到某个音时用代码算一段波形存起来（钢琴、拨弦、八音盒、电钢、钟、鼓组……），之后每个音只要一个节点，又省又好听。
   - 现场类（L）：振荡器 + 滤波器现做（长音垫、弦乐、合唱、低长音、贝斯、旋律、琶音、警报、风声）。
   调用：M2.INST[名字](ac, 输出, 开始时间, midi, 时长秒, 力度, 选项) */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2, hz = M2.hz, TAU = Math.PI * 2;

  // ── JS 里的双二阶滤波（只在算采样时用）
  function bq(type, f, q, sr) {
    const w = TAU * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return x => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  const norm = (d, peak) => { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) { const k = peak / m; for (let i = 0; i < d.length; i++) d[i] *= k; } return d; };
  const fadeTail = (d, sr, sec) => { const n = Math.min(d.length, Math.floor(sr * sec)); for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n; return d; };

  // 一组正弦分音（用旋转递推，不逐点算 sin）：parts = [[频率, 振幅, 衰减时间常数], ...]
  function partials(d, sr, parts, att) {
    const n = d.length, na = Math.max(1, Math.floor(sr * (att || 0.002)));
    for (const [f, a, tau] of parts) {
      if (f >= sr * 0.45) continue;
      const w = TAU * f / sr, c = Math.cos(w), s = Math.sin(w), k = Math.exp(-1 / (sr * tau));
      let x = 1, y = 0, e = a;
      for (let i = 0; i < n; i++) { const nx = x * c - y * s; y = x * s + y * c; x = nx; d[i] += y * e * (i < na ? i / na : 1); e *= k; if (e < 1e-5) break; }
    }
    return d;
  }

  // ── 采样生成器：(sr, midi, 随机数) → Float32Array
  const GEN = {
    // 毡钢琴：两根弦微失调、分音略偏高（弦的非谐性），先快后慢两段衰减，加一下琴槌的噪声
    piano(sr, m, r) {
      const f = hz(m), T = M2.clamp(5.5 * Math.pow(2, -(m - 45) / 20), 0.9, 6), len = Math.floor(sr * Math.min(5, T * 0.9 + 0.8)), d = new Float32Array(len), B = 0.00032;
      const ps = [];
      for (let k = 1; k <= 16; k++) {
        const fk = f * k * Math.sqrt(1 + B * k * k); if (fk > 9000) break;
        const a = Math.pow(k, -1.15) * Math.exp(-0.2 * k), ts = T / (1 + 0.45 * k);
        ps.push([fk, a * 0.42, ts], [fk * 1.0004, a * 0.42, ts * 0.95], [fk, a * 0.5, ts * 0.12]);
      }
      partials(d, sr, ps, 0.003);
      const lp = bq('lp', f * 5, 0.7, sr), nh = Math.floor(sr * 0.012);
      for (let i = 0; i < nh; i++) d[i] += lp(r() * 2 - 1) * 0.12 * (1 - i / nh);
      return fadeTail(norm(d, 0.7), sr, 0.3);
    },
    // 拨弦（Karplus-Strong）：像旧木吉他
    pluck(sr, m, r) {
      const f = hz(m), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 2.8), d = new Float32Array(len), T60 = M2.clamp(3.2 * Math.pow(2, -(m - 50) / 24), 0.8, 4);
      const rho = Math.pow(0.001, 1 / (f * T60)), buf = new Float32Array(N); let lp = 0;
      for (let i = 0; i < N; i++) { lp = lp * 0.55 + (r() * 2 - 1) * 0.45; buf[i] = lp; }
      let p = 0, prev = 0;
      for (let i = 0; i < len; i++) { const cur = buf[p]; const y = rho * 0.5 * (cur + prev); prev = cur; buf[p] = y; d[i] = cur; p = (p + 1) % N; }
      const hp = bq('hp', 70, 0.7, sr), body = bq('lp', 3800, 0.6, sr); for (let i = 0; i < len; i++) d[i] = body(hp(d[i]));
      return fadeTail(norm(d, 0.7), sr, 0.2);
    },
    // 八音盒：钢片的几个非谐振型，高的很快没；开头一下咔
    musicbox(sr, m, r) {
      const f = hz(m), s = Math.pow(2, -(m - 72) / 24), len = Math.floor(sr * 2.6), d = new Float32Array(len);
      partials(d, sr, [[f, 1, 1.5 * s], [f * 4.0, 0.26, 0.24 * s], [f * 9.3, 0.09, 0.07 * s], [f * 2, 0.05, 0.5 * s]], 0.0015);
      const hp = bq('hp', 3000, 0.7, sr), n = Math.floor(sr * 0.003); for (let i = 0; i < n; i++) d[i] += hp(r() * 2 - 1) * 0.25 * (1 - i / n);
      return fadeTail(norm(d, 0.7), sr, 0.25);
    },
    // 电钢（调频）：圆、暖，起音带一点金属亮
    epiano(sr, m) {
      const f = hz(m), tau = 2.4 * Math.pow(2, -(m - 60) / 24), len = Math.floor(sr * Math.min(4.5, tau * 2.2 + 0.5)), d = new Float32Array(len);
      for (let i = 0; i < len; i++) { const t = i / sr, I = 1.9 * Math.exp(-t * 2.6) + 0.22, a = Math.exp(-t / tau) * Math.min(1, t / 0.002); d[i] = a * (Math.sin(TAU * f * t + I * Math.sin(TAU * f * t)) + 0.1 * Math.exp(-t * 20) * Math.sin(TAU * f * 7.02 * t)); }
      return fadeTail(norm(d, 0.7), sr, 0.3);
    },
    // 钟（调频，非谐）：冷、远
    bell(sr, m) {
      const f = hz(m), len = Math.floor(sr * 5.5), d = new Float32Array(len);
      for (let i = 0; i < len; i++) { const t = i / sr, I = 3.2 * Math.exp(-t * 1.4) + 0.4, a = Math.exp(-t / 1.9) * Math.min(1, t / 0.002); d[i] = a * Math.sin(TAU * f * t + I * Math.sin(TAU * f * 3.5 * t)); }
      return fadeTail(norm(d, 0.7), sr, 0.4);
    },
    // 站台提示音：像颤音琴（1 : 4 : 10 的分音），带一点颤
    chime(sr, m) {
      const f = hz(m), len = Math.floor(sr * 4.5), d = new Float32Array(len);
      partials(d, sr, [[f, 1, 2.2], [f * 4, 0.2, 0.55], [f * 10, 0.05, 0.14], [f * 2.001, 0.06, 1.1]], 0.004);
      for (let i = 0; i < len; i++) d[i] *= 1 + 0.12 * Math.sin(TAU * 5.3 * i / sr) * Math.min(1, i / sr / 0.4);
      return fadeTail(norm(d, 0.7), sr, 0.4);
    },
    // ── 鼓组（不分音高，midi 忽略）
    kick(sr) { const len = Math.floor(sr * 0.55), d = new Float32Array(len); let ph = 0; const r = M2.prng(7); for (let i = 0; i < len; i++) { const t = i / sr, f = 46 + 125 * Math.exp(-t * 32) + 320 * Math.exp(-t * 260); ph += TAU * f / sr; const a = Math.exp(-t * 7) * Math.min(1, t / 0.0015); d[i] = Math.tanh(1.7 * Math.sin(ph)) / Math.tanh(1.7) * a + (r() * 2 - 1) * Math.exp(-t * 380) * 0.18; } return norm(d, 0.9); },
    thump(sr) { const len = Math.floor(sr * 0.75), d = new Float32Array(len); for (const [t0, k] of [[0, 1], [0.19, 0.55]]) { let ph = 0; for (let i = Math.floor(t0 * sr); i < len; i++) { const t = i / sr - t0, f = 58 + 34 * Math.exp(-t * 26); ph += TAU * f / sr; d[i] += Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.004) * k; } } const lp = bq('lp', 180, 0.7, sr); for (let i = 0; i < len; i++) d[i] = lp(d[i]); return norm(d, 0.9); },
    snare(sr) { const len = Math.floor(sr * 0.45), d = new Float32Array(len), r = M2.prng(11), bp = bq('bp', 2600, 0.6, sr), hp = bq('hp', 900, 0.7, sr); for (let i = 0; i < len; i++) { const t = i / sr; d[i] = Math.sin(TAU * 182 * t) * Math.exp(-t * 30) * 0.55 + Math.sin(TAU * 331 * t) * Math.exp(-t * 38) * 0.25 + hp(bp(r() * 2 - 1)) * Math.exp(-t * 15) * 1.6; } return norm(d, 0.85); },
    clap(sr) { const len = Math.floor(sr * 0.4), d = new Float32Array(len), r = M2.prng(13), bp = bq('bp', 1150, 1.1, sr); for (let i = 0; i < len; i++) { const t = i / sr; let e = 0; for (const t0 of [0, 0.011, 0.023]) if (t >= t0) e += Math.exp(-(t - t0) * 140) * 0.8; if (t > 0.03) e += Math.exp(-(t - 0.03) * 17) * 0.5; d[i] = bp(r() * 2 - 1) * e; } return norm(d, 0.8); },
    hat(sr) { return GEN._hat(sr, 0.2, 55); }, ohat(sr) { return GEN._hat(sr, 0.9, 6.5); },
    _hat(sr, sec, k) { const len = Math.floor(sr * sec), d = new Float32Array(len), r = M2.prng(17), fs = [205.3, 304.4, 369.6, 522.7, 540, 800], h1 = bq('hp', 7200, 0.7, sr), h2 = bq('hp', 7200, 0.7, sr); for (let i = 0; i < len; i++) { const t = i / sr; let s = 0; for (const f of fs) s += Math.sin(TAU * f * 1.7 * t) > 0 ? 1 : -1; d[i] = h2(h1(s / 6 + (r() * 2 - 1) * 0.6)) * Math.exp(-t * k) * Math.min(1, t / 0.0008); } return norm(d, 0.7); },
    tom(sr) { const len = Math.floor(sr * 0.6), d = new Float32Array(len); let ph = 0; for (let i = 0; i < len; i++) { const t = i / sr, f = 98 + 62 * Math.exp(-t * 13); ph += TAU * f / sr; d[i] = Math.sin(ph) * Math.exp(-t * 6.5) * Math.min(1, t / 0.002); } return norm(d, 0.85); },
    // 金属：远处有人拖铁、敲管道
    metal(sr) { const len = Math.floor(sr * 1.8), d = new Float32Array(len), r = M2.prng(19), f0 = 287; partials(d, sr, [[f0, 1, 0.9], [f0 * 1.53, 0.7, 0.6], [f0 * 2.31, 0.55, 0.5], [f0 * 2.89, 0.4, 0.4], [f0 * 3.76, 0.3, 0.3], [f0 * 4.98, 0.2, 0.22], [f0 * 6.12, 0.15, 0.15]], 0.001); const bp = bq('bp', 3200, 0.9, sr), n = Math.floor(sr * 0.02); for (let i = 0; i < n; i++) d[i] += bp(r() * 2 - 1) * 1.5 * (1 - i / n); return fadeTail(norm(d, 0.8), sr, 0.3); },
    clank(sr) { const d = GEN.metal(sr).slice(), lp = bq('lp', 1400, 0.7, sr), f = new Float32Array(d.length); let ph = 0; for (let i = 0; i < d.length; i++) { const t = i / sr; ph += TAU * (150 * Math.exp(-t * 2)) / sr; f[i] = lp(d[i]) + Math.sin(ph) * Math.exp(-t * 5) * 0.4; } return norm(f, 0.8); },
    // 时钟的咔哒
    tick(sr) { const len = Math.floor(sr * 0.06), d = new Float32Array(len), r = M2.prng(23), hp = bq('hp', 4200, 0.8, sr); for (let i = 0; i < len; i++) { const t = i / sr; d[i] = hp(r() * 2 - 1) * Math.exp(-t * 900) + Math.sin(TAU * 2900 * t) * Math.exp(-t * 300) * 0.5; } return norm(d, 0.7); },
    shaker(sr) { const len = Math.floor(sr * 0.16), d = new Float32Array(len), r = M2.prng(29), hp = bq('hp', 6500, 0.7, sr); for (let i = 0; i < len; i++) { const t = i / sr; d[i] = hp(r() * 2 - 1) * Math.min(1, t / 0.008) * Math.exp(-t * 28); } return norm(d, 0.6); },
    // 铁轨：卡—嗒，两下
    train(sr) { const len = Math.floor(sr * 0.42), d = new Float32Array(len), r = M2.prng(31), lp = bq('lp', 380, 0.8, sr), hp = bq('hp', 2600, 0.8, sr); for (let i = 0; i < len; i++) { const t = i / sr; let v = lp(r() * 2 - 1) * Math.exp(-t * 28) * 1.6 + Math.sin(TAU * 68 * t) * Math.exp(-t * 22) * 0.6; if (t > 0.115) { const u = t - 0.115; v += lp(r() * 2 - 1) * Math.exp(-u * 30) * 1.1 + hp(r() * 2 - 1) * Math.exp(-u * 90) * 0.35; } d[i] = v; } return norm(d, 0.85); },
    // ── P2 加的：铁原的低音铜管、人的手风琴、岚川的打字机、北渡的数据音、白沙的盖革计数器
    // 低音铜管（调频，1:1）：起音时调制指数先冲上去（"噗"的一下），然后稳住、晚一点加颤音
    brass(sr, m) {
      const f = hz(m), len = Math.floor(sr * 4), d = new Float32Array(len); let ph = 0, pm = 0;
      for (let i = 0; i < len; i++) { const t = i / sr, I = 2.6 * Math.min(1, t / 0.07) * Math.exp(-t * 3) + 1.3, a = Math.min(1, t / 0.045) * Math.exp(-t / 7), vib = 1 + 0.004 * Math.sin(TAU * 5 * t) * Math.min(1, Math.max(0, t - 0.4) / 0.6); pm += TAU * f * vib / sr; ph += TAU * f * vib / sr; d[i] = a * Math.sin(ph + I * Math.sin(pm)); }
      const lp = bq('lp', Math.min(6000, f * 7), 0.7, sr); for (let i = 0; i < len; i++) d[i] = lp(d[i]);
      return fadeTail(norm(d, 0.7), sr, 0.3);
    },
    // 手风琴：两排簧片微微失调（来回拍），奇次泛音多一点，风箱慢慢鼓
    accordion(sr, m) {
      const f = hz(m), len = Math.floor(sr * 4), d = new Float32Array(len), ps = [];
      for (let k = 1; k <= 12; k++) { if (f * k > 8000) break; const a = (k % 2 ? 1 : 0.55) / k; ps.push([f * k * 0.9965, a * 0.5, 30], [f * k * 1.0035, a * 0.5, 30]); }
      partials(d, sr, ps, 0.03);
      for (let i = 0; i < len; i++) d[i] *= 1 + 0.08 * Math.sin(TAU * 0.7 * i / sr);
      return fadeTail(norm(d, 0.7), sr, 0.25);
    },
    // 打字机：键砸下去的咔 + 底下一声闷的嗒
    typewriter(sr) { const len = Math.floor(sr * 0.16), d = new Float32Array(len), r = M2.prng(43), hp = bq('hp', 3500, 0.8, sr), bp = bq('bp', 1700, 1.4, sr); for (let i = 0; i < len; i++) { const t = i / sr, n = r() * 2 - 1; d[i] = hp(n) * Math.exp(-t * 700) * 1.2 + bp(n) * Math.exp(-t * 90) * 0.9 + Math.sin(TAU * 140 * t) * Math.exp(-t * 45) * 0.5; } return norm(d, 0.75); },
    // 数据音：很短的正弦"嘀"，带一点方波的毛边
    blip(sr, m) { const f = hz(m), len = Math.floor(sr * 0.4), d = new Float32Array(len); for (let i = 0; i < len; i++) { const t = i / sr, a = Math.min(1, t / 0.002) * Math.exp(-t / 0.09); d[i] = a * (Math.sin(TAU * f * t) + 0.18 * Math.sin(TAU * f * 3 * t) * Math.exp(-t * 30)); } return norm(d, 0.7); },
    // 盖革计数器（循环用）：一阵一阵的随机咔哒，有时密有时稀
    geiger(sr) { const len = sr * 8, d = new Float32Array(len), r = M2.prng(47), hp = bq('hp', 2500, 0.8, sr); let rate = 4, click = 0; for (let i = 0; i < len; i++) { if (i % 2205 === 0) rate = M2.clamp(rate + (r() - 0.5) * 3, 1.5, 16); if (r() < rate / sr) click = 0.6 + r() * 0.4; d[i] = hp((r() * 2 - 1) * click) + click * Math.sin(TAU * 3600 * i / sr) * 0.3; click *= 0.86; } return norm(d, 0.6); },
    // ── 底噪纹理（循环用）
    noise(sr) { const len = sr * 4, d = new Float32Array(len), r = M2.prng(37); for (let i = 0; i < len; i++) d[i] = r() * 2 - 1; return d; },
    crackle(sr) { const len = sr * 6, d = new Float32Array(len), r = M2.prng(41), lp = bq('lp', 5000, 0.7, sr), bp = bq('bp', 2200, 1.5, sr); let pop = 0; for (let i = 0; i < len; i++) { if (r() < 0.0006) pop = (0.2 + r() * 0.8) * (r() < 0.5 ? -1 : 1); d[i] = lp(r() * 2 - 1) * 0.05 + bp(pop) * 2; pop *= 0.82; } return norm(d, 0.5); },
  };
  M2.GEN = GEN;
  M2.buf = function (ac, name, m) {
    const C = M2.cache(ac), key = name + ':' + (m | 0);
    if (!C.buf[key]) { const r = M2.prng(1000 + (m | 0) * 31 + name.length * 7), d = GEN[name](ac.sampleRate, m | 0, r), b = ac.createBuffer(1, d.length, ac.sampleRate); b.getChannelData(0).set(d); C.buf[key] = b; }
    return C.buf[key];
  };

  // ── 包络：a 秒升到 v，保持到 t+hold，再 r 秒落下（指数）；返回最晚结束时间
  function adsr(g, t, a, v, hold, r) {
    const p = g.gain, h = Math.max(t + a, t + hold);
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(v, t + a); p.setValueAtTime(v, h); p.setTargetAtTime(0, h, r / 4);
    return h + r * 1.6;
  }
  const osc = (ac, type, f, t, det) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.setValueAtTime(det, t); return o; };
  function lfo(ac, t, end, f, depth, param, delay) {
    const l = ac.createOscillator(), g = ac.createGain(); l.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(depth, t + (delay || 0.01)); l.connect(g); g.connect(param); l.start(t); l.stop(end); return l;
  }
  const loopSrc = (ac, name, t, r) => { const s = ac.createBufferSource(); s.buffer = M2.buf(ac, name, 0); s.loop = true; s.start(t, (r || Math.random()) * s.buffer.duration); return s; };

  // ── 采样类乐器：一个节点一个音
  function sample(name, def) {
    return (ac, out, t, m, dur, v, o) => {
      o = o || {}; const b = M2.buf(ac, name, def.pitched ? m : 0), s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b;
      if (o.detune) s.detune.setValueAtTime(o.detune, t);
      if (o.rate) s.playbackRate.setValueAtTime(o.rate, t);
      let end = t + b.duration;
      g.gain.setValueAtTime(v, t);
      if (!(o.ring ?? def.ring) && dur) { const rel = o.rel ?? def.rel ?? 0.15; g.gain.setValueAtTime(v, t + dur); g.gain.setTargetAtTime(0, t + dur, rel / 3); end = Math.min(end, t + dur + rel * 2); }
      s.connect(g); g.connect(out); s.start(t); s.stop(end); return end;
    };
  }
  const I = M2.INST = {
    piano: sample('piano', { pitched: true, rel: 0.5 }),
    pluck: sample('pluck', { pitched: true, ring: true }),
    musicbox: sample('musicbox', { pitched: true, ring: true }),
    epiano: sample('epiano', { pitched: true, rel: 0.35 }),
    bell: sample('bell', { pitched: true, ring: true }),
    chime: sample('chime', { pitched: true, ring: true }),
    kick: sample('kick', { ring: true }), thump: sample('thump', { ring: true }), snare: sample('snare', { ring: true }), clap: sample('clap', { ring: true }),
    hat: sample('hat', { ring: true }), ohat: sample('ohat', { rel: 0.08 }), tom: sample('tom', { ring: true }), metal: sample('metal', { ring: true }),
    clank: sample('clank', { ring: true }), tick: sample('tick', { ring: true }), shaker: sample('shaker', { ring: true }), train: sample('train', { ring: true }),
    brass: sample('brass', { pitched: true, rel: 0.25 }), accordion: sample('accordion', { pitched: true, rel: 0.22 }),
    typewriter: sample('typewriter', { ring: true }), blip: sample('blip', { pitched: true, ring: true }),
  };

  // ── 现场类乐器
  // 长音垫：三个失调锯齿波分在左中右，低通慢慢打开
  I.pad = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), a = o.a ?? 1.6, r = o.r ?? 2.4, cut = o.cut ?? 1600, g = ac.createGain(), fl = ac.createBiquadFilter();
    fl.type = 'lowpass'; fl.Q.value = 0.4; fl.frequency.setValueAtTime(cut * 0.35, t); fl.frequency.linearRampToValueAtTime(cut, t + a * 1.3);
    const end = adsr(g, t, a, v, dur, r), w = o.width ?? 0.6;
    [-12, 0, 12].forEach((det, i) => { const x = osc(ac, o.wave || 'sawtooth', f, t, det + (Math.random() - 0.5) * 4), p = ac.createStereoPanner(); p.pan.value = (i - 1) * w; x.connect(p); p.connect(fl); x.start(t); x.stop(end); });
    fl.connect(g); g.connect(out); return end;
  };
  // 弦乐：两根锯齿 + 低八度一根，慢起，晚一点加揉弦
  I.strings = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), a = o.a ?? 0.7, r = o.r ?? 1.3, g = ac.createGain(), fl = ac.createBiquadFilter(), hp = ac.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.setValueAtTime((o.cut ?? 2600) * 0.6, t); fl.frequency.linearRampToValueAtTime(o.cut ?? 2600, t + a); fl.Q.value = 0.6; hp.type = 'highpass'; hp.frequency.value = 160;
    const end = adsr(g, t, a, v, dur, r);
    [[-7, -0.4, 1], [7, 0.4, 1], [3, 0, 0.35]].forEach(([det, pan, k], i) => { const x = osc(ac, 'sawtooth', f * (i === 2 ? 0.5 : 1), t, det), p = ac.createStereoPanner(), gg = ac.createGain(); gg.gain.value = k; p.pan.value = pan * (o.width ?? 1); lfo(ac, t, end, 5.1 + i * 0.3, 8, x.detune, 0.6); x.connect(gg); gg.connect(p); p.connect(fl); x.start(t); x.stop(end); });
    fl.connect(hp); hp.connect(g); g.connect(out); return end;
  };
  // 合唱"啊"：锯齿波过三个共振峰
  const VOWEL = { a: [[730, 1, 7], [1090, 0.5, 9], [2440, 0.22, 11]], o: [[570, 1, 7], [840, 0.45, 9], [2410, 0.15, 11]], u: [[300, 1, 6], [870, 0.3, 9], [2240, 0.08, 11]] };
  I.choir = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), a = o.a ?? 0.9, r = o.r ?? 1.6, g = ac.createGain(), sum = ac.createGain(), end = adsr(g, t, a, v * 2.2, dur, r);
    const srcs = [-9, 9].map((det, i) => { const x = osc(ac, 'sawtooth', f, t, det), p = ac.createStereoPanner(); p.pan.value = i ? 0.35 : -0.35; lfo(ac, t, end, 5.4 + i * 0.4, 11, x.detune, 0.5); x.connect(p); x.start(t); x.stop(end); return p; });
    for (const [ff, k, q] of VOWEL[o.vowel || 'a']) { const bp = ac.createBiquadFilter(), gg = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; gg.gain.value = k; for (const s of srcs) s.connect(bp); bp.connect(gg); gg.connect(sum); }
    sum.connect(g); g.connect(out); return end;
  };
  // 低长音：两根锯齿 + 低一个八度的正弦，低通慢慢呼吸
  I.drone = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), a = o.a ?? Math.max(1.5, dur * 0.3), r = o.r ?? Math.max(1.5, dur * 0.4), g = ac.createGain(), fl = ac.createBiquadFilter(), cut = o.cut ?? 320;
    fl.type = 'lowpass'; fl.frequency.value = cut; fl.Q.value = 1.4; const end = adsr(g, t, a, v, dur + a, r); // 多撑一个起音的长度：下一个长音起来之前不掉下去
    lfo(ac, t, end, 0.07 + Math.random() * 0.04, cut * 0.4, fl.frequency, 2);
    [[-6, 'sawtooth', 1, -0.3], [6, 'sawtooth', 1, 0.3], [0, 'sine', 0.5, 0]].forEach(([det, ty, k, pan], i) => { const x = osc(ac, ty, f * (i === 2 ? 0.5 : 1), t, det), gg = ac.createGain(), p = ac.createStereoPanner(); gg.gain.value = k * (i === 2 ? 2.2 : 1); p.pan.value = pan; x.connect(gg); gg.connect(p); p.connect(i === 2 ? g : fl); x.start(t); x.stop(end); });
    fl.connect(g); g.connect(out); return end;
  };
  // 贝斯：sub 是正弦（软、低）；saw 是锯齿 + 方波过带包络的低通，加一根正弦托底
  I.bass = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), g = ac.createGain(), end = adsr(g, t, o.a ?? 0.004, v, dur * 0.92, o.r ?? 0.07);
    if ((o.type || 'saw') === 'sub') { const x = osc(ac, 'sine', f, t), y = osc(ac, 'triangle', f, t), gy = ac.createGain(); gy.gain.value = 0.25; x.connect(g); y.connect(gy); gy.connect(g); x.start(t); y.start(t); x.stop(end); y.stop(end); }
    else {
      const fl = ac.createBiquadFilter(), cut = o.cut ?? 240; fl.type = 'lowpass'; fl.Q.value = o.q ?? 5; fl.frequency.setValueAtTime(cut * (o.env ?? 6), t); fl.frequency.setTargetAtTime(cut, t + 0.005, o.dec ?? 0.06);
      const x = osc(ac, 'sawtooth', f, t), y = osc(ac, 'square', f, t, 6), s = osc(ac, 'sine', f, t), gs = ac.createGain(), gy = ac.createGain(); gy.gain.value = 0.5; gs.gain.value = 0.9;
      x.connect(fl); y.connect(gy); gy.connect(fl); s.connect(gs); gs.connect(g); fl.connect(g); for (const q of [x, y, s]) { q.start(t); q.stop(end); }
    }
    g.connect(out); return end;
  };
  // 旋律：两根锯齿，晚一点揉，能滑音
  I.lead = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), g = ac.createGain(), fl = ac.createBiquadFilter(), end = adsr(g, t, o.a ?? 0.025, v, dur * 0.95, o.r ?? 0.3);
    fl.type = 'lowpass'; fl.frequency.value = o.cut ?? 2300; fl.Q.value = 0.9;
    [[-5, 'sawtooth'], [5, o.wave2 || 'sawtooth']].forEach(([det, ty]) => { const x = osc(ac, ty, f, t, det); if (o.glide && o._last) { x.frequency.setValueAtTime(hz(o._last), t); x.frequency.exponentialRampToValueAtTime(f, t + o.glide); } lfo(ac, t, end, 5.6, 10, x.detune, Math.min(0.4, dur * 0.6)); x.connect(fl); x.start(t); x.stop(end); });
    o._last = m; fl.connect(g); g.connect(out); return end;
  };
  // 机器琶音：方波过高 Q 的低通，像继电器和电路板
  I.arp = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), g = ac.createGain(), fl = ac.createBiquadFilter(), cut = o.cut ?? 1800, d = o.dec ?? 0.16;
    fl.type = 'lowpass'; fl.Q.value = o.q ?? 7; fl.frequency.setValueAtTime(cut * 2.2, t); fl.frequency.setTargetAtTime(cut * 0.35, t + 0.003, d * 0.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.004, d / 2.5);
    const x = osc(ac, 'square', f, t), end = t + d * 2.2; x.connect(fl); fl.connect(g); g.connect(out); x.start(t); x.stop(end); return end;
  };
  // 警报长音：三角波，音高慢慢上下摆，过带通，放远
  I.siren = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const f = hz(m), g = ac.createGain(), bp = ac.createBiquadFilter(), end = adsr(g, t, o.a ?? 0.6, v, dur, o.r ?? 1.2);
    bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 0.8;
    for (const det of [-4, 4]) { const x = osc(ac, 'triangle', f, t, det); lfo(ac, t, end, o.rate ?? 0.35, o.depth ?? 160, x.detune, 0.5); x.connect(bp); x.start(t); x.stop(end); }
    bp.connect(g); g.connect(out); return end;
  };
  // 上扬：噪声 + 锯齿一起往上扫，越来越响，最后一下收住
  I.riser = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const g = ac.createGain(), bp = ac.createBiquadFilter(), end = t + dur + 0.15;
    bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.setTargetAtTime(0, t + dur, 0.03);
    const n = loopSrc(ac, 'noise', t); n.stop(end); n.connect(bp);
    const x = osc(ac, 'sawtooth', hz(m), t), xg = ac.createGain(); xg.gain.value = 0.25; x.frequency.exponentialRampToValueAtTime(hz(m + (o.up ?? 12)), t + dur); x.connect(xg); xg.connect(bp); x.start(t); x.stop(end);
    bp.connect(g); g.connect(out); return end;
  };
  // 底噪纹理：风（噪声过慢慢摆的带通）/ 收音机杂音
  I.wind = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const g = ac.createGain(), bp = ac.createBiquadFilter(), end = adsr(g, t, o.a ?? 2.5, v, dur, o.r ?? 2.5), f = o.f ?? 450;
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = o.q ?? 0.9; lfo(ac, t, end, o.rate ?? 0.09, f * 0.45, bp.frequency, 3);
    const n = loopSrc(ac, 'noise', t); n.stop(end); n.connect(bp); bp.connect(g); g.connect(out); return end;
  };
  I.geiger = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const g = ac.createGain(), end = adsr(g, t, o.a ?? 1, v, dur, o.r ?? 1.5), n = ac.createBufferSource();
    n.buffer = M2.buf(ac, 'geiger', 0); n.loop = true; n.start(t, Math.random() * n.buffer.duration); n.stop(end); n.connect(g); g.connect(out); return end;
  };
  I.crackle = (ac, out, t, m, dur, v, o) => {
    o = o || {}; const g = ac.createGain(), hp = ac.createBiquadFilter(), end = adsr(g, t, o.a ?? 1.5, v, dur, o.r ?? 1.5);
    hp.type = 'highpass'; hp.frequency.value = 350; const n = loopSrc(ac, 'crackle', t); n.stop(end); n.connect(hp); hp.connect(g); g.connect(out); return end;
  };
})(D);
