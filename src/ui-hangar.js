/* Underdog · 机库：像选干员一样。
     左：型号名单（小头像、名字和编号；出战中 / 没买的标价钱 / 有伤标耐久），点一下或 ↑↓ 切换；
     中：选中型号站在转台上慢慢转一圈，背后是大号编号水印、名字、定位；◀ ▶ 也能切换；
     右：远程操控 · 品质、介绍、数值条、技能 G、特性、熟练度，买下 / 出战用这台 / 改装 / 修理；
     下：这台型号的涂装。鼠标停在涂装上，转台上的机器人马上换成那个涂装；点一下买下或换上。
   选中的型号记在 G.hgSel（不改出战的型号，按"出战用这台"才改）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, esc = X.esc;
  const SPIN = [8, 7, 6, 5, 4, 3, 2, 1]; // 正面开始，顺时针转一圈
  let raf = 0, key = null;
  X.hooks.clear.push(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; } if (key) { removeEventListener('keydown', key, true); key = null; } });

  const lookOf = (pf, k, skin) => { const S = D.SHELLS[k], T = skin && skin !== 'none' ? D.SKINS[skin] : null, cur = !skin && D.shellLook(pf, k); return T ? { tint: T.tint, visor: T.visor } : cur || { tint: S.tint, visor: S.visor }; };
  // 画一帧：型号 k、朝向 dir；look 是涂装（tint / visor）。人和游戏里画法一样（hero-portrait.js：轮廓光、发光、披风、光照、泛光），游戏像素 ×4
  let heroP = null, heroLast = 0;
  function drawHero(cv, pf, k, dir, t, look) {
    const mods = pf.shells[k] ? D.shellMods(pf, k) : null, x = cv.getContext('2d'), now = performance.now();
    x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); if (!D.heroPortrait) return false;
    const dt = heroLast ? Math.min(1 / 30, Math.max(0, (now - heroLast) / 1000)) : 1 / 60; heroLast = now;
    // 转台：一圈暗色椭圆 + 品质色的边
    const qc = D.QUALITY[D.SHELLS[k].q].col, fx = cv.width / 2, fy = cv.height - 22;
    x.fillStyle = '#090a12'; x.beginPath(); x.ellipse(fx, fy, 58, 11, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = qc; x.lineWidth = 2; x.globalAlpha = 0.7; x.beginPath(); x.ellipse(fx, fy, 58, 11, 0, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
    heroP = heroP || D.heroPortrait();
    return heroP.draw(x, { k, mods, tint: look.tint, visor: look.visor, dir, t, dt, up: 4, fx, fy });
  }

  U.hangar = function (pf, body) {
    const keys = Object.keys(D.SHELLS), cur = D.shellOf(pf);
    if (!D.SHELLS[D.Game.hgSel]) D.Game.hgSel = cur;
    const k = D.Game.hgSel, S = D.SHELLS[k], own = pf.shells[k], fix = own ? D.repairCost(pf, k) : 0, Q = D.QUALITY[S.q];
    const sel = (pf.skins && pf.skins.sel && pf.skins.sel[k]) || 'none', owned = sk => sk === 'none' || ((pf.skins || {}).own || []).includes(sk);
    const roster = keys.map(id => { const T = D.SHELLS[id], o = pf.shells[id], c = o ? Math.round(o.cond * 100) : 100;
      const st = id === cur ? '<b class="hg-on">出战</b>' : !o ? `<b class="hg-price"><i class="ico-gold"></i>${T.price}</b>` : c < 100 ? `<b class="hg-hurt">${c}%</b>` : '';
      return `<button class="hg-it q${T.q}${id === k ? ' sel' : ''}${o ? '' : ' locked'}" data-hg="${id}"><canvas data-hgmini="${id}" width="28" height="28"></canvas><span class="hg-nm">${esc(T.name)}<em>${esc(T.code)}</em></span>${st}</button>`; }).join('');
    const act = !own ? `<button class="btn primary${pf.money < S.price ? ' poor' : ''}" data-buyshell="${k}">买下 · ${S.price}</button>`
      : k === cur ? '<span class="hg-badge">出战中</span>' : `<button class="btn primary" data-pickshell="${k}">出战用这台</button>`;
    const skins = Object.keys(D.SKINS).map(sk => { const T = D.SKINS[sk], o = owned(sk); return `<button class="sk${sel === sk ? ' on' : ''}${o ? '' : ' lock'}" data-skin="${sk}" data-tip="${esc(T.name + (o ? (sel === sk ? ' · 正在用' : ' · 单击换上') : ' · ' + T.price + ' 零件（买下后所有型号都能用）'))}"><i style="background:${T.tint || S.tint || '#8f9aa4'};border-color:${T.visor || S.visor || '#3ee8ff'}"></i><span>${T.name}</span>${o ? '' : `<b>${T.price}</b>`}</button>`; }).join('');
    body.innerHTML = `<div class="stash hgwrap"><div class="hg" style="--qc:${Q.col}">
      <div class="hg-list"><h4>机库 <em>${keys.filter(id => pf.shells[id]).length}/${keys.length}</em></h4>${roster}</div>
      <div class="hg-stage"><div class="hg-mark">${esc(S.code)}</div>
        <div class="hg-title"><canvas class="hg-emb" data-hgmini="${k}" width="28" height="28"></canvas><div class="hg-name">${esc(S.name)}</div><div class="hg-code">${esc(S.code)} · ${esc(S.role)}</div>${own ? '' : `<div class="hg-own">还没买 · <i class="ico-gold"></i>${S.price}</div>`}</div>
        <canvas class="hg-hero" width="200" height="200"></canvas>
        <button class="btn sm hg-prev" data-hgstep="-1" data-tip="上一台（↑）">◀</button><button class="btn sm hg-next" data-hgstep="1" data-tip="下一台（↓）">▶</button>
        </div>
      <div class="hg-info"><div class="hg-scroll"><div class="hg-ctl">远程操控 · <span style="color:${Q.col}">${Q.name}</span></div><div class="hg-tag">${esc(S.tag)}</div>
        ${X.shellStats(pf, k)}${U.shellGrowHTML ? U.shellGrowHTML(pf, k) : ''}</div>
        <div class="hg-act">${act}${own ? `<button class="btn sh-mod" data-modbay="${k}" data-tip="${esc('机库改装台：装甲、动力、传感器。装上的改装件会画在身上')}">改装</button>` : ''}${fix ? `<button class="btn${pf.money < fix ? ' poor' : ''}" data-fixshell="${k}">修理 · ${fix}</button>` : ''}</div></div>
      <div class="hg-skins"><h4>涂装</h4><div class="sk-row">${skins}</div></div></div></div>`;
    let preview = null; // 鼠标停在哪个涂装上：转台上先换成它看看
    const $ = s => body.querySelector(s), $$ = s => body.querySelectorAll(s), go = id => { D.Game.hgSel = id; D.Sfx.play('tink'); U.refresh(); };
    $$('[data-hg]').forEach(b => b.onclick = () => { if (b.dataset.hg !== k) go(b.dataset.hg); });
    $$('[data-hgstep]').forEach(b => b.onclick = () => go(keys[(keys.indexOf(k) + +b.dataset.hgstep + keys.length) % keys.length]));
    $$('[data-skin]').forEach(b => {
      b.onclick = () => { if (!owned(b.dataset.skin)) return D.Trade.buySkin(pf, k, b.dataset.skin); if (D.pickSkin(pf, k, b.dataset.skin)) D.Sfx.play('power'); else { D.Sfx.play('nope'); U.toast('零件不够'); } U.refresh(); };
      b.onmouseenter = () => { preview = b.dataset.skin; }; b.onmouseleave = () => { preview = null; };
    });
    $$('[data-buyshell]').forEach(b => b.onclick = () => D.Trade.buyShell(pf, k)); // 先弹确认框（trade.js）
    $$('[data-pickshell]').forEach(b => b.onclick = () => { D.pickShell(pf, k); D.Sfx.play('power'); U.toast(S.name + '出战'); U.refresh(); });
    $$('[data-modbay]').forEach(b => b.onclick = () => { D.Sfx.play('click'); D.Game.mbShell = k; D.Game.mbBack = 'shells'; D.Game.hubTab('modbay'); });
    $$('[data-fixshell]').forEach(b => b.onclick = () => { if (D.repairShell(pf, k)) D.Sfx.play('heal'); else { D.Sfx.play('nope'); U.toast('零件不够'); } U.refresh(); });
    // 名单和标题用型号徽标（emblems.js）；转台每帧画
    $$('canvas[data-hgmini]').forEach(cv => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 28, 28); if (D.shellEmblem) x.drawImage(D.shellEmblem(cv.dataset.hgmini), 0, 0); });
    const hero = $('.hg-hero'), t0 = performance.now();
    if (raf) cancelAnimationFrame(raf);
    const tick = now => { if (!hero.isConnected) { raf = 0; return; } const t = (now - t0) / 1000; drawHero(hero, pf, k, SPIN[Math.floor(t / 0.9) % 8], t, lookOf(pf, k, preview)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); drawHero(hero, pf, k, 8, 0, lookOf(pf, k));
    // ↑↓ / W S 切换型号
    if (key) removeEventListener('keydown', key, true);
    key = e => { if (!body.querySelector('.hg') || (U.modalOpen && U.modalOpen()) || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return; const d = { ArrowDown: 1, ArrowUp: -1, KeyS: 1, KeyW: -1 }[e.code]; if (!d) return; e.preventDefault(); e.stopPropagation(); go(keys[(keys.indexOf(D.Game.hgSel) + d + keys.length) % keys.length]); };
    addEventListener('keydown', key, true);
  };
})(D);
