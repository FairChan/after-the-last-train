/* 站内地图第二代 P5 · 前景遮挡、灯按柱网排、光柱、飘灰（design/features/station-gen/plan-p5.md 任务 2；设计文档 5.6 节）
   只对新画法的楼层（F.floorArt === 'gen2'，见 tiles.js）。
   - 前景物 F.fore = [{ x, y, w, h, kind, img, emit, al }]（世界坐标；img / emit 是 D.mkSprite 画好的图）：
       beam  大厅沿柱网的横梁：每排柱子（同一行的柱子）上方横跨大厅，梁底正好压在柱顶上；柱头（比柱子宽一圈的方块）和
             柱子之间垂下来的电缆画在同一张图里；
       sign  吊在横梁下面的导向牌（列车图标 + 箭头，指下站台的楼梯；箭头的挑法同 wayfind.js 的 wayDir，挑不出来就不挂）。
       gsign 吊在闸机排正上方的"进站 / 出站"标志（闸机排上方两排内没有墙挂它的时候，见 wayfind.js）。
       横梁、吊牌躲开墙上的牌子（导向牌、闸机标志、封死的出口和出口牌、亮着的招牌）：梁碰到那几列就断开，每段至少架在一根柱子上（审稿修复 I4）。
     G2.planFore(F) 在 bake 里建（只读格子和柱子，不用随机数）。每帧 G2.drawFore(ctx, ex, S, time)（draw.js 在人物、敌人画完之后、
     Post 之前调）只画相机里的；玩家（本机这个）的身子和它（往下扩 24）相交，或者正在互动的东西在它下面，透明度按 0.25 秒
     插值淡到 0.2，离开回到 0.9（同一层的联机队友在下面也淡出）。
   - 灯：G2.layLamps(F, r, olds, dim) 由 level.js 的 decorate 调：旧画法这间房的灯照旧算（父流取的数一个不少），交进来换位置——
       大厅每个柱网格的中心一盏吊灯，其余房间按用途一排或两排（高的房间两排）；盏数和旧画法这间房比 ±25% 以内；
       坏不坏、闪不闪按旧灯一盏盏接过来（暗房间、停电站照旧大多坏着）。灯具效果直接套 lightfx.js 的（hang_bulb、cone_*、tube_*、downlight……），
       位置按"挂在天花板上"算：灯在地面点往上约 58，光斑落在地面点上。大厅里好的吊灯一半带光柱（F.shafts）。
   - 光柱：G2.drawShafts(ex, A, time)：旧 shaft 的画法（上窄下宽的渐变梯形）加一层很淡的 4×4 抖动点阵，画在发光层。
   - P6：站台层、换乘层的站台（kind platform）也按柱网挂横梁、吊牌（吊牌指出口 = 上楼的楼梯，出口图标），灯同大厅（柱网格中心、一半带光柱）。
     P6 任务 2：旧骨架楼层（dress.js，F.floorArt = 'dress'）按 G2.roomKind 对照（换乘枢纽的中庭 = 大厅）也挂。
   - 飘灰：G2.moteAt(A, m, i)：draw.js 画 S.motes 时，新画法楼层四粒里三粒按灯聚集（挂在第 i % 灯数 盏灯下面的光锥里上飘、循环），
     一粒照旧散在全图（暗处少）。总数不变（70），更新和随机数不动，只改画在哪。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, G2 = D.gen2 = D.gen2 || {};
  const hh = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  const CEIL = 58; // 天花板离地多高（世界单位）：柱子画 44 高，梁压在柱顶上，灯挂得比梁略高

  // ── 前景物
  const SPR = new Map();
  const sprOf = (key, w, h, fn, noOutline) => { let s = SPR.get(key); if (!s) { s = D.mkSprite(w, h, fn, noOutline); SPR.set(key, s); } return s; };
  G2.planFore = function (F) {
    const out = F.fore = [], W = F.tw, H = F.tht, R = D.RAMP;
    if (!F.floorArt) return out;
    const sp = F.g2floor ? F.stairs.find(s => s.dir === 'up') : F.stairs.find(s => s.to === 1) || F.stairs[0], fd = sp ? D.flowField(F, sp.x, sp.y) : null;
    const wk = F.g2floor ? 'exit' : 'platform'; // P6：站台层、换乘层的吊牌指出口（上楼的楼梯）
    // 审稿修复 I4：横梁、吊牌不盖住墙上的牌子——导向牌、闸机标志、封死的出口和它上面那排（出口牌）、亮着的招牌（它们的光也不被横梁挖掉）。这些格的矩形（世界坐标）：
    const blk = [], cellR = (tx, ty) => blk.push([tx * TS, ty * TS, tx * TS + TS, ty * TS + TS]);
    for (const s of F.wayfind || []) cellR(s.tx, s.ty);
    for (const g of F.gateSigns || []) if (!g.hang) cellR(g.tx, g.ty);
    for (const s of F.wallLit || []) for (let a = 0; a < s.w; a++) cellR(s.x + a, s.y);
    for (const e of F.exits || []) for (let y = e.y - 1; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) cellR(x, y);
    const hitR = (x0, y0, x1, y1) => blk.some(b => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);
    // 审稿修复 M2：闸机排上方两排内没有墙挂"进站 / 出站"标志的，吊在闸机排正上方（planWayfinding 标了 hang）；挂不下（会盖住墙上的牌子）就不挂
    if (F.gateSigns && G2.gateSprite) F.gateSigns = F.gateSigns.filter(g => {
      if (!g.hang) return true;
      const s = sprOf('gsign|' + g.side, 32, 25, p => { p.rect(7, 0, 1, 10, '#646e86'); p.rect(24, 0, 1, 10, '#646e86'); p.rect(8, 0, 1, 10, '#2d3342'); p.rect(25, 0, 1, 10, '#2d3342'); }, true), gs = G2.gateSprite(g.side);
      if (!s.full) { const [c, x] = D.canvas(32, 25); x.drawImage(s.img, 0, 0); x.drawImage(gs.img, 0, 10); let e = null; if (gs.emit) { const [ec, ecx] = D.canvas(32, 25); ecx.drawImage(gs.emit, 0, 10); e = ec; } s.full = { img: c, emit: e }; } // 两根吊杆（细线）+ 墙上那块同样的牌子
      const o = { x: g.tx * TS, y: g.ty * TS + 2 * TS - 44, w: 16, h: 12.5, kind: 'gsign', tx: g.tx, ty: g.ty, img: s.full.img, emit: s.full.emit, al: 0.9 }; // 闸机排的地面点往上 44（同梁下的吊牌）
      if (o.y < 0 || hitR(o.x, o.y, o.x + o.w, o.y + o.h)) return false;
      out.push(o); blk.push([o.x, o.y, o.x + o.w, o.y + o.h]); return true;
    });
    for (const r of F.rooms) {
      const rk = G2.roomKind ? G2.roomKind(F, r) : r.kind; // P6：旧骨架楼层（dress.js）的中庭算大厅
      if (rk !== 'hall' && rk !== 'platform') continue;
      const rows = new Map();
      for (const p of F.props) {
        if (p.kind !== 'pillar' || !p.grid) continue;
        const tx = Math.floor(p.x / TS), ty = Math.floor((p.y - 1) / TS);
        if (tx < 0 || ty < 0 || tx >= W || ty >= H || F.room[ty * W + tx] !== r.i) continue;
        if (!rows.has(ty)) rows.set(ty, []); rows.get(ty).push(tx);
      }
      for (const [ty, xs0] of rows) {
        const xs = xs0.sort((a, b) => a - b), inHall = x => x >= 0 && x < W && (F.room[ty * W + x] === r.i || xs.includes(x));
        let x0 = xs[0], x1 = xs[xs.length - 1];
        while (inHall(x0 - 1)) x0--; while (inHall(x1 + 1)) x1++;
        const top = ty * TS + TS - 44, by = top - 9; // 柱顶 = 柱脚往上 44；梁 9 高压在柱顶上
        if (by < 0) continue;
        // 梁在这排横跨大厅；碰到挂着牌子的那几列就断开（端板顶在那面墙上），每一段至少架在一根柱子上
        const bad = c => hitR(c * TS, by, c * TS + TS, by + 24);
        for (let a = x0; a <= x1; a++) {
          if (bad(a)) continue;
          let b = a; while (b + 1 <= x1 && !bad(b + 1)) b++;
          const seg = xs.filter(x => x >= a && x <= b);
          if (seg.length && b > a) beam(ty, top, by, a, b, seg, bad(a - 1) ? 0 : 6, bad(b + 1) ? 0 : 6);
          a = b;
        }
      }
    }
    return out;
    function beam(ty, top, by, x0, x1, xs, eL, eR) {
      const bx = x0 * TS - eL, bw = (x1 - x0 + 1) * TS + eL + eR;
      if (bx < 0 || bx + bw > F.w) return;
      const pw = bw * Z, ph = 24 * Z, caps = xs.map(x => (x * TS + 8 - bx) * Z), hs = hh(bx, by, W);
      // 梁的图由几块缓存好的画板图拼起来（一段 32 宽的梁身、柱头、每跨的电缆都用 D.mkSprite 画一次缓存），每座站只新建一张画布、贴几十下
      const [cv, g] = D.canvas(pw, ph), v = hs & 3;
      const seg = sprOf('bseg|' + v, 64, 16, p => {
        p.box(0, 0, 64, 5, R.steel, { v: 0.72 }); p.box(0, 5, 64, 6, R.gunmetal, { v: 0.42 }); p.box(0, 11, 64, 4, R.steel, { v: 0.5 }); // 工字钢梁：上翼缘亮、腹板暗、下翼缘
        for (let x = 6 + v * 2; x < 64; x += 16) p.box(x, 5, 3, 6, R.steel, { v: 0.6 }); // 腹板上的加劲肋
        for (const x of [10 + v, 42 + v]) { p.px(x, 2, '#dbe5fa'); p.px(x + 1, 3, '#161a2a'); p.px(x, 12, '#a3b6dc'); } // 螺栓
      });
      for (let x = 0; x < pw; x += 64) g.drawImage(seg.img, x, 0);
      const end = sprOf('bend', 6, 16, p => p.box(0, 0, 6, 15, R.dark, { v: 0.5, r: 1 })); g.drawImage(end.img, 0, 0); g.drawImage(end.img, pw - 6, 0); // 两头插进墙里的端板
      for (let k = 0; k + 1 < caps.length; k++) { // 柱子之间垂下来的两根电缆
        const a = caps[k] + 22, b = caps[k + 1] - 22, L = b - a; if (L < 12) continue;
        const cab = sprOf('cab|' + L + '|' + v, L + 1, ph - 12, p => { for (const [sag, col] of [[7 + v, '#2a1c10'], [4 + ((v + 1) & 3), '#3a2a40']]) for (let x = 0; x <= L; x++) { const u = x / L, y = 2 + Math.round(4 * sag * u * (1 - u) * (ph - 16) / 12); p.px(x, Math.min(ph - 14, y), col); } }, true);
        g.drawImage(cab.img, a, 12);
      }
      const cap = sprOf('bcap', 40, 9, p => { p.box(0, 0, 40, 9, R.dark, { v: 0.8, r: 1 }); p.rect(2, 1, 36, 1, '#3d4766'); }); // 柱头：比柱子宽一圈的方块
      for (const cx of caps) g.drawImage(cap.img, cx - 20, 12);
      out.push({ x: bx, y: by, w: bw, h: 24, kind: 'beam', row: ty, img: cv, emit: null, al: 0.9 });
      // 吊在梁下的导向牌（每排一块）：从这段中间往两边找一格，箭头挑得出来、正下方不是柱子
      if (!fd || !G2.wayDir || !G2.WAY_ARROW) return;
      const mid = (x0 + x1) >> 1;
      for (let d = 0; d <= (x1 - x0) >> 1; d++) for (const tx of d ? [mid - d, mid + d] : [mid]) {
        if (out.some(o => o.kind === 'sign' && o.row === ty) || tx < x0 + 1 || tx > x1 - 1 || xs.some(x => Math.abs(x - tx) <= 1)) continue;
        const i = ty * W + tx; if (F.kind[i] !== 0) continue;
        const sx = tx * TS + 8 - 11; if (hitR(sx, top, sx + 22, top + 13)) continue;
        const dir = G2.wayDir(F, fd.dist, i); if (!dir || (!dir[0] && !dir[1])) continue;
        const s = sprOf('hsign|' + wk + '|' + dir.join(','), 44, 26, p => {
          p.rect(8, 0, 2, 6, '#646e86'); p.rect(34, 0, 2, 6, '#646e86');
          p.box(0, 5, 44, 21, R.dark, { r: 2, v: 0.55 });
          const ic = G2.WAY_ICON[wk], ar = G2.WAY_ARROW[dir.join(',')], col = G2.WAY_COL[wk];
          ic.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') p.px(4 + x, 12 + y, col, 1); }));
          ar.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') p.px(30 + x, 11 + y, '#e6f6ff', 1); }));
        });
        out.push({ x: sx, y: top, w: 22, h: 13, kind: 'sign', row: ty, tx, ty, dir, img: s.img, emit: s.emit, al: 0.9 });
      }
    }
  };

  G2.drawFore = function (ctx, ex, S, time) {
    const A = S.A, fo = A && A.fore; if (!fo || !fo.length) return;
    const dt = Math.max(0, Math.min(0.1, time - (A._foreT == null ? time : A._foreT))); A._foreT = time;
    const p = S.player, cx = S.cam.x, cy = S.cam.y, vw = D.W / Z, vh = D.H / Z;
    const hit = (o, x0, y0, x1, y1) => x0 < o.x + o.w && x1 > o.x && y0 < o.y + o.h + 24 && y1 > o.y;
    const nr = S.near && S.near.x != null ? S.near : S.lootOpen && S.lootOpen.x != null ? S.lootOpen : null;
    // 审稿修复 M1：本机玩家和同一层的联机队友（倒地的也算）谁在下面都淡出
    const ps = p && p.hp > 0 && !p.out ? [p] : [];
    if (S.players && S.players.length > 1) for (const q of S.players) if (q !== p && !q.out && (q.hp > 0 || q.down) && (q.f == null || q.f === S.f)) ps.push(q);
    for (const o of fo) {
      const under = ps.some(q => hit(o, q.x - 7, q.y - 22, q.x + 7, q.y)) || (nr && hit(o, nr.x - 8, nr.y - 20, nr.x + 8, nr.y));
      const tg = under ? 0.2 : 0.9, step = dt / 0.25 * 0.7;
      o.al = o.al == null ? tg : o.al < tg ? Math.min(tg, o.al + step) : Math.max(tg, o.al - step);
      if (o.x > cx + vw || o.x + o.w < cx || o.y > cy + vh || o.y + o.h < cy) continue;
      ctx.globalAlpha = o.al; ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
      ex.globalCompositeOperation = 'destination-out'; ex.globalAlpha = o.al; ex.drawImage(o.img, o.x, o.y, o.w, o.h); ex.globalCompositeOperation = 'source-over'; // 挡住后面的光
      if (o.emit) { ex.globalAlpha = o.al * 0.8; ex.drawImage(o.emit, o.x, o.y, o.w, o.h); }
    }
    ctx.globalAlpha = 1; ex.globalAlpha = 1;
  };

  // ── 灯
  const FX_OK = { hall: ['hang_bulb', 'cone_warm', 'cone_dust', 'hang_swing'], platform: ['hang_bulb', 'cone_warm', 'cone_dust', 'hang_swing'], storage: ['tube_buzz', 'tube_flicker'], workshop: ['tube_buzz', 'tube_flicker'], factory: ['tube_buzz', 'tube_cold'], hidden: ['hang_swing', 'tube_dying'], arsenal: ['tube_cold', 'tube_buzz'], secure: ['tube_cold', 'downlight'],
    medic: ['tube_hospital'], power: ['tube_cold', 'tube_buzz'], server: ['tube_cold', 'downlight'], control: ['downlight', 'tube_cold'], security: ['downlight', 'tube_cold'], ticket: ['tube_cold', 'downlight'], shop: ['downlight', 'tube_warm'],
    vault: ['spot_narrow', 'downlight'], jewelry: ['spot_narrow', 'downlight'], gallery: ['spot_narrow', 'downlight'] };
  const FX_BAD = { hall: 'cone_broken', medic: 'tube_flicker', vault: 'downlight_flicker', jewelry: 'downlight_flicker', gallery: 'downlight_flicker', control: 'downlight_flicker', security: 'downlight_flicker', shop: 'downlight_flicker' };
  const TUBEY = new Set(['storage', 'workshop', 'factory', 'hidden', 'arsenal', 'secure', 'power', 'server', 'ticket']);
  // 灯具离地面点多远落光斑（同 lightfx.js 各形状的算法）
  const dropOf = (d, l) => d.shape === 'hang' ? 22 : d.shape === 'cone' ? Math.round(14 + (l.spread || 30) * 0.5) : d.shape === 'strip' ? 12 : d.shape === 'spot' ? Math.round((l.lenC || 110) * 0.32) : 16;
  G2.layLamps = function (F, r, olds, dim) {
    const W = F.tw, own = (x, y) => x >= 0 && y >= 0 && x < W && y < F.tht && F.room[y * W + x] === r.i && F.kind[y * W + x] === 0;
    const n0 = olds.length; if (!n0) return [];
    const lo = Math.max(1, Math.round(n0 * 0.75)), hi = Math.max(1, Math.round(n0 * 1.25));
    let pts = [];
    if (r.kind === 'hall' || r.kind === 'platform') { // 柱网格的中心（P6：站台也是）
      const xs = [], ys = [];
      for (const p of F.props) { if (p.kind !== 'pillar' || !p.grid) continue; const tx = Math.floor(p.x / TS), ty = Math.floor((p.y - 1) / TS); if (F.room[ty * W + tx] !== r.i) continue; if (!xs.includes(tx)) xs.push(tx); if (!ys.includes(ty)) ys.push(ty); }
      xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
      const mids = (a, lo2, hi2) => { if (!a.length) return [(lo2 + hi2) / 2]; const m = []; const e = [lo2 - 1].concat(a, [hi2 + 1]); for (let k = 0; k + 1 < e.length; k++) if (e[k + 1] - e[k] >= 4) m.push((e[k] + e[k + 1]) / 2); return m; };
      for (const y of mids(ys, r.y + 1, r.y + r.h - 2)) for (const x of mids(xs, r.x + 1, r.x + r.w - 2)) pts.push([x, y]);
    } else { // 一排或两排（高的房间两排），6 格一盏
      const rows = r.h >= 9 ? [r.y + r.h * 0.33, r.y + r.h * 0.7] : [r.y + r.h * 0.55];
      for (const y of rows) { const n = Math.max(1, Math.round((r.w - 2) / 6)); for (let k = 0; k < n; k++) pts.push([r.x + 1 + (r.w - 2) * (k + 0.5) / n, y]); }
    }
    // 盏数收进旧灯的 ±25%：多了均匀抽掉，少了在相邻两盏中间补
    if (dim) pts = [pts[Math.floor(pts.length / 2)] || [r.x + r.w / 2, r.y + r.h / 2]];
    else {
      let guard = 0; while (pts.length < lo && guard++ < 8) { const add = []; for (let k = 0; k + 1 < pts.length; k++) add.push([(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2]); if (!add.length) add.push([r.x + r.w / 2, r.y + r.h / 2]); pts = pts.concat(add.slice(0, lo - pts.length)); }
      if (pts.length > hi) { const keep = []; for (let k = 0; k < hi; k++) keep.push(pts[Math.floor((k + 0.5) * pts.length / hi)]); pts = keep; }
    }
    const out = [];
    pts.forEach(([fx, fy], k) => {
      let tx = Math.floor(fx), ty = Math.floor(fy);
      if (!own(tx, ty)) { let best = null, bd = 1e9; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (own(x, y)) { const d = Math.hypot(x - fx, y - fy); if (d < bd) { bd = d; best = [x, y]; } } if (!best) return; [tx, ty] = best; }
      const L0 = olds[k % n0], broken = L0.flick > 0.3;
      const make = (tx, ty) => {
        const gx = tx * TS + 8, gy = ty * TS + 10, h = hh(tx, ty, r.i);
        let top = r.y; for (let y = ty; y >= r.y; y--) if (own(tx, y)) top = y; // 这一列本房间最上面那格：灯不挂到房间外面的墙上去
        const ceil = Math.min(CEIL, gy - top * TS + 6);
        let name = broken ? (FX_BAD[r.kind] || (TUBEY.has(r.kind) ? 'tube_dying' : 'cone_broken')) : (FX_OK[r.kind] || ['cone_warm', 'downlight'])[h % (FX_OK[r.kind] || [0, 0]).length];
        if (ceil < 56 && !/^downlight|^spot/.test(name)) name = broken ? 'downlight_flicker' : 'downlight'; // 矮的地方挂不下带墙光的灯具：换筒灯
        const L = { x: gx, y: gy - ceil, oy: 40, r: L0.r, col: L0.col, a: L0.a, flick: L0.flick, seed: L0.seed, kind: 'room', g2lamp: true, gy };
        const d = D.LFX && D.LFX.apply(L, name, (h % 997) / 31); if (!d) return null;
        L.wb = gy - dropOf(d, L);
        return L;
      };
      // 整套测试修复：几个点贴到同一格（房间形状不规则时都退到最近的本房间格）会叠出两三盏，和隔壁房间同一排的灯也会挤在一起——
      // 横向 38 以内、同一排（或挂点同高）的已经有灯，就在这一排左右 4 格里找个不挤的格；找不到：这间房已有灯就不放，一盏都没有就照放
      const crowd = L => out.concat(F.lights).some(o => o.kind === 'room' && o.fx && Math.abs(o.x - L.x) < 38 && (Math.abs((o.gy == null ? o.wb : o.gy) - (o.gy == null ? L.wb : L.gy)) < (o.gy == null ? 1 : TS)));
      let L = make(tx, ty); if (!L) return;
      if (crowd(L)) {
        let alt = null;
        for (let dx = 1; dx <= 4 && !alt; dx++) for (const sx of [dx, -dx]) { if (!own(tx + sx, ty)) continue; const q = make(tx + sx, ty); if (q && !crowd(q)) { alt = q; break; } }
        if (alt) L = alt; else if (out.length) return;
      }
      if ((r.kind === 'hall' || r.kind === 'platform') && !broken && k % 2 === 0) L.shaft2 = true;
      out.push(L);
    });
    return out;
  };

  // ── 光柱：大厅的好吊灯往下一道上窄下宽的光（旧 shaft 的画法），再叠一层很淡的抖动点阵（发光层）
  let PAT = null;
  const pattern = ex => { if (!PAT) { const [c, x] = D.canvas(4, 4), B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; for (let i = 0; i < 16; i++) if (B[i] < 6) { x.fillStyle = '#ffffff'; x.fillRect(i & 3, i >> 2, 1, 1); } PAT = c; } return ex.createPattern(PAT, 'repeat'); };
  G2.drawShafts = function (ex, A, time, flick) {
    const cx = A._camX, cy = A._camY, vw = D.W / Z, vh = D.H / Z; let pat = null;
    for (const l of A.lights) {
      if (!l.shaft2) continue;
      const x = l.x, y = l.y + 14, y1 = l.gy + 6; if (x + 40 < cx || x - 40 > cx + vw || y1 < cy || y > cy + vh) continue;
      const fl = flick ? flick(l, time) : 1, a = 0.1 * fl;
      const g = ex.createLinearGradient(0, y, 0, y1); g.addColorStop(0, D.rgba(l.col, a)); g.addColorStop(1, D.rgba(l.col, 0));
      ex.beginPath(); ex.moveTo(x - 4, y); ex.lineTo(x + 4, y); ex.lineTo(x + 24, y1); ex.lineTo(x - 24, y1); ex.closePath();
      ex.fillStyle = g; ex.fill();
      if (!pat) pat = pattern(ex);
      ex.save(); ex.clip(); ex.globalAlpha = 0.05 * fl; ex.fillStyle = pat; ex.fillRect(x - 24, y, 48, y1 - y); ex.restore();
    }
  };

  // ── 飘灰：挂在灯下面（见文件头）。返回 [x, y, 亮度倍数]
  G2.moteAt = function (A, m, i) {
    let an = A._moteAn;
    if (!an || A._moteN !== A.lights.length) { A._moteN = A.lights.length; an = A._moteAn = A.lights.filter(l => l.g2lamp && l.flick <= 0.3); if (!an.length) an = A._moteAn = A.lights.filter(l => l.g2lamp); } // 审稿 M9：灯变了（运行时加减灯）重新挑
    if (!an.length || i % 4 === 3) return [m.x, m.y, 0.6];
    const L = an[i % an.length], span = Math.max(20, (L.gy || L.y + 50) - L.y - 6), u = (((m.y * 0.9) % span) + span) % span, k = u / span;
    const w = 4 + 18 * k, ox = ((((m.x * 3.7) % (2 * w)) + 2 * w) % (2 * w)) - w;
    return [L.x + ox, L.y + 8 + u, 0.5 + Math.sin(Math.PI * k) * 0.9];
  };

})(D);
