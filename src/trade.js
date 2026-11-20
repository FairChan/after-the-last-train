/* Underdog：买卖确认框 + 买完的特效和音效（用户 2026-11-15："买下卖出需要弹出提示框决定，并且买完有特效和音效"）
   花钱买东西、把东西卖成钱的地方都先弹一个确认框：图标、名字、数量，价钱，余额从多少变成多少。
     交易行（买入、单击卖一组、卖掉杂物）、站里的商人（买、卖、打听）、机库（买型号、买涂装）、改枪台买配件、改装台买改装件。
   Enter / 空格 / 手柄 A 确认；Esc / 手柄 B / 点框外取消。设置"辅助与手柄"里能关（"买卖前确认"，默认开）。
   钱不够、放不下的时候不弹框，照旧"嘟"一声提示。
   买完：东西那里炸开一圈金色像素币 + 品质色方框光圈 + 飘"-价钱"，顶栏余额闪一下，配收银机的"叮——当"（sfx.js 的 buy）；
         买型号、涂装这种大件再盖一个"入手"字样。
   卖完：几枚像素币往上飘 + 飘"+价钱"，配硬币落袋声（sell）。
   框是等这次点击处理完（界面重画完）才弹出来的：点格子会马上重画整个界面，同步弹会被清掉。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, T = D.Trade = {};
  const G = () => D.Game, X = () => U._;
  const root = () => document.getElementById('ui');
  let keyH = null;

  // ── 确认框
  // o：{ kind: 'buy' | 'sell', id?（物品 id，自动取图标、名字、品质）, icon?, swatch?（涂装的两种颜色）, name?, q?, n?, sub?, price, note?, ok() }
  T.ask = function (o) {
    if (D.settings && D.settings.tradeConfirm === false) { o.ok(); return; }
    queueMicrotask(() => show(o));
  };
  function info(o) {
    const { infoIcon, url } = X(); let icon = o.icon, name = o.name, q = o.q, sub = o.sub;
    if (o.id === 'intel') { icon = icon || url('relay'); name = name || '情报'; q = q == null ? 2 : q; sub = sub || '揭开 6 个未知站'; }
    else if (o.id) { const it = D.itemInfo(o.id); icon = icon || infoIcon(it); name = name || it.name; q = q == null ? it.q : q; sub = sub || D.QUALITY[it.q].name; }
    return { icon, name, q, sub };
  }
  function show(o) {
    const r = root(), pf = G().pf; if (!r || !pf || !U.modal) { o.ok(); return; }
    const { esc } = X(), buy = o.kind === 'buy', f = info(o), money = pf.money, after = buy ? money - o.price : money + o.price;
    const col = f.q != null && D.QUALITY[f.q] ? D.QUALITY[f.q].col : 'var(--cream)';
    const pic = f.icon ? `<img src="${f.icon}">` : o.swatch ? `<i class="tr-sw" style="background:${o.swatch[0]};box-shadow:inset 0 -6px 0 ${o.swatch[1]}"></i>` : '<i class="tr-sw"></i>';
    const m = U.modal('trade' + (buy ? ' tr-buy' : ' tr-sell'), `<h3>${buy ? '买下？' : '卖出？'}</h3>
      <div class="tr-it" style="--qc:${col}">${pic}<div class="tr-nm"><span style="color:${col}">${esc(f.name || '')}</span>${o.n > 1 ? `<em>×${o.n}</em>` : ''}${f.sub ? `<span class="dim">${esc(f.sub)}</span>` : ''}</div></div>
      <div class="tr-row"><span>${buy ? '价格' : '卖价'}</span><b class="${buy ? 'tr-cost' : 'tr-gain'}"><i class="ico-gold"></i>${buy ? '-' : '+'}${o.price}</b></div>
      <div class="tr-row"><span>余额</span><b>${money}<em> → </em>${after}</b></div>
      ${o.note ? `<div class="hint">${esc(o.note)}</div>` : ''}
      <div class="mfoot"><button class="btn sm" data-act="close">取消（Esc）</button><button class="btn sm primary" data-act="ok">${buy ? '确认买下' : '确认卖出'}（Enter）</button></div>`);
    D.Sfx.play('click');
    const done = yes => { if (keyH) { removeEventListener('keydown', keyH, true); keyH = null; } if (!m.isConnected) return; m.remove(); if (yes) o.ok(); else { D.Sfx.play('click'); if (o.cancel) o.cancel(); } };
    m.querySelector('[data-act=ok]').onclick = () => done(true);
    m.querySelector('[data-act=close]').onclick = () => done(false);
    if (keyH) removeEventListener('keydown', keyH, true);
    keyH = e => {
      if (!m.isConnected) { removeEventListener('keydown', keyH, true); keyH = null; return; }
      e.stopImmediatePropagation(); // 框开着时按键不漏到底下（站里的 F / Esc 会关掉商人面板，据点的 Esc 会回首页）
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) done(true); }
      else if (e.code === 'Escape') { e.preventDefault(); done(false); }
    };
    addEventListener('keydown', keyH, true);
    if (D.Pad && D.Pad.on) { const b = m.querySelector('[data-act=ok]'); if (D.Pad.focus) D.Pad.focus.classList.remove('gp-focus'); D.Pad.focus = b; b.classList.add('gp-focus'); }
  }
  T.open = () => !!document.querySelector('#ui .modal.trade');

  // ── 特效：rect 是屏幕上的位置（getBoundingClientRect），换成 #ui 里的坐标（舞台整体缩放过）
  function local(rc) {
    const r = root(), box = r.getBoundingClientRect(), k = box.width / (r.offsetWidth || box.width) || 1;
    return { x: Math.round((rc.left - box.left) / k), y: Math.round((rc.top - box.top) / k), w: Math.round(rc.width / k), h: Math.round(rc.height / k) };
  }
  function bit(cls, x, y, html) { const el = document.createElement('div'); el.className = cls; el.style.left = x + 'px'; el.style.top = y + 'px'; if (html) el.innerHTML = html; root().appendChild(el); return el; }
  // o：{ price, q, stamp }
  T.fx = function (kind, rc, o) {
    const r = root(); if (!r || !rc) return; o = o || {};
    if (rc.getBoundingClientRect) rc = rc.getBoundingClientRect();
    const a = local(rc), cx = a.x + (a.w >> 1), cy = a.y + (a.h >> 1), buy = kind === 'buy';
    const col = o.q != null && D.QUALITY[o.q] ? D.QUALITY[o.q].col : '#ffd860';
    if (buy) {
      // 方框光圈：从东西那里往外扩两圈（框的大小跟着东西走；买型号、涂装这种大件更大）
      const big = !!o.stamp, side = Math.max(24, Math.min(big ? 120 : 64, Math.min(a.w, a.h) + 8));
      for (let j = 0; j < 2; j++) {
        const ring = bit('tfx-ring', cx, cy); ring.style.borderColor = j ? '#ffd860' : col; ring.style.width = ring.style.height = side + 'px';
        ring.animate([{ transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(' + (j ? 1.6 : 1.1) + ')', opacity: 0 }], { duration: 420 + j * 140, delay: j * 70, easing: 'steps(7, end)', fill: 'both' }).onfinish = () => ring.remove();
      }
      // 金色像素币：一圈炸开，往上飞一点再落下来
      const N = big ? 22 : 12, reach = big ? 2 : 1;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2 + (i % 2) * 0.2, d = (18 + (i * 7) % 16) * reach, dx = Math.round(Math.cos(ang) * d), dy = Math.round(Math.sin(ang) * d * 0.8) - 10;
        const c = bit('tfx-coin' + (i % 3 ? '' : ' big'), cx - 2, cy - 2);
        c.animate([{ transform: 'translate(0, 0)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px)`, opacity: 1, offset: 0.45 }, { transform: `translate(${Math.round(dx * 1.25)}px, ${dy + 22}px)`, opacity: 0 }], { duration: 620, delay: (i % 4) * 25, easing: 'steps(10, end)', fill: 'both' }).onfinish = () => c.remove();
      }
      if (o.stamp) {
        const s = bit('tfx-stamp', cx, a.y + Math.min(a.h >> 1, 40), o.stamp);
        s.animate([{ transform: 'translate(-50%, -50%) scale(2)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%, -70%) scale(1)', opacity: 0 }], { duration: 1100, easing: 'steps(14, end)', fill: 'both' }).onfinish = () => s.remove();
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const c = bit('tfx-coin', cx - 2 + (i - 2) * 5, cy - 2);
        c.animate([{ transform: 'translate(0, 0)', opacity: 1 }, { transform: `translate(${(i - 2) * 2}px, ${-18 - (i % 2) * 8}px)`, opacity: 0 }], { duration: 520, delay: i * 50, easing: 'steps(8, end)', fill: 'both' }).onfinish = () => c.remove();
      }
    }
    if (o.price) {
      const t = bit('flycost' + (buy ? '' : ' plus'), cx, a.y, `<i></i>${buy ? '-' : '+'}${o.price}`);
      t.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -20px)', opacity: 0 }], { duration: 760, easing: 'steps(10, end)', fill: 'forwards' }).onfinish = () => t.remove();
    }
    const gold = r.querySelector('.tb-gold'); if (gold) { gold.classList.remove('paid'); void gold.offsetWidth; gold.classList.add('paid'); }
  };
  T.done = function (kind, rc, o) { D.Sfx.play(kind === 'buy' ? 'buy' : 'sell'); T.fx(kind, rc, o); };

  // ── 各个入口（原来的按钮处理换成这几个）
  const rectOf = el => el && el.isConnected ? el.getBoundingClientRect() : null;
  const cellOf = (key, g, e) => { const i = g.items.indexOf(e); return i >= 0 ? document.querySelector(`#ui .ggrid[data-g="${key}"] .gi[data-i="${i}"]`) : null; };

  // 交易行买入：先算这次能买几份（钱、仓库空间），一份都买不了就照旧提示
  T.marketBuy = function (el) {
    const g = G(), pf = g.pf, id = el.dataset.buy, n = +el.dataset.n, price = +el.dataset.price, times = Math.max(1, g.buyQty || 1);
    const r0 = el.getBoundingClientRect(), img = el.querySelector('img'), src = img && img.src;
    let k = 0;
    if (id === 'intel') k = pf.money >= price ? 1 : 0;
    else { const t = D.Grid.clone(pf.stash); let m = pf.money; while (k < times && m >= price && D.Grid.add(t, id, n) === 0) { m -= price; k++; } }
    const go = () => { const m0 = pf.money; g.buy(id, n, price, times); if (pf.money < m0) { if (id !== 'intel' && U.flyBuy) U.flyBuy(r0, src, id, m0 - pf.money); T.fx('buy', r0, { q: info({ id }).q, price: U.flyBuy && id !== 'intel' ? 0 : m0 - pf.money }); } };
    if (!k) return go(); // 钱不够 / 放不下：G.buy 自己会提示
    T.ask({ kind: 'buy', id, n: id === 'intel' ? 1 : n * k, price: price * k, note: id === 'intel' ? '' : times > 1 ? (k < times ? `只能买 ${k} 份（${pf.money < price * (k + 1) ? '零件不够' : '仓库放不下'}），每份 ${price}` : `${k} 份，每份 ${price}`) + '，放进仓库' : '放进仓库', ok: go });
  };
  // 交易行卖一组
  T.marketSell = function (grid, e) {
    const g = G(), pf = g.pf; if (!e) return; const v = D.stackPrice(pf, e), q = info({ id: e.id }).q;
    T.ask({ kind: 'sell', id: e.id, n: e.n, price: v, note: '整组卖给交易行', ok: () => { const rc = rectOf(cellOf('stash', grid, e)); g.sellEntry(grid, e); T.fx('sell', rc, { price: v, q }); } });
  };
  // 交易行多选卖出（用户：卖出允许多选）：选好的几组一起卖，弹一次框
  T.marketSellMany = function (grid, list) {
    const g = G(), pf = g.pf; list = (list || []).filter(e => grid.items.includes(e)); if (!list.length) return;
    const v = list.reduce((s, e) => s + D.stackPrice(pf, e), 0), n = list.reduce((s, e) => s + (e.n || 1), 0), q = Math.max(...list.map(e => D.itemInfo(e.id).q || 0));
    const name = list.slice(0, 3).map(e => D.itemInfo(e.id).name).join('、') + (list.length > 3 ? '……' : '');
    T.ask({ kind: 'sell', id: list[0].id, name, q, n, sub: list.length + ' 组', price: v, note: '选中的几组一起卖给交易行', ok: () => {
      const rcs = list.map(e => rectOf(cellOf('stash', grid, e))), m0 = pf.money;
      for (const e of list) { pf.money += D.stackPrice(pf, e); D.Grid.remove(grid, e); }
      if (g.mkSel) g.mkSel.clear(); D.Sfx.play('sell'); U.refresh();
      rcs.forEach((rc, i) => T.fx('sell', rc, { price: i === 0 ? pf.money - m0 : 0, q }));
    } });
  };
  // 交易行"卖掉白色和绿色材料"
  T.marketJunk = function (btn) {
    const g = G(), pf = g.pf, list = D.Growth ? D.Growth.junk(pf) : pf.stash.items.filter(e => { const it = D.itemInfo(e.id); return it.kind === 'item' && it.q <= 1; });
    if (!list.length) return g.sellJunk();
    const v = list.reduce((s, e) => s + D.stackPrice(pf, e), 0), n = list.reduce((s, e) => s + e.n, 0);
    T.ask({ kind: 'sell', id: list[0].id, name: '白色和绿色材料', q: 1, n, sub: list.length + ' 组', price: v, note: '要用的已经留够了，多出来的整组卖掉', ok: () => { const rc = rectOf(btn); const m0 = pf.money; g.sellJunk(); if (pf.money > m0) T.fx('sell', rc, { price: pf.money - m0 }); } });
  };

  // 站里的商人：卖一组、买一样、打听。key / g 是这一组在哪个格子里（背包、子弹袋、保险箱、门禁卡包，ui-raid.js 的 U.trade 传进来）
  T.raidSell = function (key, g, e, v, sell) {
    T.ask({ kind: 'sell', id: e.id, n: e.n, price: v, note: '钱直接进账，死了也不丢', ok: () => { const rc = rectOf(cellOf(key, g, e)); sell(); T.done('sell', rc, { price: v }); } });
  };
  // 站里的商人多选卖出（用户：卖出允许多选）：选好的几组一起卖，弹一次框。picks：[{ key, g, e }]；vals：每组的卖价；sellAll() 真的卖（钱、格子、重画）
  T.raidSellMany = function (picks, vals, sellAll) {
    if (!picks.length) return; const v = vals.reduce((s, x) => s + x, 0), q = Math.max(...picks.map(p => info({ id: p.e.id }).q || 0)), n = picks.reduce((s, p) => s + (p.e.n || 1), 0);
    const name = picks.slice(0, 3).map(p => info({ id: p.e.id }).name).join('、') + (picks.length > 3 ? '……' : '');
    T.ask({ kind: 'sell', id: picks[0].e.id, name, q, n, sub: picks.length + ' 组', price: v, note: '选中的几组一起卖，钱直接进账', ok: () => {
      const rcs = picks.map(p => rectOf(cellOf(p.key, p.g, p.e))); sellAll(); D.Sfx.play('sell');
      rcs.forEach((rc, i) => T.fx('sell', rc, { price: i === 0 ? v : 0, q }));
    } });
  };
  T.raidBuy = function (el, pf, bag, render) {
    const id = el.dataset.buy, n = +el.dataset.n, p = +el.dataset.p;
    if (pf.money < p || !D.Grid.canAdd(bag, id, n)) { D.Sfx.play('nope'); render(); return; }
    const rc0 = el.getBoundingClientRect();
    T.ask({ kind: 'buy', id, n, price: p, note: '放进背包', ok: () => {
      const rc = rectOf(el) || rc0; if (pf.money < p || !D.Grid.canAdd(bag, id, n)) { D.Sfx.play('nope'); render(); return; }
      pf.money -= p; D.Grid.add(bag, id, n); render(); T.done('buy', rc, { price: p, q: info({ id }).q });
    } });
  };
  T.raidAsk = function (btn, R, render) {
    const o = D.Story.traderOffer(R.pf);
    if (!o || R.pf.money < o.cost) { D.Sfx.play('nope'); render(); return; }
    const rc = btn.getBoundingClientRect();
    T.ask({ kind: 'buy', name: o.label, q: 2, icon: X().url('relay'), sub: '一条线索', price: o.cost, ok: () => { if (D.Story.traderAsk(R)) T.done('buy', rc, { price: o.cost, q: 2 }); else D.Sfx.play('nope'); render(); } });
  };

  // 机库：买型号、买涂装
  T.buyShell = function (pf, k) {
    const S = D.SHELLS[k];
    if (pf.money < S.price) { D.Sfx.play('nope'); U.toast('零件不够'); U.refresh(); return; }
    const mini = D.shellEmblem ? D.shellEmblem(k) : document.querySelector(`#ui [data-hgmini="${k}"]`); let icon = null; try { icon = mini && mini.toDataURL(); } catch (e) { /* 画布还没画 */ }
    T.ask({ kind: 'buy', name: S.name, q: S.q, icon, sub: S.code + ' · ' + S.role, price: S.price, note: '买下后马上换成这台出战', ok: () => {
      const rc = rectOf(document.querySelector('#ui .hg-hero'));
      if (!D.buyShell(pf, k)) { D.Sfx.play('nope'); U.toast('零件不够'); U.refresh(); return; }
      D.pickShell(pf, k); U.toast('买下了' + S.name); U.refresh(); T.done('buy', rc, { price: S.price, q: S.q, stamp: '入手' }); D.Sfx.play('power');
    } });
  };
  T.buySkin = function (pf, k, sk) {
    const K = D.SKINS[sk];
    if (pf.money < K.price) { D.Sfx.play('nope'); U.toast('零件不够'); U.refresh(); return; }
    T.ask({ kind: 'buy', name: K.name, swatch: [K.tint, K.visor], sub: '涂装', price: K.price, note: '买下后所有型号都能用，先换到这台上', ok: () => {
      const rc = rectOf(document.querySelector('#ui .hg-hero'));
      if (!D.pickSkin(pf, k, sk)) { D.Sfx.play('nope'); U.toast('零件不够'); U.refresh(); return; }
      U.refresh(); T.done('buy', rc, { price: K.price, stamp: '入手' });
    } });
  };

  // 改枪台、改装台：买一件，买完直接装上（act 是原来的"扣钱、放进仓库、装上"）
  T.buyFit = function (el, id, price, note, act) {
    const pf = G().pf;
    if (pf.money < price) { D.Sfx.play('nope'); U.toast('零件不够'); return; }
    if (!D.Grid.canAdd(pf.stash, id, 1)) { D.Sfx.play('nope'); U.toast('仓库满了'); return; }
    const rc0 = el.getBoundingClientRect();
    T.ask({ kind: 'buy', id, price, note, ok: () => { if (pf.money < price || !D.Grid.canAdd(pf.stash, id, 1)) { D.Sfx.play('nope'); return; } act(); T.done('buy', rc0, { price, q: info({ id }).q }); } });
  };
})(D);
