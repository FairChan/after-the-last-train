/* 末班之后 · 小样二：M5 武器和装备的规则。数据和图在 content.js。
   只通过挂钩接进别的文件：player.js（开火、近战、模块）、fx.js（子弹、手雷）、enemy.js（受伤、击毁）、station.js（每帧前后）、loot.js（掉落）、draw.js（画炮台、僚机、烟） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const K = D.K || (D.K = {});
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), hurt = (...a) => K.hurt(...a);
  const flashLight = (...a) => K.flashLight(...a), explode = (...a) => K.explode(...a), zig = (...a) => K.zig(...a), addShake = (...a) => K.addShake(...a);
  const isMachine = e => !D.ENEMIES[e.kind].human, isBoss = e => !!D.ENEMIES[e.kind].boss;
  const alive = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.dormant);
  const nearest = (S, x, y, maxD, pred) => { let best = null, bd = maxD; for (const e of alive(S)) { if (pred && !pred(e)) continue; const d = Math.hypot(e.x - x, e.y - 6 - y); if (d < bd) { bd = d; best = e; } } return best; };
  const pas = S => (S.raid && S.raid.pas) || {};

  // ── 型号（6 → 8）：鹰眼（狙击）、蜂巢（无人机母舰）。外形在 heroes.js 的 scope / pods 部件
  Object.assign(D.SHELLS, {
    marksman: { name: '鹰眼', code: 'MK-4', role: '狙击', q: 3, price: 1800, hp: 48, speed: 92, tint: '#606a76', scale: 0.98, visor: '#ff4d4d',
      tag: '远程侦察机，头上一只长镜筒目镜。离得越远越准。', trait: { k: 'farshot', name: '长瞄', desc: '开镜快一倍；离敌人 150 像素以上时枪伤害 +20%' },
      skill: { k: 'mark', name: '标记', cd: 14, desc: '准星方向扇面里的敌人被标记 8 秒，受到的伤害 +50%' } },
    carrier: { name: '蜂巢', code: 'CR-8', role: '无人机', q: 4, price: 2600, hp: 58, speed: 90, tint: '#38905c', scale: 1, visor: '#ffd040',
      tag: '无人机母舰。肩上趴着两架小无人机，随时放出去。', trait: { k: 'drone', name: '随身僚机', desc: '自带一架小无人机，一直跟着你打准星附近的敌人' },
      skill: { k: 'swarm', name: '蜂群', cd: 16, desc: '放出 4 架自爆小无人机，自己找最近的敌人撞，各 14 伤害' } },
  });
  Object.assign(D.HERO_DEFS, {
    marksman: { ramp: ['#121418', '#1e2228', '#2e343c', '#444c56', '#606a76', '#8a96a2', '#c4ccd6'], visor: ['#e02a2a', '#ff4d4d', '#ffd0d0'], parts: ['scope'] },
    carrier: { ramp: ['#081a12', '#10301f', '#1a4a30', '#266a44', '#38905c', '#64b880', '#b0e8c0'], visor: ['#ffb000', '#ffd040', '#fff0b0'], parts: ['pods'] },
  });
  D.SHELLS.marksman.key = 'marksman'; D.SHELLS.carrier.key = 'carrier'; // heroes.js 加载时只给当时已有的型号写了 key；没有 key 城里会画成默认的无人机
  K.useSkillX = function (S, k, m3) {
    const p = S.player;
    if (k === 'mark') {
      let n = 0; for (const e of alive(S)) { const d = Math.hypot(e.x - p.x, e.y - p.y), a = Math.atan2(e.y - p.y, e.x - p.x); if (d < 280 && Math.abs(D.angDiff(p.aim, a)) < 0.6) { e.markT = m3 ? 12 : 8; n++; } }
      for (const s of [-0.6, 0.6]) S.beams.push({ x0: p.x, y0: p.y - 6, x1: p.x + Math.cos(p.aim + s) * 120, y1: p.y - 6 + Math.sin(p.aim + s) * 120, t: 0.3, max: 0.3, col: P.r });
      text(S, p.x, p.y - 28, n ? 'MARK ×' + n : 'NONE', n ? P.r : P[4]); sfx(n ? 'snipe' : 'nope');
    }
    if (k === 'swarm') {
      for (let i = 0; i < (m3 ? 6 : 4); i++) { const b = p.aim + (i - 1.5) * 0.5; (S.allies = S.allies || []).push({ k: 'kami', f: S.f, x: p.x, y: p.y - 12, vx: Math.cos(b) * 120, vy: Math.sin(b) * 120, t: 6, a: b }); }
      ring(S, p.x, p.y - 8, 18, P.y); sfx('summon');
    }
  };
  // 自爆小无人机：追最近的敌人，撞上就炸
  function kamiStep(S, a, dt) {
    a.t -= dt; const tgt = nearest(S, a.x, a.y, 260);
    if (tgt) { const ang = Math.atan2(tgt.y - 6 - a.y, tgt.x - a.x); a.vx += Math.cos(ang) * 700 * dt; a.vy += Math.sin(ang) * 700 * dt; }
    const v = Math.hypot(a.vx, a.vy); if (v > 170) { a.vx *= 170 / v; a.vy *= 170 / v; }
    a.x += a.vx * dt; a.y += a.vy * dt; a.a = Math.atan2(a.vy, a.vx);
    if (S.rng.chance(0.4)) part(S, 'spark', a.x, a.y, -a.vx * 0.1, -a.vy * 0.1, 0.2, P.y);
    if (tgt && Math.hypot(tgt.x - a.x, tgt.y - 6 - a.y) < tgt.r + 4) { explode(S, a.x, a.y + 6, 16, 14, false); a.t = 0; }
    else if (a.t <= 0 || D.solidAt(S.A, a.x, a.y + 6)) { explode(S, a.x, a.y + 6, 12, 8, false); a.t = 0; }
  }

  // ── 被动改枪：扩容弹仓、稳定器（growth.js 的 gunOf 之上再套一层）
  const g0 = D.gunOf, pcache = new WeakMap();
  D.gunOf = function (pf, id, R) {
    const g = g0(pf, id, R), pa = R && R.pas; if (!g || !pa || !(pa.bigmag || pa.steady)) return g;
    const key = (pa.bigmag ? 'm' : '') + (pa.steady ? 's' : ''); let m = pcache.get(g); if (!m) pcache.set(g, m = {});
    return m[key] || (m[key] = Object.assign({}, g, { mag: pa.bigmag ? Math.round(g.mag * 1.3) : g.mag, spread: g.spread * (pa.steady ? 0.75 : 1) }));
  };

  // ── 开火之前：连发排队、转管射速、左轮最后一发。返回伤害倍数
  K.preShot = function (S, g, cont) {
    const p = S.player; let mul = 1;
    if (g.burst) {
      if (!cont) { p.burstId = (p.burstId || 0) + 1; p.burstIdx = 0; p.burstQ = g.burst - 1; }
      else { p.burstIdx++; p.burstQ--; }
      p.burstT = g.gap;
    }
    if (g.spin) { const k = D.clamp(((p.spin || 0) - g.spin) / 1.2, 0, 1); p.fireCd = g.rate * (1 - 0.65 * k); }
    if (g.lastx2 && p.mag === 0) { mul = 2; text(S, p.x, p.y - 28, 'LAST', P.Y); }
    return mul;
  };
  // 榴弹：抛到准星处（最远 170），落地就炸
  K.lob = function (S, g, dmg) {
    const p = S.player, I = D.Input, a = p.aim, want = Math.min(170, Math.hypot(I.wx - p.x, I.wy - p.y));
    let d = 0; while (d + 4 <= want && !D.solidAt(S.A, p.x + Math.cos(a) * (d + 4), p.y + Math.sin(a) * (d + 4))) d += 4;
    S.nades.push({ x: p.x, y: p.y - 10, sx: p.x, sy: p.y - 10, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d, t: 0, fly: 0.18 + d / 480, fuse: 0.02, dmg, boom: g.boom, own: true, kind: 'gl' });
  };
  // 子弹拐弯：转向前方最近的敌人
  K.steer = function (S, s, dt) {
    const v = Math.hypot(s.vx, s.vy) || 1, a = Math.atan2(s.vy, s.vx);
    const e = nearest(S, s.x, s.y, 120, o => Math.abs(D.angDiff(a, Math.atan2(o.y - 6 - s.y, o.x - s.x))) < 1.4 && !s.hit.has(o)); if (!e) return;
    const want = Math.atan2(e.y - 6 - s.y, e.x - s.x), na = a + D.clamp(D.angDiff(a, want), -s.homing * dt, s.homing * dt);
    s.vx = Math.cos(na) * v; s.vy = Math.sin(na) * v;
  };
  // 子弹打墙反弹：退回一步，看是横着撞还是竖着撞
  K.bounce = function (S, s, dt) {
    s.x -= s.vx * dt; s.y -= s.vy * dt;
    const hx = D.solidAt(S.A, s.x + s.vx * dt, s.y + 6), hy = D.solidAt(S.A, s.x, s.y + s.vy * dt + 6);
    if (hx) s.vx = -s.vx; if (hy) s.vy = -s.vy; if (!hx && !hy) { s.vx = -s.vx; s.vy = -s.vy; }
    s.bounce--; s.hit.clear(); s.life = Math.max(s.life, 0.4);
    for (let i = 0; i < 4; i++) part(S, 'spark', s.x, s.y, S.rng.range(-50, 50), S.rng.range(-50, 50), 0.2, P.Y);
    if (S.rng.chance(0.5)) sfx('tink');
    return true;
  };
  // 子弹打中敌人：伤害倍数（弱点识别、过载回路、电磁打护盾、三连发第三发、鹰眼标记）
  K.shotMul = function (S, s, e) {
    const pa = pas(S), p = S.player; let m = 1;
    if (pa.deadeye && !e.aware) m *= 1.5;
    if (pa.berserk && p.hp < p.maxHp * 0.3) m *= 1.3;
    if (s.emp && e.shield > 0) m *= 2;
    if (s.emp && e.wet) m *= 1.5; // 水淹站
    if (s.bid) { const h = e.burstHits || (e.burstHits = {}); h[s.bid] = (h[s.bid] || 0) + 1; if (s.bi === 2 && h[s.bid] === 3) { m *= 2; text(S, e.x, e.y - 30, 'TRIPLE', P.Y, true); } }
    if (S.SH && S.SH.trait.k === 'farshot' && Math.hypot(e.x - p.x, e.y - p.y) > 150) m *= 1.2;
    return m;
  };
  // 打中以后：着火、钩爪、电磁停摆
  K.shotHit = function (S, s, e) {
    const p = S.player;
    if (s.burn) { e.burnT = Math.max(e.burnT || 0, s.burn); }
    if (s.emp && isMachine(e) && !e.dead) { e.stun = Math.max(e.stun || 0, isBoss(e) ? 0.1 : s.emp); for (let i = 0; i < 3; i++) part(S, 'spark', e.x, e.y - 8, S.rng.range(-40, 40), S.rng.range(-40, 10), 0.25, '#ffd84a'); }
    if (s.pull && !e.dead) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      if (isBoss(e) || e.kind === 'turret') { p.vx = -Math.cos(a) * 300; p.vy = -Math.sin(a) * 300; p.pullT = 0.3; text(S, p.x, p.y - 28, 'HOOK', P[5]); }
      else { const d = Math.max(0, Math.hypot(p.x - e.x, p.y - e.y) - 18); e.vx += Math.cos(a) * Math.min(420, d * 6); e.vy += Math.sin(a) * Math.min(420, d * 6); e.stun = Math.max(e.stun || 0, 0.35); }
      S.beams.push({ x0: p.x, y0: p.y - 8, x1: e.x, y1: e.y - 6, t: 0.25, max: 0.25, col: P[5] }); sfx('charge2');
    }
  };

  // ── 近战：高频刀连击、过载回路；打完：吸能刃
  K.meleeMul = function (S, m) {
    const p = S.player, pa = pas(S); let k = 1;
    // 连击：只数打中的刀（挥空那下清零），这里先看"这刀打中的话是不是第 N 刀"，打完在 meleeAfter 里记数
    if (m.combo) { if (S.t - (p.comboT || -9) > 0.9) p.combo = 0; p.comboHit = ((p.combo || 0) + 1) % m.combo === 0; if (p.comboHit) k *= 2; }
    if (pa.berserk && p.hp < p.maxHp * 0.3) k *= 1.3;
    return k;
  };
  K.meleeAfter = function (S, m, hits) {
    const p = S.player;
    if (m.combo) { if (hits) { p.combo = (p.combo || 0) + 1; p.comboT = S.t; if (p.comboHit) text(S, p.x, p.y - 30, 'COMBO', P.R); } else p.combo = 0; p.comboHit = false; }
    if (hits && pas(S).leech && p.hp > 0) { p.hp = Math.min(p.maxHp, p.hp + hits); text(S, p.x, p.y - 24, '+' + hits, P.g); }
  };

  // ── 模块（新的 8 个）
  K.useModX = function (S, id) {
    const p = S.player, a = p.aim, I = D.Input;
    switch (id) {
      case 'nano': p.nanoT = 3; ring(S, p.x, p.y - 5, 16, P.g); sfx('heal'); break;
      case 'blink': {
        let d = 0; const ok = (x, y) => !D.solidAt(S.A, x, y) && !D.solidAt(S.A, x - 4, y) && !D.solidAt(S.A, x + 4, y) && !D.solidAt(S.A, x, y - 3);
        while (d + 3 <= 70 && ok(p.x + Math.cos(a) * (d + 3), p.y + Math.sin(a) * (d + 3))) d += 3;
        for (let i = 0; i < 10; i++) part(S, 'spark', p.x, p.y - 6, S.rng.range(-60, 60), S.rng.range(-60, 20), 0.3, P.c);
        S.beams.push({ x0: p.x, y0: p.y - 6, x1: p.x + Math.cos(a) * d, y1: p.y - 6 + Math.sin(a) * d, t: 0.15, max: 0.15, col: P.c });
        p.x += Math.cos(a) * d; p.y += Math.sin(a) * d; p.inv = Math.max(p.inv, 0.25); p.vx = p.vy = 0;
        ring(S, p.x, p.y - 5, 14, P.c); flashLight(S, p.x, p.y, 60, P.c, 1); sfx('dash'); break;
      }
      case 'fog': { const d = Math.min(150, Math.hypot(I.wx - p.x, I.wy - p.y)); smokeAt(S, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); break; }
      case 'grapple': {
        const ox = p.x, oy = p.y - 6; let d = 0, hitE = null;
        while (d < 170 && !D.solidAt(S.A, ox + Math.cos(a) * (d + 4), oy + 6 + Math.sin(a) * (d + 4))) { d += 4; hitE = nearest(S, ox + Math.cos(a) * d, oy + Math.sin(a) * d, 8); if (hitE) break; }
        const go = Math.max(0, d - 12);
        S.beams.push({ x0: ox, y0: oy, x1: ox + Math.cos(a) * d, y1: oy + Math.sin(a) * d, t: 0.3, max: 0.3, col: P.y });
        if (go > 10) { p.dashT = go / 460; p.dx = Math.cos(a) * 460; p.dy = Math.sin(a) * 460; p.inv = Math.max(p.inv, 0.12); p.lungeHit = null; }
        if (hitE) hitE.stun = Math.max(hitE.stun || 0, 0.4);
        sfx('charge2'); break;
      }
      case 'sentry': (S.allies = S.allies || []).push({ k: 'sentry', f: S.f, x: p.x + Math.cos(a) * 10, y: p.y + Math.sin(a) * 6, t: 10, cd: 0.6, a }); sfx('power'); break;
      case 'wing': (S.allies = S.allies || []).push({ k: 'wing', f: S.f, x: p.x, y: p.y - 14, t: 12, cd: 0.4, ang: 0, a: 0 }); sfx('power'); break;
      case 'holo': S.decoy = { x: p.x, y: p.y, r: 4, t: 5, holo: true, vx: Math.cos(a) * 34, vy: Math.sin(a) * 34 }; ring(S, p.x, p.y - 6, 16, P.m); sfx('shield'); break;
      case 'empmod': {
        let n = 0;
        for (const e of alive(S)) if (isMachine(e) && Math.hypot(e.x - p.x, e.y - p.y) < 80 + e.r) { e.stun = Math.max(e.stun || 0, isBoss(e) ? 0.6 : 2); e.shield = 0; e.act = null; e.tele = 0; S.bolts.push({ pts: zig(S, p.x, p.y - 8, e.x, e.y - 6), t: 0.2 }); n++; }
        ring(S, p.x, p.y - 4, 80, '#ffd84a'); ring(S, p.x, p.y - 4, 50, '#ffd84a'); flashLight(S, p.x, p.y, 160, '#ffd84a', 1.2); addShake(S, 0.25); sfx(n ? 'zap' : 'nope'); break;
      }
    }
  };

  // ── 手雷：榴弹、烟雾弹、闪光弹（frag / freeze / emp 还在 fx.js）
  K.nadeBoomX = function (S, n) {
    const p = S.player;
    if (n.kind === 'gl') { explode(S, n.x, n.y, n.boom || 30, n.dmg, false); if (Math.hypot(p.x - n.x, p.y - n.y) < (n.boom || 30) * 0.7 + p.r) K.damagePlayer(S, Math.round(n.dmg * 0.5), { x: n.x, y: n.y }); K.alertAround(S, n.x, n.y, 200); return true; }
    if (n.kind === 'smoke') { smokeAt(S, n.x, n.y); return true; }
    if (n.kind === 'flash') {
      for (const e of alive(S)) if (Math.hypot(e.x - n.x, e.y - n.y) < 60 + e.r) { e.stun = Math.max(e.stun || 0, isBoss(e) ? 0.4 : 1.5); e.act = null; e.tele = 0; e.aware = true; }
      ring(S, n.x, n.y, 60, '#fff3b0'); flashLight(S, n.x, n.y, 220, '#ffffff', 2); S.whiteT = 0.12; addShake(S, 0.3); sfx('crit'); return true;
    }
    return false;
  };
  function smokeAt(S, x, y) { (S.smokes = S.smokes || []).push({ x, y, f: S.f, r: 36, t: 6, max: 6 }); for (let i = 0; i < 16; i++) part(S, 'smoke', x + S.rng.range(-20, 20), y + S.rng.range(-10, 10), S.rng.range(-20, 20), S.rng.range(-20, -4), 1.2, '#7c8299'); sfx('cool'); }
  D.inSmoke = (S, x, y) => !!(S.smokes && S.smokes.some(s => s.f === S.f && Math.hypot(x - s.x, (y - s.y) * 1.4) < s.r * Math.min(1, s.t / 0.8)));

  // ── 击毁：连锁电容
  K.onKillX = function (S, e) {
    if (!pas(S).chaincap || !isMachine(e) || !S.rng.chance(0.35)) return;
    const o = nearest(S, e.x, e.y - 6, 100, x => x !== e); if (!o) return;
    S.bolts.push({ pts: zig(S, e.x, e.y - 6, o.x, o.y - 6), t: 0.2 }); hurt(S, o, 10, { kx: o.x - e.x, ky: o.y - e.y, kb: 30, col: P.c, melee: true, elec: true }); sfx('zap');
  };

  // ── 每帧，开火之前：转管、连发、移速、纳米修复、护盾发生器、分身
  K.armsPre = function (S, dt, inp, gun) {
    const p = S.player, pa = pas(S);
    if (gun && gun.spin) {
      const want = !!inp.fire && p.reload <= 0 && p.dashT <= 0 && !S.lootOpen && p.mag > 0, was = p.spin || 0;
      p.spin = want ? Math.min(gun.spin + 1.4, was + dt) : Math.max(0, was - dt * 2);
      if (want && was === 0) sfx('charge');
      if (want && p.spin < gun.spin) { p.fireCd = Math.max(p.fireCd, 0.06); if (S.t % 0.08 < dt) part(S, 'smoke', p.x + Math.cos(p.aim) * 12, p.y - 10, S.rng.range(-10, 10), -20, 0.3, '#8a90a8'); }
    } else p.spin = 0;
    if (p.burstQ > 0) { p.burstT -= dt; if (p.burstT <= 0) { if (gun && gun.burst && p.mag > 0 && p.reload <= 0) K.fire(S, gun, true); else p.burstQ = 0; } }
    if (S.SH && S.SH.trait.k === 'drone' && !(S.allies || []).some(a => a.perm)) { (S.allies = S.allies || []).push({ k: 'wing', f: S.f, x: p.x, y: p.y - 14, t: 1e9, cd: 0.5, ang: 0, a: 0, perm: true }); } // 蜂巢：随身僚机
    p.spdMul = (pa.servo ? 1.1 : 1) * (p.spin > 0.2 ? 0.65 : 1) * (S.wetT > 0 ? 0.7 : 1);
    if (p.nanoT > 0) { p.nanoT -= dt; p.hp = Math.min(p.maxHp, p.hp + 5 * dt); if (S.t % 0.15 < dt) part(S, 'spark', p.x + S.rng.range(-6, 6), p.y - 4, 0, -40, 0.5, P.g); }
    if (pa.shieldgen) {
      if (!S.sgDone) { S.sgDone = true; p.shield += 12; p.shieldT = 0; }
      const pf = S.raid.perfect || 0; if (pf > (S.sgPerfect || 0)) { p.shield += 6 * (pf - (S.sgPerfect || 0)); p.shieldT = 0; ring(S, p.x, p.y - 5, 16, P.c); } S.sgPerfect = pf;
    }
    const dc = S.decoy;
    if (dc && dc.holo) { D.move(S.A, dc, dc.vx * dt, dc.vy * dt); dc.walk = (dc.walk || 0) + dt * 8; if (dc.t - dt <= 0) { explode(S, dc.x, dc.y, 30, 14, false); S.decoy = null; } }
    if (S.whiteT > 0) S.whiteT -= dt;
  };

  // ── 每帧，子弹走完以后：火焰、着火、炮台、僚机、烟
  K.armsPost = function (S, dt) {
    const p = S.player;
    for (const s of S.shots) if (s.flame && S.rng.chance(0.7)) part(S, 'spark', s.x, s.y, s.vx * 0.2 + S.rng.range(-20, 20), s.vy * 0.2 + S.rng.range(-30, 0), 0.22, S.rng.pick(['#ff8a2e', '#ffd84a', '#ff3d2e']));
    for (const e of S.enemies) {
      if (e.dead || !(e.burnT > 0)) continue;
      e.burnT -= dt; e.burnTick = (e.burnTick || 0) - dt;
      if (e.f === S.f && S.rng.chance(0.5)) part(S, 'spark', e.x + S.rng.range(-e.r, e.r), e.y - 4 - S.rng.range(0, 8), S.rng.range(-10, 10), S.rng.range(-50, -20), 0.35, S.rng.pick(['#ff8a2e', '#ffd84a']));
      if (e.burnTick <= 0) { e.burnTick = 0.25; hurt(S, e, 1, { dot: true, col: '#ff8a2e' }); }
    }
    if (S.allies && S.allies.length) {
      for (const a of S.allies) {
        if (a.f !== S.f) { if (a.perm) a.f = S.f; else { a.t = 0; continue; } }
        if (a.k === 'kami') { kamiStep(S, a, dt); continue; }
        a.t -= dt; a.cd -= dt;
        let tgt;
        if (a.k === 'wing') { a.ang += dt * 3; a.x = p.x + Math.cos(a.ang) * 16; a.y = p.y - 12 + Math.sin(a.ang) * 8; const I = D.Input; tgt = nearest(S, I.wx, I.wy, 60) || nearest(S, a.x, a.y, 150); }
        else tgt = nearest(S, a.x, a.y - 8, 160, e => D.losClear(S.A, a.x, a.y - 8, e.x, e.y - 6));
        if (tgt) a.a = Math.atan2(tgt.y - 6 - (a.y - 8), tgt.x - a.x);
        if (tgt && a.cd <= 0) {
          a.cd = a.k === 'wing' ? (a.perm ? 0.5 : 0.32) : 0.28; const sp = 380, ox = a.x + Math.cos(a.a) * 6, oy = a.y - 8 + Math.sin(a.a) * 6;
          S.shots.push({ x: ox, y: oy, vx: Math.cos(a.a) * sp, vy: Math.sin(a.a) * sp, life: 0.6, dmg: a.perm ? 3 : 4, r: 2, hit: new Set(), col: P.c });
          K.muzzle(S, ox, oy, a.a, P.c, 0.6); if (S.rng.chance(0.5)) sfx('eshot');
        }
        if (a.t <= 0) for (let i = 0; i < 8; i++) part(S, 'spark', a.x, a.y - 6, S.rng.range(-50, 50), S.rng.range(-60, 10), 0.3, P.c);
      }
      S.allies = S.allies.filter(a => a.t > 0);
    }
    if (S.smokes && S.smokes.length) {
      for (const s of S.smokes) { s.t -= dt; if (s.f === S.f && S.rng.chance(0.3)) part(S, 'smoke', s.x + S.rng.range(-s.r, s.r), s.y + S.rng.range(-s.r * 0.5, s.r * 0.5), S.rng.range(-8, 8), S.rng.range(-12, -2), 1, '#7c8299'); }
      S.smokes = S.smokes.filter(s => s.t > 0);
    }
    for (const e of S.enemies) if (!e.dead && e.f === S.f) { e.blind = D.inSmoke(S, e.x, e.y - 4) || D.inSmoke(S, p.x, p.y - 4); if (e.markT > 0) e.markT -= dt; }
  };

  // ── 画：炮台、僚机（按脚底排序的那张表里）；烟、闪光（盖在最上面）
  D.drawExtras = function (S, list, ctx, ex) {
    for (const e of S.enemies) if (!e.dead && e.f === S.f && e.markT > 0) list.push({ y: e.y + 0.5, f: () => { const x = Math.round(e.x), y = Math.round(e.y - 22 - e.r - (e.z || 0)); ex.fillStyle = (S.t * 6 | 0) % 2 ? P.r : P.R; ex.fillRect(x - 1, y - 2, 2, 1); ex.fillRect(x - 2, y - 1, 4, 2); ex.fillRect(x - 1, y + 1, 2, 1); } }); // 鹰眼标记
    for (const a of S.allies || []) if (a.f === S.f) list.push({ y: a.y, f: () => {
      const x = Math.round(a.x), y = Math.round(a.y), blink = a.t < 2 && Math.sin(S.t * 30) > 0;
      if (a.k === 'kami') { ctx.fillStyle = P.k; ctx.fillRect(x - 3, y - 2, 6, 5); ctx.fillStyle = P[3]; ctx.fillRect(x - 2, y - 1, 4, 3); ex.fillStyle = (S.t * 20 | 0) % 2 ? P.r : P.y; ex.fillRect(x - 1, y, 2, 1); return; }
      if (a.k === 'sentry') {
        ctx.fillStyle = P.k; ctx.fillRect(x - 5, y - 8, 10, 8); ctx.fillStyle = P[3]; ctx.fillRect(x - 4, y - 7, 8, 6); ctx.fillStyle = P[4]; ctx.fillRect(x - 4, y - 7, 8, 2);
        ctx.strokeStyle = P[5]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + Math.cos(a.a) * 7, y - 6 + Math.sin(a.a) * 7); ctx.stroke();
        ex.fillStyle = blink ? P.r : P.c; ex.fillRect(x - 1, y - 5, 2, 2);
      } else {
        ctx.fillStyle = P.k; ctx.fillRect(x - 4, y - 3, 8, 5); ctx.fillStyle = P[4]; ctx.fillRect(x - 3, y - 2, 6, 3);
        ex.fillStyle = blink ? P.r : P.c; ex.fillRect(x - 1, y - 1, 2, 1); ex.fillStyle = D.rgba(P.C, 0.5 + 0.5 * Math.sin(S.t * 40)); ex.fillRect(x - 6, y - 4, 3, 1); ex.fillRect(x + 3, y - 4, 3, 1);
      }
    } });
  };
  D.drawOver = function (S, ctx, ex) {
    for (const s of S.smokes || []) {
      if (s.f !== S.f) continue;
      const k = Math.min(1, s.t / 0.8) * Math.min(1, (s.max - s.t) / 0.3 + 0.2);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU + s.t * 0.3, r = s.r * (0.45 + 0.15 * Math.sin(s.t * 2 + i)), cx = Math.round(s.x + Math.cos(a) * s.r * 0.45), cy = Math.round(s.y + Math.sin(a) * s.r * 0.3);
        ctx.fillStyle = D.rgba(i % 2 ? '#6b7290' : '#8a90a8', 0.55 * k); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      }
    }
    if (S.whiteT > 0) { ctx.fillStyle = D.rgba('#ffffff', Math.min(0.6, S.whiteT * 5)); ctx.fillRect(S.cam.x - 10, S.cam.y - 10, D.W, D.H); }
  };
})(D);
