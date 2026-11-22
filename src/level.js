/* 末班之后 · 小样二：站点关卡生成（每次进站都重新随机）
   一个站 = 站厅层 + 站台层（换乘站再多一层换乘层），楼梯上下相连。
   每层是一张大格子图：房间 + 走廊。房间按站点类型挑：售票处、商铺、保安室、医务室、仓库、维修间、配电室、控制室……
   还有一间藏在裂缝墙后面的隐藏房间，打破墙才能进。站台两头是隧道口，从那里走去下一站。
   格子类型：0 地面，1 墙，2 轨道沟，3 裂缝墙（打破前算墙）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, P = D.PAL;

  // 房间种类：名字、地面配色、摆设、容器
  const ROOMS = {
    hall:     { name: '站厅',   floor: 'theme', props: [['pillar', 3], ['bench', 3], ['vending', 2], ['kiosk', 1], ['planter', 2]], cont: [['locker', 2], ['register', 1], ['trash', 2], ['vendor', 1], ['parcel', 1]], nCont: [1, 3] },
    platform: { name: '站台',   floor: 'theme', props: [['pillar', 4], ['bench', 3], ['bin', 2], ['vending', 1]], cont: [['locker', 2], ['crate', 1], ['trash', 2], ['corpse', 1], ['vendor', 1]], nCont: [1, 3] },
    ticket:   { name: '售票处', floor: ['#2b2e44', '#2e3249'], props: [['desk', 3], ['vending', 1]], cont: [['register', 3], ['locker', 1], ['filecab', 2], ['pc', 1]], nCont: [2, 3] },
    shop:     { name: '商铺',   floor: ['#33293f', '#382c45'], props: [['shelf', 4], ['kiosk', 1], ['planter', 1]], cont: [['register', 3], ['crate', 1], ['parcel', 1], ['fridge', 1], ['vendor', 1]], nCont: [2, 3] },
    security: { name: '保安室', floor: ['#20242e', '#242833'], props: [['desk', 2], ['cabinet', 2]], cont: [['armory', 3], ['locker', 2], ['lockbox', 1], ['filecab', 1]], nCont: [2, 3] },
    medic:    { name: '医务室', floor: ['#3a4250', '#3e4656'], props: [['bed', 2], ['cabinet', 1]], cont: [['medcab', 3], ['locker', 1], ['fridge', 2]], nCont: [2, 3] },
    storage:  { name: '仓库',   floor: ['#2d3236', '#30363a'], props: [['crate', 5], ['barrel', 3], ['shelf', 2]], cont: [['crate', 4], ['toolbox', 1], ['parcel', 1], ['partsbin', 1]], nCont: [3, 5] },
    workshop: { name: '维修间', floor: ['#2a2e30', '#2e3234'], props: [['machine', 3], ['barrel', 2], ['crate', 1]], cont: [['toolbox', 3], ['crate', 1], ['partsbin', 2], ['wreck', 2]], nCont: [2, 4] },
    power:    { name: '配电室', floor: ['#1f2530', '#232a36'], props: [['cabinet', 4]], cont: [['toolbox', 2], ['locker', 1], ['partsbin', 1]], nCont: [1, 2], dim: true },
    control:  { name: '控制室', floor: ['#1d2230', '#212738'], props: [['desk', 4], ['cabinet', 1]], cont: [['safe', 1], ['locker', 1], ['pc', 2], ['filecab', 2], ['lockbox', 1]], nCont: [2, 3] },
    factory:  { name: '车间',   floor: ['#2d3034', '#303438'], props: [['machine', 5], ['barrel', 2]], cont: [['toolbox', 2], ['crate', 1], ['wreck', 2], ['partsbin', 1]], nCont: [2, 4] },
    secure:   { name: '门禁房', floor: ['#1f2630', '#232b36'], props: [['cabinet', 2], ['crate', 1]], cont: [['safe', 2], ['armory', 2], ['filecab', 1], ['gunrack', 1], ['showcase', 1]], nCont: [3, 4], bonus: 1, lamp: '#7fd8ff' },
    hidden:   { name: '隐藏房间', floor: ['#2a2220', '#2e2522'], props: [['crate', 2], ['barrel', 1]], cont: [['safe', 2], ['crate', 1], ['lockbox', 1], ['corpse', 1]], nCont: [2, 3], bonus: 1, dim: true },
    // 高价值区域：守卫多，容器只出值钱东西，地上也散着好货
    vault:    { name: '金库',   floor: ['#3a3020', '#40351f'], props: [['cabinet', 2], ['crate', 1]], cont: [['vault', 3], ['safe', 1]], nCont: [2, 3], bonus: 1, hv: true, loose: [2, 3], lamp: '#ffd27a' },
    server:   { name: '机房',   floor: ['#18233a', '#1b2742'], props: [['machine', 4], ['cabinet', 2]], cont: [['rack', 3], ['safe', 1], ['pc', 1]], nCont: [2, 3], bonus: 1, hv: true, loose: [1, 2], lamp: '#3ee8ff' },
    jewelry:  { name: '珠宝店', floor: ['#3a2440', '#422848'], props: [['kiosk', 2], ['planter', 2]], cont: [['showcase', 3], ['register', 1]], nCont: [2, 3], bonus: 1, hv: true, loose: [1, 2], lamp: '#ff9be0' },
    gallery:  { name: '藏品室', floor: ['#33281f', '#3a2d22'], props: [['planter', 2], ['bench', 2]], cont: [['showcase', 2], ['safe', 1]], nCont: [2, 3], bonus: 1, hv: true, loose: [1, 3], lamp: '#ffe0a0' },
    arsenal:  { name: '枪械库', floor: ['#262a22', '#2a2f25'], props: [['crate', 3], ['cabinet', 2]], cont: [['gunrack', 2], ['armory', 2], ['lockbox', 1]], nCont: [2, 4], lamp: '#ffb057' },
    // 人类据点（小镇）的房间：布局在 outpost-town.js，手工摆，不走下面的随机生成
    canteen:  { name: '食堂',   floor: ['#3b2f22', '#3f3226'], props: [['bench', 3], ['kiosk', 1], ['barrel', 2], ['planter', 1]], cont: [['fridge', 1], ['register', 1], ['trash', 1], ['crate', 1]], nCont: [1, 2], lamp: '#ffd08a' },
    tents:    { name: '帐篷区', floor: ['#2e3a36', '#33413c'], props: [['bed', 3], ['bin', 1], ['crate', 1]], cont: [['locker', 2], ['crate', 1], ['parcel', 1]], nCont: [2, 3], lamp: '#9ee6c0' },
    barter:   { name: '换物摊', floor: ['#3b3046', '#41364f'], props: [['shelf', 3], ['kiosk', 1], ['planter', 1]], cont: [['register', 2], ['crate', 1], ['parcel', 1]], nCont: [2, 3], lamp: '#ffb0e0' },
    fixshop:  { name: '修械铺', floor: ['#2a2e30', '#2e3234'], props: [['machine', 2], ['barrel', 2], ['crate', 1]], cont: [['toolbox', 2], ['partsbin', 2], ['crate', 1]], nCont: [2, 3], lamp: '#ffb057' },
    nursery:  { name: '托儿角', floor: ['#3a3a2c', '#3f3f30'], props: [['planter', 2], ['bench', 1], ['bin', 1]], cont: [['parcel', 2], ['crate', 1]], nCont: [1, 2], lamp: '#ffe27a' },
    radio:    { name: '广播室', floor: ['#1f2530', '#232a36'], props: [['desk', 2], ['cabinet', 2]], cont: [['pc', 1], ['filecab', 2], ['safe', 1]], nCont: [2, 3], lamp: '#3ee8ff' },
    gatehouse: { name: '门卫岗', floor: ['#20242e', '#242833'], props: [['desk', 1], ['cabinet', 2], ['bin', 1]], cont: [['armory', 2], ['locker', 2]], nCont: [2, 3], lamp: '#ffb057' },
  };
  const HV_ROOMS = ['vault', 'server', 'jewelry', 'gallery'];
  D.ROOMS = ROOMS;
  const ROOM_POOL = {
    ruin: [['storage', 3], ['ticket', 2], ['power', 2], ['medic', 1], ['security', 1]],
    market: [['shop', 5], ['ticket', 2], ['storage', 2], ['security', 1], ['medic', 1]],
    hangar: [['workshop', 4], ['storage', 3], ['security', 2], ['power', 1], ['control', 1]],
    factory: [['factory', 5], ['workshop', 2], ['power', 2], ['control', 1], ['storage', 1]],
    depot: [['workshop', 3], ['factory', 2], ['security', 2], ['control', 2], ['storage', 2]],
    outpost: [['shop', 3], ['medic', 2], ['storage', 2], ['ticket', 1]], // 人类据点不走这里（outpost-town.js 手工布局），留着给南栈之类的兜底
    cache: [['storage', 4], ['security', 3], ['control', 2], ['hidden', 1]],
    refuge: [['shop', 2], ['medic', 2], ['storage', 3]],
    blackmarket: [['shop', 4], ['storage', 2], ['security', 1]],
    hospital: [['medic', 6], ['storage', 2], ['power', 1]],
    nest: [['storage', 3], ['power', 2], ['workshop', 2]],
    relay: [['control', 3], ['power', 3], ['workshop', 1]],
    armory: [['arsenal', 4], ['security', 3], ['storage', 1]],
    museum: [['gallery', 3], ['shop', 2], ['ticket', 2], ['security', 1]],
    checkpoint: [['security', 4], ['control', 2], ['arsenal', 1]],
    datacenter: [['server', 4], ['power', 2], ['control', 2]],
    bank: [['vault', 3], ['security', 3], ['control', 2], ['ticket', 1]],
  };
  // 每种站必有的高价值区域；其余危险站按概率给一间
  D.ROOM_POOL = ROOM_POOL;
  const HV_FORCE = { bank: 'vault', datacenter: 'server', museum: 'gallery', blackmarket: null };
  D.HV_ROOMS = HV_ROOMS; D.HV_FORCE = HV_FORCE; // 第二代生成器（src/gen2）照同样的规则抽高价值房

  let curLine = null, curLayout = 'standard'; // 正在生成的站：线路主题、骨架
  const linePool = (pool, n) => { const L = D.LINE_THEMES[curLine]; return L ? pool.concat(L.rooms.map(([k, w]) => [k, w * (n || 1)])) : pool; };
  function newFloor(w, h, name, theme) {
    const F = { name, tw: w, tht: h, w: w * TS, h: h * TS, solid: new Uint8Array(w * h).fill(1), kind: new Uint8Array(w * h).fill(1), room: new Int16Array(w * h).fill(-1), rooms: [], props: [], lights: [], contSpots: [], stairs: [], tunnels: [], breakables: [], spawns: [], theme, ambient: D.tintTheme(D.THEMES[theme], curLine).ambient, th: D.tintTheme(D.THEMES[theme], curLine) };
    return F;
  }
  const idx = (F, x, y) => y * F.tw + x;
  function carve(F, x0, y0, w, h, ri) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x > 0 && y > 1 && x < F.tw - 1 && y < F.tht - 1) { const i = idx(F, x, y); F.solid[i] = 0; F.kind[i] = 0; if (ri != null && F.room[i] < 0) F.room[i] = ri; } }
  function addRoom(F, x, y, w, h, kind, opts) { const r = Object.assign({ x, y, w, h, kind, name: ROOMS[kind].name, i: F.rooms.length, seen: false }, opts || {}); F.rooms.push(r); carve(F, x, y, w, h, r.i); return r; }
  // 走廊：从房间 a 的边缘中点到 b，先横后竖，宽 3（P7 任务 3：旧生成器删了以后只剩 scenes.js（换乘枢纽、车辆段、大厦）和 envs.js（12 种环境）通过 D.LV.corridor 用）
  function corridor(F, a, b, rng, breakAt) {
    const ax = Math.floor(a.x + a.w / 2), ay = Math.floor(a.y + a.h / 2), bx = Math.floor(b.x + b.w / 2), by = Math.floor(b.y + b.h / 2);
    const cells = [];
    if (rng.chance(0.5)) { for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) cells.push([x, ay]); for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) cells.push([bx, y]); }
    else { for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) cells.push([ax, y]); for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) cells.push([x, by]); }
    for (const [x, y] of cells) carve(F, x - 1, y - 1, 3, 3);
    // 隐藏房间：在房间 a 的门口放一段裂缝墙
    if (breakAt) {
      const doorCells = cells.filter(([x, y]) => (x === a.x - 1 || x === a.x + a.w || y === a.y - 1 || y === a.y + a.h) && x >= a.x - 1 && x <= a.x + a.w && y >= a.y - 1 && y <= a.y + a.h);
      const [dx, dy] = doorCells[0] || [ax, a.y + a.h];
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const x = dx + ox, y = dy + oy; if (x < 1 || y < 2 || x >= F.tw - 1 || y >= F.tht - 1) continue; const i = idx(F, x, y); if (F.room[i] === a.i) continue; F.solid[i] = 1; F.kind[i] = 3; }
      const br = { tx: dx, ty: dy, hp: 40, room: a.i, open: false, x: dx * TS + 8, y: dy * TS + 8 };
      F.breakables.push(br);
    }
  }

  // ── 站厅层 / 站台层 / 换乘层 / 设备层：P7 任务 3 起旧的 genConcourse / genPlatform / genUtility 删了，全走第二代生成器（src/gen2：concourse.js、platform.js、utility.js）。
  //    教学站（tutorial.js 的南栈训练场）也一样：站厅层出完被 tut-arena.js 换成训练长厅，站台层用新骨架；武器训练室（training.js）自己出图，不走这里。
  // ── 塌方：房间和走廊里散着几堆碎石（实心），不挡楼梯和门；灯多半坏了
  function rubble(F, rng) {
    const n = Math.floor(F.tw * F.tht / 140); let made = 0;
    const clearAround = (x, y) => { for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const i = idx(F, x + a, y + b); if (x + a < 1 || y + b < 1 || x + a >= F.tw - 1 || y + b >= F.tht - 1 || F.solid[i] || F.kind[i] !== 0) return false; } return true; };
    for (let tries = 0; made < n && tries < 400; tries++) {
      const x = rng.int(2, F.tw - 3), y = rng.int(2, F.tht - 3);
      if (!clearAround(x, y)) continue;
      if (F.stairs.some(s => Math.abs(s.x / TS - x) < 4 && Math.abs(s.y / TS - y) < 4) || F.tunnels.some(t => Math.abs(t.x / TS - x) < 5)) continue;
      if ((F.keep || []).some(([kx, ky]) => Math.abs(kx - x) < 4 && Math.abs(ky - y) < 4)) continue; // 第二代站厅：商人 / 医生 / 调度台旁边不堆碎石（P1 审稿 M1）
      if (F.track && y >= F.track.y0 - 3) continue; // 登车区留空
      const w = rng.chance(0.5) ? 2 : 1, h = rng.chance(0.4) ? 2 : 1;
      for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) { const i = idx(F, x + a, y + b); F.solid[i] = 1; F.kind[i] = 1; }
      made++;
    }
    F.th = Object.assign({}, F.th, { lamp: D.mixHex(F.th.lamp, '#8a7a60', 0.4) }); F.ambient = D.mixHex(F.ambient, '#000000', 0.25); F.dark = true;
  }
  // 给 scenes.js 用的建楼层工具（只在 makeStation 里调，线路主题跟着当前这站）
  D.LV = { spotRect: (...a) => spotRect(...a), ownSpot: (...a) => ownSpot(...a), newFloor: (...a) => newFloor(...a), addRoom: (...a) => addRoom(...a), carve: (...a) => carve(...a), corridor: (...a) => corridor(...a), idx, bake: (...a) => bake(...a), pool: st => linePool(ROOM_POOL[st.type] || ROOM_POOL.ruin), line: () => curLine,
    txt: { conc: '站厅层', down: '下到站台层', deep: '下到设备层' } }; // txt：第二代生成器用的楼层名、楼梯字（新文件里不写中文）
  // ── 生成整站
  D.makeStation = function (rng, st, opt) {
    curLine = opt.tut ? null : D.lineThemeOf(st); curLayout = opt.tut ? 'standard' : D.layoutOf(st);
    const conc = (D.genConcourseX && D.genConcourseX(rng, st, opt, curLayout)) || D.gen2.concourse(rng, st, opt, curLayout); // 试玩反馈 5：换乘枢纽、车辆段的站厅（scenes.js）、环境（envs.js）；其余都走第二代（src/gen2；P7 任务 3 起没有旧的 genConcourse，教学站也走这里）
    // 第二代 P6：站台层 / 换乘层 / 设备层走新骨架（src/gen2/platform.js、utility.js；玩法上的位置同旧版）；P7 任务 3 起所有站都是（旧的 genPlatform / genUtility 删了，D.TUNE.gen2.floors 开关去掉）
    //   场景骨架、环境骨架、弹坑的站（D.gen2.dressLayout）站台、换乘层是地铁站本身；地下环境的站台照旧由 envs.js 换墙和地面，高架照旧露天
    const dl = !opt.tut && !opt.safe && D.gen2.dressLayout && D.gen2.dressLayout(curLayout);
    const tun = { tl: '左侧隧道', tr: '右侧隧道' };
    const floors = [conc, D.gen2.platform(rng, st, opt, { name: '站台层', labels: Object.assign({ up: '上到站厅层', down: '去换乘层' }, tun), upTo: 0, downTo: opt.inter ? 2 : null, exit: !!opt.exit })];
    if (opt.inter) floors.push(D.gen2.platform(rng, st, opt, { name: '换乘层', labels: Object.assign({ up: '回到站台层' }, tun), upTo: 1, downTo: null, upX: 14, exit: false, inter: true }));
    const ds = floors[0].stairs.find(s => s.deep);
    if (ds) { ds.to = floors.length; floors.push(D.gen2.utility(rng, st, opt, { name: '设备层', up: '回到站厅层' })); }
    const core = new Set(floors); // 核心生成器出的楼层（站厅、站台、换乘层、设备层）；floorsX 加的场景层不在里面，历史的底子贴花不撒（P2/P3 审稿 M5）
    if (D.floorsX) D.floorsX(floors, rng, st, opt, curLayout); // 试玩反馈 5：检修管道层、楼上的大厦、高架（scenes.js）
    if (curLayout === 'collapse') floors.forEach(F => rubble(F, rng));
    floors.forEach(F => { F.layout = curLayout; F.line = curLine; });
    // 第二代 P6 任务 2 / 3：场景、环境骨架的站厅层和附加楼层（检修管道、楼上大厦）接上后几道工序（src/gen2/dress.js）：先标候选、按 D.TUNE.gen2.dress 挂工序表
    //   （decorate 给候选楼层随机放的摆设、容器、灯打标记；摆放在 stationMod 之后用子流重放，父流取的数和开关无关）
    const seeds = !!(floors[0].gen2 || dl);
    if (seeds && D.gen2.dressPlan) floors.forEach((F, fi) => D.gen2.dressPlan(F, fi, curLayout));
    // 第二代 P3：站的历史（src/gen2/history.js）和一站共用的"用过的小场景"。只有新骨架站厅的站（P6 起加上场景、环境骨架的站）从父流取这一个数（开关关着也取），其余旧骨架的站一点不变
    let hist = [], hseed = 0;
    if (seeds && D.gen2.rollHist) {
      const hr = D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:hist'));
      hseed = (hr() * 4294967296) >>> 0; hist = D.gen2.rollHist(hr, st, opt);
    }
    const vigUsed = new Set();
    floors.forEach(F => { F.hist = hist; F.vigs = []; F.decals = []; if (F.gen2 || F.gen2dress) F.vigUsed = vigUsed; });
    floors.forEach((F, fi) => decorate(F, rng, st, fi));
    if (D.stationMod) floors.forEach((F, fi) => D.stationMod(F, rng, st, fi)); // M5：积水、停电、调度终端（world.js）
    if (seeds && D.gen2.dress) floors.forEach((F, fi) => { if (F.gen2dress) D.gen2.dress(F, hseed, st, fi); }); // 第二代 P6：旧骨架楼层重放摆设和容器、放小场景、换灯（子流）
    const hdec = F => (floors[0].gen2 && core.has(F)) || F.gen2 || !!(F.gen2dress && F.gen2dress.hist); // 底子贴花：新骨架站的核心楼层、新骨架楼层、开了历史这道工序的旧骨架楼层（露天的格不撒积水）
    if (hist.length) floors.forEach((F, fi) => { const sr = D.rng(hseed ^ D.hash('gen2:hswap:' + fi)); D.gen2.histSwap(F, hist, sr); if (hdec(F)) D.gen2.histDecals(F, hist, sr, F.gen2dress || F.open ? D.gen2.outMask(F) : null); }); // 历史换容器种类（全站）、撒底子贴花（子流，不动父流）
    floors.forEach(F => { delete F.vigUsed; });
    // 第二代 P4：表面痕迹、导向牌的子流种子（src/gen2/wear.js、wayfind.js 在 bake 里用）。只有新骨架站厅的站从父流取这一个数（开关关着也取），旧骨架的站一点不变
    //   P6：场景、环境骨架的站也取；旧骨架的候选楼层（F.g2dc，和开关无关）也挂上（bake 用自己的子流）
    if (seeds) { const p4 = (rng() * 4294967296) >>> 0; floors.forEach((F, fi) => { if (F.gen2 || F.g2dc) F.p4 = { s: p4, fi }; }); if (floors[0].gen2) floors[0].inter = !!opt.inter; }
    floors.forEach(F => bake(F, rng));
    if (opt.tut) for (const F of floors) for (const l of F.lights) if (l.fx) { delete l.fx; delete l.sd; } // 教学站不挑灯光效果（和 lightfx.js 一致）：新骨架的吊灯、灯箱柔光在这里也去掉效果，教学的画面不闪不晃
    return floors;
  };

  // 摆设、容器位、光源、敌人出生点
  function decorate(F, rng, st, fi) {
    const busy = new Set();
    const mark = (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) busy.add((x + a) + ',' + (y + b)); };
    for (const s of F.stairs) mark(Math.floor(s.x / TS), Math.floor(s.y / TS));
    // 门口（走廊和房间相接的格子）留空
    const nearDoor = (x, y) => { for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const i = idx(F, x + dx, y + dy); if (F.solid[i] === 0 && F.room[i] !== F.room[idx(F, x, y)]) return true; } return false; };
    // 第二代楼层 P2：摆设和容器交给 src/gen2/furnish.js 按锚点放、查动线（只从 rng 取一个数）；fx.busy 不放东西的格，fx.reach 从门洞走得到的本房间地面
    const fx = F.gen2 && D.gen2 && D.gen2.furnish ? D.gen2.furnish(F, rng, st, fi) : null;
    for (const r of F.rooms) {
      const R = ROOMS[r.kind];
      // 第二代楼层（src/gen2）的房间是拼形的，外框里有不属于它的格：只落在本房间的格上，摆设个数按实际格数算（旧楼层不变，随机数照旧）
      const own = (x, y) => !F.gen2 || F.room[idx(F, x, y)] === r.i;
      if (!fx) {
      // 摆设：房间里面一圈留出走道
      const nP = Math.floor((F.gen2 ? r.cells : r.w * r.h) / (r.kind === 'platform' ? 26 : 16));
      for (let n = 0, tries = 0; n < nP && tries < 80; tries++) {
        const x = r.x + rng.int(1, r.w - 2), y = r.y + rng.int(1, Math.max(1, r.h - 2)), k = rng.weighted((r.kind === 'hall' || r.kind === 'platform') && D.LINE_THEMES[F.line] ? R.props.concat(D.LINE_THEMES[F.line].props) : R.props), wide = k === 'bench' || k === 'kiosk' || k === 'desk' || k === 'bed' || k === 'machine' || k === 'shelf' ? 2 : 1;
        if (r.kind === 'platform' && y >= r.y + r.h - 2) continue;
        let ok = true; for (let a = 0; a < wide; a++) if (busy.has((x + a) + ',' + y) || F.solid[idx(F, x + a, y)] || nearDoor(x + a, y) || x + a >= r.x + r.w - 1 || !own(x + a, y)) ok = false;
        if (!ok) continue;
        for (let a = 0; a < wide; a++) { const i = idx(F, x + a, y); F.solid[i] = 1; mark(x + a, y); }
        F.props.push(D.makeProp(k, x, y, F.th, rng));
        if (F.g2dc) F.props[F.props.length - 1].dec = { x, y, wd: wide }; // 第二代 P6：旧骨架的候选楼层，dress.js 认得出哪些是这里随机放的
        n++;
      }
      // 容器位
      const nc = Math.max(1, rng.int(R.nCont[0], R.nCont[1]) + (st.tier >= 2 ? rng.int(0, 1) : 0) - (!R.hv && !R.bonus && rng.chance((D.TUNE.loot || {}).contFewer || 0) ? 1 : 0)); // 试玩：普通房间少放一个容器
      for (let n = 0, tries = 0; n < nc && tries < 60; tries++) {
        const x = r.x + rng.int(1, r.w - 2), y = r.y + rng.int(1, Math.max(1, r.h - 2));
        if (busy.has(x + ',' + y) || F.solid[idx(F, x, y)] || nearDoor(x, y) || !own(x, y)) continue;
        if (r.kind === 'platform' && y >= r.y + r.h - 2) continue;
        mark(x, y); F.solid[idx(F, x, y)] = 1;
        F.contSpots.push({ x: x * TS + 8, y: y * TS + 12, kind: rng.weighted(R.cont), bonus: (R.bonus || 0) + (st.hidden ? 1 : 0) + (r.lock ? r.lock - 1 : 0), room: r.i });
        if (F.g2dc) F.contSpots[F.contSpots.length - 1].dec = 1;
        n++;
      }
      }
      // 地上散落的东西（不用搜）：一般房间偶尔有一件，高价值房间两三件
      const lm = (D.TUNE.loot || {}).loose || 1, nl = R.loose ? rng.int(R.loose[0], R.loose[1]) : r.kind === 'platform' || r.kind === 'hall' ? (rng.chance(0.3 * lm) ? 1 : 0) : (rng.chance(0.35 * lm) ? 1 : 0);
      F.loose = F.loose || [];
      if (fx) { // 第二代（P3）：从本房间走得到、不在门口的空格里一次挑够（自己的子流，父流每间房只取一个数）；小场景的地上东西格先用。个数和开不开小场景无关
        const lr = D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:loose:' + r.i)), el = [];
        for (let y = r.y + 1; y <= r.y + Math.max(1, r.h - 2); y++) for (let x = r.x + 1; x <= r.x + r.w - 2; x++) { const i = idx(F, x, y); if (!busy.has(x + ',' + y) && !F.solid[i] && own(x, y) && !fx.busy[i] && fx.reach[i]) el.push(i); }
        const pre = ((fx.looseAt && fx.looseAt[r.i]) || []).filter(i => el.includes(i));
        lr.shuffle(el);
        if (el.length < nl) { // 空格不够（小房间被摆设、小场景占了）：再用本房间走得到的其余空格，不管"不放东西的格"，个数和开不开小场景无关（审稿 M1）
          const ex = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const i = idx(F, x, y); if (!el.includes(i) && !busy.has(x + ',' + y) && !F.solid[i] && own(x, y) && fx.reach[i]) ex.push(i); }
          el.push(...lr.shuffle(ex));
        }
        for (const i of pre.concat(el.filter(i => !pre.includes(i))).slice(0, nl)) {
          const x = i % F.tw, y = (i / F.tw) | 0; busy.add(x + ',' + y);
          F.loose.push({ x: x * TS + lr.int(4, 12), y: y * TS + lr.int(6, 12), bonus: (R.bonus || 0) + (st.hidden ? 1 : 0), hv: !!R.hv });
        }
      }
      else for (let n = 0, tries = 0; n < nl && tries < 40; tries++) {
        const x = r.x + rng.int(1, r.w - 2), y = r.y + rng.int(1, Math.max(1, r.h - 2));
        if (busy.has(x + ',' + y) || F.solid[idx(F, x, y)] || !own(x, y) || (fx && (fx.busy[idx(F, x, y)] || !fx.reach[idx(F, x, y)]))) continue;
        if (r.kind === 'platform' && y >= r.y + r.h - 2) continue;
        busy.add(x + ',' + y);
        F.loose.push({ x: x * TS + rng.int(4, 12), y: y * TS + rng.int(6, 12), bonus: (R.bonus || 0) + (st.hidden ? 1 : 0), hv: !!R.hv });
        n++;
      }
      // 灯：沿房间上墙每隔几格一盏；暗房间只有一盏会闪的（第二代楼层：挂在这一列最上面的本房间格上，拼形房间切掉的那块不挂，P1 审稿 M8）
      const dim = R.dim || rng.chance(F.dark ? 0.6 : 0.15), lay = F.gen2 && D.gen2 && D.gen2.layLamps && D.gen2.artOn(F) ? [] : null; // 第二代 P5：旧灯照旧算（父流取的数不变），交给 layLamps 按柱网 / 房间用途换位置
      for (let x = r.x + 2; x < r.x + r.w - 1; x += rng.int(5, 7)) {
        const broken = dim || rng.chance(0.2);
        let ly = r.y; if (F.gen2) { ly = -1; for (let y = r.y; y < r.y + r.h; y++) if (F.room[idx(F, x, y)] === r.i) { ly = y; break; } }
        const L = { x: x * TS + 8, y: ly * TS - 4, oy: 40, r: 100, col: R.lamp || F.th.lamp, a: broken ? 0.55 : 0.85, flick: broken ? 0.6 : 0.04, seed: rng() * 100, shaft: true };
        if (F.g2dc) { L.rl = r.i; L.rdim = dim; } // 第二代 P6：这间房 decorate 挂的灯（dress.js 交给 layLamps 换位置）
        if (ly >= 0) (lay || F.lights).push(L);
        if (dim) break;
      }
      if (lay) for (const L of D.gen2.layLamps(F, r, lay, dim)) F.lights.push(L);
      // 敌人出生点
      // 第二代 P3：站的历史 / 小场景定了出生格就用那格（fx.spawnAt），个数不变
      const sa = fx && fx.spawnAt ? fx.spawnAt[r.i] : -1;
      if (r.kind !== 'hidden' || rng.chance(0.5)) F.spawns.push(Object.assign({ x: (r.x + r.w / 2) * TS, y: (r.y + r.h / 2) * TS, room: r.i, w: r.w * TS, h: r.h * TS }, F.gen2 ? (sa >= 0 ? spotRect(F, r, sa % F.tw, (sa / F.tw) | 0) : ownSpot(F, r, fx && fx.reach)) : null));
    }
    const lseed = fx ? D.rng(((rng() * 4294967296) >>> 0) ^ D.hash('gen2:plight')) : rng; // 第二代：摆设灯的闪烁种子走子流（小场景多了几件带灯的摆设也不动父流）
    for (const p of F.props) if (p.light) F.lights.push(Object.assign({ seed: lseed() * 100 }, p.light));
    if (F.track) for (let x = 3; x < F.tw; x += 7) F.lights.push({ x: x * TS, y: (F.track.y0 + 2) * TS, r: 40, col: '#ff3047', a: 0.45, flick: 0.02, seed: x });
    for (const t of F.tunnels) F.lights.push({ x: t.x, y: t.y, r: 60, col: '#3ee8ff', a: 0.4, flick: 0.1, seed: t.x });
  }

  // 第二代楼层：离外框中心最近的本房间地面格（格子正中），敌人从这里出生；P2 起只挑从门洞走得到的格（P1 审稿 M5）。
  // 散布范围（enemy.js 在出生点 x ±(w/2−20)、y −(h/2−18)…+(h/2−14) 里取点，闲逛也用它）收进本房间（M3）：
  //   以出生格为中心往外长一个全是本房间格的矩形（左右 a 格、上下 b 格），w = 32a + 54、h = 32b + 42 正好盖住这些格，再不超过外框
  function ownSpot(F, r, reach) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2; let bx = -1, by = -1, bd = 1e9;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const i = idx(F, x, y); if (F.room[i] !== r.i || F.solid[i] || F.kind[i] || (reach && !reach[i])) continue; const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2; if (d < bd) { bd = d; bx = x; by = y; } }
    if (bx < 0) return reach ? ownSpot(F, r, null) : null;
    return spotRect(F, r, bx, by); // 没有走得到的格、退回任意本房间格时也收散布范围（审稿 M4）
  }
  function spotRect(F, r, bx, by) {
    const all = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h || F.room[idx(F, x, y)] !== r.i) return false; return true; };
    let a = 0, b = 0, ga = true, gb = true;
    while (ga || gb) {
      if (ga) { if (all(bx - a - 1, by - b, bx + a + 1, by + b)) a++; else ga = false; }
      if (gb) { if (all(bx - a, by - b - 1, bx + a, by + b + 1)) b++; else gb = false; }
    }
    return { x: bx * TS + 8, y: by * TS + 8, w: Math.min(r.w * TS, 32 * a + 54), h: Math.min(r.h * TS, 32 * b + 42) };
  }
  // ── 预渲染：地面、墙面、轨道（2 倍精度）
  const NO_RNG = { chance: () => false, int: a => a, pick: a => a[0] }; // 第二代 P6：新骨架的站台层 / 换乘层 / 设备层新画法不用空跑取数
  function bake(F, rng) {
    // 第二代 P6：新骨架的站台层、换乘层、设备层（F.g2floor）用自己的子流，不从父流取数（开关新画法、痕迹都不影响后面的楼层），
    //   新画法下就不用为了父流空跑旧地砖、污渍的取数（提速：每种骨架生成 ≤ 旧版 2 倍）。
    //   P4/P5 审稿修复（提速）：新骨架的站厅层也一样（bake 是 makeStation 最后一步，父流后面只剩别的楼层 bake 的画面和灯的闪烁种子；开关新画法照样都不从父流取）
    const own = !!((F.gen2 || F.g2dc) && F.p4); // P6：旧骨架的候选楼层（F.g2dc，dress.js）也用自己的子流
    const dz = F.gen2dress && F.p4 ? F.gen2dress : null; // P6 任务 2 / 3：旧骨架楼层开了哪几道后面的工序
    if (own) rng = D.rng((F.p4.s ^ D.hash('gen2:bake:' + F.p4.fi)) >>> 0);
    const W2 = F.w * Z, H2 = F.h * Z, T2 = TS * Z, th = F.th;
    const [c, x] = D.canvas(W2, H2), [em, ex] = D.canvas(W2, H2);
    F.floor = c; F.floorEmit = em; F.signs = []; delete F._wf;
    const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    R(0, 0, W2, H2, D.gen2 && D.gen2.artOn && D.gen2.artOn(F) && D.gen2.DEEP_COL || '#090a12'); // 第二代 P5：新画法楼层底色 = 墙里深处的颜色（那里不再一格格贴）
    const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= F.tw || ty >= F.tht) ? 1 : F.kind[idx(F, tx, ty)];
    const isFloor = (tx, ty) => { const k = at(tx, ty); return k === 0; };
    // 第二代 P5：新骨架楼层（D.TUNE.gen2.art 开着）地面、墙换成材质贴片（src/gen2/tiles.js）。父流照旧取一样多的数（burnTiles 按旧画法空跑），
    //   旧画法会挂的霓虹招牌个数记下来（下面每块照旧取一个数）；新画法自己的数走子流 'gen2:art:' + 楼层号
    const art = !!(D.gen2 && D.gen2.artOn && D.gen2.artOn(F) && D.gen2.paintTiles);
    const oldSigns = art ? D.gen2.burnTiles(F, own ? NO_RNG : rng) : null;
    const dw = !art && dz && dz.walls && D.gen2.paintDressWalls ? [] : null; // P6：D.paintWallX 不管的墙交给新画法（地面照旧）
    if (!art) for (let ty = 0; ty < F.tht; ty++) for (let tx = 0; tx < F.tw; tx++) {
      const k = at(tx, ty), px = tx * T2, py = ty * T2;
      if (k === 0 || (F.solid[idx(F, tx, ty)] === 1 && k === 0)) D.paintFloorTile(x, F, tx, ty, rng);
      else if (k === 2) paintTrack(x, F, tx, ty);
      else if (!(D.paintWallX && D.paintWallX(x, ex, F, tx, ty, isFloor, rng, k === 3))) { if (dw) dw.push(ty * F.tw + tx); else paintWallTile(x, ex, F, tx, ty, isFloor, rng, k === 3); } // 高架的夜空、写字楼的窗、管道墙（scenes.js）
    }
    if (dw) D.gen2.paintDressWalls(F, dw, ex); // 画进共用的像素缓冲，下面和表面痕迹、贴花一起贴
    if (dz && (dz.walls || dz.fore || dz.lamps)) F.floorArt = 'dress'; // 光柱、飘灰、前景认它（地面不是材质贴片，打开裂缝墙照旧补画）
    // 道具格下面也要有地面：上面已经按 kind 画了（摆设格 kind 仍是 0）
    // 第二代 P4：封死的出口、导向牌先定位置（只读格子，用自己的子流）；表面痕迹开着时不再随机撒水洼（随机数照样取，开关痕迹其余的画法不变）
    const p4 = (F.gen2 || dz) && F.p4 && D.gen2 && D.gen2.planWayfinding ? F.p4 : null, wr = p4 && F.gen2 && !F.open ? D.rng((p4.s ^ D.hash('gen2:way:' + p4.fi)) >>> 0) : null; // P6：导向牌只给新骨架楼层，露天（高架）的不挂
    const wearOn = !!(p4 && D.gen2.paintWear && (D.TUNE.gen2 || {}).wear !== false && (!dz || dz.wear));
    const ar = art ? D.rng(((p4 ? p4.s : D.hash(F.name || '')) ^ D.hash('gen2:art:' + (p4 ? p4.fi : 0))) >>> 0) : null;
    if (art) D.gen2.planLit(F, oldSigns.length); // 亮着的招牌先占位（导向牌躲开）
    if (wr) D.gen2.planWayfinding(F, wr);
    if (art && D.gen2.litOffExits) D.gen2.litOffExits(F); // 审稿修复 I3：出口上的灯箱 / 霓虹撤掉
    // 审稿修复（提速）：表面痕迹开着时，地面、痕迹、贴花都画进同一块缓冲，最后一次贴（中间没有画到画布上的东西：污渍新画法不画、水洼交给痕迹）
    const defer = art && wearOn;
    if (art) { D.gen2.planDeco(F); if (p4 && D.gen2.flowWear) D.gen2.flowWear(F); D.gen2.paintTiles(F, ex, ar, defer); if (!defer) D.gen2.pixFlush(D.gen2._pix, x, true); }
    // 污渍与水洼（新画法：随机数照取，污渍不画——地上的脏是按道理放的积灰、磨损）
    if (!(own && art)) for (let n = 0; n < Math.floor(F.tw * F.tht / 50); n++) {
      const cx = rng.int(0, W2), cy = rng.int(0, H2), rr = rng.int(20, 60);
      const K = F.kind, TW = F.tw, TH = F.tht, lim = rr * rr * 0.6; // P5 提速：isFloor 内联（同样的判断、同样的取数）
      for (let i = 0; i < lim; i++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * rr, px = Math.round(cx + Math.cos(a) * d), py = Math.round(cy + Math.sin(a) * d * 0.7), tx = Math.floor(px / T2), ty = Math.floor(py / T2); if (tx >= 0 && ty >= 0 && tx < TW && ty < TH && K[ty * TW + tx] === 0 && rng() < 1 - d / rr && !art) R(px, py, 1, 1, '#00000026'); }
    }
    for (let n = 0; n < Math.floor(F.rooms.length * 0.8); n++) {
      const r = rng.pick(F.rooms), cx = (r.x + rng.int(1, r.w - 2)) * T2, cy = (r.y + rng.int(1, r.h - 2)) * T2, rw = rng.int(18, 40), rh = rng.int(6, 12), nc = rng.pick(th.neon);
      if (F.gen2 && F.room[idx(F, Math.floor(cx / T2), Math.floor(cy / T2))] !== r.i) continue; // 第二代：拼形房间切掉的那块（墙）上不画（M8）
      if (wearOn && (!dz || dz.leak)) continue; // 第二代 P4：水从漏水点流出来（wear.js），不随机画椭圆（P6：没开漏水这道的旧骨架楼层照旧画水洼）
      for (let j = -rh; j <= rh; j++) { const hw = Math.round(rw * Math.sqrt(1 - (j * j) / (rh * rh + 1))); R(cx - hw, cy + j, hw * 2, 1, '#151c30'); }
      R(cx - rw * 0.5, cy - 2, rw * 0.6, 1, D.rgba(nc, 0.6)); R(cx - 6, cy + 3, 9, 1, '#ffffff40');
    }
    if (wearOn) D.gen2.paintWear(F, x, D.rng((p4.s ^ D.hash('gen2:wear:' + p4.fi)) >>> 0), ex); // 第二代 P4：磨损路线、积灰积水、历史痕迹、线缆管道（地面、墙面大图）
    if (F.decals && F.decals.length && D.gen2 && D.gen2.paintDecals) D.gen2.paintDecals(F, x, ex); // 第二代 P3：小场景、站的历史的贴花，画进地面大图（每个贴花自己的种子）
    if (D.gen2 && D.gen2._pix) D.gen2.pixFlush(D.gen2._pix, x, defer); // 第二代 P5：表面痕迹、贴花先画进共用的像素缓冲，这里一次贴上（defer：连地面一起直接贴）
    const way = wr ? D.gen2.paintWayfinding(F, x, ex, wr) : null; // 第二代 P4：封死的出口、导向牌、闸机标志（墙面、发光层）
    // 站台边警示带
    if (F.track) { const yy = (F.track.y0 * TS - 6) * Z; for (let px = T2 * 2; px < W2 - T2 * 2; px += 8) { R(px, yy, 6, 8, '#e3c14a'); R(px, yy, 6, 1, '#fff0a0'); R(px, yy + 8, 6, 2, '#7a6420'); } }
    if (!art) for (const s of F.signs) { if (!s.nolight) F.lights.push({ x: s.x, y: s.y + 10, r: 60, col: s.col, a: 0.6, flick: 0.05, seed: rng() * 100 }); } // P6：两格灯箱的左半块只占位（dress.js 的墙）
    else { for (let n = D.gen2.oldSignsLeft(F, oldSigns); n > 0; n--) rng(); for (const s of F.signs) if (!s.nolight) F.lights.push({ x: s.x, y: s.y + 10, r: 60, col: s.col, a: 0.6, flick: 0.05, seed: ar() * 100, fx: 'fill_soft', sd: 0, kind: 'sign' }); } // 第二代 P5：灯箱、霓虹的灯（种子走子流；只铺柔光，灯箱本身的光画在发光层）
    if ((art || (dz && dz.fore)) && D.gen2.planFore) D.gen2.planFore(F); // 第二代 P5：大厅的横梁、柱头、吊牌（前景，fore.js；P6：换乘枢纽的中庭也挂）
    if (way) for (const s of way) { F.signs.push(s); if (!s.nolight) F.lights.push({ x: s.x, y: s.y + 10, r: 40, col: s.col, a: 0.4, flick: 0.03, seed: wr() * 100, fx: 'fill_soft', sd: 0, kind: 'sign' }); } // 导向牌的灯（种子走子流；只铺柔光，lightfx 不再给它套招牌灯管）
  }
  // 一格地面（按所在房间的配色）
  D.paintFloorTile = function (x, F, tx, ty, rng) {
    const T2 = TS * Z, px = tx * T2, py = ty * T2, ri = F.room[idx(F, tx, ty)], r = ri >= 0 ? F.rooms[ri] : null;
    const pal = r && ROOMS[r.kind].floor !== 'theme' ? ROOMS[r.kind].floor : F.th.floor, grout = F.th.grout;
    const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    R(px, py, T2, T2, pal[(tx * 7 + ty * 13) % pal.length]);
    const concrete = r && (r.kind === 'storage' || r.kind === 'workshop' || r.kind === 'factory' || r.kind === 'hidden' || r.kind === 'server' || r.kind === 'arsenal');
    if (concrete || ri < 0) { R(px, py, T2, 1, grout); R(px, py, 1, T2, grout); R(px + 1, py + 1, T2 - 1, 1, '#ffffff08'); if (r && r.kind === 'factory' && (tx + ty) % 2 === 0) { R(px + 4, py + 4, 2, 2, '#00000040'); R(px + T2 - 6, py + T2 - 6, 2, 2, '#00000040'); } }
    else for (const [ox, oy] of [[0, 0], [16, 0], [0, 16], [16, 16]]) { R(px + ox, py + oy, 16, 1, grout); R(px + ox, py + oy, 1, 16, grout); R(px + ox + 1, py + oy + 1, 14, 1, '#ffffff10'); R(px + ox + 1, py + oy + 15, 15, 1, '#00000026'); }
    if (rng && rng.chance(0.15)) { let a = px + rng.int(4, 27), b = py + rng.int(4, 27); for (let i = 0; i < rng.int(5, 12); i++) { R(a, b, 1, 1, '#0c0e1780'); a += rng.int(-1, 1); b += rng.int(0, 1); } }
  };
  function paintTrack(x, F, tx, ty) {
    const T2 = TS * Z, px = tx * T2, py = ty * T2, R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    R(px, py, T2, T2, '#0c0e17');
    if (ty === F.track.y0) R(px, py, T2, 3, '#2a2f45');
    for (let k = 0; k < T2; k += 14) R(px + k, py + 6, 8, T2 - 6, '#2a1f1c');
    const local = (ty - F.track.y0) * T2;
    for (const ry of [30, 60]) { const yy = ry - local; if (yy >= 0 && yy < T2) { R(px, py + yy, T2, 4, '#5a6075'); R(px, py + yy, T2, 1, '#c8cfe0'); } }
  }
  // 墙：下面是地面的那面墙画成立面（带招牌、卷帘、海报），其余画成黑色墙顶 + 亮边
  function paintWallTile(x, ex, F, tx, ty, isFloor, rng, crack) {
    const T2 = TS * Z, px = tx * T2, py = ty * T2, th = F.th, R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    if (isFloor(tx, ty + 1)) {
      R(px, py, T2, T2, th.face[0]);
      R(px, py, T2, 3, '#0a0b12'); R(px, py + T2 - 5, T2, 5, '#12141f'); R(px, py + T2 - 6, T2, 1, '#ffffff18');
      if (tx % 2 === 0) { R(px, py + 4, 1, T2 - 10, '#00000040'); R(px + 1, py + 4, 1, T2 - 10, '#ffffff0a'); }
      // 装饰：按格子随机
      const roll = (tx * 31 + ty * 17) % 9;
      const ri = F.room[idx(F, tx, ty + 1)], rk = ri >= 0 ? F.rooms[ri].kind : null;
      if (roll === 0) { const col = rng.pick(th.neon); R(px + 2, py + 6, T2 - 4, 12, '#0d0e18'); for (let i = 0; i < 3; i++) { const a = px + 4 + rng.int(0, T2 - 12), w = rng.int(3, 8); x.fillStyle = col; x.fillRect(a, py + 9 + rng.int(0, 6), w, 2); ex.fillStyle = col; ex.fillRect(a, py + 9, w, 2); } F.signs.push({ x: (tx + 0.5) * TS, y: ty * TS + 6, col }); }
      else if (roll === 3 && (rk === 'shop' || rk === 'hall' || rk === 'storage')) { R(px + 1, py + 5, T2 - 2, T2 - 11, '#3a3f52'); for (let j = py + 7; j < py + T2 - 7; j += 3) R(px + 1, j, T2 - 2, 1, '#2a2e3d'); }
      else if (roll === 5) { R(px + 6, py + 6, 18, 20, '#c9b79a'); R(px + 8, py + 8, 14, 9, rng.pick(['#b8432f', '#3a6fa8', '#5c3b8a'])); R(px + 8, py + 19, 12, 1, '#5e3d36'); }
      else if (roll === 7 && (rk === 'workshop' || rk === 'factory' || rk === 'power')) { R(px, py + 10, T2, 3, '#4a5374'); R(px, py + 10, T2, 1, '#8f9bbd'); R(px + 10, py + 6, 4, 12, '#2d3342'); }
      else if (roll === 8 && rk === 'medic') { R(px + 10, py + 7, 12, 12, '#e8eef3'); R(px + 14, py + 9, 4, 8, '#ff3047'); R(px + 12, py + 11, 8, 4, '#ff3047'); }
      if (crack) { x.strokeStyle = '#0b0a14'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + 8, py + 6); x.lineTo(px + 14, py + 14); x.lineTo(px + 11, py + 20); x.lineTo(px + 18, py + 26); x.moveTo(px + 14, py + 14); x.lineTo(px + 22, py + 12); x.stroke(); R(px + 13, py + 13, 2, 2, '#5a6080'); }
    } else {
      R(px, py, T2, T2, '#0b0c14');
      if ((tx * 5 + ty * 3) % 4 === 0) R(px + rng.int(2, 26), py + rng.int(2, 26), 2, 2, '#14161f');
      if (isFloor(tx - 1, ty)) { R(px, py, 3, T2, '#1a1d2b'); R(px, py, 1, T2, '#3a3f55'); }
      if (isFloor(tx + 1, ty)) { R(px + T2 - 3, py, 3, T2, '#1a1d2b'); R(px + T2 - 1, py, 1, T2, '#3a3f55'); }
      if (isFloor(tx, ty - 1)) { R(px, py, T2, 4, '#1a1d2b'); R(px, py, T2, 1, '#3a3f55'); }
      if (crack) { R(px + 6, py + 6, T2 - 12, T2 - 12, '#1c1f2c'); x.strokeStyle = '#5a6080'; x.beginPath(); x.moveTo(px + 8, py + 8); x.lineTo(px + 16, py + 16); x.lineTo(px + 24, py + 12); x.stroke(); }
    }
    if (ty < F.tht - 1 && isFloor(tx, ty + 1) === false && isFloor(tx, ty - 1)) { /* 墙顶下沿阴影已在地面里 */ }
  }
  // 寻路场：从玩家所在格子往外 BFS，敌人隔着墙时顺着距离变小的方向走
  D.flowField = function (F, px, py) {
    const n = F.tw * F.tht, dist = new Int16Array(n).fill(-1), q = new Int32Array(n);
    const sx = Math.floor(px / TS), sy = Math.floor(py / TS), s0 = sy * F.tw + sx;
    if (s0 < 0 || s0 >= n) return null;
    let h = 0, t = 0; q[t++] = s0; dist[s0] = 0;
    while (h < t) { const c = q[h++], cx = c % F.tw, cy = (c / F.tw) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= F.tw || y >= F.tht) continue; const i = y * F.tw + x; if (dist[i] >= 0 || F.solid[i]) continue; dist[i] = dist[c] + 1; q[t++] = i; } }
    return { dist, tw: F.tw };
  };
  D.flowDir = function (flow, F, x, y) {
    if (!flow) return null;
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS); let best = null, bd = 1e9;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = (ty + dy) * F.tw + tx + dx, d = flow.dist[i]; if (d >= 0 && d < bd) { bd = d; best = [tx + dx, ty + dy]; } }
    if (!best) return null;
    return { x: best[0] * TS + 8 - x, y: best[1] * TS + 8 - y };
  };
  // 打破裂缝墙：把那一块重画成地面
  D.openBreakable = function (F, br, canvasCtx) {
    br.open = true;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const x = br.tx + ox, y = br.ty + oy, i = idx(F, x, y);
      if (F.kind[i] !== 3) continue;
      F.kind[i] = 0; F.solid[i] = 0; if (F.room[i] < 0) F.room[i] = br.room;
      if (F.floorArt === 'gen2' && D.gen2 && D.gen2.paintCell) D.gen2.paintCell(canvasCtx, F, x, y); else D.paintFloorTile(canvasCtx, F, x, y, null); // 第二代 P5：材质贴片
    }
  };
})(D);
