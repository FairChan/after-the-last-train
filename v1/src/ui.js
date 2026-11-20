/* 末班之后 · 小样：界面层（DOM 叠在画布上，字是中文所以不画进像素画布）
   界面尺寸都乘 --px（按 384 宽排版的单位）；要和画布像素对齐的位置用 --s（画布倍数）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  let root, G;
  const U = D.UI = {};
  const iconURL = {};
  const url = k => iconURL[k] || (iconURL[k] = D.ICON[k] ? D.ICON[k].toDataURL() : '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  U.init = function (el, game) { root = el; G = game; };
  U.clear = function () { root.innerHTML = ''; root.className = ''; fightEls = null; };

  // ── 卡牌
  U.cardHTML = function (c, o) {
    o = o || {};
    return `<div class="card t-${c.type}${o.small ? ' small' : ''}${o.cls ? ' ' + o.cls : ''}" ${o.attr || ''}>
      <div class="c-top"><div class="c-cost">${c.cost}</div><div class="c-name">${esc(c.name)}</div></div>
      <div class="c-art"><img src="${url(c.icon)}" alt=""></div>
      <div class="c-type">${D.TYPE_NAME[c.type]}${c.exhaust ? ' · 消耗' : ''}</div>
      <div class="c-desc">${esc(c.desc)}</div>
      ${o.key ? `<div class="c-key">${o.key}</div>` : ''}
      ${o.price != null ? `<div class="c-price${o.poor ? ' poor' : ''}"><i></i>${o.price}</div>` : ''}
    </div>`;
  };
  function relicHTML(k, o) { const r = D.RELICS[k]; return `<div class="relic${o && o.big ? ' big' : ''}" data-tip="${esc(r.name + '：' + r.desc)}"><img src="${url(r.icon)}" alt=""></div>`; }

  // ── 顶栏（地图和非战斗页面）
  function topbar(run) {
    const rel = Object.keys(run.relics).map(k => relicHTML(k)).join('');
    return `<div class="topbar">
      <div class="tb-hp"><i class="ico-hp"></i>${Math.ceil(run.hp)}/${run.maxHp}</div>
      <div class="tb-gold"><i class="ico-gold"></i>${run.gold}</div>
      <div class="tb-relics">${rel}</div>
      <button class="tb-deck" data-act="deck">牌组 ${run.deck.length}</button>
    </div>`;
  }
  function bindCommon() {
    root.querySelectorAll('[data-tip]').forEach(el => {
      el.addEventListener('mouseenter', () => { tip.textContent = el.dataset.tip; tip.style.display = 'block'; const b = el.getBoundingClientRect(), s = root.getBoundingClientRect(); tip.style.left = (b.left - s.left) + 'px'; tip.style.top = (b.bottom - s.top + 4) + 'px'; });
      el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    });
    const tip = document.createElement('div'); tip.className = 'tip'; root.appendChild(tip);
    const deckBtn = root.querySelector('[data-act=deck]'); if (deckBtn) deckBtn.onclick = () => { D.Sfx.play('click'); U.deck(G.run, false); };
  }

  // ── 标题
  U.title = function () {
    U.clear(); root.className = 'm-title';
    root.innerHTML = `<div class="title-wrap">
      <div class="logo"><span class="l1">末班之后</span><span class="l2">AFTER THE LAST TRAIN</span></div>
      <div class="tagline">岚川沦陷第二十三年。你遥控一具租来的工壳，沿三号线一站站往下打。</div>
      <button class="btn primary" data-act="start">出发</button>
      <div class="seedrow">种子 <input id="seed" maxlength="12" spellcheck="false"></div>
      <div class="keys"><b>WASD</b> 移动 <b>鼠标</b> 瞄准 <b>左键</b> 扳手 <b>右键/空格</b> 闪避 <b>1–4</b> 出牌</div>
      <div class="ver">小样 · 第一条线</div>
    </div>`;
    const inp = root.querySelector('#seed'); inp.value = G.defaultSeed();
    root.querySelector('[data-act=start]').onclick = () => { D.Sfx.play('pick'); G.startRun(inp.value.trim() || G.defaultSeed()); };
  };

  // ── 地图
  U.map = function (run) {
    U.clear(); root.className = 'm-map';
    const m = run.map;
    const labels = Object.values(m.nodes).map(n => `<div class="st-name${n.type === 'boss' ? ' boss' : ''}" data-k="${n.k}" style="left:calc(${n.x}*var(--s)*1px);top:calc(${n.y + (n.type === 'boss' ? 10 : 5)}*var(--s)*1px)">${esc(n.name)}</div>`).join('');
    root.innerHTML = topbar(run) + `<div class="map-title"><span>岚川 · 三号线</span><em>选择下一站</em></div>${labels}<div class="map-legend">
      ${['fight', 'elite', 'shop', 'rest', 'treasure', 'boss'].map(t => `<span><img src="${url('node_' + t)}">${D.NODE_NAME[t]}</span>`).join('')}</div><div class="map-hover"></div>`;
    bindCommon();
    const reach = new Set(D.reachable(run).map(n => n.k));
    root.querySelectorAll('.st-name').forEach(el => el.classList.toggle('can', reach.has(el.dataset.k)));
  };
  U.mapHover = function (run, n) {
    const el = root.querySelector('.map-hover'); if (!el) return;
    if (!n) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = `calc(${Math.min(n.x + 10, 230)}*var(--s)*1px)`; el.style.top = `calc(${n.y - 30}*var(--s)*1px)`;
    const hints = { fight: '一组普通机器。打赢可选一张牌', elite: '工程机。更难，奖励改装件', shop: '花零件买牌、买改装件、删牌', rest: '回复耐久，或者改装一张牌', treasure: '一件随机改装件', boss: '钳工-9。打过它，这条线就通了' };
    el.innerHTML = `<b>${esc(n.name)}</b> · ${D.NODE_NAME[n.type]}<br><span>${hints[n.type]}</span>`;
  };

  // ── 战斗界面：手牌、电量、抽/弃牌堆
  let fightEls = null;
  U.fight = function (F) {
    U.clear(); root.className = 'm-fight';
    root.innerHTML = `<div class="banner"><b></b><span></span></div>
      <div class="hand-wrap">
        <div class="pile draw" data-tip="抽牌堆"><i></i><span>0</span></div>
        <div class="energy"></div>
        <div class="hand"></div>
        <div class="pile disc" data-tip="弃牌堆"><i></i><span>0</span></div>
      </div>
      <div class="reshuffle"><div class="rs-bar"></div><span>重整牌组</span></div>
      <div class="fight-relics">${Object.keys(F.run.relics).map(k => relicHTML(k)).join('')}</div>
      <div class="card-tip"></div>`;
    bindCommon();
    fightEls = { hand: root.querySelector('.hand'), energy: root.querySelector('.energy'), draw: root.querySelector('.pile.draw span'), disc: root.querySelector('.pile.disc span'), rs: root.querySelector('.reshuffle'), rsBar: root.querySelector('.rs-bar'), banner: root.querySelector('.banner'), tip: root.querySelector('.card-tip'), sig: '' };
  };
  U.fightUpdate = function (F) {
    const E = fightEls; if (!E) return;
    const sig = F.hand.map(c => c.name + c.cost).join('|');
    if (sig !== E.sig) {
      E.sig = sig;
      E.hand.innerHTML = F.hand.map((c, i) => U.cardHTML(c, { small: true, key: i + 1, attr: `data-i="${i}"` })).join('');
      E.hand.querySelectorAll('.card').forEach(el => {
        const i = +el.dataset.i;
        el.onmousedown = ev => { ev.stopPropagation(); G.queueCard(i); };
        el.onmouseenter = () => { const c = F.hand[i]; if (!c) return; E.tip.innerHTML = `<b>${esc(c.name)}</b> <em>${c.cost} 电</em><br>${esc(c.desc)}`; E.tip.style.display = 'block'; };
        el.onmouseleave = () => { E.tip.style.display = 'none'; };
      });
    }
    E.hand.querySelectorAll('.card').forEach(el => { const c = F.hand[+el.dataset.i]; el.classList.toggle('off', !c || F.energy < c.cost); });
    // 电量：整格亮，正在充的那格显示进度
    const n = F.eMax, full = Math.floor(F.energy), part = F.energy - full;
    let h = '';
    for (let i = 0; i < Math.max(n, Math.ceil(F.energy)); i++) h += `<div class="pip${i < full ? ' on' : ''}${i >= n ? ' over' : ''}">${i === full && part > 0 ? `<div class="fill" style="height:${Math.round(part * 100)}%"></div>` : ''}</div>`;
    if (E.energy._h !== h) { E.energy.innerHTML = h; E.energy._h = h; }
    E.draw.textContent = F.draw.length; E.disc.textContent = F.discard.length;
    E.rs.style.display = F.reshuffleT > 0 ? 'flex' : 'none';
    if (F.reshuffleT > 0) E.rsBar.style.width = Math.round((1 - F.reshuffleT / D.PLAYER.reshuffle) * 100) + '%';
    const b = D.banner;
    if (b) { E.banner.style.display = 'flex'; E.banner.style.opacity = b.a; E.banner.querySelector('b').textContent = b.text; E.banner.querySelector('span').textContent = b.sub; }
    else E.banner.style.display = 'none';
  };
  U.flashCard = function (i) { const el = fightEls && fightEls.hand.querySelector(`[data-i="${i}"]`); if (el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); } };

  // ── 奖励
  U.reward = function (run, R) {
    U.clear(); root.className = 'm-panel';
    root.innerHTML = topbar(run) + `<div class="panel">
      <h2>${R.boss ? '线路打通' : R.elite ? '精英已击毁' : '遭遇结束'}</h2>
      <div class="loot">
        <div class="loot-row gold"><i class="ico-gold"></i>${R.gold} 零件</div>
        ${R.relic ? `<div class="loot-row rel">${relicHTML(R.relic, { big: true })}<div><b>${D.RELICS[R.relic].name}</b><br>${D.RELICS[R.relic].desc}</div></div>` : ''}
      </div>
      <h3>选一张牌加入牌组</h3>
      <div class="choices">${R.cards.map((c, i) => U.cardHTML(c, { attr: `data-pick="${i}"`, cls: 'pickable' })).join('')}</div>
      <button class="btn" data-act="skip">跳过</button>
    </div>`;
    bindCommon();
    root.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => { D.Sfx.play('pick'); el.classList.add('chosen'); setTimeout(() => G.takeReward(+el.dataset.pick), 220); });
    root.querySelector('[data-act=skip]').onclick = () => { D.Sfx.play('click'); G.takeReward(-1); };
  };

  // ── 集市
  U.shop = function (run, S) {
    U.clear(); root.className = 'm-panel';
    root.innerHTML = topbar(run) + `<div class="panel wide">
      <h2>地下集市</h2><div class="sub">老鬼摊开一块油布："零件说话。"</div>
      <div class="choices shop">${S.cards.map((o, i) => o.sold ? '<div class="card sold"></div>' : U.cardHTML(o.card, { attr: `data-buy="${i}"`, cls: 'pickable', price: o.price, poor: run.gold < o.price })).join('')}</div>
      <div class="shop-row">
        ${S.relic && !S.relic.sold ? `<div class="shop-relic${run.gold < S.relic.price ? ' poor' : ''}" data-act="relic">${relicHTML(S.relic.k, { big: true })}<div><b>${D.RELICS[S.relic.k].name}</b><br>${D.RELICS[S.relic.k].desc}<div class="price"><i class="ico-gold"></i>${S.relic.price}</div></div></div>` : ''}
        ${!S.removed ? `<button class="btn${run.gold < S.removePrice ? ' poor' : ''}" data-act="remove">删一张牌 · ${S.removePrice} 零件</button>` : ''}
        <button class="btn primary" data-act="leave">离开</button>
      </div></div>`;
    bindCommon();
    root.querySelectorAll('[data-buy]').forEach(el => el.onclick = () => G.shopBuy(+el.dataset.buy));
    const rl = root.querySelector('[data-act=relic]'); if (rl) rl.onclick = () => G.shopRelic();
    const rm = root.querySelector('[data-act=remove]'); if (rm) rm.onclick = () => G.shopRemove();
    root.querySelector('[data-act=leave]').onclick = () => { D.Sfx.play('click'); G.toMap(); };
  };

  // ── 维修点
  U.rest = function (run) {
    U.clear(); root.className = 'm-panel';
    const heal = Math.round(run.maxHp * 0.3);
    root.innerHTML = topbar(run) + `<div class="panel">
      <h2>维修点</h2><div class="sub">一间还有电的配电室。只够做一件事。</div>
      <div class="rest-opts">
        <button class="rest-opt" data-act="heal"><img src="${url('plating')}"><b>维修</b><span>回复 ${heal} 点耐久</span></button>
        <button class="rest-opt" data-act="up"><img src="${url('calib')}"><b>改装</b><span>升级一张牌</span></button>
      </div></div>`;
    bindCommon();
    root.querySelector('[data-act=heal]').onclick = () => G.restHeal();
    root.querySelector('[data-act=up]').onclick = () => { D.Sfx.play('click'); U.deck(run, 'upgrade'); };
  };

  // ── 旧物
  U.treasure = function (run, k) {
    U.clear(); root.className = 'm-panel';
    root.innerHTML = topbar(run) + `<div class="panel">
      <h2>旧物</h2><div class="sub">倒在闸机边的回收箱，锁早就锈断了。</div>
      ${k ? `<div class="treasure">${relicHTML(k, { big: true })}<div><b>${D.RELICS[k].name}</b><br>${D.RELICS[k].desc}</div></div>` : '<div class="sub">箱子是空的。</div>'}
      <button class="btn primary" data-act="take">${k ? '拿走' : '离开'}</button></div>`;
    bindCommon();
    root.querySelector('[data-act=take]').onclick = () => G.takeTreasure();
  };

  // ── 牌组（查看 / 选一张升级 / 选一张删除）
  U.deck = function (run, mode) {
    const old = root.querySelector('.deck-view'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'deck-view';
    const list = run.deck.map((c, i) => ({ c, i })).filter(o => mode !== 'upgrade' || !o.c.up);
    el.innerHTML = `<div class="dv-head"><h2>${mode === 'upgrade' ? '选一张牌改装' : mode === 'remove' ? '选一张牌删掉' : '牌组'}</h2><button class="btn" data-act="close">${mode ? '取消' : '关闭'}</button></div>
      <div class="dv-grid">${list.map(o => U.cardHTML(mode === 'upgrade' ? D.card(o.c.id, true) : o.c, { attr: `data-i="${o.i}"`, cls: mode ? 'pickable' : '' })).join('')}</div>`;
    root.appendChild(el);
    el.querySelector('[data-act=close]').onclick = () => { D.Sfx.play('click'); el.remove(); };
    if (mode) el.querySelectorAll('[data-i]').forEach(c => c.onclick = () => { el.remove(); mode === 'upgrade' ? G.restUpgrade(+c.dataset.i) : G.shopRemoveCard(+c.dataset.i); });
  };

  // ── 结束
  U.over = function (run, won) {
    U.clear(); root.className = 'm-over' + (won ? ' won' : '');
    root.innerHTML = `<div class="over-wrap">
      <h1>${won ? '线路打通' : '工壳损毁'}</h1>
      <div class="sub">${won ? '钳工-9 倒在调度场。三号线的信号灯一盏盏亮回来。' : '中继断开。画面停在最后一帧，城里又多了一具残骸。'}</div>
      <div class="stats"><div><b>${run.stats.fights}</b>场战斗</div><div><b>${run.stats.kills}</b>台机器</div><div><b>${run.deck.length}</b>张牌</div><div><b>${Object.keys(run.relics).length}</b>件改装</div></div>
      <button class="btn primary" data-act="again">再来一趟</button>
    </div>`;
    root.querySelector('[data-act=again]').onclick = () => { D.Sfx.play('click'); U.title(); G.mode = 'title'; };
  };

  U.toast = function (text) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; root.appendChild(t); setTimeout(() => t.remove(), 1400);
  };
})(D);
