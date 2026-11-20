/* Underdog · 开发者控制（设置里输入密码才出现）。
   设置最下面（据点或标题里打开时）先要一个密码框，输入 114514 之后出现"开发者"一栏：
   - 解锁全部进度：只对当前存档（G.pf）生效，要在据点里做。教学跳过、城市全开、每座城的站都认得且出口亮着、
     线索全读、剧情场次全记为看过（不再自动演）、机库每个型号都有且满状况、设施满级。
   - 查看全部剧情：列出所有场次（D.Dlg.SCENES），点哪一场演哪一场。演的是当前存档的一份拷贝（没有存档时用新档），
     只看不改进度；演完回到刚才的地方，再回到列表。
   解锁状态记在 sessionStorage：刷新网页还在，关掉标签页就没了；"锁回去"随时关。
   注意：这是给开发用的门，密码写在源码里，谁都能看到，不是安全措施。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, esc = X.esc;
  const PASS = '114514', KEY = 'ud.devUnlock';
  let root = null;
  X.hooks.init.push(r => { root = r; });

  // ── 解锁状态（本次打开的网页里有效）
  const ss = {
    get: () => { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
    set: on => { try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch (e) { } },
  };
  let on = ss.get();
  const usable = () => { const G = D.Game; return !!G && (G.mode === 'hub' || G.mode === 'title'); }; // 据点和标题里才给；站里、出发、结算里不给（会打断一趟）

  // ── 全部进度：只改当前存档
  function unlockAll() {
    const G = D.Game, pf = G && G.pf;
    if (!pf) { U.toast('先开一局或读一个存档，才有进度可解锁'); D.Sfx.play('nope'); return; }
    if (G.mode !== 'hub') { U.toast('在据点里才能用'); D.Sfx.play('nope'); return; }
    pf.tut = 1;
    if (D.Cities) D.CITY_ORDER.forEach(k => D.Cities.open(pf, k));
    const cities = D.Cities ? D.CITY_ORDER.map(k => D.Cities.build(pf, k)) : [pf.city];
    for (const C of cities) {
      for (const s of C.stations) {
        if (s.dead) continue;
        C.known.set(s.id, 2); // 2 = 去过：站和出口都亮着
        if (s.exit === 'hidden') { C.found = C.found || new Set(); C.found.add(s.id); }
      }
    }
    if (D.Story) {
      for (const c of D.Story.CLUES) D.Story.learn(pf, c.k, '开发者解锁', null);
      const st = D.Story.S(pf); st.seen = st.seen || {};
      for (const id in D.Dlg.SCENES) st.seen[id] = 1;
    }
    for (const k in D.SHELLS) pf.shells[k] = { own: 1, cond: 1 };
    if (D.Growth) { const g = pf.grow || (pf.grow = D.Growth.fresh()); for (const k in g.fac) g.fac[k] = 4; }
    G.save();
    U.closeModal();
    G.hubTab(G.tab || 'home');
    U.toast('已解锁全部进度'); D.Sfx.play('pick');
  }

  // ── 查看全部剧情
  const firstLine = sc => { const n = (sc.nodes || []).find(x => x.k === 'say' || x.k === 'narr'); return n && n.t ? n.t : ''; };
  const scenesList = () => Object.values(D.Dlg.SCENES).sort((a, b) => String(a.code || 'Z').localeCompare(String(b.code || 'Z')) || a.id.localeCompare(b.id));
  function playView(id) {
    const G = D.Game, base = G.pf;
    const pf = base ? D.Save.deserialize(D.Save.serialize(base)) : D.newProfile('LANCHUAN'); // 一份拷贝：看过的记号不写进真存档
    U.closeModal();
    const back = () => { if (G.mode === 'title') U.title(); else if (G.pf) G.hubTab(G.tab || 'home'); storyModal(); };
    D.Scene.play([id], pf, back, { dry: true });
  }
  function storyModal() {
    const rows = scenesList().map(sc => {
      const line = firstLine(sc), q = [sc.code || '', sc.id, line].join(' ');
      return `<button class="btn sm devrow" data-id="${esc(sc.id)}" data-q="${esc(q)}"><b>${esc(sc.code || '—')}</b> ${esc(sc.id)} <em class="dim">${esc(line.slice(0, 40))}</em></button>`;
    }).join('');
    const el = U.modal('devstory', `<h3>查看全部剧情</h3><div class="hint">每一场只看不改进度：演的是当前存档的一份拷贝（没有存档时用新档）。</div>
      <input class="devq" type="search" placeholder="搜编号或台词" style="width:100%;margin:6px 0">
      <div class="devlist" style="max-height:52vh;overflow:auto;display:flex;flex-direction:column;gap:4px">${rows}</div>
      <div class="mfoot"><button class="btn sm" data-act="back">返回设置</button></div>`);
    const q = el.querySelector('.devq');
    q.oninput = () => { const t = q.value.trim().toLowerCase(); el.querySelectorAll('.devrow').forEach(b => { b.style.display = !t || b.dataset.q.toLowerCase().includes(t) ? '' : 'none'; }); };
    q.addEventListener('keydown', e => e.stopPropagation());
    el.querySelectorAll('.devrow').forEach(b => b.onclick = () => playView(b.dataset.id));
    el.querySelector('[data-act=back]').onclick = () => { D.Sfx.play('click'); U.closeModal(); U.settings(); };
  }

  // ── 设置里的开发者栏
  function tryPass(pw) { if (String(pw).trim() === PASS) { on = true; ss.set(true); return true; } return false; }
  function addZone() {
    const m = root && root.querySelector('.modal.settings'), foot = m && m.querySelector('.mfoot');
    if (!foot || !usable()) return;
    const z = document.createElement('div');
    z.className = 'set-group devzone';
    if (!on) {
      z.innerHTML = `<h4>开发者 <em class="dim">给开发用的，要密码</em></h4>
        <label class="set-row"><span>密码</span><input type="password" class="devpw" autocomplete="off" placeholder="输入密码"><button class="btn sm primary" data-act="devgo">解锁</button></label>
        <em class="dim devmsg"></em>`;
      const pw = z.querySelector('.devpw'), msg = z.querySelector('.devmsg');
      const go = () => {
        if (tryPass(pw.value)) { D.Sfx.play('pick'); U.settings(); return; }
        pw.value = ''; msg.textContent = '密码不对'; D.Sfx.play('nope');
      };
      z.querySelector('[data-act=devgo]').onclick = go;
      pw.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
      foot.parentNode.insertBefore(z, foot);
      setTimeout(() => pw.focus(), 0);
    } else {
      z.innerHTML = `<h4>开发者 <em class="dim">已解锁</em></h4>
        <div class="mcol"><button class="btn sm" data-act="devall">解锁全部进度</button><button class="btn sm" data-act="devview">查看全部剧情</button><button class="btn sm" data-act="devlock">锁回去</button></div>
        <em class="dim">解锁全部进度：教学、城市、站、线索、剧情（不再自动演）、机库、设施满级。只对当前存档生效，要在据点里做。</em>`;
      z.querySelector('[data-act=devall]').onclick = () => { D.Sfx.play('click'); unlockAll(); };
      z.querySelector('[data-act=devview]').onclick = () => { D.Sfx.play('click'); storyModal(); };
      z.querySelector('[data-act=devlock]').onclick = () => { on = false; ss.set(false); D.Sfx.play('click'); U.settings(); };
      foot.parentNode.insertBefore(z, foot);
    }
  }
  // 设置窗口：原来的内容照旧，最后面加上开发者栏（ui-menu.js 里 U.settings 的后面挂上）
  const settings0 = U.settings;
  U.settings = function () { settings0.apply(this, arguments); addZone(); };

  D.DevUnlock = { PASS, isOn: () => on, tryPass, unlockAll, storyModal, playView };
})(D);
