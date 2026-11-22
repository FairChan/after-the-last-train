/* 末班之后 · 小样：主循环与流程
   标题 → 地图 → 站点（战斗/集市/维修/旧物）→ 地图 … → 首领 → 结束
   测试钩子：?manual=1 时时间只由 advanceTime 推进；render_game_to_text 输出状态；?seed=&auto=fight 直接进第一场战斗。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const W = D.W, H = D.H, qs = new URLSearchParams(location.search), manual = qs.get('manual') === '1';
  let canvas, ctx, stage, acc = 0, last = 0, time = 0, titleF = null, hover = null, cardQueue = [];

  const G = D.Game = {
    mode: 'title', run: null, fight: null, node: null, reward: null, shop: null,
    defaultSeed() { return 'L3-' + Math.floor((Date.now() / 1000) % 100000).toString(36).toUpperCase(); },
    startRun(seed) { G.run = D.newRun(seed); G.run.visited = new Set(); G.toMap(); },
    toMap() { G.mode = 'map'; D.UI.map(G.run); },
    enter(node) {
      const run = G.run; run.pos = node.k; run.visited.add(node.k); run.floor = node.f; G.node = node;
      D.Sfx.play('click');
      if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss') G.startFight(D.encounterFor(run, node), D.themeFor(node));
      else if (node.type === 'shop') { G.shop = makeShop(run); G.mode = 'shop'; D.UI.shop(run, G.shop); }
      else if (node.type === 'rest') { G.mode = 'rest'; D.UI.rest(run); }
      else if (node.type === 'treasure') { G.treasure = D.randomRelic(run); G.mode = 'treasure'; D.UI.treasure(run, G.treasure); }
    },
    startFight(enc, theme) {
      G.fight = D.newFight(G.run, enc, theme, G.run.seed + ':' + (G.node ? G.node.k : 'x'));
      G.mode = 'fight'; cardQueue = []; D.UI.fight(G.fight);
    },
    endFight() {
      const F = G.fight, run = G.run;
      run.hp = Math.max(0, Math.ceil(F.player.hp)); run.stats.fights++; run.stats.kills += F.kills; run.stats.taken = (run.stats.taken || 0) + Math.round(F.taken || 0);
      if (F.over === 'lose') { G.mode = 'over'; D.UI.over(run, false); return; }
      if (F.kind === 'boss') { G.mode = 'over'; D.UI.over(run, true); return; }
      const elite = F.kind === 'elite';
      const base = elite ? run.rng.int(30, 40) : run.rng.int(12, 20);
      const gold = Math.round(base * (run.relics.magnet ? 1.3 : 1)) + Math.round(F.gold);
      run.gold += gold;
      const relic = elite ? D.randomRelic(run) : null; if (relic) D.gainRelic(run, relic);
      G.reward = { gold, relic, elite, cards: D.rewardCards(run, elite) };
      G.mode = 'reward'; D.UI.reward(run, G.reward);
    },
    takeReward(i) { if (i >= 0) { G.run.deck.push(G.reward.cards[i]); G.run.stats.cards++; } G.toMap(); },
    queueCard(i) { cardQueue.push(i); },
    shopBuy(i) {
      const o = G.shop.cards[i]; if (!o || o.sold) return;
      if (G.run.gold < o.price) { D.Sfx.play('nope'); D.UI.toast('零件不够'); return; }
      G.run.gold -= o.price; o.sold = true; G.run.deck.push(o.card); D.Sfx.play('pick'); D.UI.shop(G.run, G.shop);
    },
    shopRelic() {
      const o = G.shop.relic; if (!o || o.sold) return;
      if (G.run.gold < o.price) { D.Sfx.play('nope'); D.UI.toast('零件不够'); return; }
      G.run.gold -= o.price; o.sold = true; D.gainRelic(G.run, o.k); D.Sfx.play('pick'); D.UI.shop(G.run, G.shop);
    },
    shopRemove() { if (G.run.gold < G.shop.removePrice) { D.Sfx.play('nope'); D.UI.toast('零件不够'); return; } D.UI.deck(G.run, 'remove'); },
    shopRemoveCard(i) { G.run.gold -= G.shop.removePrice; G.shop.removed = true; G.run.deck.splice(i, 1); D.Sfx.play('pick'); D.UI.shop(G.run, G.shop); },
    restHeal() { const r = G.run; r.hp = Math.min(r.maxHp, r.hp + Math.round(r.maxHp * 0.3)); D.Sfx.play('heal'); G.toMap(); },
    restUpgrade(i) { const r = G.run, c = r.deck[i]; r.deck[i] = D.card(c.id, true); D.Sfx.play('power'); G.toMap(); },
    takeTreasure() { if (G.treasure) { D.gainRelic(G.run, G.treasure); D.Sfx.play('pick'); } G.toMap(); },
  };
  function makeShop(run) {
    const r = run.rng, cards = [];
    const pool = Object.keys(D.CARDS).filter(k => D.CARDS[k].rar < 9);
    for (let i = 0; i < 5; i++) { const id = r.pick(pool), rar = D.CARDS[id].rar; cards.push({ card: D.card(id), price: [45, 70, 110][rar] + r.int(-6, 6) }); }
    const rk = D.randomRelic(run);
    return { cards, relic: rk ? { k: rk, price: 130 + r.int(-10, 15) } : null, removePrice: 60, removed: false };
  }

  // ── 输入 → 战斗指令
  function fightInput() {
    const I = D.Input, k = I.keys;
    const mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), my = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    const card = [];
    for (let i = 0; i < 6; i++) card[i] = I.hit('Digit' + (i + 1)) || I.hit('Numpad' + (i + 1));
    for (const q of cardQueue) card[q] = true;
    cardQueue = [];
    return { mx, my, card, dash: I.hit('Space') || I.hit('ShiftLeft') || I.rclick, fire: I.mdown };
  }

  function step(dt) {
    time += dt;
    const I = D.Input;
    if (G.mode === 'fight') {
      const F = G.fight;
      const before = F.log.length;
      D.stepFight(F, dt, fightInput());
      for (const ev of F.log.splice(0)) if (ev.type === 'nope') D.UI.flashCard(ev.i);
      if (F.over === 'win' && F.endT > 1.1) G.endFight();
      else if (F.over === 'lose' && F.endT > 1.8) G.endFight();
    } else if (G.mode === 'title' && titleF) {
      titleF.t += dt; for (const m of titleF.motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.y < 0) m.y = titleF.A.h; }
    } else if (G.mode === 'map') {
      const n = D.mapHit(G.run, I.mx, I.my);
      const reach = new Set(D.reachable(G.run).map(x => x.k));
      const nh = n && reach.has(n.k) ? n.k : null;
      if (nh !== hover) { hover = nh; D.UI.mapHover(G.run, nh ? G.run.map.nodes[nh] : null); }
      if (I.mclick && hover) { const node = G.run.map.nodes[hover]; hover = null; G.enter(node); }
    }
    I.endFrame();
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    canvas.style.cursor = G.mode === 'fight' ? 'none' : G.mode === 'map' && hover ? 'pointer' : 'default';
    if (G.mode === 'fight') { D.drawFight(ctx, G.fight, time); D.UI.fightUpdate(G.fight); }
    else if (G.mode === 'map') D.drawMap(ctx, G.run, time, hover);
    else {
      if (!titleF) { titleF = D.newFight({ hp: 1, maxHp: 1, relics: {}, deck: [], gold: 0 }, { kind: 'title', list: [] }, 'platform', 'title'); titleF.noHud = true; titleF.player.aim = -0.3; titleF.player.x = 150; titleF.player.y = 150; }
      titleF.cam.x = 8; titleF.cam.y = 20;
      D.drawFight(ctx, titleF, time);
      ctx.fillStyle = 'rgba(8,6,16,0.55)'; ctx.fillRect(0, 0, W, H);
    }
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000 || 0)); last = ts;
    if (!manual) { acc += dt; let n = 0; while (acc >= D.DT && n < 6) { step(D.DT); acc -= D.DT; n++; } if (n === 6) acc = 0; }
    draw();
  }
  function resize() {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
    stage.style.width = W * s + 'px'; stage.style.height = H * s + 'px'; stage.style.setProperty('--s', s); stage.style.setProperty('--px', s * W / 384); // --s 画布倍数，--px 界面单位
  }

  function boot() {
    canvas = document.getElementById('game'); stage = document.getElementById('stage');
    canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    D.Post.init(); D.initArt(); D.Input.attach(canvas);
    D.onFirstGesture = () => D.Sfx.init();
    D.UI.init(document.getElementById('ui'), G);
    addEventListener('keydown', e => {
      if (e.code === 'KeyM') D.Sfx.muted = !D.Sfx.muted;
      if (e.code === 'Tab' && G.run && G.mode !== 'fight' && G.mode !== 'title') { e.preventDefault(); D.UI.deck(G.run, false); }
    });
    resize(); addEventListener('resize', resize);
    D.UI.title();
    const auto = qs.get('auto');
    if (auto) {
      G.startRun(qs.get('seed') || 'DEMO');
      if (auto === 'fight' || auto === 'elite' || auto === 'boss') {
        const node = auto === 'boss' ? G.run.map.nodes.boss : Object.values(G.run.map.nodes).find(n => n.f === (auto === 'elite' ? 2 : 0));
        if (auto === 'elite') node.type = 'elite';
        G.run.pos = node.k; G.run.visited.add(node.k); G.node = node;
        G.startFight(D.encounterFor(G.run, node), D.themeFor(node));
      }
    }
    requestAnimationFrame(frame);
  }

  window.advanceTime = function (ms) { const n = Math.max(1, Math.round(ms / (1000 * D.DT))); for (let i = 0; i < n; i++) step(D.DT); draw(); };
  window.render_game_to_text = function () {
    return JSON.stringify({ mode: G.mode, run: G.run ? { hp: G.run.hp, gold: G.run.gold, deck: G.run.deck.length, pos: G.run.pos, relics: Object.keys(G.run.relics) } : null, fight: G.mode === 'fight' ? D.fightText(G.fight) : null });
  };
  window.__game = G;
  window.__tick = n => { for (let i = 0; i < n; i++) step(D.DT); }; // 测试用：只推进规则，不画
  window.__enter = (t, f) => { const n = t === 'boss' ? G.run.map.nodes.boss : Object.values(G.run.map.nodes).find(n => n.f === (f || 2)); if (t !== 'boss') n.type = t; G.enter(n); }; // 测试用：直接进某类站点
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(D);
