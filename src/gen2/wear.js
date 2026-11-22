/* 站内地图第二代 P4 · 表面痕迹（design/features/station-gen/plan-p4.md 任务 2；设计文档 5.5 节）
   D.gen2.paintWear(F, x, rw)：level.js 的 bake 在地面、墙画完以后、贴花之前调（只对 F.gen2 楼层；D.TUNE.gen2.wear = false 时不调）。
   只改画面，不碰 solid / kind / room / 容器 / 出生点。随机数只用传进来的子流 rw（'gen2:wear:' + 楼层号）。
   P6（dress.js）：旧骨架楼层也调（F.gen2dress 的工序表里没开的 dust / leak / cable / pipe 不画）；露天的格（G2.outMask）不画积灰、积水、水渍线、横管，整层露天不拉线缆；F.dust = 画了积灰的格数。
   全部先画进一张自己的像素缓冲（不读回画布），最后一次贴到地面大图上；只画在地面格和墙的立面（墙下面是地面）上，不画墙顶、不出地图。
   - 磨损：每道楼梯算一次流场（D.flowField），每个门洞（不是裂缝墙的）、每处封死的出口（F.exits，权重 3，以前街上进来的人最多）
     顺着流场走到每道楼梯，逐格累加成人流量 F.wear（Uint16Array），F.wearMax 是最大值。走的时候同样近的几步挑最贴着直线的那步。
     人流量按最大值分 3 级（> 0、≥ 20%、≥ 50%），每格的级数在格子中心之间插值、按 4×4 点阵抖动画一层更亮更光的磨损，边缘自然过渡。
   - 积灰：墙根（四邻有墙）、角落（两邻是墙）、柱子 / 摆设的右下方，从墙边往外 2–3 级色阶渐淡；人流量 ≥ 2 级的格不画。
   - 积水：每层 1–3 个漏水点（水淹 3–5 个），在上面是墙立面的地面格；从漏水点往外随机泛洪长成一片（6–30 格，不进墙、不进摆设格、
     不进人流量最大的那条主路）。深色水面 + 边缘一圈浅色 + 1–2 道高光，边缘按噪声往里收，不是方块；漏水点上方的墙立面画一道往下流的水痕。
     F.leaks = [{ x, y }]、F.pools = [[格号…]]。
   - 历史（F.hist）：
     fire：起火点（历史底子贴花里的第一处烧痕，没有就在大厅 / 房间里抽一格），半径 6–10 格往外熏黑（越近越黑），立面上方画起泡。F.fireAt = { x, y, r }。
     flood：所有立面同一高度一道水渍线（F.waterLine，立面顶往下的像素数，2 倍精度），线下面淡淡一层水渍；墙根多一层泥。
     firefight：P3 的掩体小场景（有 sandbag / roadblock / benchfall 摆设的；一个都没有就用这层交火的小场景）从掩体朝远离楼梯的方向打射线，碰到的第一面墙附近的立面上画 8–20 个弹孔
       （深色小点 + 一圈亮边），掩体旁边多撒两处弹壳贴花（F.decals 里打 wear 标记，重画时先清掉）。F.holes = [{ x, y, n }]。
     purge：沿人流最大的那条路（大厅、走廊里那段）画两道平行的履带印。
   - 线缆和管道：线缆 1–2 束（每束 2–3 根不同颜色的细线，夹子之间往下垂），从配电室（没有就控制室，再没有就大厅一角）门口出发，
     贴着墙走到下站台的楼梯；第二束从同一个门口去控制室 / 出口，两束在配电室门口汇在一起。管道：挑 1–3 段大厅 / 走廊的上墙（≥ 5 格），
     立面上部一根横的圆管（6 级色阶，上亮下暗），隔 3–4 格一个卡箍，两头有法兰。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, T2 = TS * Z, G2 = D.gen2 = D.gen2 || {};
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  const rgb = h => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const C = {
    wear: '#e6dcc6', shine: '#fff6e0',
    dust: ['#16130f', '#241f18', '#332c22'], mud: ['#1a120a', '#2b1e10', '#3b2a16'],
    water: ['#0b1220', '#13203a', '#1f3354'], rim: ['#4a6f9c', '#9cc4ee'],
    soot: ['#060302', '#120906', '#22130b'], scorch: '#3a1e0e', // 审稿修复 M6：熏黑偏焦褐（冷灯下也看得出是烧过的，不是一间暗屋子）
    streak: ['#07080c', '#10131c'], line: ['#0d1220', '#6a7d90'],
    hole: '#060608', holeHi: '#9aa1b0', holeLo: '#3a3d47',
    tread: ['#060609', '#0e0f13', '#1b1d23', '#3a3d47'],
    cable: [['#1d2028', '#0a0b0f'], ['#b8303a', '#5a1218'], ['#d6a22a', '#6a4a0c'], ['#3466c0', '#132a5a'], ['#4a9a48', '#1c4a20']],
    pipe: ['#a3b6dc', '#6f84b3', '#4c5c86', '#34405f', '#232a42', '#161a2a'], clamp: ['#949fb6', '#434b5f', '#1d212c'],
  };
  const RGB = {}; const col = h => typeof h === 'string' ? RGB[h] || (RGB[h] = rgb(h)) : h; // 颜色可以直接给 [r, g, b]
  const pk = (c, a) => ((Math.round(a * 255) << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; // [r, g, b] + 透明度 → 缓冲里的一个像素（小端）
  const A = { dust: C.dust.map(rgb), water: C.water.map(rgb), soot: C.soot.map(rgb), rim: C.rim.map(rgb), scorch: rgb(C.scorch), shine: rgb(C.shine) };

  // 人流量：每道楼梯一张流场，门洞（权重 1）、封死的出口（权重 3）顺着流场走到每道楼梯，逐格累加（只读格子，不用随机数）
  G2.flowWear = function (F) {
    if (F._wf) return F._wf;
    const W = F.tw, H = F.tht, N = W * H, k = F.kind;
    const wear = F.wear = new Uint16Array(N), paths = [];
    const fields = F.stairs.map(s => { const f = D.flowField(F, s.x, s.y); return f && { dist: f.dist, tx: Math.floor(s.x / TS), ty: Math.floor(s.y / TS) }; }).filter(Boolean);
    const walk = (s, fd, w) => {
      const dist = fd.dist; if (dist[s] < 0) return null;
      const path = [s]; let c = s;
      while (dist[c] > 0) {
        const cx = c % W, cy = (c / W) | 0, gx = fd.tx - cx, gy = fd.ty - cy, gl = Math.hypot(gx, gy) || 1;
        let best = -1, bs = -9;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx; if (dist[j] !== dist[c] - 1) continue;
          const sc = (dx * gx + dy * gy) / gl + ((cx + cy + dist[c]) & 1 ? dx : dy) * 1e-3;
          if (sc > bs) { bs = sc; best = j; }
        }
        if (best < 0) break;
        c = best; path.push(c);
      }
      for (const i of path) wear[i] = Math.min(65535, wear[i] + w);
      return { path, w };
    };
    const sources = [];
    for (const d of F.doors || []) { const cs = []; for (let y = d.y; y < d.y + d.h; y++) for (let xx = d.x; xx < d.x + d.w; xx++) cs.push(y * W + xx); const m = cs[cs.length >> 1]; if (k[m] === 0 && !F.solid[m]) sources.push([m, 1]); }
    for (const e of F.exits || []) sources.push([e.fy * W + e.fx, 3]);
    for (const [s, w] of sources) for (const fd of fields) { const p = walk(s, fd, w); if (p) paths.push(p); }
    let wmax = 0; for (let i = 0; i < N; i++) if (wear[i] > wmax) wmax = wear[i];
    F.wearMax = wmax;
    const lv = new Uint8Array(N);
    if (wmax) for (let i = 0; i < N; i++) { const v = wear[i]; lv[i] = !v ? 0 : v >= wmax * 0.5 ? 3 : v >= wmax * 0.2 ? 2 : 1; }
    // 人流量最大的那条路（总人流量最大的一条），只取大厅 / 走廊里的格
    let main = null, ms = -1;
    for (const p of paths) { let s = 0; for (const i of p.path) s += wear[i]; if (s > ms) { ms = s; main = p.path; } }
    return (F._wf = { lv, main, paths });
  };

  G2.paintWear = function (F, x, rw, ex) { // ex：发光层（失火的余烬）
    const W = F.tw, H = F.tht, N = W * H, k = F.kind, W2 = F.w * Z, H2 = F.h * Z;
    if (F.decals) F.decals = F.decals.filter(d => !d.wear); // 重画（指标工具会再 bake 一次）时清掉上次加的
    const reach = G2.reachFromStairs ? G2.reachFromStairs(F) : null;
    const floorC = i => k[i] === 0;
    const faceC = i => k[i] === 1 && i + W < N && k[i + W] === 0;
    // P6（dress.js）：旧骨架楼层按工序表开（F.gen2dress 没写的工序不画）；露天的格（G2.outMask：高架整层、露天房间、露天楼层的走廊）不画积灰、积水、水渍线、横管，整层露天的不拉线缆
    const DR = F.gen2dress || null, on = s => !DR || !!DR[s], OUT = G2.outMask ? G2.outMask(F) : null;
    const outC = i => !!(OUT && OUT[i]), outF = i => !!(OUT && (OUT[i] || (i + W < N && OUT[i + W]))); // outF：墙的立面看下面那格
    const hallK = r => r.kind === 'hall' || r.kind === 'platform' || (DR && G2.roomKind && G2.roomKind(F, r) === 'hall');
    // ── 像素缓冲（P5：一块缓冲反复用，用完只清画过的那块；磨损、积灰按格子图样缓存成小图直接贴，见 wearAtlas / dustAtlas）
    const PB = G2.pixBuf(W2, H2), buf = PB.buf, dirty = PB.dirty, BW = PB.BW, SW = PB.SW, u32 = PB.u32 || (PB.u32 = new Uint32Array(PB.buf.buffer)); // SW：缓冲一行多宽（缓冲只长不缩，比这层宽）
    const opq = PB.opaque; // 审稿修复（提速）：缓冲里已经是这一层的地面（不透明，paintTiles 的 defer），磨损的像素块要混上去，不能直接拷
    const cellAt = (px, py) => ((py / T2) | 0) * W + ((px / T2) | 0);
    const okPx = (px, py, face) => { if (px < 0 || py < 0 || px >= W2 || py >= H2) return false; const i = cellAt(px, py); return floorC(i) || (face && faceC(i)); };
    // 预乘好的整数版（磨损、积灰的像素块、积水）：P = 颜色 × A8 + 128，I = 256 − A8，结果 = (P + 底 × I) >> 8
    const ovr = (j, P, I) => { const d = u32[j]; u32[j] = 0xff000000 | (((P[2] + ((d >>> 16) & 255) * I) >> 8) << 16) | (((P[1] + ((d >>> 8) & 255) * I) >> 8) << 8) | ((P[0] + (d & 255) * I) >> 8); };
    // 不透明的缓冲上"盖上去"：只读写一个打包像素（目标不透明，结果也不透明），比逐通道的混合快
    const blendO = (o, c, a) => { const j = o >> 2, d = u32[j], ia = 1 - a; u32[j] = (0xff000000 | (((c[2] * a + ((d >>> 16) & 255) * ia + 0.5) | 0) << 16) | (((c[1] * a + ((d >>> 8) & 255) * ia + 0.5) | 0) << 8) | ((c[0] * a + (d & 255) * ia + 0.5) | 0)) >>> 0; };
    const blend = opq ? blendO : (o, c, a) => { if (!buf[o + 3]) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = a * 255; return; } const A = buf[o + 3] / 255, oa = a + A * (1 - a), q = A * (1 - a); buf[o] = (c[0] * a + buf[o] * q) / oa; buf[o + 1] = (c[1] * a + buf[o + 1] * q) / oa; buf[o + 2] = (c[2] * a + buf[o + 2] * q) / oa; buf[o + 3] = oa * 255; };
    const box = (px0, py0, px1, py1) => G2.pixMark(PB, px0, py0, px1, py1);
    const put = (px, py, h, a, face) => {
      px |= 0; py |= 0; if (a <= 0 || !okPx(px, py, face)) return;
      blend((py * SW + px) * 4, col(h), a); dirty[(py >> 6) * BW + (px >> 6)] = 1;
    };
    // 已知这一格能画时用：不再查格子，范围按格记
    const putC = (px, py, h, a) => blend((py * SW + px) * 4, col(h), a);
    const tone = (ramp, v, px, py) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length + dith(px, py) - 0.5)))];

    // ── 人流量（G2.flowWear：P5 起地面材质也要用它挑"旧"砖，bake 里先算好挂在 F._wf 上，这里直接用）
    const fw = G2.flowWear(F), wear = F.wear, lv = fw.lv, main = fw.main, paths = fw.paths;
    const hallish = i => { const r = F.room[i]; return r < 0 || F.rooms[r].kind === 'hall' || (DR && (hallK(F.rooms[r]) || outC(i))); };
    const road = new Uint8Array(N); if (main) for (const i of main) road[i] = 1;

    // ── 磨损（级数在格子中心之间双线性插值，抖动）。四个半格各自只看相邻四个格心的级数，抖动点阵 4 像素一循环、半格 16 像素，
    //    所以同样的四个级数画出来的半格一模一样：按（颜色、四个级数、哪个半格）缓存成 16×16 的像素块（wearMasks），直接拷进缓冲
    //    （磨损是这块缓冲里第一个画的，半格之间不重叠，拷和原来逐像素"盖上去"一样）
    const WA = wearMasks(D.mixHex(C.wear, (F.th.floor && F.th.floor[0]) || '#30364f', 0.35));
    const lvP = new Uint8Array(N); // 画的时候往四邻摊开一级（人不会走成一格宽的线）
    for (let i = 0; i < N; i++) { let v = lv[i]; for (const o of [1, -1, W, -W]) { const j = i + o; if (j >= 0 && j < N && lv[j] - 1 > v) v = lv[j] - 1; } lvP[i] = floorC(i) ? v : 0; }
    const lvAt = (cx, cy) => (cx < 0 || cy < 0 || cx >= W || cy >= H) ? 0 : lvP[cy * W + cx];
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const i = cy * W + cx; if (!floorC(i)) continue;
      let any = lvP[i]; for (let b = -1; b <= 1 && !any; b++) for (let a = -1; a <= 1; a++) if (lvAt(cx + a, cy + b)) { any = 1; break; }
      if (!any) continue;
      for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
        const x0 = cx - 1 + qx, y0 = cy - 1 + qy, a00 = lvAt(x0, y0), a10 = lvAt(x0 + 1, y0), a01 = lvAt(x0, y0 + 1), a11 = lvAt(x0 + 1, y0 + 1);
        if (a00 + a10 + a01 + a11 === 0) continue;
        const m = WA(a00, a10, a01, a11, qx, qy); if (!m) continue;
        const ox = cx * T2 + qx * 16, oy = cy * T2 + qy * 16;
        const o0 = oy * SW + ox;
        if (opq) { const { at, pr, pg, pb, ia } = m; for (let q = 0; q < m.n; q++) { const z = at[q], j = o0 + (z >> 4) * SW + (z & 15), d = u32[j], I = ia[q]; u32[j] = 0xff000000 | (((pb[q] + ((d >>> 16) & 255) * I) >> 8) << 16) | (((pg[q] + ((d >>> 8) & 255) * I) >> 8) << 8) | ((pr[q] + (d & 255) * I) >> 8); } }
        else for (let q = 0; q < m.n; q++) { const z = m.at[q]; u32[o0 + (z >> 4) * SW + (z & 15)] = m.v[q]; } // 只拷有颜色的像素
        dirty[(oy >> 6) * BW + (ox >> 6)] = 1;
      }
    }

    // ── 积灰（墙根、角落、摆设右下）：每格的样子只由四边贴着什么（墙 / 摆设 / 没有）决定，按这个缓存成 32×32 的像素块（dustMasks），混进缓冲
    const wallC = i => i < 0 || i >= N || k[i] === 1;
    const propC = i => i >= 0 && i < N && k[i] === 0 && F.solid[i] === 1;
    F.dust = 0;
    if (on('dust')) for (let cy = 1; cy < H - 1; cy++) for (let cx = 1; cx < W - 1; cx++) {
      const i = cy * W + cx; if (!floorC(i) || F.solid[i] || lv[i] >= 2 || outC(i)) continue;
      const t = wallC(i - W) ? 2 : propC(i - W) ? 1 : 0, l = wallC(i - 1) ? 2 : propC(i - 1) ? 1 : 0, r = wallC(i + 1) ? 1 : 0, b = wallC(i + W) ? 1 : 0;
      if (!(t || l || r || b)) continue;
      F.dust++;
      const m = dustMask(t, l, r, b), X0 = cx * T2, Y0 = cy * T2;
      if (opq) { const { at, pr, pg, pb, ia } = m; for (let q = 0; q < m.n; q++) { const o = at[q], j = (Y0 + (o >> 5)) * SW + X0 + (o & 31), d = u32[j], I = ia[q]; u32[j] = 0xff000000 | (((pb[q] + ((d >>> 16) & 255) * I) >> 8) << 16) | (((pg[q] + ((d >>> 8) & 255) * I) >> 8) << 8) | ((pr[q] + (d & 255) * I) >> 8); } }
      else for (let q = 0; q < m.n; q++) { const o = m.at[q], j = (Y0 + (o >> 5)) * SW + X0 + (o & 31); if (!buf[j * 4 + 3]) u32[j] = m.p[q]; else blend(j * 4, m.c[q], m.a[q]); } // 空像素直接写（同"盖到空的上面"）
      dirty[(Y0 >> 6) * BW + (X0 >> 6)] = 1;
    }

    // ── 积水
    const hist = F.hist || [];
    const leaks = F.leaks = [], pools = F.pools = [];
    if (on('leak')) {
      const cand = [];
      for (let i = 2 * W; i < N - W; i++) if (floorC(i) && !F.solid[i] && (!reach || reach[i]) && k[i - W] === 1 && k[i - 2 * W] === 1 && lv[i] < 3 && !road[i] && F.room[i - W] < 0 && !outC(i)) cand.push(i);
      rw.shuffle(cand);
      const n = hist.includes('flood') ? rw.int(3, 5) : rw.int(1, 3);
      for (const i of cand) {
        if (leaks.length >= n) break;
        const x0 = i % W, y0 = (i / W) | 0;
        if (leaks.some(l => Math.max(Math.abs(l.x - x0), Math.abs(l.y - y0)) < 8)) continue;
        const target = rw.int(6, 30), cells = [i], inP = new Set([i]), front = [i];
        while (cells.length < target && front.length) {
          const fi = rw.int(0, front.length - 1), c = front[fi], cx = c % W, cy = (c / W) | 0, nb = [];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue; const j = ny * W + nx; if (!inP.has(j) && floorC(j) && !F.solid[j] && !road[j] && !outC(j)) nb.push(j); }
          if (!nb.length) { front.splice(fi, 1); continue; }
          const j = nb[rw.int(0, nb.length - 1)]; inP.add(j); cells.push(j); front.push(j);
        }
        leaks.push({ x: x0, y: y0 }); pools.push(cells);
        // 水面：边缘按噪声往里收（不是方块），一圈浅色，里面越深越暗
        const ph = rw.range(0, 6.283), ph2 = rw.range(0, 6.283), sX = new Float32Array(W2), cY = new Float32Array(H2);
        for (let q = 0; q < W2; q++) sX[q] = Math.sin(q * 0.13 + ph); for (let q = 0; q < H2; q++) cY[q] = Math.cos(q * 0.17 + ph2);
        const cfgOf = new Map();
        for (const c of cells) {
          const cx = c % W, cy = (c / W) | 0; let cfg = 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy], q) => { if (!inP.has((cy + dy) * W + cx + dx)) cfg |= 1 << q; });
          [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy], q) => { if (!inP.has((cy + dy) * W + cx + dx) && inP.has(cy * W + cx + dx) && inP.has((cy + dy) * W + cx)) cfg |= 16 << q; });
          const E = poolEdge(cfg); cfgOf.set(c, E); // 每个像素离水边多远：只由四邻、四角是不是水决定，按这个缓存（P5 提速；算法同原来）
          box(cx * T2, cy * T2, cx * T2 + T2 - 1, cy * T2 + T2 - 1);
          for (let py = 0, o = 0; py < T2; py++) { const Y = cy * T2 + py, cyv = cY[Y];
            for (let px = 0; px < T2; px++, o++) {
              const e = E[o], X = cx * T2 + px, nz = 2 + 6 * (0.5 + 0.5 * sX[X] * cyv);
              if (e < nz) continue;
              const j = Y * SW + X, empty = !opq && !buf[j * 4 + 3];
              if (e < nz + 1.5) { const r1 = e < nz + 0.8 && dith(X, Y) < 0.5; if (opq) ovr(j, r1 ? WPO.rim1 : WPO.rim0, WPO.Ir); else if (empty) u32[j] = r1 ? WP.rim1 : WP.rim0; else putC(X, Y, r1 ? A.rim[1] : A.rim[0], 0.75); continue; }
              const ti = Math.max(0, Math.min(2, Math.floor(Math.max(0, 0.95 - (e - nz) / 22) * 3 + dith(X, Y) - 0.5)));
              if (opq) ovr(j, WPO.w[ti], WPO.Iw); else if (empty) u32[j] = WP.w[ti]; else putC(X, Y, A.water[ti], 0.86);
            } }
        }
        // 高光：池里一两道横的短线
        for (let h = 0, nh = rw.int(1, 2); h < nh; h++) {
          const c = cells[rw.int(0, cells.length - 1)], X = (c % W) * T2 + rw.int(6, 14), Y = ((c / W) | 0) * T2 + rw.int(8, 22), L = rw.int(6, 12);
          const E = cfgOf.get(c), nzY = cY[Y], wet = X1 => { const e = E[(Y - ((c / W) | 0) * T2) * T2 + X1 - (c % W) * T2]; return e >= 2 + 6 * (0.5 + 0.5 * sX[X1] * nzY) + 1.5; }; // 只画在水面里面（不在水边那圈亮色上，也不出水）
          for (let t = 0; t < L; t++) if (wet(X + t)) put(X + t, Y, t === 0 || t === L - 1 ? C.rim[0] : C.rim[1], 0.8);
        }
        // 水痕：漏水点上方那面墙立面，从裂缝往下流
        const fx0 = x0 * T2 + rw.int(9, 22), fy0 = (y0 - 1) * T2;
        for (let py = fy0 + 3; py < fy0 + T2; py++) {
          const t = (py - fy0) / T2, half = 1 + t * 2.2, wob = Math.round(Math.sin(py * 0.4 + ph) * 0.8);
          for (let px = Math.floor(fx0 - half); px <= fx0 + half; px++) { const dd = Math.abs(px - fx0) / half; if (dith(px, py) < 1 - dd * 0.7) put(px + wob, py, dd < 0.45 ? C.streak[0] : C.streak[1], 0.55 - dd * 0.25, true); }
        }
        for (const [a, b] of [[-2, 3], [-1, 4], [0, 3], [1, 4], [2, 3], [1, 5]]) put(fx0 + a, fy0 + b, '#050507', 0.8, true); // 裂缝
      }
    }

    // ── 历史痕迹
    const facesNear = (cx, cy, r) => { const out = []; for (let y = cy - r; y <= cy + r; y++) for (let xx = cx - r; xx <= cx + r; xx++) { if (xx < 0 || y < 0 || xx >= W || y >= H) continue; const i = y * W + xx; if (faceC(i)) out.push(i); } return out; };
    if (hist.includes('fire')) {
      const sd = (F.decals || []).find(d => d.kind === 'soot' && d.base);
      let oc = sd ? Math.floor(sd.y / TS) * W + Math.floor(sd.x / TS) : -1;
      if (oc < 0 || !floorC(oc)) { const cs = []; for (let i = 0; i < N; i++) if (floorC(i) && F.room[i] >= 0 && (!reach || reach[i])) cs.push(i); oc = cs.length ? cs[rw.int(0, cs.length - 1)] : -1; }
      if (oc >= 0) {
        const R = rw.int(6, 10) + 1, ox = (oc % W) * T2 + 16, oy = ((oc / W) | 0) * T2 + 16, RP = R * T2; // P5：熏黑的范围大一圈（审稿 I2：截图上看不出失火）
        F.fireAt = { x: oc % W, y: (oc / W) | 0, r: R };
        const embers = [], FV = new Float32Array(16), SN13 = new Float32Array(W2), CS13 = new Float32Array(W2), SN05 = new Float32Array(W2), CS05 = new Float32Array(W2);
        for (let q = 0; q < W2; q++) { SN13[q] = Math.sin(q * 0.13); CS13[q] = Math.cos(q * 0.13); SN05[q] = Math.sin(q * 0.05); CS05[q] = Math.cos(q * 0.05); }
        for (let cy = Math.max(0, F.fireAt.y - R - 1); cy <= Math.min(H - 1, F.fireAt.y + R + 1); cy++) for (let cx = Math.max(0, F.fireAt.x - R - 1); cx <= Math.min(W - 1, F.fireAt.x + R + 1); cx++) {
          const ci = cy * W + cx; if (!floorC(ci) && !faceC(ci)) continue;
          box(cx * T2, cy * T2, cx * T2 + T2 - 1, cy * T2 + T2 - 1);
          const isF = floorC(ci);
          for (let py = cy * T2; py < cy * T2 + T2; py++) {
            if (!((py - cy * T2) & 1)) { // 熏黑的浓淡按 2×2 像素算一次（场是平滑的，抖动还是逐像素），P5 提速
              const dy2 = ((py - oy) * 1.15) ** 2, s7 = Math.sin(py * 0.07), c7 = Math.cos(py * 0.07), s21 = Math.sin(py * 0.21), c21 = Math.cos(py * 0.21);
              for (let q = 0; q < 16; q++) { const px = cx * T2 + q * 2, d = Math.sqrt((px - ox) * (px - ox) + dy2) / RP; FV[q] = d >= 1 ? -9 : 1 - d + 0.08 * (SN13[px] * c7 + CS13[px] * s7) + 0.06 * (s21 * CS05[px] - c21 * SN05[px]); } // 同 0.08·sin(0.13x+0.07y) + 0.06·sin(0.21y−0.05x)
            }
            for (let px = cx * T2; px < cx * T2 + T2; px++) {
            const v = FV[(px - cx * T2) >> 1]; if (v === -9) continue;
            if (v < 0.12) { if (v > 0.02 && dith(px, py) < 0.5) putC(px, py, A.scorch, 0.5); continue; } // 外圈一道焦褐的烤痕
            if (dith(px, py) < Math.min(1, v * 1.6)) putC(px, py, tone(A.soot, 1 - Math.min(0.99, v * 1.2), px, py), Math.min(0.94, 0.4 + v * 0.8)); // P5：更黑、更满
            if (v > 0.35 && isF) { const hz = ((Math.imul(px, 73856093) ^ Math.imul(py, 19349663)) >>> 0) % 1000; if (hz < 5 * v) putC(px, py, ASH[hz % 3], 0.6); else if (hz > 996 - 3 * v && v > 0.55) { putC(px, py, ASH[2], 0.85); put(px + 1, py, ASH[1], 0.75); put(px, py + 1, ASH[0], 0.75); if (v > 0.72 && embers.length < 28) embers.push(px, py); } } // 灰烬：黑底上少一点、暗一点的暖色焦渣（审稿修复 M6：以前是浅灰点，冷灯下像星星）；离起火点近的焦块是还没灭透的余烬
          } }
        }
        // 余烬：只在起火点附近，一小块焦炭（暗褐的边、暗橙的芯），发光层里很淡的一点暖光（后期泛光成一小团橙红，冷灯下看得出烧过；不闪、不用随机数）
        for (let q = 0; q < embers.length; q += 2) { const px = embers[q], py = embers[q + 1], hot = ((px * 7 + py * 13) & 3) === 0;
          put(px - 1, py, EMB[0], 0.8); put(px + 1, py, EMB[0], 0.8); put(px, py + 1, EMB[0], 0.8); putC(px, py, EMB[hot ? 2 : 1], 0.95);
          if (ex) { ex.globalAlpha = hot ? 0.32 : 0.2; ex.fillStyle = hot ? '#ff9a40' : '#d0501a'; ex.fillRect(px, py, 1, 1); ex.globalAlpha = 1; } }
        F.embers = embers.length >> 1;
        for (const f of facesNear(oc % W, (oc / W) | 0, R)) { // 起泡；P5：立面上还有一道从墙根往上的黑烟痕（越靠近起火点越高、越黑）
          const fx = (f % W) * T2, fy = ((f / W) | 0) * T2, t = 1 - Math.hypot(fx + 16 - ox, fy + 16 - oy) / RP; if (t < 0.1) continue;
          for (let px = fx; px < fx + T2; px++) { const hgt = T2 * Math.min(1, t * 1.6) * (0.75 + 0.25 * Math.sin(px * 0.31 + fy)); for (let py = fy + T2 - 1; py > fy + T2 - hgt; py--) { const u = (fy + T2 - py) / hgt; if (dith(px, py) < 1 - u * 0.8) put(px, py, u < 0.5 ? '#050404' : '#120e0c', 0.75 * (1 - u * 0.6), true); } }
          if (t < 0.25) continue;
          for (let n = 0, m = 3 + Math.round(t * 6); n < m; n++) {
            const bx = fx + rw.int(3, 28), by = fy + rw.int(5, 16), r = rw.chance(0.3) ? 2 : 1;
            for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (a * a + b * b <= r * r + 0.5) put(bx + a, by + b, a + b < 0 ? '#1a1412' : '#050404', 0.9, true);
            put(bx - r, by - r - 1, '#4a3a30', 0.7, true);
          }
        }
      }
    }
    if (hist.includes('flood') && on('leak')) {
      const wl = F.waterLine = rw.int(12, 18);
      for (let i = 0; i < N; i++) {
        if (!faceC(i) || outF(i)) continue;
        const fx = (i % W) * T2, fy = ((i / W) | 0) * T2;
        for (let px = fx; px < fx + T2; px++) {
          const top = fy + wl + (dith(px, fy) < 0.25 ? 1 : 0);
          put(px, top, C.line[0], 0.7, true); put(px, top + 1, C.line[1], 0.3, true);
          for (let py = top + 2; py < fy + T2 - 5; py++) if (dith(px, py) < 0.45) put(px, py, C.line[0], 0.16, true);
        }
      }
      for (let cy = 1; cy < H - 1; cy++) for (let cx = 1; cx < W - 1; cx++) { // 墙根的泥
        const i = cy * W + cx; if (!floorC(i) || k[i - W] !== 1 || outC(i)) continue;
        for (let py = 0; py < 7; py++) for (let px = 0; px < T2; px++) { const X = cx * T2 + px, Y = cy * T2 + py, v = 1 - py / 7; if (dith(X, Y) < v * 0.9) put(X, Y, tone(C.mud, v, X, Y), 0.45); }
      }
    }
    const holes = F.holes = [];
    if (hist.includes('firefight')) {
      const groups = new Map();
      for (const p of F.props) if (p.vig && (p.kind === 'sandbag' || p.kind === 'roadblock' || p.kind === 'benchfall')) { if (!groups.has(p.vig)) groups.set(p.vig, []); groups.get(p.vig).push(p); }
      const s0 = F.stairs.find(s => s.to === 1) || F.stairs[0] || { x: W * TS / 2, y: H * TS / 2 }, spots = [...groups.values()].map(ps => ({ cx: ps.reduce((t, p) => t + p.x, 0) / ps.length / TS, cy: ps.reduce((t, p) => t + p.y, 0) / ps.length / TS - 0.5 }));
      if (!spots.length && G2.VIGS) { // 没抽到掩体小场景：退到这一层交火的小场景（倒下的旅客、弹壳和血、最后的抵抗）那儿
        const byId = {}; for (const v of G2.VIGS) byId[v.id] = v;
        for (const pv of F.vigs || []) { const v = byId[pv.id]; if (v && (v.hist || []).includes('firefight')) spots.push({ cx: pv.x + v.mw / 2, cy: pv.y + v.mh / 2 }); }
      }
      for (const { cx, cy } of spots.slice(0, 3)) {
        let dx = cx - s0.x / TS, dy = cy - s0.y / TS; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; if (dl < 0.5) { dx = 0; dy = -1; }
        let hit = -1;
        for (let t = 1; t < 40 && hit < 0; t += 0.25) { const hx = Math.floor(cx + dx * t), hy = Math.floor(cy + dy * t); if (hx < 0 || hy < 0 || hx >= W || hy >= H) break; if (k[hy * W + hx] === 1) hit = hy * W + hx; }
        if (hit < 0) continue;
        const fs = facesNear(hit % W, (hit / W) | 0, 3).sort((a, b) => Math.hypot(a % W - hit % W, ((a / W) | 0) - ((hit / W) | 0)) - Math.hypot(b % W - hit % W, ((b / W) | 0) - ((hit / W) | 0)) || a - b);
        if (!fs.length) continue;
        const f0 = fs[0], row = fs.filter(f => ((f / W) | 0) === ((f0 / W) | 0) && Math.abs(f % W - f0 % W) <= 2), n = rw.int(8, 20);
        for (let h = 0; h < n; h++) {
          const f = row[rw.int(0, row.length - 1)], X = (f % W) * T2 + rw.int(2, 28), Y = ((f / W) | 0) * T2 + rw.int(5, 24);
          put(X - 1, Y - 1, C.holeHi, 0.8, true); put(X, Y - 1, C.holeHi, 0.8, true); put(X + 1, Y - 1, C.holeHi, 0.5, true); put(X - 1, Y, C.holeHi, 0.7, true); put(X - 1, Y + 1, C.holeHi, 0.4, true);
          put(X + 2, Y, C.holeLo, 0.8, true); put(X + 2, Y + 1, C.holeLo, 0.8, true); put(X, Y + 2, C.holeLo, 0.8, true); put(X + 1, Y + 2, C.holeLo, 0.8, true);
          put(X, Y, C.hole, 1, true); put(X + 1, Y, C.hole, 1, true); put(X, Y + 1, C.hole, 1, true); put(X + 1, Y + 1, C.hole, 0.9, true);
          if (rw.chance(0.3)) put(X + rw.int(-3, 3), Y + rw.int(2, 4), C.holeLo, 0.6, true);
        }
        holes.push({ x: f0 % W, y: (f0 / W) | 0, n });
        F.decals = F.decals || [];
        for (let m = 0; m < 2; m++) F.decals.push({ x: cx * TS + rw.int(-14, 14), y: cy * TS + rw.int(4, 18), kind: 'shells', r: (rw() * 4294967296) >>> 0, wear: 1 });
      }
    }
    if (hist.includes('purge') && main) { // 两道平行的履带印，沿主路（只画在大厅、走廊）
      const pts = smooth(main.filter((_, q) => q % 4 === 0 || q === main.length - 1).map(i => [(i % W) * T2 + 16, ((i / W) | 0) * T2 + 16]), 3); // 隔 4 格取一个点再圆滑，不画成台阶
      let s = 0;
      for (let q = 1; q < pts.length; q++) {
        const [ax, ay] = pts[q - 1], [bx, by] = pts[q], L = Math.hypot(bx - ax, by - ay); if (!L) continue;
        const nx = -(by - ay) / L, ny = (bx - ax) / L;
        for (let t = 0; t < L; t += 0.5) {
          s += 0.5; const X = ax + (bx - ax) * t / L, Y = ay + (by - ay) * t / L;
          if (!hallish(cellAt(Math.round(X), Math.round(Y)))) continue;
          const link = ((s | 0) % 6) < 3;
          for (const o of [-9, 9]) for (let w = -2; w <= 2; w++) { const px = Math.round(X + nx * (o + w)), py = Math.round(Y + ny * (o + w)); put(px, py, tone(C.tread, link ? 0.85 - (Math.abs(w) === 2 ? 0.3 : 0) : 0.25, px, py), 0.75); }
        }
      }
      F.treads = true;
    }

    // ── 线缆
    const roomOf = kind => F.rooms.find(r => (DR ? G2.roomKind(F, r) : r.kind) === kind && !r.hidden && !r.lock && !outC(r.y * W + r.x) && F.doors.some(d => d.room === r.i && k[d.y * W + d.x] === 0));
    const doorOf = r => { const d = F.doors.find(d => d.room === r.i && k[d.y * W + d.x] === 0); return d.y * W + d.x; };
    const pw = roomOf('power'), ct = roomOf('control'), src = pw || ct, sp = F.stairs.find(s => s.to === 1) || F.stairs[0], spC = sp ? Math.floor(sp.y / TS) * W + Math.floor(sp.x / TS) : -1; // 审稿 M9：没有楼梯也不出错（没有线缆）
    let start = !on('cable') || (OUT && OUT.all) ? -2 : src && sp ? doorOf(src) : -1;
    if (start === -1) { const h = F.rooms.find(r => hallK(r) && !(G2.outRoom && G2.outRoom(F, r))) || (DR ? F.rooms.filter(r => !r.hidden && !(G2.outRoom && G2.outRoom(F, r))).sort((a, b) => (b.cells || 0) - (a.cells || 0))[0] : null); /* P6：旧骨架楼层没有大厅类房间就从最大的室内房间出发 */ if (h) for (let y = h.y; y < h.y + h.h && start < 0; y++) for (let xx = h.x; xx < h.x + h.w; xx++) { const i = y * W + xx; if (floorC(i) && !F.solid[i]) { start = i; break; } } }
    const route = (a, goal) => { // 贴墙走：四邻有墙的格代价 1，其余 3（摆设格能穿过，线缆从底下走）；代价是小整数，分桶走
      const dist = new Int32Array(N).fill(1 << 30), prev = new Int32Array(N).fill(-1), B = [[a]]; dist[a] = 0;
      for (let d = 0; d < B.length; d++) {
        const L = B[d]; if (!L) continue;
        for (const c of L) {
          if (dist[c] !== d) continue;
          if (c === goal) { const p = []; for (let q = goal; q >= 0; q = prev[q]) p.push(q); return p.reverse(); }
          const cx = c % W, cy = (c / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
            const j = ny * W + nx; if (k[j] !== 0) continue;
            const nd = d + (k[j - W] === 1 || k[j + W] === 1 || k[j - 1] === 1 || k[j + 1] === 1 ? 1 : 3);
            if (nd < dist[j]) { dist[j] = nd; prev[j] = c; (B[nd] || (B[nd] = [])).push(j); }
          }
        }
      }
      return null;
    };
    const bundles = [];
    if (start >= 0) {
      const r1 = route(start, spC); if (r1) bundles.push(r1);
      const g2 = src === pw && ct ? doorOf(ct) : (F.exits && F.exits[0] ? F.exits[0].fy * W + F.exits[0].fx : -1);
      if (g2 >= 0 && rw.chance(0.6)) { const r2 = route(start, g2); if (r2) bundles.push(r2); }
    }
    F.cables = bundles.length;
    bundles.forEach((path, bi) => {
      const pts = smooth(path.map(i => { // 每格往贴着的那面墙偏 11 像素
        const cx = i % W, cy = (i / W) | 0; let ox = 0, oy = 0;
        if (k[i - W] === 1) oy = -11; else if (k[i - 1] === 1) ox = -11; else if (k[i + 1] === 1) ox = 11; else if (k[i + W] === 1) oy = 11;
        return [cx * T2 + 16 + ox, cy * T2 + 16 + oy];
      }), 2);
      const n = rw.int(2, 3), cols = rw.shuffle(C.cable.slice()).slice(0, n);
      let s = 0;
      for (let q = 1; q < pts.length; q++) {
        const [ax, ay] = pts[q - 1], [bx, by] = pts[q], L = Math.hypot(bx - ax, by - ay); if (!L) continue;
        const nx = -(by - ay) / L, ny = (bx - ax) / L;
        for (let t = 0; t < L; t += 0.5) {
          s += 0.5; const X = ax + (bx - ax) * t / L, Y = ay + (by - ay) * t / L, seg = (s % 40) / 40, sag = Math.sin(Math.PI * seg) * 2.5;
          for (let c = 0; c < n; c++) {
            const o = (c - (n - 1) / 2) * 2 + bi * 0.5, px = Math.round(X + nx * o), py = Math.round(Y + ny * o + sag * (0.6 + c * 0.25));
            put(px, py, cols[c][0], 0.95); put(px, py + 1, cols[c][1], 0.8);
          }
          if (s % 40 < 0.5) for (let a = -2; a <= 2; a++) { put(Math.round(X + nx * a), Math.round(Y + ny * a), C.clamp[1], 1); put(Math.round(X + nx * a), Math.round(Y + ny * a) - 1, C.clamp[0], 0.8); } // 夹子
        }
      }
    });

    // ── 管道：上墙立面的上部，一根横的圆管
    {
      const runs = [];
      for (let y = 1; y < H - 1; y++) {
        let run = [];
        for (let xx = 0; xx <= W; xx++) {
          const i = y * W + xx;
          if (on('pipe') && xx < W && faceC(i) && k[i - W] === 1 && hallish(i + W) && !outF(i) && !(F.exits || []).some(e => xx >= e.x - 1 && xx <= e.x + e.w && y >= e.y - 1 && y <= e.y + e.h)) { run.push(i); continue; }
          if (run.length >= 5) runs.push(run);
          run = [];
        }
      }
      runs.sort((a, b) => b.length - a.length || a[0] - b[0]);
      const pick = runs.slice(0, Math.min(runs.length, rw.int(1, 3)));
      for (const run of pick) {
        const x0 = (run[0] % W) * T2 + 2, x1 = (run[run.length - 1] % W) * T2 + T2 - 3, y0 = ((run[0] / W) | 0) * T2 + 5 + rw.int(0, 2);
        for (let px = x0; px <= x1; px++) for (let j = 0; j < 6; j++) put(px, y0 + j, C.pipe[j], 1, true);
        for (let px = x0; px <= x1; px += 4) if (dith(px, y0) < 0.5) put(px, y0 + 1, C.pipe[0], 0.6, true); // 高光一点点断开，像金属反光
        const clampAt = px => { for (let j = -1; j < 7; j++) { put(px, y0 + j, C.clamp[0], 1, true); put(px + 1, y0 + j, C.clamp[1], 1, true); put(px + 2, y0 + j, C.clamp[2], 1, true); } };
        for (let px = x0 + 10, step = rw.int(3, 4) * T2; px < x1 - 6; px += step) clampAt(px);
        for (const px of [x0, x1 - 2]) clampAt(px); // 两头的法兰
      }
    }

    // ── 贴到地面大图：不在这里贴，bake 在贴花画完以后一次贴（G2.pixFlush）
    return F;
  };
  // 磨损半格的像素块：每种颜色一张表，(四个级数, 半格) 第一次用到时算（和原来逐像素的算法、混合一样）；全透明的记 null
  const WEAR_AT = new Map();
  function wearMasks(hex) {
    let A = WEAR_AT.get(hex); if (A) return A;
    const tint = rgb(hex), done = new Array(1024);
    const bl = (px, o, cc, a) => { if (!px[o + 3]) { px[o] = cc[0]; px[o + 1] = cc[1]; px[o + 2] = cc[2]; px[o + 3] = a * 255; return; } const A0 = px[o + 3] / 255, oa = a + A0 * (1 - a), q = A0 * (1 - a); px[o] = (cc[0] * a + px[o] * q) / oa; px[o + 1] = (cc[1] * a + px[o + 1] * q) / oa; px[o + 2] = (cc[2] * a + px[o + 2] * q) / oa; px[o + 3] = oa * 255; };
    A = (a00, a10, a01, a11, qx, qy) => {
      const id = ((((a00 * 4 + a10) * 4 + a01) * 4 + a11) * 2 + qx) * 2 + qy;
      if (done[id] !== undefined) return done[id];
      const px = new Uint8ClampedArray(16 * 16 * 4); let any = false;
      for (let j = 0; j < 16; j++) { const ty = (qy * 16 + j + 0.5) / T2 + 0.5 - qy;
        for (let i = 0; i < 16; i++) { const tx = (qx * 16 + i + 0.5) / T2 + 0.5 - qx;
          const v = (a00 * (1 - tx) + a10 * tx) * (1 - ty) + (a01 * (1 - tx) + a11 * tx) * ty;
          if (v < 0.35) continue;
          const t = v / 3, d = dith(i, j), o = (j * 16 + i) * 4;
          if (d < t * 1.1) { bl(px, o, tint, 0.13 + 0.32 * t); any = true; } // P5：比 P4 亮一些（打了灯以后暗的大厅里也看得出走旧的路）
          if (t > 0.6 && d < 0.14) { bl(px, o, A_SHINE, 0.45); any = true; }
        } }
      if (!any) return (done[id] = null);
      const u = new Uint32Array(px.buffer), at = [], v = [], c = [], a = []; for (let q = 0; q < 256; q++) if (u[q]) { at.push(q); v.push(u[q]); c.push([px[q * 4], px[q * 4 + 1], px[q * 4 + 2]]); a.push(px[q * 4 + 3] / 255); }
      return (done[id] = Object.assign({ n: at.length, at: Uint16Array.from(at), v: Uint32Array.from(v) }, premul(c, a)));
    };
    WEAR_AT.set(hex, A); return A;
  }
  // 积灰一格：上（2 墙 / 1 摆设 / 0）、左（同）、右（1 墙）、下（1 墙）四边的组合，36 种；只存有颜色的像素（格内位置、颜色、透明度）
  const DUST_M = [];
  function dustMask(t, l, r, b) {
    const id = ((t * 3 + l) * 2 + r) * 2 + b; if (DUST_M[id]) return DUST_M[id];
    const dv = new Float32Array(T2 * T2), dust = C.dust.map(rgb);
    const tone = (ramp, v, px, py) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length + dith(px, py) - 0.5)))];
    const sides = [[0, -1, t === 2 ? 1 : t ? 0.6 : 0], [-1, 0, l === 2 ? 1 : l ? 0.6 : 0], [1, 0, r ? 0.8 : 0], [0, 1, b ? 0.5 : 0]].filter(s => s[2]);
    const corner = sides.length >= 2 ? 1.35 : 1;
    for (const [dx, dy, sv] of sides) for (let dd = 0; dd < 11; dd++) { // 每面墙只扫贴着它的 11 像素宽一条
      const e = 1 - dd / 11, v = e * e * sv * corner;
      for (let q = 0; q < T2; q++) { const px = dx ? (dx < 0 ? dd : T2 - 1 - dd) : q, py = dx ? q : (dy < 0 ? dd : T2 - 1 - dd), o = py * T2 + px; if (v > dv[o]) dv[o] = v; }
    }
    const at = [], c = [], a = [];
    for (let o = 0; o < T2 * T2; o++) {
      const v = dv[o]; if (v <= 0.05) continue;
      const X = o & 31, Y = o >> 5;
      if (dith(X, Y) < v) { at.push(o); c.push(tone(dust, Math.min(0.99, v), X, Y)); a.push(0.32 + 0.25 * Math.min(1, v)); }
    }
    return (DUST_M[id] = Object.assign({ n: at.length, at, c, a, p: c.map((cc, q) => pk(cc, a[q])) }, premul(c, a)));
  }
  const POOL_E = [];
  function poolEdge(cfg) {
    if (POOL_E[cfg]) return POOL_E[cfg];
    const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((_, q) => cfg & (1 << q)), diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]].filter((_, q) => cfg & (16 << q)), E = new Float32Array(T2 * T2);
    for (let py = 0, o = 0; py < T2; py++) for (let px = 0; px < T2; px++, o++) {
      let e = 99, ex = 99, ey = 99;
      for (const [dx, dy] of out) { const dd = dx ? (dx > 0 ? T2 - 1 - px : px) : (dy > 0 ? T2 - 1 - py : py); e = Math.min(e, dd); if (dx) ex = Math.min(ex, dd); else ey = Math.min(ey, dd); }
      if (ex < 14 && ey < 14) e = Math.min(e, 14 - Math.hypot(14 - ex, 14 - ey)); // 凸角磨圆
      for (const [dx, dy] of diag) e = Math.min(e, Math.hypot(dx > 0 ? T2 - 1 - px : px, dy > 0 ? T2 - 1 - py : py));
      E[o] = e;
    }
    return (POOL_E[cfg] = E);
  }
  const A_SHINE = rgb(C.shine), ASH = ['#24140c', '#3a2012', '#56301a'].map(rgb), EMB = ['#2a1006', '#8a3410', '#c8601c'].map(rgb);
  const WP = { rim0: pk(rgb(C.rim[0]), 0.75), rim1: pk(rgb(C.rim[1]), 0.75), w: C.water.map(h => pk(rgb(h), 0.86)) };
  // 预乘：颜色 [r, g, b] × 透明度 → 整数（见 paintWear 里的 ovr）
  const A8 = a => Math.round(a * 256), pre = (c, a) => [c[0] * A8(a) + 128, c[1] * A8(a) + 128, c[2] * A8(a) + 128];
  function premul(c, a) { const n = c.length, pr = new Int32Array(n), pg = new Int32Array(n), pb = new Int32Array(n), ia = new Int32Array(n); for (let q = 0; q < n; q++) { const k = A8(a[q]); pr[q] = c[q][0] * k + 128; pg[q] = c[q][1] * k + 128; pb[q] = c[q][2] * k + 128; ia[q] = 256 - k; } return { pr, pg, pb, ia }; }
  const WPO = { rim0: pre(rgb(C.rim[0]), 0.75), rim1: pre(rgb(C.rim[1]), 0.75), Ir: 256 - A8(0.75), w: C.water.map(h => pre(rgb(h), 0.86)), Iw: 256 - A8(0.86) };
  // 折线圆滑（Chaikin）
  function smooth(pts, it) {
    for (let n = 0; n < it; n++) {
      if (pts.length < 3) return pts;
      const o = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); }
      o.push(pts[pts.length - 1]); pts = o;
    }
    return pts;
  }
})(D);
