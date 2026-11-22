/* 配乐第二代 · P3：站里探索（第三节 C）。每首三层：探索（只有底和氛围）/ 警觉（脉冲、打击）/ 交火（鼓组、贝斯推满）。
   8 个音色家族各 2 首（地铁站台的第一首是 tracks-p0 的空站台）+ 9 首专门的。pool 写 explore_<家族>，调度（src/music.js）按站型和这一层的主题挑。
   city: true 的曲子在四座城里各叠一层城市色（src/music/city.js）。vol 按 M2.pt(乐器, 目标响度) 算，cal 是校准脚本写的微调。
   设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2, T = M2.track, pt = M2.pt;
  const R = '................', L = '----------------', X = 'x---------------', Z = '0---------------';
  const B = (...b) => b.join('|'), B4 = b => B(b, b, b, b), R4 = B4(R), HOLD2 = B(Z, L), HOLD4X = B(X, L, L, L), HOLD2X = B(X, L);
  const FILL = B(R, R, R, '........x.x.xxx.');

  // ── 常用的几样（每首再按自己的调、谱子改）
  const drone = (root, lv, o) => pt('drone', lv ?? -31, { mode: 'deg', root, rev: 0.3, o: Object.assign({ cut: 270 }, o), p: { '*': HOLD2 } });
  const wind = (f, lv, pan) => pt('wind', lv ?? -35, { pan: pan ?? -0.1, rev: 0.4, o: { f, q: 0.8 }, p: { '*': HOLD4X } });
  const radio = lv => pt('crackle', lv ?? -39, { pan: 0.35, rev: 0.1, p: { '*': HOLD4X } });
  // 警觉层
  const arp = (center, p, o) => pt('arp', -31, Object.assign({ mode: 'chord', layer: 'alert', center, pan: -0.4, rev: 0.3, dly: 0.15, o: { cut: 1500, q: 6, dec: 0.13 }, p: p || { '*': '0.1.2.3.0.1.2.3.' } }, o));
  const heart = p => pt('thump', -27, { layer: 'alert', rev: 0.1, p: p || { '*': 'x.......x.......' } });
  const tick = p => pt('tick', -35, { layer: 'alert', pan: 0.3, rev: 0.2, p: p || { '*': '..x.g.x...x.g.x.' } });
  const pulse = (low, p) => pt('bass', -29, { mode: 'bass', layer: 'alert', low, duck: true, o: { type: 'sub' }, p: p || { '*': 'x...x...x...x...' } });
  // 交火层
  const kick = p => pt('kick', -21, { layer: 'combat', side: 0.45, rev: 0.05, p: p || { '*': 'x.....x...x.....' } });
  const snare = p => pt('snare', -24, { layer: 'combat', rev: 0.3, p: p || { '*': '....x.......x...' } });
  const hat = p => pt('hat', -31, { layer: 'combat', pan: 0.3, velRand: 0.3, p: p || { '*': 'XgxgXgxgXgxgXgxg' } });
  const ohat = p => pt('ohat', -33, { layer: 'combat', pan: -0.2, p: p || { '*': '......x.......x.' } });
  const bass = (low, p, o) => pt('bass', -23, { mode: 'bass', layer: 'combat', low, duck: true, o: Object.assign({ cut: 230, q: 6, env: 7, dec: 0.07 }, o), p: p || { '*': 'x..x..x.x..x.ox.' } });
  const tom = p => pt('tom', -26, { layer: 'combat', pan: -0.2, rev: 0.3, p: p || { '*': FILL } });
  const choir = (center, vowel, p) => pt('choir', -30, { mode: 'chord', layer: 'combat', center, rev: 0.6, o: { vowel: vowel || 'o' }, p: p || { '*': HOLD2X } });
  const metal = (lv, p, layer) => pt('metal', lv ?? -31, { layer: layer || 'combat', pan: 0.5, rev: 0.55, p: p || { '*': B(R, '...........x....') } });

  // ════ 地铁站台（废弃站、医院站、虫巢、检查站、水淹站）· 第二首；第一首是 tracks-p0 的空站台
  T('plat_tiles', {
    name: '白瓷砖', pool: 'explore_platform', city: true, desc: '地铁站台：瓷砖墙的回声、滴答的报站钟', bpm: 88, scale: 'minor', space: 'tunnel', tape: 0.4, sat: 0.5, gain: 0.94, cal: { pad: 0.77, e17: 0.63, piano: 1.27, snare: 1.28, hat: 1.26, ohat: 1.86, choir: 1.19 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Dm9 | Dm9 | Bbmaj7 | Bbmaj7 | Gm9 | Gm9 | Bbmaj7 | A7sus4' },
      { name: 'B', bars: 8, chords: 'Bbmaj7 | C6 | Dm9 | Dm9 | Bbmaj7 | C6 | Am7 | Am7' },
      { name: 'C', bars: 8, chords: 'Ebmaj7 | Ebmaj7 | Dm | Dm | Ebmaj7 | F6 | Dm | Dm' },
    ],
    form: ['A', 'B', 'A', 'C', 'B'], loop: 0,
    parts: {
      drone: drone(38), wind: wind(400),
      pad: pt('strings', -31, { mode: 'chord', center: 62, rev: 0.55, o: { a: 2, r: 2.5, cut: 1900 }, p: { A: HOLD2X, B: X, C: HOLD2X } }),
      drip: pt('bell', -32, { mode: 'chord', center: 84, pan: 0.5, rev: 0.6, dly: 0.35, prob: 0.7, p: { '*': B('0.......2.......', R, '........1.......', R) } }),
      e17: pt('chime', -28, { mode: 'deg', root: 62, pan: -0.5, rev: 0.85, dly: 0.2, p: { A: B(R, R, R, R, R, R, '2.......0.......', R), C: B('2.......0.......', R, R, R, R, R, R, R) } }),
      piano: pt('piano', -29, { mode: 'chord', center: 50, pan: 0.1, rev: 0.5, prob: 0.85, human: 0.02, p: { A: B('0...............', '........2.......', R, R), B: B('0.......1.......', R) } }),
      arp: arp(65), heart: heart(), tick: tick(), pulse: pulse(26),
      kick: kick({ '*': 'x.....x...x.....', C: B('x.......x.......', 'x.....x...x.x...') }), snare: snare(), hat: hat(), ohat: ohat(), bass: bass(26, { '*': 'x..x..x.x..x.ox.', B: 'x..x..x...x.x.o.' }),
      metal: metal(), choir: choir(62, 'o', { A: HOLD2X, C: HOLD2X }), tom: tom(),
    },
  });

  // ════ 商业（商圈、博物馆、银行）：坏掉的商场背景音乐，甜的和弦放慢、走调
  T('com_muzak', {
    name: '没人听的广播', pool: 'explore_commerce', city: true, desc: '商业：坏掉的商场背景音乐，甜的和弦放慢、走调', bpm: 84, scale: 'major', space: 'hall', tape: 1.6, sat: 0.4, gain: 0.85, cal: { ep: 0.57, tune: 0.84, arp: 1.24, kick: 1.2, snare: 1.49, hat: 3.62, choir: 1.22, metal: 1.24 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Fmaj9 | Em7 | Dm9 | Cmaj7 | Bbmaj7 | Am7 | Gm9 | C7sus4' },
      { name: 'B', bars: 8, chords: 'Bbmaj7 | C6 | Am7 | Dm9 | Bbmaj7 | C6 | Gm9 | C7sus4' },
      { name: 'C', bars: 4, chords: 'Dbmaj7 | Dbmaj7 | Cm7 | C7sus4' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      ep: pt('epiano', -27, { mode: 'chord', center: 62, pan: -0.2, rev: 0.45, dly: 0.15, human: 0.02, detuneRand: 22, p: { A: 'x.......x.......', B: 'x...........2...', C: X } }),
      tune: pt('musicbox', -28, { mode: 'deg', root: 77, pan: 0.35, rev: 0.5, dly: 0.2, prob: 0.85, detuneRand: 30, p: { A: B('4---2---0---2---', '1-------........', '3---1---6---5---', '4---------------'), B: B(R, '2---4---5---4---', R, '3-------2-------') } }),
      lowp: pt('pluck', -30, { mode: 'bass', low: 41, pan: 0.05, rev: 0.2, p: { '*': 'x.......5.......' } }),
      drone: drone(41, -34), radio: radio(-38),
      arp: arp(69, { '*': '0.1.2.3.0.1.2.3.', B: '0.2.1.3.0.2.1.3.' }), tick: tick({ '*': 'x.g.x.g.x.g.x.g.' }), pulse: pulse(29),
      kick: kick(), snare: snare({ '*': '....x.......x...' }), hat: hat({ '*': 'x.x.x.x.x.x.x.x.' }), bass: bass(29, { '*': 'x..x..x.x.o.x...' }),
      choir: choir(65, 'a'), metal: metal(-32), tom: tom(),
    },
  });
  T('com_vault', {
    name: '柜台后面', pool: 'explore_commerce', city: true, desc: '商业：博物馆和银行，玻璃一样的钟、冷的长音', bpm: 76, scale: 'harmonic', space: 'hall', tape: 0.4, sat: 0.35, gain: 1.03, cal: { piano: 0.8, clock: 1.54, arp: 1.58, heart: 1.32, pulse: 1.54, kick: 1.32, snare: 1.59, hat: 2.62, ohat: 2.06, choir: 0.81 }, delay: 1,
    sections: [
      { name: 'A', bars: 8, chords: 'Am | Am | Fmaj7 | Fmaj7 | Dm9 | Dm9 | E7sus4 | E' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am | Fmaj7 | G6 | E7sus4 | E' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      glass: pt('bell', -30, { mode: 'chord', center: 86, pan: 0.45, rev: 0.75, dly: 0.3, p: { A: B('0...........2...', R, '........1.......', R), B: B('2.......0.......', '....3...........') } }),
      cold: pt('strings', -31, { mode: 'chord', center: 69, maxV: 3, rev: 0.6, o: { a: 3, r: 3, cut: 2400 }, p: { '*': HOLD2X } }),
      piano: pt('piano', -28, { mode: 'chord', center: 55, pan: -0.25, rev: 0.5, human: 0.015, p: { A: B('x...............', R, '0.......2.......', R), B: 'x.......2.......' } }),
      drone: drone(33), clock: pt('tick', -38, { pan: -0.5, rev: 0.25, p: { '*': 'x.......x.......' } }),
      arp: arp(64, { '*': '0...1...2...3...', B: '0.1.2.3.0.1.2.3.' }), heart: heart(), pulse: pulse(33, { '*': 'x.......x.......' }),
      kick: kick({ '*': 'x.......x..x....' }), snare: snare(), hat: hat({ '*': 'x.g.x.g.x.g.x.g.' }), ohat: ohat(), bass: bass(33, { '*': 'x...x.x.x...x.o.' }),
      choir: choir(64, 'u'), tom: tom(),
    },
  });

  // ════ 工业（机库、自动工厂、维修库、军械库、旧货运站）：机器的节奏、金属敲击、锯齿贝斯
  T('ind_press', {
    name: '冲压线', pool: 'explore_industrial', city: true, desc: '工业：远处的冲压机一下一下，金属、锯齿贝斯', bpm: 100, scale: 'phrygian', space: 'hall', sat: 0.6, gain: 1.15, cal: { gear: 0.68, pad: 0.8, pulse: 0.63, kick: 0.72, hat: 0.75, bass: 0.59, choir: 1.34 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Em | Em | F | F | Em | Em | Dm | Dm' },
      { name: 'B', bars: 8, chords: 'Am | Am | Bb | Bb | Am | G | F | Em' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      press: pt('clank', -30, { pan: -0.45, rev: 0.6, p: { '*': B('x...............', '........x.......') } }),
      hiss: pt('wind', -36, { pan: 0.3, rev: 0.3, o: { f: 2200, q: 1.2, rate: 0.3 }, p: { '*': B('x-------........', R) } }),
      drone: drone(28, -30, { cut: 320 }),
      gear: pt('tick', -37, { pan: 0.45, rev: 0.25, p: { '*': 'x..x..x.x..x..x.' } }),
      pad: pt('pad', -33, { mode: 'chord', center: 59, rev: 0.4, fx: [['highpass', 300]], o: { cut: 1100, a: 2, r: 2 }, p: { '*': HOLD2X } }),
      arp: arp(64, { '*': '0.0.1.0.2.0.3.0.' }, { o: { cut: 1200, q: 8, dec: 0.1 } }), pulse: pulse(28, { '*': 'x.x.x.x.x.x.x.x.' }),
      anvil: metal(-30, { '*': B('....x.......x...', R) }, 'alert'),
      kick: kick({ '*': 'x..x..x...x..x..' }), snare: snare({ '*': '....x.......x..x' }), hat: hat({ '*': 'x.xxx.xxx.xxx.xx' }), bass: bass(28, { '*': 'xxoxxxoxxxoxxxox' }, { cut: 260 }),
      tom: tom(), choir: choir(59, 'a', { B: HOLD2X }),
    },
  });
  T('ind_nightshift', {
    name: '维修库的夜班', pool: 'explore_industrial', city: true, desc: '工业：没人的夜班，传送带和继电器', bpm: 92, scale: 'minor', space: 'hall', tape: 0.3, sat: 0.55, gain: 1.19, cal: { belt: 0.53, clank: 1.2, drone: 0.8, pad: 0.8, snare: 1.23, ohat: 1.7, choir: 1.39 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Cm | Cm | Abmaj7 | Abmaj7 | Fm7 | Fm7 | G7sus4 | G' },
      { name: 'B', bars: 8, chords: 'Abmaj7 | Bb | Cm | Cm | Abmaj7 | Bb | G7sus4 | G' },
      { name: 'C', bars: 8, chords: 'Fm | Fm | Db | Db | Fm | Fm | G | G' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      belt: pt('shaker', -37, { pan: 0.35, velRand: 0.4, p: { '*': 'g.g.g.g.g.g.g.g.' } }),
      relay: pt('tick', -36, { pan: -0.4, rev: 0.25, prob: 0.8, p: { '*': 'x.....x...x.....' } }),
      clank: pt('clank', -32, { pan: 0.5, rev: 0.6, p: { '*': B(R, R, '..........x.....', R) } }),
      drone: drone(36), pad: pt('strings', -32, { mode: 'chord', center: 60, rev: 0.45, o: { a: 2, r: 2.5, cut: 1800 }, p: { '*': HOLD2X } }),
      ep: pt('epiano', -29, { mode: 'chord', center: 64, pan: -0.25, rev: 0.4, prob: 0.8, p: { A: B('0.......2.......', R), C: B('x...............', R) } }),
      arp: arp(67), heart: heart(), pulse: pulse(24),
      kick: kick({ '*': 'x.....x...x.....', C: 'x.....x.x...x...' }), snare: snare(), hat: hat(), ohat: ohat(), bass: bass(24),
      metal: metal(), choir: choir(60, 'o', { C: HOLD2X }), tom: tom(),
    },
  });

  // ════ 机房（数据中心、调度中心、信号中继站）：冷的电子琶音、数据音、嗡鸣
  T('mach_core', {
    name: '冷机房', pool: 'explore_machine', city: true, desc: '机房：服务器的嗡声、冷的琶音、数据音', bpm: 96, scale: 'minor', space: 'room', sat: 0.4, gain: 1.26, cal: { fan: 0.57, cold: 1.25, data: 0.81, tick: 0.67, snare: 1.31, hat: 0.83, choir: 0.79, tom: 0.79 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Bm | Bm | Gmaj7 | Gmaj7 | Em9 | Em9 | F#7sus4 | F#' },
      { name: 'B', bars: 8, chords: 'Gmaj7 | A | Bm | Bm | Gmaj7 | A | F#7sus4 | F#' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      hum: drone(59, -36, { cut: 700 }),
      fan: pt('wind', -37, { rev: 0.2, o: { f: 1600, q: 0.6, rate: 0.05 }, p: { '*': HOLD4X } }),
      cold: pt('arp', -33, { mode: 'chord', center: 71, pan: 0.35, rev: 0.4, dly: 0.25, o: { cut: 900, q: 4, dec: 0.2 }, p: { A: '0...1...2...3...', B: '3...2...1...0...' } }),
      data: pt('blip', -32, { mode: 'deg', root: 83, pan: -0.45, rev: 0.5, dly: 0.3, prob: 0.6, p: { '*': B('0.....4.........', '........7...4...') } }),
      sub: drone(35, -33),
      arp: arp(66, { '*': '0.1.2.3.0.1.2.3.', B: '0.1.2.3.4.3.2.1.' }), tick: tick({ '*': 'x.x.x.x.x.x.x.x.' }), pulse: pulse(35),
      kick: kick(), snare: snare(), hat: hat(), ohat: ohat(), bass: bass(35, { '*': 'x..x..x.x..x..x.' }),
      choir: choir(66, 'u'), metal: metal(), tom: tom(),
    },
  });
  T('mach_dispatch', {
    name: '调度台', pool: 'explore_machine', city: true, desc: '机房：调度台上排班的声音，继电器和打字一样的数据', bpm: 104, scale: 'dorian', space: 'room', sat: 0.45, gain: 1.24, cal: { relay: 0.79, data: 0.58, seq: 2.22, snare: 1.19, hat: 0.78, choir: 1.26, tom: 0.75 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Gm9 | Gm9 | C9 | C9 | Gm9 | Gm9 | Ebmaj7 | D7sus4' },
      { name: 'B', bars: 8, chords: 'Ebmaj7 | F6 | Dm7 | Gm9 | Ebmaj7 | F6 | Cm9 | D7sus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      relay: pt('tick', -35, { pan: 0.4, rev: 0.2, p: { '*': 'x..x..x...x..x..' } }),
      data: pt('blip', -31, { mode: 'deg', root: 79, pan: -0.35, rev: 0.45, dly: 0.25, prob: 0.7, p: { '*': B('0.2.4...........', '........4.2.0...') } }),
      seq: pt('arp', -33, { mode: 'chord', center: 67, pan: 0.3, rev: 0.3, dly: 0.2, o: { cut: 1100, q: 5, dec: 0.12 }, p: { '*': B('0.......1.......', '2.......3.......') } }),
      drone: drone(31), pad: pt('pad', -33, { mode: 'chord', center: 62, rev: 0.4, fx: [['highpass', 300]], o: { cut: 1300, a: 2, r: 2 }, p: { B: X } }),
      arp: arp(70), heart: heart(), pulse: pulse(31),
      kick: kick({ '*': 'x.....x...x...x.' }), snare: snare(), hat: hat(), bass: bass(31, { '*': 'x..x..x.x..x.ox.' }),
      metal: metal(), choir: choir(62, 'o', { B: HOLD2X }), tom: tom(),
    },
  });

  // ════ 地上夜城（街区、夜市、楼顶、码头、工地、街心公园）：开阔、远处的风、很远的警报
  T('surf_night', {
    name: '地上的夜', pool: 'explore_surface', city: true, desc: '地上：开阔的风、很远的警报、高处的长音', bpm: 80, scale: 'minor', space: 'hall', tape: 0.5, sat: 0.4, gain: 1.05, cal: { wind: 1.2, gust: 0.78, far: 1.31, guitar: 1.29, arp: 1.28, heart: 1.23, kick: 1.23, snare: 1.41, hat: 1.34, ohat: 1.98, metal: 1.24, choir: 1.25 }, delay: 1,
    sections: [
      { name: 'A', bars: 8, chords: 'Fm9 | Fm9 | Dbmaj7 | Dbmaj7 | Bbm9 | Bbm9 | C7sus4 | C' },
      { name: 'B', bars: 8, chords: 'Dbmaj7 | Eb6 | Cm7 | Fm9 | Dbmaj7 | Eb6 | Bbm9 | C7sus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      wind: wind(320, -33), gust: wind(900, -38, 0.4),
      far: pt('siren', -36, { mode: 'deg', root: 77, pan: -0.5, rev: 0.8, p: { A: B(R, R, R, R, Z, L, L, L) } }),
      high: pt('strings', -31, { mode: 'chord', center: 72, maxV: 3, pan: 0.2, rev: 0.6, o: { a: 3, r: 3, cut: 2600 }, p: { '*': HOLD2X } }),
      drone: drone(29),
      guitar: pt('pluck', -29, { mode: 'chord', center: 56, pan: -0.3, rev: 0.45, dly: 0.2, prob: 0.85, human: 0.015, p: { A: B('0.......1.......', R, '2.......1.......', R), B: '0...1...2.......' } }),
      arp: arp(65), heart: heart(), pulse: pulse(29),
      kick: kick(), snare: snare(), hat: hat(), ohat: ohat(), bass: bass(29),
      metal: metal(), choir: choir(65, 'a'), tom: tom(),
    },
  });
  T('surf_market', {
    name: '夜市散了', pool: 'explore_surface', city: true, desc: '地上：夜市散了以后，喇叭里还剩一点音乐', bpm: 90, scale: 'dorian', space: 'hall', tape: 1.2, sat: 0.4, gain: 1.22, cal: { speaker: 0.83, acc: 0.67, arp: 1.21, snare: 1.45, hat: 3.49, ohat: 3.54, metal: 1.27, choir: 1.37 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Em9 | A9 | Em9 | A9 | Cmaj7 | Bm7 | Am9 | B7sus4' },
      { name: 'B', bars: 8, chords: 'Cmaj7 | D6 | Bm7 | Em9 | Cmaj7 | D6 | Am9 | B7sus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      speaker: pt('epiano', -30, { mode: 'chord', center: 64, pan: 0.45, rev: 0.6, dly: 0.25, prob: 0.8, detuneRand: 18, fx: [['highpass', 500], ['lowpass', 2800]], p: { '*': B('x.......2.......', '....1.......3...') } }),
      acc: pt('accordion', -32, { mode: 'chord', center: 60, maxV: 3, pan: -0.3, rev: 0.4, p: { B: X } }),
      wind: wind(380, -35), drone: drone(28), radio: radio(-39),
      arp: arp(64), tick: tick(), pulse: pulse(28),
      kick: kick({ '*': 'x.....x.x...x...' }), snare: snare(), hat: hat({ '*': 'x.x.x.x.x.x.x.x.' }), ohat: ohat(), bass: bass(28, { '*': 'x..x..x.x..x.ox.' }),
      metal: metal(), choir: choir(64, 'o'), tom: tom(),
    },
  });

  // ════ 湿冷地下（下水道、溶洞、冷库）：滴水的节奏、低频、玻璃一样的高音
  T('wet_drip', {
    name: '滴水', pool: 'explore_wet', city: true, desc: '湿冷地下：滴水当节奏、很低的长音、玻璃一样的高音', bpm: 72, scale: 'phrygian', space: 'tunnel', sat: 0.35, gain: 1.19, cal: { arp: 1.91, heart: 1.34, kick: 1.36, snare: 2.14, hat: 2.03, choir: 0.8, tom: 1.21 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'C#m | C#m | D | D | C#m | C#m | Bm | Bm' },
      { name: 'B', bars: 8, chords: 'F#m | F#m | G | G | F#m | E | D | C#m' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      drip: pt('blip', -31, { mode: 'deg', root: 85, pan: 0.4, rev: 0.75, dly: 0.35, prob: 0.6, human: 0.04, p: { '*': B('0.......4.......', '......2.........') } }),
      drop2: pt('bell', -33, { mode: 'chord', center: 89, pan: -0.45, rev: 0.8, prob: 0.5, p: { '*': B(R, '....0...........', R, '..........1.....') } }),
      low: drone(25, -29, { cut: 200 }),
      water: pt('wind', -37, { rev: 0.3, o: { f: 1400, q: 2, rate: 0.2 }, p: { '*': HOLD4X } }),
      glass: pt('strings', -33, { mode: 'chord', center: 80, maxV: 2, pan: 0.2, rev: 0.7, o: { a: 3, r: 3, cut: 3500 }, p: { B: HOLD2X } }),
      arp: arp(61, { '*': '0...1...2...3...' }), heart: heart(), pulse: pulse(25),
      kick: kick({ '*': 'x.......x..x....' }), snare: snare({ '*': '........x.......' }), hat: hat({ '*': 'x.g.x.g.x.g.x.g.' }), bass: bass(25, { '*': 'x...x.x.x...x.o.' }),
      metal: metal(), choir: choir(61, 'u'), tom: tom(),
    },
  });
  T('wet_cave', {
    name: '溶洞', pool: 'explore_wet', city: true, desc: '湿冷地下：很大的洞，低频像有东西在呼吸', bpm: 66, scale: 'minor', space: 'tunnel', sat: 0.35, gain: 1.24, cal: { breath: 0.82, choirf: 0.51, stone: 1.81, arp: 1.99, heart: 1.41, kick: 1.74, snare: 2.09, hat: 1.6, bass: 1.41, choir: 1.22, tom: 1.21 }, delay: 1.5, delayFb: 0.45,
    sections: [
      { name: 'A', bars: 8, chords: 'Gm | Gm | Ebmaj7 | Ebmaj7 | Cm9 | Cm9 | D7sus4 | D' },
      { name: 'B', bars: 8, chords: 'Ebmaj7 | F | Dm7 | Gm | Ebmaj7 | F | D7sus4 | D' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      breath: pt('pad', -32, { mode: 'chord', center: 48, rev: 0.6, o: { cut: 500, a: 4, r: 4 }, p: { '*': HOLD2X } }),
      low: drone(31, -30, { cut: 220 }),
      drip: pt('blip', -32, { mode: 'deg', root: 91, pan: -0.4, rev: 0.85, dly: 0.4, prob: 0.5, human: 0.05, p: { '*': B('....0...........', '..........4.....') } }),
      choirf: pt('choir', -34, { mode: 'chord', center: 60, rev: 0.8, o: { vowel: 'u', a: 3, r: 4 }, p: { B: HOLD2X } }),
      stone: pt('tom', -32, { pan: 0.4, rev: 0.7, prob: 0.5, p: { '*': B(R, R, R, '..........x.....') } }),
      arp: arp(62, { '*': '0...1...2...3...' }), heart: heart(), pulse: pulse(31),
      kick: kick({ '*': 'x.......x.......' }), snare: snare({ '*': '........x.......' }), hat: hat({ '*': 'x...x.x.x...x.x.' }), bass: bass(31, { '*': 'x.....x.x.....o.' }),
      metal: metal(), choir: choir(62, 'o'), tom: tom(),
    },
  });

  // ════ 发光奇景（海洋馆、温室）：水下的慢琶音、发光的长音，有点美又有点不对劲
  T('glow_tank', {
    name: '水族箱', pool: 'explore_glow', city: true, desc: '发光奇景：水下的慢琶音、发光的长音，美里带一点不对劲', bpm: 70, scale: 'lydian', space: 'tunnel', tape: 0.8, sat: 0.3, gain: 1, cal: { under: 0.71, glow: 0.83, bubbles: 0.83, wrong: 0.75, arp: 1.43, heart: 1.43, kick: 1.45, snare: 1.74, hat: 5.54, ohat: 4.41, bass: 1.22, choir: 0.78, metal: 1.2, tom: 1.25 }, delay: 1,
    sections: [
      { name: 'A', bars: 8, chords: 'Dmaj7 | Dmaj7 | E6 | E6 | Bm9 | Bm9 | Gmaj7#11 | A' },
      { name: 'B', bars: 8, chords: 'Gmaj7 | A6 | F#m7 | Bm9 | Gmaj7 | A6 | Em9 | Fmaj7#11' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      under: pt('epiano', -29, { mode: 'chord', center: 66, pan: 0.3, rev: 0.7, dly: 0.3, fx: [['lowpass', 1600]], p: { '*': '0...1...2...3...', B: '3...2...1...0...' } }),
      glow: pt('pad', -31, { mode: 'chord', center: 62, rev: 0.6, o: { cut: 1800, a: 3, r: 3, wave: 'triangle' }, p: { '*': X } }),
      bubbles: pt('blip', -34, { mode: 'deg', root: 86, pan: -0.4, rev: 0.6, prob: 0.45, human: 0.03, p: { '*': B('..0.2...........', '........4.5.....') } }),
      drone: drone(38),
      wrong: pt('musicbox', -30, { mode: 'deg', root: 74, pan: -0.25, rev: 0.6, dly: 0.25, detuneRand: 35, p: { B: B(R, R, R, R, R, R, '0-2-4-3-2---1---', R) } }),
      arp: arp(66), heart: heart(), pulse: pulse(26),
      kick: kick({ '*': 'x.......x..x....' }), snare: snare(), hat: hat({ '*': 'x.g.x.g.x.g.x.g.' }), ohat: ohat(), bass: bass(26, { '*': 'x...x.x.x...x.o.' }),
      choir: choir(66, 'u'), metal: metal(), tom: tom(),
    },
  });
  T('glow_green', {
    name: '温室', pool: 'explore_glow', city: true, desc: '发光奇景：温室里的灯、潮湿的空气、慢慢长的东西', bpm: 76, scale: 'major', space: 'hall', tape: 0.6, sat: 0.3, gain: 1.01, cal: { lamp: 1.37, mist: 0.63, bell: 1.49, arp: 1.43, kick: 1.38, snare: 1.66, hat: 1.57, ohat: 2.12, choir: 1.33, metal: 1.39 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Abmaj7 | Abmaj7 | Fm9 | Fm9 | Dbmaj7 | Dbmaj7 | Bbm9 | Eb7sus4' },
      { name: 'B', bars: 8, chords: 'Dbmaj7 | Eb6 | Cm7 | Fm9 | Dbmaj7 | Eb6 | Bbm9 | Emaj7' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      lamp: pt('strings', -31, { mode: 'chord', center: 70, maxV: 3, rev: 0.55, o: { a: 2.5, r: 3, cut: 2600 }, p: { '*': X } }),
      sprout: pt('pluck', -29, { mode: 'chord', center: 63, pan: 0.35, rev: 0.45, dly: 0.25, human: 0.015, p: { '*': '0..1..2...3..2..', B: '0...2...1...3...' } }),
      mist: pt('wind', -37, { pan: -0.3, rev: 0.4, o: { f: 2600, q: 0.7, rate: 0.06 }, p: { '*': HOLD4X } }),
      drone: drone(32), bell: pt('bell', -33, { mode: 'chord', center: 87, pan: -0.45, rev: 0.75, prob: 0.6, p: { '*': B(R, '........0.......') } }),
      arp: arp(68), tick: tick(), pulse: pulse(32),
      kick: kick(), snare: snare(), hat: hat(), ohat: ohat(), bass: bass(32),
      choir: choir(68, 'a'), metal: metal(), tom: tom(),
    },
  });

  // ════ 楼层：检修管道（只剩低频和心跳）/ 楼上大厦（高处的空）；换乘层两首都可能
  T('floor_pipe', {
    name: '检修管道', pool: 'explore_floor_pipe', city: true, desc: '楼层：管道里只剩低频和心跳，偶尔一声蒸汽', bpm: 78, scale: 'phrygian', space: 'room', sat: 0.45, gain: 1.53, cal: { snare: 1.2, hat: 1.64, tom: 0.82 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Am | Am | Bb | Bb | Am | Am | Gm | Gm' },
      { name: 'B', bars: 8, chords: 'Dm | Dm | Eb | Eb | Dm | C | Bb | Am' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      low: drone(21, -28, { cut: 180 }), throb: pt('thump', -30, { rev: 0.1, p: { '*': 'x...............' } }),
      steam: pt('wind', -36, { pan: 0.5, rev: 0.3, o: { f: 3000, q: 1, rate: 0.4 }, p: { '*': B(R, R, 'x-------........', R) } }),
      pipe: pt('clank', -34, { pan: -0.5, rev: 0.7, prob: 0.6, p: { '*': B(R, '......x.........', R, R) } }),
      heartA: heart({ '*': 'x.......x.......' }), tick: tick({ '*': '....x.......x...' }), pulse: pulse(21),
      kick: kick({ '*': 'x..x....x..x....' }), snare: snare({ '*': '........x.......' }), hat: hat({ '*': '..x...x...x...x.' }), bass: bass(21, { '*': 'x..x..x.x..x..x.' }, { cut: 200 }),
      metal: metal(-30, { '*': B('....x.......x...', R) }), tom: tom(),
    },
  });
  T('floor_tower', {
    name: '楼上的空', pool: 'explore_floor_tower', city: true, desc: '楼层：楼上大厦，空的办公层，高处的风和电梯井', bpm: 84, scale: 'lydian', space: 'hall', tape: 0.4, sat: 0.35, gain: 0.99, cal: { glass: 1.32, office: 0.8, high: 1.46, arp: 1.31, heart: 1.26, kick: 1.25, snare: 1.55, hat: 1.92, ohat: 3.89, choir: 1.28, metal: 1.32 }, delay: 1,
    sections: [
      { name: 'A', bars: 8, chords: 'Cmaj7 | Cmaj7 | D6 | D6 | Am9 | Am9 | Fmaj7#11 | G6' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am9 | Fmaj7 | G6 | Dm9 | Esus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      wind: wind(600, -35, 0.3),
      glass: pt('chime', -30, { mode: 'chord', center: 84, pan: -0.45, rev: 0.8, dly: 0.3, prob: 0.7, p: { '*': B('0...............', R, '........2.......', R) } }),
      office: pt('epiano', -29, { mode: 'chord', center: 64, pan: 0.25, rev: 0.5, human: 0.015, p: { A: B('x...............', R), B: 'x.......2.......' } }),
      high: pt('strings', -32, { mode: 'chord', center: 76, maxV: 2, rev: 0.6, o: { a: 3, r: 3, cut: 3000 }, p: { '*': HOLD2X } }),
      shaft: drone(36, -32),
      arp: arp(64), heart: heart(), pulse: pulse(24),
      kick: kick(), snare: snare(), hat: hat(), ohat: ohat(), bass: bass(24),
      choir: choir(64, 'a'), metal: metal(), tom: tom(),
    },
  });

  // ════ 专门的 9 首
  // 停电站：几乎只有心跳和应急灯的嗡声；交火层是突然的噪声墙
  T('sp_blackout', {
    name: '停电', pool: 'explore_sp_blackout', city: true, desc: '停电站：心跳和应急灯的嗡声，打起来是一堵噪声墙', bpm: 70, scale: 'minor', space: 'room', sat: 0.7, gain: 1.05, cal: { low: 0.79, tickA: 0.68, pulse: 0.6, wall: 0.39, wall2: 1.44, kick: 0.63, bass: 0.57, metal: 0.66 }, delay: 0.75,
    sections: [{ name: 'A', bars: 8, chords: 'Ebm | Ebm | Ebm | Ebm | Cb | Cb | Ebm | Ebm' }],
    form: ['A'], loop: 0,
    parts: {
      lamp: pt('drone', -36, { mode: 'deg', root: 75, rev: 0.2, o: { cut: 1800 }, p: { '*': B(Z, L, L, L, '................', R, Z, L) } }),
      heartB: pt('thump', -27, { rev: 0.1, p: { '*': 'x.......x.......' } }),
      low: drone(27, -31),
      flick: pt('tick', -37, { pan: 0.4, rev: 0.3, prob: 0.5, p: { '*': B('..x.x...........', R, R, '..........x.x...') } }),
      tickA: tick({ '*': 'x.x.x.x.x.x.x.x.' }), pulse: pulse(27, { '*': 'x.x.x.x.x.x.x.x.' }),
      wall: pt('wind', -24, { layer: 'combat', rev: 0.2, o: { f: 1200, q: 0.3, a: 0.05, r: 0.8, rate: 2 }, p: { '*': HOLD2X } }),
      wall2: pt('riser', -30, { mode: 'deg', layer: 'combat', root: 39, rev: 0.4, p: { '*': B(R, Z, L, L) } }),
      kick: kick({ '*': 'x.x.x.x.x.x.x.x.' }), bass: bass(27, { '*': 'xxxxxxxxxxxxxxxx' }, { cut: 300 }), metal: metal(-28, { '*': 'x.......x.......' }),
    },
  });
  // 隐藏仓库：安静、贵重、不安
  T('sp_vault', {
    name: '没人知道的仓库', pool: 'explore_sp_vault', city: true, desc: '隐藏仓库：安静、贵重、不安', bpm: 64, scale: 'harmonic', space: 'room', tape: 0.5, sat: 0.3, gain: 1.23, cal: { gold: 1.32, felt: 0.6, clock: 1.22, arp: 2.23, heart: 1.22, kick: 1.35, snare: 1.35, hat: 1.85 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Em | Em | Cmaj7 | Cmaj7 | Am9 | Am9 | B7sus4 | B' },
      { name: 'B', bars: 8, chords: 'Cmaj7 | D6 | Bm7 | Em | Cmaj7 | D6 | B7sus4 | B' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      gold: pt('musicbox', -28, { mode: 'deg', root: 76, pan: 0.3, rev: 0.5, dly: 0.2, prob: 0.8, p: { A: B('0.......4.......', R, '6.......5.......', R), B: B('4...5...6.......', R, '7.......6---5---', R) } }),
      felt: pt('piano', -29, { mode: 'chord', center: 52, pan: -0.2, rev: 0.4, human: 0.015, p: { '*': B('x...............', R) } }),
      air: pt('strings', -33, { mode: 'chord', center: 64, maxV: 3, rev: 0.5, o: { a: 3, r: 3, cut: 1800 }, p: { B: HOLD2X } }),
      drone: drone(28), clock: pt('tick', -39, { pan: -0.4, rev: 0.2, p: { '*': 'x.......x.......' } }),
      arp: arp(64, { '*': '0...1...2...3...' }), heart: heart(), pulse: pulse(28),
      kick: kick(), snare: snare(), hat: hat(), bass: bass(28), choir: choir(64, 'u'), tom: tom(),
    },
  });
  // 未知信号（事件站）×2：收音机找台的声音 + 断续的旋律
  T('sig_tuning', {
    name: '找台', pool: 'signal', desc: '未知信号：收音机在找台，一段旋律时有时无', bpm: 72, scale: 'minor', space: 'room', tape: 1.5, sat: 0.4, gain: 1.24, cal: { sweep: 1.71, tune: 0.71 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Am9 | Am9 | Fmaj7 | Fmaj7 | Dm9 | Dm9 | Esus4 | E' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am9 | Fmaj7 | G6 | Esus4 | E' },
    ],
    form: ['A', 'B'], loop: 0,
    parts: {
      static: pt('crackle', -35, { pan: 0.2, rev: 0.1, p: { '*': HOLD4X } }),
      sweep: pt('siren', -37, { mode: 'deg', root: 81, pan: -0.3, rev: 0.3, o: { rate: 0.9, depth: 900 }, p: { '*': B('0-------........', R, R, '........0-------') } }),
      tune: pt('epiano', -28, { mode: 'deg', root: 69, pan: 0.15, rev: 0.4, dly: 0.2, prob: 0.6, fx: [['highpass', 500], ['lowpass', 2500]], p: { A: B('0---2---4-------', '3---2---1-------', R, '4---3---2-------'), B: B('2---4---5-------', R, '4---2---0-------', R) } }),
      drone: drone(33, -33), pad: pt('pad', -34, { mode: 'chord', center: 60, rev: 0.4, fx: [['highpass', 400], ['lowpass', 2000]], o: { a: 2, r: 2 }, p: { '*': X } }),
    },
  });
  T('sig_numbers', {
    name: '数字台', pool: 'signal', desc: '未知信号：有人在念数字的那种电台，报站音断断续续', bpm: 66, scale: 'phrygian', space: 'tunnel', tape: 1.2, sat: 0.4, gain: 1.13, cal: { strings: 0.82 }, delay: 1,
    sections: [{ name: 'A', bars: 8, chords: 'Em | Em | F | F | Em | Em | Dm | Dm' }, { name: 'B', bars: 8, chords: 'Am | Am | Bb | Bb | Am | G | F | Em' }],
    form: ['A', 'B'], loop: 0,
    parts: {
      static: pt('crackle', -35, { pan: -0.2, rev: 0.1, p: { '*': HOLD4X } }),
      beep: pt('blip', -31, { mode: 'deg', root: 76, pan: 0.3, rev: 0.4, dly: 0.2, p: { '*': B('0...0...0.......', R, '4...2...........', R) } }),
      e17: pt('chime', -29, { mode: 'deg', root: 64, pan: -0.4, rev: 0.85, dly: 0.3, prob: 0.7, p: { A: B(R, R, R, '2.......0.......'), B: B(R, R, R, R, R, R, '4.......0.......', '2---------------') } }),
      drone: drone(28), strings: pt('strings', -33, { mode: 'chord', center: 59, rev: 0.6, o: { a: 2.5, r: 3, cut: 1700 }, p: { B: HOLD2X } }),
    },
  });
  // 人类据点、流民营 ×2：人的声音最多的地方，手风琴、拨弦、篝火一样的节奏
  T('camp_fire', {
    name: '篝火', pool: 'explore_sp_camp', desc: '人类据点 / 流民营：手风琴、拨弦、篝火一样的节奏', bpm: 96, scale: 'dorian', space: 'room', tape: 0.8, sat: 0.35, gain: 0.84, cal: { tune: 1.85, guitar: 0.4, shake: 0.65 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Dm | G | Dm | G | F | C | Dm | A7sus4' },
      { name: 'B', bars: 8, chords: 'Bb | C | Am | Dm | Bb | C | Gm | A' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      acc: pt('accordion', -29, { mode: 'chord', center: 62, maxV: 3, pan: -0.25, rev: 0.3, p: { A: 'x.......x...x...', B: 'x-------x-------' } }),
      tune: pt('accordion', -27, { mode: 'deg', root: 74, pan: 0.3, rev: 0.35, dly: 0.1, human: 0.02, p: { B: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R) } }),
      guitar: pt('pluck', -27, { mode: 'chord', center: 55, pan: 0.35, rev: 0.25, human: 0.012, p: { '*': 'x..x..x.x..x..x.' } }),
      up: pt('pluck', -28, { mode: 'bass', low: 38, rev: 0.12, p: { '*': 'x.......5.......' } }),
      fire: pt('crackle', -36, { pan: -0.4, rev: 0.1, p: { '*': HOLD4X } }),
      hand: pt('tom', -30, { pan: -0.15, rev: 0.25, velRand: 0.3, p: { '*': 'x..x..x...x.x...' } }),
      shake: pt('shaker', -36, { pan: 0.4, velRand: 0.4, p: { '*': 'g.g.g.g.g.g.g.g.' } }),
    },
  });
  T('camp_tents', {
    name: '帐篷之间', pool: 'explore_sp_camp', desc: '人类据点 / 流民营：夜里的帐篷之间，有人在拨弦，有人在收音机里找歌', bpm: 72, scale: 'minor', space: 'room', tape: 1, sat: 0.3, gain: 1.17, cal: { guitar: 0.77, box: 0.76, acc: 0.78 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Gm9 | Ebmaj7 | Bbmaj7 | F6 | Gm9 | Ebmaj7 | Cm9 | D7sus4' },
      { name: 'B', bars: 8, chords: 'Ebmaj7 | F6 | Dm7 | Gm9 | Ebmaj7 | F6 | Cm9 | D7sus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      guitar: pt('pluck', -27, { mode: 'chord', center: 55, pan: -0.3, rev: 0.3, human: 0.015, p: { A: '0.1.2.1.3.2.1.2.', B: '0...2.1.3...2.1.' } }),
      box: pt('musicbox', -28, { mode: 'deg', root: 79, pan: 0.35, rev: 0.5, dly: 0.2, detuneRand: 15, p: { B: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R) } }),
      acc: pt('accordion', -32, { mode: 'chord', center: 60, maxV: 3, pan: 0.25, rev: 0.35, p: { B: X } }),
      radio: radio(-37), fire: pt('crackle', -38, { pan: -0.45, rev: 0.1, p: { '*': HOLD4X } }), drone: drone(31, -34),
    },
  });
  // 训练长厅：冷静、有点像教学录像的背景
  T('sp_training', {
    name: '训练长厅', pool: 'explore_sp_training', desc: '训练长厅：冷静，有点像教学录像的背景', bpm: 92, scale: 'major', space: 'hall', tape: 0.6, sat: 0.3, gain: 0.89, cal: { ep: 0.6, mallet: 0.64, sub: 1.62, hat: 2.75, kick: 1.45, arp: 1.3, snare: 1.51 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Cmaj7 | Am7 | Fmaj7 | G6 | Cmaj7 | Am7 | Dm9 | G7sus4' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am7 | Fmaj7 | G6 | Dm9 | G7sus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      ep: pt('epiano', -28, { mode: 'chord', center: 62, pan: -0.2, rev: 0.4, dly: 0.15, p: { '*': 'x.......x...2...' } }),
      mallet: pt('bell', -31, { mode: 'chord', center: 79, pan: 0.35, rev: 0.5, dly: 0.2, p: { '*': B('0...1...2.......', '3.......2.......') } }),
      sub: pt('bass', -30, { mode: 'bass', low: 36, o: { type: 'sub' }, p: { '*': 'x.......x.......' } }),
      hat: pt('hat', -36, { pan: 0.3, velRand: 0.3, p: { '*': '..x...x...x...x.' } }),
      kick: pt('kick', -28, { rev: 0.05, p: { '*': 'x.......x.......' } }),
      pad: pt('pad', -34, { mode: 'chord', center: 64, rev: 0.4, fx: [['highpass', 300]], o: { cut: 1600, a: 1.5, r: 2 }, p: { B: X } }),
      arp: arp(67), snare: snare({ '*': '....x.......x...' }), bass: bass(36, { '*': 'x..x..x.x..x.ox.' }),
    },
  });
  // 白沙新弹坑一带：盖革计数器当节奏，最病的一首
  T('sp_crater', {
    name: '弹坑边上', pool: 'explore_sp_crater', desc: '白沙新弹坑：盖革计数器当节奏，最病的一首', bpm: 62, scale: 'phrygian', space: 'hall', tape: 2.5, sat: 0.55, gain: 1.09, cal: { geiger: 0.83, sick: 0.71, fall: 1.37, low: 0.84, tickA: 0.84, heart: 1.22, kick: 1.2, snare: 1.61, choir: 1.42 }, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Bbm | Bbm | B | B | Bbm | Bbm | Ab | Ab' },
      { name: 'B', bars: 8, chords: 'Ebm | Ebm | E | E | Ebm | Db | B | Bbm' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      geiger: pt('geiger', -36, { pan: 0.3, rev: 0.15, p: { '*': HOLD4X } }),
      sick: pt('accordion', -30, { mode: 'chord', center: 58, maxV: 3, pan: -0.25, rev: 0.45, detuneRand: 35, p: { '*': HOLD2X } }),
      fall: pt('accordion', -28, { mode: 'deg', root: 70, pan: 0.25, rev: 0.5, dly: 0.2, detuneRand: 40, human: 0.03, p: { '*': B(R, R, '4-3-2-1-0-------', R), B: B('4-3-2-1-0-------', R, '7-6-5-4-3-2-1-0-', R) } }),
      low: drone(22, -29, { cut: 220 }), wind: wind(260, -34),
      tickA: pt('geiger', -36, { layer: 'alert', pan: -0.4, rev: 0.1, p: { '*': HOLD4X } }), heart: heart(), pulse: pulse(22),
      kick: kick({ '*': 'x.......x..x....' }), snare: snare({ '*': '........x.......' }), bass: bass(22, { '*': 'x..x..x.x..x..x.' }, { cut: 260 }), metal: metal(), choir: choir(58, 'a'), tom: tom(),
    },
  });
  // 南栈站台（据点里的站台、E-17）：E-17 动机的空间版，三个音在站台上来回撞
  T('sp_nanzhan', {
    name: '南栈站台', pool: 'nanzhan', desc: '南栈站台：E-17 那三个音在空站台上来回撞', bpm: 54, scale: 'minor', space: 'tunnel', tape: 0.6, sat: 0.3, gain: 0.93, cal: { e17R: 0.83, drone: 1.23, pad: 0.83 }, delay: 1.5, delayFb: 0.5,
    sections: [
      { name: 'A', bars: 8, chords: 'Cm9 | Cm9 | Abmaj7 | Abmaj7 | Fm9 | Fm9 | Gsus4 | G' },
      { name: 'B', bars: 8, chords: 'Abmaj7 | Bb6 | Gm7 | Cm9 | Abmaj7 | Bb6 | Gsus4 | Cm9' },
    ],
    form: ['A', 'B'], loop: 0,
    parts: {
      e17L: pt('chime', -28, { mode: 'deg', root: 72, pan: -0.6, rev: 0.9, dly: 0.35, p: { '*': B('4.......0.......', '2---------------', R, R) } }),
      e17R: pt('chime', -31, { mode: 'deg', root: 60, pan: 0.6, rev: 0.9, dly: 0.35, p: { '*': B(R, R, '........4.......', '0.......2-------') } }),
      drone: drone(36), wind: wind(340, -36),
      pad: pt('strings', -32, { mode: 'chord', center: 63, rev: 0.6, o: { a: 3, r: 3, cut: 1800 }, p: { B: HOLD2X } }),
      radio: radio(-39),
    },
  });
})(D);
