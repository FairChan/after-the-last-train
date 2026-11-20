/* Underdog · 小样二：上下楼过渡（试玩反馈第 5 轮）。
   往下：上面这层放大、变淡（被留在头顶），下面这层从稍小、全黑慢慢浮现；往上反过来。0.7 秒。
   station.js 的 goFloor 换层前调 D.floorFx 记下方向；换层后第一次画的时候，画布上还是旧楼层的最后一帧，先拍下来，
   之后每帧先照常画新楼层，再把两张图按进度叠起来。过渡期间人无敌，新楼层的敌人这一会儿不出手。
   设计：design/试玩反馈-5-车站场景.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const DUR = 0.7;
  D.FLOOR_FX = DUR;
  D.floorFx = function (S, from, to, dir) {
    if (from === to || !S.floors) return;
    const down = dir ? dir === 'down' : to > from;
    S.floorFx = { need: true, down, from, to, t0: null };
    S.player.inv = Math.max(S.player.inv, DUR + 0.25);
    for (const e of S.enemies) if (!e.dead && e.f === to) { e.cd = Math.max(e.cd, DUR + 0.3); e.tele = 0; e.act = null; }
  };
  let buf = null;
  const scratch = (w, h) => { if (!buf || buf.width !== w || buf.height !== h) { buf = D.canvas(w, h)[0]; } return buf; };
  const drawScaled = (ctx, img, s, W, H) => { const w = W * s, h = H * s; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); };
  const ds0 = D.drawStation;
  D.drawStation = function (ctx, S, time) {
    const fx = S.floorFx;
    if (fx && fx.need) { // 画布上还是旧楼层的最后一帧
      fx.need = false; const c = ctx.canvas; fx.snap = D.canvas(c.width, c.height)[0]; fx.snap.getContext('2d').drawImage(c, 0, 0); fx.t0 = time;
    }
    const r = ds0.apply(this, arguments);
    if (!fx || !fx.snap) return r;
    const k = Math.min(1, Math.max(0, (time - fx.t0) / DUR)); if (k >= 1) { S.floorFx = null; return r; }
    const e = k * k * (3 - 2 * k), c = ctx.canvas, W = c.width, H = c.height, now = scratch(W, H), nx = now.getContext('2d');
    nx.globalCompositeOperation = 'copy'; nx.drawImage(c, 0, 0); nx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1; ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = e; drawScaled(ctx, now, fx.down ? 0.9 + 0.1 * e : 1.12 - 0.12 * e, W, H); // 新楼层浮现
    ctx.globalAlpha = (1 - e) * (1 - e); drawScaled(ctx, fx.snap, fx.down ? 1 + 0.16 * e : 1 - 0.1 * e, W, H); // 旧楼层退开、消失
    ctx.restore();
    return r;
  };
})(D);
