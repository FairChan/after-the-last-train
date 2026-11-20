/* 末班之后 · 小样二：线路图、站内 HUD、搜刮面板、背包、商人、结算（从 ui.js 拆出来） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._;
  const { GR, iconURL, url, artURL, infoIcon, cardIcon, esc, tipOf, hideTip, gridHTML, itemTile, cardSlotHTML, SKILL_ICON, legend, stationCard } = X;
  let root, G;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
  X.hooks.clear.push(() => { hudEls = null; if (D.Spot && !(D.Tour && D.Tour.cur)) D.Spot.hide(); }); // 训练场的聚光灯挂在 body 上：换页时收起
  // ── 行动中：线路图上选下一站
  U.travel = function (R, hover) {
    U.clear(); root.className = 'm-travel';
    const C = R.city, at = C.stations[R.at], s = hover != null ? C.stations[hover] : null, can = s && D.canTravel(R, s.id), back = s && at.adj.has(s.id) && !can && R.visited.has(s.id);
    root.innerHTML = raidBar(R) + `<div class="side">
      <h3>在 ${esc(at.name)}</h3><div class="hint">选一个相邻的站走过去。走过的站不能回头。每走一站警戒 +1。</div>
      ${s ? stationCard(C, s, R.step + 1) : '<div class="hint dim">鼠标移到发亮的站上</div>'}
      ${can ? `<button class="btn primary" data-act="go">走到 ${esc(s.name)}${R.visited.has(s.id) ? '（折返，已搜空）' : ''}</button>` : back ? '<div class="hint warn">走过的站不能回头</div>' : ''}
      <button class="btn" data-act="bag">背包</button>
    </div>${legend()}`;
    const go = $('[data-act=go]'); if (go) go.onclick = () => G.travelTo(s.id);
    $('[data-act=bag]').onclick = () => U.bag(R);
    hideTip();
  };
  function raidBar(R) {
    const v = D.bagValue(R), lv = D.threatLv(R), col = D.THREAT_COL[lv];
    const df = D.DIFF[R.diff || 0];
    return `<div class="raidbar"><span class="rb-st">${esc(R.city.stations[R.at].name)}</span>${R.diff ? `<span class="rb-diff" style="color:${df.col}">${df.name}</span>` : ''}
      <span class="rb-alert" data-tip="威胁：每进一站、在站里每待 2 分钟、开枪都会涨，一共 10 级，前几级升得快、后面慢。越高敌人越多越硬、种类越多（3 级起每级多 3 种），外环也一样，撤离战也更难打" style="--tc:${col}">威胁 <b>${lv}</b> ${D.THREAT_NAME[lv]} <i class="tbar"><i style="width:${Math.round(D.threatFrac(R) * 100)}%"></i></i></span>
      <span class="rb-bag" data-tip="背包里东西值多少"><i class="ico-gold"></i><b>${Math.round(v)}</b></span></div>`;
  }

  U.raidBarHTML = raidBar;
  // ── 站内 HUD
  const IMPORTANT = new Set(['撤离战', '车来了', '追兵', '追兵越来越多', '巡逻队进站', '钳工-9', '过热', '门禁房', '中继接通', '隐藏房间']);
  let hudEls = null;
  U.station = function (S) {
    U.clear(); root.className = 'm-station' + (D.settings.lite ? ' lite' : '');
    root.innerHTML = `<div class="tophud"><div class="sched"><b class="sc-t"></b><span class="sc-s"></span><i class="sc-bar"><i></i></i></div>${raidBar(S.raid)}</div><div class="banner"><b></b><span></span></div>
      <div class="prompt"><span class="pk"></span><span class="pt"></span><span class="pm"><span class="pmn"></span><span class="pk pk2"></span><span class="pmt">切换</span></span><div class="pp"></div></div>
      <div class="ammo"><b class="am-name"></b><span class="am-res"></span></div>
      <div class="groundp"></div><div class="tutp"></div><div class="hintp"></div>
      <div class="mods"><div class="mod skill" data-skill="1" data-tip="${esc('G · ' + S.SH.skill.name + '：' + S.SH.skill.desc)}"><img src="${url(SKILL_ICON[S.SH.skill.k])}"><div class="cdmask"></div><span class="mk">G</span></div>${['q', 'e'].map(k => { const id = S.raid.load[k]; return `<div class="mod" data-k="${k}">${id ? `<img src="${cardIcon(D.CARDS[id])}"><div class="cdmask"></div><span class="mk">${k.toUpperCase()}</span>` : `<span class="mk">${k.toUpperCase()}</span>`}</div>`; }).join('')}
        ${[['C', 'medpack', 'heal'], ['V', 'cellpack', 'cell'], ['Z', 'nade_frag', 'nade']].map(([k, a, t]) => `<div class="mod use" data-use="${t}" data-tip="${esc(k + ' · ' + D.QUICK[t].name + '：点按用选中的那种；按住 + 滚轮换成背包里同类的别的')}"><img src="${artURL(a)}"><span class="mk">${k}</span><b class="mc"></b><div class="qpick"></div></div>`).join('')}</div>
      <div class="panel-slot"></div>`;
    hudEls = { ground: $('.groundp'), gsig: '', skill: $('.mod.skill'), banner: $('.banner'), prompt: $('.prompt'), pk: $('.pk'), pt: $('.pt'), pp: $('.pp'), pm: $('.pm'), pmn: $('.pmn'), pk2: $('.pk2'), mods: [...$$('.mod[data-k]')], uses: [...$$('.mod.use')], bar: $('.raidbar'), am: $('.am-name'), ar: $('.am-res'), sig: '', tut: $('.tutp'), hintp: $('.hintp'), tsig: '', hsig: '', sched: $('.sched'), ssig: '' };
    hideTip();
  };
  const QUICK_ART = { heal: 'medpack', cell: 'cellpack', nade: 'nade_frag' }; // 格子里什么都没有时的图标
  U.stationUpdate = function (S) {
    const E = hudEls; if (!E) return;
    const b = S.banner, R = S.raid;
    E.banner.parentElement.classList.toggle('ride', !!(S.outro && S.outro.t > D.OUTRO_RIDE.start)); // 撤离过场：只留横幅
    // 型号技能冷却
    { const m = E.skill.querySelector('.cdmask'), f = S.player.skillCd > 0 ? Math.min(1, S.player.skillCd / S.SH.skill.cd) : 0; m.style.height = Math.round(f * 100) + '%'; E.skill.classList.toggle('ready', f === 0); }
    E.banner.classList.toggle('hv', !!(b && b.hv));
    // 地上的东西：附近有就弹出拾取框（单击拾取，F 全拿）
    const near = S.lootOpen ? [] : S.groundNear, gs = near.map(g => g.id + ':' + g.n).join('|');
    if (gs !== E.gsig) {
      E.gsig = gs;
      if (!near.length) { E.ground.style.display = 'none'; E.ground.innerHTML = ''; }
      else {
        E.ground.style.display = 'flex';
        const list = near.slice().sort((a, b) => D.itemInfo(b.id).q - D.itemInfo(a.id).q);
        E.ground.innerHTML = `<div class="gp-head"><b>地上</b><span><i class="pk">F</i> 全拿 · 单击拿一件</span></div><div class="gp-list">${list.map((g, i) => { const it = D.itemInfo(g.id); return `<div class="gp-it q${it.q}${X.cmb ? X.cmb(g.id).cls : ''}" data-gi="${i}" ${X.tipAttr(g.id, g.n, '单击拿一件')}><img src="${infoIcon(it)}">${X.cmb ? X.cmb(g.id).html : ''}<span>${esc(it.name)}${g.n > 1 ? ' ×' + g.n : ''}</span></div>`; }).join('')}</div>`;
        E.ground.querySelectorAll('[data-gi]').forEach(el => el.onclick = ev => { ev.stopPropagation(); D.takeGround(S, list[+el.dataset.gi]); E.gsig = null; hideTip(); }); // null：下一帧一定重画（'' 正好是"脚边没东西"的签名，拿走最后一件后框就不会收起）
      }
    }
    if (b) { const k = b.t < 0.3 ? b.t / 0.3 : b.t > 2 ? 1 - (b.t - 2) / 0.4 : 1; E.banner.style.display = 'flex'; E.banner.style.opacity = k; E.banner.querySelector('b').textContent = b.text; E.banner.querySelector('span').textContent = !D.settings.lite || b.keep || b.hv || IMPORTANT.has(b.text) ? b.sub : ''; }
    else E.banner.style.display = 'none';
    // 新手教学目标面板
    if (S.tut) {
      // 训练场（design/features/tutorial）：第几区 · 区里第几步，林桥的话 + 要做什么，底下是跳区 / 继续；聚光灯每帧跟着走（tut-tour.js）
      const T = S.tut, inf = D.tutInfo && D.tutInfo(S), st = inf && inf.st, sig = T.i + ':' + (T.wait > 0) + ':' + (inf ? inf.prog : '');
      if (sig !== E.tsig) { E.tsig = sig; E.tut.style.display = st ? 'block' : 'none'; E.tut.classList.toggle('ok', T.wait > 0);
        if (st) E.tut.innerHTML = `<div class="tp-z"><span>新手教学 · 第 ${inf.zone + 1} / ${inf.zones} 区</span><b>${inf.zoneName}</b></div>`
          + `<div class="tp-h"><span>${inf.j + 1} / ${inf.n}</span><b>${st.title}</b>${T.wait > 0 ? '<i>完成</i>' : inf.prog ? `<i class="tp-pg">${inf.prog}</i>` : ''}</div><div class="tp-t">${st.text}</div>`
          + `<div class="tp-bar">${Array.from({ length: inf.n }, (_, i) => `<i class="${i < inf.j || (i === inf.j && T.wait > 0) ? 'on' : ''}"></i>`).join('')}</div>`
          + `<div class="tp-f">${st.info ? `<span class="tp-go"><b>${D.keyLabel(D.key('interact'))}</b> 继续</span>` : ''}${inf.canSkip ? '<span><b>回车</b> 跳过这一区</span>' : ''}<span><b>Esc</b> 跳过教学</span></div>`; }
    }
    if (D.Spot) D.Spot.raid(S);
    // 第一次提示
    { const hm = S.hintMsg, hs = hm ? hm.k : ''; if (hs !== E.hsig) { E.hsig = hs; E.hintp.style.display = hm ? 'flex' : 'none'; if (hm) E.hintp.innerHTML = `<i>提示</i><span>${esc(hm.text)}</span>`; } }
    schedHUD(S, E);
    const pr = S.prompt;
    if (pr && !S.lootOpen) { E.prompt.style.display = 'flex'; E.pk.textContent = pr.key; E.pk.style.display = pr.key ? '' : 'none'; E.pt.textContent = pr.text; E.pp.style.width = pr.prog ? Math.round(pr.prog * 100) + '%' : '0';
      // 范围里还有别的能按 F 的东西：后面写"还有 N 个 · T 切换"（interact.js）
      E.pm.style.display = pr.more ? 'flex' : 'none'; if (pr.more) { E.pmn.textContent = '还有 ' + pr.more + ' 个'; E.pk2.textContent = D.keyLabel(D.key('pick')); } }
    else E.prompt.style.display = 'none';
    const p = S.player;
    E.mods.forEach(el => { const k = el.dataset.k, id = R.load[k], m = el.querySelector('.cdmask'); if (!id || !m) return; const cd = Math.max(p.modCd[k], p.jamT), f = cd > 0 ? Math.min(1, cd / D.CARDS[id].cd) : 0; m.style.height = Math.round(f * 100) + '%'; el.classList.toggle('ready', f === 0); el.classList.toggle('jam', p.jamT > 0); });
    const cnt = k => GR().count(R.bag, id => id === 'use:' + k);
    // 快捷栏：图标和数量是选中的那一种；按住时上方弹出这一类的清单（quick.js）
    E.uses.forEach(el => { const t = el.dataset.use, k = D.pickUse(R, t), n = k ? cnt(k) : 0, a = k ? D.USE[k].art : QUICK_ART[t];
      if (el.dataset.art !== a) { el.dataset.art = a; el.querySelector('img').src = artURL(a); }
      if (t === 'heal') el.classList.toggle('cd', p.healCd > 0); el.querySelector('.mc').textContent = n; el.classList.toggle('none', !n); el.classList.toggle('busy', p.useT > 0);
      const open = S.quickOpen === t; el.classList.toggle('open', open);
      if (!open) el.dataset.qsig = '';
      else { const own = D.quickOwned(R, t), sig = k + ':' + own.map(x => x + cnt(x)).join(','); if (el.dataset.qsig !== sig) { el.dataset.qsig = sig; el.querySelector('.qpick').innerHTML = `<div class="qn">${k ? esc(D.USE[k].name) : '没有' + D.QUICK[t].name}</div>` + own.map(x => `<div class="qr${x === k ? ' on' : ''}"><img src="${artURL(D.USE[x].art)}"><span>${cnt(x)}</span></div>`).join(''); } }
    });
    const at = D.ammoText(R, p); // 现在打的是什么、弹匣 / 子弹袋 / 背包各多少（ammo.js）
    E.am.textContent = at.name; E.am.style.color = at.col; E.ar.textContent = at.line; E.ar.classList.toggle('empty', at.empty);
    const sig = Math.round(D.bagValue(R)) + ':' + D.threatLv(R) + ':' + Math.round(D.threatFrac(R) * 100); // 只在显示的数字变了才重建（以前用 R.alert，每帧都变，每帧都把提示框关掉）
    if (sig !== E.sig) { E.sig = sig; const tmp = document.createElement('div'); tmp.innerHTML = raidBar(R); E.bar.replaceWith(tmp.firstChild); E.bar = $('.raidbar'); X.retip(); }
    const c = S.lootOpen && S.lootOpen.items ? S.lootOpen : null;
    // 揭开的件数变了就重画面板（联机时揭开那一下可能落在队友那边、这边没收到事件；兜底：进度条不会停在已经揭开的那格上）
    if (c && c._render) { const n = c.items.reduce((s, o) => s + (o.seen !== false), 0), was = seenR.get(c); if (was !== n) { seenR.set(c, n); if (was != null) U.lootReveal(S, c); } } // 记在本机（WeakMap），不放进箱子：箱子的状态会发给队友
    const bar = c && root.querySelector('.gi.searching .sbar i');
    if (bar) {
      const o = c.items.find(x => x.seen === false);
      if (o) {
        const k = c.rt / D.revealTime(o.id), q = D.itemInfo(o.id).q, el = bar.closest('.gi');
        bar.style.width = Math.min(100, Math.round(k * 100)) + '%';
        // 快揭开时，好东西的格子提前泛出品质色（越到后面越亮）
        if (q >= 2 && k > 0.45) { el.classList.add('tease'); el.style.setProperty('--qc', D.QUALITY[q].col); el.style.setProperty('--tk', Math.min(1, (k - 0.45) / 0.55).toFixed(2)); }
      }
    }
  };

  const seenR = new WeakMap(); // 面板上次看到的揭开件数（上面兜底重画用）
  // ── 下一班车（train.js）：顶上中间一块小站牌，倒计时；车停靠时变绿闪
  function schedHUD(S, E) {
    const X = S.sched, el = E.sched; if (!el) return;
    const show = !!X && !S.over && !S.tut && X.st !== 'off' && X.st !== 'gone' && !S.banner; // 横幅（站名、列车进站）出来的两秒先让开
    if (!show) { if (E.ssig !== '-') { E.ssig = '-'; el.style.display = 'none'; } return; }
    const left = D.schedLeft(S), sec = Math.ceil(left), clock = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), up = S.f !== 1;
    const cf = S.console ? S.console.f : 1;
    const [t, s, k] = X.st === 'end' ? ['终点站', S.f !== cf ? '控制台在 ' + (cf + 1) + ' 层' : '控制台叫接驳车', 0] // 线路尽头：没有下一站，只能叫接驳车
      : X.st === 'wait' ? ['下一班车 ' + clock, up ? '站台在 2 层' : '', X.t / X.wait] // 在站台层不写"去下一站"：顶栏挤，只留要你做事的那句
      : X.st === 'arrive' ? ['列车进站', up ? '快回 2 层' : '站台下沿上车', 1]
      : X.st === 'dwell' && X.hold ? ['列车在等你', up ? '回站台上车' : '站台下沿上车', 1] // 人类据点、未知信号站：车一直停着
      : X.st === 'dwell' ? ['停靠 ' + sec + ' 秒', up ? '快回 2 层' : '站台下沿上车', 1 - left / D.SCHED.dwell]
      : ['车开走了', '', 0];
    const sig = X.st + t + s;
    if (sig !== E.ssig) { E.ssig = sig; el.style.display = 'flex'; el.querySelector('.sc-t').textContent = t; el.querySelector('.sc-s').textContent = s; el.classList.toggle('due', X.st === 'arrive' || X.st === 'dwell'); el.classList.toggle('soon', X.st === 'wait' && left <= 10); }
    el.querySelector('.sc-bar i').style.width = Math.round(D.clamp(k, 0, 1) * 100) + '%';
  }
  // ── 搜刮面板：左边容器（逐件揭开），右边背包和保险箱
  U.loot = function (S, c) {
    const R = S.raid, slot = $('.panel-slot'); if (!slot) return;
    S.lootOpen = c;
    const render = () => {
      if (S.lootOpen !== c) return;
      const searching = c.items.some(o => o.seen === false);
      const fresh = !c._shown; c._shown = true;
      slot.innerHTML = `<div class="lootp${fresh ? ' opening' : ''}"><div class="lp-col"><h4>${D.CONT[c.kind].name}${searching ? (c.openT != null && c.openT < D.OPEN_DUR ? ' · 打开中…' : ' · 搜索中…') : ''}</h4>
          ${gridHTML('cont', c.grid, { click: e => takeFromCont(S, c, e), rclick: e => D.dropToGround(S, c.grid, e), accept: () => true })}
          <button class="btn sm" data-act="all">全拿</button></div>
        <div class="lp-col"><h4>${D.BAGS[R.load.bag].name} ${D.bagUsed(R)}/${D.bagCap(R)} · ${Math.round(D.bagValue(R))}</h4>
          ${gridHTML('bag', R.bag, { click: e => { if (D.isWeaponCard(e.id)) { D.equipFromBag(S, R.bag, e); render(); return; } GR().move(R.bag, e, c.grid); D.Sfx.play('click'); }, rclick: e => D.dropToGround(S, R.bag, e) })}
          <h4 class="safe-h">保险箱</h4>${gridHTML('safe', R.safe, { click: e => { GR().move(R.safe, e, R.bag); D.Sfx.play('click'); } })}
          ${R.keycase ? `<h4 class="safe-h">门禁卡包</h4>${gridHTML('keycase', R.keycase, { accept: e => D.isKey(e.id), click: e => { GR().move(R.keycase, e, R.bag); D.Sfx.play('click'); } })}` : ''}
          <h4 class="safe-h">子弹袋</h4>${gridHTML('pouch', D.pouchR(R), { accept: e => D.isAmmo(e.id), click: e => { GR().move(D.pouchR(R), e, R.bag); D.Sfx.play('click'); } })}
          <div class="hint">单击拿 / 放回；右键丢掉（货箱、背包里都行，丢了捡不回来）；背包里单击枪或近战直接换上。F / Esc 关闭。</div></div></div>`;
      slot.querySelector('[data-act=all]').onclick = () => { let full = false; for (const e of c.items.slice()) { if (e.seen === false) continue; if (e.id.startsWith('bag:')) continue; if (!D.takeToBag(R, c.grid, e)) full = true; else if (GR().at(c.grid, e.x, e.y) === e) full = true; } D.Sfx.play(full ? 'nope' : 'pick'); if (full) U.toast('背包满了'); render(); };
      X.retip();
    };
    c._render = render;
    render();
  };
  function takeFromCont(S, c, e) {
    const R = S.raid;
    if (e.id.startsWith('bag:')) { swapBag(S, c, e); return; }
    if (!D.takeToBag(R, c.grid, e)) { D.Sfx.play('nope'); U.toast('背包放不下'); } else D.Sfx.play('coin');
  }
  // 行动中换背包：东西码进新包，放不下的留在容器里
  function swapBag(S, c, e) {
    const R = S.raid, nb = D.BAGS[e.id.slice(4)], old = R.load.bag;
    const ext = D.bagExtra(R.shell, R.pas), { grid, over } = GR().repack(R.bag, nb.gw + ext[0], nb.gh + ext[1]);
    GR().remove(c.grid, e);
    R.bag.w = grid.w; R.bag.h = grid.h; R.bag.items.length = 0; R.bag.items.push(...grid.items);
    R.load.bag = e.id.slice(4); R.pf.load.bag = R.load.bag;
    for (const o of over) GR().add(c.grid, o.id, o.n);
    if (!D.BAGS[old].free) GR().add(c.grid, 'bag:' + old, 1);
    for (const o of c.items) if (o.seen == null) o.seen = true;
    U.toast('换上了' + nb.name + (over.length ? '，放不下的留在容器里' : '')); D.Sfx.play('power');
  }
  U.lootReveal = function (S, c) { if (S.lootOpen === c && c._render) { const vis = c.items.filter(o => o.seen !== false), last = vis[vis.length - 1]; if (last) last.pop = true; seenR.set(c, vis.length); c._render(); } }; // 记下件数：兜底重画不会再画一遍（不然揭开动画放两次）
  U.closePanel = function (S) { const slot = $('.panel-slot'); if (slot) slot.innerHTML = ''; hideTip(); if (S) S.lootOpen = null; };
  // ── 背包与保险箱（Tab）
  U.bag = function (R, S) {
    const host = S ? $('.panel-slot') : root; if (!host) return;
    let el = host.querySelector('.bagp'); if (!el) { el = document.createElement('div'); el.className = 'bagp lootp'; host.appendChild(el); }
    const state = { bag: true };
    if (S) S.lootOpen = state;
    const render = () => {
      el.innerHTML = `<div class="lp-col"><h4>${D.BAGS[R.load.bag].name} ${D.bagUsed(R)}/${D.bagCap(R)} · ${Math.round(D.bagValue(R))}</h4>${gridHTML('bag', R.bag, { click: e => { if (S && D.isWeaponCard(e.id)) { D.equipFromBag(S, R.bag, e); render(); return; } if (!GR().move(R.bag, e, R.safe)) { D.Sfx.play('nope'); U.toast('保险箱放不下'); } else D.Sfx.play('click'); }, rclick: S ? e => D.dropToGround(S, R.bag, e) : null })}
          <div class="hint">单击放进保险箱${S ? '；单击枪或近战直接换上；右键丢掉（捡不回来）' : ''}。死了背包全丢，保险箱留着。</div></div>
        <div class="lp-col safe"><h4>保险箱 ${R.safe.w}×${R.safe.h}</h4>${gridHTML('safe', R.safe, { click: e => { if (!GR().move(R.safe, e, R.bag)) { D.Sfx.play('nope'); U.toast('背包放不下'); } else D.Sfx.play('click'); } })}
        ${R.keycase ? `<h4 class="kc-h">门禁卡包 <em>死了也不丢</em></h4>${gridHTML('keycase', R.keycase, { accept: e => D.isKey(e.id), click: e => { if (!GR().move(R.keycase, e, R.bag)) { D.Sfx.play('nope'); U.toast('背包放不下'); } else D.Sfx.play('click'); } })}` : ''}<h4 class="kc-h">子弹袋 <em>从左往右用</em></h4>${gridHTML('pouch', D.pouchR(R), { accept: e => D.isAmmo(e.id), click: e => { if (!GR().move(D.pouchR(R), e, R.bag)) { D.Sfx.play('nope'); U.toast('背包放不下'); } else D.Sfx.play('click'); } })}<button class="btn sm" data-act="close">关闭（Tab）</button></div>`;
      el.querySelector('[data-act=close]').onclick = () => { el.remove(); hideTip(); if (S) S.lootOpen = null; };
      X.retip();
    };
    state._render = render;
    render();
  };
  // ── 据点站的商人（收货按原价五成，黑市六成）
  // 各种商人卖什么、收货打几折：mult 乘的是原价（D.baseValue，不按品质打折、不跟交易行行情；用户 2026-11-17：卖给商人只拿原价 50% 左右），黑市六成
  // 买价整体乘 D.BUY_UP（price.js）；写死的消耗品、背包价钱再乘 D.listUp（装备 ×10、消耗品 ×5；卡按 cardPrice、弹药按 baseValue，已经涨过）
  function traderStock(S) { const T = traderStock0(S); T.list = T.list.map(([id, n, p]) => [id, n, Math.round(p * (D.BUY_UP || 1) * (id.startsWith('card:') || !D.listUp ? 1 : D.listUp(id)))]); return T; }
  function traderStock0(S) {
    const R = S.raid, pf = R.pf, type = S.st.type, cal = D.gunCal(R) || 'nail', ammo = (t, k) => { const id = 'ammo:' + cal + ':' + t, n = D.CALIBER[cal].pack; return [id, n, Math.round((D.baseValue ? D.baseValue(id) : D.itemInfo(id).v) * n * k)]; };
    if (type === 'refuge') return { name: '流民营的小贩', mult: 0.5, list: [['use:patch', 3, 42], ['use:medkit', 1, 48], ammo(1, 1.3), ammo(2, 1.3), ['use:cell', 1, 66], ['use:frag', 1, 55]] };
    if (type === 'blackmarket') {
      const rng = D.rng('bm:' + S.st.id + ':' + pf.raids), cards = rng.shuffle(Object.keys(D.CARDS).filter(k => !D.CARDS[k].free && D.CARDS[k].q >= 2 && D.CARDS[k].q <= 4)).slice(0, 3);
      return { name: '黑市商人', mult: 0.6, list: cards.map(k => ['card:' + k, 1, Math.round((D.cardPrice ? D.cardPrice(k) : D.CARDS[k].price) * 1.4)]).concat([ammo(3, 1.8), ['use:emp', 1, 95], ['use:freeze', 1, 85], ['bag:hike', 1, 900]]) };
    }
    return { name: '商人', mult: 0.5, list: [['use:patch', 3, 45], ['use:medkit', 1, 50], ['use:cell', 1, 70], ['use:frag', 1, 58]] };
  }
  // 卖给商人（用户 2026-11-15："卖给商人这里的 UI 设计参考取物界面，什么都可以卖，并且允许多选"）：两列——
  //   左边商人的货（像箱子）：单击买一件（先弹框）；
  //   右边背包、子弹袋、保险箱、门禁卡包（都能卖）：单击卖一组（先弹框），多选时（或按住 Ctrl / Shift 单击）是选上 / 取消。
  //   用户 2026-11-17："去除多选卖出台，放大右侧格子，保留多选功能"——中间那列卖出台删了，多选、已选几组和合计、清空、卖出所选挪到右边一列顶上一条；格子按空出来的地方放大。
  let shopMod = false; // 按住 Ctrl / Shift / Meta 单击 = 多选（格子的单击是松手时调的，拿不到键盘状态，按下时先记下来）
  X.hooks.init.push(r => r.addEventListener('pointerdown', ev => { shopMod = ev.ctrlKey || ev.metaKey || ev.shiftKey; }, true));
  U.trade = function (S) {
    const R = S.raid, pf = R.pf, host = $('.panel-slot'); if (!host) return;
    const T = traderStock(S), sell = e => Math.max(1, Math.round((D.baseValue ? D.baseValue(e.id) : D.itemInfo(e.id).v) * T.mult * e.n));
    const pouch = () => D.pouchR(R);
    const where = e => { const L = [['bag', R.bag], ['pouch', pouch()], ['safe', R.safe]]; if (R.keycase) L.push(['keycase', R.keycase]); for (const [key, g] of L) if (g.items.includes(e)) return { key, g, e }; return null; };
    host.innerHTML = ''; const el = document.createElement('div'); el.className = 'inv shop opening'; host.appendChild(el);
    const state = { trade: true, inv: true, sel: new Set(), multi: false }; S.lootOpen = state; el._state = state; // inv：关上时走取物页那样的收起动画（ui-bag.js）
    const picks = () => { const out = []; for (const e of [...state.sel]) { const p = where(e); if (p) out.push(p); else state.sel.delete(e); } return out; }; // 仓库里已经没了的去掉
    const opts = (key, g, accept) => Object.assign({ price: sell, click: e => {
      if (state.multi || shopMod) { if (state.sel.has(e)) state.sel.delete(e); else state.sel.add(e); D.Sfx.play('click'); render(); return; }
      const v = sell(e); D.Trade.raidSell(key, g, e, v, () => { pf.money += v; R.sold += v; GR().remove(g, e); state.sel.delete(e); render(); });
    } }, accept ? { accept } : {});
    const render = () => {
      if (S.lootOpen !== state) return;
      const P = picks(), tot = P.reduce((a, p) => a + sell(p.e), 0), O = D.Story && D.Story.traderOffer(pf), pc = pouch();
      // 右边一列约 428×262（舞台 640×360，去掉顶上那条和底下的提示）：背包 + 子弹袋一竖列，保险箱 + 门禁卡包一竖列，两列并排
      const kc = R.keycase, sideW = Math.max(R.safe.w, kc ? kc.w : 0), sideH = R.safe.h + (kc ? kc.h : 0);
      const cell = Math.max(12, Math.min(34, Math.floor(410 / Math.max(1, R.bag.w + sideW)), Math.floor(222 / Math.max(1, R.bag.h + pc.h, sideH))));
      const stock = T.list.map(([id, n, p]) => { const it = D.itemInfo(id), poor = pf.money < p; return `<div class="sh-t q${it.q} click" data-buy="${id}" data-n="${n}" data-p="${p}" ${X.tipAttr(id, n, '买价 ' + p + ' 金' + (poor ? '｜钱不够' : ''))}><img src="${infoIcon(it)}"><span class="sh-n">${esc(it.name)}</span>${n > 1 ? `<em>×${n}</em>` : ''}<b class="sh-p${poor ? ' poor' : ''}"><i class="ico-gold"></i>${p}</b></div>`; }).join('');
      el.innerHTML = `<div class="inv-top"><b>${esc(T.name)}</b><span>${T.mult > 0.5 ? '按原价六成收' : '按原价五成收'}，钱直接进账，死了也不丢</span><i>F / Esc 离开</i></div>
        <div class="inv-col ct"><div class="ct-h"><span class="ct-t"><b>商人的货</b><em>余额 ${pf.money}</em></span></div>
          <div class="sh-grid">${stock}</div><div class="hint">单击买一件（先弹框），买下放进背包。</div>
          <div class="ct-foot">${O ? `<button class="btn sm${pf.money < O.cost ? ' poor' : ''}" data-act="ask">${O.label} · ${O.cost}</button>` : ''}<button class="btn sm" data-act="close">离开（F）</button></div></div>
        <div class="inv-col pk" style="--cell:${cell}px"><div class="sel-bar"><button class="btn sm${state.multi ? ' on' : ''}" data-act="multi">多选</button><em class="sel-mode">${state.multi ? '多选中' : '单击即卖'}</em>
            <span class="sel-sum">已选 ${P.length} 组<b><i class="ico-gold"></i>${tot}</b></span>
            <button class="btn sm" data-act="clrsel"${P.length ? '' : ' disabled'}>清空</button><button class="btn sm primary" data-act="sellsel"${P.length ? '' : ' disabled'}>卖出所选</button></div>
          <div class="pk-grid"><div>
            <h4 class="pk-h">背包 <em>${D.bagUsed(R)}/${D.bagCap(R)} 格 · ${Math.round(D.bagValue(R))}</em></h4>${gridHTML('bag', R.bag, opts('bag', R.bag))}
            <h4 class="kc-h">子弹袋 <em>只放弹药</em></h4>${gridHTML('pouch', pc, opts('pouch', pc, e => D.isAmmo(e.id)))}</div>
          <div><h4 class="safe-h">保险箱 <em>死了也留着</em></h4>${gridHTML('safe', R.safe, opts('safe', R.safe))}
            ${R.keycase ? `<h4 class="kc-h">门禁卡包 <em>只放门禁卡</em></h4>${gridHTML('keycase', R.keycase, opts('keycase', R.keycase, e => D.isKey(e.id)))}` : ''}</div></div>
          <div class="hint">单击卖一组；多选或 Ctrl 单击：选上几组，一起卖。</div></div>`;
      P.forEach(p => { const c = el.querySelector(`.ggrid[data-g="${p.key}"] .gi[data-i="${p.g.items.indexOf(p.e)}"]`); if (c) c.classList.add('msel'); }); // 选中的格子描一圈
      el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => D.Trade.raidBuy(b, pf, R.bag, render)); // 先弹确认框（trade.js）
      el.querySelector('[data-act=close]').onclick = () => U.closePanel(S);
      el.querySelector('[data-act=multi]').onclick = () => { state.multi = !state.multi; if (!state.multi) state.sel.clear(); D.Sfx.play('click'); render(); };
      el.querySelector('[data-act=clrsel]').onclick = () => { state.sel.clear(); D.Sfx.play('click'); render(); };
      el.querySelector('[data-act=sellsel]').onclick = () => { const Q = picks(); if (!Q.length) return; const vals = Q.map(p => sell(p.e)); D.Trade.raidSellMany(Q, vals, () => { Q.forEach((p, i) => { pf.money += vals[i]; R.sold += vals[i]; GR().remove(p.g, p.e); }); state.sel.clear(); render(); }); };
      const ask = el.querySelector('[data-act=ask]'); if (ask) ask.onclick = () => D.Trade.raidAsk(ask, R, render);
      setTimeout(() => el.classList.remove('opening'), 520);
      X.retip();
    };
    state._render = render;
    render();
  };

  // ── 结算
  U.result = function (out, R) {
    U.clear(); root.className = 'm-over' + (out.ok ? ' won' : '');
    const list = (out.ok ? out.brought : out.lost).slice().sort((a, b) => D.itemInfo(b.id).q - D.itemInfo(a.id).q);
    root.innerHTML = `<div class="over-wrap">
      <h1>${out.ok ? '撤离成功' : '工壳损毁'}</h1>
      <div class="sub">${out.ok ? `接驳车驶出${esc(out.station)}。战利品进了南栈的仓库，弹药和药留在背包里；这个站以后也能当入口。` : `中继在${esc(out.station)}断开。背包、背包里的东西和装上的卡都留在了城里。`}</div>
      <div class="stats"><div><b>${R.stations}</b>站</div><div><b>${R.alert.toFixed(1)}</b>警戒</div><div><b>${Math.round(out.value)}</b>${out.ok ? '带回价值' : '损失价值'}</div>${R.sold ? `<div><b>${Math.round(R.sold)}</b>途中卖出</div>` : ''}</div>
      <div class="grid res">${list.slice(0, 18).map(e => itemTile(e.id, { n: e.n })).join('')}</div>
      ${!out.ok && out.safe.length ? `<div class="hint">保险箱保住了：${out.safe.map(id => D.itemInfo(id).name).join('、')}</div>` : ''}
      ${out.lostShell ? `<div class="hint warn">${D.SHELLS[out.lostShell].name}留在了城里。下次只能开租来的工壳，或者去机库再买一台。</div>` : ''}
      ${out.ok && out.cond != null && out.cond < 1 ? `<div class="hint">${D.SHELLS[R.shell].name}带伤回来（${Math.round(out.cond * 100)}%），去机库修一下。</div>` : ''}
      ${out.newEntry != null ? `<div class="hint ok big">解锁了新的出发站：<b>${esc(R.city.stations[out.newEntry].name)}</b>。以后在据点"出发"页能直接从这里进城</div>` : ''}
      ${U.resultGrowHTML ? U.resultGrowHTML(out) : ''}
      ${out.cut ? `<div class="hint">按约定，阿隼拿走了这趟的两成：-${out.cut}</div>` : ''}
      ${out.overflow ? `<div class="hint warn">仓库满了，有 ${out.overflow} 件放不下，按半价卖掉了（+${out.overflowSold || 0}）。下次出发前记得整理仓库。</div>` : ''}
      <div class="ov-foot"><button class="btn primary" data-act="back">回据点</button></div></div>`;
    $('[data-act=back]').onclick = () => { D.Sfx.play('click'); G.toHub('stash'); };
    const wrap = $('.over-wrap'); if (wrap.scrollHeight > wrap.clientHeight + 1) wrap.classList.add('ov-scroll'); // 提示太多要滚动：底下的"回据点"垫一条底栏，滚过去的字不从按钮两边露出来
    hideTip();
  };
  U.toast = function (text) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; root.appendChild(t); setTimeout(() => t.remove(), 1400); };
})(D);
