/* 末班之后 · 小样：画面底层
   调色板、字符画精灵、3×5 像素数字字体、抖动光照、泛光、暗角。
   全部逻辑分辨率 384×216，最后整数倍放大。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const W = D.W, H = D.H;

  // ── 调色板：冷暗底 + 少量高饱和的光
  const PAL = D.PAL = {
    k: '#0b0a14', 1: '#1d2033', 2: '#2f3550', 3: '#4a5374', 4: '#7482a8', 5: '#b3c0dd', 6: '#eef3ff',
    o: '#ff7a2e', O: '#ffb057', Y: '#ffe9b0', r: '#ff3047', R: '#ffa0a0', m: '#ff3d8b', M: '#ffb3d4',
    c: '#3ee8ff', C: '#c4fbff', g: '#8dff6a', G: '#3c8f3a', b: '#2e2026', n: '#5e3d36', t: '#9c6b4f', T: '#d39b6a',
    s: '#161a29', w: '#5c3b8a', v: '#9b6bff', y: '#e3c14a', h: '#7a6420',
  };
  D.rgb = function (hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  D.rgba = (hex, a) => { const [r, g, b] = D.rgb(hex); return `rgba(${r},${g},${b},${a})`; };

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  D.canvas = canvas;

  // ── 字符画精灵。'.' 透明；emit 里的字母另出一张发光层；flash 是受击时的纯白剪影
  D.sprite = function (rows, opt) {
    opt = opt || {};
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const [img, x] = canvas(w, h), [em, ex] = canvas(w, h), [fl, fx] = canvas(w, h);
    const emit = opt.emit || '';
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = rows[j][i]; if (!ch || ch === '.') continue;
      const col = PAL[ch] || '#f0f';
      x.fillStyle = col; x.fillRect(i, j, 1, 1);
      fx.fillStyle = '#ffffff'; fx.fillRect(i, j, 1, 1);
      if (emit.includes(ch)) { ex.fillStyle = col; ex.fillRect(i, j, 1, 1); }
    }
    return { img, emit: emit ? em : null, flash: fl, w, h };
  };
  // 画精灵：(x,y) 是脚底中点；flip 水平翻转
  D.blit = function (ctx, spr, x, y, flip, which) {
    const im = which === 'flash' ? spr.flash : which === 'emit' ? spr.emit : spr.img;
    if (!im) return;
    const dx = Math.round(x - spr.w / 2), dy = Math.round(y - spr.h);
    if (!flip) ctx.drawImage(im, dx, dy);
    else { ctx.save(); ctx.translate(dx + spr.w, dy); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0); ctx.restore(); }
  };

  // ── 3×5 像素字体（数字与少量符号）
  const GLYPH = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
    '+': '000010111010000', '-': '000000111000000', 'x': '000101010101000', '/': '001001010100100', '%': '101001010100101',
    ':': '000010000010000', '!': '010010010000010', '?': '111001011000010', '.': '000000000000010', ' ': '000000000000000',
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'E': '111100110100111', 'G': '011100101101011',
    'K': '101101110101101', 'L': '100100100100111', 'M': '101111111101101', 'O': '010101101101010', 'P': '110101110100100',
    'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'N': '110101101101101', 'I': '111010010010111', 'D': '110101101101110', 'H': '101101111101101', 'Y': '101101010010010', 'F': '111100110100100',
  };
  D.textW = s => s.length * 4 - 1;
  D.text = function (ctx, s, x, y, col, opt) {
    opt = opt || {}; s = String(s).toUpperCase();
    const sc = opt.scale || 1, w = (s.length * 4 - 1) * sc;
    let px = Math.round(opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x), py = Math.round(y);
    const draw = (ox, oy, c) => {
      ctx.fillStyle = c;
      for (let n = 0; n < s.length; n++) {
        const g = GLYPH[s[n]]; if (!g) continue;
        for (let k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(px + ox + (n * 4 + (k % 3)) * sc, py + oy + Math.floor(k / 3) * sc, sc, sc);
      }
    };
    if (opt.shadow !== false) { draw(1, 1, opt.shadow || PAL.k); draw(-1, 0, opt.shadow || PAL.k); draw(0, -1, opt.shadow || PAL.k); draw(1, 0, opt.shadow || PAL.k); draw(0, 1, opt.shadow || PAL.k); }
    draw(0, 0, col);
  };

  // ── 后期：光照（抖动量化）+ 发光层 + 泛光 + 暗角
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const Post = D.Post = {};
  Post.init = function () {
    [Post.light, Post.lx] = canvas(W, H);
    [Post.emit, Post.ex] = canvas(W, H);
    [Post.small, Post.sx] = canvas(W >> 2, H >> 2);
    [Post.small2, Post.sx2] = canvas(W >> 3, H >> 3);
    Post.sx.imageSmoothingEnabled = true; Post.sx2.imageSmoothingEnabled = true;
    [Post.vig, Post.vx] = canvas(W, H);
    const g = Post.vx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(120,110,150,1)');
    Post.vx.fillStyle = g; Post.vx.fillRect(0, 0, W, H);
    Post.lights = [];
  };
  // 光：x,y,半径,颜色,强度(0..1+)，flicker 可选
  Post.addLight = function (x, y, r, col, a) { Post.lights.push(x, y, r, col, a); };
  Post.render = function (ctx, ambient, opt) {
    opt = opt || {};
    const lx = Post.lx, L = Post.lights;
    lx.globalCompositeOperation = 'source-over';
    lx.fillStyle = ambient; lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < L.length; i += 5) {
      const x = L[i], y = L[i + 1], r = L[i + 2], col = L[i + 3], a = L[i + 4];
      if (x + r < 0 || y + r < 0 || x - r > W || y - r > H || a <= 0) continue;
      const [cr, cg, cb] = D.rgb(col);
      const g = lx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${Math.min(1, a)})`);
      g.addColorStop(0.45, `rgba(${cr},${cg},${cb},${Math.min(1, a) * 0.45})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    L.length = 0;
    // 抖动量化：光只有几级，边缘是棋盘格
    const id = lx.getImageData(0, 0, W, H), d = id.data, LV = 6;
    for (let y = 0, p = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, p += 4) {
        const t = BAYER[by | (x & 3)];
        d[p] = Math.min(255, Math.floor(d[p] / 255 * LV + t) / LV * 255);
        d[p + 1] = Math.min(255, Math.floor(d[p + 1] / 255 * LV + t) / LV * 255);
        d[p + 2] = Math.min(255, Math.floor(d[p + 2] / 255 * LV + t) / LV * 255);
      }
    }
    lx.putImageData(id, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(Post.light, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.24; ctx.drawImage(Post.light, 0, 0); // 亮处略微过曝
    ctx.globalAlpha = 1; ctx.drawImage(Post.emit, 0, 0);
    // 泛光：缩小两级再放大叠加
    Post.sx.clearRect(0, 0, W >> 2, H >> 2); Post.sx.drawImage(Post.emit, 0, 0, W >> 2, H >> 2);
    Post.sx2.clearRect(0, 0, W >> 3, H >> 3); Post.sx2.drawImage(Post.small, 0, 0, W >> 3, H >> 3);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.9; ctx.drawImage(Post.small, 0, 0, W, H);
    ctx.globalAlpha = 0.8; ctx.drawImage(Post.small2, 0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(Post.vig, 0, 0);
    if (opt.tint) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = opt.tint; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    Post.ex.clearRect(0, 0, W, H);
  };
})(D);
