/* 末班之后 · 小样二：成长与经济的界面（M3）
   据点"委托"页（委托板）、"设施"页（四个设施 + 工作台制造 + 学蓝图）、
   配装页里的配件槽和改装槽、机库卡片上的熟练度和改装。规则都在 growth.js。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip, artURL, infoIcon, tipOf, gridHTML, GR } = X;
  let root, G;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  const Gw = () => D.Growth;
  const qcol = q => D.QUALITY[q].col;
  const matsHTML = (pf, mats) => (mats || []).map(([id, n]) => { const have = GR().count(pf.stash, x => x === id), it = D.itemInfo(id); return `<span class="mat${have >= n ? ' ok' : ''}" data-tip="${esc(it.name + '：仓库里有 ' + have)}"><img src="${infoIcon(it)}">${esc(it.name)} ${Math.min(have, n)}/${n}</span>`; }).join('');
  const cost = (pf, money, mats) => `<span class="mat money${pf.money >= money ? ' ok' : ''}"><i class="ico-gold"></i>${money}</span>${matsHTML(pf, mats)}`;

  // ── 委托板
  U.jobsTab = function (pf, body) {
    const W = Gw(), B = W.board(pf), T = W.TUNE;
    const card = (k, active) => {
      const J = W.jobDef(k), r = W.reward(pf, J), prog = active ? W.progress(pf, active) : 0, need = active ? W.need(active) : 0, ready = active && J.type === 'fetch' && prog >= need;
      const left = active && active.deadline != null ? active.deadline - D.marketDay(pf) + 1 : J.days || null;
      return `<div class="job${active ? ' on' : ''}${ready ? ' ready' : ''}"><div class="jb-h"><b>${esc(J.name)}</b><em>${esc(J.who)}</em>${left ? `<span class="jb-days${left <= 1 ? ' warn' : ''}">${active ? '还剩 ' + left + ' 天' : '限 ' + left + ' 天'}</span>` : ''}</div>
        <div class="jb-text">${esc(J.text)}</div><div class="jb-goal">${esc(W.goal(J))}</div>
        ${active ? `<div class="jb-prog"><i style="width:${Math.round(prog / need * 100)}%"></i><span>${prog} / ${need}</span></div>` : ''}
        <div class="jb-foot"><span class="jb-rw"><i class="ico-gold"></i>${r.money - (J.deposit || 0)}${J.deposit ? `<small>（另退押金 ${J.deposit}）</small>` : ''}${r.give ? ` · <img src="${infoIcon(D.itemInfo(r.give))}"><b style="color:${qcol(D.itemInfo(r.give).q)}">${esc(D.itemInfo(r.give).name)}</b>` : ''}</span>
        ${active ? (ready ? `<button class="btn sm primary" data-turnin="${k}">交付</button>` : '') + `<button class="btn sm" data-drop="${k}">放弃</button>` : `<button class="btn sm${B.active.length >= T.jobActive || (J.deposit && pf.money < J.deposit) ? ' poor' : ''}" data-take="${k}">接下${J.deposit ? ' · 押金 ' + J.deposit : ''}</button>`}</div></div>`;
    };
    body.innerHTML = `<div class="stash jobs"><div class="st-head"><h3>委托板</h3><span class="hint">每天换一批。除了交东西的委托，进度都要<b>撤出来</b>才算数，那趟损毁就作废。最多同时接 ${T.jobActive} 条。</span><span class="worth">做完 <b>${pf.grow.jobsDone | 0}</b></span></div>
      <div class="jb-cols"><div class="jb-col wp"><div class="wh">今天的委托 · ${B.offers.length}</div><div class="jb-grid">${B.offers.map(k => card(k)).join('') || '<div class="wnone">今天的都接了。明天再来看。</div>'}</div>
        ${D.facLv(pf, 'intel') < 1 ? '<div class="hint dim jb-more">情报站建起来以后，委托板每天多一条。</div>' : ''}</div>
      <div class="jb-col wp act"><div class="wh">进行中 · ${B.active.length} / ${T.jobActive}</div>${B.active.map(j => card(j.k, j)).join('') || '<div class="wnone">还没接委托。</div>'}
        ${(B.expired || []).length ? `<div class="hint warn">过期了：${B.expired.map(k => esc(W.jobDef(k).name)).join('、')}</div>` : ''}</div></div></div>`;
    body.querySelectorAll('[data-take]').forEach(b => b.onclick = () => { if (W.accept(pf, b.dataset.take)) { D.Sfx.play('pick'); const J = W.jobDef(b.dataset.take); if (J.type === 'deliver') U.toast('委托包裹放进了背包'); } else { D.Sfx.play('nope'); U.toast(B.active.length >= T.jobActive ? '最多同时接 ' + T.jobActive + ' 条' : '零件不够付押金'); } U.refresh(); });
    body.querySelectorAll('[data-turnin]').forEach(b => b.onclick = () => { const r = W.turnIn(pf, b.dataset.turnin); if (r) { D.Sfx.play('coin'); U.toast('+' + r.money + (r.give ? '，还有' + D.itemInfo(r.give).name : '')); } else D.Sfx.play('nope'); U.refresh(); });
    body.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => { W.abandon(pf, b.dataset.drop); D.Sfx.play('click'); U.refresh(); });
  };
  U.jobsReady = pf => { if (!D.Growth || !pf.grow) return 0; const W = Gw(), B = W.board(pf); return B.active.filter(j => W.jobDef(j.k).type === 'fetch' && W.progress(pf, j) >= W.need(j)).length; };

  // ── 设施 + 工作台
  const CRAFT_TABS = [['muzzle', '枪口'], ['mag', '弹匣'], ['sight', '瞄具'], ['stock', '枪托'], ['armor', '装甲'], ['power', '动力'], ['sensor', '传感器']];
  U.facTab = function (pf, body) {
    const W = Gw(), ct = G.craftTab || 'muzzle';
    const facCard = k => {
      const F = D.FAC[k], lv = D.facLv(pf, k), nx = D.facNext(pf, k);
      return `<div class="fac${lv ? '' : ' off'}"><div class="fc-h"><img src="${artURL(F.icon)}"><b>${F.name}</b><span class="pips">${[1, 2, 3, 4].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span></div>
        <div class="hint">${F.desc}</div><div class="fc-now">${lv ? '现在：' + F.lv.slice(0, lv).map(x => x.fx).join('；') : '还没建'}</div>
        ${nx ? `<div class="fc-next"><b>${lv ? '升到 ' + (lv + 1) + ' 级' : '建造'}</b>：${nx.fx}</div><div class="fc-cost">${cost(pf, nx.money, nx.mats)}</div><button class="btn sm${D.canPay(pf, nx.money, nx.mats) ? ' primary' : ' poor'}" data-fac="${k}">${lv ? '升级' : '建造'}</button>` : '<div class="fc-next ok">已经满级</div>'}</div>`;
    };
    const bps = pf.stash.items.filter(e => e.id.startsWith('bp:'));
    const keys = Object.keys(D.ATT).filter(k => D.ATT[k].slot === ct).concat(Object.keys(D.RMOD).filter(k => D.RMOD[k].slot === ct));
    const row = k => {
      const Gd = D.ATT[k] || D.RMOD[k], id = D.gearId(k), r = D.recipe(k), st = D.canCraft(pf, k), have = GR().count(pf.stash, x => x === id);
      const why = { lv: '工作台要 ' + r.q + ' 级', bp: '要先学蓝图', no: '只能在城里找到', poor: '', ok: '' }[st];
      return `<div class="rc q${Gd.q}"><img src="${infoIcon(D.itemInfo(id))}"><div class="rc-t"><b style="color:${qcol(Gd.q)}">${esc(Gd.name)}</b>${have ? `<em>仓库里 ${have}</em>` : ''}<div class="hint">${esc(Gd.desc)}</div><div class="fc-cost">${cost(pf, r.money, r.mats)}</div></div>
        ${why ? `<span class="rc-why">${why}</span>` : `<button class="btn sm${st === 'ok' ? '' : ' poor'}" data-craft="${k}">制造</button>`}</div>`;
    };
    body.innerHTML = `<div class="stash facs"><div class="st-head"><h3>设施</h3><span class="hint">南栈的几间屋子。升级要零件和材料：材料都在城里搜得到，仓库和搜刮界面里会给要用的材料打上标记。</span></div>
      <div class="fc-cols"><div class="fc-grid">${Object.keys(D.FAC).map(facCard).join('')}</div>
      <div class="bench wp"><div class="wh">工作台 · 制造</div><div class="bn-h"><span class="hint">${D.facLv(pf, 'bench') ? '能做到' + D.QUALITY[D.facLv(pf, 'bench')].name + '级' : '先建工作台'}。做好的东西放进仓库，去配装页装上。</span></div>
        <div class="cx-switch">${CRAFT_TABS.map(([k, n]) => `<button class="tab${k === ct ? ' on' : ''}" data-ct2="${k}">${n}</button>`).join('')}</div>
        ${(() => { const P = X.page('craft:' + ct, keys.length, 4); return `<div class="rc-list" data-pgarea="craft:${ct}">${keys.slice(P.from, P.to).map(row).join('')}</div>${P.html}`; })()}
        <div class="bn-bp"><div class="wh">蓝图</div>${bps.length ? bps.map(e => `<button class="btn sm" data-bp="${pf.stash.items.indexOf(e)}">学会 · ${esc(D.itemInfo(e.id).name.replace('蓝图 · ', ''))}</button>`).join('') : '<span class="hint dim">传说级的配件和改装件要先学蓝图。蓝图在危险的站里偶尔能搜到。</span>'}
          ${pf.grow.bp.length ? `<div class="hint">已学会：${pf.grow.bp.map(k => esc((D.ATT[k] || D.RMOD[k] || (D.AMMO_BP || {})[k] || { name: k }).name)).join('、')}</div>` : ''}</div></div></div></div>`;
    body.querySelectorAll('[data-fac]').forEach(b => b.onclick = () => { const k = b.dataset.fac; if (D.facUp(pf, k)) { D.Sfx.play('power'); U.toast(D.FAC[k].name + '升到 ' + D.facLv(pf, k) + ' 级'); } else { D.Sfx.play('nope'); U.toast('零件或材料不够'); } U.refresh(); });
    body.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => { const k = b.dataset.craft; if (D.craft(pf, k)) { D.Sfx.play('power'); U.toast('做好了：' + (D.ATT[k] || D.RMOD[k]).name); } else { D.Sfx.play('nope'); U.toast(GR().canAdd(pf.stash, D.gearId(k), 1) ? '零件或材料不够' : '仓库满了'); } U.refresh(); });
    body.querySelectorAll('[data-ct2]').forEach(b => b.onclick = () => { D.Sfx.play('click'); G.craftTab = b.dataset.ct2; U.refresh(); });
    body.querySelectorAll('[data-bp]').forEach(b => b.onclick = () => { const e = pf.stash.items[+b.dataset.bp]; if (e && D.learnBp(pf, e)) { D.Sfx.play('pick'); U.toast('学会了'); } else { D.Sfx.play('nope'); U.toast('已经会了'); } U.refresh(); });
  };

  // ── 配装页：配件槽（装在这一型枪上）和改装槽（装在这台型号上）
  U.gearSlotsHTML = function (pf) {
    const gun = D.loadGun(pf.load) || 'nailgun', a = D.gunAtt(pf, gun), k = D.shellOf(pf), mods = D.shellMods(pf, k), base = D.CARDS[gun].gun, g = D.gunOf(pf, gun); // 配件跟着装着的那把枪（两个槽都是近战：显示钉枪的，装上也只是存着）
    const slot = (attr, key, label, id) => { const it = id && D.itemInfo(id); return `<div class="gslot${it ? ' q' + it.q : ' empty'}" ${attr}="${key}" ${it ? X.tipAttr(id, 1, '右键卸下') : `data-tip="${esc(label + '：空。单击仓库里的' + label + '件装上')}"`}><span>${label}</span>${it ? `<img src="${infoIcon(it)}">` : ''}</div>`; };
    const d = (n, a2, b2, f) => Math.abs(a2 - b2) < 1e-6 ? '' : `<span>${n} ${f(b2)}→<b>${f(a2)}</b></span>`;
    const stats = [d('伤害', g.dmg, base.dmg, v => +v.toFixed(1)), d('弹匣', g.mag, base.mag, v => v), d('换弹', g.reload, base.reload, v => v.toFixed(2) + 's'), d('散布', g.spread, base.spread, v => Math.round(v * 100)), d('连射变散', g.bloomMul || 1, 1, v => Math.round(v * 100) + '%'), d('射速', 1 / g.rate, 1 / base.rate, v => v.toFixed(1)), d('枪声', g.noise, base.noise, v => v.toFixed(1))].filter(Boolean).join('');
    const fx = D.shellFx(pf, k), lv = D.mastLv(pf, k);
    return `<div class="sl-group gear"><h4>配件</h4><div class="gslots">${Object.keys(D.ATT_SLOTS).map(s => slot('data-att', s, D.ATT_SLOTS[s], a[s] && 'att:' + a[s])).join('')}</div><button class="btn sm gs-open" data-act="gunsmith">改枪台 ▶</button></div>
      ${stats ? `<div class="gstats">${stats}</div>` : ''}
      <div class="sl-group gear"><h4>改装</h4><div class="gslots">${Object.keys(D.RMOD_SLOTS).map(s => slot('data-rm', s, D.RMOD_SLOTS[s], mods[s] && 'rmod:' + mods[s])).join('')}</div><button class="btn sm gs-open" data-act="modbay" data-tip="${esc('机库改装台。熟练度 ' + lv + ' 级：开这台出发越多越熟，2 级技能冷却 -15%，3 级技能第二形态：' + D.MAST2[D.SHELLS[k].skill.k])}">改装台 ▶</button></div>`;
  };
  U.bindGearSlots = function (pf) {
    root.querySelectorAll('[data-att]').forEach(el => el.oncontextmenu = ev => { ev.preventDefault(); if (!D.detach(pf, D.loadGun(pf.load) || 'nailgun', el.dataset.att)) U.toast('仓库满了'); D.Sfx.play('click'); U.refresh(); });
    root.querySelectorAll('[data-rm]').forEach(el => el.oncontextmenu = ev => { ev.preventDefault(); if (!D.unfitMod(pf, D.shellOf(pf), el.dataset.rm)) U.toast('仓库满了'); D.Sfx.play('click'); U.refresh(); });
    const openMB = s => { D.Sfx.play('click'); G.mbSlot = s || G.mbSlot; G.mbTo = null; G.mbDir = null; G.mbShell = D.shellOf(pf); G.mbBack = 'load'; G.hubTab('modbay'); };
    root.querySelectorAll('[data-rm]').forEach(el => el.onclick = () => openMB(el.dataset.rm));
    const mb = root.querySelector('[data-act=modbay]'); if (mb) mb.onclick = () => openMB();
    const openGS = s => { D.Sfx.play('click'); G.gsSlot = s || G.gsSlot; G.gsGun = D.loadGun(pf.load) || 'nailgun'; G.hubTab('gunsmith'); };
    root.querySelectorAll('[data-att]').forEach(el => el.onclick = () => openGS(el.dataset.att));
    const gb = root.querySelector('[data-act=gunsmith]'); if (gb) gb.onclick = () => openGS();
  };
  // 配装页单击仓库里的配件 / 改装件：直接装上
  U.gearClick = function (pf, e) {
    const it = D.itemInfo(e.id);
    if (it.kind === 'att') { if (D.attach(pf, D.loadGun(pf.load) || 'nailgun', it.att)) { D.Sfx.play('power'); U.toast(it.name + '装到了' + D.CARDS[D.loadGun(pf.load) || 'nailgun'].name + '上'); } else { D.Sfx.play('nope'); U.toast('仓库满了，换不下来'); } return true; }
    if (it.kind === 'rmod') { if (D.fitMod(pf, D.shellOf(pf), it.rmod)) { D.Sfx.play('power'); U.toast(it.name + '装到了' + D.SHELLS[D.shellOf(pf)].name + '上'); } else { D.Sfx.play('nope'); U.toast('仓库满了，换不下来'); } return true; }
    return false;
  };

  // ── 机库卡片：熟练度和改装
  U.shellGrowHTML = function (pf, k) {
    if (!pf.shells[k]) return '';
    const xp = D.mastXP(pf, k), lv = D.mastLv(pf, k), T = Gw().TUNE.mastXP, nxt = lv >= 3 ? null : T[lv], prev = T[lv - 1];
    const mods = D.shellMods(pf, k);
    const tip = (lv >= 3 ? '技能第二形态：' + D.MAST2[D.SHELLS[k].skill.k] : (lv >= 2 ? '技能冷却 -15%。' : '2 级：技能冷却 -15%。') + '3 级：' + D.MAST2[D.SHELLS[k].skill.k]) + '｜改装：' + Object.keys(D.RMOD_SLOTS).map(s => D.RMOD_SLOTS[s] + ' ' + (mods[s] ? D.RMOD[mods[s]].name : '空')).join('、');
    return `<div class="sh-mast" data-tip="${esc(tip)}"><b>熟练 ${lv} 级</b><i class="bar"><i style="width:${nxt ? Math.round((xp - prev) / (nxt - prev) * 100) : 100}%;background:var(--gold)"></i></i><span>${nxt ? xp + '/' + nxt : '满'} · 改装 ${Object.keys(mods).filter(s => mods[s]).length}/3</span></div>`;
  };

  // ── 结算页：委托和熟练度
  U.resultGrowHTML = function (out) {
    let h = '';
    if (out.jobs) h += out.jobs.map(j => `<div class="hint ok">委托完成 · ${esc(j.who)}「${esc(j.name)}」：+${j.money}${j.give ? '，' + esc(D.itemInfo(j.give).name) : ''}</div>`).join('');
    if (out.jobFail) h += `<div class="hint warn">委托失败（包裹丢了，押金不退）：${out.jobFail.map(esc).join('、')}</div>`;
    if (out.mastUp) h += `<div class="hint ok">${esc(D.SHELLS[out.mastUp.shell].name)}熟练度升到 ${out.mastUp.lv} 级${out.mastUp.lv >= 3 ? '：技能第二形态 — ' + esc(D.MAST2[D.SHELLS[out.mastUp.shell].skill.k]) : '：技能冷却 -15%'}</div>`;
    return h;
  };
})(D);
