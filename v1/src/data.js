/* 末班之后 · 小样：卡牌、敌人、改装件、遭遇表。调数值改这里。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';

  // type: atk 攻击（红）/ skl 技能（蓝）/ pwr 改写（金）/ sts 故障（灰）
  // v 是数值，up 是升级后覆盖的字段；desc 用 v 生成文字
  D.CARDS = {
    bolt:     { name: '点射',   type: 'atk', cost: 1, rar: 0, icon: 'bolt',    v: { dmg: 8 },  up: { v: { dmg: 12 } },  desc: v => `朝准星射出一发，造成 ${v.dmg} 伤害` },
    scatter:  { name: '散射',   type: 'atk', cost: 2, rar: 0, icon: 'scatter', v: { dmg: 4, n: 5 }, up: { v: { dmg: 4, n: 8 } }, desc: v => `扇形射出 ${v.n} 枚弹片，每枚 ${v.dmg} 伤害` },
    lunge:    { name: '突进斩', type: 'atk', cost: 1, rar: 0, icon: 'lunge',   v: { dmg: 10 }, up: { v: { dmg: 15 } },  desc: v => `向准星冲刺并斩击沿途，造成 ${v.dmg} 伤害。冲刺中无敌` },
    mine:     { name: '磁雷',   type: 'atk', cost: 1, rar: 0, icon: 'mine',    v: { dmg: 18 }, up: { v: { dmg: 26 } },  desc: v => `把磁雷丢到准星处，敌人靠近即爆，范围 ${v.dmg} 伤害` },
    arc:      { name: '电弧',   type: 'atk', cost: 2, rar: 1, icon: 'arc',     v: { dmg: 9, n: 3 }, up: { v: { dmg: 12, n: 4 } }, desc: v => `电击最近的敌人，并跳向另外 ${v.n - 1} 个，各 ${v.dmg} 伤害` },
    saw:      { name: '回旋锯', type: 'atk', cost: 2, rar: 1, icon: 'saw',     v: { dmg: 6 },  up: { v: { dmg: 9 } },   desc: v => `掷出锯片，去程回程都会切割，每次 ${v.dmg} 伤害` },
    rail:     { name: '穿甲',   type: 'atk', cost: 2, rar: 1, icon: 'rail',    v: { dmg: 22 }, up: { v: { dmg: 32 } },  desc: v => `蓄力 0.25 秒，射出贯穿一切的光束，${v.dmg} 伤害` },
    slam:     { name: '重锤',   type: 'atk', cost: 3, rar: 2, icon: 'slam',    v: { dmg: 24 }, up: { cost: 2 },          desc: v => `砸地：周围 ${v.dmg} 伤害，震退并眩晕 1.2 秒` },
    barrier:  { name: '护盾',   type: 'skl', cost: 1, rar: 0, icon: 'barrier', v: { sh: 10 },  up: { v: { sh: 15 } },   desc: v => `获得 ${v.sh} 护盾。护盾 3 秒后开始衰减` },
    salvage:  { name: '回收',   type: 'skl', cost: 1, rar: 0, icon: 'salvage', v: { n: 2 },    up: { cost: 0 },          desc: v => `抽 ${v.n} 张牌` },
    overclock:{ name: '过载',   type: 'skl', cost: 0, rar: 1, icon: 'over',    v: { e: 2, hurt: 3 }, up: { v: { e: 3, hurt: 3 } }, desc: v => `获得 ${v.e} 电量，自己受到 ${v.hurt} 伤害` },
    coolant:  { name: '冷却液', type: 'skl', cost: 1, rar: 1, icon: 'cool',    v: { t: 3 },    up: { v: { t: 5 } },     desc: v => `所有敌人减速一半，持续 ${v.t} 秒` },
    decoy:    { name: '诱饵',   type: 'skl', cost: 1, rar: 1, icon: 'decoy',   v: { t: 3 },    up: { v: { t: 5 } },     desc: v => `在原地留下全息诱饵，吸引火力 ${v.t} 秒` },
    calibrate:{ name: '校准',   type: 'pwr', cost: 1, rar: 2, icon: 'calib',   v: { d: 2 },    up: { v: { d: 3 } },     desc: v => `本场战斗，攻击牌伤害 +${v.d}。消耗`, exhaust: true },
    dynamo:   { name: '发电机', type: 'pwr', cost: 2, rar: 2, icon: 'dynamo',  v: { p: 35 },   up: { cost: 1 },          desc: v => `本场战斗，电量回复加快 ${v.p}%。消耗`, exhaust: true },
    jam:      { name: '卡壳',   type: 'sts', cost: 1, rar: 9, icon: 'jam',     v: {},          up: {},                   desc: () => `没有效果。打出后消耗`, exhaust: true },
  };
  D.TYPE_NAME = { atk: '攻击', skl: '技能', pwr: '改写', sts: '故障' };
  D.START_DECK = ['bolt', 'bolt', 'bolt', 'bolt', 'barrier', 'barrier', 'barrier', 'lunge', 'lunge', 'scatter'];

  // 实例化一张牌（带升级）
  D.card = function (id, up) {
    const b = D.CARDS[id], c = { id, up: !!up, name: b.name + (up ? '+' : ''), type: b.type, cost: b.cost, icon: b.icon, v: Object.assign({}, b.v), exhaust: !!b.exhaust };
    if (up) { if (b.up.cost != null) c.cost = b.up.cost; if (b.up.v) Object.assign(c.v, b.up.v); }
    c.desc = b.desc(c.v);
    return c;
  };

  D.RELICS = {
    recycler:  { name: '回收臂',   icon: 'recycler',  desc: '每击毁一台机器，回复 2 点耐久' },
    condenser: { name: '冷凝回路', icon: 'condenser', desc: '电量回复速度 +20%' },
    battery:   { name: '应急电池', icon: 'battery',   desc: '每场战斗开始时电量全满' },
    spring:    { name: '弹簧腿',   icon: 'spring',    desc: '闪避冷却缩短 40%' },
    magnet:    { name: '磁吸手',   icon: 'magnet',    desc: '战斗获得的零件 +30%' },
    edge:      { name: '锋刃改装', icon: 'edge',      desc: '所有攻击牌伤害 +1' },
    plating:   { name: '复合装甲', icon: 'plating',   desc: '耐久上限 +10' },
    capacitor: { name: '电容阵列', icon: 'capacitor', desc: '电量上限 +1' },
    relay:     { name: '旧中继',   icon: 'relay',     desc: '每打出 5 张牌，获得 6 护盾' },
  };

  D.PLAYER = { hp: 48, speed: 92, dashSpeed: 320, dashTime: 0.16, dashCd: 0.75, eMax: 4, eRegen: 1.05, hand: 4, reshuffle: 1.2, wrench: { dmg: 3, cd: 0.32, range: 16 } };

  // 敌人。intent 是它下一步要做的事，画在头上
  D.ENEMIES = {
    crawler: { name: '拾荒蛛', hp: 11, r: 6, speed: 58, gold: 4 },
    drone:   { name: '哨兵',   hp: 16, r: 6, speed: 36, gold: 5 },
    turret:  { name: '炮台',   hp: 24, r: 7, speed: 0,  gold: 6 },
    engineer:{ name: '工程机', hp: 80, r: 9, speed: 28, gold: 30, elite: true },
    boss:    { name: '钳工-9', hp: 300, r: 15, speed: 30, gold: 0, boss: true },
  };
  // 遭遇：按层数取
  D.ENCOUNTERS = {
    easy:  [['crawler', 'crawler', 'crawler'], ['drone', 'drone'], ['crawler', 'crawler', 'drone']],
    mid:   [['drone', 'drone', 'crawler', 'crawler'], ['turret', 'crawler', 'crawler', 'crawler'], ['turret', 'drone', 'drone'], ['crawler', 'crawler', 'crawler', 'crawler', 'drone']],
    elite: [['engineer'], ['engineer', 'crawler', 'crawler']],
    boss:  [['boss']],
  };

  // 站名（地图上用）
  D.STATION_NAMES = ['金庭广场', '南栈', '旧货街', '岚川大道', '水门', '机库口', '东堤', '纺织厂', '电台路', '青石桥', '北仓', '环城东', '冷库', '七号闸', '柳岸', '铸造坊', '中继塔', '星槎路', '白塔', '旧市府'];
})(D);
