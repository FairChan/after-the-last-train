/* 配乐第二代 · 谱子和播放。
   一首曲子 = 段落（sections）+ 曲式（form，放完从 loop 那段接着循环）+ 声部（parts）。
   声部分三层：base 探索 / alert 警觉 / combat 交火。D.Mus2.Engine#setIntensity(0–2) 让上面两层淡进淡出，不换曲。
   谱子：每小节 16 个字，小节用 | 隔开，空格随便加。
     chord 声部：x 整个和弦；0–9 和弦里第几个音（超过就高八度）
     deg 声部：0–9 a–e 音阶第几级（root 起）
     bass 声部：x 根音（斜杠和弦用低音）o 高八度 5 五音 3 三音 7 七音
     hit 声部：X 重 x 中 g 轻
     - 延长（可以跨小节），. 休止
   段落里的 chords：每小节一个和弦，同一小节两个用逗号（各占半小节）。
   每个声部的谱子写在 p 里：p[段落名] → p[段落的 like] → p['*']；写成数组就是每次进这一段随机挑一个（变奏）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2, TR = M2.TRACKS = M2.TRACKS || {};
  M2.track = (key, def) => { def.key = key; TR[key] = def; return def; };
  const LAYERS = ['base', 'alert', 'combat'];
  const VEL = { X: 1, x: 0.72, g: 0.35 };

  function flat(pat, bars) {
    const bs = pat.replace(/\s+/g, '').split('|').map(b => (b + '................').slice(0, 16)), out = [];
    for (let i = 0; i < bars; i++) out.push(bs[i % bs.length]);
    return out.join('');
  }
  function prepSections(T) {
    const S = {};
    for (const s of T.sections) {
      const like = s.like ? T.sections.find(x => x.name === s.like) : null, chords = s.chords || like.chords, bars = s.bars || (like && like.bars) || 8;
      const cb = chords.split('|').map(b => b.trim().split(',').map(c => M2.chord(c.trim())));
      S[s.name] = { name: s.name, like: s.like, bars, cb: Array.from({ length: bars }, (_, i) => cb[i % cb.length]) };
    }
    return S;
  }

  // ── 一首曲子的一次播放
  function Player(eng, key, opt) {
    const ac = eng.ac, T = TR[key]; if (!T) throw new Error('配乐：没有这首 ' + key);
    this.eng = eng; this.ac = ac; this.T = T; this.key = key; this.rng = M2.prng(opt.seed ?? (Math.random() * 1e9 | 0));
    this.sd = 60 / T.bpm / 4; this.sec = T._sec || (T._sec = prepSections(T));
    // 曲式展开成一串小节
    this.seq = []; T.form.forEach((n, k) => { if (k === (T.loop || 0)) this.loopAt = this.seq.length; for (let b = 0; b < this.sec[n].bars; b++) this.seq.push({ sec: this.sec[n], bi: b }); });
    // 声音的路：各声部 → 声像 → (干声 / 侧链) + 混响 + 延迟 → 混合 → 磁带 → 饱和 → 淡入淡出 → 引擎
    const G = (v) => { const g = ac.createGain(); g.gain.value = v ?? 1; return g; };
    this.sting = !!(opt.sting || T.once); this.out = G(0); this.out.connect(this.sting ? eng.input : eng.bed); // 短乐句不进 bed：主曲给它让路
    const lo = eng.q === 'low'; // 低品质：不要卷积混响、不要磁带、不做过采样
    const sat = ac.createWaveShaper(); sat.curve = M2.satCurve(ac, 1 + (T.sat ?? 0.4) * 2); sat.oversample = lo ? 'none' : '2x'; sat.connect(this.out);
    this.mix = G(T.gain ?? 1);
    const city = T.city ? opt.city : null, tape = (T.tape || 0) + (city === 'baisha' ? 1.2 : 0); // 城市色：白沙的磁带抖得更厉害、北渡的回声更长
    if (tape && !lo) { // 磁带：一根被慢慢摇的短延迟，音高轻轻晃
      const dl = ac.createDelay(0.05); dl.delayTime.value = 0.012; this.mix.connect(dl); dl.connect(sat);
      for (const [f, dep] of [[0.55, 0.0016 * tape], [6.3, 0.00012 * tape]]) { const l = ac.createOscillator(), lg = G(dep); l.frequency.value = f; l.connect(lg); lg.connect(dl.delayTime); l.start(); this._lfos = (this._lfos || []).concat(l); }
    } else this.mix.connect(sat);
    this.duck = G(1); this.duck.connect(this.mix);
    this.rev = G(1);
    if (!lo) { const conv = ac.createConvolver(); conv.buffer = M2.ir(ac, T.space || 'hall'); const revOut = G((T.revLevel ?? 0.9) * (city === 'beidu' ? 1.35 : 1)); this.rev.connect(conv); conv.connect(revOut); revOut.connect(this.mix); }
    // 乒乓延迟
    this.dly = G(1); { const bt = 60 / T.bpm * (T.delay ?? 0.75), L = ac.createDelay(2), R = ac.createDelay(2), fb = G(T.delayFb ?? 0.38), lp = ac.createBiquadFilter(), mg = ac.createChannelMerger(2), wet = G(0.8);
      L.delayTime.value = bt; R.delayTime.value = bt; lp.type = 'lowpass'; lp.frequency.value = 2600;
      this.dly.connect(L); L.connect(R); R.connect(lp); lp.connect(fb); fb.connect(L); L.connect(mg, 0, 0); R.connect(mg, 0, 1); mg.connect(wet); wet.connect(this.mix); wet.connect(this.rev); }
    // 声部
    this.city = city;
    this.parts = [];
    const all = Object.assign({}, T.parts, city && M2.cityParts ? M2.cityParts(T, city) : {}); // 探索曲叠一层城市色（src/music/city.js）
    for (const [name, P] of Object.entries(all)) {
      if (opt.only && !opt.only.includes(name)) continue; // 单听某几个声部（调混音用）
      const p = Object.assign({ name, layer: 'base', vol: 0.1, pan: 0, rev: 0.2, dly: 0, mode: 'hit' }, P); if (T.cal && T.cal[name]) p.vol *= T.cal[name]; // cal：校准脚本写的微调倍数
      if (M2.HUSH && M2.HUSH[p.inst]) p.vol *= M2.HUSH[p.inst]; // 底噪压到几乎听不见（core.js）
      p.o = Object.assign({}, P.o); p.inG = G(0); let tail = p.inG;
      for (const f of p.fx || []) { const b = ac.createBiquadFilter(); b.type = f[0]; b.frequency.value = f[1]; b.Q.value = f[2] ?? 0.7; tail.connect(b); tail = b; }
      const pan = ac.createStereoPanner(); pan.pan.value = p.pan; tail.connect(pan);
      pan.connect(p.duck ? this.duck : this.mix);
      if (p.rev) { const s = G(p.rev); pan.connect(s); s.connect(this.rev); }
      if (p.dly) { const s = G(p.dly); pan.connect(s); s.connect(this.dly); }
      this.parts.push(p);
    }
    this.lv = { base: 1, alert: 0, combat: 0 }; this.lvT = {};
    this.t0 = opt.at ?? ac.currentTime + 0.05; this.step = 0; this.nextT = this.t0; this.barPos = -1; this.end = 0; this.rounds = 0; this.done = false;
    this.barSec = 16 * this.sd; this.len = this.seq.length * this.barSec; // 一遍多长（短乐句用）
    this.setLayers(opt.intensity ?? 0, this.t0, 0.01);
  }
  Player.prototype.setLayers = function (x, t, ramp) {
    const want = { base: 1, alert: M2.clamp(x, 0, 1), combat: M2.clamp(x - 1, 0, 1) };
    for (const L of LAYERS) {
      if (want[L] === this.lv[L] && this.lvT[L] !== undefined) continue;
      const up = want[L] > this.lv[L], rp = ramp ?? (up ? (L === 'combat' ? 0.5 : 1.6) : 3.5);
      this.lv[L] = want[L]; this.lvT[L] = t + rp;
      for (const p of this.parts) if (p.layer === L) { const g = p.inG.gain, now = g.value; g.cancelScheduledValues(t); g.setValueAtTime(now, t); g.linearRampToValueAtTime(p.vol * want[L], t + rp); }
    }
  };
  Player.prototype.layerOn = function (p, t) { return this.lv[p.layer] > 0 || t < (this.lvT[p.layer] || 0); };
  Player.prototype.fade = function (t, to, sec) { const g = this.out.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + sec); if (to === 0) this.end = t + sec + 0.1; };
  Player.prototype.stop = function () { for (const l of this._lfos || []) try { l.stop(); } catch (e) { /* 已停 */ } try { this.out.disconnect(); } catch (e) { /* 已断 */ } };
  Player.prototype.enterSection = function (sec) {
    for (const p of this.parts) {
      let src = p.p && (p.p[sec.name] ?? (sec.like && p.p[sec.like]) ?? p.p['*']);
      if (Array.isArray(src)) src = src[Math.floor(this.rng() * src.length)];
      p.cur = src ? flat(src, sec.bars) : null;
    }
    this.secName = sec.name;
  };
  Player.prototype.schedule = function (until) {
    while (this.nextT < until && !this.done) { this.doStep(this.nextT); this.step++; this.nextT = this.t0 + this.step * this.sd; }
  };
  Player.prototype.doStep = function (t) {
    const i = this.step % 16, ac = this.ac, rng = this.rng;
    if (i === 0) { this.barPos++; if (this.barPos >= this.seq.length) { this.rounds++; if (this.T.once) { this.done = true; this.fade(t + 1.5, 0, 1.5); return; } this.barPos = this.loopAt || 0; } const b = this.seq[this.barPos]; if (b.bi === 0) this.enterSection(b.sec); this.bar = b; }
    const { sec, bi } = this.bar, idx = bi * 16 + i, cb = sec.cb[bi], ch = cb[Math.floor(i * cb.length / 16)];
    for (const p of this.parts) {
      const s = p.cur; if (!s) continue; const c = s[idx]; if (!c || c === '.' || c === '-') continue;
      if (!this.layerOn(p, t)) continue;
      if (p.prob !== undefined && rng() > p.prob) continue;
      let n = 1; while (idx + n < s.length && s[idx + n] === '-') n++;
      const dur = n * this.sd, tt = Math.max(ac.currentTime, t + (p.human ? (rng() - 0.5) * 2 * p.human : 0));
      let vel = (p.mode === 'hit' ? (VEL[c] ?? 0.72) : 1) * (1 + (rng() - 0.5) * (p.velRand ?? 0.16));
      if (p.acc && p.acc[i] === '>') vel *= 1.25;
      const eng = this.eng, life = p.mode === 'hit' ? 0.35 : dur + 0.5, play = m => { if (!eng.voice(tt, life)) return; if (p.detuneRand) p.o.detune = (rng() - 0.5) * 2 * p.detuneRand; M2.INST[p.inst](ac, p.inG, tt, m, dur, vel, p.o); eng.notes++; };
      if (p.side) this.duckAt(tt, p.side);
      if (p.mode === 'hit') play(0);
      else if (p.mode === 'chord') { const v = M2.voicing(ch, p.center ?? 60, p.maxV ?? 4); if (c === 'x') v.forEach(play); else { const k = parseInt(c, 16); play(v[k % v.length] + 12 * Math.floor(k / v.length)); } }
      else if (p.mode === 'deg') { const sc = M2.SCALES[p.scale || this.T.scale || 'minor'], k = parseInt(c, 16); play(p.root + 12 * Math.floor(k / 7) + sc[k % 7]); }
      else if (p.mode === 'bass') { const b = p.low + (((ch.bass - p.low) % 12) + 12) % 12; play(b + (c === 'o' ? 12 : c === '5' ? 7 : c === '3' ? ch.iv[1] : c === '7' ? (ch.iv[3] ?? 10) : 0)); }
    }
  };
  // 侧链：底鼓一下，其他声部让一让
  Player.prototype.duckAt = function (t, depth) { const g = this.duck.gain; g.setTargetAtTime(1 - depth, t, 0.004); g.setTargetAtTime(1, t + 0.04, 0.09); };
  // 下一个小节线 / 下一拍的时间（换曲、进战斗在这儿接）
  Player.prototype.nextGrid = function (t, beat) { const g = beat ? 4 * this.sd : this.barSec, k = Math.ceil((t - this.t0) / g - 1e-6); return this.t0 + Math.max(0, k) * g; };
  Player.prototype.where = function () { return this.secName + ' ' + (this.bar ? this.bar.bi + 1 : 0) + '/' + (this.bar ? this.bar.sec.bars : 0); };

  // ── 引擎：总线（压缩把各声部粘在一起，最后一道限幅），管几个 Player 的交叉淡入淡出
  // opt.q：'high' / 'low'（低档不要混响和磁带，同时发声上限 32；高档 64）
  function Engine(ac, dest, opt) {
    opt = opt || {}; this.ac = ac; this.players = []; this.intensity = 0; this.q = opt.q || 'high'; this.cap = this.q === 'low' ? 32 : 64; this.live = []; this.notes = 0; this.dropped = 0;
    const comp = ac.createDynamicsCompressor(), lim = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 2.5; comp.knee.value = 8; comp.attack.value = 0.02; comp.release.value = 0.3;
    lim.threshold.value = -2.5; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.002; lim.release.value = 0.12;
    this.input = ac.createGain(); this.master = ac.createGain(); this.master.gain.value = 0.9;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.7; // 切掉听不见、只会吃余量的超低频
    this.bed = ac.createGain(); this.sfxDuck = ac.createGain(); this.bed.connect(this.sfxDuck); this.sfxDuck.connect(this.input); // 主曲走这里；短乐句响时压低（bed），大的音效响时让一让（sfxDuck）
    this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.Q.value = 0.5; // "隔墙"：暂停、菜单里把音乐闷住
    this.input.connect(hp); hp.connect(this.lp); this.lp.connect(comp); comp.connect(lim);
    const pre = ac.createGain(), ceil = ac.createWaveShaper(); pre.gain.value = 0.5; ceil.curve = M2.ceilCurve(ac); ceil.oversample = opt.q === 'low' ? 'none' : '2x'; // 软天花板（core.js）
    lim.connect(pre); pre.connect(ceil); ceil.connect(this.master); this.master.connect(dest);
  }
  Engine.prototype.play = function (key, opt) {
    opt = opt || {}; const t = opt.at ?? this.ac.currentTime + 0.05, fade = opt.fade ?? 1.5;
    for (const p of this.players) if (!p.end && !p.sting) p.fade(t, 0, fade);
    const p = new Player(this, key, Object.assign({ intensity: this.intensity }, opt, { at: t }));
    p.fade(t, 1, fade); this.players.push(p); this.cur = p; return p;
  };
  // 同时发声：超过上限就不排这个音（返回 false）；life 是这个音大概响多久（打击乐按 0.35 秒算）
  Engine.prototype.voice = function (t, life) {
    if (this.live.length >= this.cap) this.live = this.live.filter(e => e > t); // 排程按时间先后：结束得比这个音开始还早的就不算了
    if (this.live.length >= this.cap) { this.dropped++; return false; }
    this.live.push(t + life); return true;
  };
  // 短乐句：只放一遍，主曲先压到 35%，放完 1.5 秒回来
  Engine.prototype.sting = function (key, opt) {
    opt = opt || {}; const t = opt.at ?? this.ac.currentTime + 0.03, p = new Player(this, key, Object.assign({ intensity: 2, seed: Math.random() * 1e9 | 0 }, opt, { at: t, sting: true }));
    p.fade(t, 1, 0.02); this.players.push(p);
    const g = this.bed.gain, dip = opt.dip ?? 0.35; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(dip, t + 0.15); g.setValueAtTime(dip, t + p.len); g.linearRampToValueAtTime(1, t + p.len + 1.5);
    return p;
  };
  // 大的音效（爆炸、首领警报）响时主曲让 db 分贝，hold 秒后慢慢回来；短乐句不让
  Engine.prototype.duck = function (db, hold) { const g = this.sfxDuck.gain, t = this.ac.currentTime, lo = Math.pow(10, -db / 20); g.cancelScheduledValues(t); g.setValueAtTime(Math.min(g.value, 1), t); g.linearRampToValueAtTime(lo, t + 0.04); g.setValueAtTime(lo, t + 0.04 + (hold ?? 0.25)); g.setTargetAtTime(1, t + 0.04 + (hold ?? 0.25), 0.4); };
  Engine.prototype.muffle = function (on) { if (this._muf === !!on) return; this._muf = !!on; this.lp.frequency.setTargetAtTime(on ? 900 : 20000, this.ac.currentTime, on ? 0.12 : 0.3); };
  Engine.prototype.setIntensity = function (x, t) { this.intensity = x; t = t ?? this.ac.currentTime; for (const p of this.players) if (!p.end && !p.sting) p.setLayers(x, t); };
  Engine.prototype.stop = function (fade, at) { const t = at ?? this.ac.currentTime; for (const p of this.players) if (!p.end && !p.sting) p.fade(t, 0, fade ?? 1); this.cur = null; };
  Engine.prototype.schedule = function (until) {
    for (const p of this.players) if (!p.end || p.nextT < p.end) p.schedule(until);
    const now = this.ac.currentTime; this.players = this.players.filter(p => { if (p.end && now > p.end + 0.5) { p.stop(); return false; } return true; });
  };
  Engine.prototype.halt = function () { clearInterval(this._tm); this._tm = 0; };
  // 后台标签页里计时器一秒才跳一次：排远一点，免得断
  Engine.prototype.run = function () { if (this._tm) return; const la = () => (typeof document !== 'undefined' && document.hidden ? 1.6 : 0.3); this._tm = setInterval(() => this.schedule(this.ac.currentTime + la()), 40); this.schedule(this.ac.currentTime + la()); };
  M2.Engine = Engine;

  // ── 检查谱子：每小节 16 个字、字符合这个声部的写法、乐器存在、和弦认得出；返回问题清单
  const OK = { hit: /^[Xxg.\-]+$/, chord: /^[x0-9.\-]+$/, deg: /^[0-9a-e.\-]+$/, bass: /^[xo357.\-]+$/ };
  M2.lint = function (key) {
    const T = TR[key], bad = [];
    try { prepSections(T); } catch (e) { bad.push(e.message); }
    for (const n of T.form) if (!T.sections.find(s => s.name === n)) bad.push('曲式里没有段落 ' + n);
    for (const [name, P] of Object.entries(T.parts)) {
      if (!M2.INST[P.inst]) bad.push(name + '：没有乐器 ' + P.inst);
      const mode = P.mode || 'hit';
      if ((mode === 'deg' && P.root === undefined) || (mode === 'bass' && P.low === undefined)) bad.push(name + '：缺 root / low');
      for (const [sec, v] of Object.entries(P.p || {})) for (const pat of [].concat(v)) {
        const bars = pat.replace(/\s+/g, '').split('|');
        bars.forEach((b, i) => { if (b.length !== 16) bad.push(`${name}.${sec} 第 ${i + 1} 小节 ${b.length} 个字`); if (!OK[mode].test(b)) bad.push(`${name}.${sec} 第 ${i + 1} 小节有不认的字：${b}`); });
        const S = T.sections.find(s => s.name === sec), nb = S && (S.bars || (T.sections.find(x => x.name === S.like) || {}).bars);
        if (sec !== '*' && !S) bad.push(`${name}：没有段落 ${sec}`); else if (nb && nb % bars.length) bad.push(`${name}.${sec}：${bars.length} 小节不能整除段落的 ${nb} 小节`);
      }
    }
    return bad;
  };

  // ── 离线渲染：timeline = [[秒, 强度], ...]；返回 AudioBuffer（立体声）
  M2.render = function (key, sec, opt) {
    opt = opt || {}; const sr = opt.sr || 44100, ac = new OfflineAudioContext(2, Math.ceil(sr * sec), sr), eng = new Engine(ac, ac.destination, { q: opt.q });
    const tl = (opt.timeline || []).slice().sort((a, b) => a[0] - b[0]);
    eng.intensity = tl.length && tl[0][0] <= 0 ? tl[0][1] : 0;
    if (M2.TRACKS[key].once) eng.sting(key, { seed: opt.seed ?? 1, at: 0.05, only: opt.only }); else eng.play(key, { seed: opt.seed ?? 1, fade: 0.05, at: 0.05, only: opt.only, city: opt.city });
    if (opt.raw) { eng.input.disconnect(); eng.input.connect(ac.destination); }
    const look = 1.2; eng.schedule(look);
    let k = 0; while (k < tl.length && tl[k][0] <= 0) k++;
    for (let s = 0.25; s < sec; s += 0.25) {
      const at = s; ac.suspend(at).then(() => { while (k < tl.length && tl[k][0] <= at) { eng.setIntensity(tl[k][1], at); k++; } eng.schedule(at + look); ac.resume(); });
    }
    return ac.startRendering().then(b => { b.notes = eng.notes; b.dropped = eng.dropped; return b; });
  };
})(D);
