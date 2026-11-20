/* 站内地图第二代 P2 · 功能摆放（design/features/station-gen/design.md 第 5.3 节；施工步骤 plan-p2.md 任务 1）
   D.gen2.furnish(F, rng, st, fi) → { busy, reach }：新骨架楼层（F.gen2）的摆设和容器按锚点放，level.js 的 decorate 调它；
     地上的东西、灯、敌人出生点仍走 decorate（busy = 不放东西的格，reach = 从口走得到的本房间地面格，给它们用）。
   锚点表 D.gen2.ANCHOR：靠墙 wall、靠柱 pillar、成排 row、成岛 island、角落 corner；没列出的种类当 wall。
     靠柱只在房里有柱子时用，没有就退成靠墙；成排只有闸机，和站台的候车椅（P6：站台层走新骨架以后贴着站台正中那排柱子放，没有柱子退成靠墙）；
     收银台、电脑（register、pc）房里有桌子时放在桌子旁边，没有就成岛。
   次序：每间房先成排（只有楼梯所在大厅的闸机排）→ 成岛 → 靠墙 → 靠柱 → 角落 → 容器。每件从候选格里随机挑，放下后做动线检查，
     不合格就撤回、换下一个：本锚点的候选最多试 12 个，都不行再从靠墙的、任意空格里各试 12 个，还不行就放弃这件；
     容器放不下时撤掉这间房最后放的一件摆设再试一次（每间房最多撤一件，r.furn.drop 记着）。
   动线检查（每间房各管各的）：
     口 = 门洞往房里一格的格、楼梯格、闸机排的通道口；
     胖格 = 它和右、下、右下组成的 2×2 都是本房间的地面；两个口连通 = 碰到它们的胖格在同一块里。
     放东西之前连通的每一对口，放完仍要连通（塌方站的碎石本来就挡住的不算）；
     每个容器 4 邻至少一格是本房间的地面、且从口四连通走得到（只有一个口的房间也一样）。
   闸机排：楼梯所在大厅里、离楼梯 4–6 格的一条横线或竖线（先试横线，闸机正面朝人才看得出是一排；长厅那种扁长大厅先试竖线，免得一排几十个），沿线被墙、柱子、不放东西的格切成几段，
     每段两头贴着挡头，3 个闸机一组、组间留 2 格通道口；动线不过就换一条线。闸机不算进摆设个数。
   不放东西的格：楼梯、隧道口、商人 / 医生 / 调度台（F.keep，P1 审稿 M1）周围 2 格，门洞里面一格周围 1 格，闸机通道口周围 1 格，站台层登车区那两行、站台靠墙第二排（P6）；
     柱子 8 邻只给靠柱的摆设（P1 审稿 M10）。
   个数照旧：摆设 floor(格数 / 16)（站台 /26），容器照 decorate 的公式（nCont、危险等级、contFewer），记在 r.furn 给测试对；只改"放在哪"。
   摆设多一个字段 anchor（实际用的锚点），测试拿它分出哪些是放置器放的。
   随机数：只从父流取一个数派生 fr，之后全用 fr（联机两边靠种子摆出一样的东西）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, G2 = D.gen2 = D.gen2 || {};
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const ANCHOR = G2.ANCHOR = {
    prop: { vending: 'wall', cabinet: 'wall', shelf: 'wall', machine: 'wall', bench: 'pillar', bin: 'pillar', planter: 'pillar', gate: 'row', desk: 'island', bed: 'island', kiosk: 'island', crate: 'corner', barrel: 'corner' },
    cont: { locker: 'wall', filecab: 'wall', armory: 'wall', medcab: 'wall', gunrack: 'wall', rack: 'wall', fridge: 'wall', showcase: 'wall', safe: 'wall', vault: 'wall', partsbin: 'wall', toolbox: 'wall', register: 'island', pc: 'island', crate: 'corner', parcel: 'corner', trash: 'corner', corpse: 'corner', wreck: 'corner', lockbox: 'corner' },
    byRoom: { machine: { workshop: 'island', fixshop: 'island', pit: 'island' }, bench: { platform: 'row' } }, // 维修间、修械铺、检修坑的机器成岛（工作台）；其余房的机器靠墙
  };
  G2.anchorOf = (k, rk, cont) => { const o = !cont && ANCHOR.byRoom[k]; return (o && o[rk]) || (cont ? ANCHOR.cont : ANCHOR.prop)[k] || 'wall'; };
  const WIDE = G2.WIDE = { bench: 1, kiosk: 1, desk: 1, bed: 1, machine: 1, shelf: 1 }; // 宽 2 格（和 decorate 一样）
  const ORDER = { row: 0, island: 1, wall: 2, pillar: 3, corner: 4 };
  const CONT_AREA = G2.CONT_AREA = 13; // P7 任务 2：一间房每 13 格地面最多一个容器（旧版挤不下就少放的那个上限，见下面 nc）
  // 受保护的容器种类（P2/P3 审稿 C1，用户定的"历史不改品质"）：小场景、历史永远不改它们的种类，只挪位置。
  //   表里写死的这几种，另加 D.CONT 里有 bonus / locked / pure 的（比如珍宝箱）；其余都是普通容器，小场景的容器格只能换普通容器的种类
  const PROT = G2.PROT_CONT = ['safe', 'vault', 'lockbox', 'showcase', 'gunrack', 'rack', 'armory'];
  G2.protCont = k => { if (PROT.includes(k)) return true; const c = (D.CONT || {})[k]; return !!(c && (c.bonus || c.locked || c.pure)); };
  // 小场景的容器格没用上（B 遍的容器不够或种类对不上）：放一件空的摆设，免得一摊血围着空地（审稿 M8）。宽 2 格的放不下就退成一摞纸箱
  const FILL = G2.VIG_FILL = { corpse: 'bedroll', filecab: 'lockerfall', medcab: 'lockerfall', wreck: 'botwreck', parcel: 'cartons', toolbox: 'cartons' };

  // 一段长 L 的闸机线：几组闸机（每组 1–3 个），组间 2 格通道口；太短（< 4）不放
  function pattern(L) {
    if (L < 4) return null;
    let g = Math.max(2, Math.round((L + 2) / 5));
    while (g > 2 && L - 2 * (g - 1) < g) g--;
    while (Math.ceil((L - 2 * (g - 1)) / g) > 3) g++;
    const n = L - 2 * (g - 1); if (n < g) return null;
    const out = []; for (let k = 0; k < g; k++) out.push(Math.floor(n / g) + (k < n % g ? 1 : 0));
    return out;
  }

  // P6 任务 2 / 3（dress.js）：dz = { rooms: [{ props: [种类…], kinds: [容器种类…], at: [原来的格…] }], busy, vig, keep }：给旧骨架的楼层用——
  //   摆设、容器不按公式抽，照 decorate 放过的种类和个数（dz.rooms[房间号]）按锚点重放；keep：摆设不动，容器先试原来的格；
  //   放不下的容器最后退回原来的格（个数一个不少）。dz 不给时一切照旧
  G2.furnish = function (F, rng, st, fi, dz) {
    const fr = D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:furnish:' + fi));
    const vr = D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:vig:' + fi)); // P3 小场景的子流：开关关着也取这个数，其余的生成结果才逐格不变
    const W = F.tw, H = F.tht, N = W * H, ROOMS = D.ROOMS;
    const busy = new Uint8Array(N), reach = new Uint8Array(N), pil = new Uint8Array(N), nearPil = new Uint8Array(N), deskAt = new Uint8Array(N), res = new Uint8Array(N);
    const vigOn = !!(G2.vigRoom && F.vigUsed && (D.TUNE.gen2 || {}).vig !== false) && (!dz || dz.vig), hist = F.hist || [];
    const vigSpawn = F.rooms.map(() => null), vigLoose = F.rooms.map(() => null), vigBar = F.rooms.map(() => null);
    let rs = fr; // cand() 洗牌用的流：摆设用 fr；容器每一遍用自己的流（P3：小场景改了容器放在哪，不能连带后面房间的个数）
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const zone = (x, y, r) => { for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (inb(x + a, y + b)) busy[(y + b) * W + x + a] = 1; };
    for (const s of F.stairs) zone(Math.floor(s.x / TS), Math.floor(s.y / TS), 2);
    for (const t of F.tunnels) zone(Math.floor(t.x / TS), Math.floor(t.y / TS), 2);
    for (const [x, y] of F.keep || []) zone(x, y, 2);
    if (dz && dz.busy) for (const i of dz.busy) if (i >= 0 && i < N) busy[i] = 1;
    if (F.track) for (let y = F.track.y0 - 2; y < F.track.y0; y++) for (let x = 0; x < W; x++) { const i = y * W + x; busy[i] = 1; res[i] = 1; } // P6：站台层登车区那两行（18、19）什么都不放，小场景也不进
    for (const r of F.rooms) if (r.kind === 'platform' && F.track) for (let x = r.x; x < r.x + r.w; x++) busy[(r.y + 1) * W + x] = 1; // P6：站台靠墙第二排留一条通道（摆设、容器不放），从楼梯走到各个门洞不用绕
    // 口：门洞往房里一格（门洞那几格 4 邻里属于这间房的格）、楼梯格
    const ports = F.rooms.map(() => []);
    for (const d of F.doors || []) {
      const cs = [], rr = F.rooms[d.room];
      for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) for (const [dx, dy] of N4) {
        const xx = x + dx, yy = y + dy; if (!inb(xx, yy)) continue;
        if (rr && (xx < rr.x || yy < rr.y || xx >= rr.x + rr.w || yy >= rr.y + rr.h)) continue; // P7：口只取房间方框里的格（旧骨架房间算进来的门口格在方框外，房间的局部格表放不下）
        const j = yy * W + xx; if (F.room[j] === d.room && !cs.includes(j)) cs.push(j);
      }
      for (const j of cs) zone(j % W, (j / W) | 0, 1);
      if (cs.length && ports[d.room]) ports[d.room].push(cs);
    }
    for (const s of F.stairs) { const x = Math.floor(s.x / TS), y = Math.floor(s.y / TS); if (inb(x, y) && F.room[y * W + x] >= 0) ports[F.room[y * W + x]].push([y * W + x]); }
    // 柱子（P1 的柱网）和它的 8 邻
    for (const p of F.props) {
      if (p.kind !== 'pillar') continue;
      const x = Math.floor((p.x - p.w / 2) / TS), y = Math.round(p.y / TS) - 1; if (!inb(x, y)) continue;
      pil[y * W + x] = 1; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (inb(x + a, y + b)) nearPil[(y + b) * W + x + a] = 1;
    }
    const isWall = (x, y) => inb(x, y) && F.kind[y * W + x] === 1;
    const s0 = F.stairs[0], stairRoom = s0 && inb(Math.floor(s0.x / TS), Math.floor(s0.y / TS)) ? F.room[Math.floor(s0.y / TS) * W + Math.floor(s0.x / TS)] : -1;

    for (const r of F.rooms) {
      const R = ROOMS[r.kind]; if (!R) continue;
      const DZ = dz ? dz.rooms[r.i] || { props: [], kinds: [], at: [] } : null;
      const P = ports[r.i], LW = r.w, LH = r.h, LN = LW * LH, x0 = r.x, y0 = r.y;
      const gi = (lx, ly) => (y0 + ly) * W + x0 + lx, loc = i => (((i / W) | 0) - y0) * LW + (i % W) - x0;
      const free = (lx, ly) => { const i = gi(lx, ly); return F.room[i] === r.i && F.solid[i] === 0; };
      const lab = new Int32Array(LN), fm = new Uint8Array(LN), rch = new Uint8Array(LN), stk = new Int32Array(LN + 4);
      const conts = [];
      // 胖格分块
      function label() {
        lab.fill(-1); fm.fill(0);
        for (let ly = 0; ly + 1 < LH; ly++) for (let lx = 0; lx + 1 < LW; lx++) fm[ly * LW + lx] = free(lx, ly) && free(lx + 1, ly) && free(lx, ly + 1) && free(lx + 1, ly + 1) ? 1 : 0;
        let n = 0;
        for (let k = 0; k < LN; k++) {
          if (!fm[k] || lab[k] >= 0) continue;
          lab[k] = n; let sp = 0; stk[sp++] = k;
          while (sp) {
            const c = stk[--sp], cx = c % LW, cy = (c / LW) | 0;
            let j; // P5 提速：四邻展开写（和 N4 循环同样的结果）
            if (cx + 1 < LW) { j = c + 1; if (fm[j] && lab[j] < 0) { lab[j] = n; stk[sp++] = j; } }
            if (cx > 0) { j = c - 1; if (fm[j] && lab[j] < 0) { lab[j] = n; stk[sp++] = j; } }
            if (cy + 1 < LH) { j = c + LW; if (fm[j] && lab[j] < 0) { lab[j] = n; stk[sp++] = j; } }
            if (cy > 0) { j = c - LW; if (fm[j] && lab[j] < 0) { lab[j] = n; stk[sp++] = j; } }
          }
          n++;
        }
      }
      const plabs = port => { const s = new Set(); for (const i of port) { const k = loc(i), lx = k % LW, ly = (k / LW) | 0; for (const [a, b] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const x = lx + a, y = ly + b; if (x >= 0 && y >= 0 && x < LW && y < LH && lab[y * LW + x] >= 0) s.add(lab[y * LW + x]); } } return s; };
      const meet = (a, b) => { for (const l of a) if (b.has(l)) return true; return false; };
      let pairs = [];
      const basePairs = () => { label(); const S = P.map(plabs); pairs = []; for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) if (meet(S[a], S[b])) pairs.push([a, b]); };
      const flowOK = () => { if (!pairs.length) return true; label(); const S = P.map(plabs); return pairs.every(([a, b]) => meet(S[a], S[b])); };
      // 从口四连通走得到的本房间地面（没有口的房间：所有地面都算）
      function flood() {
        rch.fill(0); let sp = 0;
        const seed = k => { if (!rch[k] && free(k % LW, (k / LW) | 0)) { rch[k] = 1; stk[sp++] = k; } };
        if (P.length) { for (const p of P) for (const i of p) seed(loc(i)); } else for (let k = 0; k < LN; k++) seed(k);
        while (sp) {
          const c = stk[--sp], cx = c % LW, cy = (c / LW) | 0;
          if (cx + 1 < LW && !rch[c + 1] && free(cx + 1, cy)) { rch[c + 1] = 1; stk[sp++] = c + 1; } // P5 提速：四邻展开写
          if (cx > 0 && !rch[c - 1] && free(cx - 1, cy)) { rch[c - 1] = 1; stk[sp++] = c - 1; }
          if (cy + 1 < LH && !rch[c + LW] && free(cx, cy + 1)) { rch[c + LW] = 1; stk[sp++] = c + LW; }
          if (cy > 0 && !rch[c - LW] && free(cx, cy - 1)) { rch[c - LW] = 1; stk[sp++] = c - LW; }
        }
      }
      const standOK = () => {
        if (!conts.length) return true; flood();
        return conts.every(i => { const k = loc(i), lx = k % LW, ly = (k / LW) | 0; return N4.some(([dx, dy]) => { const x = lx + dx, y = ly + dy; return x >= 0 && y >= 0 && x < LW && y < LH && rch[y * LW + x] === 1; }); });
      };
      const put = cells => { for (const i of cells) F.solid[i] = 1; if (flowOK() && standOK()) return true; for (const i of cells) F.solid[i] = 0; return false; };
      // 候选格（左边那格），宽 wd 的每格都要是本房间、空、不在不放东西的格里
      const okCell = (lx, ly, anc) => { if (lx < 0 || ly < 0 || lx >= LW || ly >= LH) return false; const i = gi(lx, ly); return F.room[i] === r.i && F.solid[i] === 0 && F.kind[i] === 0 && !busy[i] && !res[i] && (anc === 'pillar' || !nearPil[i]); };
      function cand(anc, wd) {
        const out = [];
        for (let ly = 0; ly < LH; ly++) for (let lx = 0; lx + wd <= LW; lx++) {
          let ok = true; for (let a = 0; a < wd && ok; a++) if (!okCell(lx + a, ly, anc)) ok = false;
          if (!ok) continue;
          const gx = x0 + lx, gy = y0 + ly; let hit = anc === 'any';
          for (let a = 0; a < wd && !hit; a++) {
            const x = gx + a;
            if (anc === 'wall') hit = N4.some(([dx, dy]) => isWall(x + dx, gy + dy));
            else if (anc === 'corner') hit = (isWall(x - 1, gy) || isWall(x + 1, gy)) && (isWall(x, gy - 1) || isWall(x, gy + 1));
            else if (anc === 'pillar') { for (let b = -1; b <= 1 && !hit; b++) for (let c = -1; c <= 1 && !hit; c++) hit = inb(x + c, gy + b) && pil[(gy + b) * W + x + c] === 1; }
            else if (anc === 'desk') hit = N4.some(([dx, dy]) => inb(x + dx, gy + dy) && deskAt[(gy + dy) * W + x + dx] === 1);
          }
          if (anc === 'island') { // 离墙至少 2 格：自己和 8 邻都是本房间、不是墙
            hit = true;
            for (let b = -1; b <= 1 && hit; b++) for (let a = -1; a <= wd; a++) { const x = gx + a, y = gy + b; if (!inb(x, y) || F.room[y * W + x] !== r.i || F.kind[y * W + x] !== 0) { hit = false; break; } }
          }
          if (hit) out.push(gy * W + gx);
        }
        return rs.shuffle(out);
      }
      // 放一件：先本锚点的 12 个候选，再靠墙的 12 个，再任意空格 12 个（贴墙的不容易把路截断）；返回左边那格，放不下 −1
      function place(anc, wd, isCont) {
        const tried = new Set();
        for (const a of [...new Set([anc, 'wall', 'any'])]) {
          let n = 0;
          for (const i of cand(a, wd)) {
            if (tried.has(i)) continue; if (n++ >= 12) break; tried.add(i);
            const cells = []; for (let k = 0; k < wd; k++) cells.push(i + k);
            if (isCont) conts.push(i);
            if (put(cells)) return i;
            if (isCont) conts.pop();
          }
        }
        return -1;
      }
      // 闸机排（楼梯所在大厅）
      function gateRow() {
        const sx = Math.floor(s0.x / TS), sy = Math.floor(s0.y / TS), lines = [];
        for (const d of [4, 5, 6]) {
          for (const y of [sy - d, sy + d]) if (y > r.y && y < r.y + r.h - 1) lines.push({ hz: true, at: y, len: r.w });
          for (const x of [sx - d, sx + d]) if (x > r.x && x < r.x + r.w - 1) lines.push({ hz: false, at: x, len: r.h });
        }
        const wantHz = r.w <= 2 * r.h + 4; fr.shuffle(lines); lines.sort((a, b) => (a.hz === wantHz ? 0 : 1) - (b.hz === wantHz ? 0 : 1));
        const okG = i => F.room[i] === r.i && F.solid[i] === 0 && F.kind[i] === 0 && !busy[i];
        for (const L of lines) {
          const cells = []; for (let t = 0; t < L.len; t++) cells.push(L.hz ? L.at * W + r.x + t : (r.y + t) * W + L.at);
          const gates = [], gaps = [];
          for (let t = 0; t < cells.length;) {
            if (!okG(cells[t])) { t++; continue; }
            let e = t; while (e < cells.length && okG(cells[e])) e++;
            const run = cells.slice(t, e), pat = pattern(run.length); t = e;
            if (!pat) continue;
            let k = 0; pat.forEach((n, g) => { for (let a = 0; a < n; a++) gates.push(run[k++]); if (g < pat.length - 1) { gaps.push([run[k], run[k + 1]]); k += 2; } });
          }
          if (gates.length < 3 || !put(gates)) continue;
          for (const i of gates) { const p = D.makeProp('gate', i % W, (i / W) | 0, F.th, fr); p.anchor = 'row'; F.props.push(p); }
          for (const gp of gaps) { for (const i of gp) zone(i % W, (i / W) | 0, 1); P.push(gp); }
          return true;
        }
        return false;
      }

      basePairs();
      if (r.i === stairRoom && r.kind === 'hall') { if (gateRow()) basePairs(); }
      // 摆设：个数照旧，种类照旧版的表抽，按锚点次序放
      const hasPil = (() => { for (let ly = 0; ly < LH; ly++) for (let lx = 0; lx < LW; lx++) { const i = gi(lx, ly); if (pil[i] && F.room[i] === r.i) return true; } return false; })();
      const pool = (r.kind === 'hall' || r.kind === 'platform') && D.LINE_THEMES[F.line] ? R.props.concat(D.LINE_THEMES[F.line].props) : R.props;
      const nP = DZ ? DZ.props.length : Math.floor(r.cells / (r.kind === 'platform' ? 26 : 16)), items = [];
      for (let n = 0; n < nP; n++) {
        const k = DZ ? DZ.props[n] : fr.weighted(pool); let anc = DZ && G2.DRESS_ANCHOR && G2.DRESS_ANCHOR[k] || G2.anchorOf(k, r.kind);
        if (anc === 'row') anc = r.kind === 'platform' && hasPil ? 'pillar' : 'wall'; // P6：站台的候车椅贴着那排柱子放（成一排）；别处的成排退成靠墙
        else if (anc === 'pillar' && !hasPil) anc = 'wall';
        items.push({ k, anc, n });
      }
      items.sort((a, b) => ORDER[a.anc] - ORDER[b.anc] || a.n - b.n);
      const mine = [];
      for (const it of items) {
        const wd = WIDE[it.k] ? 2 : 1, i = place(it.anc, wd, false);
        if (i < 0) continue;
        const p = D.makeProp(it.k, i % W, (i / W) | 0, F.th, fr); p.anchor = it.anc; F.props.push(p);
        const cells = []; for (let a = 0; a < wd; a++) { cells.push(i + a); if (it.k === 'desk') deskAt[i + a] = 1; }
        mine.push({ p, cells });
      }
      // 容器：个数照 decorate 的公式
      // P7 任务 2：按地方封顶（每 CONT_AREA 格最多一个）。旧版 decorate 在小房间里随机试 60 次、每件东西四周 3×3 不许再放，挤不下的容器就没了，
      //   所以旧版小房间（仓库、门禁房、维修间……）实际放出来的比公式少；新版每个都放得下，容器比旧版多 10–19%（双厅站、站台层）。封顶只看房间大小，开关前后一样
      const nc = DZ ? DZ.kinds.length : Math.min(Math.max(1, Math.floor(r.cells / CONT_AREA)), Math.max(1, fr.int(R.nCont[0], R.nCont[1]) + (st.tier >= 2 ? fr.int(0, 1) : 0) - (!R.hv && !R.bonus && fr.chance((D.TUNE.loot || {}).contFewer || 0) ? 1 : 0)));
      const hasDesk = (() => { for (let ly = 0; ly < LH; ly++) for (let lx = 0; lx < LW; lx++) if (deskAt[gi(lx, ly)]) return true; return false; })();
      r.furn = { props: nP, cont: nc };
      const cseed = (fr() * 4294967296) >>> 0;
      // 一遍放容器（P3）：自己的流 D.rng(cseed)；pre = 小场景的容器格（先用）。
      //   kinds 空 = A 遍：照公式一个个抽种类、放；kinds = A 遍放下的种类（按次序）= B 遍：只挪位置，种类一个不改（审稿 C1）。
      //   小场景的容器格：容器种类和格子写的一样，或者两边都是普通容器（受保护的种类不换），才能用这格；用了就换成格子写的种类。
      //   返回放下的（k0 = 抽到的种类）、没用上的小场景容器格、撤掉的那件摆设，undo 能原样撤回
      function contPass(pre, kinds, ats) {
        rs = D.rng(cseed); conts.length = 0;
        const got = [], q = (pre || []).slice(), left = []; let dropped = null;
        const atTry = a0 => { if (a0 == null || a0 < 0 || F.solid[a0] || F.room[a0] !== r.i) return -1; conts.push(a0); if (put([a0])) return a0; conts.pop(); return -1; }; // dz：原来的格
        for (let n = 0, n0 = kinds ? kinds.length : nc; n < n0; n++) {
          const k = kinds ? kinds[n] : rs.weighted(R.cont), a0 = ats ? ats[n] : -1; let anc = G2.anchorOf(k, r.kind, true);
          if (anc === 'island' && hasDesk) anc = 'desk';
          let i = -1, kind = k, vig = null;
          for (let t = 0; t < q.length && i < 0;) {
            const c = q[t];
            if (c.kind !== k && (G2.protCont(k) || G2.protCont(c.kind))) { t++; continue; }
            q.splice(t, 1); conts.push(c.i);
            if (put([c.i])) { i = c.i; kind = c.kind; vig = c.id; }
            else { conts.pop(); left.push(c); }
          }
          if (i < 0 && DZ && dz.keep) i = atTry(a0);
          if (i < 0) i = place(anc, 1, true);
          // 小房间被摆设占满、容器放不下：撤掉最后放的一件摆设再试（每间房最多撤一件，容器比摆设要紧）
          if (i < 0 && mine.length && !dropped) {
            const m = mine.pop(), at = F.props.indexOf(m.p); dropped = { m, at, desk: m.cells.map(c => deskAt[c]) };
            for (const c of m.cells) { F.solid[c] = 0; deskAt[c] = 0; } F.props.splice(at, 1);
            i = place(anc, 1, true);
          }
          if (i < 0 && DZ) { i = atTry(a0); if (i < 0 && a0 >= 0 && !F.solid[a0]) { F.solid[a0] = 1; conts.push(a0); i = a0; } } // dz：个数一个不少（原来的格总能退回去）
          if (i < 0) continue;
          got.push({ i, kind, vig, k0: k, a0 });
        }
        rs = fr;
        return { got, dropped, left: left.concat(q), undo() { for (const g of got) F.solid[g.i] = 0; conts.length = 0; if (dropped) { const { m, at, desk } = dropped; m.cells.forEach((c, a) => { F.solid[c] = 1; deskAt[c] = desk[a]; }); F.props.splice(at, 0, m.p); mine.push(m); } } };
      }
      // P7 任务 2（十站不重复）：小场景可以压在这间房自己放的大件摆设上（vignette.js 的 api.lift）。门口、墙边、角落多半先被木箱、柜子、桶占了，
      //   以前大一点的小场景放不进去，一站一站放出来的总是那几个小的。压到的摆设先收起来，小场景放下后用小场景的子流 vr 按原来的锚点重放；
      //   有一件放不下就整个小场景不放、摆设放回原处。父流、容器的流一个数不多取，开关小场景前后数量照旧
      function mkLift() {
        const at = new Map(); for (const m of mine) for (const c of m.cells) at.set(c, m);
        return {
          at,
          take(ms) { // 收起，返回"放回原处"
            const saved = ms.map(m => ({ m, p: m.p, cells: m.cells, desk: m.cells.map(c => deskAt[c]), k: F.props.indexOf(m.p) }));
            for (const s of saved) for (const c of s.cells) { F.solid[c] = 0; deskAt[c] = 0; at.delete(c); }
            for (const s of saved.slice().sort((a, b) => b.k - a.k)) if (s.k >= 0) F.props.splice(s.k, 1);
            return () => {
              for (const s of saved.slice().sort((a, b) => a.k - b.k)) if (s.k >= 0) F.props.splice(s.k, 0, s.p);
              for (const s of saved) { s.m.p = s.p; s.m.cells = s.cells; s.cells.forEach((c, a) => { F.solid[c] = 1; deskAt[c] = s.desk[a]; at.set(c, s.m); }); }
            };
          },
          back(ms) { // 重放（流用 vr）：都放下了返回"撤回"，有一件放不下就撤回已放的、返回 null
            const r0 = rs, done = [];
            const undo = () => { for (const d of done.reverse()) { const k = F.props.indexOf(d.np); if (k >= 0) F.props.splice(k, 1); for (const c of d.m.cells) { F.solid[c] = 0; deskAt[c] = 0; at.delete(c); } } };
            rs = vr;
            try {
              for (const m of ms) {
                const wd = m.cells.length, k = m.p.kind, i = place(m.p.anchor || 'wall', wd, false);
                if (i < 0) { undo(); return null; }
                const np = D.makeProp(k, i % W, (i / W) | 0, F.th, vr); np.anchor = m.p.anchor; F.props.push(np);
                m.p = np; m.cells = []; for (let a = 0; a < wd; a++) { m.cells.push(i + a); at.set(i + a, m); if (k === 'desk') deskAt[i + a] = 1; }
                done.push({ m, np });
              }
            } finally { rs = r0; }
            return undo;
          },
        };
      }
      // 没用上的小场景容器格放一件空摆设（M8）：宽 2 格的先试往右、再往左伸一格，放不下退成 1 格的纸箱；动线检查不过就留空
      function fillVig(c) {
        const k = FILL[c.kind] || 'cartons', x = c.i % W, y = (c.i / W) | 0;
        const ok1 = j => F.room[j] === r.i && F.kind[j] === 0 && F.solid[j] === 0 && !res[j] && !busy[j] && !nearPil[j];
        const tries = [];
        if (G2.VIG_WIDE[k] || WIDE[k]) { if (x + 1 < W && ok1(c.i + 1)) tries.push([k, [c.i, c.i + 1]]); if (x > 0 && ok1(c.i - 1)) tries.push([k, [c.i - 1, c.i]]); }
        else tries.push([k, [c.i]]);
        if (k !== 'cartons') tries.push(['cartons', [c.i]]);
        for (const [pk, cells] of tries) {
          if (!put(cells)) continue;
          const p = D.makeProp(pk, cells[0] % W, y, F.th, vr); p.vig = c.id; p.vigFill = 1; F.props.push(p);
          for (const j of cells) res[j] = 1;
          return;
        }
      }
      // 先照没有小场景放一遍（A），记下个数；有小场景时撤掉 A、放小场景、再放一遍（B，先用小场景的容器格、个数和 A 一样）；
      // B 放不到 A 那么多就把小场景撤掉、重放 A（同一个流、同样的格子，结果和 A 一模一样）。这样开不开小场景，每间房的容器个数都一样
      const kD = DZ ? DZ.kinds : null, aD = DZ ? DZ.at : null;
      let fin = contPass(null, kD, aD);
      const vk = G2.vigKind ? G2.vigKind(F, r) : r.kind; // P6：旧骨架楼层的房间种类对到小场景认的种类（dress.js）
      if (vigOn && (G2.vigCand ? G2.vigCand(F, r, vk) : G2.VIGS).some(v => !F.vigUsed.has(v.id))) { // P7：候选表和 vigRoom 用的同一张（含房间自己的种类、露天的）
        const kA = fin.got.map(g => g.k0), aA = fin.got.map(g => g.a0); fin.undo();
        const V = G2.vigRoom({ F, r, vr, busy, nearPil, res, used: F.vigUsed, hist, st, put, lift: mkLift() });
        if (V.placed.length) {
          fin = contPass(V.conts, kA, DZ ? aA : null);
          if (fin.got.length < kA.length) { fin.undo(); V.undo(); fin = contPass(null, kD, aD); }
          else { vigSpawn[r.i] = V.spawn.slice(); vigLoose[r.i] = V.loose.slice(); vigBar[r.i] = V.bars.slice(); for (const c of fin.left) fillVig(c); }
        } else fin = contPass(null, kD, aD);
      }
      if (fin.dropped) r.furn.drop = 1;
      for (const g of fin.got) {
        const sp = { x: (g.i % W) * TS + 8, y: ((g.i / W) | 0) * TS + 12, kind: g.kind, bonus: (R.bonus || 0) + (st.hidden ? 1 : 0) + (r.lock ? r.lock - 1 : 0), room: r.i };
        if (g.vig) sp.vig = g.vig;
        sp.k0 = g.k0; // 抽到的种类（小场景、历史换种类之前；测试对它）
        F.contSpots.push(sp);
      }
      flood();
      for (let k = 0; k < LN; k++) if (rch[k]) reach[gi(k % LW, (k / LW) | 0)] = 1;
    }
    // P3：站的历史挪敌人站位、小场景的地上东西格（只改位置，数量在 decorate 里照旧）
    const spawnAt = G2.histSpawns ? G2.histSpawns(F, dz && !dz.hist ? [] : hist, reach, vigSpawn, vigBar) : null;
    return { busy, reach, spawnAt, looseAt: vigLoose };
  };
})(D);
