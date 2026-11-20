/* Underdog · 第二批新近战 15 把（design/features/arsenal-2/design.md）：道钉锤、信号提灯、破窗锤、管钳、刺刀步枪、投斧、音叉刃、热熔锤、锚链、镜面刃、
   绞索、电容拳、蝴蝶刀、车钩、装填刀。
   用 melee.js 的工具（K.mel）：招牌重击加进 K.mel.HEAVY；普攻效果包住 K.meleeOnHit / K.meleeMul / K.meleeSwing；
   右键不是"点按 + 蓄力"的（刺刀步枪按住开枪、投斧再按瞬移）包住 K.meleeInput；装填刀的暴击走 K.preShot。
   手里拿着的样子加进 D.MeleeHold.LOOK（melee-hold.js 在后面加载，等加载完再加）。在 arsenal2-guns.js 之后、gear.js 之前加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, K = D.K || (D.K = {}), TAU = Math.PI * 2, M = K.mel, C = D.ST2_COL;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), hurt = (...a) => K.hurt(...a);
  const flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a);
  const isBoss = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss), isHuman = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].human);
  const alive = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.dormant && !e.hacked);
  const add = (k, o) => { o.price = D.CARD_VALUE[o.q]; D.CARDS[k] = o; };
  const W = (k, name, q, desc, melee) => add(k, { slot: 'melee', name, q, art: 'm_' + k, desc, melee });
  const has = (S, base) => { const L = S.raid && S.raid.load; return !!L && D.WSLOTS.some(k => L[k] && (D.cardBase ? D.cardBase(L[k]) : L[k]) === base); };

  // ── 1. 表
  W('spikemaul', '道钉锤', 1, '20 伤害。浮空的敌人挨近战 ×1.5。重击：把一根道钉砸进地面，40 像素内的敌人被震上半空 0.8 秒（首领不浮空）', { dmg: 20, cd: 0.45, range: 21, arc: 1.1, heavy: 'spike', kb: 60, col: '#e3c14a' });
  W('siglantern', '信号提灯', 1, '12 伤害，打中的敌人致盲 0.5 秒；停电的站里伤害 ×1.5，装着就照亮身边。重击：灯罩爆闪，一圈敌人全部致盲 2 秒', { dmg: 12, cd: 0.3, range: 19, arc: 1.2, heavy: 'flashbang', col: '#fff2c8', lamp: true });
  W('winbreaker', '破窗锤', 2, '16 伤害，每下让敌人最大耐久下降 8%（首领 2%），越硬的敌人越划算。重击：一下破碎 25%', { dmg: 16, cd: 0.4, range: 19, arc: 1.0, heavy: 'smash', col: '#e6fbff', shat: 0.08 });
  W('pipewrench', '管钳', 2, '15 伤害。打机器有 25% 几率拆下一个零件：给电容充一点，或者修自己 4 耐久；用它打死的机器多掉一件材料。重击：拧一把，打机器必拆零件', { dmg: 15, cd: 0.38, range: 19, arc: 1.0, heavy: 'twist', col: '#ff7a2e', wrench2: true });
  W('bayonet', '刺刀步枪', 3, '18 伤害，刺得远。自带 3 发子弹：右键按住不是蓄力而是开一枪（30 伤害、贯穿）；近战每打中一下装回 1 发', { dmg: 18, cd: 0.4, range: 30, arc: 0.6, mode: 'bayonet', col: '#c8cdda', bayo: true });
  W('hatchet', '投斧', 2, '22 伤害。重击把斧子扔向准星，扎在敌人或墙上；再按一次右键瞬移到斧子那里劈下（×2）。3 秒没按，斧子自己飞回来', { dmg: 22, cd: 0.42, range: 20, arc: 1.0, mode: 'hatchet', heavy: 'axethrow', col: '#ff5a2e' });
  W('tuningfork', '音叉刃', 3, '18 伤害，每一刀再震出共振波，打到刀够不着的 30 像素外、墙后面的敌人。重击：一圈声波穿墙打 60 像素', { dmg: 18, cd: 0.34, range: 21, arc: 1.15, heavy: 'sonicring', col: '#c4b0ff', fork: true });
  W('heatmaul', '热熔锤', 3, '24 伤害，每打中一下积一格热，满 5 格在地上留一摊熔池烧 4 秒。重击：一口气用掉全部热量，热越多熔池越大、越痛', { dmg: 24, cd: 0.5, range: 21, arc: 1.2, heavy: 'meltdown', col: '#ff8a2e', heatm: true });
  W('anchorchain', '锚链', 4, '30 伤害，出手慢。有动量：连着挥越来越快（最多快一倍），每一下带着你往前滑一步；停手 1 秒动量清零。重击：甩一整圈，动量越高越远越痛', { dmg: 30, cd: 0.7, range: 26, arc: 1.3, heavy: 'anchorspin', kb: 160, col: '#949fb6', anchor: true });
  W('mirrorblade', '镜面刃', 4, '20 伤害。每次完美闪避，在原地留一个分身，接下来 3 秒照着你的近战动作再砍一遍（最多 2 个）。重击：斩出一道镜光，原地也留下一个分身', { dmg: 20, cd: 0.3, range: 22, arc: 1.2, heavy: 'mirrorcut', col: '#c4fbff', mirror: true });
  W('garrote', '绞索', 2, '10 伤害，够不远。重击：从背后（或趁它看不见）勒住没发现你的敌人，无声处决，非首领直接击杀', { dmg: 10, cd: 0.25, range: 15, arc: 0.8, heavy: 'strangle', sneak: 3, col: '#a8653d' });
  W('capfist', '电容拳', 4, '14 伤害。把电容当弹药：每下花 5% 电容，伤害 ×2 并电到旁边一个敌人；电容空了就是普通拳头。重击：一口气放完全部电容，放多少打多重', { dmg: 14, cd: 0.3, range: 17, arc: 1.0, heavy: 'discharge', col: '#3ee8ff', cfist: true });
  W('butterfly', '蝴蝶刀', 1, '9 伤害，出手极快。闪避后 1.2 秒内的第一刀暴击 ×3，并且闪避冷却减半。重击：往前连划三刀', { dmg: 9, cd: 0.17, range: 17, arc: 1.0, heavy: 'tricut', sneak: 3, col: '#ff98a0', bfly: true });
  W('coupler', '车钩', 5, '26 伤害。重击把扇面里最近的两个敌人连接 3 秒：打其中一个，另一个吃同样的伤害；连着的一个死了，另一个吃自己剩余耐久的一半。首领只分走一半', { dmg: 26, cd: 0.5, range: 22, arc: 1.2, heavy: 'couple', kb: 120, col: '#e3c14a' });
  W('loaderknife', '装填刀', 2, '14 伤害。另一只手是枪时：近战每打中一下给它装 1 发（从背包里拿）；连砍 5 下以后，那把枪的下一枪暴击 ×2。重击：一刀装 3 发', { dmg: 14, cd: 0.28, range: 18, arc: 1.1, heavy: 'quickload', col: '#ffd860', loader: true });
  Object.assign(D.CARD_SHAPE, { spikemaul: [3, 2], siglantern: [2, 2], winbreaker: [2, 1], pipewrench: [3, 1], bayonet: [5, 1], hatchet: [2, 2], tuningfork: [3, 1], heatmaul: [3, 2], anchorchain: [3, 3], mirrorblade: [4, 1], garrote: [1, 2], capfist: [2, 2], butterfly: [2, 1], coupler: [3, 2], loaderknife: [2, 1] });

  // ── 2. 图（28×28）
  Object.assign(D.ITEM_ART, {
    m_spikemaul: p => { p.line(13, 26, 13, 12, '#5e3d36'); p.line(14, 26, 14, 12, '#3b2018'); p.box(4, 4, 20, 9, R.gunmetal, { r: 1 }); p.rect(4, 4, 4, 9, '#c8cdda'); p.box(21, 6, 6, 5, R.rust); p.line(26, 8, 27, 8, '#e3c14a', 1); p.rect(9, 6, 10, 1, '#949fb6'); },
    m_siglantern: p => { p.line(14, 2, 14, 6, '#646e86'); p.rect(10, 2, 8, 1, '#646e86'); p.box(8, 6, 12, 4, R.red, { r: 1 }); p.box(9, 10, 10, 11, R.glass, { r: 2 }); p.ell(14, 15, 3, 4, R.yellow, { spec: true }); p.rect(13, 13, 2, 4, '#fff2c8', 1); p.box(8, 21, 12, 4, R.dark, { r: 1 }); },
    m_winbreaker: p => { p.line(6, 26, 16, 10, '#ff3047'); p.line(7, 26, 17, 10, '#8f1d26'); p.box(13, 4, 10, 8, R.red, { r: 2 }); p.rect(22, 6, 3, 4, '#c8cdda'); p.px(25, 7, '#ffffff', 1); p.px(25, 8, '#e6fbff', 1); p.rect(3, 24, 5, 3, '#20263b'); },
    m_pipewrench: p => { p.line(5, 25, 18, 10, '#c82e3a'); p.line(6, 25, 19, 10, '#8f1d26'); p.box(15, 3, 9, 6, R.gunmetal, { r: 1 }); p.box(17, 9, 7, 4, R.silver); p.rect(15, 7, 4, 2, '#0b0a14'); for (let i = 0; i < 3; i++) p.px(18 + i * 2, 3, '#949fb6'); p.px(23, 10, '#ff7a2e', 1); },
    m_bayonet: p => { p.line(1, 22, 18, 10, '#8c5d3c'); p.line(2, 23, 19, 11, '#4a2f1f'); p.box(12, 9, 9, 5, R.gunmetal, { r: 1 }); p.line(20, 10, 27, 4, '#eef1f8', 1); p.line(20, 11, 27, 5, '#9aa1b4'); p.box(3, 21, 6, 4, R.cloth, { r: 1 }); p.px(15, 15, '#e3c14a'); },
    m_hatchet: p => { p.line(8, 26, 15, 6, '#8c5d3c'); p.line(9, 26, 16, 6, '#4a2f1f'); p.box(13, 3, 9, 8, R.red, { r: 1 }); p.rect(21, 3, 3, 9, '#dbe5fa'); p.px(23, 4, '#ffffff', 1); p.rect(7, 23, 4, 3, '#20263b'); },
    m_tuningfork: p => { p.box(4, 20, 5, 6, R.dark, { r: 1 }); p.line(8, 20, 13, 15, '#949fb6'); p.line(13, 15, 22, 4, '#c4b0ff', 1); p.line(15, 17, 25, 7, '#c4b0ff', 1); p.line(13, 15, 15, 17, '#c8cdda'); p.px(22, 4, '#ffffff', 1); p.px(25, 7, '#ffffff', 1); for (let i = 0; i < 2; i++) p.px(19 + i * 3, 9 + i, '#7a4ad8'); },
    m_heatmaul: p => { p.line(13, 26, 13, 13, '#5e3d36'); p.line(14, 26, 14, 13, '#3b2018'); p.box(4, 3, 20, 11, R.gunmetal, { r: 2 }); for (let i = 0; i < 5; i++) p.rect(6 + i * 3.5, 6, 2, 5, i < 3 ? '#ff7a2e' : '#5a2a10', i < 3 ? 1 : 0); p.rect(4, 12, 20, 2, '#ffb057', 1); },
    m_anchorchain: p => { for (let i = 0; i < 6; i++) p.ell(5 + i * 2, 4 + i * 2, 1.5, 1, R.silver); p.line(17, 14, 17, 25, '#646e86'); p.line(18, 14, 18, 25, '#3d4766'); p.rect(13, 15, 10, 2, '#949fb6'); p.line(10, 22, 17, 26, '#c8cdda'); p.line(25, 22, 18, 26, '#c8cdda'); p.ell(17.5, 12, 2.5, 2.5, R.gunmetal); },
    m_mirrorblade: p => { p.line(6, 22, 24, 4, '#ffffff', 1); p.line(7, 22, 25, 4, '#c4fbff', 1); p.line(8, 22, 25, 5, '#58a3bd'); p.rect(3, 20, 5, 4, R.silver[2]); p.ell(5, 24, 2, 2, R.glass, { spec: true }); p.px(14, 14, '#ffffff', 1); },
    m_garrote: p => { p.box(4, 3, 6, 5, R.cloth, { r: 1 }); p.box(17, 20, 6, 5, R.cloth, { r: 1 }); for (let i = 0; i < 14; i++) { const t = i / 13, x = 9 + t * 9 + Math.sin(t * 6) * 3, y = 7 + t * 14; p.px(x, y, i % 2 ? '#a8653d' : '#cf8a57'); } },
    m_capfist: p => { p.box(5, 8, 16, 13, R.blue, { r: 3 }); for (let i = 0; i < 4; i++) p.box(7 + i * 4, 4, 3, 5, R.silver, { r: 1 }); p.rect(8, 13, 10, 3, '#3ee8ff', 1); p.box(19, 12, 5, 7, R.dark, { r: 1 }); p.px(22, 14, '#c4fbff', 1); },
    m_butterfly: p => { p.box(3, 17, 10, 3, R.red, { r: 1 }); p.box(3, 21, 10, 3, R.red, { r: 1 }); p.line(12, 18, 24, 8, '#eef1f8', 1); p.line(12, 19, 24, 9, '#9aa1b4'); p.px(4, 18, '#ffd860'); p.px(4, 22, '#ffd860'); },
    m_coupler: p => { p.line(4, 25, 13, 16, '#646e86'); p.line(5, 25, 14, 16, '#3d4766'); p.box(11, 5, 13, 12, R.yellow, { r: 2 }); p.rect(19, 9, 6, 4, '#0b0a14'); p.box(21, 4, 4, 5, R.gunmetal); p.box(21, 13, 4, 5, R.gunmetal); p.rect(12, 7, 6, 1, '#fff3b0', 1); },
    m_loaderknife: p => { p.line(6, 22, 22, 6, '#dbe5fa'); p.line(7, 22, 23, 6, '#6f84b3'); p.rect(3, 20, 6, 5, R.olive[2]); for (let i = 0; i < 3; i++) p.rect(4 + i * 2, 21, 1, 3, '#e3c14a'); p.px(15, 13, '#ffd860', 1); p.px(19, 9, '#ffd860', 1); },
  });

  // ── 3. 手里拿着的样子（melee-hold.js 的 LOOK；它在后面加载）
  const blade = (p, x0, x1, y, w, ramp, edge) => { for (let x = x0; x <= x1; x++) { const ww = Math.min(w, x1 - x + 1); for (let j = 0; j < ww; j++) { const v = j === 0 ? 0.95 : j === ww - 1 ? 0.3 : 0.65; p.set(x, y + j, ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))]); } if (edge && ww > 1 && x < x1 - 1) p.set(x, y + ww - 1, edge, 1); } };
  const grip = (p, x0, x1, y, h, base, wrap) => { p.rect(x0, y, x1 - x0 + 1, h, base); if (wrap) for (let x = x0; x <= x1; x += 2) { p.px(x, y, wrap); p.px(x + 1, y + h - 1, wrap); } };
  const haft = (p, x0, x1, y, h, c0, c1) => { p.rect(x0, y, x1 - x0 + 1, h, c0); p.rect(x0, y, x1 - x0 + 1, 1, c1); };
  const LOOK2 = {
    spikemaul: { style: 'heavy', size: [30, 14, 5, 7], two: true, paint: p => { haft(p, 1, 20, 6, 2, '#3b2018', '#6a442c'); grip(p, 1, 6, 6, 2, '#1d212c', '#e3c14a'); p.box(19, 1, 7, 12, R.gunmetal, { r: 1 }); p.rect(19, 1, 2, 12, '#c8cdda'); p.box(25, 4, 4, 6, R.rust); } },
    siglantern: { style: 'slash', size: [20, 14, 3, 3], paint: p => { grip(p, 1, 6, 2, 2, '#20263b', '#646e86'); p.rect(6, 2, 3, 1, '#646e86'); p.box(9, 0, 9, 3, R.red, { r: 1 }); p.box(9, 3, 9, 9, R.glass, { r: 2 }); p.ell(13.5, 7.5, 2.5, 3, R.yellow, { spec: true }); p.rect(13, 6, 2, 3, '#fff2c8', 1); p.box(9, 11, 9, 3, R.dark); } },
    winbreaker: { style: 'heavy', size: [24, 11, 5, 5], paint: p => { haft(p, 1, 15, 4, 2, '#8f1d26', '#ff3047'); grip(p, 1, 5, 4, 2, '#20263b'); p.box(14, 0, 7, 10, R.red, { r: 2 }); p.rect(20, 3, 3, 4, '#c8cdda'); p.px(22, 4, '#ffffff', 1); } },
    pipewrench: { style: 'heavy', size: [28, 12, 5, 6], paint: p => { haft(p, 1, 19, 5, 3, '#8f1d26', '#c82e3a'); p.box(17, 0, 8, 5, R.gunmetal, { r: 1 }); p.box(19, 7, 7, 4, R.silver); p.rect(17, 5, 5, 2, '#0b0a14'); p.px(25, 8, '#ff7a2e', 1); } },
    bayonet: { style: 'thrust', ext: 4, size: [44, 11, 8, 5], two: true, paint: p => { p.box(1, 3, 10, 6, R.cloth, { r: 1 }); haft(p, 10, 26, 3, 3, '#4a2f1f', '#8c5d3c'); p.box(18, 2, 10, 5, R.gunmetal, { r: 1 }); p.rect(28, 3, 4, 2, '#646e86'); blade(p, 32, 42, 3, 2, R.silver, '#ffffff'); p.px(22, 7, '#e3c14a'); } },
    hatchet: { style: 'heavy', size: [24, 13, 4, 7], paint: p => { haft(p, 1, 17, 6, 2, '#4a2f1f', '#8c5d3c'); grip(p, 1, 5, 6, 2, '#20263b'); p.box(14, 1, 6, 9, R.red, { r: 1 }); p.rect(19, 0, 3, 12, '#dbe5fa'); p.px(21, 1, '#ffffff', 1); } },
    tuningfork: { style: 'slash', size: [34, 11, 5, 5], paint: p => { grip(p, 1, 7, 4, 3, '#151a29', '#7a4ad8'); p.box(8, 3, 4, 5, R.silver); blade(p, 12, 32, 1, 2, R.white, '#c4b0ff'); blade(p, 12, 32, 7, 2, R.white, '#c4b0ff'); } },
    heatmaul: { style: 'heavy', size: [30, 16, 5, 8], two: true, paint: p => { haft(p, 1, 19, 7, 2, '#2d3342', '#646e86'); p.box(18, 1, 10, 14, R.gunmetal, { r: 2 }); for (let y = 3; y < 13; y += 3) p.rect(27, y, 2, 2, '#ff7a2e', 1); p.rect(20, 4, 2, 8, '#ff8a2e', 1); } },
    anchorchain: { style: 'heavy', size: [34, 16, 4, 8], two: true, paint: p => { grip(p, 1, 6, 7, 3, '#20263b', '#949fb6'); for (let x = 7; x < 22; x += 3) { p.rect(x, 7, 2, 2, '#949fb6'); p.px(x, 7, '#c8cdda'); } p.rect(21, 7, 9, 2, '#646e86'); p.rect(21, 7, 9, 1, '#c8cdda'); p.line(29, 1, 29, 15, '#949fb6'); p.line(30, 1, 33, 3, '#c8cdda'); p.line(30, 15, 33, 13, '#c8cdda'); p.ell(22, 8, 1.5, 1.5, R.gunmetal); } }, // 甩出去的锚：画成重家伙（软兵器的头在 melee-hold.js 里是私有表）
    mirrorblade: { style: 'slash', size: [36, 9, 6, 4], paint: p => { grip(p, 1, 8, 3, 3, '#1d4a60', '#a6e2f0'); p.box(9, 1, 2, 7, R.silver); blade(p, 11, 34, 2, 3, R.glass, '#ffffff'); p.line(13, 2, 32, 2, '#ffffff', 1); } },
    garrote: { style: 'punch', size: [12, 7, 2, 3], paint: p => { p.box(0, 1, 5, 5, R.cloth, { r: 1 }); for (let x = 5; x < 12; x++) p.px(x, 3 + ((x >> 1) % 2), '#cf8a57'); } },
    capfist: { style: 'punch', size: [14, 12, 3, 6], paint: p => { p.box(0, 1, 11, 10, R.blue, { r: 3 }); for (let i = 0; i < 3; i++) p.box(9, 1 + i * 3.4, 4, 3, R.silver, { r: 1 }); p.rect(3, 4, 5, 3, '#3ee8ff', 1); } },
    butterfly: { style: 'slash', dual: true, size: [20, 7, 4, 3], paint: p => { grip(p, 1, 7, 2, 3, '#8f1d26', '#ffd860'); blade(p, 8, 18, 2, 2, R.silver, '#ff98a0'); } },
    coupler: { style: 'heavy', size: [28, 15, 5, 7], two: true, paint: p => { haft(p, 1, 15, 6, 3, '#2d3342', '#646e86'); p.box(14, 1, 10, 13, R.yellow, { r: 2 }); p.rect(20, 5, 6, 5, '#0b0a14'); p.box(22, 0, 4, 5, R.gunmetal); p.box(22, 10, 4, 5, R.gunmetal); } },
    loaderknife: { style: 'slash', size: [26, 8, 5, 3.5], paint: p => { grip(p, 1, 7, 2, 4, '#253017', '#e3c14a'); p.rect(8, 1, 1, 6, '#ffd860'); blade(p, 9, 24, 2, 3, R.silver, '#ffd860'); } },
  };
  function lookIn() { if (D.MeleeHold && D.MeleeHold.LOOK && !D.MeleeHold.LOOK.spikemaul) Object.assign(D.MeleeHold.LOOK, LOOK2); }
  if (typeof setTimeout === 'function') setTimeout(lookIn, 0);

  // ── 4. 普攻的效果
  const inArc = (S, m, e, er, ea, from) => { const p = from || S.player, dx = e.x - p.x, dy = (e.y - 4) - (p.y - 6), a = from && from.a != null ? from.a : S.player.aim; return Math.hypot(dx, dy) < D.mRange(m) + (er || 0) + e.r && Math.abs(D.angDiff(a, Math.atan2(dy, dx))) < D.mArc(m) + (ea || 0); };
  const front = (S, m, er, ea) => alive(S).filter(e => inArc(S, m, e, er, ea));
  const fxs = M.fxs, mhit = M.mhit, H = M.HEAVY;
  const cres = (S, m, a, arc, r, w, x, y) => fxs(S).push({ k: 'cres', x: x != null ? x : S.player.x, y: y != null ? y : S.player.y - 6, a, arc, r, dir: S.player.swingDir, t: 0.16, max: 0.16, col: m.col, w: w || 1.6 });
  const dark = S => !!((S.st && S.st.type === 'blackout') || S.darkT > 0);
  function wrenchPart(S, e) {
    const p = S.player; if (S.rng.chance(0.5)) { p.cap = Math.min(1, (p.cap || 0) + 0.06); text(S, e.x, e.y - 30, 'PART +CAP', P.c); } else { p.hp = Math.min(p.maxHp, p.hp + 4); text(S, e.x, e.y - 30, 'PART +4', P.g); }
    for (let i = 0; i < 5; i++) part(S, 'debris', e.x, e.y - 6, S.rng.range(-60, 60), S.rng.range(-80, -10), 0.6, S.rng.pick(['#949fb6', '#c8cdda', '#e3975a'])); sfx('pick');
  }
  function otherGun(S) { const R = S.raid, gk = D.gunKey(R); if (!gk) return null; return D.gunOf ? D.gunOf(R.pf, R.load[gk], R) : D.CARDS[R.load[gk]].gun; }
  function load1(S) { // 装填刀：从背包 / 子弹袋往手上那把枪的弹匣里装 1 发
    const p = S.player, R = S.raid, g = otherGun(S); if (!g || g.heat || g.scrap || p.reload > 0 || p.mag >= g.mag) return false;
    R.mag = p.mag; const got = D.loadMag(R, 1); p.mag = R.mag; return got > 0;
  }
  const mm0 = K.meleeMul; K.meleeMul = function (S, m) {
    let k = mm0 ? mm0(S, m) : 1; const p = S.player;
    if (m.lamp && dark(S)) k *= 1.5;
    if (m.cfist && (p.cap || 0) >= 0.05) { p.cap -= 0.05; k *= 2; p.cfistOn = true; } else if (m.cfist) p.cfistOn = false;
    if (m.bfly) { const dash = p.dodgeUntil != null ? p.dodgeUntil - 0.1 - D.SHELL.dashTime : -9; if (S.t - dash < 1.2 && p.bflyFor !== p.dodgeUntil) { p.bflyFor = p.dodgeUntil; k *= 3; p.bflyCrit = true; text(S, p.x, p.y - 32, 'FLICK', m.col, true); } else p.bflyCrit = false; }
    return k;
  };
  const oh0 = K.meleeOnHit; K.meleeOnHit = function (S, m, e, dmg, nth) {
    if (oh0) oh0(S, m, e, dmg, nth);
    const p = S.player;
    if (m.lamp && !e.dead) K.addBlind(S, e, 0.5);
    if (m.shat && !e.dead) K.addShatter(S, e, m.shat);
    if (m.wrench2) { if (!isHuman(e) && (e.dead || S.rng.chance(0.25))) wrenchPart(S, e); if (e.dead && !isHuman(e) && K.scatter) K.scatter(S, e.x, e.y, e.f, S.rng.pick(['scrap', 'screws', 'plastic']), 1); }
    if (m.bayo) p.bayoN = Math.min(3, (p.bayoN == null ? 3 : p.bayoN) + 1);
    if (m.cfist && p.cfistOn && !nth) { let nx = null, bd = 50; for (const o of alive(S)) if (o !== e) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; nx = o; } } if (nx) { hurt(S, nx, Math.round(dmg * 0.5), { kx: nx.x - e.x, ky: nx.y - e.y, kb: 40, col: P.c, elec: true, melee: true }); S.bolts.push({ pts: K.zig(S, e.x, e.y - 6, nx.x, nx.y - 6), t: 0.2 }); } sfx('zap'); }
    if (m.bfly && p.bflyCrit) { p.dashCd = (p.dashCd || 0) * 0.5; p.bflyCrit = false; }
    if (m.loader && !nth) { if (load1(S)) text(S, p.x, p.y - 26, '+1', P.Y); p.ldN = (p.ldN || 0) + 1; if (p.ldN >= 5 && otherGun(S) && !p.ldCrit) { p.ldCrit = true; text(S, p.x, p.y - 34, 'LOADED ×2', P.Y, true); sfx('chargeup'); } }
  };
  const sw0 = K.meleeSwing; K.meleeSwing = function (S, m, heavy, hits, kills) {
    if (sw0) sw0(S, m, heavy, hits, kills);
    const p = S.player, a = p.aim;
    // 音叉刃：共振波打到刀够不着的地方（也穿墙）
    if (m.fork) { const pw = M.power(S, m) * (heavy ? 1.6 : 0.6); let n = 0; for (const e of alive(S)) { const dx = e.x - p.x, dy = (e.y - 4) - (p.y - 6), d = Math.hypot(dx, dy); if (d >= D.mRange(m) + e.r && d < D.mRange(m) + 30 + e.r && Math.abs(D.angDiff(a, Math.atan2(dy, dx))) < D.mArc(m)) { n++; mhit(S, m, e, pw, { kx: dx, ky: dy, kb: 30, slash: false }); } } fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a, arc: D.mArc(m), r: D.mRange(m) + 30, dir: 1, t: 0.2, max: 0.2, col: m.col, w: 0.8 }); if (n) sfx('orb'); }
    // 热熔锤：积热，满 5 格留熔池
    if (m.heatm && hits && !heavy) { p.heat2 = (p.heat2 || 0) + 1; if (p.heat2 >= 5) { p.heat2 = 0; pool(S, p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 12, 24, M.power(S, m)); text(S, p.x, p.y - 32, 'MOLTEN', P.o, true); } }
    // 锚链：动量
    if (m.anchor && !heavy) { p.anc = S.t - (p.ancT || -9) < 1 + p.meleeCd ? Math.min(1, (p.anc || 0) + 0.2) : 0; p.ancT = S.t; p.meleeCd = m.cd * (1 - 0.5 * p.anc); p.vx += Math.cos(a) * (60 + 60 * p.anc); p.vy += Math.sin(a) * (60 + 60 * p.anc); if (p.anc >= 1) text(S, p.x, p.y - 32, 'MOMENTUM', m.col); }
    // 镜面刃：分身照着砍一遍
    if (m.mirror && S.clones) for (const c of S.clones) { const I = D.Input, ca = Math.atan2(I.wy - (c.y - 6), I.wx - c.x), from = { x: c.x, y: c.y, a: ca }, pw = M.power(S, m) * (heavy ? 1.6 : 0.7); for (const e of alive(S)) if (inArc(S, m, e, heavy ? 6 : 0, heavy ? 0.35 : 0, from)) mhit(S, m, e, pw, { kx: e.x - c.x, ky: e.y - c.y, kb: 80 }); cres(S, m, ca, D.mArc(m), D.mRange(m), 1.2, c.x, c.y - 6); }
  };
  // 装填刀：另一只手的下一枪 ×2
  const ps0 = K.preShot; K.preShot = function (S, g, cont) { let k = ps0 ? ps0(S, g, cont) : 1; const p = S.player; if (p.ldCrit && !cont) { p.ldCrit = false; p.ldN = 0; k *= 2; text(S, p.x, p.y - 30, 'CRIT', P.R, true); flashLight(S, p.x, p.y - 8, 60, P.Y, 1); } return k; };
  // 镜面刃：完美闪避留分身
  const pd0 = K.perfectDodge; K.perfectDodge = function (S) {
    const p = S.player, had = p.pdDone; pd0(S);
    if (!had && p.pdDone && has(S, 'mirrorblade')) { S.clones = (S.clones || []).filter(c => c.t > 0); if (S.clones.length >= 2) S.clones.shift(); S.clones.push({ x: p.x, y: p.y, t: 3, f: S.f }); text(S, p.x, p.y - 40, 'MIRROR', '#c4fbff', true); sfx('shield'); }
  };
  function pool(S, x, y, r, pw) { (S.pools = S.pools || []).push({ x, y, r, t: 4, f: S.f, tick: 0, dmg: Math.max(2, Math.round(pw * 0.15)) }); for (const e of alive(S)) if (Math.hypot(e.x - x, e.y - y) < r + e.r) hurt(S, e, Math.round(pw * 0.6), { kx: e.x - x, ky: e.y - y, kb: 60, col: P.o, melee: true }); ring(S, x, y, r, P.o); flashLight(S, x, y, r * 3, P.o, 1.3); addShake(S, 0.25); sfx('fire'); }

  // ── 5. 招牌重击
  Object.assign(H, {
    spike(S, m, pw) {
      const p = S.player, x = p.x + Math.cos(p.aim) * 16, y = p.y + Math.sin(p.aim) * 12; let n = 0;
      for (const e of alive(S)) if (Math.hypot(e.x - x, e.y - y) < 40 + e.r) { n++; mhit(S, m, e, pw * 1.2, { kx: e.x - x, ky: e.y - y, kb: 20, crit: true }); if (!e.dead) K.addAir(S, e, 0.8); }
      M.crack(S, x, y, 18); ring(S, x, y, 40, m.col); for (let i = 0; i < 10; i++) part(S, 'debris', x, y, S.rng.range(-80, 80), S.rng.range(-90, 0), 0.7, S.rng.pick(['#6a5a52', '#e3c14a'])); addShake(S, 0.45); S.stop = Math.max(S.stop, n ? 0.08 : 0.04); flashLight(S, x, y, 70, m.col, 1.2); sfx('slam');
    },
    flashbang(S, m, pw) {
      const p = S.player; let n = 0;
      for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < 70 + e.r && D.losClear(S.A, p.x, p.y - 6, e.x, e.y - 6)) { n++; mhit(S, m, e, pw * 0.8, { kx: e.x - p.x, ky: e.y - p.y, kb: 60 }); if (!e.dead) K.addBlind(S, e, 2); }
      ring(S, p.x, p.y - 6, 70, '#fff2c8'); ring(S, p.x, p.y - 6, 40, '#ffffff'); flashLight(S, p.x, p.y - 6, 160, '#fff2c8', 2.4); addShake(S, 0.2); if (n) text(S, p.x, p.y - 34, 'BLIND ×' + n, '#fff2c8', true); sfx('tink');
    },
    smash(S, m, pw) { const p = S.player; let n = 0; for (const e of front(S, m, 6, 0.3)) { n++; mhit(S, m, e, pw * 1.6, { kx: e.x - p.x, ky: e.y - p.y, kb: 160, crit: true }); if (!e.dead) { K.addShatter(S, e, 0.25); text(S, e.x, e.y - 34, 'SHATTER', C.shat, true); } } cres(S, m, p.aim, D.mArc(m) + 0.3, D.mRange(m) + 6, 2.2); addShake(S, 0.35); if (n) S.stop = Math.max(S.stop, 0.08); sfx('crit'); },
    twist(S, m, pw) { const p = S.player; for (const e of front(S, m, 6, 0.3)) { mhit(S, m, e, pw * 2, { kx: e.x - p.x, ky: e.y - p.y, kb: 120, crit: true }); if (!isHuman(e)) wrenchPart(S, e); } cres(S, m, p.aim, D.mArc(m) + 0.3, D.mRange(m) + 6, 2); addShake(S, 0.3); sfx('heavy'); },
    axethrow(S, m, pw) { const p = S.player, I = D.Input; if (p.axe) return; const a = p.aim, go = Math.max(30, Math.min(160, Math.hypot(I.wx - p.x, I.wy - p.y))); p.axe = { x: p.x, y: p.y - 6, a, d: 0, go, stuck: false, e: null, t: 3, spin: 0, pw, m }; sfx('throw'); },
    sonicring(S, m, pw) { const p = S.player; let n = 0; for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < 60 + e.r) { n++; mhit(S, m, e, pw * 1.3, { kx: e.x - p.x, ky: e.y - p.y, kb: 120 }); if (!e.dead) e.stun = Math.max(e.stun || 0, 0.4); } for (let i = 0; i < 3; i++) fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: p.aim, arc: Math.PI, r: 20 + i * 20, dir: 1, t: 0.2 + i * 0.06, max: 0.2 + i * 0.06, col: m.col, w: 1 }); flashLight(S, p.x, p.y - 6, 90, m.col, 1.2); addShake(S, 0.3); if (n) S.stop = Math.max(S.stop, 0.06); sfx('orb'); },
    meltdown(S, m, pw) { const p = S.player, h = p.heat2 || 0; p.heat2 = 0; pool(S, p.x + Math.cos(p.aim) * 16, p.y + Math.sin(p.aim) * 12, 16 + 5 * h, pw * (1 + 0.3 * h)); text(S, p.x, p.y - 34, 'MELTDOWN ' + h, P.o, true); },
    anchorspin(S, m, pw) { const p = S.player, k = p.anc || 0, r = 30 + 40 * k; let n = 0; for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < r + e.r) { n++; mhit(S, m, e, pw * (1 + k), { kx: e.x - p.x, ky: e.y - p.y, kb: 200 + 100 * k, crit: k >= 0.6 }); } fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: p.aim, arc: Math.PI, r, dir: 1, t: 0.24, max: 0.24, col: m.col, w: 2.4 }); p.anc = 0; addShake(S, 0.3 + 0.3 * k); if (n) S.stop = Math.max(S.stop, 0.08); sfx('slam'); },
    strangle(S, m, pw) {
      const p = S.player; let tgt = null, bd = D.mRange(m) + 12;
      for (const e of alive(S)) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x))) < 1) { bd = d; tgt = e; } }
      if (!tgt) { cres(S, m, p.aim, 0.6, D.mRange(m) + 4); sfx('swing'); return; }
      const behind = (p.x - tgt.x) * (tgt.face || 1) < 0, unseen = !tgt.aware || tgt.blindT > 0;
      if (unseen && (behind || tgt.blindT > 0) && !isBoss(tgt)) {
        hurt(S, tgt, tgt.hp + (tgt.shield || 0) + 1, { kx: tgt.x - p.x, ky: tgt.y - p.y, kb: 0, col: m.col, melee: true, noShield: true, dot: true });
        text(S, tgt.x, tgt.y - 32, 'SILENT', m.col, true); S.stop = Math.max(S.stop, 0.12); M.onKill(S); S.raid.crits = (S.raid.crits || 0) + 1; sfx('kill');
      } else { mhit(S, m, tgt, pw, { kx: tgt.x - p.x, ky: tgt.y - p.y, kb: 40 }); text(S, tgt.x, tgt.y - 30, 'SEEN', P[4]); }
    },
    discharge(S, m, pw) {
      const p = S.player, cap = Math.min(1, p.cap || 0); p.cap = 0; let n = 0;
      for (const e of front(S, m, 10, 0.4)) { n++; mhit(S, m, e, pw * (1 + 8 * cap), { kx: e.x - p.x, ky: e.y - p.y, kb: 120 + 200 * cap, crit: cap > 0.3, elec: true }); if (!e.dead && cap > 0.2) e.stun = Math.max(e.stun || 0, 0.4 + cap); S.bolts.push({ pts: K.zig(S, p.x, p.y - 8, e.x, e.y - 6), t: 0.25 }); }
      cres(S, m, p.aim, D.mArc(m) + 0.4, D.mRange(m) + 10, 1 + 2 * cap); ring(S, p.x, p.y - 6, 20 + 40 * cap, P.c); flashLight(S, p.x, p.y - 6, 60 + 100 * cap, P.c, 1 + cap); addShake(S, 0.2 + 0.4 * cap); text(S, p.x, p.y - 34, 'DISCHARGE ' + Math.round(cap * 100) + '%', P.c, true); if (n) S.stop = Math.max(S.stop, 0.06 + 0.06 * cap); sfx('zap');
    },
    mirrorcut(S, m, pw) {
      const p = S.player; for (const e of front(S, m, 8, 0.35)) mhit(S, m, e, pw * 1.6, { kx: e.x - p.x, ky: e.y - p.y, kb: 140, crit: true });
      cres(S, m, p.aim, D.mArc(m) + 0.35, D.mRange(m) + 8, 2.2); S.clones = (S.clones || []).filter(c => c.t > 0); if (S.clones.length >= 2) S.clones.shift(); S.clones.push({ x: p.x, y: p.y, t: 3, f: S.f });
      flashLight(S, p.x, p.y - 6, 80, m.col, 1.3); addShake(S, 0.25); text(S, p.x, p.y - 34, 'MIRROR', m.col, true); sfx('shield');
    },
    quickload(S, m, pw) {
      const p = S.player; let hits = 0; for (const e of front(S, m, 6, 0.3)) { hits++; mhit(S, m, e, pw * 1.5, { kx: e.x - p.x, ky: e.y - p.y, kb: 120, crit: true }); }
      let n = 0; if (hits) for (let i = 0; i < 3; i++) if (load1(S)) n++; if (n) text(S, p.x, p.y - 30, '+' + n, P.Y, true);
      cres(S, m, p.aim, D.mArc(m) + 0.3, D.mRange(m) + 6, 2); addShake(S, 0.2); sfx(hits ? 'heavy' : 'swing'); if (n) sfx('draw');
    },
    tricut(S, m, pw) { const p = S.player; p.mAct = { k: 'tricut', t: 0, n: 0, next: 0, m, pw }; p.meleeCd = 0.45; },
    couple(S, m, pw) {
      const p = S.player, c = alive(S).filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 80 + e.r && Math.abs(D.angDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x))) < 0.9).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2);
      for (const e of c) mhit(S, m, e, pw, { kx: e.x - p.x, ky: e.y - p.y, kb: 40, crit: true });
      const live2 = c.filter(e => !e.dead); if (live2.length === 2) K.addLink(S, live2[0], live2[1], 3); else text(S, p.x, p.y - 30, c.length ? 'NEED 2' : 'MISS', P[4]);
      cres(S, m, p.aim, 0.9, 80, 1.4); addShake(S, 0.25); sfx(c.length ? 'heavy' : 'swing');
    },
  });

  // ── 6. 右键的特殊用法：刺刀步枪按住开枪，投斧在外面时再按瞬移
  function bayoShot(S, m) {
    const p = S.player; if (p.bayoN == null) p.bayoN = 3;
    if (p.bayoN <= 0) { text(S, p.x, p.y - 28, 'EMPTY', P[4]); sfx('nope'); return; }
    p.bayoN--; const a = p.aim, ox = p.x + Math.cos(a) * 16, oy = p.y - 10 + Math.sin(a) * 7, dmg = Math.round(30 * M.power(S, m) / m.dmg);
    S.shots.push({ x: ox, y: oy, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.5, dmg, r: 2.5, hit: new Set(), col: P.Y, pierce: true });
    K.muzzle(S, ox, oy, a, P.Y, 1.2, 'line'); K.kick(S, a, 3); addShake(S, 0.25); S.recoil = Math.min(7, (S.recoil || 0) + 4); S.recoilA = a; p.lastShot = S.t; p.cloakT = 0; S.shotsFired++;
    K.alertAround(S, p.x, p.y, ((D.TUNE.sense || {}).shot || 180)); S.raid.noise += 2; sfx('snipe'); p.meleeCd = 0.35;
  }
  function axeStrike(S, m) {
    const p = S.player, A = p.axe; if (!A || !A.stuck) return;
    let tx = A.x, ty = A.y + 6; if (A.e && !A.e.dead) { const a = Math.atan2(A.e.y - p.y, A.e.x - p.x); tx = A.e.x - Math.cos(a) * (A.e.r + 6); ty = A.e.y - Math.sin(a) * (A.e.r + 6); }
    if (D.solidAt(S.A, tx, ty)) { const a = Math.atan2(ty - p.y, tx - p.x); tx -= Math.cos(a) * 8; ty -= Math.sin(a) * 8; }
    if (D.solidAt(S.A, tx, ty)) { p.axe = null; text(S, p.x, p.y - 28, 'BLOCKED', P[4]); return; }
    for (let i = 0; i < 6; i++) S.ghosts.push({ x: D.lerp(p.x, tx, i / 6), y: D.lerp(p.y, ty, i / 6), t: 0.2, flip: tx < p.x, col: m.col });
    p.x = tx; p.y = ty; p.vx = p.vy = 0; p.inv = Math.max(p.inv || 0, 0.25); let n = 0;
    for (const e of alive(S)) if (Math.hypot(e.x - p.x, e.y - p.y) < 30 + e.r) { n++; mhit(S, m, e, A.pw * 2, { kx: e.x - p.x, ky: e.y - p.y, kb: 180, crit: true }); }
    M.crack(S, p.x, p.y, 16); fxs(S).push({ k: 'cres', x: p.x, y: p.y - 6, a: p.aim, arc: Math.PI, r: 30, dir: 1, t: 0.2, max: 0.2, col: m.col, w: 2 }); addShake(S, 0.45); flashLight(S, p.x, p.y - 6, 80, m.col, 1.3); if (n) S.stop = Math.max(S.stop, 0.1); text(S, p.x, p.y - 32, 'CLEAVE', m.col, true); sfx('slam');
    p.axe = null; p.meleeCd = 0.35;
  }
  const mi0 = K.meleeInput; K.meleeInput = function (S, mel, inp, dt) {
    const p = S.player;
    if (mel.mode === 'bayonet') {
      if (inp.melee) { p.bayPress = S.t; p.bayFired = false; }
      if (inp.meleeHeld && p.bayPress != null) { if (!p.bayFired && S.t - p.bayPress > 0.22 && p.dashT <= 0) { p.bayFired = true; bayoShot(S, mel); } }
      else if (p.bayPress != null) { if (!p.bayFired && p.meleeCd <= 0 && p.dashT <= 0) K.melee(S, mel); p.bayPress = null; }
      return;
    }
    if (mel.mode === 'hatchet' && p.axe) { if (inp.melee) { if (p.axe.stuck) axeStrike(S, mel); } return; }
    return mi0(S, mel, inp, dt);
  };

  // ── 7. 每帧
  const step0 = K.meleeStep; K.meleeStep = function (S, dt) {
    if (step0) step0(S, dt);
    const p = S.player, A = p.mAct;
    if (A && A.k === 'tricut') {
      if (A.t >= A.next && A.n < 3) { A.n++; A.next += 0.08; p.swingDir *= -1; p.swingT = 0.1; M.dashTo(S, p.aim, Math.max(4, M.freeDist(S, p.x, p.y, p.aim, 14)), 420, 0); let h = 0; for (const e of front(S, A.m, 8, 0.2)) { h++; mhit(S, A.m, e, A.pw * 0.9, { kx: e.x - p.x, ky: e.y - p.y, kb: 30, crit: A.n === 3 }); } cres(S, A.m, p.aim + (A.n - 2) * 0.35, D.mArc(A.m), D.mRange(A.m) + 4, 1.2); sfx(h ? 'hit' : 'swing'); }
      if (A.n >= 3 && A.t >= A.next) p.mAct = null;
    }
    // 投斧
    const X = p.axe;
    if (X) {
      X.spin += dt * 24;
      const mid = D.melId(S.raid); if (!mid || (D.cardBase ? D.cardBase(mid) : mid) !== 'hatchet') p.axe = null;
      else if (!X.stuck) {
        const sp = 380, nx = X.x + Math.cos(X.a) * sp * dt, ny = X.y + Math.sin(X.a) * sp * dt; X.d += sp * dt;
        let hitE = null; for (const e of alive(S)) if (Math.hypot(e.x - nx, e.y - 6 - ny) < e.r + 5) { hitE = e; break; }
        if (hitE) { mhit(S, X.m, hitE, X.pw * 1.2, { kx: Math.cos(X.a), ky: Math.sin(X.a), kb: 60, crit: true }); X.stuck = true; X.e = hitE.dead ? null : hitE; X.x = hitE.x; X.y = hitE.y - 6; X.ox = 0; sfx('hit2'); }
        else if (D.solidAt(S.A, nx, ny + 6)) { X.stuck = true; sfx('tink'); for (let i = 0; i < 4; i++) part(S, 'spark', X.x, X.y, S.rng.range(-50, 50), S.rng.range(-50, 10), 0.2, P.Y); }
        else { X.x = nx; X.y = ny; if (X.d >= X.go) { X.stuck = true; sfx('tink'); } }
      } else {
        X.t -= dt; if (X.e) { if (X.e.dead) X.e = null; else { X.x = X.e.x; X.y = X.e.y - 6; } }
        if (X.t <= 0) { p.axe = null; text(S, p.x, p.y - 28, 'RETURN', P[4]); sfx('draw'); }
      }
    }
    // 熔池
    for (const w of S.pools || []) { w.t -= dt; w.tick -= dt; if (w.f !== S.f) continue; if (S.rng.chance(0.5)) part(S, 'spark', w.x + S.rng.range(-w.r, w.r) * 0.8, w.y + S.rng.range(-w.r, w.r) * 0.4, 0, S.rng.range(-40, -15), 0.4, S.rng.pick(['#ff8a2e', '#ffd84a'])); if (w.tick <= 0) { w.tick = 0.25; for (const e of alive(S)) if (Math.hypot((e.x - w.x), (e.y - w.y) / 0.6) < w.r + e.r) { e.burnT = Math.max(e.burnT || 0, 1.5); hurt(S, e, w.dmg, { dot: true, col: '#ff8a2e' }); } } }
    if (S.pools) S.pools = S.pools.filter(w => w.t > 0);
    // 镜面刃的分身
    if (S.clones) { for (const c of S.clones) { c.t -= dt; if (c.f === S.f && S.t % 0.05 < dt) S.ghosts.push({ x: c.x, y: c.y, t: 0.08, flip: D.Input.wx < c.x, col: '#c4fbff' }); } S.clones = S.clones.filter(c => c.t > 0); }
    // 信号提灯：装着就照亮身边
    if (has(S, 'siglantern') && p.hp > 0) S.tlights.push({ x: p.x, y: p.y - 10, r: dark(S) ? 80 : 50, col: '#ffe0a0', a: 0.8, decay: 60 });
    // 锚链：停手 1 秒动量清零
    if (p.anc > 0 && S.t - (p.ancT || 0) > 1 + 0.7) p.anc = 0;
    if (p.ldN > 0 && !has(S, 'loaderknife')) { p.ldN = 0; p.ldCrit = false; }
  };

  // ── 8. 画
  const draw0 = K.meleeDraw; K.meleeDraw = function (S, ctx, ex) {
    if (draw0) draw0(S, ctx, ex);
    lookIn();
    const p = S.player, X = p.axe;
    for (const w of S.pools || []) if (w.f === S.f) { const k = Math.min(1, w.t); ctx.save(); ctx.globalAlpha = 0.7 * k; ctx.fillStyle = '#2a1206'; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore(); ex.save(); ex.globalAlpha = 0.32 * k; ex.fillStyle = '#ff5a2e'; ex.beginPath(); ex.ellipse(w.x, w.y, w.r * 0.8, w.r * 0.45, 0, 0, TAU); ex.fill(); ex.globalAlpha = 0.4 * k; ex.fillStyle = '#ffb057'; ex.beginPath(); ex.ellipse(w.x - w.r * 0.15, w.y - 1, w.r * 0.45, w.r * 0.22, 0, 0, TAU); ex.fill(); ex.globalAlpha = 0.5 * k; ex.strokeStyle = '#ffd84a'; ex.lineWidth = 0.75; ex.beginPath(); ex.ellipse(w.x, w.y, w.r * (0.5 + 0.3 * ((S.t * 1.5) % 1)), w.r * (0.28 + 0.17 * ((S.t * 1.5) % 1)), 0, 0, TAU); ex.stroke(); ex.restore(); }
    if (X) { ctx.save(); ctx.translate(X.x, X.y); ctx.rotate(X.stuck ? X.a + 0.6 : X.spin); ctx.fillStyle = '#0b0a14'; ctx.fillRect(-6, -1.5, 10, 3); ctx.fillRect(2, -4, 5, 8); ctx.fillStyle = '#8c5d3c'; ctx.fillRect(-5, -0.5, 8, 1); ctx.fillStyle = '#c82e3a'; ctx.fillRect(3, -3, 3, 6); ctx.restore(); ex.fillStyle = '#ffffff'; ex.fillRect(X.x + Math.cos(X.stuck ? X.a + 0.6 : X.spin) * 5 - 0.5, X.y + Math.sin(X.stuck ? X.a + 0.6 : X.spin) * 5 - 0.5, 1, 1); if (X.stuck) { const k = (S.t * 3) % 1; ex.save(); ex.globalAlpha = 0.5 * (1 - k); ex.strokeStyle = '#ff5a2e'; ex.lineWidth = 0.75; ex.beginPath(); ex.arc(X.x, X.y, 5 + k * 8, 0, TAU); ex.stroke(); ex.restore(); } }
    const mid = S.raid && D.melId(S.raid), base = mid && (D.cardBase ? D.cardBase(mid) : mid);
    if (p.hp <= 0 || !base) return;
    const bar = (k, col, y) => { ctx.fillStyle = '#0b0a14'; ctx.fillRect(p.x - 8, p.y - (y || 30), 16, 3); ex.fillStyle = col; ex.fillRect(p.x - 7.5, p.y - (y || 30) + 0.5, 15 * Math.max(0, Math.min(1, k)), 2); };
    if (base === 'heatmaul' && p.heat2 > 0) for (let i = 0; i < 5; i++) { ctx.fillStyle = '#0b0a14'; ctx.fillRect(p.x - 8 + i * 3.4, p.y - 31, 3, 3); ex.fillStyle = i < p.heat2 ? (p.heat2 >= 4 ? '#ffd84a' : '#ff7a2e') : '#3b2018'; ex.fillRect(p.x - 7.5 + i * 3.4, p.y - 30.5, 2, 2); }
    if (base === 'anchorchain' && p.anc > 0) bar(p.anc, '#c8cdda');
    if (base === 'bayonet') { const n = p.bayoN == null ? 3 : p.bayoN; for (let i = 0; i < 3; i++) { ctx.fillStyle = '#0b0a14'; ctx.fillRect(p.x - 5 + i * 4, p.y - 31, 3, 4); ex.fillStyle = i < n ? P.Y : '#3d4766'; ex.fillRect(p.x - 4.5 + i * 4, p.y - 30.5, 2, 3); } }
    if (base === 'loaderknife' && (p.ldN > 0 || p.ldCrit)) bar(p.ldCrit ? 1 : (p.ldN || 0) / 5, p.ldCrit ? P.R : P.Y);
  };
})(D);
