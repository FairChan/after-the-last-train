// 站内地图指标 D.genMetrics(F)：量一张生成好的站内楼层，给第二代生成器（P0–P7）和老生成器做对比。
// 设计文档：design/features/station-gen
// 起点：楼梯 stairs[0] 所在的那一格；那格走不通就找切比雪夫半径 3 以内最近的能走的格（半径从小到大、每圈从上到下从左到右扫）；
//   找不到就算这层没有起点：noStart = true，算进统计的房间全记成走不到，genSample 的步数平均不算这样的样本（另报个数）。
// 大厅类房间（kind 是 hall / atrium / platform）还算区域图里的点，但不进死胡同、死胡同占比、步数和走不到的统计（counted 是剩下的房间数）。
// 环路 loops = 洞的个数：硬格（kind 1 墙、kind 2 轨道；摆设 solid 1 kind 0 和裂缝墙 kind 3 都不算）按八连通分块，
//   不碰地图边、面积不小于 6 格、且挨着一格从起点走得到的格，这样的一块就是一条能绕的路。
// 死胡同：一间房和别的区域（房间或走廊块）相接的地方按"接触段"数：本房能走的格里挨着同一个邻居能走的格的那些格，四连通成一段算一段；
//   各邻居的段数加起来是这间房的度，度正好是 1 的就是死胡同。
// 房间形状 fill 数的是标成这间房的格子（包括房里实心的格），量的是外形，房里有块实心不算不规则。
// 通道宽 corrWidth 只统计脊线格（走廊里 d 不小于所有走廊邻格的格子），宽走廊才量得出宽。
// 输入 F 只用：tw, tht, solid, kind, room, rooms[{x,y,w,h,i,kind}], props[{x,y,w}], stairs[{x,y}], contSpots, spawns
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const T = 16;
  const HALL_KINDS = { hall: 1, atrium: 1, platform: 1 };

  function median(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
  function maxOf(a) { let m = 0; for (const v of a) if (v > m) m = v; return m; }

  D.genMetrics = function (F) {
    const W = F.tw, H = F.tht, N = W * H, solid = F.solid, kind = F.kind, room = F.room;
    const walk = new Uint8Array(N);
    for (let i = 0; i < N; i++) walk[i] = (solid[i] === 0 || kind[i] === 3) ? 1 : 0; // 裂缝墙算通
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // 区域图：房间 / 走廊块各一个点
    const rooms = F.rooms || [], R = rooms.length;
    const counted = rooms.map(r => !HALL_KINDS[r.kind]), nCounted = counted.filter(Boolean).length;
    const roomNode = new Map(); rooms.forEach((r, k) => roomNode.set(r.i, k));
    const node = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (room[i] >= 0 && roomNode.has(room[i])) node[i] = roomNode.get(room[i]);
    let nodes = R;
    for (let i = 0; i < N; i++) {
      if (node[i] >= 0 || !walk[i] || room[i] >= 0) continue;
      const q = [i]; node[i] = nodes;
      while (q.length) {
        const c = q.pop(), cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of nb) {
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = y * W + x; if (node[j] >= 0 || !walk[j] || room[j] >= 0) continue;
          node[j] = nodes; q.push(j);
        }
      }
      nodes++;
    }

    // 死胡同：每间房按邻居分组，挨着邻居的本房格四连通成段，段数之和是度
    const contact = new Map(); // key = 房 * nodes + 邻居 -> 本房的接触格
    for (let i = 0; i < N; i++) {
      const k = node[i]; if (k < 0 || k >= R || !walk[i]) continue;
      const cx = i % W, cy = (i / W) | 0, seen = [];
      for (const [dx, dy] of nb) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x, n = node[j]; if (n < 0 || n === k || !walk[j] || seen.includes(n)) continue;
        seen.push(n); const key = k * nodes + n;
        if (!contact.has(key)) contact.set(key, []); contact.get(key).push(i);
      }
    }
    const deg = new Int32Array(R);
    for (const [key, cells] of contact) {
      const k = Math.floor(key / nodes), left = new Set(cells);
      for (const c0 of cells) {
        if (!left.has(c0)) continue;
        deg[k]++; left.delete(c0); const q = [c0];
        while (q.length) {
          const c = q.pop(), cx = c % W, cy = (c / W) | 0;
          for (const [dx, dy] of nb) {
            const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const j = y * W + x; if (left.has(j)) { left.delete(j); q.push(j); }
          }
        }
      }
    }
    let deadEnds = 0; for (let k = 0; k < R; k++) if (counted[k] && deg[k] === 1) deadEnds++;

    // 起点：楼梯那一格，走不通就找半径 3 以内最近能走的格
    const dist = new Int32Array(N).fill(-1), st = F.stairs && F.stairs[0];
    let start = -1;
    if (st) {
      const sx = Math.floor(st.x / T), sy = Math.floor(st.y / T);
      const okAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && walk[y * W + x];
      if (okAt(sx, sy)) start = sy * W + sx;
      for (let rr = 1; rr <= 3 && start < 0; rr++)
        for (let dy = -rr; dy <= rr && start < 0; dy++)
          for (let dx = -rr; dx <= rr; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr || !okAt(sx + dx, sy + dy)) continue;
            start = (sy + dy) * W + sx + dx; break;
          }
    }
    const noStart = start < 0;
    if (!noStart) {
      const q = [start]; dist[start] = 0;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of nb) {
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = y * W + x; if (dist[j] >= 0 || !walk[j]) continue;
          dist[j] = dist[c] + 1; q.push(j);
        }
      }
    }
    // 步数：每间算进统计的房取最近一格
    const best = new Array(R).fill(-1);
    for (let i = 0; i < N; i++) { const k = node[i]; if (k >= 0 && k < R && dist[i] >= 0 && (best[k] < 0 || dist[i] < best[k])) best[k] = dist[i]; }
    const steps = best.filter((v, k) => counted[k] && v >= 0), unreachable = nCounted - steps.length;

    // 环路：不碰边、面积 ≥ 6、挨着走得到的格的硬格块（八连通）各算一个洞
    const hard = new Uint8Array(N), hseen = new Uint8Array(N);
    for (let i = 0; i < N; i++) hard[i] = (kind[i] === 1 || kind[i] === 2) ? 1 : 0;
    let loops = 0;
    for (let i0 = 0; i0 < N; i0++) {
      if (!hard[i0] || hseen[i0]) continue;
      let area = 0, border = false, touch = false; const q = [i0]; hseen[i0] = 1;
      while (q.length) {
        const c = q.pop(), cx = c % W, cy = (c / W) | 0; area++;
        if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) border = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = y * W + x;
          if (hard[j]) { if (!hseen[j]) { hseen[j] = 1; q.push(j); } }
          else if ((!dx || !dy) && dist[j] >= 0) touch = true;
        }
      }
      if (!border && area >= 6 && touch) loops++;
    }

    // 房间形状
    let fillSum = 0, nonRect = 0;
    const cnt = new Array(R).fill(0);
    for (let i = 0; i < N; i++) if (node[i] >= 0 && node[i] < R) cnt[node[i]]++;
    rooms.forEach((r, k) => { const f = cnt[k] / (r.w * r.h); fillSum += f; if (f < 0.95) nonRect++; });

    // 摆设靠墙
    const isProp = i => solid[i] === 1 && kind[i] === 0, isWall = i => kind[i] === 1 && !isProp(i);
    const props = F.props || []; let wallProps = 0;
    for (const p of props) {
      const tx0 = Math.floor((p.x - p.w / 2) / T), ty = Math.round(p.y / T) - 1, n = Math.max(1, Math.round(p.w / T));
      const cells = [[tx0 - 1, ty], [tx0 + n, ty]];
      for (let t = tx0; t < tx0 + n; t++) cells.push([t, ty - 1], [t, ty + 1]);
      let hit = false;
      for (const [x, y] of cells) if (x >= 0 && y >= 0 && x < W && y < H && isWall(y * W + x)) { hit = true; break; }
      if (hit) wallProps++;
    }

    // 通道宽：走廊格到最近走不通格的四连通距离 d，宽 = 2d − 1，只在脊线格取（d 不小于所有走廊邻格的 d），否则宽走廊的边上格会把中位数拉到 1
    const dw = new Int32Array(N).fill(-1), q2 = [];
    for (let i = 0; i < N; i++) if (!walk[i]) { dw[i] = 0; q2.push(i); }
    for (let h = 0; h < q2.length; h++) {
      const c = q2[h], cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of nb) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x; if (dw[j] >= 0) continue; dw[j] = dw[c] + 1; q2.push(j);
      }
    }
    const cw = [];
    for (let i = 0; i < N; i++) {
      if (!walk[i] || room[i] >= 0 || dw[i] <= 0) continue;
      const cx = i % W, cy = (i / W) | 0; let ridge = true;
      for (const [dx, dy] of nb) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x; if (walk[j] && room[j] < 0 && dw[j] > dw[i]) { ridge = false; break; }
      }
      if (ridge) cw.push(2 * dw[i] - 1); // 只在脊线格（d 不小于走廊邻格的 d）取宽，边上的格不算
    }

    return {
      rooms: R, counted: nCounted, noStart, unreachable, deadEnds, deadEndRatio: nCounted ? deadEnds / nCounted : 0, loops,
      steps: { median: median(steps), max: maxOf(steps) },
      fillMean: R ? fillSum / R : 0, nonRect,
      props: props.length, wallProps, wallPropRatio: props.length ? wallProps / props.length : 0,
      corrWidth: { median: median(cw), max: maxOf(cw) },
      cont: (F.contSpots || []).length, spawns: (F.spawns || []).length,
    };
  };
  // Batch sampling per layout: D.genSample({ layouts?, per?, tag?, floors?, warm? }) -> { tag, per, noStart, layouts:{lay:{n,noStart,floor0,enemies,containers,genMs,bakeMs,floors?}}, all }
  // floors: 'all'（P6）= 每个样本的每一层都量 D.genMetrics，按楼层名分组平均进 layouts[lay].floors[楼层名]（多一个 n、noStart）；
  //   这时单数号样本按换乘站建（opt.inter），换乘层也量得到。不给 floors 的时候和以前完全一样。
  // noStart = 楼梯附近找不到起点的样本数，这些样本不进步数平均（全都没起点时步数是 null）。
  // genMs = 整个 makeStation（所有楼层、decorate、stationMod、各层 bake）；bakeMs = 站厅层再 bake 一次（第二次，热的）。
  // 注意：每个样本都会真的进一次站，再走 G.finish(false) 判死亡，这会剥掉装备并存档；只有 raids/wins/deaths 计数和各骨架的 layouts 会还原。所以只能在一次性的新档（newGame）上跑。
  // 结构用带种子的随机数，真实进站也传了固定种子，所以结果是确定的。
  // P7 任务 2：楼层按"楼层名去掉 ' · ' 前面那段"分组（楼上大厦的大堂 / 办公层前面带着大厦名，以前每座大厦一组、一组一两个样本，比出来全是随机数；环境的地面层前缀在一种骨架里都一样，去不去都一组）
  D.genFloorKey = nm => { const i = String(nm).lastIndexOf(' · '); return i >= 0 ? String(nm).slice(i + 3) : String(nm); };
  D.genSample = function (opts) {
    opts = opts || {};
    const G = D.Game, tag = opts.tag || 'p0', per = opts.per || 8, lays = opts.layouts || Object.keys(D.LAYOUTS), allF = opts.floors === 'all';
    if (!G.pf || !G.pf.city) G.newGame('LANCHUAN');
    const pf = G.pf, C = pf.city;
    const sts = C.stations.filter(s => !s.dead && !s.home && !s.hidden && !D.STATION_TYPES[s.type].safe && s.type !== 'event');
    const r3 = v => Math.round(v * 1000) / 1000;
    const flat = m => ({ rooms: m.rooms, counted: m.counted, unreachable: m.unreachable, deadEnds: m.deadEnds, deadEndRatio: m.deadEndRatio, loops: m.loops, stepsMedian: m.steps.median, stepsMax: m.steps.max, fillMean: m.fillMean, nonRect: m.nonRect, props: m.props, wallProps: m.wallProps, wallPropRatio: m.wallPropRatio, corrWidthMedian: m.corrWidth.median, corrWidthMax: m.corrWidth.max, cont: m.cont, spawns: m.spawns });
    const unflat = a => ({ rooms: a.rooms, counted: a.counted, unreachable: a.unreachable, deadEnds: a.deadEnds, deadEndRatio: a.deadEndRatio, loops: a.loops, steps: { median: a.stepsMedian, max: a.stepsMax }, fillMean: a.fillMean, nonRect: a.nonRect, props: a.props, wallProps: a.wallProps, wallPropRatio: a.wallPropRatio, corrWidth: { median: a.corrWidthMedian, max: a.corrWidthMax }, cont: a.cont, spawns: a.spawns });
    const avg = rows => {
      const o = {}; for (const k of Object.keys(rows[0])) o[k] = r3(rows.reduce((t, r) => t + r[k], 0) / rows.length);
      const ok = rows.filter(r => !r.noStart); // 没起点的样本不进步数平均
      for (const k of ['stepsMedian', 'stepsMax']) o[k] = ok.length ? r3(ok.reduce((t, r) => t + r[k], 0) / ok.length) : null;
      delete o.noStart; return o;
    };
    const saved = { raids: pf.raids, wins: pf.wins, deaths: pf.deaths };
    const out = { tag, per, noStart: 0, layouts: {}, all: null }, everyRow = [];
    // warm（P4/P5 审稿修复）：正式取样前每种骨架先不计时地生成 warm 站（JIT、各种图的缓存先热起来），不然排在第一的骨架把冷启动全算进去；默认 0 = 和以前一样
    //   热身走和取样一样的整套（建站、量指标、再 bake、真的进站再判死亡），只是不计时、不记数
    for (let w = 0; w < (opts.warm || 0); w++) for (const lay of lays) { const st = sts[(w * 7 + lay.length * 3) % sts.length], old = st.layout; st.layout = lay;
      try { const fl = D.makeStation(D.rng(tag + ':warm:' + lay + ':' + w), st, { exit: false, safe: false, inter: allF ? w % 2 === 1 : false, tut: false }); for (const F of fl) D.genMetrics(F); D.LV.bake(fl[0], D.rng('b'));
        G.depart(C.home); G.raid.at = st.id; G.enter({ seed: tag + ':warm-enter:' + lay + ':' + w }); G.finish(false); } finally { st.layout = old; } }
    if (opts.warm) out.warm = opts.warm;
    try {
      for (const lay of lays) {
        const rows = [], en = [], co = [], gm = [], bm = [], byF = {};
        for (let k = 0; k < per; k++) {
          const st = sts[(k * 11 + lay.length * 5) % sts.length], old = st.layout;
          st.layout = lay;
          try {
            const t0 = performance.now();
            const fl = D.makeStation(D.rng(tag + ':' + lay + ':' + k), st, { exit: false, safe: false, inter: allF ? k % 2 === 1 : false, tut: false });
            const t1 = performance.now();
            const m = D.genMetrics(fl[0]); rows.push(Object.assign(flat(m), { noStart: m.noStart ? 1 : 0 }));
            if (allF) for (const F of fl) { const mf = D.genMetrics(F), fk = D.genFloorKey(F.name); (byF[fk] = byF[fk] || []).push(Object.assign(flat(mf), { noStart: mf.noStart ? 1 : 0 })); }
            const t2 = performance.now();
            D.LV.bake(fl[0], D.rng('b'));
            const t3 = performance.now();
            gm.push(t1 - t0); bm.push(t3 - t2);
            G.depart(C.home); G.raid.at = st.id; G.enter({ seed: tag + ':enter:' + lay + ':' + k });
            en.push(G.S.enemies.length); co.push(G.S.floors.reduce((t, F) => t + F.contSpots.length, 0));
            G.finish(false);
          } finally { st.layout = old; }
        }
        const mean = a => r3(a.reduce((t, v) => t + v, 0) / a.length);
        const f0 = avg(rows);
        const ns = rows.filter(r => r.noStart).length; out.noStart += ns;
        out.layouts[lay] = { n: per, noStart: ns, floor0: unflat(f0), enemies: mean(en), containers: mean(co), genMs: mean(gm), bakeMs: mean(bm) };
        if (allF) { out.layouts[lay].floors = {}; for (const nm of Object.keys(byF)) out.layouts[lay].floors[nm] = Object.assign(unflat(avg(byF[nm])), { n: byF[nm].length, noStart: byF[nm].filter(r => r.noStart).length }); }
        for (const r of rows) everyRow.push(r);
      }
    } finally { pf.raids = saved.raids; pf.wins = saved.wins; pf.deaths = saved.deaths; }
    out.all = everyRow.length ? unflat(avg(everyRow)) : null;
    return out;
  };
})(D);
