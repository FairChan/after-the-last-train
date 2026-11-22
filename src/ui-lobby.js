/* 末班之后 · 多人联机：大厅页（design/features/multiplayer §3.1）
   首页右上角"联机"→ 名字、中继地址 → 建房间（拿到 5 位房间码）/ 输房间码加入 → 大厅：每人一行（名字、型号、配装分、准备、延迟）
   → 房主选入口站和难度，全员准备后点出发。每个人用自己存档里的配装进城；教学没过的存档不能联机。
   房间列表：没进房间时面板里一直列着现在开着的房间（net/roomlist.js，NET.roomWatch），点"加入"就进，不用输房间码；输房间码加入照样留着。
   本地中转（用户："我想通过我们本地路由器做中转"）：房主电脑双击 server/本地中转.bat，勾上"本地中转"再建房间 → 房间走房主电脑上的中继，
   同一个路由器的人在列表里点加入（标"本地中转"），数据不出路由器。GitHub 网站连局域网要浏览器允许"访问本地网络"（第一次会问）。
   逻辑在 net/lobby.js；这里只有界面和文案。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, NET = D.Net, L = NET.Lobby, G = () => D.Game;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const ERR = { noroom: '没有这个房间（房间码对吗？）', full: '房间满了（最多 4 人）', started: '这一局已经开始了', ver: '版本不一样：大家都刷新到同一版本再来', net: '连不上中继（地址对吗？中继开着吗？）',
    nolocal: '没找到本地中转：先在这台电脑上双击 game/demo2/server/本地中转.bat；浏览器问"访问本地网络"时点允许',
    nolan: '连不上房主的本地中转：要和房主连同一个路由器；浏览器问"访问本地网络"时点允许' };
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem('underdog.mp.' + k); localStorage.setItem('underdog.mp.' + k, v); } catch (e) { return null; } };
  const DIFF = ['普通', '困难', '噩梦'];

  U.lobby = function () {
    const pf = G().pf; if (!pf) return;
    if (!pf.tut) { U.toast('先走完新手教学才能联机'); sfx('nope'); return; }
    if (L.state === 'off' && L.entry == null) { const sp = NET.startPoints(pf); L.entry = sp[0] != null ? sp[0] : null; }
    render();
  };
  L.changed = () => { if (document.querySelector('.modal.lobby')) render(); };

  // ── 房间列表：面板开着、还没进房间时一直看；关了面板 / 进了房间就停
  let W = null; // { w, url, list, err }
  function watch(url) {
    const on = L.state !== 'room' && document.querySelector('.modal.lobby') && NET.roomWatch;
    if (!on) { if (W) { W.w.close(); W = null; } return; }
    if (W && W.url === url) return;
    if (W) W.w.close();
    const me = W = { url, list: null, err: false };
    me.w = NET.roomWatch(url, (list, why) => {
      if (W !== me) return;
      if (!document.querySelector('.modal.lobby') || L.state === 'room') { me.w.close(); W = null; return; }
      me.list = list; me.err = list == null; me.old = why === 'old'; paintNear();
    });
  }
  const nearHtml = () => {
    if (W && W.old) return '<div class="hint">这个中继列不出房间，请用房间码加入</div>';
    if (!W || W.list == null) return `<div class="hint">${W && W.err ? '房间列表连不上：可以用房间码加入' : '正在找……'}</div>`;
    if (!W.list.length) return '<div class="hint">现在没有房间：建一个，朋友打开"联机"就能看到</div>';
    return W.list.map(r => `<div class="mp-nr"><b class="mp-n">${esc(r.name)}${r.lan ? ` <em class="mp-lan" data-tip="${esc(r.lan.join('  '))}">本地中转</em>` : ''}</b><span>${r.n | 0}/${r.max | 0} 人</span><span class="mp-code">${esc(r.code)}</span><button class="btn" data-near="${esc(r.code)}" data-key="${esc(r.key || r.code)}">加入</button></div>`).join('');
  };
  // 只换房间列表那一块，不动输入框，正在打字的不会被打断
  function paintNear() {
    const el = document.querySelector('.modal.lobby .mp-nlist'); if (!el) return;
    const h = nearHtml(); if (el._html !== h) { el._html = h; el.innerHTML = h; }
  }
  NET.Lobby.near = () => W && W.list; // 测试用：现在列表里的房间
  function render() {
    const pf = G().pf, keep = { name: val('#mpName'), url: val('#mpUrl'), code: val('#mpCode') };
    const name = keep.name || store('name') || ('工壳' + String(Math.floor(Math.random() * 900) + 100));
    // 以前在 GitHub Pages 上点过建房间，会记下连不上的 wss://xxx.github.io/，这种不算数
    let saved = store('url'); try { if (saved && NET.isStaticHost(new URL(saved).hostname)) saved = null; } catch (e) {}
    const url = keep.url || saved || NET.defaultRelay();
    let html, list = '';
    const local = store('local') === '1';
    const errHtml = L.err ? `<div class="mp-err">${esc(ERR[L.err] || ERR.net)}</div>` : '';
    if (L.state !== 'room') {
      html = `<h3>联机</h3><div class="hint">2–4 人组队打机器：各带各的配装进城，各自带东西出来、各自存档。一个人建房间，别人在下面的房间列表里点加入。</div>
        <div class="mp-f"><label>名字</label><input id="mpName" maxlength="12" spellcheck="false" value="${esc(name)}"></div>
        <div class="mcol"><button class="btn" data-act="host">建房间</button></div>
        <label class="mp-chk"><input type="checkbox" id="mpLocal"${local ? ' checked' : ''}><b>本地中转</b><span class="hint">同一个路由器联机最快：房主电脑先双击 game/demo2/server/本地中转.bat 再勾上</span></label>
        <div class="mp-near"><div class="mp-sub">房间列表<span class="hint">别人建的房间会自己出现在这里</span></div><div class="mp-nlist"></div></div>
        <div class="mp-r mp-small"><label>房间码</label><input id="mpCode" maxlength="5" placeholder="列表里没有时输入" spellcheck="false" value="${esc(keep.code || '')}"><button class="btn" data-act="join">加入</button></div>
        <div class="mp-f mp-small"><label>中继</label><input id="mpUrl" spellcheck="false" value="${esc(url)}" data-tip="中继服务器的地址：本机跑 node game/demo2/server/relay.mjs 就是 ws://localhost:8787/"></div>
        ${L.state === 'connecting' ? '<div class="hint mp-wait">连接中……</div>' : ''}${errHtml}
        <div class="mcol"><button class="btn" data-act="close">关闭</button></div>`;
    } else {
      const host = L.role === 'host', rows = host ? L.rows() : L.list, C = pf.city;
      const row = r => `<div class="mp-row${r.gone ? ' gone' : ''}"><b class="mp-n">${esc(r.name)}${r.host ? ' <em>房主</em>' : ''}</b><span>${r.shell && D.SHELLS[r.shell] ? esc(D.SHELLS[r.shell].name) : '—'}</span><span>配装 ${r.score | 0}</span><span class="${r.ready ? 'mp-ok' : 'mp-no'}">${r.gone ? '掉线了' : r.ready ? '准备好了' : '没准备'}</span><span class="mp-ping${!r.host && r.via !== 'rtc' && r.ping > 250 ? ' mp-slow' : ''}">${r.host ? '' : (r.ping | 0) + ' 毫秒' + (r.via === 'rtc' ? ' · 直连' : NET.viaLocal() ? ' · 本地中转' : r.ping > 250 ? ' · 中继（远，会卡）' : ' · 中继')}</span></div>`;
      const sp = NET.startPoints(pf), diffs = [0, 1, 2].filter(d => D.diffUnlocked(pf, d));
      list = rows.map(row).join('');
      html = `<h3>房间 <b class="mp-code">${esc(L.code)}</b></h3>${host ? (NET.viaLocal() ? '<div class="hint">房间走本地中转：和你连同一个路由器的人打开"联机"，在房间列表里点加入（浏览器问"访问本地网络"时点允许）。</div>' : '<div class="hint">房间已经出现在大家的房间列表里：朋友打开"联机"点加入就行（最多 4 人）。列表里看不到时，把房间码告诉他。</div>') : ''}
        <div class="mp-list"></div>
        ${host ? `<div class="mp-r"><label>入口</label><select id="mpEntry">${sp.map(id => `<option value="${id}"${id === L.entry ? ' selected' : ''}>${esc(C.stations[id].name)}${id === C.home ? '（据点，先选第一站）' : ''}</option>`).join('')}</select>
          <label>难度</label><select id="mpDiff">${diffs.map(d => `<option value="${d}"${d === L.diff ? ' selected' : ''}>${DIFF[d]}</option>`).join('')}</select></div>
          <div class="mcol"><button class="btn" data-act="go"${L.canGo() ? '' : ' disabled'}>出发</button>${L.canGo() ? '' : '<div class="hint">等所有人准备好</div>'}</div>`
        : `<div class="hint">入口：${esc(L.entryName || '房主还没选')} · 难度：${DIFF[L.diff | 0]}${L.fps ? ' · 房主 ' + (L.fps | 0) + ' 帧' : ''}</div>
          <div class="mcol"><button class="btn" data-act="ready">${L.ready ? '取消准备' : '准备'}</button><div class="hint">${L.ready ? '等房主出发' : '点准备，房主才能出发'}</div></div>`}
        ${errHtml}
        <div class="mcol"><button class="btn" data-act="leave">离开房间</button></div>`;
    }
    // 房主每秒广播一次（刷新延迟），每次都会走到这里：面板已经开着就原地改，不关掉重开（重开会重播淡入动画、一闪一闪，下拉框也会被关掉）。
    // 只有名单变了就只换名单；别的部分也没变就什么都不动。
    let el = document.querySelector('.modal.lobby'), box = el && el.querySelector('.mbox');
    if (box && box._html === html) { if (box._list !== list) { box._list = list; const l = box.querySelector('.mp-list'); if (l) l.innerHTML = list; } watch(url); return; }
    if (box) box.innerHTML = html; else { el = U.modal('lobby', html, true); box = el.querySelector('.mbox'); }
    box._html = html; box._list = list; const ml = box.querySelector('.mp-list'); if (ml) ml.innerHTML = list;
    const on =(a, f) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = f; };
    on('close', () => { sfx('click'); U.closeModal(); });
    on('host', async () => {
      sfx('click'); const n = val('#mpName') || name, u = val('#mpUrl') || url; store('name', n); store('url', u);
      if (store('local') === '1') { if (!(await L.host(NET.LOCAL_RELAY, n)) && L.err === 'net') { L.err = 'nolocal'; render(); } } // 本地中转：连房主自己电脑上的中继
      else await L.host(u, n);
    });
    const lc = el.querySelector('#mpLocal'); if (lc) lc.onchange = () => { sfx('click'); store('local', lc.checked ? '1' : '0'); };
    on('join', async () => { sfx('click'); const n = val('#mpName') || name, u = val('#mpUrl') || url, c = (val('#mpCode') || '').toUpperCase(); if (c.length !== 5) { L.err = 'noroom'; render(); return; } store('name', n); store('url', u); await L.join(u, c, n); });
    on('leave', () => { sfx('click'); L.reset(); render(); });
    on('ready', () => { sfx('click'); L.setReady(!L.ready); });
    on('go', () => { sfx('pick'); if (L.go()) U.closeModal(); });
    const se = el.querySelector('#mpEntry'); if (se) se.onchange = () => { L.entry = +se.value; L.broadcast(); };
    const sd = el.querySelector('#mpDiff'); if (sd) sd.onchange = () => { L.diff = +sd.value; L.broadcast(); };
    const nl = el.querySelector('.mp-nlist');
    if (nl) nl.onclick = async ev => {
      const b = ev.target.closest && ev.target.closest('[data-near]'); if (!b || L.state === 'connecting') return;
      sfx('click'); const n = val('#mpName') || name, u = val('#mpUrl') || url; store('name', n); store('url', u);
      const it = W && W.list && W.list.find(r => (r.key || r.code) === b.dataset.key);
      if (it && it.lan) await L.joinLan(it.lan, it.code, n); else await L.join(u, b.dataset.near, n); // 本地中转的房间：连房主电脑的局域网地址
    };
    const su = el.querySelector('#mpUrl'); if (su) su.onchange = () => watch(su.value.trim() || url);
    watch(url); paintNear();
  }
  const val = sel => { const e = document.querySelector('.modal.lobby ' + sel); return e ? e.value.trim() : ''; };

  // 首页右上角加一个"联机"按钮（菜单旁边）
  const hub0 = U.hub;
  U.hub = function (pf, tab) {
    const r = hub0.apply(this, arguments);
    const menu = document.querySelector('.hm-btn[data-act=menu]');
    if (menu && !document.querySelector('.hm-btn[data-act=coop]')) {
      const b = document.createElement('button'); b.className = 'hm-btn'; b.dataset.act = 'coop'; b.dataset.tip = '联机：2–4 人组队'; b.textContent = '联机';
      b.onclick = () => { sfx('click'); U.lobby(); }; menu.parentNode.insertBefore(b, menu);
    }
    return r;
  };
})(D);
