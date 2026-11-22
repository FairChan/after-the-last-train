/* 末班之后 · 小样二：人类据点的人。说话走头顶气泡（talk-bubble.js，和未知信号站同一套）；面板只管换物（方姨的货架）、
   提升（老铁的熔炼）、托付（苏医生、小满）。规则和数据在 outpost.js；阿贵的收货摊用原来的交易面板（U.trade）。
   面板挂在 #ui 的 .panel-slot 上（和商人、搜刮面板同一个位置），U.refresh 会调 S.lootOpen._render 重画。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, O = () => D.Outpost, X = () => U._;
  const root = () => document.getElementById('ui');
  const esc = s => X().esc(s);
  let keyH = null;

  const pfOf = S => S.raid.pf;
  const dots = t => { const n = Math.round(t / 2); return '●'.repeat(n) + '○'.repeat(5 - n); };
  const itemName = id => D.itemInfo(id).name;
  const itemQ = id => D.itemInfo(id).q | 0;
  const qName = q => (D.QUALITY[q] ? D.QUALITY[q].name : '');
  const qCol = q => (D.QUALITY[q] ? D.QUALITY[q].col : 'var(--cream)');
  const icon = id => X().infoIcon(D.itemInfo(id));
  const kindName = k => (k === 'att' ? '配件' : '改装件');
  const slotName = (kind, s) => (kind === 'att' ? D.ATT_SLOTS : D.RMOD_SLOTS)[s] || s;
  const QUEST_OF = { su: 'med', xm: 'xm' }; // 谁托付什么

  // 打开：说话一律是头顶气泡（talk-bubble.js）——有没说过的话就从第一段演，没有就随口一句。
  // 换物（方姨）、熔炼（老铁）、托付（苏医生、小满）的面板在话说完以后从选项里开；方姨、老铁没话说时直接开面板，随口那句冒成闲话
  D.Outpost.open = function (S, id) {
    const P = O().PEOPLE[id]; if (!P) return;
    if (S.talk && S.talk.op && S.talk.id === id) return; // 正在和他说
    const pf = pfOf(S), sc = O().nextScene(pf, id), obj = (S.people || []).find(q => q.id === id && !q.crowd);
    if (!obj || !D.TalkB || (!sc && (P.svc === 'barter' || P.svc === 'fuse'))) {
      const line = O().idleLine(pf, id); if (obj && line && D.OutpostTown && S.town) D.OutpostTown.chat(S, obj, line);
      return openPanel(S, id);
    }
    U.closePanel(S);
    const T = S.talk = { op: true, id, obj, kind: 'op', name: P.name, col: P.col, done: false, R: null };
    const pl = S.player; if (Math.hypot(obj.x - pl.x, obj.y - pl.y) > 36 || obj.f !== S.f) T.near = { x: pl.x, y: pl.y, f: S.f }; // 隔着门被叫住：走远了算从这儿走开
    const head = obj.pose === 'lie' ? 14 : obj.pose === 'sit' ? 22 : obj.pose === 'kid' || obj.pose === 'kidrun' ? 18 : 26;
    T.R = D.TalkB.run(S, { name: P.name, col: P.col, obj, head }, sc ? sceneSteps(S, id, sc) : idleSteps(S, id), { onDone: () => { if (S.talk === T) D.talkClose(S); } });
    D.Sfx.play('click');
  };
  // 面板（换物、熔炼、托付）：左边是这个人和随口一句、右边是能做的事
  function openPanel(S, id) {
    const st = { op: true, id, phase: 'idle', scene: null, pi: 0, reply: '', sel: null, grp: null, _render: null };
    if (S.talk) D.talkClose(S);
    S.lootOpen = st;
    st._render = () => render(S, st);
    st._render();
    D.Sfx.play('click');
  }
  D.Outpost.openPanel = openPanel;

  // ── 气泡对话的一串话
  const say = t => D.TalkB.split(t);
  // 一段对话：一页页演（演到最后一页时算看过，结局的人情也是这时候加）；末尾有选项就选，再接"还有话要说 / 面板 / 离开"
  function sceneSteps(S, id, sc) {
    const pf = pfOf(S), pages = O().pages(pf, sc), out = [];
    pages.forEach((p, i) => { if (i === pages.length - 1) out.push({ k: 'fn', f: () => O().showScene(pf, sc) }); out.push(...say(p)); });
    if (!pages.length) out.push({ k: 'fn', f: () => O().showScene(pf, sc) });
    const ch = sc.choices || [];
    if (!ch.length) return out.concat(tailSteps(S, id));
    const opts = ch.map(c => ({ t: D.TalkB.label(c.t + (c.cost && !/\d/.test(c.t) ? '（' + c.cost + ' 零件）' : '')), ok: !(c.need && !c.need(pf)) && (!c.cost || (pf.money | 0) >= c.cost) }));
    opts.push({ t: D.TalkB.label('离开'), ok: true });
    out.push({ k: 'choice', opts, pick: i => {
      if (i >= ch.length) return [];
      const c = ch[i], reply = O().choose(S, sc, i);
      if (reply == null) return false;
      if (c.cost) { U.toast('-' + c.cost + ' 零件'); D.Sfx.play('coin'); }
      return say(reply).concat(tailSteps(S, id));
    } });
    return out;
  }
  // 没有新话：随口一句
  function idleSteps(S, id) { const line = O().idleLine(pfOf(S), id); return (line ? say(line) : []).concat(tailSteps(S, id)); }
  // 说完了：还有没说的话就问一句；能换物、熔炼、托付的人给一个开面板的选项
  const SVC = { barter: '换东西', fuse: '熔炼' };
  function svcLabel(S, id) {
    const P = O().PEOPLE[id];
    if (SVC[P.svc]) return SVC[P.svc];
    const q = QUEST_OF[id]; return q && !O().questDone(pfOf(S), q) ? '托付' : null;
  }
  function tailSteps(S, id) {
    const more = O().nextScene(pfOf(S), id), svc = svcLabel(S, id), opts = [], acts = [];
    if (more) { opts.push({ t: D.TalkB.label('还有话要说'), ok: true }); acts.push(() => sceneSteps(S, id, O().nextScene(pfOf(S), id) || more)); }
    if (svc) { opts.push({ t: D.TalkB.label(svc), ok: true }); acts.push(() => { openPanel(S, id); return null; }); }
    if (!opts.length) return [];
    opts.push({ t: D.TalkB.label('离开'), ok: true }); acts.push(() => []);
    return [{ k: 'choice', opts, pick: i => acts[i]() }];
  }

  // 左边：人、人情、这一句话、按钮
  function talkHTML(S, st) {
    const pf = pfOf(S), P = O().PEOPLE[st.id];
    const line = O().idleLine(pf, st.id), btn = `<button class="btn sm" data-act="close">离开</button>`; // 说话在头顶气泡里（talk-bubble.js），面板上只留随口一句
    const extra = st.id === 'su' ? '<div class="hint dim">诊所的配电柜在旁边，站着按 F 就能回满耐久。</div>' : '';
    return `<div class="op-who" style="--c:${P.col}"><div class="op-nm"><b>${esc(P.name)}</b><em>${esc(P.role)}</em></div>
      <div class="op-trust" title="人情">${dots(O().trust(pf))}</div></div>
      <div class="op-line">${esc(line)}</div>${extra}<div class="op-acts">${btn}</div>`;
  }

  // 右边：换物（方姨）
  function barterHTML(S, st) {
    const offs = O().offers(S), bag = S.raid.bag.items;
    const rows = offs.map((o, i) => {
      const gone = O().offerDone(S, i), sel = st.sel === i, q = itemQ(o.id);
      return `<div class="op-off${gone ? ' gone' : ''}${sel ? ' sel' : ''}" data-off="${i}"><img src="${icon(o.id)}"><div class="op-nm"><span style="color:${qCol(q)}">${esc(itemName(o.id))}</span><em>${esc(qName(q))} · 价值 ${o.v}</em></div><i>${gone ? '换走了' : `要 ${Math.ceil(o.v * O().TUNE.barterRatio)}+`}</i></div>`;
    }).join('');
    let pick = '';
    if (st.sel != null && !O().offerDone(S, st.sel)) {
      // 只列能换的（价值够的）；背包里别的东西换不了，不占地方
      const pickable = bag.map((e, bi) => ({ e, bi })).filter(x => O().barterOK(S, st.sel, x.e));
      pick = `<div class="hint">拿背包里的一件来换：</div><div class="op-bag">${pickable.map(x => `<div class="op-it ok" data-give="${x.bi}"><img src="${icon(x.e.id)}"><span>${esc(itemName(x.e.id))}</span><em>${D.itemInfo(x.e.id).v | 0}</em></div>`).join('') || '<div class="hint dim">背包里没有价值够的东西</div>'}</div>`;
    }
    return `<div class="op-sec"><h4>货架 · 只换不收钱</h4>${rows || '<div class="hint dim">今天没有货</div>'}</div>${pick}`;
  }

  // 右边：熔炼（老铁）
  function fuseHTML(S, st) {
    const pf = pfOf(S), groups = O().fuseGroups(S);
    const rows = groups.map(g => `<div class="op-grp${st.grp === g.key ? ' sel' : ''}" data-grp="${esc(g.key)}"><b>${g.q} 级 · ${esc(slotName(g.kind, g.slot))}${esc(kindName(g.kind))}</b><em>×${g.entries.length}</em></div>`).join('');
    const g = groups.find(x => x.key === st.grp);
    let res = '';
    if (g) {
      const cost = O().fuseCost(pf, g.q), pool = O().fuseResult(S, g), can = (pf.money | 0) >= cost && pool.length > 0;
      res = `<div class="op-res"><span style="color:${qCol(g.q + 1)}">熔成 ${g.q + 1} 级的${esc(slotName(g.kind, g.slot))}${esc(kindName(g.kind))}（随机）</span><span>${O().trust(pf) >= O().TUNE.trustFuse ? '人情打了折，' : ''}零件 <b>${cost}</b></span><button class="btn sm${can ? ' primary' : ' poor'}" data-act="fuse" ${can ? '' : 'disabled'}>熔（${cost} 零件）</button></div>`;
    }
    return `<div class="op-sec"><h4>熔炼 · 两件同类同槽同级，熔成一件高一级的</h4>${rows || '<div class="hint dim">背包里没有两件同类同槽同级的配件或改装件</div>'}</div>${res}`;
  }

  // 右边：托付（苏医生、小满）
  function questHTML(S, st) {
    const id = QUEST_OF[st.id]; if (!id) return '';
    const Q = O().QUESTS[id], pf = pfOf(S);
    if (O().questDone(pf, id)) return `<div class="op-sec"><h4>托付</h4><div class="hint dim">已经托付过了。</div></div>`;
    if (Q.pick) {
      const items = O().questItems(S, id), bag = S.raid.bag.items;
      return `<div class="op-sec"><h4>托付</h4><div class="hint">${esc(Q.ask)}</div></div><div class="op-bag">${items.map(e => `<div class="op-it ok" data-qpick="${bag.indexOf(e)}"><img src="${icon(e.id)}"><span>${esc(itemName(e.id))}</span><em>${esc(qName(itemQ(e.id)))}</em></div>`).join('') || '<div class="hint dim">背包里没有 2 级以上的配件或改装件</div>'}</div><div class="hint">给了：零件 +${Q.reward}，人情 +${Q.trust}</div>`;
    }
    const n = O().questCount(S, id), ok = n >= Q.n;
    return `<div class="op-sec"><h4>托付</h4><div class="hint">${esc(Q.ask)}</div><div>需要 ${esc(Q.name)}（背包里 ${Math.min(n, Q.n)}/${Q.n}）</div><button class="btn sm${ok ? ' primary' : ' poor'}" data-act="quest" ${ok ? '' : 'disabled'}>交出去</button><div class="hint">给了：零件 +${Q.reward}，人情 +${Q.trust}</div></div>`;
  }

  function render(S, st) {
    const slot = root() && root().querySelector('.panel-slot'); if (!slot) return;
    const P = O().PEOPLE[st.id], svc = P.svc === 'barter' ? barterHTML(S, st) : P.svc === 'fuse' ? fuseHTML(S, st) : questHTML(S, st);
    slot.innerHTML = `<div class="lootp op-panel${svc ? '' : ' solo'}"><div class="lp-col op-talk">${talkHTML(S, st)}</div>${svc ? `<div class="lp-col op-svc">${svc}</div>` : ''}</div>`;
    slot.onclick = e => {
      const t = e.target.closest && e.target.closest('[data-act],[data-off],[data-give],[data-grp],[data-qpick]'); if (!t || t.disabled) return;
      const ds = t.dataset, pf = pfOf(S);
      if (ds.act === 'close') U.closePanel(S);
      else if (ds.off != null) { st.sel = st.sel === +ds.off ? null : +ds.off; }
      else if (ds.grp != null) { st.grp = st.grp === ds.grp ? null : ds.grp; }
      else if (ds.give != null) return barterAsk(S, st, +ds.give);
      else if (ds.act === 'fuse') return fuseAsk(S, st);
      else if (ds.act === 'quest') return questAsk(S, st);
      else if (ds.qpick != null) return questPickAsk(S, st, +ds.qpick);
      U.refresh();
    };
    X().retip && X().retip();
  }

  // 换：先弹确认框，确认了才换
  function barterAsk(S, st, bi) {
    const e = S.raid.bag.items[bi], offs = O().offers(S), off = offs[st.sel];
    if (!e || !off || !O().barterOK(S, st.sel, e)) { D.Sfx.play('nope'); return U.refresh(); }
    confirm('换？', `<div class="tr-it"><img src="${icon(e.id)}"><div class="tr-nm"><span>${esc(itemName(e.id))}</span><span class="dim">给出</span></div></div>
      <div class="tr-row"><span>换到</span><b><img src="${icon(off.id)}" style="width:14px;height:14px;vertical-align:-3px"> ${esc(itemName(off.id))}</b></div>
      <div class="hint">不收钱，只换。换过的货就没有了，这一趟不再上货。</div>`, '确认换', () => {
      const r = O().barterDo(S, st.sel, e);
      if (r.ok) { U.toast('换到了 ' + itemName(r.got)); D.Sfx.play('buy'); st.sel = null; } else { D.Sfx.play('nope'); U.toast(r.why === 'full' ? '背包放不下' : '换不成'); }
      U.refresh();
    });
  }
  // 熔：确认框写清楚花多少、会得到什么（随机）
  function fuseAsk(S, st) {
    const pf = pfOf(S), g = O().fuseGroups(S).find(x => x.key === st.grp); if (!g) return U.refresh();
    const cost = O().fuseCost(pf, g.q);
    confirm('熔？', `<div class="tr-row"><span>熔掉</span><b>两件 ${g.q} 级 · ${esc(slotName(g.kind, g.slot))}${esc(kindName(g.kind))}</b></div>
      <div class="tr-row"><span>得到</span><b>${g.q + 1} 级 · ${esc(slotName(g.kind, g.slot))}${esc(kindName(g.kind))}（随机一件）</b></div>
      <div class="tr-row"><span>零件</span><b class="tr-cost"><i class="ico-gold"></i>-${cost}</b></div>`, '确认熔', () => {
      const r = O().fuseDo(S, st.grp);
      if (r.ok) { U.toast('熔成了 ' + itemName(r.id)); D.Sfx.play('buy'); st.grp = null; } else { D.Sfx.play('nope'); U.toast(r.why === 'poor' ? '零件不够' : r.why === 'full' ? '背包放不下' : '熔不了'); }
      U.refresh();
    });
  }
  function questAsk(S, st) {
    const id = QUEST_OF[st.id], Q = O().QUESTS[id];
    confirm('交出去？', `<div class="hint">${esc(Q.name)}</div><div class="tr-row"><span>给了</span><b class="tr-gain"><i class="ico-gold"></i>+${Q.reward}</b></div>`, '确认交', () => {
      const r = O().questDo(S, id);
      if (r.ok) { U.toast(r.text); D.Sfx.play('coin'); } else { D.Sfx.play('nope'); U.toast('东西不够'); }
      U.refresh();
    });
  }
  function questPickAsk(S, st, bi) {
    const e = S.raid.bag.items[bi], id = QUEST_OF[st.id], Q = O().QUESTS[id];
    if (!e) return U.refresh();
    confirm('交出去？', `<div class="tr-it"><img src="${icon(e.id)}"><div class="tr-nm"><span>${esc(itemName(e.id))}</span></div></div><div class="tr-row"><span>给了</span><b class="tr-gain"><i class="ico-gold"></i>+${Q.reward}</b></div>`, '确认交', () => {
      const r = O().questDo(S, id, e);
      if (r.ok) { U.toast(r.text); D.Sfx.play('coin'); } else { D.Sfx.play('nope'); U.toast('东西不对'); }
      U.refresh();
    });
  }

  // 确认框（和交易的确认框一样：Enter 确认，Esc 取消）
  function confirm(title, body, okText, onOk) {
    const m = U.modal('trade tr-buy outp-ok', `<h3>${esc(title)}</h3>${body}<div class="mfoot"><button class="btn sm" data-act="close">取消（Esc）</button><button class="btn sm primary" data-act="ok">${esc(okText)}（Enter）</button></div>`);
    D.Sfx.play('click');
    const done = yes => { if (keyH) { removeEventListener('keydown', keyH, true); keyH = null; } if (!m.isConnected) return; m.remove(); if (yes) onOk(); };
    m.querySelector('[data-act=ok]').onclick = () => done(true);
    m.querySelector('[data-act=close]').onclick = () => done(false);
    if (keyH) removeEventListener('keydown', keyH, true);
    keyH = e => {
      if (!m.isConnected) { removeEventListener('keydown', keyH, true); keyH = null; return; }
      e.stopImmediatePropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) done(true); }
      else if (e.code === 'Escape') { e.preventDefault(); done(false); }
    };
    addEventListener('keydown', keyH, true);
  }

  // ── 小镇（outpost-town.js）：站内界面收枪、右上角写叫车铃。要包在 ui-raid.js 和 hud-slots.js 之后
  const st0 = U.station;
  U.station = function (S) {
    const r = st0.apply(this, arguments);
    if (S && S.town) root().classList.add('town'); // CSS 藏掉子弹、技能和模块格（快捷栏的药还在）
    return r;
  };
  const su0 = U.stationUpdate;
  U.stationUpdate = function (S) {
    const r = su0.apply(this, arguments);
    if (S && S.town && !S.over) {
      const el = root().querySelector('.sched'), X = S.sched; if (!el || !X) return r;
      const up = S.f !== 1, set = (t, s) => { const a = el.querySelector('.sc-t'), b = el.querySelector('.sc-s'); if (a.textContent !== t) a.textContent = t; if (b.textContent !== s) b.textContent = s; };
      if (X.st === 'off' && !S.banner) { el.style.display = 'flex'; el.classList.add('bell'); el.classList.remove('due', 'soon'); set('不限时', up ? '下到站台按铃' : '站台左边按铃'); el.querySelector('.sc-bar i').style.width = '0%'; }
      else if (X.st === 'dwell') { el.classList.remove('bell'); set('列车在等你', up ? '回站台上车' : '站台下沿上车'); }
      else el.classList.remove('bell');
    }
    return r;
  };
})(D);
