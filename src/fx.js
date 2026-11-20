/* 末班之后 · 小样二：弹道、投掷物、爆炸、打墙，以及粒子 / 飘字 / 光 / 震屏这些效果小工具（从 combat.js 拆出来） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, Z = D.Z, VW = D.W / Z, VH = D.H / Z, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const Q = () => D.QUALITY;
  const K = D.K || (D.K = {}); // 站内各文件共用的内部函数
  // 别的文件里定义的函数：调用时再去 D.K 上找
  const hurt = (...a) => K.hurt(...a);
  const damagePlayer = (...a) => K.damagePlayer(...a);

  // ───────────────────────── 弹道与投掷物
  // 多人联机（mp-core.js）：PL = 站里的所有玩家（单人时是 null，走老路）；谁打出去的子弹 / 手雷（o.pl）就换成谁的视角结算（击毁、电容、回血归他）
  const own = (S, PL, o) => { if (PL && o.pl && o.pl !== S.player && PL.includes(o.pl)) D.MP.use(S, o.pl); };
  const back = (S, PL) => { if (PL && S.player !== PL[0]) D.MP.use(S, PL[0]); };
  function projectiles(S, dt, es) {
    const p0 = S.player, PL = S.players && S.players.length > 1 ? S.players : null;
    for (const s of S.shots) {
      back(S, PL); own(S, PL, s); const p = S.player;
      if (s.homing) K.steer(S, s, dt); // M5：追踪枪
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (D.solidAt(S.A, s.x, s.y + 6)) { if (s.bounce > 0 && K.bounce(S, s, dt)) continue; s.life = 0; hitWall(S, s.x, s.y + 6, s.dmg); impact(S, s); continue; }
      for (const e of S.enemies) if (!e.dead && e.f === S.f && !s.hit.has(e) && Math.hypot(e.x - s.x, e.y - 5 - e.z - s.y) < e.r + s.r + 1.5) {
        s.hit.add(e);
        // 工程机正面护盾挡子弹
        if ((e.kind === 'engineer' || (D.ENEMIES[e.kind].fshield && !e.shieldOff)) && Math.abs(D.angDiff(e.shieldA, Math.atan2(s.y - e.y, s.x - e.x))) < 0.9 && !s.over) { s.life = 0; for (let i = 0; i < 6; i++) part(S, 'spark', s.x, s.y, -s.vx * 0.3 + S.rng.range(-60, 60), -s.vy * 0.3 + S.rng.range(-60, 60), 0.25, P.c); sfx('ding'); e.shieldHit = 0.12; break; }
        hurt(S, e, s.dmg * (K.shotMul ? K.shotMul(S, s, e) : 1), { kx: s.vx, ky: s.vy, kb: s.over ? 140 : s.flame ? 5 : 50, col: s.col, dot: s.flame });
        if (K.shotHit) K.shotHit(S, s, e); // M5：着火、钩爪、电磁
        if (!s.over && K.capGain) K.capGain(S, D.SHELL.capPerDmg * s.dmg); // 子弹打中给电容充电（超级弹不算，免得一直循环）
        S.player.meleeCd -= 0.08;
        if (!s.pierce) { s.life = 0; if (s.boom) impact(S, s); break; }
        if (s.over) impact(S, s);
      }
      if (s.life <= 0 && (s.over || s.boom)) impact(S, s);
      back(S, PL);
    }
    back(S, PL);
    S.shots = S.shots.filter(s => s.life > 0);
    for (const s of S.eshots) {
      back(S, PL);
      s.x += s.vx * dt * es; s.y += s.vy * dt * es; s.life -= dt;
      if (D.solidAt(S.A, s.x, s.y + 6)) { s.life = 0; for (let i = 0; i < 4; i++) part(S, 'spark', s.x, s.y, S.rng.range(-40, 40), S.rng.range(-40, 40), 0.2, s.col); continue; }
      if (S.decoy && Math.hypot(S.decoy.x - s.x, S.decoy.y - 6 - s.y) < 7) { s.life = 0; continue; }
      const p = PL ? PL.find(q => q.hp > 0 && !q.out && Math.hypot(q.x - s.x, q.y - 6 - s.y) < q.r + s.r - 1) || p0 : p0; // 联机：打中谁算谁
      if (Math.hypot(p.x - s.x, p.y - 6 - s.y) < p.r + s.r - 1 && p.hp > 0 && !p.out) {
        if (p !== S.player) D.MP.use(S, p);
        if (p.inv > 0) { if (!s.pd) { s.pd = true; K.perfectDodge(S); } continue; }
        s.life = 0; damagePlayer(S, s.dmg, s);
        if (s.k === 'hook' && s.from && !s.from.dead) { const a = Math.atan2(s.from.y - p.y, s.from.x - p.x); p.vx = Math.cos(a) * 280; p.vy = Math.sin(a) * 280; p.pullT = 0.32; text(S, p.x, p.y - 28, 'HOOK', P[5]); S.beams.push({ x0: s.from.x, y0: s.from.y - 10, x1: p.x, y1: p.y - 6, t: 0.32, max: 0.32, col: P[5] }); sfx('charge2'); }
        back(S, PL);
      }
    }
    back(S, PL);
    S.eshots = S.eshots.filter(s => s.life > 0);
    for (const m of S.mines) {
      m.t += dt;
      if (m.t < m.fly) { const k = m.t / m.fly; m.x = D.lerp(m.sx, m.tx, k); m.y = D.lerp(m.sy, m.ty, k); m.z = Math.sin(k * Math.PI) * 18; continue; }
      m.z = 0; const armed = m.t > m.fly + m.arm; let boom = m.t > m.fly + m.life;
      if (armed) for (const e of S.enemies) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 18 + e.r) boom = true;
      if (boom) { m.dead = true; own(S, PL, m); explode(S, m.x, m.y, 36, m.dmg); back(S, PL); }
    }
    S.mines = S.mines.filter(m => !m.dead);
    // 迫击炮弹：落点有圈，落地爆炸
    for (const sh of S.shells) { sh.t += dt * es; if (sh.t >= sh.dur) { sh.dead = true; explode(S, sh.tx, sh.ty, 18, sh.dmg, true, true); } }
    S.shells = S.shells.filter(s => !s.dead);
    // 手雷：抛过去，引信走完就炸
    for (const n of S.nades) {
      n.t += dt * es;
      if (n.t < n.fly) { const k = n.t / n.fly; n.x = D.lerp(n.sx, n.tx, k); n.y = D.lerp(n.sy, n.ty, k); n.z = Math.sin(k * Math.PI) * 22; }
      else { n.z = 0; if (n.t >= n.fly + n.fuse) { n.dead = true; if (n.own) { own(S, PL, n); nadeBoom(S, n); back(S, PL); } else explode(S, n.x, n.y, 26, n.dmg, true, true); } }
    }
    S.nades = S.nades.filter(n => !n.dead);
  }
  // 玩家的手雷：高爆炸敌人；冰冻让敌人慢下来；电磁让机器瘫痪、护盾清零（对人类无效）
  function nadeBoom(S, n) {
    if (K.nadeBoomX && K.nadeBoomX(S, n)) return; // M5：榴弹、烟雾弹、闪光弹
    if (n.kind === 'frag') { explode(S, n.x, n.y, 30, n.dmg, false); K.alertAround(S, n.x, n.y, 200); return; }
    const frz = n.kind === 'freeze', R = frz ? 36 : 42, col = frz ? '#8fe8ff' : '#ffd84a';
    for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - n.x, e.y - n.y) < R + e.r) {
      if (frz) { e.frz = 4; hurt(S, e, 4, { kx: e.x - n.x, ky: e.y - n.y, kb: 0, col }); }
      else if (!D.ENEMIES[e.kind].human) { e.stun = Math.max(e.stun || 0, D.ENEMIES[e.kind].boss ? 1 : 2.5); e.shield = 0; e.act = null; e.tele = 0; hurt(S, e, 6, { kx: e.x - n.x, ky: e.y - n.y, kb: 0, col }); }
    }
    ring(S, n.x, n.y, R, col); ring(S, n.x, n.y, R * 0.6, col); flashLight(S, n.x, n.y, R * 2.5, col, 1.2);
    for (let i = 0; i < 22; i++) { const a = S.rng() * TAU, v = S.rng.range(40, 120); part(S, 'spark', n.x, n.y - 2, Math.cos(a) * v, Math.sin(a) * v * 0.6, 0.5, col); }
    addShake(S, 0.25); sfx(frz ? 'cool' : 'zap');
  }
  function hitWall(S, x, y, dmg) {
    const A = S.A, tx = Math.floor(x / TS), ty = Math.floor(y / TS); if (A.kind[ty * A.tw + tx] !== 3) return;
    const br = A.breakables.find(b => !b.open && Math.abs(b.tx - tx) <= 1 && Math.abs(b.ty - ty) <= 1); if (!br) return;
    if (br.lock) { sfx('ding'); return; } // 门禁房的门：只能刷卡
    br.hp -= dmg; for (let i = 0; i < 6; i++) part(S, 'debris', x, y, S.rng.range(-60, 60), S.rng.range(-60, 20), 0.6, P[3]);
    if (br.hp <= 0) { D.openBreakable(A, br, S.fx); for (let i = 0; i < 30; i++) part(S, 'debris', br.x, br.y, S.rng.range(-120, 120), S.rng.range(-120, 60), S.rng.range(0.5, 1.1), S.rng.pick([P[2], P[3], P[4]])); for (let i = 0; i < 10; i++) part(S, 'smoke', br.x + S.rng.range(-10, 10), br.y, S.rng.range(-20, 20), S.rng.range(-30, -5), 1, '#3a3a4a'); addShake(S, 0.5); sfx('boom'); S.flow = null; S.flowT = 0; }
    else sfx('ding');
  }
  D.hitWall = hitWall;
  function impact(S, s) {
    if (s.over || s.boom) { if (s.boomed) return; s.boomed = true; explode(S, s.x, s.y, s.boom || 22, s.boom ? Math.round(s.dmg * 0.6) : 10); return; }
    for (let i = 0; i < 5; i++) part(S, 'spark', s.x, s.y, -s.vx * 0.2 + S.rng.range(-50, 50), -s.vy * 0.2 + S.rng.range(-50, 50), 0.25, P.O);
  }
  // hostile：敌人的爆炸（会伤到你）；ally 时也伤机器（自爆蜂殉爆、迫击炮误伤）
  function explode(S, x, y, r, dmg, hostile, both) {
    if (!hostile || both) for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - x, e.y - y) < r + e.r) hurt(S, e, hostile ? Math.round(dmg * 0.5) : dmg, { kx: e.x - x, ky: e.y - y, kb: 130, col: P.O });
    if (hostile) { const PL = S.players && S.players.length > 1 ? S.players : [S.player], p0 = S.player; for (const p of PL) if (!p.out && Math.hypot(p.x - x, p.y - y) < r + p.r) { if (p !== S.player) D.MP.use(S, p); damagePlayer(S, dmg, { x, y }); } if (S.player !== p0) D.MP.use(S, p0); } // 联机：爆炸范围里每个人都挨
    deathBurst(S, x, y - 2, hostile ? P.r : P.O, 0.8); ring(S, x, y, r + 2, hostile ? P.r : P.O); decal(S, x, y, r * 0.4); addShake(S, 0.45); S.stop = Math.max(S.stop, 0.04); sfx('boom');
  }

  // ───────────────────────── 效果小工具
  function part(S, k, x, y, vx, vy, life, col) { S.parts.push({ k, x, y, vx, vy, life, max: life, col, z: k === 'debris' ? 4 : 0, vz: k === 'debris' ? 60 + S.rng() * 80 : 0, size: k === 'smoke' ? 2 + S.rng() * 2 : 1 }); }
  const KEEP_TEXT = new Set(['NO AMMO', '打断', 'FULL', 'FULL BAG']);
  function text(S, x, y, s, col, big) { s = String(s); if (D.settings.lite && !/^[-+]?\d+$/.test(s) && !KEEP_TEXT.has(s)) return; S.texts.push({ x, y, s, col, t: 0, big: !!big }); }
  function ring(S, x, y, r, col) { S.parts.push({ k: 'ring', x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, col, r }); }
  function flashLight(S, x, y, r, col, a) { S.tlights.push({ x, y, r, col, a, decay: 5 }); }
  function addShake(S, n) { S.shake = Math.min(1, S.shake + n); }
  function kick(S, a, n) { S.player.vx -= Math.cos(a) * n * 20; S.player.vy -= Math.sin(a) * n * 20; }
  // shape：cone 霰弹（宽扇）、line 轨道炮 / 过载（长光束）、ball 等离子（光球）、空 = 普通星形
  function muzzle(S, x, y, a, col, big, shape) {
    const spr = shape === 'cone' ? 0.9 : 0.5;
    for (let i = 0; i < 6 * (big || 1); i++) { const b = a + S.rng.range(-spr, spr), s = S.rng.range(80, 200); part(S, 'spark', x, y, Math.cos(b) * s, Math.sin(b) * s, 0.12, col); }
    flashLight(S, x, y, 50 * (big || 1) * (shape === 'line' ? 1.5 : 1), col, 1); S.ghosts.push({ k: 'muzzle', x, y, a, t: shape === 'line' ? 0.1 : 0.06, max: shape === 'line' ? 0.1 : 0.06, col, shape });
  }
  function deathBurst(S, x, y, col, big) {
    for (let i = 0; i < 24 * big; i++) { const b = S.rng() * TAU, s = S.rng.range(40, 200) * Math.sqrt(big); part(S, 'spark', x, y, Math.cos(b) * s, Math.sin(b) * s, S.rng.range(0.2, 0.5), S.rng.chance(0.4) ? P.Y : col); }
    for (let i = 0; i < 8 * big; i++) { const b = S.rng() * TAU, s = S.rng.range(20, 90); part(S, 'debris', x, y, Math.cos(b) * s, Math.sin(b) * s, S.rng.range(0.6, 1.2), S.rng.pick([P[2], P[3], P[4], P.k])); }
    for (let i = 0; i < 6 * big; i++) part(S, 'smoke', x + S.rng.range(-5, 5), y + S.rng.range(-5, 5), S.rng.range(-15, 15), S.rng.range(-25, -5), S.rng.range(0.6, 1.1), '#3a3a4a');
    ring(S, x, y + 4, 22 * Math.sqrt(big), col); S.tlights.push({ x, y, r: 90 * Math.sqrt(big), col, a: 1.4, decay: 3 });
  }
  function decal(S, x, y, r) { const g = S.fx; g.save(); g.globalAlpha = 0.5; for (let i = 0; i < r * 6; i++) { const a = S.rng() * TAU, d = Math.sqrt(S.rng()) * r; g.fillStyle = S.rng.chance(0.6) ? '#0b0a14' : '#1d1a24'; g.fillRect(Math.round((x + Math.cos(a) * d) * Z), Math.round((y + Math.sin(a) * d * 0.6) * Z), 1 + (S.rng() * 2 | 0), 1); } g.restore(); }
  function zig(S, x0, y0, x1, y1) { const pts = [[x0, y0]], n = 9; for (let i = 1; i < n; i++) { const k = i / n; pts.push([D.lerp(x0, x1, k) + S.rng.range(-5, 5), D.lerp(y0, y1, k) + S.rng.range(-5, 5)]); } pts.push([x1, y1]); return pts; }
  Object.assign(K, { projectiles, hitWall, impact, explode, part, text, ring, flashLight, addShake, kick, muzzle, deathBurst, decal, zig });
})(D);
