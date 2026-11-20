/* Underdog · 近战流派：10 把近战（每把一个招牌重击）、3 个流派被动（弹反 / 连斩 / 残心）、刀光和招牌特效。
   设计：design/features/melee/design.md
   挂钩：player.js 的 melee() → K.meleeHeavy / K.meleeSwing / K.meleeHitMul / K.meleeParry（所有近战都弹反，判定放大见 player.js 的 D.mRange / D.mArc）；station.js → K.meleeStep（移动前）；draw.js → K.meleeDraw、D.meleeCol。
   必须在 arms.js 之后、gear.js 之前加载（gear.js 照这里的表生成"·改""·精工"）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, K = D.K || (D.K = {}), TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), hurt = (...a) => K.hurt(...a);
  const flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a), zig = (...a) => K.zig(...a), hitWall = (...a) => K.hitWall(...a);
  const isBoss = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss);
  const alive = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.dormant);
  const pas = S => (S.raid && S.raid.pas) || {};
  const add = (k, o) => { o.price = D.CARD_VALUE[o.q]; D.CARDS[k] = o; };

  // ── 1. 武器表：新加五把（工兵铲、双匕首、流星锤、动力拳套、等离子剑）和三个流派被动
  // 删掉的扳手、撬棍、热切刀、液压锤、电矛；留下的链锯（data.js）、电击棍、消防斧、武士刀（原高频刀）、钻臂（content.js）也有招牌了
  add('shovel', { slot: 'melee', name: '工兵铲', q: 0, art: 'm_shovel', free: true, desc: '15 伤害。重击：往前铲出一道冲击波，一条线上的敌人吃双倍伤害并被掀开',
    melee: { dmg: 15, cd: 0.38, range: 21, arc: 1.2, heavy: 'wave', col: '#e0b56a' } });
  add('daggers', { slot: 'melee', name: '双匕首', q: 2, art: 'm_daggers', desc: '11 伤害，出手极快，背刺 ×4。重击：闪到最近的敌人背后捅一刀（×3.5）',
    melee: { dmg: 11, cd: 0.16, range: 18, arc: 1.0, sneak: 4, heavy: 'shadow', col: '#b48cff' } });
  add('flail', { slot: 'melee', name: '流星锤', q: 3, art: 'm_flail', desc: '22 伤害，扇面大。重击：原地旋风 1.1 秒，把周围的敌人卷进来一直砸',
    melee: { dmg: 22, cd: 0.5, range: 26, arc: 1.7, heavy: 'spin', col: '#ff9a3a' } });
  add('gauntlet', { slot: 'melee', name: '动力拳套', q: 4, art: 'm_gauntlet', desc: '30 伤害，击退大。重击：火箭拳冲出去把敌人打飞，撞墙或撞上别的敌人再吃一下并晕住',
    melee: { dmg: 30, cd: 0.45, range: 18, arc: 0.9, kb: 220, heavy: 'rocket', col: '#ffb020' } });
  add('plasma', { slot: 'melee', name: '等离子剑', q: 5, art: 'm_plasma', desc: '26 伤害，每刀放一道穿透的剑气。重击：两道交叉的大剑气',
    melee: { dmg: 26, cd: 0.3, range: 24, arc: 1.3, wave: 0.6, heavy: 'cross', col: '#3ee8ff' } });
  Object.assign(D.CARD_SHAPE, { shovel: [2, 1], daggers: [2, 1], flail: [3, 2], gauntlet: [2, 2], plasma: [4, 1] });
  // 流派被动
  add('parry', { slot: 'pas', name: '弹反', q: 2, icon: 'parry', desc: '近战弹回去的子弹伤害 ×2，还会拐弯追最近的敌人' });
  add('flow', { slot: 'pas', name: '连斩', q: 3, icon: 'flow', desc: '近战每打中一下叠 1 层（最多 5 层），每层近战伤害 +8%；2.5 秒没打中清零' });
  add('zanshin', { slot: 'pas', name: '残心', q: 3, icon: 'zanshin', desc: '近战杀敌：闪避冷却清零，回复 3 耐久' });

  // 旧存档：删掉的近战换成新的（save.js 读档时用）
  const REMAP = { wrench: 'shovel', crowbar: 'shovel', blade: 'daggers', spear: 'daggers', hammer: 'gauntlet' };
  D.remapCard = function (k) { if (!k) return k; const m = /^(card:)?([a-z]+)(_[23])?$/.exec(k); return m && REMAP[m[2]] ? (m[1] || '') + REMAP[m[2]] + (m[3] || '') : k; };
  D.meleeCol = id => { const c = D.CARDS[id]; return (c && c.melee && c.melee.col) || null; };

  // ── 2. 图：28×28 物品图（画板，自动描黑边），16×16 被动图标
  Object.assign(D.ITEM_ART, {
    m_shovel: p => { p.line(4, 24, 17, 11, '#8c5d3c'); p.line(5, 24, 18, 11, '#4a2f1f'); p.rect(2, 23, 5, 2, '#3d4766'); p.box(16, 3, 9, 10, R.olive, { r: 2 }); p.rect(23, 5, 2, 7, '#c8cdda'); p.px(19, 6, '#a7b06a'); },
    m_daggers: p => { p.line(4, 24, 15, 9, '#dbe5fa', 1); p.line(5, 24, 16, 9, '#6f84b3'); p.rect(3, 22, 4, 3, R.dark[4]); p.line(13, 25, 24, 10, '#dbe5fa', 1); p.line(14, 25, 25, 10, '#6f84b3'); p.rect(12, 23, 4, 3, '#5c3b8a'); p.px(15, 9, '#b48cff', 1); p.px(24, 10, '#b48cff', 1); },
    m_flail: p => { p.line(3, 25, 11, 17, '#8c5d3c'); p.line(4, 25, 12, 17, '#4a2f1f'); for (let i = 0; i < 4; i++) p.rect(12 + i * 2, 15 - i * 2, 1, 1, '#a3b6dc'); p.ell(20, 9, 5, 5, R.gunmetal, { spec: true }); p.px(20, 3, '#c8cdda'); p.px(26, 9, '#c8cdda'); p.px(20, 15, '#c8cdda'); p.px(14, 9, '#c8cdda'); p.px(21, 8, '#ff9a3a', 1); },
    m_gauntlet: p => { p.box(5, 8, 15, 14, R.copper, { r: 3 }); for (let i = 0; i < 4; i++) p.rect(17, 9 + i * 3, 5, 2, '#d9a066'); p.rect(4, 19, 10, 5, '#3d4766'); p.rect(7, 11, 6, 2, '#ffb020', 1); p.rect(1, 21, 3, 2, '#ff7a2e', 1); },
    m_plasma: p => { p.box(2, 20, 7, 5, R.dark, { r: 1 }); p.rect(8, 19, 2, 4, '#c8cdda'); p.line(9, 20, 25, 4, '#3ee8ff', 1); p.line(10, 20, 26, 4, '#c4fbff', 1); p.line(10, 21, 26, 5, '#1fa5c4', 1); p.px(4, 22, '#3ee8ff', 1); },
  });
  Object.assign(D.ICON_ART, {
    parry: g => { g.line(3, 13, 12, 4, P[5], 2); g.line(12, 4, 14, 2, P[6]); g.disc(5, 5, 2, P.Y); g.line(6, 6, 9, 9, P.Y); },
    flow: g => { g.line(2, 12, 7, 3, P.m, 1); g.line(6, 13, 11, 4, P.m, 1); g.line(10, 14, 15, 5, P.M, 1); },
    zanshin: g => { g.line(3, 13, 13, 3, P[6], 2); g.disc(11, 11, 3, P.g); g.rect(10, 10, 3, 1, P.k); g.rect(11, 9, 1, 3, P.k); },
  });

  // ── 3. 伤害：近战的"力度"（重击和剑气都按这个算）；连斩叠层
  function flowMul(S) { const p = S.player; if (!pas(S).flow) return 1; if (S.t - (p.flowT || -9) > 2.5) p.flow = 0; return 1 + 0.08 * (p.flow || 0); }
  function power(S, m) { const p = S.player, pa = pas(S); return m.dmg * (pa.edge ? 1.3 : 1) * (pa.berserk && p.hp < p.maxHp * 0.3 ? 1.3 : 1) * flowMul(S); }
  const mm0 = K.meleeMul; K.meleeMul = (S, m) => (mm0 ? mm0(S, m) : 1) * flowMul(S);
  function stack(S, n) {
    const p = S.player; if (!pas(S).flow || !n) return;
    if (S.t - (p.flowT || -9) > 2.5) p.flow = 0;
    const was = p.flow || 0; p.flow = Math.min(5, was + n); p.flowT = S.t;
    if (was < 5 && p.flow >= 5) { text(S, p.x, p.y - 34, 'FLOW', P.m, true); ring(S, p.x, p.y - 6, 18, P.m); }
  }
  function onKill(S) {
    const p = S.player; if (!pas(S).zanshin || p.hp <= 0) return;
    p.dashCd = 0; p.hp = Math.min(p.maxHp, p.hp + 3); text(S, p.x, p.y - 26, '+3', P.g);
  }
  // 招牌攻击打中一个敌人：伤害、火花、电容、连斩、残心。返回是否打死
  function mhit(S, m, e, dmg, o) {
    if (e.dead) return false;
    o = Object.assign({ melee: true, slash: true, col: m.col || P[6], noShield: m.noShield, kb: 120 }, o);
    hurt(S, e, Math.round(dmg), o);
    for (let i = 0; i < 4; i++) part(S, 'spark', e.x, e.y - 6, S.rng.range(-90, 90), S.rng.range(-90, 40), 0.22, m.col || P.Y);
    if (K.capGain) K.capGain(S, D.SHELL.capPerHit * (m.capMul || 1) * 0.5);
    stack(S, 1);
    if (e.dead) { onKill(S); return true; }
    return false;
  }
  K.meleeHitMul = function (S, m, e) { // 链锯：锯同一个越锯越痛
    if (!m.rev) return 1;
    e.sawN = e.sawT != null && S.t - e.sawT < 0.35 ? Math.min(10, (e.sawN || 0) + 1) : 0; e.sawT = S.t;
    if (e.sawN >= 10 && S.rng.chance(0.3)) part(S, 'spark', e.x, e.y - 6, S.rng.range(-120, 120), S.rng.range(-120, 0), 0.25, P.r);
    return 1 + 0.15 * e.sawN;
  };
  // 弹反：所有近战扫到的敌人子弹都朝准星弹回去（player.js 的 deflect 调）；带"弹反"被动：伤害 ×2、拐弯追最近的敌人
  // nth：这一下打掉的第几发，特效（顿帧、闪光、字）只在第一发放
  K.meleeParry = function (S, s, m, nth) {
    const p = S.player, up = !!pas(S).parry, a = p.aim, sp = Math.max(260, Math.hypot(s.vx, s.vy) * 1.4);
    S.shots.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, dmg: Math.max(up ? 8 : 5, (s.dmg || 5) * (up ? 2 : 1)), r: 2.5, hit: new Set(), col: up ? P.Y : P.O, parried: true, homing: up ? 4 : 0 });
    for (let i = 0; i < 5; i++) { const v = S.rng.range(60, 160); part(S, 'spark', s.x, s.y, Math.cos(a) * v + S.rng.range(-30, 30), Math.sin(a) * v + S.rng.range(-30, 30), 0.25, i % 2 ? '#ffffff' : P.Y); }
    S.raid.parries = (S.raid.parries || 0) + 1;
    if (nth) return;
    fxs(S).push({ k: 'pflash', x: s.x, y: s.y, a, t: 0.2, max: 0.2, col: (m && m.col) || P.Y });
    text(S, s.x, s.y - 8, 'PARRY', P.Y, true); ring(S, s.x, s.y, 10, P.Y); flashLight(S, s.x, s.y, 55, P.Y, 1.1);
    S.stop = Math.max(S.stop, 0.06); addShake(S, 0.15); sfx('ding');
    if (K.capGain) K.capGain(S, D.SHELL.capPerHit * 0.5);
  };

  // ── 4. 普攻打完：刀光、剑气、连斩、残心、顿帧
  const fxs = S => S.mfx || (S.mfx = []);
  K.meleeSwing = function (S, m, heavy, hits, kills) {
    const p = S.player;
    fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: p.aim, arc: Math.min(2.4, D.mArc(m) + (heavy ? 0.35 : 0)), r: D.mRange(m) + (heavy ? 8 : 2), dir: p.swingDir, t: 0.15, max: 0.15, col: m.col || P[6], w: heavy ? 1.6 : 1 });
    if (hits) { stack(S, hits); S.stop = Math.max(S.stop, heavy ? 0.07 : m.cd <= 0.15 ? 0 : 0.025); }
    for (let i = 0; i < (kills || 0); i++) onKill(S);
    if (m.wave) wave(S, m, p.aim, power(S, m) * m.wave, { speed: 280, life: 0.5, w: 8 });
  };

  // 剑气：往前飞的半月光弧，穿透，碰墙消失
  function wave(S, m, a, dmg, o) {
    const p = S.player;
    const off = o.off || 0;
    fxs(S).push({ k: 'swave', x: p.x + Math.cos(a) * 8 - Math.sin(a) * off, y: p.y - 6 + Math.sin(a) * 8 + Math.cos(a) * off, a, rot: o.rot || 0, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, t: o.life, max: o.life, dmg, w: o.w, hit: new Set(), col: m.col, m });
  }

  // ── 5. 招牌重击
  function freeDist(S, x, y, a, max) {
    const ok = (x, y) => !D.solidAt(S.A, x, y) && !D.solidAt(S.A, x - 4, y) && !D.solidAt(S.A, x + 4, y) && !D.solidAt(S.A, x, y - 3);
    let d = 0; while (d + 3 <= max && ok(x + Math.cos(a) * (d + 3), y + Math.sin(a) * (d + 3))) d += 3; return d;
  }
  function segDist(x, y, x0, y0, x1, y1) { // 点到线段的距离
    const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy, t = L ? Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / L)) : 0;
    return Math.hypot(x - x0 - vx * t, y - y0 - vy * t);
  }
  function dashTo(S, a, d, speed, extraInv) {
    const p = S.player; p.dashT = d / speed; p.dx = Math.cos(a) * speed; p.dy = Math.sin(a) * speed; p.inv = Math.max(p.inv, p.dashT + (extraInv || 0.1)); p.lungeHit = null;
  }
  const HEAVY = {
    // 工兵铲：冲击波沿地面往前推
    wave(S, m, pw) {
      const p = S.player, a = p.aim;
      fxs(S).push({ k: 'quake', x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6, a, d: 0, max: 84, speed: 340, dmg: pw * 2, hit: new Set(), m, t: 1 });
      addShake(S, 0.3); sfx('slam'); flashLight(S, p.x, p.y, 50, m.col, 0.8);
    },
    // 双匕首：闪到最近的敌人背后
    shadow(S, m, pw) {
      const p = S.player; let best = null, bd = 110;
      for (const e of alive(S)) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
      for (let i = 0; i < 10; i++) part(S, 'smoke', p.x + S.rng.range(-5, 5), p.y - S.rng.range(0, 10), S.rng.range(-20, 20), S.rng.range(-30, -5), 0.5, '#5c3b8a');
      if (!best) { const d = freeDist(S, p.x, p.y, p.aim, 50); dashTo(S, p.aim, d, 520); sfx('lunge'); return; }
      const a = Math.atan2(best.y - p.y, best.x - p.x); let tx = best.x + Math.cos(a) * (best.r + 8), ty = best.y + Math.sin(a) * (best.r + 8);
      if (D.solidAt(S.A, tx, ty)) { tx = best.x - Math.cos(a) * (best.r + 8); ty = best.y - Math.sin(a) * (best.r + 8); }
      if (!D.solidAt(S.A, tx, ty)) { p.x = tx; p.y = ty; }
      p.inv = Math.max(p.inv, 0.3); p.vx = 0; p.vy = 0;
      for (let i = 0; i < 10; i++) part(S, 'smoke', p.x + S.rng.range(-5, 5), p.y - S.rng.range(0, 10), S.rng.range(-20, 20), S.rng.range(-30, -5), 0.5, '#9b6bff');
      const sneak = !best.aware && !isBoss(best);
      mhit(S, m, best, pw * 3.5 * (sneak ? 1.5 : 1), { kx: best.x - p.x, ky: best.y - p.y, kb: 160, crit: true });
      text(S, best.x, best.y - 32, sneak ? 'SNEAK' : 'SHADOW', P.v, true);
      fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: Math.atan2(best.y - p.y, best.x - p.x), arc: 1.2, r: 22, dir: 1, t: 0.16, max: 0.16, col: m.col, w: 1.8 });
      S.stop = Math.max(S.stop, 0.08); addShake(S, 0.25); flashLight(S, best.x, best.y - 6, 60, P.v, 1); sfx('crit');
    },
    // 武士刀：居合冲刺 → 斩线爆开
    iai(S, m, pw) {
      const p = S.player, a = p.aim, d = Math.max(20, freeDist(S, p.x, p.y, a, 110));
      dashTo(S, a, d, 760, 0.18);
      p.mAct = { k: 'iai', t: 0, dur: p.dashT, m, pw, a, x0: p.x, y0: p.y, hit: new Set() };
      flashLight(S, p.x, p.y - 6, 70, m.col, 1.2); addShake(S, 0.2); sfx('lunge');
    },
    // 流星锤：旋风
    spin(S, m, pw) { const p = S.player; p.mAct = { k: 'spin', t: 0, dur: 1.1, tick: 0, m, pw }; p.meleeCd = 1.2; sfx('swing'); },
    // 动力拳套：火箭拳
    rocket(S, m, pw) {
      const p = S.player, a = p.aim, d = Math.max(16, freeDist(S, p.x, p.y, a, 90));
      dashTo(S, a, d, 600, 0.12); p.mAct = { k: 'rocket', t: 0, dur: p.dashT, m, pw, a, done: false };
      flashLight(S, p.x, p.y - 6, 60, P.o, 1); sfx('lunge');
    },
    // 等离子剑：十字剑气
    cross(S, m, pw) {
      const p = S.player;
      for (const s of [-1, 1]) wave(S, m, p.aim, pw * 1.6, { speed: 320, life: 0.62, w: 15, rot: s * 0.55, off: s }); // 两道一起往前飞，斜着交叉成 X
      flashLight(S, p.x, p.y - 6, 80, m.col, 1.3); addShake(S, 0.3); sfx('rail');
    },
    // 电击棍：电弧连锁
    chain(S, m, pw) {
      const p = S.player, hit = new Set(); let from = null;
      for (const e of alive(S)) { const dx = e.x - p.x, dy = e.y - 4 - (p.y - 6); if (Math.hypot(dx, dy) < D.mRange(m) + 6 + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < D.mArc(m) + 0.3) { hit.add(e); from = from || e; mhit(S, m, e, pw * 1.5, { kx: dx, ky: dy, elec: true }); e.stun = Math.max(e.stun || 0, 1); } }
      let src = from ? { x: from.x, y: from.y - 6 } : { x: p.x + Math.cos(p.aim) * 10, y: p.y - 6 + Math.sin(p.aim) * 10 };
      for (let n = 0; n < 3; n++) {
        let best = null, bd = from ? 90 : 70;
        for (const e of alive(S)) if (!hit.has(e)) { const d = Math.hypot(e.x - src.x, e.y - 6 - src.y); if (d < bd) { bd = d; best = e; } }
        if (!best) break;
        hit.add(best); S.bolts.push({ pts: zig(S, src.x, src.y, best.x, best.y - 6), t: 0.25 });
        mhit(S, m, best, pw * 1.5, { kx: best.x - src.x, ky: best.y - src.y, elec: true, kb: 40 }); best.stun = Math.max(best.stun || 0, 1);
        src = { x: best.x, y: best.y - 6 };
      }
      fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: p.aim, arc: D.mArc(m) + 0.3, r: D.mRange(m) + 6, dir: p.swingDir, t: 0.16, max: 0.16, col: m.col, w: 1.6 });
      flashLight(S, p.x, p.y - 6, 90, m.col, 1.3); addShake(S, 0.25); sfx('zap');
    },
    // 消防斧：跳劈
    leap(S, m, pw) {
      const p = S.player, I = D.Input, a = p.aim, want = Math.min(90, Math.hypot(I.wx - p.x, I.wy - p.y)), d = Math.max(12, freeDist(S, p.x, p.y, a, want));
      dashTo(S, a, d, d / 0.28, 0.1); p.mAct = { k: 'leap', t: 0, dur: 0.28, m, pw, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d };
      sfx('leap');
    },
    // 钻臂：钻住面前的敌人
    bore(S, m, pw) { const p = S.player; p.mAct = { k: 'bore', t: 0, dur: 0.6, tick: 0, n: 0, m, pw }; p.meleeCd = 0.7; sfx('charge2'); },
  };
  K.meleeHeavy = function (S, m) {
    const f = HEAVY[m.heavy]; if (!f) return false;
    const p = S.player; p.swingT = 0.22; p.swingArc = D.mArc(m) + 0.35; p.swingDir *= -1;
    f(S, m, power(S, m));
    S.raid.heavies = (S.raid.heavies || 0) + 1;
    return true;
  };

  // ── 6. 每帧（station.js 在移动前调）：招牌动作、剑气、冲击波、被打飞的敌人
  K.meleeStep = function (S, dt) {
    const p = S.player, A = p.mAct;
    if (A) {
      A.t += dt; const m = A.m;
      if (A.k === 'iai') {
        if (!A.end) {
          if (S.t % 0.02 < dt) S.ghosts.push({ x: p.x, y: p.y, t: 0.2, flip: Math.cos(A.a) < 0, col: m.col });
          // 扫一段：从上一帧的位置到这一帧的位置，离这段线够近就算砍到（只看落点会从敌人身边穿过去；高低按普攻的算法对齐）
          const px0 = A.px != null ? A.px : A.x0, py0 = A.py != null ? A.py : A.y0; A.px = p.x; A.py = p.y;
          for (const e of alive(S)) if (!A.hit.has(e) && segDist(e.x, e.y - 4, px0, py0 - 6, p.x, p.y - 6) < e.r + 16) { A.hit.add(e); mhit(S, m, e, A.pw * 2.5, { kx: Math.cos(A.a), ky: Math.sin(A.a), kb: 60, crit: true }); e.iaiMark = S.t; S.stop = Math.max(S.stop, 0.03); }
          if (A.t >= A.dur) { A.end = A.t; A.x1 = p.x; A.y1 = p.y; fxs(S).push({ k: 'iline', x0: A.x0, y0: A.y0 - 6, x1: p.x, y1: p.y - 6, t: 0.28, max: 0.28, col: m.col, boom: false }); }
        } else if (A.t - A.end >= 0.28) {
          let killed = 0;
          for (const e of A.hit) if (!e.dead) { const ex = e.x, ey = e.y; if (mhit(S, m, e, A.pw * 1.5, { kx: Math.cos(A.a), ky: Math.sin(A.a), kb: 140, crit: true })) killed++; for (let i = 0; i < 8; i++) part(S, 'spark', ex, ey - 6, S.rng.range(-140, 140), S.rng.range(-140, 60), 0.3, '#ffffff'); }
          fxs(S).push({ k: 'iline', x0: A.x0, y0: A.y0 - 6, x1: A.x1, y1: A.y1 - 6, t: 0.22, max: 0.22, col: '#ffffff', boom: true });
          scar(S, A.x0, A.y0, A.x1, A.y1, m.col);
          if (A.hit.size) { S.stop = Math.max(S.stop, 0.1); addShake(S, 0.45); flashLight(S, (A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2 - 6, 90, '#ffffff', 1.4); sfx('crit'); } else sfx('swing');
          if (killed) { p.meleeCd = 0; p.dashCd = 0; text(S, p.x, p.y - 34, 'RESET', m.col, true); ring(S, p.x, p.y - 6, 20, m.col); }
          p.mAct = null;
        }
      } else if (A.k === 'spin') {
        p.spdMul = (p.spdMul || 1) * 0.8; A.tick -= dt;
        if (A.tick <= 0) {
          A.tick += 0.15; let n = 0;
          for (const e of alive(S)) { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d < 32 + e.r) { n++; mhit(S, m, e, A.pw * 0.7, { kx: dx, ky: dy, kb: 20 }); if (!isBoss(e) && d > 12) { e.vx -= dx / d * 140; e.vy -= dy / d * 140; } } }
          { let k = 0; for (const s of S.eshots) if (s.life > 0 && Math.hypot(s.x - p.x, s.y - (p.y - 6)) < 40) { if (K.meleeParry) K.meleeParry(S, s, m, k++); s.life = 0; } }
          sfx(n ? 'hit' : 'swing'); if (n) addShake(S, 0.08);
        }
        if (A.t >= A.dur) { p.mAct = null; ring(S, p.x, p.y - 4, 34, m.col); }
      } else if (A.k === 'rocket') {
        if (S.t % 0.02 < dt) { part(S, 'spark', p.x - Math.cos(A.a) * 6, p.y - 6 - Math.sin(A.a) * 6, -Math.cos(A.a) * 120 + S.rng.range(-30, 30), -Math.sin(A.a) * 120 + S.rng.range(-30, 30), 0.25, P.o); part(S, 'smoke', p.x, p.y - 4, -Math.cos(A.a) * 30, -Math.sin(A.a) * 30, 0.4, '#5a5060'); }
        if (!A.done) for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 11) {
          A.done = true; mhit(S, m, e, A.pw * 2.5, { kx: Math.cos(A.a), ky: Math.sin(A.a), kb: 0, crit: true });
          if (!e.dead && !isBoss(e) && e.kind !== 'turret') { e.vx = Math.cos(A.a) * 520; e.vy = Math.sin(A.a) * 520; e.flung = { t: 0.45, a: A.a, pw: A.pw, m }; e.stun = Math.max(e.stun || 0, 0.5); }
          p.dashT = 0; p.vx = -Math.cos(A.a) * 60; p.vy = -Math.sin(A.a) * 60;
          ring(S, e.x, e.y - 6, 18, P.o); addShake(S, 0.4); S.stop = Math.max(S.stop, 0.07); flashLight(S, e.x, e.y - 6, 70, P.o, 1.3); sfx('heavy');
          break;
        }
        if (A.t >= A.dur || p.dashT <= 0) p.mAct = null;
      } else if (A.k === 'leap') {
        if (A.t >= A.dur) {
          const x = p.x, y = p.y;
          for (const e of alive(S)) { const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy); if (d < 34 + e.r) { mhit(S, m, e, A.pw * 2.2, { kx: dx || 1, ky: dy, kb: 200, crit: true }); e.stun = Math.max(e.stun || 0, 0.6); } }
          for (let i = 0; i < 4; i++) hitWall(S, x + Math.cos(i * Math.PI / 2) * 20, y + Math.sin(i * Math.PI / 2) * 20, A.pw * (m.wallMul || 1));
          ring(S, x, y, 36, m.col); ring(S, x, y, 22, P.Y); crack(S, x, y, 22);
          for (let i = 0; i < 14; i++) part(S, 'debris', x, y, S.rng.range(-90, 90), S.rng.range(-60, 20), S.rng.range(0.6, 1.1), '#6a5a52');
          addShake(S, 0.55); S.stop = Math.max(S.stop, 0.07); flashLight(S, x, y - 4, 80, m.col, 1.3); sfx('slam');
          p.mAct = null;
        }
      } else if (A.k === 'bore') {
        p.spdMul = (p.spdMul || 1) * 0.3; A.tick -= dt;
        if (A.tick <= 0 && A.n < 6) {
          A.tick += 0.1; A.n++; let any = false;
          for (const e of alive(S)) { const dx = e.x - p.x, dy = e.y - 4 - (p.y - 6); if (Math.hypot(dx, dy) < D.mRange(m) + 6 + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < 0.7 + D.MELEE_REACH.a) { any = true; mhit(S, m, e, A.pw * 0.6, { kx: dx, ky: dy, kb: 15, noShield: true }); e.stun = Math.max(e.stun || 0, 0.3); } }
          const fx = p.x + Math.cos(p.aim) * 16, fy = p.y - 6 + Math.sin(p.aim) * 16;
          for (let i = 0; i < 5; i++) part(S, 'spark', fx, fy, S.rng.range(-120, 120), S.rng.range(-120, 30), 0.2, i % 2 ? P.Y : P.o);
          if (!any) hitWall(S, fx, fy + 6, A.pw * 0.6);
          addShake(S, 0.06); sfx(any ? 'hit' : 'tink'); p.swingT = 0.1;
        }
        if (A.t >= A.dur) p.mAct = null;
      }
    }
    // 被拳套打飞的敌人：撞墙 / 撞人
    for (const e of S.enemies) if (e.flung) {
      const F = e.flung; F.t -= dt;
      if (e.dead || F.t <= 0) { e.flung = null; continue; }
      const ax = Math.cos(F.a), ay = Math.sin(F.a);
      if (D.solidAt(S.A, e.x + ax * (e.r + 3), e.y + ay * (e.r + 3))) {
        e.flung = null; e.vx = 0; e.vy = 0; mhit(S, F.m, e, F.pw * 1.5, { kx: -ax, ky: -ay, kb: 30, crit: true }); if (!e.dead) e.stun = Math.max(e.stun || 0, 1.2);
        ring(S, e.x, e.y - 6, 20, P.o); crack(S, e.x + ax * e.r, e.y + ay * e.r, 8); addShake(S, 0.35); text(S, e.x, e.y - 30, 'SLAM', P.o, true); sfx('slam'); continue;
      }
      for (const o of S.enemies) if (o !== e && !o.dead && o.f === S.f && Math.hypot(o.x - e.x, o.y - e.y) < o.r + e.r + 2) {
        e.flung = null; e.vx *= 0.2; e.vy *= 0.2;
        mhit(S, F.m, e, F.pw, { kx: -ax, ky: -ay, kb: 20 }); mhit(S, F.m, o, F.pw, { kx: ax, ky: ay, kb: 180 });
        if (!e.dead) e.stun = Math.max(e.stun || 0, 1); if (!o.dead) o.stun = Math.max(o.stun || 0, 1);
        ring(S, o.x, o.y - 6, 18, P.o); addShake(S, 0.3); text(S, o.x, o.y - 30, 'SLAM', P.o, true); sfx('heavy'); break;
      }
    }
    // 刀光、斩线、剑气、冲击波
    const L = S.mfx; if (!L || !L.length) return;
    for (const f of L) {
      f.t -= dt;
      if (f.k === 'swave') {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (D.solidAt(S.A, f.x, f.y + 6)) { f.t = 0; hitWall(S, f.x, f.y + 6, f.dmg); for (let i = 0; i < 5; i++) part(S, 'spark', f.x, f.y, S.rng.range(-60, 60), S.rng.range(-60, 60), 0.2, f.col); continue; }
        for (const e of alive(S)) if (!f.hit.has(e) && Math.hypot(e.x - f.x, e.y - 5 - f.y) < e.r + f.w * 0.6) { f.hit.add(e); mhit(S, f.m, e, f.dmg, { kx: f.vx, ky: f.vy, kb: 70 }); }
      } else if (f.k === 'quake') {
        const step = f.speed * dt; f.d += step; const x = f.x + Math.cos(f.a) * f.d, y = f.y + Math.sin(f.a) * f.d;
        if (f.d >= f.max || D.solidAt(S.A, x, y)) { if (f.d < f.max) hitWall(S, x, y, f.dmg); f.t = 0; continue; }
        f.cx = x; f.cy = y;
        if (S.rng.chance(0.7)) part(S, 'debris', x + S.rng.range(-4, 4), y, S.rng.range(-30, 30), S.rng.range(-40, -10), 0.6, '#7a6650');
        if (S.rng.chance(0.4)) part(S, 'smoke', x, y, S.rng.range(-10, 10), -12, 0.5, '#6b6070');
        for (const e of alive(S)) if (!f.hit.has(e) && Math.hypot(e.x - x, e.y - y) < e.r + 10) { f.hit.add(e); mhit(S, f.m, e, f.dmg, { kx: Math.cos(f.a), ky: Math.sin(f.a), kb: 200, crit: true }); e.stun = Math.max(e.stun || 0, 0.3); }
        if (S.t % 0.05 < dt) crack(S, x, y, 3);
      }
    }
    S.mfx = L.filter(f => f.t > 0);
  };

  // 地上的痕迹：画进 S.fx（不会消失的贴花层，单位是屏幕像素）
  function scar(S, x0, y0, x1, y1, col) {
    const g = S.fx, Z = D.Z; if (!g) return; g.save(); g.globalAlpha = 0.55; g.strokeStyle = '#0b0a14'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 * Z, y0 * Z); g.lineTo(x1 * Z, y1 * Z); g.stroke();
    g.globalAlpha = 0.35; g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 * Z, y0 * Z - 1); g.lineTo(x1 * Z, y1 * Z - 1); g.stroke(); g.restore();
  }
  function crack(S, x, y, r) {
    const g = S.fx, Z = D.Z; if (!g) return; g.save(); g.globalAlpha = 0.5; g.strokeStyle = '#0b0a14'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const a = S.rng() * TAU, l = r * S.rng.range(0.6, 1.2); g.beginPath(); g.moveTo(x * Z, y * Z); g.lineTo((x + Math.cos(a) * l) * Z, (y + Math.sin(a) * l * 0.6) * Z); g.stroke(); }
    g.restore();
  }

  // 给 arsenal-melee.js 用的工具（新近战的招牌加进 HEAVY）
  K.mel = { HEAVY, power, mhit, fxs, wave, freeDist, dashTo, scar, crack, stack, onKill };

  // ── 7. 画（draw.js 在世界坐标里调；ex 是发光层）
  K.meleeDraw = function (S, ctx, ex) {
    const p = S.player, A = p.mAct;
    for (const f of S.mfx || []) {
      const k = Math.max(0, f.t / f.max);
      if (f.k === 'cres') {
        // 月牙刀光：沿挥砍方向扫过去，外沿白、里面武器颜色，扫完淡掉
        const prog = Math.min(1, (1 - k) * 1.8), a0 = f.a - f.dir * f.arc, a1 = a0 + f.dir * f.arc * 2 * prog, lo = Math.min(a0, a1), hi = Math.max(a0, a1), fade = k < 0.5 ? k * 2 : 1;
        if (hi - lo < 0.02) continue;
        ex.save(); ex.globalAlpha = 0.85 * fade; ex.fillStyle = f.col;
        ex.beginPath(); ex.arc(f.x, f.y, f.r, lo, hi); ex.arc(f.x + Math.cos(f.a) * f.r * 0.25, f.y + Math.sin(f.a) * f.r * 0.25, f.r * 0.78, hi, lo, true); ex.closePath(); ex.fill();
        ex.globalAlpha = fade; ex.strokeStyle = '#ffffff'; ex.lineWidth = 0.75 * f.w; ex.beginPath(); ex.arc(f.x, f.y, f.r, lo, hi); ex.stroke();
        ex.restore();
      } else if (f.k === 'iline') {
        const w = f.boom ? 5 * k + 1 : 1 + (1 - k) * 1.5;
        ex.save(); ex.globalAlpha = f.boom ? k : 0.4 + 0.6 * (1 - k); ex.strokeStyle = f.col; ex.lineWidth = w + 1.5; ex.beginPath(); ex.moveTo(f.x0, f.y0); ex.lineTo(f.x1, f.y1); ex.stroke();
        ex.strokeStyle = '#ffffff'; ex.lineWidth = Math.max(0.5, w * 0.4); ex.stroke(); ex.restore();
      } else if (f.k === 'swave') {
        ex.save(); ex.translate(f.x, f.y); ex.globalAlpha = Math.min(1, k * 2);
        if (f.rot) { // 十字剑气：两道细长的斩痕斜着交叉成 X
          const L = f.w * 1.4; ex.rotate(f.a + Math.PI / 2 + f.rot * 1.4);
          ex.fillStyle = f.col; ex.beginPath(); ex.moveTo(-L, 0); ex.lineTo(0, -3); ex.lineTo(L, 0); ex.lineTo(0, 3); ex.closePath(); ex.fill();
          ex.fillStyle = '#ffffff'; ex.beginPath(); ex.moveTo(-L * 0.8, 0); ex.lineTo(0, -1); ex.lineTo(L * 0.8, 0); ex.lineTo(0, 1); ex.closePath(); ex.fill();
        } else {
          ex.rotate(f.a); ex.fillStyle = f.col; ex.beginPath(); ex.arc(0, 0, f.w, -1.1, 1.1); ex.arc(-f.w * 0.45, 0, f.w * 0.8, 1.1, -1.1, true); ex.closePath(); ex.fill();
          ex.strokeStyle = '#ffffff'; ex.lineWidth = 0.75; ex.beginPath(); ex.arc(0, 0, f.w, -0.9, 0.9); ex.stroke();
        }
        ex.restore();
      } else if (f.k === 'pflash') { // 弹反：子弹被打回去的那一下，十字星光 + 朝弹回方向的一道弧
        const r = 3 + (1 - k) * 9;
        ex.save(); ex.globalAlpha = k; ex.strokeStyle = '#ffffff'; ex.lineWidth = 1; ex.beginPath(); ex.moveTo(f.x - r, f.y); ex.lineTo(f.x + r, f.y); ex.moveTo(f.x, f.y - r * 0.7); ex.lineTo(f.x, f.y + r * 0.7); ex.stroke();
        ex.strokeStyle = f.col; ex.lineWidth = 1.5; ex.beginPath(); ex.arc(f.x, f.y, r * 0.8, f.a - 1, f.a + 1); ex.stroke(); ex.restore();
      } else if (f.k === 'quake' && f.cx != null) {
        ex.save(); ex.globalAlpha = 0.8; ex.strokeStyle = f.m.col; ex.lineWidth = 1.5; ex.beginPath(); ex.ellipse(f.cx, f.cy, 8, 4, 0, 0, TAU); ex.stroke(); ex.restore();
      }
    }
    if (A && A.k === 'spin') { // 旋风：两圈转着的刀光
      ex.save(); const r = 30, s = A.t * 22;
      for (let i = 0; i < 2; i++) { const a = s + i * Math.PI; ex.globalAlpha = 0.8; ex.fillStyle = A.m.col; ex.beginPath(); ex.arc(p.x, p.y - 6, r, a, a + 1.6); ex.arc(p.x, p.y - 6, r * 0.7, a + 1.6, a, true); ex.closePath(); ex.fill(); ex.strokeStyle = '#ffffff'; ex.lineWidth = 0.75; ex.beginPath(); ex.arc(p.x, p.y - 6, r, a + 0.8, a + 1.6); ex.stroke(); }
      const bx = p.x + Math.cos(s) * r, by = p.y - 6 + Math.sin(s) * r; ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#646e86'; ctx.beginPath(); ctx.arc(bx - 0.5, by - 0.5, 2.5, 0, TAU); ctx.fill();
      ex.restore();
    }
    if (A && A.k === 'leap') { const k = Math.min(1, A.t / A.dur); ex.save(); ex.globalAlpha = 0.5 + 0.5 * k; ex.strokeStyle = A.m.col; ex.lineWidth = 1; ex.beginPath(); ex.ellipse(A.tx, A.ty, 34 * (1.3 - k * 0.3), 17 * (1.3 - k * 0.3), 0, 0, TAU); ex.stroke(); ex.restore(); }
    if (pas(S).flow && (p.flow || 0) > 0 && S.t - (p.flowT || -9) < 2.5) { // 连斩层数：头顶一排小点
      for (let i = 0; i < p.flow; i++) { ex.fillStyle = P.m; ex.fillRect(p.x - 5 + i * 2.2, p.y - 25, 1.4, 1.4); }
    }
  };
})(D);
