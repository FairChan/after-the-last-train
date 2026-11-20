/* 末班之后 · 小样：战斗房间
   一个房间 = 碰撞格 + 预先画好的地面墙面 + 会挡住角色的摆设（按脚底 y 排序）+ 光源。
   三种主题：站台（下方是轨道）、商场（上墙是店面和霓虹）、车库（警示条和货箱）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, TS = 16;
  D.TS = TS;

  const THEMES = {
    platform: { floor: ['#2a3045', '#2c334b', '#2f364f'], grout: '#21263a', wall: '#1a1d2d', face: ['#262b40', '#30364f'], neon: ['#3ee8ff', '#ffb057'], ambient: '#1c1e36', lamp: '#ffcf8a' },
    mall:     { floor: ['#31283d', '#352b42', '#2f283c'], grout: '#251e30', wall: '#1b1424', face: ['#2a2036', '#352944'], neon: ['#ff3d8b', '#3ee8ff', '#9b6bff'], ambient: '#21182f', lamp: '#ffb3d4' },
    depot:    { floor: ['#2d3236', '#33393c', '#2a2f33'], grout: '#1a1d20', wall: '#171a1d', face: ['#262b2f', '#2f353a'], neon: ['#ffb057', '#8dff6a'], ambient: '#1a1d22', lamp: '#ffd27a' },
  };

  D.makeArena = function (rng, theme, big) {
    const th = THEMES[theme], tw = big ? 25 : 22, tht = big ? 15 : 14;
    const A = { theme, th, tw, tht, w: tw * TS, h: tht * TS, solid: new Uint8Array(tw * tht), props: [], lights: [], ambient: th.ambient };
    const S = (x, y) => A.solid[y * tw + x] = 1;
    // 外墙：上方两格是墙面，左右下各一格
    for (let x = 0; x < tw; x++) { S(x, 0); S(x, 1); S(x, tht - 1); }
    for (let y = 0; y < tht; y++) { S(0, y); S(tw - 1, y); }
    if (theme === 'platform') for (let x = 0; x < tw; x++) { S(x, tht - 2); S(x, tht - 3); } // 轨道沟
    const floorBottom = theme === 'platform' ? tht - 4 : tht - 2;
    A.floorBottom = floorBottom;
    A.spawn = { x: tw * TS / 2, y: (floorBottom - 1.5) * TS };

    // 摆设：避开出生点和房间正中
    const kinds = theme === 'platform' ? [['pillar', 4], ['bench', 3], ['bin', 2], ['vending', 2]] : theme === 'mall' ? [['planter', 3], ['vending', 3], ['pillar', 2], ['bench', 2], ['kiosk', 1]] : [['crate', 5], ['barrel', 3], ['pillar', 2], ['vending', 1]];
    const want = big ? 6 : rng.int(5, 8);
    const taken = new Set();
    for (let n = 0, tries = 0; n < want && tries < 200; tries++) {
      const k = rng.weighted(kinds), x = rng.int(3, tw - 4), y = rng.int(4, floorBottom - 2);
      if (Math.abs(x * TS + 8 - A.spawn.x) < 48 && Math.abs(y * TS - A.spawn.y) < 40) continue;
      if (Math.abs(x - tw / 2) < 3 && Math.abs(y - (floorBottom + 2) / 2) < 2) continue;
      const wide = k === 'bench' || k === 'kiosk' ? 2 : 1;
      let ok = true;
      for (let a = -1; a <= wide; a++) for (let b = -1; b <= 1; b++) if (taken.has((x + a) + ',' + (y + b))) ok = false;
      if (!ok) continue;
      for (let a = 0; a < wide; a++) { taken.add((x + a) + ',' + y); S(x + a, y); }
      A.props.push(makeProp(k, x, y, th, rng));
      n++;
    }
    bakeFloor(A, rng);
    // 光源：墙上的灯、霓虹、贩卖机
    for (let x = 3; x < tw - 2; x += rng.int(5, 7)) {
      const broken = rng.chance(0.25);
      A.lights.push({ x: x * TS + 8, y: 2 * TS - 4, oy: 40, r: 105, col: th.lamp, a: broken ? 0.6 : 0.9, flick: broken ? 0.6 : 0.04, seed: rng() * 100, shaft: true });
    }
    for (const s of A.signs) A.lights.push({ x: s.x, y: s.y + 10, r: 70, col: s.col, a: 0.7, flick: 0.05, seed: rng() * 100 });
    for (const p of A.props) if (p.light) A.lights.push(Object.assign({ seed: rng() * 100 }, p.light));
    if (theme === 'platform') for (let x = 2; x < tw; x += 6) A.lights.push({ x: x * TS, y: (tht - 2) * TS, r: 40, col: '#ff3047', a: 0.45, flick: 0.02, seed: x });
    return A;
  };

  // 碰撞
  D.solidAt = (A, px, py) => { const x = Math.floor(px / TS), y = Math.floor(py / TS); return x < 0 || y < 0 || x >= A.tw || y >= A.tht || A.solid[y * A.tw + x] === 1; };
  D.collide = function (A, o) { // 圆和格子
    const r = o.r;
    for (let it = 0; it < 2; it++) {
      const x0 = Math.floor((o.x - r) / TS), x1 = Math.floor((o.x + r) / TS), y0 = Math.floor((o.y - r) / TS), y1 = Math.floor((o.y + r) / TS);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!(x < 0 || y < 0 || x >= A.tw || y >= A.tht || A.solid[y * A.tw + x])) continue;
        const nx = D.clamp(o.x, x * TS, x * TS + TS), ny = D.clamp(o.y, y * TS, y * TS + TS);
        const dx = o.x - nx, dy = o.y - ny, d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 0.0001) { o.x += dx / d * (r - d); o.y += dy / d * (r - d); }
          else { // 圆心已在格子里：沿最浅的方向推出去
            const l = o.x - x * TS, rr = x * TS + TS - o.x, u = o.y - y * TS, b = y * TS + TS - o.y, m = Math.min(l, rr, u, b);
            if (m === l) o.x -= l + r; else if (m === rr) o.x += rr + r; else if (m === u) o.y -= u + r; else o.y += b + r;
          }
        }
      }
    }
    // 兜底：无论如何留在房间里
    o.x = D.clamp(o.x, TS + r, A.w - TS - r); o.y = D.clamp(o.y, 2 * TS + r, A.h - TS - r);
  };
  // 分步移动：每步不超过 3 像素，冲刺也穿不过墙
  D.move = function (A, o, dx, dy) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
    for (let i = 0; i < n; i++) { o.x += dx / n; o.y += dy / n; D.collide(A, o); }
  };

  // ── 摆设：画成一个小画布，底边对齐格子底边
  function makeProp(k, tx, ty, th, rng) {
    const fx = tx * TS, fy = ty * TS + TS; // 脚底
    let w = 16, h = 24, light = null, draw;
    const R = (x, a, b, c, d, col) => { x.fillStyle = col; x.fillRect(a, b, c, d); };
    if (k === 'pillar') {
      h = 44; draw = x => {
        R(x, 1, 0, 14, 44, P.k); R(x, 2, 0, 12, 6, '#4a5374'); R(x, 2, 6, 12, 37, '#2f3550'); R(x, 3, 6, 3, 37, '#3d4563'); R(x, 12, 6, 2, 37, '#232842');
        R(x, 2, 16, 12, 2, th.neon[0]); R(x, 2, 18, 12, 1, '#1d2033'); R(x, 2, 40, 12, 3, '#1d2033');
        for (let i = 0; i < 4; i++) R(x, 4 + rng.int(0, 7), 22 + rng.int(0, 14), 1, rng.int(1, 3), '#252a40');
      };
      light = null;
    } else if (k === 'vending') {
      h = 28; const col = rng.pick(['#3ee8ff', '#ff3d8b', '#8dff6a']);
      draw = (x, e) => {
        R(x, 1, 0, 14, 28, P.k); R(x, 2, 1, 12, 26, '#3a2f4a'); R(x, 2, 1, 12, 2, '#5a4a6a');
        R(x, 3, 4, 7, 12, col); R(e, 3, 4, 7, 12, col); for (let j = 5; j < 16; j += 3) { R(x, 4, j, 5, 1, '#ffffff'); R(e, 4, j, 5, 1, '#ffffff'); }
        R(x, 11, 5, 2, 6, '#1d2033'); R(x, 11, 6, 2, 1, '#ff3047'); R(e, 11, 6, 2, 1, '#ff3047'); R(x, 3, 19, 10, 4, '#1d2033'); R(x, 2, 26, 12, 1, '#211a2c');
      };
      light = { x: fx + 6, y: fy - 4, r: 46, col, a: 0.85, flick: 0.03 };
    } else if (k === 'bench') {
      w = 32; h = 14; draw = x => { R(x, 1, 3, 30, 8, P.k); R(x, 2, 4, 28, 3, '#9c6b4f'); R(x, 2, 7, 28, 2, '#5e3d36'); R(x, 3, 9, 2, 5, '#1d2033'); R(x, 27, 9, 2, 5, '#1d2033'); R(x, 2, 4, 28, 1, '#d39b6a'); };
    } else if (k === 'kiosk') {
      w = 32; h = 30; const col = rng.pick(th.neon);
      draw = (x, e) => { R(x, 1, 0, 30, 30, P.k); R(x, 2, 1, 28, 6, col); R(e, 2, 1, 28, 6, col); R(x, 2, 7, 28, 22, '#2a2036'); for (let i = 4; i < 28; i += 3) R(x, i, 9, 1, 18, '#3a2f4a'); R(x, 2, 26, 28, 3, '#1b1424'); };
      light = { x: fx + 16, y: fy - 18, r: 56, col, a: 0.7, flick: 0.05 };
    } else if (k === 'planter') {
      h = 22; draw = x => { R(x, 1, 10, 14, 12, P.k); R(x, 2, 11, 12, 10, '#5a4a6a'); R(x, 2, 11, 12, 2, '#7a6a8a'); for (let i = 0; i < 6; i++) { const a = rng.int(3, 12), hh = rng.int(4, 10); R(x, a, 11 - hh, 1, hh, rng.pick(['#3c8f3a', '#2c5a2a', '#5e3d36'])); } };
    } else if (k === 'bin') {
      h = 16; draw = x => { R(x, 3, 2, 10, 14, P.k); R(x, 4, 3, 8, 12, '#3c8f3a'); R(x, 4, 3, 8, 2, '#5fbf5a'); R(x, 4, 8, 8, 1, '#2c5a2a'); };
    } else if (k === 'crate') {
      h = 18; draw = x => { R(x, 1, 2, 14, 16, P.k); R(x, 2, 3, 12, 14, '#9c6b4f'); R(x, 2, 3, 12, 3, '#d39b6a'); R(x, 2, 10, 12, 1, '#5e3d36'); R(x, 7, 6, 1, 11, '#5e3d36'); if (rng.chance(0.5)) { R(x, 3, 12, 3, 3, '#e3c14a'); } };
    } else { // barrel
      h = 18; const c = rng.pick(['#b8432f', '#3a6fa8', '#e3c14a']);
      draw = x => { R(x, 2, 2, 12, 16, P.k); R(x, 3, 3, 10, 14, c); R(x, 3, 3, 10, 2, '#ffffff33'); R(x, 3, 8, 10, 1, P.k); R(x, 3, 13, 10, 1, P.k); R(x, 4, 4, 2, 12, '#ffffff22'); };
    }
    const [img, ix] = D.canvas(w, h), [em, ex] = D.canvas(w, h);
    draw(ix, ex);
    return { kind: k, x: fx + w / 2, y: fy, w, h, img, emit: em, light };
  }

  // ── 地面与墙面预渲染
  function bakeFloor(A, rng) {
    const th = A.th, [c, x] = D.canvas(A.w, A.h), [em, ex] = D.canvas(A.w, A.h);
    A.floor = c; A.floorEmit = em; A.signs = [];
    const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    R(0, 0, A.w, A.h, th.wall);
    // 地砖
    for (let ty = 2; ty < A.floorBottom + 1; ty++) for (let tx = 1; tx < A.tw - 1; tx++) {
      const px = tx * TS, py = ty * TS, base = rng.pick(th.floor);
      R(px, py, TS, TS, base);
      if (A.theme === 'depot') { R(px, py, TS, 1, th.grout); R(px, py, 1, TS, th.grout); }
      else { // 16×16 地砖，左上一道高光、右下一道暗边
        R(px, py, TS, 1, th.grout); R(px, py, 1, TS, th.grout);
        R(px + 1, py + 1, TS - 2, 1, '#ffffff0c'); R(px + 1, py + TS - 1, TS - 1, 1, '#00000022');
        if (A.theme === 'mall' && ((tx + ty) & 1)) R(px + 1, py + 1, TS - 1, TS - 1, '#ffffff06');
      }
      if (rng.chance(0.18)) { let a = px + rng.int(2, 13), b = py + rng.int(2, 13); for (let i = 0; i < rng.int(3, 7); i++) { R(a, b, 1, 1, th.grout); a += rng.int(-1, 1); b += rng.int(0, 1); } }
      if (rng.chance(0.12)) for (let i = 0; i < 6; i++) R(px + rng.int(0, 14), py + rng.int(0, 14), rng.int(1, 3), 1, '#00000030');
    }
    // 大片污渍：抖动散点
    for (let n = 0; n < 14; n++) {
      const cx = rng.int(TS, A.w - TS), cy = rng.int(2 * TS, A.floorBottom * TS), rr = rng.int(14, 36);
      for (let i = 0; i < rr * rr * 0.9; i++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * rr; if (rng() < 1 - d / rr) R(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.7), 1, 1, '#0000002a'); }
    }
    // 水洼：倒映灯色
    for (let n = 0; n < rng.int(2, 4); n++) {
      const cx = rng.int(3, A.tw - 4) * TS, cy = rng.int(4, A.floorBottom - 1) * TS, rw = rng.int(10, 22), rh = rng.int(4, 7);
      for (let j = -rh; j <= rh; j++) { const hw = Math.round(rw * Math.sqrt(1 - (j * j) / (rh * rh + 1))); R(cx - hw, cy + j, hw * 2, 1, '#1a2238'); }
      R(cx - rw / 2, cy - 1, rw * 0.6, 1, D.rgba(rng.pick(th.neon), 0.55)); R(cx - 3, cy + 1, 5, 1, '#ffffff40');
    }
    // 盲道 / 警示条
    if (A.theme === 'platform') {
      const yy = A.floorBottom * TS + 10;
      for (let px = TS; px < A.w - TS; px += 4) { R(px, yy, 3, 4, P.y); R(px, yy + 4, 3, 1, P.h); }
      // 轨道
      const ty0 = (A.tht - 3) * TS;
      R(TS, ty0, A.w - 2 * TS, 2 * TS, '#0e1019'); R(TS, ty0, A.w - 2 * TS, 2, '#2a2f45');
      for (let px = TS; px < A.w - TS; px += 7) R(px, ty0 + 6, 4, 22, '#2a1f1f');
      R(TS, ty0 + 10, A.w - 2 * TS, 2, '#6b7285'); R(TS, ty0 + 22, A.w - 2 * TS, 2, '#6b7285'); R(TS, ty0 + 10, A.w - 2 * TS, 1, '#a9b0c4'); R(TS, ty0 + 22, A.w - 2 * TS, 1, '#a9b0c4');
    }
    if (A.theme === 'depot') for (let px = TS; px < A.w - TS; px += 8) { R(px, 2 * TS, 4, 3, P.y); R(px + 4, 2 * TS, 4, 3, P.k); }
    // 上墙立面
    const fy = 0, fh = 2 * TS;
    R(0, fy, A.w, fh, th.face[0]);
    for (let px = 0; px < A.w; px += 16) R(px, fy + 4, 1, fh - 6, '#00000040');
    R(0, fy, A.w, 3, '#0a0b12'); R(0, fh - 3, A.w, 3, '#12141f'); R(0, fh - 4, A.w, 1, '#ffffff14');
    // 招牌与店面
    let px = TS + rng.int(0, 16);
    while (px < A.w - 64) {
      const kind = rng.pick(A.theme === 'mall' ? ['sign', 'sign', 'shutter'] : A.theme === 'platform' ? ['sign', 'poster', 'map'] : ['shutter', 'hazard', 'sign']);
      if (kind === 'sign') {
        const col = rng.pick(th.neon), sw = rng.int(28, 46);
        R(px, 6, sw, 12, '#0d0e18'); neonGlyphs(x, ex, px + 3, 8, sw - 6, col, rng);
        A.signs.push({ x: px + sw / 2, y: 12, col });
        px += sw + rng.int(10, 24);
      } else if (kind === 'shutter') {
        const sw = rng.int(36, 56); R(px, 4, sw, fh - 6, '#3a3f52'); for (let j = 6; j < fh - 3; j += 2) R(px, j, sw, 1, '#2a2e3d'); R(px, fh - 6, sw, 2, '#14161f');
        if (rng.chance(0.5)) R(px + rng.int(4, sw - 10), rng.int(10, 20), rng.int(5, 9), 2, D.rgba(rng.pick(['#ff3d8b', '#ffb057']), 0.7));
        px += sw + rng.int(8, 16);
      } else if (kind === 'poster') {
        R(px, 7, 18, 20, '#c9b79a'); R(px + 2, 9, 14, 8, rng.pick(['#b8432f', '#3a6fa8', '#5c3b8a'])); R(px + 2, 19, 10, 1, '#5e3d36'); R(px + 2, 22, 13, 1, '#5e3d36'); R(px + 12, 7, 6, 4, th.face[0]);
        px += 18 + rng.int(14, 30);
      } else if (kind === 'map') { // 线路图
        R(px, 6, 40, 20, '#d9dde8'); R(px + 3, 15, 34, 2, '#ff3047'); R(px + 3, 11, 20, 2, '#3a6fa8'); R(px + 21, 11, 2, 8, '#3a6fa8'); for (let i = 0; i < 6; i++) R(px + 4 + i * 6, 14, 3, 4, '#ffffff');
        px += 40 + rng.int(14, 30);
      } else {
        for (let i = 0; i < 30; i += 6) { R(px + i, 20, 3, 6, P.y); R(px + i + 3, 20, 3, 6, P.k); }
        px += 30 + rng.int(14, 30);
      }
    }
    // 墙顶边与左右墙
    R(0, 0, TS - 2, A.h, th.wall); R(A.w - TS + 2, 0, TS - 2, A.h, th.wall);
    R(TS - 2, 2 * TS, 2, A.h - 2 * TS, '#0a0b12'); R(A.w - TS, 2 * TS, 2, A.h - 2 * TS, '#0a0b12');
    R(0, A.h - TS + 4, A.w, TS - 4, th.wall); R(0, A.h - TS + 4, A.w, 2, '#0a0b12');
    // 墙脚阴影
    for (let i = 0; i < 6; i++) R(TS, 2 * TS + i, A.w - 2 * TS, 1, `rgba(5,5,12,${0.5 - i * 0.08})`);
  }
  // 霓虹假字：几笔横竖拼成的方块字
  function neonGlyphs(x, ex, px, py, w, col, rng) {
    const n = Math.max(2, Math.floor(w / 9));
    for (let i = 0; i < n; i++) {
      const gx = px + i * 9;
      const strokes = rng.int(3, 5);
      for (let s = 0; s < strokes; s++) {
        const hz = rng.chance(0.5), a = rng.int(0, 6), b = rng.int(0, 6), len = rng.int(3, 7);
        const rw = hz ? Math.min(len, 7 - a) : 1, rh = hz ? 1 : Math.min(len, 7 - b);
        x.fillStyle = col; x.fillRect(gx + a, py + b, rw, rh); ex.fillStyle = col; ex.fillRect(gx + a, py + b, rw, rh);
      }
    }
  }
})(D);
