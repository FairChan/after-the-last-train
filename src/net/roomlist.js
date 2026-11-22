/* 末班之后 · 多人联机：房间列表（用户 2026-11-19："我自己创建房间之后，然后自动检测"）
   建房间以后，房间自动出现在所有人的"联机"面板里，点"加入"就进。联机本身还是走中继（加直连），这里只管"有哪些房间"。
   中继（阿里云那台）不再更新、不认列表，所以目录放在免费的公共 MQTT 服务器上（用户同意的）：
     房主：每个房间一条"保留消息"，主题 underdog-atl/v<版本>/rooms/<房间码>，内容 { c 房间码, n 房主名字, p 人数, m 上限, r 中继地址, t 时间 }；
           人数变了、每 60 秒重发一次；开局 / 关房间时发空消息删掉；网页直接关掉由服务器替它发"遗嘱"（空消息）删掉。
     看列表：订阅 underdog-atl/v<版本>/rooms/+，只认中继地址和自己一样的（别人填的地址不连，免得把存档发给陌生服务器）、10 分钟内的。
   连两个公共服务器（一个挂了另一个还在），列表合并。中继是本机 / 局域网地址时，改问中继自己（server/relay.mjs 的 list），不上公共服务器。
     NET.roomWatch(url, onList) → { close }：onList(list | null)，null = 列表连不上
     NET.roomAnnounce(url, { lan }) → { set(entry), clear(), close() }：本地中转时 lan = 房主电脑的局域网地址，条目写 r:'lan', l:[地址]，
       看列表的人不管自己连哪个中继都列出来（标"本地中转"），点加入就连这些地址（只认内网地址：外面的人伪造条目也只能让你连自己家的局域网）
   MQTT 3.1.1 只用到：连接（带遗嘱）、订阅、发布（QoS 0、保留）、心跳。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {};
  NET.ROOM_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  NET.ROOM_MODE = 'auto'; // 'auto'：公网中继用 MQTT、本机 / 局域网中继问中继；测试可以强制 'mqtt'
  NET.ROOM_EVERY = 60000;
  NET.ROOM_STALE = 10 * 60000;
  const topicBase = () => 'underdog-atl/v' + (NET.VERSION || 0) + '/rooms/';
  // 内网 IPv4（整个地址都要是数字，不认 192.168.evil.com 这种主机名）
  const PRIV4 = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;
  const priv4 = h => PRIV4.test(h) && h.split('.').every(o => +o <= 255);
  NET.isLocalRelay = function (url) {
    let u; try { u = new URL(url); } catch (e) { return true; }
    const h = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return h === 'localhost' || /\.local$/.test(h) || priv4(h) || (u.hostname.startsWith('[') && (h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h)));
  };
  const useMqtt = url => NET.ROOM_MODE === 'mqtt' || (NET.ROOM_MODE === 'auto' && !NET.isLocalRelay(url));
  // 本地中转条目里的地址：只认 ws(s)://内网 IPv4 字面地址（不是本机 127.x、不带账号密码），外面的人伪造条目也只能指向你自己家的局域网
  const lanOK = l => Array.isArray(l) && l.length > 0 && l.length <= 3 && l.every(u => {
    if (typeof u !== 'string') return false; let p; try { p = new URL(u); } catch (e) { return false; }
    return (p.protocol === 'ws:' || p.protocol === 'wss:') && priv4(p.hostname) && !/^(127|169\.254)\./.test(p.hostname) && !p.username && !p.password && p.pathname === '/';
  });

  // ── 最小的 MQTT 客户端
  const te = new TextEncoder(), td = new TextDecoder();
  const str = s => { const b = te.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const pkt = (h, body) => { const len = []; let n = body.length; do { let x = n % 128; n = Math.floor(n / 128); if (n) x |= 128; len.push(x); } while (n); return new Uint8Array([h, ...len, ...body]); };
  function mqtt(url, opt) {
    const M = { url, ok: false, closed: false, subs: [], onMsg: null, onUp: null, onDown: null, back: 3000 };
    let ws, buf = new Uint8Array(0), ping = null, timer = null, pid = 1;
    const send = u8 => { if (ws && ws.readyState === 1) try { ws.send(u8); } catch (e) {} };
    M.pub = (topic, payload, retain) => { if (M.ok) send(pkt(0x30 | (retain ? 1 : 0), [...str(topic), ...te.encode(payload)])); };
    M.sub = filter => { M.subs.push(filter); if (M.ok) send(pkt(0x82, [0, pid++ & 0xffff || 1, ...str(filter), 0])); };
    const onData = u8 => {
      const all = new Uint8Array(buf.length + u8.length); all.set(buf); all.set(u8, buf.length); buf = all;
      for (;;) {
        if (buf.length < 2) return;
        let n = 0, mul = 1, i = 1, b; do { if (i >= buf.length) return; b = buf[i++]; n += (b & 127) * mul; mul *= 128; } while (b & 128 && i < 5);
        if (buf.length < i + n) return;
        const h = buf[0], body = buf.subarray(i, i + n); buf = buf.slice(i + n);
        const type = h >> 4;
        if (type === 2) { if (body[1] === 0) { M.ok = true; M.back = 3000; for (const f of M.subs) send(pkt(0x82, [0, pid++ & 0xffff || 1, ...str(f), 0])); if (M.onUp) M.onUp(); } }
        else if (type === 3) { const tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl)); let off = 2 + tl; if ((h >> 1) & 3) off += 2; if (M.onMsg) M.onMsg(topic, td.decode(body.subarray(off))); }
      }
    };
    const go = () => {
      if (M.closed) return;
      try { ws = new WebSocket(url, 'mqtt'); } catch (e) { return again(); }
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        const cid = 'ud' + Math.random().toString(36).slice(2, 12), will = opt.will;
        const flags = 0x02 | (will ? 0x04 | 0x20 : 0);
        const body = [...str('MQTT'), 4, flags, 0, 30, ...str(cid)];
        if (will) body.push(...str(will.topic), ...str(will.payload));
        send(pkt(0x10, body));
        clearInterval(ping); ping = setInterval(() => send(new Uint8Array([0xc0, 0])), 20000);
      };
      ws.onmessage = ev => onData(new Uint8Array(ev.data));
      ws.onclose = () => { clearInterval(ping); const was = M.ok; M.ok = false; if (M.onDown) M.onDown(was); again(); };
      ws.onerror = () => {};
    };
    const again = () => { if (M.closed) return; clearTimeout(timer); timer = setTimeout(go, M.back); M.back = Math.min(60000, M.back * 2); };
    M.close = () => { M.closed = true; clearTimeout(timer); clearInterval(ping); if (ws) { if (ws.readyState === 1) send(new Uint8Array([0xe0, 0])); try { ws.close(); } catch (e) {} } };
    M.flush = () => new Promise(r => { const t0 = Date.now(); const f = () => (!ws || ws.readyState !== 1 || !ws.bufferedAmount || Date.now() - t0 > 1000) ? r() : setTimeout(f, 30); f(); });
    go(); return M;
  }

  // ── 看列表
  NET.roomWatch = function (url, onList) {
    if (!useMqtt(url)) return NET.relayWatch(url, (list, why) => onList(list && list.map(r => ({ code: r.code, name: r.name, n: r.n, max: r.max })), why));
    const rooms = new Map(), W = { closed: false };
    let up = 0, tried = 0;
    const emit = () => {
      if (W.closed) return;
      const now = Date.now(), list = [];
      for (const [k, e] of rooms) if (now - e.t < NET.ROOM_STALE && e.p < e.m) list.push({ key: k, code: e.c, name: e.n, n: e.p, max: e.m, lan: e.l || null });
      list.sort((a, b) => a.name < b.name ? -1 : 1);
      onList(up ? list.slice(0, 20) : tried >= NET.ROOM_BROKERS.length ? null : []);
    };
    const Ms = NET.ROOM_BROKERS.map(b => {
      const M = mqtt(b, {});
      M.onMsg = (topic, payload) => {
        const c = topic.slice(topicBase().length); if (!/^[A-Z2-9]{5}$/.test(c)) return;
        if (!payload) { rooms.delete('R' + c); rooms.delete('L' + c); return emit(); }
        let e; try { e = JSON.parse(payload); } catch (er) { return; }
        if (!e || e.c !== c) return;
        const lan = e.r === 'lan' && lanOK(e.l); if (e.r !== url && !lan) return; // 只认和自己同一个中继的，或者本地中转（局域网地址）
        // 本地中转和中继的条目分开存：伪造的本地中转条目顶不掉同一个房间码的真房间
        rooms.set((lan ? 'L' : 'R') + c, { c, n: String(e.n || '?').slice(0, 16), p: Math.max(1, e.p | 0), m: Math.min(4, Math.max(2, e.m | 0 || 4)), t: +e.t || 0, l: lan ? e.l.slice() : null }); emit();
      };
      M.onUp = () => { up++; emit(); };
      M.onDown = was => { if (was) up--; else tried++; emit(); };
      M.sub(topicBase() + '+');
      return M;
    });
    const tick = setInterval(emit, 5000); // 过期的去掉
    setTimeout(() => { if (!up) { tried = NET.ROOM_BROKERS.length; emit(); } }, 8000);
    W.close = () => { W.closed = true; clearInterval(tick); for (const M of Ms) M.close(); };
    return W;
  };

  // ── 房主：把自己的房间挂上去
  NET.roomAnnounce = function (url, opt) {
    const A = { entry: null, Ms: [] }, lan = opt && lanOK(opt.lan) ? opt.lan : null;
    if (!lan && !useMqtt(url)) { A.set = () => {}; A.clear = () => {}; A.close = () => {}; return A; } // 本机中继、又没有局域网地址：大家问中继
    let timer = null, topic = null, last = '';
    const pub = force => {
      if (!A.entry) return;
      const j = JSON.stringify(Object.assign({}, A.entry, lan ? { r: 'lan', l: lan } : { r: url }, { t: Date.now() }));
      const key = JSON.stringify(A.entry); if (!force && key === last) return; last = key;
      for (const M of A.Ms) M.pub(topic, j, true);
    };
    A.set = function (e) {
      if (!topic) {
        topic = topicBase() + e.c;
        A.Ms = NET.ROOM_BROKERS.map(b => { const M = mqtt(b, { will: { topic, payload: '' } }); M.onUp = () => { last = ''; pub(true); }; return M; });
        timer = setInterval(() => pub(true), NET.ROOM_EVERY);
      }
      A.entry = { c: e.c, n: e.n, p: e.p, m: e.m }; pub(false);
    };
    A.clear = () => { A.entry = null; last = ''; if (topic) for (const M of A.Ms) M.pub(topic, '', true); };
    A.close = async () => { clearInterval(timer); A.clear(); await Promise.all(A.Ms.map(M => M.flush())); for (const M of A.Ms) M.close(); };
    return A;
  };
})(D);
