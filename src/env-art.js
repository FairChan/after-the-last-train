/* Underdog：十二种新环境的画（用户 2026-11-15："增多至少 10 种环境，现在的环境太重复了，很没意思，甚至可以做地上的"）
   这里只管画：新摆设（路灯、树、汽车、集装箱、摊位、鱼缸、钟乳石……）、地面花纹、墙面。生成和数据在 envs.js。
   挂钩：D.makeProp（level.js 的 decorate 也能摆新摆设）、D.paintFloorTile、D.paintWallX。
   摆设图都是 2 倍精度（每格 32 像素）；多格宽的摆设 D.ENV_PROP(种类, 格x, 格y, 主题, rng, 宽, 高) 直接放，脚底在占地最下面一行。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, T2 = TS * Z;
  const R = D.RAMP;

  // ── 3×5 的小字（车库柱子上的编号）
  const GLYPH = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111' };
  const glyphs = (p, s, x, y, col, k) => { k = k || 2; [...s].forEach((ch, n) => { const g = GLYPH[ch]; if (!g) return; for (let i = 0; i < 15; i++) if (g[i] === '1') p.rect(x + n * 4 * k + (i % 3) * k, y + Math.floor(i / 3) * k, k, k, col); }); };

  // ── 摆设：返回 { w, h, fn, light(x, 脚底y) }
  const SP = {
    streetlamp: () => ({ w: 28, h: 104, fn: p => {
      p.box(9, 96, 10, 8, R.dark, { r: 1 }); p.rect(13, 16, 3, 80, '#2c3140'); p.rect(13, 16, 1, 80, '#4c556c');
      p.rect(4, 13, 11, 3, '#2c3140'); p.rect(4, 13, 11, 1, '#4c556c');
      p.box(0, 8, 12, 6, R.gunmetal, { r: 1 }); p.rect(1, 14, 10, 2, '#ffd27a', 1); p.rect(3, 16, 6, 1, '#fff0c8', 1);
    }, light: (x, y) => ({ x: x - 5, y: y - 6, r: 115, col: '#ffbe6a', a: 0.8, flick: 0.02 }) }),
    floodlamp: () => ({ w: 32, h: 118, fn: p => {
      p.box(11, 110, 10, 8, R.dark, { r: 1 }); p.rect(14, 14, 4, 96, '#3a3f4c'); p.rect(14, 14, 1, 96, '#646e86'); p.rect(4, 11, 24, 3, '#2d3342');
      for (const hx of [3, 17]) { p.box(hx, 2, 12, 9, R.gunmetal, { r: 1 }); p.rect(hx + 1, 10, 10, 2, '#fff0d0', 1); }
    }, light: (x, y) => ({ x, y: y - 6, r: 135, col: '#fff0d0', a: 0.75, flick: 0.02 }) }),
    parklamp: () => ({ w: 24, h: 80, fn: p => {
      p.box(8, 72, 8, 8, R.dark, { r: 1 }); p.rect(11, 22, 2, 52, '#1d212c'); p.rect(11, 22, 1, 52, '#434b5f'); p.rect(9, 40, 6, 2, '#2d3342');
      p.box(6, 6, 12, 16, R.dark, { r: 2 }); p.rect(8, 9, 8, 10, '#ffd27a', 1); p.rect(9, 10, 3, 4, '#fff3c8', 1); p.rect(5, 4, 14, 3, '#2d3342'); p.px(12, 2, '#434b5f');
    }, light: (x, y) => ({ x, y: y - 6, r: 95, col: '#ffe2a8', a: 0.75, flick: 0.03 }) }),
    tree: rng => { const g = rng.pick([['#14301c', '#1e4a28', '#2c6434', '#4a8a44'], ['#1a2e1a', '#284428', '#3a5e30', '#5f8a40'], ['#203018', '#344a22', '#4e6a2a', '#7a9a3a']]); return { w: 64, h: 92, fn: p => {
      p.rect(29, 56, 6, 34, '#3a281c'); p.rect(29, 56, 2, 34, '#5a4030'); p.rect(26, 86, 12, 6, '#2a1c14');
      for (const [cx, cy, r, c] of [[32, 34, 22, 0], [19, 44, 13, 0], [45, 44, 13, 0], [32, 28, 18, 1], [24, 36, 12, 1], [41, 34, 12, 1], [30, 22, 11, 2], [39, 28, 8, 2], [26, 18, 6, 3], [35, 14, 4, 3]]) p.disc(cx, cy, r, g[c]);
      for (let i = 0; i < 16; i++) p.px(rng.int(14, 50), rng.int(10, 54), g[rng.int(1, 3)]);
    } }; },
    palm: rng => ({ w: 72, h: 108, fn: p => {
      for (let i = 0; i < 70; i++) { const y = 106 - i, x = 34 + Math.round(Math.sin(i / 30) * 5); p.rect(x, y, 6, 1, i % 6 < 2 ? '#5a4030' : '#7a5a3a'); }
      const tx = 38, ty = 34;
      for (let k = 0; k < 8; k++) { const a = -Math.PI + k * Math.PI / 7 + rng.range(-0.15, 0.15), len = rng.int(22, 32);
        for (let s = 0; s < len; s++) { const x = tx + Math.round(Math.cos(a) * s), y = ty + Math.round(Math.sin(a) * s * 0.7 + (s * s) / 60); p.rect(x, y, 2, 2, s < len / 2 ? '#2e6a34' : '#4a9a48'); if (s % 3 === 0 && s > 4) p.px(x, y + 2, '#1c4a20'); } }
      p.disc(tx, ty, 4, '#3a5a2a'); p.px(tx - 2, ty + 3, '#8c5d3c'); p.px(tx + 2, ty + 4, '#8c5d3c');
    } }),
    bush: rng => { const fl = rng.chance(0.4) ? rng.pick(['#ff98a0', '#fff3b0', '#d080d4']) : null; return { w: 32, h: 26, fn: p => {
      for (const [cx, cy, r, c] of [[10, 16, 8, '#1c4a20'], [22, 15, 9, '#1c4a20'], [16, 11, 8, '#2e7032'], [21, 10, 5, '#4a9a48'], [9, 13, 4, '#2e7032']]) p.disc(cx, cy, r, c);
      if (fl) for (let i = 0; i < 6; i++) p.rect(rng.int(4, 26), rng.int(6, 20), 2, 2, fl);
    } }; },
    hydrant: () => ({ w: 20, h: 26, fn: p => { p.box(5, 8, 10, 15, R.red, { r: 2 }); p.rect(2, 12, 16, 4, '#8f1d26'); p.box(6, 3, 8, 6, R.red, { r: 2 }); p.rect(4, 23, 12, 3, '#2a0a0e'); p.px(9, 2, '#ff98a0'); } }),
    cone: () => ({ w: 18, h: 22, fn: p => { for (let y = 0; y < 16; y++) { const w = 2 + Math.round(y * 0.6); p.rect(9 - w / 2, 2 + y, w, 1, y > 6 && y < 10 ? '#f8f9ff' : y < 4 ? '#ffb070' : '#ff7a2e'); } p.rect(1, 18, 16, 3, '#c85a1e'); } }),
    bollard: () => ({ w: 22, h: 22, fn: p => { p.box(5, 7, 12, 13, R.gunmetal, { r: 2 }); p.box(2, 3, 18, 6, R.gunmetal, { r: 2, bias: 0.15 }); p.rect(5, 4, 12, 1, '#e3b42e'); p.rect(4, 19, 14, 3, '#101218'); } }),
    dumpster: () => ({ w: 64, h: 40, fn: p => { p.box(2, 10, 60, 26, R.olive, { r: 1, v: 0.5 }); p.box(0, 5, 64, 7, R.olive, { r: 1, v: 0.75 }); p.rect(6, 19, 52, 1, '#141a0e'); p.rect(26, 21, 12, 7, '#e3c14a'); p.disc(8, 37, 3, '#14161c'); p.disc(56, 37, 3, '#14161c'); } }),
    barrier: () => ({ w: 64, h: 28, fn: p => { p.box(1, 6, 62, 20, R.white, { r: 1, v: 0.55 }); for (let i = 0; i < 62; i += 12) p.rect(1 + i, 10, 6, 8, '#c82e3a'); p.rect(1, 24, 62, 3, '#555d7a'); } }),
    car: rng => { const ramp = rng.pick([R.red, R.blue, R.white, R.yellow, R.gunmetal, R.olive, R.copper]), wreck = rng.chance(0.35), dark = '#1c2a3c'; return { w: 96, h: 72, fn: p => {
      p.box(2, 34, 92, 26, ramp, { r: 3, v: 0.55 }); p.box(18, 14, 58, 22, ramp, { r: 4, v: 0.72 });
      p.rect(22, 18, 22, 14, wreck ? '#14161c' : dark); p.rect(48, 18, 24, 14, wreck ? '#14161c' : dark);
      if (wreck) { p.line(24, 20, 40, 30, '#3a3e48'); p.line(52, 30, 66, 19, '#3a3e48'); for (let i = 0; i < 22; i++) p.px(rng.int(4, 90), rng.int(36, 56), rng.pick(['#5c3423', '#80492e', '#3b2018'])); }
      else { p.rect(23, 19, 9, 2, '#5a7a9a'); p.rect(49, 19, 9, 2, '#5a7a9a'); }
      p.rect(2, 44, 92, 2, '#0c0e17'); p.rect(40, 38, 6, 2, '#0c0e17');
      p.rect(87, 38, 6, 4, wreck ? '#3a3020' : '#ffe9a8', wreck ? 0 : 1); p.rect(3, 38, 4, 4, '#8f1d26');
      for (const wx of [20, 74]) { p.disc(wx, 61, 9, '#101218'); p.disc(wx, 61, 4, '#646e86'); p.px(wx - 1, 59, '#949fb6'); }
    } }; },
    container: rng => { const c = rng.pick([R.red, R.blue, R.copper, R.olive, R.steel]); return { w: 128, h: 86, fn: p => cbox(p, 22, c) }; },
    container2: rng => { const a = rng.pick([R.red, R.blue, R.copper]), b = rng.pick([R.olive, R.steel, R.red]); return { w: 128, h: 144, fn: p => { cbox(p, 80, a); cbox(p, 20, b); } }; },
    crane: () => ({ w: 40, h: 172, fn: p => {
      const Y = '#e3b42e', D2 = '#8f6516'; p.rect(8, 10, 4, 154, Y); p.rect(28, 10, 4, 154, Y); p.rect(8, 10, 1, 154, '#fff3b0');
      for (let y = 14; y < 158; y += 16) { p.line(12, y, 27, y + 15, D2); p.line(27, y, 12, y + 15, D2); p.rect(12, y, 16, 2, Y); }
      p.box(4, 2, 32, 10, R.yellow, { r: 1 }); p.rect(18, 0, 4, 3, '#ff3047', 1); p.box(4, 164, 32, 8, R.dark);
    } }),
    stall: rng => { const [a, b] = rng.pick([['#c82e3a', '#f8f9ff'], ['#2e7032', '#f8f9ff'], ['#1f448c', '#ffd95c'], ['#e3972a', '#f8f9ff'], ['#82308f', '#ffd95c']]), food = rng.pick([['#e3975a', '#ffd860', '#8c4a1c'], ['#f0535e', '#ffd0a0', '#5a2a10'], ['#78c46a', '#fff3b0', '#c48d1f']]); return { w: 64, h: 70, fn: p => {
      p.rect(4, 14, 3, 40, '#2d3342'); p.rect(57, 14, 3, 40, '#2d3342');
      for (let x = 0; x < 64; x += 8) { p.rect(x, 4, 8, 12, (x / 8) % 2 ? a : b); p.rect(x + 1, 18, 6, 3, (x / 8) % 2 ? a : b); } p.rect(0, 16, 64, 2, '#14161c');
      p.rect(30, 22, 4, 4, '#ffd27a', 1); p.rect(31, 26, 2, 2, '#fff3c8', 1);
      p.box(2, 44, 60, 24, R.crate, { r: 1, v: 0.55 }); p.rect(2, 52, 60, 2, '#24160c');
      for (let i = 0; i < 6; i++) { p.rect(6 + i * 9, 37, 7, 7, food[i % 3]); p.rect(6 + i * 9, 37, 7, 1, '#fff3c8'); }
    }, light: (x, y) => ({ x, y: y - 10, r: 75, col: '#ffcf8a', a: 0.8, flick: 0.05 }) }; },
    lanternpost: () => ({ w: 24, h: 84, fn: p => {
      p.rect(11, 10, 3, 72, '#3a2418'); p.rect(11, 10, 1, 72, '#5a3a28'); p.rect(3, 12, 18, 2, '#3a2418');
      for (const lx of [5, 18]) { p.rect(lx, 14, 1, 4, '#2a1a12'); p.ell(lx, 25, 4, 6, R.red, { emit: 1, flat: true }); p.rect(lx - 3, 18, 7, 2, '#ffd860', 1); p.rect(lx - 3, 31, 7, 2, '#ffd860', 1); }
      p.rect(8, 80, 9, 4, '#24160c');
    }, light: (x, y) => ({ x, y: y - 8, r: 85, col: '#ff6a3a', a: 0.7, flick: 0.08 }) }),
    table: rng => { const c = rng.pick(['#c82e3a', '#3466c0', '#e3972a']); return { w: 32, h: 30, fn: p => {
      p.ell(16, 12, 12, 5, R.white, { flat: true }); p.rect(15, 15, 2, 11, '#555d7a'); p.rect(10, 26, 12, 2, '#555d7a');
      for (const sx of [0, 25]) { p.rect(sx, 19, 7, 3, c); p.rect(sx + 1, 22, 1, 6, '#2e3349'); p.rect(sx + 5, 22, 1, 6, '#2e3349'); }
    } }; },
    acunit: () => ({ w: 64, h: 44, fn: p => {
      p.box(2, 8, 60, 32, R.silver, { r: 1, v: 0.5 }); p.disc(22, 24, 11, '#3a3f4c'); p.disc(22, 24, 9, '#666d80');
      for (let a = 0; a < 4; a++) p.line(22, 24, 22 + Math.round(Math.cos(a * 1.57 + 0.4) * 8), 24 + Math.round(Math.sin(a * 1.57 + 0.4) * 8), '#3a3f4c');
      p.disc(22, 24, 2, '#c8cdda'); for (let y = 14; y < 36; y += 4) p.rect(40, y, 18, 2, '#666d80'); p.rect(2, 40, 60, 3, '#3a3f4c');
    } }),
    watertank: () => ({ w: 64, h: 112, fn: p => {
      for (const lx of [8, 30, 52]) p.rect(lx, 72, 4, 38, '#2d3342'); p.line(12, 76, 50, 106, '#1d212c'); p.line(52, 76, 14, 106, '#1d212c');
      p.box(4, 20, 56, 56, R.white, { r: 3, v: 0.5 }); for (let y = 28; y < 72; y += 10) p.rect(4, y, 56, 1, '#555d7a');
      for (let i = 0; i < 15; i++) p.rect(32 - i * 2 - 2, 5 + i, i * 4 + 4, 1, i < 2 ? '#b3b9cf' : '#848ca8');
      p.rect(46, 22, 1, 54, '#2e3349'); p.rect(52, 22, 1, 54, '#2e3349'); for (let y = 26; y < 76; y += 6) p.rect(46, y, 7, 1, '#2e3349');
    } }),
    antenna: () => ({ w: 28, h: 116, fn: p => {
      p.rect(13, 10, 2, 102, '#434b5f'); for (const [y, w] of [[20, 20], [36, 16], [52, 12]]) p.rect(14 - w / 2, y, w, 2, '#646e86');
      p.line(14, 60, 4, 110, '#2d3342'); p.line(14, 60, 24, 110, '#2d3342'); p.rect(12, 5, 4, 4, '#ff3047', 1); p.box(8, 110, 12, 6, R.dark);
    }, light: (x, y) => ({ x, y: y - 4, r: 46, col: '#ff3047', a: 0.45, flick: 0.6 }) }),
    vent: () => ({ w: 28, h: 32, fn: p => { p.rect(10, 13, 8, 16, '#646e86'); p.rect(10, 13, 2, 16, '#949fb6'); p.ell(14, 11, 12, 6, R.silver, { flat: true }); p.rect(3, 12, 22, 2, '#3a3f4c'); p.rect(7, 28, 14, 4, '#2d3342'); } }),
    pillarnum: (rng, th, o) => ({ w: 28, h: 92, fn: p => {
      p.box(1, 0, 26, 92, R.white, { v: 0.62 }); for (let y = 74; y < 90; y += 6) { p.rect(1, y, 26, 3, '#e3b42e'); p.rect(1, y + 3, 26, 3, '#14161c'); }
      p.rect(1, 18, 26, 16, '#2a5aa8'); glyphs(p, (o && o.label) || 'B1', 7, 21, '#f8f9ff'); p.rect(1, 0, 26, 3, '#dde1ee');
    } }),
    column: rng => ({ w: 28, h: 94, fn: p => {
      p.box(3, 12, 22, 82, ['#2e3036', '#3a3c42', '#4a4c52', '#5c5e64', '#70727a', '#86888e'], { v: 0.6 });
      for (let y = 24; y < 90; y += 14) p.rect(3, y, 22, 1, '#3a3c42');
      for (const x of [6, 13, 20]) { const h = rng.int(8, 14); p.rect(x, 12 - h, 2, h, '#8c4a1c'); p.px(x, 12 - h, '#bd6d2c'); }
    } }),
    scaffold: () => ({ w: 64, h: 104, fn: p => {
      for (const x of [3, 58]) p.rect(x, 4, 3, 98, '#9aa1b4');
      for (const y of [6, 40, 74]) p.rect(3, y, 58, 2, '#9aa1b4');
      p.line(6, 40, 58, 74, '#666d80'); p.line(58, 6, 6, 40, '#666d80');
      for (const y of [36, 70]) { p.box(2, y, 60, 5, R.crate, { r: 1 }); p.rect(2, y + 5, 60, 1, '#24160c'); }
      for (const x of [1, 56]) p.rect(x, 100, 7, 3, '#3a3f4c');
    } }),
    rebar: rng => ({ w: 64, h: 24, fn: p => {
      for (const x of [6, 50]) p.box(x, 14, 8, 8, R.crate, { r: 1 });
      for (let i = 0; i < 7; i++) { const y = 8 + i * 2 - (i % 2); p.rect(1 + (i % 3), y, 60 - (i % 2) * 3, 2, rng.pick(['#8c4a1c', '#5a2a10', '#bd6d2c'])); p.rect(1 + (i % 3), y, 60 - (i % 2) * 3, 1, '#e3975a'); }
    } }),
    mixer: () => ({ w: 64, h: 60, fn: p => {
      p.rect(8, 40, 46, 4, '#3a3f4c'); p.disc(12, 52, 7, '#101218'); p.disc(12, 52, 3, '#646e86'); p.disc(50, 52, 7, '#101218'); p.disc(50, 52, 3, '#646e86');
      p.ell(32, 24, 20, 15, R.copper, { spec: true }); for (let i = 0; i < 4; i++) p.line(18 + i * 7, 12, 22 + i * 7, 36, '#5a2a10');
      p.ell(50, 14, 6, 8, R.dark, {}); p.rect(30, 38, 4, 6, '#2d3342'); p.rect(56, 36, 6, 2, '#434b5f');
    } }),
    toilet: () => ({ w: 28, h: 64, fn: p => {
      p.box(2, 7, 24, 55, R.blue, { r: 2, v: 0.55 }); p.box(0, 2, 28, 7, R.white, { r: 1 }); p.rect(4, 14, 1, 46, '#0a1630');
      p.rect(10, 11, 8, 2, '#0a1630'); p.rect(11, 22, 6, 6, '#f8f9ff'); p.px(14, 24, '#3466c0'); p.rect(20, 34, 3, 2, '#9cc4ff'); p.rect(1, 62, 26, 2, '#0a1630');
    } }),
    fishtank: rng => ({ w: 64, h: 64, fn: p => {
      p.box(2, 40, 60, 24, R.dark, { r: 1 }); p.grad(4, 6, 56, 34, R.glass, 1);
      for (const [x, y, w, h] of [[2, 4, 60, 3], [2, 38, 60, 3], [2, 4, 2, 37], [60, 4, 2, 37]]) p.rect(x, y, w, h, '#3d4766');
      for (let i = 0; i < 4; i++) { const sx = rng.int(8, 54); p.line(sx, 38, sx + rng.int(-2, 2), 38 - rng.int(6, 14), '#2e7032'); }
      for (let i = 0; i < 5; i++) { const fx = rng.int(8, 50), fy = rng.int(12, 32), c = rng.pick(['#ff9a3a', '#ffd95c', '#f0535e', '#9cc4ff']); p.rect(fx, fy, 6, 3, c, 1); p.px(fx - 1, fy, c, 1); p.px(fx - 1, fy + 2, c, 1); p.px(fx + 4, fy, '#0a1a24'); }
      for (let i = 0; i < 6; i++) p.px(rng.int(8, 56), rng.int(8, 30), '#e8f4ff', 1);
    }, light: (x, y) => ({ x, y: y - 10, r: 70, col: '#3ee8ff', a: 0.55, flick: 0.1 }) }),
    tankpillar: () => ({ w: 32, h: 100, fn: p => {
      p.box(2, 88, 28, 12, R.dark, { r: 1 }); p.grad(4, 8, 24, 80, R.glass, 1); p.box(2, 2, 28, 8, R.dark, { r: 1 });
      p.rect(7, 10, 2, 76, '#a6e2f0', 1);
      for (const [cx, cy] of [[15, 30], [21, 58]]) { p.ell(cx, cy, 6, 4, R.magenta, { emit: 1, flat: true }); for (let k = -4; k <= 4; k += 2) p.line(cx + k, cy + 3, cx + k + (k > 0 ? 1 : -1), cy + 12, '#d080d4', 1); }
      for (let i = 0; i < 5; i++) p.px(10 + i * 3, 74 - i * 12, '#e8f4ff', 1);
    }, light: (x, y) => ({ x, y: y - 6, r: 75, col: '#ff9be0', a: 0.5, flick: 0.12 }) }),
    plantbed: rng => ({ w: 64, h: 40, fn: p => {
      p.box(1, 22, 62, 18, R.crate, { r: 1, v: 0.5 }); p.rect(3, 22, 58, 4, '#2a1c14');
      for (let i = 0; i < 9; i++) { const x = 5 + i * 6 + rng.int(0, 2), h = rng.int(8, 18); p.line(x, 22, x + rng.int(-2, 2), 22 - h, '#2e7032'); p.rect(x - 2, 24 - h, 3, 2, '#4a9a48'); p.rect(x, 26 - h + 3, 3, 2, '#2e7032'); p.disc(x, 22 - h, 2, rng.pick(['#f0535e', '#ffd95c', '#d080d4', '#78c46a', '#78c46a'])); }
    } }),
    growlamp: () => ({ w: 24, h: 84, fn: p => {
      p.rect(11, 14, 2, 66, '#2d3342'); p.box(6, 78, 12, 6, R.dark); p.rect(4, 11, 16, 2, '#2d3342');
      p.box(2, 3, 20, 8, R.dark, { r: 1 }); p.rect(3, 11, 18, 2, '#ff6ad8', 1); p.rect(5, 13, 14, 1, '#ffc0f0', 1);
    }, light: (x, y) => ({ x, y: y - 6, r: 90, col: '#ff6ad8', a: 0.5, flick: 0.04 }) }),
    freezerrack: rng => ({ w: 64, h: 64, fn: p => {
      p.rect(2, 4, 3, 58, '#949fb6'); p.rect(59, 4, 3, 58, '#949fb6');
      for (const y of [20, 38, 56]) { p.rect(2, y, 60, 3, '#c8cdda'); for (let i = 0; i < 5; i++) if (rng.chance(0.8)) { const x = 6 + i * 11; p.box(x, y - 11, 9, 11, rng.chance(0.5) ? R.white : R.blue, { r: 1, v: 0.6 }); p.rect(x, y - 11, 9, 2, '#eef3ff'); }
        for (let i = 0; i < 6; i++) { const x = rng.int(4, 58); p.line(x, y + 3, x, y + 3 + rng.int(2, 5), '#dff4ff'); } }
      p.rect(2, 4, 60, 2, '#dde1ee');
    } }),
    iceblock: () => ({ w: 28, h: 30, fn: p => { p.box(2, 6, 24, 22, R.glass, { r: 2, v: 0.75 }); p.rect(2, 6, 24, 4, '#a6e2f0'); p.rect(5, 11, 8, 2, '#e8f8ff'); p.rect(5, 11, 2, 8, '#e8f8ff'); p.rect(19, 21, 4, 1, '#58a3bd'); } }),
    hanging: () => ({ w: 24, h: 80, fn: p => {
      p.rect(0, 0, 24, 2, '#949fb6'); p.rect(11, 2, 2, 18, '#949fb6'); p.rect(9, 18, 6, 2, '#c8cdda');
      p.box(4, 20, 16, 42, R.white, { r: 4, v: 0.78 }); p.rect(8, 23, 8, 2, '#848ca8'); for (let i = 0; i < 6; i++) p.px(6 + (i * 5) % 12, 28 + i * 5, '#f8f9ff');
    } }),
    stalagmite: rng => ({ w: 30, h: 60, fn: p => {
      for (let y = 0; y < 52; y++) { const w = 2 + Math.round(Math.pow(y / 52, 1.3) * 24), x0 = 15 - Math.floor(w / 2); p.rect(x0, 4 + y, Math.ceil(w / 2), 1, y % 9 < 2 ? '#4a423c' : '#5a5048'); p.rect(15, 4 + y, Math.floor(w / 2), 1, y % 9 < 2 ? '#2a2420' : '#3a332e'); }
      p.rect(2, 56, 26, 4, '#2a2420'); for (let i = 0; i < 5; i++) p.px(rng.int(8, 22), rng.int(20, 50), '#8aa0a8');
    } }),
    mushroom: rng => { const ramp = rng.chance(0.5) ? R.glass : R.green, col = ramp === R.glass ? '#3ee8ff' : '#8dff6a'; return { w: 30, h: 32, fn: p => {
      for (const [x, h, r] of [[8, 12, 6], [18, 18, 7], [24, 8, 4]]) { p.rect(x, 30 - h, 2, h, '#c8d0d8'); p.ell(x + 1, 30 - h, r, Math.max(2, r / 2 + 1), ramp, { emit: 1, flat: true }); p.px(x - 1, 29 - h, '#f8ffff', 1); }
      p.rect(2, 29, 26, 3, '#2a2420');
    }, light: (x, y) => ({ x, y: y - 4, r: 62, col, a: 0.5, flick: 0.12 }) }; },
    crystal: rng => ({ w: 30, h: 46, fn: p => {
      for (const [x, h, dx] of [[9, 26, -3], [15, 40, 1], [21, 22, 4], [12, 16, -6]]) for (let s = 0; s < h; s++) { const w = Math.max(1, Math.round(4 * (1 - s / h)) + 1); p.rect(x + Math.round(dx * s / h) - (w >> 1), 44 - s, w, 1, s > h * 0.7 ? '#f0c0ff' : s % 5 === 0 ? '#d080d4' : '#a94db3', 1); }
      p.rect(3, 43, 24, 3, '#2a2420'); for (let i = 0; i < 4; i++) p.px(rng.int(6, 24), rng.int(8, 40), '#ffffff', 1);
    }, light: (x, y) => ({ x, y: y - 6, r: 72, col: '#c890ff', a: 0.55, flick: 0.06 }) }),
    fountain: () => ({ w: 96, h: 86, fn: p => {
      p.ell(48, 66, 45, 18, R.silver, { flat: true }); p.ell(48, 64, 39, 13, R.glass, { emit: 1, flat: true });
      p.box(42, 36, 12, 28, R.silver, { r: 2 }); p.ell(48, 36, 15, 5, R.silver, { flat: true }); p.ell(48, 35, 11, 3, R.glass, { emit: 1, flat: true });
      p.rect(47, 6, 2, 30, '#e8f8ff', 1); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i - 4.5) * 0.28; p.px(48 + Math.round(Math.cos(a) * (10 + i)), 12 + Math.round(Math.abs(Math.sin(a + 1.57)) * 12) + i, '#a6e2f0', 1); }
      for (let i = 0; i < 12; i++) p.px(14 + i * 6, 60 + (i % 3), '#e8f8ff', 1);
    }, light: (x, y) => ({ x, y: y - 22, r: 100, col: '#bfe8ff', a: 0.55, flick: 0.05 }) }),
  };
  // 集装箱的箱体（两种高度共用）
  function cbox(p, y, ramp) {
    const hi = ramp[Math.min(ramp.length - 1, 4)];
    p.box(1, y, 126, 58, ramp, { r: 1, v: 0.55 }); p.rect(1, y, 126, 5, hi); p.rect(1, y + 5, 126, 1, ramp[1]);
    for (let x = 6; x < 104; x += 6) { p.rect(x, y + 8, 1, 46, ramp[1]); p.rect(x + 1, y + 8, 1, 46, ramp[3]); }
    p.rect(104, y + 6, 1, 50, ramp[0]); for (const x of [110, 118]) { p.rect(x, y + 8, 2, 46, ramp[0]); p.rect(x - 2, y + 26, 6, 2, '#c8cdda'); }
    p.rect(10, y + 10, 24, 7, '#f8f9ff'); p.rect(12, y + 12, 20, 1, ramp[2]); p.rect(12, y + 14, 14, 1, ramp[2]); p.rect(1, y + 56, 126, 2, '#0c0e17');
  }
  D.ENV_SPRITES = SP;

  // 摆出来（脚底在占地最下面一行，左右居中）
  D.ENV_PROP = function (k, tx, ty, th, rng, tw, thh, o) {
    tw = tw || 1; thh = thh || 1;
    if (!SP[k]) { const p = mp0(k, tx, ty, th, rng); p.tx = tx; p.ty = ty; p.tw = tw; p.th = thh; return p; }
    const d = SP[k](rng, th, o), spr = D.mkSprite(d.w, d.h, d.fn), cx = tx * TS + tw * TS / 2, fy = (ty + thh) * TS;
    return { kind: k, x: cx, y: fy, w: d.w / Z, h: d.h / Z, img: spr.img, emit: spr.emit, light: d.light ? d.light(cx, fy) : null, env: true, tx, ty, tw, th: thh };
  };
  const mp0 = D.makeProp;
  D.makeProp = function (k, tx, ty, th, rng) { return SP[k] ? D.ENV_PROP(k, tx, ty, th, rng, 1, 1) : mp0(k, tx, ty, th, rng); };

  // ── 地面
  const surf = (F, tx, ty) => (F.surf && tx >= 0 && ty >= 0 && tx < F.tw && ty < F.tht) ? F.surf[ty * F.tw + tx] : 0;
  const base = (F, tx, ty) => F.th.floor[(tx * 7 + ty * 13) % F.th.floor.length];
  const dots = (R2, px, py, tx, ty, n, cols, w, h) => { for (let i = 0; i < n; i++) R2(px + ((tx * 17 + i * 13 + ty * 7) % (T2 - (w || 1))), py + ((ty * 11 + i * 7 + tx * 3) % (T2 - (h || 1))), w || 1, h || 1, cols[i % cols.length]); };
  const WOOD = ['#5a4030', '#664a36', '#4e3828'];
  function planks(R2, px, py, tx, ty, vertical) { // vertical：木板竖着排（走的方向是左右）
    R2(px, py, T2, T2, '#1a120c');
    for (let k = 0; k < T2; k += 6) { const c = WOOD[(k / 6 + tx + ty) % 3]; if (vertical) R2(px + k, py, 5, T2, c); else R2(px, py + k, T2, 5, c); }
    if (vertical) { R2(px + 2, py + 4, 1, 1, '#2a1c14'); R2(px + 2, py + 26, 1, 1, '#2a1c14'); } else { R2(px + 4, py + 2, 1, 1, '#2a1c14'); R2(px + 26, py + 2, 1, 1, '#2a1c14'); }
  }
  function flag(R2, px, py, tx, ty, cols, grout) { // 石板路
    R2(px, py, T2, T2, grout);
    for (const [ox, oy, w, h] of [[0, 0, 15, 15], [16, 0, 16, 10], [16, 11, 16, 21], [0, 16, 15, 16]]) { R2(px + ox + 1, py + oy + 1, w - 1, h - 1, cols[(tx * 3 + ty + ox + oy) % cols.length]); R2(px + ox + 1, py + oy + 1, w - 1, 1, '#ffffff14'); }
  }
  const FLOOR = {
    asphalt(R2, px, py, tx, ty, F) {
      const rd = F.road;
      if (surf(F, tx, ty) === 1) { // 人行道：方砖 + 路缘石
        flag(R2, px, py, tx, ty, ['#4c4e56', '#52545c', '#484a52'], '#34363d'); dots(R2, px, py, tx, ty, 5, ['#00000030', '#ffffff0c']);
        if (rd && ty === rd.y0 + rd.walk - 1) { R2(px, py + T2 - 4, T2, 4, '#8a8c94'); R2(px, py + T2 - 4, T2, 1, '#c8cad2'); }
        if (rd && ty === rd.y1 - rd.walk + 1) { R2(px, py, T2, 4, '#8a8c94'); R2(px, py, T2, 1, '#c8cad2'); }
        return;
      }
      R2(px, py, T2, T2, base(F, tx, ty)); dots(R2, px, py, tx, ty, 18, ['#3a3c44', '#1e2026', '#34363e']);
      if (!rd) return;
      const a0 = rd.y0 + rd.walk, a1 = rd.y1 - rd.walk, mid = Math.floor((a0 + a1 + 1) / 2) - 1;
      if (ty === a0) R2(px, py + 3, T2, 2, '#c8a93a'); if (ty === a1) R2(px, py + T2 - 5, T2, 2, '#c8a93a');
      if (ty === mid && tx % 3 !== 0) R2(px, py + T2 - 2, T2, 2, '#d8dade');
      if (F.zebra && F.zebra.some(z => tx >= z && tx < z + 3) && ty > a0 && ty < a1) for (let k = 3; k < T2; k += 10) R2(px + 2, py + k, T2 - 4, 5, '#c8cad0');
      if ((tx * 13 + ty * 7) % 41 === 0 && ty > a0 && ty < a1) { R2(px + 9, py + 9, 14, 14, '#3a3c42'); R2(px + 11, py + 11, 10, 10, '#2a2c32'); for (const yy of [14, 17]) R2(px + 12, py + yy, 8, 1, '#4a4c54'); }
      if ((tx * 5 + ty * 11) % 17 === 0) { R2(px + 6, py + 10, 14, 5, '#14161c40'); R2(px + 10, py + 14, 8, 3, '#14161c30'); } // 油渍
    },
    bricks(R2, px, py, tx, ty, F) {
      R2(px, py, T2, T2, F.th.grout);
      const BR = F.th.floor;
      for (let row = 0; row < 4; row++) { const off = ((ty * 4 + row) % 2) * 8; for (let col = -1; col < 3; col++) { const a = Math.max(px, px + col * 16 + off), b = Math.min(px + T2, px + col * 16 + off + 15); if (b > a) R2(a, py + row * 8, b - a, 7, BR[(tx * 3 + row * 5 + col + 9) % BR.length]); } }
      if ((tx * 7 + ty * 3) % 5 === 0) R2(px + 4 + (tx % 3) * 6, py + 6 + (ty % 4) * 5, 12, 1, ['#ff6a5a38', '#ffd27a30', '#ff3d8b30'][(tx + ty) % 3]); // 湿地面倒映的灯
    },
    grass(R2, px, py, tx, ty, F) {
      const s = surf(F, tx, ty);
      if (s === 1) { flag(R2, px, py, tx, ty, ['#6a6458', '#726b5e', '#625c51'], '#3a362e'); return; }
      if (s === 3) { R2(px, py, T2, T2, '#123036'); dots(R2, px, py, tx, ty, 8, ['#1a4048', '#0c2226'], 2, 1); return; }
      R2(px, py, T2, T2, base(F, tx, ty));
      for (let i = 0; i < 22; i++) { const a = px + ((tx * 17 + i * 13 + ty * 7) % T2), b = py + ((ty * 11 + i * 7 + tx * 3) % (T2 - 3)); R2(a, b, 1, 3, i % 3 ? '#2f5a34' : '#1a3a20'); if (i % 7 === 0) R2(a, b, 1, 1, '#4f8a48'); }
      if ((tx * 7 + ty * 11) % 23 === 0) { R2(px + 8, py + 10, 2, 2, '#ffd8f0'); R2(px + 20, py + 18, 2, 2, '#fff0a0'); R2(px + 14, py + 24, 2, 2, '#ffd8f0'); }
      // 池塘边一圈卵石
      for (const [dx, dy, x, y, w, h] of [[0, -1, 0, 0, T2, 3], [0, 1, 0, T2 - 3, T2, 3], [-1, 0, 0, 0, 3, T2], [1, 0, T2 - 3, 0, 3, T2]]) if (surf(F, tx + dx, ty + dy) === 3) for (let k = 0; k < (w > h ? w : h); k += 5) R2(px + x + (w > h ? k : 0), py + y + (w > h ? 0 : k), 4, 3, k % 10 ? '#8a8478' : '#6a6458');
    },
    roof(R2, px, py, tx, ty, F) {
      const s = surf(F, tx, ty);
      if (s === 2 || s === 5) { planks(R2, px, py, tx, ty, s === 2); return; }
      R2(px, py, T2, T2, base(F, tx, ty)); dots(R2, px, py, tx, ty, 16, ['#46464e', '#2c2c32', '#3a3a42']);
      if (tx % 3 === 0) R2(px, py, 1, T2, '#2a2a30'); if (ty % 3 === 0) R2(px, py, T2, 1, '#2a2a30');
      const H = F.heli; if (H) { // 停机坪：一个黄圈、正中白色 H
        const cx = H.cx * Z - px, cy = H.cy * Z - py, rr = H.r * T2;
        for (let j = 0; j < T2; j++) for (let i = 0; i < T2; i++) { const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy); if (d > rr - 4 && d < rr) R2(px + i, py + j, 1, 1, '#e3b42e'); }
        const hx = cx - 14, hy = cy - 16; for (const [x, y, w, h] of [[0, 0, 6, 32], [22, 0, 6, 32], [6, 13, 16, 6]]) { const a = Math.max(0, hx + x), b = Math.min(T2, hx + x + w), c = Math.max(0, hy + y), d = Math.min(T2, hy + y + h); if (b > a && d > c) R2(px + a, py + c, b - a, d - c, '#e8ecf2'); }
      }
    },
    quay(R2, px, py, tx, ty, F, r) {
      if (r && r.kind === 'pier') { planks(R2, px, py, tx, ty, false); return; }
      R2(px, py, T2, T2, F.th.floor[(Math.floor(tx / 2) * 7 + Math.floor(ty / 2) * 13) % F.th.floor.length]);
      if (tx % 2 === 0) R2(px, py, 2, T2, F.th.grout); if (ty % 2 === 0) R2(px, py, T2, 2, F.th.grout);
      dots(R2, px, py, tx, ty, 6, ['#00000030', '#ffffff10']);
      if (F.rails && F.rails.includes(ty)) { R2(px, py + 14, T2, 3, '#6a7080'); R2(px, py + 14, T2, 1, '#b0b8c8'); }
      if (F.seaY && ty === F.seaY - 1) { R2(px, py + T2 - 6, T2, 4, '#e3c14a'); for (let k = (tx % 2) * 8; k < T2; k += 16) R2(px + k, py + T2 - 6, 8, 4, '#1a1a1a'); }
    },
    dirt(R2, px, py, tx, ty, F) {
      if (surf(F, tx, ty) === 1) { R2(px, py, T2, T2, '#5e6066'); if (tx % 2 === 0) R2(px, py, 1, T2, '#4a4c52'); if (ty % 2 === 0) R2(px, py, T2, 1, '#4a4c52'); dots(R2, px, py, tx, ty, 6, ['#70727a', '#4a4c52']); return; }
      R2(px, py, T2, T2, base(F, tx, ty)); dots(R2, px, py, tx, ty, 16, ['#5a4a38', '#3a2e22', '#6a5844'], 2, 1);
      if (F.ruts && F.ruts.includes(ty)) for (const yy of [8, 20]) { R2(px, py + yy, T2, 4, '#3a2e22'); for (let k = (tx % 2) * 2; k < T2; k += 4) R2(px + k, py + yy + 1, 2, 2, '#2e241a'); }
      if ((tx * 11 + ty * 7) % 29 === 0) { R2(px + 6, py + 12, 20, 7, '#2a3a48'); R2(px + 9, py + 13, 8, 1, '#5a7a90'); }
    },
    sewer(R2, px, py, tx, ty, F) {
      const s = surf(F, tx, ty);
      if (s === 1) { R2(px, py, T2, T2, '#16201c'); dots(R2, px, py, tx, ty, 10, ['#24382a', '#0e1612'], 3, 1); if (surf(F, tx, ty - 1) !== 1) R2(px, py, T2, 3, '#3a4a3a'); if (surf(F, tx, ty + 1) !== 1) R2(px, py + T2 - 3, T2, 3, '#3a4a3a'); return; }
      if (s === 2) { planks(R2, px, py, tx, ty, false); return; }
      R2(px, py, T2, T2, F.th.grout); // 湿石板：一格两行，上下错开半块
      for (let row = 0; row < 2; row++) { const off = ((ty * 2 + row) % 2) * 16; for (let col = -1; col < 2; col++) { const a = Math.max(px, px + col * 32 + off), b = Math.min(px + T2, px + col * 32 + off + 31); if (b > a) R2(a, py + row * 16 + 1, b - a, 15, F.th.floor[(tx + row + col + 3) % F.th.floor.length]); } }
      dots(R2, px, py, tx, ty, 6, ['#1e3a20', '#ffffff0c']);
      if (s === 4) { R2(px + 4, py + 4, 24, 24, '#0e1012'); for (let k = 6; k < 28; k += 4) R2(px + k, py + 5, 2, 22, '#3a3e46'); }
    },
    parking(R2, px, py, tx, ty, F) {
      R2(px, py, T2, T2, base(F, tx, ty)); if (tx % 4 === 0) R2(px, py, 1, T2, '#3e4046'); if (ty % 4 === 0) R2(px, py, T2, 1, '#3e4046');
      dots(R2, px, py, tx, ty, 5, ['#00000020', '#ffffff10']);
      if ((tx * 5 + ty * 9) % 19 === 0) { R2(px + 8, py + 8, 14, 8, '#2a2c3040'); R2(px + 12, py + 15, 6, 3, '#2a2c3030'); }
      for (const b of F.bays || []) if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) {
        if ((tx - b.x) % 3 === 0) R2(px, py, 2, T2, '#d8dadf'); if (tx === b.x + b.w - 1) R2(px + T2 - 2, py, 2, T2, '#d8dadf');
        if (b.up ? ty === b.y : ty === b.y + b.h - 1) R2(px, b.up ? py : py + T2 - 2, T2, 2, '#d8dadf');
      }
      for (const a of F.arrows || []) if (a.tx === tx && a.ty === ty) { const d = a.d; R2(px + 6, py + 14, 20, 4, '#d8dadf'); for (let k = 0; k < 6; k++) R2(px + (d > 0 ? 20 + k : 12 - k), py + 10 + k, 1, 12 - k * 2, '#d8dadf'); }
      const rp = F.ramp; if (rp && tx >= rp.x && tx < rp.x + rp.w && ty >= rp.y && ty < rp.y + rp.h) for (let k = -T2; k < T2; k += 12) for (let j = 0; j < T2; j++) { const i = k + j; if (i >= 0 && i < T2 - 5) R2(px + i, py + j, 5, 1, (k / 12) % 2 ? '#e3b42e' : '#1a1a1a'); }
    },
    aqua(R2, px, py, tx, ty, F) {
      R2(px, py, T2, T2, base(F, tx, ty));
      for (let k = 0; k < 2; k++) { const yy = py + 8 + k * 14; for (let i = 0; i < T2; i += 2) R2(px + i, yy + Math.round(Math.sin((tx * T2 + i) / 9 + k + ty) * 2), 2, 1, '#1e3a5e'); }
      if ((tx * 7 + ty * 5) % 13 === 0) { const c = '#ff9be050'; R2(px + 14, py + 10, 3, 9, c); R2(px + 11, py + 13, 9, 3, c); }
    },
    terra(R2, px, py, tx, ty, F) {
      if (surf(F, tx, ty) === 1) { flag(R2, px, py, tx, ty, ['#8a8270', '#948b78', '#807866'], '#4a4436'); return; }
      R2(px, py, T2, T2, F.th.grout);
      for (const [ox, oy] of [[0, 0], [16, 0], [0, 16], [16, 16]]) { R2(px + ox + 1, py + oy + 1, 15, 15, F.th.floor[(tx * 2 + ty * 3 + ox / 16 + oy / 8) % F.th.floor.length]); R2(px + ox + 1, py + oy + 1, 15, 1, '#ffffff12'); }
      dots(R2, px, py, tx, ty, 5, ['#3a5a2a', '#4a7a34'], 2, 1);
    },
    frost(R2, px, py, tx, ty, F) {
      R2(px, py, T2, T2, base(F, tx, ty));
      for (let j = 0; j < T2; j += 8) for (let i = (j / 8 % 2) * 4; i < T2 - 3; i += 8) { R2(px + i + 1, py + j + 3, 3, 1, '#5a6874'); R2(px + i + 2, py + j + 2, 1, 3, '#5a6874'); }
      dots(R2, px, py, tx, ty, 8, ['#e8f4ff40', '#ffffff28']);
      if ((tx * 7 + ty * 5) % 9 === 0) for (let i = 0; i < 18; i++) R2(px + 4 + ((i * 7) % 22), py + 6 + ((i * 5) % 18), 2, 1, '#dfefff50');
      const dk = F.dock; if (dk && tx >= dk.x && tx < dk.x + dk.w && ty >= dk.y && ty < dk.y + dk.h && tx === dk.x) for (let k = 0; k < T2; k += 8) { R2(px, py + k, 6, 4, '#e3b42e'); R2(px, py + k + 4, 6, 4, '#1a1a1a'); }
    },
    rock(R2, px, py, tx, ty, F) {
      if (surf(F, tx, ty) === 3) { R2(px, py, T2, T2, '#0e2228'); dots(R2, px, py, tx, ty, 8, ['#16343c', '#08161a'], 2, 1); return; }
      R2(px, py, T2, T2, base(F, tx, ty));
      for (let i = 0; i < 5; i++) R2(px + ((tx * 13 + i * 7) % 24), py + ((ty * 7 + i * 11) % 26), 4 + (i % 3) * 2, 3 + (i % 2) * 2, i % 2 ? '#262220' : '#3a3430');
      if ((tx * 3 + ty * 7) % 4 === 0) { R2(px + 6, py + 12, 7, 1, '#16120f'); R2(px + 12, py + 13, 1, 5, '#16120f'); R2(px + 13, py + 17, 8, 1, '#16120f'); }
      dots(R2, px, py, tx, ty, 6, ['#4a423c', '#ffffff10']);
    },
  };
  const pf0 = D.paintFloorTile;
  D.paintFloorTile = function (x, F, tx, ty, rng) {
    pf0(x, F, tx, ty, rng);
    if (!F.env) return;
    const ri = F.room[ty * F.tw + tx], r = ri >= 0 ? F.rooms[ri] : null, RD = r && D.ROOMS[r.kind];
    const pat = RD && RD.pat ? RD.pat : (!RD || RD.floor === 'theme' || F.allPat) ? F.th.pattern : null;
    if (!pat || !FLOOR[pat]) return;
    const px = tx * T2, py = ty * T2, R2 = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
    FLOOR[pat](R2, px, py, tx, ty, F, r);
  };

  // ── 墙面
  // 盒子房间（集装箱、板房）的四面墙
  const inBox = (F, tx, ty) => F.boxes && F.boxes.find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
  function boxWall(R2, G, b, px, py, tx, ty) {
    const top = ty === b.y, bot = ty === b.y + b.h - 1, side = tx === b.x || tx === b.x + b.w - 1;
    if (b.style === 'container') {
      const c = b.col || R.red; R2(px, py, T2, T2, c[2]); for (let k = 2; k < T2; k += 6) { R2(px + k, py, 1, T2, c[1]); R2(px + k + 1, py, 1, T2, c[3]); }
      if (top || bot) { R2(px, py, T2, 3, c[4] || c[3]); R2(px, py + T2 - 3, T2, 3, c[0]); }
      if (side) R2(px + (tx === b.x ? 0 : T2 - 4), py, 4, T2, c[0]);
      if (bot && !side && (tx - b.x) % 3 === 1) R2(px + 10, py + 14, 12, 2, '#c8cdda');
    } else { // 板房：白墙蓝腰线、带窗
      R2(px, py, T2, T2, '#d8dde6'); R2(px, py, T2, 3, '#8a93a8'); R2(px, py + 20, T2, 4, '#2a5aa8'); R2(px, py + T2 - 3, T2, 3, '#4a5268');
      if ((top || bot) && !side && (tx - b.x) % 2 === 1) { R2(px + 6, py + 6, 20, 11, '#2a3448'); G(px + 7, py + 7, 18, 9, (tx + ty) % 3 ? '#ffe2a840' : '#bfe8ff30'); R2(px + 16, py + 6, 1, 11, '#8a93a8'); }
      if (side) R2(px + (tx === b.x ? 0 : T2 - 3), py, 3, T2, '#8a93a8');
    }
  }
  // 砖墙（下水道、夜市、街区共用）
  function bricks(R2, px, py, c0, c1, gr) {
    R2(px, py, T2, T2, gr);
    for (let row = 0; row < 5; row++) { const off = (row % 2) * 8; for (let col = -1; col < 3; col++) { const a = Math.max(px, px + col * 16 + off), b = Math.min(px + T2, px + col * 16 + off + 15); if (b > a) R2(a, py + row * 6 + 1, b - a, 5, (row + col) % 3 ? c0 : c1); } }
  }
  // 墙顶（没有朝向地面的那面）：深色 + 挨着地面的亮边
  function topEdge(R2, px, py, tx, ty, isFloor, col, edge) {
    R2(px, py, T2, T2, col);
    if (isFloor(tx - 1, ty)) { R2(px, py, 3, T2, edge[0]); R2(px, py, 1, T2, edge[1]); }
    if (isFloor(tx + 1, ty)) { R2(px + T2 - 3, py, 3, T2, edge[0]); R2(px + T2 - 1, py, 1, T2, edge[1]); }
    if (isFloor(tx, ty - 1)) { R2(px, py, T2, 4, edge[0]); R2(px, py, T2, 1, edge[1]); }
  }
  const neonSign = (R2, G, F, px, py, tx, ty, col, w, lit) => { R2(px + 2, py + 6, T2 - 4, 12, '#0d0e18'); for (let i = 0; i < (w || 3); i++) { const a = px + 4 + ((tx * 7 + i * 9) % (T2 - 12)), ww = 3 + ((tx + i * 5) % 6); G(a, py + 9 + ((i * 3 + ty) % 6), ww, 2, col); } if (lit !== false) F.signs.push({ x: (tx + 0.5) * TS, y: ty * TS + 6, col }); };
  const WALL = {
    street(R2, G, F, px, py, tx, ty, isFloor) {
      if (isFloor(tx, ty + 1)) {
        const v = (tx * 7 + ty * 3 + (tx >> 2)) % 6, c = F.th.face[(tx >> 1) % 2];
        R2(px, py, T2, T2, c); R2(px, py, T2, 3, '#0a0b12');
        if (v === 0 || v === 3) { R2(px + 2, py + 6, T2 - 4, T2 - 11, '#1a1410'); G(px + 3, py + 7, T2 - 6, T2 - 13, tx % 2 ? '#ffcf8a' : '#ffe2b0'); R2(px + 16, py + 7, 1, T2 - 13, '#2a2010'); R2(px + 5, py + T2 - 11, 7, 5, '#3a2a18'); R2(px + 20, py + T2 - 10, 5, 4, '#3a2a18'); }
        else if (v === 1) { R2(px + 1, py + 5, T2 - 2, T2 - 9, '#4a4f5e'); for (let j = py + 7; j < py + T2 - 5; j += 3) R2(px + 1, j, T2 - 2, 1, '#353946'); if (tx % 3 === 0) G(px + 5, py + 14, 12, 3, '#ff3d8b'); }
        else if (v === 2) { bricks(R2, px, py + 3, '#4a3430', '#553a34', '#2a1e1c'); neonSign(R2, G, F, px, py, tx, ty, F.th.neon[(tx + ty) % F.th.neon.length]); }
        else if (v === 4) { bricks(R2, px, py + 3, '#3e3a44', '#46424c', '#24222a'); R2(px + 8, py + 8, 16, T2 - 10, '#14161e'); R2(px + 8, py + 8, 16, 1, '#3a3e4e'); G(px + 14, py + 5, 4, 2, '#ffe2b0'); }
        else { bricks(R2, px, py + 3, '#4a3430', '#553a34', '#2a1e1c'); R2(px + 6, py + 10, 20, 12, '#9aa0ae'); R2(px + 8, py + 12, 10, 8, '#5a606e'); for (let k = 0; k < 8; k += 2) R2(px + 8, py + 12 + k, 10, 1, '#3a3e4a'); }
        R2(px, py + T2 - 3, T2, 3, '#14161f'); return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#14161f', ['#2a2c38', '#4a4e60']);
      if ((tx * 5 + ty * 11) % 13 === 0) { R2(px + 8, py + 8, 16, 12, '#20222c'); R2(px + 8, py + 8, 16, 2, '#3a3e4c'); }
      if ((tx * 3 + ty * 7) % 37 === 0) G(px + 6, py + 18, 10, 6, '#2a3a5a'); // 天窗
      return true;
    },
    nightmkt(R2, G, F, px, py, tx, ty, isFloor) {
      if (isFloor(tx, ty + 1)) {
        const v = (tx * 5 + ty) % 6; R2(px, py, T2, T2, F.th.face[tx % 2]); R2(px, py, T2, 3, '#0a080c');
        if (v % 3 === 0) { R2(px + 10, py + 2, 12, T2 - 6, '#1a0a0e'); G(px + 12, py + 4, 8, T2 - 10, F.th.neon[(tx >> 1) % F.th.neon.length]); for (let k = 7; k < T2 - 8; k += 6) R2(px + 13, py + k, 6, 2, '#1a0a0e'); if (tx % 4 === 0) F.signs.push({ x: (tx + 0.5) * TS, y: ty * TS + 8, col: F.th.neon[(tx >> 1) % F.th.neon.length] }); }
        else if (v % 3 === 1) neonSign(R2, G, F, px, py, tx, ty, F.th.neon[(tx + 1) % F.th.neon.length], 4, tx % 4 === 1);
        else { R2(px + 4, py + 6, T2 - 8, 14, '#2a1a10'); G(px + 5, py + 7, T2 - 10, 12, '#ffb07040'); R2(px + 15, py + 6, 2, 14, '#1a0e08'); }
        if (tx % 2 === 0) { G(px + 4, py + T2 - 11, 8, 8, '#ff3a2a'); R2(px + 6, py + T2 - 13, 4, 2, '#ffd27a'); G(px + 20, py + T2 - 10, 7, 7, '#ff6a3a'); }
        return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#140e12', ['#2a1c22', '#4a3038']);
      for (let j = 4; j < T2; j += 5) R2(px, py + j, T2, 1, '#1c1418');
      if ((isFloor(tx, ty + 2) || isFloor(tx, ty + 3)) && ty % 2 === 0) for (let i = 2; i < T2; i += 8) G(px + i, py + 16, 2, 2, (i / 8 + tx) % 2 ? '#ffd27a' : '#ff6a4a'); // 只在街边那几排房顶上挂灯串
      return true;
    },
    park(R2, G, F, px, py, tx, ty, isFloor) {
      if (isFloor(tx, ty + 1)) {
        R2(px, py, T2, 18, '#1c3a22'); for (let i = 0; i < 12; i++) R2(px + ((tx * 7 + i * 5) % 28), py + ((i * 7 + ty) % 15), 4, 3, i % 3 ? '#2a5530' : '#3f7a3c');
        R2(px, py + 18, T2, T2 - 18, '#101a12'); R2(px, py + 19, T2, 2, '#1a1c24'); for (let k = 2; k < T2; k += 6) { R2(px + k, py + 16, 2, 14, '#1a1c24'); R2(px + k, py + 14, 2, 2, '#3a3e4a'); }
        return true;
      }
      R2(px, py, T2, T2, '#0c1c12'); for (let i = 0; i < 6; i++) { const a = px + ((tx * 13 + i * 9) % 22), b = py + ((ty * 7 + i * 11) % 22); R2(a, b, 10, 8, ['#14301c', '#1c3a22', '#24482a'][i % 3]); R2(a + 2, b + 1, 4, 2, '#2f5a34'); }
      return true;
    },
    rooftop(R2, G, F, px, py, tx, ty, isFloor) {
      const abyss = () => { R2(px, py, T2, T2, '#05070e'); if ((tx * 13 + ty * 7) % 9 === 0) G(px + ((tx * 7) % 28), py + ((ty * 5) % 28), 2, 1, '#ffb05780'); if ((tx * 5 + ty * 3) % 23 === 0) G(px + ((tx * 11) % 26), py + ((ty * 13) % 26), 1, 1, '#ffffff70'); if (ty % 7 === 0) R2(px, py + 16, T2, 1, '#0c1018'); };
      if (isFloor(tx, ty + 1)) { abyss(); R2(px, py + T2 - 10, T2, 10, '#5a5a62'); R2(px, py + T2 - 10, T2, 2, '#8a8a94'); R2(px, py + T2 - 2, T2, 2, '#2a2a30'); return true; }
      if (isFloor(tx, ty - 1)) { R2(px, py, T2, T2, '#22242e'); R2(px, py, T2, 3, '#6a6a72'); for (const wx of [5, 19]) if (((tx * 3 + wx) % 5) < 3) G(px + wx, py + 8, 7, 9, (tx + wx) % 3 ? '#ffd27a90' : '#bfe8ff70'); else R2(px + wx, py + 8, 7, 9, '#14161e'); return true; }
      if (isFloor(tx, ty - 2) && !isFloor(tx, ty - 1)) { R2(px, py, T2, T2, '#181a22'); for (const wx of [5, 19]) if (((tx * 7 + wx) % 7) < 2) G(px + wx, py + 6, 7, 9, '#ffd27a60'); return true; }
      abyss(); if (isFloor(tx - 1, ty) || isFloor(tx + 1, ty)) R2(px + (isFloor(tx - 1, ty) ? 0 : T2 - 4), py, 4, T2, '#3a3a42');
      return true;
    },
    harbor(R2, G, F, px, py, tx, ty, isFloor) {
      if (F.seaY && ty >= F.seaY) {
        R2(px, py, T2, T2, '#0a1626'); for (let k = 0; k < 4; k++) R2(px + ((tx * 7 + k * 11) % 14), py + 4 + k * 8 + ((tx * 3 + ty + k) % 3), 10 + (k * 5) % 8, 1, '#1a3450');
        if (tx === F.moonX || tx === F.moonX + 1) G(px + 6, py + ((ty * 7) % 22), 18, 2, '#bfe8ff50');
        if ((tx * 11 + ty * 5) % 7 === 0) G(px + ((tx * 11 + ty * 5) % 28), py + ((tx * 3 + ty * 13) % 28), 1, 1, '#bfe8ff80');
        if (isFloor(tx, ty - 1)) { R2(px, py, T2, 10, '#4a4c52'); R2(px, py, T2, 2, '#7a7c84'); if (tx % 3 === 0) { R2(px + 9, py + 3, 14, 12, '#101214'); R2(px + 11, py + 5, 10, 8, '#24262a'); } }
        if (isFloor(tx - 1, ty) || isFloor(tx + 1, ty)) R2(px + (isFloor(tx - 1, ty) ? 0 : T2 - 5), py, 5, T2, '#3a2a1e');
        return true;
      }
      if (isFloor(tx, ty + 1)) {
        R2(px, py, T2, T2, F.th.face[0]); for (let k = 0; k < T2; k += 4) { R2(px + k, py + 3, 1, T2 - 6, '#2a3442'); R2(px + k + 1, py + 3, 1, T2 - 6, '#4a5868'); }
        R2(px, py, T2, 3, '#14181e'); if ((tx % 6) === 2) { R2(px + 2, py + 8, T2 - 4, T2 - 10, '#5a6270'); for (let j = py + 10; j < py + T2 - 3; j += 3) R2(px + 2, j, T2 - 4, 1, '#4a5260'); G(px + 14, py + 4, 4, 2, '#ffc070'); }
        R2(px, py + T2 - 3, T2, 3, '#14161f'); return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#1c2430', ['#2c3644', '#4a5868']); for (let k = 3; k < T2; k += 6) R2(px + k, py, 1, T2, '#232c38');
      return true;
    },
    site(R2, G, F, px, py, tx, ty, isFloor) {
      if (F.pits && F.pits[ty * F.tw + tx]) {
        R2(px, py, T2, T2, '#1a140e'); dots(R2, px, py, tx, ty, 6, ['#2a2018', '#0e0a06']);
        if (isFloor(tx, ty - 1)) { R2(px, py, T2, 8, '#4a3a2a'); R2(px, py, T2, 3, '#6a5038'); }
        if (!F.pits[(ty + 1) * F.tw + tx]) { R2(px + 4, py + 16, 24, 8, '#1e2a34'); R2(px + 8, py + 17, 8, 1, '#4a6a80'); }
        if (tx === F.pitLadder && !F.pits[(ty - 1) * F.tw + tx]) for (let k = 4; k < T2; k += 5) { R2(px + 10, py, 2, T2, '#6a5038'); R2(px + 20, py, 2, T2, '#6a5038'); R2(px + 10, py + k, 12, 2, '#8a6a48'); }
        return true;
      }
      if (isFloor(tx, ty + 1)) {
        const blue = (tx >> 1) % 2; R2(px, py, T2, T2, blue ? '#2e4a7a' : '#dfe4ec'); R2(px, py + 8, T2, 4, blue ? '#ffd23a' : '#2e4a7a'); R2(px, py, T2, 2, '#14161c');
        if (tx % 4 === 0) R2(px, py, 2, T2, '#3a3e46'); if (tx % 9 === 4) { for (let k = 0; k < 8; k++) R2(px + 16 - k, py + 15 + k, k * 2 + 1, 1, '#ffd23a'); R2(px + 15, py + 17, 2, 4, '#14161c'); }
        R2(px, py + T2 - 3, T2, 3, '#2a2018'); return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#221a12', ['#3a2e22', '#5a4a38']); dots(R2, px, py, tx, ty, 10, ['#2e241a', '#3a2e22'], 3, 2);
      return true;
    },
    sewer(R2, G, F, px, py, tx, ty, isFloor) {
      if (isFloor(tx, ty + 1)) {
        bricks(R2, px, py, F.th.face[0], F.th.face[1], '#22180f'); R2(px, py + T2 - 6, T2, 6, '#1e2e18'); G(px + ((tx * 7) % 24), py + T2 - 5, 6, 1, '#6aff5a30');
        R2(px + ((tx * 11) % 28), py + 10, 1, 10, '#2a4a2a');
        if ((tx * 5 + ty) % 7 === 0) { R2(px + 8, py + 10, 16, 12, '#2a2e34'); R2(px + 11, py + 13, 10, 6, '#0a0c0e'); G(px + 15, py + 19, 2, 13, '#7fd8ff40'); }
        return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#0e100e', ['#1c221a', '#34402e']); for (let j = 6; j < T2; j += 6) R2(px, py + j, T2, 1, '#141814');
      return true;
    },
    garage(R2, G, F, px, py, tx, ty, isFloor) {
      if (isFloor(tx, ty + 1)) {
        R2(px, py, T2, T2, '#5a5c62'); R2(px, py, 1, T2, '#4a4c52'); R2(px, py + 3, T2, 3, '#7a7c84'); R2(px, py + 3, T2, 1, '#9a9ca4');
        for (let k = (tx % 2) * 4; k < T2; k += 8) { R2(px + k, py + T2 - 8, 4, 6, '#e3b42e'); R2(px + k + 4, py + T2 - 8, 4, 6, '#1a1a1a'); }
        if (tx % 9 === 3) { R2(px + 4, py + 8, 24, 13, '#2a5aa8'); glyphs({ rect: R2 }, F.level || 'B2', px + 9, py + 9, '#f8f9ff', 2); }
        else if (tx % 13 === 8) { G(px + 6, py + 9, 20, 7, '#3dd66a'); R2(px + 8, py + 10, 2, 5, '#f8f9ff'); R2(px + 12, py + 11, 10, 2, '#f8f9ff'); }
        return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#16171c', ['#2a2c34', '#4a4c58']); if (tx % 4 === 0) R2(px, py, 4, T2, '#1e2026');
      return true;
    },
    aquarium(R2, G, F, px, py, tx, ty, isFloor, x, ex) {
      if (isFloor(tx, ty + 1)) {
        const g = x.createLinearGradient(0, py, 0, py + T2); g.addColorStop(0, '#0a2a4a'); g.addColorStop(1, '#145a80'); x.fillStyle = g; x.fillRect(px, py + 3, T2, T2 - 6);
        ex.fillStyle = 'rgba(62,232,255,0.12)'; ex.fillRect(px, py + 3, T2, T2 - 6);
        for (let k = 1; k < T2; k += 3) R2(px + k, py + T2 - 10 + ((k * 3 + tx) % 6), 2, 7, '#1f6a4a');
        if ((tx * 7 + ty * 3) % 3 === 0) { const fx = px + ((tx * 13) % 18) + 4, fy = py + 8 + ((tx * 5) % 10), c = ['#ff9a3a', '#ffd95c', '#9cc4ff', '#f0535e'][tx % 4]; G(fx, fy, 6, 3, c); G(fx - 2, fy - 1, 2, 5, c); R2(fx + 4, fy, 1, 1, '#0a1a24'); }
        if ((tx * 5 + ty) % 4 === 0) G(px + 20 + (tx % 6), py + 6 + ((tx * 3) % 10), 6, 2, '#d0d8e8');
        for (let i = 0; i < 3; i++) G(px + ((tx * 11 + i * 7) % 28), py + 5 + ((tx * 3 + i * 5) % 16), 1, 1, '#e8f4ff');
        R2(px, py, T2, 3, '#2a3a50'); R2(px, py + T2 - 3, T2, 3, '#1a2436'); if (tx % 3 === 0) R2(px, py, 2, T2, '#2a3a50');
        return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#060c1a', ['#10203a', '#2a4a70']); if ((tx + ty) % 2) G(px + ((tx * 7) % 20), py + ((ty * 5) % 20), 6, 1, 'rgba(62,232,255,.12)');
      return true;
    },
    greenhouse(R2, G, F, px, py, tx, ty, isFloor, x) {
      if (isFloor(tx, ty + 1)) {
        const g = x.createLinearGradient(0, py, 0, py + T2); g.addColorStop(0, '#0a1426'); g.addColorStop(1, '#1a2a3a'); x.fillStyle = g; x.fillRect(px, py, T2, T2);
        if ((tx * 7 + ty * 3) % 5 === 0) G(px + ((tx * 11) % 28), py + ((tx * 3) % 12) + 2, 1, 1, '#e8f0ff');
        R2(px, py, T2, 2, '#cfd8e0'); R2(px, py + 15, T2, 1, '#cfd8e0'); if (tx % 2 === 0) R2(px, py, 2, T2, '#cfd8e0');
        for (let k = 0; k < 7; k++) R2(px + ((tx * 5 + k * 7) % 30), py + ((k * 5 + ty) % 24) + 2, 2, 2, k % 2 ? '#2f6a34' : '#4f8a48');
        R2(px, py + T2 - 4, T2, 4, '#5a4030'); return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#0c1a14', ['#1e3428', '#4a5a5a']); if (tx % 2 === 0) R2(px, py, 1, T2, '#3a4a4a'); if (ty % 2 === 0) R2(px, py, T2, 1, '#3a4a4a');
      if ((tx * 3 + ty * 5) % 4 === 0) R2(px + 6, py + 8, 12, 8, '#14301e');
      return true;
    },
    coldstore(R2, G, F, px, py, tx, ty, isFloor) {
      if (isFloor(tx, ty + 1)) {
        R2(px, py, T2, T2, F.th.face[0]); if (tx % 2 === 0) { R2(px, py, 1, T2, '#9aa8b8'); R2(px + 1, py, 1, T2, '#eef4fa'); } R2(px, py, T2, 3, '#7a8898');
        for (let i = 0; i < 10; i++) R2(px + ((tx * 7 + i * 5) % 30), py + T2 - 2 - ((i * 3) % 8), 2, 1, '#ffffff');
        if (tx % 8 === 2) { R2(px + 8, py + 7, 16, 13, '#2a6ab8'); for (const [a, b, c, d] of [[16, 9, 16, 18], [11, 13, 21, 13], [12, 10, 20, 17], [20, 10, 12, 17]]) { const n = Math.max(Math.abs(c - a), Math.abs(d - b)); for (let k = 0; k <= n; k++) R2(px + a + Math.round((c - a) * k / n), py + b + Math.round((d - b) * k / n), 1, 1, '#f8f9ff'); } }
        else if (tx % 8 === 6) { R2(px + 14, py + 6, 4, 16, '#e8eef4'); R2(px + 15, py + 15, 2, 6, '#ff3047'); }
        return true;
      }
      topEdge(R2, px, py, tx, ty, isFloor, '#2a3440', ['#4a5a6a', '#8a9aac']); dots(R2, px, py, tx, ty, 8, ['#34404e', '#3e4a58'], 2, 1);
      return true;
    },
    cave(R2, G, F, px, py, tx, ty, isFloor) {
      if (isFloor(tx, ty + 1)) {
        R2(px, py, T2, T2, F.th.face[0]); for (let j = 4; j < T2; j += 7) R2(px, py + j + ((tx * 3) % 3), T2, 2, (j / 7) % 2 ? F.th.face[1] : '#2e2824');
        R2(px, py, T2, 2, '#5a5048'); R2(px + ((tx * 11) % 28), py + T2 - 6, 1, 4, '#5a7a8a');
        if ((tx * 5 + ty * 3) % 6 === 0) { const c = F.th.neon[(tx + ty) % F.th.neon.length]; G(px + 5, py + 10, 12, 1, c); G(px + 16, py + 11, 7, 1, c); G(px + 22, py + 12, 3, 1, c); }
        return true;
      }
      R2(px, py, T2, T2, '#0e0c0b'); for (let i = 0; i < 4; i++) R2(px + ((tx * 13 + i * 7) % 24), py + ((ty * 7 + i * 11) % 24), 6, 5, '#16130f');
      if (isFloor(tx - 1, ty)) R2(px, py, 3, T2, '#2a2420'); if (isFloor(tx + 1, ty)) R2(px + T2 - 3, py, 3, T2, '#2a2420'); if (isFloor(tx, ty - 1)) R2(px, py, T2, 4, '#2a2420');
      return true;
    },
  };
  const pw0 = D.paintWallX;
  D.paintWallX = function (x, ex, F, tx, ty, isFloor, rng, crack) {
    if (F.env && !crack) {
      const px = tx * T2, py = ty * T2, R2 = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); }, G = (a, b, w, h, c) => { R2(a, b, w, h, c); ex.fillStyle = c; ex.fillRect(a, b, w, h); };
      const b = inBox(F, tx, ty); if (b) { boxWall(R2, G, b, px, py, tx, ty); return true; }
      const W = WALL[F.env]; if (W && W(R2, G, F, px, py, tx, ty, isFloor, x, ex)) return true;
    }
    return pw0 ? pw0.apply(this, arguments) : false;
  };
})(D);
