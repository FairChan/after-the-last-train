/* Underdog · 配件 / 改装件扩充（用户 2026-11-17："发挥你的想象，继续制作这些配件之类的，拥有更高更好的效果"）。
   原来的配件和改装件只改数值、最高传说（4）。这里加 16 个枪配件、9 个机器人改装件：数值更高，而且大多带一个"特效"（perk）。
   - 传说（4）：工作台 4 级 + 蓝图能做，和原来的传说件一样掉、一样出蓝图。
   - 红色（5）：做不了，只在传说箱子 / 首领掉的传说件里换出来（约三成）。
   特效怎么接：枪配件看当前枪装着的配件（D.gunAtt），改装件看这趟带出来的改装（S.mods）。
   挂钩：包住 K.shotMul / K.shotHit / K.meleeMul / K.startReload / K.damagePlayer / K.armsPre / K.armsPost、D.recipe、D.Growth.rollGear。
   在 workshop-bp.js 之后加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, K = D.K || (D.K = {}), TUNE = D.GROW_TUNE;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), hurt = (...a) => K.hurt(...a), part = (...a) => K.part(...a);
  const pct = v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  const isBig = e => { const E = D.ENEMIES[e.kind] || {}; return !!(E.boss || E.elite); };

  // ── 1. 表（fx 和原来的一样；perk 是特效）
  const NEW_ATT = {
    dragon:  { slot: 'muzzle', name: '龙息枪口',   q: 4, fx: { dmg: 0.08 }, perk: 'burn' },
    frost:   { slot: 'muzzle', name: '霜冻枪口',   q: 4, fx: { spread: -0.1 }, perk: 'ice' },
    splitter:{ slot: 'muzzle', name: '分裂枪口',   q: 5, fx: { dmg: 0.1, noise: 0.1 }, perk: 'split' },
    tesla:   { slot: 'muzzle', name: '特斯拉枪口', q: 5, fx: { dmg: 0.12, speed: 0.2 }, perk: 'arc' },
    venom:   { slot: 'mag', name: '毒针弹匣',   q: 4, fx: { mag: 0.3 }, perk: 'psn' },
    blastmag:{ slot: 'mag', name: '爆裂弹匣',   q: 4, fx: { mag: 0.2, reload: -0.1 }, perk: 'boom5' },
    recycle: { slot: 'mag', name: '回收弹匣',   q: 5, fx: { mag: 0.6, reload: -0.3 }, perk: 'killreload' },
    hypermag:{ slot: 'mag', name: '超频弹仓',   q: 5, fx: { mag: 0.9, rate: -0.15, reload: -0.2 } },
    weakeye: { slot: 'sight', name: '弱点瞄具',  q: 4, fx: { spread: -0.2 }, perk: 'crit' },
    seeker:  { slot: 'sight', name: '追踪瞄具',  q: 4, fx: { spread: -0.1, life: 0.2 }, perk: 'homing' },
    reaper:  { slot: 'sight', name: '处决瞄具',  q: 5, fx: { spread: -0.25, dmg: 0.1 }, perk: 'exec' },
    xray:    { slot: 'sight', name: 'X 光瞄具',  q: 5, fx: { spread: -0.2, life: 0.3 }, perk: 'pierce' },
    frenzy:  { slot: 'stock', name: '狂热枪托',  q: 4, fx: { bloom: -0.3 }, perk: 'frenzy' },
    dodgest: { slot: 'stock', name: '闪避枪托',  q: 4, fx: { reload: -0.15, bloom: -0.2 }, perk: 'dodgebuff' },
    vamp:    { slot: 'stock', name: '吸血枪托',  q: 5, fx: { bloom: -0.4, spread: -0.1 }, perk: 'vamp' },
    titan:   { slot: 'stock', name: '泰坦枪托',  q: 5, fx: { bloom: -0.6, spread: -0.25, reload: -0.25 } },
  };
  const NEW_RMOD = {
    thorns:  { slot: 'armor', name: '荆棘装甲',   q: 4, fx: { hp: 15 }, perk: 'thorns' },
    regen:   { slot: 'armor', name: '再生装甲',   q: 5, fx: { hp: 30, hurt: -0.1 }, perk: 'regen' },
    phase:   { slot: 'armor', name: '相位护板',   q: 5, fx: { hp: 20, shield0: 20 }, perk: 'phase' },
    arcstep: { slot: 'power', name: '电弧步',     q: 4, fx: { dash: -0.2 }, perk: 'dasharc' },
    twin:    { slot: 'power', name: '双冲引擎',   q: 5, fx: { speed: 0.1, dash: -0.2 }, perk: 'dash2' },
    ocore:   { slot: 'power', name: '过载核心',   q: 5, fx: { cap: 0.5, skill: -0.25 }, perk: 'overcore' },
    scanner: { slot: 'sensor', name: '弱点扫描仪', q: 4, fx: { spread: -0.15 }, perk: 'elite' },
    lootrad: { slot: 'sensor', name: '战利品雷达', q: 4, fx: { search: 0.3 }, perk: 'scav' },
    sentinel:{ slot: 'sensor', name: '哨兵系统',   q: 5, fx: { notice: -0.3, search: 0.2 }, perk: 'counter' },
  };
  const PERK = {
    burn: '命中点燃 2 秒', ice: '命中 30% 叠 1 层冻结', split: '每发 30% 多射出一发', arc: '命中 25% 跳一道电弧，打附近的敌人 10',
    psn: '命中叠 1 层中毒', boom5: '每第 5 次命中引发小爆炸（14 伤害）', killreload: '用枪杀敌后，下次换弹瞬间完成',
    crit: '15% 暴击，伤害 ×2', homing: '子弹会拐向附近的敌人', exec: '打耐久 30% 以下的敌人伤害 +60%', pierce: '子弹穿透敌人',
    frenzy: '连续命中每次伤害 +2%，最多 +40%；2 秒没打中清零', dodgebuff: '闪避后 2 秒内枪的伤害 +30%', vamp: '子弹伤害的 5% 转成耐久',
    thorns: '挨打时 40 像素内的敌人吃 12 伤害', regen: '3 秒没挨打，每秒回 3% 耐久', phase: '每 12 秒自动挡掉一次伤害',
    dasharc: '闪避穿过的敌人吃 14 电击并停摆 0.5 秒', dash2: '闪避可以连用两次', overcore: '电容充满时伤害 +25%、移速 +10%',
    elite: '打精英和首领伤害 +25%', scav: '容器里多一件东西的几率 25%', counter: '挨打时 35% 朝最近的敌人放电弧（18 伤害）',
  };
  const ATT_LABEL = { dmg: '伤害', spread: '散布', bloom: '连射变散', mag: '弹匣', reload: '换弹时间', rate: '射击间隔', speed: '弹速', life: '射程', noise: '枪声' };
  const RM_LABEL = { hp: '耐久上限', hurt: '受到伤害', shield0: '进站护盾', speed: '移速', dash: '闪避冷却', cap: '电容充能', skill: '技能冷却', search: '搜容器速度', notice: '被发现的速度', spread: '散布', noise: '开枪的警戒' };
  for (const k in NEW_ATT) if (!D.ATT[k]) { const A = D.ATT[k] = NEW_ATT[k]; A.desc = Object.entries(A.fx).map(([f, v]) => ATT_LABEL[f] + ' ' + pct(v)).join('、') + (A.perk ? '；特效：' + PERK[A.perk] : ''); }
  for (const k in NEW_RMOD) if (!D.RMOD[k]) { const M = D.RMOD[k] = NEW_RMOD[k]; M.desc = Object.entries(M.fx).map(([f, v]) => RM_LABEL[f] + ' ' + (f === 'hp' || f === 'shield0' ? '+' + v : pct(v))).join('、') + (M.perk ? '；特效：' + PERK[M.perk] : ''); }
  D.GEAR_PERK = PERK;
  // 红色件的价值；红色件做不了（没有配方）
  if (TUNE.gearV.length < 6) TUNE.gearV[5] = 1800;
  if (TUNE.craftMoney.length < 6) TUNE.craftMoney[5] = 2600;
  const rc0 = D.recipe; D.recipe = k => { const G = D.ATT[k] || D.RMOD[k]; return G && G.q >= 5 ? { money: TUNE.craftMoney[5], mats: [], q: 5, needBp: true, find: true } : rc0(k); };
  const cc0 = D.canCraft; D.canCraft = (pf, k) => { const G = D.ATT[k] || D.RMOD[k]; return G && G.q >= 5 ? 'no' : cc0(pf, k); };

  // ── 2. 掉落：传说件有三成换成红色件
  const roll0 = D.Growth.rollGear;
  D.Growth.rollGear = function (rng, q, C) {
    const r = roll0(rng, q, C); if (!r || q < 4) return r;
    const m = /^(att|rmod):(.+)$/.exec(r.id); if (!m) return r;
    const T = m[1] === 'att' ? D.ATT : D.RMOD; if (!T[m[2]] || T[m[2]].q !== 4 || !rng.chance(0.3)) return r;
    const pool = Object.keys(D.ATT).filter(k => D.ATT[k].q === 5).map(k => 'att:' + k).concat(Object.keys(D.RMOD).filter(k => D.RMOD[k].q === 5).map(k => 'rmod:' + k));
    return { id: rng.pick(pool), n: 1 };
  };

  // ── 3. 这趟装着哪些特效（不缓存：顿帧时 S.t 不走，换了装备会拿到旧的）
  function perks(S) {
    const R = S.raid, out = new Set();
    if (R && R.pf && R.load && D.gunId(R) && D.gunAtt) { const a = D.gunAtt(R.pf, D.gunId(R)) || {}; for (const s in a) { const A = D.ATT[a[s]]; if (A && A.perk) out.add(A.perk); } }
    for (const k of Object.values(S.mods || {})) { const M = D.RMOD[k]; if (M && M.perk) out.add(M.perk); }
    return out;
  }
  D.gearPerks = perks;

  // ── 4. 伤害倍数
  const sm0 = K.shotMul; K.shotMul = function (S, s, e) {
    let m = sm0 ? sm0(S, s, e) : 1; const pk = perks(S); if (!pk.size) return m; const p = S.player;
    if (pk.has('crit') && s && s.hit) { p.critAcc = (p.critAcc || 0) + 0.15; if (p.critAcc >= 1) { p.critAcc -= 1; m *= 2; text(S, e.x, e.y - 30, 'CRIT', P.R); } } // 15%：累计到 1 就暴击一次（站里的随机数按帧走，直接掷会和开枪节奏对上，一次都不出）
    if (pk.has('exec') && e.hp <= e.maxHp * 0.3) m *= 1.6;
    if (pk.has('frenzy')) m *= 1 + 0.02 * (p.fren || 0);
    if (pk.has('dodgebuff') && S.t < (p.dodgeUntil || -9) + 2) m *= 1.3;
    if (pk.has('overcore') && p.cap >= 1) m *= 1.25;
    if (pk.has('elite') && isBig(e)) m *= 1.25;
    return m;
  };
  const mm0 = K.meleeMul; K.meleeMul = function (S, m) {
    let k = mm0 ? mm0(S, m) : 1; const pk = perks(S), p = S.player;
    if (pk.has('overcore') && p.cap >= 1) k *= 1.25;
    return k;
  };
  const mh0 = K.meleeOnHit; K.meleeOnHit = function (S, m, e, dmg, nth) { if (mh0) mh0(S, m, e, dmg, nth); if (perks(S).has('elite') && isBig(e) && !e.dead) hurt(S, e, Math.round(dmg * 0.25), { dot: true, col: P.R }); };

  // ── 5. 子弹打中
  const hit0 = K.shotHit; K.shotHit = function (S, s, e) {
    if (hit0) hit0(S, s, e);
    const pk = perks(S); if (!pk.size || s.ally) return; const p = S.player;
    if (pk.has('frenzy')) { p.fren = Math.min(20, (p.fren || 0) + 1); p.frenT = S.t; }
    if (pk.has('vamp') && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + (s.dmg || 0) * 0.05);
    if (pk.has('killreload') && e.dead) p.instaR = true;
    if (pk.has('boom5')) { p.hitN = (p.hitN || 0) + 1; if (p.hitN % 5 === 0) K.explode(S, e.x, e.y, 20, 14); }
    if (e.dead) return;
    if (pk.has('burn')) e.burnT = Math.max(e.burnT || 0, 2);
    if (pk.has('ice') && S.rng.chance(0.3) && K.addIce) K.addIce(S, e, 1);
    if (pk.has('psn') && K.addPsn) K.addPsn(S, e, 1);
    if (pk.has('arc') && S.rng.chance(0.25)) {
      let best = null, bd = 80; for (const o of S.enemies) if (o !== e && !o.dead && o.f === S.f) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
      if (best) { S.bolts.push({ pts: K.zig(S, e.x, e.y - 6, best.x, best.y - 6), t: 0.18 }); hurt(S, best, 10, { kx: best.x - e.x, ky: best.y - e.y, kb: 30, col: P.c, elec: true }); sfx('zap'); }
    }
  };
  const sr0 = K.startReload; K.startReload = function (S, gun) {
    sr0(S, gun); const p = S.player;
    if (p.instaR && p.reload > 0) { p.instaR = false; p.reload = 0.02; text(S, p.x, p.y - 28, 'QUICK', P.c); }
  };

  // ── 6. 挨打：相位、荆棘、哨兵
  const dp0 = K.damagePlayer; K.damagePlayer = function (S, dmg, src) {
    const p = S.player, pk = perks(S);
    if (pk.has('phase') && dmg > 0 && p.inv <= 0 && S.t >= (p.phaseT || 0) && !S.over) { p.phaseT = S.t + 12; ring(S, p.x, p.y - 6, 18, P.v); text(S, p.x, p.y - 30, 'PHASE', P.v, true); sfx('shield'); S.attackedAt = S.t; return; }
    const h0 = p.hp + (p.shield || 0); dp0(S, dmg, src);
    if (p.hp + (p.shield || 0) >= h0 || !pk.size) return;
    if (pk.has('thorns')) { let n = 0; for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - p.x, e.y - p.y) < 40 + e.r) { n++; hurt(S, e, 12, { kx: e.x - p.x, ky: e.y - p.y, kb: 80, col: P.g }); } if (n) ring(S, p.x, p.y - 6, 40, P.g); }
    if (pk.has('counter') && S.rng.chance(0.35)) {
      let best = null, bd = 140; for (const e of S.enemies) if (!e.dead && e.f === S.f) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
      if (best) { S.bolts.push({ pts: K.zig(S, p.x, p.y - 8, best.x, best.y - 6), t: 0.22 }); hurt(S, best, 18, { kx: best.x - p.x, ky: best.y - p.y, kb: 40, col: P.c, elec: true }); text(S, p.x, p.y - 30, 'COUNTER', P.c); sfx('zap'); }
    }
  };

  // ── 7. 每帧：再生、电弧步、双冲、过载核心、狂热清零、拾荒；新子弹的分裂 / 追踪 / 穿透
  const pre0 = K.armsPre; K.armsPre = function (S, dt, inp, gun) {
    if (pre0) pre0(S, dt, inp, gun);
    const pk = perks(S), p = S.player; if (!pk.size || p.hp <= 0) return;
    if (pk.has('frenzy') && S.t - (p.frenT || -9) > 2) p.fren = 0;
    if (p.instaR && p.reload > 0.02) { p.instaR = false; p.reload = 0.02; text(S, p.x, p.y - 28, 'QUICK', P.c); } // 打空自动换弹走的是 player.js 里的 startReload，这里补上
    if (pk.has('regen') && S.t - (p.lastHurt || -9) > 3 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.03 * dt);
    if (pk.has('overcore') && p.cap >= 1) { p.spdMul = (p.spdMul || 1) * 1.1; if (S.rng.chance(0.1)) part(S, 'spark', p.x + S.rng.range(-5, 5), p.y - S.rng.range(2, 12), 0, -30, 0.4, P.c); }
    if (pk.has('scav') && S.raid.pas) S.raid.pas.scav = true;
    if (p.dashT > 0) {
      const first = !p.pkDash; p.pkDash = true;
      if (pk.has('dasharc')) { const H = p.pkArcHit || (p.pkArcHit = new Set()); for (const e of S.enemies) if (!e.dead && e.f === S.f && !H.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 10) { H.add(e); hurt(S, e, 14, { kx: p.dx, ky: p.dy, kb: 40, col: P.c, elec: true }); e.stun = Math.max(e.stun || 0, 0.5); part(S, 'spark', e.x, e.y - 6, 0, -40, 0.3, P.c); } if (S.rng.chance(0.5)) part(S, 'spark', p.x, p.y - 4, S.rng.range(-40, 40), S.rng.range(-40, 10), 0.25, P.c); }
      if (first && pk.has('dash2')) { if (p.d2Ready !== false) { p.d2Ready = false; p.d2T = S.t + (p.dashCdMax || 0.8) * 1.5; p.dashCd = 0.18; text(S, p.x, p.y - 28, 'x2', P.c); } }
    } else { p.pkDash = false; p.pkArcHit = null; }
    if (pk.has('dash2') && p.d2Ready === false && S.t > p.d2T) p.d2Ready = true;
  };
  const post0 = K.armsPost; K.armsPost = function (S, dt) {
    if (post0) post0(S, dt);
    const pk = perks(S), p = S.player; if (!pk.size) return;
    const mine = p.lastShot === S.t, add = [];
    for (const s of S.shots) if (!s.pk) {
      s.pk = 1; if (!mine || s.over) continue;
      if (pk.has('homing')) s.homing = Math.max(s.homing || 0, 3);
      if (pk.has('pierce')) s.pierce = true;
      if (pk.has('split') && S.rng.chance(0.3)) { const a = Math.atan2(s.vy, s.vx) + S.rng.pick([-0.12, 0.12]), sp = Math.hypot(s.vx, s.vy); add.push(Object.assign({}, s, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, hit: new Set(), pk: 1 })); }
    }
    for (const s of add) S.shots.push(s);
  };
})(D);
