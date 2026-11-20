/* 末班之后 · 多人联机：大厅（建房间 / 加入 / 准备 / 出发）
   房主：NET.Lobby.host(url, name) 建房间 → 队友连进来发 hello（自己的存档）→ 大厅列表广播给大家 → 全员准备后 go(入口站, 难度)
   队友：NET.Lobby.join(url, code, name) → 发 hello、点准备 → 收到 go：用自己的存档出发（先存一份"这一趟算损毁"）→ 收到 start：进影子站
   房间列表（net/roomlist.js）：房主建了房间就挂到列表上（L.ann），没开局、没满时大家的"联机"面板里自动出现；开局 / 满了 / 关了就撤下。
   界面在 ui-lobby.js（这里不放文案）；L.changed() 让界面重画。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {}, G = () => D.Game;
  // 一份存档的"配装分"：带进城的卡和背包里东西的价值
  NET.gearScore = pf => { let v = 0; const L = pf.load || {}; for (const k of ['gun', 'melee', 'q', 'e']) if (L[k]) { try { v += D.itemInfo('card:' + L[k]).v; } catch (e) {} } for (const e of (pf.kit && pf.kit.items) || []) { try { v += D.itemInfo(e.id).v * e.n; } catch (e2) {} } return Math.round(v); };
  // 联机能去的站：事件站（一场对话，剧情）不去
  NET.coopOK = st => !!st && !st.dead && st.type !== 'event';
  NET.startPoints = pf => [pf.city.home].concat(D.startPoints(pf.city).filter(id => NET.coopOK(pf.city.stations[id]))); // 据点 = 先一起在线路图上选第一站
  const meOf = pf => ({ shell: D.shellOf(pf), score: NET.gearScore(pf) });

  const L = NET.Lobby = { role: null, state: 'off', list: [], err: null, code: null, entry: null, diff: 0, ready: false, changed: () => {} };
  L.reset = function () {
    if (L.RH) L.RH.close(); if (L.ws) try { L.ws.close(); } catch (e) {}
    if (L.ann) L.ann.close();
    Object.assign(L, { role: null, state: 'off', list: [], err: null, code: null, RH: null, H: null, CL: null, ws: null, ready: false, token: null, inRaid: false, ann: null });
    NET.cl = null;
  };

  // ── 房主
  L.host = async function (url, name) {
    L.reset(); L.state = 'connecting'; L.changed();
    try { L.RH = await NET.relayHost(url, name); } catch (e) { L.state = 'off'; L.err = e; L.changed(); return false; }
    L.code = L.RH.code; L.url = url;
    const H = hostRoom(name);
    if (NET.roomAnnounce) L.ann = NET.roomAnnounce(url, { lan: L.RH.lan }); L.lan = L.RH.lan || [];
    L.RH.onPeer = (conn, m) => {
      const old = H.clients.find(c => c.rid === m.id);
      if (old && m.back && NET.Lobby.rejoin) return NET.Lobby.rejoin(old, conn); // 断线 60 秒内回来（MP3）
      const cl = H.add(conn, { name: m.name }); cl.rid = m.id; L.broadcast();
    };
    L.RH.onDown = () => { L.err = 'net'; if (L.ann) L.ann.clear(); L.changed(); };
    L.broadcast(); return true;
  };
  function hostRoom(name) {
    const H = L.H = NET.Host({ name }); L.role = 'host'; L.name = name; L.state = 'room';
    H.onHello = cl => { if (L.inRaid && !cl.R) { cl.conn.send({ k: 'bye', why: 'started' }); return; } L.broadcast(); };
    H.onMsg = (cl, m) => { if (m.k === 'ready') { cl.ready = !!m.r; L.broadcast(); } else if (NET.Lobby.onMsg) NET.Lobby.onMsg(cl, m); };
    H.onLeave = cl => { if (!L.inRaid) H.clients.splice(H.clients.indexOf(cl), 1); L.broadcast(); if (NET.Lobby.onLeave) NET.Lobby.onLeave(cl); };
    const pings = setInterval(() => { if (L.H !== H) return clearInterval(pings); L.broadcast(); }, 1000);
    return H;
  }

  L.full = () => !!L.H && L.H.clients.filter(c => !c.gone).length >= 3;
  // 房间列表上的那一条：没开局、没满、中继还连着才挂着
  const annSync = () => {
    if (!L.ann) return;
    if (L.inRaid || L.full() || L.err === 'net') L.ann.clear();
    else L.ann.set({ c: L.code, n: L.name, p: 1 + L.H.clients.filter(c => !c.gone).length, m: 4 });
  };
  // 大厅列表：房主自己 + 每个连上的人
  L.rows = function () {
    const pf = G().pf, me = meOf(pf), H = L.H, out = [{ id: 0, name: L.name, shell: me.shell, score: me.score, ready: true, ping: 0, host: true }];
    if (H) for (const cl of H.clients) if (!cl.gone || L.inRaid) out.push({ id: cl.rid, name: cl.name, shell: cl.info ? cl.info.shell : null, score: cl.info ? cl.info.score : 0, ready: !!cl.ready, ping: cl.ping || 0, gone: !!cl.gone, hello: !!cl.pfData, via: cl.conn.via || 'relay' });
    return out;
  };
  L.broadcast = function () {
    if (!L.H) return;
    for (const cl of L.H.clients) if (cl.pfData && !cl.info) { try { cl.info = meOf(D.Save.deserialize(cl.pfData)); } catch (e) { cl.info = { shell: 'worker', score: 0 }; } }
    L.list = L.rows(); const entry = L.entry != null ? G().pf.city.stations[L.entry] : null;
    for (const cl of L.H.clients) if (!cl.gone) cl.conn.send({ k: 'lobby', list: L.list, code: L.code, entry: entry ? entry.name : null, diff: L.diff, fps: Math.round(D.fps || 60) });
    annSync(); L.changed();
  };
  L.canGo = () => L.role === 'host' && L.entry != null && L.H && L.H.clients.filter(c => !c.gone).every(c => c.pfData && c.ready);
  L.go = function () {
    if (!L.canGo()) return false;
    const g = G(), H = L.H;
    L.RH.lock(); L.inRaid = true;
    for (const cl of H.clients) if (!cl.gone) cl.conn.send({ k: 'go' });
    g.net = NET.hostSession(H, { lobby: L });
    g.departTo(L.entry, L.diff);
    return true;
  };

  // ── 队友
  L.join = async function (url, code, name) {
    L.reset(); L.state = 'connecting'; L.changed();
    let j; try { j = await NET.relayJoin(url, code, name); } catch (e) { L.state = 'off'; L.err = e; L.changed(); return false; }
    L.code = j.code; L.token = j.token; L.url = url; L.ws = j.ws;
    if (NET.rtcClient) NET.rtcClient(j.conn); // MP6：等房主发起直连
    clientRoom(j.conn, name); return true;
  };
  function clientRoom(conn, name) {
    L.role = 'client'; L.name = name; L.state = 'room';
    const CL = L.CL = NET.Client(conn, { name, R: null });
    L.bindClient(CL);
    CL.hello(D.Save.serialize(G().pf), { ready: false, rtc: !!(NET.rtcOK && NET.rtcOK()) });
    L.changed();
  }
  L.bindClient = function (CL) {
    CL.onMsg = m => {
      if (m.k === 'lobby') { L.list = m.list; L.entryName = m.entry; L.diff = m.diff; L.fps = m.fps; L.changed(); }
      else if (m.k === 'go') L.depart();
      else if (NET.Lobby.onClientMsg) NET.Lobby.onClientMsg(CL, m);
    };
    CL.onBye = m => { L.err = m.why; L.state = 'off'; L.changed(); };
    CL.onLost = () => { if (NET.Lobby.onHostLost) NET.Lobby.onHostLost(CL); else { L.err = 'net'; L.changed(); } };
    CL.onStart = S => {
      const g = G(); g.raid = CL.R; g.S = S; g.mode = 'station'; g.net = NET.clientSession(CL, { lobby: L }); NET.cl = CL;
      if (D.UI.closeModal) D.UI.closeModal(); D.UI.station(S);
      if (NET.Lobby.onClientStart) NET.Lobby.onClientStart(CL, S);
    };
  };
  // 本地中转的房间：房主电脑可能有好几个局域网地址，一个个试
  L.joinLan = async function (urls, code, name) {
    for (const u of urls) { if (await L.join(u, code, name)) return true; if (L.err !== 'net') return false; }
    L.err = 'nolan'; L.changed(); return false;
  };
  NET.viaLocal = () => !!L.url && NET.isLocalRelay && NET.isLocalRelay(L.url); // 这个房间走本地中转（大厅里写"本地中转"）
  L.setReady = r => { L.ready = !!r; if (L.CL) L.CL.conn.send({ k: 'ready', r: L.ready }); L.changed(); };
  // 房主点了出发：用自己的存档出发（背包随工壳走），先存一份"这一趟算损毁"（中途关网页就是这个结果）
  L.depart = function () {
    const g = G(), CL = L.CL; if (CL.R) return;
    L.before = D.Save.serialize(g.pf); // 房主掉线时退回这一份（D4）
    CL.R = D.startRaid(g.pf, g.pf.city.home); CL.R.mp = true; g.raid = CL.R; L.inRaid = true;
    D.Save.checkpointRaid(g.slot, CL.R);
  };
})(D);
