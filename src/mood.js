/* 末班之后 · 剧情灵魂：界面的氛围。
   - 舞台最上面一层扫描线和四角暗角（像在一块旧显示器后面看；设置"扫描线"能关）。
   - 信号干扰：D.Mood.glitch(毫秒) 让画面横向错位、偏色闪一下；读到线索、剧情屋开场收场、走到 E-17 站台时用。设置"减少闪烁"开着就不闪。
   开始页和主菜单（据点各页）不再显示那行红字；站里屏幕上的字在 rooms.js 里画。
   样式在 index.html 的"剧情灵魂：界面氛围"一段。设计：design/features/story-soul/design.md 第七节 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M = D.Mood = {};
  const stage = () => document.getElementById('stage');
  M.layer = function () {
    const s = stage(); if (!s || s.querySelector(':scope > .crt')) return;
    const el = document.createElement('div'); el.className = 'crt'; s.appendChild(el);
    M.apply();
  };
  M.apply = () => { const s = stage(); if (s) s.classList.toggle('no-crt', D.settings && D.settings.crt === false); };
  let gT = 0;
  M.glitch = function (ms) {
    const s = stage(); if (!s || (D.settings && D.settings.reduceFlash)) return;
    s.classList.remove('glitch'); void s.offsetWidth; s.classList.add('glitch');
    clearTimeout(gT); gT = setTimeout(() => s.classList.remove('glitch'), ms || 300);
  };
  const hook = () => {
    const U = D.UI; if (!U || U._moodHooked) return; U._moodHooked = true;
    M.layer();
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', hook); else hook();
  // 设置改了重新套一下
  const sv0 = D.Save && D.Save.saveSettings; if (sv0) D.Save.saveSettings = function () { const r = sv0.apply(this, arguments); M.apply(); return r; };
})(D);
