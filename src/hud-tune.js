/* Underdog：界面透明度和大小（用户："将所有 ui 调透明，并且允许用户调整 ui 透明度和大小"）。
   设置 → 画面里两条：界面透明度（30–100%，默认 80%）、界面大小（70–130%，默认 100%；再大右上顶栏会压到左上血量数字）。
   管站里的 HUD：右上顶栏和站牌、左下弹药字、右下技能格（DOM，index.html 里读 CSS 变量 --hud-a / --hud-s，各按自己贴的角缩放），
   左上血条、左下弹药条、右上小地图（画布，draw.js 的 hudLayer 读 D.hudTune()）。横幅、交互提示、搜刮面板这些不跟着变。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const cl = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  D.hudTune = () => { const s = D.settings || {}; return { a: cl(s.hudAlpha, 0.3, 1, 0.8), s: cl(s.hudScale, 0.7, 1.3, 1) }; };
  const ap0 = D.applySettings;
  D.applySettings = function () {
    const r = ap0 ? ap0.apply(this, arguments) : undefined;
    const ui = typeof document !== 'undefined' && document.getElementById('ui');
    if (ui) { const t = D.hudTune(); ui.style.setProperty('--hud-a', t.a); ui.style.setProperty('--hud-s', t.s); }
    return r;
  };
})(D);
