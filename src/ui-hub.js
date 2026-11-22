/* 末班之后 · 小样二：标题、据点各页、机库、出发准备（从 ui.js 拆出来） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._;
  const { GR, iconURL, url, artURL, infoIcon, cardIcon, esc, tipOf, hideTip, gridHTML, itemTile, cardSlotHTML, SKILL_ICON, legend, stationCard } = X;
  let root, G;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
  X.hooks.clear.push(() => { if (portraitRAF) { cancelAnimationFrame(portraitRAF); portraitRAF = 0; } });
  // ── 交易行 · 买入：上面一排分类，下面一行一件（图标、名字、一句说明、价钱），完整说明在悬停提示里
  const BUY_CATS = [['supply', '补给', '药、手雷、情报'], ['shield', '护盾', '一到四级护甲、护盾电池、护盾模块、护盾发生器'], ['ammo', '弹药', '七种口径、一到三级（四级、五级在工坊用蓝图做）；当前这把枪用的排在最前'], ['arms', '武器', '枪和近战'], ['mods', '模块', '模块（Q / E）和被动'], ['gear', '配件', '枪械配件和机器人改装件'], ['bags', '背包', '背包和门禁卡']];
  const buyCat = id => D.isShieldGoods && D.isShieldGoods(id) ? 'shield' : id === 'intel' || id.startsWith('use:') ? 'supply' : id.startsWith('ammo:') ? 'ammo' : id.startsWith('card:') ? (/^(gun|melee)$/.test(D.CARDS[id.slice(5)].slot) ? 'arms' : 'mods') : id.startsWith('bag:') || (D.isKey && D.isKey(id)) ? 'bags' : 'gear';
  function buySub(o, trend, gunCal) {
    const id = o.id;
    if (id === 'intel') return '揭开 6 个未知站';
    if (id.startsWith('use:')) { const u = D.USE[id.slice(4)]; return u.key + ' · ' + (u.heal ? '回 ' + u.heal + ' 耐久' : u.shield ? '+' + u.shield + ' 护盾' : u.buff ? '兴奋 ' + u.buff + ' 秒' : u.throw ? '投掷' : D.QUALITY[u.q].name); }
    if (id.startsWith('ammo:')) return '×' + o.n + ' 发' + (id.split(':')[1] === gunCal ? ' · <em class="cur">当前枪</em>' : '') + ' ' + trend(id);
    if (id.startsWith('card:')) { const c = D.CARDS[id.slice(5)]; return D.SLOT_NAME[c.slot] + (c.gun ? ' · ' + D.CALIBER[c.gun.cal].name : c.cd ? ' · 冷却 ' + c.cd + ' 秒' : '') + ' ' + trend(id); }
    if (id.startsWith('bag:')) return '背包';
    if (D.Armor && D.Armor.is(id)) { const a = D.itemInfo(id); return `${a.lv} 级护甲 · 耐久 ${a.max}`; } // 护盾栏（workshop.js）
    if (D.isKey && D.isKey(id)) return '门禁卡';
    return D.QUALITY[D.itemInfo(id).q].name;
  }
  function buyColHTML(pf, trend) {
    const shop = D.shopList(pf), gc = D.loadGun(pf.load) && D.CARDS[D.loadGun(pf.load)].gun, gunCal = gc ? gc.cal : null;
    const cat = BUY_CATS.some(c => c[0] === G.buyCat) ? G.buyCat : 'supply';
    let list = shop.filter(o => buyCat(o.id) === cat);
    if (cat === 'ammo' && gunCal) list = list.filter(o => o.id.split(':')[1] === gunCal).concat(list.filter(o => o.id.split(':')[1] !== gunCal));
    const row = o => {
      const intel = o.id === 'intel', it = intel ? { name: '情报', q: 2 } : D.itemInfo(o.id), poor = pf.money < o.price;
      return `<div class="mkrow q${it.q}${X.cmb ? X.cmb(o.id).cls : ''}${poor ? ' poor' : ''}" data-buy="${o.id}" data-n="${o.n}" data-price="${o.price}" ${intel ? 'data-tip="情报：揭开 6 个未知站"' : X.tipAttr(o.id, o.n)}><img src="${intel ? url('relay') : infoIcon(it)}">${X.cmb ? X.cmb(o.id).html : ''}<b class="mr-n">${esc(it.name)}</b><span class="mr-s">${buySub(o, trend, gunCal)}</span><span class="mr-p"><i class="ico-gold"></i>${o.price}</span></div>`;
    };
    return `<div class="buy-top"><div class="wh">买入</div><span class="buy-qty">${[1, 5, 10].map(q => `<button class="btn sm${(G.buyQty || 1) === q ? ' on' : ''}" data-qty="${q}" data-tip="${esc('单击一次买 ' + q + ' 份')}">×${q}</button>`).join('')}</span></div>
      <div class="buy-cats">${BUY_CATS.map(([k, n, tip]) => `<button class="btn sm${k === cat ? ' on' : ''}" data-cat="${k}" data-tip="${esc(tip)}">${n}<em>${shop.filter(o => buyCat(o.id) === k).length}</em></button>`).join('')}</div>
      ${(() => { const P = X.page('buy:' + cat, list.length, 24); return `<div class="buy-list" data-pgarea="buy:${cat}">${list.slice(P.from, P.to).map(row).join('')}</div>${P.html}`; })()}`;
  }

  let mkMod = false; // 交易行：按住 Ctrl / Shift 单击 = 多选（格子的单击是 ui.js 在松手时调的，拿不到键盘状态，按下时先记下来）
  X.hooks.init.push(r => r.addEventListener('pointerdown', ev => { mkMod = ev.ctrlKey || ev.metaKey || ev.shiftKey; }, true));
  // ── 据点
  U.hub = function (pf, tab) {
    U.clear(); root.className = 'm-hub fine';
    tab = tab || 'map';
    if (tab === 'orders') { tab = 'market'; if (G) G.tab = 'market'; } // 求购单删了：老存档停在求购页的到交易行
    if (tab === 'load') { tab = 'stash'; if (G) G.tab = 'stash'; } // 配装并进了仓库：以前进配装的地方（改枪台、改装台回来、出发准备）都到仓库
    root.innerHTML = `<div class="topbar"><span class="tb-title">南栈</span>
      <div class="tb-gold"><i class="ico-gold"></i>${pf.money}</div>
      <div class="tabs">${[['map', '出发'], ['jobs', '委托'], ['npc', '人物'], ['clues', '线索'], ['shells', '机库'], ['fac', '设施'], ['workshop', '工坊'], ['stash', '仓库'], ['market', '交易行'], ['codex', '图鉴']].map(([k, n]) => `<button class="tab${k === tab ? ' on' : ''}" data-tab="${k}">${n}${(k === 'npc' && tab !== 'npc' && D.Story && D.Story.newCount(pf)) || (k === 'jobs' && tab !== 'jobs' && U.jobsReady && U.jobsReady(pf)) ? '<i class="tdot"></i>' : ''}</button>`).join('')}</div>
      <div class="tb-stat" data-tip="${esc('第 ' + (D.marketDay(pf) + 1) + ' 天 · 撤出 ' + pf.wins + ' 次 · 损毁 ' + pf.deaths + ' 次')}">第${D.marketDay(pf) + 1}天 撤${pf.wins} 毁${pf.deaths}</div><button class="tb-menu" data-act="menu">菜单</button></div>
      <div class="hub-body t-${tab}"></div>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { D.Sfx.play('click'); G.hubTab(b.dataset.tab); });
    $('[data-act=menu]').onclick = () => { D.Sfx.play('click'); U.hubMenu(); };
    const body = $('.hub-body');
    if (tab === 'map') { U.entryTab(pf, body); // 选出发站（ui-route.js）
    } else if (tab === 'npc' || tab === 'clues') { U.storyTab(pf, body, tab); // 主线（ui-story.js）
    } else if (tab === 'jobs') { U.jobsTab(pf, body); // 委托板（ui-growth.js）
    } else if (tab === 'fac') { U.facTab(pf, body); // 设施、工作台（ui-growth.js）
    } else if (tab === 'workshop' && U.workshop) { U.workshop(pf, body); // 工坊：蓝图册、做四级五级弹药（ui-workshop.js）
    } else if (tab === 'gunsmith') { U.gunsmith(pf, body); // 改枪台（ui-gunsmith.js）
    } else if (tab === 'modbay') { U.modbay(pf, body); // 机库改装台（ui-modbay.js）
    } else if (tab === 'shells') { U.hangar(pf, body); // 机库：像选干员一样（ui-hangar.js）
    } else if (tab === 'stash') {
      // 仓库（用户：仓库和配装页合并成仓库）：左边装备槽，中间带进城的（背包、子弹袋、保险箱、门禁卡包），右边仓库格子和价值构成。
      // 以前的"配装"（tab 'load'）也进这一页；拖到槽位换装、拖回仓库卸下，都是原来配装页那一套（bindLoadDrag）
      const L = pf.load, sel = G.slotSel || 'gun', b = D.BAGS[L.bag], pe = !D.pouchOf(pf).items.length; // pe：子弹袋空着（空了就是一个"空"槽，单击弹出交易行卖弹药，ui-slotshop.js）
      const ownBags = Object.keys(D.BAGS).filter(k => D.BAGS[k].free || GR().count(pf.stash, id => id === 'bag:' + k) > 0 || k === L.bag);
      const gid = D.loadGun(L), gun = gid ? D.CARDS[gid].gun : null, have = gun ? D.kitAmmo(pf, gun.cal) : [0], haveS = gun ? GR().ammo(pf.stash, gun.cal) : [0]; // 两个槽都是近战就不用带子弹
      const total = GR().value(pf.stash, id => D.marketPrice(pf, id)), cells = e => { const s = GR().size(e); return s[0] * s[1]; }, used = pf.stash.items.reduce((a, e) => a + cells(e), 0);
      const byQ = [0, 1, 2, 3, 4, 5].map(q => { const Lq = pf.stash.items.filter(e => D.itemInfo(e.id).q === q); return { q, n: Lq.reduce((a, e) => a + (e.n || 1), 0), v: Lq.reduce((a, e) => a + D.stackPrice(pf, e), 0) }; }), vsum = Math.max(1, byQ.reduce((a, x) => a + x.v, 0));
      body.innerHTML = `<div class="loadout three store">
        <div class="slots wp">
          <div class="sl-group"><h4>武器 · 刀枪都能装</h4>${cardSlotHTML('gun', L.gun, '左键', sel === 'gun')}${cardSlotHTML('melee', L.melee, '右键', sel === 'melee')}</div>
          ${U.gearSlotsHTML ? U.gearSlotsHTML(pf) : ''}
          <div class="sl-group"><h4>模块</h4>${cardSlotHTML('q', L.q, 'Q', sel === 'q')}${cardSlotHTML('e', L.e, 'E', sel === 'e')}</div>
          <div class="sl-group"><h4>被动</h4>${[0, 1, 2].map(i => cardSlotHTML('pas' + i, L.pas[i], String(i + 1), sel === 'pas' + i)).join('')}</div>
          <div class="sl-group"><h4>背包</h4><div class="bagpick">${ownBags.map(k => `<button class="bagbtn q${D.BAGS[k].q}${k === L.bag ? ' on' : ''}" data-bag="${k}" data-tip="${esc(D.BAGS[k].name + '：' + D.BAGS[k].gw + '×' + D.BAGS[k].gh + ' 格' + (D.BAGS[k].free ? '（租的，不会丢）' : ''))}"><img src="${artURL('bag_' + k)}"><span>${D.BAGS[k].gw}×${D.BAGS[k].gh}</span></button>`).join('')}</div></div>
          <div class="sl-group"><h4>型号</h4><div class="shell-mini">${shellMini(pf)}</div></div>
          <div class="hint">点槽位：右边弹出交易行，能直接买、也能装仓库里有的；把仓库里的卡拖到槽位上也能换上，拖回仓库或右键卸下。<br>${gun ? `${D.CARDS[gid].name}用<b>${D.CALIBER[gun.cal].name}</b>：子弹袋和背包里 ${have.slice(1).reduce((a, c) => a + c, 0)} 发，仓库里 ${haveS.slice(1).reduce((a, c) => a + c, 0)} 发。` : '两个武器槽都是近战，不用带子弹。'}</div>
        </div>
        <div class="kitcol wp"><div class="wh">${b.name} · 带进城的东西</div>${gridHTML('kit', pf.kit, { click: e => { GR().move(pf.kit, e, pf.stash); D.Sfx.play('click'); } })}
          <h4 class="kc-h">子弹袋 <em>只放弹药 · 从左往右用 · 死了会丢</em></h4><div class="pouchbox${pe ? ' empty' : ''}" data-pouchshop="1" data-tip="${esc(pe ? '空：单击打开交易行，能直接买弹药，也能装仓库里有的' : '单击子弹袋里空的地方：右边弹出交易行，能直接买弹药')}">${gridHTML('pouch', D.pouchOf(pf), { accept: e => D.isAmmo(e.id), click: e => { GR().move(D.pouchOf(pf), e, pf.stash); D.Sfx.play('click'); } })}${pe ? '<span class="pb-empty">空 · 点开买弹药</span>' : ''}</div>
          <div class="kc-two"><div><h4 class="safe-h">保险箱 ${pf.safe.w}×${pf.safe.h} <em>死了也不丢</em></h4>${gridHTML('safe', pf.safe, { click: e => { GR().move(pf.safe, e, pf.stash); D.Sfx.play('click'); } })}</div>
            ${pf.keycase ? `<div><h4 class="kc-h">门禁卡包 <em>只放门禁卡</em></h4>${gridHTML('keycase', pf.keycase, { accept: e => D.isKey(e.id), click: e => { GR().move(pf.keycase, e, pf.stash); D.Sfx.play('click'); } })}</div>` : ''}</div>
          <div class="hint">单击仓库里的东西：卡装到选中的槽，弹药进子弹袋，门禁卡进卡包，别的放进背包。拖进保险箱的东西死了也不丢。单击这一列里的东西退回仓库。</div></div>
        <div class="stashcol wp"><div class="wh">仓库<em>${used} / ${pf.stash.w * pf.stash.h} 格</em><span class="st-worth">估值 <b>${Math.round(total)}</b></span></div>
          <div class="scroll">${gridHTML('stash', pf.stash, { click: e => stashClickLoad(pf, e) })}</div>
          <div class="st-qbar"><span class="sq-k">价值构成</span><i class="sq-stack">${byQ.filter(x => x.v > 0).map(x => `<i class="q${x.q}" style="width:${(x.v / vsum * 100).toFixed(1)}%"></i>`).join('')}</i></div>
          <div class="sq-leg">${byQ.map(x => `<span class="q${x.q}" data-tip="${esc(x.n + ' 件')}">${D.QUALITY[x.q].name}<b>${Math.round(x.v)}</b></span>`).join('')}</div>
          ${pf.log.length ? `<div class="st-log">${pf.log.slice(0, 3).map(l => `<span class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '撤出' : '损毁'} · ${esc(l.station)} · ${Math.round(l.value)}</span>`).join('')}</div>` : ''}</div></div>`;
      $$('[data-slot]').forEach(el => { el.onclick = () => { D.Sfx.play('click'); G.slotSel = el.dataset.slot; U.refresh(); }; el.oncontextmenu = ev => { ev.preventDefault(); if (!D.unequip(pf, el.dataset.slot)) U.toast('仓库满了'); D.Sfx.play('click'); U.refresh(); }; });
      $$('[data-bag]').forEach(el => el.onclick = () => { if (D.equipBag(pf, el.dataset.bag)) D.Sfx.play('power'); U.refresh(); });
      if (U.bindGearSlots) U.bindGearSlots(pf);
      bindLoadDrag(pf);
    } else if (tab === 'market') {
      const low = D.Growth ? D.Growth.junk(pf) : pf.stash.items.filter(e => { const it = D.itemInfo(e.id); return it.kind === 'item' && it.q <= 1; }), lv = low.reduce((s, e) => s + D.stackPrice(pf, e), 0);
      // 多选（用户：卖出允许多选）：选中的记在 G.mkSel（仓库里已经没了的去掉）
      const sel = G.mkSel || (G.mkSel = new Set()); for (const e of [...sel]) if (!pf.stash.items.includes(e)) sel.delete(e);
      const multi = !!G.mkMulti, selV = [...sel].reduce((s, e) => s + D.stackPrice(pf, e), 0), pickSel = e => { if (sel.has(e)) sel.delete(e); else sel.add(e); D.Sfx.play('click'); };
      const trend = id => { const t = D.marketTrend(pf, id); return Math.abs(t) < 0.03 ? '<em class="flat">持平</em>' : t > 0 ? `<em class="up">▲${Math.round(t * 100)}%</em>` : `<em class="down">▼${Math.round(-t * 100)}%</em>`; };
      body.innerHTML = `<div class="stash market"><div class="st-head"><h3>交易行</h3><span class="hint">单击仓库里的一组卖掉（整组）；开"多选"或按住 Ctrl 单击，可以选好几组一起卖。行情每趟一变。</span><button class="btn${low.length ? '' : ' poor'}" data-act="selllow">卖掉白色和绿色材料（留下要用的） · ${lv}</button></div>
        <div class="mk-cols"><div class="mk-col wp"><div class="wh">仓库<em>${multi ? '单击选上 / 取消' : '单击卖出 · Ctrl 单击多选'}</em><button class="btn sm mk-multi${multi ? ' on' : ''}" data-act="multi" data-tip="${esc('多选：单击选上或取消，选好了一起卖；不开多选时按住 Ctrl 单击也能选')}">多选</button></div><div class="scroll">${gridHTML('stash', pf.stash, { click: e => (multi || mkMod) ? pickSel(e) : D.Trade.marketSell(pf.stash, e), price: e => D.stackPrice(pf, e) })}</div>${multi || sel.size ? `<div class="mk-selbar"><span>已选 ${sel.size} 组</span><span class="mk-sv"><i class="ico-gold"></i>${Math.round(selV)}</span><button class="btn sm" data-act="clrsel"${sel.size ? '' : ' disabled'}>清空</button><button class="btn sm primary" data-act="sellsel"${sel.size ? '' : ' disabled'}>卖出所选</button></div>` : ''}</div>
        <div class="mk-col buy wp">${buyColHTML(pf, trend)}</div></div></div>`;
      $$('[data-buy]').forEach(el => el.onclick = () => D.Trade.marketBuy(el)); // 先弹确认框；买到了图标飞进仓库、炸一圈金币（trade.js）
      $$('[data-qty]').forEach(b => b.onclick = () => { G.buyQty = +b.dataset.qty; D.Sfx.play('click'); U.refresh(); });
      $('[data-act=selllow]').onclick = e => D.Trade.marketJunk(e.currentTarget);
      pf.stash.items.forEach((e, i) => { if (sel.has(e)) { const el = body.querySelector(`.ggrid[data-g="stash"] .gi[data-i="${i}"]`); if (el) el.classList.add('msel'); } }); // 选中的格子描一圈
      $('[data-act=multi]').onclick = () => { G.mkMulti = !multi; if (multi) sel.clear(); D.Sfx.play('click'); U.refresh(); };
      const ss = $('[data-act=sellsel]'); if (ss) ss.onclick = () => D.Trade.marketSellMany(pf.stash, [...sel]);
      const cs = $('[data-act=clrsel]'); if (cs) cs.onclick = () => { sel.clear(); D.Sfx.play('click'); U.refresh(); };
      $$('[data-cat]').forEach(b => b.onclick = () => { G.buyCat = b.dataset.cat; D.Sfx.play('click'); U.refresh(); });
    } else if (tab === 'codex' && G.codexMode === 'gear' && U.gearCodex) { U.gearCodex(pf, body, codexSwitch()); // 装备图鉴（gear.js）
    } else if (tab === 'codex' && G.codexMode === 'item') { U.itemCodex(pf, body, codexSwitch()); // 物品图鉴（ui-route.js）
    } else if (tab === 'codex' && G.codexMode === 'cont') {
      // 图鉴 · 容器：每种长什么样、出什么、在哪找
      const keys = Object.keys(D.CONT), sel = D.CONT[G.contSel] ? G.contSel : keys[0], C = D.CONT[sel];
      const rooms = Object.keys(D.ROOMS).filter(r => D.ROOMS[r].cont.some(([k]) => k === sel)).map(r => D.ROOMS[r].name);
      const speed = C.slow ? (C.slow < 1 ? '快' : C.slow > 1.15 ? '慢' : '一般') : '一般';
      const lean = C.pure ? '只出' : C.cats ? '偏向' : '', facts = [
        ['件数', C.n[0] + '–' + C.n[1] + ' 件'], ['格子', C.g[0] + '×' + C.g[1]], ['搜索', speed], ['品质', C.bonus ? '高 ' + C.bonus + ' 档' : C.qShift < 0 ? '偏低（偶尔捡漏）' : '看站点危险度'],
        ['东西', (C.cats ? lean + C.cats.map(c => D.CAT_NAME[c]).join('、') : '什么都有') + (C.ammo ? '，大多是弹药' : C.meds ? '，大多是药' : '') + (C.cards ? '，常有装备卡' : '')],
        ['在哪', C.where || (rooms.length ? rooms.join('、') : '敌人掉落')],
      ];
      const P = X.page('cx:cont', keys.length, 20);
      body.innerHTML = `<div class="stash codex">${codexSwitch()}<div class="cx-side wp"><div class="wh">容器<em>${keys.length}</em></div><div class="cx-list grid2" data-pgarea="cx:cont">${keys.slice(P.from, P.to).map(k => `<button class="cx-item${k === sel ? ' on' : ''}" data-ct="${k}"><img src="${contURL(k, 0)}"><span>${D.CONT[k].name}</span></button>`).join('')}</div>${P.html}</div>
        <div class="cx-page wp"><div class="cx-portrait two"><img src="${contURL(sel, 0)}"><img src="${contURL(sel, 1)}"></div><div class="cx-text"><h3>${C.name}${C.locked ? ' <em class="boss">上锁</em>' : C.pure ? ' <em>高价值</em>' : ''}</h3><div class="hint">${C.desc || ''}</div>
          <ul>${facts.map(([a, b]) => `<li><b>${a}</b>：${b}</li>`).join('')}</ul></div></div></div>`;
      $$('[data-ct]').forEach(el => el.onclick = () => { D.Sfx.play('click'); G.contSel = el.dataset.ct; U.refresh(); });
      $$('[data-cxm]').forEach(el => el.onclick = () => { D.Sfx.play('click'); G.codexMode = el.dataset.cxm; U.refresh(); });
    } else if (tab === 'codex') {
      const keys = Object.keys(D.ENEMIES), sel = G.codexSel || keys[0], E = D.ENEMIES[sel];
      const P = X.page('cx:enemy', keys.length, 20);
      body.innerHTML = `<div class="stash codex">${codexSwitch()}<div class="cx-side wp"><div class="wh">敌人<em>${keys.length}</em></div><div class="cx-list" data-pgarea="cx:enemy">${keys.slice(P.from, P.to).map(k => `<button class="cx-item${k === sel ? ' on' : ''}" data-cx="${k}"><img src="${enemyURL(k)}"><span>${D.ENEMIES[k].name}</span></button>`).join('')}</div>${P.html}</div>
        <div class="cx-page wp"><div class="cx-portrait"><img src="${enemyURL(sel)}"></div><div class="cx-text"><h3>${E.name}${E.elite ? ' <em>精英</em>' : E.boss ? ' <em class="boss">首领</em>' : ''}</h3><div class="hint">${E.tag} · 耐久 ${E.hp}</div>
          <ul>${E.moves.map(m => { const [a, b] = m.split('：'); return `<li><b>${a}</b>${b ? '：' + b : ''}</li>`; }).join('')}</ul></div></div></div>`;
      $$('[data-cx]').forEach(el => el.onclick = () => { D.Sfx.play('click'); G.codexSel = el.dataset.cx; U.refresh(); });
      $$('[data-cxm]').forEach(el => el.onclick = () => { D.Sfx.play('click'); G.codexMode = el.dataset.cxm; U.refresh(); });
    }
    X.retip();
  };
  // ── 型号头像：从主角图集里取一帧，按型号换色，放大成像素画
  let portraitRAF = 0;
  function portrait(k, dir, frame, scale) {
    const pf = G && G.pf, mods = pf && pf.shells[k] ? D.shellMods(pf, k) : null, H = D.heroOf ? D.heroOf(k, mods, ['idle' + dir]) : D.HERO, S = Object.assign({}, D.SHELLS[k], pf && D.shellLook(pf, k)), c = document.createElement('canvas');
    if (!H || !H.ready) { c.width = c.height = 8; return c; }
    const V = H.variant(S.tint, S.visor), sc = scale || 3, list = H.meta['idle' + dir], slot = list[frame % list.length];
    c.width = H.fw * sc; c.height = H.fh * sc; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const sx = (slot % H.cols) * H.fw, sy = Math.floor(slot / H.cols) * H.fh;
    x.drawImage(V.img, sx, sy, H.fw, H.fh, 0, 0, c.width, c.height); x.drawImage(V.emit, sx, sy, H.fw, H.fh, 0, 0, c.width, c.height);
    return c;
  }
  // 页面上所有 [data-portrait] 画布：待机动画，出发页那台慢慢转圈
  function animatePortraits() {
    const els = [...root.querySelectorAll('canvas[data-portrait]')]; if (!els.length) return;
    const t0 = performance.now();
    const tick = now => {
      if (!els[0].isConnected) { portraitRAF = 0; return; }
      const t = Math.max(0, (now - t0) / 1000);
      for (const el of els) { const k = el.dataset.portrait, spin = el.dataset.spin === '1', dir = spin ? [1, 2, 3, 4, 5, 6, 7, 8][Math.floor(t / 0.7) % 8] : 1, src = portrait(k, dir, Math.floor(t * 8), 1); const x = el.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, el.width, el.height); x.drawImage(src, 0, 0, el.width, el.height); }
      portraitRAF = requestAnimationFrame(tick);
    };
    if (portraitRAF) cancelAnimationFrame(portraitRAF);
    portraitRAF = requestAnimationFrame(tick);
  }
  X.shellStats = (pf, k) => shellStats(pf, k); // 机库（ui-hangar.js）也用
  function shellStats(pf, k) {
    const S = D.SHELLS[k], own = pf.shells[k], cond = own ? own.cond : 1, ext = D.bagExtra(k, null);
    const bar = (v, max, col) => `<i class="bar"><i style="width:${Math.round(Math.min(1, v / max) * 100)}%;background:${col}"></i></i>`;
    return `<div class="sh-stats"><div><b>耐久</b>${bar(S.hp * cond, 100, cond < 1 ? 'var(--amber)' : 'var(--red)')}<span>${Math.round(S.hp * cond)}/${S.hp}</span></div>
      <div><b>速度</b>${bar(S.speed - 60, 60, 'var(--cyan)')}<span>${S.speed}</span></div>
      <div><b>背包</b>${bar(6 + ext[0] + ext[1], 9, 'var(--green)')}<span>${ext[0] || ext[1] ? '+' + ext[0] + '列 +' + ext[1] + '行' : '标准'}</span></div></div>
      <div class="sh-skill"><img src="${url(SKILL_ICON[S.skill.k])}"><div><b>G · ${S.skill.name}</b> <em>冷却 ${S.skill.cd} 秒</em><br>${S.skill.desc}</div></div>
      <div class="sh-trait"><b>特性 · ${S.trait.name}</b>：${S.trait.desc}</div>`;
  }
  function shellMini(pf) { const k = D.shellOf(pf), S = D.SHELLS[k], c = pf.shells[k].cond; return `<b>${S.name}</b> ${S.role} · 耐久 ${Math.round(S.hp * c)}/${S.hp} · G ${S.skill.name}${D.mastLv ? ' · 熟练 ' + D.mastLv(pf, k) : ''}`; }

  // ── 出发准备：单独一页，整体看一遍这趟带什么、开哪台、从哪进
  U.brief = function (pf, entryId) {
    U.clear(); root.className = 'm-brief fine';
    const C = pf.city, st = C.stations[entryId], k = D.shellOf(pf), S = D.SHELLS[k], L = pf.load, b = D.BAGS[L.bag], ext = D.bagExtra(k, Object.fromEntries(L.pas.filter(Boolean).map(x => [x, 1])));
    const gid = D.loadGun(L), gun = gid ? D.CARDS[gid].gun : null, ammo = gun ? D.kitAmmo(pf, gun.cal).slice(1).reduce((s, c) => s + c, 0) : 1, meds = GR().count(pf.kit, id => id.startsWith('use:'));
    const owned = Object.keys(D.SHELLS).filter(x => pf.shells[x]), cond = pf.shells[k].cond, fix = D.repairCost(pf, k);
    const warn = [];
    if (gun && !ammo) warn.push('背包里没有' + D.CALIBER[gun.cal].name + '，进去只能拿近战打');
    if (!meds) warn.push('背包里没有药');
    if (cond < 0.6) warn.push(S.name + '只剩 ' + Math.round(cond * 100) + '% 耐久，最好先修');
    const exits = C.stations.filter(s => !s.dead && D.knownExit(C, s)).length;
    const slot = (id, label) => { const c = id ? D.CARDS[id] : null; return `<div class="bf-slot${c ? ' q' + c.q : ' empty'}" data-tip="${esc(c ? c.name + '：' + c.desc : '空')}"><span>${label}</span>${c ? `<img src="${cardIcon(c)}"><b>${esc(c.name)}</b>` : '<b class="dim">—</b>'}</div>`; };
    // 背包、保险箱、门禁卡包放在中间一列（内容宽 220 左右，留出滚动条）：三个能并排就并排（省高度），
    // 放不下就把保险箱和门禁卡包叠成一列；格子按宽度缩小（最小 12），别横着出界
    // 细格界面：中间一列内容宽 412，格子 30–36（物品图按原大 28 放得下）
    const kw = pf.kit.w, sw = pf.safe.w, cw = pf.keycase ? pf.keycase.w : 0, BW = 412, C0 = 30, C1 = 36;
    const rowCell = Math.floor((BW - (cw ? 32 : 16)) / (kw + sw + cw)), bagRow = rowCell >= 32;
    const cell = Math.max(C0, Math.min(C1, bagRow ? rowCell : Math.floor((BW - 16) / (kw + Math.max(sw, cw)))));
    const safeHTML = `<div><h4 class="safe-h">保险箱</h4>${gridHTML('safe', pf.safe, {})}</div>`, kcHTML = pf.keycase ? `<div><h4 class="kc-h">门禁卡包</h4>${gridHTML('keycase', pf.keycase, {})}</div>` : '';
    // 三列高度固定（640×360 舞台）：左、中两列内容多了就滚动；右列的难度和出发按钮钉在底下，站点说明再长也只是上面那块滚动
    root.innerHTML = `<div class="brief">
      <div class="bf-head"><span class="bf-kicker">出发准备</span><h2>从 ${esc(st.name)} 进城</h2><span class="bf-day">第 ${D.marketDay(pf) + 1} 天 · 余额 <b>${pf.money}</b></span></div>
      <div class="bf-cols">
        <div class="bf-col bf-shell">
          <div class="bf-portrait" data-tip="${owned.length > 1 ? '左右箭头换型号' : '去机库可以买别的型号'}"><canvas data-portrait="${k}" data-spin="1" width="192" height="192"></canvas><i class="scan"></i>
            ${owned.length > 1 ? '<button class="bf-arrow l" data-shift="-1">◀</button><button class="bf-arrow r" data-shift="1">▶</button>' : ''}
            <span class="bf-ctl">远程操控</span></div>
          <div class="sh-name bf-name"><span>${S.name}</span><em>${S.code}</em><span class="sh-role">${S.role}</span>${fix ? `<button class="btn sm bf-fix${pf.money < fix ? ' poor' : ''}" data-act="fix" data-tip="把耐久修满">修理 ${fix}</button>` : ''}</div>
          ${shellStats(pf, k)}
        </div>
        <div class="bf-col bf-kit">
          <h4>装备</h4><div class="bf-slots">${slot(L.gun, '左键')}${slot(L.melee, '右键')}${slot(L.q, 'Q')}${slot(L.e, 'E')}${L.pas.map(p => slot(p, '被动')).join('')}</div>
          <h4 class="bf-bagh">${b.name} ${b.gw}×${b.gh}${ext[0] || ext[1] ? ` <em class="ok">出发后 +${ext[0]}列 +${ext[1]}行</em>` : ''} · 子弹 ${ammo} · 药 ${meds}</h4>
          <div class="bf-bags${bagRow ? ' row' : ''}" style="--cell:${cell}px">${gridHTML('kit', pf.kit, {})}${bagRow ? safeHTML + kcHTML : `<div>${safeHTML}${kcHTML}</div>`}</div>
          <div class="bf-bags" style="--cell:${cell}px"><div><h4 class="kc-h">子弹袋</h4>${gridHTML('pouch', D.pouchOf(pf), {})}</div></div>
          ${warn.length ? `<div class="bf-warn">${warn.map(w => '! ' + esc(w)).join('<br>')}</div>` : ''}
          <div class="hint">撤出来：背包和装备全带回${S.free ? '' : '，' + S.name + '的伤要修'}。死在城里：背包、装上的卡${S.free ? '' : '和' + S.name}都丢，只剩保险箱。</div>
        </div>
        <div class="bf-col bf-entry">
          <h4>入口</h4>
          <div class="bf-info">${stationCard(C, st)}
            <div class="bf-facts"><div><b>${exits}</b>已知撤离站</div><div><b>${pf.wins}</b>撤出</div><div><b>${pf.deaths}</b>损毁</div></div></div>
          <div class="bf-act">
            <div class="bf-diff"><span>难度</span>${D.DIFF.map((d, i) => { const ok = D.diffUnlocked(pf, i); return `<button class="btn sm${(pf.diff | 0) === i ? ' on' : ''}${ok ? '' : ' poor'}" data-diff="${i}" style="--dc:${d.col}" data-tip="${esc(d.name + '：' + d.desc + (ok ? '' : '（' + d.need + '）'))}">${d.name}</button>`; }).join('')}</div>
            <button class="btn primary big" data-act="go">确认出发</button>
            <div class="bf-act2"><button class="btn" data-act="back" data-tip="回配装页调整装备和背包">返回配装</button><button class="btn" data-act="map">换入口</button></div>
          </div>
        </div>
      </div></div>`;
    $('[data-act=go]').onclick = () => { D.Sfx.play('power'); root.querySelector('.brief').classList.add('leaving'); setTimeout(() => G.departTo(entryId, pf.diff | 0), 380); };
    root.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { const i = +b.dataset.diff; if (!D.diffUnlocked(pf, i)) { D.Sfx.play('nope'); U.toast(D.DIFF[i].need); return; } pf.diff = i; D.Sfx.play('click'); U.brief(pf, entryId); });
    $('[data-act=back]').onclick = () => { D.Sfx.play('click'); G.toHub('load'); };
    $('[data-act=map]').onclick = () => { D.Sfx.play('click'); G.toHub('map'); };
    const fx = $('[data-act=fix]'); if (fx) fx.onclick = () => { if (D.repairShell(pf, k)) D.Sfx.play('heal'); else D.Sfx.play('nope'); U.brief(pf, entryId); };
    $$('[data-shift]').forEach(el => el.onclick = () => { const i = owned.indexOf(k), n = owned[(i + +el.dataset.shift + owned.length) % owned.length]; D.pickShell(pf, n); D.Sfx.play('click'); U.brief(pf, entryId); });
    animatePortraits(); X.retip();
  };

  // 仓库页单击仓库里的东西：门禁卡进卡包，卡就装到选中的槽，背包就换上，弹药进子弹袋，其余放进背包
  function stashClickLoad(pf, e) {
    const it = D.itemInfo(e.id);
    if (D.isKey(e.id) && pf.keycase && GR().move(pf.stash, e, pf.keycase)) { D.Sfx.play('click'); return; }
    if (U.gearClick && U.gearClick(pf, e)) return; // 配件、改装件直接装上
    if (D.isAmmo(e.id) && GR().move(pf.stash, e, D.pouchOf(pf))) { D.Sfx.play('click'); return; } // 弹药先进子弹袋
    if (it.kind === 'card') { const sel = G.slotSel || 'gun'; if (D.equip(pf, it.card, sel)) { D.Sfx.play('power'); return; } }
    if (it.kind === 'bag') { if (D.equipBag(pf, it.bag)) { D.Sfx.play('power'); return; } }
    if (!GR().move(pf.stash, e, pf.kit)) { U.toast('背包放不下'); D.Sfx.play('nope'); } else D.Sfx.play('click');
  }
  const enemyURL = k => { const key = 'enemy:' + k; if (iconURL[key]) return iconURL[key]; const spr = D.SPR[{ raider: 'raiderBody' }[k] || k]; const [c, x] = D.canvas(80, 64); if (k === 'raider') { x.drawImage(D.SPR.raiderBody.img, 40 - 11, 64 - 16 - 4); x.drawImage(D.SPR.raiderHead.img, 40 - 9, 64 - 16 - 4 - 13); } else if (spr) x.drawImage(spr.img, Math.round(40 - spr.w / 2), Math.round(60 - spr.h)); return (iconURL[key] = c.toDataURL()); };
  const codexSwitch = () => `<div class="cx-switch">${[['enemy', '敌人'], ['cont', '容器'], ['item', '物品'], ['gear', '装备']].map(([k, n]) => `<button class="tab${(G.codexMode || 'enemy') === k ? ' on' : ''}" data-cxm="${k}">${n}</button>`).join('')}</div>`;
  const contURL = (k, o) => { const key = 'cont:' + k + o; if (iconURL[key]) return iconURL[key]; const spr = (D.CSPR[k] || D.CSPR.crate)[o], img = spr.img, [c, x] = D.canvas(80, 64), s = Math.min(76 / img.width, 60 / img.height); x.imageSmoothingEnabled = false; x.drawImage(img, Math.round(40 - img.width * s / 2), Math.round(62 - img.height * s), Math.round(img.width * s), Math.round(img.height * s)); return (iconURL[key] = c.toDataURL()); };
  function loadMini(pf) {
    const L = pf.load, n = k => k ? D.CARDS[k].name : '—', am = k => { const g = D.isGun(k) && D.CARDS[k].gun; return g ? `（背包里 ${D.CALIBER[g.cal].name} ${D.kitAmmo(pf, g.cal).slice(1).reduce((s, c) => s + c, 0)} 发）` : ''; };
    const meds = GR().count(pf.kit, id => id.startsWith('use:'));
    return `<div><b>左键</b>${n(L.gun)}${am(L.gun)}</div><div><b>右键</b>${n(L.melee)}${am(L.melee)}</div><div><b>Q</b>${n(L.q)} <b>E</b>${n(L.e)}</div><div><b>被动</b>${L.pas.filter(Boolean).map(n).join('、') || '—'}</div><div><b>背包</b>${D.BAGS[L.bag].name} · 消耗品 ${meds} 个</div>${a ? '' : '<div class="warn">背包里没有子弹！去配装页放一些</div>'}`;
  }

  // ── 配装页拖动（用户：允许拖拽进行替换）
  //   仓库 / 背包格子里的卡拖到槽位 = 换上（原来那张退回仓库）；配件、改装件拖到对应的槽 = 装上；背包拖到"背包"那一栏 = 换包。
  //   槽位里的卡、配件、改装件拖回仓库 = 卸下；Q、E 之间、被动槽之间拖 = 对调。格子的拖动是 ui.js 那一套，这里接它的 dragHover / dragDrop。
  const onLoad = () => G && G.mode === 'hub' && (G.tab === 'stash' || G.tab === 'load'); // 仓库页（配装并进来了）
  const under = (cx, cy) => { const n = document.elementFromPoint(cx, cy); return n && n.closest ? n : null; };
  const HOT = '.loadout .hot, .loadout .bad';
  const clearHot = () => { if (root) root.querySelectorAll(HOT).forEach(n => n.classList.remove('hot', 'bad')); };
  const fitsSlot = (c, k) => !!c && (D.fitsWeapon(c, k) || ((k === 'q' || k === 'e') && c.slot === 'mod') || (k.startsWith('pas') && c.slot === 'pas'));
  const toStash = (pf, grid, e) => !grid || grid === pf.stash || GR().move(grid, e, pf.stash); // 从背包格子拖来的先放回仓库（装备都是从仓库里拿）
  // 一件东西拖到元素 n 上：落在哪个槽、能不能放、放了做什么
  function dropAction(pf, n, id, grid, e) {
    const it = D.itemInfo(id), s = n.closest('[data-slot]'), att = n.closest('[data-att]'), rm = n.closest('[data-rm]'), bp = n.closest('.bagpick');
    if (s) { const c = it.kind === 'card' && D.CARDS[it.card]; return { el: s, ok: fitsSlot(c, s.dataset.slot), go: () => toStash(pf, grid, e) && D.equip(pf, it.card, s.dataset.slot) }; }
    if (att) return { el: att, ok: it.kind === 'att' && D.ATT[it.att].slot === att.dataset.att, go: () => toStash(pf, grid, e) && D.loadGun(pf.load) && D.attach(pf, D.loadGun(pf.load), it.att) };
    if (rm) return { el: rm, ok: it.kind === 'rmod' && D.RMOD[it.rmod].slot === rm.dataset.rm, go: () => toStash(pf, grid, e) && D.fitMod(pf, D.shellOf(pf), it.rmod) };
    if (bp) return { el: bp, ok: it.kind === 'bag', go: () => toStash(pf, grid, e) && D.equipBag(pf, it.bag) };
    return null;
  }
  X.hooks.init.push(() => { // 等所有界面脚本都加载完再接（ui-bag.js 也接了这两个挂钩）
    const dh0 = U.dragHover, dd0 = U.dragDrop;
    U.dragHover = function (cx, cy, e, key) {
      if (dh0) dh0(cx, cy, e, key);
      clearHot(); if (!e || !onLoad()) return;
      const n = under(cx, cy), a = n && dropAction(G.pf, n, e.id); if (a) a.el.classList.add(a.ok ? 'hot' : 'bad');
    };
    U.dragDrop = function (cx, cy, key, grid, e) {
      if (dd0 && dd0(cx, cy, key, grid, e)) return true;
      if (!onLoad()) return false;
      const n = under(cx, cy), a = n && dropAction(G.pf, n, e.id, grid, e); if (!a) return false;
      if (!a.ok) { D.Sfx.play('nope'); return true; }
      if (a.go()) D.Sfx.play('power'); else { D.Sfx.play('nope'); U.toast('仓库满了，换不下来'); }
      return true;
    };
  });
  // 从槽位拖出来：自己画一个跟着鼠标的图标
  let sdrag = null;
  function bindLoadDrag(pf) {
    const L = pf.load, start = (el, kind, key, id) => el.addEventListener('pointerdown', ev => { if (ev.button !== 0) return; ev.preventDefault(); /* 槽位里是 <img>：不拦的话浏览器会开始自己的拖图片，后面的 pointermove / pointerup 都收不到 */ sdrag = { pf, el, kind, key, id, sx: ev.clientX, sy: ev.clientY, moved: false, ghost: null }; addEventListener('pointermove', slotMove); addEventListener('pointerup', slotUp, { once: true }); });
    $$('.loadout [data-slot]').forEach(el => { const k = el.dataset.slot, c = k.startsWith('pas') ? L.pas[+k.slice(3)] : L[k]; if (c && !D.CARDS[c].free) start(el, 'card', k, 'card:' + c); });
    $$('.loadout [data-att]').forEach(el => { const a = D.gunAtt(pf, D.loadGun(L) || 'nailgun')[el.dataset.att]; if (a) start(el, 'att', el.dataset.att, 'att:' + a); });
    $$('.loadout [data-rm]').forEach(el => { const m = D.shellMods(pf, D.shellOf(pf))[el.dataset.rm]; if (m) start(el, 'rm', el.dataset.rm, 'rmod:' + m); });
  }
  // 槽位拖到哪：仓库 = 卸下；同一类的另一个槽（Q / E、被动 1–3）= 对调
  function slotTarget(d, n) {
    if (!d || !n) return null;
    if (n.closest('.stashcol')) return { el: n.closest('.stashcol'), ok: true, go: () => d.kind === 'card' ? D.unequip(d.pf, d.key) : d.kind === 'att' ? D.detach(d.pf, D.loadGun(d.pf.load), d.key) : D.unfitMod(d.pf, D.shellOf(d.pf), d.key) };
    const s = n.closest('[data-slot]'); if (!s || d.kind !== 'card' || s.dataset.slot === d.key) return null;
    const to = s.dataset.slot, same = (to === 'q' || to === 'e') && (d.key === 'q' || d.key === 'e') || (to.startsWith('pas') && d.key.startsWith('pas')) || (D.isWeaponSlot(to) && D.isWeaponSlot(d.key)); // 左右键两把武器也能对调
    return { el: s, ok: same, go: () => { const L = d.pf.load, get = k => k.startsWith('pas') ? L.pas[+k.slice(3)] : L[k], set = (k, v) => { if (k.startsWith('pas')) L.pas[+k.slice(3)] = v; else L[k] = v; }, a = get(d.key); set(d.key, get(to)); set(to, a); return true; } };
  }
  function slotMove(ev) {
    const d = sdrag; if (!d) return;
    if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 5) {
      d.moved = true; hideTip(); d.el.classList.add('dragging');
      const it = D.itemInfo(d.id), g = document.createElement('div'); g.className = 'inv-ghost q' + it.q; g.innerHTML = `<img src="${infoIcon(it)}">`; root.appendChild(g); d.ghost = g;
    }
    if (!d.moved) return;
    const rb = root.getBoundingClientRect(), k = rb.width / root.offsetWidth || 1;
    d.ghost.style.left = Math.round((ev.clientX - rb.left) / k - 12) + 'px'; d.ghost.style.top = Math.round((ev.clientY - rb.top) / k - 12) + 'px';
    clearHot(); const t = slotTarget(d, under(ev.clientX, ev.clientY)); if (t) t.el.classList.add(t.ok ? 'hot' : 'bad');
  }
  function slotUp(ev) {
    removeEventListener('pointermove', slotMove);
    const d = sdrag; sdrag = null; if (!d) return;
    if (d.ghost) d.ghost.remove(); d.el.classList.remove('dragging'); clearHot();
    if (!d.moved) return; // 没拖动：还是原来的单击（选中槽位 / 打开改装台）
    const kill = e => { e.stopPropagation(); e.preventDefault(); }; addEventListener('click', kill, { capture: true, once: true }); setTimeout(() => removeEventListener('click', kill, true), 0); // 拖完松手不算单击
    const t = slotTarget(d, under(ev.clientX, ev.clientY));
    if (!t) return;
    if (!t.ok) { D.Sfx.play('nope'); return; }
    if (t.go()) D.Sfx.play('click'); else { D.Sfx.play('nope'); U.toast('仓库满了'); }
    U.refresh();
  }
})(D);
