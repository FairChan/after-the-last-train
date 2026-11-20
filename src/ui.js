/* 末班之后 · 小样二：界面层（DOM）。尺寸单位 --u（按 384 宽排版），画布对齐的位置用 --s。
   格子背包：拖动放置，拖动中右键旋转，单击快速移到另一边，拖到同类上会叠在一起。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  let root, G;
  const U = D.UI = {};
  // 其他界面文件（ui-hub.js、ui-raid.js）用的钩子和公共小工具
  const hooks = { init: [], clear: [] };
  const GR = () => D.Grid;
  const iconURL = {};
  const url = k => iconURL[k] || (iconURL[k] = D.ICON[k] ? D.ICON[k].toDataURL() : '');
  const artURL = k => iconURL['art:' + k] || (iconURL['art:' + k] = (D.makeIcon(k) || document.createElement('canvas')).toDataURL());
  const infoIcon = it => it.art ? artURL(it.art) : url(it.icon);
  const cardIcon = c => c.art ? artURL(c.art) : url(c.icon);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
  U.init = (el, g) => {
    root = el; G = g; for (const f of hooks.init) f(el, g);
    root.addEventListener('mouseover', e => { const t = e.target instanceof Element ? e.target.closest('[data-tip]') : null; if (t && !drag) showTip(t); else hideTip(); });
    root.addEventListener('mouseleave', hideTip);
    addEventListener('pointermove', e => { lastPt = [e.clientX, e.clientY]; }, { passive: true }); // 记下鼠标在哪：界面原地重画以后用 retip() 把提示框补回来
    document.documentElement.addEventListener('mouseleave', () => { lastPt = null; hideTip(); });
    root.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    root.addEventListener('contextmenu', e => {
      if (drag) { e.preventDefault(); rotateDrag(); return; }
      const el = e.target instanceof Element ? e.target.closest('.gi[data-i]') : null; if (!el) return;
      const reg = grids[el.dataset.g]; if (!reg || !reg.opts.rclick) return;
      e.preventDefault(); const it = reg.g.items[+el.dataset.i]; if (it) { reg.opts.rclick(it); hideTip(); U.refresh(); }
    });
  };
  U.clear = () => { root.innerHTML = ''; root.className = ''; grids = {}; for (const f of hooks.clear) f(); };
  // 刷新会整页重画；先记下各个滚动区滚到哪，重画完再滚回去（买完东西不再跳回最上面）
  const scrollKey = (el, n) => el.tagName + '.' + el.className + '#' + n;
  function keepScroll(draw) {
    const seen = {}, saved = {};
    for (const el of root.querySelectorAll('*')) { const k = el.tagName + '.' + el.className, n = seen[k] = (seen[k] || 0) + 1; if (el.scrollTop > 0 || el.scrollLeft > 0) saved[scrollKey(el, n)] = [el.scrollTop, el.scrollLeft]; }
    draw();
    const seen2 = {}; if (!Object.keys(saved).length) return;
    for (const el of root.querySelectorAll('*')) { const k = el.tagName + '.' + el.className, n = seen2[k] = (seen2[k] || 0) + 1, s = saved[scrollKey(el, n)]; if (s) { el.scrollTop = s[0]; el.scrollLeft = s[1]; } }
  }
  U.refresh = () => keepScroll(() => { if (G.mode === 'hub') U.hub(G.pf, G.tab); else if (G.S && G.S.lootOpen && G.S.lootOpen._render) G.S.lootOpen._render(); });

  // ── 提示框（全界面一个，事件委托）
  let tipEl = null;
  function tipNode() { if (!tipEl || tipEl.parentNode !== root) { tipEl = document.createElement('div'); tipEl.className = 'tip'; root.appendChild(tipEl); } return tipEl; }
  // 物品（带 data-item）画成一张介绍卡片（ui-card.js）；别的还是一行字
  function showTip(el) {
    const tip = tipNode(), id = el.dataset.item;
    if (id && U.itemCard) { const c = U.itemCard(id, +el.dataset.n || 1, el.dataset.x || ''); tip.className = 'tip tcard'; tip.style.setProperty('--qc', c.col); tip.innerHTML = c.html; }
    else { tip.className = 'tip'; tip.style.removeProperty('--qc'); tip.textContent = el.dataset.tip; }
    tip.style.display = 'block';
    const b = el.getBoundingClientRect(), s = root.getBoundingClientRect(), k = s.width / root.offsetWidth || 1; // 舞台整体放大了 k 倍：屏幕像素 ÷ k = 界面像素
    const H = root.offsetHeight, th = tip.offsetHeight, below = (b.bottom - s.top) / k + 4, above = (b.top - s.top) / k - th - 4;
    tip.style.left = Math.round(Math.max(0, Math.min((b.left - s.left) / k, root.offsetWidth - tip.offsetWidth - 4))) + 'px';
    tip.style.top = Math.round(below + th <= H - 4 ? below : above >= 4 ? above : Math.max(4, H - th - 4)) + 'px'; // 下面放不下就放到上面
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
  // 面板原地重画（搜刮时每揭开一件、买卖之后、底栏数字变了）会换掉鼠标底下的元素；鼠标没动浏览器不会再发 mouseover，
  // 所以重画完看一眼光标下面现在是哪个元素：有提示就照样显示，没有就关掉
  let lastPt = null;
  function retip() {
    if (!lastPt || drag || !root) { hideTip(); return; }
    const n = document.elementFromPoint(lastPt[0], lastPt[1]), t = n && root.contains(n) && n.closest ? n.closest('[data-tip]') : null;
    if (t) showTip(t); else hideTip();
  }

  // 物品格子的提示：data-tip 是一行字（测试、读屏用），data-item 让提示框画成卡片；extra 是这一格特有的说明（｜分隔）
  function tipAttr(id, n, extra) { return `data-tip="${esc(tipOf(id, n) + (extra ? '｜' + extra : ''))}" data-item="${esc(id)}" data-n="${n || 1}"${extra ? ` data-x="${esc(extra)}"` : ''}`; }
  // 战斗用品（gear.js）：玻璃框 + 左上角用法
  const cmb = id => (U._ && U._.cmb ? U._.cmb(id) : { cls: '', html: '' });
  // ── 物品提示文字
  function tipOf(id, n) {
    const it = D.itemInfo(id), qn = D.QUALITY[it.q].name;
    if (it.kind === 'card') { const c = D.CARDS[it.card]; return `${c.name}【${qn}·${D.SLOT_NAME[c.slot]}】${c.desc}${c.gun ? '｜用' + D.CALIBER[c.gun.cal].name : ''}`; }
    if (it.kind === 'use') return `${it.name}【${qn}·消耗品】${it.desc}｜按 ${it.key} 使用${n > 1 ? '｜' + n + ' 个' : ''}`;
    if (it.kind === 'ammo') return `${it.name}【${qn}·弹药】伤害 ×${D.AMMO_TIER[it.tier].mul}｜${n} 发｜换弹时自动从背包拿，B 换弹种`;
    if (it.kind === 'bag') return `${it.name}【${qn}·背包】${it.desc}｜行动中单击换上`;
    if (it.kind === 'armor' && D.Armor) return D.Armor.tip(id);
    if (it.kind === 'clue') return `${it.name}【线索】${it.desc}`;
    if (it.kind === 'quest') return `${it.name}【委托物】${it.desc}｜价值 ${it.v}`;
    if (it.kind === 'att') return `${it.name}【${qn}·${D.ATT_SLOTS[it.slot]}配件】${it.desc}｜配装页单击装到当前的枪上｜价值 ${it.v}`;
    if (it.kind === 'rmod') return `${it.name}【${qn}·${D.RMOD_SLOTS[it.slot]}改装】${it.desc}｜配装页单击装到当前的型号上｜价值 ${it.v}`;
    if (it.kind === 'bp' || it.kind === 'job') return `${it.name}【${it.kind === 'bp' ? '蓝图' : '委托'}】${it.desc}`;
    if (D.isKey && D.isKey(id)) return `${it.name}【门禁卡】开${D.KEY_LEVEL[id]}级以下的门禁房和门禁柜，用一次就没了｜放进门禁卡包死了也不丢｜价值 ${it.v}`;
    return `${it.name}【${qn}·${D.CAT_NAME[it.cat]}】价值 ${it.v}${n > 1 ? ' ×' + n : ''}`;
  }

  // ── 格子组件
  let grids = {}, drag = null;
  // opts: { click(e), cell }
  function gridHTML(key, g, opts) {
    opts = opts || {};
    const firstHidden = g.items.find(e => e.seen === false), want = D.Growth && G && G.pf ? D.Growth.wanted(G.pf) : null; // 委托、设施升级要的材料打个标记
    let h = `<div class="ggrid" data-g="${key}" style="--gw:${g.w};--gh:${g.h}">`;
    g.items.forEach((e, i) => {
      const it = D.itemInfo(e.id), [w, hh] = GR().size(e), pos = `left:calc(${e.x} * var(--cell));top:calc(${e.y} * var(--cell));width:calc(${w} * var(--cell));height:calc(${hh} * var(--cell))`;
      if (e.seen === false) { h += `<div class="gi hidden${e === firstHidden ? ' searching' : ''}" style="${pos};--d:${i * 0.05}s"><b class="qm">?</b>${e === firstHidden ? '<i class="scanl"></i><div class="sbar"><i></i></div>' : ''}</div>`; return; }
      const price = opts.price ? opts.price(e) : null;
      const wy = want && want.get(e.id);
      const cm = cmb(e.id);
      h += `<div class="gi q${it.q}${cm.cls}${price != null ? ' priced' : ''}${e.pop ? ' pop' : ''}${e.r ? ' rot' : ''}${wy ? ' want' : ''}" data-g="${key}" data-i="${i}" style="${pos};--k:${Math.min(w, hh) >= 2 ? 2 : 1}" ${tipAttr(e.id, e.n, [wy, price != null ? '卖价 ' + price + ' 金' : ''].filter(Boolean).join('｜'))}><img src="${infoIcon(it)}">${cm.html}<span class="gname">${esc(it.name)}</span>${e.n > 1 ? `<b class="gn">${e.n}</b>` : ''}${price != null ? `<b class="gp"><i class="ico-gold"></i>${price}</b>` : ''}</div>`;
      e.pop = false;
    });
    grids[key] = { g, opts };
    return h + '</div>';
  }
  const cellPx = () => { const el = root.querySelector('.ggrid'); return el ? el.getBoundingClientRect().width / +el.style.getPropertyValue('--gw') : 20; };
  function onDown(ev) {
    const el = ev.target.closest && ev.target.closest('.gi[data-i]'); if (!el || ev.button !== 0) return;
    const key = el.dataset.g, reg = grids[key]; if (!reg) return;
    const e = reg.g.items[+el.dataset.i]; if (!e) return;
    const b = el.getBoundingClientRect(), c = b.width / GR().size(e)[0];
    drag = { key, e, el, sx: ev.clientX, sy: ev.clientY, moved: false, r: e.r || 0, ox: Math.floor((ev.clientX - b.left) / c), oy: Math.floor((ev.clientY - b.top) / c) };
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 5) {
      drag.moved = true; hideTip();
      drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('ghost'); root.appendChild(drag.ghost); drag.el.classList.add('dragging');
    }
    if (!drag.moved) return;
    const rb = root.getBoundingClientRect(), k = rb.width / root.offsetWidth || 1, c = cellPx() / k, it = D.itemInfo(drag.e.id), w = drag.r ? it.h : it.w, h = drag.r ? it.w : it.h;
    Object.assign(drag.ghost.style, { left: ((ev.clientX - rb.left) / k - (drag.ox + 0.5) * c) + 'px', top: ((ev.clientY - rb.top) / k - (drag.oy + 0.5) * c) + 'px', width: w * c + 'px', height: h * c + 'px' });
    const t = target(ev.clientX, ev.clientY);
    root.querySelectorAll('.gprev').forEach(p => p.remove());
    if (U.dragHover) U.dragHover(ev.clientX, ev.clientY, t ? null : drag.e, drag.key); // 拖到格子外面（装备槽、地上）：ui-bag.js
    if (t) {
      const ok = GR().free(t.reg.g, t.x, t.y, w, h, drag.e) || (() => { const hit = GR().at(t.reg.g, t.x, t.y); return hit && hit !== drag.e && hit.id === drag.e.id && it.stack > 1 && hit.n < it.stack; })();
      const p = document.createElement('div'); p.className = 'gprev ' + (ok ? 'ok' : 'bad');
      Object.assign(p.style, { left: `calc(${t.x} * var(--cell))`, top: `calc(${t.y} * var(--cell))`, width: `calc(${w} * var(--cell))`, height: `calc(${h} * var(--cell))` });
      t.el.appendChild(p);
    }
  }
  function target(cx, cy) {
    if (!drag) return null;
    for (const el of root.querySelectorAll('.ggrid')) {
      const b = el.getBoundingClientRect(); if (cx < b.left || cy < b.top || cx > b.right || cy > b.bottom) continue;
      const reg = grids[el.dataset.g]; if (!reg) continue;
      const c = b.width / reg.g.w;
      return { el, reg, key: el.dataset.g, x: Math.floor((cx - b.left) / c) - drag.ox, y: Math.floor((cy - b.top) / c) - drag.oy };
    }
    return null;
  }
  function rotateDrag() { const it = D.itemInfo(drag.e.id); if (it.w === it.h) return; drag.r = drag.r ? 0 : 1; [drag.ox, drag.oy] = [drag.oy, drag.ox]; D.Sfx.play('click'); }
  function onUp(ev) {
    if (!drag) return;
    const d = drag, t = d.moved ? target(ev.clientX, ev.clientY) : null; drag = null;
    root.querySelectorAll('.gprev').forEach(p => p.remove());
    if (d.ghost) d.ghost.remove();
    const src = grids[d.key];
    if (U.dragHover) U.dragHover(0, 0, null);
    if (!d.moved) { if (src && src.opts.click) { src.opts.click(d.e); U.refresh(); } return; }
    if (!t && src && U.dragDrop && U.dragDrop(ev.clientX, ev.clientY, d.key, src.g, d.e)) { U.refresh(); return; }
    if (t && src && (!t.reg.opts.accept || t.reg.opts.accept(d.e))) {
      if (GR().move(src.g, d.e, t.reg.g, t.x, t.y, d.r)) { D.Sfx.play('click'); if (src.opts.changed) src.opts.changed(); if (t.reg !== src && t.reg.opts.changed) t.reg.opts.changed(); }
      else D.Sfx.play('nope');
    }
    U.refresh();
  }

  // ── 买东西的入袋动画（试玩反馈汇总第 3 轮）：商品图标从格子上弹起、划一道弧落进仓库里那一格，落点闪一下；同时飘一个"-价钱"
  // 走 12 格的阶梯（steps），像素风不糊。r0 = 商品格子在屏幕上的位置（买之前量的，买完界面会重画）。
  U.flyBuy = function (r0, src, id, cost) {
    if (!root) return;
    const box = root.getBoundingClientRect(), k = box.width / (root.offsetWidth || box.width) || 1, L = r => ({ x: Math.round((r.left - box.left) / k), y: Math.round((r.top - box.top) / k), w: Math.round(r.width / k), h: Math.round(r.height / k) });
    const a = L(r0), items = G.pf.stash.items; let idx = -1; for (let i = items.length - 1; i >= 0; i--) if (items[i].id === id) { idx = i; break; }
    const dest = idx >= 0 && root.querySelector(`.ggrid[data-g="stash"] .gi[data-i="${idx}"]`), b = dest ? L(dest.getBoundingClientRect()) : (() => { const t = root.querySelector('.mk-col .scroll') || root.querySelector('.tb-gold'); return t ? L(t.getBoundingClientRect()) : { x: 40, y: 200, w: 20, h: 20 }; })();
    const fx = document.createElement('div'); fx.className = 'flybuy'; fx.innerHTML = src ? `<img src="${src}">` : ''; root.appendChild(fx);
    const S0 = 24, x0 = a.x + (a.w >> 1) - (S0 >> 1), y0 = a.y + 6, x1 = b.x + (b.w >> 1) - (S0 >> 1), y1 = b.y + (b.h >> 1) - (S0 >> 1), top = Math.min(y0, y1) - 40;
    const kf = []; for (let i = 0; i <= 12; i++) { const u = i / 12, x = Math.round(x0 + (x1 - x0) * u), y = Math.round((1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * top + u * u * y1), sc = i === 12 ? 0.6 : 1 + Math.sin(u * Math.PI) * 0.25; kf.push({ transform: `translate(${x}px, ${y}px) scale(${sc.toFixed(2)})`, offset: u }); }
    const an = fx.animate(kf, { duration: 520, easing: 'steps(12, end)', fill: 'forwards' });
    an.onfinish = () => { fx.remove(); if (dest && dest.isConnected) { dest.classList.remove('landed'); void dest.offsetWidth; dest.classList.add('landed'); } };
    const c = document.createElement('div'); c.className = 'flycost'; c.innerHTML = `<i></i>-${cost}`; c.style.left = (a.x + (a.w >> 1)) + 'px'; c.style.top = a.y + 'px'; root.appendChild(c);
    c.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -20px)', opacity: 0 }], { duration: 700, easing: 'steps(10, end)', fill: 'forwards' }).onfinish = () => c.remove();
    const gold = root.querySelector('.tb-gold'); if (gold) { gold.classList.remove('paid'); void gold.offsetWidth; gold.classList.add('paid'); }
  };
  function itemTile(id, o) { // 商店里的单格展示（不在格子里）
    o = o || {};
    if (id === 'intel') return `<div class="item q2 click" ${o.attr || ''} data-tip="情报：揭开 6 个未知站"><img src="${url('relay')}"><div class="it-name">情报</div><div class="it-sub">揭开 6 站</div><div class="it-price${o.poor ? ' poor' : ''}"><i></i>${o.price}</div></div>`;
    const it = D.itemInfo(id);
    const cm = cmb(id);
    return `<div class="item q${it.q}${cm.cls} click" ${o.attr || ''} ${tipAttr(id, o.n || 1)}><img src="${infoIcon(it)}">${cm.html}${o.n > 1 ? `<b class="it-size">×${o.n}</b>` : ''}<div class="it-name">${esc(it.name)}</div><div class="it-sub">${o.sub || D.QUALITY[it.q].name}</div>${o.price != null ? `<div class="it-price${o.poor ? ' poor' : ''}"><i></i>${o.price}</div>` : ''}</div>`;
  }
  function cardSlotHTML(key, id, label, sel) {
    const c = id ? D.CARDS[id] : null;
    return `<div class="slot${sel ? ' sel' : ''}${c ? ' q' + c.q : ' empty'}" data-slot="${key}" ${c ? tipAttr('card:' + id, 1, '右键卸下') : 'data-tip="空：在仓库里点一张这类卡装上"'}>
      <span class="sl-key">${label}</span>${c ? `<img src="${cardIcon(c)}"><div class="sl-name">${esc(c.name)}</div>` : '<div class="sl-name dim">空</div>'}</div>`;
  }

  const SKILL_ICON = { scan: 'relay', cloak: 'decoy', slam: 'slam', magnet: 'magnet', repair: 'recycler', hack: 'jam', mark: 'deadeye', swarm: 'wing' };
  // 图例：站点分类（和线路图上的图标一样）
  function legend() { const g = k => { const c = D.NODE_CAT[k]; return `<span><img src="${D.glyphURL(c.glyph, c.col, 32)}">${c.name}</span>`; }; return `<div class="legend">${['fight', 'elite', 'treasure', 'town', 'rest', 'event', 'relay'].map(g).join('')}<span><b class="lg-exit">撤离</b>线路尽头</span><span><b class="lg-q">?</b>隐藏站</span></div>`; }
  function stationCard(C, s, step) {
    const k = C.known.get(s.id), T = D.STATION_TYPES[s.type], ex = D.knownExit(C, s), cat = D.NODE_CAT[D.nodeCat(s)];
    const exitTxt = !ex ? '' : s.exit === 'hidden' && !s.reserve ? '隐藏撤离点：能在这里打撤离战撤出' : s.reserve ? '储备库：能在这里撤出' : '线路尽头 · 撤离站' + (C.entries.has(s.id) ? '（已解锁出发）' : '：撤出来一次，以后能从这里出发');
    const lines = s.hidden ? '<i class="ln" style="background:#5a5f78"></i>废弃支线' : s.lines.map(li => `<i class="ln" style="background:${D.LINE_COLORS[li]}"></i>${D.LINE_NAMES[li]}${D.LINE_THEMES ? '·' + D.LINE_THEMES[D.lineThemeKey(li)].name.slice(0, 2) : ''}`).join(' ');
    return `<div class="stcard"><div class="sc-name">${esc(k >= 1 || !s.hidden ? s.name : '？？？')}${s.home ? ' <em>据点</em>' : ''}${s.hidden ? ' <em class="hid">隐藏站</em>' : ''}</div><div class="sc-lines">${lines}</div>
      ${k >= 1 ? `<div class="sc-type"><img src="${D.glyphURL(cat.glyph, cat.col, 32)}"><b style="color:${cat.col}">${cat.name}</b> · ${T.name}<span class="sc-val" data-tip="离市中心越近东西越值钱">${'★'.repeat(D.valueStars(s))}<i>${'★'.repeat(4 - D.valueStars(s))}</i></span></div><div class="sc-desc">${T.desc}</div>${D.LAYOUTS && !s.home && !T.safe ? (() => { const L = D.LAYOUTS[D.layoutOf(s)], LT = D.LINE_THEMES[D.lineThemeOf(s)]; return `<div class="sc-desc"><b>${L.name}</b>：${L.desc}</div>${D.stationExtras ? D.stationExtras(s) : ''}${LT ? `<div class="sc-desc"><b style="color:${LT.col}">${LT.name}</b>：${LT.desc}</div>` : ''}`; })() : ''}` : '<div class="sc-type dim">未知。走到旁边一站就能打听到。</div>'}
      ${exitTxt ? `<div class="sc-exit"><b class="lg-exit">撤离</b>${exitTxt}</div>` : ''}${s.reserve && k >= 1 && D.Story && D.Game && D.Game.pf && !D.Story.canEnter(D.Game.pf, s) ? '<div class="sc-exit warn">闸门落着：要林桥做的解锁设备才进得去</div>' : ''}</div>`;
  }
  U.stationCard = stationCard;

  // ── 翻页（细格窗口：列表一屏放不下就分页，不出整页滚动条）。page(键, 条数, 每页) → 这一页的起止和翻页条；
  //    点 ◀ ▶ 或在 data-pgarea 的区域里滚滚轮都能翻
  const pages = {};
  function page(key, n, per) {
    const max = Math.max(1, Math.ceil(n / per)), p = Math.min(max - 1, Math.max(0, pages[key] | 0)); pages[key] = p;
    const dots = max <= 12 ? `<span class="pg-dots">${Array.from({ length: max }, (_, i) => `<i${i === p ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
    return { p, max, from: p * per, to: Math.min(n, p * per + per), html: max > 1 ? `<div class="pager" data-pager="${key}"><button data-pg="-1"${p ? '' : ' disabled'}>◀</button>${dots}<span>${p + 1} / ${max}</span><button data-pg="1"${p < max - 1 ? '' : ' disabled'}>▶</button></div>` : '' };
  }
  const setPage = (key, p) => { pages[key] = p; };
  function flip(key, d) { const was = pages[key] | 0; pages[key] = was + d; U.refresh(); if ((pages[key] | 0) !== was) D.Sfx.play('click'); }
  let wheelT = 0;
  hooks.init.push(r => {
    // 细格界面里图按原大或整数倍画：16px 的老图标（装备卡、技能）记一个 i16，样式表把它画成 32px，免得 28px 糊掉
    r.addEventListener('load', e => { const im = e.target; if (im.tagName === 'IMG' && im.naturalWidth === 16) im.classList.add('i16'); }, true);
    r.addEventListener('click', e => { const b = e.target instanceof Element && e.target.closest('[data-pg]'), w = b && b.closest('[data-pager]'); if (!w || b.disabled) return; e.stopPropagation(); flip(w.dataset.pager, +b.dataset.pg); });
    r.addEventListener('wheel', e => { const a = e.target instanceof Element && e.target.closest('[data-pgarea]'); if (!a || Math.abs(e.deltaY) < 4) return; e.preventDefault(); const now = performance.now(); if (now - wheelT < 160) return; wheelT = now; const k = a.dataset.pgarea, el = r.querySelector(`[data-pager="${k}"]`); if (el) flip(k, e.deltaY > 0 ? 1 : -1); }, { passive: false });
  });
  U._ = { hooks, GR, iconURL, url, artURL, infoIcon, cardIcon, esc, tipOf, tipAttr, hideTip, retip, gridHTML, itemTile, cardSlotHTML, SKILL_ICON, legend, stationCard, page, setPage };
})(D);
