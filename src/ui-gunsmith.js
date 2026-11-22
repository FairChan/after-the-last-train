/* 末班之后 · 小样二：改枪台（试玩反馈二）
   配装页点"改枪台"进来：大图看枪，枪口 / 弹匣 / 瞄具 / 枪托四个挂点直接画在枪上，配件装上去会滑进位置、闪一下。
   右边是这个挂点能装的所有配件：仓库里有的直接装、优良精良的能直接买、工作台够级的能当场做；鼠标移上去，下面的数值条预览装上后的变化。
   规则（配件数值、买、做）都在 growth.js，这里只管画和交互。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip, infoIcon, GR } = X;
  let root, G, raf = 0;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  X.hooks.clear.push(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; } });
  const RA = () => D.RAMP;
  const CW = 120, CH = 48; // 画枪的像素画布（放大显示）

  // ── 枪的底子：机匣、枪管、握把，和四个挂点的位置
  const GUNS = {
    nailgun: { ramp: 'yellow', acc: 'dark', rw: 24, rh: 10, len: 10, th: 3, stock: false, glow: null },
    smg:     { ramp: 'gunmetal', acc: 'dark', rw: 26, rh: 8, len: 10, th: 3, stock: true, glow: null },
    shotgun: { ramp: 'crate', acc: 'gunmetal', rw: 22, rh: 9, len: 30, th: 4, stock: true, pump: true, glow: null },
    pulse:   { ramp: 'white', acc: 'blue', rw: 32, rh: 10, len: 14, th: 4, stock: true, glow: '#3ee8ff' },
    railgun: { ramp: 'steel', acc: 'dark', rw: 30, rh: 10, len: 32, th: 3, stock: true, rails: true, glow: '#3ee8ff' },
    sniper:  { ramp: 'olive', acc: 'gunmetal', rw: 28, rh: 8, len: 34, th: 2, stock: true, glow: null },
    plasma:  { ramp: 'magenta', acc: 'dark', rw: 28, rh: 12, len: 10, th: 6, stock: true, glow: '#ff6af0' },
    revolver: { ramp: 'silver', acc: 'cloth', rw: 18, rh: 9, len: 16, th: 3, stock: false, glow: null },
    dbarrel: { ramp: 'gunmetal', acc: 'cloth', rw: 20, rh: 9, len: 32, th: 5, stock: true, glow: null },
    xbow:    { ramp: 'cloth', acc: 'steel', rw: 30, rh: 6, len: 8, th: 2, stock: true, glow: null },
    burst:   { ramp: 'olive', acc: 'dark', rw: 30, rh: 9, len: 16, th: 3, stock: true, glow: null },
    ricochet:{ ramp: 'copper', acc: 'dark', rw: 24, rh: 10, len: 14, th: 4, stock: false, glow: '#ffd84a' },
    hookgun: { ramp: 'gunmetal', acc: 'yellow', rw: 24, rh: 10, len: 12, th: 5, stock: false, glow: null },
    flamer:  { ramp: 'red', acc: 'gunmetal', rw: 28, rh: 12, len: 18, th: 4, stock: true, glow: '#ff8a2e' },
    gl:      { ramp: 'olive', acc: 'gunmetal', rw: 26, rh: 13, len: 14, th: 8, stock: true, glow: null },
    emshot:  { ramp: 'blue', acc: 'dark', rw: 30, rh: 10, len: 18, th: 5, stock: true, glow: '#ffd84a' },
    minigun: { ramp: 'gunmetal', acc: 'dark', rw: 26, rh: 14, len: 30, th: 6, stock: false, rails: true, glow: null },
    smart:   { ramp: 'white', acc: 'dark', rw: 30, rh: 12, len: 12, th: 4, stock: true, glow: '#3ee8ff' },
  };
  function layout(gun) {
    const g = GUNS[gun] || GUNS[D.cardBase ? D.cardBase(gun) : gun] || GUNS.smg, total = g.rw + g.len, x0 = Math.round((CW - total) / 2) + 6, y0 = 19;
    return { g, x0, y0, sight: [x0 + Math.round(g.rw * 0.45), y0], mag: [x0 + Math.round(g.rw * 0.62), y0 + g.rh], stock: [x0, y0 + 3], muzzle: [x0 + g.rw + g.len, y0 + 2 + (g.th >> 1)], grip: [x0 + Math.round(g.rw * 0.2), y0 + g.rh] };
  }
  const cache = {};
  function baseImg(gun) {
    if (cache['b' + gun]) return cache['b' + gun];
    const L = layout(gun), g = L.g, R = RA(), p = D.Paint(CW, CH), a = R[g.ramp], b = R[g.acc];
    p.box(L.x0 + g.rw - 2, L.y0 + 2, g.len + 2, g.th, R.gunmetal, { r: 1 }); // 枪管
    if (g.rails) { p.box(L.x0 + g.rw - 2, L.y0 + 1 + g.th + 1, g.len, 2, R.steel); for (let i = 0; i < 5; i++) p.rect(L.x0 + g.rw + 4 + i * 6, L.y0 + 1, 2, g.th + 4, '#3ee8ff', 1); }
    if (g.pump) p.box(L.x0 + g.rw + 4, L.y0 + 2 + g.th, 12, 4, R.crate, { r: 1 });
    p.box(L.x0, L.y0, g.rw, g.rh, a, { r: 2 }); // 机匣
    p.rect(L.x0 + 3, L.y0 + 2, g.rw - 8, 1, a[a.length - 1]);
    if (g.glow) { p.rect(L.x0 + 4, L.y0 + g.rh - 4, g.rw - 10, 2, g.glow, 1); }
    p.box(L.grip[0] - 2, L.grip[1] - 1, 6, 11, b, { r: 1 }); // 握把
    p.line(L.grip[0] + 5, L.grip[1] + 1, L.grip[0] + 9, L.grip[1] + 1, R.gunmetal[3]); // 扳机护圈
    p.rect(L.sight[0] - 1, L.sight[1] - 2, 3, 2, R.gunmetal[2]); // 机械瞄具（没装瞄具时看得到）
    p.box(L.mag[0] - 3, L.mag[1] - 1, 6, 6, R.dark); // 原装弹匣
    if (g.stock) p.box(L.stock[0] - 6, L.stock[1] - 1, 7, 5, b, { r: 1 }); // 托座
    p.outline();
    return (cache['b' + gun] = p.make(1));
  }
  // ── 配件的样子：每个配件一个小图和它的挂点偏移
  function partImg(key) {
    if (cache['p' + key]) return cache['p' + key];
    const A = D.ATT[key], R = RA(), q = A.q, p = D.Paint(40, 24), col = D.QUALITY[q].col, metal = [R.gunmetal, R.gunmetal, R.steel, R.dark, R.gold][q] || R.gunmetal;
    let ax = 0, ay = 0;
    switch (key) {
      case 'comp': p.box(0, 9, 7, 6, metal, { r: 1 }); for (let i = 0; i < 3; i++) p.rect(1 + i * 2, 10, 1, 2, '#0b0a14'); ax = 0; ay = 12; break;
      case 'hider': p.box(0, 10, 4, 4, metal); for (const y of [8, 11, 14]) p.rect(4, y, 4, 1, metal[3]); ax = 0; ay = 12; break;
      case 'supp': p.box(0, 8, 16, 7, metal, { r: 2 }); p.rect(2, 9, 12, 1, metal[4]); ax = 0; ay = 11; break;
      case 'barrel': p.box(0, 10, 14, 3, R.gunmetal, { r: 1 }); p.box(12, 9, 3, 5, metal); ax = 0; ay = 11; break;
      case 'brake': p.box(0, 7, 10, 9, metal, { r: 1 }); for (let i = 0; i < 3; i++) { p.rect(2 + i * 3, 8, 1, 2, '#0b0a14'); p.rect(2 + i * 3, 13, 1, 2, '#0b0a14'); } ax = 0; ay = 11; break;
      case 'coil': p.box(0, 9, 14, 5, R.dark, { r: 1 }); for (let i = 0; i < 4; i++) p.rect(1 + i * 3, 7, 2, 9, '#3ee8ff', 1); ax = 0; ay = 11; break;
      case 'extmag': p.box(17, 0, 7, 12, metal); p.rect(18, 9, 5, 1, col); ax = 20; ay = 0; break;
      case 'quickmag': p.box(17, 0, 7, 9, metal); p.rect(18, 9, 5, 3, '#e3c14a'); ax = 20; ay = 0; break;
      case 'drum': p.box(18, 0, 5, 4, metal); p.ell(20, 9, 6, 6, metal); p.disc(20, 9, 2, col); ax = 20; ay = 0; break;
      case 'twinmag': p.box(15, 0, 6, 10, metal); p.box(21, 0, 6, 10, metal); p.rect(16, 7, 10, 1, col); ax = 21; ay = 0; break;
      case 'hpmag': p.box(17, 0, 7, 11, metal); p.rect(19, 2, 2, 7, '#ff6a6a', 1); ax = 20; ay = 0; break;
      case 'qmag': p.box(16, 0, 9, 10, R.dark, { r: 2 }); p.rect(18, 2, 5, 6, '#ff6af0', 1); ax = 20; ay = 0; break;
      case 'reddot': p.box(16, 14, 8, 6, metal, { r: 1 }); p.rect(18, 15, 3, 3, '#1d4a60'); p.px(19, 16, '#ff3047', 1); ax = 20; ay = 20; break;
      case 'holo': p.box(14, 14, 12, 6, metal); p.rect(16, 12, 8, 3, metal[3]); p.rect(17, 13, 6, 1, '#3ee8ff', 1); ax = 20; ay = 20; break;
      case 'x4': p.box(10, 14, 20, 5, metal, { r: 2 }); p.box(9, 13, 3, 7, metal); p.box(28, 13, 3, 7, metal); p.px(9, 15, '#a6e2f0', 1); p.rect(18, 19, 4, 2, metal[2]); ax = 20; ay = 21; break;
      case 'thermal': p.box(10, 12, 20, 7, R.olive, { r: 2 }); p.box(28, 12, 3, 7, R.dark); p.rect(28, 14, 2, 3, '#ff7a2e', 1); p.rect(18, 19, 4, 2, R.dark[2]); ax = 20; ay = 21; break;
      case 'ranger': p.box(11, 14, 18, 5, metal, { r: 2 }); p.box(14, 10, 8, 4, R.dark); p.px(20, 11, '#ff3047', 1); p.rect(18, 19, 4, 2, metal[2]); ax = 20; ay = 21; break;
      case 'smart': p.box(12, 11, 16, 8, R.dark, { r: 2 }); p.rect(14, 13, 12, 4, '#3ee8ff', 1); p.rect(18, 19, 4, 2, R.dark[3]); ax = 20; ay = 21; break;
      case 'fold': p.line(24, 10, 34, 8, metal[3]); p.line(24, 14, 34, 16, metal[3]); p.rect(34, 8, 2, 9, metal[3]); ax = 24; ay = 12; break;
      case 'tstock': p.box(24, 8, 12, 8, metal, { r: 1 }); p.box(34, 7, 3, 11, R.dark); ax = 24; ay = 12; break;
      case 'shock': p.box(24, 9, 8, 6, metal); for (let i = 0; i < 3; i++) p.rect(32 + i, 8, 1, 8, metal[4 - i]); p.box(35, 7, 3, 11, R.dark); ax = 24; ay = 12; break;
      case 'hydstock': p.box(24, 9, 13, 6, R.red, { r: 1 }); p.rect(26, 11, 8, 2, '#c8cdda'); p.box(35, 7, 3, 11, R.dark); ax = 24; ay = 12; break;
      case 'carbon': p.box(24, 8, 14, 8, R.dark, { r: 2 }); p.line(26, 9, 36, 15, '#3d4766'); ax = 24; ay = 12; break;
      case 'gyro': p.box(24, 8, 12, 8, R.dark, { r: 1 }); p.ell(32, 12, 4, 4, R.gold, { spec: true }); p.disc(32, 12, 1.5, '#ffd860', 1); ax = 24; ay = 12; break;
    }
    p.outline();
    // 枪托的图往左长（挂点在图的右边）：整体翻到挂点左边
    return (cache['p' + key] = Object.assign(p.make(1), { ax, ay, left: A.slot === 'stock' }));
  }

  // ── 页面
  const STAT = [
    ['伤害', g => g.dmg * g.n, 60, false, v => v.toFixed(1)], ['射速', g => 1 / g.rate, 15, false, v => v.toFixed(1) + '/s'], ['稳定', g => 1 / (g.spread + 0.02), 40, false, v => Math.round(v)],
    ['弹匣', g => g.mag, 60, false, v => Math.round(v)], ['换弹', g => g.reload, 2.6, true, v => v.toFixed(2) + 's'], ['射程', g => g.life * g.speed / 10, 80, false, v => Math.round(v)], ['枪声', g => g.noise, 3.6, true, v => v.toFixed(1)],
  ];
  const ownedGuns = pf => { const s = new Set([...D.loadGuns(pf.load), 'nailgun']); for (const e of pf.stash.items) if (e.id.startsWith('card:') && D.CARDS[e.id.slice(5)] && D.CARDS[e.id.slice(5)].slot === 'gun') s.add(e.id.slice(5)); return [...s]; };
  const previewGun = (pf, gun, slot, key) => { const a = Object.assign({}, D.gunAtt(pf, gun)); if (key) a[slot] = key; else delete a[slot]; return D.gunOf({ grow: { att: { [gun]: a } } }, gun); };

  U.gunsmith = function (pf, body) {
    const guns = ownedGuns(pf); let gun = guns.includes(G.gsGun) ? G.gsGun : (D.loadGun(pf.load) || 'nailgun'); G.gsGun = gun;
    const slot = D.ATT_SLOTS[G.gsSlot] ? G.gsSlot : 'muzzle', a = D.gunAtt(pf, gun), C = D.CARDS[gun], cur = D.gunOf(pf, gun);
    const keys = Object.keys(D.ATT).filter(k => D.ATT[k].slot === slot).sort((x, y) => D.ATT[x].q - D.ATT[y].q);
    const shop = D.Growth ? Object.fromEntries(D.Growth.shop(pf).map(o => [o.id, o.price])) : {};
    const row = k => {
      const A = D.ATT[k], id = 'att:' + k, have = GR().count(pf.stash, x => x === id), on = a[slot] === k, cc = D.canCraft(pf, k), r = D.recipe(k);
      let act;
      if (on) act = '<button class="btn sm" data-gs-off="1">卸下</button>';
      else if (have) act = `<button class="btn sm primary" data-gs-fit="${k}">装上</button>`;
      else if (shop[id] != null) act = `<button class="btn sm${pf.money >= shop[id] ? '' : ' poor'}" data-gs-buy="${k}">买 · ${shop[id]}</button>`;
      else if (cc === 'ok' || cc === 'poor') act = `<button class="btn sm${cc === 'ok' ? '' : ' poor'}" data-gs-craft="${k}" data-tip="${esc('零件 ' + r.money + ' + ' + r.mats.map(([m, n]) => D.itemInfo(m).name + '×' + n).join('、'))}">制造</button>`;
      else act = `<span class="gs-why">${cc === 'no' ? '只能在城里找到' : (cc === 'lv' ? '工作台 ' + r.q + ' 级能做' : '要蓝图') + (A.q >= 3 ? ' · 城里能捡到' : '')}</span>`;
      return `<div class="gs-row q${A.q}${on ? ' on' : ''}" data-gs-hover="${k}"><img src="${infoIcon(D.itemInfo(id))}"><div class="gs-t"><b style="color:${D.QUALITY[A.q].col}">${esc(A.name)}</b>${have ? `<em>仓库 ${have}</em>` : ''}${on ? '<em class="on">装着</em>' : ''}<div>${esc(A.desc)}</div></div>${act}</div>`;
    };
    body.innerHTML = `<div class="gsmith"><div class="gs-head"><button class="btn sm" data-act="back">◀ 回配装</button><h2>改枪台</h2>
        <div class="gs-pick">${guns.length > 1 ? '<button class="btn sm" data-gs-gun="-1">◀</button>' : ''}<b>${esc(C.name)}</b>${guns.length > 1 ? '<button class="btn sm" data-gs-gun="1">▶</button>' : ''}</div>
        ${D.loadGuns(pf.load).includes(gun) ? '<span class="gs-main">装着</span>' : '<button class="btn sm" data-act="main">设为主武器</button>'}<span class="hint">配件装在"这一型枪"上；带进城损毁了，枪上的配件一起丢。</span></div>
      <div class="gs-body"><div class="gs-left"><div class="gs-stage"><canvas width="${CW * 6}" height="${CH * 6}"></canvas>${Object.keys(D.ATT_SLOTS).map(s => `<button class="gs-hot${s === slot ? ' on' : ''}${a[s] ? ' full' : ''}" data-gs-slot="${s}"><b>${D.ATT_SLOTS[s]}</b><span>${a[s] ? esc(D.ATT[a[s]].name) : '空'}</span></button>`).join('')}</div>
        <div class="gs-stats">${STAT.map(([n]) => `<div class="gs-st" data-st="${n}"><b>${n}</b><i class="bar"><i class="cur"></i><i class="pre"></i></i><span></span></div>`).join('')}</div></div>
        <div class="gs-list"><div class="cx-switch gs-tabs">${Object.keys(D.ATT_SLOTS).map(s => `<button class="tab${s === slot ? ' on' : ''}" data-gs-slot="${s}">${D.ATT_SLOTS[s]}</button>`).join('')}</div>
          <div class="gs-rows">${keys.map(row).join('')}</div><div class="hint">余额 ${pf.money} · 鼠标移到一行上，左边数值条预览装上后的变化</div></div></div></div>`;
    const $ = s => body.querySelector(s), $$ = s => body.querySelectorAll(s);
    // 数值条
    const stats = pv => { for (const [n, f, max, low, fmt] of STAT) { const el = body.querySelector(`[data-st="${n}"]`), v = f(cur), w = f(pv || cur); const pc = x => Math.round(Math.min(1, (low ? max - x : x) / max) * 100); el.querySelector('.cur').style.width = pc(v) + '%'; const pre = el.querySelector('.pre'); const d = w - v, better = low ? d < 0 : d > 0; pre.style.left = pc(Math.min(v, w) * (low ? 1 : 1)) + '%'; pre.style.width = Math.abs(pc(w) - pc(v)) + '%'; pre.style.left = Math.min(pc(v), pc(w)) + '%'; pre.className = 'pre ' + (Math.abs(d) < 1e-6 ? '' : better ? 'up' : 'down'); el.querySelector('span').innerHTML = fmt(v) + (Math.abs(d) > 1e-6 ? ` → <b class="${better ? 'ok' : 'bad'}">${fmt(w)}</b>` : ''); } };
    stats(null);
    $$('[data-gs-hover]').forEach(el => { el.onmouseenter = () => { const k = el.dataset.gsHover; stats(a[slot] === k ? previewGun(pf, gun, slot, null) : previewGun(pf, gun, slot, k)); G.gsGhost = a[slot] === k ? null : k; }; el.onmouseleave = () => { stats(null); G.gsGhost = null; }; });
    const changed = () => { G.gsAnim = { slot, t0: performance.now() }; U.refresh(); };
    $$('[data-gs-slot]').forEach(b => b.onclick = () => { D.Sfx.play('click'); G.gsSlot = b.dataset.gsSlot; G.gsGhost = null; U.refresh(); });
    $$('[data-gs-gun]').forEach(b => b.onclick = () => { const i = guns.indexOf(gun); G.gsGun = guns[(i + +b.dataset.gsGun + guns.length) % guns.length]; D.Sfx.play('click'); U.refresh(); });
    $$('[data-gs-fit]').forEach(b => b.onclick = () => { if (D.attach(pf, gun, b.dataset.gsFit)) { D.Sfx.play('power'); changed(); } else { D.Sfx.play('nope'); U.toast('仓库满了，换下来的放不下'); } });
    $$('[data-gs-off]').forEach(b => b.onclick = () => { if (D.detach(pf, gun, slot)) { D.Sfx.play('click'); U.refresh(); } else { D.Sfx.play('nope'); U.toast('仓库满了'); } });
    $$('[data-gs-buy]').forEach(b => b.onclick = () => { const k = b.dataset.gsBuy, id = 'att:' + k, price = shop[id]; D.Trade.buyFit(b, id, price, '买下后直接装到这把枪上', () => { pf.money -= price; GR().add(pf.stash, id, 1); D.attach(pf, gun, k); D.Sfx.play('power'); changed(); }); }); // 先弹确认框（trade.js）
    $$('[data-gs-craft]').forEach(b => b.onclick = () => { const k = b.dataset.gsCraft; if (D.craft(pf, k)) { D.attach(pf, gun, k); D.Sfx.play('power'); changed(); } else { D.Sfx.play('nope'); U.toast('零件或材料不够'); } });
    $('[data-act=back]').onclick = () => { D.Sfx.play('click'); G.hubTab('load'); };
    const mb = $('[data-act=main]'); if (mb) mb.onclick = () => { if (D.equip(pf, gun, 'gun')) { D.Sfx.play('power'); U.refresh(); } else D.Sfx.play('nope'); };
    // 画枪：工作台背景、扫描线、轻微浮动；刚换的配件从外面滑进来、闪一下；鼠标移到配件上时半透明预览
    const cv = $('canvas'), cx = cv.getContext('2d'), S = 6, L = layout(gun), base = baseImg(gun), t0 = performance.now();
    const anchor = s => L[s], off = { muzzle: [1, 0], mag: [0, 1], sight: [0, -1], stock: [-1, 0] };
    const draw = now => {
      if (!cv.isConnected) { raf = 0; return; }
      const t = (now - t0) / 1000; cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false;
      const g = cx.createRadialGradient(cv.width / 2, cv.height * 0.45, 10, cv.width / 2, cv.height / 2, cv.width * 0.6); g.addColorStop(0, '#1d2236'); g.addColorStop(1, '#090a12'); cx.fillStyle = g; cx.fillRect(0, 0, cv.width, cv.height);
      cx.strokeStyle = 'rgba(62,232,255,0.07)'; cx.lineWidth = 1; for (let x = 0; x < cv.width; x += 24) { cx.beginPath(); cx.moveTo(x + 0.5, 0); cx.lineTo(x + 0.5, cv.height); cx.stroke(); } for (let y = 0; y < cv.height; y += 24) { cx.beginPath(); cx.moveTo(0, y + 0.5); cx.lineTo(cv.width, y + 0.5); cx.stroke(); }
      const bob = Math.round(Math.sin(t * 1.6) * 1.2) * 0 + Math.sin(t * 1.6) * 2; cx.translate(0, bob);
      cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.beginPath(); cx.ellipse(cv.width / 2, (L.y0 + 26) * S, CW * S * 0.32, 10, 0, 0, Math.PI * 2); cx.fill();
      cx.drawImage(base.img, 0, 0, CW * S, CH * S);
      const anim = G.gsAnim && now - G.gsAnim.t0 < 450 ? G.gsAnim : null;
      for (const s of Object.keys(D.ATT_SLOTS)) {
        const k = s === slot && G.gsGhost ? G.gsGhost : a[s]; if (!k) continue;
        const img = partImg(k), [ax, ay] = anchor(s); let dx = 0, dy = 0, alpha = s === slot && G.gsGhost ? 0.55 + 0.25 * Math.sin(t * 8) : 1;
        if (anim && anim.slot === s) { const u = Math.min(1, (now - anim.t0) / 260), e = 1 - Math.pow(1 - u, 3); dx = off[s][0] * (1 - e) * 10; dy = off[s][1] * (1 - e) * 10; }
        cx.globalAlpha = alpha; cx.save(); cx.translate((ax + dx) * S, 0); if (img.left) cx.scale(-1, 1); // 枪托往后（左）长：以挂点为轴翻过来
        cx.drawImage(img.img, -img.ax * S, (ay - img.ay + dy) * S, img.w * S, img.h * S); if (img.emit) { cx.globalCompositeOperation = 'lighter'; cx.drawImage(img.emit, -img.ax * S, (ay - img.ay + dy) * S, img.w * S, img.h * S); cx.globalCompositeOperation = 'source-over'; } cx.restore(); cx.globalAlpha = 1;
        if (anim && anim.slot === s) { const u = (now - anim.t0) / 450; cx.strokeStyle = `rgba(255,236,170,${1 - u})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(ax * S, ay * S, 10 + u * 50, 0, Math.PI * 2); cx.stroke(); }
      }
      if (base.emit) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3); cx.drawImage(base.emit, 0, 0, CW * S, CH * S); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
      // 挂点：选中的那个一圈光
      for (const s of Object.keys(D.ATT_SLOTS)) { const [ax, ay] = anchor(s), on = s === slot; cx.strokeStyle = on ? `rgba(76,195,255,${0.6 + 0.4 * Math.sin(t * 5)})` : 'rgba(150,170,220,0.35)'; cx.lineWidth = on ? 3 : 2; cx.beginPath(); cx.arc(ax * S, ay * S, on ? 16 : 10, 0, Math.PI * 2); cx.stroke(); }
      cx.setTransform(1, 0, 0, 1, 0, 0);
      const sl = (t * 120) % (cv.height + 80) - 40, sg = cx.createLinearGradient(0, sl - 30, 0, sl + 30); sg.addColorStop(0, 'rgba(62,232,255,0)'); sg.addColorStop(0.5, 'rgba(62,232,255,0.08)'); sg.addColorStop(1, 'rgba(62,232,255,0)'); cx.fillStyle = sg; cx.fillRect(0, sl - 30, cv.width, 60);
      raf = requestAnimationFrame(draw);
    };
    if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    // 挂点按钮放在对应位置旁边
    const pos = { muzzle: [12, -2], mag: [4, 14], sight: [0, -13], stock: [-14, -2] };
    $$('.gs-hot').forEach(b => { const s = b.dataset.gsSlot, [ax, ay] = anchor(s), [ox, oy] = pos[s]; b.style.left = ((ax + ox) / CW * 100) + '%'; b.style.top = ((ay + oy) / CH * 100) + '%'; });
    X.retip();
  };
})(D);
