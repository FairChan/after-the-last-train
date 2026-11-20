/* 末班之后 · 小样二：据点存档与一趟行动
   据点：钱、仓库（格子）、配装（武器/模块/被动/背包）、出发前装好的背包（格子，带弹药和药）、保险箱（2×2，永久保留）。
   一趟：从入口站出发，一站站走；撤离成功全部带回，工壳损毁则背包和装上的东西都丢，只剩保险箱。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const Gr = () => D.Grid;
  const FREE = { gun: 'nailgun', melee: 'shovel' };

  D.newProfile = function (seed) {
    const G = Gr(), pf = {
      seed, money: 8000, raids: 0, wins: 0, deaths: 0,
      stash: G.make(D.STASH_SIZE[0], D.STASH_SIZE[1]), kit: G.make(D.BAGS.canvas.gw, D.BAGS.canvas.gh), safe: G.make(D.SAFE_SIZE[0], D.SAFE_SIZE[1]), keycase: G.make(D.KEYCASE[0], D.KEYCASE[1]),
      load: { gun: 'nailgun', melee: 'shovel', q: 'barrier', e: null, pas: [null, null, null], bag: 'canvas' },
      city: D.makeCity(seed), log: [],
      // 机库：有哪些型号、各自的状况（耐久比例）。shell 是这趟要用的
      shells: { worker: { own: 1, cond: 1 } }, shell: 'worker',
      tut: 0, hints: [], // tut：新手教学做过没有；hints：已经说过的提示
      story: D.Story ? D.Story.fresh() : null, // 主线进度（story.js）
      grow: D.Growth ? D.Growth.fresh() : null, // 成长与经济（growth.js）：设施、熟练度、委托、配件
    };
    for (const [id, n] of [['card:lunge', 1], ['card:recycler', 1], ['card:daggers', 1], ['bag:sling', 1], ['use:medkit', 2], ['use:patch', 4], ['use:cell', 1], ['ammo:nail:1', 160], ['ammo:nail:2', 40], ['scrap', 6], ['can', 2], ['board', 1]]) G.add(pf.stash, id, n);
    G.add(pf.kit, 'ammo:nail:1', 100); G.add(pf.kit, 'use:medkit', 1); G.add(pf.kit, 'use:patch', 3);
    return pf;
  };

  // ── 配装：仓库里的卡装上去 / 卸下来
  const fitsSlot = (c, slotKey) => D.fitsWeapon(c, slotKey) || ((slotKey === 'q' || slotKey === 'e') && c.slot === 'mod') || (slotKey.startsWith('pas') && c.slot === 'pas');
  D.equip = function (pf, cardId, slotKey) {
    const c = D.CARDS[cardId], L = pf.load, G = Gr();
    if (!fitsSlot(c, slotKey)) return false;
    if (!c.free && !G.take(pf.stash, 'card:' + cardId, 1)) return false;
    D.unequip(pf, slotKey);
    if (slotKey.startsWith('pas')) L.pas[+slotKey.slice(3)] = cardId; else L[slotKey] = cardId;
    return true;
  };
  D.unequip = function (pf, slotKey) {
    const L = pf.load, cur = slotKey.startsWith('pas') ? L.pas[+slotKey.slice(3)] : L[slotKey];
    if (!cur) return true;
    if (!D.CARDS[cur].free && Gr().add(pf.stash, 'card:' + cur, 1)) return false; // 仓库满了卸不下
    if (slotKey.startsWith('pas')) L.pas[+slotKey.slice(3)] = null; else L[slotKey] = FREE[slotKey] || null;
    return true;
  };
  // 换背包：已经装好的东西重新码进新包，码不下的退回仓库
  D.equipBag = function (pf, bagKey) {
    const G = Gr(), b = D.BAGS[bagKey], old = pf.load.bag;
    if (bagKey === old) return true;
    if (!b.free && !G.take(pf.stash, 'bag:' + bagKey, 1)) return false;
    if (!D.BAGS[old].free) G.add(pf.stash, 'bag:' + old, 1);
    const { grid, over } = G.repack(pf.kit, b.gw, b.gh);
    pf.kit = grid; for (const o of over) G.add(pf.stash, o.id, o.n);
    pf.load.bag = bagKey;
    return true;
  };

  // ── 出发
  // 涂装：pf.skins = { own: [...], sel: { 型号: 涂装 } }
  D.shellLook = (pf, k) => { const sk = pf.skins && pf.skins.sel && pf.skins.sel[k], T = sk && sk !== 'none' && D.SKINS[sk]; return T ? { tint: T.tint, visor: T.visor } : null; };
  D.buySkin = function (pf, sk) { const T = D.SKINS[sk]; pf.skins = pf.skins || {}; pf.skins.own = pf.skins.own || ['none']; if (pf.skins.own.includes(sk)) return true; if (pf.money < T.price) return false; pf.money -= T.price; pf.skins.own.push(sk); return true; };
  D.pickSkin = function (pf, k, sk) { if (!D.buySkin(pf, sk)) return false; pf.skins.sel = pf.skins.sel || {}; pf.skins.sel[k] = sk; return true; };
  D.diffUnlocked = (pf, d) => d === 0 || (d === 1 && pf.wins >= 5) || (d === 2 && ((pf.dWins || [])[1] || 0) >= 3);
  // 出发站（试玩：第一站也要能探索）：据点旁边看得见的站，加上解锁过的线路尽头。确认出发后直接进这一站
  D.startPoints = function (C) {
    const out = [], home = C.stations[C.home];
    for (const n of home.adj) { const s = C.stations[n]; if (s && !s.dead && !s.home && D.cityVisible(C, s) && !(s.hidden && C.known.get(s.id) < 1)) out.push(s.id); }
    for (const id of C.entries) if (id !== C.home && C.stations[id] && !C.stations[id].dead && !out.includes(id)) out.push(id);
    return out;
  };
  // 开场警戒（2026-11-17 用户）：出发站所在的线路穿过市中心（线上有站在危险等级 3，city.js 的 L.central）就从 TUNE.alertStartCentral 开始；外环线上开场是 0
  D.startAlert = (C, id) => { const s = C.stations[id]; return s && s.lines.some(li => { const L = C.lines.find(x => x.id === li); return !!(L && L.central); }) ? D.TUNE.alertStartCentral : 0; };
  D.startRaid = function (pf, entryId, diff) {
    const L = pf.load, pas = {};
    for (const k of L.pas) if (k) pas[k] = true;
    const shell = D.shellOf(pf), SH = D.SHELLS[shell], gfx = D.Growth ? D.shellFx(pf, shell) : D.NOFX || { hp: 0 }, maxHp = SH.hp + (pas.armor ? 20 : 0) + (gfx.hp || 0), b = D.BAGS[L.bag];
    const bag = Gr().clone(pf.kit), ext = D.bagExtra(shell, pas);
    if (ext[0] || ext[1]) { const { grid } = Gr().repack(bag, b.gw + ext[0], b.gh + ext[1]); bag.w = grid.w; bag.h = grid.h; bag.items = grid.items; }
    const cond = pf.shells[shell].cond;
    const R = {
      pf, city: pf.city, shell, load: { gun: L.gun, melee: L.melee, q: L.q, e: L.e, bag: L.bag }, pas, hp: Math.max(1, Math.round(maxHp * cond)), maxHp,
      bag, safe: pf.safe, keycase: pf.keycase || (pf.keycase = Gr().make(D.KEYCASE[0], D.KEYCASE[1])), mag: 0, magTier: 1, ammoPick: {},
      look: D.shellLook(pf, shell), diff: diff && D.diffUnlocked(pf, diff) ? diff : 0, alert: D.startAlert(pf.city, entryId), noise: 0, step: 0, at: entryId, from: null, visited: new Set([entryId]), healed: new Set(), taken: 0, kills: 0, stations: 0, sold: 0,
    };
    pf.kit = Gr().make(b.gw, b.gh); // 背包里的东西随工壳出发了
    // 出发时先把弹匣装满
    D.scoutAround(pf.city, entryId);
    if (D.Growth) D.Growth.startRaid(R); // 改装加成、熟练度、情报站免费揭站
    D.loadAllMags(R); // 两个槽的枪都装满（wslots.js）
    pf.raids++;
    return R;
  };
  // 从背包里拿弹药装进弹匣：优先玩家选的等级，没有就拿最高的
  D.ammoTiers = (R, cal) => Gr().ammo(R.bag, cal);
  D.pickTier = function (R, cal) {
    const have = D.ammoTiers(R, cal), want = R.ammoPick[cal];
    if (want && have[want] > 0) return want;
    for (let t = 4; t >= 1; t--) if (have[t] > 0) return t;
    return 0;
  };
  D.loadMag = function (R, room) {
    const cal = D.gunCal(R), t = cal && D.pickTier(R, cal);
    if (!t || room <= 0) return 0;
    const got = Gr().take(R.bag, 'ammo:' + cal + ':' + t, room);
    if (got) { if (R.mag === 0 || t === R.magTier) R.magTier = t; else R.magTier = Math.min(R.magTier, t); R.mag += got; }
    return got;
  };
  D.bagValue = R => Gr().value(R.bag, id => D.itemInfo(id).v);
  D.bagUsed = R => Gr().used(R.bag);
  D.bagCap = R => R.bag.w * R.bag.h;
  D.addToBag = (R, id, n) => D.bagIn(R, id, n == null ? 1 : n); // 弹药先进子弹袋（ammo.js）

  // ── 威胁等级（试玩反馈二）：危险看警戒，不看地区。警戒每进一站 +1、在站里每待 2 分钟 +1、开枪也涨。
  // 2026-11-15 用户：前几级升得太慢 → 10 级，前面升得快（一两站一级）、后面慢；每级敌人更多、更硬、打得更疼（每级加得比以前少，10 级大约是以前 6 级多一点），
  // 3 级起每级解锁 3 种威胁专属敌人（enemies-threat.js），5 级起拾荒蛛、自爆蜂一部分换成回收者和长眼。
  // 所以一趟走得越久，回头往外环撤也要打硬仗；越往市中心东西越值钱（地区只管价值）。
  D.THREAT_AT = [0, 0, 1.5, 3.5, 6, 9, 12.5, 16.5, 21, 26, 32]; // 升到第 n 级要的警戒
  D.THREAT_MAX = 10;
  D.threatLv = R => { const a = Math.max(0, (R && R.alert) || 0); let lv = 1; while (lv < D.THREAT_MAX && a >= D.THREAT_AT[lv + 1]) lv++; return lv; };
  D.threatFrac = R => { const a = Math.max(0, (R && R.alert) || 0), lv = D.threatLv(R); return lv >= D.THREAT_MAX ? 1 : (a - D.THREAT_AT[lv]) / (D.THREAT_AT[lv + 1] - D.THREAT_AT[lv]); };
  D.THREAT_NAME = [null, '平静', '警觉', '戒备', '搜捕', '围剿', '封锁', '猎杀', '清场', '灭迹', '终局'];
  D.THREAT_COL = [null, '#8dff6a', '#c8f05a', '#e3c14a', '#ffb057', '#ff8a3a', '#ff5a2e', '#ff3047', '#e0204a', '#c0206a', '#9a2aa0'];
  // 2026-11-19 用户："随着威胁的提升，提升敌人的血量，然后换更牛逼的敌人"
  // 血量倍率按威胁等级查表：前几级加得少，后面加得多（10 级 ×2.1，以前每级 +6.5%、10 级只有 ×1.59）。
  // 站里待着威胁升了级，场上活着的敌人也跟着变硬（station.js）。
  D.THREAT_HP = [1, 1, 1.06, 1.13, 1.21, 1.3, 1.42, 1.56, 1.72, 1.9, 2.1];
  D.threatHp = R => D.THREAT_HP[D.threatLv(R)] || 1;
  // 换更强的敌人：威胁 4 级起，刷出来的普通敌人有机会换成同一种打法（base）、已经解锁的威胁专属敌人，越新的越常见。
  // 4 级 12%、7 级 48%、10 级 75%；杂兵（锈螨、推车机）不换，改成威胁越高刷得越少（enemy.js）。
  D.threatSwap = lv => lv < 4 ? 0 : Math.min(0.75, (lv - 3) * 0.12);
  D.upgradeFoe = (lv, k, rng) => {
    const b = D.ENEMIES[k]; if (!b || b.trash || !rng.chance(D.threatSwap(lv))) return k;
    const base = b.base || k, own = b.threat || 0;
    const cand = (D.THREAT_FOES || []).filter(q => { const c = D.ENEMIES[q]; return c.base === base && c.threat <= lv && c.threat > own; });
    return cand.length ? rng.weighted(cand.map(q => [q, Math.pow(2, D.ENEMIES[q].threat - lv + 3)])) : k;
  };
  // ── 走到相邻站：每走一站警戒 +1，开过的枪折算进去
  D.travel = function (R, toId) {
    R.revisit = R.visited.has(toId); // 死胡同折返：那一站已经搜空了
    R.from = R.at; R.at = toId; R.step++; R.stations++;
    // 开枪的警戒每过一站封顶（alertShotCap）：市中心枪战多，不能因此涨得比外围快
    R.alert += D.TUNE.alertPerStation + Math.min(D.TUNE.alertShotCap, R.noise * D.TUNE.alertPerShots / 10); R.noise = 0;
    R.visited.add(toId); D.scoutAround(R.city, toId);
  };

  // ── 单向（2026-11-17 用户定）：走过的站一律不能再进，没有折返。
  //    也不许走进死路：选下一站时，那一站往后必须还有一条不经过走过的站、能走到撤离站的路（它自己是撤离站也行）；
  //    绕了一圈回来、前面只剩走过的站的那种站，不让选。
  const storyOK = (R, n) => !D.Story || D.Story.canEnter(R.pf, R.city.stations[n]); // 储备库要林桥的解锁设备
  D.hasWayOut = function (R, toId) {
    const C = R.city, seen = new Set([toId]), q = [toId];
    while (q.length) {
      const s = C.stations[q.shift()]; if (s.exit) return true;
      for (const n of s.adj) { const o = C.stations[n]; if (!seen.has(n) && !R.visited.has(n) && !o.dead && storyOK(R, n) && (o.secret !== 'story' || D.cityVisible(C, o))) { seen.add(n); q.push(n); } } // 剧情锁着、还没读到入口的储备库不算出路（隐藏站走到旁边就会出现，算）
    }
    return false;
  };
  const freshAdj = R => { const C = R.city; return [...C.stations[R.at].adj].filter(n => !R.visited.has(n) && !C.stations[n].dead && D.cityVisible(C, C.stations[n]) && storyOK(R, n)); };
  // 撤离站上没有安全的下一站：就是终点站，只能从这里撤（不让往死路走）；不是撤离站又四面死路（不该出现）：至少别把人卡死在一站
  D.reachNew = R => { const all = freshAdj(R), safe = all.filter(n => D.hasWayOut(R, n)); return safe.length || R.city.stations[R.at].exit ? safe : all; };
  D.deadEnd = (R, toId) => freshAdj(R).includes(toId) && !D.reachNew(R).includes(toId); // 没走过、但走过去就出不来了
  D.canTravel = function (R, toId) {
    const C = R.city, at = C.stations[R.at];
    if (!at.adj.has(toId) || C.stations[toId].dead || R.visited.has(toId)) return false;
    return D.reachNew(R).includes(toId);
  };
  D.reachable = R => [...R.city.stations[R.at].adj].filter(n => D.canTravel(R, n));

  // ── 结束
  D.finishRaid = function (R, ok) {
    const pf = R.pf, G = Gr(), out = { ok, brought: [], lost: [], value: 0, safe: R.safe.items.map(e => e.id), station: R.city.stations[R.at].name };
    const list = R.bag.items.map(e => ({ id: e.id, n: e.n }));
    if (ok) {
      // 弹药和药留在背包里（下次接着用），其余进仓库；仓库放不下的也留在背包
      const kit = G.make(pf.kit.w, pf.kit.h);
      for (const e of list) {
        out.brought.push(e);
        const keep = e.id.startsWith('ammo:') || e.id.startsWith('use:');
        const left = keep ? G.add(kit, e.id, e.n) : G.add(pf.stash, e.id, e.n);
        if (left) { const l2 = G.add(keep ? pf.stash : kit, e.id, left); if (l2) { const v = Math.round(D.stackPrice(pf, { id: e.id, n: l2 }) * 0.5); pf.money += v; out.overflow = (out.overflow || 0) + l2; out.overflowSold = (out.overflowSold || 0) + v; } }
      }
      pf.kit = kit;
      out.value = list.reduce((s, e) => s + D.itemInfo(e.id).v * e.n, 0);
      if (R.city.stations[R.at].exit && !R.city.entries.has(R.at)) { R.city.entries.add(R.at); out.newEntry = R.at; } // 撤出过的尽头站以后能当出发站
      if (pf.shells[R.shell]) pf.shells[R.shell].cond = D.SHELLS[R.shell].free ? 1 : Math.max(0.05, Math.min(1, R.hp / R.maxHp)); // 租的工壳回来就换一台新的
      out.cond = pf.shells[R.shell] ? pf.shells[R.shell].cond : 1;
      pf.wins++; pf.dWins = pf.dWins || [0, 0, 0]; pf.dWins[R.diff || 0]++;
    } else {
      out.lost.push(...list);
      const L = pf.load;
      for (const k of ['gun', 'melee', 'q', 'e']) if (L[k] && !D.CARDS[L[k]].free) { out.lost.push({ id: 'card:' + L[k], n: 1 }); L[k] = FREE[k] || null; }
      L.pas = L.pas.map(k => { if (k) out.lost.push({ id: 'card:' + k, n: 1 }); return null; });
      if (!D.BAGS[L.bag].free) { out.lost.push({ id: 'bag:' + L.bag, n: 1 }); L.bag = 'canvas'; }
      if (!D.SHELLS[R.shell].free) { out.lostShell = R.shell; out.value += D.SHELLS[R.shell].price; delete pf.shells[R.shell]; pf.shell = 'worker'; }
      else pf.shells.worker.cond = 1;
      pf.kit = G.make(D.BAGS[L.bag].gw, D.BAGS[L.bag].gh);
      out.value = out.lost.reduce((s, e) => s + D.itemInfo(e.id).v * e.n, 0);
      pf.deaths++;
    }
    if (D.Growth) D.Growth.onFinish(R, out); // 委托结算、熟练度、损毁丢配件和改装件
    if (D.Story) D.Story.onFinish(R, out);
    pf.log.unshift(out);
    return out;
  };

  // ── 机库：型号、状况、修理、购买
  D.shellOf = pf => (pf.shells && pf.shells[pf.shell] ? pf.shell : 'worker');
  D.bagExtra = (shell, pas) => { const S = D.SHELLS[shell] || {}; return [(S.bagW || 0) + (pas && pas.rack ? 1 : 0), (S.bagH || 0) + (pas && pas.rack ? 1 : 0)]; };
  D.repairCost = (pf, k) => { const s = pf.shells[k]; if (!s || D.SHELLS[k].free) return 0; return Math.ceil((1 - s.cond) * D.SHELLS[k].hp * D.TUNE.repairPerHp * (pf.story && pf.story.ending === 'public' ? 0.5 : 1) * (D.repairMul ? D.repairMul(pf) : 1)); }; // 医疗室打折 // 公开记录的结局：林桥修工壳半价
  D.repairShell = function (pf, k) { const c = D.repairCost(pf, k); if (!c || pf.money < c) return false; pf.money -= c; pf.shells[k].cond = 1; return true; };
  D.buyShell = function (pf, k) { const S = D.SHELLS[k]; if (pf.shells[k] || pf.money < S.price) return false; pf.money -= S.price; pf.shells[k] = { own: 1, cond: 1 }; return true; };
  D.pickShell = function (pf, k) {
    if (!pf.shells[k]) return false;
    pf.shell = k; // 型号多出来的背包格子出发时才加上
    return true;
  };

  // ── 交易行：每趟算一天，每件东西的行情在 ±25% 之间浮动（同一座城、同一天固定）
  D.marketDay = pf => pf.raids;
  D.marketMult = function (pf, id, day) {
    if (day == null) day = D.marketDay(pf);
    const r = D.rng(pf.seed + ':m:' + day + ':' + id), base = id.startsWith('card:') || id.startsWith('ammo:') ? 0.12 : 0.25;
    return 1 + (r() * 2 - 1) * base;
  };
  D.marketPrice = (pf, id) => Math.max(1, Math.round(D.itemInfo(id).v * D.marketMult(pf, id) * 10) / 10);
  D.marketTrend = (pf, id) => { const d = D.marketDay(pf); if (d === 0) return 0; return D.marketMult(pf, id, d) - D.marketMult(pf, id, d - 1); };
  D.sellPrice = (pf, id, inRaid) => Math.round(D.marketPrice(pf, id) * (inRaid ? 0.8 : 1) * 10) / 10;
  D.stackPrice = (pf, e, inRaid) => Math.max(1, Math.round(D.sellPrice(pf, e.id, inRaid) * e.n));
  // 买：装备卡、背包、消耗品、弹药（一级到三级，按一盒的发数卖）
  D.shopList = function (pf) {
    const out = [];
    for (const k in D.USE) out.push({ id: 'use:' + k, n: 1, price: Math.round(D.USE[k].v * 1.1) });
    for (const cal in D.CALIBER) for (const t of [1, 2, 3]) { const id = 'ammo:' + cal + ':' + t, n = D.CALIBER[cal].pack; out.push({ id, n, price: Math.round((D.baseValue ? D.baseValue(id) : D.itemInfo(id).v) * n * 1.25 * D.marketMult(pf, id)) }); }
    for (const k in D.BAGS) if (!D.BAGS[k].free) out.push({ id: 'bag:' + k, n: 1, price: Math.round(D.BAGS[k].v * 1.2) });
    for (const k of Object.keys(D.CARDS).filter(k => !D.CARDS[k].free && !D.CARDS[k].tier).sort((a, b) => D.CARDS[a].q - D.CARDS[b].q)) out.push({ id: 'card:' + k, n: 1, price: Math.round(D.CARDS[k].price * 1.15 * D.marketMult(pf, 'card:' + k)) });
    for (const k in D.KEY_PRICE) out.push({ id: k, n: 1, price: D.KEY_PRICE[k] });
    if (D.Growth) out.push(...D.Growth.shop(pf)); // 优良、精良的配件和改装件
    out.unshift({ id: 'intel', n: 1, price: 120 });
    return out;
  };
})(D);
