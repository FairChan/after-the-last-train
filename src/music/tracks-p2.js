/* 配乐第二代 · P2：菜单、据点、线路图、中继、路上（第三节 A、B）。
   标题 2（末班之后、冷屏）· 据点 4（没人的铺子在 tracks-p0；修理铺的午夜、站台那块屏、天亮前）· 线路图 2（排班之前、敌人的排班表）
   · 中继 3（铁原 / 白沙 / 北渡，各用那座城的一句）· 坐车 3（平稳、不安、车上有人）· 换层短乐句 2。
   动机：南栈（0-2-4-3-2-1，第二遍少最后一个）、E-17（叮—咚—叮 = 音阶 2 0 4，平时倒着 4 0 2 或缺最后一个）、机器（上行四音琶音）、
   铁原（铜管 0 0 4 3 1，像行军）、白沙（往下滑的 4 3 2 1 0，带走调）、北渡（很开的 0 4 7 b，数据音）。
   每个声部的 lv 是"响着的时候"的目标响度（dB），vol 由校准脚本按 lv 算出来。设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const T = D.Mus2.track;
  const R = '................', L = '----------------', X = 'x---------------', Z = '0---------------';
  const B = (...bars) => bars.join('|'), B4 = bar => B(bar, bar, bar, bar), R4 = B4(R), HOLD2 = B(Z, L), HOLD4X = B(X, L, L, L);

  // ════ 标题 ════
  // 末班之后（夜里版）：南栈那块屏前面站着。低长音、毡钢琴，E-17 倒着弹，B 段八音盒把南栈那句弹出来
  T('title_night', {
    name: '末班之后', pool: 'title', desc: '标题页：夜里，屏前的长音和倒着的报站音', bpm: 56, scale: 'minor', space: 'hall', tape: 0.8, sat: 0.3, gain: 0.83, delay: 0.75,
    sections: [
      { name: 'I', bars: 4, chords: 'Amadd9 | Fmaj7 | Amadd9 | Esus4' },
      { name: 'A', bars: 8, chords: 'Am9 | Fmaj7 | Cmaj7 | G6 | Am9 | Fmaj7 | Dm9 | Esus4,E' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | Em7 | Dm9 | Am9 | Fmaj7 | Em7 | Dm9 | Esus4' },
      { name: 'C', bars: 4, chords: 'Fmaj7#11 | Fmaj7#11 | Amadd9 | Amadd9' },
      { name: 'A2', like: 'A' },
      { name: 'O', bars: 4, chords: 'Am9 | Fmaj7 | Dm9 | Amadd9' },
    ],
    form: ['I', 'A', 'B', 'C', 'A2', 'B', 'O'], loop: 1,
    parts: {
      drone: { inst: 'drone', mode: 'deg', root: 45, vol: 0.019, lv: -31, rev: 0.3, o: { cut: 280 }, p: { '*': HOLD2 } },
      radio: { inst: 'crackle', vol: 0.69, lv: -39, pan: 0.3, rev: 0.1, p: { '*': HOLD4X } },
      pad: { inst: 'pad', mode: 'chord', center: 60, vol: 0.013, lv: -32, rev: 0.4, fx: [['highpass', 300]], o: { cut: 1400, a: 2.2, r: 3 }, p: { A: X, B: X, A2: X, O: X } },
      strings: { inst: 'strings', mode: 'chord', center: 64, maxV: 3, vol: 0.019, lv: -31, rev: 0.5, o: { a: 2.5, r: 3, cut: 2000 }, p: { B: X, C: B(X, L, X, L) } },
      piano: { inst: 'piano', mode: 'chord', center: 57, vol: 0.21, lv: -25, pan: -0.2, rev: 0.45, dly: 0.1, human: 0.018,
        p: {
          I: B('0...............', R, '0.......2.......', '1---------------'),
          A: [B('x.......2.......', 'x...........1...', 'x.......2...3...', 'x...............', 'x.......2.......', 'x...........1...', 'x.......2.......', 'x.......1...0...'),
            B('x...........2...', 'x.......3.......', 'x...2...........', 'x.......1.......', 'x...........2...', 'x.......3.......', 'x...2...1.......', 'x---------------')],
          B: B('x...............', 'x.......2.......', 'x...............', 'x...4...3...2...'),
          C: B('0...............', R, '0...............', R),
          O: B('x...............', 'x...............', 'x...............', 'x---------------'),
        } },
      e17: { inst: 'chime', mode: 'deg', root: 69, vol: 0.14, lv: -29, pan: -0.45, rev: 0.85, dly: 0.3,
        p: { I: B(R, R, '4.......0.......', '2---------------'), C: B('4.......0.......', '2---------------', R, R), A2: B(R, R, R, R, R, R, '4.......0.......', R) } },
      box: { inst: 'musicbox', mode: 'deg', root: 81, vol: 0.18, lv: -26, pan: 0.3, rev: 0.5, dly: 0.2, human: 0.02, prob: 0.95, detuneRand: 14,
        p: { B: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R) } },
      choir: { inst: 'choir', mode: 'chord', center: 60, vol: 0.019, lv: -33, rev: 0.6, o: { vowel: 'u', a: 2, r: 3 }, p: { C: B(X, L, X, L) } },
    },
  });

  // 冷屏：更冷的一首。屏的嗡声、远处的钟、慢得像停了的机器琶音、零星的数据音；E-17 只弹两个音
  T('title_cold', {
    name: '冷屏', pool: 'title', desc: '标题页：冷的一首，屏的嗡声和停摆的机器', bpm: 50, scale: 'phrygian', space: 'tunnel', tape: 0.3, sat: 0.4, gain: 0.94, delay: 1,
    sections: [
      { name: 'A', bars: 8, chords: 'Em | Em | Fmaj7 | Em | Em | Cmaj7 | Fmaj7 | Em' },
      { name: 'B', bars: 8, chords: 'Am7 | Am7 | Fmaj7#11 | Fmaj7#11 | Dm9 | Dm9 | Esus4 | Em' },
      { name: 'C', bars: 4, chords: 'Cmaj7 | Bm7 | Fmaj7 | Em' },
    ],
    form: ['A', 'B', 'A', 'C', 'B'], loop: 0,
    parts: {
      hum: { inst: 'drone', mode: 'deg', root: 52, vol: 0.015, lv: -33, rev: 0.3, o: { cut: 520 }, p: { '*': HOLD2 } },
      sub: { inst: 'bass', mode: 'bass', low: 28, vol: 0.024, lv: -31, o: { type: 'sub', a: 1.5, r: 2 }, p: { '*': B(X, L) } },
      wind: { inst: 'wind', vol: 0.11, lv: -36, pan: 0.2, rev: 0.4, o: { f: 360, q: 0.8 }, p: { '*': HOLD4X } },
      bell: { inst: 'bell', mode: 'chord', center: 79, vol: 0.083, lv: -31, pan: 0.5, rev: 0.75, dly: 0.3, prob: 0.8,
        p: { A: B('0.......2.......', R, '........1.......', R), B: B('2...............', '....0...........') } },
      ep: { inst: 'epiano', mode: 'chord', center: 64, vol: 0.15, lv: -27, pan: -0.25, rev: 0.5, human: 0.015,
        p: { A: B('x...............', R), B: B('x.......2.......', R, 'x...............', '........1.......'), C: 'x...............' } },
      arp: { inst: 'arp', mode: 'chord', center: 76, vol: 0.13, lv: -32, pan: 0.4, rev: 0.4, dly: 0.25, o: { cut: 900, q: 5, dec: 0.2 },
        p: { A: B(R, R, R, '0...1...2...3...'), C: '0...1...2...3...' } },
      blip: { inst: 'blip', mode: 'deg', root: 88, vol: 0.25, lv: -34, pan: -0.5, rev: 0.6, dly: 0.35, prob: 0.5, p: { '*': B('..0.......4.....', '........7.......') } },
      e17: { inst: 'chime', mode: 'deg', root: 64, vol: 0.12, lv: -29, pan: -0.4, rev: 0.85, dly: 0.3,
        p: { A: B(R, R, R, R, R, R, R, '2.......0.......'), B: B(R, R, R, '2.......0.......') } },
      strings: { inst: 'strings', mode: 'chord', center: 59, maxV: 3, vol: 0.016, lv: -31, rev: 0.55, o: { a: 2.5, r: 3, cut: 1800 }, p: { C: X } },
    },
  });

  // ════ 据点（没人的铺子在 tracks-p0） ════
  // 修理铺的午夜：林桥还没睡。墙上的钟、一把拨弦吉他、手风琴，R 段手风琴拉一遍南栈那句
  T('hub_midnight', {
    name: '修理铺的午夜', pool: 'hub', desc: '南栈据点：钟、拨弦吉他、手风琴', bpm: 70, scale: 'dorian', space: 'room', tape: 1, sat: 0.35, gain: 1.02, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Dm9 | Dm9' },
      { name: 'A', bars: 8, chords: 'Dm9 | G9 | Dm9 | G9 | Fmaj7 | Em7 | Dm9 | Am7' },
      { name: 'B', bars: 8, chords: 'Bbmaj7 | C6 | Dm9 | Am7 | Bbmaj7 | C6 | Gm9 | A7sus4,A' },
      { name: 'R', bars: 4, chords: 'Gm9 | Dm9 | Gm9 | A7sus4' },
      { name: 'A2', like: 'A' },
      { name: 'O', bars: 2, chords: 'Dm9 | Dm9' },
    ],
    form: ['I', 'A', 'B', 'R', 'A2', 'B', 'O'], loop: 1,
    parts: {
      clock: { inst: 'tick', vol: 2.5, lv: -36, pan: 0.45, rev: 0.25, p: { '*': 'x...g...x...g...' } },
      guitar: { inst: 'pluck', mode: 'chord', center: 52, vol: 0.3, lv: -27, pan: -0.3, rev: 0.3, dly: 0.08, human: 0.012,
        p: { I: B('0.1.2.1.........', '0.1.2.1.3.2.1.2.'), A: ['0.1.2.1.3.2.1.2.', '0...2.1.3...2.1.'], B: '0.1.2.3.2.1.0...', R: '0.......2.......', A2: '0...2.1.3...2.1.', O: B('0.1.2.1.........', '0---------------') } },
      upright: { inst: 'pluck', mode: 'bass', low: 38, vol: 0.5, lv: -27, pan: 0.05, rev: 0.12, p: { A: 'x.......5.......', B: 'x.......o.......', A2: 'x.......5.......', R: 'x---------------' } },
      acc: { inst: 'accordion', mode: 'chord', center: 62, maxV: 3, vol: 0.054, lv: -30, pan: 0.3, rev: 0.35, p: { B: X, R: 'x-------x-------' } },
      accmel: { inst: 'accordion', mode: 'deg', root: 74, vol: 0.2, lv: -27, pan: 0.35, rev: 0.4, dly: 0.12, human: 0.02,
        p: { R: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R) } },
      piano: { inst: 'piano', mode: 'chord', center: 60, vol: 0.14, lv: -27, pan: -0.1, rev: 0.4, human: 0.015, p: { A2: B('x.......2.......', 'x...............'), O: B('x...............', '0---------------') } },
      radio: { inst: 'crackle', vol: 0.67, lv: -39, pan: -0.35, rev: 0.1, p: { '*': HOLD4X } },
      drone: { inst: 'drone', mode: 'deg', root: 38, vol: 0.015, lv: -34, rev: 0.25, o: { cut: 260 }, p: { '*': HOLD2 } },
    },
  });

  // 站台那块屏：红字一直亮着。E-17 倒着弹，电钢、高处细细的屏的嗡声
  T('hub_screen', {
    name: '站台那块屏', pool: 'hub', desc: '南栈据点：那块一直亮着的屏，倒着的报站音', bpm: 60, scale: 'minor', space: 'hall', tape: 0.5, sat: 0.3, gain: 1.18, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Cm9 | Abmaj7 | Ebmaj7 | Bb6 | Cm9 | Abmaj7 | Fm9 | Gsus4,G' },
      { name: 'B', bars: 8, chords: 'Abmaj7 | Bb | Gm7 | Cm9 | Abmaj7 | Bb | Gsus4 | G' },
      { name: 'C', bars: 4, chords: 'Fm9 | Fm9 | Cm9 | Cm9' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      drone: { inst: 'drone', mode: 'deg', root: 36, vol: 0.016, lv: -32, rev: 0.3, o: { cut: 280 }, p: { '*': HOLD2 } },
      screen: { inst: 'pad', mode: 'chord', center: 76, maxV: 2, vol: 0.0097, lv: -36, pan: 0.2, rev: 0.4, o: { cut: 900, a: 3, r: 3, wave: 'triangle' }, p: { '*': X } },
      e17: { inst: 'chime', mode: 'deg', root: 72, vol: 0.13, lv: -28, pan: -0.4, rev: 0.85, dly: 0.3,
        p: { A: B(R, R, R, '4.......0.......', '2---------------', R, R, R), C: B('4.......0.......', '2---------------', R, R) } },
      ep: { inst: 'epiano', mode: 'chord', center: 60, vol: 0.16, lv: -27, pan: 0.25, rev: 0.45, dly: 0.12, human: 0.015,
        p: { A: [B('x.......2.......', 'x...........1...'), B('x...........2...', 'x.......1.......')], B: B('x...............', 'x.......3.......') } },
      strings: { inst: 'strings', mode: 'chord', center: 63, maxV: 3, vol: 0.018, lv: -31, rev: 0.5, o: { a: 2, r: 3, cut: 1900 }, p: { B: X, C: B(X, L) } },
      piano: { inst: 'piano', mode: 'chord', center: 48, vol: 0.26, lv: -27, pan: -0.15, rev: 0.5, p: { C: B('0...............', R, '0.......1.......', R) } },
      bell: { inst: 'bell', mode: 'chord', center: 84, vol: 0.12, lv: -33, pan: 0.5, rev: 0.8, prob: 0.6, p: { B: B('........0.......', R) } },
      radio: { inst: 'crackle', vol: 0.78, lv: -38, pan: 0.35, rev: 0.1, p: { '*': HOLD4X } },
    },
  });

  // 天亮前：最暖的一首。八音盒、拨弦、钢琴，F 大调；B 段的八音盒是南栈那句的影子
  T('hub_dawn', {
    name: '天亮前', pool: 'hub', desc: '南栈据点：天快亮了，八音盒和拨弦', bpm: 66, scale: 'major', space: 'room', tape: 0.7, sat: 0.3, gain: 0.99, delay: 0.75,
    sections: [
      { name: 'I', bars: 4, chords: 'Fmaj7 | C/E | Dm9 | Bbmaj7' },
      { name: 'A', bars: 8, chords: 'Fmaj7 | C/E | Dm9 | Bbmaj7 | Fmaj7 | C/E | Gm9 | Csus4,C' },
      { name: 'B', bars: 8, chords: 'Bbmaj7 | C6 | Am7 | Dm9 | Bbmaj7 | C6 | Gm9 | Csus4' },
      { name: 'O', bars: 4, chords: 'Fmaj7 | Bbmaj7 | Fmaj7 | Fmaj7' },
    ],
    form: ['I', 'A', 'B', 'A', 'B', 'O'], loop: 1,
    parts: {
      box: { inst: 'musicbox', mode: 'deg', root: 77, vol: 0.16, lv: -26, pan: 0.3, rev: 0.45, dly: 0.2, human: 0.02, detuneRand: 10,
        p: { A: B('0-2-4---3-2-1---', R, '4-3-2-0---------', R), B: [B('2-4-5-4-2-------', R, '5-3-2-1-0---6---', R), B('2-4-5-4-2-------', R, '0-2-4-3-2-------', R)] } },
      guitar: { inst: 'pluck', mode: 'chord', center: 55, vol: 0.3, lv: -28, pan: -0.35, rev: 0.3, human: 0.012,
        p: { I: B('0...............', '0..1..2.........', '0...............', '0..1..2.3.......'), '*': '0..1..2.3..2..1.' } },
      piano: { inst: 'piano', mode: 'chord', center: 57, vol: 0.13, lv: -27, pan: -0.1, rev: 0.4, human: 0.015, p: { B: B('x...............', 'x.......2.......'), O: B('x...............', 'x...............', 'x.......2.......', 'x---------------') } },
      strings: { inst: 'strings', mode: 'chord', center: 65, maxV: 3, vol: 0.02, lv: -31, rev: 0.5, o: { a: 2, r: 3, cut: 2200 }, p: { B: X, O: B(X, L, X, L) } },
      drone: { inst: 'drone', mode: 'deg', root: 41, vol: 0.013, lv: -34, rev: 0.3, o: { cut: 300 }, p: { '*': HOLD2 } },
      air: { inst: 'wind', vol: 0.078, lv: -37, pan: -0.2, rev: 0.4, o: { f: 700, q: 0.6 }, p: { '*': HOLD4X } },
    },
  });

  // ════ 线路图、出发简报 ════
  // 排班之前：心跳一样的低频，长音慢慢升起
  T('map_pulse', {
    name: '排班之前', pool: 'map', desc: '线路图：心跳和慢慢升起的长音', bpm: 64, scale: 'minor', space: 'hall', tape: 0.5, sat: 0.35, gain: 0.79,
    sections: [
      { name: 'A', bars: 8, chords: 'Dm9 | F/C | Bbmaj7 | Am7' },
      { name: 'B', bars: 8, chords: 'Gm9 | Bbmaj7 | Dm9 | A7sus4,A' },
      { name: 'C', bars: 4, chords: 'Bbmaj7 | Bbmaj7 | Am7 | Am7' },
    ],
    form: ['A', 'B', 'A', 'C', 'B'], loop: 0,
    parts: {
      heart: { inst: 'thump', vol: 0.32, lv: -28, rev: 0.12, p: { '*': 'x.......x.......' } },
      drone: { inst: 'drone', mode: 'deg', root: 38, vol: 0.021, lv: -31, rev: 0.3, o: { cut: 280 }, p: { '*': HOLD2 } },
      swell: { inst: 'pad', mode: 'chord', center: 62, vol: 0.014, lv: -31, rev: 0.45, fx: [['highpass', 300]], o: { cut: 1600, a: 4, r: 3 }, p: { '*': B(X, L) } },
      sub: { inst: 'bass', mode: 'bass', low: 26, vol: 0.028, lv: -31, o: { type: 'sub', a: 0.8, r: 1.5 }, p: { '*': X } },
      ep: { inst: 'epiano', mode: 'chord', center: 67, vol: 0.32, lv: -28, pan: -0.3, rev: 0.45, dly: 0.25, prob: 0.85, human: 0.015,
        p: { A: B('0.......2.......', '....1...........', R, '........3.......'), B: [B('2.......1.......', R, '0.......2...1...', R), B(R, '2.......0.......', R, '1...............')] } },
      strings: { inst: 'strings', mode: 'chord', center: 62, maxV: 3, vol: 0.023, lv: -30, rev: 0.5, o: { a: 2.5, r: 3, cut: 2000 }, p: { C: X } },
      radio: { inst: 'crackle', vol: 0.66, lv: -39, pan: 0.3, rev: 0.1, p: { '*': HOLD4X } },
    },
  });

  // 敌人的排班表：像在看机器的排班。机器琶音、时钟、打字机敲着排班，零星的数据音
  T('map_schedule', {
    name: '敌人的排班表', pool: 'map', desc: '线路图：机器琶音、时钟、打字机', bpm: 84, scale: 'minor', space: 'hall', sat: 0.45, gain: 0.99, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Am | Am | Fmaj7 | Fmaj7 | Dm7 | Dm7 | E7sus4 | E' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G | Am | Am | Fmaj7 | G | Bb | E' },
      { name: 'C', bars: 8, chords: 'Dm9 | Dm9 | Am | Am | Bb | Bb | E7sus4 | E' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      arp: { inst: 'arp', mode: 'chord', center: 64, vol: 0.091, lv: -30, pan: -0.35, rev: 0.3, dly: 0.15, o: { cut: 1500, q: 6, dec: 0.13 }, p: { A: '0.1.2.3.0.1.2.3.', B: '0.1.2.3.4.3.2.1.', C: '0...1...2...3...' } },
      tick: { inst: 'tick', vol: 1.5, lv: -35, pan: 0.35, rev: 0.2, p: { '*': 'x.g.x.g.x.g.x.g.' } },
      type: { inst: 'typewriter', vol: 0.9, lv: -31, pan: 0.45, rev: 0.25, prob: 0.75, p: { A: B('..x.x...x..x.x..', '....x.x...x.....'), C: B('..x.x...x..x.x..', '....x.x...x.....') } },
      blip: { inst: 'blip', mode: 'deg', root: 81, vol: 0.2, lv: -33, pan: -0.5, rev: 0.5, dly: 0.25, prob: 0.5, p: { '*': B('0.......4.......', '..7.........4...') } },
      sub: { inst: 'bass', mode: 'bass', low: 33, vol: 0.06, lv: -29, duck: true, o: { type: 'sub' }, p: { '*': 'x...x...x...x...' } },
      strings: { inst: 'strings', mode: 'chord', center: 57, maxV: 3, vol: 0.018, lv: -30, rev: 0.45, o: { a: 1.2, r: 2, cut: 2000 }, p: { B: X, C: X } },
      drone: { inst: 'drone', mode: 'deg', root: 33, vol: 0.016, lv: -32, rev: 0.25, o: { cut: 260 }, p: { '*': HOLD2 } },
      bell: { inst: 'bell', mode: 'chord', center: 79, vol: 0.064, lv: -32, pan: 0.5, rev: 0.7, p: { C: B('0...............', '........2.......') } },
    },
  });

  // ════ 中继（各城的家） ════
  // 铁原中继：军工城。低音铜管吹铁原那一句（像行军），远处有人打铁，军鼓很轻
  T('relay_tieyuan', {
    name: '铁原中继', pool: 'relay_tieyuan', desc: '铁原的家：低音铜管、打铁、很轻的军鼓', bpm: 72, scale: 'harmonic', space: 'hall', sat: 0.5, gain: 1, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Gm | Gm | Cm | Cm | Ebmaj7 | Ebmaj7 | D7sus4 | D' },
      { name: 'B', bars: 8, chords: 'Cm | D | Gm | Gm | Ebmaj7 | Cm | D7sus4 | D' },
      { name: 'C', bars: 4, chords: 'Ebmaj7 | Ebmaj7 | Cm | D' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      horn: { inst: 'brass', mode: 'deg', root: 55, vol: 0.11, lv: -26, pan: -0.15, rev: 0.4, dly: 0.1, human: 0.01,
        p: { A: B('0---0-4-3---1---', Z, R, R, '4---4-7-6---4---', '3---------------', R, R), B: B(R, R, '0---0-4-3---1---', '0-------........', R, R, '2---1---0---1---', Z) } },
      lowbrass: { inst: 'brass', mode: 'chord', center: 50, maxV: 3, vol: 0.036, lv: -31, pan: 0.15, rev: 0.45, p: { B: X, C: X } },
      snare: { inst: 'snare', vol: 1, lv: -31, pan: 0.2, rev: 0.35, velRand: 0.3, p: { '*': B('....g...g.g.....', '....g...g.ggg...') } },
      drum: { inst: 'tom', vol: 0.27, lv: -28, pan: -0.1, rev: 0.4, p: { A: 'x.......x.......', B: 'x.......x.......' } },
      anvil: { inst: 'metal', vol: 0.23, lv: -31, pan: 0.5, rev: 0.6, p: { '*': B('x...............', R, R, '........x.......') } },
      drone: { inst: 'drone', mode: 'deg', root: 31, vol: 0.018, lv: -31, rev: 0.25, o: { cut: 280 }, p: { '*': HOLD2 } },
      strings: { inst: 'strings', mode: 'chord', center: 62, maxV: 3, vol: 0.018, lv: -30, rev: 0.5, o: { a: 1.5, r: 2.5, cut: 2000 }, p: { C: X } },
    },
  });

  // 白沙中继：辐射最重的城。盖革计数器一直在咔哒，手风琴走着调，白沙那一句一路往下滑；磁带抖得最厉害
  T('relay_baisha', {
    name: '白沙中继', pool: 'relay_baisha', desc: '白沙的家：盖革计数器、走调的手风琴、往下滑的那一句', bpm: 58, scale: 'minor', space: 'room', tape: 2.2, sat: 0.4, gain: 1.17, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Bm9 | Gmaj7 | Bm9 | Gmaj7 | Em9 | Em9 | F#7sus4 | F#' },
      { name: 'B', bars: 8, chords: 'Gmaj7 | A6 | F#m7 | Bm9 | Gmaj7 | A6 | Em9 | F#7sus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      geiger: { inst: 'geiger', vol: 1.6, lv: -41, pan: 0.35, rev: 0.15, p: { '*': HOLD4X } },
      acc: { inst: 'accordion', mode: 'chord', center: 59, maxV: 3, vol: 0.049, lv: -30, pan: -0.25, rev: 0.35, detuneRand: 18, p: { A: 'x-------x-------', B: X } },
      fall: { inst: 'accordion', mode: 'deg', root: 71, vol: 0.17, lv: -27, pan: 0.25, rev: 0.45, dly: 0.15, human: 0.025, detuneRand: 22,
        p: { A: B(R, R, '4-3-2-1-0-------', R), B: B('4-3-2-1-0-------', R, R, R, '7-6-5-4-3-------', '2-------1-------', R, R) } },
      piano: { inst: 'piano', mode: 'chord', center: 50, vol: 0.12, lv: -27, pan: -0.05, rev: 0.45, prob: 0.9, detuneRand: 8, p: { A: B('x...............', R), B: 'x.......2.......' } },
      drone: { inst: 'drone', mode: 'deg', root: 35, vol: 0.018, lv: -32, rev: 0.3, o: { cut: 260 }, p: { '*': HOLD2 } },
      radio: { inst: 'crackle', vol: 0.7, lv: -38, pan: -0.4, rev: 0.1, p: { '*': HOLD4X } },
    },
  });

  // 北渡中继：协议线上的城。很空、很远：北渡那一句是开得很大的几个数据音，高处的钟，长混响
  T('relay_beidu', {
    name: '北渡中继', pool: 'relay_beidu', desc: '北渡的家：数据音、高处的钟、很长的回声', bpm: 60, scale: 'lydian', space: 'tunnel', sat: 0.25, gain: 1.04, delay: 1.5, delayFb: 0.45,
    sections: [
      { name: 'A', bars: 8, chords: 'Emaj7 | Emaj7 | F#6 | F#6 | C#m9 | C#m9 | Amaj7 | Bsus4' },
      { name: 'B', bars: 8, chords: 'Amaj7 | B6 | G#m7 | C#m9 | Amaj7 | B6 | F#m9 | Bsus4' },
    ],
    form: ['A', 'B', 'A', 'B'], loop: 0,
    parts: {
      data: { inst: 'blip', mode: 'deg', root: 76, vol: 0.31, lv: -30, pan: -0.3, rev: 0.6, dly: 0.35,
        p: { A: B('0...4...7...b...', R, R, R), B: B(R, '0...4...7.......', R, 'b...7...4...0...') } },
      bell: { inst: 'bell', mode: 'chord', center: 84, vol: 0.088, lv: -33, pan: 0.5, rev: 0.85, prob: 0.7, p: { '*': B('........0.......', R, '....2...........', R) } },
      pad: { inst: 'pad', mode: 'chord', center: 64, vol: 0.015, lv: -31, rev: 0.5, fx: [['highpass', 300]], o: { cut: 1500, a: 3, r: 3 }, p: { '*': X } },
      choir: { inst: 'choir', mode: 'chord', center: 60, vol: 0.014, lv: -33, rev: 0.7, o: { vowel: 'u', a: 2, r: 3 }, p: { B: B(X, L) } },
      drone: { inst: 'drone', mode: 'deg', root: 40, vol: 0.015, lv: -32, rev: 0.35, o: { cut: 300 }, p: { '*': HOLD2 } },
      e17: { inst: 'chime', mode: 'deg', root: 64, vol: 0.094, lv: -30, pan: 0.35, rev: 0.9, dly: 0.3, p: { A: B(R, R, R, '2.......0.......') } },
      wind: { inst: 'wind', vol: 0.092, lv: -37, pan: -0.15, rev: 0.4, o: { f: 500, q: 0.7 }, p: { '*': HOLD4X } },
    },
  });

  // ════ 坐车 ════
  // 平稳：铁轨的卡嗒当鼓，车厢里的风当底，一把拨弦；C 段远远地倒着响一次 E-17
  T('ride_steady', {
    name: '车厢 · 平稳', pool: 'ride', desc: '坐车：铁轨当鼓、车厢的风、拨弦', bpm: 100, scale: 'dorian', space: 'room', tape: 0.4, sat: 0.45, gain: 1.16, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Am9 | Am9 | D9 | D9 | Am9 | Am9 | Fmaj7 | E7sus4' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am9 | Fmaj7 | G6 | Dm9 | E7sus4' },
      { name: 'C', bars: 8, chords: 'Cmaj7 | Cmaj7 | Bm7 | Bm7 | Fmaj7 | Fmaj7 | E7sus4 | E' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      rail: { inst: 'train', vol: 0.66, lv: -27, pan: -0.15, rev: 0.15, p: { '*': 'x.......x.......' } },
      rattle: { inst: 'shaker', vol: 1.3, lv: -37, pan: 0.3, velRand: 0.4, p: { '*': 'g.g.g.g.g.g.g.g.' } },
      air: { inst: 'wind', vol: 0.18, lv: -33, pan: 0.1, rev: 0.2, o: { f: 300, q: 0.7 }, p: { '*': HOLD4X } },
      sub: { inst: 'bass', mode: 'bass', low: 33, vol: 0.083, lv: -29, o: { type: 'sub' }, p: { '*': 'x.......x.......' } },
      pad: { inst: 'pad', mode: 'chord', center: 60, vol: 0.012, lv: -32, rev: 0.35, fx: [['highpass', 300]], o: { cut: 1400, a: 1.5, r: 2 }, p: { '*': X } },
      guitar: { inst: 'pluck', mode: 'chord', center: 55, vol: 0.3, lv: -27, pan: -0.35, rev: 0.3, dly: 0.12, human: 0.012, p: { A: '0.....2.....1...', B: '0...1...2...1...' } },
      e17: { inst: 'chime', mode: 'deg', root: 69, vol: 0.1, lv: -29, pan: 0.4, rev: 0.85, dly: 0.3, p: { C: B('4.......0.......', '2---------------', R, R, R, R, R, R) } },
    },
  });

  // 不安：同样的铁轨，换成弗里几亚。机器琶音、时钟咔哒得很密、锯齿贝斯，B 段心跳，C 段远处一根警报
  T('ride_uneasy', {
    name: '车厢 · 不安', pool: 'ride', desc: '坐车：机器琶音、密的时钟、远处的警报', bpm: 104, scale: 'phrygian', space: 'tunnel', sat: 0.55, gain: 0.84, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Em | F | Em | F | Em | Dm | Cmaj7 | Bm7' },
      { name: 'B', bars: 8, chords: 'Am | Bb | Am | G | F | F | Em | Em' },
      { name: 'C', bars: 4, chords: 'F | F | Em | Em' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      rail: { inst: 'train', vol: 0.72, lv: -26, pan: -0.15, rev: 0.15, p: { '*': 'x.......x.......' } },
      arp: { inst: 'arp', mode: 'chord', center: 64, vol: 0.074, lv: -30, pan: 0.4, rev: 0.3, dly: 0.15, prob: 0.9, o: { cut: 1500, q: 6, dec: 0.13 }, p: { A: '0.1.2.3.0.1.2.3.', B: '0.1.2.3.4.3.2.1.' } },
      tick: { inst: 'tick', vol: 0.86, lv: -35, pan: -0.4, rev: 0.2, p: { '*': 'x.x.x.x.x.x.x.x.' } },
      strings: { inst: 'strings', mode: 'chord', center: 59, maxV: 3, vol: 0.014, lv: -30, rev: 0.45, o: { a: 1, r: 1.5, cut: 2000 }, p: { '*': X } },
      metal: { inst: 'metal', vol: 0.22, lv: -31, pan: 0.5, rev: 0.6, p: { '*': B(R, '...........x....') } },
      bass: { inst: 'bass', mode: 'bass', low: 28, vol: 0.044, lv: -25, duck: true, o: { cut: 240, q: 6, env: 7, dec: 0.07 }, p: { A: 'x..x..x.x..x....', B: 'x..x..x.x..x....' } },
      heart: { inst: 'thump', vol: 0.19, lv: -29, rev: 0.12, p: { B: 'x.......x.......' } },
      siren: { inst: 'siren', mode: 'deg', root: 76, vol: 0.024, lv: -34, pan: -0.3, rev: 0.6, p: { C: B(Z, L, L, L) } },
    },
  });

  // 车上有人：铁轨轻一点；有人在车厢那头拧着一个八音盒（南栈那句），手风琴、收音机
  T('ride_someone', {
    name: '车厢 · 车上有人', pool: 'ride', desc: '坐车：车厢那头有人拧着八音盒', bpm: 92, scale: 'minor', space: 'room', tape: 1.2, sat: 0.35, gain: 1.24, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Cm9 | Abmaj7 | Cm9 | Abmaj7 | Fm9 | Fm9 | Gsus4 | G' },
      { name: 'B', bars: 8, chords: 'Abmaj7 | Bb6 | Gm7 | Cm9 | Abmaj7 | Bb6 | Fm9 | Gsus4' },
      { name: 'C', bars: 4, chords: 'Ebmaj7 | Ebmaj7 | Abmaj7 | Gsus4' },
    ],
    form: ['A', 'B', 'C', 'A', 'B'], loop: 0,
    parts: {
      rail: { inst: 'train', vol: 0.56, lv: -29, pan: -0.15, rev: 0.15, p: { '*': 'x.......x.......' } },
      box: { inst: 'musicbox', mode: 'deg', root: 84, vol: 0.12, lv: -27, pan: 0.45, rev: 0.5, dly: 0.2, human: 0.025, detuneRand: 20,
        p: { A: B('0-2-4-3-2---1---', R, '0-2-4-3-2-------', R), B: B('4---3---2-------', '........0---2---', '4---3---2---1---', R) } },
      acc: { inst: 'accordion', mode: 'chord', center: 60, maxV: 3, vol: 0.047, lv: -31, pan: -0.3, rev: 0.35, p: { B: X } },
      piano: { inst: 'piano', mode: 'chord', center: 55, vol: 0.12, lv: -28, pan: -0.15, rev: 0.4, human: 0.015, p: { A: B('x...............', 'x.......2.......') } },
      radio: { inst: 'crackle', vol: 0.85, lv: -37, pan: 0.35, rev: 0.1, p: { '*': HOLD4X } },
      choir: { inst: 'choir', mode: 'chord', center: 60, vol: 0.015, lv: -34, rev: 0.6, o: { vowel: 'u', a: 1.5, r: 2.5 }, p: { C: X } },
      sub: { inst: 'bass', mode: 'bass', low: 36, vol: 0.068, lv: -31, o: { type: 'sub' }, p: { '*': 'x.......x.......' } },
    },
  });

  // ── 换层短乐句（2–3 秒）：往下走三个音往下，往上走三个音往上
  T('st_floor_down', {
    name: '短乐句 · 往下一层', pool: 'sting', once: true, desc: '换层：往下', bpm: 90, scale: 'minor', space: 'tunnel', sat: 0.3, gain: 1.25,
    sections: [{ name: 'S', bars: 1, chords: 'Em' }], form: ['S'],
    parts: {
      chime: { inst: 'chime', mode: 'deg', root: 76, vol: 0.079, lv: -28, rev: 0.8, dly: 0.25, p: { S: '4...2...0-------' } },
      sub: { inst: 'bass', mode: 'bass', low: 28, vol: 0.054, lv: -29, o: { type: 'sub', a: 0.3, r: 1 }, p: { S: '........x-------' } },
    },
  });
  T('st_floor_up', {
    name: '短乐句 · 往上一层', pool: 'sting', once: true, desc: '换层：往上', bpm: 90, scale: 'major', space: 'hall', sat: 0.3, gain: 1.49,
    sections: [{ name: 'S', bars: 1, chords: 'Cmaj7' }], form: ['S'],
    parts: {
      chime: { inst: 'chime', mode: 'deg', root: 72, vol: 0.1, lv: -28, rev: 0.75, dly: 0.25, p: { S: '0...2...4-------' } },
      pad: { inst: 'pad', mode: 'chord', center: 64, vol: 0.019, lv: -32, rev: 0.5, o: { a: 0.3, r: 1.2, cut: 1800 }, p: { S: 'x-------........' } },
    },
  });
})(D);
