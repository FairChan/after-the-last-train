/* 站内地图第二代 P1 · 站厅层组装（design/features/station-gen/design.md 第 5.2、6 节；施工步骤 plan-p1.md 任务 1）
   D.gen2 = { concourse(rng, st, opt, layout) → 站厅层 F }（P7 任务 3：骨架开关 D.TUNE.gen2.concourse 和 G2.on 删了，所有站都走这里；不认识的骨架按标准站的骨架出）
   顺序：骨架（mass.js）→ 房间种类（graph.js）→ 挖大厅和拼形房间 → 楼梯 → 结构图的边 → 一条条挖通道、开门洞
   → 环厅的售票亭 → 后门（有敌人的站：检修道，直到环路 ≥ 2）→ 柱子 → 商人 / 医生 / 调度台的位置。
   通道：格子上跑 Dijkstra（状态 = 格 × 来的方向，转弯 +1），别的房间的格和它们外圈的墙不许走；已经是走廊的格代价 1、实心格 3、
     笔刷放不下（会被墙削窄）的格再 +1。走出的中线按宽度用方笔刷挖，碰到房间和外圈墙的格不挖，所以窄处自动变窄、房间只从门洞进出。
   门洞：开在房间外圈墙上，墙里一格是这间房、墙外一格是空当；门洞之间至少隔一格墙；大厅的门不贴着楼梯。
     隐藏房、门禁房的门是裂缝墙（kind 3）＋ 一个 F.breakables 项（门禁房带 lock），门洞最宽 2 格（openBreakable 只开 3×3）。
   输出字段和旧站厅层一样，外加 F.gen2 = true、F.doors = [{ x, y, w, h, room, tier }]（格坐标，tier 是 main / sec / staff）、
   每间房的 cells（格数）和 shape（rect / L / T / notch）。摆设、容器、画法仍走 level.js 的 decorate / bake。
   随机数：只从 makeStation 的 rng 取一个数，派生 r2，之后全用 r2（联机两边靠种子建同一个站）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, G2 = D.gen2 = D.gen2 || {};
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];


  // 小顶堆（代价、先后），给 Dijkstra 用
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v, top = v[0], tk = k[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; }
    this.lastKey = tk; return top;
  };

  // 环路数：硬格（墙 kind 1、轨道 kind 2）八连通成块，不碰地图边、至少 6 格、挨着能走的格（同 gen-metrics 的数法，只是不从楼梯泛洪）
  G2.holes = function (F) {
    const W = F.tw, H = F.tht, N = W * H, seen = new Uint8Array(N), hard = i => F.kind[i] === 1 || F.kind[i] === 2;
    let n = 0;
    for (let i0 = 0; i0 < N; i0++) {
      if (!hard(i0) || seen[i0]) continue;
      let area = 0, border = false, touch = false; const q = [i0]; seen[i0] = 1;
      while (q.length) {
        const c = q.pop(), cx = c % W, cy = (c / W) | 0; area++;
        if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) border = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = y * W + x;
          if (hard(j)) { if (!seen[j]) { seen[j] = 1; q.push(j); } } else if ((!dx || !dy) && (F.solid[j] === 0 || F.kind[j] === 3)) touch = true;
        }
      }
      if (!border && area >= 6 && touch) n++;
    }
    return n;
  };

  // ── 通道网（P1 的组装，P6 起站台层、换乘层、设备层也用）：挖结构图的边、开门洞、后门检修道、大厅柱网上的柱子。
  //   o = { halls（不许在楼梯旁开门、柱子立在这些房间里）, hubs（一开始就算接上的房间，默认 halls）, stairT（楼梯格）, G（{ tree, back }，G2.edges 那种格式）,
  //         safe（安全站不挖后门）, afterTree()（树挖完、后门之前调：环厅的售票亭）, keep（柱子躲开的格）, gridOf(h)（大厅的柱网）, pillarHalls, pillarOK(x, y),
  //         block(i)（另外不许挖的格：站台层的轨道和登车区下面）, pick(e, S, Gs) → [S, Gs]（挑两头的门洞候选） }
  //   随机数只用传进来的 r2，取数的先后和 P1 一样（站厅层逐格不变）。
  G2.net = function (F, r2, o) {
    const LV = D.LV, idx = LV.idx, W = F.tw, H = F.tht, N = W * H, halls = o.halls, stairT = o.stairT, G = o.G, net = o;
    // ── 不许挖的格：房间格 + 房间外一圈墙（ring：哪间房的外圈；-2 = 挨着两间以上）
    const ring = new Int16Array(N).fill(-1), block = new Uint8Array(N);
    if (o.block) for (let i = 0; i < N; i++) if (o.block(i)) block[i] = 1;
    for (let i = 0; i < N; i++) {
      const ri = F.room[i]; if (ri < 0) continue; block[i] = 1;
      const cx = i % W, cy = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x; if (F.room[j] >= 0) continue;
        block[j] = 1; ring[j] = ring[j] === -1 || ring[j] === ri ? ri : -2;
      }
    }
    const inb = i => { const x = i % W, y = (i / W) | 0; return x >= 1 && y >= 2 && x <= W - 2 && y <= H - 2; };
    const doorAt = new Int16Array(N).fill(-1), locked = r => !!(r.hidden || r.lock);
    const cheb = (i, x, y) => Math.max(Math.abs(i % W - x), Math.abs(((i / W) | 0) - y));
    // 笔刷放不放得下（按宽度缓存）
    const fitCache = {};
    const fits = w => {
      if (fitCache[w]) return fitCache[w];
      const lo = -Math.floor((w - 1) / 2), hi = lo + w - 1, out = new Uint8Array(N);
      // P5 提速：笔刷范围里有没有挡路的格用二维前缀和查（和逐格扫的结果一样）
      const W1 = W + 1, ps = new Int32Array(W1 * (H + 1));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ps[(y + 1) * W1 + x + 1] = (block[y * W + x] ? 1 : 0) + ps[y * W1 + x + 1] + ps[(y + 1) * W1 + x] - ps[y * W1 + x];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const x0 = x + lo, y0 = y + lo, x1 = x + hi, y1 = y + hi;
        if (x0 < 1 || y0 < 2 || x1 > W - 2 || y1 > H - 2) continue;
        if (ps[(y1 + 1) * W1 + x1 + 1] - ps[y0 * W1 + x1 + 1] - ps[(y1 + 1) * W1 + x0] + ps[y0 * W1 + x0] === 0) out[y * W + x] = 1;
      }
      return (fitCache[w] = out);
    };

    // ── 门洞候选：R 外圈墙上连着 dw 格，墙里是 R 的格、墙外是空当
    function cands(R, dw, o) {
      const out = [];
      for (let y = R.y - 1; y <= R.y + R.h; y++) for (let x = R.x - 1; x <= R.x + R.w; x++) {
        const c = y * W + x;
        if (x < 0 || y < 0 || x >= W || y >= H || ring[c] !== R.i) continue;
        for (const [dx, dy] of N4) {
          const p = dx ? W : 1, d = dy * W + dx, cells = [];
          for (let k = 0; k < dw; k++) {
            const ck = c + k * p, ckx = ck % W, cky = (ck / W) | 0;
            if (k && (dx ? cky !== y + k : ckx !== x + k)) break;
            if (ck < 0 || ck >= N || !inb(ck) || ring[ck] !== R.i || F.room[ck - d] !== R.i || !inb(ck + d) || block[ck + d]) break;
            if (o.avoid && o.avoid[ck + d]) break;
            let near = false;
            for (let b = -1; b <= 1 && !near; b++) for (let a = -1; a <= 1; a++) { const j = ck + b * W + a; if (j >= 0 && j < N && doorAt[j] >= 0) { near = true; break; } }
            if (near) break;
            if (halls.includes(R) && stairT.some(([sx, sy]) => cheb(ck, sx, sy) <= 1)) break;
            cells.push(ck);
          }
          if (cells.length === dw) out.push({ cells, d, porch: cells.map(ck => ck + d), R });
        }
      }
      if (!o.fresh && !locked(R)) F.doors.forEach((dr, k) => { if (dr.room === R.i && dr.cells) out.push({ cells: dr.cells, d: dr.d, porch: dr.cells.map(ck => ck + dr.d), R, old: k }); });
      return out;
    }
    // ── 从 starts 的门外一格走到 goals 的门外一格；返回 { path, s, g } 或 null
    function route(starts, goals, w, avoid) {
      if (!starts.length || !goals.length) return null;
      const fit = fits(w), S = N * 4, dist = new Float64Array(S).fill(Infinity), prev = new Int32Array(S).fill(-1), src = new Int32Array(S).fill(-1);
      const goalOf = new Map(); goals.forEach(g => g.porch.forEach(p => { if (!goalOf.has(p)) goalOf.set(p, g); }));
      const hp = new Heap(), dirOf = d => d === 1 ? 0 : d === -1 ? 1 : d === W ? 2 : 3;
      starts.forEach((s, si) => s.porch.forEach(p => { const u = p * 4 + dirOf(s.d); if (dist[u] > 0) { dist[u] = 0; src[u] = si; hp.push(0, u); } }));
      const free = j => inb(j) && !block[j] && !(avoid && avoid[j]);
      while (hp.k.length) {
        const u = hp.pop(), du = hp.lastKey; if (du > dist[u]) continue;
        const c = u >> 2, dir = u & 3;
        if (goalOf.has(c)) {
          const path = []; for (let v = u; v >= 0; v = prev[v]) path.push(v >> 2);
          return { path: path.reverse(), s: starts[src[u]], g: goalOf.get(c) };
        }
        for (let k = 0; k < 4; k++) {
          const [dx, dy] = N4[k], x = c % W + dx, y = ((c / W) | 0) + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = y * W + x; if (!free(j)) continue;
          const nd = du + (F.solid[j] === 0 ? 1 : 3) + (fit[j] ? 0 : 1) + (k === dir ? 0 : 1), v = j * 4 + k;
          if (nd < dist[v]) { dist[v] = nd; prev[v] = u; src[v] = src[u]; hp.push(nd, v); }
        }
      }
      return null;
    }
    const open = i => { F.solid[i] = 0; F.kind[i] = 0; };
    function dig(path, w) {
      const lo = -Math.floor((w - 1) / 2), hi = lo + w - 1;
      for (const c of path) { const cx = c % W, cy = (c / W) | 0; for (let b = lo; b <= hi; b++) for (let a = lo; a <= hi; a++) { const j = (cy + b) * W + cx + a; if (cx + a >= 1 && cy + b >= 2 && cx + a <= W - 2 && cy + b <= H - 2 && !block[j]) open(j); } }
    }
    function makeDoor(cd, tier) {
      const R = cd.R, k = F.doors.length, xs = cd.cells.map(i => i % W), ys = cd.cells.map(i => (i / W) | 0);
      for (const i of cd.cells) { doorAt[i] = k; if (locked(R)) { F.solid[i] = 1; F.kind[i] = 3; } else open(i); }
      for (const p of cd.porch) open(p);
      const x = Math.min(...xs), y = Math.min(...ys);
      F.doors.push({ x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1, room: R.i, tier, cells: cd.cells, d: cd.d });
      if (locked(R)) {
        const tx = xs[0], ty = ys[0], br = { tx, ty, hp: 40, room: R.i, open: false, x: tx * TS + 8, y: ty * TS + 8 };
        if (R.lock) br.lock = R.lock;
        F.breakables.push(br);
      }
    }
    const dw = tier => tier === 'staff' ? r2.int(1, 2) : 2;
    // 一条边：o.fresh = 两头都开新门（后门），o.avoid = 不许走的格（已有走廊和它旁边一格）
    const SIDE = { up: -W, down: W, left: -1, right: 1 };
    function link(e, o) {
      let S = cands(e.a, dw(e.tier), { fresh: true, avoid: o.avoid }), Gs = cands(e.b, dw(e.tier), { fresh: !!o.fresh, avoid: o.avoid });
      if (e.sides) { // 绕大厅一角：两头在相邻的两侧，门离墙角至少 5 格（不然围出来的墙太小，算不上一条环路）
        const h = e.a, kx = e.sides[1] === 'left' ? h.x - 1 : h.x + h.w, ky = e.sides[0] === 'up' ? h.y - 1 : h.y + h.h;
        S = S.filter(c => c.d === SIDE[e.sides[0]] && c.cells.every(i => Math.abs(i % W - kx) >= 5));
        Gs = Gs.filter(c => c.d === SIDE[e.sides[1]] && c.cells.every(i => Math.abs(((i / W) | 0) - ky) >= 5));
      }
      if (net.pick) [S, Gs] = net.pick(e, S, Gs); // P6：站台层让房间的门开在离楼梯近的那头
      const res = route(S, Gs, e.w, o.avoid);
      if (!res) return null;
      dig(res.path, e.w);
      makeDoor(res.s, e.tier);
      if (res.g.old == null) makeDoor(res.g, e.tier);
      return res;
    }

    // ── 结构图的边：先挖大厅之间、主通道，再挖次通道
    const linked = new Set(o.hubs || halls);
    for (const e of G.tree) {
      if (link(e, {})) { linked.add(e.a); continue; }
      // 兜底：最近的大厅走不到，就接到任何已经接上的大厅或普通房
      for (const t of [...linked].filter(t => !locked(t))) if (link(Object.assign({}, e, { b: t, tier: 'sec', w: 3 }), {})) { linked.add(e.a); break; }
    }
    if (o.afterTree) o.afterTree(); // 环厅的售票亭
    // ── 后门（有敌人的站）：检修道，两头都开新门、不贴着已有的走廊走；至少挖 2 条，挖到环路 ≥ 2 为止（最多 4 条）
    if (!o.safe) {
      let made = 0;
      for (const e of G.back) {
        if (made >= 4 || (made >= 2 && G2.holes(F) >= 2)) break;
        const avoid = new Uint8Array(N);
        for (let i = 0; i < N; i++) if (F.room[i] < 0 && (F.solid[i] === 0 || F.kind[i] === 3)) { const cx = i % W, cy = (i / W) | 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = cx + a, y = cy + b; if (x >= 0 && y >= 0 && x < W && y < H) avoid[y * W + x] = 1; } }
        if (link(e, { fresh: true, avoid })) made++;
      }
    }
    // ── 柱子：柱网点上、四周一圈都是大厅地面、离楼梯 / 门洞 / 商人位 2 格以外
    const keep = stairT.concat(o.keep || []);
    for (const dr of F.doors) for (const i of dr.cells) keep.push([i % W, (i / W) | 0]);
    for (const h of o.pillarHalls || halls) {
      const g = o.gridOf(h);
      for (let y = g.oy; y <= h.y + h.h - 3; y += g.s) for (let x = g.ox; x <= h.x + h.w - 3; x += g.s) {
        let ok = x >= h.x + 2 && y >= h.y + 2;
        for (let b = -1; b <= 1 && ok; b++) for (let a = -1; a <= 1; a++) { const i = idx(F, x + a, y + b); if (F.room[i] !== h.i || F.solid[i] || F.kind[i]) { ok = false; break; } }
        if (!ok || keep.some(([kx, ky]) => Math.max(Math.abs(kx - x), Math.abs(ky - y)) <= 2) || (o.pillarOK && !o.pillarOK(x, y))) continue;
        F.solid[idx(F, x, y)] = 1; F.props.push(Object.assign(D.makeProp('pillar', x, y, F.th, r2), { grid: true })); // grid：柱网上的柱子（P5 的横梁、吊灯按它排；摆设里随手放的柱子不算）
      }
    }
  };

  G2.concourse = function (rng, st, opt, lay) {
    const r2 = D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:skel'));
    const LV = D.LV, idx = LV.idx, T = D.STATION_TYPES[st.type], sk = G2.skeleton(r2, lay);
    const F = LV.newFloor(sk.W, sk.H, LV.txt.conc, T.theme), W = F.tw, H = F.tht, N = W * H;
    F.gen2 = true; F.doors = [];
    // ── 大厅、房间
    const halls = sk.halls.map(h => LV.addRoom(F, h.x, h.y, h.w, h.h, 'hall')), hall = halls[sk.hi];
    const specs = G2.kinds(r2, st, opt, lay, G2.boxes(r2, sk, G2.roomCount(r2, lay)));
    const rooms = specs.map(sp => {
      const b = sp.box, sh = G2.shape(r2, b, !sp.hidden && !sp.lock && !sp.hv), r = LV.addRoom(F, b.x, b.y, b.w, b.h, sp.kind, { hidden: sp.hidden, hv: sp.hv, lock: sp.lock });
      for (const [x0, y0, w, h] of sh.cut) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = idx(F, x, y); if (F.room[i] === r.i) { F.solid[i] = 1; F.kind[i] = 1; F.room[i] = -1; } }
      r.shape = sh.shape;
      return r;
    });
    const countCells = () => { const c = new Array(F.rooms.length).fill(0); for (let i = 0; i < N; i++) if (F.room[i] >= 0) c[F.room[i]]++; F.rooms.forEach((r, k) => { r.cells = c[k]; if (!r.shape) r.shape = 'rect'; }); };
    countCells();
    // ── 楼梯：下到站台层的在（楼梯所在）大厅最下面一排正中；深埋站第二道在大厅左上
    F.stairs.push({ x: hall.x * TS + hall.w * TS / 2, y: (hall.y + hall.h - 1) * TS, dir: 'down', label: LV.txt.down, to: 1 });
    if (lay === 'deep') F.stairs.push({ x: (halls[0].x + 3) * TS, y: (halls[0].y + 2) * TS, dir: 'down', label: LV.txt.deep, to: -1, deep: true });
    const stairT = F.stairs.map(s => [Math.floor(s.x / TS), Math.floor(s.y / TS)]);
    // 商人 / 医生 / 调度台（同旧版的位置），柱子要躲开
    const spots = [];
    if (opt.safe) spots.push(['trader', hall.x + 6, hall.y + 3], ['healer', hall.x + hall.w - 6, hall.y + 3]);
    if (st.type === 'relay') spots.push(['relay', hall.x + hall.w / 2, hall.y + 3]);

    G2.net(F, r2, { halls, stairT, G: G2.edges(r2, halls, rooms, sk.hi, opt), safe: !!opt.safe, keep: spots.map(s => [s[1], s[2]]), gridOf: h => h === hall ? sk.grid : G2.grid(h, sk.grid.s),
      afterTree: () => { if (lay === 'ring') for (let y = hall.y + 3; y < hall.y + hall.h - 4; y++) for (let x = hall.x + 6; x < hall.x + hall.w - 6; x++) { const i = idx(F, x, y); F.solid[i] = 1; F.kind[i] = 1; } } }); // 环厅：站厅中间一大块售票亭（实心），绕着走（同旧版大小）
    // ── 商人 / 医生 / 调度台：落在大厅地面格上（被挡就挪到最近的地面格，站在格子正中）
    const floorAt = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const i = idx(F, x, y); return F.room[i] === hall.i && !F.solid[i] && !F.kind[i]; };
    const spotAt = (tx, ty) => {
      if (floorAt(Math.floor(tx), ty)) return { f: 0, x: tx * TS, y: ty * TS };
      for (let rr = 1; rr < 12; rr++) for (let b = -rr; b <= rr; b++) for (let a = -rr; a <= rr; a++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== rr) continue;
        const x = Math.floor(tx) + a, y = ty + b; if (floorAt(x, y)) return { f: 0, x: x * TS + 8, y: y * TS + 8 };
      }
      return { f: 0, x: tx * TS, y: ty * TS };
    };
    for (const [k, x, y] of spots) opt[k] = spotAt(x, y);
    F.keep = spots.map(([k]) => [Math.floor(opt[k].x / TS), Math.floor(opt[k].y / TS)]); // P2：furnish、rubble 在这几格周围不放东西（P1 审稿 M1）
    for (const dr of F.doors) { delete dr.cells; delete dr.d; }
    countCells();
    return F;
  };
})(D);
