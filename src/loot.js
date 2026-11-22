/* 末班之后 · 小样二：容器、掷物品、地上的东西、逐件揭开（从 combat.js 拆出来） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, Z = D.Z, VW = D.W / Z, VH = D.H / Z, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const Q = () => D.QUALITY;
  const K = D.K || (D.K = {}); // 站内各文件共用的内部函数
  // 别的文件里定义的函数：调用时再去 D.K 上找
  const part = (...a) => K.part(...a);
  const text = (...a) => K.text(...a);
  const ring = (...a) => K.ring(...a);
  const addShake = (...a) => K.addShake(...a);

  // 容器：n 件数，g 格子大小，bonus 品质往上抬几档，qShift 品质直接加减，cats 偏向的分类（lean 是偏向的概率，pure 只出这些），
  // ammoP / medP 出弹药、药的概率，slow 搜一件要多久的倍数（小于 1 更快），locked 要门禁卡才能打开。desc 写进图鉴
  const CONT = {
    locker:   { name: '储物柜', n: [1, 3], g: [4, 4], desc: '什么都可能有一点。站厅、站台、各种房间里最常见' },
    register: { name: '收银台', n: [1, 3], g: [4, 3], cats: ['val', 'metal'], lean: 0.35, desc: '商铺和售票处。偶尔有表和贵金属' },
    crate:    { name: '货箱', n: [1, 4], g: [5, 4], cats: ['mat', 'part'], lean: 0.4, desc: '仓库里一堆堆的。材料和零件为主，件数多' },
    toolbox:  { name: '工具箱', n: [1, 3], g: [4, 3], cats: ['part', 'mat'], lean: 0.5, desc: '维修间、车间。机械部件为主' },
    safe:     { name: '保险柜', n: [2, 4], g: [4, 3], bonus: 1, slow: 1.4, cats: ['val', 'metal', 'intel'], lean: 0.5, desc: '控制室、隐藏房间。品质高一档，搜得慢' },
    wreck:    { name: '机器残骸', n: [1, 3], g: [4, 3], cats: ['part', 'elec'], lean: 0.7, ammoP: 0.1, desc: '车间和机库里报废的机器。拆得出电机、轴承、传感器' },
    armory:   { name: '弹药柜', n: [2, 4], g: [5, 3], ammo: true, desc: '保安室、军械库。大多是弹药，四级弹也能在这里找到' },
    medcab:   { name: '医药柜', n: [2, 3], g: [4, 3], meds: true, desc: '医务室。维修包、贴片、护盾电池' },
    // 第七轮新增：日常容器
    trash:    { name: '垃圾桶', n: [1, 2], g: [3, 2], qShift: -1, ammoP: 0.08, slow: 0.45, cats: ['mat'], lean: 0.6, desc: '翻得很快，大多是破烂——偶尔有人扔掉了好东西' },
    vendor:   { name: '自动售货机', n: [2, 4], g: [4, 4], slow: 0.7, ammoP: 0.04, medP: 0.55, cats: ['med'], lean: 0.6, desc: '砸开玻璃拿：罐头、贴片、护盾电池' },
    parcel:   { name: '快递柜', n: [2, 5], g: [6, 3], slow: 0.8, ammoP: 0.1, cats: ['elec', 'val', 'med', 'mat'], lean: 0.5, desc: '一格格小门，什么都可能寄过——电子产品、香水、雪茄' },
    filecab:  { name: '文件柜', n: [1, 3], g: [4, 3], slow: 1.2, ammoP: 0.05, cats: ['intel', 'elec'], lean: 0.75, desc: '售票处、控制室。门禁卡、硬盘、加密硬盘' },
    fridge:   { name: '冰柜', n: [2, 3], g: [4, 4], ammoP: 0.03, medP: 0.6, cats: ['med'], lean: 0.6, desc: '商铺、医务室。罐头和药，偶尔冻着急救包' },
    partsbin: { name: '零件架', n: [2, 4], g: [5, 3], ammoP: 0.08, cats: ['part'], lean: 0.8, desc: '一格格分好类的零件，伺服电机、液压缸都有' },
    pc:       { name: '电脑主机', n: [1, 2], g: [3, 3], slow: 1.1, ammoP: 0.03, cats: ['elec', 'intel'], lean: 0.85, desc: '拆机：显卡、固态硬盘、芯片' },
    corpse:   { name: '拾荒者遗体', n: [2, 4], g: [5, 4], ammoP: 0.35, medP: 0.25, cards: 0.25, bagP: 0.15, desc: '没撤出来的同行。弹药、药、装备卡，有时还背着好背包' },
    lockbox:  { name: '门禁柜', n: [3, 5], g: [5, 4], bonus: 3, ammoP: 0.06, locked: true, slow: 1.2, cats: ['val', 'metal', 'intel'], lean: 0.7, cards: 0.2, desc: '锁着。要用一张门禁卡打开（蛛网能直接破解）。里面品质高三档' },
    // 高价值容器：只出值钱东西（cats），品质往上抬（bonus）
    vault:    { name: '金库保险柜', n: [3, 5], g: [6, 4], bonus: 2, pure: true, slow: 1.3, cats: ['metal', 'val'], desc: '金库里。金条、铂金、宝石，搜得慢' },
    rack:     { name: '服务器机柜', n: [3, 4], g: [5, 4], bonus: 2, pure: true, cats: ['elec', 'intel'], desc: '机房里。服务器刀片、量子芯片、AI 核心' },
    showcase: { name: '珠宝柜台',   n: [2, 4], g: [5, 3], bonus: 2, pure: true, cats: ['val'], desc: '珠宝店、藏品室。首饰、古董、名画' },
    gunrack:  { name: '枪械箱',     n: [2, 3], g: [6, 3], bonus: 1, cards: true, desc: '军械库。大多是武器和模块卡' },
  };
  D.CONT = CONT;
  // 容器材质：决定开箱音效和飞出来的碎屑
  const CMAT = { locker: 'metal', register: 'metal', crate: 'wood', toolbox: 'plastic', safe: 'vault', wreck: 'scrap', armory: 'metal', medcab: 'metal', trash: 'plastic', vendor: 'glass', parcel: 'metal', filecab: 'metal', fridge: 'fridge', partsbin: 'metal', pc: 'elec', corpse: 'soft', lockbox: 'vault', vault: 'vault', rack: 'elec', showcase: 'glass', gunrack: 'wood' };
  D.CMAT = CMAT;
  const OPEN_POP = 0.18, OPEN_DUR = 0.5;
  D.OPEN_DUR = OPEN_DUR;
  // 开始开箱：先锁扣（声音），动画到 OPEN_POP 时箱子弹开（碎屑、光）
  function startOpen(S, c) { if (D.Growth) D.Growth.onOpen(S, c); if (K.onOpenX) K.onOpenX(S, c); c.openT = 0; c.burst = false; sfx('open_' + (CMAT[c.kind] || 'metal')); }
  function openBurst(S, c) {
    const m = CMAT[c.kind] || 'metal', x = c.x, y = c.y - 8;
    const col = { wood: '#8f5e33', plastic: '#566a31', glass: '#a6e2f0', soft: '#6a442c', elec: P.c, vault: '#ffd860', fridge: '#e8f4ff', scrap: P[4], metal: '#949fb6' }[m];
    for (let i = 0; i < 10; i++) part(S, 'debris', x + S.rng.range(-6, 6), y + 4, S.rng.range(-70, 70), S.rng.range(-50, 10), S.rng.range(0.5, 0.9), col);
    for (let i = 0; i < 6; i++) part(S, 'smoke', x + S.rng.range(-6, 6), y + 4, S.rng.range(-20, 20), S.rng.range(-25, -5), S.rng.range(0.5, 0.9), m === 'fridge' ? '#cfe8ff' : '#4a4a5a');
    if (m === 'glass' || m === 'elec' || m === 'vault' || m === 'scrap') for (let i = 0; i < 12; i++) part(S, 'spark', x, y, S.rng.range(-90, 90), S.rng.range(-120, -20), S.rng.range(0.2, 0.5), col);
    if (m === 'fridge') for (let i = 0; i < 10; i++) part(S, 'smoke', x + S.rng.range(-4, 4), y, S.rng.range(-30, 30), S.rng.range(-8, 8), 1.2, '#dff0ff');
    ring(S, x, y + 6, m === 'vault' ? 22 : 14, m === 'vault' ? P.g : col);
    S.tlights.push({ x, y: y - 2, r: m === 'vault' ? 70 : 45, col: m === 'vault' ? '#ffd860' : '#ffe0b0', a: 0.9, decay: 3 });
    addShake(S, m === 'vault' || m === 'wood' ? 0.15 : 0.06);
  }
  function placeContainers(S, rng, n) {
    const A = S.A, kinds = { market: ['register', 'register', 'locker', 'crate'], hangar: ['toolbox', 'crate', 'locker'], factory: ['toolbox', 'crate', 'crate'], depot: ['toolbox', 'safe', 'crate'], ruin: ['locker', 'crate'] }[S.st.type] || ['crate'];
    for (let k = 0, tries = 0; k < n && tries < 300; tries++) {
      const tx = rng.int(2, A.tw - 3), ty = rng.int(4, A.floorBottom - 2);
      if (A.solid[ty * A.tw + tx]) continue;
      const x = tx * TS + 8, y = ty * TS + 12;
      if (Math.hypot(x - A.spawn.x, y - A.spawn.y) < 50 || S.containers.some(c => Math.hypot(c.x - x, c.y - y) < 40) || (Math.abs(x - A.w / 2) < 24 && ty < 5)) continue;
      let kind = rng.pick(kinds); if (S.st.tier >= 2 && rng.chance(0.12)) kind = 'safe';
      S.containers.push(newContainer(S, rng, kind, x, y, CONT[kind].bonus || 0));
      A.solid[ty * A.tw + tx] = 1; k++;
    }
  }
  // 容器里是一个格子网；东西按三角洲的样子摆好，搜的时候一件件揭开
  // 爆率（2026-11-15 试玩）：普通容器有的是空的、有的少一件。高价值容器（pure）、门禁柜、陷阱箱、空投、剧情箱、训练场不减
  const KEEP = { supply: 1, e17: 1, trapcrate: 1 };
  function thin(S, rng, kind, C) { const T = D.TUNE.loot; if (S.tut || !T || C.pure || C.locked || KEEP[kind]) return 0; if (rng.chance(T.empty)) return 99; return rng.chance(T.fewer) ? 1 : 0; }
  function newContainer(S, rng, kind, x, y, bonus, extra) {
    const C = CONT[kind], grid = D.Grid.make(C.g[0], C.g[1]);
    const put = (id, n) => { D.Grid.add(grid, id, n); };
    for (let i = 0, n = rng.int(C.n[0], C.n[1]) + (S.raid && S.raid.pas && S.raid.pas.scav && rng.chance(0.25) ? 1 : 0) + (S.st && S.st.type === 'blackout' && rng.chance(0.3) ? 1 : 0) - thin(S, rng, kind, C); i < n; i++) { const r = rollItem(S, rng, bonus, C); put(r.id, r.n); } // 拾荒手：多一件
    if (extra) for (const id of extra) put(id, 1);
    for (const e of grid.items) e.seen = false;
    grid.items.sort((a, b) => a.y - b.y || a.x - b.x);
    return { kind, x, y, grid, items: grid.items, opened: false, rt: 0, locked: !!C.locked };
  }
  D.newContainer = newContainer;
  // 掷一件东西：先按站点危险等级掷品质，再在这个品质里挑
  // 掷一件东西：先按站点危险等级掷品质，再挑种类（弹药、药、背包、装备卡、普通物品）。返回 { id, n }
  function rollItem(S, rng, bonus, C) {
    const odds = D.QUALITY_ODDS[S.st.tier].map((w, i) => [i, w]);
    let q = rng.weighted(odds);
    const dl = (S.raid && D.DIFF[S.raid.diff || 0] ? D.DIFF[S.raid.diff || 0].loot : 0) + (D.cityLootBump ? D.cityLootBump(S) : 0); // 难度 + 城市（cities.js）
    for (let b = 0; b < (bonus || 0) + dl; b++) if (rng.chance(0.6)) q = Math.min(5, q + 1);
    if (S.raid && S.raid.pas && S.raid.pas.lucky && rng.chance(0.06)) q = Math.min(5, q + 1); // 幸运星
    if (C && C.qShift) q = D.clamp(q + C.qShift + (rng.chance(0.04) ? 3 : 0), 0, 5); // 垃圾桶：大多更差，偶尔捡漏
    const pure = C && C.pure, ammoP = pure ? 0 : C && C.ammoP != null ? C.ammoP : C && C.ammo ? 0.75 : 0.16, medP = pure ? 0 : C && C.medP != null ? C.medP : C && C.meds ? 0.7 : 0.08;
    if (rng.chance(ammoP)) return rollAmmo(S, rng, Math.min(4, 1 + Math.floor(q / 1.4)));
    if (rng.chance(medP)) { const k = rng.weighted([['patch', 5], ['medkit', 3], ['cell', 2], ['frag', 1.6], ['freeze', q >= 1 ? 0.8 : 0], ['emp', q >= 1 ? 0.8 : 0], ['smoke', q >= 1 ? 0.7 : 0], ['flash', q >= 1 ? 0.6 : 0], ['bigcell', q >= 2 ? 0.7 : 0], ['nanogel', q >= 1 ? 0.8 : 0], ['medkit2', q >= 3 ? 0.6 : 0], ['cell3', q >= 3 ? 0.5 : 0], ['incend', q >= 1 ? 0.6 : 0], ['cluster', q >= 2 ? 0.5 : 0]]); return { id: 'use:' + k, n: k === 'patch' ? rng.int(1, 3) : 1 }; }
    if (!pure && rng.chance(C && C.bagP || 0.03) && q >= 1) { const bs = Object.keys(D.BAGS).filter(k => D.BAGS[k].q === Math.min(4, q)); if (bs.length) return { id: 'bag:' + rng.pick(bs), n: 1 }; }
    if (!pure && D.Growth) { const gr = D.Growth.rollGear(rng, q, C); if (gr) return gr; } // 配件、改装件、蓝图
    if (!pure) { const kc = D.rollKey(rng, S.st.tier); if (kc) return kc; } // 门禁卡：很少
    if (!pure && rng.chance(C && C.cards ? (C.cards === true ? 0.6 : C.cards) : ((D.TUNE.loot || {}).cards || 0.12)) && q >= 1) { const cs = Object.keys(D.CARDS).filter(k => !D.CARDS[k].free && D.CARDS[k].q === Math.min(5, q)); if (cs.length) return { id: 'card:' + rng.pick(cs), n: 1 }; }
    if (!pure && D.rollLineItem) { const li = D.rollLineItem(rng, S.st, q); if (li) return li; } // 主题线的特产
    let pool = Object.keys(D.ITEMS).filter(k => D.ITEMS[k].q === q && !D.ITEMS[k].noLoot);
    if (C && C.cats && (C.pure || rng.chance(C.lean == null ? 1 : C.lean))) { for (let qq = q; qq >= 0; qq--) { const p2 = Object.keys(D.ITEMS).filter(k => D.ITEMS[k].q === qq && C.cats.includes(D.ITEMS[k].cat)); if (p2.length) { pool = p2; break; } } }
    const id = rng.pick(pool), st = D.ITEMS[id].stack;
    return { id, n: st > 1 ? rng.int(1, Math.min(st, 3)) : 1 };
  }
  const AMMO_DROP_MUL = 0.5; // 试玩：掉的子弹太多，每堆数量砍半（敌人掉的、箱子里的、事件给的都走这里；商店、工坊按整组不受影响）
  function rollAmmo(S, rng, maxTier, cal) {
    const gunCal = D.gunCal(S.raid) || 'nail';
    cal = cal || (rng.chance(0.5) ? gunCal : rng.pick(Object.keys(D.CALIBER)));
    const t = Math.max(1, Math.min(maxTier, rng.weighted([[1, 5], [2, 3 + S.st.tier], [3, 1 + S.st.tier * 1.5], [4, S.st.tier >= 2 ? S.st.tier : 0]])));
    const pk = D.CALIBER[cal].pack;
    return { id: 'ammo:' + cal + ':' + t, n: Math.max(1, Math.round(pk * rng.range(0.4, 1.1) * AMMO_DROP_MUL)) };
  }
  D.revealTime = id => D.TUNE.revealBase + D.itemInfo(id).q * D.TUNE.revealPerQ;
  D.containerDone = c => c.items.every(o => o.seen !== false);

  // 地上的弹药堆：设置里开了"自动捡弹药"才靠近自动捡（飘字带上名字：试玩时"紫色 +13"看不懂是什么）；
  // 默认关：弹药堆落地后变成普通的地上东西，和别的东西一样按 F 或在拾取框里捡
  function dropsStep(S) {
    const p = S.player, ST = D.settings || {}; if (p.hp <= 0) return;
    for (const d of S.drops) {
      if (d.f != null && d.f !== S.f) continue;
      d.t += D.DT;
      if (!ST.autoAmmo) { if (d.t >= 0.4 && d.n > 0) { S.ground.push({ x: d.x, y: d.y, f: d.f != null ? d.f : S.f, id: d.id, n: d.n, t: 0.4 }); d.n = 0; } continue; }
      if (d.t < 0.4 || Math.hypot(d.x - p.x, d.y - p.y) > D.TUNE.pickupR) continue;
      const before = d.n; d.n = D.bagIn(S.raid, d.id, d.n); // 弹药先进子弹袋
      if (d.n < before) { const it = D.itemInfo(d.id); text(S, p.x, p.y - 22, '+' + (before - d.n) + ' ' + it.name, D.QUALITY[it.q].col); S.events.push({ type: 'pickup', id: d.id, n: before - d.n }); sfx('coin'); }
      else if (!d.full) { d.full = true; text(S, d.x, d.y - 12, 'FULL', P.r); }
    }
    S.drops = S.drops.filter(d => d.n > 0);
    for (const g of S.ground) g.t += D.DT;
    S.ground = S.ground.filter(g => g.n > 0);
    S.groundNear = p.hp > 0 && !S.over ? S.ground.filter(g => g.f === S.f && !g.dropped && g.t > 0.35 && Math.hypot(g.x - p.x, g.y - p.y) < D.TUNE.groundR) : [];
    for (const g of S.groundNear) {
      if (g.auto || g.dropped || g.t < 0.6) continue;
      const it = D.itemInfo(g.id), want = (ST.autoAmmo && g.id.startsWith('ammo:')) || (ST.autoMeds !== false && it.kind === 'use') || (ST.autoQ >= 0 && it.kind === 'item' && it.q >= ST.autoQ);
      if (want) { g.auto = true; D.takeGround(S, g, true); }
    }
  }
  // 捡地上的一件（能塞多少塞多少）。返回捡了几个
  D.takeGround = function (S, g, quiet) {
    if (!g || g.dropped) return 0; // 自己丢掉的捡不回来（用户定：所有东西丢了都不许再捡）
    const before = g.n; g.n = D.bagIn(S.raid, g.id, g.n); // 弹药先进子弹袋
    const got = before - g.n, p = S.player;
    if (got && !(p.act && p.act.k !== 'pick')) D.playerAct(p, 'pick', 0.28);
    if (got) { const it = D.itemInfo(g.id); text(S, g.x, g.y - 12, it.name + (got > 1 ? ' x' + got : ''), D.QUALITY[it.q].col); ring(S, g.x, g.y - 2, 8 + it.q * 2, D.QUALITY[it.q].col); S.tlights.push({ x: g.x, y: g.y, r: 30 + it.q * 10, col: D.QUALITY[it.q].col, a: 0.8, decay: 3 }); sfx(it.q >= 4 ? 'rare' : 'coin'); S.events.push({ type: 'pickup', id: g.id, n: got }); }
    else if (!quiet) { text(S, p.x, p.y - 26, 'FULL', P.r); sfx('nope'); }
    S.ground = S.ground.filter(o => o.n > 0); S.groundNear = S.groundNear.filter(o => o.n > 0);
    return got;
  };
  D.takeAllGround = function (S) {
    let n = 0; for (const g of S.groundNear.slice().sort((a, b) => D.itemInfo(b.id).q - D.itemInfo(a.id).q)) n += D.takeGround(S, g, true);
    if (!n) { text(S, S.player.x, S.player.y - 26, 'FULL', P.r); sfx('nope'); }
    return n;
  };
  // 从背包丢一组到脚下
  // 行动中换枪 / 近战：新卡装上；换下来的卡交给 put（放回背包或丢在脚下）；换枪时弹匣里的子弹退回背包，再从背包装满新枪
  D.keyLevel = id => D.KEY_LEVEL[id] || 0;
  D.isKey = id => !!D.KEY_LEVEL[id];
  const keyGrids = R => [R.keycase, R.bag].filter(Boolean);
  D.hasKey = (R, lv) => keyGrids(R).some(g => D.Grid.count(g, id => D.keyLevel(id) >= lv) > 0);
  D.useKey = function (R, lv) { // 用够格的里面最低级的那张（卡包和背包都找）
    let best = null, bg = null; for (const g of keyGrids(R)) for (const e of g.items) { const l = D.keyLevel(e.id); if (l >= lv && (!best || l < D.keyLevel(best.id))) { best = e; bg = g; } }
    if (!best) return false; D.Grid.take(bg, best.id, 1); return true;
  };
  // 背包里的门禁卡自动收进卡包（卡包有空位的话）
  D.stowKeys = function (R) {
    if (!R.keycase) return 0; let n = 0;
    for (const e of R.bag.items.slice()) if (D.isKey(e.id) && D.Grid.canAdd(R.keycase, e.id, e.n)) { D.Grid.add(R.keycase, e.id, e.n); D.Grid.remove(R.bag, e); n++; }
    return n;
  };
  // 掷一张门禁卡：越往市中心越常见、等级越高
  D.rollKey = function (rng, tier) {
    if (!rng.chance(D.KEY_DROP.base + D.KEY_DROP.perTier * (tier | 0))) return null;
    const w = [[[1, 1]], [[1, 8], [2, 2]], [[1, 55], [2, 38], [3, 7]], [[1, 40], [2, 45], [3, 15]]][Math.min(3, tier | 0)];
    return { id: 'key' + rng.weighted(w), n: 1 };
  };
  // 丢掉的东西（dropped）留在地上但捡不回来：拾取框、附近列表、F、单击、磁吸都不算它。每一趟第一次丢时提醒一句
  const dropTold = S => { if (S.dropTold) return; S.dropTold = 1; if (D.UI && D.UI.toast) D.UI.toast('丢掉的东西捡不回来'); };
  D.dropAt = function (S, id, n) { const p = S.player; S.ground.push({ x: p.x + S.rng.range(-8, 8), y: p.y + S.rng.range(2, 8), f: S.f, id, n, t: -0.6, dropped: true }); dropTold(S); };
  D.equipCard = function (S, k, put, slot0) { // slot0：装进哪个槽（武器两个槽刀枪通用，wslots.js）；不给就按卡本来的槽
    const R = S.raid, p = S.player, G = D.Grid, c = D.CARDS[k], slot = slot0 || c.slot, old = R.load[slot], wasActive = D.isGun(old) && D.gunKey(R) === slot;
    D.playerAct(p, 'swap', 0.5, c.gun ? 'gun' : c.melee ? 'melee' : slot);
    if (wasActive) { const oc = D.CARDS[old].gun.cal, id = 'ammo:' + oc + ':' + (R.magTier || 1); if (p.mag > 0) { const left = G.add(R.bag, id, p.mag); if (left) D.dropAt(S, id, left); } p.mag = 0; R.mag = 0; R.magSeg = []; R.sup = 0; p.reload = 0; }
    R.load[slot] = k; R.pf.load[slot] = k;
    if (old && !D.CARDS[old].free) put('card:' + old);
    if (c.gun) { // 新枪拿在手上：手上原来那把（另一个槽的）弹匣先收起来
      const cur = R.gk; if (cur && cur !== slot && D.isGun(R.load[cur])) { (R.mags || (R.mags = {}))[cur] = { mag: p.mag | 0, seg: (R.magSeg || []).map(x => x.slice()), tier: R.magTier || 1, sup: R.sup || 0 }; R.mag = p.mag = 0; R.magSeg = []; R.sup = 0; }
      R.gk = slot; D.loadMag(R, D.gunOf(R.pf, k, R).mag); p.mag = R.mag; p.fireCd = 0.35; p.ads = 0; p.bloom = 0;
    } else if (wasActive) { // 手上的枪换成了近战：另一个槽要是还有枪，拿它的弹匣出来
      R.gk = null; const nk = D.WSLOTS.find(x => D.isGun(R.load[x])); if (nk) { const m = (R.mags && R.mags[nk]) || { mag: 0, seg: [], tier: 1, sup: 0 }; if (R.mags) delete R.mags[nk]; R.mag = p.mag = m.mag; R.magSeg = m.seg; R.magTier = m.tier; R.sup = m.sup; R.gk = nk; }
    }
    if (c.melee) R.mk = slot;
    if (D.isWeaponSlot(slot)) p.hand = slot;
    p.charging = false; p.chargeT = 0; p.rHold = 0;
    text(S, p.x, p.y - 26, c.name, D.QUALITY[c.q].col); sfx('draw'); K.ring(S, p.x, p.y - 6, 12, D.QUALITY[c.q].col);
    return true;
  };
  D.equipFromBag = function (S, grid, e) { const k = e.id.slice(5); D.Grid.remove(grid, e); return D.equipCard(S, k, id => { if (D.Grid.add(grid, id, 1)) D.dropAt(S, id, 1); }); };
  D.equipFromGround = function (S, g) { const i = S.ground.indexOf(g); if (i < 0 || g.dropped) return false; S.ground.splice(i, 1); return D.equipCard(S, g.id.slice(5), id => D.dropAt(S, id, 1)); };
  D.isWeaponCard = id => { if (!id.startsWith('card:')) return false; const c = D.CARDS[id.slice(5)]; return !!c && (c.slot === 'gun' || c.slot === 'melee'); };
  D.dropToGround = function (S, grid, e) {
    const p = S.player; D.Grid.remove(grid, e);
    S.ground.push({ x: p.x + S.rng.range(-8, 8), y: p.y + S.rng.range(2, 8), f: S.f, id: e.id, n: e.n, t: -0.6, dropped: true });
    sfx('throw'); dropTold(S);
  };
  // 掉一件东西在地上（往四周散开）
  function scatter(S, x, y, f, id, n) { const a = S.rng() * TAU, d = S.rng.range(4, 14); let gx = x + Math.cos(a) * d, gy = y + Math.sin(a) * d * 0.7; if (D.solidAt(S.floors[f], gx, gy)) { gx = x; gy = y; } S.ground.push({ x: gx, y: gy, f, id, n, t: 0, pop: 0.35 }); }
  function revealStep(S, c, dt) {
    const o = c.items.find(x => x.seen === false); if (!o) return;
    if (c.openT != null && c.openT < OPEN_DUR) return;
    c.rumT = (c.rumT || 0) - dt;
    if (c.rumT <= 0) { c.rumT = S.rng.range(0.12, 0.22); sfx('rummage'); c.jig = 0.08; part(S, 'debris', c.x + S.rng.range(-5, 5), c.y - 10, S.rng.range(-40, 40), S.rng.range(-30, -5), 0.5, S.rng.pick([P[3], P[4], '#6a442c'])); }
    if (c.jig > 0) c.jig -= dt;
    const oq = D.itemInfo(o.id).q;
    if (oq >= 3 && c.teased !== o && c.rt >= D.revealTime(o.id) * 0.45) { c.teased = o; sfx('riser'); }
    c.rt += dt * ({ search: 1.25, hack: 1.4 }[S.SH.trait.k] || 1) * D.fxOf(S.raid).search * (S.scanT > 0 && (S.raid.mast || 1) >= 3 && S.SH.skill.k === 'scan' ? 1.3 : 1) / ((CONT[c.kind] && CONT[c.kind].slow) || 1);
    if (c.rt >= D.revealTime(o.id)) {
      c.rt = 0; o.seen = true; S.raid.noise += 0.1;
      const q = D.itemInfo(o.id).q, col = Q()[q].col;
      ring(S, c.x, c.y - 6, 12 + q * 3, col); S.tlights.push({ x: c.x, y: c.y - 8, r: 30 + q * 14, col, a: 0.6 + q * 0.2, decay: 2.5 });
      if (q >= 3) { S.pillars.push({ x: c.x, y: c.y - 4, col, t: 1.4 + (q - 3) * 0.4, max: 1.4 + (q - 3) * 0.4, q }); for (let i = 0; i < 10 + q * 6; i++) part(S, 'spark', c.x + S.rng.range(-6, 6), c.y - 8, S.rng.range(-40, 40), S.rng.range(-160, -40), S.rng.range(0.4, 0.9), col); }
      sfx('reveal' + q);
      (S.floaters || (S.floaters = [])).push({ art: D.itemInfo(o.id).art, x: c.x, y: c.y - 12, q, t: 0 });
      if (q >= 4) { addShake(S, 0.2 + (q - 4) * 0.2); S.stop = Math.max(S.stop, 0.05 * (q - 3)); }
      S.events.push({ type: 'reveal', c, q });
      // 联机：同一个箱子别人也开着时，他那边也要知道揭开了一件（不然只有正好揭开的那个人的面板重画，先开的人进度条停在已经揭开的那格上）
      if (D.MP && S.players && S.players.length > 1) for (const pl of S.players) if (pl !== S.player && D.MP.of(S, pl, 'lootOpen') === c) { const evs = D.MP.of(S, pl, 'events'); if (evs) evs.push({ type: 'reveal', c, q }); }
    }
  }

  Object.assign(K, { startOpen, openBurst, placeContainers, newContainer, rollItem, rollAmmo, dropsStep, scatter, revealStep });
})(D);
