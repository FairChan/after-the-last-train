/* 末班之后 · 小样：精灵与图标
   角色身体用字符画，四肢、锯臂、围巾等会动的部分在 fight.js 里按帧程序绘制。
   卡牌、改装件、地图站点的图标用像素图元画好后自动描黑边。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL;
  const S = D.SPR = {};

  D.initArt = function () {
    // 工壳：头和披风分开，走路时头会晚半拍
    S.head = D.sprite([
      '..kkkkk..',
      '.k45556k.',
      'k4555566k',
      'k3oooOOYk',
      'k23ooooOk',
      '.k233333k',
      '..kkkkkk.',
    ], { emit: 'oOY' });
    S.body = D.sprite([
      '..kk222kk..',
      '.k2233332k.',
      'k223333332k',
      'k2233o3332k',
      'k123333321k',
      '.k1222221k.',
      '..kkkkkkk..',
    ], { emit: 'o' });
    S.drone = D.sprite([
      '....kkkkk....',
      '..kk45554kk..',
      '.k345566543k.',
      'k34556665543k',
      'k34kkrrrkk43k',
      'k23krRRRrk32k',
      'k23kkrrrkk32k',
      '.k223333322k.',
      '..kk1k1k1kk..',
      '....k.k.k....',
    ], { emit: 'rR' });
    S.crawler = D.sprite([
      '...kkkkkkk...',
      '..knttTttnk..',
      '.kntTTTTTtnk.',
      'kbntttttttnbk',
      'kbnggkkkggnbk',
      'kbbngkbkgnbbk',
      '.kbbbbbbbbbk.',
      '..kkkkkkkkk..',
    ], { emit: 'g' });
    S.turret = D.sprite([
      '....kkkkk....',
      '...k34443k...',
      '..k3455543k..',
      '..k3mmMmm3k..',
      '..k23mmm32k..',
      '.kk2233322kk.',
      'k22k22222k22k',
      'k12k21112k21k',
      'k11kkkkkkk11k',
      '.kk.......kk.',
    ], { emit: 'mM' });
    S.raiderBody = D.sprite([
      '..kk222kk..',
      '.k2nnnnn2k.',
      'kbnnnnnnnbk',
      'kbnnrnnnnbk',
      'k1bnnnnnb1k',
      '.k1bbbbb1k.',
      '..kkkkkkk..',
    ], { emit: 'r' });
    S.raiderHead = D.sprite([
      '..kkkkk..',
      '.kttttTk.',
      'ktttTTTTk',
      'kkkrrRkkk',
      'k1ttttttk',
      '.k1tttt1k',
      '..kkkkk..',
    ], { emit: 'rR' });
    S.engineer = D.sprite([
      '....kkkkkkkkk....',
      '...kOOOOOOOOOk...',
      '..kOYYOOOOOOOOk..',
      '..kOOkkkkkkkOOk..',
      '..kOkrrrrrrrkOk..',
      '..kOkrRRRRRrkOk..',
      '..knkkkkkkkkknk..',
      '.k22kykykykyk22k.',
      'k2332k22222k2332k',
      'k2332k23332k2332k',
      'k1221k12221k1221k',
      '.kkkk.k111k.kkkk.',
      '......k...k......',
    ], { emit: 'rR' });

    // 卡牌、改装件、站点图标
    D.ICON = {};
    for (const k in ICONS) D.ICON[k] = icon(ICONS[k], 16);
    for (const k in NODE_ICONS) D.ICON['node_' + k] = icon(NODE_ICONS[k], 13);
    D.ICON.node_cache = D.ICON.node_treasure;
  };

  // ── 小图元
  function icon(fn, size) {
    const [c, x] = D.canvas(size, size);
    const g = {
      px: (a, b, col) => { x.fillStyle = col; x.fillRect(a | 0, b | 0, 1, 1); },
      rect: (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); },
      line: (x0, y0, x1, y1, col, w) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; x.fillStyle = col; for (let i = 0; i <= n; i++) x.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w || 1, w || 1); },
      disc: (cx, cy, r, col) => { x.fillStyle = col; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.6) x.fillRect(cx + i, cy + j, 1, 1); },
      ring: (cx, cy, r, col) => { x.fillStyle = col; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = i * i + j * j; if (d <= r * r + r * 0.6 && d >= (r - 1) * (r - 1) + (r - 1) * 0.6 - 0.5) x.fillRect(cx + i, cy + j, 1, 1); } },
    };
    fn(g);
    return outline(c);
  }
  // 自动描 1 像素黑边
  function outline(src) {
    const w = src.width, h = src.height, s = src.getContext('2d').getImageData(0, 0, w, h).data;
    const [c, x] = D.canvas(w, h);
    x.fillStyle = P.k;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (s[(j * w + i) * 4 + 3]) continue;
      let near = false;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = i + a, v = j + b; if (u >= 0 && v >= 0 && u < w && v < h && s[(v * w + u) * 4 + 3]) near = true; }
      if (near) x.fillRect(i, j, 1, 1);
    }
    x.drawImage(src, 0, 0);
    return c;
  }
  D.outline = outline;

  const ICONS = {
    bolt: g => { g.line(2, 13, 11, 4, P.o, 2); g.line(3, 13, 11, 5, P.O); g.rect(11, 3, 3, 3, P.Y); g.px(12, 2, P.Y); g.px(14, 4, P.Y); },
    scatter: g => { for (const [a, b] of [[13, 3], [14, 8], [13, 13]]) { g.line(2, 8, a - 2, b, P.o); g.rect(a - 1, b - 1, 2, 2, P.Y); } g.disc(3, 8, 2, P.O); },
    lunge: g => { g.line(3, 12, 12, 3, P[5], 2); g.line(4, 12, 12, 4, P[6]); g.rect(2, 11, 3, 3, P.n); g.line(1, 10, 5, 14, P.t); for (let i = 0; i < 3; i++) g.line(1 + i * 2, 6 - i, 4 + i * 2, 3 - i, P.c); },
    mine: g => { g.disc(8, 9, 5, P[2]); g.ring(8, 9, 5, P[4]); g.disc(8, 9, 2, P.r); g.px(8, 8, P.R); for (const [a, b] of [[8, 2], [2, 9], [14, 9], [3, 4], [13, 4]]) g.px(a, b, P[5]); },
    arc: g => { g.line(2, 3, 7, 7, P.c, 2); g.line(7, 7, 5, 9, P.c, 2); g.line(5, 9, 13, 13, P.c, 2); g.line(3, 3, 7, 6, P.C); g.line(6, 10, 12, 13, P.C); },
    saw: g => { g.disc(8, 8, 5, P[4]); g.disc(8, 8, 2, P[2]); for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; g.px(8 + Math.round(Math.cos(t) * 6.5), 8 + Math.round(Math.sin(t) * 6.5), P[6]); } g.px(7, 7, P[6]); },
    rail: g => { g.rect(1, 6, 5, 5, P[3]); g.rect(2, 7, 3, 3, P.c); g.rect(6, 7, 9, 3, P.c); g.rect(6, 8, 9, 1, P.C); g.px(15, 8, P[6]); },
    slam: g => { g.rect(3, 2, 10, 6, P[3]); g.rect(4, 3, 8, 2, P[5]); g.rect(7, 8, 2, 6, P.n); g.line(1, 14, 4, 12, P.O); g.line(15, 14, 12, 12, P.O); g.line(8, 15, 8, 15, P.Y); },
    barrier: g => { g.line(3, 3, 13, 3, P.c, 1); for (let j = 3; j < 14; j++) { const hw = j < 9 ? 5 : 5 - (j - 8); g.rect(8 - hw, j, hw * 2, 1, j < 5 ? P.C : P.c); } g.rect(7, 5, 2, 6, P[6]); },
    salvage: g => { g.rect(2, 4, 8, 10, P[3]); g.rect(3, 5, 6, 8, P[4]); g.rect(6, 2, 8, 10, P[5]); g.rect(7, 3, 6, 8, P[6]); g.line(9, 6, 11, 6, P.c); g.line(9, 8, 11, 8, P.c); },
    over: g => { g.line(10, 1, 5, 8, P.y, 2); g.rect(5, 7, 6, 2, P.y); g.line(10, 8, 6, 15, P.y, 2); g.line(10, 2, 6, 7, P.Y); },
    cool: g => { for (let j = 0; j < 12; j++) { const hw = j < 5 ? Math.floor(j / 1.6) : Math.round(Math.sqrt(Math.max(0, 25 - (j - 7) * (j - 7)))); g.rect(8 - hw, 2 + j, hw * 2 + 1, 1, P.c); } g.rect(6, 8, 2, 3, P.C); },
    decoy: g => { g.disc(8, 5, 3, P.m); g.rect(4, 8, 9, 6, P.m); for (let i = 0; i < 16; i += 2) g.rect(0, i, 16, 1, 'rgba(0,0,0,0)'); g.px(7, 5, P.M); g.px(9, 5, P.M); g.line(4, 14, 12, 14, P.M); },
    calib: g => { g.ring(8, 8, 5, P.y); g.line(8, 0, 8, 5, P.Y); g.line(8, 11, 8, 15, P.Y); g.line(0, 8, 5, 8, P.Y); g.line(11, 8, 15, 8, P.Y); g.px(8, 8, P.r); },
    dynamo: g => { g.disc(8, 8, 5, P.y); for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; g.rect(7 + Math.round(Math.cos(t) * 6), 7 + Math.round(Math.sin(t) * 6), 2, 2, P.y); } g.disc(8, 8, 2, P.h); g.px(6, 6, P.Y); },
    jam: g => { g.disc(8, 8, 5, P[3]); g.disc(8, 8, 2, P[1]); g.line(3, 3, 13, 13, P.r, 2); g.line(13, 3, 3, 13, P.r, 2); },
    recycler: g => { g.rect(6, 9, 4, 6, P[3]); g.line(7, 9, 3, 3, P[4], 2); g.line(9, 9, 13, 3, P[4], 2); g.px(3, 2, P[6]); g.px(13, 2, P[6]); g.rect(7, 10, 2, 2, P.g); },
    condenser: g => { g.rect(5, 2, 6, 12, P[3]); for (let j = 3; j < 14; j += 2) g.rect(3, j, 10, 1, P.c); g.rect(6, 1, 4, 1, P[5]); },
    battery: g => { g.rect(3, 4, 10, 10, P[2]); g.rect(6, 2, 4, 2, P[4]); g.rect(4, 8, 8, 5, P.g); g.rect(4, 8, 8, 1, '#c8ffb0'); },
    spring: g => { for (let j = 0; j < 5; j++) g.line(3, 3 + j * 2, 13, 4 + j * 2, j & 1 ? P[4] : P[5]); g.rect(2, 13, 12, 2, P[3]); g.rect(2, 1, 12, 2, P.o); },
    magnet: g => { g.rect(3, 3, 3, 9, P.r); g.rect(10, 3, 3, 9, P.r); g.rect(3, 10, 10, 3, P.r); g.rect(3, 3, 3, 2, P[6]); g.rect(10, 3, 3, 2, P[6]); g.px(4, 6, P.R); },
    edge: g => { g.line(3, 13, 13, 3, P[6], 2); g.line(4, 13, 13, 4, P.c); g.rect(2, 12, 3, 3, P.o); },
    plating: g => { g.rect(3, 2, 10, 12, P[4]); g.rect(4, 3, 8, 10, P[3]); g.rect(4, 3, 8, 2, P[5]); g.px(5, 7, P[6]); g.px(10, 7, P[6]); g.px(5, 11, P[6]); g.px(10, 11, P[6]); },
    capacitor: g => { g.rect(2, 4, 4, 9, P[3]); g.rect(10, 4, 4, 9, P[3]); g.rect(6, 7, 4, 2, P.y); g.rect(3, 5, 2, 3, P.y); g.rect(11, 5, 2, 3, P.y); g.line(4, 1, 4, 3, P[5]); g.line(12, 1, 12, 3, P[5]); },
    relay: g => { g.line(8, 4, 8, 14, P[4]); g.line(4, 14, 8, 6, P[3]); g.line(12, 14, 8, 6, P[3]); g.disc(8, 3, 2, P.m); g.px(3, 2, P.M); g.px(13, 2, P.M); },
  };
  // 小样二：战利品与武器
  Object.assign(ICONS, {
    it_wire: g => { for (let i = 0; i < 4; i++) g.ring(8, 8, 2 + i, i & 1 ? P.t : P.T); g.line(12, 8, 15, 12, P.T); },
    it_can: g => { g.rect(4, 3, 8, 11, P[4]); g.rect(4, 3, 8, 2, P[5]); g.rect(4, 7, 8, 4, P.G); g.rect(5, 8, 3, 2, P.y); g.rect(4, 13, 8, 1, P[3]); },
    it_board: g => { g.rect(2, 3, 12, 10, P.G); g.rect(3, 4, 10, 8, '#2c6a2a'); g.rect(5, 6, 4, 3, P[1]); g.line(9, 7, 12, 7, P.y); g.line(4, 10, 11, 10, P.y); g.px(4, 5, P.y); g.px(12, 11, P.y); for (let i = 3; i < 13; i += 2) g.px(i, 13, P[5]); },
    it_meds: g => { g.rect(3, 4, 10, 10, P[6]); g.rect(3, 4, 10, 2, P[5]); g.rect(7, 7, 2, 6, P.r); g.rect(5, 9, 6, 2, P.r); g.rect(6, 2, 4, 2, P[4]); },
    it_sensor: g => { g.disc(8, 8, 5, P[3]); g.disc(8, 8, 3, P[1]); g.disc(8, 8, 1, P.c); g.px(7, 7, P.C); g.rect(13, 7, 2, 2, P[4]); g.rect(1, 7, 2, 2, P[4]); },
    it_bearing: g => { g.ring(8, 8, 6, P[5]); g.ring(8, 8, 3, P[5]); for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3; g.px(8 + Math.round(Math.cos(t) * 4.5), 8 + Math.round(Math.sin(t) * 4.5), P[6]); } },
    it_servo: g => { g.rect(2, 5, 9, 8, P[3]); g.rect(3, 6, 7, 2, P[4]); g.rect(11, 7, 3, 4, P[5]); g.rect(14, 8, 2, 2, P[6]); g.rect(4, 10, 5, 1, P.o); g.rect(2, 13, 9, 1, P[2]); },
    it_core: g => { g.rect(4, 2, 8, 12, P[2]); g.rect(5, 3, 6, 10, P.o); g.rect(6, 4, 4, 8, P.O); g.rect(7, 5, 2, 6, P.Y); g.rect(3, 2, 10, 1, P[4]); g.rect(3, 13, 10, 1, P[4]); },
    it_ticket: g => { g.rect(2, 4, 12, 8, '#d9c9a0'); g.rect(2, 4, 12, 2, P.r); g.line(4, 8, 10, 8, P.n); g.line(4, 10, 8, 10, P.n); g.px(12, 9, P.r); g.px(2, 8, P.k); g.px(13, 8, P.k); },
    gun_nail: g => { g.rect(2, 6, 10, 4, P[3]); g.rect(2, 6, 10, 1, P[5]); g.rect(12, 7, 3, 2, P[5]); g.rect(4, 10, 3, 4, P.n); g.rect(7, 10, 2, 2, P[2]); g.px(14, 7, P.O); },
    gun_pulse: g => { g.rect(1, 6, 13, 4, P[2]); g.rect(1, 6, 13, 1, P[4]); g.rect(4, 7, 6, 1, P.c); g.rect(14, 7, 2, 2, P.c); g.rect(3, 10, 3, 4, P[3]); g.rect(8, 10, 2, 3, P[3]); },
    it_wrench: g => { g.line(3, 13, 11, 5, P[5], 2); g.rect(10, 2, 4, 4, P[4]); g.px(12, 3, P.k); g.px(13, 2, P.k); g.rect(2, 12, 3, 3, P[4]); },
    it_mag: g => { g.rect(5, 2, 6, 12, P[3]); g.rect(6, 3, 4, 10, P[2]); for (let j = 4; j < 13; j += 2) g.rect(6, j, 4, 1, P.y); },
    it_rack: g => { g.rect(3, 3, 10, 11, P.n); g.rect(4, 4, 8, 4, P.t); g.rect(4, 9, 8, 4, P.t); g.rect(7, 5, 2, 2, P.y); g.rect(7, 10, 2, 2, P.y); g.rect(2, 2, 2, 12, P[3]); g.rect(12, 2, 2, 12, P[3]); },
    it_muffler: g => { g.rect(2, 6, 12, 4, P[2]); g.rect(2, 6, 12, 1, P[4]); for (let i = 4; i < 13; i += 3) g.rect(i, 7, 1, 3, P[1]); g.rect(14, 7, 1, 2, P[5]); },
    medkit: g => { g.rect(2, 4, 12, 10, P.r); g.rect(2, 4, 12, 2, P.R); g.rect(7, 6, 2, 7, P[6]); g.rect(5, 8, 6, 2, P[6]); g.rect(6, 2, 4, 2, P[4]); },
  });
  D.ICON_ART = ICONS; // content.js 往里加新卡的图标（initArt 运行时一起画）
  const NODE_ICONS = D.NODE_ICON_ART = {
    outpost: g => { g.rect(1, 1, 11, 7, P.n); g.rect(2, 2, 9, 5, P.O); g.rect(2, 2, 9, 1, P.y); g.rect(6, 2, 1, 5, P.n); g.rect(2, 4, 9, 1, P.n); g.line(3, 12, 9, 10, P.n); g.line(3, 10, 9, 12, P.n); g.rect(5, 8, 3, 2, P.O); g.px(6, 7, P.y); g.px(4, 9, P.r); g.px(8, 9, P.r); }, // 人类据点：一扇亮着暖灯的窗，窗下一小堆火
    ruin: g => { g.rect(2, 6, 3, 6, P[3]); g.rect(6, 4, 3, 8, P[3]); g.rect(9, 8, 2, 4, P[3]); g.px(6, 4, P[5]); },
    market: g => { g.rect(1, 3, 11, 3, P.m); for (let i = 1; i < 12; i += 2) g.px(i, 5, P.M); g.rect(2, 6, 9, 6, P[3]); g.rect(4, 8, 5, 4, P.c); },
    hangar: g => { g.rect(1, 5, 11, 7, P[3]); g.line(1, 5, 6, 2, P[4]); g.line(6, 2, 11, 5, P[4]); g.rect(3, 7, 7, 5, P[1]); g.rect(4, 8, 5, 1, P.r); },
    factory: g => { g.rect(1, 6, 11, 6, P[3]); g.rect(2, 2, 2, 5, P[4]); g.rect(6, 4, 2, 3, P[4]); g.px(2, 1, P.O); g.rect(3, 9, 2, 2, P.O); g.rect(7, 9, 2, 2, P.O); },
    depot: g => { g.disc(6, 6, 5, P.r); g.rect(3, 4, 2, 3, P.k); g.rect(8, 4, 2, 3, P.k); g.rect(4, 9, 5, 1, P.k); },
    exit: g => { g.rect(1, 3, 11, 7, P[5]); g.rect(1, 3, 11, 2, P.g); g.rect(2, 6, 3, 2, P.c); g.rect(7, 6, 3, 2, P.c); g.rect(2, 10, 2, 2, P.k); g.rect(8, 10, 2, 2, P.k); },
    event: g => { g.rect(4, 1, 5, 2, P.Y); g.rect(8, 2, 2, 4, P.Y); g.rect(3, 2, 2, 2, P.Y); g.rect(5, 6, 3, 2, P.Y); g.rect(5, 10, 3, 2, P.Y); },
    unknown: g => { g.rect(4, 2, 5, 2, P[4]); g.rect(8, 3, 2, 3, P[4]); g.rect(5, 6, 3, 2, P[4]); g.rect(5, 10, 2, 2, P[4]); },
    fight: g => { g.line(2, 2, 10, 10, P[5], 1); g.line(10, 2, 2, 10, P[5], 1); g.rect(1, 9, 3, 3, P.n); g.rect(9, 9, 3, 3, P.n); g.px(6, 6, P[6]); },
    elite: g => { g.disc(6, 7, 4, P.O); g.rect(3, 6, 2, 2, P.r); g.rect(8, 6, 2, 2, P.r); g.line(1, 1, 3, 4, P.O); g.line(11, 1, 9, 4, P.O); g.rect(4, 10, 5, 1, P.k); },
    shop: g => { g.disc(6, 7, 4, P.y); g.ring(6, 7, 4, P.h); g.rect(5, 4, 2, 6, P.h); g.rect(4, 5, 4, 1, P.h); g.rect(4, 8, 4, 1, P.h); },
    rest: g => { g.line(2, 10, 8, 4, P[5], 2); g.rect(8, 1, 4, 4, P[4]); g.px(10, 2, P.k); g.rect(1, 9, 3, 3, P[3]); },
    treasure: g => { g.rect(1, 4, 11, 8, P.n); g.rect(1, 4, 11, 3, P.t); g.rect(5, 6, 3, 3, P.y); g.rect(1, 7, 11, 1, P.b); },
    refuge: g => { g.line(1, 11, 6, 2, P.t); g.line(6, 2, 11, 11, P.t); g.rect(3, 9, 7, 3, P.n); g.rect(5, 8, 3, 4, P.k); g.px(6, 1, P.O); g.px(9, 5, P.y); },
    blackmarket: g => { g.disc(6, 7, 5, P.k); g.ring(6, 7, 5, P.v); g.rect(5, 3, 2, 8, P.y); g.rect(4, 4, 4, 1, P.y); g.rect(4, 9, 4, 1, P.y); g.px(1, 1, P.v); },
    hospital: g => { g.rect(1, 2, 11, 10, P[6]); g.rect(5, 3, 3, 8, P.r); g.rect(2, 6, 9, 3, P.r); },
    nest: g => { g.disc(6, 7, 5, P.G); g.disc(6, 7, 3, P.g); g.px(4, 6, P.k); g.px(8, 6, P.k); g.line(1, 2, 3, 4, P.g); g.line(11, 2, 9, 4, P.g); g.line(1, 12, 3, 10, P.g); g.line(11, 12, 9, 10, P.g); },
    relay: g => { g.line(6, 4, 6, 12, P[4]); g.line(2, 12, 6, 5, P[3]); g.line(10, 12, 6, 5, P[3]); g.disc(6, 3, 2, P.c); g.px(1, 2, P.C); g.px(11, 2, P.C); },
    armory: g => { g.rect(1, 4, 11, 7, P.G); g.rect(1, 4, 11, 2, P.g); g.rect(3, 7, 7, 1, P.k); g.rect(3, 9, 2, 2, P.y); g.rect(6, 9, 2, 2, P.y); g.rect(9, 9, 1, 2, P.y); },
    museum: g => { g.line(1, 4, 6, 1, P.Y); g.line(6, 1, 11, 4, P.Y); g.rect(1, 4, 11, 1, P.Y); for (let i = 2; i < 11; i += 3) g.rect(i, 5, 1, 6, P[5]); g.rect(1, 11, 11, 1, P.Y); },
    checkpoint: g => { g.rect(1, 6, 11, 2, P.r); g.rect(1, 6, 2, 2, P[6]); g.rect(5, 6, 2, 2, P[6]); g.rect(9, 6, 2, 2, P[6]); g.rect(1, 3, 1, 9, P[4]); g.disc(10, 2, 1, P.r); },
    datacenter: g => { for (let i = 0; i < 3; i++) { g.rect(1 + i * 4, 2, 3, 10, P[2]); g.px(2 + i * 4, 4, P.c); g.px(2 + i * 4, 7, P.g); g.px(2 + i * 4, 10, P.c); } },
    bank: g => { g.rect(1, 6, 11, 6, P.y); g.rect(1, 6, 11, 1, P.Y); g.rect(3, 8, 7, 3, P.h); g.disc(6, 3, 2, P.y); g.px(6, 3, P.Y); g.rect(5, 9, 3, 1, P.Y); },
    boss: g => { g.disc(6, 6, 5, P.r); g.rect(3, 4, 2, 3, P.k); g.rect(8, 4, 2, 3, P.k); g.rect(3, 9, 7, 2, P.k); g.px(4, 9, P[6]); g.px(6, 9, P[6]); g.px(8, 9, P[6]); },
  };
})(D);
