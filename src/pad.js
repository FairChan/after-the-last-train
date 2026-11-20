/* Underdog · 小样二：手柄（M7）。浏览器自带的 Gamepad 接口，标准布局（Xbox 叫法）。
   手柄的键翻译成键盘按键事件（所以改键、快捷栏、暂停都照常用），扳机直接写鼠标状态，右摇杆把准星放在机器人前方。
   菜单里：方向键 / 左摇杆找最近的按钮（像素框标出），A 确认，B / 开始键返回。
   main.js 的 step 每帧调 D.Pad.poll(G, dt)。测试可以塞一个假手柄：D.Pad.fake = { axes: [...], buttons: [...] }。
   设计：design/features/platform/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const Pad = D.Pad = { on: false, fake: null, aim: null, focus: null };
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  // 站里：键 → 动作（按改键后的键位发）
  const ACT = { [B.A]: 'interact', [B.B]: 'dash', [B.X]: 'reload', [B.Y]: 'skill', [B.LB]: 'q', [B.RB]: 'e', [B.UP]: 'heal', [B.RIGHT]: 'shieldUse', [B.DOWN]: 'charge', [B.LEFT]: 'nade', [B.RS]: 'ammo', [B.VIEW]: 'bag' };
  let prev = [], held = new Map(), navT = 0;
  const list = () => { if (Pad.fake) return [Pad.fake]; try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (e) { return []; } };
  const down = (g, i) => { const b = g.buttons[i]; return !!b && (typeof b === 'object' ? (b.pressed || b.value > 0.5) : b > 0.5); };
  const KEYNAME = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', Space: ' ' };
  const keyOf = code => KEYNAME[code] || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code);
  const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, key: keyOf(code), bubbles: true }));
  // 按住：按下时发 keydown，松开时发 keyup（只管自己按下的键，不碰键盘）
  function hold(tag, code, on) {
    const was = held.get(tag);
    if (on && was !== code) { if (was) send('keyup', was); held.set(tag, code); send('keydown', code); }
    else if (!on && was) { held.delete(tag); send('keyup', was); }
  }
  function releaseAll() { for (const [, code] of held) send('keyup', code); held.clear(); const I = D.Input; if (Pad.mouse) { I.mdown = false; I.rdown = false; Pad.mouse = false; } }
  Pad.release = releaseAll;

  // 瞄准辅助：右摇杆方向 0.22 弧度以内、240 像素以内最近的敌人
  function assist(S, a) {
    const p = S.player; let best = null, bd = 0.22;
    for (const e of S.enemies) { if (e.dead || e.f !== S.f || e.dormant) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 240) continue; const da = Math.abs(D.angDiff(a, Math.atan2(e.y - 6 - (p.y - 6), e.x - p.x))); if (da < bd) { bd = da; best = e; } }
    return best ? Math.atan2(best.y - 6 - (p.y - 6), best.x - p.x) : a;
  }

  // 菜单里找按钮：看得见、没禁用的按钮 / 链接 / 输入框；方向上最近的那个
  function targets() {
    const root = document.getElementById('ui'), modal = root && root.querySelector('.modal'), scope = modal || root; if (!scope) return [];
    return [...scope.querySelectorAll('button, [data-act], select, input[type=checkbox], input[type=range], .cx-item, .ep-card')].filter(el => { if (el.disabled || el.offsetParent === null) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight; });
  }
  function setFocus(el) { if (Pad.focus) Pad.focus.classList.remove('gp-focus'); Pad.focus = el; if (el) { el.classList.add('gp-focus'); el.scrollIntoView && el.scrollIntoView({ block: 'nearest' }); } }
  function nav(dx, dy) {
    const L = targets(); if (!L.length) return;
    if (!Pad.focus || !L.includes(Pad.focus)) { setFocus(L[0]); return; }
    const c = Pad.focus.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2; let best = null, bs = 1e9;
    for (const el of L) { if (el === Pad.focus) continue; const r = el.getBoundingClientRect(), x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy, along = x * dx + y * dy; if (along <= 2) continue; const side = Math.abs(x * dy - y * dx), s = along + side * 2.5; if (s < bs) { bs = s; best = el; } }
    if (best) { setFocus(best); D.Sfx && D.Sfx.play('tink'); }
  }
  function back() {
    const root = document.getElementById('ui'), m = root && root.querySelector('.modal'), close = m && m.querySelector('[data-act=close]');
    if (close) close.click(); else { send('keydown', 'Escape'); send('keyup', 'Escape'); }
  }

  Pad.poll = function (G, dt) {
    const g = list()[0];
    if (!g) { if (Pad.on) { releaseAll(); setFocus(null); if (D.UI && D.UI.toast) D.UI.toast('手柄断开了'); } Pad.on = false; prev = []; return; }
    if (!Pad.on) { Pad.on = true; if (D.UI && D.UI.toast) D.UI.toast('手柄已连接'); }
    const now = g.buttons.map((b, i) => down(g, i)), edge = i => now[i] && !prev[i];
    if (now.some(Boolean) && D.onFirstGesture) { D.onFirstGesture(); D.onFirstGesture = null; }
    const ax = g.axes || [], lx = ax[0] || 0, ly = ax[1] || 0, rx = ax[2] || 0, ry = ax[3] || 0, dz = 0.35, I = D.Input;
    // 剧情屋（scene.js）：A 推进 / 打完这一句，十字键 上 下 左 右 = 选第 1 2 3 4 项（有打断时上 = 打断），B / 菜单 = Esc（两下跳过这一场）
    if (G.mode === 'scene') {
      if (held.size || Pad.mouse) releaseAll();
      const tap = k => { send('keydown', k); send('keyup', k); };
      if (edge(B.A)) tap('Space');
      [[B.UP, 'Digit1'], [B.DOWN, 'Digit2'], [B.LEFT, 'Digit3'], [B.RIGHT, 'Digit4']].forEach(([b, k]) => { if (edge(b)) tap(k); });
      if (edge(B.B) || edge(B.MENU)) tap('Escape');
      prev = now; return;
    }
    const UI = D.UI, menu = G.mode !== 'station' || (UI.modalOpen && UI.modalOpen()) || !!document.querySelector('#ui .inv');
    if (!menu && G.S && G.S.player) {
      setFocus(null);
      hold('l', D.key('left'), lx < -dz); hold('r', D.key('right'), lx > dz); hold('u', D.key('up'), ly < -dz); hold('d', D.key('down'), ly > dz);
      for (const i in ACT) hold('b' + i, D.key(ACT[i]), now[i]);
      if (edge(B.MENU)) { send('keydown', 'Escape'); send('keyup', 'Escape'); }
      // 右摇杆瞄准；没推右摇杆时沿用上一次的方向（刚接上时用左摇杆的方向）
      const S = G.S, p = S.player;
      if (Math.hypot(rx, ry) > 0.3) Pad.aim = Math.atan2(ry, rx); else if (Pad.aim == null && Math.hypot(lx, ly) > dz) Pad.aim = Math.atan2(ly, lx);
      if (Pad.aim != null) { const a = D.settings.aimAssist !== false ? assist(S, Pad.aim) : Pad.aim; I.mx = (p.x + Math.cos(a) * 90 - S.cam.x) * D.Z; I.my = (p.y - 6 + Math.sin(a) * 90 - S.cam.y) * D.Z; }
      // 扳机：RT 开枪，LT 近战（按住蓄力 / 开镜）
      if (now[B.RT] || now[B.LT] || Pad.mouse) { I.mdown = now[B.RT]; I.rdown = now[B.LT]; if (edge(B.LT)) I.rclick = true; Pad.mouse = now[B.RT] || now[B.LT]; }
    } else {
      if (held.size || Pad.mouse) releaseAll();
      navT -= dt; const dx = (now[B.RIGHT] ? 1 : 0) - (now[B.LEFT] ? 1 : 0) || (lx > 0.5 ? 1 : lx < -0.5 ? -1 : 0), dy = (now[B.DOWN] ? 1 : 0) - (now[B.UP] ? 1 : 0) || (ly > 0.5 ? 1 : ly < -0.5 ? -1 : 0);
      const title = G.mode === 'title' && !UI.modalOpen();
      if ((dx || dy) && navT <= 0) { navT = 0.18; if (title) { const k = dy > 0 ? 'ArrowDown' : dy < 0 ? 'ArrowUp' : null; if (k) { send('keydown', k); send('keyup', k); } } else nav(dx, dy); }
      if (!dx && !dy) navT = 0;
      if (edge(B.A)) { if (title) { send('keydown', 'Enter'); send('keyup', 'Enter'); } else if (Pad.focus && document.contains(Pad.focus)) { const f = Pad.focus; if (f.tagName === 'INPUT' && f.type === 'checkbox') { f.checked = !f.checked; f.dispatchEvent(new Event('change')); } else f.click(); } else nav(0, 1); }
      if (edge(B.B) || edge(B.MENU)) back();
      if (edge(B.VIEW) && G.mode === 'station') { send('keydown', D.key('bag')); send('keyup', D.key('bag')); }
    }
    prev = now;
  };
})(D);
