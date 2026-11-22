/* 配乐第二代 · P6：结算（第三节 F）和短乐句（第三节 G）。
   结算 4 首（30–60 秒一轮，放完接池里另一首）：撤出来了 pool result_win（回到站台 / 清点）、壳子毁了 pool result_dead（信号断了 / 重新上线）。
   短乐句（once: true，只放一遍，D.Music.sting(名字)，主曲压低让一让）：
   - 重做旧的四段：被发现 st_spotted、撤出来了 st_clear（上车成功）、信号断了 st_death、报站 st_e17（剧本 @sting e17）。
   - 新的：撤离开始 st_extract_go、撤离最后十秒 st_extract_10、读到线索 st_clue、搜到传说 st_loot_gold、搜到至宝 st_loot_red、
     工坊造好 st_craft、进站 st_arrive、进未知信号站 st_signal、解锁新城市 st_city、剧情转折 st_twist_dark（真相压下来）/ st_twist_reveal（看清了）。
   - 首领出场 ×4 在 tracks-p4.js，换层 ×2 在 tracks-p2.js。
   动机照旧：南栈 = 0-2-4-3-2-1（平时少最后一个音）；E-17 = 2 0 4（平时倒着 4 0 2 或缺一个）。
   vol 按 M2.pt(乐器, 目标响度) 算；gain 是总混音对齐时写的。设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2, T = M2.track, pt = M2.pt;
  const R = '................', L = '----------------', X = 'x---------------', Z = '0---------------';
  const B = (...b) => b.join('|'), HOLD2 = B(Z, L), HOLD2X = B(X, L), HOLD4X = B(X, L, L, L);

  const drone = (root, lv, o) => pt('drone', lv ?? -32, { mode: 'deg', root, rev: 0.3, o: Object.assign({ cut: 270 }, o), p: { '*': HOLD2 } });
  const radio = lv => pt('crackle', lv ?? -39, { pan: 0.35, rev: 0.1, p: { '*': HOLD4X } });
  const strings = (center, p, lv, o) => pt('strings', lv ?? -31, { mode: 'chord', center, maxV: 3, rev: 0.5, o: Object.assign({ a: 2, r: 3, cut: 2000 }, o), p });
  const pad = (center, p, lv, o) => pt('pad', lv ?? -33, { mode: 'chord', center, rev: 0.45, fx: [['highpass', 260]], o: Object.assign({ cut: 1400, a: 2, r: 3 }, o), p });
  const choir = (center, vowel, p, lv) => pt('choir', lv ?? -33, { mode: 'chord', center, rev: 0.6, o: { vowel: vowel || 'u', a: 1.6, r: 3 }, p });
  const piano = (center, p, lv, o) => pt('piano', lv ?? -26, Object.assign({ mode: 'chord', center, pan: -0.2, rev: 0.45, dly: 0.1, human: 0.016, p }, o));
  const box = (root, p, lv, o) => pt('musicbox', lv ?? -26, Object.assign({ mode: 'deg', root, pan: 0.3, rev: 0.5, dly: 0.2, human: 0.02, detuneRand: 12, p }, o));
  const chime = (root, p, lv, o) => pt('chime', lv ?? -29, Object.assign({ mode: 'deg', root, pan: -0.4, rev: 0.85, dly: 0.3, p }, o));
  const bell = (center, p, lv, o) => pt('bell', lv ?? -33, Object.assign({ mode: 'chord', center, pan: 0.5, rev: 0.8, p }, o));
  const tick = (p, lv, o) => pt('tick', lv ?? -37, Object.assign({ pan: 0.45, rev: 0.25, p: { '*': p || 'x...g...x...g...' } }, o));
  const pluck = (center, p, lv, o) => pt('pluck', lv ?? -27, Object.assign({ mode: 'chord', center, pan: -0.3, rev: 0.3, dly: 0.08, human: 0.012, p }, o));
  const upright = (low, p, lv) => pt('pluck', lv ?? -28, { mode: 'bass', low, pan: 0.05, rev: 0.12, p });
  const sub = (low, p, lv, o) => pt('bass', lv ?? -31, { mode: 'bass', low, o: Object.assign({ type: 'sub', a: 0.8, r: 1.5 }, o), p });
  const ep = (center, p, lv, o) => pt('epiano', lv ?? -27, Object.assign({ mode: 'chord', center, pan: 0.25, rev: 0.45, dly: 0.12, human: 0.015, p }, o));
  const accmel = (root, p, lv) => pt('accordion', lv ?? -28, { mode: 'deg', root, pan: 0.35, rev: 0.4, dly: 0.12, human: 0.02, p });
  const blip = (root, p, lv, o) => pt('blip', lv ?? -34, Object.assign({ mode: 'deg', root, pan: -0.5, rev: 0.6, dly: 0.35, prob: 0.7, p }, o));

  // ════ 结算 · 撤出来了 ════
  // 回到站台：C 大调、慢的钢琴分解、弦乐铺底；八音盒弹南栈那句（还是少最后一个音——家还没回到）
  T('res_win_home', {
    name: '回到站台', pool: 'result_win', desc: '撤离成功：钢琴分解、弦乐，八音盒弹南栈那句', bpm: 72, scale: 'major', space: 'hall', tape: 0.8, sat: 0.3, gain: 0.87, delay: 0.4,
    sections: [
      { name: 'A', bars: 8, chords: 'Cmaj7 | Am9 | Fmaj7 | G6 | Cmaj7 | Em7 | Fmaj7 | Gsus4,G' },
      { name: 'B', bars: 8, chords: 'Am9 | Fmaj7 | Cmaj7 | G6 | Am9 | Fmaj7 | Dm9 | Gsus4' },
    ],
    form: ['A', 'B'],
    parts: {
      strings: strings(60, { '*': HOLD2X }, -32),
      piano: piano(57, { '*': 'x...2...1...3...', B: B('x...2...1...3...', 'x.......2...1...') }, -27),
      box: box(72, {
        A: B('0...2...4...3...', '2...1-----------', R, R, R, R, R, R),
        B: B(R, R, '4...3...2...1...', '2---------------', R, R, '0...2...4...3...', '2...1-----------'),
      }, -27),
      bass: upright(36, { '*': 'x.......x...5...' }, -29),
      clock: tick('x.......g.......', -39),
      chime: chime(84, { B: B(R, '........4-------', R, R, R, '........2-------', R, R) }, -32),
    },
  });
  // 清点：F 利底亚、拨弦和电钢，记账的打字机一下一下，B 段手风琴接一句
  T('res_win_count', {
    name: '清点', pool: 'result_win', desc: '撤离成功：拨弦、电钢、记账的打字机，手风琴接一句', bpm: 84, scale: 'lydian', space: 'room', tape: 0.6, sat: 0.3, gain: 0.64, delay: 0.375,
    sections: [
      { name: 'A', bars: 8, chords: 'Fmaj7 | G6 | Em7 | Am9 | Fmaj7 | G6 | Dm9 | Gsus4' },
      { name: 'B', bars: 8, chords: 'Dm9 | G6 | Cmaj7 | Am9 | Dm9 | G6 | Fmaj7#11 | Fmaj7' },
    ],
    form: ['A', 'B'],
    parts: {
      guitar: pluck(60, { '*': 'x..1..2.x..1.2..' }, -28),
      ep: ep(64, { '*': B('x-------........', '....x-------....') }, -30),
      bass: upright(41, { '*': 'x.....x.5.......' }, -29),
      type: pt('typewriter', -38, { pan: 0.5, rev: 0.25, prob: 0.6, p: { '*': B('......g.....g...', '..g.......g...x.') } }),
      shaker: pt('shaker', -40, { pan: -0.4, rev: 0.2, p: { '*': 'g.g.x.g.g.g.x.g.' } }),
      acc: accmel(65, { B: B('4...3...2-------', '1...2...4-------', '5...4...3...2...', '1---------------', '4...3...2-------', '1...2...4-------', '3...2...1...0...', R) }, -29),
      pad: pad(60, { '*': HOLD2X }, -36),
    },
  });

  // ════ 结算 · 壳子毁了 ════
  // 信号断了：A 小调、低处的钢琴、弦乐，八音盒那句弹到一半就停，远处倒着的报站音缺一个
  T('res_dead_signal', {
    name: '信号断了', pool: 'result_dead', desc: '壳子损毁：低处的钢琴和弦乐，八音盒那句弹到一半就停', bpm: 56, scale: 'minor', space: 'hall', tape: 1.6, sat: 0.35, gain: 0.97, delay: 0.5,
    sections: [
      { name: 'A', bars: 6, chords: 'Am9 | Fmaj7 | Cmaj7 | E7sus4 | Am9 | Fmaj7' },
      { name: 'B', bars: 6, chords: 'Dm9 | Am9 | Fmaj7 | Cmaj7 | Dm9 | E7sus4,E' },
    ],
    form: ['A', 'B'],
    parts: {
      drone: drone(33, -33),
      radio: radio(),
      piano: piano(48, { '*': 'x.......2.......', B: B('x.......2.......', 'x...........1...', 'x.......2.......', 'x...............', 'x.......2...1...', 'x---------------') }, -27),
      strings: strings(57, { '*': HOLD2X }, -33),
      box: box(81, { A: B('0...2...4...3...', '2...............', R, R, R, R), B: B(R, R, '0...2...4.......', R, R, R) }, -28, { detuneRand: 22 }),
      chime: chime(76, { A: B(R, R, R, '........4...0...', R, R) }, -33),
      cello: pt('strings', -31, { mode: 'deg', root: 45, rev: 0.45, o: { a: 1.2, r: 2.5, cut: 900 }, p: { B: B('3-------2-------', '0---------------', '5-------4-------', '2---------------', '3-------4-------', '4---------------') } }),
    },
  });
  // 重新上线：D 多利亚、冷的电钢和合唱，数据音一点点亮起来——新壳子在开机
  T('res_dead_reboot', {
    name: '重新上线', pool: 'result_dead', desc: '壳子损毁：冷电钢、合唱，数据音一点点亮起来（新壳子开机）', bpm: 60, scale: 'dorian', space: 'hall', tape: 1.2, sat: 0.3, gain: 0.84, delay: 0.5,
    sections: [
      { name: 'A', bars: 6, chords: 'Dm9 | Bbmaj7 | Fmaj7 | C6 | Dm9 | Am7' },
      { name: 'B', bars: 6, chords: 'Gm9 | Dm9 | Bbmaj7 | Fmaj7 | Gm9 | A7sus4' },
    ],
    form: ['A', 'B'],
    parts: {
      drone: drone(38, -34),
      ep: ep(57, { '*': B('x.......1...2...', 'x...............') }, -28, { detuneRand: 14 }),
      choir: choir(62, 'u', { '*': HOLD2X }, -34),
      blip: blip(74, { A: B(R, R, '..........0.....', R, '......0.....2...', R), B: B('..0.....2.......', '......4.........', '..0...2.....4...', R, '0...2...4.......', R) }, -34),
      bell: bell(74, { B: B('x---------------', R, R, R, 'x---------------', R) }, -35),
      sub: sub(26, { '*': HOLD2X }, -32),
      heart: pt('thump', -33, { rev: 0.15, p: { '*': B('x.......x.......', 'x...............') } }),
    },
  });

  // ════ 短乐句 ════
  const ST = (key, name, desc, o, parts) => T(key, Object.assign({ name, pool: 'sting', once: true, desc, sat: 0.4, gain: 1, form: ['S'] }, o, { sections: [{ name: 'S', bars: o.bars || 1, chords: o.chords }], parts }));
  const S1 = p => ({ S: p });

  // 重做旧的四段
  ST('st_spotted', '短乐句 · 被发现', '敌人发现你：一记低闷的撞击，机器动机往上爬四个音', { bpm: 112, scale: 'phrygian', space: 'tunnel', chords: 'Em' }, {
    kick: pt('kick', -19, { rev: 0.2, p: S1('X...............') }), metal: pt('metal', -25, { pan: 0.4, rev: 0.7, p: S1('x...............') }),
    sub: sub(28, S1('x-------........'), -25, { a: 0.01, r: 0.8 }),
    arp: pt('arp', -29, { mode: 'deg', root: 64, pan: -0.3, rev: 0.4, dly: 0.25, o: { cut: 1800, q: 6, dec: 0.14 }, p: S1('..0.1.3.4.......') }),
    hit: pt('strings', -30, { mode: 'chord', center: 52, rev: 0.5, o: { a: 0.02, r: 0.9 }, p: S1('x-----..........') }),
  });
  ST('st_clear', '短乐句 · 撤出来了', '上车成功：一个暖的大和弦，钟琴弹南栈那句的头三个音', { bpm: 100, scale: 'major', space: 'hall', chords: 'Cadd9', bars: 2 }, {
    piano: piano(55, S1(B('x...............', R)), -24),
    strings: strings(60, S1(B('x---------------', '--------........')), -29, { a: 0.4, r: 2 }),
    chime: chime(72, S1(B('0...2...4-------', R)), -27),
    bell: bell(72, S1(B('........x-------', R)), -32),
  });
  ST('st_death', '短乐句 · 信号断了', '壳子损毁：低处一个钢琴和弦，八音盒那一句弹到一半就停了', { bpm: 60, scale: 'minor', space: 'room', tape: 1.8, chords: 'Am,Fmaj7/A' }, {
    piano: piano(45, S1('x.......x-------'), -24, { dly: 0 }),
    box: box(81, S1('..0-2-4-3-2.....'), -26, { detuneRand: 28 }),
    drone: pt('drone', -31, { mode: 'deg', root: 33, rev: 0.3, o: { cut: 220 }, p: S1('0---------------') }),
    radio: pt('crackle', -40, { pan: 0.3, p: S1('..........x-----') }),
  });
  ST('st_e17', '短乐句 · 报站', 'E-17 的报站音：叮—咚—叮倒着响（4 0 2）', { bpm: 100, scale: 'major', space: 'tunnel', sat: 0.2, chords: 'E', bars: 2 }, {
    chime: chime(64, S1(B('4.......0.......', '2---------------')), -26, { pan: 0 }),
    pad: pad(64, S1(B('x---------------', '--------........')), -36),
  });

  // 撤离
  ST('st_extract_go', '短乐句 · 撤离开始', '撤离战开始：关门提示音、一下重击和低音铜管', { gain: 0.83, bpm: 100, scale: 'minor', space: 'hall', sat: 0.6, chords: 'Dm', bars: 1 }, {
    alarm: pt('siren', -31, { mode: 'deg', root: 74, rev: 0.5, o: { rate: 1.6, depth: 300, a: 0.05 }, p: S1('0-------........') }),
    kick: pt('kick', -18, { rev: 0.2, p: S1('X.......X.......') }), clank: pt('clank', -25, { pan: -0.3, rev: 0.6, p: S1('X...............') }),
    brass: pt('brass', -24, { mode: 'deg', root: 38, rev: 0.5, p: S1('0-------4-------') }),
    sub: sub(26, S1('x---------------'), -25, { a: 0.01 }),
  });
  ST('st_extract_10', '短乐句 · 最后十秒', '撤离最后十秒：钟声越走越密，一道往上冲的音', { gain: 1.15, bpm: 120, scale: 'minor', space: 'hall', sat: 0.5, chords: 'Dm', bars: 1 }, {
    clock: pt('tick', -28, { pan: 0.3, rev: 0.25, p: S1('x...x...x.x.xxxx') }),
    riser: pt('riser', -27, { mode: 'deg', root: 50, rev: 0.4, p: S1('0---------------') }),
    bell: bell(74, S1('x...............'), -29),
    snare: pt('snare', -30, { rev: 0.3, p: S1('............gxXX') }),
  });

  // 剧情、搜刮、成长
  ST('st_clue', '短乐句 · 读到线索', '读到一条线索：钟琴弹南栈那句的头，铃一下，长音铺开', { gain: 1.1, bpm: 72, scale: 'minor', space: 'hall', sat: 0.25, chords: 'Em9', bars: 1 }, {
    box: box(76, S1('0...2...4-------'), -26),
    bell: bell(64, S1('x---------------'), -31),
    pad: pad(64, S1('x---------------'), -34, { a: 0.3, r: 2 }),
    chime: chime(88, S1('........4-------'), -33),
  });
  ST('st_loot_gold', '短乐句 · 搜到传说', '搜出一件传说（金色）：一串往上的铃和钟琴', { gain: 1.15, bpm: 96, scale: 'lydian', space: 'hall', sat: 0.25, chords: 'Dmaj7#11', bars: 1 }, {
    bell: pt('bell', -29, { mode: 'deg', root: 74, pan: 0.3, rev: 0.7, dly: 0.25, p: S1('0.2.4.6.7-------') }),
    chime: chime(86, S1('........4-------'), -29),
    pad: pad(62, S1('....x-----------'), -34, { a: 0.2, r: 1.5 }),
  });
  ST('st_loot_red', '短乐句 · 搜到至宝', '搜出一件至宝（红色）：低音一沉，合唱和钟一起升上来', { gain: 0.85, bpm: 104, scale: 'lydian', space: 'hall', sat: 0.4, chords: 'Ebmaj7#11', bars: 2 }, {
    sub: sub(27, S1(B('x---------------', '--------........')), -24, { a: 0.02 }),
    kick: pt('kick', -21, { rev: 0.3, p: S1(B('X...............', R)) }),
    choir: choir(63, 'a', S1(B('....x-----------', '--------........')), -28),
    bell: pt('bell', -28, { mode: 'deg', root: 75, pan: 0.3, rev: 0.75, dly: 0.3, p: S1(B('....0.2.4.6.7...', 'b---------......')) }),
    chime: chime(87, S1(B(R, '0-------........')), -30),
  });
  ST('st_craft', '短乐句 · 工坊造好', '工坊里做好一件：铁砧一敲、打字机落一下、拨弦一个亮和弦', { bpm: 96, scale: 'major', space: 'room', sat: 0.4, chords: 'Gadd9', bars: 1 }, {
    clank: pt('clank', -24, { pan: -0.3, rev: 0.4, p: S1('X...x...........') }),
    type: pt('typewriter', -29, { pan: 0.4, rev: 0.3, p: S1('........x.......') }),
    guitar: pluck(60, S1('........x.1.2...'), -25),
    bell: bell(79, S1('........x-------'), -31),
  });

  // 地方
  ST('st_arrive', '短乐句 · 进站', '车进站：刹车的铁轨声，低处一个长音，报站音缺一个（4 0）', { gain: 1.16, bpm: 70, scale: 'minor', space: 'tunnel', sat: 0.3, chords: 'Em', bars: 1 }, {
    train: pt('train', -29, { pan: -0.2, rev: 0.4, p: S1('x.g.x.g.g...g...') }),
    drone: pt('drone', -30, { mode: 'deg', root: 40, rev: 0.4, o: { cut: 320, a: 0.4, r: 1.5 }, p: S1('0---------------') }),
    chime: chime(76, S1('........4...0---'), -29, { pan: 0 }),
  });
  ST('st_signal', '短乐句 · 未知信号', '进了未知信号站：一串数据音、盖革计数器响一阵，倒着的报站音', { gain: 1.15, bpm: 104, scale: 'phrygian', space: 'hall', sat: 0.3, chords: 'Em', bars: 2 }, {
    blip: pt('blip', -29, { mode: 'deg', root: 76, pan: 0.4, rev: 0.6, dly: 0.35, p: S1(B('0.4.7...0.4.....', R)) }),
    geiger: pt('geiger', -36, { pan: -0.4, rev: 0.2, p: S1(B('x---------------', '----............')) }),
    chime: chime(64, S1(B('........4...0...', '2---------------')), -30),
    choir: choir(64, 'o', S1(B('x---------------', '--------........')), -33),
  });
  ST('st_city', '短乐句 · 新城市', '查到 E-17 去了哪、新的城开了：低音铜管和弦乐升上去，钟琴一声', { bpm: 100, scale: 'major', space: 'hall', sat: 0.35, chords: 'Dsus4,D | Gmaj7,A', bars: 2 }, {
    brass: pt('brass', -26, { mode: 'deg', root: 50, rev: 0.55, dly: 0.08, p: S1(B('0-------4-------', '3-------4-------')) }),
    strings: strings(62, S1(B('x-------x-------', 'x-------x-------')), -29, { a: 0.3, r: 2 }),
    timp: pt('tom', -25, { rev: 0.5, p: S1(B('X...........x.x.', 'X...............')) }),
    chime: chime(86, S1(B(R, '........0-------')), -29),
  });
  ST('st_twist_dark', '短乐句 · 剧情转折（真相）', '剧情转折，真相压下来：一个低的钢琴簇、弦乐往下滑、合唱', { bpm: 54, scale: 'harmonic', space: 'hall', sat: 0.35, tape: 1.4, chords: 'Am,E7b9/G#', bars: 1 }, {
    piano: piano(40, S1('x...............'), -23, { dly: 0 }),
    cello: pt('strings', -28, { mode: 'deg', root: 45, rev: 0.5, o: { a: 0.3, r: 2, cut: 1000 }, p: S1('4-------3---2---') }),
    choir: choir(57, 'u', S1('x---------------'), -31),
    sub: sub(21, S1('x---------------'), -27, { a: 0.05 }),
  });
  ST('st_twist_reveal', '短乐句 · 剧情转折（看清了）', '剧情转折，看清了：弦乐升上来，铃和钟琴弹出南栈那句的头', { gain: 1.1, bpm: 100, scale: 'major', space: 'hall', sat: 0.3, chords: 'Fmaj7 | Am9', bars: 2 }, {
    strings: strings(60, S1(B('x---------------', 'x---------------')), -29, { a: 1, r: 2.5 }),
    box: box(72, S1(B('........0...2...', '4---------------')), -26),
    bell: bell(72, S1(B(R, 'x---------------')), -32),
    choir: choir(64, 'a', S1(B('....x-----------', '--------........')), -33),
  });
})(D);
