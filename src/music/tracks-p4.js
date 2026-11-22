/* 配乐第二代 · P4：战斗（第三节 D）。
   高威胁交火 2 首（pool hunt：威胁 4 级以上、三个以上醒着，探索曲换成这个）
   精英守关 2 首（pool elite：醒着的工程机，检查站、银行、维修库常见）
   首领战 4 家（pool boss_<家>：重型机械 / 虫群 / 智能 / 空中），每家一首 + 残血那一段（pool boss2_<家>，更快，phase2: true）
   撤离战 2 首（pool extract；第三首是 tracks-p0 的末班车）：最后十秒交火层加警报长音、密的打击
   首领出场短乐句 4 段（每家一段）。vol 按 M2.pt(乐器, 目标响度) 算，cal 是校准脚本写的微调。设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2, T = M2.track, pt = M2.pt;
  const R = '................', L = '----------------', X = 'x---------------', Z = '0---------------';
  const B = (...b) => b.join('|'), B4 = b => B(b, b, b, b), HOLD2 = B(Z, L), HOLD2X = B(X, L), HOLD4 = B(Z, L, L, L);
  const FOUR = 'x...x...x...x...', BACK = '....x.......x...', HAT8 = '..x...x...x...x.', HAT16 = 'XgxgXgxgXgxgXgxg', OPEN = '......x.......x.';
  const FILL = B(R, R, R, '........x.x.xxx.'), ROLL = 'x.x.x.x.xxxxxxxx';

  // ── 声部（每首再按自己的调、谱子改）。layer 不写就是 base
  const drone = (root, lv, o) => pt('drone', lv ?? -31, { mode: 'deg', root, rev: 0.3, o: Object.assign({ cut: 260 }, o), p: { '*': HOLD2 } });
  const kick = (p, layer, lv) => pt('kick', lv ?? -21, { layer: layer || 'base', side: 0.45, rev: 0.05, p });
  const snare = (p, layer, lv) => pt('snare', lv ?? -24, { layer: layer || 'base', rev: 0.3, p });
  const clap = (p, layer, lv) => pt('clap', lv ?? -26, { layer: layer || 'base', rev: 0.35, p });
  const hat = (p, layer, lv) => pt('hat', lv ?? -31, { layer: layer || 'base', pan: 0.3, velRand: 0.3, p });
  const ohat = (p, layer, lv) => pt('ohat', lv ?? -33, { layer: layer || 'base', pan: -0.2, p: p || { '*': OPEN } });
  const shaker = (p, layer, lv) => pt('shaker', lv ?? -33, { layer: layer || 'base', pan: 0.4, velRand: 0.4, p });
  const tick = (p, layer, lv) => pt('tick', lv ?? -36, { layer: layer || 'base', pan: 0.35, rev: 0.2, p });
  const tom = (p, layer, lv) => pt('tom', lv ?? -26, { layer: layer || 'combat', pan: -0.2, rev: 0.3, p: p || { '*': FILL } });
  const metal = (p, layer, lv) => pt('metal', lv ?? -31, { layer: layer || 'combat', pan: 0.5, rev: 0.55, p: p || { '*': B(R, '...........x....') } });
  const clank = (p, layer, lv) => pt('clank', lv ?? -28, { layer: layer || 'base', pan: -0.35, rev: 0.4, p });
  const sub = (low, p, layer, lv) => pt('bass', lv ?? -28, { mode: 'bass', layer: layer || 'base', low, duck: true, o: { type: 'sub' }, p });
  const bass = (low, p, layer, o, lv) => pt('bass', lv ?? -23, { mode: 'bass', layer: layer || 'combat', low, duck: true, o: Object.assign({ cut: 230, q: 6, env: 7, dec: 0.07 }, o), p });
  const arp = (center, p, layer, o, lv) => pt('arp', lv ?? -31, { mode: 'chord', layer: layer || 'alert', center, pan: -0.4, rev: 0.3, dly: 0.15, o: Object.assign({ cut: 1600, q: 6, dec: 0.12 }, o), p });
  const strings = (center, p, layer, lv, o) => pt('strings', lv ?? -33, { mode: 'chord', layer: layer || 'base', center, maxV: 3, duck: true, rev: 0.45, o: Object.assign({ a: 0.4, r: 0.9 }, o), p: p || { '*': HOLD2X } });
  const choir = (center, vowel, p, layer, lv) => pt('choir', lv ?? -30, { mode: 'chord', layer: layer || 'combat', center, rev: 0.6, o: { vowel: vowel || 'a' }, p: p || { '*': HOLD2X } });
  const brass = (root, p, layer, lv, o) => pt('brass', lv ?? -28, Object.assign({ mode: 'deg', layer: layer || 'base', root, pan: -0.15, rev: 0.45, dly: 0.08, p }, o));
  const lead = (root, p, layer, lv, o) => pt('lead', lv ?? -29, { mode: 'deg', layer: layer || 'combat', root, rev: 0.35, dly: 0.18, o: Object.assign({ cut: 2500, glide: 0.04 }, o), p });
  const siren = (root, p, layer, lv, o) => pt('siren', lv ?? -35, { mode: 'deg', layer: layer || 'base', root, pan: -0.3, rev: 0.6, o: Object.assign({ rate: 0.35, depth: 180 }, o), p: p || { '*': B(Z, L) } });
  const riser = (root, p, layer, lv) => pt('riser', lv ?? -31, { mode: 'deg', layer: layer || 'base', root, rev: 0.4, p });
  const merge = (a, b) => { const o = Object.assign({}, a); for (const k in b) o[k] = b[k] === null ? undefined : Object.assign({}, a[k], b[k]); for (const k in o) if (!o[k]) delete o[k]; return o; };
  // 首领残血那一段：同一首，更快、更密；pool boss2_<家>，不进点唱机的随机池
  const phase2 = (key, base, d) => T(key, Object.assign({}, base, { key: undefined, phase2: true, form: d.form || base.form.filter(n => n !== 'I'), loop: 0, cal: Object.assign({}, base.cal) }, d, { parts: merge(base.parts, d.parts || {}) }));

  // ════ 高威胁交火：整站都在追你
  T('hunt_sweep', {
    name: '整站在找你', pool: 'hunt', desc: '高威胁交火：警报一圈圈转，整站的机器都在往这边来', bpm: 128, scale: 'phrygian', space: 'hall', sat: 0.6, gain: 0.87, cal: { siren: 1.34, sub: 0.82, tick: 0.69, riser: 1.87, kick: 0.7, arp: 0.63, hat2: 0.6, brass: 0.79, tom: 0.8 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Em | Em' },
      { name: 'A', bars: 8, chords: 'Em | Em | Fmaj7 | Em | Em | Em | Dm | F' },
      { name: 'B', bars: 8, chords: 'Am | Am | Fmaj7 | Fmaj7 | Dm | Dm | Em | Em' },
      { name: 'C', bars: 4, chords: 'Cmaj7 | Cmaj7 | B7 | B7' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      drone: drone(40), siren: siren(76, { '*': B(Z, L, R, R) }, 'base', -36, { rate: 0.25, depth: 300 }),
      sub: sub(28, { '*': FOUR, C: B('x---------------', R, 'x---------------', R) }), tick: tick({ '*': HAT8 }),
      riser: riser(40, { I: B(R, Z), C: B(R, R, R, Z) }),
      kick: kick({ '*': FOUR, I: B(R, 'x...x...x...x.x.'), C: B('x.......x.......', 'x.......x.......', FOUR, ROLL) }, 'alert'),
      snare: snare({ '*': BACK, I: R, C: B(R, R, R, ROLL) }, 'alert'), hat: hat({ '*': HAT8 }, 'alert'),
      arp: arp(64, { '*': '0123012301230123', C: '0.1.2.3.0.1.2.3.' }),
      bass: bass(28, { '*': 'x.x.o.x.x.x.o.x.', C: 'x.......x.......' }), hat2: hat({ '*': HAT16 }, 'combat', -34), ohat: ohat(),
      brass: brass(52, { A: B('0.......0...1...', R, '0.......0...1...', '3---1---0-------'), B: B('4-------3-------', '1-------0-------') }, 'combat'),
      choir: choir(64, 'a'), tom: tom(), metal: metal(),
    },
  });
  T('hunt_grid', {
    name: '封锁线', pool: 'hunt', desc: '高威胁交火：封锁广播的提示音、行军军鼓、往上走的弦乐', bpm: 140, scale: 'minor', space: 'hall', sat: 0.55, gain: 0.84, cal: { drone: 0.81, chime: 0.59, pulse: 0.62, riser: 2.31, march: 1.36, kick: 0.8, str: 0.79, hat: 0.81, clap: 1.4, lead: 1.29, siren: 1.19, tom: 0.82 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Cm | Cm' },
      { name: 'A', bars: 8, chords: 'Cm | Cm | Abmaj7 | Abmaj7 | Bb | Bb | G7sus4 | G' },
      { name: 'B', bars: 8, chords: 'Fm | Fm | Cm | Cm | Abmaj7 | Bb | Cm | G' },
      { name: 'C', bars: 8, chords: 'Ab | Ab | Fm | Fm | Db | Db | G7sus4 | G' },
    ],
    form: ['I', 'A', 'B', 'C', 'A', 'B'], loop: 1,
    parts: {
      drone: drone(36), chime: pt('chime', -30, { mode: 'deg', root: 72, pan: 0.45, rev: 0.7, dly: 0.25, p: { '*': B('4...2...0.......', R, R, R) } }),
      pulse: sub(24, { '*': 'x.x.x.x.x.x.x.x.' }, 'base', -30), riser: riser(36, { I: B(R, Z), C: B(R, R, R, R, R, R, R, Z) }),
      march: snare({ '*': B('....g...g.g.....', '....g...g.ggg...') }, 'alert', -28), kick: kick({ '*': 'x.....x.x.......', I: R }, 'alert'),
      str: strings(60, { '*': X, C: HOLD2X }, 'alert', -33), arp: arp(67, { '*': '0.1.2.3.4.3.2.1.' }),
      hat: hat({ '*': HAT16 }, 'combat'), clap: clap({ '*': BACK }, 'combat'), bass: bass(24, { '*': 'x..x..x.x..x.ox.' }),
      lead: lead(72, { A: B('0---3---2---0---', '7-------6---5---', '4---3---2---0---', '2-------b-------'), B: B('5---4---3-------', '2---3---4---7---'),
        C: B('8-------7-------', '5-------4---3---', '2-------0-------', '1-------b-------') }),
      siren: siren(79, null, 'combat', -36), tom: tom(),
    },
  });

  // ════ 精英守关：短、硬
  T('elite_gate', {
    name: '守关的', pool: 'elite', desc: '精英守关：短、硬，砸地一样的鼓和锯齿贝斯', bpm: 148, scale: 'phrygian', space: 'room', sat: 0.7, gain: 0.91, cal: { kick: 0.62, clank: 0.58, snare: 0.75, arp: 0.74, brass: 0.69, hat2: 0.52, choir: 1.41, metal: 0.77, riser: 1.57, tom: 0.61 }, delay: 0.5,
    sections: [
      { name: 'I', bars: 2, chords: 'Dm | Dm' },
      { name: 'A', bars: 4, chords: 'Dm | Dm | Eb | Dm' },
      { name: 'B', bars: 4, chords: 'Bbmaj7 | C | Dm | Eb' },
      { name: 'C', bars: 4, chords: 'Gm | Gm | A7b9 | A7b9' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      drone: drone(38),
      kick: kick({ '*': 'X.....x...x.....', I: B(R, 'X.......X.......'), C: 'X.......X.......' }),
      bass: bass(26, { '*': 'x.....x...x.....', I: B(R, 'x.......x.......'), C: X }, 'base', { cut: 180, q: 8, env: 9, dec: 0.09 }, -22),
      clank: clank({ '*': BACK, I: R }),
      snare: snare({ '*': BACK, C: B(R, R, R, ROLL) }, 'alert'), hat: hat({ '*': HAT8 }, 'alert'),
      arp: arp(62, { '*': '0.0.1.0.2.0.1.0.' }, 'alert', { cut: 1200, q: 9 }),
      brass: brass(50, { A: B('0-------1-------', Z), B: B('5-------6-------', '0-------1-------'), C: B('3-------3---4---', '6---------------') }, 'alert'),
      hat2: hat({ '*': HAT16 }, 'combat', -34), choir: choir(62, 'a', { C: HOLD2X }), metal: metal(),
      riser: riser(38, { B: B(R, R, R, Z) }, 'combat'), tom: tom(),
    },
  });
  T('elite_vault', {
    name: '金库门', pool: 'elite', desc: '精英守关：银行里的那台，金库的机关、金属和铜管', bpm: 132, scale: 'minor', space: 'hall', sat: 0.55, gain: 0.85, cal: { tick: 0.51, riser: 1.99, kick: 0.73, brass: 0.72, hat2: 0.62, str: 0.83, tom: 0.84 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Fm | Fm' },
      { name: 'A', bars: 8, chords: 'Fm | Fm | Dbmaj7 | Dbmaj7 | Bbm7 | Bbm7 | C7sus4 | C' },
      { name: 'B', bars: 4, chords: 'Dbmaj7 | Eb | Fm | Fm' },
      { name: 'C', bars: 4, chords: 'Gb | Gb | C7sus4 | C' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      drone: drone(41), tick: tick({ '*': 'x.x.x.x.x.x.x.x.' }, 'base', -37),
      bell: pt('bell', -32, { mode: 'chord', center: 84, pan: 0.5, rev: 0.6, dly: 0.3, prob: 0.8, p: { '*': B('0...............', R) } }),
      sub: sub(29, { '*': FOUR }), riser: riser(41, { I: B(R, Z), C: B(R, R, R, Z) }),
      kick: kick({ '*': 'x.....x...x...x.', I: R }, 'alert'), snare: snare({ '*': BACK, I: R }, 'alert'), hat: hat({ '*': HAT8 }, 'alert'),
      brass: brass(53, { A: B('0-------0---3---', '2-------1-------'), B: B('5-------6-------', '4---------------'), C: B('1-------1-------', '4---------------') }, 'alert'),
      bass: bass(29, { '*': 'x..x..x.x..x.ox.' }), hat2: hat({ '*': HAT16 }, 'combat', -34), ohat: ohat(),
      str: strings(72, null, 'combat'), choir: choir(65, 'o'), metal: metal(), tom: tom(),
    },
  });

  // ════ 首领战 · 重型机械（钳工-9、锤、穿山甲、铁闸）：慢、重，冲压机一样的鼓、低音铜管
  const HEAVY = T('boss_heavy', {
    name: '千斤', pool: 'boss_heavy', desc: '首领 · 重型机械：慢、重，冲压机一样的鼓和低音铜管', bpm: 104, scale: 'phrygian', space: 'hall', sat: 0.7, gain: 0.84, cal: { drone: 0.65, kick: 0.75, clank: 0.51, brass: 0.73, riser: 1.49, str: 0.73, tom: 0.72 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Cm | Cm' },
      { name: 'A', bars: 8, chords: 'Cm | Cm | Db | Db | Cm | Cm | Bbm | Db' },
      { name: 'B', bars: 8, chords: 'Abmaj7 | Abmaj7 | Fm | Fm | Db | Db | G7b9 | G7b9' },
      { name: 'C', bars: 4, chords: 'Cm | Db | Cm | Db' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      drone: drone(36, -30, { cut: 220 }),
      kick: kick({ '*': 'X.......x..x....', I: B(R, 'X.......X.......') }, 'base', -20),
      clank: clank({ '*': '....X.......X...', I: R }),
      sub: sub(24, { '*': 'x.......x..x....', I: B(R, 'x.......x.......') }, 'base', -26),
      brass: brass(48, { A: B('0-------------0-', '1---------------', Z, '6-------5---1---'), B: B('5---------------', '3---------------', '1-------3-------', '4---------------') }, 'base', -27),
      riser: riser(36, { I: B(R, Z), C: B(R, R, R, Z) }),
      snare: snare({ '*': '........X.......', I: R }, 'alert'), hat: hat({ '*': HAT8, I: R }, 'alert'), metal: metal(null, 'alert'),
      bass: bass(24, { '*': 'x..x....x..x.x..', C: 'x.......x.......' }, 'combat', { cut: 160 }),
      choir: choir(55, 'u'), str: strings(67, null, 'combat'),
      tom: tom({ '*': FILL, C: B('x.....x.....x...', 'x.....x.....x...', 'x.....x.....x...', ROLL) }),
    },
  });
  phase2('boss2_heavy', HEAVY, { name: '千斤 · 过热', pool: 'boss2_heavy', desc: '首领残血：过热了，更快更狠', gain: 0.78, bpm: 116,
    parts: { kick: { p: { '*': 'X...x...X..x..x.' } }, hat: { p: { '*': HAT16 } }, snare: { p: { '*': BACK, C: B(R, R, R, ROLL) } },
      siren: siren(72, null, 'combat', -36), ohat: ohat() } });

  // ════ 首领战 · 虫群（蜂后、钳）：密的打击、嗡嗡的锯齿和弦、往外爬的琶音
  const SWARM = T('boss_swarm', {
    name: '母巢', pool: 'boss_swarm', desc: '首领 · 虫群：密的打击、嗡嗡的锯齿和弦、往外爬的琶音', bpm: 148, scale: 'harmonic', space: 'tunnel', sat: 0.6, gain: 0.85, cal: { drone: 0.76, buzz: 0.74, shaker: 0.11, tick: 0.38, riser: 2.25, kick: 0.59, snare: 0.77, arp: 0.55, sub: 0.75, hat: 0.57, bass: 0.74, lead: 1.25, choir: 1.22, metal: 0.84 }, delay: 0.5,
    sections: [
      { name: 'I', bars: 2, chords: 'Am | Am' },
      { name: 'A', bars: 8, chords: 'Am | Am | Fmaj7 | Fmaj7 | Dm | Dm | E7 | E7' },
      { name: 'B', bars: 8, chords: 'Am | G | F | E | Am | G | F | E7b9' },
      { name: 'C', bars: 4, chords: 'Bbmaj7 | Bbmaj7 | E7 | E7' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      drone: drone(33),
      buzz: pt('pad', -32, { mode: 'chord', center: 57, rev: 0.3, o: { cut: 900, a: 0.15, r: 0.4, width: 0.9 }, p: { '*': 'x-------x-------' } }),
      shaker: shaker({ '*': 'xxxxxxxxxxxxxxxx' }), tick: tick({ '*': 'x.xxx.xxx.xxx.xx' }, 'base', -37),
      riser: riser(33, { I: B(R, Z), C: B(R, R, R, Z) }),
      kick: kick({ '*': 'x..x..x...x..x..', I: R }, 'alert'), snare: snare({ '*': '....x..g....x.g.', I: R }, 'alert'),
      arp: arp(69, { '*': '0123321001233210' }), sub: sub(33, { '*': 'x..x..x...x..x..', I: R }, 'alert'),
      hat: hat({ '*': HAT16 }, 'combat'), bass: bass(33, { '*': 'x.xx.xx.x.xx.xo.', C: 'x.......x.......' }),
      lead: lead(69, { A: B('4-3-4-3-4-------', '5-4-3-2-1-------', '2-1-2-1-2-------', '6-------4-------'), B: B('7-6-7-6-7-------', '5-------4-------') }),
      choir: choir(64, 'a'), metal: metal(), tom: tom(),
    },
  });
  phase2('boss2_swarm', SWARM, { name: '母巢 · 暴躁', pool: 'boss2_swarm', desc: '首领残血：暴躁了，更快、下蛋更多', gain: 0.84, bpm: 164,
    parts: { kick: { p: { '*': 'x.xx..x.x.xx..x.' } }, shaker: { p: { '*': 'XxXxXxXxXxXxXxXx' } }, ohat: ohat(), siren: siren(76, null, 'combat', -37, { rate: 0.6, depth: 260 }) } });

  // ════ 首领战 · 智能（档案官、主脑）：冷的琶音、数据音、合唱，像一台在算你的机器
  const SMART = T('boss_smart', {
    name: '主机', pool: 'boss_smart', desc: '首领 · 智能：冷的琶音、数据音、合唱，像一台在算你的机器', bpm: 126, scale: 'minor', space: 'hall', sat: 0.45, gain: 0.9, cal: { blip: 0.51, count: 0.69, riser: 2.28, kick: 0.81, clap: 1.6, hat: 2.7, ep: 0.51, bass: 0.83, hat2: 1.46, lead: 1.44 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Gm9 | Gm9' },
      { name: 'A', bars: 8, chords: 'Gm9 | Gm9 | Ebmaj7 | Ebmaj7 | Cm9 | Cm9 | D7sus4 | D' },
      { name: 'B', bars: 8, chords: 'Ebmaj7 | F | Gm9 | Gm9 | Ebmaj7 | F | D7sus4 | D7b9' },
      { name: 'C', bars: 4, chords: 'Bbmaj7 | Bbmaj7 | Am7b5 | D7b9' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      drone: drone(43),
      blip: pt('blip', -33, { mode: 'deg', root: 79, pan: 0.4, rev: 0.5, dly: 0.35, prob: 0.7, p: { '*': B('0...4...7.......', '....b...7...4...') } }),
      count: arp(67, { '*': '0123012301230123' }, 'base', { cut: 1300, q: 8 }), riser: riser(43, { I: B(R, Z), C: B(R, R, R, Z) }),
      kick: kick({ '*': FOUR, I: R }, 'alert'), clap: clap({ '*': BACK, I: R }, 'alert'), hat: hat({ '*': HAT8 }, 'alert'), sub: sub(31, { '*': FOUR, I: R }, 'alert'),
      ep: pt('epiano', -30, { mode: 'chord', layer: 'combat', center: 60, rev: 0.5, dly: 0.2, p: { '*': 'x.......x.......' } }),
      bass: bass(31, { '*': 'x.ox.ox.x.ox.ox.' }), choir: choir(67, 'o'), hat2: hat({ '*': HAT16 }, 'combat', -34),
      lead: lead(67, { A: B('4---------------', '3---2---0-------', '4---------------', '5---4---3---1---'), B: B('7-------6-------', '4---------------') }),
      tom: tom(),
    },
  });
  phase2('boss2_smart', SMART, { name: '主机 · 过载', pool: 'boss2_smart', desc: '首领残血：过载了，更快，琶音翻一倍', gain: 0.91, bpm: 140,
    parts: { count: { p: { '*': '0123456701234567' } }, blip: { prob: 0.95 }, ohat: ohat(), siren: siren(74, null, 'combat', -37) } });

  // ════ 首领战 · 空中（老鸦、鸢、雷鸣）：旋翼一样的节奏、警报、往上扫
  const AIR = T('boss_air', {
    name: '头顶上', pool: 'boss_air', desc: '首领 · 空中：旋翼一样的节奏、头顶上的警报、往上扫', bpm: 136, scale: 'minor', space: 'hall', sat: 0.55, gain: 0.88, cal: { rotor: 0.65, riser: 1.92, kick: 0.83, hat2: 0.61, brass: 0.71, dive: 2.03, tom: 0.8 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Dm | Dm' },
      { name: 'A', bars: 8, chords: 'Dm | Dm | Bbmaj7 | Bbmaj7 | Gm | Gm | A7sus4 | A' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | C | Dm | Dm | Bbmaj7 | C | A7sus4 | A7b9' },
      { name: 'C', bars: 4, chords: 'Gm | Gm | Bbmaj7 | A' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      drone: drone(38),
      rotor: pt('kick', -29, { pan: 0.2, rev: 0.2, velRand: 0.2, fx: [['highpass', 110], ['lowpass', 900]], p: { '*': 'x.x.x.x.x.x.x.x.' } }),
      wind: pt('wind', -34, { pan: -0.1, rev: 0.4, o: { f: 700, q: 0.8 }, p: { '*': B(X, L, L, L) } }),
      siren: siren(74, { '*': HOLD4 }, 'base', -36, { rate: 0.4, depth: 400 }), riser: riser(38, { I: B(R, Z) }),
      kick: kick({ '*': 'x.....x...x.....', I: R }, 'alert'), snare: snare({ '*': BACK, I: R }, 'alert'), hat: hat({ '*': HAT8 }, 'alert'),
      str: strings(69, null, 'alert'),
      bass: bass(26, { '*': 'x..x..x.x..x.ox.' }), hat2: hat({ '*': HAT16 }, 'combat', -34),
      brass: brass(62, { A: B('0-------4-------', '3---2---0-------', '0-------5-------', '4---------------'), B: B('2-------4-------', '1-------0-------') }, 'combat'),
      choir: choir(69, 'a'), dive: riser(50, { '*': B(R, R, R, Z) }, 'combat', -32), tom: tom(),
    },
  });
  phase2('boss2_air', AIR, { name: '头顶上 · 俯冲', pool: 'boss2_air', desc: '首领残血：俯冲下来了，更快', gain: 0.89, bpm: 152,
    parts: { rotor: { p: { '*': 'xxxxxxxxxxxxxxxx' } }, siren: { p: { '*': HOLD2 } }, ohat: ohat() } });

  // ════ 撤离战（第三首是 tracks-p0 的末班车）
  T('ext_doors', {
    name: '关门了', pool: 'extract', desc: '撤离战：关门的提示音当动机，越来越急', bpm: 140, scale: 'minor', space: 'hall', sat: 0.55, gain: 0.87, cal: { kick: 0.7, train: 0.66, hat: 2.36, door: 0.51, pad: 0.81, arp: 0.61, lead: 1.3, door2: 0.21, shaker: 0.1, hat2: 0.81, choir: 1.31, tom: 0.61 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Am | Am' },
      { name: 'A', bars: 8, chords: 'Am | Am | Fmaj7 | Fmaj7 | C | C | G | G' },
      { name: 'B', bars: 8, chords: 'Dm | Dm | Am | Am | Fmaj7 | G | Esus4 | E' },
      { name: 'C', bars: 8, chords: 'Fmaj7 | Fmaj7 | G | G | Am | Am | Esus4 | E7b9' },
    ],
    form: ['I', 'A', 'B', 'C', 'A', 'B'], loop: 1,
    parts: {
      kick: kick({ '*': FOUR, I: B(R, 'x...x...x...x.x.') }), train: pt('train', -30, { pan: -0.25, rev: 0.15, p: { '*': 'x.......x.......' } }),
      hat: hat({ '*': HAT8 }, 'base', -33), bass: bass(33, { '*': '..x.o.x...x.o.x.', I: B(R, '..x.o.x...x.o.x.') }, 'base', null, -24),
      door: pt('chime', -30, { mode: 'deg', root: 76, pan: 0.4, rev: 0.7, dly: 0.25, p: { '*': B('4.......2.......', R) } }),
      pad: strings(60, null, 'base', -34),
      snare: snare({ '*': BACK, I: R }, 'alert'), arp: arp(69, { '*': '0123012301230123' }),
      lead: lead(69, { A: B('0---2---4-------', '3---2---0-------', '0---2---4---5---', '4---------------'), B: B('5---4---3---2---', '0-------b-------'),
        C: B('5-------4-------', '3-------4-------', Z, '4---------------') }, 'alert'),
      door2: pt('chime', -31, { mode: 'deg', layer: 'combat', root: 76, pan: -0.4, rev: 0.6, p: { '*': '4...2...4...2...' } }),
      siren: siren(81, null, 'combat', -36), shaker: shaker({ '*': 'xxxxxxxxxxxxxxxx' }, 'combat'), hat2: hat({ '*': HAT16 }, 'combat', -34),
      choir: choir(64, 'o'), tom: tom({ '*': B(R, R, R, ROLL) }),
    },
  });
  T('ext_signal', {
    name: '最后一班信号', pool: 'extract', desc: '撤离战：车的信号灯一下一下，铁轨当鼓', bpm: 124, scale: 'dorian', space: 'tunnel', sat: 0.5, gain: 0.98, cal: { rails: 0.43, signal: 0.48, pad: 0.82, hat: 1.25, hat2: 0.67, brass: 0.71, dive: 1.99 }, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Em9 | Em9' },
      { name: 'A', bars: 8, chords: 'Em9 | Em9 | Cmaj7 | Cmaj7 | Am9 | Am9 | B7sus4 | B' },
      { name: 'B', bars: 8, chords: 'Cmaj7 | D | Em9 | Em9 | Cmaj7 | D | B7sus4 | B7' },
      { name: 'C', bars: 4, chords: 'Gmaj7 | Gmaj7 | Fmaj7#11 | B7sus4' },
    ],
    form: ['I', 'A', 'B', 'A', 'C', 'B'], loop: 1,
    parts: {
      rails: pt('train', -29, { pan: -0.2, rev: 0.15, p: { '*': 'x...x.x.x...x.x.' } }), kick: kick({ '*': 'x.......x.......', I: R }),
      signal: pt('blip', -33, { mode: 'deg', root: 76, pan: 0.35, rev: 0.5, dly: 0.3, p: { '*': '0.......0.......' } }),
      bass: bass(28, { '*': 'x...x.x.x...x.x.', I: R }, 'base', { cut: 260 }, -24), pad: strings(64, null, 'base', -34),
      snare: snare({ '*': BACK, I: R }, 'alert'), hat: hat({ '*': HAT8 }, 'alert'), arp: arp(71, { '*': '0.2.1.3.0.2.1.3.' }),
      hat2: hat({ '*': HAT16 }, 'combat', -34), siren: siren(83, null, 'combat', -36),
      brass: brass(52, { A: B('0-------4-------', '3-------2-------'), B: B('5-------4-------', '2-------1-------') }, 'combat'),
      choir: choir(64, 'a'), dive: riser(40, { '*': B(R, R, R, Z) }, 'combat', -32), tom: tom(),
    },
  });

  // ════ 首领出场短乐句（一小节，主曲让一让）
  const ST = (key, name, desc, bpm, scale, chord, parts, gain) => T(key, { name, pool: 'sting', once: true, desc, bpm, scale, space: 'hall', sat: 0.6, gain: gain ?? 1, sections: [{ name: 'S', bars: 1, chords: chord }], form: ['S'], parts });
  ST('st_boss_heavy', '短乐句 · 首领出场（重型）', '重型机械首领醒了：一下重锤和低音铜管', 70, 'phrygian', 'Cm', {
    kick: pt('kick', -18, { rev: 0.2, p: { S: 'X...............' } }), clank: pt('clank', -24, { pan: -0.3, rev: 0.6, p: { S: 'X...............' } }),
    sub: pt('bass', -24, { mode: 'bass', low: 24, o: { type: 'sub' }, p: { S: 'x-----------....' } }),
    brass: pt('brass', -24, { mode: 'deg', root: 36, rev: 0.5, p: { S: '0-----------....' } }), brass2: pt('brass', -27, { mode: 'deg', root: 48, rev: 0.5, p: { S: '....1-------....' } }),
    choir: pt('choir', -28, { mode: 'chord', center: 55, rev: 0.7, o: { vowel: 'u' }, p: { S: 'x-----------....' } }),
  }, 0.84);
  ST('st_boss_swarm', '短乐句 · 首领出场（虫群）', '虫群首领醒了：一阵窸窣往上爬，然后一下', 96, 'harmonic', 'Am', {
    crawl: pt('arp', -29, { mode: 'deg', root: 57, pan: -0.3, rev: 0.4, o: { cut: 1500, q: 7, dec: 0.1 }, p: { S: '01234567........' } }),
    shaker: pt('shaker', -32, { pan: 0.4, p: { S: 'ggggxxxxXXXX....' } }), kick: pt('kick', -19, { rev: 0.2, p: { S: '........X.......' } }),
    buzz: pt('pad', -29, { mode: 'chord', center: 57, rev: 0.5, o: { cut: 1100, a: 0.05, r: 0.8, width: 0.9 }, p: { S: '........x---....' } }),
    metal: pt('metal', -26, { pan: 0.4, rev: 0.7, p: { S: '........x.......' } }),
  }, 1.38);
  ST('st_boss_smart', '短乐句 · 首领出场（智能）', '智能首领醒了：数据音一串，合唱落下来', 100, 'minor', 'Gm9', {
    blip: pt('blip', -30, { mode: 'deg', root: 79, pan: 0.35, rev: 0.5, dly: 0.3, p: { S: '0.4.7.b.........' } }),
    riser: pt('riser', -29, { mode: 'deg', root: 43, rev: 0.4, p: { S: '0-------........' } }), kick: pt('kick', -19, { rev: 0.2, p: { S: '........X.......' } }),
    choir: pt('choir', -26, { mode: 'chord', center: 67, rev: 0.7, o: { vowel: 'o' }, p: { S: '........x-------' } }),
    sub: pt('bass', -25, { mode: 'bass', low: 31, o: { type: 'sub' }, p: { S: '........x-------' } }),
  });
  ST('st_boss_air', '短乐句 · 首领出场（空中）', '空中首领来了：警报从头顶扫过去', 90, 'minor', 'Dm', {
    siren: pt('siren', -30, { mode: 'deg', root: 74, rev: 0.6, o: { rate: 0.8, depth: 500, a: 0.1 }, p: { S: '0-----------....' } }),
    riser: pt('riser', -28, { mode: 'deg', root: 50, rev: 0.4, p: { S: '0-------........' } }), kick: pt('kick', -19, { rev: 0.2, p: { S: '........X.......' } }),
    brass: pt('brass', -25, { mode: 'deg', root: 50, rev: 0.5, p: { S: '........0-------' } }), metal: pt('metal', -27, { pan: -0.4, rev: 0.7, p: { S: '........x.......' } }),
  }, 1.38);
})(D);
