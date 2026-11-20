/* Underdog：据点"工坊"页（蓝图册 + 绘图台）和首页的工坊磁贴。规则在 workshop.js。
   左边蓝图册：每张蓝图一张卡（已学会 / 仓库里有、能学 / 还没有），按弹药、配件、改装件筛。
   右边绘图台（画布，像素画放大两倍）：
   - 平时：蓝底方格纸上画着这件东西的线稿（外轮廓亮线、里面淡蓝填色和细节线），标注尺寸线、右下角图框，一道扫描线慢慢扫过。
     还没学会：卷着的蓝图（仓库里有）或者一个虚线剪影加问号（还没有）。
   - 学会（1.6 秒）：蓝图从上往下展开（卷轴往下滚），线稿沿斜线一笔笔画出来，最后"已学会"的章盖下来。
   - 制造（2 秒）：打印头从左上角滑进来，一行一行来回扫，东西从下往上长出来、喷火花、每行一声"嗒"；做完白光一闪，
     图标从绘图台飞进右下角"仓库里"那一格，数字跳一下。
   动画期间别的按钮不响应，放完整页重画。同一页重画（U.redraw）不放卡片的进场。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, artURL, infoIcon, GR } = X;
  let root, G, raf = 0, anim = null, busy = false;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  X.hooks.clear.push(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; } anim = null; busy = false; });
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const qcol = q => D.QUALITY[q].col;
  const KIND = { ammo: '弹药', att: '配件', rmod: '改装件', use: '消耗品', gun: '精工枪', equip: '护甲' };
  const FILTERS = [['all', '全部'], ['ammo', '弹药'], ['att', '配件'], ['rmod', '改装件'], ['use', '消耗品'], ['gun', '精工枪'], ['equip', '护甲']]; // 后三类在 workshop-bp.js
  if (U.WIN) U.WIN.workshop = ['工坊', 'WORKSHOP'];

  const matsHTML = (pf, mats) => (mats || []).map(([id, n]) => { const have = GR().count(pf.stash, x => x === id), it = D.itemInfo(id); return `<span class="mat${have >= n ? ' ok' : ''}" data-tip="${esc(it.name + '：仓库里有 ' + have)}"><img src="${infoIcon(it)}">${esc(it.name)} ${Math.min(have, n)}/${n}</span>`; }).join('');
  const costHTML = (pf, money, mats) => `<span class="mat money${pf.money >= money ? ' ok' : ''}"><i class="ico-gold"></i>${money}</span>${matsHTML(pf, mats)}`;
  const gunCal = pf => { const g = D.loadGun(pf.load); return g ? D.CARDS[g].gun.cal : null; };
  const calsOf = pf => { const c = gunCal(pf), all = Object.keys(D.CALIBER); return c ? [c].concat(all.filter(k => k !== c)) : all; };

  // ── 首页磁贴（ui-home.js 的小磁贴那一排）
  U.workshopTile = function (pf, tile) {
    const B = D.bpBook ? D.bpBook(pf) : [], n = B.filter(b => b.learned).length, can = B.some(b => b.have && !b.learned);
    return tile('workshop', 't-s t-ws', `<span class="tl-k">工坊</span><b>${n}/${B.length}</b>${can ? '<i class="tl-dot"></i>' : ''}`, can ? '工坊：仓库里有没学的蓝图' : '工坊：学蓝图、做四级五级弹药');
  };

  // ── 工坊页
  U.workshop = function (pf, body) {
    const book = D.bpBook(pf), f = FILTERS.some(x => x[0] === G.wsFilter) ? G.wsFilter : 'all';
    const list = book.filter(b => f === 'all' || b.kind === f);
    if (!book.some(b => b.k === G.wsSel)) G.wsSel = (book.find(b => b.have && !b.learned) || book[0]).k;
    const sel = book.find(b => b.k === G.wsSel), n = book.filter(b => b.learned).length, entry = !U.redraw;
    const card = (b, i) => {
      const st = b.learned ? 'on' : b.have ? 'can' : 'off', icon = b.kind === 'ammo' ? artURL('ammo_' + (gunCal(pf) || 'nail')) : artURL(b.art);
      return `<button class="ws-card ${st}${b.k === sel.k ? ' sel' : ''}${entry ? ' in' : ''}" data-bp="${b.k}" style="--d:${(i * 0.035).toFixed(3)}s"><span class="wc-ic"><img src="${icon}"></span>
        <span class="wc-t"><b style="color:${qcol(b.q)}">${esc(b.name)}</b><em>${KIND[b.kind]} · ${D.QUALITY[b.q].name}</em></span>
        <span class="wc-st">${b.learned ? '已学会' : b.have ? '能学' : '还没有'}</span></button>`;
    };
    body.innerHTML = `<div class="stash ws"><div class="st-head"><h3>工坊</h3><span class="hint">城里搜到的蓝图带回来，在这里学会；学会的东西用零件和材料做。四级、五级弹药只能在这里做。</span><span class="worth">已学会 <b>${n}</b> / ${book.length}</span></div>
      <div class="ws-cols"><div class="ws-book wp"><div class="wh">蓝图册</div>
        <div class="cx-switch">${FILTERS.map(([k, nm]) => `<button class="tab${k === f ? ' on' : ''}" data-wf="${k}">${nm}<em>${book.filter(b => k === 'all' || b.kind === k).length}</em></button>`).join('')}</div>
        ${(() => { const P = X.page('ws:' + f, list.length, 10); return `<div class="ws-list" data-pgarea="ws:${f}">${list.slice(P.from, P.to).map(card).join('')}</div>${P.html}`; })()}</div>
      <div class="ws-desk wp"><div class="wh">绘图台 · <b style="color:${qcol(sel.q)}">${esc(sel.name)}</b></div>
        <div class="ws-board"><canvas class="ws-cv" width="330" height="150"></canvas><span class="ws-stamp${sel.learned ? ' on' : ''}">已学会</span><span class="ws-note">${sel.learned ? '' : sel.have ? '仓库里有这张蓝图，还卷着' : '还没有这张蓝图'}</span></div>
        <div class="ws-info">${infoHTML(pf, sel)}</div></div></div></div>`;
    body.querySelectorAll('[data-wf]').forEach(b => b.onclick = () => { if (busy) return; sfx('click'); G.wsFilter = b.dataset.wf; U.refresh(); });
    body.querySelectorAll('[data-bp]').forEach(b => b.onclick = () => { if (busy || b.dataset.bp === G.wsSel) return; sfx('tink'); G.wsSel = b.dataset.bp; U.refresh(); });
    body.querySelectorAll('[data-cal]').forEach(b => b.onclick = () => { if (busy) return; sfx('click'); G.wsCal = b.dataset.cal; U.refresh(); });
    const lb = body.querySelector('[data-act=learn]'); if (lb) lb.onclick = () => learn(pf, sel);
    const cb = body.querySelector('[data-act=craft]'); if (cb) cb.onclick = () => craft(pf, sel, cb);
    startDesk(body.querySelector('.ws-cv'), pf, sel);
  };
  function infoHTML(pf, b) {
    const src = b.kind === 'ammo' ? (b.tier >= 5 ? '城里传说级的箱子偶尔有；首领常掉。' : '城里史诗以上的箱子偶尔有；精英偶尔掉，首领常掉。')
      : b.kind === 'use' ? (b.q >= 4 ? '城里传说级的箱子偶尔有；精英偶尔掉，首领有时掉。' : '城里精良以上的箱子偶尔有；精英偶尔掉。')
      : b.kind === 'gun' ? '武器箱里常见一些，史诗以上的箱子偶尔有；首领有时掉。'
      : b.kind === 'equip' ? '城里传说级的箱子偶尔有；首领有时掉。' : '危险的站里，史诗以上的箱子偶尔有。';
    let out = '', cost = '', btn = '', why = '';
    if (b.kind === 'ammo') {
      const cals = calsOf(pf), cal = cals.includes(G.wsCal) ? G.wsCal : cals[0], r = D.ammoRecipe(b.tier, cal), T = D.AMMO_TIER[b.tier], have = GR().count(pf.stash, x => x === r.id), it = D.itemInfo(r.id);
      out = `<div class="ws-cals">${cals.map(c => `<button class="btn sm${c === cal ? ' on' : ''}" data-cal="${c}" data-tip="${esc(D.CALIBER[c].name + (c === gunCal(pf) ? '（当前这把枪用的）' : ''))}"><img src="${artURL('ammo_' + c)}">${esc(D.CALIBER[c].name)}${c === gunCal(pf) ? '<em>当前枪</em>' : ''}</button>`).join('')}</div>
        <div class="ws-out"><img src="${infoIcon(it)}"><span class="wo-t"><b style="color:${qcol(it.q)}">${esc(it.name)}</b> ×${r.n} 发<em>伤害 ×${T.mul} · 一次做一盒</em></span><span class="ws-have" data-tip="做好的放进仓库">仓库里 <b>${have}</b></span></div>`;
      cost = costHTML(pf, r.money, r.mats);
      const st = D.canCraftAmmo(pf, b.tier, cal); why = { bp: '', poor: '零件或材料不够', full: '仓库放不下', ok: '' }[st];
      if (b.learned) btn = `<button class="btn${st === 'ok' ? ' primary' : ' poor'}" data-act="craft" data-cal="${cal}">制造</button>`;
    } else if (b.x) { // 消耗品、精工枪、护甲（workshop-bp.js）
      const r = D.bpRecipeX(b.k), it = D.itemInfo(r.id), have = GR().count(pf.stash, x => x === r.id), st = D.canCraftX(pf, b.k);
      const base = D.itemInfo(r.mats[0][0]).name, sub = b.kind === 'gun' ? `拿一把${base}改装 · 品质高两档` : b.kind === 'equip' ? `满耐久 ${it.max}` : `一次做 ${r.n} 个`;
      out = `<div class="ws-out"><img src="${infoIcon(it)}"><span class="wo-t"><b style="color:${qcol(it.q)}">${esc(it.name)}</b>${r.n > 1 ? ' ×' + r.n : ''}<em>${esc(sub)}</em></span><span class="ws-have" data-tip="做好的放进仓库">仓库里 <b>${have}</b></span></div>`;
      cost = costHTML(pf, r.money, r.mats);
      why = { bp: '', need: `仓库里要有一把${base}（原型）`, poor: '零件或材料不够', full: '仓库放不下', ok: '' }[st] || '';
      if (b.learned) btn = `<button class="btn${st === 'ok' ? ' primary' : ' poor'}" data-act="craft">制造</button>`;
    } else {
      const id = D.gearId(b.k), it = D.itemInfo(id), r = D.recipe(b.k), have = GR().count(pf.stash, x => x === id), st = D.canCraft(pf, b.k);
      out = `<div class="ws-out"><img src="${infoIcon(it)}"><span class="wo-t"><b style="color:${qcol(it.q)}">${esc(it.name)}</b><em>${esc(it.desc || '')}</em></span><span class="ws-have" data-tip="做好的放进仓库">仓库里 <b>${have}</b></span></div>`;
      cost = costHTML(pf, r.money, r.mats);
      why = { lv: `工作台要 ${r.q} 级（设施页升级）`, bp: '', poor: '零件或材料不够', ok: '' }[st] || '';
      if (b.learned) btn = `<button class="btn${st === 'ok' ? ' primary' : ' poor'}" data-act="craft">制造</button>`;
    }
    if (!b.learned && b.have) { btn = `<button class="btn primary" data-act="learn">学会这张蓝图</button>`; why = '学会以后蓝图就用掉了'; }
    if (!b.learned && !b.have) why = '从哪来：' + src;
    return `${out}<div class="ws-cost"><span class="wc-k">材料</span>${cost}</div><div class="ws-act">${btn}<span class="ws-why">${esc(why)}</span></div>`;
  }

  // ── 学会、制造（动画放完再整页重画）
  function learn(pf, b) {
    if (busy) return;
    if (!D.bpLearn(pf, b.k)) { sfx('nope'); U.toast('仓库里没有这张蓝图'); return; }
    busy = true; anim = { type: 'learn', t0: performance.now() }; sfx('riser');
    const stamp = root.querySelector('.ws-stamp'), note = root.querySelector('.ws-note');
    if (note) note.textContent = '';
    setTimeout(() => { if (stamp && stamp.isConnected) { stamp.classList.add('on', 'slam'); sfx('rare'); } }, 1150);
    setTimeout(() => { busy = false; anim = null; U.toast('学会了：' + b.name); U.refresh(); }, 1700);
  }
  function craft(pf, b, btn) {
    if (busy) return;
    const cal = btn.dataset.cal, rx = b.x && D.bpRecipeX(b.k), ok = b.kind === 'ammo' ? D.craftAmmo(pf, b.tier, cal) : rx ? D.craftX(pf, b.k) : D.craft(pf, b.k);
    if (!ok) { sfx('nope'); const w = root.querySelector('.ws-why'); U.toast(w && w.textContent || '做不了'); return; }
    const id = b.kind === 'ammo' ? D.ammoRecipe(b.tier, cal).id : rx ? rx.id : D.gearId(b.k), it = D.itemInfo(id), n = b.kind === 'ammo' ? D.CALIBER[cal].pack : rx ? rx.n : 1;
    busy = true; anim = { type: 'craft', t0: performance.now(), id, row: -1 }; sfx('power');
    btn.classList.add('poor');
    setTimeout(() => fly(id, it), 1650);
    setTimeout(() => { busy = false; anim = null; U.toast('做好了：' + it.name + (n > 1 ? ' ×' + n : '') + '，放进仓库'); U.refresh(); }, 2700);
  }
  // 做好的东西从绘图台飞进"仓库里"那一格（12 步的阶梯，像素风不糊）
  function fly(id, it) {
    const cv = root.querySelector('.ws-cv'), dst = root.querySelector('.ws-have'); if (!cv || !dst) return;
    const box = root.getBoundingClientRect(), k = box.width / (root.offsetWidth || box.width) || 1, L = r => ({ x: (r.left - box.left) / k, y: (r.top - box.top) / k, w: r.width / k, h: r.height / k });
    const a = L(cv.getBoundingClientRect()), b = L(dst.getBoundingClientRect()), fx = document.createElement('div');
    fx.className = 'flybuy ws-fly'; fx.innerHTML = `<img src="${infoIcon(it)}">`; root.appendChild(fx);
    const S0 = 24, x0 = a.x + a.w / 2 - S0 / 2, y0 = a.y + a.h / 2 - S0 / 2, x1 = b.x + b.w / 2 - S0 / 2, y1 = b.y + b.h / 2 - S0 / 2, top = Math.min(y0, y1) - 60, kf = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, x = Math.round(x0 + (x1 - x0) * u), y = Math.round((1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * top + u * u * y1), sc = i === 12 ? 0.6 : 1 + Math.sin(u * Math.PI) * 0.5; kf.push({ transform: `translate(${x}px, ${y}px) scale(${sc.toFixed(2)})` }); }
    fx.animate(kf, { duration: 560, easing: 'steps(12, end)', fill: 'forwards' }).onfinish = () => {
      fx.remove(); sfx('buy');
      const v = dst.querySelector('b'); if (v) v.textContent = GR().count(G.pf.stash, x => x === id);
      dst.classList.remove('bump'); void dst.offsetWidth; dst.classList.add('bump');
    };
  }

  // ───────────────────────── 绘图台（330×150 的画布，CSS 放大两倍）
  const PAPER = '#12305e', GRID = '#1a3f78', GRID2 = '#24529a', INK = '#cfe0ff', FILL = 'rgba(90,146,232,.32)', LINE2 = '#8fb6f0';
  const blueCache = new Map();
  // 线稿：外轮廓（旁边是透明的像素）画亮线，里面淡蓝填色，颜色变化大的地方画细节线
  function blueprint(art) {
    if (blueCache.has(art)) return blueCache.get(art);
    const src = D.makeIcon && D.makeIcon(art); if (!src) return null;
    const w = src.width, h = src.height, sx = src.getContext('2d').getImageData(0, 0, w, h).data, out = [];
    const A = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? 0 : sx[(y * w + x) * 4 + 3], lum = (x, y) => { const i = (y * w + x) * 4; return sx[i] * 0.3 + sx[i + 1] * 0.59 + sx[i + 2] * 0.11; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (A(x, y) < 40) continue;
      const edge = A(x - 1, y) < 40 || A(x + 1, y) < 40 || A(x, y - 1) < 40 || A(x, y + 1) < 40;
      const det = !edge && x + 1 < w && y + 1 < h && (Math.abs(lum(x, y) - lum(x + 1, y)) > 46 || Math.abs(lum(x, y) - lum(x, y + 1)) > 46);
      out.push([x, y, edge ? 2 : det ? 1 : 0]);
    }
    const o = { w, h, px: out, src }; blueCache.set(art, o); return o;
  }
  function startDesk(cv, pf, b) {
    if (!cv) return; if (raf) cancelAnimationFrame(raf);
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    const art = b.kind === 'ammo' ? 'ammo_' + (calsOf(pf).includes(G.wsCal) ? G.wsCal : calsOf(pf)[0]) : b.art, bp = blueprint(art), t0 = performance.now();
    const loop = now => { if (!cv.isConnected) { raf = 0; return; } drawDesk(x, b, bp, (now - t0) / 1000, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
  const R = (x, a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
  function paper(x, h) { // 方格纸：h 是展开到的高度
    R(x, 0, 0, 330, 150, '#070a14');
    R(x, 14, 8, 302, h, PAPER);
    for (let gx = 14; gx < 316; gx += 10) R(x, gx, 8, 1, h, (gx - 14) % 50 ? GRID : GRID2);
    for (let gy = 8; gy < 8 + h; gy += 10) R(x, 14, gy, 302, 1, (gy - 8) % 50 ? GRID : GRID2);
    R(x, 14, 8, 302, 1, '#3a6cc0'); R(x, 14, 8, 1, h, '#3a6cc0'); R(x, 315, 8, 1, h, '#3a6cc0');
    if (h >= 134) R(x, 14, 141, 302, 1, '#3a6cc0');
    for (const [px, py] of [[16, 10], [310, 10], [16, 136], [310, 136]]) if (py < 8 + h) R(x, px, py, 4, 4, '#e3c14a'); // 图钉
  }
  // 画线稿：k 是画到哪里（0–1，沿斜线），lift 让整张图往上浮一点
  const SC = 3, OX = 165, OY = 72;
  function lineArt(x, bp, k, alpha) {
    if (!bp) return;
    const ox = OX - (bp.w * SC >> 1), oy = OY - (bp.h * SC >> 1), lim = (bp.w + bp.h) * k;
    x.globalAlpha = alpha == null ? 1 : alpha;
    for (const [px, py, t] of bp.px) { if (px + py > lim) continue; R(x, ox + px * SC, oy + py * SC, SC, SC, t === 2 ? INK : t === 1 ? LINE2 : FILL); }
    x.globalAlpha = 1;
    // 画笔头：沿着斜线走
    if (k > 0 && k < 1) { const d = lim; for (let i = 0; i <= Math.min(d, bp.h); i += 2) { const px = d - i, py = i; if (px >= 0 && px < bp.w) R(x, ox + px * SC - 1, oy + py * SC - 1, SC + 2, SC + 2, '#ffffff'); } }
  }
  function marks(x, bp, t) { // 尺寸线、图框
    if (!bp) return;
    const w = bp.w * SC, h = bp.h * SC, ox = OX - (w >> 1), oy = OY - (h >> 1);
    R(x, ox, oy - 10, w, 1, LINE2); R(x, ox, oy - 13, 1, 7, LINE2); R(x, ox + w - 1, oy - 13, 1, 7, LINE2);
    D.text(x, String(bp.w * 4), OX, oy - 18, LINE2, { align: 'center', shadow: false });
    R(x, ox + w + 10, oy, 1, h, LINE2); R(x, ox + w + 7, oy, 7, 1, LINE2); R(x, ox + w + 7, oy + h - 1, 7, 1, LINE2);
    D.text(x, String(bp.h * 4), ox + w + 14, OY - 2, LINE2, { shadow: false });
    // 右下角图框
    R(x, 246, 112, 66, 26, '#0e2650'); R(x, 246, 112, 66, 1, LINE2); R(x, 246, 112, 1, 26, LINE2); R(x, 246, 125, 66, 1, '#2f63b0'); R(x, 278, 112, 1, 26, '#2f63b0');
    D.text(x, 'UD-WS', 250, 116, INK, { shadow: false }); D.text(x, 'REV', 282, 116, LINE2, { shadow: false });
    D.text(x, 'NANZHAN', 250, 129, LINE2, { shadow: false }); if ((t * 2 | 0) % 2) R(x, 300, 128, 4, 6, INK);
    // 左上角编号
    D.text(x, 'BP-' + (bp.w * 7 + bp.h * 3), 22, 14, LINE2, { shadow: false });
  }
  function drawDesk(x, b, bp, t, now) {
    const A = anim;
    if (A && A.type === 'learn') { // 展开 → 画线稿
      const u = (now - A.t0) / 1000, h = Math.round(134 * Math.min(1, u / 0.45));
      paper(x, h);
      if (h < 134) { R(x, 10, 8 + h - 3, 310, 8, '#2a5aa8'); R(x, 10, 8 + h - 3, 310, 2, '#5a92e8'); R(x, 10, 8 + h + 4, 310, 1, '#0b1a36'); } // 卷轴往下滚
      else { lineArt(x, bp, Math.min(1, (u - 0.45) / 0.7)); if (u > 1.15) marks(x, bp, t); }
      return;
    }
    if (A && A.type === 'craft') { // 打印：从下往上一行行长出来
      const u = (now - A.t0) / 1000, cbp = blueprint(D.itemInfo(A.id).art) || bp; paper(x, 134); marks(x, cbp, t); lineArt(x, cbp, 1, 0.35);
      if (!cbp) return;
      const ox = OX - (cbp.w * SC >> 1), oy = OY - (cbp.h * SC >> 1), pu = D.clamp((u - 0.25) / 1.2, 0, 1), row = Math.floor((1 - pu) * cbp.h);
      x.save(); x.beginPath(); x.rect(ox, oy + row * SC, cbp.w * SC, (cbp.h - row) * SC); x.clip(); x.drawImage(cbp.src, ox, oy, cbp.w * SC, cbp.h * SC); x.restore();
      if (row !== A.row && pu > 0 && pu < 1) { A.row = row; if (row % 3 === 0) sfx('stepm'); }
      // 打印头：先从左上角滑进来，再一行行来回扫
      const ent = Math.min(1, u / 0.25), dir = row % 2 ? 1 : -1, sweep = ((u * 9) % 1), hx = pu > 0 && pu < 1 ? ox + (dir > 0 ? sweep : 1 - sweep) * cbp.w * SC : ox - 30 + 30 * ent, hy = pu > 0 && pu < 1 ? oy + row * SC - 10 : 20 + (oy - 30) * ent;
      if (u < 1.5) { R(x, hx - 7, hy - 4, 14, 8, '#4c5272'); R(x, hx - 7, hy - 4, 14, 1, '#8a94aa'); R(x, hx - 2, hy + 4, 4, 3, '#2a2e3d'); R(x, hx - 1, hy + 7, 2, 2, '#ffd27a'); R(x, hx - 40, hy - 1, 33, 2, '#2a2e3d'); R(x, hx + 7, hy - 1, 33, 2, '#2a2e3d'); }
      if (pu > 0 && pu < 1) for (let i = 0; i < 5; i++) { const s = ((now / 37 + i * 13) | 0) % 9; R(x, hx - 6 + s + i, hy + 9 + ((i * 5 + s) % 6), 1, 1, i % 2 ? '#ffd27a' : '#3ee8ff'); } // 火花
      if (u > 1.45 && u < 1.65) { x.globalAlpha = 1 - (u - 1.45) / 0.2; R(x, 14, 8, 302, 134, '#ffffff'); x.globalAlpha = 1; } // 做好：白光一闪
      if (u >= 1.65) { x.globalAlpha = 0.5 + 0.5 * Math.sin(u * 20); R(x, ox - 3, oy - 3, cbp.w * SC + 6, 1, '#ffd27a'); R(x, ox - 3, oy + cbp.h * SC + 2, cbp.w * SC + 6, 1, '#ffd27a'); x.globalAlpha = 1; }
      return;
    }
    if (b.learned) { // 平时：线稿 + 尺寸线 + 扫描线
      paper(x, 134); lineArt(x, bp, 1); marks(x, bp, t);
      const sy = 8 + ((t * 40) % 160); if (sy < 142) { x.globalAlpha = 0.18; R(x, 15, sy, 300, 2, '#cfe0ff'); x.globalAlpha = 1; }
      return;
    }
    if (b.have) { // 还卷着：一卷蓝图躺在桌上，轻轻晃
      R(x, 0, 0, 330, 150, '#070a14'); for (let gx = 0; gx < 330; gx += 10) R(x, gx, 0, 1, 150, '#0c1222');
      const wob = Math.round(Math.sin(t * 2) * 1), cx = 165, cy = 76 + wob;
      R(x, cx - 70, cy - 9, 140, 18, '#1d4a8a'); R(x, cx - 70, cy - 9, 140, 3, '#5a92e8'); R(x, cx - 70, cy + 6, 140, 3, '#12305e');
      for (let i = -60; i <= 60; i += 12) R(x, cx + i, cy - 6, 1, 12, '#2f63b0');
      R(x, cx - 74, cy - 10, 5, 20, '#cfe0ff'); R(x, cx + 69, cy - 10, 5, 20, '#cfe0ff'); R(x, cx - 10, cy - 10, 4, 20, '#e3c14a'); // 两头和绑带
      if ((t * 1.5 | 0) % 2) { R(x, cx - 2, cy - 22, 4, 6, '#ffd27a'); R(x, cx - 1, cy - 15, 2, 2, '#ffd27a'); }
      return;
    }
    // 还没有：虚线剪影加问号
    paper(x, 134); x.globalAlpha = 0.5;
    if (bp) { const ox = OX - (bp.w * SC >> 1), oy = OY - (bp.h * SC >> 1); for (const [px, py, k] of bp.px) if (k === 2 && (px + py) % 2 === 0) R(x, ox + px * SC, oy + py * SC, SC, SC, LINE2); }
    x.globalAlpha = 1; D.text(x, '?', OX, OY - 14, INK, { scale: 6, align: 'center', shadow: '#0b1a36' });
  }
})(D);
