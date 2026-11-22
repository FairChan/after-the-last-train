/* Underdog · 武器训练室（据点"菜单"里"武器训练室"进）
   一间小靶场：能拿到、切换游戏里所有的枪和近战（D.CARDS 里 slot 为 gun / melee 的全部，含 melee.js、content.js、arsenal-*.js 的），
   摆着几个打不死的木头人：挨打照常冒伤害数字、闪白、晃一下、掉血条；血打空就回满（不死、不掉东西）。
   用一份临时档案进站（和新手教学一样 R.tut = true）：不碰存档、不算成就和局内统计、没有驻军、不涨警戒、子弹管够、工壳不掉耐久。
   Tab 武器架（全部武器）· 1 / 2 上一把 / 下一把枪 · 3 / 4 上一把 / 下一把近战 · Esc 退出回据点。
   只靠挂钩接进别的模块：D.makeStation、D.stepStation、K.enemyStep、K.hurt、D.drawFoe、D.drawStation、U.hubMenu、U.bag、U.pause、U.stationUpdate、G.finish。
   木头人和武器架按项目美术规矩用 sprite.js 的画板画（体积着色、色阶、自动描黑边）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, K = D.K, U = D.UI, G = D.Game, RA = D.RAMP;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const BIG = 1e6; // 木头人挨打时临时加的血：伤害照常算、照常冒数字，但永远打不到 0

  const ST = D.DRILL_STATION = { id: 'drill', type: 'ruin', name: '武器训练室', tier: 0, exit: null, lines: ['L1'], adj: new Set() };
  // 全部武器：按品质排，同品质按登记顺序
  const all = slot => Object.keys(D.CARDS).map((k, i) => [k, i]).filter(([k]) => D.CARDS[k].slot === slot).sort((a, b) => (D.CARDS[a[0]].q || 0) - (D.CARDS[b[0]].q || 0) || a[1] - b[1]).map(([k]) => k);
  const Drill = D.Drill = { guns: () => all('gun'), melees: () => all('melee') };

  // ── 场地：一间 32×13 格的靶场。木头人：近处一个、中间一组三个挨着（测范围、连锁）、右墙根一个（测钉墙、撞墙）、远处一个
  const POSTS = [[11, 9], [19, 8.4], [20.6, 10], [19, 11.6], [32.4, 7], [30, 13.5]];
  D.drillHall = function (rng) {
    const L = D.LV, F = L.newFloor(36, 18, '武器训练室', 'depot');
    F.loose = []; F.layout = 'standard'; F.line = null;
    L.addRoom(F, 2, 3, 32, 13, 'hall', { name: '武器训练室' });
    const busy = new Set(), solid = (tx, ty, wide) => { for (let a = 0; a < wide; a++) { F.solid[L.idx(F, tx + a, ty)] = 1; busy.add((tx + a) + ',' + ty); } };
    const put = (k, tx, ty, wide) => { solid(tx, ty, wide); F.props.push(D.makeProp(k, tx, ty, F.th, rng)); };
    // 上墙一排：武器架两个、长椅、柜子、柱子；下墙几个箱子
    for (const tx of [4, 8]) { solid(tx, 3, 4); F.props.push(rackProp(tx, 3)); }
    put('bench', 13, 3, 2); put('pillar', 17, 3, 1); put('cabinet', 22, 3, 1); put('cabinet', 23, 3, 1); put('pillar', 27, 3, 1); put('vending', 31, 3, 1);
    put('crate', 3, 15, 1); put('crate', 4, 15, 1); put('barrel', 25, 15, 1); put('bin', 33, 15, 1);
    // 灯：上墙一排暖灯；武器架上一盏青灯（架子本身的灯条也进发光层）
    for (let x = 5; x < 34; x += 5) F.lights.push({ x: x * TS + 8, y: 3 * TS - 4, oy: 40, r: 110, col: F.th.lamp, a: 0.85, flick: 0.04, seed: rng() * 100, shaft: true });
    for (const tx of [4, 8]) F.lights.push({ x: (tx + 2) * TS, y: 3 * TS + 6, r: 60, col: '#3ee8ff', a: 0.55, flick: 0.05, seed: rng() * 100 });
    L.bake(F, rng);
    return F;
  };
  // 武器架（墙上挂四把枪、底下一条青灯）
  function rackProp(tx, ty) {
    const w = 124, h = 44, spr = D.mkSprite(w, h, p => {
      p.box(2, 2, w - 4, h - 8, RA.crate, { r: 2, v: 0.5 });
      p.box(5, 5, w - 10, h - 16, RA.dark, { v: 0.55 });
      for (let i = 0; i < 4; i++) {
        const x0 = 10 + i * 28, ramp = [RA.gunmetal, RA.olive, RA.steel, RA.copper][i];
        p.box(x0, 10, 22, 5, ramp, { r: 1 }); p.box(x0 + 13, 15, 4, 8, RA.gunmetal, { r: 1 }); p.box(x0 + 3, 15, 6, 4, RA.crate, { r: 1 }); p.rect(x0 + 22, 11, 3, 2, '#2d3342');
        p.rect(x0 + 10, 7, 3, 3, '#646e86'); // 挂钩
      }
      p.grad(6, h - 9, w - 12, 2, RA.glass, 1); // 灯条
      p.box(0, h - 6, w, 6, RA.gunmetal, { r: 1 });
    });
    return { kind: 'drillrack', x: tx * TS + w / Z / 2, y: ty * TS + TS, w: w / Z, h: h / Z, img: spr.img, emit: spr.emit, light: null };
  }
  // 木头人：草绳扎的麻布身子、胸口一个靶心、横木当胳膊、插在铁底座上
  let dummySpr = null;
  const dummyArt = () => dummySpr || (dummySpr = D.mkSprite(26, 38, p => {
    p.box(5, 33, 16, 4, RA.gunmetal, { r: 1 }); p.box(8, 31, 10, 3, RA.gunmetal, { r: 1, bias: 0.1 }); // 底座
    p.box(11, 18, 4, 14, RA.crate, { r: 1 }); // 立柱
    p.box(1, 12, 24, 3, RA.crate, { r: 1 }); // 横木
    for (const x of [0, 24]) { p.line(x, 11, x + (x ? 1 : -1), 9, RA.yellow[4]); p.line(x, 15, x + (x ? 1 : -1), 17, RA.yellow[3]); } // 两头冒出来的稻草
    p.ell(13, 18, 7, 9, RA.cloth, { bias: 0.12 }); // 麻布身子
    for (let y = 11; y < 27; y += 3) { p.px(7, y, RA.cloth[1]); p.px(19, y + 1, RA.cloth[1]); } // 缝线
    p.rect(7, 22, 13, 1, RA.yellow[2]); // 腰上的草绳
    p.ell(13, 17, 4.5, 4.5, RA.red, { spec: true }); p.ell(13, 17, 3, 3, RA.white, { flat: true, bias: 0.15 }); p.disc(13, 17, 1.4, RA.red[3]); // 靶心
    p.ell(13, 6, 5, 5, RA.cloth, { spec: true, bias: 0.15 }); // 脑袋
    p.rect(10, 5, 2, 1, RA.cloth[1]); p.rect(15, 5, 2, 1, RA.cloth[1]); p.rect(11, 8, 5, 1, RA.cloth[1]); // 画上去的脸
    p.rect(10, 11, 7, 1, RA.yellow[2]); // 脖子上的草绳
  }));

  // 建站：只换训练室（站点 id 'drill'，建站参数 tut：不刷驻军、不放东西、不加电梯和装饰层）
  const ms0 = D.makeStation;
  D.makeStation = function (rng, st, opt) {
    if (opt && opt.tut && st && st.id === 'drill' && D.LV) { const F = D.drillHall(rng); return [F, F]; } // enterStation 默认站在第 1 层：先给两层同一个，进站后剪成一层
    return ms0.apply(this, arguments);
  };

  // ── 进出
  G.drill = function () {
    U.closeModal();
    const tp = D.newProfile('DRILL'), R = D.startRaid(tp, tp.city.home);
    R.tut = true; R.drill = true; R.alert = 0; // tut：成就、主线、委托、小剧情屋、护甲损耗都不算；训练不按线路给开场警戒
    R.bag = D.Grid.make(14, 10); R.mag = 0; R.magSeg = [];
    G.raid = R;
    const S = D.enterStation(R, ST, 0, { tut: true });
    S.floors = [S.floors[0]]; S.fxs = [S.fxs[0]]; S.f = 0; S.A = S.floors[0]; S.floor = S.fxs[0].c; S.fx = S.fxs[0].x;
    S.drill = { dummies: [], hit: null, sum: 0, n: 0, streak: null, ammoT: 0 }; S.safe = true; S.dropTold = 1; S.sched = null; S.intro = null; S.hideP = false;
    const p = S.player; p.x = 6 * TS + 8; p.y = 9 * TS + 8; p.aim = 0; p.inv = 0.5;
    for (const [tx, ty] of POSTS) spawnDummy(S, tx * TS + 8, ty * TS + 8);
    topUp(S); D.loadAllMags(R); p.mag = R.mag; // 两个槽的枪都装满（wslots.js）
    if (K.resetMotes) K.resetMotes(S);
    S.cam.x = 0; S.cam.y = D.clamp(p.y + 10 - 90, -4, Math.max(0, S.A.h - 180 + 20));
    S.banner = { t: 0, text: '武器训练室', sub: 'Tab 武器架 · 1 2 换枪 · 3 4 换近战 · Esc 退出', keep: true };
    G.S = S; G.mode = 'station'; D.UI.station(S); if (G.paused) G.resume();
    return S;
  };
  G.endDrill = function () { U.closeModal(); G.raid = null; G.S = null; if (G.pf) G.toHub('home'); else G.toTitle(); }; // 从据点菜单进的：退出回据点
  const fin0 = G.finish;
  G.finish = function (ok) { if (G.raid && G.raid.drill) return G.endDrill(); return fin0.apply(this, arguments); };
  // 换武器：旧的直接收回架子上（不进背包、不掉地上）
  Drill.equip = function (S, k, slot) {
    const R = S.raid, c = D.CARDS[k]; slot = slot || (c && c.slot); if (!c || (c.slot !== 'gun' && c.slot !== 'melee') || !D.isWeaponSlot(slot) || R.load[slot] === k) return false;
    D.equipCard(S, k, () => {}, slot); // slot：装到哪只手（左键主武器 / 右键副武器，刀枪都能装）
    if (c.gun) { topUp(S); D.loadMag(R, Math.max(0, D.gunOf(R.pf, k, R).mag - R.mag)); S.player.mag = R.mag; }
    S.ground.length = 0; return true;
  };
  Drill.cycle = function (S, slot, d) { const L = all(slot), i = L.indexOf(S.raid.load[slot]); return Drill.equip(S, L[(i + d + L.length) % L.length]); };

  // ── 木头人：借一只爬虫的身子（击退、冻结、中毒、钉墙都照常吃），自己不动、不出招，被打飞了慢慢回原位
  function spawnDummy(S, x, y) {
    const e = K.spawnEnemy(S, 'crawler', x, y, 0, 0, true);
    Object.assign(e, { drill: true, post: { x, y }, maxHp: 400, hp: 400, r: 7, noLoot: true, aware: true, notice: 1, intent: null, spawnT: 0.35, wob: 0, downs: 0 });
    S.drill.dummies.push(e); return e;
  }
  const es0 = K.enemyStep;
  K.enemyStep = function (S, e, dt) {
    if (!e.drill) return es0.apply(this, arguments);
    e.t += dt; e.flash -= dt; e.spawnT -= dt; for (const k in e.hitCd) e.hitCd[k] -= dt;
    D.move(S.A, e, e.vx * dt, e.vy * dt); e.vx *= Math.pow(0.0015, dt); e.vy *= Math.pow(0.0015, dt);
    if (e.stun > 0) e.stun -= dt;
    const h = e.post, held = e.pinT > 0 || e.frozenT > 0 || e.bind > 0;
    if (h && !held && e.vx * e.vx + e.vy * e.vy < 900) { const k = Math.min(1, dt * 2.5); D.move(S.A, e, (h.x - e.x) * k, (h.y - e.y) * k); }
    e.wob *= Math.pow(0.02, dt); e.tele = 0; e.act = null; e.intent = null; e.cd = 9;
  };
  const h0 = K.hurt;
  K.hurt = function (S, e, dmg, o) {
    if (!e || !e.drill || e.dead || e._in) return h0.apply(this, arguments);
    e._in = true; e.hp += BIG; const before = e.hp + (e.shield || 0);
    try { h0.apply(this, arguments); } finally { e._in = false; e.hp -= BIG; }
    const got = Math.max(0, before - BIG - e.hp - (e.shield || 0)), T = S.drill;
    if (got > 0 && T) {
      T.hit = { dmg: got, t: S.t }; T.sum += got; T.n++;
      const s = T.streak; if (!s || S.t - s.t1 > 2) T.streak = { t0: S.t, t1: S.t, sum: got }; else { s.t1 = S.t; s.sum += got; }
      e.wob = D.clamp((e.wob || 0) + 0.12 + Math.min(0.3, got / 60), 0, 0.5) * ((o && o.kx) < 0 ? -1 : 1);
    }
    if (e.hp <= 0) { // 打空：回满。毒死放毒雾照样放（测中毒的传染）
      if (e.psn > 0) (S.gas = S.gas || []).push({ x: e.x, y: e.y, f: e.f, r: 30, t: 3, max: 3, tick: 0 });
      e.hp = e.maxHp; e.downs++; e.flash = 0.25;
      K.text(S, e.x, e.y - 34, 'RESET', '#8dff6a', true); K.ring(S, e.x, e.y - 8, 18, '#8dff6a'); sfx('power');
    }
  };

  // ── 每帧：快捷键、工壳不掉血、不涨警戒、子弹管够、地上不留东西、木头人缺了就补
  function topUp(S) {
    const R = S.raid, cals = D.loadGuns(R.load).map(k => D.CARDS[k].gun.cal); if (!cals.length) return; // 两只手都可能拿枪：两种子弹都补
    for (const e of R.bag.items.slice()) if (e.id.startsWith('ammo:') && !cals.includes(e.id.split(':')[1])) D.Grid.remove(R.bag, e);
    for (const cal of new Set(cals)) { const have = D.ammoTiers(R, cal) || {};
    for (let t = 1; t <= 4; t++) if ((have[t] || 0) < 80) D.Grid.add(R.bag, 'ammo:' + cal + ':' + t, 160 - (have[t] || 0)); }
  }
  const ss0 = D.stepStation;
  D.stepStation = function (S, dt, inp) {
    if (!S.drill) return ss0.apply(this, arguments);
    const I = D.Input, T = S.drill;
    if (I && !S.lootOpen) { if (I.hit('Digit1')) Drill.cycle(S, 'gun', -1); if (I.hit('Digit2')) Drill.cycle(S, 'gun', 1); if (I.hit('Digit3')) Drill.cycle(S, 'melee', -1); if (I.hit('Digit4')) Drill.cycle(S, 'melee', 1); if (I.hit('KeyH')) { Drill.open = !Drill.open; sfx('tink'); } }
    const r = ss0.apply(this, arguments);
    const p = S.player; p.hp = p.maxHp; S.raid.hp = p.maxHp; S.raid.alert = 0; S.over = null;
    T.ammoT -= dt; if (T.ammoT <= 0) { T.ammoT = 0.5; topUp(S); }
    if (S.ground.length) S.ground.length = 0; if (S.drops.length) S.drops.length = 0;
    T.dummies = T.dummies.map(e => e.dead || !S.enemies.includes(e) ? spawnDummy(S, e.post.x, e.post.y) : e).filter((e, i, a) => a.indexOf(e) === i);
    if (T.dummies.length > POSTS.length) T.dummies.length = POSTS.length;
    S.events = S.events.filter(ev => ev.type !== 'dead' && ev.type !== 'leave' && ev.type !== 'extracted');
    return r;
  };

  // ── 画：木头人自己画（挨打时绕脚底晃一下）
  const df0 = D.drawFoe;
  D.drawFoe = function (ctx, ex, S, e, white, LT, H) {
    if (!e.drill) return df0 ? df0.apply(this, arguments) : false;
    const x = e.x, y = e.y, a = (e.wob || 0) * Math.sin(e.t * 26);
    for (const g of [ctx, ex]) { g.save(); g.translate(x, y); g.rotate(a); g.translate(-x, -y); }
    H.actor(ctx, ex, dummyArt(), x, y + 2, false, white);
    for (const g of [ctx, ex]) g.restore();
    return true;
  };

  // ── 界面：据点菜单多一项、左上的说明和伤害统计、Tab 武器架、Esc 菜单
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style'); s.id = 'drill-css';
    s.textContent = `
  .drillhud { position: absolute; left: 10px; top: 43px; max-width: 200px; background: rgba(8,9,18,.78); padding: 2px 5px; box-shadow: 0 0 0 1px var(--ink), 0 0 0 2px #3ee8ff40; font: 10px var(--f10); line-height: 1.35; color: var(--paper); pointer-events: none; }
  .drillhud .dh-h { color: var(--dim); opacity: .75; }
  .modal.hubmenu .mcol { gap: 3px; } .modal.hubmenu .mcol .btn { padding-top: 4px; padding-bottom: 4px; } /* 据点菜单多了一项：挤一挤，"返回"不用滚 */
  .drillhud b { color: var(--amber); font-weight: 400; } .drillhud .dh-k { color: var(--dim); } .drillhud .dh-n { color: var(--gold); }
  .drillp .mbox { width: 600px; max-width: 600px; max-height: 330px; }
  .drillp .dr-tabs { display: flex; gap: 4px; align-items: center; } .drillp .dr-tabs .dim { margin-left: auto; color: var(--dim); font: 12px var(--f); }
  .drillp .dr-tabs .btn.on { box-shadow: 0 0 0 1px var(--ink), 0 0 0 2px var(--amber); color: var(--cream); }
  .drillp .dr-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; overflow-y: auto; max-height: 252px; padding: 2px; }
  .drillp .dr-it { all: unset; display: flex; align-items: center; gap: 4px; min-width: 0; padding: 2px 4px; cursor: pointer; background: rgba(255,255,255,.04); box-shadow: inset 0 0 0 1px #2d3342; font: 12px var(--f); color: var(--paper); }
  .drillp .dr-it:hover { background: rgba(62,232,255,.12); } .drillp .dr-it.on { box-shadow: inset 0 0 0 1px var(--amber); background: rgba(62,232,255,.16); }
  .drillp .dr-it img { width: 34px; height: 17px; flex: none; object-fit: contain; image-rendering: pixelated; }
  .drillp .dr-it span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`;
    document.head.appendChild(s);
  }
  // 入口在据点"菜单"里（新手教学、据点导览旁边），开始页不放
  const hm0 = U.hubMenu;
  U.hubMenu = function () {
    const r = hm0.apply(this, arguments); style();
    const at = document.querySelector('#ui .modal.hubmenu [data-act=tour]') || document.querySelector('#ui .modal.hubmenu [data-act=tut]');
    if (at && !document.querySelector('#ui .modal.hubmenu [data-act=drill]')) {
      const b = document.createElement('button'); b.className = 'btn'; b.dataset.act = 'drill'; b.textContent = '武器训练室';
      b.setAttribute('data-tip', '一间靶场：所有的枪和近战随便换，打不死的木头人随便打。不碰存档'); // 走 setAttribute，英文版当场就翻（dataset 要等观察器）
      b.onclick = () => { sfx('pick'); G.drill(); };
      at.after(b);
    }
    return r;
  };
  const st0 = U.station;
  U.station = function (S) {
    const r = st0.apply(this, arguments);
    if (S && S.drill) { style(); const root = document.getElementById('ui'), el = document.createElement('div'); el.className = 'drillhud'; root.appendChild(el); S.drill.el = el; S.drill.key = ''; const rb = root.querySelector('.raidbar'); if (rb) rb.style.display = 'none'; } // 顶上的背包价值 / 警戒 / 零件：训练室用不着
    return r;
  };
  const up0 = U.stationUpdate;
  U.stationUpdate = function (S) {
    const r = up0.apply(this, arguments), T = S && S.drill; if (!T || !T.el) return r;
    const R = S.raid, gun = D.CARDS[R.load.gun], mel = D.CARDS[R.load.melee], s = T.streak, live = s && S.t - s.t1 < 2;
    const dps = s ? Math.round(s.sum / Math.max(0.5, (live ? S.t : s.t1) - s.t0)) : 0, last = T.hit ? Math.round(T.hit.dmg) : 0;
    // 默认收起：两把武器 + 伤害一行；H 展开按键说明（标题右上小地图和进场横幅已经有了，不再重复）
    const open = !!Drill.open, key = [R.load.gun, R.load.melee, last, dps, Math.round(T.sum), open, D.I18N && D.I18N.lang].join('|');
    if (key !== T.key) {
      T.key = key;
      T.el.innerHTML = `<div><span style="color:${D.QUALITY[gun.q].col}">${esc(gun.name)}</span> <span class="dh-k">/</span> <span style="color:${D.QUALITY[mel.q].col}">${esc(mel.name)}</span></div>
        <div><span class="dh-k">上一下</span> <span class="dh-n">${last}</span> · <span class="dh-k">每秒</span> <span class="dh-n">${dps}</span> · <span class="dh-k">总计</span> <span class="dh-n">${Math.round(T.sum)}</span></div>
        ${open ? '<div class="dh-k">Tab 武器架 · 1 2 换枪 · 3 4 换近战 · Esc 退出</div><div class="dh-h">H 收起</div>' : '<div class="dh-h">H 按键说明</div>'}`;
    }
    return r;
  };
  // Tab：武器架（全部武器，点一下就换上）
  Drill.panel = function (S, tab) {
    style(); const R = S.raid; tab = tab || Drill.tab || 'gun'; Drill.tab = tab;
    const L = all(tab), art = k => U._ && U._.artURL ? U._.artURL(D.CARDS[k].art) : '';
    const el = U.modal('drillp', `<div class="dr-tabs"><h3>武器架</h3><button class="btn sm${tab === 'gun' ? ' on' : ''}" data-tab="gun">枪 ${all('gun').length}</button><button class="btn sm${tab === 'melee' ? ' on' : ''}" data-tab="melee">近战 ${all('melee').length}</button><span class="dim">点一下换上 · 右键装到另一只手 · Tab 关掉</span></div>
      <div class="dr-grid">${L.map(k => { const c = D.CARDS[k]; return `<button class="dr-it${R.load[tab] === k ? ' on' : ''}" data-k="${k}" data-tip="${esc(c.name + '：' + (c.desc || ''))}"><img src="${art(k)}" alt=""><span style="color:${D.QUALITY[c.q].col}">${esc(c.name)}</span></button>`; }).join('')}</div>`);
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { sfx('click'); Drill.panel(S, b.dataset.tab); });
    el.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { if (Drill.equip(S, b.dataset.k)) { el.querySelectorAll('.dr-it.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); } else sfx('nope'); };
      b.oncontextmenu = ev => { ev.preventDefault(); const c = D.CARDS[b.dataset.k]; if (Drill.equip(S, b.dataset.k, c.slot === 'gun' ? 'melee' : 'gun')) { sfx('click'); Drill.panel(S, tab); } else sfx('nope'); }; }); // 右键：装到另一只手
    return el;
  };
  const bag0 = U.bag;
  U.bag = function (R, S) {
    if (!(S && S.drill)) return bag0.apply(this, arguments);
    if (document.querySelector('#ui .modal.drillp')) { U.closeModal(); return; }
    Drill.panel(S);
  };
  const pz0 = U.pause;
  U.pause = function (on) {
    if (!(on && G.raid && G.raid.drill)) return pz0.apply(this, arguments);
    const el = U.modal('pausem', `<h3>武器训练室</h3>
      <div class="mcol"><button class="btn primary" data-act="resume">继续（Esc）</button><button class="btn" data-act="settings">设置</button><button class="btn danger" data-act="quit">退出训练室</button></div>
      <div class="hint">训练室用的是临时档案：不存档、不掉东西、不算进统计。</div>`, true);
    el.querySelector('[data-act=resume]').onclick = () => G.resume();
    el.querySelector('[data-act=settings]').onclick = () => { sfx('click'); U.settings(); };
    el.querySelector('[data-act=quit]').onclick = () => { sfx('click'); G.endDrill(); };
  };
})(D);
