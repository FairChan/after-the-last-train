/* Underdog · 聚光灯（D.Spot）和据点导览（D.Tour）。设计：design/features/tutorial/design.md
   聚光灯：一层 DOM 暗幕挂在 body 上（position: fixed，不受 #ui 的缩放影响），中间挖一个洞框住要看的东西，框在呼吸，旁边一块说明牌。
     目标可以是画布上的界面（{ c: [x, y, w, h], an: [角 x, 角 y] }，640×360 的画布坐标，按"界面大小"从那个角缩放），也可以是 DOM 选择器（{ sel }，多个取并集）。
   站内：训练场每一步的 spot（tutorial.js），每帧跟着更新，不挡操作。
   据点：教学撤出后自动走一遍导览（每页聚光一个东西，上一页 / 下一页 / 跳过）；据点菜单里能重看。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const Spot = D.Spot = {};
  let layer = null, hole = null, tag = null, card = null, sig = '';
  const CSS = `
  .spot-layer { position: fixed; inset: 0; pointer-events: none; z-index: 9000; font-family: var(--f); }
  .spot-layer.block { pointer-events: auto; }
  .spot-hole { position: fixed; display: none; box-shadow: 0 0 0 2px #ffb057, 0 0 0 4px rgba(11,10,20,.9), 0 0 0 9999px rgba(4,5,12,.5); animation: spotPulse .8s ease-in-out infinite alternate; transition: left .2s, top .2s, width .2s, height .2s; }
  .spot-layer.block .spot-hole { box-shadow: 0 0 0 2px #ffb057, 0 0 0 4px rgba(11,10,20,.9), 0 0 0 9999px rgba(4,5,12,.72); }
  @keyframes spotPulse { to { outline: 2px solid rgba(255,224,160,.85); outline-offset: 4px; } }
  .spot-tag { position: fixed; display: none; background: #ffb057; color: #0b0a14; font-size: 1em; line-height: 1.5; padding: 0 .4em; white-space: nowrap; box-shadow: 0 0 0 1px #0b0a14; }
  .spot-card { position: fixed; display: none; width: 21em; background: rgba(8,9,18,.97); color: #eef3ff; padding: .6em .8em .5em; font-size: 1em; line-height: 1.6; box-shadow: 0 0 0 1px #0b0a14, 0 0 0 3px #ffb057, 0 0 24px rgba(255,176,87,.25); pointer-events: auto; }
  .spot-card h4 { margin: 0 0 .25em; color: #ffb057; font-size: 1em; font-weight: 400; display: flex; gap: .5em; } .spot-card h4 em { margin-left: auto; color: #8a90b0; font-style: normal; }
  .spot-card b { color: #0b0a14; background: #d8f1ff; padding: 0 1px; font-weight: 400; }
  .spot-card .sp-btns { display: flex; gap: .5em; justify-content: flex-end; margin-top: .5em; }
  .spot-card button { font: inherit; font-weight: 400; cursor: pointer; border: 0; padding: .1em .7em; background: #1b1e30; color: #eef3ff; box-shadow: 0 0 0 1px #4a5374; }
  .spot-card button.go { background: #ffb057; color: #0b0a14; box-shadow: 0 0 0 1px #0b0a14; }
  .spot-card button:hover { filter: brightness(1.2); }`;
  function ensure() {
    if (layer && layer.isConnected) return;
    if (!document.getElementById('spot-css')) { const st = document.createElement('style'); st.id = 'spot-css'; st.textContent = CSS; document.head.appendChild(st); }
    layer = document.createElement('div'); layer.className = 'spot-layer';
    layer.innerHTML = '<div class="spot-hole"></div><div class="spot-tag"></div><div class="spot-card"></div>';
    document.body.appendChild(layer);
    hole = layer.querySelector('.spot-hole'); tag = layer.querySelector('.spot-tag'); card = layer.querySelector('.spot-card'); sig = '';
  }
  // 目标 → 屏幕上的框（视口像素）
  Spot.rectOf = function (t) {
    if (!t) return null;
    if (t.c) {
      const cv = document.getElementById('game'); if (!cv) return null;
      const r = cv.getBoundingClientRect(), k = r.width / D.W, s = D.hudTune ? D.hudTune().s || 1 : 1, an = t.an || [0, 0];
      const [x, y, w, h] = t.c, X = an[0] + (x - an[0]) * s, Y = an[1] + (y - an[1]) * s;
      return { x: r.left + X * k, y: r.top + Y * k, w: w * s * k, h: h * s * k };
    }
    if (t.sel) {
      let a = null;
      for (const el of document.querySelectorAll(t.sel)) {
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || getComputedStyle(el).display === 'none') continue;
        a = a ? { x: Math.min(a.x, r.left), y: Math.min(a.y, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) } : { x: r.left, y: r.top, r: r.right, b: r.bottom };
      }
      return a && { x: a.x, y: a.y, w: a.r - a.x, h: a.b - a.y };
    }
    return null;
  };
  // spec：{ rect, label, card: { title, step, html, btns: [{ t, go, fn }] }, block }
  Spot.show = function (spec) {
    ensure();
    const R = spec.rect, pad = 4;
    const key = [R ? [R.x, R.y, R.w, R.h].map(Math.round).join(',') : '-', spec.label || '', spec.card ? spec.card.title + spec.card.step : '', spec.block ? 1 : 0, innerWidth, innerHeight].join('|');
    if (key === sig) return; sig = key;
    layer.classList.toggle('block', !!spec.block); layer.style.display = 'block';
    { const cv = document.getElementById('game'), k = cv ? cv.getBoundingClientRect().width / D.W : 1; layer.style.fontSize = Math.max(11, Math.round(10 * k)) + 'px'; } // 字跟着画面缩放（640 宽 = 10px）
    if (R) Object.assign(hole.style, { display: 'block', left: R.x - pad + 'px', top: R.y - pad + 'px', width: R.w + pad * 2 + 'px', height: R.h + pad * 2 + 'px' });
    else hole.style.display = 'none';
    if (spec.label && R) {
      tag.textContent = spec.label; tag.style.display = 'block';
      const below = R.y + R.h + pad + 22 < innerHeight, tw = tag.offsetWidth;
      tag.style.left = Math.max(4, Math.min(innerWidth - tw - 4, R.x + R.w / 2 - tw / 2)) + 'px';
      tag.style.top = (below ? R.y + R.h + pad + 6 : R.y - pad - 24) + 'px';
    } else tag.style.display = 'none';
    if (spec.card) {
      const C = spec.card;
      card.innerHTML = `<h4><span>${C.title}</span>${C.step ? `<em>${C.step}</em>` : ''}</h4><div class="sp-t">${C.html}</div><div class="sp-btns">${(C.btns || []).map((b, i) => `<button data-i="${i}" class="${b.go ? 'go' : ''}">${b.t}</button>`).join('')}</div>`;
      card.querySelectorAll('[data-i]').forEach(el => el.onclick = ev => { ev.stopPropagation(); D.Sfx && D.Sfx.play('click'); C.btns[+el.dataset.i].fn(); });
      card.style.display = 'block';
      const cw = card.offsetWidth, ch = card.offsetHeight; let x, y;
      if (!R) { x = innerWidth / 2 - cw / 2; y = innerHeight / 2 - ch / 2; }
      else if (R.y + R.h + ch + 20 < innerHeight) { x = R.x + R.w / 2 - cw / 2; y = R.y + R.h + pad + 12; }
      else if (R.y - ch - 20 > 0) { x = R.x + R.w / 2 - cw / 2; y = R.y - pad - 12 - ch; }
      else if (R.x + R.w + cw + 20 < innerWidth) { x = R.x + R.w + pad + 12; y = R.y + R.h / 2 - ch / 2; }
      else { x = R.x - pad - 12 - cw; y = R.y + R.h / 2 - ch / 2; }
      card.style.left = Math.max(6, Math.min(innerWidth - cw - 6, x)) + 'px'; card.style.top = Math.max(6, Math.min(innerHeight - ch - 6, y)) + 'px';
    } else card.style.display = 'none';
  };
  Spot.hide = function () { if (!layer || sig === 'off') return; sig = 'off'; layer.style.display = 'none'; layer.classList.remove('block'); };
  Spot.on = () => !!layer && sig !== 'off' && layer.style.display !== 'none';
  // 站内：训练场每帧调（ui-raid.js）
  Spot.raid = function (S) {
    if (Tour.cur) return;
    const sp = S && S.tut && D.tutSpot ? D.tutSpot(S) : null, R = sp && Spot.rectOf(sp);
    if (!R) return Spot.hide();
    Spot.show({ rect: R, label: sp.label });
  };

  // ── 据点导览
  const Tour = D.Tour = { cur: null };
  const PAGES = [
    { sel: '.hm-hero', title: '你的工壳', html: '这就是你在城里的身体。点它进<b>机库</b>：六种型号，工壳是租的、免费、死了也不丢；买来的型号死在城里就没了，撤出时带着伤要花钱修。机库里还有改装台和涂装。' },
    { sel: '[data-go=map]', title: '出发', html: '每一趟从这里开始：选一个<b>出发站</b>进城。第一次只有据点能出发；撤出过的线路尽头站会解锁成新的出发站。' },
    { tab: 'map', sel: '.hub-body', title: '选出发站', html: '左边是能出发的站，右边是线路图：站卡上的星星是东西值不值钱，图标是站的类型（剑普通、骷髅精英、宝箱、问号事件、天线中继……）。选好以后去检查配装、选难度（常规 / 机密 / 绝密），出发。' },
    { tab: 'stash', sel: '.hub-body', title: '仓库', html: '配装、背包、保险箱都在这一页。把装备卡<b>拖到</b>身上的槽就换上，右键卸下；被动芯片只能在这里换。仓库满了，撤出时放不下的东西按半价卖掉。' },
    { sel: '[data-go=shells]', title: '机库', html: '换型号、看属性，装<b>改装件</b>（装甲 / 动力 / 传感器三个槽，装上会画在机器人身上）。开哪台涨哪台的熟练度，2 级技能冷却短、3 级技能第二形态。' },
    { sel: '[data-go=fac]', title: '设施', html: '工作台、医疗室、情报站、仓库，各 4 级，升级要零件和城里的材料。工作台能做所有<b>配件</b>和改装件；传说级要先学蓝图。' },
    { sel: '[data-go=workshop]', title: '工坊', html: '蓝图册（城里捡到的蓝图记在这里），还能做<b>四级、五级弹药</b>。' },
    { sel: '[data-go=market]', title: '交易行', html: '每趟算一天，每样东西的行情在 ±25% 之间浮动。卖战利品换零件，买弹药、药、门禁卡。' },
    { sel: '[data-go=jobs]', title: '委托', html: '委托板每天刷新，最多同时接 3 条：交东西、击毁、到某类站、带回总价值……除了交东西，都要<b>撤出来</b>才算。' },
    { sel: '[data-go=npc], [data-go=clues]', title: '人物和线索', html: '主线在这两页：林桥、阿隼、陆峥有新话时页签亮一个点。城里捡到的旧纸片是<b>线索</b>，读过就永久记下，卖掉、丢掉、工壳损毁都不影响；线索页顶上写着下一步该去哪类站。' },
    { sel: '[data-go=codex]', title: '图鉴', html: '敌人的每一招、四百多种物品、容器的出货倾向。碰到不认识的来这儿查。' },
    { sel: '.hm-gold', title: '零件', html: '金色的数字是你的零件（钱）。买型号、升设施、修工壳都花它。' },
    { sel: '[data-act=menu]', title: '菜单', html: '存档、设置（音量、改键、界面大小、自动拾取）、重玩新手教学、再看一遍这个导览，都在这里。好了，去出发吧。' },
  ];
  Tour.PAGES = PAGES;
  Tour.start = function (o) {
    const G = D.Game; if (!G || G.mode !== 'hub') return false;
    Tour.cur = { i: 0, o: o || {} }; Tour.show(); return true;
  };
  Tour.end = function (done) {
    const G = D.Game; Tour.cur = null; Spot.hide();
    if (G && G.pf) { G.pf.tour = 1; if (G.save) G.save(); }
    if (G && G.mode === 'hub' && G.tab !== 'home') G.hubTab('home');
    if (done && D.UI.toast) D.UI.toast('导览结束');
  };
  Tour.go = function (d) { const T = Tour.cur; if (!T) return; T.i += d; if (T.i < 0) T.i = 0; if (T.i >= PAGES.length) return Tour.end(true); Tour.show(d); };
  Tour.show = function (d) {
    const T = Tour.cur, G = D.Game; if (!T) return;
    if (!G || G.mode !== 'hub') return Tour.end(false);
    const pg = PAGES[T.i], tab = pg.tab || 'home';
    if (G.tab !== tab) G.hubTab(tab);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (Tour.cur !== T) return;
      const R = Spot.rectOf({ sel: pg.sel });
      if (!R && !pg.tab) { T.i += d < 0 ? -1 : 1; if (T.i < 0 || T.i >= PAGES.length) return Tour.end(true); return Tour.show(d); } // 这一格没有（比如工坊还没开）：跳过
      const last = T.i === PAGES.length - 1;
      Spot.show({ rect: R, block: true, card: { title: pg.title, step: (T.i + 1) + ' / ' + PAGES.length, html: pg.html,
        btns: [{ t: '跳过导览', fn: () => Tour.end(false) }].concat(T.i ? [{ t: '上一页', fn: () => Tour.go(-1) }] : []).concat([{ t: last ? '完成' : '下一页', go: true, fn: () => Tour.go(1) }]) } });
    }));
  };
  // 教学撤出、回到据点：等剧情演完、弹窗关掉再开导览
  Tour.after = function () {
    let n = 0;
    const tick = () => {
      const G = D.Game; if (!G || n++ > 240) return;
      const busy = G.mode !== 'hub' || G.tab !== 'home' || document.querySelector('#ui .modal') || (D.Scene && D.Scene.cur) || (D.UI.introBusy && D.UI.introBusy());
      if (busy) return setTimeout(tick, 250);
      Tour.start();
    };
    setTimeout(tick, 400);
  };
  addEventListener('resize', () => { if (Tour.cur) { sig = ''; Tour.show(); } });
  addEventListener('keydown', ev => { if (!Tour.cur) return; if (ev.code === 'Escape') { ev.preventDefault(); ev.stopPropagation(); Tour.end(false); } else if (ev.code === 'Enter' || ev.code === 'ArrowRight' || ev.code === 'Space') { ev.preventDefault(); ev.stopPropagation(); Tour.go(1); } else if (ev.code === 'ArrowLeft') { ev.preventDefault(); Tour.go(-1); } }, true);
})(D);
