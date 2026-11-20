/* 末班之后 · 小样二：玩家：消耗品、换弹、开火、近战、模块、型号技能、挨打、围巾（从 combat.js 拆出来） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, Z = D.Z, VW = D.W / Z, VH = D.H / Z, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const Q = () => D.QUALITY;
  const K = D.K || (D.K = {}); // 站内各文件共用的内部函数
  // 别的文件里定义的函数：调用时再去 D.K 上找
  const hitWall = (...a) => K.hitWall(...a);
  const part = (...a) => K.part(...a);
  const text = (...a) => K.text(...a);
  const ring = (...a) => K.ring(...a);
  const flashLight = (...a) => K.flashLight(...a);
  const addShake = (...a) => K.addShake(...a);
  const kick = (...a) => K.kick(...a);
  const muzzle = (...a) => K.muzzle(...a);
  const zig = (...a) => K.zig(...a);
  const alertAround = (...a) => K.alertAround(...a);
  const hurt = (...a) => K.hurt(...a);

  function finishUse(S, k) {
    const p = S.player, u = D.USE[k];
    D.playerAct(p, 'done', 0.4, k);
    if (u.heal) { p.hp = Math.min(p.maxHp, p.hp + u.heal); text(S, p.x, p.y - 24, '+' + u.heal, P.g, true); for (let i = 0; i < 14; i++) part(S, 'spark', p.x, p.y - 8, S.rng.range(-50, 50), S.rng.range(-80, 0), 0.4, P.g); sfx('heal'); }
    if (u.shield) { p.shield += u.shield; p.shieldT = 0; ring(S, p.x, p.y - 5, 16, P.c); sfx('shield'); }
    if (u.buff) { p.buffT = u.buff; text(S, p.x, p.y - 24, 'STIM', P.g); sfx('power'); }
    if (u.cd) p.healCd = u.cd;
    p.useK = null;
  }
  // 扔手雷：落点是准星（最远 130），路上碰到墙就落在墙前
  function throwNade(S, k) {
    const p = S.player, I = D.Input, a = Math.atan2(I.wy - p.y, I.wx - p.x), want = Math.min(130, Math.hypot(I.wx - p.x, I.wy - p.y));
    let d = 0; while (d + 4 <= want && !D.solidAt(S.A, p.x + Math.cos(a) * (d + 4), p.y + Math.sin(a) * (d + 4))) d += 4;
    const tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d;
    S.nades.push({ x: p.x, y: p.y - 8, sx: p.x, sy: p.y - 8, tx, ty, t: 0, fly: 0.2 + d / 420, fuse: k === 'frag' ? 0.6 : 0.3, dmg: 30, own: true, kind: k });
    p.swingT = 0.15; D.playerAct(p, 'throw', 0.32); sfx('throw'); S.raid.noise += 0.3;
  }
  function startReload(S, gun) { const p = S.player; if (p.reload > 0) return; if (!D.pickTier(S.raid, gun.cal)) { if (!S.noAmmoT || S.t > S.noAmmoT) { S.noAmmoT = S.t + 1; text(S, p.x, p.y - 26, 'NO AMMO', P.r); sfx('nope'); } return; } if (p.buffT > 0) { p.reload = gun.reload * 0.6 * (S.raid.pas.quick ? 0.65 : 1); p.reloadMax = p.reload; sfx('throw'); return; } p.reload = gun.reload * (S.raid.pas.quick ? 0.65 : 1); p.reloadMax = p.reload; sfx('throw'); }
  // cont：三连发步枪排队的第二、三发（arms.js 的 armsPre 里打出来）
  function fire(S, g, cont) {
    // 弹匣分段（ammo.js）：打出去的是最前面那一段；'S' 是超级弹（电容蓄满时整匣变的），穿透、伤害 ×1.8
    const front = D.magFront ? D.magFront(S.raid) : (S.raid.magTier || 1), over = front === 'S', tier = over ? 1 : front;
    if (g.x && K.fireOwn && K.fireOwn(S, g, cont)) return; // 不走弹匣的枪（过热步枪，arsenal-guns.js）
    const p = S.player, a = p.aim, ox = p.x + Math.cos(a) * 12, oy = p.y - 11 + Math.sin(a) * 7; // 枪口：新主角枪举在胸口高度
    p.mag--; S.raid.mag = p.mag; if (D.magPop) D.magPop(S.raid); p.fireCd = g.rate; p.lastShot = S.t; p.cloakT = 0;
    const xm = K.preShot ? K.preShot(S, g, cont) : 1; // M5：连发、转管、左轮最后一发
    const ads = p.ads || 0, full = g.scope && p.adsFull; // 开镜：准星收紧；满镜第一枪伤害 ×1.5
    const tm = (over ? 1 : D.AMMO_TIER[tier].mul) * (full ? 1.5 : 1) * xm, /* 超级弹不吃弹药等级（dmg-ladder.js 起一级弹 ×0.8） */ spread = g.spread * (g.n > 1 ? 1 : 1 + (p.bloom || 0) * 1.5 * (1 - ads)) * (1 - 0.9 * ads); // 连射越久越散
    if (g.scope) { p.ads = Math.min(ads, 0.35); p.adsFull = false; if (full) { flashLight(S, ox, oy, 70, '#fff2c8', 1); addShake(S, 0.25); } }
    if (g.lob) K.lob(S, g, Math.round(g.dmg * tm * (over ? D.SUPER_MUL : 1))); // 榴弹：抛出去落地炸
    else if (g.x && K.shootX) K.shootX(S, g, { ox, oy, a, tm: tm * (over ? D.SUPER_MUL : 1), spread, over }); // 新枪的子弹（arsenal-guns.js）
    else for (let k = 0; k < g.n; k++) {
      const b = a + (g.n > 1 ? (k / (g.n - 1) - 0.5) * spread : S.rng.range(-spread, spread)), s = g.speed * S.rng.range(0.92, 1.05);
      S.shots.push({ x: ox, y: oy, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: g.life || 0.9, dmg: Math.round(g.dmg * tm * (over ? D.SUPER_MUL : 1) * 10) / 10, r: over ? 3 : g.flame ? 4 : 2, pierce: g.pierce || over, over, boom: g.boom, hit: new Set(), col: over ? P.c : g.flame ? '#ff8a2e' : g.emp ? '#ffd84a' : g.boom ? P.m : P.O,
        bounce: g.bounce || 0, homing: g.homing || 0, pull: g.pull, burn: g.burn, emp: g.emp, flame: g.flame, bid: g.burst ? p.burstId : 0, bi: p.burstIdx || 0 });
    }
    if (over) { flashLight(S, ox, oy, 60, P.c, 1); addShake(S, 0.12); if (S.rng.chance(0.5)) sfx('zap'); }
    p.bloom = Math.min(1, (p.bloom || 0) + (g.n > 1 || g.pierce ? 0.5 : Math.min(0.22, g.rate * 1.5 + 0.05)) * (g.bloomMul || 1) * (g.flame || g.spin ? 0.15 : 1));
    if (!g.flame || p.mag % 3 === 0) muzzle(S, ox, oy, a, over ? P.c : g.flame ? '#ff8a2e' : g.boom || g.lob ? P.m : P.O, g.n > 1 ? 1.6 : 1, over || (g.pierce && !g.flame) ? 'line' : g.n > 1 ? 'cone' : g.boom || g.lob ? 'ball' : null);
    kick(S, a, g.kick || (g.n > 1 ? 4 : 1.2));
    // 后坐：镜头往反方向顶一下，按枪型分轻重
    S.recoil = Math.min(7, (S.recoil || 0) + ({ nail: 0.9, light: 0.6, shell: 3.2, slug: 4.5, rifle: 3.8, fuel: 0.15 }[g.cal] || (g.boom ? 2.4 : 0.8)) * (over ? 1.6 : 1) * (g.spin ? 0.5 : 1)); S.recoilA = a;
    // 弹壳从枪侧抛出、落地弹几下；能量枪喷一小股散热气；喷火枪、钉弩没有弹壳
    if (g.cal === 'cell') part(S, 'smoke', p.x + Math.cos(a) * 4, p.y - 10, S.rng.range(-8, 8), S.rng.range(-26, -10), 0.5, '#7fd8ff');
    else if (g.cal !== 'fuel' && !g.quiet) { const side = Math.cos(a) < 0 ? 1 : -1, pa = a + side * Math.PI / 2; for (let k = 0; k < (g.n > 1 ? 1 : 1); k++) part(S, 'debris', p.x + Math.cos(a) * 3, p.y - 10, Math.cos(pa) * S.rng.range(30, 55) - Math.cos(a) * 10, Math.sin(pa) * S.rng.range(10, 25) - 10, S.rng.range(1.2, 2), g.cal === 'shell' ? '#d04a2a' : '#e8b85a'); if (S.rng.chance(0.25)) sfx('tink'); }
    if (g.n > 1) addShake(S, 0.18);
    S.shotsFired++; alertAround(S, p.x, p.y, ((D.TUNE.sense || {}).shot || 180) * (S.raid.pas.muffler ? 0.6 : 1) * (g.quiet ? 0.25 : 1)); S.raid.noise += g.noise * (S.raid.pas.muffler ? 0.5 : 1);
    if (!g.flame || p.mag % 4 === 0) sfx(g.flame ? 'cool' : g.quiet ? 'throw' : g.lob ? 'orb' : g.n > 1 ? 'scatter' : g.pierce ? 'rail' : g.cal === 'rifle' ? 'snipe' : 'shot');
    if (p.mag <= 0) { p.burstQ = 0; startReload(S, g); }
  }
  // 近战判定统一放大：距离 ×1.25、扇面两边各宽 0.18（约 10°）；打子弹的范围再额外宽一点（距离 +10、两边再 +0.3）
  // 武器表里的 range / arc 不动（说明文字、升级型号照旧），所有判定都走 D.mRange / D.mArc
  const REACH = { r: 1.25, a: 0.18, pr: 10, pa: 0.3 };
  D.MELEE_REACH = REACH;
  D.mRange = m => m.range * REACH.r;
  D.mArc = m => m.arc + REACH.a;
  // 弹反：近战扫过的敌人子弹全部弹回去（melee.js 的 K.meleeParry 管反弹和特效；没有它就只打掉）
  function deflect(S, m, range, arc) {
    const p = S.player; let n = 0;
    for (const s of S.eshots) {
      if (!(s.life > 0)) continue;
      const dx = s.x - p.x, dy = s.y - (p.y - 6);
      if (Math.hypot(dx, dy) < range + REACH.pr && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < arc + REACH.pa) {
        if (K.meleeParry) K.meleeParry(S, s, m, n); s.life = 0; n++;
        for (let i = 0; i < 5; i++) part(S, 'spark', s.x, s.y, S.rng.range(-60, 60), S.rng.range(-60, 60), 0.2, P.Y);
      }
    }
    return n;
  }
  // heavy：按住右键蓄满再松开的重击（伤害 ×2.2、范围更大、击退并短暂震晕）
  // 背刺：打还没发现你的敌人 ×2.5（双匕首 ×4）；处决：近战打到残血（≤22%）的敌人直接打死（首领除外）
  function melee(S, m, heavy) {
    const p = S.player; p.meleeCd = m.cd * (heavy ? 1.3 : 1); p.cloakT = 0;
    const arc = D.mArc(m) + (heavy ? 0.35 : 0), range = D.mRange(m) + (heavy ? 6 : 0);
    if (heavy && m.heavy && K.meleeHeavy && K.meleeHeavy(S, m)) { deflect(S, m, range, arc); return; } // 招牌重击（melee.js），出手那一下也弹子弹
    p.swingT = heavy ? 0.22 : 0.16; p.swingDir *= -1; p.swingArc = arc;
    let hits = 0, kills = 0; const base = m.dmg * (S.raid.pas.edge ? 1.3 : 1) * (heavy ? 2.2 : 1) * (K.meleeMul ? K.meleeMul(S, m) : 1);
    for (const e of S.enemies) {
      if (e.dead || e.f !== S.f) continue;
      const dx = e.x - p.x, dy = (e.y - 4) - (p.y - 6), d = Math.hypot(dx, dy);
      if (d < range + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < arc) {
        let dmg = base, tag = null;
        const isB = D.ENEMIES[e.kind].boss;
        if (K.meleeHitMul) dmg *= K.meleeHitMul(S, m, e); // 链锯越锯越痛
        if (!isB && !e.aware) { dmg *= m.sneak || 2.5; tag = 'SNEAK'; }
        else if (!isB && e.hp <= e.maxHp * 0.22) { dmg = Math.max(dmg, e.hp + e.shield); tag = 'EXECUTE'; }
        hurt(S, e, Math.round(dmg), { kx: dx, ky: dy, kb: heavy ? 230 : m.kb || 90, col: heavy ? P.O : m.col || P[6], slash: true, melee: true, crit: !!tag || heavy, noShield: m.noShield, ice: m.ice, psn: m.psn });
        if (K.meleeOnHit) K.meleeOnHit(S, m, e, dmg, hits); // 新近战的命中效果（arsenal-melee.js）
        if (e.dead) kills++;
        if (tag) { text(S, e.x, e.y - 32, tag, tag === 'SNEAK' ? P.m : P.R, true); S.stop = Math.max(S.stop, 0.09); S.raid.crits = (S.raid.crits || 0) + 1; }
        if (m.stun || heavy) e.stun = Math.max(e.stun, Math.max(m.stun || 0, heavy ? 0.5 : 0));
        hits++;
      }
    }
    if (heavy) { ring(S, p.x + Math.cos(p.aim) * 10, p.y - 4 + Math.sin(p.aim) * 8, range + 4, P.O); addShake(S, 0.35); flashLight(S, p.x + Math.cos(p.aim) * 12, p.y - 6, 60, P.O, 1); sfx('heavy'); }
    deflect(S, m, range, arc);
    if (m.arc > 3) { ring(S, p.x, p.y, D.mRange(m) + 6, P.O); addShake(S, 0.3); sfx('slam'); }
    hitWall(S, p.x + Math.cos(p.aim) * 14, p.y - 6 + Math.sin(p.aim) * 14 + 6, base * (m.wallMul || 1));
    if (hits) K.capGain(S, D.SHELL.capPerHit * (m.capMul || 1)); // 电容（ammo.js）
    else if (!heavy) sfx('swing');
    if (K.meleeAfter) K.meleeAfter(S, m, hits);
    if (K.meleeSwing) K.meleeSwing(S, m, heavy, hits, kills); // 刀光、剑气、连斩、残心（melee.js）
  }
  // 完美闪避：闪避的无敌帧里刚好躲过一次攻击 → 0.5 秒慢动作、闪避冷却清零、电容 +12.5%（每次闪避只算一次）
  function perfectDodge(S) {
    S.attackedAt = S.t; // 躲开的攻击也算有人在打你
    const p = S.player; if (p.pdDone || !(p.dodgeUntil > S.t) || p.hp <= 0) return;
    p.pdDone = true; S.slowmo = 0.5; p.dashCd = 0; const before = p.cap; p.cap = Math.min(1, p.cap + 0.125);
    text(S, p.x, p.y - 30, 'PERFECT', P.C, true); ring(S, p.x, p.y - 6, 24, P.c); flashLight(S, p.x, p.y - 6, 90, P.c, 1.2); sfx('perfect');
    if (before < 1 && p.cap >= 1) { text(S, p.x, p.y - 40, 'CHARGED', P.c); ring(S, p.x, p.y - 5, 16, P.c); }
    S.raid.perfect = (S.raid.perfect || 0) + 1; S.events.push({ type: 'perfect' });
  }
  function useMod(S, id) {
    const p = S.player, a = p.aim, ox = p.x + Math.cos(a) * 8, oy = p.y - 6 + Math.sin(a) * 8, I = D.Input;
    switch (id) {
      case 'barrier': p.shield += 18; p.shieldT = 0; ring(S, p.x, p.y - 5, 16, P.c); sfx('shield'); break;
      case 'lunge': p.dashT = 0.15; p.dx = Math.cos(a) * 560; p.dy = Math.sin(a) * 560; p.inv = Math.max(p.inv, 0.22); p.lungeHit = { dmg: Math.round(14 * (S.raid.pas.edge ? 1.3 : 1)), hit: new Set() }; p.swingT = 0.18; sfx('lunge'); break;
      case 'mine': { const d = Math.min(150, Math.hypot(I.wx - p.x, I.wy - p.y)); S.mines.push({ x: p.x, y: p.y - 4, sx: p.x, sy: p.y - 4, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d, t: 0, fly: 0.32, arm: 0.35, dmg: 26, life: 6 }); sfx('throw'); break; }
      case 'arc': {
        let from = { x: ox, y: oy }; const hit = new Set();
        for (let n = 0; n < 3; n++) {
          let best = null, bd = n === 0 ? 170 : 110;
          for (const e of S.enemies) if (!e.dead && e.f === S.f && !hit.has(e)) { const d = Math.hypot(e.x - from.x, e.y - 6 - from.y); if (d < bd) { bd = d; best = e; } }
          if (!best) break;
          hit.add(best); S.bolts.push({ pts: zig(S, from.x, from.y, best.x, best.y - 6), t: 0.18 });
          hurt(S, best, 16, { kx: best.x - from.x, ky: best.y - from.y, kb: 40, col: P.c, melee: true, elec: true }); from = { x: best.x, y: best.y - 6 };
        }
        if (!hit.size) S.bolts.push({ pts: zig(S, ox, oy, ox + Math.cos(a) * 60, oy + Math.sin(a) * 60), t: 0.15 });
        flashLight(S, ox, oy, 80, P.c, 1); sfx('zap'); break;
      }
      case 'decoy': S.decoy = { x: p.x, y: p.y, t: 4 }; sfx('shield'); break;
      case 'coolant': S.slowT = 4; for (const e of S.enemies) if (!e.dead) for (let i = 0; i < 6; i++) part(S, 'smoke', e.x + S.rng.range(-6, 6), e.y - 4, S.rng.range(-10, 10), S.rng.range(-20, -5), 0.8, '#9fe9ff'); sfx('cool'); break;
      default: if (K.useModX) K.useModX(S, id); // M5 的新模块在 arms.js
    }
  }

  // ───────────────────────── 型号技能
  function useSkill(S, k) {
    const p = S.player, m3 = (S.raid.mast || 1) >= 3; // 熟练度 3 级：技能第二形态
    switch (k) {
      case 'scan': S.scanT = m3 ? 12 : 8; ring(S, p.x, p.y - 4, 60, P.c); flashLight(S, p.x, p.y, 160, P.c, 1); S.banner = { t: 1, text: '扫描', sub: '容器里最好的东西、本层的敌人都标出来了' }; for (const br of S.A.breakables) br.seen = true; sfx('zap'); break;
      case 'cloak': p.cloakT = m3 ? 6 : 4; for (const e of S.enemies) if (!e.dead && !D.ENEMIES[e.kind].boss) { e.aware = false; e.notice = 0; e.act = null; e.tele = 0; } ring(S, p.x, p.y - 6, 18, P.c); sfx('shield'); break;
      case 'slam': {
        p.shield += 20; p.shieldT = 0; ring(S, p.x, p.y, 46, P.O); ring(S, p.x, p.y, 30, P.Y); addShake(S, 0.5); sfx('slam');
        for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - p.x, e.y - p.y) < (m3 ? 70 : 50)) { hurt(S, e, m3 ? 30 : 20, { kx: e.x - p.x, ky: e.y - p.y, kb: 220, col: P.O }); if (!e.dead) e.stun = Math.max(e.stun, m3 ? 1.5 : 1); }
        for (let i = 0; i < 20; i++) part(S, 'debris', p.x + S.rng.range(-20, 20), p.y, S.rng.range(-80, 80), S.rng.range(-40, 40), 0.8, P[3]);
        break;
      }
      case 'magnet': {
        let n = 0; for (const g of S.ground.slice()) if (g.f === S.f && !g.dropped && Math.hypot(g.x - p.x, g.y - p.y) < (m3 ? 220 : 140)) { S.bolts.push({ pts: [[g.x, g.y - 2], [p.x, p.y - 8]], t: 0.2 }); n += D.takeGround(S, g, true) ? 1 : 0; }
        for (const d of S.drops) if (d.f === S.f && Math.hypot(d.x - p.x, d.y - p.y) < (m3 ? 220 : 140)) { d.x = p.x; d.y = p.y; d.t = 1; }
        ring(S, p.x, p.y - 4, 70, P.y); sfx(n ? 'power' : 'nope'); if (!n) text(S, p.x, p.y - 26, 'NOTHING', P[4]);
        break;
      }
      case 'repair': p.healOT = m3 ? 6 : 4; ring(S, p.x, p.y - 4, 22, P.g); sfx('heal'); break;
      case 'hack': {
        let n = 0;
        for (const e of S.enemies) if (!e.dead && e.f === S.f && !D.ENEMIES[e.kind].human && Math.hypot(e.x - p.x, e.y - p.y) < (m3 ? 180 : 130)) { e.stun = Math.max(e.stun, (e.kind === 'turret' ? 6 : D.ENEMIES[e.kind].boss ? 1.2 : 3.5) + (m3 ? 1.5 : 0)); S.bolts.push({ pts: zig(S, p.x, p.y - 10, e.x, e.y - 6), t: 0.25 }); n++; }
        ring(S, p.x, p.y - 6, 70, P.m); flashLight(S, p.x, p.y, 130, P.m, 1.2); sfx(n ? 'zap' : 'nope');
        break;
      }
      default: if (K.useSkillX) K.useSkillX(S, k, m3); // M5 的新型号（arms.js）
    }
  }

  function damagePlayer(S, dmg, src) {
    const p = S.player;
    if (S.over || D.offstage(S)) return; // 离站了 / 还在车上没下来
    S.attackedAt = S.t; // 有人在打你（搜刮页外框标红用）
    if (p.inv > 0) { perfectDodge(S); return; }
    let left = Math.round(dmg * (1 + (D.threatLv(S.raid) - 1) * 0.04 + S.st.tier * 0.03) * (D.DIFF[S.raid.diff || 0] || D.DIFF[0]).dmg * (S.SH.trait.k === 'armor' ? 0.85 : 1) * D.fxOf(S.raid).hurt); p.lastHurt = S.t;
    if (p.shield > 0) { const a = Math.min(p.shield, left); p.shield -= a; left -= a; for (let i = 0; i < 8; i++) part(S, 'spark', p.x, p.y - 6, S.rng.range(-80, 80), S.rng.range(-80, 40), 0.25, P.c); }
    if (K.armorHit) left = K.armorHit(S, left, src); // 护甲：护盾之后、机身之前（armor.js）
    // 单次伤害封顶：普通敌人最多打掉耐久上限的 30%，精英和首领 45%（不会一下被秒）
    { const E = src && D.ENEMIES[src.kind], big = E && (E.elite || E.boss); left = Math.min(left, Math.round(p.maxHp * (big ? 0.45 : 0.3))); }
    // 用药读条中挨打：打断，药退回背包
    if (left > 0 && p.useT > 0 && p.useK && D.USE[p.useK].heal) { D.Grid.add(S.raid.bag, 'use:' + p.useK, 1); p.useT = 0; p.useK = null; text(S, p.x, p.y - 30, '打断', P.r); }
    if (S.tut) left = Math.ceil(left * 0.5); // 训练场：伤害减半，耐久最低留 1
    p.hp -= left; if (S.tut) p.hp = Math.max(1, p.hp); S.raid.taken += Math.max(0, left); const hk = src && src.kind ? src.kind : src && src.k ? src.k : 'aoe'; (S.raid.hits = S.raid.hits || {})[hk] = (S.raid.hits[hk] || 0) + Math.max(0, left); p.flash = 0.12; p.hurtT = 0.35; p.inv = 0.4;
    if (src && src.x != null) { const a = Math.atan2(p.y - src.y, p.x - src.x); p.vx += Math.cos(a) * 110; p.vy += Math.sin(a) * 110; (S.hurtDirs = S.hurtDirs || []).push({ a: a + Math.PI, t: 0.9 }); }
    text(S, p.x, p.y - 20, left > 0 ? '-' + left : '0', left > 0 ? P.r : P.c, left >= 10);
    if (left > 0) { addShake(S, 0.5); S.stop = Math.max(S.stop, 0.06); for (let i = 0; i < 10; i++) part(S, 'spark', p.x, p.y - 6, S.rng.range(-90, 90), S.rng.range(-90, 30), 0.3, P.r); }
    sfx('hurt');
  }

  function scarf(S, p) {
    const s = p.scarf, flip = Math.cos(p.aim) < 0 ? -1 : 1;
    s[0].x = p.x - flip * 1.5; s[0].y = p.y - 17; // 新身形更高，围巾挂在脖子上
    for (let i = 1; i < s.length; i++) { const q = s[i], vx = (q.x - q.px) * 0.86, vy = (q.y - q.py) * 0.86; q.px = q.x; q.py = q.y; q.x += vx + Math.sin(S.t * 6 + i) * 0.08; q.y += vy + 0.18; const a = s[i - 1], dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy) || 1; q.x = a.x + dx / d * 2.2; q.y = a.y + dy / d * 2.2; }
  }
  Object.assign(K, { meleeDeflect: deflect, throwNade, perfectDodge, finishUse, startReload, fire, melee, useMod, useSkill, damagePlayer, scarf });
})(D);
