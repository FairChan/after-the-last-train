/* Underdog：白沙的弹坑环境（story/第三幕-白沙.md："东区有一个比别处新的弹坑"，坑底压着一个营地）
   一种新环境"弹坑"（地面、露天）：灰白的灰烬地、烧成玻璃的地面裂纹、坑沿一层层的土；
   坑底散着碎混凝土、烧黑的钢梁、熔化的玻璃；营地废墟里是锈床架、锅、一面画满了车的墙（孩子的粉笔画）；坑边一块辐射警示牌。
   只给白沙东区的弹坑附近的站用（地图偏东、城区以上，和 story-act2.js 的辐射"弹坑"同一个判断）：城市生成时把这些站的骨架定成 crater。
   不进随机骨架表（D.LAYOUTS 里的 crater 设成不可枚举，LAYOUT_W 不加）：别的城、岚川的站一个都不变。
   形状借溶洞的生成（几个不规则的坑连着歪歪扭扭的沟），生成完把房间、配色、灯换成弹坑的。
   画法守死亡细胞画风：摆设全用 D.mkSprite（D.ENV_SPRITES，倒角 / 球面着色、抖动、黑边），地面花纹和别的环境一样直接铺。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  if (!D.ENVS || !D.ENVS.cave || !D.ENV_SPRITES) return;
  const TS = 16, Z = 2, T2 = TS * Z, R = D.RAMP, ENVS = D.ENVS;
  const rampOf = c => [D.mixHex(c, '#0b0a14', 0.7), D.mixHex(c, '#0b0a14', 0.45), D.mixHex(c, '#0b0a14', 0.2), c, D.mixHex(c, '#f4f2ea', 0.25), D.mixHex(c, '#f4f2ea', 0.5), D.mixHex(c, '#f4f2ea', 0.75)];
  const ASH = rampOf('#7a776f'), SOOT = rampOf('#3a3632'), CONC = rampOf('#8a8780');

  // ── 配色（灰白的灰烬、阴天的冷光；霓虹位用病态的浅绿和冷白）
  D.THEMES.crater = { name: '弹坑', floor: ['#5e5c57', '#63615b', '#5a5853'], grout: '#3a3834', wall: '#141310', face: ['#4c4942', '#57534b'], neon: ['#b8ff9a', '#e8f0e0'], ambient: '#555963', lamp: '#e8f0e0', pattern: 'ash' };

  // ── 房间
  const Rm = (name, floor, props, cont, nCont, o) => Object.assign({ name, floor, props, cont, nCont }, o || {});
  Object.assign(D.ROOMS, {
    craterbed: Rm('弹坑', 'theme', [['rubble', 3], ['charredbeam', 2], ['glassshard', 2], ['radsign', 1]], [['scrapheap', 2], ['corpse', 1], ['oreheap', 1], ['wreck', 1]], [2, 4], { outdoor: true, thin: 0.5 }),
    campruin: Rm('营地废墟', 'theme', [['bedframe', 2], ['pot', 2], ['rubble', 1], ['trainmural', 1]], [['suitcase', 1], ['pantry', 1], ['sacks', 1], ['corpse', 1], ['schoolbags', 1]], [2, 3], { outdoor: true, thin: 0.4 }),
    scorched: Rm('烧毁的车间', 'theme', [['charredbeam', 2], ['rubble', 1], ['glassshard', 1]], [['wreck', 2], ['scrapheap', 1], ['partsbin', 1], ['toolbox', 1]], [2, 3], { outdoor: true, thin: 0.4 }),
  });
  const REMAP = { cavern: 'craterbed', mine: 'scorched', grotto: 'campruin', camp: 'campruin' };

  // ── 环境：形状借溶洞，生成完换皮
  const cave = ENVS.cave;
  const CRATER = { name: '弹坑', above: true, theme: 'crater', main: 'craterbed', desc: '东区那一发留下的坑：地面烧成了玻璃，坑底压着一个营地', rooms: [['craterbed', 2], ['campruin', 2], ['scorched', 1]],
    foes: [['crawler', 3], ['mite', 2], ['bomber', 1]],
    gen(rng, st, opt) {
      const F = cave.gen(rng, st, opt);
      F.env = 'crater'; F.theme = 'crater'; F.th = Object.assign({}, D.THEMES.crater); F.ambient = F.th.ambient; F.outdoor = true; F.dark = false; F.foes = this.foes;
      F.name = '地面 · 弹坑';
      for (const r of F.rooms) if (REMAP[r.kind]) { r.kind = REMAP[r.kind]; r.name = D.ROOMS[r.kind].name; }
      const cols = ['#e8f0e0', '#b8ff9a', '#e8f0e0'];
      F.lights.forEach((l, i) => { l.col = cols[i % cols.length]; l.a = Math.min(l.a, 0.5); l.flick = Math.max(l.flick || 0, 0.06); });
      return F;
    } };
  Object.defineProperty(ENVS, 'crater', { value: CRATER, enumerable: false }); // 也不让"十二种环境"那些按表走一遍的地方（每座城每种至少两座）把它算进去
  Object.defineProperty(D.LAYOUTS, 'crater', { value: { name: '弹坑', desc: CRATER.desc, env: true, above: true }, enumerable: false }); // 不进随机骨架

  // 白沙东区弹坑附近的站（和辐射同一个判断）都用这套环境
  // 第 4 版的白沙有一个真的坑（C.crater）：坑沿外面一圈的站；老城：地图偏东、城区以上
  const near = (s, C) => C && C.crater ? Math.hypot(s.x - C.crater.x, s.y - C.crater.y) < C.crater.r * 1.6 : s.x > D.cityW(C) * 0.55;
  const crater = (s, C) => !s.dead && !s.home && !s.hidden && !s.reserve && near(s, C) && s.tier >= 1 && !(D.STATION_TYPES[s.type] || {}).safe && s.type !== 'event';
  const mk0 = D.makeCity;
  D.makeCity = function () {
    const C = mk0.apply(this, arguments);
    try { if (C.key === 'baisha') for (const s of C.stations) if (crater(s, C)) s.layout = 'crater'; } catch (e) { console.error(e); }
    return C;
  };
  D.isCraterStation = crater;

  // ── 地面：灰烬地，熔成玻璃的裂纹、玻璃碴的反光、烧焦的黑斑；坑里的水（地下湖那块）是发暗的绿玻璃色
  const pf0 = D.paintFloorTile;
  D.paintFloorTile = function (x, F, tx, ty, rng) {
    pf0.apply(this, arguments);
    if (F.env !== 'crater') return;
    const px = tx * T2, py = ty * T2, R2 = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); }, h = (tx * 73856093) ^ (ty * 19349663), r = k => ((h >>> (k * 3)) & 31) / 31;
    if (F.surf && F.surf[ty * F.tw + tx] === 3) { R2(px, py, T2, T2, '#1c2a22'); for (let i = 0; i < 4; i++) R2(px + 3 + ((tx * 11 + i * 7) % 24), py + 4 + ((ty * 5 + i * 9) % 22), 3, 1, '#4a6a52'); return; }
    R2(px, py, T2, T2, F.th.floor[(tx * 2 + ty * 3) % F.th.floor.length]);
    // 爆心：主坑的中心一片烧成黑玻璃，外面一圈发白的灼痕，往外放射的裂纹
    const C0 = F._crater || (F._crater = (() => { const m = F.rooms.find(q => q.kind === 'craterbed') || F.rooms[0]; return m ? { x: m.x + m.w / 2, y: m.y + m.h / 2, r: Math.max(3, Math.min(m.w, m.h) * 0.45) } : { x: -99, y: -99, r: 1 }; })());
    let core = 0;
    for (let sy = 0; sy < 8; sy++) for (let sx = 0; sx < 8; sx++) { // 4 像素一小格算到爆心的距离：圈是圆的，边上按点阵抖动
      const ddx = tx + (sx + 0.5) / 8 - C0.x, ddy = (ty + (sy + 0.5) / 8 - C0.y) * 1.4, d = Math.hypot(ddx, ddy) / C0.r + (((sx * 5 + sy * 3 + tx + ty) & 3) - 1.5) * 0.025;
      const ang = Math.atan2(ddy, ddx), c = d < 0.22 ? '#1f211c' : d < 0.42 ? '#2b2d27' : d < 0.58 ? '#43433c' : d < 0.74 ? '#8a877e' : d < 0.86 ? '#726f68' : (d < 1.5 && Math.abs(Math.sin(ang * 7)) < 0.06) ? '#2a2924' : null;
      if (c) R2(px + sx * 4, py + sy * 4, 4, 4, c); if (d < 0.42) core++;
    }
    if (core > 40) { for (let i = 0; i < 3; i++) R2(px + ((tx * 17 + i * 9) % 26), py + ((ty * 11 + i * 7) % 26), 3, 1, i ? '#5a7a62' : '#b8ff9a'); return; } // 爆心里：黑玻璃上几点绿光，不再撒灰
    for (let i = 0; i < 6; i++) R2(px + ((tx * 13 + i * 7) % 28), py + ((ty * 7 + i * 11) % 28), 2 + (i % 2), 1 + (i % 3 === 0 ? 1 : 0), i % 2 ? '#77746c' : '#4a4843'); // 灰烬颗粒
    if (r(1) < 0.35) { const ox = 4 + (r(2) * 14 | 0), oy = 6 + (r(3) * 14 | 0); R2(px + ox, py + oy, 9, 1, '#2a2824'); R2(px + ox + 8, py + oy, 1, 6, '#2a2824'); R2(px + ox + 8, py + oy + 6, 7, 1, '#2a2824'); R2(px + ox + 1, py + oy - 1, 7, 1, '#8a877e'); } // 熔裂纹
    if (r(4) < 0.22) { R2(px + 6 + (r(5) * 16 | 0), py + 8 + (r(6) * 14 | 0), 2, 1, '#c8e0d0'); R2(px + 20 - (r(7) * 10 | 0), py + 20, 1, 1, '#e8f4ee'); }       // 玻璃碴
    if (r(8) < 0.18) { const ox = r(9) * 18 | 0, oy = r(0) * 18 | 0; R2(px + ox + 2, py + oy + 2, 10, 6, '#3c3a35'); R2(px + ox, py + oy + 3, 14, 4, '#45423c'); } // 焦斑
  };
  // ── 墙：坑沿，一层层的土和灰，顶上一道亮边；里面是黑的
  const pw0 = D.paintWallX;
  D.paintWallX = function (x, ex, F, tx, ty, isFloor, rng, crack) {
    if (F.env === 'crater' && !crack) {
      const px = tx * T2, py = ty * T2, R2 = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
      if (isFloor(tx, ty + 1)) {
        R2(px, py, T2, T2, F.th.face[0]);
        for (let j = 3; j < T2; j += 6) R2(px, py + j + ((tx * 5) % 3), T2, 2, (j / 6) % 2 ? F.th.face[1] : '#3a3732');
        R2(px, py, T2, 2, '#9a968c'); if ((tx * 7 + ty) % 5 === 0) R2(px + ((tx * 11) % 26), py + 10, 4, 3, '#2a2824');
        return true;
      }
      R2(px, py, T2, T2, '#151410'); for (let i = 0; i < 3; i++) R2(px + ((tx * 13 + i * 9) % 24), py + ((ty * 7 + i * 11) % 24), 6, 4, '#1d1b17');
      if (isFloor(tx - 1, ty)) R2(px, py, 3, T2, '#3a3732'); if (isFloor(tx + 1, ty)) R2(px + T2 - 3, py, 3, T2, '#3a3732'); if (isFloor(tx, ty - 1)) R2(px, py, T2, 4, '#4c4942');
      return true;
    }
    return pw0 ? pw0.apply(this, arguments) : false;
  };

  // ── 摆设（D.ENV_SPRITES：{ w, h, fn, light }，2 倍精度，脚底在最下面一行）
  Object.assign(D.ENV_SPRITES, {
    rubble: rng => { const n = rng ? rng.int(0, 2) : 0; return { w: 40, h: 26, fn: p => {
      p.ell(12, 18, 10, 7, CONC, { bias: -0.05 }); p.ell(26, 17, 9, 8, ASH); p.ell(19, 11, 8, 6, CONC, { bias: 0.05 });
      if (n !== 1) p.ell(34, 21, 5, 4, CONC, { bias: -0.1 });
      p.line(22, 8, 30, 2, R.rust[3]); p.line(23, 8, 31, 2, R.rust[2]); p.line(10, 12, 6, 5, R.rust[3]); // 露出来的钢筋
    } }; },
    charredbeam: () => ({ w: 56, h: 30, fn: p => {
      p.box(2, 14, 46, 8, SOOT, { r: 1, v: 0.5 }); p.box(2, 10, 46, 4, SOOT, { v: 0.62 }); p.box(2, 22, 46, 4, SOOT, { v: 0.4 }); // 倒着的工字钢
      p.box(46, 4, 8, 18, SOOT, { r: 1, v: 0.45 });                                    // 弯起来的一头
      for (const x of [8, 20, 34]) p.box(x, 12, 5, 3, R.rust, { v: 0.45 });
      p.px(14, 15, '#ff8a3a', true); p.px(30, 17, '#ff6a2a', true);                     // 还没灭的一点火星
    } }),
    glassshard: () => ({ w: 22, h: 18, fn: p => {
      p.ell(11, 11, 9, 6, R.glass, { spec: true }); p.ell(6, 9, 4, 4, rampOf('#7ab8a0'), { spec: true }); p.px(13, 8, '#e8fff4', true); p.px(9, 12, '#b8ff9a', true);
    } }),
    bedframe: () => ({ w: 48, h: 26, fn: p => {
      p.box(2, 8, 4, 18, R.rust, { v: 0.5 }); p.box(42, 4, 4, 22, R.rust, { v: 0.45 });   // 床头、床尾
      p.box(2, 14, 44, 3, R.rust, { v: 0.6 }); p.box(2, 20, 44, 2, R.rust, { v: 0.4 });
      for (let x = 8; x < 42; x += 5) p.line(x, 15, x + 2, 20, R.rust[2]);               // 弹簧网
    } }),
    pot: () => ({ w: 18, h: 14, fn: p => {
      p.ell(9, 8, 7, 5, R.gunmetal, { spec: true }); p.box(2, 3, 14, 3, R.gunmetal, { r: 1, v: 0.6 }); p.box(0, 4, 3, 2, R.gunmetal, { v: 0.4 }); p.box(15, 4, 3, 2, R.gunmetal, { v: 0.4 });
      p.rect(4, 4, 10, 1, '#1d212c');
    } }),
    trainmural: () => ({ w: 64, h: 46, fn: p => {
      p.box(0, 4, 60, 40, CONC, { r: 1, v: 0.55 }); p.box(48, 0, 12, 10, CONC, { v: 0.5 }); // 半截墙，缺了一角
      p.box(4, 8, 52, 32, rampOf('#6a675f'), { v: 0.45 });
      const chalk = ['#f4f2ea', '#ffd08a', '#9fd8ff', '#ffb0c0'];
      [[8, 14], [10, 26], [30, 20]].forEach(([x, y], k) => { const c = chalk[k % chalk.length]; // 粉笔画的车：车身、车窗、两个轮子
        p.rect(x, y, 18, 1, c); p.rect(x, y + 6, 18, 1, c); p.rect(x, y, 1, 7, c); p.rect(x + 17, y, 1, 7, c);
        for (let w = 0; w < 3; w++) p.rect(x + 3 + w * 5, y + 2, 3, 2, c);
        p.px(x + 4, y + 8, c); p.px(x + 13, y + 8, c); });
      p.rect(28, 36, 22, 1, '#f4f2ea'); for (let x = 29; x < 50; x += 3) p.px(x, 37, '#f4f2ea'); // 铁轨
      p.px(50, 12, '#ffd08a'); p.px(51, 11, '#ffd08a'); p.px(52, 12, '#ffd08a');           // 一颗星
    } }),
    radsign: () => ({ w: 26, h: 52, fn: p => {
      p.line(12, 50, 14, 22, R.gunmetal[3]); p.line(13, 50, 15, 22, R.gunmetal[2]);       // 歪掉的柱子
      p.box(2, 2, 22, 20, R.yellow, { r: 2, v: 0.7 });
      p.disc(13, 12, 3, '#1d1408'); for (const [dx, dy] of [[0, -6], [-5, 4], [5, 4]]) p.disc(13 + dx, 12 + dy, 2.4, '#1d1408'); // 辐射标志
      p.box(16, 16, 8, 6, R.rust, { v: 0.45 });                                          // 锈掉的一角
    } }),
  });
})(D);
