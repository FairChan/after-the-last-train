/* 末班之后 · 小样二：成长与经济（M3）
   - 武器配件：枪口 / 弹匣 / 瞄具 / 枪托四类各 6 种。装在"这一型枪"上（pf.att[枪]），带进城损毁了跟着枪一起丢。
   - 机器人改装：装甲 / 动力 / 传感器三类各 6 种，每台型号三个槽（pf.shells[型号].mods），损毁就丢。
   - 型号熟练度：用得越多越熟（pf.mast[型号]），2 级技能冷却 -15%，3 级技能变成第二形态。
   - 据点设施：工作台、医疗室、情报站、仓库，各 4 级，要零件和材料。
   - 工作台制造：配件和改装件按设施等级解锁，传说级要先学蓝图（城里捡）。
   - 委托板：30 个模板，每天刷新；撤出来才算数。
   规则和数据都在这里，其余文件只加挂钩。调数值看 TUNE。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const Gr = () => D.Grid;
  const TUNE = {
    gearV: [0, 110, 230, 420, 820],          // 配件 / 改装件按品质的价值
    craftMoney: [0, 90, 220, 480, 1100],     // 制造要的零件
    shopMul: 1.35,                           // 商店卖配件 / 改装件的加价（只卖优良、精良）
    dropP: 0.05, dropPCards: 0.22,           // 容器里掉配件 / 改装件的概率（军械类容器高）
    bpP: 0.035,                              // 史诗以上的东西里换成一张蓝图的概率
    mastXP: [0, 5, 14],                      // 熟练度 2 级、3 级要的经验
    mastSkillCd: 0.85,                       // 熟练度 2 级起技能冷却
    jobOffers: 3, jobActive: 3,              // 委托板：每天几条、最多同时接几条
  };
  D.GROW_TUNE = TUNE;
  const pct = v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';

  // ───────────────────────── 武器配件
  D.ATT_SLOTS = { muzzle: '枪口', mag: '弹匣', sight: '瞄具', stock: '枪托' };
  // fx：dmg 伤害、spread 散布、bloom 连射变散、mag 弹匣、reload 换弹时间、rate 射击间隔（负数 = 射得更快）、speed 弹速、life 射程、noise 枪声
  D.ATT = {
    comp:     { slot: 'muzzle', name: '枪口制退器', q: 1, fx: { bloom: -0.3, noise: 0.1 } },
    hider:    { slot: 'muzzle', name: '消焰器',     q: 1, fx: { spread: -0.1, noise: -0.1 } },
    supp:     { slot: 'muzzle', name: '枪口消音器', q: 2, fx: { noise: -0.45, dmg: -0.05 } },
    barrel:   { slot: 'muzzle', name: '加长枪管',   q: 2, fx: { speed: 0.2, life: 0.25, dmg: 0.06 } },
    brake:    { slot: 'muzzle', name: '重型制退器', q: 3, fx: { bloom: -0.45, spread: -0.1, reload: 0.05 } },
    coil:     { slot: 'muzzle', name: '电磁加速环', q: 4, fx: { dmg: 0.14, speed: 0.3, noise: 0.2 } },
    extmag:   { slot: 'mag', name: '扩容弹匣', q: 1, fx: { mag: 0.25 } },
    quickmag: { slot: 'mag', name: '快拔弹匣', q: 1, fx: { reload: -0.15 } },
    drum:     { slot: 'mag', name: '弹鼓',     q: 2, fx: { mag: 0.6, reload: 0.2 } },
    twinmag:  { slot: 'mag', name: '双联弹匣', q: 2, fx: { reload: -0.3, mag: 0.1 } },
    hpmag:    { slot: 'mag', name: '高压供弹', q: 3, fx: { rate: -0.1, mag: 0.25 } },
    qmag:     { slot: 'mag', name: '量子弹仓', q: 4, fx: { mag: 0.5, reload: -0.25 } },
    reddot:   { slot: 'sight', name: '红点瞄具', q: 1, fx: { spread: -0.12 } },
    holo:     { slot: 'sight', name: '全息瞄具', q: 1, fx: { spread: -0.08, bloom: -0.1 } },
    x4:       { slot: 'sight', name: '四倍镜',   q: 2, fx: { spread: -0.2, rate: 0.08 } },
    thermal:  { slot: 'sight', name: '热成像镜', q: 3, fx: { spread: -0.15, dmg: 0.05 } },
    ranger:   { slot: 'sight', name: '测距瞄具', q: 3, fx: { life: 0.3, spread: -0.1 } },
    smart:    { slot: 'sight', name: '智能瞄具', q: 4, fx: { spread: -0.3, bloom: -0.25 } },
    fold:     { slot: 'stock', name: '折叠托',   q: 1, fx: { bloom: -0.1, reload: -0.05 } },
    tstock:   { slot: 'stock', name: '战术托',   q: 1, fx: { bloom: -0.2 } },
    shock:    { slot: 'stock', name: '减震托',   q: 2, fx: { bloom: -0.3, spread: -0.05 } },
    hydstock: { slot: 'stock', name: '液压托',   q: 2, fx: { reload: -0.1, bloom: -0.15 } },
    carbon:   { slot: 'stock', name: '碳纤维托', q: 3, fx: { bloom: -0.25, rate: -0.05 } },
    gyro:     { slot: 'stock', name: '稳定陀螺', q: 4, fx: { bloom: -0.45, spread: -0.15 } },
  };
  const ATT_LABEL = { dmg: '伤害', spread: '散布', bloom: '连射变散', mag: '弹匣', reload: '换弹时间', rate: '射击间隔', speed: '弹速', life: '射程', noise: '枪声' };
  for (const k in D.ATT) { const A = D.ATT[k]; A.desc = Object.entries(A.fx).map(([f, v]) => ATT_LABEL[f] + ' ' + pct(v)).join('、'); }

  // ───────────────────────── 机器人改装
  D.RMOD_SLOTS = { armor: '装甲', power: '动力', sensor: '传感器' };
  // fx：hp 耐久上限（加多少点）、hurt 受到伤害、shield0 进站自带护盾（点）、speed 移速、dash 闪避冷却、cap 电容充能、skill 技能冷却、search 搜容器速度、notice 被发现的速度、spread 散布、noise 开枪的警戒
  D.RMOD = {
    plate:    { slot: 'armor', name: '轻质护板',     q: 1, fx: { hp: 8 } },
    reactive: { slot: 'armor', name: '反应装甲',     q: 1, fx: { hurt: -0.06 } },
    composite:{ slot: 'armor', name: '复合护板',     q: 2, fx: { hp: 15, speed: -0.03 } },
    emitter:  { slot: 'armor', name: '护盾发生器',   q: 2, fx: { shield0: 12 } },
    ceramic:  { slot: 'armor', name: '陶瓷装甲',     q: 3, fx: { hp: 20, hurt: -0.05 } },
    nano:     { slot: 'armor', name: '纳米装甲',     q: 4, fx: { hp: 25, hurt: -0.1 } },
    ocmotor:  { slot: 'power', name: '超频电机',     q: 1, fx: { speed: 0.06 } },
    joint:    { slot: 'power', name: '强化关节',     q: 1, fx: { dash: -0.15 } },
    hicap:    { slot: 'power', name: '高效电容',     q: 2, fx: { cap: 0.3 } },
    dualcore: { slot: 'power', name: '双核电源',     q: 2, fx: { skill: -0.2 } },
    turbo:    { slot: 'power', name: '涡轮驱动',     q: 3, fx: { speed: 0.1, dash: -0.15 } },
    fusion:   { slot: 'power', name: '聚变芯',       q: 4, fx: { skill: -0.3, cap: 0.3 } },
    sonar:    { slot: 'sensor', name: '声呐探头',    q: 1, fx: { search: 0.15 } },
    motion:   { slot: 'sensor', name: '运动探测器',  q: 1, fx: { notice: -0.15 } },
    goggles:  { slot: 'sensor', name: '战术目镜',    q: 2, fx: { spread: -0.1 } },
    damper:   { slot: 'sensor', name: '信号抑制器',  q: 2, fx: { noise: -0.25 } },
    radar:    { slot: 'sensor', name: '广域雷达',    q: 3, fx: { search: 0.25, notice: -0.1 } },
    quantum:  { slot: 'sensor', name: '量子传感阵列', q: 4, fx: { search: 0.35, notice: -0.25 } },
  };
  const RM_LABEL = { hp: '耐久上限', hurt: '受到伤害', shield0: '进站护盾', speed: '移速', dash: '闪避冷却', cap: '电容充能', skill: '技能冷却', search: '搜容器速度', notice: '被发现的速度', spread: '散布', noise: '开枪的警戒' };
  for (const k in D.RMOD) { const M = D.RMOD[k]; M.desc = Object.entries(M.fx).map(([f, v]) => RM_LABEL[f] + ' ' + (f === 'hp' || f === 'shield0' ? '+' + v : pct(v))).join('、'); }

  // ── 物品信息：att:配件、rmod:改装件、bp:蓝图、job:委托包裹
  const ATT_ART = { muzzle: 'g_muzzle', mag: 'g_mag', sight: 'g_sight', stock: 'g_stock' }, RM_ART = { armor: 'g_armor', power: 'g_power', sensor: 'g_sensor' };
  D.growthItemInfo = function (id) {
    const [pre, k] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
    if (pre === 'att') { const A = D.ATT[k]; return { name: A.name, v: TUNE.gearV[A.q], w: 1, h: 1, stack: 1, q: A.q, art: ATT_ART[A.slot], kind: 'att', att: k, slot: A.slot, desc: A.desc }; }
    if (pre === 'rmod') { const M = D.RMOD[k]; return { name: M.name, v: TUNE.gearV[M.q], w: 1, h: 1, stack: 1, q: M.q, art: RM_ART[M.slot], kind: 'rmod', rmod: k, slot: M.slot, desc: M.desc }; }
    if (pre === 'bp') { const G = gearDef(k); return { name: '蓝图 · ' + (G ? G.name : '？'), v: 300, w: 1, h: 1, stack: 1, q: 4, art: 'g_bp', kind: 'bp', bp: k, desc: '带回据点，在工作台学会后就能制造' + (G ? G.name : '') }; }
    if (pre === 'job') return { name: '委托包裹', v: 0, w: 1, h: 1, stack: 1, q: 1, art: 'g_pkg', kind: 'job', desc: '送到委托写的那类站，进站就算送到。丢了委托就失败' };
    throw new Error('未知物品 ' + id);
  };
  const gearDef = k => D.ATT[k] || D.RMOD[k];
  const gearId = k => (D.ATT[k] ? 'att:' : 'rmod:') + k;
  D.gearId = gearId;

  Object.assign(D.ITEM_ART, {
    g_muzzle: p => { p.rect(3, 11, 16, 6, '#2d3342'); p.rect(19, 10, 6, 8, '#646e86'); p.rect(20, 11, 1, 6, '#0b0a14'); p.rect(22, 11, 1, 6, '#0b0a14'); p.rect(5, 12, 12, 1, '#949fb6'); },
    g_mag:    p => { p.rect(9, 4, 10, 6, '#646e86'); p.rect(8, 10, 12, 14, '#2d3342'); p.rect(10, 12, 8, 2, '#e3c14a'); p.rect(10, 16, 8, 1, '#949fb6'); p.rect(10, 19, 8, 1, '#949fb6'); },
    g_sight:  p => { p.rect(4, 12, 20, 7, '#1d212c'); p.rect(4, 10, 5, 11, '#2d3342'); p.rect(19, 10, 5, 11, '#2d3342'); p.rect(5, 13, 3, 5, '#3ee8ff'); p.px(6, 14, '#ffffff'); p.rect(10, 19, 8, 3, '#646e86'); p.px(21, 13, '#ff3047'); },
    g_stock:  p => { p.rect(3, 9, 8, 5, '#646e86'); p.line(10, 11, 22, 17, '#2d3342'); p.line(10, 13, 22, 19, '#2d3342'); p.rect(20, 15, 5, 9, '#3a4152'); p.rect(21, 16, 3, 7, '#5e3d36'); },
    g_armor:  p => { p.rect(6, 5, 16, 18, '#646e86'); p.rect(8, 7, 12, 14, '#949fb6'); p.rect(13, 7, 2, 14, '#646e86'); p.rect(8, 13, 12, 2, '#646e86'); p.rect(9, 8, 3, 2, '#dde1ee'); },
    g_power:  p => { p.rect(6, 6, 16, 16, '#2d3342'); p.rect(9, 9, 10, 10, '#ffb057'); p.rect(12, 9, 4, 10, '#fff0c8'); for (let i = 0; i < 4; i++) { p.rect(3, 8 + i * 4, 3, 1, '#e3c14a'); p.rect(22, 8 + i * 4, 3, 1, '#e3c14a'); } },
    g_sensor: p => { p.rect(5, 8, 18, 12, '#2d3342'); p.disc(11, 14, 4, '#164a5a'); p.disc(11, 14, 2, '#3ee8ff'); p.rect(17, 11, 4, 2, '#8dff6a'); p.rect(17, 15, 4, 2, '#ff3047'); p.line(14, 8, 18, 3, '#949fb6'); },
    g_bp:     p => { p.rect(4, 5, 20, 18, '#1d4a8a'); p.rect(4, 5, 20, 2, '#5a92e8'); for (let x = 7; x < 23; x += 4) p.line(x, 8, x, 21, '#2f63b0'); p.rect(8, 11, 10, 6, '#cfe0ff'); p.rect(9, 12, 8, 4, '#1d4a8a'); p.line(10, 14, 16, 14, '#cfe0ff'); },
    g_pkg:    p => { p.rect(4, 8, 20, 15, '#8f5e33'); p.rect(4, 8, 20, 3, '#ad7a52'); p.rect(12, 8, 4, 15, '#e3c14a'); p.rect(7, 15, 4, 3, '#e8e0c8'); },
  });

  // ───────────────────────── 档案里的成长数据
  const fresh = () => ({ fac: { bench: 0, med: 0, intel: 0, store: 0 }, mast: {}, bp: [], board: null, jobsDone: 0, att: {} });
  D.Growth = {};
  const Gw = D.Growth;
  Gw.TUNE = TUNE;
  Gw.fresh = fresh;
  const ensure = pf => { if (!pf.grow) pf.grow = fresh(); const g = pf.grow; g.fac = Object.assign({ bench: 0, med: 0, intel: 0, store: 0 }, g.fac); g.mast = g.mast || {}; g.bp = g.bp || []; g.att = g.att || {}; return g; };
  Gw.ensure = ensure;

  // ── 配件：装在某一型枪上
  D.gunAtt = (pf, gun) => (ensure(pf).att[gun] || (ensure(pf).att[gun] = {}));
  D.attach = function (pf, gun, attKey) {
    const A = D.ATT[attKey]; if (!A || !D.CARDS[gun] || D.CARDS[gun].slot !== 'gun') return false;
    if (!Gr().take(pf.stash, 'att:' + attKey, 1)) return false;
    const cur = D.gunAtt(pf, gun)[A.slot];
    if (cur && Gr().add(pf.stash, 'att:' + cur, 1)) { Gr().add(pf.stash, 'att:' + attKey, 1); return false; } // 仓库满了换不下来
    D.gunAtt(pf, gun)[A.slot] = attKey;
    return true;
  };
  D.detach = function (pf, gun, slot) {
    const a = D.gunAtt(pf, gun), cur = a[slot]; if (!cur) return true;
    if (Gr().add(pf.stash, 'att:' + cur, 1)) return false;
    delete a[slot]; return true;
  };
  // 枪的最终数值：底子 + 配件 + 机器人改装（散布、枪声）
  const gunCache = new Map();
  D.gunOf = function (pf, gunId, R) {
    const base = D.CARDS[gunId] && D.CARDS[gunId].gun; if (!base) return null;
    const a = pf ? D.gunAtt(pf, gunId) : {}, fx = R ? D.fxOf(R) : NOFX;
    const key = gunId + '|' + Object.keys(D.ATT_SLOTS).map(s => a[s] || '').join(',') + '|' + fx.spread + ',' + fx.noise;
    if (gunCache.has(key)) return gunCache.get(key);
    const m = { dmg: 0, spread: 0, bloom: 0, mag: 0, reload: 0, rate: 0, speed: 0, life: 0, noise: 0 };
    for (const s in D.ATT_SLOTS) { const A = a[s] && D.ATT[a[s]]; if (A) for (const f in A.fx) m[f] += A.fx[f]; }
    const g = Object.assign({}, base, {
      dmg: base.dmg * (1 + m.dmg), spread: base.spread * Math.max(0.2, 1 + m.spread) * fx.spread, bloomMul: Math.max(0.2, 1 + m.bloom),
      mag: Math.max(1, Math.round(base.mag * (1 + m.mag))), reload: base.reload * Math.max(0.3, 1 + m.reload), rate: base.rate * Math.max(0.5, 1 + m.rate),
      speed: base.speed * (1 + m.speed), life: (base.life || 0.9) * (1 + m.life), noise: base.noise * Math.max(0.1, 1 + m.noise) * fx.noise,
    });
    if (gunCache.size > 400) gunCache.clear();
    gunCache.set(key, g); return g;
  };

  // ── 机器人改装
  D.shellMods = (pf, k) => { const s = pf.shells[k]; if (!s) return {}; return s.mods || (s.mods = {}); };
  D.fitMod = function (pf, k, modKey) {
    const M = D.RMOD[modKey]; if (!M || !pf.shells[k]) return false;
    if (!Gr().take(pf.stash, 'rmod:' + modKey, 1)) return false;
    const mods = D.shellMods(pf, k), cur = mods[M.slot];
    if (cur && Gr().add(pf.stash, 'rmod:' + cur, 1)) { Gr().add(pf.stash, 'rmod:' + modKey, 1); return false; }
    mods[M.slot] = modKey; return true;
  };
  D.unfitMod = function (pf, k, slot) {
    const mods = D.shellMods(pf, k), cur = mods[slot]; if (!cur) return true;
    if (Gr().add(pf.stash, 'rmod:' + cur, 1)) return false;
    delete mods[slot]; return true;
  };
  const NOFX = { hp: 0, hurt: 1, shield0: 0, speed: 1, dash: 1, cap: 1, skill: 1, search: 1, notice: 1, spread: 1, noise: 1 };
  D.NOFX = NOFX;
  D.fxOf = R => (R && R.fx) || NOFX;
  // 一台型号这趟的总加成：改装件 + 熟练度
  D.shellFx = function (pf, k) {
    const sum = { hp: 0, hurt: 0, shield0: 0, speed: 0, dash: 0, cap: 0, skill: 0, search: 0, notice: 0, spread: 0, noise: 0 };
    const mods = pf.shells[k] ? D.shellMods(pf, k) : {};
    for (const s in D.RMOD_SLOTS) { const M = mods[s] && D.RMOD[mods[s]]; if (M) for (const f in M.fx) sum[f] += M.fx[f]; }
    const out = { hp: sum.hp, shield0: sum.shield0 };
    for (const f of ['hurt', 'speed', 'dash', 'cap', 'skill', 'search', 'notice', 'spread', 'noise']) out[f] = Math.max(0.3, 1 + sum[f]);
    if (D.mastLv(pf, k) >= 2) out.skill *= TUNE.mastSkillCd;
    return out;
  };

  // ── 熟练度
  D.mastXP = (pf, k) => ensure(pf).mast[k] || 0;
  D.mastLv = (pf, k) => { const x = D.mastXP(pf, k); return x >= TUNE.mastXP[2] ? 3 : x >= TUNE.mastXP[1] ? 2 : 1; };
  D.MAST2 = { // 3 级：技能第二形态
    scan: '持续 12 秒，期间搜容器快 30%', cloak: '隐身 6 秒', slam: '范围更大（70），伤害 30，晕 1.5 秒',
    magnet: '吸取范围 220', repair: '6 秒内回复 48 耐久', hack: '范围 180，机器停摆多 1.5 秒',
  };

  // ───────────────────────── 据点设施
  // lv 0 = 没建。每级：零件 money + 材料 mats
  D.FAC = {
    bench: { name: '工作台', icon: 'g_power', desc: '制造配件和改装件。等级越高能做的品质越高；传说级要先学蓝图',
      lv: [{ money: 400, mats: [['scrap', 6], ['screws', 4]], fx: '能做优良级' }, { money: 1200, mats: [['motor', 2], ['board', 3]], fx: '能做精良级' }, { money: 2800, mats: [['servo', 1], ['bearing', 3]], fx: '能做史诗级' }, { money: 6000, mats: [['reactor', 1], ['gpu', 1]], fx: '能做传说级（要蓝图）' }] },
    med: { name: '医疗室', icon: 'g_armor', desc: '修工壳打折；高级的医疗室会在你出门时慢慢修好停在机库里的型号',
      lv: [{ money: 500, mats: [['bandage', 3], ['can', 3]], fx: '修理 -15%' }, { money: 1400, mats: [['medpack', 2], ['sensor', 1]], fx: '修理 -30%，停着的型号每天修 5%' }, { money: 3000, mats: [['hydro', 2], ['board', 4]], fx: '修理 -45%，每天修 10%' }, { money: 6500, mats: [['reactor', 1], ['servo', 1]], fx: '修理 -60%，每天修 20%' }] },
    intel: { name: '情报站', icon: 'g_sensor', desc: '委托板多一条、出发时免费揭开几个站、委托报酬更高',
      lv: [{ money: 600, mats: [['radio', 1], ['oldcell', 4]], fx: '委托板 +1 条' }, { money: 1500, mats: [['ssd', 1], ['board', 3]], fx: '出发时免费揭开 3 个站' }, { money: 3200, mats: [['server', 1], ['sensor', 2]], fx: '委托板再 +1 条，出发时揭开 5 个站' }, { money: 7000, mats: [['laptop', 1], ['crypto', 1]], fx: '委托报酬 +25%' }] },
    store: { name: '仓库', icon: 'g_pkg', desc: '仓库扩容、保险箱升级',
      lv: [{ money: 500, mats: [['plastic', 6], ['scrap', 6]], fx: '仓库 +3 行' }, { money: 1600, mats: [['copper', 3], ['oil', 2]], fx: '保险箱 3×3' }, { money: 3600, mats: [['hydro', 2], ['bearing', 3]], fx: '仓库再 +3 行，门禁卡包 6 格' }, { money: 8000, mats: [['silver', 2], ['platinum', 1]], fx: '保险箱 4×4' }] },
  };
  D.facLv = (pf, k) => ensure(pf).fac[k] | 0;
  D.facNext = (pf, k) => D.FAC[k].lv[D.facLv(pf, k)] || null;
  const haveMats = (pf, mats) => mats.every(([id, n]) => Gr().count(pf.stash, x => x === id) >= n);
  D.canPay = (pf, money, mats) => pf.money >= money && haveMats(pf, mats || []);
  const pay = (pf, money, mats) => { pf.money -= money; for (const [id, n] of mats || []) Gr().take(pf.stash, id, n); };
  D.facUp = function (pf, k) {
    const nx = D.facNext(pf, k); if (!nx || !D.canPay(pf, nx.money, nx.mats)) return false;
    pay(pf, nx.money, nx.mats); ensure(pf).fac[k]++;
    Gw.applyStore(pf);
    return true;
  };
  // 仓库 / 保险箱大小跟着设施等级走（只会变大，原来的东西位置不动）
  D.stashSize = pf => { const lv = D.facLv(pf, 'store'); return [D.STASH_SIZE[0], D.STASH_SIZE[1] + (lv >= 1 ? 3 : 0) + (lv >= 3 ? 3 : 0)]; };
  D.safeSize = pf => { const lv = D.facLv(pf, 'store'); return lv >= 4 ? [4, 4] : lv >= 2 ? [3, 3] : D.SAFE_SIZE.slice(); };
  Gw.applyStore = function (pf) {
    const [sw, sh] = D.stashSize(pf), [fw, fh] = D.safeSize(pf);
    pf.stash.w = Math.max(pf.stash.w, sw); pf.stash.h = Math.max(pf.stash.h, sh);
    pf.safe.w = Math.max(pf.safe.w, fw); pf.safe.h = Math.max(pf.safe.h, fh);
    if (pf.keycase) pf.keycase.w = Math.max(pf.keycase.w, D.facLv(pf, 'store') >= 3 ? 6 : D.KEYCASE[0]);
  };
  D.repairMul = pf => 1 - [0, 0.15, 0.3, 0.45, 0.6][D.facLv(pf, 'med')];
  D.idleRepair = pf => [0, 0, 0.05, 0.1, 0.2][D.facLv(pf, 'med')];
  D.freeScout = pf => [0, 0, 3, 5, 5][D.facLv(pf, 'intel')];

  // ───────────────────────── 工作台制造
  const MATS = {
    muzzle: [null, [['scrap', 3], ['screws', 2]], [['copper', 2], ['bearing', 1]], [['hydro', 1], ['bearing', 2]], [['reactor', 1], ['silver', 1]]],
    mag:    [null, [['plastic', 3], ['screws', 2]], [['motor', 1], ['plastic', 2]], [['servo', 1], ['screws', 4]], [['reactor', 1], ['bearing', 2]]],
    sight:  [null, [['board', 1], ['plastic', 2]], [['sensor', 1], ['board', 1]], [['scope', 1], ['sensor', 1]], [['qchip', 1], ['scope', 1]]],
    stock:  [null, [['plastic', 4], ['scrap', 2]], [['oil', 1], ['copper', 2]], [['hydro', 1], ['servo', 1]], [['platinum', 1], ['servo', 1]]],
    armor:  [null, [['scrap', 5], ['copper', 1]], [['copper', 3], ['plastic', 3]], [['silver', 1], ['hydro', 1]], [['platinum', 1], ['reactor', 1]]],
    power:  [null, [['oldcell', 3], ['motor', 1]], [['motor', 2], ['board', 1]], [['servo', 1], ['reactor', 1]], [['core', 1]]],
    sensor: [null, [['board', 1], ['oldcell', 2]], [['sensor', 1], ['ssd', 1]], [['gpu', 1], ['sensor', 1]], [['qchip', 1], ['server', 1]]],
  };
  D.recipe = k => { const G = gearDef(k); return G && { money: TUNE.craftMoney[G.q], mats: MATS[G.slot][G.q], q: G.q, needBp: G.q >= 4 }; };
  D.canCraft = (pf, k) => { const r = D.recipe(k); if (!r) return 'no'; if (D.facLv(pf, 'bench') < r.q) return 'lv'; if (r.needBp && !ensure(pf).bp.includes(k)) return 'bp'; return D.canPay(pf, r.money, r.mats) ? 'ok' : 'poor'; };
  D.craft = function (pf, k) {
    if (D.canCraft(pf, k) !== 'ok') return false;
    if (!Gr().canAdd(pf.stash, gearId(k), 1)) return false;
    const r = D.recipe(k); pay(pf, r.money, r.mats); Gr().add(pf.stash, gearId(k), 1); return true;
  };
  D.learnBp = function (pf, e) {
    const k = e.id.slice(3), g = ensure(pf);
    if (g.bp.includes(k)) return false;
    Gr().remove(pf.stash, e); g.bp.push(k); return true;
  };

  // ── 掉落：容器里偶尔有配件 / 改装件，史诗以上偶尔换成蓝图
  Gw.rollGear = function (rng, q, C) {
    if (q < 1) return null;
    if (q >= 3 && rng.chance(TUNE.bpP)) { const pool = Object.keys(D.ATT).filter(k => D.ATT[k].q === 4).concat(Object.keys(D.RMOD).filter(k => D.RMOD[k].q === 4)); return { id: 'bp:' + rng.pick(pool), n: 1 }; }
    if (!rng.chance(C && C.cards ? TUNE.dropPCards : TUNE.dropP)) return null;
    const qq = Math.min(4, q), pool = Object.keys(D.ATT).filter(k => D.ATT[k].q === qq).map(k => 'att:' + k).concat(Object.keys(D.RMOD).filter(k => D.RMOD[k].q === qq).map(k => 'rmod:' + k));
    return pool.length ? { id: rng.pick(pool), n: 1 } : null;
  };
  // 商店：优良、精良的配件和改装件
  Gw.shop = pf => {
    const out = [];
    for (const k in D.ATT) if (D.ATT[k].q <= 2) out.push({ id: 'att:' + k, n: 1, price: Math.round(TUNE.gearV[D.ATT[k].q] * TUNE.shopMul) });
    for (const k in D.RMOD) if (D.RMOD[k].q <= 2) out.push({ id: 'rmod:' + k, n: 1, price: Math.round(TUNE.gearV[D.RMOD[k].q] * TUNE.shopMul) });
    return out;
  };

  // ───────────────────────── 委托板（30 个模板）
  // type：fetch 交东西（据点里交）、kill 击毁、visit 到某类站再撤出、search 打开某类容器、deliver 送包裹（要押金）、deep 去沦陷区再撤出、haul 带回总价值
  // 除了 fetch，进度都要撤出来才算数；损毁那趟的进度作废
  const JOBS = [
    { k: 'l_wire',    who: '林桥', name: '补线',       type: 'fetch', item: 'scrap', n: 8, money: 160, text: '修理铺的铜线又用完了。' },
    { k: 'l_motor',   who: '林桥', name: '两台电机',   type: 'fetch', item: 'motor', n: 2, money: 260, text: '站里的通风机转不动了，换两台小电机。' },
    { k: 'l_bearing', who: '林桥', name: '精密轴承',   type: 'fetch', item: 'bearing', n: 3, money: 420, text: '老机床的轴承磨圆了，三个就够。' },
    { k: 'l_servo',   who: '林桥', name: '伺服电机',   type: 'fetch', item: 'servo', n: 1, money: 480, give: 'rmod:joint', text: '想给工壳的关节换个好的，帮我找一台伺服电机。' },
    { k: 'l_hydro',   who: '林桥', name: '液压缸',     type: 'fetch', item: 'hydro', n: 2, money: 460, text: '起重架要两根液压缸。' },
    { k: 'l_sensor',  who: '林桥', name: '传感器',     type: 'fetch', item: 'sensor', n: 3, money: 430, give: 'att:reddot', text: '给门口装几个报警器。' },
    { k: 'l_reactor', who: '林桥', name: '备用电源',   type: 'fetch', item: 'reactor', n: 1, money: 620, text: '配电室要一块微型反应堆电池顶着，限 4 天。', days: 4 },
    { k: 'l_gpu',     who: '林桥', name: '一张显卡',   type: 'fetch', item: 'gpu', n: 1, money: 680, give: 'att:holo', text: '读存储器的机器太慢了。' },
    { k: 's_crawler', who: '南栈站务', name: '清理拾荒蛛', type: 'kill', enemy: 'crawler', n: 12, money: 300, text: '线路上的拾荒蛛又多起来了，击毁 12 只。' },
    { k: 's_drone',   who: '南栈站务', name: '打掉哨兵',   type: 'kill', enemy: 'drone', n: 8, money: 360, text: '巡逻球在盯我们的补给线，打掉 8 个。' },
    { k: 's_raider',  who: '南栈站务', name: '抢货的人',   type: 'kill', enemy: 'raider', n: 5, money: 420, text: '有一伙回收者在截流民的货，放倒 5 个。' },
    { k: 's_bomber',  who: '南栈站务', name: '自爆蜂',     type: 'kill', enemy: 'bomber', n: 6, money: 280, text: '自爆蜂炸坏了两段轨道。' },
    { k: 's_sniper',  who: '南栈站务', name: '高处的眼睛', type: 'kill', enemy: 'sniper', n: 4, money: 400, text: '长眼守着几个换乘站，打掉 4 个。' },
    { k: 's_eng',     who: '南栈站务', name: '拆掉工程机', type: 'kill', enemy: 'engineer', n: 1, money: 600, give: 'rmod:plate', text: '一台工程机在拆我们的站台。' },
    { k: 's_machine', who: '南栈站务', name: '清线',       type: 'kill', enemy: 'machine', n: 25, money: 640, days: 3, text: '3 天内击毁 25 台机器，什么机器都算。' },
    { k: 'r_meds',    who: '流民营', name: '人用药箱',     type: 'fetch', item: 'medpack', n: 2, money: 300, text: '营里有人发烧了。' },
    { k: 'r_food',    who: '流民营', name: '罐头',       type: 'fetch', item: 'can', n: 6, money: 190, text: '孩子们好几天没吃上热的了。' },
    { k: 'r_bandage', who: '流民营', name: '绷带',       type: 'fetch', item: 'bandage', n: 4, money: 220, text: '绷带用完了。' },
    { k: 'r_deliver', who: '流民营', name: '送一包药',   type: 'deliver', to: ['refuge'], deposit: 200, money: 450, text: '把这包药送到别的流民营。押金 200，送到退还。' },
    { k: 'r_far',     who: '流民营', name: '捎一封信',   type: 'deliver', to: ['outpost'], deposit: 300, money: 620, days: 3, text: '3 天内送到任何一个人类据点。押金 300。' },
    { k: 'a_hosp',    who: '阿隼', name: '看看医院',     type: 'visit', station: 'hospital', money: 320, text: '有人说医院站的药柜还满着，去看一眼再撤出来。' },
    { k: 'a_dc',      who: '阿隼', name: '机房',         type: 'visit', station: 'datacenter', money: 540, text: '去一趟数据中心，活着回来。' },
    { k: 'a_bank',    who: '阿隼', name: '金库',         type: 'visit', station: 'bank', money: 720, text: '银行金库那边动静很大，进去再出来就行。' },
    { k: 'a_cache',   who: '阿隼', name: '废弃支线',     type: 'visit', station: 'cache', money: 800, text: '找到一个隐藏仓库，进去再撤出来。' },
    { k: 'a_deep',    who: '阿隼', name: '下到沦陷区',   type: 'deep', tier: 3, money: 900, give: 'att:shock', text: '敢去沦陷区吗？去过再活着回来。' },
    { k: 'a_haul',    who: '阿隼', name: '一趟赚票',     type: 'haul', value: 2500, money: 520, text: '一趟带回价值 2500 以上的东西。' },
    { k: 'a_haul2',   who: '阿隼', name: '大单',         type: 'haul', value: 6000, money: 1150, days: 3, text: '3 天内，一趟带回价值 6000 以上的东西。' },
    { k: 'b_safe',    who: '黑市', name: '开保险柜',     type: 'search', cont: ['safe', 'vault', 'lockbox'], n: 3, money: 500, text: '打开 3 个保险柜、金库柜或门禁柜（要撤出来）。' },
    { k: 'b_crypto',  who: '黑市', name: '加密硬盘',     type: 'fetch', item: 'crypto', n: 1, money: 2300, text: '有人出高价收一块加密硬盘，不问来路。' },
    { k: 'b_server',  who: '黑市', name: '服务器刀片',   type: 'fetch', item: 'server', n: 2, money: 1400, give: 'bp:smart', text: '两块服务器刀片，换一张智能瞄具的图纸。' },
  ];
  D.JOBS = JOBS;
  const JOB = Object.fromEntries(JOBS.map(j => [j.k, j]));
  const today = pf => D.marketDay(pf);
  const rewardMul = pf => (D.facLv(pf, 'intel') >= 4 ? 1.25 : 1);
  Gw.jobDef = k => JOB[k];
  Gw.offerCount = pf => TUNE.jobOffers + (D.facLv(pf, 'intel') >= 1 ? 1 : 0) + (D.facLv(pf, 'intel') >= 3 ? 1 : 0);
  // 每天刷新：没接的换一批；已经接的、做完的这几天不重复
  Gw.board = function (pf) {
    const g = ensure(pf), d = today(pf);
    if (!g.board || g.board.day !== d) {
      const old = g.board || { active: [], recent: [] };
      const active = (old.active || []).filter(j => !(j.deadline != null && d > j.deadline));
      const expired = (old.active || []).filter(j => j.deadline != null && d > j.deadline).map(j => j.k);
      const recent = (old.recent || []).filter(x => Array.isArray(x) && d - x[1] < 3), rng = D.rng(pf.seed + ':jobs:' + d), skip = new Set(active.map(j => j.k).concat(recent.map(x => x[0]))); // 做完的委托 3 天内不重复
      const pool = JOBS.filter(j => !skip.has(j.k) && (j.type !== 'deliver' || pf.wins >= 1) && (j.money < 900 || pf.wins >= 3)); // 新档先给简单的
      rng.shuffle(pool);
      g.board = { day: d, offers: pool.slice(0, Gw.offerCount(pf)).map(j => j.k), active, recent, expired };
    }
    return g.board;
  };
  Gw.accept = function (pf, k) {
    const B = Gw.board(pf), J = JOB[k]; if (!J || !B.offers.includes(k) || B.active.length >= TUNE.jobActive) return false;
    if (J.deposit && pf.money < J.deposit) return false;
    if (J.type === 'deliver' && !Gr().canAdd(pf.kit, 'job:' + k, 1) && !Gr().canAdd(pf.stash, 'job:' + k, 1)) return false;
    if (J.deposit) pf.money -= J.deposit;
    if (J.type === 'deliver') { if (Gr().add(pf.kit, 'job:' + k, 1)) Gr().add(pf.stash, 'job:' + k, 1); }
    B.offers = B.offers.filter(x => x !== k);
    B.active.push({ k, prog: 0, since: today(pf), deadline: J.days ? today(pf) + J.days - 1 : null });
    return true;
  };
  const dropPkg = (pf, k) => { for (const g of [pf.kit, pf.stash, pf.safe]) Gr().take(g, 'job:' + k, 9); };
  Gw.abandon = function (pf, k) { const B = Gw.board(pf), i = B.active.findIndex(j => j.k === k); if (i < 0) return false; B.active.splice(i, 1); dropPkg(pf, k); return true; };
  Gw.need = j => { const J = JOB[j.k]; return J.type === 'fetch' ? J.n : J.type === 'kill' || J.type === 'search' ? J.n : 1; };
  Gw.progress = function (pf, j) { const J = JOB[j.k]; if (J.type === 'fetch') return Math.min(J.n, Gr().count(pf.stash, x => x === J.item)); return j.prog; };
  Gw.goal = function (J) {
    switch (J.type) {
      case 'fetch': return '交 ' + D.itemInfo(J.item).name + ' ×' + J.n + '（放在仓库里，回据点交）';
      case 'kill': return '击毁' + (J.enemy === 'machine' ? '任意机器' : D.ENEMIES[J.enemy].name) + ' ×' + J.n + '，撤出来才算';
      case 'visit': return '进一次' + D.STATION_TYPES[J.station].name + '，再撤出来';
      case 'search': return '打开' + J.cont.map(c => D.CONT[c].name).join(' / ') + ' ×' + J.n + '，撤出来才算';
      case 'deliver': return '把委托包裹带进' + J.to.map(t => D.STATION_TYPES[t].name).join(' / ') + '（不算出发的那站）';
      case 'deep': return '进一个' + D.TIER_NAME[J.tier] + '的站（最里面一圈），再撤出来';
      case 'haul': return '一趟带回价值 ' + J.value + ' 以上的东西';
    }
    return '';
  };
  Gw.reward = (pf, J) => ({ money: Math.round(J.money * rewardMul(pf) / 10) * 10 + (J.deposit || 0), give: J.give || null });
  // 交付：发报酬，放进做完的列表
  function complete(pf, j, out) {
    const J = JOB[j.k], B = Gw.board(pf), r = Gw.reward(pf, J);
    pf.money += r.money; if (r.give && Gr().add(pf.stash, r.give, 1)) Gr().add(pf.kit, r.give, 1);
    B.active = B.active.filter(x => x !== j); B.recent = (B.recent || []).concat([[j.k, today(pf)]]).slice(-12); ensure(pf).jobsDone++;
    if (out) (out.jobs = out.jobs || []).push({ name: J.name, who: J.who, money: r.money, give: r.give });
    return r;
  }
  Gw.turnIn = function (pf, k) {
    const B = Gw.board(pf), j = B.active.find(x => x.k === k), J = JOB[k]; if (!j || J.type !== 'fetch') return false;
    if (Gr().count(pf.stash, x => x === J.item) < J.n) return false;
    Gr().take(pf.stash, J.item, J.n); return complete(pf, j, null);
  };

  // ── 行动中的挂钩（进度先记在这趟里，撤出来再算）
  const tally = R => R.jobT || (R.jobT = { kill: {}, machine: 0, open: {}, types: new Set(), deepest: 0, delivered: new Set() });
  Gw.startRaid = function (R) {
    const pf = R.pf; R.fx = D.shellFx(pf, R.shell); R.mast = D.mastLv(pf, R.shell); R.guns0 = D.loadGuns(R.load); R.entry = R.at; R.modsAtStart = Object.assign({}, pf.shells[R.shell] ? D.shellMods(pf, R.shell) : {}); tally(R);
    if (D.heroOf) D.heroOf(R.shell, R.modsAtStart); // 出发时先生成带改装件的图集，进站第一帧不卡
    const n = D.freeScout(pf); if (n) R.scouted = D.buyIntel(R.city, n).length;
  };
  Gw.onEnter = function (S) {
    const R = S.raid, T = tally(R), st = S.st;
    T.types.add(st.type); T.deepest = Math.max(T.deepest, st.tier | 0);
    const B = R.pf.grow && R.pf.grow.board; if (!B) return;
    for (const j of B.active) { const J = JOB[j.k]; if (J.type !== 'deliver' || T.delivered.has(j.k) || !J.to.includes(st.type) || st.id === R.city.home || st.id === R.entry) continue;
      if (Gr().take(R.bag, 'job:' + j.k, 1)) { T.delivered.add(j.k); S.banner = { t: 0, text: '包裹送到了', sub: '委托「' + J.name + '」：撤出来就能拿报酬' }; }
    }
  };
  Gw.onKill = function (S, e) { if (S.tut) return; const T = tally(S.raid); T.kill[e.kind] = (T.kill[e.kind] || 0) + 1; if (!D.ENEMIES[e.kind].human) T.machine++; };
  Gw.onOpen = function (S, c) { if (S.tut) return; const T = tally(S.raid); T.open[c.kind] = (T.open[c.kind] || 0) + 1; };
  // 结束一趟：委托结算、熟练度、医疗室、损毁时丢配件和改装件
  Gw.onFinish = function (R, out) {
    const pf = R.pf, g = ensure(pf), T = tally(R), B = Gw.board(pf);
    if (out.ok) {
      for (const j of B.active.slice()) {
        const J = JOB[j.k];
        if (J.type === 'kill') j.prog = Math.min(J.n, j.prog + (J.enemy === 'machine' ? T.machine : T.kill[J.enemy] || 0));
        else if (J.type === 'search') j.prog = Math.min(J.n, j.prog + J.cont.reduce((s, c) => s + (T.open[c] || 0), 0));
        else if (J.type === 'visit') j.prog = T.types.has(J.station) ? 1 : j.prog;
        else if (J.type === 'deep') j.prog = T.deepest >= J.tier ? 1 : j.prog;
        else if (J.type === 'haul') j.prog = out.value >= J.value ? 1 : j.prog;
        else if (J.type === 'deliver') j.prog = T.delivered.has(j.k) ? 1 : j.prog;
        if (J.type !== 'fetch' && j.prog >= Gw.need(j)) complete(pf, j, out);
      }
    } else {
      // 包裹丢了 = 委托失败，押金不退
      for (const j of B.active.slice()) { const J = JOB[j.k]; if (J.type === 'deliver' && (T.delivered.has(j.k) || !Gr().count(pf.kit, x => x === 'job:' + j.k) && !Gr().count(pf.stash, x => x === 'job:' + j.k) && !Gr().count(pf.safe, x => x === 'job:' + j.k))) { B.active = B.active.filter(x => x !== j); (out.jobFail = out.jobFail || []).push(J.name); } }
      // 损毁：带进城的枪上的配件、这台型号的改装件都丢
      const guns = new Set([...(R.guns0 || []), ...D.loadGuns(R.load)]); // 两个武器槽都可能是枪
      for (const gun of guns) { const a = g.att[gun]; if (a) { for (const s in a) out.lost.push({ id: 'att:' + a[s], n: 1 }); g.att[gun] = {}; } }
      const mods = R.modsAtStart || {};
      for (const s in mods) out.lost.push({ id: 'rmod:' + mods[s], n: 1 });
      if (pf.shells[R.shell]) pf.shells[R.shell].mods = {};
      out.value = out.lost.reduce((s, e) => s + (D.itemInfo(e.id).v || 0) * e.n, 0) + (out.lostShell ? D.SHELLS[out.lostShell].price : 0);
    }
    // 熟练度：撤出 +2，损毁 +1，每击毁 15 台再 +1
    const before = D.mastLv(pf, R.shell);
    g.mast[R.shell] = (g.mast[R.shell] || 0) + (out.ok ? 2 : 1) + Math.floor((R.kills || 0) / 15);
    if (D.mastLv(pf, R.shell) > before) out.mastUp = { shell: R.shell, lv: D.mastLv(pf, R.shell) };
    // 医疗室：停在机库里的型号每天修一点
    const rep = D.idleRepair(pf); if (rep) for (const k in pf.shells) if (k !== R.shell && !D.SHELLS[k].free) pf.shells[k].cond = Math.min(1, pf.shells[k].cond + rep);
  };

  // ── 想要的东西：委托、设施下一级要的材料（仓库和搜刮里高亮）
  Gw.wanted = function (pf) {
    const out = new Map(), add = (id, why) => { if (!out.has(id)) out.set(id, why); };
    if (!pf || !pf.grow) return out;
    const B = pf.grow.board; if (B) for (const j of B.active) { const J = JOB[j.k]; if (J.type === 'fetch') add(J.item, '委托「' + J.name + '」要'); }
    for (const k in D.FAC) { const nx = D.facNext(pf, k); if (nx) for (const [id] of nx.mats) add(id, D.FAC[k].name + '升级要'); }
    return out;
  };

  // 要用的数量（同一样东西几处都要就加起来）
  Gw.wantedCounts = function (pf) {
    const out = new Map(), add = (id, n) => out.set(id, (out.get(id) || 0) + n);
    if (!pf || !pf.grow) return out;
    const B = pf.grow.board; if (B) for (const j of B.active) { const J = JOB[j.k]; if (J.type === 'fetch') add(J.item, J.n); }
    for (const k in D.FAC) { const nx = D.facNext(pf, k); if (nx) for (const [id, n] of nx.mats) add(id, n); }
    return out;
  };
  // "卖掉杂物"：白色、绿色的东西，要用的留够数量，多出来的整组卖掉
  Gw.junk = function (pf) {
    const need = Gw.wantedCounts(pf), kept = new Map(), out = [];
    const list = pf.stash.items.filter(e => { const it = D.itemInfo(e.id); return it.kind === 'item' && it.q <= 1; }).sort((a, b) => b.n - a.n);
    for (const e of list) { const k = kept.get(e.id) || 0, n = need.get(e.id) || 0; if (k < n) { kept.set(e.id, k + e.n); continue; } out.push(e); }
    return out;
  };

  // ── 存档
  Gw.serialize = pf => { const g = ensure(pf); return JSON.parse(JSON.stringify({ fac: g.fac, mast: g.mast, bp: g.bp, board: g.board, jobsDone: g.jobsDone | 0, att: g.att })); };
  Gw.deserialize = function (pf, o) {
    const g = pf.grow = fresh();
    if (o && typeof o === 'object') {
      for (const k in g.fac) g.fac[k] = Math.max(0, Math.min(4, (o.fac && o.fac[k]) | 0));
      g.mast = Object.fromEntries(Object.entries(o.mast || {}).filter(([k]) => D.SHELLS[k]).map(([k, v]) => [k, v | 0]));
      g.bp = (o.bp || []).filter(k => gearDef(k) || (D.AMMO_BP && D.AMMO_BP[k])); // 弹药蓝图（workshop.js）也留着
      g.jobsDone = o.jobsDone | 0;
      if (o.board && Array.isArray(o.board.offers)) g.board = { day: o.board.day | 0, offers: o.board.offers.filter(k => JOB[k]), active: (o.board.active || []).filter(j => j && JOB[j.k]).map(j => ({ k: j.k, prog: j.prog | 0, since: j.since | 0, deadline: j.deadline == null ? null : j.deadline | 0 })), recent: (o.board.recent || []).filter(x => Array.isArray(x) && JOB[x[0]]).map(x => [x[0], x[1] | 0]), expired: [] };
      for (const gun in o.att || {}) if (D.CARDS[gun] && D.CARDS[gun].gun) { const a = {}; for (const s in D.ATT_SLOTS) { const v = o.att[gun][s]; if (v && D.ATT[v] && D.ATT[v].slot === s) a[s] = v; } g.att[gun] = a; }
    }
    for (const k in pf.shells) { if (!pf.shells[k].mods) continue; const m = pf.shells[k].mods, ok = {}; for (const s in D.RMOD_SLOTS) if (m[s] && D.RMOD[m[s]] && D.RMOD[m[s]].slot === s) ok[s] = m[s]; pf.shells[k].mods = ok; }
    Gw.applyStore(pf);
  };

  // ── 自动玩家用：按顺序花钱（经济模拟看"钱有没有去处"）
  Gw.botSpend = function (pf, keep) {
    const did = [];
    keep = keep == null ? 600 : keep;
    for (const j of Gw.board(pf).active.slice()) if (JOB[j.k].type === 'fetch' && Gw.turnIn(pf, j.k)) did.push('交委托');
    const B = Gw.board(pf); for (const k of B.offers.slice()) if (B.active.length < TUNE.jobActive && JOB[k].type !== 'deliver' && Gw.accept(pf, k)) did.push('接委托');
    for (const k of ['bench', 'store', 'med', 'intel']) { const nx = D.facNext(pf, k); if (nx && pf.money - nx.money >= keep && D.facUp(pf, k)) did.push(D.FAC[k].name + '升级'); }
    const gun = D.loadGun(pf.load), a = gun ? D.gunAtt(pf, gun) : {};
    if (gun) for (const s in D.ATT_SLOTS) {
      const best = Object.keys(D.ATT).filter(k => D.ATT[k].slot === s && (!a[s] || D.ATT[k].q > D.ATT[a[s]].q)).sort((x, y) => D.ATT[y].q - D.ATT[x].q);
      for (const k of best) { if (Gr().count(pf.stash, x => x === 'att:' + k)) { if (D.attach(pf, gun, k)) { did.push('装配件'); break; } } else if (pf.money - D.recipe(k).money >= keep && D.craft(pf, k) && D.attach(pf, gun, k)) { did.push('造配件'); break; } }
    }
    const mods = D.shellMods(pf, pf.shell);
    for (const s in D.RMOD_SLOTS) {
      const best = Object.keys(D.RMOD).filter(k => D.RMOD[k].slot === s && (!mods[s] || D.RMOD[k].q > D.RMOD[mods[s]].q)).sort((x, y) => D.RMOD[y].q - D.RMOD[x].q);
      for (const k of best) { if (Gr().count(pf.stash, x => x === 'rmod:' + k)) { if (D.fitMod(pf, pf.shell, k)) { did.push('装改装件'); break; } } else if (pf.money - D.recipe(k).money >= keep && D.craft(pf, k) && D.fitMod(pf, pf.shell, k)) { did.push('造改装件'); break; } }
    }
    for (const e of pf.stash.items.slice()) if (e.id.startsWith('bp:') && D.learnBp(pf, e)) did.push('学蓝图');
    return did;
  };
  // 还能往哪花钱：没做的设施等级、没装满的配件槽 / 改装槽（经济模拟里看"想买的下一件"）
  Gw.sinks = function (pf) {
    const out = [];
    for (const k in D.FAC) { const nx = D.facNext(pf, k); if (nx) out.push({ what: D.FAC[k].name + ' ' + (D.facLv(pf, k) + 1) + ' 级', money: nx.money }); }
    const g0 = D.loadGun(pf.load), a = g0 ? D.gunAtt(pf, g0) : {}; if (g0) for (const s in D.ATT_SLOTS) if (!a[s] || D.ATT[a[s]].q < 4) out.push({ what: '配件 · ' + D.ATT_SLOTS[s], money: TUNE.craftMoney[Math.min(4, (a[s] ? D.ATT[a[s]].q : 0) + 1)] });
    for (const k in D.SHELLS) if (!pf.shells[k]) out.push({ what: '型号 · ' + D.SHELLS[k].name, money: D.SHELLS[k].price });
    return out.sort((x, y) => x.money - y.money);
  };
})(D);
