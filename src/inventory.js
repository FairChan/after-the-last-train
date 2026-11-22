/* 末班之后 · 小样二：格子背包（参照三角洲行动）
   一个格子网 = { w, h, items: [{ id, n, x, y, r }] }。r = 1 表示横竖转过来。
   物品 id：普通物品 'gpu'，装备卡 'card:smg'，消耗品 'use:medkit'，弹药 'ammo:light:2'，背包 'bag:tact'。
   能叠的东西（材料 10、消耗品 3–5、弹药 100）先往已有的组里塞，塞满了再另起一组。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const cache = new Map();
  D.itemInfo = function (id) {
    if (cache.has(id)) return cache.get(id);
    let o;
    if (id === 'medkit') id = 'use:medkit';
    if (id.startsWith('card:')) {
      const k = id.slice(5), c = D.CARDS[k], s = D.CARD_SHAPE[k] || [1, 1];
      o = { name: c.name, v: Math.round((c.price || 60) * 0.5), w: s[0], h: s[1], stack: 1, q: c.q, art: c.art, icon: c.icon, kind: 'card', card: k, slot: c.slot };
    } else if (id.startsWith('use:')) {
      const u = D.USE[id.slice(4)]; if (!u) throw new Error('unknown consumable ' + id); // 老存档里拿掉的消耗品（兴奋剂）读档时会被丢掉
      o = Object.assign({ kind: 'use', use: id.slice(4) }, u);
    } else if (id.startsWith('ammo:')) {
      const [, cal, t] = id.split(':'), C = D.CALIBER[cal], T = D.AMMO_TIER[+t];
      o = { name: T.name + C.name, v: C.unit * T.price, w: 1, h: 1, stack: 100, q: T.q, art: 'ammo_' + cal, kind: 'ammo', cal, tier: +t };
    } else if (id.startsWith('bag:')) {
      const b = D.BAGS[id.slice(4)]; o = { name: b.name, v: b.v, w: b.w, h: b.h, stack: 1, q: b.q, art: 'bag_' + id.slice(4), kind: 'bag', bag: id.slice(4), desc: `背包：${b.gw}×${b.gh} 格` };
    } else if (id.startsWith('clue:') || id.startsWith('quest:')) {
      o = D.storyItemInfo(id); // 主线：线索纸、委托物（story.js）
    } else if (/^(att|rmod|bp|job):/.test(id)) {
      o = D.growthItemInfo(id); // 配件、改装件、蓝图、委托包裹（growth.js）
    } else {
      const it = D.ITEMS[id]; o = { name: it.name, v: it.v, w: it.w, h: it.h, stack: it.stack, q: it.q, art: it.art, kind: 'item', cat: it.cat };
    }
    cache.set(id, o); return o;
  };
  D.normId = id => id === 'medkit' ? 'use:medkit' : id;

  const G = D.Grid = {};
  G.make = (w, h) => ({ w, h, items: [] });
  G.size = (e) => { const it = D.itemInfo(e.id); return e.r ? [it.h, it.w] : [it.w, it.h]; };
  // (x, y) 放一个 w×h 的东西会不会和别的东西重叠（ignore 是正在搬的那件）
  G.free = function (g, x, y, w, h, ignore) {
    if (x < 0 || y < 0 || x + w > g.w || y + h > g.h) return false;
    for (const e of g.items) {
      if (e === ignore) continue;
      const [ew, eh] = G.size(e);
      if (x < e.x + ew && x + w > e.x && y < e.y + eh && y + h > e.y) return false;
    }
    return true;
  };
  G.at = (g, x, y) => g.items.find(e => { const [w, h] = G.size(e); return x >= e.x && x < e.x + w && y >= e.y && y < e.y + h; });
  // 找个空位：先不转，放不下再转过来试
  G.spot = function (g, id) {
    const it = D.itemInfo(id);
    for (const r of it.w === it.h ? [0] : [0, 1]) {
      const w = r ? it.h : it.w, h = r ? it.w : it.h;
      for (let y = 0; y <= g.h - h; y++) for (let x = 0; x <= g.w - w; x++) if (G.free(g, x, y, w, h)) return { x, y, r };
    }
    return null;
  };
  // 加 n 个，返回放不下的个数
  G.add = function (g, id, n) {
    id = D.normId(id); n = n == null ? 1 : n;
    const it = D.itemInfo(id);
    if (it.stack > 1) for (const e of g.items) { if (n <= 0) break; if (e.id === id && e.n < it.stack) { const k = Math.min(n, it.stack - e.n); e.n += k; n -= k; } }
    while (n > 0) {
      const s = G.spot(g, id); if (!s) break;
      const k = Math.min(n, it.stack); g.items.push({ id, n: k, x: s.x, y: s.y, r: s.r }); n -= k;
    }
    return n;
  };
  G.canAdd = function (g, id, n) { const t = G.clone(g); return G.add(t, id, n) === 0; };
  G.remove = (g, e) => { const i = g.items.indexOf(e); if (i >= 0) g.items.splice(i, 1); };
  G.count = (g, pred) => g.items.reduce((s, e) => s + (pred(e.id) ? e.n : 0), 0);
  // 拿走 n 个某样东西（从最小的那组拿起），返回实际拿到的
  G.take = function (g, id, n) {
    let got = 0;
    const list = g.items.filter(e => e.id === id).sort((a, b) => a.n - b.n);
    for (const e of list) { if (got >= n) break; const k = Math.min(e.n, n - got); e.n -= k; got += k; if (e.n <= 0) G.remove(g, e); }
    return got;
  };
  G.value = (g, priceOf) => g.items.reduce((s, e) => s + (priceOf ? priceOf(e.id) : D.itemInfo(e.id).v) * e.n, 0);
  G.used = g => g.items.reduce((s, e) => { const [w, h] = G.size(e); return s + w * h; }, 0);
  G.clone = g => ({ w: g.w, h: g.h, items: g.items.map(e => Object.assign({}, e)) });
  // 把一堆东西重新码进一个新格子；放不下的返回
  G.repack = function (g, w, h) {
    const out = G.make(w, h), over = [];
    const list = g.items.slice().sort((a, b) => { const A = D.itemInfo(a.id), B = D.itemInfo(b.id); return B.w * B.h - A.w * A.h; });
    for (const e of list) { const left = G.add(out, e.id, e.n); if (left) over.push({ id: e.id, n: left }); }
    return { grid: out, over };
  };
  // 把 src 里的一件搬到 dst：能指定位置就放指定位置，否则找空位；能叠就叠
  G.move = function (src, e, dst, x, y, r) {
    const it = D.itemInfo(e.id);
    if (x != null) {
      const w = r ? it.h : it.w, h = r ? it.w : it.h, hit = G.at(dst, x, y);
      if (hit && hit !== e && hit.id === e.id && it.stack > 1 && hit.n < it.stack) { const k = Math.min(e.n, it.stack - hit.n); hit.n += k; e.n -= k; if (e.n <= 0) G.remove(src, e); return true; }
      if (!G.free(dst, x, y, w, h, src === dst ? e : null)) return false;
      if (src !== dst) { G.remove(src, e); dst.items.push(e); }
      e.x = x; e.y = y; e.r = r; return true;
    }
    if (src === dst) return false;
    const left = G.add(dst, e.id, e.n);
    if (left === e.n) return false;
    e.n = left; if (e.n <= 0) G.remove(src, e);
    return true;
  };
  // 弹药：某口径各级各有多少
  G.ammo = (g, cal) => { const out = new Array(D.AMMO_TIER.length).fill(0); // 一级到五级（五级在 workshop.js 加）
   for (const e of g.items) if (e.id.startsWith('ammo:' + cal + ':')) out[+e.id.split(':')[2]] += e.n; return out; };
})(D);
