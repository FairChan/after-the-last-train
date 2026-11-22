/* 末班之后 · 小样二：机库改装台（试玩反馈二"机器人改装也要好看"）
   机库卡片上的"改装"或配装页的"改装台"进来：维修架的转台上站着这台型号（待机动画，能左右转身），
   装甲 / 动力 / 传感器三个挂点标在身上。装上的改装件直接长在机器人身上（城里也看得见，见 heroes.js）。
   右边列出这个挂点的全部改装件：仓库里有的直接装、优良精良的能直接买、工作台够级的当场做；
   鼠标移上去，机器人换成装上后的样子，下面的数值条预览变化。装的时候龙门架上的机械臂下来、焊花四溅、机身闪一下。
   画布一格就是一个像素（112×60），按 3 倍显示；只用平涂色块，不用渐变。
   规则（改装件数值、买、做）都在 growth.js，这里只管画和交互。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip, infoIcon, GR } = X;
  let root, G, raf = 0;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  X.hooks.clear.push(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; } });
  const CW = 112, CH = 60, Z = 3;          // 维修架画布（一格一像素），按 3 倍显示
  const FX = 56, FY = 54;                  // 机器人脚底站的位置（转台中心）
  const RING = [8, 7, 6, 5, 4, 3, 2, 1];   // 转台：▶ 按这个顺序转（8 = 正面朝外）
  const VIEW = { armor: 8, power: 3, sensor: 7 }; // 选中挂点时转到看得清的角度：胸前、背后、侧脸
  const HIT = 0.24;                        // 机械臂落下的时刻（秒）
  const pct = v => (Math.abs(v) < 0.005 ? '±0' : (v > 0 ? '+' : '') + Math.round(v * 100)) + '%';
  // 数值条：[名字, 说明, 取值(型号, 加成), 低, 高, 越低越好, 显示]
  const STAT = [
    ['耐久', '耐久上限', (S, f) => S.hp + f.hp, 0, 140, false, v => Math.round(v)],
    ['护盾', '进站自带的护盾', (S, f) => f.shield0, 0, 30, false, v => Math.round(v)],
    ['受伤', '受到的伤害', (S, f) => f.hurt, 0.7, 1.05, true, v => pct(v - 1)],
    ['移速', '移动速度', (S, f) => S.speed * f.speed, 0, 160, false, v => Math.round(v)],
    ['闪避', '闪避冷却', (S, f) => f.dash, 0.6, 1.05, true, v => pct(v - 1)],
    ['电容', '电容充能（打中、击毁都充电，满了按 X 补满超级弹）', (S, f) => f.cap, 0.95, 1.7, false, v => pct(v - 1)],
    ['技能', '技能冷却（含熟练度）', (S, f) => S.skill.cd * f.skill, 0, 30, true, v => v.toFixed(1) + 's'],
    ['搜索', '搜容器的速度', (S, f) => f.search, 0.95, 1.5, false, v => pct(v - 1)],
    ['暴露', '被敌人发现的速度', (S, f) => f.notice, 0.6, 1.05, true, v => pct(v - 1)],
    ['散布', '开枪的散布', (S, f) => f.spread, 0.7, 1.05, true, v => pct(v - 1)],
    ['枪声', '开枪引起的警戒', (S, f) => f.noise, 0.6, 1.05, true, v => pct(v - 1)],
  ];
  const owned = pf => Object.keys(D.SHELLS).filter(k => pf.shells[k]);
  // 换一套改装件以后的加成（只用来预览，不改档案）
  const fxWith = (pf, k, mods) => D.shellFx({ shells: { [k]: Object.assign({}, pf.shells[k], { mods }) }, grow: pf.grow }, k);

  // 工壳不带改装件时用的是原图，图集里没有量好的挂点：现量一帧
  const measured = new WeakMap();
  function frameMeasure(H, s) {
    if (H.anch) return H.anch[s];
    let m = measured.get(H); if (!m) measured.set(H, (m = {}));
    if (m[s] === undefined) {
      const [c, x] = D.canvas(H.fw, H.fh); x.drawImage(H.img, (s % H.cols) * H.fw, Math.floor(s / H.cols) * H.fh, H.fw, H.fh, 0, 0, H.fw, H.fh);
      const p = x.getImageData(0, 0, H.fw, H.fh).data; m[s] = D.heroMeasure((xx, yy) => p[(yy * H.fw + xx) * 4 + 3] > 0, H.fw, H.fh);
    }
    return m[s];
  }

  U.modbay = function (pf, body) {
    const list = owned(pf), k = list.includes(G.mbShell) ? G.mbShell : D.shellOf(pf); G.mbShell = k;
    const slot = D.RMOD_SLOTS[G.mbSlot] ? G.mbSlot : 'armor'; G.mbSlot = slot;
    if (!RING.includes(G.mbDir)) { G.mbDir = G.mbTo = VIEW[slot]; G.mbAng = G.mbAngT = -RING.indexOf(G.mbDir) * Math.PI / 4; }
    const mods = D.shellMods(pf, k), SH = D.SHELLS[k], cur = D.shellFx(pf, k), look = D.shellLook(pf, k) || {};
    const keys = Object.keys(D.RMOD).filter(x => D.RMOD[x].slot === slot).sort((a, b) => D.RMOD[a].q - D.RMOD[b].q);
    const shop = D.Growth ? Object.fromEntries(D.Growth.shop(pf).map(o => [o.id, o.price])) : {};
    const row = x => {
      const M = D.RMOD[x], id = 'rmod:' + x, have = GR().count(pf.stash, y => y === id), on = mods[slot] === x, cc = D.canCraft(pf, x), r = D.recipe(x);
      let act;
      if (on) act = '<button class="btn sm" data-mb-off="1">卸下</button>';
      else if (have) act = `<button class="btn sm primary" data-mb-fit="${x}">装上</button>`;
      else if (shop[id] != null) act = `<button class="btn sm${pf.money >= shop[id] ? '' : ' poor'}" data-mb-buy="${x}">买 · ${shop[id]}</button>`;
      else if (cc === 'ok' || cc === 'poor') act = `<button class="btn sm${cc === 'ok' ? '' : ' poor'}" data-mb-craft="${x}" data-tip="${esc('零件 ' + r.money + ' + ' + r.mats.map(([m, n]) => D.itemInfo(m).name + '×' + n).join('、'))}">制造</button>`;
      else act = `<span class="gs-why">${cc === 'no' ? '只能在城里找到' : (cc === 'lv' ? '工作台 ' + r.q + ' 级能做' : '要蓝图') + (M.q >= 3 ? ' · 城里能捡到' : '')}</span>`;
      return `<div class="gs-row q${M.q}${on ? ' on' : ''}" data-mb-hover="${x}"><img src="${infoIcon(D.itemInfo(id))}"><div class="gs-t"><b style="color:${D.QUALITY[M.q].col}">${esc(M.name)}</b>${have ? `<em>仓库 ${have}</em>` : ''}${on ? '<em class="on">装着</em>' : ''}<div>${esc(M.desc)}</div></div>${act}</div>`;
    };
    const isMain = k === D.shellOf(pf), slotKeys = Object.keys(D.RMOD_SLOTS);
    body.innerHTML = `<div class="gsmith mbay"><div class="gs-head"><button class="btn sm" data-act="back">◀ ${G.mbBack === 'load' ? '回仓库' : '回机库'}</button><h2>改装台</h2>
        <div class="gs-pick">${list.length > 1 ? '<button class="btn sm" data-mb-shell="-1">◀</button>' : ''}<b>${esc(SH.name)}<em>${esc(SH.code)}</em></b>${list.length > 1 ? '<button class="btn sm" data-mb-shell="1">▶</button>' : ''}</div>
        ${isMain ? '<span class="gs-main">出发用这台</span>' : '<button class="btn sm" data-act="pick">选用</button>'}<span class="hint">改装件跟着这台走，城里也看得见；损毁了一起丢。</span></div>
      <div class="gs-body"><div class="mb-left"><div class="mb-stage"><canvas width="${CW}" height="${CH}"></canvas><span class="mb-tag">预览</span>
          ${slotKeys.map(s => `<button class="mb-hot ${s}${s === slot ? ' on' : ''}${mods[s] ? ' full' : ''}" data-mb-slot="${s}"><b>${D.RMOD_SLOTS[s]}</b><span>${mods[s] ? esc(D.RMOD[mods[s]].name) : '空'}</span></button>`).join('')}
          <button class="btn sm mb-turn l" data-mb-turn="-1" data-tip="转台往左转">◀</button><button class="btn sm mb-turn r" data-mb-turn="1" data-tip="转台往右转">▶</button></div>
        <div class="gs-stats mb-stats">${STAT.map(([n, t]) => `<div class="gs-st" data-st="${n}" data-tip="${esc(t)}"><b>${n}</b><i class="bar"><i class="cur"></i><i class="pre"></i></i><span></span></div>`).join('')}</div></div>
        <div class="gs-list"><div class="cx-switch gs-tabs">${slotKeys.map(s => `<button class="tab${s === slot ? ' on' : ''}" data-mb-slot="${s}">${D.RMOD_SLOTS[s]}</button>`).join('')}</div>
          <div class="gs-rows">${keys.map(row).join('')}</div><div class="hint">余额 ${pf.money} · 鼠标移到一行上，机器人换成装上后的样子，左边数值条预览变化</div></div></div></div>`;
    const $ = s => body.querySelector(s), $$ = s => body.querySelectorAll(s);
    const stage = $('.mb-stage');
    // 数值条
    const stats = pv => {
      for (const [n, , f, lo, hi, low, fmt] of STAT) {
        const el = body.querySelector(`[data-st="${n}"]`), v = f(SH, cur), w = f(SH, pv || cur), pc = x => Math.round(Math.max(0, Math.min(1, (low ? hi - x : x - lo) / (hi - lo))) * 100);
        const d = w - v, better = low ? d < 0 : d > 0, pre = el.querySelector('.pre');
        el.querySelector('.cur').style.width = pc(v) + '%'; pre.style.left = Math.min(pc(v), pc(w)) + '%'; pre.style.width = Math.abs(pc(w) - pc(v)) + '%'; pre.className = 'pre ' + (Math.abs(d) < 1e-6 ? '' : better ? 'up' : 'down');
        el.querySelector('span').innerHTML = fmt(v) + (Math.abs(d) > 1e-6 ? ` → <b class="${better ? 'ok' : 'bad'}">${fmt(w)}</b>` : '');
      }
    };
    stats(null);
    const ghostMods = x => { const m = Object.assign({}, mods); if (mods[slot] === x) delete m[slot]; else m[slot] = x; return m; };
    $$('[data-mb-hover]').forEach(el => {
      el.onmouseenter = () => { const m = ghostMods(el.dataset.mbHover); stats(fxWith(pf, k, m)); G.mbGhost = m; stage.classList.add('ghost'); };
      el.onmouseleave = () => { stats(null); G.mbGhost = null; stage.classList.remove('ghost'); };
    });
    G.mbGhost = null;
    // 装 / 卸：先记下原来的样子，机械臂落下那一刻才换上新的
    const play = (kind, x) => {
      G.mbAnim = { k, slot, kind, t0: performance.now(), prev: before, col: D.QUALITY[D.RMOD[x].q].col, seed: Math.random() * 1000 };
      D.Sfx.play('click'); setTimeout(() => { D.Sfx.play('tink'); D.Sfx.play(kind === 'fit' ? 'power' : 'open_metal'); }, HIT * 1000);
      U.refresh();
    };
    const before = Object.assign({}, mods);
    const fit = x => { if (D.fitMod(pf, k, x)) { play('fit', x); return true; } D.Sfx.play('nope'); U.toast('仓库满了，换下来的放不下'); return false; };
    $$('[data-mb-slot]').forEach(b => b.onclick = () => { D.Sfx.play('click'); G.mbSlot = b.dataset.mbSlot; G.mbTo = VIEW[G.mbSlot]; U.refresh(); });
    $$('[data-mb-shell]').forEach(b => b.onclick = () => { const i = list.indexOf(k); G.mbShell = list[(i + +b.dataset.mbShell + list.length) % list.length]; G.mbAnim = null; D.Sfx.play('click'); U.refresh(); });
    $$('[data-mb-turn]').forEach(b => b.onclick = () => { D.Sfx.play('click'); G.mbTo = RING[(RING.indexOf(G.mbTo || G.mbDir) + +b.dataset.mbTurn + 8) % 8]; });
    $$('[data-mb-fit]').forEach(b => b.onclick = () => fit(b.dataset.mbFit));
    $$('[data-mb-off]').forEach(b => b.onclick = () => { const x = mods[slot]; if (D.unfitMod(pf, k, slot)) play('off', x); else { D.Sfx.play('nope'); U.toast('仓库满了'); } });
    $$('[data-mb-buy]').forEach(b => b.onclick = () => { // 先弹确认框（trade.js）
      const x = b.dataset.mbBuy, id = 'rmod:' + x, price = shop[id];
      D.Trade.buyFit(b, id, price, '买下后直接装到这台上', () => { pf.money -= price; GR().add(pf.stash, id, 1); fit(x); });
    });
    $$('[data-mb-craft]').forEach(b => b.onclick = () => { const x = b.dataset.mbCraft; if (D.craft(pf, x)) fit(x); else { D.Sfx.play('nope'); U.toast(GR().canAdd(pf.stash, 'rmod:' + x, 1) ? '零件或材料不够' : '仓库满了'); } });
    $('[data-act=back]').onclick = () => { D.Sfx.play('click'); G.hubTab(G.mbBack || 'shells'); };
    const pb = $('[data-act=pick]'); if (pb) pb.onclick = () => { D.pickShell(pf, k); D.Sfx.play('power'); U.refresh(); };

    // ── 画维修架
    const cv = $('canvas'), cx = cv.getContext('2d');
    const px = (x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), w, h); };
    const dline = (x0, y0, x1, y1, c, every) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) if (!every || i % every === 0) px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 1, 1, c); };
    const ell = (x0, y0, rx, ry, c) => { for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2))); px(x0 - w, y0 + y, w * 2 + 1, 1, c); } };
    const ring = (x0, y0, r, c) => { const n = Math.max(8, Math.round(r * 6)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; px(x0 + Math.cos(a) * r, y0 + Math.sin(a) * r, 1, 1, c); } };
    // 挂点牌子连到身上的那一端（画布坐标）
    const Zd = (stage.offsetWidth || CW * Z) / CW; // 实际显示倍数（细格界面里是 6 倍）
    const conn = {}; for (const b of $$('.mb-hot')) { const right = b.offsetLeft > CW * Zd / 2; conn[b.dataset.mbSlot] = [Math.round((right ? b.offsetLeft - 2 : b.offsetLeft + b.offsetWidth + 2) / Zd), Math.round((b.offsetTop + b.offsetHeight / 2) / Zd)]; }
    function backdrop(t) {
      px(0, 0, CW, CH, '#0b0d16');
      for (let x = 0; x < CW; x += 16) px(x, 4, 1, 42, '#141827');                 // 墙板缝
      px(0, 22, CW, 1, '#141827'); for (let x = 8; x < CW; x += 16) { px(x, 7, 1, 1, '#1d2236'); px(x, 43, 1, 1, '#1d2236'); }
      px(0, 0, CW, 4, '#232842'); px(0, 3, CW, 1, '#151827'); for (let x = 3; x < CW; x += 8) px(x, 1, 2, 1, '#3a4266'); // 顶上的龙门架
      for (const x of [14, 97]) { dline(x, 4, x + (x < 56 ? 3 : -3), 16, '#1d2236'); dline(x + 1, 4, x + (x < 56 ? 4 : -2), 18, '#181c2c'); } // 垂下来的线缆
      for (const x0 of [3, CW - 11]) { px(x0, 28, 8, 18, '#161a2a'); px(x0, 28, 8, 1, '#2a3048'); for (let i = 0; i < 3; i++) px(x0 + 1, 31 + i * 5, 6, 3, '#202538'); } // 两侧工具柜
      const blink = Math.floor(t * 2) % 2; px(6, 25, 2, 1, blink ? '#ff3047' : '#4a1420'); px(CW - 8, 25, 2, 1, blink ? '#3a5a2a' : '#5fd068');
      px(0, 46, CW, CH - 46, '#121522'); for (let x = 0; x < CW; x++) for (let y = 46; y < 48; y++) if ((x + y) % 6 < 3) px(x, y, 1, 1, '#c8a63a'); // 地面 + 黄黑警示边
      for (let x = 2; x < CW; x += 9) px(x, 53, 4, 1, '#171b2b');
    }
    function turntable(ang) {
      ell(FX, FY + 2, 25, 4, '#0e1019'); ell(FX, FY + 1, 25, 4, '#1a1e31'); ell(FX, FY, 25, 4, '#262c46'); ell(FX, FY, 20, 3, '#2e3554'); ell(FX, FY, 9, 1, '#20253c'); // 转台和机器人的影子
      for (let i = 0; i < 12; i++) { const a = ang + i * Math.PI / 6, s = Math.sin(a); px(FX + Math.cos(a) * 23, FY + s * 3.5, 1, 1, s > 0 ? '#3ee8ff' : '#1d5a6a'); } // 刻度灯跟着转台转
    }
    function arm(x, tipY, carry) {
      px(x - 3, 2, 7, 3, '#646e86'); px(x - 3, 2, 7, 1, '#949fb6');                     // 滑车
      if (tipY > 5) { px(x - 1, 5, 3, tipY - 5, '#4a5266'); px(x - 1, 5, 1, tipY - 5, '#7c869c'); } // 伸缩杆
      px(x - 2, tipY, 5, 2, '#c8cdda'); px(x - 2, tipY + 2, 1, 2, '#949fb6'); px(x + 2, tipY + 2, 1, 2, '#949fb6'); // 爪子
      if (carry) px(x - 1, tipY + 2, 3, 3, carry);
    }
    const wobble = { x: 0 };
    const draw = now => {
      if (!cv.isConnected) { raf = 0; return; }
      const t = now / 1000;
      // 转台：一档一档转到目标朝向
      if (G.mbTo && G.mbTo !== G.mbDir && now - (G.mbStepT || 0) > 70) { const i = RING.indexOf(G.mbDir), j = RING.indexOf(G.mbTo), d = (j - i + 8) % 8 <= 4 ? 1 : -1; G.mbDir = RING[(i + d + 8) % 8]; G.mbAngT -= d * Math.PI / 4; G.mbStepT = now; }
      G.mbAng += (G.mbAngT - G.mbAng) * 0.25;
      const A = G.mbAnim && G.mbAnim.k === k && now - G.mbAnim.t0 < 750 ? G.mbAnim : null, at = A ? (now - A.t0) / 1000 : 0, hit = A && at >= HIT;
      const show = G.mbGhost || (A && !hit ? A.prev : mods), H = D.heroOf(k, show, ['idle' + G.mbDir]), V = H.variant(look.tint, look.visor);
      const lst = H.meta['idle' + G.mbDir], s = lst[Math.floor(t * 8) % lst.length], sx = (s % H.cols) * H.fw, sy = Math.floor(s / H.cols) * H.fh;
      wobble.x = hit && at - HIT < 0.12 ? (Math.floor(at * 60) % 2 ? 1 : -1) : 0;
      const ox = FX - (H.fw >> 1) + wobble.x, oy = FY - H.footY, m = frameMeasure(H, s), an = m ? D.heroAnchors(m, G.mbDir) : null;
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false; cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      backdrop(t); turntable(G.mbAng);
      cx.drawImage(V.img, sx, sy, H.fw, H.fh, ox, oy, H.fw, H.fh);
      cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 3); cx.drawImage(V.emit, sx, sy, H.fw, H.fh, ox, oy, H.fw, H.fh); cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
      // 扫描线：每 3 秒从头扫到脚
      const u = (t % 3) / 1.4; if (u < 1) { cx.globalAlpha = 0.4; px(FX - 15, 8 + u * 46, 31, 1, '#3ee8ff'); cx.globalAlpha = 1; }
      // 挂点：牌子连一条虚线到身上。空挂点画个菱形；装着东西的只在选中时一闪一闪（不一直挡住部件）
      if (an) for (const sl of Object.keys(D.RMOD_SLOTS)) {
        const [ax, ay] = [ox + an[sl][0], oy + an[sl][1]], on = sl === slot, full = !!show[sl];
        if (conn[sl]) dline(conn[sl][0], conn[sl][1], ax, ay, on ? '#4cc3ff' : full ? '#2f5a3a' : '#3a4266', 2);
        if (full && !(on && Math.floor(t * 2.5) % 2 === 0)) continue;
        const c = on ? '#4cc3ff' : '#6a7498';
        for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]) px(ax + dx, ay + dy, 1, 1, c);
      }
      // 装 / 卸的动画：机械臂落下 → 闪白、焊花、一圈光 → 收回
      if (A && an) {
        const [ax, ay] = [ox + an[A.slot][0], oy + an[A.slot][1]], e = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
        const down = hit ? 1 - e((at - HIT) / 0.3) : e(at / HIT), tipY = 5 + (ay - 9) * down;
        arm(ax, tipY, (A.kind === 'fit') !== hit ? A.col : null);
        if (hit) {
          const k2 = at - HIT;
          if (k2 < 0.25) { cx.globalAlpha = (1 - k2 / 0.25) * 0.85; cx.drawImage(H.flash, sx, sy, H.fw, H.fh, ox, oy, H.fw, H.fh); cx.globalAlpha = 1; }
          if (k2 < 0.3) { cx.globalAlpha = 1 - k2 / 0.3; ring(ax, ay, 2 + k2 / 0.3 * 11, A.col); cx.globalAlpha = 1; }
          if (k2 < 0.45) for (let i = 0; i < 14; i++) { const a = (A.seed + i * 2.399) % (Math.PI * 2), v = 30 + ((A.seed * 7 + i * 13) % 30); px(ax + Math.cos(a) * v * k2, ay + Math.sin(a) * v * k2 * 0.7 + 70 * k2 * k2, 1, 1, i % 3 === 0 ? A.col : i % 3 === 1 ? '#fff0c8' : '#4cc3ff'); }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    X.retip();
  };
})(D);
