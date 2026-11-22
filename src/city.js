/* 末班之后 · 小样二：城市地铁网
   一座城由种子生成：8 条放射/穿城线 + 1 条环线，八十来个站，靠近市中心越危险。
   站点类型和区域无关：全城打散，相邻两站不重样，安全站、高价值站、精英站这些特殊站彼此隔开（像杀戮尖塔的地图节点）。
   线路形状一开始全部看得见；站里是什么要走过、买情报或从邻站打听才知道。
   撤离（试玩反馈二）：只在线路尽头（每条线的两头）撤，撤出过的尽头站以后能当出发站；
   另有极少的隐藏撤离点，地图上看不到，要走到它旁边那站才会发现。中间的站不能撤。
   城市版本（C.ver）：1 = 原来的城；2（2026-11-15 起新开的档）= 每个线路交点都是换乘站、多一条内环线，
   沿线的普通战斗站最多连着两个（interleave）；3（2026-11-17）= 隐藏撤离点（含储备库）两两至少隔 200。
   4（2026-11-19，用户："每一个地图都请你重新设计，将每一个地图做的更大，更有特色"）= 每座城自己的大小和线网（D.CITY_SHAPES）：
     岚川放射 + 双环、一条河；铁原横平竖直的铁路网格 + 斜穿的军用干线 + 围着总装厂的货运环线；
     白沙东边一个大弹坑，线路绕着坑沿走，坑沿一圈环线，西边老城一个小环；北渡一条宽河横穿全城，两岸各两条沿河线，三座桥线 + 一条斜穿的渡线。
     危险等级按到这座城"核心"（C.core）的远近；河里、坑里不放站（C.blocked）。
   老存档按存下的版本重建，站的编号不变。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, W = D.W, H = D.H;
  // 第 1–3 版的城都是 600×360；第 4 版每座城自己的大小（生成时临时改这几个值，生成完改回来）
  let MW = 600, MH = 360, CX = MW / 2, CY = MH / 2;
  D.MAP = { w: 600, h: 360 }; // 老城的大小；新城看 C.w / C.h（D.cityW / D.cityH）
  D.CITY_VER = 4;
  D.cityW = C => (C && C.w) || 600; D.cityH = C => (C && C.h) || 360;
  // 第 4 版：每座城的大小、核心（最值钱、最危险的地方）、水和坑
  const SHAPES = D.CITY_SHAPES = {
    lanchuan: { w: 960, h: 576, core: [0.5, 0.5], water: { y: 0.72, amp: 0.039, per: 64, hw: 0.026 } },
    tieyuan: { w: 1056, h: 576, core: [0.56, 0.46] },
    baisha: { w: 1000, h: 600, core: [0.72, 0.52], crater: { x: 0.72, y: 0.52, r: 0.15 } },
    beidu: { w: 1120, h: 576, core: [0.5, 0.5], tierY: 0.5, water: { y: 0.5, amp: 0.05, per: 90, hw: 0.06 } }, // tierY：隔着河的上下距离打对折（两岸靠港口的地方才是核心）
  };
  // 河的中线（第 4 版的城；老城那条河写死在 map.js）
  D.cityWaterY = (C, x) => { const w = C && C.water; return w ? w.y + Math.sin(x / w.per) * w.amp : null; };
  // 第 3 版：隐藏撤离点（含储备库）两两至少隔这么远（地图像素）。第 1、2 版老城不动
  const HIDDEN_GAP = 200;

  D.makeCity = function (seed, ver, key) {
    ver = ver || D.CITY_VER;
    key = key || ((String(seed).match(/:(tieyuan|baisha|beidu)$/) || [])[1]) || 'lanchuan';
    const SH = ver >= 4 ? SHAPES[key] || SHAPES.lanchuan : null;
    MW = SH ? SH.w : 600; MH = SH ? SH.h : 360; CX = MW / 2; CY = MH / 2;
    try { return makeCity0(seed, ver, key, SH); } finally { MW = 600; MH = 360; CX = 300; CY = 180; }
  };
  function makeCity0(seed, ver, key, SH) {
    const rng = D.rng('city:' + seed);
    const C = { seed, ver, stations: [], lines: [], w: MW, h: MH };
    if (SH) {
      C.core = { x: SH.core[0] * MW, y: SH.core[1] * MH };
      if (SH.water) C.water = { y: SH.water.y * MH, amp: SH.water.amp * MH, per: SH.water.per, hw: SH.water.hw * MH };
      if (SH.crater) C.crater = { x: SH.crater.x * MW, y: SH.crater.y * MH, r: SH.crater.r * MW };
    }
    // 河里、坑里不放站
    C.blocked = (x, y) => { if (C.water && Math.abs(y - D.cityWaterY(C, x)) < C.water.hw + 6) return true; if (C.crater && Math.hypot(x - C.crater.x, y - C.crater.y) < C.crater.r + 6) return true; return false; };
    const nameUsed = new Set();
    const newName = () => { for (let i = 0; i < 50; i++) { const n = rng.pick(D.NAME_A) + rng.pick(D.NAME_B) + rng.pick(D.NAME_C); if (!nameUsed.has(n)) { nameUsed.add(n); return n; } } return '无名站'; };
    const near = (x, y, d) => { let best = null, bd = d; for (const s of C.stations) { const e = Math.hypot(s.x - x, s.y - y); if (e < bd) { bd = e; best = s; } } return best; };
    const addStation = (x, y) => { const s = { id: C.stations.length, x: Math.round(x), y: Math.round(y), lines: [], adj: new Set(), name: newName() }; C.stations.push(s); return s; };

    // 八向折线：先斜后直或先直后斜
    function route(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.min(Math.abs(dx), Math.abs(dy));
      const diag = { x: a.x + Math.sign(dx) * d, y: a.y + Math.sign(dy) * d };
      const straight = { x: b.x - Math.sign(dx) * d, y: b.y - Math.sign(dy) * d };
      return [a, rng.chance(0.5) ? diag : straight, b];
    }
    function buildLine(pts, li, loop) {
      let poly = [];
      for (let i = 0; i < pts.length - 1; i++) { const seg = route(pts[i], pts[i + 1]); poly = poly.concat(i ? seg.slice(1) : seg); }
      if (loop) poly.push(poly[0]);
      // 沿折线每隔一段放一个站，附近已有站就并成换乘站
      const line = { id: li, name: D.LINE_NAMES[li], col: D.LINE_COLORS[li], stops: [], loop: !!loop };
      let acc = 999, gap = rng.range(30, 40);
      for (let i = 0; i < poly.length - 1; i++) {
        const a = poly[i], b = poly[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
        for (let t = 0; t < L; t += 2) {
          acc += 2;
          if (acc < gap) continue;
          const x = a.x + (b.x - a.x) * t / L, y = a.y + (b.y - a.y) * t / L;
          if (x < 16 || y < 16 || x > MW - 16 || y > MH - 16) continue;
          let s = near(x, y, 13);
          if (!s) s = addStation(x, y);
          if (line.stops[line.stops.length - 1] !== s && !line.stops.includes(s)) { line.stops.push(s); if (!s.lines.includes(li)) s.lines.push(li); }
          acc = 0; gap = rng.range(28, 40);
        }
      }
      for (let i = 0; i < line.stops.length - 1; i++) { line.stops[i].adj.add(line.stops[i + 1].id); line.stops[i + 1].adj.add(line.stops[i].id); }
      if (loop && line.stops.length > 2) { const a = line.stops[0], b = line.stops[line.stops.length - 1]; a.adj.add(b.id); b.adj.add(a.id); }
      C.lines.push(line);
    }
    if (ver >= 4) buildV4(); else if (ver >= 2) buildV2(); else {
    // 环线
    const R = 100, ring = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; ring.push({ x: CX + Math.cos(a) * R * 1.35, y: CY + Math.sin(a) * R * 0.8 }); }
    buildLine(ring, 8, true);
    // 穿城线
    for (let li = 0; li < 8; li++) {
      const th = (li / 8) * Math.PI + rng.range(-0.18, 0.18), ex = Math.cos(th), ey = Math.sin(th), off = rng.range(-40, 40);
      const px = -ey * off, py = ex * off;
      const A = { x: CX + ex * 300 + px, y: CY + ey * 185 + py }, B = { x: CX - ex * 300 + px, y: CY - ey * 185 + py };
      const M1 = { x: D.lerp(A.x, B.x, 0.33) + rng.range(-35, 35), y: D.lerp(A.y, B.y, 0.33) + rng.range(-25, 25) };
      const M2 = { x: D.lerp(A.x, B.x, 0.66) + rng.range(-35, 35), y: D.lerp(A.y, B.y, 0.66) + rng.range(-25, 25) };
      const clampP = p => ({ x: D.clamp(p.x, 18, MW - 18), y: D.clamp(p.y, 18, MH - 18) });
      buildLine([A, M1, M2, B].map(clampP), li, false);
    }
    }
    // ── 第 2 版：先把所有线路的折线定下来，算出两两的交点，交点一律放换乘站；再加一条内环线
    function buildV2() {
      const polyOf = (pts, loop) => { let poly = []; for (let i = 0; i < pts.length - 1; i++) { const seg = route(pts[i], pts[i + 1]); poly = poly.concat(i ? seg.slice(1) : seg); } if (loop) poly.push(poly[0]); return poly; };
      const clampP = p => ({ x: D.clamp(p.x, 18, MW - 18), y: D.clamp(p.y, 18, MH - 18) });
      const specs = [], R = 100, ring = [], inner = [];
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; ring.push({ x: CX + Math.cos(a) * R * 1.35, y: CY + Math.sin(a) * R * 0.8 }); }
      specs.push({ li: 8, poly: polyOf(ring, true), loop: true });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + rng.range(-0.15, 0.15); inner.push({ x: CX + Math.cos(a) * 60 * 1.35, y: CY + Math.sin(a) * 60 * 0.8 }); }
      specs.push({ li: 9, poly: polyOf(inner, true), loop: true });
      for (let li = 0; li < 8; li++) {
        const th = (li / 8) * Math.PI + rng.range(-0.18, 0.18), ex = Math.cos(th), ey = Math.sin(th), off = rng.range(-40, 40), px = -ey * off, py = ex * off;
        const A = { x: CX + ex * 300 + px, y: CY + ey * 185 + py }, B = { x: CX - ex * 300 + px, y: CY - ey * 185 + py };
        const M1 = { x: D.lerp(A.x, B.x, 0.33) + rng.range(-35, 35), y: D.lerp(A.y, B.y, 0.33) + rng.range(-25, 25) };
        const M2 = { x: D.lerp(A.x, B.x, 0.66) + rng.range(-35, 35), y: D.lerp(A.y, B.y, 0.66) + rng.range(-25, 25) };
        specs.push({ li, poly: polyOf([A, M1, M2, B].map(clampP), false), loop: false });
      }
      // 两两求交点；靠得近的交点并成一个（市中心会有好几条线挤在一个大换乘站）
      const cross = (a, b, c, d) => { const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s.y - r.y * s.x; if (Math.abs(den) < 1e-6) return null; const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den; return t > 0 && t < 1 && u > 0 && u < 1 ? { x: a.x + r.x * t, y: a.y + r.y * t } : null; };
      const hubs = [], segs = sp => sp.poly.slice(0, -1).map((a, i) => [a, sp.poly[i + 1]]);
      for (let i = 0; i < specs.length; i++) for (let j = i + 1; j < specs.length; j++) for (const [a, b] of segs(specs[i])) for (const [c, d] of segs(specs[j])) {
        const p = cross(a, b, c, d); if (!p || p.x < 20 || p.y < 20 || p.x > MW - 20 || p.y > MH - 20) continue;
        if (!hubs.some(h => Math.hypot(h.x - p.x, h.y - p.y) < 16)) hubs.push({ x: Math.round(p.x), y: Math.round(p.y) });
      }
      for (const sp of specs) buildLine2(sp, hubs);
    }
    // ── 第 4 版：每座城自己的线网（先定折线，再像第 2 版那样求交点放换乘站）
    function buildV4() {
      const polyOf = (pts, loop) => { let poly = []; for (let i = 0; i < pts.length - 1; i++) { const seg = route(pts[i], pts[i + 1]); poly = poly.concat(i ? seg.slice(1) : seg); } if (loop) poly.push(poly[0]); return poly; };
      const clampP = p => ({ x: D.clamp(p.x, 18, MW - 18), y: D.clamp(p.y, 18, MH - 18) });
      const J = (a) => rng.range(-a, a), P = (fx, fy) => ({ x: fx * MW, y: fy * MH });
      // 折线加密，再把落进坑里的点推到坑沿外面（线路就绕着坑走）
      const dense = poly => { const out = []; for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6)); for (let k = 0; k < n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }); } out.push(poly[poly.length - 1]); return out; };
      const aroundCrater = poly => { const K = C.crater; if (!K) return poly; const R = K.r + 14; return dense(poly).map(p => { const d = Math.hypot(p.x - K.x, p.y - K.y); return d >= R ? p : d < 1 ? { x: K.x, y: K.y - R } : { x: K.x + (p.x - K.x) * R / d, y: K.y + (p.y - K.y) * R / d }; }); };
      const specs = [], add = (li, pts, loop) => specs.push({ li, poly: aroundCrater(polyOf(pts.map(clampP), loop)), loop: !!loop });
      if (key === 'tieyuan') { // 铁路网格：四横四竖，一条斜穿全城的军用干线，围着总装厂一圈货运环线
        [0.16, 0.38, 0.62, 0.84].forEach((fy, i) => { const y = fy * MH + J(12); add(i, [P(0.03, y / MH), { x: 0.33 * MW, y: y + J(18) }, { x: 0.66 * MW, y: y + J(18) }, P(0.97, (y + J(14)) / MH)]); });
        [0.14, 0.37, 0.63, 0.86].forEach((fx, i) => { const x = fx * MW + J(14); add(4 + i, [P(x / MW, 0.04), { x: x + J(20), y: 0.35 * MH }, { x: x + J(20), y: 0.65 * MH }, P((x + J(16)) / MW, 0.96)]); });
        add(8, [P(0.03, 0.93), C.core, P(0.97, 0.07)]);
        const k = C.core; add(9, [{ x: k.x - 0.15 * MW, y: k.y - 0.17 * MH }, { x: k.x + 0.15 * MW, y: k.y - 0.17 * MH }, { x: k.x + 0.15 * MW, y: k.y + 0.17 * MH }, { x: k.x - 0.15 * MW, y: k.y + 0.17 * MH }], true);
      } else if (key === 'baisha') { // 东边一个大坑：五条东西线绕着坑沿走，西边老城两条南北线和一个小环，坑沿一圈环线
        [0.14, 0.32, 0.5, 0.68, 0.86].forEach((fy, i) => add(i, [P(0.03, fy + J(0.03)), P(0.3, fy + J(0.05)), P(0.55, fy + J(0.06)), P(0.97, fy + J(0.08))]));
        add(5, [P(0.2 + J(0.02), 0.04), P(0.22, 0.5), P(0.2 + J(0.02), 0.96)]); add(6, [P(0.42 + J(0.02), 0.04), P(0.4, 0.5), P(0.43, 0.96)]);
        add(7, [P(0.04, 0.06), P(0.5, 0.5), P(0.96, 0.95)]);
        const K = C.crater, R = K.r + 18, ring = []; for (let a = 0; a < 16; a++) ring.push({ x: K.x + Math.cos(a / 16 * Math.PI * 2) * R * 1.05, y: K.y + Math.sin(a / 16 * Math.PI * 2) * R * 0.95 });
        specs.push({ li: 8, poly: polyOf(ring.map(clampP), true), loop: true });
        const w = [], o = P(0.3, 0.5); for (let a = 0; a < 6; a++) w.push({ x: o.x + Math.cos(a / 6 * Math.PI * 2 + 0.3) * 0.13 * MW, y: o.y + Math.sin(a / 6 * Math.PI * 2 + 0.3) * 0.2 * MH }); add(9, w, true);
      } else if (key === 'beidu') { // 一条宽河横穿：北岸两条、南岸两条沿河线，三座桥线，一条斜穿的渡线
        const bank = (off, li) => { const pts = []; for (let f = 0.03; f <= 0.98; f += 0.16) { const x = f * MW; pts.push({ x, y: D.cityWaterY(C, x) + off * MH + J(8) }); } add(li, pts); };
        bank(-0.17, 0); bank(-0.34, 1); bank(0.17, 2); bank(0.34, 3);
        [0.22, 0.5, 0.78].forEach((fx, i) => add(4 + i, [P(fx + J(0.02), 0.04), P(fx + J(0.02), 0.3), P(fx, 0.7), P(fx + J(0.02), 0.96)]));
        add(7, [P(0.05, 0.08), P(0.35, 0.3), P(0.65, 0.7), P(0.95, 0.92)]);
      } else { // 岚川：第 2 版的放射 + 双环，按城的大小放大
        const sx = MW / 600, sy = MH / 360, ring = [], inner = [];
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; ring.push({ x: CX + Math.cos(a) * 135 * sx, y: CY + Math.sin(a) * 80 * sy }); }
        specs.push({ li: 8, poly: polyOf(ring, true), loop: true });
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + rng.range(-0.15, 0.15); inner.push({ x: CX + Math.cos(a) * 81 * sx, y: CY + Math.sin(a) * 48 * sy }); }
        specs.push({ li: 9, poly: polyOf(inner, true), loop: true });
        for (let li = 0; li < 8; li++) {
          const th = (li / 8) * Math.PI + rng.range(-0.18, 0.18), ex = Math.cos(th), ey = Math.sin(th), off = rng.range(-40, 40), px = -ey * off * sx, py = ex * off * sy;
          const A = { x: CX + ex * 300 * sx + px, y: CY + ey * 185 * sy + py }, B = { x: CX - ex * 300 * sx + px, y: CY - ey * 185 * sy + py };
          const M1 = { x: D.lerp(A.x, B.x, 0.33) + J(35 * sx), y: D.lerp(A.y, B.y, 0.33) + J(25 * sy) }, M2 = { x: D.lerp(A.x, B.x, 0.66) + J(35 * sx), y: D.lerp(A.y, B.y, 0.66) + J(25 * sy) };
          add(li, [A, M1, M2, B]);
        }
      }
      // 求交点放换乘站（和第 2 版一样；河里、坑里的交点不要）
      const cross = (a, b, c, d) => { const r = { x: b.x - a.x, y: b.y - a.y }, s2 = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s2.y - r.y * s2.x; if (Math.abs(den) < 1e-6) return null; const t = ((c.x - a.x) * s2.y - (c.y - a.y) * s2.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + r.x * t, y: a.y + r.y * t } : null; };
      const hubs = [], segs = sp => sp.poly.slice(0, -1).map((a, i) => [a, sp.poly[i + 1]]);
      for (let i = 0; i < specs.length; i++) for (let j = i + 1; j < specs.length; j++) for (const [a, b] of segs(specs[i])) for (const [c, d] of segs(specs[j])) {
        const p = cross(a, b, c, d); if (!p || p.x < 20 || p.y < 20 || p.x > MW - 20 || p.y > MH - 20 || C.blocked(p.x, p.y)) continue;
        if (!hubs.some(h => Math.hypot(h.x - p.x, h.y - p.y) < 16)) hubs.push({ x: Math.round(p.x), y: Math.round(p.y) });
      }
      for (const sp of specs) buildLine2(sp, hubs);
    }
    // 沿折线走：经过交点就停在换乘站；平常每隔 28–40 放一个站，前面马上要到交点的先不放
    function buildLine2(sp, hubs) {
      const { li, poly, loop } = sp, line = { id: li, name: D.LINE_NAMES[li], col: D.LINE_COLORS[li], stops: [], loop: !!loop }, used = new Set();
      const put = s => { if (line.stops[line.stops.length - 1] !== s && !line.stops.includes(s)) { line.stops.push(s); if (!s.lines.includes(li)) s.lines.push(li); } };
      let acc = 999, gap = rng.range(30, 40);
      for (let i = 0; i < poly.length - 1; i++) {
        const a = poly[i], b = poly[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
        for (let t = 0; t < L; t += 2) {
          const x = a.x + (b.x - a.x) * t / L, y = a.y + (b.y - a.y) * t / L;
          const h = hubs.find(h => !used.has(h) && Math.hypot(h.x - x, h.y - y) < 9);
          if (h) { used.add(h); put(h.st || (h.st = near(h.x, h.y, 8) || addStation(h.x, h.y))); acc = 0; gap = rng.range(28, 40); continue; }
          acc += 2;
          if (acc < gap || x < 16 || y < 16 || x > MW - 16 || y > MH - 16) continue;
          if (ver >= 4 && C.blocked(x, y)) continue;
          if (hubs.some(h => !used.has(h) && Math.hypot(h.x - x, h.y - y) < 20)) continue;
          put(near(x, y, 13) || addStation(x, y)); acc = 0; gap = rng.range(28, 40);
        }
      }
      for (let i = 0; i < line.stops.length - 1; i++) { line.stops[i].adj.add(line.stops[i + 1].id); line.stops[i + 1].adj.add(line.stops[i].id); }
      if (loop && line.stops.length > 2) { const a = line.stops[0], b = line.stops[line.stops.length - 1]; a.adj.add(b.id); b.adj.add(a.id); }
      C.lines.push(line);
    }
    // 站点属性
    for (const s of C.stations) {
      if (C.core) { // 第 4 版：按到核心的远近（白沙从坑沿算起，北渡隔着河的上下距离打折）
        let dn = Math.hypot((s.x - C.core.x) / (MW / 2), (s.y - C.core.y) / (MH / 2) * (SH.tierY || 1));
        if (C.crater) dn = Math.max(0, dn - C.crater.r / (MW / 2) * 1.08);
        s.tier = dn < 0.25 ? 3 : dn < 0.52 ? 2 : dn < 0.78 ? 1 : 0;
      }
      else { const d = Math.hypot((s.x - CX) / 1.35, (s.y - CY) / 0.8); s.tier = d < 55 ? 3 : d < 115 ? 2 : d < 175 ? 1 : 0; }
      // 类型等据点、撤离站定下来以后再统一打散分配（assignTypes）。这里照旧消耗两次随机数，老存档的据点和撤离站位置不变
      if (!(s.tier === 0 && rng.chance(0.3))) rng(); s.type = 'ruin';
      s.exit = null;
    }
    // 只保留和最大连通块相连的站（极少数孤点去掉）
    const comp = bfs(C, C.stations.reduce((a, b) => (b.adj.size > a.adj.size ? b : a)).id);
    for (const s of C.stations) if (!comp.has(s.id)) s.dead = true;
    const live = C.stations.filter(s => !s.dead);
    // 据点：最外圈的人类据点
    const outer = live.filter(s => s.tier === 0).sort((a, b) => Math.hypot(b.x - CX, b.y - CY) - Math.hypot(a.x - CX, a.y - CY));
    const home = outer[rng.int(0, Math.min(3, outer.length - 1))];
    home.type = 'outpost'; home.name = '南栈'; home.home = true; C.home = home.id;
    // 撤离站
    const pick = (list, n, kind) => { rng.shuffle(list); for (const s of list.slice(0, n)) s.exit = kind; };
    pick(live.filter(s => s.tier <= 1 && !s.home && !s.exit && graphDist(C, home.id, s.id) >= 3), 5, 'fixed');
    pick(live.filter(s => (s.tier === 1 || s.tier === 2) && !s.home && !s.exit), 4, 'timed');
    pick(live.filter(s => s.tier >= 2 && !s.exit), 3, 'hidden');
    for (const s of live) if (s.exit === 'timed') s.phase = rng.int(0, D.TUNE.timedWindow - 1);
    lineEndExits(C, live, home);
    edgeExits(C, live, home); // 试玩反馈二：撤离只在线路尽头 + 两个隐藏撤离点（覆盖上面的老抽签）
    assignTypes(C, live, home);
    if (D.assignTypesX) D.assignTypesX(C, live, home); // M5：改出几座新站型（world.js）
    if (ver >= 2) interleave(C, live, home); // 普通战斗站和特殊站交叉排
    // 南栈旁边的站是默认出发站，第一站要能探索（试玩反馈）：事件站现在只演一场对话、没有站，所以紧挨南栈的事件站换成普通战斗站（不动随机数，别的站不变）
    for (const n of home.adj) { const s = C.stations[n]; if (s && !s.dead && s.type === 'event') s.type = 'ruin'; }
    // 第 4 版：线网大了，交叉排可能把据点旁边换成流民营这类安全站——出发站得能探索，换回普通站（老版本不动，免得老存档的站变样）
    if (ver >= 4) for (const n of home.adj) { const s = C.stations[n], T = s && D.STATION_TYPES[s.type]; if (s && !s.dead && T && (T.safe || T.cat === 'safe')) s.type = 'ruin'; }
    // 隐藏站：一半在地图上画成问号（看得到、不知道是什么），一半要走到它旁边那站才会出现
    const bases = rng.shuffle(live.filter(s => s.tier >= 1 && !s.home));
    let made = 0;
    for (const b of bases) {
      if (made >= 7) break;
      const a = rng() * Math.PI * 2, dd = rng.range(26, 40), x = Math.round(b.x + Math.cos(a) * dd), y = Math.round(b.y + Math.sin(a) * dd);
      if (x < 20 || y < 20 || x > MW - 20 || y > MH - 20) continue;
      if (C.stations.some(o => !o.dead && Math.hypot(o.x - x, o.y - y) < 22)) continue;
      if (ver >= 4 && C.blocked(x, y)) continue;
      // 2026-11-17 用户：隐藏站一开始一律不显示，走到旁边才出现；分叉出去的隐藏支线两头都接着线路（不是死路，走进去也能从另一头出来）
      const h = { id: C.stations.length, x, y, lines: [], adj: new Set([b.id]), name: newName(), hidden: true, secret: 'proximity', tier: Math.min(3, b.tier + 1), type: 'cache', exit: null };
      C.stations.push(h); b.adj.add(h.id); live.push(h); made++;
      // 另一头：离隐藏站最近的另一个普通站（不耗随机数，老存档的站编号不变）
      let o2 = null, od = 90;
      for (const o of live) { if (o === b || o === h || o.dead || o.hidden || o.home) continue; const e = Math.hypot(o.x - x, o.y - y); if (e < od) { od = e; o2 = o; } }
      if (o2) { h.adj.add(o2.id); o2.adj.add(h.id); }
    }
    addReserve(C, live, home);
    // 一开始知道的：据点周围两站、所有固定撤离站
    C.known = new Map();
    for (const s of live) C.known.set(s.id, 0);
    const d2 = bfsDist(C, home.id);
    for (const s of live) if (!s.hidden && (d2.get(s.id) <= 2 || s.exit === 'fixed')) C.known.set(s.id, 1);
    C.known.set(home.id, 2);
    C.entries = new Set([home.id]);
    C.found = new Set(); // 已经发现的隐藏撤离点
    // 线路穿没穿过市中心（线上有站在危险等级 3）：出发站在这种线路上，开场警戒就高（raid.js 的 D.startAlert）
    for (const L of C.lines) L.central = L.stops.some(s => !s.dead && s.tier === 3);
    return C;
  }
  // ── 站点类型：全城打散。先放特殊站（安全站、高价值站、精英站、中继站），同类之间隔开；再用普通站填满，相邻两站不重样
  // 固定撤离站放在线路尽头（末端站）。上面的老抽签照旧做完（随机数消耗不变，据点和隐藏站位置不变），
  // 再把不在尽头的固定站挪到尽头：本来就在尽头的保留，其余从离据点至少 3 站的尽头站里挑，彼此尽量分散
  function lineEndExits(C, live, home) {
    const rng = D.rng('exits:' + C.seed), dist = bfsDist(C, home.id);
    const isEnd = s => !s.home && !s.hidden && [...s.adj].filter(n => !C.stations[n].dead && !C.stations[n].hidden).length === 1;
    const keep = live.filter(s => s.exit === 'fixed' && isEnd(s)), want = live.filter(s => s.exit === 'fixed').length;
    for (const s of live) if (s.exit === 'fixed' && !isEnd(s)) s.exit = null;
    const cand = rng.shuffle(live.filter(s => isEnd(s) && !s.exit && (dist.has(s.id) ? dist.get(s.id) : 0) >= 3));
    const far = s => keep.length ? Math.min(...keep.map(k => Math.hypot(k.x - s.x, k.y - s.y))) : 999;
    while (keep.length < want && cand.length) { cand.sort((a, b) => far(b) - far(a)); const s = cand.shift(); s.exit = 'fixed'; keep.push(s); }
  }
  // 交叉排（第 2 版城市）：沿每条线，普通战斗站最多连着两个；第三个换成事件、精英、休整、宝藏或中继站（用户 2026-11-17：删除商人点，不再换成黑市）
  // （用自己的随机流；满足各站型的最低危险等级、离据点的距离、不和相邻站同型）
  function interleave(C, live, home) {
    const TT = D.STATION_TYPES, rng = D.rng('mix:' + C.seed), dist = bfsDist(C, home.id);
    const fight = s => s && !s.dead && !s.home && !s.hidden && !s.reserve && D.nodeCat(s) === 'fight';
    const OPTS = [['event', 3], ['depot', 1], ['checkpoint', 1], ['refuge', 1.2], ['relay', 0.6], ['museum', 0.6], ['bank', 0.4], ['datacenter', 0.4]];
    const ok = (s, k) => { const T = TT[k]; if (!T) return false; if ((T.minTier || 0) > s.tier || (T.minDist || 0) > (dist.has(s.id) ? dist.get(s.id) : 99)) return false; if ((T.noExit || T.safe) && s.exit) return false; for (const o of s.adj) if (C.stations[o].type === k) return false; return true; };
    for (let pass = 0; pass < 3; pass++) for (const L of C.lines) {
      let run = [];
      const flush = () => { while (run.length >= 3) { const s = run[2], opts = OPTS.filter(([k]) => ok(s, k)); if (opts.length) s.type = rng.weighted(opts); run = run.slice(3); } run = []; };
      for (const s of L.stops) { if (fight(s)) run.push(s); else flush(); }
      flush();
    }
    // 全城普通站压到 42% 左右：先换"周围普通站最多"的路口站
    const all = live.filter(s => !s.dead && !s.hidden), share = () => all.filter(fight).length / all.length;
    const nb = s => [...s.adj].filter(n => fight(C.stations[n])).length;
    for (const need of [2, 1]) for (const s of rng.shuffle(all.filter(fight)).sort((a, b) => nb(b) - nb(a))) {
      if (share() <= 0.42) break; if (!fight(s) || nb(s) < need) continue;
      const opts = OPTS.filter(([k]) => ok(s, k)); if (opts.length) s.type = rng.weighted(opts);
    }
  }
  // 撤离只在边缘：每条（不是环线的）线的两个尽头站都是撤离站；再挑两个离据点远的中间站当隐藏撤离点（走到旁边才发现）
  function edgeExits(C, live, home) {
    const rng = D.rng('edge:' + C.seed), dist = bfsDist(C, home.id), gap = C.ver >= 3 ? HIDDEN_GAP : 150;
    for (const s of live) { s.exit = null; s.phase = null; }
    for (const L of C.lines) { if (L.loop) continue; for (const s of [L.stops[0], L.stops[L.stops.length - 1]]) if (s && !s.dead && !s.home && !s.hidden) s.exit = 'fixed'; }
    const cand = rng.shuffle(live.filter(s => !s.exit && !s.home && !s.hidden && s.tier >= 1 && (dist.get(s.id) || 0) >= 4));
    const picked = [];
    for (const s of cand) { if (picked.length >= 2) break; if (picked.some(p => Math.hypot(p.x - s.x, p.y - s.y) < gap)) continue; s.exit = 'hidden'; picked.push(s); }
  }
  function assignTypes(C, live, home) {
    const TT = D.STATION_TYPES, rng = D.rng('types:' + C.seed), dist = bfsDist(C, home.id);
    const pool = live.filter(s => !s.home), keys = Object.keys(TT).filter(k => TT[k].w > 0);
    for (const s of pool) s.type = null;
    const sumW = keys.reduce((a, k) => a + TT[k].w, 0), want = k => Math.max(1, Math.round(pool.length * TT[k].w / sumW));
    const within = (s, r) => { const out = [], q = [[s.id, 0]], seen = new Set([s.id]); while (q.length) { const [id, d] = q.shift(); if (d >= r) continue; for (const n of C.stations[id].adj) if (!seen.has(n)) { seen.add(n); out.push(C.stations[n]); q.push([n, d + 1]); } } return out; };
    const gap = { safe: 2, hv: 2, elite: 1, relay: 2, event: 1 }; // 同类特殊站之间至少隔几站（据点也算安全站）
    const ok = (s, k) => {
      const T = TT[k];
      if (s.type || (T.minTier || 0) > s.tier || (T.minDist || 0) > (dist.has(s.id) ? dist.get(s.id) : 99)) return false;
      if (T.noExit && s.exit) return false; // 问号站不当撤离站
      if (T.safe && s.exit && s.exit !== 'fixed') return false; // 限时、隐藏撤离站要打撤离战，不能是没有敌人的站
      for (const o of s.adj) if (C.stations[o].type === k) return false;
      if (T.cat) for (const o of within(s, gap[T.cat] || 1)) if (o.type && TT[o.type] && TT[o.type].cat === T.cat) return false;
      return true;
    };
    // 特殊站：一轮轮地给每种找一个合适的空站，限制多的先放
    const specials = keys.filter(k => TT[k].cat).sort((a, b) => (TT[b].minDist || 0) + (TT[b].minTier || 0) - (TT[a].minDist || 0) - (TT[a].minTier || 0));
    for (let round = 0; round < 8; round++) for (const k of specials) {
      if (pool.filter(s => s.type === k).length >= want(k)) continue;
      const cand = pool.filter(s => ok(s, k)); if (cand.length) rng.pick(cand).type = k;
    }
    // 普通站：按权重挑，和相邻的站不重样
    const commons = keys.filter(k => !TT[k].cat);
    for (const s of rng.shuffle(pool.filter(s => !s.type))) {
      const opts = commons.filter(k => ok(s, k));
      s.type = opts.length ? rng.weighted(opts.map(k => [k, TT[k].w])) : 'ruin';
    }
  }
  // 主线终局站：地下战略储备库。挂在离据点最远的沦陷核心站旁边，读到"储备库入口"以前谁都看不见（secret: 'story'）。
  // 用自己的随机流、加在所有站的最后，原有站点的编号和位置不变（老存档兼容）
  function addReserve(C, live, home) {
    const rng = D.rng('reserve:' + C.seed), dist = bfsDist(C, home.id);
    const deep = live.filter(s => !s.hidden && !s.home && s.tier === 3).sort((a, b) => (dist.get(b.id) || 0) - (dist.get(a.id) || 0) || a.id - b.id);
    const bases = deep.length ? deep : live.filter(s => !s.hidden && !s.home).sort((a, b) => b.tier - a.tier || (dist.get(b.id) || 0) - (dist.get(a.id) || 0));
    // 第 3 版：储备库离别的隐藏撤离点至少 HIDDEN_GAP 远。先在深处的站旁边找，找不到再到别的站找；实在没有才放宽（剧情要它在）
    const v3 = C.ver >= 3, away = (x, y) => C.stations.every(o => o.dead || o.exit !== 'hidden' || Math.hypot(o.x - x, o.y - y) >= HIDDEN_GAP);
    const rest = v3 ? live.filter(s => !s.hidden && !s.home && !bases.includes(s)).sort((a, b) => (dist.get(b.id) || 0) - (dist.get(a.id) || 0) || a.id - b.id) : [];
    const tryAt = (b, strict) => {
      for (let i = 0; i < 40; i++) {
        const a = rng() * Math.PI * 2, dd = rng.range(24, 40), x = Math.round(b.x + Math.cos(a) * dd), y = Math.round(b.y + Math.sin(a) * dd);
        if (x < 20 || y < 20 || x > MW - 20 || y > MH - 20) continue;
        if (C.stations.some(o => !o.dead && Math.hypot(o.x - x, o.y - y) < 18)) continue;
        if (strict && !away(x, y)) continue;
        const h = { id: C.stations.length, x, y, lines: [], adj: new Set([b.id]), name: '无名支线', hidden: true, secret: 'story', tier: 3, type: 'reserve', exit: 'hidden', reserve: true };
        C.stations.push(h); b.adj.add(h.id); live.push(h); C.reserve = h.id; return true;
      }
      return false;
    };
    (v3 && [...bases, ...rest].some(b => tryAt(b, true))) || bases.slice(0, 6).some(b => tryAt(b, false));
  }
  const storySecret = s => s.secret === 'story';
  function bfs(C, start) { const seen = new Set([start]), q = [start]; while (q.length) { const s = C.stations[q.shift()]; for (const n of s.adj) if (!seen.has(n)) { seen.add(n); q.push(n); } } return seen; }
  function bfsDist(C, start) { const d = new Map([[start, 0]]), q = [start]; while (q.length) { const id = q.shift(), s = C.stations[id]; for (const n of s.adj) if (!d.has(n)) { d.set(n, d.get(id) + 1); q.push(n); } } return d; }
  function graphDist(C, a, b) { const d = bfsDist(C, a); return d.has(b) ? d.get(b) : 99; }
  D.cityDist = bfsDist;

  // 限时撤离站这一步开没开
  D.exitOpen = (s, step) => !!s.exit;
  // 隐藏撤离点：走到它或它旁边那站才发现（储备库读到入口就知道）
  D.knownExit = (C, s) => !!s.exit && (s.exit !== 'hidden' || (s.reserve ? C.known.get(s.id) >= 1 : !!(C.found && C.found.has(s.id))));
  // 打听：到了一站，相邻站的类型就知道了；旁边要是有隐藏撤离点，也发现了
  D.scoutAround = function (C, id) {
    C.known.set(id, 2); C.found = C.found || new Set();
    for (const n of [id, ...C.stations[id].adj]) { const o = C.stations[n]; if (n !== id && C.known.get(n) < 1 && !storySecret(o)) C.known.set(n, 1); if (o.exit === 'hidden' && !o.reserve && !C.found.has(n)) { C.found.add(n); C.justFound = n; } }
  };
  // 买情报：揭开离已知区域最近的若干个未知站
  D.buyIntel = function (C, n) {
    const rng = D.rng('intel:' + C.seed + ':' + [...C.known.values()].reduce((a, b) => a + b, 0));
    const cand = C.stations.filter(s => !s.dead && !s.hidden && !storySecret(s) && C.known.get(s.id) === 0 && [...s.adj].some(a => C.known.get(a) >= 1));
    rng.shuffle(cand); const got = cand.slice(0, n); for (const s of got) C.known.set(s.id, 1); return got;
  };

  // 信号中继站：揭开图上距离 3 站以内的所有站，以及附近的隐藏站
  D.relayScan = function (C, id) {
    const d = bfsDist(C, id), at = C.stations[id]; let n = 0;
    for (const s of C.stations) { if (s.dead || s.hidden || storySecret(s) || C.known.get(s.id) >= 1) continue; if (d.has(s.id) && d.get(s.id) <= 3) { C.known.set(s.id, 1); n++; } } // 隐藏站只有走到旁边才出现，中继也照不出来
    return n;
  };

  // ── 地区名（只用来描述位置；危险程度看警戒，见 raid.js 的威胁等级）
  D.TIER_NAME = ['外环', '城区', '内城', '市中心'];
  D.cityVisible = (C, s) => !s.dead && (!s.hidden || C.known.get(s.id) >= 1);
})(D);
