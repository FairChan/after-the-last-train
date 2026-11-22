/* Underdog · 战斗用品：能直接拿去打的东西（武器、近战、模块、被动、消耗品、护甲、背包、弹药）。
   1. 玻璃框：格子、物品块、地上、交易行里这些东西都套一层玻璃框，左上角是一个小图标（枪 / 近 / 模块 / 被 / 回血 / 护盾 / 雷 / 甲 / 包 / 弹，TAG_ART），
      升级型号右下角写 II / III；物品卡片多一行"直接用"。
   2. 升级型号：每把枪、每把近战、每个模块多两个型号——"·改"（品质高一档）和"·精工"（高两档），数值按档变好。
      只能在城里搜到（交易行不卖）。模块的效果按原型号走（K.useMod 映射回 base）。
   3. 新消耗品：军用维修包、纳米凝胶（C）、军用电池（V）、燃烧弹、集束手雷（Z）。快捷栏按按键字母自动收进来。
   4. 图鉴多一栏"装备"：枪 / 近战 / 模块 / 被动 / 消耗品 / 护甲 / 背包 / 弹药。
   英文在 i18n-en-gear.js。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {}), P = D.PAL, R = D.RAMP;
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;

  // ── 2. 升级型号
  const TIER = {
    2: { suf: '·改', dq: 1, gun: { dmg: 1.15, mag: 1.15, reload: 0.9, spread: 0.9, rate: 0.95 }, melee: { dmg: 1.18, cd: 0.93, range: 1 }, mod: { cd: 0.85 } },
    3: { suf: '·精工', dq: 2, gun: { dmg: 1.3, mag: 1.3, reload: 0.8, spread: 0.8, rate: 0.9 }, melee: { dmg: 1.36, cd: 0.86, range: 2 }, mod: { cd: 0.7 } },
  };
  const DESC = {
    gun: { 2: '比原型伤害 +15%、弹匣 +15%、换弹快 10%、更稳。原型：{0}', 3: '比原型伤害 +30%、弹匣 +30%、换弹快 20%、更稳。原型：{0}' },
    melee: { 2: '比原型伤害 +18%、出手快 7%、距离 +1。原型：{0}', 3: '比原型伤害 +36%、出手快 14%、距离 +2。原型：{0}' },
    mod: { 2: '比原型冷却短 15%。原型：{0}', 3: '比原型冷却短 30%。原型：{0}' },
  };
  for (const k of Object.keys(D.CARDS)) {
    const c = D.CARDS[k]; if (c.tier || c.slot === 'pas') continue;
    for (const t of [2, 3]) {
      const T = TIER[t], q = Math.min(5, c.q + T.dq), kind = c.gun ? 'gun' : c.melee ? 'melee' : 'mod', m = T[kind];
      const v = Object.assign({}, c, { name: c.name + T.suf, q, price: D.CARD_VALUE[q], tier: t, base: k, desc: DESC[kind][t].replace('{0}', c.desc) }); delete v.free;
      if (c.gun) { const g = c.gun; v.gun = Object.assign({}, g, { dmg: r1(g.dmg * m.dmg), mag: g.mag > 1 ? Math.max(g.mag + 1, Math.round(g.mag * m.mag)) : 1, reload: r2(g.reload * m.reload), spread: r3(g.spread * m.spread), rate: r3(g.rate * m.rate) }); }
      if (c.melee) { const M = c.melee; v.melee = Object.assign({}, M, { dmg: Math.round(M.dmg * m.dmg), cd: r2(M.cd * m.cd), range: M.range + m.range }); }
      if (kind === 'mod') v.cd = r1(c.cd * m.cd);
      D.CARDS[k + '_' + t] = v; if (D.CARD_SHAPE[k]) D.CARD_SHAPE[k + '_' + t] = D.CARD_SHAPE[k];
    }
  }
  D.cardBase = id => (D.CARDS[id] && D.CARDS[id].base) || id;
  const um0 = K.useMod; if (um0) K.useMod = (S, id) => um0(S, D.cardBase(id)); // 模块效果按原型号

  // ── 3. 新消耗品
  Object.assign(D.USE, {
    medkit2: { name: '军用维修包', q: 3, v: 160, w: 1, h: 2, stack: 2, art: 'medpack2', heal: 55, time: 1.8, cd: 5, key: 'C', desc: '读条 1.8 秒，回复 55 耐久。挨打会打断（药不消耗）' },
    nanogel: { name: '纳米凝胶', q: 2, v: 90, w: 1, h: 1, stack: 3, art: 'nanogel', heal: 18, time: 0.25, cd: 2, key: 'C', desc: '读条 0.25 秒，回复 18 耐久' },
    cell3: { name: '军用电池', q: 4, v: 220, w: 1, h: 2, stack: 2, art: 'cell3', shield: 55, time: 1, key: 'V', desc: '读条 1 秒，获得 55 护盾' },
    incend: { name: '燃烧弹', q: 2, v: 75, w: 1, h: 1, stack: 3, art: 'nade_incend', throw: 'incend', key: 'Z', desc: 'Z 扔向准星：落点一圈着火，圈里的敌人烧 4 秒' },
    cluster: { name: '集束手雷', q: 3, v: 120, w: 1, h: 1, stack: 3, art: 'nade_cluster', throw: 'cluster', key: 'Z', desc: 'Z 扔向准星：先炸一下，再弹出 4 颗小雷各炸一次' },
  });
  Object.assign(D.ITEM_ART, {
    medpack2: p => { p.box(5, 3, 18, 22, R.olive, { r: 2 }); p.rect(12, 7, 4, 14, '#f0535e'); p.rect(7, 12, 14, 4, '#f0535e'); p.rect(9, 1, 10, 2, '#949fb6'); p.rect(5, 20, 18, 1, '#253017'); },
    nanogel: p => { p.box(9, 4, 10, 20, R.glass, { r: 2, emit: 1 }); p.rect(10, 2, 8, 3, '#c8cdda'); p.rect(11, 10, 6, 10, '#8dff6a', 1); p.px(13, 8, '#ffffff', 1); },
    cell3: p => { p.box(6, 3, 16, 22, R.gunmetal, { r: 2 }); p.grad(9, 6, 10, 16, R.gold, 1); p.rect(10, 1, 8, 2, '#e3c14a'); p.rect(12, 12, 4, 1, '#ffffff', 1); p.rect(12, 16, 4, 1, '#ffffff', 1); },
    nade_incend: p => { p.ell(14, 16, 7, 9, R.red, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); p.rect(11, 12, 6, 7, '#ffd84a', 1); p.px(13, 11, '#fff3b0', 1); p.px(14, 10, '#ff7a2e', 1); },
    nade_cluster: p => { p.ell(14, 16, 8, 9, R.gunmetal, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); for (const [x, y] of [[9, 13], [18, 13], [9, 20], [18, 20], [14, 16]]) p.disc(x, y, 1.5, '#ff7a2e', 1); },
  });
  // 新手雷的效果（arms.js 的 nadeBoomX 之上再套一层）
  const nb0 = K.nadeBoomX;
  K.nadeBoomX = function (S, n) {
    if (n.kind === 'incend') {
      for (const e of S.enemies) if (!e.dead && e.f === S.f && Math.hypot(e.x - n.x, e.y - n.y) < 34 + e.r) { e.burnT = Math.max(e.burnT || 0, 4); K.hurt(S, e, 4, { kx: e.x - n.x, ky: e.y - n.y, kb: 0, col: '#ff8a2e' }); }
      for (let i = 0; i < 26; i++) { const a = S.rng() * Math.PI * 2, d = S.rng() * 30; K.part(S, 'spark', n.x + Math.cos(a) * d, n.y + Math.sin(a) * d * 0.6, S.rng.range(-10, 10), S.rng.range(-60, -20), 0.6, S.rng.pick(['#ff8a2e', '#ffd84a', '#ff3d2e'])); }
      K.ring(S, n.x, n.y, 34, '#ff8a2e'); K.flashLight(S, n.x, n.y, 90, '#ff8a2e', 1.2); D.Sfx && D.Sfx.play('boom'); K.alertAround(S, n.x, n.y, 160); return true;
    }
    if (n.kind === 'cluster') {
      K.explode(S, n.x, n.y, 26, 18, false); K.alertAround(S, n.x, n.y, 200);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + S.rng.range(-0.3, 0.3), d = S.rng.range(22, 34), tx = n.x + Math.cos(a) * d, ty = n.y + Math.sin(a) * d * 0.7; if (D.solidAt(S.A, tx, ty)) continue; S.nades.push({ x: n.x, y: n.y - 4, sx: n.x, sy: n.y - 4, tx, ty, t: 0, fly: 0.25, fuse: 0.15 + i * 0.08, dmg: 12, own: true, kind: 'mini' }); }
      return true;
    }
    if (n.kind === 'mini') { K.explode(S, n.x, n.y, 16, n.dmg || 12, false); return true; }
    return nb0 ? nb0(S, n) : false;
  };

  // ── 1. 战斗用品的标记：左上角一个小图标（ic 决定画哪个），tag 只当 alt 文字（用户："枪/弹/C 用左上角的 logo 表示，尽量小"）
  const TAG = { gun: '枪', melee: '近', mod: 'QE', pas: '被' };
  const USE_IC = { C: 'heal', V: 'cell', Z: 'nade' };
  D.combatTag = function (id) {
    if (!id || typeof id !== 'string') return null;
    if (id.startsWith('card:')) { const c = D.CARDS[id.slice(5)]; return c ? { tag: TAG[c.slot] || '卡', ic: c.slot, tier: c.tier || 0, slot: c.slot } : null; }
    if (id.startsWith('use:')) { const u = D.USE[id.slice(4)]; return u ? { tag: u.key || 'C', ic: USE_IC[u.key] || 'use', slot: 'use', key: u.key } : null; }
    if (D.Armor && D.Armor.is(id)) return { tag: '甲', ic: 'armor', slot: 'armor' };
    if (id.startsWith('bag:')) return { tag: '包', ic: 'bag', slot: 'bag' };
    if (id.startsWith('ammo:')) return { tag: '弹', ic: 'ammo', slot: 'ammo' };
    return null;
  };
  // 角标图标：10×10 像素（2026-11-16 重画：深色描边 + 亮 / 中 / 暗三档，旧的 8×8 平涂太粗）。c 是颜色表（字母 → 颜色），r 是 10 行。第一次用时画成图，之后复用
  const TAG_ART = {
    gun:    { c: { 'o': '#0a0d17', 'h': '#f4f7ff', 'm': '#a9b3cb', 's': '#5b6480', 'g': '#c9a25a', 'G': '#8a6430' },
      r: ['..........', 'ooooooooo.', 'ohhhhhhhmo', 'ommmmmmmso', '.osgmossso', '.oggoso.o.', '.oggGoooo.', 'oggGo.....', 'ogGo......', 'ooo.......'] },
    melee:  { c: { 'o': '#0a0d17', 'h': '#ffffff', 'm': '#bfd4ea', 's': '#6f86a3', 'b': '#c7893c', 'd': '#7a4c1c' },
      r: ['.......oo.', '......ohmo', '.....ohmo.', '....ohmo..', '...ohms...', '.ooohso...', '.obboo....', 'obdo......', 'odo.......', '.o........'] },
    mod:    { c: { 'o': '#0a0d17', 'h': '#c8f8ff', 'm': '#3fc4e6', 's': '#1d6f8e', 'c': '#0d2532', 'a': '#9effff', 'p': '#9fb2c8' },
      r: ['...p..p...', '.oooooooo.', '.ohhhhhmo.', 'pohccccsop', '.ohcaacso.', '.ohcaacso.', 'pohccccsop', '.omssssso.', '.oooooooo.', '...p..p...'] },
    pas:    { c: { 'o': '#0a0d17', 'h': '#fff6c2', 'm': '#ffcf3a', 's': '#c07a12' },
      r: ['....oo....', '...ohho...', '..ohhmmo..', '.ohhmmmmo.', 'ohhmmmmmso', '.ommmmsso.', '..ommsso..', '...osso...', '....oo....', '..........'] },
    heal:   { c: { 'o': '#0a0d17', 'h': '#e4ffd6', 'm': '#6fe04a', 's': '#2f8f22' },
      r: ['...oooo...', '...ohmo...', '...ohmo...', 'oooohmoooo', 'ohhhhmmmmo', 'ommmmmmsso', 'oooomsoooo', '...omso...', '...osso...', '...oooo...'] },
    cell:   { c: { 'o': '#0a0d17', 'h': '#d6ecff', 'm': '#4fa6f5', 's': '#235f9e', 'w': '#ffffff' },
      r: ['...oooo...', '.oohhmmoo.', '.ohhhmmso.', '.ohmmmwso.', '.ohmmwmso.', '.ohmwwwso.', '.ohmwmmso.', '.ohwmmmso.', '.osssssso.', '.oooooooo.'] },
    nade:   { c: { 'o': '#0a0d17', 'h': '#ffe0a8', 'm': '#ff8a2e', 's': '#b04a10', 'p': '#c8cbd6' },
      r: ['.....ppp..', '....p..p..', '..oooooo..', '.ohhhmmmo.', 'ohhmmmmmso', 'ohmmmmmmso', 'ommmmmssso', '.ommsssso.', '..oooooo..', '..........'] },
    use:    { c: { 'o': '#0a0d17', 'h': '#eef0f6', 'm': '#b8bccb', 's': '#6c7184', 'r': '#ff6a6a' },
      r: ['...oooo...', '..ohhmso..', '.oooooooo.', '.ohhhmmso.', '.ohrrrrso.', '.ohmmmmso.', '.ohmmmmso.', '.ohmmmsso.', '.osssssso.', '.oooooooo.'] },
    armor:  { c: { 'o': '#0a0d17', 'h': '#e2f5ff', 'm': '#7fc4ee', 's': '#3a6f99' },
      r: ['oooooooooo', 'ohhhhmmmso', 'ohhhhmmmso', 'ohhhhmmsso', 'ohhhhmmsso', '.ohhhmmso.', '.ohhmmsso.', '..ohmmso..', '...ohso...', '....oo....'] },
    bag:    { c: { 'o': '#0a0d17', 'h': '#f3cf95', 'm': '#d09a52', 's': '#8a5a22', 'a': '#6b4318' },
      r: ['...oooo...', '..oo..oo..', '.oooooooo.', 'ohhhhhmmmo', 'ohmmmmmmso', 'oaaaaaaaao', 'ohmmoommso', 'ommmmmssso', '.oooooooo.', '..........'] },
    ammo:   { c: { 'o': '#0a0d17', 'c': '#ffb07a', 'C': '#d96a2c', 'h': '#fff0b8', 'm': '#e8b450', 's': '#9a6a22' },
      r: ['....oo....', '...occo...', '..occcCo..', '..occcCo..', '..oooooo..', '..ohmmso..', '..ohmmso..', '..ohmmso..', '.oooooooo.', '.osssssso.'] },
  };
  const tagURL = {};
  function tagIcon(ic) {
    if (tagURL[ic]) return tagURL[ic];
    const A = TAG_ART[ic] || TAG_ART.use, n = A.r.length, [c, x] = D.canvas(n, n);
    A.r.forEach((row, j) => { for (let i = 0; i < n; i++) { const col = A.c[row[i]]; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } } });
    return (tagURL[ic] = c.toDataURL());
  }
  D.combatHow = function (id) {
    const t = D.combatTag(id); if (!t) return null;
    return { gun: '装到主武器槽（行动中长按 F 从地上直接换上）', melee: '装到近战槽（行动中长按 F 从地上直接换上）', mod: '装到模块槽，按 Q / E 用', pas: '装到被动槽（据点的配装页）',
      use: '放在背包里，按 {0} 用'.replace('{0}', t.key), armor: '穿到护甲槽，挡在耐久前面', bag: '换上就能多带东西', ammo: '换弹时自动从背包里拿' }[t.slot] || null;
  };
  const U = D.UI, X = U && U._;
  if (X) {
    const TIERS = ['', '', 'II', 'III'];
    X.cmb = id => { const t = D.combatTag(id); return t ? { cls: ' cmb', html: `<i class="glass"></i><b class="cbk"><img src="${tagIcon(t.ic)}" alt="${t.tag}"></b>${t.tier ? `<b class="ctier">${TIERS[t.tier]}</b>` : ''}` } : { cls: '', html: '' }; };

    // ── 4. 图鉴"装备"栏
    const order = Object.keys(D.CARDS).filter(k => !D.CARDS[k].tier);
    const cards = slot => Object.keys(D.CARDS).filter(k => D.CARDS[k].slot === slot).sort((a, b) => order.indexOf(D.cardBase(a)) - order.indexOf(D.cardBase(b)) || (D.CARDS[a].tier || 1) - (D.CARDS[b].tier || 1)).map(k => 'card:' + k);
    const GC = [
      ['gun', '枪械', () => cards('gun')], ['melee', '近战', () => cards('melee')], ['mod', '模块', () => cards('mod')], ['pas', '被动', () => cards('pas')],
      ['use', '消耗品', () => Object.keys(D.USE).map(k => 'use:' + k)],
      ['armor', '护甲', () => (D.ARMOR_LV || []).map((L, i) => L ? 'armor:' + i + ':' + L.max : null).filter(Boolean)],
      ['bag', '背包', () => Object.keys(D.BAGS).map(k => 'bag:' + k)],
      ['ammo', '弹药', () => { const o = []; for (const c in D.CALIBER) for (let t = 1; t < D.AMMO_TIER.length; t++) o.push('ammo:' + c + ':' + t); return o; }],
    ];
    U.gearCodex = function (pf, body, sw) {
      const G = D.Game, cat = GC.find(c => c[0] === G.gearCat) || GC[0], list = cat[2](), total = GC.reduce((s, c) => s + c[2]().length, 0);
      const P = X.page('cx:gear:' + cat[0], list.length, 40);
      const tile = id => { const it = D.itemInfo(id), c = id.startsWith('card:') && D.CARDS[id.slice(5)]; return X.itemTile(id, { sub: D.QUALITY[it.q].name + (c && c.tier ? ' · ' + (c.tier === 2 ? '改良型' : '精工型') : '') }); };
      body.innerHTML = `<div class="stash codex items">${sw}<div class="st-head"><h3>装备</h3><span class="hint">战斗里能直接用的东西，一共 <b>${total}</b> 种。都带玻璃框，左上角是用法；"·改""·精工"是升级型号，只能在城里搜到。</span></div>
        <div class="cx-cats">${GC.map(c => `<button class="tab${c === cat ? ' on' : ''}" data-gcat="${c[0]}">${c[1]} <em>${c[2]().length}</em></button>`).join('')}</div>
        <div class="cx-items" data-pgarea="cx:gear:${cat[0]}">${list.slice(P.from, P.to).map(tile).join('')}</div>${P.html}</div>`;
      body.querySelectorAll('[data-gcat]').forEach(b => b.onclick = () => { D.Sfx.play('click'); G.gearCat = b.dataset.gcat; U.refresh(); });
      body.querySelectorAll('[data-cxm]').forEach(el => el.onclick = () => { D.Sfx.play('click'); G.codexMode = el.dataset.cxm; U.refresh(); });
    };
  }
})(D);
