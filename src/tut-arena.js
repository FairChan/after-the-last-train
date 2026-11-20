/* Underdog · 新手教学的场景：南栈训练长厅（design/features/tutorial/design.md）
   一条 232 格长的走廊，从左到右八个区，区和区之间一道能量闸门；搜刮区上面是隐藏房间（裂缝墙），下面是门禁金库。
   训练场 = 楼层 0 长厅 + 楼层 1 标准撤离站台（班车演示、呼叫接驳车、撤离战）。包在 D.makeStation 上：只换训练场（站点 id 'tut'）。
   闸门：一列"实心、地面画法"的格子（solid = 1、kind = 0），挡人、挡子弹、挡视线；开门就清掉 solid，画法是光效（tutorial.js 画）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16;
  // 区：x0..x1 是这一区的走廊（格），闸门在 x1 + 1
  const ZONES = D.TUT_ZONES = [
    { k: 'prep', name: '整备区', x0: 2, x1: 21 },
    { k: 'gun', name: '射击场', x0: 23, x1: 49 },
    { k: 'melee', name: '近战场', x0: 51, x1: 79 },
    { k: 'dodge', name: '闪避场', x0: 81, x1: 107 },
    { k: 'gear', name: '装备场', x0: 109, x1: 133 },
    { k: 'loot', name: '搜刮区', x0: 135, x1: 173 },
    { k: 'fight', name: '实战区', x0: 175, x1: 211 },
    { k: 'down', name: '下站台', x0: 213, x1: 229 },
  ];
  const Y0 = 10, Y1 = 18; // 走廊的上下沿（格）
  D.TUT_HALL = { Y0, Y1, hidden: { x: 142, y: 3, w: 11, h: 5, door: 147 }, vault: { x: 156, y: 21, w: 11, h: 5, door: 161 }, stair: 222 };

  D.tutHall = function (rng) {
    const L = D.LV, H = D.TUT_HALL, F = L.newFloor(232, 28, '训练长厅', 'depot');
    F.loose = []; F.layout = 'standard'; F.line = null; F.gates = []; F.zones = ZONES;
    for (const z of ZONES) z.room = L.addRoom(F, z.x0, Y0, z.x1 - z.x0 + 1, Y1 - Y0 + 1, 'hall', { name: z.name }).i;
    // 闸门：走廊里一列格子，开之前是实心的
    ZONES.forEach((z, i) => {
      if (i === ZONES.length - 1) return;
      const gx = z.x1 + 1; L.carve(F, gx, Y0, 1, Y1 - Y0 + 1, z.room);
      for (let y = Y0; y <= Y1; y++) F.solid[L.idx(F, gx, y)] = 1;
      F.gates.push({ tx: gx, zone: i, open: false, x: gx * TS + 8, y0: Y0 * TS, y1: (Y1 + 1) * TS });
    });
    // 隐藏房间（搜刮区上面）：门口一段裂缝墙，打破才能进
    const hr = L.addRoom(F, H.hidden.x, H.hidden.y, H.hidden.w, H.hidden.h, 'hidden', { hidden: true });
    doorway(F, H.hidden.door, H.hidden.y + H.hidden.h, Y0 - 1, 3, hr.i);
    F.breakables.push({ tx: H.hidden.door, ty: Y0 - 1, hp: 40, room: hr.i, open: false, x: H.hidden.door * TS + 8, y: (Y0 - 1) * TS + 8, tut: 'crack' });
    // 门禁金库（搜刮区下面）：刷绿卡开门，里面是高价值区域
    const vr = L.addRoom(F, H.vault.x, H.vault.y, H.vault.w, H.vault.h, 'vault', { hv: true, lock: 1 });
    doorway(F, H.vault.door, Y1 + 1, H.vault.y - 1, 3, vr.i);
    F.breakables.push({ tx: H.vault.door, ty: Y1 + 1, hp: 40, room: vr.i, open: false, lock: 1, x: H.vault.door * TS + 8, y: (Y1 + 1) * TS + 8, tut: 'vault' });
    // 下到站台的楼梯
    F.stairs.push({ x: H.stair * TS, y: 13 * TS + 6, dir: 'down', label: '下到站台层', to: 1 });
    // 摆设：贴着上下墙放一些，走廊中间留空给教学用；实战区多几个掩体
    const busy = new Set(), put = (k, tx, ty, wide) => {
      for (let a = 0; a < wide; a++) if (busy.has((tx + a) + ',' + ty)) return;
      for (let a = 0; a < wide; a++) { F.solid[L.idx(F, tx + a, ty)] = 1; busy.add((tx + a) + ',' + ty); }
      F.props.push(D.makeProp(k, tx, ty, F.th, rng));
    };
    put('vending', 3, Y0, 1); put('bench', 8, Y0, 2); put('pillar', 15, Y0, 1); put('bin', 19, Y1, 1);
    put('crate', 25, Y0, 1); put('barrel', 26, Y0, 1); put('shelf', 44, Y0, 2); put('pillar', 34, Y0, 1);
    put('pillar', 56, Y0, 1); put('cabinet', 66, Y0, 1); put('bench', 72, Y1, 2);
    put('machine', 84, Y0, 2); put('barrel', 104, Y1, 1); put('pillar', 96, Y0, 1);
    put('cabinet', 112, Y0, 1); put('cabinet', 113, Y0, 1); put('desk', 126, Y0, 2);
    put('shelf', 137, Y0, 2); put('crate', 169, Y0, 1); put('planter', 152, Y0, 1);
    for (const [tx, ty] of [[185, 12], [186, 12], [192, 16], [198, 12], [199, 12], [204, 16]]) put('crate', tx, ty, 1);
    put('pillar', 190, Y0, 1); put('machine', 206, Y0, 2);
    put('bench', 216, Y0, 2); put('vending', 227, Y0, 1);
    for (const [tx, ty, k] of [[H.hidden.x + 1, H.hidden.y, 'crate'], [H.hidden.x + 9, H.hidden.y, 'barrel'], [H.vault.x + 1, H.vault.y + 4, 'cabinet'], [H.vault.x + 9, H.vault.y + 4, 'cabinet']]) put(k, tx, ty, 1);
    // 灯：每区上墙一排；闸门两头一盏青灯；金库暖金、隐藏房间暗
    for (const z of ZONES) for (let x = z.x0 + 2; x < z.x1; x += 5) F.lights.push({ x: x * TS + 8, y: Y0 * TS - 4, oy: 40, r: 100, col: F.th.lamp, a: 0.85, flick: 0.04, seed: rng() * 100, shaft: true });
    for (const g of F.gates) for (const yy of [g.y0 + 8, g.y1 - 8]) F.lights.push({ x: g.x, y: yy, r: 54, col: '#3ee8ff', a: 0.5, flick: 0.08, seed: rng() * 100 });
    for (let x = H.vault.x + 2; x < H.vault.x + H.vault.w; x += 4) F.lights.push({ x: x * TS + 8, y: H.vault.y * TS - 4, oy: 30, r: 80, col: '#ffd27a', a: 0.85, flick: 0.04, seed: rng() * 100, shaft: true });
    F.lights.push({ x: (H.hidden.x + 5) * TS, y: H.hidden.y * TS - 4, oy: 30, r: 90, col: F.th.lamp, a: 0.55, flick: 0.6, seed: rng() * 100, shaft: true });
    L.bake(F, rng);
    return F;
  };
  // 竖着的门洞：x 中心、y 从 ya 到 yb（含），宽 w；门洞的格子是裂缝墙（kind 3，打破 / 刷卡前算墙）
  function doorway(F, cx, ya, yb, w, ri) {
    const L = D.LV, h = Math.floor(w / 2);
    for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) for (let x = cx - h; x <= cx + h; x++) { const i = L.idx(F, x, y); F.solid[i] = 1; F.kind[i] = 3; }
  }

  // 闸门开关
  D.tutGateOpen = function (S, zi) {
    const F = S.floors[0], g = F && F.gates && F.gates.find(o => o.zone === zi); if (!g || g.open) return false;
    g.open = true; g.openT = S.t;
    for (let y = Y0; y <= Y1; y++) F.solid[D.LV.idx(F, g.tx, y)] = 0;
    S.flow = null; S.flowT = 0;
    if (S.f === 0 && D.K) { const K = D.K; for (let i = 0; i < 26; i++) K.part(S, 'spark', g.x + S.rng.range(-3, 3), S.rng.range(g.y0, g.y1), S.rng.range(-90, 90), S.rng.range(-60, 20), S.rng.range(0.3, 0.7), S.rng.pick(['#3ee8ff', '#c8f8ff', '#ffffff'])); K.flashLight(S, g.x, (g.y0 + g.y1) / 2, 120, '#3ee8ff', 1.2); K.addShake(S, 0.15); }
    return true;
  };
  D.tutZoneAt = x => { const tx = x / TS; let zi = 0; ZONES.forEach((z, i) => { if (tx >= z.x0 - 1) zi = i; }); return zi; };

  // 只换训练场：楼层 0 换成长厅，站台的上楼梯改名
  const ms0 = D.makeStation;
  D.makeStation = function (rng, st, opt) {
    const fl = ms0.apply(this, arguments);
    if (opt && opt.tut && st && st.id === 'tut' && D.LV) {
      fl[0] = D.tutHall(rng); fl.length = 2;
      const up = fl[1].stairs.find(s => s.to === 0); if (up) up.label = '回训练长厅';
      fl[1].contSpots = []; // 站台上面的房间不放箱子：教学自己放
    }
    return fl;
  };
})(D);
