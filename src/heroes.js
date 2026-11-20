/* 末班之后 · 小样二：六个型号的外形（像素化计划第 1 步）
   底子是原来那台无人机机器人（CC0 素材「8 Directional Drone Robot」，Hormelz，见 hero-art.js），不再用代码画的机娘。
   每个型号在它的基础上改：
     1. 换色：图集里的钢蓝色阶整套换成型号自己的色阶，橙色护目换成型号的发光色（逐像素查表，像素画不糊）；
     2. 加部件：先量出每一帧机身的位置（头顶、头的中心、肩膀那一行的左右边），把部件钉在相对位置上，所以部件跟着动画一起动：
        灵猫 · 两根天线（尖端发青光）；犀甲 · 额头一只角 + 两块肩甲；驮兽 · 背后的货架和箱子；
        白鹭 · 白色外壳 + 头顶绿十字灯；蛛网 · 背后四条蛛腿（尖端发粉光）；工壳 · 原样（钢蓝 + 橙色护目）。
     3. 改装件（机库改装台）：装上的改装件也画在身上——装甲是胸前一块护板，动力是背后的电机 / 电容 / 推进器（关节是膝盖亮灯），
        传感器是头上的声呐、天线、目镜、雷达或光环。D.heroOf(型号, 改装件) 按"型号 + 改装件"生成，所以城里也看得见。
   和 D.HERO 同一套接口（img / emit / flash / tint / rim / variant / meta），第一次用到某个型号时生成。
   改装台预览只要一个朝向的待机：D.heroOf(型号, 改装件, ['idle8']) 只生成这几帧，快得多。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const STEEL = ['#161a2a', '#232a42', '#34405f', '#4c5c86', '#6f84b3', '#a3b6dc', '#dbe5fa'];
  const ORANGE = [[255, 122, 46], [255, 176, 87], [255, 240, 200]];
  const DEFS = {
    scout:  { ramp: ['#0c1e1e', '#143232', '#1e4a48', '#2a6a64', '#3f9488', '#72c4b4', '#c0f0e4'], visor: ['#1ac8e8', '#3ee8ff', '#d0fbff'], parts: ['antenna'] },
    heavy:  { ramp: ['#1e120a', '#352012', '#56341c', '#7a4c26', '#a46a34', '#d09252', '#f4c890'], visor: ['#e3a81c', '#ffd95c', '#fff3b0'], parts: ['pads', 'horn'], bulk: [0, 0.78] },
    hauler: { ramp: ['#1a170c', '#2e2a16', '#4a4424', '#6a6234', '#8f854a', '#b8ac70', '#e4dcaa'], visor: ['#ff8a1a', '#ffc23d', '#ffeec0'], parts: ['rack'], bulk: [0.25, 0.7] },
    medic:  { ramp: ['#2a3040', '#4a5268', '#727c94', '#a0aac0', '#c8d0e0', '#e6ecf6', '#ffffff'], visor: ['#2ec860', '#5fe07a', '#d0ffd8'], parts: ['cross'] },
    hacker: { ramp: ['#140a20', '#24123a', '#3a1c5a', '#56287e', '#7a3aa8', '#a466d0', '#dcb4f4'], visor: ['#e02a9a', '#ff4dc8', '#ffd0f0'], parts: ['legs'] },
    worker: { ramp: STEEL, visor: ['#ff7a2e', '#ffb057', '#fff0c8'], parts: [], bulk: null }, // 工壳：原样，只在装了改装件时才生成
  };
  D.HERO_DEFS = DEFS;
  const PAD_X = 8, PAD_T = 9; // 部件会伸出原来的格子：每帧四周加一点空
  // 朝向：6 右、7 右下、8 下、1 左下、2 左、3 左上、4 上、5 右上
  const BACK = { 3: 1, 4: 1, 5: 1 }, FACE = { 5: 1, 6: 1, 7: 1, 1: -1, 2: -1, 3: -1, 4: 0, 8: 0 };

  // 量一帧机身（op(x, y) = 这个像素有没有东西）：头顶、脚底、头的中心、肩膀那一行和左右边、膝盖那一行和左右边
  function measure(op, fw, fh) {
    let top = -1, bot = -1; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (op(x, y)) { if (top < 0) top = y; bot = y; }
    if (top < 0) return null;
    let sx = 0, sn = 0; for (let y = top; y < top + 6; y++) for (let x = 0; x < fw; x++) if (op(x, y)) { sx += x; sn++; }
    const hx = Math.round(sx / Math.max(1, sn)), h = bot - top, sy = top + Math.round(h * 0.32), ky = top + Math.round(h * 0.74);
    let sl = fw, sr = 0; for (let x = 0; x < fw; x++) if (op(x, sy)) { sl = Math.min(sl, x); sr = Math.max(sr, x); }
    let kl = fw, kr = 0; for (let x = 0; x < fw; x++) if (op(x, ky)) { kl = Math.min(kl, x); kr = Math.max(kr, x); }
    return { top, bot, h, hx, sy, sl, sr, ky, kl, kr };
  }
  D.heroMeasure = measure;
  // 三个改装挂点在这一帧里的位置（改装台画挂点和机械臂用）
  D.heroAnchors = (m, dir) => { const face = FACE[dir] || 0, back = !!BACK[dir]; return { sensor: [m.hx, m.top + 3], armor: back ? [m.sr - 1, m.sy] : [m.hx + face, m.sy + 3], power: back ? [m.hx, m.sy + 4] : face ? [m.hx - face * 6, m.sy + 4] : [m.hx + 6, m.sy - 1] }; };

  // ── 改装件的样子
  const INK = '#0b0a14'; // 部件压在机身上时描的黑边
  const ARM = { // 装甲：胸前护板 [宽, 高, 暗, 中, 亮]
    plate: [5, 4, '#4c5468', '#7c869c', '#b4bccc'], reactive: [6, 4, '#3c3f26', '#6b7046', '#9aa064'], composite: [7, 5, '#30384a', '#5a6478', '#8a94aa'],
    emitter: [5, 4, '#1d212c', '#2d3342', '#4a5266'], ceramic: [7, 5, '#8a90a0', '#c8ccd8', '#eef0f6'], nano: [7, 6, '#0b0d14', '#1d212c', '#2d3342'],
    aegis: [7, 6, '#1d2a3a', '#3a5a78', '#8ac8e8'], // 工坊蓝图的传说件（workshop-bp.js）
    thorns: [7, 5, '#1d2a1a', '#3d5a2a', '#7aa04a'], regen: [7, 6, '#123a2a', '#2a6a4a', '#8dffb0'], phase: [7, 6, '#24163a', '#4a2a78', '#c4a0ff'], // gear-perks.js 的特效改装件
  };
  const PWR = { // 动力：背后的机组 [宽, 高, 壳, 亮边, 发光]
    ocmotor: [5, 6, '#3a4152', '#8a94aa', '#ff7a2e'], hicap: [6, 6, '#2d3342', '#7c869c', '#3ee8ff'], dualcore: [6, 5, '#2d3342', '#8a94aa', '#ffd95c'],
    turbo: [6, 6, '#3a4152', '#a0aac0', '#ffb057'], fusion: [7, 7, '#1d212c', '#6a4a8a', '#ff6af0'],
    overdrive: [6, 7, '#2a1d22', '#8a4a4a', '#ff3047'], // 工坊蓝图的传说件
    arcstep: [5, 6, '#1d2a3a', '#6a8aaa', '#3ee8ff'], twin: [7, 6, '#2d3342', '#a0aac0', '#7fb3ff'], ocore: [7, 7, '#2a1a10', '#aa6a2a', '#ffb020'], // gear-perks.js
  };
  function modPart(k, f) {
    const M = D.RMOD && D.RMOD[k]; if (!M) return;
    const { put, rect, line, m, face, back } = f, { top, hx, sy, sl, sr, ky, kl, kr } = m, acc = D.QUALITY[M.q].col;
    if (M.slot === 'armor') {
      const [w0, hh, c0, c1, c2] = ARM[k];
      if (back) { for (const x of [sl, sr - 2]) { rect(x - 1, sy - 2, 5, 4, INK); rect(x, sy - 1, 3, 2, c1); rect(x, sy - 1, 3, 1, c2); } if (k === 'nano' || k === 'emitter') { put(sl + 1, sy, k === 'nano' ? '#ffc23d' : '#3ee8ff', true); put(sr - 1, sy, k === 'nano' ? '#ffc23d' : '#3ee8ff', true); } return; } // 背面：只露出两块肩甲
      const w = face ? Math.max(3, w0 - 2) : w0, cx = hx + face, x0 = Math.round(cx - w / 2), y0 = sy + 1, mx = Math.round(cx);
      rect(x0 - 1, y0 - 1, w + 2, hh + 2, INK); rect(x0, y0, w, hh, c1); rect(x0, y0, w, 1, c2); rect(x0, y0 + hh - 1, w, 1, c0);
      if (k === 'reactive') { rect(x0 + (w >> 1), y0 + 1, 1, hh - 2, c0); rect(x0, y0 + 2, w, 1, c0); }
      if (k === 'composite') rect(x0 + 1, y0 + 2, w - 2, 1, acc);
      if (k === 'emitter') { rect(mx - 1, y0 + 1, 2, 2, '#3ee8ff', true); if (!face) { put(sl + 1, sy, '#3ee8ff', true); put(sr - 1, sy, '#3ee8ff', true); } }
      if (k === 'ceramic') { rect(x0 + 1, y0 + 1, 1, hh - 2, c0); rect(x0 + w - 2, y0 + 1, 1, hh - 2, c0); put(mx, y0 + 2, acc); }
      if (k === 'aegis') { rect(x0 + 1, y0 + 1, w - 2, 1, '#3ee8ff', true); rect(mx, y0 + 2, 1, hh - 3, c2); put(mx, y0 + 3, '#ffc23d', true); }
      if (k === 'thorns') { for (let x = x0; x < x0 + w; x += 2) { put(x, y0 - 2, c2); put(x, y0 - 1, c1); } put(mx, y0 + 2, '#8dff6a', true); }
      if (k === 'regen') { rect(mx - 1, y0 + 2, 3, 1, '#8dff6a', true); rect(mx, y0 + 1, 1, 3, '#8dff6a', true); }
      if (k === 'phase') { rect(x0 + 1, y0 + 1, w - 2, 1, '#c4a0ff', true); rect(x0 + 1, y0 + hh - 2, w - 2, 1, '#9b6bff', true); put(mx, y0 + 3, '#ffffff', true); }
      if (k === 'nano') { rect(x0 + 1, y0 + 2, w - 2, 1, '#ffc23d', true); put(mx, y0 + 1, '#ffc23d', true); put(x0 + 1, y0 + 4, '#ffc23d', true); put(x0 + w - 2, y0 + 4, '#ffc23d', true); }
      return;
    }
    if (M.slot === 'power') {
      if (k === 'joint') { for (const x of [kl + 1, kr - 1]) { put(x, ky, '#ffd27a', true); put(x, ky + 1, '#ff9a3a', true); } return; }
      const [w, hh, c0, c1, g] = PWR[k];
      if (!back && !face) { // 正面：机组在背后，只从肩膀上面露出两边
        const W = w + 6, x0 = Math.round(hx - W / 2), y0 = sy - 3; rect(x0, y0, W, 4, c0, false, true); rect(x0, y0, W, 1, c1, false, true); put(x0 + 1, y0 + 1, g, true, true); put(x0 + W - 2, y0 + 1, g, true, true); return;
      }
      const u = !back, cx = back ? hx : hx - face * 6, x0 = Math.round(cx - w / 2), y0 = sy + 1, mx = Math.round(cx); // 侧面：画在机身后面
      if (back) rect(x0 - 1, y0 - 1, w + 2, hh + 2, INK);
      rect(x0, y0, w, hh, c0, false, u); rect(x0, y0, w, 1, c1, false, u);
      if (k === 'ocmotor') rect(x0 + 1, y0 + hh - 2, w - 2, 1, g, true, u);
      if (k === 'hicap') { rect(x0 + 1, y0 + 1, 1, hh - 2, c1, false, u); rect(x0 + w - 2, y0 + 1, 1, hh - 2, c1, false, u); put(x0 + 1, y0 + 1, g, true, u); put(x0 + w - 2, y0 + 1, g, true, u); }
      if (k === 'dualcore') { put(x0 + 1, y0 + 2, g, true, u); put(x0 + w - 2, y0 + 2, g, true, u); }
      if (k === 'turbo') { rect(x0, y0 + hh, 2, 2, '#1d212c', false, u); rect(x0 + w - 2, y0 + hh, 2, 2, '#1d212c', false, u); for (const x of [x0, x0 + w - 1]) { put(x, y0 + hh + 2, g, true, u); put(x, y0 + hh + 3, '#ff7a2e', true, u); } }
      if (k === 'overdrive') { rect(x0 + 1, y0 + 1, w - 2, 1, g, true, u); rect(x0 + 1, y0 + hh - 2, w - 2, 1, g, true, u); put(mx, y0 + 3, '#ffd0a0', true, u); }
      if (k === 'arcstep') { line(x0, y0 + hh, x0 + w - 1, y0 + hh + 2, g, true, u); put(x0 + 1, y0 + 2, g, true, u); put(x0 + w - 2, y0 + 3, g, true, u); }
      if (k === 'twin') { rect(x0, y0 + hh, 2, 2, '#1d212c', false, u); rect(x0 + w - 2, y0 + hh, 2, 2, '#1d212c', false, u); put(x0, y0 + hh + 2, g, true, u); put(x0 + w - 1, y0 + hh + 2, g, true, u); put(mx, y0 + 2, g, true, u); }
      if (k === 'ocore') { rect(mx - 1, y0 + 2, 3, 3, g, true, u); put(mx, y0 + 3, '#fff0c8', true, u); rect(x0, y0 + hh - 1, w, 1, '#ff7a2e', true, u); }
      if (k === 'fusion') { rect(mx - 1, y0 + 2, 3, 3, g, true, u); put(mx, y0 + 3, '#ffd0f0', true, u); }
      return;
    }
    if (M.slot === 'sensor') {
      const sd = face || 1, hy = top + 3;
      if (k === 'sonar') { const x = hx + sd * 4; rect(x, hy - 1, 1, 3, '#7c869c'); rect(x + sd, hy - 2, 1, 5, '#b4bccc'); put(x, hy, '#3ee8ff', true); }
      if (k === 'motion') { const x0 = hx - sd * 3; line(x0, top + 2, x0 - sd * 2, top - 4, '#646e86'); put(x0 - sd * 2, top - 5, '#ff3047', true); }
      if (k === 'goggles') { const gy = top + 5; if (back) { rect(hx - 3, gy, 7, 1, '#4a5266'); put(hx, gy, '#8dff6a', true); } else { const w = face ? 4 : 7, x0 = face > 0 ? hx : hx - 3; rect(x0, gy - 1, w, 3, '#1d212c'); rect(x0 + 1, gy, w - 2, 1, '#8dff6a', true); } }
      if (k === 'damper') { const x0 = hx - 2 - face * 2; rect(x0, top - 2, 5, 3, '#2d3342'); rect(x0, top - 2, 5, 1, '#4a5266'); put(x0 + 1, top - 1, '#0b0a14'); put(x0 + 3, top - 1, '#0b0a14'); put(x0 + 4, top - 2, acc, true); }
      if (k === 'radar') { const x = hx - sd * 4; line(x, top + 3, x, top - 5, '#646e86'); rect(x - 3, top - 7, 7, 2, '#8a94aa'); rect(x - 3, top - 7, 7, 1, '#c8cdda'); put(x, top - 6, '#b36bff', true); }
      if (k === 'phantom') { for (const [dx, dy] of [[-5, 2], [5, 2], [-3, -3], [3, -3]]) put(hx + dx, top + dy, '#b36bff', true); put(hx, top - 4, '#e8d8ff', true); }
      if (k === 'scanner') { const gy = top + 4, x0 = face > 0 ? hx + 1 : hx - 4; rect(x0, gy - 1, 4, 3, '#1d212c'); rect(x0 + 1, gy, 2, 1, '#ff3047', true); }
      if (k === 'lootrad') { const x = hx + sd * 4; line(x, top + 3, x, top - 3, '#646e86'); rect(x - 2, top - 5, 5, 2, '#c8a43a'); put(x, top - 4, '#ffd84a', true); }
      if (k === 'sentinel') { const x = hx - sd * 3; line(x, top + 2, x, top - 6, '#646e86'); rect(x - 1, top - 8, 3, 3, '#2d3342'); put(x, top - 7, '#3ee8ff', true); put(hx + sd * 4, top + 1, '#3ee8ff', true); }
      if (k === 'quantum') { for (const [dx, dy] of [[-6, 1], [6, 1], [0, -5]]) { put(hx + dx, top + dy, '#ffc23d', true); put(hx + dx, top + dy - 1, '#fff0c8', true); } }
    }
  }

  // ── 半立体：给机身加体积感（试玩反馈汇总第 3 轮）
  // 1. bulk：犀甲、驮兽在某几行把身子左右各加宽一像素（外形一眼能分）；
  // 2. 每一行里每一段连着的身体（手臂、腿、躯干各算一段）当圆柱打光：左边一两像素亮一档、右边一两像素暗一档；
  // 3. 顶边（上面是空的）亮一档，底边暗一档——光从左上来。只改型号色阶里的颜色，护目、发光件不动。
  function volume(P, W, ox, oy, fw, fh, m, d) {
    const R = d.ramp.map(hex), idx = new Map(); R.forEach((c, i) => idx.set(c.join(','), i));
    const at = (x, y) => ((oy + y) * W + ox + x) * 4, A = (x, y) => x >= 0 && y >= 0 && x < fw && y < fh && P[at(x, y) + 3] > 0;
    const ri = (x, y) => { const i = at(x, y); return idx.has(P[i] + ',' + P[i + 1] + ',' + P[i + 2]) ? idx.get(P[i] + ',' + P[i + 1] + ',' + P[i + 2]) : -1; };
    const set = (x, y, k) => { const c = R[Math.max(0, Math.min(6, k))], i = at(x, y); P[i] = c[0]; P[i + 1] = c[1]; P[i + 2] = c[2]; P[i + 3] = 255; };
    if (d.bulk) {
      const y0 = m.top + Math.round(m.h * d.bulk[0]), y1 = m.top + Math.round(m.h * d.bulk[1]);
      for (let y = y0; y <= y1; y++) {
        let l = -1, r = -1; for (let x = 0; x < fw; x++) if (A(x, y)) { if (l < 0) l = x; r = x; }
        if (l < 1 || r > fw - 2) continue;
        for (let x = r; x >= l; x--) { const i = at(x, y), j = at(x + 1, y); if (x >= Math.round((l + r) / 2)) { P[j] = P[i]; P[j + 1] = P[i + 1]; P[j + 2] = P[i + 2]; P[j + 3] = P[i + 3]; } }
        for (let x = l; x <= Math.round((l + r) / 2); x++) { const i = at(x, y), j = at(x - 1, y); P[j] = P[i]; P[j + 1] = P[i + 1]; P[j + 2] = P[i + 2]; P[j + 3] = P[i + 3]; }
      }
    }
    const body = (x, y) => A(x, y) && ri(x, y) > 0; // 不算描边（色阶 0）
    const shade = new Int8Array(fw * fh);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (!body(x, y) || body(x - 1, y)) continue;
        let e = x; while (body(e + 1, y)) e++;
        const n = e - x + 1; if (n >= 3) { const k = n >= 7 ? 2 : 1; for (let t = 0; t < k; t++) { shade[y * fw + x + t] += 1; shade[y * fw + e - t] -= 1; } }
        x = e;
      }
    }
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      if (!body(x, y)) continue;
      let k = shade[y * fw + x];
      if (!body(x, y - 1)) k += 1; else if (!body(x, y + 1)) k -= 1;
      if (k) set(x, y, Math.max(1, ri(x, y) + Math.sign(k)));
    }
  }

  function build(key, mods, anims) {
    const B = D.HERO, d = DEFS[key]; if (!B || !B.ready || !d) return null;
    // 要哪些帧：整套，或者只要某几个动画（新图集里重新编号）
    let src = [], meta;
    if (anims) { meta = {}; for (const a of anims) if (B.meta[a]) meta[a] = B.meta[a].map(s => src.push(s) - 1); }
    else { meta = B.meta; const n0 = Object.values(B.meta).reduce((a, l) => Math.max(a, ...l), 0) + 1; for (let s = 0; s < n0; s++) src.push(s); }
    const n = src.length; if (!n) return null;
    const fw = B.fw + PAD_X * 2, fh = B.fh + PAD_T, cols = anims ? Math.min(n, 24) : B.cols, rows = Math.ceil(n / cols);
    const modKeys = ['power', 'armor', 'sensor'].map(s => mods && mods[s]).filter(k => k && D.RMOD && D.RMOD[k]);
    const [img, ix] = D.canvas(cols * fw, rows * fh), [emit, ex] = D.canvas(cols * fw, rows * fh);
    const dirOf = {}; for (const k in meta) { const dir = +k.replace(/\D/g, ''); for (const s of meta[k]) dirOf[s] = dir; }
    // 1. 拷进带空边的新格子
    for (let s = 0; s < n; s++) { const s0 = src[s], sx = (s0 % B.cols) * B.fw, sy = Math.floor(s0 / B.cols) * B.fh, dx = (s % cols) * fw + PAD_X, dy = Math.floor(s / cols) * fh + PAD_T; ix.drawImage(B.img, sx, sy, B.fw, B.fh, dx, dy, B.fw, B.fh); ex.drawImage(B.emit, sx, sy, B.fw, B.fh, dx, dy, B.fw, B.fh); }
    // 2. 换色：钢蓝色阶 → 型号色阶，橙色护目 → 型号发光色
    const map = new Map(); STEEL.forEach((h, i) => map.set(hex(h).join(','), hex(d.ramp[i]))); ORANGE.forEach((c, i) => map.set(c.join(','), hex(d.visor[i])));
    for (const c of [ix, ex]) { const id = c.getImageData(0, 0, img.width, img.height), p = id.data; for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const m = map.get(p[i] + ',' + p[i + 1] + ',' + p[i + 2]); if (m) { p[i] = m[0]; p[i + 1] = m[1]; p[i + 2] = m[2]; } } c.putImageData(id, 0, 0); }
    // 3. 每帧加部件
    const R = d.ramp, V = d.visor;
    const id = ix.getImageData(0, 0, img.width, img.height), P = id.data, W = img.width;
    const eid = ex.getImageData(0, 0, img.width, img.height), E = eid.data;
    const op = (x, y) => x >= 0 && y >= 0 && x < W && y < img.height && P[(y * W + x) * 4 + 3] > 0;
    const anch = [];
    for (let s = 0; s < n; s++) {
      const ox = (s % cols) * fw, oy = Math.floor(s / cols) * fh, dir = dirOf[s] || 8, back = !!BACK[dir], face = FACE[dir];
      // 量机身（在加部件之前量，改装台的挂点也用这一份）
      const m = measure((x, y) => op(ox + x, oy + y), fw, fh); if (!m) continue;
      anch[s] = m;
      volume(P, W, ox, oy, fw, fh, m, d);
      const { top, hx, sy, sl, sr } = m;
      const added = new Set();
      // put：under = 只画在空的地方（部件在机身后面）
      const put = (x, y, col, glow, under) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= fw || y >= fh) return; const X = ox + x, Y = oy + y, i = (Y * W + X) * 4; if (under && P[i + 3]) return; const c = hex(col); P[i] = c[0]; P[i + 1] = c[1]; P[i + 2] = c[2]; P[i + 3] = 255; added.add(Y * W + X); if (glow) { E[i] = c[0]; E[i + 1] = c[1]; E[i + 2] = c[2]; E[i + 3] = 255; } };
      const rect = (x, y, w, hh, col, glow, under) => { for (let j = 0; j < hh; j++) for (let k = 0; k < w; k++) put(x + k, y + j, col, glow, under); };
      // 半立体的小方块：正面 + 斜着的顶面（亮）+ 右侧面（暗），dp = 厚度
      const box3 = (x, y, w, hh, dp, c0, c1, c2, under) => { for (let j = 0; j < dp; j++) rect(x + dp - j, y + j, w, 1, c2, false, under); rect(x, y + dp, w, hh, c1, false, under); for (let i = 0; i < dp; i++) rect(x + w + i, y + dp - 1 - i, 1, hh, c0, false, under); };
      const line = (x0, y0, x1, y1, col, glow, under) => { const m = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let k = 0; k <= m; k++) put(x0 + (x1 - x0) * k / m, y0 + (y1 - y0) * k / m, col, glow, under); };
      for (const part of d.parts) {
        if (part === 'antenna') { for (const sgn of [-1, 1]) { const bx = hx + sgn * 2 - face, tx = bx + sgn * 2 - face * 2; line(bx, top + 1, tx, top - 7, R[1], false, true); put(tx, top - 8, V[1], true); put(tx, top - 7, V[2], true); } }
        if (part === 'horn' && !back) { const bx = face ? hx + face * 3 : hx; rect(bx - 1, top - 1, 4, 2, '#8a8270'); rect(bx - 1, top - 1, 3, 2, '#d8d0b8'); rect(bx - (face < 0 ? 1 : 0), top - 3, 2, 2, '#e8e0c8'); put(bx + face, top - 5, '#fff8e0'); put(bx + face, top - 4, '#e8e0c8'); }
        if (part === 'pads') { const sides = face ? [face] : [-1, 1]; for (const sgn of sides) { const px0 = sgn < 0 ? sl - 5 : sr - 1, py0 = sy - 4; box3(px0, py0, 6, 5, 2, R[1], R[3], R[5]); rect(px0, py0 + 6, 6, 1, R[4]); put(px0 + 2 + (sgn < 0 ? 0 : 1), py0 + 4, V[1], true); put(px0 + 3 + (sgn < 0 ? 0 : 1), py0 + 4, V[0], true); } }
        if (part === 'rack') {
          if (back) { const bx = hx - 7, by = top + 7; box3(bx, by - 2, 15, 13, 2, R[1], R[3], R[5]); rect(bx, by, 15, 13, R[3]); rect(bx, by, 15, 1, R[5]); rect(bx, by + 12, 15, 1, R[1]); rect(bx + 2, by + 4, 11, 1, R[1]); rect(bx + 2, by + 8, 11, 1, R[1]); put(bx + 2, by + 2, V[1], true); put(bx + 12, by + 2, V[1], true); rect(bx + 5, by + 10, 5, 1, V[1], true); }
          else if (face) { const bx = hx - face * 9 - 5, by = top + 6; box3(bx, by - 2, 10, 13, 2, R[1], R[2], R[4], true); rect(bx, by, 10, 13, R[2], false, true); rect(bx, by, 10, 1, R[4], false, true); put(face > 0 ? bx + 1 : bx + 8, by + 2, V[1], true, true); }
          else { for (const sgn of [-1, 1]) line(hx + sgn * 8, top + 9, hx + sgn * 8, top - 3, R[2], false, true); line(hx - 8, top - 3, hx + 8, top - 3, R[3], false, true); rect(hx - 6, top - 2, 12, 3, R[3], false, true); put(hx - 7, top - 3, V[1], true, true); put(hx + 7, top - 3, V[1], true, true); }
        }
        if (part === 'scope') { // 鹰眼：一只长镜筒目镜，背上一根天线
          if (!back) { const d1 = face || 1, sx0 = hx + d1 * 2; rect(sx0 - (d1 < 0 ? 1 : 0), top + 2, 2, 2, R[1]); line(sx0 + d1 * 2, top + 3, sx0 + d1 * 6, top + 3, R[3]); line(sx0 + d1 * 2, top + 2, sx0 + d1 * 5, top + 2, R[5]); put(sx0 + d1 * 7, top + 3, V[1], true); put(sx0 + d1 * 7, top + 2, V[2], true); }
          const ax = hx - (face || -1) * 3; line(ax, top + 2, ax - (face || 0), top - 6, R[2], false, true); put(ax - (face || 0), top - 7, V[1], true);
        }
        if (part === 'pods') { // 蜂巢：两肩各趴着一架小无人机
          for (const sgn of face ? [face, -face] : [-1, 1]) { const under = !!face && sgn === -face, px0 = sgn < 0 ? sl - 4 : sr - 1, py0 = sy - 7; box3(px0, py0, 5, 3, 1, R[1], R[3], R[5], under); line(px0 - 1, py0, px0 + 5, py0, R[5], false, under); put(px0 + 2, py0 + 3, V[1], true, under); }
        }
        if (part === 'cross') { const cx = hx - (back ? 0 : face), cy = top - 3; rect(cx, cy - 1, 3, 7, '#1a6a34'); rect(cx - 2, cy + 1, 7, 3, '#1a6a34'); rect(cx - 1, cy - 2, 3, 7, '#2ec860', true); rect(cx - 3, cy, 7, 3, '#2ec860', true); rect(cx, cy - 1, 1, 5, '#d0ffd8', true); rect(cx - 2, cy + 1, 5, 1, '#d0ffd8', true); }
        if (part === 'legs') { const by = top + 13; for (const sgn of face ? [-face, -face * 0.6] : [-1, 1]) for (const k of [0, 1]) { const s2 = Math.sign(sgn), x0 = hx + s2 * 3, x1 = x0 + s2 * (8 + k * 3), y1 = by - 9 + k * 6, x2 = x1 + s2 * (2 + k), y2 = y1 + 10; line(x0, by + 1, x1, y1 + 1, R[0], false, true); line(x1, y1 + 1, x2, y2, R[0], false, true); line(x0, by, x1, y1, R[3], false, true); line(x1, y1, x2, y2, R[2], false, true); put(x1, y1, R[4], false, true); put(x2, y2, V[1], true, true); } }
      }
      for (const k of modKeys) modPart(k, { put, rect, line, m, face, back });
      // 部件描黑边（只描新加的那些像素）
      const edge = []; for (const i of added) { const X = i % W, Y = (i / W) | 0; for (const [dx2, dy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = X + dx2, y = Y + dy2; if (x < ox || y < oy || x >= ox + fw || y >= oy + fh) continue; if (!P[(y * W + x) * 4 + 3]) edge.push((y * W + x) * 4); } }
      for (const i of edge) { P[i] = 11; P[i + 1] = 10; P[i + 2] = 20; P[i + 3] = 255; }
      // 厚度：整个剪影往右下多一像素最暗色，像有厚度的块
      const R0 = hex(R[0]), ext = [];
      for (let y = 0; y < fh - 1; y++) for (let x = 0; x < fw - 1; x++) { const i = ((oy + y) * W + ox + x) * 4, j = ((oy + y + 1) * W + ox + x + 1) * 4; if (P[i + 3] && !P[j + 3]) ext.push(j); }
      for (const j of ext) { P[j] = R0[0] >> 1; P[j + 1] = R0[1] >> 1; P[j + 2] = R0[2] >> 1; P[j + 3] = 255; }
    }
    ix.putImageData(id, 0, 0); ex.putImageData(eid, 0, 0);
    // 4. 和 D.HERO 一样的附属图：受击白、单色、轮廓光、涂装
    const H = { fw, fh, cols, meta, footY: B.footY + PAD_T, img, emit, ready: true, tints: {}, key, anch, mods: modKeys.join(',') };
    const mk = () => D.canvas(img.width, img.height)[0];
    H.flash = mk(); { const x = H.flash.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, img.width, img.height); }
    H.tint = col => { if (!H.tints[col]) { const t = mk(), x = t.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, img.width, img.height); H.tints[col] = t; } return H.tints[col]; };
    H.rim = (() => { const c = mk(), x = c.getContext('2d'); x.drawImage(img, 0, 0); const Wd = c.width, Hh = c.height, dd = x.getImageData(0, 0, Wd, Hh), s2 = dd.data, o = x.createImageData(Wd, Hh), t = o.data, a = (i, j) => (i < 0 || j < 0 || i >= Wd || j >= Hh) ? 0 : s2[(j * Wd + i) * 4 + 3]; for (let j = 0; j < Hh; j++) for (let i = 0; i < Wd; i++) { if (!a(i, j) || (a(i - 1, j) && a(i + 1, j) && a(i, j - 1) && a(i, j + 1))) continue; const k = (j * Wd + i) * 4; t[k] = 156; t[k + 1] = 196; t[k + 2] = 255; t[k + 3] = 255; } x.clearRect(0, 0, Wd, Hh); x.putImageData(o, 0, 0); return c; })();
    H.variants = {};
    H.variant = (tint, visor) => {
      const base = D.SHELLS[key] || {}; if ((!tint || tint === base.tint) && (!visor || visor === base.visor)) return H;
      const k2 = tint + '|' + visor; if (H.variants[k2]) return H.variants[k2];
      const recolor = (src, col, amt) => { const c = mk(), x = c.getContext('2d'); x.drawImage(src, 0, 0); if (col) { x.globalAlpha = amt; x.globalCompositeOperation = 'color'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0); } return c; };
      return (H.variants[k2] = Object.assign({}, H, { img: recolor(img, tint && tint !== base.tint ? tint : null, 0.75), emit: recolor(emit, visor && visor !== base.visor ? visor : null, 1) }));
    };
    return H;
  }
  const built = {}, lru = [];
  const sigOf = mods => ['armor', 'power', 'sensor'].map(s => (mods && mods[s]) || '').join(',');
  D.heroSig = sigOf;
  // 某个型号的图集。mods = 装着的改装件（画在身上）；anims = 只要这几个动画（改装台用，生成得快）。
  // 不带改装件：工壳就是原图，别的型号整套生成一次一直留着。带改装件的只留最近用过的几套（整套图集很大）。
  // 原图还没解码好时先用原图。
  D.heroOf = (key, mods, anims) => {
    if (!key || !DEFS[key]) return D.HERO;
    const sig = sigOf(mods), plain = sig === ',,';
    if (plain) anims = null; // 工壳也要生成（半立体的明暗）
    const id = key + '|' + sig + '|' + (anims ? anims.join(',') : '*');
    if (built[id]) { if (!plain && lru[lru.length - 1] !== id) { lru.splice(lru.indexOf(id), 1); lru.push(id); } return built[id]; }
    const H = build(key, plain ? null : mods, anims); if (!H) return D.HERO;
    built[id] = H;
    if (!plain) {
      lru.push(id); const drop = k => { delete built[k]; lru.splice(lru.indexOf(k), 1); };
      const full = lru.filter(k => k.endsWith('|*')); if (full.length > 3) drop(full[0]);
      if (lru.length > 48) drop(lru[0]);
    }
    return H;
  };
  D.heroVisor = key => (DEFS[key] ? DEFS[key].visor : ['#ff7a2e', '#ffb057', '#fff0c8']);
  for (const k in D.SHELLS) D.SHELLS[k].key = k;
})(D);
