/* 末班之后 · 小样二：人类据点（小镇）。设计：design/features/outpost/design.md（第二版）。
   人类据点不走普通站的随机生成，是手工摆的两层：
   - 站台层（下车的地方）：岛式站台，下面是活线（班车进出）；上面停着一列走不了的车，4 节车厢改成住家；
     中间是上楼的门洞，路障门，陈守把门；轨道上一直停着一列开着门的车，想走了走到站台下沿就上车。
   - 站厅层（集市街）：北边 5 个摊位（收货、换物、修械、诊所、广播，按种子换位），中间主街和篝火广场，南边食堂、下楼口、帐篷区。
   进了据点规矩就变：收枪（开火、近战、技能、投掷、模块都不能用）、没有班车倒计时（车一直停在站台上等你，不用叫）、
   小地图全亮、整站暖光、没有容器和地上的东西。站民会逛街、排队、坐、躺、小孩追着跑，走近会转头，头顶冒闲话。

   挂钩（都是在原来的外面包一层，不改 station.js / train.js / minimap.js / data.js / player.js）：
   - D.OutpostTown.build：outpost.js 的 D.makeStation 遇到人类据点就调它。
   - D.enterStation：建完站加上 S.town（门、铃、闲话）、关掉时刻表、换横幅。
   - D.stepStation：据点里去掉开火、近战、技能、投掷、模块、换弹；之后跑门、站民、闲话。
   - 一直等着的车：train.js 的 D.schedHold（停着不开走，提示"列车在等你"）。
   - D.drawAmmoHud：据点里不画子弹条。D.drawTownOverlay：draw.js 在光照之后调（闲话气泡、摊位招牌）。
   - U._.legend：线路图图例多一项"人类据点"（要在 ui-raid.js 之前加载）。
   右上角的"列车在等你"、藏技能格在 ui-outpost.js（要在 ui-raid.js、hud-slots.js 之后包 U.station）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const K = D.K || (D.K = {});

  // ── 数值
  const TUNE = D.TOWN_TUNE = {
    noGunGap: 3,           // "这里不许动枪"多久说一次
    chatGap: [3, 6],       // 多久冒一句闲话
    chatDur: 2.5,          // 一句话挂多久
    chatRange: 170,        // 离你多远以内的人会说
    lookRange: 40,         // 离你多近会转头看你
    strollSpeed: 16, kidSpeed: 42,
  };

  // ── 房间（名字在小地图、换层横幅里用；容器表只为通过数据校验，小镇里不放容器）
  Object.assign(D.ROOMS, {
    mstreet: { name: '集市街', floor: ['#4a3a2e', '#4f3e31', '#463729'], props: [], cont: [['crate', 1]], nCont: [0, 0], lamp: '#ffc890' },
    tstall:  { name: '收货摊', floor: ['#3e3324', '#433728'], props: [], cont: [['crate', 1]], nCont: [0, 0], lamp: '#ffd27a' },
    tcar:    { name: '住家车厢', floor: ['#4b3a2a', '#52402e'], props: [], cont: [['crate', 1]], nCont: [0, 0], lamp: '#ffb57a' },
  });
  // 暖色主题：地面、墙面偏棕，环境光亮很多（普通站的环境光是 #21182f 这种近黑）
  const TH = D.THEMES.town = { floor: ['#463629', '#4b3a2c', '#42332a'], grout: '#2c2119', wall: '#1d1510', face: ['#5a4030', '#634636'], neon: ['#ffb057', '#ffd27a', '#ff9a4a'], ambient: '#6b5040', lamp: '#ffc890' };
  const WARM = ['#ffb057', '#ffd27a', '#ff8a5a', '#ffe9a0', '#ff9ad0'];

  const isTownSt = (st, opt) => !!st && st.type === 'outpost' && !st.home && !(opt && opt.tut);
  const at = (F, x, y) => y * F.tw + x;
  function block(F, x, y, w, h) { for (let b = 0; b < (h || 1); b++) for (let a = 0; a < (w || 1); a++) F.solid[at(F, x + a, y + b)] = 1; }
  // 摆设：w 格宽，占住这些格子（地面照画）
  function prop(F, rng, k, x, y, w) {
    block(F, x, y, w || 1, 1);
    const env = D.ENV_PROP && /^(stall|table|lanternpost|barrier)$/.test(k);
    const pr = env ? D.ENV_PROP(k, x, y, F.th, rng, w || 1, 1) : D.makeProp(k, x, y, F.th, rng);
    F.props.push(pr); if (pr.light) F.lights.push(Object.assign({ seed: rng() * 100 }, pr.light));
    return pr;
  }
  const lamp = (F, rng, x, y, r, col, a, flick) => F.lights.push({ x, y, r, col, a, flick: flick || 0.04, seed: rng() * 100 });
  const decor = (F, d) => (F.decor = F.decor || []).push(d);
  function newFloor(w, h, name) {
    const F = D.LV.newFloor(w, h, name, 'town');
    F.th = Object.assign({}, TH); F.ambient = TH.ambient; F.town = true; F.decor = []; F.loose = []; F.signs2 = [];
    return F;
  }

  // ── 人：有名字的人占一格、挡路；站民不挡路
  const SKIN = ['#e9b383', '#d9a57a', '#c99a72', '#8b6a4e', '#f2c9a0'], TOP = ['#8a3b3b', '#3f5f8f', '#5c6b3a', '#7a6a4a', '#5a4a6a', '#3d5a58', '#9a7a3a', '#b06a3a'];
  const BOT = ['#2a2e33', '#3b3046', '#3a3424', '#24242c', '#4a3a2a'], HAIR = ['#2a2a33', '#555555', '#aaaaaa', '#3a2a1a', '#1f1a22'];
  // 站民的样子：从 30 种人（outpost-art.js 的 D.HUMAN_TYPES）里轮着挑，一座据点里尽量每种都有；小孩用学生 / 兜帽 / 长发的样子，不拿东西
  const crowdLook = (rng, deck, kid) => {
    if (!D.humanLook) return { skin: rng.pick(SKIN), top: rng.pick(TOP), bot: rng.pick(BOT), hair: rng.pick(HAIR), acc: 'none' };
    if (kid) return Object.assign(D.humanLook(rng, rng.pick(['student', 'hoodie', 'longhair'])), { back: null, hand: null, face: null, outfit: null, build: 1 });
    if (!deck.length) deck.push(...rng.shuffle(Object.keys(D.HUMAN_TYPES)));
    return D.humanLook(rng, deck.pop());
  };
  function people(rng) {
    const out = [], deck = [];
    const named = (F, f, id, x, y, pose) => { block(F, x, y); out.push({ id, f, x: x * TS + 8, y: y * TS + 14, pose: pose || (D.OUTPOST_PEOPLE[id] || {}).pose || 'stand', named: true, seed: rng.int(0, 999), face: 1 }); };
    const crowd = (F, f, x, y, beh, o) => {
      const pose = beh === 'sit' ? 'sit' : beh === 'lie' ? 'lie' : beh === 'kid' ? 'kidrun' : 'stand';
      const p = Object.assign({ id: 'c' + out.length, crowd: true, f, x: x * TS + 8, y: y * TS + 14, pose, beh, seed: rng.int(0, 999), look: crowdLook(rng, deck, beh === 'kid'), face: rng.chance(0.5) ? 1 : -1 }, o || {});
      if (beh === 'kid') p.look.kid = true;
      out.push(p); return p;
    };
    // 逛街 / 小孩：在一行里 x0..x1 之间来回走（这一行的格子都要是空的，碰到摆设就截短）
    const lane = (F, f, y, x0, x1, beh) => {
      let a = x0, b = x0; while (b + 1 <= x1 && !F.solid[at(F, b + 1, y)]) b++;
      if (F.solid[at(F, a, y)] || b - a < 3) return null;
      const s = rng.int(a, b), p = crowd(F, f, s, y, beh);
      p.ax = a * TS + 8; p.bx = b * TS + 8; p.dir = rng.chance(0.5) ? 1 : -1; p.wait = rng.range(0, 2);
      return p;
    };
    return { out, named, crowd, lane };
  }

  // ── 站厅层：集市街（56×34）
  const STALL_X = [4, 14, 24, 34, 44];
  const STALLS = {
    tstall:  { who: 'gui',  sign: '收货 · 阿贵', col: '#ffd27a', awn: ['#c8962e', '#f3e2b0'] },
    barter:  { who: 'fang', sign: '换物 · 方姨', col: '#ffb0e0', awn: ['#b04a7a', '#f6d6e6'] },
    fixshop: { who: 'tie',  sign: '修械 · 老铁', col: '#9fb4d6', awn: ['#3f5f8f', '#c8d4e8'] },
    medic:   { who: 'su',   sign: '诊所 · 苏医生', col: '#6be08a', awn: ['#2e7a4a', '#e8f4ec'] },
    radio:   { who: 'xie',  sign: '广播 · 老谢', col: '#3ee8ff', awn: ['#2a5a78', '#cfe8f2'] },
  };
  function concourse(rng, st, opt, H) {
    const L = D.LV, F = newFloor(56, 34, '集市街');
    // 北边一排摊位：开口朝街，门口挂布篷
    const kinds = rng.shuffle(Object.keys(STALLS).slice());
    kinds.forEach((kind, i) => {
      const x = STALL_X[i], r = L.addRoom(F, x, 3, 9, 7, kind, { stall: true }), S0 = STALLS[kind];
      L.carve(F, x + 1, 10, 7, 1, r.i);
      prop(F, rng, 'shelf', x + 1, 4, 2); prop(F, rng, 'shelf', x + 6, 4, 2);
      decor(F, { k: 'awning', x: (x + 1) * TS, y: 10 * TS, w: 7 * TS, col: S0.awn });
      F.signs2.push({ x: (x + 4.5) * TS, y: 10 * TS - 2, s: S0.sign, col: S0.col });
      lamp(F, rng, (x + 4.5) * TS, 6 * TS, 70, ROOM_LAMP(kind), 0.75);
      const cx = x + 4;
      if (kind === 'tstall') { block(F, cx, 7); opt.trader = { f: 0, x: cx * TS + 8, y: 7 * TS + 8, prompt: '和阿贵交易' }; prop(F, rng, 'crate', x + 1, 7); prop(F, rng, 'crate', x + 7, 7); }
      else if (kind === 'barter') { H.named(F, 0, 'fang', cx, 7); prop(F, rng, 'crate', x + 1, 7); prop(F, rng, 'table', x + 6, 7, 2); }
      else if (kind === 'fixshop') { H.named(F, 0, 'tie', cx, 7); prop(F, rng, 'machine', x + 1, 6, 2); prop(F, rng, 'barrel', x + 7, 7); }
      else if (kind === 'medic') { H.named(F, 0, 'su', cx - 1, 7); opt.healer = { f: 0, x: (x + 6) * TS + 8, y: 6 * TS + 8 }; block(F, x + 6, 6); prop(F, rng, 'bed', x + 1, 7, 2); }
      else if (kind === 'radio') { H.named(F, 0, 'xie', cx, 7, 'sit'); prop(F, rng, 'desk', x + 1, 6, 2); prop(F, rng, 'cabinet', x + 7, 7); }
      // 摊前排队的人（不挡路）
      if (kind !== 'radio' && rng.chance(0.75)) H.crowd(F, 0, x + rng.int(2, 6), 11, 'queue');
    });
    // 主街
    const street = L.addRoom(F, 2, 11, 52, 11, 'mstreet');
    // 南边：食堂、下楼口、帐篷区
    const can = L.addRoom(F, 3, 23, 16, 8, 'canteen'); L.carve(F, 5, 22, 12, 1, can.i);
    L.carve(F, 24, 22, 8, 5, street.i);
    const tent = L.addRoom(F, 37, 23, 16, 8, 'tents'); L.carve(F, 39, 22, 12, 1, tent.i);
    F.stairs.push({ x: 28 * TS, y: 26 * TS, dir: 'down', label: '下到站台层', to: 1 });
    H.stairs0 = { x: 28, y: 26 };
    // 篝火广场：中间一堆火，四角长椅，坐着人
    block(F, 27, 16, 2, 1); decor(F, { k: 'fire', x: 28 * TS, y: 17 * TS - 2 });
    lamp(F, rng, 28 * TS, 16 * TS + 8, 130, '#ff9a4a', 0.75, 0.15);
    for (const [bx, by] of [[24, 14], [30, 14], [24, 18], [30, 18]]) prop(F, rng, 'bench', bx, by, 2);
    for (const [sx, sy] of [[25, 15], [30, 15], [25, 17], [31, 17]]) if (rng.chance(0.8)) H.crowd(F, 0, sx, sy, 'sit');
    H.named(F, 0, 'qing', 26, 17, 'sit');
    // 站牌（E-17，时间停在 23:40）和守钟的老周
    block(F, 21, 12, 2, 1); decor(F, { k: 'board', x: 22 * TS, y: 13 * TS - 1 });
    H.named(F, 0, 'zhou', 23, 12);
    // 名字墙
    block(F, 33, 12, 3, 1); decor(F, { k: 'names', x: 33 * TS, y: 13 * TS - 1, w: 3 * TS, seed: rng.int(0, 999) });
    F.signs2.push({ x: 34.5 * TS, y: 12 * TS - 10, s: '名字墙', col: '#e8e0d0' });
    // 食堂：长桌、炉灶、阿梅
    decor(F, { k: 'stove', x: 4 * TS, y: 23 * TS + 2 }); block(F, 4, 24);
    lamp(F, rng, 5 * TS, 24 * TS, 60, '#ff9a4a', 0.8, 0.15);
    H.named(F, 0, 'mei', 9, 24);
    for (const tx of [5, 10, 15]) prop(F, rng, 'table', tx, 27, 2);
    for (const [sx, sy] of [[7, 27], [12, 27], [14, 28], [6, 29]]) if (rng.chance(0.75)) H.crowd(F, 0, sx, sy, 'sit');
    lamp(F, rng, 10 * TS, 26 * TS, 90, '#ffd08a', 0.7);
    F.signs2.push({ x: 10.5 * TS, y: 22 * TS - 2, s: '食堂 · 阿梅', col: '#ffd08a' });
    // 帐篷区：铺盖、晾衣绳、躺着的人
    for (const bx of [38, 42, 46, 50]) prop(F, rng, 'bed', bx, 25, 2);
    decor(F, { k: 'laundry', x: 38 * TS, y: 23 * TS, w: 14 * TS });
    for (const [sx, sy] of [[39, 28], [44, 28], [49, 28], [41, 29]]) if (rng.chance(0.8)) H.crowd(F, 0, sx, sy, 'lie');
    lamp(F, rng, 45 * TS, 26 * TS, 90, '#9ee6c0', 0.55);
    F.signs2.push({ x: 45 * TS, y: 22 * TS - 2, s: '帐篷区', col: '#9ee6c0' });
    // 主街两边挂串灯
    for (const y of [11, 21]) { decor(F, { k: 'string', x: 3 * TS, y: y * TS + (y === 11 ? 2 : 12), w: 50 * TS, seed: y }); for (let x = 4; x < 54; x += 4) lamp(F, rng, x * TS, y * TS + 8, 44, WARM[(x / 4 | 0) % WARM.length], 0.5, 0.06); }
    // 街两头：小吃摊、桌子、货堆、路灯（不挡两条走道 y=13、y=20）
    for (const [x, y] of [[5, 16], [11, 17], [42, 16], [48, 17]]) prop(F, rng, 'stall', x, y, 2);
    for (const [x, y] of [[8, 15], [45, 15]]) { prop(F, rng, 'table', x, y, 2); if (rng.chance(0.8)) H.crowd(F, 0, x + 2, y, 'sit'); }
    for (const [k, x, y] of [['crate', 16, 15], ['barrel', 17, 15], ['crate', 16, 16], ['barrel', 37, 18], ['crate', 38, 18], ['planter', 52, 15], ['planter', 3, 18]]) prop(F, rng, k, x, y);
    for (const [x, y] of [[14, 18], [40, 14]]) prop(F, rng, 'lanternpost', x, y);
    for (const [x, y] of [[6, 18], [12, 15], [43, 18], [49, 15]]) if (rng.chance(0.7)) H.crowd(F, 0, x, y, 'queue');
    // 逛街的人：两条街道走廊；小孩在广场下面跑
    for (const [y, x0, x1, n] of [[13, 3, 52, 4], [20, 3, 52, 4], [12, 24, 52, 1]]) for (let i = 0; i < n; i++) { const a = x0 + Math.floor((x1 - x0) * i / n); H.lane(F, 0, y, a, Math.min(x1, a + rng.int(10, 18)), 'stroll'); }
    for (let i = 0; i < 2; i++) H.lane(F, 0, 19, 20, 37, 'kid');
    return F;
  }
  const ROOM_LAMP = k => (D.ROOMS[k] && D.ROOMS[k].lamp) || TH.lamp;

  // ── 站台层：车厢里的家（60×27，站台、轨道、登车区和普通站一样，下车过场要用）
  const CAR_X = [3, 15, 35, 47];
  function platform(rng, st, opt, H) {
    const L = D.LV, F = newFloor(60, 27, '站台层');
    L.addRoom(F, 2, 12, 56, 8, 'platform');
    for (let y = 20; y <= 22; y++) for (let x = 1; x < 59; x++) { const i = at(F, x, y); F.solid[i] = 1; F.kind[i] = 2; }
    F.track = { y0: 20, y1: 22 }; F.boardY = 19 * TS - 4;
    F.tunnels.push({ x: 2 * TS + 4, y: 16 * TS, w: 18, h: 120, dir: -1, label: '左侧隧道' }, { x: 58 * TS - 4, y: 16 * TS, w: 18, h: 120, dir: 1, label: '右侧隧道' });
    // 4 节车厢：每节一户，车门开着
    const kinds = rng.shuffle(['tents', 'nursery', 'tcar', 'tcar']);
    CAR_X.forEach((x, i) => {
      const kind = kinds[i], r = L.addRoom(F, x, 4, 11, 6, kind, { car: true });
      L.carve(F, x + 5, 10, 2, 2, r.i);
      decor(F, { k: 'car', x: x * TS, w: 11 * TS, door: (x + 5) * TS, n: i });
      lamp(F, rng, (x + 5.5) * TS, 6 * TS, 70, kind === 'nursery' ? '#ffe27a' : '#ffb57a', 0.7, 0.05);
      if (kind === 'tents') { for (const bx of [x + 1, x + 7]) prop(F, rng, 'bed', bx, 5, 2); H.crowd(F, 1, x + 2, 8, 'lie'); H.crowd(F, 1, x + 8, 8, 'lie'); }
      else if (kind === 'nursery') { prop(F, rng, 'planter', x + 1, 5); prop(F, rng, 'bench', x + 7, 5, 2); H.named(F, 1, 'xm', x + 3, 7, 'kid'); decor(F, { k: 'chalk', x: (x + 1) * TS, y: 8 * TS + 6 }); F.signs2.push({ x: (x + 5.5) * TS, y: 3 * TS + 4, s: '托儿车厢', col: '#ffe27a' }); }
      else { prop(F, rng, 'bed', x + 1, 5, 2); prop(F, rng, 'crate', x + 9, 5); decor(F, { k: 'laundry', x: (x + 4) * TS, y: 4 * TS, w: 4 * TS }); H.crowd(F, 1, x + 2, 8, rng.chance(0.5) ? 'lie' : 'sit'); if (rng.chance(0.6)) H.crowd(F, 1, x + 9, 8, 'sit'); }
    });
    // 门洞：上楼的楼梯，路障门（沙袋、探照灯），陈守
    const g = L.addRoom(F, 27, 4, 7, 6, 'gatehouse'); L.carve(F, 29, 10, 3, 2, g.i);
    F.stairs.push({ x: 30 * TS + 8, y: 4 * TS + 6, dir: 'up', label: '上到集市街', to: 0 });
    for (const sx of [27, 32]) { block(F, sx, 12, 2, 1); decor(F, { k: 'sandbag', x: sx * TS, y: 13 * TS - 1, w: 2 * TS }); }
    decor(F, { k: 'gate', x: 29 * TS, y: 12 * TS, w: 3 * TS });
    lamp(F, rng, 30.5 * TS, 11 * TS, 90, '#fff2c8', 0.8, 0.03);
    H.named(F, 1, 'chen', 34, 13);
    F.signs2.push({ x: 30.5 * TS, y: 9 * TS + 2, s: '集市街 ↑', col: '#ffd27a' });
    // 火盆
    for (const bx of [25, 36]) { block(F, bx, 13); decor(F, { k: 'brazier', x: bx * TS + 8, y: 14 * TS - 1 }); lamp(F, rng, bx * TS + 8, 13 * TS + 4, 80, '#ff9a4a', 0.9, 0.2); }
    H.gate = { x0: 29 * TS, x1: 32 * TS, y: 12 * TS + 3 };
    // 老黑坐在最后一节车厢门口
    H.named(F, 1, 'hei', 54, 12, 'sit');
    // 站台上的人
    for (const [y, x0, x1] of [[16, 6, 24], [15, 38, 56], [17, 26, 36]]) H.lane(F, 1, y, x0, x1, 'stroll');
    H.lane(F, 1, 17, 8, 24, 'kid');
    H.crowd(F, 1, 44, 13, 'queue'); H.crowd(F, 1, 9, 13, 'queue');
    // 站台上方的灯
    for (let x = 6; x < 56; x += 7) lamp(F, rng, x * TS, 13 * TS, 70, '#ffc890', 0.55, 0.05);
    return F;
  }

  // ── 建站（outpost.js 的 D.makeStation 调这里）
  function build(rng, st, opt) {
    const H = people(rng);
    const conc = concourse(rng, st, opt, H), plat = platform(rng, st, opt, H);
    const floors = [conc, plat];
    floors.forEach(F => {
      F.layout = 'standard'; F.line = null;
      for (const r of F.rooms) { r.seen = true; }
      F.mmSeen = new Uint8Array(F.tw * F.tht).fill(1); // 小地图一进站就全亮
      D.LV.bake(F, rng);
    });
    opt.people = H.out;
    opt.town = { gate: H.gate };
    return floors;
  }

  // ── 闲话：有名字的人说自己的（outpost.js 的 IDLE），站民从这里挑；when(pf) 是主线进度
  const has = (pf, k) => D.Story && D.Story.has(pf, k);
  const CROWD_LINES = [
    '今天的汤比昨天稀。', '听说南边又塌了一段。', '你看见我家孩子没有？', '这个月的电，够撑到月底。', '别挤，排队。',
    '机器人？进来干什么？', '它不开枪，就让它逛吧。', '我以前在这站卖票。', '鞋底又磨穿了。', '晚上冷，火别灭了。',
    '谁有针？借我用一下。', '我男人在 3 号线上班。那天以后……', '换一包盐，什么都行。', '方姨今天心情不错。', '老铁那台机器又响了。',
    '小满又在画火车。', '车灯？哪还有车灯。', '老谢的广播你听过吗？', '外面那些机器，越来越多了。', '睡吧，明天还要排队。',
    '我数过，墙上有三百多个名字。', '别靠近轨道。', '有人说今晚会来车。', '你从哪条线来的？', '这块布还能补。',
    '水要省着喝。', '火旁边暖和，过来坐。', '我闻到菜香了。', '那个门卫，以前是警察。', '等车的人，总得有点事做。',
    { s: '听说有张货票，编号和 E-17 对得上。', when: pf => has(pf, 'rumor') },
    { s: '调度副本？他们早就知道车不会停。', when: pf => has(pf, 'dispatch') },
    { s: '清单上写了一百四十二个人，我们站台上的一个都没算。', when: pf => has(pf, 'manifest') },
  ];
  const GATE_HI = '又是你。进去吧，别乱跑。';
  function lineFor(S, p) {
    const pf = S.raid.pf;
    if (p.named) return D.Outpost ? D.Outpost.idleLine(pf, p.id) || null : null;
    if (p.beh === 'lie') return S.rng.chance(0.5) ? '……' : null;
    const pool = CROWD_LINES.filter(l => typeof l === 'string' || l.when(pf)).map(l => (typeof l === 'string' ? l : l.s));
    return S.rng.pick(pool);
  }
  function chat(S, p, s, me) {
    const T = S.town; if (!T || !s) return;
    T.chats = T.chats.filter(c => c.p !== p);
    T.chats.push({ p, s, t: 0, dur: me ? 1.8 : TUNE.chatDur, me: !!me }); T.said = (T.said | 0) + 1;
  }

  // ── 进站：S.town、关掉时刻表、横幅
  const es0 = D.enterStation;
  D.enterStation = function (raid, st, step, o) {
    const S = es0.apply(this, arguments);
    if (S && S.floors && S.floors[0] && S.floors[0].town) {
      S.town = { gate: S.floors[1].townGate, chats: [], chatT: 2.5, noGun: -9, greeted: false };
      for (const F of S.floors) if (F.lift) { for (const i of F.lift.cells || []) F.solid[i] = 0; delete F.lift; } // 小镇只有两层，走楼梯，不放电梯（lift.js 会往广场里塞一部）
      S.liftFloors = null; S.liftOn = false;
      D.schedHold(S); // 没有倒计时：车一直停在站台上等你，走到站台下沿就上车（用户：出站直接坐车，不用叫）
      S.banner = { t: 0, text: st.name, sub: '人类据点 · 这里的人还在等车' };
    }
    return S;
  };

  // ── 每帧：收枪，然后跑门、站民、闲话
  const NOGUN = ['fire', 'charge', 'melee', 'meleeHeld', 'reload', 'ammo', 'q', 'e', 'skill', 'nade', 'nadeHeld', 'nadeCycle'];
  const ss0 = D.stepStation;
  D.stepStation = function (S, dt, inp) {
    if (!S || !S.town) return ss0.apply(this, arguments);
    const T = S.town;
    if (inp) {
      const tried = inp.fire || inp.charge || inp.melee || inp.skill || inp.nade || inp.q || inp.e || inp.reload;
      if (tried && !S.lootOpen && !S.intro && !S.over && S.t - T.noGun > TUNE.noGunGap) { T.noGun = S.t; chat(S, S.player, '这里不许动枪', true); sfx('nope'); }
      for (const k of NOGUN) if (k in inp) inp[k] = k === 'nadeCycle' ? 0 : false;
    }
    const r = ss0.call(this, S, dt, inp);
    if (S.town && !S.ponly) townStep(S, dt); // 联机：队友那一遍不再走一次站民
    return r;
  };
  function townStep(S, dt) {
    const T = S.town, p = S.player, pf = S.raid.pf;
    // 门：第一次来，陈守的话没看完不让上楼
    const met = D.Outpost && D.Outpost.state(pf).seen.chen1;
    if (S.f === 1 && T.gate && !S.over) {
      const G = T.gate, inGate = p.x > G.x0 - 4 && p.x < G.x1 + 4;
      if (!met && inGate && p.y < G.y) {
        p.y = G.y + 2; if (p.vy < 0) p.vy = 0;
        if (!S.lootOpen && S.t > (T.gateT || 0)) { T.gateT = S.t + 1.2; S.events.push({ type: 'outpost', id: 'chen' }); }
      }
      if (met && !T.greeted && Math.hypot(p.x - (G.x0 + G.x1) / 2, p.y - G.y) < 60) { T.greeted = true; const chen = (S.people || []).find(q => q.id === 'chen'); if (chen) chat(S, chen, GATE_HI); }
    }
    // 站民：逛街、小孩跑、转头看你
    for (const q of S.people || []) {
      q.moving = false;
      if (q.beh === 'stroll' || q.beh === 'kid') {
        if (q.wait > 0) q.wait -= dt;
        else {
          const tx = q.dir > 0 ? q.bx : q.ax, d = tx - q.x, sp = q.beh === 'kid' ? TUNE.kidSpeed : TUNE.strollSpeed;
          q.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt); q.moving = true; if (d) q.face = Math.sign(d);
          if (Math.abs(tx - q.x) < 0.5) { q.dir = -q.dir; q.wait = q.beh === 'kid' ? S.rng.range(0.2, 0.9) : S.rng.range(1.2, 4); }
        }
      }
      if (!q.moving && q.f === S.f && Math.hypot(q.x - p.x, q.y - p.y) < TUNE.lookRange && Math.abs(q.x - p.x) > 1) q.face = Math.sign(p.x - q.x);
    }
    // 闲话
    for (const c of T.chats) c.t += dt;
    T.chats = T.chats.filter(c => c.t < c.dur);
    T.chatT -= dt;
    if (T.chatT <= 0 && !S.intro) {
      T.chatT = S.rng.range(TUNE.chatGap[0], TUNE.chatGap[1]);
      const near = (S.people || []).filter(q => q.f === S.f && Math.hypot(q.x - p.x, q.y - p.y) < TUNE.chatRange && !T.chats.some(c => c.p === q));
      for (const q of S.rng.shuffle(near)) { const s = lineFor(S, q); if (s) { chat(S, q, s); break; } } // 挑到没话说的（躺着的、有名字但没闲话的）换下一个，不白等一轮
    }
  }
  // build 把门和铃记在楼层上，进站时取出来
  const build0 = build;
  function buildTown(rng, st, opt) { const floors = build0(rng, st, opt); floors[1].townGate = opt.town.gate; return floors; }

  // ── 画：据点里不画子弹条；光照之后画闲话气泡和招牌（draw.js 调 D.drawTownOverlay）
  const ah0 = D.drawAmmoHud;
  D.drawAmmoHud = function (ctx, S) { if (S && S.town) return; return ah0.apply(this, arguments); };
  D.drawTownOverlay = function (ctx, S, cx, cy) {
    const T = S.town; if (!T) return;
    const F = S.A, W = ctx.canvas.width, Hh = ctx.canvas.height, tr = D.tr || (s => s);
    ctx.save(); ctx.font = D.PXF; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    // 招牌
    for (const g of F.signs2 || []) {
      const x = Math.round((g.x - cx) * Z), y = Math.round((g.y - cy) * Z) - 16;
      if (x < -120 || x > W + 120 || y < -30 || y > Hh + 30) continue;
      const s = tr(g.s), w = Math.ceil(ctx.measureText(s).width) + 10;
      ctx.fillStyle = 'rgba(20,12,8,0.82)'; ctx.fillRect(x - w / 2, y, w, 16);
      ctx.fillStyle = g.col; ctx.fillRect(x - w / 2, y + 15, w, 1);
      ctx.fillStyle = g.col; ctx.fillText(s, x, y + 2);
    }
    // 闲话气泡
    for (const c of T.chats) {
      const q = c.p; if (q !== S.player && q.f !== S.f) continue;
      const head = q === S.player ? 30 : q.pose === 'lie' ? 14 : q.pose === 'sit' ? 22 : q.pose === 'kid' || q.pose === 'kidrun' ? 18 : 26;
      const k = Math.min(1, c.t / 0.15) * Math.min(1, (c.dur - c.t) / 0.3), lift = (1 - Math.min(1, c.t / 0.15)) * 4;
      const x = Math.round((q.x - cx) * Z), y = Math.round((q.y - head - cy) * Z - 22 + lift);
      if (x < -200 || x > W + 200 || y < -40 || y > Hh + 20) continue;
      const s = tr(c.s), w = Math.ceil(ctx.measureText(s).width) + 12;
      ctx.globalAlpha = k;
      ctx.fillStyle = '#0b0a14'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 20);
      ctx.fillStyle = c.me ? '#3a1520' : '#f4ead8'; ctx.fillRect(x - w / 2, y, w, 18);
      ctx.fillRect(x - 2, y + 18, 4, 3); ctx.fillStyle = '#0b0a14'; ctx.fillRect(x - 1, y + 21, 2, 1);
      ctx.fillStyle = c.me ? '#ff8a9a' : '#2a1f19'; ctx.fillText(s, x, y + 3);
    }
    ctx.restore();
  };

  // ── 线路图图例：多一项"人类据点"（ui-raid.js 加载时把 legend 解构走了，所以本文件要在它之前加载）
  const X0 = D.UI && D.UI._;
  if (X0 && X0.legend) {
    const lg0 = X0.legend;
    X0.legend = function () {
      const h = lg0.apply(this, arguments), c = D.NODE_CAT.town, sh = D.NODE_CAT.shop;
      if (!c || h.includes(c.name + '</span>')) return h;
      const span = `<span><img src="${D.glyphURL(c.glyph, c.col, 32)}">${c.name}</span>`, at0 = h.indexOf(sh.name + '</span>');
      return at0 < 0 ? h : h.slice(0, at0 + sh.name.length + 7) + span + h.slice(at0 + sh.name.length + 7);
    };
  }

  // ── 站点说明（data.js 有别的会话在改，这里覆盖）
  if (D.STATION_TYPES && D.STATION_TYPES.outpost) D.STATION_TYPES.outpost.desc = '住着等过末班车的人。收枪、不限时，有收货、换物、修械、诊所，没有敌人';

  D.OutpostTown = { TUNE, is: isTownSt, build: buildTown, chat, CROWD_LINES, GATE_HI, isTown: S => !!(S && S.town) };
})(D);
