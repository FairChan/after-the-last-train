/* 末班之后 · 小样二：存档与设置
   - 三个存档位。每个位同时写进浏览器数据库（IndexedDB）和本地存储（localStorage），读的时候取较新的那份；两样都用不了就只留在内存里，不报错。
   - 存的是"档案"：钱、仓库、背包、保险箱、配装、机库、城市进度（知道哪些站、有哪些入口）、最近几趟。城市本身按种子重建。
   - 行动中途关掉网页 = 这一趟算工壳损毁（搜打撤的惯例，不然刷新就能躲死）。所以出发和每次换站都先存一份"损毁结局"，撤出或战死时再存真实结果。
   - 设置（音量、震屏、闪光、伤害数字）单独存，不跟存档位走。
   - 版本号 v：以后改存档结构时在 migrate 里补迁移。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const VERSION = 1, SLOTS = 3, DB = 'after-the-last-train', STORE = 'kv', LS = 'atlt:';
  const mem = {};
  let dbp = null;
  // ── 底层存取：IndexedDB + localStorage + 内存
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(res => {
      try {
        const rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
        rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  async function idbGet(k) { const db = await idb(); if (!db) return null; return new Promise(res => { try { const rq = db.transaction(STORE).objectStore(STORE).get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch (e) { res(null); } }); }
  async function idbSet(k, v) { const db = await idb(); if (!db) return false; return new Promise(res => { try { const tx = db.transaction(STORE, 'readwrite'); v == null ? tx.objectStore(STORE).delete(k) : tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch (e) { res(false); } }); }
  function lsGet(k) { try { const s = localStorage.getItem(LS + k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { v == null ? localStorage.removeItem(LS + k) : localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  async function get(k) { const a = await idbGet(k), b = lsGet(k), c = mem[k] || null; return [a, b, c].filter(Boolean).sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0))[0] || null; }
  async function set(k, v) { mem[k] = v; const b = lsSet(k, v), a = await idbSet(k, v); return a || b; }

  // ── 档案 ⇄ 纯数据
  const grid = g => ({ w: g.w, h: g.h, items: g.items.map(e => ({ id: e.id, n: e.n, x: e.x, y: e.y, r: e.r ? 1 : 0 })) });
  const known = id => { try { D.itemInfo(id); return true; } catch (e) { return false; } };
  function serialize(pf) {
    return {
      v: VERSION, savedAt: Date.now(), seed: pf.seed, money: pf.money, raids: pf.raids, wins: pf.wins, deaths: pf.deaths,
      stash: grid(pf.stash), kit: grid(pf.kit), safe: grid(pf.safe), keycase: grid(pf.keycase || D.Grid.make(D.KEYCASE[0], D.KEYCASE[1])), pouch: grid(pf.pouch || D.Grid.make(5, 1)), load: JSON.parse(JSON.stringify(pf.load)),
      shells: JSON.parse(JSON.stringify(pf.shells)), shell: pf.shell, log: JSON.parse(JSON.stringify(pf.log.slice(0, 20))),
      city: D.Cities ? D.Cities.homeState(pf) : { ver: pf.city.ver || 1, known: [...pf.city.known], entries: [...pf.city.entries], found: [...(pf.city.found || [])] }, note: pf.note || null, // city 一直是岚川（多城市：cities.js）
      multi: D.Cities ? D.Cities.save(pf) : null, // 别的城、现在在哪座城、解锁了哪些、第二幕剧情
      tut: pf.tut | 0, hints: (pf.hints || []).slice(0, 64), dWins: (pf.dWins || [0, 0, 0]).slice(0, 3), diff: pf.diff | 0, skins: pf.skins || {},
      story: D.Story ? D.Story.serialize(pf) : null, // 主线进度（M4）
      grow: D.Growth ? D.Growth.serialize(pf) : null, // 成长与经济（M3）
    };
  }
  function migrate(o) {
    if (!o || typeof o !== 'object' || o.seed == null) throw new Error('不是存档文件');
    if ((o.v || 0) > VERSION) throw new Error('这个存档来自更新的版本');
    // v0 → v1：还没有机库的老存档
    if (!o.shells) { o.shells = { worker: { own: 1, cond: 1 } }; o.shell = 'worker'; }
    return o;
  }
  function deserialize(o) {
    o = migrate(o);
    const G = D.Grid, mkGrid = g => { const out = G.make(g.w, g.h); for (const e0 of g.items || []) { const e = D.remapCard ? Object.assign({}, e0, { id: D.remapCard(e0.id) }) : e0; if (known(e.id)) out.items.push({ id: e.id, n: e.n, x: e.x, y: e.y, r: e.r ? 1 : 0 }); } return out; };
    const city = D.makeCity(o.seed, (o.city && o.city.ver) || 1); // 老存档没记版本 = 第 1 版城市（站的编号不变）
    if (o.city) { city.known = new Map(o.city.known); city.entries = new Set(o.city.entries); city.found = new Set((o.city.found || []).filter(id => city.stations[id] && city.stations[id].exit === 'hidden')); }
    for (const s of city.stations) if (!s.dead && !city.known.has(s.id)) city.known.set(s.id, 0); // 后来加进城市的站（储备库）
    const L = Object.assign({ gun: 'nailgun', melee: 'shovel', q: null, e: null, pas: [null, null, null], bag: 'canvas' }, o.load);
    if (D.remapCard) L.melee = D.remapCard(L.melee); // 删掉的近战换成新的（melee.js）
    for (const k of ['gun', 'melee', 'q', 'e']) if (L[k] && !D.CARDS[L[k]]) L[k] = { gun: 'nailgun', melee: 'shovel' }[k] || null;
    L.pas = (L.pas || []).map(k => (k && D.CARDS[k] ? k : null)); while (L.pas.length < 3) L.pas.push(null);
    if (!D.BAGS[L.bag]) L.bag = 'canvas';
    const shells = {}; for (const k in o.shells) if (D.SHELLS[k]) shells[k] = o.shells[k]; if (!shells.worker) shells.worker = { own: 1, cond: 1 };
    const pf = {
      seed: o.seed, money: o.money | 0, raids: o.raids | 0, wins: o.wins | 0, deaths: o.deaths | 0,
      stash: mkGrid(o.stash), kit: mkGrid(o.kit), safe: mkGrid(o.safe), keycase: mkGrid(o.keycase || { w: D.KEYCASE[0], h: D.KEYCASE[1], items: [] }), pouch: mkGrid(o.pouch || { w: 5, h: 1, items: [] }), load: L, shells, shell: shells[o.shell] ? o.shell : 'worker',
      city, log: o.log || [], note: o.note || null,
      tut: o.tut == null ? 1 : o.tut | 0, hints: Array.isArray(o.hints) ? o.hints.filter(k => typeof k === 'string') : [], // 老存档当作已经教过了
      dWins: Array.isArray(o.dWins) ? [0, 1, 2].map(i => o.dWins[i] | 0) : [o.wins | 0, 0, 0], diff: o.diff | 0, skins: o.skins && typeof o.skins === 'object' ? o.skins : {},
    };
    if (D.Story) D.Story.deserialize(pf, o.story);
    if (D.Growth) D.Growth.deserialize(pf, o.grow);
    if (D.Cities) D.Cities.load(pf, o.multi); // 多城市：最后再换到存档时在的那座城
    return pf;
  }
  // 一行摘要（存档位列表里显示）
  const summary = o => o && { slot: o.slot, day: (o.raids | 0) + 1, money: o.money | 0, wins: o.wins | 0, deaths: o.deaths | 0, seed: o.seed, savedAt: o.savedAt, shell: D.SHELLS[o.shell] ? D.SHELLS[o.shell].name : '工壳', note: o.note };

  const Save = D.Save = { SLOTS, VERSION, serialize, deserialize, lastSavedAt: 0 };
  Save.list = async () => { const out = []; for (let i = 0; i < SLOTS; i++) { const o = await get('slot' + i); out.push(o ? summary(Object.assign({ slot: i }, o)) : { slot: i, empty: true }); } return out; };
  Save.load = async slot => { const o = await get('slot' + slot); return o ? deserialize(o) : null; };
  Save.write = async (slot, pf, note) => { if (slot == null || !pf) return false; pf.note = note || null; const ok = await set('slot' + slot, serialize(pf)); Save.lastSavedAt = Date.now(); return ok; };
  Save.remove = slot => set('slot' + slot, null);
  // 出发 / 换站时：先存一份"这一趟算损毁"的结果。撤出或战死后会被真实结果覆盖
  Save.checkpointRaid = async (slot, R) => {
    if (slot == null) return;
    const pf = deserialize(serialize(R.pf));
    const R2 = Object.assign({}, R, { pf, city: pf.city, safe: pf.safe, bag: { w: R.bag.w, h: R.bag.h, items: R.bag.items.map(e => Object.assign({}, e)) } });
    D.finishRaid(R2, false);
    pf.log[0].abandoned = true;
    await set('slot' + slot, Object.assign(serialize(pf), { note: 'raid' }));
  };
  // 导出 / 导入：一个 JSON 文件
  Save.exportFile = (pf, slot) => {
    const o = serialize(pf), blob = new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `Underdog-存档${(slot | 0) + 1}-第${pf.raids + 1}天.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  Save.importText = text => deserialize(JSON.parse(text));

  // ── 设置
  const DEFAULTS = { master: 0.8, sfx: 1, ambient: 0.7, music: 0.6, cb: false, speed: 1, aimAssist: true, shake: 1, reduceFlash: false, dmgNums: true, hints: true, autoMeds: true, autoAmmo: false, autoQ: -1, tradeConfirm: true, foeArrows: true, dlgTimers: true, typeSpeed: 1, crt: true, lite: true, fillWindow: false, hudAlpha: 0.8, hudScale: 1, binds: {} };
  D.settings = Object.assign({}, DEFAULTS);
  Save.loadSettings = async () => { const o = await get('settings'); if (o) Object.assign(D.settings, o.data || {}); D.applySettings(); };
  Save.saveSettings = () => set('settings', { savedAt: Date.now(), data: D.settings });
  Save.resetSettings = () => { Object.assign(D.settings, DEFAULTS); D.applySettings(); Save.saveSettings(); };
  D.applySettings = () => { if (D.Sfx && D.Sfx.setVolume) D.Sfx.setVolume(D.settings); if (D.onResize) D.onResize(); }; // 铺满窗口要重新算放大倍数
})(D);
