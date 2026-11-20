/* Underdog：第二幕（story/第二幕-铁原.md，story/剧情修改建议-v0.6.md）
   岚川的主线、结局一场都不动（story.js 不改）。这里是岚川之后的剧情：
   - 开场：选过岚川结局（公开 / 卖给陆峥 / 暂时保留都算）再撤出来一趟，阿隼拿来铁原黑市流出的 E-17 金砖，林桥接通城际中继，解锁铁原。
   - 铁原：6 条线索（只在铁原掉，每条两个以上来源，有前置），林桥、陆峥的话，幕尾解锁白沙。
   - 铁原的规矩：自动工厂、军械库的生产线还在转，隔一阵补一台守卫。
   - 白沙（story/第三幕-白沙.md）：6 条线索（只在白沙掉；"幸存者"要进白沙的流民营、人类据点听人说），林桥、陆峥、阿隼的话，幕尾解锁北渡。
   - 白沙的规矩：辐射。进站一阵以后工壳开始掉耐久，东区弹坑附近更快。
   - 北渡（story/第四幕-北渡.md）：6 条线索；读到"南栈频段"以后北渡的机器不朝你开火（你先打机器就失效），承包队照样找你；
     读到"协议线入口"以后地图上出现列车城（隐藏撤离点）：见林远舟和陆衡，守车战（撤离战，来的全是承包队），回南栈做最后的决定（守车 / 交出 / 拆弹）。
   进度在 pf.act2（cities.js 存档）：brick 金砖那场戏是第几趟以后出现的；clues [{k, day, at, how}]；miss 连续几站没投放；luFork 岔口卖给了陆峥。
   线索纸的物品 id 是 "clue:ty_…"（inventory.js 按 clue: 前缀交给 D.storyItemInfo，这里包一层）；story.js 的 scanBag 认不出它们，会跳过。
   对话挂进 story.js 的 BEATS（同一个数组），人物页照常显示、照常亮新话的点。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  if (!D.Story || !D.Cities) return;
  const St = D.Story, Ci = D.Cities, Gr = () => D.Grid;
  const DROP_P = 0.55, DROP_PITY = 0.2, KILL_P = 0.35, LU_FORK = 1200;
  const FACT = { every: 30, max: 6, cap: 6, at: ['factory', 'armory'] }; // 兵工厂补兵：每 30 秒一台，一站最多 6 台，同层活着的超过 6 台不补
  const RAD = { grace: 50, every: 2, craterGrace: 25, craterEvery: 1, pct: 0.015, craterX: 0.55 }; // 白沙辐射：过多少秒开始掉、隔几秒掉一次、每次掉上限的几成；弹坑 = 地图偏东、城区以上
  const A2 = pf => { const a = Ci.ensure(pf).act2; if (!Array.isArray(a.clues)) a.clues = []; a.miss = a.miss | 0; return a; };
  const ended = pf => !!St.S(pf).ending;
  const seen = (pf, id) => St.S(pf).talk[id] != null;

  // ── 线索（台词以 story/第二幕-铁原.md 为准）
  const CONT = (st, c, minTier, maxTier) => ({ k: 'cont', st, c, minTier: minTier || 0, maxTier: maxTier == null ? 3 : maxTier });
  const CLUES = [
    { k: 'ty_gold', title: '金砖流水账', need: [],
      text: '黑市柜台底下压着一本流水账，一笔一笔都是金砖换东西：滤毒罐、压缩饼干、轴承、蓄电池。每块砖的钢印编号都抄下来了，打头都是"E-17 · 第 1 节"。最早的一笔在二十年前，最近的一笔是上个月。',
      where: '金砖流水账：商圈、银行、军械库、废弃站、货运站的收银台、保险柜、钱箱、文件柜；外环的遗体也翻翻',
      src: [CONT(['market', 'bank', 'armory', 'ruin', 'freight'], ['register', 'safe', 'lockbox', 'filecab', 'vendor', 'coffer']), CONT(null, ['corpse'], 0, 1)] },
    { k: 'ty_dummy', title: '出库单副本', need: ['ty_gold'],
      text: '铁原军工总库的存档里，有一份从岚川物流站转来的出库单副本，日期是核爆那天下午。弹头模块、铅封罐下面还有一行：铅衬防化训练假人，142 具，随车。签收栏是南栈装卸班。',
      where: '出库单副本：货运站、维修库、自动工厂、机库的货箱、托盘、集装箱、文件柜、电脑；工程机身上也可能有',
      src: [CONT(['freight', 'depot', 'factory', 'hangar'], ['crate', 'pallet', 'container', 'filecab', 'pc']), { k: 'kill', e: ['engineer'] }] },
    { k: 'ty_fork', title: '军用线岔口', need: ['ty_gold'],
      text: '城际军用线在铁原这一头有个岔口，停着一节拆空的车厢，地上有吊装铅封罐留下的划痕。车厢墙上用粉笔画着一个铁道暗记，旁边贴着一张手写的排班表，最后一行写着："第七天。弃车，换车。"',
      where: '军用线岔口：机库、维修库、虫巢、废弃站的工具箱、零件架、残骸、废料堆；或者修好信号中继站的中继台',
      src: [CONT(['hangar', 'depot', 'nest', 'ruin'], ['toolbox', 'partsbin', 'wreck', 'scrapheap']), { k: 'relay' }] },
    { k: 'ty_launch', title: '失窃报告', need: ['ty_dummy', 'ty_fork'],
      text: '导弹总装厂的事故报告，机器打的字：库存铁路导弹发射车 3 台，被不明武装人员劫持，追缉无果。报告末尾的处置意见只有一个词：观察。',
      where: '失窃报告：自动工厂、军械库、维修库的保险柜、文件柜、电脑、枪架、武器柜；炮台、哨兵身上也可能有',
      src: [CONT(['factory', 'armory', 'depot'], ['safe', 'filecab', 'pc', 'gunrack', 'armory']), { k: 'kill', e: ['turret', 'drone'] }] },
    { k: 'ty_note', title: '第一封通牒', need: ['ty_launch'],
      text: '机器政权内部电报的抄本。来电方没有署名，只有一个频段编号：南栈站务台。正文一句话："让路，或者你的总装厂。"机器的回复是：经计算，让路。附件最后一行："岚川南栈，不许动。"',
      where: '第一封通牒：调度中心、数据中心、检查站、中继站的电脑、文件柜、服务器、保险柜；城区以上的工程机身上也可能有',
      src: [CONT(['dispatch', 'datacenter', 'checkpoint', 'relay'], ['pc', 'filecab', 'rack', 'safe', 'vault']), { k: 'kill', e: ['engineer'], minTier: 1 }] },
    { k: 'ty_order', title: '出城调令', need: ['ty_note'],
      text: '一张机器签发的放行单：三台发射车、四节生活车厢，经城际军用线出城，放行。目的地栏写着：白沙。日期是十九年前。',
      where: '出城调令：调度中心、维修库、检查站的文件柜、电脑、保险柜、金库；城区以上的工程机、哨兵身上也可能有',
      src: [CONT(['dispatch', 'depot', 'checkpoint'], ['filecab', 'pc', 'safe', 'vault', 'lockbox']), { k: 'kill', e: ['engineer', 'sniper'], minTier: 1 }] },
  ];
  // 白沙（台词以 story/第三幕-白沙.md 为准）
  const BS = [
    { k: 'bs_dose', title: '剂量记录', need: [],
      text: '白沙东区气象站的剂量记录。十一年前的一个晚上，读数一下子翻了几百倍，机器在备注里写："不明高空爆炸。东区兵工厂失联。"之后十一年，那一格再也没降下来。',
      where: '剂量记录：废弃站、医院站、停电站、水淹站的文件柜、电脑、药柜、储物柜；外环的遗体也翻翻',
      src: [CONT(['ruin', 'hospital', 'blackout', 'flooded'], ['filecab', 'pc', 'medcab', 'locker']), CONT(null, ['corpse'], 0, 1)] },
    { k: 'bs_order', title: '撤兵令', need: ['bs_dose'],
      text: '一份外国承包部队的撤兵令副本，十一年前签发："目标持有可用战略武器，已实施示范打击。全部人员撤出白沙，不得追击。"番号被涂掉了。',
      where: '撤兵令：检查站、军械库、机库的军用箱、保险柜、文件柜、枪架；回收者、重机枪手身上也可能有',
      src: [CONT(['checkpoint', 'armory', 'hangar'], ['footlocker', 'safe', 'filecab', 'gunrack', 'lockbox']), { k: 'kill', e: ['raider', 'gunner'] }] },
    { k: 'bs_crater', title: '弹坑底下', need: ['bs_dose'],
      text: '东区弹坑边上一台勘测机的记录。坑底回填层下面探到大量生活物品：锅、鞋、床架、一面画满了车的墙。登记簿里没有这个地方。按床架的数目算，大约三百人。',
      where: '弹坑底下：虫巢、废弃站、水淹站的废料堆、工具箱、残骸、零件架、矿堆；工程机身上也可能有',
      src: [CONT(['nest', 'ruin', 'flooded'], ['scrapheap', 'toolbox', 'wreck', 'partsbin', 'oreheap']), { k: 'kill', e: ['engineer'] }] },
    { k: 'bs_voice', title: '幸存者', need: ['bs_crater'],
      text: '白沙据点的一个老人说，那天晚上地底下亮得跟白天一样。营地里出去捡破烂的十几个孩子没在家，活了下来，他就是其中一个。"我们管它叫那趟车。它往东边打了一发，就走了。"',
      where: '幸存者：进白沙的流民营、人类据点，听那里的人说；或者修好信号中继站的中继台',
      src: [{ k: 'safe', st: ['refuge', 'outpost'] }, { k: 'relay' }] },
    { k: 'bs_two', title: '两份记录', need: ['bs_order', 'bs_voice'],
      text: 'E-17 方面的发射记录，两份夹在一起。打印的那份写着："发射前侦察：目标区未发现人类信号。"手写的那份只有半句："下面可能有——"后面被撕掉了。',
      where: '两份记录：调度中心、数据中心、检查站的电脑、服务器、文件柜、保险柜、金库；城区以上的工程机身上也可能有',
      src: [CONT(['dispatch', 'datacenter', 'checkpoint'], ['pc', 'rack', 'filecab', 'safe', 'vault']), { k: 'kill', e: ['engineer'], minTier: 1 }] },
    { k: 'bs_scout', title: '侦察机残骸', need: ['bs_two'],
      text: '一架外国侦察机的残骸，最后一次回传的坐标标着 E-17 车队：北渡，地下协议线。日期是上个月。',
      where: '侦察机残骸：机库、维修库、废弃站的残骸、废料堆、零件架；城区以上的哨兵身上也可能有',
      src: [CONT(['hangar', 'depot', 'ruin'], ['wreck', 'scrapheap', 'partsbin']), { k: 'kill', e: ['drone'], minTier: 1 }] },
  ];
  // 北渡（台词以 story/第四幕-北渡.md 为准）
  const BD = [
    { k: 'bd_bar', title: '金砖的找零', need: [],
      text: '北渡黑市的收据。E-17 的金砖换的不是粮食，是一叠机器政权的配给券：协议线上的人，在跟北渡的机器做买卖。',
      where: '金砖的找零：商圈、银行、货运站的收银台、保险柜、钱箱、售货机；外环的遗体也翻翻',
      src: [CONT(['market', 'bank', 'freight', 'ruin'], ['register', 'safe', 'lockbox', 'vendor', 'coffer']), CONT(null, ['corpse'], 0, 1)] },
    { k: 'bd_pact', title: '互不侵犯', need: ['bd_bar'],
      text: '北渡机器政权的公文："与 E-17 方面签署互不侵犯协定。协议线内不巡逻、不开火。识别依据：南栈站务台频段。"',
      where: '互不侵犯：调度中心、数据中心、检查站的电脑、文件柜、服务器、保险柜；城区以上的工程机身上也可能有',
      src: [CONT(['dispatch', 'datacenter', 'checkpoint'], ['pc', 'filecab', 'rack', 'safe']), { k: 'kill', e: ['engineer'], minTier: 1 }] },
    { k: 'bd_freq', title: '南栈频段', need: ['bd_pact'],
      text: '一张报废巡逻机的识别表。名单最上面一行是一个频段编号，和南栈站务台每天报时用的那个一模一样。',
      where: '南栈频段：修好信号中继站的中继台；或者打哨兵',
      src: [{ k: 'relay' }, { k: 'kill', e: ['drone'] }] },
    { k: 'bd_kids', title: '识字课本', need: ['bd_pact'],
      text: '一本翻烂了的识字课本，扉页写着"列车城 · 第三学段"。第一课只有一句："南栈站，二十三点四十分。"',
      where: '识字课本：医院站、商圈、废弃站的储物柜、快递、书包、课桌；城区以上的遗体也翻翻',
      src: [CONT(['hospital', 'market', 'ruin'], ['locker', 'parcel', 'schoolbags', 'schooldesk', 'suitcase']), CONT(null, ['corpse'], 1, 3)] },
    { k: 'bd_hunt', title: '通缉单', need: ['bd_freq', 'bd_kids'],
      text: '各国承包队在北渡贴的悬赏："E-17 车队位置、协议线入口坐标，重酬。"抬头是穹环善后局。',
      where: '通缉单：检查站、军械库的军用箱、保险柜、枪架；回收者、指挥官身上也可能有',
      src: [CONT(['checkpoint', 'armory', 'hangar'], ['footlocker', 'safe', 'gunrack', 'lockbox']), { k: 'kill', e: ['raider', 'nx_captain'] }] },
    { k: 'bd_gate', title: '协议线入口', need: ['bd_hunt'],
      text: '一张手画的支线图，从一座深处的站旁边岔出去，终点写着两个字：协议。',
      where: '协议线入口：调度中心、维修库的文件柜、电脑、保险柜、金库；或者修好信号中继站的中继台',
      src: [CONT(['dispatch', 'depot', 'datacenter'], ['filecab', 'pc', 'safe', 'vault']), { k: 'relay' }] },
  ];
  const BY = { tieyuan: CLUES, baisha: BS, beidu: BD }, ALL = CLUES.concat(BS, BD), CLUE = {};
  for (const city in BY) BY[city].forEach((c, i) => { c.n = i + 1; c.city = city; CLUE[c.k] = c; });
  const cityClues = pf => pf && pf.city && BY[pf.city.key] && Ci.isOpen(pf, pf.city.key) ? BY[pf.city.key] : null;
  const has = (pf, k) => A2(pf).clues.some(c => c.k === k);
  const avail = (pf, c) => !has(pf, c.k) && c.need.every(k => has(pf, k));
  function learn(pf, k, how, at) {
    const a = A2(pf), c = CLUE[k]; if (!c || has(pf, k)) return null;
    a.clues.push({ k, day: pf.raids | 0, at: at != null && pf.city.stations[at] ? pf.city.stations[at].name : null, how });
    if (k === 'bd_gate') revealTC(pf);
    return c;
  }

  // ── 北渡的列车城：一段隐藏支线的尽头（像岚川的储备库），读到"协议线入口"以前看不见、进不去；它也是隐藏撤离点
  D.STATION_TYPES.traincity = { name: '协议线 · 列车城', w: 0, theme: 'depot', hidden: true, desc: '北渡地底下一段机器不巡逻的支线。E-17 的车队停在这里' };
  D.GARRISON.traincity = D.GARRISON.reserve ? D.GARRISON.reserve.slice() : [['raider', 1]];
  if (D.GARRISON_EXTRA) D.GARRISON_EXTRA.traincity = 0;
  if (D.ROOM_POOL && D.ROOM_POOL.reserve) D.ROOM_POOL.traincity = D.ROOM_POOL.reserve.slice();
  { const ia = D.initArt; D.initArt = function () { const r = ia.apply(this, arguments); if (D.ICON && D.ICON.node_treasure) D.ICON.node_traincity = D.ICON.node_treasure; return r; }; }
  const mkc0 = D.makeCity;
  D.makeCity = function () {
    const C = mkc0.apply(this, arguments);
    try { if (C.key === 'beidu') addTrainCity(C); } catch (e) { console.error(e); }
    return C;
  };
  function addTrainCity(C) { // 用自己的随机流、加在所有站的最后（别的站编号不变）
    const rng = D.rng('traincity:' + C.seed), dist = D.cityDist(C, C.home), MW = D.cityW(C), MH = D.cityH(C);
    const bases = C.stations.filter(s => !s.dead && !s.hidden && !s.home).sort((a, b) => b.tier - a.tier || (dist.get(b.id) || 0) - (dist.get(a.id) || 0) || a.id - b.id);
    for (const b of bases.slice(0, 12)) for (let i = 0; i < 40; i++) {
      const ang = rng() * Math.PI * 2, dd = rng.range(24, 40), x = Math.round(b.x + Math.cos(ang) * dd), y = Math.round(b.y + Math.sin(ang) * dd);
      if (x < 20 || y < 20 || x > MW - 20 || y > MH - 20 || C.stations.some(o => !o.dead && Math.hypot(o.x - x, o.y - y) < 18)) continue;
      const h = { id: C.stations.length, x, y, lines: [], adj: new Set([b.id]), name: '协议线', hidden: true, secret: 'story', tier: 3, type: 'traincity', exit: 'hidden' };
      C.stations.push(h); b.adj.add(h.id); if (C.known) C.known.set(h.id, 0); C.trainCity = h.id; return;
    }
  }
  function revealTC(pf) {
    if (!pf || !has(pf, 'bd_gate') || !Ci.isOpen(pf, 'beidu')) return;
    const C = pf.city && pf.city.key === 'beidu' ? pf.city : pf.cityObjs && pf.cityObjs.beidu; if (!C || C.trainCity == null) return;
    const id = C.trainCity; if ((C.known.get(id) | 0) < 1) C.known.set(id, 1); if (C.found) C.found.add(id);
    C.stations[id].name = A2(pf).met ? '协议线 · 列车城' : '协议线';
  }
  Ci.onGo = (pf, key) => { if (key === 'beidu') revealTC(pf); };
  const ce0 = St.canEnter;
  St.canEnter = function (pf, st) { if (st && st.type === 'traincity') return has(pf, 'bd_gate'); return ce0.apply(this, arguments); };

  // 线索纸：物品信息
  const sii0 = D.storyItemInfo;
  D.storyItemInfo = function (id) {
    const c = id.startsWith('clue:') ? CLUE[id.slice(5)] : null;
    if (c) return { name: c.title, v: 40, w: 1, h: 1, stack: 1, q: 2, art: 'clue', kind: 'clue', clue: c.k, desc: '线索：拾起就记进档案。之后这张纸只值 40' };
    return sii0.apply(this, arguments);
  };

  // 读到线索：右上角一张卡片（和岚川的同一个样子，计数按这座城的 6 条）
  function card(pf, c) {
    const U = D.UI, root = document.querySelector('#ui') || document.body; if (!U || typeof document === 'undefined') return;
    const tr = D.tr || (x => x), esc = U._ && U._.esc ? U._.esc : (s => s), list = BY[c.city] || CLUES, n = list.filter(x => has(pf, x.k)).length;
    const el = document.createElement('div'); el.className = 'cluecard';
    el.innerHTML = `<div class="cc-k">${esc(tr(D.CITIES[c.city].name))} · ${esc(tr(`线索 ${n} / ${list.length} · 已记入档案`))}</div><h3>${esc(tr(c.title))}</h3><p>${esc(tr(c.text))}</p>`;
    document.querySelectorAll('.cluecard').forEach(o => o.remove());
    (document.querySelector('.cluecard-host') || root).appendChild(el); el.onclick = () => el.remove();
    if (D.Mood) D.Mood.glitch(260);
    setTimeout(() => el.remove(), 6500 + Math.min(4000, c.text.length * 30));
  }
  const gotIt = (S, pf, c) => { if (!c) return; (S.storyQ || (S.storyQ = [])).push({ t: 0, text: '线索', sub: c.title }); if (D.Sfx) D.Sfx.play('rare'); card(pf, c); };

  // ── 站内：进站投放、击毁掉落、中继台、背包里的线索纸
  const srcMatch = (sc, st) => sc.k === 'cont' && (!sc.st || sc.st.includes(st.type)) && st.tier >= sc.minTier && st.tier <= sc.maxTier;
  function putInto(S, rng, sc, id) {
    const list = rng.shuffle(S.containers.filter(c => sc.c.includes(c.kind) && !c.opened && !c.e17));
    for (const c of list) if (Gr().add(c.grid, id, 1) === 0) { for (const e of c.items) if (e.seen !== true) e.seen = false; c.story = id; return c; }
    return null;
  }
  const oe0 = St.onEnter;
  St.onEnter = function (S, o) {
    const r = oe0.apply(this, arguments);
    try {
      const R = S.raid, pf = R && R.pf;
      const list = cityClues(pf);
      if (pf && !R.tut && !S.tut && S.st.type === 'traincity') trainCity(S, pf);
      else if (pf && !R.tut && !S.tut && !S.safe && pf.city && pf.city.key === 'beidu') beiduEnter(S, pf, o);
      if (list && S.safe && !R.tut && !S.tut) { // 安全站里听人说（白沙的"幸存者"）
        const c = list.find(c => avail(pf, c) && c.src.some(q => q.k === 'safe' && q.st.includes(S.st.type)));
        if (c) gotIt(S, pf, learn(pf, c.k, `听${S.st.name}的人说的`, R.at));
      }
      if (list && !R.tut && !S.tut && !S.safe && !(o && o.revisit) && S.st.type !== 'traincity') {
        const a = A2(pf), rng = D.rng(R.city.seed + ':act2:' + S.st.id + ':' + S.step + ':' + pf.raids);
        let pick = null;
        for (const c of list) { if (!avail(pf, c)) continue; const sc = c.src.find(q => srcMatch(q, S.st) && S.containers.some(x => q.c.includes(x.kind) && !x.opened)); if (sc) { pick = [c, sc]; break; } }
        if (pick) { if (rng() < DROP_P + a.miss * DROP_PITY && putInto(S, rng, pick[1], 'clue:' + pick[0].k)) a.miss = 0; else a.miss++; }
        if (pf.city.key === 'tieyuan' && FACT.at.includes(S.st.type)) S.tyFact = { next: (S.t || 0) + FACT.every, n: 0 };
        if (pf.city.key === 'baisha') { const crater = D.isCraterStation ? D.isCraterStation(S.st, pf.city) : S.st.x > D.cityW(pf.city) * RAD.craterX && S.st.tier >= 1; S.bsRad = { crater, grace: crater ? RAD.craterGrace : RAD.grace, every: crater ? RAD.craterEvery : RAD.every, t0: null, hits: 0, warned: false };
          (S.storyQ || (S.storyQ = [])).push(crater ? { t: 0, text: '弹坑附近', sub: '辐射很重：25 秒后工壳开始掉耐久' } : { t: 0, text: '辐射区', sub: '50 秒后工壳开始掉耐久' }); }
      }
    } catch (e) { console.error(e); }
    return r;
  };
  const ok0 = St.onKill;
  St.onKill = function (S, e, x) {
    const r = ok0.apply(this, arguments);
    try {
      const R = S.raid, pf = R && R.pf;
      const list = cityClues(pf);
      if (list && !R.tut && !S.tut && !S.tyKill) for (const c of list) {
        if (!avail(pf, c)) continue;
        const sc = c.src.find(q => q.k === 'kill' && q.e.includes(e.kind) && S.st.tier >= (q.minTier || 0));
        if (sc && S.rng() < KILL_P) { S.tyKill = true; D.K.scatter(S, x, e.y, e.f, 'clue:' + c.k, 1); break; }
      }
    } catch (err) { console.error(err); }
    return r;
  };
  const or0 = St.onRelay;
  St.onRelay = function (S) {
    const r = or0.apply(this, arguments);
    try { const pf = S.raid && S.raid.pf, list = cityClues(pf), c = list && list.find(c => avail(pf, c) && c.src.some(q => q.k === 'relay')); if (c) gotIt(S, pf, learn(pf, c.k, '修好中继台截到的', S.raid.at)); } catch (e) { console.error(e); }
    return r;
  };
  const tk0 = St.tick;
  St.tick = function (S) {
    const r = tk0.apply(this, arguments);
    try {
      const R = S.raid, pf = R && R.pf; if (!pf || R.tut || S.tut) return r;
      for (const e of R.bag.items) {
        if (!e.id.startsWith('clue:')) continue;
        const k = e.id.slice(5); if (!CLUE[k] || has(pf, k)) continue;
        const where = S.lootOpen && S.lootOpen.kind && D.CONT[S.lootOpen.kind] ? D.CONT[S.lootOpen.kind].name : null;
        gotIt(S, pf, learn(pf, k, where ? '在' + where + '里翻到' : '在城里捡到', R.at));
      }
      factory(S); radiation(S); protocol(S, pf); trainTick(S, pf);
    } catch (e) { console.error(e); }
    return r;
  };
  // 容器旁边找一格空地出兵：先试上下左右 12，都被墙 / 摆设占了（站内地图第二代的容器常贴着柱子、货架放）就一圈圈往外找，最远 48；实在没有就站在容器那格
  const NEAR = [[0, 12], [12, 0], [-12, 0], [0, -12], [0, 0]];
  for (let r = 16; r <= 48; r += 8) for (let a = 0; a < 8; a++) NEAR.push([Math.round(Math.cos(a * Math.PI / 4) * r), Math.round(Math.sin(a * Math.PI / 4) * r)]);
  const freeNear = (S, at) => NEAR.find(([x, y]) => !(D.solidAt && D.solidAt(S.A, at.x + x, at.y + y))) || [0, 0];
  // 兵工厂补兵：从这一层离你最远的容器旁边出来，种类按这种站的守卫表抽
  function factory(S) {
    const F = S.tyFact; if (!F || F.n >= FACT.max || (S.t || 0) < F.next) return;
    F.next = (S.t || 0) + FACT.every;
    const p = S.player, alive = S.enemies.filter(e => !e.dead && (e.f == null || e.f === S.f));
    if (alive.length >= FACT.cap) return;
    const spots = S.containers.filter(c => (c.f == null || c.f === S.f) && Math.hypot(c.x - p.x, c.y - p.y) > 120).sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y));
    const at = spots[0]; if (!at) return;
    const [dx, dy] = freeNear(S, at);
    const table = D.GARRISON[S.st.type] || [['drone', 1]], kind = D.rng('fact:' + S.st.id + ':' + F.n).weighted(table);
    D.K.spawnEnemy(S, kind, at.x + dx, at.y + dy, 0.6, S.f, true); F.n++;
    if (F.n === 1) (S.storyQ || (S.storyQ = [])).push({ t: 0, text: '生产线还在运转', sub: '兵工厂每隔一阵会补出新的守卫' });
  }

  // 白沙的辐射：进站（开场过场放完）以后开始算，到点前 10 秒提醒一次，之后隔一阵掉一点耐久（护甲、护盾挡不住）
  function radiation(S) {
    const R = S.bsRad, p = S.player; if (!R || !p || S.over || S.intro || p.hp <= 0) { radChip(null); return; }
    const t = S.t || 0; if (R.t0 == null) R.t0 = t;
    const at = t - R.t0;
    radChip(at < R.grace ? `辐射：${Math.ceil(R.grace - at)} 秒后开始掉耐久` : '辐射中：在掉耐久', at >= R.grace, R.crater);
    if (!R.warned && at >= R.grace - 10) { R.warned = true; (S.storyQ || (S.storyQ = [])).push({ t: 0, text: '剂量升高', sub: '再待 10 秒工壳开始掉耐久' }); }
    if (at < R.grace + R.hits * R.every) return;
    const d = Math.max(1, Math.round(p.maxHp * RAD.pct)); p.hp = Math.max(0, p.hp - d); R.hits++;
    S.texts.push({ x: p.x, y: p.y - 30, s: '-' + d, col: '#8dff6a', t: 0 });
    if (R.hits === 1) { (S.storyQ || (S.storyQ = [])).push({ t: 0, text: '辐射', sub: '工壳在掉耐久，早点上车' }); if (D.Sfx) D.Sfx.play('warn'); }
  }

  // 顶栏"下一班车"下面挂一条小牌：还有几秒开始掉耐久 / 正在掉（是站牌的子元素，跟着站牌走、一起藏）
  function radChip(text, hot, crater) {
    if (typeof document === 'undefined') return;
    const sc = document.querySelector('#ui .tophud .sched'); let el = sc && sc.querySelector('.radchip');
    if (!text) { if (el) el.remove(); return; }
    if (!sc) return;
    if (!el) { el = document.createElement('div'); el.className = 'radchip'; sc.appendChild(el); }
    if (el.dataset.t !== text) { el.dataset.t = text; el.textContent = text; }
    el.classList.toggle('hot', !!hot); el.classList.toggle('crater', !!crater);
  }

  // ── 北渡：承包队（各国的人也在找 E-17）、协议线频段（读到"南栈频段"以后机器不朝你开火，你先打机器就失效）
  const CONTRACT = [['raider', 4], ['nx_mirror', 1], ['nx_pyro', 1]];
  const pressure = pf => (St.S(pf).ending === 'sell' ? 1 : 0) + (A2(pf).luFork === 1 ? 1 : 0); // 陆峥那边的人来得更早、更多
  const farSpot = (S, min) => { const p = S.player; return S.containers.filter(c => (c.f == null || c.f === S.f) && Math.hypot(c.x - p.x, c.y - p.y) > (min || 120)).sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))[0]; };
  function spawnAt(S, kind, at, delay, aware) {
    const [dx, dy] = freeNear(S, at);
    return D.K.spawnEnemy(S, kind, at.x + dx, at.y + dy, delay, S.f, aware);
  }
  function beiduEnter(S, pf, o) {
    if (has(pf, 'bd_freq')) { S.bdProto = true; (S.storyQ || (S.storyQ = [])).push({ t: 0, text: '协议线频段', sub: '北渡的机器把你当成自己人：别先动手' }); }
    if (S.st.tier >= 1 && !(o && o.revisit)) {
      const rng = D.rng('contract:' + S.st.id + ':' + pf.raids), n = 2 + (rng() < 0.5 ? 1 : 0) + (pressure(pf) ? 1 : 0), at = farSpot(S, 140);
      if (at) for (let i = 0; i < n; i++) spawnAt(S, rng.weighted(CONTRACT), { x: at.x + (i - 1) * 14, y: at.y }, 0.4 + i * 0.2, false);
    }
  }
  const human = e => !!(D.ENEMIES[e.kind] || {}).human;
  function protocol(S) {
    if (!S.bdProto || S.bdBroke) return;
    for (const e of S.enemies) if (!e.dead && !human(e)) { e.aware = false; e.notice = 0; e.intent = null; }
  }
  const hurt0 = D.K.hurt;
  D.K.hurt = function (S, e, dmg) {
    if (S && S.bdProto && !S.bdBroke && e && !e.dead && dmg > 0 && !human(e)) { S.bdBroke = true; (S.storyQ || (S.storyQ = [])).push({ t: 0, text: '协议失效', sub: '你先打了机器：这一站的机器不再放过你' }); }
    return hurt0.apply(this, arguments);
  };

  // ── 列车城：站台上的人（和人类据点同一套画法：outpost-art.js 画 S.people）、和林远舟说话、守车战（撤离战，来的全是承包队）
  const LOOK = {
    lin: { skin: '#c99a72', hair: '#d8d4cc', top: '#3f4f6a', bot: '#2a2e33', acc: 'cap' },
    lu: { skin: '#e0b896', hair: '#e8e4dc', top: '#4a4a4e', bot: '#2c2c30', acc: 'glasses' },
  };
  const FOLK = [{ skin: '#e9b383', hair: '#2a2a33', top: '#6a7a5a', bot: '#3b3046', acc: 'none' }, { skin: '#d8a882', hair: '#222222', top: '#8a5a3c', bot: '#4a3a2a', acc: 'kerchief' },
    { skin: '#f0c39c', hair: '#1f1a22', top: '#5a6a8a', bot: '#2e2a33', acc: 'scarf' }, { skin: '#b98a63', hair: '#555555', top: '#7a4a4a', bot: '#2a3026', acc: 'none' }];
  const KIDS = [{ skin: '#f2c9a0', hair: '#3a2a1a', top: '#e0c040', bot: '#4a6a9a', acc: 'none', kid: true }, { skin: '#e0b08a', hair: '#2a2a2a', top: '#d06a6a', bot: '#3a4a6a', acc: 'none', kid: true }];
  function trainCity(S, pf) { // 进站（这时站里的人、守卫、控制台都还没放好：人放在第一帧，见 trainTick）
    const a = A2(pf);
    S.tcity = { lin: null, met: !!a.met, startAt: null, cleared: false };
    (S.storyQ || (S.storyQ = [])).push({ t: 0, text: '协议线 · 列车城', sub: a.met ? '列车城还停在这里' : '驾驶室的门开着', keep: true });
  }
  const ARRIVE = ['三台铁路导弹发射车停在协议线上，弹头舱盖着防水布。后面接着四节生活车厢，窗户里晒着衣服。',
    '站台上有两百来个人。几个孩子围着你的工壳转，问你是不是从南栈来的。他们识字课本的第一课，就是"南栈站，二十三点四十分"。', '驾驶室的门开着。'];
  function placePeople(S, pf) {
    if (!S.tcity.met && D.UI && D.UI.storyCard) D.UI.storyCard('协议线 · 列车城', ARRIVE); // 第一帧：站内界面已经建好，卡片不会被冲掉
    const p = S.player, rng = D.rng('tc:' + pf.raids + ':' + S.step), people = [];
    const put = (dx, dy, look, pose) => { for (const k of [0, 8, -8, 16, -16, 24, -24]) for (const ky of [0, -10, 10]) { const x = p.x + dx + k, y = p.y + dy + ky; if (D.solidAt && D.solidAt(S.A, x, y)) continue; const q = { f: S.f, x, y, pose, look, seed: rng.int(0, 999), face: dx > 0 ? -1 : 1 }; people.push(q); return q; } return null; };
    // 车队（traincity-art.js）：林远舟站在驾驶室门口，陆衡坐在生活车厢门口；没有车队图就站在你旁边
    const doors = D.TrainCityArt ? D.TrainCityArt.place(S) : null, at = (q, dx, dy) => q ? [q.x - p.x + dx, q.y - p.y + dy] : null;
    const [lx, ly] = at(doors && doors.cabDoor, 0, 0) || [70, -6], [ux, uy] = at(doors && doors.homeDoor, 0, 0) || [110, -14];
    const lin = put(lx, ly, LOOK.lin, 'stand'); put(ux, uy, LOOK.lu, 'sit');
    if (doors && S.sched) S.sched.st = 'off'; // 轨道右半段停着车队：班车不再来，只能叫接驳车撤
    [[-60, -10], [-95, 4], [150, 6], [-130, -8], [185, -6], [-170, 8]].forEach(([dx, dy], i) => put(dx, dy, FOLK[i % FOLK.length], i % 3 === 2 ? 'sit' : 'stand'));
    [[30, 14], [-30, 16], [50, -20]].forEach(([dx, dy], i) => put(dx, dy, KIDS[i % KIDS.length], i === 2 ? 'kidrun' : 'kid'));
    S.people = people; S.tcity.lin = lin;
  }
  function meetLines(pf) {
    const end = St.S(pf).ending, a = A2(pf);
    return ['一个头发全白的人从驾驶室里下来，看了一眼你工壳上的中继盒。那是林桥焊的，焊点歪向左边。',
      '"小桥焊的。"林远舟说。他六十三了，手还是装卸工的手。',
      '"工牌是我故意留的。我要她以为我死了，别再在站台上等，也别来找。"他停了一下，"她还是找来了。"',
      end === 'public' ? '"南栈把那份东西公开了？好。陆衡说早该公开。"' : end === 'sell' ? '"那几个空罐子，是我们特意留给买主的。"' : '"那份东西你还压着？压着也好。"',
      '车厢角落里坐着一个戴眼镜的老人，膝盖上摊着一本授权手册。他没抬头。"我是陆衡。"他说，"那张单子是我签的。"']
      .concat(a.bsTold === 1 ? ['"白沙的人也来了，"林远舟说，"在站台那头站着，一句话不说。"'] : [])
      .concat(['"带句话给小桥。"他从口袋里掏出一张车票，塞进你工壳的手里。零号港到南栈，单程，23:40，日期那一栏是空的。', '这时候协议线那头亮起了探照灯。承包队来了。']);
  }
  function meet(S, pf) {
    const T = S.tcity; if (!T || T.met) return;
    T.met = true; A2(pf).met = 1; revealTC(pf); T.startAt = (S.t || 0) + 4;
    if (D.UI && D.UI.storyCard) D.UI.storyCard('林远舟', meetLines(pf)); if (D.Sfx) D.Sfx.play('power');
  }
  function trainTick(S, pf) {
    const T = S.tcity; if (!T) return;
    // 第一帧：站里的守卫刚刷好，全清掉（协议线上没有巡逻）；之后再刷的（待太久、撤离战）一律换成承包队
    if (!T.cleared) { T.cleared = true; for (const e of S.enemies) e.dead = true; S.enemies = S.enemies.filter(e => !e.dead); S.tcSwap = true; placePeople(S, pf); }
    if (T.startAt == null || S.extract || S.over || (S.t || 0) < T.startAt) return;
    T.startAt = null; S.tcSwap = true;
    if (S.console && !S.console.used) D.K.startExtract(S);
    const at = farSpot(S, 120), n = 2 * pressure(pf);
    if (at) for (let i = 0; i < n; i++) spawnAt(S, D.rng('tcp:' + i).weighted(CONTRACT), { x: at.x + (i - 1) * 14, y: at.y }, 0.5 + i * 0.25, true);
    S.banner = { t: 0, text: '守车战', sub: '承包队顺着线索摸进了协议线：守到接驳车来' };
  }
  // 撤离战：列车城里至少 48 秒；来的全换成承包队，大家伙换成指挥官 / 老鸦
  const se0 = D.K.startExtract;
  D.K.startExtract = function (S) { const r = se0.apply(this, arguments); if (S && S.st && S.st.type === 'traincity' && S.extract) { S.extract.dur = Math.max(48, S.extract.dur); S.tcSwap = true; } return r; };
  const sp0 = D.K.spawnEnemy;
  D.K.spawnEnemy = function (S, kind) {
    if (S && S.tcSwap && D.ENEMIES[kind] && !D.ENEMIES[kind].human) {
      const a = [].slice.call(arguments), big = D.ENEMIES[kind].boss || kind === 'engineer';
      a[1] = big ? (kind === 'boss' && D.ENEMIES.bx_crow ? 'bx_crow' : 'nx_captain') : (S.rng && S.rng.weighted ? S.rng.weighted(CONTRACT) : 'raider');
      return sp0.apply(this, a);
    }
    return sp0.apply(this, arguments);
  };
  const cd0 = St.cands;
  St.cands = function (S, add) {
    const r = cd0.apply(this, arguments);
    try { const T = S.tcity, q = T && T.lin, p = S.player; if (q && !T.met && q.f === S.f && Math.hypot(q.x - p.x, q.y - p.y) < 24) add({ ref: q, x: q.x, y: q.y - 6, key: 'F', text: '和林远舟说话', go: inp => { if (inp.interact) meet(S, S.raid.pf); } }); } catch (e) { console.error(e); }
    return r;
  };

  // ── 终局（北渡回来以后，在人物页选）
  const FIN = {
    keep: { t: '守车', sub: '把北渡协议线的频段接到南栈。弹头留在列车城', screen: 'E-17 · 南栈 · 已到站',
      text: '你把北渡协议线的频段接到了南栈。列车城还在地底下，三台发射车还在；只是从今往后，南栈站务台的报时也会传到那里。外面的大国照旧不敢明着来，白沙的人照旧不原谅。23:40，南栈站台的屏幕换了一行字：E-17 · 南栈 · 已到站。' },
    give: { t: '交出', sub: '把位置和授权交给陆峥的国家。+8000', screen: 'E-17 · 已注销', pay: 8000,
      text: '你把位置和授权交给了陆峥。三天以后，正规军进了北渡的协议线，弹头被一节一节吊走。列车城的人散进北渡的废站里，不知道去了哪。外面的报纸说，世界安全了。南栈站台的屏幕换了一行字：E-17 · 已注销。' },
    scrap: { t: '拆弹', sub: '和林远舟一起拆下弹头，沉进地热井', screen: 'E-17 · 终点站',
      text: '那天夜里，林远舟和你一起拆下了三台发射车的弹头，一个一个沉进北渡的地热井。陆衡在旁边念授权码，念到最后一个，停了很久。世上再没有这东西了，机器和各国也不用再忌惮地底下的人。南栈站台的屏幕换了一行字：E-17 · 终点站。' },
  };
  function finale(pf, k) {
    const a = A2(pf), F = FIN[k]; if (!F || a.finale) return null;
    a.finale = k; if (F.pay) pf.money += F.pay; St.S(pf).flags.screen = F.screen;
    return { ending: k, first: true, extra: F.pay ? `+${F.pay}` : '', text: [F.text] };
  }

  // ── 对话（挂进 story.js 的 BEATS）
  St.BEATS.push(
    { id: 'x_brick', npc: 'ahsun', when: pf => A2(pf).brick != null,
      text: ['阿隼把一块金砖放在柜台上，推到你面前。砖面上的钢印磨得发亮：E-17 · 第 1 节 · 0417。',
        '"编号和你那张装货清单对得上吧？"他点了根烟，"这块是上个月在铁原的黑市花出去的，换了四十个滤毒罐。"',
        '"死人不买滤毒罐。"'] },
    { id: 'x_relay', npc: 'lin', when: pf => seen(pf, 'x_brick'),
      text: ['林桥把金砖翻过来看了很久，又从柜子底下翻出一卷发黄的军用线路图。',
        '"岚川往北有一条战时的城际军用线，通铁原，地图上早就划掉了。"她用指甲顺着那条线描了一遍，"中继能接过去，信号差一点，壳子得走城际货运。"',
        '"我得知道是谁在花这块金子。"'],
      choices: [{ t: '接通城际中继', sub: '解锁铁原：出发页顶上可以换城', go: pf => { Ci.open(pf, 'tieyuan'); return '林桥把中继盒接上了新天线。出发页上多了一座城：铁原。'; } },
        { t: '再等等', keep: true }] },
    { id: 'ty_l_dummy', npc: 'lin', when: pf => has(pf, 'ty_dummy'),
      text: ['林桥把出库单副本看了三遍。"一百四十二具假人。"', '"车里坐着的那些……"她没说完，把单子折起来压在扳手底下。"接着找。"'] },
    { id: 'ty_z_fork', npc: 'lu', when: pf => has(pf, 'ty_fork'),
      text: [pf => St.S(pf).ending === 'sell' ? '陆峥这回没在贵宾室等你，就站在修理铺门口，外套上有灰。"罐子是空的。"他说，"我交上去的是三个空铅罐。上头认为我被人耍了。"' : '陆峥在据点门口等你。"上头也收到消息了：有人在铁原花 E-17 的金子。"他看着你，"死人不花钱。这个道理，我们想到一块儿去了。"',
        '"岔口的位置卖给我，一千二。我只是想知道他们往哪儿走了。"'],
      choices: [{ t: '卖给他', sub: `+${LU_FORK}；以后陆峥那边的人会来得更早`, go: pf => { pf.money += LU_FORK; A2(pf).luFork = 1; return `陆峥记下了岔口的位置。（+${LU_FORK}）`; } },
        { t: '不卖', go: pf => { A2(pf).luFork = 0; return '"随你。我自己也找得到，只是慢一点。"'; } }] },
    { id: 'ty_l_note', npc: 'lin', when: pf => has(pf, 'ty_note'),
      text: ['林桥盯着最后一行看了很久。"岚川南栈，不许动。"', '"二十三年。铅门、炸断的光缆、守夜的人……我一直以为南栈是我们自己守住的。"',
        '她把抄本还给你。"他在外面拿着那东西，替我们挡着。"她停了一下，"也拿着那东西，挡着别人。"'] },
    { id: 'ty_l_end', npc: 'lin', when: pf => has(pf, 'ty_order'),
      text: ['"白沙。"林桥在地图上找到那座城，手指停在一大片涂黑的地方。"辐射最重的地方。他们去那儿干什么？"'],
      choices: [{ t: '接通去白沙的中继', sub: '解锁白沙：出发页顶上可以换城', go: pf => { Ci.open(pf, 'baisha'); return '中继盒又多了一根天线。出发页上多了一座城：白沙。'; } },
        { t: '再等等', keep: true }] },
    // 白沙（story/第三幕-白沙.md）
    { id: 'bs_l_order', npc: 'lin', when: pf => has(pf, 'bs_order'),
      text: ['"示范打击。"林桥把这四个字念了一遍。"拿一座城，演给别人看。"'] },
    { id: 'bs_z_order', npc: 'lu', when: pf => has(pf, 'bs_order'),
      text: ['陆峥看了一眼撤兵令。"番号涂掉了，可这种格式我认得。"他把纸推回来，"是我们的人。那天撤下来的人里，有一个是我的老师。"'] },
    { id: 'bs_l_two', npc: 'lin', when: pf => has(pf, 'bs_two'),
      text: ['林桥看了很久那半句。"下面可能有——"', '"我爸会不会知道？"她没等你回答。"别告诉我。等见到他，我自己问。"'] },
    { id: 'bs_a_ask', npc: 'ahsun', when: pf => has(pf, 'bs_voice') && has(pf, 'bs_scout'),
      text: ['阿隼难得没笑。"白沙据点的人托我打听那趟车去了哪。他们不要钱，就想知道。"', '"你知道的话，跟我说一声。我替你带话。"'],
      choices: [{ t: '告诉他们：北渡', sub: '北渡那一幕，白沙的人会去找它', go: pf => { A2(pf).bsTold = 1; return '阿隼点点头，什么也没说。'; } },
        { t: '不说', go: pf => { A2(pf).bsTold = 0; return '"嗯。有些事，知道了也没用。"'; } }] },
    { id: 'bs_l_end', npc: 'lin', when: pf => has(pf, 'bs_scout'),
      text: ['"北渡。上个月。"林桥的手按在中继盒上，"他们就在那儿，现在。"'],
      choices: [{ t: '接通去北渡的中继', sub: '解锁北渡：出发页顶上可以换城', go: pf => { Ci.open(pf, 'beidu'); return '中继盒的最后一根天线也接上了。出发页上多了一座城：北渡。'; } },
        { t: '再等等', keep: true }] },
    // 北渡（story/第四幕-北渡.md）
    { id: 'bd_l_pact', npc: 'lin', when: pf => has(pf, 'bd_pact'),
      text: ['"互不侵犯。"林桥把公文翻过来又翻回去。"跟机器签字。"她笑了一下，不是好笑的那种。'] },
    { id: 'bd_l_freq', npc: 'lin', when: pf => has(pf, 'bd_freq'),
      text: ['"南栈站务台的频段。"林桥把中继盒拆开，又接上。"二十三年，我们这台破机子一直用这个频段报时。原来外面一直有人在听。"', '"接好了。到了北渡，机器会把你当成协议线上的车。别先动手。"'] },
    { id: 'bd_z_hunt', npc: 'lu', when: pf => has(pf, 'bd_hunt'),
      text: ['陆峥没有否认。"通缉单是我的上头发的。"他停了一下，"车上有一个人，叫陆衡。"', '"如果你先找到他们……告诉我他还活着没有。就这一件事，不要钱。"'] },
    { id: 'bd_l_gate', npc: 'lin', when: pf => has(pf, 'bd_gate'),
      text: ['林桥把入口坐标抄在手背上。"去吧。"她说，"见到他，什么都别替我说。"'] },
    { id: 'bd_l_back', npc: 'lin', when: pf => A2(pf).met === 1,
      text: ['你把那张车票放在林桥的工作台上。零号港到南栈，单程，23:40，日期那一栏是空的。', '林桥看了很久。她把车票放进工作台最上面那个抽屉，什么也没说。'] },
    { id: 'bd_z_back', npc: 'lu', when: pf => A2(pf).met === 1,
      text: ['陆峥听你说完，很久没出声。"他还活着。"', '"我的上头要那车东西。你要是把位置和授权交给我，我保证……"他没说完，"算了。我保证不了什么。"'] },
    { id: 'bd_end', npc: 'lin', when: pf => A2(pf).met === 1, open: pf => !A2(pf).finale,
      text: ['"列车城在等你一句话，"林桥说，"陆峥的人也在等。"', '"这是你找到的。你定。"'],
      choices: ['keep', 'give', 'scrap'].map(k => ({ t: FIN[k].t, sub: FIN[k].sub, go: pf => finale(pf, k) })).concat([{ t: '再想想', keep: true }]) },
  );

  // 选过结局以后，再成功撤出来一趟（训练场不算）
  const fr0 = D.finishRaid;
  D.finishRaid = function (R, ok) {
    const out = fr0.apply(this, arguments);
    try { const pf = R && R.pf; if (ok && pf && !R.tut && ended(pf) && A2(pf).brick == null) A2(pf).brick = pf.raids | 0; } catch (e) { console.error(e); }
    return out;
  };

  // ── 线索日志顶上的"下一步"
  const ns0 = St.nextSteps;
  St.nextSteps = function (pf) {
    const a = A2(pf), keep = ended(pf) && St.S(pf).ending === 'keep' ? ns0.apply(this, arguments) : [];
    if (a.finale) return [`终局：${FIN[a.finale].t}。四座城都还能去。`];
    if (a.met === 1) return ['回人物页：做最后的决定。'].concat(keep);
    if (has(pf, 'bd_gate')) return ['去协议线：北渡地图上新出现的那段支线，尽头就是列车城。'].concat(keep);
    if (Ci.isOpen(pf, 'beidu')) {
      const out = BD.filter(c => avail(pf, c)).map(c => c.where);
      return (pf.cityAt === 'beidu' ? [] : ['去北渡：出发页顶上换城。E-17 的车队现在就停在那里的协议线上。']).concat(out.length ? out : ['去北渡接着找。']).concat(keep);
    }
    if (has(pf, 'bs_scout')) return ['回人物页：林桥看到了侦察机的回传。'].concat(keep);
    if (Ci.isOpen(pf, 'baisha')) {
      const out = BS.filter(c => avail(pf, c)).map(c => c.where);
      return (pf.cityAt === 'baisha' ? [] : ['去白沙：出发页顶上换城。E-17 的发射车十九年前往那里去了。']).concat(out.length ? out : ['去白沙接着找。']).concat(keep);
    }
    if (has(pf, 'ty_order')) return ['回人物页：林桥看到了出城调令。'].concat(keep);
    if (Ci.isOpen(pf, 'tieyuan')) {
      const out = CLUES.filter(c => avail(pf, c)).map(c => c.where);
      return (pf.cityAt === 'tieyuan' ? [] : ['去铁原：出发页顶上换城。']).concat(out.length ? out : ['去铁原接着找。']).concat(keep);
    }
    if (a.brick != null) return ['回人物页：阿隼带来了一块金砖。'];
    return ns0.apply(this, arguments);
  };

  // ── 据点"线索"页：解锁了铁原以后，顶上能在岚川和铁原之间切换；铁原那页是这 6 条
  if (D.UI && D.UI.storyTab) {
    const U = D.UI, st0 = U.storyTab;
    U.storyTab = function (pf, body, tab) {
      const r = st0.apply(this, arguments);
      try {
        if (tab === 'npc' || !Ci.isOpen(pf, 'tieyuan')) return r;
        const G = D.Game || {}, cities = ['lanchuan', 'tieyuan', 'baisha', 'beidu'].filter(k => Ci.isOpen(pf, k)), view = cities.includes(G.clueCity) ? G.clueCity : BY[pf.cityAt] ? pf.cityAt : cities[cities.length - 1]; // 没选过就看现在在的那座城
        const esc = U._ && U._.esc ? U._.esc : (s => s), a = A2(pf), list0 = BY[view];
        const head = body.querySelector('.st-head');
        if (head) {
          head.insertAdjacentHTML('beforeend', `<span class="cl-city">${cities.map(k => `<button class="btn sm${k === view ? ' primary' : ''}" data-clcity="${k}">${esc(D.CITIES[k].name)}</button>`).join('')}</span>`);
          head.querySelectorAll('[data-clcity]').forEach(b => b.onclick = () => { D.Sfx && D.Sfx.play('click'); G.clueCity = b.dataset.clcity; U.refresh(); });
        }
        if (!list0) return r;
        const list = body.querySelector('.cl-list'), pager = body.querySelector('.cl-main .pager'), none = body.querySelector('.cl-none');
        if (pager) pager.remove(); if (none) none.remove();
        const cnt = body.querySelector('.st-head .worth');
        if (cnt) { const bb = cnt.querySelector('b'); bb.textContent = String(list0.filter(c => has(pf, c.k)).length); bb.nextSibling && (bb.nextSibling.textContent = ' / ' + list0.length); }
        if (list) list.innerHTML = list0.map((c, i) => { const got = a.clues.find(x => x.k === c.k); return got
          ? `<div class="clue"><div class="cl-h"><b>${String(i + 1).padStart(2, '0')}</b>${esc(c.title)}<em>${got.at ? esc(got.at) + ' · ' : ''}${esc(got.how || '')}</em></div><p>${esc(c.text)}</p></div>`
          : `<div class="clue lock"><div class="cl-h"><b>${String(i + 1).padStart(2, '0')}</b>？？？</div><p>还没读到</p></div>`; }).join('');
      } catch (e) { console.error(e); }
      return r;
    };
  }

  D.Act2 = { CLUES, BS, BD, BY, ALL, CLUE, has, avail, learn, FACT, RAD, LU_FORK, FIN, CONTRACT, revealTC, meet, finale };
})(D);
