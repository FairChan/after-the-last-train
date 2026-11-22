/* 站内地图第二代 P3 · 小场景格式和放置器（design/features/station-gen/design.md 第 5.4 节；施工步骤 plan-p3.md 任务 1）
   D.gen2.vig({ id, rooms, at, flip, hist, w, map, key })：登记一个小场景（定义在 src/vignettes-*.js，一批一个文件）。
     map：文字画的格子。'#' 必须是墙（贴墙的锚），'.' 必须是本房间能走的空地，空格不管，其余字母查 key。
     key[字母]：{ prop: 'makeProp 的种类' }（宽 2 格的摆设在 map 里连写两个同样的字母）、{ cont: '容器种类' }（容器的优先位置）、
       { decal: 'blood|paper|glass|chalk|shells|soot|water|rubble|tread' }、{ light: '#rrggbb' }、{ spawn: 1 }（敌人站位）、{ loose: 1 }（地上东西的位置）。
     rooms：能放进哪些房间 kind；'*' = 除了站台以外的任何房间（站台只放 rooms 里写明 'platform' 的，P6）；'outdoor' = 任何露天的房间（P7，不许有室内才有的东西）；
       场景 / 环境的房间先按 DRESS_KIND 对照（meeting → office），rooms 里也可以直接写它自己的种类（P7）。at：wall | corner | center | door。hist：属于哪些历史（空 = 通用）。w：稀有度权重，默认 2。
     out：true = 露天也说得通（P7 任务 2）：露天的大厅类房间（对到 hall 的街道、楼顶……）只放写了 'outdoor' 的和标了 out 的大厅小场景。
   D.gen2.vigRoom(api)：furnish.js 在一间房放完大件摆设、放容器之前调（P3 只对新骨架站厅层；P6 起站台层、换乘层、设备层也放）。
     个数：格数 < 50 放 1 个，< 110 放 2 个，其余 3 个。挑选：rooms 含这间房、一站里还没用过；权重 = w × 站号打乱系数 × 历史系数
       （站号打乱：P7 起是相位窗，见 G2.vigShuffle；hist 和这站的历史有交集 ×4、hist 非空没交集 ×0）。
     按权重不放回地抽出先后（子流，一次 weighted 抽一个），前 N 个按 door → wall → corner → center 的次序放，放不下的换后面的，每间房最多试 20 次。
     位置：扫房间里所有能放的位置（含翻转），每格都对上才算，子流挑一个；摆设、容器格不进"不放东西的格"和柱子 8 邻；
       中央的小场景每格四邻都不是墙；门口的小场景离门洞往里那格 2 格以内。放下后跑 P2 的动线检查（api.put），不合格撤掉换下一个。
     放下的：摆设（p.vig = id，没有 anchor）、贴花推进 F.decals、灯推进 F.lights、F.vigs 记 { id, x, y, flip }；
       容器 / 敌人站位 / 地上东西 / 空地这些格记进 api.res（容器放置器不往上放别的），容器格作为这间房容器的优先位置交回 furnish。
     返回 { placed, conts: [{ i, kind, id }], spawn: [格], loose: [格], bars: [外框], undo() }。
   随机数：只用 api.vr（furnish 从父流取一个数派生的 'gen2:vig:' + 楼层号）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, G2 = D.gen2 = D.gen2 || {};
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const VIGS = G2.VIGS = [], AT = { door: 0, wall: 1, corner: 2, center: 3 };
  const DECALS = G2.DECALS = ['blood', 'paper', 'glass', 'chalk', 'shells', 'soot', 'water', 'rubble', 'tread', 'spray', 'tape', 'arc']; // P7 加：消毒喷雾痕、封条胶带、电弧痕
  G2.VIG_WIDE = { benchfall: 1, bedroll: 1, roadblock: 1, lockerfall: 1 }; // 小场景新摆设里宽 2 格的（arena.js 的 makeProp）
  const wide = k => !!(G2.WIDE && G2.WIDE[k]) || !!(G2.VIG_WIDE && G2.VIG_WIDE[k]);

  G2.vig = function (v) {
    const bad = m => { (G2.vigErrors = G2.vigErrors || []).push(v.id + ': ' + m); };
    if (!v || !v.id || !Array.isArray(v.map)) { bad('missing id / map'); return; }
    if (VIGS.some(o => o.id === v.id)) { bad('duplicate id'); return; }
    v.rooms = v.rooms || ['*']; v.at = v.at || 'wall'; v.hist = v.hist || []; v.w = v.w == null ? 2 : v.w; v.key = v.key || {};
    if (!(v.at in AT)) bad('bad at ' + v.at);
    const h = v.map.length, w = Math.max(...v.map.map(s => s.length)), cells = [];
    for (let y = 0; y < h; y++) {
      const row = v.map[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]; if (ch === ' ') continue;
        if (ch === '#') { cells.push({ dx: x, dy: y, t: 'wall' }); continue; }
        if (ch === '.') { cells.push({ dx: x, dy: y, t: 'open' }); continue; }
        const k = v.key[ch]; if (!k) { bad('no key for ' + ch); continue; }
        if (k.prop) {
          if (wide(k.prop)) { if (row[x + 1] !== ch) { bad('wide prop ' + k.prop + ' needs two cells'); continue; } cells.push({ dx: x, dy: y, t: 'prop', prop: k.prop, wd: 2 }, { dx: x + 1, dy: y, t: 'prop2' }); x++; continue; }
          cells.push({ dx: x, dy: y, t: 'prop', prop: k.prop, wd: 1 });
        } else if (k.cont) { if (D.CONT && !D.CONT[k.cont]) bad('unknown cont ' + k.cont); cells.push({ dx: x, dy: y, t: 'cont', cont: k.cont }); }
        else if (k.decal) { if (!DECALS.includes(k.decal)) bad('unknown decal ' + k.decal); cells.push({ dx: x, dy: y, t: 'decal', decal: k.decal }); }
        else if (k.light) cells.push({ dx: x, dy: y, t: 'light', col: k.light });
        else if (k.spawn) cells.push({ dx: x, dy: y, t: 'spawn' });
        else if (k.loose) cells.push({ dx: x, dy: y, t: 'loose' });
        else bad('bad key ' + ch);
      }
    }
    v.mw = w; v.mh = h; v.cells = cells;
    VIGS.push(v);
  };
  // 翻转后一格的位置（宽摆设的左格要换成原来右格翻过来的位置）
  const cellAt = (v, c, flip) => ({ x: flip ? v.mw - 1 - c.dx - (c.t === 'prop' && c.wd === 2 ? 1 : 0) : c.dx, y: c.dy });
  G2.vigCell = cellAt;

  const frac = n => (n >>> 0) / 4294967296;
  // P7 任务 2（十站不重复）：站号打乱改成"相位窗"。每个小场景在一个圈上有个位置（按 id 哈希），每座站有个相位（站号 × 黄金分割取小数），
  //   离站的相位越近权重越大（窗半宽 0.25：0.1–4.1 倍，再乘 0.7–1.3 的随机）。一条线上的站号大多是连着的，黄金分割让相邻站的相位错开，
  //   连续坐十站，各站偏爱的小场景是错开的几批（以前 0.4–1.6 倍各站独立打乱，常见房间总挑到同几个）
  const PHI = 0.6180339887;
  G2.vigShuffle = (sid, vid) => {
    const ph = typeof sid === 'number' ? (sid * PHI) % 1 : frac(D.hash('ph:' + sid)), hv = frac(D.hash('vp:' + vid)), d0 = Math.abs(ph - hv), d = Math.min(d0, 1 - d0);
    return (0.1 + 4 * Math.max(0, 1 - d / 0.25)) * (0.7 + 0.6 * frac(D.hash(sid + ':' + vid)));
  };
  G2.vigWeight = function (v, st, hist) {
    let hf = 1;
    if (v.hist.length) hf = v.hist.some(h => hist.includes(h)) ? 4 : 0;
    return v.w * G2.vigShuffle(st.id, v.id) * hf;
  };
  G2.vigFits = (v, kind) => v.rooms.includes(kind) || (kind !== 'platform' && v.rooms.includes('*')); // 站台只放写明 platform 的（P6，vignettes-03.js）
  // P7：一间房的候选 = rooms 含对照后的种类（vk）、或者含场景 / 环境自己的种类（r.kind，比如 meeting、shipbox）、或者写了 'outdoor' 而这间房露天（站台除外：站台只放写明 platform 的）；
  //   露天房间不放要屋顶的（vigDeny）。按（vk、r.kind、露天、要不要挡室内的）缓存一张表，次序和 VIGS 一样（抽签的先后不变）；小场景一多，每间房不用再把整张表筛一遍
  const CAND = new Map(); let candN = -1;
  G2.vigCand = function (F, r, vk) {
    if (candN !== VIGS.length) { CAND.clear(); candN = VIGS.length; }
    const out = !!(G2.outRoom && G2.outRoom(F, r)), deny = out && !!(F.gen2dress || F.open), key = vk + '|' + r.kind + '|' + (out ? 1 : 0) + (deny ? 1 : 0);
    // P7 任务 2：露天的大厅类房间（街道、楼顶、广场……对到 hall 的）不放大厅的小场景（漏水、屋檐下的铺盖这些），除非小场景标了 out（露天也说得通）或者写了 'outdoor' / 这间房自己的种类
    const strict = out && vk === 'hall', outOK = v => !strict || v.out || v.rooms.includes('outdoor') || (r.kind !== vk && v.rooms.includes(r.kind));
    let L = CAND.get(key);
    if (!L) { L = VIGS.filter(v => (G2.vigFits(v, vk) || (r.kind !== vk && v.rooms.includes(r.kind)) || (out && vk !== 'platform' && v.rooms.includes('outdoor'))) && outOK(v) && !(deny && G2.vigDeny && G2.vigDeny(F, r, v))); CAND.set(key, L); }
    return L;
  };
  // 站号打乱系数按站缓存（同一站每间房都要算一遍）
  let shufSid = null, shufM = null;
  const shufOf = (sid, vid) => { if (shufSid !== sid) { shufSid = sid; shufM = new Map(); } let s = shufM.get(vid); if (s == null) { s = G2.vigShuffle(sid, vid); shufM.set(vid, s); } return s; };

  G2.vigRoom = function (api) {
    const { F, r, vr, busy, nearPil, res, used, hist, st } = api, W = F.tw, H = F.tht;
    const out = { placed: [], conts: [], spawn: [], loose: [], bars: [], undo: null }, undos = [];
    out.undo = () => { while (undos.length) undos.pop()(); out.placed.length = out.conts.length = out.spawn.length = out.loose.length = out.bars.length = 0; };
    const target = r.cells < 50 ? 1 : r.cells < 110 ? 2 : 3;
    const vk = G2.vigKind ? G2.vigKind(F, r) : r.kind; // P6：旧骨架楼层（dress.js）的房间种类对到小场景认的种类；露天的房间不放要屋顶的（G2.vigDeny）
    const cand = [];
    for (const v of G2.vigCand(F, r, vk)) { if (used.has(v.id)) continue; const hf = v.hist.length ? (v.hist.some(h => hist.includes(h)) ? 4 : 0) : 1; if (hf) cand.push({ v, w: v.w * shufOf(st.id, v.id) * hf }); } // 同 vigWeight
    if (!cand.length) return out;
    // 按权重排先后：按权重不放回地抽，一次 vr.weighted 抽一个、抽完从表里拿掉，抽满 20 个（审稿 M2：不用 Math.pow，各家浏览器结果一样）
    const order = [], bag = cand.map(o => [o, o.w]);
    while (bag.length && order.length < 20) { const o = vr.weighted(bag); order.push(o.v); bag.splice(bag.findIndex(e => e[0] === o), 1); }
    const plan = order.slice(0, target).sort((a, b) => AT[a.at] - AT[b.at]), rest = order.slice(target);
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    // P7 任务 2：api.lift（furnish 给的）= 这间房自己先放的大件摆设，小场景可以压在它们上面：放下时把它们挪开，再按原来的锚点重放（furnish.js mkLift）
    const LF = api.lift || null;
    const own = (x, y) => { if (!inb(x, y)) return false; const i = y * W + x; return F.room[i] === r.i && F.kind[i] === 0 && !res[i] && (F.solid[i] === 0 || !!(LF && LF.at.has(i))); };
    const doorIn = [];
    for (const d of F.doors || []) if (d.room === r.i) for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) for (const [dx, dy] of N4) { const xx = x + dx, yy = y + dy; if (inb(xx, yy) && F.room[yy * W + xx] === r.i) doorIn.push([xx, yy]); }
    function fits(v, gx, gy, flip) {
      let nearDoor = v.at !== 'door';
      for (const c of v.cells) {
        if (c.t === 'prop2') continue;
        const p = cellAt(v, c, flip), x = gx + p.x, y = gy + p.y;
        if (c.t === 'wall') { if (!inb(x, y) || F.kind[y * W + x] !== 1) return false; continue; }
        const wd = c.t === 'prop' ? c.wd : 1;
        for (let a = 0; a < wd; a++) {
          const xx = x + a; if (!own(xx, y)) return false;
          const i = y * W + xx;
          if ((c.t === 'prop' || c.t === 'cont') && (busy[i] || nearPil[i])) return false;
          if (v.at === 'center' && N4.some(([dx, dy]) => !inb(xx + dx, y + dy) || F.kind[(y + dy) * W + xx + dx] !== 0)) return false;
          if (!nearDoor && doorIn.some(([dx, dy]) => Math.max(Math.abs(dx - xx), Math.abs(dy - y)) <= 2)) nearDoor = true;
        }
      }
      return nearDoor;
    }
    function tryPlace(v) {
      // 所有位置（含翻转）按随机次序一个个试：边抽边试（不放回），对上一个就停，不用先把整张表洗一遍（P7 提速；抽到的分布和洗牌一样）
      const nx = r.w - v.mw + 3, ny = r.h - v.mh + 3, nf = v.flip ? 2 : 1, total = nx > 0 && ny > 0 ? nx * ny * nf : 0;
      const perm = new Int32Array(total); for (let q = 0; q < total; q++) perm[q] = q;
      let at = -1;
      for (let n = total; n > 0 && at < 0; n--) { const j = vr.int(0, n - 1), q = perm[j]; perm[j] = perm[n - 1]; const f = q % nf, c = (q / nf) | 0; if (fits(v, r.x - 1 + c % nx, r.y - 1 + ((c / nx) | 0), f === 1)) at = q; }
      if (at < 0) return false;
      const flip = at % nf === 1, gx = r.x - 1 + ((at / nf) | 0) % nx, gy = r.y - 1 + ((((at / nf) | 0) / nx) | 0), solid = [], items = [];
      for (const c of v.cells) {
        if (c.t === 'prop2' || c.t === 'wall') continue;
        const p = cellAt(v, c, flip), x = gx + p.x, y = gy + p.y, i = y * W + x;
        items.push({ c, x, y, i });
        if (c.t === 'prop') for (let a = 0; a < c.wd; a++) solid.push(i + a);
      }
      // 压到的摆设先收起来（挪开），动线检查不过就放回去
      const ms = [];
      if (LF) for (const { c, i } of items) for (let a = 0; a < (c.t === 'prop' ? c.wd : 1); a++) { const m = LF.at.get(i + a); if (m && F.solid[i + a] && !ms.includes(m)) ms.push(m); }
      const restore = ms.length ? LF.take(ms) : null;
      if (!api.put(solid)) { if (restore) restore(); return false; }
      const props = [], decals = [], lights = [], marks = [], oc = [], osp = [], olo = [];
      for (const { c, x, y, i } of items) {
        if (c.t === 'prop') { const pr = D.makeProp(c.prop, x, y, F.th, vr); pr.vig = v.id; F.props.push(pr); props.push(pr); for (let a = 0; a < c.wd; a++) { res[i + a] = 1; marks.push(i + a); } continue; }
        res[i] = 1; marks.push(i);
        if (c.t === 'cont') oc.push({ i, kind: c.cont, id: v.id });
        else if (c.t === 'spawn') osp.push(i);
        else if (c.t === 'loose') olo.push(i);
        else if (c.t === 'decal') { const d = { x: x * TS + 8, y: y * TS + 8, kind: c.decal, r: (vr() * 4294967296) >>> 0, vig: v.id }; F.decals.push(d); decals.push(d); }
        else if (c.t === 'light') { const L = { x: x * TS + 8, y: y * TS + 4, r: 46, col: c.col, a: 0.75, flick: 0.12, seed: vr() * 100 }; F.lights.push(L); lights.push(L); }
      }
      const unplace = () => {
        for (const pr of props) { const k = F.props.indexOf(pr); if (k >= 0) F.props.splice(k, 1); }
        for (const i of solid) F.solid[i] = 0;
        for (const i of marks) res[i] = 0;
        for (const d of decals) { const k = F.decals.indexOf(d); if (k >= 0) F.decals.splice(k, 1); }
        for (const L of lights) { const k = F.lights.indexOf(L); if (k >= 0) F.lights.splice(k, 1); }
      };
      // 挪开的摆设重放（躲开小场景的格）；有一件放不下，这个小场景就不放
      const unback = ms.length ? LF.back(ms) : null;
      if (ms.length && !unback) { unplace(); restore(); return false; }
      out.conts.push(...oc); out.spawn.push(...osp); out.loose.push(...olo);
      const rec = { id: v.id, x: gx, y: gy, flip };
      if (ms.length) rec.moved = ms.length;
      F.vigs.push(rec); used.add(v.id); out.placed.push(rec);
      if (v.hist.includes('barricade')) out.bars.push({ x: gx, y: gy, w: v.mw, h: v.mh });
      undos.push(() => {
        unplace();
        const k = F.vigs.indexOf(rec); if (k >= 0) F.vigs.splice(k, 1);
        used.delete(v.id);
        if (unback) unback();
        if (restore) restore();
      });
      return true;
    }
    let tries = 0, ri = 0;
    while (out.placed.length < target && tries < 20) {
      let v = plan.shift();
      if (!v) { v = rest[ri++]; if (!v) break; }
      tries++;
      if (tryPlace(v)) continue;
      // 放不下：从后面补一个，按 at 的次序插回去（中央的仍在最后）
      const nx = rest[ri++]; if (!nx) continue;
      let k = 0; while (k < plan.length && AT[plan[k].at] <= AT[nx.at]) k++;
      plan.splice(k, 0, nx);
    }
    return out;
  };
})(D);
