/* 末班之后 · 小样二：第二批战利品（约一千件，资源搜取点里搜出来的货）
   在 items-ext.js 之后加载：再加 15 个家族（金属、机械件、电子、医疗、首饰、情报、工具、家用、食品、化工、装备、能源、机构、收藏、原料）。
   图标：42 种外形（T2）× 色阶（每件按名字挑，三成的件换一套色）× 角标（色带、警示条、标签、小红十字……，约一半的件有），
   所以同一种外形的两件东西也多半长得不一样。变体（回收、军规……）和 items-ext.js 一样在右上角多一道杠。
   id 规则：家族代号 + 两位序号 + 变体序号（只往后加，不改顺序，老存档里的东西就不会丢）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const R = D.RAMP;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const VQ = [10, 40, 130, 360, 1150, 3700];
  const MARKS = ['#ffd860', '#3ee8ff', '#ff6a6a'];
  const ALT = ['steel', 'rust', 'white', 'yellow', 'gunmetal', 'copper', 'gold', 'silver', 'green', 'red', 'blue', 'glass', 'olive', 'cloth', 'magenta', 'dark'];
  const at = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];

  // ── 42 种外形。p 是 28×28 画板，a 是主色阶，b 是点缀色阶，k 是 0..1 的微调
  const T2 = {
    bulb: (p, a) => { p.ell(14, 11, 7, 8, a, { spec: true }); p.box(9, 17, 10, 4, R.gunmetal, { r: 1 }); p.rect(10, 21, 8, 1, '#434b5f'); p.rect(11, 23, 6, 2, '#949fb6'); p.px(10, 8, '#ffffff', 1); },
    flask: (p, a, b) => { p.box(12, 2, 4, 10, R.glass, { r: 1 }); p.rect(11, 1, 6, 2, b[3]); p.ell(14, 19, 8, 7, R.glass, { spec: true }); p.ell(14, 20, 5, 4, a); p.px(10, 16, '#ffffff', 1); },
    vial: (p, a, b) => { p.box(10, 4, 8, 21, R.glass, { r: 3 }); p.rect(11, 11, 6, 13, at(a, 2)); p.rect(10, 2, 8, 3, b[3]); p.px(12, 6, '#ffffff', 1); },
    crate: (p, a, b) => { p.box(4, 5, 20, 19, R.crate, { r: 1 }); p.rect(4, 11, 20, 1, '#24160c'); p.rect(4, 18, 20, 1, '#24160c'); p.rect(13, 5, 1, 19, '#24160c'); p.px(6, 7, '#d6a066'); p.px(21, 7, '#d6a066'); p.rect(5, 13, 6, 3, b[3]); },
    key: (p, a) => { p.ell(8, 14, 5, 5, a, { spec: true }); p.disc(8, 14, 2, '#0b0a14'); p.rect(12, 13, 11, 2, at(a, 2)); p.rect(19, 15, 2, 3, at(a, 2)); p.rect(16, 15, 2, 2, at(a, 2)); p.px(6, 11, '#ffffff', 1); },
    chain: (p, a, b) => { for (let i = 0; i < 5; i++) p.ell(6 + i * 4.2, i % 2 ? 17 : 12, 2.6, 3.6, a, { spec: true }); p.ell(24, 21, 3, 3, b, { spec: true }); },
    hammer: (p, a, b) => { p.box(13, 9, 3, 17, R.cloth, { r: 1 }); p.box(4, 3, 18, 8, a, { r: 1 }); p.rect(4, 3, 18, 1, at(a, 5)); p.rect(20, 4, 2, 6, b[3]); },
    saw: (p, a, b) => { p.rect(2, 11, 22, 5, at(a, 4)); for (let x = 2; x < 24; x += 3) p.px(x, 16, at(a, 5)); p.box(20, 4, 7, 11, b, { r: 2 }); p.rect(22, 7, 3, 1, '#0b0a14'); },
    lantern: (p, a) => { p.line(14, 1, 14, 4, R.gunmetal[3]); p.box(10, 4, 8, 4, a, { r: 1 }); p.box(8, 8, 12, 14, R.gunmetal, { r: 2 }); p.rect(10, 10, 8, 10, '#ffd860', 1); p.rect(11, 11, 2, 8, '#fff4c0', 1); p.rect(8, 22, 12, 2, at(a, 1)); },
    jerry: (p, a, b) => { p.box(5, 8, 18, 17, a, { r: 2 }); p.box(9, 3, 8, 5, a, { r: 1 }); p.rect(20, 9, 3, 3, at(a, 1)); p.rect(9, 13, 10, 6, b[3]); p.rect(5, 7, 18, 1, at(a, 5)); },
    foil: (p, a, b) => { p.box(4, 6, 20, 16, R.silver, { r: 2 }); for (let i = 0; i < 3; i++) p.line(6, 10 + i * 4, 21, 9 + i * 4, '#848ca8'); p.rect(7, 9, 8, 5, b[3]); p.px(18, 17, '#ffffff', 1); },
    disc: (p) => { p.ell(14, 14, 11, 11, R.silver, { spec: true }); p.ell(14, 14, 3, 3, R.dark, { flat: true }); p.line(5, 20, 14, 6, '#ff8ad8'); p.line(8, 21, 17, 7, '#8af0ff'); },
    pcb: (p, a, b) => { p.box(3, 6, 22, 16, a, { r: 1 }); p.box(6, 9, 6, 6, R.dark, { r: 1 }); p.box(15, 11, 7, 4, R.dark, { r: 1 }); p.line(4, 20, 24, 20, b[4]); p.px(5, 8, b[4]); p.px(22, 8, b[4]); },
    antenna: (p, a, b) => { p.box(9, 15, 10, 8, a, { r: 2 }); p.line(14, 15, 14, 3, '#949fb6'); p.line(14, 15, 8, 3, '#949fb6'); p.disc(14, 3, 1.5, b[4], 1); },
    brick: (p, a, b) => { p.box(3, 9, 22, 11, a, { r: 1 }); p.rect(3, 14, 22, 1, at(a, 0)); p.rect(12, 9, 1, 5, at(a, 0)); p.rect(19, 14, 1, 6, at(a, 0)); p.rect(8, 11, 4, 2, b[4]); },
    crystal: (p, a) => { for (let j = 0; j < 20; j++) { const hw = Math.round(Math.min(j, 19 - j) * 0.45 + 0.5); p.rect(14 - hw, 4 + j, hw * 2, 1, at(a, j < 10 ? 3 : 2)); } p.px(11, 8, '#ffffff', 1); },
    sack: (p, a, b) => { p.ell(14, 16, 9, 9, a); p.rect(11, 4, 6, 3, '#4a2f1f'); p.line(9, 8, 19, 8, '#c8b080'); p.rect(10, 14, 8, 5, b[3]); },
    pot: (p, a, b) => { p.box(5, 10, 18, 12, a, { r: 3 }); p.rect(3, 9, 22, 2, at(a, 5)); p.rect(2, 12, 3, 2, at(a, 2)); p.rect(23, 12, 3, 2, at(a, 2)); p.rect(8, 16, 12, 1, b[3]); },
    bowl: (p, a, b) => { p.ell(14, 12, 11, 6, a, { spec: true }); p.ell(14, 11, 8, 3, R.dark, { flat: true }); p.rect(6, 15, 16, 3, at(a, 1)); p.rect(9, 19, 10, 2, at(a, 1)); p.rect(12, 21, 4, 2, b[3]); },
    beads: (p, a, b) => { for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2; p.disc(14 + Math.cos(t) * 9, 13 + Math.sin(t) * 7, 2, at(a, 4)); } p.ell(14, 24, 3, 3, b, { spec: true }); },
    tablet: (p, a, b) => { p.box(4, 3, 20, 22, R.dark, { r: 2 }); p.rect(6, 5, 16, 16, b[2]); p.rect(7, 6, 14, 14, '#0b1020'); p.line(8, 9, 18, 9, b[4]); p.line(8, 12, 16, 12, b[4]); p.disc(14, 23, 1, '#c8cdda'); },
    headset: (p, a) => { for (let i = 0; i < 9; i++) { const t = Math.PI + i / 8 * Math.PI; p.disc(14 + Math.cos(t) * 9, 15 + Math.sin(t) * 10, 1, at(a, 3)); } p.ell(6, 18, 3.5, 4.5, a, { spec: true }); p.ell(22, 18, 3.5, 4.5, a, { spec: true }); },
    shard: (p, a) => { p.line(4, 22, 12, 4, at(a, 3)); p.line(12, 4, 20, 20, at(a, 2)); p.line(20, 20, 4, 22, at(a, 4)); p.line(10, 16, 16, 10, at(a, 5)); },
    plug: (p, a, b) => { p.box(7, 4, 14, 12, a, { r: 2 }); p.rect(10, 16, 2, 7, '#c8cdda'); p.rect(16, 16, 2, 7, '#c8cdda'); p.rect(9, 8, 10, 2, b[3]); },
    cassette: (p, a, b) => { p.box(3, 7, 22, 15, a, { r: 1 }); p.rect(6, 10, 16, 8, '#0b0a14'); p.disc(10, 14, 3, '#dbe5fa'); p.disc(18, 14, 3, '#dbe5fa'); p.rect(6, 19, 16, 2, b[3]); },
    scale: (p, a, b) => { p.line(14, 5, 14, 24, '#949fb6'); p.rect(6, 5, 16, 2, '#c8cdda'); p.line(6, 7, 4, 15, '#949fb6'); p.line(22, 7, 24, 15, '#949fb6'); p.ell(5, 17, 4, 2, a); p.ell(23, 17, 4, 2, a); p.rect(10, 23, 8, 2, b[3]); },
    herb: (p, a, b) => { p.line(4, 25, 22, 5, '#2e7032'); p.ell(9, 17, 4, 2, a); p.ell(16, 12, 4, 2, a); p.ell(12, 8, 3, 2, b); p.px(20, 6, '#b4ec98', 1); },
    canister: (p, a, b) => { p.box(9, 5, 10, 19, a, { r: 3 }); p.rect(9, 9, 10, 1, at(a, 1)); p.rect(9, 19, 10, 1, at(a, 1)); p.ell(14, 5, 5, 2, a); p.rect(12, 11, 4, 6, b[3]); },
    papers: (p, a, b, k) => {
      p.rect(7, 5, 16, 19, '#d9cfb0'); p.rect(5, 7, 16, 18, '#e8e0c8');
      if (k < 0.34) { for (let i = 0; i < 4; i++) p.rect(8, 10 + i * 3, 10 - (i % 2) * 3, 1, '#6a5f50'); p.rect(14, 20, 4, 3, b[3]); } // 字
      else if (k < 0.67) { p.rect(8, 9, 12, 8, b[2]); p.rect(8, 19, 10, 1, '#6a5f50'); p.rect(8, 21, 7, 1, '#6a5f50'); } // 照片 / 图
      else { for (let y = 9; y < 22; y += 4) p.rect(7, y, 14, 1, '#6a5f50'); p.rect(12, 8, 1, 14, '#6a5f50'); p.rect(16, 8, 1, 14, '#6a5f50'); } // 表格
    },
    lens: (p, a) => { p.ell(12, 12, 9, 9, a, { spec: true }); p.ell(12, 12, 7, 7, R.glass, { spec: true }); p.line(18, 18, 25, 25, '#949fb6'); p.line(19, 18, 26, 25, '#949fb6'); p.px(10, 9, '#ffffff', 1); },
    tire: (p, a, b) => { p.ell(14, 14, 11, 11, R.dark); p.ell(14, 14, 7, 7, a, { bias: 0.1 }); p.ell(14, 14, 3, 3, R.dark, { flat: true }); p.line(4, 14, 8, 14, b[3]); p.line(20, 14, 24, 14, b[3]); },
    spool: (p, a, b) => { p.box(4, 4, 20, 20, a, { r: 2 }); p.rect(4, 4, 20, 2, at(a, 5)); p.disc(14, 14, 5, '#2a1c06'); p.disc(14, 14, 3, b[3], 1); p.rect(6, 8, 16, 1, '#0b0a14'); },
    cog: (p, a) => { for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; p.rect(13 + Math.round(Math.cos(t) * 10), 13 + Math.round(Math.sin(t) * 10), 3, 3, at(a, 3)); } p.ell(14, 14, 9, 9, a); p.disc(14, 14, 3, '#0b0a14'); },
    clip: (p, a, b) => { p.box(6, 4, 4, 20, a, { r: 1 }); p.box(6, 4, 14, 4, a, { r: 1 }); p.box(16, 4, 4, 14, a, { r: 1 }); p.rect(9, 11, 8, 2, b[3]); },
    pliers: (p, a, b) => { p.line(6, 22, 18, 8, at(a, 3)); p.line(7, 22, 19, 8, at(a, 3)); p.line(9, 22, 21, 8, at(a, 4)); p.line(10, 22, 22, 8, at(a, 4)); p.ell(20, 7, 3, 3, b, { spec: true }); p.ell(5, 20, 2.5, 2.5, a); },
    pipe: (p, a) => { p.box(4, 11, 20, 6, a, { r: 2 }); p.rect(4, 11, 20, 1, at(a, 5)); p.box(9, 4, 6, 8, a, { r: 1 }); p.rect(12, 4, 2, 6, at(a, 5)); p.rect(20, 16, 4, 4, at(a, 2)); },
    pump: (p, a, b) => { p.ell(12, 15, 8, 8, a, { spec: true }); p.ell(12, 15, 4, 4, R.dark, { flat: true }); p.box(18, 11, 8, 8, b, { r: 1 }); p.rect(5, 22, 14, 3, R.gunmetal[2]); },
    fan: (p, a, b, k) => { for (let i = 0; i < 4; i++) { const t = i / 4 * Math.PI * 2 + k; p.ell(14 + Math.cos(t) * 6, 14 + Math.sin(t) * 6, 4, 2, a); } p.disc(14, 14, 2.5, '#0b0a14'); p.disc(14, 14, 1, b[3], 1); },
    lock: (p, a) => { p.box(5, 12, 18, 13, a, { r: 2 }); p.rect(8, 6, 2, 8, '#949fb6'); p.rect(18, 6, 2, 8, '#949fb6'); p.rect(8, 5, 12, 2, '#949fb6'); p.disc(14, 18, 2, '#0b0a14'); p.rect(13, 19, 2, 4, '#0b0a14'); },
    radiator: (p, a, b) => { for (let x = 4; x < 24; x += 4) p.rect(x, 5, 2, 18, at(a, 3)); p.rect(3, 3, 22, 2, b[3]); p.rect(3, 23, 22, 2, b[3]); },
    battery: (p, a, b, k) => { p.box(4, 7, 20, 16, a, { r: 2 }); p.rect(9, 4, 4, 3, '#c8cdda'); p.rect(16, 4, 4, 3, '#c8cdda'); p.rect(7, 11, 14, 3, b[4], 1); p.rect(7, 17, 8 + Math.round(k * 4), 2, '#8dff6a', 1); },
    plate: (p, a, b, k) => { p.box(3, 6, 22, 17, a, { r: 1 }); for (let i = 0; i < 3; i++) p.rect(5, 9 + i * 4, 18, 1, at(a, 1)); p.rect(5 + Math.round(k * 10), 19, 6, 2, b[3]); p.px(5, 7, '#c8cdda'); p.px(22, 7, '#c8cdda'); },
  };
  // ── 角标（约一半的件有，只一个）：色带、警示条、标签、红十字、电光、小灯点
  const OVER = [
    (p, a, b) => { p.rect(4, 15, 20, 2, b[3]); },
    (p, a, b) => { p.rect(6, 24, 2, 2, b[4], 1); p.rect(12, 24, 2, 2, b[4], 1); p.rect(18, 24, 2, 2, b[4], 1); },
    (p) => { p.rect(3, 20, 8, 5, '#eef1f8'); p.rect(4, 21, 6, 1, '#2d3550'); p.rect(4, 23, 4, 1, '#2d3550'); },
    (p) => { for (let x = 2; x < 26; x += 4) p.line(x, 26, x + 2, 24, '#ffd23a'); },
    (p) => { p.rect(4, 3, 1, 5, '#ff3047', 1); p.rect(2, 5, 5, 1, '#ff3047', 1); },
    (p) => { p.px(4, 3, '#ffe9b0', 1); p.px(3, 4, '#ffe9b0', 1); p.px(4, 5, '#ffe9b0', 1); p.px(3, 6, '#ffe9b0', 1); },
  ];
  const VARS_STD = [['', 0, 1], ['回收', -1, 0.8], ['高纯', 1, 1.5], ['军规', 2, 2.4]];

  // ── 15 个家族：名字 | 品质 | 外形 | 主色 | 点缀色 | 宽 | 高（宽高不写就是 1×1）
  const FAMS = [
    { code: 'na', cat: 'metal', vars: VARS_STD, base: [
      '铅块|0|brick|gunmetal|silver', '镉棒|1|pipe|silver|yellow', '镍板|1|plate|steel|silver', '锰块|1|brick|gunmetal|rust',
      '钼丝卷|2|spool|silver|copper', '钽片|3|plate|white|silver', '铌棒|3|pipe|silver|white', '锆砂瓶|3|vial|white|yellow',
      '钛合金板|3|plate|silver|blue', '镁带|0|foil|white|yellow', '钢坯|0|brick|steel|rust', '黄铜丝|0|spool|gold|copper',
      '紫铜板|1|plate|copper|rust', '锡箔|0|foil|silver|white', '锑块|1|brick|white|silver', '砷化镓片|4|plate|blue|silver',
      '钴粉罐|3|canister|blue|white', '镓柱|4|pipe|silver|blue', '铝合金壳|1|crate|silver|gunmetal', '钢砂袋|0|sack|gunmetal|rust',
      '稀土合金环|4|tire|gold|blue', '镍铬丝|2|spool|red|silver'] },
    { code: 'nb', cat: 'part', vars: [['', 0, 1], ['破旧', -1, 0.8], ['重型', 1, 1.5], ['精密', 2, 2.4]], base: [
      '螺母组|0|tire|steel|silver', '垫圈盒|0|beads|gunmetal|silver', '法兰盘|1|tire|gunmetal|silver', '销轴|0|pipe|steel|silver',
      '滑轮|1|tire|dark|rust', '凸轮|1|cog|steel|rust', '棘轮|1|cog|gunmetal|yellow', '齿条|1|pipe|silver|gold',
      '锁芯|2|lock|gold|silver', '铰链|0|clip|steel|silver', '合页|0|clip|gunmetal|yellow', '滚筒|1|spool|gunmetal|rust',
      '曲轴|2|pipe|steel|copper', '轴套|0|tire|copper|rust', '支架|0|clip|dark|yellow', '吊钩|1|key|gunmetal|silver',
      '卡箍|0|clip|steel|rust', '密封圈|0|tire|dark|silver', '叶轮|2|fan|silver|copper', '泵体|2|pump|steel|rust|2|1'] },
    { code: 'nc', cat: 'elec', vars: [['', 0, 1], ['二手', 0, 0.9], ['工业', 1, 1.6], ['军规', 2, 2.6]], base: [
      '光敏管|1|vial|glass|yellow', '二极管|0|pcb|dark|yellow', '三极管|0|pcb|green|gold', '蜂鸣器|1|bulb|gunmetal|red',
      '热敏电阻|1|bulb|red|silver', '电位器|0|cog|olive|silver', '天线模块|1|antenna|white|blue', '摄像头板|2|pcb|dark|blue',
      '麦克风|1|headset|gunmetal|yellow', '扬声器|1|lantern|dark|gold', '功放板|2|pcb|green|red', '充电底座|1|plug|white|blue',
      '遥控器|1|tablet|dark|red', '游戏手柄|1|tablet|dark|green', '键盘|1|tablet|white|yellow', '鼠标|0|cassette|white|blue',
      '指纹识别器|3|lock|dark|blue', '定位模块|2|antenna|gunmetal|green', '信号放大器|3|pcb|gunmetal|magenta', '显示驱动板|2|pcb|blue|yellow'] },
    { code: 'nd', cat: 'med', vars: [['', 0, 1], ['过期', -1, 0.7], ['军用', 1, 1.7], ['专业', 2, 2.2]], base: [
      '退烧药|0|vial|white|red', '消炎膏|0|canister|white|red', '眼药水|0|vial|glass|white', '碘酒|0|flask|rust|yellow',
      '镇静剂|2|flask|green|white', '凝血粉|1|sack|white|red', '弹性绷带|0|spool|cloth|red', '呼吸面罩|2|bowl|gunmetal|blue',
      '注射器组|1|vial|silver|red', '体温计|0|vial|silver|red', '夹板|0|plate|white|yellow', '消毒湿巾|0|papers|white|blue',
      '酒精棉|0|sack|white|blue', '维生素片|0|vial|yellow|green', '胰岛素笔|2|canister|silver|red', '止咳糖浆|0|flask|red|yellow',
      '解毒剂|2|flask|green|magenta', '口罩箱|0|crate|white|blue', '氧气瓶|2|canister|blue|white', '生理盐水|1|flask|glass|blue'] },
    { code: 'ne', cat: 'val', vars: [['', 0, 1], ['老式', 1, 1.3], ['收藏', 2, 1.8], ['限量', 3, 2.5]], base: [
      '胸链|1|chain|gold|silver', '袖链|1|chain|silver|gold', '项链|2|chain|silver|blue', '手表带|1|chain|steel|gold',
      '印章|2|cog|gold|red', '珐琅盒|2|crate|blue|gold', '烟嘴|1|pipe|dark|gold', '打火机盖|1|plate|gold|silver',
      '眼镜链|0|chain|silver|blue', '古钱串|2|beads|gold|copper', '玉佩|2|crystal|green|gold', '玉镯|2|tire|green|silver',
      '玛瑙珠|2|beads|red|gold', '玳瑁梳|1|plate|rust|gold', '象牙梳|2|plate|white|gold', '翡翠耳坠|3|crystal|green|silver',
      '琉璃瓶|2|vial|blue|gold', '水晶球|3|lens|glass|white', '银质怀表|3|cog|silver|gold', '金属书签|1|plate|gold|red'] },
    { code: 'nf', cat: 'intel', vars: [['', 0, 1], ['加密', 1, 1.7], ['绝密', 2, 2.4], ['原件', 0, 1.2]], base: [
      '通讯录|1|papers|blue|yellow', '航线图|1|papers|cloth|blue', '电话簿|0|papers|olive|yellow', '货单存根|0|papers|white|red',
      '会议记录|1|papers|blue|gold', '工程日志|1|papers|olive|red', '密封信|1|papers|red|white', '发票存根|0|papers|white|blue',
      '许可证|1|papers|yellow|red', '巡逻表|0|papers|gunmetal|yellow', '照片底片|1|papers|dark|silver', '录音带|1|cassette|dark|red',
      '账本|1|papers|cloth|yellow', '工单|0|papers|white|gunmetal', '合同副本|1|papers|white|gold', '线路图纸|2|papers|blue|silver',
      '信号代码|2|tablet|dark|green', '监控截图|2|tablet|gunmetal|red', '气象记录|1|papers|blue|green', '身份卡|1|plate|blue|silver',
      '时刻表|0|papers|yellow|blue', '配给票|0|papers|olive|red'] },
    { code: 'ng', cat: 'part', vars: [['', 0, 1], ['专业', 1, 1.6], ['军用', 2, 2.2], ['二手', 0, 0.9]], base: [
      '角尺|0|plate|steel|yellow', '水平仪|1|crate|yellow|dark', '卷尺|0|spool|yellow|gunmetal', '锉刀|0|saw|steel|rust',
      '砂纸卷|0|spool|olive|yellow', '手锯|1|saw|steel|yellow', '锤子|0|hammer|steel|rust', '大锤|1|hammer|gunmetal|red',
      '木工凿|0|pliers|copper|rust', '剪线钳|0|pliers|red|silver', '压线钳|1|pliers|blue|silver', '管钳|1|pliers|gunmetal|yellow',
      '螺丝批套|1|hammer|red|silver', '撬棒|1|pipe|gunmetal|rust', '镊子|1|pliers|silver|red', '卡钳|1|clip|steel|gold',
      '粉笔线盒|0|crate|red|white', '手摇钻|2|pump|steel|yellow', '电烙铁|1|pipe|copper|red', '工具刀|0|key|silver|red'] },
    { code: 'nh', cat: 'mat', vars: [['', 0, 1], ['破旧', -1, 0.8], ['精装', 1, 1.3], ['礼盒', 2, 1.8]], base: [
      '铁锅|0|pot|gunmetal|rust', '水壶|0|flask|silver|blue', '铁碗|0|bowl|gunmetal|rust', '搪瓷杯|0|pot|white|red',
      '毛巾|0|sack|cloth|white', '牙刷包|0|papers|white|blue', '肥皂|0|brick|white|green', '香皂盒|0|crate|white|green',
      '梳子|0|plate|olive|yellow', '镜子|1|plate|silver|gold', '台灯|1|bulb|gold|white', '挂钟|1|cog|dark|yellow',
      '闹钟|1|bulb|red|silver', '拖鞋|0|sack|cloth|blue', '雨伞|1|sack|dark|red', '烛台|1|pot|gold|white',
      '瓷碟|2|bowl|white|blue', '茶罐|1|canister|olive|gold', '糖罐|0|canister|white|red', '针线包|0|sack|olive|red'] },
    { code: 'ni', cat: 'mat', vars: [['', 0, 1], ['过期', -1, 0.6], ['进口', 1, 1.4], ['礼盒', 2, 1.8]], base: [
      '方便面|0|crate|yellow|red', '饼干礼盒|1|crate|gold|red', '午餐肉|0|canister|red|silver', '豆罐头|0|canister|yellow|red',
      '奶粉|0|canister|white|blue', '蜂蜜罐|1|canister|yellow|gold', '果酱瓶|0|vial|red|gold', '腊肠|0|bowl|red|cloth',
      '咸菜坛|0|pot|green|olive', '饮料箱|0|crate|blue|white', '矿泉水|0|vial|glass|blue', '维他命饮料|1|vial|yellow|green',
      '速溶咖啡|1|canister|cloth|red', '糖果袋|0|sack|magenta|yellow', '干果|0|sack|olive|rust', '炒米|0|sack|yellow|cloth',
      '肉松|0|bowl|rust|yellow', '巧克力蛋糕|1|crate|cloth|gold', '压缩菜|0|brick|olive|green', '冷冻鱼|1|foil|blue|white'] },
    { code: 'nj', cat: 'mat', vars: [['', 0, 1], ['工业', 1, 1.4], ['高纯', 2, 1.8], ['二手', 0, 0.9]], base: [
      '硫酸瓶|1|flask|yellow|red', '盐酸桶|0|canister|yellow|gunmetal', '丙酮|0|vial|glass|silver', '甲醇|0|vial|glass|red',
      '乙醇钠|1|vial|white|blue', '氯化钠块|0|brick|white|blue', '硝酸钾|1|brick|white|red', '硫磺粉|0|sack|yellow|rust',
      '活性炭袋|0|sack|dark|silver', '石灰粉|0|sack|white|gunmetal', '树脂胶|1|canister|yellow|silver', '发泡剂|1|canister|blue|white',
      '催化剂|2|vial|gold|blue', '滤芯|1|radiator|gunmetal|blue', '净水剂|0|vial|white|green', '冰晶盐|1|crystal|white|blue',
      '电解液|1|flask|green|yellow', '防冻剂|1|flask|blue|white', '洗涤剂|0|canister|blue|green', '漂白粉|0|sack|white|blue',
      '颜料罐|0|canister|magenta|silver', '涂漆桶|0|canister|red|gunmetal', '焊膏|1|canister|silver|gold', '助焊剂|1|vial|yellow|silver'] },
    { code: 'nk', cat: 'part', vars: [['', 0, 1], ['破旧', -1, 0.8], ['战术', 1, 1.6], ['军用', 2, 2.2]], base: [
      '防毒滤罐|1|canister|olive|yellow', '护膝|0|tire|olive|yellow', '安全帽|1|bowl|yellow|white', '反光背心|0|sack|yellow|white',
      '登山绳|0|spool|yellow|red', '头灯|1|lantern|dark|yellow', '防刺手套|1|sack|dark|silver', '工作服|0|sack|olive|yellow',
      '雨衣|0|sack|blue|yellow', '防寒靴|1|crate|cloth|white', '救生衣|1|sack|yellow|red', '氧气面罩|2|bowl|gunmetal|glass',
      '防火毯|1|papers|red|silver', '帐篷布|1|papers|olive|cloth', '睡袋|0|sack|red|cloth', '战术腰带|2|spool|olive|gold',
      '水壶挂袋|0|sack|olive|silver', '军用水壶|1|canister|olive|gunmetal', '登山扣|2|clip|silver|gold', '太阳能帽|1|bowl|dark|yellow'] },
    { code: 'nl', cat: 'elec', vars: [['', 0, 1], ['破旧', -1, 0.8], ['大容量', 1, 1.6], ['军用', 2, 2.2]], base: [
      '干电池组|0|battery|olive|silver', '锂电池包|2|battery|silver|yellow|2|1', '太阳能板片|1|plate|blue|silver', '发电机线圈|1|spool|copper|gold',
      '燃料电芯|3|battery|magenta|blue', '铅酸电瓶|1|battery|dark|yellow|2|1', '电池壳|0|crate|dark|gunmetal', '储能柱|3|canister|blue|silver',
      '充电线圈|1|spool|silver|blue', '保险丝盒|0|crate|red|silver', '变频器|2|pcb|gunmetal|yellow', '逆变器|2|battery|dark|red|2|1',
      '发电机皮带|0|tire|dark|yellow', '充电座|1|plug|white|blue', '电压表|1|bulb|gunmetal|yellow', '电流计|1|bulb|dark|green',
      '应急灯|0|lantern|red|white', '汽车电瓶|1|battery|yellow|gunmetal|2|1', '风力叶片|2|fan|white|yellow|2|2', '小型蓄电池|1|battery|cloth|yellow'] },
    { code: 'nm', cat: 'part', vars: [['', 0, 1], ['重型', 1, 1.5], ['精密', 2, 2.4], ['二手', 0, 0.9]], base: [
      '光纤线圈|2|spool|glass|gold', '滤光片|3|plate|glass|blue', '镜头组|2|lens|dark|gold', '激光头|3|bulb|red|silver',
      '雷达天线罩|3|radiator|white|blue', '传送带段|1|tire|dark|yellow', '液压杆|2|pipe|gunmetal|yellow', '压力表|1|cog|gunmetal|yellow',
      '温控器|1|plate|white|red', '流量计|2|pipe|steel|blue', '减压阀|1|pump|copper|yellow', '止回阀|1|pump|silver|red',
      '压缩机|3|pump|gunmetal|blue|2|2', '冷凝管|2|pipe|copper|blue', '油泵|2|pump|dark|yellow|2|1', '风扇叶|1|fan|silver|gold',
      '散热器|2|radiator|copper|silver|2|1', '热管|2|pipe|copper|red', '鼓风机|2|fan|gunmetal|gold|2|1', '齿轮箱|3|cog|dark|yellow|2|2'] },
    { code: 'nn', cat: 'val', vars: [['', 0, 1], ['残缺', -1, 0.6], ['复刻', 1, 1.2], ['原版', 2, 2.2]], base: [
      '铜版画|2|papers|copper|gold', '瓷盘|2|bowl|white|blue', '银质餐具|2|bowl|silver|gold', '古钱币册|2|papers|gold|silver',
      '水彩小品|1|papers|white|red', '油纸伞|1|sack|cloth|red', '老唱片|1|disc|dark|gold', '黑胶唱片|2|disc|dark|red',
      '怀旧相框|1|plate|olive|gold', '雕花烟盒|2|crate|gold|red', '木雕摆件|1|crate|cloth|gold', '玉雕小象|3|crystal|green|white',
      '古董望远镜|2|lens|copper|silver|2|1', '老式相机|2|lens|dark|silver', '珐琅杯|2|pot|blue|gold', '金箔书签|2|papers|gold|red',
      '手绘地图|1|papers|cloth|blue', '老式打字机|2|crate|gunmetal|white|2|1', '旧电话机|1|tablet|olive|yellow', '留声机|2|cassette|copper|gold'] },
    { code: 'no', cat: 'mat', vars: [['', 0, 1], ['潮湿', -1, 0.7], ['优质', 1, 1.4], ['成捆', 0, 1.1]], base: [
      '种子包|0|sack|green|yellow', '药用植物干|0|herb|green|yellow', '菌菇干|0|herb|cloth|red', '蜂蜡块|0|brick|yellow|gold',
      '树脂琥珀块|2|crystal|yellow|gold', '鱼胶|0|canister|white|yellow', '干草捆|0|herb|yellow|olive|2|1', '木炭块|0|brick|dark|gunmetal',
      '竹片|0|plate|olive|cloth', '羊毛毡|0|papers|white|cloth', '棉花包|0|sack|white|silver', '橡胶块|0|brick|dark|red',
      '蚕丝卷|1|spool|white|gold', '麻绳卷|0|spool|cloth|yellow', '木料|0|crate|cloth|olive|2|1', '软木塞|0|plug|cloth|yellow',
      '海绵块|0|brick|yellow|white', '蜂巢|1|beads|yellow|olive', '藻类粉|1|vial|green|olive', '冰块|0|crystal|glass|white'] },
  ];

  // ── 生成
  const have = new Set(Object.values(D.ITEMS || {}).map(it => it.name));
  const added = []; let n = 0, skipped = 0;
  for (const F of FAMS) {
    F.base.forEach(line => {
      const f = line.split('|'), name0 = f[0], q0 = +f[1];
      const tpl = T2[f[2]] ? f[2] : 'brick', ramp0 = R[f[3]] ? f[3] : 'steel', acc0 = R[f[4]] ? f[4] : 'yellow';
      const w = +(f[5] || 1), h = +(f[6] || 1);
      F.vars.forEach(([pre, dq, vm], vi) => {
        const qq = q0 + dq; if (qq < 0 || qq > 5) return;
        if (vi > 0 && hash(name0 + vi) < 0.05) return; // 少数组合不出，别太整齐
        const nm = pre + name0;
        if (have.has(nm)) { skipped++; return; }
        have.add(nm);
        const k = hash(nm), h2 = hash(nm + '·2'), h3 = hash(nm + '·3');
        // 三成的件换一套主色（同样的外形看起来不一样）
        const a = h3 < 0.3 ? R[ALT[Math.floor(h3 / 0.3 * ALT.length)]] || R[ramp0] : R[ramp0];
        const b = R[acc0];
        const ov = h2 < 0.45 ? -1 : Math.floor((h2 - 0.45) / 0.55 * OVER.length);
        const v = Math.round(VQ[qq] * (0.7 + 0.6 * k) * (1 + (w * h - 1) * 0.2) * vm);
        const stack = w * h > 1 ? 1 : qq === 0 ? 10 : qq === 1 ? 5 : qq === 2 ? 3 : 1;
        const key = F.code + String(F.base.indexOf(line)).padStart(2, '0') + vi;
        D.ITEMS[key] = { name: nm, q: qq, v: Math.max(1, v), w, h, stack, cat: F.cat, art: 'x_' + key, gen: F.code };
        const mark = vi ? MARKS[vi - 1] : null;
        D.ITEM_ART['x_' + key] = p => {
          T2[tpl](p, a, b, k);
          if (ov >= 0) OVER[ov](p, a, b);
          if (mark) for (let j = 0; j < vi; j++) { p.rect(21, 2 + j * 3, 5, 2, '#0b0a14'); p.rect(22, 2 + j * 3, 4, 1, mark, 1); }
        };
        added.push(key); n++;
      });
    });
  }
  // 堆叠规则（和 items-ext.js 一样）：白色至少 10、绿色至少 5（占两格的也 5 个）、蓝色一格的至少 3
  for (const key of added) { const it = D.ITEMS[key], big = it.w * it.h > 2; if (big) continue; const min = it.q === 0 ? 10 : it.q === 1 ? 5 : it.q === 2 && it.w * it.h === 1 ? 3 : 1; if ((it.stack || 1) < min) it.stack = min; }
  D.ITEMS_GEN2 = n; D.ITEMS_GEN = (D.ITEMS_GEN || 0) + n; D.ITEMS_GEN2_SKIPPED = skipped;
  D.ITEMS_GEN2_KEYS = added;
})(D);
