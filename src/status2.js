/* Underdog · 第二批武器的 6 个新状态（design/features/arsenal-2/design.md）：骇入、磁化、共振、浮空、连接、破碎；
   另外两个计时版的老状态：致盲（e.blindT，叠在烟雾的 e.blind 上）、浸湿（e.wetT，叠在积水的 e.wet 上）。
   用法：K.addHack / K.addMag / K.addRes / K.addAir / K.addLink / K.addShatter / K.addBlind / K.addWet（都是 (S, e, …)）。
   接法同 status.js：包住 K.hurt、K.armsPre、K.armsPost、K.meleeDraw。在 arsenal-melee.js 之后、arsenal2-guns.js 之前加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, K = D.K || (D.K = {}), TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a);
  const isBoss = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss);
  const isElite = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].elite);
  const isHuman = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].human);
  const live = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.dormant);
  const C = D.ST2_COL = { hack: '#3ee8ff', mag: '#ff3d8b', res: '#c4b0ff', air: '#ffd84a', link: '#e3c14a', shat: '#e6fbff', blind: '#fff2c8', wet: '#5fb8ff' };

  // ── 给状态
  // 骇入：只对机器；首领、人类骇不动；一次最多 2 台。12 秒后过载自爆（伤到旁边的敌人）
  K.canHack = e => !e.dead && !isBoss(e) && !isHuman(e);
  K.addHack = function (S, e, t) {
    if (!K.canHack(e) || e.hacked) return false;
    const on = S.enemies.filter(o => o.hacked && !o.dead);
    if (on.length >= 2) { on.sort((a, b) => a.hacked.t - b.hacked.t); hackEnd(S, on[0]); }
    e.hacked = { t: t || 12, max: t || 12, cd: 0.4, hurtCd: 0 }; e.act = null; e.tele = 0; e.aware = true; e.shield = 0;
    text(S, e.x, e.y - 30, 'HACKED', C.hack, true); ring(S, e.x, e.y - 6, e.r + 8, C.hack); sfx('power');
    return true;
  };
  function hackEnd(S, e) {
    const x = e.x, y = e.y; e.hacked = null;
    for (const o of live(S)) if (o !== e && Math.hypot(o.x - x, o.y - y) < 36 + o.r) K.hurt(S, o, 24, { kx: o.x - x, ky: o.y - y, kb: 140, col: C.hack, hackAtk: true });
    K.hurt(S, e, e.hp + (e.shield || 0) + 1, { col: C.hack, crit: true, hackAtk: true });
    ring(S, x, y - 6, 38, C.hack); K.flashLight(S, x, y - 6, 80, C.hack, 1.3); K.addShake(S, 0.3); sfx('boom');
  }
  K.addMag = function (S, e, t) { if (e.dead) return; if (!(e.magT > 0)) text(S, e.x, e.y - 28, 'MAGNET', C.mag); e.magT = Math.max(e.magT || 0, t || 4); };
  K.addRes = function (S, e, n) { if (e.dead) return; e.res = Math.min(10, (e.res || 0) + (n || 1)); e.resT = 6; };
  K.addAir = function (S, e, t) {
    if (e.dead || isBoss(e) || e.kind === 'turret') return false;
    e.airT = Math.max(e.airT || 0, t || 0.8); e.airMax = e.airT; e.stun = Math.max(e.stun || 0, e.airT); e.act = null; e.tele = 0;
    text(S, e.x, e.y - 30, 'LAUNCH', C.air, true); return true;
  };
  K.addLink = function (S, a, b, t) {
    if (!a || !b || a === b || a.dead || b.dead) return;
    S.links2 = (S.links2 || []).filter(L => L.a !== a && L.b !== a && L.a !== b && L.b !== b);
    S.links2.push({ a, b, t: t || 3 }); text(S, (a.x + b.x) / 2, Math.min(a.y, b.y) - 30, 'LINKED', C.link, true); sfx('charge2');
  };
  K.addShatter = function (S, e, k) {
    if (e.dead) return; k = isBoss(e) ? k * 0.25 : k;
    const cut = Math.max(1, Math.round(e.maxHp * k)); e.maxHp = Math.max(1, e.maxHp - cut); e.hp = Math.min(e.hp, e.maxHp); e.shat = (e.shat || 0) + k; e.shatFx = 0.3;
    for (let i = 0; i < 4; i++) part(S, 'debris', e.x, e.y - 8, S.rng.range(-70, 70), S.rng.range(-70, 10), 0.5, S.rng.pick([C.shat, '#a3b6dc']));
    return cut;
  };
  // 致盲：看不见你、丢掉目标（首领只晃一下）
  K.addBlind = function (S, e, t) {
    if (e.dead) return; if (isBoss(e)) t *= 0.3;
    if (!(e.blindT > 0)) text(S, e.x, e.y - 28, 'BLIND', C.blind);
    e.blindT = Math.max(e.blindT || 0, t); e.blind = true; e.tele = 0; e.act = null;
    if (!isBoss(e) && !e.hacked) { e.aware = false; e.notice = 0; e.invest = null; }
  };
  K.addWet = function (S, e, t) { if (e.dead) return; e.wetT = Math.max(e.wetT || 0, t || 4); e.wet = true; if (e.burnT > 0) { e.burnT = 0; part(S, 'smoke', e.x, e.y - 8, 0, -30, 0.6, '#c8cdda'); } };

  // ── 伤害：骇入的不吃你的伤害；浮空中挨近战 ×1.5；熔穿 ×1.3；照明弹照着 ×1.2；共振引爆；连接分摊
  const h0 = K.hurt;
  K.hurt = function (S, e, dmg, o) {
    if (!e || e.dead) return; o = o || {};
    if (e.hacked && !o.hackAtk) return;
    if (e.airT > 0 && o.melee) { dmg *= 1.5; if (!o.dot && !o.link) o = Object.assign({}, o, { crit: true }); }
    if (e.melt) dmg *= 1.3;
    if (e.flareT > 0) dmg *= 1.2;
    if (e.wetT > 0) { e.wet = true; if (o.ice) o = Object.assign({}, o, { ice: o.ice * 2 }); } // 湿的挨电 ×1.5（enemy.js 看 e.wet）、冻得快一倍
    h0(S, e, dmg, o);
    if (e.res > 0 && dmg >= 20 && !o.res && !o.dot) { // 共振：一次 20 以上的伤害引爆所有层
      const n = e.res, x = e.x, y = e.y; e.res = 0;
      if (!e.dead) h0(S, e, 10 * n, { col: C.res, crit: true, res: true, kb: 60 });
      for (const q of live(S)) if (q !== e && Math.hypot(q.x - x, q.y - y) < 34 + q.r) h0(S, q, 4 * n, { kx: q.x - x, ky: q.y - y, kb: 120, col: C.res, res: true });
      ring(S, x, y - 6, 20 + n * 2, C.res); ring(S, x, y - 6, 34, P.v); K.flashLight(S, x, y - 6, 60 + n * 6, C.res, 1.3); K.addShake(S, 0.2 + n * 0.03); text(S, x, y - 36, 'RESONANCE ×' + n, C.res, true); sfx('crit');
    }
    if (!o.link && !o.dot && S.links2) for (const L of S.links2) {
      const q = L.a === e ? L.b : L.b === e ? L.a : null;
      if (q && !q.dead && L.t > 0) { const k = isBoss(q) || isBoss(e) ? 0.5 : 1; h0(S, q, dmg * k, { col: C.link, link: true, kb: 0 }); S.beams.push({ x0: e.x, y0: e.y - 6, x1: q.x, y1: q.y - 6, t: 0.08, max: 0.08, col: C.link }); }
    }
  };

  // ── 每帧：先把计时状态写回（烟雾 / 积水每帧会重算 e.blind / e.wet）
  const pre0 = K.armsPre; K.armsPre = function (S, dt, inp, gun) {
    if (pre0) pre0(S, dt, inp, gun);
    for (const e of S.enemies) if (!e.dead) { if (e.blindT > 0) e.blind = true; if (e.wetT > 0) e.wet = true; if (e.hacked) e.stun = Math.max(e.stun || 0, 0.06); }
  };
  const post0 = K.armsPost; K.armsPost = function (S, dt) {
    if (post0) post0(S, dt);
    const p = S.player;
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.blindT > 0) { e.blindT -= dt; e.blind = true; }
      if (e.wetT > 0) { e.wetT -= dt; e.wet = true; if (e.f === S.f && S.rng.chance(0.15)) part(S, 'spark', e.x + S.rng.range(-e.r, e.r), e.y - 4, 0, 30, 0.3, C.wet); }
      if (e.flareT > 0) e.flareT -= dt;
      if (e.resT > 0) { e.resT -= dt; if (e.resT <= 0) e.res = 0; }
      if (e.shatFx > 0) e.shatFx -= dt;
      if (e.airT > 0) { e.airT -= dt; const k = 1 - Math.max(0, e.airT) / (e.airMax || 0.8); e.z = Math.sin(k * Math.PI) * 16; e.vx *= 0.9; e.vy *= 0.9; e.stun = Math.max(e.stun || 0, Math.min(0.1, e.airT)); if (e.airT <= 0) { e.z = 0; ring(S, e.x, e.y, 10, C.air); } }
      if (e.magT > 0) e.magT -= dt;
    }
    // 磁化：两个磁化的互相吸，撞上都吃 10 并晕住
    const mg = S.enemies.filter(e => !e.dead && e.f === S.f && e.magT > 0);
    for (let i = 0; i < mg.length; i++) for (let j = i + 1; j < mg.length; j++) {
      const a = mg[i], b = mg[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; if (d > 130) continue;
      if (d < a.r + b.r + 2) { for (const [e, s] of [[a, -1], [b, 1]]) { h0(S, e, 10, { kx: dx * s, ky: dy * s, kb: 60, col: C.mag, crit: true }); if (!e.dead) e.stun = Math.max(e.stun || 0, 0.8); e.magT = 0; } ring(S, (a.x + b.x) / 2, (a.y + b.y) / 2 - 6, 16, C.mag); text(S, (a.x + b.x) / 2, a.y - 30, 'CLANG', C.mag, true); K.addShake(S, 0.25); sfx('slam'); continue; }
      for (const [e, s] of [[a, 1], [b, -1]]) if (!isBoss(e) && e.kind !== 'turret') { e.vx += dx / d * 900 * dt * s; e.vy += dy / d * 900 * dt * s; }
    }
    // 你的子弹拐向磁化的敌人
    if (mg.length) for (const s of S.shots) { let best = null, bd = 60; for (const e of mg) { const d = Math.hypot(e.x - s.x, e.y - 6 - s.y); if (d < bd && !s.hit.has(e)) { bd = d; best = e; } } if (best) { const sp = Math.hypot(s.vx, s.vy), a = Math.atan2(s.vy, s.vx), want = Math.atan2(best.y - 6 - s.y, best.x - s.x), na = a + D.clamp(D.angDiff(a, want), -6 * dt, 6 * dt); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; } }
    // 连接：到时间断开；一个死了另一个吃自己剩余耐久的一半（首领 1/4）
    if (S.links2) {
      for (const L of S.links2) {
        L.t -= dt; const dA = L.a.dead, dB = L.b.dead;
        if (L.t > 0 && dA !== dB) { const q = dA ? L.b : L.a; h0(S, q, Math.max(1, q.hp * (isBoss(q) ? 0.25 : 0.5)), { col: C.link, crit: true, link: true }); text(S, q.x, q.y - 34, 'SNAP', C.link, true); L.t = 0; sfx('crit'); }
        if (dA && dB) L.t = 0;
      }
      S.links2 = S.links2.filter(L => L.t > 0);
    }
    // 骇入：找最近的别的敌人，贴过去打它；别的敌人也会打它；到时间自爆
    for (const e of S.enemies) {
      const H = e.hacked; if (!H || e.dead) continue;
      H.t -= dt; H.cd -= dt; H.hurtCd -= dt; e.stun = Math.max(e.stun || 0, 0.06);
      for (const s of S.shots) s.hit.add(e); // 你的子弹穿过去
      if (H.t <= 0) { hackEnd(S, e); continue; }
      let tg = null, bd = 220; for (const o of live(S)) if (o !== e && !o.hacked) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; tg = o; } }
      const sp = (D.ENEMIES[e.kind].speed || 40) * 1.1;
      if (tg) {
        const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1, want = e.kind === 'crawler' || e.kind === 'mite' || e.kind === 'bomber' ? 10 : 60;
        if (d > want && e.kind !== 'turret') { e.vx = dx / d * sp; e.vy = dy / d * sp; } else { e.vx *= 0.5; e.vy *= 0.5; }
        e.face = dx > 0 ? 1 : -1;
        if (H.cd <= 0 && d < (want > 20 ? 170 : 24) && D.losClear(S.A, e.x, e.y - 6, tg.x, tg.y - 6)) {
          H.cd = 0.8; const dm = isElite(e) ? 14 : 8;
          K.hurt(S, tg, dm, { kx: dx, ky: dy, kb: 40, col: C.hack, hackAtk: true });
          S.beams.push({ x0: e.x, y0: e.y - 8, x1: tg.x, y1: tg.y - 6, t: 0.1, max: 0.1, col: C.hack }); sfx('zap');
        }
      } else { const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; if (d > 40 && e.kind !== 'turret') { e.vx = dx / d * sp; e.vy = dy / d * sp; } } // 没敌人了跟着你
      if (H.hurtCd <= 0) { H.hurtCd = 1; if (live(S).some(o => o !== e && !o.hacked && o.aware && Math.hypot(o.x - e.x, o.y - e.y) < 90)) K.hurt(S, e, 5, { col: P.r, hackAtk: true, kb: 0 }); }
    }
  };

  // ── 画（发光层）
  const draw0 = K.meleeDraw; K.meleeDraw = function (S, ctx, ex) {
    if (draw0) draw0(S, ctx, ex);
    for (const e of S.enemies) {
      if (e.dead || e.f !== S.f) continue;
      const top = e.y - e.r * 2 - 12 - (e.z || 0);
      if (e.hacked) { const k = e.hacked.t / e.hacked.max; ctx.fillStyle = '#0b0a14'; ctx.fillRect(e.x - 4, top - 5, 8, 6); ex.fillStyle = C.hack; ex.fillRect(e.x - 3, top - 4, 6, 4); ex.fillStyle = '#0b0a14'; ex.fillRect(e.x - 1, top - 3, 2, 2); ex.fillStyle = D.rgba(C.hack, 0.8); ex.fillRect(e.x - 6, top + 2, 12 * k, 1); ex.save(); ex.globalAlpha = 0.25 + 0.15 * Math.sin(S.t * 8); ex.strokeStyle = C.hack; ex.lineWidth = 0.75; ex.beginPath(); ex.ellipse(e.x, e.y, e.r + 3, (e.r + 3) * 0.5, 0, 0, TAU); ex.stroke(); ex.restore(); }
      if (e.magT > 0) { ex.save(); ex.globalAlpha = 0.6; ex.strokeStyle = C.mag; ex.lineWidth = 0.75; ex.beginPath(); ex.arc(e.x, e.y - 6 - (e.z || 0), e.r + 3 + Math.sin(S.t * 14) , S.t * 6, S.t * 6 + 2); ex.stroke(); ex.beginPath(); ex.arc(e.x, e.y - 6 - (e.z || 0), e.r + 3, S.t * 6 + Math.PI, S.t * 6 + Math.PI + 2); ex.stroke(); ex.restore(); }
      if (e.res > 0) for (let i = 0; i < e.res; i++) { ex.fillStyle = C.res; ex.fillRect(e.x - 10 + i * 2.2, top - 2, 1.4, 1.4); }
      if (e.blindT > 0) { ex.fillStyle = D.rgba(C.blind, 0.7); ex.fillRect(e.x - 3, top + 3, 6, 1); }
      if (e.wetT > 0 && S.rng.chance(0.05)) part(S, 'spark', e.x, e.y - 10, 0, 20, 0.3, C.wet);
      if (e.flareT > 0) { ex.save(); ex.globalAlpha = 0.55; ex.strokeStyle = P.r; ex.lineWidth = 0.75; ex.strokeRect(e.x - e.r - 3, e.y - e.r * 2 - 4 - (e.z || 0), e.r * 2 + 6, e.r * 2 + 6); ex.restore(); }
      if (e.shatFx > 0) { ex.save(); ex.globalAlpha = e.shatFx / 0.3; ex.strokeStyle = C.shat; ex.lineWidth = 0.75; ex.beginPath(); ex.moveTo(e.x - 4, e.y - 12); ex.lineTo(e.x, e.y - 6); ex.lineTo(e.x - 2, e.y - 2); ex.moveTo(e.x, e.y - 6); ex.lineTo(e.x + 4, e.y - 9); ex.stroke(); ex.restore(); }
      if (e.airT > 0) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, e.r, e.r * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    for (const L of S.links2 || []) { if (L.a.f !== S.f) continue; const ax = L.a.x, ay = L.a.y - 6, bx = L.b.x, by = L.b.y - 6, mx = (ax + bx) / 2, my = (ay + by) / 2 + 6; ctx.strokeStyle = '#0b0a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke(); ex.strokeStyle = C.link; ex.lineWidth = 0.75; ex.beginPath(); ex.moveTo(ax, ay); ex.quadraticCurveTo(mx, my, bx, by); ex.stroke(); }
  };
})(D);
