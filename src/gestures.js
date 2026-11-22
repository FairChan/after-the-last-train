/* Underdog：禁用浏览器手势（用户 2026-11-15："浏览器的手势控制请禁用"）
   玩的时候手一滑，浏览器就会后退 / 前进、缩放页面、弹右键菜单，游戏被打断甚至关掉。这里把能拦的都拦掉：
   - 触控板两指左右滑 / 触屏边缘滑动后退前进：CSS overscroll-behavior: none（index.html），再加一道历史记录"挡板"：
     页面开头多压一条记录，浏览器想后退时（手势、鼠标手势、Alt+←、鼠标侧键）停在原地，再把挡板压回去。
   - 鼠标侧键（后退 / 前进键，button 3 / 4）：直接拦掉。
   - 缩放：触控板双指捏合（Ctrl + 滚轮）、Safari 的 gesture 事件、Ctrl + = / - / 0、触屏双击和捏合（touch-action: none）。
   - 右键菜单、拖图片出残影、长按弹菜单：拦掉；输入框里照常能右键、选字。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  if (typeof window === 'undefined') return;
  const typing = t => !!(t && t.closest && t.closest('input, textarea, select, [contenteditable]'));
  const stop = e => { if (e.cancelable) e.preventDefault(); };
  const G = D.Gestures = { blocked: 0 };
  // 缩放
  addEventListener('wheel', e => { if (e.ctrlKey) { stop(e); G.blocked++; } }, { passive: false, capture: true });
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(t, e => { stop(e); G.blocked++; }, { passive: false, capture: true });
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0', 'Numpad0'].includes(e.code)) { stop(e); G.blocked++; } }, true);
  addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) { stop(e); G.blocked++; } }, { passive: false, capture: true });
  // 鼠标侧键
  for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick']) addEventListener(t, e => { if (e.button === 3 || e.button === 4) { stop(e); G.blocked++; } }, true);
  // 右键菜单、拖图片、长按
  addEventListener('contextmenu', e => { if (!typing(e.target)) { stop(e); } }, true);
  addEventListener('dragstart', e => { if (!typing(e.target) && !(e.target && e.target.draggable === true && e.target.tagName !== 'IMG')) stop(e); }, true);
  addEventListener('selectstart', e => { if (!typing(e.target)) stop(e); }, true);
  // 后退 / 前进：历史记录挡板
  try {
    const st = history.state || {};
    if (!st.ugGuard) { history.replaceState({ ...st, ugBase: 1 }, ''); history.pushState({ ugGuard: 1 }, ''); }
    addEventListener('popstate', e => {
      if (e.state && e.state.ugGuard) return;           // 前进回到挡板上：没事
      G.blocked++; history.pushState({ ugGuard: 1 }, ''); // 退到了挡板下面：压回去，停在游戏里
    });
  } catch (err) { /* 沙盒里不让改历史记录：只靠 CSS 和上面那些 */ }
})(D);
