/* Underdog：选城页 · 像素全息（用户："先选择地图，地图 3D 选择"；"要类似 3D 全息投影的那种感觉"；"地图切换界面应用像素化风格"）
   整页是一块 640×360 的像素画布（和游戏同一套像素格，CSS 按整数倍放大、不抗锯齿），每一帧一个像素一个像素地画：
   - 投影台：底下两圈虚线光环在转，中间一点白；往上打的光锥是有序抖动（4×4 点阵）的点，越往上越稀；1 像素的光点往上飘；隔行扫描线。
   - 四层地图：每座城自己的线网（C.lines 的站连起来）投到一块斜着的板上，1 像素的线、站是点、换乘站和据点亮一些；北渡画河、白沙画坑。
     岚川在最上面，越往下越深（E-17 走过的路）。整堆慢慢来回转。没解锁的城是一层雪花噪点和"？？？"。
   - 鼠标移上去 / 上下键：那层抬高、变亮，它上面的层隔一个像素画一个（看得见下面）。
   - 点一层（回车 / F）：别的层按点阵一点点消失、沉回投影台；选中的那层转正、放平、放大到铺满屏幕，一行行扫出来；接着就是这座城的选出发站页。
   右边一列城名、价值、一句话（DOM，像素字、硬边框）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, G = D.Game, Ci = D.Cities; if (!U || !G || !Ci) return;
  const ORDER = Ci.ORDER, CITIES = D.CITIES, W = 640, H = 360;
  const GO_MS = 1150, FADE_MS = 280;
  const TINT = { lanchuan: [76, 195, 255], tieyuan: [255, 176, 87], baisha: [150, 255, 190], beidu: [175, 150, 255] };
  const BX = 236, BY = 322, LW = 232, TILT = 0.42, GAP = 40, Z0 = 54;
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  const col = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
  const mix = (c, k) => c.map(v => Math.round(v * k));

  // ── 静态底：深底、四周暗角（点阵）、网点、光锥
  let BG = null;
  function bg() {
    if (BG) return BG;
    const b = new Uint32Array(W * H), base = [5, 8, 14], beam = [90, 190, 230];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = Math.hypot((x - BX) / 420, (y - 200) / 260), k = 1 - Math.min(1, v) * 0.6;
      let c = mix(base, k + 0.25);
      if (x % 16 === 0 && y % 16 === 0) c = [22, 34, 48];
      // 光锥：底下窄、上面宽，越往上点越稀
      const t = (BY - y) / (BY - 60); if (t >= 0 && t <= 1) { const half = 12 + t * 118; if (Math.abs(x - BX) < half && bay(x, y) < 0.36 * (1 - t) + 0.04) c = mix(beam, 0.55 - t * 0.3); }
      b[y * W + x] = col(c[0], c[1], c[2]);
    }
    return (BG = b);
  }

  // ── 每座城投影要用的数据：线（站坐标归一到 -0.5..0.5）、换乘站、据点、河、坑
  const geo = new Map();
  function cityGeo(C) {
    const sig = C.seed + ':' + C.ver; const g0 = geo.get(C.key); if (g0 && g0.sig === sig) return g0;
    const w = D.cityW(C), h = D.cityH(C), n = s => [s.x / w - 0.5, s.y / h - 0.5], live = s => s && !s.dead && !s.hidden;
    const lines = C.lines.map(L => { const st = L.stops.filter(live).map(n); if (L.loop && st.length > 2) st.push(st[0]); return st; });
    const hubs = C.stations.filter(s => live(s) && s.lines.length > 1).map(n), dots = C.stations.filter(s => live(s) && s.lines.length === 1).map(n);
    const water = []; if (C.water) for (let x = 0; x <= w; x += w / 90) { const y = D.cityWaterY(C, x); water.push([x / w - 0.5, (y - C.water.hw) / h - 0.5], [x / w - 0.5, (y + C.water.hw) / h - 0.5]); }
    const crater = []; if (C.crater) for (let a = 0; a < 64; a++) crater.push([(C.crater.x + Math.cos(a / 64 * Math.PI * 2) * C.crater.r) / w - 0.5, (C.crater.y + Math.sin(a / 64 * Math.PI * 2) * C.crater.r) / h - 0.5]);
    const home = C.stations[C.home] ? n(C.stations[C.home]) : null;
    const g = { sig, aspect: h / w, lines, hubs, dots, water, crater, home }; geo.set(C.key, g); return g;
  }
  const NOISE = (() => { const r = D.rng('pick-noise'), pts = []; for (let i = 0; i < 260; i++) pts.push([r() - 0.5, r() - 0.5]); const segs = []; for (let i = 0; i < 9; i++) { const x = r() - 0.5, y = r() - 0.5; segs.push([[x, y], [x + (r() - 0.5) * 0.25, y + (r() - 0.5) * 0.2]]); } return { pts, segs }; })();

  // ── 状态
  let el = null, cv = null, cx2 = null, img = null, buf = null, cur = 0, busy = false, keyH = null, raf = 0, t0 = 0, goT = 0, goK = -1, layers = [], pfRef = null;
  function close() { if (keyH) document.removeEventListener('keydown', keyH, true); keyH = null; cancelAnimationFrame(raf); raf = 0; if (el) el.remove(); el = null; busy = false; const r = document.querySelector('#ui'); if (r) r.classList.remove('cp-open'); }

  // 像素：越界不画；mask 用来做点阵透明
  const plot = (x, y, c, mask) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; if (mask && !mask(x, y)) return; buf[y * W + x] = c; };
  function line(x0, y0, x1, y1, c, mask) { x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0; for (;;) { plot(x0, y0, c, mask); if ((x0 === x1 && y0 === y1) || n++ > 2000) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }

  // 一层的投影：中心 (cx, cy)，抬高 z，转角 th，压扁 tilt，放大 sc
  function projector(L, P) { const lw = LW * P.sc, lh = LW * L.aspect * P.sc, c = Math.cos(P.th), s = Math.sin(P.th); return ([u, v]) => { const X = u * lw, Y = v * lh; return [P.cx + X * c - Y * s, P.cy - P.z + (X * s + Y * c) * P.tilt]; }; }
  function drawLayer(L, P, look) {
    const pr = projector(L, P), t = look.tint, bright = col(...mix(t, look.k)), dim = col(...mix(t, look.k * 0.45)), white = col(...mix([235, 250, 255], look.k)), mask = look.mask;
    const quad = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(pr); L.quad = quad;
    for (let i = 0; i < 4; i++) { const a = quad[i], b = quad[(i + 1) % 4]; line(a[0], a[1], b[0], b[1], dim, mask); }
    for (const q of quad) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) plot(q[0] + dx, q[1] + dy, bright, mask); // 四角亮点
    if (!L.g) { // 没解锁：雪花噪点
      const ph = (performance.now() / 120) | 0;
      NOISE.pts.forEach((p, i) => { if ((i + ph) % 3) { const q = pr(p); plot(q[0], q[1], (i + ph) % 5 ? dim : bright, mask); } });
      for (const [a, b] of NOISE.segs) { const p = pr(a), q = pr(b); line(p[0], p[1], q[0], q[1], dim, mask); }
      return;
    }
    const g = L.g;
    for (const p of g.water) { const q = pr(p); plot(q[0], q[1], dim, mask); }
    for (let i = 0; i < g.crater.length; i++) { const a = pr(g.crater[i]), b = pr(g.crater[(i + 1) % g.crater.length]); line(a[0], a[1], b[0], b[1], dim, mask); }
    for (const st of g.lines) for (let i = 0; i < st.length - 1; i++) { const a = pr(st[i]), b = pr(st[i + 1]); line(a[0], a[1] + 1, b[0], b[1] + 1, dim, mask); line(a[0], a[1], b[0], b[1], bright, mask); }
    for (const p of g.dots) { const q = pr(p); plot(q[0], q[1], dim, mask); }
    for (const p of g.hubs) { const q = pr(p); plot(q[0], q[1], white, mask); plot(q[0] + 1, q[1], white, mask); }
    if (g.home) { const q = pr(g.home); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) plot(q[0] + dx, q[1] + dy, white, mask); }
  }
  // 投影台：两圈虚线光环（一个顺转一个逆转）、中间亮点
  function drawBase(t, k) {
    const ring = (rx, ry, n, sp, c) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + t * sp; if ((i >> 1) % 2) continue; plot(BX + Math.cos(a) * rx, BY + Math.sin(a) * ry, c); } };
    ring(96, 24, 120, 0.25, col(...mix([120, 210, 255], 0.75 * k))); ring(54, 13, 70, -0.5, col(...mix([200, 245, 255], 0.9 * k)));
    for (let y = -2; y <= 2; y++) for (let x = -6; x <= 6; x++) if (Math.abs(x) / 6 + Math.abs(y) / 2 <= 1) plot(BX + x, BY + y, col(...mix([230, 252, 255], k)));
  }
  function frame() {
    if (!el) return; raf = requestAnimationFrame(frame);
    const now = performance.now(), t = (now - t0) / 1000, n = ORDER.length;
    buf.set(bg());
    const go = goK >= 0 ? Math.min(1, (now - goT) / GO_MS) : 0, e = go < 0.5 ? 2 * go * go : 1 - Math.pow(-2 * go + 2, 2) / 2; // 缓进缓出
    drawBase(t, 1 - e);
    const th = -0.5 + Math.sin(t * 0.45) * 0.22;
    // 从最下面一层画起
    for (let i = n - 1; i >= 0; i--) {
      const L = layers[i], on = i === cur, above = i < cur;
      let P = { cx: BX, cy: BY, z: Z0 + (n - 1 - i) * GAP + (on && goK < 0 ? 12 : 0), th, tilt: TILT, sc: 1 };
      let look = { tint: L.tint, k: on ? 1 : L.g ? 0.62 : 0.4, mask: above && goK < 0 ? (x, y) => ((x + y) & 1) === 0 : null };
      if (goK >= 0) {
        if (i === goK) { const s1 = W / LW * 1.02; P = { cx: BX + (W / 2 - BX) * e, cy: BY + (H / 2 - BY) * e, z: P.z * (1 - e), th: th * (1 - e), tilt: TILT + (1 - TILT) * e, sc: 1 + (s1 - 1) * e }; look = { tint: L.tint, k: 1, mask: go < 0.55 ? null : (x, y) => y < ((go - 0.55) / 0.45 * H * 1.1 | 0) || bay(x, y) > 0.5 }; } // 放平、放大，后半段一行行扫出来
        else { P.z -= 170 * e; look = { tint: L.tint, k: 0.5, mask: (x, y) => bay(x, y) > e }; } // 别的层沉下去、按点阵消失
      }
      drawLayer(L, P, look);
      if (goK < 0 || i !== goK) { const q = L.quad[0]; L.labelAt = [q[0] + 3, q[1] - 7]; }
    }
    // 往上飘的光点
    for (let i = 0; i < 26; i++) { const life = 3 + (i % 5) * 0.7, k2 = ((t + i * 0.37) % life) / life, x = BX + ((i * 53) % 200) - 100, y = BY - 6 - k2 * 230; if (goK < 0 || bay(x, y) > e) plot(x, y, col(...mix([210, 245, 255], 1 - k2))); }
    // 隔行扫描线、偶尔整页暗一下
    const flick = goK < 0 && ((t * 10) | 0) % 47 === 0 ? 0.8 : 1;
    for (let y = 1; y < H; y += 2) { const o = y * W; for (let x = 0; x < W; x++) { const c = buf[o + x]; buf[o + x] = (c & 0xff000000) | ((((c >> 16) & 255) * 0.78 * flick) << 16) | ((((c >> 8) & 255) * 0.78 * flick) << 8) | ((c & 255) * 0.78 * flick); } }
    img.data.set(new Uint8ClampedArray(buf.buffer)); cx2.putImageData(img, 0, 0);
    // 层的名字（像素字）
    if (goK < 0) layers.forEach((L, i) => { if (!L.labelAt) return; const P = CITIES[ORDER[i]], txt = L.g ? (D.tr ? D.tr(P.name) : P.name) : '???'; D.text(cx2, txt, L.labelAt[0], L.labelAt[1], i === cur ? `rgb(${L.tint.join(',')})` : `rgba(${L.tint.join(',')},0.55)`); });
  }
  // 鼠标在哪层上：从最上面一层往下找，点在投影四边形里就是它
  const inQuad = (q, x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c !== 0) { if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } } return true; };
  const pick = ev => { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height; for (let i = 0; i < layers.length; i++) if (layers[i].quad && inQuad(layers[i].quad, x, y)) return i; return -1; };

  function hover(i, quiet) {
    if (!el || busy) return; const was = cur; cur = (i + ORDER.length) % ORDER.length;
    el.querySelectorAll('.cp-item').forEach(b => b.classList.toggle('on', +b.dataset.cp === cur));
    if (!quiet && was !== cur && D.Sfx) D.Sfx.play('click');
  }
  function choose(pf, i) {
    if (!el || busy) return; const k = ORDER[i];
    if (!Ci.isOpen(pf, k)) { D.Sfx && D.Sfx.play('nope'); U.toast && U.toast('还没查到 E-17 去了哪'); return; }
    hover(i, true); busy = true; goK = i; goT = performance.now(); el.classList.add('going');
    D.Sfx && D.Sfx.play('power');
    setTimeout(() => {
      if (!el) return;
      if (pf.cityAt !== k) Ci.go(pf, k);
      G.sel = pf.city.home; G.focusOn && G.focusOn(pf.city.stations[pf.city.home]);
      el.classList.add('out'); G.save && G.save(); U.refresh();
      setTimeout(close, FADE_MS);
    }, GO_MS);
  }
  const stars = n => '★'.repeat(n) + '<i>' + '★'.repeat(4 - n) + '</i>';
  U.cityPick = function (pf) {
    close(); Ci.ensure(pf); pfRef = pf;
    const root = document.querySelector('#ui'); if (!root) return;
    const esc = U._ && U._.esc ? U._.esc : (s => s);
    cur = Math.max(0, ORDER.indexOf(pf.cityAt)); goK = -1;
    layers = ORDER.map(k => { const open = Ci.isOpen(pf, k), C = open ? Ci.build(pf, k) : null, g = C ? cityGeo(C) : null; return { k, g, tint: TINT[k], aspect: g ? g.aspect : 0.58 }; });
    const side = ORDER.map((k, i) => { const P = CITIES[k], open = Ci.isOpen(pf, k);
      return `<button class="cp-item${open ? '' : ' lock'}" data-cp="${i}" style="--t:${TINT[k].join(',')}"><b>${esc(open ? P.name : '？？？')}</b><em>${open ? '价值 ' + stars(P.stars) : esc('线索不够')}</em>${open ? `<span>${esc(P.desc)}</span>` : ''}${k === pf.cityAt ? `<i class="cp-here">${esc('当前')}</i>` : ''}</button>`; }).join('');
    el = document.createElement('div'); el.className = 'cpick';
    el.innerHTML = `<canvas class="cp-cv" width="${W}" height="${H}"></canvas><div class="cp-head"><h2>选择城市</h2><div class="hint">一层是一座城。E-17 走过的路，一层比一层深。</div></div><div class="cp-side">${side}</div>`;
    root.appendChild(el); root.classList.add('cp-open');
    cv = el.querySelector('canvas'); cx2 = cv.getContext('2d'); cx2.imageSmoothingEnabled = false; img = cx2.createImageData(W, H); buf = new Uint32Array(W * H);
    el.querySelectorAll('.cp-item').forEach(b => { b.onmouseenter = () => hover(+b.dataset.cp); b.onclick = () => choose(pf, +b.dataset.cp); });
    cv.onmousemove = ev => { const i = pick(ev); if (i >= 0 && i !== cur) hover(i); };
    cv.onclick = ev => { const i = pick(ev); if (i >= 0) choose(pf, i); };
    hover(cur, true); t0 = performance.now(); frame();
    keyH = e => {
      if (!el || busy) return; const k = e.code;
      if (k === 'ArrowUp' || k === 'KeyW') hover(cur - 1); else if (k === 'ArrowDown' || k === 'KeyS') hover(cur + 1);
      else if (k === 'Enter' || k === 'Space' || k === 'KeyF') choose(pf, cur);
      else if (k === 'Escape') choose(pf, Math.max(0, ORDER.indexOf(pf.cityAt)));
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    document.addEventListener('keydown', keyH, true);
  };
  U.cityPickOpen = () => !!el;
  U.cityPickState = () => el ? { cur, going: goK >= 0, layers: layers.map(L => ({ k: L.k, open: !!L.g, quad: L.quad })) } : null; // 测试用
  // 据点页重画（root.innerHTML 整个换掉）时，开着的选城页接回去
  const hub0 = U.hub;
  U.hub = function () { const r = hub0.apply(this, arguments); const root = document.querySelector('#ui'); if (el && root && !el.isConnected) { root.appendChild(el); root.classList.add('cp-open'); } return r; };

  // ── 从别的页点"出发"进来时先选城（从出发准备页退回来不弹）
  const ht0 = G.hubTab;
  G.hubTab = function (t) {
    const was = G.mode === 'hub' ? G.tab : null, r = ht0.apply(this, arguments);
    if (t === 'map' && was !== 'map' && G.pf) U.cityPick(G.pf); else if (t !== 'map') close();
    return r;
  };
  const th0 = G.toHub;
  G.toHub = function (t) { if (t !== 'map') close(); return th0.apply(this, arguments); };
})(D);
