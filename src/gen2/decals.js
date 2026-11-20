/* 站内地图第二代 P3 · 贴花画法（design/features/station-gen/plan-p3.md 任务 1、2）
   D.gen2.paintDecals(F, x, ex)：level.js 的 bake 在地面画完后调，把 F.decals（[{ x, y, kind, r }]，世界坐标）画进地面大图（2 倍精度）。
   贴花是"地上的痕迹"，直接画像素，但每种都用 2–3 级色阶 + 4×4 点阵抖动过渡，不用单色一坨；光从左上来（碎块、纸张左上亮、右下压暗）。
   只画在地面格（kind 0）上；每个贴花用自己的种子 r，不碰生成的随机流，所以同一个种子画出来逐像素一样。
   九种：blood 血迹、paper 散落的纸、glass 碎玻璃、chalk 粉笔画（只画符号和图形，不写字）、shells 弹壳、soot 烧痕、water 积水、rubble 碎石、tread 履带印。
   P7 加三种（新历史用）：spray 消毒喷雾痕、tape 黄黑封条胶带、arc 电弧烧出的树枝状焦纹。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, G2 = D.gen2 = D.gen2 || {};
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  // 色阶（暗 → 亮）
  const RAMP = G2.DECAL_RAMP = {
    blood: ['#2a070c', '#4a0d14', '#6e1720', '#8f2229'],
    paper: ['#5a564c', '#8f897a', '#bdb5a2', '#e0d9c6'],
    glass: ['#2c4652', '#5f8b9c', '#a6d4e2', '#e8fbff'],
    chalk: ['#5d6270', '#9aa0ad', '#cfd3dc'],
    shells: ['#4a3208', '#8f6516', '#d6a02a', '#ffe08a'],
    soot: ['#050507', '#0c0b0d', '#161416', '#211d1c'],
    water: ['#0b1220', '#13203a', '#1f3354', '#4a6f9c', '#9cc4ee'],
    rubble: ['#1a1c21', '#30343c', '#4c515c', '#757b88', '#a2a8b4'],
    tread: ['#060609', '#0e0f13', '#1b1d23', '#3a3d47'],
    spray: ['#26322c', '#3f5548', '#66846f', '#9dbca5', '#d2ead8'], // 偏冷的灰绿：消毒水干掉以后的白霜
    tape: ['#5a3e0d', '#a8761a', '#e0aa28', '#ffd95c'],
    arc: ['#050507', '#121016', '#25212b', '#7f98bc', '#e8fbff'], // 暗部是焦纹，最亮两级只在正中熔痕那一点
  };

  G2.paintDecals = function (F, x, ex) {
    const W2 = F.w * Z, H2 = F.h * Z, T2 = TS * Z;
    const floorPx = (px, py) => { if (px < 0 || py < 0 || px >= W2 || py >= H2) return false; const tx = (px / T2) | 0, ty = (py / T2) | 0; return F.kind[ty * F.tw + tx] === 0; };
    // P5（审稿 M6）：不再逐像素 fillRect，先画进一块反复用的像素缓冲（同样的"盖上去"混合），最后按画过的范围一次贴上
    const P = G2.pixBuf(W2, H2), buf = P.buf, dirty = P.dirty, BW = P.BW, SW = P.SW, u32 = P.u32, opq = P.opaque; // opq：缓冲里已经是不透明的地面（level.js 的 defer）
    const dot = (px, py, col) => {
      px = Math.round(px); py = Math.round(py); if (!floorPx(px, py)) return;
      const c = HEX.get(col) || hexA(col), o = (py * SW + px) * 4, a = c[3];
      if (opq && a < 1) { const j = o >> 2, d = u32[j], ia = 1 - a; u32[j] = (0xff000000 | (((c[2] * a + ((d >>> 16) & 255) * ia + 0.5) | 0) << 16) | (((c[1] * a + ((d >>> 8) & 255) * ia + 0.5) | 0) << 8) | ((c[0] * a + (d & 255) * ia + 0.5) | 0)) >>> 0; }
      else if (a >= 1 || !buf[o + 3]) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = a * 255; }
      else { const A0 = buf[o + 3] / 255, oa = a + A0 * (1 - a), q = A0 * (1 - a); buf[o] = (c[0] * a + buf[o] * q) / oa; buf[o + 1] = (c[1] * a + buf[o + 1] * q) / oa; buf[o + 2] = (c[2] * a + buf[o + 2] * q) / oa; buf[o + 3] = oa * 255; }
      dirty[(py >> 6) * BW + (px >> 6)] = 1;
    };
    // 抖动挑色：v ∈ [0, 1)，加 4×4 点阵抖动后落在色阶里
    const tone = (ramp, v, px, py) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length + dith(px, py) - 0.5)))];
    // 一块斑：中心浓边缘淡（抖动消边），v 由 f(d) 给（d 0 中心 → 1 边）
    const blob = (cx, cy, rx, ry, ramp, f, edge) => {
      for (let py = Math.floor(cy - ry); py <= cy + ry; py++) for (let px = Math.floor(cx - rx); px <= cx + rx; px++) {
        const d = Math.sqrt(((px + 0.5 - cx) / rx) ** 2 + ((py + 0.5 - cy) / ry) ** 2); if (d > 1) continue;
        if (edge && d > edge && dith(px, py) < (d - edge) / (1 - edge)) continue;
        dot(px, py, tone(ramp, f(d, px - cx, py - cy), px, py));
      }
    };
    // 一小块有体积的碎片（左上亮、右下暗）
    const chip = (px, py, w, h, ramp) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = i === 0 || j === 0 ? 0.92 : i === w - 1 || j === h - 1 ? 0.2 : 0.55; dot(px + i, py + j, tone(ramp, v, px + i, py + j)); } };
    const line = (x0, y0, x1, y1, fn) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) fn(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), i, n); };

    for (const d of F.decals) {
      const r = D.rng(d.r >>> 0), cx = d.x * Z, cy = d.y * Z, R = RAMP[d.kind];
      if (!R) continue;
      if (d.kind === 'blood') {
        const big = r.int(6, 10);
        blob(cx, cy, big, big * 0.6, R, (dd, dx, dy) => 0.75 - dd * 0.55 - (dx + dy > 0 ? 0.12 : 0), 0.65);
        for (let k = 0; k < r.int(1, 3); k++) { const a = r.range(0, 6.283), l = r.range(big, big * 2.2); blob(cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.6, r.range(1.5, 3), r.range(1, 2), R, dd => 0.6 - dd * 0.4, 0); }
        if (r.chance(0.6)) { const a = r.range(0, 6.283), l = r.int(10, 22); line(cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.6, (px, py, i, n) => { for (let w = -1; w <= 1; w++) if (dith(px, py + w) > i / n * 0.8) dot(px, py + w, tone(R, 0.5 - 0.3 * i / n, px, py + w)); }); }
        for (let k = 0; k < 6; k++) dot(cx + r.int(-big * 2, big * 2), cy + r.int(-big, big), R[r.int(1, 2)]);
      } else if (d.kind === 'paper') {
        for (let k = 0, n = r.int(4, 7); k < n; k++) {
          const px = cx + r.int(-14, 10), py = cy + r.int(-9, 8), w = r.int(5, 9), h = r.int(4, 6), sk = r.int(-1, 1);
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const xx = px + i + (sk * j >> 1), v = j === 0 || i === 0 ? 0.95 : j === h - 1 || i === w - 1 ? 0.3 : 0.65; dot(xx, py + j, tone(R, v, xx, py + j)); }
          for (let i = 1; i < w - 1; i += 2) if (r.chance(0.6)) dot(px + i + (sk >> 1), py + 2, R[0]); // 纸上的印字（只是几个暗点，不是字）
          for (let i = 1; i <= w; i++) dot(px + i + (sk * h >> 1), py + h, '#0b0a1460');
        }
      } else if (d.kind === 'glass') {
        for (let k = 0, n = r.int(10, 18); k < n; k++) {
          const a = r.range(0, 6.283), l = Math.sqrt(r()) * 14, px = cx + Math.cos(a) * l, py = cy + Math.sin(a) * l * 0.6, s = r.int(1, 3);
          if (s === 1) dot(px, py, R[r.int(2, 3)]);
          else { line(px, py, px + r.int(-s, s), py + r.int(-1, 1), (qx, qy, i) => dot(qx, qy, i === 0 ? R[3] : R[r.int(1, 2)])); dot(px + 1, py + 1, R[0]); }
        }
      } else if (d.kind === 'chalk') { // 粉笔画：箭头、圈叉、计数、地图连线（只画符号）
        const pick = r.int(0, 4), C = (px, py) => { if (dith(px, py) < 0.82) dot(px, py, tone(R, 0.45 + 0.4 * dith(px + 1, py + 2), px, py)); };
        const ln = (a, b, c, e) => line(cx + a, cy + b, cx + c, cy + e, C);
        if (pick === 0) { const dir = r.chance(0.5) ? 1 : -1; ln(-12 * dir, 0, 10 * dir, 0); ln(10 * dir, 0, 5 * dir, -5); ln(10 * dir, 0, 5 * dir, 5); ln(-12 * dir, 1, 10 * dir, 1); }
        else if (pick === 1) { for (let k = 0; k < 28; k++) { const a = k / 28 * 6.283; C(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 6)); } ln(-5, -4, 5, 4); ln(5, -4, -5, 4); }
        else if (pick === 2) { for (let k = 0; k < 4; k++) ln(-8 + k * 4, -5, -8 + k * 4, 5); ln(-10, 4, 8, -4); }
        else if (pick === 3) { ln(-14, -6, -2, -6); ln(-2, -6, -2, 5); ln(-2, 5, 12, 5); ln(12, 5, 12, -3); for (const [a, b] of [[-14, -6], [-2, 5], [12, -3]]) { ln(a - 2, b - 2, a + 2, b + 2); ln(a + 2, b - 2, a - 2, b + 2); } }
        else { ln(-8, -7, 8, -7); ln(8, -7, 8, 7); ln(8, 7, -8, 7); ln(-8, 7, -8, -7); ln(-8, -7, 8, 7); }
      } else if (d.kind === 'shells') {
        for (let k = 0, n = r.int(5, 11); k < n; k++) {
          const px = cx + r.int(-13, 13), py = cy + r.int(-7, 7);
          if (r.chance(0.5)) { dot(px, py, R[3]); dot(px + 1, py, R[2]); dot(px + 2, py, R[1]); dot(px + 1, py + 1, '#0b0a1470'); }
          else { dot(px, py, R[3]); dot(px, py + 1, R[2]); dot(px + 1, py + 1, R[1]); dot(px + 1, py + 2, '#0b0a1470'); }
        }
      } else if (d.kind === 'soot') {
        const rx = r.int(14, 24), ry = rx * r.range(0.55, 0.8);
        blob(cx, cy, rx, ry, R, dd => 0.85 - dd * 0.85, 0.35);
        for (let k = 0; k < r.int(4, 8); k++) { const a = r.range(0, 6.283), l = r.range(rx * 0.6, rx * 1.3); line(cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.7, (px, py, i, n) => { if (dith(px, py) > i / n) dot(px, py, tone(R, 0.6 - 0.5 * i / n, px, py)); }); }
        for (let k = 0; k < 5; k++) dot(cx + r.int(-rx, rx), cy + r.int(-ry, ry), '#3a2a1c'); // 烧剩的焦渣
      } else if (d.kind === 'water') {
        const rx = r.int(14, 30), ry = r.int(6, 11), nc = r.pick((F.th && F.th.neon) || ['#3ee8ff']);
        blob(cx, cy, rx, ry, R, (dd, dx, dy) => 0.5 - dd * 0.35 + (dy < 0 && dd > 0.8 ? 0.35 : 0) - (dy > 0 && dd > 0.85 ? 0.25 : 0), 0.9);
        line(cx - rx * 0.5, cy - 2, cx + rx * 0.1, cy - 2, (px, py) => { if (dith(px, py) < 0.5) dot(px, py, R[3]); }); // nc 照旧抽（这块贴花自己的种子，后面的取数不变）。P5（审稿 M10）：倒影不再用霓虹色（像界面上的光标），用水面自己的亮色
        line(cx - 6, cy + 2, cx + 2, cy + 2, (px, py) => dot(px, py, R[4]));
      } else if (d.kind === 'rubble') {
        blob(cx, cy, 13, 8, ['#16181c', '#1f2227', '#272a31'], dd => 0.7 - dd * 0.6, 0.5); // 底下一层灰
        for (let k = 0, n = r.int(5, 9); k < n; k++) { const s = r.int(2, 5); chip(cx + r.int(-12, 9), cy + r.int(-7, 5), s, r.int(2, s), R); }
        for (let k = 0; k < 10; k++) dot(cx + r.int(-14, 14), cy + r.int(-8, 8), R[r.int(1, 3)]);
      } else if (d.kind === 'spray') { // 消毒喷雾痕：朝一个方向喷开的扇形雾斑（中间浓、往外散成细点），正中一小片干掉的白霜
        const a0 = r.range(0, 6.283), rx = r.int(10, 16);
        for (let k = 0, n = r.int(90, 140); k < n; k++) { const a = a0 + r.range(-0.7, 0.7), l = Math.sqrt(r()) * rx, px = Math.round(cx + Math.cos(a) * l), py = Math.round(cy + Math.sin(a) * l * 0.6); dot(px, py, tone(R, 0.72 - l / rx * 0.5, px, py)); }
        for (let k = 0; k < 14; k++) { const a = a0 + r.range(-0.9, 0.9), l = rx * r.range(1, 1.5); dot(cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.6, R[r.int(1, 3)]); }
        blob(cx + Math.cos(a0) * 3, cy + Math.sin(a0) * 2, rx * 0.4, rx * 0.26, R, dd => 0.85 - dd * 0.45, 0.45);
      } else if (d.kind === 'tape') { // 封条：黄黑相间的胶带贴在地上（一条，或者交叉的两条），上沿亮、下沿暗，一头撕破了
        const n = r.chance(0.4) ? 2 : 1, a0 = r.chance(0.5) ? 0 : r.range(-0.45, 0.45);
        for (let q = 0; q < n; q++) {
          const a = a0 + q * 1.15, len = r.int(26, 46), ca = Math.cos(a), sa = Math.sin(a) * 0.6, torn = r.int(3, 7);
          for (let t = -len / 2; t < len / 2; t++) for (let w = -2; w <= 2; w++) {
            const px = Math.round(cx + ca * t - sa * w), py = Math.round(cy + sa * t + w);
            if (t > len / 2 - torn && dith(px, py) < (t - (len / 2 - torn)) / torn) continue; // 撕破的那头参差
            const band = Math.floor((t - w + 200) / 5) % 2;
            dot(px, py, band ? tone(R, w === -2 ? 0.95 : w === 2 ? 0.15 : 0.6, px, py) : (w === -2 ? '#34343c' : w === 2 ? '#08080a' : '#141418'));
          }
        }
      } else if (d.kind === 'arc') { // 电弧痕：中间一小块烧黑，往外分叉的焦黑细纹（像树枝），正中一点发白的熔痕
        blob(cx, cy, 9, 6, RAMP.soot, dd => 0.85 - dd * 0.75, 0.4);
        const branch = (x0, y0, a, len, dep) => {
          let px = x0, py = y0;
          for (let i = 0; i < len; i++) {
            a += r.range(-0.5, 0.5); px += Math.cos(a); py += Math.sin(a) * 0.6;
            const qx = Math.round(px), qy = Math.round(py); dot(qx, qy, !dep && i < 3 ? R[3] : tone(R, 0.28 + 0.3 * (1 - i / len) * (dep ? 0.6 : 1), qx, qy)); // 根部几格是烧出来的浅色熔痕，往外是焦黑细纹
            if (!dep && i < len * 0.6) dot(qx + 1, qy, R[1]); // 主干加粗一格
            if (dep < 2 && r.chance(0.12)) branch(px, py, a + r.range(-1, 1), (len - i) >> 1, dep + 1);
          }
        };
        for (let k = 0, n = r.int(4, 7); k < n; k++) branch(cx, cy, r.range(0, 6.283), r.int(10, 20), 0);
        dot(cx, cy, R[3]); dot(cx + 1, cy, R[3]); dot(cx, cy + 1, R[3]); dot(cx - 1, cy - 1, R[4]);
      } else if (d.kind === 'tread') { // 两道平行的履带印，一节一节的
        const hz = r.chance(0.6), len = r.int(36, 70), gap = 9;
        for (let t = -len / 2; t < len / 2; t++) for (const o of [-gap, gap]) for (let w = 0; w < 5; w++) {
          const px = hz ? cx + t : cx + o + w - 2, py = hz ? cy + o * 0.6 + w - 2 : cy + t;
          const link = ((t + 100) % 4) < 2, v = link ? 0.9 : 0.2, fade = Math.max(0, Math.abs(t) / (len / 2) - 0.6) / 0.4; // 一节一节：亮的是履带齿压出的棱，两头渐淡
          if (dith(px, py) < fade) continue;
          dot(px, py, tone(R, v - (w === 4 ? 0.3 : 0), px, py));
        }
      }
    }
  };
  // ── 共用的像素缓冲（P5）：和地面大图一样大的一块 RGBA，反复用；画的时候按 64×64 的块记脏，贴的时候只贴脏块、贴完清掉。
  //    贴花（这里）和表面痕迹（wear.js）都先画进来再贴，不再逐像素 fillRect、也不再每次新建整张图大小的 ImageData
  G2.pixBuf = function (W2, H2, keep) { // 只长不缩（站厅、站台大小不一样，来回换不用重新分配）；SW 是一行的宽度，BW 是一行有几个块
    let P = G2._pix;
    if (!P || P.SW < W2 || P.SH < H2) {
      const SW = Math.max(W2, P ? P.SW : 0), SH = Math.max(H2, P ? P.SH : 0), BW = Math.ceil(SW / 64), img = new ImageData(SW, SH), [c, cx] = D.canvas(SW, SH);
      P = G2._pix = { SW, SH, img, buf: img.data, u32: new Uint32Array(img.data.buffer), c, cx, BW, dirty: new Uint8Array(BW * Math.ceil(SH / 64)), fill: null, opaque: false, stale: false };
    }
    // 审稿修复（提速）：新画法楼层的地面、痕迹、贴花画进同一块缓冲（P.opaque，不透明），贴完不清（P.stale）；别的楼层要用干净的缓冲时这里先整块清掉。
    //   keep：调用的人会把要贴的范围整块重画（paintTiles），不用先清
    if (P.stale) { if (!keep) P.buf.fill(0); P.stale = false; }
    P.W2 = W2; P.H2 = H2; return P;
  };
  G2.pixMark = function (P, x0, y0, x1, y1) { const BH = P.dirty.length / P.BW; for (let by = Math.max(0, y0 >> 6); by <= Math.min(BH - 1, y1 >> 6); by++) for (let bx = Math.max(0, x0 >> 6); bx <= Math.min(P.BW - 1, x1 >> 6); bx++) P.dirty[by * P.BW + bx] = 1; };
  // 贴：脏块的外框一次 putImageData（只传这块）到同样大的画布上，再一次 drawImage 贴到地面大图；缓冲只清脏块。
  //   表面痕迹和贴花都画进同一块缓冲、bake 里在贴花之后只贴一次（中间没有别的画法，叠的先后和以前一样）
  //   direct：整块直接 putImageData 到目标上（目标那块原来的内容不要了：bake 里地面、墙那一次）。
  //   审稿修复 I1：putImageData 不混合，外框里没画过的块会把画布底色盖成全透明——给了 P.fill（paintTiles 设成墙里深处的颜色）就先把这些块铺上它
  G2.pixFlush = function (P, x, direct) {
    const { SW, SH, BW, dirty, buf } = P; let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let b = 0; b < dirty.length; b++) if (dirty[b]) { const bx = b % BW, by = (b / BW) | 0; if (bx < bx0) bx0 = bx; if (by < by0) by0 = by; if (bx > bx1) bx1 = bx; if (by > by1) by1 = by; }
    if (bx1 < 0) { P.fill = null; if (P.opaque) { P.opaque = false; P.stale = true; } return; }
    if (direct && P.fill != null) { const u32 = P.u32;
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) { const b = by * BW + bx; if (dirty[b]) continue; dirty[b] = 1; const X = bx * 64, w = Math.min(64, SW - X); for (let y = by * 64, ye = Math.min(SH, y + 64); y < ye; y++) u32.fill(P.fill, y * SW + X, y * SW + X + w); } }
    const x0 = bx0 * 64, y0 = by0 * 64, x1 = Math.min((bx1 + 1) * 64, SW, P.W2), y1 = Math.min((by1 + 1) * 64, SH, P.H2);
    if (x1 > x0 && y1 > y0) { if (direct) x.putImageData(P.img, 0, 0, x0, y0, x1 - x0, y1 - y0); else { P.cx.putImageData(P.img, 0, 0, x0, y0, x1 - x0, y1 - y0); x.drawImage(P.c, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); } }
    P.fill = null;
    if (P.opaque) { dirty.fill(0); P.opaque = false; P.stale = true; return; } // 新画法楼层：缓冲不清（下一层 paintTiles 整块重画；别的楼层用之前 pixBuf 会整块清）
    // 清脏块：每一排块里连着的脏块一行一次 fill（审稿修复：以前每块每行一次，调用太多）
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        if (!dirty[by * BW + bx]) continue;
        let be = bx; while (be + 1 <= bx1 && dirty[by * BW + be + 1]) be++;
        for (let q = bx; q <= be; q++) dirty[by * BW + q] = 0;
        const X = bx * 64, X1 = Math.min(SW, (be + 1) * 64);
        for (let y = by * 64, ye = Math.min(SH, y + 64); y < ye; y++) buf.fill(0, (y * SW + X) * 4, (y * SW + X1) * 4);
        bx = be;
      }
    }
  };
  const HEX = new Map();
  function hexA(col) { const n = parseInt(col.slice(1, 7), 16), a = col.length >= 9 ? parseInt(col.slice(7, 9), 16) / 255 : 1, v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]; HEX.set(col, v); return v; }
})(D);
