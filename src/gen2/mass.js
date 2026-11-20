/* 站内地图第二代 P1 · 落位（design/features/station-gen/design.md 第 5.2 节；施工步骤 plan-p1.md 任务 1）
   - skeleton：按骨架定楼层大小、大厅、房间位（slots）、柱网。房间位之间、房间位和大厅之间留了走廊的空当：
     房间外一圈墙 + 空当 + 大厅外一圈墙；大厅两侧（标准）、长厅下面两排房之间的竖缝（长厅）、两个大厅中间（双厅）留 5 格宽，主通道走这里。
   - boxes：洗牌后取前 n 个房间位，每个位里缩一点（同旧版），墙边尽量对齐柱网线（软规则：在能挪的范围里挑最近的）。
   - shape：拼形房间。普通房 45% 方、25% L、15% T、15% 凹口；隐藏房、门禁房、高价值房用方的。
     从外框里挖掉 1–2 块（变回墙），剩下的由 1–3 个矩形拼成，每条"臂"最窄 3 格，总面积不少于 30 格；挖掉的块贴着外框边，所以外框还是紧的。
   - grid：柱网，间距 7–9 格，原点让大厅里的柱子离墙至少 2 格（两头留的一样多）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2 = D.gen2 || {};

  // 格坐标 [x, y, w, h]。房间格的范围：x 2..W-3、y 2..H-3（外圈墙落在 1..W-2 / 1..H-2）
  const SK = {
    // 标准 / 环厅 / 深埋 / 塌方：56×34，大厅居中 24×12；上下两排各 3 个位，左右各 1 个竖长的位（和大厅之间隔 5 格宽的空当）
    std: { W: 56, H: 34, hi: 0, halls: [[16, 11, 24, 12]],
      slots: [[2, 2, 12, 5], [18, 2, 20, 5], [42, 2, 12, 5], [2, 9, 7, 16], [47, 9, 7, 16], [2, 27, 12, 5], [18, 27, 20, 5], [42, 27, 12, 5]] },
    // 长厅：60×34，长厅 48×8 横在上面；下面第一排 4 个位，位之间留 5 格宽的竖缝通到长厅；第二排 3 个位错开，正好在竖缝底下（像砌砖）
    long: { W: 60, H: 34, hi: 0, halls: [[6, 3, 48, 8]],
      slots: [[2, 14, 9, 7], [18, 14, 9, 7], [34, 14, 9, 7], [50, 14, 8, 7], [10, 25, 9, 7], [26, 25, 9, 7], [42, 25, 9, 7]] },
    // 双厅：60×36，左右两个大厅 18×12，中间 14 格的空当走主通道；上下两排各 4 个位
    split: { W: 60, H: 36, hi: 1, halls: [[4, 12, 18, 12], [38, 12, 18, 12]],
      slots: [[2, 2, 11, 6], [17, 2, 11, 6], [32, 2, 11, 6], [47, 2, 11, 6], [2, 28, 11, 6], [17, 28, 11, 6], [32, 28, 11, 6], [47, 28, 11, 6]] },
  };
  const skKey = lay => lay === 'long' || lay === 'split' ? lay : 'std';

  // 柱网：间距 s；原点让大厅 h 里的柱子离墙至少 2 格，剩下的空两头平分
  G2.grid = function (h, s) {
    const ax = (lo, len) => { const span = len - 5, n = Math.floor(span / s); return lo + 2 + Math.floor((span - n * s) / 2); };
    return { s, ox: ax(h.x, h.w), oy: ax(h.y, h.h) };
  };

  G2.skeleton = function (r2, lay) {
    const S = SK[skKey(lay)], halls = S.halls.map(([x, y, w, h]) => ({ x, y, w, h }));
    return { W: S.W, H: S.H, hi: S.hi, halls, slots: S.slots.map(a => a.slice()), grid: G2.grid(halls[S.hi], r2.int(7, 9)) };
  };

  const offGrid = (v, o, s) => { const m = ((v - o) % s + s) % s; return Math.min(m, s - m); };
  G2.boxes = function (r2, sk, n) {
    const slots = r2.shuffle(sk.slots.slice()), g = sk.grid, out = [];
    // 一个方向上挑位置：墙（v - 1 或 v + len）离柱网线最近的那些里随机一个
    const axis = (lo, room, len, o) => { let best = [], bs = 1e9; for (let v = lo; v <= lo + room - len; v++) { const sc = Math.min(offGrid(v - 1, o, g.s), offGrid(v + len, o, g.s)); if (sc < bs) { bs = sc; best = [v]; } else if (sc === bs) best.push(v); } return r2.pick(best); };
    for (let i = 0; i < n && i < slots.length; i++) {
      const [sx, sy, sw, sh] = slots[i], w = Math.min(sw, Math.max(6, sw - r2.int(0, 3))), h = Math.min(sh, Math.max(5, sh - r2.int(0, 2)));
      out.push({ x: axis(sx, sw, w, g.ox), y: axis(sy, sh, h, g.oy), w, h });
    }
    return out;
  };

  // ── 拼形。各形状在 (u, v) 里算：u 沿着 len 方向、v 沿着 dep 方向；o 决定 (u, v) 怎么落回外框（哪条边、翻不翻）
  const place = (o, w, h, [u, v, lu, lv]) => {
    const horiz = o < 2, B = horiz ? h : w, flip = o & 1;
    const vv = flip ? B - v - lv : v;
    return horiz ? [u, vv, lu, lv] : [vv, u, lv, lu];
  };
  const dims = (o, w, h) => o < 2 ? [w, h] : [h, w];
  const SHAPES = {
    // L：挖掉一个角，两条臂都至少 3 格
    L(r2, w, h) {
      if (w < 5 || h < 5) return null;
      const cw = r2.int(Math.max(2, Math.floor(w / 3)), w - 3), ch = r2.int(2, h - 3), c = r2.int(0, 3);
      return [[c & 1 ? w - cw : 0, c & 2 ? h - ch : 0, cw, ch]];
    },
    // T：一条横杠（厚 ≥ 3）+ 中间一根竖杆（宽 ≥ 3），杆两边各挖掉一块（宽 ≥ 2、深 ≥ 2）
    T(r2, w, h) {
      const os = [r2.int(0, 3)]; os.push(os[0] ^ 2);
      for (const o of os) {
        const [len, dep] = dims(o, w, h);
        if (len < 7 || dep < 5) continue;
        const t = r2.int(3, dep - 2), sw = r2.int(3, len - 4), a = r2.int(2, len - sw - 2);
        return [place(o, w, h, [0, t, a, dep - t]), place(o, w, h, [a + sw, t, len - a - sw, dep - t])];
      }
      return null;
    },
    // 凹口：一条边的中段往里挖一块（深 2 起、剩下至少 3 格），两边各留至少 3 格
    notch(r2, w, h) {
      const os = [r2.int(0, 3)]; os.push(os[0] ^ 2);
      for (const o of os) {
        const [len, dep] = dims(o, w, h);
        if (len < 8 || dep < 5) continue;
        const nw = r2.int(2, Math.min(len - 6, Math.max(2, Math.floor(len / 2)))), nd = r2.int(2, dep - 3), a = r2.int(3, len - nw - 3);
        return [place(o, w, h, [a, 0, nw, nd])];
      }
      return null;
    },
  };
  // 返回 { shape, cut: [[x, y, w, h]…] }（格坐标，外框里要挖回墙的块）
  G2.shape = function (r2, box, plain) {
    if (!plain) return { shape: 'rect', cut: [] };
    const want = r2.weighted([['rect', 45], ['L', 25], ['T', 15], ['notch', 15]]);
    if (want === 'rect') return { shape: 'rect', cut: [] };
    for (const k of want === 'L' ? ['L'] : [want, 'L']) {
      const c = SHAPES[k](r2, box.w, box.h);
      if (!c || box.w * box.h - c.reduce((t, q) => t + q[2] * q[3], 0) < 30) continue;
      return { shape: k, cut: c.map(([x, y, w, h]) => [box.x + x, box.y + y, w, h]) };
    }
    return { shape: 'rect', cut: [] };
  };
})(D);
