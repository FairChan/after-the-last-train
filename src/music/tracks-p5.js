/* 配乐第二代 · P5：剧情（第三节 E）。
   人物 4 首（pool th_lin / th_ahsun / th_lu / th_e17，剧本里的旧名字不用改）：林桥（少一个音的八音盒）、阿隼（不安的拨弦切分）、陆峥（冷钢琴）、E-17（倒着的叮咚叮）。
   尾声 2 首：到站了（pool th_e17_resolve，公开结局，E-17 正着弹完、南栈那句终于弹完最后一个音）、还是延误（pool epi_late，卖掉 / 暂时保留）。
   序幕 1 首（pool prologue，新存档第一场）。
   小剧情屋情绪曲 6 首（pool mood_<情绪>）：温情 warm / 不安 uneasy / 悲伤 sad / 荒诞 absurd / 紧张 tense / 神秘 mystery。
   292 场小剧情屋在场次头写 @music mood_<情绪>（story/小剧情屋/*.md，F9 面板能改）。
   动机：南栈 = 音阶 0-2-4-3-2-1（平时少最后一个；到站了才弹完 0-2-4-3-2-1-0）；E-17 = 2 0 4（叮—咚—叮），平时倒着 4 0 2 或缺最后一个。
   vol 按 M2.pt(乐器, 目标响度) 算，cal 是校准脚本写的微调。设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2, T = M2.track, pt = M2.pt;
  const R = '................', L = '----------------', X = 'x---------------', Z = '0---------------';
  const B = (...b) => b.join('|'), B4 = b => B(b, b, b, b), HOLD2 = B(Z, L), HOLD2X = B(X, L), HOLD4X = B(X, L, L, L);

  const drone = (root, lv, o) => pt('drone', lv ?? -32, { mode: 'deg', root, rev: 0.3, o: Object.assign({ cut: 270 }, o), p: { '*': HOLD2 } });
  const radio = lv => pt('crackle', lv ?? -39, { pan: 0.35, rev: 0.1, p: { '*': HOLD4X } });
  const wind = (f, lv) => pt('wind', lv ?? -36, { pan: -0.15, rev: 0.4, o: { f, q: 0.8 }, p: { '*': HOLD4X } });
  const strings = (center, p, lv, o) => pt('strings', lv ?? -31, { mode: 'chord', center, maxV: 3, rev: 0.5, o: Object.assign({ a: 2.2, r: 3, cut: 2000 }, o), p });
  const pad = (center, p, lv, o) => pt('pad', lv ?? -33, { mode: 'chord', center, rev: 0.45, fx: [['highpass', 260]], o: Object.assign({ cut: 1400, a: 2.2, r: 3 }, o), p });
  const choir = (center, vowel, p, lv) => pt('choir', lv ?? -33, { mode: 'chord', center, rev: 0.6, o: { vowel: vowel || 'u', a: 2, r: 3 }, p });
  const piano = (center, p, lv, o) => pt('piano', lv ?? -26, Object.assign({ mode: 'chord', center, pan: -0.2, rev: 0.45, dly: 0.1, human: 0.016, p }, o));
  const box = (root, p, lv, o) => pt('musicbox', lv ?? -26, Object.assign({ mode: 'deg', root, pan: 0.3, rev: 0.5, dly: 0.2, human: 0.02, prob: 0.95, detuneRand: 14, p }, o));
  const chime = (root, p, lv, o) => pt('chime', lv ?? -29, Object.assign({ mode: 'deg', root, pan: -0.4, rev: 0.85, dly: 0.3, p }, o));
  const bell = (center, p, lv, o) => pt('bell', lv ?? -33, Object.assign({ mode: 'chord', center, pan: 0.5, rev: 0.8, prob: 0.7, p }, o));
  const tick = (p, lv, o) => pt('tick', lv ?? -36, Object.assign({ pan: 0.45, rev: 0.25, p: { '*': p || 'x...g...x...g...' } }, o));
  const pluck = (center, p, lv, o) => pt('pluck', lv ?? -27, Object.assign({ mode: 'chord', center, pan: -0.3, rev: 0.3, dly: 0.08, human: 0.012, p }, o));
  const upright = (low, p, lv) => pt('pluck', lv ?? -27, { mode: 'bass', low, pan: 0.05, rev: 0.12, p });
  const sub = (low, p, lv, o) => pt('bass', lv ?? -31, { mode: 'bass', low, o: Object.assign({ type: 'sub', a: 0.8, r: 1.5 }, o), p });
  const ep = (center, p, lv, o) => pt('epiano', lv ?? -27, Object.assign({ mode: 'chord', center, pan: 0.25, rev: 0.45, dly: 0.12, human: 0.015, p }, o));
  const acc = (center, p, lv) => pt('accordion', lv ?? -30, { mode: 'chord', center, maxV: 3, pan: 0.3, rev: 0.35, p });
  const accmel = (root, p, lv) => pt('accordion', lv ?? -27, { mode: 'deg', root, pan: 0.35, rev: 0.4, dly: 0.12, human: 0.02, p });
  const brass = (root, p, lv, o) => pt('brass', lv ?? -30, Object.assign({ mode: 'deg', root, pan: -0.15, rev: 0.55, dly: 0.08, p }, o));
  const blip = (root, p, lv, o) => pt('blip', lv ?? -34, Object.assign({ mode: 'deg', root, pan: -0.5, rev: 0.6, dly: 0.35, prob: 0.6, p }, o));
  const heart = (p, lv) => pt('thump', lv ?? -28, { rev: 0.1, p: { '*': p || 'x.......x.......' } });

  // ════ 人物 ════
  // 林桥：修理铺的灯。墙上的钟、毡钢琴、八音盒弹南栈那句（总少最后一个音），C 段手风琴接过去拉
  T('th_lin2', {
    name: '林桥 · 修理铺的灯', pool: 'th_lin', desc: '林桥的主题：钟、毡钢琴、少一个音的八音盒', bpm: 66, scale: 'minor', space: 'room', tape: 1, sat: 0.35, gain: 0.83, cal: { clock: 1.47, piano: 0.82, guitar: 0.76, accmel: 1.65, acc: 0.69 }, delay: 0.5,
    sections: [
      { name: 'I', bars: 2, chords: 'Em9 | Cmaj7' },
      { name: 'A', bars: 8, chords: 'Em9 | Cmaj7 | Em9 | Cmaj7 | Am9 | Cmaj7 | Em9 | B7sus4' },
      { name: 'B', bars: 8, chords: 'Cmaj7 | D6 | Bm7 | Em9 | Cmaj7 | D6 | Am9 | B7sus4,B' },
      { name: 'C', bars: 4, chords: 'Am9 | Em9 | Cmaj7 | B7sus4' },
      { name: 'A2', like: 'A' },
      { name: 'O', bars: 2, chords: 'Em9 | Em9' },
    ],
    form: ['I', 'A', 'B', 'C', 'A2', 'B', 'O'], loop: 1,
    parts: {
      drone: drone(40),
      clock: tick(),
      radio: radio(),
      piano: piano(55, {
        I: B('x...............', 'x.......2.......'),
        A: [B('x.......2.......', 'x...........1...', 'x.......2...3...', 'x...............', 'x.......2.......', 'x...........1...', 'x.......2.......', 'x.......1...0...'),
          B('x...........2...', 'x.......3.......', 'x...2...........', 'x.......1.......', 'x...........2...', 'x.......3.......', 'x...2...1.......', 'x---------------')],
        B: B('x...............', 'x.......2.......', 'x...............', 'x...4...3...2...'),
        C: B('x...............', 'x...............', 'x...............', 'x---------------'),
        O: B('x...............', '0---------------'),
      }),
      box: box(76, {
        A: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R, R, R, '4---3---2-------', R),
        B: B(R, R, '4---3---2-------', '........0---2---', R, R, '4---3---2---1---', R),
        A2: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R, '7---6---4-------', R, '4-3-2-----------', R),
        O: B('0-2-4-3-2-------', R),
      }),
      guitar: pluck(52, { B: ['0.1.2.1.3.2.1.2.', '0...2.1.3...2.1.'], C: '0.1.2.3.2.1.0...', A2: '0...2.1.3...2.1.' }, -29),
      upright: upright(40, { B: 'x.......5.......', C: 'x---------------', A2: 'x.......5.......' }, -28),
      strings: strings(59, { B: X, C: B(X, L), O: HOLD2X }, -31),
      accmel: accmel(76, { C: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R) }, -27),
      acc: acc(64, { C: 'x-------x-------' }, -32),
    },
  });

  // 阿隼：消息的价钱。拨弦低音的切分总抢半拍，远处拖铁、钟走得比人急；B 段低音铜管在底下压着
  T('th_ahsun2', {
    name: '阿隼 · 消息的价钱', pool: 'th_ahsun', desc: '阿隼的主题：不安的拨弦切分、拖铁、钟', bpm: 88, scale: 'phrygian', space: 'room', tape: 0.6, sat: 0.45, gain: 0.87, cal: { bass: 0.46, sub: 0.58, clock: 1.31, hat: 2.58, shaker: 0.38, guitar: 1.35, ep: 0.75 }, delay: 0.5,
    sections: [
      { name: 'I', bars: 2, chords: 'Am7 | Am7' },
      { name: 'A', bars: 8, chords: 'Am7 | Bbmaj7 | Am7 | G6 | Am7 | Bbmaj7 | Dm7 | Am7' },
      { name: 'B', bars: 8, chords: 'Dm7 | Bbmaj7 | Am7 | Am7 | Dm7 | Bbmaj7 | Esus4 | E7b9' },
      { name: 'C', bars: 4, chords: 'Fmaj7#11 | Fmaj7#11 | Bbmaj7 | Am7' },
      { name: 'A2', like: 'A' },
      { name: 'O', bars: 2, chords: 'Am7 | Am7' },
    ],
    form: ['I', 'A', 'B', 'C', 'A2', 'B', 'O'], loop: 1,
    parts: {
      bass: upright(33, { I: B(R, 'x..x..x...x.....'), A: 'x..x..x...x.x...', B: B('x..x..x...x.o...', 'x..x..x...x.x...'), C: B('x---------------', R), A2: 'x..x..x...x.x...', O: B('x..x..x...x.....', 'x---------------') }, -26),
      sub: sub(33, { A: 'x..x..x...x.x...', B: 'x..x..x...x.x...', A2: 'x..x..x...x.x...' }, -31),
      clock: tick('x...g...x...g...', -36, { p: { '*': 'x...g...x...g...', C: 'x.......x.......' } }),
      hat: pt('hat', -33, { pan: 0.35, velRand: 0.3, p: { A: '......x.......x.', B: '..g...x...g...x.', A2: '..g...x...g...x.' } }),
      shaker: pt('shaker', -35, { pan: 0.45, velRand: 0.4, p: { B: 'g.x.g.x.g.x.g.x.', A2: 'g.x.g.x.g.x.g.x.' } }),
      clank: pt('clank', -30, { pan: 0.5, rev: 0.6, p: { '*': B(R, '...............x'), C: B('x...............', R) } }),
      guitar: pt('pluck', -28, { mode: 'deg', root: 69, pan: 0.3, rev: 0.35, dly: 0.18, human: 0.012,
        p: { A: B('...4..3...1.0...', R, '...4..3...1.....', '..0.1.0.........'), A2: B('...4..3...1.0...', R, '...4..3...1.....', '..0.1.0.........', '...7..6...4.3...', R, '...4..3...1.0...', R),
          B: B('0..1..0.........', R, '3..4..3...1.....', R) } }),
      ep: ep(62, { A: B('....x...........', R, '....x...........', '........2.......'), B: B('....x.......x...', R), C: B('x---------------', L, 'x...............', R) }, -29),
      brass: brass(45, { B: B('0---------------', L, '1---------------', '0-------........', '0---------------', L, '4---------------', '3-------........') }, -31),
      radio: radio(),
      drone: drone(33, -33),
    },
  });

  // 陆峥：善后。慢而冷的钢琴，每个和弦里都有一个音不对（大七、降九）；远处的钟、B 段打字机像在记档
  T('th_lu2', {
    name: '陆峥 · 善后', pool: 'th_lu', desc: '陆峥的主题：冷钢琴、不对劲的那个音、记档的打字机', bpm: 54, scale: 'harmonic', space: 'hall', tape: 0.2, sat: 0.25, gain: 0.96, cal: { sub: 0.6, strings: 1.27, bell: 1.69, clock: 1.75, type: 1.3 }, delay: 0.5,
    sections: [
      { name: 'A', bars: 8, chords: 'Gmmaj7 | Ebmaj7 | Cm9 | D7b9 | Gmmaj7 | Ebmaj7 | Am7b5 | D7b9' },
      { name: 'B', bars: 8, chords: 'Cm9 | Gmmaj7 | Ebmaj7#11 | D7sus4 | Cm9 | Gmmaj7 | Am7b5 | D7b9' },
      { name: 'C', bars: 4, chords: 'Ebmaj7 | Ebmaj7 | Dsus4 | D' },
    ],
    form: ['A', 'B', 'A', 'C', 'B'], loop: 0,
    parts: {
      drone: drone(43, -33, { cut: 240 }),
      sub: sub(31, { '*': B(X, L), C: B(X, L) }, -32),
      piano: piano(57, {
        A: [B('x...........4...', 'x...............', 'x.......2.......', 'x...............', 'x...........4...', 'x...............', 'x.......2.......', 'x.......1...0...'),
          B('x.......4.......', 'x...........2...', 'x...............', 'x.......1...0...', 'x.......4.......', 'x...........2...', 'x...............', 'x---------------')],
        B: B('x...............', 'x.......3.......', 'x...............', 'x...4...3...2...'),
        C: B('0...............', R, '0...............', '0---------------'),
      }, -25, { pan: -0.15, rev: 0.55, dly: 0.12, human: 0.01 }),
      strings: strings(76, { A: B(X, L, X, L), B: X, C: B(X, L, L, L) }, -33, { cut: 2400, a: 3 }),
      bell: bell(84, { A: B(R, '........0.......', R, R), B: B(R, R, R, '........0.......') }, -34),
      clock: tick('x.......x.......', -38, { pan: -0.5 }),
      type: pt('typewriter', -37, { pan: 0.55, rev: 0.35, velRand: 0.4, prob: 0.7, p: { B: B('x.x..x.x....x...', R, '..x.x.....x.x...', R) } }),
      choir: choir(62, 'u', { C: B(X, L, X, L) }, -33),
    },
  });

  // E-17：没停的那一趟。隧道里很长的回声，报站的三个音倒着弹（4 0 2），远处铁轨的节奏，C 段合唱像车窗里的人
  T('th_e17_2', {
    name: 'E-17 · 没停的那一趟', pool: 'th_e17', desc: 'E-17 的主题：倒着的叮咚叮、远处的铁轨、隧道回声', bpm: 52, scale: 'major', space: 'tunnel', tape: 0.8, sat: 0.3, gain: 1.09, cal: { rail: 1.34, box: 1.62, choir: 0.76, heart: 1.65 }, delay: 0.5,
    sections: [
      { name: 'I', bars: 4, chords: 'E | C#m7 | B | C#m7' },
      { name: 'A', bars: 8, chords: 'E | C#m7 | Amaj7 | B6 | E | C#m7 | Amaj7 | Bsus4' },
      { name: 'B', bars: 8, chords: 'C#m7 | Amaj7 | E | B | C#m7 | Amaj7 | F#m7 | Bsus4,B' },
      { name: 'C', bars: 4, chords: 'Amaj7#11 | Amaj7#11 | C#m7 | C#m7' },
      { name: 'O', bars: 4, chords: 'E | C#m7 | Amaj7 | E' },
    ],
    form: ['I', 'A', 'B', 'C', 'A', 'O'], loop: 1,
    parts: {
      drone: drone(40, -32, { cut: 250 }),
      rail: pt('train', -33, { pan: -0.25, rev: 0.3, prob: 0.85, p: { A: 'x.......x.......', B: 'x.......x.......', C: B(R, R, 'x.......x.......', 'x.......x.......') } }),
      e17: chime(76, {
        I: B('4.......0.......', '2---------------', R, R),
        A: B(R, R, R, '4.......0.......', R, R, R, '4.......0.......'),
        B: B(R, R, '4.......0.......', '2---------------', R, R, R, R),
        C: B('4...0...........', R, '4...0...2.......', R),
        O: B(R, R, '4.......0.......', R),
      }, -28),
      pad: pad(60, { A: X, B: X, C: X, O: X }, -34),
      strings: strings(55, { B: X, C: B(X, L), O: HOLD2X }, -31, { cut: 1600 }),
      box: box(88, { B: B(R, R, R, R, '0-2-4-3---------', R, R, R) }, -29, { pan: 0.4, detuneRand: 22 }),
      choir: choir(64, 'u', { C: B(X, L, X, L) }, -31),
      heart: heart(null, -32),
      wind: wind(340),
    },
  });

  // ════ 尾声 ════
  // 到站了（公开结局）：E-17 三个音终于正着弹完（2 0 4），八音盒那句弹到最后一个音；站台上一盏盏亮灯，合唱、弦乐推满
  T('epi_public', {
    name: '到站了', pool: 'th_e17_resolve', desc: '公开结局：报站音正着弹完，南栈那句弹完最后一个音', bpm: 60, scale: 'major', space: 'hall', tape: 0.4, sat: 0.25, gain: 0.89, cal: { e17: 0.82, strings: 1.2, choir: 1.63, bell: 1.35 }, delay: 0.5,
    sections: [
      { name: 'I', bars: 4, chords: 'Eadd9 | Amaj7 | Eadd9 | Bsus4' },
      { name: 'A', bars: 8, chords: 'Eadd9 | Amaj7 | C#m7 | B6 | Eadd9 | Amaj7 | F#m7 | Bsus4,B' },
      { name: 'B', bars: 8, chords: 'Amaj7 | B6 | G#m7 | C#m7 | Amaj7 | B6 | F#m7 | Bsus4' },
      { name: 'C', bars: 8, chords: 'Eadd9 | B/D# | C#m7 | Amaj7 | Eadd9 | B6 | Amaj7 | Eadd9' },
      { name: 'O', bars: 4, chords: 'Amaj7 | Eadd9 | Amaj7 | Eadd9' },
    ],
    form: ['I', 'A', 'B', 'C', 'O'], loop: 1,
    parts: {
      drone: drone(40, -33, { cut: 300 }),
      piano: piano(52, {
        I: B('x...............', 'x.......2.......', 'x...............', 'x.......1.......'),
        A: B('x.......2.......', 'x...........1...', 'x.......2...3...', 'x...............', 'x.......2.......', 'x...........1...', 'x.......2.......', 'x.......1...0...'),
        B: B('x...2...3.......', 'x...........2...', 'x...2...........', 'x.......1.......'),
        C: B('x...2...3...4...', 'x.......2.......', 'x...2...3.......', 'x...............', 'x...2...3...4...', 'x.......2.......', 'x...............', 'x---------------'),
        O: B('x...............', '0---------------'),
      }, -26),
      e17: chime(76, {
        I: B(R, R, '2.......0.......', '4---------------'),
        A: B(R, R, R, R, R, R, R, '2.......0.......'),
        B: B('4---------------', R, R, R, R, R, '2.......0.......', '4---------------'),
        C: B('2.......0.......', '4---------------', R, R, '2.......0.......', '4---------------', R, '7---------------'),
        O: B('2.......0.......', '4---------------', R, R),
      }, -28, { pan: 0.25 }),
      box: box(76, {
        B: B('0-2-4-3-2---1---', '0---------------', R, R, '0-2-4-3-2---1---', '0---------------', R, R),
        O: B(R, R, '0-2-4-3-2-1-0---', R),
      }, -27),
      strings: strings(64, { A: X, B: X, C: X, O: B(X, L) }, -30, { cut: 2300 }),
      choir: choir(60, 'a', { C: X, O: B(X, L) }, -31),
      pad: pad(62, { A: X, B: X, C: X }, -34, { cut: 1800 }),
      upright: upright(40, { B: 'x.......5.......', C: 'x.......5.......' }, -29),
      bell: bell(88, { C: B('0...............', R, R, R, '0...............', R, R, R) }, -34, { prob: 1 }),
    },
  });

  // 还是延误（卖掉 / 暂时保留）：站台上没人，屏还是红的。电钢、屏的嗡声，报站音弹两个就停了（2 0 ·）
  T('epi_late', {
    name: '还是延误', pool: 'epi_late', desc: '另一个结局：屏还是红的，报站音只弹两个就停', bpm: 56, scale: 'minor', space: 'hall', tape: 0.7, sat: 0.3, gain: 1.15, cal: { screen: 0.76, piano: 1.62, clock: 1.71 }, delay: 0.5,
    sections: [
      { name: 'A', bars: 8, chords: 'Cm9 | Abmaj7 | Ebmaj7 | Bb6 | Cm9 | Abmaj7 | Fm9 | Gsus4' },
      { name: 'B', bars: 8, chords: 'Abmaj7 | Bb6 | Gm7 | Cm9 | Abmaj7 | Bb6 | Gsus4 | G' },
      { name: 'C', bars: 4, chords: 'Fm9 | Fm9 | Cm9 | Cm9' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      drone: drone(36, -32, { cut: 280 }),
      screen: pad(76, { '*': X }, -37, { cut: 900, a: 3, r: 3, wave: 'triangle' }),
      e17: chime(72, { A: B(R, R, R, '2.......0.......', R, R, R, R), C: B('2.......0.......', R, R, R) }, -29),
      ep: ep(60, { A: [B('x.......2.......', 'x...........1...'), B('x...........2...', 'x.......1.......')], B: B('x...............', 'x.......3.......') }, -27),
      strings: strings(63, { B: X, C: B(X, L) }, -32, { cut: 1900, a: 2 }),
      piano: piano(48, { C: B('0...............', R, '0.......1.......', R) }, -27, { pan: -0.15, rev: 0.5 }),
      box: box(84, { B: B(R, R, R, R, '0-2-4-3-2-------', R, R, R) }, -29, { detuneRand: 28, prob: 1 }),
      clock: tick('x.......x.......', -38),
    },
  });

  // ════ 序幕 ════
  // 二十三年：地面没人了，底下的机器照常排班。低音铜管的长音（机器）、慢的上行四音琶音（时钟）、倒着的报站音；钢琴弹出南栈那句的头
  T('prologue', {
    name: '序幕 · 二十三年', pool: 'prologue', desc: '新存档的序幕：机器的长音、慢的时钟琶音、倒着的报站音', bpm: 58, scale: 'minor', space: 'tunnel', tape: 0.6, sat: 0.35, gain: 0.85, cal: { sub: 0.55, arp: 1.84, e17: 0.6, piano: 0.82 }, delay: 0.3,
    sections: [
      { name: 'A', bars: 4, chords: 'Dm9 | Bbmaj7 | Dm9 | Asus4' },
      { name: 'B', bars: 8, chords: 'Dm9 | Bbmaj7 | Gm9 | Asus4 | Dm9 | Bbmaj7 | Fmaj7 | Asus4,A' },
      { name: 'C', bars: 8, chords: 'Bbmaj7 | C6 | Dm9 | Dm9 | Bbmaj7 | C6 | Gm9 | Asus4' },
      { name: 'O', bars: 4, chords: 'Dm9 | Bbmaj7 | Gm9 | Dm9' },
    ],
    form: ['A', 'B', 'C', 'B', 'O'], loop: 1,
    parts: {
      drone: drone(38, -31, { cut: 260 }),
      sub: sub(26, { '*': B(X, L) }, -31),
      brass: brass(50, { A: B('0---------------', L, '0---------------', '4---------------'), B: B('0---------------', L, L, '4---------------', '0---------------', L, L, '4---------------'), O: B('0---------------', L, L, L) }, -31),
      arp: pt('arp', -32, { mode: 'chord', center: 74, pan: 0.4, rev: 0.45, dly: 0.25, o: { cut: 1000, q: 5, dec: 0.2 }, p: { A: B(R, R, R, '0...1...2...3...'), B: B('0...1...2...3...', R), C: B('0...1...2...3...', R) } }),
      e17: chime(74, { A: B('4.......0.......', '2---------------', R, R), C: B(R, R, R, '4.......0.......', R, R, R, R), O: B(R, R, '4.......0.......', R) }, -28),
      piano: piano(57, { B: B('x...............', 'x...............', 'x...............', 'x...............', '0-2-4-3-2-------', R, 'x...............', R), C: B('x.......2.......', 'x...........1...', 'x.......2.......', 'x.......1...0...'), O: B('x...............', R, R, '0---------------') }, -26),
      strings: strings(57, { C: X, O: B(X, L) }, -31, { cut: 1700 }),
      choir: choir(62, 'u', { C: B(R, R, R, R, X, L, X, L) }, -33),
      wind: wind(300),
      radio: radio(),
    },
  });

  // ════ 小剧情屋情绪曲（各 8–16 小节一轮，循环；演完一场就停） ════
  // 温情 · 灯还亮着：拨弦吉他、手风琴、八音盒，F 大调，像有人给你留了一碗面
  T('mood_warm', {
    name: '灯还亮着', pool: 'mood_warm', desc: '小剧情屋 · 温情：拨弦、手风琴、八音盒', bpm: 74, scale: 'major', space: 'room', tape: 1, sat: 0.3, gain: 0.85, cal: { guitar: 0.81, acc: 0.78, box: 0.82, clock: 1.5 }, delay: 0.3,
    sections: [
      { name: 'A', bars: 8, chords: 'Fmaj7 | C6 | Dm9 | Bbmaj7 | Fmaj7 | C6 | Bbmaj7 | C6' },
      { name: 'B', bars: 8, chords: 'Bbmaj7 | C6 | Am7 | Dm9 | Bbmaj7 | C6 | Gm9 | Csus4,C' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      guitar: pluck(55, { A: ['0.1.2.1.3.2.1.2.', '0...2.1.3...2.1.'], B: '0.1.2.3.2.1.0...' }, -27),
      upright: upright(41, { '*': 'x.......5.......' }, -28),
      acc: acc(65, { B: X }, -31),
      box: box(77, { A: B('0-2-4-3-2---1---', R, '4---3---2-------', R, '0-2-4-3-2---1---', R, '2---1---0-------', R), B: B(R, R, '4-5-4-3-2-------', R, R, R, '1---2---4-------', R) }, -27),
      piano: piano(60, { B: B('x...............', 'x.......2.......') }, -29),
      clock: tick('x...g...x...g...', -38),
      drone: drone(41, -34),
    },
  });

  // 不安 · 不对劲：E 弗里吉亚，长音底下一层不该在那儿的和弦（大七 #11），钟走在反拍上，电钢走一点调
  T('mood_uneasy', {
    name: '不对劲', pool: 'mood_uneasy', desc: '小剧情屋 · 不安：反拍的钟、走调的电钢、悬着的和弦', bpm: 66, scale: 'phrygian', space: 'hall', tape: 1.2, sat: 0.4, gain: 1.04, cal: { sub: 0.73, clock: 1.57, strings: 1.27, heart: 1.22 }, delay: 0.3,
    sections: [
      { name: 'A', bars: 8, chords: 'Em | Fmaj7#11 | Em | Em | Cmaj7 | Fmaj7#11 | Em | Bm7b5' },
      { name: 'B', bars: 8, chords: 'Am7 | Fmaj7#11 | Am7 | Em | Dm7 | Fmaj7#11 | Bm7b5 | Em' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      drone: drone(40, -31, { cut: 240 }),
      sub: sub(28, { '*': 'x---------------|........x.......' }, -32),
      clock: tick('..g...x...g...x.', -36),
      ep: ep(62, { A: B('x...............', R, '........2.......', R), B: B('x.......1.......', R) }, -28, { detuneRand: 22 }),
      strings: strings(64, { A: B(R, X, R, R, R, X, R, R), B: B(R, X, L, R) }, -32, { cut: 1500 }),
      bell: bell(83, { '*': B(R, '..........0.....', R, R) }, -35, { prob: 0.6 }),
      blip: blip(88, { B: B('..0.......1.....', R) }, -36),
      heart: heart('x.......x.......|................', -33),
    },
  });

  // 悲伤 · 空座位：A 小调，钢琴和低处的弦乐，八音盒慢下来、只弹到一半
  T('mood_sad', {
    name: '空座位', pool: 'mood_sad', desc: '小剧情屋 · 悲伤：钢琴、低弦乐、慢下来的八音盒', bpm: 60, scale: 'minor', space: 'hall', tape: 0.9, sat: 0.3, gain: 0.92, cal: { piano: 0.82, cello: 1.27, strings: 1.24 }, delay: 0.3,
    sections: [
      { name: 'A', bars: 8, chords: 'Am9 | Fmaj7 | Cmaj7 | Em7 | Am9 | Fmaj7 | Dm9 | Esus4' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am9 | Fmaj7 | G6 | Dm9 | Esus4,E' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      drone: drone(45, -33),
      piano: piano(57, { A: [B('x.......2.......', 'x...........1...', 'x.......2.......', 'x...............'), B('x...........2...', 'x.......1.......', 'x...2...........', 'x.......1...0...')], B: B('x...............', 'x.......2.......', 'x...............', 'x...4...3...2...') }, -25),
      cello: strings(48, { '*': X }, -31, { cut: 1200, a: 1.6 }),
      strings: strings(67, { B: X }, -32, { cut: 2200 }),
      box: box(81, { A: B(R, R, R, R, '0---2---4---3---', '2---------------', R, R), B: B(R, R, R, R, R, R, '0---2---4-------', R) }, -28, { detuneRand: 20 }),
      choir: choir(60, 'u', { B: B(R, R, R, R, X, L, X, L) }, -34),
    },
  });

  // 荒诞 · 照常营业：一本正经的小进行曲。拨弦低音一拍一个、手风琴反拍、数据音弹一句很认真的旋律、打字机在记账
  T('mood_absurd', {
    name: '照常营业', pool: 'mood_absurd', desc: '小剧情屋 · 荒诞：一本正经的小进行曲、反拍手风琴、记账的打字机', bpm: 104, scale: 'lydian', space: 'room', tape: 0.8, sat: 0.35, gain: 1.05, cal: { bass: 0.67, acc: 1.67, blip: 0.58, clap: 1.75, box: 0.64 }, delay: 0.3,
    sections: [
      { name: 'A', bars: 8, chords: 'C6 | D6 | C6 | Bm7 | C6 | D6 | Em7 | D6' },
      { name: 'B', bars: 8, chords: 'Am7 | D6 | Gmaj7 | C6 | Am7 | D6 | Bm7 | D6' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      bass: upright(36, { '*': 'x.......5.......', B: 'x...5...x...5...' }, -27),
      acc: acc(64, { '*': '....x.......x...' }, -30),
      blip: blip(84, { A: B('0...0...2...4...', '3-------........', '0...0...2...4...', '6-------........', '4...3...2...0...', '1-------........', '0...2...4...3...', '0-------........'), B: B('4.4.4...3.......', R, '2.2.2...0.......', R) }, -31, { prob: 1, dly: 0.12, rev: 0.35, pan: 0.25 }),
      type: pt('typewriter', -35, { pan: -0.45, rev: 0.25, velRand: 0.4, prob: 0.8, p: { B: B('x.x.x..x.x.x....', '..............g.') } }),
      clock: tick('x.g.x.g.x.g.x.g.', -37),
      clap: pt('clap', -32, { rev: 0.3, p: { B: '........x.......' } }),
      box: box(76, { B: B(R, R, R, '0-2-4-3-2-------') }, -30),
    },
  });

  // 紧张 · 别动：D 小调，心跳一样的低音、密的钟、弦乐短促地重复，段尾往上推一下
  T('mood_tense', {
    name: '别动', pool: 'mood_tense', desc: '小剧情屋 · 紧张：心跳低音、密的钟、短促的弦乐', bpm: 96, scale: 'minor', space: 'room', tape: 0.4, sat: 0.5, gain: 0.91, cal: { heart: 0.73, sub: 0.63, clock: 0.62, riser: 2.18 }, delay: 0.3,
    sections: [
      { name: 'A', bars: 8, chords: 'Dm | Dm | Bbmaj7 | A7sus4 | Dm | Dm | Gm7 | A7b9' },
      { name: 'B', bars: 8, chords: 'Gm7 | Gm7 | Dm | Dm | Bbmaj7 | Gm7 | Asus4 | A7b9' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      drone: drone(38, -31),
      heart: heart('x..x....x..x....', -27),
      sub: sub(26, { '*': 'x..x....x..x....' }, -30),
      clock: tick('xgxgxgxgxgxgxgxg', -37),
      stab: strings(57, { '*': 'x.x.x.x.x.x.x.x.' }, -32, { a: 0.02, r: 0.12, cut: 2600 }),
      arp: pt('arp', -33, { mode: 'chord', center: 62, pan: -0.4, rev: 0.3, dly: 0.15, o: { cut: 1300, q: 6, dec: 0.12 }, p: { B: '0.1.2.3.0.1.2.3.' } }),
      metal: pt('metal', -33, { pan: 0.5, rev: 0.55, p: { '*': B(R, R, R, '...........x....') } }),
      riser: pt('riser', -33, { mode: 'deg', root: 62, rev: 0.4, p: { '*': B(R, R, R, R, R, R, R, Z) } }),
    },
  });

  // 神秘 · 频段：利底亚，长音底下零星的数据音、钟琴、合唱"呜"，报站音倒着弹一次
  T('mood_mystery', {
    name: '频段', pool: 'mood_mystery', desc: '小剧情屋 · 神秘：数据音、钟琴、合唱，倒着的报站音', bpm: 58, scale: 'lydian', space: 'tunnel', tape: 0.6, sat: 0.3, gain: 1.28, cal: { chime: 0.61, bell: 1.36, choir: 0.8 }, delay: 0.3,
    sections: [
      { name: 'A', bars: 8, chords: 'Dmaj7#11 | Dmaj7#11 | Em7 | Em7 | Dmaj7#11 | Bm7 | Em7 | A6' },
      { name: 'B', bars: 8, chords: 'Gmaj7 | Gmaj7 | F#m7 | Bm7 | Gmaj7 | Em7 | Asus4 | A6' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      drone: drone(38, -32, { cut: 300 }),
      pad: pad(62, { '*': X }, -33, { cut: 1100, a: 3 }),
      blip: blip(86, { '*': B('..0.......4.....', '........7.......', '....2...........', '..........b.....') }, -33),
      chime: chime(74, { A: B(R, R, R, '4.......0.......', '2---------------', R, R, R) }, -29),
      bell: bell(86, { B: B('0...............', R, '........1.......', R) }, -33),
      choir: choir(62, 'u', { B: X }, -32),
      wind: wind(420),
    },
  });
})(D);
