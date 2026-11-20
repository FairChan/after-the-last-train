/* 末班之后 · 站里和人说话：头顶气泡（用户："人类站台的对话都改成窗口对话"，选的是剧情对话那套头顶气泡）。
   管两处：未知信号站的人和未知信号（逻辑在 event.js、文案在 npc-metro.js / evpool-*.js，入口 ui-metro.js），
   人类据点小镇里有名字的人（逻辑在 outpost.js，入口 ui-outpost.js）。
   这里只负责"把要说的话排成一串、一句一句演"：画法和剧情屋同一套（dlg-view.js 的 D.DlgView.draw）——
   人说的话（引号里的）冒在他头顶，叙述（引号外的）是上方居中的旁白，选项条在下面。
   D.TalkB.run(S, sp, steps, opt) 返回一个和 D.Dlg.run 一样能交给 DlgView 画的 R；挂在 S.talk.R 上。
     sp：{ name, col, obj（脚底 x、y、f）, head 头顶离脚底多高 }
     steps：{ k:'say', t } 这个人说 / { k:'narr', t } 旁白 / { k:'fn', f } 演到这儿时执行 /
            { k:'choice', opts:[{ t, ok, cost }], pick(i) }：pick 返回接着演的 steps（数组）；false 选不了；null 已经交出去了（关掉、开面板）
     opt.onDone()：演完了。
   输入（D.TalkB.step，包在 D.stepStation 外面）：空格 / F / Enter / 左键 打完或下一句，按住快进；1–4 或点选项。
   Esc、走远了：main.js 原来那段（D.talkClose）照旧。人在说话时不能走、不能开枪，也是 main.js 原来那段。
   画（D.TalkB.draw）：draw.js 在站内飘字、闲话之后调。说话时站内界面收起来（#ui 加 talking，样式在 index.html）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TB = D.TalkB = {};
  const KEY = '§npc'; // 说话人在 D.Dlg.CAST 里临时占的位置（气泡的颜色、头顶的位置都按它找）
  const VOICES = ['lin', 'lu', 'ahsun'];
  const tr = s => (D.tr ? D.tr(s) : s);
  const SET = () => D.settings || {};

  // ── 一段话拆成几句：引号里的是这个人说的，引号外的是旁白。先翻译整段再拆（词典按整段认）
  const QUOTE = /["“”]([^"“”]*)["“”]/g;
  const tidy = s => { s = s.replace(/^[\s，。、：,.:;；—]+/, '').replace(/[\s，、：,:;；—]+$/, ''); return !s || /[。！？…!?.)）]$/.test(s) ? s : s + (/[一-鿿]/.test(s) ? '。' : '.'); }; // 从逗号处断开的旁白补个句号
  TB.split = function (text, narrOnly) {
    const s = tr(text || '').trim(); if (!s) return [];
    if (narrOnly) return [{ k: 'narr', t: s }];
    const out = [], n = (s.match(/["“”]/g) || []).length;
    if (n < 2 || n % 2) return [{ k: /^["“]/.test(s) ? 'say' : 'narr', t: s.replace(/^["“]|["”]$/g, '') }];
    let last = 0, m; QUOTE.lastIndex = 0;
    while ((m = QUOTE.exec(s))) {
      const pre = tidy(s.slice(last, m.index)); if (pre) out.push({ k: 'narr', t: pre });
      const q = m[1].trim(); if (q) out.push({ k: 'say', t: q });
      last = QUOTE.lastIndex;
    }
    const post = tidy(s.slice(last)); if (post) out.push({ k: 'narr', t: post });
    return out;
  };

  // ── 选项的字：标题 + 小字（太长就去掉小字，再长就截断）；DlgView 的选项框最宽 260
  let mctx = null;
  const width = s => { if (!mctx) { if (typeof document === 'undefined') return s.length * 7; mctx = document.createElement('canvas').getContext('2d'); } mctx.font = D.PXF; return mctx.measureText(s).width; };
  TB.label = function (t, sub) {
    const MAX = 238, a = tr(t), full = sub ? a + ' · ' + tr(sub) : a;
    if (width(full) <= MAX) return full;
    if (width(a) <= MAX) return a;
    let s = a; while (s.length > 2 && width(s + '…') > MAX) s = s.slice(0, -1);
    return s + '…';
  };

  // ── 一串话：和 D.Dlg.run 一样的 R（update / press / hold / pick / view）
  TB.run = function (S, sp, steps, opt) {
    opt = opt || {};
    const Dl = D.Dlg, hash = [...(sp.name || '')].reduce((a, c) => a + c.charCodeAt(0), 0);
    Dl.CAST[KEY] = { id: 'npc', col: sp.col || '#d8c8a8', cps: 24, voice: VOICES[hash % VOICES.length] };
    const R = { done: false, log: [], holding: false, sp };
    let q = steps.slice(), kind = 'done', who = null, raw = '', gl = [], shown = 0, acc = 0, delay = 0, cur = null;
    const cpsMul = () => +SET().typeSpeed || 1;
    function next() {
      for (let guard = 0; guard < 500; guard++) {
        if (!q.length) { kind = 'done'; who = null; cur = null; R.done = true; if (opt.onDone) opt.onDone(R); return; }
        const s = q.shift();
        if (s.k === 'fn') { s.f(); continue; }
        if (s.k === 'say' || s.k === 'narr') {
          kind = s.k; who = s.k === 'narr' ? '旁白' : KEY; raw = s.t; gl = Dl.glyphs(raw); shown = 0; acc = 0; delay = gl.length ? gl[0].pre : 0; cur = null; return;
        }
        if (s.k === 'choice') { kind = 'choice'; who = null; cur = s; return; }
      }
    }
    const finishLine = () => { R.log.push({ who, t: Dl.plain(raw) }); next(); };
    R.update = function (dt) {
      if (R.done || (kind !== 'say' && kind !== 'narr')) return;
      if (R.holding) dt *= 4;
      if (cpsMul() >= 1000) { shown = gl.length; return; }
      acc += dt;
      while (shown < gl.length) {
        const g = gl[shown], need = delay + (g.fast ? 0 : 1 / (((Dl.CAST[who] || {}).cps || 24) * cpsMul() * (g.mul || 1)));
        if (acc < need) break;
        acc -= need; shown++; delay = g.wait + (gl[shown] ? gl[shown].pre : 0);
        if (D.DlgView && !Dl.PAUSE[g.ch] && g.ch !== ' ') D.DlgView.typeSound(who, g);
      }
    };
    R.press = function () { if (kind === 'say' || kind === 'narr') { if (shown < gl.length) { shown = gl.length; delay = 0; } else finishLine(); } };
    R.hold = on => { R.holding = !!on; };
    R.pick = function (i) {
      if (kind !== 'choice' || !cur) return false;
      const o = cur.opts[i]; if (!o || !o.ok) return false;
      const more = cur.pick(i);
      if (more === false) return false;
      R.log.push({ who: '你', t: o.t, act: true });
      if (more === null) { kind = 'gone'; cur = null; return true; } // 交出去了：这一串不再演，也不算演完
      q = more.slice(); next(); return true;
    };
    R.skipLine = () => { if (kind === 'say' || kind === 'narr') { shown = gl.length; finishLine(); } };
    R.view = () => ({ kind: kind === 'gone' ? 'done' : kind, who, text: Dl.plain(raw), glyphs: gl, shown, choices: kind === 'choice' ? cur.opts.map(o => ({ t: o.t, ok: !!o.ok, act: false, cost: o.cost || 0 })) : [], timeLeft: 0, timeMax: 0, cut: null, cast: Dl.CAST[who] || null });
    next();
    return R;
  };

  // ── 每帧的输入（包在 D.stepStation 外面：main.js 已经把走路、开枪、交互清掉了）
  TB.step = function (S, dt) {
    const T = S.talk, R = T && T.R; if (!R || R.done) return;
    const I = D.Input, V = D.DlgView; if (!I) return;
    let clicked = null;
    if (I.mclick && V) for (const h of V.hits) if (I.mx >= h.x && I.mx < h.x + h.w && I.my >= h.y && I.my < h.y + h.h) clicked = h;
    const v = R.view(), sfx = k => D.Sfx && D.Sfx.play(k);
    if (v.kind === 'choice') {
      for (let i = 0; i < Math.min(9, v.choices.length); i++) if (I.hit('Digit' + (i + 1)) || I.hit('Numpad' + (i + 1))) { sfx(R.pick(i) ? 'click' : 'nope'); return; }
      if (clicked && clicked.pick != null) { sfx(R.pick(clicked.pick) ? 'click' : 'nope'); return; }
    } else if (I.hit('Space') || I.hit(D.key ? D.key('interact') : 'KeyF') || I.hit('KeyF') || I.hit('Enter') || (I.mclick && !clicked)) R.press();
    const k = I.keys || {}, held = k.Space || k.KeyF || k.Enter || I.mdown;
    T.heldT = held ? (T.heldT || 0) + dt : 0; R.hold(T.heldT > 0.4);
    R.update(dt);
  };

  // ── 画：头顶那一点换成屏幕坐标交给 DlgView
  TB.draw = function (ctx, S, cx, cy) {
    const T = S.talk, R = T && T.R;
    if (!R || R.done || !D.DlgView || T.rt) return; // 屋里的剧情自己画（roomtalk.js，镜头推近以后）
    const Z = D.Z, W = ctx.canvas.width, H = ctx.canvas.height, sp = R.sp, o = sp.obj, p = S.player;
    const actors = { op: { x: (p.x - cx) * Z, y: (p.y - 30 - cy) * Z } };
    if (o) actors.npc = { x: Math.round((o.x - cx) * Z), y: Math.round((o.y - (sp.head || 26) - cy) * Z) };
    D.DlgView.calm = SET().reduceFlash === true;
    D.DlgView.draw(ctx, R, actors, S.t);
    // 右下角一行操作说明
    const v = R.view();
    ctx.save(); ctx.font = D.PXF; ctx.textBaseline = 'top'; ctx.textAlign = 'right'; ctx.globalAlpha = 1; ctx.fillStyle = '#6a6478';
    ctx.fillText(tr(v.kind === 'choice' ? '按数字键或点选项 · Esc 离开' : '空格 / F 下一句 · Esc 离开'), W - 10, H - 14);
    ctx.restore();
  };

  // ── 挂钩：输入在站里每帧之前跑；说话时收起提示和站内界面，小镇里那个人自己的闲话气泡也收掉
  const ss0 = D.stepStation;
  D.stepStation = function (S, dt, inp) {
    if (S && S.talk && S.talk.R) TB.step(S, dt);
    const r = ss0.apply(this, arguments);
    if (S) {
      const on = !!(S.talk && S.talk.R && !S.talk.R.done);
      if (on) { S.prompt = null; if (S.town && S.town.chats) S.town.chats = S.town.chats.filter(c => c.p !== S.talk.R.sp.obj); }
      if (!S.talk && D.Dlg && D.Dlg.CAST[KEY]) delete D.Dlg.CAST[KEY];
      if (typeof document !== 'undefined') { const ui = document.getElementById('ui'); if (ui && ui.classList.contains('talking') !== on) ui.classList.toggle('talking', on); }
    }
    return r;
  };
  // 说话时不画子弹条（画在画布左下，会和选项挤在一起）
  const ah0 = D.drawAmmoHud;
  if (ah0) D.drawAmmoHud = function (ctx, S) { if (S && S.talk && S.talk.R && !S.talk.R.done) return; return ah0.apply(this, arguments); };
})(D);
