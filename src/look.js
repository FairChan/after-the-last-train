/* 末班之后 · 小样二：M6 画面：三套新环境主题（旧城瓷砖、混凝土隧道、冷光机房）和它们的地面花纹；
   所有敌人（包括首领）的整体动作（呼吸、走路颠、蓄势、出手、挨打、晕、出生）；击毁时的残骸（压扁、变暗、散掉）。
   只通过挂钩接进 level.js（D.paintFloorTile）、draw.js（drawEnemy 前后的 D.foePose、D.drawExtras）、enemy.js（K.onKillX）。
   设计：design/features/av/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {});

  // ── 环境主题（3 → 6）：pattern 是地面花纹
  Object.assign(D.THEMES, {
    tile:     { name: '旧城瓷砖', floor: ['#5a675d', '#5f6c62', '#566259'], grout: '#93a596', wall: '#161a15', face: ['#3e4a41', '#4d5b50'], neon: ['#ffd27a', '#8dff6a'], ambient: '#24302a', lamp: '#ffe8b8', pattern: 'mosaic' },
    concrete: { name: '混凝土隧道', floor: ['#433b31', '#473f34', '#3e372e'], grout: '#191612', wall: '#181614', face: ['#3a332b', '#463d33'], neon: ['#ff9a3a', '#ffd27a'], ambient: '#2c2116', lamp: '#ffa94a', pattern: 'slab' },
    lab:      { name: '冷光机房', floor: ['#161d2e', '#182033', '#141a2a'], grout: '#22406a', wall: '#0e1220', face: ['#1a2236', '#212b44'], neon: ['#3ee8ff', '#e8f4ff', '#7f9bff'], ambient: '#141a30', lamp: '#bfe8ff', pattern: 'grid' },
  });
  Object.assign(D.THEMES.platform, { name: '站台' }); Object.assign(D.THEMES.mall, { name: '商场' }); Object.assign(D.THEMES.depot, { name: '车库' });
  const USE = { tile: ['ruin', 'hospital', 'refuge', 'flooded', 'nest'], concrete: ['hangar', 'armory', 'freight', 'blackout', 'cache'], lab: ['datacenter', 'dispatch', 'relay', 'checkpoint'] };
  for (const th in USE) for (const k of USE[th]) if (D.STATION_TYPES[k]) D.STATION_TYPES[k].theme = th;

  // ── 地面花纹：在原来的地砖上再画一层（房间自己有地面配色的不改）
  const pf0 = D.paintFloorTile;
  D.paintFloorTile = function (x, F, tx, ty, rng) {
    pf0(x, F, tx, ty, rng);
    const pat = F.th && F.th.pattern; if (!pat) return;
    const ri = F.room[ty * F.tw + tx], r = ri >= 0 ? F.rooms[ri] : null; if (r && D.ROOMS[r.kind] && D.ROOMS[r.kind].floor !== 'theme') return;
    const T2 = 16 * D.Z, q = T2 / 4, px = tx * T2, py = ty * T2, R = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); }, g = F.th.grout;
    if (pat === 'mosaic') { // 小方砖：缝更密，偶尔一块亮一点或缺一角
      for (const o of [q, 3 * q]) { R(px + o, py, 1, T2, g); R(px, py + o, T2, 1, g); }
      for (let i = 0; i < 2; i++) { const a = ((tx * 13 + ty * 7 + i * 5) % 4) * q, b = ((tx * 5 + ty * 11 + i * 3) % 4) * q; R(px + a + 1, py + b + 1, q - 1, q - 1, i ? '#ffffff0e' : '#00000022'); }
    } else if (pat === 'slab') { // 大混凝土板：只有板缝，斑点和水渍
      R(px, py, T2, T2, F.th.floor[(Math.floor(tx / 2) * 7 + Math.floor(ty / 2) * 13) % F.th.floor.length]);
      if (tx % 2 === 0) { R(px, py, 2, T2, g); R(px + 2, py, 1, T2, '#ffffff0c'); } if (ty % 2 === 0) { R(px, py, T2, 2, g); R(px, py + 2, T2, 1, '#ffffff0c'); }
      for (let i = 0; i < 6; i++) R(px + ((tx * 17 + i * 11 + ty * 3) % (T2 - 2)) + 1, py + ((ty * 19 + i * 7 + tx * 5) % (T2 - 2)) + 1, 1, 1, i % 2 ? '#00000038' : '#ffffff12');
      if ((tx * 3 + ty * 5) % 11 === 0) { R(px + 4, py + 6, T2 - 10, 4, '#00000030'); R(px + 8, py + 10, T2 - 16, 3, '#0000001c'); } // 油渍
    } else if (pat === 'grid') { // 冷光机房：暗面板 + 发光的网格线和角钉
      R(px, py, T2, 1, '#3ee8ff26'); R(px, py, 1, T2, '#3ee8ff26'); R(px + 2 * q, py, 1, T2, '#3ee8ff10'); R(px, py + 2 * q, T2, 1, '#3ee8ff10');
      R(px + 1, py + 1, 2, 2, '#9fe9ff40'); if ((tx + ty) % 3 === 0) R(px + q, py + 3 * q, 2 * q, 1, '#3ee8ff1c');
    }
  };

  // ── 敌人的整体动作：返回 { sx, sy, rot, dx, dy }，以脚底为轴（draw.js 的 drawEnemy 前后套变换）
  const FLY = new Set(['drone', 'medic', 'bomber', 'jammer', 'queen', 'sniper']);
  const CROUCH = new Set(['leap', 'charge', 'slam', 'slash2', 'arm', 'brood']);
  // 用户："主角和敌人的动画也改一下"：再加一层身体的惯性——
  //   往哪走往哪倾（飞的倾得更多，像侧着飞），起步、刹车甩一下（弹簧）；换朝向时转个身（横向收窄再展开）；
  //   走路每一步落脚压扁一下；挨打以后像果冻一样再晃两下；没发现你的时候隔几秒回头张望一下（转过去看 0.9 秒再转回来）。
  //   一帧里可能算好几次：只有 S.t 往前走了才推进弹簧和计时。
  const TURN = 0.11;
  const turnSx = u => { const c = -Math.cos(Math.PI * Math.min(1, u)); return (c < 0 ? -1 : 1) * Math.max(0.3, Math.abs(c)); };
  D.foePose = function (S, e) {
    if (e.dormant) return null;
    const ph = e.t + (e.slot || 0), face = e.face || 1, fly = FLY.has(e.kind) || FLY.has(e.ai), still = e.kind === 'turret';
    let sx = 1, sy = 1, rot = 0, dx = 0, dy = 0;
    // 走没走：画的时候按两次画之间的位移算（和帧率无关）
    const dt = e._pt != null ? Math.min(0.05, S.t - e._pt) : 0;
    if (dt > 0) {
      const vx = (e.x - e._px) / (S.t - e._pt), v = Math.hypot(e.x - e._px, e.y - e._py) / (S.t - e._pt);
      e._mv = (e._mv || 0) * 0.8 + Math.min(1, v / 25) * 0.2;
      e._vx = (e._vx || 0) * 0.7 + vx * 0.3;
      const tgt = still ? 0 : Math.max(-1.3, Math.min(1.3, e._vx / 60)) * (fly ? 0.16 : 0.08);
      e._lv = (e._lv || 0) + ((tgt - (e._ln || 0)) * 240 - (e._lv || 0) * 15) * dt; e._ln = (e._ln || 0) + e._lv * dt;
      if (e._f !== face) { e._turn = (e._turn == null || e._turn >= TURN) && e._f != null ? 0 : TURN; e._f = face; } else e._turn = (e._turn == null ? TURN : e._turn) + dt;
      if (!e.aware && !(e.tele > 0) && !e.act && e._mv < 0.2 && !still) e._idle = (e._idle || 0) + dt; else e._idle = 0;
    } else if (e._f == null) e._f = face;
    e._px = e.x; e._py = e.y; e._pt = S.t;
    const b = 0.03 * Math.sin(ph * 3); sy += b; sx -= b * 0.5; // 呼吸
    if (!still && !fly && e._mv > 0.3) {
      const st = Math.sin(ph * 14), land = Math.max(0, 1 - Math.abs(st) * 4); // 两步之间脚落地那一下
      dy -= Math.abs(st) * e._mv; rot += 0.07 * st * e._mv; sy -= 0.06 * land * e._mv; sx += 0.05 * land * e._mv;
    }
    if (fly && !still) rot += 0.04 * Math.sin(ph * 2.3);
    rot += Math.max(-0.22, Math.min(0.22, e._ln || 0));
    if (e.tele > 0 && e.teleMax) { const k = 1 - e.tele / e.teleMax, it = e.intent && e.intent.k; if (CROUCH.has(it)) { sy -= 0.18 * k; sx += 0.12 * k; } else if (!still) { rot -= face * 0.1 * k; sy += 0.05 * k; } else sy += 0.06 * k; }
    if (e.act && e.act.t != null && e.act.t < 0.12 && !still) { rot += face * 0.1; sx += 0.06; }
    const since = e.hurtAt == null ? 9 : e.t - e.hurtAt;
    if (since < 0.14) { const q = 1 - since / 0.14; sx += 0.14 * q; sy -= 0.14 * q; dx -= face * q; }
    else if (since < 0.5) { const s2 = since - 0.14, w = Math.sin(s2 * 38) * Math.exp(-s2 * 9) * 0.09; sx -= w; sy += w; } // 挨打以后晃两下
    if (e.stun > 0) rot += 0.18 * Math.sin(S.t * 22);
    if (e.spawnT > 0) { const s = 1 - 0.4 * Math.min(1, e.spawnT / 0.35); sx *= s; sy *= s; }
    // 转身；没发现你、站着不动时隔几秒回头张望（只是画面上转过去，朝向、视线都不变）
    if (!still && e._turn < TURN) sx *= turnSx(e._turn / TURN);
    if (e._idle > 0) {
      const per = 4.5 + ((e.slot || 0) * 7.3) % 3, u = e._idle % per, L = 0.9 + TURN * 2; // 站定以后第一次张望在 3–6 秒后，每只的间隔不一样
      if (u > per - L) { const w = u - (per - L); sx *= w < TURN ? -turnSx(w / TURN) : w > L - TURN ? turnSx((w - (L - TURN)) / TURN) : -1; } // 转过去 → 看一会儿 → 转回来
    }
    if (e.frz > 0) return { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 };
    return { sx, sy, rot, dx, dy };
  };

  // ── 残骸：击毁时图像压扁、变暗、散掉（0.45 秒）
  const SPR_OF = { raider: 'raiderBody', gunner: 'gunner' };
  const kx0 = K.onKillX;
  K.onKillX = function (S, e) {
    if (kx0) kx0(S, e);
    const spr = !e.phantom && e.kind !== 'boss' && D.SPR && D.SPR[SPR_OF[e.kind] || e.kind];
    // 存精灵的名字、不存图片本身：联机时这份状态要发给队友，图片发不过去（以前队友那边一画就报错，亮度滤镜没复位，画面一直暗、灯光堆起来闪白）
    // dir：往哪边倒（被打飞的方向，没有就往背后倒）
    if (spr) (S.corpses = S.corpses || []).push({ sk: SPR_OF[e.kind] || e.kind, x: e.x, y: e.y - (FLY.has(e.kind) ? 6 : 0), f: e.f, flip: e.face < 0, t0: S.t, dir: Math.sign(e.vx || 0) || -(e.face || 1) });
  };
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    if (de0) de0(S, list, ctx, ex);
    if (!S.corpses || !S.corpses.length) return;
    S.corpses = S.corpses.filter(c => S.t - c.t0 < 0.45);
    for (const c of S.corpses) { const spr = D.SPR && D.SPR[c.sk]; if (c.f === S.f && spr) list.push({ y: c.y - 0.5, f: () => {
      const k = Math.min(1, (S.t - c.t0) / 0.45);
      ctx.save();
      try {
        // 先被打得往上一弹、往一边歪，再倒下去压扁
        const pop = k < 0.2 ? Math.sin(k / 0.2 * Math.PI) : 0, tip = (c.dir || 1) * 0.55 * (1 - (1 - k) * (1 - k));
        ctx.translate(c.x + (c.dir || 1) * k * 3, c.y - pop * 3); ctx.rotate(tip); ctx.scale(1 + k * 0.35 - pop * 0.1, Math.max(0.1, 1 - k * 0.85 + pop * 0.15)); ctx.translate(-c.x, -c.y);
        ctx.globalAlpha = 1 - k * k; ctx.filter = 'brightness(' + Math.round(100 - 60 * k) + '%)'; D.blit(ctx, spr, c.x, c.y, c.flip, null);
      } finally { ctx.filter = 'none'; ctx.restore(); } // 出了错也要复位：滤镜漏出去整个画面就一直是暗的
    } }); }
  };
})(D);
