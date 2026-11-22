/* Underdog：护甲耐久显示清楚（用户 2026-11-15："护甲清楚的显示耐久"）
   以前：HUD 只在血条底边描一道细蓝线（按机身耐久的比例算，看不出护甲还剩几成），旁边一行很小的"4 40/40"；
   背包、仓库、货箱格子里的护甲完全看不出耐久，碎了的和新的长得一样；装备槽只有 2 像素的细条。
   现在耐久一律按"这件护甲自己的上限"算几成，四个状态一个颜色：
     好（五成以上）蓝、一般（两成半到五成）黄、快碎了（两成半以下）红色一闪一闪、碎了 灰（图变灰、写"碎了"）。
   - HUD：血条下面、冲刺条右边单独一条护甲条（盾牌图标 + 64 像素的条 + "剩/上限" + 等级），四等分刻度；
     挨一下时掉下去的那段先白着、过一会儿再缩回去，看得出这一下掉了多少；碎了条里是灰色斜纹、数字变灰。
     血条底边只留护盾（青色），不再画护甲那道线。
   - 格子（背包、仓库、货箱、子弹袋旁边、地上"附近"、交易行 / 仓库弹出的交易行）：每件护甲底下一条耐久条、右下角"剩/上限"；
     碎了的整格变灰、中间写"碎了"。走 U._.cmb（gear.js 定的格子角标挂钩），所以哪里画格子哪里就有。
   - 局内背包的护甲槽：条加粗、带颜色、右上角写数字（ui-bag.js 调 D.armorDurHTML）。
   - 仓库页的护甲槽：图标底下同样一条、旁边"X 级 剩/上限"按颜色写（包 U.gearSlotsHTML，不改 armor.js）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const A = D.Armor; if (!A) return;
  const P = D.PAL, K = D.K;
  const COL = { ok: '#5a8dff', mid: '#ffc23d', low: '#ff3d4a', brk: '#5c6178' };
  // 状态：按这件护甲自己的上限算
  const state = a => !a || a.dur <= 0 ? 'brk' : a.dur / a.max < 0.25 ? 'low' : a.dur / a.max < 0.5 ? 'mid' : 'ok';
  A.durState = state; A.DUR_COL = COL;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ── 一条耐久条的 HTML（格子、装备槽、仓库护甲槽共用）
  D.armorDurHTML = function (it, cls) {
    const a = it && it.kind === 'armor' ? it : null; if (!a) return '';
    const st = state(a), pct = Math.max(0, Math.min(100, Math.round(a.dur / a.max * 100)));
    return `<i class="adur s-${st}${cls ? ' ' + cls : ''}"><i style="width:${pct}%"></i></i><b class="adn s-${st}">${a.dur > 0 ? a.dur + '/' + a.max : esc('碎了')}</b>`;
  };

  // ── 格子里的护甲（gear.js 的 U._.cmb：格子、单格展示、附近列表都走它）
  const X = D.UI && D.UI._;
  if (X) {
    const c0 = X.cmb;
    X.cmb = function (id) {
      const r = c0 ? c0.apply(this, arguments) : { cls: '', html: '' };
      if (!A.is(id)) return r;
      const it = D.itemInfo(id), st = state(it);
      return { cls: (r.cls || '') + ' ardur' + (st === 'brk' ? ' arbrk' : ''), html: (r.html || '') + D.armorDurHTML(it) };
    };
  }

  // ── 仓库页的护甲槽（armor.js 的 U.gearSlotsHTML）：图标底下一条，旁边的字按颜色
  const U = D.UI;
  if (U && U.gearSlotsHTML) {
    const g0 = U.gearSlotsHTML;
    U.gearSlotsHTML = function (pf) {
      let html = g0.apply(this, arguments);
      const id = pf && pf.load && pf.load.armor, it = id && D.itemInfo(id); if (!it || it.kind !== 'armor') return html;
      const st = state(it);
      html = html.replace(/(<div class="gslot ar-slot[^"]*)("[^>]*>[\s\S]*?<img [^>]*>)/, (m, a, b) => a + ' ardur' + (st === 'brk' ? ' arbrk' : '') + b + D.armorDurHTML(it));
      html = html.replace(/<span class="ar-info([^"]*)">([^<]*)<\/span>/, (m, c, t) => `<span class="ar-info${c} s-${st}">${t}</span>`);
      return html;
    };
  }

  // ── HUD：血条底边只画护盾；冲刺条右边单独一条护甲条
  const ghost = { key: '', dur: 0, from: 0, t: -9 };
  const shown = t => { const e = t - ghost.t, k = e < 0.35 ? 1 : Math.max(0, 1 - (e - 0.35) / 0.45); return ghost.dur + (ghost.from - ghost.dur) * k; }; // 按时间算，不按帧
  D.drawShieldBar = function (ctx, S, x, y, w) {
    const p = S.player, a = A.worn(S.raid), t = S.t || 0;
    if (p.shield > 0) { const sw = Math.min(w, Math.round(w * p.shield / p.maxHp)); if (sw > 0) { ctx.fillStyle = P.c; ctx.fillRect(x, y + 8, sw, 3); ctx.fillStyle = '#d0fbff'; ctx.fillRect(x, y + 8, sw, 1); } }
    if (!a) { ghost.key = ''; return; }
    // 掉下去的那段：先白着 0.35 秒，再用 0.45 秒缩回去；连着挨打就从现在显示的地方接着算
    const key = a.lv + ':' + a.max;
    if (ghost.key !== key || a.dur > ghost.dur || t < ghost.t) { ghost.key = key; ghost.dur = ghost.from = a.dur; ghost.t = -9; }
    else if (a.dur < ghost.dur) { ghost.from = Math.max(shown(t), ghost.dur); ghost.dur = a.dur; ghost.t = t; }
    const gshow = shown(t);
    const st = state(a), col = COL[st], blink = st === 'low' && (t * 4 | 0) % 2, hit = t - ghost.t < 0.12;
    const ix = x + 48, iy = y + 15, bx = x + 59, by = y + 17, bw = 64, bh = 5;
    // 盾牌图标（碎了：灰 + 一道裂缝）
    ctx.fillStyle = P.k; ctx.fillRect(ix - 1, iy - 1, 9, 10);
    ctx.fillStyle = blink ? P.r : col; ctx.fillRect(ix, iy, 7, 8); ctx.fillStyle = P.k; ctx.fillRect(ix + 2, iy, 3, 2);
    ctx.fillStyle = st === 'brk' ? '#8a8fa6' : '#e6eeff'; ctx.fillRect(ix + 2, iy + 3, 3, 3);
    if (st === 'brk') { ctx.fillStyle = P.k; ctx.fillRect(ix + 3, iy + 2, 1, 2); ctx.fillRect(ix + 2, iy + 4, 1, 2); ctx.fillRect(ix + 3, iy + 6, 1, 2); }
    // 条：黑框、暗底、填色、掉下去的白段、四等分刻度
    ctx.fillStyle = hit ? '#ffffff' : P.k; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#141826'; ctx.fillRect(bx, by, bw, bh);
    const fw = Math.round(bw * a.dur / a.max), gw = Math.round(bw * gshow / a.max);
    if (gw > fw) { ctx.fillStyle = t - ghost.t < 0.12 ? '#ffffff' : '#c9d4f0'; ctx.fillRect(bx + fw, by, gw - fw, bh); }
    if (fw > 0) { ctx.fillStyle = blink ? '#7a1d26' : col; ctx.fillRect(bx, by, fw, bh); ctx.fillStyle = '#ffffff60'; ctx.fillRect(bx, by, fw, 1); ctx.fillStyle = '#00000050'; ctx.fillRect(bx, by + bh - 1, fw, 1); }
    if (st === 'brk') { ctx.fillStyle = '#3a3e50'; for (let i = 0; i < bw; i += 3) ctx.fillRect(bx + i, by + (i / 3 & 1 ? 1 : 3), 2, 1); }
    for (let i = 1; i < 4; i++) { ctx.fillStyle = '#00000090'; ctx.fillRect(bx + Math.round(bw * i / 4), by, 1, bh); }
    // 数字和等级
    const num = a.dur + '/' + a.max;
    D.text(ctx, num, bx + bw + 5, by, blink ? P.r : st === 'brk' ? '#d05060' : col);
    D.text(ctx, 'LV' + a.lv, bx + bw + 5 + D.textW(num) + 5, by, '#6a7392');
  };
})(D);
