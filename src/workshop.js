/* Underdog：工坊（蓝图系统）的规则，和四级、五级弹药；交易行买入多一栏"护盾"。界面和动画在 ui-workshop.js。
   用户："买入添加护盾，增加四级弹五级弹，但是要通过收到蓝图才可以制造；另外，增加蓝图系统，作为工坊添加进去，然后做好动画"
   - 五级弹：伤害 ×1.75，传说品质。交易行不卖四级、五级；四级照旧偶尔在城里捡到，五级只能在工坊做。
   - 弹药蓝图两张：四级弹药、五级弹药（学会以后七种口径都能做，一次做一盒）。和传说级配件 / 改装件的老蓝图一起收在工坊的蓝图册里。
   - 蓝图从哪来：城里史诗以上的箱子偶尔有（四级弹药要史诗、五级要传说）；精英偶尔掉四级弹药蓝图，首领常掉。
   - 学会：仓库里有这张蓝图，在工坊点"学会"（蓝图用掉）。学会的记在 pf.grow.bp（和 growth.js 的老蓝图同一张表，存档不用改）。
   - 交易行"护盾"一栏：一到四级护甲（满耐久）、护盾电池、护盾模块和护盾发生器（后两个原来在"模块"栏）。
   挂钩：D.itemInfo（弹药蓝图）、D.Growth.rollGear（箱子里的蓝图）、K.onKillX（精英、首领掉蓝图）、D.shopList（护甲）。
   设计：design/features/workshop/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {}), Gr = () => D.Grid;

  // ── 五级弹
  if (!D.AMMO_TIER[5]) D.AMMO_TIER[5] = { name: '五级', mul: 1.75, q: 4, price: 9 };
  D.AMMO_MAX = D.AMMO_TIER.length - 1;

  // ── 弹药蓝图
  const AMMO_BP = D.AMMO_BP = {
    ammo4: { tier: 4, name: '四级弹药', q: 3, v: 260, mats: [['copper', 2], ['screws', 3]] },
    ammo5: { tier: 5, name: '五级弹药', q: 4, v: 520, mats: [['silver', 1], ['hydro', 1], ['copper', 2]] },
  };
  const bpOfTier = t => Object.keys(AMMO_BP).find(k => AMMO_BP[k].tier === t);
  const ii0 = D.itemInfo, cache = new Map();
  D.itemInfo = function (id) {
    if (typeof id !== 'string' || !id.startsWith('bp:') || !AMMO_BP[id.slice(3)]) return ii0.apply(this, arguments);
    if (cache.has(id)) return cache.get(id);
    const B = AMMO_BP[id.slice(3)];
    const o = { name: '蓝图 · ' + B.name, v: B.v, w: 1, h: 1, stack: 1, q: B.q, art: 'g_bp', kind: 'bp', bp: id.slice(3), desc: `带回据点，在工坊学会以后就能做${B.name}（七种口径都行）` };
    cache.set(id, o); return o;
  };

  // ── 学会了没有、蓝图册
  const grow = pf => pf.grow || (pf.grow = {});
  D.bpLearned = (pf, k) => (grow(pf).bp || []).includes(k);
  D.bpInStash = (pf, k) => pf.stash.items.find(e => e.id === 'bp:' + k) || null;
  D.bpBook = function (pf) {
    const out = Object.keys(AMMO_BP).map(k => ({ k, kind: 'ammo', name: AMMO_BP[k].name, q: AMMO_BP[k].q, tier: AMMO_BP[k].tier, art: 'ammo_nail' }));
    const gear = (T, kind) => Object.keys(T || {}).filter(k => T[k].q === 4).map(k => ({ k, kind, name: T[k].name, q: 4, art: D.itemInfo(kind + ':' + k).art }));
    out.push(...gear(D.ATT, 'att'), ...gear(D.RMOD, 'rmod'));
    for (const b of out) { b.learned = D.bpLearned(pf, b.k); b.have = D.bpInStash(pf, b.k); }
    return out;
  };
  D.bpLearn = function (pf, k) { const e = D.bpInStash(pf, k); return !!e && D.learnBp(pf, e); };

  // ── 做弹药：一次一盒（口径的一盒发数），花零件和材料
  D.ammoRecipe = function (t, cal) {
    const B = AMMO_BP[bpOfTier(t)], id = 'ammo:' + cal + ':' + t, n = D.CALIBER[cal].pack;
    return { id, n, bp: bpOfTier(t), money: Math.round((D.baseValue ? D.baseValue(id) : D.itemInfo(id).v) * n * 0.5), mats: B.mats };
  };
  D.canCraftAmmo = function (pf, t, cal) {
    const r = D.ammoRecipe(t, cal);
    if (!D.bpLearned(pf, r.bp)) return 'bp';
    if (!D.canPay(pf, r.money, r.mats)) return 'poor';
    return Gr().canAdd(pf.stash, r.id, r.n) ? 'ok' : 'full';
  };
  D.craftAmmo = function (pf, t, cal) {
    if (D.canCraftAmmo(pf, t, cal) !== 'ok') return false;
    const r = D.ammoRecipe(t, cal); pf.money -= r.money; for (const [id, n] of r.mats) Gr().take(pf.stash, id, n);
    Gr().add(pf.stash, r.id, r.n); return true;
  };

  // ── 蓝图从哪来：箱子（史诗以上）、精英、首领
  const TUNE = D.WORKSHOP_TUNE = { box4: 0.02, box5: 0.016, elite4: 0.08, boss: 0.7 };
  if (D.Growth && D.Growth.rollGear) {
    const rg0 = D.Growth.rollGear;
    D.Growth.rollGear = function (rng, q, C) {
      if (q >= 4 && rng.chance(TUNE.box5)) return { id: 'bp:ammo5', n: 1 };
      if (q >= 3 && rng.chance(TUNE.box4)) return { id: 'bp:ammo4', n: 1 };
      return rg0.apply(this, arguments);
    };
  }
  const kx0 = K.onKillX;
  K.onKillX = function (S, e) {
    const r = kx0 ? kx0.apply(this, arguments) : undefined;
    if (S && !S.tut && e && K.scatter) {
      const E = D.ENEMIES[e.kind] || {}, f = e.f == null ? S.f : e.f;
      if (E.boss && S.rng.chance(TUNE.boss)) K.scatter(S, e.x, e.y, f, S.rng.chance(0.5) ? 'bp:ammo5' : 'bp:ammo4', 1);
      else if (E.elite && S.rng.chance(TUNE.elite4)) K.scatter(S, e.x, e.y, f, 'bp:ammo4', 1);
    }
    return r;
  };

  // ── 交易行：一到四级护甲（满耐久）
  D.isShieldGoods = id => (D.Armor && D.Armor.is(id)) || /^card:(barrier|shieldgen)$/.test(id) || (id.startsWith('use:') && !!(D.USE[id.slice(4)] || {}).shield);
  const sl0 = D.shopList;
  D.shopList = function (pf) {
    const out = sl0.apply(this, arguments);
    if (D.ARMOR_LV && D.Armor) for (let lv = 1; lv <= 4; lv++) { const L = D.ARMOR_LV[lv]; out.push({ id: D.Armor.id(lv, L.max), n: 1, price: Math.round(L.v * 1.3) }); }
    return out;
  };
})(D);
