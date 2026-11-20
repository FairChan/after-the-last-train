/* 末班之后 · 多人联机：连中继（server/relay.mjs）
   NET.relayHost(url, name) → Promise<RH>：建房间，拿到房间码；每来一个人给一条连接（conn，和 Loopback 的一样用）
   NET.relayJoin(url, code, name, token) → Promise<{ conn, id, token }>：用房间码加入，conn 是通往房主的连接
   NET.relayWatch(url, onList) → { close }：本地联机，列出同一个 Wi-Fi 里的房间
   出错时 Promise 拒绝，错误是代码（'noroom' | 'full' | 'started' | 'ver' | 'net'），文案在 ui-lobby.js */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {};
  // 公网中继（阿里云，server/README.md "已部署"）：GitHub Pages 这种只放网页、不跑中继的网站，都连它
  NET.PUBLIC_RELAY = 'wss://39.105.228.216/';
  NET.isStaticHost = h => /(^|\.)github\.io$/i.test(String(h || ''));
  // 本地中转：房主自己电脑上跑的中继（server/本地中转.bat）。GitHub 网站连它要浏览器允许"访问本地网络"
  NET.LOCAL_RELAY = 'ws://localhost:8787/';
  // 默认的中继地址：GitHub Pages 上连公网中继；网页本身是中继发出来的（--static）就连同一个地址；不然连本机
  NET.defaultRelay = function () {
    try { const l = location; if (NET.isStaticHost(l.hostname)) return NET.PUBLIC_RELAY; if (l.protocol === 'http:' || l.protocol === 'https:') return (l.protocol === 'https:' ? 'wss://' : 'ws://') + l.host + '/'; } catch (e) {}
    return 'ws://localhost:8787/';
  };
  function open(url) {
    return new Promise((res, rej) => {
      let ws; try { ws = new WebSocket(url); } catch (e) { rej('net'); return; }
      const t = setTimeout(() => { try { ws.close(); } catch (e) {} rej('net'); }, 6000);
      ws.onopen = () => { clearTimeout(t); res(ws); };
      ws.onerror = () => { clearTimeout(t); rej('net'); };
    });
  }
  // 一条走中继的连接：发给 id 那个人
  function mkConn(ws, id) {
    const c = { id, open: true, via: 'relay', fns: [], stats: { out: 0, bytes: 0, dropped: 0 } };
    c.on = fn => { c.fns.push(fn); };
    c.send = msg => { if (!c.open || ws.readyState !== 1) return; const s = JSON.stringify({ t: 'to', id, d: msg }); c.stats.out++; c.stats.bytes += s.length; ws.send(s); };
    c.emit = m => { for (const f of c.fns) f(m); };
    c.close = () => { if (!c.open) return; c.open = false; c.emit({ k: 'closed' }); };
    return c;
  }
  NET.relayHost = async function (url, name) {
    const ws = await open(url);
    return new Promise((res, rej) => {
      const RH = { ws, code: null, token: null, peers: new Map(), onPeer: null, onLeft: null, onDown: null };
      RH.lock = () => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'lock' }));
      RH.unlock = () => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'unlock' }));
      RH.close = () => { try { ws.close(); } catch (e) {} };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'room') { RH.code = m.code; RH.token = m.token; RH.lan = Array.isArray(m.lan) ? m.lan : []; res(RH); }
        else if (m.t === 'peer') { const old = RH.peers.get(m.id); if (old) old.open = false; const c = mkConn(ws, m.id); RH.peers.set(m.id, c); if (RH.onPeer) RH.onPeer(c, m); }
        else if (m.t === 'from') { const c = RH.peers.get(m.id); if (c) c.emit(m.d); }
        else if (m.t === 'left') { const c = RH.peers.get(m.id); if (c) { c.open = false; c.emit({ k: 'closed' }); } if (RH.onLeft) RH.onLeft(m.id); }
        else if (m.t === 'err') rej(m.why);
      };
      ws.onclose = () => { for (const c of RH.peers.values()) if (c.open) { c.open = false; c.emit({ k: 'closed' }); } if (RH.onDown) RH.onDown(); };
      ws.send(JSON.stringify({ t: 'host', v: NET.VERSION, name }));
    });
  };
  // 本地联机：看"附近的房间"（中继按公网地址认同一个 Wi-Fi，server/relay.mjs 的 list）。每 2 秒问一次，onList(list) 每次回话都调；
  // 旧中继不认 list：连上 5 秒还没回话调 onList(null, 'old')。连不上 / 断了调 onList(null)，过一会儿自己重连（3 秒起，一直连不上就越等越久，最多 30 秒）。返回 { url, close }。
  NET.LIST_EVERY = 2000;
  NET.relayWatch = function (url, onList) {
    const W = { url, closed: false, ws: null, timer: null, back: 3000 };
    const retry = () => { onList(null); W.timer = setTimeout(go, W.back); W.back = Math.min(30000, W.back * 2); };
    const ask = () => { const ws = W.ws; if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'list', v: NET.VERSION })); };
    const go = async () => {
      if (W.closed) return;
      let ws; try { ws = await open(url); } catch (e) { if (!W.closed) retry(); return; }
      if (W.closed) { try { ws.close(); } catch (e) {} return; }
      W.ws = ws; W.back = 3000;
      let heard = false; const old = setTimeout(() => { if (!heard && !W.closed) onList(null, 'old'); }, 5000);
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'rooms' && !W.closed) { heard = true; onList(Array.isArray(m.list) ? m.list : []); } };
      ws.onclose = () => { clearInterval(W.iv); clearTimeout(old); if (W.closed) return; retry(); };
      ask(); W.iv = setInterval(ask, NET.LIST_EVERY);
    };
    W.close = () => { W.closed = true; clearTimeout(W.timer); clearInterval(W.iv); if (W.ws) try { W.ws.close(); } catch (e) {} };
    go(); return W;
  };
  NET.relayJoin = async function (url, code, name, token) {
    const ws = await open(url);
    return new Promise((res, rej) => {
      const conn = mkConn(ws, 0); let done = false;
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'joined') { done = true; res({ conn, id: m.id, token: m.token, code: m.code, ws }); }
        else if (m.t === 'err') { try { ws.close(); } catch (e) {} rej(m.why); }
        else if (m.t === 'from' && m.id === 0) conn.emit(m.d); // 只认房主发来的
        else if (m.t === 'hostgone') { conn.open = false; conn.emit({ k: 'closed', host: true }); }
      };
      ws.onclose = () => { if (!done) rej('net'); else if (conn.open) { conn.open = false; conn.emit({ k: 'closed' }); } };
      ws.send(JSON.stringify({ t: 'join', code, v: NET.VERSION, name, token: token || undefined }));
    });
  };
})(D);
