/* Underdog：上下楼梯像真人在走，和只下不上的电梯。
   楼梯：按 F 不再当场换层——自己走到楼梯口，一级一级走（一步一顿、身子一沉一起、脚步声）；往下走时从脚开始没进楼梯井、越来越暗，
        往上走时爬到楼梯顶、没进上面的光里；换层（floorfx.js 的过渡照旧）以后，再从新楼层的楼梯口一步步走出来，才交回操作。
   电梯：有两层以上（检修管道不算）的站，每层楼梯旁边一部电梯。一开始都没通电，走楼梯上到顶层以后通电，之后每层都能坐，上下都行。
        第三人称：门开 → 机器人走进去、转身 → 选楼层 → 关门 → 切到电梯井剖面：楼板一层层掠过、两边是各层的房间、配重往反方向走，
        你的机器人站在切开的轿厢里往下（或往上）走 → 叮 → 回到楼层，门开、走出来、门关上。坐电梯时世界是停的。
   挂钩：D.enterStation（放电梯）、D.stepStation（走楼梯时不收操作、坐电梯时世界停住）、K.candX（电梯的 F 候选）、station.js 的楼梯 F（K.startStairs）、
        D.drawStation（电梯井剖面）、draw.js 的楼梯画法（D.drawStairArt）和画主角（D.stairDraw）、D.drawExtras（画电梯）、
        披风（cape.js 的 K.scarf、K.capeSync：坐电梯和走楼梯时布也要跟着人走）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, TS = 16, K = D.K || (D.K = {});
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const STEP = 0.12, NSTEP = 5, HOLD = 0.28; // 每级 0.12 秒；换层后先等旧楼层淡掉（floorfx.js）再从楼梯口出来

  // ── 楼层高度：从站厅层（0）顺着楼梯走，下楼 -1、上楼 +1。楼层号：站厅 B1、站台 B2……大厦大堂 1F、办公层 2F
  function heights(S) { const h = new Map([[0, 0]]), q = [0]; while (q.length) { const f = q.shift(); for (const s of S.floors[f].stairs) { if (s.to == null || s.to < 0 || !S.floors[s.to] || h.has(s.to)) continue; h.set(s.to, h.get(f) + (s.dir === 'up' ? 1 : -1)); q.push(s.to); } } return h; }
  D.floorTag = h => h > 0 ? h + 'F' : 'B' + (1 - h);
  // ── 放电梯：每层楼梯旁边，尽量嵌在北边的墙里（门朝南，看得见门）；找不到墙就立在空地上。最高那层能进，其余只能出
  const isPipe = F => F.theme === 'pipe' || F.name === '检修管道';
  function reach(F) { // 从第一个楼梯口能走到的格子数
    const s0 = F.stairs[0]; if (!s0) return 0; const seen = new Uint8Array(F.tw * F.tht), q = [[Math.floor(s0.x / TS), Math.floor(s0.y / TS) + 1]], pass = i => F.solid[i] === 0 || F.kind[i] === 3; let n = 0;
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * F.tw + nx; if (nx < 0 || ny < 0 || nx >= F.tw || ny >= F.tht || seen[i] || !pass(i)) continue; seen[i] = 1; n++; q.push([nx, ny]); } }
    return n;
  }
  function placeLifts(S) {
    const H = heights(S), seen = new Set(), fl = [...H.keys()].filter(i => !isPipe(S.floors[i])).sort((a, b) => H.get(b) - H.get(a)).filter(i => !seen.has(H.get(i)) && seen.add(H.get(i)));
    if (fl.length < 2) return;
    const top = fl[0], DX = [44, -44, 64, -64, 84, -84, 104, -104, 128, -128];
    for (const fi of fl) {
      const F = S.floors[fi], so = (x, y) => D.solidAt(F, x, y);
      const clear = (x, y0, y1) => { for (let dx = -14; dx <= 14; dx += 4) for (let y = y0; y <= y1; y += 4) if (so(x + dx, y)) return false; return true; };
      // 站内地图第二代 P5（P3 审稿 M9）：电梯的图（门框 x ±16、y −36…+2）不许盖住摆设、招牌、导向牌、封死的出口、墙面装饰
      //   摆设只看电梯门框里面那块（x ±10、y −30…0）和摆设本身（四边各缩 2）有没有重叠：挨着站一点点不算挡
      const blk = [], pblk = []; const box = (x0, y0, x1, y1) => blk.push([x0, y0, x1, y1]), cell = (tx, ty) => box(tx * TS, ty * TS, tx * TS + TS, ty * TS + TS);
      for (const p of F.props || []) pblk.push([p.x - p.w / 2 + 2, p.y - p.h + 2, p.x + p.w / 2 - 2, p.y - 2]);
      for (const s of F.signs || []) box(s.x - 12, s.y - 8, s.x + 12, s.y + 10);
      for (const s of F.wayfind || []) cell(s.tx, s.ty); for (const g of F.gateSigns || []) cell(g.tx, g.ty); for (const d of F.wallDeco || []) cell(d.x, d.y);
      for (const e of F.exits || []) for (let yy = e.y; yy < e.y + e.h; yy++) for (let xx = e.x; xx < e.x + e.w; xx++) cell(xx, yy);
      const covers = (x, y) => blk.some(b => x - 16 < b[2] && x + 16 > b[0] && y - 36 < b[3] && y + 2 > b[1]) || pblk.some(b => x - 10 < b[2] && x + 10 > b[0] && y - 30 < b[3] && y > b[1]);
      const okAt = (x, y) => !(x < 40 || y < 40 || x > F.w - 40 || y > F.h - 30 || (F.track && y > (F.track.y0 - 3) * TS) || F.stairs.some(s => Math.hypot(s.x - x, s.y - y) < 36)
        || S.containers.some(c => c.f === fi && Math.hypot(c.x - x, c.y - y) < 30) || S.ground.some(g => g.f === fi && Math.hypot(g.x - x, g.y - y) < 20) || (F.tunnels || []).some(t => Math.abs(t.x - x) < t.w + 20) || covers(x, y));
      const wallAt = (x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return tx < 0 || ty < 0 || tx >= F.tw || ty >= F.tht || F.kind[ty * F.tw + tx] === 1; }; // 真的墙（摆设也是实心格，但不是墙）
      const cands = [];
      for (const st of F.stairs) for (const dx of DX) { // 往北找墙：墙底下要有一整面平墙、墙前面要空
        const x = st.x + dx; let y = st.y; if (so(x, y)) continue;
        for (let k = 0; k < 16 && !so(x, y - TS); k++) y -= TS;
        const wb = (Math.floor((y - TS) / TS) + 1) * TS; if (![-12, -6, 0, 6, 12].every(o => wallAt(x + o, wb - 4))) continue;
        const ly = wb + 12; if (okAt(x, ly) && clear(x, wb + 2, ly + 22)) cands.push({ x, y: ly, wall: true }); }
      for (const st of F.stairs) for (const [ox, oy] of [[44, -6], [-44, -6], [60, 12], [-60, 12], [0, -36], [44, 26], [-44, 26], [80, 0], [-80, 0], [0, 44]]) { const x = st.x + ox, y = st.y + oy; if (okAt(x, y) && clear(x, y - 20, y + 14)) cands.push({ x, y }); }
      // 电梯占两格：占了以后哪儿都还得走得到（不能堵住门口、窄走廊）
      const n0 = reach(F); let at = null;
      for (const c of cands) { const row = Math.floor((c.y - 8) / TS), cells = []; for (let tx = Math.floor((c.x - 10) / TS); tx <= Math.floor((c.x + 10) / TS); tx++) { const i = row * F.tw + tx; if (!F.solid[i]) { cells.push(i); F.solid[i] = 1; } }
        if (reach(F) >= n0 - cells.length) { at = c; at.cells = cells; break; } for (const i of cells) F.solid[i] = 0; }
      if (!at) { if (fi === top) return; continue; }
      F.lift = { x: at.x, y: at.y, wall: !!at.wall, top: fi === top, h: H.get(fi), cells: at.cells };
      for (const e of S.enemies) if (e.f === fi && Math.abs(e.x - at.x) < 16 && e.y > at.y - 24 && e.y < at.y + 4) e.y = at.y + 18; // 别把敌人关在电梯里
    }
    S.liftFloors = fl.filter(i => S.floors[i].lift).map(i => ({ f: i, h: H.get(i), tag: D.floorTag(H.get(i)), name: S.floors[i].name.split(' · ').pop() }));
    if (!S.floors[top].lift || S.liftFloors.length < 2) { for (const F of S.floors) if (F.lift) { for (const i of F.lift.cells || []) F.solid[i] = 0; delete F.lift; } S.liftFloors = null; }
    S.liftOn = !!S.liftFloors && S.f === top; // 进站就在顶层：一进来就通电；不然要先走楼梯上到顶层
  }
  const es0 = D.enterStation;
  D.enterStation = function (R, st, step, o) { const S = es0.apply(this, arguments); if (!(o && o.tut)) { try { placeLifts(S); } catch (e) { if (D.debug) console.error(e); } } return S; };

  // ── 楼梯：走过去、一级级走、换层、从新楼层的楼梯口走出来
  // 楼梯朝哪边走：北边是墙（贴着北墙的楼梯）或南边空着，就往北走进去；贴着南墙的往南走进去。画法和走法都按这个来
  const wn = (A, st) => st.wn != null ? st.wn : (st.wn = D.solidAt(A, st.x, st.y - 18) || !D.solidAt(A, st.x, st.y + 26));
  const ends = (A, st) => wn(A, st) ? [{ x: st.x, y: st.y + 18 }, { x: st.x, y: st.y - 6 }] : [{ x: st.x, y: st.y - 8 }, { x: st.x, y: st.y + 10 }];
  K.startStairs = function (S, st) {
    if (S.stairWalk || S.lift) return;
    const p = S.player, [foot, end] = ends(S.A, st);
    S.stairWalk = { ph: 'in', t: 0, st, down: st.dir === 'down', metal: !!st.hatch || S.A.theme === 'pipe', from: S.f, to: st.to, a: { x: p.x, y: p.y }, foot, end, n: -1, vis: { alpha: 1, sink: 0, lift: 0 } };
    p.inv = Math.max(p.inv, 4); p.vx = p.vy = 0;
  };
  const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  const dirOf = (a, b) => b.y >= a.y ? 1 : -1;
  function walkTo(S, W, a, b, k, dt) { const p = S.player, q = lerp(a, b, k), dy = dirOf(a, b); p.x = q.x; p.y = q.y; p.aim = Math.abs(b.y - a.y) < 2 && Math.abs(b.x - a.x) > 2 ? (b.x > a.x ? 0 : Math.PI) : dy * Math.PI / 2; p.vx = 0; p.vy = dy * 40; p.walk += dt * 11; }
  function stepping(S, W, a, b, dur, dt) { // 一级一级：每一步先抬脚、身子一起，再落下，落下时一声脚步
    const p = S.player, u = Math.min(1, W.t / dur), i = Math.min(NSTEP - 1, Math.floor(u * NSTEP)), us = Math.min(1, (u * NSTEP - i) * 1.6);
    walkTo(S, W, a, b, (i + us) / NSTEP, dt); p.y -= 1.6 * Math.sin(Math.PI * us);
    if (i !== W.n) { W.n = i; sfx(W.metal ? 'stepm' : 'step'); }
    return u;
  }
  function stairStep(S, dt) {
    const W = S.stairWalk, p = S.player; W.t += dt; S.prompt = null;
    if (W.ph === 'in') { const d = Math.hypot(W.foot.x - W.a.x, W.foot.y - W.a.y), dur = D.clamp(d / 90, 0.05, 0.4); walkTo(S, W, W.a, W.foot, Math.min(1, W.t / dur), dt); if (W.t >= dur) { W.ph = 'steps'; W.t = 0; W.n = -1; } return; }
    if (W.ph === 'steps') {
      const u = stepping(S, W, W.foot, W.end, STEP * NSTEP, dt);
      W.vis = W.down ? { alpha: 1 - 0.75 * u, sink: u, lift: 0 } : { alpha: 1 - 0.85 * u * u, sink: 0, lift: u * 6 }; // 往下：从脚开始没进楼梯井；往上：人一级级升高、没进楼上的光里
      if (u >= 1) { // 换层：floorfx.js 的过渡照旧；新楼层从对应的楼梯口走出来
        K.goFloor(S, W.to, { from: W.from, dir: W.st.dir }); W.land = { x: p.x, y: p.y };
        const back = S.A.stairs.find(s => s.to === W.from) || S.A.stairs[0], [f2, e2] = ends(S.A, back);
        W.oa = e2; W.ob = f2; W.up = back.dir === 'up'; // 楼梯反着走一遍：从楼梯井里升上来，或者从楼上一级级下来
        W.ph = 'hold'; W.t = 0; W.n = -1; W.metal = !!back.hatch || S.A.theme === 'pipe'; p.inv = Math.max(p.inv, 2); p.x = W.oa.x; p.y = W.oa.y; W.vis = { alpha: 0, sink: 0, lift: 0 };
      }
      return;
    }
    if (W.ph === 'hold') { p.x = W.oa.x; p.y = W.oa.y; p.vx = p.vy = 0; if (W.t >= HOLD) { W.ph = 'out'; W.t = 0; } return; }
    if (W.ph === 'out') {
      const u = stepping(S, W, W.oa, W.ob, STEP * NSTEP, dt);
      W.vis = W.up ? { alpha: Math.min(1, 0.2 + u * 1.4), sink: 0, lift: (1 - u) * 6 } : { alpha: Math.min(1, 0.25 + u), sink: 1 - u, lift: 0 };
      if (u >= 1) { W.ph = 'walk'; W.t = 0; W.vis = { alpha: 1, sink: 0, lift: 0 }; }
      return;
    }
    if (W.ph === 'walk') { const k = Math.min(1, W.t / 0.2); walkTo(S, W, W.ob, W.land, k, dt); if (k >= 1) { S.stairWalk = null; p.vx = p.vy = 0; p.inv = Math.max(0.4, Math.min(p.inv, 0.6)); } }
  }
  // 画主角：走楼梯时淡出 / 没进楼梯井（从脚开始看不见）/ 往上走时人升高
  D.stairDraw = function (ctx, ex, S, p, draw) {
    const W = S.stairWalk, v = W && W.vis; if (!v || (v.alpha >= 1 && !v.sink && !v.lift)) return draw();
    const cut = p.y + 2 - v.sink * 24, lf = Math.round(v.lift || 0);
    for (const g of [ctx, ex]) { g.save(); g.beginPath(); g.rect(p.x - 30, p.y - 70, 60, cut - (p.y - 70)); g.clip(); g.translate(0, -lf); g.globalAlpha *= Math.max(0, v.alpha); }
    draw();
    ctx.restore(); ex.restore();
  };
  // 楼梯口：往下是有扶手、台阶一级级变暗变窄的楼梯井；往上是一级级往上亮起来的台阶；检修口是带梯子的方口。台阶的方向跟着走法（wn）
  D.drawStairArt = function (ctx, ex, S, st, time, LT) {
    const x = Math.round(st.x), y = Math.round(st.y), R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); }, down = st.dir === 'down', n = wn(S.A, st);
    const band = k => n ? y + 14 - k * 3 : y - 6 + k * 3, row = k => n ? y + 17 - k : y - 6 + k; // 第 k 级（0 = 入口那级）
    if (st.hatch || S.A.theme === 'pipe') {
      R(x - 11, y - 6, 22, 20, P.k); R(x - 10, y - 5, 20, 18, down ? '#07080c' : '#1c2030');
      for (let k = 0; k < 5; k++) R(x - 6, y - 3 + k * 4, 12, 1, down ? '#5a6075' : '#8a94aa'); R(x - 7, y - 5, 1, 18, '#4a5070'); R(x + 6, y - 5, 1, 18, '#4a5070');
      R(x - 11, y - 6, 22, 1, '#e3c14a'); R(x - 11, y + 13, 22, 1, '#e3c14a');
    } else if (down) {
      R(x - 17, y - 8, 34, 27, P.k); R(x - 16, y - 7, 32, 25, '#090a11');
      const C = ['#4c5272', '#3e4462', '#323752', '#272b42', '#1d2034', '#151827', '#0f111c'];
      for (let k = 0; k < 7; k++) { const w = 30 - k * 2, sx = x - (w >> 1); R(sx, band(k), w, 3, C[k]); R(sx, band(k) + (n ? 2 : 0), w, 1, k < 3 ? '#6a7290' : '#2f3450'); }
      for (const s of [-1, 1]) for (let k = 0; k < 22; k++) R(x + s * (16 - Math.floor(k / 3)) - (s > 0 ? 1 : 0), row(k), 1, 1, '#8a94aa');
      R(x - 17, n ? y + 18 : y - 8, 34, 1, '#e3c14a'); // 入口的警示边
    } else {
      R(x - 16, y - 9, 32, 28, P.k);
      const C = ['#2b3048', '#33395a', '#3d4466', '#484f72', '#535b80', '#5e668c', '#6a7298'];
      for (let k = 0; k < 7; k++) { const w = 24 + k, sx = x - (w >> 1); R(sx, band(k), w, 3, C[k]); R(sx, band(k) + (n ? 0 : 2), w, 1, '#8a94aa'); }
      ctx.globalAlpha = 0.35; R(x - 13, n ? y - 8 : y + 14, 26, 4, '#fff2c8'); ctx.globalAlpha = 1; // 楼上的光
      for (const s of [-1, 1]) R(x + s * 15 - (s > 0 ? 1 : 0), y - 8, 1, 26, '#8a94aa');
    }
    // 方向箭头（上 / 下）+ 灯
    ex.fillStyle = D.rgba(P.Y, 0.6 + 0.3 * Math.sin(time * 4)); const ay = y + 3;
    ex.beginPath(); ex.moveTo(x - 4, ay + (down ? 0 : 4)); ex.lineTo(x, ay + (down ? 4 : 0)); ex.lineTo(x + 4, ay + (down ? 0 : 4)); ex.fill();
    if (LT) LT(x, y + 4, 40, P.Y, 0.35);
  };

  // ── 电梯：画在楼层上。轿厢里面（门开着才看得见）先画，人站在里面，再画门框和两扇门（按开了多少往两边滑）
  const de0 = D.drawExtras;
  let doorSpr = null, cabSpr = null;
  const doorSprite = () => doorSpr || (doorSpr = (() => { const [cv, g] = D.canvas(22, 27), X = D.Pix; X.paint(g, 0, 0, 22, 27, (i, j) => { const edge = i === 0 || i === 11; if (edge) return '#a8b0c4'; if (i === 10 || i === 21) return '#2a2e3d'; return X.ramp(['#4c5368', '#5e667e', '#727a92', '#8c94aa'], 0.85 - 0.6 * j / 27 + (X.hash(i, 5) - 0.5) * 0.14, i, j); }); return cv; })());
  const cabSprite = () => cabSpr || (cabSpr = (() => { const [cv, g] = D.canvas(22, 27), X = D.Pix; X.paint(g, 0, 0, 22, 27, (i, j) => { if (j === 0) return '#fff0d4'; if (j >= 24) return j === 24 ? '#8a92a4' : '#22242e'; if (j === 14) return '#c8d0e0'; if (j === 15) return '#5a6278'; return X.ramp(['#3a4052', '#4c5368', '#5e667e', '#727a92'], 0.9 - 0.7 * j / 24 - Math.abs(i - 10.5) / 30 + (X.hash(i, 9) - 0.5) * 0.12, i, j); }); return cv; })());
  D.drawExtras = function (S, list, ctx, ex) {
    if (de0) de0(S, list, ctx, ex);
    const L = S.A && S.A.lift; if (!L) return;
    const x = Math.round(L.x), y = Math.round(L.y), R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); }, op = L.open || 0, on = !!S.liftOn, t = S.t;
    if (op > 0) list.push({ y: y - 30, f: () => { R(x - 12, y - 28, 24, 28, '#14161e'); ctx.drawImage(cabSprite(), x - 11, y - 27); ex.fillStyle = '#6a6250'; ex.fillRect(x - 10, y - 27, 20, 1); } });
    list.push({ y, f: () => {
      // 门框（倒角：左上亮、右下暗）、楼层显示、呼梯按钮、铝门槛、警示条；门洞不填（人可能站在里面）
      R(x - 15, y - 35, 30, 7, P.k); R(x - 15, y - 28, 3, 28, P.k); R(x + 12, y - 28, 3, 28, P.k);
      R(x - 14, y - 34, 28, 6, '#3a4058'); R(x - 14, y - 28, 2, 28, '#3a4058'); R(x + 12, y - 28, 2, 28, '#3a4058');
      R(x - 14, y - 34, 28, 1, '#7a84a0'); R(x - 14, y - 34, 1, 34, '#5a6280'); R(x + 13, y - 34, 1, 34, '#232838');
      if (op < 1) { const o = Math.round(11 * op), d = doorSprite(); ctx.save(); ctx.beginPath(); ctx.rect(x - 11, y - 27, 22, 27); ctx.clip(); ctx.drawImage(d, 0, 0, 11, 27, x - 11 - o, y - 27, 11, 27); ctx.drawImage(d, 11, 0, 11, 27, x + o, y - 27, 11, 27); ctx.restore(); }
      if (op === 0) R(x - 1, y - 27, 1, 27, '#101218');
      R(x - 6, y - 33, 12, 4, '#06070b'); R(x - 6, y - 33, 12, 1, '#5a6278');
      R(x + 14, y - 20, 4, 7, '#1c1f2a'); R(x + 14, y - 20, 4, 1, '#5a6278');
      R(x - 12, y, 24, 1, '#9aa2b4'); for (let k = 0; k < 12; k++) R(x - 12 + k * 2, y + 1, 2, 1, k % 2 ? '#e3c14a' : '#1b1d12'); // 门口的警示条
      if (on) { const a = 0.6 + 0.4 * Math.sin(t * 5); ex.fillStyle = D.rgba('#ffb057', a); ex.fillRect(x - 4, y - 32, 3, 1); ex.fillRect(x - 3, y - 33, 1, 1); ex.fillRect(x + 1, y - 31, 3, 1); ex.fillRect(x + 2, y - 30, 1, 1); ex.fillStyle = '#8dff6a'; ex.fillRect(x + 15, y - 18, 2, 2); } // 通电：上下箭头 + 绿灯
      else { ex.fillStyle = '#ff3d4a'; ex.fillRect(x - 3, y - 31, 6, 1); ex.fillRect(x + 15, y - 18, 2, 2); } // 没通电：红灯
    } });
  };
  // F：到过顶层（通电）以后每层都能进，上下都行；没到过顶层就不开
  const topTag = S => S.liftFloors && S.liftFloors[0] ? S.liftFloors[0].tag : '';
  const cx0 = K.candX;
  K.candX = function (S, add) {
    const L = S.A.lift, p = S.player;
    if (L && !S.stairWalk && !S.lift && Math.abs(p.x - L.x) < 16 && p.y > L.y - 4 && p.y < L.y + 26) {
      const at = { ref: L, x: L.x, y: L.y + 11 };
      if (S.extract) add(Object.assign(at, { key: '', text: '撤离战进行中，守住站台' }));
      else if (!S.liftOn) add(Object.assign(at, { key: '', text: `电梯没通电：先走楼梯上到顶层（${topTag(S)}）` }));
      else add(Object.assign(at, { key: 'F', text: '乘电梯（进去选楼层）', go: inp => { if (inp.interact) startLift(S); } }));
    }
    if (cx0) cx0(S, add);
  };
  function unlock(S) { S.liftOn = true; S.banner = { t: 0, text: '电梯通电了', sub: '到过顶层：每层的电梯都能坐，上下都行' }; sfx('power'); }

  // ── 坐电梯（第三人称）：门开 → 走进去、转身 → 选楼层 → 关门 → 电梯井剖面里往下（或往上）走 → 叮 → 门开 → 走出来 → 门关上
  const DUR = { open0: 0.4, walk: 0.55, turn: 0.15, close: 0.5, ding: 0.3, open: 0.45, exit: 0.45, shut: 0.35 };
  const ease = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  const uiOn = on => { const ui = typeof document !== 'undefined' && document.getElementById('ui'); if (ui) ui.classList.toggle('lift-on', on); }; // 坐电梯时界面只剩选楼层
  function startLift(S) {
    const p = S.player, L = S.A.lift;
    S.lift = { ph: 'open0', t: 0, from: S.f, to: null, hFrom: L.h, a: { x: p.x, y: p.y } };
    p.vx = p.vy = 0; p.inv = Math.max(p.inv, 1); S.hideP = false; uiOn(true); sfx('liftding'); sfx('liftdoor');
  }
  function arrive(S) { // 换到目标层：人在那层的轿厢里，门关着
    const X = S.lift, to = X.to, p = S.player, VW = D.W / D.Z, VH = D.H / D.Z;
    S.f = to; S.A = S.floors[to]; S.floor = S.fxs[to].c; S.fx = S.fxs[to].x; const L = S.A.lift; L.open = 0;
    p.x = L.x; p.y = L.y - 4; p.vx = p.vy = 0; p.aim = Math.PI / 2; p.inv = Math.max(p.inv, 1.5); S.stairCd = S.t + 0.5;
    S.shots = []; S.eshots = []; S.tracers = []; S.shells = []; S.nades = []; S.parts = []; S.mines = []; S.drops = S.drops.filter(d => d.f === to); S.flow = null;
    if (K.resetMotes) K.resetMotes(S);
    S.cam.x = D.clamp(p.x - VW / 2, 0, Math.max(0, S.A.w - VW)); S.cam.y = D.clamp(p.y + 10 - VH / 2, -4, Math.max(0, S.A.h - VH + 20));
    S.banner = { t: 0, text: S.A.name, sub: S.st.name + (X.hTo > X.hFrom ? ' · 坐电梯上来' : ' · 坐电梯下来') }; if (K.markRoom) K.markRoom(S);
    for (const e of S.enemies) if (!e.dead && e.f === to) { e.cd = Math.max(e.cd, 1.2); e.tele = 0; e.act = null; }
  }
  function panel(S) {
    const ui = document.getElementById('ui'); if (!ui || ui.querySelector('.lift-panel')) return;
    const el = document.createElement('div'); el.className = 'lift-panel';
    const opts = S.liftFloors.filter(o => o.f !== S.f);
    el.innerHTML = `<h4>电梯 <em>选楼层</em></h4>${opts.map((o, i) => `<button class="btn lift-b" data-to="${o.f}"><span class="lb">${o.tag}</span> ${o.name}<span class="lk">${o.h > S.liftFloors.find(q => q.f === S.f).h ? '▲' : '▼'} ${i + 1}</span></button>`).join('')}<button class="btn sm" data-x>出去</button>`;
    el.querySelectorAll('[data-to]').forEach(b => b.onclick = () => choose(S, +b.dataset.to));
    el.querySelector('[data-x]').onclick = () => leave(S);
    ui.appendChild(el);
  }
  function closePanel() { const el = document.querySelector('.lift-panel'); if (el) el.remove(); }
  function leave(S) { const X = S.lift; if (!X || X.ph !== 'choose') return; closePanel(); X.ph = 'exit'; X.t = 0; X.a = { x: S.player.x, y: S.player.y }; sfx('click'); }
  function choose(S, to) {
    const X = S.lift; if (!X || X.ph !== 'choose') return;
    X.to = to; X.ph = 'close'; X.t = 0; closePanel(); sfx('click'); sfx('liftdoor');
    const tf = S.liftFloors.find(o => o.f === to); X.hTo = tf ? tf.h : X.hFrom - 1; X.down = D.clamp(0.75 * Math.abs(X.hFrom - X.hTo) + 0.7, 1.4, 3.2);
  }
  K.liftChoose = choose; // 测试用
  function liftStep(S, dt) {
    const X = S.lift, I = D.Input, p = S.player, L = S.A.lift; X.t += dt;
    const into = { x: L.x, y: L.y - 4 }, out = { x: L.x, y: L.y + 14 };
    if (X.ph === 'open0') { L.open = ease(X.t / DUR.open0); if (X.t >= DUR.open0) { X.ph = 'walk'; X.t = 0; X.a = { x: p.x, y: p.y }; } }
    else if (X.ph === 'walk') { walkTo(S, X, X.a, into, ease(X.t / DUR.walk), dt); if (X.t >= DUR.walk) { X.ph = 'turn'; X.t = 0; p.vx = p.vy = 0; sfx('step'); } }
    else if (X.ph === 'turn') { p.aim = Math.PI / 2; if (X.t >= DUR.turn) { X.ph = 'choose'; X.t = 0; panel(S); } }
    else if (X.ph === 'choose') { const opts = S.liftFloors.filter(o => o.f !== S.f); for (let i = 0; i < opts.length; i++) if (I.hit && I.hit('Digit' + (i + 1))) choose(S, opts[i].f); }
    else if (X.ph === 'close') { L.open = 1 - ease(X.t / DUR.close); if (X.t >= DUR.close) { L.open = 0; X.ph = 'down'; X.t = 0; sfx('lift'); } }
    else if (X.ph === 'down') { if (Math.floor((X.t - dt) / 1.3) !== Math.floor(X.t / 1.3)) sfx('lift'); if (X.t >= X.down) { arrive(S); X.ph = 'ding'; X.t = 0; sfx('liftding'); } }
    else if (X.ph === 'ding') { if (X.t >= DUR.ding) { X.ph = 'open'; X.t = 0; sfx('liftdoor'); } }
    else if (X.ph === 'open') { L.open = ease(X.t / DUR.open); if (X.t >= DUR.open) { X.ph = 'exit'; X.t = 0; X.a = { x: p.x, y: p.y }; } }
    else if (X.ph === 'exit') { walkTo(S, X, X.a, out, ease(X.t / DUR.exit), dt); if (X.t >= DUR.exit) { X.ph = 'shut'; X.t = 0; p.vx = p.vy = 0; sfx('liftdoor'); } }
    else if (X.ph === 'shut') { L.open = 1 - ease(X.t / DUR.shut); if (X.t >= DUR.shut) { L.open = 0; S.lift = null; uiOn(false); } }
  }
  const ss0 = D.stepStation;
  D.stepStation = function (S, dt, inp) {
    if (S.lift) { liftStep(S, dt); S.dt = dt; if (K.scarf) K.scarf(S, S.player); return; } // 坐电梯：世界停住，披风照样跟着人走（cape.js）
    if (S.liftFloors && !S.liftOn && !S.stairWalk && S.f === S.liftFloors[0].f) unlock(S); // 到了顶层：电梯通电
    if (S.stairWalk) { const r = ss0.call(this, S, dt, { mx: 0, my: 0 }); if (S.stairWalk) stairStep(S, dt); if (K.capeSync) K.capeSync(S, S.player); return r; } // 走楼梯：不收操作；换层时披风跟着挪过去
    return ss0.apply(this, arguments);
  };
  const ds0 = D.drawStation;
  D.drawStation = function (ctx, S, time) {
    const r = ds0.apply(this, arguments);
    if (!S.lift !== !(typeof document !== 'undefined' && document.querySelector('#ui.lift-on'))) uiOn(!!S.lift); // 保险：读档、换页以后对上
    if (S.lift && S.lift.ph === 'down') drawShaft(ctx, S, time);
    return r;
  };

  // ── 电梯井剖面（往下 / 往上的动画）：从侧面切开整栋楼，中间是电梯井，两边是各层的房间（站厅、站台、换乘层、大堂、办公层……），
  //    楼板一层层掠过，井壁上写着楼层，导轨支架拖出速度线，配重往反方向走，钢缆跟着轿厢；轿厢正面切开，你的机器人站在里面。
  //    画在 320×180（和站里一样一格两像素），机器人用站里同一套图集画在 640×360 上，最后走 Post（抖动光照、泛光、暗角）。
  const SW = 320, SH = 180, FH = 72, SLAB = 6, CY = 116, WX0 = 112, WX1 = 208, IX0 = 122, IX1 = 198, RH = FH - SLAB;
  let sh = null;
  function shInit() {
    if (sh) return sh;
    const X = D.Pix, [c, g] = D.canvas(SW, SH), [e, eg] = D.canvas(SW, SH), [out, ox] = D.canvas(D.W, D.H);
    sh = { c, g, e, eg, out, ox, rooms: {} };
    const [wc, wg] = D.canvas(IX0 - WX0, FH); X.paint(wg, 0, 0, IX0 - WX0, FH, (x, y) => X.ramp(['#16181f', '#20232c', '#2a2e3a', '#353a48'], 0.42 + X.hash(x >> 1, y >> 1) * 0.3 - (x === 0 || x === 9 ? 0.25 : 0), x, y)); sh.wall = wc;
    const [bc, bg2] = D.canvas(IX1 - IX0, FH); X.paint(bg2, 0, 0, IX1 - IX0, FH, (x, y) => X.ramp(['#08090d', '#0e1016', '#14161e'], 0.4 + X.hash(x >> 2, y >> 1) * 0.4, x, y)); sh.back = bc;
    const [kc, kg] = D.canvas(48, 43); X.paint(kg, 0, 0, 48, 43, (x, y) => { if (y === 22) return '#c8d0e0'; if (y === 23) return '#5a6278'; if (x % 16 === 0) return '#3a4052'; return X.ramp(['#3a4052', '#4c5368', '#5e667e', '#727a92', '#8a92a8'], 0.95 - 0.75 * y / 43 - Math.abs(x - 23.5) / 70 + (X.hash(x, 13) - 0.5) * 0.1, x, y); }); sh.car = kc;
    return sh;
  }
  // 这一层是什么房间：按楼层名；车站没有的楼层，顶上是夜空（地面以上）、底下是土
  function kindOf(S, h, minH, maxH) {
    if (h > maxH) return 'sky'; if (h < minH) return 'earth';
    const o = (S.liftFloors || []).find(q => q.h === h); if (!o) return 'pipe';
    const n = S.floors[o.f].name || '';
    return /站台/.test(n) ? 'platform' : /站厅/.test(n) ? 'hall' : /换乘/.test(n) ? 'transfer' : /大堂/.test(n) ? 'lobby' : /办公/.test(n) ? 'office' : 'pipe';
  }
  // 一间房（112×66，side 0 = 井左边、1 = 井右边）：底色、摆设、发光的东西；灯另记（交给 Post）
  function roomTex(kind, side, lineCol) {
    const key = kind + side + (lineCol || ''); if (sh.rooms[key]) return sh.rooms[key];
    const X = D.Pix, w = WX0, h = RH, [c, g] = D.canvas(w, h), [e, eg] = D.canvas(w, h), lights = [];
    const R = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, E = (x, y, ww, hh, col, ecol) => { R(x, y, ww, hh, col); eg.fillStyle = ecol || D.mixHex(col, '#000000', 0.5); eg.fillRect(x, y, ww, hh); };
    const wallP = (cols, fn) => X.paint(g, 0, 0, w, h, (x, y) => (fn && fn(x, y)) || X.ramp(cols, 0.25 + 0.55 * (1 - y / h) + (X.hash(x >> 1, y >> 1) - 0.5) * 0.12, x, y));
    const floorStrip = (col, hi) => { R(0, h - 4, w, 4, col); R(0, h - 4, w, 1, hi); };
    const lamp = (x, col, a) => { E(x, 0, 10, 1, '#e8f0ff', D.mixHex(col, '#000000', 0.35)); R(x + 1, 1, 8, 1, '#3a3e4a'); lights.push({ x: x + 5, y: 3, r: 62, col, a }); };
    const lc = lineCol || '#ff3047';
    if (kind === 'hall') {
      wallP(['#18202e', '#202a3c', '#283448', '#303e56'], (x, y) => (x % 8 === 0 || y % 6 === 0) && y < h - 4 ? '#161c28' : null);
      floorStrip('#2a2c36', '#4a4e60');
      for (const tx of [18, 40, 62]) { R(tx, h - 14, 3, 10, '#5a6278'); R(tx, h - 14, 3, 1, '#8a92a8'); R(tx + 3, h - 11, 8, 2, '#3a3e4c'); E(tx + 1, h - 13, 1, 1, '#5fe07a'); } // 闸机
      E(30, 10, 36, 8, '#dde6f2', '#3a4250'); E(30, 10, 5, 8, lc, D.mixHex(lc, '#000000', 0.4)); for (let k = 0; k < 4; k++) R(38 + k * 6, 13, 4, 1, '#3a3e4a'); // 灯箱指示牌
      lamp(8, '#c8d8ff', 0.65); lamp(84, '#c8d8ff', 0.65);
    } else if (kind === 'platform') {
      wallP(['#141a26', '#1a2232', '#222c40']);
      R(0, h - 9, w, 9, '#2a2c34'); R(0, h - 9, w, 1, '#4a4e5a'); for (let x = 0; x < w; x += 2) R(x, h - 8, 1, 1, '#e3c14a'); // 站台边的盲道黄线
      if (side) { R(0, h - 36, w, 25, '#7a8294'); R(0, h - 36, w, 1, '#aab2c4'); R(0, h - 15, w, 3, lc); R(0, h - 12, w, 3, '#4a5064'); for (let x = 6; x < w - 8; x += 16) { E(x, h - 32, 10, 9, '#ffe2a6', '#5a4a2a'); R(x + 3, h - 29, 2, 6, '#4a3e3a'); } } // 停着的列车
      else { E(20, 14, 14, 20, '#c89a5a', '#3a2a14'); E(60, 14, 14, 20, '#5ab8c8', '#14363c'); R(40, h - 16, 14, 2, '#4a4650'); R(41, h - 14, 1, 5, '#2a2830'); R(52, h - 14, 1, 5, '#2a2830'); } // 广告牌、长椅
      lamp(14, '#d8e4ff', 0.7); lamp(80, '#d8e4ff', 0.7);
    } else if (kind === 'transfer') {
      wallP(['#1a1e2c', '#222838', '#2a3246']); floorStrip('#2a2c36', '#4a4e60');
      X.poly(g, [8, h - 4, 22, h - 4, 86, 8, 72, 8], '#3a4052'); X.poly(g, [8, h - 5, 22, h - 5, 86, 7, 86, 9, 22, h - 3, 8, h - 3], '#5a6278'); // 扶梯
      for (let k = 0; k < 14; k++) { const t = k / 14, x = 12 + t * 66, y = h - 6 - t * 50; R(Math.round(x), Math.round(y), 8, 1, '#262a36'); }
      X.poly(g, [6, h - 14, 10, h - 14, 76, 0, 72, 0], '#2a2e3a'); for (let k = 0; k < 30; k++) { const t = k / 30, x = 8 + t * 66, y = h - 14 - t * 52; eg.fillStyle = '#1e4a56'; eg.fillRect(Math.round(x), Math.round(y), 2, 1); } // 扶手下的灯带
      lamp(90, '#c8d8ff', 0.6);
    } else if (kind === 'lobby') {
      wallP(['#241e24', '#2e262c', '#3a3036', '#463a40']); floorStrip('#3a3236', '#5a4e50');
      R(8, 6, 52, 40, '#4a4048'); for (let y = 7; y < 45; y++) for (let x = 9; x < 59; x++) R(x, y, 1, 1, X.ramp(['#060a16', '#0c1224', '#141c34'], 1 - (y - 7) / 38, x, y)); // 大窗户：外面是夜里的城
      for (let k = 0; k < 26; k++) { const x = 10 + Math.floor(X.hash(k, 1) * 48), y = 20 + Math.floor(X.hash(k, 2) * 24); E(x, y, 1, 1, X.hash(k, 3) < 0.6 ? '#ffcf7a' : '#8fe6ff'); }
      R(33, 6, 2, 40, '#4a4048'); R(8, 26, 52, 1, '#4a4048');
      R(70, h - 16, 32, 12, '#5a4a40'); R(70, h - 16, 32, 1, '#8a7464'); E(78, h - 20, 6, 4, '#8fe6ff', '#1e3a44'); // 前台、电脑
      R(4, h - 18, 4, 14, '#2a3a2a'); R(2, h - 22, 8, 6, '#3a5a34'); // 盆栽
      lamp(40, '#ffd8a0', 0.7); lamp(84, '#ffd8a0', 0.7);
    } else if (kind === 'office') {
      wallP(['#1e1c26', '#26242e', '#2e2c38']); floorStrip('#2a2832', '#46424e');
      R(0, 6, w, 18, '#0c1020'); for (let k = 0; k < 18; k++) E(2 + Math.floor(X.hash(k, 7) * 106), 8 + Math.floor(X.hash(k, 8) * 14), 1, 1, '#ffcf7a'); for (let x = 0; x < w; x += 22) R(x, 6, 2, 18, '#3a3844'); // 窗户
      for (const dx of [8, 44, 80]) { R(dx, h - 13, 24, 2, '#4a4650'); R(dx + 1, h - 11, 1, 7, '#2a2830'); R(dx + 22, h - 11, 1, 7, '#2a2830'); E(dx + 8, h - 21, 9, 7, '#5ac8e8', '#164250'); R(dx + 11, h - 14, 3, 1, '#2a2830'); R(dx + 14, h - 9, 6, 5, '#22202a'); } // 桌子、显示器、椅子
      lamp(20, '#e8f0ff', 0.65); lamp(76, '#e8f0ff', 0.65);
    } else if (kind === 'earth') {
      X.paint(g, 0, 0, w, h, (x, y) => X.ramp(['#0c0a08', '#14100c', '#1c1612', '#261e18'], 0.4 + X.hash(x >> 2, y >> 2) * 0.4 + (X.hash(x >> 3, y >> 3) > 0.85 ? 0.25 : 0), x, y)); // 土和石头
    } else if (kind === 'sky') {
      X.paint(g, 0, 0, w, h, (x, y) => X.ramp(['#05070f', '#0a1020', '#121a32'], y / h, x, y));
      for (let k = 0; k < 12; k++) E(Math.floor(X.hash(k, 4) * w), Math.floor(X.hash(k, 5) * 30), 1, 1, '#8a94c0');
      for (let x = 0; x < w;) { const bw = 8 + Math.floor(X.hash(x, 6) * 14), bh = 12 + Math.floor(X.hash(x, 7) * 30); R(x, h - bh, bw - 1, bh, '#0c1222'); for (let y = h - bh + 3; y < h - 2; y += 4) for (let xx = x + 2; xx < x + bw - 2; xx += 3) if (X.hash(xx, y) < 0.25) E(xx, y, 1, 1, '#ffcf7a'); x += bw; } // 远处的楼
    } else { // 检修层：混凝土、横着的管子、阀门、带罩的灯
      wallP(['#18191e', '#202228', '#2a2c34', '#34363e']); floorStrip('#22242a', '#3a3c44');
      for (const py of [12, 22]) { R(0, py, w, 3, '#4a5060'); R(0, py, w, 1, '#7a8090'); for (let x = 0; x < w; x += 9) if (X.hash(x, py) < 0.4) R(x, py + 1, 2, 1, '#6a4a30'); }
      R(50, 10, 5, 7, '#8a3a2a'); R(51, 11, 3, 5, '#c24a30'); E(84, 4, 4, 3, '#ffb070', '#5a3a18'); lights.push({ x: 86, y: 6, r: 44, col: '#ffb070', a: 0.55 });
    }
    if (side === 1) { // 右边的房间左右翻过来（靠井的那边对称）
      for (const [cv, cx] of [[c, g], [e, eg]]) { const [tc, tg] = D.canvas(w, h); tg.translate(w, 0); tg.scale(-1, 1); tg.drawImage(cv, 0, 0); cx.clearRect(0, 0, w, h); cx.drawImage(tc, 0, 0); }
      for (const l of lights) l.x = w - 1 - l.x;
    }
    return (sh.rooms[key] = { c, e, lights });
  }
  function drawShaft(ctx, S, time) {
    const Z = shInit(), X = S.lift, g = Z.g, eg = Z.eg, P = D.Pix;
    const curve = k => { k = Math.max(0, Math.min(1, k)); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    const posAt = t => (X.hFrom + (X.hTo - X.hFrom) * curve(t / X.down)) * FH;
    const pos = posAt(X.t), v = (posAt(X.t + 1 / 60) - pos) * 60, sp = Math.abs(v);
    const hs = S.liftFloors.map(o => o.h), maxH = Math.max(...hs), minH = Math.min(...hs);
    const slabY = h => Math.round(CY - (h * FH - pos)), lc = S.st && S.st.lines && S.st.lines.length && D.LINE_COLORS ? D.LINE_COLORS[S.st.lines[0]] : '#ff3047';
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); }, E = (x, y, w, h, col, ecol) => { R(x, y, w, h, col); eg.fillStyle = ecol || D.mixHex(col, '#000000', 0.5); eg.fillRect(x, y, w, h); };
    g.fillStyle = '#07080c'; g.fillRect(0, 0, SW, SH); eg.clearRect(0, 0, SW, SH);
    const lights = [];
    const h0 = Math.floor((pos - (SH - CY)) / FH) - 1, h1 = Math.ceil((pos + CY) / FH) + 1;
    // 两边的房间、楼板
    for (let h = h0; h <= h1; h++) {
      const yT = slabY(h + 1) + SLAB; if (slabY(h) < -4 || yT > SH + 4) continue;
      const kind = kindOf(S, h, minH, maxH);
      for (const side of [0, 1]) { const T = roomTex(kind, side, lc), x0 = side ? WX1 : 0; g.drawImage(T.c, x0, yT); eg.drawImage(T.e, x0, yT); for (const l of T.lights) lights.push([(x0 + l.x) * 2, (yT + l.y) * 2, l.r * 2, l.col, l.a]); }
    }
    for (let h = h0; h <= h1 + 1; h++) { const y = slabY(h); if (y < -SLAB || y > SH) continue; for (const [a, b] of [[0, IX0], [IX1, SW]]) { R(a, y, b - a, 1, '#5a5e6e'); R(a, y + 1, b - a, SLAB - 2, '#30333e'); R(a, y + 3, b - a, 1, '#3a3d48'); R(a, y + SLAB - 1, b - a, 1, '#121318'); } }
    // 井：后壁、井壁、导轨和支架（越快拖得越长）
    const off = ((CY + pos) % FH + FH) % FH - FH;
    for (let y = off; y < SH; y += FH) { g.drawImage(Z.back, IX0, Math.round(y)); g.drawImage(Z.wall, WX0, Math.round(y)); g.drawImage(Z.wall, IX1, Math.round(y)); }
    for (const rx of [125, 194]) { R(rx, 0, 2, SH, '#4a5064'); R(rx, 0, 1, SH, '#8a92a8'); }
    const blen = 2 + Math.min(14, sp * 0.03), boff = ((CY + pos) % 24 + 24) % 24;
    for (let y = boff - 24; y < SH + 24; y += 24) for (const rx of [123, 196]) R(rx, Math.round(y - (v < 0 ? 0 : blen - 2)), 3, Math.round(blen), '#2e323e');
    // 井壁上的楼层号、每层一盏小灯
    for (const o of S.liftFloors) { const y = slabY(o.h); if (y < -24 || y > SH + 24) continue; D.text(g, o.tag, 117, y - 16, '#ffb057', { align: 'center', scale: 1, shadow: false }); D.text(eg, o.tag, 117, y - 16, '#6a3e14', { align: 'center', scale: 1, shadow: false }); E(IX1 - 4, y - 36, 2, 3, '#ffb057'); lights.push([(IX1 - 3) * 2, (y - 34) * 2, 56, '#ffb057', 0.55]); }
    // 配重：往反方向走；钢缆
    const cwY = Math.round(CY - 34 - 2 * (pos - X.hFrom * FH));
    if (cwY > -40 && cwY < SH) { R(186, cwY, 7, 28, '#2a2c34'); R(186, cwY, 7, 1, '#5a5e6a'); for (let k = 4; k < 28; k += 5) R(186, cwY + k, 7, 1, '#1c1d22'); R(189, 0, 1, Math.max(0, cwY), '#2a2c36'); }
    // 粉尘：被带起来的细线（往反方向拖）
    for (let i = 0; i < 34; i++) { const x = IX0 + 4 + Math.floor(P.hash(i, 1) * 70), wy = P.hash(i, 2) * FH * 8, y = ((CY - (wy - pos)) % 200 + 200) % 200 - 10, l = 1 + Math.min(9, sp * 0.02); R(x, Math.round(y), 1, Math.round(l), '#3a3e4c'); }
    // 轿厢：钢缆、上梁和滑轮、正面切开（后壁拉丝钢、扶手、顶灯）、地板和门槛、下面的安全钳；跑起来轻微晃
    const cy = CY + (sp > 40 ? ((time * 36 | 0) % 2) : 0);
    for (const x of [156, 160, 164]) { R(x, 0, 1, cy - 52, '#2e313c'); }
    R(136, cy - 52, 48, 5, '#2a2e3a'); R(136, cy - 52, 48, 1, '#5a6278'); R(155, cy - 56, 11, 4, '#3a3e4c'); R(155, cy - 56, 11, 1, '#6a7288'); E(180, cy - 50, 2, 1, '#5fe07a');
    R(133, cy - 47, 54, 47, '#14161e'); R(134, cy - 47, 52, 47, '#4a5064'); R(134, cy - 47, 52, 1, '#8a92a8'); R(134, cy - 47, 1, 47, '#6a7288'); R(185, cy - 47, 1, 47, '#2a2e3a');
    g.drawImage(Z.car, 136, cy - 45); E(142, cy - 45, 36, 1, '#fff0d4', '#6a6250');
    R(133, cy, 54, 4, '#262832'); R(133, cy, 54, 1, '#9aa2b4'); R(140, cy + 4, 40, 4, '#1c1e26'); R(140, cy + 4, 40, 1, '#3a3e4a');
    lights.push([320, (cy - 42) * 2, 130, '#ffe8c8', 0.95], [320, (cy + 6) * 2, 60, '#ffe8c8', 0.3]);
    // 合成：放大两倍、画机器人（站里同一套图集，朝着镜头）、发光层、打光
    const ox = Z.ox; ox.imageSmoothingEnabled = false; ox.globalAlpha = 1; ox.globalCompositeOperation = 'source-over'; ox.drawImage(Z.c, 0, 0, D.W, D.H);
    const ex = D.Post.ex; ex.imageSmoothingEnabled = false; ex.drawImage(Z.e, 0, 0, D.W, D.H);
    const H = D.heroOf && S.SH && S.SH.key ? D.heroOf(S.SH.key, S.mods) : null;
    if (H && H.ready && H.meta) { const fr = H.meta.idle8 || H.meta.idle6 || [0], f = fr[Math.floor(time * 6) % fr.length], sx = (f % H.cols) * H.fw, sy = Math.floor(f / H.cols) * H.fh, dx = Math.round(320 - H.fw / 2), dy = Math.round(cy * 2 - H.footY); ox.drawImage(H.img, sx, sy, H.fw, H.fh, dx, dy, H.fw, H.fh); if (H.emit) ex.drawImage(H.emit, sx, sy, H.fw, H.fh, dx, dy, H.fw, H.fh); }
    for (const l of lights) P.light(l[0], l[1], l[2], l[3], l[4]);
    P.finish(ox, '#2c3046');
    // 顶上的楼层显示：现在到了哪层 + 往哪走
    const near = S.liftFloors.reduce((a, o) => Math.abs(o.h * FH - pos) < Math.abs(a.h * FH - pos) ? o : a, S.liftFloors[0]);
    ox.fillStyle = 'rgba(6,7,11,0.85)'; ox.fillRect(276, 10, 88, 28); ox.fillStyle = '#5a6278'; ox.fillRect(276, 10, 88, 2);
    D.text(ox, near.tag, 334, 16, D.UIC.a, { align: 'center', scale: 3 });
    if ((time * 4 | 0) % 2) { ox.fillStyle = D.UIC.a; const up = X.hTo > X.hFrom; for (let k = 0; k < 4; k++) ox.fillRect(290 - k * 2, up ? 18 + k * 3 : 27 - k * 3, 4 + k * 4, 3); }
    // 开头从关着的门口拉远、结尾推近（整数像素放大）
    const zk = Math.max(1 - ease(X.t / 0.3), 1 - ease((X.down - X.t) / 0.3)), z = 1 + 0.6 * zk, fx = 320, fy = (cy - 22) * 2;
    const s = ctx.canvas.width / D.W;
    ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(Z.out, Math.round(fx - fx * z), Math.round(fy - fy * z), Math.round(D.W * z), Math.round(D.H * z));
    ctx.restore();
    X.drawn = 'shaft'; // 测试用
  }
})(D);
