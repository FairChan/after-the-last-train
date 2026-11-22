/* 末班之后 · 小样二：M5 内容扩充的数据和图。规则写在 arms.js（武器、模块、被动、消耗品）里，这里只放表和像素图。
   设计：design/features/content/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP;
  const add = (k, o) => { o.price = D.CARD_VALUE[o.q]; D.CARDS[k] = o; };

  // ── 5.1 枪（7 → 18）：每把一个别的枪没有的机制
  add('revolver', { slot: 'gun', name: '左轮', q: 1, art: 'gun_revolver', desc: '18 伤害，弹匣 6。打空弹匣的最后一发伤害 ×2', gun: { cal: 'rifle', dmg: 18, mag: 6, rate: 0.42, reload: 1.6, speed: 520, spread: 0.03, n: 1, noise: 1.4, lastx2: true } });
  add('dbarrel', { slot: 'gun', name: '双管猎枪', q: 1, art: 'gun_dbarrel', desc: '一发 9 枚弹片各 4 伤害，弹匣 2，后坐会把你往后推', gun: { cal: 'shell', dmg: 4, mag: 2, rate: 0.28, reload: 1.6, speed: 290, spread: 0.85, n: 9, life: 0.26, noise: 2.2, kick: 7 } });
  add('xbow', { slot: 'gun', name: '钉弩', q: 1, art: 'gun_xbow', desc: '20 伤害并贯穿，几乎没有声音，打一发换一发', gun: { cal: 'nail', dmg: 20, mag: 1, rate: 0.3, reload: 0.75, speed: 460, spread: 0.02, n: 1, pierce: true, noise: 0.15, quiet: true } });
  add('burst', { slot: 'gun', name: '三连发步枪', q: 2, art: 'gun_burst', desc: '点一下打三发，各 7 伤害；三发都打中同一个敌人，第三发 ×2', gun: { cal: 'light', dmg: 7, mag: 24, rate: 0.42, burst: 3, gap: 0.07, reload: 1.6, speed: 450, spread: 0.04, n: 1, noise: 1.1 } });
  add('ricochet', { slot: 'gun', name: '弹跳枪', q: 2, art: 'gun_ricochet', desc: '6 伤害，弹匣 18；子弹打到墙会反弹两次，能打到墙角后面', gun: { cal: 'light', dmg: 6, mag: 18, rate: 0.16, reload: 1.4, speed: 330, spread: 0.06, n: 1, bounce: 2, life: 1.2, noise: 1 } });
  add('hookgun', { slot: 'gun', name: '钩爪枪', q: 2, art: 'gun_hook', desc: '9 伤害，钩中敌人把它拽到你身前；首领和炮台拽不动，换成把你拽过去', gun: { cal: 'nail', dmg: 9, mag: 4, rate: 0.6, reload: 1.3, speed: 380, spread: 0.02, n: 1, pull: true, life: 0.6, noise: 0.8 } });
  add('flamer', { slot: 'gun', name: '喷火枪', q: 3, art: 'gun_flamer', desc: '短射程火流，穿透；着火的敌人 3 秒内每秒掉 4 耐久。用燃料', gun: { cal: 'fuel', dmg: 1.5, mag: 60, rate: 0.05, reload: 2, speed: 190, spread: 0.22, n: 1, life: 0.3, pierce: true, burn: 3, flame: true, noise: 1.2 } });
  add('gl', { slot: 'gun', name: '榴弹发射器', q: 3, art: 'gun_gl', desc: '榴弹抛到准星处爆炸，范围 26 伤害；离得太近会炸到自己', gun: { cal: 'shell', dmg: 26, mag: 4, rate: 0.7, reload: 2.2, speed: 300, spread: 0.02, n: 1, lob: true, boom: 30, noise: 2.4 } });
  add('emshot', { slot: 'gun', name: '电磁霰弹', q: 3, art: 'gun_emshot', desc: '5 枚弹片各 4 伤害；每枚让机器停摆 0.4 秒，打护盾 ×2', gun: { cal: 'cell', dmg: 4, mag: 6, rate: 0.5, reload: 1.7, speed: 330, spread: 0.45, n: 5, life: 0.34, emp: 0.4, noise: 1.6 } });
  add('minigun', { slot: 'gun', name: '转管机枪', q: 4, art: 'gun_minigun', desc: '4 伤害，弹匣 120。按住先转 0.8 秒才出弹，越打越快；开火时移速 -35%', gun: { cal: 'light', dmg: 4, mag: 120, rate: 0.11, reload: 3, speed: 420, spread: 0.1, n: 1, spin: 0.8, noise: 2 } });
  add('smart', { slot: 'gun', name: '追踪枪', q: 4, art: 'gun_smart', desc: '7 伤害，弹匣 20；子弹会拐向附近的敌人', gun: { cal: 'cell', dmg: 7, mag: 20, rate: 0.15, reload: 1.8, speed: 260, spread: 0.15, n: 1, homing: 7, life: 1.4, noise: 1.2 } });
  // 近战（5 → 10）
  add('baton', { slot: 'melee', name: '电击棍', q: 2, art: 'm_baton', desc: '13 伤害，每下让敌人停摆 0.5 秒，电容充得快。重击：电弧连到附近 3 个敌人', melee: { dmg: 13, cd: 0.3, range: 20, arc: 1.1, stun: 0.5, capMul: 1.6, heavy: 'chain', col: '#ffe066' } });
  add('axe', { slot: 'melee', name: '消防斧', q: 2, art: 'm_axe', desc: '30 伤害，扇面大，出手慢；砸墙 ×3。重击：跳劈到准星处，落地砸一圈并震晕', melee: { dmg: 30, cd: 0.62, range: 23, arc: 1.6, wallMul: 3, heavy: 'leap', col: '#ff4a3a' } });
  add('katana', { slot: 'melee', name: '武士刀', q: 3, art: 'm_katana', desc: '20 伤害，出手快，连砍第三刀 ×2。重击：居合冲刺，穿过一排敌人，斩线随后爆开；斩线杀敌就清掉冷却', melee: { dmg: 20, cd: 0.24, range: 24, arc: 1.25, combo: 3, heavy: 'iai', col: '#ff3d8b' } });
  add('drill', { slot: 'melee', name: '钻臂', q: 4, art: 'm_drill', desc: '26 伤害，无视护盾（工程机的正面盾也挡不住）。重击：钻住面前的敌人连打 6 下', melee: { dmg: 26, cd: 0.36, range: 19, arc: 0.9, noShield: true, heavy: 'bore', col: '#ffd84a' } });
  Object.assign(D.CARD_SHAPE, { revolver: [2, 1], dbarrel: [4, 1], xbow: [3, 1], burst: [4, 1], ricochet: [3, 1], hookgun: [3, 1], flamer: [4, 2], gl: [4, 2], emshot: [4, 1], minigun: [5, 2], smart: [3, 2], baton: [2, 1], axe: [3, 1], katana: [4, 1], drill: [3, 2] });
  D.CALIBER.fuel = { name: '燃料', unit: 0.25, pack: 60, art: 'ammo_fuel' };

  // ── 5.2 模块（6 → 14）
  add('nano', { slot: 'mod', name: '纳米修复', q: 1, icon: 'nano', desc: '3 秒内回复 15 耐久，不影响移动', cd: 14 });
  add('blink', { slot: 'mod', name: '闪现', q: 1, icon: 'blink', desc: '往准星方向瞬移 70 像素（不穿墙），瞬间无敌', cd: 5 });
  add('fog', { slot: 'mod', name: '烟雾', q: 2, icon: 'fog', desc: '准星处放一团烟 6 秒：烟里的敌人看不见你、乱打', cd: 15 });
  add('grapple', { slot: 'mod', name: '钩索', q: 2, icon: 'grapple', desc: '射出钩索，把自己拉向准星方向的墙或敌人', cd: 6 });
  add('sentry', { slot: 'mod', name: '自动炮台', q: 2, icon: 'sentry', desc: '身边放一座小炮台 10 秒，自动打最近的敌人（每发 4 伤害）', cd: 18 });
  add('wing', { slot: 'mod', name: '僚机', q: 3, icon: 'wing', desc: '一架小无人机绕着你飞 12 秒，打准星附近的敌人', cd: 20 });
  add('holo', { slot: 'mod', name: '全息分身', q: 3, icon: 'holo', desc: '放出一个往前走的分身吸引火力 5 秒，消失时炸一下（14 伤害）', cd: 14 });
  add('empmod', { slot: 'mod', name: '电磁脉冲', q: 4, icon: 'empm', desc: '身边 80 像素内的机器停摆 2 秒、护盾清零（对人类无效）', cd: 16 });
  // 被动（8 → 20）
  add('scav', { slot: 'pas', name: '拾荒手', q: 1, icon: 'scav', desc: '容器里多一件东西的几率 25%' });
  add('leech', { slot: 'pas', name: '吸能刃', q: 1, icon: 'leech', desc: '近战每打中一个敌人回复 1 耐久' });
  add('bigmag', { slot: 'pas', name: '扩容弹仓', q: 1, icon: 'bigmag', desc: '弹匣容量 +30%' });
  add('steady', { slot: 'pas', name: '稳定器', q: 2, icon: 'steady', desc: '枪的散布 -25%' });
  add('servo', { slot: 'pas', name: '伺服腿', q: 2, icon: 'servo', desc: '移速 +10%' });
  add('heatsink', { slot: 'pas', name: '散热片', q: 2, icon: 'heatsink', desc: '模块冷却 -25%' });
  add('shieldgen', { slot: 'pas', name: '护盾发生器', q: 3, icon: 'shieldgen', desc: '每进一站自带 12 护盾；完美闪避再给 6 护盾' });
  add('lucky', { slot: 'pas', name: '幸运星', q: 3, icon: 'lucky', desc: '搜出的东西品质升一档的几率 +6%' });
  add('deadeye', { slot: 'pas', name: '弱点识别', q: 3, icon: 'deadeye', desc: '打还没发现你的敌人，枪的伤害 ×1.5' });
  add('berserk', { slot: 'pas', name: '过载回路', q: 4, icon: 'berserk', desc: '耐久低于 30% 时，枪和近战伤害 +30%' });
  add('quietstep', { slot: 'pas', name: '静音靴', q: 2, icon: 'quietstep', desc: '敌人发现你慢 30%' });
  add('chaincap', { slot: 'pas', name: '连锁电容', q: 4, icon: 'chaincap', desc: '击毁机器时 35% 几率放一道电弧，打最近的敌人 10 伤害' });
  // 消耗品（7 → 10）
  Object.assign(D.USE, {
    smoke:   { name: '烟雾弹', q: 1, v: 40,  w: 1, h: 1, stack: 3, art: 'nade_smoke', throw: 'smoke', key: 'Z', desc: 'Z 扔向准星：放一团烟 6 秒，烟里的敌人看不见你' },
    flash:   { name: '闪光弹', q: 2, v: 55,  w: 1, h: 1, stack: 3, art: 'nade_flash', throw: 'flash', key: 'Z', desc: 'Z 扔向准星：范围内的敌人（包括人类）晕 1.5 秒' },
    bigcell: { name: '大号电池', q: 3, v: 110, w: 1, h: 2, stack: 2, art: 'bigcell', shield: 35, time: 0.8, key: 'V', desc: '读条 0.8 秒，获得 35 护盾（背包里没有护盾电池时按 V 用）' },
  });

  // ── 图：28×28 的物品图（sprite.js 的画笔）
  Object.assign(D.ITEM_ART, {
    gun_revolver: p => { p.box(4, 10, 12, 6, R.silver, { r: 1 }); p.ell(13, 14, 3, 3, R.gunmetal); p.rect(16, 11, 9, 3, '#c8cdda'); p.box(4, 15, 5, 9, R.cloth, { r: 2 }); p.px(5, 9, '#949fb6'); p.px(24, 11, '#eef1f8'); },
    gun_dbarrel: p => { p.box(2, 10, 23, 3, R.gunmetal, { r: 1 }); p.box(2, 13, 23, 3, R.gunmetal, { r: 1 }); p.box(1, 15, 8, 6, R.cloth, { r: 2 }); p.rect(24, 11, 2, 4, '#949fb6'); p.rect(12, 16, 4, 3, R.cloth[3]); },
    gun_xbow: p => { p.box(3, 13, 20, 3, R.cloth, { r: 1 }); p.line(18, 5, 18, 23, '#c8cdda'); p.line(19, 5, 19, 23, '#646e86'); p.line(18, 5, 10, 14, '#eef1f8'); p.line(10, 14, 18, 23, '#eef1f8'); p.rect(8, 14, 17, 1, '#ff7a2e', 1); p.box(6, 16, 4, 7, R.cloth, { r: 1 }); },
    gun_burst: p => { p.box(2, 10, 22, 6, R.olive, { r: 1 }); p.rect(24, 11, 3, 3, '#646e86'); p.box(12, 16, 4, 8, R.dark); p.box(6, 16, 4, 7, R.dark); for (let i = 0; i < 3; i++) p.px(8 + i * 3, 12, '#ffd84a', 1); },
    gun_ricochet: p => { p.box(3, 10, 18, 7, R.copper, { r: 2 }); p.rect(21, 12, 5, 3, '#ffd0a0'); p.line(6, 12, 18, 12, '#ffd84a', 1); p.px(25, 11, '#ffd84a', 1); p.px(26, 15, '#ffd84a', 1); p.box(6, 17, 4, 7, R.dark); },
    gun_hook: p => { p.box(3, 11, 16, 6, R.gunmetal, { r: 1 }); p.line(19, 10, 25, 8, '#c8cdda'); p.line(19, 17, 25, 19, '#c8cdda'); p.line(25, 8, 23, 13, '#c8cdda'); p.line(25, 19, 23, 14, '#c8cdda'); p.line(1, 13, 5, 13, '#e3c14a'); p.box(6, 17, 4, 7, R.cloth, { r: 1 }); },
    gun_flamer: p => { p.ell(7, 18, 5, 6, R.red, { spec: true }); p.box(8, 10, 15, 6, R.gunmetal, { r: 1 }); p.rect(23, 11, 4, 4, '#949fb6'); p.px(27, 12, '#ff7a2e', 1); p.px(26, 11, '#ffd84a', 1); p.box(14, 16, 4, 7, R.dark); },
    gun_gl: p => { p.box(2, 9, 18, 9, R.olive, { r: 3 }); p.box(18, 8, 8, 9, R.gunmetal, { r: 2 }); p.disc(24, 12, 2, '#0b0a14'); p.box(7, 18, 4, 7, R.dark); p.box(1, 12, 4, 6, R.olive, { r: 1 }); },
    gun_emshot: p => { p.box(1, 10, 23, 6, R.blue, { r: 2 }); for (let i = 0; i < 4; i++) p.rect(6 + i * 4, 9, 2, 8, '#ffd84a', 1); p.rect(24, 11, 3, 4, '#9cc4ff', 1); p.box(5, 16, 5, 8, R.dark); },
    gun_minigun: p => { for (let i = 0; i < 3; i++) p.rect(12, 9 + i * 3, 15, 2, '#949fb6'); p.box(3, 8, 11, 11, R.gunmetal, { r: 2 }); p.rect(26, 9, 2, 9, '#646e86'); p.box(5, 19, 5, 6, R.dark); p.line(3, 19, 0, 25, '#e3c14a'); },
    gun_smart: p => { p.box(2, 9, 20, 9, R.white, { r: 3 }); p.rect(6, 11, 7, 4, '#0b0a14'); p.rect(7, 12, 2, 2, '#ff3d8b', 1); p.rect(10, 12, 2, 2, '#3ee8ff', 1); p.rect(22, 11, 5, 4, '#3ee8ff', 1); p.box(6, 18, 4, 7, R.dark); },
    m_baton: p => { p.line(5, 23, 18, 10, '#3d4766'); p.line(6, 23, 19, 10, '#151a29'); p.box(16, 4, 8, 8, R.dark, { r: 2 }); p.line(18, 6, 22, 10, '#ffd84a', 1); p.line(22, 6, 18, 10, '#ffd84a', 1); p.rect(4, 22, 3, 3, '#ff3047'); },
    m_axe: p => { p.line(6, 25, 18, 6, '#c82e3a'); p.line(7, 25, 19, 6, '#8f1d26'); p.box(15, 2, 10, 9, R.silver, { r: 1 }); p.rect(24, 3, 2, 7, '#ffffff'); p.rect(15, 5, 3, 3, '#c82e3a'); },
    m_katana: p => { p.line(6, 21, 24, 3, '#eef1f8', 1); p.line(7, 21, 25, 3, '#9aa1b4'); p.line(7, 20, 23, 4, '#ff3d8b', 1); p.rect(4, 20, 4, 2, '#e3c14a'); p.line(1, 26, 5, 22, '#3d4766'); },
    m_drill: p => { p.box(3, 11, 10, 11, R.yellow, { r: 2 }); for (let i = 0; i < 12; i++) { const h = Math.max(1, 9 - Math.floor(i * 0.75)); p.rect(13 + i, 16 - (h >> 1), 1, h, i % 2 ? '#c8cdda' : '#9aa1b4'); } p.rect(5, 14, 6, 2, '#0b0a14'); },
    ammo_fuel: p => { p.box(7, 5, 14, 19, R.red, { r: 2 }); p.rect(10, 2, 5, 3, '#949fb6'); p.rect(9, 11, 10, 5, '#e3c14a'); p.px(13, 13, '#0b0a14'); p.px(14, 13, '#0b0a14'); },
    nade_smoke: p => { p.ell(14, 16, 7, 9, R.gunmetal, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); p.rect(8, 13, 12, 2, '#c8cdda'); p.rect(8, 18, 12, 1, '#c8cdda'); },
    nade_flash: p => { p.ell(14, 16, 7, 9, R.silver, { bias: 0.2 }); p.rect(11, 4, 6, 4, '#949fb6'); p.disc(14, 16, 3, '#fff3b0'); p.px(14, 16, '#ffffff', 1); },
    bigcell: p => { p.box(6, 3, 16, 22, R.dark, { r: 2 }); p.grad(9, 6, 10, 16, R.glass, 1); p.rect(10, 1, 8, 2, '#949fb6'); p.rect(12, 12, 4, 1, '#ffffff', 1); p.rect(12, 16, 4, 1, '#ffffff', 1); },
  });
  // 16×16 的卡面图标（art.js 的画笔）
  Object.assign(D.ICON_ART, {
    nano: g => { g.disc(8, 8, 5, P.G); g.rect(7, 4, 2, 8, P[6]); g.rect(4, 7, 8, 2, P[6]); g.px(2, 2, P.g); g.px(13, 3, P.g); g.px(3, 13, P.g); },
    blink: g => { g.line(2, 12, 6, 8, P.c); g.line(6, 8, 9, 10, P.c); g.line(9, 10, 14, 3, P.C, 2); g.disc(3, 12, 1, P.c); g.px(14, 2, P[6]); },
    fog: g => { g.disc(5, 10, 3, P[4]); g.disc(10, 9, 4, P[5]); g.disc(8, 6, 3, P[4]); g.px(10, 7, P[6]); },
    grapple: g => { g.line(2, 14, 11, 5, P.y); g.line(11, 5, 14, 2, P[6]); g.line(11, 5, 14, 8, P[6]); g.line(11, 5, 7, 2, P[6]); g.rect(1, 13, 3, 3, P[3]); },
    sentry: g => { g.rect(4, 10, 8, 3, P[3]); g.rect(6, 6, 5, 4, P[4]); g.rect(11, 7, 4, 2, P[5]); g.line(5, 13, 3, 15, P[3]); g.line(11, 13, 13, 15, P[3]); g.px(8, 7, P.r); },
    wing: g => { g.rect(5, 7, 6, 3, P[4]); g.line(1, 5, 5, 8, P[5]); g.line(14, 5, 10, 8, P[5]); g.px(8, 8, P.c); g.rect(7, 10, 2, 2, P[3]); g.px(1, 4, P.C); g.px(14, 4, P.C); },
    holo: g => { g.disc(5, 5, 2, P.m); g.rect(3, 8, 4, 6, P.m); g.disc(11, 5, 2, P.c); g.rect(9, 8, 4, 6, P.c); g.rect(0, 10, 16, 1, P[1]); },
    empm: g => { g.ring(8, 8, 6, P.y); g.line(9, 3, 6, 8, P.Y); g.line(6, 8, 10, 8, P.Y); g.line(10, 8, 7, 13, P.Y); },
    scav: g => { g.rect(3, 6, 10, 8, P.n); g.rect(3, 6, 10, 2, P.t); g.rect(7, 9, 2, 3, P.y); g.rect(12, 1, 1, 5, P.g); g.rect(10, 3, 5, 1, P.g); },
    leech: g => { g.line(3, 13, 12, 4, P[6], 2); g.disc(12, 11, 2, P.r); g.px(12, 8, P.R); g.rect(2, 12, 3, 3, P.o); },
    bigmag: g => { g.rect(4, 1, 8, 14, P[3]); g.rect(5, 2, 6, 12, P[2]); for (let j = 3; j < 14; j += 2) g.rect(5, j, 6, 1, P.y); g.rect(12, 6, 3, 1, P.g); g.rect(13, 5, 1, 3, P.g); },
    steady: g => { g.ring(8, 8, 5, P.c); g.px(8, 8, P.C); g.line(8, 1, 8, 4, P.c); g.line(8, 12, 8, 15, P.c); g.line(1, 8, 4, 8, P.c); g.line(12, 8, 15, 8, P.c); },
    servo: g => { g.rect(6, 1, 4, 6, P[4]); g.rect(5, 7, 6, 3, P.o); g.rect(6, 10, 4, 5, P[4]); g.px(8, 8, P.Y); g.line(11, 4, 14, 4, P.c); g.line(11, 12, 14, 12, P.c); },
    heatsink: g => { for (let i = 0; i < 5; i++) g.rect(2 + i * 3, 3, 2, 10, P[5]); g.rect(2, 12, 13, 2, P[3]); g.px(3, 2, P.c); g.px(9, 2, P.c); },
    shieldgen: g => { g.disc(8, 8, 5, P.c); g.disc(8, 8, 3, P[1]); g.rect(7, 1, 2, 3, P.C); g.px(8, 8, P.C); },
    lucky: g => { g.rect(7, 2, 2, 12, P.Y); g.rect(2, 7, 12, 2, P.Y); g.rect(5, 5, 6, 6, P.y); g.px(8, 8, P[6]); },
    deadeye: g => { g.ring(8, 8, 6, P.r); g.ring(8, 8, 3, P.r); g.px(8, 8, P.R); g.line(8, 0, 8, 3, P.R); g.line(8, 13, 8, 15, P.R); },
    berserk: g => { g.disc(8, 9, 6, P.r); g.rect(7, 4, 2, 6, P[6]); g.rect(7, 11, 2, 2, P[6]); },
    quietstep: g => { g.rect(4, 3, 5, 8, P[3]); g.rect(4, 10, 9, 3, P[4]); g.rect(4, 13, 10, 1, P[2]); g.line(11, 2, 15, 6, P.r); g.line(15, 2, 11, 6, P.r); },
    chaincap: g => { g.rect(2, 4, 4, 8, P[3]); g.rect(10, 4, 4, 8, P[3]); g.line(6, 8, 10, 8, P.c); g.line(7, 5, 9, 11, P.C); g.rect(3, 5, 2, 2, P.y); g.rect(11, 5, 2, 2, P.y); },
  });
})(D);
