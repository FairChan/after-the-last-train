/* Underdog · 新手教学（南栈训练长厅）和"第一次见到某个系统时的一句提示"
   设计：design/features/tutorial/design.md（2026-11-17 重做）
   训练场 = 楼层 0 训练长厅（八个区，区之间一道能量闸门，场景在 tut-arena.js）+ 楼层 1 撤离站台。
   不刷驻军，按步骤放靶子和东西；不会损毁（耐久最低留 1），受到的伤害减半，不涨警戒。
   每一步：林桥说一句 + 要做什么；有的步用聚光灯把对应的界面圈出来（spot，tut-tour.js 的 D.Spot 画）。
   本区的步都做完 → 闸门打开。回车跳过当前区，Esc 菜单里跳过整段。
   提示：正式行动里，某个系统第一次出现时在屏幕下方说一句（记在档案里，只说一次；设置里能关）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, P = D.PAL;
  const K = D.K || (D.K = {});
  const sfx = n => D.Sfx && D.Sfx.play(n);

  D.TUT_STATION = { id: 'tut', type: 'ruin', name: '南栈训练场', tier: 0, exit: 'fixed', lines: ['L1'], adj: new Set() };

  // ── 小工具
  const kk = act => '<b>' + D.keyLabel(D.key(act)) + '</b>'; // 按键名跟着改键走
  const ZN = () => D.TUT_ZONES;
  // 第 zi 区里、离区左沿 dx 格、第 ty 行的格子中心（楼层 0）
  const at = (zi, dx, ty) => ({ x: (ZN()[zi].x0 + dx) * TS + 8, y: ty * TS + 8 });
  const live = (S, e) => e && !e.dead && S.enemies.includes(e);
  // 靶子：active = false 时一直被电晕、不会动；aware = false 是"还没发现你"
  function dummy(S, kind, q, o) {
    o = o || {};
    const e = K.spawnEnemy(S, kind, q.x, q.y, 0.4, o.f != null ? o.f : S.f, o.aware !== false);
    if (!o.active) e.stun = 1e9;
    if (o.hp) { e.maxHp = o.hp; e.hp = o.hp; }
    if (o.hpK) e.hp = Math.max(1, Math.round(e.maxHp * o.hpK));
    e.home = { x: q.x, y: q.y, w: o.roam || 90, h: o.roamH || 50 }; e.cd = 1.5;
    if (e.f === S.f) for (let i = 0; i < 12; i++) K.part(S, 'spark', q.x, q.y - 4, S.rng.range(-60, 60), S.rng.range(-80, 10), 0.3, P.c);
    (S.tut.mine || (S.tut.mine = [])).push(e);
    return e;
  }
  function groundAt(S, q, list) { return list.map(([id, n], i) => { const g = { x: q.x + i * 12 - (list.length - 1) * 6, y: q.y + (i % 2) * 6, f: 0, id, n, t: 0, pop: 0.35 }; S.ground.push(g); return g; }); }
  function contAt(S, kind, q, extra) { const c = K.newContainer(S, S.rng, kind, q.x, q.y, 1, extra); c.f = 0; S.containers.push(c); K.ring(S, q.x, q.y - 4, 16, D.UIC.hi); return c; }
  const roomAt = (S, x, y) => { const A = S.A; return A.room[Math.floor(y / TS) * A.tw + Math.floor(x / TS)]; };
  const bagHas = (R, id) => D.Grid.count(R.bag, k => k === id) > 0;
  const giveIfOut = (S, id, n) => { if (!bagHas(S.raid, id)) { D.Grid.add(S.raid.bag, id, n); K.text(S, S.player.x, S.player.y - 30, '+1', D.UIC.hi); } };
  const pressedF = () => D.Input && D.Input.hit(D.key('interact'));
  // 聚光灯的位置：画布上的界面（640×360，按设置里的"界面大小"从各自的角缩放）或者 DOM 选择器
  const SPOT = {
    hp: () => ({ c: [6, 6, 214, 17], an: [0, 0] }),
    dash: () => ({ c: [6, 24, 50, 11], an: [0, 0] }),
    ammo: () => ({ c: [6, 306, 216, 50], an: [0, D.H] }),
    cap: () => ({ c: [6, 310, 112, 16], an: [0, D.H] }),
    map: () => { const M = D.MINIMAP; return { c: [D.W - M.right - M.w - 3, M.top - 3, M.w + 6, M.h + 6], an: [D.W, 0] }; },
    mapFloors: () => { const M = D.MINIMAP; return { c: [D.W - M.right - 22, M.top, 20, 11], an: [D.W, 0] }; },
  };

  // ── 区和步。z：在哪个区（0–7 训练长厅，8 站台）；lin：林桥的话（剧情脚本"教学"一节有的用那句）；body：要做什么；
  // info：只看的步，F 翻过去；spot：聚光灯（{ c 或 sel, label }）
  const STEPS = [
    // 1 整备区
    { z: 0, k: 'move', title: '走动', body: () => `用 ${kk('up')}${kk('left')}${kk('down')}${kk('right')} 走几步。镜头会稍微跟着鼠标偏，往哪边看就往哪边多看一点。`,
      enter(S) { const T = S.tut; T.x0 = S.player.x; T.y0 = S.player.y; T.mv = 0; }, done: S => { const T = S.tut, p = S.player; T.mv += Math.hypot(p.x - T.x0, p.y - T.y0); T.x0 = p.x; T.y0 = p.y; return T.mv > 64; } },
    { z: 0, k: 'dash', title: '闪避', lin: '腿没装反。再试试闪避，城里保命全靠这一下。',
      body: () => `按 ${kk('dash')} 闪避：朝走的方向冲一小段，冲的那一下<b>无敌</b>。闪两次。闪完要等左上那条短青条重新充满才能再闪。`,
      enter(S) { S.tut.dn = 0; }, done: S => S.tut.dn >= 2, spot: () => Object.assign(SPOT.dash(), { label: '闪避冷却' }) },
    { z: 0, k: 'hp', title: '耐久', info: true, lin: '左上那条红的是你的命。我说的是工壳的命，你人在南栈喝茶。',
      body: () => `红条是<b>耐久</b>，打光了工壳就损毁，背包和装上的东西都丢在城里。红条上叠着的蓝条是<b>护甲和护盾</b>，先替你挨打。不到三成时画面边缘会发红、有心跳声。`,
      spot: () => Object.assign(SPOT.hp(), { label: '耐久 · 护甲 · 护盾' }) },
    // 2 射击场
    { z: 1, k: 'shoot', title: '开枪', body: () => `<b>鼠标</b>瞄准，按住<b>左键</b>开枪，打掉那只拾荒蛛（它被电晕了，不会动）。`,
      enter(S) { S.tut.e = dummy(S, 'crawler', at(1, 14, 14), { f: 0 }); }, target: S => S.tut.e, done: S => S.tut.e.dead },
    { z: 1, k: 'spray', title: '连射会散', lin: '一排三只。手别抖，抖也没用，枪自己会抖。',
      body: () => `一直按着连射，子弹越来越散，准星也跟着张开；松开一下就收回来。打远处的东西，<b>点射</b>比扫射准。弹匣空了会自动换弹。`,
      enter(S) { S.tut.list = [12, 14, 16].map(y => dummy(S, 'mite', at(1, 21, y), { f: 0 })); }, target: S => S.tut.list.find(e => !e.dead), done: S => S.tut.list.every(e => e.dead) },
    { z: 1, k: 'reload', title: '换弹', body: () => `打几枪，按 ${kk('reload')} 换弹。左下是弹匣：每一格一发，低了会变红。换弹时从背包里拿子弹，背包里没子弹就换不上。`,
      enter(S) { S.tut.rl = false; }, done: S => S.tut.rl, spot: () => Object.assign(SPOT.ammo(), { label: '弹匣 · 子弹等级' }) },
    { z: 1, k: 'ammo', title: '换弹种', lin: '背包里塞了两种钉子。二级的疼一点，贵一点。',
      body: () => `按 ${kk('ammo')} 在背包里有的弹种之间轮换（现在是一级、二级钉子），<b>下次换弹</b>才换上，左下会写"下次装几级"。子弹有五种口径、四个等级（工坊能做五级），等级越高越疼。`,
      enter(S) { S.tut.ap0 = D.pickTier(S.raid, 'nail'); }, done: S => D.pickTier(S.raid, 'nail') !== S.tut.ap0, spot: () => Object.assign(SPOT.ammo(), { label: '弹匣 · 子弹等级' }) },
    // 3 近战场
    { z: 2, k: 'melee', title: '近战', body: () => `走近按<b>右键</b>近战。近战不用子弹，打中还给电容充电。`,
      enter(S) { S.tut.e = dummy(S, 'crawler', at(2, 8, 14), { f: 0 }); }, target: S => S.tut.e,
      done: S => { const T = S.tut, e = T.e; if (e.dead && !e.lastMelee) { T.e = dummy(S, 'crawler', at(2, 8, 14), { f: 0 }); K.text(S, S.player.x, S.player.y - 30, 'MELEE', D.UIC.hi); } return T.e.dead && T.e.lastMelee; } },
    { z: 2, k: 'heavy', title: '蓄力重击', lin: '铲子不是用来挖坑的。好吧，也是。',
      body: () => `<b>按住右键</b>，人身上那圈蓄满了再<b>松开</b>，是重击。每把近战的重击都不一样：工兵铲往前铲出一道冲击波，一条线上的敌人都挨。`,
      enter(S) { const T = S.tut; T.h0 = S.raid.heavies || 0; T.list = [13, 16].map(dx => dummy(S, 'crawler', at(2, dx, 14), { f: 0, hp: 40 })); }, target: S => S.tut.list.find(e => !e.dead),
      done: S => { const T = S.tut, hv = (S.raid.heavies || 0) > T.h0; if (!hv && T.list.every(e => e.dead)) { T.list = [13, 16].map(dx => dummy(S, 'crawler', at(2, dx, 14), { f: 0, hp: 40 })); K.text(S, S.player.x, S.player.y - 30, 'HEAVY', D.UIC.hi); } return hv && T.list.every(e => e.dead); } },
    { z: 2, k: 'parry', title: '打掉子弹', lin: '那台发射器打得很慢。慢到你能用铲子拍回去。',
      body: () => `发射器会朝你打慢速光弹。看准了<b>右键</b>近战，光弹会朝准星弹回去。弹回 3 发。（装上"弹反"被动，弹回去的子弹伤害 ×2，还会拐弯追敌人）`,
      enter(S) { const T = S.tut; T.pr0 = T.parry || 0; T.ft = 1.5; T.e = dummy(S, 'turret', at(2, 22, 14), { f: 0 }); },
      tick(S, dt) { const T = S.tut, e = T.e, p = S.player; if (!live(S, e) || S.f !== 0) return; T.ft -= dt; if (T.ft <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < 260) { T.ft = 1.4; K.eshot(S, e.x, e.y - 8, Math.atan2(p.y - 6 - (e.y - 8), p.x - e.x), 75, 3, '#ff9a3a'); sfx('orb'); } },
      leave(S) { const e = S.tut.e; if (live(S, e)) { e.dead = true; for (let i = 0; i < 16; i++) K.part(S, 'spark', e.x, e.y - 6, S.rng.range(-80, 80), S.rng.range(-90, 10), 0.4, '#ff9a3a'); } },
      target: S => S.tut.e, done: S => (S.tut.parry || 0) - S.tut.pr0 >= 3, prog: S => Math.min(3, (S.tut.parry || 0) - S.tut.pr0) + ' / 3' },
    { z: 2, k: 'sneak', title: '背刺', lin: '那只在打盹。别吵醒它。',
      body: () => `头上没有 <b>?</b> 也没有 <b>!</b> 的敌人还没发现你。近战打还没发现你的敌人是<b>背刺</b>，伤害 ×2.5（双匕首 ×4）。走过去，一铲。`,
      enter(S) { const T = S.tut; T.e = dummy(S, 'crawler', at(2, 12, 11), { f: 0, aware: false, hp: 30 }); T.wa = false; }, target: S => S.tut.e,
      tick(S) { const T = S.tut; if (live(S, T.e)) T.wa = T.e.aware; },
      done: S => { const T = S.tut, e = T.e; if (e.dead && (!e.lastMelee || T.wa)) { T.e = dummy(S, 'crawler', at(2, 12, 11), { f: 0, aware: false, hp: 30 }); T.wa = false; K.text(S, S.player.x, S.player.y - 30, 'SNEAK', D.UIC.hi); } return T.e.dead && T.e.lastMelee && !T.wa; } },
    { z: 2, k: 'exec', title: '处决', body: () => `敌人耐久不到两成（血条快空了），近战一下直接<b>处决</b>，不管它还剩多少。这只很硬，但只剩一点血：用近战。首领不吃背刺和处决。`,
      enter(S) { S.tut.e = dummy(S, 'crawler', at(2, 16, 15), { f: 0, hp: 140, hpK: 0.18 }); }, target: S => S.tut.e,
      done: S => { const T = S.tut, e = T.e; if (e.dead && !e.lastMelee) { T.e = dummy(S, 'crawler', at(2, 16, 15), { f: 0, hp: 140, hpK: 0.18 }); K.text(S, S.player.x, S.player.y - 30, 'EXECUTE', D.UIC.hi); } return T.e.dead && T.e.lastMelee; } },
    { z: 2, k: 'cap', title: '电容', lin: '左下那条青的是电容。攒满了，给你一匣好东西。',
      body: () => `近战每打中一下充一点，开枪打中、击毁、完美闪避也充（训练场里充得快些）。打沙袋把<b>电容</b>充满，按 ${kk('charge')} 释放：弹匣一下补满，整匣都是<b>超级弹</b>（青色、穿透、更疼）。`,
      enter(S) { S.tut.e = dummy(S, 'crawler', at(2, 20, 14), { f: 0, hp: 9999 }); }, target: S => S.tut.e,
      leave(S) { const e = S.tut.e; if (live(S, e)) { e.dead = true; for (let i = 0; i < 16; i++) K.part(S, 'spark', e.x, e.y - 4, S.rng.range(-80, 80), S.rng.range(-90, 10), 0.4, P.c); } },
      done: S => S.raid.sup > 0, spot: () => Object.assign(SPOT.cap(), { label: '电容' }) },
    // 4 闪避场
    { z: 3, k: 'dodge', title: '看预兆，闪开', body: () => `敌人开火前都有预兆：哨兵的枪口会闪、头上有倒计时条。看准了按 ${kk('dash')} 闪开。至少闪一次，然后打掉它。挨打时人身边有一道红弧，指着打你的方向。`,
      enter(S) { const T = S.tut; T.dn = 0; T.e = dummy(S, 'drone', at(3, 16, 13), { f: 0, active: true }); }, target: S => S.tut.e,
      done: S => { const T = S.tut; if (T.e.dead && !T.dn) { T.e = dummy(S, 'drone', at(3, 16, 13), { f: 0, active: true }); K.text(S, S.player.x, S.player.y - 30, 'DODGE', D.UIC.hi); } return T.e.dead && T.dn > 0; } },
    { z: 3, k: 'perfect', title: '完美闪避', lin: '长眼的眼睛越来越亮，亮到最满就开枪。就在那一下闪。',
      body: () => `在攻击打到你的<b>那一瞬间</b>闪避，是完美闪避：慢动作，闪避冷却清零，电容也充一点。长眼蓄力很慢、开枪前一瞬间锁定方向——等它最亮的时候闪。做到一次，或者干脆打掉它。`,
      enter(S) { const T = S.tut; T.pf0 = S.raid.perfect || 0; T.e = dummy(S, 'sniper', at(3, 22, 12), { f: 0, active: true }); }, target: S => S.tut.e,
      done: S => (S.raid.perfect || 0) > S.tut.pf0 || S.tut.e.dead,
      leave(S) { const e = S.tut.e; if (live(S, e)) { e.dead = true; for (let i = 0; i < 16; i++) K.part(S, 'spark', e.x, e.y - 6, S.rng.range(-80, 80), S.rng.range(-90, 10), 0.4, P.c); } } },
    { z: 3, k: 'bomber', title: '自爆蜂', body: () => `自爆蜂会直直冲过来，贴近了滴滴几声就炸。趁它还远就打爆它；来不及就闪开。被你提前打爆，它会把旁边的机器一起炸了。`,
      enter(S) { S.tut.e = dummy(S, 'bomber', at(3, 24, 15), { f: 0, active: true }); }, target: S => S.tut.e, done: S => S.tut.e.dead },
    // 5 装备场
    { z: 4, k: 'mods', title: '模块 Q / E', lin: '给你装了两块模块：护盾和电弧。用一次你就知道值不值。',
      body: () => `按 ${kk('q')} 用左边的模块（护盾：多一层 18 点护盾），按 ${kk('e')} 用右边的（电弧：电最近的敌人，再跳两下）。用完有冷却，格子上的暗块是冷却。各用一次。`,
      enter(S) { const T = S.tut; T.uq = T.ue = false; T.list = [13, 15].map(y => dummy(S, 'crawler', at(4, 12, y), { f: 0 })); }, target: S => S.tut.list.find(e => !e.dead),
      tick(S) { const T = S.tut, p = S.player; if (p.modCd.q > 0.2) T.uq = true; if (p.modCd.e > 0.2) T.ue = true; },
      leave(S) { for (const e of S.tut.list) if (live(S, e)) e.dead = true; },
      done: S => S.tut.uq && S.tut.ue, spot: () => ({ sel: '.mods .mod[data-k]', label: '模块 Q / E' }) },
    { z: 4, k: 'skill', title: '型号技能', body: () => `按 ${kk('skill')} 放型号技能。每种型号一个：工壳是<b>扫描</b>，8 秒内看得见每个容器里最好东西的品质，小地图标出所有敌人。机库里还有五种型号，各有各的技能和特性。`,
      done: S => S.player.skillCd > 0.2, spot: () => ({ sel: '.mods .mod.skill', label: '型号技能' }) },
    { z: 4, k: 'nade', title: '手雷', lin: '一窝锈螨。别一只只点，浪费子弹。',
      body: () => `按 ${kk('nade')} 把手雷扔向准星（最远 130，碰墙落在墙前）。<b>按住 ${D.keyLabel(D.key('nade'))} 滚动滚轮</b>换种类：高爆炸一片，冰冻让敌人慢下来，电磁让机器瘫痪。炸掉这一窝。`,
      enter(S) { S.tut.list = [[17, 13], [18, 14], [17, 15], [19, 15], [19, 13]].map(([dx, y]) => dummy(S, 'mite', at(4, dx, y), { f: 0 })); }, target: S => S.tut.list.find(e => !e.dead),
      tick(S) { const R = S.raid; if (!['frag', 'freeze', 'emp'].some(k => bagHas(R, 'use:' + k))) giveIfOut(S, 'use:frag', 1); },
      done: S => S.tut.list.every(e => e.dead), spot: () => ({ sel: '.mods .mod.use[data-use=nade]', label: '手雷' }) },
    { z: 4, k: 'heal', title: '回血', body: () => `耐久掉了。按 ${kk('heal')} 用维修包：读条 1.5 秒，读条时走得慢，<b>挨打会打断</b>（药退回背包）。快速贴片读条短、回得少。按 ${kk('shieldUse')} 用护盾电池。按住快捷键滚动滚轮能换成同类的别的药。`,
      enter(S) { const p = S.player; p.hp = Math.min(p.hp, Math.round(p.maxHp * 0.45)); S.tut.hp0 = p.hp; }, tick(S) { giveIfOut(S, 'use:medkit', 1); },
      done: S => S.player.hp > S.tut.hp0 + 5 || S.player.hp >= S.player.maxHp, spot: () => ({ sel: '.mods .mod.use[data-use=heal], .mods .mod.use[data-use=cell]', label: '用药 · 护盾电池' }) },
    // 6 搜刮区
    { z: 5, k: 'search', title: '搜容器', body: () => `走到工具箱旁按 ${kk('interact')} 搜。东西一件件揭开，<b>越稀有越慢、颜色越亮</b>；好东西快揭开时格子会提前泛出品质色。<b>单击</b>把东西放进背包。`,
      enter(S) { const T = S.tut; T.c = contAt(S, 'toolbox', at(5, 6, 11), ['watch']); T.c0 = T.c.items.length; }, target: S => S.tut.c,
      done: S => S.tut.c.opened && S.tut.c.items.length < S.tut.c0, spot: S => S.lootOpen && S.lootOpen.items ? { sel: '.panel-slot .inv', label: '搜刮面板：左边箱子，右边背包' } : null },
    { z: 5, k: 'ground', title: '地上的东西', body: () => `地上散落的、敌人掉的东西不用搜：走近会弹出<b>拾取框</b>，按 ${kk('interact')} 全拿，或单击拿一件。弹药堆走过去就自动捡。设置里能开"自动捡某品质以上"。`,
      enter(S) { if (S.lootOpen) D.UI.closePanel(S); S.tut.g = groundAt(S, at(5, 11, 15), [['use:patch', 1], ['scope', 1], ['ammo:nail:2', 20]]); }, target: S => S.tut.g.find(g => g.n > 0),
      done: S => S.tut.g.every(g => g.n <= 0), spot: S => S.groundNear.length ? { sel: '.groundp', label: '拾取框' } : null },
    { z: 5, k: 'bag', title: '背包和保险箱', lin: '保险箱是你自己的。工壳没了，那两格还在。',
      body: () => `按 ${kk('bag')} 打开背包。东西有形状，拖动时右键能转。<b>单击</b>背包里的东西放进<b>保险箱</b>（死了也不丢）；拖到格子外面是丢掉（丢了就捡不回来）。枪、近战卡单击就直接换上。放一件进保险箱。`,
      enter(S) { S.tut.s0 = S.raid.safe.items.length; }, done: S => S.raid.safe.items.length > S.tut.s0,
      spot: S => S.lootOpen && S.lootOpen.inv ? { sel: '.panel-slot .inv', label: '背包 · 保险箱 · 门禁卡包' } : null },
    { z: 5, k: 'swap', title: '换枪', body: () => `地上那把是狙击步枪。点按 ${kk('interact')} 只是捡进背包，<b>长按 ${D.keyLabel(D.key('interact'))}</b> 直接换上；换下来的钉枪放回背包，弹匣里的子弹也退回背包。`,
      enter(S) { if (S.lootOpen) D.UI.closePanel(S); const g = groundAt(S, at(5, 16, 13), [['card:sniper', 1]]); S.tut.g = g; giveIfOut(S, 'ammo:rifle:1', 20); },
      target: S => S.tut.g.find(g => g.n > 0) || null, done: S => S.raid.load.gun === 'sniper' },
    { z: 5, k: 'scope', title: '开镜', lin: '远处那只长眼睡着了。别走过去，从这儿打。',
      body: () => `狙击类按住<b>右键</b>是开镜（点按还是近战）：准星收紧，镜头往前看得更远，走得慢。满镜第一枪伤害 ×1.5。开镜打掉远处那只长眼。`,
      enter(S) { S.tut.e = dummy(S, 'sniper', at(5, 32, 12), { f: 0, hp: 34 }); giveIfOut(S, 'ammo:rifle:1', 20); }, target: S => S.tut.e, done: S => S.tut.e.dead },
    { z: 5, k: 'locked', title: '门禁柜', body: () => `那个门禁柜锁着，要刷一张<b>门禁卡</b>（任何等级都行，蛛网型号能直接破解）。地上有两张绿卡，捡起来，走到柜子前按 ${kk('interact')}。城里捡到的卡会自动收进门禁卡包，死了也不丢。`,
      enter(S) { const T = S.tut; T.c = contAt(S, 'lockbox', at(5, 21, 11)); T.c.locked = true; T.g = groundAt(S, at(5, 19, 15), [['key1', 1], ['key1', 1]]); },
      tick(S) { const T = S.tut; if (T.c.locked && !D.hasKey(S.raid, 1) && T.g.every(g => g.n <= 0)) giveIfOut(S, 'key1', 1); },
      target: S => (D.hasKey(S.raid, 1) ? null : S.tut.g.find(g => g.n > 0)) || S.tut.c, done: S => !S.tut.c.locked },
    { z: 5, k: 'vault', title: '门禁房', body: () => `下面那扇门亮着绿灯：<b>门禁房</b>，只能刷够等级的卡开（打不坏，高级卡能开低级门）。刷开它走进去——里面是金库，<b>高价值区域</b>：真站里守卫多，容器只出值钱的东西。`,
      enter(S) { const T = S.tut, H = D.TUT_HALL; T.br = S.floors[0].breakables.find(b => b.tut === 'vault'); T.vc = contAt(S, 'vault', { x: (H.vault.x + 5) * TS + 8, y: (H.vault.y + 2) * TS + 12 }); },
      tick(S) { const T = S.tut; if (!T.br.open && !D.hasKey(S.raid, 1)) giveIfOut(S, 'key1', 1); },
      target: S => S.tut.br.open ? S.tut.vc : S.tut.br, done: S => S.tut.br.open && S.f === 0 && roomAt(S, S.player.x, S.player.y) === S.tut.br.room },
    { z: 5, k: 'crack', title: '裂缝墙', lin: '上面那面墙后头是空的，我听得出来。',
      body: () => `走近了墙上会冒出细细的光：<b>裂缝墙</b>，后面是隐藏房间。开枪或近战把墙打破。隐藏房间里的东西品质更高。`,
      enter(S) { const T = S.tut, H = D.TUT_HALL; T.br = S.floors[0].breakables.find(b => b.tut === 'crack'); T.br.seen = true; contAt(S, 'safe', { x: (H.hidden.x + 5) * TS + 8, y: (H.hidden.y + 2) * TS + 12 }); },
      target: S => S.tut.br, done: S => S.tut.br.open },
    // 7 实战区
    { z: 6, k: 'sense', title: '敌人怎么发现你', lin: '前面这几台是活的，没电晕。它们还没看见你。',
      body: () => `敌人平时在闲逛。看见你一会儿，头上冒 <b>?</b>（起疑）；再看一会儿冒 <b>!</b>，就开打，还会叫醒附近的同伴。听到枪声的会走过来看看。没发现你的敌人不会朝你开枪——先摸过去背刺一只。右上小地图上红点是发现你的敌人。`,
      enter(S) { const T = S.tut; T.list = [[12, 12, 'crawler'], [16, 16, 'crawler'], [24, 13, 'drone']].map(([dx, y, k]) => dummy(S, k, at(6, dx, y), { f: 0, aware: false, active: true, roam: 70, roamH: 40 })); },
      target: S => S.tut.list.find(e => !e.dead), done: S => S.tut.list.some(e => e.dead || e.aware), spot: () => Object.assign(SPOT.map(), { label: '小地图' }) },
    { z: 6, k: 'brawl', title: '混战', lin: '好，全醒了。先打那只修东西的小飞机。',
      body: () => `<b>维修蜂</b>会给同伴回血、套护盾，先打它。<b>迫击炮台</b>把炮弹抛到你脚下，落点有圈，看到圈就走开。三台以上一起醒着，它们会分头从侧面绕。全部打掉。`,
      enter(S) { const T = S.tut; for (const e of T.list) if (live(S, e) && !e.aware) K.becomeAware(S, e); T.list.push(dummy(S, 'medic', at(6, 28, 14), { f: 0, active: true }), dummy(S, 'turret', at(6, 33, 12), { f: 0, active: true })); },
      tick(S) { giveIfOut(S, 'use:medkit', 1); }, target: S => S.tut.list.find(e => !e.dead), done: S => S.tut.list.every(e => e.dead) },
    // 8 下站台
    { z: 7, k: 'stairs', title: '换层', body: () => `每个站有两三层：站厅、站台、换乘层，还有设备层、检修管道。走到楼梯口按 ${kk('interact')} 下到站台层。小地图右上角的小方块是楼层，亮的是你在的那层。`,
      target: S => S.f === 0 ? S.floors[0].stairs[0] : null, done: S => S.f === 1, spot: () => Object.assign(SPOT.mapFloors(), { label: '楼层' }) },
    // 站台
    { z: 8, k: 'train', title: '班车', lin: '来了一班车。训练场的车不载人，看看就行。',
      body: () => `每个站都只能<b>坐车离开</b>：隧道是塌的。顶上是<b>下一班车</b>的倒计时；车进站停 16 秒，走到站台下沿站一下就上车，去下一站；错过了 45 秒后再来一班。`,
      enter(S) { S.sched = { st: 'wait', t: 0, wait: 6, n: 0, board: 0 }; },
      tick(S) { const X = S.sched; if (!X) return; X.board = 0; if (X.st === 'dwell') S.prompt = { key: '', text: '训练场的车不载人：正式行动里走到站台下沿就上车' }; },
      done: S => !S.sched || (S.sched.st === 'dwell' && S.sched.t > 3),
      leave(S) { const X = S.sched; if (X && X.st === 'dwell') { X.st = 'depart'; X.t = 0; } }, spot: () => ({ sel: '.sched', label: '下一班车' }) },
    { z: 8, k: 'risk', title: '警戒和威胁', info: true, lin: '最后一件事：你在城里越贪，城就越想留下你。',
      body: () => `顶上一条：背包里的东西值多少、<b>警戒</b>和<b>威胁等级</b>。每进一站警戒 +1，在有敌人的站里待久了、开枪也会涨；每 4 点警戒威胁升一级，敌人更多更疼，撤离战更长。背得越值钱，撤离战越难，还可能引来钳工-9。`,
      tick(S) { if (S.sched && S.sched.st === 'wait') S.sched = null; }, spot: () => ({ sel: '.raidbar', label: '背包价值 · 警戒 · 威胁' }) },
    { z: 8, k: 'extract', title: '撤离', body: () => `只有撤出去的东西才算数。这里是撤离站（线路的尽头站才能撤，入口站不能撤）：走到站台中间的绿色控制台按 ${kk('interact')}，呼叫接驳车。`,
      tick(S) { if (S.sched && S.sched.st === 'wait') S.sched = null; }, target: S => S.console, done: S => !!S.extract },
    { z: 8, k: 'hold', title: '守住、登车', body: () => `<b>撤离战</b>：敌人从两头隧道冲出来，守到倒计时走完。车来了走到站台下沿就上车；车到了不上车，追兵一波比一波多。正式行动里工壳损毁，背包和装上的东西都会丢——训练场里不会。`,
      done: S => S.over === 'extracted' },
  ];
  // 每一步顶上林桥说一句：剧情脚本"教学"一节有的用那句（编号 T01…，开发模式下前面带编号），没有的用 lin
  // text 是显示用的（拼好的 HTML，英文按整段句式翻），不当数据表扫：enumerable: false
  for (const st of STEPS) Object.defineProperty(st, 'text', { enumerable: false, get() {
    const L = D.Cues && D.Cues.tutLine(st.k), lin = L ? D.Cues.tag(L.code) + (D.Dlg ? D.Dlg.plain(L.t) : L.t) : st.lin;
    return (lin ? `<div class="tp-lin"><i class="tp-who">林桥</i>${lin}</div>` : '') + `<div class="tp-b">${st.body()}</div>`; // 正文单独一块：英文按整段句式翻（i18n-en-tut.js）
  } });
  D.TUT_STEPS = STEPS;
  D.TUT_ZONE_NAMES = () => ZN().map(z => z.name).concat(['站台']);

  // 一些"做到了没有"要从别的模块挂钩子数：打掉子弹；闸门画在近战刀光那一层（世界坐标）
  let hooked = false;
  function hook() {
    if (hooked) return; hooked = true;
    const mp0 = K.meleeParry; K.meleeParry = function (S) { if (S.tut) S.tut.parry = (S.tut.parry || 0) + 1; if (mp0) return mp0.apply(this, arguments); };
    const md0 = K.meleeDraw; K.meleeDraw = function (S, ctx, ex) { if (md0) md0.apply(this, arguments); if (S.tut && S.f === 0) drawGates(S, ctx, ex); };
  }

  D.enterTutorial = function (R) {
    hook();
    const S = D.enterStation(R, D.TUT_STATION, 0, { tut: true });
    S.tut = { i: -1, t: 0, wait: 0, mine: [] };
    // 从训练长厅（楼层 0）最左边开始
    S.f = 0; S.A = S.floors[0]; S.floor = S.fxs[0].c; S.fx = S.fxs[0].x;
    const p = S.player, q = at(0, 9, 14); p.x = q.x; p.y = q.y; // 别站在左上的教学面板后面
    if (K.resetMotes) K.resetMotes(S);
    S.cam.x = 0; S.cam.y = D.clamp(p.y + 10 - 90, -4, Math.max(0, S.A.h - 180 + 20));
    if (K.markRoom) K.markRoom(S);
    S.banner = { t: 0, text: '南栈训练场', sub: '林桥在通话里 · 不会损毁 · 回车跳过一区 · Esc 跳过教学', keep: true };
    next(S);
    return S;
  };
  function next(S, noLeave) {
    const T = S.tut, old = STEPS[T.i]; if (old && old.leave && !noLeave) old.leave(S);
    if (old && STEPS[T.i + 1] && STEPS[T.i + 1].z !== old.z) zoneDone(S, old.z);
    T.i++; T.t = 0; T.wait = 0; T.ent = T.i; const st = STEPS[T.i];
    if (st) { if (st.enter) st.enter(S); sfx('hint'); }
  }
  // 一区做完：闸门打开，横幅报下一区
  function zoneDone(S, zi) {
    if (D.tutGateOpen && D.tutGateOpen(S, zi)) sfx('power');
    const nm = D.TUT_ZONE_NAMES()[zi + 1]; if (nm) S.banner = { t: 0, text: '闸门打开', sub: '下一区：' + nm };
  }
  // 回车：跳过当前区（这一区剩下的步都算跳过，闸门打开，人送到下一区门口）
  function skipZone(S) {
    const T = S.tut, st = STEPS[T.i]; if (!st) return;
    const z = st.z, ext = STEPS.findIndex(s => s.k === 'extract');
    if (z === 8 && T.i >= ext) return; // 呼叫和撤离战不能跳（Esc 能跳过整段）
    if (st.leave) st.leave(S);
    for (const e of T.mine) if (live(S, e)) e.dead = true;
    T.mine = [];
    if (S.lootOpen) D.UI.closePanel(S);
    let j = T.i; while (STEPS[j + 1] && STEPS[j + 1].z === z) j++;
    if (z === 8) j = ext - 1;
    T.i = j; next(S, true);
    const p = S.player, nz = ZN()[z + 1];
    if (z === 7 && S.f === 0 && K.goFloor) K.goFloor(S, 1, { from: 0, dir: 'down' }); // 跳过下站台：直接送到站台层
    else if (S.f === 0 && nz && p.x < nz.x0 * TS) { p.x = nz.x0 * TS + 24; p.y = 14 * TS + 8; p.vx = p.vy = 0; S.cam.x = D.clamp(p.x - 160, 0, S.A.w - 320); }
    K.text(S, p.x, p.y - 34, 'SKIP', D.UIC.hi, true); sfx('click');
  }
  D.tutSkipZone = S => S && S.tut && skipZone(S);
  D.tutStep = function (S, dt) {
    const T = S.tut; if (!T || T.i >= STEPS.length) return;
    T.t += dt;
    const st = STEPS[T.i], p = S.player;
    if (T.ent !== T.i && T.wait <= 0) { T.ent = T.i; if (st.enter) st.enter(S); } // 被直接跳到这一步（测试、调试）：先把这一步要的东西摆上
    // 闪避次数、换弹（好几步都用）
    if (p.dashT > 0 && !T.dashing) T.dn = (T.dn || 0) + 1; T.dashing = p.dashT > 0;
    if (p.reload > 0) T.rl = true;
    { const R = S.raid, gun = D.gunId(R) && D.CARDS[D.gunId(R)].gun; // 训练场的子弹不要钱：手上这把打空了、背包里也没了就补一包
      if (gun && p.mag === 0 && !(p.reload > 0) && !D.pickTier(R, gun.cal) && D.Grid.add(R.bag, 'ammo:' + gun.cal + ':1', gun.mag * 3) < gun.mag * 3) K.text(S, p.x, p.y - 30, 'AMMO', D.UIC.hi); }
    if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0) next(S); return; }
    if (st && st.tick) st.tick(S, dt);
    if (D.Input && D.Input.hit('Enter') && !S.over && !(S.lootOpen && S.lootOpen.trade)) { skipZone(S); return; }
    const ok = st.info ? T.t > 0.8 && pressedF() : T.t > 0.4 && st.done(S);
    if (ok) { T.wait = T.i === STEPS.length - 1 ? 99 : st.info ? 0.15 : 0.9; sfx('pick'); if (!st.info) K.text(S, p.x, p.y - 34, 'OK', P.g, true); }
  };
  D.tutAllows = (S, k) => !S.tut || STEPS.findIndex(s => s.k === k) <= S.tut.i;
  D.tutTarget = S => { const T = S.tut; if (!T || T.wait > 0) return null; const st = STEPS[T.i]; return st && st.target ? st.target(S) : null; };
  D.tutSpot = S => { const T = S.tut; if (!T || T.wait > 0 || S.over || S.banner && S.banner.t < 0.6 && T.t < 0.6) return null; const st = STEPS[T.i]; return st && st.spot ? st.spot(S) : null; };
  // 面板要的东西：第几区、区里第几步
  D.tutInfo = S => {
    const T = S.tut, st = STEPS[T.i]; if (!st) return null;
    const inZone = STEPS.filter(s => s.z === st.z), j = inZone.indexOf(st);
    return { st, zone: st.z, zoneName: D.TUT_ZONE_NAMES()[st.z], zones: D.TUT_ZONE_NAMES().length, j, n: inZone.length, prog: st.prog ? st.prog(S) : '', canSkip: !(st.z === 8 && T.i >= STEPS.findIndex(s => s.k === 'extract')) };
  };

  // ── 画：闸门（世界坐标，光效）、区名灯牌和目标箭头（屏幕坐标）
  function drawGates(S, ctx, ex) {
    const F = S.floors[0], time = S.t;
    for (const g of F.gates || []) {
      const fade = g.open ? 1 - (time - g.openT) / 0.45 : 1; if (fade <= 0) continue;
      const x = g.tx * TS, y0 = g.y0, h = g.y1 - g.y0;
      ctx.fillStyle = D.rgba('#0e3a4a', 0.45 * fade); ctx.fillRect(x + 2, y0, 12, h);
      for (let k = 0; k < 3; k++) { const fl = 0.55 + 0.35 * Math.sin(time * 9 + k * 2.1 + g.tx); ex.fillStyle = D.rgba(k === 1 ? '#c8f8ff' : '#3ee8ff', fl * fade); ex.fillRect(x + 4 + k * 4, y0, 1, h); }
      const sy = y0 + ((time * 40 + g.tx * 7) % h); ex.fillStyle = D.rgba('#ffffff', 0.5 * fade); ex.fillRect(x + 2, sy, 12, 1);
      for (const yy of [y0, y0 + h - 2]) { ex.fillStyle = D.rgba('#3ee8ff', 0.9 * fade); ex.fillRect(x + 1, yy, 14, 2); }
    }
  }
  D.drawTutArrow = function (ctx, S, time, cx, cy) {
    const W = D.W, H = D.H, Z = D.Z;
    // 区名牌：每区正中、走廊下沿的地上（像素字体，画布上的中文要用 D.PXF；放左边会被教学面板挡住）
    if (S.f === 0 && D.TUT_ZONES) { ctx.font = D.PXF; ctx.textAlign = 'left'; ZN().forEach((z, i) => {
      const lw = ctx.measureText(String(i + 1).padStart(2, '0') + '  ' + z.name).width + 14, x = ((z.x0 + z.x1 + 1) / 2 * TS - cx) * Z - lw / 2, y = ((D.TUT_HALL.Y1 + 0.35) * TS - cy) * Z; if (x < -200 || x > W + 20 || y < -20 || y > H) return;
      const T = S.tut, zc = T && STEPS[T.i] ? STEPS[T.i].z : 0, cur = zc === i, done = zc > i;
      const label = String(i + 1).padStart(2, '0') + '  ' + z.name, w = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(8,9,18,0.8)'; ctx.fillRect(x, y, w, 18);
      ctx.fillStyle = cur ? D.UIC.a : done ? '#3dd66a' : '#4a5374'; ctx.fillRect(x, y, 3, 18);
      ctx.fillStyle = cur ? D.UIC.hi : done ? '#8de8a0' : '#8a92b0'; ctx.fillText(label, x + 9, y + 13);
    }); }
    const o = D.tutTarget(S); if (!o || (o.f != null && o.f !== S.f) || o.dead) return;
    // 目标标记：橙色（和聚光灯同色，跟蓝色界面区分开），大箭头 + 地上一圈往外扩的圈；目标在画面外时屏幕边上一个大箭头指过去，绕开左上角的教学面板
    const gx = (o.x - cx) * Z, gy = (o.y - cy) * Z, x = gx, y = (o.y - 22 - cy) * Z, bob = Math.sin(time * 6) * 4;
    const ORG = '#ffb057', HI = '#fff1d6', col = (time * 4 | 0) % 2 ? HI : ORG;
    const tri = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]); ctx.closePath(); ctx.fill(); };
    if (x > 20 && x < W - 20 && y > 30 && y < H - 30) {
      ctx.save(); ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) { const f = (time * 0.9 + k * 0.5) % 1, r = 8 + f * 22; ctx.globalAlpha = (1 - f) * 0.9; ctx.strokeStyle = P.k; ctx.beginPath(); ctx.ellipse(gx, gy, r + 1, (r + 1) * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = ORG; ctx.beginPath(); ctx.ellipse(gx, gy, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      const ty = y - 4 + bob;
      tri([x - 12, ty - 18, x + 12, ty - 18, x, ty], P.k); // 黑边
      tri([x - 9, ty - 16, x + 9, ty - 16, x, ty - 3], col);
      tri([x - 9, ty - 16, x, ty - 16, x, ty - 3], ORG); ctx.fillStyle = HI; ctx.fillRect(x - 7, ty - 15, 5, 1); // 左半边亮、右半边暗，像素体积
      ctx.fillStyle = P.k; ctx.fillRect(x - 4, ty - 26, 8, 9); ctx.fillStyle = col; ctx.fillRect(x - 2, ty - 25, 4, 8); // 箭杆
    } else {
      const a = Math.atan2(y - H / 2, x - W / 2);
      let ex = D.clamp(W / 2 + Math.cos(a) * W, 30, W - 30), ey = D.clamp(H / 2 + Math.sin(a) * W, 44, H - 44);
      // 落进左上的教学面板、右上的小地图里就顺着屏幕边挪出来（面板是 DOM，按画布换算位置）
      const box = [], pe = document.querySelector('#ui .tutp'), cv = document.getElementById('game');
      if (pe && cv && pe.offsetParent) { const r = pe.getBoundingClientRect(), c = cv.getBoundingClientRect(), k = W / c.width; box.push([(r.left - c.left) * k, (r.top - c.top) * k, (r.right - c.left) * k, (r.bottom - c.top) * k]); }
      if (D.MINIMAP) { const M = D.MINIMAP; box.push([W - M.right - M.w, M.top, W - M.right, M.top + M.h]); }
      for (const [l0, t0, r0, b0] of box) { const l = l0 - 22, t = t0 - 22, r = r0 + 22, b = b0 + 22; if (ex <= l || ex >= r || ey <= t || ey >= b) continue;
        const onH = ey <= 44.5 || ey >= H - 44.5, onV = ex <= 30.5 || ex >= W - 30.5;
        const mx = (l > 30 && ex - l < r - ex) || r >= W - 30 ? l : r, my = (t > 44 && ey - t < b - ey) || b >= H - 44 ? t : b;
        if (onH && (!onV || Math.abs(mx - ex) < Math.abs(my - ey))) ex = mx; else ey = my; }
      const pulse = 1.3 + 0.22 * Math.abs(Math.sin(time * 5));
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.scale(pulse, pulse);
      tri([16, 0, -8, -13, -3, 0, -8, 13], P.k);
      tri([13, 0, -5, -10, -1, 0, -5, 10], col);
      tri([13, 0, -5, -10, -1, 0], ORG);
      tri([-6, 0, -16, -8, -12, 0, -16, 8], P.k); tri([-8, 0, -14, -5, -11, 0, -14, 5], ORG); // 后面再跟一小截，像在往那边走
      ctx.restore();
    }
  };

  // ── 第一次见到某个系统时的一句提示
  const HINTS = {
    exitSt: '这是撤离站：站台上的绿色控制台能呼叫接驳车回据点。不想撤，就等下一班车去下一站。',
    endSt: '这是线路尽头的撤离站：路线不能回头，这里不发普通班车。到站台上的绿色控制台呼叫接驳车回据点。',
    train: '每一站都只能坐车离开：上面写着下一班车还有多久到。车进站以后回到站台，走到站台下沿就上车。',
    lowhp: '耐久不到三成了：按 C 用维修包。工壳损毁的话，背包和装上的东西都留在城里。',
    charged: '电容满了：按 X 释放，弹匣一下补满，整匣都是超级弹（青色、穿透、伤害更高）。近战、开枪打中、击毁、完美闪避都给电容充电。',
    perfect: '完美闪避：在闪避的瞬间躲过攻击，会慢动作，闪避冷却清零，电容也充一点。',
    ground: '地上的东西不用搜：F 全拿，单击拿一件。设置里能开"自动捡药品"和"自动捡某品质以上"。',
    full: '背包快满了：Tab 打开背包，右键丢掉不要的东西（丢了就捡不回来）；值钱的放进保险箱（死了也不丢）。',
    alert: '每进一站警戒 +1：敌人更多、更疼，撤离战更长。背得越值钱，撤离战越难。',
    boss: '钳工-9：背的东西太值钱会引来它。打不过就绕着躲，车来了直接上车。',
    relay: '信号中继站：修好中继台，线路图上会揭开周围一大片站。',
    locked: '门禁柜：要刷一张门禁卡（人形敌人有时会掉）。蛛网型号能直接破解。',
    crack: '墙上有裂缝：后面是隐藏房间，开枪或近战把墙打破。',
    hv: '高价值区域：守卫多，容器只出值钱的东西。',
    trader: '商人：卖弹药和药，也收货，按原价五成收。',
    noammo: '这把枪没子弹了：B 键切换弹种；敌人掉的弹药堆走过去按 F 捡（设置里能改成自动捡）；近战不用子弹。',
    melee: '敌人残血时近战一下就能处决；打还没发现你的敌人是背刺，伤害 ×2.5。',
  };
  D.HINTS = HINTS;
  D.hint = function (S, k) {
    const pf = S.raid && S.raid.pf; if (!pf || S.tut || !HINTS[k]) return false;
    pf.hints = pf.hints || []; if (pf.hints.includes(k)) return false;
    pf.hints.push(k); S.hintMsg = { k, text: HINTS[k], t: 0 }; sfx('hint');
    return true;
  };
  D.hintCheck = function (S, dt) {
    if (S.hintMsg) { S.hintMsg.t += dt; if (S.hintMsg.t > (D.settings.lite ? 5 : 7)) S.hintMsg = null; return; }
    if (S.tut || (D.settings && D.settings.hints === false) || S.t < 2.6 || S.over) return;
    const p = S.player, R = S.raid, seen = k => (R.pf.hints || []).includes(k), A = S.A;
    const tryH = (k, c) => !seen(k) && c && D.hint(S, k);
    const ri = A.room[Math.floor(p.y / TS) * A.tw + Math.floor(p.x / TS)], room = ri >= 0 ? A.rooms[ri] : null;
    const gun = D.gunId(R) ? D.CARDS[D.gunId(R)].gun : null;
    tryH('lowhp', p.hp > 0 && p.hp < p.maxHp * 0.3) || tryH('perfect', (R.perfect || 0) > 0) || tryH('charged', p.cap >= 1)
      || tryH('boss', S.enemies.some(e => e.kind === 'boss' && !e.dead && e.f === S.f))
      || tryH('noammo', gun && p.mag === 0 && p.reload <= 0 && !D.pickTier(R, gun.cal))
      || tryH('endSt', S.sched && S.sched.st === 'end' && S.console && !S.console.used && !S.extract)
      || tryH('exitSt', S.isExit && S.console && !S.console.used && !S.extract && !(S.sched && S.sched.st === 'end')) || tryH('train', S.sched && S.sched.st !== 'end' && S.t > 5)
      || tryH('ground', S.groundNear.length > 0) || tryH('full', D.bagUsed(R) >= D.bagCap(R) - 1)
      || tryH('locked', S.near && S.near.locked) || tryH('crack', S.prompt && /裂缝/.test(S.prompt.text))
      || tryH('hv', room && room.hv) || tryH('relay', S.relay && S.relay.f === S.f && !S.relay.used)
      || tryH('trader', S.trader && S.trader.f === S.f && Math.hypot(S.trader.x - p.x, S.trader.y - p.y) < 60)
      || tryH('alert', R.stations >= 2) || tryH('melee', S.kills >= 3);
  };
})(D);
