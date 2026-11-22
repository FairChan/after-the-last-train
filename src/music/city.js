/* 配乐第二代 · 城市色：同一首探索曲（曲子写了 city: true），在四座城里多叠一层不同的配器。
   岚川（机器官僚城）：打字机、时钟滴答，整齐、冷
   铁原（军工枢纽）：低音铜管吹铁原那一句（0 0 4 3 1），打铁，警觉以后加行军军鼓
   白沙（辐射最重）：盖革计数器、走调的手风琴往下滑（4 3 2 1 0）；磁带抖动加重（player.js）
   北渡（协议线）：开得很大的数据音（0 4 7 b）、高处的长音；回声更长（player.js）
   音高跟着曲子的主音走（第一段第一个和弦的根音）；句子用 8 小节的谱子，4 小节的段落只放前一半。设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2, pt = M2.pt;
  const R = '................', Z = '0---------------', L = '----------------', B = (...b) => b.join('|');
  const near = (pc, lo) => lo + (((pc - lo) % 12) + 12) % 12; // lo 起往上第一个这个音级的 midi
  const tonic = T => { const s = T.sections[0], c = (s.chords || T.sections.find(x => x.name === s.like).chords).split('|')[0].split(',')[0].trim(); return M2.chord(c).root; };
  const COLOR = {
    lanchuan: () => ({
      c_type: pt('typewriter', -35, { pan: 0.5, rev: 0.25, prob: 0.6, p: { '*': B('..x.....x.x.....', R, '....x.x.....x...', R) } }),
      c_clock: pt('tick', -39, { pan: -0.5, rev: 0.2, p: { '*': 'x...x...x...x...' } }),
    }),
    tieyuan: (r, T) => ({
      c_horn: pt('brass', -29, { mode: 'deg', root: near(r, 48), scale: T.scale, pan: -0.2, rev: 0.45, dly: 0.1, p: { '*': B(R, R, R, R, R, R, '0---0-4-3---1---', Z) } }),
      c_anvil: pt('metal', -34, { pan: 0.55, rev: 0.6, p: { '*': B('x...............', R, R, R) } }),
      c_march: pt('snare', -33, { layer: 'alert', pan: 0.25, rev: 0.3, velRand: 0.3, p: { '*': B('....g...g.g.....', '....g...g.ggg...') } }),
    }),
    baisha: (r, T) => ({
      c_geiger: pt('geiger', -41, { pan: 0.4, rev: 0.15, p: { '*': B('x---------------', L, L, L) } }),
      c_fall: pt('accordion', -30, { mode: 'deg', root: near(r, 64), scale: T.scale, pan: -0.3, rev: 0.45, dly: 0.15, human: 0.025, detuneRand: 25, p: { '*': B(R, R, R, R, R, R, '4-3-2-1-0-------', R) } }),
    }),
    beidu: (r, T) => ({
      c_data: pt('blip', -33, { mode: 'deg', root: near(r, 76), scale: T.scale, pan: 0.35, rev: 0.6, dly: 0.35, p: { '*': B(R, R, R, '0...4...7...b...') } }),
      c_high: pt('pad', -36, { mode: 'chord', center: 79, maxV: 2, rev: 0.6, o: { cut: 2400, a: 3, r: 3, wave: 'triangle' }, p: { '*': B('x---------------', L, L, L) } }),
    }),
  };
  M2.CITIES = Object.keys(COLOR);
  M2.cityParts = function (T, city) { const f = COLOR[city]; return f ? f(tonic(T), T) : {}; };
})(D);
