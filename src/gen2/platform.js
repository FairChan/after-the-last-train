/* 站内地图第二代 P6 任务 1 · 站台层、换乘层用新骨架（design/features/station-gen/plan-p6.md；设计文档 5.1–5.2 节）
   D.gen2.platform(rng, st, opt, o) → 一层站台（站台层、换乘层），level.js 的 makeStation 调（P7 任务 3 起所有站，开关 D.TUNE.gen2.floors 和 G2.floorOn 删了）。
     o = { name, labels: { up, down }（楼层名、楼梯字由 level.js 给，新文件里不写中文）, upTo, downTo（下一层的楼层号，没有 = null）, upX（上楼梯的格 x）, exit, inter }
   玩法上的位置和旧版 genPlatform 一模一样：60×27；站台 (2, 12, 56, 8)；轨道沟 20–22 行（F.track）、登车区 F.boardY = 19 * 16 − 4；
     两头隧道口（F.tunnels）；上楼梯在 (upX, 12)、下到换乘层的楼梯在 (44, 12)；终点站的调度台 opt.console = (30, 18)。
   改的是站台上面：房间个数、种类照旧版规则抽（2–3 间，隐藏房的概率一样，没有门禁房），落在 4 个位里（y 2–8，位之间留竖缝，
     房间下面一排墙和站台的上墙之间隔一排空当），墙边对齐柱网；普通房拼形（同 mass.js）；通道、门洞、后门检修道走 concourse.js 的 G2.net
     （站台当大厅：最大的房间走主通道，其余次通道；有敌人的站挖后门直到环路 ≥ 2）；轨道沟和下面几行不许挖；
     主 / 次通道在房间那头只用离楼梯最近的门洞候选（旧版通道从房间正中直下站台，新版不挑的话门常开在远的那头，楼梯到房间的步数多出一半）。
     柱网：站台正中一排柱子（G2.grid，间距 7–9 格），离楼梯 4 格以上、离两头隧道口远一点，登车区那两行（18、19）一根都不放。
   输出字段和旧站台层一样，外加 F.gen2 = true、F.g2floor（'platform' / 'inter'）、F.doors、每间房的 cells / shape。
   随机数：只从 makeStation 的 rng 取一个数，派生 r2。
   D.gen2.trackTile(F, tx, ty)：新画法（P5，tiles.js）里轨道沟那几格的贴片——站台边沿的立面、道砟、轨枕、两条钢轨，色阶 + 4×4 抖动、左上亮。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, T2 = TS * Z, G2 = D.gen2 = D.gen2 || {};


  // 站台上方的 4 个房间位 [x, y, w, h]：房间格 y 2..8（下面一排墙在 9、空当 10、站台上墙 11）；两头的位和旧版一样往里收（离楼梯不比旧版远），
  //   中间两个位之间留 4 格（上楼梯 x = 30 在这里），其余位之间至少 1 格（房间缩一点更宽）
  const SLOTS = [[3, 2, 11, 7], [17, 2, 10, 7], [33, 2, 10, 7], [46, 2, 11, 7]];

  G2.platform = function (rng, st, opt, o) {
    const r2 = D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:plat:' + (o.inter ? 1 : 0)));
    const LV = D.LV, idx = LV.idx, T = D.STATION_TYPES[st.type], ROOMS = D.ROOMS;
    const F = LV.newFloor(60, 27, o.name, o.exit ? 'platform' : T.theme === 'mall' ? 'platform' : T.theme), W = F.tw, N = W * F.tht;
    F.gen2 = true; F.g2floor = o.inter ? 'inter' : 'platform'; F.doors = [];
    const plat = LV.addRoom(F, 2, 12, 56, 8, 'platform'); plat.shape = 'rect';
    // 轨道沟（不能走）、登车区、两头隧道口：位置同旧版
    for (let y = 20; y <= 22; y++) for (let x = 1; x < 59; x++) { const i = idx(F, x, y); F.solid[i] = 1; F.kind[i] = 2; }
    F.track = { y0: 20, y1: 22 }; F.boardY = 19 * TS - 4;
    F.tunnels.push({ x: 2 * TS + 4, y: 16 * TS, w: 18, h: 120, dir: -1, label: o.labels.tl }, { x: 58 * TS - 4, y: 16 * TS, w: 18, h: 120, dir: 1, label: o.labels.tr });
    // ── 上方房间：个数、种类照旧版（2–3 间；隐藏房 0.4 + 线路加成，一层最多一间）
    const grid = G2.grid(plat, r2.int(7, 9)), LT = D.LINE_THEMES[LV.line()] || {}, pool = LV.pool(st);
    const boxes = G2.boxes(r2, { slots: SLOTS, grid }, r2.int(2, 3));
    let hiddenDone = false;
    const rooms = boxes.map(b => {
      const hidden = !hiddenDone && r2.chance(0.4 + (LT.hiddenBoost || 0)), kind = hidden ? 'hidden' : r2.weighted(pool), hv = !!ROOMS[kind].hv;
      if (hidden) hiddenDone = true;
      const sh = G2.shape(r2, b, !hidden && !hv), r = LV.addRoom(F, b.x, b.y, b.w, b.h, kind, { hidden, hv });
      for (const [x0, y0, w, h] of sh.cut) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = idx(F, x, y); if (F.room[i] === r.i) { F.solid[i] = 1; F.kind[i] = 1; F.room[i] = -1; } }
      r.shape = sh.shape;
      return r;
    });
    const countCells = () => { const c = new Array(F.rooms.length).fill(0); for (let i = 0; i < N; i++) if (F.room[i] >= 0) c[F.room[i]]++; F.rooms.forEach((r, k) => { r.cells = c[k]; if (!r.shape) r.shape = 'rect'; }); };
    countCells();
    // ── 楼梯、调度台（同旧版）
    const upX = o.upX || 30;
    F.stairs.push({ x: upX * TS, y: 12 * TS + 6, dir: 'up', label: o.labels.up, to: o.upTo });
    if (o.downTo != null) F.stairs.push({ x: 44 * TS, y: 12 * TS + 6, dir: 'down', label: o.labels.down, to: o.downTo });
    if (o.exit) opt.console = { f: 1, x: 30 * TS, y: 18 * TS };
    const stairT = F.stairs.map(s => [Math.floor(s.x / TS), Math.floor(s.y / TS)]);
    F.keep = o.exit ? [[30, 18]] : [];
    // ── 通道、门洞、后门、柱子（G2.net）：站台当大厅；轨道沟往下不许挖；柱子只在站台正中那排、躲开楼梯和隧道口
    G2.net(F, r2, {
      halls: [plat], stairT, G: G2.edges(r2, [plat], rooms, 0, opt), safe: !!opt.safe, keep: F.keep.concat(F.tunnels.map(t => [Math.floor(t.x / TS), Math.floor(t.y / TS)])), gridOf: () => grid,
      block: i => ((i / W) | 0) >= F.track.y0,
      pillarOK: (x, y) => y <= F.track.y0 - 4 && x >= 5 && x <= W - 6 && stairT.every(([sx]) => Math.abs(sx - x) > 3),
      // 结构图的边（主 / 次通道）：房间那头只用离楼梯最近的几个门洞候选（门外那格到最近楼梯的步数，最近的 + 1 以内），楼梯到房间的步数才不比旧版多
      pick: (e, S, Gs) => {
        if (e.tier === 'staff' || e.a === plat) return [S, Gs];
        const dS = c => Math.min(...c.porch.map(p => Math.min(...stairT.map(([sx, sy]) => Math.abs(p % W - sx) + Math.abs(((p / W) | 0) - sy))))), best = Math.min(...S.map(dS));
        return [S.filter(c => dS(c) <= best + 1), Gs];
      },
    });
    for (const dr of F.doors) { delete dr.cells; delete dr.d; }
    countCells();
    return F;
  };

  // ── 轨道沟的贴片（P5 新画法）：每格 32×32 打包像素（同 tiles.js：ABGR），按"第几行 × 轨枕相位 × 道砟变体"缓存
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16 - 0.5;
  const hh = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  const pk = hex => { const n = parseInt(hex.slice(1, 7), 16); return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0; };
  const rampOf = (hex, ink, warm) => [0.72, 0.5, 0.28, 0, -0.16, -0.34, -0.55].map(k => pk(k >= 0 ? D.mixHex(hex, ink, k) : D.mixHex(hex, warm, -k)));
  let RAMPS = null;
  const ramps = () => RAMPS || (RAMPS = {
    gravel: rampOf('#4a4640', '#0b0a14', '#d8ccb4'), sleeper: rampOf('#5e5a54', '#0b0a14', '#e8e0d0'), rail: D.RAMP.steel.map(pk),
    lip: rampOf('#6a6e7e', '#0b0a14', '#f0f0ff'), rust: D.RAMP.rust.map(pk), pit: rampOf('#24242a', '#05040c', '#6a6a78'),
  });
  const pick = (R, v, x, y) => R[Math.max(0, Math.min(R.length - 1, Math.floor(Math.max(0, Math.min(0.999, v)) * R.length + dith(x, y) * 0.9)))];
  const TRACK = new Map();
  G2.trackTile = function (F, tx, ty) {
    const row = ty - F.track.y0, ph = ((tx % 7) + 7) % 7, vr = hh(tx, ty, 41) % 3, key = row + '|' + ph + '|' + vr;
    let t = TRACK.get(key); if (t) return t;
    t = new Uint32Array(T2 * T2); const R = ramps();
    for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) {
      const X = ph * T2 + x, Y = row * T2 + y, n = (hh(X, Y, 7 + vr) & 1023) / 1023, stone = hh(X >> 1, Y >> 1, 3 + vr) & 15;
      // 道砟：碎石的明暗（2×2 一颗石子，左上那颗亮一点），轨道中间一道排水沟更暗
      let c = pick(R.gravel, 0.18 + 0.22 * n + (stone < 3 ? 0.18 : 0) - (((X & 1) | (Y & 1)) ? 0.06 : 0), x, y);
      if (Y >= 42 && Y <= 48) c = pick(R.pit, 0.3 + 0.25 * n, x, y);
      // 轨枕：每 14 像素一根、宽 8（同旧画法），倒角：左、上亮，右、下暗
      const sx = X % 14, sy0 = 14, sy1 = 82;
      if (sx < 8 && Y >= sy0 && Y < sy1) { const v = 0.42 + (sx === 0 ? 0.25 : sx === 7 ? -0.2 : 0) + (Y === sy0 ? 0.22 : Y === sy1 - 1 ? -0.22 : 0) + 0.06 * (n - 0.5); c = pick(R.sleeper, v, x, y); }
      // 钢轨：本地 y 30、60（同旧画法）；顶面亮边、轨腰暗；扣件压在轨枕上；轨下一道抖动的影子
      for (const ry of [30, 60]) {
        const d = Y - ry;
        if (d === 6 || d === 7) { if (dith(x, y) + 0.5 < (d === 6 ? 0.7 : 0.35)) c = R.pit[0]; }
        if (d >= -1 && d <= 5 && sx < 8 && (d === -1 || d === 5) && (sx === 2 || sx === 5)) c = pick(R.rust, 0.5, x, y);
        if (d >= 0 && d <= 4) c = R.rail[[6, 5, 3, 2, 1][d]];
      }
      // 第一行顶上：站台边沿的立面（混凝土，上亮下暗），下面一道站台投下的影子
      if (row === 0 && y < 7) c = pick(R.lip, y === 0 ? 0.95 : y === 1 ? 0.75 : 0.58 - 0.07 * y + 0.08 * (n - 0.5), x, y);
      else if (row === 0 && y < 12 && dith(x, y) + 0.5 < 0.85 - (y - 7) * 0.16) c = R.pit[0];
      t[y * T2 + x] = c;
    }
    TRACK.set(key, t); return t;
  };
})(D);
