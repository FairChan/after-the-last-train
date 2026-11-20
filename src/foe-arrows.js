/* Underdog：敌人方向箭头（用户 2026-11-15："当敌人在一定距离内，用红色箭头指向敌人"；同日改："指示敌人的箭头只有不在屏幕里才显示，
   位置在屏幕边缘，类似撤离点的指示箭头；只是附近的敌人，全图太远的不警告"）
   - 同一层、离你 RANGE（200 世界单位）以内、并且不在屏幕里的敌人，在屏幕边缘画一个红色像素箭头指着它：
     箭头钳在屏幕边缘（离边 MX，上下避开顶上和底下的 HUD），朝向敌人；和撤离点的绿箭头一个画法（draw.js hud、minimap.js）。
   - 屏幕里看得见的不画；离得远的（RANGE 以外）不画；贴脸（NEAR 以内）的不画。
   - 搜刮面板是盖在右边的半透明框：它盖住的那一块也算"屏幕外"，箭头钳在面板左边那条线上。
   - 越近越大；已经发现你的敌人箭头一跳一跳往外顶，正在蓄力出招的闪白；首领是双箭头。
   - 最多 MAX 个（最近的那几个），挤在同一处的沿边错开；进出范围淡入淡出（进了画面的那一刻直接收掉）。
   - 不画：装死的假人（dormant）、隐身中的潜伏者（cloakOn）、刚刷出来还没站稳的、你还在车上、坐电梯、过场、标题页。
   - 设置"画面"里可以关（D.settings.foeArrows）。
   - 接法：包一层 D.drawStation，画完整帧（含 HUD）以后在屏幕坐标上画；放在 floorfx / lift 之前加载，
     换层过渡、电梯井剖面盖在箭头上面。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, Z = D.Z, TAU = Math.PI * 2;
  const RANGE = 200, NEAR = 30, MAX = 6, STEP = 12;
  const MX = 22, MTOP = 44, MBOT = 46; // 箭头离屏幕边的距离（钳到这个框里；和撤离点的箭头一样，上下避开 HUD）
  const PAD = 6;                        // 离屏幕边这么近也算看得见，不画箭头
  const fade = new WeakMap();
  const A = D.FoeArrows = { RANGE, NEAR, MAX, MX, last: [] };
  let lastT = null;

  // 箭头外形（朝 +x，单位是画面像素）：尖、两翼、尾巴中间一个缺口；下半边暗一档（像折出来的一个面）
  const SHAPE = [[8, 0], [-5, -6], [-2, 0], [-5, 6]], LOW = [[8, 0], [-2, 0], [-5, 6]];
  const DARK = '#a8142c', TIP = '#ffd0d4', DIRS = 32; // 外形按 32 个方向转（位置用准确角度），敌人慢慢走时箭头不会一闪一闪变形
  function fillPoly(ctx, pts) { // 按整像素扫描线填（不抗锯齿，和像素画对齐）
    let y0 = Infinity, y1 = -Infinity; for (const q of pts) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    for (let y = Math.floor(y0); y < y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]); if (xb > xa) ctx.fillRect(xa, y, xb - xa, 1); }
    }
  }
  function arrow(ctx, x, y, a, sc, col, alpha) {
    a = Math.round(a / TAU * DIRS) / DIRS * TAU;
    const c = Math.cos(a), s = Math.sin(a), at = sh => sh.map(([u, v]) => [x + 0.5 + (u * c - v * s) * sc, y + 0.5 + (u * s + v * c) * sc]), pts = at(SHAPE);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = P.k; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) fillPoly(ctx, pts.map(q => [q[0] + dx, q[1] + dy])); // 一圈黑边
    ctx.fillStyle = col; fillPoly(ctx, pts);
    if (col !== '#ffffff') { ctx.fillStyle = DARK; fillPoly(ctx, at(LOW)); }
    ctx.fillStyle = TIP; ctx.fillRect(Math.round(x + 4 * sc * c), Math.round(y + 4 * sc * s), 1, 1); // 尖上一点亮
    ctx.globalAlpha = 1;
  }
  const hidden = e => e.dead || e.dormant || e.cloakOn || e.spawnT > 0;

  // 搜刮面板是盖在右边的半透明框（ui-bag.js 的 .inv.loot）：它盖住的那一块也算"屏幕外"，返回画面里被盖住的宽度（画面像素）
  function coveredRight() {
    const pan = document.querySelector('.inv.loot'), cv = (D.Input && D.Input.canvas) || document.querySelector('canvas');
    if (!pan || !cv) return 0;
    const cr = cv.getBoundingClientRect(), pr = pan.getBoundingClientRect();
    if (!cr.width || pr.left >= cr.right) return 0;
    return Math.min(D.W, (cr.right - Math.max(pr.left, cr.left)) / cr.width * D.W);
  }

  A.draw = function (ctx, S, time) {
    const dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, time - lastT)); lastT = time;
    A.last = [];
    const p = S.player, ST = D.settings || {};
    const off = ST.foeArrows === false || S.noHud || S.outro || S.lift || !p || p.hp <= 0 || (D.offstage && D.offstage(S));
    const VW = D.W - (off ? 0 : coveredRight()); // 看得到的画面宽（右边被面板盖住的不算）
    const rcx = S.recoil ? -Math.cos(S.recoilA) * S.recoil * 0.5 : 0, rcy = S.recoil ? -Math.sin(S.recoilA) * S.recoil * 0.5 : 0;
    const cx = Math.round((S.cam.x + rcx) * Z) / Z, cy = Math.round((S.cam.y + rcy) * Z) / Z;
    // 每个同一层的敌人在画面上的位置（画面像素）；out = 不在画面里
    const info = new Map();
    if (!off) for (const e of S.enemies) {
      if (hidden(e) || (e.f != null && e.f !== S.f)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y), sx = (e.x - cx) * Z, sy = (e.y - 6 - cy) * Z; // 6：胸口的高度
      const inside = sx >= PAD && sx <= VW - PAD && sy >= PAD && sy <= D.H - PAD;
      info.set(e, { d, sx, sy, out: !inside });
    }
    // 选出要指的：不在画面里、范围内的，按远近取最近的 MAX 个
    const cand = [];
    for (const [e, o] of info) if (o.out && o.d >= NEAR && o.d <= RANGE) cand.push([e, o]);
    cand.sort((a, b) => a[1].d - b[1].d); cand.length = Math.min(cand.length, MAX);
    const want = new Set(cand.map(c => c[0]));
    // 淡入淡出（退出范围的那几帧还接着画，越来越淡；进了画面的直接收掉）
    const draw = [];
    for (const e of S.enemies) {
      const o = info.get(e), on = !!o && want.has(e);
      let f = fade.get(e) || 0;
      if (e.dead || hidden(e) || !o || !o.out) f = 0; else f = on ? Math.min(1, f + dt * 6) : Math.max(0, f - dt * 4);
      if (!dt && on) f = Math.max(f, 0.35); // 第一帧（读档、截图）也看得见
      fade.set(e, f);
      if (f > 0.02 && o && o.out) draw.push({ e, f, d: o.d, sx: o.sx, sy: o.sy });
    }
    if (!draw.length) return;
    draw.sort((a, b) => a.d - b.d);
    const placed = [];
    for (const o of draw) {
      const e = o.e;
      // 钳到屏幕边缘（和撤离点箭头一样：横、竖各钳一下），箭头朝向敌人
      const bx = D.clamp(o.sx, MX, VW - MX), by = D.clamp(o.sy, MTOP, D.H - MBOT);
      const a = Math.atan2(o.sy - by, o.sx - bx), vert = bx <= MX + 0.5 || bx >= VW - MX - 0.5;
      // 几个箭头挤在同一处：沿着边错开
      let x = bx, y = by;
      for (const k of [0, STEP, -STEP, STEP * 2, -STEP * 2, STEP * 3, -STEP * 3]) {
        const nx = vert ? bx : D.clamp(bx + k, MX, VW - MX), ny = vert ? D.clamp(by + k, MTOP, D.H - MBOT) : by;
        if (!placed.some(q => Math.hypot(q.x - nx, q.y - ny) < 10)) { x = nx; y = ny; break; }
      }
      placed.push({ x, y });
      const boss = !!(D.ENEMIES && D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss);
      const c = D.clamp(1 - (o.d - NEAR) / (RANGE - NEAR), 0, 1);
      const sc = (c > 0.55 ? 1.2 : 1) * (boss ? 1.15 : 1);
      const tele = e.tele > 0 && (time * 12 | 0) % 2;
      const alpha = o.f * (0.55 + 0.45 * c) * (e.aware ? 1 : 0.75);
      const bob = e.aware ? Math.round(1.5 + 1.5 * Math.sin(time * 9 + (e.slot || 0) * 1.7)) : 0; // 发现你了：一跳一跳往外顶
      const ax = Math.round(x + Math.cos(a) * bob), ay = Math.round(y + Math.sin(a) * bob);
      A.last.push({ e, a, x: ax, y: ay, r: 0, alpha, boss });
      o.x = ax; o.y = ay; o.a = a; o.sc = sc; o.col = tele ? '#ffffff' : P.r; o.alpha = alpha; o.boss = boss;
    }
    for (let i = draw.length - 1; i >= 0; i--) { // 远的先画，近的盖在上面
      const o = draw[i];
      arrow(ctx, o.x, o.y, o.a, o.sc, o.col, o.alpha);
      if (o.boss) arrow(ctx, Math.round(o.x - Math.cos(o.a) * 8 * o.sc), Math.round(o.y - Math.sin(o.a) * 8 * o.sc), o.a, o.sc, o.col, o.alpha * 0.8);
    }
  };

  const ds0 = D.drawStation;
  D.drawStation = function (ctx, S, time) {
    const r = ds0.apply(this, arguments);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
    try { A.draw(ctx, S, time); } finally { ctx.restore(); }
    return r;
  };
})(D);
