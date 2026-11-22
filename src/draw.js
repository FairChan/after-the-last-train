/* 末班之后 · 小样二：站内画面（640×360，世界坐标 ×2） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, W = D.W, H = D.H, Z = D.Z, TS = 16, TAU = Math.PI * 2;
  const LIFT = 0.14;

  D.drawStation = function (ctx, S, time) {
    const A = S.A, p = S.player, ex = D.Post.ex, L = D.Post;
    const ST = D.settings || {}, sh = S.shake * S.shake * 6 * (ST.shake == null ? 1 : ST.shake);
    const rcx = S.recoil ? -Math.cos(S.recoilA) * S.recoil * 0.5 : 0, rcy = S.recoil ? -Math.sin(S.recoilA) * S.recoil * 0.5 : 0; // 后坐把镜头往后顶
    const cx = Math.round((S.cam.x + rcx + (D.fx() - 0.5) * sh * 2) * Z) / Z, cy = Math.round((S.cam.y + rcy + (D.fx() - 0.5) * sh * 2) * Z) / Z;
    const LT = (x, y, r, col, a) => L.addLight((x - cx) * Z, (y - cy) * Z, r * Z, col, a);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(Z, 0, 0, Z, -cx * Z, -cy * Z); ex.setTransform(Z, 0, 0, Z, -cx * Z, -cy * Z);
    ctx.drawImage(S.floor, 0, 0, A.w, A.h); ex.drawImage(A.floorEmit, 0, 0, A.w, A.h);
    const here = o => o.f == null || o.f === S.f;
    // 隧道口：站台两头的黑洞，带青色指示灯和箭头
    for (const t of A.tunnels) {
      const x0 = t.dir < 0 ? TS : A.w - TS - 22, y0 = 12 * TS, y1 = 20 * TS;
      const g = ctx.createLinearGradient(t.dir < 0 ? x0 : x0 + 22, 0, t.dir < 0 ? x0 + 22 : x0, 0); g.addColorStop(0, '#000000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, 22, y1 - y0);
      const blink = (time * 2 | 0) % 2;
      for (let k = 0; k < 3; k++) { const ax = t.x + t.dir * (6 + k * 5) - 1.5, ay = t.y - 3; ex.fillStyle = D.rgba('#3ee8ff', blink ? 0.9 - k * 0.25 : 0.4); ex.beginPath(); ex.moveTo(ax + (t.dir > 0 ? 0 : 3), ay); ex.lineTo(ax + (t.dir > 0 ? 3 : 0), ay + 3); ex.lineTo(ax + (t.dir > 0 ? 0 : 3), ay + 6); ex.fill(); }
    }
    // 楼梯：台阶 + 方向箭头（lift.js 画成楼梯井 / 往上的台阶 / 检修口）
    for (const st of A.stairs) {
      if (D.drawStairArt) { D.drawStairArt(ctx, ex, S, st, time, LT); continue; }
      const x = st.x - 14, y = st.y - 4;
      for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#2a2f45' : '#3a4058'; ctx.fillRect(x, y + k * 3, 28, 3); ctx.fillStyle = '#6a7290'; ctx.fillRect(x, y + k * 3, 28, 0.5); }
      ctx.fillStyle = P.k; ctx.fillRect(x - 1.5, y - 1, 1.5, 17); ctx.fillRect(x + 28, y - 1, 1.5, 17);
      ex.fillStyle = D.rgba(P.Y, 0.6 + 0.3 * Math.sin(time * 4)); const up = st.dir === 'up', ay = y + (up ? 2 : 10);
      ex.beginPath(); ex.moveTo(st.x - 4, ay + (up ? 4 : 0)); ex.lineTo(st.x, ay + (up ? 0 : 4)); ex.lineTo(st.x + 4, ay + (up ? 4 : 0)); ex.fill();
      LT(st.x, y + 6, 40, P.Y, 0.35);
    }
    // 裂缝墙：靠近了会冒出细细的光
    for (const br of A.breakables) if (!br.open && br.lock) {
      const col = D.KEY_COL[br.lock], x = br.x - 22, y = br.y - 24;
      ctx.fillStyle = '#20252f'; ctx.fillRect(x, y, 44, 44); ctx.fillStyle = '#3a4252'; ctx.fillRect(x + 3, y + 3, 38, 38); ctx.fillStyle = '#2a303c'; ctx.fillRect(x + 21.5, y + 3, 1, 38); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#323948'; ctx.fillRect(x + 6, y + 8 + k * 8, 12, 1); ctx.fillRect(x + 26, y + 8 + k * 8, 12, 1); }
      ctx.fillStyle = col; ctx.fillRect(x + 3, y + 20, 38, 3); ex.fillStyle = D.rgba(col, 0.55 + 0.35 * Math.sin(time * 3)); ex.fillRect(x + 18, y - 1, 8, 3); ex.fillRect(x + 3, y + 20, 38, 1); LT(br.x, br.y - 12, 34, col, 0.6);
    }
    for (const br of A.breakables) if (!br.open && !br.lock && br.seen) { const k = (Math.sin(time * 5) + 1) / 2; ex.fillStyle = D.rgba('#c8d6ff', 0.25 + 0.4 * k); ex.fillRect(br.x - 3, br.y - 6, 0.5, 9); ex.fillRect(br.x + 2, br.y - 2, 0.5, 6); ex.fillRect(br.x - 1, br.y + 2, 4, 0.5); }
    // 列车
    const TR = A.track && D.trainState(S);
    if (TR) {
      const ty = A.track.y0 * TS + 2, tx = TR.x + TS, lc = S.st && S.st.lines && S.st.lines.length ? D.LINE_COLORS[S.st.lines[0]] : P.r;
      // 车头朝右：前灯照亮前方的轨道和站台
      { const fx = tx + 400; if (fx > -40 && fx - 200 < A.w) { const g = ex.createLinearGradient(fx, 0, fx + 150, 0); g.addColorStop(0, 'rgba(255,240,200,0.28)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ex.fillStyle = g; ex.beginPath(); ex.moveTo(fx + 8, ty + 16); ex.lineTo(fx + 150, ty - 4); ex.lineTo(fx + 150, ty + 38); ex.closePath(); ex.fill(); LT(fx + 40, ty + 16, 110, '#fff2c8', 0.9); } }
      for (let c = 0; c < 4; c++) {
        const x0 = tx + c * 100, front = c === 3, tail = c === 0; if (x0 > A.w + 20) break; if (x0 + 110 < 0) continue;
        // 风挡（车厢之间）
        if (!front) { ctx.fillStyle = P.k; ctx.fillRect(x0 + 96, ty + 5, 4, 17); ctx.fillStyle = '#3a3f4c'; ctx.fillRect(x0 + 96.5, ty + 6, 3, 15); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#2a2e38'; ctx.fillRect(x0 + 96.5, ty + 8 + k * 3.5, 3, 1); } }
        // 车体
        ctx.fillStyle = P.k; ctx.fillRect(x0 - 0.5, ty - 0.5, 97, 29); ctx.fillStyle = '#c9d2d9'; ctx.fillRect(x0, ty, 96, 28); ctx.fillStyle = '#e8eef3'; ctx.fillRect(x0, ty, 96, 1.5); ctx.fillStyle = '#aab4bc'; ctx.fillRect(x0, ty + 1.5, 96, 1.5);
        for (const k of [10, 70]) { ctx.fillStyle = '#5a6470'; ctx.fillRect(x0 + k, ty - 2, 14, 2.5); ctx.fillStyle = '#7d8891'; ctx.fillRect(x0 + k + 1, ty - 2, 12, 0.6); } // 车顶空调机组
        ctx.fillStyle = '#7d8891'; ctx.fillRect(x0, ty + 22, 96, 6); ctx.fillStyle = lc; ctx.fillRect(x0, ty + 17, 96, 2.5); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x0, ty + 17, 96, 0.5);
        // 转向架和车轮
        for (const k of [8, 72]) { ctx.fillStyle = '#2a2e38'; ctx.fillRect(x0 + k, ty + 24, 16, 5); ctx.fillStyle = '#14161c'; ctx.beginPath(); ctx.arc(x0 + k + 4, ty + 28, 2.4, 0, TAU); ctx.arc(x0 + k + 12, ty + 28, 2.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#6a7080'; ctx.fillRect(x0 + k + 3.5, ty + 27.5, 1, 1); ctx.fillRect(x0 + k + 11.5, ty + 27.5, 1, 1); }
        // 车窗：暖光，窗里有座椅的影子
        for (const k of [5, 21, 63, 79]) { ctx.fillStyle = '#1d2033'; ctx.fillRect(x0 + k, ty + 4, 12, 10); ex.fillStyle = '#ffe0a0'; ex.fillRect(x0 + k + 1, ty + 5, 10, 8); ex.fillStyle = '#fff6e0'; ex.fillRect(x0 + k + 1, ty + 5, 10, 1); ctx.fillStyle = '#6a5a48'; ctx.fillRect(x0 + k + 1, ty + 10, 10, 3); ctx.fillStyle = '#8a7a64'; ctx.fillRect(x0 + k + 2, ty + 9, 3, 1); ctx.fillRect(x0 + k + 7, ty + 9, 3, 1); }
        // 车门：两扇各自往两边滑开，门上有小窗，门楣上一盏指示灯
        const g = 8 * TR.door;
        ctx.fillStyle = '#5a6470'; ctx.fillRect(x0 + 38.5, ty + 2, 19, 21);
        ctx.fillStyle = '#14121f'; ctx.fillRect(x0 + 40, ty + 3, 16, 19); if (TR.door > 0) { ex.fillStyle = D.rgba('#ffe0a0', 0.6 * TR.door); ex.fillRect(x0 + 48 - g, ty + 3, g * 2, 19); }
        for (const [px, dir] of [[x0 + 40 - g, 0], [x0 + 48 + g, 1]]) { const cl = Math.max(x0 + 40, Math.min(px, x0 + 56)), w = Math.max(0, Math.min(px + 8, x0 + 56) - cl); if (w <= 0) continue; ctx.fillStyle = '#aeb8c0'; ctx.fillRect(cl, ty + 3, w, 19); ctx.fillStyle = '#8f9aa4'; ctx.fillRect(dir ? cl : cl + w - 0.6, ty + 3, 0.6, 19); if (w > 4) { ctx.fillStyle = '#1d2033'; ctx.fillRect(cl + 2, ty + 5, w - 4, 6); ex.fillStyle = 'rgba(255,224,160,0.6)'; ex.fillRect(cl + 2.5, ty + 5.5, w - 5, 5); } }
        ex.fillStyle = TR.door > 0.05 ? (TR.door < 1 && !TR.leaving ? (((time * 8) | 0) % 2 ? P.r : '#3a1520') : P.g) : '#2a3a2a'; ex.fillRect(x0 + 46, ty + 0.5, 4, 1.2);
        LT(x0 + 48, ty + 8, 60, '#ffe0a0', 0.8);
        // 车头：流线型的前脸、挡风玻璃、终点牌、前灯
        if (front) {
          ctx.fillStyle = P.k; ctx.beginPath(); ctx.moveTo(x0 + 95, ty - 0.5); ctx.lineTo(x0 + 104, ty + 3); ctx.lineTo(x0 + 110, ty + 16); ctx.lineTo(x0 + 110, ty + 28.5); ctx.lineTo(x0 + 95, ty + 28.5); ctx.fill();
          ctx.fillStyle = '#c9d2d9'; ctx.beginPath(); ctx.moveTo(x0 + 95, ty); ctx.lineTo(x0 + 103.5, ty + 3.5); ctx.lineTo(x0 + 109.5, ty + 16); ctx.lineTo(x0 + 109.5, ty + 28); ctx.lineTo(x0 + 95, ty + 28); ctx.fill();
          ctx.fillStyle = '#1d2a3a'; ctx.beginPath(); ctx.moveTo(x0 + 97, ty + 3); ctx.lineTo(x0 + 103, ty + 5); ctx.lineTo(x0 + 107, ty + 13); ctx.lineTo(x0 + 97, ty + 13); ctx.fill(); ex.fillStyle = 'rgba(160,210,255,0.25)'; ex.fillRect(x0 + 98, ty + 4, 2, 7);
          ctx.fillStyle = lc; ctx.fillRect(x0 + 95, ty + 17, 15, 2.5); ex.fillStyle = '#fff6d0'; ex.fillRect(x0 + 106, ty + 20, 3, 2); ex.fillRect(x0 + 106, ty + 24, 3, 1.5);
          ctx.fillStyle = '#0b0a14'; ctx.fillRect(x0 + 82, ty + 4, 12, 4); ex.fillStyle = '#ffb057'; for (let k = 0; k < 5; k++) if (((time * 6 + k) | 0) % 3) ex.fillRect(x0 + 83 + k * 2, ty + 5, 1, 2);
        }
        if (tail) { ex.fillStyle = P.r; ex.fillRect(x0 + 0.5, ty + 20, 2, 2); ex.fillRect(x0 + 0.5, ty + 24, 2, 1.5); LT(x0, ty + 22, 20, P.r, 0.6); }
      }
      if (TR.board && !S.outro) { ex.fillStyle = D.rgba(P.g, 0.25 + 0.2 * Math.sin(time * 8)); ex.fillRect(2 * TS, A.boardY, A.w - 4 * TS, 6); }
    }
    // 撤离区：终端前面一块地上画着绿色的框和往里的箭头
    if (S.console && here(S.console) && S.isExit && !(S.step === 0 && !S.tut)) { const c = S.console, k = (time * 1.5) % 1; ex.strokeStyle = D.rgba(P.g, 0.55 + 0.25 * Math.sin(time * 4)); ex.lineWidth = 1; ex.setLineDash([4, 3]); ex.lineDashOffset = -time * 10; ex.strokeRect(c.x - 44, c.y - 6, 88, 26); ex.setLineDash([]); for (let i = 0; i < 3; i++) { const t = (k + i / 3) % 1; ex.fillStyle = D.rgba(P.g, (1 - t) * 0.5); for (const s of [-1, 1]) { const xx = c.x + s * (40 - t * 26); ex.beginPath(); ex.moveTo(xx, c.y + 7); ex.lineTo(xx + s * 5, c.y + 2); ex.lineTo(xx + s * 5, c.y + 12); ex.fill(); } } }
    // 地面预警（只给范围攻击画落点，不画弹道）
    for (const e of S.enemies) if (!e.dead && here(e)) telegraph(ex, S, e);
    for (const s of S.shells) { const k = D.clamp(s.t / s.dur, 0, 1); if (s.t < 0) continue; ex.strokeStyle = D.rgba(P.m, 0.5 + 0.5 * k); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(s.tx, s.ty, 18, 11, 0, 0, TAU); ex.stroke(); ex.fillStyle = D.rgba(P.m, 0.12 + 0.25 * k); ex.beginPath(); ex.ellipse(s.tx, s.ty, 18 * k, 11 * k, 0, 0, TAU); ex.fill(); }
    for (const e of S.enemies) if (!e.dead && here(e) && e.frz > 0) { ex.fillStyle = D.rgba('#8fe8ff', 0.25 + 0.15 * Math.min(1, e.frz)); ex.beginPath(); ex.ellipse(e.x, e.y, e.r + 4, (e.r + 4) * 0.5, 0, 0, TAU); ex.fill(); }
    for (const n of S.nades) if (n.t >= n.fly) { const k = (n.t - n.fly) / n.fuse; ex.strokeStyle = D.rgba(n.own ? ({ frag: P.O, freeze: '#8fe8ff', emp: '#ffd84a' }[n.kind]) : P.r, 0.4 + 0.6 * k); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(n.x, n.y, 26, 16, 0, 0, TAU); ex.stroke(); }
    // 影子
    const shadow = (x, y, r) => { ctx.beginPath(); ctx.ellipse(x, y, r, Math.max(1, r * 0.45), 0, 0, TAU); ctx.fill(); };
    ctx.fillStyle = 'rgba(5,4,12,0.45)';
    for (const pr of A.props) ctx.fillRect(pr.x - pr.w / 2 + 3, pr.y - 3, pr.w, 5);
    ctx.fillStyle = 'rgba(5,4,12,0.55)';
    for (const e of S.enemies) if (!e.dead && here(e)) shadow(e.x, e.y, e.r + 1);
    for (const c of S.containers) if (here(c)) shadow(c.x, c.y, 7);
    // 地上的弹药堆：一小堆弹盒，按品质发光
    for (const d of S.drops) if (here(d)) { const it = D.itemInfo(d.id), col = D.QUALITY[it.q].col, b = Math.sin(time * 4 + d.x) * 0.5; ctx.fillStyle = P.k; ctx.fillRect(d.x - 4, d.y - 3.5, 8, 4.5); ctx.fillStyle = '#5a4a2a'; ctx.fillRect(d.x - 3.5, d.y - 3, 7, 3.5); ctx.fillStyle = '#c8a050'; ctx.fillRect(d.x - 3.5, d.y - 3, 7, 0.5); ex.fillStyle = col; ex.fillRect(d.x - 3, d.y - 5 + b, 1, 2); ex.fillRect(d.x - 0.5, d.y - 5.5 + b, 1, 2.5); ex.fillRect(d.x + 2, d.y - 5 + b, 1, 2); LT(d.x, d.y - 3, 18, col, 0.5); }
    for (const g of S.ground) if (here(g)) { const it = D.itemInfo(g.id), col = D.QUALITY[it.q].col, near = S.groundNear.includes(g); ctx.fillStyle = 'rgba(5,4,12,0.5)'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 1, 6, 2.5, 0, 0, TAU); ctx.fill(); if (g.dropped) continue; ex.strokeStyle = D.rgba(col, near ? 0.9 : 0.35 + 0.2 * Math.sin(time * 3 + g.x)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(g.x, g.y + 1, near ? 8 : 7, near ? 3.5 : 3, 0, 0, TAU); ex.stroke(); }
    if (p.hp > 0 && S.noHud) shadow(p.x, p.y, 5.5); // 标题页：只要影子，不要脚下的光圈和朝向点
    else if (p.hp > 0 && !p.out) { shadow(p.x, p.y, 5.5); ex.strokeStyle = D.rgba(D.UIC.a, 0.45 + 0.1 * Math.sin(S.t * 4)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(p.x, p.y, 9, 4, 0, 0, TAU); ex.stroke(); ex.fillStyle = P.O; ex.fillRect(p.x + Math.cos(p.aim) * 11 - 0.5, p.y + Math.sin(p.aim) * 5 - 0.5, 1, 1); }
    // 按脚底排序
    const list = [];
    for (const pr of A.props) list.push({ y: pr.y - 2, f: () => { const px = pr.x - pr.w / 2, py = pr.y - pr.h; ctx.drawImage(pr.img, px, py, pr.w, pr.h); ex.globalCompositeOperation = 'destination-out'; ex.drawImage(pr.img, px, py, pr.w, pr.h); ex.globalCompositeOperation = 'source-over'; if (pr.emit) ex.drawImage(pr.emit, px, py, pr.w, pr.h); } });
    for (const c of S.containers) if (here(c)) list.push({ y: c.y, f: () => drawContainer(ctx, ex, S, c, time) });
    for (const g of S.ground) if (here(g)) list.push({ y: g.y - 1, f: () => drawGround(ctx, ex, S, g, time, LT) });
    if (S.relay && here(S.relay)) list.push({ y: S.relay.y, f: () => npc(ctx, ex, S, S.relay, 'relay', time, LT) });
    for (const e of S.enemies) if (!e.dead && here(e)) list.push({ y: e.y, f: () => drawEnemy(ctx, ex, S, e, LT) });
    if (p.hp > 0 && !S.hideP && !p.out) list.push({ y: p.y, f: () => D.stairDraw ? D.stairDraw(ctx, ex, S, p, () => drawPlayer(ctx, ex, S, p)) : drawPlayer(ctx, ex, S, p) });
    if (S.players && S.players.length > 1 && D.MP) for (const q of S.players) if (q !== p && !q.out && (q.hp > 0 || q.down) && !S.outro && !(S.intro && S.intro.t < D.TRAIN_IN.open) && here(q)) list.push({ y: q.y, f: () => D.MP.drawAs(S, q, () => { ctx.fillStyle = 'rgba(5,4,12,0.55)'; shadow(q.x, q.y, 5.5); drawPlayer(ctx, ex, S, q); D.MP.drawTag(ctx, ex, S, q); }) }); // 联机：队友（mp-core.js）
    if (S.decoy) list.push({ y: S.decoy.y, f: () => { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(S.t * 20); body(ctx, ex, S, S.decoy.x, S.decoy.y, false, 0, true); ctx.globalAlpha = 1; } });
    if (S.trader && here(S.trader)) list.push({ y: S.trader.y, f: () => npc(ctx, ex, S, S.trader, 'trader', time, LT) });
    if (S.healer && here(S.healer)) list.push({ y: S.healer.y, f: () => npc(ctx, ex, S, S.healer, 'healer', time, LT) });
    if (S.console && here(S.console)) list.push({ y: S.console.y, f: () => npc(ctx, ex, S, S.console, 'console', time, LT) });
    if (S.server && here(S.server)) list.push({ y: S.server.y, f: () => npc(ctx, ex, S, S.server, 'server', time, LT) }); // 储备库第 10 节的战略黑匣子
    for (const m of S.mines) list.push({ y: m.y, f: () => { const y = m.y - (m.z || 0); ctx.fillStyle = P.k; ctx.fillRect(m.x - 3.5, y - 4, 7, 4.5); ctx.fillStyle = P[3]; ctx.fillRect(m.x - 3, y - 3.5, 6, 3); ctx.fillStyle = P[5]; ctx.fillRect(m.x - 3, y - 3.5, 6, 0.5); if (m.t > m.fly + m.arm && (S.t * 8 | 0) % 2) { ex.fillStyle = P.r; ex.fillRect(m.x - 0.5, y - 3, 1, 1); } } });
    for (const n of S.nades) list.push({ y: n.y, f: () => { const y = n.y - (n.z || 0); ctx.fillStyle = P.k; ctx.beginPath(); ctx.arc(n.x, y - 2, 2.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#566a31'; ctx.beginPath(); ctx.arc(n.x, y - 2, 2, 0, TAU); ctx.fill(); if ((S.t * 10 | 0) % 2) { ex.fillStyle = P.r; ex.fillRect(n.x - 0.5, y - 4, 1, 1); } } });
    if (D.drawExtras) D.drawExtras(S, list, ctx, ex); // M5：炮台、僚机
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.f();
    if (D.drawOver) D.drawOver(S, ctx, ex); // M5：烟、闪光
    if (A.fore && D.gen2 && D.gen2.drawFore) D.gen2.drawFore(ctx, ex, S, time); // 站内地图第二代 P5：大厅的横梁、吊牌画在人物上面，人走到下面淡出（src/gen2/fore.js）
    // 迫击炮弹在空中
    for (const s of S.shells) { if (s.t < 0) continue; const k = s.t / s.dur, x = D.lerp(s.sx, s.tx, k), y = D.lerp(s.sy, s.ty, k) - Math.sin(k * Math.PI) * 70; ex.fillStyle = P.M; ex.fillRect(x - 1, y - 1, 2, 2); ex.fillStyle = P.m; ex.fillRect(x - 1.5, y - 0.5, 3, 1); }
    // 揭开的东西：从箱子里飘起来、发光、淡掉
    for (const o of S.floaters || []) {
      const k = o.t, img = groundImg[o.art] || (groundImg[o.art] = D.makeIcon(o.art) || D.makeIcon('scrap')), col = D.QUALITY[o.q].col;
      const rise = D.ease.outCubic(Math.min(1, k * 1.6)) * 18, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, s = 10 + (k < 0.15 ? (1 - k / 0.15) * 6 : 0);
      ctx.globalAlpha = a; ctx.drawImage(img, o.x - s / 2, o.y - rise - s / 2, s, s); ctx.globalAlpha = 1;
      ex.globalAlpha = a * (0.4 + o.q * 0.1); ex.drawImage(img, o.x - s / 2, o.y - rise - s / 2, s, s); ex.globalAlpha = 1;
      LT(o.x, o.y - rise, 20 + o.q * 8, col, a * (0.5 + o.q * 0.1));
    }
    // 稀有物品光柱
    for (const pl of S.pillars) { const k = pl.t / pl.max, w = 4 + pl.q * 1.5, g = ex.createLinearGradient(0, pl.y - 120, 0, pl.y); g.addColorStop(0, D.rgba(pl.col, 0)); g.addColorStop(0.7, D.rgba(pl.col, 0.45 * k)); g.addColorStop(1, D.rgba(pl.col, 0.9 * k)); ex.fillStyle = g; ex.fillRect(pl.x - w / 2, pl.y - 120, w, 120); ex.fillStyle = D.rgba('#ffffff', 0.7 * k); ex.fillRect(pl.x - 0.5, pl.y - 100, 1, 100); LT(pl.x, pl.y - 20, 60 + pl.q * 10, pl.col, 0.9 * k); }
    // 残影、刀光、近战弧
    for (const g of S.ghosts) {
      if (g.k === 'slash') { ex.strokeStyle = D.rgba(P.Y, g.t / 0.12); ex.lineWidth = 1; ex.beginPath(); ex.arc(g.x, g.y, 9, g.a - 1.2, g.a + 1.2); ex.stroke(); ex.lineWidth = 0.5; ex.strokeStyle = D.rgba('#ffffff', g.t / 0.12); ex.beginPath(); ex.arc(g.x, g.y, 10, g.a - 0.9, g.a + 0.9); ex.stroke(); }
      else if (g.k === 'muzzle') {
        ex.save(); ex.translate(g.x, g.y); ex.rotate(g.a); const mk = g.max ? g.t / g.max : 1;
        if (g.shape === 'cone') { ex.fillStyle = g.col; ex.beginPath(); ex.moveTo(0, -1.5); ex.lineTo(13, -6); ex.lineTo(16, 0); ex.lineTo(13, 6); ex.lineTo(0, 1.5); ex.fill(); ex.fillStyle = P.Y; ex.beginPath(); ex.moveTo(0, -1); ex.lineTo(9, -3); ex.lineTo(11, 0); ex.lineTo(9, 3); ex.lineTo(0, 1); ex.fill(); }
        else if (g.shape === 'line') { ex.fillStyle = D.rgba(g.col, mk); ex.fillRect(0, -2, 34, 4); ex.fillStyle = D.rgba('#ffffff', mk); ex.fillRect(0, -0.75, 44, 1.5); ex.fillRect(1, -5, 1.5, 10); }
        else if (g.shape === 'ball') { ex.fillStyle = g.col; ex.beginPath(); ex.arc(4, 0, 4.5, 0, TAU); ex.fill(); ex.fillStyle = '#ffffff'; ex.beginPath(); ex.arc(4, 0, 2, 0, TAU); ex.fill(); }
        else { ex.fillStyle = g.col; ex.fillRect(0, -1.5, 6, 3); ex.fillStyle = P.Y; ex.fillRect(0, -0.5, 9, 1); ex.fillRect(3, -3, 1, 6); }
        ex.restore();
      }
      else if (hOf(S) && hOf(S).ready && g.slot != null) { const GH = hOf(S); heroBlit(ex, GH.tint(g.col), GH, g.slot, g.x, g.y + 1, g.t / 0.2 * 0.6); }
      else { ex.globalAlpha = g.t / 0.2 * 0.5; ex.drawImage(tinted(D.SPR.body, g.col), g.x - D.SPR.body.w / 4, g.y - 2 - D.SPR.body.h / 2, D.SPR.body.w / 2, D.SPR.body.h / 2); ex.globalAlpha = 1; }
    }
    if (D.K && D.K.meleeDraw) D.K.meleeDraw(S, ctx, ex); // 近战刀光、斩线、剑气、旋风（melee.js）
    else if (p.swingT > 0 && p.hp > 0) { const k = p.swingT / 0.16, arc = Math.min(2.6, p.swingArc || 1.1); ex.strokeStyle = D.rgba(P[6], k); ex.lineWidth = 1.5; ex.beginPath(); ex.arc(p.x, p.y - 6, 16, p.aim - arc * (1 - k) - 0.2, p.aim + arc * (1 - k) + 0.2); ex.stroke(); }
    // 玩家子弹
    for (const s of S.shots) { const a = Math.atan2(s.vy, s.vx), Ln = s.over ? 12 : 7; ex.strokeStyle = s.col; ex.lineWidth = s.over ? 2.5 : 1; ex.beginPath(); ex.moveTo(s.x, s.y); ex.lineTo(s.x - Math.cos(a) * Ln, s.y - Math.sin(a) * Ln); ex.stroke(); ex.strokeStyle = '#fff6d0'; ex.lineWidth = 0.5; ex.beginPath(); ex.moveTo(s.x, s.y); ex.lineTo(s.x - Math.cos(a) * Ln * 0.6, s.y - Math.sin(a) * Ln * 0.6); ex.stroke(); }
    // 敌人曳光（开枪之后才出现）
    for (const t of S.tracers) { const k = t.t / t.max; ex.strokeStyle = D.rgba(t.col, k); ex.lineWidth = t.w; ex.beginPath(); ex.moveTo(t.x0, t.y0); ex.lineTo(t.x1, t.y1); ex.stroke(); ex.strokeStyle = D.rgba('#ffffff', k); ex.lineWidth = 0.5; ex.stroke(); }
    for (const s of S.eshots) {
      if (s.k === 'hook') { const f = s.from; if (f && !f.dead) { ex.strokeStyle = D.rgba(P[5], 0.7); ex.lineWidth = 0.5; ex.beginPath(); ex.moveTo(f.x, f.y - 10); ex.lineTo(s.x, s.y); ex.stroke(); } ctx.fillStyle = P.k; ctx.fillRect(s.x - 2.5, s.y - 2.5, 5, 5); ctx.fillStyle = P[5]; ctx.fillRect(s.x - 2, s.y - 2, 4, 4); continue; }
      ctx.fillStyle = P.k; ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fill(); ex.fillStyle = s.col; ex.beginPath(); ex.arc(s.x, s.y, 2.5, 0, TAU); ex.fill(); ex.fillStyle = '#ffffff'; ex.beginPath(); ex.arc(s.x, s.y, 1.2, 0, TAU); ex.fill();
    }
    for (const b of S.bolts) { ex.strokeStyle = b.t > 0.08 ? P.C : P.c; ex.lineWidth = b.t > 0.1 ? 1.5 : 0.5; ex.beginPath(); b.pts.forEach((q, i) => i ? ex.lineTo(q[0], q[1]) : ex.moveTo(q[0], q[1])); ex.stroke(); }
    for (const b of S.beams) { const k = b.t / b.max; ex.strokeStyle = D.rgba(b.col, k); ex.lineWidth = 1; ex.beginPath(); ex.moveTo(b.x0, b.y0); ex.lineTo(b.x1, b.y1); ex.stroke(); }
    // 粒子
    for (const q of S.parts) {
      const k = q.life / q.max;
      if (q.k === 'spark') { ex.strokeStyle = q.col; ex.globalAlpha = Math.min(1, k * 1.5); ex.lineWidth = 0.5; ex.beginPath(); ex.moveTo(q.x, q.y); ex.lineTo(q.x - q.vx * 0.025, q.y - q.vy * 0.025); ex.stroke(); }
      else if (q.k === 'debris') { ctx.fillStyle = q.col; ctx.fillRect(q.x, q.y - q.z, 1.5, 1.5); }
      else if (q.k === 'smoke') { ctx.globalAlpha = k * 0.5; ctx.fillStyle = q.col; const s = q.size; ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s); }
      else if (q.k === 'ring') { const r = q.r * D.ease.outCubic(1 - k); ex.strokeStyle = q.col; ex.globalAlpha = k; ex.lineWidth = k > 0.5 ? 1.5 : 0.5; ex.beginPath(); ex.ellipse(q.x, q.y, r, r * 0.6, 0, 0, TAU); ex.stroke(); }
      ctx.globalAlpha = 1; ex.globalAlpha = 1;
    }
    ex.lineWidth = 1;
    // 灯具与光柱
    for (const l of A.lights) if (l.fx) D.LFX.fixture(ctx, ex, l, time); else if (l.shaft) { // 灯具效果库（lightfx.js）；没有 fx 的老灯照旧画光柱
      const fl = flick(l, time), x = l.x, y = l.y;
      ctx.fillStyle = P.k; ctx.fillRect(x - 6, y - 2, 12, 4); ctx.fillStyle = '#3a3f55'; ctx.fillRect(x - 5.5, y - 2, 11, 2); ctx.fillStyle = '#6a7290'; ctx.fillRect(x - 5.5, y - 2, 11, 0.5);
      ex.fillStyle = D.rgba(l.col, 0.95 * fl); ex.fillRect(x - 4.5, y + 1, 9, 1);
      const g = ex.createLinearGradient(0, y, 0, y + 120); g.addColorStop(0, D.rgba(l.col, 0.13 * fl)); g.addColorStop(1, D.rgba(l.col, 0));
      ex.fillStyle = g; ex.beginPath(); ex.moveTo(x - 5, y + 2); ex.lineTo(x + 5, y + 2); ex.lineTo(x + 30, y + 120); ex.lineTo(x - 30, y + 120); ex.fill();
    }
    if ((A.floorArt === 'gen2' || A.floorArt === 'dress') && D.gen2 && D.gen2.drawShafts) { A._camX = cx; A._camY = cy; D.gen2.drawShafts(ex, A, time, flick); } // 第二代 P5：大厅吊灯下的光柱
    if ((A.floorArt === 'gen2' || A.floorArt === 'dress') && D.gen2 && D.gen2.moteAt) S.motes.forEach((m, i) => { const [x, y, k] = D.gen2.moteAt(A, m, i); ex.fillStyle = D.rgba('#ffe9c4', Math.min(0.6, (0.14 + 0.14 * Math.sin(time * 2 + m.s * 10)) * k)); ex.fillRect(x, y, 0.5, 0.5); }); // 飘灰聚在灯下
    else for (const m of S.motes) { ex.fillStyle = D.rgba('#ffe9c4', 0.14 + 0.14 * Math.sin(time * 2 + m.s * 10)); ex.fillRect(m.x, m.y, 0.5, 0.5); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ex.setTransform(1, 0, 0, 1, 0, 0);

    for (const l of A.lights) { if (l.fx) D.LFX.light(l, time, LT); else LT(l.x, l.y + (l.oy || 0), l.r, l.col, l.a * flick(l, time)); }
    for (const l of S.tlights) LT(l.x, l.y, l.r, l.col, ST.reduceFlash ? Math.min(0.5, l.a) : l.a);
    if (p.hp > 0) { LT(p.x, p.y - 10, 85, '#ffc890', 0.6); LT(p.x + Math.cos(p.aim) * 30, p.y - 6 + Math.sin(p.aim) * 30, 50, '#ffe0b0', 0.25); }
    for (const e of S.enemies) if (!e.dead && here(e)) { const c = { crawler: P.g, turret: P.m, raider: P.O, sniper: P.c, medic: P.g, bomber: P.r }[e.kind] || P.r; LT(e.x, e.y - 8, e.kind === 'boss' ? 90 : 40, c, e.tele > 0 ? 1 : 0.5); }
    for (const c of S.containers) if (here(c) && (!D.containerDone(c) || !c.opened)) LT(c.x, c.y - 8, 22, '#ffd27a', 0.35);
    for (const s of S.eshots) LT(s.x, s.y, 22, s.col, 0.7);
    for (const s of S.shots) LT(s.x, s.y, s.over ? 40 : 18, s.col, 0.6);
    for (const t of S.tracers) LT(t.x1, t.y1, 30, t.col, t.t / t.max);
    L.render(ctx, A.ambient, { tint: p.hurtT > 0 && !ST.reduceFlash ? D.rgba('#ff1030', p.hurtT * 0.35) : S.slowmo > 0 ? D.rgba('#40c8ff', 0.14) : null });

    for (const e of S.enemies) if (!e.dead && here(e) && e.spawnT <= 0) intentUI(ctx, S, e, cx, cy);
    for (const t of S.texts) {
      if (ST.dmgNums === false && /^[-+]?\d+$/.test(t.s)) continue; // 设置里关掉了伤害数字
      const k = t.t < 0.12 ? D.ease.outBack(t.t / 0.12) : 1;
      if (t.t > 0.7) ctx.globalAlpha = 1 - (t.t - 0.7) / 0.2;
      D.text(ctx, t.s, (t.x - cx) * Z, (t.y - cy) * Z - (1 - k) * 12, t.col, { align: 'center', scale: t.big ? 3 : 2 });
      ctx.globalAlpha = 1;
    }
    if (D.drawTownOverlay && S.town) D.drawTownOverlay(ctx, S, cx, cy); // 人类据点：闲话气泡、摊位招牌（outpost-town.js）
    if (D.Barks) D.Barks.draw(ctx, S, cx, cy); // 剧情灵魂：站里的短句（barks.js）
    if (D.TalkB) D.TalkB.draw(ctx, S, cx, cy); // 站里和人说话：头顶气泡、旁白、选项条（talk-bubble.js）
    // 正在搜的容器：头顶进度圈
    const lc = S.lootOpen && S.lootOpen.items ? S.lootOpen : null;
    if (lc && !D.containerDone(lc)) { const o = lc.items.find(x => !x.seen), k = lc.rt / D.revealTime(o.id), x = (lc.x - cx) * Z, y = (lc.y - 24 - cy) * Z; for (let a = 0; a < 48; a++) { const t = a / 48 * TAU - Math.PI / 2; ctx.fillStyle = a / 48 < k ? P.Y : '#00000099'; ctx.fillRect(Math.round(x + Math.cos(t) * 9), Math.round(y + Math.sin(t) * 9), 2, 2); } }
    if (!S.noHud) feel(ctx, S, time, cx, cy, ST);
    if (!S.noHud && S.tut) D.drawTutArrow(ctx, S, time, cx, cy);
    if (!S.noHud) hud(ctx, S, time); // 小地图也在 hud() 里画（和血条一起按界面透明度 / 大小）
    if (S.outro && D.drawRide) D.drawRide(ctx, S, time); // 列车开走的过场（ride.js）
  };
  // 手感层：低血暗角（越低越收窄、跟着心跳一跳一跳）、受击方向、近战蓄力圈
  function feel(ctx, S, time, cx, cy, ST) {
    const p = S.player, px = (p.x - cx) * Z, py = (p.y - 8 - cy) * Z;
    const low = p.hp > 0 ? D.clamp(1 - p.hp / (p.maxHp * 0.3), 0, 1) : 0;
    if (p.hp > 0 && p.hp < p.maxHp * 0.3) {
      const beat = ST.reduceFlash ? 0 : (S.beat || 0) / 0.25, a = 0.22 + low * 0.3 + beat * 0.18;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * (0.5 - low * 0.18), W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(110,0,20,0)'); g.addColorStop(1, 'rgba(150,0,26,' + a.toFixed(3) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    for (const h of S.hurtDirs || []) { const k = Math.min(1, h.t / 0.5); ctx.strokeStyle = D.rgba(P.R, k * 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 40, h.a - 0.32, h.a + 0.32); ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = D.rgba('#ffffff', k * 0.6); ctx.beginPath(); ctx.arc(px, py, 44, h.a - 0.18, h.a + 0.18); ctx.stroke(); }
    // 开镜：从枪口到准星一条细线，越稳越亮；四周压暗
    if ((p.ads || 0) > 0.02 && p.hp > 0) {
      const I = D.Input, k = p.ads, g = ctx.createRadialGradient(I.mx, I.my, H * (0.55 - 0.25 * k), I.mx, I.my, H * 1.1);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(4,4,10,' + (0.55 * k).toFixed(3) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = D.rgba(p.adsFull ? '#ffe28a' : '#ff5a5a', 0.15 + 0.5 * k); ctx.lineWidth = p.adsFull ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(px + Math.cos(p.aim) * 22, py - 6 + Math.sin(p.aim) * 14); ctx.lineTo(I.mx, I.my); ctx.stroke(); ctx.lineWidth = 1;
      if (p.adsFull) { ctx.strokeStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(I.mx, I.my, 7, 0, TAU); ctx.stroke(); }
    }
    // 用药读条：主角头顶一圈绿色进度
    if (p.useT > 0 && p.useK && p.hp > 0) { const u = D.USE[p.useK], k = 1 - p.useT / u.time; for (let i = 0; i < 32; i++) { if (i / 32 > k) break; const t = i / 32 * TAU - Math.PI / 2; ctx.fillStyle = u.heal ? P.g : P.c; ctx.fillRect(Math.round(px + Math.cos(t) * 16), Math.round(py - 4 + Math.sin(t) * 16), 2, 2); } }
    if (p.charging && p.chargeT > 0.15 && p.hp > 0) {
      const k = Math.min(1, p.chargeT / D.TUNE.chargeT), full = k >= 1;
      for (let i = 0; i < 32; i++) { if (i / 32 > k) break; const t = i / 32 * TAU - Math.PI / 2; ctx.fillStyle = full ? ((time * 10 | 0) % 2 ? P.Y : P.O) : P.O; ctx.fillRect(Math.round(px + Math.cos(t) * 20), Math.round(py + Math.sin(t) * 20), 2, 2); }
    }
  }

  function flick(l, time) { return l.flick > 0.3 ? ((Math.sin(time * 23 + l.seed) + Math.sin(time * 7.3 + l.seed * 3)) > 1.2 ? 0.15 : 1) : 1 - l.flick * Math.sin(time * 9 + l.seed); }
  const tintCache = new Map();
  function tinted(spr, col) { if (tintCache.has(col)) return tintCache.get(col); const [c, x] = D.canvas(spr.w, spr.h); x.drawImage(spr.flash, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, spr.w, spr.h); tintCache.set(col, c); return c; }
  function actor(ctx, ex, spr, x, y, flip, white) {
    D.blit(ctx, spr, x, y, flip, white ? 'flash' : null);
    ex.globalAlpha = white ? 0.9 : LIFT; D.blit(ex, spr, x, y, flip, white ? 'flash' : null); ex.globalAlpha = 1;
    if (!white && spr.emit) D.blit(ex, spr, x, y, flip, 'emit');
  }
  function seg(ctx, x0, y0, x1, y1, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w || 0.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }

  function drawContainer(ctx, ex, S, c, time) {
    const anim = c.openT != null && c.openT < D.OPEN_DUR, pre = anim && c.openT < 0.18;
    const spr = (D.CSPR[c.kind] || D.CSPR.crate)[c.opened && !pre ? 1 : 0], done = c.opened && D.containerDone(c);
    if (done && !c.items.length) ctx.globalAlpha = 0.6;
    // 开箱：先蓄力挤扁、抖一抖，弹开时拉长再回弹；翻找时轻轻晃
    let sx = 1, sy = 1, ox = 0;
    if (anim && pre) { const k = c.openT / 0.18; sx = 1 + 0.08 * k; sy = 1 - 0.1 * k; ox = Math.sin(c.openT * 120) * 0.6 * k; }
    else if (anim) { const k = (c.openT - 0.18) / (D.OPEN_DUR - 0.18); const s = Math.sin(k * Math.PI * 2.2) * (1 - k); sx = 1 - 0.08 * s; sy = 1 + 0.16 * s; }
    if (c.jig > 0) ox += Math.sin(time * 70) * 0.5;
    const tf = g => { g.save(); g.translate(c.x + ox, c.y); g.scale(sx, sy); g.translate(-c.x, -c.y); };
    tf(ctx); tf(ex); actor(ctx, ex, spr, c.x, c.y, false, false); ctx.restore(); ex.restore(); ctx.globalAlpha = 1;
    if (anim && !pre) { const k = (c.openT - 0.18) / (D.OPEN_DUR - 0.18), m = D.CMAT[c.kind]; const g = ex.createRadialGradient(c.x, c.y - spr.h / 4, 0, c.x, c.y - spr.h / 4, 18); g.addColorStop(0, D.rgba(m === 'vault' ? '#ffd860' : '#fff0d0', 0.55 * (1 - k))); g.addColorStop(1, 'rgba(0,0,0,0)'); ex.fillStyle = g; ex.fillRect(c.x - 18, c.y - spr.h / 4 - 18, 36, 36); }
    const top = c.y - spr.h / 2 - 4;
    if (c.locked) { const k = (Math.sin(time * 5) + 1) / 2; ex.fillStyle = D.rgba(P.r, 0.6 + 0.4 * k); ex.fillRect(c.x - 1, top + 1, 2, 2); }
    if (S.scanT > 0 && !done && c.items.length) { const q = Math.max(...c.items.map(o => D.itemInfo(o.id).q)), col = D.QUALITY[q].col; ex.strokeStyle = D.rgba(col, 0.6 + 0.3 * Math.sin(time * 6)); ex.lineWidth = 0.5; ex.strokeRect(c.x - spr.w / 4 - 3, c.y - spr.h / 2 - 3, spr.w / 2 + 6, spr.h / 2 + 5); ex.fillStyle = col; ex.fillRect(c.x - 2, top - 6, 4, 4); }
    if (!done) { const k = (Math.sin(time * 3 + c.x) + 1) / 2; ex.fillStyle = D.rgba(P.Y, 0.5 + 0.5 * k); ex.fillRect(c.x - 1.5, top - k * 2, 3, 0.5); ex.fillRect(c.x - 0.25, top - 1.25 - k * 2, 0.5, 3); }
    else if (c.items.length) { const q = Math.max(...c.items.map(o => D.itemInfo(o.id).q)); ex.fillStyle = D.QUALITY[q].col; ex.fillRect(c.x - 1, top, 2, 2); }
    if (S.near === c) { ex.strokeStyle = D.rgba(P.Y, 0.7); ex.lineWidth = 0.5; ex.strokeRect(c.x - spr.w / 4 - 2, c.y - spr.h / 2 - 2, spr.w / 2 + 4, spr.h / 2 + 3); }
  }
  const groundImg = {};
  function drawGround(ctx, ex, S, g, time, LT) {
    const it = D.itemInfo(g.id), col = D.QUALITY[it.q].col, img = groundImg[it.art] || (groundImg[it.art] = D.makeIcon(it.art) || D.makeIcon('scrap'));
    const pop = g.pop > 0 && g.t < g.pop ? Math.sin(g.t / g.pop * Math.PI) * 10 : 0, bob = Math.sin(time * 3 + g.x * 0.3) * 0.6 - 0.6;
    const x = Math.round((g.x - 7) * 2) / 2, y = Math.round((g.y - 12 - pop + bob) * 2) / 2;
    if (g.dropped) { ctx.globalAlpha = 0.4; ctx.drawImage(img, x, Math.round((g.y - 12 - pop) * 2) / 2, 14, 14); ctx.globalAlpha = 1; return; } // 自己丢掉的：捡不回来，画暗
    ctx.drawImage(img, x, y, 14, 14); ex.globalAlpha = 0.3; ex.drawImage(img, x, y, 14, 14); ex.globalAlpha = 1;
    if (it.q >= 2) { const tw = (Math.sin(time * 4 + g.y) + 1) / 2; ex.fillStyle = D.rgba(col, 0.4 + 0.6 * tw); ex.fillRect(g.x + 4, y + 1 - tw, 0.5, 2); ex.fillRect(g.x + 3.25, y + 1.75 - tw, 2, 0.5); }
    LT(g.x, g.y - 5, 16 + it.q * 6, col, 0.35 + it.q * 0.08);
    if (g.n > 1) { ctx.fillStyle = P.k; ctx.fillRect(g.x + 2, g.y - 3, 6, 4); D.text(ctx, String(Math.min(99, g.n)), g.x + 5, g.y - 3, P[6], { align: 'center', scale: 0.5 }); }
  }
  function npc(ctx, ex, S, o, kind, time, LT) {
    const x = o.x, y = o.y;
    if (kind === 'relay') {
      ctx.fillStyle = P.k; ctx.fillRect(x - 2, y - 30, 4, 30); ctx.fillStyle = '#4a5374'; ctx.fillRect(x - 1.5, y - 30, 3, 30);
      ctx.fillStyle = P.k; ctx.fillRect(x - 10.5, y - 8.5, 21, 9); ctx.fillStyle = '#2f3550'; ctx.fillRect(x - 10, y - 8, 20, 8);
      const on = o.used, bl = (time * 2 | 0) % 2; ex.fillStyle = on ? P.c : bl ? P.r : '#3a1520'; ex.beginPath(); ex.arc(x, y - 31, 2.5, 0, TAU); ex.fill();
      if (on) { for (let i = 0; i < 2; i++) { const t = (time * 0.8 + i / 2) % 1; ex.strokeStyle = D.rgba(P.c, 1 - t); ex.lineWidth = 0.5; ex.beginPath(); ex.arc(x, y - 31, 4 + t * 20, Math.PI * 1.1, Math.PI * 1.9); ex.stroke(); } }
      ex.fillStyle = on ? P.c : P.r; ex.fillRect(x - 7, y - 6, 14, 2);
      LT(x, y - 20, 50, on ? P.c : P.r, 0.7); return;
    }
    if (kind === 'server') { // 战略黑匣子（第 10 节）：一排机柜，读出后指示灯变青
      for (let i = -1; i <= 1; i++) { ctx.fillStyle = P.k; ctx.fillRect(x + i * 9 - 4.5, y - 26.5, 9, 27); ctx.fillStyle = '#20263b'; ctx.fillRect(x + i * 9 - 4, y - 26, 8, 26); for (let k = 0; k < 5; k++) { ctx.fillStyle = '#151a29'; ctx.fillRect(x + i * 9 - 3, y - 24 + k * 5, 6, 3); ex.fillStyle = o.used ? P.c : ((time * 4 + k + i) | 0) % 3 ? '#1a3a5a' : P.g; ex.fillRect(x + i * 9 - 2.5, y - 23 + k * 5, 1, 1); } }
      ex.fillStyle = o.used ? P.c : P.Y; ex.fillRect(x - 12, y - 29, 24, 1); LT(x, y - 14, 60, o.used ? P.c : '#ffd860', 0.7); return;
    }
    if (kind === 'trader') {
      ctx.fillStyle = P.k; ctx.fillRect(x - 14.5, y - 10.5, 29, 11); ctx.fillStyle = '#5e3d36'; ctx.fillRect(x - 14, y - 10, 28, 10); ctx.fillStyle = P.t; ctx.fillRect(x - 14, y - 10, 28, 1.5);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = [P.y, P.c, P.r, P[5], P.g][i]; ctx.fillRect(x - 11 + i * 5, y - 12.5, 3, 2.5); }
      D.blit(ctx, D.SPR.raiderBody, x, y - 10, false); D.blit(ctx, D.SPR.raiderHead, x, y - 17, false);
      ex.fillStyle = D.rgba(P.y, 0.8); ex.fillRect(x - 14, y - 24, 28, 0.5); LT(x, y - 14, 50, '#ffd27a', 0.8);
    } else if (kind === 'healer') {
      ctx.fillStyle = P.k; ctx.fillRect(x - 8.5, y - 22.5, 17, 23); ctx.fillStyle = '#3a3f55'; ctx.fillRect(x - 8, y - 22, 16, 22); ctx.fillStyle = '#5d6683'; ctx.fillRect(x - 8, y - 22, 16, 1.5);
      const on = !o.used; ex.fillStyle = on ? P.g : '#3a3a3a'; ex.fillRect(x - 4, y - 18, 8, 3); ex.fillRect(x - 1, y - 13, 2, 7); ex.fillRect(x - 3.5, y - 10.5, 7, 2);
      if (on) LT(x, y - 12, 46, P.g, 0.7);
    } else { // 撤离终端：大号绿色 EXIT 牌子 + 冲天光柱，和别的东西一眼分得开
      const live = !o.used || (S.extract && S.extract.train), entry = S.step === 0 && !S.tut, gc = entry ? '#7a8a90' : '#3dd66a';
      if (live && !entry) { const g = ex.createLinearGradient(0, y - 170, 0, y); g.addColorStop(0, 'rgba(80,255,140,0)'); g.addColorStop(1, `rgba(80,255,140,${0.28 + 0.1 * Math.sin(time * 3)})`); ex.fillStyle = g; ex.fillRect(x - 12, y - 170, 24, 170); ex.fillStyle = `rgba(200,255,220,${0.25 + 0.1 * Math.sin(time * 3)})`; ex.fillRect(x - 2, y - 170, 4, 170); }
      ctx.fillStyle = P.k; ctx.fillRect(x - 13.5, y - 22.5, 27, 23); ctx.fillStyle = '#2f3550'; ctx.fillRect(x - 13, y - 22, 26, 22); ctx.fillStyle = '#4a5374'; ctx.fillRect(x - 13, y - 22, 26, 1.5);
      const col = o.used ? (S.extract && S.extract.train ? P.g : P.r) : ((time * 3 | 0) % 2 ? P.g : '#1a5a1a');
      ex.fillStyle = col; ex.fillRect(x - 9.5, y - 18, 19, 7); ctx.fillStyle = col; ctx.fillRect(x - 9.5, y - 18, 19, 7);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = [P.r, P.y, P.g][i]; ctx.fillRect(x - 7 + i * 6, y - 7, 3, 3); }
      // 牌子：立在终端上方，两边的箭头一闪一闪往里指
      const by = y - 52 + Math.sin(time * 2) * 1.5;
      ctx.fillStyle = P.k; ctx.fillRect(x - 1, by + 14, 2, 30); ctx.fillStyle = P.k; ctx.fillRect(x - 27, by - 1, 54, 18); ctx.fillStyle = entry ? '#3a4448' : '#145a2a'; ctx.fillRect(x - 26, by, 52, 16);
      ex.fillStyle = D.rgba(gc, 0.22); ex.fillRect(x - 25, by + 1, 50, 14); ctx.fillStyle = gc; ctx.fillRect(x - 25, by + 1, 50, 14);
      D.text(ctx, 'EXIT', x, by + 4, '#05200f', { scale: 2, align: 'center' });
      if (!entry) { const k = (time * 3) % 1; for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const xx = x + s * (34 + i * 6 + (1 - k) * 3); ex.fillStyle = D.rgba(gc, 0.4 + 0.6 * ((i + k) % 1)); ex.beginPath(); ex.moveTo(xx, by + 8); ex.lineTo(xx + s * 4, by + 3); ex.lineTo(xx + s * 4, by + 13); ex.fill(); } }
      LT(x, by + 8, 90, entry ? '#8a9aa0' : P.g, 1); LT(x, y - 10, 60, col, 0.8);
    }
  }

  function drawPlayer(ctx, ex, S, p) {
    const flip = Math.cos(p.aim) < 0;
    const po = poseOf(S, p), sOff = (1 - po.sy) * 16 * (p.scale || 1) + po.dy; // 蹲下、弯腰时披风跟着往下
    if (D.drawCape) D.drawCape(ctx, ex, S, p, sOff, 'back'); // 披风（cape.js）：正对镜头、侧身时在机身后面
    body(ctx, ex, S, p.x, p.y, flip, p.walk, false, p.flash > 0 || (p.inv > 0 && p.dashT <= 0 && (S.t * 20 | 0) % 2 && p.hurtT > 0));
    if (D.drawCape) D.drawCape(ctx, ex, S, p, sOff, 'front'); // 背对镜头时披风盖在背上
    if (p.shield > 0) { ex.strokeStyle = D.rgba(P.c, 0.35 + 0.25 * Math.sin(S.t * 8)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(p.x, p.y - 7, 10, 11, 0, 0, TAU); ex.stroke(); }
    if (S.raid.sup > 0) { ex.fillStyle = D.rgba(P.c, 0.6 + 0.4 * Math.sin(S.t * 12)); ex.fillRect(p.x - 1.5, p.y - 22, 3, 1); } // 弹匣里有超级弹
  }
  // ── 主角动画（图集：八个朝向 × 待机 / 走 / 射击）
  // 朝向跟准星走：角度 0 = 右 → 素材的 dir6，顺时针每 45° 一档
  const DIR_OF = [6, 7, 8, 1, 2, 3, 4, 5];
  D.heroDir = a => DIR_OF[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  const hOf = S => (D.heroOf && S && S.SH && S.SH.key ? D.heroOf(S.SH.key, S.mods) : D.HERO); // 每个型号自己的图集，装着的改装件也画在身上（heroes.js）
  function heroFrame(S, p, ghost) {
    const H = hOf(S), moving = !ghost && Math.hypot(p.vx, p.vy) > 20, firing = !ghost && S.t - (p.lastShot || -9) < 0.35;
    const anim = moving ? 'walk' : firing ? 'shoot' : 'idle', dir = D.heroDir(ghost ? 0 : p.aim), list = H.meta[anim + dir];
    const fps = anim === 'walk' ? 16 * Math.min(1.4, Math.hypot(p.vx, p.vy) / 92) : anim === 'shoot' ? 22 : 10;
    p.animT = (p.animT || 0) + (anim === p.anim ? 1 / 60 * fps : 0); if (anim !== p.anim) { p.anim = anim; p.animT = 0; }
    return list[Math.floor(p.animT) % list.length];
  }
  function heroBlit(c, img, H, slot, x, y, alpha, sc) {
    sc = sc || 1;
    const sx = (slot % H.cols) * H.fw, sy = Math.floor(slot / H.cols) * H.fh, w = H.fw / 2 * sc, h = H.fh / 2 * sc;
    if (alpha != null) c.globalAlpha = alpha;
    c.drawImage(img, sx, sy, H.fw, H.fh, Math.round((x - w / 2) * 2) / 2, Math.round((y - H.footY / 2 * sc) * 2) / 2, w, h);
    if (alpha != null) c.globalAlpha = 1;
  }
  D.heroBlit = heroBlit;
  // ── 动作动画（试玩反馈汇总第 3 轮）：图集只有待机 / 走 / 射击，别的动作靠整体变形 + 手上的道具
  // p.act = 一次性动作 { k, t, dur }：stand 开机站起、swap 换枪、throw 扔手雷、pick 捡东西、done 用完药；
  // 持续的状态直接看计时：useT（读条用药）、reload（换弹）、healOT（维修模块）。
  D.playerAct = (p, k, dur, arg) => { p.act = { k, t: 0, dur, arg }; };
  const ease = u => 1 - (1 - u) * (1 - u), back = u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  function poseOf(S, p) {
    const o = { sx: 1, sy: 1, dx: 0, dy: 0, rot: 0, visor: 1 }, f = Math.cos(p.aim) < 0 ? -1 : 1, A = p.act;
    if (A) {
      const u = Math.min(1, A.t / A.dur);
      if (A.k === 'stand') { const e = u < 0.35 ? 0 : back((u - 0.35) / 0.65); o.sy = 0.62 + 0.38 * e; o.sx = 1 + (1 - o.sy) * 0.35; o.visor = u < 0.55 ? ((S.t * 22 | 0) % 3 ? 0 : 1) : 1; }
      if (A.k === 'swap') { const d = Math.sin(u * Math.PI); o.dy = d * 1.2; o.rot = -f * 0.14 * d; o.sy = 1 - 0.05 * d; }
      if (A.k === 'throw') { o.rot = u < 0.35 ? -f * 0.16 * (u / 0.35) : f * 0.2 * (1 - (u - 0.35) / 0.65) * Math.min(1, (u - 0.35) * 6); }
      if (A.k === 'pick') { const d = Math.sin(u * Math.PI); o.sy = 1 - 0.16 * d; o.sx = 1 + 0.05 * d; o.rot = f * 0.08 * d; }
      if (A.k === 'done') { const d = Math.sin(u * Math.PI); o.sy = 1 + 0.06 * d; o.sx = 1 - 0.03 * d; }
    }
    if (p.useT > 0 && p.useK) {
      const U = D.USE[p.useK];
      if (U.heal) { o.sy *= 0.9; o.sx *= 1.03; o.rot += f * 0.06 + Math.sin(S.t * 15) * 0.025; }
      else if (U.shield) { o.sy *= 1.05; }
      else if (U.buff) { o.dx += Math.round(Math.sin(S.t * 70)) * 0.5; o.rot += f * 0.05; }
    }
    if (p.reload > 0 && p.reloadMax) { const u = 1 - p.reload / p.reloadMax, d = u < 0.25 ? u / 0.25 : u > 0.8 ? (1 - u) / 0.2 : 1; o.dy += 0.6 * d; o.rot += -f * 0.07 * d; }
    heroMotion(S, p, o, f);
    return o;
  }
  // ── 身体的惯性（用户："主角和敌人的动画也改一下"），叠在上面的动作上：
  //   往哪走往哪倾，起步、刹车有一点甩（弹簧，过冲一点再回正）；准星换边时转个身（横向收窄再展开 0.1 秒）；
  //   每开一枪往后坐一下；冲刺时拉长、冲完落地压扁一下；挨打时被顶歪（击退速度进了弹簧）再像果冻一样晃两下。
  //   一帧里会算好几次（披风、近战手持也要），只有 S.t 往前走了才推进弹簧。
  function heroMotion(S, p, o, f) {
    const M = p._mo || (p._mo = { t: S.t, lean: 0, lv: 0, f, turn: 9, dash: false, land: 9 });
    const dt = Math.min(0.05, Math.max(0, S.t - M.t));
    if (dt > 0) {
      M.t = S.t;
      const vx = p.vx || 0, tgt = D.clamp(vx / 92, -1.4, 1.4) * 0.07 + (p.dashT > 0 ? Math.sign(vx) * 0.1 : 0);
      M.lv += ((tgt - M.lean) * 260 - M.lv * 16) * dt; M.lean += M.lv * dt;
      if (f !== M.f) { M.turn = M.turn >= 0.1 ? 0 : 0.1; M.f = f; } else M.turn += dt; // 准星在中线上来回晃：上一次还没转完就不再转
      if (p.dashT > 0) M.dash = true; else if (M.dash) { M.dash = false; M.land = 0; } else M.land += dt;
    }
    o.rot += D.clamp(M.lean, -0.2, 0.2);
    if (M.turn < 0.1) { const c = -Math.cos(Math.PI * M.turn / 0.1); o.sx *= (c < 0 ? -1 : 1) * Math.max(0.3, Math.abs(c)); }
    const since = S.t - (p.lastShot != null ? p.lastShot : -9);
    if (since >= 0 && since < 0.1) { const k = (1 - since / 0.1) * (1 - since / 0.1); o.dx -= f * 0.9 * k; o.rot -= f * 0.06 * k; o.sx *= 1 + 0.04 * k; o.sy *= 1 - 0.03 * k; }
    if (p.dashT > 0) { o.sx *= 1.14; o.sy *= 0.9; }
    else if (M.land < 0.16) { const u = M.land / 0.16, k = Math.sin(u * Math.PI) * (1 - u * 0.5); o.sy *= 1 - 0.12 * k; o.sx *= 1 + 0.08 * k; }
    if (p.hurtT > 0) { const s = Math.max(0, 0.35 - p.hurtT), w = Math.sin(s * 45) * Math.exp(-s * 9); o.sx *= 1 + 0.1 * w; o.sy *= 1 - 0.1 * w; }
  }
  D.heroPose = poseOf;
  // 手上的道具和光效（画在机器人前面）
  function actProps(ctx, ex, S, p, x, y, sc) {
    const f = Math.cos(p.aim) < 0 ? -1 : 1, cx = x + f * 5, cy = y - 11, A = p.act, px = (c, xx, yy, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(xx * 2) / 2, Math.round(yy * 2) / 2, w, h); };
    if (p.useT > 0 && p.useK) {
      const U = D.USE[p.useK], u = D.clamp(1 - p.useT / U.time, 0, 1);
      if (p.useK === 'medkit') { const by = cy + 1 + Math.round(Math.sin(S.t * 15)) * 0.5; px(ctx, cx - 3, by - 2.5, 6, 5, P.k); px(ctx, cx - 2.5, by - 2, 5, 4, '#e6ecf6'); px(ctx, cx - 2.5, by - 2, 5, 1, '#ffffff'); px(ctx, cx - 0.5, by - 1.5, 1, 3, '#ff3047'); px(ctx, cx - 1.5, by - 0.5, 3, 1, '#ff3047');
        ex.strokeStyle = D.rgba(P.g, 0.7 * (1 - u)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(x, y, 6 + u * 9, 2.5 + u * 3.5, 0, 0, TAU); ex.stroke(); // 读条的绿圈往外扩
        if ((S.t * 12 | 0) % 2) px(ex, cx + f * 3, cy - 1, 1, 1, '#ffffff'); }
      else if (p.useK === 'patch') { const k = Math.min(1, u * 1.6), bx = D.lerp(cx + f * 2, x - f * 2, k), by = D.lerp(cy + 2, cy - 2, k); px(ctx, bx - 2, by - 1.5, 4, 3, P.k); px(ctx, bx - 1.5, by - 1, 3, 2, '#d8b98a'); if (u > 0.6) px(ex, x - f * 2, cy - 2.5, 1, 1, P.g); }
      else if (p.useK === 'cell') { px(ctx, cx - 1.5, cy - 3, 3, 5, P.k); px(ctx, cx - 1, cy - 2.5, 2, 4, P.c); ex.strokeStyle = D.rgba(P.c, 0.8 * (1 - u)); ex.lineWidth = 0.5; ex.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU + 0.5, r = 4 + u * 12; ex[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y - 8 + Math.sin(a) * r); } ex.stroke(); }
    }
    if (p.healOT > 0) { // 维修模块：胸口焊花
      const k = (S.t * 30 | 0); px(ex, cx - f * 3, cy + 1, 1, 1, k % 2 ? '#ffffff' : '#7fd8ff');
      for (let i = 0; i < 2; i++) { const h = Math.sin(k * 12.9898 + i * 78.233) * 43758.5453, r = h - Math.floor(h); px(ex, cx - f * 3 + (r - 0.5) * 6, cy + 1 - r * 4, 0.5, 0.5, i ? P.y : '#ffffff'); }
    }
    if (p.reload > 0 && p.reloadMax) { // 换弹：旧弹匣掉下去，新弹匣塞上来
      const u = 1 - p.reload / p.reloadMax, mx = x + f * 4;
      if (u < 0.4) { const k = u / 0.4; px(ctx, mx - 1, cy + 2 + k * k * 9, 2, 3, P.k); px(ctx, mx - 0.5, cy + 2.5 + k * k * 9, 1, 2, '#646e86'); }
      else if (u > 0.5 && u < 0.85) { const k = (u - 0.5) / 0.35; px(ctx, mx - 1, cy + 6 - ease(k) * 4, 2, 3, P.k); px(ctx, mx - 0.5, cy + 6.5 - ease(k) * 4, 1, 2, P.O); }
    }
    if (A) {
      const u = Math.min(1, A.t / A.dur);
      if (A.k === 'stand') { ex.strokeStyle = D.rgba(P.c, 0.8 * (1 - u)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(x, y + 1, 4 + u * 14, 1.5 + u * 5, 0, 0, TAU); ex.stroke(); }
      if (A.k === 'swap') { const w = Math.max(0.5, Math.abs(Math.cos(u * Math.PI * 3)) * 6), ty = y - 25 * (sc || 1) - 5 - u * 3; ctx.globalAlpha = 1 - Math.max(0, u - 0.7) / 0.3; px(ctx, x - w / 2 - 0.5, ty - 0.5, w + 1, 5, P.k); px(ctx, x - w / 2, ty, w, 4, '#eef3ff'); if (w > 2) px(ctx, x - w / 2 + 0.5, ty + 0.5, w - 1, 3, A.arg === 'gun' ? P.o : A.arg === 'melee' ? P.r : P.c); ctx.globalAlpha = 1; px(ex, x - 0.5, ty + 1.5, 1, 1, '#ffffff'); }
      if (A.k === 'done' && D.USE[A.arg]) { const col = D.USE[A.arg].heal ? P.g : D.USE[A.arg].shield ? P.c : P.y; ex.fillStyle = D.rgba(col, 0.9 * (1 - u)); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + u * 3; ex.fillRect(Math.round((x + Math.cos(a) * (5 + u * 10)) * 2) / 2, Math.round((y - 9 + Math.sin(a) * (4 + u * 8)) * 2) / 2, 1, 1); } }
    }
  }
  function body(ctx, ex, S, x, y, flip, walk, ghost, white) {
    const H = hOf(S);
    if (H && H.ready) {
      const p = S.player, slot = heroFrame(S, p, ghost), SH = S.SH || D.SHELLS.worker, V = H.variant(SH.tint, SH.visor), sc = SH.scale || 1;
      const cloak = p.cloakT > 0 && !ghost, ca = cloak ? 0.28 + 0.1 * Math.sin(S.t * 30) : 1;
      const po = ghost ? null : poseOf(S, p), posed = po && (po.sx !== 1 || po.sy !== 1 || po.dx || po.dy || po.rot);
      const MH = !ghost && D.MeleeHold ? D.MeleeHold.frame(S, p, H, slot) : null; // 拿着近战：抠掉枪管、手里画武器（melee-hold.js）
      const hb = MH ? (c, img, H2, s2, xx, yy, a, sc2) => D.MeleeHold.blit(c, img, H2, s2, xx, yy, a, sc2, img === V.img) : heroBlit;
      const pb = (c, img, xx, yy, a) => { if (!posed) return hb(c, img, H, slot, xx, yy, a, sc); c.save(); c.translate(xx + po.dx, yy + po.dy); c.rotate(po.rot); c.scale(po.sx, po.sy); hb(c, img, H, slot, 0, 0, a, sc); c.restore(); };
      const mhDraw = () => { // 图集像素 → 世界坐标（跟着整体变形走），再画武器
        const fx0 = -H.fw / 4 * sc, fy0 = -H.footY / 2 * sc, cr = posed ? Math.cos(po.rot) : 1, sr = posed ? Math.sin(po.rot) : 0;
        const at = (fx, fy) => { const lx = (fx0 + fx / 2 * sc) * (posed ? po.sx : 1), ly = (fy0 + fy / 2 * sc) * (posed ? po.sy : 1); return [x + (posed ? po.dx : 0) + lx * cr - ly * sr, y + 1 + (posed ? po.dy : 0) + lx * sr + ly * cr]; };
        const DF = D.HERO_DEFS && D.HERO_DEFS[SH.key]; D.MeleeHold.draw(ctx, ex, S, p, MH, at, (DF && DF.ramp) || D.RAMP.steel);
      };
      if (MH && MH.back && !cloak) mhDraw(); // 背对镜头：武器在身后
      if (cloak) ctx.globalAlpha = ca;
      pb(ctx, white ? H.flash : V.img, x, y + 1, cloak ? ca : null);
      if (cloak) { pb(ex, H.tint('#3ee8ff'), x + Math.sin(S.t * 40) * 0.5, y + 1, 0.25); ctx.globalAlpha = 1; }
      else {
        pb(ex, white ? H.flash : V.img, x, y + 1, white ? 0.9 : 0.16);
        if (!white && !ghost && H.rim) pb(ex, H.rim, x, y + 1, 0.5); // 冷色轮廓光：只描边，暗处也能看见主角
        if (!white && (!po || po.visor)) pb(ex, V.emit, x, y + 1, null);
      }
      if (!ghost && !cloak) actProps(ctx, ex, S, p, x, y, sc);
      if (p.healOT > 0 && !ghost) { ex.strokeStyle = D.rgba(P.g, 0.4 + 0.3 * Math.sin(S.t * 10)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(x, y, 14, 6, 0, 0, TAU); ex.stroke(); }
      // 近战：手里拿着武器（melee-hold.js）；没有这张表的老近战还是挥一道线
      if (MH && !MH.back && !cloak) mhDraw();
      else if (!MH && p.swingT > 0 && !ghost && !(D.MeleeHold && D.MELEE_LOOK[D.cardBase ? D.cardBase(S.raid.load.melee) : S.raid.load.melee])) {
        const R = S.raid.load, sx = x + Math.cos(p.aim) * 3, sy = y - 12, sa = p.aim + p.swingDir * (p.swingT / 0.16 - 0.5) * 2.4, mc = (D.meleeCol && D.meleeCol(R.melee)) || P[5], ml = 12;
        seg(ctx, sx, sy, sx + Math.cos(sa) * ml, sy + Math.sin(sa) * ml, P.k, 2.5); seg(ctx, sx, sy, sx + Math.cos(sa) * ml, sy + Math.sin(sa) * ml, mc, 1.5); seg(ctx, sx + Math.cos(sa) * 5, sy + Math.sin(sa) * 5, sx + Math.cos(sa) * ml, sy + Math.sin(sa) * ml, '#ffffff', 0.5);
      }
      // 过载弹蓄满时枪口亮青光
      if (S.raid.sup > 0 && !ghost && !(MH && MH.gun)) { ex.fillStyle = P.c; ex.fillRect(x + Math.cos(p.aim) * 12 - 0.75, y - 11 + Math.sin(p.aim) * 7 - 0.75, 1.5, 1.5); }
      return;
    }
    const p = S.player, moving = !ghost && Math.hypot(p.vx, p.vy) > 20, R = S.raid.load;
    const bob = moving ? -Math.abs(Math.sin(walk)) * 1 : Math.sin(S.t * 2.5) * 0.25 - 0.25;
    const by = Math.round(bob * 2) / 2;
    const l1 = moving ? Math.round(Math.sin(walk) * 4) / 2 : 0, l2 = -l1;
    for (const [lx, ll] of [[-3.5, l1], [1, l2]]) { ctx.fillStyle = P.k; ctx.fillRect(x + lx - 0.5, y - 4.5 + Math.min(0, ll), 3.5, 5 - Math.min(0, ll)); ctx.fillStyle = '#20263b'; ctx.fillRect(x + lx, y - 4 + Math.min(0, ll), 2.5, 4 - Math.min(0, ll)); ctx.fillStyle = '#4c5c86'; ctx.fillRect(x + lx, y - 4 + Math.min(0, ll), 0.5, 3); ctx.fillStyle = '#2d3550'; ctx.fillRect(x + lx - 0.5, y - 1, 3.5, 1); }
    actor(ctx, ex, D.SPR.body, x, y - 2 + by, flip, white);
    const a = ghost ? 0 : p.aim, sx = x + (flip ? -3 : 3), sy = y - 7 + by;
    const gun = (D.cardBase ? D.cardBase(R.gun) : R.gun) || 'nailgun', gl = { railgun: 13, pulse: 11, plasma: 11, shotgun: 10, smg: 9, minigun: 12, gl: 10, flamer: 10, dbarrel: 10, burst: 10, emshot: 10, xbow: 9, smart: 9, ricochet: 9, hookgun: 9, revolver: 7 }[gun] || 8, gc = { pulse: P.c, railgun: P.c, plasma: P.m, smart: P.c, emshot: '#ffd84a', flamer: '#ff8a2e', gl: P.m }[gun] || P.O;
    if (p.swingT > 0 && !ghost) {
      const sa = p.aim + p.swingDir * (p.swingT / 0.16 - 0.5) * 2.4, mc = (D.meleeCol && D.meleeCol(R.melee)) || P[5];
      seg(ctx, sx, sy, sx + Math.cos(sa) * 12, sy + Math.sin(sa) * 12, P.k, 2.5); seg(ctx, sx, sy, sx + Math.cos(sa) * 12, sy + Math.sin(sa) * 12, mc, 1.5); seg(ctx, sx + Math.cos(sa) * 5, sy + Math.sin(sa) * 5, sx + Math.cos(sa) * 12, sy + Math.sin(sa) * 12, '#ffffff', 0.5);
    } else {
      const ex2 = sx + Math.cos(a) * gl, ey2 = sy + Math.sin(a) * gl;
      seg(ctx, sx, sy, ex2, ey2, P.k, 3); seg(ctx, sx, sy, ex2, ey2, '#2d3342', 2); seg(ctx, sx + Math.cos(a) * 2, sy + Math.sin(a) * 2 - 0.5, ex2, ey2 - 0.5, '#646e86', 0.5);
      ex.fillStyle = S.raid.sup > 0 ? P.c : gc; ex.fillRect(ex2 - 0.75, ey2 - 0.75, 1.5, 1.5);
    }
    actor(ctx, ex, D.SPR.head, x, y - 11.5 + by + (moving ? Math.round(Math.sin(walk - 0.6) * -1) / 2 : 0), flip, white);
  }

  function drawEnemy(ctx, ex, S, e, LT) {
    const white = e.flash > 0;
    if (e.spawnT > 0) ctx.globalAlpha = 1 - e.spawnT / 0.35;
    const x = e.x, y = e.y, tele = e.tele > 0, shakeX = tele && e.tele < 0.25 ? Math.round(Math.sin(S.t * 80)) * 0.5 : 0, SP = D.SPR;
    const pz = D.foePose && D.foePose(S, e); // M6：呼吸、走路、蓄势、挨打……（look.js），以脚底为轴整体变形
    if (pz) for (const g of [ctx, ex]) { g.save(); g.translate(x + pz.dx, y + pz.dy); g.rotate(pz.rot); g.scale(pz.sx, pz.sy); g.translate(-x, -y); }
    if (D.drawFoe && D.drawFoe(ctx, ex, S, e, white, LT, { actor, seg })) {} // M5 的新敌人（foes.js）
    else if (e.kind === 'welder') {
      actor(ctx, ex, SP.welder, x + shakeX, y, e.face < 0, white);
      const a = e.aimA != null ? e.aimA : (e.face > 0 ? 0 : Math.PI), gx = x + e.face * 5, gy = y - 12;
      seg(ctx, gx, gy, gx + Math.cos(a) * 11, gy + Math.sin(a) * 11, P.k, 3); seg(ctx, gx, gy, gx + Math.cos(a) * 11, gy + Math.sin(a) * 11, '#646e86', 1.5);
      if (tele || (e.act && e.act.k === 'burst')) { const tx = gx + Math.cos(a) * 12, ty = gy + Math.sin(a) * 12; ex.fillStyle = (S.t * 30 | 0) % 2 ? '#ffffff' : '#7fd8ff'; ex.fillRect(tx - 1, ty - 1, 2, 2); LT(tx, ty, 26, '#7fd8ff', 0.9); }
    } else if (e.kind === 'mannequin') {
      actor(ctx, ex, e.dormant ? SP.mannequin : SP.mannequinOn, x + shakeX, y - (e.z || 0), e.face < 0, white);
    } else if (e.kind === 'dog') {
      const z = e.z || 0, ph = e.t * 20;
      for (const [lx, o] of [[-5, 0], [-2, 1.5], [3, 0.7], [6, 2.2]]) { const w = Math.sin(ph + o) * 1.5; seg(ctx, x + lx, y - 5 - z, x + lx + w, y - z, P.k, 1.5); seg(ctx, x + lx, y - 5 - z, x + lx + w, y - z, white ? '#fff' : '#566a31', 0.75); }
      actor(ctx, ex, SP.dog, x + shakeX, y - 3 - z, e.face < 0, white);
    } else if (e.kind === 'mite') {
      const z = e.z || 0, ph = e.t * 18;
      for (const side of [-1, 1]) for (let i = 0; i < 2; i++) { const w = Math.sin(ph + i * 2 + (side > 0 ? 1.5 : 0)); seg(ctx, x + side * 3, y - 3 - z, x + side * 7, y + (i - 0.5) * 3 + w, P.k, 1); seg(ctx, x + side * 3, y - 3 - z, x + side * 7, y + (i - 0.5) * 3 + w, white ? '#fff' : '#80492e', 0.5); }
      actor(ctx, ex, SP.mite, x + shakeX, y - z + (tele ? 0.5 : 0), e.face < 0, white);
    } else if (e.kind === 'scav') {
      const bob = Math.round(Math.sin(e.t * 8)) * 0.5;
      actor(ctx, ex, SP.scav, x + shakeX, y + bob, e.face < 0, white);
      const a = e.aimA != null ? e.aimA : (e.face > 0 ? 0 : Math.PI), gx = x, gy = y - 13 + bob;
      seg(ctx, gx, gy, gx + Math.cos(a) * 8, gy + Math.sin(a) * 8, P.k, 2); seg(ctx, gx, gy, gx + Math.cos(a) * 8, gy + Math.sin(a) * 8, '#646e86', 1);
      if (tele) LT(x, y - 12, 20, P.O, 0.5 + 0.5 * (1 - e.tele / e.teleMax));
    } else if (e.kind === 'crawler') {
      const z = e.z || 0, ph = e.t * 14;
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const hx = x + side * 4, hy = y - 4 - z + (i - 1) * 2, w = Math.sin(ph + i * 2.1 + (side > 0 ? 1.5 : 0));
        const fx = x + side * (11 + (i === 1 ? 1 : 0)), fy = y - 1 + (i - 1) * 3 + w * 1.5 - (z > 0 ? 2 : 0), kx = (hx + fx) / 2 + side * 1.5, ky = Math.min(hy, fy) - 3 - (tele ? 1 : 0);
        seg(ctx, hx, hy, kx, ky, P.k, 1.5); seg(ctx, kx, ky, fx, fy, P.k, 1.5); seg(ctx, hx, hy, kx, ky, white ? '#fff' : '#80492e', 0.75); seg(ctx, kx, ky, fx, fy, white ? '#fff' : '#5c3423', 0.75); ctx.fillStyle = '#cf8a57'; ctx.fillRect(kx - 0.25, ky - 0.25, 0.5, 0.5);
      }
      actor(ctx, ex, SP.crawler, x + shakeX, y - z + (tele ? 0.5 : 0), e.face < 0, white);
    } else if (e.kind === 'drone') {
      const z = 6 + Math.sin(e.t * 3) * 1.5, blade = (S.t * 30 | 0) % 2;
      ctx.fillStyle = blade ? '#c8cee0' : '#6a7290'; ctx.fillRect(x - 14, y - z - 9, 7, 0.5); ctx.fillRect(x + 7, y - z - 9, 7, 0.5);
      actor(ctx, ex, SP.drone, x + shakeX, y - z, e.face < 0, white);
      if (tele) LT(x, y - z - 6, 26, P.r, 0.6 + 0.6 * (1 - e.tele / e.teleMax));
    } else if (e.kind === 'sniper') {
      actor(ctx, ex, SP.sniper, x + shakeX, y, e.face < 0, white);
      const a = e.aimA != null ? e.aimA : (e.face > 0 ? 0 : Math.PI), bx = x, by = y - 11;
      seg(ctx, bx, by, bx + Math.cos(a) * 16, by + Math.sin(a) * 16, P.k, 2); seg(ctx, bx, by, bx + Math.cos(a) * 16, by + Math.sin(a) * 16, '#646e86', 1);
      if (tele) { const k = 1 - e.tele / e.teleMax, gx = x, gy = y - 13.5; ex.fillStyle = D.rgba('#d0fbff', 0.5 + 0.5 * k); ex.fillRect(gx - 0.5 - k * 4, gy - 0.25, 1 + k * 8, 0.5); ex.fillRect(gx - 0.25, gy - 0.5 - k * 4, 0.5, 1 + k * 8); LT(gx, gy, 10 + k * 40, P.c, 0.4 + k * 0.8); }
    } else if (e.kind === 'turret') {
      actor(ctx, ex, SP.turret, x, y, false, white);
      if (tele) { const k = 1 - e.tele / e.teleMax; ex.fillStyle = D.rgba(P.M, 0.6 + 0.4 * k); ex.fillRect(x + 4, y - 14 - k * 2, 3, 2); }
    } else if (e.kind === 'bomber') {
      const z = 4 + Math.sin(e.t * 12) * 1;
      actor(ctx, ex, SP.bomber, x + shakeX, y - z, e.face < 0, white || (tele && (S.t * 16 | 0) % 2));
      if (tele) { ex.strokeStyle = D.rgba(P.r, 0.4 + 0.6 * (1 - e.tele / e.teleMax)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(x, y, 30, 18, 0, 0, TAU); ex.stroke(); LT(x, y - z - 4, 40, P.r, 1); }
    } else if (e.kind === 'medic') {
      const z = 7 + Math.sin(e.t * 2.5) * 1.5;
      if (e.beam && !e.beam.dead) { const t = e.beam; ex.strokeStyle = D.rgba(P.g, 0.5 + 0.3 * Math.sin(S.t * 20)); ex.lineWidth = 1; ex.beginPath(); ex.moveTo(x, y - z - 5); ex.quadraticCurveTo((x + t.x) / 2, Math.min(y, t.y) - 20, t.x, t.y - 8); ex.stroke(); LT(t.x, t.y - 8, 24, P.g, 0.6); }
      actor(ctx, ex, SP.medic, x + shakeX, y - z, false, white);
    } else if (e.kind === 'raider') {
      const bob = -Math.abs(Math.sin(e.t * 10)) * 0.5;
      ctx.fillStyle = P.k; ctx.fillRect(x - 3.5, y - 4.5, 3, 5); ctx.fillRect(x + 0.5, y - 4.5 + (Math.sin(e.t * 10) > 0 ? -0.5 : 0), 3, 5); ctx.fillStyle = '#3a4a22'; ctx.fillRect(x - 3, y - 4, 2, 4); ctx.fillRect(x + 1, y - 4, 2, 4);
      actor(ctx, ex, SP.raiderBody, x + shakeX, y - 2 + bob, e.face < 0, white);
      const a = e.aimA != null ? e.aimA : (e.face > 0 ? 0 : Math.PI), gx = x + e.face * 3, gy = y - 7 + bob;
      seg(ctx, gx, gy, gx + Math.cos(a) * 9, gy + Math.sin(a) * 9, P.k, 2.5); seg(ctx, gx, gy, gx + Math.cos(a) * 9, gy + Math.sin(a) * 9, '#434b5f', 1.5);
      actor(ctx, ex, SP.raiderHead, x + shakeX, y - 11.5 + bob, e.face < 0, white);
      if (e.act && e.act.k === 'medkit') { ex.fillStyle = P.g; ex.fillRect(x - 0.5, y - 25, 1, 4); ex.fillRect(x - 2, y - 23.5, 4, 1); }
    } else if (e.kind === 'engineer') {
      actor(ctx, ex, SP.engineer, x + shakeX, y + 1, e.face < 0, white);
      const ax = x + e.face * 11, ay = y - 9, hot = e.act || tele, spin = S.t * (hot ? 40 : 8);
      ctx.fillStyle = P.k; ctx.beginPath(); ctx.arc(ax, ay, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#949fb6'; ctx.beginPath(); ctx.arc(ax, ay, 4.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#2d3342'; ctx.beginPath(); ctx.arc(ax, ay, 1.5, 0, TAU); ctx.fill();
      for (let i = 0; i < 8; i++) { const t = spin + i * Math.PI / 4, c = hot ? ex : ctx; c.fillStyle = hot ? P.O : '#eef1f8'; c.fillRect(ax + Math.cos(t) * 4.5 - 0.5, ay + Math.sin(t) * 4.5 - 0.5, 1, 1); }
      // 正面护盾
      const sa = e.shieldA, sc = e.shieldHit > 0 ? '#ffffff' : P.c; e.shieldHit = (e.shieldHit || 0) - 1 / 60;
      ctx.strokeStyle = P.k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 7, 14, sa - 0.9, sa + 0.9); ctx.stroke();
      ctx.strokeStyle = '#2f6e88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 7, 14, sa - 0.9, sa + 0.9); ctx.stroke();
      ex.strokeStyle = D.rgba(sc, 0.8); ex.lineWidth = 0.5; ex.beginPath(); ex.arc(x, y - 7, 14.5, sa - 0.85, sa + 0.85); ex.stroke();
      if (e.shield > 0) { ex.strokeStyle = D.rgba(P.c, 0.5); ex.strokeRect(x - 11.5, y - 20.5, 23, 22); }
    } else if (e.kind === 'boss') drawBoss(ctx, ex, S, e, white, LT);
    if (pz) { ctx.restore(); ex.restore(); }
    ctx.globalAlpha = 1;
    if ((e.hp < e.maxHp || e.shield > 0) && !D.ENEMIES[e.kind].boss) {
      const w = Math.max(12, e.r * 2 + 4), bx = x - w / 2, by = y + 3;
      ctx.fillStyle = P.k; ctx.fillRect(bx - 0.5, by - 0.5, w + 1, 2.5); ctx.fillStyle = '#3a1520'; ctx.fillRect(bx, by, w, 1.5);
      ctx.fillStyle = P.r; ctx.fillRect(bx, by, Math.max(0, w * e.hp / e.maxHp), 1.5); ctx.fillStyle = '#ff9aa4'; ctx.fillRect(bx, by, Math.max(0, w * e.hp / e.maxHp), 0.5);
      if (e.shield > 0) { ctx.fillStyle = P.c; ctx.fillRect(bx, by - 1, Math.min(w, w * e.shield / e.maxHp), 0.5); }
    }
  }
  function drawBoss(ctx, ex, S, e, white, LT) {
    const x = e.x, y = e.y - (e.z || 0), t = S.t, hot = e.phase === 2;
    actor(ctx, ex, D.SPR.boss, x, y + 2, false, white);
    const T = S.decoy || S.player, aa = Math.atan2(T.y - e.y, T.x - e.x);
    for (const side of [-1, 1]) {
      const sx = x + side * 17, sy = y - 18, reach = e.act && e.act.k === 'slam' ? 14 : 9 + Math.sin(t * 3 + side) * 2;
      const a = aa + side * 0.6, mx = sx + side * 6, my = sy + 4, hx = mx + Math.cos(a) * reach, hy = my + Math.sin(a) * reach;
      seg(ctx, sx, sy, mx, my, P.k, 4); seg(ctx, mx, my, hx, hy, P.k, 4); seg(ctx, sx, sy, mx, my, white ? '#fff' : '#4c5c86', 3); seg(ctx, mx, my, hx, hy, white ? '#fff' : '#6f84b3', 3); seg(ctx, mx, my - 1, hx, hy - 1, '#a3b6dc', 0.5);
      ctx.fillStyle = P.k; ctx.fillRect(hx - 3.5, hy - 3.5, 7, 7); ctx.fillStyle = white ? '#fff' : '#e8b42e'; ctx.fillRect(hx - 3, hy - 3, 2.5, 6); ctx.fillRect(hx + 0.5, hy - 3, 2.5, 6);
    }
    if (hot) LT(x, y - 14, 60, P.r, 0.6 + 0.3 * Math.sin(t * 14));
    if (e.act && e.act.k === 'laser' && e.act.len) { const a = e.act.a, ox = e.x, oy = e.y - 22; ex.strokeStyle = P.r; ex.lineWidth = 4; ex.beginPath(); ex.moveTo(ox, oy); ex.lineTo(ox + Math.cos(a) * e.act.len, oy + Math.sin(a) * e.act.len); ex.stroke(); ex.strokeStyle = '#ffffff'; ex.lineWidth = 1; ex.stroke(); }
    if (hot && (t * 20 | 0) % 3 === 0) S.parts.push({ k: 'smoke', x: e.x + S.rng.range(-12, 12), y: e.y - 26, vx: S.rng.range(-5, 5), vy: -20, life: 0.8, max: 0.8, col: '#2a2a35', size: 2 });
  }
  // 地面预警：只画落点和冲撞范围，不画子弹弹道
  function telegraph(ex, S, e) {
    if (e.tele <= 0) return;
    const k = 1 - e.tele / e.teleMax, it = e.intent, blink = (S.t * 16 | 0) % 2;
    ex.lineWidth = 0.5; ex.strokeStyle = D.rgba(P.r, 0.5 + 0.5 * k); ex.fillStyle = D.rgba(P.r, 0.2 + 0.3 * k);
    if (it.k === 'leap' && e.mark) { ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, 9, 5, 0, 0, TAU); ex.stroke(); ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, 9 * k, 5 * k, 0, 0, TAU); ex.fill(); }
    else if (it.k === 'slam' && e.mark) { const r = 44; ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, r, r * 0.6, 0, 0, TAU); ex.stroke(); ex.fillStyle = D.rgba(P.r, 0.16 + (blink ? 0.08 : 0)); ex.beginPath(); ex.ellipse(e.mark.x, e.mark.y, r * k, r * 0.6 * k, 0, 0, TAU); ex.fill(); }
    else if (it.k === 'charge' && e.aimA != null) { ex.save(); ex.translate(e.x, e.y - 4); ex.rotate(e.aimA); ex.strokeRect(0, -8, 150, 16); ex.fillRect(0, -8, 150 * k, 16); ex.restore(); }
  }
  const INTENT_COL = { leap: P.r, burst: P.r, snipe: P.c, mortar: P.m, arm: P.r, heal: P.g, nade: P.r, charge: P.r, hook: P[5], armor: P.c, slam: P.r, ring: P.O, laser: P.r };
  const ICON_ROWS = {
    leap: ['..kk...', '.krrk..', 'krrrrk.', 'krRrrrk', '.krrrk.', '..kk...'], burst: ['.......', 'kkkkkk.', 'krrrrRk', 'kkkkkk.', '.k.k...', '.......'],
    snipe: ['..k....', '.krk...', 'krRrkkk', '.krk...', '..k....', '.......'], mortar: ['...kk..', '..krrk.', '.krrk..', 'krRk...', 'kkk....', '.......'],
    arm: ['.kkkk..', 'krrrrk.', 'krRRrk.', 'krrrrk.', '.kkkk..', '.......'], heal: ['..kk...', '.krrk..', 'krRRrk.', '.krrk..', '..kk...', '.......'],
    nade: ['..kk...', '.krrk..', 'krrrrk.', 'krrRrk.', '.krrk..', '..kk...'], charge: ['...k...', 'kkkrk..', 'krrrrk.', 'kkkrk..', '...k...', '.......'],
    hook: ['.kkk...', 'krrrk..', 'k..rk..', '...rk..', '.krrk..', '..kk...'], armor: ['kkkkkk.', 'krrrrk.', 'krRrrk.', '.krrk..', '..kk...', '.......'],
  };
  ICON_ROWS.slam = ICON_ROWS.leap; ICON_ROWS.ring = ICON_ROWS.mortar; ICON_ROWS.laser = ICON_ROWS.snipe;
  function intentUI(ctx, S, e, cx, cy) {
    const it = e.intent; if (!it) return;
    if (!e.aware) { if (e.notice > 0.05) { const qx = Math.round((e.x - cx) * Z), qy = Math.round((e.y - cy - 20 - (e.z || 0)) * Z); D.text(ctx, '?', qx, qy - 6, D.rgba(P.y, Math.min(1, 0.4 + e.notice)), { align: 'center', scale: 3 }); } return; }
    const top = { boss: 50, engineer: 28, turret: 18, drone: 24, raider: 22, sniper: 26, bomber: 14, medic: 22 }[e.kind] || 15;
    const x = Math.round((e.x - cx) * Z), y = Math.round((e.y - cy - top - (e.z || 0)) * Z), col = INTENT_COL[it.k] || P[6];
    const label = it.k === 'armor' || it.k === 'heal' ? '+' + it.sh : it.dmg == null ? '' : it.n ? it.dmg + 'x' + it.n : String(it.dmg); // 没伤害的招（下蛋、叫人、放烟）不写数字
    const w = 16 + D.textW(label) * 2, bx = x - Math.round(w / 2);
    pix(ctx, bx, y - 6, ICON_ROWS[it.k] || ICON_ROWS.leap, col, 2);
    D.text(ctx, label, bx + 16, y - 4, e.tele > 0 ? P.Y : P[6], { scale: 2 });
    if (e.tele > 0) { const k = 1 - e.tele / e.teleMax; ctx.fillStyle = P.k; ctx.fillRect(bx - 1, y + 9, w + 2, 4); ctx.fillStyle = col; ctx.fillRect(bx, y + 10, Math.round(w * k), 2); }
    if (e.stun > 0) for (let i = 0; i < 3; i++) { const a = S.t * 6 + i * 2.1; ctx.fillStyle = P.Y; ctx.fillRect(Math.round(x + Math.cos(a) * 12), Math.round(y - 14 + Math.sin(a) * 4), 2, 2); }
  }
  function pix(ctx, x, y, rows, col, s) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.') continue; ctx.fillStyle = ch === 'k' ? P.k : ch === 'R' ? '#ffffff' : col; ctx.fillRect(x + i * s, y + j * s, s, s); } }

  // ── 小地图：右上角，走过的房间点亮
  // 列车开走的过场：车门关上、列车开出站以后切到隧道里（画法在 ride.js，这里只留时间轴；station.js 按它算什么时候结束）
  D.OUTRO_RIDE = { start: 1.05, fade: 0.35, dur: 3.2 };
  // 小地图在 minimap.js（试玩反馈：原来的太大、太粗糙，重画了）
  function minimap(ctx, S, time) { if (D.drawMinimap) D.drawMinimap(ctx, S, time, W); }
  // ── 画布 HUD（屏幕像素）
  function hud(ctx, S, time) {
    if (S.console && S.isExit && !S.over && !(S.step === 0 && !S.tut) && (!S.console.used || (S.extract && S.extract.train))) {
      const c = S.console;
      if (c.f !== S.f) { const msg = '撤离点在 ' + (c.f + 1) + ' 层'; ctx.font = D.PXF; ctx.textAlign = 'center'; const w = ctx.measureText(msg).width + 16; ctx.fillStyle = 'rgba(5,32,15,0.85)'; ctx.fillRect(W / 2 - w / 2, 46, w, 18); ctx.fillStyle = '#3dd66a'; ctx.fillText(msg, W / 2, 59); ctx.textAlign = 'left'; }
      else { const sx = (c.x - S.cam.x) * Z, sy = (c.y - 20 - S.cam.y) * Z, m = 26; if (sx < m || sx > W - m || sy < m + 20 || sy > H - m) { const cx = D.clamp(sx, m, W - m), cy = D.clamp(sy, m + 20, H - m - 40), a = Math.atan2(sy - cy, sx - cx), pulse = 0.7 + 0.3 * Math.sin(time * 6); ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.fillStyle = P.k; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.fill(); ctx.fillStyle = D.rgba('#3dd66a', pulse); ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore(); D.text(ctx, 'EXIT', cx, cy + 14, '#3dd66a', { align: 'center' }); } }
    }
    // 血条、弹药条、小地图先画进一层，再按设置里的"界面透明度"整层贴上来；"界面大小"各按自己贴着的角缩放（hud-tune.js）
    hudLayer(ctx, (c, k) => { at(c, 0, 0, k, () => vitals(c, S, time)); at(c, 0, H, k, () => D.drawAmmoHud(c, S, 12, H - 24, time)); at(c, W, 0, k, () => minimap(c, S, time)); });
    const boss = S.enemies.find(e => !e.dead && D.ENEMIES[e.kind].boss && (e.kind === 'boss' || (e.aware && e.f === S.f)));
    if (boss) { const bw = 320, bx = (W - bw) / 2, yy = 36; ctx.fillStyle = P.k; ctx.fillRect(bx - 3, yy - 3, bw + 6, 14); ctx.fillStyle = '#3a1520'; ctx.fillRect(bx, yy, bw, 8); ctx.fillStyle = boss.phase === 2 ? P.O : P.r; ctx.fillRect(bx, yy, Math.round(bw * boss.hp / boss.maxHp), 8); ctx.fillStyle = '#ffffff40'; ctx.fillRect(bx, yy, Math.round(bw * boss.hp / boss.maxHp), 2); }
    if (S.extract && !S.extract.train) { const X = S.extract, left = Math.max(0, Math.ceil(X.dur - X.t)), bw = 240, bx = (W - bw) / 2, yy = boss ? 56 : 36; ctx.fillStyle = P.k; ctx.fillRect(bx - 3, yy - 3, bw + 6, 10); ctx.fillStyle = '#0f2a18'; ctx.fillRect(bx, yy, bw, 4); ctx.fillStyle = P.g; ctx.fillRect(bx, yy, Math.round(bw * X.t / X.dur), 4); D.text(ctx, left + 'S', W / 2, yy + 9, P.g, { align: 'center', scale: 2 }); }
    crosshair(ctx, S);
  }
  let hudCv = null, hudCx = null;
  function hudLayer(ctx, fn) {
    const T = D.hudTune ? D.hudTune() : { a: 1, s: 1 };
    if (T.a >= 0.995) return fn(ctx, T.s);
    if (!hudCv) { hudCv = document.createElement('canvas'); hudCv.width = W; hudCv.height = H; hudCx = hudCv.getContext('2d'); }
    hudCx.setTransform(1, 0, 0, 1, 0, 0); hudCx.globalAlpha = 1; hudCx.clearRect(0, 0, W, H); hudCx.imageSmoothingEnabled = false;
    fn(hudCx, T.s);
    ctx.save(); ctx.globalAlpha = T.a; ctx.imageSmoothingEnabled = false; ctx.drawImage(hudCv, 0, 0); ctx.restore();
  }
  function at(c, ax, ay, k, fn) { if (k === 1) return fn(); c.save(); c.translate(ax, ay); c.scale(k, k); c.translate(-ax, -ay); fn(); c.restore(); }
  function vitals(ctx, S, time) {
    const p = S.player, x = 12, y = 12, w = 150;
    ctx.fillStyle = P.k; ctx.fillRect(x - 2, y - 2, w + 4, 14); ctx.fillStyle = '#3a1520'; ctx.fillRect(x, y, w, 10);
    const k = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = k < 0.3 && (time * 4 | 0) % 2 ? P.R : P.r; ctx.fillRect(x, y, Math.round(w * k), 10); ctx.fillStyle = '#ffffff50'; ctx.fillRect(x, y, Math.round(w * k), 2); ctx.fillStyle = '#00000040'; ctx.fillRect(x, y + 8, Math.round(w * k), 2);
    for (let i = 1; i < 6; i++) { ctx.fillStyle = '#00000060'; ctx.fillRect(x + Math.round(w * i / 6), y, 1, 10); }
    if (D.drawShieldBar) D.drawShieldBar(ctx, S, x, y, w); // 蓝条：护甲 + 护盾（armor.js）
    else if (p.shield > 0) { ctx.fillStyle = P.c; ctx.fillRect(x, y + 8, Math.min(w, Math.round(w * p.shield / p.maxHp)), 3); }
    D.text(ctx, Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp, x + w + 8, y, P[6], { scale: 2 });
    const dk = D.clamp(1 - p.dashCd / (p.dashCdMax || D.SHELL.dashCd), 0, 1);
    ctx.fillStyle = P.k; ctx.fillRect(x - 2, y + 16, 44, 6); ctx.fillStyle = dk >= 1 ? P.c : P[3]; ctx.fillRect(x, y + 17, Math.round(40 * dk), 4);
    // 电容条和子弹条（ammo.js）在 hud() 里另画：贴左下角缩放
  }
  // 准星（人类据点里收枪，不画：outpost-town.js）；不跟着界面透明度 / 大小变
  function crosshair(ctx, S) {
    if (S.town) return;
    const p = S.player, I = D.Input, mx = Math.round(I.mx), my = Math.round(I.my), cc = S.raid.sup > 0 ? P.c : D.UIC.text;
    const bg = Math.round((p.bloom || 0) * 6); // 准星跟着散布张开
    ctx.fillStyle = P.k; ctx.fillRect(mx - 8 - bg, my - 1, 6, 3); ctx.fillRect(mx + 3 + bg, my - 1, 6, 3); ctx.fillRect(mx - 1, my - 8 - bg, 3, 6); ctx.fillRect(mx - 1, my + 3 + bg, 3, 6);
    ctx.fillStyle = cc; ctx.fillRect(mx - 7 - bg, my, 4, 1); ctx.fillRect(mx + 4 + bg, my, 4, 1); ctx.fillRect(mx, my - 7 - bg, 1, 4); ctx.fillRect(mx, my + 4 + bg, 1, 4); ctx.fillRect(mx, my, 1, 1);
    if (S.hitMark) { const o = S.hitMark.kill ? 6 : 4; ctx.fillStyle = S.hitMark.kill ? P.R : '#ffffff'; for (let i = 0; i < 3; i++) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(mx + sx * (o + i * 2) - 1, my + sy * (o + i * 2) - 1, 2, 2); }
    if (p.reload > 0) { const rk = 1 - p.reload / p.reloadMax; for (let a = 0; a < 40; a++) if (a / 40 < rk) { const t = a / 40 * TAU - Math.PI / 2; ctx.fillStyle = D.UIC.hi; ctx.fillRect(Math.round(mx + Math.cos(t) * 13), Math.round(my + Math.sin(t) * 13), 1, 1); } }
  }
})(D);
