/* 末班之后 · 小样二：主线剧情（M4）
   12 条线索、林桥 / 阿隼 / 陆峥的对话和委托链、储备库终局站、三种结局。设计见 design/features/story/design.md，
   剧情的因果和措辞以 story/完整剧情.md 为准。

   进度存在 pf.story：
     clues  [{k, day, at, how}]  读到的线索，按读到的顺序
     talk   {话的 id: 选了第几项（0 = 看过）}
     quests {委托 id: 'active' | 'done'}
     flags  {device 解锁设备, ahsun 'coop'|'paid'|'self', toldLu, cut 已付分成}
     miss   连续几站没投放线索（保底）
     marks  读到线索的站（线路图上的金色标记）
     copy   读出了第 10 节的战略黑匣子（档案副本已传回）
     e17    从储备库成功撤出过几次（封箱越来越少）
     ending null | 'public' | 'sell' | 'keep'

   其他文件里的挂钩：enterStation → onEnter；stepStation → tick；interact → interact；kill → onKill；
   中继台 → onRelay；问号站 → onEvent / scanRaid；商人 → traderOffer；finishRaid → onFinish；
   canTravel → canEnter；存档 serialize / deserialize。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Gr = () => D.Grid;
  const DROP_P = 0.55, DROP_PITY = 0.2, QDROP_P = 0.6, KILL_P = 0.35, OLDSHELL_P = 0.5, E17_CRATES = 6, AHSUN_CUT = 0.2, LU_PAY = 4000, LU_MEDIA = 2000, AHSUN_MAP = 800, DEVICE_COST = 400;
  const FINAL = { public: 1, sell: 1 };

  // ── 物品：线索纸、委托物
  D.STORY_ITEMS = {
    'quest:pmod': { name: '电源模块', q: 1, v: 60, w: 1, h: 1, art: 'q_pmod', desc: '林桥铺子里发电机要用的电源模块' },
    'quest:memcore': { name: '损坏的存储器', q: 2, v: 40, w: 1, h: 1, art: 'q_mem', desc: '烧坏了一半的存储器。林桥能读出里面的东西' },
    'quest:media': { name: '黑匣子原始介质', q: 5, v: 300, w: 2, h: 1, art: 'q_media', desc: '从 E-17 第 10 节的战略黑匣子里取出的原始介质。带回去更好核验' },
    // 剧情灵魂：车上有人（design/features/story-soul）
    'quest:badge': { name: '林远舟的工牌', q: 3, v: 0, w: 1, h: 1, art: 'q_badge', desc: '南栈站务，林远舟。照片上的人和林桥贴在设备盒上的那张一样' },
    'quest:recorder': { name: '陆衡的录音机', q: 3, v: 0, w: 1, h: 1, art: 'q_rec', desc: '第四节车厢靠窗座位上的随身录音机。磁带还在里面' },
  };
  D.storyItemInfo = function (id) {
    if (id.startsWith('clue:')) { const c = CLUE[id.slice(5)]; return { name: c ? c.title : '旧纸片', v: 40, w: 1, h: 1, stack: 1, q: 2, art: 'clue', kind: 'clue', clue: id.slice(5), desc: '线索：拾起就记进档案。之后这张纸只值 40' }; }
    const it = D.STORY_ITEMS[id] || { name: '委托物', q: 1, v: 10, w: 1, h: 1, art: 'q_pmod' };
    return Object.assign({ stack: 1, kind: 'quest' }, it);
  };
  Object.assign(D.ITEM_ART, {
    clue: p => { p.rect(6, 4, 16, 20, '#e8e0c8'); p.rect(6, 4, 16, 2, '#fff8e0'); for (let i = 0; i < 4; i++) p.rect(9, 9 + i * 3, i === 3 ? 6 : 10, 1, '#6a5f50'); p.rect(15, 19, 5, 3, '#c82e3a'); p.rect(19, 4, 3, 3, '#b8ae94'); },
    q_pmod: p => { p.rect(7, 6, 14, 18, '#3a4152'); p.rect(10, 4, 8, 2, '#949fb6'); p.rect(9, 9, 10, 4, '#ffb057'); p.rect(9, 15, 10, 2, '#8dff6a'); p.rect(9, 19, 10, 2, '#2d3342'); },
    q_mem: p => { p.rect(4, 8, 20, 12, '#2d3550'); p.rect(6, 10, 10, 8, '#151a29'); p.line(17, 9, 22, 19, '#ff3047'); p.rect(18, 10, 4, 2, '#e3c14a'); p.rect(7, 11, 3, 2, '#5a92e8'); },
    q_badge: p => { p.rect(7, 3, 14, 22, '#c8cdda'); p.rect(7, 3, 14, 2, '#eef1f8'); p.rect(9, 7, 10, 8, '#8c5d3c'); p.rect(11, 8, 6, 5, '#d9a57a'); p.rect(9, 18, 10, 1, '#555d7a'); p.rect(9, 20, 7, 1, '#555d7a'); p.rect(13, 1, 2, 3, '#949fb6'); },
    q_rec: p => { p.rect(4, 7, 20, 15, '#2d3342'); p.rect(4, 7, 20, 2, '#646e86'); p.rect(7, 11, 5, 5, '#151a29'); p.rect(16, 11, 5, 5, '#151a29'); p.rect(8, 12, 3, 3, '#949fb6'); p.rect(17, 12, 3, 3, '#949fb6'); p.rect(7, 18, 14, 2, '#c82e3a'); },
    q_media: p => { p.rect(2, 8, 24, 12, '#1d212c'); p.rect(4, 10, 12, 8, '#164a5a'); p.rect(5, 11, 10, 2, '#3ee8ff'); p.rect(18, 11, 6, 2, '#e3c14a'); p.rect(18, 15, 6, 2, '#ff3047'); },
  });

  // ── 储备库：站点类型、守卫、房间、E-17 封箱
  D.STATION_TYPES.reserve = { name: '地下战略储备库', w: 0, theme: 'depot', hidden: true, desc: '废弃支线尽头的储备库。闸门落着，自动巡逻还在运行。E-17 停在站台尽头' };
  D.GARRISON.reserve = [['drone', 3], ['turret', 2], ['sniper', 2], ['medic', 1], ['raider', 1]];
  D.GARRISON_EXTRA.reserve = 1;
  D.ROOM_POOL.reserve = [['storage', 3], ['security', 3], ['control', 2], ['power', 1]];
  D.CONT.e17 = { name: 'E-17 封箱', n: [3, 5], g: [6, 4], bonus: 3, pure: true, slow: 1.2, cats: ['metal', 'val', 'part', 'intel'], where: '只在储备库：E-17 的货厢里', desc: 'E-17 货厢里的封箱，编号和底单对得上。黄金、稀有金属、备用工业核心、精密设备' };
  D.CMAT.e17 = 'vault';
  { const hi = D.initHiArt; D.initHiArt = function () { const r = hi.apply(this, arguments); if (D.CSPR && D.CSPR.vault) D.CSPR.e17 = D.CSPR.vault; return r; }; }
  { const ia = D.initArt; D.initArt = function () { const r = ia.apply(this, arguments); if (D.ICON && D.ICON.node_treasure) D.ICON.node_reserve = D.ICON.node_treasure; return r; }; }

  // ── 人物
  const NPC = {
    lin: { name: '林桥', role: '南栈修理铺 · 维修师', col: '#ffb057', tag: '给你修机器、读坏掉的存储器，也收实用零件。她关心南栈这一片的人。' },
    ahsun: { name: '阿隼', role: '回收者 · 同行', col: '#3ee8ff', tag: '熟悉价格和黑市，卖消息也抢生意。合不合作，看利益和信誉。' },
    lu: { name: '陆峥', role: '穹环善后局 · 特派员', col: '#c8cbd6', tag: '挂着善后局的牌子，背后是外头的大国。想独吞 E-17 的制动密钥，也想抹掉父亲签过的那张单子。' },
  };
  D.NPC = NPC;

  // ── 线索。src 只用来写进日志、给测试核对；真正的投放规则在 onEnter / onKill / 对话里
  // cont：站点类型 st（null = 任何站）里的容器 c；kill：击毁敌人 e；npc / trader / relay / event / oldshell：见各处
  const CONT_SRC = (st, c, minTier, maxTier) => ({ k: 'cont', st, c, minTier: minTier || 0, maxTier: maxTier == null ? 3 : maxTier });
  const CLUES = [
    { k: 'ticket', title: 'E-17 转运单', need: [],
      text: '寄存柜里一只旧箱子，底下压着一张特别转运单：一批"战备贵金属"，车次 E-17。奇怪的是，装车时间比地面核爆、全城封锁还晚了一个多钟头。',
      src: [CONT_SRC(['market', 'ruin', 'museum', 'bank', 'hangar'], ['locker', 'parcel', 'register']), CONT_SRC(null, ['corpse'], 0, 1)] },
    { k: 'rumor', title: '失踪的末班车', need: ['ticket'],
      text: '商人认出了这个车次。黑市一直流传着一列"失踪的黄金专列"：核爆当夜，它拉走了战前国库的金子，却没有出现在零号港的到站记录里。各国来的买主都在暗中重金悬赏，有人说它让机器截了，有人说它埋在塌方区。如今这张真实的货票，第一次把传闻和一间仓库联系了起来。',
      src: [{ k: 'trader' }, { k: 'npc', npc: 'ahsun' }] },
    { k: 'bottom', title: '装箱底单', need: ['ticket'],
      text: '军工物流站留下的装箱底单，夹着几枚铂金触点。编号和货票对得上，说明货单并非伪造。底单上除了少量贵金属，大头是另一种货——E-17 在军工物流站装过一批别的箱子。',
      src: [CONT_SRC(['market', 'bank', 'museum'], ['crate', 'showcase', 'vault']), CONT_SRC(null, ['safe'], 1)] },
    { k: 'manifest', title: '完整装货清单', need: ['bottom'],
      text: '调度室里列车的完整装货清单，E-17 十节车厢装了什么都列着。外头传的金子只是个添头；第 10 节写着"国家战略核指挥终端"。',
      src: [CONT_SRC(['factory', 'depot', 'hangar'], ['filecab', 'pc']), { k: 'kill', e: ['engineer'] }] },
    { k: 'escort', title: '护送记录', need: ['bottom'],
      text: '报废巡逻机的本地记录，确认 E-17 出站时受到武装护送：出城主线已经塌了，机器政权的追兵咬在后面，随车护卫在安保站下车断后。记录里还看得出，巡逻排班中间有一段空档。',
      src: [CONT_SRC(['hangar', 'factory', 'depot', 'relay'], ['wreck']), { k: 'kill', e: ['drone'], minTier: 1 }, CONT_SRC(['checkpoint', 'armory'], ['filecab', 'pc'])] },
    { k: 'maint', title: '维修日志', need: ['bottom'],
      text: '车辆段的维修日志指出：南栈六个铁道工手动改过这趟车，列车最后一次变轨后，进入了一段不在公开地图上的废弃环线。日志里还标着一间未被清空的零件库。',
      src: [CONT_SRC(['depot', 'hangar', 'factory', 'nest'], ['toolbox', 'partsbin']), { k: 'npc', npc: 'lin' }] },
    { k: 'transit', title: '旧运输图', need: ['maint'],
      text: '一张地下环线的旧运输图。那条躲着机器追兵、在各个塌城底下绕来绕去的暗线画在上面，从沦陷核心底下拐出去，终点没有站名。图上还标着一条更近的撤离路线。',
      src: [{ k: 'relay' }, { k: 'event', ev: 'radio' }] },
    { k: 'oldshell', title: '被改装的旧工壳', need: ['bottom'],
      text: pf => { const lost = (pf.log || []).find(l => l.lostShell), nm = lost && D.SHELLS[lost.lostShell] ? '你丢在城里的那台' + D.SHELLS[lost.lostShell].name : '一具退租以后流进废城的旧工壳'; return '拆开那台机器，里面是' + nm + '——被机器政权回收、改装成了自己的兵。取回的旧部件里记着一处修理窝点：机器在拿回收者丢下的壳子扩军，封锁深层铁道。'; },
      src: [{ k: 'oldshell' }, { k: 'event', ev: 'sos' }] },
    { k: 'dispatch', title: '调度副本', need: ['ticket'], needN: 4,
      text: '核爆当夜战时调度密电的副本。对外的说法是，所有能开的车都拿去疏散了；密电却写着另一回事——南栈的疏散班次被取消，E-17 被征去转移战略资产。完整的授权原件，存在随车的黑匣子里。',
      src: [CONT_SRC(['datacenter', 'relay', 'checkpoint'], ['rack', 'pc', 'filecab']), { k: 'npc', npc: 'ahsun' }] },
    { k: 'bid', title: '善后局的悬赏', need: [], needN: 5,
      text: '穹环善后局的绝密悬赏：车上的金子照收，E-17 的变轨坐标和制动密钥另出高价——远高于那一整车金子本身。报价里还包含独家交付、不对外披露的条件。',
      src: [{ k: 'npc', npc: 'lu' }, CONT_SRC(['bank', 'datacenter', 'museum'], ['safe', 'filecab'])] },
    { k: 'vaultmap', title: '储备库内部运输图', need: ['transit'],
      text: '零号战略储备库的结构图：整条地下环线上唯一有独立地热电站的盲肠掩体。闸门、充能站台和巡逻路线都画着，照着它走，能绕开一部分守卫。',
      src: [{ k: 'npc', npc: 'ahsun' }, CONT_SRC(['cache'], ['safe'])] },
    { k: 'entry', title: '储备库入口', need: ['manifest', 'escort', 'maint', 'transit'],
      text: '零碎的记录拼到一起：这条环线的尽头就是零号战略储备库——E-17 甩开机器追兵以后，唯一能停下来充能的地方。厚重的闸门和照常上班的守卫守着里面的东西。现场记录给出了能够验证的入口——一段检修隧道。',
      src: [{ k: 'npc', npc: 'lin' }, CONT_SRC(['cache'], ['filecab', 'safe'])] },
  ];
  // 剧情灵魂：每条线索后面加一句，把"车上有人"一点点透出来（第 8 条不改）。原文一字不动，见 story/剧情脚本.md
  const DARK = {
    ticket: '背面有人用铅笔写了一行字："南栈的人还在等吗？"没有署名。',
    rumor: '蹲深层支线的老回收者里还传着一句话：半夜铁轨会自己抖，有车不开灯从面前滑过去。',
    bottom: '货箱规格标着"重水铅封罐"，签收栏里是南栈装卸班的六个签名，第三个是"林远舟"。',
    manifest: '第一节是战备金砖，第二、三节标着带黄三角的"机动核弹头模块"，第 4 到第 9 节是"随车人员 · 142 人"。',
    escort: '护送对象写着"特级铅封资产 / 随车人员"，下面一行："后方机器追兵逼近，南栈站台人员聚集，判定：通行障碍。"',
    maint: '有人拆了远程控制，把自动驾驶仪跳了线：只要侦测到机器追兵，车就自己扳道换线接着跑。',
    transit: '环线终点旁边有人手写了三个字："零号港？"',
    dispatch: '最后一页："南栈 23:40 班次取消。E-17 改为特级资产专线。签发：陆衡。"',
    bid: '报价单最后一行："另：寻回第四节车厢随车遗物者，按件另酬。"',
    vaultmap: '充能区旁边有一行小字："车内额定维生：72 小时（备用滤罐极限 7 天）。"',
    entry: '地热充能记录显示，那趟车每隔几周就会滑进库里喘口气。算算日子，它这两天正在里面。',
  };
  for (const c of CLUES) if (DARK[c.k] && typeof c.text === 'string') c.dark = DARK[c.k]; // 分开存：英文按两句各自翻
  const CLUE = {}; CLUES.forEach((c, i) => { c.n = i + 1; CLUE[c.k] = c; });
  D.CLUES = CLUES;
  const clueText = (pf, c) => { const t = typeof c.text === 'function' ? c.text(pf) : c.text; if (!c.dark) return t; return D.I18N && D.I18N.lang === 'en' && D.tr ? D.tr(t) + ' ' + D.tr(c.dark) : t + c.dark; };

  // 委托物从哪来（只在对应委托进行中投放）
  const QITEMS = {
    'quest:pmod': { quest: 'l_power', src: [CONT_SRC(['market', 'ruin', 'hangar', 'refuge'], ['locker', 'crate', 'toolbox', 'register'])] },
    'quest:memcore': { quest: 'l_mem', src: [CONT_SRC(['factory', 'hangar', 'depot', 'nest'], ['wreck', 'partsbin', 'pc']), { k: 'kill', e: ['engineer', 'drone'] }] },
  };

  // ── 第 10 节战略黑匣子读出来的内容（第六段）和储备库里的过场文字
  const SERVER = { title: '第 10 节 · 战略黑匣子', text: [
    'E-17 第 10 节是战略核指挥车厢，黑匣子里存着核爆夜的全部原件。它二十三年没联过外网，没经过任何人的事后删改。调令、装车清单和授权签名都在里面。',
    '2163 年 4 月 9 日 21:50，核弹在岚川地面炸开，全城失电。统管战时防务的总控判定人类政府已经崩溃，启动战时自治协议：不怕辐射的机器接管城市，耗氧、怕辐射、会恐慌的活人被算成累赘和路障。去拉闸停机的维修班，被当成叛国破坏分子开火。',
    '为了不让最后一批核弹头落进机器手里，战区铁道调度主管陆衡签发《弃民保核令》：南栈 23:40 的防核疏散班次取消，E-17 改为战略核资产转移专线。23:52，后面咬着机器追兵的 E-17 没有减速，冲过了站满四百人的南栈站台。对外，各国只放出一句"失踪的黄金专列"。',
    '授权签名后面附着一份随车名单：技术与押车人员 136 人，南栈装卸班 6 人。车内额定维生预案：72 小时（靠备用滤罐撑到了第七天）。自动驾驶状态：游击变轨运行中，仅响应南栈站务台频段。',
    '最后一个分区上着锁：列车游击程序的最高制动与核威慑接管密钥。谁握着它，这车核弹就听谁的。档案副本已经传回南栈，之后工壳损毁也不会丢。原始介质带回去，更好核验。',
  ] };
  const E17_SCENE = { title: 'E-17', text: ['在站台尽头，E-17 静静停着。车厢里亮着灯。', '车窗后面，每个座位上都坐着一个人。一动不动。', '货厢里的封箱编号与前期找到的底单完全吻合。金砖是真的；后面两节铅封舱上，印着褪色的黄三角。'] };

  // ── 剧情灵魂：储备库车厢里的随车遗物（按 F 读，记进线索页的"遗物"一栏；不占线索名额，不影响流程）
  const RELICS = {
    relic_1: { car: 4, title: '名单的一页', text: '随车名单，打印的。其中一行的名字旁边，有人用圆珠笔写了一句：我不该在这上面。' },
    relic_2: { car: 5, title: '日记的一页', text: '第四天。车还在跑，不知道拐到哪条线了。张主任给大家讲笑话，讲得最难笑，大家都笑了。笑完谁也没再说话。' },
    relic_3: { car: 6, title: '毯子上的标签', text: '一块缝在毯子角上的布标，机器打的字：随车人员 · 周期拆洗 · 第 23 次。' },
    relic_4: { car: 7, title: '给妻子的信', text: '阿娟：保险柜的密码是你的生日。别来找我，这车停不下来了。把孩子带到城外去，别回头。' },
    relic_5: { car: 8, title: '一张车票', text: '零号港 · 单程 · 席位 08-14 · 23:40。票根没有撕。' },
    relic_6: { car: 8, title: '孩子的画', text: '一张蜡笔画：一列很长的车在黑隧道里跑，每个车窗里都画了一张笑脸。后面那节车厢只画了一半，窗户是空的。' },
  };
  function readRelic(pf, k) { const s = S0(pf), r = RELICS[k]; if (!r) return null; if (!s.relics) s.relics = []; if (!s.relics.includes(k)) s.relics.push(k); return r; }
  // 工牌（随车日志）、录音机（第四节靠窗）：手上没有、也还没交过，才给一件（丢了能补：这是重新出现的委托物，不是把丢掉的那件捡回来）
  function giveRelicItem(pf, id) {
    const s = S0(pf), done = id === 'quest:badge' ? s.flags.badge === 1 : id === 'quest:recorder' ? s.flags.recorder === 1 : false;
    if (id === 'quest:badge' && !done && s.quests.l_badge !== 'done') s.quests.l_badge = 'active';
    const G = D.Game, R = G && G.raid && G.raid.pf === pf ? G.raid : null;
    if (done || owns(pf, id) || (R && Gr().count(R.bag, x => x === id))) return false;
    if (R) { if (!Gr().canAdd(R.bag, id, 1)) return false; Gr().add(R.bag, id, 1); } else Gr().add(pf.stash, id, 1); // 背包满了就不给（丢到地上就捡不回来了），腾出一格再来
    return true;
  }
  // ── 委托
  const QUESTS = {
    l_power: { npc: 'lin', name: '电源模块', desc: '带回一个电源模块。商圈、废弃站、机库的储物柜、货箱、工具箱里常有。', need: [[['quest:pmod', 1]]], rewardText: '300 零件', reward: pf => { pf.money += 300; return '林桥把电源模块接上发电机，铺子里的灯亮了。"这是工钱。"（+300）'; } },
    l_mem: { npc: 'lin', name: '读出存储器', desc: '带回一块损坏的存储器。自动工厂、机库、维修库、虫巢的残骸和零件架里有；工程机、哨兵身上也可能有。', need: [[['quest:memcore', 1]]], rewardText: '线索「维修日志」+ 200 零件',
      reward: pf => { pf.money += 200; const got = learn(pf, 'maint', '林桥读出了存储器', null); return got ? '林桥接好线，屏幕上一行行滚出车辆段的维修日志。（+200）' : '林桥读完存储器："和你上次带回来的那份一样。"（+200）'; } },
    l_device: { npc: 'lin', name: '中继和解锁设备', desc: '服务器刀片、量子芯片、AI 核心、军用笔记本任选一件，再加 ' + DEVICE_COST + ' 零件的料钱。', need: [[['server', 1]], [['qchip', 1]], [['aicore', 1]], [['laptop', 1]]], cost: DEVICE_COST, rewardText: '解锁设备（进储备库要用）',
      reward: pf => { S0(pf).flags.device = true; return '林桥把芯片焊进一个小盒子，拍进你的工壳："独立中继，库里的机器认不出你，闸门也能开。"'; } },
    l_train: { npc: 'lin', name: '末班车', desc: '进储备库，找到 E-17，读出第 10 节的战略黑匣子。', auto: pf => S0(pf).copy, rewardText: '档案副本' },
    a_key: { npc: 'ahsun', name: '一张蓝卡', desc: '给阿隼一张蓝色门禁卡（红卡也行）。', need: [[['key2', 1]], [['key3', 1]]], rewardText: '线索「调度副本」',
      reward: pf => { const got = learn(pf, 'dispatch', '阿隼用蓝卡换来的', null); if (!got) pf.money += 250; return got ? '阿隼收起门禁卡，从怀里掏出一叠复印件："说好的。"' : '"副本你已经有了？那这张卡算我买的。"（+250）'; } },
    l_badge: { npc: 'lin', name: '工牌', desc: '把林远舟的工牌带回南栈，交给林桥。', need: [[['quest:badge', 1]]], rewardText: '（不给钱）', reward: pf => { S0(pf).flags.badge = 1; return '林桥接过工牌，用拇指擦掉照片上的灰。'; } },
    z_proof: { npc: 'lu', name: '试试你的本事', desc: '带给陆峥一块加密硬盘，或者两块固态硬盘。', need: [[['crypto', 1]], [['ssd', 2]]], rewardText: '600 零件', reward: pf => { pf.money += 600; return '陆峥看了看硬盘，点点头："不错。"（+600）'; } },
  };
  D.QUESTS = QUESTS;

  // 什么时候出现：写在剧情脚本的场次头 @when 里（src/cues.js 解析；开发面板里能临时改）
  const W = id => pf => !!(D.Cues && D.Cues.shows(id, pf));
  // ── 对话：when(pf) 满足就出现；choices 选了才算说完（keep 的选项不算）；quest 看到就接下；see(pf) 看到时执行
  const has = (pf, k) => S0(pf).clues.some(c => c.k === k);
  const nClues = pf => S0(pf).clues.length;
  const BEATS = [
    // 林桥
    { id: 'l_hello', npc: 'lin', when: W('l_hello'), quest: 'l_power',
      text: ['你在南栈的修理铺里醒来。林桥调好工壳的手臂和视觉，敲了敲外壳："能动了。记住，别把最后的电量花在回程路上——下一班接驳车的时间显示在站台屏幕上。"', '"铺子里的发电机快撑不住了。进城的时候帮我找个电源模块回来，商圈、废弃站、机库那种地方的柜子里常有。"'] },
    { id: 'l_ticket', npc: 'lin', when: W('l_ticket'),
      text: ['林桥把转运单对着灯看了半天。"E-17……装车时间比地面核爆、全线封死还晚了一个多钟头。上面都炸平了，哪来的车往外拉货？"', '"货要是真装上去了，总得有装箱的底单。去商圈、银行、博物馆翻翻货箱和柜台；争夺区以上的站里，保险柜也值得撬。"'] },
    { id: 'l_bottom', npc: 'lin', when: W('l_bottom'), quest: 'l_mem',
      text: ['"底单是真的，和货票的编号对得上。"林桥指着底单上的一行字，"E-17 先在军工物流站装过一批特级铅封箱。金子用得着重水铅封吗……"', '"自动工厂、维修库、机库——翻翻调度室的文件柜和电脑，吊运工程机身上也存着装货记录。那边的机器残骸里，可能还有当年护送它的巡逻机。"', '"捡到坏掉的存储器就拿回来，我能读。"'] },
    { id: 'l_mid', npc: 'lin', when: W('l_mid'),
      text: ['"清单、护送、维修……一百四十二个人，拉着一车核弹，在地底下跟机器捉迷藏。"林桥在旧地图上画了一道线，又擦掉。', '"它最后一次变轨以后，进了一段公开地图上没有的环线。去信号中继站把中继台修好，说不定能收到它变轨的信标；或者留意问号站里还在放的旧广播——总有人把运输图存了下来。"'] },
    { id: 'l_puzzle', npc: 'lin', when: W('l_puzzle'),
      text: ['林桥把你带回来的记录一张张摊开：装货清单、护送记录、维修日志、旧运输图。'],
      choices: [{ t: '一起把它们拼起来', go: pf => { learn(pf, 'entry', '林桥把记录拼了起来', null); return '林桥用笔把几张图连在一起，最后停在一个没有名字的终点上。'; }, need: pf => !has(pf, 'entry'), sub: pf => has(pf, 'entry') ? '你已经知道入口了' : '' },
        { t: '我已经找到入口的记录了', need: pf => has(pf, 'entry'), go: () => '林桥看了看你找到的现场记录："那就对上了。"' }] },
    { id: 'l_entry', npc: 'lin', when: W('l_entry'), quest: 'l_device',
      text: ['"那条环线尽头连着零号战略储备库，整条线上只有那里有独立的地热电站。"林桥压低声音，"车跑累了就滑进去充能。善后局和外头那几家都知道个大概，可战时的改道记录散了，能用的入口在哪，他们不清楚。派下来的承包队也折过好几台壳子。"', '"库里的机器认不出你。我给你做一套中继和制动信标，把我爸的工牌频段写进去——车认得自己人的信号，不会跑。要一块够好的芯片——服务器刀片、量子芯片、AI 核心或者军用笔记本都行，再加 ' + DEVICE_COST + ' 零件的料钱。"'] },
    { id: 'l_dispatch', npc: 'lin', when: W('l_dispatch'),
      text: ['林桥核对着调度副本，脸色越来越难看。"对外说那天夜里所有能开的车都拿去疏散了。可这上面写着：南栈 23:40 班次取消，E-17 改走战略资产专线。签发人姓陆。"', '"南栈当年也在等车。"'] },
    { id: 'l_device', npc: 'lin', when: W('l_device'), quest: 'l_train',
      text: ['"装好了。储备库在沦陷核心旁边那条废弃支线的尽头，入口那段检修隧道里有一台重型轨道工程机，沿着轨道横冲直撞……小心点。"', '"进去以后找第 10 节的黑匣子。货是你的，可我想知道——当年那些人为什么没有等来列车。"'] },
    { id: 'l_end', npc: 'lin', when: W('l_end'), open: pf => !FINAL[S0(pf).ending],
      text: ['林桥看完你读出来的档案，很久没有说话。"他们不是被困死的……是他们自己把车焊死，带着那车核弹在地底下跑了二十三年。南栈的班次，是被一张单子取消的。"', '"那趟车的信标现在认南栈的频段。你要是愿意，把档案交给站民，再传给外头的独立电台。货还是你的，照样卖钱——只要外头知道那车核弹听南栈的招呼，往后谁也不敢再拿地底下的人当挡路的。"'],
      choices: [{ t: '公开记录', sub: '档案公开，南栈的频段接管 E-17。之后林桥修工壳半价', go: pf => ending(pf, 'public') }, { t: '再想想', keep: true }] },
    { id: 'l_after', npc: 'lin', when: W('l_after'),
      text: ['维修铺发来消息："新机子装好了。下一趟还去吗？"'] },
    // 阿隼
    { id: 'a_hello', npc: 'ahsun', when: W('a_hello'),
      text: ['一个同行靠在交易行门口，冲你扬了扬下巴。"阿隼。跟你一样，靠城里吃饭。"', '"听说你手上有张 E-17 的货票？那个车次，老一点的回收者都知道。消息不白给——100 零件。"'],
      choices: [{ t: '付 100 零件', cost: 100, need: pf => !has(pf, 'rumor'), sub: pf => has(pf, 'rumor') ? '你已经听说过了' : '', go: pf => { learn(pf, 'rumor', '阿隼卖给你的消息', null); return '阿隼收了钱，把那列"失踪末班车"的传闻讲了一遍。'; } },
        { t: '不用了', go: () => '"随你。想通了再来找我。"' }] },
    { id: 'a_key', npc: 'ahsun', when: W('a_key'), quest: 'a_key',
      text: ['"跟你做笔买卖。"阿隼压低声音，"我知道调度副本在哪，可那间机房我进不去——要一张蓝色门禁卡。你给我卡，我把副本给你。"'] },
    { id: 'a_map', npc: 'ahsun', when: W('a_map'),
      text: ['阿隼摊开一张图："储备库内部的运输图，我自己弄来的。实话告诉你，其中一个入口的位置我已经卖给了另一支回收队。"', '"详细路线可以和你共享。要么合作——你带出来的东西我拿两成，到时候我替你守一边；要么一口价 ' + AHSUN_MAP + '；要么你自己去找。"'],
      choices: [{ t: '合作', sub: '储备库那趟带回价值的两成归他；那里的撤离战每波少一台', go: pf => { S0(pf).flags.ahsun = 'coop'; learn(pf, 'vaultmap', '和阿隼合作', null); return '"成交。到了库里，我守一边。"'; } },
        { t: '一次性买图', cost: AHSUN_MAP, go: pf => { S0(pf).flags.ahsun = 'paid'; learn(pf, 'vaultmap', '向阿隼买的图', null); return '阿隼把图折好递给你："两清了。到时候各走各的路。"'; } },
        { t: '自己找', sub: '隐藏仓库的保险柜里可能有', go: pf => { S0(pf).flags.ahsun = 'self'; return '"有骨气。那就库里见了——别挡我的道。"'; } }] },
    { id: 'a_cut', npc: 'ahsun', when: W('a_cut'),
      text: [pf => '"按约定，两成。"阿隼点完货，冲你点点头。（已付 ' + S0(pf).flags.cut + '）"下次还有这种活儿，记得找我。"'] },
    // 陆峥
    { id: 'z_hello', npc: 'lu', when: W('z_hello'), quest: 'z_proof', see: pf => learn(pf, 'bid', '陆峥递来的报价单', null),
      text: ['一个穿着干净外套的人在据点门口等你。"陆峥，穹环善后局，负责战前特级资产的清收。"他递来一张报价单，"听说你在找 E-17。外头都以为三战把核弹打光了。有些东西，各国都不希望它重见天日，但都希望落在自己手里——价钱好商量。"', '"先试试你的本事：带一块加密硬盘给我，或者两块固态硬盘。"'] },
    { id: 'z_entry', npc: 'lu', when: W('z_entry'),
      text: ['陆峥又来了。"听说你找到了入口。"他笑了笑，"告诉我在哪，500 零件。承包队自己会去，不碍你的事。"'],
      choices: [{ t: '告诉他', sub: '+500 零件；储备库里会多一支善后局的承包队', go: pf => { pf.money += 500; S0(pf).flags.toldLu = true; return '陆峥记下坐标："合作愉快。"（+500）'; } }, { t: '不告诉', go: () => '"可惜。那我们库里见。"' }] },
    { id: 'z_end', npc: 'lu', when: W('z_end'), open: pf => !FINAL[S0(pf).ending],
      text: ['陆峥的通信接了进来。"我知道你读到了什么。"他的声音很平静，"独家交付档案和制动密钥，' + LU_PAY + '；原始介质另加 ' + LU_MEDIA + '。条件不变：不对外披露。"', '"金砖和实物你照样卖。只是这趟车的缰绳和记录，我希望只在我们手里。"'],
      choices: [{ t: '接受独家收购', sub: '+' + LU_PAY + '；仓库里有原始介质再 +' + LU_MEDIA + '（介质交给他）', go: pf => ending(pf, 'sell') }, { t: '暂时保留', sub: '正常卖货，记录留着；以后还能再选', need: pf => S0(pf).ending !== 'keep', go: pf => ending(pf, 'keep') }, { t: '再想想', keep: true },
        { t: '把录音机给他', sub: '不给钱，也不影响上面怎么选', keep: true, need: pf => owns(pf, 'quest:recorder') && S0(pf).flags.recorder !== 1, go: pf => { for (const g of [pf.stash, pf.kit, pf.safe]) if (g && Gr().take(g, 'quest:recorder', 1)) break; S0(pf).flags.recorder = 1; return '陆峥接过录音机，按下了播放键。'; } }] },
  ];
  D.BEATS = BEATS;

  // ── 状态
  const fresh = () => ({ clues: [], talk: {}, quests: {}, flags: {}, miss: 0, marks: [], copy: false, e17: 0, ending: null, relics: [] });
  function S0(pf) { return pf.story || (pf.story = fresh()); }
  const owns = (pf, id) => [pf.stash, pf.kit, pf.safe, pf.keycase].some(g => g && Gr().count(g, x => x === id) > 0);
  function avail(pf, c) { if (has(pf, c.k)) return false; if (c.needN && nClues(pf) < c.needN) return false; return c.need.every(k => has(pf, k)); }
  function learn(pf, k, how, at) {
    const s = S0(pf), c = CLUE[k]; if (!c || has(pf, k)) return null;
    s.clues.push({ k, day: (pf.raids | 0), at: at != null ? pf.city.stations[at].name : null, how });
    if (at != null && !s.marks.includes(at)) s.marks.push(at);
    applyCity(pf);
    (D.Story.onLearn || (() => {}))(pf, c);
    return c;
  }
  function applyCity(pf) {
    const C = pf.city, s = S0(pf); if (!C || C.reserve == null) return;
    const r = C.stations[C.reserve];
    if (has(pf, 'entry') && (C.known.get(r.id) | 0) < 1) C.known.set(r.id, 1);
    r.name = s.ending ? 'E-17 · 储备库' : '无名支线';
  }

  // ── 结局
  const EPI = {
    common: pf => '你在零号港结束接入。清点、出售和分成之后，账户第一次足够支付自己的工壳和稳定住所。林桥拿到了维修与支援的费用' + ((S0(pf).flags.cut || 0) > 0 ? '，阿隼得到了约定的报酬' : '') + '，你的发财目标得到了实际回报。',
    public: '公开记录。你保留了搜刮的收益，把黑匣子档案交给站民，传给了外头的独立电台。南栈的站务频段接管了 E-17——这列幽灵核专列还在地底下跑，只是从今往后听南栈的招呼。外面的大国再也不敢轻举妄动，地底下的机器也照样上班；只是这片废墟底下的人，手里也有了让大人物低头的分量。',
    sell: '接受独家收购。你拿到了额外的报酬，把黑匣子和制动密钥交了出去，并自愿守着保密的约定。陆峥背后的大国独吞了这车核弹，外面的规矩从此由他们定；陆衡在档案里，只是一个殉职的调度官——这份约定，靠你守着。',
    keep: '暂时保留。你拿走了金子，把记录留在身边，E-17 照旧在黑暗里一站一站地逃。寻宝的目标已经完成，公开还是交易，可以以后再说。',
    tail: ['不论选择哪种收束，岚川地底仍有没去过的区域、照常上班的机器和流动的物资。E-17 上的金子会逐步被搬空，后续的收益来自新的区域和现有的贸易。', '最后，维修铺发来消息："新机子装好了。下一趟还去吗？"', '你看向路线图。那条曾经没有名字的支线，终于有了一枚自己的标记。'],
  };
  function ending(pf, k) {
    const s = S0(pf); if (FINAL[s.ending]) return null;
    const first = !s.ending; let extra = '';
    if (k === 'sell') {
      pf.money += LU_PAY; extra = '（+' + LU_PAY;
      for (const g of [pf.stash, pf.kit, pf.safe]) if (Gr().take(g, 'quest:media', 1)) { pf.money += LU_MEDIA; extra += '，原始介质 +' + LU_MEDIA; break; }
      extra += '）';
    }
    s.ending = k; if (k === 'public') s.flags.screen = 'E-17 · 南栈 · 已找到'; applyCity(pf);
    return { ending: k, first, extra, text: epilogue(pf) };
  }
  function epilogue(pf) { const s = S0(pf); return s.ending ? [EPI.common(pf), EPI[s.ending], ...EPI.tail] : null; }

  // ── 对话和委托（据点用）
  // 有选项的话：没选过就开着；带 open 的（结局）在 open 为真时一直能重选
  const beatOpen = (pf, b) => !!b.choices && (S0(pf).talk[b.id] == null || (!!b.open && b.open(pf)));
  function visibleBeats(pf, npc) { const s = S0(pf); return BEATS.filter(b => (!npc || b.npc === npc) && (s.talk[b.id] != null || b.when(pf))); }
  function seeBeats(pf) { // 打开人物页时：看过的话记下，接委托，触发 see。返回新读到的线索
    const s = S0(pf), n0 = s.clues.length;
    for (const b of visibleBeats(pf)) {
      if (b.quest && !s.quests[b.quest]) s.quests[b.quest] = 'active';
      if (b.see) b.see(pf);
      if (!b.choices && s.talk[b.id] == null) s.talk[b.id] = 0;
    }
    for (const q in QUESTS) if (s.quests[q] === 'active' && QUESTS[q].auto && QUESTS[q].auto(pf)) s.quests[q] = 'done';
    return s.clues.slice(n0).map(c => CLUE[c.k]);
  }
  const choiceOK = (pf, c) => (!c.cost || pf.money >= c.cost) && (!c.need || c.need(pf));
  function choose(pf, id, i) {
    const b = BEATS.find(x => x.id === id), s = S0(pf); if (!b || !b.choices || !beatOpen(pf, b)) return null;
    const c = b.choices[i]; if (!c || !choiceOK(pf, c)) return null;
    if (c.cost) pf.money -= c.cost;
    const r = c.go ? c.go(pf) : null;
    if (!c.keep) s.talk[b.id] = i + 1;
    return typeof r === 'string' ? { text: r } : r || { text: '' };
  }
  function questOption(pf, id) { // 交得出哪一组；没有返回 -1
    const q = QUESTS[id]; if (!q.need) return -1;
    const cnt = x => [pf.stash, pf.kit, pf.safe, pf.keycase].filter(Boolean).reduce((a, g) => a + Gr().count(g, y => y === x), 0);
    return q.need.findIndex(opt => opt.every(([x, n]) => cnt(x) >= n));
  }
  const canTurnIn = (pf, id) => S0(pf).quests[id] === 'active' && questOption(pf, id) >= 0 && pf.money >= (QUESTS[id].cost || 0);
  function turnIn(pf, id) {
    if (!canTurnIn(pf, id)) return null;
    const q = QUESTS[id], opt = q.need[questOption(pf, id)];
    for (const [x, n] of opt) { let left = n; for (const g of [pf.stash, pf.kit, pf.safe, pf.keycase].filter(Boolean)) { while (left > 0 && Gr().take(g, x, 1)) left--; } }
    if (q.cost) pf.money -= q.cost;
    S0(pf).quests[id] = 'done';
    return q.reward ? q.reward(pf) : '';
  }
  function newCount(pf) { const s = S0(pf); return visibleBeats(pf).filter(b => s.talk[b.id] == null).length + Object.keys(QUESTS).filter(q => canTurnIn(pf, q)).length; }

  // ── 下一步（线索日志顶上）
  const WHERE = {
    ticket: '去商圈、废弃站、博物馆、银行、机库翻储物柜、快递柜和收银台；安全区和争夺区里的拾荒者遗体也看看',
    bottom: '找装箱底单：商圈、银行、博物馆的货箱、珠宝柜台、金库保险柜，或者争夺区以上站里的保险柜',
    manifest: '装货清单：自动工厂、维修库、机库的文件柜和电脑；工程机身上也可能存着',
    escort: '护送记录：机库、自动工厂、维修库、信号中继站的机器残骸；机器检查站、军械库的文件柜和电脑；争夺区以上的哨兵身上也可能有',
    maint: '维修日志：维修库、机库、自动工厂、虫巢的工具箱和零件架；或者带一块损坏的存储器给林桥',
    transit: '旧运输图：修好信号中继站的中继台，或者听问号站的旧广播',
  };
  function nextSteps(pf) {
    const s = S0(pf), out = [];
    if (s.ending && FINAL[s.ending]) return ['主线完成。储备库还能再去，E-17 的货会越来越少。'];
    if (s.copy) return ['回人物页做出选择：把记录公开、卖给陆峥背后的善后局，或者暂时保留。'];
    if (s.flags.device) return ['去储备库：沦陷核心旁那段废弃支线的尽头（线路图上的紫色支线）。找到 E-17，读出第 10 节的战略黑匣子。'];
    if (has(pf, 'entry')) return ['林桥要一块好芯片和 ' + DEVICE_COST + ' 零件做解锁设备（人物页）。服务器刀片、量子芯片多在数据中心的服务器机柜里。'];
    if (['manifest', 'escort', 'maint', 'transit'].every(k => has(pf, k))) return ['回南栈，把记录摊给林桥看（人物页）。'];
    for (const k of ['ticket', 'bottom']) if (!has(pf, k)) { out.push(WHERE[k]); return out; }
    for (const k of ['manifest', 'escort', 'maint']) if (!has(pf, k)) out.push(WHERE[k]);
    if (has(pf, 'maint') && !has(pf, 'transit')) out.push(WHERE.transit);
    return out;
  }

  // ── 站内：进站投放
  const srcMatch = (sc, st) => sc.k === 'cont' && (!sc.st || sc.st.includes(st.type)) && st.tier >= sc.minTier && st.tier <= sc.maxTier;
  function putInto(S, rng, sc, id) {
    const list = S.containers.filter(c => sc.c.includes(c.kind) && !c.opened && !c.e17);
    rng.shuffle(list);
    for (const c of list) { if (Gr().add(c.grid, id, 1) === 0) { for (const e of c.items) if (e.seen !== true) e.seen = false; c.story = id; return c; } }
    return null;
  }
  const storyQ = (S, b) => (S.storyQ || (S.storyQ = [])).push(b);
  function onEnter(S, o) {
    const R = S.raid, pf = R && R.pf; if (!pf || R.tut || S.tut || (o && o.revisit)) return;
    const s = S0(pf), st = S.st, rng = D.rng(R.city.seed + ':story:' + st.id + ':' + S.step + ':' + pf.raids);
    if (st.type === 'reserve') reserveSetup(S, rng);
    if (S.safe) return;
    // 线索：前置满足、来源对得上的，按剧情顺序挑第一条
    const cand = [];
    for (const c of CLUES) if (avail(pf, c)) for (const sc of c.src) if (srcMatch(sc, st) && S.containers.some(x => sc.c.includes(x.kind) && !x.opened)) { cand.push([c, sc]); break; }
    if (cand.length) {
      if (rng() < DROP_P + s.miss * DROP_PITY) { const [c, sc] = cand[0]; if (putInto(S, rng, sc, 'clue:' + c.k)) s.miss = 0; }
      else s.miss++;
    }
    // 委托物
    for (const id in QITEMS) {
      const Q = QITEMS[id]; if (s.quests[Q.quest] !== 'active' || owns(pf, id) || Gr().count(R.bag, x => x === id)) continue;
      const sc = Q.src.find(x => srcMatch(x, st)); if (sc && rng() < QDROP_P) putInto(S, rng, sc, id);
    }
    // 旧工壳遭遇
    if (avail(pf, CLUE.oldshell) && ['nest', 'depot', 'factory', 'hangar'].includes(st.type) && rng() < OLDSHELL_P) S.oldshellPending = true;
  }
  function reserveSetup(S, rng) {
    const pf = S.raid.pf, s = S0(pf);
    S.reserve = true; S.coop = s.flags.ahsun === 'coop';
    const fi = S.floors.findIndex(F => F.e17);
    if (fi >= 0) { // 剧情灵魂：手工搭的 E-17 一段（reserve-e17.js）
      const F = S.floors[fi], spots = F.e17spots;
      S.e17 = { f: fi, spots: spots.filter(q => /^(relic|log|recorder)$/.test(q.k)).map(q => Object.assign({ f: fi }, q)), seen: false };
      const sv = spots.find(q => q.k === 'server'); S.server = { f: fi, x: sv.x, y: sv.y, used: false };
      const n = Math.max(0, E17_CRATES - 2 * (s.e17 | 0));
      spots.filter(q => q.k === 'crate').slice(0, n).forEach(q => { const nc = D.newContainer(S, rng, 'e17', q.x, q.y, D.CONT.e17.bonus); nc.f = fi; nc.room = F.room[Math.floor(q.y / TS) * F.tw + Math.floor(q.x / TS)]; nc.e17 = true; S.containers.push(nc); });
      for (const q of spots.filter(q => q.k === 'laoka')) { const c = S.containers.find(c => c.f === fi && Math.hypot(c.x - q.x, c.y - q.y) < 2); if (c) c.laoka = true; }
      S.reserveFirst = true; S.thin = has(pf, 'vaultmap');
      storyQ(S, { t: 0, text: '地下战略储备库', sub: '货物封存，等待接收。', keep: true });
      return;
    }
    const pool = S.containers.filter(c => c.f === 1).concat(S.containers.filter(c => c.f !== 1));
    const sv = pool.shift();
    if (sv) { S.containers.splice(S.containers.indexOf(sv), 1); S.server = { f: sv.f, x: sv.x, y: sv.y, used: false }; }
    const n = Math.max(0, E17_CRATES - 2 * (s.e17 | 0));
    for (let i = 0; i < n && pool.length; i++) {
      const c = pool.shift(), nc = D.newContainer(S, rng, 'e17', c.x, c.y, D.CONT.e17.bonus);
      nc.f = c.f; nc.room = c.room; nc.e17 = true; S.containers[S.containers.indexOf(c)] = nc;
    }
    S.reserveFirst = true; S.thin = has(pf, 'vaultmap');
    storyQ(S, { t: 0, text: '地下战略储备库', sub: '货物封存，等待接收。', keep: true });
  }
  // 每帧：读背包里的线索、储备库的事件、排队的横幅
  function tick(S) {
    const R = S.raid, pf = R && R.pf; if (!pf || R.tut || S.tut) return;
    if (S.reserveFirst) { // 第一帧：守卫已经刷好了
      S.reserveFirst = false;
      if (S.thin) { const r = D.rng('thin:' + S.step + ':' + pf.raids); S.enemies = S.enemies.filter(e => r() > 0.3); storyQ(S, { t: 0, text: '按运输图走', sub: '绕开了一部分巡逻' }); }
      const b = D.K.spawnEnemy(S, 'boss', S.A.w / 2 + 70, 15 * TS, 2.5, 1, false); b.home = null;
      storyQ(S, { t: 0, text: '重型轨道工程机', sub: '它沿轨道冲撞，把侵入者当作需要清除的障碍' });
      if (!S.e17 && D.UI && D.UI.storyCard) D.UI.storyCard(E17_SCENE.title, E17_SCENE.text);
    }
    if (S.e17 && !S.e17.seen && S.f === S.e17.f && S.player.x > 18 * TS) { S.e17.seen = true; if (D.Mood) D.Mood.glitch(400); if (D.UI && D.UI.storyCard) D.UI.storyCard(E17_SCENE.title, E17_SCENE.text); }
    if (S.oldshellPending) {
      S.oldshellPending = false;
      const e = D.K.spawnEnemy(S, 'engineer', S.A.w / 2 - 60, 15 * TS, 1.6, 1, false); e.oldshell = true; e.home = null; e.hp = e.maxHp = Math.round(e.maxHp * 0.85);
      storyQ(S, { t: 0, text: '旧工壳', sub: '一台工壳被回收机械改装过，正朝你走来' });
    }
    if (S.reserve && !S.alarm && S.containers.some(c => c.e17 && c.opened)) {
      S.alarm = true; const s = S0(pf), A = S.floors[1] || S.A;
      storyQ(S, { t: 0, text: '本地安保响应', sub: '打开货厢惊动了守卫——装得下多少，带得回多少', keep: true });
      for (let i = 0; i < 2; i++) D.K.spawnEnemy(S, 'drone', i ? A.w - 4 * TS : 4 * TS, 14 * TS, 1 + i * 0.4, 1, true);
      if (s.flags.toldLu) { for (let i = 0; i < 3; i++) D.K.spawnEnemy(S, 'raider', A.w - 3 * TS, (13 + i * 2) * TS, 2 + i * 0.4, 1, true); storyQ(S, { t: 0, text: '承包队', sub: '善后局的人循着你卖的坐标进了库区' }); }
      S.linger = { next: S.t + 12, n: 1 };
    }
    if (S.storyQ && S.storyQ.length && !S.banner) S.banner = S.storyQ.shift();
    scanBag(R, S);
  }
  // 背包里有没读过的线索纸：读出来
  function scanBag(R, S) {
    const pf = R.pf; if (!pf || R.tut) return;
    for (const e of R.bag.items) {
      if (!e.id.startsWith('clue:')) continue;
      const k = e.id.slice(5); if (has(pf, k)) continue;
      const where = S && S.lootOpen && S.lootOpen.kind ? D.CONT[S.lootOpen.kind].name : null;
      const c = learn(pf, k, where ? '在' + where + '里翻到' : '在城里捡到', R.at);
      if (c) { if (S) storyQ(S, { t: 0, text: '线索', sub: c.title }); if (D.Sfx) D.Sfx.play('rare'); if (D.UI && D.UI.clueCard) D.UI.clueCard(pf, c); }
    }
  }
  // 交互：储备库车厢里的遗物、日志、录音机（范围里的每一样都交成候选，D.Pick 选最近的，interact.js）
  function e17Cands(S, add) {
    const E = S.e17, p = S.player; if (!E || S.f !== E.f) return;
    const pf = S.raid.pf, s = S0(pf);
    for (const q of E.spots) {
      if ((q.k === 'recorder' && q.taken) || Math.hypot(q.x - p.x, q.y - p.y) >= 20) continue;
      const at = { ref: q, x: q.x, y: q.y, key: 'F' };
      if (q.k === 'relic') {
        const R = RELICS[q.id], read = (s.relics || []).includes(q.id);
        const tr = D.tr || (x => x);
        add(Object.assign(at, { text: tr(read ? '再看一眼：' : '读：') + tr(R.title), go: inp => { if (inp.interact) { readRelic(pf, q.id); if (D.Barks) D.Barks.relic(S, q, R); else S.banner = { t: 0, text: R.title, sub: R.text }; if (D.Sfx) D.Sfx.play('pick'); } } }));
      } else if (q.k === 'log') {
        add(Object.assign(at, { text: '读随车日志（南栈站务 林远舟）', go: inp => { if (inp.interact && D.Scene) { const G = D.Game; D.Scene.play(['carriage_log'], pf, () => { if (G.S === S && D.UI) D.UI.station(S); if (s.flags.badge !== 1 && !owns(pf, 'quest:badge') && !Gr().count(S.raid.bag, x => x === 'quest:badge')) S.banner = { t: 0, text: '背包满了', sub: '工牌还压在日志底下，腾出一格再来读' }; }); } } }));
      } else if (q.k === 'recorder') {
        add(Object.assign(at, { text: '按下录音机的播放键', go: inp => { if (inp.interact) { if (giveRelicItem(pf, 'quest:recorder')) q.taken = true; else if (s.flags.recorder !== 1 && !owns(pf, 'quest:recorder') && !Gr().count(S.raid.bag, x => x === 'quest:recorder')) S.banner = { t: 0, text: '背包满了', sub: '腾出一格再来拿录音机' }; if (D.Barks) D.Barks.recorder(S, q); if (D.Sfx) D.Sfx.play('click'); } } }));
      }
    }
  }
  // 交互：第 10 节的战略黑匣子
  function cands(S, add) {
    e17Cands(S, add);
    const sv = S.server, p = S.player; if (!sv || sv.f !== S.f || Math.hypot(sv.x - p.x, sv.y - p.y) > 24) return;
    if (sv.used) add({ ref: sv, x: sv.x, y: sv.y, key: '', text: '黑匣子的档案已经读出来了' });
    else add({ ref: sv, x: sv.x, y: sv.y, key: 'F', text: '读出战略黑匣子', go: inp => { if (inp.interact) readServer(S, sv); } });
  }
  // 老接口：只看剧情的东西。返回 true 表示范围里有
  function interact(S, inp) { return D.Pick.solo(S, inp, cands); }
  function readServer(S, sv) {
    sv.used = true; const pf = S.raid.pf, s = S0(pf); s.copy = true;
    if (s.quests.l_train === 'active') s.quests.l_train = 'done';
    if (D.Grid.add(S.raid.bag, 'quest:media', 1)) D.dropAt(S, 'quest:media', 1);
    S.banner = { t: 0, text: '档案副本已传回', sub: '之后工壳损毁也不会丢', keep: true };
    if (D.Sfx) D.Sfx.play('power'); D.K.ring(S, sv.x, sv.y - 6, 40, '#3ee8ff');
    if (D.UI && D.UI.storyCard) D.UI.storyCard(SERVER.title, SERVER.text);
  }
  function onKill(S, e, x) {
    const R = S.raid, pf = R && R.pf; if (!pf || R.tut || S.tut) return;
    if (e.oldshell) { if (avail(pf, CLUE.oldshell)) D.K.scatter(S, x, e.y, e.f, 'clue:oldshell', 1); D.K.scatter(S, x, e.y, e.f, 'servo', 1); return; }
    const s = S0(pf);
    if (!S.killClue) for (const c of CLUES) {
      if (!avail(pf, c)) continue;
      const sc = c.src.find(q => q.k === 'kill' && q.e.includes(e.kind) && S.st.tier >= (q.minTier || 0));
      if (sc && S.rng() < KILL_P) { S.killClue = true; D.K.scatter(S, x, e.y, e.f, 'clue:' + c.k, 1); break; }
    }
    for (const id in QITEMS) { const Q = QITEMS[id]; if (s.quests[Q.quest] !== 'active' || owns(pf, id) || Gr().count(R.bag, y => y === id) || S.killQ) continue; if (Q.src.some(q => q.k === 'kill' && q.e.includes(e.kind)) && S.rng() < KILL_P) { S.killQ = true; D.K.scatter(S, x, e.y, e.f, id, 1); } }
  }
  function onRelay(S) { const pf = S.raid.pf; if (pf && avail(pf, CLUE.transit)) { const c = learn(pf, 'transit', '修好中继台截到的', S.raid.at); if (c && D.UI && D.UI.clueCard) D.UI.clueCard(pf, c); } }
  // 问号站：radio 记下坐标；sos 搜到的不是诱饵 → 返回要额外给的东西
  function onEvent(R, k) {
    const pf = R.pf; if (!pf || R.tut) return null;
    if (k === 'radio' && avail(pf, CLUE.transit)) { const c = learn(pf, 'transit', '问号站的旧广播里记下的', R.at); if (c && D.UI && D.UI.clueCard) D.UI.clueCard(pf, c); }
    if (k === 'sos' && avail(pf, CLUE.oldshell)) return { id: 'clue:oldshell', n: 1 };
    return null;
  }
  // 行动中的商人：打听 E-17
  function traderOffer(pf) { return pf && avail(pf, CLUE.rumor) ? { label: '打听 E-17', cost: 50 } : null; }
  function traderAsk(R) { const pf = R.pf; if (!traderOffer(pf) || pf.money < 50) return null; pf.money -= 50; const c = learn(pf, 'rumor', '向商人打听的', R.at); if (c && D.UI && D.UI.clueCard) D.UI.clueCard(pf, c); return c; }
  // 储备库能不能走过去
  function canEnter(pf, st) { return st.type !== 'reserve' || !!S0(pf).flags.device; }
  // 结算：从储备库撤出
  function onFinish(R, out) {
    const pf = R.pf, C = R.city; if (!pf || R.tut || C.reserve == null) return;
    const s = S0(pf);
    if (out.ok && R.visited.has(C.reserve)) {
      s.e17 = (s.e17 | 0) + 1;
      if (s.flags.ahsun === 'coop') { const cut = Math.min(pf.money, Math.round(out.value * AHSUN_CUT)); pf.money -= cut; s.flags.cut = (s.flags.cut || 0) + cut; out.cut = cut; }
    }
  }
  // 存档
  function serialize(pf) { return JSON.parse(JSON.stringify(S0(pf))); }
  function deserialize(pf, o) {
    const s = fresh();
    if (o && typeof o === 'object') {
      if (Array.isArray(o.clues)) s.clues = o.clues.filter(c => c && CLUE[c.k]).map(c => ({ k: c.k, day: c.day | 0, at: c.at || null, how: c.how || '' }));
      for (const k of ['talk', 'quests', 'flags']) if (o[k] && typeof o[k] === 'object') s[k] = Object.assign({}, o[k]);
      s.miss = o.miss | 0; s.marks = Array.isArray(o.marks) ? o.marks.filter(n => Number.isInteger(n)) : []; s.copy = !!o.copy; s.e17 = o.e17 | 0;
      s.ending = ['public', 'sell', 'keep'].includes(o.ending) ? o.ending : null;
      s.relics = Array.isArray(o.relics) ? o.relics.filter(k => RELICS[k]) : [];
    }
    pf.story = s; applyCity(pf); return s;
  }
  const marks = pf => pf && pf.story ? pf.story.marks : [];

  D.Story = { S: S0, fresh, has, avail, learn, DARK, RELICS, readRelic, giveRelicItem, applyCity, CLUE, CLUES, QUESTS, BEATS, NPC, SERVER, E17_SCENE, clueText, visibleBeats, seeBeats, beatOpen, choose, choiceOK, canTurnIn, turnIn, questOption, newCount, nextSteps, ending, epilogue,
    onEnter, tick, scanBag, interact, cands, onKill, onRelay, onEvent, traderOffer, traderAsk, canEnter, onFinish, serialize, deserialize, marks, QITEMS, srcMatch,
    TUNE: { DROP_P, DROP_PITY, QDROP_P, KILL_P, OLDSHELL_P, E17_CRATES, AHSUN_CUT, LU_PAY, LU_MEDIA, AHSUN_MAP, DEVICE_COST } };
})(D);
