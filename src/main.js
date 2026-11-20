/* 末班之后 · 小样二：主循环与流程
   标题 → 据点（出发/配装/仓库/商店）→ 选入口 → 线路图选下一站 ⇄ 站内（搜、打、出站）→ 撤离站打撤离战 → 结算 → 据点
   测试钩子：?manual=1 时时间只由 advanceTime 推进；__tick(n) 只推进规则不画；render_game_to_text 输出状态。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const W = D.W, H = D.H, qs = new URLSearchParams(location.search), manual = qs.get('manual') === '1';
  let canvas, ctx, stage, acc = 0, last = 0, time = 0, titleS = null;
  let drag = null, paused = false;

  const G = D.Game = {
    mode: 'title', pf: null, raid: null, S: null, view: { x: 0, y: 0, z: 1.6 }, sel: null, hover: null, tab: 'map', slotSel: 'gun', out: null,
    slot: null, // 当前存档位（null = 不存，测试和自动玩家用）
    newGame(seed, slot) { G.slot = slot == null ? null : slot; G.pf = D.newProfile(seed); G.sel = G.pf.city.home; G.toHub('home'); },
    loadGame(pf, slot) {
      G.slot = slot; G.pf = pf; G.sel = pf.city.home; const note = pf.note; G.toHub('home'); // 点"继续"一律进首页（以前上一趟没撤就关掉的存档会直接弹仓库）
      if (note === 'raid') D.UI.toast('上次在城里关掉了游戏，那一趟按工壳损毁结算');
    },
    save() { return G.slot != null && G.pf ? D.Save.write(G.slot, G.pf) : Promise.resolve(false); },
    toTitle() { G.mode = 'title'; G.raid = null; G.S = null; paused = false; D.UI.title(); },
    resume() { paused = false; D.UI.pause(false); },
    abandon() { paused = false; D.UI.closeModal(); G.finish(false); },
    toHub(tab) { G.mode = 'hub'; G.codexSel = G.codexSel || 'crawler'; G.tab = tab || 'home'; G.raid = null; G.S = null; focus(G.pf.city.stations[G.sel != null ? G.sel : G.pf.city.home], 46); D.UI.hub(G.pf, G.tab); G.save(); G.saveT = 10; if (!G.pf.tut && G.slot != null && !G.tutAsked) { G.tutAsked = true; D.UI.tutOffer(); } },
    hubTab(t) { G.tab = t; D.UI.hub(G.pf, t); },
    // 出发准备页：整体看一遍型号、装备、背包和入口，确认了再进城
    brief(id) { G.mode = 'brief'; G.briefAt = id; G.sel = id; focus(G.pf.city.stations[id], -60, 2.4); D.UI.brief(G.pf, id); },
    depart(id, diff) { G.raid = D.startRaid(G.pf, id, diff); D.Save.checkpointRaid(G.slot, G.raid); G.toTravel(); },
    // 出发页的"确认出发"：直接进选好的出发站。据点旁边的站 = 从南栈走一站过去；解锁过的线路尽头 = 就从这一站开始
    departTo(id, diff) {
      const C = G.pf.city; if (id === C.home) return G.depart(id, diff);
      const viaHome = !C.entries.has(id);
      G.raid = D.startRaid(G.pf, viaHome ? C.home : id, diff);
      if (viaHome) D.travel(G.raid, id); else G.raid.stations++;
      D.Save.checkpointRaid(G.slot, G.raid); D.Sfx.play('pick'); G.enter();
    },
    toTravel() { G.mode = 'travel'; G.S = null; G.hover = null; focus(G.raid.city.stations[G.raid.at], 46); D.UI.travel(G.raid, null); },
    travelTo(id) { D.Sfx.play('pick'); D.travel(G.raid, id); G.enter(); },
    enter(o) {
      const R = G.raid, st = R.city.stations[R.at];
      G.S = D.enterStation(R, st, R.step, Object.assign({ revisit: !!R.revisit }, o)); G.mode = 'station'; paused = false; D.UI.station(G.S);
    },
    // 新手教学：用一份临时档案（默认配装）进训练场，不碰你的背包；带出来的东西放进仓库
    tutorial() {
      D.UI.closeModal(); if (D.Tour && D.Tour.cur) D.Tour.end(false);
      const tp = D.newProfile(G.pf.seed); tp.load.q = 'barrier'; tp.load.e = 'arc'; // 训练长厅要教模块、手雷、换弹种、换枪开镜（design/features/tutorial）
      const R = D.startRaid(tp, tp.city.home); R.tut = true; R.alert = 0;
      for (const [id, n] of [['use:frag', 3], ['use:freeze', 1], ['use:emp', 1], ['use:cell', 1], ['use:medkit', 1], ['ammo:nail:2', 30]]) D.Grid.add(R.bag, id, n);
      G.raid = R; G.S = D.enterTutorial(R); G.mode = 'station'; paused = false; D.UI.station(G.S);
    },
    endTutorial(ok) {
      const pf = G.pf, R = G.raid; pf.tut = 1; let n = 0;
      const freeCard = id => id.startsWith('card:'); // 训练场的枪（钉枪、教换枪用的狙击枪）是借的，不进仓库
      if (ok) for (const e of R.bag.items) { if (e.id.startsWith('ammo:') || e.id.startsWith('use:') || freeCard(e.id)) continue; if (D.Grid.add(pf.stash, e.id, e.n) < e.n) n++; }
      if (ok) for (const e of R.safe.items) { if (e.id.startsWith('ammo:') || e.id.startsWith('use:') || freeCard(e.id)) continue; if (D.Grid.add(pf.stash, e.id, e.n) < e.n) n++; } // 训练场的保险箱是临时档案的：放进去的也归你
      paused = false; D.UI.closeModal(); G.toHub('home'); D.UI.toast(ok ? '教学完成' + (n ? '：带出来的 ' + n + ' 样东西放进了仓库' : '') : '跳过了教学');
      if (ok && D.Tour && !pf.tour) D.Tour.after(); // 撤出来了：认一遍据点（tut-tour.js）
    },
    finish(ok) { if (G.raid && G.raid.tut) return G.endTutorial(ok); const R = G.raid; R.hp = G.S ? G.S.player.hp : R.hp; G.out = D.finishRaid(R, ok); G.mode = 'result'; D.UI.result(G.out, R); G.save(); },
    // 卖：格子里的一整组
    sellEntry(grid, e) { const pf = G.pf; if (!e) return; pf.money += D.stackPrice(pf, e); D.Grid.remove(grid, e); D.Sfx.play('sell'); D.UI.refresh(); },
    sellJunk() { const pf = G.pf; let n = 0; const junk = D.Growth ? new Set(D.Growth.junk(pf)) : null; for (const e of pf.stash.items.slice()) { const it = D.itemInfo(e.id); if (junk ? junk.has(e) : it.kind === 'item' && it.q <= 1) { pf.money += D.stackPrice(pf, e); D.Grid.remove(pf.stash, e); n++; } } D.Sfx.play(n ? 'sell' : 'nope'); D.UI.refresh(); },
    // times：一次买几份（交易行上方的 ×1 / ×5 / ×10）；钱或仓库不够时买到哪算哪
    buy(id, n, price, times) {
      const pf = G.pf; if (pf.money < price) { D.Sfx.play('nope'); D.UI.toast('零件不够'); return; }
      if (id === 'intel') { pf.money -= price; const got = D.buyIntel(pf.city, 6); D.UI.toast('揭开了 ' + got.length + ' 个站'); D.Sfx.play('buy'); D.UI.refresh(); return; }
      if (!D.Grid.canAdd(pf.stash, id, n)) { D.Sfx.play('nope'); D.UI.toast('仓库放不下'); return; }
      const want = Math.max(1, times || 1); let k = 0;
      while (k < want && pf.money >= price && D.Grid.canAdd(pf.stash, id, n)) { pf.money -= price; D.Grid.add(pf.stash, id, n); k++; }
      if (want > 1) D.UI.toast(k < want ? `买了 ${k} 份（${pf.money < price ? '零件不够了' : '仓库满了'}）` : `买了 ${k} 份`);
      D.Sfx.play('buy'); D.UI.refresh();
    },
  };
  // 让地图把某个站放到可见区域中间（右侧面板大约占 92 像素）
  // 地图视野：z 是缩放；clampView 让地图不跑出屏幕太远
  // 地图大小看现在那座城（第 4 版的城比老城大，见 city.js）
  const curCity = () => (G.mode === 'travel' && G.raid ? G.raid.city : G.pf && G.pf.city) || null;
  function clampView() { const z = G.view.z, vw = W / z, vh = H / z, C = curCity(), mw = D.cityW ? D.cityW(C) : D.MAP.w, mh = D.cityH ? D.cityH(C) : D.MAP.h; G.view.x = D.clamp(G.view.x, -40, Math.max(-40, mw - vw + 240 / z)); G.view.y = D.clamp(G.view.y, -40, Math.max(-40, mh - vh + 40)); }
  G.focusOn = s => focus(s, 0);
  function focus(s, right, zoom) {
    const v = G.view, z = zoom || v.z, goal = { z, x: s.x - (W - (right || 0) * 2) / 2 / z, y: s.y - H / 2 / z };
    if (!G.started) { G.started = true; Object.assign(v, goal); clampView(); return; }
    G.viewGoal = goal;
  }
  function tweenView(dt) {
    const g = G.viewGoal; if (!g) return;
    const v = G.view, k = 1 - Math.exp(-dt * 6);
    v.x += (g.x - v.x) * k; v.y += (g.y - v.y) * k; v.z += (g.z - v.z) * k;
    if (Math.abs(g.x - v.x) < 0.3 && Math.abs(g.y - v.y) < 0.3 && Math.abs(g.z - v.z) < 0.005) { Object.assign(v, g); G.viewGoal = null; }
    clampView();
  }
  D.zoomMap = function (dz, mx, my) { const v = G.view, z0 = v.z, z1 = D.clamp(z0 * (dz > 0 ? 0.85 : 1.18), (D.cityW ? D.cityW(curCity()) : 600) > 600 ? 0.6 : 0.9, 3.2); /* 大城能缩得更小，看得到全城 */ const wx = mx / z0 + v.x, wy = my / z0 + v.y; v.z = z1; v.x = wx - mx / z1; v.y = wy - my / z1; clampView(); };

  function stationInput() {
    const I = D.Input, k = I.keys;
    return {
      mx: (k[D.key('right')] || k.ArrowRight ? 1 : 0) - (k[D.key('left')] || k.ArrowLeft ? 1 : 0), my: (k[D.key('down')] || k.ArrowDown ? 1 : 0) - (k[D.key('up')] || k.ArrowUp ? 1 : 0),
      fire: I.mdown, melee: I.rclick, meleeHeld: !!I.rdown, dash: I.hit(D.key('dash')) || (D.key('dash') === 'Space' && I.hit('ShiftLeft')), q: I.hit(D.key('q')), e: I.hit(D.key('e')), reload: I.hit(D.key('reload')), heal: I.hit(D.key('heal')), shieldUse: I.hit(D.key('shieldUse')), charge: I.hit(D.key('charge')), ammo: I.hit(D.key('ammo')),
      healHeld: !!k[D.key('heal')], shieldUseHeld: !!k[D.key('shieldUse')], nadeHeld: !!k[D.key('nade')], // 快捷栏：按住 + 滚轮换种类
      interact: I.hit(D.key('interact')), interactHeld: !!k[D.key('interact')], pick: I.hit(D.key('pick')), skill: I.hit(D.key('skill')), nade: I.hit(D.key('nade')), nadeCycle: I.wheel || 0, wheel: I.wheel || 0,
    };
  }
  function mapInput(C, opts) {
    const I = D.Input, k = I.keys, sp = 160 * D.DT;
    G.view.x += ((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)) * sp / G.view.z; G.view.y += ((k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0)) * sp / G.view.z;
    if (I.mclick) { drag = { x: I.mx, y: I.my, vx: G.view.x, vy: G.view.y, moved: false }; G.viewGoal = null; }
    if (drag && I.mdown) { const dx = I.mx - drag.x, dy = I.my - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true; if (drag.moved) { G.view.x = drag.vx - dx / G.view.z; G.view.y = drag.vy - dy / G.view.z; } }
    clampView();
    const s = D.cityHit(C, G.view, I.mx, I.my), hv = s ? s.id : null;
    const click = drag && !I.mdown && !drag.moved; if (drag && !I.mdown) drag = null;
    return { hv, click };
  }

  function step(dt) {
    time += dt;
    if (D.Music) D.Music.update(G, dt); // M6：按场景换配乐
    if (D.Pad) D.Pad.poll(G, dt); // M7：手柄
    if (D.Ach) D.Ach.tick(G, dt); // M7：成就
    if (G.mode === 'station' && D.gameSpeed) dt *= D.gameSpeed(); // M7：游戏速度（只影响站里）
    if (G.mode === 'hub' || G.mode === 'brief') { G.saveT = (G.saveT || 10) - dt; if (G.saveT <= 0) { G.saveT = 10; G.save(); } }
    const I = D.Input;
    if (G.mode === 'station' && !paused) {
      const S = G.S, inp = stationInput();
      if (S.talk) { // 对话中：人站着不动（event.js）；按 Esc 或者走远了就结束
        if (I.hit('Escape') || !D.talkNear(S)) { D.talkClose(S); D.UI.closePanel(S); }
        I.pressed.Escape = false; inp.mx = 0; inp.my = 0; inp.interact = false; inp.interactHeld = false; inp.pick = false; inp.fire = false; inp.melee = false; inp.meleeHeld = false; inp.dash = false; inp.reload = false; inp.heal = false; inp.skill = false; inp.nade = false; inp.q = false; inp.e = false;
      }
      if (S.lootOpen && (inp.interact || I.hit('Escape'))) { D.UI.closePanel(S); inp.interact = false; inp.interactHeld = false; I.pressed.Escape = false; }
      if (I.hit(D.key('bag'))) { if (S.lootOpen && S.lootOpen.bag) D.UI.closePanel(S); else D.UI.bag(S.raid, S); }
      if (I.hit('Escape')) { paused = true; D.UI.pause(true); I.endFrame(); return; }
      if (S.lootOpen && S.lootOpen.items && Math.hypot(S.lootOpen.x - S.player.x, S.lootOpen.y - S.player.y) > 34) D.UI.closePanel(S);
      if (S.lootOpen) { inp.interactHeld = false; }
      if (G.net && G.net.stepStation) G.net.stepStation(S, dt, inp); else D.stepStation(S, dt, inp); // 联机（net/session.js）：房主一步走全队 / 队友发输入、收快照
      for (const ev of S.events.splice(0)) {
        if (ev.type === 'loot') D.UI.loot(S, ev.c);
        else if (ev.type === 'reveal') D.UI.lootReveal(S, ev.c);
        else if (ev.type === 'closeLoot') { if (S.lootOpen && S.lootOpen.items) D.UI.closePanel(S); }
        else if (ev.type === 'trade') D.UI.trade(S);
        else if (ev.type === 'talk') D.UI.talkRender(S); // 未知信号站：对话面板（ui-metro.js）
        else if (ev.type === 'outpost') D.Outpost.open(S, ev.id); // 人类据点里的人（ui-outpost.js）
        else if (ev.type === 'leave') { S.raid.hp = S.player.hp; S.raid.kills += S.kills; G.toTravel(); D.Save.checkpointRaid(G.slot, G.raid); break; }
        else if (ev.type === 'dead') { G.finish(false); break; }
        else if (ev.type === 'extracted') { S.raid.kills += S.kills; G.finish(true); break; }
      }
    } else if (G.mode === 'station' && paused) {
      if (I.hit('Escape')) G.resume();
      else if (G.net && G.net.stepStation) G.net.stepStation(G.S, dt, { mx: 0, my: 0 }); // 联机：菜单开着世界不停（站着不动，会挨打）
    } else if (G.mode === 'scene') { if (D.Scene) D.Scene.step(dt); // 剧情屋（scene.js）
    } else if (G.mode === 'brief') { tweenView(dt);
    } else if (G.mode === 'hub' && G.tab === 'map') { tweenView(dt);
      const { hv, click } = mapInput(G.pf.city);
      G.hover = hv;
      if (click && hv != null) { G.sel = hv; D.Sfx.play('click'); D.UI.hub(G.pf, 'map'); }
    } else if (G.mode === 'travel') {
      tweenView(dt);
      const R = G.raid, { hv, click } = mapInput(R.city);
      if (hv !== G.hover) { G.hover = hv; D.UI.travel(R, hv); }
      if (click && hv != null && D.canTravel(R, hv)) G.travelTo(hv);
    }
    I.endFrame();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    // 上一帧画到一半报错时留下的东西每帧清掉（以前：滤镜没复位画面一直暗、灯光表不清空越堆越亮闪白、发光层的混合方式卡住），一次出错最多坏一帧
    const PO = D.Post; if (PO && PO.ex) { PO.lights.length = 0; const ex = PO.ex; ex.setTransform(1, 0, 0, 1, 0, 0); ex.globalAlpha = 1; ex.globalCompositeOperation = 'source-over'; ex.filter = 'none'; ex.clearRect(0, 0, W, H); }
    canvas.style.cursor = G.mode === 'station' && !paused ? 'none' : 'default';
    if (G.mode === 'scene') { if (D.Scene) D.Scene.draw(ctx, time); } // 剧情屋（scene.js）
    else if (G.mode === 'station') { if (G.net && G.net.draw) G.net.draw(ctx, time); else D.drawStation(ctx, G.S, time); D.UI.stationUpdate(G.S); }
    else if (G.mode === 'travel' || (G.mode === 'hub' && G.tab !== 'home') || G.mode === 'brief') {
      // 线路图画在游戏画布上（像素风，map.js）
      if (G.mode === 'travel') { const R = G.raid; D.drawMap(ctx, R.city, G.view, time, { at: R.at, reach: D.reachable(R), hover: G.hover, visited: R.visited, marks: D.Story && D.Story.marks(R.pf), dim: 0 }); }
      else if (G.mode === 'hub') D.drawMap(ctx, G.pf.city, G.view, time, { choosing: true, hover: G.hover, sel: G.sel, marks: D.Story && D.Story.marks(G.pf), dim: G.tab !== 'map' ? 0.85 : 0 });
      else D.drawMap(ctx, G.pf.city, G.view, time, { choosing: true, sel: G.briefAt, noHeader: true, marks: D.Story && D.Story.marks(G.pf), dim: 0.55 });
    } else {
      // 开始页和据点首页：这座城市的午夜天际线（skyline.js）。有存档时用那座城的种子，楼群跟着城市变
      const home = G.mode === 'hub';
      D.drawSkyline(ctx, time, home && G.pf ? G.pf.seed : (D.titleSeed || 'LANCHUAN'));
      if (home) { const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(5,4,10,0.35)'); g.addColorStop(0.45, 'rgba(5,4,10,0.45)'); g.addColorStop(0.62, 'rgba(5,4,10,0.78)'); g.addColorStop(1, 'rgba(5,4,10,0.9)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); } // 首页：右边压暗，磁贴浮在上面
      else {const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(5,4,10,0.84)'); g.addColorStop(0.38, 'rgba(5,4,10,0.5)'); g.addColorStop(0.66, 'rgba(5,4,10,0.06)'); g.addColorStop(1, 'rgba(5,4,10,0.12)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    }
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000 || 0)); last = ts;
    if (!manual) { acc += dt; let n = 0; while (acc >= D.DT && n < 6) { step(D.DT); acc -= D.DT; n++; } if (n === 6) acc = 0; }
    draw();
  }
  function resize() {
    // 铺满窗口（保持 16:9）。以前只按整数倍放大，窗口小于 1280 宽时只有 640×360 那么一点
    // 像素化：舞台固定 640×360（界面也按这个排），整体放大。窗口够大时按整数倍放大最清楚（四周留黑边）；不到 2 倍或设置里选了铺满时按任意比例
    const raw = Math.min(innerWidth / W, innerHeight / H), s = D.settings && D.settings.fillWindow || raw < 2 ? raw : Math.floor(raw);
    stage.style.transform = 'scale(' + s + ')'; D.uiScale = s;
  }
  function boot() {
    canvas = document.getElementById('game'); stage = document.getElementById('stage');
    canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    // 像素字体（font-art.js）：画布和界面都用它
    if (window.FontFace) for (const [fam, src] of [['PixelZH', D.FONT_ART], ['PixelZH10', D.FONT_ART10]]) if (src) { const f = new FontFace(fam, 'url(' + src + ')'); f.load().then(() => { document.fonts.add(f); D.pixelFont = true; }).catch(() => {}); }
    D.Post.init(); D.initArt(); D.initHiArt(); D.Input.attach(canvas);
    D.Save.loadSettings();
    Object.defineProperty(G, 'paused', { get: () => paused });
    // 关网页前存一下（本地存储是同步写的，来得及）
    addEventListener('beforeunload', () => { if (G.mode === 'hub' || G.mode === 'brief') G.save(); });
    canvas.addEventListener('wheel', e => { if (G.mode === 'station') { e.preventDefault(); D.Input.wheel = e.deltaY > 0 ? 1 : -1; return; } if (G.mode !== 'hub' && G.mode !== 'travel') return; G.viewGoal = null; e.preventDefault(); const b = canvas.getBoundingClientRect(); D.zoomMap(e.deltaY, (e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height); }, { passive: false });
    addEventListener('keydown', e => { if (e.code === 'Tab') e.preventDefault(); if (e.code === 'KeyM') D.Sfx.toggleMute(); });
    D.onFirstGesture = () => D.Sfx.init();
    D.UI.init(document.getElementById('ui'), G);
    resize(); addEventListener('resize', resize); D.onResize = resize;
    D.UI.title();
    const auto = qs.get('auto');
    if (auto) {
      G.newGame(qs.get('seed') || 'LANCHUAN');
      if (auto !== 'hub') {
        const C = G.pf.city, home = C.stations[C.home];
        G.depart(home.id);
        const want = auto === 'exit' ? [...C.stations].find(s => s.exit === 'fixed') : C.stations[[...home.adj][0]];
        if (auto === 'exit') { G.raid.at = want.id; G.enter(); } else if (auto === 'station') G.travelTo(want.id);
        else if (D.STATION_TYPES[auto]) { const s = C.stations.find(x => !x.dead && x.type === auto && !x.exit); G.raid.at = s.id; G.raid.alert = +(qs.get('alert') || 2); G.enter(); } // 测试用：直接进某类站
      }
    }
    requestAnimationFrame(frame);
  }

  window.advanceTime = function (ms) { const n = Math.max(1, Math.round(ms / (1000 * D.DT))); for (let i = 0; i < n; i++) step(D.DT); draw(); };
  window.__tick = n => { for (let i = 0; i < n; i++) step(D.DT); };
  window.render_game_to_text = function () {
    const R = G.raid;
    return JSON.stringify({ mode: G.mode, money: G.pf && G.pf.money, stash: G.pf && G.pf.stash.items.length, raid: R ? { at: R.city.stations[R.at].name, step: R.step, alert: +R.alert.toFixed(2), bag: D.bagUsed(R) + '/' + D.bagCap(R), value: D.bagValue(R) } : null, station: G.mode === 'station' ? D.stationText(G.S) : null, story: G.pf && G.pf.story ? { clues: G.pf.story.clues.length, copy: G.pf.story.copy, ending: G.pf.story.ending } : null });
  };
  window.__game = G;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(D);
