/* 末班之后 · 小样二：选出发站页、行动中的线路图面板（试玩反馈二）
   据点"出发"页是单独的一页"选择出发站"：左边一列出发站卡片，右边地图只亮出发站。选好了"下一步：检查配装"。
   进城以后的线路图换成"行动中"的样子：顶上红色行动条，右边是下一站的卡片。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip, stationCard } = X;
  let root, G;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  const catImg = (s, sz) => { const c = D.NODE_CAT[D.nodeCat(s)]; return `<img class="cat" src="${D.glyphURL(c.glyph, c.col, sz || 32)}" alt="">`; };
  const stars = s => '★'.repeat(D.valueStars(s)) + '<i>' + '★'.repeat(4 - D.valueStars(s)) + '</i>';
  const lineChips = s => (s.hidden ? '<i class="ln" style="background:#6a5f90"></i>废弃支线' : s.lines.map(li => `<i class="ln" style="background:${D.LINE_COLORS[li]}"></i>${D.LINE_NAMES[li]}${D.LINE_THEMES ? '·' + D.LINE_THEMES[D.lineThemeKey(li)].name.slice(0, 2) : ''}`).join(' '));
  U.lineChips = lineChips; U.valueStarsHTML = stars; U.catImg = catImg;

  // ── 据点"出发"页：选出发站
  U.entryTab = function (pf, body) {
    // 出发站边栏可以收起（默认展开；点"收起"以后地图占满，只剩右上角一个"展开"按钮）
    if (G.entryFold === true) {
      body.innerHTML = `<button class="btn sm ep-open" data-fold>展开出发站 ◀</button>${X.legend()}`;
      body.querySelector('[data-fold]').onclick = () => { D.Sfx.play('click'); G.entryFold = false; U.refresh(); };
      return;
    }
    const C = pf.city, starts = D.startPoints(C), entries = starts.map(id => C.stations[id]);
    if (G.sel == null || !C.stations[G.sel] || G.sel === C.home) G.sel = starts[0] != null ? starts[0] : C.home;
    const sel = C.stations[G.sel], ok = starts.includes(sel.id), nearHome = id => C.stations[C.home].adj.has(id) && !C.entries.has(id);
    const locked = C.stations.filter(s => !s.dead && s.exit === 'fixed' && !C.entries.has(s.id)).length;
    const card = s => { const near = [...s.adj].map(n => C.stations[n]).filter(o => D.cityVisible(C, o) && C.known.get(o.id) >= 1);
      return `<button class="ep-card${s.id === sel.id ? ' on' : ''}" data-entry="${s.id}">${catImg(s)}<div class="ep-t"><div class="ep-name">${esc(s.name)}${nearHome(s.id) ? ' <em>南栈旁边</em>' : ' <em>线路尽头</em>'}</div>
        <div class="ep-lines">${lineChips(s)}</div><div class="ep-near"><span>价值 ${stars(s)}</span><span>旁边：${near.map(o => catImg(o, 24)).join('') || '—'}</span></div></div></button>`; };
    body.innerHTML = `<div class="entry-page"><div class="ep-head"><button class="btn sm ep-fold" data-fold>收起 ▶</button><h2>选择出发站</h2><div class="hint">确认出发后直接进这一站探索。可以从南栈旁边的站进城；走到线路尽头（地图上的绿色"撤离"牌）撤出来一次，那一站也能当出发站。</div></div>
      <div class="ep-list">${entries.map(card).join('')}</div>
      <div class="ep-locked">${locked ? `还有 <b>${locked}</b> 个线路尽头没解锁` : '所有线路尽头都解锁了'}${C.found && C.found.size ? ` · 找到隐藏撤离点 <b>${C.found.size}</b> 个` : ''}</div>
      <div class="ep-foot">${ok ? `<div class="ep-sel">从 <b>${esc(sel.name)}</b> 出发</div>` : `<div class="ep-sel warn">${sel.home ? '南栈是据点：选它旁边的一站出发' : esc(sel.name) + '还不能出发：南栈旁边的站，或者撤出来过的线路尽头才行'}</div>`}
        <button class="btn primary big${ok ? '' : ' poor'}" data-act="go">下一步：检查配装 ▶</button></div></div>
      ${ok ? '' : `<div class="ep-peek">${stationCard(C, sel)}</div>`}${X.legend()}`;
    body.querySelector('.ep-fold').onclick = () => { D.Sfx.play('click'); G.entryFold = true; U.refresh(); };
    body.querySelectorAll('[data-entry]').forEach(b => b.onclick = () => { G.sel = +b.dataset.entry; D.Sfx.play('click'); G.focusOn && G.focusOn(C.stations[G.sel]); U.hub(pf, 'map'); });
    body.querySelector('[data-act=go]').onclick = () => { if (ok) { D.Sfx.play('pick'); G.brief(sel.id); } else { D.Sfx.play('nope'); U.toast(sel.home ? '选南栈旁边的一站' : '先从这里撤出来一次'); } };
  };

  // ── 图鉴 · 物品：按分类看全部战利品
  U.itemCodex = function (pf, body, sw) {
    const cats = Object.keys(D.CAT_NAME), cat = cats.includes(G.itemCat) ? G.itemCat : cats[0];
    const list = Object.keys(D.ITEMS).filter(k => D.ITEMS[k].cat === cat && (!D.ITEMS[k].noLoot || D.ITEMS[k].line)).sort((a, b) => D.ITEMS[a].q - D.ITEMS[b].q || D.ITEMS[a].v - D.ITEMS[b].v);
    const total = Object.keys(D.ITEMS).filter(k => (!D.ITEMS[k].noLoot || D.ITEMS[k].line)).length;
    body.innerHTML = `<div class="stash codex items">${sw}<div class="st-head"><h3>物品</h3><span class="hint">城里能搜到的战利品，一共 <b>${total}</b> 种。越往市中心、品质越高的越常见。</span></div>
      <div class="cx-cats">${cats.map(c => `<button class="tab${c === cat ? ' on' : ''}" data-icat="${c}">${D.CAT_NAME[c]} <em>${Object.keys(D.ITEMS).filter(k => D.ITEMS[k].cat === c && (!D.ITEMS[k].noLoot || D.ITEMS[k].line)).length}</em></button>`).join('')}</div>
      ${(() => { const P = X.page('cx:item:' + cat, list.length, 40); return `<div class="cx-items" data-pgarea="cx:item:${cat}">${list.slice(P.from, P.to).map(k => X.itemTile(k, { sub: D.QUALITY[D.ITEMS[k].q].name + ' · ' + D.ITEMS[k].v })).join('')}</div>${P.html}`; })()}</div>`;
    body.querySelectorAll('[data-icat]').forEach(b => b.onclick = () => { D.Sfx.play('click'); G.itemCat = b.dataset.icat; U.refresh(); });
    body.querySelectorAll('[data-cxm]').forEach(el => el.onclick = () => { D.Sfx.play('click'); G.codexMode = el.dataset.cxm; U.refresh(); });
  };
  // ── 行动中：线路图上选下一站
  U.travel = function (R, hover) {
    U.clear(); root.className = 'm-travel';
    const C = R.city, at = C.stations[R.at], s = hover != null ? C.stations[hover] : null, can = s && D.canTravel(R, s.id), back = s && at.adj.has(s.id) && !can && R.visited.has(s.id);
    const found = C.justFound != null && R.visited.has(R.at) ? C.stations[C.justFound] : null; C.justFound = null;
    root.innerHTML = U.raidBarHTML(R) + `<div class="op-head"><b>行动中</b><span>第 ${R.step + 1} 站 · 选一个相邻的站走过去，走过的站不能回头</span></div>
      <div class="side op-side"><h3>在 ${esc(at.name)}</h3>
      ${found ? `<div class="hint ok">发现了隐藏撤离点：${esc(found.name)}！地图上已经标出来了</div>` : ''}
      ${s ? stationCard(C, s, R.step + 1) : '<div class="hint dim">鼠标移到发亮的站上看看</div>'}
      ${can ? `<button class="btn primary" data-act="go">走到 ${esc(s.name)}</button>` : back ? '<div class="hint warn">走过的站不能回头</div>' : s && D.deadEnd && D.deadEnd(R, s.id) ? '<div class="hint warn">那边是死路，走过去就撤不出去了</div>' : ''}
      <button class="btn" data-act="bag">背包</button></div>${X.legend()}`;
    const go = root.querySelector('[data-act=go]'); if (go) go.onclick = () => G.travelTo(s.id);
    root.querySelector('[data-act=bag]').onclick = () => U.bag(R);
    hideTip();
  };
})(D);
