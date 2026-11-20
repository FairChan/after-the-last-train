/* 站内地图第二代 P4 · 封死的出口 + 导向牌（design/features/station-gen/plan-p4.md 任务 1；设计文档 5.1、5.5 节）
   D.gen2.planWayfinding(F, wr)：level.js 的 bake 在地面、墙画完后调（只对 F.gen2 楼层），只读格子，算出：
     F.exits = [{ x, y, w, h, kind, face, fx, fy }]：1–2 处封死的出口（格坐标）。kind：shutter 卷帘门 / collapse 塌方 / sandbag 沙袋墙 / grate 焊死的铁栅；
       face：地面在出口的哪边（s 下面 = 墙的立面，e / w 侧墙，n 上面）；fx, fy：出口正中前面那格地面（导向牌、磨损路线的目标）。
       只占原本就是墙的格（墙后面也是墙），只改画法，不改 solid / kind / room。前面那格是从楼梯走得到的空地面。
       挑法：先挑离地图边 ≤ 3 格的（立面优先，其次侧墙、底墙），没有再放宽到"往外一直是墙到地图边"的外墙，最后任意墙；
       同一档里前面是大厅 / 走廊的权重 ×4。第二处离第一处 ≥ 10 格。历史有 barricade 偏沙袋、有 fire 或塌方骨架偏塌方。
     F.wayfind = [{ tx, ty, kind, dir }]：牌子挂在"上墙"（这格是墙、正上方还是墙、正下方是从楼梯走得到的空地面）；一块牌子上有几种目标就有几项（同一个 tx, ty）。
       kind：platform 站台（下到站台层的楼梯）、exit 出口（最近的 F.exits）、transfer 换乘（F.inter 才有，同样指下站台的楼梯）。
       dir = [dx, dy]（各 −1 / 0 / 1）；[0, 0] = 就在这里（到目标 ≤ 3 步，只画图标）。
       方向：每种目标用 D.flowField 算一次整张图（出口每处一次、取最小）。从牌子正下方那格往目标走 k = min(6, 步数) 步，
       所有最短路的终点都算上：挑和每个终点（相对起点的正负号）点积都 > 0、和平均位移夹角最小的那个方向；挑不出来（两边一样近）这块牌子就不写这种目标。
       放哪：闸机标志先占；每个门洞（不是裂缝墙的）旁边 2 格内一块（前面是大厅 / 走廊的优先）；大厅每段上墙隔 10–14 格一块；走廊拐角一块；
       牌子之间至少隔 2 格；牌子的那一面被摆设 / 容器 / 楼梯的图挡住就跳过；原来的霓虹招牌格不挂。站台牌不到 4 块、出口牌不到 2 块再补。
     F.gateSigns = [{ tx, ty, side, hang }]：闸机排正上方两排以内那面墙上一块"进站 / 出站"：side 一侧（楼梯那边）绿色向下箭头 + 列车，另一侧红叉；
       两排以内没有墙的（新画法楼层）hang = 1：吊在闸机排正上方那格（ty = 闸机排上面一排的地面），fore.js 当前景物画（审稿修复 M2、M3）。
   D.gen2.paintWayfinding(F, x, ex, wr)：画出口（D.Paint 色阶、明暗）、牌子（底板色阶，图标和箭头进发光层），
     返回这些牌子 [{ x, y, col, nolight }]，level.js 在原来的招牌灯之后加进 F.signs、加灯（灯的种子用 wr，不动父流；nolight 的只占位，lightfx 不在出口上挂灯具）。
   P6：站台层、换乘层、设备层（F.g2floor）没有封死的出口；牌子的目标换成"出口"（上楼的楼梯）和"换乘"（站台层下到换乘层的楼梯），站台的上墙也按"大厅每段上墙"挂。
   牌子只画图标和箭头，不写字。随机数只用传进来的子流。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, T2 = TS * Z, G2 = D.gen2 = D.gen2 || {};
  const COL = G2.WAY_COL = { platform: '#8dff6a', exit: '#ffe14a', transfer: '#3ee8ff', stop: '#ff3047' };
  const EXIT_KINDS = G2.EXIT_KINDS = ['shutter', 'collapse', 'sandbag', 'grate'];
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  // ── 图标（'#' 是有颜色的像素）：站台 = 列车侧影，出口 = 跑出门的小人，换乘 = 两条交叉的线
  const ICON = G2.WAY_ICON = {
    platform: [' ######### ', '###########', '#  #  #  ##', '###########', '###########', ' ##     ## '],
    exit: ['       ####', '   ##  #  #', '   ##  #  #', ' ####  #  #', '#  ### #  #', '  # #  #  #', ' #   # #  #', '#     ##  #'],
    transfer: ['       ## ', '      ##  ', '##########', '##########', '    ##    ', '   ##     ', '  ##      ', ' ##       '],
  };
  const TRAIN_S = [' ###### ', '########', '# # # ##', '########', ' #    # '];
  const XMARK = ['##   ##', '### ###', ' ##### ', '  ###  ', ' ##### ', '### ###', '##   ##'];
  const RIGHT = ['   #   ', '   ##  ', '###### ', '#######', '###### ', '   ##  ', '   #   '];
  const DOWNR = ['##     ', '###    ', ' ###  #', '  ### #', '   ####', '    ###', '  #####'];
  const flipX = m => m.map(r => r.split('').reverse().join(''));
  const flipY = m => m.slice().reverse();
  const tr = m => m[0].split('').map((_, c) => m.map(r => r[c]).join(''));
  const ARROW = G2.WAY_ARROW = { // P5：吊在横梁下的导向牌（fore.js）也用
    '1,0': RIGHT, '-1,0': flipX(RIGHT), '0,1': tr(RIGHT), '0,-1': flipY(tr(RIGHT)),
    '1,1': DOWNR, '-1,1': flipX(DOWNR), '1,-1': flipY(DOWNR), '-1,-1': flipX(flipY(DOWNR)),
  };

  // 从楼梯走得到的格（solid 0，四邻）
  G2.reachFromStairs = function (F) {
    const W = F.tw, N = W * F.tht, seen = new Uint8Array(N), q = [];
    for (const s of F.stairs) { const i = Math.floor(s.y / TS) * W + Math.floor(s.x / TS); if (i >= 0 && i < N && !seen[i]) { seen[i] = 1; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], cx = c % W;
      for (const d of [1, -1, W, -W]) { const j = c + d; if (j < 0 || j >= N || (d === 1 && cx === W - 1) || (d === -1 && cx === 0) || seen[j] || F.solid[j]) continue; seen[j] = 1; q.push(j); }
    }
    return seen;
  };
  const platStairs = F => F.stairs.find(s => s.to === 1) || F.stairs[0];

  // 牌子方向：见文件头。dist 是目标的 BFS 场，s 是起点格；返回 [dx, dy]、[0, 0]（就在这里）或 null（走不到 / 挑不出来）
  G2.wayDir = function (F, dist, s) {
    const W = F.tw, N = dist.length, d0 = dist[s];
    if (d0 < 0) return null;
    if (d0 <= 3) return [0, 0];
    let fr = [s];
    for (let t = 0, k = Math.min(6, d0); t < k; t++) {
      const nx = new Set();
      for (const c of fr) { const cx = c % W; for (const d of [1, -1, W, -W]) { const j = c + d; if (j < 0 || j >= N || (d === 1 && cx === W - 1) || (d === -1 && cx === 0)) continue; if (dist[j] === dist[c] - 1) nx.add(j); } }
      fr = [...nx];
    }
    const sx = s % W, sy = (s / W) | 0, sg = new Map(); let mx = 0, my = 0;
    for (const e of fr) { const dx = e % W - sx, dy = ((e / W) | 0) - sy; mx += dx; my += dy; sg.set(Math.sign(dx) + ',' + Math.sign(dy), [Math.sign(dx), Math.sign(dy)]); }
    const S = [...sg.values()], ml = Math.hypot(mx, my) || 1;
    let best = null, bc = -2;
    for (const v of DIRS) {
      if (!S.every(([a, b]) => v[0] * a + v[1] * b > 0)) continue;
      const c = (v[0] * mx + v[1] * my) / (ml * Math.hypot(v[0], v[1]));
      if (c > bc + 1e-9) { bc = c; best = v; }
    }
    return best ? best.slice() : null;
  };

  // ── 封死的出口
  function planExits(F, wr, reach) {
    const W = F.tw, H = F.tht, k = F.kind;
    const wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || k[y * W + x] === 1;
    const fl = (x, y) => x >= 0 && y >= 0 && x < W && y < H && k[y * W + x] === 0 && !F.solid[y * W + x] && reach[y * W + x];
    const edgeD = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y);
    const outer = (x, y, dx, dy) => { for (x += dx, y += dy; x >= 0 && y >= 0 && x < W && y < H; x += dx, y += dy) if (k[y * W + x] !== 1) return false; return true; };
    const hallish = (x, y) => { const r = F.room[y * W + x]; return r < 0 || F.rooms[r].kind === 'hall'; };
    // [面, 往地面的方向, 沿墙的方向, 档次]
    const FACES = [['s', 0, 1, 1, 0, 0], ['e', 1, 0, 0, 1, 1], ['w', -1, 0, 0, 1, 1], ['n', 0, -1, 1, 0, 2]];
    const cands = [];
    for (const [face, fdx, fdy, ldx, ldy, rank] of FACES) {
      const ok = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && k[y * W + x] === 1 && F.room[y * W + x] < 0 && wall(x - fdx, y - fdy) && fl(x + fdx, y + fdy);
      const lines = ldx ? H : W, len = ldx ? W : H;
      for (let a = 0; a < lines; a++) {
        let run = [];
        for (let b = 0; b <= len; b++) {
          const x = ldx ? b : a, y = ldx ? a : b;
          if (b < len && ok(x, y)) { run.push([x, y]); continue; }
          if (run.length >= 3) for (const wd of [3, 4]) for (let s = 0; s + wd <= run.length; s++) {
            const c = run.slice(s, s + wd), [x0, y0] = c[0], [x1, y1] = c[wd - 1];
            if (!wall(x0 - ldx, y0 - ldy) || !wall(x1 + ldx, y1 + ldy)) continue; // 两头接着的是墙（不贴着门洞、开口）
            const near = c.every(([cx, cy]) => edgeD(cx, cy) <= 3), out = c.every(([cx, cy]) => outer(cx, cy, -fdx, -fdy));
            cands.push({ c, face, fdx, fdy, ldx, tier: (near ? 0 : out ? 3 : 6) + rank, hall: c.every(([cx, cy]) => hallish(cx + fdx, cy + fdy)) });
          }
          run = [];
        }
      }
    }
    const picks = [];
    if (cands.length) {
      const pick = pool => wr.weighted(pool.map(c => [c, c.hall ? 4 : 1]));
      const best = Math.min(...cands.map(c => c.tier)), n = wr.chance(0.5) ? 2 : 1;
      picks.push(pick(cands.filter(c => c.tier === best)));
      if (n === 2) {
        const mid = c => c.c[c.c.length >> 1], m0 = mid(picks[0]);
        const far = cands.filter(c => c.tier <= best + 3 && Math.max(Math.abs(mid(c)[0] - m0[0]), Math.abs(mid(c)[1] - m0[1])) >= 10);
        if (far.length) { const b2 = Math.min(...far.map(c => c.tier)); picks.push(pick(far.filter(c => c.tier === b2))); }
      }
    }
    const hist = F.hist || [], w = { shutter: 3, collapse: 2, sandbag: 2, grate: 3 };
    if (hist.includes('barricade')) w.sandbag += 12;
    if (hist.includes('quarantine')) w.shutter += 12; // P7：隔离封锁，出口多是拉下来的卷帘
    if (hist.includes('fire') || F.layout === 'collapse') w.collapse += 12;
    return picks.map(p => {
      const xs = p.c.map(q => q[0]), ys = p.c.map(q => q[1]), m = p.c[p.c.length >> 1];
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1, kind: wr.weighted(EXIT_KINDS.map(q => [q, w[q]])), face: p.face, fx: m[0] + p.fdx, fy: m[1] + p.fdy };
    });
  }

  G2.planWayfinding = function (F, wr) {
    const W = F.tw, H = F.tht, N = W * H, k = F.kind, reach = G2.reachFromStairs(F);
    F.exits = F.g2floor ? [] : planExits(F, wr, reach); // P6：站台层、换乘层、设备层没有通街面的出口
    F.wayfind = []; F.gateSigns = [];
    const kk = j => j < 0 ? 1 : k[j];
    // 上墙：这格是墙、上面还是墙、下面是从楼梯走得到的空地面；房间里的实心块（碎石）要至少两格高才算墙
    const upper = i => i >= W && i + W < N && k[i] === 1 && kk(i - W) === 1 && k[i + W] === 0 && !F.solid[i + W] && reach[i + W] && !(F.room[i] >= 0 && kk(i - 2 * W) !== 1);
    const hallish = i => { const r = F.room[i]; return r < 0 || F.rooms[r].kind === 'hall' || F.rooms[r].kind === 'platform'; };
    // 不挂牌子的格：出口和它上面一排（出口牌）、原来的霓虹招牌
    const no = new Uint8Array(N);
    for (const e of F.exits) for (let y = e.y - 1; y < e.y + e.h; y++) for (let x = e.x - 1; x <= e.x + e.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) no[y * W + x] = 1;
    for (const s of F.signs || []) { const tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS); if (tx >= 0 && ty >= 0 && tx < W && ty < H) no[ty * W + tx] = 1; }
    // 挡住牌子的图（世界坐标矩形）
    const B = [];
    for (const p of F.props) B.push([p.x - p.w / 2, p.y - p.h, p.x + p.w / 2, p.y, p.kind]);
    for (const c of F.contSpots) B.push([c.x - 12, c.y - 18, c.x + 12, c.y + 2, '']);
    for (const s of F.stairs) B.push([s.x - 34, s.y - 36, s.x + 34, s.y + 26, '']);
    const hidden = (tx, ty, y0, y1, skip) => { const ax = tx * TS + 1, bx = tx * TS + 15, ay = ty * TS + y0, by = ty * TS + y1; return B.some(b => b[4] !== skip && ax < b[2] && bx > b[0] && ay < b[3] && by > b[1]); };
    const placed = [];
    const spaced = (i, gap) => { const x = i % W, y = (i / W) | 0; return placed.every(j => Math.max(Math.abs(j % W - x), Math.abs(((j / W) | 0) - y)) > gap); };

    // ── 闸机"进站 / 出站"标志：闸机排正上方那面墙
    const gates = F.props.filter(p => p.kind === 'gate').map(p => [Math.floor((p.x - p.w / 2) / TS), Math.round(p.y / TS) - 1]);
    if (gates.length) {
      const hz = gates.every(g => g[1] === gates[0][1]), s0 = platStairs(F);
      let cols;
      if (hz) { const xs = gates.map(g => g[0]).sort((a, b) => a - b), mid = xs[xs.length >> 1]; cols = xs.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b).map(x => [x, gates[0][1]]); }
      else cols = [gates.reduce((m, g) => g[1] < m[1] ? g : m)];
      // 审稿修复 M2：只挂在闸机排上方两排以内的墙上（以前一直往上找，常常隔了 6–16 排、在另一屏）；M3：绿色那半朝楼梯那边（横排也是）
      const sideOf = gx => s0 && s0.x / TS > gx + 0.5 ? 1 : -1;
      for (const [gx, gy] of cols) {
        let y = gy - 1;
        while (y > gy - 2 && y > 0 && k[y * W + gx] === 0 && !F.solid[y * W + gx]) y--;
        const i = y * W + gx;
        if (k[i] !== 1 || kk(i - W) !== 1 || no[i] || hidden(gx, y, 1, 9, 'gate')) continue;
        F.gateSigns.push({ tx: gx, ty: y, side: sideOf(gx) });
        placed.push(i); break;
      }
      // 近处没有墙：新画法的楼层吊在闸机排正上方（前景物，fore.js 画；挂不下就不挂），中间那台闸机上
      if (!F.gateSigns.length && G2.artOn && G2.artOn(F)) { const [gx, gy] = cols[0]; if (gy - 1 >= 0 && k[(gy - 1) * W + gx] === 0) F.gateSigns.push({ tx: gx, ty: gy - 1, side: sideOf(gx), hang: 1 }); }
    }

    // ── 方向场：每种目标一次
    // P6：站台层、换乘层、设备层（F.g2floor）的牌子指出口（上楼的楼梯），站台层有下到换乘层的楼梯就再指换乘
    const upS = F.g2floor ? F.stairs.find(s => s.dir === 'up') : null, dnS = F.g2floor ? F.stairs.find(s => s.dir === 'down' && !s.hatch) : null;
    const kinds = F.g2floor ? ['exit'].concat(dnS ? ['transfer'] : []) : ['platform'].concat(F.exits.length ? ['exit'] : [], F.inter ? ['transfer'] : []), field = {};
    const sp = F.g2floor ? upS : platStairs(F), fp = sp && D.flowField(F, sp.x, sp.y);
    if (F.g2floor) { field.exit = fp ? fp.dist : null; const fq = dnS && D.flowField(F, dnS.x, dnS.y); field.transfer = fq ? fq.dist : null; }
    else field.platform = field.transfer = fp ? fp.dist : null;
    if (F.exits.length && !F.g2floor) {
      const m = new Int16Array(N).fill(-1);
      for (const e of F.exits) { const f = D.flowField(F, e.fx * TS + 8, e.fy * TS + 8); if (!f) continue; for (let i = 0; i < N; i++) { const d = f.dist[i]; if (d >= 0 && (m[i] < 0 || d < m[i])) m[i] = d; } }
      field.exit = m;
    }
    const count = { platform: 0, exit: 0, transfer: 0 };
    const place = (i, gap) => {
      if (!upper(i) || no[i] || !spaced(i, gap) || hidden(i % W, (i / W) | 0, 1, 16)) return false;
      const rows = [];
      for (const kd of kinds) { const f = field[kd]; if (!f) continue; const dir = G2.wayDir(F, f, i + W); if (dir) rows.push({ tx: i % W, ty: (i / W) | 0, kind: kd, dir }); }
      if (!rows.length) return false;
      for (const r of rows) { F.wayfind.push(r); count[r.kind]++; }
      placed.push(i); return true;
    };
    // 门洞旁边
    const doorCell = new Uint8Array(N);
    for (const d of F.doors) for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) doorCell[y * W + x] = 1;
    for (const d of F.doors) {
      if (k[d.y * W + d.x] !== 0) continue; // 裂缝墙（隐藏房、门禁房）
      const cs = [];
      for (let y = d.y - 2; y <= d.y + d.h + 1; y++) for (let x = d.x - 2; x <= d.x + d.w + 1; x++) {
        if (x < 0 || y < 1 || x >= W || y >= H - 1) continue;
        const i = y * W + x; if (!upper(i)) continue;
        const dd = Math.max(Math.max(d.x - x, 0, x - (d.x + d.w - 1)), Math.max(d.y - y, 0, y - (d.y + d.h - 1)));
        cs.push([i, dd + (hallish(i + W) ? 0 : 10)]);
      }
      cs.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      for (const [i] of cs) if (place(i, 4)) break;
    }
    // 大厅每段上墙隔 10–14 格一块
    for (const r of F.rooms) {
      if (r.kind !== 'hall' && r.kind !== 'platform') continue;
      for (let y = r.y - 1; y < r.y + r.h; y++) {
        let run = [];
        for (let x = r.x - 1; x <= r.x + r.w + 1; x++) {
          const i = y * W + x;
          if (x <= r.x + r.w && upper(i) && F.room[i + W] === r.i) { run.push(i); continue; }
          if (run.length >= 3) for (let o = Math.min(run.length - 1, wr.int(2, 5)); o < run.length; o += wr.int(10, 14)) {
            for (const t of [0, 1, -1, 2, -2]) { const j = o + t; if (j >= 0 && j < run.length && place(run[j], 4)) break; }
          }
          run = [];
        }
      }
    }
    // 走廊拐角：走廊格上面是上墙、左边或右边是墙
    for (let i = W; i < N - W; i++) {
      if (F.room[i] >= 0 || k[i] !== 0 || F.solid[i] || !reach[i] || doorCell[i]) continue;
      if (k[i - 1] === 1 || k[i + 1] === 1) place(i - W, 6);
    }
    // 不够再补
    const short = () => F.g2floor ? count.exit < 4 : count.platform < 4 || (F.exits.length && count.exit < 2);
    if (short()) {
      const all = []; for (let i = W; i < N - W; i++) if (upper(i)) all.push(i);
      all.sort((a, b) => (hallish(a + W) ? 0 : 1) - (hallish(b + W) ? 0 : 1) || a - b);
      for (const i of all) { if (!short()) break; place(i, 2); }
    }
    return F;
  };

  // ── 画
  const SPR = new Map();
  const shade = (col, top, bot) => top ? D.mixHex(col, '#ffffff', 0.2) : bot ? D.mixHex(col, '#000000', 0.35) : col;
  // 把一个图形按像素盖进画板：上边缘亮、下边缘暗（发光）
  function stamp(P, m, x0, y0, col, emit) {
    for (let j = 0; j < m.length; j++) for (let i = 0; i < m[j].length; i++) {
      if (m[j][i] !== '#') continue;
      P.set(x0 + i, y0 + j, shade(col, !(m[j - 1] && m[j - 1][i] === '#'), !(m[j + 1] && m[j + 1][i] === '#')), emit);
    }
  }
  // 一块导向牌：钢灰底板（倒角、左上亮）、里面一块暗屏，每行一个图标 + 箭头
  function plaque(rows) {
    const key = rows.map(r => r.kind + r.dir.join('')).join('|');
    if (SPR.has(key)) return SPR.get(key);
    const R = D.RAMP, n = rows.length, rh = n >= 3 ? 8 : 9, hh = 4 + n * rh, P = D.Paint(32, hh + 2);
    P.box(1, 1, 30, hh, R.gunmetal, { r: 1, v: 0.55 });
    P.box(3, 3, 26, hh - 4, R.dark, { v: 0.22, top: 0 });
    P.px(2, 2, R.silver[3]); P.px(29, 2, R.silver[2]); P.px(2, hh - 1, R.gunmetal[2]); P.px(29, hh - 1, R.gunmetal[1]);
    rows.forEach((r, j) => {
      const ic = ICON[r.kind], here = !r.dir[0] && !r.dir[1], iw = ic[0].length, cw = here ? iw : iw + 2 + 7, x0 = 1 + ((30 - cw) >> 1), top = 3 + j * rh;
      stamp(P, ic, x0, top + ((rh - ic.length) >> 1), COL[r.kind], true);
      if (!here) stamp(P, ARROW[r.dir.join(',')], x0 + iw + 2, top + ((rh - 7) >> 1), COL[r.kind], true);
      if (j < n - 1) P.rect(4, top + rh - 1, 24, 1, R.gunmetal[1]);
    });
    P.outline();
    const s = P.make(2); s.ph = hh + 2; SPR.set(key, s); return s;
  }
  // 闸机标志：一半绿色向下箭头 + 小列车，一半红叉
  function gateSprite(side) {
    const key = 'gate' + side; if (SPR.has(key)) return SPR.get(key);
    const R = D.RAMP, P = D.Paint(32, 15);
    P.box(1, 1, 30, 13, R.gunmetal, { r: 1, v: 0.55 });
    P.box(3, 3, 26, 9, R.dark, { v: 0.22, top: 0 });
    const gx = side > 0 ? 12 : 3, xx = side > 0 ? 3 : 22;
    stamp(P, ARROW['0,1'], gx, 4, COL.platform, true); stamp(P, TRAIN_S, gx + 8, 5, COL.platform, true);
    stamp(P, XMARK, xx, 4, COL.stop, true);
    P.rect(side > 0 ? 11 : 20, 4, 1, 7, R.gunmetal[1]);
    P.outline();
    const s = P.make(2); SPR.set(key, s); return s;
  }
  G2.gateSprite = gateSprite;
  // 禁止通行：红圈 + 斜杠，浅色底（不发光，贴纸）
  function stopSign(P, cx, cy) {
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const d = Math.hypot(x, y); if (d > 5.2) continue;
      const ring = d > 3.6, slash = Math.abs(x - y) <= 1 && d <= 4;
      P.set(cx + x, cy + y, ring || slash ? (x + y < -2 ? '#f0535e' : x + y > 3 ? '#8f1d26' : '#c82e3a') : (x + y < 0 ? '#f8f9ff' : '#b3b9cf'));
    }
  }
  // 涂鸦符号（不写字）：两色（颜色 + 往右下偏一格的影子）
  function graffiti(P, x0, y0, w, h, wr) {
    const cols = ['#ff3d8b', '#3ee8ff', '#8dff6a', '#ffe14a', '#ffffff'];
    for (let n = 0, m = wr.int(1, 2); n < m; n++) {
      const col = wr.pick(cols), sh = D.mixHex(col, '#0b0a14', 0.6), cx = x0 + wr.int(6, Math.max(7, w - 8)), cy = y0 + wr.int(5, Math.max(6, h - 8)), kind = wr.int(0, 3);
      const L = (a, b, c, d) => { P.line(cx + a + 1, cy + b + 1, cx + c + 1, cy + d + 1, sh); P.line(cx + a, cy + b, cx + c, cy + d, col); };
      if (kind === 0) { for (let t = 0; t < 20; t++) { const a = t / 20 * 6.283; P.set(Math.round(cx + Math.cos(a) * 5) + 1, Math.round(cy + Math.sin(a) * 4) + 1, sh); } for (let t = 0; t < 20; t++) { const a = t / 20 * 6.283; P.set(Math.round(cx + Math.cos(a) * 5), Math.round(cy + Math.sin(a) * 4), col); } L(-3, -2, 3, 2); L(3, -2, -3, 2); }
      else if (kind === 1) { L(-6, 0, 5, 0); L(5, 0, 2, -3); L(5, 0, 2, 3); }
      else if (kind === 2) { L(-6, 2, -3, -3); L(-3, -3, 0, 2); L(0, 2, 3, -3); L(3, -3, 6, 2); }
      else { L(-4, 3, -4, -3); L(-4, -3, 0, 0); L(0, 0, 4, -3); L(4, -3, 4, 3); }
    }
  }
  // 立面上的出口（下面是地面）：门框 + 封门的东西 + 禁止通行贴纸
  function facadeExit(P, pw, ph, kind, wr, face) {
    const R = D.RAMP, ix = 4, iy = 6, iw = pw - 8, ih = ph - 6;
    P.rect(0, 0, pw, ph, face);
    if (kind === 'shutter') {
      for (let y = iy; y < ph - 4; y += 3) P.box(ix, y, iw, 3, R.gunmetal, { v: 0.6, top: 1 });
      P.box(ix, ph - 4, iw, 4, R.dark, { v: 0.5 });
      P.box(ix + (iw >> 1) - 3, ph - 4, 6, 2, R.yellow, { v: 0.6 }); // 地锁
      graffiti(P, ix, iy, iw, ih, wr);
    } else if (kind === 'grate') {
      P.box(ix, iy, iw, ih, R.dark, { v: 0.1, top: 0 });
      const bars = []; for (let x = ix + 1; x < ix + iw - 1; x += 4) { bars.push(x); P.box(x, iy, 2, ih, R.steel, { v: 0.55, top: 0 }); }
      for (const y of [iy + 4, iy + 15]) { P.box(ix, y, iw, 2, R.steel, { v: 0.75 }); for (const x of bars) { P.px(x, y, '#fff3b0'); P.px(x + 1, y + 1, R.yellow[3]); } }
      for (const x of bars) P.px(x, ph - 1, R.yellow[2]); // 底下焊死在门槛上
    } else if (kind === 'sandbag') {
      P.box(ix, iy, iw, ih, R.dark, { v: 0.1, top: 0 });
      for (let row = 0, y = ph - 4; y > iy + 1; row++, y -= 5) for (let x = ix - 2 + (row % 2) * 6; x < ix + iw; x += 12) {
        P.ell(x + 6, y, 6.5, 3.3, row % 3 === 1 ? R.cloth : R.olive);
        P.px(x + 3, y - 1, R.olive[0]); P.px(x + 9, y, R.olive[1]);
      }
    } else { // collapse：碎石堆满门洞，顶上断了一截梁
      P.box(ix, iy, iw, ih, R.dark, { v: 0.1, top: 0 });
      for (let n = 0, m = 10 + (iw >> 3); n < m; n++) {
        const rx = wr.range(2.5, 5.5), x = ix + wr.range(0, iw), y = ph - 2 - wr() * wr() * (ih - 3);
        P.ell(x, y, rx, rx * 0.7, wr.pick([R.gunmetal, R.dark, R.rust, R.gunmetal]));
      }
      P.line(ix + 2, iy + 3, ix + iw - 6, iy + 9, R.steel[2]); P.line(ix + 2, iy + 4, ix + iw - 6, iy + 10, R.steel[1]);
    }
    // 门框：钢的横梁和两根门柱（左上亮）
    P.box(0, 0, pw, iy, R.steel, { v: 0.5 });
    P.box(0, iy, ix, ph - iy, R.steel, { v: 0.5, top: 0 });
    P.box(pw - ix, iy, ix, ph - iy, R.steel, { v: 0.4, top: 0 });
    if (kind === 'collapse') { P.line(pw * 0.4, 0, pw * 0.45, iy - 1, '#0b0a14'); P.line(pw * 0.45, iy - 1, pw * 0.52, 2, '#0b0a14'); }
    stopSign(P, pw >> 1, iy + 6);
  }
  // 从上面看的出口（侧墙、底墙）：画成横的，竖的出口画的时候转置（光仍从左上来）
  function topExit(P, L, kind, wr) {
    const R = D.RAMP;
    P.box(0, 0, L, T2, R.dark, { v: 0.32 });
    if (kind === 'shutter') { P.box(0, 9, L, 14, R.gunmetal, { r: 1, v: 0.6 }); for (let x = 3; x < L - 2; x += 4) P.rect(x, 10, 1, 12, R.gunmetal[1]); for (let x = 6; x < L; x += 16) { P.px(x, 11, R.silver[3]); P.px(x, 20, R.silver[2]); } }
    else if (kind === 'grate') { for (const y of [6, 23]) P.box(0, y, L, 3, R.steel, { v: 0.7 }); for (let x = 2; x < L - 1; x += 4) { P.box(x, 4, 2, 24, R.steel, { v: 0.55, top: 0 }); P.px(x, 7, '#fff3b0'); P.px(x, 24, '#fff3b0'); } }
    else if (kind === 'sandbag') { for (const [y, o] of [[10, 0], [21, 6]]) for (let x = -4 + o; x < L; x += 11) { P.ell(x + 6, y, 6, 4.5, y < 15 ? R.olive : R.cloth); P.px(x + 4, y - 1, R.olive[0]); } }
    else for (let n = 0, m = (L >> 2) + 4; n < m; n++) { const rx = wr.range(3, 6.5); P.ell(wr.range(2, L - 2), wr.range(5, T2 - 5), rx, rx * 0.75, wr.pick([R.gunmetal, R.dark, R.rust, R.gunmetal])); }
    stopSign(P, L >> 1, 16);
  }

  // 发光层只给一半亮度：图标是亮在暗屏上的小像素，全亮泛光会把图标糊成一团
  const glow = (ex, s, px, py) => { if (!s.emit) return; ex.globalAlpha = 0.5; ex.drawImage(s.emit, px, py); ex.globalAlpha = 1; };
  G2.paintWayfinding = function (F, x, ex, wr) {
    const out = [], W = F.tw;
    // 出口
    for (const e of F.exits || []) {
      const vert = e.face === 'e' || e.face === 'w', L = (vert ? e.h : e.w) * T2, P = D.Paint(L, T2);
      if (e.face === 's') facadeExit(P, L, T2, e.kind, wr, (F.th.face && F.th.face[0]) || '#2a2e3d'); else topExit(P, L, e.kind, wr);
      const s = P.make(2), px = e.x * T2, py = e.y * T2;
      if (vert) { x.save(); x.setTransform(0, 1, 1, 0, px, py); x.drawImage(s.img, 0, 0); x.restore(); }
      else x.drawImage(s.img, px, py);
      // 出口牌（黄）：立面的挂在门上方，侧墙 / 底墙的放在正中
      const pl = plaque([{ kind: 'exit', dir: [0, 0] }]), cx = (e.x + e.w / 2) * T2, top = e.face === 's' ? py - pl.ph + 3 : (e.y + e.h / 2) * T2 - pl.ph - 4;
      x.drawImage(pl.img, Math.round(cx - 16), top); glow(ex, pl, Math.round(cx - 16), top);
      out.push({ x: cx / Z, y: (top + pl.ph) / Z - 10, col: COL.exit });
      for (let y = e.y; y < e.y + e.h; y++) for (let xx = e.x; xx < e.x + e.w; xx++) out.push({ x: (xx + 0.5) * TS, y: y * TS + 6, col: COL.exit, nolight: true }); // 只占位：lightfx 不在出口上挂灯具
    }
    // 出口格上原来的霓虹招牌被盖住了：去掉它的灯
    if (F.signs && F.exits && F.exits.length) F.signs = F.signs.filter(s => { const tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS); return !F.exits.some(e => tx >= e.x && tx < e.x + e.w && ty >= e.y && ty < e.y + e.h); });
    // 导向牌（同一格的几项拼成一块）
    const by = new Map();
    for (const r of F.wayfind || []) { const i = r.ty * W + r.tx; if (!by.has(i)) by.set(i, []); by.get(i).push(r); }
    for (const rows of by.values()) {
      const s = plaque(rows), tx = rows[0].tx, ty = rows[0].ty, oy = Math.max(1, ((T2 - s.ph) >> 1) - 1), px = tx * T2, py = ty * T2 + oy;
      if (oy > 4) { x.fillStyle = '#2d3342'; x.fillRect(px + 7, ty * T2 + 3, 1, oy - 2); x.fillRect(px + 24, ty * T2 + 3, 1, oy - 2); x.fillStyle = '#646e86'; x.fillRect(px + 7, ty * T2 + 3, 1, 1); x.fillRect(px + 24, ty * T2 + 3, 1, 1); } // 吊杆
      x.drawImage(s.img, px, py); glow(ex, s, px, py);
      out.push({ x: (tx + 0.5) * TS, y: ty * TS + 6, col: COL[rows[0].kind] });
    }
    // 闸机标志
    for (const g of F.gateSigns || []) {
      if (g.hang) continue; // 吊着的那块是前景物（fore.js）
      const s = gateSprite(g.side), px = g.tx * T2, py = g.ty * T2 + 2;
      x.drawImage(s.img, px, py); glow(ex, s, px, py);
      out.push({ x: (g.tx + 0.5) * TS, y: g.ty * TS + 6, col: COL.platform });
    }
    return out;
  };
})(D);
