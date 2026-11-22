/* 配乐第二代 · P0 样片三首：据点、地铁站台探索（三层）、撤离战。
   动机：南栈（八音盒 6 个音 A C E D C B，第二遍少最后一个）、E-17（报站"叮—咚—叮"，平时倒着弹或缺一个音）、机器（上行四音琶音）。
   设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const T = D.Mus2.track;
  const B4 = bar => [bar, bar, bar, bar].join('|'), R4 = B4('................');

  // ── 据点：没人的铺子。一台旧收音机开着，毡钢琴、走调的八音盒、远处倒着的报站音。A 小调，A 一直踩在最底下
  T('hub_shop', {
    name: '没人的铺子', pool: 'hub', desc: '南栈据点：旧收音机、毡钢琴、八音盒', bpm: 62, scale: 'minor', space: 'room', tape: 1, sat: 0.35, gain: 0.95, delay: 0.75,
    sections: [
      { name: 'I', bars: 4, chords: 'Am9 | Fmaj7 | Am9 | Esus4' },
      { name: 'A', bars: 8, chords: 'Am9 | Fmaj7 | C/G | Dm9 | Am9 | Fmaj7 | Dm9 | Esus4,E' },
      { name: 'B', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am9 | Fmaj7 | G6 | Esus4 | E' },
      { name: 'R', bars: 4, chords: 'Amadd9 | Fmaj7 | Amadd9 | Fmaj7' },
      { name: 'A2', like: 'A' },
      { name: 'O', bars: 4, chords: 'Am9 | Fmaj7 | Dm9 | Esus4' },
    ],
    form: ['I', 'A', 'B', 'R', 'A2', 'B', 'O'], loop: 1,
    parts: {
      drone: { inst: 'drone', mode: 'deg', root: 45, vol: 0.021, rev: 0.25, o: { cut: 300 }, p: { '*': '0---------------|----------------' } },
      radio: { inst: 'crackle', vol: 0.61, pan: 0.25, rev: 0.1, p: { '*': 'x---------------|----------------|----------------|----------------' } },
      pad: { inst: 'pad', mode: 'chord', center: 62, vol: 0.014, rev: 0.3, fx: [['highpass', 320], ['lowpass', 2400]], o: { cut: 1500, a: 2, r: 3 },
        p: { A: 'x---------------', B: 'x---------------', O: 'x---------------' } },
      piano: { inst: 'piano', mode: 'chord', center: 60, vol: 0.23, pan: -0.22, rev: 0.35, dly: 0.08, human: 0.018,
        p: {
          I: '0...............|................|0.......2.......|1...............',
          A: ['x.......2...1...|x...........3...|x.......2.......|x.......1...0...', 'x...........2...|x.......3.......|x...2...........|x.......1.......'],
          B: 'x...............|x.......2.......|x...............|x.......3...2...',
          R: '................|0...............|................|0...............',
          A2: 'x...2...1...3...|x.......2.......|x...2...1.......|x.......2...1...',
          O: 'x...............|x...............|x...............|x---------------',
        } },
      box: { inst: 'musicbox', mode: 'deg', root: 81, vol: 0.19, pan: 0.3, rev: 0.45, dly: 0.22, human: 0.02, prob: 0.94, detuneRand: 14,
        p: {
          A: '................|........4---3---|................|................|................|........2---1---|................|................',
          B: ['0-2-4-3-2---1---|................|0-2-4-3-2-------|................|4---6---5-4-2---|3-------1-------|0-----1-----3---|1---------------',
            '0-2-4-3-2---1---|................|0-2-4-3-2-------|................|7---6---4---2---|3-------1-------|0---------------|................'],
          A2: '................|0-2-4-3-2-------|................|................|........4---3---|................|2-------1-------|................',
          O: '................|0-2-4-3-2-------|................|................',
        } },
      guitar: { inst: 'pluck', mode: 'chord', center: 52, vol: 0.32, pan: 0.42, rev: 0.3, dly: 0.1, human: 0.012,
        p: { B: '0...1...2...3...|0...1...2...1...', A2: '0.......1...2...|................' } },
      strings: { inst: 'strings', mode: 'chord', center: 57, maxV: 3, vol: 0.017, rev: 0.5, o: { a: 2.5, r: 3, cut: 1800 },
        p: { B: 'x---------------', A2: R4 + '|x---------------|x---------------|x---------------|x---------------' } },
      chime: { inst: 'chime', mode: 'deg', root: 69, vol: 0.092, pan: -0.35, rev: 0.75, dly: 0.3,
        p: { I: '................|................|................|........6.......', R: '6.......2.......|4---------------|................|6.......2.......' } },
    },
  });

  // ── 地铁站台探索：空站台。三层：探索（低长音、风、远处的钟和缺一个音的报站）→ 警觉（机器琶音、心跳、时钟）→ 交火（鼓组、锯齿贝斯、合唱）
  const EIGHT_FILL = R4 + '|................|................|................|........x.x.xxx.';
  T('plat_empty', {
    name: '空站台', pool: 'explore_platform', city: true, desc: '地铁站台探索：三层随战况', bpm: 96, scale: 'minor', space: 'tunnel', tape: 0.35, sat: 0.5, gain: 0.93, delay: 0.75,
    sections: [
      { name: 'A', bars: 8, chords: 'Em9 | Em9 | Cmaj7 | Cmaj7 | Am9 | Am9 | Cmaj7 | B7sus4' },
      { name: 'B', bars: 8, chords: 'Cmaj7 | D6 | Em9 | Em9 | Cmaj7 | D6 | Bm7 | Bm7' },
      { name: 'A2', like: 'A' },
      { name: 'C', bars: 8, chords: 'Fmaj7 | Fmaj7 | Em | Em | Fmaj7 | G6 | Em | Em' },
    ],
    form: ['A', 'B', 'A2', 'C', 'B'], loop: 0,
    parts: {
      // 探索层
      drone: { inst: 'drone', mode: 'deg', root: 40, vol: 0.019, rev: 0.3, o: { cut: 260 }, p: { '*': '0---------------|----------------' } },
      wind: { inst: 'wind', vol: 0.16, pan: -0.1, rev: 0.4, o: { f: 380, q: 0.8 }, p: { '*': 'x---------------|' + '----------------|'.repeat(6) + '----------------' } },
      strings: { inst: 'strings', mode: 'chord', center: 59, vol: 0.014, rev: 0.55, o: { a: 2, r: 2.5, cut: 2000 },
        p: { A: 'x---------------|----------------', C: 'x---------------|----------------', B: 'x---------------' } },
      bell: { inst: 'bell', mode: 'chord', center: 79, vol: 0.04, pan: 0.55, rev: 0.6, dly: 0.35, prob: 0.8,
        p: { A: '0.......2.......|........1.......', B: '2.......0.......|....1...........', C: '0...............|................' } },
      e17: { inst: 'chime', mode: 'deg', root: 64, vol: 0.079, pan: -0.55, rev: 0.85, dly: 0.2,
        p: { A: R4 + '|................|................|7.......5.......|................', A2: '................|................|7.......5.......|................|' + R4 } },
      piano: { inst: 'piano', mode: 'chord', center: 48, vol: 0.17, pan: 0.1, rev: 0.5, human: 0.02, prob: 0.85,
        p: { A: '0...............|........2.......|0...............|................', C: '0.......1.......|................' } },
      // 警觉层
      arp: { inst: 'arp', mode: 'chord', layer: 'alert', center: 64, vol: 0.066, pan: -0.4, rev: 0.3, dly: 0.18, o: { cut: 1400, q: 6, dec: 0.14 },
        p: { '*': '0.1.2.3.0.1.2.3.', B: '0.1.2.3.4.3.2.1.' } },
      heart: { inst: 'thump', layer: 'alert', vol: 0.26, rev: 0.1, p: { '*': 'x.......x.......' } },
      tick: { inst: 'tick', layer: 'alert', vol: 1.6, pan: 0.3, rev: 0.2, p: { '*': '..x.g.x...x.g.x.' } },
      sub: { inst: 'bass', mode: 'bass', layer: 'alert', low: 28, vol: 0.061, duck: true, o: { type: 'sub' }, p: { '*': 'x...x...x...x...' } },
      // 交火层
      kick: { inst: 'kick', layer: 'combat', vol: 0.43, side: 0.45, rev: 0.05,
        p: { A: 'x.....x...x.....', B: 'x.....x...x...x.', C: 'x.......x.......|x.....x...x.x...' } },
      snare: { inst: 'snare', layer: 'combat', vol: 1.2, rev: 0.3, p: { '*': '....x.......x...', C: '....x.......x...|....x.......x.xx' } },
      hat: { inst: 'hat', layer: 'combat', vol: 0.77, pan: 0.3, velRand: 0.3, p: { '*': 'XgxgXgxgXgxgXgxg' } },
      ohat: { inst: 'ohat', layer: 'combat', vol: 0.4, pan: -0.2, p: { '*': '......x.......x.' } },
      bass: { inst: 'bass', mode: 'bass', layer: 'combat', low: 28, vol: 0.054, duck: true, o: { cut: 220, q: 6, env: 7, dec: 0.07 },
        p: { A: 'x..x..x.x..x.ox.', B: 'x..x..x...x.x.o.', C: 'x..x..x.x..x.ox.' } },
      metal: { inst: 'metal', layer: 'combat', vol: 0.28, pan: 0.5, rev: 0.55, p: { '*': '................|...........x....' } },
      choir: { inst: 'choir', mode: 'chord', layer: 'combat', center: 62, vol: 0.029, rev: 0.6, o: { vowel: 'o' },
        p: { A: 'x---------------|----------------', C: 'x---------------|----------------', B: 'x---------------' } },
      tom: { inst: 'tom', layer: 'combat', vol: 0.24, pan: -0.2, rev: 0.3, p: { '*': EIGHT_FILL } },
    },
  });

  // ── 撤离战：末班车。C 小调，一上来就推着走。三层：开始（底鼓、铁轨、贝斯、机器琶音）→ 中段（拍手、主旋律唱出 E-17 的三个音）→ 最后十秒（合唱、双警报、沙锤、通鼓）
  T('ext_lastcall', {
    name: '末班车', pool: 'extract', desc: '撤离战：最后十秒自动加一层', bpm: 136, scale: 'harmonic', space: 'hall', sat: 0.6, gain: 0.77, delay: 0.75,
    sections: [
      { name: 'I', bars: 2, chords: 'Cm | Cm' },
      { name: 'A', bars: 8, chords: 'Cm | Cm | Abmaj7 | Abmaj7 | Fm7 | Fm7 | G7sus4 | G' },
      { name: 'B', bars: 8, chords: 'Abmaj7 | Bb | Cm | Cm | Abmaj7 | Bb | G7sus4 | G' },
      { name: 'C', bars: 8, chords: 'Fm | Fm | Abmaj7 | Abmaj7 | Db | Db | G | G' },
      { name: 'A2', like: 'A' },
    ],
    form: ['I', 'A', 'B', 'C', 'A2', 'B'], loop: 1,
    parts: {
      kick: { inst: 'kick', vol: 0.39, side: 0.5, rev: 0.04,
        p: { '*': 'x...x...x...x...', I: '................|x...x...x...x.x.',
          C: 'x.......x.......|x.......x.......|x.......x.......|x.......x.......|x...x...x...x...|x...x...x...x...|x.x.x.x.x.x.x.x.|x...x...x.......' } },
      train: { inst: 'train', vol: 0.44, pan: -0.25, rev: 0.15, p: { '*': 'x.......x.......' } },
      bass: { inst: 'bass', mode: 'bass', low: 36, vol: 0.065, duck: true, o: { cut: 300, q: 5, env: 6, dec: 0.05 },
        p: { '*': '..x.o.x...x.o.x.', I: '................|..x.o.x...x.o.x.', C: 'x---------------|................|x---------------|................|' + B4('..x.o.x...x.o.x.') } },
      hat: { inst: 'hat', vol: 0.58, pan: 0.15, velRand: 0.25, p: { '*': 'XgxgXgxgXgxgXgxg', C: B4('..x...x...x...x.') + '|' + B4('XgxgXgxgXgxgXgxg') } },
      ohat: { inst: 'ohat', vol: 0.32, pan: -0.15, p: { '*': '..x...x...x...x.', C: R4 + '|' + B4('..x...x...x...x.') } },
      pad: { inst: 'strings', mode: 'chord', center: 60, vol: 0.017, duck: true, rev: 0.4, o: { a: 0.3, r: 0.8 }, p: { '*': 'x---------------' } },
      arp: { inst: 'arp', mode: 'chord', center: 67, vol: 0.047, pan: 0.45, rev: 0.2, dly: 0.15, o: { cut: 2000, dec: 0.12 }, p: { '*': '0123012301230123', C: '0.1.2.3.4.3.2.1.' } },
      siren: { inst: 'siren', mode: 'deg', root: 72, scale: 'minor', vol: 0.034, pan: -0.3, rev: 0.6, p: { I: '0---------------|----------------', C: R4 + '|0---------------|----------------|----------------|----------------' } },
      riser: { inst: 'riser', mode: 'deg', root: 48, vol: 0.51, rev: 0.4, p: { I: '................|0---------------', C: '................|................|................|................|................|................|0---------------|----------------' } },
      // 中段
      clap: { inst: 'clap', layer: 'alert', vol: 1, rev: 0.3, p: { '*': '....x.......x...', C: B4('........x.......') + '|' + B4('....x.......x...') } },
      snare: { inst: 'snare', layer: 'alert', vol: 0.69, rev: 0.25, p: { '*': '....x.......x...', C: '................|' + '................|'.repeat(6) + 'x.x.x.x.xxxxxxxx' } },
      lead: { inst: 'lead', mode: 'deg', layer: 'alert', root: 72, vol: 0.073, rev: 0.35, dly: 0.18, o: { cut: 2600, glide: 0.05 },
        p: {
          A: '2---0---4-------|3-2-0-----------|2---0---4---5---|4-----3-2-------|3---0---5-------|4-3-2-0---------|1-------3-------|1---------------',
          B: '9---7---b-------|8-9-a---8-------|9---7---4---7---|9---------------|9---7---b---c---|b---a-9-8-------|8---a---8---7---|8---------------',
          A2: '2-0-4-----2-0-5-|4-3-2-0---------|2-0-4-----5-4-3-|4---------------|3-0-5-----4-3-0-|2---------------|1---3---4---3---|1---------------',
        } },
      metal: { inst: 'metal', layer: 'alert', vol: 0.2, pan: 0.45, rev: 0.5, p: { '*': '................|...........x....' } },
      // 最后十秒
      choir: { inst: 'choir', mode: 'chord', layer: 'combat', center: 64, vol: 0.036, rev: 0.5, p: { '*': 'x---------------' } },
      siren2: { inst: 'siren', mode: 'deg', layer: 'combat', root: 79, scale: 'minor', vol: 0.023, pan: 0.35, rev: 0.5, o: { rate: 0.9, depth: 220 }, p: { '*': '0---------------|----------------' } },
      shaker: { inst: 'shaker', layer: 'combat', vol: 0.24, pan: 0.4, p: { '*': 'xxxxxxxxxxxxxxxx' } },
      hi: { inst: 'strings', mode: 'chord', layer: 'combat', center: 74, maxV: 3, vol: 0.015, rev: 0.4, o: { a: 0.2, r: 0.6 }, p: { '*': 'x---------------' } },
      tom: { inst: 'tom', layer: 'combat', vol: 0.16, rev: 0.3, p: { '*': R4 + '|................|................|................|x.x.x.x.xxxxxxxx' } },
    },
  });
})(D);
