/* 末班之后 · 小样二：人类据点（候车厅）。规则、人、对话、换物、提升、托付、人情、存档。
   设计：design/features/outpost/design.md。站内画人在 outpost-art.js，面板在 ui-outpost.js。

   挂钩：
   - 这里的 D.makeStation 包一层：人类据点交给 outpost-town.js（手工布局、人、装饰 F.decor）。
   - station.js：交互 → D.Outpost.interact（提示、按 F 开面板）。
   - main.js：事件 outpost → D.Outpost.open（ui-outpost.js）。
   - 存档：D.Story.serialize / deserialize 包一层，把 pf.story.op 也存进去。
   进度存在 pf.story.op：
     trust  人情 0–10
     seen   看过的对话 {id: true}
     help   做过的托付 {id: true}
     fused  熔炼过几次（决定下一次用哪个随机数）
   换物的货架和"这一趟换过没有"存在 S 上（一趟一次，离站就没了）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Gg = () => D.Grid;

  // ── 数值
  const TUNE = D.OUTPOST_TUNE = {
    trustMax: 10, trustFuse: 2, trustBarter4: 3, trustBarter5: 5, // 人情门槛：熔炼打折、换物多一件、换物多一张卡
    fuseOff: 0.7,                 // 人情够了，熔炼的零件打七折
    barterRatio: 0.9,             // 换物：你给的东西价值不低于货价的这个比例
    barterBase: 4,                // 基础货架件数（配件 / 改装件，2 到 3 级）
    medReward: 200, xmReward: 150, // 托付的零件奖励
    heiCost: 30,                  // 施舍老黑的零件
  };

  // ── 人：name 名字，role 身份，col 小标记的颜色，svc 能做什么（talk 说话、barter 换、fuse 提、quest 托付）
  // pose：stand 站、sit 坐、lie 躺、kid 小孩蹲坐；站在哪儿见 outpost-town.js
  // say：走近时的提示（整句写死，好让英文词典能按句翻）
  const PEOPLE = D.OUTPOST_PEOPLE = {
    su:   { name: '苏医生', role: '诊所医生', col: '#6be08a', svc: 'talk', pose: 'stand', say: '和苏医生说话' },
    fang: { name: '方姨', role: '换物摊主 · 不收钱，只换', col: '#ffb0e0', svc: 'barter', pose: 'stand', say: '和方姨换东西' },
    tie:  { name: '老铁', role: '修械匠 · 熔炼', col: '#9fb4d6', svc: 'fuse', pose: 'stand', say: '和老铁提升东西' },
    zhou: { name: '老周', role: '守钟人', col: '#ffb057', svc: 'talk', pose: 'stand', say: '和老周说话' },
    qing: { name: '青姐', role: '找丈夫的人', col: '#ff9f9f', svc: 'talk', pose: 'sit', say: '和青姐说话' },
    chen: { name: '陈守', role: '门卫', col: '#9bd1ff', svc: 'talk', pose: 'stand', say: '和陈守说话' },
    xie:  { name: '老谢', role: '广播员', col: '#3ee8ff', svc: 'talk', pose: 'sit', say: '和老谢说话' },
    mei:  { name: '阿梅', role: '厨娘', col: '#ffd08a', svc: 'talk', pose: 'stand', say: '和阿梅说话' },
    xm:   { name: '小满', role: '孩子', col: '#fff08a', svc: 'talk', pose: 'kid', say: '和小满说话' },
    hei:  { name: '老黑', role: '乞讨的老人', col: '#a0a0a0', svc: 'talk', pose: 'sit', say: '和老黑说话' },
  };

  // ── 托付：一次性的。pick 是"交一件东西"，否则是"交 n 件 need"
  const QUESTS = D.OUTPOST_QUESTS = {
    med: { npc: 'su', name: '两个医疗包', need: 'use:medkit', n: 2, reward: TUNE.medReward, trust: 2, ask: '诊所的孩子在咳嗽。路过的时候，要是有医疗包，给我两个。', thanks: '苏医生把两个医疗包收进柜子，朝你点点头："这下能撑过这一夜了。"' },
    xm:  { npc: 'xm', name: '一件 2 级以上的配件或改装件', pick: true, reward: TUNE.xmReward, trust: 1, ask: '火车要有车灯，不然晚上开不走。给我一件亮的东西，我挂上去。', thanks: '小满把东西挂在画好的火车上，咯咯地笑出了声。' },
  };

  // ── 对话。pages：一段一段看（可以是函数，按 pf 现算）；choices：末尾的选项（go 返回回话；cost 花零件）；
  //    when(pf)：什么时候能说；onShow(pf)：看完这段时执行（结局的人情）。每段对话只说一次。
  const has = (pf, k) => D.Story.has(pf, k);
  const endingOf = pf => D.Story.S(pf).ending;
  const trustAdd = (pf, n) => { const o = op(pf); o.trust = Math.max(0, Math.min(TUNE.trustMax, (o.trust | 0) + n)); };
  const SCENES = D.OUTPOST_SCENES = [
    { id: 'zhou1', npc: 'zhou', when: () => true, pages: [
      '老周坐在站牌底下，拿一块旧布擦表盘。站牌上的字已经褪了色，只有一行还清楚：E-17 · 末班 · 本站 · 候车。',
      '"那晚我们在这儿等了一整夜。"他没有抬头，"十一点五十，车灯从隧道里亮出来，大家都站了起来。"',
      '"它没停。开过去了，连减速都没有。"',
      '"公告上说是线路改道，班次取消。可我看见的是灯，不是公告。"',
    ] },
    { id: 'zhou2', npc: 'zhou', when: pf => has(pf, 'rumor'), pages: [
      '"你手上那张货票，是 E-17 的？"老周接过去，凑近灯看编号，手抖了一下。',
      '"车上装的是军方的货。我们这些人，一个都不在名单上。"',
    ], choices: [
      { t: '把货票给他看全', go: pf => { trustAdd(pf, 1); return '老周把货票摊平，看了很久。"编号对得上。"他把它还给你，"留着，比我们有用。"'; } },
      { t: '不说了', go: () => '"也好。"老周重新拧紧表盘，没再说话。' },
    ] },
    { id: 'zhou3', npc: 'zhou', when: pf => has(pf, 'dispatch') || has(pf, 'manifest'), pages: [
      '"调度密电的副本，你读过了？"老周问得很轻。',
      '"报告里写，所有列车都去疏散了。可它拉着那批铅罐子和上面的人，从我们眼前冲过去，没停。"',
      '"我们的名字，连名单的边都没碰到。"',
    ], choices: [
      { t: '我会把它说出去', go: pf => { trustAdd(pf, 2); return '"说出去也没人听。"老周苦笑，"可谢谢你肯说。"'; } },
      { t: '这是生意，我不管', go: pf => { trustAdd(pf, -1); return '老周把表盘放回膝上，"生意。"他重复了一遍，"也是。"'; } },
    ] },
    { id: 'zhou_end', npc: 'zhou', when: pf => !!endingOf(pf), pages: pf => ({
      public: ['老周把站牌上的字重新描了一遍，描得很慢。', '"你把它说出去了。"他站起来，第一次正眼看站厅里的人，"这块牌子，今天可以换掉了。"'],
      sell: ['老周没有说话，只把表盘放回桌上。', '"我们的事，被卖了一个好价钱。"他看着站牌，"没有人会来问我们的意思。"'],
      keep: ['"东西还在你手上。"老周擦着表盘，"哪天想说了，再来坐坐。"'],
    })[endingOf(pf)] || [], onShow: pf => { const e = endingOf(pf); if (e === 'public') trustAdd(pf, 3); else if (e === 'sell') trustAdd(pf, -3); } },
    { id: 'qing1', npc: 'qing', when: pf => has(pf, 'manifest'), pages: [
      '青姐在长椅上缝一件小衣服，针脚很密。她抬头看见你，又低下去。',
      '"我男人叫林国安。灾变那年，他在这儿排队，说等车来了先送孩子走。"',
      '"你查过清单吗？名单上有没有他？"',
    ], choices: [
      { t: '名单上只有押车的人和六个装卸工，没有他', go: pf => { trustAdd(pf, 1); return '"没有他……"青姐把针插进布里，"那就是留在站台上了。"'; } },
      { t: '我再去查查', go: () => '"谢谢你。"她重新拿起针，手很稳。' },
    ] },
    { id: 'chen1', npc: 'chen', when: () => true, pages: [
      '门卫岗的桌上压着一盏灯。陈守坐在灯后面，盯着你的工壳看了很久。',
      '"你不是人。"他说，"可你带回来的东西，是给人用的。"',
      '"我不管是谁在遥控你。在这儿，机器只能站在门外，或者……"他停了一下，"把自己的东西亮出来。"',
    ], choices: [
      { t: '我可以把工壳打开给你看', go: pf => { trustAdd(pf, 1); return '陈守看了看你的外壳，没有去碰。"够了。进来吧，别乱跑。"'; } },
      { t: '那我就站在门外', go: () => '"算你懂事。"陈守把灯拨暗了一点。' },
    ] },
    { id: 'xie1', npc: 'xie', when: () => true, pages: [
      '老谢把一台老收音机调来调去，里面全是沙沙的杂音。',
      '"每天这个时候，我往城里广播一遍。站号，班次，还有名字。"',
      '"没人回。可我总觉得，有一天会有人听见。"',
    ] },
    { id: 'xie2', npc: 'xie', when: pf => has(pf, 'transit'), pages: [
      '老谢听你说起运输图，手停在旋钮上。',
      '"我这台机器收到过同样的频段。一段很短的信号，只有一个站号，后面跟着一串数字。"',
      '"我记下来了。你要是需要，拿去。"',
    ] },
    { id: 'mei1', npc: 'mei', when: () => true, pages: [
      '阿梅往锅里撒了一把菜干，香味一下子飘满了食堂。',
      '"吃不吃？不要钱。就是没味道。"她笑了，露出一颗缺了的牙。',
    ] },
    { id: 'su1', npc: 'su', when: () => true, pages: [
      '苏医生的诊所只剩最后两包绷带。她把白大褂的袖子卷到肘上，手上有很多细小的划痕。',
      '"这里的人都在等车。等的时间长了，伤口就不好得了。"',
    ] },
    { id: 'hei1', npc: 'hei', when: () => true, pages: [
      '一个缺了一条腿的老人靠在墙角，手里举着空碗。他没有开口，只把碗往前伸了伸。',
    ], choices: [
      { t: '给他 30 零件', cost: TUNE.heiCost, need: pf => pf.money >= TUNE.heiCost, go: pf => { trustAdd(pf, 1); return '老黑把钱攥在手里，"谢谢你，机器。"他把头埋进胳膊里。'; } },
      { t: '走开', go: () => '老黑没有抬头。' },
    ] },
  ];
  // 没有对话可说的时候，每个人随口说的一句（按趟数轮着说）
  const IDLE = {
    su: ['药不多，伤口先别碰水。', '孩子们的咳嗽好一点了，就是还不肯睡。'],
    fang: ['我们不收钱，只换。', '拿来看看你身上有什么。'],
    tie: ['熔两件一样的，换一件高一级的。钱要带够。', '这台机器你打算怎么改？'],
    zhou: ['表盘走得不准，可它每天都要擦。', '它也许哪天还会来。'],
    qing: ['等车的人，要等多久，你知道吗？', '小衣服还差一颗扣子。'],
    chen: ['别在站厅里开枪。', '门外的事，门外管。'],
    xie: ['沙沙声里，偶尔能听见一个站号。', '收音机要是坏了，就没人知道我们还在。'],
    mei: ['汤快好了，要不要来一碗？', '锅底还有最后一把菜。'],
    xm: ['火车要有车灯，不然晚上开不走。', '这是我画的火车，它会跑得很快。'],
    hei: ['空碗……就一个空碗。', '腿是在那一年丢的。'],
  };

  // ── 状态
  const clean = o => {
    const out = { trust: 0, seen: {}, help: {}, fused: 0 };
    if (!o || typeof o !== 'object') return out;
    out.trust = Math.max(0, Math.min(TUNE.trustMax, o.trust | 0));
    for (const k of ['seen', 'help']) if (o[k] && typeof o[k] === 'object') for (const j in o[k]) out[k][j] = !!o[k][j];
    out.fused = Math.max(0, o.fused | 0);
    return out;
  };
  function op(pf) { const s = D.Story.S(pf); return s.op || (s.op = clean(null)); }
  const trust = pf => op(pf).trust | 0;
  const isGear = (id, minQ) => { const m = /^(att|rmod):(.+)$/.exec(id || ''); if (!m) return false; const d = (m[1] === 'att' ? D.ATT : D.RMOD)[m[2]]; return !!d && d.q >= (minQ || 0); };
  const STORY_GOODS = /^(clue:|quest:|job:|bp:)/;

  // ── 存档：pf.story.op 跟着主线一起存（story.js 的 deserialize 只认老字段，所以在这里包一层）
  const ser0 = D.Story.serialize, des0 = D.Story.deserialize;
  D.Story.serialize = function (pf) { const o = ser0.call(this, pf); if (pf.story && pf.story.op) o.op = JSON.parse(JSON.stringify(pf.story.op)); return o; };
  D.Story.deserialize = function (pf, o) { const s = des0.apply(this, arguments); if (o && o.op) pf.story.op = clean(o.op); return s; };

  // ── 建站：人类据点不走普通站的随机生成，用 outpost-town.js 的手工布局（两层：集市街、车厢里的家），人也在那边放
  const ms0 = D.makeStation;
  D.makeStation = function (rng, st, opt) {
    if (D.OutpostTown && D.OutpostTown.is(st, opt)) return D.OutpostTown.build(rng, st, opt);
    return ms0.apply(this, arguments);
  };

  // ── 进站、交互
  D.Outpost = {
    TUNE, PEOPLE, QUESTS, SCENES, IDLE,
    state: op, trust,
    onEnter() {}, // 横幅在 outpost-town.js 的 D.enterStation 里（station.js 之后会再设一次站名横幅，要在它后面盖掉）
    // 站里最近的一个有名字的人（没有就 null）
    nearest(S) {
      const pl = S.player; let best = null, bd = 26;
      for (const p of S.people || []) { if (p.crowd || p.f !== S.f) continue; const d = Math.hypot(p.x - pl.x, p.y - pl.y); if (d < bd) { bd = d; best = p; } }
      return best;
    },
    // 范围里每个有名字的人都交成候选（D.Pick 选最近的，interact.js）
    cands(S, add) {
      const pl = S.player;
      for (const p of S.people || []) {
        if (p.crowd || p.f !== S.f) continue; const d = Math.hypot(p.x - pl.x, p.y - pl.y); if (d >= 26) continue;
        const P = PEOPLE[p.id]; if (!P) continue;
        add({ ref: p, x: p.x, y: p.y, d, key: 'F', text: P.say, go: inp => { if (inp.interact) S.events.push({ type: 'outpost', id: p.id }); } });
      }
    },
    // 老接口：只看据点的人。返回 true 表示范围里有
    interact(S, inp) { return D.Pick.solo(S, inp, D.Outpost.cands); },
    // 看一眼时的话（有没说过的对话就用对话，否则随口一句）
    nextScene(pf, npc) { const o = op(pf); return SCENES.find(s => s.npc === npc && !o.seen[s.id] && s.when(pf)) || null; },
    idleLine(pf, npc) { const L = IDLE[npc] || []; return L.length ? L[(pf.raids | 0) % L.length] : ''; },
    markSeen(pf, id) { op(pf).seen[id] = true; },
    // 结果：对话选项
    choose(S, scene, i) {
      const pf = S.raid.pf, c = scene.choices && scene.choices[i]; if (!c) return null;
      if (c.need && !c.need(pf)) return null;
      if (c.cost) pf.money -= c.cost;
      return c.go(pf);
    },
    showScene(pf, scene) { if (scene.onShow) scene.onShow(pf); op(pf).seen[scene.id] = true; },
    pages(pf, scene) { return typeof scene.pages === 'function' ? scene.pages(pf) : scene.pages; },

    // ── 换物（方姨）：货架上有几件，你给一件价值够的东西，换一件
    offers(S) {
      if (S._offers) return S._offers;
      const R = S.raid, pf = R.pf, t = trust(pf);
      const rng = D.rng(R.city.seed + ':fang:' + S.st.id + ':' + S.step + ':' + pf.raids);
      const gear = q => Object.keys(D.ATT).filter(k => D.ATT[k].q === q).map(k => 'att:' + k).concat(Object.keys(D.RMOD).filter(k => D.RMOD[k].q === q).map(k => 'rmod:' + k));
      const low = gear(2).concat(gear(3)), hi = gear(4);
      rng.shuffle(low);
      const list = low.slice(0, TUNE.barterBase);
      if (t >= TUNE.trustBarter4 && hi.length) list.push(rng.pick(hi));
      if (t >= TUNE.trustBarter5) { const cards = Object.keys(D.CARDS).filter(k => !D.CARDS[k].free && D.CARDS[k].q >= 2 && D.CARDS[k].q <= 4); if (cards.length) list.push('card:' + rng.pick(cards)); }
      S._offers = list.map(id => ({ id, v: D.itemInfo(id).v | 0 }));
      return S._offers;
    },
    offerDone: (S, i) => !!(S.outDone && S.outDone[i]),
    // 能拿来换这一件的：背包里价值够、不是剧情物的东西
    barterOK: (S, i, e) => { const off = D.Outpost.offers(S)[i]; return !!off && !!e && e.id !== off.id && !STORY_GOODS.test(e.id) && (D.itemInfo(e.id).v | 0) >= Math.ceil(off.v * TUNE.barterRatio); },
    barterDo(S, i, e) {
      const R = S.raid, off = D.Outpost.offers(S)[i];
      if (!off || D.Outpost.offerDone(S, i) || !D.Outpost.barterOK(S, i, e)) return { ok: false, why: 'no' };
      Gg().remove(R.bag, e);
      if (!Gg().canAdd(R.bag, off.id, 1)) { Gg().add(R.bag, e.id, e.n || 1); return { ok: false, why: 'full' }; }
      Gg().add(R.bag, off.id, 1);
      (S.outDone = S.outDone || {})[i] = true;
      return { ok: true, got: off.id, gave: e.id };
    },

    // ── 提升（老铁）：两件同类、同槽、同级的熔成一件高一级的
    fuseGroups(S) {
      const groups = new Map();
      for (const e of S.raid.bag.items) {
        const m = /^(att|rmod):(.+)$/.exec(e.id); if (!m) continue;
        const d = (m[1] === 'att' ? D.ATT : D.RMOD)[m[2]]; if (!d || d.q >= 4) continue;
        const k = m[1] + ':' + d.slot + ':' + d.q;
        if (!groups.has(k)) groups.set(k, { key: k, kind: m[1], slot: d.slot, q: d.q, entries: [] });
        groups.get(k).entries.push(e);
      }
      return [...groups.values()].filter(g => g.entries.length >= 2);
    },
    fuseCost: (pf, q) => Math.round(D.GROW_TUNE.craftMoney[q] * (trust(pf) >= TUNE.trustFuse ? TUNE.fuseOff : 1)),
    fuseResult(S, g) { // 结果会是哪一件（同槽、高一级的池子里随机，每次熔炼都不一样）
      const T = g.kind === 'att' ? D.ATT : D.RMOD;
      const pool = Object.keys(T).filter(k => T[k].slot === g.slot && T[k].q === g.q + 1);
      return pool.length ? pool.map(k => g.kind + ':' + k) : [];
    },
    fuseDo(S, key) {
      const R = S.raid, pf = R.pf, g = D.Outpost.fuseGroups(S).find(x => x.key === key);
      if (!g) return { ok: false, why: 'none' };
      const cost = D.Outpost.fuseCost(pf, g.q);
      if ((pf.money | 0) < cost) return { ok: false, why: 'poor' };
      const pool = D.Outpost.fuseResult(S, g); if (!pool.length) return { ok: false, why: 'none' };
      const o = op(pf), rng = D.rng(R.city.seed + ':fuse:' + o.fused + ':' + pf.raids), id = rng.pick(pool);
      const [a, b] = g.entries;
      Gg().remove(R.bag, a); Gg().remove(R.bag, b);
      if (!Gg().canAdd(R.bag, id, 1)) { Gg().add(R.bag, a.id, 1); Gg().add(R.bag, b.id, 1); return { ok: false, why: 'full' }; }
      Gg().add(R.bag, id, 1); pf.money -= cost; o.fused++;
      return { ok: true, id, cost, q: g.q + 1 };
    },

    // ── 托付
    questDone: (pf, id) => !!op(pf).help[id],
    questItems(S, id) { // 能交的东西（pick 的托付）或者数量（一般的）
      const Q = QUESTS[id];
      if (Q.pick) return S.raid.bag.items.filter(e => isGear(e.id, 2));
      return S.raid.bag.items.filter(e => e.id === Q.need);
    },
    questCount: (S, id) => { const Q = QUESTS[id]; return Q.pick ? D.Outpost.questItems(S, id).length : D.Outpost.questItems(S, id).reduce((s, e) => s + (e.n || 1), 0); },
    questDo(S, id, e) {
      const R = S.raid, pf = R.pf, Q = QUESTS[id];
      if (D.Outpost.questDone(pf, id)) return { ok: false, why: 'done' };
      if (Q.pick) { if (!e || !isGear(e.id, 2)) return { ok: false, why: 'no' }; Gg().remove(R.bag, e); }
      else { if (D.Outpost.questCount(S, id) < Q.n) return { ok: false, why: 'no' }; Gg().take(R.bag, Q.need, Q.n); } // take 返回拿到的数量，先数够再拿
      pf.money += Q.reward; trustAdd(pf, Q.trust); op(pf).help[id] = true;
      return { ok: true, reward: Q.reward, text: Q.thanks };
    },
  };

  D.Outpost.isGear = isGear;
})(D);
