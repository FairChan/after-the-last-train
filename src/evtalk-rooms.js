/* 末班之后 · 事件屋：事件站（未知信号）里演对话的九间屋 + 按场次摆的摆设。
   ev_platform 无名站台、ev_tunnel 检修隧道、ev_hall 站厅、ev_office 值班室、ev_arcade 商铺廊、ev_car 车厢里、ev_flood 积水的站台、ev_stair 楼梯间、ev_server 机房。
   场次头 @props 写要摆什么（train bench coat tent fire door pump radio court cage crates vending shelf ad tv bed pram wheelchair board bedroll pot；PLACE 里没给这间屋配位置的不画）。
   画法和 rooms.js 一样：背景 D.Paint 逐像素着色、点阵过渡，摆设 D.mkSprite 自动描黑边，光从左上来，发光的进 emit 层；
   怪物直接用站里敌人的图（D.SPR），别的工壳用机库的立绘（D.heroOf），和站里、首页是同一套画。
   设计：design/features/event-talk/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const RM = D.SROOMS = D.SROOMS || {};
  const INK = '#0b0a14', W = 640, H = 360;
  const ramp = (hex, n) => { const out = []; n = n || 6; for (let i = 0; i < n; i++) { const k = i / (n - 1); out.push(k < 0.5 ? D.mixHex(hex, INK, (0.5 - k) * 1.5) : D.mixHex(hex, '#fff1dc', (k - 0.5) * 0.9)); } return out; };
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  const pickR = (r, v, x, y) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length + bay(x, y) - 0.5)))];
  const hash = (x, y) => D.Pix.hash(x, y);
  function bg(fn) { const P = D.Paint(W, H); fn(P); return P.make(2); }
  const S = {};
  const spr = (k, w, h, fn) => S[k] || (S[k] = D.mkSprite(w, h, fn));
  const once = (base, fn) => () => base._c || (base._c = fn()); // 派生屋（每场一间）共用一份图
  // 一块地方逐像素着色：f(x, y) 给明暗（null 不画），e 是发光（布尔或 f(x, y)）
  const field = (P, x0, y0, w, h, R, f, e) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const v = f(x, y); if (v != null) P.set(x, y, pickR(R, v, x, y), typeof e === 'function' ? e(x, y) : e); } };
  // 球面着色，但只画 keep(x, y) 为真的那部分（篷子、半个罩子）
  const sph = (p, cx, cy, rx, ry, R, keep) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny; if (d > 1 || (keep && !keep(x, y))) continue; const L = -0.55 * nx - 0.65 * ny + 0.52 * Math.sqrt(1 - d); p.set(x, y, pickR(R, 0.12 + 0.88 * Math.max(0, L), x, y)); } };
  // 圆环（轮子、拉环、挂钟的框）：外圈左上亮，内圈右下亮
  const ring = (p, cx, cy, r0, r1, R) => { for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy); if (d < r0 || d > r1) continue; const L = (-dx * 0.55 - dy * 0.65) / (d || 1) * (d - r0 < (r1 - r0) / 2 ? -1 : 1); p.set(x, y, pickR(R, 0.45 + 0.38 * L, x, y)); } };
  // 招牌上的字：几道横竖，褪色、掉了几块（不是真字）
  const glyph = (P, x0, y0, w, h, seed, R, e) => {
    for (let k = 0; k < 3; k++) { if (hash(seed, k) < 0.3) continue; const y = (y0 + 2 + k * (h - 4) / 2) | 0, xa = x0 + (hash(seed, k + 10) * 4 | 0), xb = x0 + w - (hash(seed, k + 20) * 4 | 0); for (let x = xa; x < xb; x++) for (let d = 0; d < 2; d++) if (hash(x, seed * 3 + d) > 0.14) P.set(x, y + d, pickR(R, 0.6 - d * 0.18, x, y), e); }
    for (let k = 0; k < 2; k++) { if (hash(seed, k + 5) < 0.35) continue; const x = x0 + 3 + k * (w - 7) + (hash(seed, k + 30) * 3 | 0); for (let y = y0 + 1; y < y0 + h - 1; y++) for (let d = 0; d < 2; d++) if (hash(y, seed * 5 + d) > 0.14) P.set(x + d, y, pickR(R, 0.55 - d * 0.18, x, y), e); }
  };
  // 刷在墙上的楼层号（3×5 的方块字，按 sc 倍放大，漆掉了几块）
  const NUM = { B: '110101110101110', F: '111100110100100', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111' };
  const stencil = (P, x0, y0, str, sc, R) => { [...str].forEach((ch, n) => { const g = NUM[ch]; if (!g) return; for (let i = 0; i < 15; i++) if (g[i] === '1') for (let j = 0; j < sc; j++) for (let k = 0; k < sc; k++) { const x = x0 + n * (sc * 4) + (i % 3) * sc + k, y = y0 + (i / 3 | 0) * sc + j; if (hash(x, y * 7) > 0.12) P.set(x, y, pickR(R, 0.62 - j / sc * 0.2, x, y)); } }); };

  // ── 摆设：画一次，按名字取
  const PROPS = {
    bench: () => spr('ev_bench', 92, 36, p => { p.box(0, 8, 92, 8, D.RAMP.crate, { top: 2 }); p.box(0, 0, 92, 6, D.RAMP.crate, { top: 1, bias: -0.06 }); for (const x of [6, 80]) p.box(x, 16, 6, 20, D.RAMP.gunmetal); p.box(30, 10, 22, 4, D.RAMP.cloth, { r: 1, v: 0.5 }); }),
    coat: () => spr('ev_coat', 34, 14, p => { p.box(0, 4, 34, 10, ramp('#4a4038', 6), { r: 3, v: 0.55 }); p.box(4, 0, 12, 6, ramp('#4a4038', 6), { r: 2 }); p.px(24, 8, '#c8a050'); p.px(25, 8, '#e8c878'); }),
    train: () => spr('ev_train', 280, 132, p => {
      const BD = ramp('#5a6270', 7);
      p.box(0, 0, 280, 124, BD, { top: 3, r: 4, v: 0.55 }); p.box(0, 92, 280, 8, D.RAMP.red, { top: 1, v: 0.5 });
      for (let i = 0; i < 4; i++) { const x = 14 + i * 66; p.box(x, 18, 50, 40, D.RAMP.dark, { v: 0.3 }); p.grad(x + 3, 21, 44, 34, ['#3a3020', '#7a6030', '#c8a050', '#f0d890', '#fff4c0'], 1); p.rect(x + 3, 38, 44, 1, '#2d3342'); }
      p.box(244, 14, 30, 78, D.RAMP.gunmetal, { top: 2, v: 0.5 }); p.grad(248, 18, 22, 30, ['#3a3020', '#7a6030', '#c8a050', '#f0d890'], 1); // 门
      for (const x of [20, 250]) { p.ell(x, 128, 9, 5, D.RAMP.dark, {}); }
      p.rect(0, 64, 280, 1, '#2d3342'); p.rect(6, 104, 60, 4, '#e8e0c8'); // 车号牌
    }),
    tent: () => spr('ev_tent', 120, 64, p => {
      const T1 = ramp('#5a6a4a', 6), T2 = ramp('#7a5a3a', 6);
      for (let y = 0; y < 52; y++) { const half = 6 + y * 0.9; for (let x = Math.floor(40 - half); x < 40 + half; x++) p.set(x, y + 10, pickR(T1, 0.75 - 0.4 * y / 52 - (x > 40 ? 0.15 : 0), x, y)); }
      p.line(40, 10, 40, 62, '#2a3022'); p.box(34, 40, 12, 22, D.RAMP.dark, { v: 0.2 });
      for (let y = 0; y < 34; y++) { const half = 4 + y * 0.8; for (let x = Math.floor(92 - half); x < 92 + half; x++) p.set(x, y + 28, pickR(T2, 0.7 - 0.4 * y / 34 - (x > 92 ? 0.15 : 0), x, y)); }
      p.box(0, 56, 22, 8, D.RAMP.cloth, { r: 2, v: 0.5 }); p.box(102, 52, 18, 12, D.RAMP.crate, { top: 1 });
    }),
    fire: () => spr('ev_fire', 30, 16, p => { for (let i = 0; i < 5; i++) p.box(2 + i * 5, 10, 8, 4, D.RAMP.crate, { r: 1, v: 0.4 }); p.ell(15, 9, 8, 4, D.RAMP.gold || D.RAMP.yellow, { emit: true, flat: true }); }),
    door: () => spr('ev_door', 132, 142, p => {
      p.box(0, 0, 132, 142, D.RAMP.gunmetal, { top: 3, v: 0.5 }); p.box(10, 12, 112, 130, D.RAMP.steel, { top: 2, v: 0.5 });
      for (let i = 0; i < 9; i++) p.rect(14, 22 + i * 13, 104, 1, '#2d3342'); // 卷闸的缝
      for (let x = 10; x < 122; x += 2) p.set(x, 8, (x / 6 | 0) % 2 ? '#c8a020' : '#1a1610'); // 警示条
      p.box(54, 92, 24, 10, D.RAMP.dark, { v: 0.15 }); p.rect(57, 96, 18, 2, '#ffb057', 1); // 送东西的投递口，里面有光
      p.box(104, 54, 16, 22, D.RAMP.gunmetal, { r: 2 }); p.px(110, 60, '#ff3b4a', 1); p.px(111, 60, '#ff3b4a', 1); p.rect(108, 66, 8, 6, '#151a29');
    }),
    pump: () => spr('ev_pump', 150, 118, p => {
      const PB = ramp('#3a6a6a', 7);
      p.ell(54, 66, 46, 46, PB, {}); p.ell(54, 66, 20, 20, D.RAMP.gunmetal, {}); p.ell(54, 66, 6, 6, D.RAMP.steel, { spec: true });
      p.box(96, 40, 50, 70, D.RAMP.gunmetal, { top: 2, r: 2 }); p.box(102, 48, 38, 18, D.RAMP.dark, { v: 0.2 }); p.rect(105, 52, 20, 2, '#8dff6a', 1); p.rect(105, 57, 12, 2, '#ffb057', 1);
      p.box(0, 104, 150, 14, D.RAMP.rust, { top: 1, v: 0.45 }); p.box(10, 10, 14, 40, D.RAMP.rust, { r: 2 }); p.box(0, 0, 40, 14, D.RAMP.rust, { top: 1, r: 2 }); // 管子
      for (let i = 0; i < 4; i++) p.px(120 + i * 4, 76, i < 2 ? '#3ee8ff' : '#2d3342', i < 2);
    }),
    radio: () => spr('ev_radio', 96, 70, p => {
      p.box(0, 24, 96, 46, D.RAMP.gunmetal, { top: 2, r: 2 }); p.box(6, 30, 46, 26, D.RAMP.dark, { v: 0.15 });
      p.grad(9, 33, 40, 20, ['#0a2a18', '#14502c', '#2a8a4a', '#8dff6a'], 1);
      for (let i = 0; i < 6; i++) p.ell(64 + (i % 3) * 10, 36 + (i / 3 | 0) * 12, 3.5, 3.5, D.RAMP.steel, {});
      p.line(80, 24, 90, 0, '#949fb6'); p.px(90, 0, '#ff3b4a', 1); p.box(56, 58, 34, 6, D.RAMP.cloth, { v: 0.5 }); // 天线、话筒线
    }),
    court: () => spr('ev_court', 170, 70, p => {
      p.box(0, 20, 170, 50, ramp('#3a2e3a', 7), { top: 3, v: 0.5 }); p.box(8, 28, 154, 6, D.RAMP.red, { top: 1, v: 0.55 });
      for (let i = 0; i < 5; i++) p.box(14 + i * 32, 40, 22, 24, D.RAMP.dark, { v: 0.25 });
      p.box(70, 0, 30, 22, D.RAMP.gunmetal, { top: 2, r: 2 }); p.ell(85, 10, 8, 6, D.RAMP.glass, { emit: true }); // 记录仪
    }),
    cage: () => spr('ev_cage', 120, 86, p => {
      for (const x0 of [0, 62]) { p.box(x0, 0, 56, 8, D.RAMP.rust, { top: 1 }); p.box(x0, 78, 56, 8, D.RAMP.rust, { top: 1 }); for (let x = x0 + 2; x < x0 + 56; x += 9) p.box(x, 8, 3, 70, D.RAMP.gunmetal, { v: 0.5 }); }
      p.ell(28, 52, 12, 14, D.RAMP.steel, { bias: -0.2 }); p.px(25, 46, '#3ee8ff', 1); p.px(31, 46, '#3ee8ff', 1); // 关着的工壳，眼睛还亮
      p.ell(90, 58, 12, 10, D.RAMP.yellow, { bias: -0.25 }); p.px(88, 54, '#2d3342'); p.px(93, 54, '#2d3342');
    }),
    crates: () => spr('ev_crates', 100, 60, p => { p.box(0, 20, 56, 40, D.RAMP.gunmetal, { top: 2 }); p.box(6, 28, 44, 4, D.RAMP.yellow, { v: 0.5 }); p.box(54, 30, 46, 30, D.RAMP.gunmetal, { top: 2, bias: -0.08 }); p.box(12, 0, 38, 22, D.RAMP.crate, { top: 2 }); p.rect(60, 40, 30, 2, '#c8cdda'); }),
    // ── 新摆设（2026-11-17）：人大约 35 像素高（画板像素），按这个比例画
    // 自动售货机：玻璃后面三列罐子，只有一格还亮着
    vending: () => spr('ev_vending', 34, 56, p => {
      const GD = [D.RAMP.blue, D.RAMP.green, D.RAMP.yellow, D.RAMP.red, D.RAMP.white], LIT = ['#3a3020', '#7a6030', '#c8a050', '#f0d890', '#fff4c0'];
      p.box(0, 0, 34, 56, ramp('#6a2a30', 7), { top: 2, r: 2, v: 0.55 });
      p.box(2, 2, 30, 4, ramp('#b8b0a0', 6), { top: 1, v: 0.4 }); // 顶上的牌子，灭了
      p.box(3, 8, 21, 34, D.RAMP.dark, { v: 0.18 });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const x = 4 + c * 7, y = 9 + r * 8, on = r === 1 && c === 1;
        if (on) p.grad(x, y, 6, 7, LIT, 1);
        if (on || hash(r * 7 + c, 31) > 0.3) p.box(x + 1, y + 2, 4, 5, GD[(r * 3 + c) % 5], { r: 1, v: on ? 0.85 : 0.3 });
        p.rect(x, y + 7, 7, 1, '#2d3342');
      }
      for (let i = 0; i < 10; i++) p.px(21 - i * 1.3, 9 + i * 3, '#3d4766'); // 玻璃上一道反光
      p.box(26, 9, 6, 18, D.RAMP.gunmetal, { r: 1 }); p.rect(28, 11, 2, 1, '#101218'); for (let i = 0; i < 3; i++) p.rect(28, 14 + i * 3, 2, 2, '#646e86'); p.px(29, 24, '#8dff6a', 1);
      p.box(4, 45, 20, 7, D.RAMP.dark, { v: 0.12 }); // 取货口
      p.box(0, 53, 34, 3, D.RAMP.gunmetal, { top: 1 });
      for (let i = 0; i < 8; i++) p.px(2 + hash(i, 33) * 30, 28 + hash(i, 34) * 24, '#3b2018'); // 锈点
    }),
    // 货架：三层，上面剩几罐、几个纸箱，底层空了
    shelf: () => spr('ev_shelf', 56, 50, p => {
      for (const x of [0, 53]) p.box(x, 0, 3, 50, D.RAMP.gunmetal, { top: 1, v: 0.55 });
      for (let i = 0; i < 4; i++) if (i !== 2) p.box(5 + i * 6, 10 - (i % 2) * 2, 5, 8 + (i % 2) * 2, i % 2 ? D.RAMP.red : D.RAMP.silver, { r: 1, v: 0.42 });
      p.box(16, 14, 8, 4, D.RAMP.silver, { r: 1, v: 0.36 }); p.box(36, 7, 13, 11, D.RAMP.crate, { top: 1 }); // 倒了的一罐
      p.box(5, 23, 18, 11, D.RAMP.crate, { top: 1, v: 0.5 }); p.rect(5, 28, 18, 1, '#432a16'); p.box(26, 26, 11, 8, D.RAMP.crate, { top: 1, bias: -0.08 }); p.box(40, 22, 9, 12, D.RAMP.white, { r: 1, v: 0.32 });
      p.box(8, 39, 3, 8, D.RAMP.glass, { r: 1, v: 0.5 }); p.box(22, 44, 12, 3, D.RAMP.cloth, { r: 1, v: 0.4 });
      for (const y of [3, 18, 34, 47]) p.box(0, y, 56, 3, D.RAMP.steel, { top: 1, v: 0.42 });
    }),
    // 灯箱广告：上半截还亮（一张淡了的笑脸、一瓶饮料），下面那根灯管坏了
    ad: () => spr('ev_ad', 40, 56, p => {
      const SK = ramp('#4a7478', 6), FC = ramp('#b89880', 6), HR = ramp('#3a2a2a', 5), RD = ramp('#7a3434', 6), BT = ramp('#3a6a4a', 6);
      p.box(0, 0, 40, 44, D.RAMP.gunmetal, { top: 2, r: 1, v: 0.5 });
      for (let y = 3; y < 41; y++) for (let x = 3; x < 37; x++) {
        const up = y < 27, d = Math.hypot((x - 14) / 7, (y - 15) / 8), hd = Math.hypot((x - 14) / 8, (y - 11) / 7), bt = (x >= 25 && x < 31 && y >= 12 && y < 25) || (x >= 27 && x < 29 && y >= 8 && y < 12);
        let R = SK, v = 0.56 - y / 90;
        if (hd < 1 && y < 13) { R = HR; v = 0.45 - hd * 0.3; }
        if (d < 1) { R = FC; v = 0.68 - d * 0.35 - (x > 17 ? 0.1 : 0); }
        if (bt) { R = BT; v = 0.66 - (x - 25) * 0.07; }
        if (y > 30 && y < 35 && x > 5 && x < 35) { R = RD; v = 0.5; }
        if (!up) v -= 0.3;
        p.set(x, y, pickR(R, v, x, y), up);
      }
      p.px(12, 14, '#2a2228', 1); p.px(16, 14, '#2a2228', 1); for (const x of [13, 14, 15]) p.px(x, 18, '#6a3030', 1);
      for (let i = 0; i < 5; i++) p.rect(8 + i * 5, 32, 3, 2, '#8a7a6a');
      p.line(20, 4, 24, 14, '#1d212c'); p.line(24, 14, 22, 20, '#1d212c'); // 裂了一道
      for (const x of [4, 33]) p.box(x, 44, 3, 10, D.RAMP.gunmetal, { v: 0.45 }); p.box(1, 53, 9, 3, D.RAMP.gunmetal, { top: 1 }); p.box(30, 53, 9, 3, D.RAMP.gunmetal, { top: 1 });
    }),
    // 旧电视：大屁股，雪花屏，垫在木箱上，两根天线
    tv: () => spr('ev_tv', 32, 38, p => {
      const Y = 6, TB = ramp('#5a5248', 7);
      p.line(13, Y, 7, 0, '#949fb6'); p.line(16, Y, 24, 1, '#949fb6');
      p.box(3, Y + 21, 26, 11, D.RAMP.crate, { top: 2, v: 0.5 }); p.rect(3, Y + 26, 26, 1, '#432a16');
      p.box(1, Y, 30, 22, TB, { top: 2, r: 3, v: 0.55 });
      p.box(3, Y + 2, 20, 17, D.RAMP.dark, { r: 2, v: 0.2 });
      for (let y = Y + 3; y < Y + 18; y++) for (let x = 4; x < 22; x++) { const e = (x - 13) ** 2 / 85 + (y - Y - 10.5) ** 2 / 60; if (e > 1) continue; p.set(x, y, pickR(['#1a1f2a', '#2a3242', '#434d62', '#6a7488', '#9aa4b8'], 0.12 + hash(x * 3, y * 5) * 0.7 - e * 0.3, x, y), 1); }
      p.ell(26.5, Y + 5, 1.8, 1.8, D.RAMP.steel, {}); p.ell(26.5, Y + 10, 1.8, 1.8, D.RAMP.steel, {}); for (let i = 0; i < 3; i++) p.rect(24, Y + 14 + i * 2, 5, 1, '#1d212c');
    }),
    // 行军床：帆布中间塌下去，枕头、叠好的毯子
    bed: () => spr('ev_bed', 70, 20, p => {
      const CV = ramp('#4a5a3a', 7);
      for (const x of [5, 57]) { p.line(x, 8, x + 7, 19, '#434b5f'); p.line(x + 7, 8, x, 19, '#646e86'); p.line(x + 1, 8, x + 8, 19, '#2d3342'); }
      p.box(0, 6, 70, 3, D.RAMP.gunmetal, { top: 1 });
      for (let x = 1; x < 69; x++) { const sg = Math.round(Math.sin((x - 1) / 68 * Math.PI) * 2); for (let y = 2 + sg; y < 7 + sg; y++) p.set(x, y, pickR(CV, 0.62 - (y - 2 - sg) * 0.09 + (x < 8 ? 0.08 : 0), x, y)); }
      p.ell(9, 3, 7, 3, ramp('#b0a898', 6), {});
      p.box(40, 0, 24, 6, ramp('#5a4a6a', 6), { r: 2, v: 0.55 }); p.rect(42, 2, 20, 1, '#3a2e48');
    }),
    // 婴儿车：篷子、车斗里露出一角粉毛线毯，空的
    pram: () => spr('ev_pram', 30, 30, p => {
      const HD = ramp('#2e3a5a', 7), BD = ramp('#3a4a6a', 7);
      p.line(25, 2, 21, 13, '#646e86'); p.line(26, 2, 22, 13, '#434b5f'); p.box(23, 0, 6, 3, D.RAMP.dark, { r: 1 }); // 把手
      p.line(7, 19, 6, 25, '#434b5f'); p.line(21, 19, 22, 25, '#434b5f');
      sph(p, 10, 15, 9, 10, HD, (x, y) => y < 15 && x < 18); // 篷子
      for (let i = 1; i < 4; i++) p.line(10, 15, 10 + Math.cos(Math.PI + i * 0.4) * 9, 15 + Math.sin(Math.PI + i * 0.4) * 10, '#1d2438');
      p.box(13, 9, 8, 4, ramp('#a87a80', 6), { r: 2, v: 0.55 });
      p.box(3, 12, 22, 9, BD, { r: 4, v: 0.55 }); p.rect(5, 15, 18, 1, '#232a42');
      for (const x of [6, 22]) { p.ell(x, 26, 4, 4, D.RAMP.dark, {}); p.ell(x, 26, 1.5, 1.5, D.RAMP.steel, { spec: true }); }
    }),
    // 轮椅：大轮子在前面，座上搭着一条围巾
    wheelchair: () => spr('ev_wheelchair', 30, 30, p => {
      const SE = ramp('#3a3a44', 6);
      p.line(4, 1, 6, 14, '#646e86'); p.line(5, 1, 7, 14, '#434b5f'); p.box(2, 0, 5, 2, D.RAMP.dark, {});
      p.box(5, 3, 4, 12, SE, { r: 1, v: 0.5 }); p.box(6, 13, 16, 3, SE, { r: 1, v: 0.55 }); p.box(9, 9, 6, 5, ramp('#6a4a3a', 6), { r: 1, v: 0.6 });
      p.box(7, 9, 13, 2, D.RAMP.gunmetal, {});
      ring(p, 12, 20, 7, 9.5, D.RAMP.dark); ring(p, 12, 20, 5.5, 7, D.RAMP.steel);
      for (let i = 0; i < 6; i++) p.line(12, 20, 12 + Math.cos(i * 1.047) * 5.5, 20 + Math.sin(i * 1.047) * 5.5, '#434b5f');
      p.ell(12, 20, 1.5, 1.5, D.RAMP.steel, { spec: true });
      p.line(21, 15, 25, 24, '#646e86'); p.box(23, 24, 6, 2, D.RAMP.gunmetal, {}); p.ell(25, 27.5, 2, 2, D.RAMP.dark, {});
    }),
    // 留言板：软木板贴满纸条，寻人的、换东西的、一张照片
    board: () => spr('ev_board', 50, 50, p => {
      const CK = ramp('#7a5a34', 6), PAP = [ramp('#c8c0a8', 6), ramp('#c8b880', 6), ramp('#b89a98', 6), ramp('#98a8b8', 6), ramp('#d8d0c0', 6)];
      for (const x of [4, 43]) p.box(x, 34, 3, 16, D.RAMP.crate, { top: 1, v: 0.45 });
      p.box(0, 0, 50, 37, D.RAMP.crate, { top: 2, r: 1, v: 0.5 });
      for (let y = 3; y < 34; y++) for (let x = 3; x < 47; x++) p.set(x, y, pickR(CK, 0.46 - y / 200 + (hash(x, y) - 0.5) * 0.2, x, y));
      for (let i = 0; i < 20; i++) {
        const w = 6 + (hash(i, 41) * 5 | 0), h = 5 + (hash(i, 42) * 5 | 0), x = 3 + (hash(i, 43) * (44 - w) | 0), y = 3 + (hash(i, 44) * (31 - h) | 0);
        p.box(x, y, w, h, PAP[i % 5], { top: 0, v: 0.6 - hash(i, 45) * 0.18 });
        for (let k = 0; k < (h - 2) / 2; k++) p.rect(x + 1, y + 2 + k * 2, Math.max(1, w - 2 - (hash(i, k) * 3 | 0)), 1, '#5a5448');
        p.px(x + (w >> 1), y, hash(i, 46) > 0.5 ? '#c82e3a' : '#3466c0');
      }
      p.box(20, 11, 8, 10, ramp('#d8d0c0', 6), { top: 0, v: 0.6 }); p.box(21, 12, 6, 6, D.RAMP.dark, { v: 0.35 }); p.ell(24, 15, 1.5, 2, ramp('#c99a72', 6), {}); p.px(24, 11, '#c82e3a');
    }),
    // 铺盖卷：捆了两道绳
    bedroll: () => spr('ev_bedroll', 34, 12, p => {
      p.box(4, 1, 30, 11, ramp('#5a4a3a', 7), { r: 5, v: 0.6 });
      p.ell(5, 6.5, 4, 5.5, ramp('#8a7a5a', 6), {});
      for (let a = 0; a < 10; a += 0.3) { const r = a * 0.4; p.px(5 + Math.cos(a) * r * 0.7, 6.5 + Math.sin(a) * r, '#3a2e22'); }
      for (const x of [13, 25]) p.box(x, 0, 2, 12, ramp('#2e2a24', 5), { v: 0.45 });
      p.px(13, 6, '#c8a050'); p.px(25, 6, '#c8a050');
    }),
    // 架在砖上的锅：底下一点炭火，锅熏黑了
    pot: () => spr('ev_pot', 26, 22, p => {
      const BK = ramp('#7a3a2a', 6);
      p.ell(13, 19, 5, 2, ramp('#c8402a', 6), { emit: true, flat: true }); p.px(11, 20, '#3b2018'); p.px(15, 20, '#20263b');
      for (const x0 of [0, 17]) for (let k = 0; k < 2; k++) p.box(x0 + (k % 2), 17 - k * 5, 8, 5, BK, { top: 1, v: 0.55 - k * 0.05 });
      p.box(4, 3, 18, 9, D.RAMP.gunmetal, { r: 2, v: 0.5 }); p.box(3, 2, 20, 2, D.RAMP.steel, { top: 1, v: 0.45 });
      p.box(1, 4, 3, 2, D.RAMP.gunmetal, {}); p.box(22, 4, 3, 2, D.RAMP.gunmetal, {});
      p.ell(13, 2, 7, 1.6, D.RAMP.gunmetal, {}); p.box(12, 0, 3, 1, D.RAMP.crate, {});
      for (let i = 0; i < 8; i++) p.px(5 + hash(i, 47) * 16, 8 + hash(i, 48) * 3, '#101218'); // 熏黑的
    }),
  };
  // 每间屋里每样摆设放在哪（世界坐标，脚底中点）；发光的摆设也贴一份到 emit 层
  const PLACE = {
    ev_platform: { train: [222, 140], bench: [238, 152], coat: [238, 138], vending: [110, 152], ad: [260, 152], board: [266, 152], bedroll: [252, 152], pram: [226, 152], wheelchair: [226, 152], pot: [216, 152], bed: [246, 152] },
    ev_tunnel: { pump: [250, 152], radio: [234, 152], crates: [256, 152], bedroll: [226, 152], pot: [214, 152], bed: [244, 152], shelf: [262, 152], tv: [234, 152], wheelchair: [224, 152] },
    ev_hall: { tent: [250, 152], fire: [214, 152], door: [246, 152], court: [240, 140], cage: [250, 152], crates: [256, 152], bench: [250, 152], vending: [112, 152], ad: [262, 152], board: [268, 152], tv: [232, 152], bed: [246, 152], pram: [226, 152], wheelchair: [224, 152], bedroll: [256, 152], pot: [212, 152], shelf: [262, 152] },
    ev_office: { crates: [256, 152], radio: [234, 152], tv: [234, 152], board: [106, 152], bed: [246, 152], shelf: [262, 152], pot: [214, 152], bedroll: [254, 152], coat: [226, 152], wheelchair: [224, 152] },
    ev_arcade: { vending: [112, 152], shelf: [262, 152], ad: [258, 152], crates: [256, 152], tent: [250, 152], fire: [214, 152], board: [268, 152], pram: [226, 152], bench: [238, 152], bedroll: [254, 152], pot: [214, 152], tv: [234, 152] },
    ev_car: { bedroll: [236, 126], coat: [222, 126], crates: [256, 152], pram: [226, 152], wheelchair: [226, 152], radio: [236, 152], pot: [214, 152] },
    ev_flood: { crates: [256, 152], pump: [250, 152], radio: [234, 152], bedroll: [254, 152], pram: [226, 152], wheelchair: [226, 152], ad: [262, 152], bench: [238, 152] },
    ev_stair: { wheelchair: [226, 152], pram: [226, 152], bedroll: [250, 152], crates: [256, 152], board: [106, 152], pot: [214, 152], fire: [214, 152], radio: [234, 152], tent: [250, 152] },
    ev_server: { crates: [256, 152], radio: [234, 152], tv: [232, 152], shelf: [262, 152], bed: [246, 152], bedroll: [254, 152], wheelchair: [224, 152], cage: [250, 152] },
  };
  // 会发光的摆设往屋里打一点光：[离脚底多高, 半径, 颜色, 亮度]（屋子的 lights() 里调 plights）
  const PLT = { vending: [-19, 70, '#f0d890', 0.45], tv: [-12, 56, '#b8c8ff', 0.45], ad: [-20, 80, '#c8e8d8', 0.4], pot: [-3, 46, '#ff8a3a', 0.55] };
  function plights(room, L, t) {
    const at = PLACE[room.base] || {};
    for (const k of room.props || []) {
      const q = PLT[k]; if (!q || !at[k]) continue;
      let a = q[3]; if (k === 'tv') a *= 0.7 + 0.3 * Math.abs(Math.sin(t * 23)); if (k === 'pot') a *= 0.85 + Math.sin(t * 11) * 0.1; if (k === 'ad' && adOff(t)) a *= 0.3;
      L(at[k][0] * 2, (at[k][1] + q[0]) * 2, q[1], q[2], a);
    }
  }
  const adOff = t => Math.sin(t * 5.3) + Math.sin(t * 1.9) > 1.75;
  function props(ctx, ex, room, t) {
    const at = PLACE[room.base] || {};
    for (const k of room.props || []) {
      if (!PROPS[k] || !at[k]) continue;
      const s = PROPS[k](), [x, y] = at[k];
      D.blit(ctx, s, x, y); if (s.emit) D.blit(ex, s, x, y, false, 'emit');
      if (k === 'fire') for (let i = 0; i < 12; i++) { const q = (t * 0.9 + i / 12) % 1, fx = x + Math.sin(i * 2.3 + t * 3) * 3 * (1 - q), fy = y - 6 - q * 14; ex.fillStyle = q < 0.3 ? '#fff0b0' : q < 0.6 ? '#ffb057' : '#c8402a'; ex.fillRect(Math.round(fx * 2) / 2, Math.round(fy * 2) / 2, q < 0.5 ? 1 : 0.5, q < 0.5 ? 1 : 0.5); }
      if (k === 'tv') { const L0 = x - s.w / 4, T0 = y - s.h / 2, f = Math.floor(t * 24); for (let i = 0; i < 24; i++) { const h = hash(i, f); ex.fillStyle = h > 0.5 ? '#e8eeff' : '#8a94a8'; ex.fillRect(Math.round((L0 + 2.5 + hash(i * 3, f + 7) * 8) * 2) / 2, Math.round((T0 + 5 + h * 6.5) * 2) / 2, 0.5, 0.5); } ex.globalAlpha = 0.25; ex.fillStyle = '#d8e0f0'; ex.fillRect(L0 + 2.5, T0 + 5 + ((t * 0.6) % 1) * 6.5, 8, 0.5); ex.globalAlpha = 1; }
      if (k === 'pot') { for (let i = 0; i < 8; i++) { const q = (t * 0.35 + i / 8) % 1; ex.globalAlpha = 0.2 * (1 - q); ex.fillStyle = '#c8ccd8'; ex.fillRect(x - 3 + (i % 3) * 2.5 + Math.sin(i * 1.7 + t * 1.5) * 2.5 * q, y - 11 - q * 12, 0.5, 0.5); } ex.globalAlpha = 1; if (Math.sin(t * 9) > 0.3) { ex.fillStyle = '#ffd27a'; ex.fillRect(x - 1 + Math.sin(t * 5) * 1.5, y - 2, 0.5, 0.5); } }
      if (k === 'ad' && adOff(t)) ex.clearRect(x - s.w / 4 + 1.5, y - s.h / 2 + 1.5, s.w / 2 - 3, 12); // 上面那根灯管也闪一下
      if (k === 'radio') { const on = Math.sin(t * 6) > 0; ex.fillStyle = on ? '#8dff6a' : '#2a8a4a'; for (let i = 0; i < 18; i++) ex.fillRect(x - 43 + i, y - 30 + Math.round(Math.sin(t * 9 + i * 0.8) * 3 * (on ? 1 : 0.3)) / 2, 0.5, 0.5); }
    }
  }
  // 场上的怪物、别人的工壳：画在人前面（actors 之前），顺便把说话的点放到头顶
  function creatures(ctx, ex, t) {
    const c = D.Scene && D.Scene.cur; if (!c) return;
    for (const k in c.actors) {
      const a = c.actors[k]; if (!a.ev || a.hidden) continue;
      if (a.ev === 'mon') {
        const sp = D.SPR && D.SPR[a.mon]; if (!sp) continue;
        const k = a.size || 1, h = sp.h / (sp.res || 1) * k, bob = Math.round(Math.sin(t * 2 + a.fy) * 0.5) / 2, flip = (a.face || -1) < 0; // 站里的敌人图，按整数倍放大（剧情屋里人物比站里大）
        ctx.fillStyle = 'rgba(5,4,12,0.5)'; ctx.beginPath(); ctx.ellipse(a.x, a.fy - 0.5, 4 + 4 * k, 1.5 + k, 0, 0, Math.PI * 2); ctx.fill();
        for (const g of [ctx, ex]) {
          g.save(); g.translate(a.x, a.fy + bob); g.scale(k, k);
          if (g === ctx) D.blit(g, sp, 0, 0, flip); else { g.globalAlpha = 0.14; D.blit(g, sp, 0, 0, flip); g.globalAlpha = 1; if (sp.emit) D.blit(g, sp, 0, 0, flip, 'emit'); }
          g.restore();
        }
        a.y = a.fy - h + 2;
      } else if (a.ev === 'shell' || a.ev === 'wreck') {
        const Hh = D.heroOf ? D.heroOf(a.mon || 'worker', null, ['idle6']) : null, ok = Hh && Hh.ready && Hh.meta && Hh.meta.idle6;
        ctx.fillStyle = 'rgba(5,4,12,0.5)'; ctx.beginPath(); ctx.ellipse(a.x, a.fy - 0.5, a.ev === 'wreck' ? 12 : 7, 2, 0, 0, Math.PI * 2); ctx.fill();
        if (ok) {
          const list = Hh.meta.idle6, s = a.ev === 'wreck' ? list[0] : list[Math.floor(t * 6) % list.length];
          for (const g of [ctx, ex]) {
            g.save(); g.translate(a.x, a.fy);
            if (a.ev === 'wreck') { g.translate(10, -3); g.rotate(-Math.PI / 2); } else g.scale(-1, 1); // 倒在地上的 / 面朝你站着的
            if (g === ex) g.globalAlpha = 0.14;
            D.heroBlit(g, g === ctx ? Hh.img : (Hh.emit || Hh.img), Hh, s, 0, 0); g.restore();
          }
        } else if (D.SPR && D.SPR.body) { D.blit(ctx, D.SPR.body, a.x, a.fy - 2); D.blit(ctx, D.SPR.head, a.x, a.fy - 11); }
        if (a.ev === 'wreck') { if (Math.sin(t * 7) > 0.8) { ex.fillStyle = '#ffe08a'; ex.fillRect(a.x + 6 + Math.sin(t * 40) * 2, a.fy - 6, 0.5, 0.5); } a.y = a.fy - 2; }
        else a.y = a.fy - 22;
      } else a.y = a.fy; // 只有声音（广播、通话）：话从那里冒出来
    }
  }

  // ── 无名站台：白瓷砖墙（发黄、掉了几块）、刮花的站名牌、熄灭的线路图、一盏应急灯，站台黄线，前面是轨道
  RM.ev_platform = {
    base: 'ev_platform', name: '站台', ambient: '#2c2a34', amb: 'drip', view: { y: 66 }, actors: { op: { x: 140, y: 152, face: 1 } },
    build: null,
    draw(ctx, ex, t, st) { const C = st.cache; D.blitBG(ctx, ex, C.bg); props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors(); },
    lights(t, st) { const L = st.light, f = Math.sin(t * 11) > 0.92 ? 0.5 : 1; L(300, 140, 170 * f, '#ffb057', 0.7 * f); L(280, 270, 120, '#ffb057', 0.35 * f); L(470, 230, 220, '#7a9ab8', 0.5); if ((this.props || []).includes('train')) L(440, 200, 240, '#f0d890', 0.55); plights(this, L, t); },
  };
  RM.ev_platform.build = once(RM.ev_platform, () => {
    const C = {}, TL = ramp('#8a8678', 7), PL = ramp('#3a3630', 6);
    C.bg = bg(P => {
      for (let y = 0; y < 272; y++) for (let x = 0; x < W; x++) {
        const tx = x / 16 | 0, ty = y / 12 | 0, grout = x % 16 === 0 || y % 12 === 0, miss = hash(tx, ty) > 0.93;
        let v = 0.42 + 0.2 * y / 272 + (hash(tx * 3, ty) - 0.5) * 0.08 - (grout ? 0.14 : 0) - (miss ? 0.2 : 0) - Math.max(0, (y - 200) / 72) * 0.12;
        P.set(x, y, pickR(miss ? ramp('#4a4038', 6) : TL, v, x, y));
      }
      for (let x = 0; x < W; x++) for (let y = 0; y < 30; y++) P.set(x, y, pickR(ramp('#2a2830', 6), 0.25 + y / 120, x, y)); // 顶上的暗
      for (let y = 272; y < 316; y++) for (let x = 0; x < W; x++) P.set(x, y, pickR(PL, 0.52 - 0.25 * (y - 272) / 44, x, y));
      for (let x = 0; x < W; x += 2) P.set(x, 310, (x / 8 | 0) % 2 ? '#c8a020' : '#6a5410');
      for (let y = 316; y < H; y++) for (let x = 0; x < W; x++) P.set(x, y, pickR(['#08080c', '#101016', '#1a1a22'], 0.3 + (y === 330 || y === 346 ? 0.6 : 0), x, y));
      for (const x of [40, 420]) P.box(x, 0, 30, 272, D.RAMP.dark, { top: 0, v: 0.6 }); // 柱子
      P.box(120, 90, 150, 30, ramp('#2a4a6a', 6), { top: 2, r: 2 }); // 站名牌：字刮掉了
      for (let i = 0; i < 5; i++) P.rect(140 + i * 24, 102, 14, 6, i === 2 ? '#1d3048' : '#c8d0d8');
      P.line(150, 96, 230, 116, '#1a2a3a'); P.line(152, 96, 232, 116, '#1a2a3a');
      P.box(300, 130, 100, 60, D.RAMP.gunmetal, { top: 2 }); P.box(306, 136, 88, 48, D.RAMP.dark, { v: 0.2 }); // 熄灭的线路图
      for (let i = 0; i < 6; i++) P.line(312, 150 + i * 5, 388, 146 + i * 6, i === 3 ? '#5a2a2a' : '#26303e');
      P.box(290, 128, 20, 12, D.RAMP.gunmetal, { r: 2 }); P.ell(300, 140, 7, 4, D.RAMP.yellow, { emit: true, flat: true }); // 应急灯
    });
    return C;
  });

  // ── 检修隧道：拱顶的混凝土、一圈圈肋、电缆槽、铁轨、积水；红色作业灯
  RM.ev_tunnel = {
    base: 'ev_tunnel', name: '检修隧道', ambient: '#2a2630', amb: 'wind', view: { y: 66 }, actors: { op: { x: 140, y: 152, face: 1 } },
    build: null,
    draw(ctx, ex, t, st) { const C = st.cache; D.blitBG(ctx, ex, C.bg); props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors(); },
    lights(t, st) { const L = st.light, f = 0.88 + Math.sin(t * 3) * 0.08; L(260, 160, 200 * f, '#ff5a40', 0.75); L(500, 160, 180, '#ff5a40', 0.6 * f); L(400, 290, 280, '#6a7a9a', 0.45); if ((this.props || []).includes('radio')) L(440, 250, 110, '#8dff6a', 0.55); plights(this, L, t); },
  };
  RM.ev_tunnel.build = once(RM.ev_tunnel, () => {
    const C = {}, CN = ramp('#4a4a48', 7), FL = ramp('#2a2824', 6);
    C.bg = bg(P => {
      for (let y = 0; y < 300; y++) for (let x = 0; x < W; x++) {
        const arch = Math.max(0, 1 - y / 120), rib = x % 96 < 8, v = 0.34 + 0.25 * (y / 300) - arch * 0.15 + (rib ? 0.12 : 0) + (hash(x >> 2, y >> 3) - 0.5) * 0.08 - (x % 96 === 8 ? 0.1 : 0);
        P.set(x, y, pickR(CN, v, x, y));
      }
      for (let y = 0; y < 60; y++) for (let x = 0; x < W; x++) if (y < 60 - Math.sqrt(Math.max(0, 3600 - ((x % 320) - 160) ** 2 / 7))) P.set(x, y, '#0a090e'); // 拱顶外面的黑
      for (let k = 0; k < 3; k++) { const y = 120 + k * 10; P.box(0, y, W, 5, D.RAMP.gunmetal, { top: 1, v: 0.45 }); for (let x = 0; x < W; x += 3) if (hash(x, k) > 0.6) P.set(x, y + 6, k === 1 ? '#5a2a20' : '#1a1a22'); } // 电缆槽
      for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) { let v = 0.42 - 0.22 * (y - 300) / 60; if (y === 300) v = 0.7; if ((x + (y - 300) * 2) % 28 < 3) v -= 0.12; P.set(x, y, pickR(FL, v, x, y)); }
      for (const y of [318, 342]) { P.rect(0, y, W, 2, '#8a8c96'); P.rect(0, y + 2, W, 1, '#2a2c36'); } // 铁轨
      for (let i = 0; i < 4; i++) { const cx = 80 + i * 170, w = 30 + (i % 2) * 20; for (let x = cx - w; x < cx + w; x++) P.set(x, 328 + (i % 2) * 6, (x & 3) ? '#2a3a4a' : '#5a7a9a'); } // 积水反光
      for (const x of [260, 500]) { P.box(x - 8, 136, 16, 10, D.RAMP.gunmetal, { r: 2 }); P.ell(x, 150, 6, 4, D.RAMP.red, { emit: true }); }
    });
    return C;
  });

  // ── 站厅：售票机一排、闸机、贴满纸的柱子；天花板塌了一块，漏下来一点灰光
  RM.ev_hall = {
    base: 'ev_hall', name: '站厅', ambient: '#2e2a36', amb: 'drip', view: { y: 66 }, actors: { op: { x: 140, y: 152, face: 1 } },
    build: null,
    draw(ctx, ex, t, st) {
      const C = st.cache; D.blitBG(ctx, ex, C.bg);
      ex.globalAlpha = 0.04 + Math.sin(t * 0.7) * 0.015; ex.fillStyle = '#a8b4c8'; for (let i = 0; i < 6; i++) ex.fillRect(186 + i * 6 + Math.sin(t + i) * 2, 0, 3, 150); ex.globalAlpha = 1; // 光柱里的灰
      for (let i = 0; i < 10; i++) { const q = (t * 0.05 + i / 10) % 1; ex.fillStyle = '#d8e0f0'; ex.fillRect(190 + Math.sin(i * 5 + t * 0.6) * 14, q * 150, 0.5, 0.5); }
      props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors();
    },
    lights(t, st) { const L = st.light, pr = this.props || []; L(400, 160, 230, '#a8b4c8', 0.45); L(290, 270, 150, '#c8b8a0', 0.4); if (pr.includes('fire') || pr.includes('tent')) { const f = 0.8 + Math.sin(t * 13) * 0.08; L(428, 290, 190 * f, '#ff8a3a', 0.85 * f); } if (pr.includes('court')) L(480, 230, 200, '#ff3b4a', 0.65); if (pr.includes('door')) L(492, 296, 50, '#ffb057', 0.6); plights(this, L, t); },
  };
  RM.ev_hall.build = once(RM.ev_hall, () => {
    const C = {}, WL = ramp('#4a4450', 7), FL = ramp('#3a3640', 6);
    C.bg = bg(P => {
      for (let y = 0; y < 300; y++) for (let x = 0; x < W; x++) { const v = 0.4 + 0.2 * y / 300 + (hash(x >> 3, y >> 4) - 0.5) * 0.08 - (y % 80 === 0 ? 0.15 : 0); P.set(x, y, pickR(WL, v, x, y)); }
      for (let y = 0; y < 300; y++) for (let x = 360; x < 440; x++) { const k = 1 - Math.abs(x - 400) / 40; if (k > 0) P.set(x, y, pickR(ramp('#7a8494', 6), 0.3 + k * 0.4 - y / 900, x, y)); } // 塌下来的那块透进来的光
      for (let x = 340; x < 460; x++) for (let y = 0; y < 18 + hash(x >> 2, 1) * 14; y++) P.set(x, y, '#0a090e'); // 天花板的破口
      for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) { let v = 0.45 - 0.22 * (y - 300) / 60; if (x % 40 === 0 || (y - 300) % 16 === 0) v -= 0.12; if (y === 300) v = 0.7; P.set(x, y, pickR(FL, v, x, y)); }
      for (let i = 0; i < 3; i++) { const x = 30 + i * 52; P.box(x, 190, 40, 110, D.RAMP.gunmetal, { top: 2, r: 2 }); P.box(x + 6, 200, 28, 20, D.RAMP.dark, { v: 0.15 }); P.box(x + 10, 236, 20, 6, D.RAMP.dark); } // 售票机
      for (let i = 0; i < 4; i++) { const x = 500 + i * 34; P.box(x, 252, 12, 48, D.RAMP.steel, { top: 2, r: 1 }); P.box(x + 12, 266, 20, 4, D.RAMP.red, { v: 0.5 }); } // 闸机
      P.box(196, 60, 26, 240, D.RAMP.dark, { top: 0, v: 0.55 }); // 柱子，贴满寻人的纸
      for (let i = 0; i < 14; i++) { const x = 198 + (hash(i, 2) * 16 | 0), y = 120 + i * 11 + (hash(i, 3) * 4 | 0); P.rect(x, y, 8, 9, hash(i, 4) > 0.5 ? '#c8c0a8' : '#a89c80'); P.rect(x + 1, y + 2, 5, 1, '#5a5448'); }
    });
    return C;
  });
  // ══ 新加的六间（2026-11-17）：镜头只看得到世界 x≈90–260、y≈72–150（画布 x 180–520、y 144–300），东西都摆在这一条里
  const mk = (base, name, ambient, amb, draw, lights) => (RM[base] = { base, name, ambient, amb, view: { y: 66 }, actors: { op: { x: 140, y: 152, face: 1 } }, build: null, draw, lights });
  const stdDraw = function (ctx, ex, t, st) { D.blitBG(ctx, ex, st.cache.bg); props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors(); };

  // ── 值班室：上白下绿的墙、两根日光灯（一根坏了偶尔闪）、铁皮桌上一台老电脑、暖水瓶、墙上的排班表和停了的钟
  const tubeA = t => !(Math.sin(t * 13) > 0.97 || Math.sin(t * 0.37) > 0.995), tubeB = t => Math.sin(t * 1.3) * Math.sin(t * 0.71) > 0.5 && Math.sin(t * 31) > -0.2;
  mk('ev_office', '值班室', '#2a2b30', 'drip', function (ctx, ex, t, st) {
    D.blitBG(ctx, ex, st.cache.bg);
    if (!tubeA(t)) ex.clearRect(100, 76, 38, 1.5);
    if (tubeB(t)) { ctx.fillStyle = '#c8d8d0'; ctx.fillRect(184, 76, 29, 1.5); ex.fillStyle = '#e0f0e8'; ex.fillRect(184, 76, 29, 1.5); }
    props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors();
  }, function (t, st) { const L = st.light; L(238, 160, 210, '#d8f0e8', tubeA(t) ? 0.6 : 0.12); if (tubeB(t)) L(398, 160, 180, '#d8f0e8', 0.5); L(351, 230, 70, '#5ac878', 0.4); L(330, 290, 200, '#8a8470', 0.25); plights(this, L, t); });
  RM.ev_office.build = once(RM.ev_office, () => {
    const C = {}, CR = ramp('#8a8470', 7), GR = ramp('#3e5a4c', 7), CE = ramp('#2e2c2a', 6), F1 = ramp('#4a3c34', 6), F2 = ramp('#34343a', 6), DS = ramp('#4a5a5a', 7), BG = ramp('#a09a84', 7), PA = ramp('#c8c0a0', 6);
    C.bg = bg(P => {
      field(P, 0, 0, W, 140, CE, (x, y) => 0.2 + y / 700 + (x % 64 === 0 ? -0.1 : 0) + (hash(x >> 4, y >> 4) - 0.5) * 0.06);
      field(P, 0, 140, W, 74, CR, (x, y) => 0.36 + 0.14 * (y - 140) / 74 + (hash(x >> 3, y >> 2) - 0.5) * 0.08 - (hash(x >> 2, 7) > 0.88 ? 0.16 * (1 - (y - 140) / 74) : 0) - (y < 146 ? 0.12 : 0)); // 上半截发黄的白墙，几道水渍
      P.box(0, 214, W, 4, ramp('#2a3a30', 5), { top: 1, v: 0.45 });
      field(P, 0, 218, W, 82, GR, (x, y) => 0.44 - 0.16 * (y - 218) / 82 + (hash(x >> 2, y >> 2) - 0.5) * 0.07 - (y > 288 ? 0.1 : 0)); // 下半截绿漆
      for (let i = 0; i < 16; i++) { const cx = hash(i, 51) * W, cy = 228 + hash(i, 52) * 54, r = 2 + hash(i, 53) * 4; field(P, cx - r | 0, cy - r | 0, r * 2 + 1 | 0, r * 2 + 1 | 0, CR, (x, y) => Math.hypot(x - cx, y - cy) < r * (0.6 + 0.4 * hash(x, y)) ? 0.4 : null); } // 掉漆
      P.box(0, 294, W, 6, ramp('#3a2a20', 5), { top: 1, v: 0.45 }); // 踢脚线
      for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) { const c = ((x / 24 | 0) + ((y - 300) / 12 | 0)) & 1; P.set(x, y, pickR(c ? F1 : F2, 0.44 - (y - 300) / 200 + (hash(x >> 2, y >> 2) - 0.5) * 0.08 - (x % 24 === 0 || (y - 300) % 12 === 0 ? 0.1 : 0), x, y)); }
      P.box(60, 170, 70, 130, ramp('#5a4230', 7), { top: 2, v: 0.5 }); P.box(76, 184, 38, 30, D.RAMP.dark, { v: 0.2 }); P.box(116, 240, 6, 4, D.RAMP.steel, { r: 1 }); // 门（镜头外）
      for (const [x0, dead] of [[196, 0], [356, 1]]) { // 两根日光灯
        P.line(x0 + 6, 138, x0 + 6, 146, '#1d212c'); P.line(x0 + 78, 138, x0 + 78, 146, '#1d212c');
        P.box(x0, 146, 84, 6, D.RAMP.gunmetal, { top: 1, v: 0.5 });
        if (!dead) P.grad(x0 + 4, 152, 76, 3, ['#7a8a86', '#b8d0c8', '#e0f0e8', '#f8fff8'], 1);
        else { P.box(x0 + 4, 152, 76, 3, ramp('#5a5e60', 5), { top: 1, v: 0.42 }); P.box(x0 + 4, 152, 7, 3, D.RAMP.dark, { v: 0.3 }); P.box(x0 + 70, 152, 10, 3, D.RAMP.dark, { v: 0.3 }); } // 两头烧黑了
      }
      // 排班表：一张格子纸，名字一列，打的勾红蓝两种，右下角撕掉一块
      P.box(212, 164, 52, 60, PA, { top: 1, v: 0.55 }); P.box(212, 164, 52, 7, ramp('#5a5448', 5), { top: 1, v: 0.5 });
      for (let r = 0; r < 8; r++) P.rect(214, 174 + r * 6, 48, 1, '#8a8470');
      for (let c = 0; c < 6; c++) P.rect(222 + c * 7, 171, 1, 51, '#8a8470');
      for (let r = 0; r < 8; r++) { P.rect(214, 176 + r * 6, 6, 2, '#3a3630'); for (let c = 0; c < 6; c++) { const h = hash(r * 9 + c, 61); if (h > 0.45 && r < 6) P.rect(224 + c * 7, 176 + r * 6, 4, 2, h > 0.85 ? '#8f1d26' : '#2a3a6a'); } }
      P.rect(211, 163, 4, 3, '#d8d0b0'); P.rect(261, 163, 4, 3, '#d8d0b0');
      for (let i = 0; i < 9; i++) for (let j = 0; j < 9 - i; j++) P.set(263 - i, 223 - j, pickR(CR, 0.48, 263 - i, 223 - j));
      P.box(272, 172, 24, 32, PA, { top: 0, v: 0.6 }); P.box(272, 172, 24, 7, D.RAMP.red, { top: 1, v: 0.5 }); for (let i = 0; i < 20; i++) P.px(275 + (i % 5) * 4, 183 + (i / 5 | 0) * 5, i === 13 ? '#c82e3a' : '#5a5448'); // 挂历
      P.ell(320, 178, 9, 9, ramp('#d8d0c0', 6), {}); ring(P, 320, 178, 8, 10.5, D.RAMP.gunmetal); P.line(320, 178, 320, 172, '#2a2830'); P.line(320, 178, 324, 180, '#2a2830'); // 停了的钟
      // 铁皮桌
      P.box(300, 252, 144, 7, DS, { top: 2, v: 0.6 }); P.box(304, 259, 6, 41, DS, { top: 0, v: 0.4 }); P.box(312, 259, 84, 22, DS, { top: 0, v: 0.3 });
      P.box(398, 259, 42, 41, DS, { top: 0, v: 0.5 }); for (let k = 0; k < 3; k++) { P.rect(400, 271 + k * 10, 38, 1, '#1d212c'); P.box(414, 264 + k * 10, 10, 3, D.RAMP.steel, { r: 1, v: 0.5 }); }
      // 老电脑：发黄的壳，屏幕上还剩几行绿字
      P.box(346, 246, 12, 6, BG, { top: 1, v: 0.4 }); P.box(328, 210, 46, 38, BG, { top: 2, r: 3, v: 0.55 }); P.box(333, 215, 34, 26, D.RAMP.dark, { r: 2, v: 0.15 });
      P.grad(336, 218, 28, 20, ['#06140c', '#0a2414', '#103820', '#1a5030'], 1);
      for (let i = 0; i < 5; i++) P.rect(338, 221 + i * 3, 6 + (hash(i, 71) * 18 | 0), 1, '#5ac878', 1); P.rect(338, 236, 2, 1, '#8dff6a', 1); P.px(368, 243, '#8dff6a', 1);
      P.box(318, 248, 40, 5, BG, { top: 1, v: 0.45 }); for (let k = 0; k < 12; k++) P.px(320 + k * 3, 250, '#6a6454');
      // 暖水瓶（红壳、印花、木塞）、搪瓷缸、一摞纸
      P.box(384, 226, 13, 26, ramp('#8a3a36', 7), { r: 3, v: 0.6 }); for (let i = 0; i < 6; i++) P.px(387 + (i % 3) * 3, 232 + (i >> 1) * 4, '#e8c8a0');
      P.box(383, 248, 15, 4, D.RAMP.silver, { top: 1, v: 0.45 }); P.box(385, 222, 11, 5, D.RAMP.silver, { top: 1, v: 0.5 }); P.ell(390.5, 221, 3.5, 2.5, D.RAMP.cloth, {});
      P.box(404, 243, 8, 9, ramp('#d8d8d0', 6), { r: 1, v: 0.55 }); P.rect(404, 243, 8, 1, '#3466c0'); P.px(412, 246, '#b3b9cf'); P.px(412, 248, '#848ca8');
      P.box(416, 248, 22, 4, PA, { top: 1, v: 0.5 });
      // 文件柜、墙上的电话
      P.box(452, 212, 42, 88, DS, { top: 2, v: 0.55 }); for (let k = 0; k < 4; k++) { P.rect(454, 233 + k * 21, 38, 1, '#1d212c'); P.box(466, 218 + k * 21, 14, 5, PA, { top: 0, v: 0.45 }); P.box(469, 225 + k * 21, 8, 2, D.RAMP.steel, {}); }
      P.box(512, 196, 16, 22, ramp('#2a2a30', 6), { r: 2, v: 0.5 }); P.box(508, 194, 6, 24, ramp('#2a2a30', 6), { r: 2, v: 0.6 }); for (let i = 0; i < 18; i++) P.px(510 + Math.sin(i * 1.2) * 1.5, 218 + i, '#1d212c');
    });
    return C;
  });

  // ── 商铺廊：一排铺面，卷帘门拉了一半，招牌灯箱都灭了（只有一个字还闪），一节玻璃柜台裂了
  const SIGN = ['#6a2a2e', '#2a4a6a', '#6a5a2a', '#2a5a4a', '#5a3a5a'], SHUT = [212, 300, 240, 226, 262];
  const signOn = t => Math.sin(t * 3.1) + Math.sin(t * 7.7) * 0.5 > -0.3 && Math.sin(t * 43) > -0.6;
  mk('ev_arcade', '商铺廊', '#28262e', 'drip', function (ctx, ex, t, st) {
    const C = st.cache; D.blitBG(ctx, ex, C.bg);
    if (!signOn(t)) ex.clearRect(C.sign[0] / 2, C.sign[1] / 2, C.sign[2] / 2, C.sign[3] / 2);
    props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors();
  }, function (t, st) { const L = st.light, s = st.cache.sign; L(s[0] + 7, 160, 90, '#ff6a8a', signOn(t) ? 0.5 : 0.05); L(452, 288, 130, '#ffb057', 0.45); L(330, 150, 260, '#7a8aa8', 0.35); L(320, 300, 220, '#6a6a7a', 0.25); plights(this, L, t); });
  RM.ev_arcade.build = once(RM.ev_arcade, () => {
    const C = {}, CE = ramp('#2a2a30', 6), TL = ramp('#4a4650', 7), FL = ramp('#3a3a42', 6), SH = ramp('#6a6e78', 7), IN = ramp('#1c1a22', 5), GL = ramp('#2a4a58', 6);
    C.bg = bg(P => {
      field(P, 0, 0, W, 140, CE, (x, y) => 0.2 + y / 800 + (y % 36 === 0 ? -0.1 : 0) + (hash(x >> 4, y >> 3) - 0.5) * 0.05);
      for (let x = 0; x < W; x++) if (hash(x >> 5, 3) > 0.6) for (let y = 100; y < 112 + hash(x >> 2, 4) * 14; y++) P.set(x, y, '#0a090e'); // 吊顶掉了几块
      P.box(0, 118, W, 7, D.RAMP.rust, { top: 1, v: 0.42 }); // 露出来的水管
      field(P, 0, 140, W, 160, TL, (x, y) => 0.38 + (hash(x >> 3, y >> 3) - 0.5) * 0.06);
      for (let i = 0; i < 5; i++) {
        const x0 = 14 + i * 124, w = 116, sl = SHUT[i], SR = ramp(SIGN[i], 6);
        P.box(x0, 142, w, 30, D.RAMP.gunmetal, { top: 2, v: 0.5 }); // 招牌灯箱
        field(P, x0 + 4, 146, w - 8, 22, SR, (x, y) => 0.42 - (y - 146) / 80 + (hash(x >> 2, i) - 0.5) * 0.06 - (hash(x >> 3, i + 9) > 0.86 ? 0.15 : 0));
        const n = 3 + (i % 2), cw = (w - 20) / n;
        for (let k = 0; k < n; k++) { const gx = x0 + 10 + k * cw + (cw - 16) / 2 | 0, lit = i === 2 && k === 1; glyph(P, gx, 149, 16, 16, i * 10 + k + 3, lit ? ramp('#ff8aa0', 5) : ramp('#a89c80', 5), lit); if (lit) C.sign = [gx, 149, 16, 16]; }
        // 卷帘门：拉到 sl，一条条的缝，几道锈
        field(P, x0, 174, w, sl - 174, SH, (x, y) => { const k = (y - 174) % 5; return 0.48 - (y - 174) / 420 + (k === 0 ? -0.22 : k === 1 ? 0.08 : 0) + (hash(x >> 3, (y - 174) / 5 | 0) - 0.5) * 0.06 - (hash(x >> 1, 99 + i) > 0.93 ? 0.14 : 0); });
        P.box(x0 - 2, 172, 4, 128, D.RAMP.steel, { top: 0, v: 0.4 }); P.box(x0 + w - 2, 172, 4, 128, D.RAMP.steel, { top: 0, v: 0.35 }); // 门轨
        if (sl < 300) {
          P.box(x0, sl - 4, w, 5, D.RAMP.gunmetal, { top: 1, v: 0.5 }); P.box(x0 + w / 2 - 6, sl, 12, 3, D.RAMP.steel, { r: 1 });
          field(P, x0 + 2, sl + 1, w - 4, 299 - sl, IN, (x, y) => 0.22 + (i === 3 ? Math.max(0, 0.3 - Math.hypot(x - x0 - 60, y - 300) / 150) : 0)); // 里面黑着，有一家还亮着一点
          for (let k = 0; k < 3; k++) if (sl + 12 + k * 14 < 296) P.rect(x0 + 8, sl + 12 + k * 14, w - 16, 1, '#2a2832'); // 货架的影子
        }
        P.box(x0 - 10, 140, 8, 160, D.RAMP.dark, { top: 0, v: 0.5 }); // 柱子
        if (hash(i, 7) > 0.3) P.box(x0 - 9, 200 + hash(i, 8) * 40 | 0, 6, 9, ramp('#c8c0a8', 5), { top: 0, v: 0.45 }); // 柱子上的小广告
      }
      // 玻璃柜台（铺 3 门口），玻璃裂了，里面剩几样
      P.box(278, 256, 86, 4, D.RAMP.steel, { top: 1, v: 0.5 });
      field(P, 280, 260, 82, 30, GL, (x, y) => 0.28 - (y - 260) / 160);
      P.box(288, 278, 12, 8, D.RAMP.crate, { top: 1, bias: -0.15 }); P.box(306, 272, 6, 14, D.RAMP.glass, { r: 1, bias: -0.1 }); P.ell(332, 282, 5, 3, D.RAMP.gold, { bias: -0.2 }); P.box(344, 280, 10, 6, D.RAMP.red, { r: 1, bias: -0.2 });
      for (let y = 260; y < 290; y++) for (let x = 280; x < 362; x++) { const d = (x - y + 400) % 26; if (d < 2) P.set(x, y, pickR(GL, 0.7 - d * 0.15, x, y)); } // 反光
      P.line(320, 260, 326, 270, '#a6e2f0'); P.line(326, 270, 322, 279, '#a6e2f0'); P.line(326, 270, 335, 274, '#58a3bd');
      P.rect(278, 260, 2, 30, '#949fb6'); P.rect(362, 260, 2, 30, '#434b5f'); P.box(278, 290, 86, 10, D.RAMP.gunmetal, { top: 1, v: 0.45 });
      for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) { let v = 0.42 - 0.22 * (y - 300) / 60; if (x % 32 === 0 || (y - 300) % 16 === 0) v -= 0.1; if (y === 300) v = 0.62; P.set(x, y, pickR(FL, v, x, y)); }
      for (let i = 0; i < 18; i++) { const x = hash(i, 88) * W | 0, y = 292 + (hash(i, 89) * 8 | 0); P.rect(x, y, 3 + (hash(i, 90) * 3 | 0), 2, hash(i, 91) > 0.5 ? '#a89c80' : '#6a6458'); } // 地上的纸片
    });
    return C;
  });

  // ── 车厢里：两排长座椅、竖杆和横杆、一排拉环，车窗外是隧道墙（停着的空车，没有人）
  const segOn = t => Math.sin(t * 9) > -0.7 || Math.sin(t * 0.5) > 0.4;
  mk('ev_car', '车厢里', '#2a2c34', 'wind', function (ctx, ex, t, st) {
    D.blitBG(ctx, ex, st.cache.bg);
    if (!segOn(t)) ex.clearRect(116, 65.5, 40, 3);
    props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors();
  }, function (t, st) { const L = st.light; for (const i of [1, 4]) L(60 + i * 106, 140, 150, '#d0e0f0', 0.45); if (segOn(t)) L(272, 140, 150, '#d0e0f0', 0.4); L(392, 196, 50, '#ff3b4a', 0.5); L(320, 290, 260, '#7a8090', 0.25); plights(this, L, t); });
  RM.ev_car.build = once(RM.ev_car, () => {
    const C = {}, PN = ramp('#6a6e74', 7), CE = ramp('#5a5e64', 6), TW = ramp('#2a2a2e', 6), ST = ramp('#3a4a7a', 7), FL = ramp('#2a2a30', 6), DR = ramp('#7a7e84', 7), GL = ramp('#2a4a58', 6), SP = ramp('#b8b098', 6);
    const WIN = [[40, 110], [186, 110], [330, 110]], tunnel = (x0, y0, w, h) => {
      field(P0, x0, y0, w, h, TW, (x, y) => 0.26 + ((x + 7) % 44 < 5 ? 0.12 : 0) + (y === y0 + 14 || y === y0 + 19 ? 0.18 : y === y0 + 15 ? -0.1 : 0) + (hash(x >> 2, y >> 3) - 0.5) * 0.1); // 隧道墙：肋、两根电缆
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if ((x - y + 300) % 37 < 2 && hash(x, 5) > 0.3) P0.set(x, y, '#4a5260'); // 玻璃上的反光
    };
    let P0;
    C.bg = bg(P => {
      P0 = P;
      field(P, 0, 0, W, 128, CE, (x, y) => 0.18 + 0.35 * (y / 128) ** 2 + (x % 106 === 0 ? -0.1 : 0) + (hash(x >> 3, y >> 3) - 0.5) * 0.05);
      P.box(0, 128, W, 12, D.RAMP.gunmetal, { top: 1, v: 0.45 }); // 灯带
      for (let i = 0; i < 6; i++) { const x = 20 + i * 106; if (i === 1 || i === 4 || i === 2) P.grad(x, 131, 80, 6, ['#8a9aa8', '#c8d8e8', '#e8f4ff', '#f8fcff'], 1); else P.box(x, 131, 80, 6, ramp('#5a6068', 5), { top: 0, v: 0.4 }); }
      field(P, 0, 140, W, 160, PN, (x, y) => 0.42 + 0.08 * (y - 140) / 160 + (x % 106 === 52 ? -0.15 : 0) + (hash(x >> 3, y >> 3) - 0.5) * 0.05);
      for (let i = 0; i < 4; i++) { const x = 24 + i * 106; if (x > 440) continue; P.box(x, 142, 72, 16, D.RAMP.gunmetal, { top: 1, v: 0.4 }); field(P, x + 2, 144, 68, 12, i % 2 ? ramp('#c8c0a8', 6) : ramp('#5a6a8a', 6), (xx, y) => 0.4 - (y - 144) / 60 + (hash(xx >> 2, i) - 0.5) * 0.1); if (i % 2) { P.rect(x + 4, 149, 64, 1, '#8f1d26'); for (let k = 0; k < 8; k++) P.px(x + 6 + k * 8, 149, '#e8e0c8'); } } // 线路图、广告框
      for (const [x, w] of WIN) { P.box(x - 4, 164, w + 8, 62, ramp('#26282e', 5), { r: 5, top: 1, v: 0.45 }); tunnel(x, 168, w, 54); }
      P.ell(392, 194, 3, 2, D.RAMP.red, { emit: true }); P.box(386, 190, 12, 2, D.RAMP.gunmetal, {}); // 窗外隧道里的一盏红灯
      // 两排座椅：靠背、坐垫、底下的铁皮
      for (const [x, w] of WIN) {
        for (let s = 0; s < 5; s++) { const sx = x + s * 22; P.box(sx, 228, 22, 22, ST, { r: 3, v: 0.5 }); P.box(sx, 250, 22, 14, ST, { r: 3, v: 0.62, top: 2 }); }
        P.box(x, 264, w, 28, D.RAMP.gunmetal, { top: 1, v: 0.42 }); P.rect(x, 292, w, 8, '#0c0e17');
      }
      P.box(242, 252, 10, 5, ramp('#c8a860', 5), { r: 2, v: 0.55 }); // 坐垫破了，露出海绵
      P.box(204, 246, 18, 5, ramp('#b8b0a0', 6), { top: 1, v: 0.5 }); P.rect(206, 248, 14, 1, '#5a5448'); // 落在座上的报纸
      for (const x of [170, 446]) P.box(x, 222, 12, 70, GL, { r: 2, v: 0.32 }); // 座椅头上的挡板（玻璃）
      // 车门：两扇，门上也有窗，黄边
      P.box(470, 156, 100, 144, DR, { top: 2, v: 0.5 }); P.rect(519, 156, 2, 144, '#1d212c');
      for (const x of [480, 530]) { P.box(x - 2, 170, 34, 54, ramp('#26282e', 5), { r: 3 }); tunnel(x, 172, 30, 50); }
      for (let y = 156; y < 300; y += 2) { P.set(472, y, (y >> 3) % 2 ? '#c8a020' : '#6a5410'); P.set(567, y, (y >> 3) % 2 ? '#c8a020' : '#6a5410'); }
      P.box(496, 142, 48, 12, D.RAMP.dark, { v: 0.2 }); for (let k = 0; k < 6; k++) P.px(502 + k * 7, 148, '#3a1a1a'); // 门上的报站屏，黑的
      // 横杆、竖杆、拉环
      P.box(0, 158, W, 4, D.RAMP.silver, { top: 1, v: 0.55 });
      for (const x of [174, 318, 462, 578]) P.box(x - 2, 140, 5, 160, D.RAMP.silver, { top: 0, v: 0.6 });
      for (let x = 184; x < 456; x += 22) { if (Math.abs(x - 318) < 8) continue; const l = 10 + (hash(x, 9) * 4 | 0); P.rect(x, 162, 2, l - 4, '#2d3342'); ring(P, x + 1, 158 + l + 4, 2.5, 5, SP); }
      for (let i = 0; i < 6; i++) P.line(200 + i * 60, 270 + hash(i, 3) * 10, 214 + i * 60, 266 + hash(i, 4) * 10, '#3a3e4a'); // 刮花的
      field(P, 0, 300, W, 60, FL, (x, y) => 0.4 - (y - 300) / 200 + ((y - 300) % 4 === 0 ? -0.1 : 0) + (y === 300 ? 0.25 : 0));
    });
    return C;
  });

  // ── 积水的站台：对面的瓷砖墙有一道水线，轨道全泡在水里，水漫过了站台边；一张长椅漂在水上，墙上的灯在水里有倒影
  const WTR = '#0a1620';
  mk('ev_flood', '积水的站台', '#242a34', 'drip', function (ctx, ex, t, st) {
    const C = st.cache; D.blitBG(ctx, ex, C.bg);
    D.blit(ctx, C.bench, 190 + Math.sin(t * 0.13) * 3, 125 + Math.round(Math.sin(t * 0.9)) / 2); // 漂着的长椅
    for (let i = 0; i < 26; i++) { const y = 99 + hash(i, 81) * 40, x = ((hash(i, 82) * 320 + t * (3 + hash(i, 83) * 4)) % 340) - 10; ex.globalAlpha = 0.22 + 0.18 * Math.sin(t * 2 + i); ex.fillStyle = '#8ab0d0'; ex.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, 2 + (hash(i, 84) * 4 | 0), 0.5); }
    for (let y = 100; y < 134; y++) { if (hash(y, Math.floor(t * 5)) > 0.62) continue; const w = 2.5 - (y - 100) / 18; ex.globalAlpha = 0.28 * (1 - (y - 100) / 36); ex.fillStyle = '#ffb057'; ex.fillRect(Math.round((210 + Math.sin(t * 2.5 + y * 0.6) * 1.5 - w / 2) * 2) / 2, y, w, 0.5); } // 灯的倒影在晃
    const q = (t * 0.5) % 1, dx = 170; ex.fillStyle = '#a8c8e0'; // 顶上漏下来的水
    if (q < 0.4) { ex.globalAlpha = 0.8; ex.fillRect(dx, 60 + q / 0.4 * 40, 0.5, 1); } else { const r = (q - 0.4) * 14; ex.globalAlpha = 0.5 * (1 - (q - 0.4) / 0.6); for (let a = 0; a < 16; a++) ex.fillRect(dx + Math.cos(a / 16 * 6.283) * r, 100 + Math.sin(a / 16 * 6.283) * r * 0.3, 0.5, 0.5); }
    ex.globalAlpha = 1;
    props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors();
  }, function (t, st) { const L = st.light, f = Math.sin(t * 9) > 0.94 ? 0.6 : 1; L(420, 166, 170 * f, '#ffb057', 0.65 * f); L(420, 232, 110, '#ffb057', 0.3 * f); L(300, 240, 280, '#4a7a98', 0.4); L(300, 300, 200, '#6a7a8a', 0.25); plights(this, L, t); });
  RM.ev_flood.build = once(RM.ev_flood, () => {
    const C = {}, TL = ramp('#5a6a62', 7), AL = ramp('#3a4a3a', 6), PL = ramp('#3a3a38', 6), WL = 196, WB = 278;
    C.bg = bg(P => {
      for (let y = 0; y < WL; y++) for (let x = 0; x < W; x++) {
        const tx = x / 16 | 0, ty = y / 12 | 0, grout = x % 16 === 0 || y % 12 === 0, miss = hash(tx * 5, ty) > 0.92, tide = y > 176;
        const v = 0.36 + 0.16 * y / WL + (hash(tx * 3, ty) - 0.5) * 0.08 - (grout ? 0.14 : 0) - (miss ? 0.2 : 0) - (tide ? 0.14 + (y - 176) / 120 : 0);
        P.set(x, y, pickR(tide ? AL : miss ? ramp('#3a3430', 6) : TL, v, x, y));
      }
      field(P, 0, 0, W, 34, ramp('#22242a', 5), (x, y) => 0.2 + y / 140);
      for (let x = 0; x < W; x++) if (hash(x >> 1, 21) > 0.55) for (let y = 172; y < 176 + hash(x, 22) * 4; y++) P.set(x, y, pickR(AL, 0.3, x, y)); // 水线上面一道道往下流的痕
      for (const x of [150, 500]) P.box(x, 0, 28, WL, D.RAMP.dark, { top: 0, v: 0.55 });
      P.box(230, 148, 120, 24, ramp('#2a4a6a', 6), { top: 2, r: 2 }); for (let i = 0; i < 4; i++) P.rect(246 + i * 24, 156, 14, 6, i === 1 ? '#1d3048' : '#a8b4c0'); // 站名牌
      P.box(466, 0, 8, WL, D.RAMP.rust, { top: 0, v: 0.5 }); for (const y of [60, 140]) P.box(463, y, 14, 5, D.RAMP.rust, { top: 1 }); // 一根管子插进水里
      P.box(410, 150, 20, 10, D.RAMP.gunmetal, { r: 2 }); P.ell(420, 162, 8, 4, D.RAMP.yellow, { emit: true, flat: true }); // 墙上的灯
      // 水面：把上面的墙倒过来，越往下越暗，一道道波纹
      for (let y = WL; y < WB; y++) for (let x = 0; x < W; x++) {
        const k = (y - WL) / (WB - WL), sy = WL - 1 - Math.floor((y - WL) * 1.1), xo = Math.round(Math.sin(y * 0.9 + x * 0.05) * (1 + k * 2)), sx = Math.max(0, Math.min(W - 1, x + xo)), i = sy * W + sx, src = sy >= 0 ? P.col[i] : null;
        let c = src ? D.mixHex(src, WTR, 0.5 + k * 0.3) : WTR; const rp = hash(x >> 3, y);
        if (rp > 0.93) c = D.mixHex(c, '#8aa8c0', 0.22); else if (rp < 0.06) c = D.mixHex(c, '#000000', 0.3);
        P.set(x, y, c, src && P.em[i] ? 1 : 0);
      }
      for (let x = 0; x < W; x++) if (hash(x >> 2, 23) > 0.4) P.set(x, WL, '#3a5060'); // 水和墙交界那一道亮
      P.box(280, 226, 6, 3, D.RAMP.glass, { r: 1, bias: -0.2 }); P.box(140, 244, 8, 2, ramp('#a89c80', 5), { top: 0, v: 0.3 }); // 漂着的瓶子、纸
      // 这边的站台：石沿、泡在水里的黄线、水漫上来一截
      P.box(0, WB, W, 4, ramp('#7a7468', 6), { top: 1, v: 0.48 });
      for (let y = WB + 4; y < H; y++) for (let x = 0; x < W; x++) P.set(x, y, pickR(PL, 0.46 - (y - WB) / 200 + (hash(x >> 2, y >> 2) - 0.5) * 0.06, x, y));
      for (let x = 0; x < W; x += 2) for (const y of [288, 289]) P.set(x, y, (x / 8 | 0) % 2 ? '#c8a020' : '#6a5410');
      for (let y = WB; y < 300; y++) for (let x = 0; x < W; x++) { const edge = 292 + Math.sin(x * 0.045) * 4 + Math.sin(x * 0.13) * 2, i = y * W + x; if (y > edge || !P.col[i]) continue; let c = D.mixHex(P.col[i], WTR, 0.5); if (hash(x >> 2, y) > 0.9) c = D.mixHex(c, '#6a8aa8', 0.3); P.set(x, y, c); }
      for (let i = 0; i < 10; i++) { const x = hash(i, 24) * W | 0, y = 300 + hash(i, 25) * 30 | 0; for (let k = 0; k < 14; k++) P.set(x + k, y, D.mixHex(P.col[y * W + x + k] || WTR, '#6a8aa8', 0.25)); } // 地上的水洼
    });
    // 漂着的长椅：靠背、两块座板露在水面上，腿和横档泡在水里
    C.bench = D.mkSprite(96, 30, p => {
      const WD = D.RAMP.crate, SUB = D.RAMP.crate.map(c => D.mixHex(c, WTR, 0.62));
      for (const x of [12, 80]) p.box(x, 0, 4, 10, WD, { v: 0.5 });
      for (let i = 4; i < 92; i++) { const y0 = Math.round(i * 0.05); for (let j = 0; j < 3; j++) p.set(i, y0 + j, pickR(WD, 0.7 - j * 0.15, i, j)); } // 靠背上那条
      for (let i = 0; i < 96; i++) { const y0 = 10 + Math.round(i * 0.06); for (let j = 0; j < 4; j++) p.set(i, y0 + j, pickR(WD, 0.78 - j * 0.13 + (i < 2 ? 0.1 : 0), i, j)); for (let j = 5; j < 8; j++) p.set(i, y0 + j, pickR(WD, 0.48 - (j - 5) * 0.1, i, j)); }
      for (let i = 2; i < 94; i++) { const y0 = 19 + Math.round(i * 0.06); for (let j = 0; j < 3; j++) p.set(i, y0 + j, pickR(SUB, 0.5 - j * 0.1, i, j)); } // 水下的横档
      for (const x of [8, 84]) for (let j = 20; j < 30; j++) for (let k = 0; k < 4; k++) p.set(x + k, j, pickR(SUB, 0.4 - (j - 20) / 30, x + k, j));
    });
    return C;
  });

  // ── 楼梯间：折返的水泥楼梯、铁扶手，墙上刷着楼层号，楼梯底下一扇铁门、门上安全出口的绿灯，平台上一盏罩着铁丝的灯
  mk('ev_stair', '楼梯间', '#26282e', 'wind', stdDraw, function (t, st) { const L = st.light, f = Math.sin(t * 7) > 0.9 ? 0.55 : 1; L(478, 222, 120, '#3aff8a', 0.6); L(505, 160, 160 * f, '#ffcf80', 0.5 * f); L(300, 260, 240, '#6a7a8a', 0.28); plights(this, L, t); });
  RM.ev_stair.build = once(RM.ev_stair, () => {
    const C = {}, WH = ramp('#7a7872', 7), LB = ramp('#3a4a58', 7), CN = ramp('#5a5854', 7), FL = ramp('#3a3836', 6), RUN = 204 / 13, PAINT = ramp('#c8c0a0', 5);
    C.bg = bg(P => {
      field(P, 0, 0, W, 236, WH, (x, y) => 0.36 + 0.12 * y / 236 + (hash(x >> 3, y >> 3) - 0.5) * 0.08 - (hash(x >> 1, 3) > 0.9 ? 0.1 * (1 - y / 236) : 0));
      P.box(0, 236, W, 3, ramp('#2a3440', 5), { top: 1, v: 0.4 });
      field(P, 0, 239, W, 61, LB, (x, y) => 0.42 - 0.18 * (y - 239) / 61 + (hash(x >> 2, y >> 2) - 0.5) * 0.07);
      for (const [x0, y0] of [[150, 150], [560, 200]]) { let x = x0, y = y0; for (let i = 0; i < 40; i++) { P.set(x, y, '#3a3834'); x += hash(i, x0) > 0.5 ? 1 : 0; y += 1; if (hash(i, y0) > 0.8) x -= 1; } } // 墙上的裂缝
      field(P, 0, 300, W, 60, FL, (x, y) => 0.42 - (y - 300) / 160 + (y === 300 ? 0.25 : 0) + (hash(x >> 3, y >> 2) - 0.5) * 0.06);
      // 一跑楼梯的侧面：上沿是台阶，下沿是斜的楼板底
      const flight = (xa, ya, dir, ground) => { // xa,ya 是这一跑的底；dir=1 往右上，-1 往左上
        for (let n = 0; n <= 204; n++) {
          const x = xa + dir * n, k = Math.min(12, Math.floor(n / RUN)), top = ya - (k + 1) * 8, bot = ground ? ya : Math.min(ya, ya + 16 - Math.round(n * 0.51)), edge = Math.floor(n % RUN) === 0;
          for (let y = top; y < bot; y++) { const d = y - top; let v = d < 2 ? 0.78 : d < 8 ? 0.5 - (edge ? 0.12 : 0) : 0.36 - (y > bot - 2 ? 0.14 : 0); P.set(x, y, pickR(d < 8 ? CN : FL, v + (hash(x >> 2, y >> 2) - 0.5) * 0.06, x, y)); }
        }
      };
      flight(430, 196, -1, false); // 往回往上的第二跑（在后面）
      P.box(430, 196, 120, 16, CN, { top: 2, v: 0.5 }); // 平台
      flight(226, 300, 1, true); // 从地面上去的第一跑
      // 扶手：两根管子 + 竖杆
      const rail = (x0, y0, x1, y1) => { P.line(x0, y0, x1, y1, '#a3b6dc'); P.line(x0, y0 + 1, x1, y1 + 1, '#4c5c86'); P.line(x0, y0 + 2, x1, y1 + 2, '#232a42'); };
      for (let k = 0; k < 13; k += 2) { const x = 226 + k * RUN + 6, ty = 300 - (k + 1) * 8; P.line(x, ty, x, ty - 28, '#34405f'); P.line(x + 1, ty, x + 1, ty - 28, '#232a42'); }
      rail(228, 264, 432, 160);
      for (let k = 0; k < 13; k += 2) { const x = 430 - k * RUN - 6, ty = 196 - (k + 1) * 8; P.line(x, ty, x, ty - 28, '#34405f'); }
      rail(430, 160, 226, 56); rail(432, 160, 548, 160); for (const x of [470, 510, 546]) P.line(x, 162, x, 196, '#34405f');
      // 楼层号：平台上方大字 B2，两跑之间一个小的 B1 和往上的箭头
      stencil(P, 444, 166, 'B2', 4, PAINT);
      stencil(P, 304, 186, 'B1', 2, PAINT); for (let i = 0; i < 5; i++) { P.set(326, 186 + i, '#c8c0a0'); if (i < 3) { P.set(326 - i, 186 + i, '#c8c0a0'); P.set(326 + i, 186 + i, '#c8c0a0'); } }
      // 平台上的灯：铁丝罩着
      P.box(498, 146, 14, 4, D.RAMP.gunmetal, {}); P.ell(505, 156, 5, 6, D.RAMP.yellow, { emit: true }); for (let k = 0; k < 3; k++) P.line(500 + k * 5, 150, 500 + k * 5, 162, '#2d3342'); P.line(499, 156, 511, 156, '#2d3342');
      // 平台底下：铁门、安全出口的绿灯（白色的小人往门跑）
      P.box(448, 230, 56, 70, D.RAMP.gunmetal, { top: 1, v: 0.45 }); P.box(452, 234, 48, 66, ramp('#4a5a50', 7), { top: 1, v: 0.5 }); P.box(456, 266, 40, 4, D.RAMP.steel, { r: 1, v: 0.5 }); P.box(470, 242, 12, 14, D.RAMP.dark, { v: 0.2 }); P.rect(499, 236, 1, 62, '#0c0e17');
      P.box(460, 214, 36, 14, D.RAMP.gunmetal, { r: 1 }); field(P, 462, 216, 32, 10, ramp('#2ac86a', 6), (x, y) => 0.6 - (y - 216) / 30, true);
      const MAN = ['0110', '0100', '1111', '0110', '1001'];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) if (MAN[r][c] === '1') P.set(466 + c, 217 + r * 2 - (r > 2 ? 1 : 0), '#e8fff0', 1);
      for (let i = 0; i < 6; i++) P.set(476 + i, 221, '#e8fff0', 1); P.set(486, 220, '#e8fff0', 1); P.set(486, 222, '#e8fff0', 1); P.set(487, 221, '#e8fff0', 1);
      // 消防栓箱
      P.box(186, 232, 30, 44, D.RAMP.red, { top: 2, v: 0.55 }); P.box(190, 236, 22, 30, ramp('#3a1a20', 5), { v: 0.3 }); P.ell(201, 251, 8, 8, ramp('#c8b070', 6), {}); P.ell(201, 251, 3, 3, D.RAMP.dark, {}); P.rect(192, 268, 18, 4, '#d8d0c0');
      for (let i = 0; i < 4; i++) P.rect(240 + i * 46, 296 - i * 24 - 8, 4, 2, '#a89c80'); // 台阶上的纸团
    });
    return C;
  });

  // ── 机房：一排机柜（网孔门，指示灯一闪一闪，一台开着门，一台死了），顶上走线槽电缆垂下来，地上一捆捆的线，冷光
  mk('ev_server', '机房', '#1c2230', 'wind', function (ctx, ex, t, st) {
    const C = st.cache; D.blitBG(ctx, ex, C.bg);
    for (const [x, y, c, ph] of C.leds) { if (Math.sin(t * (1.5 + ph * 9) + ph * 40) < (ph > 0.6 ? -0.3 : 0.4)) continue; ex.fillStyle = c; ex.fillRect(x / 2, y / 2, 0.5, 0.5); }
    if (Math.sin(t * 2.2) > 0) { ex.fillStyle = '#ff3b4a'; ex.fillRect(C.alarm[0] / 2, C.alarm[1] / 2, 1, 0.5); }
    props(ctx, ex, this, t); creatures(ctx, ex, t); st.actors();
  }, function (t, st) { const L = st.light, a = st.cache.alarm; L(350, 200, 300, '#4a90ff', 0.4); L(260, 240, 140, '#3ee8ff', 0.22); L(440, 240, 140, '#8dff6a', 0.15); L(578, 188, 60, '#6ae8ff', 0.45); if (Math.sin(t * 2.2) > 0) L(a[0], a[1], 70, '#ff3b4a', 0.45); plights(this, L, t); });
  RM.ev_server.build = once(RM.ev_server, () => {
    const C = { leds: [] }, WL = ramp('#2e3440', 7), FL = ramp('#4a4e58', 6), CB = ramp('#1e222c', 6), AC = ramp('#8a9098', 7);
    const CBL = [ramp('#2a3040', 5), ramp('#3a2a2a', 5), ramp('#2a3a2a', 5), ramp('#6a5a2a', 5)];
    C.bg = bg(P => {
      field(P, 0, 0, W, 300, WL, (x, y) => 0.3 + 0.12 * y / 300 + (x % 80 === 0 ? -0.1 : 0) + (hash(x >> 3, y >> 3) - 0.5) * 0.05);
      // 走线槽、垂下来的电缆
      for (let x = 20; x < W; x += 60) P.box(x, 120, 3, 22, D.RAMP.gunmetal, {});
      for (let c = 0; c < 5; c++) { const col = ['#141820', '#2a2030', '#20303a', '#3a3020', '#1a2a20'][c]; for (let x = 0; x < W; x++) { const u = ((x - 21 + 600) % 60) / 60, sag = Math.sin(u * Math.PI) * (4 + c * 2.5); P.set(x, 148 + c + sag, col); } }
      P.box(0, 140, W, 8, D.RAMP.gunmetal, { top: 1, v: 0.5 });
      // 机柜
      for (let i = 0; i < 7; i++) {
        const x0 = 168 + i * 52, w = 50, open = i === 2, dead = i === 5;
        P.box(x0, 164, w, 136, CB, { top: 2, v: 0.5 }); P.box(x0 + 3, 170, w - 6, 124, D.RAMP.dark, { top: 0, v: 0.3 });
        for (let u = 0; u < 18; u++) {
          const y = 172 + (u * 6.6 | 0);
          if (open) { P.box(x0 + 4, y, w - 8, 6, D.RAMP.gunmetal, { top: 1, v: 0.5 }); for (let k = 0; k < 5; k++) P.rect(x0 + 20 + k * 4, y + 2, 3, 2, '#1d212c'); }
          else P.rect(x0 + 4, y + 5, w - 8, 1, '#151a29');
          if (!dead && hash(i * 31 + u, 91) > 0.35) for (let k = 0; k < 1 + (hash(u, i) * 3 | 0); k++) { const lx = x0 + 6 + k * 3, ly = y + 2, h = hash(i * 7 + u, k); P.set(lx, ly, '#142018'); C.leds.push([lx, ly, h > 0.88 ? '#ffb057' : h > 0.7 ? '#3ee8ff' : '#8dff6a', hash(u * 3 + k, i * 5)]); }
        }
        if (!open) { for (let y = 172; y < 292; y += 2) for (let x = x0 + 14; x < x0 + w - 4; x++) if (((x + (y >> 1)) & 1) === 0) P.set(x, y, '#0c0e17'); P.box(x0 + w - 9, 210, 3, 30, D.RAMP.steel, { r: 1, v: 0.5 }); } // 网孔门、把手
        P.box(x0 + 16, 166, 18, 4, ramp('#c8c0a8', 5), { top: 0, v: 0.5 }); // 柜顶的编号牌
      }
      P.box(272, 166, 4, 132, D.RAMP.gunmetal, { top: 0, v: 0.6 }); // 开着那台的门板（侧着）
      C.alarm = [168 + 5 * 52 + 40, 167];
      // 精密空调
      P.box(546, 176, 64, 124, AC, { top: 2, v: 0.55 }); for (let y = 200; y < 290; y += 3) P.rect(552, y, 52, 1, '#434b5f');
      P.box(556, 182, 24, 10, D.RAMP.dark, { v: 0.2 }); P.grad(558, 184, 20, 6, ['#0a2a30', '#14505a', '#2a8a9a', '#6ae8ff'], 1);
      // 灭火气瓶（镜头外）
      for (let k = 0; k < 3; k++) { P.box(70 + k * 24, 218, 18, 82, D.RAMP.red, { r: 6, v: 0.55 }); P.box(75 + k * 24, 210, 8, 10, D.RAMP.steel, { r: 1 }); }
      // 地上的线：一捆捆沿着柜脚走，一块地板掀起来靠在柜子上，底下的线翻出来
      for (let b = 0; b < 4; b++) { const R = CBL[b]; for (let x = 150; x < 546; x++) { const y0 = 288 + Math.sin(x * 0.03 + b * 1.7) * 3 + b * 2; for (let j = 0; j < 3; j++) P.set(x, y0 + j, pickR(R, 0.62 - j * 0.2, x, j)); } }
      P.box(516, 258, 26, 42, FL, { top: 1, v: 0.55 }); for (let y = 264; y < 296; y += 4) for (let x = 520; x < 538; x += 4) P.set(x, y, '#1d212c');
      for (let c = 0; c < 4; c++) for (let n = 0; n < 30; n++) P.set(500 + n * 0.6 + c * 2, 298 - Math.sin(n / 30 * Math.PI) * (10 + c * 4), ['#2a3040', '#6a5a2a', '#3a2a2a', '#20303a'][c]);
      for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) { let v = 0.4 - (y - 300) / 200; if (x % 40 === 0 || (y - 300) % 20 === 0) v -= 0.14; if (y === 300) v = 0.6; if ((x / 40 | 0) % 3 === 1 && (x & 3) === 0 && (y & 3) === 0) v -= 0.2; P.set(x, y, pickR(FL, v, x, y)); }
    });
    return C;
  });
})(D);
