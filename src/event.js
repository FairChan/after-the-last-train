/* 末班之后 · 未知信号站（地铁站场景）：事件和 NPC 对话的引擎。数据在 evpool-1..5.js（事件）、npc-metro.js（NPC）。
   事件 = { title 标题, w 出现权重, minTier 最低危险等级, text 正文, choices 选项 }
   NPC  = { name 名字, role 身份, col 头像色, tag 一句介绍, start 第一次搭话的节点, again 之后搭话的节点, nodes: { 节点 id: { text, choices } } }
   选项 = { t 标题, sub 小字, cost 花的零件, need(R) 条件, take 从背包拿走的东西 { id, n }, r 结果说明,
            give 给的东西：'loot' 普通 / 'loot+' 高一级 / 'part' 机械部件 / 'med' 药 / 'ammo' 弹药，或者 { id, n }；
            hp 耐久增减（最少留 1，事件不会直接打死人）；alert 警戒增减；money 零件增减；reveal 揭开周围的站；
            clue 剧情线索钩子 'radio' / 'sos'（Story.onEvent 给的东西也进背包）；
            ambush { kind, n, elite } 在本站伏击（不走出站）；
            key 刷掉一张门禁卡（几级）；
            chance 成功率，配 win / lose（各自再覆盖上面的字段）；
            next 对话里接着说的节点 id（没有就结束）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16;
  D.EVENTS = {}; D.NPCS = {};
  D.addEvents = o => { for (const k in o) { o[k].id = k; D.EVENTS[k] = o[k]; } };
  D.addNpcs = o => { for (const k in o) { o[k].id = k; D.NPCS[k] = o[k]; } };

  // 给东西的简写：普通战利品 / 高一级 / 机械部件 / 药 / 弹药（和路上捡的东西同一套掷法）
  const roll = (R, st, rng, bonus, C) => D.K.rollItem({ st, raid: R }, rng, bonus, C);
  const TOKEN = {
    loot: (R, st, rng) => roll(R, st, rng, 0),
    'loot+': (R, st, rng) => roll(R, st, rng, 1),
    part: (R, st, rng) => roll(R, st, rng, 0, { cats: ['part'], pure: true }),
    med: (R, st, rng) => roll(R, st, rng, 0, { cats: ['med'], pure: true }),
    ammo: (R, st, rng) => D.K.rollAmmo({ st, raid: R }, rng, 3),
  };

  D.choiceOK = (R, c) => (!c.cost || R.pf.money >= c.cost) && (!c.need || c.need(R)) && (!c.take || D.Grid.count(R.bag, id => id === c.take.id) >= c.take.n);
  // 按危险等级挑不重复的事件：weighted 抽，抽过的不再抽
  D.pickEvents = function (st, rng, n, avoid) {
    const out = [], pool = Object.keys(D.EVENTS).filter(k => (D.EVENTS[k].minTier || 0) <= (st.tier || 0) && !(avoid && avoid.has(k)));
    while (out.length < n && pool.length) { const k = rng.weighted(pool.map(j => [j, D.EVENTS[j].w || 1])); out.push(k); pool.splice(pool.indexOf(k), 1); }
    return out;
  };
  // 伏击：敌人从站台两头冒出来。站里的东西不用换，只是不再安全了
  D.evAmbush = function (S, spec, rng) {
    const K = D.K, n = spec.n || 2;
    for (let i = 0; i < n; i++) {
      const x = (i % 2 ? S.A.w - 12 * TS : 12 * TS) + rng.range(-8, 8), y = rng.range(13 * TS, 17 * TS);
      K.spawnEnemy(S, spec.kind || 'raider', x, y, 1.2 + i * 0.3, 1, true);
    }
    if (spec.elite) K.spawnEnemy(S, 'engineer', S.A.w / 2, 15 * TS, 1.4, 1, true);
    S.safe = false;
    S.banner = { t: 0, text: '伏击', sub: '站台两头冒出了东西！' };
    if (D.Sfx) D.Sfx.play('slam');
    return n;
  };

  // 选了一项：扣钱、判定、拿东西、改数值。ev = { E（事件或对话节点）, rng, st, S（站，伏击用） }
  D.resolveEvent = function (R, ev, i) {
    const c0 = ev.E.choices[i];
    if (!c0 || !D.choiceOK(R, c0)) return null;
    if (c0.cost) R.pf.money -= c0.cost;
    if (c0.take) D.Grid.take(R.bag, c0.take.id, c0.take.n);
    if (c0.key) D.useKey(R, c0.key); // 刷门禁卡：用够格的里面最低级的那张
    const c = c0.chance != null ? Object.assign({}, c0, ev.rng.chance(c0.chance) ? c0.win : c0.lose) : c0;
    const out = { text: c.r || '', got: [], left: [], next: c.next || null, fight: 0, revealed: 0 };
    if (c.money) R.pf.money = Math.max(0, R.pf.money + c.money);
    if (c.hp) R.hp = D.clamp(R.hp + c.hp, Math.min(1, R.hp), R.maxHp);
    if (c.alert) R.alert = Math.max(0, R.alert + c.alert);
    if (c.reveal) out.revealed = D.relayScan(R.city, R.at);
    const give = (c.give || []).map(g => typeof g === 'string' ? TOKEN[g](R, ev.st, ev.rng) : g);
    if (c.clue && D.Story) { const it = D.Story.onEvent(R, c.clue); if (it) give.push(it); }
    for (const g of give) { if (!g) continue; const left = D.addToBag(R, g.id, g.n); if (g.n - left > 0) out.got.push({ id: g.id, n: g.n - left }); if (left) out.left.push({ id: g.id, n: left }); }
    if (D.Story) D.Story.scanBag(R, null); // 给的东西里有线索纸：读出来
    if (c.ambush && ev.S) out.fight = D.evAmbush(ev.S, c.ambush, ev.rng);
    return out;
  };

  // 站里的东西（只在未知信号站）：NPC 几个、未知信号三个。没有出站闸机：轨道上一直停着一列车，走到站台下沿就上车（train.js 的 D.schedHold）。站台层上找能站人的地方
  D.evSiteSetup = function (S, rng) {
    const A = S.floors[1], used = [];
    const free = (x, y) => { for (const [ox, oy] of [[-6, -5], [6, -5], [-6, 5], [6, 5], [0, 0]]) if (D.solidAt(A, x + ox, y + oy)) return false; return used.every(q => Math.hypot(q.x - x, q.y - y) > 26) && Math.hypot(x - S.player.x, y - S.player.y) > 30 && S.containers.every(c => c.f !== 1 || Math.hypot(c.x - x, c.y - 4 - y) > 22) && (A.stairs || []).every(st => Math.hypot(st.x - x, st.y - y) > 26); };
    const spot = (x0, x1, y0, y1) => { for (let k = 0; k < 300; k++) { const x = rng.range(x0, x1), y = rng.range(y0, y1); if (free(x, y)) { used.push({ x, y }); return { x, y }; } } return null; };
    const objs = [];
    for (const k of rng.shuffle(Object.keys(D.NPCS)).slice(0, 4)) { const p = spot(14 * TS, 50 * TS, 13 * TS, 17 * TS); if (p) objs.push({ kind: 'npc', npc: k, f: 1, x: p.x, y: p.y, talked: 0 }); }
    for (const id of D.pickEvents(S.st, rng, 3)) { const p = spot(12 * TS, 50 * TS, 13 * TS, 17 * TS); if (p) objs.push({ kind: 'sig', evId: id, f: 1, x: p.x, y: p.y, used: false }); }
    S.evObjs = objs;
    return objs;
  };

  // 站内交互：走近 NPC / 未知信号。范围里的每一个都交成候选（D.Pick 选最近的，interact.js）
  D.evSiteCands = function (S, add) {
    const p = S.player;
    for (const o of S.evObjs || []) {
      if (o.f !== S.f) continue; const d = Math.hypot(o.x - p.x, o.y - 4 - p.y); if (d >= 22) continue;
      if (o.kind === 'sig' && o.used) add({ ref: o, x: o.x, y: o.y - 4, d, key: '', text: '这个信号已经收完了' });
      else {
        let text = '调查未知信号';
        if (o.kind === 'npc') text = '和' + D.NPCS[o.npc].name + '说话';
        add({ ref: o, x: o.x, y: o.y - 4, d, key: 'F', text, go: inp => { if (inp.interact) D.talkOpen(S, o); } });
      }
    }
  };
  // 老接口：只看信号站自己的东西。返回 true 表示范围里有
  D.evSiteInteract = (S, inp) => D.Pick.solo(S, inp, D.evSiteCands);

  // 开始对话：NPC 第一次搭话走 start，之后走 again；未知信号直接是它的事件
  D.talkOpen = function (S, o) {
    const R = S.raid, n = o.kind === 'npc' ? o.talked : 0;
    const rng = D.rng(R.city.seed + ':talk:' + S.st.id + ':' + S.step + ':' + (o.npc || o.evId) + ':' + n);
    if (o.kind === 'npc') {
      const N = D.NPCS[o.npc];
      o.talked = n + 1;
      S.talk = { obj: o, kind: 'npc', name: N.name, role: N.role, col: N.col, tag: N.tag, ev: { E: N.nodes[n ? N.again : N.start], rng, st: S.st, S }, res: null, done: false };
    } else {
      S.talk = { obj: o, kind: 'sig', name: '未知信号', role: '', col: '#3ee8ff', tag: '', ev: { E: D.EVENTS[o.evId], rng, st: S.st, S }, res: null, done: false };
    }
    S.lootOpen = null;
    S.events.push({ type: 'talk' }); // 主循环里画对话面板（main.js）
    if (D.Sfx) D.Sfx.play('click');
    return S.talk;
  };
  // 选了一项：有下一句就接着说（上一句的结果留在上面），没有就结束
  D.talkChoose = function (S, i) {
    const T = S.talk; if (!T || T.done) return null;
    const out = D.resolveEvent(S.raid, T.ev, i);
    if (!out) { if (D.Sfx) D.Sfx.play('nope'); return null; }
    const N = T.kind === 'npc' ? D.NPCS[T.obj.npc] : null;
    if (out.next && N && N.nodes[out.next]) { T.ev = Object.assign({}, T.ev, { E: N.nodes[out.next] }); T.res = out; }
    else { T.res = out; T.done = true; if (T.kind === 'sig') T.obj.used = true; }
    return out;
  };
  D.talkClose = function (S) { S.talk = null; };
  // 对话时站着不动：走远了（离开了人或信号）就算结束
  D.talkNear = function (S) { const o = S.talk && (S.talk.near || S.talk.obj); return !!o && o.f === S.f && Math.hypot(o.x - S.player.x, o.y - S.player.y) < 44; };
})(D);
