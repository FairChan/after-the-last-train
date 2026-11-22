/* 末班之后 · 小样二：线路图（像素版，像素化计划第 2 步）
   画回 640×360 的游戏画布上（和以前一样放大显示，像素风），保留试玩反馈二加的东西，全部改成像素画：
   - 站点按杀戮尖塔分七类，每类一个 15×15 的像素徽章（剑、骷髅、宝箱、钱袋、十字、问号、天线；据点是房子）；
   - 撤离站头顶一块像素绿牌"撤离"；出发站一面像素小旗；走过的站打勾变暗；
   - 站名、线名用像素字体（缝合像素字体 12px）。
   底图、线路、列车、窗灯、核心红光、雷达扫描沿用以前那版。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, W = D.W, H = D.H, MW = D.MAP.w, MH = D.MAP.h, CX = MW / 2, CY = MH / 2, TAU = Math.PI * 2;
  const PXF = '12px PixelZH, "Microsoft YaHei UI", sans-serif';
  D.PXF = PXF;

  // ── 站点分类
  D.NODE_CAT = {
    home:     { name: '据点', col: '#4aa8ff', glyph: 'home', desc: '南栈：你的据点' },
    fight:    { name: '普通站', col: '#c9cee0', glyph: 'sword', desc: '有敌人、有容器' },
    elite:    { name: '精英站', col: '#ff4d5e', glyph: 'skull', desc: '精英守关，掉好东西' },
    shop:     { name: '商人', col: '#ffd860', glyph: 'coin', desc: '买卖东西，没有敌人' },
    town:     { name: '人类据点', col: '#ffa05a', glyph: 'fire', desc: '住着人的站：收枪、不限时，换物、修械、诊所，没有敌人' },
    rest:     { name: '休整', col: '#8dff6a', glyph: 'cross', desc: '接电回满耐久、买药，没有敌人' },
    event:    { name: '事件', col: '#c48bff', glyph: 'quest', desc: '到了才知道是什么' },
    treasure: { name: '宝藏', col: '#ffc23d', glyph: 'chest', desc: '高价值区域，守卫最多' },
    relay:    { name: '中继', col: '#3ee8ff', glyph: 'antenna', desc: '修好中继台，看清周围一大片' },
  };
  const CAT_OF = { outpost: 'town', blackmarket: 'shop', refuge: 'rest', event: 'event', depot: 'elite', checkpoint: 'elite', bank: 'treasure', museum: 'treasure', datacenter: 'treasure', cache: 'treasure', reserve: 'treasure', relay: 'relay' };
  D.nodeCat = s => (s.home ? 'home' : CAT_OF[s.type] || 'fight');
  D.valueStars = s => (s.tier | 0) + 1; // 离市中心越近东西越值钱：1–4 颗星

  // ── 像素图标（9×9 的点阵，'#' 主色、'+' 亮色、'.' 透明、'o' 暗色）
  const GLYPH = {
    sword:   ['.......++', '......+#.', '.....+#..', '....+#...', '.o.+#....', '..o#.....', '..oo.....', '.o..o....', 'o........'],
    skull:   ['..#####..', '.#######.', '#########', '#oo###oo#', '#oo###oo#', '.###o###.', '..#####..', '..#.#.#..', '.........'],
    coin:    ['...###...', '..#...#..', '.#######.', '##+#####+', '##+#o###+', '##+##o##+', '##+#####+', '.#######.', '..#####..'],
    cross:   ['...###...', '...#+#...', '...#+#...', '####+####', '#+++++++#', '####+####', '...#+#...', '...#+#...', '...###...'],
    quest:   ['..#####..', '.##+++##.', '.##..+##.', '.....##..', '....##...', '....##...', '.........', '....##...', '....##...'],
    chest:   ['.........', '..#####..', '.#+++++#.', '#########', '#+++o+++#', '####o####', '#+++++++#', '#########', '.........'],
    antenna: ['.#.....#.', '..#...#..', '...#+#...', '....#....', '...###...', '...#.#...', '..#...#..', '.#.....#.', '#.......#'],
    fire:    ['....+....', '...+#....', '...##+...', '..+###+..', '..#+#+#..', '...###...', '+o.....o+', '.oo+.+oo.', '...ooo...'],
    home:    ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#+++++#.', '.#++o++#.', '.#++o++#.', '.#######.'],
    flag:    ['.#.......', '.####....', '.#+++##..', '.#+++++#.', '.####....', '.#.......', '.#.......', '.#.......', '###......'],
    exit:    ['#####....', '#...#....', '#...#.#..', '#...####.', '#...#####', '#...####.', '#...#.#..', '#...#....', '#####....'],
  };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join(''); };
  const sprCache = {};
  // 徽章：15×15 像素圆（黑边、深底、分类色环、中间图标）
  function badge(kind, col, opt) {
    const key = kind + col + JSON.stringify(opt || {}); if (sprCache[key]) return sprCache[key];
    const S = 15, p = D.Paint(S, S), c = 7, ring = opt && opt.ring || col;
    p.disc(c + 0.5, c + 0.5, 7, '#05050a'); p.disc(c + 0.5, c + 0.5, 6, ring); p.disc(c + 0.5, c + 0.5, 5, '#141626');
    p.px(4, 4, shade(ring, 0.4)); p.px(5, 3, shade(ring, 0.4)); // 环的高光
    const g = GLYPH[kind]; if (g) g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') return; p.px(3 + x, 3 + y, ch === '+' ? shade(col, 0.45) : ch === 'o' ? '#141626' : col, opt && opt.glow); }));
    return (sprCache[key] = p.make(1));
  }
  function icon9(kind, col, bg) { const key = 'i' + kind + col + bg; if (sprCache[key]) return sprCache[key]; const p = D.Paint(11, 11); if (bg) p.rect(0, 0, 11, 11, bg); GLYPH[kind].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') p.px(1 + x, 1 + y, ch === '+' ? shade(col, 0.45) : ch === 'o' ? '#141626' : col); })); return (sprCache[key] = p.make(1)); }
  D.mapBadge = badge;
  // 界面里用的图标（像素图，CSS 里按整数倍放大）
  const urlCache = {};
  D.glyphURL = (kind, col) => { const k = kind + col; if (urlCache[k]) return urlCache[k]; const cat = Object.values(D.NODE_CAT).find(c => c.glyph === kind); return (urlCache[k] = badge(kind, col || (cat && cat.col) || '#c9cee0').img.toDataURL()); };
  // 像素字：先画四个方向的黑边再画字（不用 strokeText，免得糊）
  function ptext(ctx, s, x, y, col, align) {
    ctx.font = PXF; ctx.textBaseline = 'top'; ctx.textAlign = align || 'center'; x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#05050a'; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) ctx.fillText(s, x + dx, y + dy);
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  D.ptext = ptext;

  // ── 地区名：按方位把城区分成八块，市中心（危险等级 3）单独一块；名字按种子定，后缀跟着这一块主要的线路主题
  //    用字和站名的字分开（站名用 NAME_A / NAME_B），免得地区名和站名撞
  const DIST_A = ['鹤', '樟', '梅', '桐', '沙', '渡', '泉', '枫', '荷', '苇', '杉', '榕', '芦', '槐', '雁', '兰', '丰', '安', '宁', '鲤', '莲', '竹'];
  const DIST_B = ['岭', '洲', '浦', '岗', '埠', '塘', '原', '津', '汀', '屿', '滩', '营'];
  const DIST_SUF = { industrial: ['工业区', '货场', '厂区'], commercial: ['新区', '商圈', '广场'], oldtown: ['老城', '旧街', '里'], none: ['区', '片区', '新村'], center: ['中心区', '中央城', '金融城'] };
  const distOf = new WeakMap();
  D.cityDistricts = function (C) {
    if (distOf.has(C)) return distOf.get(C);
    const rng = D.rng('dist:' + C.seed), used = new Set(), groups = new Map(), MW = D.cityW(C), MH = D.cityH(C), CX = MW / 2, CY = MH / 2;
    for (const s of C.stations) {
      if (s.dead || s.hidden) continue;
      const ax = (s.x - CX) / (MW / 2), ay = (s.y - CY) / (MH / 2), a = (Math.atan2(ay, ax) + Math.PI / 8 + TAU) % TAU;
      const k = s.tier >= 3 ? 'c' : 's' + Math.floor(a / (Math.PI / 4)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s);
    }
    const out = [];
    for (const [k, ss] of [...groups.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      if (ss.length < 3) continue;
      const th = {}; for (const s of ss) { const t = D.lineThemeOf ? D.lineThemeOf(s) || 'none' : 'none'; th[t] = (th[t] || 0) + 1; }
      const top = Object.keys(th).sort((a, b) => th[b] - th[a])[0], suf = k === 'c' ? DIST_SUF.center : DIST_SUF[top] || DIST_SUF.none;
      let nm = '无名区'; for (let i = 0; i < 60; i++) { const n = rng.pick(DIST_A) + rng.pick(DIST_B); if (!used.has(n[0]) && !used.has(n[1])) { used.add(n[0]); used.add(n[1]); nm = n + rng.pick(suf); break; } }
      const x = ss.reduce((a, s) => a + s.x, 0) / ss.length, y = ss.reduce((a, s) => a + s.y, 0) / ss.length;
      out.push({ key: k, name: nm, x, y: y + (k === 'c' ? 0 : 6), center: k === 'c' });
    }
    distOf.set(C, out); return out;
  };
  // 浅色的地区名：字间空一格，像地图上的地名水印；压在站名下面
  function districtText(ctx, s, x, y) {
    const t = [...s].join(' ');
    ctx.font = PXF; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = 'rgba(5,5,10,0.45)'; ctx.fillText(t, x + 1, y + 1);
    ctx.fillStyle = 'rgba(200,210,236,0.42)'; ctx.fillText(t, x, y);
  }

  // 线路折线长度（列车沿线跑用）
  function lineGeo(L) {
    if (L._geo) return L._geo;
    const pts = L.stops.map(s => ({ x: s.x, y: s.y })); if (L.loop && pts.length > 2) pts.push(pts[0]);
    const seg = []; let len = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); seg.push({ a: pts[i], b: pts[i + 1], s: len, l }); len += l; }
    return (L._geo = { pts, seg, len });
  }
  function along(geo, d) {
    d = ((d % geo.len) + geo.len) % geo.len;
    for (const g of geo.seg) if (d <= g.s + g.l) { const k = (d - g.s) / (g.l || 1); return { x: g.a.x + (g.b.x - g.a.x) * k, y: g.a.y + (g.b.y - g.a.y) * k, a: Math.atan2(g.b.y - g.a.y, g.b.x - g.a.x) }; }
    const g = geo.seg[geo.seg.length - 1]; return { x: g.b.x, y: g.b.y, a: 0 };
  }
  // 背景（街区、窗灯）按种子缓存成一张图
  const bgCache = {};
  // 河的中线：第 4 版的城看 C.water（city.js），老城是写死的那条
  const riverY = (C, x) => C.water ? D.cityWaterY(C, x) : D.cityH(C) * 0.72 + Math.sin(x / 40) * 14 + 8; // 老城：那条河的上沿 + 8 = 中线
  const riverHW = C => C.water ? C.water.hw : 9;
  const hasRiver = C => !!C.water || !C.ver || C.ver < 4;
  // 每座城的底色：岚川蓝、铁原铁锈、白沙灰白、北渡青
  const BG = {
    lanchuan: { base: '#070912', grid: '#3ee8ff10', rings: [['#121527', '#0b0d1a'], ['#171427', '#12121f'], ['#211326', '#1a1120'], ['#36101f', '#24101c']], block: [150, 160, 210] },
    tieyuan: { base: '#0b0908', grid: '#ffb05714', rings: [['#1a1612', '#100d0b'], ['#221a12', '#16110d'], ['#2c1c10', '#1d130c'], ['#3d1c0c', '#2a130a']], block: [200, 160, 120] },
    baisha: { base: '#0a0b0b', grid: '#b8ff9a0e', rings: [['#151717', '#0e1010'], ['#1b1d1c', '#131515'], ['#232522', '#191b19'], ['#2e302a', '#20221e']], block: [170, 175, 165] },
    beidu: { base: '#060a10', grid: '#7fd8ff12', rings: [['#0f1822', '#0a1018'], ['#13202a', '#0d161e'], ['#192a30', '#111e24'], ['#24323a', '#18242a']], block: [140, 190, 210] },
  };
  function cityBg(C) {
    const key = C.seed + ':' + (C.ver || 1); if (bgCache[key]) return bgCache[key];
    const MW = D.cityW(C), MH = D.cityH(C), K = C.core || { x: MW / 2, y: MH / 2 }, ck = (C.ver || 1) >= 4 ? C.key || 'lanchuan' : 'lanchuan', T = BG[ck] || BG.lanchuan, sc = MW / 600;
    const S = 3, [c, x] = D.canvas(MW * S, MH * S), br = D.rng('blocks:' + C.seed);
    x.scale(S, S);
    x.fillStyle = T.base; x.fillRect(0, 0, MW, MH);
    // 城区：围着核心的同心椭圆，越往里颜色越重
    for (let t = 3; t >= 0; t--) { const r = [240, 175, 115, 55][t] * sc, g = x.createRadialGradient(K.x, K.y, r * 0.2, K.x, K.y, r * 1.35); g.addColorStop(0, T.rings[t][0]); g.addColorStop(1, T.rings[t][1]); x.fillStyle = g; x.beginPath(); x.ellipse(K.x, K.y, r * 1.35, r * 0.8 * (MH / 360) / sc, 0, 0, Math.PI * 2); x.fill(); }
    // 蓝图网格
    x.lineWidth = 0.25; x.strokeStyle = '#ffffff08';
    for (let gx = 0; gx <= MW; gx += 10) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, MH); x.stroke(); }
    for (let gy = 0; gy <= MH; gy += 10) { x.beginPath(); x.moveTo(0, gy); x.lineTo(MW, gy); x.stroke(); }
    x.strokeStyle = T.grid; x.lineWidth = 0.4;
    for (let gx = 0; gx <= MW; gx += 50) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, MH); x.stroke(); }
    for (let gy = 0; gy <= MH; gy += 50) { x.beginPath(); x.moveTo(0, gy); x.lineTo(MW, gy); x.stroke(); }
    // 铁原：一束束编组场的铁轨（细的平行线），几块大厂房
    if (ck === 'tieyuan') {
      for (let b = 0; b < 7; b++) { const y0 = br.int(20, MH - 40), x0 = br.int(0, MW * 0.6), w = br.int(120, 320); x.strokeStyle = 'rgba(255,190,120,0.07)'; x.lineWidth = 0.4; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(x0, y0 + k * 3); x.lineTo(x0 + w, y0 + k * 3); x.stroke(); } }
      for (let i = 0; i < 26; i++) { const bx = br.int(0, MW / 6) * 6, by = br.int(0, MH / 6) * 6, w = br.int(4, 8) * 6, h = br.int(2, 4) * 6; x.fillStyle = 'rgba(200,150,100,0.05)'; x.fillRect(bx, by, w, h); x.fillStyle = 'rgba(255,200,140,0.05)'; x.fillRect(bx, by, w, 0.5); }
    }
    // 白沙：东边的大坑——发黑的坑底、发白的灼痕圈、往外放射的裂纹
    if (C.crater) {
      const Kc = C.crater, g = x.createRadialGradient(Kc.x, Kc.y, 2, Kc.x, Kc.y, Kc.r * 1.6);
      g.addColorStop(0, '#050605'); g.addColorStop(0.55, '#0c0d0c'); g.addColorStop(0.62, '#3a3b36'); g.addColorStop(0.7, '#1c1e1c'); g.addColorStop(1, 'rgba(20,22,20,0)');
      x.fillStyle = g; x.beginPath(); x.arc(Kc.x, Kc.y, Kc.r * 1.6, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(200,205,190,0.14)'; x.lineWidth = 0.5;
      for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2 + br() * 0.2, r0 = Kc.r * 1.05, r1 = Kc.r * (1.4 + br() * 0.9); x.beginPath(); x.moveTo(Kc.x + Math.cos(a) * r0, Kc.y + Math.sin(a) * r0); x.lineTo(Kc.x + Math.cos(a + 0.05) * r1, Kc.y + Math.sin(a + 0.05) * r1); x.stroke(); }
      x.strokeStyle = 'rgba(184,255,154,0.12)'; x.lineWidth = 0.6; x.beginPath(); x.arc(Kc.x, Kc.y, Kc.r * 0.35, 0, Math.PI * 2); x.stroke();
    }
    // 街区：一块块楼，越靠近核心越亮；河里、坑里不盖
    const blocks = [], nb = Math.round(520 * (MW * MH) / (600 * 360) * (ck === 'baisha' ? 0.6 : 1)), R = riverHW(C) + 9;
    for (let i = 0; i < nb; i++) {
      const bx = br.int(0, MW / 6) * 6, by = br.int(0, MH / 6) * 6, d = Math.hypot((bx - K.x) / 1.35, (by - K.y) / 0.8) / sc;
      if (hasRiver(C) && Math.abs(by - riverY(C, bx)) < R) continue; // 河上不盖楼
      if (C.crater && Math.hypot(bx - C.crater.x, by - C.crater.y) < C.crater.r * 1.25) continue;
      const w = br.int(1, 3) * 6 - 1.5, h = br.int(1, 2) * 6 - 1.5, lum = D.clamp(1 - d / 260, 0.1, 1), [r, g2, b] = T.block;
      x.fillStyle = `rgba(${r + 60 * (1 - lum) | 0},${g2},${b},${0.025 + 0.05 * lum})`; x.fillRect(bx + 0.75, by + 0.75, w, h);
      x.fillStyle = `rgba(255,255,255,${0.02 + 0.03 * lum})`; x.fillRect(bx + 0.75, by + 0.75, w, 0.4);
      if (br.chance(ck === 'baisha' ? 0.12 : 0.35)) blocks.push({ x: bx + 1 + br() * (w - 2), y: by + 1 + br() * (h - 2), p: br() * 10, s: 0.5 + br() * 2, warm: br.chance(ck === 'tieyuan' ? 0.85 : 0.6) });
    }
    // 河岸（北渡的河宽，伸出去几座栈桥）
    if (hasRiver(C)) {
      const hw = riverHW(C);
      x.fillStyle = ck === 'beidu' ? '#0b1a24' : '#0c1628'; for (let xx = 0; xx < MW; xx += 0.5) x.fillRect(xx, riverY(C, xx) - hw - 1, 0.5, hw * 2 + 2);
      x.fillStyle = ck === 'beidu' ? '#10303e' : '#132447'; for (let xx = 0; xx < MW; xx += 0.5) x.fillRect(xx, riverY(C, xx) - hw + 1, 0.5, hw * 2 - 2);
      if (ck === 'beidu') for (let k = 0; k < 18; k++) { const px = br.int(20, MW - 20), side = br.chance(0.5) ? -1 : 1, y0 = riverY(C, px) + side * hw; x.fillStyle = 'rgba(160,190,200,0.16)'; x.fillRect(px, side < 0 ? y0 : y0 - 10, 3, 10); }
    }
    return (bgCache[key] = { c, blocks, S });
  }
  // 沦陷核心飘出来的火星（只跟时间有关，不占状态）
  const EMBERS = Array.from({ length: 40 }, (_, i) => { const r = D.rng('ember' + i); return { a: r() * Math.PI * 2, d: r() * 50, sp: 4 + r() * 8, ph: r() * 20, life: 6 + r() * 6 }; });

  D.drawMap = function (ctx, C, view, time, opt) {
    opt = opt || {};
    const ex = D.Post.ex, z = view.z || 1, cx = view.x, cy = view.y;
    const LT = (x, y, r, col, a) => D.Post.addLight((x - cx) * z, (y - cy) * z, r * z, col, a);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z); ex.setTransform(z, 0, 0, z, -cx * z, -cy * z);
    const px = 1 / z; // 一个屏幕像素
    const bg = cityBg(C), MW = D.cityW(C), MH = D.cityH(C), CX = C.core ? C.core.x : MW / 2, CY = C.core ? C.core.y : MH / 2;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(bg.c, 0, 0, MW, MH); ctx.imageSmoothingEnabled = false;
    // 窗灯：一闪一闪
    for (const b of bg.blocks) { const k = 0.5 + 0.5 * Math.sin(time * b.s + b.p); if (k < 0.25) continue; ex.fillStyle = b.warm ? `rgba(255,190,110,${0.25 * k})` : `rgba(120,200,255,${0.2 * k})`; ex.fillRect(b.x, b.y, 0.6, 0.6); }
    // 河：流动的波光
    if (hasRiver(C)) for (let x = 0; x < MW; x += 3) { const y = riverY(C, x) - riverHW(C) + 3, w = Math.sin(x * 0.13 - time * 1.6) ; if (w > 0.6) { ex.fillStyle = `rgba(110,170,255,${(w - 0.6) * 0.5})`; ex.fillRect(x, y + 3 + ((x * 7) % 11), 2, 0.4); } }
    // 沦陷核心：脉动的红光和往外飘的火星
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.3);
    LT(CX, CY, 90 + pulse * 25, '#ff2a40', 0.35 + pulse * 0.2);
    for (const e of EMBERS) { const t = ((time + e.ph) % e.life) / e.life, d = e.d + t * e.sp * 8, x = CX + Math.cos(e.a) * d * 1.35, y = CY + Math.sin(e.a) * d * 0.8 - t * 10; ex.fillStyle = `rgba(255,${90 + 80 * (1 - t)},60,${(1 - t) * 0.7})`; ex.fillRect(x, y, 0.8, 0.8); }
    // 雷达扫描：从据点转出去的一道扇形
    const home = C.stations[C.home];
    if (home) {
      const a = (time * 0.6) % (Math.PI * 2), R2 = 260;
      const g = ex.createRadialGradient(home.x, home.y, 0, home.x, home.y, R2); g.addColorStop(0, 'rgba(80,170,255,0.10)'); g.addColorStop(1, 'rgba(80,170,255,0)');
      ex.fillStyle = g; ex.beginPath(); ex.moveTo(home.x, home.y); ex.arc(home.x, home.y, R2, a - 0.5, a); ex.closePath(); ex.fill();
      ex.strokeStyle = 'rgba(120,200,255,0.25)'; ex.lineWidth = px; ex.beginPath(); ex.moveTo(home.x, home.y); ex.lineTo(home.x + Math.cos(a) * R2, home.y + Math.sin(a) * R2); ex.stroke();
    }
    // 线路：黑底 + 色线 + 流动的光
    const cur = opt.at != null ? C.stations[opt.at] : null;
    for (const L of C.lines) {
      const geo = lineGeo(L), pts = geo.pts;
      const path = c => { c.beginPath(); pts.forEach((s, i) => i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y)); };
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#03030a'; ctx.lineWidth = 4.8; path(ctx); ctx.stroke();
      ctx.globalAlpha = 0.75; ctx.strokeStyle = L.col; ctx.lineWidth = 3; path(ctx); ctx.stroke();
      ctx.globalAlpha = 0.2; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; path(ctx); ctx.stroke(); ctx.globalAlpha = 1;
      ex.globalAlpha = 0.22; ex.strokeStyle = L.col; ex.lineWidth = 1.4; path(ex); ex.stroke();
      ex.globalAlpha = 0.55; ex.setLineDash([2, 10]); ex.lineDashOffset = -time * 14 * (L.id % 2 ? 1 : -1); ex.lineWidth = 0.9; path(ex); ex.stroke(); ex.setLineDash([]); ex.globalAlpha = 1;
      // 列车：每条线两三列，沿线来回跑
      const nT = L.loop ? 3 : 2;
      for (let k = 0; k < nT; k++) {
        const sp = 16 + (L.id % 3) * 3, off = k * geo.len / nT + L.id * 37;
        let d = time * sp + off;
        if (!L.loop) { const m = d % (geo.len * 2); d = m < geo.len ? m : geo.len * 2 - m; }
        const q = along(geo, d), q2 = along(geo, d - 5);
        ctx.strokeStyle = '#03030a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q2.x, q2.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.strokeStyle = '#e8ecf8'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(q2.x, q2.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ex.fillStyle = L.col; ex.fillRect(q.x - 0.7, q.y - 0.7, 1.4, 1.4); ex.fillStyle = '#ffffff'; ex.fillRect(q.x - 0.35, q.y - 0.35, 0.7, 0.7);
        LT(q.x, q.y, 12, L.col, 0.5);
      }
    }
    // 废弃支线（通往隐藏站）：断断续续的紫线
    for (const s of C.stations) if (s.hidden && D.cityVisible(C, s)) for (const bi of s.adj) { const b = C.stations[bi]; if (!D.cityVisible(C, b)) continue; ctx.strokeStyle = '#6a5f90'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]); ctx.lineDashOffset = -time * 4; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.setLineDash([]); } // 隐藏支线两头都接着线路
    // 能走的下一站：从当前站流出去的虚线；悬停的那条更亮
    if (cur && opt.reach) for (const n of opt.reach) { const s = C.stations[n]; if (!D.cityVisible(C, s)) continue; const hv = opt.hover === n; ex.strokeStyle = D.rgba(D.UIC.hi, hv ? 0.95 : 0.55 + 0.25 * Math.sin(time * 6)); ex.lineWidth = hv ? 2 : 1.3; ex.setLineDash([3, 3]); ex.lineDashOffset = -time * 18; ex.beginPath(); ex.moveTo(cur.x, cur.y); ex.lineTo(s.x, s.y); ex.stroke(); ex.setLineDash([]); }
    // ── 站：像素徽章（屏幕坐标，大小不随缩放变）
    const SX = x => Math.round((x - cx) * z), SY = y => Math.round((y - cy) * z);
    const labels = [], visited = opt.visited || null;
    // 分两遍画：第一遍（光照之前）只画光晕和发光圈；第二遍（光照之后）画徽章、牌子、小旗，不被光照压暗
    const NOOP = new Proxy({}, { get: () => () => {}, set: () => true });
    const stationsPass = pass => {
      const c = pass ? ctx : NOOP, e = pass ? NOOP : ex, lt = pass ? () => {} : LT;
      if (pass) ctx.setTransform(1, 0, 0, 1, 0, 0);
      const starts = opt.choosing && D.startPoints ? D.startPoints(C) : null; // 能出发的站（据点旁边 + 解锁过的线路尽头）
      for (const s of C.stations) {
        if (!D.cityVisible(C, s)) continue;
        const k = C.known.get(s.id), X = SX(s.x), Y = SY(s.y); if (X < -30 || Y < -30 || X > W + 30 || Y > H + 30) continue;
        const hov = opt.hover === s.id, reach = opt.reach && opt.reach.includes(s.id), sel = opt.sel === s.id, entry = opt.choosing && (C.entries.has(s.id) || (starts && starts.includes(s.id)));
        const done = visited && visited.has(s.id) && s.id !== opt.at, dim = (opt.choosing && !entry && !s.home) || done;
        c.globalAlpha = dim ? 0.5 : 1;
        if (s.hidden && k === 0) { const b = badge('quest', '#d8c4ff', { ring: '#7a5ab0' }); const gx = (Math.sin(time * 17 + s.id) > 0.92) ? 1 : 0; c.drawImage(b.img, X - 7 + gx, Y - 7); lt(s.x, s.y, 18, '#9b6bff', 0.4 + 0.2 * Math.sin(time * 3)); }
        else if (k === 0) { c.fillStyle = '#05050a'; c.fillRect(X - 3, Y - 3, 6, 6); c.fillStyle = '#4a4f68'; c.fillRect(X - 2, Y - 2, 4, 4); c.fillStyle = '#6a7090'; c.fillRect(X - 2, Y - 2, 2, 1); }
        else {
          const cat = D.NODE_CAT[D.nodeCat(s)], b = badge(cat.glyph, cat.col);
          if (s.lines.length > 1) { c.fillStyle = '#f2f4ff'; c.fillRect(X - 9, Y - 1, 1, 2); c.fillRect(X + 8, Y - 1, 1, 2); c.fillRect(X - 1, Y - 9, 2, 1); c.fillRect(X - 1, Y + 8, 2, 1); } // 换乘站：四个白刻度
          c.drawImage(b.img, X - 7, Y - 7 + (hov ? -1 : 0));
          if (k === 2 && !s.home && !done) { e.setTransform(1, 0, 0, 1, 0, 0); e.strokeStyle = D.rgba('#f2f4ff', 0.35); e.lineWidth = 1; e.beginPath(); e.arc(X, Y, 10, time + s.id, time + s.id + 4); e.stroke(); }
          if (HV_TYPES[s.type]) lt(s.x, s.y, 22, '#ffc23d', 0.3 + 0.2 * Math.sin(time * 3 + s.id));
          if (done) { c.globalAlpha = 1; const ck = icon9('cross', '#8dff6a'); c.fillStyle = '#05050a'; c.fillRect(X + 3, Y + 3, 7, 6); c.fillStyle = '#8dff6a'; c.fillRect(X + 4, Y + 6, 1, 1); c.fillRect(X + 5, Y + 7, 1, 1); c.fillRect(X + 6, Y + 6, 1, 1); c.fillRect(X + 7, Y + 5, 1, 1); c.fillRect(X + 8, Y + 4, 1, 1); void ck; }
        }
        c.globalAlpha = 1;
        // 撤离站：头顶一块像素绿牌
        if (D.knownExit(C, s)) {
          const hid = s.exit === 'hidden' && !s.reserve, bw = 33, bh = 15, bx = X - 16, by = Y - 26, t = (time * 0.8 + s.id * 0.3) % 1;
          e.setTransform(1, 0, 0, 1, 0, 0); e.strokeStyle = D.rgba(P.g, (1 - t) * 0.6); e.lineWidth = 1; e.beginPath(); e.arc(X, Y, 8 + t * 12, 0, TAU); e.stroke();
          c.fillStyle = '#05050a'; c.fillRect(bx - 1, by - 1, bw + 2, bh + 2); c.fillRect(X - 1, by + bh, 2, 4);
          c.fillStyle = hid ? '#2a9a6a' : '#1e8a3a'; c.fillRect(bx, by, bw, bh); c.fillStyle = hid ? '#5be0a0' : '#3dd66a'; c.fillRect(bx, by, bw, bh - 1); c.fillStyle = '#9af0b0'; c.fillRect(bx, by, bw, 1);
          c.font = PXF; c.textBaseline = 'top'; c.textAlign = 'center'; c.fillStyle = '#05200f'; c.fillText(hid ? '隐藏' : '撤离', X, by + 1);
          lt(s.x, s.y - 14 / z, 20, P.g, 0.45);
        }
        // 出发站：橙色像素小旗 + 一圈圈往外的光
        if (entry) { const t = (time * 0.7) % 1; e.setTransform(1, 0, 0, 1, 0, 0); e.strokeStyle = D.rgba(D.UIC.a, (1 - t) * 0.8); e.lineWidth = 1; e.beginPath(); e.arc(X, Y, 9 + t * 12, 0, TAU); e.stroke(); if (!D.knownExit(C, s)) c.drawImage(icon9('flag', '#ff9a4a').img, X + 6, Y - 15); }
        if (reach) { e.setTransform(1, 0, 0, 1, 0, 0); e.strokeStyle = D.rgba(D.UIC.hi, 0.6 + 0.4 * Math.sin(time * 6)); e.lineWidth = 1; e.strokeRect(X - 10.5, Y - 10.5, 21, 21); lt(s.x, s.y, 20, D.UIC.hi, 0.4); }
        if (hov) { c.fillStyle = D.UIC.hi; for (const [a, b2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.fillRect(X + a * 11 - (a > 0 ? 2 : 0), Y + b2 * 11 - (b2 > 0 ? 0 : 0), 3, 1); c.fillRect(X + a * 11 - (a > 0 ? 0 : 0), Y + b2 * 11 - (b2 > 0 ? 2 : 0), 1, 3); } }
        if (sel) { const t = (time * 1.2) % 1; e.setTransform(1, 0, 0, 1, 0, 0); e.strokeStyle = D.UIC.a; e.lineWidth = 1; e.strokeRect(X - 11.5, Y - 11.5, 23, 23); e.strokeStyle = D.rgba(D.UIC.a, 1 - t); e.strokeRect(X - 11.5 - t * 8, Y - 11.5 - t * 8, 23 + t * 16, 23 + t * 16); }
        if (k >= 1 && (z >= 2 || hov || reach || sel || entry || s.home || s.id === opt.at)) if (pass) labels.push({ s, X, Y: Y + 10, hi: hov || sel || reach || s.id === opt.at });
      }
    };
    stationsPass(0);
    ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z); ex.setTransform(z, 0, 0, z, -cx * z, -cy * z);
    // 主线标记：读到线索的站（金色小纸片），储备库在结局后常亮
    if (opt.marks) for (const id of opt.marks) { const s = C.stations[id]; if (!s || !D.cityVisible(C, s)) continue; ctx.setTransform(1, 0, 0, 1, 0, 0); const X = SX(s.x) - 13, Y = SY(s.y) - 9; ctx.fillStyle = '#05050a'; ctx.fillRect(X - 1, Y - 1, 6, 8); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(X, Y, 4, 6); ctx.fillStyle = '#c82e3a'; ctx.fillRect(X + 1, Y + 3, 2, 2); ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z); }
    if (C.reserve != null && D.cityVisible(C, C.stations[C.reserve])) { const s = C.stations[C.reserve], t = (time * 0.5) % 1; ex.strokeStyle = D.rgba('#ffd860', (1 - t) * 0.7); ex.lineWidth = 1.5 / z; ex.beginPath(); ex.arc(s.x, s.y, 6 + t * 16, 0, TAU); ex.stroke(); LT(s.x, s.y, 28, '#ffd860', 0.5); }
    // 当前位置：工壳的头 + 向外扩散的声呐
    if (cur) {
      for (let i = 0; i < 3; i++) { const t = (time * 0.6 + i / 3) % 1; ex.strokeStyle = D.rgba(D.UIC.a, (1 - t) * 0.7); ex.lineWidth = px * 1.5; ex.beginPath(); ex.arc(cur.x, cur.y, 4 + t * 26, 0, Math.PI * 2); ex.stroke(); }
      D.blit(ctx, D.SPR.head, cur.x, cur.y + 3 + Math.sin(time * 3), false); D.blit(ex, D.SPR.head, cur.x, cur.y + 3 + Math.sin(time * 3), false, 'emit'); LT(cur.x, cur.y, 46, D.UIC.a2, 0.8);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ex.setTransform(1, 0, 0, 1, 0, 0);
    D.Post.render(ctx, '#5a5a80');
    stationsPass(1);
    // ── 文字（光照之后画，清楚）：地区名（浅色，最底下）、站名、线名（像素字体）
    for (const d of D.cityDistricts(C)) { const X = SX(d.x), Y = SY(d.y); if (X > -60 && X < W + 60 && Y > -10 && Y < H + 10) districtText(ctx, d.name, X, Y); }
    for (const Lb of labels) ptext(ctx, Lb.s.name, Lb.X, Lb.Y, Lb.hi ? '#e6f7ff' : Lb.s.hidden ? '#d0b8ff' : HV_TYPES[Lb.s.type] ? '#ffd860' : '#c8cde0');
    for (const Ln of C.lines) {
      const e = Ln.stops[0], e2 = Ln.stops[1]; if (!e || !e2) continue;
      const a = Math.atan2(e.y - e2.y, e.x - e2.x), X = SX(e.x) + (Ln.loop ? 0 : (Math.cos(a) >= 0 ? 1 : -1) * 34), Y = SY(e.y) - (Ln.loop ? 22 : 6);
      if (X < -40 || X > W + 40 || Y < -10 || Y > H + 10) continue;
      ctx.font = PXF; const tw = Math.ceil(ctx.measureText(Ln.name).width) + 6, x0 = Math.round(X - tw / 2);
      ctx.fillStyle = '#05050a'; ctx.fillRect(x0 - 1, Y - 1, tw + 2, 15); ctx.fillStyle = Ln.col; ctx.fillRect(x0, Y, tw, 13); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0, Y, tw, 1);
      ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillStyle = '#05050a'; ctx.fillText(Ln.name, Math.round(X), Y + 1);
    }
    // 屏幕效果：扫描线、四角取景框、标题和时钟
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = (time * 20 | 0) % 3; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    const sl = (time * 40) % (H + 60) - 30; const g2 = ctx.createLinearGradient(0, sl - 20, 0, sl + 20); g2.addColorStop(0, 'rgba(120,200,255,0)'); g2.addColorStop(0.5, 'rgba(120,200,255,0.05)'); g2.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = g2; ctx.fillRect(0, sl - 20, W, 40);
    ctx.fillStyle = '#3ee8ff70'; const cn = 14;
    for (const [bx, by, dx, dy] of [[6, 30, 1, 1], [W - 6, 30, -1, 1], [6, H - 6, 1, -1], [W - 6, H - 6, -1, -1]]) { ctx.fillRect(Math.min(bx, bx + dx * cn), by, cn, 1); ctx.fillRect(bx, Math.min(by, by + dy * cn), 1, cn); }
    ctx.font = PXF; ctx.textAlign = 'left'; ctx.fillStyle = '#3ee8ffa0';
    const hh = (22 + (time / 60 | 0)) % 24, mm = (time | 0) % 60;
    if (opt.header) ctx.fillText((D.cityTitle ? D.cityTitle(C) : '岚川地铁网') + ' ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ((time * 2 | 0) % 2 ? ' ●' : ''), 12, H - 64);
    // 缩放提示
    if (opt.header) ctx.font = PXF, ctx.fillStyle = '#8a90b0', ctx.fillText('滚轮缩放 ×' + z.toFixed(1), 12, H - 49);
    if (opt.dim) { ctx.fillStyle = `rgba(6,5,12,${opt.dim})`; ctx.fillRect(0, 0, W, H); }
  };
  const HV_TYPES = { bank: 1, datacenter: 1, museum: 1, cache: 1, reserve: 1 };
  // 点中哪个站：徽章 15 像素（不随缩放变）
  D.cityHit = function (C, view, mx, my) {
    const z = view.z || 1; let best = null, bd = 10 / z; const x = mx / z + view.x, y = my / z + view.y;
    for (const s of C.stations) { if (!D.cityVisible(C, s)) continue; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
    return best;
  };
})(D);
