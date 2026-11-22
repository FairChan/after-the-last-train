/* Underdog · 小样二：界面第二版——据点首页、窗口外壳、出发步骤条。
   首页：背后是活的车站（main.js 画，和开始页同一个场景），左边是当前型号的立绘（全身、朝右，带披风）和型号名，右边是 11 块入口磁贴，
   底边是行情滚动条（交易行的价格和涨跌，仓库里有的排在前面标 ★；不写"第 N 天"）。
   开始页进首页：入场动画（introStart）——菜单退场之后，磁贴一个个擦出来、立绘像老显示器一样从中间线往外开、扫一道琥珀色的线。
   窗口：除首页外的据点各页都套一条窗口栏（◀ 首页、窗口名、快捷切换），打开时扫一道线；Esc / 手柄 B 回首页。
   出发：选站页、出发准备页顶上有"① 选出发站 ② 检查配装 ③ 出发"的步骤条。
   设计：design/features/ui-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, esc = X.esc;
  let root, G, raf = 0;
  // 开始页进首页的入场：U.hub 看见标题页还在，就把 introNext 给 U.home
  let introNext = false, introTimer = 0;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  X.hooks.clear.push(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; } cleanIntro(); });
  const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
  const WIN = { map: ['选择出发站', 'DEPLOY'], jobs: ['委托', 'JOBS'], npc: ['人物', 'CONTACTS'], clues: ['线索', 'CLUES'], shells: ['机库', 'HANGAR'], load: ['仓库', 'STORAGE'], fac: ['设施', 'FACILITY'], stash: ['仓库', 'STORAGE'], market: ['交易行', 'MARKET'], codex: ['图鉴', 'ARCHIVE'], gunsmith: ['改枪台', 'GUNSMITH'], modbay: ['改装台', 'MOD BAY'] };
  U.WIN = WIN;

  // ── 首页的数字（磁贴上只放一个最重要的）
  function facts(pf) {
    const W = D.Growth, B = W && W.board ? W.board(pf) : { offers: [], active: [] };
    const [sw, sh] = D.stashSize ? D.stashSize(pf) : [pf.stash.w, pf.stash.h], used = pf.stash.items.reduce((a, e) => { const it = D.itemInfo(e.id); return a + (it.w || 1) * (it.h || 1); }, 0);
    const fac = ['bench', 'med', 'intel', 'store'], facLv = fac.reduce((a, k) => a + D.facLv(pf, k), 0), facUp = fac.some(k => { const n = D.facNext(pf, k); return n && D.canPay(pf, n.money, n.mats); });
    const owned = Object.keys(D.SHELLS).filter(k => pf.shells[k]).length, clues = ((pf.story || {}).clues || []).length;
    return { offers: (B.offers || []).length, active: (B.active || []).length, used, cap: sw * sh, facLv, facUp, owned, clues };
  }
  const count = (n, cls) => `<b class="${cls || ''}" data-to="${n}">0</b>`;

  // ── 行情条：交易行的价格和涨跌（涨红跌绿，A 股的习惯）。仓库里有的东西排在最前面、标 ★；两份接在一起滚，看不出接缝。
  //    不写"第 N 天"（用户 2026-11-16：之前要去掉的是"第 x 天"，不是行情条）
  const fmtPrice = v => v >= 100 ? String(Math.round(v)) : v.toFixed(1);
  D.tickerQuotes = function (pf, n) {
    const day = D.marketDay(pf), rng = D.rng('ticker:' + pf.seed + ':' + day), G2 = D.Grid;
    const tradable = id => !!D.ITEMS[id] && !D.ITEMS[id].noLoot;
    const own = pf.stash ? [...new Set(pf.stash.items.map(e => e.id))].filter(tradable).map(id => ({ id, v: G2.count(pf.stash, x => x === id) * D.marketPrice(pf, id) })).sort((a, b) => b.v - a.v).slice(0, 8).map(o => o.id) : [];
    const pool = rng.shuffle(Object.keys(D.ITEMS).filter(k => tradable(k) && D.ITEMS[k].q >= 1 && !own.includes(k)));
    return own.concat(pool.slice(0, Math.max(0, (n || 28) - own.length))).map(id => {
      const m1 = D.marketMult(pf, id, day), m0 = day > 0 ? D.marketMult(pf, id, day - 1) : m1, ch = (m1 - m0) / m0 * 100;
      return { id, name: D.itemInfo(id).name, price: D.marketPrice(pf, id), ch, own: own.includes(id) };
    });
  };
  function tickerHTML(pf) {
    const html = D.tickerQuotes(pf).map(q => { const c = q.ch > 0.05 ? 'up' : q.ch < -0.05 ? 'dn' : 'eq';
      return `<span class="tk-it">${q.own ? '<span class="tk-own">★</span>' : ''}<span class="tk-n">${esc(q.name)}</span> ${fmtPrice(q.price)} <span class="tk-${c}">${c === 'up' ? '▲' : c === 'dn' ? '▼' : '■'}${Math.abs(q.ch).toFixed(1)}%</span></span>`; }).join('');
    return `<div class="hm-tick" data-marquee><span class="tk-tag"><span class="tk-dot">●</span> 行情</span><div class="tk-win"><div class="tk-run">${html}${html}</div></div></div>`;
  }
  // 一步一像素往左走（30 像素每秒，像素字不糊）；滚动位置存在模块里，同一页重画不从头开始
  let tkOff = 0, tkNow = 0;
  function tickScroll(now) {
    const run = $('.tk-run'); if (!run) return;
    const dt = tkNow ? Math.min(0.1, (now - tkNow) / 1000) : 0; tkNow = now;
    let half = +run.dataset.half; if (!half) { half = Math.floor(run.scrollWidth / 2); run.dataset.half = half; } if (!half) return;
    tkOff = (tkOff + dt * 30) % half;
    run.style.transform = `translateX(${-Math.floor(tkOff)}px)`;
  }

  U.home = function (pf) {
    const intro = introNext; introNext = false;
    U.clear(); root.className = 'm-hub m-home fine' + (intro ? ' intro' : '');
    const k = D.shellOf(pf), S = D.SHELLS[k], F = facts(pf), C = pf.city, sel = C.stations[G.sel != null && C.stations[G.sel] ? G.sel : C.home];
    const L = pf.load, gun = D.CARDS[L.gun], mel = L.melee && D.CARDS[L.melee];
    const day = D.marketDay(pf) + 1, ach = D.Ach ? D.Ach.count() + '/' + D.Ach.LIST.length : '';
    const tile = (go, cls, body, tip) => `<button class="tile ${cls}" data-go="${go}"${tip ? ` data-tip="${esc(tip)}"` : ''}><i class="tl-c tl-c1"></i><i class="tl-c tl-c2"></i>${body}</button>`;
    const head = (zh, en) => `<span class="tl-h"><span class="tl-k">${zh}</span><span class="tl-en">${en}</span></span>`;
    root.innerHTML = `<div class="home">
      <div class="hm-top"><span class="hm-base">Underdog</span><span class="hm-sp"></span>
        <span class="hm-gold"><i class="ico-gold"></i>${count(pf.money)}</span>
        ${ach ? `<button class="hm-btn" data-act="ach" data-tip="成就">★ ${ach}</button>` : ''}<button class="hm-btn" data-act="menu" data-tip="菜单：保存、设置、新手教学、回到标题">菜单</button></div>
      <div class="hm-hero" data-go="shells" data-tip="${esc('机库：换型号、看属性、改装')}"><canvas class="hm-cv" width="230" height="168"></canvas>
        <div class="hm-plate"><div class="hm-name">${esc(S.name)}<em>${esc(S.code || '')}</em></div></div></div>
      <div class="hm-tiles">
        ${tile('map', 't-go', `${head('出发', 'DEPLOY')}<span class="tl-v">从 <b>${esc(sel.name)}</b>${sel.home ? ' <em>据点</em>' : ''}</span><span class="tl-s">${U.lineChips ? U.lineChips(sel) : ''}<span class="tl-star">${U.valueStarsHTML ? U.valueStarsHTML(sel) : ''}</span></span><span class="tl-step">① 选出发站 → ② 检查配装 → ③ 出发</span><i class="tl-arrow">▶</i>`, '选出发站、检查配装，然后坐车进城')}
        ${tile('jobs', 't-m', `${head('委托', 'JOBS')}<span class="tl-n">${count(F.active)}<em>进行中</em></span><span class="tl-s">可接 ${F.offers}</span>${F.offers ? '<i class="tl-dot"></i>' : ''}`, '委托板：接活、交活')}
        ${tile('stash', 't-m t-wide', `${head('仓库', 'STORAGE')}<span class="tl-row"><span class="tl-ic"><img src="${X.artURL(gun.art)}">${mel ? `<img src="${X.artURL(mel.art)}">` : ''}</span><span class="tl-nb"><span class="tl-n">${count(Math.round(F.used / F.cap * 100))}<em>% 占用</em></span><span class="tl-s">${F.used} / ${F.cap} 格</span></span></span>`, '仓库：换装备、整理、带进城的东西 · ' + gun.name + (mel ? ' · ' + mel.name : ''))}
        ${tile('shells', 't-m', `${head('机库', 'HANGAR')}<span class="tl-n">${count(F.owned)}<em>/ ${Object.keys(D.SHELLS).length}</em></span><span class="tl-s">当前 ${esc(S.name)}</span>`, '机库：换型号、涂装、改装')}
        ${tile('fac', 't-m', `${head('设施', 'FACILITY')}<span class="tl-n">${count(F.facLv)}<em>/ 16 级</em></span><span class="tl-s">${F.facUp ? '有设施能升级' : '工作台、医疗室……'}</span>${F.facUp ? '<i class="tl-dot"></i>' : ''}`, '设施：升级工作台、医疗室、情报站、仓库')}
        ${tile('market', 't-m', `${head('交易行', 'MARKET')}<span class="tl-n tl-tr">${(day * 7) % 3 ? '▲' : '▼'}<em>今日行情</em></span><span class="tl-s">买补给、卖战利品</span>`, '交易行：买入、卖出')}
        <div class="hm-small">${tile('npc', 't-s', `<span class="tl-k">人物</span>`, '林桥、阿隼、陆峥')}${tile('clues', 't-s', `<span class="tl-k">线索</span><b>${F.clues}/12</b>`, '线索日志')}${tile('codex', 't-s', `<span class="tl-k">图鉴</span>`, '敌人、物品、容器')}${U.workshopTile ? U.workshopTile(pf, tile) : ''}</div>
      </div>
      ${tickerHTML(pf)}
    </div>`;
    $$('[data-go]').forEach(b => b.onclick = () => { D.Sfx.play('click'); go(b.dataset.go); });
    $('[data-act=menu]').onclick = () => { D.Sfx.play('click'); U.hubMenu(); };
    const ab = $('[data-act=ach]'); if (ab) ab.onclick = () => { D.Sfx.play('click'); if (D.Ach) D.Ach.page(); };
    $$('.tile').forEach((t, i) => { t.style.animationDelay = (intro ? 0.32 + i * 0.055 : 0.08 + i * 0.04).toFixed(3) + 's'; t.addEventListener('pointerenter', () => D.Sfx.play('tink')); });
    // 立绘（呼吸、护目闪）+ 数字从 0 跳到当前值（入场时等磁贴擦出来再跳）
    const cv = $('.hm-cv'), look = D.shellLook ? D.shellLook(pf, k) : null, nums = [...$$('[data-to]')], t0 = performance.now() - (U.redraw ? 5000 : 0), nd = intro ? 0.6 : 0; // 同一页重画：数字直接是终值
    const loop = now => {
      if (!cv.isConnected) { raf = 0; return; }
      const t = (now - t0) / 1000;
      drawHero(cv, pf, k, look, t, now);
      for (const n of nums) { const to = +n.dataset.to, v = Math.round(to * Math.min(1, Math.max(0, (t - 0.3 - nd) / 0.6))); if (n.textContent !== String(v)) n.textContent = v; }
      tickScroll(now);
      raf = requestAnimationFrame(loop);
    };
    if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    if (intro) introStart();
    if (!window.requestAnimationFrame || document.hidden || U.redraw) nums.forEach(n => { n.textContent = n.dataset.to; });
  };
  function go(tab) { if (tab === 'map') G.hubTab('map'); else G.hubTab(tab); }
  // 大立绘：和游戏里画主角一样（hero-portrait.js：机身 + 轮廓光 + 发光 + 披风 + 光照、泛光），朝右待机，游戏像素 ×3；脚下转台；进场时扫描线从上往下扫一遍。
  let heroLast = 0, heroP = null;
  function drawHero(cv, pf, k, look, t, now) {
    const x = cv.getContext('2d'), mods = pf.shells[k] ? D.shellMods(pf, k) : null;
    x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height);
    if (!D.heroPortrait) return;
    const dt = heroLast ? Math.min(1 / 30, Math.max(0, (now - heroLast) / 1000)) : 1 / 60; heroLast = now;
    const fx = cv.width / 2, fy = cv.height - 16, ga = Math.min(1, t / 0.5), qc = D.QUALITY[D.SHELLS[k].q].col;
    x.fillStyle = 'rgba(5,6,14,.75)'; x.beginPath(); x.ellipse(fx, fy, 52, 9, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = qc; x.globalAlpha = 0.45 + 0.25 * Math.sin(t * 2); x.lineWidth = 1; x.beginPath(); x.ellipse(fx, fy, 52, 9, 0, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
    heroP = heroP || D.heroPortrait();
    heroP.draw(x, { k, mods, tint: look && look.tint, visor: look && look.visor, dir: 6, t, dt, up: 3, fx, fy, alpha: ga });
    if (t < 0.9) { const y = Math.round(cv.height * (t / 0.9)); x.fillStyle = 'rgba(62,232,255,.55)'; x.fillRect(0, y, cv.width, 1); x.fillStyle = 'rgba(62,232,255,.12)'; x.fillRect(0, y - 6, cv.width, 6); }
  }

  // ── 开始页 → 首页的入场（只放一次：从开始页进首页；重画、换页、从窗口回首页都不放）。
  //    CSS 在 #ui.intro 下：顶栏从上往下擦出来、立绘像老显示器一样从中间线往外开、名字一格格出来、磁贴一个个擦出来、行情条最后滑进来。
  //    再加一声开机音（不再有琥珀色的扫描线，用户要求去掉）。按任意键 / 点一下直接到终态。
  function introStart() {
    if (D.settings && D.settings.reduceFlash) root.classList.add('calm'); // 减少闪光：去掉提亮的闪
    D.Sfx.play('power');
    addEventListener('keydown', introSkip, true); addEventListener('pointerdown', introSkip, true);
    introTimer = setTimeout(cleanIntro, 2200);
  }
  function introSkip() {
    if (root && root.getAnimations) for (const a of root.getAnimations({ subtree: true })) if (/^intro/.test(a.animationName)) a.finish();
    cleanIntro();
  }
  function cleanIntro() {
    removeEventListener('keydown', introSkip, true); removeEventListener('pointerdown', introSkip, true);
    clearTimeout(introTimer); introTimer = 0;
  }
  U.introBusy = () => !!introTimer; // 新手教学的邀请等入场放完再弹

  // ── 同一页重画不放开场动画（试玩：仓库里挪东西、页面一改就黑一下再擦进来）。
  //    挪东西、买卖、装卸之后都会 U.refresh() 把整页重画一遍，CSS 的开场动画（换页扫描线、卡片落定、数值条长出来、首页磁贴滑进来）跟着重放。
  //    现在只有真的打开 / 换页时才放；同一页重画完马上把这些动画放到头。入袋闪一下、余额跳一下这些反馈动画不在名单里，照放。
  //    开场动画本身也改过：不再从透明 / 裁切开始（那样每次换页都先空一下），内容一直看得见，只是挪一点、亮一下，再扫一道线。
  const ENTRY = new Set(['winIn', 'wRise', 'hmIn', 'hmFade', 'hmBar', 'tlIn']);
  function settle() { if (!root.getAnimations) return; for (const a of root.getAnimations({ subtree: true })) if (ENTRY.has(a.animationName)) a.finish(); }
  U.redraw = false; // 首页的数字跳动看这个：重画时直接显示终值

  // ── 窗口外壳：据点其余各页套一条窗口栏
  const hub0 = U.hub;
  U.hub = function (pf, tab) {
    tab = tab || 'home';
    if (tab === 'load') { tab = 'stash'; if (G) G.tab = 'stash'; } // 配装并进了仓库
    const same = !!root && G && G.mode === 'hub' && root.classList.contains(tab === 'home' ? 'm-home' : 'w-' + tab);
    U.redraw = same;
    // 开始页（标题页还在）进首页：放入场动画。标题页的退场已经在 ui-menu.js 的 leave 里播完了
    introNext = !same && tab === 'home' && !!root && root.classList.contains('m-title');
    try { shell.call(this, pf, tab); } finally { U.redraw = false; introNext = false; }
    if (same) settle();
  };
  function shell(pf, tab) {
    if (tab === 'home') return U.home(pf);
    hub0.call(this, pf, tab);
    const tb = $('.topbar'), w = WIN[tab] || ['', ''];
    if (tb) {
      tb.classList.add('wbar');
      tb.insertAdjacentHTML('afterbegin', `<button class="wb-back" data-act="home" data-tip="回首页（Esc）">◀ 首页</button><span class="wb-title">${esc(w[0])}<em>${w[1]}</em></span>`);
      tb.querySelector('[data-act=home]').onclick = () => { D.Sfx.play('click'); G.hubTab('home'); };
    }
    root.classList.add('m-win', 'w-' + tab);
    if (tab === 'map') stepper(1, tb);
  }
  // ── 出发步骤条
  function stepper(n, into) {
    const old = root.querySelector('.stepper'); if (old) old.remove();
    const steps = ['选出发站', '检查配装', '出发'];
    if (into) into.classList.add('has-step');
    (into || root).insertAdjacentHTML('beforeend', `<div class="stepper">${steps.map((s, i) => `<span class="sp${i + 1 < n ? ' done' : i + 1 === n ? ' cur' : ''}" data-step="${i + 1}"><b>${i + 1}</b>${s}</span>${i < 2 ? '<i class="sp-ln"></i>' : ''}`).join('')}</div>`);
    const s1 = root.querySelector('.stepper [data-step="1"]'); if (s1 && n > 1) s1.onclick = () => { D.Sfx.play('click'); G.toHub('map'); };
  }
  U.stepper = stepper;
  const brief0 = U.brief;
  U.brief = function () { const r = brief0.apply(this, arguments); stepper(2); return r; };
  // Esc 回首页（窗口里）/ 回选站（出发准备页里）
  addEventListener('keydown', e => {
    if (e.code !== 'Escape' || !G || U.modalOpen && U.modalOpen()) return;
    const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT')) return;
    if (G.mode === 'hub' && G.tab && G.tab !== 'home') { e.preventDefault(); D.Sfx.play('click'); G.hubTab('home'); }
    else if (G.mode === 'brief') { e.preventDefault(); D.Sfx.play('click'); G.toHub('map'); }
  });
  // ── 英文词条（语言层 i18n.js 在 DOM 出口上查这张表）
  if (D.I18N && D.I18N.add) D.I18N.add({
    '据点 · 第 {0} 天': 'Base · Day {0}', '撤': 'Out', '毁': 'Lost', '成就': 'Achievements', '远程操控': 'Remote-operated', '耐久 {0} / {1} · 熟练 {2} 级': 'Armor {0} / {1} · Mastery {2}',
    '出发': 'Deploy', '从 {0}': 'From {0}', '从': 'From', '仓库：换装备、整理、带进城的东西 · {0} · {1}': 'Storage: gear, sorting and what you carry · {0} · {1}', '仓库：换装备、整理、带进城的东西 · {0}': 'Storage: gear, sorting and what you carry · {0}', '据点': 'Base', '① 选出发站 → ② 检查配装 → ③ 出发': '① Station → ② Loadout → ③ Deploy', '选出发站、检查配装，然后坐车进城': 'Pick a start station, check your loadout, then ride into the city',
    '委托': 'Jobs', '进行中': 'active', '可接 {0}': '{0} open', '委托板：接活、交活': 'Job board: take and turn in jobs',
    '配装': 'Loadout', '配装：枪、近战、模块、被动、背包': 'Loadout: gun, melee, modules, passives, bag',
    '仓库': 'Storage', '% 占用': '% used', '{0} / {1} 格': '{0} / {1} cells', '单击仓库里的东西：卡装到选中的槽，弹药进子弹袋，门禁卡进卡包，别的放进背包。拖进保险箱的东西死了也不丢。单击这一列里的东西退回仓库。': 'Click an item in the stash: cards go to the selected slot, ammo to the ammo bag, keycards to the card case, everything else to your bag. Items in the secure case are kept if you die. Click anything in this column to send it back.', '死了也不丢': 'kept if you die', '{0} 件': '{0} items', '只放门禁卡': 'keycards only', '回仓库': 'Back to storage',
    '机库': 'Hangar', '当前 {0}': 'Current: {0}', '机库：换型号、涂装、改装': 'Hangar: switch shell, skins, mods', '机库：换型号、看属性、改装': 'Hangar: switch shell, stats, mods',
    '设施': 'Facilities', '/ 16 级': '/ 16 lv', '有设施能升级': 'Upgrade ready', '工作台、医疗室……': 'Bench, med bay…', '设施：升级工作台、医疗室、情报站、仓库': 'Facilities: upgrade bench, med bay, intel, storage',
    '交易行': 'Market', '第 {0} 天行情': 'Day {0} prices', '买补给、卖战利品': 'Buy supplies, sell loot', '交易行：买入、卖出': 'Market: buy and sell',
    '人物': 'Contacts', '林桥、阿隼、陆峥': 'Lin Qiao, A-Sun, Lu Zheng', '线索': 'Clues', '线索日志': 'Clue log', '图鉴': 'Archive', '敌人、物品、容器': 'Enemies, items, containers',
    '◀ 首页': '◀ Home', '回首页（Esc）': 'Back to Home (Esc)', '首页': 'Home', '菜单：保存、设置、新手教学、回到标题': 'Menu: save, settings, tutorial, title',
    '选择出发站': 'Start station', '改枪台': 'Gunsmith', '改装台': 'Mod bay', '选出发站': 'Station', '检查配装': 'Loadout',
    '价值构成': 'Value by quality', '还没读到': 'Not found yet',
  });
})(D);
