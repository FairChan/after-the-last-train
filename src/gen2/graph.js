/* 站内地图第二代 P1 · 结构图（design/features/station-gen/design.md 第 5.1 节；施工步骤 plan-p1.md 任务 1）
   - roomCount / kinds：房间个数和种类，照旧版 genConcourse 的规则抽（高价值房、门禁房、隐藏房的概率一样），容器、敌人的数量才和基线对得上。
   - edges：每间房连到最近的大厅（一条边）；大厅之间、楼梯所在大厅到最大的 2 间房是主通道，其余是次通道。
     有敌人的站再列出"后门"候选（检修道）：相邻的两间普通房之间连一条、给一间普通房开第二扇门到大厅，最后是绕过大厅一角的检修道；用不用、用几条由 concourse.js 按环路数定。
     隐藏房、门禁房只有一条边，就是那扇锁着的门。
   只用传进来的随机流 r2（由 makeStation 的 rng 派生），不用 Math.random。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2 = D.gen2 || {};

  G2.roomCount = (r2, lay) => r2.int(4, 6) + (lay === 'long' || lay === 'split' ? 1 : 0);

  // boxes：已经定好的房间外框（按顺序），返回 [{ box, kind, hidden, hv, lock }]
  G2.kinds = function (r2, st, opt, lay, boxes) {
    const ROOMS = D.ROOMS, LT = D.LINE_THEMES[D.LV.line()] || {}, pool = D.LV.pool(st);
    // 高价值区域：银行 / 数据中心 / 博物馆必有；其余有敌人的站越危险越可能有
    let hvKind = D.HV_FORCE[st.type] || (!opt.safe && st.tier >= 1 && r2.chance(0.18 + st.tier * 0.12 + (LT.hvBoost || 0)) ? (LT.hvBoost && r2.chance(0.6) ? 'jewelry' : r2.pick(D.HV_ROOMS)) : null);
    // 门禁房：越危险越可能有、门越高级（一站最多一间）
    const t = st.tier || 0, lockLv = !opt.safe && !opt.tut && r2.chance(0.25 + t * 0.12) ? (t === 0 ? 1 : t === 1 ? (r2.chance(0.6) ? 1 : 2) : t === 2 ? (r2.chance(0.6) ? 2 : 3) : (r2.chance(0.5) ? 2 : 3)) : 0;
    let hiddenDone = false, lockDone = !lockLv;
    return boxes.map((b, i) => {
      const hidden = !hiddenDone && i >= 2 && r2.chance(0.6 + (LT.hiddenBoost || 0) + (lay === 'collapse' ? 0.3 : 0));
      let kind = hidden ? 'hidden' : r2.weighted(pool);
      if (!hidden && hvKind && b.w * b.h >= 36) { kind = hvKind; hvKind = null; }
      const lock = !hidden && !lockDone && !ROOMS[kind].hv && i >= 1 ? lockLv : 0;
      if (lock) { kind = 'secure'; lockDone = true; }
      if (hidden) hiddenDone = true;
      return { box: b, kind, hidden, hv: !!ROOMS[kind].hv, lock };
    });
  };

  // halls / rooms：F.rooms 里的房间对象（rooms 带 cells 格数）；hi：楼梯所在的大厅在 halls 里的序号
  // 返回 { tree: [{ a, b, tier, w }]（按挖的先后排好）, back: [同样的格式，后门候选，按优先排] }
  G2.edges = function (r2, halls, rooms, hi, opt) {
    const cx = r => r.x + r.w / 2, cy = r => r.y + r.h / 2, dist = (a, b) => Math.hypot(cx(a) - cx(b), cy(a) - cy(b));
    const near = r => halls.reduce((a, h) => dist(h, r) < dist(a, r) ? h : a, halls[0]);
    const plain = r => !r.hidden && !r.lock;
    const tree = [];
    for (let k = 1; k < halls.length; k++) tree.push({ a: halls[k - 1], b: halls[k], tier: 'main', w: r2.int(5, 6) });
    const big = rooms.filter(r => plain(r) && near(r) === halls[hi]).sort((a, b) => b.cells - a.cells || a.i - b.i).slice(0, 2);
    const main = big.map((r, k) => ({ a: r, b: near(r), tier: 'main', w: k === 0 ? 5 : r2.int(4, 5) }));
    const sec = rooms.filter(r => !big.includes(r)).sort((a, b) => dist(a, near(a)) - dist(b, near(b)) || a.i - b.i).map(r => ({ a: r, b: near(r), tier: 'sec', w: 3 }));
    tree.push(...main, ...sec);
    const back = [];
    if (!opt.safe) {
      const pl = rooms.filter(plain);
      const gap = (a, b) => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0) + Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
      const pairs = [];
      for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) { const g = gap(pl[i], pl[j]); if (g <= 10) pairs.push({ a: pl[i], b: pl[j], g: g + r2() * 4 }); }
      pairs.sort((p, q) => p.g - q.g);
      const second = pl.slice().sort((a, b) => b.cells - a.cells || a.i - b.i).map(r => ({ a: r, b: near(r), tier: 'staff', w: 2, second: true }));
      // 两种后门轮着试：相邻两间房的检修道、一间房到大厅的第二扇门
      for (let k = 0; k < Math.max(pairs.length, second.length); k++) {
        if (pairs[k]) back.push({ a: pairs[k].a, b: pairs[k].b, tier: 'staff', w: 2 });
        if (second[k]) back.push(second[k]);
      }
      // 再不够：绕着大厅一角的检修道（从大厅一侧的门出去、绕过墙角、从相邻一侧的门回来）
      for (const h of halls) for (const sides of r2.shuffle([['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']])) back.push({ a: h, b: h, tier: 'staff', w: 2, sides });
    }
    return { tree, back };
  };
})(D);
