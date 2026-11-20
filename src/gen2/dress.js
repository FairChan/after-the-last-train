/* 站内地图第二代 P6 任务 2 / 3 · 给不走新骨架的楼层套上后几道工序（design/features/station-gen/plan-p6.md；设计文档"P6 结果"那张表）
   场景骨架（换乘枢纽 hub、车辆段 yard、高架 elevated）的站厅层、附加楼层（检修管道 pipes、楼上大厦 tower 的大堂和办公层）、
   12 种环境和弹坑（crater）的地面 / 站厅层：格局不重写（scenes.js、envs.js、crater-art.js 照旧出图），只接上：
     furn  P2 锚点摆放：decorate 随机放的那部分摆设和容器（打了 dec 标记的）收起来，按 furnish.js 的锚点和动线检查重放；
           种类、个数照旧（容器种类和个数一个不改，bonus 照公式），场景自己摆的（env 的 mine、车厢、蒸汽阀……）不动。
           换乘枢纽的中庭：随手放的柱子换成一片柱网（grid，P5 的横梁、吊灯按它排）。
     vig   P3 小场景（房间种类按 DRESS_KIND 对到小场景认的种类；露天的房间不放带积水 / 漏水桶 / 售票机 / 隔离带的）；
     hist  P3 历史：底子贴花（露天格不撒积水）、敌人站位；历史换容器种类是全站的，照旧在 makeStation 里做；
     wear  P4 磨损路线；dust 墙根积灰；leak 漏水点和积水、水淹的水渍线；cable 线缆；pipe 墙上的横管（露天格一律不画积灰、积水、水渍线、横管）；
     walls P5 墙面分层（只换 D.paintWallX 不管的墙：列车车壁、高架夜空、写字楼的窗、管道墙、环境自己的墙都照旧），亮着的招牌、墙面装饰；
     fore  P5 前景（大厅类房间沿柱网的横梁、吊牌）；lamps P5 灯按房间用途 / 柱网挂（只对室内的房间；露天的没有天花板）。
   地面材质一律保留各自主题的画法（paintFloorTile 和 env-art / scenes 的花纹）。
   开关：D.TUNE.gen2.dress = [骨架 / 楼层的键…]；键是骨架名（hub、yard、elevated、12 种环境、crater）和附加楼层（pipes、tower）。
   随机数：makeStation 对这些站从父流各取一个数（历史、P4 的子流种子，开关关着也取）；这里只用派生的子流（'gen2:dress:' + 楼层号），
     decorate、stationMod、bake 取父流的数一个不变（bake 对候选楼层用自己的子流），所以开关 dress 前后格子（除了摆设、容器位）逐格相同、容器个数和 bonus 相同。
   新代码不写中文字符串常量。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, G2 = D.gen2 = D.gen2 || {};
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // ── 每种骨架 / 楼层开哪几道工序（写进设计文档 P6 结果的表）
  const ALL = { furn: 1, vig: 1, hist: 1, wear: 1, dust: 1, leak: 1, cable: 1, pipe: 1, walls: 1, fore: 1, lamps: 1 };
  const OUTDOOR = { vig: 1, hist: 1, wear: 1, lamps: 1 }; // 户外的：只开小场景、历史、磨损和灯（灯只对里面的室内房间；楼顶 noShaft，房间灯本来就去掉了，不开）
  const T = (o, ...off) => { const r = Object.assign({}, o); for (const k of off) delete r[k]; return r; };
  const STAGES = G2.DRESS_STAGES = {
    hub: ALL,
    yard: T(ALL, 'pipe', 'walls', 'fore'), // 车辆段的轨道区是露天的场院（不画积灰、积水）；墙多是车壁，横梁没有柱网可架
    elevated: T(ALL, 'dust', 'leak', 'cable', 'pipe', 'walls', 'fore', 'lamps'), // 半空中、四面夜空：整层算露天
    pipes: { wear: 1, dust: 1, leak: 1, lamps: 1 }, // 检修管道层只接痕迹和灯（用户定的）
    tower: T(ALL, 'fore'), // 大厦：都能接；大堂、办公区没有柱网，不架横梁
    street: OUTDOOR, park: OUTDOOR, rooftop: T(OUTDOOR, 'lamps'), harbor: OUTDOOR, site: OUTDOOR, nightmkt: OUTDOOR, crater: OUTDOOR,
    sewer: T(ALL, 'walls', 'fore'), garage: T(ALL, 'walls', 'fore'), coldstore: T(ALL, 'walls', 'fore'),
    aquarium: T(ALL, 'pipe', 'walls', 'fore'), greenhouse: T(ALL, 'pipe', 'walls', 'fore'), cave: T(ALL, 'cable', 'pipe', 'walls', 'fore', 'lamps'), // 环境的墙是自己主题的画法（鱼缸、玻璃、岩壁），不换、不挂横管；溶洞没有吊灯（envs.js 的 noShaft）
  };
  const SCENE = ['hub', 'yard', 'elevated'], ENVS12 = ['street', 'park', 'rooftop', 'harbor', 'site', 'nightmkt', 'sewer', 'garage', 'aquarium', 'greenhouse', 'coldstore', 'cave'];
  G2.DRESS_LAYOUTS = new Set(SCENE.concat(ENVS12, ['crater']));
  G2.dressLayout = lay => G2.DRESS_LAYOUTS.has(lay);
  G2.dressOn = key => !!(D.TUNE.gen2 && (D.TUNE.gen2.dress || []).includes(key));
  // 这一层是哪种（键）：附加楼层看主题 / 标记，站厅层看骨架；不是候选的返回 null
  G2.dressKey = (F, fi, lay) => F.gen2 ? null : F.theme === 'pipe' ? 'pipes' : F.tower ? 'tower' : fi === 0 && G2.DRESS_LAYOUTS.has(lay) ? lay : null;
  // makeStation 在 decorate 之前调：标候选（F.g2dc，和开关无关）、按开关和表挂上 F.gen2dress（工序表 + 露天房间、大厅类房间）
  G2.dressPlan = function (F, fi, lay) {
    const key = G2.dressKey(F, fi, lay); if (!key) return null;
    F.g2dc = key;
    if (!G2.dressOn(key)) return null;
    const tune = D.TUNE.gen2 || {}, S = Object.assign({ key }, STAGES[key]);
    if (tune.vig === false) delete S.vig;
    if (tune.wear === false) delete S.wear;
    return (F.gen2dress = S);
  };

  // ── 房间种类对照：场景 / 环境的房间种类 → 小场景、灯具、墙面认的种类（小场景按它挑，灯按它挑灯具，hall = 大厅类）
  const KIND = G2.DRESS_KIND = {
    atrium: 'hall', lobby: 'hall', tracks: 'garage', pit: 'workshop', yardctl: 'control', pipejunction: 'pump', openoffice: 'office', meeting: 'office', exec: 'office',
    road: 'hall', parkland: 'hall', roof: 'hall', helipad: 'hall', quay: 'cargo', siteyard: 'hall', mktstreet: 'hall', craterbed: 'hall',
    sewermain: 'pump', parking: 'garage', aquahall: 'hall', aquatunnel: 'hall', glasshouse: 'storage', coldhall: 'cargo', cavern: 'hidden',
    streetshop: 'shop', diner: 'canteen', parkoffice: 'office', pavilion: 'canteen', warehouse: 'storage', harboroffice: 'office', shipbox: 'cargo',
    siteoffice: 'office', toolshed: 'workshop', pumproom: 'pump', sump: 'pump', lotoffice: 'office', storagecage: 'storage', tankroom: 'hall',
    giftshop: 'shop', feedroom: 'storage', seedroom: 'storage', beeroom: 'storage', freezer: 'storage', compressor: 'power', mine: 'hidden', grotto: 'hidden',
    camp: 'dorm', campruin: 'dorm', scorched: 'workshop',
  };
  G2.roomKind = (F, r) => (r && F && F.gen2dress && KIND[r.kind]) || (r ? r.kind : 'corr');
  // 露天：高架整层；环境的露天房间（D.ROOMS[kind].outdoor）、车辆段的轨道区；露天楼层的走廊
  const OUT_ROOM = { tracks: 1 };
  G2.outRoom = (F, r) => !!(F.open || (r && ((D.ROOMS[r.kind] || {}).outdoor || OUT_ROOM[r.kind])));
  G2.outMask = function (F) {
    if (F._outM !== undefined && F._outN === F.rooms.length) return F._outM;
    const W = F.tw, N = W * F.tht, m = new Uint8Array(N), ro = F.rooms.map(r => G2.outRoom(F, r)); let n = 0, fl = 0;
    for (let i = 0; i < N; i++) { const ri = F.room[i], o = F.open || (ri >= 0 ? ro[ri] : !!F.outdoor); if (o) { m[i] = 1; n++; } if (F.kind[i] === 0) fl++; }
    m.all = !!F.open; F._outN = F.rooms.length;
    return (F._outM = n ? m : null);
  };
  // 小场景：露天的房间不放要屋顶 / 室内设施的（积水、漏水桶、售票机、隔离带）
  const INDOOR_PROP = { bucket: 1, tvm: 1, stanchion: 1, qcurtain: 1 }; // P7：隔离帘挂在室内的钢架上
  G2.vigKind = (F, r) => G2.roomKind(F, r);
  G2.vigDeny = (F, r, v) => {
    if (!F.gen2dress && !F.open) return false;
    if (!G2.outRoom(F, r)) return false;
    if (v._indoor == null) v._indoor = v.cells.some(c => c.decal === 'water' || (c.prop && INDOOR_PROP[c.prop]));
    return v._indoor;
  };
  // 摆设的锚点（furn 模式）：场景 / 环境才有的摆设
  G2.DRESS_ANCHOR = { pillar: 'island', table: 'island', cone: 'any', bush: 'wall', stalagmite: 'any', mushroom: 'corner', crystal: 'wall', iceblock: 'corner', hanging: 'wall', tankpillar: 'wall', growlamp: 'wall', vent: 'any', bollard: 'any', planter: 'wall' };

  // ── 门洞（旧骨架没有 F.doors）：每间房外面、四邻挨着本房间地面的能走的格（含裂缝墙，P7），按横排 / 竖排连成一段，算这间房的一个门洞；r.cells = 本房间地面格数
  G2.dressDoors = function (F) {
    if (F.doors && F._g2doors) return F.doors;
    const W = F.tw, H = F.tht, k = F.kind, out = [], open = i => k[i] === 0;
    for (const r of F.rooms) {
      let cells = 0; const mark = new Set();
      for (let y = Math.max(0, r.y - 1); y < Math.min(H, r.y + r.h + 1); y++) for (let x = Math.max(0, r.x - 1); x < Math.min(W, r.x + r.w + 1); x++) {
        const i = y * W + x;
        if (F.room[i] === r.i) {
          if (!open(i)) continue; cells++;
          // P7：场景 / 环境的房间常把墙上的门口那几格也算进本房间（在房间方框外面那一圈上）：它外面挨着别处的地面，就把这一格当门洞（车辆段的车厢以前找不到门、摆设把门堵了）
          if ((x < r.x || x >= r.x + r.w || y < r.y || y >= r.y + r.h) && N4.some(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false; const j = yy * W + xx; return F.room[j] !== r.i && (open(j) || k[j] === 3); })) mark.add(i);
          continue;
        }
        if (!open(i) && k[i] !== 3) continue; // P7：裂缝墙（隐藏房、门禁房的入口）也算门洞，摆设 / 小场景不许把它前面堵死
        if (N4.some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && F.room[yy * W + xx] === r.i && open(yy * W + xx); })) mark.add(i);
      }
      r.cells = cells;
      const done = new Set();
      for (const i of [...mark].sort((a, b) => a - b)) {
        if (done.has(i)) continue;
        const x = i % W, y = (i / W) | 0;
        let e = x; while (mark.has(y * W + e + 1) && !done.has(y * W + e + 1)) e++;
        if (e > x) { for (let q = x; q <= e; q++) done.add(y * W + q); out.push({ x, y, w: e - x + 1, h: 1, room: r.i }); continue; }
        let b = y; while (mark.has((b + 1) * W + x) && !done.has((b + 1) * W + x)) b++;
        for (let q = y; q <= b; q++) done.add(q * W + x);
        out.push({ x, y, w: 1, h: b - y + 1, room: r.i });
      }
    }
    F.doors = out; F._g2doors = true;
    return out;
  };

  // 一件摆设占的格（decorate 打了 dec = { x, y, wd }）
  const cellsOf = (F, p) => { const d = p.dec, out = []; for (let a = 0; a < d.wd; a++) out.push(d.y * F.tw + d.x + a); return out; };

  // ── 换乘枢纽的中庭：一片柱网（间距 8 × 7 左右，离墙 ≥ 3、离楼梯 ≥ 4，柱子八邻都是本房间空地）
  function gridPillars(F, r, fr, busy) {
    const W = F.tw, own = (x, y) => x >= 0 && y >= 0 && x < W && y < F.tht && F.room[y * W + x] === r.i && F.kind[y * W + x] === 0 && !F.solid[y * W + x];
    const nx = Math.max(1, Math.floor((r.w - 6) / 8) + 1), ny = Math.max(1, Math.floor((r.h - 6) / 7) + 1);
    const x0 = r.x + Math.round((r.w - 1 - (nx - 1) * 8) / 2), y0 = r.y + Math.round((r.h - 1 - (ny - 1) * 7) / 2), out = [];
    for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
      const x = x0 + a * 8, y = y0 + b * 7;
      if (F.stairs.some(s => Math.abs(Math.floor(s.x / TS) - x) < 4 && Math.abs(Math.floor(s.y / TS) - y) < 4)) continue;
      let ok = true; for (let q = -1; q <= 1 && ok; q++) for (let p = -1; p <= 1; p++) if (!own(x + p, y + q) || busy[(y + q) * W + x + p]) { ok = false; break; }
      if (!ok) continue;
      F.solid[y * W + x] = 1;
      const p = Object.assign(D.makeProp('pillar', x, y, F.th, fr), { grid: true, anchor: 'grid' }); F.props.push(p); out.push(p);
    }
    return out;
  }

  // ── 后几道工序的摆放部分（makeStation 在 decorate、stationMod 之后、历史换容器种类之前调）：
  //   seed：站的子流种子（历史那个数派生的）；返回改了的东西的计数（测试看）
  G2.dress = function (F, seed, st, fi) {
    const S = F.gen2dress; if (!S) return null;
    const W = F.tw, H = F.tht, N = W * H, fr = D.rng((seed ^ D.hash('gen2:dress:' + fi)) >>> 0), LV = D.LV;
    G2.dressDoors(F);
    const res = { moved: 0, conts: 0, pillars: 0, lamps: 0 };
    if ((S.furn || S.vig || S.hist) && G2.furnish) {
      const items = F.rooms.map(() => ({ props: [], kinds: [], at: [] }));
      // 不放东西的格：地上的东西、调度终端、环境留空的格、裂缝墙、蒸汽阀、积水
      const busy = [];
      for (const l of F.loose || []) busy.push(Math.floor(l.y / TS) * W + Math.floor(l.x / TS));
      for (const t of F.terminals || []) busy.push(Math.floor(t.y / TS) * W + Math.floor(t.x / TS));
      for (const v of F.vents || []) busy.push(v.ty * W + v.tx);
      for (const b of F.breakables || []) for (let q = -1; q <= 1; q++) for (let p = -1; p <= 1; p++) busy.push((b.ty + q) * W + b.tx + p);
      if (F._keep) for (let i = 0; i < N; i++) if (F._keep[i]) busy.push(i);
      if (F.water) for (let i = 0; i < N; i++) if (F.water[i]) busy.push(i);
      // decorate 放的容器收起来（种类、次序记下；不动的模式下原位置优先）
      const keepC = [];
      for (const c of F.contSpots) {
        const i = Math.floor(c.y / TS) * W + Math.floor(c.x / TS), ri = c.room;
        if (!c.dec || !(ri >= 0) || !items[ri] || F.room[i] !== ri) { keepC.push(c); continue; }
        items[ri].kinds.push(c.kind); items[ri].at.push(i); F.solid[i] = 0; res.conts++;
      }
      F.contSpots = keepC;
      // furn：decorate 随机放的摆设也收起来（灯一起撤）；换乘枢纽中庭里的柱子换成柱网
      if (S.furn) {
        const keepP = [];
        for (const p of F.props) {
          if (!p.dec) { keepP.push(p); continue; }
          const cs = cellsOf(F, p), ri = F.room[cs[0]];
          if (!(ri >= 0) || cs.some(i => F.room[i] !== ri)) { keepP.push(p); continue; }
          for (const i of cs) F.solid[i] = 0;
          if (p.light) { const L = p.light, k = F.lights.findIndex(l => l.x === L.x && l.y === L.y && l.r === L.r); if (k >= 0) F.lights.splice(k, 1); }
          items[ri].props.push(p.kind); res.moved++;
        }
        F.props = keepP;
        const bz = new Uint8Array(N); for (const i of busy) if (i >= 0 && i < N) bz[i] = 1;
        for (const r of F.rooms) if (r.kind === 'atrium') { const n = items[r.i].props.filter(k => k === 'pillar').length; if (!n) continue; items[r.i].props = items[r.i].props.filter(k => k !== 'pillar'); res.pillars += gridPillars(F, r, fr, bz).length; }
      }
      const before = new Set(F.props);
      const fx = G2.furnish(F, fr, st, fi, { rooms: items, busy, vig: !!S.vig, keep: !S.furn, hist: !!S.hist });
      for (const p of F.props) if (!before.has(p) && p.light) F.lights.push(Object.assign({ seed: fr() * 100 }, p.light));
      // 敌人出生点：历史 / 小场景定了格就用那格；重放过摆设的房间换到从门洞走得到的本房间格（个数不变）
      for (const sp of F.spawns) {
        const r = sp.room >= 0 ? F.rooms[sp.room] : null; if (!r) continue;
        const sa = fx.spawnAt ? fx.spawnAt[r.i] : -1;
        const o = sa >= 0 ? LV.spotRect(F, r, sa % W, (sa / W) | 0) : S.furn ? LV.ownSpot(F, r, fx.reach) : null;
        if (o) Object.assign(sp, o);
      }
      // 地上的东西：小场景留的"地上东西格"先用（同一间房里的挪过去，个数不变）
      if (fx.looseAt) for (const r of F.rooms) {
        const cs = (fx.looseAt[r.i] || []).filter(i => !F.solid[i]); if (!cs.length) continue;
        const mine = (F.loose || []).filter(l => F.room[Math.floor(l.y / TS) * W + Math.floor(l.x / TS)] === r.i);
        cs.forEach((i, q) => { const l = mine[q]; if (!l) return; l.x = (i % W) * TS + fr.int(4, 12); l.y = ((i / W) | 0) * TS + fr.int(6, 12); });
      }
      res.vigs = (F.vigs || []).length;
    }
    // 灯：室内的房间把 decorate 挂的灯（rl 标了房间号）交给 layLamps 按用途 / 柱网换位置（盏数 ±25%，坏不坏照旧）
    if (S.lamps && G2.layLamps) for (const r of F.rooms) {
      if (G2.outRoom(F, r)) continue;
      const olds = F.lights.filter(l => l.rl === r.i); if (!olds.length) continue;
      F.lights = F.lights.filter(l => l.rl !== r.i);
      const rr = Object.assign({}, r, { kind: G2.roomKind(F, r) });
      for (const L of G2.layLamps(F, rr, olds, !!olds[0].rdim)) { F.lights.push(L); res.lamps++; }
    }
    F.dressed = res;
    return res;
  };
})(D);
