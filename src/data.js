/* 末班之后 · 小样二：物品、装备卡、敌人、站点类型。调数值改这里。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';

  // ── 品质：白 绿 蓝 紫 金 红（参照三角洲行动的分级）
  D.QUALITY = [
    { name: '普通', col: '#c8cbd6', glow: 0 },
    { name: '优良', col: '#5fd068', glow: 0 },
    { name: '精良', col: '#4a9dff', glow: 0.3 },
    { name: '史诗', col: '#b36bff', glow: 0.6 },
    { name: '传说', col: '#ffc23d', glow: 1 },
    { name: '至宝', col: '#ff3d4a', glow: 1.4 },
  ];
  // 门禁卡：等级高的能开等级低的门。一张用一次
  D.KEY_LEVEL = { keycard: 1, key1: 1, key2: 2, key3: 3 };
  D.KEY_NAME = [null, '绿色门禁卡', '蓝色门禁卡', '红色门禁卡'];
  D.KEY_COL = [null, '#5fd068', '#4a9dff', '#ff3d4a'];
  D.KEY_PRICE = { key1: 420, key2: 1180, key3: 3000 }; // 交易行卖价（买比卖贵）
  D.KEY_DROP = { base: 0.004, perTier: 0.003, enemy: 0.05 }; // 每件战利品换成门禁卡的概率；回收者掉卡的概率
  D.KEYCASE = [4, 1]; // 门禁卡包：4 格，只放门禁卡，死了也不丢
  // 难度（出发前选）：越高敌人越多越硬、打得越疼，东西品质越好，撤离战越长
  D.DIFF = [
    { name: '常规', hp: 1,    dmg: 1,   loot: 0, extra: 0, ext: 1,    col: '#c8cbd6', desc: '标准难度' },
    { name: '机密', hp: 1.25, dmg: 1.2, loot: 1, extra: 1, ext: 1.15, col: '#4a9dff', desc: '敌人更硬更多；东西品质高一档的机会大', need: '撤离成功 5 次解锁' },
    { name: '绝密', hp: 1.5,  dmg: 1.4, loot: 2, extra: 2, ext: 1.3,  col: '#ff3d4a', desc: '敌人最硬最多；东西品质最好', need: '机密难度撤离成功 3 次解锁' },
  ];
  // 机器人涂装：纯外观，一次买下所有型号都能用
  D.SKINS = {
    none:   { name: '原厂',   tint: null,      visor: null,      price: 0 },
    night:  { name: '夜巡黑', tint: '#2c313d', visor: '#ff3d4a', price: 400 },
    hazard: { name: '警戒橙', tint: '#e07a20', visor: '#ffe28a', price: 400 },
    frost:  { name: '冻土白', tint: '#d8e2ea', visor: '#3ee8ff', price: 400 },
    army:   { name: '军绿',   tint: '#5a7a3a', visor: '#ffb057', price: 400 },
    neon:   { name: '霓虹粉', tint: '#d0409a', visor: '#3ee8ff', price: 700 },
    gold:   { name: '鎏金',   tint: '#c9a23a', visor: '#fff4c0', price: 1500 },
  };
  D.CAT_NAME = { mat: '材料', elec: '电子', med: '医疗', val: '贵重物品', metal: '贵金属', part: '机械部件', intel: '情报' };

  // ── 战利品：品质 q、基础价值 v、占背包格数 size、分类 cat、图标 art
  D.ITEMS = {
    scrap:    { name: '废铜线',     q: 0, v: 12,   size: 1, cat: 'mat' },
    screws:   { name: '螺丝罐',     q: 0, v: 10,   size: 1, cat: 'mat' },
    can:      { name: '军用罐头',   q: 0, v: 18,   size: 1, cat: 'med' },
    oldcell:  { name: '旧电池',     q: 0, v: 15,   size: 1, cat: 'elec' },
    plastic:  { name: '塑料件',     q: 0, v: 8,    size: 1, cat: 'mat' },
    board:    { name: '电路板',     q: 1, v: 38,   size: 1, cat: 'elec' },
    bandage:  { name: '绷带卷',     q: 1, v: 30,   size: 1, cat: 'med' },
    motor:    { name: '小型电机',   q: 1, v: 45,   size: 1, cat: 'part' },
    copper:   { name: '铜锭',       q: 1, v: 42,   size: 1, cat: 'metal' },
    oil:      { name: '机油桶',     q: 1, v: 34,   size: 2, cat: 'mat' },
    radio:    { name: '老式收音机', q: 1, v: 55,   size: 2, cat: 'elec' },
    sensor:   { name: '传感器',     q: 2, v: 95,   size: 1, cat: 'part' },
    bearing:  { name: '精密轴承',   q: 2, v: 110,  size: 1, cat: 'part' },
    silver:   { name: '银条',       q: 2, v: 150,  size: 1, cat: 'metal' },
    ssd:      { name: '固态硬盘',   q: 2, v: 170,  size: 1, cat: 'elec' },
    medpack:  { name: '人用药箱',   q: 2, v: 90,   size: 1, cat: 'med' }, // 只能卖，不能给工壳用（以前叫急救包，和维修包分不清）
    hydro:    { name: '液压缸',     q: 2, v: 125,  size: 2, cat: 'part' },
    servo:    { name: '伺服电机',   q: 3, v: 280,  size: 2, cat: 'part' },
    gpu:      { name: '显卡',       q: 3, v: 400,  size: 2, cat: 'elec' },
    watch:    { name: '金表',       q: 3, v: 450,  size: 1, cat: 'val' },
    reactor:  { name: '微型反应堆电池', q: 3, v: 360, size: 2, cat: 'part' },
    scope:    { name: '光学瞄准镜', q: 3, v: 320,  size: 1, cat: 'part' },
    goldbar:  { name: '金条',       q: 4, v: 950,  size: 1, cat: 'metal' },
    qchip:    { name: '量子芯片',   q: 4, v: 1250, size: 1, cat: 'elec' },
    laptop:   { name: '军用笔记本', q: 4, v: 1100, size: 2, cat: 'elec' },
    pocketw:  { name: '古董怀表',   q: 4, v: 880,  size: 1, cat: 'val' },
    core:     { name: '能量核心',   q: 5, v: 2800, size: 2, cat: 'part' },
    blackbox: { name: '调度黑匣子', q: 5, v: 3600, size: 2, cat: 'intel' },
    necklace: { name: '钻石项链',   q: 5, v: 3200, size: 1, cat: 'val' },
    // 高价值区域（金库、机房、珠宝店、藏品室）里才常见的东西
    keycard:  { name: '旧门禁卡',   q: 1, v: 70,   size: 1, cat: 'intel', noLoot: true }, // 老存档里的，当绿卡用
    // 门禁卡（试玩反馈二）：很难捡到、很值钱，交易行也能买；放进门禁卡包死了也不丢
    key1:     { name: '绿色门禁卡', q: 1, v: 300,  size: 1, cat: 'intel', noLoot: true },
    key2:     { name: '蓝色门禁卡', q: 2, v: 850,  size: 1, cat: 'intel', noLoot: true },
    key3:     { name: '红色门禁卡', q: 3, v: 2200, size: 1, cat: 'intel', noLoot: true },
    cigar:    { name: '雪茄盒',     q: 2, v: 190,  size: 1, cat: 'val' },
    perfume:  { name: '香水',       q: 2, v: 170,  size: 1, cat: 'val' },
    camera:   { name: '单反相机',   q: 3, v: 420,  size: 2, cat: 'elec' },
    server:   { name: '服务器刀片', q: 3, v: 520,  size: 2, cat: 'elec' },
    coins:    { name: '金币袋',     q: 3, v: 600,  size: 1, cat: 'metal' },
    ruby:     { name: '红宝石',     q: 4, v: 1500, size: 1, cat: 'val' },
    platinum: { name: '铂金锭',     q: 4, v: 1350, size: 2, cat: 'metal' },
    vase:     { name: '古董瓷瓶',   q: 4, v: 1700, size: 2, cat: 'val' },
    crypto:   { name: '加密硬盘',   q: 4, v: 1600, size: 1, cat: 'intel' },
    diamond:  { name: '裸钻',       q: 5, v: 4400, size: 1, cat: 'val' },
    aicore:   { name: 'AI 核心',    q: 5, v: 4900, size: 2, cat: 'intel' },
    painting: { name: '名画',       q: 5, v: 5600, size: 2, cat: 'val' },
  };
  for (const k in D.ITEMS) D.ITEMS[k].art = k;
  D.MEDKIT = { name: '维修包', heal: 25, price: 40 };

  // ── 装备卡：武器、近战、模块（Q/E）、被动。q 是品质，决定价格
  D.CARD_VALUE = [0, 180, 320, 520, 900, 1500];
  D.CARDS = {
    nailgun: { slot: 'gun', name: '钉枪',     q: 0, art: 'gun_nail',   free: true, desc: '6 伤害，弹匣 12，射速快', gun: { cal: 'nail', dmg: 6, mag: 12, rate: 0.17, reload: 1.1, speed: 340, spread: 0.04, n: 1, noise: 1 } },
    smg:     { slot: 'gun', name: '冲锋枪',   q: 1, art: 'gun_smg',    desc: '4 伤害，弹匣 30，射速极快，散布大', gun: { cal: 'light', dmg: 4, mag: 30, rate: 0.07, reload: 1.5, speed: 400, spread: 0.12, n: 1, noise: 1.2 } },
    shotgun: { slot: 'gun', name: '霰弹铳',   q: 2, art: 'gun_shot',   desc: '一发 6 枚弹片各 4 伤害，弹匣 4，贴脸极强', gun: { cal: 'shell', dmg: 4, mag: 4, rate: 0.55, reload: 1.5, speed: 300, spread: 0.55, n: 6, life: 0.32, noise: 2 } },
    pulse:   { slot: 'gun', name: '脉冲步枪', q: 3, art: 'gun_pulse',  desc: '6 伤害，弹匣 30，连射稳定', gun: { cal: 'cell', dmg: 6, mag: 30, rate: 0.09, reload: 1.8, speed: 420, spread: 0.05, n: 1, noise: 1.5 } },
    railgun: { slot: 'gun', name: '轨道炮',   q: 4, art: 'gun_rail',   desc: '34 伤害并贯穿，弹匣 3，换弹慢。按住右键开镜', gun: { cal: 'slug', dmg: 34, mag: 3, rate: 0.8, reload: 2.1, speed: 700, spread: 0.03, n: 1, pierce: true, noise: 3, scope: true } },
    sniper:  { slot: 'gun', name: '狙击步枪', q: 3, art: 'gun_sniper', desc: '26 伤害，弹匣 5。按住右键开镜：准星收紧、看得更远，满镜第一枪伤害 ×1.5（右键点按仍是近战）', gun: { cal: 'rifle', dmg: 26, mag: 5, rate: 0.9, reload: 2.0, speed: 900, spread: 0.09, n: 1, noise: 2.5, scope: true, life: 0.8 } },
    plasma:  { slot: 'gun', name: '等离子炮', q: 5, art: 'gun_plasma', desc: '16 伤害并爆炸，弹匣 8', gun: { cal: 'cell', dmg: 16, mag: 8, rate: 0.35, reload: 1.8, speed: 260, spread: 0.03, n: 1, boom: 18, noise: 2.5 } },
    chainsaw:{ slot: 'melee', name: '链锯',   q: 3, art: 'm_chain',   desc: '12 伤害，几乎没有冷却，按住一直锯；锯同一个敌人越锯越痛（最多 ×2.5）', melee: { dmg: 12, cd: 0.12, range: 19, arc: 0.9, rev: true, kb: 15, col: '#ffd84a' } }, // 其余近战在 content.js、melee.js
    barrier: { slot: 'mod', name: '护盾',   q: 1, icon: 'barrier', desc: '获得 18 护盾', cd: 9 },
    lunge:   { slot: 'mod', name: '突进斩', q: 1, icon: 'lunge',   desc: '冲向准星，沿途 14 伤害，冲刺中无敌', cd: 4.5 },
    mine:    { slot: 'mod', name: '磁雷',   q: 2, icon: 'mine',    desc: '丢到准星处，敌人靠近即爆，范围 26 伤害', cd: 6 },
    decoy:   { slot: 'mod', name: '诱饵',   q: 2, icon: 'decoy',   desc: '留下全息诱饵，吸引火力 4 秒', cd: 12 },
    arc:     { slot: 'mod', name: '电弧',   q: 3, icon: 'arc',     desc: '电击最近的敌人并跳 2 次，各 16 伤害', cd: 6 },
    coolant: { slot: 'mod', name: '冷却液', q: 4, icon: 'cool',    desc: '所有敌人减速一半，4 秒', cd: 14 },
    recycler:{ slot: 'pas', name: '回收臂',   q: 1, icon: 'recycler',  desc: '每击毁一台机器，回复 3 耐久' },
    quick:   { slot: 'pas', name: '快速供弹', q: 1, icon: 'it_mag',    desc: '换弹时间 -35%' },
    edge:    { slot: 'pas', name: '锋刃改装', q: 2, icon: 'edge',      desc: '近战伤害 +30%' },
    spring:  { slot: 'pas', name: '弹簧腿',   q: 2, icon: 'spring',    desc: '闪避冷却 -40%' },
    rack:    { slot: 'pas', name: '大背包架', q: 2, icon: 'it_rack',   desc: '背包 +4 格' },
    capx:    { slot: 'pas', name: '电容扩充', q: 3, icon: 'capacitor', desc: '电容充能快 50%' },
    armor:   { slot: 'pas', name: '复合装甲', q: 3, icon: 'plating',   desc: '耐久上限 +20' },
    muffler: { slot: 'pas', name: '消音器',   q: 4, icon: 'it_muffler', desc: '开枪增加的警戒减半' },
  };
  for (const k in D.CARDS) D.CARDS[k].price = D.CARD_VALUE[D.CARDS[k].q];
  D.SLOT_NAME = { gun: '主武器', melee: '近战', mod: '模块', pas: '被动' };

  // ── 背包系统（参照三角洲行动）：每件东西有形状 w×h，常见材料一组 10 个，弹药一组 100 发，贵重物品不叠
  const SHAPE = {
    scrap: [1, 1, 10], screws: [1, 1, 10], can: [1, 1, 5], oldcell: [1, 1, 10], plastic: [1, 1, 10],
    board: [1, 1, 5], bandage: [1, 1, 5], motor: [2, 1, 1], copper: [1, 1, 5], oil: [1, 2, 1], radio: [2, 2, 1],
    sensor: [1, 1, 3], bearing: [1, 1, 5], silver: [2, 1, 1], ssd: [1, 1, 1], medpack: [1, 1, 3], hydro: [1, 2, 1],
    servo: [2, 2, 1], gpu: [2, 1, 1], watch: [1, 1, 1], reactor: [1, 2, 1], scope: [2, 1, 1],
    goldbar: [2, 1, 1], qchip: [1, 1, 1], laptop: [2, 2, 1], pocketw: [1, 1, 1], core: [2, 2, 1], blackbox: [2, 2, 1], necklace: [1, 1, 1],
    keycard: [1, 1, 3], cigar: [1, 1, 1], perfume: [1, 1, 1], camera: [2, 1, 1], server: [1, 2, 1], coins: [1, 1, 3], ruby: [1, 1, 1], platinum: [2, 1, 1],
    vase: [2, 2, 1], crypto: [1, 1, 1], diamond: [1, 1, 1], aicore: [2, 2, 1], painting: [3, 2, 1],
  };
  for (const k in D.ITEMS) { const s = SHAPE[k] || [1, 1, 1]; Object.assign(D.ITEMS[k], { w: s[0], h: s[1], stack: s[2] }); delete D.ITEMS[k].size; }
  // 装备卡放进格子时的形状（模块、被动都是 1×1 的芯片）
  D.CARD_SHAPE = { nailgun: [2, 1], smg: [3, 1], shotgun: [4, 1], pulse: [4, 2], railgun: [5, 2], sniper: [5, 1], plasma: [3, 2], chainsaw: [3, 2] };
  // 消耗品：在背包里就能用（C 回血 / V 护盾 / Z 手雷）。X 是释放电容（ammo.js），2026-11-15 起没有兴奋剂了
  D.USE = {
    medkit: { name: '维修包',   q: 1, v: 40,  w: 1, h: 2, stack: 2, art: 'medpack', heal: 30, time: 1.5, cd: 4, key: 'C', desc: '读条 1.5 秒，回复 30 耐久。挨打会打断（药不消耗）；用完 4 秒内不能再用药' },
    patch:  { name: '快速贴片', q: 0, v: 14,  w: 1, h: 1, stack: 4, art: 'bandage', heal: 10, time: 0.4, cd: 1.5, key: 'C', desc: '读条 0.4 秒，回复 10 耐久（没有维修包时按 C 用它）。用完 1.5 秒内不能再用药' },
    cell:   { name: '护盾电池', q: 2, v: 60,  w: 1, h: 1, stack: 5, art: 'cellpack', shield: 20, time: 0.4, key: 'V', desc: '获得 20 护盾' },
    frag:   { name: '高爆手雷', q: 1, v: 45,  w: 1, h: 1, stack: 3, art: 'nade_frag', throw: 'frag', key: 'Z', desc: 'Z 扔向准星，0.6 秒后爆炸：范围 30 伤害。按住 Z 滚滚轮换手雷种类' },
    freeze: { name: '冰冻手雷', q: 2, v: 60,  w: 1, h: 1, stack: 3, art: 'nade_freeze', throw: 'freeze', key: 'Z', desc: 'Z 扔向准星：范围内的敌人冻住，4 秒内慢 70%' },
    emp:    { name: '电磁手雷', q: 2, v: 70,  w: 1, h: 1, stack: 3, art: 'nade_emp', throw: 'emp', key: 'Z', desc: 'Z 扔向准星：范围内的机器瘫痪 2.5 秒、护盾清零（对人类无效）' },
  };
  // 弹药：五种口径 × 四个等级。等级越高伤害越高，四级弹只能在城里捡
  D.CALIBER = {
    nail:  { name: '钉子',     unit: 0.3, pack: 40, art: 'screws' },
    light: { name: '轻型弹',   unit: 0.7, pack: 30, art: 'oldcell' },
    shell: { name: '霰弹',     unit: 1.6, pack: 12, art: 'oil' },
    cell:  { name: '能量弹',   unit: 1.2, pack: 30, art: 'reactor' },
    slug:  { name: '轨道弹芯', unit: 6,   pack: 6,  art: 'bearing' },
    rifle: { name: '狙击弹',   unit: 3.2, pack: 10, art: 'bearing' },
  };
  D.AMMO_TIER = [null, { name: '一级', mul: 1, q: 0, price: 1 }, { name: '二级', mul: 1.15, q: 1, price: 1.8 }, { name: '三级', mul: 1.3, q: 2, price: 3.2 }, { name: '四级', mul: 1.5, q: 3, price: 5.5 }];
  // 背包：格子大小。破帆布包是租的，不会丢
  D.BAGS = {
    canvas: { name: '破帆布包',   q: 0, gw: 6, gh: 4, w: 2, h: 2, v: 0, free: true },
    sling:  { name: '战术挎包',   q: 1, gw: 6, gh: 5, w: 2, h: 2, v: 160 },
    tact:   { name: '战术背包',   q: 2, gw: 7, gh: 5, w: 3, h: 3, v: 320 },
    hike:   { name: '登山包',     q: 3, gw: 8, gh: 6, w: 3, h: 3, v: 560 },
    mil:    { name: '军用重载包', q: 4, gw: 9, gh: 7, w: 3, h: 4, v: 980 },
  };
  D.SAFE_SIZE = [2, 2]; D.STASH_SIZE = [12, 16];

  D.SHELL = { hp: 60, bag: 8, safe: 2, speed: 92, dashSpeed: 320, dashTime: 0.16, dashCd: 0.8, capPerHit: 0.125, capPerDmg: 0.002, capPerKill: 0.03 }; // 电容：近战每下 12.5%；子弹按伤害（超级弹不算，500 伤害充满）；击毁一台 3%
  // ── 工壳型号：每种一个主动技能（G）和一条特性。工壳是租的，其余要买；带进城的型号死了就没了
  D.SHELLS = {
    worker: { name: '工壳', code: 'WK-01', role: '通用', q: 0, price: 0, free: true, hp: 60, speed: 92, tint: null, scale: 1, visor: null,
      tag: '南栈租给每个人的通用作业机。什么都会一点，坏了也不心疼。', trait: { k: 'search', name: '熟手', desc: '搜容器快 25%' },
      skill: { k: 'scan', name: '扫描', cd: 14, desc: '8 秒内显示本层每个容器里最好东西的品质，小地图标出所有敌人' } },
    scout: { name: '灵猫', code: 'SC-3', role: '侦察', q: 2, price: 900, hp: 45, speed: 114, dashCd: 0.55, tint: '#3fc89a', scale: 0.92, visor: '#3ee8ff',
      tag: '轻量侦察机。跑得快、藏得住，挨不了几下。', trait: { k: 'quiet', name: '脚步轻', desc: '敌人发现你慢一倍，闪避冷却更短' },
      skill: { k: 'cloak', name: '光学迷彩', cd: 16, desc: '隐身 4 秒，所有敌人丢失目标；开火或近战会现形' } },
    heavy: { name: '犀甲', code: 'HV-7', role: '重装', q: 3, price: 1600, hp: 100, speed: 78, tint: '#d07a2e', scale: 1.12, visor: '#ffd95c',
      tag: '拆楼用的重装机。慢，但扛得住一整轮弹幕。', trait: { k: 'armor', name: '装甲', desc: '受到的伤害 -15%' },
      skill: { k: 'slam', name: '震地', cd: 10, desc: '砸地震开周围敌人：20 伤害、晕 1 秒，自己获得 20 护盾' } },
    hauler: { name: '驮兽', code: 'HL-2', role: '搬运', q: 2, price: 1100, hp: 70, speed: 84, bagW: 2, bagH: 1, tint: '#c8a850', scale: 1.05, visor: '#ffb057',
      tag: '物流搬运机。背得多，捡得快。', trait: { k: 'bag', name: '货架', desc: '背包多 2 列 1 行' },
      skill: { k: 'magnet', name: '磁吸', cd: 8, desc: '把 140 像素内地上的东西全吸进背包' } },
    medic: { name: '白鹭', code: 'MD-5', role: '维修', q: 3, price: 1400, hp: 65, speed: 92, tint: '#dfe8f5', scale: 1, visor: '#8dff6a',
      tag: '维修支援机，自带焊枪和纳米修补液。', trait: { k: 'regen', name: '自修复', desc: '3 秒没挨打后每秒回 1.5 耐久' },
      skill: { k: 'repair', name: '修复场', cd: 18, desc: '4 秒内回复 32 耐久，期间不减速' } },
    hacker: { name: '蛛网', code: 'EW-9', role: '电子战', q: 4, price: 2400, hp: 50, speed: 96, tint: '#a35bff', scale: 0.96, visor: '#ff3d8b',
      tag: '电子战机。能让城里的机器原地停摆。', trait: { k: 'hack', name: '解码器', desc: '搜容器快 40%，机器被击毁时多掉一件东西' },
      skill: { k: 'hack', name: '骇入', cd: 15, desc: '130 像素内的机器停摆 3.5 秒（炮台 6 秒），人类不受影响' } },
  };

  // ── 敌人：每种都有自己的招式（图鉴里写给玩家看）
  D.ENEMIES = {
    // 杂兵（试玩反馈：要有送分的小怪）：血少、打得轻、外环最多。base = 借用哪种敌人的动作
    mite:     { name: '锈螨', hp: 7, r: 4, speed: 58, loot: 0, trash: true, base: 'crawler', dmgMul: 0.45, tag: '指甲盖大的锈蚀小机，杂兵', moves: ['扑咬：蹲一下再扑过来，咬得很轻', '一碰就碎：近战一下就散架'] },
    scav:     { name: '推车机', hp: 13, r: 5, speed: 30, loot: 0, trash: true, base: 'drone', dmgMul: 0.5, spreadMul: 2, sight: 110, tag: '捡破烂的旧清洁车，装了把破枪，杂兵', moves: ['乱射：两发很散的子弹，离远一点基本打不中', '慢：走得很慢，绕过去就行'] },
    crawler:  { name: '拾荒蛛', hp: 18,  r: 6, speed: 62, loot: 0, tag: '成群出没的锈蚀蜘蛛机', moves: ['包抄：几只会分开从不同方向围过来', '扑咬：短暂蹲伏后扑向你脚下（会预判你的走位）', '咬完就跑：得手后立刻退开，再找机会'] },
    drone:    { name: '哨兵',   hp: 22,  r: 6, speed: 40, loot: 1, tag: '城市安保系统的巡逻球', moves: ['三连点射：瞬时命中，看不到弹道，只看得到枪口闪光', '换位：每打完一轮就横移到新位置', '保持距离：你靠近它就往后飘'] },
    sniper:   { name: '长眼',   hp: 20,  r: 6, speed: 34, loot: 2, tag: '高架上的狙击单元', moves: ['蓄力狙击：独眼越来越亮，亮到最满时开一枪，16 伤害。开枪前一瞬间锁定方向，看到闪光就横移', '远离：总想站在 150 像素以外', '近身很脆：被贴脸时只会慌张后退'] },
    turret:   { name: '迫击炮台', hp: 40, r: 8, speed: 0, loot: 1, tag: '固定在站台上的抛射炮', moves: ['三连炮击：把炮弹抛到你脚下和你要去的地方，落点有圈', '震荡波：贴近它会被震开'] },
    bomber:   { name: '自爆蜂', hp: 8,   r: 5, speed: 95, loot: 0, tag: '贴地飞行的自杀式无人机', moves: ['冲刺：直直冲向你', '引爆：靠近后滴滴几声就炸，14 伤害', '殉爆：被你提前打爆，会把旁边的机器一起炸了'] },
    medic:    { name: '维修蜂', hp: 16,  r: 6, speed: 52, loot: 2, tag: '给机器修修补补的小飞机', moves: ['修复光束：给受伤最重的同伴回血', '护盾：给同伴套一层护盾', '逃跑：看到你就躲到同伴身后，优先打它'] },
    raider:   { name: '回收者', hp: 34,  r: 5, speed: 72, loot: 2, human: true, tag: '和你抢货的人类同行', moves: ['找掩体：躲到柱子、箱子后面', '探身两连射：瞬时命中', '手雷：扔到你脚下，1.5 秒后爆', '嗑药：残血时退开回血一次'] },
    engineer: { name: '工程机', hp: 130, r: 9, speed: 28, loot: 3, elite: true, tag: '重型拆除机，精英', moves: ['正面护盾：从正面打它会被弹开，绕后或用近战', '磁钩：射出钩爪，命中会把你拖过去', '圆锯冲撞：蓄力后直线冲过来，撞墙会晕'] },
    boss:     { name: '钳工-9', hp: 420, r: 15, speed: 30, loot: 4, boss: true, tag: '轨道维修机，撤离战的追兵', moves: ['砸地：跳到你的预判位置砸下来', '环形弹幕：一圈圈往外打', '扫射激光：转着扫一大片', '过热：半血后更快更狠'] },
  };

  // ── 站点类型：按危险等级（0 安全 … 3 沦陷）挑
  // 站点类型和所在区域无关，全城打散分布（像杀戮尖塔的地图节点）。危险等级只决定敌人多强、东西多好。
  // w：出现的多少；cat：特殊站的类别（同类之间要隔开）；minTier：最低危险等级；minDist：离据点至少几站
  D.STATION_TYPES = {
    outpost:  { name: '人类据点', w: 1,   safe: true, cat: 'safe', theme: 'mall', desc: '候车厅：住着等过末班车的人。有阿贵的收货摊、方姨的换物摊、老铁的修械铺、苏医生的诊所，没有敌人' },
    ruin:     { name: '废弃站',   w: 3,   theme: 'platform', desc: '拾荒蛛和自爆蜂，东西不多' },
    market:   { name: '商圈',     w: 3,   theme: 'mall',     desc: '柜台和收银台多，常有回收者' },
    hangar:   { name: '机库',     w: 3,   theme: 'depot',    desc: '哨兵和维修蜂，残骸里有零件' },
    factory:  { name: '自动工厂', w: 2.5, minDist: 2, theme: 'depot', desc: '炮台、长眼和工程机，高价部件' },
    depot:    { name: '维修库',   w: 1.5, minDist: 3, cat: 'elite', theme: 'depot', desc: '工程机常驻，零件和高级部件最多' },
    cache:    { name: '隐藏仓库', w: 0,   theme: 'depot',    desc: '线路图上没有的废弃支线尽头。东西多、品质高，守卫也多', hidden: true },
    refuge:   { name: '流民营',   w: 1.2, safe: true, cat: 'safe', theme: 'mall', desc: '流民搭的营地：卖弹药和药，能接电回满耐久，没有敌人' },
    blackmarket: { name: '黑市',  w: 0,   /* 用户 2026-11-17：删除商人点，不再生成；类型留着给旧存档 */ safe: true, cat: 'safe', minDist: 3, theme: 'mall', desc: '黑市商人收货给得多（原价六成），卖稀有装备和高级弹药，要价也高' },
    hospital: { name: '医院站',   w: 1.5, theme: 'platform', desc: '药品和医疗设备多，维修蜂成群' },
    nest:     { name: '虫巢',     w: 1.3, theme: 'platform', desc: '拾荒蛛的窝，一大群。它们把零件攒在窝里' },
    relay:    { name: '信号中继站', w: 1, cat: 'relay', minDist: 2, theme: 'depot', desc: '修好中继台，能看清周围一大片站点（包括隐藏站）' },
    armory:   { name: '军械库',   w: 1.2, minDist: 2, theme: 'depot', desc: '弹药柜和枪械箱，回收者在这里扎营' },
    museum:   { name: '博物馆站', w: 1,   cat: 'hv', minTier: 1, minDist: 3, theme: 'mall',  desc: '高价值区域：藏品室里有古董和名画，长眼守在高处' },
    checkpoint: { name: '机器检查站', w: 1.2, cat: 'elite', minDist: 3, theme: 'platform', desc: '必有精英守关，打赢了掉好东西' },
    datacenter: { name: '数据中心', w: 1.2, cat: 'hv', minTier: 1, minDist: 3, theme: 'depot', desc: '高价值区域：整站都是服务器。芯片、硬盘、AI 核心，哨兵和炮台成群' },
    event:    { name: '未知信号', w: 1.6, cat: 'event', noExit: true, minDist: 1, safe: true, theme: 'platform', desc: '一座地铁站，站台上有人在等你：和他们说话、做选择。有的信号是陷阱，有的藏着好东西' },
    bank:     { name: '银行金库', w: 1,   cat: 'hv', minTier: 1, minDist: 4, theme: 'mall',  desc: '高价值区域：地下金库还没被搬空。金条、珠宝、名画——守卫最多' },
  };
  D.GARRISON = {
    ruin: [['crawler', 4], ['bomber', 2], ['drone', 1]],
    market: [['raider', 3], ['crawler', 2], ['bomber', 1], ['drone', 1]],
    hangar: [['drone', 3], ['medic', 1], ['crawler', 2], ['sniper', 1]],
    factory: [['turret', 2], ['sniper', 2], ['drone', 2], ['bomber', 1], ['medic', 1]],
    depot: [['drone', 2], ['turret', 2], ['sniper', 2], ['raider', 1], ['bomber', 2], ['medic', 1]],
    cache: [['raider', 3], ['drone', 2], ['turret', 1], ['sniper', 1], ['medic', 1]],
    hospital: [['medic', 3], ['crawler', 3], ['drone', 1], ['bomber', 1]],
    nest: [['crawler', 7], ['bomber', 3]],
    relay: [['drone', 3], ['crawler', 2], ['turret', 1]],
    armory: [['raider', 4], ['drone', 1], ['bomber', 1]],
    museum: [['sniper', 3], ['drone', 2], ['crawler', 1]],
    checkpoint: [['drone', 3], ['turret', 2], ['raider', 1], ['sniper', 1]],
    datacenter: [['drone', 4], ['turret', 2], ['medic', 1], ['bomber', 1]],
    bank: [['raider', 2], ['drone', 2], ['turret', 2], ['sniper', 1], ['medic', 1]],
  };
  // 站里额外多几只（虫巢）/ 必有精英（检查站、银行）
  D.GARRISON_EXTRA = { nest: 4, bank: 1, datacenter: 1 };
  D.ELITE_GUARD = { checkpoint: true, bank: true };
  // 各危险等级下，搜到每档品质的权重（白 绿 蓝 紫 金 红）
  D.QUALITY_ODDS = [[70, 24, 5, 1, 0, 0], [56, 30, 10.5, 3, 0.4, 0.1], [32, 33, 23, 8.5, 2.7, 0.8], [12, 24, 31, 20, 9, 4]]; // M2 经济模拟后下调过一次；2026-11-15 试玩：爆率太高，每档再往下调

  D.LINE_NAMES = ['一号线', '二号线', '三号线', '四号线', '五号线', '六号线', '七号线', '八号线', '环线', '内环线'];
  D.LINE_COLORS = ['#ff3047', '#3ee8ff', '#ffb057', '#8dff6a', '#9b6bff', '#ff3d8b', '#e3c14a', '#5fa8ff', '#c8cbe0', '#ff8a5c'];
  D.NAME_A = ['金', '南', '旧', '岚', '水', '机', '东', '纺', '电', '青', '北', '环', '冷', '七', '柳', '铸', '中', '星', '调', '白', '石', '铁', '新', '西', '云', '港', '江', '花', '工', '望', '长', '春', '霞', '松', '桥'];
  D.NAME_B = ['庭', '栈', '街', '川', '门', '库', '堤', '台', '桥', '仓', '城', '闸', '岸', '坊', '塔', '路', '场', '口', '湾', '园', '村', '坪', '坡', '湖', '巷', '厂', '河', '山'];
  D.NAME_C = ['', '', '', '站', '东', '西', '南', '北', '广场', '大道', '公园'];

  D.TUNE = {
    chargeT: 0.6, lingerT: 150, lingerEvery: 30, lingerCap: 6, // 近战蓄力满需要按住多久（秒）；lingerT 秒后巡逻队进站，站台上的敌人补到 lingerCap 台为止（危险等级 2 起多 1 台），每 lingerEvery 秒补一次
    alertPerStation: 1, alertPerShots: 0.25,
    alertStartCentral: 1.5, // 出发站所在线路穿过市中心：开场警戒（外环线上开场是 0；1.5 正好到 2 级）
    alertShotCap: 0.5, // 开枪带来的警戒，每过一站最多 +0.5（市中心枪战多，不许比外围涨得快）
    timedWindow: 3,
    extractBase: 12, extractPerValue: 0.004, extractPerAlert: 1.2, // 试玩反馈第三轮：撤离战短一些（最长 45 秒）
    revealBase: 0.35, revealPerQ: 0.3,
    pickupR: 14, // 弹药堆靠近多少自动捡 // 搜索时每件东西揭开要多久：基础 + 品质×系数
    groundR: 26, // 地上的东西：走到多近弹出拾取框
    repairPerHp: 4, // 修工壳：每点耐久多少钱
    // 2026-11-15 试玩：搜刮爆率太高、打怪没必要。empty：普通容器是空的几率；fewer：少一件的几率；contFewer：房间里少放一个容器的几率；loose：地上散落东西的几率倍数；cards：装备卡掉率
    loot: { empty: 0.25, fewer: 0.3, contFewer: 0.4, loose: 0.5, cards: 0.07 },
    // 杂兵群：原来的守卫之外，每座站按危险等级（0–3）再加几只锈螨 / 推车机，两三只一群；drop：杂兵死了掉一件低级材料的几率
    trash: { perTier: [[8, 11], [7, 10], [5, 7], [3, 5]], pack: [2, 3], drop: 0.55 }, // 2026-11-17：杂兵再多一些（原 [6,8] [5,7] [3,5] [2,3]）
    // 2026-11-17 用户：刷怪多一些、怪别那么敏感。garrison：普通守卫数量倍数和上限（原来 ×1、最多 20）
    garrison: { mul: 1.35, cap: 26 },
    // sense：没发现你时的察觉。sight 视野倍数；rate 盯着你时警觉涨多快；near 贴近时（视野四成以内）再快几倍（原 2.2）；wake 发现你后叫醒多远的同伴（原 90）；shot 开枪惊动多远（原 180）
    sense: { sight: 0.75, rate: 0.6, near: 1.6, wake: 60, shot: 130 },
    // 站内地图第二代（design/features/station-gen）：P7 任务 3 起站厅层、站台层、换乘层、设备层都由 src/gen2 出图，旧生成器和骨架开关（concourse、floors）删了；下面是后几道工序的开关（测试靠它们比开关前后的数量）
    // P3：hist = 站的历史、vig = 小场景（关掉时照样从父流取那个数，其余的生成结果逐格不变）；histForce = [...] 开发 / 截图时指定历史
    // P4：wear = 表面痕迹（磨损路线、积灰积水、历史痕迹、线缆管道；只改画面，关掉时照样从父流取那个数）
    // P6 任务 2 / 3：dress = 场景、环境骨架和附加楼层接上后几道工序的（src/gen2/dress.js；键：hub、yard、elevated、12 种环境、crater、pipes 检修管道、tower 楼上大厦）；这些骨架的站台层 / 换乘层也跟着 floors 走新骨架
    gen2: { hist: true, vig: true, wear: true, art: true, dress: ['hub', 'yard', 'elevated', 'pipes', 'tower', 'street', 'park', 'rooftop', 'harbor', 'site', 'nightmkt', 'sewer', 'garage', 'aquarium', 'greenhouse', 'coldstore', 'cave', 'crater'] }, // art：P5 美术重画（地面材质、墙面分层、前景、灯按柱网）
  };
})(D);
