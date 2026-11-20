/* Underdog：新首领一批（2026-11-18 用户："设计不同种类的Boss"）
   以前只有四个首领：撤离战追兵钳工-9，加三个只在危险等级 3 的虫巢 / 检查站 / 数据中心出的镇守首领。
   这一批六个首领，每个是一种不同的打法：
     穿山甲（钻地型）：钻到地下追着你、从脚下破土；吼一声天花板掉石头；冲撞撞墙会晕。
     钳与锤（双子型）：一快一慢两台一起上，锤给钳套盾；先倒下的那个 15 秒后会被重新拼起来，两个都打倒才算赢。
     主脑（阵地型）：不动，三座护盾塔没倒之前打不动；旋转光束、冲击波、放哨兵；塔全倒后瘫 8 秒，过后塔会重新长出来。
     老鸦（人类对手型）：回收者头子，你开枪他常常一滚躲开，近战贴身才稳；霰弹、手雷、烟雾弹里换位置，半血叫人。
     雷鸣（场地型）：特斯拉塔，地上导电区、电弧、追人的球形闪电；半血后全场放电，只有绿色绝缘垫里是安全的。
     鸢（空中型）：武装直升机，一条红线划过你、沿线俯冲一路炸开；火箭齐射、机炮，半血空投自爆蜂。
   出现在哪：每种站型配一两种（D.BX_AT），最深一层最大的房间；危险等级 3 必出（老的三个镇守首领那几种站照旧出老的），
   2 级六成，1 级要威胁 5 级起三成，0 级要威胁 8 级起两成。用自己的随机流，不动原来站里出怪的随机数。
   只靠挂钩接进去：K.spawnGuardBoss、K.intentX / stepX / startX / actX、K.foesPost、K.onKillX、K.hurt、D.initHiArt、D.drawFoe、D.drawExtras；
   foes.js 的战利品表开放成 D.BOSS_TROPHY，加了 e.noTrophy（双子先倒下的那个不掉战利品）。键一律 bx_ 开头。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const K = D.K || (D.K = {});
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const hitP = (S, dmg, src) => { const p = S.player; if (p && p.hp > 0) K.damagePlayer(S, dmg, src); };

  // ── 数据
  const BX = {
    bx_borer: { name: '穿山甲', hp: 720, r: 13, speed: 38, loot: 4, boss: true, cls: 'dig', tag: '钻地型首领：废隧道里的掘进机，钻到地下追着你',
      moves: ['钻地：钻进地下，土包追着你走，这时候打不到', '破土：土包停下抖一抖就要钻出来，赶紧跑开；钻出来一圈碎石往外飞', '落石：吼一声，天花板往下掉石头，看地上的影子躲', '冲撞：低头直冲，撞墙会晕一会儿，这时候打', '狂掘（半血）：连钻两次，落石更多'] },
    bx_pincer: { name: '钳', hp: 380, r: 8, speed: 72, loot: 3, boss: true, cls: 'twin', tag: '双子型首领：快的那台，两只大钳子',
      moves: ['剪击：贴上来连剪三下', '突进：蓄一下直线冲过来，撞墙会晕', '扑跳：跳到你身上', '双子：锤还活着，钳倒下 15 秒后会被重新拼起来；两个都打倒才算赢', '悲鸣：另一个倒下后，剩下的那个动作快很多'] },
    bx_hammer: { name: '锤', hp: 520, r: 11, speed: 24, loot: 3, boss: true, cls: 'twin', tag: '双子型首领：慢的那台，扛着一把大锤',
      moves: ['震地：锤子砸地，一圈圈冲击波往外推，闪避穿过去', '迫击炮：三连抛射，落点有圈', '护甲：给钳套一层护盾', '双子：钳还活着，锤倒下 15 秒后会被重新拼起来', '悲鸣：另一个倒下后，剩下的那个动作快很多'] },
    bx_core: { name: '主脑', hp: 640, r: 12, speed: 0, loot: 4, boss: true, cls: 'fort', tag: '阵地型首领：管这片线路的机器主脑，自己不会动',
      moves: ['护盾塔：三座护盾塔连着主脑，塔没全倒之前主脑打不动', '旋转光束：两道（半血后三道）光束绕着主脑转，顺着它转的方向跑', '冲击波：一圈圈往外推，闪避穿过去', '放哨兵：一次放出两架哨兵', '护盾破了：塔全倒后主脑瘫 8 秒、挨打更疼，过后塔会重新长出来', '过载（半血）：多一招螺旋弹幕'] },
    bx_node: { name: '护盾塔', hp: 70, r: 6, speed: 0, loot: 0, sight: 200, tag: '主脑的护盾塔', moves: ['供盾：活着就给主脑供护盾', '电击：偶尔放一道弱电'] },
    bx_crow: { name: '老鸦', hp: 440, r: 6, speed: 74, loot: 4, boss: true, human: true, cls: 'rival', tag: '人类对手型首领：回收者的头子，打了二十年仗',
      moves: ['翻滚：你开枪时他常常就地一滚躲开；近战贴身他来不及滚', '霰弹：近距离一扇弹丸', '手雷：扔到你走位的前面', '烟雾弹：扔一颗烟，在烟里换个地方，从侧面出来', '叫人（半血）：吹一声口哨，两个回收者来帮忙', '连环雷（半血）：一次扔三颗'] },
    bx_storm: { name: '雷鸣', hp: 580, r: 12, speed: 28, loot: 4, boss: true, cls: 'field', tag: '场地型首领：会走路的特斯拉塔，整片地都是它的',
      moves: ['导电区：地上亮起几个圈，亮完就放电', '电弧：瞄你一会儿，一道电打过来（闪避能躲）', '球形闪电：放出几颗慢慢追你的电球', '全场放电（半血）：蓄电的时候地上会出绿色的绝缘垫，站进去，不然整片挨电'] },
    bx_kite: { name: '鸢', hp: 520, r: 13, speed: 62, loot: 4, boss: true, cls: 'air', tag: '空中型首领：回收者改出来的武装直升机',
      moves: ['扫射俯冲：一条红线划过你，它沿着红线飞过去，身后一路炸开，往侧面躲', '火箭齐射：一串火箭砸在你身边', '机炮：五连发', '空投（半血）：扔下两只自爆蜂', '悬停：一直绕着你转，飞着的时候子弹也打得到'] },
  };
  Object.assign(D.ENEMIES, BX);
  const BOSSES = ['bx_borer', 'bx_pincer', 'bx_hammer', 'bx_core', 'bx_crow', 'bx_storm', 'bx_kite'];
  D.BX_BOSSES = BOSSES;
  const TWIN = k => k === 'bx_pincer' || k === 'bx_hammer';
  // 每种站型配哪几种（'bx_twins' 是钳和锤一起出）；老的三个镇守首领那三种站在危险等级 3 照旧出老的
  D.BX_AT = {
    ruin: ['bx_borer'], flooded: ['bx_borer', 'bx_storm'], freight: ['bx_borer', 'bx_crow'], nest: ['bx_borer'],
    factory: ['bx_twins'], depot: ['bx_twins', 'bx_kite'], checkpoint: ['bx_twins'], cache: ['bx_crow', 'bx_twins'],
    relay: ['bx_core'], dispatch: ['bx_core'], datacenter: ['bx_core'], bank: ['bx_crow', 'bx_core'],
    armory: ['bx_crow'], market: ['bx_crow'], blackout: ['bx_storm'], hangar: ['bx_kite', 'bx_storm'],
    hospital: ['bx_storm', 'bx_kite'], museum: ['bx_kite'],
  };
  D.bxChance = (tier, lv) => tier >= 3 ? 1 : tier === 2 ? 0.6 : tier === 1 ? (lv >= 5 ? 0.3 : 0) : (lv >= 8 ? 0.2 : 0);

  // ── 战利品：只从首领身上掉
  Object.assign(D.ITEMS, {
    tr_bx_borer: { name: '穿山甲钻头', q: 4, v: 2100, cat: 'part', art: 'tr_bx_borer', w: 2, h: 2, stack: 1, noLoot: true },
    tr_bx_twins: { name: '双子同步芯', q: 4, v: 2400, cat: 'elec', art: 'tr_bx_twins', w: 2, h: 2, stack: 1, noLoot: true },
    tr_bx_core: { name: '主脑神经簇', q: 5, v: 2800, cat: 'elec', art: 'tr_bx_core', w: 2, h: 2, stack: 1, noLoot: true },
    tr_bx_crow: { name: '老鸦的怀表', q: 4, v: 2000, cat: 'val', art: 'tr_bx_crow', w: 2, h: 2, stack: 1, noLoot: true },
    tr_bx_storm: { name: '雷鸣线圈', q: 4, v: 2300, cat: 'elec', art: 'tr_bx_storm', w: 2, h: 2, stack: 1, noLoot: true },
    tr_bx_kite: { name: '鸢的飞控盒', q: 4, v: 2200, cat: 'elec', art: 'tr_bx_kite', w: 2, h: 2, stack: 1, noLoot: true },
  });
  Object.assign(D.ITEM_ART, {
    tr_bx_borer: p => { p.ell(13, 15, 10, 10, R.steel, { spec: true }); for (let i = 0; i < 4; i++) p.line(6 + i * 4, 7 + i, 10 + i * 4, 23 - i, '#3d4766'); p.box(20, 10, 6, 10, R.yellow, { r: 1 }); p.px(13, 6, '#ffffff'); },
    tr_bx_twins: p => { p.box(4, 6, 20, 16, R.dark, { r: 2 }); p.ell(10, 14, 4, 4, R.red, { spec: true }); p.ell(18, 14, 4, 4, R.yellow, { spec: true }); p.rect(13, 13, 2, 2, '#ff3d8b', 1); for (let x = 6; x < 23; x += 3) p.rect(x, 22, 1, 3, '#c8a050'); },
    tr_bx_core: p => { p.ell(14, 13, 10, 9, R.blue, { spec: true }); p.ell(14, 13, 6, 5, R.glass, { spec: true }); p.disc(14, 12, 2, '#ffffff', 1); for (const [a, b, c, d] of [[8, 10, 14, 13], [14, 13, 20, 9], [14, 13, 16, 19]]) p.line(a, b, c, d, '#a6e2f0', 1); p.box(8, 22, 12, 4, R.dark, { r: 1 }); },
    tr_bx_crow: p => { p.ell(14, 15, 9, 9, R.gold, { spec: true }); p.ell(14, 15, 6.5, 6.5, R.white, { flat: true }); p.line(14, 15, 14, 10, '#1d1a24'); p.line(14, 15, 18, 15, '#1d1a24'); p.rect(12, 3, 4, 3, '#b08a2a'); p.line(14, 1, 20, 0, '#c8cdda'); },
    tr_bx_storm: p => { p.box(11, 4, 6, 22, R.steel, { r: 1 }); for (let y = 6; y < 25; y += 4) p.ell(14, y, 9, 1.8, R.copper, { flat: true }); p.disc(14, 3, 2.5, '#fff3b0', 1); },
    tr_bx_kite: p => { p.box(4, 7, 20, 15, R.olive, { r: 2 }); p.rect(7, 10, 8, 5, '#0b0a14'); p.rect(8, 11, 6, 3, '#ff3047', 1); for (let i = 0; i < 3; i++) p.rect(18, 10 + i * 3, 3, 1, '#e3c14a'); p.rect(12, 3, 2, 4, '#646e86'); },
  });
  Object.assign(D.BOSS_TROPHY || (D.BOSS_TROPHY = {}), { bx_borer: 'tr_bx_borer', bx_pincer: 'tr_bx_twins', bx_hammer: 'tr_bx_twins', bx_core: 'tr_bx_core', bx_crow: 'tr_bx_crow', bx_storm: 'tr_bx_storm', bx_kite: 'tr_bx_kite' });

  // ── 像素图
  const mk = (w, h, fn) => { const p = D.Paint(w, h); fn(p); p.outline(); return p.make(2); };
  function borerArt(p, fr) {
    p.box(4, 26, 40, 9, R.dark, { r: 3 }); for (let x = 6 + fr * 2; x < 42; x += 4) p.rect(x, 29, 2, 3, '#0c0e17');
    p.disc(8, 30, 3, '#2a3046'); p.disc(40, 30, 3, '#2a3046');
    p.box(6, 10, 34, 18, R.yellow, { r: 4, bias: -0.1 }); for (let x = 8; x < 38; x += 6) p.rect(x, 22, 3, 3, '#1b1d12');
    p.box(10, 3, 16, 9, R.rust, { r: 2 }); p.rect(13, 5, 9, 3, '#ff7a2e', 1); p.rect(30, 4, 3, 7, '#646e86'); p.rect(30, 3, 3, 1, '#2d3342');
    p.ell(46, 18, 9, 9, R.steel, { spec: true });
    for (let i = 0; i < 4; i++) { const x = 40 + i * 4 + fr * 2; p.line(x, 10 + i, x + 3, 26 - i, '#3d4766'); }
    p.rect(54, 17, 2, 2, '#dbe5fa');
  }
  const h0 = D.initHiArt;
  D.initHiArt = function () {
    const r = h0 ? h0.apply(this, arguments) : undefined, SP = D.SPR;
    SP.bx_borer = mk(56, 36, p => borerArt(p, 0)); SP.bx_borer2 = mk(56, 36, p => borerArt(p, 1));
    SP.bx_mound = mk(34, 12, p => { p.ell(17, 8, 16, 4.5, R.crate, { flat: true }); p.ell(8, 6, 3.5, 2.5, R.plate, { spec: true }); p.ell(25, 5, 3, 2.5, R.plate, { spec: true }); p.ell(16, 5, 2, 1.5, R.dark, {}); p.px(12, 9, '#1b1612'); p.px(21, 9, '#1b1612'); });
    SP.bx_rock = mk(14, 12, p => { p.ell(7, 6, 6, 5, R.plate, { spec: true }); p.line(4, 7, 8, 9, '#2d3342'); p.px(9, 3, '#c8cbe0'); });
    SP.bx_pincer = mk(34, 26, p => {
      for (const [x0, x1] of [[8, 3], [13, 10], [20, 24], [25, 31]]) p.line(x0, 17, x1, 25, '#2d3550');
      p.ell(16, 13, 10, 7, R.red, { spec: true }); p.rect(9, 13, 14, 1, '#5a1420'); p.rect(11, 16, 10, 1, '#5a1420');
      p.ell(17, 8, 5, 3.5, R.dark, { spec: true }); p.rect(16, 7, 5, 2, '#ff3d8b', 1);
      p.box(25, 4, 8, 5, R.steel, { r: 2 }); p.box(25, 11, 9, 4, R.steel, { r: 1 }); p.rect(30, 9, 4, 2, '#0b0a14');
      p.box(1, 9, 6, 4, R.steel, { r: 1 }); p.px(2, 13, '#0b0a14');
    });
    SP.bx_hammer = mk(38, 36, p => {
      p.box(8, 28, 8, 7, R.dark, { r: 1 }); p.box(20, 28, 8, 7, R.dark, { r: 1 });
      p.box(5, 12, 26, 17, R.gunmetal, { r: 4 }); p.rect(7, 24, 22, 2, '#e3c14a'); for (let x = 9; x < 28; x += 5) p.rect(x, 24, 2, 2, '#1b1d12');
      p.box(11, 3, 14, 10, R.steel, { r: 3 }); p.rect(13, 6, 10, 2, '#3ee8ff', 1);
      p.rect(31, 8, 3, 18, '#646e86'); p.box(27, 0, 11, 9, R.yellow, { r: 2 }); p.rect(28, 4, 9, 1, '#5a3e0d');
      p.box(0, 13, 6, 9, R.gunmetal, { r: 2 });
    });
    SP.bx_twincore = mk(14, 12, p => { p.ell(7, 7, 6, 5, R.red, { spec: true }); p.disc(7, 7, 2, '#ff3d8b', 1); p.rect(1, 10, 12, 2, '#2d3342'); });
    SP.bx_core = mk(40, 42, p => {
      p.box(6, 30, 28, 11, R.dark, { r: 2 }); for (let x = 9; x < 32; x += 5) p.rect(x, 34, 2, 4, '#3ee8ff', 1);
      p.box(3, 9, 4, 23, R.gunmetal, { r: 1 }); p.box(33, 9, 4, 23, R.gunmetal, { r: 1 });
      p.ell(20, 17, 13, 13, R.blue, { spec: true }); p.ell(20, 17, 9, 9, R.glass, { spec: true });
      for (const [a, b, c, d] of [[13, 12, 19, 16], [19, 16, 26, 11], [19, 16, 22, 24], [14, 21, 19, 16]]) p.line(a, b, c, d, '#a6e2f0', 1);
      p.disc(20, 16, 2.5, '#ffffff', 1); p.box(14, 0, 12, 5, R.steel, { r: 1 });
    });
    SP.bx_node = mk(14, 24, p => { p.box(2, 18, 10, 6, R.dark, { r: 1 }); p.box(5, 7, 4, 12, R.steel, { r: 1 }); p.rect(4, 12, 6, 1, '#3ee8ff', 1); p.ell(7, 5, 4, 4, R.glass, { spec: true }); p.disc(7, 5, 1.6, '#3ee8ff', 1); });
    SP.bx_crow = mk(24, 30, p => {
      p.rect(7, 23, 3, 7, '#1d1a24'); p.rect(14, 23, 3, 7, '#1d1a24'); p.rect(6, 29, 4, 1, '#0b0a14'); p.rect(14, 29, 4, 1, '#0b0a14');
      p.box(2, 13, 4, 9, R.cloth, { r: 1, bias: -0.2 });
      p.box(5, 11, 14, 14, R.cloth, { r: 2, bias: -0.15 }); p.rect(5, 22, 14, 3, '#2a2433'); p.rect(11, 14, 1, 8, '#2a2433');
      p.rect(6, 11, 12, 2, '#c82e3a'); p.rect(15, 13, 2, 4, '#a3222e');
      p.ell(12, 7, 5, 5, R.dark, { spec: true }); p.ell(13.5, 8, 3, 3, R.plate, {});
      p.line(15, 8, 21, 10, '#e3c14a'); p.line(15, 9, 20, 10, '#b08a2a'); p.px(13, 7, '#ff3047', 1);
      p.box(17, 15, 5, 3, R.gunmetal, { r: 1 });
    });
    SP.bx_storm = mk(38, 44, p => {
      for (const [x0, x1] of [[12, 4], [16, 10], [22, 28], [26, 34]]) p.line(x0, 34, x1, 43, '#2d3550');
      p.box(9, 28, 20, 8, R.dark, { r: 2 }); p.rect(10, 31, 3, 2, '#ffd84a', 1); p.rect(25, 31, 3, 2, '#ffd84a', 1);
      p.box(15, 10, 8, 19, R.steel, { r: 1 });
      for (let y = 12; y < 28; y += 4) p.ell(19, y, 8, 1.6, R.copper, { flat: true });
      p.ell(19, 6, 6, 6, R.glass, { spec: true }); p.disc(19, 6, 3, '#fff3b0', 1); p.disc(19, 5, 1.5, '#ffffff', 1);
    });
    SP.bx_kite = mk(52, 26, p => {
      p.box(2, 11, 11, 3, R.olive, { r: 1 }); p.box(1, 5, 4, 8, R.olive, { r: 1 }); p.rect(2, 7, 2, 2, '#ff3047', 1);
      p.ell(25, 14, 17, 7, R.olive, { spec: true }); p.rect(14, 15, 20, 1, '#2d3017');
      p.ell(39, 13, 7, 5, R.glass, { spec: true }); p.rect(38, 11, 5, 2, '#ff3047', 1);
      p.box(16, 19, 16, 4, R.gunmetal, { r: 1 }); for (let x = 18; x < 31; x += 3) p.disc(x, 21, 1, '#ff7a2e', 1);
      p.rect(23, 3, 4, 5, '#434b5f'); p.rect(44, 17, 6, 2, '#646e86'); p.line(16, 25, 33, 25, '#2d3550');
    });
    SP.bx_orb = mk(10, 10, p => { p.disc(5, 5, 4.5, '#ffd84a', 1); p.disc(5, 5, 3, '#fff3b0', 1); p.disc(5, 5, 1.5, '#ffffff', 1); });
    return r;
  };

  // ── 招式表
  const SEQ = {
    bx_borer: [['bxdig', 'bxrocks', 'charge', 'bxdig'], ['bxdig', 'bxrocks', 'charge', 'bxrocks']],
    bx_pincer: [['bxcut', 'charge', 'bxcut', 'leap'], ['bxcut', 'charge', 'leap', 'bxcut', 'charge']],
    bx_hammer: [['mortar', 'bxquake', 'bxguard', 'mortar', 'bxquake'], ['bxquake', 'mortar', 'bxquake', 'bxguard']],
    bx_core: [['bxbeam', 'bxswarm', 'bxpulse', 'bxbeam'], ['bxbeam', 'bxpulse', 'bxspiral', 'bxswarm', 'bxbeam', 'bxspiral']],
    bx_crow: [['bxshot', 'nade', 'bxshot', 'bxsmoke'], ['bxshot', 'bxnades', 'bxsmoke', 'bxshot', 'bxcall']],
    bx_storm: [['bxfield', 'arcz', 'bxorb', 'bxfield'], ['bxsurge', 'bxfield', 'arcz', 'bxorb', 'bxfield']],
    bx_kite: [['bxstrafe', 'bxgun', 'bxrockets', 'bxstrafe'], ['bxstrafe', 'bxrockets', 'bxdrop', 'bxstrafe', 'bxgun']],
  };
  const ix0 = K.intentX;
  K.intentX = function (S, e) {
    if (e.kind === 'bx_node') return { k: 'zap', dmg: 3, tele: 0.9 };
    const seq = SEQ[e.kind]; if (!seq) return ix0(S, e);
    const two = e.phase === 2 || e.enraged, s = seq[two ? 1 : 0]; let k = s[e.step++ % s.length];
    if (k === 'bxcall' && e.called) k = 'bxnades';
    if (k === 'bxguard' && !(e.twin && !e.twin.dead)) k = 'mortar';
    const f = two ? 0.8 : 1;
    switch (k) {
      case 'bxdig': return { k, dmg: 16, tele: 0.7 * f };
      case 'bxrocks': return { k, n: two ? 8 : 5, dmg: 12, tele: 0.8 * f };
      case 'charge': return { k, dmg: e.kind === 'bx_borer' ? 18 : 14, tele: (e.kind === 'bx_borer' ? 0.9 : 0.7) * f };
      case 'bxcut': return { k, dmg: 9, tele: 0.35 * f };
      case 'leap': return { k, dmg: 12, tele: 0.45 * f };
      case 'mortar': return { k, dmg: 10, n: two ? 5 : 3, tele: 0.7 * f };
      case 'bxquake': return { k, dmg: 12, n: two ? 3 : 2, tele: 0.8 * f };
      case 'bxguard': return { k, tele: 0.5 };
      case 'bxbeam': return { k, dmg: 10, n: two ? 3 : 2, tele: 0.9 * f };
      case 'bxswarm': return { k, tele: 0.7 };
      case 'bxpulse': return { k, dmg: 10, n: 2, tele: 0.7 * f };
      case 'bxspiral': return { k, dmg: 5, tele: 0.6 };
      case 'bxshot': return { k, dmg: 4, n: 7, tele: 0.5 * f };
      case 'nade': return { k, dmg: 12, tele: 0.4 };
      case 'bxnades': return { k, dmg: 11, n: 3, tele: 0.55 };
      case 'bxsmoke': return { k, tele: 0.3 };
      case 'bxcall': return { k, tele: 0.6 };
      case 'bxfield': return { k, dmg: 12, n: two ? 4 : 3, tele: 0.6 * f };
      case 'arcz': return { k, dmg: 10, tele: 0.8 * f };
      case 'bxorb': return { k, dmg: 8, n: 3, tele: 0.6 };
      case 'bxsurge': return { k, dmg: 16, tele: 0.4 };
      case 'bxstrafe': return { k, dmg: 10, tele: 0.9 * f };
      case 'bxgun': return { k, dmg: 5, n: 5, tele: 0.5 * f };
      case 'bxrockets': return { k, dmg: 9, n: two ? 7 : 5, tele: 0.7 * f };
      case 'bxdrop': return { k, tele: 0.6 };
    }
    return { k: 'burst', dmg: 4, n: 3, tele: 0.55 };
  };

  // ── 小工具
  const freeAt = (S, x, y) => x > 20 && y > 24 && x < S.A.w - 20 && y < S.A.h - 16 && !D.solidAt(S.A, x, y) && !D.solidAt(S.A, x, y - 8);
  function spotNear(S, cx, cy, r0, r1, ok) {
    for (let i = 0; i < 40; i++) { const b = S.rng() * TAU, r = S.rng.range(r0, r1), x = cx + Math.cos(b) * r, y = cy + Math.sin(b) * r; if (freeAt(S, x, y) && (!ok || ok(x, y))) return { x, y }; }
    return null;
  }
  function phase(S, e, title, sub) {
    if (e.phase !== 1 || e.hp >= e.maxHp / 2) return false;
    e.phase = 2; e.step = 0; S.banner = { t: 0, text: title, sub }; addShake(S, 0.6); sfx('bosswarn'); return true;
  }
  const own = (S, e, k) => S.enemies.filter(o => !o.dead && o.owner === e && (!k || o.kind === k));
  function minion(S, e, k, x, y, d) { const o = K.spawnEnemy(S, k, x, y, d == null ? 0.4 : d, e.f, true); o.owner = e; o.noLoot = true; return o; }
  function pushWaves(S, e, n, dmg, gap) { const L = S.bxWaves = S.bxWaves || []; for (let i = 0; i < n; i++) L.push({ x: e.x, y: e.y, f: e.f, t: -i * gap, v: 115, max: 175, dmg, hit: false, src: e }); }
  // 主脑的护盾塔：围着主脑摆三座
  function growNodes(S, e, frac) {
    const b0 = S.rng() * TAU;
    for (let i = 0; i < 3; i++) {
      let x = e.x, y = e.y;
      for (let j = 0; j < 12; j++) { const b = b0 + i * TAU / 3 + j * 0.25 * (j % 2 ? 1 : -1), r = 62 - j * 2, tx = e.x + Math.cos(b) * r, ty = e.y + Math.sin(b) * r * 0.75; if (freeAt(S, tx, ty)) { x = tx; y = ty; break; } }
      const o = minion(S, e, 'bx_node', x, y, 0.5); o.hp = Math.round(o.maxHp * (frac || 1)); o.home = { x, y, w: 20, h: 20 };
      ring(S, x, y - 8, 14, '#3ee8ff');
    }
  }

  // ── 走位
  const sx0 = K.stepX;
  K.stepX = function (S, e, dt, T, d, ux, uy, los, move, b) {
    if (!BX[e.kind]) return sx0(S, e, dt, T, d, ux, uy, los, move, b);
    const begin = () => K.begin(S, e), perp = Math.sin(e.t * 0.9 + e.slot), k = e.intent && e.intent.k;
    const keep = (lo, hi, side, sp) => { const want = d < lo ? -1.1 : d > hi ? 1 : 0; move(ux * want + (-uy) * perp * side, uy * want + ux * perp * side, sp || b.speed); };
    switch (e.kind) {
      case 'bx_borer':
        phase(S, e, '狂掘', '穿山甲连钻两次，落石更多');
        move(ux, uy, b.speed * (d > 60 ? 1 : 0.3)); if (e.cd <= 0 && (k !== 'charge' || (los && d < 220))) begin(); break;
      case 'bx_pincer': {
        const sp = b.speed * (d > 30 ? 1 : 0.2); move(ux + (-uy) * perp * 0.4, uy + ux * perp * 0.4, sp);
        if (e.cd <= 0 && (k === 'bxcut' ? d < 36 : los && d < 170)) begin(); break;
      }
      case 'bx_hammer': keep(80, 150, 0.6); if (e.cd <= 0 && d < 240) begin(); break;
      case 'bx_core': e.vx = e.vy = 0; if (!(e.exposedT > 0) && e.cd <= 0 && d < 280) begin(); break;
      case 'bx_node': e.vx = e.vy = 0; if (e.cd <= 0 && los && d < 200) begin(); break;
      case 'bx_crow':
        phase(S, e, '急了', '老鸦吹口哨叫人，手雷一次扔三颗');
        keep(70, 130, 0.9); if (e.cd <= 0 && (k === 'bxshot' ? d < 140 && los : d < 220)) begin(); break;
      case 'bx_storm':
        phase(S, e, '满载', '雷鸣会全场放电：站进绿色的绝缘垫');
        keep(90, 150, 0.5); if (e.cd <= 0 && d < 240) begin(); break;
      case 'bx_kite': {
        phase(S, e, '冒烟', '鸢开始往下扔自爆蜂');
        const a = e.slot + e.t * 0.45, tx = T.x + Math.cos(a) * 130, ty = T.y + Math.sin(a) * 90;
        move(tx - e.x, ty - e.y, b.speed * (Math.hypot(tx - e.x, ty - e.y) > 12 ? 1 : 0.3)); e.face = T.x >= e.x ? 1 : -1;
        if (e.cd <= 0 && d < 280) begin(); break;
      }
    }
  };

  // ── 出招
  const st0 = K.startX;
  K.startX = function (S, e, T, a) {
    const it = e.intent, next = () => { e.intent = K.nextIntent(S, e); }, p = S.player;
    switch (it.k) {
      case 'bxdig': e.act = { k: 'bxdig', t: 0, ph: 0, dur: e.phase === 2 ? 2.2 : 2.0, again: false }; e.under = true; e.z = 999; sfx('slam'); addShake(S, 0.3); for (let i = 0; i < 16; i++) part(S, 'debris', e.x, e.y, S.rng.range(-80, 80), S.rng.range(-90, 10), 0.6, S.rng.pick(['#5a4630', '#7a6448', P[3]])); return;
      case 'bxrocks': {
        const L = S.bxRocks = S.bxRocks || [];
        L.push({ x: T.x + (T.vx || 0) * 0.5, y: T.y + (T.vy || 0) * 0.5, f: e.f, t: 0, warn: 1.0, r: 14, dmg: it.dmg });
        for (let i = 1; i < it.n; i++) { const s = spotNear(S, T.x, T.y, 20, 90); if (s) L.push({ x: s.x, y: s.y, f: e.f, t: -i * 0.12, warn: 1.0, r: 14, dmg: it.dmg }); }
        addShake(S, 0.5); sfx('bosswarn'); text(S, e.x, e.y - 34, '吼', P.O); e.cd = 1.1; next(); return;
      }
      case 'bxcut': e.act = { k: 'bxcut', t: 0, n: 3, gap: 0.2 }; sfx('swing'); return;
      case 'bxquake': pushWaves(S, e, it.n, it.dmg, 0.45); addShake(S, 0.6); ring(S, e.x, e.y, 20, P.O); decal(S, e); sfx('slam'); e.cd = 1.3; next(); return;
      case 'bxguard': { const o = e.twin; if (o && !o.dead) { o.shield = Math.max(o.shield, Math.round(o.maxHp * 0.25)); ring(S, o.x, o.y - 8, 20, P.c); S.beams.push({ x0: e.x, y0: e.y - 16, x1: o.x, y1: o.y - 8, t: 0.4, max: 0.4, col: P.c }); sfx('shield'); } e.cd = 0.8; next(); return; }
      case 'bxbeam': { const n = it.n; e.act = { k: 'bxbeam', t: 0, dur: 2.8, n, a0: a + Math.PI / n, dir: S.rng.chance(0.5) ? 1 : -1, w: e.phase === 2 ? 1.2 : 0.85, lens: [] }; sfx('laser'); return; }
      case 'bxswarm': { if (own(S, e, 'drone').length < 4) for (const s of [-1, 1]) { const q = spotNear(S, e.x + s * 26, e.y, 0, 14) || e; minion(S, e, 'drone', q.x, q.y); } ring(S, e.x, e.y - 16, 26, P.c); sfx('warn'); e.cd = 1; next(); return; }
      case 'bxpulse': pushWaves(S, e, it.n, it.dmg, 0.5); ring(S, e.x, e.y - 8, 24, P.c); flashLight(S, e.x, e.y - 16, 90, P.c, 1.2); sfx('orb'); e.cd = 1.1; next(); return;
      case 'bxspiral': e.act = { k: 'bxspiral', t: 0, dur: 2.2, gap: 0, a: S.rng() * TAU }; sfx('charge2'); return;
      case 'bxshot': {
        const ox = e.x + Math.cos(a) * 8, oy = e.y - 9;
        for (let i = 0; i < it.n; i++) K.eshot(S, ox, oy, a + (i / (it.n - 1) - 0.5) * 0.62 + S.rng.range(-0.04, 0.04), S.rng.range(210, 250), it.dmg, P.O);
        if (K.muzzle) K.muzzle(S, ox, oy, a, P.O, 1.4); flashLight(S, ox, oy, 60, P.O, 1); addShake(S, 0.15); sfx('eshot'); e.aimA = a; e.cd = 1.0; next(); return;
      }
      case 'bxnades': {
        for (let i = 0; i < it.n; i++) { const b = a + (i - (it.n - 1) / 2) * 0.5, dd = Math.min(150, Math.hypot(T.x - e.x, T.y - e.y)) + S.rng.range(-10, 20); S.nades.push({ x: e.x, y: e.y - 8, sx: e.x, sy: e.y - 8, tx: e.x + Math.cos(b) * dd, ty: e.y + Math.sin(b) * dd, t: 0, fly: 0.5, fuse: 1.3 + i * 0.15, dmg: it.dmg }); }
        sfx('throw'); e.cd = 1.4; next(); return;
      }
      case 'bxsmoke': {
        (S.smokes = S.smokes || []).push({ x: e.x, y: e.y, f: e.f, r: 36, t: 4.5, max: 4.5 });
        for (let i = 0; i < 18; i++) part(S, 'smoke', e.x + S.rng.range(-20, 20), e.y + S.rng.range(-10, 10), S.rng.range(-20, 20), S.rng.range(-20, -4), 1.2, '#7c8299');
        const a0 = Math.atan2(e.y - p.y, e.x - p.x), s = spotNear(S, p.x, p.y, 85, 130, (x, y) => Math.abs(D.angDiff(a0, Math.atan2(y - p.y, x - p.x))) > 1.1 && D.losClear(S.A, x, y - 6, p.x, p.y - 6));
        sfx('throw'); e.act = { k: 'bxdash', t: 0, dur: 0.75, tx: s ? s.x : e.x, ty: s ? s.y : e.y }; return;
      }
      case 'bxcall': {
        e.called = true;
        for (let i = 0; i < 2; i++) { const s = spotNear(S, e.x, e.y, 60, 140) || e; minion(S, e, 'raider', s.x, s.y, 0.8); }
        text(S, e.x, e.y - 26, '口哨', '#ffd860'); sfx('warn'); e.cd = 0.8; next(); return;
      }
      case 'bxfield': {
        const L = S.bxZones = S.bxZones || [];
        L.push({ x: T.x, y: T.y, r: 30, f: e.f, t: 0, warn: 1.2, on: 0.25, dmg: it.dmg });
        for (let i = 1; i < it.n; i++) { const s = spotNear(S, T.x, T.y, 50, 100); if (s) L.push({ x: s.x, y: s.y, r: 30, f: e.f, t: -i * 0.1, warn: 1.2, on: 0.25, dmg: it.dmg }); }
        sfx('charge'); e.cd = 1.3; next(); return;
      }
      case 'bxorb': { const L = S.bxOrbs = S.bxOrbs || []; for (let i = 0; i < it.n; i++) L.push({ x: e.x, y: e.y - 18, a: a + (i - 1) * 0.9, life: 4.5, f: e.f, sp: 62, dmg: it.dmg }); flashLight(S, e.x, e.y - 18, 70, '#ffd84a', 1); sfx('orb'); e.cd = 1.2; next(); return; }
      case 'bxsurge': {
        const pads = [], s0 = spotNear(S, p.x, p.y, 40, 75) || spotNear(S, p.x, p.y, 0, 40); if (s0) pads.push(s0);
        for (let i = 0; i < 2; i++) { const s = spotNear(S, p.x, p.y, 80, 150, (x, y) => pads.every(q => Math.hypot(q.x - x, q.y - y) > 50)); if (s) pads.push(s); }
        S.bxSurge = { f: e.f, t: 0, warn: 2.4, pads: pads.map(q => ({ x: q.x, y: q.y, r: 22 })), src: e, dmg: it.dmg };
        e.act = { k: 'bxcharge', t: 0, dur: 2.5 };
        if (!S.bxSurgeTold) { S.bxSurgeTold = true; text(S, p.x, p.y - 34, '站进绿圈', P.g); }
        sfx('charge'); return;
      }
      case 'bxstrafe': {
        const dx = T.x - e.x, dy = T.y - e.y, l = Math.hypot(dx, dy) || 1;
        e.act = { k: 'bxstrafe', t: 0, ux: dx / l, uy: dy / l, len: l + 150, gone: 0, last: 0 }; sfx('dash'); return;
      }
      case 'bxgun': e.act = { k: 'bxgun', t: 0, n: it.n, gap: 0.1 }; sfx('charge2'); return;
      case 'bxrockets': {
        for (let i = 0; i < it.n; i++) { const lead = i * 0.25, tx = D.clamp(T.x + (T.vx || 0) * lead + S.rng.range(-26, 26), 20, S.A.w - 20), ty = D.clamp(T.y + (T.vy || 0) * lead + S.rng.range(-18, 18), 40, S.A.h - 20); S.shells.push({ sx: e.x, sy: e.y - (e.z || 0), tx, ty, t: -i * 0.14, dur: 0.85, dmg: it.dmg }); }
        flashLight(S, e.x, e.y - (e.z || 0), 60, P.O, 1); sfx('orb'); e.cd = 1.4; next(); return;
      }
      case 'bxdrop': { if (own(S, e, 'bomber').length < 4) for (const s of [-1, 1]) { const q = spotNear(S, e.x + s * 10, e.y, 0, 16); if (q) minion(S, e, 'bomber', q.x, q.y, 0.5); } sfx('throw'); e.cd = 1; next(); return; }
    }
    return st0(S, e, T, a);
  };
  function decal(S, e) { if (K.decal) K.decal(S, e.x, e.y, 18); }

  const ax0 = K.actX;
  K.actX = function (S, e, dt, T, done) {
    const A = e.act, p = S.player;
    switch (A.k) {
      case 'bxdig': {
        if (A.ph === 0) {
          const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1, sp = (e.phase === 2 ? 118 : 100) * Math.min(1, l / 20);
          const nx = D.clamp(e.x + dx / l * sp * dt, 24, S.A.w - 24), ny = D.clamp(e.y + dy / l * sp * dt, 30, S.A.h - 20); e.x = nx; e.y = ny; // 地下不管墙
          if (S.t % 0.06 < dt) part(S, 'debris', e.x + S.rng.range(-8, 8), e.y, S.rng.range(-30, 30), S.rng.range(-60, -20), 0.4, S.rng.pick(['#5a4630', '#7a6448']));
          if (A.t >= A.dur && (freeAt(S, e.x, e.y) || A.t > A.dur + 1.5)) { A.ph = 1; A.t = 0; sfx('beep'); }
        } else if (A.ph === 1) {
          if (S.t % 0.05 < dt) part(S, 'debris', e.x + S.rng.range(-12, 12), e.y, S.rng.range(-40, 40), S.rng.range(-80, -30), 0.4, '#7a6448');
          if (A.t >= 0.6) {
            e.under = false; e.z = 0; const n = e.phase === 2 ? 12 : 8, off = S.rng() * TAU;
            if (Math.hypot(p.x - e.x, p.y - e.y) < 34 + p.r) hitP(S, 16, e);
            for (let i = 0; i < n; i++) K.eshot(S, e.x, e.y - 4, off + i / n * TAU, 95, 6, '#c8a878');
            for (let i = 0; i < 26; i++) { const b = S.rng() * TAU; part(S, 'debris', e.x, e.y, Math.cos(b) * S.rng.range(40, 150), Math.sin(b) * S.rng.range(40, 150), S.rng.range(0.5, 1), S.rng.pick(['#5a4630', '#7a6448', P[3]])); }
            ring(S, e.x, e.y, 38, P.O); decal(S, e); addShake(S, 0.8); S.stop = Math.max(S.stop, 0.06); flashLight(S, e.x, e.y, 110, P.O, 1.2); sfx('slam');
            if (e.phase === 2 && !A.again) { e.act = { k: 'bxdig', t: 0, ph: 0, dur: 1.3, again: true }; e.under = true; e.z = 999; return; }
            e.cd = 1.5; done();
          }
        }
        return;
      }
      case 'bxcut':
        if (A.t >= A.gap) {
          A.t = 0; A.n--; const a = Math.atan2(p.y - e.y, p.x - e.x); D.move(S.A, e, Math.cos(a) * 6, Math.sin(a) * 6); e.face = Math.cos(a) >= 0 ? 1 : -1;
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 14) hitP(S, e.intent.dmg, e);
          S.ghosts.push({ k: 'slash', x: e.x + Math.cos(a) * 8, y: e.y - 6, a, t: 0.12 }); sfx('swing');
        }
        if (A.n <= 0) { e.cd = 1.1; done(); }
        return;
      case 'bxbeam': {
        A.a = A.a0 + A.dir * A.w * A.t; A.lens.length = 0; const ox = e.x, oy = e.y - 18, live = A.t > 0.4;
        for (let i = 0; i < A.n; i++) {
          const g = A.a + i * TAU / A.n, c = Math.cos(g), s = Math.sin(g); let len = 0; while (len < 360 && !D.solidAt(S.A, ox + c * len, oy + 6 + s * len)) len += 4; A.lens.push(len);
          if (!live) continue;
          const t = D.clamp((p.x - ox) * c + (p.y - 6 - oy) * s, 0, len);
          if (Math.hypot(p.x - (ox + c * t), p.y - 6 - (oy + s * t)) < 6 && !(e.hitCd.p > 0)) { e.hitCd.p = 0.5; hitP(S, e.intent.dmg, e); }
          if (S.t % 0.04 < dt) part(S, 'spark', ox + c * len, oy + s * len, S.rng.range(-50, 50), S.rng.range(-60, 0), 0.25, '#a6e2f0');
          S.tlights.push({ x: ox + c * len, y: oy + s * len, r: 30, col: P.c, a: 0.8, decay: 30 });
        }
        if (A.t >= A.dur) { e.cd = 1.0; done(); }
        return;
      }
      case 'bxspiral':
        A.gap -= dt;
        if (A.gap <= 0) { A.gap = 0.08; A.a += 0.36; for (const o of [0, Math.PI]) K.eshot(S, e.x, e.y - 18, A.a + o, 80, e.intent.dmg, '#3ee8ff'); if (S.rng.chance(0.3)) sfx('orb'); }
        if (A.t >= A.dur) { e.cd = 1.0; done(); }
        return;
      case 'bxdash': {
        const dx = A.tx - e.x, dy = A.ty - e.y, l = Math.hypot(dx, dy);
        if (l > 4) { D.move(S.A, e, dx / l * Math.min(l, 220 * dt), dy / l * Math.min(l, 220 * dt)); e.face = dx >= 0 ? 1 : -1; }
        if (A.t >= A.dur || l <= 4) { e.cd = 0.35; done(); }
        return;
      }
      case 'bxroll': D.move(S.A, e, A.vx * dt, A.vy * dt); if (S.t % 0.05 < dt) part(S, 'smoke', e.x, e.y - 2, 0, -10, 0.4, '#7c8299'); if (A.t >= A.dur) { e.act = null; e.cd = Math.min(e.cd, 0.3); } return;
      case 'bxcharge':
        if (S.t % 0.07 < dt) S.bolts.push({ pts: K.zig(S, e.x, e.y - 26, e.x + S.rng.range(-30, 30), e.y + S.rng.range(-10, 10)), t: 0.1 });
        if (A.t >= A.dur) { e.cd = 0.8; done(); }
        return;
      case 'bxstrafe': {
        const step = 240 * dt, nx = e.x + A.ux * step, ny = e.y + A.uy * step;
        if (nx < 20 || ny < 30 || nx > S.A.w - 20 || ny > S.A.h - 16 || D.solidAt(S.A, nx, ny) || A.gone >= A.len) { e.cd = 1.0; done(); return; }
        e.x = nx; e.y = ny; A.gone += step; e.face = A.ux >= 0 ? 1 : -1;
        if (A.gone - A.last >= 18) { A.last = A.gone; (S.bxBombs = S.bxBombs || []).push({ x: e.x, y: e.y, f: e.f, t: 0, warn: 0.45, r: 15, dmg: e.intent.dmg }); }
        return;
      }
      case 'bxgun':
        if (A.t >= A.gap) { A.t = 0; A.n--; const oy = e.y - (e.z || 0) + 2, ox = e.x + e.face * 10, a = Math.atan2(p.y - 6 - oy, p.x - ox) + S.rng.range(-0.06, 0.06); K.eshot(S, ox, oy, a, 250, e.intent.dmg, P.O); if (K.muzzle) K.muzzle(S, ox, oy, a, P.O, 0.8); sfx('eshot'); }
        if (A.n <= 0) { e.cd = 1.2; done(); }
        return;
    }
    return ax0(S, e, dt, T, done);
  };

  // ── 挨打：钻在地下打不到、主脑有塔时打不动、塔倒了挨打更疼、老鸦会翻滚
  const hurt0 = K.hurt;
  K.hurt = function (S, e, dmg, o) {
    if (!e || e.dead || !BX[e.kind]) return hurt0.apply(this, arguments);
    o = o || {};
    if (e.under) return;
    if (e.kind === 'bx_core') {
      if (e.shielded) { if (!o.dot && !(e.dingT > S.t)) { e.dingT = S.t + 0.3; text(S, e.x, e.y - 34, '无效', P.c); ring(S, e.x, e.y - 16, 24, P.c); sfx('ding'); } return; }
      if (e.exposedT > 0) dmg *= 1.5;
    }
    if (e.kind === 'bx_crow') {
      if (e.act && e.act.k === 'bxroll') return;
      if (!o.melee && !o.dot && !(e.rollCd > e.t) && !(e.stun > 0) && S.rng.chance(0.55)) {
        const p = S.player, a = Math.atan2(p.y - e.y, p.x - e.x) + (S.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
        e.rollCd = e.t + (e.phase === 2 ? 1.6 : 2.2); e.tele = 0; e.act = { k: 'bxroll', t: 0, dur: 0.28, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230 };
        text(S, e.x, e.y - 24, '闪', P[6]); sfx('dash'); return;
      }
    }
    return hurt0.call(this, S, e, dmg, o);
  };

  // ── 击毁：双子先倒下的那个不掉战利品，剩下的那个狂暴，15 秒后把同伴拼回来
  const ok0 = K.onKillX;
  K.onKillX = function (S, e) {
    const tw = e.twin, pair = TWIN(e.kind) && tw && !tw.dead;
    if (pair) e.noTrophy = true;
    if (ok0) ok0(S, e);
    if (pair) {
      tw.enraged = true; tw.step = 0;
      S.banner = { t: 0, text: '悲鸣', sub: `15 秒内打倒${D.ENEMIES[tw.kind].name}，不然${D.ENEMIES[e.kind].name}会被重新拼起来` }; sfx('bosswarn');
      (S.bxRebuild = S.bxRebuild || []).push({ kind: e.kind, x: D.clamp(e.x, 24, S.A.w - 24), y: e.y, f: e.f, t: 0, dur: 15, partner: tw });
    } else if (TWIN(e.kind) && tw && S.banner && /击毁/.test(S.banner.text || '')) S.banner.text = '击毁 钳与锤';
  };

  // ── 每帧
  const fp0 = K.foesPost;
  K.foesPost = function (S, dt) {
    const p = S.player;
    // 双子醒了：一条横幅说清楚
    for (const e of S.enemies) if (!e.dead && TWIN(e.kind) && e.aware && !e.announced && e.f === S.f) {
      e.announced = true; if (e.twin) e.twin.announced = true;
      S.banner = { t: 0, text: '钳与锤', sub: '镇守首领 · 双子：两个都打倒才算赢', keep: true }; sfx('bosswarn');
    }
    if (fp0) fp0(S, dt);
    if (!p) return;
    for (const e of S.enemies) {
      if (e.dead || e.f !== S.f || !BX[e.kind]) continue;
      if (e.enraged) e.haste = Math.max(e.haste || 0, 0.15);
      if (e.kind === 'bx_kite') e.z = (e.act && e.act.k === 'bxstrafe' ? 14 : 24) + Math.sin(e.t * 2.2) * 2;
      if (e.kind === 'bx_storm' && e.aware && S.rng.chance(dt * 3)) S.bolts.push({ pts: K.zig(S, e.x, e.y - 34, e.x + S.rng.range(-14, 14), e.y - 26 + S.rng.range(-6, 6)), t: 0.08 });
      if (e.kind === 'bx_core') {
        if (!e.nodesInit) { e.nodesInit = true; growNodes(S, e, 1); }
        const n = own(S, e, 'bx_node').length;
        e.shielded = n > 0;
        if (n === 0 && !(e.exposedT > 0) && e.nodesWere > 0) {
          e.exposedT = 8; e.act = null; e.tele = 0; e.cd = Math.max(e.cd, 0.5);
          text(S, e.x, e.y - 40, '护盾破了', P.Y); ring(S, e.x, e.y - 16, 34, P.Y); flashLight(S, e.x, e.y - 16, 120, P.c, 1.4); addShake(S, 0.5); sfx('slam');
        }
        if (e.exposedT > 0) {
          e.exposedT -= dt; e.tele = 0; if (S.rng.chance(dt * 12)) part(S, 'spark', e.x + S.rng.range(-10, 10), e.y - 16 + S.rng.range(-10, 10), S.rng.range(-50, 50), S.rng.range(-60, 0), 0.3, P.c);
          if (e.exposedT <= 0) { growNodes(S, e, 0.6); text(S, e.x, e.y - 40, '护盾重建', P.c); sfx('shield'); }
        }
        e.nodesWere = n;
      }
    }
    // 双子：15 秒后把倒下的拼回来
    if (S.bxRebuild) {
      for (const B of S.bxRebuild) {
        B.t += dt; if (B.partner.dead) { B.dead = true; continue; }
        if (B.f === S.f && S.rng.chance(dt * 6)) part(S, 'spark', B.x + S.rng.range(-6, 6), B.y - 4, S.rng.range(-30, 30), S.rng.range(-50, -10), 0.3, '#ff3d8b');
        if (B.t >= B.dur) {
          B.dead = true; const o = K.spawnEnemy(S, B.kind, B.x, B.y, 0.4, B.f, true);
          o.hp = Math.round(o.maxHp * 0.4); o.noLoot = true; o.twin = B.partner; B.partner.twin = o; o.announced = true; B.partner.enraged = false;
          if (B.f === S.f) { S.banner = { t: 0, text: '重新拼起来了', sub: `${D.ENEMIES[B.kind].name}又站起来了` }; ring(S, B.x, B.y - 8, 26, '#ff3d8b'); sfx('shield'); }
        }
      }
      S.bxRebuild = S.bxRebuild.filter(B => !B.dead);
    }
    // 冲击波：一圈往外推，碰到你的那一下挨打（闪避的无敌帧能穿过去）
    if (S.bxWaves) {
      for (const W of S.bxWaves) {
        W.t += dt; if (W.t < 0 || W.f !== S.f) continue; const Rr = W.v * W.t;
        if (W.t - dt < 0) { addShake(S, 0.25); sfx('slam'); }
        if (!W.hit && Rr > 8 && p.hp > 0 && Math.abs(Math.hypot(p.x - W.x, (p.y - W.y) * 1.4) - Rr) < 6) { W.hit = true; hitP(S, W.dmg, W.src && !W.src.dead ? W.src : { x: W.x, y: W.y }); }
      }
      S.bxWaves = S.bxWaves.filter(W => W.v * W.t < W.max);
    }
    // 导电区
    if (S.bxZones) {
      for (const Z of S.bxZones) {
        Z.t += dt; if (Z.f !== S.f || Z.t < Z.warn || Z.fired) continue;
        Z.fired = true; for (let i = 0; i < 3; i++) S.bolts.push({ pts: K.zig(S, Z.x + S.rng.range(-Z.r, Z.r) * 0.7, Z.y - 30, Z.x + S.rng.range(-Z.r, Z.r) * 0.7, Z.y + S.rng.range(-6, 6)), t: 0.18 });
        flashLight(S, Z.x, Z.y, 60, '#ffd84a', 1); sfx('zap');
        if (p.hp > 0 && Math.hypot(p.x - Z.x, (p.y - Z.y) * 1.4) < Z.r) hitP(S, Z.dmg, { kind: 'bx_storm', x: Z.x, y: Z.y });
      }
      S.bxZones = S.bxZones.filter(Z => Z.t < Z.warn + Z.on);
    }
    // 落石
    if (S.bxRocks) {
      for (const Q of S.bxRocks) {
        Q.t += dt; if (Q.f !== S.f || Q.t < Q.warn || Q.fired) continue;
        Q.fired = true; for (let i = 0; i < 8; i++) part(S, 'debris', Q.x, Q.y - 2, S.rng.range(-70, 70), S.rng.range(-80, 0), 0.6, S.rng.pick([P[3], P[2], '#7a6448']));
        addShake(S, 0.25); sfx('slam'); if (K.decal) K.decal(S, Q.x, Q.y, 6);
        if (p.hp > 0 && Math.hypot(p.x - Q.x, (p.y - Q.y) * 1.4) < Q.r + p.r) hitP(S, Q.dmg, { kind: 'bx_borer', x: Q.x, y: Q.y });
      }
      S.bxRocks = S.bxRocks.filter(Q => Q.t < Q.warn + 0.05);
    }
    // 俯冲留下的炸弹
    if (S.bxBombs) { for (const B of S.bxBombs) { B.t += dt; if (B.f === S.f && B.t >= B.warn && !B.fired) { B.fired = true; K.explode(S, B.x, B.y, B.r, B.dmg, true); } } S.bxBombs = S.bxBombs.filter(B => B.t < B.warn + 0.05); }
    // 球形闪电：慢慢转向你
    if (S.bxOrbs) {
      for (const O of S.bxOrbs) {
        O.life -= dt; if (O.f !== S.f) continue;
        O.a += D.clamp(D.angDiff(O.a, Math.atan2(p.y - 6 - O.y, p.x - O.x)), -1.5 * dt, 1.5 * dt); O.x += Math.cos(O.a) * O.sp * dt; O.y += Math.sin(O.a) * O.sp * dt;
        if (S.rng.chance(dt * 10)) part(S, 'spark', O.x, O.y, S.rng.range(-30, 30), S.rng.range(-30, 30), 0.2, '#ffd84a');
        if (p.hp > 0 && Math.hypot(p.x - O.x, p.y - 6 - O.y) < 8) { O.life = 0; hitP(S, O.dmg, { kind: 'bx_storm', x: O.x, y: O.y }); ring(S, O.x, O.y, 12, '#ffd84a'); sfx('zap'); }
        else if (D.solidAt(S.A, O.x, O.y + 6)) O.life = 0;
      }
      S.bxOrbs = S.bxOrbs.filter(O => O.life > 0);
    }
    // 全场放电：只有绿垫子里安全
    const SG = S.bxSurge;
    if (SG) {
      SG.t += dt;
      if (SG.src.dead) S.bxSurge = null;
      else if (SG.t >= SG.warn) {
        S.bxSurge = null;
        if (SG.f === S.f) {
          const safe = SG.pads.some(q => Math.hypot(p.x - q.x, (p.y - q.y) * 1.4) < q.r), e = SG.src;
          for (let i = 0; i < 6; i++) { const b = S.rng() * TAU, r = S.rng.range(60, 220); S.bolts.push({ pts: K.zig(S, e.x, e.y - 30, e.x + Math.cos(b) * r, e.y + Math.sin(b) * r * 0.7), t: 0.25 }); }
          flashLight(S, e.x, e.y - 20, 300, '#ffd84a', 1.6); addShake(S, 0.7); sfx('zap');
          if (!safe && p.hp > 0 && dist(p, e) < 340) { S.bolts.push({ pts: K.zig(S, e.x, e.y - 30, p.x, p.y - 6), t: 0.3 }); hitP(S, SG.dmg, e); }
        }
      }
    }
  };

  // ── 画
  const df0 = D.drawFoe;
  D.drawFoe = function (ctx, ex, S, e, white, LT, H) {
    if (!BX[e.kind]) return df0 ? df0.apply(this, arguments) : false;
    const SP = D.SPR, x = e.x, y = e.y, tele = e.tele > 0, sx = tele && e.tele < 0.25 ? Math.round(Math.sin(S.t * 80)) * 0.5 : 0, fl = e.face < 0, A = e.act, ik = e.intent && e.intent.k;
    const act = (spr, yy) => H.actor(ctx, ex, spr, x + sx, yy, fl, white);
    switch (e.kind) {
      case 'bx_borer': {
        if (e.under) {
          const sh = A && A.ph === 1 ? Math.round(Math.sin(S.t * 70)) : Math.round(Math.sin(S.t * 20) * 0.5);
          D.blit(ctx, SP.bx_mound, x + sh, y + 3, false, null);
          if (A && A.ph === 1) { ex.strokeStyle = D.rgba(P.r, (S.t * 16 | 0) % 2 ? 0.8 : 0.4); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(x, y, 34, 19, 0, 0, TAU); ex.stroke(); LT(x, y - 2, 40, P.r, 0.8); }
          return true;
        }
        const spr = (S.t * (A && A.k === 'charge' ? 24 : 10) | 0) % 2 ? SP.bx_borer2 : SP.bx_borer;
        if (tele && ik === 'bxdig') { // 往下沉
          const k = 1 - e.tele / e.teleMax, sink = Math.round(k * 12);
          for (const g of [ctx, ex]) { g.save(); g.beginPath(); g.rect(x - 40, y - 40, 80, 41); g.clip(); }
          act(spr, y + sink); for (const g of [ctx, ex]) g.restore();
        } else act(spr, y + 1);
        if (tele) LT(x + e.face * 12, y - 10, 36, e.phase === 2 ? P.r : P.O, 1);
        return true;
      }
      case 'bx_pincer': act(SP.bx_pincer, y); if (tele || e.enraged) LT(x, y - 8, 26, e.enraged ? P.r : '#ff3d8b', e.enraged ? 0.6 : 0.9); return true;
      case 'bx_hammer': act(SP.bx_hammer, y - (tele && ik === 'bxquake' ? Math.round((1 - e.tele / e.teleMax) * 3) : 0)); if (tele || e.enraged) LT(x + e.face * 8, y - 18, 30, e.enraged ? P.r : P.O, 0.9); return true;
      case 'bx_node': act(SP.bx_node, y); LT(x, y - 10, 18, '#3ee8ff', 0.5 + (tele ? 0.4 : 0)); return true;
      case 'bx_core': {
        if (e.exposedT > 0 && !white) ctx.globalAlpha = (S.t * 14 | 0) % 2 ? 0.75 : 1;
        act(SP.bx_core, y); ctx.globalAlpha = 1;
        if (e.shielded) { const k = 0.35 + 0.2 * Math.sin(S.t * 4); ex.strokeStyle = D.rgba('#3ee8ff', k); ex.lineWidth = 1; ex.beginPath(); ex.ellipse(x, y - 11, 17, 15, 0, 0, TAU); ex.stroke(); }
        if (A && A.k === 'bxbeam' && A.lens.length) {
          const ox = x, oy = y - 18, warm = A.t < 0.4;
          for (let i = 0; i < A.n; i++) {
            const g = A.a + i * TAU / A.n, x1 = ox + Math.cos(g) * A.lens[i], y1 = oy + Math.sin(g) * A.lens[i];
            if (warm) { ex.strokeStyle = D.rgba(P.c, 0.5); ex.lineWidth = 0.5; ex.setLineDash([3, 3]); ex.beginPath(); ex.moveTo(ox, oy); ex.lineTo(x1, y1); ex.stroke(); ex.setLineDash([]); continue; }
            H.seg(ctx, ox, oy, x1, y1, P.k, 3.5); H.seg(ctx, ox, oy, x1, y1, '#2f6e88', 2.5);
            ex.strokeStyle = '#a6e2f0'; ex.lineWidth = 1.5; ex.beginPath(); ex.moveTo(ox, oy); ex.lineTo(x1, y1); ex.stroke();
            ex.strokeStyle = '#ffffff'; ex.lineWidth = 0.5; ex.beginPath(); ex.moveTo(ox, oy); ex.lineTo(x1, y1); ex.stroke();
          }
        }
        LT(x, y - 18, 40, e.exposedT > 0 ? P.Y : P.c, tele ? 1 : 0.6);
        return true;
      }
      case 'bx_crow': {
        if (A && A.k === 'bxroll' && !white) ctx.globalAlpha = 0.55;
        act(SP.bx_crow, y); ctx.globalAlpha = 1;
        const a = e.aimA != null ? e.aimA : (e.face > 0 ? 0 : Math.PI), gx = x + e.face * 3, gy = y - 8;
        H.seg(ctx, gx, gy, gx + Math.cos(a) * 11, gy + Math.sin(a) * 11, P.k, 3); H.seg(ctx, gx, gy, gx + Math.cos(a) * 11, gy + Math.sin(a) * 11, '#5a4a3a', 1.5);
        if (tele && ik === 'bxshot') { const tx = gx + Math.cos(a) * 12, ty = gy + Math.sin(a) * 12; ex.fillStyle = (S.t * 30 | 0) % 2 ? '#ffffff' : P.O; ex.fillRect(tx - 1, ty - 1, 2, 2); LT(tx, ty, 26, P.O, 0.9); }
        return true;
      }
      case 'bx_storm': {
        act(SP.bx_storm, y);
        const charging = A && A.k === 'bxcharge', k = charging ? A.t / A.dur : 0;
        LT(x, y - 34, charging ? 60 + k * 80 : 30, '#ffd84a', charging ? 1 : tele ? 0.9 : 0.5);
        if (charging) { ex.strokeStyle = D.rgba('#ffd84a', 0.3 + 0.5 * k); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(x, y - 4, 14 + k * 20, (14 + k * 20) * 0.55, 0, 0, TAU); ex.stroke(); }
        return true;
      }
      case 'bx_kite': {
        const z = e.z || 0;
        ctx.fillStyle = 'rgba(8,8,16,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, 0, TAU); ctx.fill();
        act(SP.bx_kite, y - z);
        const hx = x - e.face * 1, hy = y - z - 12, ra = S.t * 40;
        for (const o of [0, Math.PI]) { const c = Math.cos(ra + o) * 18; H.seg(ctx, hx, hy, hx + c, hy - 0.5, '#2d3342', 1); ex.strokeStyle = D.rgba('#c8cdda', 0.25); ex.lineWidth = 0.5; ex.beginPath(); ex.moveTo(hx, hy); ex.lineTo(hx + c, hy - 0.5); ex.stroke(); }
        if (tele && ik === 'bxstrafe') {
          const p = S.player, dx = p.x - x, dy = p.y - y, l = Math.hypot(dx, dy) || 1, L = l + 150;
          ex.strokeStyle = D.rgba(P.r, 0.35 + 0.5 * (1 - e.tele / e.teleMax)); ex.lineWidth = 0.5; ex.setLineDash([4, 3]); ex.beginPath(); ex.moveTo(x, y); ex.lineTo(x + dx / l * L, y + dy / l * L); ex.stroke(); ex.setLineDash([]);
        }
        if ((S.t * 4 | 0) % 2) LT(x - e.face * 22, y - z - 10, 14, P.r, 0.6);
        if (tele) LT(x + e.face * 18, y - z - 6, 26, P.O, 0.9);
        if (e.phase === 2 && S.rng.chance(0.2)) part(S, 'smoke', x - e.face * 6, y - z - 10, S.rng.range(-10, 10), S.rng.range(-30, -10), 0.6, '#3a3d4a');
        return true;
      }
    }
    return true;
  };

  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    if (de0) de0(S, list, ctx, ex);
    const SP = D.SPR, f = S.f;
    // 护盾塔连着主脑的细线
    for (const e of S.enemies) if (!e.dead && e.f === f && e.kind === 'bx_node' && e.owner && !e.owner.dead) { const c = e.owner; list.push({ y: -1e9, f: () => { ex.strokeStyle = D.rgba('#3ee8ff', 0.25 + 0.15 * Math.sin(S.t * 6 + e.slot)); ex.lineWidth = 0.5; ex.beginPath(); ex.moveTo(e.x, e.y - 10); ex.lineTo(c.x, c.y - 16); ex.stroke(); } }); }
    for (const W of S.bxWaves || []) if (W.f === f && W.t >= 0) list.push({ y: -1e9, f: () => {
      const Rr = W.v * W.t, k = 1 - Rr / W.max;
      ctx.strokeStyle = D.rgba('#0b0a14', 0.5 * k); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(W.x, W.y, Rr, Rr / 1.4, 0, 0, TAU); ctx.stroke();
      ex.strokeStyle = D.rgba(P.O, 0.85 * k); ex.lineWidth = 1.5; ex.beginPath(); ex.ellipse(W.x, W.y, Rr, Rr / 1.4, 0, 0, TAU); ex.stroke();
    } });
    for (const Z of S.bxZones || []) if (Z.f === f && Z.t >= 0) list.push({ y: -1e9, f: () => {
      const on = Z.t >= Z.warn, k = Math.min(1, Z.t / Z.warn);
      if (on) { ex.fillStyle = D.rgba('#ffd84a', 0.45); ex.beginPath(); ex.ellipse(Z.x, Z.y, Z.r, Z.r / 1.4, 0, 0, TAU); ex.fill(); }
      else { ex.strokeStyle = D.rgba('#ffd84a', 0.3 + 0.5 * k); ex.lineWidth = (Z.t * (6 + Z.t * 10) | 0) % 2 ? 1 : 0.5; ex.beginPath(); ex.ellipse(Z.x, Z.y, Z.r, Z.r / 1.4, 0, 0, TAU); ex.stroke(); ex.fillStyle = D.rgba('#ffd84a', 0.08 + 0.12 * k); ex.fill(); }
    } });
    for (const Q of S.bxRocks || []) if (Q.f === f && Q.t >= 0) list.push({ y: Q.y, f: () => {
      const k = Math.min(1, Q.t / Q.warn);
      ctx.fillStyle = D.rgba('#0b0a14', 0.2 + 0.35 * k); ctx.beginPath(); ctx.ellipse(Q.x, Q.y, Q.r * (0.4 + 0.6 * k), Q.r * (0.4 + 0.6 * k) / 1.4, 0, 0, TAU); ctx.fill();
      if (Q.t > Q.warn - 0.35) D.blit(ctx, SP.bx_rock, Q.x, Q.y + 1 - (Q.warn - Q.t) / 0.35 * 120, false, null);
    } });
    for (const B of S.bxBombs || []) if (B.f === f) list.push({ y: -1e9, f: () => { const on = (B.t * (8 + B.t * 30) | 0) % 2; ex.strokeStyle = D.rgba(P.r, on ? 0.9 : 0.4); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(B.x, B.y, B.r, B.r / 1.6, 0, 0, TAU); ex.stroke(); if (on) { ex.fillStyle = P.r; ex.fillRect(B.x - 0.5, B.y - 1.5, 1, 1); } } });
    for (const O of S.bxOrbs || []) if (O.f === f) list.push({ y: O.y + 6, f: () => { D.blit(ex, SP.bx_orb, O.x, O.y + 2.5, false, 'emit'); D.blit(ctx, SP.bx_orb, O.x, O.y + 2.5, false, null); S.tlights.push({ x: O.x, y: O.y, r: 26, col: '#ffd84a', a: 0.9, decay: 30 }); } });
    const SG = S.bxSurge;
    if (SG && SG.f === f) list.push({ y: -1e9, f: () => {
      const k = Math.min(1, SG.t / SG.warn);
      for (const q of SG.pads) { ex.fillStyle = D.rgba(P.g, 0.18 + 0.12 * Math.sin(S.t * 8)); ex.beginPath(); ex.ellipse(q.x, q.y, q.r, q.r / 1.4, 0, 0, TAU); ex.fill(); ex.strokeStyle = D.rgba(P.g, 0.9); ex.lineWidth = 1; ex.stroke(); }
      if ((S.t * (4 + k * 12) | 0) % 2) { ex.strokeStyle = D.rgba('#ffd84a', 0.15 + 0.3 * k); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(SG.src.x, SG.src.y, 340 * k, 340 * k / 1.4, 0, 0, TAU); ex.stroke(); }
    } });
    for (const B of S.bxRebuild || []) if (B.f === f) list.push({ y: B.y, f: () => {
      D.blit(ctx, SP.bx_twincore, B.x, B.y + 1, false, null); D.blit(ex, SP.bx_twincore, B.x, B.y + 1, false, 'emit');
      const k = B.t / B.dur; ex.strokeStyle = D.rgba('#ff3d8b', 0.8); ex.lineWidth = 1; ex.beginPath(); ex.arc(B.x, B.y - 4, 10, -Math.PI / 2, -Math.PI / 2 + TAU * k); ex.stroke();
      S.tlights.push({ x: B.x, y: B.y - 4, r: 24 + k * 20, col: '#ff3d8b', a: 0.8, decay: 30 });
    } });
  };

  // ── 出在哪：危险等级越高越常见；沦陷区的虫巢 / 检查站 / 数据中心照旧出老的镇守首领
  const gb0 = K.spawnGuardBoss;
  K.spawnGuardBoss = function (S, rng) {
    if (gb0) gb0.apply(this, arguments);
    const st = S.st; if (S.guardBoss || S.tut || !st || st.home || !S.raid) return;
    const list = D.BX_AT[st.type]; if (!list) return;
    let h = 4242; for (const c of String(st.id) + ':' + (S.raid.step | 0)) h = (h * 31 + c.charCodeAt(0)) | 0;
    const r2 = D.rng(h), lv = D.threatLv(S.raid);
    if (!(r2() < D.bxChance(st.tier || 0, lv))) return;
    const k = list[Math.floor(r2() * list.length)];
    spawnBxBoss(S, k);
  };
  function spawnBxBoss(S, k, fi) {
    fi = fi == null ? S.floors.length - 1 : fi; const F = S.floors[fi];
    const rooms = F.rooms.filter(r => !r.hidden && r.kind !== 'platform' && r.w >= 8 && r.h >= 6).sort((a, b) => b.w * b.h - a.w * a.h), r = rooms[0] || F.rooms[0]; if (!r) return null;
    const x = (r.x + r.w / 2) * TS, y = (r.y + r.h / 2) * TS, home = { x, y, w: r.w * TS, h: r.h * TS };
    r.boss = k;
    if (k === 'bx_twins') {
      const a = K.spawnEnemy(S, 'bx_pincer', x - 26, y, 1, fi), b = K.spawnEnemy(S, 'bx_hammer', x + 26, y, 1, fi);
      for (const o of [a, b]) { o.home = home; if (D.solidAt(F, o.x, o.y)) { o.x = x; o.y = y; } }
      a.twin = b; b.twin = a; S.guardBoss = a; return a;
    }
    const e = K.spawnEnemy(S, k, x, y, 1, fi); e.home = home; S.guardBoss = e; return e;
  }
  D.spawnBxBoss = spawnBxBoss;
})(D);
