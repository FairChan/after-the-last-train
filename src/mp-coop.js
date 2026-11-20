/* 末班之后 · 多人联机 MP4：合作玩法（design/features/multiplayer §3.3–3.6、§5.2）
   - 倒地：联机里耐久打空先倒地（只能慢慢爬、不能开枪、30 秒），倒地时再挨一下就倒下；队友站旁边按住 F 4 秒救起（救的人挨打会打断），
     救人的耐久两人平分（用户 2026-11-17："可以救活，但是需要平分血量"）；
     30 秒没人救、或者全队都倒了 → 倒下（这一趟损毁）。单人不变。
   - 递东西：背包 / 子弹袋里 Alt + 单击 = 递给 3 格内最近的队友，直接进他的背包（不经过地面；丢在地上的照旧谁都捡不回来）
   - 标记：鼠标中键在指的地方放一个标记（敌人 / 好东西 / 去这里），3 秒，全队看得见、有声音
   - 快捷语：Y 打开，1–6 说一句（撤！/ 等我 / 帮我 / 这里有货 / 没子弹了 / 好），冒在头顶。T 已经是"切换交互目标"，所以快捷语用 Y
   - 队友在屏幕外：边上画方向箭头；小地图上有队友点
   - 人数加压：D.MP_SCALE（敌人血量、数量、警戒涨速、撤离战波数、箱子品质）；箱子数量不变
   - 结算页多一栏"小队"：每人带出多少、击毁、救了几次、谁 MVP */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const MP = D.MP, NET = D.Net, K = D.K, TS = 16, G = () => D.Game;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const COL = ['#8fe8ff', '#ffd860', '#8dff6a', '#ff9ad0'];
  MP.COL = COL;
  // ── 人数加压（试玩后调）
  D.MP_SCALE = {
    1: { hp: 1, n: 1, alert: 1, wave: 1, q: 0 },
    2: { hp: 1.25, n: 1.4, alert: 1.2, wave: 1.3, q: 0.2 },
    3: { hp: 1.45, n: 1.75, alert: 1.35, wave: 1.55, q: 0.35 },
    4: { hp: 1.6, n: 2.0, alert: 1.5, wave: 1.8, q: 0.5 },
  };
  MP.scaleOf = S => D.MP_SCALE[Math.min(4, Math.max(1, (S.players || []).length))];
  MP.DOWN = { time: 30, revive: 4, reviveR: 22, crawl: 0.25 }; // 救起来：救人的耐久两人平分（用户 2026-11-17）
  MP.GIVE_R = 3 * TS;
  MP.SAY = ['撤！', '等我', '帮我', '这里有货', '没子弹了', '好'];

  // ── 进站加压（房主进站、队友都加进来以后）：敌人血更厚、更多；箱子品质往上提一点
  MP.scaleStation = function (S) {
    if (!MP.on(S) || S.mpScaled) return; S.mpScaled = true;
    const sc = MP.scaleOf(S), live = S.enemies.filter(e => !e.dead), rng = S.rng;
    for (const e of live) { e.hp = Math.round(e.hp * sc.hp); e.maxHp = Math.round(e.maxHp * sc.hp); }
    const extra = Math.round(live.length * (sc.n - 1));
    for (let i = 0; i < extra && live.length; i++) {
      const src = live[i % live.length], E = D.ENEMIES[src.kind]; if (!E || E.boss) continue;
      const e = K.spawnEnemy(S, src.kind, src.x + rng.range(-20, 20), src.y + rng.range(-12, 12), 0, src.f);
      if (e) { if (D.solidAt(S.floors[e.f || S.f], e.x, e.y)) { e.x = src.x; e.y = src.y; } e.hp = e.maxHp = Math.round(e.maxHp * sc.hp); e.home = src.home; }
    }
    if (sc.q > 0 && K.rollItem) for (const c of S.containers) {
      if (c.opened || !c.grid.items.length || !rng.chance(sc.q)) continue;
      const worst = c.grid.items.reduce((a, e) => (!a || D.itemInfo(e.id).v < D.itemInfo(a.id).v ? e : a), null);
      D.Grid.remove(c.grid, worst);
      const r = K.rollItem(S, rng, ((D.CONT[c.kind] || {}).bonus || 0) + 1, D.CONT[c.kind]);
      if (D.Grid.canAdd(c.grid, r.id, r.n)) D.Grid.add(c.grid, r.id, r.n); else D.Grid.add(c.grid, worst.id, worst.n);
      for (const e of c.grid.items) e.seen = false; c.grid.items.sort((a, b) => a.y - b.y || a.x - b.x); c.items = c.grid.items;
    }
  };
  if (NET.Host) { const H0 = NET.Host; NET.Host = function () { const H = H0.apply(this, arguments), b0 = H.begin; H.begin = function (S) { const r = b0.apply(this, arguments); MP.scaleStation(S); return r; }; return H; }; }

  // ── 倒地
  const dp0 = K.damagePlayer;
  K.damagePlayer = function (S, dmg, src) {
    if (!MP.on(S)) return dp0.apply(this, arguments);
    const p = S.player; if (p.out) return;
    if (p.down) { if (p.inv > 0 || S.over) return; p.hp = 0; p.down = false; return; } // 倒地时再挨一下：倒下（站里下一步算出局）
    const r = dp0.apply(this, arguments);
    if (p.hp <= 0 && !p.out) {
      if (S.players.filter(q => !q.out && !q.down && q !== p && q.hp > 0).length === 0) return r; // 没有能救你的队友了：直接倒下
      p.hp = 1; p.down = true; p.downT = MP.DOWN.time; p.revT = 0; p.inv = Math.max(p.inv, 1); p.reload = 0; p.useT = 0; p.charging = false;
      K.text(S, p.x, p.y - 28, '倒地', '#ff5a5a', true); S.banner = { t: 0, text: (p.name || '') + ' 倒地了', sub: '站到旁边按住 F 救起来，耐久两人平分（30 秒）' }; sfx('die');
    }
    return r;
  };
  // 每步（房主）：倒地的人只能爬；倒计时；救人；人数加压的警戒和撤离战
  const sa0 = MP.stepAll;
  MP.stepAll = function (S, dt, inps) {
    if (MP.on(S)) for (const p of S.players) if (p.down && inps[p.pid]) { const i = inps[p.pid]; inps[p.pid] = { mx: i.mx || 0, my: i.my || 0, ax: i.ax, ay: i.ay }; }
    const a0 = S.raid.alert;
    const r = sa0.apply(this, arguments);
    if (!MP.on(S) || S.over) return r;
    const sc = MP.scaleOf(S);
    if (S.raid.alert > a0) S.raid.alert += (S.raid.alert - a0) * (sc.alert - 1);
    if (S.extract && !S.extract.train) S.extract.next -= dt * (sc.wave - 1);
    for (const p of S.players) {
      if (!p.down || p.out) { if (p) { p.revBy = null; } continue; }
      p.hp = Math.max(1, Math.min(p.hp, 1)); p.downT -= dt;
      const by = p.revBy != null ? S.players[p.revBy] : null;
      if (by && !by.out && !by.down && S.t - (by.lastHurt || -9) > 0.15 && Math.hypot(by.x - p.x, by.y - p.y) < MP.DOWN.reviveR) {
        p.revT += dt;
        if (p.revT >= MP.DOWN.revive) { p.down = false; const give = Math.min(p.maxHp, Math.max(1, Math.floor(by.hp / 2))); p.hp = give; by.hp = Math.max(1, by.hp - give); p.inv = 1.5; p.revT = 0; by.saves = (by.saves || 0) + 1; K.text(S, p.x, p.y - 28, '救起来了', '#8dff6a', true); K.ring(S, p.x, p.y - 5, 20, '#8dff6a'); sfx('heal'); }
      } else p.revT = 0;
      p.revBy = null;
      if (p.down && p.downT <= 0) { p.down = false; p.hp = 0; }
    }
    // 倒下的队友：背包里的东西留成一具遗骸，队友能搜（D2；他自己这一趟照样按损毁结算）
    for (const p of S.players) if (p.out === 'dead' && !p.wrecked) { p.wrecked = true; MP.wreck(S, p); }
    // 全队都倒地了：都倒下
    const live = S.players.filter(q => !q.out);
    if (live.length && live.every(q => q.down)) for (const q of live) { q.down = false; q.hp = 0; }
    return r;
  };
  MP.wreck = function (S, p) {
    const R = MP.of(S, p, 'raid'); if (!R || !R.bag || !R.bag.items.length || S.players.every(q => q.out)) return null;
    const grid = D.Grid.make(R.bag.w, R.bag.h);
    for (const e of R.bag.items) grid.items.push({ id: e.id, n: e.n, x: e.x, y: e.y, r: e.r ? 1 : 0, seen: false });
    grid.items.sort((a, b) => a.y - b.y || a.x - b.x);
    const c = { kind: 'corpse', x: Math.round(p.x), y: Math.round(p.y + 4), f: S.f, grid, items: grid.items, opened: false, rt: 0, locked: false, room: -1, mpOf: p.pid };
    S.containers.push(c); S.banner = { t: 0, text: (p.name || '') + ' 倒下了', sub: '背包留在原地，队友能去搜' };
    return c;
  };
  // 倒地的人爬得慢（station.js 的移动乘 p.crawl）
  // 救人的 F：站在倒地的队友旁边
  const cx0 = K.candX;
  K.candX = function (S, add) {
    if (cx0) cx0(S, add);
    if (!MP.on(S)) return;
    const me = S.player; if (me.down || me.out) return;
    for (const q of S.players) if (q !== me && q.down && !q.out && Math.hypot(q.x - me.x, q.y - me.y) < MP.DOWN.reviveR)
      add({ ref: q, x: q.x, y: q.y, key: 'F', text: '按住 F 救起 ' + (q.name || '队友'), prog: (q.revT || 0) / MP.DOWN.revive, go: inp => { if (inp.interactHeld || inp.interact) q.revBy = me.pid; } });
  };

  // ── 递东西
  MP.giveTarget = function (S) { const me = S.player; let best = null, bd = MP.GIVE_R; for (const q of S.players) { if (q === me || q.out) continue; const d = Math.hypot(q.x - me.x, q.y - me.y); if (d < bd) { bd = d; best = q; } } return best; };
  MP.give = function (S, grid, e, pid) {
    if (!S || !grid || !e || !MP.on(S)) return false;
    const me = S.player, q = S.players[pid]; if (!q || q === me || q.out || Math.hypot(q.x - me.x, q.y - me.y) > MP.GIVE_R + 8) return false;
    if (S.shadow) { D.Grid.remove(grid, e); return true; } // 队友本机：先拿掉，房主那边算完再同步回来
    const R2 = MP.of(S, q, 'raid'); if (!R2) return false;
    const left = D.bagIn ? D.bagIn(R2, e.id, e.n) : D.Grid.add(R2.bag, e.id, e.n), gave = e.n - left;
    if (gave <= 0) { K.text(S, q.x, q.y - 26, 'FULL', '#ff5a5a'); return false; }
    if (left > 0) e.n = left; else D.Grid.remove(grid, e);
    const it = D.itemInfo(e.id); K.text(S, q.x, q.y - 24, it.name + (gave > 1 ? ' x' + gave : ''), D.QUALITY[it.q].col); K.ring(S, q.x, q.y - 4, 10, COL[me.pid % 4]);
    return true;
  };
  // 背包里 Alt + 单击
  if (typeof document !== 'undefined') document.addEventListener('pointerdown', ev => {
    if (!ev.altKey || ev.button !== 0) return;
    const g = G(), S = g && g.S; if (!S || !MP.on(S) || g.mode !== 'station') return;
    const el = ev.target && ev.target.closest && ev.target.closest('.gi[data-i]'); if (!el) return;
    const R = S.raid, grid = el.dataset.g === 'bag' ? R.bag : el.dataset.g === 'pouch' && D.pouchR ? D.pouchR(R) : null; if (!grid) return;
    const e = grid.items[+el.dataset.i]; if (!e) return;
    ev.preventDefault(); ev.stopPropagation();
    const q = MP.giveTarget(S); if (!q) { D.UI.toast('3 格内没有队友'); sfx('nope'); return; }
    if (MP.give(S, grid, e, q.pid)) { sfx('pick'); D.UI.toast('递给 ' + (q.name || '队友')); if (D.UI.refresh) D.UI.refresh(); } else sfx('nope');
  }, true);

  // ── 标记（中键）和快捷语（Y）
  const PING = { enemy: ['敌人', '#ff5a5a'], loot: ['好东西', '#ffd860'], go: ['去这里', '#8fe8ff'] };
  MP.ping = function (S, x, y) {
    if (!S || !MP.on(S)) return false;
    let kind = 'go';
    if (S.enemies.some(e => !e.dead && Math.hypot(e.x - x, e.y - 6 - y) < 18)) kind = 'enemy';
    else if (S.containers.some(c => c.f === S.f && Math.hypot(c.x - x, c.y - 4 - y) < 16) || S.ground.some(g => g.f === S.f && Math.hypot(g.x - x, g.y - y) < 12)) kind = 'loot';
    S.pings = (S.pings || []).filter(o => o.pid !== S.player.pid).concat([{ x: Math.round(x), y: Math.round(y), f: S.f, kind, pid: S.player.pid, t: 3 }]);
    sfx('tink'); return true;
  };
  MP.say = function (S, i) { if (!S || !MP.on(S) || !MP.SAY[i]) return false; S.player.say = { i, t: 3 }; sfx('click'); return true; };
  let pingReq = null, sayOpen = false;
  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', ev => { if (ev.button === 1) { const g = G(); if (g && g.mode === 'station' && g.S && MP.on(g.S)) { ev.preventDefault(); pingReq = true; } } });
    document.addEventListener('keydown', ev => {
      const g = G(), S = g && g.S; if (!S || g.mode !== 'station' || !MP.on(S) || (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName))) return;
      if (ev.code === 'KeyY') { sayOpen = !sayOpen; ev.preventDefault(); return; }
      if (sayOpen && /^Digit[1-6]$/.test(ev.code)) { MP.say(S, +ev.code.slice(5) - 1); sayOpen = false; ev.preventDefault(); ev.stopPropagation(); }
      if (sayOpen && ev.code === 'Escape') { sayOpen = false; ev.preventDefault(); ev.stopPropagation(); }
    }, true);
  }
  MP.sayOpen = () => sayOpen;
  // 标记、快捷语的计时（房主那一步里走；队友本机靠快照）
  const sa1 = MP.stepAll;
  MP.stepAll = function (S, dt, inps) {
    const r = sa1.apply(this, arguments);
    if (MP.on(S)) { S.pings = (S.pings || []).filter(o => (o.t -= dt) > 0); for (const p of S.players) if (p.say && (p.say.t -= dt) <= 0) p.say = null; }
    return r;
  };
  // 中键：本机这一步发出去（房主直接放，队友走 NET 的操作转发）
  const main = () => {
    const g = G(); if (!g || g.__mpCoop) return; g.__mpCoop = true;
    const I = D.Input, check = () => { const S = g.S; if (pingReq && S && MP.on(S)) { MP.ping(S, I.mx / D.Z + S.cam.x, I.my / D.Z + S.cam.y); } pingReq = null; };
    const ss = NET.hostSession, cs = NET.clientSession;
    NET.hostSession = function () { const s = ss.apply(this, arguments), st = s.stepStation; s.stepStation = function () { check(); return st.apply(this, arguments); }; return s; };
    NET.clientSession = function () { const s = cs.apply(this, arguments), st = s.stepStation; s.stepStation = function () { check(); return st.apply(this, arguments); }; return s; };
  };
  if (D.Game) main(); else (D._late || (D._late = [])).push(main);
  for (const n of ['MP.give', 'MP.ping', 'MP.say']) if (!NET.OPS.includes(n)) NET.OPS.push(n);
  NET.wrapOps();

  // ── 画：标记、头顶快捷语、倒地圈、屏幕外队友箭头、快捷语轮盘
  const ds0 = D.drawStation;
  D.drawStation = function (ctx, S, time) {
    const r = ds0.apply(this, arguments);
    if (!S || !MP.on(S)) return r;
    const Z = D.Z, cx = S.cam.x, cy = S.cam.y, W = D.W, H = D.H, me = S.player;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const sx = x => (x - cx) * Z, sy = y => (y - cy) * Z;
    // 标记
    for (const o of S.pings || []) {
      if (o.f !== S.f) continue;
      const [label, col] = PING[o.kind] || PING.go, x = D.clamp(sx(o.x), 14, W - 14), y = D.clamp(sy(o.y), 30, H - 20), a = Math.min(1, o.t * 2), b = Math.sin(time * 10) * 1.5;
      ctx.globalAlpha = a; ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.moveTo(x, y - 12 + b); ctx.lineTo(x + 7, y - 5 + b); ctx.lineTo(x, y + 2 + b); ctx.lineTo(x - 7, y - 5 + b); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 10 + b); ctx.lineTo(x + 5, y - 5 + b); ctx.lineTo(x, y + b); ctx.lineTo(x - 5, y - 5 + b); ctx.closePath(); ctx.fill();
      MP.txt(ctx, label, x, y - 28 + b, col); ctx.globalAlpha = 1;
    }
    for (const q of S.players) {
      if (q.out) continue;
      const qx = sx(q.x), qy = sy(q.y - 10), col = COL[q.pid % 4];
      // 头顶快捷语
      if (q.say && MP.SAY[q.say.i] && qx > -40 && qx < W + 40) { const s = MP.SAY[q.say.i], w = s.length * 12 + 14, y = qy - 58; ctx.globalAlpha = Math.min(1, q.say.t * 2); ctx.fillStyle = 'rgba(11,10,20,0.85)'; ctx.fillRect(qx - w / 2, y - 9, w, 18); ctx.fillStyle = col; ctx.fillRect(qx - w / 2, y + 9, w, 1); MP.txt(ctx, s, qx, y - 7, '#f2ead8'); ctx.globalAlpha = 1; }
      // 名字（自己不画）
      if (q !== me && q.name && !(S.outro) && qx > -20 && qx < W + 20 && qy > -20 && qy < H + 20) MP.txt(ctx, q.down ? q.name + ' · 倒地 ' + Math.ceil(q.downT || 0) : q.afk ? q.name + ' · 掉线' : q.name, qx, qy - 40 * (q.scale || 1), q.down ? '#ff5a5a' : col);
      // 倒地：红圈 + 倒计时 + 救人进度
      if (q.down) { ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(qx, qy + 16, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, q.downT || 0) / MP.DOWN.time); ctx.stroke(); if (q.revT > 0) { ctx.strokeStyle = '#8dff6a'; ctx.beginPath(); ctx.arc(qx, qy + 16, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q.revT / MP.DOWN.revive); ctx.stroke(); } }
      // 屏幕外的队友：边上的箭头
      if (q !== me && (qx < 8 || qx > W - 8 || qy < 8 || qy > H - 8)) {
        const mx = W / 2, my = H / 2, a = Math.atan2(qy - my, qx - mx), ex = D.clamp(mx + Math.cos(a) * W, 18, W - 18), ey = D.clamp(my + Math.sin(a) * W, 40, H - 30);
        ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 9, ey + Math.sin(a) * 9); ctx.lineTo(ex + Math.cos(a + 2.4) * 8, ey + Math.sin(a + 2.4) * 8); ctx.lineTo(ex + Math.cos(a - 2.4) * 8, ey + Math.sin(a - 2.4) * 8); ctx.fill();
        ctx.fillStyle = q.down ? '#ff5a5a' : col; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 7, ey + Math.sin(a) * 7); ctx.lineTo(ex + Math.cos(a + 2.4) * 6, ey + Math.sin(a + 2.4) * 6); ctx.lineTo(ex + Math.cos(a - 2.4) * 6, ey + Math.sin(a - 2.4) * 6); ctx.fill();
        MP.txt(ctx, q.name || '', ex - Math.cos(a) * 18, ey - Math.sin(a) * 18 - 7, col);
      }
    }
    if (me && me.down && !me.out) MP.txt(ctx, `你倒地了：等队友救（${Math.ceil(me.downT || 0)} 秒）`, W / 2, H - 76, '#ff5a5a');
    if (sayOpen) { const x0 = W / 2 - 150, y0 = H - 110; ctx.fillStyle = 'rgba(11,10,20,0.88)'; ctx.fillRect(x0, y0, 300, 40); MP.SAY.forEach((s, i) => MP.txt(ctx, (i + 1) + ' ' + s, x0 + 10 + (i % 3) * 98, y0 + 4 + Math.floor(i / 3) * 17, '#f2ead8', 'left')); }
    ctx.restore();
    return r;
  };
  // 小地图上的队友点（借小地图画"站里的人"那一层）
  if (D.drawMinimap) {
    const mm0 = D.drawMinimap;
    D.drawMinimap = function (ctx, S) {
      if (!S || !MP.on(S)) return mm0.apply(this, arguments);
      const keep = S.evObjs; S.evObjs = (keep || []).concat(S.players.filter(q => q !== S.player && !q.out).map(q => ({ kind: 'npc', x: q.x, y: q.y, f: S.f, mp: true })));
      try { return mm0.apply(this, arguments); } finally { S.evObjs = keep; }
    };
  }

  // ── 观战：出局的人按左右键换着看
  if (MP.follow) {
    let spec = 0; const f0 = MP.follow;
    MP.follow = function (S, cam, dt) {
      const I = D.Input, live = S.players.filter(q => !q.out); if (!live.length) return;
      if (I.hit && I.hit('ArrowRight')) spec++; if (I.hit && I.hit('ArrowLeft')) spec--;
      const t = live[((spec % live.length) + live.length) % live.length], VW = D.W / D.Z, VH = D.H / D.Z, k = 1 - Math.exp(-dt * 6);
      cam.x += (D.clamp(t.x - VW / 2, 0, Math.max(0, S.A.w - VW)) - cam.x) * k; cam.y += (D.clamp(t.y + 10 - VH / 2, -4, Math.max(0, S.A.h - VH + 20)) - cam.y) * k;
    };
  }

  // ── 结算页：小队一栏
  MP.squadOf = function (S, oks) {
    const rows = S.players.map(p => { const R = MP.of(S, p, 'raid') || {}, ok = oks ? oks(p) : p.out === 'extracted'; return { name: p.name || '', ok, value: ok ? Math.round(D.bagValue(R)) : 0, kills: (R.kills || 0) + ((MP.of(S, p, 'kills')) || 0), saves: p.saves || 0 }; });
    let best = null, bs = -1; for (const r of rows) { const s = r.value / 100 + r.kills * 2 + r.saves * 6; if (s > bs) { bs = s; best = r; } } if (best) best.mvp = true;
    return rows;
  };
  if (D.UI && D.UI.result) {
    const re0 = D.UI.result;
    D.UI.result = function () {
      const r = re0.apply(this, arguments), sq = MP.lastSquad; MP.lastSquad = null;
      if (sq && sq.length > 1 && typeof document !== 'undefined') {
        const host = document.querySelector('#ui .over-wrap .stats'); if (!host) return r;
        const el = document.createElement('div'); el.className = 'mp-squad';
        el.innerHTML = '<h4>小队</h4>' + sq.map(x => `<div class="mp-sq${x.mvp ? ' mvp' : ''}"><b>${String(x.name).replace(/[&<>"]/g, '')}</b><span>${x.ok ? '撤出' : '没撤出'}</span><span>带出 ${x.value | 0}</span><span>击毁 ${x.kills | 0}</span><span>救人 ${x.saves | 0}</span>${x.mvp ? '<em>MVP</em>' : ''}</div>`).join('');
        host.parentNode.insertBefore(el, host.nextSibling);
      }
      return r;
    };
  }
})(D);
