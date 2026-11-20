/* 站内地图第二代 P3 · 站的历史（design/features/station-gen/design.md 第 5.4 节；施工步骤 plan-p3.md 任务 1）
   七段：fire 失火、flood 水淹、barricade 路障防守、firefight 交火、squat 逃难时有人住过、purge 机器清剿过、looted 被搜刮过；
   P7 加三段（plan-p7.md 任务 1）：quarantine 隔离封锁、camp 拾荒者营地、shortcircuit 电气事故。
   D.gen2.rollHist(hr, st, opt) → 这站的历史（数组，1–2 段；安全站、教学站 []）。makeStation 从父流取一个数派生 hr（'gen2:hist'），
     不管开关开没开都取（D.TUNE.gen2.hist === false 时不抽，F.hist = []），这样关掉历史时其余的生成结果逐格不变。
     先按站点类型强制：积水站（flooded）必有 flood；停电站（blackout）squat、purge 权重 ×3。tier 0–1 抽 1 段，tier ≥ 2 有一半抽 2 段。
     互斥：fire / flood、squat / purge、camp / purge、quarantine / squat 不同时抽。医院站 quarantine ×3、停电站 shortcircuit ×3、废弃站 camp ×2（P7）。D.TUNE.gen2.histForce = [...]（开发、截图、测试用）直接指定。
   作用（用户定的：只换种类和位置，不改数量和品质）：
     histSwap：容器种类换表，每段每个容器 25% 换；只换 kind，bonus、room、x / y 不动；小场景放的容器（c.vig）、受保护的种类（D.gen2.protCont）不换。
       被搜刮过（looted）不换种类（审稿 I1，用户："被搜刮过只在画面上更空更乱，箱子里的东西不变"）：只靠小场景、贴花、翻倒的摆设看出来。
       换表是全站的（站台层、设备层、场景层也换），只换种类。
     histDecals：每段历史在每层撒一层"底子"贴花（6–12 处），落在本层地面格上（房间和走廊）。makeStation 只对核心生成器出的楼层
       （站厅、站台、设备层、换乘层）调它，D.floorsX 加的场景层（检修管道、楼上大厦、高架）不撒（审稿 M5：场景层有室外、屋顶格）。
     histSpawns：furnish 末尾调，算每间房的敌人出生格（purge：离楼梯最远的本房间格；barricade：路障小场景后面离楼梯更远的那格）。
   随机数只用传进来的子流。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, G2 = D.gen2 = D.gen2 || {};
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const HIST = G2.HIST = ['fire', 'flood', 'barricade', 'firefight', 'squat', 'purge', 'looted', 'quarantine', 'camp', 'shortcircuit'];
  const BASE_W = G2.HIST_W = { fire: 2, flood: 1, barricade: 2, firefight: 3, squat: 2, purge: 2, looted: 3, quarantine: 2, camp: 2, shortcircuit: 2 };
  const CLASH = G2.HIST_CLASH = [['fire', 'flood'], ['squat', 'purge'], ['camp', 'purge'], ['quarantine', 'squat']];
  const clash = (a, b) => CLASH.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
  G2.histClash = list => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (clash(list[i], list[j])) return true; return false; };

  G2.rollHist = function (hr, st, opt) {
    const T = D.STATION_TYPES[st.type] || {}, tune = D.TUNE.gen2 || {};
    if (tune.hist === false || opt.safe || opt.tut || T.safe) return [];
    if (Array.isArray(tune.histForce)) return tune.histForce.filter(h => HIST.includes(h));
    const w = Object.assign({}, BASE_W);
    if (st.type === 'blackout') { w.squat *= 3; w.purge *= 3; w.shortcircuit *= 3; }
    if (st.type === 'hospital') w.quarantine *= 3;
    if (st.type === 'ruin') w.camp *= 2;
    const out = st.type === 'flooded' ? ['flood'] : [];
    const n = (st.tier || 0) >= 2 && hr.chance(0.5) ? 2 : 1;
    while (out.length < n) {
      const list = HIST.filter(h => !out.includes(h) && !out.some(o => clash(o, h)) && !(st.type === 'flooded' && h === 'fire')).map(h => [h, w[h]]);
      if (!list.length) break;
      out.push(hr.weighted(list));
    }
    return out;
  };

  // ── 容器种类换表
  const SWAP = G2.HIST_SWAP = {
    firefight: [['locker', 'corpse'], ['crate', 'corpse']],
    barricade: [['locker', 'corpse'], ['crate', 'corpse']],
    squat: [['crate', 'parcel'], ['locker', 'parcel']],
    fire: [['filecab', 'wreck']],
    purge: [['locker', 'corpse']],
    // P7：只在普通种类之间换（都没有 bonus / qShift / locked / pure），品质档位一样
    quarantine: [['crate', 'parcel']], // 封存待运的货
    camp: [['locker', 'crate']], // 拾荒者把柜子里的东西归拢进箱子
    shortcircuit: [['toolbox', 'wreck']], // 烧坏的设备
  };
  G2.SWAP_P = 0.25;
  G2.histSwap = function (F, hist, sr) {
    for (const c of F.contSpots) {
      if (c.vig || (G2.protCont && G2.protCont(c.kind))) continue;
      for (const h of hist) { const L = SWAP[h]; if (!L) continue; const m = L.find(([a]) => a === c.kind); if (m && sr.chance(G2.SWAP_P)) { if (!c.k0) c.k0 = c.kind; c.kind = m[1]; } } // k0：换之前的种类（测试对它）
    }
  };

  // ── 底子贴花：每段历史每层 6–12 处
  const BASE_DECAL = G2.HIST_DECAL = { fire: ['soot'], flood: ['water'], firefight: ['shells'], looted: ['paper'], squat: ['paper', 'chalk'], purge: ['tread'], barricade: ['rubble'],
    quarantine: ['spray', 'tape'], camp: ['chalk', 'soot'], shortcircuit: ['arc', 'soot'] }; // P7
  G2.histDecals = function (F, hist, sr, out) { // out（P6，dress.js）：露天的格（积水的底子不撒在那里）
    if (!hist.length) return;
    const W = F.tw, all = [], byWall = [], inAll = [];
    for (let i = 0; i < W * F.tht; i++) {
      if (F.kind[i] !== 0 || (F.track && ((i / W) | 0) >= F.track.y0 - 1)) continue;
      all.push(i); if (!out || !out[i]) inAll.push(i);
      const x = i % W, y = (i / W) | 0;
      if (N4.some(([dx, dy]) => F.kind[(y + dy) * W + x + dx] === 1)) byWall.push(i);
    }
    if (!all.length) return;
    F.decals = F.decals || [];
    for (const h of hist) {
      const kinds = BASE_DECAL[h]; if (!kinds) continue;
      const n = sr.int(6, 12);
      for (let k = 0; k < n; k++) {
        const kind = kinds[k % kinds.length], pool = (kind === 'soot' || kind === 'rubble') && byWall.length ? byWall : kind === 'water' && out ? inAll : all;
        if (!pool.length) continue;
        const i = pool[sr.int(0, pool.length - 1)];
        F.decals.push({ x: (i % W) * TS + sr.int(3, 13), y: ((i / W) | 0) * TS + sr.int(3, 13), kind, r: (sr() * 4294967296) >>> 0, base: 1 });
      }
    }
  };

  // ── 敌人站位：返回 spawnAt[房间号] = 格号（−1 = 不改）。dist：从楼梯走过去的步数（裂缝墙也算通），reach：走得到的本房间地面
  G2.histSpawns = function (F, hist, reach, vigSpawn, vigBar) {
    const W = F.tw, N = W * F.tht, out = F.rooms.map(() => -1);
    const purge = hist.includes('purge'), bar = hist.includes('barricade');
    const dist = new Int32Array(N).fill(-1), q = [];
    for (const s of F.stairs) { const i = Math.floor(s.y / TS) * W + Math.floor(s.x / TS); if (i >= 0 && i < N && dist[i] < 0) { dist[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of N4) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= F.tht) continue; const j = y * W + x; if (dist[j] >= 0 || !(F.solid[j] === 0 || F.kind[j] === 3)) continue; dist[j] = dist[c] + 1; q.push(j); }
    }
    const best = cells => { let b = -1, bd = -1; for (const i of cells) if (reach[i] && dist[i] > bd) { bd = dist[i]; b = i; } return b; };
    for (const r of F.rooms) {
      let pick = -1;
      if (purge) { const cs = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const i = y * W + x; if (F.room[i] === r.i && F.solid[i] === 0) cs.push(i); } pick = best(cs); }
      if (pick < 0 && bar && vigBar[r.i] && vigBar[r.i].length) { // 路障后面：路障小场景外框往外 2 格里、离楼梯最远的本房间格
        const cs = [];
        for (const b of vigBar[r.i]) for (let y = b.y - 2; y < b.y + b.h + 2; y++) for (let x = b.x - 2; x < b.x + b.w + 2; x++) { if (x < 0 || y < 0 || x >= W || y >= F.tht) continue; const i = y * W + x; if (F.room[i] === r.i && F.solid[i] === 0) cs.push(i); }
        pick = best(cs);
      }
      if (pick < 0 && vigSpawn[r.i]) pick = vigSpawn[r.i].find(i => reach[i] && F.solid[i] === 0 && dist[i] >= 0) ?? -1; // 和 best() 一样要从楼梯走得到（审稿 M3）
      out[r.i] = pick;
    }
    return out;
  };
})(D);
