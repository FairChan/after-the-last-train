/* 末班之后 · 多人联机：传输层（design/features/multiplayer §4.2）
   一条连接 = { send(msg, unreliable), on(fn), close(), open }；玩法代码不知道下面是哪一种：
   - NET.loopPair(opt)：同一个网页里的两头（一键测试、本机分屏）。消息照样 JSON 来回（和真网络一样拷一份）；
       opt.lat 秒延迟、opt.drop 丢掉多少"不要求可靠"的消息（快照、输入）；opt.burst：每条消息有这么大机会卡住 0.3–1.5 秒，后面的排在它后面一起到（像远处中继走 TCP 那样一阵一阵的）。延迟按 NET.pump(dt) 走，不看真时间（?manual=1 也能测）
   - NET.relay(url, …)：WebSocket 中继（net/relay-client.js，MP2）
   - 以后：WebRTC、Steam 换掉这一层就行 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {};
  let clock = 0; const pending = [];
  // 延迟送达：每步调一次（房主那一步里）
  NET.pump = function (dt) {
    clock += dt || 0;
    for (let i = 0; i < pending.length;) { const m = pending[i]; if (m.at <= clock + 1e-9) { pending.splice(i, 1); m.go(); } else i++; }
  };
  NET.loopPair = function (opt) {
    opt = opt || {}; const rng = D.rng ? D.rng('loop:' + (opt.seed || 0)) : Math.random;
    const mk = name => {
      const c = { name, open: true, fns: [], stats: { out: 0, bytes: 0, dropped: 0 } };
      c.on = fn => { c.fns.push(fn); };
      c.send = (msg, unrel) => {
        if (!c.open || !c.peer.open) return;
        const s = JSON.stringify(msg); c.stats.out++; c.stats.bytes += s.length;
        if (unrel && opt.drop && rng() < opt.drop) { c.stats.dropped++; return; }
        const go = () => { if (c.peer.open) for (const f of c.peer.fns) f(JSON.parse(s)); };
        if (opt.lat) { c.lastAt = Math.max(c.lastAt || 0, clock + opt.lat * (0.8 + 0.4 * rng()) + (opt.burst && rng() < opt.burst ? 0.3 + 1.2 * rng() : 0)); pending.push({ at: c.lastAt, go }); } else go(); // 有抖动，但不乱序（和 WebSocket 一样）
      };
      c.close = () => { if (!c.open) return; c.open = false; for (const f of c.peer.fns) f({ k: 'closed' }); };
      return c;
    };
    const a = mk('a'), b = mk('b'); a.peer = b; b.peer = a;
    return [a, b];
  };
})(D);
