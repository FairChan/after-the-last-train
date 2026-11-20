/* Underdog：背景和过场共用的像素画工具，让开始页 / 首页背景（skyline.js）、坐车过场（ride.js）、电梯里（lift.js）
   和站里是同一套画风：底色压暗、光走 gfx.js 的 Post（抖动成几级、边缘是棋盘格），发光的东西画进发光层（泛光），四角暗角。
   渐变一律用 4×4 点阵过渡，多边形逐行填整像素，不走浏览器的平滑渐变和抗锯齿。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const X = D.Pix = {};
  X.bayer = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
  X.hash = (a, b) => { let n = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35); n ^= n >>> 13; n = Math.imul(n, 0x27d4eb2f); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
  const rgbCache = new Map();
  X.rgb = c => { let v = rgbCache.get(c); if (!v) { v = D.rgb(c); rgbCache.set(c, v); } return v; };

  // 逐像素画一块：fn(x, y) 返回颜色字符串或 null（不画）。只在预先画好的缓存里用（离屏画布），不要每帧整屏调
  X.paint = function (g, x0, y0, w, h, fn) {
    x0 |= 0; y0 |= 0; w |= 0; h |= 0; if (w <= 0 || h <= 0) return;
    const id = g.getImageData(x0, y0, w, h), d = id.data;
    for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p += 4) {
      const c = fn(x0 + x, y0 + y); if (!c) continue;
      const [r, gg, b] = X.rgb(c); d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = 255;
    }
    g.putImageData(id, x0, y0);
  };
  // 一串颜色按 k（0..1）取，两档之间用点阵过渡
  X.ramp = (cols, k, x, y) => { k = Math.max(0, Math.min(0.9999, k)) * (cols.length - 1); const i = Math.floor(k); return k - i > X.bayer(x, y) ? cols[i + 1] : cols[i]; };
  // 点阵透明：密度 a（0..1）的地方画、别的地方空着（雾、光柱这类，边缘是整像素）
  X.on = (a, x, y) => a > X.bayer(x, y);

  // 凸多边形：逐行填，边缘是整像素
  X.poly = function (g, pts, col) {
    let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
    g.fillStyle = col; const n = pts.length / 2;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      const sy = y + 0.5; let a = Infinity, b = -Infinity;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) { const x = ax + (sy - ay) / (by - ay) * (bx - ax); a = Math.min(a, x); b = Math.max(b, x); }
      }
      if (b > a) { const l = Math.round(a), r = Math.round(b); if (r > l) g.fillRect(l, y, r - l, 1); }
    }
  };
  // 屏幕上的光（640×360 坐标）：走 Post 的光照（抖动量化、和站里一样）
  X.light = (x, y, r, col, a) => { if (D.Post && D.Post.addLight) D.Post.addLight(x, y, r, col, a); };
  // 收尾：把这一帧的光照、发光层、泛光、暗角合到画面上（和站里同一道工序）
  X.finish = (ctx, ambient, opt) => { if (D.Post && D.Post.render && D.Post.light) D.Post.render(ctx, ambient, opt); };
})(D);
