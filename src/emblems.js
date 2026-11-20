/* Underdog · 型号徽标：机库名单、转台标题用。28×28 像素，盾形底板用型号自己的色阶（HERO_DEFS 的 ramp），
   中间是代表它定位的图案（护目色发光）：
     工壳 齿轮 · 灵猫 猫头 · 犀甲 犀角 · 驮兽 货箱 · 白鹭 十字 · 蛛网 蛛网 · 鹰眼 瞄准镜 · 蜂巢 一只蜂
   D.shellEmblem(k) 返回画好的画布（缓存）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const cache = {};
  const W = '#f4f7ff';
  // 盾形底板：上面平、下面收成尖；顶部亮、往下暗；左边一道亮边、右边一道暗边
  function shield(p, R) {
    const hw = y => (y < 17 ? 11 : Math.max(0, Math.round(11 - (y - 16) * 1.15)));
    for (let y = 1; y <= 26; y++) { const h = hw(y); if (h <= 0) continue; p.rect(14 - h, y, h * 2, 1, y < 3 ? R[5] : y < 9 ? R[4] : y < 18 ? R[3] : R[2]); }
    for (let y = 1; y <= 26; y++) { const h = hw(y); if (h <= 0) continue; p.px(14 - h, y, R[6]); p.px(13 + h, y, R[1]); }
    p.rect(4, 1, 20, 1, R[6]);
  }
  // 图案画两遍：先往右下错一格画暗色当影子，再画亮色
  const ring = (p, cx, cy, r, col, e) => { for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; p.px(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), col, e); } };
  const SYM = {
    worker: (p, c, V, d) => { // 齿轮，轴心发光
      ring(p, 14 + d, 12 + d, 5, c); ring(p, 14 + d, 12 + d, 4, c);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.rect(Math.round(14 + d + Math.cos(a) * 6.5) - 1, Math.round(12 + d + Math.sin(a) * 6.5) - 1, 2, 2, c); }
      if (!d) p.rect(13, 11, 2, 2, V[1], 1);
    },
    scout: (p, c, V, d) => { // 猫头：两只尖耳、圆脸、两道发光的眼
      p.rect(9 + d, 11 + d, 10, 7, c); p.rect(10 + d, 18 + d, 8, 1, c);
      for (let i = 0; i < 4; i++) { p.rect(9 + d, 7 + i + d, 1 + i, 1, c); p.rect(19 - i + d - 1, 7 + i + d, 1 + i, 1, c); }
      if (!d) { p.rect(11, 13, 2, 1, V[1], 1); p.rect(16, 13, 2, 1, V[1], 1); p.px(14, 16, V[0]); }
    },
    heavy: (p, c, V, d, R) => { // 犀牛的两只角：前面大角往右上弯成尖，后面一只小角；下面一道带铆钉的厚甲
      const horn = (y0, y1, x1, x0, wmax) => { for (let y = y0; y <= y1; y++) { const s = (y - y0) / (y1 - y0), w = 1 + Math.round(wmax * Math.pow(s, 1.3)), cx = x0 + (x1 - x0) * (1 - s) * (1 - s); p.rect(Math.round(cx - w / 2) + d, y + d, w, 1, c); } };
      horn(4, 17, 19, 13, 7); horn(11, 17, 9, 7, 3);
      p.rect(5 + d, 18 + d, 18, 4, c);
      if (!d) { p.rect(6, 19, 16, 2, R[2]); for (const x of [7, 11, 16, 20]) p.px(x, 19, V[1], 1); p.px(19, 4, '#ffffff'); }
    },
    hauler: (p, c, V, d, R) => { // 木货箱：粗框、两道木板缝、一根斜撑，四角铆钉发光
      p.rect(6 + d, 7 + d, 16, 14, c);
      if (!d) { p.rect(8, 9, 12, 10, R[2]); p.rect(8, 12, 12, 1, R[1]); p.rect(8, 15, 12, 1, R[1]); p.line(8, 17, 18, 9, c); p.line(9, 18, 19, 10, c); for (const [x, y] of [[7, 8], [20, 8], [7, 19], [20, 19]]) p.px(x, y, V[1], 1); }
    },
    medic: (p, c, V, d) => { // 一个大十字，中间一道亮
      p.rect(12 + d, 4 + d, 5, 16, c); p.rect(6 + d, 9 + d, 17, 5, c);
      if (!d) { p.rect(13, 5, 3, 14, V[1], 1); p.rect(7, 10, 15, 3, V[1], 1); p.rect(14, 10, 1, 3, V[2], 1); p.rect(13, 11, 3, 1, V[2], 1); }
    },
    hacker: (p, c, V, d) => { // 蛛网：八根放射线 + 两圈 + 中间一只蜘蛛
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.line(14 + d, 12 + d, Math.round(14 + d + Math.cos(a) * 8), Math.round(12 + d + Math.sin(a) * 8), c); }
      for (const r of [4, 7]) { const v = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; v.push([Math.round(14 + d + Math.cos(a) * r), Math.round(12 + d + Math.sin(a) * r)]); } for (let i = 0; i < 8; i++) p.line(v[i][0], v[i][1], v[(i + 1) % 8][0], v[(i + 1) % 8][1], c); }
      if (!d) { p.disc(14, 12, 1.6, V[1], 1); p.px(12, 11, V[1]); p.px(16, 11, V[1]); p.px(12, 13, V[1]); p.px(16, 13, V[1]); }
    },
    marksman: (p, c, V, d) => { // 瞄准镜：一圈、十字（中间留空）、中心一点红
      ring(p, 14 + d, 12 + d, 7, c);
      p.rect(14 + d, 3 + d, 1, 6, c); p.rect(14 + d, 16 + d, 1, 6, c); p.rect(5 + d, 12 + d, 6, 1, c); p.rect(18 + d, 12 + d, 6, 1, c);
      if (!d) { p.rect(13, 11, 3, 3, V[1], 1); p.px(14, 12, '#ffffff', 1); }
    },
    carrier: (p, c, V, d, R) => { // 一只蜂（= 小无人机）：两片白翅膀、琥珀色发光的身子带两道黑纹、黑头和触角
      p.disc(9.5 + d, 10 + d, 3.6, c); p.disc(18.5 + d, 10 + d, 3.6, c);
      const body = !d ? V[1] : c;
      for (let y = 9; y <= 21; y++) { const t = (y + 0.5 - 15.5) / 6.5, hw = Math.round(4.2 * Math.sqrt(Math.max(0, 1 - t * t))); if (hw > 0) p.rect(14 - hw + d, y + d, hw * 2, 1, (!d && (y === 13 || y === 14 || y === 17 || y === 18)) ? R[0] : body, !d); }
      const ink = !d ? R[0] : c; p.disc(14 + d, 7.5 + d, 2.3, ink); p.line(13 + d, 5 + d, 11 + d, 3 + d, ink); p.line(14 + d, 5 + d, 16 + d, 3 + d, ink); p.px(14 + d, 22 + d, ink);
      if (!d) { p.px(12, 10, V[2], 1); p.px(12, 11, V[2], 1); p.px(9, 8, '#ffffff'); p.px(18, 8, '#ffffff'); }
    },
  };
  D.shellEmblem = function (k) {
    if (cache[k]) return cache[k];
    const H = (D.HERO_DEFS || {})[k] || (D.HERO_DEFS || {}).worker, R = H.ramp, V = H.visor, f = SYM[k] || SYM.worker;
    // 底板太亮（白鹭）时白图案看不清：图案换成护目色
    const n = parseInt(R[3].slice(1), 16), lum = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11, fg = lum > 140 ? V[0] : W;
    const p = D.Paint(28, 28); shield(p, R); f(p, R[0], V, 1, R); f(p, fg, V, 0, R); p.outline();
    const c = p.make(1).img; cache[k] = c; return c;
  };
})(D);
