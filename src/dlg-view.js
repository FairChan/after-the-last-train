/* 末班之后 · 剧情灵魂：对话的画法（画在画布上，640×360 的舞台坐标）。
   头顶气泡（逐字、抖 / 波 / 乱码 / 颜色）、上一句变暗上收、旁白在上方居中、玩家的话是终端字、选项条 + 红色计时条、打断。
   D.DlgView.draw(ctx, R, actors, t)：actors = {lin:{x, y}, op:{x, y}, …}，是每个人头顶那一点的屏幕坐标（键是 CAST 里的 id）。
   画完 D.DlgView.hits 里是这一帧能点的框：{x, y, w, h, pick: i} 或 {x, y, w, h, cut: true}。
   设计：design/features/story-soul/design.md 第三节 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const V = D.DlgView = { hits: [], calm: false };
  const INK = '#0b0a14', TEXT = '#e8e4dc', COL = { red: '#ff3b4a', dim: '#7c7888', hand: '#b8b0a0' }, GL = '#$%&@!?*';
  const LH = 15, PAD = 6, MAXW = 210;
  const st = R => R._vs || (R._vs = { appear: [], key: null, prev: null, logN: 0 });
  let wcache = {}, wfont = '';
  function cw(ctx, ch) { if (ctx.font !== wfont) { wfont = ctx.font; wcache = {}; } let w = wcache[ch]; if (w == null) w = wcache[ch] = ctx.measureText(ch).width; return w; }
  // 折行：中文一个字一个字断，英文按词断（空格后面能断）
  V.layout = function (ctx, gl, maxW) {
    const lines = [[]]; let w = 0, lastBreak = -1, line = lines[0];
    for (let i = 0; i < gl.length; i++) {
      const g = gl[i], gw = cw(ctx, g.ch); g._w = gw;
      if (g.ch === '\n') { line = []; lines.push(line); w = 0; lastBreak = -1; continue; }
      if (w + gw > maxW && line.length) {
        if (/[A-Za-z0-9'"]/.test(g.ch) && lastBreak >= 0 && lastBreak < line.length - 1) { const tail = line.splice(lastBreak + 1); line = tail; lines.push(line); w = tail.reduce((a, x) => a + x._w, 0); }
        else { line = []; lines.push(line); w = 0; }
        lastBreak = -1;
        if (g.ch === ' ') continue;
      }
      if (g.ch === ' ') lastBreak = line.length;
      line.push(g); w += gw;
    }
    return lines.map(l => ({ g: l, w: l.reduce((a, x) => a + x._w, 0) }));
  };
  function colorOf(g, base) { return g.col ? COL[g.col] : base; }
  // 一段字：从 (x0, y0) 起，每行居中在 cx
  function drawGlyphs(ctx, lines, cx, y0, shown, appear, t, base, alpha) {
    let k = 0;
    for (let li = 0; li < lines.length; li++) {
      const L = lines[li]; let x = Math.round(cx - L.w / 2); const y = y0 + li * LH;
      for (const g of L.g) {
        const idx = g._i; if (idx >= shown) return; k++;
        let dx = 0, dy = 0, ch = g.ch;
        if (!V.calm) {
          if (g.fx.includes('shake')) { dx = Math.round(Math.sin(t * 61 + idx * 7.3) * 1.2); dy = Math.round(Math.cos(t * 53 + idx * 3.1) * 1.2); }
          if (g.fx.includes('wave')) dy += Math.round(Math.sin(t * 4 + idx * 0.6) * 1.5);
          if (g.fx.includes('glitch') && appear[idx] != null && t - appear[idx] < 0.25 && ch !== ' ') ch = GL[Math.floor((t * 30 + idx) % GL.length)];
        }
        ctx.globalAlpha = alpha; ctx.fillStyle = colorOf(g, base); ctx.fillText(ch, x + dx, y + dy);
        x += g._w;
      }
    }
  }
  function box(ctx, x, y, w, h, bg, edge) {
    ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    if (edge) { ctx.fillStyle = edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
  }
  function bubble(ctx, who, gl, shown, appear, head, t, alpha, W, isOp) {
    const C = D.Dlg.CAST[who] || {}, lines = V.layout(ctx, gl, MAXW);
    // 编号：layout 会跳过折行处的空格，_i 要对上 gl 的下标
    let n = 0; for (const L of lines) for (const g of L.g) { g._i = gl.indexOf(g, n); n = g._i; }
    const w = Math.max(...lines.map(l => l.w), 8) + PAD * 2 + (isOp ? 10 : 0), h = lines.length * LH + PAD * 2 - 3;
    let x = Math.round(head.x - w / 2); x = Math.max(4, Math.min(W - w - 4, x));
    const y = Math.round(head.y - h - 8);
    ctx.globalAlpha = alpha;
    box(ctx, x, y, w, h, isOp ? 'rgba(6,18,10,0.9)' : 'rgba(12,10,18,0.9)', C.col || '#888');
    // 尖角：三层像素，指向说话人
    const px = Math.max(x + 6, Math.min(x + w - 8, Math.round(head.x)));
    ctx.fillStyle = INK; ctx.fillRect(px - 3, y + h, 7, 2); ctx.fillRect(px - 2, y + h + 2, 5, 2); ctx.fillRect(px - 1, y + h + 4, 3, 2);
    ctx.fillStyle = C.col || '#888'; ctx.fillRect(px - 2, y + h, 5, 1); ctx.fillRect(px - 1, y + h + 2, 3, 1); ctx.fillRect(px, y + h + 4, 1, 1);
    if (isOp) { ctx.fillStyle = C.col; ctx.fillText('>', x + PAD, y + PAD); }
    drawGlyphs(ctx, lines, x + w / 2 + (isOp ? 5 : 0), y + PAD, shown, appear, t, isOp ? C.col : C.hand ? COL.hand : TEXT, alpha);
    return { x, y, w, h };
  }
  V.draw = function (ctx, R, actors, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height, v = R.view(), s = st(R);
    V.hits = [];
    ctx.save(); ctx.font = D.PXF; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    // 换句了：记下上一句（同一人的话变暗挂在上面 2.5 秒）
    const key = v.kind + '|' + v.who + '|' + v.text;
    if (key !== s.key) {
      if (s.key && s.cur && s.cur.kind === 'say') s.prev = { who: s.cur.who, gl: s.cur.glyphs, at: t };
      s.key = key; s.appear = []; s.cur = v;
    }
    for (let i = 0; i < v.shown; i++) if (s.appear[i] == null) s.appear[i] = t;
    const headOf = who => { const c = D.Dlg.CAST[who]; return c && actors[c.id] ? actors[c.id] : { x: W / 2, y: H * 0.45 }; };
    // 上一句
    if (s.prev && t - s.prev.at < 2.5 && v.kind !== 'choice') {
      const h = headOf(s.prev.who), a = 0.45 * Math.max(0, 1 - (t - s.prev.at) / 2.5);
      const lift = v.kind === 'say' && v.who === s.prev.who ? 18 + LH * Math.min(3, Math.ceil(v.glyphs.length / 14)) : 0;
      bubble(ctx, s.prev.who, s.prev.gl, s.prev.gl.length, [], { x: h.x, y: h.y - lift }, t, a, W, s.prev.who === '你');
    }
    if (v.kind === 'say') bubble(ctx, v.who, v.glyphs, v.shown, s.appear, headOf(v.who), t, 1, W, v.who === '你');
    else if (v.kind === 'narr') {
      const lines = V.layout(ctx, v.glyphs, Math.min(420, W - 80)); let n = 0; for (const L of lines) for (const g of L.g) { g._i = v.glyphs.indexOf(g, n); n = g._i; }
      const h = lines.length * LH + 10, y = 34;
      const gr = ctx.createLinearGradient(0, y - 8, 0, y + h + 8); gr.addColorStop(0, 'rgba(5,4,9,0)'); gr.addColorStop(0.3, 'rgba(5,4,9,0.72)'); gr.addColorStop(0.7, 'rgba(5,4,9,0.72)'); gr.addColorStop(1, 'rgba(5,4,9,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(0, y - 8, W, h + 16);
      drawGlyphs(ctx, lines, W / 2, y + 4, v.shown, s.appear, t, '#c8c2d4', 1);
    }
    // 打断：说话的过程中，底部冒一个红色、发抖的选项
    if (v.cut) {
      const label = '1  ' + v.cut.t, w = Math.ceil(ctx.measureText(label).width) + 20, x = Math.round(W / 2 - w / 2) + (V.calm ? 0 : Math.round(Math.sin(t * 40) * 1)), y = H - 58;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 9);
      box(ctx, x, y, w, 20, 'rgba(60,8,14,0.92)', COL.red);
      ctx.globalAlpha = 1; ctx.fillStyle = '#ffd0d4'; ctx.fillText(label, x + 10, y + 4);
      V.hits.push({ x, y, w, h: 20, cut: true });
    }
    if (v.kind === 'choice') {
      const ch = v.choices, gap = 8, lab = ch.map((c, i) => `${i + 1}  ${c.t}${c.cost ? '  · ' + c.cost : ''}`);
      const ws = lab.map(l => Math.min(260, Math.ceil(ctx.measureText(l).width) + 20)), tot = ws.reduce((a, b) => a + b, 0) + gap * (ch.length - 1);
      const rows = tot > W - 24 ? ch.length : 1, y0 = H - 34 - (rows - 1) * 26;
      let x = Math.round(W / 2 - (rows === 1 ? tot : Math.max(...ws)) / 2);
      ch.forEach((c, i) => {
        const w = rows === 1 ? ws[i] : Math.max(...ws), y = rows === 1 ? y0 : y0 + i * 26, xx = rows === 1 ? x : Math.round(W / 2 - w / 2);
        ctx.globalAlpha = c.ok ? 1 : 0.45;
        box(ctx, xx, y, w, 22, c.ok ? 'rgba(14,12,22,0.94)' : 'rgba(14,12,22,0.7)', c.ok ? '#6a6478' : '#3a3644');
        ctx.fillStyle = c.ok ? (c.act ? '#a8a4b4' : TEXT) : '#6a6478'; ctx.fillText(lab[i], xx + 10, y + 5);
        V.hits.push({ x: xx, y, w, h: 22, pick: i });
        if (rows === 1) x += w + gap;
      });
      if (v.timeMax > 0) {
        const bw = Math.min(W - 80, Math.max(160, tot)), bx = Math.round(W / 2 - bw / 2), by = y0 - 10, k = v.timeLeft / v.timeMax;
        ctx.globalAlpha = 1; ctx.fillStyle = INK; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        ctx.fillStyle = '#3a0c12'; ctx.fillRect(bx, by, bw, 3);
        ctx.fillStyle = k < 0.3 && Math.sin(t * 20) > 0 ? '#ff8a94' : COL.red; ctx.fillRect(bx + Math.round(bw * (1 - k) / 2), by, Math.round(bw * k), 3);
      }
    }
    ctx.restore();
  };
  // 打字音：每出一个字放一下这个人的声音
  V.typeSound = (who, g) => { const c = D.Dlg.CAST[who]; if (c && c.voice && D.Sfx) D.Sfx.play('ty_' + c.voice); };
})(D);
