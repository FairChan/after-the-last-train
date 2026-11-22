/* Underdog：多城市（design/features/multi-city/design.md）
   岚川 → 铁原 → 白沙 → 北渡，一条线。主线解锁下一座（story-act2.js），走过的城一直能回去。
   - 每座城还是 city.js 按种子生成；岚川用存档的种子，别的城用"种子:城名"，生成完再按城的参数改：
     据点改名成当地中继、去掉储备库（剧情只在岚川）、普通站按城的站型权重重抽一部分。
   - 开场警戒、搜到的东西品质往上跳几次，按城加（startAlert、loot.js 的 D.cityLootBump）。
   - pf.city 一直是"现在选的那座城"，老代码不用改；别的城的对象放在 pf.cityObjs（不存档），
     存档里 city 一直是岚川（老版本也读得懂），别的城、现在在哪、解锁了哪些放在 multi（save.js）。
   - 敌人不单独分池：守卫表按站型出、新敌人按威胁等级出，站型权重和开场警戒一改，每座城出的怪就不一样了。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const ORDER = ['lanchuan', 'tieyuan', 'baisha', 'beidu'];
  // types：普通站重抽时的权重（只换普通站，安全站、精英站、高价值站、事件站、中继站不动）；share：重抽多少比例
  // alert0：开场多给的警戒（D.THREAT_AT：1.5 = 2 级，3.5 = 3 级）；loot：品质往上跳几次（每次六成机会 +1 档，和难度一样）
  const CITIES = D.CITIES = {
    lanchuan: { name: '岚川', title: '岚川地铁网', stars: 1, desc: '南栈所在的城。机器官僚城：照常排班、开庭、查证件' },
    tieyuan: { name: '铁原', title: '铁原地铁网', stars: 2, home: '铁原中继', alert0: 1.5, loot: 1, share: 0.85,
      types: { factory: 4, armory: 3, hangar: 3, freight: 2.5, dispatch: 1, ruin: 1, market: 0.5, hospital: 0.5, nest: 0.5 },
      desc: '军工铁路枢纽，战时的导弹总装厂。兵工厂多，机器政权在这里最硬' },
    baisha: { name: '白沙', title: '白沙地铁网', stars: 3, home: '白沙中继', alert0: 3.5, loot: 1, share: 0.7,
      types: { ruin: 3, flooded: 2.5, blackout: 2.5, nest: 2, hospital: 1.5, factory: 1, market: 0.5 },
      desc: '辐射最重的城。东区有一个比别处新的弹坑' },
    beidu: { name: '北渡', title: '北渡地铁网', stars: 4, home: '北渡中继', alert0: 3.5, loot: 2, share: 0.6,
      types: { dispatch: 3, market: 2, hangar: 2, freight: 1.5, ruin: 1.5, hospital: 1, armory: 1, factory: 1 },
      desc: '地底下有一段机器不巡逻的协议线' },
  };
  D.CITY_ORDER = ORDER;
  const keyOf = (seed, key) => key && CITIES[key] ? key : ((String(seed).match(/:(tieyuan|baisha|beidu)$/) || [])[1] || 'lanchuan');
  D.citySeed = (pf, key) => key === 'lanchuan' ? pf.seed : pf.seed + ':' + key;
  D.cityName = C => (CITIES[(C && C.key) || 'lanchuan'] || CITIES.lanchuan).name;
  D.cityTitle = C => (CITIES[(C && C.key) || 'lanchuan'] || CITIES.lanchuan).title;

  // ── 生成：在原来的 makeCity 外面包一层（第三个参数是城；联机客人只拿到种子，按种子的后缀认城）
  const mk0 = D.makeCity;
  D.makeCity = function (seed, ver, key) {
    const C = mk0.apply(this, arguments), k = keyOf(seed, key), P = CITIES[k];
    C.key = k;
    if (k === 'lanchuan') return C;
    try {
      const home = C.stations[C.home]; home.name = P.home;
      // 储备库只在岚川
      if (C.reserve != null) { const r = C.stations[C.reserve]; r.dead = true; for (const o of C.stations) o.adj && o.adj.delete(r.id); C.known.delete(r.id); C.reserve = null; }
      retype(C, P);
    } catch (e) { console.error(e); }
    return C;
  };
  function retype(C, P) {
    const TT = D.STATION_TYPES, rng = D.rng('cityx:' + C.seed), dist = D.cityDist(C, C.home);
    const common = k => TT[k] && !TT[k].cat && !TT[k].safe && !TT[k].hidden;
    const opts = Object.keys(P.types).filter(common);
    for (const s of rng.shuffle(C.stations.filter(s => !s.dead && !s.home && !s.hidden && !s.reserve && common(s.type)))) {
      if (!rng.chance(P.share)) continue;
      const ok = opts.filter(k => (TT[k].minTier || 0) <= s.tier && (TT[k].minDist || 0) <= (dist.has(s.id) ? dist.get(s.id) : 99) && ![...s.adj].some(n => C.stations[n].type === k));
      if (ok.length) { s.type = rng.weighted(ok.map(k => [k, P.types[k]])); s.layout = null; }
    }
  }

  // ── 档案：每座城的进度
  const state = C => ({ ver: C.ver || 1, known: [...C.known], entries: [...C.entries], found: [...(C.found || [])] });
  function applyState(C, o) {
    if (!o) return C;
    C.known = new Map(o.known || []); C.entries = new Set(o.entries || [C.home]);
    C.found = new Set((o.found || []).filter(id => C.stations[id] && C.stations[id].exit === 'hidden'));
    for (const s of C.stations) if (!s.dead && !C.known.has(s.id)) C.known.set(s.id, 0);
    return C;
  }
  function ensure(pf) {
    if (!pf) return pf;
    if (!pf.cityAt) pf.cityAt = (pf.city && pf.city.key) || 'lanchuan';
    if (!Array.isArray(pf.cityOpen)) pf.cityOpen = ['lanchuan'];
    if (!pf.cityObjs) Object.defineProperty(pf, 'cityObjs', { value: {}, writable: true, enumerable: false });
    if (pf.city && !pf.cityObjs[pf.cityAt]) pf.cityObjs[pf.cityAt] = pf.city;
    if (!pf.citySnap) Object.defineProperty(pf, 'citySnap', { value: {}, writable: true, enumerable: false });
    if (!pf.act2) pf.act2 = { brick: null };
    return pf;
  }
  function build(pf, key) {
    ensure(pf);
    if (!pf.cityObjs[key]) { const snap = pf.citySnap[key]; pf.cityObjs[key] = applyState(D.makeCity(D.citySeed(pf, key), snap ? snap.ver : D.CITY_VER, key), snap); }
    return pf.cityObjs[key];
  }
  const isOpen = (pf, key) => ensure(pf).cityOpen.includes(key);
  // 换城：pf.city 换成那座城。岚川换回来时把剧情改过的站（储备库的名字、事件改过的站）补上
  function go(pf, key) {
    if (!CITIES[key] || !isOpen(pf, key)) return false;
    if (ensure(pf).cityAt === key && pf.city) return true;
    pf.city = build(pf, key); pf.cityAt = key;
    if (key === 'lanchuan' && D.Story && D.Story.applyCity) D.Story.applyCity(pf);
    if (D.Cities.onGo) D.Cities.onGo(pf, key); // 第二幕以后的剧情（story-act2.js）：北渡的协议线
    return true;
  }
  function open(pf, key) { ensure(pf); if (CITIES[key] && !pf.cityOpen.includes(key)) pf.cityOpen.push(key); }
  // 存档：city 一直存岚川；别的城放进 multi
  const homeState = pf => state((ensure(pf).cityObjs.lanchuan) || pf.city);
  function save(pf) {
    ensure(pf); const st = {};
    for (const k of ORDER) if (k !== 'lanchuan') { const C = pf.cityObjs[k]; if (C) st[k] = state(C); else if (pf.citySnap[k]) st[k] = pf.citySnap[k]; }
    return { at: pf.cityAt, open: pf.cityOpen.filter(k => CITIES[k]), st, act2: JSON.parse(JSON.stringify(pf.act2 || {})) };
  }
  function load(pf, m) { // deserialize 末尾调：这时 pf.city 是岚川
    pf.cityAt = 'lanchuan'; ensure(pf); pf.cityObjs.lanchuan = pf.city;
    if (!m || typeof m !== 'object') return pf;
    pf.cityOpen = ['lanchuan'].concat((Array.isArray(m.open) ? m.open : []).filter(k => CITIES[k] && k !== 'lanchuan'));
    for (const k in m.st || {}) if (CITIES[k] && k !== 'lanchuan') pf.citySnap[k] = m.st[k];
    pf.act2 = Object.assign({ brick: null }, m.act2 && typeof m.act2 === 'object' ? m.act2 : {});
    if (m.at && m.at !== 'lanchuan') go(pf, m.at);
    return pf;
  }
  D.Cities = { CITIES, ORDER, ensure, build, go, open, isOpen, save, load, homeState, state };

  // 新档
  const np0 = D.newProfile;
  D.newProfile = function () { const pf = np0.apply(this, arguments); ensure(pf); return pf; };

  // ── 开场警戒、搜刮品质
  const sa0 = D.startAlert;
  D.startAlert = function (C) { return sa0.apply(this, arguments) + ((CITIES[(C && C.key) || 'lanchuan'] || {}).alert0 || 0); };
  D.cityLootBump = S => { const C = S && S.raid && S.raid.city; return C && CITIES[C.key] ? CITIES[C.key].loot || 0 : 0; };

  // ── 线路图上的金色线索标记只是岚川的
  if (D.Story && D.Story.marks) { const mk = D.Story.marks; D.Story.marks = function (pf) { return pf && pf.city && pf.city.key && pf.city.key !== 'lanchuan' ? [] : mk.apply(this, arguments); }; }

  // ── 出发页：顶上一排城市页签（解锁了第二座城才出现）
  if (D.UI && D.UI.entryTab) {
    const U = D.UI, et0 = U.entryTab;
    const stars = n => '★'.repeat(n) + '<i>' + '★'.repeat(4 - n) + '</i>';
    U.entryTab = function (pf, body) {
      et0.apply(this, arguments);
      ensure(pf);
      if (pf.cityAt !== 'lanchuan') { // 别的城没有南栈：出发站挨着的是当地中继
        const tr = D.tr || (s => s), near0 = tr('南栈旁边');
        body.querySelectorAll('.ep-name em').forEach(e => { if (e.textContent === near0) e.textContent = tr('中继旁边'); });
        const h = body.querySelector('.ep-head .hint'); if (h) h.textContent = tr('确认出发后直接进这一站探索。可以从中继旁边的站进城；走到线路尽头（地图上的绿色"撤离"牌）撤出来一次，那一站也能当出发站。');
      }
      // 顶上一行：现在在哪座城 + "换城"（打开 3D 选城页，city-pick.js）
      const esc = U._ && U._.esc ? U._.esc : (s => s), P = CITIES[pf.cityAt] || CITIES.lanchuan;
      const bar = `<div class="city-bar"><span class="cb-cur"><b>${esc(P.name)}</b><em>价值 ${stars(P.stars)}</em></span><button class="btn sm cb-switch" data-act="citypick">换城 ▲</button></div>`;
      const host = body.querySelector('.entry-page') || body;
      host.insertAdjacentHTML('afterbegin', bar);
      host.querySelector('[data-act=citypick]').onclick = () => { D.Sfx && D.Sfx.play('click'); if (U.cityPick) U.cityPick(pf); };
    };
  }
})(D);
