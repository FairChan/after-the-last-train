/* Underdog：右下角的技能 / 模块 / 快捷栏格子重做（用户："显示cd秒数，然后更新刷新动画，更新右下角框的效果，重新设计，提升美术效果"）。
   ui-raid.js 照旧搭格子、更新数量和选中的种类；这里在外面包一层：
   - 每格一个颜色（G 金、Q / E 青、C 绿、V 蓝、Z 橙）：斜切角的边框、左上角键位小牌、右下角数量小牌。
   - 冷却：顺时针转一圈的暗色扇形（边上一道亮线）、中间大字秒数（不到 1 秒显示一位小数）、底边一条进度。
   - 冷却好了"刷新"：白光一闪、一圈方框往外扩、一道斜光扫过图标、键位小牌跳一下，叮一声。
   - 按下用掉：格子往下一沉、亮一下。G 好了以后边框慢慢呼吸。
   挂钩：U.station（加装饰）、U.stationUpdate（每帧算冷却）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI; if (!U) return;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const TYPE = el => el.classList.contains('skill') ? 'g' : el.dataset.k ? 'm' : el.dataset.use === 'heal' ? 'c' : el.dataset.use === 'cell' ? 'v' : 'z';
  const st0 = U.station;
  U.station = function (S) {
    const r = st0.apply(this, arguments), box = document.querySelector('#ui .mods'); if (!box) return r;
    box.classList.add('v2');
    for (const el of box.querySelectorAll('.mod')) {
      el.dataset.ty = TYPE(el);
      el.insertAdjacentHTML('beforeend', '<i class="cd-sw"></i><b class="cd-n"></b><i class="cd-bar"><i></i></i><i class="rdy"></i>');
      el._cd = { was: 0 };
    }
    return r;
  };
  // 每格现在还剩多少冷却、一共多长
  function cdOf(S, el) {
    const p = S.player, R = S.raid, ty = el.dataset.ty;
    if (ty === 'g') return [Math.max(0, p.skillCd || 0), S.SH.skill.cd * ((D.fxOf && D.fxOf(R).skill) || 1)];
    if (ty === 'm') { const id = R.load[el.dataset.k]; if (!id) return [0, 1]; return [Math.max(0, p.modCd[el.dataset.k] || 0, p.jamT || 0), D.CARDS[id].cd || 1]; }
    if (ty === 'c') return [Math.max(0, p.healCd || 0), p.healCdMax || 1];
    if (ty === 'v') return [Math.max(0, p.cellCd || 0), p.cellCdMax || 1];
    return [0, 1];
  }
  const fmt = s => s >= 1 ? String(Math.ceil(s)) : s > 0 ? s.toFixed(1).slice(1) : '';
  const su0 = U.stationUpdate;
  U.stationUpdate = function (S) {
    const r = su0.apply(this, arguments), box = document.querySelector('#ui .mods.v2'); if (!box || !S || !S.player) return r;
    const now = performance.now();
    for (const el of box.querySelectorAll('.mod')) {
      if (!el.querySelector('.cd-sw')) el.insertAdjacentHTML('beforeend', '<i class="cd-sw"></i><b class="cd-n"></b><i class="cd-bar"><i></i></i><i class="rdy"></i>'); // 换模块时格子里面会整个重画（ui-bag.js）
      const st = el._cd || (el._cd = { was: 0 }), [rem, tot] = cdOf(S, el), f = rem > 0 ? Math.min(1, rem / Math.max(rem, tot)) : 0;
      el.style.setProperty('--cd', f.toFixed(3));
      el.classList.toggle('cooling', rem > 0);
      const n = el.querySelector('.cd-n'), txt = fmt(rem); if (n && n.textContent !== txt) n.textContent = txt;
      if (rem > st.was + 0.25) { el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire'); st.fireT = now; } // 刚用掉：沉一下
      if (st.was > 0 && rem <= 0) { el.classList.remove('refresh'); void el.offsetWidth; el.classList.add('refresh'); st.refT = now; if (!D.settings || !D.settings.lite) sfx('tink'); } // 冷却好了：刷新
      if (st.refT && now - st.refT > 650) { el.classList.remove('refresh'); st.refT = 0; }
      if (st.fireT && now - st.fireT > 260) { el.classList.remove('fire'); st.fireT = 0; }
      st.was = rem;
    }
    return r;
  };
})(D);
