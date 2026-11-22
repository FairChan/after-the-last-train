/* 末班之后 · 小样二：站内房间
   一个房间 = 碰撞格 + 预先画好的地面墙面 + 会挡住角色的摆设（按脚底 y 排序）+ 光源。
   世界坐标一格 16 单位；地面、墙面、摆设都按 2 倍（每格 32 像素）画，细节更细。
   三种主题：站台（下方是轨道）、商场（上墙是店面和霓虹）、车库（警示条和货箱）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, TS = 16, Z = 2;
  D.TS = TS;

  const THEMES = {
    platform: { floor: ['#2a3045', '#2c334b', '#2f364f'], grout: '#1f2336', wall: '#1a1d2d', face: ['#262b40', '#30364f'], neon: ['#3ee8ff', '#ffb057'], ambient: '#1c1e36', lamp: '#ffcf8a' },
    mall:     { floor: ['#31283d', '#352b42', '#2f283c'], grout: '#231c2d', wall: '#1b1424', face: ['#2a2036', '#352944'], neon: ['#ff3d8b', '#3ee8ff', '#9b6bff'], ambient: '#21182f', lamp: '#ffb3d4' },
    depot:    { floor: ['#2d3236', '#33393c', '#2a2f33'], grout: '#1c1f22', wall: '#171a1d', face: ['#262b2f', '#2f353a'], neon: ['#ffb057', '#8dff6a'], ambient: '#1a1d22', lamp: '#ffd27a' },
  };

  D.THEMES = THEMES;
  D.makeArena = function (rng, theme, big) {
    const th = THEMES[theme], tw = big ? 25 : 22, tht = big ? 15 : 14;
    const A = { theme, th, tw, tht, w: tw * TS, h: tht * TS, solid: new Uint8Array(tw * tht), props: [], lights: [], ambient: th.ambient };
    const S = (x, y) => A.solid[y * tw + x] = 1;
    for (let x = 0; x < tw; x++) { S(x, 0); S(x, 1); S(x, tht - 1); }
    for (let y = 0; y < tht; y++) { S(0, y); S(tw - 1, y); }
    if (theme === 'platform') for (let x = 0; x < tw; x++) { S(x, tht - 2); S(x, tht - 3); }
    const floorBottom = theme === 'platform' ? tht - 4 : tht - 2;
    A.floorBottom = floorBottom;
    A.spawn = { x: tw * TS / 2, y: (floorBottom - 1.5) * TS };
    const kinds = theme === 'platform' ? [['pillar', 4], ['bench', 3], ['bin', 2], ['vending', 2]] : theme === 'mall' ? [['planter', 3], ['vending', 3], ['pillar', 2], ['bench', 2], ['kiosk', 1]] : [['crate', 5], ['barrel', 3], ['pillar', 2], ['vending', 1]];
    const want = big ? 6 : rng.int(5, 8);
    const taken = new Set();
    for (let n = 0, tries = 0; n < want && tries < 200; tries++) {
      const k = rng.weighted(kinds), x = rng.int(3, tw - 4), y = rng.int(4, floorBottom - 2);
      if (Math.abs(x * TS + 8 - A.spawn.x) < 48 && Math.abs(y * TS - A.spawn.y) < 40) continue;
      if (Math.abs(x - tw / 2) < 3 && Math.abs(y - (floorBottom + 2) / 2) < 2) continue;
      const wide = k === 'bench' || k === 'kiosk' ? 2 : 1;
      let ok = true;
      for (let a = -1; a <= wide; a++) for (let b = -1; b <= 1; b++) if (taken.has((x + a) + ',' + (y + b))) ok = false;
      if (!ok) continue;
      for (let a = 0; a < wide; a++) { taken.add((x + a) + ',' + y); S(x + a, y); }
      A.props.push(makeProp(k, x, y, th, rng));
      n++;
    }
    bakeFloor(A, rng);
    for (let x = 3; x < tw - 2; x += rng.int(5, 7)) {
      const broken = rng.chance(0.25);
      A.lights.push({ x: x * TS + 8, y: 2 * TS - 4, oy: 40, r: 105, col: th.lamp, a: broken ? 0.6 : 0.9, flick: broken ? 0.6 : 0.04, seed: rng() * 100, shaft: true });
    }
    for (const s of A.signs) A.lights.push({ x: s.x, y: s.y + 10, r: 70, col: s.col, a: 0.7, flick: 0.05, seed: rng() * 100 });
    for (const p of A.props) if (p.light) A.lights.push(Object.assign({ seed: rng() * 100 }, p.light));
    if (theme === 'platform') for (let x = 2; x < tw; x += 6) A.lights.push({ x: x * TS, y: (tht - 2) * TS, r: 40, col: '#ff3047', a: 0.45, flick: 0.02, seed: x });
    return A;
  };

  D.solidAt = (A, px, py) => { const x = Math.floor(px / TS), y = Math.floor(py / TS); return x < 0 || y < 0 || x >= A.tw || y >= A.tht || A.solid[y * A.tw + x] === 1; };
  D.collide = function (A, o) {
    const r = o.r;
    for (let it = 0; it < 2; it++) {
      const x0 = Math.floor((o.x - r) / TS), x1 = Math.floor((o.x + r) / TS), y0 = Math.floor((o.y - r) / TS), y1 = Math.floor((o.y + r) / TS);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!(x < 0 || y < 0 || x >= A.tw || y >= A.tht || A.solid[y * A.tw + x])) continue;
        const nx = D.clamp(o.x, x * TS, x * TS + TS), ny = D.clamp(o.y, y * TS, y * TS + TS);
        const dx = o.x - nx, dy = o.y - ny, d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 0.0001) { o.x += dx / d * (r - d); o.y += dy / d * (r - d); }
          else { const l = o.x - x * TS, rr = x * TS + TS - o.x, u = o.y - y * TS, b = y * TS + TS - o.y, m = Math.min(l, rr, u, b); if (m === l) o.x -= l + r; else if (m === rr) o.x += rr + r; else if (m === u) o.y -= u + r; else o.y += b + r; }
        }
      }
    }
    o.x = D.clamp(o.x, TS + r, A.w - TS - r); o.y = D.clamp(o.y, 2 * TS + r, A.h - TS - r);
  };
  D.move = function (A, o, dx, dy) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3)); for (let i = 0; i < n; i++) { o.x += dx / n; o.y += dy / n; D.collide(A, o); } };
  // 视线：两点之间有没有墙或摆设挡着
  D.losClear = function (A, x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 4); for (let i = 1; i < n; i++) if (D.solidAt(A, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false; return true; };

  // ── 摆设（2 倍精度画）
  D.makeProp = makeProp;
  // 站内地图第二代 P5：摆设的图按"种类 + 抽到的结果"缓存（一站上百件摆设，以前每件都新建三张画布，进站慢）。
  //   随机数照旧一个不少地从 rng 取：先空跑一遍画法记下每次抽到的结果（取的数和以前完全一样），同样的结果直接用缓存的图，
  //   没见过的再照记下的数重放一遍真画。画出来和以前逐像素一样，只是不再画 mkSprite 的受击白层（摆设用不到）。
  //   审稿修复 I2：缓存封顶 D.PROP_CAP 张（最近用过的留着，最久没用的先丢；丢了下次照记下的数重画，图一样、取数不变）。花盆、货架这类每件都不一样，不封顶会一站站越攒越多
  const PROP_CACHE = new Map(), NOOP = () => {};
  D.PROP_CAP = 400; D.propCacheSize = () => PROP_CACHE.size;
  const DRY = { set: NOOP, px: NOOP, rect: NOOP, line: NOOP, disc: NOOP, ell: NOOP, box: NOOP, grad: NOOP, outline: NOOP };
  function recRng(src) {
    let mode = 0, ri = 0, deep = 0; const raw = [], key = [];
    const r = () => { if (mode) return raw[ri++]; const v = src(); raw.push(v); if (!deep) key.push(v); return v; };
    const kv = (v, a0) => typeof v === 'boolean' ? +v : v && typeof v === 'object' ? (Array.isArray(a0) ? 'i' + a0.indexOf(v) : '?') : v; // 抽到的色阶（数组）记下标，颜色、数记本身
    const m = f => (...a) => { deep++; try { const v = f(...a); if (!mode) key.push(kv(v, a[0])); return v; } finally { deep--; } };
    r.int = m((lo, hi) => lo + Math.floor(r() * (hi - lo + 1)));
    r.range = m((lo, hi) => lo + r() * (hi - lo));
    r.pick = m(arr => arr[Math.floor(r() * arr.length)]);
    r.chance = m(p => r() < p);
    r.weighted = m(list => { let s = 0; for (const [, w] of list) s += w; let x = r() * s; for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[list.length - 1][0]; });
    r.shuffle = arr => { deep++; try { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; key.push(j); } return arr; } finally { deep--; } };
    r.mark = () => raw.length; // 空跑开始前取过几个数（画法外面抽的颜色等），重放从这里接着
    r.replay = at => { mode = 1; ri = at; };
    r.key = () => key.join(',');
    return r;
  }
  const HEXN = new Map(), hexN = c => { let n = HEXN.get(c); if (n == null) { n = parseInt(c.slice(1, 7), 16); HEXN.set(c, n); } return n; };
  function propSprite(w, h, fn) { // 同 D.mkSprite（画、描黑边），只出本体和发光层两张
    const p = D.Paint(w, h); fn(p); p.outline();
    const [img, ix] = D.canvas(w, h), a = ix.createImageData(w, h), A = a.data; let b = null;
    for (let i = 0; i < w * h; i++) {
      const c = p.col[i]; if (!c) continue;
      const n = hexN(c), q = i * 4; A[q] = (n >> 16) & 255; A[q + 1] = (n >> 8) & 255; A[q + 2] = n & 255; A[q + 3] = 255;
      if (p.em[i]) { if (!b) b = new ImageData(w, h); b.data[q] = A[q]; b.data[q + 1] = A[q + 1]; b.data[q + 2] = A[q + 2]; b.data[q + 3] = 255; }
    }
    ix.putImageData(a, 0, 0);
    let emit = null; if (b) { const [e, ex] = D.canvas(w, h); ex.putImageData(b, 0, 0); emit = e; }
    return { img, emit };
  }
  // P7：平铺的面按色阶挑色（4×4 点阵抖动，和画板 box / ell 一样的过渡）
  const BAY4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const tone = (ramp, v, x, y) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(Math.max(0, Math.min(0.999, v)) * ramp.length + ((BAY4[((y & 3) << 2) | (x & 3)] + 0.5) / 16 - 0.5) * 0.9)))];
  function makeProp(k, tx, ty, th, rng0) {
    const rng = recRng(rng0);
    const R = D.RAMP, fx = tx * TS, fy = ty * TS + TS;
    let w = 28, h = 48, light = null, fn;
    if (k === 'pillar') { h = 88; const neon = th.neon[0]; fn = p => { p.box(1, 0, 26, 88, R.dark, { v: 0.85 }); p.box(1, 0, 26, 10, R.steel, { r: 1 }); p.rect(2, 30, 24, 3, neon, 1); p.rect(2, 33, 24, 1, '#0c0e17'); p.box(0, 78, 28, 10, R.dark); for (let i = 0; i < 8; i++) p.rect(4 + rng.int(0, 18), 40 + rng.int(0, 34), 1, rng.int(2, 6), '#151a29'); p.rect(4, 12, 1, 64, '#3d4766'); }; }
    else if (k === 'vending') { h = 56; const col = rng.pick(['#3ee8ff', '#ff3d8b', '#8dff6a']); const ramp = col === '#3ee8ff' ? R.glass : col === '#ff3d8b' ? R.magenta : R.green; fn = p => { p.box(1, 0, 26, 56, R.magenta, { v: 0.45, r: 2 }); p.grad(4, 6, 14, 26, ramp, 1); for (let j = 9; j < 30; j += 6) { p.rect(5, j, 12, 1, '#ffffff', 1); for (let i = 0; i < 4; i++) p.rect(5 + i * 3, j + 1, 2, 3, rng.pick(['#ff7a2e', '#ffd95c', '#f0535e', '#9cc4ff']), 1); } p.box(20, 8, 5, 14, R.dark); p.rect(21, 11, 3, 2, '#ff3047', 1); p.box(5, 38, 18, 9, R.dark); }; light = { x: fx + 6, y: fy - 6, r: 50, col, a: 0.85, flick: 0.03 }; }
    else if (k === 'bench') { w = 64; h = 28; fn = p => { p.box(3, 14, 4, 13, R.dark); p.box(57, 14, 4, 13, R.dark); for (let i = 0; i < 3; i++) p.box(1, 4 + i * 4, 62, 4, R.crate, { r: 1 }); p.box(1, 0, 62, 4, R.crate); }; }
    else if (k === 'kiosk') { w = 64; h = 60; const col = rng.pick(th.neon); fn = p => { p.box(1, 0, 62, 60, R.dark, { v: 0.7 }); p.rect(3, 2, 58, 10, col, 1); for (let i = 6; i < 58; i += 9) p.rect(i, 4, 5, 6, '#0b0a14'); p.box(3, 14, 58, 42, R.steel, { v: 0.4 }); for (let j = 17; j < 54; j += 3) p.rect(4, j, 56, 1, '#20263b'); }; light = { x: fx + 16, y: fy - 18, r: 56, col, a: 0.7, flick: 0.05 }; }
    else if (k === 'planter') { h = 44; fn = p => { for (let i = 0; i < 9; i++) { const a = rng.int(5, 22), hh = rng.int(8, 22); p.line(a, 22, a + rng.int(-4, 4), 22 - hh, rng.pick(['#3a8a3a', '#2a5a2a', '#5a7a2a', '#6a442c'])); p.px(a, 22 - hh, '#78c46a'); } p.box(2, 20, 24, 23, R.magenta, { v: 0.4, r: 2 }); p.rect(3, 21, 22, 2, '#3e281b'); }; }
    else if (k === 'bin') { w = 22; h = 32; fn = p => { p.box(2, 4, 18, 28, R.green, { r: 2, v: 0.5 }); p.box(1, 1, 20, 5, R.green, { r: 1 }); p.rect(5, 14, 12, 2, '#0e2a12'); }; }
    else if (k === 'crate') { h = 36; fn = p => { p.box(1, 2, 26, 34, R.crate, { r: 1 }); p.line(3, 4, 25, 33, '#432a16'); p.line(25, 4, 3, 33, '#432a16'); p.rect(1, 18, 26, 2, '#24160c'); if (rng.chance(0.5)) p.rect(4, 24, 6, 6, '#e3c14a'); }; }
    else if (k === 'desk') { w = 60; h = 36; const scr = rng.pick([R.glass, R.green, R.blue]); fn = p => { p.box(1, 14, 58, 12, R.crate, { r: 1, v: 0.5 }); p.rect(4, 26, 3, 9, '#20263b'); p.rect(53, 26, 3, 9, '#20263b'); p.box(8, 1, 18, 14, R.dark, { r: 1 }); p.grad(10, 3, 14, 10, scr, 1); p.box(32, 3, 16, 12, R.dark, { r: 1 }); p.grad(34, 5, 12, 8, scr, 1); p.rect(12, 16, 20, 3, '#3d4766'); }; light = { x: fx + 16, y: fy - 16, r: 34, col: '#58a3bd', a: 0.55, flick: 0.08 }; }
    else if (k === 'cabinet') { h = 50; const col = rng.pick(['#8dff6a', '#ff3047', '#ffb057']); fn = p => { p.box(1, 0, 26, 50, R.steel, { r: 1, v: 0.45 }); p.rect(13, 2, 1, 46, '#161a2a'); for (let j = 6; j < 40; j += 7) { p.rect(4, j, 6, 2, '#232a42'); p.rect(17, j, 6, 2, '#232a42'); } for (let i = 0; i < 4; i++) p.px(5 + i * 2, 44, i % 2 ? col : '#3ee8ff', 1); p.px(20, 44, col, 1); }; light = { x: fx + 8, y: fy - 4, r: 26, col, a: 0.5, flick: 0.2 }; }
    else if (k === 'bed') { w = 60; h = 30; fn = p => { p.box(1, 8, 58, 18, R.white, { r: 3 }); p.box(3, 4, 14, 12, R.white, { r: 3, bias: 0.15 }); p.rect(20, 12, 36, 2, '#b3b9cf'); p.rect(2, 26, 3, 4, '#555d7a'); p.rect(55, 26, 3, 4, '#555d7a'); }; }
    else if (k === 'machine') { w = 60; h = 56; fn = p => { p.box(2, 20, 56, 34, R.yellow, { r: 3, v: 0.5 }); for (let i = 0; i < 6; i++) p.line(4 + i * 9, 52, 10 + i * 9, 44, '#1a1206'); p.box(16, 2, 28, 22, R.gunmetal, { r: 2 }); p.box(24, 22, 12, 10, R.silver, { r: 1 }); p.grad(6, 26, 8, 10, R.green, 1); p.rect(44, 28, 8, 3, '#ff3047', 1); }; light = { x: fx + 10, y: fy - 20, r: 30, col: '#8dff6a', a: 0.4, flick: 0.1 }; }
    else if (k === 'shelf') { w = 60; h = 48; fn = p => { p.box(1, 0, 58, 48, R.crate, { v: 0.35 }); for (const yy of [2, 17, 32]) { p.rect(3, yy + 12, 54, 2, '#432a16'); for (let i = 0; i < 5; i++) if (rng.chance(0.7)) p.box(5 + i * 10, yy + 3, 8, 9, rng.pick([R.red, R.blue, R.olive, R.white, R.yellow]), { r: 1 }); } }; }
    else if (k === 'gate') { w = 32; h = 44; const lit = (tx + ty) % 2 ? '#ff3047' : '#8dff6a'; fn = p => { // 站厅闸机（第二代 P2 的闸机排）：钢灰机身、顶盖、读卡面板，顶上进 / 出两盏小灯（发光）
      p.box(3, 11, 26, 32, R.steel, { r: 2, v: 0.5 }); p.rect(4, 14, 1, 26, '#6f84b3'); p.rect(27, 14, 1, 26, '#161a2a');
      p.box(2, 5, 28, 8, R.gunmetal, { r: 2, v: 0.7 }); p.rect(5, 7, 7, 2, '#8dff6a', 1); p.rect(20, 7, 7, 2, '#ff3047', 1);
      p.box(8, 16, 16, 15, R.dark, { r: 1, v: 0.6 }); p.grad(10, 18, 7, 6, R.glass, 1); p.box(18, 19, 4, 4, R.yellow, { r: 1 });
      for (let i = 0; i < 4; i++) p.rect(5 + i * 6, 38, 3, 2, '#c48d1f');
    }; light = { x: fx + 8, y: fy - 16, r: 18, col: lit, a: 0.4, flick: 0.03 }; }
    // ── 第二代 P3 小场景的摆设（src/vignettes-*.js）：都用画板的 box / ell 上色，自动描黑边，光从左上来
    else if (k === 'sandbag') { h = 30; fn = p => { // 沙袋（P5 重画，审稿 M10）：扁的布袋（倒角盒子，上亮下暗）像砌砖一样错缝码三层，两头扎口收窄、
      //   袋与袋之间压出暗缝，麻布的点状纹理，顶上一道高光
      const OL = ['#141a0e', '#253017', '#3a4a22', '#566a31', '#6f8640', '#8fa858', '#b4c880'];
      for (const [x, y, bw] of [[0, 22, 10], [9, 22, 10], [18, 22, 10], [4, 15, 10], [14, 15, 10], [8, 8, 11]]) {
        p.box(x, y, bw, 8, OL, { r: 3, v: 0.62 });
        p.px(x, y + 3, '#253017'); p.px(x + bw - 1, y + 4, '#253017'); // 扎口收窄
        p.line(x + 2, y + 1, x + bw - 4, y + 1, '#b4c880'); // 顶上的高光
        for (let q = 0; q < 5; q++) p.px(x + 2 + ((q * 3 + y) % (bw - 4)), y + 3 + (q % 3), q & 1 ? '#3a4a22' : '#6f8640'); // 麻布纹理
        p.line(x + 1, y + 7, x + bw - 2, y + 7, '#0e130a'); // 压在下面那层上的暗缝
      }
    }; }
    else if (k === 'benchfall') { w = 64; h = 26; fn = p => { // 翻倒的长椅：椅面朝外竖着，两条腿朝上翘
      p.box(4, 1, 4, 14, R.dark, { r: 1 }); p.box(56, 1, 4, 14, R.dark, { r: 1 }); p.rect(6, 7, 52, 2, '#20263b');
      for (let i = 0; i < 3; i++) p.box(1, 12 + i * 4, 62, 4, R.crate, { r: 1, v: 0.6 - i * 0.08 });
      p.line(20, 13, 26, 16, '#432a16'); p.line(44, 17, 50, 19, '#432a16'); p.px(62, 13, '#d6a066'); }; }
    else if (k === 'bedroll') { w = 60; h = 20; const ramp = rng.pick([R.blue, R.olive, R.red]); fn = p => { // 睡袋：卷着的枕头 + 拉开一角的睡袋
      p.box(12, 4, 46, 14, ramp, { r: 4, v: 0.55 }); for (let x = 20; x < 56; x += 8) p.rect(x, 6, 1, 10, ramp[1]);
      p.box(12, 4, 15, 14, ramp, { r: 4, v: 0.75 }); p.ell(7, 11, 6.5, 5.5, R.white, { flat: true }); p.rect(3, 10, 8, 1, '#848ca8'); }; }
    else if (k === 'firebarrel') { h = 44; fn = p => { // 篝火桶：生锈的油桶，桶口火苗（发光）
      p.box(2, 14, 24, 30, R.rust, { r: 2, v: 0.5 }); p.rect(2, 22, 24, 2, '#3b2018'); p.rect(2, 35, 24, 2, '#3b2018');
      p.rect(8, 28, 3, 2, '#ff7a2e', 1); p.rect(17, 31, 2, 2, '#ffb057', 1);
      p.ell(14, 14, 12, 3.5, R.dark, { flat: true });
      p.ell(14, 11, 9, 5, R.yellow, { emit: true, bias: 0.15 }); p.ell(10, 7, 3, 5, R.yellow, { emit: true, bias: 0.25 }); p.ell(17, 5, 2.5, 5, R.yellow, { emit: true, bias: 0.3 }); p.ell(14, 3, 1.5, 3, R.yellow, { emit: true, bias: 0.4 });
      for (const [x, y] of [[7, 1], [20, 2], [12, 0]]) p.px(x, y, '#fff3b0', 1); }; light = { x: fx + 7, y: fy - 16, r: 74, col: '#ff8a3a', a: 0.9, flick: 0.35 }; }
    else if (k === 'roadblock') { w = 64; h = 34; fn = p => { // 路障（键名不叫 barrier：env-art.js 的场景摆设早有 barrier，会盖掉这个）：红白斜纹挡板，两条腿，顶上一盏警示灯
      p.box(5, 14, 4, 17, R.dark); p.box(55, 14, 4, 17, R.dark); p.box(0, 30, 13, 4, R.gunmetal, { r: 1 }); p.box(51, 30, 13, 4, R.gunmetal, { r: 1 });
      p.box(1, 4, 62, 12, R.white, { r: 1, v: 0.7 }); for (let i = 0; i < 5; i++) p.box(4 + i * 12, 5, 6, 10, R.red, { v: 0.6 });
      p.box(29, 0, 6, 5, R.yellow, { r: 1, emit: true }); }; light = { x: fx + 16, y: fy - 16, r: 28, col: '#ffb057', a: 0.55, flick: 0.5 }; }
    else if (k === 'stanchion') { h = 40; fn = p => { // 排队隔离带的立柱，带子往右垂下去
      p.ell(8, 36, 6.5, 2.5, R.gunmetal, { flat: true }); p.box(6, 6, 4, 30, R.silver, { r: 1, v: 0.6 }); p.ell(8, 6, 3, 3, R.silver, { spec: true });
      p.box(10, 9, 3, 4, R.gunmetal, { r: 1 }); p.line(13, 10, 19, 14, '#c82e3a'); p.line(19, 14, 27, 12, '#c82e3a'); p.line(13, 11, 19, 15, '#5a1218'); p.line(19, 15, 27, 13, '#5a1218'); }; }
    else if (k === 'cartons') { h = 40; fn = p => { // 一摞纸箱：三层，封箱胶带、标签
      p.box(1, 22, 26, 18, R.crate, { r: 1, v: 0.55 }); p.box(3, 9, 22, 14, R.crate, { r: 1, v: 0.65 }); p.box(8, 0, 14, 10, R.crate, { r: 1, v: 0.75 });
      p.rect(13, 22, 2, 18, '#d6a066'); p.rect(13, 9, 2, 13, '#d6a066'); p.rect(14, 0, 2, 10, '#d6a066'); p.rect(4, 28, 6, 4, '#dde1ee'); p.rect(5, 29, 4, 1, '#555d7a'); }; }
    else if (k === 'bucket') { w = 22; h = 26; fn = p => { // 接漏水的铁桶（P5 重画，M10）：桶身圆柱（左亮右暗、两道加强筋），桶口椭圆的里壁、半桶水的反光，提手一道弧，锈点；画高一点，玩的时候看得清
      const ST = D.RAMP.steel, RU = D.RAMP.rust;
      for (let x = 2; x < 20; x++) { const u = (x - 2) / 17, v = 0.78 - 0.55 * u + (u < 0.15 ? 0.1 : 0); for (let y = 10; y < 25; y++) p.px(x, y, ST[Math.max(0, Math.min(6, Math.floor((v - 0.12 * (y - 10) / 15) * 7)))]); }
      for (const y of [14, 20]) { p.line(2, y, 19, y, '#232a42'); p.line(2, y - 1, 19, y - 1, '#a3b6dc'); } // 加强筋
      p.ell(11, 25, 9, 1.5, ST, { flat: true, bias: -0.3 }); // 桶底
      p.ell(11, 10, 9.5, 3.5, ST, { flat: true, bias: 0.15 }); p.ell(11, 10.5, 8, 2.5, D.RAMP.dark, { flat: true }); // 桶口：亮的卷边 + 暗的里壁
      p.ell(11, 11, 6.5, 1.8, D.RAMP.glass, { flat: true, bias: 0.05 }); p.line(7, 11, 10, 11, '#a6e2f0'); p.px(13, 11, '#58a3bd'); // 半桶水和反光
      for (const [x, y] of [[5, 17], [6, 18], [15, 22], [16, 22], [4, 23]]) p.px(x, y, RU[3]); p.px(15, 21, RU[5]); // 锈点
      p.line(2, 9, 6, 2, '#6f84b3'); p.line(6, 2, 16, 2, '#a3b6dc'); p.line(16, 2, 20, 9, '#4c5c86'); p.px(6, 1, '#dbe5fa'); // 提手
    }; }
    else if (k === 'tvm') { h = 56; fn = p => { // 售票机：屏幕碎了，只剩一角还亮
      p.box(1, 0, 26, 56, R.steel, { r: 2, v: 0.5 }); p.box(4, 5, 20, 15, R.dark, { r: 1 }); p.grad(5, 6, 7, 6, R.glass, 1);
      p.line(8, 8, 16, 17, '#a6e2f0'); p.line(16, 17, 22, 12, '#58a3bd'); p.line(12, 12, 20, 7, '#2f6e88');
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) p.box(5 + i * 5, 24 + j * 5, 4, 4, R.gunmetal, { r: 1 }); p.rect(20, 25, 3, 7, '#0c0e17'); p.box(6, 42, 16, 7, R.dark, { r: 1 }); p.rect(8, 44, 12, 1, '#3d4766'); }; }
    else if (k === 'botwreck') { w = 32; h = 32; fn = p => { // 机器残骸（P5 重画，M10）：侧翻的巡逻机——圆顶头（球面、高光、灭掉的红眼）、躯干装甲板（倒角、面板缝、铆钉）、
      //   履带底盘翻起来一截（一节节的齿）、断臂露出的电线（三色）和火花（发光）、身下一摊油
      const GM = D.RAMP.gunmetal, ST = D.RAMP.steel;
      p.ell(16, 29, 15, 2.5, ['#06070a', '#0c0e14', '#14161e'], { flat: true }); // 油
      p.box(3, 22, 22, 7, D.RAMP.dark, { r: 2, v: 0.5 }); for (let x = 5; x < 24; x += 3) { p.px(x, 23, '#646e86'); p.px(x, 27, '#2d3342'); } // 履带底盘
      p.box(6, 12, 20, 12, GM, { r: 2, v: 0.62 }); p.line(7, 17, 24, 17, '#101218'); p.line(7, 18, 24, 18, '#646e86'); for (const x of [8, 23]) { p.px(x, 14, '#c8cdda'); p.px(x, 21, '#c8cdda'); } // 躯干装甲
      p.box(15, 14, 7, 3, D.RAMP.yellow, { v: 0.6 }); p.line(15, 14, 21, 16, '#2a1c06'); // 警示漆（刮花了）
      p.ell(9, 10, 7, 6.5, GM, { spec: true }); p.ell(7.5, 10, 2.2, 1.6, D.RAMP.red, { flat: true, bias: -0.35 }); p.px(6, 9, '#8f1d26'); // 圆顶头、灭掉的眼
      p.box(24, 6, 4, 10, ST, { r: 1, v: 0.55 }); p.box(25, 3, 3, 4, GM, { r: 1 }); // 断臂
      p.line(26, 3, 30, 0, '#c82e3a'); p.line(27, 3, 31, 2, '#3466c0'); p.line(25, 3, 28, 0, '#eab52e'); // 露出来的电线
      p.px(30, 0, '#fff3b0', 1); p.px(31, 1, '#ffd95c', 1); p.px(29, 1, '#ffb057', 1); p.line(20, 22, 25, 25, '#ff7a2e'); // 火花
    }; light = { x: fx + 12, y: fy - 14, r: 22, col: '#ffb057', a: 0.5, flick: 0.6 }; }
    else if (k === 'lockerfall') { w = 60; h = 28; fn = p => { // 推倒的储物柜（P5 重画，M10）：侧躺的柜子看得出是个盒子——朝上的侧板（亮、有凹痕）、朝外的柜门面（暗、百叶通风口、把手），
      //   一扇门翻开压在地上露出空的里面，散出来几张纸
      const ST = D.RAMP.steel;
      p.box(1, 6, 46, 9, ST, { r: 1, v: 0.78 }); p.line(14, 8, 20, 9, '#4c5c86'); p.px(15, 7, '#dbe5fa'); p.px(33, 9, '#34405f'); p.px(34, 9, '#4c5c86'); // 朝上的侧板 + 凹痕
      p.box(1, 15, 46, 11, ST, { r: 1, v: 0.42 }); // 朝外的柜门面
      for (const x0 of [3, 26]) { for (let x = x0 + 2; x < x0 + 16; x += 3) { p.line(x, 17, x, 20, '#161a2a'); p.line(x + 1, 17, x + 1, 20, '#6f84b3'); } p.box(x0 + 17, 21, 2, 3, D.RAMP.silver, {}); } // 百叶 + 把手
      p.line(24, 15, 24, 25, '#161a2a'); p.line(25, 15, 25, 25, '#6f84b3'); // 两扇门的缝
      p.box(47, 9, 12, 16, D.RAMP.dark, { v: 0.35 }); p.rect(48, 11, 10, 2, '#0c0e17'); // 空的里面
      p.box(47, 20, 13, 7, ST, { r: 1, v: 0.6 }); p.line(48, 21, 58, 21, '#c4d2ee'); // 翻开压在地上的门
      for (const [x, y, ww] of [[30, 25, 5], [38, 26, 4]]) { p.rect(x, y, ww, 2, '#dde1ee'); p.px(x, y + 1, '#848ca8'); } // 散出来的纸
    }; }
    else if (k === 'vendbroke') { h = 56; fn = p => { // 被撬开的售货机：玻璃碎了、门歪着，一条灯管还在闪
      p.box(1, 0, 26, 56, R.magenta, { v: 0.4, r: 2 }); p.box(4, 6, 15, 27, R.dark, { r: 1 }); p.rect(5, 5, 13, 1, '#ff3d8b', 1);
      p.line(4, 6, 9, 15, '#a6e2f0'); p.line(19, 7, 14, 13, '#58a3bd'); p.line(4, 33, 8, 27, '#58a3bd'); p.rect(6, 22, 3, 3, '#f0535e'); p.rect(12, 28, 3, 3, '#ffd95c');
      p.box(20, 8, 5, 14, R.dark); p.box(5, 38, 18, 9, R.dark); p.line(7, 40, 20, 45, '#0c0e17'); }; light = { x: fx + 6, y: fy - 22, r: 30, col: '#ff3d8b', a: 0.45, flick: 0.55 }; }
    // ── 第二代 P6 站台的小场景摆设（src/vignettes-03.js）
    else if (k === 'luggage') { h = 34; const ramp = rng.pick([R.blue, R.red, R.olive, R.magenta]); fn = p => { // 丢下的行李：立着的硬壳箱（拉杆、竖压纹、两个小轮），脚下横着一个旅行袋
      p.rect(9, 0, 2, 7, '#646e86'); p.rect(17, 0, 2, 7, '#434b5f'); p.rect(9, 0, 10, 2, '#949fb6'); // 拉杆
      p.box(5, 6, 18, 20, ramp, { r: 2, v: 0.6 }); for (const x of [10, 14, 18]) { p.line(x, 9, x, 23, ramp[1]); p.line(x - 1, 9, x - 1, 23, ramp[4]); }
      p.box(12, 8, 4, 2, R.dark, { r: 1 }); p.box(6, 25, 3, 3, R.dark); p.box(19, 25, 3, 3, R.dark); // 把手、轮子
      p.ell(14, 29, 12.5, 4.5, R.cloth, { bias: 0.1 }); p.line(5, 30, 23, 30, '#2f1d13'); p.line(8, 26, 20, 26, '#ad7a52'); p.box(12, 27, 4, 2, R.silver, {}); // 旅行袋、拉链头
    }; }
    else if (k === 'aidkit') { h = 30; fn = p => { // 应急箱：钢架上挂着一只红色急救箱（白十字、搭扣），盖子掀开一条缝，地上几卷绷带
      p.box(3, 10, 3, 19, R.gunmetal, { r: 1 }); p.box(22, 10, 3, 19, R.gunmetal, { r: 1 }); p.rect(3, 27, 22, 2, '#2d3342');
      p.box(2, 4, 24, 16, R.red, { r: 2, v: 0.6 }); p.box(2, 2, 24, 4, R.red, { r: 1, v: 0.78 }); p.line(3, 6, 24, 6, '#2a0a0e');
      p.rect(12, 8, 4, 10, '#f8f9ff'); p.rect(9, 11, 10, 4, '#f8f9ff'); p.rect(13, 9, 2, 8, '#dde1ee'); // 十字
      p.box(4, 13, 3, 3, R.silver, {}); p.box(21, 13, 3, 3, R.silver, {}); // 搭扣
      p.ell(8, 27, 3, 2, R.white, { bias: 0.1 }); p.ell(19, 28, 2.5, 1.6, R.white, {}); p.px(23, 9, '#ff98a0', 1); // 绷带、指示灯
    }; light = { x: fx + 15, y: fy - 9, r: 16, col: '#ff3047', a: 0.4, flick: 0.4 }; }
    else if (k === 'mcart') { w = 60; h = 40; fn = p => { // 检修推车（宽 2 格）：两层钢架、推把，上层工具箱和一卷电缆，下层一桶油漆，四个脚轮；车边挂着一根拖把
      p.box(4, 34, 5, 5, R.dark, { r: 2 }); p.box(48, 34, 5, 5, R.dark, { r: 2 });
      p.box(2, 14, 52, 5, R.steel, { r: 1, v: 0.62 }); p.box(2, 28, 52, 5, R.steel, { r: 1, v: 0.5 }); for (const x of [3, 50]) p.box(x, 14, 3, 20, R.gunmetal, { r: 1 });
      p.line(54, 15, 58, 4, '#949fb6'); p.line(55, 15, 59, 4, '#434b5f'); p.box(55, 1, 5, 4, R.dark, { r: 1 }); // 推把
      p.box(7, 4, 20, 11, R.yellow, { r: 1, v: 0.6 }); p.rect(8, 8, 18, 1, '#5a3e0d'); p.box(14, 1, 6, 3, R.gunmetal, {}); // 工具箱
      p.ell(38, 9, 7, 5.5, R.dark, { bias: 0.1 }); p.ell(38, 9, 3, 2.5, R.gunmetal, { flat: true }); p.line(44, 12, 49, 14, '#2a2f45'); // 电缆卷
      p.box(22, 20, 12, 9, R.blue, { r: 1, v: 0.6 }); p.ell(28, 20, 6, 1.6, R.white, { flat: true }); // 油漆桶
      p.line(0, 3, 6, 34, '#8f5e33'); p.ell(6, 36, 4, 2.5, R.white, { bias: -0.2 }); // 拖把
    }; }
    // ── 第二代 P7 小场景的摆设（src/vignettes-04.js 起；三段新历史和户外用的）：画板的 box / ell 上色、自动描黑边、光从左上来；平铺的面用 tone（4×4 点阵抖动挑色阶）
    else if (k === 'qcurtain') { w = 60; h = 52; fn = p => { // 隔离帘（宽 2 格）：钢架两根立柱 + 顶上黄黑斜纹的横杆，挂一排半透明的塑料条，中间一条扯掉了、一条斜挂着
      const PL = ['#2c3a46', '#4d6474', '#7892a2', '#a8c2cf', '#d4e8ef', '#f2fbff'];
      p.box(0, 46, 9, 5, R.dark, { r: 1 }); p.box(51, 46, 9, 5, R.dark, { r: 1 });
      for (let i = 0; i < 7; i++) { if (i === 4) continue; const x0 = 6 + i * 7, len = 34 + rng.int(-4, 6); p.box(x0, 6, 6, len, PL, { v: 0.56 - (i & 1) * 0.08 }); p.line(x0 + 1, 8, x0 + 1, 3 + len, '#e4f1f6'); p.px(x0 + 3, 5 + len, PL[1]); }
      p.line(34, 6, 41, 39, '#7892a2'); p.line(35, 6, 42, 39, '#a8c2cf'); p.line(36, 6, 43, 39, '#4d6474'); // 斜挂的那条
      p.box(1, 4, 4, 47, R.gunmetal, { r: 1, v: 0.62 }); p.box(55, 4, 4, 47, R.gunmetal, { r: 1, v: 0.55 });
      p.box(1, 1, 58, 5, R.yellow, { r: 1, v: 0.66 }); for (let x = 4; x < 57; x += 6) p.line(x, 5, x + 3, 2, '#1a1206');
    }; }
    else if (k === 'hazsuit') { w = 30; h = 22; fn = p => { // 扔在地上的防护服：一团黄色的连体服、兜帽上的防毒面具（圆镜片、滤罐），一只白手套
      p.ell(16, 15, 13, 6, R.yellow, { bias: -0.04 }); p.box(19, 13, 10, 6, R.yellow, { r: 2, v: 0.48 }); // 衣身、折过来的一条腿
      p.line(9, 13, 21, 17, '#5a3e0d'); p.line(13, 20, 20, 12, '#8f6516'); p.line(24, 14, 28, 18, '#5a3e0d'); // 褶子
      p.ell(7, 11, 6, 5, R.yellow, { bias: 0.06 }); p.ell(6.5, 11, 3.4, 2.8, R.dark, { spec: true }); p.px(5, 10, '#a6e2f0'); // 兜帽、面具镜片
      p.ell(10.5, 15, 2.2, 1.8, R.gunmetal, {}); p.px(10, 14, '#949fb6'); // 滤罐
      p.ell(25, 8, 3.5, 2.5, R.white, { bias: 0.05 }); // 手套
    }; }
    else if (k === 'sprayer') { w = 24; h = 40; fn = p => { // 消毒喷雾罐：背负式白色药桶（两道黄色箍、顶上压杆），一根软管接着喷杆斜靠在旁边
      p.ell(12, 37, 9, 2.5, R.dark, { flat: true });
      p.box(3, 10, 15, 27, R.white, { r: 3, v: 0.62 }); p.ell(10.5, 10, 7.5, 3, R.white, { flat: true, bias: 0.12 });
      p.rect(3, 18, 15, 2, '#c48d1f'); p.rect(3, 28, 15, 2, '#c48d1f'); p.rect(3, 18, 15, 1, '#eab52e');
      p.ell(10.5, 23.5, 2.6, 2.6, R.green, { flat: true }); p.px(10, 23, '#b4ec98'); // 一个绿色的圆标（不写字）
      p.box(8, 4, 5, 6, R.gunmetal, { r: 1 }); p.line(11, 4, 15, 1, '#646e86');
      p.line(13, 7, 20, 3, '#2d3342'); p.line(20, 3, 21, 26, '#2d3342'); p.line(21, 3, 22, 26, '#646e86'); p.box(20, 26, 4, 3, R.steel, {}); p.px(22, 30, '#d4e8ef');
    }; }
    else if (k === 'biobin') { w = 24; h = 34; fn = p => { // 黄色的医疗废物桶：盖子、提手，桶身上一个三瓣的黑色标记（只画图形）
      p.box(3, 8, 18, 25, R.yellow, { r: 2, v: 0.56 }); p.box(1, 3, 22, 6, R.yellow, { r: 1, v: 0.76 }); p.box(9, 0, 6, 4, R.dark, { r: 1 });
      for (const [x, y] of [[12, 15], [8, 23], [16, 23]]) p.disc(x, y, 2.4, '#2a1c06'); p.disc(12, 20, 2.2, '#2a1c06'); p.disc(12, 20, 1, '#eab52e');
      p.line(4, 31, 19, 31, '#5a3e0d'); p.rect(16, 4, 5, 1, '#fff3b0');
    }; }
    else if (k === 'tarp') { w = 60; h = 40; const ramp = rng.pick([R.blue, R.olive, R.cloth]); fn = p => { // 拾荒者的帐篷布（宽 2 格）：人字棚，左半边迎光亮、右半边暗，中间的门帘口黑着，补丁，两头拉着绳子压着石头
      for (let y = 2; y < 38; y++) { const half = Math.round((y - 2) * 0.78) + 1; for (let x = 30 - half; x < 30 + half; x++) { const u = (x - 30 + half) / (2 * half), v = (u < 0.5 ? 0.8 - u * 0.5 : 0.42 - (u - 0.5) * 0.5) - y / 38 * 0.15; p.px(x, y, tone(ramp, v, x, y)); } }
      for (let y = 17; y < 38; y++) { const hw = Math.round((y - 17) * 0.36); for (let x = 30 - hw; x <= 30 + hw; x++) p.px(x, y, tone(R.dark, 0.32 - (x - 30 + hw) / (2 * hw + 1) * 0.22, x, y)); }
      p.line(30, 3, 30, 16, ramp[1]); for (const [x, y] of [[12, 24], [15, 25], [44, 30], [47, 31]]) p.px(x, y, ramp[ramp.length - 1]);
      p.box(10, 22, 8, 6, R.cloth, { r: 1, v: 0.55 }); // 补丁
      p.box(28, 0, 4, 4, R.cloth, { r: 1 }); p.line(1, 38, 9, 29, '#d6a066'); p.line(59, 38, 51, 29, '#ad7a52');
      p.box(0, 35, 5, 4, R.gunmetal, { r: 1 }); p.box(55, 35, 5, 4, R.gunmetal, { r: 1 });
    }; }
    else if (k === 'cookpot') { h = 40; fn = p => { // 拾荒者的炊具：三根铁条的支架吊着一口锅，锅下一小堆柴火（发光），一圈灰
      p.ell(14, 37, 11, 2.5, R.dark, { flat: true }); p.box(6, 32, 16, 4, R.cloth, { r: 1, v: 0.5 }); p.line(7, 35, 21, 32, '#2f1d13');
      p.ell(14, 29, 6, 4.5, R.yellow, { emit: true, bias: 0.08 }); p.ell(12, 26, 2, 3, R.yellow, { emit: true, bias: 0.3 }); p.ell(16, 26.5, 1.6, 2.5, R.yellow, { emit: true, bias: 0.25 }); p.px(14, 24, '#fff3b0', 1);
      p.ell(14, 18, 8, 6, R.gunmetal, { spec: true }); p.ell(14, 13, 8, 2, R.dark, { flat: true }); p.line(6, 13, 22, 13, '#949fb6'); p.px(9, 12, '#c8cdda');
      p.line(3, 39, 14, 2, '#434b5f'); p.line(25, 39, 14, 2, '#2d3342'); p.line(14, 2, 14, 11, '#949fb6'); p.px(14, 1, '#646e86');
    }; light = { x: fx + 7, y: fy - 6, r: 54, col: '#ff8a3a', a: 0.75, flick: 0.3 }; }
    else if (k === 'junkpile') { w = 30; h = 30; fn = p => { // 捡来的东西堆成一堆：底下一摊土和破布，木板、锈管子、旧轮胎、罐头、一台旧电扇
      p.ell(15, 23, 14, 6.5, R.cloth, { bias: -0.12 });
      p.box(1, 14, 18, 4, R.crate, { r: 1, v: 0.62 }); p.line(4, 15, 15, 16, '#432a16');
      p.box(13, 9, 15, 3, R.rust, { r: 1, v: 0.6 }); p.px(27, 10, '#1f0f0c');
      p.ell(8, 21, 6, 5, R.dark, { bias: 0.04 }); p.ell(8, 21, 2.5, 2, R.gunmetal, { flat: true });
      p.box(18, 16, 6, 8, R.steel, { r: 1, v: 0.7 }); p.rect(18, 19, 6, 1, '#c82e3a');
      p.ell(23, 6, 5, 5, R.blue, { spec: true }); p.line(23, 2, 23, 10, '#0a1630'); p.line(19, 6, 27, 6, '#0a1630'); p.box(22, 11, 3, 4, R.gunmetal, {});
    }; }
    else if (k === 'scrapcart') { w = 30; h = 36; fn = p => { // 堆满捡来东西的购物车：筐里冒出纸箱、布包、一截管子，钢丝网一格一格，推把、四个小轮
      p.box(3, 11, 23, 16, R.dark, { v: 0.35 }); p.box(5, 3, 12, 10, R.crate, { r: 1, v: 0.7 }); p.ell(20, 8, 6, 4.5, R.olive, { bias: 0.05 }); p.line(2, 6, 13, 1, '#a8653d'); p.line(2, 7, 13, 2, '#5c3423');
      for (let x = 3; x <= 25; x += 3) p.line(x, 11, x + 1, 27, '#949fb6'); for (let y = 14; y <= 26; y += 4) p.line(3, y, 26, y, '#646e86');
      p.line(2, 10, 27, 10, '#c8cdda'); p.line(26, 10, 29, 4, '#949fb6'); p.box(25, 1, 5, 4, R.red, { r: 1 });
      p.line(4, 28, 24, 28, '#434b5f'); for (const x of [4, 21]) p.box(x, 30, 5, 5, R.dark, { r: 2 });
    }; }
    else if (k === 'burntbox') { h = 50; fn = p => { // 烧坏的配电箱：柜门炸开歪在一边，柜子上半截熏黑，里面烧化的开关、垂下来的线，还在冒电火花（发光）
      p.box(1, 4, 24, 46, R.steel, { r: 1, v: 0.44 });
      for (let y = 4; y < 34; y++) for (let x = 1; x < 25; x++) if (((x * 7 + y * 13) % 17) < 17 - (y - 4) * 0.58) p.px(x, y, (x + y) % 3 ? '#0c0e17' : '#1d212c'); // 熏黑（往下越来越淡）
      p.box(4, 9, 17, 26, R.dark, { v: 0.35 });
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) p.box(5 + i * 4, 11 + j * 6, 3, 4, j < 2 ? R.dark : R.gunmetal, {});
      p.line(6, 32, 9, 38, '#2d3342'); p.line(12, 33, 13, 39, '#c82e3a'); p.line(16, 33, 15, 40, '#3466c0');
      p.box(21, 8, 6, 30, R.steel, { r: 1, v: 0.58 }); p.line(22, 12, 25, 20, '#161a2a');
      for (const [x, y] of [[9, 13], [14, 18], [10, 21]]) { p.px(x, y, '#e8fbff', 1); p.px(x + 1, y - 1, '#9cc4ff', 1); } p.px(15, 12, '#ffd95c', 1);
    }; light = { x: fx + 6, y: fy - 18, r: 30, col: '#9cc4ff', a: 0.55, flick: 0.85 }; }
    else if (k === 'cablepile') { w = 30; h = 20; fn = p => { // 一堆烧焦的电缆：几圈黑胶皮盘在地上，烧破的地方露出铜芯
      p.ell(15, 13, 13, 6, R.dark, { bias: 0.06 }); p.ell(15, 12, 9, 4, R.gunmetal, { bias: -0.12 }); p.ell(15, 12, 5, 2, R.dark, { flat: true });
      p.line(4, 10, 10, 6, '#20263b'); p.line(10, 6, 20, 5, '#2d3342'); p.line(20, 5, 27, 9, '#20263b');
      for (const [x, y] of [[6, 14], [21, 16], [12, 8], [24, 10]]) { p.px(x, y, '#e3975a'); p.px(x + 1, y, '#bd6d2c'); }
      p.line(27, 12, 29, 17, '#2d3342'); p.px(29, 18, '#ffd0a0');
    }; }
    else if (k === 'tires') { h = 34; fn = p => { // 一摞旧轮胎（三个）：侧面的胎纹、中间黑洞洞的
      for (const [y, rx] of [[27, 13], [19, 12.5], [11, 12]]) { p.ell(14, y, rx, 5, R.dark, { bias: 0.06 }); p.ell(14, y - 1, rx * 0.45, 1.8, ['#06070a', '#0c0e14'], { flat: true }); for (let x = 3; x < 25; x += 3) p.px(x, y + 2, '#3d4766'); }
    }; }
    else { h = 36; w = 26; const ramp = rng.pick([D.RAMP.red, D.RAMP.blue, D.RAMP.yellow]); fn = p => { p.box(1, 2, 24, 34, ramp, { r: 4 }); p.rect(1, 12, 24, 2, '#0b0a14'); p.rect(1, 25, 24, 2, '#0b0a14'); p.ell(13, 4, 10, 2.5, ramp, { flat: true }); p.rect(5, 6, 2, 26, '#ffffff30'); }; }
    const at0 = rng.mark(); fn(DRY); // 空跑：取数、记结果
    const key = k + '|' + w + '|' + h + '|' + (k === 'pillar' ? th.neon[0] : k === 'gate' ? (tx + ty) % 2 : '') + '|' + rng.key();
    let spr = PROP_CACHE.get(key);
    if (spr) { PROP_CACHE.delete(key); PROP_CACHE.set(key, spr); } // 挪到最新
    else { rng.replay(at0); spr = propSprite(w, h, fn); PROP_CACHE.set(key, spr); if (PROP_CACHE.size > D.PROP_CAP) PROP_CACHE.delete(PROP_CACHE.keys().next().value); }
    return { kind: k, x: fx + w / Z / 2, y: fy, w: w / Z, h: h / Z, img: spr.img, emit: spr.emit, light };
  }

  // ── 地面与墙面（2 倍精度）
  function bakeFloor(A, rng) {
    const th = A.th, W2 = A.w * Z, H2 = A.h * Z, T2 = TS * Z;
    const [c, x] = D.canvas(W2, H2), [em, ex] = D.canvas(W2, H2);
    A.floor = c; A.floorEmit = em; A.signs = [];
    const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const E = (a, b, w, h, col) => { R(a, b, w, h, col); ex.fillStyle = col; ex.fillRect(a, b, w, h); };
    R(0, 0, W2, H2, th.wall);
    for (let ty = 2; ty < A.floorBottom + 1; ty++) for (let tx = 1; tx < A.tw - 1; tx++) {
      const px = tx * T2, py = ty * T2, base = rng.pick(th.floor);
      R(px, py, T2, T2, base);
      if (A.theme === 'depot') { // 混凝土板 + 铆钉
        R(px, py, T2, 1, th.grout); R(px, py, 1, T2, th.grout); R(px + 1, py + 1, T2 - 1, 1, '#ffffff0a');
        if ((tx + ty) % 3 === 0) { R(px + 3, py + 3, 2, 2, '#00000040'); R(px + T2 - 5, py + 3, 2, 2, '#00000040'); }
      } else { // 瓷砖：每块 16×16 像素，带高光和暗边
        for (const [ox, oy] of [[0, 0], [16, 0], [0, 16], [16, 16]]) {
          R(px + ox, py + oy, 16, 1, th.grout); R(px + ox, py + oy, 1, 16, th.grout);
          R(px + ox + 1, py + oy + 1, 14, 1, '#ffffff10'); R(px + ox + 1, py + oy + 15, 15, 1, '#00000026'); R(px + ox + 15, py + oy + 1, 1, 15, '#00000018');
          if (A.theme === 'mall' && ((tx * 2 + ty * 2 + ox / 16 + oy / 16) & 1)) R(px + ox + 1, py + oy + 1, 15, 15, '#ffffff07');
        }
      }
      if (rng.chance(0.2)) { let a = px + rng.int(4, 27), b = py + rng.int(4, 27); for (let i = 0; i < rng.int(6, 14); i++) { R(a, b, 1, 1, '#0c0e1780'); a += rng.int(-1, 1); b += rng.int(0, 1); } }
      if (rng.chance(0.15)) for (let i = 0; i < 10; i++) R(px + rng.int(0, 30), py + rng.int(0, 30), rng.int(1, 4), 1, '#00000030');
    }
    // 大片污渍（抖动散点）
    for (let n = 0; n < 16; n++) {
      const cx = rng.int(T2, W2 - T2), cy = rng.int(2 * T2, A.floorBottom * T2), rr = rng.int(24, 70);
      for (let i = 0; i < rr * rr * 0.7; i++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * rr; if (rng() < 1 - d / rr) R(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.7), 1, 1, '#00000026'); }
    }
    // 水洼：倒映霓虹，边上一圈亮边
    for (let n = 0; n < rng.int(2, 4); n++) {
      const cx = rng.int(3, A.tw - 4) * T2, cy = rng.int(4, A.floorBottom - 1) * T2, rw = rng.int(20, 44), rh = rng.int(7, 13), nc = rng.pick(th.neon);
      for (let j = -rh; j <= rh; j++) { const hw = Math.round(rw * Math.sqrt(1 - (j * j) / (rh * rh + 1))); R(cx - hw, cy + j, hw * 2, 1, '#151c30'); R(cx - hw, cy + j, 1, 1, '#ffffff20'); }
      R(cx - rw * 0.5, cy - 2, rw * 0.6, 1, D.rgba(nc, 0.6)); R(cx - rw * 0.3, cy, rw * 0.3, 1, D.rgba(nc, 0.35)); R(cx - 6, cy + 3, 9, 1, '#ffffff40');
    }
    if (A.theme === 'platform') {
      const yy = (A.floorBottom * TS + 10) * Z;
      for (let px = T2; px < W2 - T2; px += 8) { R(px, yy, 6, 8, '#e3c14a'); R(px, yy, 6, 1, '#fff0a0'); R(px, yy + 8, 6, 2, '#7a6420'); for (let k = 0; k < 2; k++) R(px + 1 + k * 3, yy + 2, 2, 2, '#b8941f'); }
      const ty0 = (A.tht - 3) * T2;
      R(T2, ty0, W2 - 2 * T2, 2 * T2, '#0c0e17'); R(T2, ty0, W2 - 2 * T2, 3, '#2a2f45');
      for (let px = T2; px < W2 - T2; px += 14) { R(px, ty0 + 12, 8, 44, '#2a1f1c'); R(px, ty0 + 12, 8, 1, '#4a3a32'); }
      for (const ry of [20, 44]) { R(T2, ty0 + ry, W2 - 2 * T2, 4, '#5a6075'); R(T2, ty0 + ry, W2 - 2 * T2, 1, '#c8cfe0'); R(T2, ty0 + ry + 3, W2 - 2 * T2, 1, '#2a2f45'); }
    }
    if (A.theme === 'depot') for (let px = T2; px < W2 - T2; px += 16) { R(px, 2 * T2, 8, 6, '#e3c14a'); R(px + 8, 2 * T2, 8, 6, '#14161f'); }
    // 上墙立面
    const fh = 2 * T2;
    R(0, 0, W2, fh, th.face[0]);
    for (let px = 0; px < W2; px += 32) { R(px, 8, 1, fh - 12, '#00000040'); R(px + 1, 8, 1, fh - 12, '#ffffff0a'); }
    R(0, 0, W2, 6, '#0a0b12'); R(0, fh - 6, W2, 6, '#12141f'); R(0, fh - 7, W2, 1, '#ffffff18');
    let px = T2 + rng.int(0, 32);
    while (px < W2 - 128) {
      const kind = rng.pick(A.theme === 'mall' ? ['sign', 'sign', 'shutter'] : A.theme === 'platform' ? ['sign', 'poster', 'map'] : ['shutter', 'hazard', 'sign']);
      if (kind === 'sign') {
        const col = rng.pick(th.neon), sw = rng.int(56, 92);
        R(px - 1, 11, sw + 2, 26, '#05060c'); R(px, 12, sw, 24, '#0d0e18'); neonGlyphs(x, ex, px + 6, 16, sw - 12, col, rng);
        A.signs.push({ x: (px + sw / 2) / Z, y: 12, col });
        px += sw + rng.int(20, 48);
      } else if (kind === 'shutter') {
        const sw = rng.int(72, 112); R(px, 8, sw, fh - 12, '#3a3f52'); for (let j = 10; j < fh - 6; j += 3) { R(px, j, sw, 1, '#2a2e3d'); R(px, j + 1, sw, 1, '#474d63'); } R(px, fh - 12, sw, 4, '#14161f');
        if (rng.chance(0.6)) { const gx = px + rng.int(8, sw - 30); for (let i = 0; i < 3; i++) R(gx + i * 6, rng.int(20, 40), rng.int(6, 14), 3, D.rgba(rng.pick(['#ff3d8b', '#ffb057', '#3ee8ff']), 0.75)); }
        px += sw + rng.int(16, 32);
      } else if (kind === 'poster') {
        R(px, 14, 36, 40, '#c9b79a'); R(px + 3, 17, 30, 18, rng.pick(['#b8432f', '#3a6fa8', '#5c3b8a'])); R(px + 8, 20, 20, 10, '#ffffff30'); for (let i = 0; i < 3; i++) R(px + 4, 39 + i * 4, rng.int(16, 28), 2, '#5e3d36'); R(px + 24, 14, 12, 8, th.face[0]); R(px + 24, 22, 12, 1, '#a89878');
        px += 36 + rng.int(28, 60);
      } else if (kind === 'map') {
        R(px, 12, 80, 40, '#d9dde8'); R(px + 2, 14, 76, 36, '#eef0f6');
        R(px + 6, 30, 68, 3, '#ff3047'); R(px + 6, 22, 40, 3, '#3a6fa8'); R(px + 43, 22, 3, 18, '#3a6fa8'); R(px + 20, 40, 50, 3, '#e3c14a'); R(px + 20, 30, 3, 13, '#e3c14a');
        for (let i = 0; i < 7; i++) { R(px + 8 + i * 10, 29, 5, 5, '#0b0a14'); R(px + 9 + i * 10, 30, 3, 3, '#ffffff'); }
        px += 80 + rng.int(28, 60);
      } else {
        for (let i = 0; i < 60; i += 12) { R(px + i, 40, 6, 12, '#e3c14a'); R(px + i + 6, 40, 6, 12, '#14161f'); }
        px += 60 + rng.int(28, 60);
      }
    }
    R(0, 0, T2 - 4, H2, th.wall); R(W2 - T2 + 4, 0, T2 - 4, H2, th.wall);
    R(T2 - 4, 2 * T2, 4, H2 - 2 * T2, '#0a0b12'); R(W2 - T2, 2 * T2, 4, H2 - 2 * T2, '#0a0b12');
    R(T2 - 5, 2 * T2, 1, H2 - 2 * T2, '#ffffff12');
    R(0, H2 - T2 + 8, W2, T2 - 8, th.wall); R(0, H2 - T2 + 8, W2, 4, '#0a0b12');
    for (let i = 0; i < 12; i++) R(T2, 2 * T2 + i, W2 - 2 * T2, 1, `rgba(5,5,12,${0.5 - i * 0.04})`);
  }
  function neonGlyphs(x, ex, px, py, w, col, rng) {
    const n = Math.max(2, Math.floor(w / 18));
    for (let i = 0; i < n; i++) {
      const gx = px + i * 18;
      for (let s = 0; s < rng.int(4, 6); s++) {
        const hz = rng.chance(0.5), a = rng.int(0, 12), b = rng.int(0, 12), len = rng.int(5, 14);
        const rw = hz ? Math.min(len, 14 - a) : 2, rh = hz ? 2 : Math.min(len, 14 - b);
        x.fillStyle = col; x.fillRect(gx + a, py + b, rw, rh); ex.fillStyle = col; ex.fillRect(gx + a, py + b, rw, rh);
        x.fillStyle = '#ffffff'; x.fillRect(gx + a, py + b, hz ? rw : 1, hz ? 1 : rh);
      }
    }
  }
})(D);
