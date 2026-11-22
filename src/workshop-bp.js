/* Underdog：蓝图扩充（用户 2026-11-17："增加蓝图的内容，现在太少了，为了增加你可以修改或增加物品"）。
   原来工坊只有 9 张蓝图（两张弹药 + 七件传说配件 / 改装件），这里加到 40 多张：
   - 新传说配件 4 件（幽灵消音器、弹链供弹、先知瞄具、外骨骼枪托）、新传说改装件 3 件（神盾护板、超载驱动、幻影干扰器），
     和老的传说件一样：工作台 4 级 + 蓝图才能做，城里传说箱子也偶尔直接有。
   - 消耗品蓝图（u_*）：九种城里能捡的高级消耗品，学会就能在工坊做，一次一到两个；
     另有四种只能在工坊做的新消耗品：纳米修复群（C）、过载电池（V）、铝热雷、静滞雷（Z）。交易行不卖这四种。
   - 精工枪蓝图（g_*）：每把枪一张。学会以后，仓库里放一把原型枪 + 零件材料，改成"·精工"型号（品质高两档）。
   - 护甲蓝图（ar5、ar6）：钛板护甲、重型护甲（交易行只卖到四级），做出来满耐久。
   蓝图从哪来：精良以上的箱子偶尔有消耗品蓝图；史诗以上偶尔有精工枪蓝图（武器箱高很多）；传说箱子偶尔有护甲蓝图；
   精英偶尔掉消耗品蓝图，首领常掉一张（精工枪、护甲、传说消耗品里挑）。
   挂钩：D.itemInfo（bp:新蓝图）、D.bpBook（蓝图册多几类）、D.Growth.rollGear（原来的都没出东西时再掷）、K.onKillX、
   D.shopList（不卖工坊专属消耗品）、D.Growth.deserialize（读档留住新蓝图）、K.nadeBoomX（铝热雷、静滞雷）。
   界面在 ui-workshop.js（kind：use / gun / equip，b.x = true 走这里的配方）。设计：design/features/workshop/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {}), R = D.RAMP, Gr = () => D.Grid;
  const pct = v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';

  // ───────────────────────── 1. 新传说配件、改装件
  const NEW_ATT = {
    ghost:  { slot: 'muzzle', name: '幽灵消音器', q: 4, fx: { noise: -0.55, dmg: 0.08 } },
    belt:   { slot: 'mag',    name: '弹链供弹',   q: 4, fx: { mag: 1, rate: -0.06, reload: 0.15 } },
    oracle: { slot: 'sight',  name: '先知瞄具',   q: 4, fx: { spread: -0.2, life: 0.35, dmg: 0.06 } },
    exo:    { slot: 'stock',  name: '外骨骼枪托', q: 4, fx: { bloom: -0.3, reload: -0.2 } },
  };
  const NEW_RMOD = {
    aegis:     { slot: 'armor',  name: '神盾护板',   q: 4, fx: { shield0: 25, hurt: -0.05 } },
    overdrive: { slot: 'power',  name: '超载驱动',   q: 4, fx: { speed: 0.12, dash: -0.3 } },
    phantom:   { slot: 'sensor', name: '幻影干扰器', q: 4, fx: { notice: -0.35, noise: -0.3 } },
  };
  const ATT_LABEL = { dmg: '伤害', spread: '散布', bloom: '连射变散', mag: '弹匣', reload: '换弹时间', rate: '射击间隔', speed: '弹速', life: '射程', noise: '枪声' };
  const RM_LABEL = { hp: '耐久上限', hurt: '受到伤害', shield0: '进站护盾', speed: '移速', dash: '闪避冷却', cap: '电容充能', skill: '技能冷却', search: '搜容器速度', notice: '被发现的速度', spread: '散布', noise: '开枪的警戒' };
  if (D.ATT) for (const k in NEW_ATT) if (!D.ATT[k]) { const A = D.ATT[k] = NEW_ATT[k]; A.desc = Object.entries(A.fx).map(([f, v]) => ATT_LABEL[f] + ' ' + pct(v)).join('、'); }
  if (D.RMOD) for (const k in NEW_RMOD) if (!D.RMOD[k]) { const M = D.RMOD[k] = NEW_RMOD[k]; M.desc = Object.entries(M.fx).map(([f, v]) => RM_LABEL[f] + ' ' + (f === 'hp' || f === 'shield0' ? '+' + v : pct(v))).join('、'); }

  // ───────────────────────── 2. 只能在工坊做的新消耗品
  Object.assign(D.USE, {
    nanoswarm: { name: '纳米修复群', q: 4, v: 260, w: 1, h: 2, stack: 2, art: 'nanoswarm', heal: 80, time: 2.2, key: 'C', ws: true, desc: '读条 2.2 秒，回复 80 耐久。挨打会打断（药不消耗）。只能在工坊做' },
    overcell:  { name: '过载电池',   q: 4, v: 300, w: 1, h: 2, stack: 2, art: 'overcell', shield: 80, time: 1.4, key: 'V', ws: true, desc: '读条 1.4 秒，获得 80 护盾。只能在工坊做' },
    thermite:  { name: '铝热雷',     q: 4, v: 170, w: 1, h: 1, stack: 3, art: 'nade_thermite', throw: 'thermite', key: 'Z', ws: true, desc: 'Z 扔向准星：大范围 45 伤害，圈里的敌人再烧 3 秒。只能在工坊做' },
    stasis:    { name: '静滞雷',     q: 4, v: 180, w: 1, h: 1, stack: 3, art: 'nade_stasis', throw: 'stasis', key: 'Z', ws: true, desc: 'Z 扔向准星：范围内的敌人（包括人类）定住 3 秒，首领 1 秒。只能在工坊做' },
  });
  Object.assign(D.ITEM_ART, {
    nanoswarm: p => { p.box(7, 3, 14, 22, R.dark, { r: 3 }); p.box(9, 6, 10, 15, R.glass, { r: 2, emit: 1 }); p.rect(9, 1, 10, 2, '#949fb6'); for (const [x, y] of [[11, 9], [16, 11], [12, 14], [15, 17], [11, 19]]) p.disc(x, y, 1, '#8dff6a', 1); p.px(14, 8, '#ffffff', 1); },
    overcell:  p => { p.box(6, 3, 16, 22, R.gunmetal, { r: 2 }); p.grad(9, 6, 10, 16, R.red, 1); p.rect(10, 1, 8, 2, '#ff7a2e'); p.line(16, 7, 12, 14, '#fff3b0', 1); p.line(12, 14, 16, 14, '#fff3b0', 1); p.line(16, 14, 12, 21, '#fff3b0', 1); },
    nade_thermite: p => { p.ell(14, 16, 7, 9, R.copper, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); p.rect(8, 13, 12, 2, '#3a2a20'); p.disc(14, 18, 3, '#ffd84a', 1); p.px(14, 18, '#ffffff', 1); p.px(13, 17, '#fff3b0', 1); },
    nade_stasis:   p => { p.ell(14, 16, 7, 9, R.blue, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); p.disc(14, 16, 4, '#3ee8ff', 1); p.disc(14, 16, 3, '#164a5a'); p.disc(14, 16, 2, '#cfe0ff', 1); p.px(14, 16, '#ffffff', 1); },
  });
  // 铝热雷、静滞雷炸开（arms.js / gear.js 的 nadeBoomX 之上再套一层）
  const nb0 = K.nadeBoomX;
  K.nadeBoomX = function (S, n) {
    if (n.kind === 'thermite') {
      K.explode(S, n.x, n.y, 40, 45, false);
      for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - n.x, e.y - n.y) < 40 + e.r) e.burnT = Math.max(e.burnT || 0, 3);
      for (let i = 0; i < 30; i++) { const a = S.rng() * Math.PI * 2, d = S.rng() * 36; K.part(S, 'spark', n.x + Math.cos(a) * d, n.y + Math.sin(a) * d * 0.6, S.rng.range(-20, 20), S.rng.range(-90, -30), 0.7, S.rng.pick(['#ffffff', '#ffd84a', '#ff8a2e'])); }
      K.flashLight(S, n.x, n.y, 120, '#ffd84a', 1.4); K.alertAround(S, n.x, n.y, 220); return true;
    }
    if (n.kind === 'stasis') {
      for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - n.x, e.y - n.y) < 56 + e.r) { const boss = (D.ENEMIES[e.kind] || {}).boss; e.stun = Math.max(e.stun || 0, boss ? 1 : 3); e.act = null; e.tele = 0; }
      K.ring(S, n.x, n.y, 56, '#3ee8ff'); K.ring(S, n.x, n.y, 36, '#cfe0ff'); K.flashLight(S, n.x, n.y, 150, '#3ee8ff', 1.4); D.Sfx && D.Sfx.play('zap'); K.alertAround(S, n.x, n.y, 120); return true;
    }
    return nb0 ? nb0(S, n) : false;
  };
  // 交易行不卖工坊专属的消耗品
  const sl0 = D.shopList;
  D.shopList = function () { return sl0.apply(this, arguments).filter(o => !(o.id.startsWith('use:') && (D.USE[o.id.slice(4)] || {}).ws)); };

  // ───────────────────────── 3. 新蓝图
  // kind：use 消耗品、gun 精工枪、equip 护甲。out 做出来的东西，n 一次做几个，mats 材料（可以有原型枪），money 零件
  const BPX = D.BPX = {};
  const USE_BP = [
    ['nanogel', 2, [['oldcell', 1], ['plastic', 1]]], ['medkit2', 1, [['medpack', 1], ['bandage', 2]]],
    ['bigcell', 1, [['oldcell', 2], ['copper', 1]]], ['cell3', 1, [['reactor', 1], ['copper', 1]]],
    ['freeze', 2, [['oil', 1], ['plastic', 1]]], ['emp', 2, [['board', 1], ['copper', 1]]], ['flash', 2, [['oldcell', 1], ['scrap', 2]]],
    ['incend', 2, [['oil', 2], ['scrap', 1]]], ['cluster', 2, [['screws', 2], ['scrap', 2], ['copper', 1]]],
    ['nanoswarm', 1, [['medpack', 1], ['qchip', 1]]], ['overcell', 1, [['reactor', 1], ['silver', 1]]],
    ['thermite', 2, [['copper', 2], ['hydro', 1]]], ['stasis', 2, [['qchip', 1], ['oldcell', 2]]],
  ];
  for (const [k, n, mats] of USE_BP) { const u = D.USE[k]; if (u) BPX['u_' + k] = { kind: 'use', name: u.name, q: Math.max(2, u.q), out: 'use:' + k, n, mats }; }
  const GUN_MATS = [[['scrap', 4], ['screws', 3]], [['copper', 2], ['screws', 3]], [['bearing', 2], ['motor', 1]], [['servo', 1], ['hydro', 1]], [['reactor', 1], ['silver', 1]], [['core', 1], ['platinum', 1]]];
  for (const k in D.CARDS) { const c = D.CARDS[k]; if (!c.gun || c.tier || !D.CARDS[k + '_3']) continue; BPX['g_' + k] = { kind: 'gun', name: D.CARDS[k + '_3'].name, q: D.CARDS[k + '_3'].q, out: 'card:' + k + '_3', n: 1, mats: [['card:' + k, 1]].concat(GUN_MATS[c.q] || GUN_MATS[5]), base: k }; }
  if (D.ARMOR_LV && D.Armor) {
    const AM = { 5: [['silver', 1], ['hydro', 2], ['plastic', 4]], 6: [['platinum', 1], ['servo', 1], ['silver', 1]] };
    for (const lv of [5, 6]) BPX['ar' + lv] = { kind: 'equip', name: D.ARMOR_LV[lv].name, q: lv - 1, out: D.Armor.id(lv, D.ARMOR_LV[lv].max), n: 1, mats: AM[lv] };
  }
  const BP_V = [0, 80, 140, 220, 360, 600];
  const ART = id => D.itemInfo(id).art;
  const ii0 = D.itemInfo, cache = new Map();
  D.itemInfo = function (id) {
    if (typeof id !== 'string' || !id.startsWith('bp:') || !BPX[id.slice(3)]) return ii0.apply(this, arguments);
    if (cache.has(id)) return cache.get(id);
    const B = BPX[id.slice(3)];
    const desc = B.kind === 'gun' ? `带回据点在工坊学会以后，能把一把${D.CARDS[B.base].name}改成${B.name}` : `带回据点，在工坊学会以后就能做${B.name}`;
    const o = { name: '蓝图 · ' + B.name, v: BP_V[B.q] || 300, w: 1, h: 1, stack: 1, q: B.q, art: 'g_bp', kind: 'bp', bp: id.slice(3), desc };
    cache.set(id, o); return o;
  };
  D.bpRecipeX = k => { const B = BPX[k]; if (!B) return null; const one = D.baseValue ? D.baseValue(B.out) : D.itemInfo(B.out).v; const base = B.base ? (D.baseValue ? D.baseValue('card:' + B.base) : D.itemInfo('card:' + B.base).v) : 0; return { id: B.out, n: B.n, mats: B.mats, money: Math.max(20, Math.round(B.base ? (one - base) * 0.4 : one * B.n * 0.5)) }; };
  D.canCraftX = function (pf, k) {
    const r = D.bpRecipeX(k); if (!r) return 'no';
    if (!D.bpLearned(pf, k)) return 'bp';
    if (!D.canPay(pf, r.money, r.mats)) return BPX[k].base && !Gr().count(pf.stash, x => x === 'card:' + BPX[k].base) ? 'need' : 'poor';
    return Gr().canAdd(pf.stash, r.id, r.n) ? 'ok' : 'full';
  };
  D.craftX = function (pf, k) {
    if (D.canCraftX(pf, k) !== 'ok') return false;
    const r = D.bpRecipeX(k); pf.money -= r.money; for (const [id, n] of r.mats) Gr().take(pf.stash, id, n);
    Gr().add(pf.stash, r.id, r.n); return true;
  };
  // 蓝图册：原来的两类后面接上新的三类
  const bb0 = D.bpBook;
  D.bpBook = function (pf) {
    const out = bb0.apply(this, arguments);
    for (const k in BPX) { const B = BPX[k]; out.push({ k, kind: B.kind, name: B.name, q: B.q, art: ART(B.out), x: true, learned: D.bpLearned(pf, k), have: D.bpInStash(pf, k) }); }
    return out;
  };

  // ───────────────────────── 4. 蓝图从哪来
  const TUNE = D.BPX_TUNE = { use: 0.015, gun: 0.012, gunCards: 0.05, equip: 0.01, elite: 0.05, boss: 0.4 };
  const pool = (rng, f) => { const ks = Object.keys(BPX).filter(k => f(BPX[k])); return ks.length ? 'bp:' + rng.pick(ks) : null; };
  if (D.Growth && D.Growth.rollGear) {
    const rg0 = D.Growth.rollGear;
    D.Growth.rollGear = function (rng, q, C) {
      const r = rg0.apply(this, arguments); if (r) return r; // 原来的（护甲、弹药蓝图、配件……）都没出东西才轮到这里
      let id = null;
      if (q >= 3 && rng.chance(C && C.cards ? TUNE.gunCards : TUNE.gun)) id = pool(rng, B => B.kind === 'gun' && B.q <= q + 2);
      else if (q >= 4 && rng.chance(TUNE.equip)) id = pool(rng, B => B.kind === 'equip');
      else if (q >= 2 && rng.chance(TUNE.use)) id = pool(rng, B => B.kind === 'use' && B.q <= q + 1);
      return id ? { id, n: 1 } : null;
    };
  }
  const kx0 = K.onKillX;
  K.onKillX = function (S, e) {
    const r = kx0 ? kx0.apply(this, arguments) : undefined;
    if (S && !S.tut && e && K.scatter) {
      const E = D.ENEMIES[e.kind] || {}, f = e.f == null ? S.f : e.f;
      const id = E.boss && S.rng.chance(TUNE.boss) ? pool(S.rng, B => B.kind !== 'use' || B.q >= 4) : E.elite && S.rng.chance(TUNE.elite) ? pool(S.rng, B => B.kind === 'use') : null;
      if (id) K.scatter(S, e.x + 6, e.y, f, id, 1);
    }
    return r;
  };

  // ───────────────────────── 5. 读档：growth.js 只认配件 / 改装件 / 弹药蓝图，新蓝图在这里补回去
  if (D.Growth && D.Growth.deserialize) {
    const ds0 = D.Growth.deserialize;
    D.Growth.deserialize = function (pf, o) {
      const r = ds0.apply(this, arguments);
      const keep = ((o && o.bp) || []).filter(k => BPX[k]), g = pf.grow;
      if (g) for (const k of keep) if (!g.bp.includes(k)) g.bp.push(k);
      return r;
    };
  }
})(D);
