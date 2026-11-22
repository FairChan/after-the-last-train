/* 末班之后 · 小样二：标题页、存档位、设置、据点菜单、暂停菜单 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip } = X;
  let root, G;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
  const when = t => { if (!t) return ''; const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const slotLine = s => s.empty ? '<span class="dim">空</span>' : `第 ${s.day} 天 · 余额 ${s.money} · 撤出 ${s.wins} / 损毁 ${s.deaths} · ${esc(s.shell)}${s.note === 'raid' ? ' · <em class="warn">上次在城里关掉了（已按损毁结算）</em>' : ''}<br><span class="dim">城市 ${esc(s.seed)} · ${when(s.savedAt)}</span>`;

  // ── 弹窗（盖在当前界面上面）
  U.modal = (...a) => modal(...a); // ach.js 的成就页要用
  function modal(cls, html, sticky) {
    closeModal();
    const el = document.createElement('div'); el.className = 'modal ' + cls; el.innerHTML = `<div class="mbox">${html}</div>`;
    if (!sticky) el.addEventListener('pointerdown', e => { if (e.target === el) closeModal(); });
    root.appendChild(el); hideTip(); return el;
  }
  function closeModal() { const m = root && root.querySelector('.modal'); if (m) m.remove(); }
  U.closeModal = closeModal;
  U.modalOpen = () => !!(root && root.querySelector('.modal'));

  // ── 标题：简约、沉浸。背后的活车站铺满全屏（main.js 画：夜里的站台，一列车隔一会儿进站、开门、开走；
  // 站台边站着一台在等车的机器人——有存档时是你最近用的那台），上下电影黑边 + 暗角，镜头慢慢平移。
  // 前面只有左下一组字：大标题 UNDERDOG 和纯文字菜单。上下键 / W S 选，回车确认。
  // 城市种子收在底边；"导入存档"在"读取存档"里。
  const MENU = [['continue', '继续'], ['new', '新游戏'], ['load', '读取存档'], ['settings', '设置']];
  let tKey = null, leaving = false;
  X.hooks.clear.push(() => { if (tKey) { removeEventListener('keydown', tKey, true); tKey = null; } });

  // ── 离开开始页：先在原地播退场（菜单往左收、标题故障一下、电影黑边往外收、暗角散掉），播完才真的进城 / 读档。
  //    进首页的入场动画在 ui-home.js（U.home 看见标题页还在，就放）。没有标题页（比如从据点菜单读档）就直接进。
  function leave(then) {
    if (leaving) return;
    const ti = root && root.querySelector('.ti');
    if (!ti) return then();
    leaving = true; ti.classList.add('ti-out'); ti.style.pointerEvents = 'none'; D.Sfx.play('riser');
    setTimeout(() => { leaving = false; then(); }, 820);
  }

  U.title = function () {
    U.clear(); root.className = 'm-title'; D.titleShell = 'worker';
    root.innerHTML = `<div class="ti">
      <div class="ti-vig"></div><div class="ti-bar top"></div><div class="ti-bar bot"></div>
      <div class="ti-main">
        <div class="ti-logo">UNDERDOG</div>
        <nav class="ti-menu">${MENU.map(([k, zh]) => `<button class="ti-it" data-act="${k}"${k === 'continue' ? ' style="display:none"' : ''}><span class="ti-mk">▶</span><span class="ti-zh">${zh}</span><small></small></button>`).join('')}</nav>
      </div>
      <div class="ti-foot"><span class="seedrow">城市 <input id="seed" maxlength="12" spellcheck="false"><button class="ti-link" data-act="rseed" data-tip="随便换一座城市（线路、站点都不一样；不填就是默认的城市）">随机</button></span></div>
      <div class="ti-fade"></div>
      </div>`;
    const inp = $('#seed'), seed = () => inp.value.trim() || 'LANCHUAN', cap = () => {};
    inp.value = 'LANCHUAN';
    $('[data-act=rseed]').onclick = () => { D.Sfx.play('click'); const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; inp.value = Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join(''); cap(); };
    $('[data-act=new]').onclick = () => { D.Sfx.play('click'); slotPicker('new', seed()); };
    $('[data-act=load]').onclick = () => { D.Sfx.play('click'); slotPicker('load'); };
    $('[data-act=settings]').onclick = () => { D.Sfx.play('click'); U.settings(); };
    // 选中的那一项：鼠标移上去或上下键
    const items = () => [...$$('.ti-it')].filter(b => b.style.display !== 'none');
    const pick = b => { $$('.ti-it').forEach(x => x.classList.toggle('sel', x === b)); };
    $$('.ti-it').forEach(b => b.addEventListener('pointerenter', () => { if (!b.classList.contains('sel')) { pick(b); D.Sfx.play('tink'); } }));
    pick(items()[0]);
    tKey = e => {
      if (leaving || U.modalOpen() || document.activeElement === inp || !root.querySelector('.ti')) return;
      const L = items(), i = L.findIndex(b => b.classList.contains('sel')), k = e.key;
      if (k === 'ArrowDown' || k === 's' || k === 'S') { pick(L[(i + 1) % L.length]); D.Sfx.play('tink'); e.preventDefault(); e.stopPropagation(); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { pick(L[(i - 1 + L.length) % L.length]); D.Sfx.play('tink'); e.preventDefault(); e.stopPropagation(); }
      else if (k === 'Enter' && L[i]) { L[i].click(); e.preventDefault(); e.stopPropagation(); }
    };
    addEventListener('keydown', tKey, true);
    // 有存档：显示"继续"（最近的那个）并选中它；站台上换成那个存档最近用的型号
    D.Save.list().then(list => {
      const c = $('[data-act=continue]'); if (!c) return;
      const best = list.filter(s => !s.empty).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
      if (!best) return;
      c.style.display = ''; c.querySelector('small').textContent = `存档 ${best.slot + 1} · 第 ${best.day} 天 · 余额 ${best.money}`; c.classList.add('primary');
      c.onclick = async () => { const pf = await D.Save.load(best.slot); if (pf) { D.Sfx.play('pick'); leave(() => G.loadGame(pf, best.slot)); } };
      D.Save.load(best.slot).then(pf => { if (pf) D.titleSeed = pf.seed; }); // 背后的天际线也换成那座城
      pick(c); const k = Object.keys(D.SHELLS).find(x => D.SHELLS[x].name === best.shell); if (k) D.titleShell = k;
    });
  };

  // ── 存档位：新游戏选位置 / 读档 / 导入后选位置
  async function slotPicker(mode, arg) {
    const list = await D.Save.list();
    const title = { new: '新游戏放在哪个存档位', load: '读取存档', import: '导入到哪个存档位' }[mode];
    const el = modal('mslots', `<h3>${title}</h3>${list.map(s => `<div class="slot-row${s.empty ? ' empty' : ''}"><b class="sn">${s.slot + 1}</b><div class="sl">${slotLine(s)}</div><div class="sa">
        ${mode === 'load' ? (s.empty ? '' : `<button class="btn sm primary" data-go="${s.slot}">读取</button><button class="btn sm" data-exp="${s.slot}">导出</button><button class="btn sm" data-del="${s.slot}">删除</button>`)
        : `<button class="btn sm${s.empty ? ' primary' : ''}" data-go="${s.slot}" data-empty="${s.empty ? 1 : 0}">${s.empty ? '放在这里' : '覆盖'}</button>`}</div></div>`).join('')}
      <div class="mfoot">${mode === 'load' ? '<button class="btn sm" data-act="imp" data-tip="从导出的存档文件读进来">导入存档文件</button>' : ''}<button class="btn sm" data-act="close">返回</button></div>`);
    el.querySelector('[data-act=close]').onclick = () => { D.Sfx.play('click'); closeModal(); };
    const imp = el.querySelector('[data-act=imp]'); if (imp) imp.onclick = () => { D.Sfx.play('click'); closeModal(); importSave(); };
    el.querySelectorAll('[data-go]').forEach(b => b.onclick = async () => {
      const slot = +b.dataset.go;
      // 覆盖要点两下
      if (mode !== 'load' && b.dataset.empty === '0' && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = '确认覆盖？'; b.classList.add('danger'); D.Sfx.play('warn'); return; }
      D.Sfx.play('pick');
      if (mode === 'new') { closeModal(); leave(() => G.newGame(arg, slot)); }
      else if (mode === 'import') { await D.Save.write(slot, arg); closeModal(); leave(() => G.loadGame(arg, slot)); }
      else { const pf = await D.Save.load(slot); closeModal(); if (pf) leave(() => G.loadGame(pf, slot)); }
    });
    el.querySelectorAll('[data-exp]').forEach(b => b.onclick = async () => { const pf = await D.Save.load(+b.dataset.exp); if (pf) D.Save.exportFile(pf, +b.dataset.exp); D.Sfx.play('click'); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '确认删除？'; b.classList.add('danger'); D.Sfx.play('warn'); return; }
      await D.Save.remove(+b.dataset.del); D.Sfx.play('nope'); slotPicker('load'); if (G.mode === 'title') U.title();
    });
  }
  U.slotPicker = slotPicker;
  function importSave() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { try { const pf = D.Save.importText(rd.result); slotPicker('import', pf); } catch (e) { U.toast('读不了这个文件：' + e.message); D.Sfx.play('nope'); } };
      rd.readAsText(f);
    };
    inp.click();
  }

  // ── 设置
  U.settings = function () {
    const S = D.settings;
    const slider = (k, name) => `<label class="set-row"><span>${name}</span><input type="range" min="0" max="100" value="${Math.round(S[k] * 100)}" data-k="${k}"><b>${Math.round(S[k] * 100)}</b></label>`;
    const range = (k, name, lo, hi) => { const v = Math.round((S[k] != null ? S[k] : 1) * 100); return `<label class="set-row"><span>${name}</span><input type="range" min="${lo}" max="${hi}" value="${v}" data-k="${k}"><b>${v}</b></label>`; }; // 站里的血条、顶栏、小地图、技能格：不透明度 / 大小（百分比，hud-tune.js）
    const toggle = (k, name, hint) => `<label class="set-row tog"><span>${name}</span><input type="checkbox" data-t="${k}"${S[k] ? ' checked' : ''}><em class="dim">${hint}</em></label>`;
    const binds = `<div class="set-group binds"><h4>改键 <em class="dim">点一下再按新键（Esc 取消）。左键开枪、右键近战 / 开镜不能改</em></h4><div class="bind-grid">${Object.keys(D.BIND_DEFAULT).map(k => `<label class="bind"><span>${D.ACT_NAME[k]}</span><button class="btn sm${S.binds && S.binds[k] ? ' changed' : ''}" data-bind="${k}">${D.keyLabel(D.key(k))}</button></label>`).join('')}</div></div>`;
    const el = modal('settings', `<h3>设置</h3>
      <div class="set-group"><h4>声音</h4>${slider('master', '总音量')}${slider('music', '音乐')}${slider('sfx', '音效')}${slider('ambient', '环境声')}<label class="set-row tog"><span>音乐品质</span><select data-s="musicQ">${[[-1, '自动'], [1, '高'], [0, '低']].map(([v, t]) => `<option value="${v}"${(S.musicQ != null ? +S.musicQ : -1) === v ? ' selected' : ''}>${t}</option>`).join('')}</select><em class="dim">低：不要混响和磁带声，手机上省电；自动：手机低、电脑高</em></label></div>
      <div class="set-group"><h4>拾取</h4>${toggle('autoAmmo', '自动捡弹药', '走近就把地上的弹药捡进背包；关着时和别的东西一样，按 F 或在拾取框里捡')}${toggle('autoMeds', '自动捡药品', '维修包、电池走近就捡')}<label class="set-row tog"><span>自动捡贵重</span><select data-s="autoQ">${[[-1, '关'], [1, '绿色及以上'], [2, '蓝色及以上'], [3, '紫色及以上'], [4, '金色及以上']].map(([v, n]) => `<option value="${v}"${(S.autoQ == null ? -1 : S.autoQ) === v ? ' selected' : ''}>${n}</option>`).join('')}</select><em class="dim"></em></label>${toggle('hints', '新手提示', '某个系统第一次出现时说一句')}</div>
      <div class="set-group"><h4>画面</h4>${toggle('crt', '扫描线', '画面上一层很淡的扫描线和四角暗角，像在一块旧显示器后面看')}${toggle('lite', '精简界面', '去掉大部分飘字，提示变小，横幅只留标题')}${toggle('fillWindow', '铺满窗口', '关：按整数倍放大，像素最清楚（四周可能有黑边）；开：铺满窗口，像素会有粗有细')}${range('hudAlpha', '界面透明度', 30, 100)}${range('hudScale', '界面大小', 70, 130)}${slider('shake', '震屏强度')}${toggle('reduceFlash', '减少闪光', '受击红屏、爆闪变弱')}${toggle('dmgNums', '显示伤害数字', '')}${toggle('foeArrows', '敌人方向箭头', '附近的敌人在屏幕外时，屏幕边缘亮一个红箭头指着它（像撤离点的箭头）')}</div>
      <div class="set-group"><h4>剧情</h4><label class="set-row tog"><span>打字速度</span><select data-s="typeSpeed">${[[0.6, '慢'], [1, '中'], [1.7, '快'], [1000, '立刻']].map(([v, t]) => `<option value="${v}"${(+S.typeSpeed || 1) === v ? ' selected' : ''}>${t}</option>`).join('')}</select><em class="dim">剧情对话一个字一个字打出来的速度</em></label>${toggle('dlgTimers', '限时选项', '少数几处选择会倒计时，不选就算沉默；关掉后一直等你选')}</div>
      <div class="set-group"><h4>辅助与手柄</h4>${toggle('cb', '色弱模式', '品质颜色换成色弱也分得清的一套：灰、天蓝、深蓝、紫红、黄、朱红')}<label class="set-row tog"><span>游戏速度</span><select data-s="speed">${[[1, '100%'], [0.85, '85%'], [0.7, '70%']].map(([v, t]) => `<option value="${v}"${(+S.speed || 1) === v ? ' selected' : ''}>${t}</option>`).join('')}</select><em class="dim">只影响站里，打不过来时可以放慢</em></label>${toggle('aimAssist', '手柄瞄准辅助', '右摇杆瞄准时吸到附近的敌人')}${toggle('tradeConfirm', '买卖前确认', '买下、卖出之前弹出确认框；关掉后单击直接成交')}<label class="set-row tog"><span>全屏</span><button class="btn sm" data-act="fs">${D.fullscreen && D.fullscreen.on() ? '退出全屏' : '进入全屏'}</button><em class="dim">也可以按 F11</em></label></div>
      ${binds}<div class="set-group keys-help" style="display:none"><h4>按键</h4><div class="keys"><b>WASD</b> 移动 <b>左键</b> 开枪 <b>右键</b> 近战（按住蓄力） <b>空格</b> 闪避 <b>Q E</b> 模块 <b>G</b> 型号技能 <b>R</b> 换弹 <b>B</b> 换弹种 <b>F</b> 交互 / 捡东西 <b>C</b> 回血 <b>V</b> 护盾 <b>X</b> 释放电容 <b>Tab</b> 背包 <b>Esc</b> 暂停 <b>M</b> 静音</div><div class="dim">改键和手柄在后面的版本加。</div></div>
      <div class="mfoot"><button class="btn sm" data-act="reset">恢复默认</button><button class="btn sm primary" data-act="close">完成</button></div>`);
    let t = 0; const save = () => { clearTimeout(t); t = setTimeout(() => D.Save.saveSettings(), 250); };
    el.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { S[i.dataset.k] = +i.value / 100; i.nextElementSibling.textContent = i.value; D.applySettings(); save(); });
    el.querySelectorAll('select[data-s]').forEach(i => i.onchange = () => { S[i.dataset.s] = +i.value; save(); D.Sfx.play('click'); });
    el.querySelectorAll('input[data-t]').forEach(i => i.onchange = () => { S[i.dataset.t] = i.checked; D.applySettings(); save(); D.Sfx.play('click'); });
    el.querySelectorAll('[data-bind]').forEach(b => b.onclick = () => {
      const k = b.dataset.bind; b.textContent = '按一个键…'; b.classList.add('wait'); D.Sfx.play('click');
      const grab = ev => {
        ev.preventDefault(); ev.stopPropagation(); removeEventListener('keydown', grab, true);
        if (ev.code !== 'Escape') { S.binds = Object.assign({}, S.binds); const old = D.key(k); for (const o in D.BIND_DEFAULT) if (o !== k && D.key(o) === ev.code) S.binds[o] = old; S.binds[k] = ev.code; save(); }
        U.settings();
      };
      addEventListener('keydown', grab, true);
    });
    el.querySelector('[data-act=reset]').onclick = () => { D.Save.resetSettings(); D.Sfx.play('click'); U.settings(); };
    el.querySelector('[data-act=fs]').onclick = () => { D.Sfx.play('click'); if (D.fullscreen) D.fullscreen.toggle(); setTimeout(() => { const b = document.querySelector('.modal [data-act=fs]'); if (b) b.textContent = D.fullscreen.on() ? '退出全屏' : '进入全屏'; }, 300); };
    el.querySelector('[data-act=close]').onclick = () => { D.Sfx.play('click'); closeModal(); if (G.mode === 'station' && G.paused) U.pause(true); };
  };

  // ── 据点菜单
  U.hubMenu = function () {
    const at = D.Save.lastSavedAt;
    const el = modal('hubmenu', `<h3>菜单</h3><div class="hint">${G.slot != null ? `存档 ${G.slot + 1} · ${at ? '自动保存于 ' + when(at) : '还没保存过'}` : '这局没有存档位（测试模式）'}</div>
      <div class="mcol"><button class="btn" data-act="save">立刻保存</button><button class="btn" data-act="export">导出存档文件</button><button class="btn" data-act="settings">设置</button><button class="btn" data-act="tut">新手教学</button><button class="btn" data-act="tour">据点导览</button><button class="btn" data-act="open">重看开场</button><button class="btn" data-act="ach">成就${D.Ach ? ' ' + D.Ach.count() + ' / ' + D.Ach.LIST.length : ''}</button><button class="btn" data-act="title">保存并回到标题</button><button class="btn sm" data-act="close">返回</button></div>`);
    el.querySelector('[data-act=save]').onclick = async () => { const ok = await G.save(); U.toast(ok ? '已保存' : '保存失败（浏览器不让存）'); D.Sfx.play(ok ? 'pick' : 'nope'); U.hubMenu(); };
    el.querySelector('[data-act=export]').onclick = () => { D.Save.exportFile(G.pf, G.slot); D.Sfx.play('click'); };
    el.querySelector('[data-act=settings]').onclick = () => { D.Sfx.play('click'); U.settings(); };
    el.querySelector('[data-act=title]').onclick = async () => { await G.save(); G.toTitle(); };
    el.querySelector('[data-act=tut]').onclick = () => { D.Sfx.play('click'); G.tutorial(); };
    el.querySelector('[data-act=tour]').onclick = () => { D.Sfx.play('click'); closeModal(); if (G.tab !== 'home') G.hubTab('home'); if (D.Tour) setTimeout(() => D.Tour.start(), 60); }; // 聚光灯一页页点亮据点（tut-tour.js）
    el.querySelector('[data-act=open]').onclick = () => { D.Sfx.play('click'); closeModal(); if (D.Scene) D.Scene.play(['open'], G.pf, () => G.toHub('home'), { dry: true }); }; // 开场 S00：只看，不改进度
    el.querySelector('[data-act=ach]').onclick = () => { D.Sfx.play('click'); if (D.Ach) D.Ach.page(); };
    el.querySelector('[data-act=close]').onclick = () => { D.Sfx.play('click'); closeModal(); };
  };

  // ── 站内暂停菜单
  // 第一次进据点：问要不要走一遍新手教学
  U.tutOffer = function () {
    if (U.introBusy && U.introBusy()) return setTimeout(U.tutOffer, 300); // 开始页进首页的入场还在放：等放完再问，不盖在动画上面
    const el = modal('tutoffer', `<h3>新手教学</h3><div class="hint">林桥在下面一层的训练长厅等你：八个区，从走路、开枪、近战、闪避，到模块、手雷、搜刮、门禁、换枪开镜、敌人怎么发现你，最后坐到站台上撤离。大约 12 分钟，不会损毁，带出来的东西归你；哪一区会了按回车就跳过。撤出以后再带你认一遍据点。以后也能在据点"菜单"里重玩。</div>
      <div class="mfoot"><button class="btn sm" data-act="skip">跳过</button><button class="btn primary" data-act="go">开始教学</button></div>`, true);
    el.querySelector('[data-act=go]').onclick = () => { D.Sfx.play('click'); G.tutorial(); };
    el.querySelector('[data-act=skip]').onclick = () => { D.Sfx.play('click'); closeModal(); G.pf.tut = 1; G.save(); if (D.Scene && D.Scene.pending(G.pf).length) G.toHub('home'); }; // 跳过教学：接着演序幕（scene.js）
  };
  U.pause = function (on) {
    if (D.Spot && !(D.Tour && D.Tour.cur)) D.Spot.hide(); // 训练场的聚光灯：暂停时收起，继续后下一帧再亮
    if (!on) { closeModal(); return; }
    const tut = !!(G.raid && G.raid.tut);
    const el = modal('pausem', `<h3>暂停</h3>
      <div class="mcol"><button class="btn primary" data-act="resume">继续（Esc）</button><button class="btn" data-act="settings">设置</button><button class="btn danger" data-act="quit">${tut ? '跳过教学' : '放弃这一趟'}</button></div>
      <div class="hint">${tut ? '训练场不会损毁。跳过的话，以后可以在据点"菜单"里重玩。' : '放弃 = 工壳损毁：背包、装上的卡、买来的型号都留在城里，只剩保险箱。关掉网页也按这样算。'}</div>`, true);
    el.querySelector('[data-act=resume]').onclick = () => G.resume();
    el.querySelector('[data-act=settings]').onclick = () => { D.Sfx.play('click'); U.settings(); };
    const q = el.querySelector('[data-act=quit]');
    q.onclick = () => { if (!q.dataset.sure) { q.dataset.sure = 1; q.textContent = '确认放弃？'; D.Sfx.play('warn'); return; } G.abandon(); };
  };
})(D);
