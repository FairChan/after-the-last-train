/* Underdog：主角背后的披风（第二版，用户 2026-11-15："这个披风太难看了，重新做，物理效果好一点，默认黑色"）
   第一版是沿一根链子展开的平板，颜色跟型号走，看着像块橙色硬纸板。这一版：
   - 物理：一张真的布（横 7 × 竖 9 个点的网格，Verlet + 约束迭代），在三维里算（x、y 是地面，z 是高度）：
       顶边钉在后颈、绕着后背弯成半圈（所以肩膀那里自然起褶）；重力往下拉；
       空气阻力只按布面的法线方向算（布侧着划过空气几乎没阻力，正对着才兜风），所以站着垂下来、跑起来往后飘起来、
       急停往前甩、转身时被身体带着绕过去；跑得越快下摆抖得越厉害（顺着布往下走的波）；
       身体是一根圆柱 + 头一个球，布穿不进去；地面挡住下摆。
       顶边跟着机身朝向（八个朝向，和图集一致）转，但转身是转过去的（每秒约 14 弧度），不是一下跳过去。
   - 投影：画面 y = 地面 y × 0.5 − 高度（纵深压扁一半，和斜俯视的机身对上）。
   - 画法：每帧把布光栅化到一张小画布上（0.5 世界单位 = 1 像素，和机身像素对齐）：
       逐像素深度缓冲（布自己叠起来也对）、按法线打光（灯在左上前方）、竖着几道褶、领口和下摆各亮一条，
       每一格平涂一个色阶（像素画不抖动）；看见布的里子用更暗的一套色；外圈描黑边，布叠在自己身上时也描一道。
       离镜头比身体中心近的部分画在机身前面（'front'），远的画在机身后面（'back'）：背对镜头整块盖在背上，
       正对镜头在身后、只露出两边和下摆，侧身时近的那一边搭过肩膀。
       盖在机身上的部分顺手从发光层上抠掉（不然机身的轮廓光会透过披风），边上补一圈很淡的冷色轮廓光，暗处也看得见。
   - 颜色：默认黑色（D.CAPE_PAL.black）。p.cape 存着这块布，K.scarf 每帧算一次（station.js 原来调围巾的地方）。
   - 电梯、楼梯里也算（lift.js 调 K.scarf / K.capeSync）；换层、电梯口、楼梯口这种瞬移，布整块挪过去（sync），不重挂、不甩。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K;
  // ── 尺寸（世界单位，型号的 scale 再乘上去）
  const NW = 7, NH = 9, N = NW * NH;
  const TOP_W = 5, BOT_W = 10, LEN = 10.5, NECK_Z = 16, DB = 2.5, WRAP = 1.2; // 顶边：宽 5，后背最深 2.5，绕身体 ±1.2 弧度；长 10.5 垂到小腿
  const RB = 2.3, BODY_Z = [1, 16], HEAD_Z = 18.5, HEAD_R = 2.4;                    // 身体圆柱、头
  const KD = 0.5;                                                                  // 纵深压扁
  const GRAV = 170, DRAG_N = 3.4, DRAG_A = 0.45, TURN = 14, SUB = 2, ITER = 6;
  const TP = 12; let TICK = 0; // 一帧里身体跳超过 TP 个单位算瞬移（布整块挪过去）；TICK 是布的版本号，画的缓存靠它判断布变没变
  // 朝镜头的方向（画面上同一个点，y 越大越靠近镜头）和灯（左上前方）
  const vl = Math.hypot(1, KD), CAMY = 1 / vl, CAMZ = KD / vl;
  const ll = Math.hypot(0.5, 0.45, 0.75), LX = -0.5 / ll, LY = 0.45 / ll, LZ = 0.75 / ll;

  // ── 颜色：out = 外面（暗 → 亮），lin = 里子，ink = 描边，rim = 发光层上的轮廓光
  D.CAPE_PAL = {
    black: { out: ['#07070b', '#101017', '#1a1a25', '#272737', '#383850', '#4e4e6c'], lin: ['#060609', '#0b0b10', '#111117', '#18181f'], ink: '#030305', rim: '#9fb8ff' },
  };
  const u32 = h => { const [r, g, b] = D.rgb(h); return (255 << 24 | b << 16 | g << 8 | r) >>> 0; };
  const palCache = {};
  function pal() {
    const k = (D.settings && D.settings.capeCol) || 'black', P = D.CAPE_PAL[k] || D.CAPE_PAL.black;
    return palCache[k] || (palCache[k] = { out: P.out.map(u32), lin: P.lin.map(u32), ink: u32(P.ink), rim: P.rim });
  }

  // ── 布
  const sAng = a => Math.round(a / (Math.PI / 4)) * (Math.PI / 4); // 图集的八个朝向
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  // 褶：单数列往外凸、双数列往里收（之字形），越往下越深。布是按这个形状"织"出来的（约束长度照这个量），所以褶一直在、跟着布动
  const pleat = (i, j) => (i % 2 ? 1 : -1) * (0.3 + 0.5 * j / (NH - 1));
  function anchors(c, p) { // 顶边钉的位置（三维）
    const fa = c.fa, bx = -Math.cos(fa), by = -Math.sin(fa), sx = -Math.sin(fa), sy = Math.cos(fa), sc = c.sc, out = c.anc;
    for (let i = 0; i < NW; i++) {
      const t = (i / (NW - 1)) * 2 - 1, th = t * WRAP, d = (DB * Math.cos(th) + pleat(i, 0)) * sc, w = TOP_W / 2 * t * sc;
      out[i * 3] = p.x + bx * d + sx * w; out[i * 3 + 1] = p.y + by * d + sy * w; out[i * 3 + 2] = (NECK_Z - 0.8 * t * t) * sc;
    }
    return out;
  }
  function build(p, sc) {
    const c = { sc, fa: sAng(p.aim || 0), x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), ox: new Float32Array(N), oy: new Float32Array(N), oz: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N), anc: new Float32Array(NW * 3), con: [], tick: ++TICK };
    const A = anchors(c, p), fa = c.fa, sx = -Math.sin(fa), sy = Math.cos(fa), bx = -Math.cos(fa), by = -Math.sin(fa), vr = LEN / (NH - 1) * sc;
    const rowW = j => (TOP_W + (BOT_W - TOP_W) * Math.pow(j / (NH - 1), 0.85)) * sc;
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      const k = j * NW + i, t = (i / (NW - 1)) * 2 - 1, spread = (rowW(j) - TOP_W * sc) / 2 * t;
      const dp = (j * 0.15 + pleat(i, j) - pleat(i, 0)) * sc;
      c.x[k] = c.ox[k] = A[i * 3] + sx * spread + bx * dp; c.y[k] = c.oy[k] = A[i * 3 + 1] + sy * spread + by * dp; c.z[k] = c.oz[k] = A[i * 3 + 2] - j * vr;
    }
    // 约束：[a, b, 长度, 硬度]；横、竖、两条对角、隔一个的（抗弯，软一点）
    const L = (a, b, k) => c.con.push([a, b, Math.hypot(c.x[a] - c.x[b], c.y[a] - c.y[b], c.z[a] - c.z[b]), k]);
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      const k = j * NW + i;
      if (i + 1 < NW) L(k, k + 1, 1);
      if (j + 1 < NH) L(k, k + NW, 1);
      if (i + 1 < NW && j + 1 < NH) { L(k, k + NW + 1, 0.7); L(k + 1, k + NW, 0.7); }
      if (i + 2 < NW) L(k, k + 2, 0.12);
      if (j + 2 < NH) L(k, k + NW * 2, 0.25);
    }
    return c;
  }
  function normals(c) { // 每个点的外法线（离开身体那一面）：右 × 下
    const { x, y, z, nx, ny, nz } = c; nx.fill(0); ny.fill(0); nz.fill(0);
    for (let j = 0; j + 1 < NH; j++) for (let i = 0; i + 1 < NW; i++) {
      const a = j * NW + i, b = a + 1, d = a + NW, e = d + 1;
      const rx = (x[b] + x[e] - x[a] - x[d]) / 2, ry = (y[b] + y[e] - y[a] - y[d]) / 2, rz = (z[b] + z[e] - z[a] - z[d]) / 2;
      const dx = (x[d] + x[e] - x[a] - x[b]) / 2, dy = (y[d] + y[e] - y[a] - y[b]) / 2, dz = (z[d] + z[e] - z[a] - z[b]) / 2;
      const qx = ry * dz - rz * dy, qy = rz * dx - rx * dz, qz = rx * dy - ry * dx;
      for (const k of [a, b, d, e]) { nx[k] += qx; ny[k] += qy; nz[k] += qz; }
    }
    for (let k = 0; k < N; k++) { const l = Math.hypot(nx[k], ny[k], nz[k]) || 1; nx[k] /= l; ny[k] /= l; nz[k] /= l; }
  }
  function step(c, p, S, h) {
    const { x, y, z, ox, oy, oz, nx, ny, nz } = c, sc = c.sc, t = S.t || 0;
    // 朝向：转过去，不是跳过去
    const tf = sAng(p.aim || 0), df = wrapA(tf - c.fa); c.fa = wrapA(c.fa + Math.max(-TURN * h, Math.min(TURN * h, df)));
    const A = anchors(c, p);
    normals(c);
    const flap = Math.min(1.6, (c.sp || 0) / 60), wind = Math.sin(t * 0.7) * 5; // 抖多大看真实走了多快（顶着墙走不算）；站着也有一点地铁里的穿堂风
    for (let k = NW; k < N; k++) {
      const j = (k / NW) | 0, i = k % NW, hem = j / (NH - 1);
      const vx = (x[k] - ox[k]) / h, vy = (y[k] - oy[k]) / h, vz = (z[k] - oz[k]) / h, rx = vx - wind, ry = vy, rz = vz;
      const vn = rx * nx[k] + ry * ny[k] + rz * nz[k];
      // 下摆的抖：顺着布往下走的波，跑得越快越大
      const fl = flap * 95 * Math.pow(hem, 1.4) * Math.sin(t * 19 - j * 1.25 + i * 0.6) * (0.6 + 0.4 * Math.sin(t * 5.3 + i));
      const ax = -DRAG_N * vn * nx[k] - DRAG_A * rx + fl * nx[k];
      const ay = -DRAG_N * vn * ny[k] - DRAG_A * ry + fl * ny[k];
      const az = -DRAG_N * vn * nz[k] - DRAG_A * rz + fl * nz[k] - GRAV;
      ox[k] = x[k]; oy[k] = y[k]; oz[k] = z[k];
      x[k] += vx * h + ax * h * h; y[k] += vy * h + ay * h * h; z[k] += vz * h + az * h * h;
    }
    for (let i = 0; i < NW; i++) { ox[i] = x[i]; oy[i] = y[i]; oz[i] = z[i]; x[i] = A[i * 3]; y[i] = A[i * 3 + 1]; z[i] = A[i * 3 + 2]; }
    const rb = RB * sc, z0 = BODY_Z[0] * sc, z1 = BODY_Z[1] * sc, hz = HEAD_Z * sc, hr = HEAD_R * sc;
    for (let it = 0; it < ITER; it++) {
      for (const q of c.con) {
        const a = q[0], b = q[1], wa = a < NW ? 0 : 1, wb = b < NW ? 0 : 1, w = wa + wb; if (!w) continue;
        const dx = x[b] - x[a], dy = y[b] - y[a], dz = z[b] - z[a], d = Math.hypot(dx, dy, dz); if (d < 1e-6) continue;
        const f = (d - q[2]) / d * q[3] / w;
        x[a] += dx * f * wa; y[a] += dy * f * wa; z[a] += dz * f * wa; x[b] -= dx * f * wb; y[b] -= dy * f * wb; z[b] -= dz * f * wb;
      }
      for (let k = NW; k < N; k++) { // 身体、头、地面
        let dx = x[k] - p.x, dy = y[k] - p.y;
        if (z[k] > z0 && z[k] < z1) { const d = Math.hypot(dx, dy); if (d < rb) { if (d < 1e-4) { dx = -Math.cos(c.fa); dy = -Math.sin(c.fa); } else { dx /= d; dy /= d; } x[k] = p.x + dx * rb; y[k] = p.y + dy * rb; } }
        const ez = z[k] - hz, dh = Math.hypot(dx, dy, ez); if (dh < hr && dh > 1e-4) { const f = hr / dh; x[k] = p.x + dx * f; y[k] = p.y + dy * f; z[k] = hz + ez * f; }
        if (z[k] < 0.3) z[k] = 0.3;
      }
    }
  }
  // 瞬移（换层、电梯口、楼梯口，或者一帧跳得很远）：整块布跟着身体挪过去，布的形状和速度都不变，不甩、不重挂
  function shift(c, dx, dy) { for (let k = 0; k < N; k++) { c.x[k] += dx; c.y[k] += dy; c.ox[k] += dx; c.oy[k] += dy; } c.tick = ++TICK; }
  function sync(c, p, S) {
    const dx = p.x - c.px, dy = p.y - c.py; c.px = p.x; c.py = p.y;
    if (c.f === S.f && dx * dx + dy * dy <= TP * TP) return;
    shift(c, dx, dy); c.f = S.f; c.lx = p.x; c.ly = p.y; // 瞬移不算速度（不然下摆会猛甩一下）
  }
  // 每帧一次（station.js 原来算围巾的地方）。坐电梯、走楼梯时 lift.js 也调它，布不会停在老地方
  K.scarf = function (S, p) {
    const sc = (S.SH && S.SH.scale) || 1;
    let c = p.cape;
    if (!c || c.sc !== sc || !isFinite(c.x[N - 1])) { c = p.cape = build(p, sc); c.f = S.f; c.px = p.x; c.py = p.y; } // 第一次、换型号：重新挂好
    else sync(c, p, S);
    const dt = Math.min(1 / 30, Math.max(0, S.dt || D.DT || 1 / 60)); if (!dt) return;
    const mv = c.lx == null ? 0 : Math.hypot(p.x - c.lx, p.y - c.ly) / dt; c.sp = (c.sp || 0) * 0.8 + Math.min(300, mv) * 0.2; c.lx = p.x; c.ly = p.y;
    c.tick = ++TICK;
    for (let s = 0; s < SUB; s++) step(c, p, S, dt / SUB);
  };
  // 身体在这一帧里又被挪了（换层时 goFloor 和楼梯口的落点一帧里动了好几次）：只把布挪过去，不做物理
  K.capeSync = function (S, p) { const c = p.cape; if (c && c.sc === ((S.SH && S.SH.scale) || 1)) sync(c, p, S); };
  D.capeBuf = () => buf; // 测试看画出来的像素

  // ── 画：光栅化到一张小画布（72 × 84 像素 = 36 × 42 世界单位，主角在中间偏下）
  const BW = 72, BH = 84, OXW = 18, OYW = 34;
  let buf = null;
  function bufs() {
    if (buf) return buf;
    const mk = () => { const [cv, g] = D.canvas(BW, BH); const im = g.createImageData(BW, BH); return { cv, g, im, px: new Uint32Array(im.data.buffer), any: false }; };
    buf = { dep: new Float32Array(BW * BH), col: new Uint32Array(BW * BH), lay: new Uint8Array(BW * BH), front: mk(), back: mk(), rim: mk(), key: '' };
    return buf;
  }
  function render(S, p, off) {
    const B = bufs(), c = p.cape, P = pal(), sc = c.sc;
    const ox = Math.round(p.x * 2) / 2 - OXW, oy = Math.round(p.y * 2) / 2 - OYW;
    B.ox = ox; B.oy = oy; B.dep.fill(-1e9); B.col.fill(0); B.lay.fill(0);
    // 每个点在画面上的位置
    const sx = new Float32Array(N), sy = new Float32Array(N);
    for (let k = 0; k < N; k++) { sx[k] = (c.x[k] - ox) * 2; sy[k] = (p.y + (c.y[k] - p.y) * KD - c.z[k] + off - oy) * 2; }
    // lo / li：这一格外面 / 里子的亮度（整格一个法线，平涂，褶的明暗分得清）
    const tri = (a, b, d, ua, ub, ud, va, vb, vd, lo, li) => {
      // 三角形朝哪面：法线点乘朝镜头的方向
      const ax = c.x[b] - c.x[a], ay = c.y[b] - c.y[a], az = c.z[b] - c.z[a], bx = c.x[d] - c.x[a], by = c.y[d] - c.y[a], bz = c.z[d] - c.z[a];
      const ny = az * bx - ax * bz, nz = ax * by - ay * bx, outer = ny * CAMY + nz * CAMZ > 0;
      const l0 = outer ? lo : li, ramp = outer ? P.out : P.lin;
      const x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b], x2 = sx[d], y2 = sy[d];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-4) return;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(BW - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(BH - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        let w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area, w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const gy = c.y[a] * w0 + c.y[b] * w1 + c.y[d] * w2, o = py * BW + px; if (gy <= B.dep[o]) continue;
        const u = ua * w0 + ub * w1 + ud * w2, v = va * w0 + vb * w1 + vd * w2;
        let l = l0 + 0.08 * (0.5 - v); // 上面稍亮一点
        if (v > 1 - 0.1 * Math.abs(Math.sin(u * Math.PI * 3.5))) continue; // 下摆剪成几个豁口
        if (v < 0.08) l += 0.18;                                          // 领口亮一条
        let idx = Math.round(l * (ramp.length - 1));
        idx = Math.max(0, Math.min(ramp.length - 1, idx));
        B.dep[o] = gy; B.col[o] = ramp[idx]; B.lay[o] = gy - p.y > 0.3 * sc ? 2 : 1; // 2 = 机身前面，1 = 后面
      }
    };
    for (let j = 0; j + 1 < NH; j++) for (let i = 0; i + 1 < NW; i++) {
      const a = j * NW + i, b = a + 1, d = a + NW, e = d + 1, u0 = i / (NW - 1), u1 = (i + 1) / (NW - 1), v0 = j / (NH - 1), v1 = (j + 1) / (NH - 1);
      const rx = (c.x[b] + c.x[e] - c.x[a] - c.x[d]) / 2, ry = (c.y[b] + c.y[e] - c.y[a] - c.y[d]) / 2, rz = (c.z[b] + c.z[e] - c.z[a] - c.z[d]) / 2;
      const dx = (c.x[d] + c.x[e] - c.x[a] - c.x[b]) / 2, dy = (c.y[d] + c.y[e] - c.y[a] - c.y[b]) / 2, dz = (c.z[d] + c.z[e] - c.z[a] - c.z[b]) / 2;
      const qx = ry * dz - rz * dy, qy = rz * dx - rx * dz, qz = rx * dy - ry * dx, ql = Math.hypot(qx, qy, qz) || 1, nd = (qx * LX + qy * LY + qz * LZ) / ql;
      const lo = 0.08 + 0.92 * Math.max(0, nd), li = 0.2 + 0.8 * Math.max(0, -nd);
      tri(a, b, d, u0, u1, u0, v0, v0, v1, lo, li); tri(b, e, d, u1, u1, u0, v0, v1, v1, lo, li);
    }
    // 拆成两层 + 描边：空像素挨着布 → 黑边（跟着挨着的那层）；布叠在自己身上（深度差得多）→ 远的那边描一道
    const F = B.front, Bk = B.back, R = B.rim; F.px.fill(0); Bk.px.fill(0); R.px.fill(0); F.any = Bk.any = false;
    const rimC = u32(P.rim) & 0x00ffffff;
    for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
      const o = py * BW + px, ly = B.lay[o];
      const nb = [px > 0 ? o - 1 : -1, px < BW - 1 ? o + 1 : -1, py > 0 ? o - BW : -1, py < BH - 1 ? o + BW : -1];
      if (!ly) {
        let to = 0; for (const q of nb) if (q >= 0 && B.lay[q] > to) to = B.lay[q];
        if (to) (to === 2 ? F : Bk).px[o] = P.ink;
        continue;
      }
      let col = B.col[o];
      for (const q of nb) if (q >= 0 && B.lay[q] && B.dep[q] - B.dep[o] > 2.2 * sc) { col = P.ink; break; }
      const L = ly === 2 ? F : Bk; L.px[o] = col; L.any = true;
      // 轮廓光：上边、左边挨着空的那一圈（只给盖在机身前面的部分，后面那部分会透过机身）
      if (ly === 2 && ((px > 0 && !B.lay[o - 1]) || (py > 0 && !B.lay[o - BW]))) R.px[o] = (0x40 << 24 | rimC) >>> 0;
    }
    for (const L of [F, Bk, R]) { L.g.putImageData(L.im, 0, 0); }
  }

  // layer：'back' 在机身之前画，'front' 在机身之后画；这一层没东西就返回 false
  D.drawCape = function (ctx, ex, S, p, off, layer) {
    if (!p.cape) return false;
    const key = p.cape.tick + '|' + off + '|' + p.x + '|' + p.y; // 布变了（物理、瞬移都会换版本号）才重画；电梯里世界停着，只看 S.t 会画成旧的
    const B = bufs(); if (B.key !== key) { render(S, p, off || 0); B.key = key; }
    const L = layer === 'front' ? B.front : B.back; if (!L.any) return false;
    const cloak = p.cloakT > 0, a0 = ctx.globalAlpha; if (cloak) ctx.globalAlpha = 0.25;
    ctx.drawImage(L.cv, B.ox, B.oy, BW / 2, BH / 2); ctx.globalAlpha = a0;
    if (layer === 'front' && ex && !cloak) {
      const op = ex.globalCompositeOperation; ex.globalCompositeOperation = 'destination-out'; ex.drawImage(L.cv, B.ox, B.oy, BW / 2, BH / 2); ex.globalCompositeOperation = op;
      ex.drawImage(B.rim.cv, B.ox, B.oy, BW / 2, BH / 2);
    }
    return true;
  };
})(D);
