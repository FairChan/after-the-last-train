/* 末班之后 · 多人联机 MP3：完整一趟（design/features/multiplayer §3.2–3.7）
   - 线路图：用房主的城市；房主选下一站，队友在图上点"想去"（发给房主，弹一句"某某想去哪"）
   - 坐车：车停靠时每个人自己走到站台下沿上车（上了车就看着队友）；全员上车立刻开走；关门时没上车的被留下 = 失联（D3）
   - 撤离站：接驳车到了每个人各自登车，登上的就算撤出；全队都出局了这一站才结束
   - 结算各结各的：房主照常；队友收到 end 自己结算存档（D5：只结东西和钱，城市进度、线索不带走）
   - 掉线：队友的工壳原地站着（敌人照打），60 秒内凭同一个房间码回来接着玩，超过按失联；房主掉线 = 这一趟作废，队友退回进城时的配装（D4）
   - 事件站：联机时按普通的站打（剧情不在联机里演）
   这个文件放规则和流程里要显示的字；连接、快照在 net/。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const MP = D.MP, NET = D.Net, K = D.K, TS = 16, G = () => D.Game, LB = () => NET.Lobby;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const T = D.SCHED;
  const isHost = () => { const g = G(); return !!(g && g.net && g.net.role === 'host' && g.net.H); };
  const isClient = () => { const g = G(); return !!(g && g.net && g.net.role === 'client'); };
  const OUT_TEXT = { boarded: '你上车了，等队友', extracted: '你撤出了，看着队友打', dead: '你倒下了，看着队友', left: '车开走了，你被留下了', lost: '掉线太久，这一趟算失联' };

  // ── 坐车：每个人自己上车
  const ss0 = K.schedStep;
  K.schedStep = function (S, dt) {
    const X = S.sched;
    if (!MP.on(S) || !X || S.over || S.extract || X.st !== 'dwell') { if (X) X.mp = null; return ss0.apply(this, arguments); }
    X.t += dt; if (X.hold) X.t = Math.min(X.t, 0.5);
    const A = S.floors[1];
    for (const p of S.players) {
      if (p.out) continue;
      const inZone = p.hp > 0 && !p.down && S.f === 1 && p.y > A.boardY && X.t > 0.25 && !S.intro;
      p.boardT = inZone ? (p.boardT || 0) + dt : 0;
      if (p.boardT >= T.board) { p.out = 'boarded'; p.boardT = 0; S.banner = { t: 0, text: (p.name || '') + ' 上车了', sub: '全员上车就开走' }; sfx('power'); }
    }
    const all = S.players.filter(p => !p.out || p.out === 'boarded'), on = all.filter(p => p.out === 'boarded');
    X.mp = { on: on.length, all: all.length, left: Math.max(0, Math.ceil(T.dwell - X.t)), hold: !!X.hold };
    if (on.length && on.length === all.length) return teamLeave(S);
    if (!X.hold && X.t >= T.dwell) {
      if (on.length) { for (const p of all) if (p.out !== 'boarded') p.out = 'left'; return teamLeave(S); } // 关门了：没上车的被留下（D3）
      X.st = 'depart'; X.t = 0; X.board = 0; X.mp = null; if (S.f === 1) sfx('throw');
    }
  };
  function teamLeave(S) {
    const p = S.player, A = S.A, x0 = 32; let dx = p.x, bd = 1e9;
    for (let c = 0; c < 4; c++) { const d = x0 + TS + c * 100 + 48; if (d > 8 && d < A.w - 8 && Math.abs(d - p.x) < bd) { bd = Math.abs(d - p.x); dx = d; } }
    S.over = 'leave'; S.endT = 0; S.outro = { t: 0, x0, px: p.x, py: p.y, dx, dy: (A.track || S.floors[1].track).y0 * TS + 12, next: true, dur: T.ride };
    S.sched.st = 'gone'; S.sched.mp = null; sfx('power');
  }
  // ── 撤离：接驳车到了每个人各自登车
  const ex0 = K.extractStep;
  K.extractStep = function (S, dt) {
    const X = S.extract;
    if (!MP.on(S) || !X.train) return ex0.apply(this, arguments);
    const p0 = S.player; S.player = { hp: 0, x: p0.x, y: p0.y, r: 5, pid: p0.pid }; // 原来的"房主一上车就结束"不走：每个人在下面自己上
    try { ex0.apply(this, arguments); } finally { S.player = p0; }
    if (X.trainX < 0 || S.over) return;
    const A = S.A;
    for (const p of S.players) {
      if (p.out) continue;
      const inZone = p.hp > 0 && !p.down && S.f === S.console.f && p.y > A.boardY;
      p.boardT = inZone ? (p.boardT || 0) + dt : 0;
      if (p.boardT >= D.SCHED.board) { p.out = 'extracted'; p.boardT = 0; S.banner = { t: 0, text: (p.name || '') + ' 撤出了', sub: '登上接驳车' }; sfx('win'); }
    }
    const all = S.players.filter(p => !p.out || p.out === 'extracted');
    X.mp = { on: all.filter(p => p.out === 'extracted').length, all: all.length };
    if (S.players.every(p => p.out)) {
      S.over = S.players.some(p => p.out === 'extracted') ? 'extracted' : 'dead'; S.endT = 0;
      const p = S.player; let dx = p.x, bd = 1e9;
      for (let c = 0; c < 4; c++) { const d = X.trainX + TS + c * 100 + 48; if (d > 8 && d < A.w - 8 && Math.abs(d - p.x) < bd) { bd = Math.abs(d - p.x); dx = d; } }
      S.outro = { t: 0, x0: X.trainX, px: p.x, py: p.y, dx, dy: A.track.y0 * TS + 12 }; sfx('power');
    }
  };
  // ── 出局的人：镜头跟着还在打的队友
  const sa0 = MP.stepAll;
  MP.stepAll = function (S, dt, inps) {
    const r = sa0.apply(this, arguments);
    if (MP.on(S)) { MP.teamOver(S); const h = S.players[0]; if (h.out) follow(S, S.cam, dt); }
    return r;
  };
  function follow(S, cam, dt) {
    const t = S.players.find(q => !q.out); if (!t) return;
    const VW = D.W / D.Z, VH = D.H / D.Z, k = 1 - Math.exp(-dt * 6);
    cam.x += (D.clamp(t.x - VW / 2, 0, Math.max(0, S.A.w - VW)) - cam.x) * k; cam.y += (D.clamp(t.y + 10 - VH / 2, -4, Math.max(0, S.A.h - VH + 20)) - cam.y) * k;
  }
  MP.follow = follow;

  // ── 画面上方：车上几个人、撤出几个人、自己出局了、谁掉线了
  const ds0 = D.drawStation;
  D.drawStation = function (ctx, S) {
    const r = ds0.apply(this, arguments);
    if (!S || !MP.on(S)) return r;
    const lines = [], X = S.sched, E = S.extract, me = S.me || S.player;
    if (X && X.mp) lines.push([X.mp.hold ? `列车在等全队：车上 ${X.mp.on}/${X.mp.all} 人` : `车上 ${X.mp.on}/${X.mp.all} 人 · 关门 ${X.mp.left} 秒`, '#ffd860']);
    if (E && E.mp) lines.push([`已撤出 ${E.mp.on}/${E.mp.all} 人`, '#8dff6a']);
    if (me && me.out && OUT_TEXT[me.out]) lines.push([OUT_TEXT[me.out], '#8fe8ff']);
    for (const q of S.players) if (q.afk && !q.out) lines.push([`${q.name || ''} 掉线了，等他回来`, '#ff9a6a']);
    if (lines.length) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      lines.forEach(([s, col], i) => MP.txt(ctx, s, D.W / 2, 40 + i * 16, col));
      ctx.restore();
    }
    return r;
  };

  // ── 主循环的流程挂钩
  function hook() {
    const g = G(); if (!g || g.__mpTrip) return; g.__mpTrip = true;
    // 事件站：联机时按普通的站打
    const en0 = g.enter;
    g.enter = function (o) {
      const R = g.raid, st = R && R.city.stations[R.at];
      if (g.net && g.net.role === 'host' && st && st.type === 'event') { const E = D.EvTalk, off = E && E.off; if (E) E.off = true; try { return en0.call(this, Object.assign({}, o, { asType: 'ruin' })); } finally { if (E) E.off = off; } }
      return en0.apply(this, arguments);
    };
    // 房主：离站回到线路图 → 出局的队友结算、活着的同步耐久，把线路图发给大家
    const tt0 = g.toTravel;
    g.toTravel = function () {
      const H = isHost() ? g.net.H : null, S = H && H.S;
      if (H) for (const cl of H.clients) {
        if (cl.done || !cl.p) continue;
        if (cl.p.out && cl.p.out !== 'boarded') { endFor(cl, false, cl.p.out, S && MP.squadOf ? MP.squadOf(S) : null); continue; }
        cl.R.hp = Math.max(1, Math.round(cl.p.hp)); cl.R.kills = (cl.R.kills || 0) + ((cl.p.ctx && cl.p.ctx.kills) || 0);
      }
      const hostOut = S && S.players[0].out && S.players[0].out !== 'boarded' ? S.players[0].out : null;
      if (H) H.end();
      const r = tt0.apply(this, arguments);
      if (H) { g.net.hostOut = g.net.hostOut || hostOut; travelMsg(g); }
      return r;
    };
    // 房主结算：自己按有没有撤出来算；每个还在的队友各发一条 end
    const fi0 = g.finish;
    g.finish = function (ok) {
      if (!isHost()) return fi0.apply(this, arguments);
      const H = g.net.H, S = g.S, sq = S && MP.on(S) && MP.squadOf ? MP.squadOf(S) : null; MP.lastSquad = sq;
      for (const cl of H.clients) if (!cl.done) endFor(cl, !!(cl.p && cl.p.out === 'extracted' && ok !== false), cl.p ? cl.p.out : 'lost', sq);
      if (S && MP.on(S)) ok = ok && S.players[0].out === 'extracted';
      if (g.net.hostOut) ok = false;
      H.end(); g.net = null;
      const r = fi0.call(this, ok);
      LB().afterRun();
      return r;
    };
    // 队友：在线路图上点站 = 告诉房主想去哪
    const tr0 = g.travelTo;
    g.travelTo = function (id) {
      if (isClient()) { g.net.CL.conn.send({ k: 'vote', id }); sfx('click'); D.UI.toast('已经告诉房主：想去 ' + g.raid.city.stations[id].name); return; }
      return tr0.apply(this, arguments);
    };
    // 联机时 Esc 菜单里的"放弃"：队友 = 自己这一趟算损毁、退出；房主 = 全队结束
    const ab0 = g.abandon;
    g.abandon = function () {
      if (isClient()) { const CL = g.net.CL; CL.conn.send({ k: 'quit' }); clientEnd(CL, false); return; }
      return ab0.apply(this, arguments);
    };
  }
  function endFor(cl, ok, why, squad) { cl.done = true; cl.conn.send({ k: 'end', ok, why: why || null, squad: squad || (cl.squadS && MP.squadOf ? MP.squadOf(cl.squadS) : null) }); }
  function travelMsg(g) {
    const R = g.raid, H = g.net && g.net.H; if (!H) return;
    for (const cl of H.clients) if (!cl.done && !cl.gone) cl.conn.send({ k: 'travel', at: R.at, from: R.from, step: R.step, visited: [...R.visited], alert: R.alert, city: { seed: R.city.seed, ver: R.city.ver || 1 } });
  }
  NET.travelMsg = travelMsg;

  // ── 大厅那边的回调（net/lobby.js）
  const L = LB();
  // 房主：队友的消息
  L.onMsg = function (cl, m) {
    const g = G();
    if (m.k === 'quit') { if (cl.p && !cl.p.out) cl.p.out = 'lost'; cl.done = true; }
  };
  NET.Lobby.voteName = null;
  // 房主：投票（队友想去哪）
  const hookVotes = () => { const H = L.H; if (!H || H.onVote) return; H.onVote = (cl, id) => { const g = G(), st = g.raid && g.raid.city.stations[id]; if (!st) return; H.votes = H.votes || {}; H.votes[cl.rid] = id; D.UI.toast((cl.name || '') + ' 想去 ' + st.name); sfx('tink'); }; };
  const go0 = L.go; L.go = function () { hookVotes(); return go0.apply(this, arguments); };
  // 房主：断线的队友 60 秒内回来
  L.rejoin = function (cl, conn) {
    const g = G(), H = L.H; H.resync(cl, conn); if (cl.wantRtc && NET.rtcHost) NET.rtcHost(conn);
    if (g.mode === 'travel' && !cl.done) travelMsg(g);
    D.UI.toast((cl.name || '') + ' 回来了');
  };
  L.onLeave = function (cl) { if (L.inRaid && !cl.done) D.UI.toast((cl.name || '') + ' 掉线了：60 秒内回来能接着玩'); };
  // 一趟结束：回到房间，能再来一趟
  L.afterRun = function () {
    const H = L.H; if (!H) return;
    H.clients = H.clients.filter(c => !c.gone); for (const c of H.clients) { c.R = null; c.done = false; c.ready = false; c.p = null; }
    L.inRaid = false; if (L.RH) L.RH.unlock(); L.broadcast();
  };
  // 队友：线路图、结算
  L.onClientMsg = function (CL, m) {
    const g = G();
    if (m.k === 'travel') {
      const R = CL.R; if (!R) return;
      if (!R.city || R.city.seed !== m.city.seed) R.city = D.makeCity(m.city.seed, m.city.ver);
      R.at = m.at; R.from = m.from; R.step = m.step; R.visited = new Set(m.visited); R.alert = m.alert;
      if (CL.S && g.S === CL.S) R.hp = Math.max(1, Math.round(CL.S.player.hp));
      CL.S = null; g.raid = R; g.net = NET.clientSession(CL, { lobby: L }); NET.cl = CL; if (D.UI.closeModal) D.UI.closeModal(); g.toTravel();
    } else if (m.k === 'end') { MP.lastSquad = Array.isArray(m.squad) ? m.squad : null; clientEnd(CL, !!m.ok, m.why); }
  };
  function clientEnd(CL, ok, why) {
    const g = G(), R = CL.R; if (!R) return;
    if (g.S && g.S === CL.S) R.hp = Math.max(0, Math.round(CL.S.player.hp));
    g.net = null; NET.cl = null; CL.S = null; L.inRaid = false; L.ready = false;
    g.raid = R; g.finish(ok); CL.R = null;
    const END = { left: '车开走了，你被留下了：这一趟按损毁算', lost: '掉线太久：这一趟按损毁算', dead: '你倒下了：这一趟按损毁算' };
    if (!ok && END[why]) D.UI.toast(END[why]);
  }
  // 队友：连接断了。房主走了 → 这一趟作废、退回进城时的配装（D4）；自己掉线 → 60 秒里每 2 秒试着回去
  L.onHostLost = function (CL) {
    if (!L.inRaid) { L.err = 'net'; L.state = 'off'; L.changed(); return; }
    if (CL.hostGone) return hostGone();
    const t0 = Date.now(); L.recon = true;
    const tryOnce = async () => {
      if (!L.recon) return;
      if (Date.now() - t0 > 60000) { L.recon = false; return hostGone(true); }
      try { const j = await NET.relayJoin(L.url, L.code, L.name, L.token); L.ws = j.ws; CL.lost = false; CL.bind(j.conn); if (NET.rtcClient) NET.rtcClient(j.conn); L.recon = false; D.UI.toast('重新连上了'); }
      catch (e) { if (e === 'noroom') return hostGone(); setTimeout(tryOnce, 2000); }
    };
    D.UI.toast('掉线了，正在重连……'); setTimeout(tryOnce, 500);
  };
  function hostGone(self) {
    const g = G(); if (!L.inRaid) return;
    L.inRaid = false; L.recon = false;
    if (L.before) { const pf = D.Save.deserialize(L.before); g.pf = pf; if (g.slot != null) D.Save.write(g.slot, pf); } // 退回出发前那一份（配装原样、捡的不算）
    g.net = null; NET.cl = null; if (L.CL) { L.CL.S = null; L.CL.R = null; }
    g.raid = null; g.S = null; L.reset(); g.toHub('home');
    D.UI.toast(self ? '连不回去了：这一趟不算，带进去的配装原样退回' : '房主掉线了：这一趟不算，带进去的配装原样退回');
  }
  L.hostGone = hostGone;
  // 队友本机：自己出局了 → 不画自己、镜头跟着队友
  if (NET.Client) {
    const C0 = NET.Client;
    NET.Client = function () {
      const CL = C0.apply(this, arguments), v0 = CL.visual;
      CL.visual = function (S, dt) { v0.apply(this, arguments); const me = S.player; S.hideP = !!(me && me.out); if (me && me.out) follow(S, S.cam, dt); };
      return CL;
    };
  }
  if (D.Game) hook(); else (D._late || (D._late = [])).push(hook);
})(D);
