/* 末班之后 · 多人联机 MP6：WebRTC 直连（design/features/multiplayer §4.2 第二版）
   中继只做"牵线"：房主和队友通过已有的中继连接交换 offer / answer / ICE，之后两条 DataChannel 直连：
     'r' 要送到、按顺序（事件、操作、背包、关键帧）；'u' 不重发、不排队（快照、输入）——丢了就丢了，下一条会盖上。
   连上以后同一条 conn 的 send 改走直连，收到的消息照样交给原来的处理函数；8 秒连不上、或者直连断了，自动退回中继。
   ICE：默认带几个公共 STUN（2026-11-19：用户那边到北京中继往返 550 毫秒，必须直连；只用本机地址在他的网络连不上）。
   STUN 只告诉本机"你在外面看起来是哪个地址"，游戏数据不经过它。?stun=stun:地址:端口（或 localStorage 'underdog.mp.stun'）换成自己的；?stun=none 不用。
   conn.via = 'relay' | 'rtc'（大厅里显示"直连 / 中继"）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {};
  NET.RTC_TIMEOUT = 15000; // 牵线的消息走中继，远的时候一来一回要半秒多
  NET.STUN = ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302', 'stun:stun.miwifi.com:3478'];
  NET.rtcOK = () => typeof RTCPeerConnection !== 'undefined' && !NET.rtcOff;
  function ice() {
    let s = null; try { s = new URLSearchParams(location.search).get('stun') || localStorage.getItem('underdog.mp.stun'); } catch (e) {}
    if (s === 'none') return [];
    return s ? [{ urls: s }] : [{ urls: NET.STUN }];
  }
  // 把一条中继连接升级：pc 建好、两条通道都开了才换路
  function upgrade(conn, pc, isHost) {
    const st = conn.stats || (conn.stats = {}); conn.via = 'relay'; st.rtcOut = 0; st.rtcIn = 0;
    const ch = {}, send0 = conn.send;
    const ready = () => ch.r && ch.u && ch.r.readyState === 'open' && ch.u.readyState === 'open';
    const onCh = c => {
      ch[c.label] = c;
      c.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } st.rtcIn++; for (const f of conn.fns) f(m); };
      c.onopen = () => { if (ready()) { conn.via = 'rtc'; clearTimeout(t); if (conn.onVia) conn.onVia('rtc'); } };
      c.onclose = () => { if (conn.via === 'rtc') { conn.via = 'relay'; if (conn.onVia) conn.onVia('relay'); } };
    };
    conn.send = function (msg, unrel) {
      if (conn.via === 'rtc' && ready()) { const c = unrel ? ch.u : ch.r; try { const s = JSON.stringify(msg); if (unrel && c.bufferedAmount > 256 * 1024) { st.dropped = (st.dropped || 0) + 1; return; } c.send(s); st.rtcOut++; st.out = (st.out || 0) + 1; st.bytes = (st.bytes || 0) + s.length; return; } catch (e) { /* 退回中继 */ } }
      return send0.apply(this, arguments);
    };
    const close0 = conn.close; conn.close = function () { try { pc.close(); } catch (e) {} return close0.apply(this, arguments); };
    pc.onicecandidate = ev => { if (ev.candidate) send0.call(conn, { k: 'rtc-ice', c: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate }); };
    pc.ondatachannel = ev => onCh(ev.channel);
    pc.onconnectionstatechange = () => { if (/failed|closed|disconnected/.test(pc.connectionState) && conn.via === 'rtc') { conn.via = 'relay'; if (conn.onVia) conn.onVia('relay'); } };
    const t = setTimeout(() => { if (conn.via !== 'rtc') { conn.rtcFail = 'timeout'; try { pc.close(); } catch (e) {} } }, NET.RTC_TIMEOUT);
    // 牵线的消息走中继（conn.on 收到所有消息，游戏那边不认 rtc-* 会跳过）
    const wait = []; let remote = false; // 对方的描述还没设好时先收着 ICE
    const flush = async () => { remote = true; for (const c of wait.splice(0)) { try { await pc.addIceCandidate(c); } catch (e) {} } };
    conn.on(async m => {
      if (!m || !m.k || m.k.slice(0, 4) !== 'rtc-') return;
      try {
        if (m.k === 'rtc-offer' && !isHost) { await pc.setRemoteDescription(m.sdp); await flush(); const a = await pc.createAnswer(); await pc.setLocalDescription(a); send0.call(conn, { k: 'rtc-answer', sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription }); }
        else if (m.k === 'rtc-answer' && isHost) { await pc.setRemoteDescription(m.sdp); await flush(); }
        else if (m.k === 'rtc-ice' && m.c) { if (remote) await pc.addIceCandidate(m.c); else wait.push(m.c); }
      } catch (e) { conn.rtcFail = String(e && e.message || e); }
    });
    return { pc, onCh };
  }
  // 房主：对一个队友发起
  NET.rtcHost = async function (conn) {
    if (!NET.rtcOK() || conn.rtc) return; conn.rtc = true;
    try {
      const pc = new RTCPeerConnection({ iceServers: ice() }), up = upgrade(conn, pc, true);
      up.onCh(pc.createDataChannel('r', { ordered: true }));
      up.onCh(pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 }));
      const o = await pc.createOffer(); await pc.setLocalDescription(o);
      conn.send({ k: 'rtc-offer', sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription });
    } catch (e) { conn.rtcFail = String(e && e.message || e); }
  };
  // 队友：等房主的 offer
  NET.rtcClient = function (conn) {
    if (!NET.rtcOK() || conn.rtc) return; conn.rtc = true;
    try { upgrade(conn, new RTCPeerConnection({ iceServers: ice() }), false); } catch (e) { conn.rtcFail = String(e && e.message || e); }
  };
})(D);
