/* 末班之后 · 小样二：主线的界面（M4）
   据点"人物"页（林桥 / 阿隼 / 陆峥的对话和委托）、"线索"页（线索日志、下一步、委托进度）、
   线索卡片（读到线索时弹出 6 秒）、剧情卡片（储备库、第 10 节战略黑匣子）、尾声。规则都在 story.js。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip } = X;
  let root, G;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  const St = () => D.Story;
  const T = (pf, x) => (typeof x === 'function' ? x(pf) : x) || '';

  // ── 据点：人物 / 线索
  U.storyTab = function (pf, body, tab) {
    const S = St(), s = S.S(pf);
    if (tab === 'npc') {
      const unseen = new Set(S.visibleBeats(pf).filter(b => s.talk[b.id] == null).map(b => b.id));
      const learned = S.seeBeats(pf);
      body.innerHTML = `<div class="stash story"><div class="st-head"><h3>人物</h3><span class="hint">南栈的人。有新话时"人物"标签上会亮一个点。委托要的东西放在仓库、背包或保险箱里都行。</span></div>
        <div class="npc-cols">${Object.keys(S.NPC).map(k => npcCol(pf, k, unseen)).join('')}</div></div>`;
      body.querySelectorAll('[data-beat]').forEach(b => b.onclick = () => {
        const r = S.choose(pf, b.dataset.beat, +b.dataset.ch);
        if (!r) { D.Sfx.play('nope'); U.toast('零件不够'); return; }
        D.Sfx.play('pick'); if (r.text) U.toast(r.text);
        U.hub(pf, 'npc');
        if (r.ending) U.epilogue(pf, r);
      });
      body.querySelectorAll('[data-turnin]').forEach(b => b.onclick = () => {
        const q = b.dataset.turnin, t = S.turnIn(pf, q);
        if (t == null) { D.Sfx.play('nope'); return; }
        D.Sfx.play('coin');
        // 剧情灵魂：交了工牌演那一场（结局以后交的，再补演挂工牌）；交付以后新出现的话也接着演
        const ids = (q === 'l_badge' ? ['room_badge'].concat(s.ending ? ['epi_badge_late'] : []) : []).concat(D.Scene ? D.Scene.pending(pf) : []);
        if (ids.length && D.Scene) { D.Scene.play(ids, pf, () => U.hub(pf, 'npc')); return; }
        U.hub(pf, 'npc'); if (t) U.toast(t);
      });
      body.querySelectorAll('[data-replay]').forEach(b => b.onclick = () => {
        const id = b.dataset.replay, beat = S.BEATS.find(x => x.id === id);
        D.Sfx.play('click'); D.Scene.play([id], pf, () => U.hub(pf, 'npc'), { dry: !(beat && S.beatOpen(pf, beat)) });
      });
      for (const c of learned) U.clueCard(pf, c);
    } else {
      const next = S.nextSteps(pf), qs = Object.keys(S.QUESTS).filter(q => s.quests[q]);
      body.innerHTML = `<div class="stash story clues"><div class="st-head"><h3>线索</h3><span class="hint">读过的线索都记在这里：线索纸卖掉、丢掉、工壳损毁都不影响。</span><span class="worth">已读 <b>${s.clues.length}</b> / ${S.CLUES.length}</span></div>
        <div class="cl-cols"><div class="cl-side">
          <div class="wh">下一步</div>${next.map(t => `<p class="cl-next">${esc(t)}</p>`).join('') || '<p class="hint dim">先进城搜一搜。</p>'}
          <div class="wh">委托</div>${qs.length ? qs.map(q => { const Q = S.QUESTS[q], done = s.quests[q] === 'done'; return `<div class="cl-q${done ? ' done' : ''}"><b>${done ? '●' : '·'} ${esc(Q.name)}</b><span>${esc(S.NPC[Q.npc].name)}</span></div>`; }).join('') : '<p class="hint dim">去"人物"页看看。</p>'}
          ${(s.relics || []).length ? `<div class="wh">遗物</div>${s.relics.map(k => { const r = S.RELICS[k]; return `<div class="cl-relic"><b>${esc(r.title)}</b><span class="dim">第 ${r.car} 节车厢</span><p>${esc(r.text)}</p></div>`; }).join('')}` : ''}
          ${s.copy ? '<button class="btn sm" data-act="server">重读黑匣子档案</button>' : ''}${s.ending ? '<button class="btn sm" data-act="epi">重看尾声</button>' : ''}
        </div><div class="cl-main">${s.clues.length ? '' : '<div class="hint dim cl-none">还没有线索。翻柜子的时候留意旧纸片。</div>'}<div class="cl-list" data-pgarea="clues">${(() => { const P = X.page('clues', S.CLUES.length, 6); let h = ''; for (let i = P.from; i < P.to; i++) { const r = s.clues[i], c = r && S.CLUE[r.k]; h += c ? `<div class="clue"><div class="cl-h"><b>${String(i + 1).padStart(2, '0')}</b>${esc(c.title)}<em>${r.at ? esc(r.at) + ' · ' : ''}${esc(r.how || '')}</em></div><p>${esc(S.clueText(pf, c))}</p></div>` : `<div class="clue lock"><div class="cl-h"><b>${String(i + 1).padStart(2, '0')}</b>？？？</div><p>还没读到</p></div>`; } return h + '</div>' + P.html; })()}</div></div></div>`;
      const sv = body.querySelector('[data-act=server]'); if (sv) sv.onclick = () => { D.Sfx.play('click'); U.storyCard(S.SERVER.title, S.SERVER.text); };
      const ep = body.querySelector('[data-act=epi]'); if (ep) ep.onclick = () => { D.Sfx.play('click'); U.epilogue(pf, { text: S.epilogue(pf) }); };
    }
  };
  function npcCol(pf, k, unseen) {
    const S = St(), s = S.S(pf), N = S.NPC[k], beats = S.visibleBeats(pf, k).slice().reverse();
    const head = `<div class="np-head"><i class="np-av" style="--c:${N.col}">${esc(N.name[0])}</i><div><b>${esc(beats.length ? N.name : '？？？')}</b><span>${esc(beats.length ? N.role : '还没见过')}</span></div></div>`;
    if (!beats.length) return `<div class="npc dim">${head}<div class="hint">也许以后会遇到。</div></div>`;
    const quests = Object.keys(S.QUESTS).filter(q => S.QUESTS[q].npc === k && s.quests[q]).map(q => questHTML(pf, q)).join('');
    return `<div class="npc" style="--c:${N.col}">${head}<div class="hint np-tag">${esc(N.tag)}</div>${quests ? `<div class="np-qs">${quests}</div>` : ''}<div class="np-beats">${beats.map(b => beatHTML(pf, b, unseen.has(b.id))).join('')}</div></div>`;
  }
  function beatHTML(pf, b, isNew) {
    const S = St(), t = S.S(pf).talk[b.id], sc = D.Dlg && D.Dlg.SCENES[b.id];
    if (sc) {
      const first = sc.nodes.find(n => n.k === 'say' || n.k === 'narr'), line = first ? D.Dlg.plain(D.tr ? D.tr(first.t) : first.t) : '', open = S.beatOpen(pf, b);
      const pick = b.choices && t > 0 ? `<div class="bt-pick">● ${esc(b.choices[t - 1].t)}</div>` : '';
      const cut = D.I18N && D.I18N.lang === 'en' ? 90 : 46; return `<div class="beat${isNew ? ' new' : ''}"><p>${esc(line.length > cut ? line.slice(0, cut) + (cut > 46 ? '...' : '…') : line)}</p>${pick}<div class="bt-ch"><button class="btn sm${open ? ' primary' : ''}" data-replay="${b.id}"><b>${open ? '▶ 去做决定' : '▶ 重演这一场'}</b></button></div></div>`;
    }
    let ch = '';
    if (b.choices) {
      if (S.beatOpen(pf, b)) ch = `<div class="bt-ch">${b.choices.map((c, i) => { const ok = S.choiceOK(pf, c), sub = T(pf, c.sub); return `<button class="btn sm${ok ? '' : ' poor'}" data-beat="${b.id}" data-ch="${i}" ${ok ? '' : 'disabled'}><b>${esc(c.t)}${c.cost ? ' · ' + c.cost : ''}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`; }).join('')}</div>`;
      else if (t > 0) ch = `<div class="bt-pick">● ${esc(b.choices[t - 1].t)}</div>`;
    }
    return `<div class="beat${isNew ? ' new' : ''}">${b.text.map(p => `<p>${esc(T(pf, p))}</p>`).join('')}${ch}</div>`;
  }
  function questHTML(pf, q) {
    const S = St(), Q = S.QUESTS[q], st = S.S(pf).quests[q], done = st === 'done';
    const act = done ? '<span class="ok">● 完成</span>' : Q.auto ? '<span class="dim">进行中</span>' : S.canTurnIn(pf, q) ? `<button class="btn sm primary" data-turnin="${q}">交付</button>` : `<span class="dim">${Q.cost && pf.money < Q.cost && S.questOption(pf, q) >= 0 ? '零件不够' : '还没有'}</span>`;
    return `<div class="quest${done ? ' done' : ''}"><div class="qs-h"><b>委托 · ${esc(Q.name)}</b>${act}</div><div class="qs-d">${esc(Q.desc)}</div><div class="qs-r">报酬：${esc(Q.rewardText || '')}</div></div>`;
  }

  // ── 读到线索时：右上角一张卡片，6 秒后消失（点一下也行）
  U.clueCard = function (pf, c) {
    if (!root) return;
    const S = St(), n = S.S(pf).clues.length, el = document.createElement('div');
    el.className = 'cluecard';
    el.innerHTML = `<div class="cc-k">线索 ${n} / ${S.CLUES.length} · 已记入档案</div><h3>${esc(c.title)}</h3><p></p>`;
    root.querySelectorAll('.cluecard').forEach(o => o.remove());
    root.appendChild(el); el.onclick = () => el.remove();
    // 剧情灵魂：信号干扰闪一下，字一个一个打出来；后面加的那一句（更暗的那层）是铅笔色
    if (D.Mood) D.Mood.glitch(260);
    const tr = D.tr || (x => x), en = D.I18N && D.I18N.lang === 'en', t0 = typeof c.text === 'function' ? c.text(pf) : c.text, base = en ? tr(t0) : t0, dark = c.dark ? (en ? ' ' + tr(c.dark) : c.dark) : '', full = base + dark, p = el.querySelector('p');
    if (en || (D.settings && D.settings.typeSpeed >= 1000)) p.innerHTML = esc(base) + (dark ? `<span class="pencil">${esc(dark)}</span>` : '');
    else { let k = 0; const all = base.length + dark.length, tick = () => { if (!el.isConnected) return; k = Math.min(all, k + 2); p.innerHTML = esc(base.slice(0, k)) + (k > base.length && dark ? `<span class="pencil">${esc(dark.slice(0, k - base.length))}</span>` : '') + (k < all ? '<span class="cur"></span>' : ''); if (k < all) setTimeout(tick, 30); }; tick(); }
    setTimeout(() => el.remove(), 6500 + Math.min(4000, full.length * 30));
  };
  // ── 剧情卡片：储备库、战略黑匣子。不暂停，点"知道了"或 25 秒后关
  U.storyCard = function (title, paras) {
    if (!root) return;
    root.querySelectorAll('.storycard').forEach(o => o.remove());
    const el = document.createElement('div'); el.className = 'storycard';
    el.innerHTML = `<h3>${esc(title)}</h3>${paras.map(p => `<p>${esc(p)}</p>`).join('')}<button class="btn sm">知道了</button>`;
    root.appendChild(el); el.querySelector('button').onclick = () => { D.Sfx.play('click'); el.remove(); };
    setTimeout(() => el.remove(), 25000);
  };
  // ── 尾声
  U.epilogue = function (pf, r) {
    if (!root || !r || !r.text) return;
    root.querySelectorAll('.modal').forEach(o => o.remove());
    const el = document.createElement('div'); el.className = 'modal epi';
    el.innerHTML = `<div class="mbox"><span class="ep-k">尾声 · 账算完之后</span><h3>UNDERDOG</h3>${r.extra ? `<p class="ok">${esc(r.extra)}</p>` : ''}${r.text.map(p => `<p>${esc(p)}</p>`).join('')}<button class="btn primary" data-act="ok">${r.first === false ? '关闭' : '回到南栈'}</button></div>`;
    root.appendChild(el); hideTip();
    el.querySelector('[data-act=ok]').onclick = () => { D.Sfx.play('click'); el.remove(); };
    if (D.Sfx) D.Sfx.play('win');
  };
})(D);
