/* 末班之后 · 小样二：行动中的背包（Tab）—— 试玩反馈第三轮"像 PUBG 那样的物品栏"
   左边：脚边地上的东西；中间：你的机器人站在转台上（待机动画，跟着鼠标转身），四周是身上的装备槽；右边：背包、保险箱、门禁卡包。
   拖到装备槽就换上：枪、近战、Q / E 模块、背包；换下来的进背包（放不下就丢在脚边）。右键装备槽卸下。
   丢掉的东西（右键丢、拖到附近、放不下丢在脚边的）留在地上但捡不回来，附近列表里也不列。打开、关上都有动画。
   画布一格一像素（48×84），按 3 倍显示；只用平涂色块。线路图上（站与站之间）还是原来那个简单的背包面板。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip, infoIcon, cardIcon, tipOf, gridHTML, GR } = X;
  let root, G, raf = 0, wint = 0, drag = null;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  X.hooks.clear.push(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; } if (wint) { clearInterval(wint); wint = 0; } });
  const $ = s => root.querySelector(s);
  const CW = 48, CH = 84, FX = 24, FY = 76;           // 转台画布；机器人脚底站的位置
  const HIT_SEC = 1.2;                                 // 搜刮页：被打（或被瞄准）以后这么多游戏秒内外框标红
  const RING = [8, 7, 6, 5, 4, 3, 2, 1];               // 转身按这个顺序一档一档转（8 = 正面朝外）
  const FREE = { gun: 'nailgun', melee: 'shovel' };
  const SLOT = { gun: '主武器', melee: '副武器', q: 'Q 模块', e: 'E 模块', bag: '背包', armor: '护甲' };
  const isArmor = id => D.Armor && D.Armor.is(id);
  const near = S => S.ground.filter(g => g.f === S.f && !g.dropped && g.t > 0.35 && Math.hypot(g.x - S.player.x, g.y - S.player.y) < 56);
  const sfx = n => D.Sfx && D.Sfx.play(n);

  // ── 换装备（规则）
  const putBack = (S, id) => { if (GR().add(S.raid.bag, id, 1)) D.dropAt(S, id, 1); }; // 换下来的：进背包，放不下就丢在脚边
  // 一件东西能不能装进这个槽
  function fits(slot, id) {
    if (!id) return false;
    if (id.startsWith('bag:')) return slot === 'bag';
    if (isArmor(id)) return slot === 'armor';
    if (!id.startsWith('card:')) return false;
    const c = D.CARDS[id.slice(5)]; if (!c) return false;
    return D.fitsWeapon(c, slot) || ((slot === 'q' || slot === 'e') && c.slot === 'mod');
  }
  // 把 id 装进 slot。take() 负责把它从原来的地方拿走（背包格子 / 地上）
  function equip(S, slot, id, take) {
    const R = S.raid, p = S.player;
    if (!fits(slot, id)) { sfx('nope'); return false; }
    if (slot === 'bag') return swapBag(S, id, take);
    if (slot === 'armor') { take(); D.Armor.wear(S, id, x => putBack(S, x)); flash('armor', D.itemInfo(id).q); return true; }
    take();
    const k = id.slice(5);
    if (slot === 'gun' || slot === 'melee') D.equipCard(S, k, x => putBack(S, x), slot);
    else {
      const old = R.load[slot]; R.load[slot] = k; R.pf.load[slot] = k; p.modCd[slot] = Math.max(p.modCd[slot] || 0, D.CARDS[k].cd * 0.5); // 换模块不能拿来刷冷却
      if (old) putBack(S, 'card:' + old);
      D.playerAct(p, 'swap', 0.5, 'mod'); sfx('draw'); modIcons(S);
    }
    flash(slot, D.itemInfo(id).q);
    return true;
  }
  // 行动中换背包：东西码进新包，放不下的丢在脚边；旧背包也放进新包或丢下
  function swapBag(S, id, take) {
    const R = S.raid, k = id.slice(4), nb = D.BAGS[k]; if (!nb) return false;
    take();
    const old = R.load.bag, ext = D.bagExtra(R.shell, R.pas), { grid, over } = GR().repack(R.bag, nb.gw + ext[0], nb.gh + ext[1]);
    R.bag.w = grid.w; R.bag.h = grid.h; R.bag.items.length = 0; R.bag.items.push(...grid.items);
    R.load.bag = k; R.pf.load.bag = k;
    for (const o of over) D.dropAt(S, o.id, o.n);
    if (!D.BAGS[old].free) putBack(S, 'bag:' + old);
    U.toast('换上了' + nb.name + (over.length ? '，放不下的 ' + over.length + ' 样丢掉了（捡不回来）' : '')); sfx('power'); D.playerAct(S.player, 'swap', 0.5, 'bag');
    flash('bag', nb.q);
    return true;
  }
  // 卸下：枪 / 近战换回租来的那把，模块空着；背包不能卸
  function unequip(S, slot, toGround, toGrid) { // toGrid：卸下来直接放进箱子（搜刮时拖到箱子格子上）
    const R = S.raid, put = id => (toGrid ? (GR().add(toGrid, id, 1) && putBack(S, id)) : toGround ? D.dropAt(S, id, 1) : putBack(S, id));
    if (slot === 'bag') { U.toast('背包不能卸：拖一个新背包上来就换上'); sfx('nope'); return false; }
    if (slot === 'armor') { const cur = D.Armor.takeOff(S); if (!cur) { sfx('nope'); return false; } put(cur); return true; }
    const cur = R.load[slot]; if (!cur || D.CARDS[cur].free) { sfx('nope'); return false; }
    if (slot === 'gun' || slot === 'melee') D.equipCard(S, FREE[slot], put, slot);
    else { R.load[slot] = null; R.pf.load[slot] = null; put('card:' + cur); modIcons(S); sfx('click'); }
    return true;
  }
  // HUD 右下角的 Q / E 图标跟着换
  function modIcons(S) {
    for (const k of ['q', 'e']) {
      const el = root.querySelector(`.mods .mod[data-k="${k}"]`); if (!el) continue; const id = S.raid.load[k];
      el.innerHTML = id ? `<img src="${cardIcon(D.CARDS[id])}"><div class="cdmask"></div><span class="mk">${k.toUpperCase()}</span>` : `<span class="mk">${k.toUpperCase()}</span>`;
    }
  }
  let flashQ = null; const flash = (slot, q) => { flashQ = { slot, t0: performance.now(), col: D.QUALITY[q || 0].col }; };

  // ── 界面
  const bag0 = U.bag, close0 = U.closePanel;
  U.bag = function (R, S) { if (!S) return bag0(R, S); openInv(R, S); };
  // 关上：先播一小段收起动画再拿掉（搜刮面板之类的还是直接关）
  U.closePanel = function (S) {
    const inv = root && root.querySelector('.panel-slot .inv');
    if (inv && S && S.lootOpen && (S.lootOpen.inv || S.lootOpen === inv._state)) { inv.classList.add('closing'); inv.style.pointerEvents = 'none'; S.lootOpen = null; hideTip(); setTimeout(() => inv.remove(), 140); return; }
    close0(S);
  };
  // 搜刮面板（开箱子）也走这一页：左边是箱子，中间是全部装备槽（不画机器人了），右边背包、子弹袋、保险箱、门禁卡包；整块是半透明的小框，被打了外框标红（搜刮面板重做，用户 2026-11-15：
  // "完全修改这个拾取页面的前端，将我们所有的槽位都放进去（包括武器什么的），完全进行重构，并且添加动画"）
  U.loot = function (S, c) { if (!S || !c) return; if (!c.items.length) { emptyBox(S, c); return; } openInv(S.raid, S, c); };
  // 箱子里一样东西都没有：不开搜刮页（不挂 S.lootOpen），主角头顶冒一句"空空如也。"。
  // 只是头顶冒字（barks.js 的 D.Barks.self），不是对话 / 过场：不挂 S.talk、不停人、不用按键关，两秒多自己淡掉（用户 2026-11-17："不是过场动画，只是头顶上冒内容"）
  function emptyBox(S, c) {
    if (!D.Barks || !S.player) return;
    D.Barks.self(S, '空空如也。');
    sfx('click');
  }
  function openInv(R, S, cont) {
    const host = $('.panel-slot'); if (!host) return;
    host.innerHTML = ''; const el = document.createElement('div'); el.className = 'inv opening' + (cont ? ' loot' : ''); host.appendChild(el);
    const state = cont || { bag: true, inv: true }; S.lootOpen = state; el._state = state;
    const look = { dir: 8, to: 8, stepT: 0, t0: performance.now(), mx: null, my: null }, mem = { val: null, used: null };
    el.addEventListener('pointermove', ev => { look.mx = ev.clientX; look.my = ev.clientY; });
    const render = () => {
      if (S.lootOpen !== state) return;
      const L = R.load, SH = S.SH, p = S.player, gnd = near(S).sort((a, b) => D.itemInfo(b.id).q - D.itemInfo(a.id).q), now = performance.now();
      // 搜刮页右边（用户 2026-11-17："右侧的格子都太小了"）：子弹袋、保险箱、门禁卡包挪到背包下面并排一行（小格 rc），腾出来的高度给背包；
      // 背包格子按 198 宽排（9 宽的军用重载包 22 格，原来 17），面板总宽不变（左边要露出主角）。背包页还是老样子，上限 26
      const ext = D.bagExtra(R.shell, R.pas), bw = R.bag.w, bh = R.bag.h, pr = D.pouchR(R), kc = R.keycase, PKW = 198;
      // 搜刮页底下三样和背包同样大的格子（用户 2026-11-17："下面的三个和上面的格子一样大，可以延展"）：保险箱在左，子弹袋、门禁卡包叠在它右边；
      // 面板往下伸到快贴屏幕底（640×360 里顶 58、底不过 352，格子的竖向预算 172 = 扣掉标题、内边距、右边两行小标题）
      // 保险箱比右边两行还高（3×3、4×4）时，高度由保险箱定，右边多出来的那行小标题不占竖向，预算多给 18
      const stackH = pr.h + (kc ? kc.h : 0), miniW = R.safe.w + Math.max(pr.w, kc ? kc.w : 0), miniH = Math.max(R.safe.h, stackH), vb = 172 + (R.safe.h > stackH ? 18 : 0);
      const cell = cont ? Math.max(12, Math.min(26, Math.floor(PKW / bw), Math.floor((PKW - 8) / miniW), Math.floor(vb / (bh + miniH)))) :Math.max(14, Math.min(26, Math.floor(190 / bw), Math.floor(196 / bh)));
      // 搜刮页没有机器人：装备槽挤成两列（主武器 / 近战 / 护甲 / 背包 | Q / E / 被动）；背包页还是转台两边的老位置
      const POS = cont ? { gun: [4, 4, 46, 38], melee: [4, 46, 46, 38], armor: [4, 88, 46, 38], bag: [4, 130, 46, 38], q: [54, 4, 46, 38], e: [54, 46, 46, 38] } : { gun: [2, 22, 44, 52], melee: [2, 80, 44, 48], bag: [2, 134, 44, 52], armor: [2, 192, 44, 52], q: [190, 22, 44, 50], e: [190, 78, 44, 50] };
      const PAS = cont ? [54, 88] : [190, 136], slot = k => slotHTML(k, ...POS[k]);
      const slotHTML = (k, x, y, w, h) => {
        const id = k === 'bag' ? 'bag:' + L.bag : k === 'armor' ? L.armor || null : L[k] ? 'card:' + L[k] : null, it = id ? D.itemInfo(id) : null;
        const tip = it ? X.tipAttr(id, 1, k === 'bag' ? '拖一个新背包上来就换' : '右键卸下 · 拖到别的槽 · 拖到地上就丢掉（捡不回来）') : `data-tip="${esc(k === 'armor' ? '空：把护甲拖上来，或者单击背包里的护甲' : '空：把一张' + (k === 'q' || k === 'e' ? '模块卡' : '卡') + '拖上来')}"`;
        const dur = it && it.kind === 'armor' && D.armorDurHTML ? D.armorDurHTML(it) : ''; // 护甲耐久条和数字（armor-dur.js）
        const just = flashQ && flashQ.slot === k && now - flashQ.t0 < 500 ? ' just' : ''; // 刚换上：槽位亮一圈
        return `<div class="eq${it ? ' q' + it.q : ' empty'}${it && it.kind === 'armor' && it.dur <= 0 ? ' arbrk' : ''}${just}" data-eq="${k}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" ${tip}><span class="eq-k">${SLOT[k]}</span>${it ? `<img src="${infoIcon(it)}">${dur}<b class="eq-n">${esc(it.name)}</b>` : '<b class="eq-n dim">空</b>'}</div>`;
      };
      const pas = (R.pf.load.pas || []).concat([null, null, null]).slice(0, 3).map((k, i) => { const c = k ? D.CARDS[k] : null; return `<div class="eq-p${c ? ' q' + c.q : ' empty'}" ${c ? X.tipAttr('card:' + k, 1, '被动芯片只能在据点的配装页换') : 'data-tip="被动槽空着（在据点的配装页装）"'}>${c ? `<img src="${cardIcon(c)}">` : ''}</div>`; }).join('');
      const gun = D.gunId(R) ? D.CARDS[D.gunId(R)] : null, val = Math.round(D.bagValue(R)), used = D.bagUsed(R), bump = mem.val != null && (val !== mem.val || used !== mem.used) ? ' bump' : ''; mem.val = val; mem.used = used;
      const C = cont && D.CONT[cont.kind], top = cont
        ? `<div class="inv-top"><b>${esc(C.name)}</b><span>${esc(SH.name)} ${esc(SH.code || '')}</span><i>单击拿 · 拖到槽上换 · 右键丢 · R 转 · F / Esc 关</i></div>`
        : `<div class="inv-top"><b>背包</b><span>${esc(SH.name)} ${esc(SH.code || '')}</span><i>拖到装备槽换上 · 右键丢掉（捡不回来） · 拖动时按 R 旋转 · Tab 关上</i></div>`;
      const nbList = `<div class="nb-list" data-drop="ground">${gnd.length ? gnd.map((g, i) => { const it = D.itemInfo(g.id); return `<div class="nb-it q${it.q}${X.cmb ? X.cmb(g.id).cls : ''}" data-gi="${i}" ${X.tipAttr(g.id, g.n, '单击捡起 · 拖到装备槽直接换上')}><img src="${infoIcon(it)}">${X.cmb ? X.cmb(g.id).html : ''}<span>${esc(it.name)}</span>${g.n > 1 ? `<b>×${g.n}</b>` : ''}</div>`; }).join('') : '<div class="nb-none">脚边没有能捡的东西</div>'}</div>`;
      const left = cont ? contCol(S, cont, nbList) : `<div class="inv-col nb"><h4>附近</h4>${nbList}</div>`;
      el.innerHTML = `${top}${cont ? '<i class="inv-alarm">有人在攻击你！</i>' : ''}${left}
        <div class="inv-col me">${cont ? '' : `<canvas class="inv-cv" width="${CW}" height="${CH}"></canvas>`}
          ${slot('gun')}${slot('melee')}${slot('bag')}${slot('armor')}${slot('q')}${slot('e')}
          <div class="eq-pas" style="left:${PAS[0]}px;top:${PAS[1]}px"><span class="eq-k">被动</span>${pas}</div>
          <div class="inv-stat"><span>耐久 <b>${Math.ceil(p.hp)}/${p.maxHp}</b></span><span>护盾 <b>${Math.round(p.shield)}</b></span>${L.armor ? (a => `<span>护甲 <b>${a.lv} 级 ${a.dur}/${a.max}</b></span>`)(D.Armor.parse(L.armor)) : ''}${gun ? `<span>${esc(gun.name)} <b>${p.mag}/${D.gunOf(R.pf, D.gunId(R), R).mag}</b></span>` : ''}</div></div>
        <div class="inv-col pk" style="--cell:${cell}px"><h4 class="pk-h${bump}">${esc(D.BAGS[L.bag].name)} <em>${used}/${D.bagCap(R)} 格 · ${val}</em>${ext[0] || ext[1] ? `<em class="ext">型号加 ${ext[0]}×${ext[1]}</em>` : ''}</h4>
          ${gridHTML('bag', R.bag, { click: e => cont ? clickLoot(S, e, cont) : clickItem(S, e), rclick: e => D.dropToGround(S, R.bag, e) })}
          ${(() => { // 子弹袋、保险箱、门禁卡包：搜刮页并排一行（pk-mini，小格 rc），背包页还是子弹袋一行 + 保险箱 / 门禁卡包一行
            const back = g => e => { if (!GR().move(g, e, R.bag)) { sfx('nope'); U.toast('背包放不下'); } else sfx('click'); };
            const pouchG = gridHTML('pouch', pr, { accept: e => D.isAmmo(e.id), click: back(pr) }), safeG = gridHTML('safe', R.safe, { click: back(R.safe) });
            const kcB = kc ? `<div><h4 class="kc-h">门禁卡包</h4>${gridHTML('keycase', kc, { accept: e => D.isKey(e.id), click: back(kc) })}</div>` : '';
            return cont
              ? `<div class="pk-row pk-mini"><div data-tip="死了也留着"><h4 class="safe-h">保险箱</h4>${safeG}</div><div class="pk-stack"><div data-tip="只放弹药 · 从左往右用 · 拖动排顺序"><h4 class="kc-h">子弹袋</h4>${pouchG}</div>${kcB}</div></div>`
              : `<h4 class="kc-h">子弹袋 <em>只放弹药 · 从左往右用 · 拖动排顺序</em></h4>${pouchG}<div class="pk-row"><div><h4 class="safe-h">保险箱 <em>死了也留着</em></h4>${safeG}</div>${kcB}</div>`;
          })()}</div>`;
      el.querySelectorAll('[data-gi]').forEach(n => n.addEventListener('pointerdown', ev => startDrag(ev, S, { from: 'ground', g: gnd[+n.dataset.gi], el: n })));
      el.querySelectorAll('.eq[data-eq]').forEach(n => { n.addEventListener('pointerdown', ev => { if (ev.button === 0 && !n.classList.contains('empty')) startDrag(ev, S, { from: 'slot', slot: n.dataset.eq, el: n }); }); n.addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); if (unequip(S, n.dataset.eq)) U.refresh(); }); });
      if (!cont) drawModel(el.querySelector('.inv-cv'), S, look); // 搜刮页不画机器人（也就没有它的扫描线）
      X.retip();
      setTimeout(() => el.classList.remove('opening'), 520);
    };
    state._render = render;
    render(); if (cont) watchHit(el, S, state); sfx(cont ? 'rummage' : 'open_soft');
  }
  // ── 搜刮：左边的箱子一列（箱子的样子、搜到第几样、一条进度、格子）
  function contCol(S, c, nbList) {
    const vis = c.items.filter(o => o.seen !== false), hid = c.items.length - vis.length, opening = c.openT != null && c.openT < D.OPEN_DUR;
    const cc = Math.max(12, Math.min(28, Math.floor(140 / c.grid.w), Math.floor(176 / c.grid.h))); // 格子上限 22 → 30 → 28（5 格宽的箱子不超过 140 像素，省下的宽度给右边背包）。没有标题了：名字在顶栏，搜到第几样靠 busy 标记和扫描线
    return `<div class="inv-col ct${hid || opening ? ' busy' : ''}" style="--cell:${cc}px">
      <div class="ct-g">${gridHTML('cont', c.grid, { click: e => takeFromCont(S, c, e), rclick: e => D.dropToGround(S, c.grid, e), accept: () => true })}</div>
      <div class="ct-nb"><h4>脚边</h4>${nbList}</div></div>`;
  }
  // 搜刮页：有人在打你（S.attackedAt 是最近一次挨打 / 被瞄准的游戏时间）→ 外框标红、亮"有人在攻击你！"。每 50 毫秒看一次，不用等整页重画（用计时器不用 rAF：无头 / 后台时 rAF 可能不转）
  function watchHit(el, S, state) {
    if (wint) clearInterval(wint);
    const step = () => {
      if (!el.isConnected || S.lootOpen !== state) { clearInterval(wint); wint = 0; return; }
      el.classList.toggle('under', S.attackedAt != null && S.t - S.attackedAt < HIT_SEC);
    };
    step(); wint = setInterval(step, 50);
  }
  // 箱子里单击：拿进背包（背包类就直接换上，放不下的留在箱子里）；图标飞进背包那一格
  function takeFromCont(S, c, e) {
    const R = S.raid; if (e.seen === false) return;
    if (e.id.startsWith('bag:')) { swapBagFromCont(S, c, e); return; }
    const r0 = cellRect('cont', c.grid, e), id = e.id;
    if (!D.takeToBag(R, c.grid, e)) { sfx('nope'); U.toast('背包放不下'); } else { sfx('coin'); flyAfter(r0, 'bag', R.bag, id); } // 弹药先进子弹袋
  }
  function swapBagFromCont(S, c, e) {
    const R = S.raid, nb = D.BAGS[e.id.slice(4)], old = R.load.bag;
    const ext = D.bagExtra(R.shell, R.pas), { grid, over } = GR().repack(R.bag, nb.gw + ext[0], nb.gh + ext[1]);
    GR().remove(c.grid, e);
    R.bag.w = grid.w; R.bag.h = grid.h; R.bag.items.length = 0; R.bag.items.push(...grid.items);
    R.load.bag = e.id.slice(4); R.pf.load.bag = R.load.bag;
    for (const o of over) GR().add(c.grid, o.id, o.n);
    if (!D.BAGS[old].free) GR().add(c.grid, 'bag:' + old, 1);
    for (const o of c.items) if (o.seen == null) o.seen = true;
    U.toast(over.length ? `换上了${nb.name}，放不下的留在箱子里` : `换上了${nb.name}`); sfx('power'); D.playerAct(S.player, 'swap', 0.5, 'bag'); flash('bag', nb.q);
  }
  // 搜刮时背包里单击：能装的（枪、近战、模块、背包、护甲）直接换上，别的放回箱子
  function clickLoot(S, e, c) {
    const id = e.id, R = S.raid;
    if (D.isWeaponCard(id) || id.startsWith('bag:') || isArmor(id) || (id.startsWith('card:') && D.CARDS[id.slice(5)] && D.CARDS[id.slice(5)].slot === 'mod')) return clickItem(S, e);
    const r0 = cellRect('bag', R.bag, e);
    if (!GR().move(R.bag, e, c.grid)) { sfx('nope'); U.toast('箱子放不下'); } else { sfx('click'); flyAfter(r0, 'cont', c.grid, id); }
  }
  // ── 飞的动画：图标沿一道弧从原来那格飞到新的那格，落点闪一下（10 步的阶梯，像素风不糊）
  function cellRect(key, grid, e) { const i = grid.items.indexOf(e), n = i >= 0 && root.querySelector(`.inv .ggrid[data-g="${key}"] .gi[data-i="${i}"]`); return n ? n.getBoundingClientRect() : null; }
  function flyAfter(r0, key, grid, id, delay) {
    if (!r0) return;
    requestAnimationFrame(() => setTimeout(() => {
      let i = -1; for (let k = grid.items.length - 1; k >= 0; k--) if (grid.items[k].id === id) { i = k; break; }
      const dest = i >= 0 && root.querySelector(`.inv .ggrid[data-g="${key}"] .gi[data-i="${i}"]`); if (!dest) return;
      const box = root.getBoundingClientRect(), k = box.width / (root.offsetWidth || box.width) || 1, L = r => ({ x: (r.left - box.left) / k, y: (r.top - box.top) / k, w: r.width / k, h: r.height / k });
      const a = L(r0), b = L(dest.getBoundingClientRect()), it = D.itemInfo(id), fx = document.createElement('div');
      fx.className = 'inv-fly q' + it.q; fx.innerHTML = `<img src="${infoIcon(it)}">`; root.appendChild(fx);
      const S0 = 20, x0 = a.x + a.w / 2 - S0 / 2, y0 = a.y + a.h / 2 - S0 / 2, x1 = b.x + b.w / 2 - S0 / 2, y1 = b.y + b.h / 2 - S0 / 2, top = Math.min(y0, y1) - 26, kf = [];
      for (let s = 0; s <= 10; s++) { const u = s / 10, x = Math.round(x0 + (x1 - x0) * u), y = Math.round((1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * top + u * u * y1), sc = s === 10 ? 0.7 : 1 + Math.sin(u * Math.PI) * 0.35; kf.push({ transform: `translate(${x}px, ${y}px) scale(${sc.toFixed(2)})` }); }
      fx.animate(kf, { duration: 300, easing: 'steps(10, end)', fill: 'forwards' }).onfinish = () => { fx.remove(); if (dest.isConnected) { dest.classList.remove('landed'); void dest.offsetWidth; dest.classList.add('landed'); } };
    }, delay || 0));
  }
  // 背包格子里单击：枪、近战、模块、背包直接换上；别的放进保险箱（原来就是这样）
  function clickItem(S, e) {
    const R = S.raid, id = e.id;
    if (D.isWeaponCard(id)) { D.equipFromBag(S, R.bag, e); flash(D.CARDS[id.slice(5)].slot, D.itemInfo(id).q); return; }
    if (id.startsWith('card:') && D.CARDS[id.slice(5)] && D.CARDS[id.slice(5)].slot === 'mod') { const slot = !R.load.q ? 'q' : !R.load.e ? 'e' : 'q'; equip(S, slot, id, () => GR().remove(R.bag, e)); return; }
    if (id.startsWith('bag:')) { swapBag(S, id, () => GR().remove(R.bag, e)); return; }
    if (isArmor(id)) { GR().remove(R.bag, e); D.Armor.wear(S, id, x => putBack(S, x)); flash('armor', D.itemInfo(id).q); return; }
    if (D.isAmmo(id) && GR().move(R.bag, e, D.pouchR(R))) { sfx('click'); return; } // 弹药先进子弹袋
    if (!GR().move(R.bag, e, R.safe)) { sfx('nope'); U.toast('保险箱放不下'); } else sfx('click');
  }

  // ── 从背包格子拖出来（ui.js 的拖动）：放到装备槽 = 换上，放到"附近" = 丢在地上
  const at = (cx, cy) => { const n = document.elementFromPoint(cx, cy); return n && n.closest ? n : null; };
  U.dragHover = function (cx, cy, e) {
    if (!root) return; root.querySelectorAll('.eq.hot, .eq.bad, .nb-list.hot').forEach(n => n.classList.remove('hot', 'bad'));
    if (!e || !root.querySelector('.inv')) return;
    const n = at(cx, cy); if (!n) return; const s = n.closest('.eq[data-eq]'), g = n.closest('.nb-list');
    if (s) s.classList.add(fits(s.dataset.eq, e.id) ? 'hot' : 'bad'); else if (g) g.classList.add('hot');
  };
  U.dragDrop = function (cx, cy, key, grid, e) {
    const S = G && G.S; if (!S || !root.querySelector('.inv')) return false;
    const n = at(cx, cy); if (!n) return false; const s = n.closest('.eq[data-eq]'), g = n.closest('.nb-list');
    if (s) { equip(S, s.dataset.eq, e.id, () => GR().remove(grid, e)); return true; }
    if (g && key === 'bag') { D.dropToGround(S, grid, e); return true; }
    return false;
  };
  // ── 从装备槽、地上拖出来（自己画一个跟着鼠标的图标）
  function startDrag(ev, S, src) {
    if (ev.button !== 0) return; ev.preventDefault();
    const id = src.from === 'ground' ? src.g.id : src.slot === 'bag' ? 'bag:' + S.raid.load.bag : src.slot === 'armor' ? S.raid.load.armor : 'card:' + S.raid.load[src.slot];
    drag = { S, src, id, sx: ev.clientX, sy: ev.clientY, moved: false, ghost: null };
    window.addEventListener('pointermove', dragMove); window.addEventListener('pointerup', dragUp, { once: true });
  }
  function dragMove(ev) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 5) {
      drag.moved = true; hideTip(); drag.src.el.classList.add('dragging');
      const g = document.createElement('div'); g.className = 'inv-ghost q' + D.itemInfo(drag.id).q; g.innerHTML = `<img src="${infoIcon(D.itemInfo(drag.id))}">`; root.appendChild(g); drag.ghost = g;
    }
    if (!drag.moved) return;
    const rb = root.getBoundingClientRect(), k = rb.width / root.offsetWidth || 1;
    drag.ghost.style.left = Math.round((ev.clientX - rb.left) / k - 12) + 'px'; drag.ghost.style.top = Math.round((ev.clientY - rb.top) / k - 12) + 'px';
    root.querySelectorAll('.eq.hot, .eq.bad, .ggrid.hot, .nb-list.hot').forEach(n => n.classList.remove('hot', 'bad'));
    const n = at(ev.clientX, ev.clientY); if (!n) return;
    const s = n.closest('.eq[data-eq]'), b = n.closest('.ggrid[data-g="bag"]'), gl = n.closest('.nb-list'), cg = n.closest('.ggrid[data-g="cont"]');
    if (s && s.dataset.eq !== drag.src.slot) s.classList.add(fits(s.dataset.eq, drag.id) ? 'hot' : 'bad'); else if (b && drag.src.slot !== 'bag') b.classList.add('hot'); else if ((gl || cg) && drag.src.from === 'slot' && drag.src.slot !== 'bag') (gl || cg).classList.add('hot');
  }
  function dragUp(ev) {
    window.removeEventListener('pointermove', dragMove);
    const d = drag; drag = null; if (!d) return;
    if (d.ghost) d.ghost.remove(); if (d.src.el) d.src.el.classList.remove('dragging');
    root.querySelectorAll('.eq.hot, .eq.bad, .ggrid.hot, .nb-list.hot').forEach(n => n.classList.remove('hot', 'bad'));
    const S = d.S, R = S.raid;
    if (!d.moved) { if (d.src.from === 'ground') { D.takeGround(S, d.src.g); } U.refresh(); return; } // 单击地上的东西：捡起来
    const n = at(ev.clientX, ev.clientY), s = n && n.closest('.eq[data-eq]'), b = n && n.closest('.ggrid[data-g="bag"]'), gl = n && n.closest('.nb-list'), cg = n && n.closest('.ggrid[data-g="cont"]');
    if (d.src.from === 'ground') {
      const g = d.src.g, take = () => { const i = S.ground.indexOf(g); if (i >= 0) S.ground.splice(i, 1); S.groundNear = S.groundNear.filter(o => o !== g); };
      if (s) equip(S, s.dataset.eq, g.id, take); else if (b) D.takeGround(S, g);
    } else {
      const from = d.src.slot;
      if (s && s.dataset.eq !== from) {
        const to = s.dataset.eq; // Q 和 E 对调
        if ((from === 'q' || from === 'e') && (to === 'q' || to === 'e')) { const a = R.load[from]; R.load[from] = R.load[to]; R.load[to] = a; R.pf.load[from] = R.load[from]; R.pf.load[to] = R.load[to]; modIcons(S); flash(to, D.itemInfo(d.id).q); sfx('click'); }
        else sfx('nope');
      } else if (b) unequip(S, from);
      else if (gl) unequip(S, from, true);
      else if (cg && S.lootOpen && S.lootOpen.grid) unequip(S, from, false, S.lootOpen.grid); // 搜刮时拖回箱子
    }
    U.refresh();
  }

  // ── 转台上的机器人：跟着鼠标转身（一档一档转）、待机动画、扫描线；刚打开时从上往下扫出来；换装备时闪一下、冒火花
  function drawModel(cv, S, look) {
    if (!cv) return;
    const cx = cv.getContext('2d'), px = (x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), w, h); };
    const ell = (x0, y0, rx, ry, c) => { for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2))); px(x0 - w, y0 + y, w * 2 + 1, 1, c); } };
    if (raf) cancelAnimationFrame(raf);
    const draw = now => {
      if (!cv.isConnected) { raf = 0; return; }
      const t = now / 1000, age = (now - look.t0) / 1000;
      if (look.mx != null) { const r = cv.getBoundingClientRect(), mx = look.mx - (r.left + r.width / 2), my = look.my - (r.top + r.height * 0.62); look.to = Math.hypot(mx, my) < 10 ? 8 : D.heroDir(Math.atan2(my, mx)); }
      if (look.to !== look.dir && now - look.stepT > 60) { const i = RING.indexOf(look.dir), j = RING.indexOf(look.to), d = (j - i + 8) % 8 <= 4 ? 1 : -1; look.dir = RING[(i + d + 8) % 8]; look.stepT = now; }
      const SH = S.SH, H = D.heroOf(SH.key, S.mods), V = H.variant(SH.tint, SH.visor), lst = H.meta['idle' + look.dir] || H.meta.idle8;
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false; cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      cv.dataset.dir = look.dir; // 一键测试看它有没有跟着鼠标转
      // 背景：墙板、顶灯打下来的一束光、转台
      px(0, 0, CW, CH, '#0b0d16'); for (let x = 8; x < CW; x += 16) px(x, 0, 1, 64, '#121626'); px(0, 30, CW, 1, '#121626');
      for (let y = 0; y < 70; y++) { const w = 5 + Math.round(y * 0.24); if (y % 2 === 0) px(FX - w, y, w * 2, 1, '#151a2c'); }
      px(FX - 6, 0, 12, 2, '#3a4266'); px(FX - 4, 2, 8, 1, '#ffe7b8');
      ell(FX, FY + 2, 22, 4, '#0e1019'); ell(FX, FY + 1, 22, 4, '#1a1e31'); ell(FX, FY, 22, 4, '#262c46'); ell(FX, FY, 17, 3, '#2e3554');
      for (let i = 0; i < 12; i++) { const a = t * 0.6 + i * Math.PI / 6, s = Math.sin(a); px(FX + Math.cos(a) * 20, FY + s * 3.5, 1, 1, s > 0 ? '#3ee8ff' : '#1d5a6a'); }
      if (lst && H.img) {
        const s = lst[Math.floor(t * 8) % lst.length], sx = (s % H.cols) * H.fw, sy = Math.floor(s / H.cols) * H.fh, ox = FX - (H.fw >> 1), oy = FY - H.footY;
        const rev = Math.min(1, age / 0.35), rows = Math.round(H.fh * rev); // 刚打开：从上往下扫出来
        if (rows > 0) { cx.drawImage(V.img, sx, sy, H.fw, rows, ox, oy, H.fw, rows); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 3); cx.drawImage(V.emit, sx, sy, H.fw, rows, ox, oy, H.fw, rows); cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1; }
        if (rev < 1) px(ox - 2, oy + rows, H.fw + 4, 1, '#3ee8ff');
        const F = flashQ && now - flashQ.t0 < 450 ? flashQ : null;
        if (F) { const k = (now - F.t0) / 450; if (k < 0.35 && H.flash) { cx.globalAlpha = (1 - k / 0.35) * 0.8; cx.drawImage(H.flash, sx, sy, H.fw, H.fh, ox, oy, H.fw, H.fh); cx.globalAlpha = 1; } for (let i = 0; i < 12; i++) { const a = i * 2.399, v = 20 + (i * 7) % 16; px(FX + Math.cos(a) * v * k, FY - 22 + Math.sin(a) * v * k * 0.7 + 30 * k * k, 1, 1, i % 3 ? F.col : '#fff0c8'); } }
      }
      const u = (t % 3) / 1.4; if (u < 1) { cx.globalAlpha = 0.35; px(FX - 14, 18 + u * 58, 29, 1, '#3ee8ff'); cx.globalAlpha = 1; }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }
})(D);
