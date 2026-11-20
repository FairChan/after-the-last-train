/* Underdog · 敌人身上的三个新状态：冻结（叠 5 层冻住）、中毒（叠层掉血，毒死放毒雾传染）、钉住（定住、受伤 +50%）。
   设计：design/features/arsenal/design.md。枪（arsenal-guns.js）和近战（arsenal-melee.js）都往敌人身上挂这三个状态。
   用法：K.hurt(S, e, dmg, { ice: 层数, psn: 层数, pin: 秒 })；也可以直接调 K.addIce / K.addPsn / K.addPin。
   注意 e.frz 是冰冻手雷的"减速计时"（station.js 用），这里的冻结层数叫 e.ice、冻住叫 e.frozenT。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, K = D.K || (D.K = {}), TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a);
  const isBoss = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss);
  const ICE = '#9fe9ff', PSN = '#8dff6a', PIN = '#c8cdda';

  K.addIce = function (S, e, n) {
    if (e.dead || n <= 0) return;
    if (e.frozenT > 0) { e.frozenT = Math.max(e.frozenT, 0.6); return; }
    e.ice = Math.min(5, (e.ice || 0) + n); e.iceT = 3;
    e.frz = Math.max(e.frz || 0, 0.5); // 有冰就慢一点（station.js 的冰冻减速）
    if (e.ice >= 5) {
      e.ice = 0; e.frozenT = isBoss(e) ? 0.6 : 2; e.frz = Math.max(e.frz, e.frozenT);
      text(S, e.x, e.y - 30, 'FROZEN', ICE, true); ring(S, e.x, e.y - 4, e.r + 6, ICE); sfx('cool');
      for (let i = 0; i < 10; i++) part(S, 'spark', e.x, e.y - 6, S.rng.range(-60, 60), S.rng.range(-70, 10), 0.35, ICE);
    }
  };
  K.addPsn = function (S, e, n) {
    if (e.dead || n <= 0) return;
    e.psn = Math.min(8, (e.psn || 0) + n); e.psnT = 4;
  };
  K.addPin = function (S, e, t) {
    if (e.dead || t <= 0 || e.kind === 'turret') return;
    if (isBoss(e)) t *= 0.3;
    e.pinT = Math.max(e.pinT || 0, t); e.vx = 0; e.vy = 0;
    text(S, e.x, e.y - 30, 'PINNED', PIN, true); sfx('ding');
  };

  // 伤害：钉住 ×1.5；冻住的挨近战 ×3 并碎掉（碎冰溅到旁边：8 伤害 + 1 层冰）；寄生弹记账（arsenal-guns.js）
  const h0 = K.hurt;
  K.hurt = function (S, e, dmg, o) {
    if (!e || e.dead) return; o = o || {};
    if (e.pinT > 0) dmg *= 1.5;
    let shatter = false;
    if (e.frozenT > 0 && o.melee && !o.dot && !o.shard) { dmg *= 3; shatter = true; o = Object.assign({}, o, { crit: true }); }
    if (e.para && !o.para) e.para.acc += dmg;
    h0(S, e, dmg, o);
    if (shatter) {
      e.frozenT = 0; e.frz = 0; e.stun = Math.min(e.stun || 0, 0.2);
      text(S, e.x, e.y - 34, 'SHATTER', ICE, true); ring(S, e.x, e.y - 4, 30, ICE); sfx('crit'); K.addShake(S, 0.3);
      for (let i = 0; i < 16; i++) part(S, 'debris', e.x, e.y - 4, S.rng.range(-110, 110), S.rng.range(-90, 30), S.rng.range(0.5, 0.9), S.rng.pick([ICE, '#e6fbff', '#5fb8d8']));
      for (const n of S.enemies) if (n !== e && !n.dead && n.f === S.f && Math.hypot(n.x - e.x, n.y - e.y) < 30 + n.r) { K.hurt(S, n, 8, { kx: n.x - e.x, ky: n.y - e.y, kb: 80, col: ICE, shard: true }); K.addIce(S, n, 1); }
    }
    if (!e.dead) { if (o.ice) K.addIce(S, e, o.ice); if (o.psn) K.addPsn(S, e, o.psn); if (o.pin) K.addPin(S, e, o.pin); }
    else if (e.psn > 0 && !e.gasDone) { e.gasDone = true; (S.gas = S.gas || []).push({ x: e.x, y: e.y, f: e.f, r: 30, t: 3, max: 3, tick: 0 }); text(S, e.x, e.y - 24, 'TOXIC', PSN); }
  };

  // 每帧：冻住 / 冰层消退、中毒掉血、钉住、毒雾传染、时滞场
  K.statusStep = function (S, dt) {
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.frozenT > 0) { e.frozenT -= dt; e.stun = Math.max(e.stun || 0, Math.min(0.1, e.frozenT)); e.frz = Math.max(e.frz || 0, 0.1); e.vx *= 0.5; e.vy *= 0.5; }
      if (e.ice > 0) { e.iceT -= dt; if (e.iceT <= 0) { e.ice = 0; } }
      if (e.pinT > 0) { e.pinT -= dt; e.stun = Math.max(e.stun || 0, Math.min(0.1, e.pinT)); e.vx = 0; e.vy = 0; }
      if (e.psn > 0) {
        e.psnT -= dt; e.psnTick = (e.psnTick || 0) - dt;
        if (e.psnTick <= 0) { e.psnTick = 0.5; K.hurt(S, e, e.psn, { dot: true, col: PSN }); }
        if (e.f === S.f && S.rng.chance(0.25)) part(S, 'smoke', e.x + S.rng.range(-e.r, e.r), e.y - 6, 0, -14, 0.6, PSN);
        if (e.psnT <= 0) e.psn = 0;
      }
      if (e.tslow > 0) e.tslow -= dt;
    }
    if (S.gas && S.gas.length) {
      for (const g of S.gas) {
        g.t -= dt; g.tick -= dt;
        if (g.f === S.f && S.rng.chance(0.6)) part(S, 'smoke', g.x + S.rng.range(-g.r, g.r), g.y + S.rng.range(-g.r * 0.5, g.r * 0.5), S.rng.range(-6, 6), S.rng.range(-10, -2), 0.9, S.rng.pick([PSN, '#4f9a3a']));
        if (g.tick <= 0) { g.tick = 0.5; for (const e of S.enemies) if (!e.dead && e.f === g.f && Math.hypot(e.x - g.x, e.y - g.y) < g.r + e.r) K.addPsn(S, e, 1); }
      }
      S.gas = S.gas.filter(g => g.t > 0);
    }
    const st = S.stasis;
    if (st) {
      const p = S.player; st.t -= dt; st.x = p.x; st.y = p.y;
      for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - st.x, e.y - st.y) < st.r + e.r) e.tslow = 0.1;
      for (const s of S.eshots) { const inF = Math.hypot(s.x - st.x, s.y - st.y) < st.r; if (inF && !s.tslow) { s.tslow = true; s.vx *= 0.3; s.vy *= 0.3; } else if (!inF && s.tslow) { s.tslow = false; s.vx /= 0.3; s.vy /= 0.3; } }
      if (st.t <= 0) { for (const s of S.eshots) if (s.tslow) { s.tslow = false; s.vx /= 0.3; s.vy /= 0.3; } S.stasis = null; }
    }
  };

  // 画：冰壳、冰层小点、毒泡、钉子、毒雾、时滞场（发光层）
  K.statusDraw = function (S, ctx, ex) {
    for (const e of S.enemies) {
      if (e.dead || e.f !== S.f) continue;
      if (e.frozenT > 0) {
        const x0 = e.x - e.r - 2, y0 = e.y - e.r * 2 - 4, w = e.r * 2 + 4; // 冰壳画在普通层（不泛光），只有边和高光进发光层
        ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#5fb8d8'; ctx.fillRect(x0, y0, w, w); ctx.globalAlpha = 0.35; ctx.fillStyle = '#e6fbff'; ctx.fillRect(x0 + 1, y0 + 1, w * 0.4, w * 0.3); ctx.restore();
        ex.save(); ex.globalAlpha = 0.45; ex.strokeStyle = ICE; ex.lineWidth = 0.75; ex.strokeRect(x0, y0, w, w);
        ex.beginPath(); ex.moveTo(x0 + 2, y0 + 2); ex.lineTo(x0 + 5, y0 + 6); ex.stroke(); ex.restore();
      } else if (e.ice > 0) for (let i = 0; i < e.ice; i++) { ex.fillStyle = ICE; ex.fillRect(e.x - 5 + i * 2.2, e.y - e.r * 2 - 8, 1.4, 1.4); }
      if (e.psn > 0) for (let i = 0; i < Math.min(8, e.psn); i++) { ex.fillStyle = PSN; ex.fillRect(e.x - 8 + i * 2.2, e.y - e.r * 2 - 11, 1.4, 1.4); }
      if (e.pinT > 0) { ctx.strokeStyle = '#0b0a14'; ctx.lineWidth = 1.5; for (const [ox, oy] of [[-4, -3], [3, -6], [0, 0]]) { ctx.beginPath(); ctx.moveTo(e.x + ox - 3, e.y - 6 + oy - 2); ctx.lineTo(e.x + ox + 3, e.y - 6 + oy + 2); ctx.stroke(); } ex.strokeStyle = PIN; ex.lineWidth = 0.75; for (const [ox, oy] of [[-4, -3], [3, -6], [0, 0]]) { ex.beginPath(); ex.moveTo(e.x + ox - 3, e.y - 6 + oy - 2); ex.lineTo(e.x + ox + 3, e.y - 6 + oy + 2); ex.stroke(); } }
    }
    for (const g of S.gas || []) if (g.f === S.f) { ex.save(); ex.globalAlpha = 0.1 * Math.min(1, g.t); ex.fillStyle = PSN; ex.beginPath(); ex.ellipse(g.x, g.y, g.r, g.r * 0.55, 0, 0, TAU); ex.fill(); ex.restore(); }
    const st = S.stasis;
    if (st) { const k = Math.min(1, st.t); ex.save(); ex.globalAlpha = 0.12 * k; ex.fillStyle = P.v; ex.beginPath(); ex.ellipse(st.x, st.y - 4, st.r, st.r * 0.6, 0, 0, TAU); ex.fill(); ex.globalAlpha = 0.7 * k; ex.strokeStyle = P.v; ex.lineWidth = 1; ex.setLineDash([3, 3]); ex.lineDashOffset = -S.t * 10; ex.stroke(); ex.setLineDash([]); ex.restore(); }
  };

  // 接进每帧和画（不改 station.js / draw.js 的调用：包住已有的挂钩）
  const post0 = K.armsPost; K.armsPost = function (S, dt) { if (post0) post0(S, dt); K.statusStep(S, dt); };
  const draw0 = K.meleeDraw; K.meleeDraw = function (S, ctx, ex) { K.statusDraw(S, ctx, ex); if (draw0) draw0(S, ctx, ex); };
})(D);
