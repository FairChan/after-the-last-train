/* 末班之后 · 事件站（未知信号）= 一场剧情屋式的对话。
   进站不再加载地图：挑一个事件，在事件屋里演完，演完回线路图。只说话、只选，不操作。
   事件台词在 story/事件剧情.md，tools/build-evtalk.mjs 编译成 src/evtalk-data.js（E.addCast / E.add）和英文 src/i18n-en-evtalk.js。
   事件的结果是大的：耐久、警戒、整件值钱货、坐车跳站、揭开整片线路图、拿到工壳、拿到主线线索，
   还有改城市的（这座站以后成了流民营 / 塌了 / 成了出发站），存在主线 flags 里，读档时补上（evw）。
   一个事件一趟里只出现一次；@again 以外的事件一辈子只出现一次（evd_ 事件 id）。有的事件只在别的事件选过某项以后才出现（@when flag:…）。
   测试和自动玩家（没有存档位）不开剧情屋：按每组第一个能选的项直接走完（D.EvTalk.force = true 才演）。
   设计：design/features/event-talk/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const E = D.EvTalk = { force: false, off: false, EVENTS: {}, CAST: {}, cur: null }; // off：老的站台地图那一套（只给一键测试 47/49 测老代码用）
  const Gr = () => D.Grid, S0 = pf => D.Story.S(pf), G = () => D.Game;
  const tr = t => (D.tr ? D.tr(t) : t);
  const fmt = (t, ...a) => tr(t).replace(/\{(\d+)\}/g, (_, i) => tr(String(a[+i])));

  // ── 数据（evtalk-data.js 调）
  E.addCast = o => { for (const k in o) { E.CAST[k] = o[k]; if (D.Dlg) D.Dlg.CAST[k] = { id: o[k].id, col: o[k].col, cps: o[k].cps || 22, voice: o[k].voice || null }; } };
  E.add = list => { for (const s of list) { E.EVENTS[s.id] = s; D.Dlg.add([s]); } };
  if (D.STATION_TYPES && D.STATION_TYPES.event) D.STATION_TYPES.event.desc = '信号那头有人在等。进站只有一场对话：你选什么，这一趟、甚至这座城就往哪边走';

  // ── 条件：剧情的条件以外，事件里还能写这些（选项后面的 ?…、@if、场次头的 @when）
  //   bag:金条/金表 背包里有其中一样；hp>=N / hp<N 这一趟的耐久；alert>=N；money>=N；bagv>=N 背包总值；
  //   can:线索 这条线索现在能拿到（前置都有了、还没有）；seen:场次；shell:型号 有这台工壳；tier>=N 站的地区；roll:N 百分之 N 的机会（种子定死）
  const cond0 = D.Dlg.cond;
  const NUM = /^(hp|alert|money|bagv|tier)(>=|<=|>|<)(\d+)$/;
  E.cond = function (pf, c) {
    if (typeof c !== 'string') return cond0(pf, c);
    if (c[0] === '!') return !D.Dlg.cond(pf, c.slice(1));
    const R = E.cur && E.cur.R, m = c.match(NUM);
    if (m) {
      const v = { hp: R ? R.hp : 0, alert: R ? R.alert : 0, money: pf.money, bagv: R ? D.bagValue(R) : 0, tier: E.cur && E.cur.st ? E.cur.st.tier || 0 : 0 }[m[1]], n = +m[3];
      return m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : v < n;
    }
    const i = c.indexOf(':'), k = c.slice(0, i), v = c.slice(i + 1);
    if (k === 'bag') return !!R && v.split('/').some(id => Gr().count(R.bag, y => y === id) > 0);
    if (k === 'can') return !!D.Story.CLUE[v] && D.Story.avail(pf, D.Story.CLUE[v]);
    if (k === 'seen') return !!(S0(pf).seen || {})[v];
    if (k === 'shell') return !!(pf.shells[v] && pf.shells[v].own);
    if (k === 'roll') { const r = E.cur ? E.cur.rng : Math.random; return (typeof r === 'function' ? r() : r.next()) * 100 < +v; }
    return cond0(pf, c);
  };
  D.Dlg.cond = E.cond;

  // ── 动作：在事件里改这一趟、改城市。cur = { R, st, rng, fx[] }，不在行动里（开发面板预览）就什么也不做
  const A = D.Dlg.ACT, fx = (t, ...a) => { if (E.cur) E.cur.fx.push(fmt(t, ...a)); };
  const nameOf = id => D.itemInfo(id).name;
  const sign = n => (n > 0 ? '+' : '') + n;
  function give(R, id, n) {
    const left = D.addToBag(R, id, n);
    if (n - left > 0) fx('得到：{0}', nameOf(id) + (n - left > 1 ? ' ×' + (n - left) : ''));
    if (left) fx('背包满了，没带走：{0}', nameOf(id));
  }
  const OPS = {
    hp(R, a) { if (a[0] === 'full') { R.hp = R.maxHp; fx('耐久回满'); return; } const n = +a[0]; R.hp = D.clamp(R.hp + n, 1, R.maxHp); fx('耐久 {0}', sign(n)); },
    maxhp(R, a) { const n = +a[0]; R.maxHp = Math.max(10, R.maxHp + n); R.hp = D.clamp(R.hp + Math.max(0, n), 1, R.maxHp); fx('这一趟耐久上限 {0}', sign(n)); },
    alert(R, a) { if (a[0] === '=0') { R.alert = 0; fx('警戒清零'); return; } const n = +a[0]; R.alert = Math.max(0, R.alert + n); fx('警戒 {0}', sign(n)); },
    // @loot 物品 n｜@loot roll n 加几档：按这站的地区掷值钱货（只出金属、贵重、电子、部件）｜@loot med / ammo n
    loot(R, a) {
      const k = a[0], n = +a[1] || 1, st = E.cur.st, rng = E.cur.rng;
      if (k === 'roll' || k === 'med' || k === 'part') {
        const C = k === 'roll' ? { cats: ['metal', 'val', 'elec', 'part'], pure: true } : { cats: [k], pure: true };
        for (let i = 0; i < n; i++) { const r = D.K.rollItem({ st, raid: R }, rng, k === 'roll' ? (+a[2] || 1) : 0, C); give(R, r.id, r.n); }
      } else if (k === 'ammo') { for (let i = 0; i < n; i++) { const r = D.K.rollAmmo({ st, raid: R }, rng, 3); give(R, r.id, r.n); } }
      else give(R, k, n);
    },
    // @take best：背包里单价最高的一件｜@take 物品 n｜@take any 金条/金表：其中一样（选项的 ?bag: 已经保证有）
    take(R, a) {
      const its = R.bag.items.filter(e => { const it = D.itemInfo(e.id); return it.kind !== 'quest' && it.kind !== 'clue'; });
      let id = a[0], n = +a[1] || 1;
      if (id === 'best') { if (!its.length) { fx('背包是空的，没东西可拿'); return; } id = its.reduce((b, e) => (D.itemInfo(e.id).v > D.itemInfo(b.id).v ? e : b)).id; n = 1; }
      else if (id === 'any') { id = a[1].split('/').find(x => Gr().count(R.bag, y => y === x) > 0); n = 1; if (!id) return; }
      const got = Gr().take(R.bag, id, n); if (got) fx('交出去了：{0}', nameOf(id) + (got > 1 ? ' ×' + got : ''));
    },
    // @reveal near：周围三站（和中继台一样）｜@reveal city：整张线路图（剧情藏着的站除外）
    reveal(R, a) {
      const C = R.city; let n = 0;
      if (a[0] === 'city') { for (const s of C.stations) if (!s.dead && !s.reserve && s.type !== 'reserve' && C.known.get(s.id) < 1) { C.known.set(s.id, 1); n++; } }
      else n = D.relayScan(C, R.at);
      fx('线路图上揭开了 {0} 个站', n);
    },
    // @exit：最近的隐藏撤离点（没有就是最近的撤离站）在线路图上标出来
    exit(R) {
      const C = R.city, d = D.cityDist(C, R.at), cand = C.stations.filter(s => !s.dead && s.exit && !s.reserve && d.has(s.id)).sort((x, y) => d.get(x.id) - d.get(y.id));
      const s = cand.find(s => s.exit === 'hidden' && !(C.found && C.found.has(s.id))) || cand[0]; if (!s) return;
      C.found = C.found || new Set(); if (s.exit === 'hidden') C.found.add(s.id); if (C.known.get(s.id) < 1) C.known.set(s.id, 1);
      fx('撤离点：{0}', s.name);
    },
    // @warp deep：坐车到离据点最远、地区最深的站｜@warp exit：送到离撤离站一站的地方
    warp(R, a) {
      const C = R.city, home = D.cityDist(C, C.home), here = D.cityDist(C, R.at);
      const ok = s => !s.dead && !s.home && !s.reserve && s.type !== 'reserve' && s.type !== 'event' && !R.visited.has(s.id) && !(s.hidden && C.known.get(s.id) < 1) && home.has(s.id);
      let to = null;
      if (a[0] === 'exit') {
        const ex = C.stations.filter(s => !s.dead && s.exit && !s.reserve && D.knownExit(C, s)).sort((x, y) => here.get(x.id) - here.get(y.id))[0] || C.stations.filter(s => !s.dead && s.exit && !s.reserve).sort((x, y) => here.get(x.id) - here.get(y.id))[0];
        if (ex) to = [...ex.adj].map(n => C.stations[n]).filter(ok).sort((x, y) => (x.tier || 0) - (y.tier || 0))[0] || null;
      } else to = C.stations.filter(ok).sort((x, y) => ((y.tier || 0) - (x.tier || 0)) || (home.get(y.id) - home.get(x.id)))[0] || null;
      if (!to) return;
      R.from = R.at; R.at = to.id; R.visited.add(to.id); D.scoutAround(C, to.id); E.cur.warped = to.id;
      fx('坐车到了：{0}', to.name);
    },
    // @world settle 类型：这座站以后就是这个类型｜@world collapse n：旁边 n 座站塌了，以后都去不了｜@world entry：以后能从这座站出发
    world(R, a) {
      const C = R.city, st = E.cur.st, s = S0(R.pf);
      const rec = x => { s.flags.evw = (s.flags.evw ? s.flags.evw + ',' : '') + x; };
      if (a[0] === 'settle') { st.type = a[1]; rec(st.id + ':' + a[1]); fx('城里：{0}以后是{1}', st.name, D.STATION_TYPES[a[1]].name); }
      else if (a[0] === 'collapse') {
        let n = +a[1] || 1;
        for (const id of E.rng(E.cur).shuffle([...C.stations[st.id].adj])) { if (n <= 0) break; if (canKill(R, id)) { C.stations[id].dead = true; rec(id + ':dead'); fx('城里：{0}塌了，以后都去不了', C.stations[id].name); n--; } }
      } else if (a[0] === 'entry') { C.entries.add(st.id); fx('以后能从{0}出发', st.name); }
    },
    shell(R, a) { const k = a[0], pf = R.pf; if (!D.SHELLS[k]) return; if (pf.shells[k] && pf.shells[k].own) { fx('你已经有{0}了，换成 {1} 零件', D.SHELLS[k].name, Math.round(D.SHELLS[k].price / 2)); pf.money += Math.round(D.SHELLS[k].price / 2); return; } pf.shells[k] = { own: 1, cond: D.clamp(+a[1] || 0.5, 0.05, 1) }; fx('得到工壳：{0}（放在机库里）', D.SHELLS[k].name); },
    // @lead 线索 [没法拿时改做的动作…]：主线线索要按顺序拿，前置没齐就做后面那个动作
    lead(R, a) { const pf = R.pf, c = D.Story.CLUE[a[0]]; if (c && D.Story.avail(pf, c)) { D.Story.learn(pf, a[0], '未知信号站里听来的', R.at); fx('线索：{0}', c.title); } else if (a[1] && OPS[a[1]]) OPS[a[1]](R, a.slice(2)); },
    money(R, a) { const n = +a[0]; fx('零件 {0}', sign(n)); }, // 扣加钱本身由剧情的 money 动作做，这里只记一笔
  };
  for (const k in OPS) {
    const prev = A[k];
    A[k] = function (pf, a, raw) { if (prev) prev(pf, a, raw); if (E.cur && E.cur.R && E.cur.R.pf === pf) OPS[k](E.cur.R, a, raw); };
  }
  // 能不能塌：不是据点、出发站、撤离站、储备库、人类据点、这一趟走过的站；塌了以后其他站还都连得上据点
  function canKill(R, id) {
    const C = R.city, s = C.stations[id];
    if (!s || s.dead || s.home || s.exit || s.reserve || s.type === 'reserve' || s.type === 'outpost' || s.hidden || C.entries.has(id) || R.visited.has(id)) return false;
    s.dead = true;
    const seen = new Set([C.home]), q = [C.home];
    while (q.length) { const x = q.shift(); for (const n of C.stations[x].adj) if (!seen.has(n) && !C.stations[n].dead) { seen.add(n); q.push(n); } }
    const ok = C.stations.every(o => o.dead || seen.has(o.id));
    s.dead = false; return ok;
  }
  E.canKill = canKill;
  E.rng = c => c.rng;

  // 读档：把事件改过的城市补上（主线 flags.evw = "站:类型,站:dead,…"）
  E.applyWorld = function (pf) {
    const w = S0(pf).flags.evw; if (!w || !pf.city) return;
    for (const x of String(w).split(',')) { const [id, t] = x.split(':'), s = pf.city.stations[+id]; if (!s) continue; if (t === 'dead') s.dead = true; else if (D.STATION_TYPES[t]) s.type = t; }
  };
  { const des0 = D.Story.deserialize; D.Story.deserialize = function (pf) { const r = des0.apply(this, arguments); E.applyWorld(pf); return r; }; }

  // 长期的好处：阿苔帮你看路（每趟出发揭开三个站）；裁决机给你登了记（每走一站警戒少涨一半）
  { const sr0 = D.startRaid; D.startRaid = function (pf) { const R = sr0.apply(this, arguments); if (S0(pf).flags.atai === 'helped' && !R.tut) { const got = D.buyIntel(pf.city, 3); R.evSpot = got.length; } return R; }; }
  { const tv0 = D.travel; D.travel = function (R) { const a0 = R.alert, r = tv0.apply(this, arguments); if (R.pf && S0(R.pf).flags.ev_court === 1) R.alert -= Math.min(0.5, R.alert - a0); return r; }; }

  // ── 挑事件：条件满足、没出过（@again 的除外）、地区够；接着上一件事的（@when flag:…）权重大
  // kind：'big' 大事件 / 'small' 问号站的小剧情屋 / 不写就两堆都要。屋里的剧情（@in）不在问号站出（roomtalk.js 管）
  E.eligible = function (R, st, kind) {
    const pf = R.pf, s = S0(pf), out = [];
    E.cur = { R, st, rng: D.rng('evpick'), fx: [] };
    try {
      for (const id in E.EVENTS) {
        const ev = E.EVENTS[id];
        if (ev.in) continue;
        if (kind === 'big' && ev.small || kind === 'small' && !ev.small) continue;
        if (ev.st && !ev.st.includes(st.type)) continue;
        if (!ev.again && s.flags['evd_' + id]) continue;
        if ((ev.tier || 0) > (st.tier || 0)) continue;
        if (ev.need && !ev.need.every(c => D.Dlg.cond(pf, c))) continue;
        out.push(id);
      }
    } finally { E.cur = null; }
    return out;
  };
  // 先掷大小（四次里一次大事件，design/features/mini-rooms），那一堆没有能抽的就抽另一堆；再在堆里按权重抽
  E.BIG_SHARE = 0.25;
  E.pick = function (R, st) {
    const rng = D.rng(R.city.seed + ':evtalk:' + R.pf.raids + ':' + st.id);
    const first = rng() < E.BIG_SHARE ? 'big' : 'small';
    let ids = E.eligible(R, st, first); if (!ids.length) ids = E.eligible(R, st, first === 'big' ? 'small' : 'big');
    if (!ids.length) return null;
    const once = ids.filter(id => !E.EVENTS[id].again), pool = once.length ? once : ids;
    return rng.weighted(pool.map(id => [id, E.EVENTS[id].w || 1]));
  };

  // 这一场的屋子：底屋（evtalk-rooms.js）+ 这场的人（场次头 @cast）+ 摆设（@props），名字是这座站
  E.roomFor = function (ev, st) {
    const base = D.SROOMS[ev.room] || D.SROOMS.ev_platform, R = Object.create(base);
    R.name = st ? st.name : base.name; R.props = ev.props || []; R.actors = { op: { x: 140, y: 152, face: 1 } };
    let x = 206;
    for (const c of ev.cast || []) {
      // 老角色（阿隼、林桥、广播……）：剧情屋里有样子的就照那个样子站着，没有的只有声音
      const oc = D.Dlg.CAST[c.who], old = oc && Object.values(D.SROOMS).map(r => r.actors && r.actors[oc.id]).find(a => a && a.look);
      let who = E.CAST[c.who] || (oc && (old ? { id: oc.id, look: old.look } : { id: oc.id, kind: 'ghost' })); if (!who) continue;
      if (c.voice) who = Object.assign({}, who, { kind: 'ghost' }); // @cast 名字~：只听得见声音
      if (c.shell) who = Object.assign({}, who, { kind: 'shell', mon: c.shell }); // @cast 名字^型号：这一场是一台站着的工壳
      const a = { x: c.x != null ? c.x : x, y: c.y != null ? c.y : 152, face: -1 };
      if (who.kind === 'ghost' || who.kind === 'mon' || who.kind === 'shell' || who.kind === 'wreck') { a.kind = 'ghost'; a.ev = who.kind; a.mon = who.mon; a.size = who.size || 1; a.fy = a.y; }
      else { a.look = who.look; if (who.pose) a.pose = who.pose; }
      R.actors[who.id] = a; if (c.x == null) x += who.kind === 'mon' ? 36 : 24;
    }
    D.SROOMS['ev:' + ev.id] = R;
    return 'ev:' + ev.id;
  };

  // ── 进站：事件站不加载地图，演一场
  E.enter = function (R, st) {
    const g = G(), pf = R.pf, s = S0(pf);
    const back = (card) => { g.toTravel(); D.Save.checkpointRaid(g.slot, g.raid); if (card && D.UI && D.UI.storyCard) D.UI.storyCard(card.title, card.fx); };
    if (R.revisit) { back({ title: tr(st.name), fx: [tr('人已经走了，信号也断了。这里什么都没有了。')] }); return true; }
    const id = (R.evAt = R.evAt || {})[st.id] || E.pick(R, st);
    if (!id) { back({ title: tr(st.name), fx: [tr('信号只剩下沙沙声。')] }); return true; }
    R.evAt[st.id] = id; s.flags['evd_' + id] = 1;
    const ev = E.EVENTS[id], seed = R.city.seed + ':ev:' + id + ':' + pf.raids + ':' + st.id;
    const cur = E.cur = { R, st, ev, rng: D.rng(seed), fx: [] };
    const sc = D.Dlg.SCENES[id]; sc.room = E.roomFor(ev, st);
    const done = () => { if (E.cur === cur) E.cur = null; const card = { title: tr(ev.title), fx: cur.fx.length ? cur.fx : [tr('什么都没变。')] }; back(card); };
    if (g.slot == null && !E.force && !(D.Scene && D.Scene.force)) { E.runHeadless(id, pf); done(); return true; }
    g.mode = 'station'; // 剧情屋演完不存档：行动中的档在检查点里（scene.js 看上一个模式是不是 station）
    D.Scene.play([id], pf, done);
    return true;
  };
  // 没有画面时：每组选项选第一个能选的，直接走到头
  E.runHeadless = function (id, pf, pickFn) {
    const R = D.Dlg.run(id, pf, { timers: false });
    for (let g = 0; g < 2000 && !R.done; g++) {
      R.skipAll(); if (R.done) break;
      const v = R.view(); if (v.kind !== 'choice') { R.press(); continue; }
      const k = pickFn ? pickFn(v.choices) : v.choices.findIndex(c => c.ok);
      if (k < 0 || !R.pick(k)) break;
    }
    return R;
  };

  // 主循环的 G.enter 包一层：事件站走这里（教学、储备库之类不是 event 类型，不受影响）
  const wrap = () => {
    const g = G(); if (!g || g._evWrapped) return; g._evWrapped = true;
    const enter0 = g.enter;
    g.enter = function (o) { const R = g.raid, st = R && R.city.stations[R.at]; if (st && st.type === 'event' && !R.tut && !E.off && Object.keys(E.EVENTS).length) return E.enter(R, st); return enter0.call(this, o); };
  };
  if (D.Game) wrap(); else (D._late || (D._late = [])).push(wrap);
})(D);
