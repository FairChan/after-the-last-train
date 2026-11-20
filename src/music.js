/* 末班之后 · 小样二：配乐（M6）。Web Audio 现场合成，不用音频文件。
   六首：据点、线路图、安全、危险、撤离战、首领（2026-11-16 剧情灵魂：全部改暗、放慢）；另有林桥、阿隼、陆峥、E-17 四段主题，剧情屋按场次放。16 分音符步进器提前 0.15 秒排程；换曲时 1.2 秒交叉淡入淡出。
   D.Music.update(G, dt) 每帧按场景挑曲目（main.js 的 step 里调）。音乐走 sfx.js 的音乐轨（设置里的"音乐"音量），大响声时会被压低。
   设计：design/features/av/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M = D.Music = { cur: null, notes: 0, dangerT: 0 };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const noiseOf = new WeakMap();
  const noise = ac => { if (!noiseOf.has(ac)) { const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseOf.set(ac, b); } return noiseOf.get(ac); };
  // 包络：a 秒升到 v，保持到 hold，再 r 秒落下
  function env(g, t, a, v, hold, r) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + Math.max(a, hold)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, hold) + r); }
  function voice(ac, out, type, f, t, a, v, hold, r, filt) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    let tail = g; if (filt) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(filt[0], t); if (filt[1]) fl.frequency.exponentialRampToValueAtTime(filt[1], t + (filt[2] || 0.3)); fl.Q.value = filt[3] || 1; o.connect(fl); fl.connect(g); } else o.connect(g);
    env(g, t, a, v, hold, r); tail.connect(out); o.start(t); o.stop(t + Math.max(a, hold) + r + 0.05); return o;
  }
  function hit(ac, out, t, dur, v, fq, type) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise(ac); f.type = type; f.frequency.value = fq; env(g, t, 0.002, v, 0.002, dur); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.05); }
  // 乐器：(ac, 输出, 开始时间, 音高 midi, 时长秒, 力度)
  const INST = {
    bass: (ac, o, t, n, d, v) => voice(ac, o, 'sawtooth', hz(n), t, 0.006, v, d * 0.85, 0.08, [1100, 170, 0.25, 5]),
    pad: (ac, o, t, n, d, v) => { for (const c of [-7, 7]) { const x = voice(ac, o, 'triangle', hz(n), t, 0.35, v, d, 0.5, [1300]); x.detune.value = c; } },
    arp: (ac, o, t, n, d, v) => voice(ac, o, 'square', hz(n), t, 0.004, v, 0.02, 0.16, [2600]),
    lead: (ac, o, t, n, d, v) => { const x = voice(ac, o, 'sawtooth', hz(n), t, 0.02, v, d * 0.9, 0.12, [2200]); const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = 6; l.connect(lg); lg.connect(x.detune); l.start(t); l.stop(t + d + 0.2); },
    bell: (ac, o, t, n, d, v) => { voice(ac, o, 'sine', hz(n), t, 0.003, v, 0.01, 1.4); voice(ac, o, 'sine', hz(n) * 2.76, t, 0.003, v * 0.35, 0.01, 0.6); },
    kick: (ac, o, t, n, d, v) => { const x = ac.createOscillator(), g = ac.createGain(); x.frequency.setValueAtTime(130, t); x.frequency.exponentialRampToValueAtTime(40, t + 0.16); env(g, t, 0.002, v, 0.01, 0.2); x.connect(g); g.connect(o); x.start(t); x.stop(t + 0.3); },
    snare: (ac, o, t, n, d, v) => { hit(ac, o, t, 0.14, v, 1800, 'bandpass'); voice(ac, o, 'triangle', 190, t, 0.002, v * 0.6, 0.01, 0.07); },
    hat: (ac, o, t, n, d, v) => hit(ac, o, t, 0.035, v, 7000, 'highpass'),
    tom: (ac, o, t, n, d, v) => { const x = ac.createOscillator(), g = ac.createGain(); x.frequency.setValueAtTime(170, t); x.frequency.exponentialRampToValueAtTime(85, t + 0.22); env(g, t, 0.002, v, 0.01, 0.26); x.connect(g); g.connect(o); x.start(t); x.stop(t + 0.35); },
    // 剧情灵魂：阴郁的那几样
    // 八音盒：正弦 + 高泛音，很快衰减；每个音随机走调几音分（旧了）
    box: (ac, o, t, n, d, v) => { const c = (Math.random() - 0.5) * 28; const a = voice(ac, o, 'sine', hz(n), t, 0.002, v, 0.01, 1.1); a.detune.value = c; const b = voice(ac, o, 'sine', hz(n) * 4.02, t, 0.002, v * 0.18, 0.005, 0.25); b.detune.value = c; },
    // 低长音：两根锯齿波过低通，慢慢起、慢慢落
    drone: (ac, o, t, n, d, v) => { for (const c of [-6, 6]) { const x = voice(ac, o, 'sawtooth', hz(n), t, d * 0.35, v, d * 0.7, d * 0.5, [260]); x.detune.value = c; } },
    // 收音机杂音：一小段带通噪声
    crackle: (ac, o, t, n, d, v) => { if (Math.random() < 0.5) hit(ac, o, t, 0.02 + Math.random() * 0.05, v * (0.4 + Math.random() * 0.6), 1800 + Math.random() * 2400, 'bandpass'); },
    // 远处拖铁：金属的一声
    clank: (ac, o, t, n, d, v) => { hit(ac, o, t, 0.25, v, 900, 'bandpass'); voice(ac, o, 'triangle', 190, t, 0.002, v * 0.5, 0.01, 0.4).frequency.exponentialRampToValueAtTime(120, t + 0.4); },
    // 心跳：两下闷响
    thump: (ac, o, t, n, d, v) => { for (const [dt, k] of [[0, 1], [0.16, 0.6]]) { const x = ac.createOscillator(), g = ac.createGain(); x.frequency.setValueAtTime(70, t + dt); x.frequency.exponentialRampToValueAtTime(38, t + dt + 0.14); env(g, t + dt, 0.004, v * k, 0.01, 0.2); x.connect(g); g.connect(o); x.start(t + dt); x.stop(t + dt + 0.3); } },
    // 冷的钢琴：三角波 + 正弦，按下去以后慢慢没
    piano: (ac, o, t, n, d, v) => { voice(ac, o, 'triangle', hz(n), t, 0.004, v, 0.02, 2.2, [1800]); voice(ac, o, 'sine', hz(n) * 2, t, 0.004, v * 0.25, 0.01, 1.2); },
  };
  // ── 曲目。root：主音 midi；chords：每小节一个和弦（相对主音的半音）；scale：旋律用的音阶
  // 节奏型 16 个字一小节：贝斯 x 根音 o 高八度 5 五度 - 延长 . 休止；琶音 / 钟 0–3 是和弦第几个音（4–7 再高八度）；鼓 x 敲
  // lead：每小节一行，0–9 a b 是音阶第几级（高一个八度起），- 延长
  // 剧情灵魂（2026-11-16）：六首都改暗、放慢；加林桥 / 阿隼 / 陆峥 / E-17 四段主题。设计：design/features/story-soul/design.md 第六节
  const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19], PHRY = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19];
  const TR = {
    // 据点：没人的铺子里开着一台旧收音机。低长音铺底，走调的八音盒断断续续，杂音
    hub: { name: '据点', bpm: 58, root: 57, vol: 1, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -4, 0, 3], [-5, -1, 2, 7]], scale: MINOR,
      drone: true, bass: 'x---------------', crackle: '..x....x...x..x.',
      box: ['4---3---2-------', '........0---2---', '4---3---2---1---', '................'] },
    // 线路图：心跳一样的低频，慢慢升起又落下的长音，没有旋律
    map: { name: '线路图', bpm: 64, root: 50, vol: 0.9, chords: [[0, 3, 7, 12], [-2, 3, 7, 10], [-4, 0, 3, 8], [-5, -2, 2, 7]],
      drone: true, pad: true, thump: 'x.......x.......', crackle: '.......x........' },
    // 安全：空站的回声。很稀的贝斯，远处偶尔一声报站提示音
    calm: { name: '安全', bpm: 60, root: 52, vol: 1, chords: [[0, 3, 7, 12], [-4, 0, 3, 7], [0, 3, 7, 12], [-2, 2, 5, 10]],
      drone: true, bass: 'x---------------', bell: ['', '', '......6.4...0...', ''], crackle: '...........x....' },
    // 危险：速度不变，换成弗里几亚，远处有东西在拖铁
    danger: { name: '危险', bpm: 112, root: 54, vol: 1, chords: [[0, 3, 7, 12], [1, 5, 8, 13], [0, 3, 7, 12], [-2, 1, 5, 10]],
      bass: 'xxoxxxoxxxoxxxox', arp: '0.1.2.3.0.1.2.3.', kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x...x.x.x...x.x.', clank: '...x.........x..' },
    // 撤离战：保留驱动感，主旋律压低、变暗，底下一根警报一样的长音
    extract: { name: '撤离战', bpm: 132, root: 48, vol: 1, chords: [[0, 3, 7, 12], [1, 5, 8, 13], [-2, 2, 5, 10], [-5, -1, 2, 7]],
      scale: PHRY, drone: true,
      bass: 'x.o.x.o.x.o.x.o.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', clank: '.......x........',
      lead: ['4---3-1---3-4-3-', '1---0-1-------..', '3---4-5---4-3-1-', '0---1-3-------..'] },
    // 首领：更重。低音加厚，加一层长音和拖铁
    boss: { name: '首领', bpm: 120, root: 46, vol: 1, chords: [[0, 3, 7, 12], [1, 5, 8, 13], [0, 3, 7, 12], [-2, 2, 5, 10]],
      scale: PHRY, drone: true,
      bass: 'x..x..x.x..x..x.', kick: 'x..x....x..x....', snare: '........x.......', tom: 'x.....x.....x.x.', hat: '..x...x...x...x.', clank: '....x.......x...',
      lead: ['0---1---0-------', '3---4---1-------', '0---1---0---4---', '3-------1---0---'] },
    // ── 主题
    // 林桥：八音盒一句 6 个音，第二遍总少弹最后一个音
    th_lin: { name: '林桥', bpm: 64, root: 64, vol: 1, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [0, 3, 7, 10], [-4, 0, 3, 7]], scale: MINOR,
      drone: true, crackle: '....x.......x...',
      box: ['0-2-4-3-2---1---', '................', '0-2-4-3-2-------', '................'] },
    // 阿隼：拨弦贝斯，不安的切分
    th_ahsun: { name: '阿隼', bpm: 84, root: 45, vol: 1, chords: [[0, 3, 7, 10], [1, 5, 8, 13], [0, 3, 7, 10], [-2, 2, 5, 10]],
      bass: 'x..x..x...x.x...', hat: '......x.......x.', crackle: '..x.......x.....', clank: '...............x' },
    // 陆峥：慢而冷的钢琴，每小节一个和弦
    th_lu: { name: '陆峥', bpm: 56, root: 55, vol: 1, chords: [[0, 3, 7, 11], [-4, 0, 3, 7], [-7, -3, 0, 4], [-5, -1, 2, 6]],
      drone: true, piano: ['x...........4...', 'x...............', 'x.......2.......', 'x...............'] },
    // E-17：站台报站提示音的三个音（叮—咚—叮）倒过来、放慢、加长回声
    th_e17: { name: 'E-17', bpm: 52, root: 52, vol: 1, chords: [[0, 4, 7, 12], [-3, 0, 4, 9], [-5, -1, 2, 7], [-3, 0, 4, 9]],
      drone: true, crackle: '.x..........x...', bell: ['0.......2.......', '4...............', '................', '0.......2.......'] },
    // 尾声（公开结局）：那三个音终于正着弹完，底下一个暖的大和弦
    th_e17_resolve: { name: 'E-17（到站）', bpm: 52, root: 52, vol: 1, chords: [[0, 4, 7, 12], [5, 9, 12, 17], [0, 4, 7, 12], [7, 11, 14, 19]],
      pad: true, drone: true, bell: ['4.......2.......', '0...............', '4.......2.......', '0.......4.......'] },
  };
  M.TRACKS = TR;
  const PART = { bass: 0.2, pad: 0.06, arp: 0.05, bell: 0.05, lead: 0.07, kick: 0.5, snare: 0.18, hat: 0.045, tom: 0.32, box: 0.07, drone: 0.05, crackle: 0.05, clank: 0.12, thump: 0.5, piano: 0.07 };
  // 排一个 16 分音符步：s 是第几步，t 是开始时间
  function stepAt(ac, out, T, s, t) {
    const i = s % 16, bar = Math.floor(s / 16) % T.chords.length, ch = T.chords[bar], st = 60 / T.bpm / 4, R = T.root, v = T.vol || 1;
    const len = (pat, k) => { let n = 1; while (k + n < 16 && pat[k + n] === '-') n++; return n * st; };
    let n = 0;
    if (T.bass) { const c = T.bass[i]; if (c === 'x' || c === 'o' || c === '5') { INST.bass(ac, out, t, R - 12 + ch[0] + (c === 'o' ? 12 : c === '5' ? 7 : 0), len(T.bass, i), PART.bass * v); n++; } }
    if (T.pad && i === 0) { for (const c of ch.slice(0, 3)) INST.pad(ac, out, t, R + c, st * 15, PART.pad * v); n++; }
    if (T.arp) { const c = T.arp[i]; if (c >= '0' && c <= '7') { const k = +c; INST.arp(ac, out, t, R + 12 + ch[k % 4] + (k >= 4 ? 12 : 0), st, PART.arp * v); n++; } }
    if (T.bell) { const row = T.bell[bar] || '', c = row[i]; if (c && c >= '0' && c <= '7') { const k = +c; INST.bell(ac, out, t, R + 24 + ch[k % 4] + (k >= 4 ? 12 : 0), 1, PART.bell * v); n++; } }
    if (T.lead) { const row = T.lead[bar] || '', c = row[i]; if (c && c !== '-' && c !== '.') { const k = parseInt(c, 16); INST.lead(ac, out, t, R + 12 + T.scale[k], len(row, i), PART.lead * v); n++; } }
    for (const d of ['kick', 'snare', 'hat', 'tom', 'crackle', 'clank', 'thump']) if (T[d] && T[d][i] === 'x') { INST[d](ac, out, t, 0, st, PART[d] * v * (d === 'hat' && i % 4 ? 0.7 : 1)); n++; }
    // 剧情灵魂：低长音（每小节一次，根音低一个八度）、八音盒旋律（像 lead：音阶第几级，- 延长）、冷钢琴和弦（0–3 和弦第几个音，x 整个和弦）
    if (T.drone && i === 0) { INST.drone(ac, out, t, R - 12 + ch[0], st * 16, PART.drone * v); n++; }
    if (T.box) { const row = T.box[bar] || '', c = row[i]; if (c && c !== '-' && c !== '.') { const k = parseInt(c, 16); INST.box(ac, out, t, R + 12 + T.scale[k], len(row, i), PART.box * v); n++; } }
    if (T.piano) { const row = T.piano[bar] || '', c = row[i]; if (c === 'x') { for (const q of ch.slice(0, 3)) INST.piano(ac, out, t, R + q, st, PART.piano * v); n++; } else if (c && c >= '0' && c <= '7') { const k = +c; INST.piano(ac, out, t, R + 12 + ch[k % 4] + (k >= 4 ? 12 : 0), st, PART.piano * v); n++; } }
    return n;
  }

  // ── 播放：每首一个 player（自己的增益节点），换曲时旧的淡出、新的淡入
  let players = [], timer = null;
  const LEVEL = 0.55; // 音乐整体垫在音效下面
  function tick() {
    const ac = D.Sfx && D.Sfx.ctx && D.Sfx.ctx(); if (!ac) return;
    for (const p of players) while (p.next < ac.currentTime + 0.15) { if (p.next > ac.currentTime - 0.05) M.notes += stepAt(ac, p.gain, TR[p.key], p.step, p.next); p.step++; p.next += 60 / TR[p.key].bpm / 4; }
    players = players.filter(p => !(p.end && ac.currentTime > p.end));
  }
  M.play = function (key) {
    const ac = D.Sfx && D.Sfx.ctx && D.Sfx.ctx(), bus = D.Sfx && D.Sfx.musicBus && D.Sfx.musicBus(); if (!ac || !bus || !TR[key] || key === M.cur) return;
    const t = ac.currentTime;
    for (const p of players) if (!p.end) { p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(p.gain.gain.value, t); p.gain.gain.linearRampToValueAtTime(0.0001, t + 1.2); p.end = t + 1.3; }
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(LEVEL, t + 1.2); g.connect(bus);
    players.push({ key, gain: g, step: 0, next: t + 0.05 }); M.cur = key;
    if (!timer) timer = setInterval(tick, 25);
    tick();
  };
  M.stop = function () { const ac = D.Sfx && D.Sfx.ctx && D.Sfx.ctx(); if (!ac) return; const t = ac.currentTime; for (const p of players) { p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(p.gain.gain.value, t); p.gain.gain.linearRampToValueAtTime(0.0001, t + 0.6); p.end = t + 0.7; } M.cur = null; };

  // ── 按场景挑曲目
  M.moodOf = function (G, dt) {
    switch (G.mode) {
      case 'title': case 'result': return 'hub';
      case 'hub': return G.tab === 'map' ? 'map' : 'hub';
      case 'brief': case 'travel': return 'map';
      case 'scene': return D.Scene ? D.Scene.music() : 'hub'; // 剧情屋：这一场的主题
      case 'station': {
        const S = G.S; if (!S) return 'calm';
        if (S.tut) return 'calm'; if (S.safe) return 'hub';
        if (S.enemies.some(e => !e.dead && e.f === S.f && e.aware && D.ENEMIES[e.kind].boss)) return 'boss';
        if (S.extract || S.outro) return 'extract';
        const n = S.enemies.filter(e => !e.dead && e.f === S.f && e.aware && !e.migrant).length;
        if (D.threatLv(S.raid) >= 4 || n >= 3) M.dangerT = 6; else M.dangerT -= dt || 0;
        return M.dangerT > 0 ? 'danger' : 'calm';
      }
    }
    return M.cur || 'hub';
  };
  M.update = function (G, dt) {
    const ac = D.Sfx && D.Sfx.ctx && D.Sfx.ctx(); if (!ac) return;
    const want = M.moodOf(G, dt); if (want && want !== M.cur) M.play(want);
  };
  // 测试用：离线把一首渲染 sec 秒，返回 { rms, notes }
  // 把一首排进给定的音频上下文（离线渲染、导出试听用），返回排了多少个音
  M.renderInto = function (ac, out, key, sec) { const T = TR[key], st = 60 / T.bpm / 4; let notes = 0; for (let s = 0, t = 0.02; t < sec; s++, t += st) notes += stepAt(ac, out, T, s, t); return notes; };
  M.renderOffline = async function (key, sec) {
    const sr = 22050, OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, ac = new OC(1, Math.ceil(sr * sec), sr);
    const notes = M.renderInto(ac, ac.destination, key, sec);
    const buf = await ac.startRendering(), d = buf.getChannelData(0); let sum = 0, peak = 0; for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); }
    return { rms: Math.sqrt(sum / d.length), peak, notes };
  };
})(D);
