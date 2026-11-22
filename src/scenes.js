/* Underdog · 小样二：试玩反馈第 5 轮——更多车站场景和站内区域。
   1. 三种新骨架：换乘枢纽（大中庭、柱阵、天光）、车辆段（站厅换成停车场：轨道、停着的车厢能进去搜、检修坑、调度塔）、高架（站在半空：墙的位置画夜空和城市灯光）。
   2. 检修管道层：约四成有敌人的站，站台上方有检修口；两格宽的管道迷宫、金属格栅地面、管道交汇处的小机房、会喷蒸汽的阀门。
   3. 楼上的大厦：市区的站（商圈、银行、博物馆、数据中心、调度中心、医院）危险 1 以上的六成连着一栋大厦：大堂 + 办公层。
   挂钩：level.js 的 D.genConcourseX / D.floorsX / D.paintWallX / D.LV，ui.js 的 D.stationExtras，world.js 的 K.worldPost / D.drawExtras。
   设计：design/试玩反馈-5-车站场景.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, K = D.K || (D.K = {});
  const sfx = n => D.Sfx && D.Sfx.play(n);

  // ── 新主题（pattern 是地面花纹，look.js 和下面的 paintFloorTile 认）
  Object.assign(D.THEMES, {
    atrium: { name: '枢纽大厅', floor: ['#5a5f70', '#5f6476', '#565b6c'], grout: '#767c92', wall: '#14161f', face: ['#3a3f52', '#474d62'], neon: ['#e8f4ff', '#ffd27a'], ambient: '#2e3246', lamp: '#f4f0e0', pattern: 'marble' },
    yard:   { name: '车辆段', floor: ['#2e2c2a', '#33302d', '#2a2826'], grout: '#1e1c1a', wall: '#0d0e14', face: ['#26272e', '#2e3038'], neon: ['#ffb057', '#ff3d3d'], ambient: '#17181f', lamp: '#ffd9a0', pattern: 'gravel' },
    sky:    { name: '高架', floor: ['#3a3e4c', '#3e4252', '#363a48'], grout: '#2a2d38', wall: '#0a0d1c', face: ['#141a30', '#1a2240'], neon: ['#ff3d8b', '#3ee8ff', '#ffd27a'], ambient: '#28305a', lamp: '#cfe0ff', pattern: 'slab' },
    pipe:   { name: '检修管道', floor: ['#23262b', '#262a2f', '#202327'], grout: '#14161a', wall: '#0b0c10', face: ['#1f2226', '#272b30'], neon: ['#ff9a3a', '#7fd8ff'], ambient: '#1c1d24', lamp: '#ffb870', pattern: 'grate' },
    office: { name: '写字楼', floor: ['#2a2f3d', '#2d3242', '#283040'], grout: '#232838', wall: '#0e1018', face: ['#20263a', '#283048'], neon: ['#bfe8ff', '#ffd27a'], ambient: '#1d2132', lamp: '#fff0d0', pattern: 'carpet' },
  });
  // ── 新房间
  Object.assign(D.ROOMS, {
    atrium:   { name: '中庭', floor: 'theme', props: [['pillar', 6], ['bench', 2], ['planter', 2], ['vending', 1]], cont: [['locker', 2], ['trash', 1], ['vendor', 1], ['parcel', 1]], nCont: [2, 4] },
    tracks:   { name: '轨道区', floor: 'theme', props: [['barrel', 1], ['crate', 1]], cont: [['crate', 1], ['wreck', 1]], nCont: [0, 2] },
    traincar: { name: '列车车厢', floor: ['#2a2c36', '#2d2f39'], props: [['bench', 2]], cont: [['locker', 1], ['parcel', 1], ['corpse', 1], ['trash', 2], ['mailbag', 1]], nCont: [1, 2], lamp: '#e8f0ff' },
    pit:      { name: '检修坑', floor: ['#1e1f24', '#22232a'], props: [['machine', 2], ['barrel', 2]], cont: [['toolcart', 2], ['toolbox', 2], ['wreck', 1], ['partsbin', 1]], nCont: [2, 3], dim: true },
    yardctl:  { name: '调度塔', floor: ['#1c2232', '#20263a'], props: [['desk', 3], ['machine', 1]], cont: [['pc', 2], ['filecab', 1], ['safe', 1]], nCont: [2, 3], lamp: '#3ee8ff' },
    pipejunction: { name: '管道交汇处', floor: 'theme', props: [['machine', 2], ['barrel', 2]], cont: [['toolbox', 1], ['partsbin', 1], ['toolcart', 1], ['crate', 1]], nCont: [1, 2], dim: true },
    lobby:    { name: '大堂', floor: ['#3c3a44', '#413f4a'], props: [['planter', 3], ['bench', 2], ['kiosk', 1], ['vending', 1]], cont: [['register', 1], ['vendor', 1], ['mailbag', 1], ['locker', 1]], nCont: [1, 3], lamp: '#fff0d0' },
    openoffice: { name: '开放办公区', floor: 'theme', props: [['desk', 8], ['cabinet', 2], ['planter', 1]], cont: [['pc', 3], ['filecab', 2], ['mailbag', 1], ['locker', 1]], nCont: [3, 5] },
    meeting:  { name: '会议室', floor: ['#2c2a33', '#302e38'], props: [['desk', 4]], cont: [['pc', 1], ['filecab', 1]], nCont: [1, 2] },
    exec:     { name: '高管办公室', floor: ['#3a2c26', '#40312a'], props: [['desk', 2], ['cabinet', 2], ['planter', 2]], cont: [['safe', 2], ['showcase', 1], ['evidence', 1]], nCont: [2, 3], bonus: 1, lamp: '#ffd27a' },
  });
  // ── 新骨架（6 → 9）
  Object.assign(D.LAYOUTS, {
    hub:      { name: '换乘枢纽', desc: '一个特别大的中庭，柱子排成方阵，顶上一块天光；房间围一圈' },
    yard:     { name: '车辆段', desc: '站厅是停车场：几条轨道上停着列车，车厢能进去搜；还有检修坑和调度塔' },
    elevated: { name: '高架站', desc: '站在半空：四周是夜空和城市灯光' },
  });
  D.LAYOUT_W.push(['hub', 1.2], ['yard', 1.2], ['elevated', 1.4]);
  D.SCENE_LAYOUTS = ['hub', 'yard', 'elevated']; // 这三种骨架的站厅用自己的主题，不跟站的类型走

  // ── 哪些站有检修管道、楼上连着大厦（按站号定死）
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const TOWER_TYPES = new Set(['market', 'bank', 'museum', 'datacenter', 'dispatch', 'hospital']);
  const plain = st => st && !st.home && !st.reserve && !st.tut && !(D.STATION_TYPES[st.type] || {}).safe;
  D.towerOf = st => plain(st) && TOWER_TYPES.has(st.type) && (st.tier || 0) >= 1 && hash('tower:' + st.id) % 100 < 60 ? st.name + '大厦' : null;
  D.pipesOf = st => plain(st) && hash('pipes:' + st.id) % 100 < 40;
  D.stationExtras = s => { const t = D.towerOf(s), p = D.pipesOf(s); return t || p ? `<div class="sc-desc">${t ? `<b>楼上</b>：${t}` : ''}${t && p ? ' · ' : ''}${p ? '<b>检修管道</b>：站台上方有检修口' : ''}</div>` : ''; };

  // ── 站厅层：换乘枢纽、车辆段
  D.genConcourseX = function (rng, st, opt, lay) { return lay === 'hub' ? genHub(rng, st, opt) : lay === 'yard' ? genYard(rng, st, opt) : null; };
  const HV_FORCE = { bank: 'vault', datacenter: 'server', museum: 'gallery' };
  function genHub(rng, st, opt) {
    const L = D.LV, F = L.newFloor(56, 34, '站厅层', 'atrium'), hall = L.addRoom(F, 9, 8, 38, 17, 'atrium');
    const slots = [[2, 2, 12, 5], [16, 2, 12, 5], [30, 2, 12, 5], [43, 2, 11, 5], [2, 27, 12, 5], [16, 27, 12, 5], [30, 27, 12, 5], [43, 27, 11, 5], [2, 10, 6, 7], [2, 18, 6, 7], [48, 10, 6, 7], [48, 18, 6, 7]];
    rng.shuffle(slots);
    const pool = L.pool(st), n = rng.int(6, 8); let hv = HV_FORCE[st.type] || (!opt.safe && (st.tier || 0) >= 1 && rng.chance(0.2 + st.tier * 0.12) ? rng.pick(['vault', 'server', 'jewelry', 'gallery']) : null), hid = false;
    for (let i = 0; i < n; i++) {
      const [sx, sy, sw, sh] = slots[i], w = Math.max(5, sw - rng.int(0, 2)), h = Math.max(4, sh - rng.int(0, 1)), x = sx + rng.int(0, sw - w), y = sy + rng.int(0, sh - h);
      const hidden = !hid && i >= 3 && rng.chance(0.4);
      let kind = hidden ? 'hidden' : rng.weighted(pool);
      if (!hidden && hv && w * h >= 30) { kind = hv; hv = null; }
      const r = L.addRoom(F, x, y, w, h, kind, { hidden, hv: !!D.ROOMS[kind].hv }); if (hidden) hid = true;
      L.corridor(F, r, hall, rng, hidden);
    }
    F.stairs.push({ x: (hall.x + hall.w / 2) * TS, y: (hall.y + hall.h - 1) * TS, dir: 'down', label: '下到站台层', to: 1 });
    for (const dx of [-8, 0, 8]) F.lights.push({ x: (hall.x + hall.w / 2 + dx) * TS, y: (hall.y + hall.h / 2) * TS, oy: 0, r: 150, col: '#eef6ff', a: 0.7, flick: 0.01, seed: 3 + dx, shaft: false }); // 天光：中庭正中一大片柔光
    if (st.type === 'relay') opt.relay = { f: 0, x: (hall.x + 6) * TS, y: (hall.y + 3) * TS };
    return F;
  }
  // 车厢：外框一圈是车壁（实心），里面三行是车厢，门开在下沿正中
  function car(F, x, y, w, h) {
    const L = D.LV, r = { x: x + 1, y: y + 1, w: w - 2, h: h - 2, kind: 'traincar', name: D.ROOMS.traincar.name, i: F.rooms.length, seen: false };
    F.rooms.push(r);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = L.idx(F, xx, yy), edge = yy === y || yy === y + h - 1 || xx === x || xx === x + w - 1; F.solid[i] = edge ? 1 : 0; F.kind[i] = edge ? 1 : 0; F.room[i] = edge ? -1 : r.i; }
    const dx = x + Math.floor(w / 2) - 1; for (const xx of [dx, dx + 1]) { const i = L.idx(F, xx, y + h - 1); F.solid[i] = 0; F.kind[i] = 0; F.room[i] = r.i; }
    (F.cars = F.cars || []).push({ x, y, w, h, door: dx });
  }
  function genYard(rng, st, opt) {
    const L = D.LV, F = L.newFloor(60, 34, '车辆段', 'yard'), yard = L.addRoom(F, 2, 8, 56, 24, 'tracks');
    F.lanes = [10, 17, 24]; // 每条轨道 5 行（车厢外框）；轨道之间、最下面是能走的空地
    for (const ly of F.lanes) {
      let x = 3 + rng.int(0, 4);
      while (x + 12 < 56) { if (rng.chance(0.78)) { const w = rng.int(12, 16); if (x + w > 57) break; car(F, x, ly, w, 5); x += w + rng.int(3, 7); } else x += rng.int(6, 10); }
    }
    const tops = [[3, 2, 12, 5, 'yardctl'], [20, 2, 16, 5, 'pit'], [41, 2, 15, 5, rng.weighted(L.pool(st))]];
    for (const [x, y, w, h, k] of tops) { const r = L.addRoom(F, x, y, w, h, k, { hv: !!D.ROOMS[k].hv }); L.corridor(F, r, { x: x + Math.floor(w / 2) - 1, y: 8, w: 2, h: 2 }, rng); }
    F.stairs.push({ x: 30 * TS, y: 30 * TS, dir: 'down', label: '下到站台层', to: 1 });
    for (const lx of [10, 30, 50]) F.lights.push({ x: lx * TS, y: 9 * TS, oy: 0, r: 170, col: '#ffe2b0', a: 0.75, flick: 0.03, seed: lx, shaft: true }); // 探照灯
    if (st.type === 'relay') opt.relay = { f: 0, x: 8 * TS, y: 30 * TS };
    return F;
  }

  // ── 换主题（高架）、检修管道层、楼上的大厦
  function retheme(F, th) { F.theme = th; F.th = D.tintTheme(D.THEMES[th], D.LV.line()); F.ambient = F.th.ambient; }
  D.floorsX = function (floors, rng, st, opt, lay) {
    if (opt.tut || opt.safe) return;
    if (lay === 'elevated') for (const F of floors.slice(0, 2)) { retheme(F, 'sky'); F.open = true; }
    if (D.pipesOf(st)) {
      const at = floors.length, PF = genPipes(rng, st); floors.push(PF);
      floors[1].stairs.push({ x: 10 * TS, y: 13 * TS, dir: 'down', label: '钻进检修管道', to: at, hatch: true });
    }
    const tw = D.towerOf(st);
    if (tw) {
      const li = floors.length, oi = li + 1, Lb = genLobby(rng, tw), Of = genOffice(rng, tw); floors.push(Lb, Of);
      Lb.stairs[1].to = oi; Of.stairs[0].to = li;
      const c = floors[0], h = c.rooms.find(r => r.kind === 'hall' || r.kind === 'atrium' || r.kind === 'tracks') || c.rooms[0];
      c.stairs.push({ x: (h.x + h.w - 4) * TS, y: (h.y + 1) * TS + 6, dir: 'up', label: '上到' + tw, to: li, tower: true });
    }
  };
  function genPipes(rng, st) {
    const L = D.LV, F = L.newFloor(50, 30, '检修管道', 'pipe'), NX = 6, NY = 4, node = (gx, gy) => ({ x: 4 + gx * 8, y: 3 + gy * 7 });
    // 管道走廊：随机深搜的生成树 + 几条环路，两格宽
    const seen = new Set(['0,0']), stack = [[0, 0]], links = [], deg = {};
    while (stack.length) {
      const [x, y] = stack[stack.length - 1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, y + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < NX && b < NY && !seen.has(a + ',' + b));
      if (!nb.length) { stack.pop(); continue; }
      const n = rng.pick(nb); seen.add(n.join(',')); links.push([[x, y], n]); stack.push(n);
    }
    for (let i = 0; i < 4; i++) { const a = [rng.int(0, NX - 2), rng.int(0, NY - 1)]; links.push([a, [a[0] + 1, a[1]]]); }
    for (const [a, b] of links) { const p = node(...a), q = node(...b); L.carve(F, Math.min(p.x, q.x), Math.min(p.y, q.y), Math.abs(p.x - q.x) + 2, Math.abs(p.y - q.y) + 2); deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; }
    // 交汇处的小机房：死胡同那头的更可能是隐藏仓库
    const nodes = []; for (let gy = 0; gy < NY; gy++) for (let gx = 0; gx < NX; gx++) if (gx || gy) nodes.push([gx, gy]);
    rng.shuffle(nodes); let hid = false;
    for (const [gx, gy] of nodes.slice(0, 5)) {
      const p = node(gx, gy), leaf = (deg[[gx, gy]] || 0) <= 1, hidden = leaf && !hid && rng.chance(0.6);
      const kind = hidden ? 'hidden' : rng.weighted([['pipejunction', 3], ['power', 2], ['storage', 1]]);
      L.addRoom(F, Math.max(1, p.x - 2), Math.max(2, p.y - 1), 6, 4, kind, { hidden }); if (hidden) hid = true;
    }
    const s0 = node(0, 0);
    F.stairs.push({ x: (s0.x + 1) * TS, y: s0.y * TS + 6, dir: 'up', label: '爬出检修口', to: 1 });
    // 走廊里也有灯、也会刷敌人
    for (let gy = 0; gy < NY; gy++) for (let gx = 0; gx < NX; gx++) { const p = node(gx, gy); F.lights.push({ x: (p.x + 1) * TS, y: p.y * TS - 2, oy: 26, r: (gx + gy) % 2 ? 78 : 56, col: (gx + gy) % 3 ? '#ffb870' : '#7fd8ff', a: 0.7, flick: 0.2, seed: rng() * 100, shaft: false }); if (gx + gy >= 2 && rng.chance(0.45)) F.spawns.push({ x: (p.x + 1) * TS, y: (p.y + 1) * TS, room: -1, w: 40, h: 40 }); }
    // 蒸汽阀：走廊上、离入口远一点
    F.vents = [];
    for (let tries = 0; F.vents.length < 6 && tries < 300; tries++) {
      const tx = rng.int(2, F.tw - 3), ty = rng.int(3, F.tht - 3), i = L.idx(F, tx, ty);
      if (F.solid[i] || F.room[i] >= 0 || Math.hypot(tx - s0.x, ty - s0.y) < 8 || F.vents.some(v => Math.hypot(v.tx - tx, v.ty - ty) < 6)) continue;
      F.vents.push({ tx, ty, x: tx * TS + 8, y: ty * TS + 8, ph: rng() * 4.5 });
    }
    F.dark = true; F.foes = [['mite', 3], ['crawler', 3], ['stalker', 1.5]];
    return F;
  }
  function genLobby(rng, name) {
    const L = D.LV, F = L.newFloor(48, 26, name + ' · 大堂', 'office'), lobby = L.addRoom(F, 4, 9, 40, 12, 'lobby'); F.tower = true;
    for (const [x, y, w, h, k] of [[3, 2, 12, 5, 'security'], [18, 2, 12, 5, 'lounge'], [33, 2, 12, 5, 'office']]) { const r = L.addRoom(F, x, y, w, h, k); L.corridor(F, r, lobby, rng); }
    F.stairs.push({ x: 8 * TS, y: 20 * TS, dir: 'down', label: '回到站厅层', to: 0 }, { x: 40 * TS, y: 10 * TS + 6, dir: 'up', label: '上到办公层', to: -1 });
    F.foes = [['drone', 3], ['sniper', 1]]; // 大厦的安保系统
    return F;
  }
  function genOffice(rng, name) {
    const L = D.LV, F = L.newFloor(52, 30, name + ' · 办公层', 'office'), open = L.addRoom(F, 8, 10, 36, 10, 'openoffice'); F.tower = true;
    for (const [x, y, w, h, k] of [[2, 2, 14, 6, 'exec'], [19, 2, 14, 6, 'meeting'], [36, 2, 14, 6, rng.chance(0.5) ? 'exec' : 'meeting'], [2, 22, 14, 6, 'server'], [19, 22, 14, 6, 'openoffice'], [36, 22, 14, 6, 'office']]) {
      const r = L.addRoom(F, x, y, w, h, k, { hv: !!D.ROOMS[k].hv }); L.corridor(F, r, open, rng);
    }
    F.stairs.push({ x: 12 * TS, y: 19 * TS, dir: 'down', label: '下到大堂', to: -1 });
    F.foes = [['drone', 3], ['sniper', 1]];
    return F;
  }

  // ── 楼层自己的敌人：站里照常刷完怪以后，带 F.foes 的楼层（检修管道、大厦）有一半的怪换成这层的
  const sg0 = K.spawnGarrison;
  if (sg0) K.spawnGarrison = function (S, rng) {
    const r = sg0.apply(this, arguments);
    S.floors.forEach((F, fi) => {
      if (!F.foes) return;
      for (const e of S.enemies.slice()) {
        const b = D.ENEMIES[e.kind] || {};
        if (e.f !== fi || e.dead || b.boss || b.elite || b.line || !rng.chance(0.55)) continue; // 线路特有的敌人（焊工机、橱窗假人、野狗机）不换
        const k = rng.weighted(F.foes); if (k === e.kind || !D.ENEMIES[k]) continue;
        S.enemies.splice(S.enemies.indexOf(e), 1);
        const n = K.spawnEnemy(S, k, e.x, e.y, 0.6, fi); n.home = e.home;
      }
    });
    return r;
  };

  // ── 高架：灯不是天花板的光锥，换成路灯（要等 decorate 放完灯，所以挂在 D.stationMod 之后）
  const sm0 = D.stationMod;
  D.stationMod = function (F, rng, st, fi) {
    if (sm0) sm0(F, rng, st, fi);
    if (F.open) for (const l of F.lights) { l.shaft = false; l.col = '#d8e6ff'; l.r = Math.max(l.r, 110); l.a = Math.min(0.75, l.a); }
  };
  // ── 墙：高架的夜空和城市、写字楼的窗、管道墙、列车车壁
  const inCar = (F, tx, ty) => F.cars && F.cars.find(c => tx >= c.x && tx < c.x + c.w && ty >= c.y && ty < c.y + c.h);
  D.paintWallX = function (x, ex, F, tx, ty, isFloor, rng) {
    const T2 = TS * D.Z, px = tx * T2, py = ty * T2, R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); }, E = (a, b, w, h, col) => { ex.fillStyle = col; ex.fillRect(a, b, w, h); };
    const c = inCar(F, tx, ty);
    if (c) { // 列车车壁：银色车身、红色腰线；上下两边开窗
      R(px, py, T2, T2, '#8f97ab'); R(px, py, T2, 2, '#c8cfe0'); R(px, py + T2 - 3, T2, 3, '#4a5068');
      const top = ty === c.y, bot = ty === c.y + c.h - 1, side = tx === c.x || tx === c.x + c.w - 1;
      if (!side) { R(px, py + 18, T2, 3, '#c82e3a'); if ((top || bot) && tx % 3 !== 0) { R(px + 4, py + 5, T2 - 8, 10, '#1c2238'); E(px + 5, py + 6, T2 - 10, 8, 'rgba(232,240,255,.35)'); } }
      else { R(px + (tx === c.x ? 0 : T2 - 4), py, 4, T2, '#5c6378'); }
      return true;
    }
    if (F.open) { // 高架：墙的位置是夜空；挨着地面的那一排画远处的城市和栏杆
      const g = x.createLinearGradient(0, py, 0, py + T2); g.addColorStop(0, '#0a0d1c'); g.addColorStop(1, '#1a2040'); x.fillStyle = g; x.fillRect(px, py, T2, T2);
      if (((tx * 7 + ty * 13) % 11) === 0) E(px + ((tx * 5) % 28), py + ((ty * 3) % 20), 1, 1, 'rgba(220,230,255,.8)'); // 星
      // 地面往上三排墙里画远处的楼（每一列一栋，高矮不一），挨着地面那排加栏杆
      let k = 0; for (let d = 1; d <= 3; d++) if (isFloor(tx, ty + d)) { k = d; break; }
      if (k) {
        const bh = 26 + ((tx * 37 + 11) % 64), top = Math.max(py, py + T2 * k - bh), col = ((tx * 5) % 3) ? '#0d1124' : '#111733';
        if (top < py + T2) { R(px, top, T2, py + T2 - top, col); for (let wy = top + 3; wy < py + T2 - 2; wy += 4) for (let wx = px + 2; wx < px + T2 - 2; wx += 5) if (((wx * 3 + wy * 7 + tx) % 5) < 2) E(wx, wy, 2, 2, ((wx + wy) % 3 ? 'rgba(255,214,140,.8)' : 'rgba(130,220,255,.7)')); if (top > py + 1 && (tx % 4 === 0)) E(px + 14, top - 2, 2, 2, 'rgba(255,60,80,.9)'); }
        if (k === 1) { R(px, py + T2 - 4, T2, 1, '#8a93b0'); R(px, py + T2 - 1, T2, 1, '#5c6380'); for (let q = 2; q < T2; q += 8) R(px + q, py + T2 - 4, 1, 4, '#6f7894'); } // 栏杆
      }
      return true;
    }
    if (F.tower && isFloor(tx, ty + 1)) { // 写字楼：整面落地窗，窗外城市灯光
      R(px, py, T2, T2, '#141a2c'); R(px, py, T2, 2, '#3a4260'); R(px + T2 - 2, py, 2, T2, '#2a3048');
      for (let wy = py + 4; wy < py + T2 - 3; wy += 3) for (let wx = px + 2; wx < px + T2 - 3; wx += 4) if (((wx * 7 + wy * 3 + ty) % 7) < 2) E(wx, wy, 1, 1, (wx + wy) % 2 ? 'rgba(255,220,150,.75)' : 'rgba(160,220,255,.6)');
      R(px, py + T2 - 3, T2, 3, '#2d3550');
      return true;
    }
    if (F.theme === 'pipe' && isFloor(tx, ty + 1)) { // 管道墙：几根横着的管子、阀门
      R(px, py, T2, T2, '#1d2024'); R(px, py, T2, 3, '#0a0b0e');
      for (const [yy, col, hi] of [[7, '#3a4048', '#5c6470'], [16, '#4a3a2a', '#7a5a3a'], [24, '#2e3440', '#4e5868']]) { R(px, py + yy, T2, 4, col); R(px, py + yy, T2, 1, hi); }
      if ((tx * 13 + ty) % 6 === 0) { R(px + 12, py + 14, 8, 8, '#8a2a2a'); R(px + 15, py + 11, 2, 14, '#c8402a'); }
      if ((tx * 7 + ty * 3) % 9 === 0) E(px + 4, py + 9, 2, 2, 'rgba(255,170,80,.8)');
      return true;
    }
    return false;
  };
  // ── 地面：大理石、碎石 + 轨道、格栅、地毯、车厢地板
  const pf0 = D.paintFloorTile;
  D.paintFloorTile = function (x, F, tx, ty, rng) {
    pf0(x, F, tx, ty, rng);
    const T2 = TS * D.Z, px = tx * T2, py = ty * T2, R = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
    const ri = F.room[ty * F.tw + tx], r = ri >= 0 ? F.rooms[ri] : null, base = F.th.floor[(tx * 7 + ty * 13) % F.th.floor.length];
    if (r && r.kind === 'traincar') { R(px, py, T2, T2, '#2a2c36'); R(px, py + T2 - 1, T2, 1, '#202230'); if (ty === r.y + 1) R(px, py + 15, T2, 2, '#e3c14a'); return; }
    if (r && D.ROOMS[r.kind] && D.ROOMS[r.kind].floor !== 'theme') return;
    const pat = F.th.pattern;
    if (pat === 'marble') { R(px, py, T2, T2, base); if (tx % 2 === 0) R(px, py, 1, T2, F.th.grout); if (ty % 2 === 0) R(px, py, T2, 1, F.th.grout); if ((tx * 11 + ty * 5) % 4 === 0) { x.strokeStyle = 'rgba(255,255,255,.07)'; x.beginPath(); x.moveTo(px + 3, py + 4); x.lineTo(px + 14, py + 12); x.lineTo(px + 26, py + 9); x.stroke(); } R(px + 1, py + 1, T2 - 2, 1, 'rgba(255,255,255,.05)'); }
    else if (pat === 'gravel') {
      R(px, py, T2, T2, base); for (let i = 0; i < 14; i++) R(px + ((tx * 17 + i * 13 + ty * 7) % T2), py + ((ty * 11 + i * 7 + tx * 3) % T2), 2, 1, i % 3 ? '#3e3a35' : '#1c1a18');
      const lane = F.lanes && F.lanes.find(ly => ty > ly && ty < ly + 4);
      if (lane != null) { // 轨道：枕木 + 两根钢轨
        for (let k = 2; k < T2; k += 8) R(px + k, py, 4, T2, '#3a2a20');
        for (const rr of [lane + 1, lane + 3]) if (ty === rr) { R(px, py + 14, T2, 3, '#7a8094'); R(px, py + 14, T2, 1, '#c8cfe0'); }
      }
    } else if (pat === 'grate') { R(px, py, T2, T2, base); for (let k = 0; k < T2; k += 4) { R(px + k, py, 1, T2, '#16181c'); R(px, py + k, T2, 1, '#16181c'); } R(px, py, T2, 1, '#3a3e46'); }
    else if (pat === 'carpet') { R(px, py, T2, T2, base); for (let i = 0; i < 10; i++) R(px + ((tx * 19 + i * 11) % T2), py + ((ty * 23 + i * 5) % T2), 1, 1, i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.15)'); }
  };

  // ── 蒸汽阀：4.5 秒一轮：嘶嘶 0.7 秒（冒白气），喷 1 秒（站上面掉耐久）
  const CYC = 4.5, WARN = 2.8, BURST = 3.5;
  const wp0 = K.worldPost;
  K.worldPost = function (S, dt) {
    if (wp0) wp0(S, dt);
    const V = S.A && S.A.vents; if (!V || !V.length) return;
    const p = S.player;
    for (const v of V) {
      const t = (S.t + v.ph) % CYC, prev = (S.t - dt + v.ph) % CYC;
      if (t >= WARN && t < BURST && S.rng.chance(0.3)) K.part(S, 'smoke', v.x + S.rng.range(-3, 3), v.y, S.rng.range(-6, 6), S.rng.range(-18, -6), 0.5, '#c8d0dc');
      if (t >= BURST) {
        if (prev < BURST && Math.hypot(p.x - v.x, p.y - v.y) < 220) sfx('cool');
        for (let i = 0; i < 3; i++) K.part(S, 'smoke', v.x + S.rng.range(-6, 6), v.y - 2, S.rng.range(-20, 20), S.rng.range(-60, -25), 0.8, '#e8eef6');
        v.cd = (v.cd || 0) - dt;
        if (v.cd <= 0) {
          v.cd = 0.4;
          if (p.hp > 0 && Math.hypot(p.x - v.x, p.y - v.y) < 13) { if (p.inv > 0) K.perfectDodge(S); else K.damagePlayer(S, 3, { x: v.x, y: v.y, env: true }); }
          for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - v.x, e.y - v.y) < 13) K.hurt(S, e, 3, { dot: true, col: '#e8eef6' });
        }
      }
    }
  };
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    if (de0) de0(S, list, ctx, ex);
    const V = S.A && S.A.vents; if (!V || !V.length) return;
    list.push({ y: -1.5e9, f: () => { for (const v of V) { const t = (S.t + v.ph) % CYC, x = v.x - 6, y = v.y - 4; ctx.fillStyle = '#0b0c10'; ctx.fillRect(x, y, 12, 8); ctx.fillStyle = '#3a3e46'; for (let k = 1; k < 12; k += 3) ctx.fillRect(x + k, y + 1, 1, 6); if (t >= WARN) { ex.fillStyle = t >= BURST ? 'rgba(232,238,246,.55)' : 'rgba(255,150,80,.45)'; ex.fillRect(x, y, 12, 8); } } } });
  };

})(D);
