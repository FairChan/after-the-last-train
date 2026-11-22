/* 末班之后 · 小样二：精细像素绘制
   画面是 640×360，世界坐标仍按原来的单位（1 单位 = 2 像素）。精灵按屏幕像素画（res = 2）。
   Paint 是一块按像素填色的画板：ell 球面着色、box 倒角着色，都带 4×4 抖动过渡，最后自动描黑边。
   光从左上来。发光的像素另存一层，进泛光。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16 - 0.5;
  const LN = Math.hypot(-0.55, -0.65, 0.52), LX = -0.55 / LN, LY = -0.65 / LN, LZ = 0.52 / LN;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;

  const R = D.RAMP = {
    steel: ['#161a2a', '#232a42', '#34405f', '#4c5c86', '#6f84b3', '#a3b6dc', '#dbe5fa'],
    plate: ['#2a3350', '#435078', '#6577a6', '#93a6d0', '#c4d2ee', '#eef3ff'],
    dark: ['#0c0e17', '#151a29', '#20263b', '#2d3550', '#3d4766'],
    rust: ['#1f0f0c', '#3b2018', '#5c3423', '#80492e', '#a8653d', '#cf8a57', '#e9b383'],
    white: ['#2e3349', '#555d7a', '#848ca8', '#b3b9cf', '#dde1ee', '#f8f9ff'],
    yellow: ['#2a1c06', '#5a3e0d', '#8f6516', '#c48d1f', '#eab52e', '#ffd95c', '#fff3b0'],
    cloth: ['#1b100b', '#2f1d13', '#4a2f1f', '#6a442c', '#8c5d3c', '#ad7a52'],
    olive: ['#141a0e', '#253017', '#3a4a22', '#566a31', '#788f45', '#9fb865'],
    magenta: ['#1d0a22', '#381443', '#5a1f68', '#82308f', '#a94db3', '#d080d4'],
    gunmetal: ['#101218', '#1d212c', '#2d3342', '#434b5f', '#646e86', '#949fb6'],
    copper: ['#2a1206', '#5a2a10', '#8c4a1c', '#bd6d2c', '#e3975a', '#ffd0a0'],
    gold: ['#3a2606', '#7a5410', '#b8841c', '#e8b42e', '#ffd860', '#fff4c0'],
    silver: ['#3a3f4c', '#666d80', '#9aa1b4', '#c8cdda', '#eef1f8', '#ffffff'],
    green: ['#0e2a12', '#1c4a20', '#2e7032', '#4a9a48', '#78c46a', '#b4ec98'],
    red: ['#2a0a0e', '#5a1218', '#8f1d26', '#c82e3a', '#f0535e', '#ff98a0'],
    blue: ['#0a1630', '#132a5a', '#1f448c', '#3466c0', '#5a92e8', '#9cc4ff'],
    glass: ['#0a1a24', '#123040', '#1d4a60', '#2f6e88', '#58a3bd', '#a6e2f0'],
    crate: ['#24160c', '#432a16', '#694322', '#8f5e33', '#b47c47', '#d6a066'],
  };
  const INK = '#0b0a14';

  D.Paint = function (w, h) {
    const col = new Array(w * h).fill(null), em = new Uint8Array(w * h), P = { w, h, col, em };
    const set = (x, y, c, e) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= w || y >= h || !c) return; col[y * w + x] = c; em[y * w + x] = e ? 1 : 0; };
    const pick = (ramp, v, x, y) => ramp[cl(Math.floor(cl(v, 0, 0.999) * ramp.length + dith(x, y) * 0.9), 0, ramp.length - 1)];
    P.set = set;
    P.px = (x, y, c, e) => set(x, y, c, e);
    P.rect = (x, y, rw, rh, c, e) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, c, e); };
    P.line = (x0, y0, x1, y1, c, e) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c, e); };
    P.disc = (cx, cy, r, c, e) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) set(x, y, c, e); };
    // 球面着色的椭圆
    P.ell = (cx, cy, rx, ry, ramp, o) => {
      o = o || {};
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d); let L = nx * LX + ny * LY + nz * LZ;
        let v = 0.12 + 0.88 * Math.max(0, L) * (o.flat ? 0.6 : 1) + (o.flat ? 0.25 : 0);
        if (d > 0.75 && nx + ny > 0.6) v = Math.max(v, 0.32); // 暗面边缘的反光
        if (o.spec && L > 0.93) v = 1;
        set(x, y, pick(ramp, v + (o.bias || 0), x, y), o.emit);
      }
    };
    // 倒角盒子：顶边亮、左边略亮、右边和底边暗，中间上亮下暗
    P.box = (x0, y0, bw, bh, ramp, o) => {
      o = o || {}; const r = o.r || 0, top = o.top == null ? 1 : o.top;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        if (r) { const cx = i < r ? r - i - 0.5 : i >= bw - r ? i - (bw - r) + 0.5 : 0, cy = j < r ? r - j - 0.5 : j >= bh - r ? j - (bh - r) + 0.5 : 0; if (cx * cx + cy * cy > r * r) continue; }
        let v = (o.v == null ? 0.62 : o.v) - 0.3 * j / bh;
        if (j < top) v = 0.92; else if (i === 0) v += 0.14; else if (i === bw - 1) v = 0.2; if (j === bh - 1) v = 0.12;
        set(x0 + i, y0 + j, pick(ramp, v + (o.bias || 0), x0 + i, y0 + j), o.emit);
      }
    };
    // 竖直渐变条（发光灯管、屏幕）
    P.grad = (x0, y0, bw, bh, ramp, e) => { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) set(x0 + i, y0 + j, pick(ramp, 0.95 - 0.7 * j / bh, x0 + i, y0 + j), e); };
    // 外描边
    P.outline = (c) => {
      const out = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (col[y * w + x]) continue;
        if ((x > 0 && col[y * w + x - 1]) || (x < w - 1 && col[y * w + x + 1]) || (y > 0 && col[(y - 1) * w + x]) || (y < h - 1 && col[(y + 1) * w + x])) out.push(y * w + x);
      }
      for (const i of out) { col[i] = c || INK; em[i] = 0; }
    };
    P.make = (res) => {
      const [img, ix] = D.canvas(w, h), [emi, ex] = D.canvas(w, h), [fl, fx] = D.canvas(w, h);
      const a = ix.createImageData(w, h), b = ex.createImageData(w, h), f = fx.createImageData(w, h);
      let any = false;
      for (let i = 0; i < w * h; i++) {
        const c = col[i]; if (!c) continue;
        const n = parseInt(c.slice(1, 7), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255, p = i * 4;
        a.data[p] = r; a.data[p + 1] = g; a.data[p + 2] = bl; a.data[p + 3] = 255;
        f.data[p] = f.data[p + 1] = f.data[p + 2] = f.data[p + 3] = 255;
        if (em[i]) { b.data[p] = r; b.data[p + 1] = g; b.data[p + 2] = bl; b.data[p + 3] = 255; any = true; }
      }
      ix.putImageData(a, 0, 0); ex.putImageData(b, 0, 0); fx.putImageData(f, 0, 0);
      return { img, emit: any ? emi : null, flash: fl, w, h, res: res || 2 };
    };
    return P;
  };
  // 画好就描边出图
  const mk = (w, h, fn, noOutline) => { const p = D.Paint(w, h); fn(p); if (!noOutline) p.outline(); return p.make(2); };
  D.mkSprite = mk;

  // 主角图集（hero-art.js 里的 base64）：异步解码，好了以后再生成受击白和残影染色
  function loadHero() {
    const A = D.HERO_ART; if (!A) return;
    const H = D.HERO = Object.assign({ ready: false, tints: {} }, A);
    const im = new Image(), em = new Image(); let n = 0;
    const done = () => {
      if (++n < 2) return;
      const mk = () => { const [c] = D.canvas(im.width, im.height); return c; };
      H.img = im; H.emit = em;
      H.flash = mk(); const fx = H.flash.getContext('2d'); fx.drawImage(im, 0, 0); fx.globalCompositeOperation = 'source-in'; fx.fillStyle = '#ffffff'; fx.fillRect(0, 0, im.width, im.height);
      H.tint = col => { if (!H.tints[col]) { const t = mk(), x = t.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, im.width, im.height); H.tints[col] = t; } return H.tints[col]; };
      // 轮廓光图集：只有贴着透明的那一圈边缘像素（暗处靠它看清主角，又不会把整个人照成白的）
      H.rim = (() => {
        const c = mk(), x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const W = c.width, Hh = c.height, d = x.getImageData(0, 0, W, Hh), s = d.data, o = x.createImageData(W, Hh), t = o.data;
        const a = (i, j) => (i < 0 || j < 0 || i >= W || j >= Hh) ? 0 : s[(j * W + i) * 4 + 3];
        for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { if (!a(i, j)) continue; if (a(i - 1, j) && a(i + 1, j) && a(i, j - 1) && a(i, j + 1)) continue; const k = (j * W + i) * 4; t[k] = 156; t[k + 1] = 196; t[k + 2] = 255; t[k + 3] = 255; }
        x.clearRect(0, 0, W, Hh); x.putImageData(o, 0, 0); return c;
      })();
      H.variants = {};
      H.variant = (tint, visor) => {
        const key = tint + '|' + visor; if (!tint && !visor) return H; if (H.variants[key]) return H.variants[key];
        const recolor = (src, col, amt) => { const c = mk(), x = c.getContext('2d'); x.drawImage(src, 0, 0); if (col) { x.globalAlpha = amt; x.globalCompositeOperation = 'color'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0); } return c; };
        const v = Object.assign({}, H, { img: recolor(im, tint, 0.75), emit: recolor(em, visor, 1) });
        return (H.variants[key] = v);
      };
      H.ready = true;
    };
    im.onload = done; em.onload = done; im.src = A.atlas; em.src = A.emit;
  }
  D.initHiArt = function () {
    loadHero();
    const S = D.SPR;
    // ── 工壳（玩家）：圆头盔 + 橙色护目条，躯干带背包和肩甲
    S.head = mk(20, 18, p => {
      p.line(4, 7, 2, 1, '#6577a6'); p.px(2, 0, '#ffb057', 1); p.px(2, 1, '#ff7a2e', 1);
      p.ell(10.5, 9.5, 8, 7.5, R.steel);
      p.box(9, 1, 3, 3, R.plate, { top: 1 });
      p.rect(3, 8, 15, 4, '#0d1020');
      p.rect(5, 9, 11, 2, '#ff7a2e', 1); p.rect(8, 9, 6, 2, '#ffb057', 1); p.rect(10, 9, 3, 1, '#fff0c8', 1);
      p.box(1, 8, 3, 5, R.dark, { top: 1 });
      p.px(6, 4, '#eef3ff'); p.px(7, 4, '#c4d2ee'); p.px(6, 5, '#c4d2ee');
    });
    S.body = mk(24, 18, p => {
      p.box(4, 1, 16, 11, R.dark, { r: 2 });
      p.box(5, 3, 14, 13, R.steel, { r: 3 });
      p.box(7, 5, 10, 6, R.plate, { r: 1 });
      p.rect(8, 12, 8, 1, '#ff7a2e', 1); p.rect(10, 12, 4, 1, '#ffd08a', 1);
      p.ell(4.5, 6, 3.5, 3, R.steel); p.ell(19.5, 6, 3.5, 3, R.steel);
      p.rect(5, 14, 14, 2, '#151a29'); p.rect(11, 14, 2, 2, '#6577a6');
      p.px(9, 7, '#ffffff'); p.px(10, 6, '#eef3ff');
    });
    // ── 回收者（人类同行）：兜帽、红色护目镜、斗篷
    S.raiderHead = mk(18, 16, p => {
      p.ell(9, 8, 7.5, 7, R.cloth); p.ell(10, 10, 4.6, 3.6, R.dark, { flat: true });
      p.disc(8, 10, 1.4, '#ff3047', 1); p.disc(12, 10, 1.4, '#ff3047', 1); p.px(8, 9, '#ffb0b0', 1); p.px(12, 9, '#ffb0b0', 1);
      p.rect(5, 13, 9, 2, '#6a442c'); p.px(6, 3, '#ad7a52');
    });
    S.raiderBody = mk(22, 16, p => {
      p.box(3, 1, 16, 13, R.cloth, { r: 3 }); p.line(4, 2, 16, 12, '#2f1d13'); p.line(5, 2, 17, 12, '#1b100b');
      p.box(12, 7, 5, 4, R.olive, { r: 1 }); p.box(5, 9, 4, 3, R.olive);
      p.rect(9, 3, 2, 2, '#c8cbe0'); p.px(9, 3, '#ffffff');
    });
    // ── 拾荒蛛：锈色分节甲壳，两只绿眼，腿在画面里另画
    S.crawler = mk(30, 18, p => {
      p.ell(15, 8, 11, 6.5, R.rust);
      for (const x of [9, 15, 21]) p.line(x, 3, x - 1, 12, '#3b2018');
      p.ell(15, 12.5, 6.5, 4, R.rust, { bias: -0.15 });
      p.disc(12, 12.5, 1.6, '#8dff6a', 1); p.disc(18, 12.5, 1.6, '#8dff6a', 1); p.px(12, 12, '#e0ffd0', 1); p.px(18, 12, '#e0ffd0', 1);
      p.line(12, 16, 10, 17, '#cf8a57'); p.line(18, 16, 20, 17, '#cf8a57');
      p.px(11, 4, '#e9b383'); p.px(12, 4, '#cf8a57');
    });
    // ── 哨兵：白色球形机，红色镜头，两侧旋翼舱
    S.drone = mk(30, 26, p => {
      p.line(6, 11, 10, 12, '#34405f'); p.line(20, 12, 24, 11, '#34405f');
      p.ell(4.5, 10.5, 3.5, 2.5, R.dark); p.ell(25.5, 10.5, 3.5, 2.5, R.dark);
      p.ell(15, 12, 9, 9, R.white, { spec: true });
      p.ell(15, 14, 5.2, 4.8, R.dark, { flat: true });
      p.disc(15, 14, 3, '#ff3047', 1); p.disc(15, 14, 1.5, '#ffb0b0', 1); p.px(14, 13, '#ffffff', 1);
      p.line(15, 3, 15, 0, '#848ca8'); p.px(15, 0, '#ff3047', 1);
      p.rect(11, 21, 8, 1, '#3e4a6a');
    });
    // ── 长眼（狙击机）：高瘦，独眼，长管另画
    S.sniper = mk(22, 34, p => {
      p.line(7, 22, 3, 33, '#2d3342'); p.line(8, 22, 4, 33, '#434b5f'); p.line(14, 22, 18, 33, '#2d3342'); p.line(15, 22, 19, 33, '#434b5f');
      p.box(6, 11, 10, 12, R.gunmetal, { r: 2 });
      p.rect(7, 16, 8, 1, '#1d212c'); p.rect(7, 19, 8, 1, '#1d212c');
      p.box(7, 3, 8, 9, R.gunmetal, { r: 2 });
      p.disc(11, 7, 2.3, '#3ee8ff', 1); p.disc(11, 7, 1, '#d0fbff', 1);
      p.rect(10, 0, 2, 3, '#434b5f'); p.px(10, 0, '#3ee8ff', 1);
    });
    // ── 迫击炮台：底座 + 圆顶 + 斜炮管
    S.turret = mk(30, 28, p => {
      p.box(2, 18, 26, 9, R.dark, { r: 2 }); for (let x = 5; x < 26; x += 5) p.rect(x, 21, 2, 3, '#0c0e17');
      p.box(17, 2, 7, 13, R.gunmetal, { r: 1 }); p.rect(16, 2, 9, 2, '#646e86'); p.rect(18, 1, 5, 1, '#0b0a14');
      p.ell(14, 17, 10, 7.5, R.magenta, { spec: true });
      p.rect(8, 16, 12, 2, '#ff3d8b', 1); p.rect(11, 16, 6, 1, '#ffb3d4', 1);
    });
    // ── 自爆蜂：黑色小球，红核心，薄翼
    S.bomber = mk(22, 18, p => {
      p.ell(4, 6, 3.5, 2, R.glass, { flat: true }); p.ell(18, 6, 3.5, 2, R.glass, { flat: true });
      p.ell(11, 10, 6.5, 6.5, R.dark, { spec: true, bias: 0.15 });
      p.disc(11, 11, 2.6, '#ff3047', 1); p.disc(11, 11, 1.2, '#ffd0a0', 1);
      p.line(8, 4, 7, 1, '#3d4766'); p.line(14, 4, 15, 1, '#3d4766');
    });
    // ── 焊工机（工业线）：履带底盘 + 方形机身 + 一只焊枪臂，橙色警示
    S.welder = mk(28, 26, p => {
      p.box(3, 18, 22, 7, R.dark, { r: 2 }); for (let x = 5; x < 24; x += 3) p.rect(x, 20, 1, 3, '#0c0e17');
      p.box(6, 6, 16, 13, R.gunmetal, { r: 2 }); p.rect(7, 14, 14, 2, '#e07a20'); for (let x = 8; x < 21; x += 4) p.rect(x, 14, 2, 2, '#1b1d12');
      p.rect(9, 8, 10, 4, '#0b0a14'); p.rect(10, 9, 3, 2, '#ffb057', 1); p.rect(15, 9, 3, 2, '#ffb057', 1);
      p.rect(12, 1, 4, 6, '#434b5f'); p.px(13, 1, '#ffe14a', 1);
    });
    // ── 橱窗假人（商业线）：白色模特，关节处一圈粉光
    S.mannequin = mk(16, 30, p => {
      p.ell(8, 5, 4, 4.5, R.white, { spec: true });
      p.box(4, 10, 8, 10, R.white, { r: 2 }); p.rect(5, 12, 6, 1, '#c8cbd6');
      p.rect(2, 11, 2, 9, '#d8dce6'); p.rect(12, 11, 2, 9, '#d8dce6');
      p.rect(5, 20, 2, 9, '#d8dce6'); p.rect(9, 20, 2, 9, '#d8dce6');
      p.px(4, 10, '#ff3d8b', 1); p.px(11, 10, '#ff3d8b', 1); p.px(6, 20, '#ff3d8b', 1); p.px(9, 20, '#ff3d8b', 1);
    });
    S.mannequinOn = mk(16, 30, p => {
      p.ell(8, 5, 4, 4.5, R.white, { spec: true }); p.rect(6, 4, 4, 2, '#ff3d8b', 1);
      p.box(4, 10, 8, 10, R.white, { r: 2 }); p.rect(5, 12, 6, 1, '#ff3d8b', 1);
      p.rect(1, 9, 2, 9, '#d8dce6'); p.rect(13, 9, 2, 9, '#d8dce6');
      p.rect(5, 20, 2, 9, '#d8dce6'); p.rect(9, 20, 2, 9, '#d8dce6');
    });
    // ── 野狗机（旧城线）：四足小机，长鼻子，一只绿眼
    S.dog = mk(24, 16, p => {
      p.box(5, 4, 13, 7, R.olive, { r: 2 }); p.rect(6, 6, 11, 1, '#253017');
      p.box(16, 2, 7, 5, R.olive, { r: 1 }); p.disc(20, 4, 1.2, '#8dff6a', 1);
      p.rect(2, 4, 4, 1, '#566a31');
    });
    // ── 锈螨（杂兵）：小小一粒锈壳，一只黄眼，腿另画
    S.mite = mk(16, 11, p => {
      p.ell(8, 5, 6, 4, R.rust, { bias: -0.2 });
      p.line(5, 2, 5, 7, '#3b2018'); p.line(11, 2, 11, 7, '#3b2018');
      p.disc(8, 7, 1.4, '#ffe14a', 1); p.px(8, 6, '#fff6c0', 1);
      p.px(6, 2, '#e9b383');
    });
    // ── 推车机（杂兵）：方形旧清洁车，黄黑警示条，上面绑了根枪管
    S.scav = mk(22, 18, p => {
      p.box(3, 5, 16, 9, R.olive, { r: 2 });
      for (let x = 4; x < 18; x += 4) { p.rect(x, 10, 2, 2, '#ffd23a'); p.rect(x + 2, 10, 2, 2, '#1b1d12'); }
      p.rect(6, 2, 8, 4, '#434b5f'); p.disc(10, 4, 1.2, '#ff7a3a', 1);
      p.disc(6, 15, 2.2, '#1d212c'); p.disc(16, 15, 2.2, '#1d212c'); p.px(6, 15, '#646e86'); p.px(16, 15, '#646e86');
    });
    // ── 维修蜂：白色，绿十字，两只细臂
    S.medic = mk(24, 20, p => {
      p.line(4, 12, 1, 16, '#848ca8'); p.line(20, 12, 23, 16, '#848ca8');
      p.ell(12, 10, 8, 7.5, R.white, { spec: true });
      p.rect(11, 6, 2, 8, '#8dff6a', 1); p.rect(8, 9, 8, 2, '#8dff6a', 1); p.px(11, 6, '#e0ffd0', 1);
      p.rect(7, 1, 10, 1, '#848ca8'); p.line(12, 1, 12, 3, '#555d7a');
    });
    // ── 工程机：黄色重型机，红色视窗，履带；护盾和圆锯另画
    S.engineer = mk(40, 34, p => {
      p.box(1, 25, 38, 8, R.dark, { r: 3 }); for (let x = 4; x < 37; x += 4) p.rect(x, 27, 2, 4, '#3d4766');
      p.box(4, 9, 32, 18, R.yellow, { r: 3 });
      for (let i = 0; i < 8; i++) p.line(6 + i * 4, 25, 10 + i * 4, 20, '#1a1206');
      p.box(10, 1, 20, 10, R.yellow, { r: 2 });
      p.rect(12, 4, 16, 4, '#2a0a0e'); p.rect(13, 5, 14, 2, '#ff3047', 1); p.rect(16, 5, 6, 1, '#ffb0b0', 1);
      p.rect(7, 12, 3, 6, '#5a3e0d'); p.rect(30, 12, 3, 6, '#5a3e0d');
      p.px(12, 2, '#fff3b0'); p.px(6, 10, '#fff3b0');
    });
    // ── 钳工-9：首领机体（钳臂在画面里另画）
    S.boss = mk(76, 62, p => {
      p.box(3, 50, 70, 11, R.dark, { r: 4 }); for (let x = 6; x < 70; x += 5) p.rect(x, 53, 3, 5, '#3d4766');
      p.box(6, 18, 64, 34, R.steel, { r: 4 });
      for (let i = 0; i < 14; i++) p.line(8 + i * 4.6, 50, 13 + i * 4.6, 44, '#e8b42e');
      p.rect(6, 43, 64, 1, '#0b0a14');
      p.box(10, 22, 18, 12, R.plate, { r: 2 }); p.box(48, 22, 18, 12, R.plate, { r: 2 });
      p.ell(38, 33, 9, 8, R.dark, { flat: true }); p.disc(38, 33, 6, '#ff7a2e', 1); p.disc(38, 33, 3.5, '#ffb057', 1); p.disc(37, 32, 1.5, '#fff0c8', 1);
      p.box(24, 2, 28, 18, R.steel, { r: 3 }); p.rect(27, 8, 22, 5, '#2a0a0e'); p.rect(28, 9, 20, 3, '#ff3047', 1); p.rect(33, 9, 8, 1, '#ffb0b0', 1);
      p.line(38, 2, 38, 0, '#a3b6dc'); p.px(38, 0, '#ff3047', 1);
    });

    // ── 容器（关、开两种）
    D.CSPR = {};
    const cont = (k, w, h, fn) => { D.CSPR[k] = [mk(w, h, p => fn(p, false)), mk(w, h, p => fn(p, true))]; };
    cont('locker', 22, 36, (p, o) => { p.box(1, 1, 20, 34, R.steel, { r: 1 }); p.rect(10, 3, 1, 30, '#161a2a'); for (let y = 5; y < 12; y += 2) { p.rect(3, y, 6, 1, '#232a42'); p.rect(12, y, 6, 1, '#232a42'); } if (o) p.rect(2, 2, 8, 32, '#080a12'); else p.rect(13, 18, 1, 4, '#ffd95c'); });
    cont('register', 26, 24, (p, o) => { p.box(1, 9, 24, 14, R.cloth, { r: 1 }); p.box(5, 1, 14, 9, R.gunmetal, { r: 1 }); p.grad(7, 3, 10, 4, R.glass, 1); if (o) p.rect(3, 13, 18, 4, '#080a12'); else p.rect(4, 14, 16, 2, '#6a442c'); });
    cont('crate', 28, 22, (p, o) => { p.box(1, 3, 26, 18, R.crate, { r: 1 }); p.rect(1, 11, 26, 1, '#24160c'); p.line(3, 5, 25, 19, '#432a16'); if (o) p.box(0, 0, 28, 4, R.crate); });
    cont('toolbox', 26, 16, (p, o) => { p.box(1, 4, 24, 11, R.red, { r: 2 }); p.rect(9, 1, 8, 2, '#2d3550'); p.rect(9, 1, 1, 4, '#2d3550'); p.rect(16, 1, 1, 4, '#2d3550'); p.rect(11, 8, 4, 2, '#e3c14a'); if (o) p.rect(3, 5, 20, 3, '#080a12'); });
    cont('safe', 26, 28, (p, o) => { p.box(1, 1, 24, 26, R.gunmetal, { r: 2 }); p.ell(13, 13, 5, 5, R.silver); p.disc(13, 13, 1.5, '#0b0a14'); p.rect(20, 10, 2, 7, '#646e86'); if (o) p.rect(2, 2, 10, 24, '#080a12'); });
    cont('armory', 30, 26, (p, o) => { p.box(1, 1, 28, 24, R.olive, { r: 1 }); p.rect(1, 9, 28, 1, '#141a0e'); p.rect(1, 17, 28, 1, '#141a0e'); for (let i = 0; i < 4; i++) p.rect(4 + i * 6, 4, 3, 3, '#e3c14a'); p.rect(12, 12, 6, 2, '#e3c14a'); if (o) { p.rect(3, 11, 24, 5, '#080a12'); for (let i = 0; i < 5; i++) p.rect(5 + i * 4, 12, 2, 3, '#bd6d2c'); } });
    cont('medcab', 24, 30, (p, o) => { p.box(1, 1, 22, 28, R.white, { r: 1 }); p.rect(9, 6, 6, 14, '#f0535e'); p.rect(5, 10, 14, 6, '#f0535e'); p.rect(2, 23, 20, 1, '#848ca8'); if (o) { p.rect(3, 3, 18, 18, '#080a12'); p.rect(5, 12, 4, 6, '#8dff6a'); p.rect(12, 14, 5, 4, '#ffffff'); } });
    // 第七轮新增的日常容器
    cont('trash', 18, 22, (p, o) => { p.box(2, 5, 14, 16, R.olive, { r: 2, bias: -0.1 }); for (let x = 5; x < 15; x += 3) p.rect(x, 8, 1, 11, '#253017'); if (o) { p.box(0, 1, 18, 4, R.olive, { r: 1 }); p.rect(4, 6, 10, 3, '#080a12'); p.px(7, 6, '#c8cdda'); p.px(11, 7, '#bd6d2c'); } else { p.box(1, 2, 16, 4, R.olive, { r: 1 }); p.rect(7, 0, 4, 2, '#253017'); } });
    cont('vendor', 24, 38, (p, o) => { p.box(1, 1, 22, 36, R.red, { r: 1 }); p.rect(3, 3, 13, 26, o ? '#05060c' : '#1d4a60'); for (let y = 5; y < 27; y += 5) for (let x = 4; x < 15; x += 4) p.rect(x, y, 3, 3, o ? '#202436' : ['#e8b42e', '#3ee8ff', '#8dff6a', '#ff98a0'][(x + y) % 4]); p.rect(18, 6, 3, 8, '#2d3342'); p.rect(18, 7, 3, 1, '#ffd860', 1); p.rect(4, 31, 12, 3, '#080a12'); if (o) { p.line(4, 4, 12, 18, '#a6e2f0'); p.line(13, 6, 8, 24, '#a6e2f0'); } else p.rect(4, 4, 2, 24, '#58a3bd', 1); });
    cont('parcel', 34, 30, (p, o) => { p.box(1, 1, 32, 28, R.yellow, { r: 1, bias: -0.15 }); for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const x = 3 + i * 7.5, y = 3 + j * 8.5; p.rect(x, y, 6.5, 7.5, o && (i + j) % 2 === 0 ? '#080a12' : '#8f6516'); p.px(x + 5, y + 4, '#2a1c06'); } p.rect(28, 4, 3, 5, '#0b0a14'); p.px(29, 5, '#3ee8ff', 1); });
    cont('filecab', 20, 32, (p, o) => { p.box(1, 1, 18, 30, R.gunmetal, { r: 1 }); for (let i = 0; i < 3; i++) { const y = 3 + i * 9.5; p.box(3, y, 14, 8, R.gunmetal, { r: 1, bias: 0.1 }); p.rect(8, y + 3, 4, 1, '#c8cdda'); } if (o) { p.box(2, 12, 16, 10, R.gunmetal); p.rect(4, 13, 12, 3, '#e8eef3'); p.rect(5, 12, 3, 2, '#e3c14a'); } });
    cont('fridge', 24, 36, (p, o) => { p.box(1, 1, 22, 34, R.white, { r: 2 }); p.rect(1, 13, 22, 1, '#848ca8'); p.rect(19, 4, 2, 6, '#949fb6'); p.rect(19, 17, 2, 10, '#949fb6'); if (o) { p.rect(3, 15, 16, 18, '#a6e2f0'); p.rect(4, 19, 14, 1, '#848ca8'); p.rect(4, 26, 14, 1, '#848ca8'); p.rect(5, 21, 4, 4, '#c82e3a'); p.rect(11, 28, 5, 4, '#3a4a22'); } else p.px(4, 4, '#3ee8ff', 1); });
    cont('partsbin', 34, 26, (p, o) => { p.box(1, 1, 32, 24, R.blue, { r: 1, bias: -0.2 }); for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) { const x = 3 + i * 6, y = 3 + j * 7; p.rect(x, y, 5, 6, '#132a5a'); p.rect(x, y + 5, 5, 1, ['#e8b42e', '#c8cdda', '#bd6d2c'][(i + j) % 3]); } if (o) { p.rect(9, 10, 5, 6, '#080a12'); p.rect(21, 3, 5, 6, '#080a12'); } });
    cont('pc', 24, 26, (p, o) => { p.box(2, 1, 20, 14, R.dark, { r: 1 }); p.grad(4, 3, 16, 10, o ? R.dark : R.glass, o ? 0 : 1); p.rect(10, 15, 4, 3, '#2d3342'); p.box(1, 18, 22, 7, R.gunmetal, { r: 1 }); if (!o) { p.rect(5, 5, 8, 1, '#a6e2f0', 1); p.rect(5, 8, 11, 1, '#a6e2f0', 1); } else { p.line(5, 4, 17, 11, '#3d4766'); p.rect(4, 20, 16, 3, '#080a12'); } });
    cont('corpse', 34, 18, (p, o) => { p.ell(10, 11, 8, 5, R.cloth, { bias: -0.1 }); p.ell(23, 11, 9, 5, R.olive, { bias: -0.1 }); p.ell(30, 9, 3.5, 3.5, R.rust); p.line(4, 14, 1, 16, '#2f1d13'); p.line(14, 15, 18, 17, '#253017'); p.box(14, 3, 9, 7, R.olive, { r: 1 }); p.rect(16, 5, 5, 1, '#e3c14a'); if (o) p.rect(15, 4, 7, 3, '#080a12'); else p.px(31, 8, '#ff7a2e', 1); });
    cont('lockbox', 26, 30, (p, o) => { p.box(1, 1, 24, 28, R.steel, { r: 2 }); p.rect(1, 9, 24, 1, '#161a2a'); p.rect(1, 19, 24, 1, '#161a2a'); p.box(16, 11, 7, 7, R.dark, { r: 1 }); p.rect(18, 13, 3, 1, o ? '#8dff6a' : '#ff3047', 1); p.rect(18, 15, 3, 1, '#3d4766'); if (o) { p.rect(3, 11, 12, 7, '#080a12'); p.rect(4, 13, 4, 3, '#ffd860', 1); } });
    // 高价值容器
    cont('vault', 30, 30, (p, o) => { p.box(1, 1, 28, 28, R.gold, { r: 2, bias: -0.2 }); p.box(4, 4, 22, 22, R.gunmetal, { r: 1 }); p.ell(15, 15, 6, 6, R.silver, { spec: true }); for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3; p.line(15, 15, 15 + Math.cos(t) * 5, 15 + Math.sin(t) * 5, '#3a3f4c'); } p.disc(15, 15, 1.5, '#0b0a14'); if (o) { p.rect(5, 5, 11, 20, '#080a12'); p.rect(7, 18, 6, 4, '#ffd860', 1); } else p.px(24, 6, '#8dff6a', 1); });
    cont('rack', 22, 38, (p, o) => { p.box(1, 1, 20, 36, R.dark, { r: 1 }); for (let y = 4; y < 34; y += 5) { p.rect(3, y, 16, 3, '#20263b'); p.px(5, y + 1, (y / 5) % 2 ? '#3ee8ff' : '#8dff6a', 1); p.px(7, y + 1, '#3ee8ff', 1); p.rect(10, y + 1, 7, 1, '#3d4766'); } if (o) p.rect(3, 14, 16, 8, '#080a12'); });
    cont('showcase', 30, 22, (p, o) => { p.box(1, 10, 28, 11, R.cloth, { r: 1 }); p.box(2, 2, 26, 10, R.glass, { r: 1, bias: 0.15 }); p.disc(8, 8, 1.5, '#ffd860', 1); p.disc(15, 7, 1.5, '#ff3d4a', 1); p.disc(22, 8, 1.5, '#9cc4ff', 1); p.line(4, 3, 8, 6, '#ffffff'); if (o) p.rect(3, 3, 24, 8, '#0a1a24'); });
    cont('gunrack', 32, 18, (p, o) => { p.box(1, 3, 30, 14, R.olive, { r: 1 }); p.rect(1, 9, 30, 1, '#141a0e'); p.rect(4, 6, 6, 2, '#e3c14a'); p.rect(22, 6, 6, 2, '#e3c14a'); if (o) { p.box(0, 0, 32, 4, R.olive); p.rect(4, 11, 24, 2, '#2d3342'); } });
    cont('wreck', 26, 14, (p, o) => { p.ell(9, 8, 7, 5, R.steel, { bias: -0.15 }); p.box(13, 3, 10, 8, R.dark, { r: 1 }); p.line(4, 12, 22, 9, '#6f84b3'); p.px(9, 5, '#ff7a2e', !o); p.px(18, 6, '#ff3047', !o); });
  };

  // ── 物品图标（DOM 用，28×28）
  D.ITEM_ART = {
    scrap:   p => { p.line(4, 20, 22, 8, '#bd6d2c'); p.ell(9, 16, 5, 4, R.copper); p.ell(18, 12, 5, 4, R.copper); p.ell(13, 18, 4, 3, R.copper, { bias: -0.1 }); },
    screws:  p => { p.box(7, 6, 14, 17, R.glass, { r: 2 }); p.rect(7, 4, 14, 3, '#646e86'); for (let i = 0; i < 6; i++) p.px(10 + (i % 3) * 3, 12 + Math.floor(i / 3) * 4, '#c8cdda'); },
    can:     p => { p.box(7, 5, 14, 19, R.silver, { r: 2 }); p.rect(7, 11, 14, 7, '#3a4a22'); p.rect(10, 13, 8, 3, '#e3c14a'); },
    oldcell: p => { p.box(8, 6, 12, 18, R.gunmetal, { r: 2 }); p.rect(11, 4, 6, 2, '#949fb6'); p.rect(10, 14, 8, 2, '#8dff6a'); },
    plastic: p => { p.box(5, 9, 18, 10, R.blue, { r: 3, bias: -0.2 }); p.disc(10, 14, 2, '#0b0a14'); p.disc(18, 14, 2, '#0b0a14'); },
    board:   p => { p.box(3, 6, 22, 16, R.green, { r: 1 }); p.rect(8, 10, 7, 6, '#151a29'); for (let i = 0; i < 4; i++) { p.line(16, 9 + i * 3, 23, 9 + i * 3, '#e3c14a'); } for (let x = 5; x < 24; x += 3) p.px(x, 21, '#c8cdda'); },
    bandage: p => { p.ell(14, 14, 9, 9, R.white); p.ell(14, 14, 3.5, 3.5, R.dark, { flat: true }); p.rect(12, 5, 4, 3, '#f0535e'); },
    motor:   p => { p.box(4, 8, 15, 13, R.blue, { r: 3 }); p.rect(19, 12, 5, 5, '#949fb6'); p.rect(6, 10, 11, 1, '#9cc4ff'); },
    copper:  p => { p.box(4, 9, 20, 11, R.copper, { r: 1 }); p.rect(6, 11, 16, 1, '#ffd0a0'); },
    oil:     p => { p.box(7, 7, 14, 17, R.red, { r: 2 }); p.rect(10, 3, 6, 4, '#2d3342'); p.rect(9, 13, 10, 4, '#e3c14a'); },
    radio:   p => { p.box(3, 8, 22, 15, R.cloth, { r: 2 }); p.ell(10, 15, 5, 5, R.dark, { flat: true }); for (let i = 0; i < 3; i++) p.line(6, 12 + i * 2, 14, 12 + i * 2, '#4a2f1f'); p.rect(17, 12, 6, 2, '#e3c14a'); p.line(20, 8, 24, 2, '#949fb6'); },
    sensor:  p => { p.ell(14, 14, 9, 9, R.gunmetal); p.ell(14, 14, 5, 5, R.dark, { flat: true }); p.disc(14, 14, 3, '#3ee8ff', 1); p.px(13, 13, '#ffffff'); },
    bearing: p => { p.ell(14, 14, 10, 10, R.silver, { spec: true }); p.ell(14, 14, 5, 5, R.dark, { flat: true }); for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; p.disc(14 + Math.cos(t) * 7.5, 14 + Math.sin(t) * 7.5, 1.3, '#ffffff'); } },
    silver:  p => { for (let i = 0; i < 2; i++) p.box(4 + i * 2, 12 - i * 5, 20, 8, R.silver, { r: 1 }); },
    ssd:     p => { p.box(3, 8, 22, 13, R.dark, { r: 1 }); p.rect(5, 10, 12, 9, '#2d3550'); p.rect(19, 10, 4, 9, '#e3c14a'); p.rect(6, 11, 10, 2, '#5a92e8'); },
    medpack: p => { p.box(4, 7, 20, 16, R.white, { r: 2 }); p.rect(12, 9, 4, 12, '#f0535e'); p.rect(8, 13, 12, 4, '#f0535e'); p.rect(10, 4, 8, 3, '#646e86'); },
    hydro:   p => { p.box(3, 10, 14, 8, R.silver, { r: 2 }); p.box(16, 11, 9, 6, R.gunmetal); p.rect(5, 12, 10, 1, '#ffffff'); },
    servo:   p => { p.box(3, 7, 16, 15, R.yellow, { r: 2 }); p.ell(21, 14, 4, 4, R.gunmetal); p.rect(5, 10, 12, 2, '#5a3e0d'); p.disc(11, 16, 2.5, '#1d212c'); },
    gpu:     p => { p.box(2, 7, 24, 14, R.dark, { r: 1 }); p.ell(9, 14, 5, 5, R.gunmetal); p.ell(19, 14, 5, 5, R.gunmetal); p.disc(9, 14, 1.5, '#0b0a14'); p.disc(19, 14, 1.5, '#0b0a14'); p.rect(2, 21, 16, 2, '#e3c14a'); p.rect(4, 8, 20, 1, '#9b6bff', 1); },
    watch:   p => { p.rect(11, 2, 6, 24, '#5e3d36'); p.ell(14, 14, 7.5, 7.5, R.gold, { spec: true }); p.ell(14, 14, 5.5, 5.5, R.white, { flat: true }); p.line(14, 14, 14, 10, '#0b0a14'); p.line(14, 14, 17, 15, '#0b0a14'); },
    reactor: p => { p.box(7, 3, 14, 22, R.gunmetal, { r: 3 }); p.grad(10, 6, 8, 16, R.blue, 1); p.rect(12, 8, 4, 12, '#d0eaff', 1); p.rect(6, 3, 16, 2, '#949fb6'); p.rect(6, 23, 16, 2, '#949fb6'); },
    scope:   p => { p.box(3, 10, 22, 8, R.dark, { r: 3 }); p.ell(5, 14, 3, 5, R.glass, { emit: 0 }); p.ell(23, 14, 3, 5, R.glass); p.rect(10, 7, 6, 3, '#2d3550'); p.px(23, 12, '#ffffff'); },
    goldbar: p => { for (let i = 0; i < 2; i++) p.box(3 + i * 3, 13 - i * 6, 20, 9, R.gold, { r: 1 }); p.rect(9, 9, 6, 1, '#fff4c0'); },
    qchip:   p => { p.box(5, 5, 18, 18, R.dark, { r: 1 }); for (let i = 0; i < 5; i++) { p.rect(2, 7 + i * 3, 3, 1, '#e3c14a'); p.rect(23, 7 + i * 3, 3, 1, '#e3c14a'); } p.grad(9, 9, 10, 10, R.magenta, 1); p.disc(14, 14, 2, '#ffe0ff', 1); },
    laptop:  p => { p.box(4, 3, 20, 14, R.dark, { r: 1 }); p.grad(6, 5, 16, 10, R.glass, 1); p.box(2, 17, 24, 6, R.gunmetal, { r: 1 }); p.rect(6, 19, 16, 2, '#1d212c'); p.rect(7, 7, 8, 1, '#a6e2f0', 1); },
    pocketw: p => { p.line(14, 2, 14, 6, '#e8b42e'); p.ell(14, 15, 9, 9, R.gold, { spec: true }); p.ell(14, 15, 6.5, 6.5, R.white, { flat: true }); p.line(14, 15, 14, 10, '#0b0a14'); p.line(14, 15, 10, 17, '#0b0a14'); },
    core:    p => { p.box(7, 2, 14, 24, R.dark, { r: 3 }); p.grad(9, 5, 10, 18, R.copper, 1); p.rect(12, 7, 4, 14, '#fff0c8', 1); p.rect(6, 2, 16, 2, '#949fb6'); p.rect(6, 24, 16, 2, '#949fb6'); },
    blackbox:p => { p.box(4, 6, 20, 17, R.copper, { r: 2, bias: -0.1 }); p.rect(6, 10, 16, 2, '#0b0a14'); p.rect(6, 15, 16, 2, '#0b0a14'); p.disc(20, 8, 1.2, '#ff3047', 1); },
    necklace:p => { for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI; p.disc(14 + Math.cos(t) * 10, 6 + Math.sin(t) * 13, 1, '#e8b42e'); } p.ell(14, 20, 4, 4.5, R.glass, { spec: true }); p.px(13, 18, '#ffffff', 1); },
    // 高价值物品
    keycard:  p => { p.box(5, 7, 18, 13, R.white, { r: 2 }); p.rect(5, 10, 18, 3, '#3466c0'); p.rect(8, 15, 6, 2, '#e3c14a'); p.rect(17, 15, 3, 2, '#2d3550'); },
    cigar:    p => { p.box(3, 8, 22, 13, R.cloth, { r: 1 }); p.rect(3, 12, 22, 3, '#c82e3a'); p.rect(10, 12, 8, 3, '#e8b42e'); p.rect(5, 9, 18, 1, '#ad7a52'); },
    perfume:  p => { p.box(8, 10, 12, 14, R.magenta, { r: 3, bias: 0.15 }); p.rect(12, 5, 4, 5, '#e8b42e'); p.box(11, 2, 6, 4, R.gold, { r: 1 }); p.rect(10, 13, 2, 7, '#ffffff'); },
    camera:   p => { p.box(2, 8, 24, 15, R.dark, { r: 2 }); p.rect(5, 5, 7, 4, '#2d3550'); p.ell(15, 15, 6, 6, R.gunmetal); p.ell(15, 15, 3.5, 3.5, R.glass, { spec: true }); p.rect(21, 10, 3, 2, '#ff3047', 1); },
    server:   p => { p.box(6, 1, 16, 26, R.dark, { r: 1 }); for (let y = 4; y < 25; y += 4) { p.rect(8, y, 12, 2, '#20263b'); p.px(9, y, '#3ee8ff', 1); p.px(11, y, '#8dff6a', 1); } },
    coins:    p => { p.ell(14, 17, 10, 8, R.cloth); p.rect(10, 6, 8, 4, '#4a2f1f'); for (const [x, y] of [[8, 12], [14, 10], [20, 12], [11, 15]]) p.ell(x, y, 3, 2, R.gold, { spec: true }); },
    ruby:     p => { p.ell(14, 15, 8, 8, R.red, { spec: true, emit: 0 }); p.line(8, 11, 20, 11, '#ff98a0'); p.line(14, 7, 14, 23, '#8f1d26'); p.px(11, 10, '#ffffff', 1); },
    platinum: p => { for (let i = 0; i < 2; i++) p.box(3 + i * 3, 13 - i * 6, 20, 9, R.silver, { r: 1, spec: true }); p.rect(9, 9, 6, 1, '#ffffff'); p.rect(8, 11, 8, 1, '#9cc4ff'); },
    vase:     p => { p.ell(14, 17, 9, 9, R.blue, { spec: true }); p.box(10, 3, 8, 6, R.blue, { r: 1 }); p.rect(9, 3, 10, 1, '#9cc4ff'); for (let x = 7; x < 22; x += 4) p.px(x, 17, '#dde1ee'); p.line(8, 14, 20, 14, '#dde1ee'); },
    crypto:   p => { p.box(4, 6, 20, 16, R.gunmetal, { r: 2 }); p.rect(7, 9, 14, 6, '#0b0a14'); p.rect(8, 11, 5, 2, '#3ee8ff', 1); p.rect(15, 11, 4, 2, '#ff3d8b', 1); p.rect(8, 17, 12, 2, '#e3c14a'); },
    diamond:  p => { p.line(8, 9, 20, 9, '#ffffff'); p.line(8, 9, 14, 23, '#a6e2f0'); p.line(20, 9, 14, 23, '#a6e2f0'); p.grad(9, 9, 11, 8, R.glass, 1); p.line(11, 6, 17, 6, '#ffffff'); p.line(11, 6, 8, 9, '#dde1ee'); p.line(17, 6, 20, 9, '#dde1ee'); p.px(12, 10, '#ffffff', 1); },
    aicore:   p => { p.box(4, 4, 20, 20, R.dark, { r: 3 }); p.ell(14, 14, 7, 7, R.magenta, { emit: 1 }); p.ell(14, 14, 3, 3, R.white, { emit: 1, flat: true }); for (let i = 0; i < 4; i++) { p.rect(1, 7 + i * 4, 3, 1, '#e3c14a'); p.rect(24, 7 + i * 4, 3, 1, '#e3c14a'); } },
    painting: p => { p.box(2, 4, 24, 20, R.gold, { r: 1 }); p.rect(5, 7, 18, 14, '#1f448c'); p.rect(5, 15, 18, 6, '#2e7032'); p.disc(18, 10, 2, '#ffd860'); p.line(5, 15, 11, 11, '#4a9a48'); p.line(11, 11, 16, 15, '#4a9a48'); },
    // 背包：按大小画得越来越鼓
    bag_canvas: p => { p.box(6, 6, 16, 18, R.cloth, { r: 3, bias: -0.1 }); p.rect(9, 3, 10, 4, "#4a2f1f"); p.rect(8, 13, 12, 1, "#2f1d13"); },
    bag_sling:  p => { p.line(4, 3, 22, 20, "#253017"); p.box(7, 9, 15, 14, R.olive, { r: 3 }); p.box(10, 15, 9, 6, R.olive, { r: 1, bias: -0.15 }); },
    bag_tact:   p => { p.box(5, 4, 18, 21, R.olive, { r: 3 }); p.box(8, 13, 12, 9, R.olive, { r: 2, bias: -0.15 }); p.rect(5, 9, 18, 1, "#141a0e"); p.rect(13, 4, 2, 21, "#253017"); },
    bag_hike:   p => { p.box(5, 3, 18, 23, R.blue, { r: 4, bias: -0.1 }); p.box(8, 14, 12, 9, R.blue, { r: 2, bias: -0.25 }); p.ell(14, 4, 8, 3, R.red); p.rect(6, 10, 16, 1, "#0a1630"); },
    bag_mil:    p => { p.box(3, 3, 22, 23, R.gunmetal, { r: 3 }); p.box(5, 13, 8, 10, R.gunmetal, { r: 1, bias: -0.15 }); p.box(15, 13, 8, 10, R.gunmetal, { r: 1, bias: -0.15 }); p.rect(3, 9, 22, 2, "#e3c14a"); },
    // 弹药盒：盒身 + 露出的弹头
    ammo_nail:  p => { p.box(4, 11, 20, 13, R.gunmetal, { r: 1 }); for (let i = 0; i < 6; i++) p.line(7 + i * 3, 11, 7 + i * 3, 4, "#c8cdda"); p.rect(4, 16, 20, 2, "#e3c14a"); },
    ammo_light: p => { p.box(4, 12, 20, 12, R.olive, { r: 1 }); for (let i = 0; i < 5; i++) { p.box(6 + i * 4, 4, 3, 9, R.copper, { r: 1 }); } p.rect(4, 17, 20, 2, "#e3c14a"); },
    ammo_shell: p => { p.box(4, 12, 20, 12, R.red, { r: 1, bias: -0.2 }); for (let i = 0; i < 4; i++) { p.box(6 + i * 5, 4, 4, 9, R.red, { r: 1 }); p.rect(6 + i * 5, 10, 4, 3, "#e8b42e"); } },
    ammo_cell:  p => { p.box(5, 6, 18, 18, R.dark, { r: 2 }); for (let i = 0; i < 3; i++) p.grad(7 + i * 5, 8, 4, 14, R.blue, 1); },
    ammo_slug:  p => { p.box(3, 14, 22, 10, R.gunmetal, { r: 1 }); for (let i = 0; i < 3; i++) p.box(5 + i * 7, 3, 5, 12, R.silver, { r: 2 }); p.rect(5, 6, 19, 1, "#3ee8ff", 1); },
    cellpack:   p => { p.box(8, 4, 12, 20, R.dark, { r: 2 }); p.grad(10, 7, 8, 14, R.glass, 1); p.rect(11, 2, 6, 2, "#949fb6"); p.rect(12, 10, 4, 1, "#ffffff", 1); },
    stimpen:    p => { p.line(5, 22, 20, 7, "#c8cdda"); p.line(6, 22, 21, 7, "#9aa1b4"); p.box(9, 12, 7, 7, R.green, { r: 1, emit: 1 }); p.line(20, 7, 24, 3, "#eef1f8"); p.rect(4, 21, 4, 3, "#ff3047"); },
    // 武器与改装件
    gun_nail:   p => { p.box(3, 10, 16, 6, R.gunmetal, { r: 1 }); p.rect(19, 11, 6, 3, '#949fb6'); p.box(6, 16, 5, 8, R.cloth, { r: 1 }); p.px(24, 12, '#ff7a2e', 1); },
    gun_smg:    p => { p.box(2, 10, 20, 6, R.dark, { r: 1 }); p.rect(22, 11, 4, 3, '#646e86'); p.box(8, 16, 4, 9, R.dark); p.box(14, 16, 3, 6, R.gunmetal); p.rect(4, 11, 14, 1, '#3d4766'); },
    gun_shot:   p => { p.box(1, 11, 24, 5, R.gunmetal, { r: 1 }); p.box(1, 16, 7, 5, R.cloth, { r: 1 }); p.box(13, 16, 7, 3, R.cloth); p.rect(25, 12, 2, 3, '#949fb6'); },
    gun_pulse:  p => { p.box(1, 10, 24, 7, R.dark, { r: 2 }); p.rect(5, 12, 14, 2, '#3ee8ff', 1); p.box(7, 17, 4, 7, R.dark); p.rect(25, 12, 2, 3, '#3ee8ff', 1); },
    gun_rail:   p => { p.box(1, 11, 26, 6, R.steel, { r: 2 }); p.rect(3, 13, 22, 2, '#3ee8ff', 1); p.rect(18, 9, 6, 2, '#a3b6dc'); p.box(5, 17, 4, 7, R.dark); },
    gun_plasma: p => { p.box(2, 9, 20, 10, R.magenta, { r: 3 }); p.ell(23, 14, 3.5, 4, R.magenta, { emit: 1, bias: 0.3 }); p.rect(5, 12, 12, 2, '#ffb3d4', 1); p.box(6, 19, 4, 6, R.dark); },
    gun_sniper: p => { p.box(1, 12, 27, 4, R.gunmetal, { r: 1 }); p.box(9, 7, 11, 5, R.dark, { r: 2 }); p.rect(10, 8, 2, 3, '#3ee8ff', 1); p.box(4, 16, 4, 8, R.cloth, { r: 1 }); p.box(1, 13, 5, 6, R.cloth, { r: 1 }); p.rect(26, 13, 2, 2, '#949fb6'); },
    ammo_rifle: p => { p.box(4, 13, 20, 11, R.olive, { r: 1 }); for (let i = 0; i < 4; i++) p.box(6 + i * 5, 2, 3, 12, R.copper, { r: 1 }); p.rect(4, 18, 20, 2, '#e3c14a'); },
    nade_frag:  p => { p.ell(14, 16, 8, 9, R.olive, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); p.line(17, 5, 22, 9, '#c8cdda'); p.rect(7, 14, 14, 1, '#2a3320'); p.rect(7, 18, 14, 1, '#2a3320'); },
    nade_freeze:p => { p.ell(14, 16, 8, 9, R.blue, { bias: 0.2, emit: 1 }); p.rect(11, 4, 6, 4, '#949fb6'); p.rect(8, 14, 12, 2, '#e8fbff', 1); p.rect(13, 10, 2, 11, '#e8fbff', 1); },
    nade_emp:   p => { p.ell(14, 16, 8, 9, R.dark, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); p.line(11, 11, 15, 16, '#ffd84a', 1); p.line(15, 16, 12, 19, '#ffd84a', 1); p.line(12, 19, 18, 13, '#ffd84a', 1); },
    key1:       p => { p.box(3, 7, 22, 14, R.green, { r: 2 }); p.rect(5, 9, 7, 5, '#e3c14a'); p.rect(14, 16, 8, 1, '#eef1f8'); p.rect(14, 18, 5, 1, '#eef1f8'); },
    key2:       p => { p.box(3, 7, 22, 14, R.blue, { r: 2 }); p.rect(5, 9, 7, 5, '#e3c14a'); p.rect(14, 16, 8, 1, '#eef1f8'); p.rect(14, 18, 5, 1, '#eef1f8'); },
    key3:       p => { p.box(3, 7, 22, 14, R.red, { r: 2 }); p.rect(5, 9, 7, 5, '#e3c14a'); p.rect(14, 16, 8, 1, '#eef1f8'); p.rect(14, 18, 5, 1, '#eef1f8'); p.rect(20, 9, 3, 3, '#ffd84a', 1); },
    m_wrench:   p => { p.line(5, 23, 19, 9, '#a3b6dc'); p.line(6, 23, 20, 9, '#6f84b3'); p.box(17, 3, 8, 8, R.steel, { r: 2 }); p.rect(20, 3, 2, 4, '#0b0a14'); },
    m_crowbar:  p => { p.line(6, 23, 21, 6, '#c82e3a'); p.line(7, 23, 22, 6, '#8f1d26'); p.line(21, 6, 24, 8, '#c82e3a'); p.line(6, 23, 4, 21, '#c82e3a'); },
    m_blade:    p => { p.line(6, 22, 22, 6, '#ffb057', 1); p.line(7, 22, 23, 6, '#ff7a2e', 1); p.line(5, 21, 21, 5, '#fff0c8', 1); p.box(3, 20, 6, 6, R.dark, { r: 1 }); },
    m_chain:    p => { p.box(3, 16, 9, 8, R.yellow, { r: 2 }); p.box(10, 10, 16, 7, R.silver, { r: 3 }); for (let x = 11; x < 26; x += 2) p.px(x, 9, '#0b0a14'); },
    m_hammer:   p => { p.line(13, 25, 13, 12, '#5e3d36'); p.line(14, 25, 14, 12, '#3b2018'); p.box(4, 4, 20, 10, R.gunmetal, { r: 2 }); p.rect(4, 8, 20, 1, '#ff7a2e', 1); },
  };
  D.makeIcon = function (key, size) { const fn = D.ITEM_ART[key]; if (!fn) return null; const p = D.Paint(size || 28, size || 28); fn(p); p.outline(); return p.make(1).img; };
})(D);
