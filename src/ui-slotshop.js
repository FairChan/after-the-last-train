/* Underdog：仓库页点左边的槽位，右边弹出交易行（用户 2026-11-15："点击左侧各个位置可以右侧弹出交易行价格，可以直接购买装备"）
   槽位：武器（左键 / 右键）、配件（枪口 / 弹匣 / 瞄具 / 枪托）、改装（装甲 / 动力 / 传感器）、护甲、模块 Q / E、被动 1–3、背包（后面多一个"+ 买"）。
   面板盖在仓库那一列上，从上到下：
     现在装着的；
     仓库里有的这一类（单击装上）；
     交易行在卖的这一类：名字、关键数值、涨跌、价钱（和交易行"买入"同一张价目表 D.shopList）。单击 → 确认框 → 买下直接装上，换下来的放回仓库。
   护甲：交易行卖一到四级（workshop.js 加的「护盾」栏）；五、六级只能在城里捡。
   再点一次同一个槽、右上角"回仓库"、或者按 Esc 就关上；离开仓库页也关上。
   改枪台 / 改装台照旧从左边的"改枪台 ▶""改装台 ▶"进。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI; if (!U) return;
  const X = () => U._, G = () => D.Game;
  const SLOT_LBL = { gun: ['主武器', '左键'], melee: ['副武器', '右键'], q: ['模块', 'Q'], e: ['模块', 'E'], pas0: ['被动', '1'], pas1: ['被动', '2'], pas2: ['被动', '3'], armor: ['护甲', ''], bag: ['背包', ''], pouch: ['子弹袋', ''] };
  const label = key => key.startsWith('att:') ? [D.ATT_SLOTS[key.slice(4)], '配件'] : key.startsWith('rm:') ? [D.RMOD_SLOTS[key.slice(3)], '改装'] : SLOT_LBL[key] || [key, ''];
  const isArmor = id => !!(D.Armor && D.Armor.is(id));

  // 这件东西能不能放进这个槽
  const cardFits = (c, key) => !!c && (D.fitsWeapon(c, key) || ((key === 'q' || key === 'e') && c.slot === 'mod') || (key.startsWith('pas') && c.slot === 'pas'));
  function fits(id, key) {
    if (key === 'pouch') return D.isAmmo(id); // 子弹袋：只放弹药
    if (key.startsWith('att:')) return id.startsWith('att:') && !!D.ATT[id.slice(4)] && D.ATT[id.slice(4)].slot === key.slice(4);
    if (key.startsWith('rm:')) return id.startsWith('rmod:') && !!D.RMOD[id.slice(5)] && D.RMOD[id.slice(5)].slot === key.slice(3);
    if (key === 'armor') return isArmor(id);
    if (key === 'bag') return id.startsWith('bag:') && !!D.BAGS[id.slice(4)];
    return id.startsWith('card:') && cardFits(D.CARDS[id.slice(5)], key);
  }
  // 现在装着的（物品 id）
  function current(pf, key) {
    const L = pf.load;
    if (key.startsWith('att:')) { const a = D.loadGun(L) && D.gunAtt(pf, D.loadGun(L))[key.slice(4)]; return a ? 'att:' + a : null; }
    if (key.startsWith('rm:')) { const m = D.shellMods(pf, D.shellOf(pf))[key.slice(3)]; return m ? 'rmod:' + m : null; }
    if (key === 'armor') return L.armor || null;
    if (key === 'bag') return 'bag:' + L.bag;
    const c = key.startsWith('pas') ? L.pas[+key.slice(3)] : L[key]; return c ? 'card:' + c : null;
  }
  // 已经装着（卡：装在任何一个槽上都算，免得同一张被动装两遍）
  function worn(pf, id, key) {
    if (key === 'pouch') return false; // 弹药是一堆一堆买的，买了不算"装着"
    if (id === current(pf, key)) return true;
    if (!id.startsWith('card:')) return false;
    const L = pf.load, k = id.slice(5); return L.gun === k || L.melee === k || L.q === k || L.e === k || L.pas.includes(k);
  }
  // 从仓库装上（卡、配件、改装件、背包都是按 id 从仓库里拿；护甲按格子里那一件）
  function equip(pf, e, key) {
    const id = e.id;
    if (key === 'pouch') return D.Grid.move(pf.stash, e, D.pouchOf(pf)); // 弹药放进子弹袋（袋满了就留在仓库）
    if (isArmor(id)) return !!(U.gearClick && U.gearClick(pf, e));
    if (id.startsWith('card:')) return D.equip(pf, id.slice(5), key);
    if (id.startsWith('att:')) return !!D.loadGun(pf.load) && D.attach(pf, D.loadGun(pf.load), id.slice(4));
    if (id.startsWith('rmod:')) return D.fitMod(pf, D.shellOf(pf), id.slice(5));
    if (id.startsWith('bag:')) return D.equipBag(pf, id.slice(4)) !== false;
    return false;
  }
  // 一行里的关键数值
  function sub(id, n) {
    if (id.startsWith('ammo:')) { const it = D.itemInfo(id); return '一盒 {0} 发 · 伤害 ×{1}'.replace('{0}', n || 1).replace('{1}', D.AMMO_TIER[it.tier].mul); }
    if (id.startsWith('card:')) {
      const c = D.CARDS[id.slice(5)];
      if (c.gun) return D.CALIBER[c.gun.cal].name + ' · 伤害 ' + c.gun.dmg + ' · 弹匣 ' + c.gun.mag;
      if (c.melee) return '伤害 ' + c.melee.dmg + ' · ' + c.desc;
      return c.cd ? '冷却 {0} 秒'.replace('{0}', c.cd) + ' · ' + c.desc : c.desc || '';
    }
    if (id.startsWith('bag:')) { const b = D.BAGS[id.slice(4)]; return b.gw + '×' + b.gh + ' 格'; }
    const it = D.itemInfo(id); return it.desc || D.QUALITY[it.q].name;
  }
  const trend = (pf, id) => { const t = D.marketTrend ? D.marketTrend(pf, id) : 0; return Math.abs(t) < 0.03 ? '' : t > 0 ? `<em class="up">▲${Math.round(t * 100)}%</em>` : `<em class="down">▼${Math.round(-t * 100)}%</em>`; };
  const shopFor = (pf, key) => D.shopList(pf).filter(o => fits(o.id, key)); // 护甲也卖一到四级（workshop.js）

  function panelHTML(pf, key) {
    const x = X(), { esc, infoIcon } = x, cmb = id => (x.cmb ? x.cmb(id) : { cls: '', html: '' }), [nm, tag] = label(key), cur = current(pf, key);
    const pc = key === 'pouch' ? D.pouchOf(pf) : null, pn = pc ? D.Grid.count(pc, () => true) : 0; // 子弹袋：没有"装着的那一件"，改成写袋里有多少发
    const curIt = cur && D.itemInfo(cur);
    const own = pf.stash.items.map((e, i) => [e, i]).filter(([e]) => fits(e.id, key));
    const list = shopFor(pf, key), have = id => D.Grid.count(pf.stash, z => z === id);
    const row = o => {
      const it = D.itemInfo(o.id), poor = pf.money < o.price, on = worn(pf, o.id, key), n = have(o.id), c = cmb(o.id);
      return `<div class="mkrow q${it.q}${c.cls}${poor ? ' poor' : ''}${on ? ' on' : ''}" data-ssbuy="${o.id}" data-price="${o.price}" data-ssn="${o.n}" ${x.tipAttr(o.id, 1, on ? '已经装着' : pc ? '单击买下，放进子弹袋' : '单击买下并装上')}><img src="${infoIcon(it)}">${c.html}<b class="mr-n">${esc(it.name)}</b><span class="mr-s">${esc(sub(o.id, o.n))} ${trend(pf, o.id)}</span>${on ? '<em class="ss-on">装着</em>' : n ? `<em class="ss-have">${'仓库有 {0}'.replace('{0}', n)}</em>` : ''}<span class="mr-p"><i class="ico-gold"></i>${o.price}</span></div>`;
    };
    const P = x.page('ss:' + key, list.length, 8);
    return `<div class="wh">交易行<em class="ss-k">${esc(nm)}</em>${tag ? `<em class="ss-t">${esc(tag)}</em>` : ''}<button class="btn sm ss-x" data-act="ssclose" data-tip="${esc('关上，回到仓库格子（Esc）')}">回仓库 ▶</button></div>
      ${pc ? `<div class="ss-cur"><span${pn ? '' : ' class="dim"'}>${esc(pn ? '袋里 {0} 发 · 从左往右用'.replace('{0}', pn) : '空')}</span><em>现在装着</em></div>` : `<div class="ss-cur${curIt ? ' q' + curIt.q : ''}"${curIt ? ' ' + x.tipAttr(cur, 1) : ''}>${curIt ? `<img src="${infoIcon(curIt)}"><b>${esc(curIt.name)}</b><span>${esc(sub(cur))}</span>` : '<span class="dim">空</span>'}<em>现在装着</em></div>`}
      <h4>仓库里有<em>${own.length}</em></h4>
      ${own.length ? `<div class="ss-own">${own.map(([e, i]) => { const it = D.itemInfo(e.id), c = cmb(e.id); return `<button class="q${it.q}${c.cls}" data-ssown="${i}" ${x.tipAttr(e.id, e.n, '单击装上')}><img src="${infoIcon(it)}">${c.html}${e.n > 1 ? `<b class="n">${e.n}</b>` : ''}</button>`; }).join('')}</div>` : '<div class="hint ss-none">仓库里没有这一类</div>'}
      <h4>交易行在卖<em>${list.length}</em></h4>
      <div class="buy-list ss-list" data-pgarea="ss:${key}">${list.slice(P.from, P.to).map(row).join('')}</div>${P.html}${key === 'armor' ? '<div class="hint ss-none">五级、六级护甲交易行不卖，只能在城里捡</div>' : ''}
      ${pc ? '<div class="hint ss-tip">单击一行：确认后买下，直接放进子弹袋；袋满了留在仓库。价钱跟交易行一样，每趟一变。</div>' : '<div class="hint ss-tip">单击一行：确认后买下直接装上，换下来的放回仓库。价钱跟交易行一样，每趟一变。</div>'}`;
  }

  function buy(pf, key, el) {
    const g = G(), id = el.dataset.ssbuy, price = +el.dataset.price, n = +el.dataset.ssn || 1, it = D.itemInfo(id), [nm] = label(key);
    if (worn(pf, id, key)) { D.Sfx.play('nope'); U.toast('已经装着了'); return; }
    if (pf.money < price) { D.Sfx.play('nope'); U.toast('零件不够'); return; }
    if (!D.Grid.canAdd(pf.stash, id, n)) { D.Sfx.play('nope'); U.toast('仓库放不下'); return; }
    const r0 = el.getBoundingClientRect();
    D.Trade.ask({ kind: 'buy', id, n, price, note: key === 'pouch' ? '买下后直接放进子弹袋，袋满了留在仓库' : '买下后直接装到{0}上，换下来的放回仓库'.replace('{0}', nm), ok: () => {
      const m0 = pf.money; g.buy(id, n, price, 1); if (pf.money >= m0) return;
      const e = pf.stash.items.find(z => z.id === id), done = !!e && equip(pf, e, key);
      if (key === 'pouch') U.toast(done ? '买到的子弹放进子弹袋了' : '买到了，子弹袋满了，留在仓库里');
      else if (done) U.toast('{0}装上了'.replace('{0}', it.name)); else U.toast('买到了，放在仓库里（换不下来）');
      U.refresh(); D.Trade.fx('buy', r0, { q: it.q, price: m0 - pf.money });
    } });
  }

  let last = null; // 上一次画的是哪个槽：刚打开时才放滑入动画
  function wire(pf) {
    const root = document.getElementById('ui'), store = root && root.querySelector('.store'); if (!store) { last = null; return; }
    const g = G(), esc = X().esc;
    const toggle = key => { D.Sfx.play('click'); g.slotShop = g.slotShop === key ? null : key; U.refresh(); };
    store.querySelectorAll('.slots [data-slot]').forEach(el => el.onclick = () => { g.slotSel = el.dataset.slot; toggle(el.dataset.slot); });
    store.querySelectorAll('.slots [data-att]').forEach(el => el.onclick = () => toggle('att:' + el.dataset.att));
    store.querySelectorAll('.slots [data-rm]').forEach(el => el.onclick = () => toggle('rm:' + el.dataset.rm));
    const ar = store.querySelector('.slots [data-armor]'); if (ar) ar.onclick = () => toggle('armor');
    // 悬停提示跟着改：单击是打开交易行
    store.querySelectorAll('.slots [data-slot], .slots [data-att], .slots [data-rm], .slots [data-armor]').forEach(el => {
      // 用 setAttribute：语言层在这里当场翻（dataset 要等兜底的 MutationObserver）
      if (el.dataset.item) el.setAttribute('data-x', '单击打开交易行 · ' + (el.getAttribute('data-x') || '右键卸下')); else el.setAttribute('data-tip', '空：单击打开交易行，能直接买，也能装仓库里有的');
    });
    const bp = store.querySelector('.bagpick');
    if (bp) { bp.insertAdjacentHTML('beforeend', `<button class="bagbtn bb-shop" data-ssbag="1" data-tip="${esc('交易行买背包')}"><b>+</b><span>买</span></button>`); bp.querySelector('[data-ssbag]').onclick = () => toggle('bag'); }
    // 子弹袋（用户 2026-11-17：没子弹时袋子变成"空"槽，单击弹出交易行卖弹药，和别的槽一样）：单击袋子里空的地方打开；点到弹药本身还是退回仓库
    const pb = store.querySelector('[data-pouchshop]');
    if (pb) pb.onclick = e => { if (e.target.closest && e.target.closest('.gi[data-i]')) return; toggle('pouch'); };
    const key = g.slotShop; if (!key) { last = null; return; }
    // 选中的槽亮一圈
    const sel = key.startsWith('att:') ? `[data-att="${key.slice(4)}"]` : key.startsWith('rm:') ? `[data-rm="${key.slice(3)}"]` : key === 'armor' ? '[data-armor]' : key === 'bag' ? '[data-ssbag]' : `[data-slot="${key}"]`;
    const se = key === 'pouch' ? pb : store.querySelector('.slots ' + sel); if (se) se.classList.add('ss-sel');
    const col = store.querySelector('.stashcol'); if (!col) return;
    const pop = document.createElement('div'); pop.className = 'slotshop' + (last === key ? '' : ' in'); pop.innerHTML = panelHTML(pf, key); col.appendChild(pop); last = key;
    pop.querySelector('[data-act=ssclose]').onclick = () => { D.Sfx.play('click'); g.slotShop = null; U.refresh(); };
    pop.querySelectorAll('[data-ssown]').forEach(b => b.onclick = () => {
      const e = pf.stash.items[+b.dataset.ssown]; if (!e) return; const nm = D.itemInfo(e.id).name;
      if (key === 'pouch') { if (equip(pf, e, key)) D.Sfx.play('click'); else { D.Sfx.play('nope'); U.toast('子弹袋满了'); } }
      else if (equip(pf, e, key)) { D.Sfx.play('power'); if (!isArmor(e.id)) U.toast('{0}装上了'.replace('{0}', nm)); } else { D.Sfx.play('nope'); U.toast('仓库满了，换不下来'); }
      U.refresh();
    });
    pop.querySelectorAll('[data-ssbuy]').forEach(r => r.onclick = () => buy(pf, key, r));
  }

  const hub0 = U.hub;
  U.hub = function (pf, tab) {
    const g = G(); if (g && tab !== 'stash' && tab !== 'load') g.slotShop = null;
    const r = hub0.apply(this, arguments);
    if (g && g.tab === 'stash') wire(pf); else last = null;
    return r;
  };
  // Esc 先关面板（不回首页）；有弹框时不管
  addEventListener('keydown', e => {
    const g = G(); if (e.code !== 'Escape' || !g || g.mode !== 'hub' || g.tab !== 'stash' || !g.slotShop || (U.modalOpen && U.modalOpen())) return;
    e.preventDefault(); e.stopImmediatePropagation(); D.Sfx.play('click'); g.slotShop = null; U.refresh();
  }, true);
  D.SlotShop = { fits, current, worn, shopFor }; // 一键测试用
})(D);
