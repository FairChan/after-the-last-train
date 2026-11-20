/* 末班之后 · 多人联机：房主（design/features/multiplayer §4）
   房主跑唯一一份真规则：收每个队友的输入 → 每步 D.MP.stepAll 走全队 → 20 次/秒发快照、发生了就发事件、变了就发他自己的背包（私有状态）。
   队友的这一趟（raid）在房主这边：用他进城时发来的存档建（D.startRaid），东西进出都在这份上算，再同步回他那边、由他自己结算存档。
   连接：conn = { send, on, close }（net/transport.js）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {}, MP = () => D.MP;
  const ONE = ['melee', 'dash', 'q', 'e', 'reload', 'heal', 'shieldUse', 'charge', 'ammo', 'interact', 'pick', 'skill', 'nade'];
  // 队友能远程调的操作（背包、箱子、地上、装备）：名字 → D 上的函数
  NET.OPS = ['Grid.move', 'Grid.add', 'Grid.remove', 'Grid.take', 'equipFromBag', 'dropToGround', 'dropAt', 'takeToBag', 'takeGround', 'takeAllGround', 'equipCard', 'equipFromGround', 'Armor.wear', 'Armor.takeOff', 'pickQuick'];
  NET.fnOf = name => { const ks = name.split('.'); let o = D; for (let i = 0; i < ks.length - 1; i++) o = o && o[ks[i]]; return o && o[ks[ks.length - 1]] ? { o, f: o[ks[ks.length - 1]] } : null; };
  // 短命的特效：只发新出的，队友那边自己让它们飘、淡掉
  NET.FX = ['parts', 'texts', 'tlights', 'ghosts', 'tracers', 'beams', 'bolts', 'pillars', 'floaters'];
  // 世界里不发的（地图、本机的东西、每人自己的那几样、另外单独打包的）
  const WSKIP = new Set(['raid', 'st', 'step', 'rng', 'floors', 'fxs', 'A', 'floor', 'fx', 'players', 'me', 'motes', 'safe', 'isExit', 'liftFloors', 'ponly', 'shake', 'stop', 'slowmo', 'hintMsg', 'evInit',
    'enemies', 'containers', 'ground', 'shots', 'eshots', 'nades', 'mines', 'shells', 'drops', 'groundNear', 'fsel', 'quickOpen', 'flow', 'flowT', 'ibuf', 'dt', 'reported', 'stairWalk', 'lift', 'rt']);
  const EN_AI = ['wander', 'pulseCd', 'nadeCd', 'cd', 'hitCd']; // 敌人只给规则用的倒计时：不发（每帧都在变，画面用不着）
  const PRIV_SKIP = new Set(['pf', 'city', 'visited', 'healed', 'modsAtStart', 'at', 'from', 'step', 'alert', 'noise', 'stations', 'look', 'entry', 'gun0', 'mast', 'diff', 'shell', 'fx', 'evSpot', 'tut']);
  NET.packRaid = function (R) {
    const o = {};
    for (const k in R) { if (PRIV_SKIP.has(k)) continue; const v = R[k]; if (NET.isGrid(v)) o[k] = NET.grid(v); else { const y = NET.pack(v, 4); if (y !== undefined) o[k] = y; } }
    if (D.pouchR) { const P = D.pouchR(R); if (P && !o.pouch) o.$pouch = NET.grid(P); }
    o.$money = R.pf ? R.pf.money : 0;
    return o;
  };

  NET.Host = function (opt) {
    opt = opt || {};
    const H = { clients: [], S: null, n: 0, nid: 0, sent: new WeakSet(), last: {}, ctSent: [], name: opt.name || 'P1', kEn: NET.Keyed(), kPl: NET.Keyed(), sn: 0, bytes: 0, snaps: 0 };
    // ── 连接进来
    H.add = function (conn, info) {
      const cl = { conn, name: (info && info.name) || ('P' + (H.clients.length + 2)), pf: null, R: null, p: null, q: new Map(), last: -1, held: { mx: 0, my: 0 }, opAck: 0, privJ: '', seen: 0, ping: 0 };
      H.clients.push(cl);
      conn.on(m => H.recv(cl, m));
      return cl;
    };
    H.recv = function (cl, m) {
      if (!m || !m.k) return; NET.clean(m);
      cl.seen = H.n;
      switch (m.k) {
        case 'hello':
          if (m.v !== NET.VERSION) { cl.conn.send({ k: 'bye', why: 'ver', v: NET.VERSION }); return; }
          cl.name = m.name || cl.name; cl.pfData = m.pf; cl.ready = !!m.ready; cl.wantRtc = !!m.rtc; if (H.onHello) H.onHello(cl); if (cl.wantRtc && NET.rtcHost && !opt.noRtc) NET.rtcHost(cl.conn); break; // MP6：试着直连
        case 'in': for (const [s, inp] of m.i) if (s > cl.last && !cl.q.has(s)) cl.q.set(s, inp); break;
        case 'op': H.op(cl, m); break;
        case 'panel': if (cl.p && H.S) { const lo = NET.decPanel(H.S, m.v); if (H.S.player === cl.p) H.S.lootOpen = lo; else cl.p.ctx.lootOpen = lo; } cl.opAck = Math.max(cl.opAck, m.n || 0); break;
        case 'ping': cl.conn.send({ k: 'pong', t: m.t }); break;
        case 'rtt': cl.ping = m.ms; if (cl.p) cl.p.lag = m.ms; break;
        case 'full': H.ctSent = []; H.last = {}; break;
        case 'vote': if (H.onVote) H.onVote(cl, m.id); break;
        case 'closed': cl.gone = true; cl.goneN = H.n; if (cl.p) cl.p.afk = true; if (H.onLeave) H.onLeave(cl); break;
        default: if (H.onMsg) H.onMsg(cl, m);
      }
    };
    // ── 这一站开始：每个队友进站（第一次用他的存档建这一趟），告诉他站的种子
    H.begin = function (S, G) {
      H.kEn = NET.Keyed(); H.kPl = NET.Keyed(); H.sn = 0;
      H.S = S; H.ctSent = []; H.last = {}; H.sent = new WeakSet(); H.n = 0; S.players[0].name = H.name;
      const R0 = S.raid;
      for (const cl of H.clients) {
        if (cl.gone || cl.lost || cl.done) continue;
        if (!cl.R) { const pf = D.Save.deserialize(cl.pfData); cl.R = D.startRaid(pf, R0.at, R0.diff); }
        const R = cl.R; R.city = R0.city; R.at = R0.at; R.step = R0.step; R.alert = R0.alert; R.diff = R0.diff;
        cl.p = MP().addPlayer(S, R, { name: cl.name });
      }
      for (const cl of H.clients) if (cl.p && !cl.gone) H.sendStart(cl);
      S.rt = null; // 联机：小剧情屋不演（roomtalk.js）
    };
    // 告诉一个队友：哪个站、什么种子、站里有谁（进站时、断线回来时）
    H.sendStart = function (cl) {
      const S = H.S, R0 = MP().of(S, S.players[0], 'raid');
      cl.q.clear(); cl.last = -1; cl.privJ = ''; // opAck 不清零：队友那边的操作编号一直往上数
      cl.conn.send({ k: 'start', v: NET.VERSION, pid: cl.p.pid, seed: S.seed, at: R0.at, step: R0.step, city: { seed: R0.city.seed, ver: R0.city.ver || 1 }, o: S.enterOpt || {}, alert: R0.alert,
        look: S.players.map(p => NET.lookOf(S, p)), pub: S.players.map(NET.pubOf), t: S.t });
    };
    // 断线回来：换上新连接；在站里就重发这一站（下一条快照全发）
    H.resync = function (cl, conn) {
      cl.conn = conn; conn.on(m => { if (cl.conn === conn) H.recv(cl, m); }); cl.gone = false; cl.goneN = null; if (cl.p) cl.p.afk = false;
      if (H.S && cl.p && !cl.p.out) { H.ctSent = []; H.last = {}; H.sn = 0; H.sendStart(cl); } // 下一条是关键帧
    };
    // ── 每个队友这一步的输入：按步号一条条取；没来就沿用上一条（一次性的键不重复按）
    function inputOf(cl) {
      if (cl.q.size > 8) { const ks = [...cl.q.keys()].sort((a, b) => a - b); for (const k of ks.slice(0, ks.length - 3)) { const i = cl.q.get(k); for (const o of ONE) if (i[o]) cl.held[o] = true; cl.q.delete(k); cl.last = k; } } // 落后太多：跳到最近几步（一次性的键留着）
      let inp = cl.q.get(cl.last + 1);
      if (!inp && cl.q.size) { const s = Math.min(...cl.q.keys()); if (s > cl.last) { inp = cl.q.get(s); cl.last = s - 1; } }
      if (inp) { cl.q.delete(cl.last + 1); cl.last++; for (const o of ONE) if (cl.held[o]) inp[o] = true; cl.held = Object.assign({}, inp); for (const o of ONE) cl.held[o] = false; return inp; }
      return Object.assign({}, cl.held);
    }
    // ── 房主一步
    H.step = function (S, dt, hostInp) {
      if (S !== H.S) return D.stepStation(S, dt, hostInp);
      const inps = [hostInp];
      for (const cl of H.clients) if (cl.p && !cl.gone) inps[cl.p.pid] = inputOf(cl);
      for (const p of S.players) if (!inps[p.pid]) inps[p.pid] = { mx: 0, my: 0 };
      MP().stepAll(S, dt, inps);
      H.n++;
      for (const cl of H.clients) if (cl.gone && cl.p && !cl.p.out && H.n - (cl.goneN || 0) > 60 / D.DT) { cl.p.out = 'lost'; cl.p.afk = false; } // 掉线 60 秒没回来：失联
      // 队友的事件（开箱面板、揭开、对话……）：发给他本人
      for (const cl of H.clients) {
        if (!cl.p || cl.gone) continue;
        const evs = cl.p.ctx && cl.p.ctx.events; if (evs && evs.length) { const l = evs.splice(0).map(e => NET.encEv(S, e)); cl.conn.send({ k: 'ev', l }); }
      }
      if (H.n % NET.SNAP_EVERY === 0) H.snap(S);
      if (H.n % 6 === 0) H.priv(S);
    };
    // ── 快照：世界 + 每人
    H.world = function (S) {
      const W = { t: S.t, f: S.f };
      const key = H.sn++ % NET.KEY_EVERY === 0; W.key = key; // 每 2 秒一个关键帧
      W.en = H.kEn.enc(S.enemies.filter(e => !e.dead).map(e => { if (e.nid == null) e.nid = ++H.nid; const p = NET.pack(e, 3); for (const k of EN_AI) delete p[k]; return p; }), o => o.nid, key);
      const full = H.n % 360 === 0; W.ct = []; // 箱子：变了才发，6 秒全发一次
      S.containers.forEach((c, i) => { const p = NET.pack(c, 4), j = JSON.stringify(p); if (full || j !== H.ctSent[i]) { H.ctSent[i] = j; W.ct.push([i, p]); } });
      { const gr = S.ground.map(g => NET.pack(g, 2)), j = JSON.stringify(gr); if (key || full || j !== H.grJ) { H.grJ = j; W.gr = gr; } } // 地上的东西：变了才发
      W.br = S.floors.map(F => F.breakables.reduce((a, b, i) => (b.open && a.push(i), a), []));
      for (const k of NET.FX) { const a = S[k]; if (!a || !a.length) continue; const nw = []; for (const o of a) if (!H.sent.has(o)) { H.sent.add(o); const p = NET.pack(o, 3); if (p) nw.push(p); } if (nw.length) W[k] = nw; }
      for (const k of ['shots', 'eshots']) { const a = S[k], nw = []; for (const o of a) { if (o.nid == null) { o.nid = ++H.nid; const p = NET.pack(o, 2); p.nid = o.nid; if (o.pl) p.pid = o.pl.pid; nw.push(p); } } W[k] = { n: nw, a: a.map(o => o.nid) }; }
      for (const k of ['nades', 'mines', 'shells', 'drops']) W[k] = S[k].map(o => NET.pack(o, 2));
      W.x = {};
      for (const k of Object.keys(S)) { if (WSKIP.has(k) || MP().PF.includes(k)) continue; const p = NET.pack(S[k], 4), j = JSON.stringify(p); if (full || key || j !== H.last[k]) { H.last[k] = j; W.x[k] = p === undefined ? null : p; } }
      W.pl = H.kPl.enc(S.players.map(NET.pubOf), o => o.pid, key);
      W.dc = S.players.map(p => { const d = MP().of(S, p, 'decoy'); return d ? NET.pack(d, 2) : null; });
      return W;
    };
    H.snap = function (S) {
      const W = H.world(S);
      for (const cl of H.clients) {
        if (!cl.p || cl.gone) continue;
        const c = cl.p.ctx, me = { prompt: NET.pack(c.prompt, 3) || null, fpick: NET.pack(c.fpick, 3) || null, hitMark: NET.pack(c.hitMark, 2) || null, kills: c.kills || 0, scanT: c.scanT || 0, holdF: c.holdF || 0, lootOpen: NET.encPanel(S, c.lootOpen), recoil: c.recoil || 0, hurtDirs: NET.pack(c.hurtDirs, 3) || [] };
        const msg = { k: 'snap', n: H.n, ack: cl.last, oa: cl.opAck, w: W, me }; cl.conn.send(msg, !W.key); // 关键帧要送到（丢了的话差量都对不上）
      }
    };
    H.priv = function (S) {
      for (const cl of H.clients) {
        if (!cl.p || cl.gone) continue;
        const r = NET.packRaid(cl.R), j = JSON.stringify(r);
        if (j !== cl.privJ) { cl.privJ = j; cl.conn.send({ k: 'priv', oa: cl.opAck, r }); }
      }
    };
    // ── 队友的操作：换成他的视角，按路径找到这边那份东西再调同一个函数
    H.op = function (cl, m) {
      cl.opAck = Math.max(cl.opAck, m.n || 0); cl.privJ = ''; // 不管做没做成都把他的背包重发一次：他那边先改了的，以这边为准改回来
      const S = H.S; if (!S || !cl.p || !NET.OPS.includes(m.f)) return;
      if (!Array.isArray(m.a) || m.a.some(NET.itemByValue)) return; // 按值发来的东西不认（以前队友单击过期的地上东西能无限捡）
      const fn = NET.fnOf(m.f); if (!fn) return;
      const host = S.players[0]; MP().use(S, cl.p);
      try {
        const args = m.a.map(a => NET.dec(S, S.raid, a));
        if (m.a.some((a, i) => NET.known(a) && args[i] == null)) return; // 找不到了（别人先拿走了）：不做
        fn.f.apply(fn.o, args);
      } catch (e) { if (D.debug) console.error(e); }
      finally { MP().use(S, host); }
    };
    H.end = function () { H.S = null; for (const cl of H.clients) cl.p = null; };
    return H;
  };
})(D);
