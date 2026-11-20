/* 末班之后 · 小样二：线路主题和车站骨架（试玩反馈汇总第 2 轮）
   线路主题：每条线按编号轮流是 工业线 / 商业线 / 旧城线。主题决定这条线上各站的配色、多出哪些房间、
   特有敌人（焊工机 / 橱窗假人 / 野狗机）和特产（只在这条线上搜得到）。换乘站按它的第一条线算。
   车站骨架：同一种站也长得不一样——标准、长厅、双厅、环厅、深埋（多一层设备层）、塌方（废弃，到处是碎石）。
   每个站的骨架由站号定死（同一个站每次进都是同一种骨架，房间和东西照样随机）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';

  // ── 线路主题
  D.LINE_THEMES = {
    industrial: {
      name: '工业线', short: '工', col: '#ffb057',
      desc: '沿线是厂区和货运站。车间、维修间多，焊工机出没；特产是机械零件',
      tint: { floor: ['#2e2f2c', '#33332f', '#2b2c29'], grout: '#1d1d1a', face: ['#2c2b26', '#36342d'], neon: ['#ffb057', '#ffd23a'], ambient: '#1e1c18', lamp: '#ffc070' },
      rooms: [['workshop', 2], ['factory', 2], ['storage', 1]], enemy: 'welder', enemyW: 1.4,
      props: [['barrel', 2], ['crate', 2], ['machine', 1]],
      items: ['gearbox', 'weldrod', 'turbine'], cats: ['part', 'metal', 'mat'],
    },
    commercial: {
      name: '商业线', short: '商', col: '#ff3d8b',
      desc: '穿过商圈和写字楼。商铺、珠宝店多，橱窗假人装死埋伏；特产是值钱的消费品',
      tint: { floor: ['#33293f', '#382c46', '#30283c'], grout: '#221a2c', face: ['#2c2138', '#382a46'], neon: ['#ff3d8b', '#3ee8ff', '#ffe14a'], ambient: '#23182f', lamp: '#ffb3d4' },
      rooms: [['shop', 3], ['ticket', 1]], hvBoost: 0.15, enemy: 'mannequin', enemyW: 1.3,
      props: [['planter', 2], ['vending', 2], ['kiosk', 1]],
      items: ['giftcard', 'handbag', 'lottery'], cats: ['val', 'elec'],
    },
    oldtown: {
      name: '旧城线', short: '旧', col: '#8dff6a',
      desc: '最早修的老线，站又旧又深。仓库和隐藏房间多，野狗机成群；特产是老物件',
      tint: { floor: ['#2a2b2a', '#2e2f2c', '#272826'], grout: '#1a1b19', face: ['#262622', '#302f29'], neon: ['#8dff6a', '#e3c14a'], ambient: '#191b18', lamp: '#e8d49a' },
      rooms: [['storage', 2], ['ticket', 1], ['power', 1]], hiddenBoost: 0.25, enemy: 'dog', enemyW: 1.2,
      props: [['bench', 2], ['crate', 1], ['bin', 1]],
      items: ['oldphoto', 'brassbell', 'ticketbook'], cats: ['intel', 'val'],
    },
  };
  D.LINE_THEME_ORDER = ['industrial', 'commercial', 'oldtown'];
  D.lineThemeKey = li => li == null || li < 0 ? null : D.LINE_THEME_ORDER[li % D.LINE_THEME_ORDER.length];
  D.lineThemeOf = st => st && st.lines && st.lines.length ? D.lineThemeKey(st.lines[0]) : null;

  // ── 特产（只在对应主题的线上搜得到；art 借用已有图标）
  Object.assign(D.ITEMS, {
    weldrod:    { name: '焊条捆',   q: 1, v: 48,  w: 1, h: 1, stack: 5, cat: 'mat',   art: 'copper',  line: 'industrial' },
    gearbox:    { name: '减速齿轮箱', q: 2, v: 170, w: 2, h: 1, stack: 1, cat: 'part',  art: 'motor',   line: 'industrial' },
    turbine:    { name: '涡轮叶片', q: 3, v: 430, w: 1, h: 2, stack: 1, cat: 'part',  art: 'hydro',   line: 'industrial' },
    giftcard:   { name: '商场储值卡', q: 1, v: 55,  w: 1, h: 1, stack: 5, cat: 'val',   art: 'keycard', line: 'commercial' },
    lottery:    { name: '未兑奖彩票', q: 2, v: 150, w: 1, h: 1, stack: 3, cat: 'val',   art: 'cigar',   line: 'commercial' },
    handbag:    { name: '名牌手袋', q: 3, v: 470, w: 2, h: 2, stack: 1, cat: 'val',   art: 'perfume', line: 'commercial' },
    oldphoto:   { name: '老相册',   q: 1, v: 60,  w: 1, h: 1, stack: 5, cat: 'intel', art: 'radio',   line: 'oldtown' },
    brassbell:  { name: '铜站铃',   q: 2, v: 190, w: 1, h: 1, stack: 1, cat: 'val',   art: 'vase',    line: 'oldtown' },
    ticketbook: { name: '首班车票本', q: 3, v: 400, w: 1, h: 1, stack: 1, cat: 'intel', art: 'pocketw', line: 'oldtown' },
  });
  for (const k in D.ITEMS) if (D.ITEMS[k].line) D.ITEMS[k].noLoot = true; // 不进通用掉落池，只走下面的特产掷骰
  // 搜到东西时：在主题线上有一定概率换成这条线的特产
  D.rollLineItem = function (rng, st, q) {
    const T = D.LINE_THEMES[D.lineThemeOf(st)]; if (!T || !rng.chance(0.14)) return null;
    const fit = T.items.filter(k => D.ITEMS[k].q <= Math.max(1, q)); if (!fit.length) return null;
    const id = fit.reduce((a, k) => (D.ITEMS[k].q > D.ITEMS[a].q ? k : a), fit[0]);
    return { id, n: 1 };
  };

  // ── 车站骨架
  D.LAYOUTS = {
    standard: { name: '标准站', desc: '站厅在中间，房间围一圈' },
    long:     { name: '长厅站', desc: '一条长长的站厅横在上面，房间排在下面两排' },
    split:    { name: '双厅站', desc: '左右两个站厅，中间一条通道' },
    ring:     { name: '环厅站', desc: '站厅中间是一大块售票亭，绕着走' },
    deep:     { name: '深埋站', desc: '站厅下面还有一层设备层：配电、仓库、维修间，岔路多' },
    collapse: { name: '塌方站', desc: '废弃多年，到处是碎石，灯大多坏了，隐藏房间多' },
  };
  const LAYOUT_W = D.LAYOUT_W = [['standard', 3], ['long', 2], ['split', 2], ['ring', 2], ['deep', 1.5], ['collapse', 1.5]]; // scenes.js 往里加新骨架
  // 由站号和站名定死；安全站、教学、储备库保持标准
  D.layoutOf = function (st) {
    if (!st || st.home || st.reserve || st.tut) return 'standard';
    const T = D.STATION_TYPES[st.type]; if (T && T.safe) return 'standard';
    if (st.layout) return st.layout;
    let h = 2166136261; for (const ch of String(st.id) + ':' + (st.name || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const tot = LAYOUT_W.reduce((a, [, w]) => a + w, 0); let r = (h % 10000) / 10000 * tot;
    for (const [k, w] of LAYOUT_W) { if ((r -= w) < 0) return k; }
    return 'standard';
  };

  // ── 各主题线的特有敌人（base = 借用哪种敌人的动作）
  Object.assign(D.ENEMIES, {
    welder:    { name: '焊工机', hp: 44, r: 7, speed: 30, loot: 2, base: 'drone', dmgMul: 1.5, spreadMul: 0.5, sight: 100, line: 'industrial', tag: '工业线特有：厂里的焊接机械臂，装上了履带', moves: ['点焊：贴近了打两三下火花，很疼', '厚：外壳焊了好几层钢板，耐打', '慢：履带走不快，拉开距离就行'] },
    mannequin: { name: '橱窗假人', hp: 26, r: 5, speed: 66, loot: 1, base: 'crawler', dmgMul: 1.2, line: 'commercial', ambush: true, tag: '商业线特有：混在橱窗模特里的伏击机', moves: ['装死：一动不动站着，像个模特', '扑：你走近了才突然扑过来', '看清楚：头上没有问号的"模特"更要小心'] },
    dog:       { name: '野狗机', hp: 15, r: 5, speed: 92, loot: 0, base: 'crawler', dmgMul: 0.75, line: 'oldtown', pack: 3, tag: '旧城线特有：流浪的四足巡逻机，三只一群', moves: ['成群：一来就是三只', '快：跑得比你快，别想甩掉', '脆：一两枪就散架'] },
  });

  // 两个颜色按比例混
  D.mixHex = function (a, b, k) { const A = D.rgb(a), B = D.rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  // 楼层配色：原来的主题往线路主题的颜色靠一半
  D.tintTheme = function (th, lineKey) {
    const L = D.LINE_THEMES[lineKey]; if (!L) return th;
    const t = L.tint, mixArr = (a, b) => a.map((c, i) => D.mixHex(c, b[i % b.length], 0.55));
    return Object.assign({}, th, { floor: mixArr(th.floor, t.floor), grout: D.mixHex(th.grout, t.grout, 0.55), face: mixArr(th.face, t.face), neon: t.neon.concat(th.neon.slice(0, 1)), ambient: D.mixHex(th.ambient, t.ambient, 0.6), lamp: D.mixHex(th.lamp, t.lamp, 0.6), line: lineKey });
  };
})(D);
