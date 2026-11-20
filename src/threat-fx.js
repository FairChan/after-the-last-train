/* Underdog：威胁等级的特效（用户："威胁程度添加各种各样的特效（比如威胁等级提升）"）。
   右上顶栏（ui-raid.js 的 .tophud）外面包一层，样式在 index.html 的"威胁特效"一段：
   - 每升一级：数字砸下来、进度条白闪、顶栏外扩一圈威胁色的框、下面弹一张"威胁上升 N 名字"的小牌、屏幕四边一圈威胁色暗光、叮一声警报。
   - 跨档（4 级警觉、7 级高危、10 级满）：小牌更大、带乱码抖动，屏幕四边更重，震一下屏。
   - 一直挂着的：4 级起进度条上有一道光慢慢扫过；7 级起数字跟着心跳一跳；10 级时整块偶尔串色抖一下。
   - 横幅（站名、列车进站）出来时先压着，等横幅收了再演；进站那一下等级涨了也演（按这一局记上次看到的等级）。
   - 设置里"减少闪光"：不闪屏、不震屏，常驻的动效都停，只留小牌。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI; if (!U || typeof document === 'undefined') return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const seen = new WeakMap(); // 每一局（S.raid）上次演到第几级
  const TIER = lv => lv >= 10 ? 'max' : lv >= 7 ? 'high' : lv >= 4 ? 'mid' : '';
  const calm = () => !!(D.settings && D.settings.reduceFlash);
  const top = () => document.querySelector('#ui .tophud');

  function burst(S, el, from, lv) {
    const big = TIER(lv) !== TIER(from) && TIER(lv) !== '', col = D.THREAT_COL[lv], c = calm();
    el.style.setProperty('--tc', col);
    el.classList.remove('lvup', 'lvbig'); void el.offsetWidth; el.classList.add('lvup'); if (big) el.classList.add('lvbig');
    clearTimeout(el._lvT); el._lvT = setTimeout(() => el.classList.remove('lvup', 'lvbig'), 1100);
    const bar = el.querySelector('.raidbar');
    if (bar && !c) { const r = document.createElement('i'); r.className = 'tfx-ring'; r.style.left = bar.offsetLeft + 'px'; r.style.width = bar.offsetWidth + 'px'; el.appendChild(r); setTimeout(() => r.remove(), 900); }
    for (const o of el.querySelectorAll('.tfx-pop')) o.remove();
    const pop = document.createElement('div'); pop.className = 'tfx-pop' + (big ? ' big' : '');
    pop.innerHTML = `<small>${big ? '警戒升级' : '威胁上升'}</small><b>${lv}</b><span>${esc(D.THREAT_NAME[lv] || '')}</span>`;
    el.appendChild(pop); setTimeout(() => pop.remove(), big ? 3000 : 2300);
    const ui = document.getElementById('ui');
    if (ui && !c) { const e = document.createElement('div'); e.className = 'tfx-edge' + (big ? ' big' : ''); e.style.setProperty('--tc', col); ui.appendChild(e); setTimeout(() => e.remove(), big ? 1500 : 1000); }
    if (D.Sfx) D.Sfx.play('warn');
    if (big && !c && D.K && D.K.addShake) D.K.addShake(S, 0.3);
  }

  const st0 = U.station;
  U.station = function (S) { const r = st0.apply(this, arguments); const el = top(); if (el && S && S.raid) { el.dataset.lv = ''; } return r; };
  const up0 = U.stationUpdate;
  U.stationUpdate = function (S) {
    const r = up0.apply(this, arguments), el = top(), R = S && S.raid; if (!el || !R || !D.threatLv) return r;
    const lv = D.threatLv(R);
    if (el.dataset.lv !== String(lv)) { el.dataset.lv = lv; el.dataset.tt = TIER(lv); el.style.setProperty('--tc', D.THREAT_COL[lv]); }
    el.classList.toggle('calm', calm());
    const was = seen.has(R) ? seen.get(R) : lv;
    if (lv < was || !seen.has(R)) seen.set(R, lv);
    else if (lv > was && !S.banner && !S.intro && !S.over && !S.outro) { seen.set(R, lv); burst(S, el, was, lv); }
    return r;
  };
  U._threatBurst = (S, from, lv) => { const el = top(); if (el) burst(S, el, from, lv); }; // 测试 / 调试用
})(D);
