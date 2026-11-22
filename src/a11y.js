/* Underdog · 小样二：全屏、色弱模式、游戏速度（M7）。设置项在 ui-menu.js 的设置页，默认值在 save.js。
   色弱模式：六档品质换成 Okabe–Ito 色板（灰、天蓝、深蓝、紫红、黄、朱红）；脚本里用的 D.QUALITY 和样式表里的 --qc 一起换。
   游戏速度：main.js 的 step 里，站里的时间乘 D.settings.speed。
   设计：design/features/platform/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const BASE = D.QUALITY.map(q => q.col), CB = ['#c8cbd6', '#56b4e9', '#2f6fd0', '#cc79a7', '#f0e442', '#d55e00'];
  function applyCB(on) {
    D.QUALITY.forEach((q, i) => { q.col = (on ? CB : BASE)[i]; });
    if (document.body) document.body.classList.toggle('cb', !!on);
    if (D.UI && D.UI._ && D.UI._.iconURL) for (const k in D.UI._.iconURL) if (/^(q|cell|gi)/.test(k)) delete D.UI._.iconURL[k];
  }
  D.CB_COLORS = CB;
  const ap0 = D.applySettings;
  D.applySettings = function () { const r = ap0 ? ap0.apply(this, arguments) : undefined; applyCB(D.settings && D.settings.cb); return r; };
  // 站里的游戏速度（100% / 85% / 70%）
  D.gameSpeed = () => { const s = D.settings && +D.settings.speed; return s > 0.3 && s <= 1 ? s : 1; };
  // 全屏：浏览器全屏开关
  D.fullscreen = {
    on: () => !!(document.fullscreenElement || document.webkitFullscreenElement),
    toggle() {
      try {
        if (this.on()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen).call(el); }
      } catch (e) { if (D.UI && D.UI.toast) D.UI.toast('这个浏览器不让全屏'); }
    },
  };
  addEventListener('fullscreenchange', () => { if (D.onResize) D.onResize(); });
})(D);
