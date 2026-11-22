/* 末班之后 · 小样二：站内小地图（右上角）。试玩反馈：原来的太大（整层按每格 3 像素铺开，180×120）、太粗糙（只有房间方块）。
   现在：每格 2 像素，只显示身边 54×30 格，整块 114×77。走过的地方才亮：进过的房间整间亮，走廊走到哪亮到哪；墙画成描边，
   没去过的房间只留一圈暗虚线。顶上一条写楼层名和第几层（小方块）。玩家是一个指向准星的小箭头；楼梯是上下箭头；
   撤离点不在窗口里时贴着边给一个绿箭头；列车停靠时轨道亮绿。底图按层缓存，新亮了格子才重画。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, TS = 16;
  const SC = 2, VW = 54, VH = 30, MW = VW * SC, MH = VH * SC, HEAD = 14, PAD = 3, R = 6; // 每格 2 像素；窗口 54×30 格；走廊在身边 6 格内就亮
  const PW = MW + PAD * 2, PH = HEAD + MH + PAD;
  D.MINIMAP = { w: PW, h: PH, top: 34, right: 7 };
  const COL = { corr: '#232944', room: '#2a3153', main: '#313b64', hv: '#594a1f', lock: '#1d4462', hidden: '#4a2f5c', boss: '#5c1f2b', water: '#1b4058',
    wallHi: '#8591c2', wallLo: '#4b5580', dash: '#262b44', rail: '#4a5070', sleeper: '#2a2f45' };
  const roomCol = r => r.boss ? COL.boss : r.hv ? COL.hv : r.hidden ? COL.hidden : r.lock ? COL.lock : r.kind === 'platform' || r.kind === 'hall' ? COL.main : COL.room;

  // ── 哪些格子亮了：进过的房间整间亮（含一圈墙），走廊（不属于任何房间的格子）在身边 R 格内就亮
  function reveal(S) {
    const A = S.A, tw = A.tw, seen = A.mmSeen || (A.mmSeen = new Uint8Array(tw * A.tht)), p = S.player, cx = Math.floor(p.x / TS), cy = Math.floor(p.y / TS);
    let n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= tw || y >= A.tht) continue;
      const i = y * tw + x; if (!seen[i] && (A.room[i] < 0 || A.room[i] === A.room[cy * tw + cx])) { seen[i] = 1; n++; }
    }
    for (const r of A.rooms) if (r.seen && !r.mmLit) { r.mmLit = true; for (let y = Math.max(0, r.y - 1); y <= Math.min(A.tht - 1, r.y + r.h); y++) for (let x = Math.max(0, r.x - 1); x <= Math.min(tw - 1, r.x + r.w); x++) { const i = y * tw + x; if (!seen[i]) { seen[i] = 1; n++; } } }
    if (n) A.mmDirty = true;
  }
  // ── 底图（整层，每格 2 像素）：亮了的地面按房间上色、四边是墙就描一道边；没去过的房间画暗虚线框；站台层画轨道
  function base(A) {
    if (A.mmCv && !A.mmDirty) return A.mmCv;
    const tw = A.tw, th = A.tht, w = tw * SC, h = th * SC;
    if (!A.mmCv) A.mmCv = D.canvas(w, h)[0];
    const c = A.mmCv, x = c.getContext('2d'), seen = A.mmSeen, K = A.kind, rm = A.room, px = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(a, b, ww, hh); };
    A.mmDirty = false; x.clearRect(0, 0, w, h);
    for (const r of A.rooms) if (!r.seen && !r.hidden) { const a = r.x * SC, b = r.y * SC, rw = r.w * SC, rh = r.h * SC; for (let i = 0; i < rw; i += 3) { px(a + i, b, 1, 1, COL.dash); px(a + i, b + rh - 1, 1, 1, COL.dash); } for (let i = 0; i < rh; i += 3) { px(a, b + i, 1, 1, COL.dash); px(a + rw - 1, b + i, 1, 1, COL.dash); } }
    // 只有墙（1）和裂缝墙（3）算墙、轨道（2）另画；柱子、长椅、容器走不过去，但地图上当地面画，不然满屏小洞
    const lit = i => seen[i] && K[i] === 0, wall = i => K[i] !== 0;
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
      const i = ty * tw + tx; if (!lit(i)) continue;
      const r = rm[i] >= 0 ? A.rooms[rm[i]] : null, a = tx * SC, b = ty * SC;
      px(a, b, SC, SC, A.water && A.water[i] ? COL.water : r ? roomCol(r) : COL.corr);
      if (ty === 0 || wall(i - tw)) px(a, b, SC, 1, COL.wallHi);
      if (tx === 0 || wall(i - 1)) px(a, b, 1, SC, COL.wallHi);
      if (ty === th - 1 || wall(i + tw)) px(a, b + SC - 1, SC, 1, COL.wallLo);
      if (tx === tw - 1 || wall(i + 1)) px(a + SC - 1, b, 1, SC, COL.wallLo);
    }
    if (A.track && A.rooms.some(r => r.kind === 'platform' && r.seen)) {
      const y0 = A.track.y0 * SC, y1 = (A.track.y1 + 1) * SC - 1;
      for (let a = SC; a < w - SC; a += 4) px(a, y0 + 1, 2, y1 - y0 - 1, COL.sleeper);
      px(SC, y0 + 1, w - SC * 2, 1, COL.rail); px(SC, y1 - 1, w - SC * 2, 1, COL.rail);
    }
    return c;
  }

  const ARROW_UP = ['..#..', '.###.', '#####'], ARROW_DN = ['#####', '.###.', '..#..'];
  D.drawMinimap = function (ctx, S, time, W) {
    const A = S.A, p = S.player; reveal(S);
    const x0 = W - D.MINIMAP.right - PW, y0 = D.MINIMAP.top, mx = x0 + PAD, my = y0 + HEAD;
    const px = (a, b, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    // 外框：和界面上别的面板一样的一圈墨线 + 斜面高光
    px(x0 - 1, y0 - 1, PW + 2, PH + 2, P.k); px(x0, y0, PW, PH, 'rgba(8,9,16,0.9)');
    px(x0, y0, PW, 1, '#3a4060'); px(x0, y0, 1, PH, '#3a4060'); px(x0, y0 + PH - 1, PW, 1, '#07070e'); px(x0 + PW - 1, y0, 1, PH, '#07070e');
    // 顶上一条：楼层名 + 第几层
    px(x0 + 1, y0 + HEAD - 2, PW - 2, 1, '#2f3550');
    ctx.font = '10px PixelZH10, PixelZH, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = D.UIC.a; ctx.fillText(A.name || '', x0 + 4, y0 + 11);
    const nf = S.floors.length;
    for (let i = 0; i < nf; i++) { const bx = x0 + PW - 7 - (nf - 1 - i) * 7, by = y0 + 4, on = i === S.f, been = !!S.floors[i].mmSeen; px(bx - 1, by - 1, 6, 6, P.k); px(bx, by, 4, 4, on ? D.UIC.a : been ? '#4b5580' : '#1a1d2c'); if (on) px(bx + 1, by + 1, 2, 2, '#fff0c8'); }
    // 地图窗口：跟着玩家走，整层比窗口小就居中
    const camX = A.tw <= VW ? -Math.floor((VW - A.tw) / 2) : D.clamp(p.x / TS - VW / 2, 0, A.tw - VW), camY = A.tht <= VH ? -Math.floor((VH - A.tht) / 2) : D.clamp(p.y / TS - VH / 2, 0, A.tht - VH);
    const ox = Math.round(mx - camX * SC), oy = Math.round(my - camY * SC), X = v => ox + v / TS * SC, Y = v => oy + v / TS * SC;
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, MW, MH); ctx.clip();
    px(mx, my, MW, MH, '#0b0d17');
    ctx.imageSmoothingEnabled = false; ctx.drawImage(base(A), ox, oy);
    const seenAt = (x, y) => { const i = Math.floor(y / TS) * A.tw + Math.floor(x / TS); return A.mmSeen && A.mmSeen[i]; };
    // 列车停靠 / 进站：轨道上一条绿
    const tr = D.trainState && S.f === 1 ? D.trainState(S) : null;
    if (tr && A.track) { const a = Math.max(mx, X(tr.x)), b = Math.min(mx + MW, X(tr.x + 400)); if (b > a) px(a, oy + A.track.y0 * SC + 1, b - a, (A.track.y1 - A.track.y0 + 1) * SC - 2, (time * 4 | 0) % 2 && tr.door > 0.5 ? '#3dd66a' : '#1e7a3a'); }
    // 东西：没搜完的容器（琥珀点）、地上的东西（品质色）、终端、中继台、商人、配电室
    for (const c of S.containers) if (c.f === S.f && !D.containerDone(c) && seenAt(c.x, c.y)) px(X(c.x) - 1, Y(c.y) - 1, 2, 2, c.opened ? '#8a6a3a' : '#ffd27a');
    for (const g of S.ground) if (g.f === S.f && seenAt(g.x, g.y)) px(X(g.x) - 1, Y(g.y) - 1, 2, 2, D.QUALITY[D.itemInfo(g.id).q].col);
    for (const t of A.terminals || []) if (seenAt(t.x, t.y)) { px(X(t.x) - 1, Y(t.y) - 2, 1, 3, t.used ? '#2f6e88' : '#3ee8ff'); px(X(t.x) - 2, Y(t.y) - 1, 3, 1, t.used ? '#2f6e88' : '#3ee8ff'); }
    for (const [o, col] of [[S.relay, '#3ee8ff'], [S.trader, '#ffd27a'], [S.healer, '#6be08a']]) if (o && o.f === S.f) { px(X(o.x) - 2, Y(o.y) - 2, 4, 4, P.k); px(X(o.x) - 1, Y(o.y) - 1, 2, 2, col); }
    // 未知信号站：人（黄）、没用过的信号（青）、闸机（绿）
    for (const o of S.evObjs || []) if (o.f === S.f && !(o.kind === 'sig' && o.used)) { const col = o.kind === 'npc' ? '#ffd27a' : o.kind === 'sig' ? '#3ee8ff' : '#3dd66a'; px(X(o.x) - 2, Y(o.y) - 2, 4, 4, P.k); px(X(o.x) - 1, Y(o.y) - 1, 2, 2, col); }
    // 楼梯：往上一层是向上的箭头，往下是向下的
    for (const st of A.stairs) { const g = st.to < S.f ? ARROW_UP : ARROW_DN, a = Math.round(X(st.x)) - 2, b = Math.round(Y(st.y)) - 1; for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) if (g[j][i] === '#') px(a + i, b + j, 1, 1, '#ffd84a'); }
    // 敌人：扫描时全部；平时只画附近的（150 以内）和已经发现你的
    for (const e of S.enemies) if (!e.dead && e.f === S.f && (S.scanT > 0 || e.aware || Math.hypot(e.x - p.x, e.y - p.y) < 150)) { const big = D.ENEMIES[e.kind].elite || D.ENEMIES[e.kind].boss, s = big ? 3 : 2, a = Math.round(X(e.x)) - 1, b = Math.round(Y(e.y)) - 1; px(a - 1, b - 1, s + 2, s + 2, P.k); px(a, b, s, s, e.aware ? ((time * 6 | 0) % 2 ? P.r : P.R) : '#c85060'); }
    // 撤离点：一闪一闪的绿色菱形
    const ex = S.console && S.console.f === S.f && S.isExit && !(S.step === 0 && !S.tut) ? S.console : null;
    if (ex) { const a = Math.round(X(ex.x)), b = Math.round(Y(ex.y)), on = (time * 2 | 0) % 2; for (let d = -3; d <= 3; d++) { const w = 3 - Math.abs(d); px(a - w - 1, b + d, w * 2 + 3, 1, P.k); } for (let d = -2; d <= 2; d++) { const w = 2 - Math.abs(d); px(a - w, b + d, w * 2 + 1, 1, on ? '#3dd66a' : '#1e7a3a'); } }
    // 玩家：指向准星的小箭头
    { const a = Math.round(X(p.x)), b = Math.round(Y(p.y)), dx = Math.round(Math.cos(p.aim) * 2), dy = Math.round(Math.sin(p.aim) * 2);
      px(a - 2, b - 2, 5, 5, P.k); px(a + dx - 1, b + dy - 1, 3, 3, P.k); px(a - 1, b - 1, 3, 3, (time * 4 | 0) % 2 ? D.UIC.a2 : D.UIC.a); px(a + dx, b + dy, 1, 1, '#fff2d8'); }
    // 扫描线：每 3 秒从上扫到下
    { const u = (time % 3) / 1.2; if (u < 1) { ctx.globalAlpha = 0.18; px(mx, my + Math.floor(u * MH), MW, 1, '#3ee8ff'); ctx.globalAlpha = 1; } }
    ctx.restore();
    // 撤离点不在窗口里：贴着窗口边给一个绿箭头
    if (ex) { const a = X(ex.x), b = Y(ex.y); if (a < mx || a >= mx + MW || b < my || b >= my + MH) { const cx = D.clamp(a, mx + 3, mx + MW - 4), cy = D.clamp(b, my + 3, my + MH - 4); px(cx - 2, cy - 2, 5, 5, P.k); px(cx - 1, cy - 1, 3, 3, (time * 3 | 0) % 2 ? '#3dd66a' : '#1e7a3a'); } }
    // 四个角的小折角（像素风）
    for (const [a, b, sx, sy] of [[mx - 1, my - 1, 1, 1], [mx + MW, my - 1, -1, 1], [mx - 1, my + MH, 1, -1], [mx + MW, my + MH, -1, -1]]) { px(Math.min(a, a + sx * 3), b, 4, 1, '#3ee8ff'); px(a, Math.min(b, b + sy * 3), 1, 4, '#3ee8ff'); }
  };
})(D);
