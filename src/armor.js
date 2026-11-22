/* Underdog · 小样二：护甲（用户 2026-11-15）。
   对局里捡到护甲（1–6 级）穿上，和护盾电池一样多一条蓝条：
   - 护盾：暂时的，3 秒后开始掉；挨打时整下吃掉。
   - 护甲：不会自己掉，但会被打穿；不管打没打穿都掉耐久，耐久没了就碎了（还穿着、不管用），回据点修。
   挨打的顺序：护盾 → 护甲 → 机身耐久。环境伤害（蒸汽之类，src.env）不走护甲。
   物品 id 'armor:级:耐久'，耐久写进 id：搬来搬去、存档都不会丢。穿着的那件在 R.load.armor / pf.load.armor（两边一起改）。
   挂钩：player.js 的 damagePlayer 护盾之后调 K.armorHit；draw.js HUD 的蓝条调 D.drawShieldBar；ui-bag.js 的护甲槽；
   ui.js / ui-card.js 的提示；这里包了 D.itemInfo、D.startRaid、D.finishRaid、D.takeGround、D.Growth.rollGear、K.onKillX、K.enemyStep、K.worldPost、U.gearSlotsHTML、U.bindGearSlots、U.gearClick。
   设计：design/features/armor/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {}), P = D.PAL;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const BLUE = '#5a8dff', BROKEN = '#5c6178';

  // ── 六个等级：耐久上限、移动速度、格子、满耐久的价值、修一点耐久多少钱
  const LV = D.ARMOR_LV = [null,
    { name: '铁皮护甲',   max: 16, speed: 0,     w: 2, h: 2, v: 60,   fix: 2,  col: ['#4a4038', '#7a6a58', '#a8957a', '#d8c4a0'] },
    { name: '钢板护甲',   max: 24, speed: 0,     w: 2, h: 2, v: 140,  fix: 3,  col: ['#2f3542', '#5a6476', '#8a96aa', '#5fd068'] },
    { name: '插板护甲',   max: 32, speed: -0.02, w: 2, h: 3, v: 280,  fix: 4,  col: ['#2a3020', '#4e5a38', '#7a8a58', '#4a9dff'] },
    { name: '陶瓷护甲',   max: 40, speed: -0.04, w: 2, h: 3, v: 480,  fix: 6,  col: ['#3a3a40', '#8a8780', '#c9c4b8', '#b36bff'] },
    { name: '钛板护甲',   max: 50, speed: -0.06, w: 3, h: 3, v: 800,  fix: 8,  col: ['#26303c', '#56708a', '#8fb0cc', '#ffc23d'] },
    { name: '重型护甲',   max: 60, speed: -0.08, w: 3, h: 3, v: 1300, fix: 11, col: ['#1c1f28', '#3b4150', '#5d6578', '#ff3d4a'] },
  ];
  // 每种敌人的穿透（0–6）；没列的算 2，爆炸（没有来源）算 3
  const PEN = D.ARMOR_PEN = { mite: 0, scav: 0, mannequin: 1, crawler: 1, dog: 1, medic: 1, drone: 2, bomber: 2, welder: 2, jammer: 2, turret: 3, raider: 3, stalker: 3, gunner: 4, engineer: 4, boss: 4, queen: 4, archivist: 4, warden: 5, sniper: 5 };

  const A = D.Armor = {};
  A.is = id => typeof id === 'string' && id.startsWith('armor:');
  A.id = (lv, dur) => 'armor:' + lv + ':' + Math.max(0, Math.round(dur));
  A.parse = id => { if (!A.is(id)) return null; const [, l, d] = id.split(':'), lv = D.clamp(+l || 1, 1, 6), max = LV[lv].max; return { lv, dur: D.clamp(d == null ? max : +d, 0, max), max }; };
  A.worn = R => (R && R.load && A.parse(R.load.armor)) || null;
  A.set = (R, lv, dur) => { const id = lv ? A.id(lv, dur) : null; R.load.armor = id; if (R.pf && R.pf.load) R.pf.load.armor = id; return id; };
  A.speedMul = R => { const a = A.worn(R); return a ? 1 + LV[a.lv].speed : 1; };
  A.fixCost = id => { const a = A.parse(id); return a ? (a.max - a.dur) * LV[a.lv].fix : 0; };
  // 掷一件：q 是这件东西的品质（0–5），等级 = q + 1；耐久满的六到十成
  A.roll = (rng, q, used) => { const lv = D.clamp((q | 0) + 1, 1, 6), max = LV[lv].max; return A.id(lv, used === false ? max : Math.max(1, Math.round(max * rng.range(0.6, 1)))); };

  // ── 物品信息
  const cache = new Map(), ii0 = D.itemInfo;
  D.itemInfo = function (id) {
    if (!A.is(id)) return ii0.apply(this, arguments);
    if (cache.has(id)) return cache.get(id);
    const a = A.parse(id), L = LV[a.lv];
    const o = { name: L.name, v: Math.round(L.v * (0.3 + 0.7 * a.dur / a.max)), w: L.w, h: L.h, stack: 1, q: a.lv - 1, art: 'armor_' + a.lv, kind: 'armor', lv: a.lv, dur: a.dur, max: a.max,
      desc: a.dur > 0 ? `${a.lv} 级护甲 · 耐久 ${a.dur}/${a.max}` : `${a.lv} 级护甲 · 碎了` };
    cache.set(id, o); return o;
  };
  // 提示（ui.js 的 tipOf、ui-card.js 的物品卡）
  A.tip = id => { const it = D.itemInfo(id); return `${it.name}【${it.lv} 级护甲】` + (it.dur > 0 ? `耐久 ${it.dur}/${it.max}` : '碎了，回据点修') + `｜挡子弹、会被打穿、都掉耐久｜单击或拖到护甲槽穿上｜价值 ${it.v}`; };
  A.card = id => {
    const it = D.itemInfo(id), L = LV[it.lv];
    const stats = [['等级', it.lv + ' 级'], ['耐久', it.dur + '/' + it.max], L.speed ? ['移动', Math.round(L.speed * 100) + '%'] : null, ['挡住时', '机身只吃两成'], ['修满', A.fixCost(id) + ' 元']].filter(Boolean);
    return { sub: '护甲', desc: it.dur <= 0 ? '碎了：穿着也不管用，回据点配装页修。' : '和护盾一样是一条蓝条，但不会自己掉。穿透比等级高的攻击容易打穿；不管打没打穿都掉耐久。', stats };
  };
  // 图标：一件背心，中间一块插板，级数越高越厚、颜色越深；右下角的小方块是级数
  const vest = lv => p => {
    const [a, b, c, d] = LV[lv].col, big = lv >= 5;
    p.rect(6, 3, 4, 5, a); p.rect(18, 3, 4, 5, a); // 肩带
    p.rect(4, 7, 20, 18, a); p.rect(5, 8, 18, 16, b); p.rect(11, 7, 6, 2, a); // 身子、领口
    p.rect(9, 10, 10, big ? 11 : 10, c); p.rect(9, 10, 10, 1, '#ffffff'); p.rect(9, big ? 20 : 19, 10, 1, a); // 插板
    if (lv >= 3) { p.rect(5, 19, 4, 5, a); p.rect(19, 19, 4, 5, a); } // 弹匣包
    if (big) { p.rect(3, 8, 2, 10, c); p.rect(23, 8, 2, 10, c); } // 侧板
    for (let i = 0; i < lv; i++) p.rect(6 + i * 3, 25, 2, 2, d);
  };
  for (let lv = 1; lv <= 6; lv++) D.ITEM_ART['armor_' + lv] = vest(lv);

  // ── 穿上 / 脱下（行动中）。put(id) 把换下来的放回去（背包，放不下丢脚边）
  A.wear = function (S, id, put) {
    const R = S.raid, a = A.parse(id); if (!a) return false;
    const old = R.load.armor; A.set(R, a.lv, a.dur); if (old) put(old);
    const p = S.player; if (D.playerAct) D.playerAct(p, 'swap', 0.5, 'bag'); sfx('power');
    if (K.ring) K.ring(S, p.x, p.y - 6, 14, BLUE);
    if (D.UI && D.UI.toast) D.UI.toast('穿上了' + LV[a.lv].name + '（' + a.lv + ' 级 · 耐久 ' + a.dur + '/' + a.max + '）');
    return true;
  };
  A.takeOff = function (S) { const R = S.raid, cur = R.load.armor; if (!cur) return null; A.set(R, 0); sfx('click'); return cur; };

  // ── 挨打：护盾之后、机身之前。返回打到机身的伤害
  A.penOf = (S, src) => {
    const k = src && (src.kind || src.srcKind || (src.from && src.from.kind));
    const lv = S.raid ? D.threatLv(S.raid) : 1;
    return (k ? (PEN[k] != null ? PEN[k] : 2) : 3) + (lv >= 5 ? 1 : 0) + (lv >= 8 ? 1 : 0); // 威胁 10 级制
  };
  A.penChance = (pen, lv, dur, max) => D.clamp((pen > lv ? 0.85 : pen === lv ? 0.4 : pen === lv - 1 ? 0.1 : 0) + 0.3 * (1 - dur / max), 0, 0.95);
  // 纯函数：给定这一下、护甲、穿透和掷出来的数（0–1），算出机身吃多少、护甲掉多少
  A.resolve = function (left, a, pen, roll) {
    if (!a || a.dur <= 0 || left <= 0) return { hp: left, wear: 0, through: false };
    if (roll < A.penChance(pen, a.lv, a.dur, a.max)) { const wear = Math.min(a.dur, Math.max(1, Math.round(left * 0.5))); return { hp: Math.max(1, Math.round(left * 0.85)), wear, through: true }; }
    const take = Math.min(a.dur, left); return { hp: Math.round(take * 0.2) + (left - take), wear: take, through: false };
  };
  K.armorHit = function (S, left, src) {
    const R = S.raid, a = A.worn(R);
    if (!a || a.dur <= 0 || left <= 0 || (src && src.env) || S.tut) return left;
    const r = A.resolve(left, a, A.penOf(S, src), S.rng()), p = S.player, text = K.text, part = K.part;
    const dur = a.dur - r.wear; A.set(R, a.lv, dur);
    if (part) for (let i = 0; i < 6; i++) part(S, 'spark', p.x, p.y - 6, S.rng.range(-70, 70), S.rng.range(-70, 30), 0.22, r.through ? P.O : BLUE);
    if (text) { if (r.through) text(S, p.x + 10, p.y - 28, '穿透', P.O); else text(S, p.x + 10, p.y - 26, '-' + r.wear, BLUE); }
    sfx(r.through ? 'hit2' : 'tink');
    if (dur <= 0) { if (text) text(S, p.x, p.y - 36, '护甲碎了', P.r, true); sfx('heavy'); if (K.addShake) K.addShake(S, 0.3); S.events.push({ type: 'armorBreak' }); }
    return r.hp;
  };
  // 敌人打出去的子弹记下是谁打的（算穿透用）
  const es0 = K.enemyStep;
  if (es0) K.enemyStep = function (S, e, dt) {
    const n0 = S.eshots.length, r = es0.apply(this, arguments);
    for (let i = n0; i < S.eshots.length; i++) if (S.eshots[i] && !S.eshots[i].srcKind) S.eshots[i].srcKind = e.kind;
    return r;
  };

  // ── 重的护甲走得慢一点（每帧对一下，换护甲时立刻生效）
  const wp0 = K.worldPost;
  K.worldPost = function (S, dt) {
    const r = wp0 ? wp0.apply(this, arguments) : undefined, p = S.player;
    if (p && S.raid && !S.tut) { const m = A.speedMul(S.raid); if (p.armSp !== m) { p.speed = p.speed / (p.armSp || 1) * m; p.armSp = m; } }
    return r;
  };

  // ── 出发带上、死了丢掉
  const sr0 = D.startRaid;
  D.startRaid = function (pf) { const R = sr0.apply(this, arguments); if (R && R.load) R.load.armor = (pf.load && pf.load.armor) || null; return R; };
  const fr0 = D.finishRaid;
  D.finishRaid = function (R, ok) {
    const worn = !R.tut && R.pf && R.pf.load && R.pf.load.armor, out = fr0.apply(this, arguments);
    if (!ok && worn) { out.lost.push({ id: worn, n: 1 }); out.value += D.itemInfo(worn).v; R.pf.load.armor = null; }
    return out;
  };

  // ── 地上捡：身上没穿就直接穿上（开着背包时照常进背包，自己拖）
  const tg0 = D.takeGround;
  D.takeGround = function (S, g, quiet) {
    if (!g || g.dropped) return 0; // 自己丢掉的捡不回来
    if (g && A.is(g.id) && !S.tut && !A.worn(S.raid) && !(S.lootOpen && S.lootOpen.inv)) {
      const id = g.id; g.n = 0; S.ground = S.ground.filter(o => o.n > 0); S.groundNear = S.groundNear.filter(o => o.n > 0);
      A.wear(S, id, x => D.dropAt(S, x, 1)); S.events.push({ type: 'pickup', id, n: 1 }); return 1;
    }
    return tg0.apply(this, arguments);
  };

  // ── 掉落：容器（军械类最常见）、回收者、工程机、首领
  const CHANCE = { armory: 0.18, gunrack: 0.18, supply: 0.12, locker: 0.05, lockbox: 0.05, evidence: 0.05, safe: 0.04, vault: 0.04 };
  A.chanceOf = C => { const C0 = D.CONT || {}; for (const k in CHANCE) if (C0[k] && C0[k] === C) return CHANCE[k]; return 0.012; };
  // 训练场不出护甲，也不多掷一次（不然训练场容器里的东西就变了）
  let noArmor = false;
  const nc0 = K.newContainer;
  if (nc0) K.newContainer = function (S) { const was = noArmor; noArmor = !!(S && (S.tut || (S.raid && S.raid.tut))); try { return nc0.apply(this, arguments); } finally { noArmor = was; } };
  if (D.Growth && D.Growth.rollGear) {
    const rg0 = D.Growth.rollGear;
    D.Growth.rollGear = function (rng, q, C) { if (!noArmor && rng.chance(A.chanceOf(C))) return { id: A.roll(rng, q), n: 1 }; return rg0.apply(this, arguments); };
  }
  const DROP = { raider: [0.2, 2, 4], gunner: [0.25, 2, 4], engineer: [0.35, 3, 5] };
  const kx0 = K.onKillX;
  K.onKillX = function (S, e) {
    const r = kx0 ? kx0.apply(this, arguments) : undefined;
    if (!S.tut && e && K.scatter) {
      const E = D.ENEMIES[e.kind] || {}, d = E.boss ? [0.6, 4, 6] : DROP[e.kind];
      if (d && S.rng.chance(d[0])) K.scatter(S, e.x, e.y, e.f == null ? S.f : e.f, A.roll(S.rng, S.rng.int(d[1], d[2]) - 1), 1);
    }
    return r;
  };

  // ── HUD：血条下沿的蓝条（先护甲、再护盾），冲刺条右边是护甲的级数和耐久
  D.drawShieldBar = function (ctx, S, x, y, w) {
    const p = S.player, a = A.worn(S.raid), aw = a && a.dur > 0 ? Math.min(w, Math.round(w * a.dur / p.maxHp)) : 0;
    if (aw) { ctx.fillStyle = BLUE; ctx.fillRect(x, y + 8, aw, 3); ctx.fillStyle = '#c8daff'; ctx.fillRect(x, y + 8, aw, 1); }
    if (p.shield > 0) { const sw = Math.min(w - aw, Math.round(w * p.shield / p.maxHp)); if (sw > 0) { ctx.fillStyle = P.c; ctx.fillRect(x + aw, y + 8, sw, 3); } }
    if (a) {
      const col = a.dur > 0 ? BLUE : BROKEN, ix = x + 48, iy = y + 15;
      ctx.fillStyle = P.k; ctx.fillRect(ix - 1, iy - 1, 9, 10);
      ctx.fillStyle = col; ctx.fillRect(ix, iy, 7, 8); ctx.fillStyle = P.k; ctx.fillRect(ix + 2, iy, 3, 2); ctx.fillStyle = a.dur > 0 ? '#c8daff' : '#8a8fa6'; ctx.fillRect(ix + 2, iy + 3, 3, 3);
      D.text(ctx, a.lv + (a.dur > 0 ? ' ' + a.dur + '/' + a.max : ' X'), ix + 11, iy + 1, col);
    }
  };

  // ── 据点配装页：护甲槽（右键脱下、修），单击仓库里的护甲穿上
  const U = D.UI;
  if (U) {
    const gs0 = U.gearSlotsHTML, bg0 = U.bindGearSlots, gc0 = U.gearClick;
    const X = () => U._, esc = s => X().esc(s); let uiRoot = null;
    if (U._ && U._.hooks) U._.hooks.init.push(r => { uiRoot = r; });
    U.gearSlotsHTML = function (pf) {
      const html = gs0 ? gs0.apply(this, arguments) : '', id = pf.load.armor, it = id && D.itemInfo(id), cost = id ? A.fixCost(id) : 0;
      const slot = `<div class="gslot ar-slot${it ? ' q' + it.q : ' empty'}" data-armor="1" ${it ? X().tipAttr(id, 1, '右键脱下') : `data-tip="${esc('护甲：空。单击仓库里的护甲穿上（对局里捡）')}"`}><span>甲</span>${it ? `<img src="${X().infoIcon(it)}">` : ''}</div>`;
      const info = it ? `<span class="ar-info${it.dur <= 0 ? ' broken' : ''}">${it.lv} 级 ${it.dur}/${it.max}</span>${cost ? `<button class="btn sm ar-fix" data-arfix="1" data-tip="${esc('修满耐久：' + cost + ' 元')}">修 ${cost}</button>` : ''}` : '<span class="ar-info dim">没穿</span>';
      return html + `<div class="sl-group gear ar-group"><h4>护甲</h4><div class="gslots">${slot}${info}</div></div>`;
    };
    U.bindGearSlots = function (pf) {
      const r = bg0 ? bg0.apply(this, arguments) : undefined, root = uiRoot || document;
      const sl = root.querySelector('[data-armor]');
      if (sl) sl.oncontextmenu = ev => { ev.preventDefault(); const cur = pf.load.armor; if (!cur) return; if (D.Grid.add(pf.stash, cur, 1)) { U.toast('仓库满了'); D.Sfx.play('nope'); return; } pf.load.armor = null; D.Sfx.play('click'); U.refresh(); };
      const fx = root.querySelector('[data-arfix]');
      if (fx) fx.onclick = () => { const c = A.fixCost(pf.load.armor); if (!c) return; if (pf.money < c) { U.toast('钱不够'); D.Sfx.play('nope'); return; } pf.money -= c; const a = A.parse(pf.load.armor); pf.load.armor = A.id(a.lv, a.max); D.Sfx.play('power'); U.toast('护甲修好了'); U.refresh(); };
      return r;
    };
    U.gearClick = function (pf, e) {
      if (!A.is(e.id)) return gc0 ? gc0.apply(this, arguments) : false;
      const old = pf.load.armor; D.Grid.remove(pf.stash, e);
      if (old && D.Grid.add(pf.stash, old, 1)) { D.Grid.add(pf.stash, e.id, 1); pf.load.armor = old; U.toast('仓库满了，换不下来'); D.Sfx.play('nope'); return true; }
      pf.load.armor = e.id; D.Sfx.play('power'); U.toast('穿上了' + D.itemInfo(e.id).name); return true;
    };
  }
})(D);
