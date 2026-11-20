/* Underdog · 小样二：买卖价格（2026-11-15 用户要求：买东西更贵；卖东西除了红色至宝，别的品质都便宜一些）。
   - 卖价：每件东西的"价值"按品质打折，至宝（红）不变。D.itemInfo(id).v 就是打折后的价值，卡片、交易行、结算、背包总价值都按它算；
     打折前的原价在 .base（D.baseValue(id)），买价和工坊造东西的花费按原价算。
   - 买价：交易行、城里商人、门禁卡、情报、配件、护甲一律乘 D.BUY_UP。
   - 装备、子弹更贵（2026-11-17 用户："提升武器和子弹价格"，先 ×1.5；同日又要"武器变成原来的 10 倍、子弹 5 倍"，
     接着"按照此倍率调整其他配件等的价格，一次成功撤离带出来的东西价格比较高，可以 cover"）：
     原价按种类乘 D.PRICE_UP —— 装备卡（枪、近战和其它卡）、配件、改装件、护甲、背包 ×10（D.GEAR_UP），弹药、消耗品 ×5（D.AMMO_UP）。
     买价、卖价、工坊造东西、护甲修理都跟着涨；搜来的杂物（D.ITEMS）、蓝图、委托包裹、型号、涂装、门禁卡、情报不变。
     交易行、黑市卖卡按 D.cardPrice(k)（卡的定价 × GEAR_UP）；局内商人写死的价钱乘 D.listUp(id)（ui-raid.js）。
   - 品质价差拉大（同日："增大不同颜色物品之间的价格差距，保持红色不变"）：D.SELL_Q 原来 0.6 / 0.65 / 0.7 / 0.8 / 0.9 / 1。
   放在所有改 itemInfo / shopList 的文件（inventory、raid、growth、armor、workshop）之后加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  D.SELL_Q = [0.4, 0.5, 0.62, 0.76, 0.88, 1]; // 普通、优良、精良、史诗、传说、至宝
  D.BUY_UP = 1.4;
  D.GEAR_UP = 10; D.AMMO_UP = 5; D.GUN_UP = D.GEAR_UP;
  D.PRICE_UP = { card: D.GEAR_UP, att: D.GEAR_UP, rmod: D.GEAR_UP, armor: D.GEAR_UP, bag: D.GEAR_UP, ammo: D.AMMO_UP, use: D.AMMO_UP };
  // 品质断层（同日："初始金额改为 1 万，降低绿色武器和蓝色武器的价格，我想要一些代差"，先是枪和近战绿 ×0.35、蓝 ×0.45；
  // 2026-11-19 又要"再降绿色和蓝色枪的价格、断层明显一些，子弹、其他物品同理，初始资金八千"）：
  // 按品质乘原价，只动优良（绿）、精良（蓝），史诗（紫）往上不动。买价、卖价、工坊造价都跟着走（都从原价算）。
  //   WEAPON_Q_MUL：枪、近战（改的是卡表里的 price）——蓝→紫一下贵 7 倍多
  //   AMMO_Q_MUL：弹药（按等级的品质；一盒的发数 CALIBER.pack 不动，商店、工坊给的数量不变）——三级→四级贵 3 倍多
  //   Q_MUL：其他按品质分级的装备——模块、被动卡、配件、改装件、护甲、背包、消耗品——蓝→紫贵 3–4 倍
  //   搜来的杂物（D.ITEMS，只拿来卖）、门禁卡、情报、型号不动
  D.WEAPON_Q_MUL = [1, 0.15, 0.22, 1, 1, 1];
  D.AMMO_Q_MUL = [1, 0.7, 0.55, 1, 1, 1];
  D.Q_MUL = [1, 0.5, 0.45, 1, 1, 1];
  const Q_KINDS = { att: 1, rmod: 1, armor: 1, bag: 1, use: 1 };
  D.qMulOf = it => !it || !(it.q >= 0) ? 1 : it.kind === 'ammo' ? D.AMMO_Q_MUL[it.q] || 1 : Q_KINDS[it.kind] ? D.Q_MUL[it.q] || 1 : 1; // 卡在卡表里乘过，这里不算
  for (const k in D.CARDS) { const c = D.CARDS[k], M = c.slot === 'gun' || c.slot === 'melee' ? D.WEAPON_Q_MUL : D.Q_MUL; if (!c.free && M[c.q] !== 1 && D.CARD_VALUE[c.q] === c.price) c.price = Math.round(c.price * M[c.q]); }
  // 红色断层（2026-11-19 用户："红的价格有的很低，请你做出与金明显的价格断层，使得红很珍贵"）：
  //   改前最便宜的红是红色蓝图 600、搜来的红杂物 2482 起、红卡 7500，都比最贵的金（军用重载包 8624、金配件 7216）便宜。
  //   做法：至宝（红）的原价、价值一律在原来的基础上加 D.RED_ADD（同一种东西之间的高低顺序不变），
  //   最便宜的红（红蓝图）15600，比最贵的金高八成以上。写死在表里的买价（交易行、黑市、商人、配件台、cardPrice）
  //   按同一比例 D.redUp(id) 放大，买价仍然比卖价贵，不会出现买进来卖出去赚钱。工坊造红东西的花费按原价算，也跟着涨。
  D.RED_ADD = 15000;
  const r = v => v >= 10 ? Math.round(v) : Math.round(v * 100) / 100;
  const upOf = it => D.PRICE_UP[it.kind] || 1;
  D.cardPrice = k => Math.round(D.CARDS[k].price * D.GEAR_UP * D.redUp('card:' + k));
  const ii0 = D.itemInfo;
  D.itemInfo = function (id) {
    const it = ii0.apply(this, arguments);
    if (!it || it.v == null || it.base != null) return it;
    const m = upOf(it) * D.qMulOf(it), v0 = m === 1 ? it.v : r(it.v * m);
    if (it.q >= 5 && v0 > 0) { const v1 = r(v0 + D.RED_ADD); return Object.assign({}, it, { base: v1, v: v1, red0: v0 }); }
    if (!(it.q >= 0) || it.q >= 5) return m === 1 ? it : Object.assign({}, it, { base: v0, v: v0 });
    return Object.assign({}, it, { base: v0, v: Math.max(v0 > 0 ? 0.01 : 0, r(v0 * D.SELL_Q[it.q])) });
  };
  D.baseValue = id => { const it = D.itemInfo(id); return it.base != null ? it.base : it.v; };
  // 写死在表里的价钱（不是按 baseValue 算的）要补乘的倍率：种类涨价 × 品质断层；弹药、按 cardPrice 算的卡已经涨过，不再乘（卡只乘种类）
  const infoOf = id => { try { return D.itemInfo(id); } catch (e) { return null; } };
  D.redUp = id => { const it = typeof id === 'string' ? infoOf(id) : null; return it && it.red0 > 0 ? it.base / it.red0 : 1; }; // 红色断层：写死的买价要乘的比例
  D.listUp = id => { if (typeof id !== 'string' || id === 'intel' || id.startsWith('ammo:')) return 1; const it = infoOf(id); return (D.PRICE_UP[it && it.kind] || 1) * (id.startsWith('card:') ? 1 : D.qMulOf(it)) * D.redUp(id); };
  // 配件、改装件：改枪台、改装台直接调 Growth.shop，交易行的列表里也有它们；在这里乘一次，打上 up，交易行那边不再乘
  if (D.Growth && D.Growth.shop) { const gs0 = D.Growth.shop; D.Growth.shop = function () { return gs0.apply(this, arguments).map(e => Object.assign({}, e, { price: Math.round(e.price * D.GEAR_UP * D.BUY_UP * D.qMulOf(infoOf(e.id)) * D.redUp(e.id)), up: true })); }; }
  // 交易行：卡、消耗品、背包、护甲按表里的价钱算，这里补上倍率（弹药按 baseValue 算，已经涨过）
  const sl0 = D.shopList;
  D.shopList = function (pf) { return sl0.apply(this, arguments).map(e => e.up ? e : Object.assign({}, e, { price: Math.round(e.price * D.listUp(e.id) * D.BUY_UP) })); };
  // 护甲修理：每点耐久的修理费跟着护甲涨
  if (D.Armor && D.Armor.fixCost) { const fc0 = D.Armor.fixCost; D.Armor.fixCost = id => Math.round(fc0(id) * D.GEAR_UP); }
})(D);
