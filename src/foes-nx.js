/* Underdog：第四批敌人（2026-11-17 用户："现在的敌人太少太简单，请你更新更多更牛逼的敌人"）
   之前 140 多种敌人里，真正不同的打法只有十来种（其余是同一套 AI 换数值换皮）。这一批每种都有自己的新招：
     镜盾兵（子弹弹回来）、裂变团（打碎分裂两代）、布雷车（地上撒雷）、链锯狂（三连冲 + 半血狂暴）、
     电桩（三根之间拉电网）、指挥官（督战 + 信号弹呼叫炮击，死了全场愣住）、焚烧兵（喷火 + 地上火海）、
     跃击者（跳出画面、红圈追着你、砸地）、重组机（把同伴残骸拼回来）、导弹巢（能打下来的追踪导弹）、
     守护机（光束连着的同伴只受两成伤害）、残影刺客（闪到你背后背刺）。
   另外加精英词缀：普通敌人按威胁和危险等级有一定几率变成精英（狂暴 / 铁壁 / 电涌 / 殉爆 / 吸血 / 闪现），耐久更高、多掉一件东西。
   出怪：按站的类型进守卫表，但外环低威胁的站不出（minTier / minLv），cap 限制同一站最多几只。
   只靠挂钩接进去：K.spawnGarrison、K.intentX / stepX / startX / actX、K.foesPost、K.onKillX、K.hurt、K.shotMul、K.damagePlayer、
   D.initHiArt、D.drawFoe、D.drawExtras。键一律 nx_ 开头，别和老敌人重名。
   放在 enemy-art-ext.js 之后加载（它在加载时按 base 给老敌人分站，不能把这一批算进去）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const K = D.K || (D.K = {});
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a);
  const isBoss = e => !!D.ENEMIES[e.kind].boss;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ── 数据
  const NX = {
    nx_mirror: { name: '镜盾兵', hp: 52, r: 6, speed: 40, loot: 2, human: true, sight: 150, at: ['armory', 'checkpoint', 'bank', 'museum'], w: 0.9, minTier: 1, minLv: 4, tag: '举着镜面盾的回收者，子弹打上去会弹回来',
      moves: ['镜面盾：从正面打它的子弹会原样弹回来打你', '放盾开枪：它开枪的那一下盾是放下的，这时候能打', '绕后：从侧面、背后打，或者用近战、爆炸，盾就没用'] },
    nx_splitter: { name: '裂变团', hp: 56, r: 8, speed: 42, loot: 1, sight: 110, at: ['nest', 'ruin', 'hospital'], w: 1, minTier: 1, minLv: 3, tag: '一团纳米机械拼成的软体，打碎了会分开',
      moves: ['扑压：蹲一下整团扑过来', '分裂：打碎了分成两个小团，小团再碎成两只锈螨', '先清小的：别让碎块围住你'] },
    nx_splitlet: { name: '裂变子团', hp: 18, r: 5, speed: 70, loot: 0, sight: 120, at: [], tag: '裂变团碎开的小团',
      moves: ['扑压：更小、更快', '再分裂：打碎了变成两只锈螨'] },
    nx_layer: { name: '布雷车', hp: 38, r: 7, speed: 46, loot: 2, sight: 140, at: ['depot', 'factory', 'hangar'], w: 0.9, minTier: 1, minLv: 3, tag: '一边跑一边往地上撒地雷的小履带车',
      moves: ['撒雷：边退边在身后放地雷，红灯亮了就是装好了', '抛雷：把一颗地雷扔到你脚下', '地雷：走近会滴一声再炸；车死了地雷还在'] },
    nx_ripper: { name: '链锯狂', hp: 70, r: 7, speed: 64, loot: 2, sight: 130, at: ['factory', 'ruin', 'market'], w: 0.8, cap: 2, minTier: 2, minLv: 5, tag: '两条胳膊换成链锯的拆迁机，疯了',
      moves: ['三连冲：连冲三下，每一下都重新对准你', '过热：冲完要冒烟喘一下，这时候打它', '狂暴（半血）：动作快很多，眼睛变红'] },
    nx_pylon: { name: '电桩', hp: 30, r: 5, speed: 32, loot: 1, sight: 140, pack: 3, at: ['relay', 'datacenter', 'depot'], w: 0.7, minTier: 1, minLv: 4, tag: '三根一组的电桩，彼此之间拉着电弧',
      moves: ['扎根：走到你附近就扎下不动', '电网：扎下的电桩之间连着电弧，穿过去会被电', '电击：偶尔放一道弱电', '拆网：打掉一根，连着它的电弧就断了'] },
    nx_captain: { name: '指挥官', hp: 64, r: 6, speed: 42, loot: 3, human: true, sight: 170, at: ['checkpoint', 'armory', 'hangar', 'bank'], w: 0.6, cap: 1, minTier: 2, minLv: 5, tag: '回收者的小头目，腰上别着信号枪',
      moves: ['督战：身边的敌人动作快 25%，头上冒金色箭头', '信号弹：往你脚下打一发红色信号弹，一会儿炮弹就落下来', '点射：三连发', '指挥中断：它一死，身边的敌人都会愣一下'] },
    nx_pyro: { name: '焚烧兵', hp: 58, r: 6, speed: 50, loot: 2, human: true, sight: 130, at: ['factory', 'nest', 'depot'], w: 0.8, minTier: 1, minLv: 4, tag: '背着燃料罐的清场队员',
      moves: ['喷火：一道火流扫过来，它转身慢，绕着它跑', '火海：喷过的地面会烧一会儿，别站在火里', '燃料罐：打死它罐子会炸'] },
    nx_pouncer: { name: '跃击者', hp: 84, r: 8, speed: 38, loot: 3, sight: 150, at: ['hangar', 'depot', 'ruin', 'museum'], w: 0.6, cap: 2, minTier: 2, minLv: 6, tag: '能一跳跳出画面的重型跳跃机',
      moves: ['腾空：一跳跳出画面，这时候打不到', '锁定：红圈跟着你走，缩小了就要砸下来，赶紧跑开', '砸地：落地一圈冲击波和子弹', '卡住：落地以后要缓一下，这时候打'] },
    nx_mender: { name: '重组机', hp: 34, r: 6, speed: 60, loot: 2, sight: 140, at: ['factory', 'hospital', 'datacenter'], w: 0.7, minTier: 1, minLv: 4, tag: '会把同伴的残骸重新拼起来的修理蛛',
      moves: ['重组：跑到残骸边上照两秒多绿光，同伴就站起来了（剩一半耐久）', '打断：重组的时候挨一下就断了', '躲：你一靠近就跑，先打它'] },
    nx_hive: { name: '导弹巢', hp: 44, r: 7, speed: 34, loot: 2, sight: 170, at: ['hangar', 'relay', 'armory'], w: 0.8, minTier: 1, minLv: 4, tag: '挂着一排小导弹的飞行发射架',
      moves: ['齐射：放出两枚追踪小导弹，会拐弯跟着你', '打下来：导弹一枪就能打掉', '甩掉：导弹转弯慢，侧着闪避就甩开了'] },
    nx_missile: { name: '追踪导弹', hp: 3, r: 3, speed: 96, loot: 0, sight: 300, at: [], tag: '导弹巢放出来的小导弹',
      moves: ['追踪：慢慢转向你飞过来，撞上就炸', '燃尽：飞五秒自己炸掉'] },
    nx_warder: { name: '守护机', hp: 36, r: 6, speed: 48, loot: 2, sight: 150, at: ['datacenter', 'bank', 'hospital', 'museum'], w: 0.7, minTier: 1, minLv: 4, tag: '给同伴套保护场的小飞机',
      moves: ['保护场：用光束连着一个同伴，连着的同伴只受两成伤害', '躲在后面：总躲在同伴身后', '断开：打掉它，或者让墙挡住光束'] },
    nx_phantom: { name: '残影刺客', hp: 46, r: 5, speed: 70, loot: 3, sight: 160, at: ['museum', 'datacenter', 'market', 'bank'], w: 0.6, cap: 2, minTier: 2, minLv: 6, tag: '会闪到你背后的刺杀机',
      moves: ['闪到背后：它消失一下，你身边出现红色残影，那就是它要出来的地方', '背刺：一出来就是一刀，看到残影马上闪避', '隐没：消失的时候打不到'] },
  };
  for (const k in NX) if (D.ENEMIES[k]) throw new Error('敌人键名重复：' + k);
  Object.assign(D.ENEMIES, NX);
  D.NX_FOES = Object.keys(NX);
  // 进哪些站（不写进 D.GARRISON：world.js 的几种站比这个文件晚加载；出怪时临时加进那一站的表）
  const AT_MORE = { nx_mirror: ['freight', 'reserve'], nx_splitter: ['flooded'], nx_layer: ['freight'], nx_ripper: ['blackout'], nx_pylon: ['flooded', 'dispatch'], nx_captain: ['dispatch', 'freight'], nx_pyro: ['freight'], nx_pouncer: ['blackout'], nx_hive: ['dispatch', 'reserve'], nx_warder: ['flooded', 'reserve'], nx_phantom: ['blackout'] };
  for (const k in AT_MORE) NX[k].at = NX[k].at.concat(AT_MORE[k]);
  // 外环低威胁不出：威胁到了 minLv，或者危险等级到了 minTier 且威胁到了 minLv - 2
  D.nxAllowed = (k, tier, lv) => { const E = NX[k]; return !E || !E.minLv || lv >= E.minLv || (tier >= E.minTier && lv >= E.minLv - 2); };

  // ── 精英词缀
  const AFX = {
    frenzy: { name: '狂暴', col: '#ff3d4a' },   // 一直快 25%
    bulwark: { name: '铁壁', col: '#5a92e8' },  // 更硬，带一层会回的护盾
    volt: { name: '电涌', col: '#ffd84a' },     // 挨打放一圈电球
    volatile: { name: '殉爆', col: '#ff8a2e' }, // 死了原地再炸一下
    leech: { name: '吸血', col: '#8dff6a' },    // 打到你会回血
    blink: { name: '闪现', col: '#3ee8ff' },    // 挨打会闪开
  };
  D.ELITE_AFFIX = AFX;
  function makeElite(e, a) {
    e.affix = a; e.hp = e.maxHp = Math.round(e.maxHp * (a === 'bulwark' ? 1.9 : 1.5)); e.affT = 0;
    if (a === 'bulwark') e.shield = Math.round(e.maxHp * 0.3);
  }
  D.makeElite = makeElite;
  const NO_ELITE = new Set(['nx_missile', 'nx_splitlet']);
  function rollElites(S, rng) {
    const lv = D.threatLv(S.raid), tier = S.st.tier, ch = Math.min(0.28, 0.02 + 0.025 * (lv - 1) + 0.03 * tier), max = 1 + Math.floor(lv / 3) + (tier >= 2 ? 1 : 0), keys = Object.keys(AFX);
    let n = 0;
    for (const e of S.enemies) {
      if (n >= max) break;
      const E = D.ENEMIES[e.kind];
      if (e.dead || e.affix || E.boss || E.elite || E.trash || e.owner || e.noLoot || NO_ELITE.has(e.kind) || !rng.chance(ch)) continue;
      makeElite(e, rng.pick(keys)); n++;
    }
  }
  function reKind(S, e, k) { const b = D.ENEMIES[k], m = e.maxHp / D.ENEMIES[e.kind].hp; e.kind = k; e.ai = b.base || k; e.r = b.r; e.hp = e.maxHp = Math.round(b.hp * m); e.intent = K.nextIntent(S, e); }

  // ── 出怪：进守卫表之前按威胁筛掉还不该出的；出完按 cap 换掉多的，再抽精英
  const sg0 = K.spawnGarrison;
  K.spawnGarrison = function (S, rng) {
    const st = S.st, lv = D.threatLv(S.raid), G = D.GARRISON[st.type], keep = G ? G.map(c => c.slice()) : null;
    // 权重按这一站原有的守卫算（老表又被扩充包加了五成，威胁高时威胁专属敌人再分走四成五）：每种约占老守卫的 45% × w
    if (G) { const base = G.reduce((s, c) => s + c[1], 0); for (const k of D.NX_FOES) if (NX[k].at.includes(st.type) && D.nxAllowed(k, st.tier, lv)) G.push([k, NX[k].w * base * 0.45]); }
    let r;
    try { r = sg0.apply(this, arguments); } finally { if (G) { G.length = 0; for (const c of keep) G.push(c.slice()); } }
    const cnt = {};
    for (const e of S.enemies) { const E = NX[e.kind]; if (!E || !E.cap) continue; cnt[e.kind] = (cnt[e.kind] || 0) + 1; if (cnt[e.kind] > E.cap) reKind(S, e, 'raider'); }
    if (!S.tut) rollElites(S, rng);
    return r;
  };

  // ── 像素图
  const mk = (w, h, fn) => { const p = D.Paint(w, h); fn(p); p.outline(); return p.make(2); };
  const h0 = D.initHiArt;
  D.initHiArt = function () {
    const r = h0 ? h0.apply(this, arguments) : undefined, SP = D.SPR;
    SP.nx_mirror = mk(22, 26, p => {
      p.box(6, 18, 4, 8, R.dark, { r: 1 }); p.box(12, 18, 4, 8, R.dark, { r: 1 });
      p.box(5, 9, 12, 10, R.steel, { r: 2 }); p.rect(5, 15, 12, 1, '#e3c14a'); p.rect(8, 10, 1, 5, '#232a42');
      p.box(16, 11, 5, 3, R.gunmetal, { r: 1 });
      p.ell(11, 5, 4.5, 4.5, R.gunmetal, { spec: true }); p.rect(8, 4, 7, 2, '#a6e2f0', 1);
    });
    SP.nx_splitter = mk(28, 20, p => {
      p.ell(14, 12, 12, 7.5, R.glass, { spec: true }); p.ell(7, 8, 5.5, 4.5, R.glass, { spec: true }); p.ell(20, 7, 6, 5, R.glass, { spec: true });
      for (const [x, y] of [[5, 14], [11, 16], [18, 15], [23, 12], [14, 9]]) p.px(x, y, '#1d4a60');
      p.disc(14, 12, 3, '#3a7a4a'); p.disc(14, 12, 2, '#8dff6a', 1); p.px(9, 7, '#b4ec98', 1); p.px(21, 6, '#b4ec98', 1);
      p.rect(6, 18, 2, 2, '#2f6e88'); p.rect(20, 18, 2, 2, '#2f6e88');
    });
    SP.nx_splitlet = mk(16, 13, p => { p.ell(8, 7, 7, 5.5, R.glass, { spec: true }); p.disc(8, 7, 1.8, '#8dff6a', 1); p.px(5, 5, '#b4ec98', 1); p.rect(3, 11, 2, 2, '#2f6e88'); p.rect(11, 11, 2, 2, '#2f6e88'); });
    SP.nx_layer = mk(26, 17, p => {
      p.box(1, 10, 24, 7, R.dark, { r: 2 }); for (let x = 3; x < 24; x += 4) p.disc(x + 0.5, 13.5, 1.5, '#3d4766');
      p.box(4, 3, 16, 8, R.olive, { r: 2 }); for (let x = 5; x < 19; x += 4) p.rect(x, 8, 2, 2, '#e3c14a');
      p.box(15, 0, 8, 5, R.yellow, { r: 1 }); p.rect(16, 1, 6, 1, '#5a3e0d'); p.px(7, 4, '#ff3047', 1); p.px(8, 4, '#ff3047', 1);
    });
    const ripper = eye => mk(28, 25, p => {
      p.rect(9, 17, 3, 8, '#2d3550'); p.rect(16, 17, 3, 8, '#2d3550'); p.rect(8, 23, 5, 2, '#20263b'); p.rect(15, 23, 5, 2, '#20263b');
      p.ell(14, 11, 7.5, 7, R.rust, { spec: true }); p.rect(9, 13, 10, 1, '#3b2018');
      for (const x0 of [0, 22]) { p.box(x0, 8, 6, 13, R.silver, { r: 1 }); for (let y = 9; y < 20; y += 2) p.px(x0 + (x0 ? 5 : 0), y, '#3a3f4c'); p.rect(x0 + 2, 6, 2, 3, '#646e86'); }
      p.box(9, 1, 10, 7, R.dark, { r: 2 }); p.rect(10, 3, 8, 2, eye, 1);
    });
    SP.nx_ripper = ripper('#ffb057'); SP.nx_ripperR = ripper('#ff3047');
    SP.nx_pylon = mk(14, 28, p => {
      p.rect(2, 24, 3, 4, '#20263b'); p.rect(9, 24, 3, 4, '#20263b');
      p.box(1, 20, 12, 6, R.dark, { r: 1 }); p.box(4, 7, 6, 14, R.gunmetal, { r: 1 });
      for (const y of [9, 12, 15, 18]) p.rect(3, y, 8, 1, '#bd6d2c');
      p.ell(7, 4.5, 4.5, 4.5, R.yellow, { spec: true }); p.disc(7, 4.5, 2, '#fff3b0', 1);
    });
    SP.nx_captain = mk(22, 27, p => {
      p.box(6, 19, 4, 8, R.dark, { r: 1 }); p.box(12, 19, 4, 8, R.dark, { r: 1 });
      p.box(4, 10, 14, 11, R.olive, { r: 2 }); p.line(6, 11, 15, 19, '#c82e3a'); p.rect(4, 10, 3, 2, '#ffd860'); p.rect(15, 10, 3, 2, '#ffd860');
      p.box(17, 14, 4, 3, R.red, { r: 1 });
      p.ell(11, 6, 4, 4.2, R.cloth, { spec: true }); p.rect(8, 6, 6, 1, '#1b100b'); p.ell(11, 2.5, 5.5, 2.5, R.red, { flat: true }); p.px(13, 2, '#ffd860', 1);
    });
    SP.nx_pyro = mk(22, 27, p => {
      p.ell(5, 13, 3.5, 7, R.red, { spec: true }); p.rect(3, 6, 2, 3, '#646e86');
      p.box(6, 19, 4, 8, R.dark, { r: 1 }); p.box(12, 19, 4, 8, R.dark, { r: 1 });
      p.box(6, 9, 11, 11, R.copper, { r: 2 }); p.rect(6, 15, 11, 1, '#2a1206'); p.rect(14, 10, 1, 9, '#5a2a10');
      p.ell(12, 5, 4.5, 4.5, R.gunmetal, { spec: true }); p.rect(10, 4, 5, 2, '#ffb057', 1); p.disc(15, 7, 1.5, '#434b5f');
    });
    SP.nx_pouncer = mk(32, 27, p => {
      p.box(2, 15, 7, 10, R.steel, { r: 2 }); p.box(23, 15, 7, 10, R.steel, { r: 2 }); p.rect(1, 24, 9, 3, '#232a42'); p.rect(22, 24, 9, 3, '#232a42');
      p.line(8, 14, 12, 21, '#eab52e'); p.line(24, 14, 20, 21, '#eab52e');
      p.ell(16, 12, 11.5, 8, R.plate, { spec: true }); p.rect(8, 15, 16, 1, '#2a3350'); for (let x = 10; x < 23; x += 4) p.rect(x, 17, 2, 1, '#e3c14a');
      p.box(19, 3, 10, 7, R.dark, { r: 2 }); p.rect(22, 5, 5, 2, '#ff3047', 1);
    });
    SP.nx_mender = mk(24, 17, p => {
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const fx = 12 + s * 11, fy = 10 + i * 3; p.line(12 + s * 3, 8 + i, 12 + s * 8, 5 + i, '#646e86'); p.line(12 + s * 8, 5 + i, fx, fy, '#434b5f'); }
      p.ell(12, 8, 6.5, 5, R.white, { spec: true }); p.rect(11, 5, 2, 5, '#4a9a48'); p.rect(9, 7, 6, 1, '#4a9a48'); p.rect(11, 6, 2, 3, '#8dff6a', 1);
      p.line(17, 6, 21, 2, '#949fb6'); p.px(21, 1, '#8dff6a', 1);
    });
    SP.nx_hive = mk(26, 19, p => {
      p.rect(0, 1, 9, 1, '#949fb6'); p.rect(17, 1, 9, 1, '#949fb6'); p.rect(12, 0, 2, 4, '#434b5f');
      p.box(2, 4, 22, 11, R.gunmetal, { r: 2 });
      for (let i = 0; i < 4; i++) { p.box(4 + i * 5, 6, 4, 7, R.dark, { r: 1 }); p.px(5 + i * 5, 6, '#ff3047', 1); p.px(6 + i * 5, 6, '#ff3047', 1); }
      p.ell(13, 16, 3, 2, R.copper, { flat: true }); p.disc(13, 17, 1.2, '#ffd95c', 1);
    });
    SP.nx_missile = mk(12, 7, p => { p.rect(0, 1, 2, 5, '#434b5f'); p.box(1, 2, 8, 3, R.silver, { r: 1 }); p.rect(9, 2, 2, 3, '#ff3047', 1); p.px(0, 3, '#ffd95c', 1); });
    SP.nx_warder = mk(22, 19, p => {
      p.rect(0, 8, 5, 2, '#5a92e8'); p.rect(17, 8, 5, 2, '#5a92e8');
      p.ell(11, 9.5, 7.5, 6.5, R.blue, { spec: true }); p.rect(5, 13, 12, 1, '#132a5a');
      p.disc(11, 9, 3, '#0a1630'); p.disc(11, 9, 2, '#3ee8ff', 1); p.px(10, 8, '#ffffff', 1);
      p.rect(10, 16, 2, 3, '#3466c0');
    });
    SP.nx_phantom = mk(18, 25, p => {
      p.box(4, 9, 10, 14, R.magenta, { r: 2, bias: -0.2 }); for (let x = 5; x < 14; x += 3) p.rect(x, 21, 2, 3, '#381443');
      p.line(14, 10, 17, 20, '#dbe5fa'); p.line(15, 10, 17, 17, '#a3b6dc');
      p.ell(9, 5, 4.5, 4.5, R.dark, { spec: true }); p.px(7, 5, '#ff3d8b', 1); p.px(10, 5, '#ff3d8b', 1);
    });
    SP.nx_mine = mk(10, 6, p => { p.ell(5, 3.5, 4.5, 2.5, R.gunmetal, { spec: true }); p.px(5, 2, '#ff3047', 1); });
    SP.nx_flare = mk(6, 6, p => { p.box(1, 1, 4, 4, R.red, { r: 1 }); p.px(2, 1, '#ffd0d4', 1); });
    return r;
  };

  // ── 招式表
  const ix0 = K.intentX;
  K.intentX = function (S, e) {
    switch (e.kind) {
      case 'nx_mirror': return { k: 'burst', dmg: 6, n: 3, tele: 0.55 };
      case 'nx_splitter': return { k: 'leap', dmg: 10, tele: 0.5 };
      case 'nx_splitlet': return { k: 'leap', dmg: 6, tele: 0.35 };
      case 'nx_layer': return { k: 'nxlob', tele: 0.6 };
      case 'nx_ripper': return { k: 'nxrip', dmg: 8, tele: e.enraged ? 0.4 : 0.6 };
      case 'nx_pylon': return { k: 'zap', dmg: 4, tele: 0.6 };
      case 'nx_captain': return (e.step++ % 2) ? { k: 'burst', dmg: 6, n: 3, tele: 0.45 } : { k: 'nxflare', tele: 0.7 };
      case 'nx_pyro': return { k: 'nxflame', dmg: 3, tele: 0.55 };
      case 'nx_pouncer': return { k: 'nxpounce', dmg: 14, tele: 0.5 };
      case 'nx_mender': return { k: 'zap', dmg: 3, tele: 0.6 };
      case 'nx_hive': return { k: 'nxmiss', n: 2, tele: 0.7 };
      case 'nx_missile': return { k: 'nxnone', tele: 9 };
      case 'nx_warder': return { k: 'burst', dmg: 3, n: 2, tele: 0.55 };
      case 'nx_phantom': return { k: 'nxblink', dmg: 12, tele: 0.35 };
    }
    return ix0(S, e);
  };

  // ── 走位
  const mirrorUp = e => e.kind === 'nx_mirror' && !(e.tele > 0) && !e.act && !(e.stun > 0);
  function blinkAway(S, e, r0, r1) {
    const p = S.player;
    for (let i = 0; i < 24; i++) {
      const b = S.rng() * TAU, r = S.rng.range(r0, r1), x = p.x + Math.cos(b) * r, y = p.y + Math.sin(b) * r;
      if (x > 20 && y > 20 && x < S.A.w - 20 && y < S.A.h - 20 && !D.solidAt(S.A, x, y) && !D.solidAt(S.A, x, y - 8) && D.losClear(S.A, x, y - 6, p.x, p.y - 6)) {
        echo(S, e); for (let j = 0; j < 10; j++) part(S, 'spark', e.x, e.y - 8, S.rng.range(-60, 60), S.rng.range(-70, 10), 0.3, P.m);
        e.x = x; e.y = y; ring(S, e.x, e.y - 6, 16, P.m); sfx('dash'); return true;
      }
    }
    return false;
  }
  function echo(S, e) { const spr = D.SPR[e.kind]; if (spr) (S.nxEchoes = S.nxEchoes || []).push({ sk: e.kind, x: e.x, y: e.y, f: e.f, flip: e.face < 0, t0: S.t }); }
  function dropMine(S, e, sx, sy, tx, ty, fly) {
    if (D.solidAt(S.A, tx, ty)) return;
    const L = S.nxMines = S.nxMines || [], own = L.filter(m => m.owner === e);
    if (own.length >= 6) own[0].fizzle = true;
    L.push({ x: sx, y: sy, sx, sy, tx, ty, t: 0, fly, z: 0, f: e.f, owner: e });
  }
  function mendTarget(S, e) {
    let best = null, bd = 240;
    for (const w of S.nxWrecks || []) {
      if (w.used || w.f !== e.f || S.t - w.t0 > 40 || (w.taken && w.taken !== e && !w.taken.dead)) continue;
      const d = dist(w, e); if (d < bd) { bd = d; best = w; }
    }
    return best;
  }
  function wardPick(S, e) {
    let best = null, bs = -1;
    for (const o of S.enemies) {
      if (o.dead || o === e || o.f !== e.f || o.kind === 'nx_warder' || o.kind === 'nx_missile' || isBoss(o) || o.owner) continue;
      const d = dist(o, e); if (d > 170) continue;
      const sc = o.maxHp - d * 0.3 + (o === e.ward ? 30 : 0); if (sc > bs) { bs = sc; best = o; }
    }
    return best;
  }
  function missileStep(S, e, dt, T) {
    if (e.ma == null) e.ma = Math.atan2(T.y - e.y, T.x - e.x);
    e.life = (e.life == null ? 5 : e.life) - dt;
    e.ma += D.clamp(D.angDiff(e.ma, Math.atan2(T.y - e.y, T.x - e.x)), -2.3 * dt, 2.3 * dt);
    const sp = D.ENEMIES.nx_missile.speed * Math.min(1, 0.4 + (5 - e.life) * 1.2), bx = e.x, by = e.y;
    D.move(S.A, e, Math.cos(e.ma) * sp * dt, Math.sin(e.ma) * sp * dt); e.face = Math.cos(e.ma) >= 0 ? 1 : -1;
    if (S.t % 0.05 < dt) part(S, 'smoke', e.x - Math.cos(e.ma) * 4, e.y - 6, S.rng.range(-10, 10), S.rng.range(-20, 0), 0.5, '#646e86');
    const stuck = e.life < 4.6 && Math.hypot(e.x - bx, e.y - by) < sp * dt * 0.3;
    if (Math.hypot(T.x - e.x, T.y - e.y) < 10 || e.life <= 0 || stuck) { e.hp = 0; K.explode(S, e.x, e.y - 4, 20, 9, true); K.kill(S, e, true); }
  }
  const sx0 = K.stepX;
  K.stepX = function (S, e, dt, T, d, ux, uy, los, move, b) {
    if (!NX[e.kind]) return sx0(S, e, dt, T, d, ux, uy, los, move, b);
    const begin = () => K.begin(S, e), perp = Math.sin(e.t * 0.9 + e.slot);
    const keep = (lo, hi, side, sp) => { const want = d < lo ? -1.2 : d > hi ? 1 : 0; move(ux * want + (-uy) * perp * side, uy * want + ux * perp * side, sp || b.speed); };
    switch (e.kind) {
      case 'nx_mirror':
        e.shieldA += D.angDiff(e.shieldA, Math.atan2(T.y - e.y, T.x - e.x)) * Math.min(1, dt * 2.4);
        keep(60, 110, 0.5); if (e.cd <= 0 && los && d < 190) begin(); break;
      case 'nx_splitter': case 'nx_splitlet': {
        const wob = Math.sin(e.t * 6 + e.slot) * 0.5; move(ux + (-uy) * wob, uy + ux * wob, b.speed * (d > 26 ? 1 : 0.2));
        if (e.cd <= 0 && d < (e.kind === 'nx_splitter' ? 80 : 64)) begin(); break;
      }
      case 'nx_layer':
        keep(90, 150, 0.9, b.speed * (d < 90 ? 1.3 : 1));
        e.mineCd = (e.mineCd == null ? 1.2 : e.mineCd) - dt;
        if (e.mineCd <= 0) { e.mineCd = S.rng.range(2, 2.8); dropMine(S, e, e.x, e.y, e.x, e.y, 0); sfx('beep'); }
        if (e.cd <= 0 && d < 170) begin(); break;
      case 'nx_ripper':
        if (!e.enraged && e.hp < e.maxHp / 2) { e.enraged = true; text(S, e.x, e.y - 26, '狂暴', P.r); sfx('bosswarn'); addShake(S, 0.3); }
        move(ux, uy, b.speed * (d > 20 ? 1 : 0)); if (e.cd <= 0 && d < 100) begin(); break;
      case 'nx_pylon':
        if (e.planted && d > 240) e.planted = false;
        if (!e.planted) {
          const tx = T.x + Math.cos(e.slot) * 70, ty = T.y + Math.sin(e.slot) * 50;
          move(tx - e.x, ty - e.y, b.speed);
          if ((d < 150 || Math.hypot(tx - e.x, ty - e.y) < 12) && !D.solidAt(S.A, e.x, e.y)) { e.planted = true; ring(S, e.x, e.y, 10, '#ffd84a'); sfx('shield'); }
        }
        if (e.cd <= 0 && los && d < 160) begin(); break;
      case 'nx_captain':
        keep(120, 190, 0.6); if (e.cd <= 0 && d < 220 && (los || e.intent.k === 'nxflare')) begin(); break;
      case 'nx_pyro':
        keep(40, 62, 0.7); if (e.cd <= 0 && d < 80 && los) begin(); break;
      case 'nx_pouncer':
        keep(80, 140, 0.5); if (e.cd <= 0 && d < 200) begin(); break;
      case 'nx_mender': {
        if (d < 70) { move(-ux + (-uy) * perp, -uy + ux * perp, b.speed * 1.3); break; }
        const w = mendTarget(S, e);
        if (w) {
          const l = dist(w, e);
          if (l > 10) move(w.x - e.x, w.y - e.y, b.speed);
          else { w.taken = e; e.act = { k: 'nxmend', t: 0, dur: 2.4, w, h0: e.hurtAt }; sfx('charge'); }
          break;
        }
        keep(100, 160, 0.8); if (e.cd <= 0 && los && d < 170) begin(); break;
      }
      case 'nx_hive': keep(110, 170, 0.8); if (e.cd <= 0 && d < 220) begin(); break;
      case 'nx_missile': missileStep(S, e, dt, T); break;
      case 'nx_warder': {
        const a = wardPick(S, e);
        if (a) { const bx = a.x - ux * 26 + (-uy) * perp * 10, by = a.y - uy * 26 + ux * perp * 10; if (Math.hypot(bx - e.x, by - e.y) > 6) move(bx - e.x, by - e.y, b.speed); }
        else keep(90, 150, 0.8);
        e.ward = a && dist(a, e) < 120 && D.losClear(S.A, e.x, e.y - 8, a.x, a.y - 6) ? a : null;
        if (e.cd <= 0 && los && d < 180) begin(); break;
      }
      case 'nx_phantom': keep(70, 130, 1); if (e.cd <= 0 && d < 220) begin(); break;
    }
  };

  // ── 出招
  const st0 = K.startX;
  K.startX = function (S, e, T, a) {
    const it = e.intent, next = () => { e.intent = K.nextIntent(S, e); };
    switch (it.k) {
      case 'nxnone': next(); return;
      case 'nxlob': { const tx = T.x + (T.vx || 0) * 0.5, ty = T.y + (T.vy || 0) * 0.5; dropMine(S, e, e.x, e.y - 8, tx, ty, 0.5); sfx('throw'); e.cd = S.rng.range(2.2, 3); next(); return; }
      case 'nxrip': e.act = { k: 'nxrip', t: 0, n: 3, ph: 0, hit: false, aimed: false }; sfx('charge2'); return;
      case 'nxflare': {
        const tx = T.x + (T.vx || 0) * 0.3, ty = T.y + (T.vy || 0) * 0.3;
        (S.nxFlares = S.nxFlares || []).push({ x: e.x, y: e.y - 10, sx: e.x, sy: e.y - 10, tx, ty, t: 0, fly: 0.4, f: e.f, dmg: 10, n: 5, fired: false, z: 0 });
        sfx('throw'); e.cd = S.rng.range(2.5, 3.2); next(); return;
      }
      case 'nxflame': e.act = { k: 'nxflame', t: 0, dur: 1.2, a, tick: 0, fire: 0.15 }; sfx('charge2'); return;
      case 'nxpounce': e.act = { k: 'nxpounce', t: 0, ph: 0 }; sfx('leap'); return;
      case 'nxmiss': {
        const own = S.enemies.filter(o => !o.dead && o.hive === e).length;
        for (let i = 0; i < it.n && own + i < 6; i++) {
          const s = i % 2 ? 1 : -1, x = e.x + s * 8, y = e.y + 2, bad = D.solidAt(S.A, x, y);
          const o = K.spawnEnemy(S, 'nx_missile', bad ? e.x : x, bad ? e.y : y, 0, e.f, true); o.hive = e; o.noLoot = true; o.minion = true; o.ma = a + s * 1.3;
        }
        flashLight(S, e.x, e.y - 10, 50, P.O, 1); sfx('orb'); e.cd = S.rng.range(2.6, 3.4); next(); return;
      }
      case 'nxblink': {
        const p = S.player, aim = p.aim || 0;
        let tx = null, ty = null;
        for (const off of [Math.PI, Math.PI * 0.6, -Math.PI * 0.6, Math.PI / 2, -Math.PI / 2]) {
          const x = p.x + Math.cos(aim + off) * 22, y = p.y + Math.sin(aim + off) * 22;
          if (!D.solidAt(S.A, x, y) && !D.solidAt(S.A, x, y - 8)) { tx = x; ty = y; break; }
        }
        if (tx == null) { e.cd = 0.6; next(); return; }
        echo(S, e); for (let j = 0; j < 10; j++) part(S, 'spark', e.x, e.y - 8, S.rng.range(-60, 60), S.rng.range(-70, 10), 0.3, P.m);
        e.gone = true; e.z = 999; e.act = { k: 'nxblink', t: 0, ph: 0, tx, ty }; sfx('dash'); return;
      }
    }
    return st0(S, e, T, a);
  };
  const ax0 = K.actX;
  K.actX = function (S, e, dt, T, done) {
    const A = e.act, p = S.player, next = () => { e.intent = K.nextIntent(S, e); };
    switch (A.k) {
      case 'nxrip': {
        const aim = () => { const a = Math.atan2(T.y - e.y, T.x - e.x), s = e.enraged ? 340 : 290; A.vx = Math.cos(a) * s; A.vy = Math.sin(a) * s; A.aimed = true; e.face = A.vx >= 0 ? 1 : -1; };
        if (A.ph === 0) {
          if (!A.aimed) aim();
          D.move(S.A, e, A.vx * dt, A.vy * dt);
          if (S.t % 0.03 < dt) part(S, 'spark', e.x - A.vx * 0.02, e.y - 6, S.rng.range(-50, 50), S.rng.range(-60, 0), 0.25, P.Y);
          if (!A.hit && dist(p, e) < e.r + p.r + 4 && p.hp > 0) { A.hit = true; K.damagePlayer(S, e.intent.dmg, e); S.ghosts.push({ k: 'slash', x: e.x, y: e.y - 6, a: Math.atan2(A.vy, A.vx), t: 0.12 }); }
          if (A.t >= 0.2) { A.n--; A.t = 0; A.ph = 1; }
        } else if (A.t >= 0.12) {
          if (A.n <= 0) { e.act = { k: 'nxheat', t: 0, dur: e.enraged ? 0.7 : 1.1 }; next(); e.cd = 1.2; text(S, e.x, e.y - 24, '过热', P.O); }
          else { A.t = 0; A.ph = 0; A.hit = false; aim(); sfx('swing'); }
        }
        return;
      }
      case 'nxheat':
        if (S.t % 0.08 < dt) part(S, 'smoke', e.x + S.rng.range(-4, 4), e.y - 12, S.rng.range(-10, 10), S.rng.range(-30, -10), 0.6, '#646e86');
        if (A.t >= A.dur) e.act = null;
        return;
      case 'nxflame': {
        A.a += D.clamp(D.angDiff(A.a, Math.atan2(p.y - 6 - (e.y - 8), p.x - e.x)), -1.0 * dt, 1.0 * dt); e.aimA = A.a; e.face = Math.cos(A.a) >= 0 ? 1 : -1;
        A.tick -= dt; A.fire -= dt;
        if (A.tick <= 0) { A.tick = 0.05; const sp = S.rng.range(150, 190), aa = A.a + S.rng.range(-0.18, 0.18); S.eshots.push({ k: 'flame', x: e.x + Math.cos(A.a) * 9, y: e.y - 8 + Math.sin(A.a) * 9, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: 0.42, dmg: e.intent.dmg, r: 2.5, col: S.rng.chance(0.5) ? '#ff8a2e' : '#ffd84a' }); }
        if (A.fire <= 0) { A.fire = 0.22; const r = S.rng.range(25, 70), x = e.x + Math.cos(A.a) * r, y = e.y + Math.sin(A.a) * r; if (!D.solidAt(S.A, x, y) && D.losClear(S.A, e.x, e.y - 6, x, y - 6)) (S.nxFires = S.nxFires || []).push({ x, y, f: e.f, t: 0, life: 3, r: 9 }); }
        if (A.t >= A.dur) { e.cd = S.rng.range(1.6, 2.2); done(); }
        return;
      }
      case 'nxpounce': {
        const H = 140;
        if (A.ph === 0) { e.z = Math.min(H, A.t / 0.35 * H); e.air = A.t > 0.08; if (A.t >= 0.35) { A.ph = 1; A.t = 0; } }
        else if (A.ph === 1) {
          e.z = H; e.air = true;
          if (A.t < 0.85) { const k = Math.min(1, dt * 5); D.move(S.A, e, (T.x - e.x) * k, (T.y - e.y) * k); }
          if (A.t >= 1.15) { A.ph = 2; A.t = 0; }
        } else {
          e.z = Math.max(0, H * (1 - A.t / 0.16));
          if (A.t >= 0.16) {
            e.z = 0; e.air = false; const Rr = 36;
            if (dist(p, e) < Rr && p.hp > 0) K.damagePlayer(S, e.intent.dmg, e);
            ring(S, e.x, e.y, Rr + 4, P.O); ring(S, e.x, e.y, Rr - 12, P.r); K.decal(S, e.x, e.y, 18);
            for (let i = 0; i < 10; i++) K.eshot(S, e.x, e.y - 6, i / 10 * TAU, 90, 5, P.O);
            for (let i = 0; i < 18; i++) { const b = S.rng() * TAU; part(S, 'debris', e.x, e.y, Math.cos(b) * S.rng.range(40, 130), Math.sin(b) * S.rng.range(40, 130), S.rng.range(0.5, 0.9), S.rng.pick([P[2], P[3], P.t])); }
            addShake(S, 0.7); S.stop = Math.max(S.stop, 0.05); flashLight(S, e.x, e.y, 120, P.O, 1.2); sfx('slam');
            e.act = { k: 'nxheat', t: 0, dur: 1.0 }; next(); e.cd = 1.4;
          }
        }
        return;
      }
      case 'nxmend': {
        const w = A.w;
        if (e.hurtAt !== A.h0 || w.used) { w.taken = null; text(S, e.x, e.y - 20, '打断', P.r); e.act = null; e.cd = 0.8; return; }
        if (S.t % 0.06 < dt) part(S, 'spark', w.x + S.rng.range(-6, 6), w.y - 4, S.rng.range(-20, 20), S.rng.range(-50, -10), 0.4, P.g);
        if (A.t >= A.dur) {
          w.used = true; e.act = null; e.cd = 1.5;
          const o = K.spawnEnemy(S, w.kind, w.x, w.y, 0.5, w.f, true); o.hp = Math.round(o.maxHp * 0.5); o.rebuilt = true; o.noLoot = true;
          ring(S, w.x, w.y - 6, 18, P.g); text(S, w.x, w.y - 24, '重组', P.g); flashLight(S, w.x, w.y - 6, 60, P.g, 1); sfx('shield');
        }
        return;
      }
      case 'nxblink': {
        if (A.ph === 0) { if (A.t >= 0.5) { e.x = A.tx; e.y = A.ty; e.gone = false; e.z = 0; A.ph = 1; A.t = 0; ring(S, e.x, e.y - 6, 14, P.m); flashLight(S, e.x, e.y - 8, 50, P.m, 1); sfx('dash'); e.face = p.x > e.x ? 1 : -1; } }
        else if (A.ph === 1) {
          if (A.t >= 0.2) {
            if (dist(p, e) < e.r + p.r + 14 && p.hp > 0) K.damagePlayer(S, e.intent.dmg, e);
            S.ghosts.push({ k: 'slash', x: e.x, y: e.y - 6, a: Math.atan2(p.y - e.y, p.x - e.x), t: 0.14 }); sfx('swing'); A.ph = 2; A.t = 0;
          }
        } else if (A.t >= 0.25) { blinkAway(S, e, 100, 150); e.cd = S.rng.range(2, 2.8); done(); }
        return;
      }
    }
    return ax0(S, e, dt, T, done);
  };

  // ── 镜面盾：正面打来的子弹弹回去（伤害按六成，最多 12）
  const sm0 = K.shotMul;
  K.shotMul = function (S, s, e) {
    if (e && e.kind === 'nx_mirror' && s && s.x != null && !s.over && mirrorUp(e) && Math.abs(D.angDiff(e.shieldA, Math.atan2(s.y - e.y, s.x - e.x))) < 1.0) {
      e._refl = S.t; e.shieldHit = 0.12;
      const p = S.player, a = Math.atan2(p.y - 6 - s.y, p.x - s.x) + S.rng.range(-0.08, 0.08);
      K.eshot(S, s.x, s.y, a, 210, Math.max(3, Math.min(12, Math.round((s.dmg || 6) * 0.6))), '#a6e2f0');
      for (let i = 0; i < 6; i++) part(S, 'spark', s.x, s.y, S.rng.range(-60, 60), S.rng.range(-60, 60), 0.25, '#dbe5fa');
      sfx('ding'); return 0;
    }
    return sm0 ? sm0.apply(this, arguments) : 1;
  };
  // ── 挨打：弹回去的那一下不算、腾空 / 隐没打不到、导弹一碰就碎、守护场减伤、精英词缀
  const hurt0 = K.hurt;
  K.hurt = function (S, e, dmg, o) {
    if (!e || e.dead) return hurt0.apply(this, arguments);
    o = o || {};
    if (e._refl === S.t && !o.melee) { e._refl = -1; return; }
    if (e.air || e.gone) return;
    if (e.kind === 'nx_missile') { e.hp -= dmg; if (e.hp <= 0) { for (let i = 0; i < 8; i++) part(S, 'spark', e.x, e.y - 6, S.rng.range(-70, 70), S.rng.range(-70, 30), 0.3, P.O); sfx('hit'); K.kill(S, e, true); } return; }
    if (e.warded > 0) { dmg *= 0.2; if (!o.dot && S.rng.chance(0.4)) text(S, e.x, e.y - 22, '护', P.c); }
    const r = hurt0.call(this, S, e, dmg, o);
    if (!e.dead && e.affix && !o.dot && !(e.affT > e.t)) {
      if (e.affix === 'volt') { e.affT = e.t + 1.4; const off = S.rng() * TAU; for (let i = 0; i < 8; i++) K.eshot(S, e.x, e.y - 8, off + i / 8 * TAU, 75, 4, '#ffd84a'); ring(S, e.x, e.y - 6, 20, '#ffd84a'); sfx('zap'); }
      else if (e.affix === 'blink') { e.affT = e.t + 3; blinkAway(S, e, 60, 110); }
    }
    return r;
  };
  // ── 吸血：打到你多少，回三倍
  const dp0 = K.damagePlayer;
  K.damagePlayer = function (S, dmg, src) {
    const p = S.player, h0 = p ? p.hp : 0, r = dp0.apply(this, arguments);
    if (p && src && src.affix === 'leech' && !src.dead && h0 > p.hp) { const g = Math.round((h0 - p.hp) * 3); src.hp = Math.min(src.maxHp, src.hp + g); text(S, src.x, src.y - 22, '+' + g, P.g); }
    return r;
  };

  // ── 击毁：分裂、指挥中断、燃料罐、精英掉落和殉爆、给重组机记残骸
  const NO_WRECK = new Set(['nx_missile', 'nx_splitlet', 'nx_mender', 'nx_splitter']);
  const ok0 = K.onKillX;
  K.onKillX = function (S, e) {
    if (ok0) ok0(S, e);
    const E = D.ENEMIES[e.kind], x = e.x, y = e.y;
    if (e.kind === 'nx_splitter' || e.kind === 'nx_splitlet') {
      const k = e.kind === 'nx_splitter' ? 'nx_splitlet' : 'mite';
      for (const s of [-1, 1]) { let ox = x + s * 8, oy = y + S.rng.range(-4, 4); if (D.solidAt(S.A, ox, oy)) { ox = x; oy = y; } const o = K.spawnEnemy(S, k, ox, oy, 0.4, e.f, true); o.noLoot = true; o.vx = s * 140; }
      sfx('leap');
    }
    if (e.kind === 'nx_captain') {
      for (const o of S.enemies) if (!o.dead && o.f === e.f && !isBoss(o) && !o.air && !o.gone && Math.hypot(o.x - x, o.y - y) < 170) { o.stun = Math.max(o.stun || 0, 1.3); o.tele = 0; o.act = null; }
      text(S, x, y - 28, '指挥中断', '#ffd860');
    }
    if (e.kind === 'nx_pyro') (S.nxBlasts = S.nxBlasts || []).push({ x, y, f: e.f, t: 0, dur: 0.35, r: 26, dmg: 10, col: '#ff8a2e' });
    if (e.affix) {
      if (e.affix === 'volatile') (S.nxBlasts = S.nxBlasts || []).push({ x, y, f: e.f, t: 0, dur: 0.8, r: 34, dmg: 14, col: AFX.volatile.col });
      if (!e.noLoot) { const it = K.rollItem(S, S.rng, 1); K.scatter(S, D.clamp(x, 24, S.A.w - 24), y, e.f, it.id, it.n); }
      text(S, x, y - 30, '精英击毁', AFX[e.affix].col);
    }
    if (!E.boss && !E.trash && !e.rebuilt && !e.owner && !e.phantom && !NO_WRECK.has(e.kind)) {
      const W = S.nxWrecks = S.nxWrecks || []; W.push({ kind: e.kind, x, y, f: e.f, t0: S.t, used: false, taken: null }); if (W.length > 24) W.shift();
    }
  };

  // ── 每帧：守护场、督战、电网、地雷、火海、信号弹、延迟爆炸、精英
  const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, k = D.clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1); return Math.hypot(px - ax - vx * k, py - ay - vy * k); };
  const fp0 = K.foesPost;
  K.foesPost = function (S, dt) {
    if (fp0) fp0(S, dt);
    const p = S.player; if (!p) return;
    for (const e of S.enemies) { if (e.warded > 0) e.warded -= dt; if (e.rally > 0) e.rally -= dt; }
    for (const e of S.enemies) {
      if (e.dead || e.f !== S.f) continue;
      // 被电磁、指挥中断之类打断了出招：腾空 / 隐没要落回来
      if ((e.air || e.gone) && !(e.act && (e.act.k === 'nxpounce' || e.act.k === 'nxblink'))) { e.air = false; e.gone = false; e.z = 0; }
      if (e.kind === 'nx_warder' && e.ward) { if (e.ward.dead || e.ward.f !== e.f) e.ward = null; else e.ward.warded = 0.15; }
      if (e.kind === 'nx_captain' && e.aware) for (const o of S.enemies) if (!o.dead && o !== e && o.f === e.f && !isBoss(o) && Math.hypot(o.x - e.x, o.y - e.y) < 150) { o.haste = Math.max(o.haste || 0, 0.15); o.rally = 0.15; }
      if (e.kind === 'nx_ripper' && e.enraged) e.haste = Math.max(e.haste || 0, 0.15);
      if (e.affix) {
        if (e.affix === 'frenzy') e.haste = Math.max(e.haste || 0, 0.15);
        if (e.affix === 'bulwark' && e.t - (e.hurtAt == null ? -9 : e.hurtAt) > 3) e.shield = Math.min(Math.round(e.maxHp * 0.3), e.shield + 8 * dt);
        if (e.aware && !e.affShown) { e.affShown = true; text(S, e.x, e.y - 30, '精英·' + AFX[e.affix].name, AFX[e.affix].col); }
      }
    }
    // 电网：扎下的电桩两两相连（140 以内、中间没墙），你穿过去挨电
    const py = S.enemies.filter(e => !e.dead && e.kind === 'nx_pylon' && e.f === S.f && e.planted && e.aware && e.spawnT <= 0 && !(e.stun > 0));
    S.nxLinks = [];
    for (let i = 0; i < py.length; i++) for (let j = i + 1; j < py.length; j++) { const a = py[i], b = py[j]; if (dist(a, b) < 140 && D.losClear(S.A, a.x, a.y - 10, b.x, b.y - 10)) S.nxLinks.push([a, b]); }
    if (p.hp > 0 && !(S.nxZapT > S.t)) for (const [a, b] of S.nxLinks) if (segDist(p.x, p.y - 6, a.x, a.y - 10, b.x, b.y - 10) < 5) { S.nxZapT = S.t + 0.5; K.damagePlayer(S, 6, a); S.bolts.push({ pts: K.zig(S, a.x, a.y - 10, b.x, b.y - 10), t: 0.15 }); sfx('zap'); break; }
    // 地雷
    if (S.nxMines) {
      for (const m of S.nxMines) {
        m.t += dt; if (m.f !== S.f) continue;
        if (m.t < m.fly) { const k = m.t / m.fly; m.x = D.lerp(m.sx, m.tx, k); m.y = D.lerp(m.sy, m.ty, k); m.z = Math.sin(k * Math.PI) * 16; continue; }
        m.z = 0; m.x = m.tx; m.y = m.ty;
        if (m.trig == null && m.t > m.fly + 0.7 && p.hp > 0 && Math.hypot(p.x - m.x, p.y - m.y) < 16) { m.trig = S.t; sfx('beep'); }
        if (m.trig != null && S.t - m.trig > 0.4) { m.dead = true; K.explode(S, m.x, m.y, 24, 12, true); }
        else if (m.fizzle || m.t > 22) { m.dead = true; for (let i = 0; i < 4; i++) part(S, 'smoke', m.x, m.y - 2, S.rng.range(-10, 10), S.rng.range(-20, -5), 0.6, '#646e86'); }
      }
      S.nxMines = S.nxMines.filter(m => !m.dead);
    }
    // 火海
    if (S.nxFires) {
      for (const F of S.nxFires) {
        F.t += dt; if (F.f !== S.f) continue;
        if (S.t % 0.12 < dt) part(S, 'spark', F.x + S.rng.range(-6, 6), F.y - 1, S.rng.range(-8, 8), S.rng.range(-50, -20), 0.35, S.rng.chance(0.5) ? '#ff8a2e' : '#ffd84a');
        if (p.hp > 0 && !(S.nxFireT > S.t) && Math.hypot(p.x - F.x, (p.y - F.y) * 1.4) < F.r) { S.nxFireT = S.t + 0.5; K.damagePlayer(S, 3, { kind: 'nx_pyro', x: F.x, y: F.y }); }
      }
      S.nxFires = S.nxFires.filter(F => F.t < F.life);
    }
    // 信号弹：落地闪红光，过一会儿炮弹从上面砸下来
    if (S.nxFlares) {
      for (const F of S.nxFlares) {
        F.t += dt; if (F.f !== S.f) continue;
        if (F.t < F.fly) { const k = F.t / F.fly; F.x = D.lerp(F.sx, F.tx, k); F.y = D.lerp(F.sy, F.ty, k); F.z = Math.sin(k * Math.PI) * 20; continue; }
        F.z = 0; F.x = F.tx; F.y = F.ty;
        if (S.t % 0.1 < dt) part(S, 'smoke', F.x, F.y - 3, S.rng.range(-6, 6), S.rng.range(-30, -10), 0.8, '#c82e3a');
        if (!F.fired && F.t >= F.fly + 0.35) {
          F.fired = true; sfx('warn');
          for (let i = 0; i < F.n; i++) { const tx = D.clamp(F.x + S.rng.range(-26, 26), 20, S.A.w - 20), ty = D.clamp(F.y + S.rng.range(-16, 16), 30, S.A.h - 20); S.shells.push({ sx: tx + S.rng.range(-30, 30), sy: ty - 140, tx, ty, t: -i * 0.16, dur: 0.95, dmg: F.dmg }); }
        }
      }
      S.nxFlares = S.nxFlares.filter(F => F.t < F.fly + 2.6);
    }
    // 延迟爆炸（燃料罐、殉爆精英）
    if (S.nxBlasts) {
      for (const B of S.nxBlasts) { B.t += dt; if (B.f === S.f && B.t >= B.dur) { B.dead = true; K.explode(S, B.x, B.y - 4, B.r, B.dmg, true); } }
      S.nxBlasts = S.nxBlasts.filter(B => !B.dead && B.t < B.dur + 5);
    }
    if (S.nxEchoes) S.nxEchoes = S.nxEchoes.filter(c => S.t - c.t0 < 0.4);
  };

  // ── 画
  const df0 = D.drawFoe;
  D.drawFoe = function (ctx, ex, S, e, white, LT, H) {
    if (e.affix) { // 精英：脚下一圈词缀颜色的光、头上两个小菱形
      const c = AFX[e.affix].col, k = 0.45 + 0.25 * Math.sin(S.t * 6 + e.slot), rr = e.r + 5;
      ex.strokeStyle = D.rgba(c, k); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(e.x, e.y, rr, rr * 0.5, 0, 0, TAU); ex.stroke();
      const hy = Math.round(e.y - e.r * 2 - 14 - (e.z || 0)); ex.fillStyle = c; ex.fillRect(e.x - 3, hy, 1.5, 1.5); ex.fillRect(e.x + 1.5, hy, 1.5, 1.5);
      LT(e.x, e.y - 6, 26, c, 0.45);
    }
    if (!NX[e.kind]) return df0 ? df0.apply(this, arguments) : false;
    const SP = D.SPR, x = e.x, y = e.y, tele = e.tele > 0, sx = tele && e.tele < 0.25 ? Math.round(Math.sin(S.t * 80)) * 0.5 : 0, fl = e.face < 0, A = e.act;
    const act = (spr, yy) => H.actor(ctx, ex, spr, x + sx, yy, fl, white);
    switch (e.kind) {
      case 'nx_mirror': {
        act(SP.nx_mirror, y);
        if (mirrorUp(e)) {
          const sa = e.shieldA, cy = y - 9, hitW = e.shieldHit > 0; e.shieldHit = (e.shieldHit || 0) - 1 / 60;
          ctx.strokeStyle = P.k; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, cy, 11, sa - 0.85, sa + 0.85); ctx.stroke();
          ctx.strokeStyle = '#9aa1b4'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, cy, 11, sa - 0.8, sa + 0.8); ctx.stroke();
          ctx.strokeStyle = '#dbe5fa'; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.arc(x, cy, 10.2, sa - 0.75, sa - 0.1); ctx.stroke();
          const g = sa - 0.7 + ((S.t * 1.6) % 1.4); ex.strokeStyle = D.rgba(hitW ? '#ffffff' : '#a6e2f0', hitW ? 1 : 0.7); ex.lineWidth = hitW ? 2 : 1; ex.beginPath(); ex.arc(x, cy, 11, g - 0.12, g + 0.12); ex.stroke();
        } else if (tele) LT(x + e.face * 8, y - 12, 18, P.r, 0.8);
        return true;
      }
      case 'nx_splitter': case 'nx_splitlet': {
        const z = e.z || 0; act(e.kind === 'nx_splitter' ? SP.nx_splitter : SP.nx_splitlet, y - z + (tele ? 0.5 : 0));
        LT(x, y - 6 - z, e.kind === 'nx_splitter' ? 22 : 14, P.g, 0.5); return true;
      }
      case 'nx_layer': act(SP.nx_layer, y); if ((S.t * 3 | 0) % 2) LT(x - e.face * 4, y - 6, 12, P.r, 0.6); return true;
      case 'nx_ripper': {
        act(e.enraged ? SP.nx_ripperR : SP.nx_ripper, y);
        if (A && A.k === 'nxrip' && A.ph === 0) LT(x, y - 8, 30, P.Y, 0.9);
        if (e.enraged) LT(x, y - 18, 18, P.r, 0.7 + 0.3 * Math.sin(S.t * 14));
        if (A && A.k === 'nxheat') LT(x, y - 10, 20, P.O, 0.5);
        return true;
      }
      case 'nx_pylon': act(SP.nx_pylon, y); LT(x, y - 23, e.planted ? 26 : 14, '#ffd84a', e.planted ? 0.8 + 0.2 * Math.sin(S.t * 20) : 0.4); return true;
      case 'nx_captain': act(SP.nx_captain, y); if (tele && e.intent.k === 'nxflare') LT(x + e.face * 9, y - 11, 20, P.r, 0.9); return true;
      case 'nx_pyro': {
        act(SP.nx_pyro, y);
        const a = e.aimA != null ? e.aimA : (e.face > 0 ? 0 : Math.PI), gx = x + e.face * 2, gy = y - 9;
        H.seg(ctx, gx, gy, gx + Math.cos(a) * 11, gy + Math.sin(a) * 11, P.k, 3); H.seg(ctx, gx, gy, gx + Math.cos(a) * 11, gy + Math.sin(a) * 11, '#646e86', 1.5);
        const fx = gx + Math.cos(a) * 12, fy = gy + Math.sin(a) * 12;
        if (A && A.k === 'nxflame') LT(fx, fy, 46, '#ff8a2e', 1.1); else { ex.fillStyle = '#4ab0ff'; ex.fillRect(fx - 0.5, fy - 0.5, 1, 1); LT(fx, fy, 8, '#4ab0ff', 0.6); }
        return true;
      }
      case 'nx_pouncer': {
        if (A && A.k === 'nxpounce' && A.ph >= 1) { // 红圈：跟着你，快砸下来的时候缩小
          const k = A.ph === 2 ? 1 : Math.min(1, A.t / 1.15), rr = 30 - 18 * k, lock = A.ph === 2 || A.t > 0.85;
          ex.strokeStyle = D.rgba(P.r, 0.5 + 0.5 * k); ex.lineWidth = lock ? 1 : 0.5; ex.beginPath(); ex.ellipse(x, y, rr, rr * 0.55, 0, 0, TAU); ex.stroke();
          ex.fillStyle = D.rgba(P.r, 0.08 + 0.2 * k); ex.beginPath(); ex.ellipse(x, y, rr, rr * 0.55, 0, 0, TAU); ex.fill();
          ctx.fillStyle = D.rgba(P.k, 0.25 + 0.3 * k); ctx.beginPath(); ctx.ellipse(x, y, 10 * (0.4 + 0.6 * k), 4 * (0.4 + 0.6 * k), 0, 0, TAU); ctx.fill();
        }
        if ((e.z || 0) < 100) act(SP.nx_pouncer, y - (e.z || 0));
        if (A && A.k === 'nxheat') LT(x, y - 10, 24, P.O, 0.5);
        return true;
      }
      case 'nx_mender': {
        act(SP.nx_mender, y);
        if (A && A.k === 'nxmend') { const w = A.w; ex.strokeStyle = D.rgba(P.g, 0.5 + 0.3 * Math.sin(S.t * 30)); ex.lineWidth = 1; ex.beginPath(); ex.moveTo(x + e.face * 9, y - 14); ex.lineTo(w.x, w.y - 4); ex.stroke(); LT(w.x, w.y - 4, 28, P.g, 0.9); }
        return true;
      }
      case 'nx_hive': {
        const z = 8 + Math.sin(e.t * 2.5) * 1.5, bl = (S.t * 30 | 0) % 2;
        ctx.fillStyle = bl ? '#c8cee0' : '#6a7290'; ctx.fillRect(x - 13, y - z - 18.5, 5, 0.5); ctx.fillRect(x + 8, y - z - 18.5, 5, 0.5);
        act(SP.nx_hive, y - z); LT(x, y - z, 14, P.O, 0.6); if (tele) LT(x, y - z - 8, 26, P.r, 0.9); return true;
      }
      case 'nx_missile': {
        const z = 4; act(SP.nx_missile, y - z);
        const tx = x - Math.cos(e.ma || 0) * 4, ty = y - z - 2 - Math.sin(e.ma || 0) * 2; ex.fillStyle = (S.t * 40 | 0) % 2 ? '#fff3b0' : '#ff8a2e'; ex.fillRect(tx - 1, ty - 0.5, 2, 1.5); LT(tx, ty, 18, P.O, 0.9);
        return true;
      }
      case 'nx_warder': {
        const z = 8 + Math.sin(e.t * 2) * 1.5, w = e.ward;
        if (w && !w.dead) {
          const k = 0.45 + 0.2 * Math.sin(S.t * 8); ex.strokeStyle = D.rgba(P.c, k); ex.lineWidth = 1; ex.beginPath(); ex.moveTo(x, y - z - 9); ex.lineTo(w.x, w.y - 8); ex.stroke();
          const q = (S.t * 1.5) % 1; ex.fillStyle = '#ffffff'; ex.fillRect(D.lerp(x, w.x, q) - 0.5, D.lerp(y - z - 9, w.y - 8, q) - 0.5, 1, 1);
          ex.strokeStyle = D.rgba(P.c, 0.35 + 0.15 * Math.sin(S.t * 5)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(w.x, w.y - 8, w.r + 6, w.r + 8, 0, 0, TAU); ex.stroke();
        }
        act(SP.nx_warder, y - z); LT(x, y - z - 9, 16, P.c, 0.7); return true;
      }
      case 'nx_phantom': {
        if (e.gone) return true;
        if (!white) ctx.globalAlpha = tele ? ((S.t * 24 | 0) % 2 ? 0.35 : 0.9) : 0.85;
        act(SP.nx_phantom, y); ctx.globalAlpha = 1;
        if (A && A.k === 'nxblink' && A.ph === 1) LT(x, y - 10, 24, P.m, 1);
        return true;
      }
    }
    return true;
  };
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    if (de0) de0(S, list, ctx, ex);
    const SP = D.SPR, f = S.f;
    for (const m of S.nxMines || []) if (m.f === f) list.push({ y: m.y - 1, f: () => {
      D.blit(ctx, SP.nx_mine, m.x, m.y + 2 - m.z, false, null);
      const armed = m.t > m.fly + 0.7, on = m.trig != null ? (S.t * 20 | 0) % 2 : armed ? (S.t * 2.5 | 0) % 2 : 0;
      if (on) { ex.fillStyle = '#ff3047'; ex.fillRect(m.x - 0.5, m.y - 1.5 - m.z, 1, 1); S.tlights.push({ x: m.x, y: m.y - 2, r: m.trig != null ? 30 : 12, col: P.r, a: 0.8, decay: 30 }); }
      if (m.trig != null) { ex.strokeStyle = D.rgba(P.r, 0.7); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(m.x, m.y, 24, 13, 0, 0, TAU); ex.stroke(); }
    } });
    for (const F of S.nxFires || []) if (F.f === f) list.push({ y: -1e9, f: () => {
      const k = 1 - F.t / F.life;
      for (let i = 0; i < 6; i++) { const ph = i * 1.7 + F.x, px = F.x + Math.sin(ph * 3.1) * F.r * 0.7, py = F.y + Math.cos(ph * 2.3) * F.r * 0.35, h = 1 + ((S.t * 12 + i) | 0) % 3; ex.fillStyle = i % 2 ? D.rgba('#ff8a2e', 0.8 * k) : D.rgba('#ffd84a', 0.8 * k); ex.fillRect(Math.round(px), Math.round(py - h), 1, h); }
      S.tlights.push({ x: F.x, y: F.y - 2, r: 22, col: '#ff8a2e', a: 0.6 * k, decay: 30 });
    } });
    for (const F of S.nxFlares || []) if (F.f === f) list.push({ y: F.y, f: () => {
      D.blit(ctx, SP.nx_flare, F.x, F.y + 1 - F.z, false, null);
      if ((S.t * 10 | 0) % 2) { ex.fillStyle = '#ffd0d4'; ex.fillRect(F.x - 0.5, F.y - 2 - F.z, 1, 1); }
      S.tlights.push({ x: F.x, y: F.y - 2, r: 40, col: P.r, a: 0.9, decay: 30 });
      if (F.t >= F.fly && !F.fired) { ex.strokeStyle = D.rgba(P.r, 0.6); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(F.x, F.y, 30, 18, 0, 0, TAU); ex.stroke(); }
    } });
    for (const [a, b] of S.nxLinks || []) if (a.f === f) list.push({ y: Math.max(a.y, b.y), f: () => {
      const x0 = a.x, y0 = a.y - 10, x1 = b.x, y1 = b.y - 10, n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
      for (const [w, c] of [[1.5, D.rgba('#ffd84a', 0.35)], [0.5, '#fff3b0']]) {
        ex.strokeStyle = c; ex.lineWidth = w; ex.beginPath(); ex.moveTo(x0, y0);
        for (let i = 1; i < n; i++) { const k = i / n, j = Math.sin(i * 12.9 + S.t * 47 + a.slot * 7) * 3; ex.lineTo(D.lerp(x0, x1, k) + j * 0.5, D.lerp(y0, y1, k) + j); }
        ex.lineTo(x1, y1); ex.stroke();
      }
      S.tlights.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: 30, col: '#ffd84a', a: 0.5, decay: 30 });
    } });
    for (const B of S.nxBlasts || []) if (B.f === f && !B.dead) list.push({ y: -1e9, f: () => {
      const k = B.t / B.dur; ex.strokeStyle = D.rgba(B.col, 0.4 + 0.6 * k); ex.lineWidth = (S.t * 16 | 0) % 2 ? 1 : 0.5; ex.beginPath(); ex.ellipse(B.x, B.y, B.r, B.r * 0.55, 0, 0, TAU); ex.stroke();
    } });
    for (const c of S.nxEchoes || []) if (c.f === f) list.push({ y: c.y, f: () => { ctx.globalAlpha = 0.5 * (1 - (S.t - c.t0) / 0.4); D.blit(ctx, D.SPR[c.sk], c.x, c.y, c.flip, null); ctx.globalAlpha = 1; } }); // 残影存的是精灵名（联机时状态发给队友，图片发不过去）
    // 残影刺客要出来的地方：红色残影，越来越清楚
    for (const e of S.enemies) if (!e.dead && e.f === f && e.gone && e.act && e.act.k === 'nxblink') {
      const A = e.act, k = Math.min(1, A.t / 0.5);
      list.push({ y: A.ty, f: () => {
        ex.globalAlpha = (0.3 + 0.6 * k) * ((S.t * 18 | 0) % 2 ? 1 : 0.6); D.blit(ex, SP.nx_phantom, A.tx, A.ty, S.player.x < A.tx, 'flash'); ex.globalAlpha = 1;
        ex.fillStyle = D.rgba(P.r, 0.35 * k); ex.beginPath(); ex.ellipse(A.tx, A.ty, 9, 4, 0, 0, TAU); ex.fill();
      } });
    }
    // 督战：被指挥官带着的敌人头上一个小金箭头
    for (const e of S.enemies) if (!e.dead && e.f === f && e.rally > 0 && e.kind !== 'nx_captain') list.push({ y: e.y + 0.5, f: () => {
      const hy = Math.round(e.y - e.r * 2 - 10 - (e.z || 0) + Math.sin(S.t * 6) * 0.5); ex.fillStyle = '#ffd860'; ex.fillRect(e.x - 0.5, hy, 1, 1); ex.fillRect(e.x - 1.5, hy + 1, 1, 1); ex.fillRect(e.x + 0.5, hy + 1, 1, 1);
    } });
  };
})(D);
