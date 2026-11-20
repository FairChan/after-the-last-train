/* Underdog：开始页和据点首页的背景——这座城市的雨夜天际线（640×360 像素画）。
   画风和站里统一（pixfx.js + gfx.js 的 Post）：底色压暗，光走抖动光照（边缘是棋盘格），发光的东西进发光层泛光，四角暗角；
   渐变全是点阵过渡，远处被雾染浅、近处压暗，楼的右边一道月光描边。
   从远到近：夜空（上面深蓝、下面被城市照成暖色）和星星、月亮（发光）、两层云（底边被城市照亮）、远处楼群、雾带、中远楼群、
   中景楼群（亮着的窗、霓虹竖招牌、广告牌、天线红灯）、探照灯、地面的雾、高架地铁（桥面、栏杆、电线杆和电线、路灯、桥墩；
   每 7 秒开过一列车，车窗亮着、车头灯照着前面、车窗的光洒在桥面上）、最近处飞快掠过的楼顶剪影、细雨。
   一直往左走（像坐在车上看城市），越近越快，见 SPEED。没有人物。
   楼群按城市种子生成；静的部分先画进离屏画布（左右接得上），每帧只拼起来、再画会动的东西，最后走一遍 Post。
   main.js 在开始页和据点首页调 D.drawSkyline(ctx, time, seed)。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const W = D.W, H = D.H, X = D.Pix;
  const SPEED = { cloud: 4, far: 7, far2: 12, mid: 20, near: 38, fg: 76, train: 300 }; // 每秒多少像素
  const HORIZON = 268, DECK = 300;
  const SKY = ['#05070f', '#080d1d', '#0c152c', '#102039', '#152b47', '#1f3552', '#2d3a5c', '#433f63', '#5e4466', '#7c4a66', '#9a5463', '#b5625f'];
  const WIN = [['#ffcf7a', 6], ['#8fe6ff', 2.5], ['#ff8ad0', 1], ['#fff2c8', 0.8]];
  const AMBIENT = '#b4b8d6';
  const mod = (a, b) => ((a % b) + b) % b;
  let cache = null;

  // 像素缓冲：直接写 ImageData（左右绕回），画完一次性放进画布
  function PB(w, h) {
    const [c, g] = D.canvas(w, h), id = g.createImageData(w, h), d = id.data;
    const set = (x, y, col) => { x |= 0; y |= 0; if (y < 0 || y >= h) return; x = mod(x, w); const [r, gg, b] = X.rgb(col), p = (y * w + x) * 4; d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = 255; };
    const rect = (x, y, ww, hh, col) => { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) set(x + i, y + j, col); };
    const vramp = (x, y, ww, hh, cols, k0, k1) => { k0 = k0 || 0; k1 = k1 == null ? 1 : k1; for (let j = 0; j < hh; j++) { const k = k0 + (k1 - k0) * j / Math.max(1, hh - 1); for (let i = 0; i < ww; i++) set(x + i, y + j, X.ramp(cols, k, x + i, y + j)); } };
    return { w, h, c, set, rect, vramp, done() { g.putImageData(id, 0, 0); return c; } };
  }
  // 一层：底色 + 发光层，宽 LW（左右绕回），灯另记一张表（每帧按位置交给 Post）
  const Layer = LW => ({ LW, a: PB(LW, H), e: PB(LW, H), lights: [] });
  const glowPx = (L, x, y, w, h, col, ecol) => { L.a.rect(x, y, w, h, col); L.e.rect(x, y, w, h, ecol || col); };

  function build(seed) {
    const rng = D.rng('skyline:' + seed), lineCols = (D.LINE_COLORS || ['#ff3047', '#3ee8ff', '#ffb057']).slice(0, 8);
    // ── 夜空、月亮、星星
    const sky = PB(W, H), skyE = PB(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sky.set(x, y, X.ramp(SKY, y / HORIZON, x, y));
    const MX = 492, MY = 76, MR = 19;
    for (let y = -MR; y <= MR; y++) for (let x = -MR; x <= MR; x++) {
      const r = Math.hypot(x, y); if (r > MR + 0.3) continue;
      const lit = (x * 0.55 - y * 0.35) / MR, crater = X.hash(Math.floor((x + 40) / 4), Math.floor((y + 40) / 3)) < 0.18 && r < MR - 3;
      const col = r > MR - 1 ? '#d9cfb2' : X.ramp(['#8a826e', '#b4ac92', '#d4cbb0', '#e8dfc4'], 0.5 + lit * 0.5, x, y);
      sky.set(MX + x, MY + y, crater ? '#8a826c' : col); skyE.set(MX + x, MY + y, crater ? '#14130f' : X.ramp(['#1a1914', '#2c2a22', '#3e3a2e'], 0.5 + lit * 0.5, x, y));
    }
    const stars = [];
    for (let i = 0; i < 120; i++) {
      const x = rng.int(0, W - 1), y = rng.int(0, 175); if (Math.hypot(x - MX, y - MY) < 34) continue;
      const b = rng(); stars.push({ x, y, b, ph: rng() * 6.28, sp: 0.6 + rng() * 2 });
      if (b < 0.75) sky.set(x, y, X.ramp(['#1e2a4a', '#3a4a78', '#6a78a8'], b / 0.75 * (1 - y / 220), x, y));
    }
    // ── 云：一团团椭圆叠起来，边缘点阵；顶上暗、底边被城市照亮
    const clouds = PB(1280, H);
    const cloudBand = (n, y0, y1, ry0, ry1, lit) => {
      for (let k = 0; k < n; k++) {
        const cx = rng.int(0, 1279), cy = rng.int(y0, y1), parts = [];
        for (let m = 0, nn = rng.int(4, 7); m < nn; m++) parts.push({ x: cx + rng.int(-70, 70), y: cy + rng.int(-4, 3), rx: rng.int(26, 80), ry: rng.int(ry0, ry1) });
        const top = Math.min(...parts.map(p => p.y - p.ry)), bot = Math.max(...parts.map(p => p.y + p.ry)), left = Math.min(...parts.map(p => p.x - p.rx)), right = Math.max(...parts.map(p => p.x + p.rx));
        for (let y = top; y <= bot; y++) for (let x = left; x <= right; x++) {
          let dn = 0; for (const p of parts) { const q = 1 - ((x - p.x) / p.rx) ** 2 - ((y - p.y) / p.ry) ** 2; if (q > dn) dn = q; }
          if (!X.on(Math.min(1, dn * 2.6), x, y)) continue;
          clouds.set(x, y, X.ramp(lit, (y - top) / Math.max(1, bot - top), x, y));
        }
      }
    };
    cloudBand(7, 46, 112, 4, 9, ['#121a30', '#1a2340', '#2a2c4c', '#40385a']);
    cloudBand(7, 168, 214, 6, 15, ['#1a2038', '#2a2a48', '#4a3854', '#7a4a5c', '#a0585c']);
    // ── 楼群
    const tower = (L, o) => {
      for (let x = 0; x < L.LW;) {
        const w = rng.int(o.minW, o.maxW), h = rng.int(o.minH, o.maxH), top = o.base - h, body = rng.pick(o.body);
        // 墙面：上亮下暗（远处层反过来：越往下雾越浓），竖向壁柱、横向楼层线
        const cols = o.fog ? [body, o.fog] : [D.mixHex(body, '#4a5688', 0.1), body, D.mixHex(body, '#000000', 0.45)];
        L.a.vramp(x, top, w, H - top, cols, 0, o.fog ? 1 : Math.min(1, (H - top) / 150));
        if (!o.fog) {
          const pil = rng.pick([5, 6, 7, 8]), fl = rng.pick([4, 5, 6]);
          for (let i = pil; i < w - 2; i += pil) for (let y = top + 2; y < o.base; y++) if (X.hash(x + i, y >> 3) > 0.15) L.a.set(x + i, y, D.mixHex(body, '#5a6a9a', 0.12));
          for (let y = top + fl; y < o.base; y += fl) for (let i = 1; i < w - 1; i++) L.a.set(x + i, y, D.mixHex(body, '#000000', 0.3));
        }
        // 月光描边：右边一道（往下点阵淡掉）、楼顶一行
        for (let y = top; y < Math.min(o.base, top + 90); y++) if (X.on(1 - (y - top) / 90, x + w - 1, y)) L.a.set(x + w - 1, y, o.rim);
        for (let i = 0; i < w; i++) L.a.set(x + i, top, o.rim);
        // 退台、天线红灯、水箱
        if (o.roof && rng.chance(0.35)) { const sw = Math.max(5, Math.round(w * 0.5)), sx = x + ((w - sw) >> 1), sh = rng.int(4, 9); L.a.rect(sx, top - sh, sw, sh, body); for (let i = 0; i < sw; i++) L.a.set(sx + i, top - sh, o.rim); L.a.rect(sx + sw - 1, top - sh, 1, sh, o.rim); }
        if (o.roof && rng.chance(0.45)) { const ax = x + rng.int(2, Math.max(2, w - 3)), ah = rng.int(8, 22); L.a.rect(ax, top - ah, 1, ah, o.rim); if (rng.chance(0.75)) L.lights.push({ x: ax, y: top - ah - 1, c: '#ff3d4a', r: 10, a: 0.7, blink: 0.8 + rng(), ph: rng() * 6.28 }); }
        if (o.roof && rng.chance(0.2)) { const tx = x + rng.int(2, Math.max(2, w - 9)); L.a.rect(tx, top - 8, 7, 6, D.mixHex(body, '#000000', 0.25)); L.a.rect(tx, top - 8, 7, 1, o.rim); L.a.rect(tx + 1, top - 2, 1, 2, body); L.a.rect(tx + 5, top - 2, 1, 2, body); }
        // 窗：一格格，有的整层黑着；亮的进发光层
        const gx = o.win.gx || rng.pick([4, 5, 6]), gy = o.win.gy || rng.pick([5, 6, 7]), p = o.win.p * (0.4 + rng() * 1.3), ww = o.win.w, wh = o.win.h;
        for (let y = top + 4; y < o.base - 4; y += gy) {
          if (rng.chance(0.2)) continue;
          for (let wx = x + 3; wx < x + w - 3 - ww; wx += gx) {
            if (rng.chance(p)) { const wc = o.win.col ? o.win.col : rng.weighted(WIN); glowPx(L, wx, y, ww, wh, wc, o.win.ecol || wc); if (o.win.lights && rng.chance(0.04)) L.lights.push({ x: wx + 1, y: y + 1, c: wc, r: 18, a: 0.35 }); }
            else if (o.win.dark) L.a.rect(wx, y, ww, wh, o.win.dark);
          }
        }
        // 霓虹竖招牌（地铁线路色）、广告牌
        if (o.signs && w > 26 && rng.chance(0.2)) {
          const sx = x + w - 7, sy = top + rng.int(12, 40), sc = rng.pick(lineCols);
          L.a.rect(sx - 1, sy - 1, 6, 26, '#07070f'); glowPx(L, sx, sy, 4, 24, sc); for (let k = 2; k < 24; k += 5) glowPx(L, sx + 1, sy + k, 2, 2, '#ffffff');
          L.lights.push({ x: sx + 2, y: sy + 12, c: sc, r: 46, a: 0.75, buzz: rng() * 6.28 });
        }
        if (o.signs && w > 36 && rng.chance(0.14)) {
          const bw = Math.min(w - 8, rng.int(24, 40)), bh = rng.int(10, 16), bx = x + ((w - bw) >> 1), by = top + rng.int(6, 22), c1 = rng.pick(lineCols), c2 = rng.pick(['#fff2c8', '#8fe6ff', '#ff8ad0']);
          L.a.rect(bx - 1, by - 1, bw + 2, bh + 2, '#06060c');
          for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const c = X.ramp([D.mixHex(c1, '#000000', 0.7), D.mixHex(c1, '#000000', 0.4), c1, c2], ((i / bw) * 0.5 + (j / bh) * 0.3 + (Math.floor(i / 6) % 2) * 0.2), bx + i, by + j); L.a.set(bx + i, by + j, D.mixHex(c, '#000000', 0.2)); L.e.set(bx + i, by + j, D.mixHex(c, '#000000', 0.62)); }
          L.lights.push({ x: bx + bw / 2, y: by + bh / 2, c: c1, r: 60, a: 0.45, buzz: rng() * 6.28 });
        }
        x += w + (rng.chance(0.3) ? rng.int(1, 4) : 0);
      }
      return L;
    };
    const far = tower(Layer(1280), { base: HORIZON + 8, minH: 36, maxH: 150, minW: 12, maxW: 34, body: ['#363a62', '#3a3c66', '#33375c'], fog: '#6a5878', rim: '#5a5e8e', win: { p: 0.035, w: 1, h: 1, col: '#8a7aa0', ecol: '#2a2438' } });
    { const g = far, tx = 300; g.a.vramp(tx - 6, 70, 13, HORIZON + 8 - 70, ['#3c3f6a', '#6a5878']); g.a.rect(tx - 1, 30, 3, 40, '#4a4e7c'); g.a.rect(tx - 9, 96, 19, 5, '#43467a'); g.a.rect(tx - 4, 60, 9, 10, '#43467a'); g.lights.push({ x: tx, y: 29, c: '#ff3d4a', r: 14, a: 0.8, blink: 1.1, ph: 0 }); } // 远处的电视塔
    const far2 = tower(Layer(1280), { base: 284, minH: 40, maxH: 130, minW: 16, maxW: 44, body: ['#1c2040', '#1e2242', '#1a1e3c'], fog: '#2e2a50', rim: '#4a508a', roof: true, win: { p: 0.06, w: 1, h: 2, gx: 3, gy: 4, col: '#8a7a5a', ecol: '#3a3024' } });
    const mid = tower(Layer(1280), { base: DECK + 4, minH: 70, maxH: 210, minW: 24, maxW: 62, body: ['#0d1124', '#10142a', '#0c0f20', '#11132a'], rim: '#7a88c4', roof: true, signs: true, win: { p: 0.13, w: 2, h: 2, dark: '#0b0f20', lights: true } });
    // ── 高架：桥面、栏杆、电线杆和电线、路灯、桥墩
    const near = Layer(768);
    { const A = near.a, LW = 768;
      A.rect(0, DECK - 6, LW, 1, '#4a4e6c'); for (let x = 0; x < LW; x += 8) { A.rect(x, DECK - 5, 1, 5, '#2e3048'); A.rect(x + 1, DECK - 5, 1, 5, '#1d1f30'); } // 栏杆
      A.rect(0, DECK, LW, 1, '#6a6e8c'); A.vramp(0, DECK + 1, LW, 3, ['#4a4e68', '#383a52']); A.vramp(0, DECK + 4, LW, 7, ['#2c2e42', '#1e2030', '#16172a']); A.rect(0, DECK + 11, LW, 1, '#0c0c16'); A.rect(0, DECK + 12, LW, 3, '#14151f');
      for (let x = 0; x < LW; x += 48) A.rect(x, DECK + 1, 1, 10, '#101120'); // 桥面板接缝
      for (let x = 0; x < LW; x++) if (X.hash(x, 7) < 0.12) A.set(x, DECK + 5 + (X.hash(x, 9) * 5 | 0), '#121320'); // 水渍
      for (let x = 48; x < LW; x += 96) { // 桥墩
        A.rect(x - 9, DECK + 15, 18, 4, '#1c1d2c'); A.rect(x - 9, DECK + 15, 18, 1, '#2e3048');
        A.vramp(x - 6, DECK + 19, 12, H - DECK - 19, ['#1a1b2a', '#121320', '#0b0b14']); A.rect(x + 5, DECK + 19, 1, H - DECK - 19, '#2a2c44'); A.rect(x - 6, DECK + 19, 1, H - DECK - 19, '#0a0a12');
      }
      for (let x = 0; x < LW; x += 96) { // 电线杆、横担、路灯
        A.rect(x, DECK - 40, 2, 34, '#2a2c40'); A.rect(x + 2, DECK - 40, 1, 34, '#454964'); A.rect(x - 6, DECK - 36, 15, 1, '#2a2c40'); A.rect(x - 6, DECK - 35, 15, 1, '#1a1b28');
        if ((x / 96) % 2 === 0) { A.rect(x + 3, DECK - 39, 5, 1, '#2a2c40'); glowPx(near, x + 6, DECK - 38, 3, 1, '#ffd890'); near.lights.push({ x: x + 7, y: DECK - 36, c: '#ffc070', r: 58, a: 0.85, lamp: true }); }
      }
      for (let x = 0; x < LW; x++) { const k = mod(x, 96) / 96, sag = Math.round(Math.sin(k * Math.PI) * 4); A.set(x, DECK - 35 + sag, '#191a26'); A.set(x, DECK - 32 + sag, '#191a26'); } // 电线
    }
    // ── 最近处的楼顶剪影：栏杆、水箱、天线（掠过得飞快）
    const fg = Layer(1600);
    { const A = fg.a, LW = 1600, K = '#05060c', RIM = '#1c2240';
      for (let x = 0; x < LW;) {
        const w = rng.int(120, 320), top = rng.int(338, 350); A.rect(x, top, w, H - top, K); A.rect(x, top, w, 1, RIM);
        if (rng.chance(0.6)) for (let i = 0; i < w; i += 6) A.rect(x + i, top - 6, 1, 6, K); if (rng.chance(0.6)) A.rect(x, top - 6, w, 1, K);
        if (rng.chance(0.5)) { const tx = x + rng.int(10, w - 30), th = rng.int(16, 26); A.rect(tx, top - th - 8, 20, th, K); A.rect(tx, top - th - 8, 20, 1, RIM); A.rect(tx + 19, top - th - 8, 1, th, RIM); A.rect(tx + 2, top - 8, 2, 8, K); A.rect(tx + 16, top - 8, 2, 8, K); }
        if (rng.chance(0.35)) { const ax = x + rng.int(20, w - 10), ah = rng.int(50, 90); A.rect(ax, top - ah, 2, ah, K); A.rect(ax + 1, top - ah, 1, ah, RIM); A.rect(ax - 5, top - ah + 10, 12, 1, K); fg.lights.push({ x: ax + 1, y: top - ah - 1, c: '#ff3d4a', r: 16, a: 0.9, blink: 1.3, ph: rng() * 6.28 }); glowPx(fg, ax, top - ah - 2, 2, 2, '#ff3d4a'); }
        x += w + rng.int(60, 200);
      }
    }
    // ── 雾：点阵透明的两条带（雾带在远处楼群脚下，地面的雾在桥墩之间）
    const mist = PB(W, H);
    for (let y = 236; y < 292; y++) { const k = 1 - Math.abs(y - 266) / 28; for (let x = 0; x < W; x++) if (X.on(0.42 * k, x, y)) mist.set(x, y, '#7a6284'); }
    const mist2 = PB(W, H);
    for (let y = 306; y < H; y++) { const k = Math.min(1, (y - 306) / 50); for (let x = 0; x < W; x++) if (X.on(0.15 + 0.6 * k, x, y)) mist2.set(x, y, '#2e2848'); }
    // ── 探照灯：一根竖着的点阵光柱，每帧转着画
    const beam = PB(40, 260);
    for (let y = 0; y < 260; y++) { const hw = 2 + y * 0.05, a = 0.4 * (1 - y / 260); for (let x = 0; x < 40; x++) if (Math.abs(x - 20) < hw && X.on(a * (1 - Math.abs(x - 20) / hw * 0.6), x, y)) beam.set(x, y, '#1c2436'); }
    const fin = o => (o.c = o.a.done(), o.e = o.e.done(), o);
    return { seed, sky: sky.done(), skyE: skyE.done(), stars, clouds: clouds.done(), far: fin(far), far2: fin(far2), mid: fin(mid), near: fin(near), fg: fin(fg), mist: mist.done(), mist2: mist2.done(), beam: beam.done(), lineCols, moon: { x: MX, y: MY } };
  }

  // 一层按偏移拼两张（左右接上）；发光层同样拼进 Post 的发光层；灯交给 Post
  function layer(ctx, L, off, time, ex) {
    const x0 = -mod(off, L.LW);
    for (let x = x0; x < W; x += L.LW) { ctx.drawImage(L.c, x, 0); if (ex) ex.drawImage(L.e, x, 0); }
    for (const l of L.lights) {
      let a = l.a; if (l.blink) { if (Math.sin(time * 2.4 * l.blink + l.ph) < 0.3) continue; } if (l.buzz != null) a *= 0.85 + 0.15 * Math.sin(time * 23 + l.buzz) * (Math.sin(time * 1.3 + l.buzz) > 0.92 ? 1 : 0.2);
      for (let x = mod(l.x - off, L.LW); x < W + l.r; x += L.LW) if (x > -l.r) { X.light(x, l.y, l.r, l.c, a); if (l.blink && ex) { ex.fillStyle = l.c; ex.fillRect(Math.round(x), l.y, 1, 1); } }
    }
  }
  // 高架上的列车：每 7 秒一班，从右往左开过去
  function train(ctx, ex, C, time) {
    const cyc = 7, tt = time % cyc, CL = 112, GAP = 4, N = 4, len = N * (CL + GAP);
    const x0 = Math.round(W + 30 - tt * SPEED.train); C.trainX = null; if (x0 + len < -40) return; C.trainX = x0; // 测试用：列车在哪
    const n = Math.floor(time / cyc), lc = C.lineCols[n % C.lineCols.length], y = DECK - 19;
    const R = (x, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, yy, w, h); }, E = (x, yy, w, h, c) => { R(x, yy, w, h, c); ex.fillStyle = c; ex.fillRect(x, yy, w, h); };
    for (let k = 0; k < N; k++) {
      const cx = x0 + 10 + k * (CL + GAP); if (cx > W + 10 || cx + CL < -10) continue;
      R(cx - 1, y - 1, CL + 2, 19, '#0b0a14');
      R(cx, y, CL, 1, '#a8b0c4'); R(cx, y + 1, CL, 2, '#7a8296'); R(cx, y + 3, CL, 8, '#5a6276'); R(cx, y + 11, CL, 2, D.mixHex(lc, '#000000', 0.25)); R(cx, y + 13, CL, 2, '#3e4456'); R(cx, y + 15, CL, 2, '#2a2e3c');
      for (let i = 0; i < CL; i += 2) R(cx + i, y + 10, 1, 1, '#4e5568'); // 点阵过渡到线路色带
      for (const ux of [18, 72]) { R(cx + ux, y - 3, 16, 3, '#3a4052'); R(cx + ux, y - 3, 16, 1, '#6a7286'); }
      for (let wx = 6; wx < CL - 8; wx += 13) {
        if (wx > 44 && wx < 62) continue;
        E(cx + wx, y + 4, 9, 5, '#e8b870'); E(cx + wx, y + 4, 9, 1, '#ffe2a6');
        const h = X.hash(n * 31 + k * 7, wx); if (h < 0.55) { R(cx + wx + 2 + (h * 10 | 0) % 5, y + 6, 2, 3, '#4a3e3a'); ex.fillStyle = '#000000'; ex.fillRect(cx + wx + 2 + (h * 10 | 0) % 5, y + 6, 2, 3); }
      }
      R(cx + 46, y + 2, 14, 13, '#4e5668'); R(cx + 52, y + 2, 1, 13, '#2e3442'); E(cx + 48, y + 4, 3, 5, '#ffe2a6'); E(cx + 55, y + 4, 3, 5, '#ffe2a6'); // 车门
      for (const bx of [10, CL - 28]) { R(cx + bx, y + 17, 18, 2, '#1a1c26'); for (const wx of [3, 13]) { R(cx + bx + wx, y + 18, 3, 2, '#0d0e14'); R(cx + bx + wx + 1, y + 18, 1, 1, '#4a4e60'); } }
      if (k < N - 1) R(cx + CL, y + 3, GAP, 11, '#22242e');
      X.light(cx + CL / 2, DECK + 2, 40, '#ffb86a', 0.3); // 车窗的光洒在桥面上
      if (k === 0) { // 车头：斜的前脸、挡风玻璃、车头灯照着前面
        for (let r = 0; r < 17; r++) { const w = r < 6 ? 6 - r : 0; R(cx - 1, y + r, 1, 1, '#0b0a14'); if (w) R(cx, y + r, w, 1, '#0b0a14'); }
        R(cx + 2, y + 4, 6, 5, '#1d2a3a'); E(cx + 3, y + 5, 2, 1, '#6a8aa8');
        E(cx + 1, y + 12, 3, 2, '#fff6d0'); X.light(cx - 4, y + 12, 70, '#fff2c8', 0.9);
        for (let s = 1; s < 6; s++) X.light(cx - s * 34, DECK - 1, 40 - s * 4, '#fff0c8', 0.5 - s * 0.07);
        for (let s = 0; s < 70; s++) { const hw = 1 + s * 0.12; for (let j = -hw; j <= hw; j++) if (X.on(0.35 * (1 - s / 70), cx - s, y + 12 + j | 0)) { ex.fillStyle = '#2a2618'; ex.fillRect(cx - 2 - s, Math.round(y + 12 + j), 1, 1); } }
      }
      if (k === N - 1) { E(cx + CL - 3, y + 12, 2, 2, '#ff3047'); X.light(cx + CL, y + 12, 20, '#ff3047', 0.6); }
    }
    ctx.fillStyle = '#0b0a14';
  }

  // ── 每帧
  D.drawSkyline = function (ctx, time, seed) {
    seed = seed || 'LANCHUAN';
    if (!cache || cache.seed !== seed) cache = build(seed);
    const C = cache, ex = D.Post && D.Post.ex, S = SPEED;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(C.sky, 0, 0); if (ex) ex.drawImage(C.skyE, 0, 0);
    for (const s of C.stars) { const k = Math.sin(time * s.sp + s.ph); if (s.b >= 0.75 && k > -0.2 && ex) { ex.fillStyle = k > 0.7 ? '#c8d0ff' : '#5a6290'; ex.fillRect(s.x, s.y, 1, 1); if (s.b > 0.96 && k > 0.85) { ex.fillStyle = '#3a4270'; ex.fillRect(s.x - 1, s.y, 3, 1); ex.fillRect(s.x, s.y - 1, 1, 3); } } }
    X.light(C.moon.x, C.moon.y, 170, '#6a88cc', 0.36); X.light(C.moon.x, C.moon.y, 34, '#fff0d0', 0.18);
    const co = time * S.cloud; for (let x = -mod(co, 1280); x < W; x += 1280) ctx.drawImage(C.clouds, x, 0);
    layer(ctx, C.far, time * S.far, time, ex);
    ctx.drawImage(C.mist, 0, 0);
    layer(ctx, C.far2, time * S.far2, time, ex);
    // 探照灯：两根光柱在中景楼后面慢慢扫
    if (ex) for (const [bx, sp, ph] of [[120, 0.31, 0], [360, 0.23, 2.6]]) { ex.save(); ex.translate(bx, 300); ex.rotate(Math.sin(time * sp + ph) * 0.42); ex.drawImage(C.beam, -20, -260); ex.restore(); }
    layer(ctx, C.mid, time * S.mid, time, ex);
    ctx.drawImage(C.mist2, 0, 0);
    layer(ctx, C.near, time * S.near, time, ex);
    if (ex) train(ctx, ex, C, time);
    layer(ctx, C.fg, time * S.fg, time, ex);
    // 细雨：斜着往下，一道两段
    ctx.fillStyle = '#6a78a8';
    for (let i = 0; i < 70; i++) { const x = Math.round(mod(X.hash(i, 1) * (W + 60) - time * 110, W + 60) - 30), y = Math.round(mod(X.hash(i, 2) * (H + 40) + time * (380 + X.hash(i, 3) * 120), H + 40) - 20); ctx.fillRect(x, y, 1, 2); ctx.fillRect(x - 1, y + 2, 1, 2); }
    X.finish(ctx, AMBIENT);
    ctx.restore();
  };
  D.skylineState = () => cache && Object.assign(cache, { speed: SPEED }); // 测试用
})(D);
