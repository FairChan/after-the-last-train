/* 末班之后 · 多人联机：接进主循环（main.js 的 G.net）
   G.net = { role: 'host' | 'client', stepStation(S, dt, inp), draw?(ctx, time) }；单人时 G.net = null，一行网络代码都不走。
   本机分屏（MP1，开发用）：地址加 ?mp=2 → 进站时同一个网页里多开一个"队友"（Loopback 连接），
     左半边是你（键盘 + 鼠标），右半边是队友（手柄；没手柄就用 I J K L 走、O 开枪、U 闪避、H 交互，自动瞄最近的敌人）。
     ?mp=2&lat=120&drop=0.2：模拟 120 毫秒延迟、丢两成快照；&burst=0.02：偶尔卡一下、后面的一起到（远处中继那样）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {};
  const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');

  // ── 房主这一步：发出去的消息按延迟送到、走全队；本机分屏时顺带走队友那边
  NET.hostSession = function (H, extra) {
    return Object.assign({ role: 'host', H, stepStation(S, dt, inp) { NET.pump(dt); H.step(S, dt, inp); if (this.after) this.after(S, dt); } }, extra || {});
  };
  NET.clientSession = function (CL, extra) {
    return Object.assign({ role: 'client', CL, stepStation(S, dt, inp) { NET.pump(dt); CL.step(S, dt, inp); } }, extra || {});
  };

  // ── 本机分屏：第二个人的输入（手柄 0 号；没有就键盘 IJKL）
  function padInput(S) {
    const I = D.Input, k = I.keys, gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(Boolean), p = S.player, inp = { mx: 0, my: 0 };
    const dz = v => (Math.abs(v) < 0.2 ? 0 : v);
    let aim = null;
    if (gp) {
      inp.mx = dz(gp.axes[0] || 0); inp.my = dz(gp.axes[1] || 0);
      const ax = dz(gp.axes[2] || 0), ay = dz(gp.axes[3] || 0); if (ax || ay) aim = Math.atan2(ay, ax);
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), was = padInput.was || (padInput.was = []), hit = i => { const v = b(i); const r = v && !was[i]; was[i] = v; return r; };
      inp.fire = b(7); inp.meleeHeld = b(6); inp.melee = hit(6); inp.dash = hit(0); inp.interact = hit(2); inp.interactHeld = b(2); inp.reload = hit(3); inp.heal = hit(4); inp.nade = hit(5);
    } else {
      inp.mx = (k.KeyL ? 1 : 0) - (k.KeyJ ? 1 : 0); inp.my = (k.KeyK ? 1 : 0) - (k.KeyI ? 1 : 0);
      inp.fire = !!k.KeyO; inp.dash = I.hit('KeyU'); inp.interact = I.hit('KeyH'); inp.interactHeld = !!k.KeyH;
    }
    if (aim == null) { // 自动瞄：最近的敌人，没有就看走的方向
      let best = null, bd = 220; for (const e of S.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
      aim = best ? Math.atan2(best.y - 6 - (p.y - 6), best.x - p.x) : inp.mx || inp.my ? Math.atan2(inp.my, inp.mx) : p.aim || 0;
    }
    inp.ax = p.x + Math.cos(aim) * 60; inp.ay = p.y - 6 + Math.sin(aim) * 60;
    return inp;
  }
  // 分屏画：两份画面各取中间一半
  let bufs = null;
  function splitDraw(G, CL, ctx, time) {
    const W = D.W, H = D.H; if (!bufs) bufs = [D.canvas(W, H), D.canvas(W, H)];
    D.drawStation(bufs[0][1], G.S, time); D.drawStation(bufs[1][1], CL.S, time);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bufs[0][0], W / 4, 0, W / 2, H, 0, 0, W / 2, H);
    ctx.drawImage(bufs[1][0], W / 4, 0, W / 2, H, W / 2, 0, W / 2, H);
    ctx.fillStyle = '#0b0a14'; ctx.fillRect(W / 2 - 1, 0, 2, H);
    if (D.text) { D.text(ctx, 'P1', 8, H - 14, '#8fe8ff'); D.text(ctx, 'P2', W / 2 + 8, H - 14, '#ffd860'); }
  }
  // ── ?mp=2：进站时开一个本机队友
  NET.devSplit = function (G) {
    const lat = +(qs.get('lat') || 0) / 1000, drop = +(qs.get('drop') || 0), burst = +(qs.get('burst') || 0);
    const [a, b] = NET.loopPair({ lat, drop, burst });
    const H = NET.Host({ name: 'P1' });
    const pf2 = D.newProfile((G.pf && G.pf.seed || 'LANCHUAN') + ':P2'); pf2.tut = 1;
    const R2 = D.startRaid(pf2, pf2.city.home);
    const CL = NET.Client(b, { R: R2, name: 'P2', ui: false }); CL.noMouse = true;
    H.add(a); CL.hello(D.Save.serialize(pf2));
    NET.pump(1);
    const I = D.Input;
    G.net = NET.hostSession(H, {
      dev: true, CL,
      after(S, dt) { if (!CL.S) return; const wx = I.wx, wy = I.wy; CL.step(CL.S, dt, padInput(CL.S)); CL.S.events.length = 0; I.wx = wx; I.wy = wy; },
      draw(ctx, time) { if (CL.S) splitDraw(G, CL, ctx, time); else D.drawStation(ctx, G.S, time); },
    });
    return G.net;
  };
  // 挂到 G.enter：每进一站，房主把队友放进来
  function hookEnter() {
    const G = D.Game; if (!G || G.__mpHook) return; G.__mpHook = true;
    const en0 = G.enter;
    G.enter = function () {
      const r = en0.apply(this, arguments);
      if (qs.get('mp') === '2' && G.mode === 'station' && G.S && !G.S.tut && (!G.net || G.net.dev)) { if (!G.net) NET.devSplit(G); G.net.H.begin(G.S, G); NET.pump(1); }
      else if (G.net && G.net.role === 'host' && G.mode === 'station' && G.S && !G.S.tut) { G.net.H.begin(G.S, G); if (NET.onHostEnter) NET.onHostEnter(G); }
      return r;
    };
  }
  NET.wrapOps();
  hookEnter();
  NET.cl = null; // 本机是队友时 = 那个 NET.Client（背包、箱子的操作照着发给房主）
})(D);
