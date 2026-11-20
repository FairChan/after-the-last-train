/* 末班之后 · 小样：一局（地图、站点、牌组、改装件）
   地图画成地铁线路图：从左到右 7 站加终点的首领，每条线一种颜色，共用的区间并排走。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, W = D.W, H = D.H;
  const FLOORS = 7, ROWS = 4;
  const LINE_COL = ['#ff3047', '#3ee8ff', '#ffb057', '#8dff6a'];
  D.NODE_NAME = { fight: '遭遇', elite: '精英', shop: '地下集市', rest: '维修点', treasure: '旧物', boss: '首领' };

  D.newRun = function (seed) {
    const rng = D.rng('run:' + seed);
    const run = { seed, rng, hp: D.PLAYER.hp, maxHp: D.PLAYER.hp, gold: 60, deck: D.START_DECK.map(id => D.card(id)), relics: { recycler: true }, pos: null, floor: -1, stats: { kills: 0, fights: 0, cards: 0 } };
    run.map = genMap(rng);
    return run;
  };

  function genMap(rng) {
    const nodes = {}, edges = {}, names = rng.shuffle(D.STATION_NAMES.slice());
    const key = (f, r) => f + ':' + r;
    let ni = 0;
    const node = (f, r) => nodes[key(f, r)] || (nodes[key(f, r)] = { f, r, k: key(f, r), type: null, next: new Set(), lines: new Set(), name: names[ni++ % names.length] });
    const starts = rng.shuffle([0, 1, 2, 3]);
    for (let li = 0; li < 4; li++) {
      let r = starts[li];
      for (let f = 0; f < FLOORS; f++) {
        const n = node(f, r); n.lines.add(li);
        if (f === FLOORS - 1) break;
        let nr = D.clamp(r + rng.int(-1, 1), 0, ROWS - 1);
        // 不让两条线在同一区间交叉
        for (let tries = 0; tries < 4; tries++) {
          let cross = false;
          for (const e of Object.values(edges)) if (e.f === f && ((e.r0 < r && e.r1 > nr) || (e.r0 > r && e.r1 < nr))) cross = true;
          if (!cross) break; nr = r;
        }
        const ek = f + ':' + r + '>' + nr;
        if (!edges[ek]) edges[ek] = { f, r0: r, r1: nr, lines: [] };
        edges[ek].lines.push(li);
        n.next.add(key(f + 1, nr));
        r = nr;
      }
    }
    const boss = { f: FLOORS, r: 1.5, k: 'boss', type: 'boss', next: new Set(), lines: new Set([0, 1, 2, 3]), name: '调度场' };
    nodes.boss = boss;
    for (const n of Object.values(nodes)) if (n.f === FLOORS - 1) { n.next.add('boss'); for (const li of n.lines) { const ek = n.f + ':' + n.r + '>B'; if (!edges[ek]) edges[ek] = { f: n.f, r0: n.r, r1: 1.5, lines: [], boss: true }; edges[ek].lines.push(li); } }
    // 站点类型
    for (const n of Object.values(nodes)) {
      if (n.type) continue;
      if (n.f === 0) n.type = 'fight';
      else if (n.f === 3) n.type = 'treasure';
      else if (n.f === FLOORS - 1) n.type = 'rest';
      else n.type = rng.weighted([['fight', 50], ['elite', n.f >= 2 ? 16 : 0], ['shop', 14], ['rest', n.f >= 2 ? 12 : 0]]);
    }
    // 保证至少一个精英和一个集市
    const mids = Object.values(nodes).filter(n => n.f >= 2 && n.f <= 5 && n.f !== 3);
    if (!mids.some(n => n.type === 'elite')) rng.pick(mids).type = 'elite';
    if (!Object.values(nodes).some(n => n.type === 'shop')) rng.pick(mids.filter(n => n.type === 'fight') .concat(mids)).type = 'shop';
    const map = { nodes, edges: Object.values(edges), FLOORS, ROWS };
    for (const n of Object.values(nodes)) { const p = nodePos(map, n); n.x = p.x; n.y = p.y; }
    return map;
  }
  function nodePos(map, n) { return { x: 22 + n.f * 37 + (n.type === 'boss' ? 6 : 0), y: 50 + n.r * 28 }; }

  D.reachable = function (run) {
    const m = run.map;
    if (!run.pos) return Object.values(m.nodes).filter(n => n.f === 0);
    return [...m.nodes[run.pos].next].map(k => m.nodes[k]);
  };

  // 遭遇
  D.encounterFor = function (run, node) {
    const r = run.rng;
    if (node.type === 'boss') return { kind: 'boss', list: D.ENCOUNTERS.boss[0] };
    if (node.type === 'elite') return { kind: 'elite', list: r.pick(D.ENCOUNTERS.elite) };
    return { kind: 'fight', list: r.pick(node.f < 2 ? D.ENCOUNTERS.easy : D.ENCOUNTERS.mid) };
  };
  D.themeFor = node => node.type === 'boss' ? 'depot' : ['platform', 'mall', 'depot'][(node.f + (node.r | 0)) % 3];

  // 奖励牌：按稀有度抽 3 张不重复
  D.rewardCards = function (run, elite) {
    const r = run.rng, pool = Object.keys(D.CARDS).filter(k => D.CARDS[k].rar < 9), out = [];
    while (out.length < 3) {
      const rar = r.weighted([[0, elite ? 45 : 60], [1, elite ? 38 : 32], [2, elite ? 17 : 8]]);
      const opts = pool.filter(k => D.CARDS[k].rar === rar && !out.includes(k));
      if (opts.length) out.push(r.pick(opts));
    }
    return out.map(id => D.card(id, r.chance(elite ? 0.25 : 0.08)));
  };
  D.randomRelic = function (run) {
    const opts = Object.keys(D.RELICS).filter(k => !run.relics[k]);
    return opts.length ? run.rng.pick(opts) : null;
  };
  D.gainRelic = function (run, k) {
    run.relics[k] = true;
    if (k === 'plating') { run.maxHp += 10; run.hp += 10; }
  };

  // ── 地图画面
  D.drawMap = function (ctx, run, time, hover) {
    const m = run.map, ex = D.Post.ex;
    ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, W, H);
    // 底纹：城市街区格
    ctx.fillStyle = '#141428';
    for (let x = 0; x < W; x += 12) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 12) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = '#10101f';
    const br = D.rng(7); for (let i = 0; i < 50; i++) ctx.fillRect(br.int(0, 26) * 12 + 2, br.int(0, 14) * 12 + 2, 9, 9);
    // 河
    ctx.fillStyle = '#121c33'; for (let x = 0; x < W; x++) ctx.fillRect(x, Math.round(160 + Math.sin(x / 30) * 5), 1, 30);
    const reach = new Set(D.reachable(run).map(n => n.k));
    const visited = run.visited || new Set();
    // 线路
    for (const e of m.edges) {
      const a = m.nodes[e.f + ':' + e.r0], b = e.boss ? m.nodes.boss : m.nodes[(e.f + 1) + ':' + e.r1];
      e.lines.forEach((li, i) => {
        const off = (i - (e.lines.length - 1) / 2) * 3;
        const used = visited.has(a.k) && (visited.has(b.k) || run.pos === b.k);
        const lit = run.pos === a.k || (!run.pos && a.f === 0);
        metro(ctx, a.x, a.y + off, b.x, b.y + off, LINE_COL[li], used ? 1 : lit ? 0.9 : 0.45, used || lit ? ex : null);
      });
    }
    // 站点
    for (const n of Object.values(m.nodes)) {
      const can = reach.has(n.k), done = visited.has(n.k), here = run.pos === n.k, hov = hover === n.k;
      const big = n.type === 'boss';
      const r = big ? 7 : n.lines.size > 1 ? 4 : 3;
      ctx.fillStyle = P.k; disc(ctx, n.x, n.y, r + 2);
      ctx.fillStyle = done ? '#5a5f78' : '#f2f4ff'; disc(ctx, n.x, n.y, r + 1);
      ctx.fillStyle = done ? '#2a2d40' : big ? P.r : '#1a1b2c'; disc(ctx, n.x, n.y, r - 1);
      if (can) {
        const pulse = (Math.sin(time * 5) + 1) / 2;
        ex.fillStyle = D.rgba(P.Y, 0.3 + 0.4 * pulse); ring(ex, n.x, n.y, r + 3 + Math.round(pulse * 2));
        D.Post.addLight(n.x, n.y, 34, '#ffd28a', 0.35 + pulse * 0.2);
      }
      if (hov && can) { ex.fillStyle = P.Y; ring(ex, n.x, n.y, r + 6); }
      const ic = D.ICON['node_' + n.type];
      const iy = n.y - r - 15 + (can ? Math.round(Math.sin(time * 4 + n.x) * 1) : 0);
      ctx.globalAlpha = done ? 0.35 : can ? 1 : 0.7;
      if (big) { ctx.drawImage(ic, n.x - 13, iy - 13, 26, 26); }
      else ctx.drawImage(ic, n.x - 6, iy);
      ctx.globalAlpha = 1;
      ex.globalAlpha = 0.4; if (can && !done) ex.drawImage(ic, big ? n.x - 13 : n.x - 6, big ? iy - 13 : iy, big ? 26 : 13, big ? 26 : 13); ex.globalAlpha = 1;
      if (big) D.Post.addLight(n.x, n.y, 70, P.r, 0.6 + 0.2 * Math.sin(time * 3));
    }
    // 玩家位置
    const at = run.pos ? m.nodes[run.pos] : null;
    const px = at ? at.x : 8, py = at ? at.y : 50 + 1.5 * 28;
    D.blit(ctx, D.SPR.head, px, py + 4 + Math.round(Math.sin(time * 3)), false); D.blit(ex, D.SPR.head, px, py + 4 + Math.round(Math.sin(time * 3)), false, 'emit');
    D.Post.addLight(px, py, 50, P.o, 0.7);
    D.Post.render(ctx, '#4a4a70');
  };
  D.mapHit = function (run, x, y) {
    let best = null, bd = 12;
    for (const n of Object.values(run.map.nodes)) { const d = Math.hypot(n.x - x, n.y - y + 6); if (d < bd) { bd = d; best = n; } }
    return best;
  };

  function disc(ctx, cx, cy, r) { for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(r * r - j * j + r * 0.5)); ctx.fillRect(cx - w, cy + j, w * 2 + 1, 1); } }
  function ring(ctx, cx, cy, r) { for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1); } }
  // 线路：水平 → 45° 斜线 → 水平
  function metro(ctx, x0, y0, x1, y1, col, a, ex) {
    const dy = y1 - y0, dx = x1 - x0, diag = Math.min(Math.abs(dy), dx), flat = (dx - diag) / 2;
    const pts = [[x0, y0], [x0 + flat, y0], [x0 + flat + diag, y0 + Math.sign(dy) * diag], [x1, y1]];
    const draw = (c, w, alpha, color) => { c.globalAlpha = alpha; c.fillStyle = color; for (let i = 0; i < 3; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) | 0 || 1; for (let k = 0; k <= n; k++) c.fillRect(Math.round(ax + (bx - ax) * k / n) - (w >> 1), Math.round(ay + (by - ay) * k / n) - (w >> 1), w, w); } c.globalAlpha = 1; };
    draw(ctx, 4, 1, P.k); draw(ctx, 2, a, col);
    if (ex) draw(ex, 2, 0.5, col);
  }
})(D);
