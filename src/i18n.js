/* Underdog：语言层（英文版）。
   老代码一律照旧写中文；切到英文时在"出口"上翻译：
     - 界面（DOM）：innerHTML / textContent / innerText / insertAdjacentHTML / setAttribute / createTextNode 设进去的文字当场翻，
       另外挂一个 MutationObserver 兜底（dataset、append 之类）。
     - 画布：fillText / strokeText / measureText 的字先翻再画（量宽也按英文量）。
   词典在 i18n-en-*.js：D.I18N.add({ 中文: 英文 })。中文里带 {0} {1} 的是句式，按位置把中间的东西填进英文（填进去的东西再翻一遍）。
   查法：整句 → 句式 → 按"·""｜"切开逐段查 → 逐字最长匹配（名字嵌在句子里也能换掉）；中文标点换成英文标点。
   没翻到的字原样留着（一键测试"英文"会把残留的中文列出来）。
   语言存在设置里（D.settings.lang），也抄一份到 localStorage 免得开页面先闪一下中文；网址 ?lang=en 优先。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const I = D.I18N = { lang: 'zh' };
  const IDEO = /[㐀-鿿]/, HAS = /[　-〿㐀-鿿＀-￯‘-”…]/;
  const EX = new Map(), PATS = [], TPL = new Map(); let IDX = null, cache = new Map(); // TPL：带 {n} 的原句 → 英文（整个元素按句式翻时查）
  let L = 'zh';

  // ── 词典
  const STRIP_ZH = /^[\s·｜|，,。.：:；;（）()【】\[\]、—\-+×/▶…]+|[\s·｜|，,。.：:；;（）()【】\[\]、—\-+×/▶…]+$/g;
  const STRIP_HEAD = /^[\s·｜，。：；、（）【】]+/, STRIP_TAIL = /[\s·｜，。：；、（）【】]+$/;
  const STRIP_EN =/^[\s·|,.:;()\[\]\-+×/▶]+|[\s·|,.:;()\[\]\-+×/▶]+$/g;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile(zh, en) {
    const parts = zh.split(/\{(\d+)\}/), order = [], need = []; let re = '^';
    for (let j = 0; j < parts.length; j++) {
      if (j % 2) { re += '([\\s\\S]*?)'; order.push(+parts[j]); continue; }
      re += escRe(parts[j]).replace(/\s+/g, '\\s+'); const m = parts[j].match(/[㐀-鿿]+/g); if (m) need.push(...m);
    }
    return { zh, re: new RegExp(re + '$'), en, order, need, w: parts.filter((_, j) => !(j % 2)).join('').length };
  }
  const ph = s => (s.match(/\{\d+\}/g) || []).sort().join();
  function put(zh, en, sub) {
    if (typeof en !== 'string') return;
    zh = zh.trim();
    if (sub && (EX.has(zh) || !IDEO.test(zh))) return; // 拆出来的小段不盖掉正式词条
    if (/\{\d+\}/.test(zh) && !sub) TPL.set(zh.replace(/\s+/g, ' '), en);
    if (/\{\d+\}/.test(zh)) { if (HAS.test(zh.replace(/\{\d+\}/g, '')) && !(sub && PATS.some(p => p.zh === zh))) PATS.push(compile(zh, en)); }
    else {
      EX.set(zh, en);
      const c = zh.replace(STRIP_ZH, '');
      if (c !== zh && IDEO.test(c) && !EX.has(c)) EX.set(c, en.replace(STRIP_EN, ''));
    }
    if (sub) return;
    // 整句里按"｜"分的几段、"名字：说明"的两半，界面上常常分开显示（拼在别的句子后面、或者放在两个元素里），也各记一条
    const a = zh.split('｜'), b = en.split(/\s*\|\s*/);
    if (a.length > 1 && a.length === b.length && a.every((x, i) => ph(x) === ph(b[i]))) a.forEach((x, i) => put(x, b[i], true));
    const i = zh.indexOf('：'), j = en.indexOf(': ');
    if (i > 0 && j > 0 && !zh.includes('｜')) { const z1 = zh.slice(0, i), z2 = zh.slice(i + 1), e1 = en.slice(0, j), e2 = en.slice(j + 2); if (ph(z1) === ph(e1) && ph(z2) === ph(e2)) { put(z1, e1, true); put(z2, e2, true); } }
  }
  I.add = obj => { for (const k in obj) put(k, obj[k]); IDX = null; cache = new Map(); };
  I.has = zh => EX.has(zh);
  // 只在画布上用的写法（线路图上 33 像素宽的绿牌子放不下 "Extract"，写 EXIT）
  const CANVAS = new Map();
  I.addCanvas = obj => { for (const k in obj) CANVAS.set(k, obj[k]); };
  I.size = () => EX.size + PATS.length;

  // ── 翻译
  const PUNCT = { '，': ', ', '。': '. ', '、': ', ', '：': ': ', '；': '; ', '？': '? ', '！': '! ', '（': ' (', '）': ') ', '【': ' [', '】': '] ', '「': '"', '」': '"', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '～': '~', '｜': ' | ', '《': '"', '》': '"', '　': ' ', '％': '%', '＋': '+', '／': '/', '＝': '=', '－': '-', '〔': '[', '〕': ']' };
  const tidy = s => s.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?)\]%])/g, '$1').replace(/([(\[]) +/g, '$1').replace(/(^|[^.])\.\.(?!\.)/g, '$1.').replace(/([,;:])\1+/g, '$1').replace(/\.,/g, '.').replace(/,\./g, '.').trim();
  const WORD_END = /[A-Za-z0-9%)\]'"]$/, WORD_START = /^[A-Za-z0-9(\['"]/;
  function index() {
    IDX = new Map();
    // 单字只认整句（"空""上"），不拿来拆别的句子；以字母数字开头的（"8 伤害，…"）只在词的边界上认
    for (const k of EX.keys()) { if (k.length < 2) continue; const c = k[0]; let a = IDX.get(c); if (!a) IDX.set(c, a = []); a.push(k); }
    for (const a of IDX.values()) a.sort((x, y) => y.length - x.length);
    PATS.sort((a, b) => b.w - a.w);
  }
  // 句式：填进去的东西都翻得干净才算套对了（"{0}用"别把"WK-01 · 通用"吞掉）；都不干净就先记着，留给 tr 和逐段翻的结果比
  let dirty = null;
  function pattern(s) {
    for (const p of PATS) {
      let ok = true; for (const n of p.need) if (!s.includes(n)) { ok = false; break; }
      if (!ok) continue;
      const m = p.re.exec(s); if (!m) continue;
      const val = {}; let clean = true;
      p.order.forEach((num, k) => { const v = val[num] = tr(m[k + 1] || ''); if (IDEO.test(v)) clean = false; });
      const out = tidy(p.en.replace(/\{(\d+)\}/g, (_, n) => val[n] == null ? '' : val[n]));
      if (clean) return out;
      if (!dirty) dirty = out;
    }
    return null;
  }
  const left = s => (s.match(/[㐀-鿿]/g) || []).length;
  function whole(s) { const e = EX.get(s); return e != null ? e : pattern(s); }
  function greedy(s) { // 逐字最长匹配
    let out = '', rep = false;
    const push = (w, isRep) => { if (!w) return; if ((isRep || rep) && WORD_END.test(out) && WORD_START.test(w)) out += ' '; out += w; rep = isRep; };
    for (let i = 0; i < s.length;) {
      const c = s[i], cands = IDX.get(c); let hit = null;
      if (cands && !(/[A-Za-z0-9]/.test(c) && i > 0 && /[A-Za-z0-9.]/.test(s[i - 1]))) for (const k of cands) if (s.startsWith(k, i) && !(/[A-Za-z0-9]$/.test(k) && /[A-Za-z0-9]/.test(s[i + k.length] || ''))) { hit = k; break; }
      if (hit) { push(EX.get(hit), true); i += hit.length; continue; }
      const p = PUNCT[c]; push(p != null ? p : c, p != null); i++;
    }
    return tidy(out);
  }
  // 按"·""｜"、换行切开；连着的几段能整句认出来就整句翻（提示后面常常还拼着一段"｜卖价…"）
  function mixed(s) {
    const parts = s.split(/(\s*[·｜\n、，；]\s*)/);
    if (parts.length < 2) return greedy(s);
    const sep = p => p.includes('\n') ? '\n' : p.includes('｜') ? ' | ' : p.includes('·') ? ' · ' : p.includes('；') ? '; ' : ', ';
    let out = '';
    for (let i = 0; i < parts.length; i += 2) {
      let hit = null, j;
      for (j = parts.length - 1; j > i; j -= 2) { hit = whole(parts.slice(i, j + 1).join('')); if (hit != null) break; }
      if (hit == null) { j = i; hit = parts[i] ? (whole(parts[i]) ?? greedy(parts[i])) : ''; }
      out += hit; if (j + 1 < parts.length) out += sep(parts[j + 1]); i = j;
    }
    return out;
  }
  function tr(s) {
    if (L !== 'en' || typeof s !== 'string' || !HAS.test(s)) return s;
    let r = cache.get(s); if (r !== undefined) return r;
    if (!IDX) index();
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    // 先认整句，再认去掉头尾标点的整句（"：3 秒没挨打…"），然后才是句式（句式开头的 {0} 什么都吞）
    let hit = EX.get(core);
    if (hit == null) { const a = core.match(STRIP_HEAD), b = core.match(STRIP_TAIL), c = core.slice(a ? a[0].length : 0, core.length - (b ? b[0].length : 0)); if (c && c !== core) { const e = EX.get(c); if (e != null) hit = tidy(greedy(a ? a[0] : '') + ' ' + e + ' ' + greedy(b ? b[0] : '')); } }
    if (hit == null) { const d0 = dirty; dirty = null; hit = pattern(core); const d = dirty; dirty = d0; if (hit == null) { const g = greedy(core); hit = left(g) ? mixed(core) : g; if (left(g) < left(hit)) hit = g; if (d && left(d) < left(hit)) hit = d; } }
    r = m[1] + hit + m[3];
    if (cache.size > 20000) cache = new Map();
    cache.set(s, r); return r;
  }
  D.tr = I.tr = tr;
  I.peek = s => { const l = L; L = 'en'; try { return tr(s); } finally { L = l; } }; // 不管现在是什么语言，看英文是什么

  // ── 界面：设进去的字当场翻
  const TA = ['title', 'data-tip', 'placeholder', 'aria-label', 'alt'];
  let walk = () => {}, watch = () => {};
  if (typeof Element !== 'undefined' && typeof document !== 'undefined') {
  const skip = el => el.hasAttribute && el.hasAttribute('data-notr');
  const NO_TEXT = { SCRIPT: 1, STYLE: 1 };
  const P = Element.prototype, NP = Node.prototype;
  const dIH = Object.getOwnPropertyDescriptor(P, 'innerHTML'), dTC = Object.getOwnPropertyDescriptor(NP, 'textContent');
  const dIT = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText'), dNV = Object.getOwnPropertyDescriptor(NP, 'nodeValue');
  const dDA = Object.getOwnPropertyDescriptor(CharacterData.prototype, 'data');
  const setAttr0 = P.setAttribute, iah0 = P.insertAdjacentHTML, ctn0 = Document.prototype.createTextNode;
  function attrs(el) { for (const a of TA) { const v = el.getAttribute(a); if (v && HAS.test(v)) { const t = tr(v); if (t !== v) setAttr0.call(el, a, t); } } }
  // 一个元素里"字 + <b>名字</b> + 字"（"从 <b>南栈</b> 出发"）：两边的字单独翻不通，整个元素按句式翻，<b> 原样留着放进英文的位置
  const INL = { B: 1, EM: 1, I: 1, SPAN: 1, STRONG: 1, SMALL: 1 };
  function elTpl(el) {
    if (skip(el) || inSkip(el)) return;
    let zh = '', zhText = false; const els = [];
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const v = dNV.get.call(n); zh += v; if (IDEO.test(v)) zhText = true; }
      else if (n.nodeType === 1 && INL[n.tagName] && !n.firstElementChild) { zh += '{' + els.length + '}'; els.push(n); }
      else return;
    }
    if (!zhText || !els.length) return;
    const en = TPL.get(zh.replace(/\s+/g, ' ').trim()); if (en == null) return;
    const out = [];
    for (const p of en.split(/(\{\d+\})/)) { const m = /^\{(\d+)\}$/.exec(p); if (m) { if (els[+m[1]]) out.push(els[+m[1]]); } else if (p) out.push(ctn0.call(document, p)); }
    el.replaceChildren(...out);
  }
  function inSkip(n) { const e = n.nodeType === 1 ? n : n.parentElement; return !!(e && e.closest && e.closest('[data-notr]')); }
  walk = function (root) {
    if (L !== 'en' || !root) return;
    if (root.nodeType === 3) { if (!inSkip(root)) { const v = dNV.get.call(root), t = tr(v); if (t !== v) dNV.set.call(root, t); } return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (NO_TEXT[root.tagName] || inSkip(root)) return; attrs(root); }
    if (TPL.size) { const ps = new Set(); if (root.nodeType === 1) ps.add(root); for (const e of root.querySelectorAll('b,em,i,span,strong,small')) if (e.parentElement) ps.add(e.parentElement); for (const e of ps) elTpl(e); }
    const tw =document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeType === 1 ? (skip(n) || NO_TEXT[n.tagName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) : NodeFilter.FILTER_ACCEPT });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (n.nodeType === 1) { if (n.attributes.length) attrs(n); continue; }
      const v = dNV.get.call(n); if (!HAS.test(v)) continue; const t = tr(v); if (t !== v) dNV.set.call(n, t);
    }
  };
  const def = (proto, name, d, set) => Object.defineProperty(proto, name, { configurable: true, enumerable: d.enumerable, get: d.get, set });
  def(P, 'innerHTML', dIH, function (v) { dIH.set.call(this, v); if (L === 'en') walk(this); });
  def(NP, 'textContent', dTC, function (v) { if (L === 'en' && typeof v === 'string' && !NO_TEXT[this.tagName] && !inSkip(this)) v = tr(v); dTC.set.call(this, v); });
  def(HTMLElement.prototype, 'innerText', dIT, function (v) { if (L === 'en' && typeof v === 'string' && !inSkip(this)) v = tr(v); dIT.set.call(this, v); });
  def(NP, 'nodeValue', dNV, function (v) { if (L === 'en' && typeof v === 'string' && this.nodeType === 3 && !inSkip(this)) v = tr(v); dNV.set.call(this, v); });
  def(CharacterData.prototype, 'data', dDA, function (v) { if (L === 'en' && typeof v === 'string' && this.nodeType === 3 && !inSkip(this)) v = tr(v); dDA.set.call(this, v); });
  P.setAttribute = function (k, v) { if (L === 'en' && typeof v === 'string' && TA.includes(k) && !inSkip(this)) v = tr(v); return setAttr0.call(this, k, v); };
  P.insertAdjacentHTML = function (where, html) { const r = iah0.call(this, where, html); if (L === 'en') walk(/^(beforebegin|afterend)$/i.test(where) ? this.parentNode : this); return r; };
  Document.prototype.createTextNode = function (s) { return ctn0.call(this, L === 'en' ? tr(String(s)) : s); };
  // 兜底：别的途径改的字（dataset.tip = …、append('…')）
  const mo = new MutationObserver(list => {
    if (L !== 'en') return;
    for (const m of list) {
      if (m.type === 'childList') { for (const n of m.addedNodes) if (n.nodeType === 3 ? HAS.test(dNV.get.call(n)) : n.nodeType === 1) walk(n); }
      else if (m.type === 'characterData') walk(m.target);
      else if (m.type === 'attributes' && m.target.nodeType === 1 && !inSkip(m.target)) { const v = m.target.getAttribute(m.attributeName); if (v && HAS.test(v)) { const t = tr(v); if (t !== v) setAttr0.call(m.target, m.attributeName, t); } }
    }
  });
  let watching = false;
  watch = function (on) {
    if (on && !watching && document.documentElement) { mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TA }); watching = true; }
    if (!on && watching) { mo.disconnect(); watching = false; }
  };

  // ── 画布
  for (const C of [globalThis.CanvasRenderingContext2D, globalThis.OffscreenCanvasRenderingContext2D]) {
    if (!C) continue;
    for (const f of ['fillText', 'strokeText', 'measureText']) { const o = C.prototype[f]; if (o) C.prototype[f] = function (t, ...a) { return o.call(this, L === 'en' && typeof t === 'string' ? (CANVAS.get(t) ?? tr(t)) : t, ...a); }; }
  }

  }

  // ── 切换语言（界面重画在 i18n-hooks.js 里）
  I.walk = r => walk(r);
  const listeners = [];
  I.onChange = f => listeners.push(f);
  I.set = function (lang, quiet) {
    lang = lang === 'en' ? 'en' : 'zh';
    const was = L; L = I.lang = lang; cache = new Map();
    if (typeof document !== 'undefined' && document.documentElement) { document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'; document.documentElement.classList.toggle('lang-en', lang === 'en'); }
    watch(lang === 'en');
    try { localStorage.setItem('underdog.lang', lang); } catch (e) { /* 隐私模式之类：没关系，设置里还有一份 */ }
    if (was !== lang && !quiet) for (const f of listeners) try { f(lang, was); } catch (e) { console.error(e); }
  };
  I.urlLang = (() => { try { const q = new URLSearchParams(location.search).get('lang'); return q === 'en' || q === 'zh' ? q : null; } catch (e) { return null; } })();
  let first = I.urlLang; if (!first) try { first = localStorage.getItem('underdog.lang'); } catch (e) { /* 读不到就用中文 */ }
  I.set(first === 'en' ? 'en' : 'zh', true);
})(D);
