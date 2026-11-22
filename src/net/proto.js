/* 末班之后 · 多人联机：消息格式（design/features/multiplayer §4.4）
   - 协议版本号 NET.VERSION：房主和队友不一致就不让进（"请刷新到同一版本"）
   - NET.pack：把站里的东西拷成纯数据（数字保留两位小数；Set、画布、函数、互相引用的对象都不要）
   - 快照：房主每 3 步（20 次/秒）发一次"会动的东西"；短命的特效（粒子、飘字、光……）只发新出的，队友本机自己让它们飘、淡掉
   - 引用：队友点背包、箱子时，参数里的格子 / 物品 / 箱子 / 地上的东西换成"路径"发过去（NET.enc / NET.dec），房主按路径找到自己那份 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {};
  NET.VERSION = 3; // 2：快照只发和关键帧不一样的（MP6）；3：站内地图第二代新骨架，同一个种子出的站和旧版不一样
  NET.SNAP_EVERY = 3; // 房主每 3 步发一次快照（20 次/秒）
  NET.DELAY = 0.1; // 队友画别人往回看的最少时间（net/client.js 按网络抖动往上加）
  NET.DELAY_MAX = 0.8;
  NET.KEY_EVERY = 40; // 快照：每 40 条（2 秒）一个关键帧，中间只发变了的 // 队友画别人时往回看 100 毫秒，在两条快照之间插值

  // ── 纯数据拷贝
  const SKIP = new Set(['ctx', 'tgt', 'from', 'home', 'img', 'spr', 'cape', 'scarf', 'pl', 'hit', 'lungeHit', '_render', '_state', 'sp', 'obj', 'R', 'raid', 'pf', 'city', 'S']);
  const plain = o => { const p = Object.getPrototypeOf(o); return p === Object.prototype || p === null; };
  function pack(v, depth) {
    if (v == null) return v === null ? null : undefined;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? (Number.isInteger(v) ? v : Math.round(v * 100) / 100) : 0;
    if (t === 'string' || t === 'boolean') return v;
    if (t !== 'object' || depth <= 0) return undefined;
    if (Array.isArray(v)) { const out = []; for (const x of v) { const y = pack(x, depth - 1); out.push(y === undefined ? null : y); } return out; }
    if (!plain(v)) return undefined;
    const out = {};
    for (const k in v) { if (SKIP.has(k) || k.charCodeAt(0) === 95) continue; const y = pack(v[k], depth - 1); if (y !== undefined) out[k] = y; }
    return out;
  }
  NET.pack = (v, depth) => pack(v, depth == null ? 4 : depth);
  // 收到的消息（别人那台机器发来的，不可信）：去掉 __proto__ / constructor / prototype 这几个键，免得合并进对象时改了原型
  const BAD = new Set(['__proto__', 'constructor', 'prototype']);
  NET.clean = function clean(v, d) {
    if (!v || typeof v !== 'object' || (d | 0) > 12) return v;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = clean(v[i], (d | 0) + 1); return v; }
    for (const k of Object.keys(v)) { if (BAD.has(k)) delete v[k]; else v[k] = clean(v[k], (d | 0) + 1); }
    return v;
  };
  // 格子（背包、箱子……）：只要宽高和每件东西
  NET.isGrid = g => !!(g && typeof g === 'object' && Array.isArray(g.items) && typeof g.w === 'number' && typeof g.h === 'number');
  NET.grid = g => ({ w: g.w, h: g.h, items: g.items.map(e => ({ id: e.id, n: e.n, x: e.x, y: e.y, r: e.r ? 1 : 0 })) });
  // 把 src 的格子内容写进 dst（保留 dst 这个对象：存档里的保险箱和这一趟的是同一个）
  NET.gridInto = (dst, src) => { dst.w = src.w; dst.h = src.h; dst.items = src.items.map(e => Object.assign({}, e)); return dst; };

  // ── 一个玩家的公开信息（大家都看得见的）：位置、朝向、耐久、动作……
  const PUB = ['x', 'y', 'vx', 'vy', 'hp', 'maxHp', 'shield', 'aim', 'dashT', 'walk', 'swingT', 'swingDir', 'flash', 'inv', 'hurtT', 'reload', 'reloadMax', 'mag', 'cap', 'useT', 'useK', 'cloakT',
    'lastShot', 'charging', 'chargeT', 'ads', 'scale', 'down', 'downT', 'rev', 'out', 'gone', 'name', 'pid', 'act', 'spin', 'healOT', 'buffT', 'dashCd', 'dashCdMax', 'meleeCd', 'fireCd', 'skillCd', 'modCd',
    'nadeCd', 'healCd', 'cellCd', 'jamT', 'quick', 'speed', 'spdMul', 'lag', 'bloom', 'pullT', 'afk', 'boardT', 'saves', 'revT', 'say'];
  NET.pubOf = p => { const o = {}; for (const k of PUB) if (p[k] !== undefined) { const y = pack(p[k], 3); if (y !== undefined) o[k] = y; } return o; };
  // 画别人时要的"外观"：型号（带涂装）、装着的改装件、手里的枪（S.raid.load）
  NET.lookOf = (S, p) => { const MP = D.MP, R = MP.of(S, p, 'raid'); return { shell: R.shell, look: R.look || null, mods: pack(MP.of(S, p, 'mods'), 3) || null, load: pack(R.load, 2), sup: R.sup || 0, name: p.name || null }; };

  // ── 关键帧 + 差量（MP6）：每秒发一次完整的（可靠送达，带字段表），中间只发和关键帧不一样的字段 [下标, 值, …]
  //    一组东西（敌人、人）各用一个 NET.Keyed()；id 是对象的编号（敌人 nid、人 pid）
  const same = (a, b) => a === b || (a && b && typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b));
  NET.Keyed = function () {
    const K = { id: 0, keys: null, idx: null, base: new Map() };
    // 房主：key = 这一条是不是关键帧；list 是打包好的对象
    K.enc = function (list, idOf, key) {
      if (key || !K.keys) {
        const ks = new Set(); for (const o of list) for (const k in o) ks.add(k);
        K.id++; K.keys = [...ks]; K.idx = new Map(K.keys.map((k, i) => [k, i])); K.base = new Map();
        return { kf: K.id, keys: K.keys, l: list.map(o => { const a = K.keys.map(k => (o[k] === undefined ? null : o[k])); K.base.set(idOf(o), a); return a; }) };
      }
      return { of: K.id, l: list.map(o => {
        const id = idOf(o), b = K.base.get(id); if (!b) return { id, full: o }; // 关键帧以后才出现的：整个发
        const d = []; let ex = null;
        for (const k in o) { const i = K.idx.get(k); if (i == null) (ex || (ex = {}))[k] = o[k]; else if (!same(o[k], b[i])) d.push(i, o[k]); }
        for (let i = 0; i < K.keys.length; i++) if (b[i] != null && o[K.keys[i]] === undefined) d.push(i, null);
        return ex ? [id, d, ex] : [id, d];
      }) };
    };
    // 队友：解回一个个完整对象；对不上关键帧（还没收到）返回 null
    K.dec = function (m, idKey) {
      if (m.kf != null) { K.id = m.kf; K.keys = m.keys; K.base = new Map(); return m.l.map(a => { const o = {}; K.keys.forEach((k, i) => { if (a[i] != null) o[k] = a[i]; }); K.base.set(o[idKey], o); return Object.assign({}, o); }); }
      if (m.of !== K.id) return null;
      return m.l.map(e => {
        if (!Array.isArray(e)) return e.full;
        const o = Object.assign({}, K.base.get(e[0]) || {}), d = e[1];
        for (let i = 0; i < d.length; i += 2) { const k = K.keys[d[i]]; if (d[i + 1] === null) delete o[k]; else o[k] = d[i + 1]; }
        if (e[2]) Object.assign(o, e[2]);
        return o;
      });
    };
    return K;
  };

  // ── 引用 ⇄ 路径（队友的操作）。roots：{ S, R }
  function gridKey(S, R, g) {
    if (g === R.bag) return 'bag'; if (g === R.safe) return 'safe'; if (g === R.keycase) return 'keycase';
    if (D.pouchR && g === D.pouchR(R)) return 'pouch';
    const i = S.containers.findIndex(c => c.grid === g); if (i >= 0) return 'c:' + i;
    return null;
  }
  function gridOf(S, R, k) {
    if (k === 'bag') return R.bag; if (k === 'safe') return R.safe; if (k === 'keycase') return R.keycase; if (k === 'pouch') return D.pouchR ? D.pouchR(R) : null;
    if (k && k.startsWith('c:')) { const c = S.containers[+k.slice(2)]; return c ? c.grid : null; }
    return null;
  }
  const GRIDS = (S, R) => ['bag', 'safe', 'keycase', 'pouch'].concat(S.containers.map((c, i) => 'c:' + i));
  // 编码一个参数；编不了（不认识的对象）返回 undefined
  NET.enc = function (S, R, v, loose) {
    if (v == null || typeof v !== 'object') return typeof v === 'function' ? ['f'] : ['v', v];
    if (v === S) return ['S']; if (v === R) return ['R'];
    const gk = gridKey(S, R, v); if (gk) return ['g', gk];
    for (const k of GRIDS(S, R)) { const g = gridOf(S, R, k); if (!g) continue; const i = g.items.indexOf(v); if (i >= 0) return ['e', k, i, v.id]; }
    let i = S.containers.indexOf(v); if (i >= 0) return ['c', i];
    for (let ci = 0; ci < S.containers.length; ci++) { const j = S.containers[ci].items.indexOf(v); if (j >= 0) return ['ci', ci, j]; }
    i = S.ground.indexOf(v);
    // 队友那边地上的东西每次快照都换成新对象，界面手里拿的可能是上一份：按"同一件、同一个位置"认回现在这件（不然会按值发过去，房主那边凭空变出一件）。
    // 只在 loose（这一下明确是队友在自己的影子站里做的：参数里有影子站本身）时认，别把房主那边同一个网页里的东西认成影子的（本机分屏）
    if (i < 0 && loose && v.id != null && v.x != null && v.n != null) i = S.ground.findIndex(o => o.id === v.id && !o.dropped && o.f === v.f && Math.abs(o.x - v.x) < 1 && Math.abs(o.y - v.y) < 1);
    if (i >= 0) return ['gr', i, S.ground[i].id];
    if (plain(v) || Array.isArray(v)) { const p = pack(v, 3); return p === undefined ? undefined : ['j', p]; }
    return undefined;
  };
  NET.known = a => a && a[0] !== 'v' && a[0] !== 'j' && a[0] !== 'f';
  // 按值发的"一件东西"（有 id 的对象）：房主不认——东西只能是站里 / 背包里已经有的那件，不能凭一份值变出来
  NET.itemByValue = a => !!(a && a[0] === 'j' && a[1] && typeof a[1] === 'object' && a[1].id != null);
  NET.dec = function (S, R, a) {
    if (!a) return undefined;
    switch (a[0]) {
      case 'v': return a[1]; case 'j': return a[1]; case 'f': return undefined; case 'S': return S; case 'R': return R;
      case 'g': return gridOf(S, R, a[1]);
      case 'e': { const g = gridOf(S, R, a[1]); if (!g) return undefined; const e = g.items[a[2]]; return e && e.id === a[3] ? e : g.items.find(x => x.id === a[3]); }
      case 'c': return S.containers[a[1]];
      case 'ci': { const c = S.containers[a[1]]; return c && c.items[a[2]]; }
      case 'gr': { const g = S.ground[a[1]]; return g && g.id === a[2] ? g : S.ground.find(x => x.id === a[2] && !x.dropped); }
    }
    return undefined;
  };
  // 事件（loot / reveal / talk……）里的引用：箱子换成编号
  NET.encEv = function (S, ev) { const o = {}; for (const k in ev) { const v = ev[k]; if (v && typeof v === 'object') { const i = S.containers.indexOf(v); if (i >= 0) { o[k] = { $c: i }; continue; } const p = pack(v, 3); if (p !== undefined) o[k] = p; } else if (typeof v !== 'function') o[k] = v; } return o; };
  NET.decEv = function (S, ev) { const o = {}; for (const k in ev) { const v = ev[k]; o[k] = v && typeof v === 'object' && v.$c != null ? S.containers[v.$c] : v; } return o; };
  // 面板（S.lootOpen）：箱子 / 背包 / 别的
  NET.encPanel = (S, lo) => (lo == null ? null : S.containers.indexOf(lo) >= 0 ? { $c: S.containers.indexOf(lo) } : { bag: !!lo.bag, inv: !!lo.inv, trade: !!lo.trade });
  NET.decPanel = (S, v) => (v == null ? null : v.$c != null ? S.containers[v.$c] || null : { bag: v.bag, inv: v.inv, trade: v.trade });
})(D);
