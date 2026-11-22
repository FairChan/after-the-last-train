/* Underdog · 近战握持：主角手里真的拿着近战武器，每把长得不一样，按握法挥。
   1. 抠枪：主角图集每一帧都端着步枪（素材只有持枪动画）。拿近战的时候把伸出身体的那截枪管从这一帧上抠掉——
      从枪口（沿枪的朝向最远的像素）往回走，横截面细（≤ 6 像素）的算枪管，碰到粗的（手、身子）就停，停的地方就是双手 = 握点。
      断口补一圈黑边。每个图集每一帧只算一次，遮罩缓存在图集对象上（各型号、各改装件的图集都一样能用）。
   2. 手持贴图：每把近战一张（sprite.js 画板，2 倍精度、自动描黑边、刀光 / 灯 / 火标发光），刀尖朝右画、记下握把的位置，画的时候绕握点转。
   3. 握法 → 动作：slash 单手刀（挥过去、收势）、heavy 重家伙（往后一拉、抡大圈、慢慢收）、thrust 直刺（手往前送）、punch 拳套（左右手轮流出拳）、
      flail 软兵器（柄先走、头跟在后面甩，停下来垂着）、saw 链锯（端平、发动机抖）、shield 盾（顶在身前，盾击往前撞）、ring 轮刃（边挥边转）。
      蓄力时往后拉开、举盾时顶住、招牌重击有自己的姿势（旋风转圈、跳劈举过头顶、冲刺往前顶）。
   4. 架势：挥一下以后 0.9 秒内手里拿着近战；开枪马上收起，又是端枪。朝上（背对镜头）时武器画在身后。
   挂钩：draw.js 的 body() 调 D.MeleeHold.frame()（这一帧拿不拿近战）、.blit()（抠掉枪管的贴图）、.draw()（武器、手、刀光）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TAU = Math.PI * 2, R = D.RAMP, INK = '#0b0a14';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
  const eo = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3), eio = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const ad = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const alerp = (a, b, k) => a + ad(a, b) * k;

  // ── 1. 抠枪
  // 枪在各朝向里的指向（图集像素，y 朝下）；8（正对镜头）枪在身前，不用抠
  const BARREL = { 6: [1, 0], 5: [1, -0.5], 4: [0.15, -1], 3: [-1, -0.45], 2: [-1, 0], 1: [-1, 0.4], 7: [1, 0.6] };
  const REACH = { 7: 0.42, 1: 0.5 }; // 枪口只在上半身找（腿也是细的）
  const BACKS = { 3: 1, 4: 1, 5: 1 };
  function alphaOf(H) {
    if (H._alpha && H._alpha.src === H.img) return H._alpha;
    const im = H.img, w = im.width, h = im.height, [, x] = D.canvas(w, h); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    H._gun = {}; return (H._alpha = { a, w, h, src: im });
  }
  function dirOf(H, slot) {
    if (!H._dirs) { H._dirs = {}; for (const k in H.meta) { const d = +k.replace(/\D/g, ''); for (const s of H.meta[k]) H._dirs[s] = d; } }
    return H._dirs[slot] || 8;
  }
  function maskOf(H, slot) {
    const A = alphaOf(H), C = H._gun; if (C[slot] !== undefined) return C[slot];
    const fw = H.fw, fh = H.fh, ox = (slot % H.cols) * fw, oy = Math.floor(slot / H.cols) * fh;
    const op = (x, y) => x >= 0 && y >= 0 && x < fw && y < fh && A.a[(oy + y) * A.w + ox + x] === 1;
    const dir = dirOf(H, slot);
    let top = -1, bot = -1; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (op(x, y)) { if (top < 0) top = y; bot = y; }
    if (top < 0) return (C[slot] = null);
    let sx = 0, sn = 0; for (let y = top; y < top + 6; y++) for (let x = 0; x < fw; x++) if (op(x, y)) { sx += x; sn++; }
    const hx = sx / Math.max(1, sn), res = { dir, back: !!BACKS[dir], erase: null, ink: null, grip: [hx + 3, top + (bot - top) * 0.4] };
    const U = BARREL[dir]; if (!U) return (C[slot] = res);
    let ux = U[0], uy = U[1]; const n = Math.hypot(ux, uy); ux /= n; uy /= n; const vx = -uy, vy = ux;
    const lim = top + (REACH[dir] || 0.6) * (bot - top);
    let bt = -1e9, tx = 0, ty = 0;
    for (let y = 0; y < lim; y++) for (let x = 0; x < fw; x++) if (op(x, y)) { const t = x * ux + y * uy; if (t > bt) { bt = t; tx = x; ty = y; } }
    let cx = tx + 0.5, cy = ty + 0.5, stop = null; const mids = [];
    for (let s = 0; s < 45; s++) {
      const bx = cx - ux * s, by = cy - uy * s; let k0 = null;
      for (const k of [0, 1, -1, 2, -2]) if (op(Math.floor(bx + vx * k), Math.floor(by + vy * k))) { k0 = k; break; }
      if (k0 === null) { stop = [bx, by]; break; }
      let lo = k0, hi = k0;
      while (hi - lo < 12 && op(Math.floor(bx + vx * (hi + 1)), Math.floor(by + vy * (hi + 1)))) hi++;
      while (hi - lo < 12 && op(Math.floor(bx + vx * (lo - 1)), Math.floor(by + vy * (lo - 1)))) lo--;
      const m = (lo + hi) / 2;
      if (hi - lo + 1 > 6 && s > 2) { stop = [bx + vx * m, by + vy * m]; break; }
      cx += vx * m; cy += vy * m; mids.push([cx - ux * s, cy - uy * s]);
    }
    if (mids.length < 3) return (C[slot] = res);
    if (!stop) stop = mids[mids.length - 1];
    const ts = stop[0] * ux + stop[1] * uy, ax = mids[0][0], ay = mids[0][1], er = new Uint8Array(fw * fh);
    let any = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      if (!op(x, y)) continue;
      const t = (x + 0.5) * ux + (y + 0.5) * uy; if (t <= ts + 0.5) continue;
      if (Math.abs((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) <= 3.2) { er[y * fw + x] = 1; any++; }
    }
    if (!any) return (C[slot] = res);
    const [ec, ex] = D.canvas(fw, fh), [ic, ix] = D.canvas(fw, fh), ed = ex.createImageData(fw, fh), id = ix.createImageData(fw, fh);
    const body = (x, y) => op(x, y) && !er[y * fw + x];
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const i = y * fw + x; if (!er[i]) continue;
      ed.data[i * 4 + 3] = 255;
      if (body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1)) { id.data[i * 4] = 11; id.data[i * 4 + 1] = 10; id.data[i * 4 + 2] = 20; id.data[i * 4 + 3] = 255; } // 断口补黑边
    }
    ex.putImageData(ed, 0, 0); ix.putImageData(id, 0, 0);
    res.erase = ec; res.ink = ic; res.grip = dir === 4 ? [stop[0] - 1, stop[1] + 8] : [stop[0], stop[1]]; // 朝上：枪口在头顶，手在肩膀
    return (C[slot] = res);
  }
  // 和 draw.js 的 heroBlit 一样的位置，只是先抠掉枪管（inked：断口补黑边，只给本体那张图用）
  let scr = null;
  function blit(c, img, H, slot, x, y, alpha, sc, inked) {
    const M = maskOf(H, slot); if (!M || !M.erase) return D.heroBlit(c, img, H, slot, x, y, alpha, sc);
    sc = sc || 1; const fw = H.fw, fh = H.fh;
    if (!scr || scr[0].width !== fw || scr[0].height !== fh) scr = D.canvas(fw, fh);
    const [cv, g] = scr; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, fw, fh);
    g.drawImage(img, (slot % H.cols) * fw, Math.floor(slot / H.cols) * fh, fw, fh, 0, 0, fw, fh);
    g.globalCompositeOperation = 'destination-out'; g.drawImage(M.erase, 0, 0);
    g.globalCompositeOperation = 'source-over'; if (inked) g.drawImage(M.ink, 0, 0);
    const w = fw / 2 * sc, h = fh / 2 * sc;
    if (alpha != null) c.globalAlpha = alpha;
    c.drawImage(cv, 0, 0, fw, fh, Math.round((x - w / 2) * 2) / 2, Math.round((y - H.footY / 2 * sc) * 2) / 2, w, h);
    if (alpha != null) c.globalAlpha = 1;
  }

  // ── 2. 手持贴图：刀尖朝右，[宽, 高, 握点 x, 握点 y]（贴图像素，2 像素 = 1 世界单位），画板留 1 像素描边
  const blade = (p, x0, x1, y, w, ramp, o) => { // 一条刀身：上沿亮、下沿暗，尖头收窄；o.curve 往上翘的像素数，o.edge 刃口发光色
    o = o || {};
    for (let x = x0; x <= x1; x++) {
      const k = (x - x0) / Math.max(1, x1 - x0), lift = o.curve ? Math.round(o.curve * k * k) : 0, tip = x1 - x, ww = Math.min(w, tip + 1);
      for (let j = 0; j < ww; j++) { const v = j === 0 ? 0.95 : j === ww - 1 ? 0.3 : 0.7 - 0.25 * j / ww; p.set(x, y - lift + j, ramp[clamp(Math.floor(v * ramp.length), 0, ramp.length - 1)]); }
      if (o.edge && ww > 1 && (o.dash ? (x >> 1) % 2 === 0 : true) && x < x1 - 1 && x > x0 + 1) p.set(x, y - lift + ww - 1, o.edge, 1);
    }
  };
  const grip = (p, x0, x1, y, h, base, wrap) => { p.rect(x0, y, x1 - x0 + 1, h, base); if (wrap) for (let x = x0; x <= x1; x += 2) { p.px(x, y, wrap); p.px(x + 1, y + h - 1, wrap); } };
  const LOOK = {
    katana: { style: 'slash', size: [40, 9, 6, 4], paint: p => {
      grip(p, 2, 9, 3, 3, '#151a29', '#c8cdda'); p.rect(1, 3, 1, 3, '#e3c14a');
      p.box(10, 1, 2, 7, R.gold, { r: 0 }); p.rect(12, 3, 1, 3, '#e8b42e');
      blade(p, 13, 38, 3, 3, R.silver, { curve: 2, edge: '#ff3d8b', dash: true });
    } },
    plasma: { style: 'slash', size: [38, 10, 6, 4.5], paint: p => {
      p.box(1, 3, 10, 4, R.dark, { r: 1 }); p.rect(3, 4, 1, 1, '#3ee8ff', 1); p.rect(6, 4, 1, 1, '#3ee8ff', 1); p.box(10, 2, 2, 6, R.silver);
      for (let x = 12; x <= 36; x++) { const t = x > 33 ? 1 : 0; p.set(x, 3 + t, '#3ee8ff', 1); p.set(x, 4, '#e6fdff', 1); p.set(x, 5 - t, '#e6fdff', 1); p.set(x, 6 - t, '#1fa5c4', 1); }
    } },
    flameblade: { style: 'slash', size: [36, 10, 6, 4.5], fx: 'fire', paint: p => {
      grip(p, 1, 8, 4, 3, '#3b2018', '#a8653d'); p.box(9, 2, 3, 7, R.copper);
      blade(p, 12, 34, 3, 4, R.rust, { curve: 1 }); for (let x = 14; x < 33; x += 1) p.set(x, 6 - (x > 30 ? 1 : 0), x % 3 ? '#ff8a2e' : '#ffd84a', 1);
    } },
    bloodblade: { style: 'slash', size: [36, 11, 6, 5], paint: p => {
      grip(p, 1, 8, 4, 3, '#2a0a0e', '#8f1d26'); p.box(9, 2, 3, 8, R.dark);
      blade(p, 12, 34, 3, 4, R.red); for (let x = 14; x < 32; x += 3) { p.px(x, 7, '#5a1218'); p.px(x + 1, 7, '#2a0a0e'); }
      p.line(13, 5, 31, 5, '#ff3047', 1);
    } },
    timeblade: { style: 'slash', size: [36, 12, 7, 5.5], paint: p => {
      grip(p, 1, 7, 5, 2, '#1d0a22', '#a94db3'); p.ell(9.5, 5.5, 3.5, 3.5, R.gold, { spec: true }); p.px(9, 5, '#9b6bff', 1); p.px(10, 4, '#3a2606');
      blade(p, 13, 34, 4, 3, R.white, { edge: '#9b6bff', dash: true });
    } },
    toxblade: { style: 'slash', size: [32, 11, 6, 5], fx: 'drip', paint: p => {
      grip(p, 1, 7, 4, 3, '#141a0e', '#566a31'); p.box(8, 2, 2, 7, R.gunmetal); p.box(10, 1, 3, 3, R.glass); p.px(11, 2, '#8dff6a', 1);
      blade(p, 12, 30, 4, 3, R.olive, { curve: -2, edge: '#8dff6a' });
    } },
    daggers: { style: 'slash', dual: true, size: [20, 7, 4, 3], paint: p => {
      grip(p, 1, 5, 2, 3, '#20263b', '#5c3b8a'); p.rect(6, 1, 1, 5, '#b48cff'); blade(p, 7, 18, 2, 3, R.silver);
    } },
    baton: { style: 'slash', size: [28, 8, 6, 3.5], fx: 'zap', paint: p => {
      grip(p, 1, 8, 2, 4, '#0c0e17', '#2d3550'); p.rect(9, 2, 1, 4, '#ff3047'); p.box(10, 2, 14, 4, R.gunmetal, { r: 1 });
      p.rect(24, 1, 1, 2, '#ffe066', 1); p.rect(24, 5, 1, 2, '#ffe066', 1); p.rect(25, 1, 1, 1, '#fff3b0', 1); p.rect(25, 6, 1, 1, '#fff3b0', 1);
    } },
    chakram: { style: 'ring', size: [18, 18, 4, 9], paint: p => {
      p.ell(9, 9, 7.5, 7.5, R.silver, { spec: true }); p.disc(9, 9, 4.6, null);
      for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const d = Math.hypot(x + 0.5 - 9, y + 0.5 - 9); if (d < 4.6) p.col[y * 18 + x] = null; else if (d < 5.6) p.set(x, y, '#3ee8ff', 1); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; p.px(9 + Math.cos(a) * 8.4, 9 + Math.sin(a) * 8.4, '#eef1f8'); }
      p.rect(3, 8, 4, 2, '#3d4766');
    } },
    axe: { style: 'heavy', size: [34, 17, 5, 10], two: true, paint: p => {
      p.rect(1, 9, 26, 2, '#c82e3a'); p.rect(1, 9, 26, 1, '#f0535e'); p.rect(1, 9, 7, 2, '#151a29'); p.rect(2, 9, 1, 2, '#ffd84a'); p.rect(5, 9, 1, 2, '#ffd84a');
      p.box(22, 4, 6, 9, R.red, { r: 1 }); // 斧头
      for (let y = 1; y <= 8; y++) { const w = y < 3 ? 4 + y : 7; p.rect(28 - (w - 6), y, w - 4, 1, y === 1 ? '#ffffff' : '#c8cdda'); } p.rect(28, 2, 3, 6, '#eef1f8'); p.rect(31, 3, 1, 4, '#ffffff');
      p.line(23, 12, 24, 15, '#9aa1b4'); p.line(24, 12, 25, 15, '#666d80');
    } },
    shovel: { style: 'heavy', size: [34, 13, 6, 6], two: true, paint: p => {
      p.rect(1, 3, 5, 1, '#3d4766'); p.rect(1, 3, 1, 6, '#3d4766'); p.rect(1, 8, 5, 1, '#3d4766'); // D 形握把
      p.rect(5, 5, 18, 2, '#8c5d3c'); p.rect(5, 5, 18, 1, '#ad7a52');
      p.box(21, 1, 10, 11, R.olive, { r: 2 }); p.rect(30, 2, 2, 9, '#c8cdda'); p.px(23, 3, '#a7b06a'); p.px(23, 9, '#253017');
    } },
    scythe: { style: 'heavy', size: [42, 18, 8, 14], two: true, paint: p => {
      p.rect(1, 13, 33, 2, '#2f1d13'); p.rect(1, 13, 33, 1, '#6a442c'); p.rect(9, 11, 1, 3, '#4a2f1f'); p.rect(9, 11, 3, 1, '#4a2f1f');
      p.box(32, 11, 4, 5, R.gunmetal);
      for (let i = 0; i <= 20; i++) { const t = i / 20, x = 35 - 26 * t, y = 11 - 9 * Math.sin(t * Math.PI / 2) - 1 * t, w = Math.round(3 - 2 * t); for (let j = 0; j < w; j++) p.set(x, y + j, j === 0 ? '#eef1f8' : '#9aa1b4'); p.set(x, y + w, '#d0d8ff', 1); }
    } },
    icepick: { style: 'heavy', size: [28, 14, 5, 9], paint: p => {
      p.rect(1, 8, 19, 2, '#2d3342'); p.rect(1, 8, 19, 1, '#646e86'); grip(p, 1, 7, 8, 2, '#132a5a', '#5a92e8');
      p.box(18, 5, 4, 7, R.gunmetal); p.line(18, 5, 14, 2, '#646e86');
      for (let i = 0; i <= 8; i++) { const x = 21 + i * 0.6, y = 6 + i * 0.85; p.set(x, y, '#e6fbff', 1); p.set(x + 1, y, '#9fe9ff', 1); p.set(x + 1, y + 1, '#2f6e88'); }
    } },
    magnet: { style: 'heavy', size: [30, 18, 5, 9], fx: 'mag', two: true, paint: p => {
      p.rect(1, 8, 17, 2, '#20263b'); p.rect(1, 8, 17, 1, '#3d4766'); grip(p, 1, 6, 8, 2, '#0c0e17', '#ff3d8b');
      p.box(17, 2, 10, 14, R.red, { r: 3 });
      for (let y = 6; y <= 11; y++) for (let x = 21; x <= 27; x++) p.col[y * 30 + x] = null;
      p.box(24, 2, 4, 4, R.silver); p.box(24, 12, 4, 4, R.silver); p.px(27, 7, '#ff3d8b', 1); p.px(27, 10, '#ff3d8b', 1);
    } },
    blasthammer: { style: 'heavy', size: [32, 18, 5, 9], two: true, paint: p => {
      p.rect(1, 8, 20, 2, '#2d3342'); p.rect(1, 8, 20, 1, '#646e86'); for (let x = 1; x < 8; x += 2) p.rect(x, 8, 1, 2, '#ffd95c');
      p.box(19, 2, 10, 14, R.gunmetal, { r: 1 }); for (let y = 3; y < 15; y += 3) p.rect(28, y, 2, 2, '#eab52e');
      p.box(21, 0, 3, 3, R.red); p.box(25, 0, 3, 3, R.red); p.px(22, 8, '#ff5a2e', 1); p.px(25, 8, '#ff5a2e', 1);
    } },
    lance: { style: 'thrust', ext: 6, size: [46, 13, 6, 6], two: true, paint: p => {
      grip(p, 1, 9, 5, 3, '#3b2018', '#e3c14a');
      p.box(10, 1, 3, 11, R.gold, { r: 1 }); // 护手圆盘
      for (let x = 13; x <= 44; x++) { const h = Math.max(1, Math.round(5 * (1 - (x - 13) / 32))); for (let j = 0; j < h; j++) p.set(x, 6 - Math.floor(h / 2) + j, j === 0 ? '#ffffff' : j === h - 1 && h > 2 ? '#666d80' : (x + j) % 6 < 2 ? '#e8b42e' : '#c8cdda'); }
    } },
    drill: { style: 'thrust', ext: 4, size: [32, 13, 7, 6.5], fx: 'spin', frames: 2, paint: (p, f) => {
      p.box(1, 1, 13, 11, R.yellow, { r: 2 }); p.rect(3, 4, 9, 1, '#5a3e0d'); p.rect(3, 8, 9, 1, '#5a3e0d'); p.px(4, 2, '#ff3047', 1);
      for (let x = 14; x <= 30; x++) { const h = Math.max(1, Math.round(10 * (1 - (x - 14) / 17))); for (let j = 0; j < h; j++) { const y = 6 - Math.floor(h / 2) + j; p.set(x, y, ((x + y + f * 2) % 4) < 2 ? '#c8cdda' : '#666d80'); } }
    } },
    pile: { style: 'thrust', ext: 3, size: [32, 15, 6, 7], fx: 'pile', two: true, paint: p => {
      p.box(1, 1, 18, 13, R.gunmetal, { r: 1 }); for (let x = 3; x < 17; x += 4) { p.rect(x, 1, 2, 2, '#ffd95c'); p.rect(x + 2, 1, 2, 2, '#1d212c'); }
      p.rect(4, 6, 10, 3, '#2a1206'); p.rect(5, 7, 8, 1, '#ff7a2e', 1);
      p.box(19, 5, 8, 5, R.silver); p.box(26, 2, 4, 11, R.dark);
    } },
    chainsaw: { style: 'saw', size: [38, 14, 7, 7], fx: 'saw', frames: 2, paint: (p, f) => {
      p.box(1, 2, 14, 11, R.yellow, { r: 2 }); p.rect(3, 0, 8, 1, '#2d3342'); p.rect(3, 0, 1, 3, '#2d3342'); p.rect(10, 0, 1, 3, '#2d3342'); p.rect(4, 6, 6, 3, '#1d212c'); p.px(12, 4, '#ff7a2e', 1);
      p.box(15, 4, 21, 6, R.gunmetal, { r: 2 });
      for (let x = 15; x < 36; x++) { if ((x + f) % 2) { p.px(x, 3, '#c8cdda'); p.px(x, 10, '#949fb6'); } }
    } },
    whip: { style: 'flail', size: [14, 6, 3, 3], head: 'whiphead', chain: 'blades', len: 24, paint: p => { grip(p, 1, 9, 2, 3, '#3b2018', '#d9a85a'); p.rect(10, 1, 2, 5, '#e3c14a'); } },
    flail: { style: 'flail', size: [14, 6, 3, 3], head: 'ball', chain: 'links', len: 12, two: true, paint: p => { grip(p, 1, 11, 2, 3, '#4a2f1f', '#8c5d3c'); p.rect(11, 1, 2, 5, '#646e86'); } },
    nunchaku: { style: 'flail', size: [15, 6, 4, 3], head: 'stick', chain: 'links', len: 5, paint: p => { p.box(1, 2, 13, 3, R.cloth); p.rect(2, 2, 1, 3, '#ffd84a'); p.rect(11, 2, 1, 3, '#ffd84a'); } },
    gauntlet: { style: 'punch', ext: 6, size: [16, 14, 5, 7], fx: 'jet', paint: p => {
      p.box(1, 2, 13, 10, R.copper, { r: 3 }); for (let i = 0; i < 4; i++) p.box(11, 2 + i * 2.5, 4, 2, R.gold);
      p.rect(4, 5, 5, 2, '#ffb020', 1); p.rect(1, 9, 2, 2, '#ff7a2e', 1);
    } },
    claw: { style: 'punch', ext: 7, size: [28, 16, 4, 8], paint: p => {
      p.box(1, 5, 12, 6, R.gunmetal, { r: 1 }); p.px(4, 7, '#ffb020', 1); p.ell(13, 8, 3, 3, R.dark);
      p.line(14, 6, 20, 1, '#bd6d2c'); p.line(20, 1, 25, 3, '#e3975a'); p.line(15, 6, 21, 2, '#8c4a1c');
      p.line(14, 10, 20, 15, '#bd6d2c'); p.line(20, 15, 25, 13, '#e3975a'); p.line(15, 10, 21, 14, '#8c4a1c');
      p.line(16, 8, 23, 8, '#e3975a'); p.px(24, 8, '#ffb020', 1);
    } },
    riot: { style: 'shield', ext: 5, size: [9, 26, 1, 13], paint: p => {
      p.box(1, 1, 6, 24, R.blue, { r: 2 }); p.rect(6, 2, 2, 22, '#132a5a'); p.grad(2, 5, 3, 8, R.glass); p.rect(7, 3, 1, 20, '#7fb3ff', 1); p.rect(2, 16, 3, 1, '#9cc4ff'); p.rect(2, 19, 3, 1, '#9cc4ff');
    } },
  };
  // 软兵器的头（不随柄转）
  const HEADS = {
    ball: { size: [13, 13, 6.5, 6.5], paint: p => { p.ell(6.5, 6.5, 4.5, 4.5, R.gunmetal, { spec: true }); for (const [x, y] of [[6, 0], [6, 12], [0, 6], [12, 6], [2, 2], [10, 2], [2, 10], [10, 10]]) p.px(x, y, '#c8cdda'); p.px(5, 5, '#ff9a3a', 1); p.px(6, 6, '#ff9a3a', 1); } },
    whiphead: { size: [9, 7, 2, 3.5], paint: p => { for (let x = 1; x < 8; x++) { const h = Math.max(1, 5 - Math.abs(x - 3)); p.rect(x, 3.5 - h / 2, 1, h, x > 5 ? '#eef1f8' : '#c8cdda'); } p.px(7, 3, '#d9a85a', 1); } },
    stick: { size: [15, 6, 2, 3], paint: p => { p.box(1, 2, 13, 3, R.cloth); p.rect(3, 2, 1, 3, '#ffd84a'); p.rect(12, 2, 1, 3, '#ffd84a'); } },
  };
  const cache = {};
  const sprOf = (key, def, frame) => { const k = key + '|' + (frame || 0); if (!cache[k]) { const [w, h] = def.size; cache[k] = D.mkSprite(w, h, p => def.paint(p, frame || 0)); } return cache[k]; };
  D.MELEE_LOOK = LOOK;

  // ── 3. 姿势：u = 这一挥过了多少（0→1），s = 这一刀往哪边挥（swingDir），a = 准星方向，f = 朝右 1 / 朝左 -1
  const DUR = { slash: 0.3, heavy: 0.44, thrust: 0.32, punch: 0.26, flail: 0.4, saw: 0.22, shield: 0.32, ring: 0.32 };
  const REST = { slash: 0.75, heavy: 1.1, ring: 0.6, flail: 0.6 };
  const HOLD = 0.9;
  function pose(S, p, L, m, a, f) {
    const st = L.style, A = clamp((m.arc || 1.1) + 0.3, 1.0, 1.75), W = p.mSw, o = { ang: a, ext: 0, side: 0, smear: null, head: null, spin: 0 };
    const rest = REST[st] ? alerp(a, f > 0 ? REST[st] : Math.PI - REST[st], 0.75) : a + f * (st === 'thrust' || st === 'saw' ? 0.12 : 0); // 收势：刀尖朝前下方（往屏幕下方偏，不管准星朝哪）
    const dur = (DUR[st] || 0.3) * (W && W.heavy ? 1.35 : 1), u = W ? (S.t - W.t0) / dur : 9, s = W ? W.s : 1;
    const MA = p.mAct;
    if (W && u < 1) {
      if (st === 'slash' || st === 'ring' || st === 'flail') {
        const k = eo(u / 0.32), ang = u < 0.32 ? a - s * A + s * 2 * A * k : u < 0.55 ? a + s * (A + 0.1 * Math.sin((u - 0.32) / 0.23 * Math.PI)) : lerp(a + s * A, rest, eio((u - 0.55) / 0.45));
        o.ang = ang; o.ext = 1.6 * Math.sin(Math.PI * clamp(u / 0.45, 0, 1));
        if (u < 0.42) { const u0 = Math.max(0, u - 0.12), k0 = eo(u0 / 0.32); o.smear = [a - s * A + s * 2 * A * k0, ang, 1 - u / 0.42]; }
        if (st === 'ring') o.spin = (S.t - W.t0) * 30 * s;
      } else if (st === 'heavy') {
        const A2 = A + 0.35;
        const ang = u < 0.1 ? lerp(a - s * A, a - s * A2, eo(u / 0.1)) : u < 0.34 ? lerp(a - s * A2, a + s * A * 0.9, eio((u - 0.1) / 0.24)) : u < 0.6 ? a + s * A * 0.9 + s * 0.08 * Math.sin((u - 0.34) / 0.26 * Math.PI) : lerp(a + s * A * 0.9, rest, eio((u - 0.6) / 0.4));
        o.ang = ang; o.ext = 2.2 * Math.sin(Math.PI * clamp((u - 0.1) / 0.5, 0, 1));
        if (u > 0.12 && u < 0.5) { const u0 = Math.max(0.1, u - 0.12); o.smear = [lerp(a - s * A2, a + s * A * 0.9, eio((u0 - 0.1) / 0.24)), ang, 1 - (u - 0.12) / 0.38]; }
      } else if (st === 'thrust' || st === 'punch' || st === 'shield') {
        const E = L.ext || 5; o.ext = u < 0.18 ? eo(u / 0.18) * E : u < 0.4 ? E : E * (1 - eio((u - 0.4) / 0.6));
        o.ang = a + (st === 'thrust' ? s * 0.08 * (1 - u) : 0); if (st === 'punch') o.side = s * 1.5;
      } else if (st === 'saw') { o.ang = a + s * 0.55 * (1 - eo(u)); o.ext = 2.5 * Math.sin(Math.PI * u); }
      if (st === 'flail') { // 头跟在柄后面甩：晚 0.12 拍
        const u2 = u - 0.12, k2 = eo(u2 / 0.32), hang = u2 < 0 ? a - s * A * 1.3 : u2 < 0.4 ? a - s * A * 1.3 + s * 2.4 * A * k2 : lerp(a + s * A * 1.1, Math.PI / 2, eio((u2 - 0.4) / 0.5));
        const ext = L.chain === 'blades' ? (u < 0.5 ? L.len * eo(u / 0.2) : lerp(L.len, 7, eio((u - 0.5) / 0.5))) : L.len;
        o.head = { ang: hang, L: ext };
      }
    } else if (MA) {
      const k = MA.dur ? clamp(MA.t / MA.dur, 0, 1) : 0.5;
      if (MA.k === 'spin') { o.ang = MA.t * 22; o.ext = 1; if (st === 'flail') o.head = { ang: MA.t * 22, L: 26, spin: true }; }
      else if (MA.k === 'leap' || MA.k === 'rjump') { o.ang = alerp(-Math.PI / 2 - f * 0.5, a + f * 0.6, eio((k - 0.7) / 0.3)); o.ext = 1; } // 跳劈：举过头顶，落地砸下
      else if (MA.k === 'iai') { o.ang = a + f * 2.6 * (st === 'slash' ? 1 : 0); o.ext = 2; } // 居合：刀拖在身后
      else if (MA.k === 'flurry' || MA.k === 'charge3') { o.ang = a + Math.sin(S.t * 40) * 0.6; o.ext = 3; }
      else { o.ang = a; o.ext = L.ext ? L.ext * 0.8 : 3; }
      if (st === 'flail' && !o.head) o.head = { ang: o.ang, L: L.len };
    } else if (p.blocking) { o.ang = a; o.ext = 3; }
    else if (p.charging && (p.chargeT || 0) > 0.12) { // 蓄力：往后拉开，越蓄越抖
      const s2 = -(p.swingDir || 1), full = p.chargeT >= ((D.TUNE && D.TUNE.chargeT) || 0.4), jit = full ? Math.sin(S.t * 70) * 0.05 : 0;
      if (st === 'thrust' || st === 'punch' || st === 'shield' || st === 'saw') { o.ang = a + jit; o.ext = -2.5; }
      else o.ang = a - s2 * (A + 0.45) + jit;
      if (st === 'flail') o.head = { ang: o.ang + S.t * 14, L: L.len * 0.8, spin: true };
    } else {
      o.ang = rest + Math.sin(S.t * 2.2) * 0.04;
      if (st === 'flail') o.head = { ang: Math.PI / 2 + Math.sin(S.t * 2.6) * 0.25, L: L.chain === 'blades' ? 7 : L.len * 0.6 };
    }
    return o;
  }

  // ── 4. 这一帧拿不拿近战
  function frame(S, p, H, slot) {
    const RR = S.raid, R = RR && RR.load; if (!R || !H || !H.ready || !H.cols) return null;
    if (p.swingT > (p._msw || 0) + 1e-4) { p.mSw = { t0: S.t, s: p.swingDir || 1, heavy: p.swingT >= 0.2 }; p.mhT = S.t; }
    p._msw = Math.max(0, p.swingT || 0);
    if (p.mAct || p.blocking || p.held || (p.charging && (p.chargeT || 0) > 0.12)) p.mhT = S.t;
    // 手上拿哪把（两个槽刀枪通用，wslots.js）：刚挥过近战（0.9 秒内、之后没开枪）拿近战；不然有枪拿枪；没枪就拿近战
    const gk = D.gunKey(RR), mk = D.melKey(RR);
    const hot = mk && p.mhT != null && S.t - p.mhT <= HOLD && !(p.lastShot != null && p.lastShot > p.mhT) && !(p.useT > 0);
    const key = hot ? mk : gk || mk; if (!key) return null;
    const card = R[key], base = D.cardBase ? D.cardBase(card) : card, gun = D.isGun(card), L = gun ? D.GUN_LOOK && D.GUN_LOOK[base] : LOOK[base]; if (!L) return null;
    const M = maskOf(H, slot); if (!M) return null;
    return { id: base, card, key, gun, L, M, back: M.back };
  }

  // ── 5. 画：武器、手、刀光。at(fx, fy) = 图集这一帧里的像素 → 世界坐标（draw.js 给，含整体变形）
  function fist(ctx, x, y, ramp) { // 一只手（握拳）
    const X = Math.round(x * 2) / 2 - 1.25, Y = Math.round(y * 2) / 2 - 1.25;
    ctx.fillStyle = INK; ctx.fillRect(X, Y, 2.5, 2.5); ctx.fillStyle = ramp[3]; ctx.fillRect(X + 0.5, Y + 0.5, 1.5, 1.5); ctx.fillStyle = ramp[5]; ctx.fillRect(X + 0.5, Y + 0.5, 0.5, 0.5);
  }
  function put(ctx, ex, spr, x, y, ang, gx, gy, flipY) {
    for (const [g, im] of [[ctx, spr.img], [ex, spr.emit]]) {
      if (!im) continue;
      g.save(); g.imageSmoothingEnabled = false; g.translate(x, y); g.rotate(ang); if (flipY) g.scale(1, -1);
      g.drawImage(im, -gx / 2, -gy / 2, spr.w / 2, spr.h / 2); g.restore();
    }
  }
  function draw(ctx, ex, S, p, st, at, ramp) {
    if (st.gun) return drawGun(ctx, ex, S, p, st, at, ramp);
    const L = st.L, m = (D.CARDS[st.id] && D.CARDS[st.id].melee) || {}, a = p.aim, f = Math.cos(a) < 0 ? -1 : 1, M = st.M;
    const o = pose(S, p, L, m, a, f), g0 = at(M.grip[0], M.grip[1]);
    const ca = Math.cos(a), sa = Math.sin(a), hx = g0[0] + ca * o.ext - sa * o.side, hy = g0[1] + sa * o.ext + ca * o.side;
    const [w, h, gx, gy] = L.size, reach = (w - gx) / 2, col = m.col || '#ffffff', fr = L.frames ? ((S.t * 24) | 0) % L.frames : 0;
    // 胳膊：手送出去了就从握点连一截
    if (Math.abs(o.ext) > 1.2 || Math.abs(o.side) > 0.5) { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = ramp[3]; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
    // 刀光：刀身扫过的扇面（发光层）
    if (o.smear && L.style !== 'punch') {
      const [a0, a1, k] = o.smear, d = ad(a0, a1); if (Math.abs(d) > 0.05) {
        ex.save(); ex.globalAlpha = 0.32 * clamp(k, 0, 1); ex.fillStyle = col; ex.beginPath(); ex.arc(hx, hy, reach, a0, a0 + d, d < 0); ex.arc(hx, hy, reach * 0.62, a0 + d, a0, d > 0); ex.closePath(); ex.fill();
        ex.globalAlpha = 0.9 * clamp(k, 0, 1); ex.strokeStyle = '#ffffff'; ex.lineWidth = 0.75; ex.beginPath(); ex.arc(hx, hy, reach - 0.5, a0 + d * 0.5, a0 + d, d < 0); ex.stroke(); ex.restore();
      }
    }
    const flipY = f < 0;
    if (L.style === 'flail') {
      const hd = o.head || { ang: Math.PI / 2, L: L.len * 0.6 }, tip = [hx + Math.cos(o.ang) * (w - gx - 2) / 2, hy + Math.sin(o.ang) * (w - gx - 2) / 2];
      const HD = HEADS[L.head], hp = [tip[0] + Math.cos(hd.ang) * hd.L, tip[1] + Math.sin(hd.ang) * hd.L];
      const cpx = tip[0] + Math.cos(o.ang) * hd.L * 0.45, cpy = tip[1] + Math.sin(o.ang) * hd.L * 0.45 + hd.L * 0.15, n = Math.max(3, Math.round(hd.L / 2));
      for (let i = 1; i < n; i++) { // 链子 / 鞭节
        const t = i / n, x = (1 - t) * (1 - t) * tip[0] + 2 * (1 - t) * t * cpx + t * t * hp[0], y = (1 - t) * (1 - t) * tip[1] + 2 * (1 - t) * t * cpy + t * t * hp[1];
        if (L.chain === 'blades') { ctx.fillStyle = INK; ctx.fillRect(Math.round(x * 2) / 2 - 1, Math.round(y * 2) / 2 - 1, 2, 2); ctx.fillStyle = i % 2 ? '#c8cdda' : '#9aa1b4'; ctx.fillRect(Math.round(x * 2) / 2 - 0.5, Math.round(y * 2) / 2 - 0.5, 1, 1); }
        else { ctx.fillStyle = INK; ctx.fillRect(Math.round(x * 2) / 2 - 0.75, Math.round(y * 2) / 2 - 0.75, 1.5, 1.5); ctx.fillStyle = i % 2 ? '#949fb6' : '#646e86'; ctx.fillRect(Math.round(x * 2) / 2 - 0.25, Math.round(y * 2) / 2 - 0.25, 0.5, 0.5); }
      }
      put(ctx, ex, sprOf(st.id, L), hx, hy, o.ang, gx, gy, flipY);
      if (!(hd.spin && p.mAct && p.mAct.k === 'spin')) { const hs = sprOf('h_' + L.head, HD), [, , hgx, hgy] = HD.size, ha = L.head === 'ball' ? S.t * 6 : Math.atan2(hp[1] - cpy, hp[0] - cpx); put(ctx, ex, hs, hp[0], hp[1], ha, hgx, hgy, false); }
      fist(ctx, hx, hy, ramp); if (L.two) fist(ctx, hx - Math.cos(o.ang) * 2.5, hy - Math.sin(o.ang) * 2.5, ramp);
      return;
    }
    if (L.style === 'ring' && p.chakOut) { fist(ctx, hx, hy, ramp); return; } // 轮刃扔出去了：空手
    let ang = o.ang, jx = 0, jy = 0;
    if (L.fx === 'saw' || (L.fx === 'spin' && p.mAct && p.mAct.k === 'bore') || (L.fx === 'pile' && p.charging)) { jx = ((S.t * 60) | 0) % 2 ? 0.5 : 0; jy = ((S.t * 47) | 0) % 2 ? 0.5 : 0; } // 发动机抖
    const spr = sprOf(st.id, L, fr);
    if (L.style === 'ring') put(ctx, ex, spr, hx + jx, hy + jy, ang + o.spin, gx, gy, flipY);
    else put(ctx, ex, spr, hx + jx, hy + jy, ang, gx, gy, flipY);
    if (L.dual) { // 另一只手的匕首：反着挥
      const ox = -sa * 3 * f, oy = ca * 3 * f, a2 = ang + (o.smear ? -0.6 : 0.5) * f;
      put(ctx, ex, spr, hx + ox, hy + oy, a2, gx, gy, flipY); fist(ctx, hx + ox, hy + oy, ramp);
    }
    if (L.style !== 'punch' && L.style !== 'shield') { fist(ctx, hx, hy, ramp); if (L.two) fist(ctx, hx - Math.cos(ang) * 3, hy - Math.sin(ang) * 3, ramp); }
    // 武器自带的小特效（发光层）
    const tipx = hx + Math.cos(ang) * reach, tipy = hy + Math.sin(ang) * reach, tick = (S.t * 20) | 0;
    if (L.fx === 'fire') for (let i = 0; i < 3; i++) { const k = 0.35 + 0.22 * i + 0.05 * Math.sin(S.t * 13 + i), fx = lerp(hx, tipx, k), fy = lerp(hy, tipy, k) - 1 - ((tick + i * 3) % 4) * 0.5; ex.fillStyle = i % 2 ? '#ffd84a' : '#ff8a2e'; ex.fillRect(Math.round(fx * 2) / 2, Math.round(fy * 2) / 2, 0.5, 0.5); }
    if (L.fx === 'zap' && tick % 3 === 0) { ex.strokeStyle = '#fff3b0'; ex.lineWidth = 0.5; ex.beginPath(); ex.moveTo(tipx, tipy); ex.lineTo(tipx + Math.cos(tick) * 2, tipy + Math.sin(tick * 1.7) * 2); ex.lineTo(tipx + Math.cos(tick * 2.3) * 3, tipy + Math.sin(tick * 0.7) * 3); ex.stroke(); }
    if (L.fx === 'drip' && tick % 8 < 4) { ex.fillStyle = '#8dff6a'; ex.fillRect(Math.round(lerp(hx, tipx, 0.7) * 2) / 2, Math.round((lerp(hy, tipy, 0.7) + 1.5 + (tick % 8) * 0.5) * 2) / 2, 0.5, 0.5); }
    if (L.fx === 'mag' && tick % 2) { ex.strokeStyle = D.rgba ? D.rgba(col, 0.8) : col; ex.lineWidth = 0.5; ex.beginPath(); ex.arc(tipx, tipy, 1.5 + (tick % 4) * 0.6, ang - 1.2, ang + 1.2); ex.stroke(); }
    if (L.fx === 'jet' && Math.abs(o.ext) > 2) { ex.fillStyle = tick % 2 ? '#ffb020' : '#ff7a2e'; ex.fillRect(hx - ca * 3.5 - 0.5, hy - sa * 3.5 - 0.5, 1, 1); }
    if (L.fx === 'pile' && p.charging) { const k = clamp((p.chargeT || 0) / ((D.TUNE && D.TUNE.chargeT) || 0.4), 0, 1); ex.fillStyle = D.rgba ? D.rgba('#ff7a2e', 0.4 + 0.6 * k) : '#ff7a2e'; ex.fillRect(hx - ca * 2 - 1, hy - sa * 2 - 1, 2, 2); }
  }

  // ── 6. 枪：枪口跟着准星，后手握把、前手托住；开火往后一顶、枪口上跳，换弹往下歪，换枪从下面抬上来
  function drawGun(ctx, ex, S, p, st, at, ramp) {
    const L = st.L, M = st.M, a = p.aim, f = Math.cos(a) < 0 ? -1 : 1, g0 = at(M.grip[0], M.grip[1]), [w, h, gx, gy] = L.size, kick = L.kick || 1;
    let ang = a, ext = 0, dy = 0;
    // 枪口对上开火点（player.js 的 D.muzzlePt）：长枪往回收、短枪往前伸；越是竖着瞄越靠图集里的手（竖着的时候开火点离身子近）
    const sim = D.muzzlePt(S, p, a), reach = (L.mz[0] - gx) / 2, wgt = Math.pow(Math.abs(Math.cos(a)), 1.5);
    let bx = lerp(g0[0], sim[0] - Math.cos(a) * reach, wgt), by = lerp(g0[1], sim[1] - Math.sin(a) * reach, wgt);
    { const dx = bx - g0[0], dy2 = by - g0[1], d = Math.hypot(dx, dy2); if (d > 6) { bx = g0[0] + dx / d * 6; by = g0[1] + dy2 / d * 6; } }
    const ts = S.t - (p.lastShot != null ? p.lastShot : -9), kk = ts >= 0 ? Math.max(0, 1 - ts / (0.06 + kick * 0.025)) : 0;
    ext -= kick * kk; ang -= f * 0.07 * kick * kk; // 后坐
    if (p.reload > 0 && p.reloadMax) { const u = 1 - p.reload / p.reloadMax, e = eio(u < 0.2 ? u / 0.2 : u > 0.8 ? (1 - u) / 0.2 : 1); ang += f * 0.75 * e; ext -= 1.2 * e; dy += 1 * e; } // 换弹：枪口往下歪
    const sw = p.gunSwapT != null && S.t - p.gunSwapT < 0.24 ? 1 - (S.t - p.gunSwapT) / 0.24 : p.act && p.act.k === 'swap' ? 1 - Math.min(1, p.act.t / p.act.dur) : 0;
    if (sw > 0) { ang += f * 1.3 * eio(sw); ext -= 2 * sw; } // 换枪：从下面抬上来
    if (p.dashT > 0) ang += f * 0.3;
    if (p.ads > 0) ext += 1 * p.ads; // 开镜往前送一点
    const ca = Math.cos(a), sa = Math.sin(a), hx = bx + ca * ext, hy = by + sa * ext + dy, flipY = f < 0;
    if ((hx - g0[0]) * ca + (hy - g0[1]) * sa > 1.5) { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = ramp[3]; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); } // 手伸出去了：连一截胳膊
    const fr = L.frames ? (L.frames === 3 ? (((p.spin || 0) > 0.05 ? S.t * 30 : 0) | 0) % 3 : ((S.t * 14) | 0) % L.frames) : 0;
    const spr = sprOf('g_' + st.id, L, fr), ra = (x, y) => { const lx = (x - gx) / 2, ly = (y - gy) / 2 * (flipY ? -1 : 1); return [hx + lx * Math.cos(ang) - ly * Math.sin(ang), hy + lx * Math.sin(ang) + ly * Math.cos(ang)]; };
    if (L.dual) { // 双枪：另一只手再拿一把，错开半拍
      const ox = -sa * 2.5 * f, oy = ca * 2.5 * f + 0.5, k2 = (p.mag || 0) % 2 ? kk : 0;
      put(ctx, ex, spr, hx + ox - ca * kick * k2, hy + oy - sa * kick * k2, ang, gx, gy, flipY); fist(ctx, hx + ox, hy + oy, ramp);
    }
    put(ctx, ex, spr, hx, hy, ang, gx, gy, flipY);
    fist(ctx, hx, hy, ramp);
    if (L.fore) { const q = ra(L.fore[0], L.fore[1]); fist(ctx, q[0], q[1], ramp); }
    // 枪自己的光：过热步枪越打越红；超级弹在枪口亮青光
    const mz = ra(L.mz[0], L.mz[1]);
    if (L.fx === 'heat' && (p.heat || 0) > 0.05) { ex.fillStyle = D.rgba('#ff5a2e', Math.min(1, p.heat)); const q = ra(28, L.mz[1]); ex.fillRect(q[0] - 1.5, q[1] - 1, 3, 2); }
    if (S.raid.sup > 0) { ex.fillStyle = D.PAL.c; ex.fillRect(mz[0] - 0.75, mz[1] - 0.75, 1.5, 1.5); }
  }
  D.MeleeHold = { frame, blit, draw, maskOf, pose, LOOK };
})(D);
