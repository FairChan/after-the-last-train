/* 末班之后 · 小样：一场战斗
   实时俯视。手里 4 张牌，按 1–4 出牌，电量随时间回复；出一张补一张，抽牌堆空了要重整。
   左键是不花电的扳手，右键/空格闪避。敌人头上写着它下一步要做什么（意图）和倒计时。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, W = D.W, H = D.H, TS = 16;
  const TAU = Math.PI * 2;

  // ───────────────────────── 创建
  D.newFight = function (run, enc, theme, seed) {
    const rng = D.rng(seed), big = enc.kind === 'boss';
    const A = D.makeArena(rng, theme, big);
    const [floor, fx] = D.canvas(A.w, A.h); fx.drawImage(A.floor, 0, 0);
    const pl = D.PLAYER, rel = run.relics;
    const F = {
      run, rng, A, floor, fx, t: 0, kind: enc.kind, over: null, endT: 0,
      player: { x: A.spawn.x, y: A.spawn.y, r: 5, vx: 0, vy: 0, hp: run.hp, maxHp: run.maxHp, shield: 0, shieldT: 0, aim: -Math.PI / 2, dashT: 0, dashCd: 0, dx: 0, dy: 0, inv: 0, hurtT: 0, flash: 0, wrenchCd: 0, swingT: 0, walk: 0, railT: 0, railA: 0, lungeHit: null, scarf: [] },
      enemies: [], shots: [], eshots: [], parts: [], texts: [], mines: [], saws: [], beams: [], bolts: [], pickups: [], ghosts: [], tlights: [], decals: [],
      draw: [], hand: [], discard: [], exhaust: [], reshuffleT: 0, played: 0,
      energy: rel.battery ? pl.eMax + (rel.capacitor ? 1 : 0) : 1, eMax: pl.eMax + (rel.capacitor ? 1 : 0), regenMul: rel.condenser ? 1.2 : 1, atkBonus: rel.edge ? 1 : 0,
      shake: 0, stop: 0, slowT: 0, decoy: null, cam: { x: 0, y: 0 }, banner: null, gold: 0, kills: 0, motes: [], log: [],
    };
    for (let i = 0; i < 8; i++) F.player.scarf.push({ x: F.player.x, y: F.player.y - 8, px: F.player.x, py: F.player.y - 8 });
    F.draw = rng.shuffle(run.deck.map(c => Object.assign({}, c)));
    for (let i = 0; i < pl.hand; i++) drawCard(F);
    // 敌人：沿房间上半部分散开
    const list = enc.list;
    list.forEach((k, i) => {
      const a = (i + 0.5) / list.length;
      const x = big ? A.w / 2 : D.lerp(3 * TS, A.w - 3 * TS, a) + rng.range(-20, 20);
      const y = big ? 4.5 * TS : rng.range(3.5 * TS, (A.floorBottom - 5) * TS);
      spawnEnemy(F, k, x, y, big ? 2.6 : 1.0 + i * 0.3); // 开场留一点时间看清局面；首领等名字横幅走完
    });
    if (big) F.banner = { t: 0, text: D.ENEMIES.boss.name, sub: '轨道维修机' };
    for (let i = 0; i < 40; i++) F.motes.push({ x: rng() * A.w, y: rng() * A.h, vx: rng.range(-3, 3), vy: rng.range(-4, -1), s: rng() });
    F.cam.x = D.clamp(F.player.x - W / 2, 0, Math.max(0, A.w - W)); F.cam.y = D.clamp(F.player.y + 16 - H / 2, -4, Math.max(0, A.h - H + 40));
    return F;
  };

  function spawnEnemy(F, kind, x, y, delay) {
    const b = D.ENEMIES[kind];
    const e = { kind, x, y, r: b.r, hp: b.hp, maxHp: b.hp, vx: 0, vy: 0, shield: 0, flash: 0, stun: 0, face: 1, t: F.rng() * 10, intent: null, tele: 0, teleMax: 1, act: null, cd: delay || 0.8, spawnT: 0.35, dead: false, hitCd: {}, z: 0, phase: 1, step: 0 };
    e.intent = nextIntent(F, e);
    F.enemies.push(e);
    for (let i = 0; i < 10; i++) part(F, 'spark', x, y - 4, F.rng.range(-60, 60), F.rng.range(-80, 10), 0.3, P.c);
    return e;
  }

  // ───────────────────────── 牌
  function drawCard(F) {
    if (!F.draw.length) return false;
    F.hand.push(F.draw.pop());
    return true;
  }
  function refill(F) {
    while (F.hand.length < D.PLAYER.hand && F.draw.length) drawCard(F);
    if (!F.draw.length && F.hand.length < D.PLAYER.hand && F.discard.length && F.reshuffleT <= 0) F.reshuffleT = D.PLAYER.reshuffle;
  }
  D.canPlay = (F, i) => { const c = F.hand[i]; return !!c && F.energy >= c.cost && !F.over && F.player.railT <= 0; };
  D.playCard = function (F, i) {
    if (!D.canPlay(F, i)) { if (F.hand[i]) { F.log.push({ type: 'nope', i }); D.Sfx && D.Sfx.play('nope'); } return false; }
    const c = F.hand.splice(i, 1)[0];
    F.energy -= c.cost; F.played++;
    effect(F, c);
    (c.exhaust ? F.exhaust : F.discard).push(c);
    F.log.push({ type: 'play', card: c });
    if (F.run.relics.relay && F.played % 5 === 0) { addShield(F, 6); text(F, F.player.x, F.player.y - 22, '+6', P.c); }
    refill(F);
    return true;
  };
  function atk(F, c, base) { return base + F.atkBonus; }

  function effect(F, c) {
    const p = F.player, v = c.v, a = p.aim, sfx = D.Sfx ? D.Sfx.play : () => {};
    const ox = p.x + Math.cos(a) * 8, oy = p.y - 6 + Math.sin(a) * 8;
    switch (c.id) {
      case 'bolt':
        F.shots.push({ k: 'bolt', x: ox, y: oy, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 0.9, dmg: atk(F, c, v.dmg), r: 3 });
        muzzle(F, ox, oy, a, P.O); kick(F, a, 1.5); sfx('shot'); break;
      case 'scatter':
        for (let k = 0; k < v.n; k++) { const b = a + (k / (v.n - 1) - 0.5) * 0.75 + F.rng.range(-0.04, 0.04), s = F.rng.range(250, 300); F.shots.push({ k: 'pellet', x: ox, y: oy, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: 0.36, dmg: atk(F, c, v.dmg), r: 2 }); }
        muzzle(F, ox, oy, a, P.O, 1.6); kick(F, a, 4); addShake(F, 0.25); sfx('scatter'); break;
      case 'lunge': {
        p.dashT = 0.15; p.dx = Math.cos(a) * 560; p.dy = Math.sin(a) * 560; p.inv = Math.max(p.inv, 0.22); p.lungeHit = { dmg: atk(F, c, v.dmg), hit: new Set() };
        p.swingT = 0.18; sfx('lunge'); break;
      }
      case 'mine': {
        const tx = D.Input.wx, ty = D.Input.wy, d = Math.min(150, Math.hypot(tx - p.x, ty - p.y));
        F.mines.push({ x: p.x, y: p.y - 4, sx: p.x, sy: p.y - 4, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d, t: 0, fly: 0.32, arm: 0.35, dmg: atk(F, c, v.dmg), life: 5 });
        sfx('throw'); break;
      }
      case 'arc': {
        let from = { x: ox, y: oy }; const hit = new Set();
        for (let n = 0; n < v.n; n++) {
          let best = null, bd = n === 0 ? 170 : 110;
          for (const e of F.enemies) if (!e.dead && !hit.has(e)) { const d = Math.hypot(e.x - from.x, e.y - 6 - from.y); if (d < bd) { bd = d; best = e; } }
          if (!best) break;
          hit.add(best); F.bolts.push({ pts: zig(F, from.x, from.y, best.x, best.y - 6), t: 0.18 });
          hurt(F, best, atk(F, c, v.dmg), { kx: best.x - from.x, ky: best.y - from.y, kb: 40, col: P.c });
          from = { x: best.x, y: best.y - 6 };
        }
        if (!hit.size) F.bolts.push({ pts: zig(F, ox, oy, ox + Math.cos(a) * 60, oy + Math.sin(a) * 60), t: 0.15 });
        flashLight(F, ox, oy, 80, P.c, 1); sfx('zap'); break;
      }
      case 'saw':
        F.saws.push({ x: ox, y: oy, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 0, back: false, dmg: atk(F, c, v.dmg), hit: new Map(), rot: 0 });
        sfx('throw'); break;
      case 'rail':
        p.railT = 0.25; p.railA = a; p.railDmg = atk(F, c, v.dmg); sfx('charge'); break;
      case 'slam': {
        p.inv = Math.max(p.inv, 0.2);
        for (const e of F.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 50 + e.r) { hurt(F, e, atk(F, c, v.dmg), { kx: e.x - p.x, ky: e.y - p.y, kb: 160, col: P.O }); e.stun = Math.max(e.stun, 1.2); } }
        for (const s of F.eshots) if (Math.hypot(s.x - p.x, s.y - p.y) < 50) s.life = 0;
        ring(F, p.x, p.y, 52, P.O); ring(F, p.x, p.y, 34, P.Y);
        for (let i = 0; i < 26; i++) { const b = F.rng() * TAU; part(F, 'debris', p.x, p.y, Math.cos(b) * F.rng.range(40, 120), Math.sin(b) * F.rng.range(40, 120), F.rng.range(0.5, 0.9), F.rng.pick([P[3], P[4], P.t])); }
        decal(F, p.x, p.y, 20); addShake(F, 0.7); F.stop = 0.09; flashLight(F, p.x, p.y, 120, P.O, 1.2); sfx('slam'); break;
      }
      case 'barrier': addShield(F, v.sh); ring(F, p.x, p.y - 5, 16, P.c); sfx('shield'); break;
      case 'salvage': for (let n = 0; n < v.n; n++) if (F.hand.length < 6) { if (!F.draw.length && F.discard.length) { F.draw = F.rng.shuffle(F.discard.splice(0)); } drawCard(F); } sfx('draw'); break;
      case 'overclock': F.energy = Math.min(F.eMax + 2, F.energy + v.e); damagePlayer(F, v.hurt, null, true); for (let i = 0; i < 12; i++) part(F, 'spark', p.x, p.y - 8, F.rng.range(-70, 70), F.rng.range(-90, 0), 0.35, P.y); sfx('zap'); break;
      case 'coolant': F.slowT = v.t; for (const e of F.enemies) if (!e.dead) for (let i = 0; i < 6; i++) part(F, 'smoke', e.x + F.rng.range(-6, 6), e.y - 4, F.rng.range(-10, 10), F.rng.range(-20, -5), 0.8, '#9fe9ff'); sfx('cool'); break;
      case 'decoy': F.decoy = { x: p.x, y: p.y, t: v.t, max: v.t }; sfx('shield'); break;
      case 'calibrate': F.atkBonus += v.d; text(F, p.x, p.y - 24, 'ATK+' + v.d, P.y); ring(F, p.x, p.y - 5, 20, P.y); sfx('power'); break;
      case 'dynamo': F.regenMul *= 1 + v.p / 100; text(F, p.x, p.y - 24, 'E+' + v.p + '%', P.y); ring(F, p.x, p.y - 5, 20, P.y); sfx('power'); break;
      case 'jam': for (let i = 0; i < 6; i++) part(F, 'smoke', p.x, p.y - 8, F.rng.range(-15, 15), F.rng.range(-25, -5), 0.6, '#555a66'); sfx('nope'); break;
    }
  }

  // ───────────────────────── 每帧
  D.stepFight = function (F, dt, inp) {
    if (F.stop > 0) { F.stop -= dt; return; }
    const realDt = dt;
    if (F.over && F.over !== 'lose') dt *= 0.35; // 胜利后慢放
    F.t += dt;
    if (F.banner) { F.banner.t += realDt; if (F.banner.t > 2.4) F.banner = null; }
    const p = F.player, I = D.Input;
    // 世界坐标准星
    I.wx = I.mx + F.cam.x; I.wy = I.my + F.cam.y;
    const alive = !F.over || F.over === 'win';
    if (p.hp > 0 && alive) {
      p.aim = Math.atan2(I.wy - (p.y - 6), I.wx - p.x);
      // 电量与重整
      F.energy = Math.min(F.eMax, F.energy + dt * D.PLAYER.eRegen * F.regenMul * (F.energy < F.eMax ? 1 : 0));
      if (F.reshuffleT > 0) { F.reshuffleT -= dt; if (F.reshuffleT <= 0) { F.draw = F.rng.shuffle(F.discard.splice(0)); refill(F); D.Sfx && D.Sfx.play('draw'); } }
      else refill(F);
      if (!F.over) {
        for (let i = 0; i < 6; i++) if (inp.card[i]) D.playCard(F, i);
        if (inp.dash && p.dashCd <= 0 && p.dashT <= 0 && p.railT <= 0) {
          let mx = inp.mx, my = inp.my; if (!mx && !my) { mx = Math.cos(p.aim); my = Math.sin(p.aim); }
          const l = Math.hypot(mx, my); p.dx = mx / l * D.PLAYER.dashSpeed; p.dy = my / l * D.PLAYER.dashSpeed; p.dashT = D.PLAYER.dashTime; p.inv = Math.max(p.inv, D.PLAYER.dashTime + 0.06);
          p.dashCd = D.PLAYER.dashCd * (F.run.relics.spring ? 0.6 : 1); p.lungeHit = null; D.Sfx && D.Sfx.play('dash');
          for (let i = 0; i < 6; i++) part(F, 'smoke', p.x, p.y, -p.dx * 0.05 + F.rng.range(-10, 10), -p.dy * 0.05 + F.rng.range(-10, 10), 0.4, '#6b7290');
        }
        if (inp.fire && p.wrenchCd <= 0 && p.dashT <= 0) wrench(F);
      }
      // 移动
      const sp = D.PLAYER.speed * (p.railT > 0 ? 0.25 : 1);
      if (p.dashT > 0) {
        p.dashT -= dt; p.vx = p.dx; p.vy = p.dy;
        if (F.t % 0.03 < dt) F.ghosts.push({ x: p.x, y: p.y, t: 0.2, flip: Math.cos(p.aim) < 0, col: p.lungeHit ? P.O : P.c });
        if (p.lungeHit) for (const e of F.enemies) if (!e.dead && !p.lungeHit.hit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 14) { p.lungeHit.hit.add(e); hurt(F, e, p.lungeHit.dmg, { kx: p.dx, ky: p.dy, kb: 90, col: P.O, slash: true }); }
        if (p.dashT <= 0) { p.vx *= 0.2; p.vy *= 0.2; }
      } else {
        const l = Math.hypot(inp.mx, inp.my) || 1, tx = inp.mx / l * sp, ty = inp.my / l * sp;
        const k = 1 - Math.exp(-dt * 18); p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
      }
      D.move(F.A, p, p.vx * dt, p.vy * dt);
      const moving = Math.hypot(p.vx, p.vy) > 20;
      if (moving) { p.walk += dt * 11; if (Math.floor(p.walk / Math.PI) !== Math.floor((p.walk - dt * 11) / Math.PI)) part(F, 'smoke', p.x + F.rng.range(-2, 2), p.y, F.rng.range(-8, 8), F.rng.range(-6, -1), 0.35, '#5a6080'); }
      // 穿甲蓄力
      if (p.railT > 0) { p.railT -= dt; p.railA = p.aim; if (p.railT <= 0) fireRail(F); }
    } else { p.vx *= 0.9; p.vy *= 0.9; }
    p.dashCd -= dt; p.wrenchCd -= dt; p.inv -= dt; p.flash -= dt; p.hurtT -= dt; p.swingT -= dt;
    if (p.shield > 0) { p.shieldT += dt; if (p.shieldT > 3) p.shield = Math.max(0, p.shield - dt * 3); }
    scarf(F, p, dt);
    if (F.decoy) { F.decoy.t -= dt; if (F.decoy.t <= 0) F.decoy = null; }
    if (F.slowT > 0) F.slowT -= dt;

    // 敌人
    const es = F.slowT > 0 ? 0.5 : 1;
    for (const e of F.enemies) if (!e.dead) enemyStep(F, e, dt * es);
    // 互相推开
    const E = F.enemies;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j]; if (a.dead || b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = a.r + b.r + 2;
      if (d < m) { const k = (m - d) / 2 / d; if (a.kind !== 'boss' && a.kind !== 'turret') { a.x -= dx * k; a.y -= dy * k; } if (b.kind !== 'boss' && b.kind !== 'turret') { b.x += dx * k; b.y += dy * k; } }
    }
    projectiles(F, dt, es);
    // 效果
    for (const q of F.parts) {
      q.life -= dt;
      if (q.k === 'debris') { q.vz -= 260 * dt; q.z += q.vz * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.4; q.vx *= 0.6; q.vy *= 0.6; } }
      else if (q.k === 'smoke') { q.vx *= 0.94; q.vy *= 0.94; q.size += dt * 6; }
      else if (q.k === 'spark') { q.vx *= 0.9; q.vy = q.vy * 0.9 + 140 * dt; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    F.parts = F.parts.filter(q => q.life > 0);
    for (const t of F.texts) { t.t += realDt; t.y -= realDt * 14 * Math.max(0, 1 - t.t * 1.5); }
    F.texts = F.texts.filter(t => t.t < 0.9);
    for (const g of F.ghosts) g.t -= dt; F.ghosts = F.ghosts.filter(g => g.t > 0);
    for (const l of F.tlights) l.a -= dt * l.decay; F.tlights = F.tlights.filter(l => l.a > 0);
    for (const b of F.bolts) b.t -= dt; F.bolts = F.bolts.filter(b => b.t > 0);
    for (const b of F.beams) b.t -= dt; F.beams = F.beams.filter(b => b.t > 0);
    for (const m of F.motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.y < 0) { m.y = F.A.h; m.x = F.rng() * F.A.w; } }
    // 零件飞向玩家
    for (const g of F.pickups) {
      g.t += dt;
      if (g.t < 0.35) { g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.9; g.vy *= 0.9; }
      else { const a = Math.atan2(p.y - 6 - g.y, p.x - g.x), s = 140 + g.t * 300; g.x += Math.cos(a) * s * dt; g.y += Math.sin(a) * s * dt; if (Math.hypot(p.x - g.x, p.y - 6 - g.y) < 6) { g.done = true; F.gold += g.v; D.Sfx && D.Sfx.play('coin'); } }
    }
    F.pickups = F.pickups.filter(g => !g.done);
    F.shake = Math.max(0, F.shake - realDt * 1.8);
    // 镜头：跟随并略微看向准星
    const tx = D.clamp(p.x - W / 2 + (I.mx - W / 2) * 0.15, 0, Math.max(0, F.A.w - W)), ty = D.clamp(p.y + 16 - H / 2 + (I.my - H / 2) * 0.12, -4, Math.max(0, F.A.h - H + 40));
    const ck = 1 - Math.exp(-realDt * 8); F.cam.x += (tx - F.cam.x) * ck; F.cam.y += (ty - F.cam.y) * ck;
    // 胜负
    if (!F.over) {
      if (p.hp <= 0) { F.over = 'lose'; F.endT = 0; deathBurst(F, p.x, p.y - 6, P.o, 1.5); D.Sfx && D.Sfx.play('die'); }
      else if (F.enemies.every(e => e.dead)) { F.over = 'win'; F.endT = 0; D.Sfx && D.Sfx.play('win'); }
    } else F.endT += realDt;
  };

  function wrench(F) {
    const p = F.player; p.wrenchCd = D.PLAYER.wrench.cd; p.swingT = 0.14; p.swingDir = (p.swingDir || 1) * -1;
    let hitAny = false;
    for (const e of F.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = (e.y - 4) - (p.y - 6), d = Math.hypot(dx, dy);
      if (d < D.PLAYER.wrench.range + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < 1.1) { hurt(F, e, D.PLAYER.wrench.dmg, { kx: dx, ky: dy, kb: 70, col: P[6], slash: true }); hitAny = true; }
    }
    // 扳手也能打掉子弹
    for (const s of F.eshots) { const dx = s.x - p.x, dy = s.y - (p.y - 6); if (Math.hypot(dx, dy) < 18 && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < 1.2) { s.life = 0; for (let i = 0; i < 5; i++) part(F, 'spark', s.x, s.y, F.rng.range(-60, 60), F.rng.range(-60, 60), 0.2, P.Y); } }
    D.Sfx && D.Sfx.play(hitAny ? 'hit' : 'swing');
  }
  function fireRail(F) {
    const p = F.player, a = p.railA, ox = p.x + Math.cos(a) * 8, oy = p.y - 6 + Math.sin(a) * 8;
    let len = 0; while (len < 500 && !D.solidAt(F.A, ox + Math.cos(a) * len, oy + Math.sin(a) * len)) len += 3;
    const ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len;
    F.beams.push({ x0: ox, y0: oy, x1: ex, y1: ey, t: 0.22, max: 0.22, col: P.c });
    for (const e of F.enemies) {
      if (e.dead) continue;
      const t = D.clamp(((e.x - ox) * Math.cos(a) + (e.y - 5 - oy) * Math.sin(a)), 0, len), cx = ox + Math.cos(a) * t, cy = oy + Math.sin(a) * t;
      if (Math.hypot(e.x - cx, e.y - 5 - cy) < e.r + 5) hurt(F, e, p.railDmg, { kx: Math.cos(a), ky: Math.sin(a), kb: 120, col: P.c });
    }
    for (let i = 0; i < 20; i++) part(F, 'spark', ex, ey, F.rng.range(-90, 90), F.rng.range(-90, 90), 0.4, P.C);
    kick(F, a, 7); addShake(F, 0.45); F.stop = 0.05; flashLight(F, ox, oy, 120, P.c, 1.3); D.Sfx && D.Sfx.play('rail');
  }

  // ───────────────────────── 敌人
  function target(F) { return F.decoy || F.player; }
  function nextIntent(F, e) {
    const r = F.rng;
    switch (e.kind) {
      case 'crawler': return { k: 'leap', dmg: 7, tele: 0.5 };
      case 'drone': return { k: 'burst', dmg: 6, n: 3, tele: 0.7 };
      case 'turret': return r.chance(0.5) ? { k: 'fan', dmg: 6, n: 5, tele: 1.0 } : { k: 'ring', dmg: 5, n: 10, tele: 1.1 };
      case 'engineer': { const seq = ['charge', 'jam', 'charge', 'armor']; const k = seq[e.step++ % seq.length]; return k === 'charge' ? { k, dmg: 14, tele: 0.8 } : k === 'jam' ? { k, dmg: 4, n: 3, tele: 0.65 } : { k, sh: 20, tele: 0.45 }; }
      case 'boss': {
        const f = e.phase === 2 ? 0.75 : 1, seq = e.phase === 2 ? ['slam', 'laser', 'ring', 'summon', 'slam', 'ring'] : ['slam', 'ring', 'laser', 'slam', 'summon'];
        const k = seq[e.step++ % seq.length];
        if (k === 'summon' && F.enemies.filter(x => !x.dead).length > 3) return { k: 'ring', dmg: 6, n: e.phase === 2 ? 16 : 12, tele: 0.7 * f };
        return k === 'slam' ? { k, dmg: 18, tele: 0.95 * f } : k === 'ring' ? { k, dmg: 6, n: e.phase === 2 ? 16 : 12, tele: 0.7 * f } : k === 'laser' ? { k, dmg: 12, tele: 0.9 * f } : { k, n: 2, tele: 0.6 * f };
      }
    }
  }
  function enemyStep(F, e, dt) {
    e.t += dt; e.flash -= dt; e.spawnT -= dt;
    for (const k in e.hitCd) e.hitCd[k] -= dt;
    // 击退
    if (e.kind !== 'boss') D.move(F.A, e, e.vx * dt, e.vy * dt); else { e.x += e.vx * dt; e.y += e.vy * dt; }
    e.vx *= Math.pow(0.0015, dt); e.vy *= Math.pow(0.0015, dt);
    if (e.stun > 0) { e.stun -= dt; e.tele = 0; e.act = null; return; }
    if (e.spawnT > 0) return;
    const T = target(F), dx = T.x - e.x, dy = T.y - e.y, d = Math.hypot(dx, dy) || 1, b = D.ENEMIES[e.kind];
    if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
    const move = (ux, uy, s) => { if (e.kind === 'boss') { e.x += ux * s * dt; e.y += uy * s * dt; } else D.move(F.A, e, ux * s * dt, uy * s * dt); };
    // 正在执行的动作
    if (e.act) { actStep(F, e, dt); return; }
    // 正在蓄势
    if (e.tele > 0) {
      e.tele -= dt;
      if (e.intent.k === 'burst' || e.intent.k === 'laser') e.aimA = e.aimA == null ? Math.atan2(dy, dx) : e.aimA + D.angDiff(e.aimA, Math.atan2(T.y - 6 - (e.y - 8), dx)) * Math.min(1, dt * (e.tele > 0.2 ? 8 : 0));
      if (e.intent.k === 'charge') e.aimA = Math.atan2(dy, dx);
      if (e.intent.k === 'leap' && e.tele > 0.18) e.mark = { x: T.x + (T.vx || 0) * 0.32, y: T.y + (T.vy || 0) * 0.32 }; // 预判落点，最后 0.18 秒锁定
      if (e.tele <= 0) startAct(F, e, T);
      return;
    }
    e.cd -= dt;
    switch (e.kind) {
      case 'crawler': {
        const side = Math.sin(e.t * 2 + e.x) * 0.6;
        move(dx / d + (-dy / d) * side, dy / d + (dx / d) * side, b.speed * (d > 40 ? 1 : 0.4));
        if (e.cd <= 0 && d < 70) begin(F, e, { x: T.x, y: T.y });
        break;
      }
      case 'drone': {
        const want = d < 70 ? -1 : d > 130 ? 1 : 0, s = Math.sin(e.t * 0.9 + e.x * 0.1);
        move(dx / d * want + (-dy / d) * s * 0.8, dy / d * want + (dx / d) * s * 0.8, b.speed);
        if (e.cd <= 0 && d < 190) { e.aimA = null; begin(F, e); }
        break;
      }
      case 'turret': if (e.cd <= 0) begin(F, e); break;
      case 'engineer': move(dx / d, dy / d, b.speed * (d > 50 ? 1 : 0)); if (e.cd <= 0) begin(F, e); break;
      case 'boss': {
        if (e.phase === 1 && e.hp < e.maxHp / 2) { e.phase = 2; F.banner = { t: 0, text: '过热', sub: '钳工-9 进入第二阶段' }; addShake(F, 0.6); for (let i = 0; i < 30; i++) part(F, 'spark', e.x, e.y - 20, F.rng.range(-120, 120), F.rng.range(-150, 0), 0.6, P.O); }
        move(dx / d, dy / d * 0.6, b.speed * (d > 70 ? 1 : 0));
        e.x = D.clamp(e.x, 3 * TS, F.A.w - 3 * TS); e.y = D.clamp(e.y, 4 * TS, (F.A.floorBottom - 2) * TS);
        if (e.cd <= 0) begin(F, e, { x: T.x, y: T.y });
        break;
      }
    }
  }
  function begin(F, e, mark) {
    e.tele = e.teleMax = e.intent.tele; e.mark = mark || null;
    if (e.intent.k === 'slam') { const T = target(F); e.mark = { x: D.clamp(T.x + (T.vx || 0) * 0.45, 40, F.A.w - 40), y: D.clamp(T.y + (T.vy || 0) * 0.45, 50, (F.A.floorBottom - 1) * 16) }; } // 首领砸地也预判
    D.Sfx && D.Sfx.play(e.kind === 'boss' ? 'bosswarn' : 'warn');
  }
  function startAct(F, e, T) {
    const it = e.intent, a = Math.atan2(T.y - e.y, T.x - e.x);
    switch (it.k) {
      case 'leap': { const m = e.mark || T; const d = Math.min(110, Math.hypot(m.x - e.x, m.y - e.y) + 12), la = Math.atan2(m.y - e.y, m.x - e.x); e.act = { k: 'leap', t: 0.24, vx: Math.cos(la) * d / 0.24, vy: Math.sin(la) * d / 0.24, hit: false }; D.Sfx && D.Sfx.play('leap'); break; }
      case 'burst': e.act = { k: 'burst', t: 0, n: it.n, gap: 0.09 }; break;
      case 'fan': case 'ring': {
        const n = it.n, ox = e.x, oy = e.y - (e.kind === 'boss' ? 20 : 8);
        if (e.kind === 'boss') { e.act = { k: 'ringwave', t: 0, waves: e.phase === 2 ? 3 : 2, gap: 0.28, n, dmg: it.dmg, off: F.rng() }; break; }
        for (let i = 0; i < n; i++) { const b = it.k === 'fan' ? a + (i / (n - 1) - 0.5) * 0.9 : i / n * TAU + F.t; eshot(F, ox, oy, b, it.k === 'fan' ? 95 : 70, it.dmg, P.m); }
        flashLight(F, ox, oy, 60, P.m, 1); D.Sfx && D.Sfx.play('orb'); e.cd = F.rng.range(1.6, 2.2); e.intent = nextIntent(F, e); break;
      }
      case 'charge': e.act = { k: 'charge', t: 0, vx: Math.cos(e.aimA) * 270, vy: Math.sin(e.aimA) * 270, hit: false }; D.Sfx && D.Sfx.play('charge2'); break;
      case 'jam': for (let i = 0; i < it.n; i++) { const b = a + (i - 1) * 0.35; F.eshots.push({ k: 'jam', x: e.x, y: e.y - 10, vx: Math.cos(b) * 110, vy: Math.sin(b) * 110, life: 2, dmg: it.dmg, r: 3, col: P.y }); } e.cd = 1.2; e.intent = nextIntent(F, e); D.Sfx && D.Sfx.play('orb'); break;
      case 'armor': e.shield += it.sh; ring(F, e.x, e.y - 8, 20, P.c); e.cd = 0.8; e.intent = nextIntent(F, e); D.Sfx && D.Sfx.play('shield'); break;
      case 'slam': e.act = { k: 'slam', t: 0, dur: 0.42, sx: e.x, sy: e.y, tx: e.mark.x, ty: e.mark.y }; D.Sfx && D.Sfx.play('leap'); break;
      case 'laser': e.act = { k: 'laser', t: 0, dur: 1.3, a0: e.aimA != null ? e.aimA : a, dir: F.rng.chance(0.5) ? 1 : -1, sweep: e.phase === 2 ? 1.6 : 1.1 }; D.Sfx && D.Sfx.play('laser'); break;
      case 'summon': for (let i = 0; i < it.n; i++) spawnEnemy(F, 'crawler', e.x + (i ? 30 : -30), e.y + 10, 0.4); e.cd = 1.0; e.intent = nextIntent(F, e); D.Sfx && D.Sfx.play('summon'); break;
    }
  }
  function actStep(F, e, dt) {
    const A = e.act, p = F.player; A.t += dt;
    const T = target(F);
    const done = () => { e.act = null; e.intent = nextIntent(F, e); e.aimA = null; };
    switch (A.k) {
      case 'leap':
        D.move(F.A, e, A.vx * dt, A.vy * dt); A.t -= 2 * dt; e.z = Math.sin(Math.max(0, A.t) / 0.24 * Math.PI) * 8;
        if (!A.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 2) { A.hit = true; damagePlayer(F, e.intent.dmg, e); }
        if (A.t <= 0) { e.z = 0; e.cd = F.rng.range(1.0, 1.5); done(); }
        break;
      case 'burst':
        if (A.t >= A.gap) { A.t = 0; A.n--; const ox = e.x + Math.cos(e.aimA) * 6, oy = e.y - 10 + Math.sin(e.aimA) * 6; eshot(F, ox, oy, e.aimA + F.rng.range(-0.05, 0.05), 205, e.intent.dmg, P.r); muzzle(F, ox, oy, e.aimA, P.r); D.Sfx && D.Sfx.play('eshot'); }
        if (A.n <= 0) { e.cd = F.rng.range(1.5, 2.2); done(); }
        break;
      case 'charge': {
        const bx = e.x, by = e.y; D.move(F.A, e, A.vx * dt, A.vy * dt);
        if (F.t % 0.04 < dt) part(F, 'spark', e.x - A.vx * 0.03, e.y - 4, F.rng.range(-40, 40), F.rng.range(-50, 0), 0.25, P.O);
        if (!A.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 3) { A.hit = true; damagePlayer(F, e.intent.dmg, e); }
        const wall = Math.hypot(e.x - bx, e.y - by) < 0.6 * Math.hypot(A.vx * dt, A.vy * dt); // 被墙挡住，走不满
        if (A.t >= 0.55 || wall) { if (wall) { e.stun = 0.9; addShake(F, 0.4); for (let i = 0; i < 14; i++) part(F, 'debris', e.x, e.y, F.rng.range(-80, 80), F.rng.range(-80, 80), 0.6, P[3]); D.Sfx && D.Sfx.play('slam'); } e.cd = 0.9; done(); }

        break;
      }
      case 'slam': {
        const k = Math.min(1, A.t / A.dur);
        e.x = D.lerp(A.sx, A.tx, D.ease.inOut(k)); e.y = D.lerp(A.sy, A.ty, D.ease.inOut(k)); e.z = Math.sin(k * Math.PI) * 34;
        if (k >= 1) {
          e.z = 0; const R = 44;
          if (Math.hypot(p.x - e.x, p.y - e.y) < R) damagePlayer(F, e.intent.dmg, e);
          ring(F, e.x, e.y, R + 4, P.O); ring(F, e.x, e.y, R - 12, P.r); decal(F, e.x, e.y, 26);
          for (let i = 0; i < 30; i++) { const b = F.rng() * TAU; part(F, 'debris', e.x, e.y, Math.cos(b) * F.rng.range(40, 140), Math.sin(b) * F.rng.range(40, 140), F.rng.range(0.5, 1), F.rng.pick([P[3], P[2], P.t])); }
          if (e.phase === 2) for (let i = 0; i < 10; i++) eshot(F, e.x, e.y - 6, i / 10 * TAU, 80, 5, P.O);
          addShake(F, 0.8); F.stop = 0.06; flashLight(F, e.x, e.y, 140, P.O, 1.3); D.Sfx && D.Sfx.play('slam');
          e.cd = 0.8; done();
        }
        break;
      }
      case 'ringwave':
        if (A.t >= A.gap) { A.t = 0; A.waves--; for (let i = 0; i < A.n; i++) eshot(F, e.x, e.y - 20, (i + (A.waves % 2) * 0.5) / A.n * TAU + A.off, 80, A.dmg, P.O); flashLight(F, e.x, e.y - 20, 70, P.O, 1); D.Sfx && D.Sfx.play('orb'); }
        if (A.waves <= 0) { e.cd = 0.9; done(); }
        break;
      case 'laser': {
        const k = A.t / A.dur; A.a = A.a0 + A.dir * A.sweep * D.ease.inOut(Math.min(1, k)) - A.dir * A.sweep * 0.5;
        const ox = e.x, oy = e.y - 22; let len = 0; while (len < 420 && !D.solidAt(F.A, ox + Math.cos(A.a) * len, oy + Math.sin(A.a) * len)) len += 4;
        A.len = len;
        const t = D.clamp((p.x - ox) * Math.cos(A.a) + (p.y - 6 - oy) * Math.sin(A.a), 0, len);
        if (Math.hypot(p.x - (ox + Math.cos(A.a) * t), p.y - 6 - (oy + Math.sin(A.a) * t)) < 7 && !(e.hitCd.p > 0)) { e.hitCd.p = 0.4; damagePlayer(F, e.intent.dmg, e); }
        if (F.t % 0.03 < dt) part(F, 'spark', ox + Math.cos(A.a) * len, oy + Math.sin(A.a) * len, F.rng.range(-60, 60), F.rng.range(-80, 0), 0.3, P.R);
        F.tlights.push({ x: ox + Math.cos(A.a) * len, y: oy + Math.sin(A.a) * len, r: 40, col: P.r, a: 0.9, decay: 30 });
        addShake(F, 0.02);
        if (k >= 1) { e.cd = 1.0; done(); }
        break;
      }
    }
  }
  function eshot(F, x, y, a, s, dmg, col) { F.eshots.push({ k: 'orb', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 3, dmg, r: 3, col }); }

  // ───────────────────────── 弹道
  function projectiles(F, dt, es) {
    const p = F.player;
    for (const s of F.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (D.solidAt(F.A, s.x, s.y + 6)) { s.life = 0; for (let i = 0; i < 5; i++) part(F, 'spark', s.x, s.y, -s.vx * 0.2 + F.rng.range(-50, 50), -s.vy * 0.2 + F.rng.range(-50, 50), 0.25, P.O); continue; }
      for (const e of F.enemies) if (!e.dead && Math.hypot(e.x - s.x, e.y - 5 - e.z - s.y) < e.r + s.r) { hurt(F, e, s.dmg, { kx: s.vx, ky: s.vy, kb: s.k === 'bolt' ? 70 : 40, col: P.O }); s.life = 0; break; }
    }
    F.shots = F.shots.filter(s => s.life > 0);
    for (const s of F.eshots) {
      s.x += s.vx * dt * es; s.y += s.vy * dt * es; s.life -= dt;
      if (D.solidAt(F.A, s.x, s.y + 6)) { s.life = 0; for (let i = 0; i < 4; i++) part(F, 'spark', s.x, s.y, F.rng.range(-40, 40), F.rng.range(-40, 40), 0.2, s.col); continue; }
      if (F.decoy && Math.hypot(F.decoy.x - s.x, F.decoy.y - 6 - s.y) < 7) { s.life = 0; continue; }
      if (Math.hypot(p.x - s.x, p.y - 6 - s.y) < p.r + s.r - 1 && p.hp > 0) {
        if (p.inv > 0) continue;
        s.life = 0; damagePlayer(F, s.dmg, s);
        if (s.k === 'jam') { F.discard.push(D.card('jam')); text(F, p.x, p.y - 28, 'JAM', P.y); }
      }
    }
    F.eshots = F.eshots.filter(s => s.life > 0);
    for (const m of F.mines) {
      m.t += dt;
      if (m.t < m.fly) { const k = m.t / m.fly; m.x = D.lerp(m.sx, m.tx, k); m.y = D.lerp(m.sy, m.ty, k); m.z = Math.sin(k * Math.PI) * 18; continue; }
      m.z = 0; if (D.solidAt(F.A, m.x, m.y)) { m.tx = m.x = D.clamp(m.x, TS * 1.5, F.A.w - TS * 1.5); }
      const armed = m.t > m.fly + m.arm;
      let boom = m.t > m.fly + m.life;
      if (armed) for (const e of F.enemies) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 18 + e.r) boom = true;
      if (boom) {
        m.dead = true;
        for (const e of F.enemies) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 36 + e.r) hurt(F, e, m.dmg, { kx: e.x - m.x, ky: e.y - m.y, kb: 130, col: P.O });
        deathBurst(F, m.x, m.y - 2, P.O, 1); ring(F, m.x, m.y, 38, P.O); decal(F, m.x, m.y, 14); addShake(F, 0.5); F.stop = 0.05; D.Sfx && D.Sfx.play('boom');
      }
    }
    F.mines = F.mines.filter(m => !m.dead);
    for (const s of F.saws) {
      s.t += dt; s.rot += dt * 30;
      if (!s.back && (s.t > 0.4 || D.solidAt(F.A, s.x, s.y + 6))) { s.back = true; }
      if (s.back) { const a = Math.atan2(p.y - 6 - s.y, p.x - s.x), sp = 300; s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; if (Math.hypot(p.x - s.x, p.y - 6 - s.y) < 8 || s.t > 2) s.dead = true; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      for (const e of F.enemies) if (!e.dead && Math.hypot(e.x - s.x, e.y - 5 - s.y) < e.r + 6 && !(s.hit.get(e) > F.t)) { s.hit.set(e, F.t + 0.22); hurt(F, e, s.dmg, { kx: s.vx, ky: s.vy, kb: 30, col: P[6] }); }
      if (F.t % 0.05 < dt) part(F, 'spark', s.x, s.y, F.rng.range(-30, 30), F.rng.range(-30, 30), 0.15, P[6]);
    }
    F.saws = F.saws.filter(s => !s.dead);
  }

  // ───────────────────────── 伤害
  function hurt(F, e, dmg, o) {
    if (e.dead) return;
    o = o || {};
    let left = dmg;
    if (e.shield > 0) { const a = Math.min(e.shield, left); e.shield -= a; left -= a; if (a) text(F, e.x, e.y - 20, a, P.c, true); }
    e.hp -= left; e.flash = 0.1;
    const l = Math.hypot(o.kx || 0, o.ky || 0) || 1, kb = (o.kb || 40) * (e.kind === 'boss' ? 0.1 : e.kind === 'engineer' ? 0.4 : e.kind === 'turret' ? 0 : 1);
    e.vx += (o.kx || 0) / l * kb; e.vy += (o.ky || 0) / l * kb;
    if (left > 0) text(F, e.x + F.rng.range(-4, 4), e.y - 18 - e.z, left, left >= 15 ? P.Y : P[6], left >= 15);
    const col = o.col || P.O, ang = Math.atan2(o.ky || 0, o.kx || 1);
    for (let i = 0; i < 6 + Math.min(10, left); i++) { const b = ang + F.rng.range(-0.8, 0.8), s = F.rng.range(60, 180); part(F, 'spark', e.x, e.y - 5 - e.z, Math.cos(b) * s, Math.sin(b) * s, F.rng.range(0.15, 0.35), F.rng.chance(0.5) ? col : P.Y); }
    if (o.slash) F.ghosts.push({ k: 'slash', x: e.x, y: e.y - 6, a: ang, t: 0.12 });
    flashLight(F, e.x, e.y - 6, 40, col, 0.8);
    F.stop = Math.max(F.stop, left >= 15 ? 0.06 : 0.025); addShake(F, Math.min(0.35, 0.08 + left * 0.012));
    D.Sfx && D.Sfx.play('hit');
    if (e.hp <= 0) kill(F, e);
  }
  function kill(F, e) {
    e.dead = true; F.kills++;
    const big = e.kind === 'boss' ? 3 : e.kind === 'engineer' ? 1.8 : 1;
    deathBurst(F, e.x, e.y - 5, e.kind === 'crawler' ? P.g : e.kind === 'turret' ? P.m : P.r, big);
    decal(F, e.x, e.y, 8 * big);
    F.stop = Math.max(F.stop, 0.07 * Math.min(2, big)); addShake(F, 0.4 * big);
    const g = Math.round(D.ENEMIES[e.kind].gold * (F.run.relics.magnet ? 1.3 : 1));
    for (let i = 0; i < Math.min(8, g); i++) { const b = F.rng() * TAU, s = F.rng.range(40, 100); F.pickups.push({ x: e.x, y: e.y - 5, vx: Math.cos(b) * s, vy: Math.sin(b) * s, t: 0, v: g / Math.min(8, g) }); }
    if (F.run.relics.recycler && F.player.hp > 0) { F.player.hp = Math.min(F.player.maxHp, F.player.hp + 2); text(F, F.player.x, F.player.y - 24, '+2', P.g); }
    D.Sfx && D.Sfx.play(e.kind === 'boss' ? 'bossdie' : 'boom');
  }
  function damagePlayer(F, dmg, src, self) {
    const p = F.player;
    if (!self && (p.inv > 0 || F.over === 'win')) return;
    let left = dmg;
    if (p.shield > 0 && !self) { const a = Math.min(p.shield, left); p.shield -= a; left -= a; for (let i = 0; i < 8; i++) part(F, 'spark', p.x, p.y - 6, F.rng.range(-80, 80), F.rng.range(-80, 40), 0.25, P.c); }
    p.hp -= left; F.taken = (F.taken || 0) + Math.max(0, left); p.flash = 0.12; p.hurtT = 0.35; if (!self) p.inv = 0.45;
    if (src && !self) { const a = Math.atan2(p.y - src.y, p.x - src.x); p.vx += Math.cos(a) * 110; p.vy += Math.sin(a) * 110; }
    text(F, p.x, p.y - 20, left > 0 ? '-' + left : '0', left > 0 ? P.r : P.c, left >= 10);
    if (left > 0) { addShake(F, 0.5); F.stop = Math.max(F.stop, 0.06); for (let i = 0; i < 10; i++) part(F, 'spark', p.x, p.y - 6, F.rng.range(-90, 90), F.rng.range(-90, 30), 0.3, P.r); }
    D.Sfx && D.Sfx.play('hurt');
  }
  function addShield(F, n) { F.player.shield += n; F.player.shieldT = 0; }

  // ───────────────────────── 效果小工具
  function part(F, k, x, y, vx, vy, life, col) { F.parts.push({ k, x, y, vx, vy, life, max: life, col, z: k === 'debris' ? 4 : 0, vz: k === 'debris' ? 60 + F.rng() * 80 : 0, size: k === 'smoke' ? 2 + F.rng() * 2 : 1 }); }
  function text(F, x, y, s, col, big) { F.texts.push({ x, y, s: String(s), col, t: 0, big: !!big }); }
  function ring(F, x, y, r, col) { F.parts.push({ k: 'ring', x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, col, r }); }
  function flashLight(F, x, y, r, col, a) { F.tlights.push({ x, y, r, col, a, decay: 5 }); }
  function addShake(F, n) { F.shake = Math.min(1, F.shake + n); }
  function kick(F, a, n) { F.player.vx -= Math.cos(a) * n * 20; F.player.vy -= Math.sin(a) * n * 20; }
  function muzzle(F, x, y, a, col, big) {
    for (let i = 0; i < 6 * (big || 1); i++) { const b = a + F.rng.range(-0.5, 0.5), s = F.rng.range(80, 200); part(F, 'spark', x, y, Math.cos(b) * s, Math.sin(b) * s, 0.12, col); }
    flashLight(F, x, y, 50 * (big || 1), col, 1);
    F.ghosts.push({ k: 'muzzle', x, y, a, t: 0.06, col });
  }
  function deathBurst(F, x, y, col, big) {
    for (let i = 0; i < 24 * big; i++) { const b = F.rng() * TAU, s = F.rng.range(40, 200) * Math.sqrt(big); part(F, 'spark', x, y, Math.cos(b) * s, Math.sin(b) * s, F.rng.range(0.2, 0.5), F.rng.chance(0.4) ? P.Y : col); }
    for (let i = 0; i < 8 * big; i++) { const b = F.rng() * TAU, s = F.rng.range(20, 90); part(F, 'debris', x, y, Math.cos(b) * s, Math.sin(b) * s, F.rng.range(0.6, 1.2), F.rng.pick([P[2], P[3], P[4], P.k])); }
    for (let i = 0; i < 6 * big; i++) part(F, 'smoke', x + F.rng.range(-5, 5), y + F.rng.range(-5, 5), F.rng.range(-15, 15), F.rng.range(-25, -5), F.rng.range(0.6, 1.1), '#3a3a4a');
    ring(F, x, y + 4, 22 * Math.sqrt(big), col);
    F.tlights.push({ x, y, r: 90 * Math.sqrt(big), col, a: 1.4, decay: 3 });
  }
  function decal(F, x, y, r) { // 焦痕直接画进这场战斗的地面
    const g = F.fx; g.save(); g.globalAlpha = 0.5;
    for (let i = 0; i < r * 3; i++) { const a = F.rng() * TAU, d = Math.sqrt(F.rng()) * r; g.fillStyle = F.rng.chance(0.6) ? '#0b0a14' : '#1d1a24'; g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.6), 1 + (F.rng() * 2 | 0), 1); }
    g.restore();
  }
  function zig(F, x0, y0, x1, y1) { const pts = [[x0, y0]], n = 7; for (let i = 1; i < n; i++) { const k = i / n; pts.push([D.lerp(x0, x1, k) + F.rng.range(-6, 6), D.lerp(y0, y1, k) + F.rng.range(-6, 6)]); } pts.push([x1, y1]); return pts; }
  function scarf(F, p, dt) {
    const s = p.scarf, flip = Math.cos(p.aim) < 0 ? -1 : 1;
    s[0].x = p.x - flip * 2; s[0].y = p.y - 9 + Math.sin(p.walk) * 0.5;
    for (let i = 1; i < s.length; i++) {
      const q = s[i], vx = (q.x - q.px) * 0.86, vy = (q.y - q.py) * 0.86;
      q.px = q.x; q.py = q.y;
      q.x += vx - flip * 0.6 * 0 + Math.sin(F.t * 6 + i) * 0.08; q.y += vy + 0.18;
      const a = s[i - 1], dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy) || 1, L = 2.2;
      q.x = a.x + dx / d * L; q.y = a.y + dy / d * L;
    }
  }

  // ───────────────────────── 画面
  D.drawFight = function (ctx, F, time) {
    const A = F.A, p = F.player, ex = D.Post.ex;
    const sh = F.shake * F.shake * 6, cx = Math.round(F.cam.x + (D.fx() - 0.5) * sh * 2), cy = Math.round(F.cam.y + (D.fx() - 0.5) * sh * 2);
    ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(-cx, -cy); ex.save(); ex.translate(-cx, -cy);
    ctx.drawImage(F.floor, 0, 0); ex.drawImage(A.floorEmit, 0, 0);
    // 地面预警
    for (const e of F.enemies) if (!e.dead) telegraph(ctx, ex, F, e);
    // 影子
    ctx.fillStyle = 'rgba(5,4,12,0.55)';
    const shadow = (x, y, r) => { ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), r, Math.max(1, r * 0.45), 0, 0, TAU); ctx.fill(); };
    for (const pr of A.props) { ctx.fillStyle = 'rgba(5,4,12,0.45)'; ctx.fillRect(pr.x - pr.w / 2 + 3, pr.y - 3, pr.w, 5); }
    ctx.fillStyle = 'rgba(5,4,12,0.55)';
    for (const e of F.enemies) if (!e.dead) shadow(e.x, e.y, e.r + 1);
    if (p.hp > 0) { shadow(p.x, p.y, 5); ex.strokeStyle = D.rgba(P.o, 0.45 + 0.1 * Math.sin(F.t * 4)); ex.beginPath(); ex.ellipse(Math.round(p.x), Math.round(p.y), 9, 4, 0, 0, TAU); ex.stroke(); const aa = p.aim; ex.fillStyle = P.O; ex.fillRect(Math.round(p.x + Math.cos(aa) * 11), Math.round(p.y + Math.sin(aa) * 5), 1, 1); }
    for (const m of F.mines) shadow(m.x, m.y, 3);
    // 按脚底排序
    const list = [];
    for (const pr of A.props) list.push({ y: pr.y - 2, f: () => { const px = Math.round(pr.x - pr.w / 2), py = Math.round(pr.y - pr.h); ctx.drawImage(pr.img, px, py); ex.globalCompositeOperation = 'destination-out'; ex.drawImage(pr.img, px, py); ex.globalCompositeOperation = 'source-over'; ex.drawImage(pr.emit, px, py); } });
    for (const e of F.enemies) if (!e.dead) list.push({ y: e.y, f: () => drawEnemy(ctx, ex, F, e) });
    if (p.hp > 0) list.push({ y: p.y, f: () => drawPlayer(ctx, ex, F, p) });
    if (F.decoy) list.push({ y: F.decoy.y, f: () => { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(F.t * 20); drawPlayerBody(ctx, ex, F, F.decoy.x, F.decoy.y, false, 0, true); ctx.globalAlpha = 1; } });
    for (const m of F.mines) list.push({ y: m.y, f: () => { const y = Math.round(m.y - (m.z || 0)); ctx.fillStyle = P.k; ctx.fillRect(Math.round(m.x) - 3, y - 4, 7, 5); ctx.fillStyle = P[3]; ctx.fillRect(Math.round(m.x) - 2, y - 3, 5, 3); const on = m.t > m.fly + m.arm && (F.t * 8 | 0) % 2; ex.fillStyle = ctx.fillStyle = on ? P.r : P.n; ctx.fillRect(Math.round(m.x), y - 3, 1, 1); if (on) ex.fillRect(Math.round(m.x), y - 3, 1, 1); } });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.f();
    // 残影
    for (const g of F.ghosts) {
      if (g.k === 'slash') { ex.strokeStyle = D.rgba(P.Y, g.t / 0.12); ex.lineWidth = 2; ex.beginPath(); ex.arc(g.x, g.y, 9, g.a - 1.2, g.a + 1.2); ex.stroke(); ex.lineWidth = 1; }
      else if (g.k === 'muzzle') { ex.fillStyle = g.col; ex.save(); ex.translate(g.x, g.y); ex.rotate(g.a); ex.fillRect(0, -2, 7, 4); ex.fillStyle = P.Y; ex.fillRect(0, -1, 10, 2); ex.restore(); }
      else { ctx.globalAlpha = g.t / 0.2 * 0.6; D.blit(ctx, D.SPR.body, g.x, g.y - 2, g.flip, 'flash'); ex.globalAlpha = g.t / 0.2 * 0.5; ex.drawImage(tinted(D.SPR.body, g.col), Math.round(g.x - D.SPR.body.w / 2), Math.round(g.y - 2 - D.SPR.body.h)); ex.globalAlpha = 1; ctx.globalAlpha = 1; }
    }
    // 弹道
    for (const s of F.shots) { const a = Math.atan2(s.vy, s.vx), L = s.k === 'bolt' ? 7 : 4; ex.strokeStyle = s.k === 'bolt' ? P.O : P.Y; ex.lineWidth = s.k === 'bolt' ? 2 : 1; ex.beginPath(); ex.moveTo(s.x, s.y); ex.lineTo(s.x - Math.cos(a) * L, s.y - Math.sin(a) * L); ex.stroke(); ex.fillStyle = P.Y; ex.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2); }
    ex.lineWidth = 1;
    for (const s of F.eshots) { const x = Math.round(s.x), y = Math.round(s.y), big = s.r >= 3; ctx.fillStyle = P.k; ctx.fillRect(x - 2, y - 2, 5, 5); ex.fillStyle = s.col; ex.fillRect(x - 2, y - 1, 5, 3); ex.fillRect(x - 1, y - 2, 3, 5); ex.fillStyle = '#ffffff'; ex.fillRect(x - 1, y - 1, 2, 2); }
    for (const s of F.saws) { ex.save(); ex.translate(Math.round(s.x), Math.round(s.y)); ex.rotate(s.rot); ex.fillStyle = P[5]; ex.fillRect(-4, -1, 8, 2); ex.fillRect(-1, -4, 2, 8); ex.fillStyle = P[6]; ex.fillRect(-3, -3, 2, 2); ex.fillRect(1, 1, 2, 2); ex.restore(); }
    for (const b of F.bolts) { ex.strokeStyle = b.t > 0.08 ? P.C : P.c; ex.lineWidth = b.t > 0.1 ? 2 : 1; ex.beginPath(); b.pts.forEach((q, i) => i ? ex.lineTo(q[0], q[1]) : ex.moveTo(q[0], q[1])); ex.stroke(); }
    for (const b of F.beams) { const k = b.t / b.max; ex.strokeStyle = b.col; ex.lineWidth = Math.max(1, Math.round(6 * k)); ex.beginPath(); ex.moveTo(b.x0, b.y0); ex.lineTo(b.x1, b.y1); ex.stroke(); ex.strokeStyle = '#ffffff'; ex.lineWidth = Math.max(1, Math.round(2 * k)); ex.stroke(); }
    ex.lineWidth = 1;
    if (p.railT > 0) { const a = p.railA; ex.strokeStyle = D.rgba(P.c, 0.35 + 0.4 * Math.sin(F.t * 60)); ex.setLineDash([2, 3]); ex.beginPath(); ex.moveTo(p.x, p.y - 6); ex.lineTo(p.x + Math.cos(a) * 400, p.y - 6 + Math.sin(a) * 400); ex.stroke(); ex.setLineDash([]); }
    // 粒子
    for (const q of F.parts) {
      const k = q.life / q.max;
      if (q.k === 'spark') { ex.strokeStyle = q.col; ex.globalAlpha = Math.min(1, k * 1.5); ex.beginPath(); ex.moveTo(Math.round(q.x), Math.round(q.y)); ex.lineTo(Math.round(q.x - q.vx * 0.025), Math.round(q.y - q.vy * 0.025)); ex.stroke(); }
      else if (q.k === 'debris') { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y - q.z), 2, 2); }
      else if (q.k === 'smoke') { ctx.globalAlpha = k * 0.5; ctx.fillStyle = q.col; const s = Math.round(q.size); ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s); }
      else if (q.k === 'ring') { const r = q.r * D.ease.outCubic(1 - k); ex.strokeStyle = q.col; ex.globalAlpha = k; ex.lineWidth = k > 0.5 ? 2 : 1; ex.beginPath(); ex.ellipse(q.x, q.y, r, r * 0.6, 0, 0, TAU); ex.stroke(); ex.lineWidth = 1; }
      ctx.globalAlpha = 1; ex.globalAlpha = 1;
    }
    for (const g of F.pickups) { ex.fillStyle = P.y; ex.fillRect(Math.round(g.x) - 1, Math.round(g.y) - 1, 2, 2); ex.fillStyle = P.Y; ex.fillRect(Math.round(g.x), Math.round(g.y) - 1, 1, 1); }
    // 灯具与光柱
    for (const l of A.lights) if (l.shaft) {
      const fl = flick(l, time), x = Math.round(l.x), y = Math.round(l.y);
      ctx.fillStyle = P.k; ctx.fillRect(x - 6, y - 2, 12, 4); ctx.fillStyle = '#3a3f55'; ctx.fillRect(x - 5, y - 2, 10, 2);
      ex.fillStyle = D.rgba(l.col, 0.9 * fl); ex.fillRect(x - 4, y + 1, 8, 1);
      const g = ex.createLinearGradient(0, y, 0, y + 120); g.addColorStop(0, D.rgba(l.col, 0.13 * fl)); g.addColorStop(1, D.rgba(l.col, 0));
      ex.fillStyle = g; ex.beginPath(); ex.moveTo(x - 5, y + 2); ex.lineTo(x + 5, y + 2); ex.lineTo(x + 30, y + 120); ex.lineTo(x - 30, y + 120); ex.fill();
    }
    // 灰尘
    for (const m of F.motes) { ex.fillStyle = D.rgba('#ffe9c4', 0.12 + 0.12 * Math.sin(time * 2 + m.s * 10)); ex.fillRect(Math.round(m.x), Math.round(m.y), 1, 1); }
    ctx.restore(); ex.restore();

    // 光
    const L = D.Post;
    for (const l of A.lights) L.addLight(l.x - cx, l.y + (l.oy || 0) - cy, l.r, l.col, l.a * flick(l, time));
    for (const l of F.tlights) L.addLight(l.x - cx, l.y - cy, l.r, l.col, l.a);
    if (p.hp > 0) { L.addLight(p.x - cx, p.y - 8 - cy, 80, '#ffb070', 0.7); L.addLight(p.x + Math.cos(p.aim) * 30 - cx, p.y - 6 + Math.sin(p.aim) * 30 - cy, 50, '#ffe0b0', 0.25); }
    for (const e of F.enemies) if (!e.dead) { const c = e.kind === 'crawler' ? P.g : e.kind === 'turret' ? P.m : P.r; L.addLight(e.x - cx, e.y - 8 - cy, e.kind === 'boss' ? 90 : 42, c, e.tele > 0 ? 1 : 0.55); }
    for (const s of F.eshots) L.addLight(s.x - cx, s.y - cy, 22, s.col, 0.7);
    for (const s of F.shots) L.addLight(s.x - cx, s.y - cy, 18, P.O, 0.6);
    const hurtTint = p.hurtT > 0 ? D.rgba('#ff1030', p.hurtT * 0.35) : null;
    L.render(ctx, A.ambient, { tint: hurtTint });

    // 光照之后：意图、伤害数字（永远看得清）
    for (const e of F.enemies) if (!e.dead && e.spawnT <= 0) intentUI(ctx, F, e, cx, cy);
    for (const t of F.texts) {
      const k = t.t < 0.12 ? D.ease.outBack(t.t / 0.12) : 1, sc = t.big ? 2 : 1;
      if (t.t > 0.7) ctx.globalAlpha = 1 - (t.t - 0.7) / 0.2;
      D.text(ctx, t.s, t.x - cx, t.y - cy - (1 - k) * 6, t.col, { align: 'center', scale: sc });
      ctx.globalAlpha = 1;
    }
    if (!F.noHud) hud(ctx, F, time);
    if (!F.banner) D.banner = null;
    if (F.banner) banner(ctx, F.banner);
  };

  function flick(l, time) { return l.flick > 0.3 ? ((Math.sin(time * 23 + l.seed) + Math.sin(time * 7.3 + l.seed * 3)) > 1.2 ? 0.15 : 1) : 1 - l.flick * Math.sin(time * 9 + l.seed); }
  const tintCache = new Map();
  function tinted(spr, col) {
    const key = col; if (tintCache.has(key)) return tintCache.get(key);
    const [c, x] = D.canvas(spr.w, spr.h); x.drawImage(spr.flash, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, spr.w, spr.h);
    tintCache.set(key, c); return c;
  }

  function drawPlayer(ctx, ex, F, p) {
    const flip = Math.cos(p.aim) < 0;
    // 围巾（在身后）
    const s = p.scarf;
    const scarfLine = (col, off) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(Math.round(s[0].x), Math.round(s[0].y + off)); for (let i = 1; i < s.length; i++) ctx.lineTo(Math.round(s[i].x), Math.round(s[i].y + off)); ctx.stroke(); };
    ctx.lineWidth = 2; scarfLine('#b8431c', 1); ctx.lineWidth = 1; scarfLine(P.o, 0);
    if (p.flash > 0 || (p.inv > 0 && p.dashT <= 0 && (F.t * 20 | 0) % 2)) { drawPlayerBody(ctx, ex, F, p.x, p.y, flip, p.walk, false, true); }
    else drawPlayerBody(ctx, ex, F, p.x, p.y, flip, p.walk);
    // 护盾泡
    if (p.shield > 0) { ex.strokeStyle = D.rgba(P.c, 0.35 + 0.25 * Math.sin(F.t * 8)); ex.beginPath(); ex.ellipse(Math.round(p.x), Math.round(p.y - 7), 10, 11, 0, 0, TAU); ex.stroke(); }
  }
  function drawPlayerBody(ctx, ex, F, x, y, flip, walk, ghost, white) {
    const p = F.player, moving = !ghost && Math.hypot(p.vx, p.vy) > 20;
    const bob = moving ? Math.round(Math.abs(Math.sin(walk)) * -1) : Math.round(Math.sin(F.t * 2.5) * 0.5 - 0.5);
    // 腿
    const l1 = moving ? Math.round(Math.sin(walk) * 2) : 0, l2 = -l1;
    ctx.fillStyle = P.k; ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4 + Math.min(0, l1), 3, 4 + Math.abs(Math.min(0, l1))); ctx.fillRect(Math.round(x) + 1, Math.round(y) - 4 + Math.min(0, l2), 3, 4 + Math.abs(Math.min(0, l2)));
    ctx.fillStyle = P[1]; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 4 + Math.min(0, l1), 1, 3); ctx.fillRect(Math.round(x) + 2, Math.round(y) - 4 + Math.min(0, l2), 1, 3);
    const which = white ? 'flash' : null;
    actor(ctx, ex, D.SPR.body, x, y - 2 + bob, flip, white);
    // 手臂与扳手
    const a = ghost ? 0 : p.aim + (p.swingT > 0 ? (p.swingDir || 1) * (p.swingT / 0.14 - 0.5) * 2.2 : 0);
    const sx = Math.round(x + (flip ? -3 : 3)), sy = Math.round(y - 7 + bob);
    for (let i = 2; i <= 8; i++) { const px = Math.round(sx + Math.cos(a) * i), py = Math.round(sy + Math.sin(a) * i); ctx.fillStyle = i > 6 ? P[5] : P[3]; ctx.fillRect(px, py, 1, 1); if (i === 8) { ctx.fillStyle = P.k; ctx.fillRect(px + (Math.cos(a) > 0 ? 1 : -1), py, 1, 1); } }
    if (p.railT > 0 && !ghost) { ex.fillStyle = P.C; ex.fillRect(Math.round(sx + Math.cos(a) * 9) - 1, Math.round(sy + Math.sin(a) * 9) - 1, 3, 3); }
    actor(ctx, ex, D.SPR.head, x, y - 12 + bob + (moving ? Math.round(Math.sin(walk - 0.6) * -0.6) : 0), flip, white);
  }

  function drawEnemy(ctx, ex, F, e) {
    const white = e.flash > 0, sp = e.spawnT > 0;
    if (sp) ctx.globalAlpha = 1 - e.spawnT / 0.35;
    const x = Math.round(e.x), y = Math.round(e.y), tele = e.tele > 0;
    const shakeX = tele && e.tele < 0.25 ? Math.round(Math.sin(F.t * 80)) : 0;
    if (e.kind === 'crawler') {
      const z = Math.round(e.z || 0), ph = e.t * 14;
      ctx.fillStyle = P.b;
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const hx = x + side * 4, hy = y - 3 - z + (i - 1) * 2, w = Math.sin(ph + i * 2.1 + (side > 0 ? 1.5 : 0));
        const fx = x + side * (10 + (i === 1 ? 1 : 0)), fy = y - 1 + (i - 1) * 3 + Math.round(w * 1.5) - (z > 0 ? 2 : 0);
        const kx = (hx + fx) / 2 + side, ky = Math.min(hy, fy) - 2 - (tele ? 1 : 0);
        line(ctx, hx, hy, kx, ky, white ? '#fff' : P.n); line(ctx, kx, ky, fx, fy, white ? '#fff' : P.b);
      }
      actor(ctx, ex, D.SPR.crawler, x + shakeX, y - z + (tele ? 1 : 0), e.face < 0, white);
    } else if (e.kind === 'drone') {
      const z = Math.round(6 + Math.sin(e.t * 3) * 1.5);
      const blade = (F.t * 30 | 0) % 2;
      ctx.fillStyle = P[4]; ctx.fillRect(x - 11, y - z - 9, 4, 1); ctx.fillRect(x + 8, y - z - 9, 4, 1);
      if (blade) { ctx.fillStyle = P[5]; ctx.fillRect(x - 13, y - z - 10, 7, 1); ctx.fillRect(x + 7, y - z - 10, 7, 1); }
      actor(ctx, ex, D.SPR.drone, x + shakeX, y - z, e.face < 0, white);
    } else if (e.kind === 'turret') {
      actor(ctx, ex, D.SPR.turret, x, y, false, white);
      if (tele) { const k = 1 - e.tele / e.teleMax, r = Math.round(1 + k * 3); ex.fillStyle = P.M; ex.fillRect(x - r, y - 8 - r, r * 2 + 1, r * 2 + 1); }
    } else if (e.kind === 'engineer') {
      const tread = (e.t * 10 | 0) % 2;
      ctx.fillStyle = P.k; ctx.fillRect(x - 9, y - 3, 18, 4); ctx.fillStyle = P[2]; ctx.fillRect(x - 8, y - 2, 16, 2); ctx.fillStyle = P[4]; for (let i = -8 + tread; i < 8; i += 2) ctx.fillRect(x + i, y - 2, 1, 1);
      actor(ctx, ex, D.SPR.engineer, x + shakeX, y - 2, e.face < 0, white);
      // 圆锯臂
      const ax = x + e.face * 11, ay = y - 9, spin = F.t * (e.act || tele ? 40 : 8);
      ctx.fillStyle = P.k; ctx.fillRect(ax - 4, ay - 4, 9, 9); ctx.fillStyle = P[4]; ctx.fillRect(ax - 3, ay - 3, 7, 7);
      for (let i = 0; i < 4; i++) { const t = spin + i * Math.PI / 2; (e.act || tele ? ex : ctx).fillStyle = e.act || tele ? P.O : P[6]; (e.act || tele ? ex : ctx).fillRect(Math.round(ax + Math.cos(t) * 4), Math.round(ay + Math.sin(t) * 4), 1, 1); }
      ctx.fillStyle = P[2]; ctx.fillRect(ax - 1, ay - 1, 2, 2);
      if (e.shield > 0) { ex.strokeStyle = D.rgba(P.c, 0.5); ex.strokeRect(x - 11.5, y - 20.5, 23, 22); }
    } else if (e.kind === 'boss') drawBoss(ctx, ex, F, e, white);
    ctx.globalAlpha = 1;
    // 血条（受过伤才显示）
    if (e.hp < e.maxHp && e.kind !== 'boss') {
      const w = Math.max(10, e.r * 2 + 2), bx = x - w / 2, by = y + 3;
      ctx.fillStyle = P.k; ctx.fillRect(bx - 1, by - 1, w + 2, 4); ctx.fillStyle = '#3a1520'; ctx.fillRect(bx, by, w, 2);
      ctx.fillStyle = P.r; ctx.fillRect(bx, by, Math.max(0, Math.round(w * e.hp / e.maxHp)), 2);
      if (e.shield > 0) { ctx.fillStyle = P.c; ctx.fillRect(bx, by - 1, Math.min(w, Math.round(w * e.shield / e.maxHp)), 1); }
    }
  }
  function drawBoss(ctx, ex, F, e, white) {
    const x = Math.round(e.x), y = Math.round(e.y - (e.z || 0)), t = F.t, hot = e.phase === 2;
    const R = (a, b, w, h, c) => { ctx.fillStyle = white ? '#ffffff' : c; ctx.fillRect(x + a, y + b, w, h); };
    const Ex = (a, b, w, h, c) => { ex.fillStyle = c; ex.fillRect(x + a, y + b, w, h); };
    // 履带
    R(-17, -6, 34, 7, P.k); R(-16, -5, 32, 5, P[2]); for (let i = -16 + ((t * 12 | 0) % 3); i < 16; i += 3) R(i, -4, 1, 3, P[4]);
    // 机体
    R(-15, -26, 30, 21, P.k); R(-14, -25, 28, 19, '#3b3f55'); R(-14, -25, 28, 3, '#5d6683'); R(-14, -9, 28, 3, '#23263a');
    for (let i = -12; i < 13; i += 6) { R(i, -20, 4, 2, P.y); R(i + 2, -20, 2, 2, P.k); }
    // 核心
    const pulse = 0.5 + 0.5 * Math.sin(t * (hot ? 14 : 6));
    R(-5, -17, 10, 8, P.k); R(-4, -16, 8, 6, hot ? P.r : P.o); if (!white) { Ex(-4, -16, 8, 6, hot ? P.r : P.o); Ex(-2, -15, 4, 4, pulse > 0.5 ? P.Y : P.O); }
    // 驾驶舱
    R(-8, -34, 16, 9, P.k); R(-7, -33, 14, 7, '#2f3550'); R(-6, -31, 12, 2, P.r); if (!white) Ex(-6, -31, 12, 2, e.tele > 0 ? P.R : P.r);
    R(-1, -38, 2, 4, P[4]); if (!white && (t * 3 | 0) % 2) Ex(-1, -39, 2, 1, P.r);
    // 两只钳臂：朝向目标伸出
    const T = target(F), aa = Math.atan2(T.y - e.y, T.x - e.x);
    for (const side of [-1, 1]) {
      const sx = x + side * 15, sy = y - 18, reach = e.act && e.act.k === 'slam' ? 14 : 9 + Math.sin(t * 3 + side) * 2;
      const a = aa + side * 0.6, mx = sx + side * 6, my = sy + 4, hx = mx + Math.cos(a) * reach, hy = my + Math.sin(a) * reach;
      thick(ctx, sx, sy, mx, my, white ? '#fff' : P[3]); thick(ctx, mx, my, hx, hy, white ? '#fff' : P[4]);
      ctx.fillStyle = white ? '#fff' : P.k; ctx.fillRect(Math.round(hx) - 3, Math.round(hy) - 3, 7, 7);
      ctx.fillStyle = white ? '#fff' : P.O; ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 2, 2, 5); ctx.fillRect(Math.round(hx) + 1, Math.round(hy) - 2, 2, 5);
    }
    // 激光
    if (e.act && e.act.k === 'laser' && e.act.len) {
      const a = e.act.a, ox = e.x, oy = e.y - 22;
      ex.strokeStyle = P.r; ex.lineWidth = 5; ex.beginPath(); ex.moveTo(ox, oy); ex.lineTo(ox + Math.cos(a) * e.act.len, oy + Math.sin(a) * e.act.len); ex.stroke();
      ex.strokeStyle = '#ffffff'; ex.lineWidth = 1; ex.stroke(); ex.lineWidth = 1;
    }
    if (hot && (t * 20 | 0) % 3 === 0) F.parts.push({ k: 'smoke', x: e.x + F.rng.range(-12, 12), y: e.y - 26, vx: F.rng.range(-5, 5), vy: -20, life: 0.8, max: 0.8, col: '#2a2a35', size: 2 });
  }
  // 角色：正常画一遍，再以较低透明度画进发光层，让角色在暗处也看得清；受击时整只发白
  const LIFT = 0.28;
  function actor(ctx, ex, spr, x, y, flip, white) {
    D.blit(ctx, spr, x, y, flip, white ? 'flash' : null);
    ex.globalAlpha = white ? 0.9 : LIFT; D.blit(ex, spr, x, y, flip, white ? 'flash' : null); ex.globalAlpha = 1;
    if (!white && spr.emit) D.blit(ex, spr, x, y, flip, 'emit');
  }
  function line(ctx, x0, y0, x1, y1, col) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0 || 1; ctx.fillStyle = col; for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1); }
  function thick(ctx, x0, y0, x1, y1, col) { line(ctx, x0, y0 - 1, x1, y1 - 1, P.k); line(ctx, x0, y0 + 2, x1, y1 + 2, P.k); line(ctx, x0, y0, x1, y1, col); line(ctx, x0, y0 + 1, x1, y1 + 1, col); }

  // 地面预警（在光照之前画，会被照亮）
  function telegraph(ctx, ex, F, e) {
    if (e.tele <= 0 && !(e.act && (e.act.k === 'slam'))) return;
    const k = e.tele > 0 ? 1 - e.tele / e.teleMax : 1, it = e.intent, blink = (F.t * 16 | 0) % 2;
    const col = D.rgba(P.r, 0.25 + 0.35 * k);
    ex.strokeStyle = D.rgba(P.r, 0.5 + 0.5 * k); ex.fillStyle = col;
    if (it.k === 'leap' && e.mark) { ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, 9, 5, 0, 0, TAU); ex.stroke(); ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, 9 * k, 5 * k, 0, 0, TAU); ex.fill(); }
    else if (it.k === 'slam' && e.mark) { const r = 44; ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, r, r * 0.6, 0, 0, TAU); ex.stroke(); ex.fillStyle = D.rgba(P.r, 0.18 + (blink ? 0.08 : 0)); ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, r * k, r * 0.6 * k, 0, 0, TAU); ex.fill(); }
    else if (it.k === 'burst' && e.aimA != null) { ex.setLineDash(k > 0.7 ? [] : [3, 3]); ex.lineWidth = k > 0.7 ? 1 : 1; ex.strokeStyle = D.rgba(P.r, 0.4 + 0.6 * k); ex.beginPath(); ex.moveTo(e.x, e.y - 10); ex.lineTo(e.x + Math.cos(e.aimA) * 200, e.y - 10 + Math.sin(e.aimA) * 200); ex.stroke(); ex.setLineDash([]); }
    else if (it.k === 'charge' && e.aimA != null) { ex.save(); ex.translate(e.x, e.y - 4); ex.rotate(e.aimA); ex.strokeRect(0, -8, 150, 16); ex.fillRect(0, -8, 150 * k, 16); ex.restore(); }
    else if (it.k === 'laser') { const a = e.aimA != null ? e.aimA : 0; ex.setLineDash([4, 4]); ex.strokeStyle = D.rgba(P.r, 0.5 + 0.5 * k); ex.beginPath(); ex.moveTo(e.x, e.y - 22); ex.lineTo(e.x + Math.cos(a) * 400, e.y - 22 + Math.sin(a) * 400); ex.stroke(); ex.setLineDash([]); }
    else if (it.k === 'fan' || it.k === 'ring') { ex.beginPath(); ex.ellipse(e.x, e.y - 4, 10 + 14 * k, (10 + 14 * k) * 0.6, 0, 0, TAU); ex.stroke(); }
  }

  // ── 意图（StS 式）：图标 + 数值 + 倒计时弧
  const INTENT_COL = { leap: P.r, burst: P.r, fan: P.m, ring: P.m, charge: P.r, jam: P.y, armor: P.c, slam: P.r, laser: P.r, summon: P.g };
  function intentUI(ctx, F, e, cx, cy) {
    const it = e.intent; if (!it) return;
    const top = e.kind === 'boss' ? 46 : e.kind === 'engineer' ? 26 : e.kind === 'turret' ? 16 : e.kind === 'drone' ? 22 : 14;
    const x = Math.round(e.x - cx), y = Math.round(e.y - cy - top - (e.z || 0)), col = INTENT_COL[it.k] || P[6];
    const label = it.k === 'armor' ? '+' + it.sh : it.k === 'summon' ? '+' + it.n : it.n ? it.dmg + 'x' + it.n : String(it.dmg);
    const iw = 7, tw = D.textW(label), w = iw + 2 + tw, bx = x - Math.round(w / 2);
    // 图标
    const ic = INTENT_ICON[it.k] || INTENT_ICON.leap; ic(ctx, bx, y - 3, col);
    D.text(ctx, label, bx + iw + 2, y - 2, e.tele > 0 ? P.Y : P[6]);
    if (e.tele > 0) { // 倒计时条
      const k = 1 - e.tele / e.teleMax; ctx.fillStyle = P.k; ctx.fillRect(bx - 1, y + 5, w + 2, 3); ctx.fillStyle = col; ctx.fillRect(bx, y + 6, Math.round(w * k), 1);
    }
    if (e.stun > 0) for (let i = 0; i < 3; i++) { const a = F.t * 6 + i * 2.1; ctx.fillStyle = P.Y; ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y - 8 + Math.sin(a) * 2), 1, 1); } // 眩晕：头顶转圈的星点
  }
  const INTENT_ICON = {
    leap: (c, x, y, col) => { pix(c, x, y, ['..kk...', '.krrk..', 'krrrrk.', 'krRrrrk', '.krrrk.', '..kk...'], col); },
    burst: (c, x, y, col) => { pix(c, x, y, ['.......', 'kkkkkk.', 'krrrrRk', 'kkkkkk.', '.k.k...', '.......'], col); },
    fan: (c, x, y, col) => { pix(c, x, y, ['.k...k.', 'krk.krk', '.k.k.k.', '..krk..', '...k...', '.......'], col); },
    charge: (c, x, y, col) => { pix(c, x, y, ['...k...', 'kkkrk..', 'krrrrk.', 'kkkrk..', '...k...', '.......'], col); },
    jam: (c, x, y, col) => { pix(c, x, y, ['.kkkk..', 'krrrrk.', 'krkkrk.', 'krrrrk.', '.kkkk..', '.......'], col); },
    armor: (c, x, y, col) => { pix(c, x, y, ['kkkkkk.', 'krrrrk.', 'krRrrk.', '.krrk..', '..kk...', '.......'], col); },
    summon: (c, x, y, col) => { pix(c, x, y, ['..k....', '.krk...', 'krrrk..', '.krk...', '..k....', '.......'], col); },
  };
  INTENT_ICON.ring = INTENT_ICON.fan; INTENT_ICON.slam = INTENT_ICON.leap; INTENT_ICON.laser = INTENT_ICON.burst;
  function pix(ctx, x, y, rows, col) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.') continue; ctx.fillStyle = ch === 'k' ? P.k : ch === 'R' ? '#ffffff' : col; ctx.fillRect(x + i, y + j, 1, 1); } }

  // ── 画布上的 HUD：左上耐久与护盾，电量在卡牌区（DOM）
  function hud(ctx, F, time) {
    const p = F.player, x = 6, y = 6, w = 70;
    ctx.fillStyle = P.k; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#3a1520'; ctx.fillRect(x, y, w, 5);
    const k = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = k < 0.3 && (time * 4 | 0) % 2 ? P.R : P.r; ctx.fillRect(x, y, Math.round(w * k), 5);
    ctx.fillStyle = '#ffffff40'; ctx.fillRect(x, y, Math.round(w * k), 1);
    if (p.shield > 0) { ctx.fillStyle = P.c; ctx.fillRect(x, y + 4, Math.min(w, Math.round(w * p.shield / p.maxHp)), 2); }
    D.text(ctx, Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp, x + w + 4, y, P[6]);
    if (p.shield > 0) D.text(ctx, '+' + Math.ceil(p.shield), x + w + 4 + D.textW(Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp) + 4, y, P.c);
    // 闪避冷却
    const dk = D.clamp(1 - p.dashCd / (D.PLAYER.dashCd * (F.run.relics.spring ? 0.6 : 1)), 0, 1);
    ctx.fillStyle = P.k; ctx.fillRect(x - 1, y + 8, 22, 4); ctx.fillStyle = dk >= 1 ? P.c : P[3]; ctx.fillRect(x, y + 9, Math.round(20 * dk), 2);
    // 零件
    D.text(ctx, '$' === '$' ? String(F.run.gold + F.gold) : '', W - 8, 6, P.y, { align: 'right' });
    ctx.fillStyle = P.y; ctx.fillRect(W - 8 - D.textW(String(F.run.gold + F.gold)) - 6, 6, 4, 5); ctx.fillStyle = P.h; ctx.fillRect(W - 8 - D.textW(String(F.run.gold + F.gold)) - 5, 7, 2, 3);
    // Boss 血条
    const boss = F.enemies.find(e => e.kind === 'boss' && !e.dead);
    if (boss) {
      const bw = 200, bx = (W - bw) / 2, by = 18;
      ctx.fillStyle = P.k; ctx.fillRect(bx - 2, by - 2, bw + 4, 8); ctx.fillStyle = '#3a1520'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = boss.phase === 2 ? P.O : P.r; ctx.fillRect(bx, by, Math.round(bw * boss.hp / boss.maxHp), 4); ctx.fillStyle = '#ffffff50'; ctx.fillRect(bx, by, Math.round(bw * boss.hp / boss.maxHp), 1);
      ctx.fillStyle = P.k; ctx.fillRect(bx + bw / 2, by, 1, 4);
    }
    // 准星
    const I = D.Input, mx = Math.round(I.mx), my = Math.round(I.my);
    ctx.fillStyle = P.k; ctx.fillRect(mx - 4, my - 1, 9, 3); ctx.fillRect(mx - 1, my - 4, 3, 9);
    ctx.fillStyle = P.Y; ctx.fillRect(mx - 3, my, 2, 1); ctx.fillRect(mx + 2, my, 2, 1); ctx.fillRect(mx, my - 3, 1, 2); ctx.fillRect(mx, my + 2, 1, 2);
  }
  function banner(ctx, b) {
    const k = b.t < 0.3 ? b.t / 0.3 : b.t > 2 ? 1 - (b.t - 2) / 0.4 : 1;
    ctx.fillStyle = `rgba(5,4,10,${0.7 * k})`; ctx.fillRect(0, 84, W, 40);
    ctx.fillStyle = D.rgba(P.r, k); ctx.fillRect(0, 84, Math.round(W * Math.min(1, b.t * 3)), 1); ctx.fillRect(W - Math.round(W * Math.min(1, b.t * 3)), 123, W, 1);
    D.banner = { text: b.text, sub: b.sub, a: k }; // 文字交给界面层（中文）
  }

  // 给测试看的文字状态
  D.fightText = F => ({ hp: Math.ceil(F.player.hp), shield: Math.ceil(F.player.shield), energy: +F.energy.toFixed(2), hand: F.hand.map(c => c.name), draw: F.draw.length, discard: F.discard.length, enemies: F.enemies.filter(e => !e.dead).map(e => ({ k: e.kind, hp: Math.ceil(e.hp), intent: e.intent && e.intent.k })), over: F.over });
})(D);
