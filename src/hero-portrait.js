/* Underdog · 首页立绘、机库转台的主角：照游戏里的画法画（用户 2026-11-17："原来的版本太丑了，还是游戏里的比较好看"）。
   原来首页、机库各自从图集裁一帧直接放大：没有轮廓光、没有发光、没有后期，首页的披风还画得比人还大。
   现在和游戏里画主角一模一样（draw.js 的 body + drawPlayer 待机那一路）：
     披风后层 → 机身（heroBlit）→ 发光层（机身 0.16 的辉光、冷色轮廓光、护目镜）→ 披风前层，披风用 cape.js 的同一块布（K.scarf 算、D.drawCape 画）；
   先在一张小画布上按游戏里的比例画（1 世界单位 = 2 像素，和 640×360 的游戏画面同一个像素大小），
   再走一遍和 gfx.js Post 一样的后期：抖动光照（灯在左上）、发光层叠上去、缩小两级再放大的泛光；最后整数倍放大贴到界面的画布上。
   用法：const P = D.heroPortrait();（每个画布一个，披风的物理状态存在里面）
         P.draw(ctx, { k, mods, tint, visor, dir, t, dt, up, fx, fy, alpha })  —— fx / fy 是脚底在目标画布上的位置，up 是放大倍数。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const IDLE = ['idle1', 'idle2', 'idle3', 'idle4', 'idle5', 'idle6', 'idle7', 'idle8'];
  const DIR_OF = [6, 7, 8, 1, 2, 3, 4, 5]; // 和 draw.js 一样：瞄准角每 45° 一档对应图集的朝向
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const VW = 80, VH = 96, PX = 40, PY = 78; // 小画布（游戏像素）；脚底在 (PX, PY)，四周留够披风和泛光
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };

  // 光照图：环境光 + 左上一盏暖白的灯，量化成几级、边上棋盘格抖动（和 Post.render 一样的做法）
  let LIGHT = null;
  function light() {
    if (LIGHT) return LIGHT;
    const [c, x] = mk(VW, VH);
    x.fillStyle = '#30344e'; x.fillRect(0, 0, VW, VH); // 环境光：比游戏里的站台（#1c1e36 左右）亮一点，界面上要看得清
    x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(PX - 22, PY - 34, 0, PX - 22, PY - 34, 80);
    g.addColorStop(0, 'rgba(255,226,190,0.8)'); g.addColorStop(0.45, 'rgba(255,226,190,0.36)'); g.addColorStop(1, 'rgba(255,226,190,0)');
    x.fillStyle = g; x.fillRect(0, 0, VW, VH);
    const id = x.getImageData(0, 0, VW, VH), d = id.data, LV = 6;
    for (let yy = 0, p = 0; yy < VH; yy++) for (let xx = 0; xx < VW; xx++, p += 4) {
      const t = BAYER[((yy & 3) << 2) | (xx & 3)];
      for (let i = 0; i < 3; i++) d[p + i] = Math.min(255, Math.floor(d[p + i] / 255 * LV + t) / LV * 255);
    }
    x.putImageData(id, 0, 0);
    return (LIGHT = c);
  }

  D.heroPortrait = function () {
    const [base, bx] = mk(VW, VH), [emit, ex] = mk(VW, VH), [lit, lx] = mk(VW, VH), [s1, sx1] = mk(VW >> 2, VH >> 2), [s2, sx2] = mk(VW >> 3, VH >> 3);
    sx1.imageSmoothingEnabled = true; sx2.imageSmoothingEnabled = true;
    const p = { x: PX / 2, y: PY / 2, aim: 0, vx: 0, vy: 0 }, S = { t: 0, dt: 1 / 60, f: 0, SH: { scale: 1 }, raid: { sup: 0 }, player: p };
    let capeKey = '';
    // 披风：换型号（大小不同）或者第一次画时重新挂上，先空跑一秒让布垂下来，不然一出来就在甩
    function cape(k, dt) {
      if (!D.K || !D.K.scarf) return;
      if (capeKey !== k) { capeKey = k; p.cape = null; for (let i = 0; i < 60; i++) { S.dt = 1 / 60; S.t += 1 / 60; D.K.scarf(S, p); } }
      S.dt = dt; D.K.scarf(S, p);
    }
    return {
      // 画上了返回 true；图集还没生成好返回 false（下一帧再画）
      draw(x, o) {
        const k = o.k, H = D.heroOf ? D.heroOf(k, o.mods || null, IDLE) : D.HERO, dir = o.dir || 6;
        if (!H || !H.ready || !H.meta['idle' + dir]) return false;
        const SHL = D.SHELLS[k] || {}, sc = SHL.scale || 1, V = H.variant(o.tint, o.visor), list = H.meta['idle' + dir], slot = list[Math.floor((o.t || 0) * 10) % list.length];
        S.t = o.t || 0; S.SH = { scale: sc }; p.aim = DIR_OF.indexOf(dir) * Math.PI / 4;
        cape(k + '|' + sc, Math.min(1 / 30, Math.max(0, o.dt || 1 / 60)));
        // 1. 和游戏里一样画：底层（颜色）、发光层（辉光、轮廓光、护目镜）
        for (const g of [bx, ex]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, VW, VH); g.setTransform(2, 0, 0, 2, 0, 0); }
        const cp = (layer, withEx) => D.drawCape && D.drawCape(bx, withEx ? ex : null, S, p, 0, layer);
        cp('back');
        D.heroBlit(bx, V.img, H, slot, p.x, p.y + 1, null, sc);
        D.heroBlit(ex, V.img, H, slot, p.x, p.y + 1, 0.16, sc);
        if (H.rim) D.heroBlit(ex, H.rim, H, slot, p.x, p.y + 1, 0.5, sc);
        D.heroBlit(ex, V.emit, H, slot, p.x, p.y + 1, null, sc);
        cp('front', true);
        // 2. 光照：只照在人身上（乘完再按人的形状抠一遍，透明的地方不留光）
        lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.clearRect(0, 0, VW, VH); lx.drawImage(base, 0, 0);
        lx.globalCompositeOperation = 'multiply'; lx.drawImage(light(), 0, 0);
        lx.globalCompositeOperation = 'lighter'; lx.globalAlpha = 0.16; lx.drawImage(light(), 0, 0); lx.globalAlpha = 1;
        lx.globalCompositeOperation = 'destination-in'; lx.drawImage(base, 0, 0); lx.globalCompositeOperation = 'source-over';
        // 3. 泛光：发光层缩小两级
        sx1.clearRect(0, 0, VW >> 2, VH >> 2); sx1.drawImage(emit, 0, 0, VW >> 2, VH >> 2);
        sx2.clearRect(0, 0, VW >> 3, VH >> 3); sx2.drawImage(s1, 0, 0, VW >> 3, VH >> 3);
        // 4. 整数倍放大贴上去
        const up = o.up || 2, a = o.alpha == null ? 1 : o.alpha, dx = Math.round(o.fx - PX * up), dy = Math.round(o.fy - PY * up), dw = VW * up, dh = VH * up;
        x.save(); x.imageSmoothingEnabled = false; x.globalAlpha = a;
        x.drawImage(lit, dx, dy, dw, dh);
        x.globalCompositeOperation = 'lighter'; x.drawImage(emit, dx, dy, dw, dh);
        x.imageSmoothingEnabled = true; x.globalAlpha = a * 0.9; x.drawImage(s1, dx, dy, dw, dh); x.globalAlpha = a * 0.8; x.drawImage(s2, dx, dy, dw, dh);
        x.restore();
        return true;
      },
    };
  };
})(D);
