/* 站内地图第二代 P6 任务 1 · 设备层（深埋站）用新骨架（design/features/station-gen/plan-p6.md；设计文档 5.1–5.2 节）
   D.gen2.utility(rng, st, opt, o) → 设备层，level.js 的 makeStation 给深埋站调（P7 任务 3 起没有开关）。
     o = { name, up（楼梯字，level.js 给）}
   和旧版 genUtility 一样：48×30、主题 depot，3×2 个房间位（第一排 y 2–11、第二排 y 17–26，列之间 3 格、排之间 3 格空当），
     房间 9–11 × 7–9 格、墙边对齐柱网；种类照旧版的表抽（配电室 3、仓库 3、维修间 2、控制室 1），右下那间 60% 是隐藏房；
     上楼梯在左上那间（它和隐藏房是方的，其余拼形）的 (x + 2, y + 1)。
   结构图照旧版的连法：1–0、3–0 主通道（4 格），2–1、4–3、4–1、5–4 次通道（3 格；4–1 那条本来就是一个环），隐藏房的门是裂缝墙；
     有敌人的站再挖后门检修道（2 格，两头开新门）直到环路 ≥ 2，最多 4 条。通道、门洞走 concourse.js 的 G2.net。设备层没有大厅、没有柱子。
   输出字段同旧设备层，外加 F.gen2 = true、F.g2floor = 'utility'、F.doors、每间房的 cells / shape。随机数只从 makeStation 的 rng 取一个数。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, G2 = D.gen2 = D.gen2 || {};
  const SLOTS = [[2, 2, 11, 10], [18, 2, 11, 10], [34, 2, 11, 10], [2, 17, 11, 10], [18, 17, 11, 10], [34, 17, 11, 10]];
  const KINDS = [['power', 3], ['storage', 3], ['workshop', 2], ['control', 1]];

  G2.utility = function (rng, st, opt, o) {
    const r2 = D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:util'));
    const LV = D.LV, idx = LV.idx, F = LV.newFloor(48, 30, o.name, 'depot'), W = F.tw, N = W * F.tht;
    F.gen2 = true; F.g2floor = 'utility'; F.doors = [];
    const s = r2.int(7, 9), ox = r2.int(0, s - 1), oy = r2.int(0, s - 1);
    const offGrid = (v, o0) => { const m = ((v - o0) % s + s) % s; return Math.min(m, s - m); };
    // 一个方向上挑位置：墙（v − 1 或 v + len）离柱网线最近的那些里随机一个（同 mass.js 的 boxes）
    const axis = (lo, room, len, o0) => { let best = [], bs = 1e9; for (let v = lo; v <= lo + room - len; v++) { const sc = Math.min(offGrid(v - 1, o0), offGrid(v + len, o0)); if (sc < bs) { bs = sc; best = [v]; } else if (sc === bs) best.push(v); } return r2.pick(best); };
    const rooms = SLOTS.map(([sx, sy, sw, sh], k) => {
      const w = r2.int(9, 11), h = r2.int(7, 9), x = axis(sx, sw, w, ox), y = axis(sy, sh, h, oy);
      const hidden = k === 5 && r2.chance(0.6), kind = hidden ? 'hidden' : r2.weighted(KINDS);
      const sh2 = G2.shape(r2, { x, y, w, h }, k > 0 && !hidden), r = LV.addRoom(F, x, y, w, h, kind, { hidden });
      for (const [x0, y0, cw, ch] of sh2.cut) for (let yy = y0; yy < y0 + ch; yy++) for (let xx = x0; xx < x0 + cw; xx++) { const i = idx(F, xx, yy); if (F.room[i] === r.i) { F.solid[i] = 1; F.kind[i] = 1; F.room[i] = -1; } }
      r.shape = sh2.shape;
      return r;
    });
    const countCells = () => { const c = new Array(F.rooms.length).fill(0); for (let i = 0; i < N; i++) if (F.room[i] >= 0) c[F.room[i]]++; F.rooms.forEach((r, k) => { r.cells = c[k]; if (!r.shape) r.shape = 'rect'; }); };
    countCells();
    const s0 = rooms[0];
    F.stairs.push({ x: (s0.x + 2) * TS, y: (s0.y + 1) * TS + 6, dir: 'up', label: o.up, to: 0 });
    const stairT = F.stairs.map(q => [Math.floor(q.x / TS), Math.floor(q.y / TS)]);
    const e = (a, b, tier, w, fresh) => ({ a: rooms[a], b: rooms[b], tier, w, second: !!fresh });
    const tree = [e(1, 0, 'main', 4), e(2, 1, 'sec', 3), e(3, 0, 'main', 4), e(4, 3, 'sec', 3), e(4, 1, 'sec', 3), e(5, 4, 'sec', 3)];
    const back = (rooms[5].hidden ? [] : [e(5, 2, 'staff', 2)]).concat([e(0, 1, 'staff', 2), e(3, 4, 'staff', 2), e(1, 2, 'staff', 2), e(0, 3, 'staff', 2)]);
    G2.net(F, r2, { halls: [s0], stairT, G: { tree, back }, safe: !!opt.safe, keep: [], pillarHalls: [], gridOf: () => null });
    for (const dr of F.doors) { delete dr.cells; delete dr.d; }
    F.keep = [];
    countCells();
    return F;
  };
})(D);
