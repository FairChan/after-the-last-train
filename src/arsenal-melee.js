/* Underdog · 新近战 15 把（design/features/arsenal/design.md）：链刃鞭、防暴盾、收割镰、双节棍、回旋轮刃、打桩机、炎刀、冰镐、磁力锤、突击骑枪、
   嗜血刃、时滞刀、爆破锤、毒刃、抓取爪。
   用 melee.js 的工具（K.mel）：招牌重击加进 K.mel.HEAVY；普攻效果走 K.meleeOnHit / 包住 K.meleeMul、K.meleeSwing；
   右键不是"点按 + 蓄力"的（举盾、打桩机、骑枪、抓取爪）走 K.meleeInput（station.js）。在 arsenal-guns.js 之后、gear.js 之前加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, K = D.K || (D.K = {}), TAU = Math.PI * 2, M = K.mel;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), hurt = (...a) => K.hurt(...a);
  const flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a), hitWall = (...a) => K.hitWall(...a);
  const isBoss = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss), isBig = e => isBoss(e) || !!D.ENEMIES[e.kind].elite || e.kind === 'turret';
  const alive = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.dormant);
  const add = (k, o) => { o.price = D.CARD_VALUE[o.q]; D.CARDS[k] = o; };
  const W = (k, name, q, desc, melee) => add(k, { slot: 'melee', name, q, art: 'm_' + k, desc, melee });

  // ── 1. 表
  W('whip', '链刃鞭', 2, '17 伤害，射程最远（44）、很窄；打中远处的敌人把它拽到身前。重击：鞭子缠住远处的敌人把你拉过去，落地横扫', { dmg: 17, cd: 0.4, range: 44, arc: 0.35, heavy: 'lash', col: '#d9a85a', whip: true });
  W('riot', '防暴盾', 2, '18 伤害，盾击撞晕 0.6 秒。右键按住举盾挡住正面的子弹；挡下的子弹给盾充能，满了自动反冲一圈', { dmg: 18, cd: 0.45, range: 18, arc: 1.0, stun: 0.6, kb: 160, mode: 'shield', col: '#7fb3ff' });
  W('scythe', '收割镰', 3, '24 伤害，扇面最大；一下打中的敌人越多每个越痛（每多 1 个 +15%）。重击：收割一圈，40% 以下的直接处决', { dmg: 24, cd: 0.55, range: 28, arc: 1.9, heavy: 'reap', col: '#d0d8ff', scythe: true });
  W('nunchaku', '双节棍', 2, '8 伤害，出手极快；0.6 秒内接上算连击，每连一下再快 4%（最多 40%），连到 10 下以后每下多充电容。重击：乱舞 12 连', { dmg: 8, cd: 0.2, range: 19, arc: 1.2, heavy: 'flurry', col: '#ffd84a', nun: true });
  W('chakram', '回旋轮刃', 3, '18 伤害。重击把轮刃扔向准星，穿透、来回各打一次，飞回手里；在空中时右键是拳头（6 伤害）', { dmg: 18, cd: 0.35, range: 22, arc: 1.2, heavy: 'throw', col: '#3ee8ff', chakram: true });
  W('pile', '打桩机', 4, '没有普攻：右键按住蓄满才出手，60 伤害，前方一条线全部穿透，打墙直接开洞', { dmg: 60, cd: 1.0, range: 30, arc: 0.4, mode: 'pile', heavy: 'pile', col: '#ff7a2e' });
  W('flameblade', '炎刀', 3, '18 伤害，每下点燃；砍已经着火的敌人引爆火焰（范围 30 伤害）。重击：往前烧一道火墙 3 秒', { dmg: 18, cd: 0.32, range: 22, arc: 1.25, heavy: 'firewall', col: '#ff8a2e', flame: true });
  W('icepick', '冰镐', 2, '15 伤害，每下叠 2 层冻结；冻住的敌人一镐碎掉（×3）。重击：往前一排冰刺，叠 3 层冻结', { dmg: 15, cd: 0.34, range: 20, arc: 1.0, ice: 2, heavy: 'icespike', col: '#9fe9ff' });
  W('magnet', '磁力锤', 4, '28 伤害，挥锤把面前的子弹吸歪。重击：磁暴，把 90 像素内的敌人全吸到身前再砸下去', { dmg: 28, cd: 0.55, range: 23, arc: 1.4, heavy: 'magstorm', col: '#ff3d8b', magnet: true });
  W('lance', '突击骑枪', 3, '20 伤害，很窄很长；跑得越快越痛（满速 ×2），闪避中按右键突刺 ×2.5。重击：连续三段冲刺突刺', { dmg: 20, cd: 0.4, range: 34, arc: 0.4, mode: 'lance', heavy: 'charge3', col: '#e3c14a', lance: true });
  W('bloodblade', '嗜血刃', 3, '22 伤害，每下回 2 耐久；装着它耐久上限 -20%。重击花 10 耐久，打出 ×5 的一刀', { dmg: 22, cd: 0.36, range: 22, arc: 1.2, heavy: 'bloodcut', col: '#ff3047', blood: true });
  W('timeblade', '时滞刀', 5, '22 伤害，出手快。重击在身边展开 3 秒时滞场：里面的敌人和子弹慢 70%，你不受影响（冷却 8 秒）', { dmg: 22, cd: 0.28, range: 23, arc: 1.3, heavy: 'stasis', col: '#9b6bff' });
  W('blasthammer', '爆破锤', 4, '26 伤害，每下在命中点小爆炸。重击砸地把自己炸飞 80 像素越过人群，落地再炸一下；自己不掉血', { dmg: 26, cd: 0.5, range: 21, arc: 1.2, heavy: 'rjump', col: '#ff5a2e', blast: true });
  W('toxblade', '毒刃', 3, '12 伤害，出手快，每下叠 2 层中毒；毒死的敌人放毒雾传染。重击：一刀叠满 8 层', { dmg: 12, cd: 0.22, range: 20, arc: 1.1, psn: 2, heavy: 'envenom', col: '#8dff6a' });
  W('claw', '抓取爪', 4, '18 伤害。重击抓住面前的小型敌人举着当盾牌（挡子弹，最多 3 秒），再按右键扔出去，砸中吃 40；首领和精英抓不动，改成 ×2 一下', { dmg: 18, cd: 0.42, range: 20, arc: 1.0, mode: 'grab', heavy: 'grab', col: '#ffb020' });
  Object.assign(D.CARD_SHAPE, { whip: [2, 2], riot: [2, 3], scythe: [4, 2], nunchaku: [2, 1], chakram: [2, 2], pile: [4, 2], flameblade: [4, 1], icepick: [3, 1], magnet: [3, 2], lance: [5, 1], bloodblade: [4, 1], timeblade: [4, 1], blasthammer: [3, 2], toxblade: [2, 1], claw: [3, 2] });

  // ── 2. 图
  Object.assign(D.ITEM_ART, {
    m_whip: p => { p.box(2, 21, 6, 5, R.cloth, { r: 1 }); for (let i = 0; i < 9; i++) { const x = 8 + i * 2, y = 21 - Math.round(Math.sin(i * 0.8) * 5) - i; p.rect(x, y, 2, 2, i % 2 ? '#a3b6dc' : '#d9a85a'); } p.px(25, 9, '#ffe9b0', 1); },
    m_riot: p => { p.box(5, 2, 18, 24, R.blue, { r: 3 }); p.rect(8, 6, 12, 5, '#c4dcff', 1); p.rect(7, 15, 14, 1, '#20263b'); p.rect(7, 19, 14, 1, '#20263b'); p.rect(12, 22, 4, 2, '#e3c14a'); },
    m_scythe: p => { p.line(6, 26, 14, 4, '#8c5d3c'); p.line(7, 26, 15, 4, '#4a2f1f'); p.line(14, 4, 25, 6, '#dbe5fa', 1); p.line(15, 5, 26, 9, '#a3b6dc'); p.line(25, 6, 26, 11, '#dbe5fa', 1); p.rect(12, 4, 4, 3, R.dark[4]); },
    m_nunchaku: p => { p.box(3, 14, 4, 11, R.red, { r: 1 }); p.box(19, 3, 4, 11, R.red, { r: 1 }); p.line(6, 14, 12, 9, '#c8cdda'); p.line(12, 9, 19, 9, '#c8cdda'); p.rect(3, 14, 4, 1, '#ffd84a'); p.rect(19, 13, 4, 1, '#ffd84a'); },
    m_chakram: p => { p.ell(14, 14, 10, 10, R.silver, { spec: true }); p.ell(14, 14, 5, 5, R.dark); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; p.px(14 + Math.round(Math.cos(a) * 11), 14 + Math.round(Math.sin(a) * 11), '#3ee8ff', 1); } },
    m_pile: p => { p.box(2, 7, 16, 14, R.gunmetal, { r: 2 }); p.rect(18, 12, 9, 4, '#dbe5fa'); p.rect(25, 13, 2, 2, '#ffffff'); p.rect(4, 10, 10, 2, '#ff7a2e', 1); p.box(5, 20, 6, 6, R.dark); for (let i = 0; i < 3; i++) p.rect(6 + i * 4, 15, 2, 4, '#3d4766'); },
    m_flameblade: p => { p.line(6, 22, 24, 4, '#ffb057', 1); p.line(7, 22, 25, 4, '#ff5a2e', 1); p.line(7, 21, 23, 5, '#ffe9b0', 1); p.rect(3, 21, 5, 3, R.dark[4]); p.line(1, 26, 4, 23, '#5e3d36'); p.px(18, 8, '#ffd84a', 1); p.px(22, 4, '#ffd84a', 1); },
    m_icepick: p => { p.line(5, 25, 17, 8, '#5e3d36'); p.line(6, 25, 18, 8, '#3b2018'); p.line(12, 5, 24, 10, '#9fe9ff', 1); p.line(12, 6, 23, 11, '#e6fbff', 1); p.line(12, 5, 9, 3, '#c8cdda'); p.rect(15, 7, 3, 3, '#949fb6'); },
    m_magnet: p => { p.line(13, 26, 13, 13, '#5e3d36'); p.line(14, 26, 14, 13, '#3b2018'); p.box(3, 4, 22, 10, R.magenta, { r: 2 }); p.rect(3, 4, 5, 10, '#c8cdda'); p.rect(20, 4, 5, 10, '#c8cdda'); p.rect(9, 7, 10, 2, '#ffb3d4', 1); },
    m_lance: p => { p.line(2, 26, 24, 4, '#c8cdda'); p.line(3, 26, 25, 4, '#949fb6'); p.line(22, 4, 27, 1, '#ffffff'); p.box(5, 19, 6, 6, R.gold, { r: 2 }); p.line(4, 26, 7, 23, '#e3c14a'); },
    m_bloodblade: p => { p.line(6, 22, 24, 4, '#dbe5fa'); p.line(7, 22, 25, 4, '#a3b6dc'); p.line(8, 21, 22, 7, '#ff3047', 1); p.rect(3, 20, 5, 4, R.red[2]); p.ell(5, 24, 2, 2, R.red, { spec: true }); },
    m_timeblade: p => { p.line(6, 22, 24, 4, '#c4b0ff', 1); p.line(7, 22, 25, 4, '#7a4ad8'); p.line(7, 21, 23, 5, '#ffffff', 1); p.ell(5, 22, 3, 3, R.gold, { spec: true }); p.px(5, 21, '#0b0a14'); p.px(5, 22, '#0b0a14'); },
    m_blasthammer: p => { p.line(13, 26, 13, 13, '#5e3d36'); p.line(14, 26, 14, 13, '#3b2018'); p.box(3, 3, 22, 11, R.red, { r: 2 }); p.rect(22, 4, 3, 9, '#949fb6'); p.rect(6, 6, 2, 5, '#ffd84a', 1); p.rect(10, 6, 2, 5, '#ffd84a', 1); p.rect(1, 6, 2, 5, '#3d4766'); },
    m_toxblade: p => { p.line(6, 22, 20, 8, '#dbe5fa'); p.line(7, 22, 21, 8, '#6f84b3'); p.line(8, 20, 19, 9, '#8dff6a', 1); p.rect(3, 21, 5, 3, R.green[1]); p.px(21, 7, '#8dff6a', 1); p.px(18, 12, '#8dff6a', 1); },
    m_claw: p => { p.box(3, 12, 12, 10, R.copper, { r: 2 }); for (let i = 0; i < 3; i++) { p.line(14, 12 + i * 4, 22, 9 + i * 5, '#c8cdda'); p.line(22, 9 + i * 5, 25, 12 + i * 5, '#dbe5fa'); } p.rect(5, 15, 6, 2, '#ffb020', 1); p.rect(2, 21, 6, 4, '#3d4766'); },
  });

  // ── 3. 普攻的效果
  const inArc = (S, m, e, extraR, extraA) => { const p = S.player, dx = e.x - p.x, dy = (e.y - 4) - (p.y - 6); return Math.hypot(dx, dy) < D.mRange(m) + (extraR || 0) + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < D.mArc(m) + (extraA || 0); };
  const mm0 = K.meleeMul; K.meleeMul = function (S, m) {
    let k = mm0 ? mm0(S, m) : 1; const p = S.player;
    if (m.scythe) { const n = alive(S).filter(e => inArc(S, m, e)).length; if (n > 1) { k *= 1 + 0.15 * (n - 1); text(S, p.x, p.y - 32, 'x' + n, m.col); } }
    if (m.lance) k *= p.dashT > 0 ? 2.5 : 1 + Math.min(1, Math.hypot(p.vx, p.vy) / (p.speed || 92));
    if (m.chakram && p.chakOut) k *= 6 / m.dmg;
    if (m.nun) { p.nunN = S.t - (p.nunT || -9) < 0.6 + m.cd ? Math.min(30, (p.nunN || 0) + 1) : 0; p.nunT = S.t; }
    return k;
  };
  K.meleeOnHit = function (S, m, e, dmg, nth) {
    const p = S.player;
    if (m.whip && !e.dead && !isBig(e)) { const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; if (d > 24) { e.vx = dx / d * Math.min(420, d * 7); e.vy = dy / d * Math.min(420, d * 7); e.stun = Math.max(e.stun || 0, 0.3); } }
    if (m.flame && !e.dead) { if (e.burnT > 0 && e.ignT !== S.t) { e.burnT = 0; e.ignT = S.t; text(S, e.x, e.y - 30, 'IGNITE', P.o, true); K.explode(S, e.x, e.y, 30, 30); } else e.burnT = Math.max(e.burnT || 0, 3); }
    if (m.blood) { p.hp = Math.min(p.maxHp, p.hp + 2); if (!nth) text(S, p.x, p.y - 24, '+2', P.g); }
    if (m.blast && !nth) { const x = e.x, y = e.y; K.explode(S, x, y, 22, 10); }
    if (m.nun && (p.nunN || 0) >= 10 && K.capGain) K.capGain(S, 0.015);
  };
  const sw0 = K.meleeSwing; K.meleeSwing = function (S, m, heavy, hits, kills) {
    if (sw0) sw0(S, m, heavy, hits, kills);
    const p = S.player;
    if (m.nun) { p.meleeCd = m.cd * (1 - 0.04 * Math.min(10, p.nunN || 0)); if ((p.nunN || 0) === 10) text(S, p.x, p.y - 34, 'COMBO 10', m.col, true); }
    if (m.magnet) for (const s of S.eshots) { const dx = s.x - p.x, dy = s.y - (p.y - 6); if (Math.hypot(dx, dy) < 50 && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < 1.6) { s.life = 0; part(S, 'spark', s.x, s.y, -dx * 3, -dy * 3, 0.25, m.col); } }
    if (m.whip) S.beams.push({ x0: p.x, y0: p.y - 8, x1: p.x + Math.cos(p.aim) * D.mRange(m), y1: p.y - 8 + Math.sin(p.aim) * D.mRange(m), t: 0.12, max: 0.12, col: m.col });
  };

  // ── 4. 招牌重击
  const H = M.HEAVY, fxs = M.fxs, mhit = M.mhit;
  const cres = (S, m, a, arc, r, w) => fxs(S).push({ k: 'cres', x: S.player.x, y: S.player.y - 6, a, arc, r, dir: S.player.swingDir, t: 0.16, max: 0.16, col: m.col, w: w || 1.6 });
  const front = (S, m, er, ea) => alive(S).filter(e => inArc(S, m, e, er, ea));
  Object.assign(H, {
    lash(S, m, pw) {
      const p = S.player, a = p.aim; let tgt = null, bd = 130;
      for (const e of alive(S)) { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d < bd && d > 14 && Math.abs(D.angDiff(a, Math.atan2(dy, dx))) < 0.3 && D.losClear(S.A, p.x, p.y - 6, e.x, e.y - 6)) { bd = d; tgt = e; } }
      if (!tgt) { S.beams.push({ x0: p.x, y0: p.y - 8, x1: p.x + Math.cos(a) * 100, y1: p.y - 8 + Math.sin(a) * 100, t: 0.18, max: 0.18, col: m.col }); sfx('swing'); return; }
      const ta = Math.atan2(tgt.y - p.y, tgt.x - p.x), d = Math.max(0, Math.min(M.freeDist(S, p.x, p.y, ta, bd), bd - tgt.r - 10));
      M.dashTo(S, ta, Math.max(6, d), 700, 0.15); tgt.stun = Math.max(tgt.stun || 0, 0.6);
      p.mAct = { k: 'lash', t: 0, dur: p.dashT, m, pw, tgt }; sfx('lunge');
    },
    reap(S, m, pw) {
      const p = S.player; let n = 0;
      for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < 38 + e.r) { n++; if (!isBoss(e) && e.hp <= e.maxHp * 0.4) { hurt(S, e, e.hp + (e.shield || 0) + 1, { kx: e.x - p.x, ky: e.y - p.y, kb: 120, col: m.col, crit: true, melee: true, slash: true }); text(S, e.x, e.y - 32, 'REAP', m.col, true); M.onKill(S); } else mhit(S, m, e, pw * 1.5, { kx: e.x - p.x, ky: e.y - p.y, kb: 140, crit: true }); }
      fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: p.aim, arc: Math.PI, r: 38, dir: 1, t: 0.2, max: 0.2, col: m.col, w: 2 });
      addShake(S, 0.3 + n * 0.05); flashLight(S, p.x, p.y - 6, 80, m.col, 1.2); sfx(n ? 'crit' : 'swing'); if (n) S.stop = Math.max(S.stop, 0.08);
    },
    flurry(S, m, pw) { const p = S.player; p.mAct = { k: 'flurry', t: 0, n: 0, next: 0, m, pw }; p.meleeCd = 1.0; },
    throw(S, m, pw) {
      const p = S.player, I = D.Input; if (p.chakOut) return;
      const a = p.aim, go = Math.max(40, Math.min(150, Math.hypot(I.wx - p.x, I.wy - p.y)));
      (S.mproj = S.mproj || []).push({ k: 'chak', x: p.x, y: p.y - 6, a, go, d: 0, back: false, hit: new Set(), dmg: pw * 1.2, m, spin: 0, life: 4 });
      p.chakOut = true; sfx('throw');
    },
    pile(S, m, pw) {
      const p = S.player, a = p.aim, L = 72, x0 = p.x + Math.cos(a) * 8, y0 = p.y - 6 + Math.sin(a) * 8;
      let end = L; for (let d = 0; d < L; d += 4) if (D.solidAt(S.A, x0 + Math.cos(a) * d, y0 + Math.sin(a) * d + 6)) { end = d; hitWall(S, x0 + Math.cos(a) * d, y0 + Math.sin(a) * d + 6, pw * 4); break; }
      let n = 0; for (const e of alive(S)) { const dx = e.x - x0, dy = e.y - 6 - y0, along = dx * Math.cos(a) + dy * Math.sin(a), perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)); if (along > -4 && along < end + e.r && perp < e.r + 6) { n++; mhit(S, m, e, pw, { kx: Math.cos(a), ky: Math.sin(a), kb: 260, crit: true, noShield: true }); } }
      fxs(S).push({ k: 'iline', x0, y0, x1: x0 + Math.cos(a) * end, y1: y0 + Math.sin(a) * end, t: 0.25, max: 0.25, col: m.col, boom: true });
      M.scar(S, x0, y0 + 6, x0 + Math.cos(a) * end, y0 + Math.sin(a) * end + 6, m.col);
      p.vx -= Math.cos(a) * 140; p.vy -= Math.sin(a) * 140; addShake(S, 0.6); S.stop = Math.max(S.stop, n ? 0.12 : 0.05); flashLight(S, x0, y0, 90, m.col, 1.5); sfx('heavy'); sfx('slam');
    },
    firewall(S, m, pw) {
      const p = S.player, a = p.aim, x0 = p.x + Math.cos(a) * 14, y0 = p.y + Math.sin(a) * 14, d = Math.max(16, M.freeDist(S, x0, y0, a, 72));
      (S.fwalls = S.fwalls || []).push({ x0, y0, x1: x0 + Math.cos(a) * d, y1: y0 + Math.sin(a) * d, t: 3, tick: 0, f: S.f, pw });
      flashLight(S, x0, y0, 80, P.o, 1.2); addShake(S, 0.2); sfx('fire');
    },
    icespike(S, m, pw) {
      const p = S.player, a = p.aim, d = Math.max(16, M.freeDist(S, p.x, p.y, a, 72)), hit = new Set();
      for (let s = 10; s <= d; s += 8) {
        const x = p.x + Math.cos(a) * s, y = p.y + Math.sin(a) * s;
        (S.spikes = S.spikes || []).push({ x, y, t: 0.6 + s * 0.004, max: 0.6 + s * 0.004, f: S.f });
        for (const e of alive(S)) if (!hit.has(e) && Math.hypot(e.x - x, e.y - y) < e.r + 9) { hit.add(e); mhit(S, m, e, pw * 1.5, { kx: Math.cos(a), ky: Math.sin(a), kb: 40, ice: 3 }); }
      }
      flashLight(S, p.x, p.y, 70, m.col, 1); addShake(S, 0.25); sfx('cool');
    },
    magstorm(S, m, pw) {
      const p = S.player, fx = p.x + Math.cos(p.aim) * 18, fy = p.y + Math.sin(p.aim) * 18, pulled = [];
      for (const e of alive(S)) { const dx = fx - e.x, dy = fy - e.y, d = Math.hypot(dx, dy) || 1; if (d < 90 && !isBig(e)) { e.vx = dx / d * Math.min(700, d * 9); e.vy = dy / d * Math.min(700, d * 9); e.stun = Math.max(e.stun || 0, 0.5); pulled.push(e); } }
      for (const s of S.eshots) if (Math.hypot(s.x - p.x, s.y - p.y) < 90) s.life = 0;
      p.mAct = { k: 'magnet', t: 0, m, pw, fx, fy, pulled }; ring(S, p.x, p.y - 6, 90, m.col); flashLight(S, p.x, p.y - 6, 100, m.col, 1.3); sfx('charge2');
    },
    charge3(S, m, pw) { const p = S.player; p.mAct = { k: 'charge3', t: 0, n: 0, next: 0, m, pw, hit: new Set() }; p.meleeCd = 0.9; },
    bloodcut(S, m, pw) {
      const p = S.player, cost = Math.min(10, Math.max(0, p.hp - 1)); p.hp -= cost; text(S, p.x, p.y - 26, '-' + cost, P.r);
      let n = 0; for (const e of front(S, m, 6, 0.3)) { n++; mhit(S, m, e, pw * 5, { kx: e.x - p.x, ky: e.y - p.y, kb: 200, crit: true }); }
      cres(S, m, p.aim, D.mArc(m) + 0.3, D.mRange(m) + 8, 2.4); flashLight(S, p.x, p.y - 6, 90, P.r, 1.5); addShake(S, 0.4); if (n) S.stop = Math.max(S.stop, 0.1); sfx('crit');
    },
    stasis(S, m, pw) {
      const p = S.player;
      if ((p.stasisCd || 0) > S.t) { for (const e of front(S, m, 6, 0.3)) mhit(S, m, e, pw * 2, { kx: e.x - p.x, ky: e.y - p.y, kb: 160 }); cres(S, m, p.aim, D.mArc(m) + 0.3, D.mRange(m) + 6); text(S, p.x, p.y - 30, Math.ceil(p.stasisCd - S.t) + 's', P[4]); sfx('swing'); return; }
      S.stasis = { x: p.x, y: p.y, r: 60, t: 3 }; p.stasisCd = S.t + 8; text(S, p.x, p.y - 32, 'STASIS', m.col, true); flashLight(S, p.x, p.y - 6, 110, m.col, 1.4); addShake(S, 0.2); sfx('power');
    },
    rjump(S, m, pw) {
      const p = S.player, a = p.aim, d = Math.max(16, M.freeDist(S, p.x, p.y, a, 80)), x0 = p.x, y0 = p.y;
      K.explode(S, x0, y0, 26, Math.round(pw * 0.8));
      M.dashTo(S, a, d, d / 0.3, 0.12); p.mAct = { k: 'rjump', t: 0, dur: 0.3, m, pw };
      for (let i = 0; i < 10; i++) part(S, 'smoke', x0, y0, S.rng.range(-30, 30), S.rng.range(-30, 0), 0.7, '#5a5060');
    },
    envenom(S, m, pw) {
      const p = S.player; for (const e of front(S, m, 6, 0.3)) { mhit(S, m, e, pw * 1.2, { kx: e.x - p.x, ky: e.y - p.y, kb: 60 }); K.addPsn(S, e, 8); text(S, e.x, e.y - 30, 'VENOM', m.col, true); }
      cres(S, m, p.aim, D.mArc(m) + 0.3, D.mRange(m) + 6); sfx('crit');
    },
    grab(S, m, pw) {
      const p = S.player; let tgt = null, bd = D.mRange(m) + 14;
      for (const e of alive(S)) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x))) < 0.9) { bd = d; tgt = e; } }
      if (!tgt) { cres(S, m, p.aim, 0.6, D.mRange(m) + 6); sfx('swing'); return; }
      if (isBig(tgt)) { mhit(S, m, tgt, pw * 2, { kx: tgt.x - p.x, ky: tgt.y - p.y, kb: 120, crit: true }); text(S, tgt.x, tgt.y - 30, 'TOO BIG', P[4]); return; }
      p.held = tgt; p.heldT = 3; tgt.held = true; text(S, tgt.x, tgt.y - 30, 'GRAB', m.col, true); sfx('pick'); S.stop = Math.max(S.stop, 0.05);
    },
  });

  // ── 5. 右键的特殊用法（station.js 调）
  function std(S, mel, inp) { // 和 station.js 的默认一样：点一下普攻，按住蓄满松开重击
    const p = S.player;
    if (inp.melee) { if (p.meleeCd <= 0 && p.dashT <= 0) K.melee(S, mel); p.charging = true; p.chargeT = 0; }
    chargeTick(S, mel, inp, true);
  }
  function chargeTick(S, mel, inp, fire) {
    const p = S.player; if (!p.charging) return;
    if (inp.meleeHeld) { const was = p.chargeT; p.chargeT += S.dt || 1 / 60; if (was < D.TUNE.chargeT && p.chargeT >= D.TUNE.chargeT) { sfx('chargeup'); ring(S, p.x, p.y - 6, 14, P.O); } }
    else { if (fire && p.chargeT >= D.TUNE.chargeT && p.dashT <= 0) K.melee(S, mel, true); p.charging = false; p.chargeT = 0; }
  }
  K.meleeInput = function (S, mel, inp, dt) {
    const p = S.player; S.dt = dt;
    if (mel.mode === 'shield') {
      if (inp.melee) { p.shPress = S.t; p.blocking = false; }
      if (inp.meleeHeld && p.shPress != null) { if (S.t - p.shPress > 0.15) p.blocking = true; }
      else if (p.shPress != null) { if (!p.blocking && p.meleeCd <= 0 && p.dashT <= 0) K.melee(S, mel); p.shPress = null; p.blocking = false; }
      return;
    }
    if (mel.mode === 'pile') {
      if (inp.melee) { p.charging = true; p.chargeT = 0; }
      if (p.charging && !inp.meleeHeld && p.chargeT < D.TUNE.chargeT) { text(S, p.x, p.y - 28, 'HOLD', P[4]); }
      if (p.charging && !inp.meleeHeld && p.meleeCd > 0) { p.charging = false; p.chargeT = 0; return; }
      chargeTick(S, mel, inp, true); return;
    }
    if (mel.mode === 'lance' && inp.melee && p.dashT > 0 && p.meleeCd <= 0) { K.melee(S, mel); text(S, p.x, p.y - 30, 'THRUST', mel.col); return; }
    if (mel.mode === 'grab' && p.held) {
      if (inp.melee) { const e = p.held; p.held = null; e.held = false; K.fling(S, e, p.aim, 520, 40, mel.col); hurt(S, e, 6, { kx: Math.cos(p.aim), ky: Math.sin(p.aim), kb: 0, col: mel.col, melee: true }); p.meleeCd = 0.4; text(S, p.x, p.y - 30, 'THROW', mel.col); sfx('throw'); }
      return;
    }
    std(S, mel, inp);
  };

  // ── 6. 每帧（melee.js 的 meleeStep 之后：A.t 那边已经加过了）
  const step0 = K.meleeStep; K.meleeStep = function (S, dt) {
    if (step0) step0(S, dt);
    const p = S.player, A = p.mAct, L = S.raid.load, mid = D.melId(S.raid), mel = mid && D.CARDS[mid].melee, blood = D.WSLOTS.some(k => D.isMel(L[k]) && D.CARDS[L[k]].melee.blood); // 两个槽哪个装着嗜血刃都算
    // 嗜血刃：装着时耐久上限 -20%
    if (blood && !p.bloodOn) { p.bloodOn = true; p.maxHp = Math.round(p.maxHp * 0.8); p.hp = Math.min(p.hp, p.maxHp); }
    else if (p.bloodOn && !blood) { p.bloodOn = false; p.maxHp = Math.round(p.maxHp / 0.8); }
    if (p.blocking) {
      p.spdMul = (p.spdMul || 1) * 0.55;
      for (const s of S.eshots) { const dx = s.x - p.x, dy = s.y - (p.y - 6); if (s.life > 0 && Math.hypot(dx, dy) < 16 && Math.abs(D.angDiff(p.aim, Math.atan2(dy, dx))) < 1.2) { s.life = 0; p.shc = Math.min(1, (p.shc || 0) + 0.2); for (let i = 0; i < 4; i++) part(S, 'spark', s.x, s.y, S.rng.range(-60, 60), S.rng.range(-60, 20), 0.2, '#c4dcff'); sfx('ding'); } }
      if (p.shc >= 1) { p.shc = 0; for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < 44 + e.r) hurt(S, e, Math.round(M.power(S, mel)), { kx: e.x - p.x, ky: e.y - p.y, kb: 280, col: '#7fb3ff', melee: true }); ring(S, p.x, p.y - 6, 46, '#7fb3ff'); ring(S, p.x, p.y - 6, 30, P.C); addShake(S, 0.4); flashLight(S, p.x, p.y - 6, 90, '#7fb3ff', 1.3); text(S, p.x, p.y - 32, 'REPEL', '#7fb3ff', true); sfx('slam'); }
    }
    if (p.held) {
      const e = p.held; p.heldT -= dt;
      if (e.dead || p.heldT <= 0 || !(mel && mel.mode === 'grab')) { if (!e.dead) { e.held = false; e.stun = Math.max(e.stun || 0, 0.4); } p.held = null; }
      else { const hx = p.x + Math.cos(p.aim) * 14, hy = p.y + Math.sin(p.aim) * 12; if (!D.solidAt(S.A, hx, hy)) { e.x = hx; e.y = hy; } e.vx = e.vy = 0; e.stun = Math.max(e.stun || 0, 0.2);
        for (const s of S.eshots) if (s.life > 0 && Math.hypot(s.x - e.x, s.y - (e.y - 6)) < e.r + 4) { s.life = 0; hurt(S, e, s.dmg || 4, { kx: s.vx, ky: s.vy, kb: 0, col: P.r }); } }
    }
    if (A) {
      const m = A.m;
      if (A.k === 'lash') {
        if (A.t >= A.dur || p.dashT <= 0) { for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < 28 + e.r) mhit(S, m, e, A.pw * 1.5, { kx: e.x - p.x, ky: e.y - p.y, kb: 160 }); fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: p.aim, arc: Math.PI, r: 28, dir: 1, t: 0.18, max: 0.18, col: m.col, w: 1.8 }); addShake(S, 0.3); sfx('heavy'); p.mAct = null; }
      } else if (A.k === 'flurry') {
        if (A.t >= A.next && A.n < 12) { A.n++; A.next += 0.075; p.swingDir *= -1; p.swingT = 0.1; let h = 0; for (const e of front(S, m, 10, 0.3)) { h++; mhit(S, m, e, A.pw * 0.6, { kx: e.x - p.x, ky: e.y - p.y, kb: 1 }); } cres(S, m, p.aim + S.rng.range(-0.3, 0.3), D.mArc(m), D.mRange(m) + 2, 1); sfx(h ? 'hit' : 'swing'); }
        if (A.n >= 12) p.mAct = null;
      } else if (A.k === 'magnet') {
        if (A.t >= 0.3) { for (const e of alive(S)) if (Math.hypot(e.x - A.fx, e.y - A.fy) < 34 + e.r) { mhit(S, m, e, A.pw * 2, { kx: e.x - p.x, ky: e.y - p.y, kb: 200, crit: true }); e.stun = Math.max(e.stun || 0, 0.8); } ring(S, A.fx, A.fy, 36, m.col); M.crack(S, A.fx, A.fy, 20); addShake(S, 0.5); S.stop = Math.max(S.stop, 0.08); flashLight(S, A.fx, A.fy - 4, 90, m.col, 1.4); sfx('slam'); p.mAct = null; }
      } else if (A.k === 'charge3') {
        if (A.t >= A.next && A.n < 3 && p.dashT <= 0) { A.n++; A.next = A.t + 0.2; A.hit = new Set(); const d = Math.max(10, M.freeDist(S, p.x, p.y, p.aim, 60)); M.dashTo(S, p.aim, d, 620, 0.08); sfx('lunge'); }
        if (p.dashT > 0) { if (S.t % 0.02 < dt) S.ghosts.push({ x: p.x, y: p.y, t: 0.2, flip: Math.cos(p.aim) < 0, col: m.col }); for (const e of alive(S)) if (!A.hit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 14) { A.hit.add(e); mhit(S, m, e, A.pw * 1.5, { kx: Math.cos(p.aim), ky: Math.sin(p.aim), kb: 140, crit: true }); } }
        if (A.n >= 3 && p.dashT <= 0 && A.t >= A.next) p.mAct = null;
      } else if (A.k === 'rjump') {
        if (A.t >= A.dur) { K.explode(S, p.x, p.y, 34, Math.round(A.pw * 1.6)); M.crack(S, p.x, p.y, 20); for (let i = 0; i < 12; i++) part(S, 'debris', p.x, p.y, S.rng.range(-90, 90), S.rng.range(-60, 20), S.rng.range(0.6, 1), '#6a5a52'); p.mAct = null; }
      }
    }
    // 回旋轮刃
    for (const c of S.mproj || []) {
      c.spin += dt * 25; c.life -= dt;
      if (!c.back) { c.x += Math.cos(c.a) * 340 * dt; c.y += Math.sin(c.a) * 340 * dt; c.d += 340 * dt; if (c.d >= c.go || D.solidAt(S.A, c.x, c.y + 6)) { c.back = true; c.hit.clear(); } }
      else { const dx = p.x - c.x, dy = p.y - 6 - c.y, d = Math.hypot(dx, dy) || 1; c.x += dx / d * 400 * dt; c.y += dy / d * 400 * dt; if (d < 10 || c.life <= 0) { c.life = 0; p.chakOut = false; sfx('draw'); } }
      for (const e of alive(S)) if (!c.hit.has(e) && Math.hypot(e.x - c.x, e.y - 6 - c.y) < e.r + 7) { c.hit.add(e); mhit(S, c.m, e, c.dmg, { kx: e.x - c.x, ky: e.y - c.y, kb: 60 }); }
      if (S.rng.chance(0.5)) part(S, 'spark', c.x, c.y, S.rng.range(-40, 40), S.rng.range(-40, 40), 0.15, c.m.col);
    }
    if (S.mproj) { S.mproj = S.mproj.filter(c => c.life > 0); if (!S.mproj.length && p.chakOut) p.chakOut = false; }
    // 炎刀的火墙、冰镐的冰刺
    for (const w of S.fwalls || []) {
      w.t -= dt; w.tick -= dt; if (w.f !== S.f) continue;
      if (S.rng.chance(0.9)) { const k = S.rng(); part(S, 'spark', D.lerp(w.x0, w.x1, k) + S.rng.range(-3, 3), D.lerp(w.y0, w.y1, k) - 2, S.rng.range(-8, 8), S.rng.range(-60, -25), 0.4, S.rng.pick(['#ff8a2e', '#ffd84a', '#ff3d2e'])); }
      if (w.tick <= 0) { w.tick = 0.25; const ax = w.x1 - w.x0, ay = w.y1 - w.y0, l2 = ax * ax + ay * ay || 1; for (const e of alive(S)) { const k = Math.max(0, Math.min(1, ((e.x - w.x0) * ax + (e.y - w.y0) * ay) / l2)); if (Math.hypot(e.x - (w.x0 + ax * k), e.y - (w.y0 + ay * k)) < e.r + 8) { e.burnT = Math.max(e.burnT || 0, 1.5); hurt(S, e, 2, { dot: true, col: '#ff8a2e' }); } } }
    }
    if (S.fwalls) S.fwalls = S.fwalls.filter(w => w.t > 0);
    for (const s of S.spikes || []) s.t -= dt;
    if (S.spikes) S.spikes = S.spikes.filter(s => s.t > 0);
  };

  // ── 7. 画
  const draw0 = K.meleeDraw; K.meleeDraw = function (S, ctx, ex) {
    if (draw0) draw0(S, ctx, ex);
    const p = S.player, A = p.mAct;
    for (const w of S.fwalls || []) if (w.f === S.f) { const k = Math.min(1, w.t); ex.save(); ex.globalAlpha = 0.5 * k; ex.strokeStyle = '#ff8a2e'; ex.lineWidth = 6; ex.lineCap = 'round'; ex.beginPath(); ex.moveTo(w.x0, w.y0 - 2); ex.lineTo(w.x1, w.y1 - 2); ex.stroke(); ex.globalAlpha = 0.8 * k; ex.strokeStyle = '#ffd84a'; ex.lineWidth = 2; ex.stroke(); ex.restore(); }
    for (const s of S.spikes || []) if (s.f === S.f) { const k = s.t / s.max, h = 10 * Math.min(1, (1 - k) * 4) * Math.min(1, k * 3); ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.moveTo(s.x - 4, s.y); ctx.lineTo(s.x, s.y - h - 1); ctx.lineTo(s.x + 4, s.y); ctx.fill(); ex.fillStyle = '#9fe9ff'; ex.beginPath(); ex.moveTo(s.x - 3, s.y); ex.lineTo(s.x, s.y - h); ex.lineTo(s.x + 3, s.y); ex.fill(); ex.fillStyle = '#e6fbff'; ex.fillRect(s.x - 0.5, s.y - h + 1, 1, h * 0.6); }
    for (const c of S.mproj || []) { ex.save(); ex.translate(c.x, c.y); ex.rotate(c.spin); ex.strokeStyle = c.m.col; ex.lineWidth = 1.5; ex.beginPath(); ex.arc(0, 0, 5, 0, TAU); ex.stroke(); ex.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { ex.rotate(TAU / 4); ex.fillRect(4, -0.75, 3, 1.5); } ex.restore(); }
    if (p.blocking) { ex.save(); ex.strokeStyle = '#7fb3ff'; ex.lineWidth = 2; ex.beginPath(); ex.arc(p.x, p.y - 6, 13, p.aim - 1.1, p.aim + 1.1); ex.stroke(); ex.strokeStyle = D.rgba('#ffffff', 0.4 + 0.6 * (p.shc || 0)); ex.lineWidth = 0.75; ex.stroke(); ex.restore(); }
    if (p.held && !p.held.dead) { const e = p.held; ex.strokeStyle = '#ffb020'; ex.lineWidth = 0.75; ex.strokeRect(e.x - e.r - 2, e.y - e.r * 2 - 3, e.r * 2 + 4, e.r * 2 + 4); }
    if (A && A.k === 'lash' && A.tgt && !A.tgt.dead) S.beams.push({ x0: p.x, y0: p.y - 8, x1: A.tgt.x, y1: A.tgt.y - 6, t: 0.03, max: 0.03, col: A.m.col });
    if (A && A.k === 'magnet') for (const e of A.pulled) if (!e.dead) { ex.strokeStyle = D.rgba(A.m.col, 0.6); ex.lineWidth = 0.75; ex.beginPath(); ex.moveTo(A.fx, A.fy - 6); ex.lineTo(e.x, e.y - 6); ex.stroke(); }
  };
})(D);
