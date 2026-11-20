/* Underdog · 第二批新枪 15 把（design/features/arsenal-2/design.md）：工牌信号枪、复合弓、高压水炮、焊枪、信号枪、铁轨钉发射器、磁化枪、拾荒霰弹、
   曝光枪、共振枪、回声枪、分距枪、记功步枪、脏弹炮、诱饵钉枪。
   挂钩同第一批（arsenal-guns.js）：包住 K.shootX（造子弹）、K.fireOwn（拾荒霰弹不走弹匣）、K.shotHit、K.armsPre / K.armsPost、K.meleeDraw；
   自己的弹体放 S.ap2（S.ap 归第一批，它会把不认识的弹体也当普通弹走一遍）。状态在 status2.js。在 status2.js 之后、gear.js 之前加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, K = D.K || (D.K = {}), TAU = Math.PI * 2, C = D.ST2_COL;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), hurt = (...a) => K.hurt(...a);
  const flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a);
  const isBoss = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss);
  const isHuman = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].human);
  const isElite = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].elite);
  const alive = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.dormant && !e.hacked);
  const add = (k, o) => { o.price = D.CARD_VALUE[o.q]; D.CARDS[k] = o; };
  const G = (k, name, q, art, desc, gun) => add(k, { slot: 'gun', name, q, art, desc, gun: Object.assign({ n: 1, spread: 0.04, noise: 1.2, life: 0.9 }, gun, { x: k }) });
  const MINE = new Set();
  const G2 = (k, ...a) => { MINE.add(k); G(k, ...a); };

  // ── 1. 表
  G2('badgegun', '工牌信号枪', 4, 'gun_badge', '不造成伤害。按住照一台低阶机器 1.5 秒把它骇入（精英 3 秒），它替你打 12 秒后过载自爆；首领和人类骇不动，最多同时骇 2 台', { cal: 'cell', dmg: 0, mag: 30, rate: 0.1, reload: 1.8, speed: 0, noise: 0.3, quiet: true });
  G2('compbow', '复合弓', 2, 'gun_bow', '按住拉弓，满弓 40 伤害、贯穿、几乎没声音；没拉满松手只有 8。边走边拉弓慢一半', { cal: 'nail', dmg: 40, mag: 6, rate: 0.35, reload: 1.4, speed: 560, charge: 0.9, noise: 0.15, quiet: true, life: 1 });
  G2('watercannon', '高压水炮', 2, 'gun_water', '持续水流，每秒约 10 伤害。把敌人推开并浸湿 4 秒：湿的敌人挨电 ×1.5、冻得快一倍，身上的火会被浇灭', { cal: 'fuel', dmg: 1.2, mag: 80, rate: 0.12, reload: 2, speed: 300, life: 0.35, spread: 0.12, noise: 0.6 });
  G2('weldtorch', '焊枪', 3, 'gun_weld', '射程很短，按住一直喷，每秒约 50 伤害。对着同一台机器焊 1.5 秒会熔穿：护盾清零、以后多吃 30% 伤害。打人类伤害减半', { cal: 'fuel', dmg: 4, mag: 50, rate: 0.08, reload: 1.8, speed: 0, noise: 0.5 });
  G2('flaregun', '信号枪', 1, 'gun_flare', '12 伤害，弹匣 1。照明弹打中会点燃；落地照亮一大片 8 秒，范围里的敌人隔墙显示、吃伤害 +20%', { cal: 'shell', dmg: 12, mag: 1, rate: 0.4, reload: 1.1, speed: 260, noise: 1.4 });
  G2('spikelauncher', '铁轨钉发射器', 4, 'gun_spike', '24 伤害，弹匣 4。打空的那一发钉进地里变成一根桩（最多 4 根，10 秒消失）：敌人走不过去、挡敌人的子弹，你的子弹打到桩会弹射', { cal: 'slug', dmg: 24, mag: 4, rate: 0.5, reload: 1.8, speed: 520, life: 0.45, noise: 1.8, kick: 3 });
  G2('magnetgun', '磁化枪', 3, 'gun_magnet', '6 伤害，弹匣 20。打中让敌人磁化 4 秒：两个磁化的敌人互相吸过去撞在一起（各吃 10、晕住），你的子弹会拐向磁化的敌人', { cal: 'cell', dmg: 6, mag: 20, rate: 0.16, reload: 1.6, speed: 420 });
  G2('scrapgun', '拾荒霰弹', 1, 'gun_scrap', '不用子弹：一发打掉背包里一件最便宜的白色材料，喷 6 枚碎片各 5 伤害。背包越满越能打，打掉的就没了', { cal: 'shell', dmg: 5, n: 6, mag: 1, rate: 0.55, reload: 1, speed: 380, spread: 0.5, life: 0.4, noise: 1.8, scrap: true });
  G2('flashgun', '曝光枪', 2, 'gun_flash', '4 伤害，扇形闪光。被闪到的敌人致盲 1.5 秒，看不见你、丢掉目标；开枪几乎没声音', { cal: 'cell', dmg: 4, mag: 10, rate: 0.6, reload: 1.6, speed: 0, noise: 0.1, quiet: true });
  G2('resonator', '共振枪', 4, 'gun_res', '不造成伤害，每发叠 1 层共振（最多 10 层）。之后一次 20 以上的伤害打到它，每层再炸 10，还震到旁边。配大伤害的近战或狙击', { cal: 'cell', dmg: 0, mag: 24, rate: 0.18, reload: 1.6, speed: 460, noise: 0.6 });
  G2('echogun', '回声枪', 3, 'gun_echo', '7 伤害，弹匣 20。每一发 1 秒后会在开枪的位置朝同一个方向再打一发回声；边打边走位能交叉火力', { cal: 'light', dmg: 7, mag: 20, rate: 0.15, reload: 1.5, speed: 440 });
  G2('rangegun', '分距枪', 3, 'gun_range', '弹匣 8。准星在 70 像素以内打霰弹（5 枚 × 6），更远打独头弹（28）。一把枪顾两头', { cal: 'rifle', dmg: 28, mag: 8, rate: 0.5, reload: 1.7, speed: 620, noise: 1.8 });
  G2('tallyrifle', '记功步枪', 2, 'gun_tally', '10 伤害，弹匣 10。这一趟每打死一个敌人，伤害 +1（最多 +20）；撤离或工壳损毁就清零', { cal: 'rifle', dmg: 10, mag: 10, rate: 0.35, reload: 1.6, speed: 640 });
  G2('dirtybomb', '脏弹炮', 5, 'gun_dirty', '20 伤害并爆炸，弹匣 3。爆炸处留下 5 秒辐射区：人类在里面每秒掉 6；机器不怕辐射，但在里面看不见东西', { cal: 'cell', dmg: 20, mag: 3, rate: 0.9, reload: 2.2, speed: 240, noise: 2.2 });
  G2('lurenail', '诱饵钉枪', 2, 'gun_lure', '5 伤害，弹匣 6。钉子钉在墙上、地上或敌人身上响 6 秒，把附近没发现你的敌人引过去查看', { cal: 'nail', dmg: 5, mag: 6, rate: 0.4, reload: 1.3, speed: 480, life: 0.8, noise: 0.3, quiet: true });
  Object.assign(D.CARD_SHAPE, { badgegun: [2, 1], compbow: [2, 4], watercannon: [4, 2], weldtorch: [3, 1], flaregun: [2, 1], spikelauncher: [5, 1], magnetgun: [3, 2], scrapgun: [4, 1], flashgun: [2, 2], resonator: [3, 2], echogun: [3, 1], rangegun: [4, 1], tallyrifle: [5, 1], dirtybomb: [4, 2], lurenail: [3, 1] });

  // ── 2. 图（28×28 画板，自动描黑边；光从左上来，发光的部分 emit）
  Object.assign(D.ITEM_ART, {
    gun_badge: p => { p.box(3, 10, 14, 7, R.gunmetal, { r: 2 }); p.box(17, 8, 8, 11, R.white, { r: 1 }); p.rect(19, 10, 4, 3, '#3ee8ff', 1); p.rect(19, 14, 4, 1, '#20263b'); p.rect(19, 16, 3, 1, '#20263b'); p.box(5, 17, 4, 7, R.dark); p.line(6, 10, 10, 5, '#e3c14a'); p.px(10, 5, '#e3c14a'); },
    gun_bow: p => { for (let i = 0; i <= 22; i++) { const y = 3 + i, x = 8 + Math.round(Math.sin(i / 22 * Math.PI) * 9); p.rect(x, y, 2, 1, i % 6 < 2 ? '#3d4766' : '#8c5d3c'); } p.line(8, 3, 8, 25, '#dbe5fa'); p.ell(15, 14, 2, 2, R.gunmetal); p.line(4, 14, 25, 14, '#c8cdda'); p.px(25, 14, '#ffffff', 1); p.px(24, 13, '#ffffff'); p.px(24, 15, '#ffffff'); p.rect(3, 13, 2, 3, '#ff3d8b'); },
    gun_water: p => { p.box(2, 12, 16, 7, R.blue, { r: 2 }); p.ell(8, 8, 5, 4, R.glass, { spec: true }); p.rect(18, 13, 7, 4, '#949fb6'); p.rect(25, 14, 2, 2, '#a6e2f0', 1); p.box(5, 19, 4, 6, R.dark); p.rect(4, 15, 12, 1, '#9cc4ff'); },
    gun_weld: p => { p.box(2, 12, 11, 6, R.copper, { r: 2 }); p.rect(13, 13, 9, 3, '#646e86'); p.line(22, 14, 26, 12, '#949fb6'); p.px(26, 12, '#ffd84a', 1); p.px(27, 11, '#ffffff', 1); p.box(4, 18, 4, 6, R.dark); p.ell(6, 9, 3, 3, R.red, { spec: true }); },
    gun_flare: p => { p.box(4, 10, 15, 7, R.red, { r: 3 }); p.ell(18, 13, 4, 4, R.gunmetal); p.ell(18, 13, 2, 2, R.dark); p.px(18, 13, '#ff7a2e', 1); p.box(6, 17, 5, 8, R.yellow, { r: 2 }); p.rect(8, 12, 7, 1, '#ff98a0'); },
    gun_spike: p => { p.box(1, 11, 21, 7, R.gunmetal, { r: 1 }); p.rect(22, 13, 5, 3, '#c8cdda'); p.rect(26, 12, 1, 5, '#ffffff'); p.box(4, 18, 6, 6, R.rust, { r: 1 }); for (let i = 0; i < 4; i++) p.rect(5 + i * 4, 9, 2, 3, '#e3c14a'); p.rect(3, 13, 16, 1, '#949fb6'); },
    gun_magnet: p => { p.box(2, 12, 13, 7, R.dark, { r: 2 }); p.box(15, 7, 10, 5, R.red, { r: 1 }); p.box(15, 17, 10, 5, R.red, { r: 1 }); p.rect(22, 7, 3, 5, '#c8cdda'); p.rect(22, 17, 3, 5, '#c8cdda'); p.rect(16, 13, 6, 3, '#ff3d8b', 1); p.box(5, 19, 4, 6, R.gunmetal); },
    gun_scrap: p => { p.box(1, 11, 22, 7, R.rust, { r: 1 }); p.rect(22, 11, 4, 7, '#5c3423'); p.box(8, 4, 10, 8, R.olive, { r: 2 }); p.px(10, 6, '#c8cdda'); p.px(13, 7, '#e3975a'); p.px(15, 5, '#949fb6'); p.box(4, 18, 6, 7, R.cloth, { r: 1 }); p.rect(25, 13, 2, 3, '#ffb057', 1); },
    gun_flash: p => { p.box(3, 11, 12, 8, R.white, { r: 2 }); p.box(15, 7, 9, 16, R.gunmetal, { r: 2 }); p.ell(20, 15, 3, 6, R.silver, { spec: true }); p.rect(21, 11, 2, 8, '#fff2c8', 1); p.box(5, 19, 4, 6, R.dark); },
    gun_res: p => { p.box(2, 11, 14, 8, R.magenta, { r: 2 }); for (let i = 0; i < 3; i++) p.ell(18 + i * 3, 15, 1 + i * 0.5, 4 + i, R.silver); p.px(24, 15, '#c4b0ff', 1); p.px(9, 14, '#c4b0ff', 1); p.box(5, 19, 4, 6, R.dark); },
    gun_echo: p => { p.box(2, 11, 18, 6, R.steel, { r: 2 }); p.rect(20, 12, 5, 3, '#949fb6'); p.box(5, 17, 4, 7, R.dark); p.rect(10, 9, 3, 2, '#3ee8ff', 1); p.rect(14, 9, 3, 2, D.mixHex ? D.mixHex('#3ee8ff', '#20263b', 0.5) : '#2f6e88'); p.px(26, 13, '#c4fbff', 1); },
    gun_range: p => { p.box(1, 11, 23, 6, R.olive, { r: 1 }); p.rect(24, 11, 3, 3, '#c8cdda'); p.rect(24, 15, 3, 2, '#949fb6'); p.box(4, 17, 6, 7, R.cloth, { r: 1 }); p.box(10, 7, 7, 4, R.gunmetal, { r: 1 }); p.px(16, 8, '#ff3047', 1); },
    gun_tally: p => { p.box(1, 12, 24, 5, R.cloth, { r: 1 }); p.rect(24, 13, 3, 2, '#949fb6'); p.box(3, 17, 6, 7, R.cloth, { r: 1 }); for (let i = 0; i < 5; i++) p.rect(6 + i * 3, 13, 1, 3, '#ffd860'); p.line(5, 15, 18, 14, '#ffd860'); p.box(12, 9, 8, 3, R.gunmetal); },
    gun_dirty: p => { p.box(2, 10, 17, 10, R.olive, { r: 3 }); p.ell(22, 15, 4, 4, R.yellow, { spec: true }); p.px(22, 15, '#0b0a14'); p.px(21, 13, '#0b0a14'); p.px(23, 13, '#0b0a14'); p.px(22, 17, '#0b0a14'); p.rect(4, 13, 12, 2, '#d0ff6a', 1); p.box(5, 20, 4, 6, R.dark); },
    gun_lure: p => { p.box(2, 11, 16, 6, R.yellow, { r: 2 }); p.rect(18, 12, 6, 3, '#c8cdda'); p.rect(24, 13, 3, 1, '#ffffff'); p.box(5, 17, 4, 7, R.dark); for (let i = 0; i < 3; i++) p.line(20 + i * 2, 8 - i, 22 + i * 2, 10 - i, '#ffd860', 1); },
  });

  // ── 2b. 拿在手上的样子（gun-look.js 的 D.GUN_LOOK；它在后面加载，等加载完再加）。枪口朝右画，size: [宽, 高, 握把 x, 握把 y]
  const tube = (p, x0, x1, y, h, ramp) => { for (let j = 0; j < h; j++) { const v = h === 1 ? 0.6 : 0.95 - 0.8 * j / (h - 1); p.rect(x0, y + j, x1 - x0 + 1, 1, ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))]); } };
  const handle = (p, x, y, h, col, dark) => { for (let j = 0; j < h; j++) p.rect(x - Math.floor(j / 2), y + j, 3, 1, j === h - 1 ? dark || col : col); if (dark) for (let j = 0; j < h; j++) p.px(x - Math.floor(j / 2) + 2, y + j, dark); };
  const GL2 = {
    badgegun: { kind: 'pistol', kick: 0.3, size: [20, 13, 6, 7], mz: [18, 4], paint: p => { p.box(2, 1, 11, 6, R.gunmetal, { r: 2 }); p.box(12, 0, 6, 8, R.white, { r: 1 }); p.rect(13, 2, 4, 2, '#3ee8ff', 1); p.rect(13, 5, 3, 1, '#20263b'); handle(p, 6, 7, 5, '#2d3342', '#1d212c'); p.line(3, 1, 6, -1, '#e3c14a'); } },
    compbow: { kind: 'rifle', kick: 0.4, size: [16, 30, 6, 15], fore: [6, 15], mz: [15, 15], paint: p => { for (let i = 0; i <= 28; i++) { const y = 1 + i, x = 3 + Math.round(Math.sin(i / 28 * Math.PI) * 7); p.rect(x, y, 2, 1, i % 7 < 2 ? '#3d4766' : '#8c5d3c'); } p.line(3, 1, 3, 29, '#dbe5fa'); p.rect(4, 14, 11, 1, '#c8cdda'); p.px(15, 14, '#ffffff', 1); p.rect(1, 13, 2, 3, '#ff3d8b'); } },
    watercannon: { kind: 'heavy', kick: 0.2, size: [34, 16, 10, 9], fore: [20, 9], mz: [33, 6], paint: p => { p.box(1, 4, 22, 7, R.blue, { r: 2 }); p.ell(9, 2.5, 5, 2.5, R.glass, { spec: true }); tube(p, 22, 32, 5, 3, R.silver); p.rect(32, 5, 2, 3, '#a6e2f0', 1); handle(p, 10, 11, 4, '#132a5a', '#0a1630'); p.rect(3, 6, 16, 1, '#9cc4ff'); } },
    weldtorch: { kind: 'pistol', kick: 0.1, size: [28, 13, 7, 7], mz: [27, 4], paint: p => { p.box(1, 2, 12, 6, R.copper, { r: 2 }); tube(p, 12, 23, 3, 3, R.gunmetal); p.line(23, 4, 26, 4, '#949fb6'); p.px(27, 4, '#ffd84a', 1); handle(p, 7, 8, 4, '#5a2a10', '#2a1206'); p.ell(4, 1, 2, 1.5, R.red); } },
    flaregun: { kind: 'pistol', kick: 1, size: [22, 14, 6, 7], mz: [21, 4], paint: p => { p.box(2, 1, 14, 6, R.red, { r: 3 }); tube(p, 15, 21, 2, 4, R.gunmetal); p.px(21, 3, '#ff7a2e', 1); handle(p, 6, 7, 6, '#c48d1f', '#5a3e0d'); p.rect(4, 2, 8, 1, '#ff98a0'); } },
    spikelauncher: { kind: 'heavy', kick: 2.6, size: [40, 14, 12, 8], fore: [24, 8], mz: [39, 5], paint: p => { p.box(1, 3, 28, 7, R.gunmetal, { r: 1 }); tube(p, 28, 38, 4, 3, R.silver); p.rect(38, 3, 2, 5, '#ffffff'); for (let i = 0; i < 4; i++) p.rect(6 + i * 5, 1, 2, 3, '#e3c14a'); handle(p, 12, 10, 4, '#5c3423', '#1f0f0c'); p.rect(3, 6, 22, 1, '#949fb6'); } },
    magnetgun: { kind: 'rifle', kick: 0.6, size: [32, 16, 10, 9], fore: [18, 9], mz: [31, 8], paint: p => { p.box(1, 5, 18, 6, R.dark, { r: 2 }); p.box(18, 1, 12, 5, R.red, { r: 1 }); p.box(18, 10, 12, 5, R.red, { r: 1 }); p.rect(27, 1, 3, 5, '#c8cdda'); p.rect(27, 10, 3, 5, '#c8cdda'); p.rect(20, 7, 8, 2, '#ff3d8b', 1); handle(p, 10, 11, 4, '#2d3342', '#1d212c'); } },
    scrapgun: { kind: 'rifle', kick: 2.2, size: [36, 16, 11, 9], fore: [20, 9], mz: [35, 6], paint: p => { p.box(1, 4, 24, 7, R.rust, { r: 1 }); tube(p, 24, 35, 5, 3, R.rust); p.box(10, 0, 10, 5, R.olive, { r: 2 }); p.px(12, 1, '#c8cdda'); p.px(15, 2, '#e3975a'); p.px(17, 1, '#949fb6'); handle(p, 11, 11, 4, '#4a2f1f', '#1b100b'); p.rect(34, 6, 2, 2, '#ffb057', 1); } },
    flashgun: { kind: 'pistol', kick: 0.4, size: [22, 16, 6, 9], mz: [21, 8], paint: p => { p.box(1, 4, 12, 6, R.white, { r: 2 }); p.box(12, 0, 9, 15, R.gunmetal, { r: 2 }); p.ell(17, 7.5, 2.5, 5.5, R.silver, { spec: true }); p.rect(18, 4, 2, 7, '#fff2c8', 1); handle(p, 6, 10, 5, '#2d3342', '#1d212c'); } },
    resonator: { kind: 'rifle', kick: 0.5, size: [32, 16, 10, 9], fore: [18, 9], mz: [31, 8], paint: p => { p.box(1, 4, 19, 8, R.magenta, { r: 2 }); for (let i = 0; i < 3; i++) p.ell(22 + i * 3.5, 8, 1 + i * 0.5, 3 + i * 1.2, R.silver); p.px(30, 8, '#c4b0ff', 1); p.px(9, 7, '#c4b0ff', 1); handle(p, 10, 12, 4, '#381443', '#1d0a22'); } },
    echogun: { kind: 'rifle', kick: 0.6, size: [30, 13, 9, 7], fore: [17, 7], mz: [29, 4], paint: p => { p.box(1, 2, 20, 6, R.steel, { r: 2 }); tube(p, 20, 28, 3, 2, R.gunmetal); p.rect(8, 0, 3, 2, '#3ee8ff', 1); p.rect(12, 0, 3, 2, '#2f6e88'); p.px(29, 4, '#c4fbff', 1); handle(p, 9, 8, 4, '#20263b', '#0c0e17'); } },
    rangegun: { kind: 'rifle', kick: 1.8, size: [36, 14, 11, 8], fore: [21, 8], mz: [35, 4], paint: p => { p.box(1, 3, 26, 6, R.olive, { r: 1 }); tube(p, 26, 35, 3, 2, R.silver); tube(p, 26, 33, 6, 2, R.gunmetal); p.box(12, 0, 8, 3, R.gunmetal, { r: 1 }); p.px(19, 1, '#ff3047', 1); handle(p, 11, 9, 4, '#4a2f1f', '#1b100b'); } },
    tallyrifle: { kind: 'rifle', kick: 1.6, size: [40, 12, 12, 7], fore: [24, 7], mz: [39, 4], paint: p => { p.box(1, 3, 28, 5, R.cloth, { r: 1 }); tube(p, 28, 39, 4, 2, R.gunmetal); for (let i = 0; i < 5; i++) p.rect(8 + i * 3, 4, 1, 3, '#ffd860'); p.box(14, 0, 9, 3, R.gunmetal); handle(p, 12, 8, 4, '#4a2f1f', '#1b100b'); } },
    dirtybomb: { kind: 'heavy', kick: 3, size: [36, 18, 11, 10], fore: [21, 10], mz: [35, 9], paint: p => { p.box(1, 3, 24, 11, R.olive, { r: 3 }); p.ell(29, 8.5, 5, 5, R.yellow, { spec: true }); p.px(29, 8, '#0b0a14'); p.px(28, 6, '#0b0a14'); p.px(30, 6, '#0b0a14'); p.px(29, 11, '#0b0a14'); p.rect(4, 6, 16, 2, '#d0ff6a', 1); handle(p, 11, 14, 3, '#253017', '#141a0e'); } },
    lurenail: { kind: 'pistol', kick: 0.5, size: [26, 13, 7, 7], mz: [25, 4], paint: p => { p.box(1, 1, 17, 6, R.yellow, { r: 2 }); tube(p, 17, 23, 3, 2, R.silver); p.rect(23, 3, 3, 1, '#ffffff'); handle(p, 7, 7, 5, '#2d3342', '#1d212c'); for (let i = 0; i < 3; i++) p.px(19 + i * 2, 0, '#ffd860', 1); } },
  };
  function lookIn() { if (D.GUN_LOOK && !D.GUN_LOOK.badgegun) Object.assign(D.GUN_LOOK, GL2); }

  // ── 3. 小工具
  const ap = S => S.ap2 || (S.ap2 = []);
  const wallAt = (S, x, y) => D.solidAt(S.A, x, y + 6);
  function ghit(S, e, dmg, o) {
    if (e.dead) return false;
    const m = K.shotMul ? K.shotMul(S, {}, e) : 1;
    hurt(S, e, Math.round(dmg * m * 10) / 10, Object.assign({ col: P.O, kb: 50 }, o));
    if (K.capGain && dmg > 0) K.capGain(S, D.SHELL.capPerDmg * dmg);
    S.player.meleeCd -= 0.05;
    return e.dead;
  }
  function rayHit(S, x, y, a, max, w) {
    let best = null, bd = max, end = max;
    for (let d = 0; d < max; d += 3) if (wallAt(S, x + Math.cos(a) * d, y + Math.sin(a) * d)) { end = d; break; }
    for (const e of alive(S)) { const dx = e.x - x, dy = e.y - 6 - y, along = dx * Math.cos(a) + dy * Math.sin(a); if (along < 0 || along > end) continue; const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)); if (perp < e.r + (w || 3) && along < bd) { bd = along; best = e; } }
    return { e: best, d: best ? bd : end };
  }
  // 拾荒霰弹打的废料：背包里白色（q0）材料，最便宜的先打
  D.scrapAmmo = function (R) {
    if (!R || !R.bag) return [];
    const ids = [...new Set(R.bag.items.map(x => x.id))].filter(id => { const it = D.ITEMS[id]; return it && it.cat === 'mat' && (it.q | 0) === 0; });
    return ids.sort((a, b) => D.ITEMS[a].v - D.ITEMS[b].v);
  };
  D.scrapCount = R => D.scrapAmmo(R).reduce((s, id) => s + D.Grid.count(R.bag, x => x === id), 0);
  // 这一趟的记功层数（S.raid 每趟新开，撤离 / 损毁就没了）
  const tally = S => (S.raid && S.raid.tally2) || 0;
  const flares = S => S.flares || (S.flares = []), stakes = S => S.stakes || (S.stakes = []), rads = S => S.rads || (S.rads = []), lures = S => S.lures || (S.lures = []);
  function addStake(S, x, y) {
    const st = stakes(S).filter(s => s.f === S.f); if (st.length >= 4) st[0].t = 0;
    S.stakes = stakes(S).filter(s => s.t > 0); S.stakes.push({ x, y, t: 10, f: S.f, pop: 0.2 });
    for (let i = 0; i < 6; i++) part(S, 'debris', x, y, S.rng.range(-60, 60), S.rng.range(-60, 0), 0.5, '#6a5a52');
    addShake(S, 0.12); sfx('slam');
  }
  function addFlare(S, x, y) { flares(S).push({ x, y, t: 8, f: S.f }); flashLight(S, x, y, 120, '#ff6a3a', 1.6); sfx('fire'); }
  function addLure(S, x, y, e) { lures(S).push({ x, y, t: 6, f: S.f, e, tick: 0 }); sfx('tink'); }
  function addRad(S, x, y) { rads(S).push({ x, y, r: 44, t: 5, f: S.f, tick: 0 }); }

  // ── 4. 造子弹
  const sx0 = K.shootX; K.shootX = function (S, g, c) {
    const k = g.x; if (!MINE.has(k)) return sx0 && sx0(S, g, c);
    const p = S.player, I = D.Input, a = c.a, dmg = g.dmg * c.tm, sp = g.speed;
    const shot = o => S.shots.push(Object.assign({ x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: g.life, dmg: Math.round(dmg * 10) / 10, r: 2, hit: new Set(), col: P.O }, o));
    const aimD = Math.min(220, Math.hypot(I.wx - p.x, I.wy - p.y));
    switch (k) {
      case 'badgegun': {
        const h = rayHit(S, c.ox, c.oy, a, 130, 4), e = h.e;
        p.badgeFx = { x0: c.ox, y0: c.oy, x1: c.ox + Math.cos(a) * h.d, y1: c.oy + Math.sin(a) * h.d, t: 0.12, on: !!(e && K.canHack(e)) };
        if (e && K.canHack(e)) {
          if (p.badgeE !== e || S.t - (p.badgeLast || -9) > 0.25) { p.badgeE = e; p.badgeT = 0; }
          p.badgeT += g.rate; p.badgeLast = S.t; const need = isElite(e) ? 3 : 1.5; e.hackProg = p.badgeT / need; e.stun = Math.max(e.stun || 0, 0.12);
          if (p.badgeT >= need) { K.addHack(S, e, 12); p.badgeE = null; p.badgeT = 0; e.hackProg = 0; }
        } else if (e && !p.badgeNoT) { text(S, e.x, e.y - 28, isHuman(e) ? 'HUMAN' : 'DENIED', P[4]); p.badgeNoT = 1; }
        break;
      }
      case 'compbow': {
        const lv = p.chgLv || 0; p.chgLv = 0; const full = lv >= g.charge * 0.98;
        shot({ dmg: Math.round((full ? dmg : dmg * 0.2) * 10) / 10, pierce: full, r: full ? 2.5 : 2, col: full ? '#ffffff' : '#c8cdda', arrow: true, vx: Math.cos(a) * sp * (full ? 1.2 : 0.7), vy: Math.sin(a) * sp * (full ? 1.2 : 0.7) });
        if (full) { text(S, p.x, p.y - 30, 'FULL DRAW', P.C); flashLight(S, c.ox, c.oy, 40, '#ffffff', 0.6); }
        sfx('throw'); break;
      }
      case 'watercannon': { const b = a + S.rng.range(-g.spread, g.spread); ap(S).push({ k: 'water', x: c.ox, y: c.oy, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, life: g.life, dmg, r: 3, hit: new Set(), col: C.wet }); if (S.rng.chance(0.6)) part(S, 'spark', c.ox, c.oy, Math.cos(b) * 160, Math.sin(b) * 160, 0.3, '#a6e2f0'); break; }
      case 'weldtorch': {
        const h = rayHit(S, c.ox, c.oy, a, 38, 4), e = h.e;
        p.weldFx = { x0: c.ox, y0: c.oy, x1: c.ox + Math.cos(a) * h.d, y1: c.oy + Math.sin(a) * h.d, t: 0.1 };
        if (e) {
          if (!isHuman(e)) { e.weldT = (S.t - (e.weldLast || -9) < 0.3 ? e.weldT || 0 : 0) + g.rate; e.weldLast = S.t; if (e.weldT >= 1.5 && !e.melt) { e.melt = true; e.shield = 0; e.shieldOff = true; text(S, e.x, e.y - 32, 'MELTED', P.o, true); ring(S, e.x, e.y - 6, e.r + 8, P.o); sfx('crit'); } }
          ghit(S, e, dmg * (isHuman(e) ? 0.5 : 1), { kx: Math.cos(a), ky: Math.sin(a), kb: 4, col: P.o, dot: true, noShield: e.melt });
          for (let i = 0; i < 2; i++) part(S, 'spark', e.x, e.y - 6, S.rng.range(-90, 90), S.rng.range(-110, 10), 0.3, S.rng.pick([P.Y, P.o, '#ffffff']));
        }
        break;
      }
      case 'flaregun': ap(S).push({ k: 'flare', x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.max(0.25, aimD / sp), dmg, r: 3, hit: new Set(), col: '#ff6a3a' }); break;
      case 'spikelauncher': ap(S).push({ k: 'rail', x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.min(g.life, Math.max(0.12, aimD / sp)), dmg, r: 3, hit: new Set(), col: '#e3c14a' }); break;
      case 'magnetgun': shot({ mag2: true, col: C.mag }); break;
      case 'flashgun': {
        const R0 = 92, half = 0.5; let n = 0;
        for (const e of alive(S)) { const dx = e.x - p.x, dy = e.y - 6 - (p.y - 6), d = Math.hypot(dx, dy); if (d < R0 + e.r && Math.abs(D.angDiff(a, Math.atan2(dy, dx))) < half && D.losClear(S.A, p.x, p.y - 6, e.x, e.y - 6)) { ghit(S, e, dmg, { kx: dx, ky: dy, kb: 20, col: C.blind }); K.addBlind(S, e, 1.5); n++; } }
        ap(S).push({ k: 'flashfx', x: c.ox, y: c.oy, a, life: 0.18, max: 0.18 }); flashLight(S, c.ox, c.oy, 110, '#fff2c8', 2); if (n) text(S, p.x, p.y - 30, 'FLASH ×' + n, C.blind); sfx('tink'); break;
      }
      case 'resonator': shot({ dmg: 0, res2: true, col: C.res, r: 2.5 }); break;
      case 'echogun': shot({ col: '#3ee8ff' }); (S.echoQ = S.echoQ || []).push({ t: S.t + 1, x: c.ox, y: c.oy, a, sp, dmg: Math.round(dmg * 10) / 10, life: g.life }); break;
      case 'rangegun':
        if (aimD < 70) { for (let i = 0; i < 5; i++) { const b = a + (i / 4 - 0.5) * 0.45; shot({ vx: Math.cos(b) * sp * 0.7, vy: Math.sin(b) * sp * 0.7, dmg: Math.round(6 * c.tm * 10) / 10, life: 0.28, col: P.o }); } addShake(S, 0.15); text(S, p.x, p.y - 28, 'SPREAD', P.o); }
        else { shot({ r: 3, col: P.Y, pierce: false }); text(S, p.x, p.y - 28, 'SLUG', P.Y); }
        break;
      case 'tallyrifle': shot({ dmg: Math.round((g.dmg + tally(S)) * c.tm * 10) / 10, col: tally(S) >= 10 ? P.R : P.O, r: tally(S) >= 10 ? 2.5 : 2 }); break;
      case 'dirtybomb': ap(S).push({ k: 'dirty', x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.max(0.3, aimD / sp), dmg, r: 4, hit: new Set(), col: '#d0ff6a' }); sfx('orb'); break;
      case 'lurenail': ap(S).push({ k: 'lure', x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.max(0.15, Math.min(g.life, aimD / sp)), dmg, r: 2, hit: new Set(), col: '#ffd860' }); break;
      default: shot({});
    }
  };

  // 拾荒霰弹：不走弹匣，一发吃掉背包里一件最便宜的白色材料
  const fo0 = K.fireOwn; K.fireOwn = function (S, g, cont) {
    if (!g.scrap) return fo0 ? fo0(S, g, cont) : false;
    const p = S.player, R = S.raid, ids = D.scrapAmmo(R);
    if (!ids.length) { if (!S.noAmmoT || S.t > S.noAmmoT) { S.noAmmoT = S.t + 1; text(S, p.x, p.y - 26, 'NO SCRAP', P.r); sfx('nope'); } p.fireCd = 0.3; return true; }
    const id = ids[0]; D.Grid.take(R.bag, id, 1);
    const a = p.aim, ox = p.x + Math.cos(a) * 12, oy = p.y - 11 + Math.sin(a) * 7, cols = ['#c8cdda', '#e3975a', '#949fb6', '#a8653d', '#ffd0a0'];
    for (let i = 0; i < g.n; i++) { const b = a + S.rng.range(-g.spread / 2, g.spread / 2), s = g.speed * S.rng.range(0.8, 1.1); S.shots.push({ x: ox, y: oy, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: g.life * S.rng.range(0.8, 1.1), dmg: g.dmg, r: 2, hit: new Set(), col: S.rng.pick(cols), scrapB: true }); }
    for (let i = 0; i < 4; i++) part(S, 'debris', ox, oy, Math.cos(a) * 90 + S.rng.range(-40, 40), Math.sin(a) * 90 + S.rng.range(-40, 10), 0.4, S.rng.pick(cols));
    p.fireCd = g.rate; p.lastShot = S.t; p.cloakT = 0; S.shotsFired++;
    K.muzzle(S, ox, oy, a, P.o, 1.6, 'cone'); K.kick(S, a, 4); addShake(S, 0.18); S.recoil = Math.min(7, (S.recoil || 0) + 3); S.recoilA = a;
    K.alertAround(S, p.x, p.y, ((D.TUNE.sense || {}).shot || 180)); S.raid.noise += g.noise; sfx('scatter');
    text(S, p.x, p.y - 30, '-SCRAP', P[5]);
    return true;
  };
  // HUD 显示"废料 N"；出发装弹匣时不往拾荒霰弹里装子弹。ammo.js 在后面加载，等全部脚本加载完再包
  const scrapIn = R => { const id = D.gunId(R), g = id && D.CARDS[id] && D.CARDS[id].gun; return !!(g && g.scrap); };
  function lateWrap() {
    lookIn();
    if (D.ammoText && !D.ammoText.a2) { const at0 = D.ammoText; D.ammoText = function (R, p) { if (scrapIn(R)) { const n = D.scrapCount(R); return { name: '废料', col: '#e3975a', line: '' + n, empty: n === 0 }; } return at0(R, p); }; D.ammoText.a2 = true; }
    if (D.loadMag && !D.loadMag.a2) { const lm0 = D.loadMag; D.loadMag = function (R, room) { if (scrapIn(R)) return 0; return lm0(R, room); }; D.loadMag.a2 = true; }
  }
  if (typeof setTimeout === 'function') setTimeout(lateWrap, 0);
  K.a2LateWrap = lateWrap;

  // 子弹打中
  const hit0 = K.shotHit; K.shotHit = function (S, s, e) {
    if (hit0) hit0(S, s, e);
    if (e.dead) return;
    if (s.mag2) K.addMag(S, e, 4);
    if (s.res2) { K.addRes(S, e, 1); if (e.res >= 10) text(S, e.x, e.y - 30, 'MAX', C.res); }
  };

  // ── 5. 每帧
  const pre0 = K.armsPre; K.armsPre = function (S, dt, inp, gun) {
    if (pre0) pre0(S, dt, inp, gun);
    lateWrap(); const p = S.player;
    if (gun && gun.x === 'compbow' && p.chg > 0 && p.chg < gun.charge && Math.hypot(p.vx || 0, p.vy || 0) > 20) p.chg = Math.max(0, p.chg - dt * 0.5); // 边走边拉慢一半
    if (gun && gun.scrap) { p.mag = 1; p.reload = 0; }
    if (p.badgeNoT > 0) p.badgeNoT -= dt;
    // 记功：这一趟的击毁数（只在装着记功步枪时记）
    const R = S.raid; if (R && R.load && D.WSLOTS.some(k => D.cardBase ? D.cardBase(R.load[k]) === 'tallyrifle' : R.load[k] === 'tallyrifle')) { if (S._tallyK == null) S._tallyK = S.kills; if (S.kills > S._tallyK) { const was = R.tally2 || 0; R.tally2 = Math.min(20, was + S.kills - S._tallyK); if (R.tally2 > was) text(S, p.x, p.y - 34, '+' + R.tally2, P.Y); } S._tallyK = S.kills; } else S._tallyK = S.kills;
  };
  const post0 = K.armsPost; K.armsPost = function (S, dt) {
    if (post0) post0(S, dt);
    const p = S.player;
    if (p.badgeFx) { p.badgeFx.t -= dt; if (p.badgeFx.t <= 0) p.badgeFx = null; }
    if (p.weldFx) { p.weldFx.t -= dt; if (p.weldFx.t <= 0) p.weldFx = null; }
    for (const e of S.enemies) if (e.hackProg > 0 && S.t - (p.badgeLast || -9) > 0.3) e.hackProg = 0;
    // 回声
    if (S.echoQ && S.echoQ.length) { for (const q of S.echoQ) if (S.t >= q.t) { q.done = true; S.shots.push({ x: q.x, y: q.y, vx: Math.cos(q.a) * q.sp, vy: Math.sin(q.a) * q.sp, life: q.life, dmg: q.dmg, r: 2, hit: new Set(), col: '#9fe9ff', echo: true }); ring(S, q.x, q.y, 6, '#3ee8ff'); if (S.rng.chance(0.5)) sfx('tink'); } S.echoQ = S.echoQ.filter(q => !q.done); }
    // 自己的弹体
    for (const s of ap(S)) {
      s.life -= dt;
      if (s.k === 'flashfx') continue;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.k === 'water') { // 水流：穿过一排敌人，每个只浇一次；撞墙溅开
        if (wallAt(S, s.x, s.y)) { s.life = 0; if (S.rng.chance(0.5)) part(S, 'spark', s.x, s.y, S.rng.range(-50, 50), S.rng.range(-60, 0), 0.3, '#a6e2f0'); continue; }
        for (const e of alive(S)) if (!s.hit.has(e) && Math.hypot(e.x - s.x, e.y - 6 - s.y) < e.r + s.r) { s.hit.add(e); hurt(S, e, s.dmg * (K.shotMul ? K.shotMul(S, {}, e) : 1), { kx: s.vx, ky: s.vy, kb: 5, col: C.wet, dot: true }); if (!e.dead) { K.addWet(S, e, 4); if (!isBoss(e) && e.kind !== 'turret') { const l = Math.hypot(s.vx, s.vy) || 1; e.vx += s.vx / l * 26; e.vy += s.vy / l * 26; } } }
        continue;
      }
      if (s.k === 'flare' && S.rng.chance(0.8)) part(S, 'spark', s.x, s.y, S.rng.range(-20, 20), S.rng.range(-20, 20), 0.3, S.rng.pick(['#ff6a3a', P.Y]));
      if (s.k === 'dirty' && S.rng.chance(0.6)) part(S, 'smoke', s.x, s.y, 0, -10, 0.4, '#a8d050');
      const wall = wallAt(S, s.x, s.y);
      let tgt = null; if (!wall) for (const e of alive(S)) if (!s.hit.has(e) && Math.hypot(e.x - s.x, e.y - 6 - s.y) < e.r + s.r) { tgt = e; break; }
      if (!wall && !tgt && s.life > 0) continue;
      const bx = wall ? s.x - s.vx * dt : s.x, by = wall ? s.y - s.vy * dt : s.y; s.life = 0;
      if (tgt) { s.hit.add(tgt); ghit(S, tgt, s.dmg, { kx: s.vx, ky: s.vy, kb: s.k === 'rail' ? 120 : 40, col: s.col, crit: s.k === 'rail' }); }
      if (s.k === 'flare') { if (tgt && !tgt.dead) tgt.burnT = Math.max(tgt.burnT || 0, 3); addFlare(S, bx, by); }
      else if (s.k === 'rail') { if (!tgt) addStake(S, bx, by); else { for (let i = 0; i < 4; i++) part(S, 'spark', s.x, s.y, S.rng.range(-60, 60), S.rng.range(-60, 20), 0.2, P.Y); } }
      else if (s.k === 'dirty') { for (const e of alive(S)) if (e !== tgt && Math.hypot(e.x - bx, e.y - by) < 30 + e.r) ghit(S, e, s.dmg * 0.7, { kx: e.x - bx, ky: e.y - by, kb: 130, col: '#d0ff6a' }); ring(S, bx, by, 32, '#d0ff6a'); K.deathBurst(S, bx, by, '#a8d050', 0.8); flashLight(S, bx, by, 90, '#d0ff6a', 1.4); addShake(S, 0.35); sfx('boom'); addRad(S, bx, by); }
      else if (s.k === 'lure') addLure(S, bx, by, tgt && !tgt.dead ? tgt : null);
    }
    S.ap2 = ap(S).filter(s => s.life > 0);
    // 信号弹：照亮、隔墙显示、+20% 伤害
    for (const F of flares(S)) { F.t -= dt; if (F.f !== S.f) continue; S.tlights.push({ x: F.x, y: F.y, r: 110 * Math.min(1, F.t), col: '#ff6a3a', a: 0.9, decay: 60 }); if (S.rng.chance(0.5)) part(S, 'spark', F.x + S.rng.range(-2, 2), F.y - 2, S.rng.range(-14, 14), S.rng.range(-50, -20), 0.4, S.rng.pick(['#ff6a3a', P.Y, '#ffffff'])); for (const e of S.enemies) if (!e.dead && e.f === F.f && Math.hypot(e.x - F.x, e.y - F.y) < 110) e.flareT = 0.2; }
    S.flares = flares(S).filter(F => F.t > 0);
    // 铁轨钉：敌人走不过去；敌人的子弹打上来就没了；你的子弹打上来弹开
    for (const st of stakes(S)) {
      st.t -= dt; if (st.pop > 0) st.pop -= dt; if (st.f !== S.f) continue;
      for (const e of S.enemies) if (!e.dead && e.f === st.f && !isBoss(e)) { let dx = e.x - st.x, dy = e.y - st.y, d = Math.hypot(dx, dy); if (d < 0.5) { dx = 1; dy = 0; d = 1; } const min = e.r + 5; if (d < min) { const nx = st.x + dx / d * min, ny = st.y + dy / d * min; if (!D.solidAt(S.A, nx, ny)) { e.x = nx; e.y = ny; } e.vx *= 0.3; e.vy *= 0.3; } }
      for (const s of S.eshots) if (s.life > 0 && Math.hypot(s.x - st.x, s.y + 6 - st.y - 4) < 6) { s.life = 0; for (let i = 0; i < 3; i++) part(S, 'spark', s.x, s.y, S.rng.range(-50, 50), S.rng.range(-50, 10), 0.2, P.Y); sfx('ding'); }
      for (const s of S.shots) if (s.life > 0 && s.stk !== st && Math.hypot(s.x - st.x, s.y + 6 - st.y - 4) < 6) { const nx = s.x - st.x, ny = s.y + 2 - st.y, l = Math.hypot(nx, ny) || 1, dot = (s.vx * nx + s.vy * ny) / l; s.vx -= 2 * dot * nx / l; s.vy -= 2 * dot * ny / l; s.stk = st; s.life = Math.max(s.life, 0.4); s.hit = new Set(); text(S, st.x, st.y - 16, 'RICOCHET', P.Y); sfx('tink'); }
    }
    S.stakes = stakes(S).filter(s => s.t > 0);
    // 辐射区：人类掉血，机器看不见
    for (const Z of rads(S)) { Z.t -= dt; Z.tick -= dt; if (Z.f !== S.f) continue; if (S.rng.chance(0.4)) part(S, 'smoke', Z.x + S.rng.range(-Z.r, Z.r), Z.y + S.rng.range(-Z.r * 0.5, Z.r * 0.5), 0, -8, 0.9, S.rng.pick(['#a8d050', '#6a8a30'])); const tick = Z.tick <= 0; if (tick) Z.tick = 0.5; for (const e of S.enemies) if (!e.dead && e.f === Z.f && Math.hypot(e.x - Z.x, e.y - Z.y) < Z.r + e.r) { if (isHuman(e)) { if (tick) hurt(S, e, 3, { dot: true, col: '#d0ff6a' }); } else { e.blindT = Math.max(e.blindT || 0, 0.3); e.blind = true; if (!isBoss(e) && !e.hacked && e.aware && S.rng.chance(0.02)) { e.aware = false; e.notice = 0; } } } }
    S.rads = rads(S).filter(Z => Z.t > 0);
    // 诱饵钉：每 0.5 秒把附近没发现你的敌人引过去
    for (const L of lures(S)) { L.t -= dt; L.tick -= dt; if (L.e) { if (L.e.dead) L.e = null; else { L.x = L.e.x; L.y = L.e.y - 6; } } if (L.f !== S.f || L.tick > 0) continue; L.tick = 0.5; ring(S, L.x, L.y, 10, '#ffd860'); for (const e of S.enemies) if (!e.dead && e.f === L.f && !e.aware && e !== L.e && Math.hypot(e.x - L.x, e.y - L.y) < 150) { e.invest = { x: L.x, y: L.y + 6, t: e.t + 3 }; e.notice = Math.max(e.notice || 0, 0.3); } }
    S.lures = lures(S).filter(L => L.t > 0);
  };

  // ── 6. 画
  const draw0 = K.meleeDraw; K.meleeDraw = function (S, ctx, ex) {
    if (draw0) draw0(S, ctx, ex);
    const p = S.player, gid = S.raid && D.gunId(S.raid), g = gid && D.CARDS[gid].gun;
    for (const s of ap(S)) {
      if (s.k === 'flashfx') { const k = s.life / s.max; ex.save(); ex.globalAlpha = 0.5 * k; ex.fillStyle = '#fff2c8'; ex.beginPath(); ex.moveTo(s.x, s.y); ex.arc(s.x, s.y, 92 * (1.2 - k * 0.2), s.a - 0.5, s.a + 0.5); ex.closePath(); ex.fill(); ex.restore(); continue; }
      if (s.k === 'rail') { ex.strokeStyle = '#e3c14a'; ex.lineWidth = 2; ex.beginPath(); ex.moveTo(s.x - s.vx * 0.015, s.y - s.vy * 0.015); ex.lineTo(s.x, s.y); ex.stroke(); continue; }
      if (s.k === 'water') { ex.save(); ex.globalAlpha = 0.5 * Math.min(1, s.life * 4); ex.fillStyle = '#a6e2f0'; ex.beginPath(); ex.arc(s.x, s.y, 2.5 + (1 - s.life / 0.35) * 2, 0, TAU); ex.fill(); ex.restore(); continue; }
      const col = s.col; ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 0.5, 0, TAU); ctx.fill(); ex.fillStyle = col; ex.beginPath(); ex.arc(s.x, s.y, s.r, 0, TAU); ex.fill();
    }
    for (const F of flares(S)) if (F.f === S.f) { ctx.fillStyle = '#0b0a14'; ctx.fillRect(F.x - 2, F.y - 3, 4, 4); ex.fillStyle = (S.t * 12 | 0) % 2 ? '#ff6a3a' : '#ffd84a'; ex.fillRect(F.x - 1.5, F.y - 2.5, 3, 3); ex.save(); ex.globalAlpha = 0.08 * Math.min(1, F.t); ex.fillStyle = '#ff6a3a'; ex.beginPath(); ex.ellipse(F.x, F.y, 110, 66, 0, 0, TAU); ex.fill(); ex.restore(); }
    for (const st of stakes(S)) if (st.f === S.f) { const h = 12 * (st.pop > 0 ? 1 - st.pop / 0.2 : 1), x = Math.round(st.x), y = Math.round(st.y), a = Math.min(1, st.t); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#0b0a14'; ctx.fillRect(x - 2.5, y - h - 1, 5, h + 2); ctx.fillStyle = '#646e86'; ctx.fillRect(x - 1.5, y - h, 3, h); ctx.fillStyle = '#c8cdda'; ctx.fillRect(x - 1.5, y - h, 1, h); ctx.fillStyle = '#e3c14a'; ctx.fillRect(x - 2.5, y - h - 1, 5, 2); ctx.fillStyle = '#2d3342'; ctx.fillRect(x - 4, y, 8, 1); ctx.restore(); }
    for (const Z of rads(S)) if (Z.f === S.f) { const k = Math.min(1, Z.t); ex.save(); ex.globalAlpha = 0.12 * k; ex.fillStyle = '#d0ff6a'; ex.beginPath(); ex.ellipse(Z.x, Z.y, Z.r, Z.r * 0.55, 0, 0, TAU); ex.fill(); ex.globalAlpha = 0.5 * k; ex.strokeStyle = '#d0ff6a'; ex.lineWidth = 0.75; ex.setLineDash([3, 3]); ex.lineDashOffset = S.t * 8; ex.stroke(); ex.setLineDash([]); ex.restore(); }
    for (const L of lures(S)) if (L.f === S.f) { const k = (S.t * 2) % 1; ex.save(); ex.globalAlpha = 0.6 * (1 - k); ex.strokeStyle = '#ffd860'; ex.lineWidth = 0.75; ex.beginPath(); ex.arc(L.x, L.y, 4 + k * 14, 0, TAU); ex.stroke(); ex.restore(); ex.fillStyle = '#ffd860'; ex.fillRect(L.x - 1, L.y - 1, 2, 2); }
    for (const s of S.shots) if (s.arrow) { const l = Math.hypot(s.vx, s.vy) || 1; ex.strokeStyle = s.col; ex.lineWidth = 1; ex.beginPath(); ex.moveTo(s.x - s.vx / l * 7, s.y - s.vy / l * 7); ex.lineTo(s.x, s.y); ex.stroke(); }
    if (p.badgeFx) { const b = p.badgeFx; ex.save(); ex.globalAlpha = 0.7; ex.strokeStyle = b.on ? C.hack : P[4]; ex.lineWidth = b.on ? 1.5 : 0.75; ex.setLineDash([2, 2]); ex.lineDashOffset = -S.t * 40; ex.beginPath(); ex.moveTo(b.x0, b.y0); ex.lineTo(b.x1, b.y1); ex.stroke(); ex.restore(); }
    if (p.weldFx) { const b = p.weldFx; ex.save(); ex.strokeStyle = P.o; ex.lineWidth = 3; ex.beginPath(); ex.moveTo(b.x0, b.y0); ex.lineTo(b.x1, b.y1); ex.stroke(); ex.strokeStyle = '#ffffff'; ex.lineWidth = 1; ex.stroke(); ex.restore(); }
    for (const e of S.enemies) if (e.hackProg > 0 && !e.dead && e.f === S.f) { ctx.fillStyle = '#0b0a14'; ctx.fillRect(e.x - 8, e.y - e.r * 2 - 16, 16, 3); ex.fillStyle = C.hack; ex.fillRect(e.x - 7.5, e.y - e.r * 2 - 15.5, 15 * Math.min(1, e.hackProg), 2); }
    if (!g || p.hp <= 0) return;
    if (g.x === 'compbow' && p.chg > 0) { const k = p.chg / g.charge; ctx.fillStyle = '#0b0a14'; ctx.fillRect(p.x - 8, p.y - 30, 16, 3); ex.fillStyle = k >= 0.98 ? '#ffffff' : P.C; ex.fillRect(p.x - 7.5, p.y - 29.5, 15 * k, 2); }
    if (g.x === 'tallyrifle' && tally(S) > 0) { ex.fillStyle = P.Y; for (let i = 0; i < Math.min(20, tally(S)); i++) ex.fillRect(p.x - 10 + (i % 10) * 2, p.y - 31 - (i >= 10 ? 2 : 0), 1, 1); }
    if (g.x === 'rangegun') { const I = D.Input, d = Math.hypot(I.wx - p.x, I.wy - p.y); ex.save(); ex.globalAlpha = 0.18; ex.strokeStyle = d < 70 ? P.o : P.Y; ex.lineWidth = 0.75; ex.setLineDash([2, 4]); ex.beginPath(); ex.arc(p.x, p.y - 6, 70, 0, TAU); ex.stroke(); ex.restore(); }
  };
})(D);
