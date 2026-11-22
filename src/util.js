/* 末班之后 · 小样：基础工具（随机数、数学、输入） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  D.W = 640; D.H = 360; D.Z = 2; D.DT = 1 / 60; // 画面 640×360；世界坐标 1 单位 = D.Z 像素；界面层按 384 宽的单位排版（--px）

  // ── 种子随机数（mulberry32）
  D.rng = function (seed) {
    let a = (typeof seed === 'string' ? D.hash(seed) : seed) >>> 0;
    const r = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.chance = p => r() < p;
    r.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    r.weighted = list => { let s = 0; for (const [, w] of list) s += w; let x = r() * s; for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[list.length - 1][0]; };
    return r;
  };
  D.hash = function (s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  // 画面用的随机：不影响玩法结果
  D.fx = D.rng(12345);

  D.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  D.lerp = (a, b, t) => a + (b - a) * t;
  D.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  D.ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  D.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  D.ease = { outCubic: t => 1 - Math.pow(1 - t, 3), outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 };

  // ── 输入：键盘 + 鼠标（画布逻辑坐标）
  const I = D.Input = { keys: {}, pressed: {}, mx: D.W / 2, my: D.H / 2, mdown: false, mclick: false, rclick: false, rdown: false, canvas: null };
  I.attach = function (canvas) {
    I.canvas = canvas;
    addEventListener('keydown', e => {
      if (e.repeat) return;
      I.keys[e.code] = true; I.pressed[e.code] = true;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (D.onFirstGesture) { D.onFirstGesture(); D.onFirstGesture = null; }
    });
    addEventListener('keyup', e => { I.keys[e.code] = false; });
    addEventListener('blur', () => { I.keys = {}; I.mdown = false; I.rdown = false; });
    const move = e => { const b = canvas.getBoundingClientRect(); I.mx = (e.clientX - b.left) * D.W / b.width; I.my = (e.clientY - b.top) * D.H / b.height; };
    addEventListener('mousemove', move);
    canvas.addEventListener('mousedown', e => {
      move(e);
      if (e.button === 0) { I.mdown = true; I.mclick = true; } else if (e.button === 2) { I.rclick = true; I.rdown = true; }
      if (D.onFirstGesture) { D.onFirstGesture(); D.onFirstGesture = null; }
    });
    addEventListener('mouseup', e => { if (e.button === 0) I.mdown = false; else if (e.button === 2) I.rdown = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  };
  // ── 改键：动作 → 键位（设置里能改；方向键一直能用来走路）
  D.BIND_DEFAULT = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', dash: 'Space', interact: 'KeyF', pick: 'KeyT', reload: 'KeyR', ammo: 'KeyB', heal: 'KeyC', shieldUse: 'KeyV', charge: 'KeyX', nade: 'KeyZ', q: 'KeyQ', e: 'KeyE', skill: 'KeyG', bag: 'Tab' };
  D.ACT_NAME = { up: '上', down: '下', left: '左', right: '右', dash: '闪避', interact: '交互 / 捡东西', pick: '换一个交互目标', reload: '换弹', ammo: '换弹种', heal: '回血', shieldUse: '护盾电池', charge: '释放电容', nade: '扔手雷', q: '模块 Q', e: '模块 E', skill: '型号技能', bag: '背包' };
  D.key = act => (D.settings && D.settings.binds && D.settings.binds[act]) || D.BIND_DEFAULT[act];
  D.keyLabel = code => !code ? '—' : code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : ({ Space: '空格', Tab: 'Tab', ShiftLeft: '左Shift', ShiftRight: '右Shift', ControlLeft: '左Ctrl', AltLeft: '左Alt', CapsLock: '大写', Backquote: '`', Enter: '回车', Backspace: '退格' }[code] || code.replace('Arrow', '方向'));
  I.endFrame = function () { I.pressed = {}; I.mclick = false; I.rclick = false; I.wheel = 0; };
  I.hit = code => !!I.pressed[code];
})(D);
