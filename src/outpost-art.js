/* 末班之后 · 小样二：人类据点（小镇）里的人和装饰（画法）。
   人在 outpost-town.js 里放进 S.people（有名字的 + 站民），装饰在 F.decor。
   挂在 D.drawExtras 上，和站里别的东西一起按脚底排序画。
   人：站、坐、躺、小孩蹲坐（kid）、小孩跑（kidrun）；走路两帧；face 是朝向（-1 左、1 右），朝左整张翻过来。
   人用 D.Paint / D.mkSprite 画（和主角、敌人同一套死亡细胞式的精细像素），见 humanSprite。
   有名字的人头顶有一个小光点（颜色是他的），站民没有。
   装饰：车厢（car / carTop）、布篷（awning）、串灯（string）、篝火（fire）、站牌（board）、名字墙（names）、
   沙袋（sandbag）、路障门（gate）、火盆（brazier）、叫车铃（bell）、晾衣绳（laundry）、炉灶（stove）、粉笔画（chalk）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, K = (P && P.k) || '#0b0a14', TS = 16;
  // 有名字的人的外观：皮肤、头发、上衣、裤子、配饰（none 没有）；kid 是小孩
  const LOOKS = {
    su:   { skin: '#f0cdb0', hair: '#2a2a2a', top: '#eef2f2', bot: '#c9d4d4', acc: 'coat' },
    fang: { skin: '#e9b383', hair: '#2a2a33', top: '#b04a7a', bot: '#3b3046', acc: 'apron' },
    tie:  { skin: '#d9a57a', hair: '#777777', top: '#3f5f8f', bot: '#2a2e33', acc: 'cap' },
    zhou: { skin: '#c99a72', hair: '#e5e1d8', top: '#5c5a3e', bot: '#3a3424', acc: 'glasses' },
    qing: { skin: '#f0c39c', hair: '#1f1a22', top: '#8a5a7a', bot: '#2e2a33', acc: 'scarf' },
    chen: { skin: '#b98a63', hair: '#332f2a', top: '#3c4a3a', bot: '#2a3026', acc: 'badge' },
    xie:  { skin: '#e0b08a', hair: '#555555', top: '#3c3c48', bot: '#24242c', acc: 'headset' },
    mei:  { skin: '#d8a882', hair: '#222222', top: '#d07b3c', bot: '#4a3a2a', acc: 'kerchief' },
    xm:   { skin: '#f2c9a0', hair: '#3a2a1a', top: '#e0c040', bot: '#4a6a9a', acc: 'none', kid: true },
    hei:  { skin: '#8b6a4e', hair: '#aaaaaa', top: '#7a7a6a', bot: '#4e4e44', acc: 'bowl' },
  };
  const lookOf = p => (p.named ? LOOKS[p.id] || LOOKS.su : p.look);
  const dotCol = id => (D.OUTPOST_PEOPLE && D.OUTPOST_PEOPLE[id] ? D.OUTPOST_PEOPLE[id].col : '#ffffff');

  // ── 人的精灵：和主角、敌人、商人同一套画法（sprite.js 的 D.Paint：2 倍精度、球面 / 倒角着色、
  //    4×4 点阵抖动、光从左上来、外描黑边、发光的像素另存一层）。不许用 fillRect 平涂色块画人。
  //    每种外观 × 姿势 × 帧画一次缓存起来；朝左就水平翻转。脚下的点是精灵底边中间。
  const INK = '#0b0a14', LIGHT = '#fff1dc';
  const rampCache = {};
  function rampOf(hex) { // 一个颜色 → 6 级明暗（暗部偏墨色，亮部偏暖白）
    if (rampCache[hex]) return rampCache[hex];
    const m = (k, c) => D.mixHex(hex, c, k);
    return (rampCache[hex] = [m(0.78, INK), m(0.55, INK), m(0.3, INK), hex, m(0.28, LIGHT), m(0.55, LIGHT)]);
  }
  const R = () => D.RAMP;
  const sprCache = {};

  // ── 30 种站民（人类据点里没有名字的居民）。每种有自己的身材、发型、帽子、脸上的东西、衣服、背的、手里拿的，
  //    颜色在 tops / bots / hairs 里挑（皮肤随机），所以同一种人也不会长得一模一样。
  //    部件：
  //      build  身材 0.85 瘦 / 1 / 1.25 壮
  //      hairS  short 短发 / long 长发 / bun 发髻 / bald 光头 / ponytail 马尾 / hood 兜帽（用上衣的颜色）
  //      hat    cap 鸭舌帽 / hardhat 安全帽 / chef 厨师帽 / beret 贝雷帽 / bucket 渔夫帽 / straw 斗笠 / riot 防暴头盔 / nursecap 护士帽 / beanie 毛线帽 / moto 头盔 / kerchief 头巾
  //      face   beard 胡子 / glasses 眼镜 / gasmask 防毒面具 / eyepatch 眼罩 / bandage 头上缠绷带 / phones 大耳机 / mask 口罩 / headset 耳麦
  //      outfit vest 反光背心 / apron 围裙 / whitecoat 白大褂 / longcoat 长外套 / suit 西装 / dress 裙子 / cloak 斗篷 / tank 背心（露胳膊）/ belly 孕肚 / blanket 披毯子 / uniform 制服 / scarf 围巾 / badge 徽章
  //      back   pack 大背包 / bag 挎包 / sack 麻袋 / guitar 吉他 / box 外卖箱
  //      hand   cane 拐杖 / broom 扫帚 / tray 挂在胸前的货盘 / baby 抱着孩子 / briefcase 公文包 / book 书 / flowers 一篮花 / rod 鱼竿 / baton 警棍 / crutch 腋拐 / basket 菜篮 / sign 招牌杆 / cable 一卷电线 / toolbox 工具箱 / bowl 碗
  const T = (tops, bots, hairs, o) => Object.assign({ tops, bots, hairs }, o);
  const HUMAN_TYPES = D.HUMAN_TYPES = {
    porter:      T(['#6a5a3a', '#4a5a3a'], ['#3a3424'], ['#2a2a33', '#3a2a1a'], { hat: 'cap', back: 'pack', build: 1.15 }),              // 搬运工
    granny:      T(['#8a5a6a', '#6a7a8a'], ['#3a3040'], ['#c8c4bc', '#e5e1d8'], { hairS: 'bun', hand: 'cane', build: 0.9 }),            // 老奶奶
    student:     T(['#e8e8f0'], ['#2a3a6a'], ['#1f1a22', '#2a2a33'], { back: 'bag', build: 0.85 }),                                  // 学生
    cleaner:     T(['#3f5f8f'], ['#2a2e33'], ['#555555', '#2a2a33'], { outfit: 'vest', hat: 'cap', hand: 'broom' }),                    // 清洁工
    metro:       T(['#24305a'], ['#1c2238'], ['#2a2a33'], { outfit: 'uniform', hat: 'cap' }),                                      // 地铁员工
    cook:        T(['#e8e4dc'], ['#3a3a3a'], ['#2a2a33'], { hat: 'chef', outfit: 'apron', build: 1.15 }),                            // 厨师
    cobbler:     T(['#5a4a3a'], ['#3a3424'], ['#777777', '#aaaaaa'], { face: 'glasses', outfit: 'apron', hand: 'toolbox' }),                // 修鞋匠
    nurse:       T(['#e8eef3'], ['#e8eef3'], ['#2a2a33', '#3a2a1a'], { hat: 'nursecap', outfit: 'dress', hairS: 'ponytail' }),       // 护士
    veteran:     T(['#4a5a32'], ['#3a4426'], ['#555555', '#2a2a2a'], { hat: 'beret', face: 'eyepatch', build: 1.1 }),                   // 退伍兵
    peddler:     T(['#8a3b3b', '#7a6a4a'], ['#3b3046'], ['#2a2a33'], { hand: 'tray', hat: 'bucket' }),                               // 小贩
    scavenger:   T(['#5a5040', '#4a4a3a'], ['#3a3424'], ['#3a2a1a'], { hairS: 'hood', outfit: 'cloak', back: 'sack' }),              // 拾荒者
    electrician: T(['#3d5a58'], ['#2a2e33'], ['#2a2a33'], { hat: 'hardhat', hand: 'cable' }),                                      // 电工
    pregnant:    T(['#b06a8a', '#7a8ab0'], ['#3b3046'], ['#1f1a22', '#3a2a1a'], { hairS: 'long', outfit: 'belly' }),                 // 孕妇
    mother:      T(['#9a7a3a', '#5a4a6a'], ['#2e2a33'], ['#1f1a22'], { hairS: 'long', hand: 'baby', outfit: 'scarf' }),               // 抱孩子的母亲
    grandpa:     T(['#5c5a3e', '#6a5a4a'], ['#3a3424'], ['#e5e1d8'], { hairS: 'bald', face: 'beard', hand: 'cane', build: 0.95 }),   // 老爷爷
    hoodie:      T(['#3a3a48', '#5a2a3a', '#2a4a4a'], ['#24242c'], ['#2a2a33'], { hairS: 'hood', face: 'phones', build: 0.9 }),      // 戴耳机的年轻人
    masked:      T(['#4a4a40', '#3a3a3a'], ['#2a2a2a'], ['#2a2a33'], { face: 'gasmask', back: 'bag' }),                             // 戴防毒面具的人
    fisher:      T(['#6a7a5a'], ['#3a3424'], ['#555555'], { hat: 'bucket', hand: 'rod', face: 'beard' }),                               // 钓鱼的大叔
    musician:    T(['#3a2a2a', '#2a3a5a'], ['#24242c'], ['#3a2a1a', '#1f1a22'], { hairS: 'long', back: 'guitar', build: 0.9 }),      // 背吉他的
    farmer:      T(['#7a6a4a', '#5a6a3a'], ['#3a3424'], ['#2a2a33'], { hat: 'straw', hand: 'basket' }),                              // 戴斗笠的菜农
    office:      T(['#2a2e3a', '#3a3a40'], ['#2a2e3a'], ['#1f1a22', '#2a2a33'], { outfit: 'suit', hand: 'briefcase' }),              // 西装上班族
    longhair:    T(['#c87a5a', '#5a8a8a', '#d8c87a'], ['#3b3046'], ['#1f1a22', '#5a3a1a'], { hairS: 'long', outfit: 'scarf', build: 0.85 }), // 长发姑娘
    strongman:   T(['#c8c0b0', '#8a8a8a'], ['#2a2e33'], ['#2a2a33'], { hairS: 'bald', outfit: 'tank', build: 1.3 }),                // 光头壮汉
    seer:        T(['#3a2a4a', '#2a2a3a'], ['#24242c'], ['#aaaaaa'], { outfit: 'longcoat', face: 'glasses', hand: 'sign' }),             // 算命先生
    blanket:     T(['#5a4a3a'], ['#3a3424'], ['#3a2a1a', '#555555'], { outfit: 'blanket', build: 0.95 }),                              // 披着毯子的人
    guard:       T(['#2a3040'], ['#1c2230'], ['#2a2a33'], { hat: 'riot', outfit: 'uniform', hand: 'baton', build: 1.15 }),           // 警卫
    injured:     T(['#6a6a6a', '#7a5a4a'], ['#3a3424'], ['#2a2a33', '#3a2a1a'], { face: 'bandage', hand: 'crutch' }),                // 伤员
    florist:     T(['#d8a0b0', '#a0c8a0'], ['#4a3a2a'], ['#3a2a1a', '#1f1a22'], { hat: 'kerchief', hand: 'flowers', hairS: 'ponytail' }), // 卖花的
    reader:      T(['#5a4a3a', '#3a4a5a'], ['#2a2e33'], ['#555555', '#2a2a33'], { outfit: 'longcoat', face: 'glasses', hand: 'book' }),  // 看书的人
    courier:     T(['#d8a030', '#3a6ab0'], ['#2a2e33'], ['#2a2a33'], { hat: 'moto', back: 'box' }),                                 // 外卖骑手
  };
  // 有名字的人沿用老写法（acc 一个配饰），这里换算成部件
  function feat(L) {
    const a = L.acc;
    return {
      build: L.build || 1, hairS: L.hairS || 'short',
      hat: L.hat || (a === 'cap' ? 'cap' : a === 'kerchief' ? 'kerchief' : null),
      face: L.face || (a === 'glasses' ? 'glasses' : a === 'headset' ? 'headset' : null),
      outfit: L.outfit || (a === 'apron' ? 'apron' : a === 'coat' ? 'whitecoat' : a === 'scarf' ? 'scarf' : a === 'badge' ? 'badge' : null),
      back: L.back || (a === 'bag' ? 'bag' : null), hand: L.hand || (a === 'bowl' ? 'bowl' : null),
    };
  }
  // 按类型挑一个站民的样子（颜色随机，皮肤随机）
  D.humanLook = function (rng, type) {
    const keys = Object.keys(HUMAN_TYPES), k = type || rng.pick(keys), H = HUMAN_TYPES[k];
    return Object.assign({ type: k, skin: rng.pick(['#e9b383', '#d9a57a', '#c99a72', '#8b6a4e', '#f2c9a0', '#b98a63']), top: rng.pick(H.tops), bot: rng.pick(H.bots), hair: rng.pick(H.hairs) },
      { build: H.build, hairS: H.hairS, hat: H.hat, face: H.face, outfit: H.outfit, back: H.back, hand: H.hand });
  };

  // pose：stand / sit / lie / kid（小孩蹲坐）/ kidrun；fr：0 站定，1–4 走路一圈（1、3 两脚着地迈开，2、4 一只脚抬起来过身子）
  // an：小动作，几个字母拼起来（D.humanAnim 按时间挑）：
  //   b 呼气（上身往下沉半个像素）、e 眨眼、c 转过脸看镜头、n 低头点一下、m 张嘴、g 说话时手往前比划、h 手抬高摊开
  function humanSprite(L, pose, fr, an) {
    const F = feat(L); fr = fr | 0; an = an || '';
    const key = [L.skin, L.hair, L.top, L.bot, L.acc, F.build, F.hairS, F.hat, F.face, F.outfit, F.back, F.hand, pose, fr, an].join('|');
    if (sprCache[key]) return sprCache[key];
    const A = c => an.indexOf(c) >= 0;
    const kid = pose === 'kid' || pose === 'kidrun', k = kid ? 0.72 : 1;
    const SK = rampOf(L.skin), HA = rampOf(L.hair), TP = rampOf(L.top), BT = rampOf(L.bot), RP = D.RAMP, SH = RP.dark;
    let spr;
    if (pose === 'lie') { // 躺着：铺盖、被子、头朝右
      spr = D.mkSprite(44, 22, p => {
        const ch = A('b') ? 0 : 1; // 吸气时被子鼓起来一点
        p.box(2, 12, 40, 8, RP.cloth, { r: 2, v: 0.5 });
        p.box(4, 7 - ch, 26, 9 + ch, TP, { r: 3, v: 0.66 });
        p.box(4, 10 - ch, 24, 6 + ch, rampOf(F.outfit === 'blanket' ? '#7a4a3a' : '#8a7a5a'), { r: 2, v: 0.6 });
        p.ell(34, 10, 6, 5.5, SK, { bias: 0.15 });
        if (F.hairS !== 'bald') p.ell(37, 8, 5, 3.5, F.hairS === 'hood' ? TP : HA, { flat: true });
        if (F.face === 'beard') p.ell(31, 13, 3, 2, HA, { flat: true });
        if (A('e')) { p.rect(33, 12, 2, 1, D.mixHex(L.skin, INK, 0.5)); p.rect(37, 12, 2, 1, D.mixHex(L.skin, INK, 0.5)); }
        else { p.rect(33, 11, 2, 1, INK); p.rect(37, 11, 2, 1, INK); }
      });
      return (sprCache[key] = spr);
    }
    const sitting = pose === 'sit' || pose === 'kid';
    const W = Math.round((sitting ? 46 : 44) * k), H = Math.round((sitting ? 44 : 56) * k);
    spr = D.mkSprite(W, H, p => {
      const s = v => Math.round(v * k), cx = s(20), base = H - 1, b = F.build;
      const legH = s(14), torsoH = s(15), torsoW = Math.max(s(10), Math.round(s(14) * b)), headR = 6 * k;
      const L0 = cx - Math.round(torsoW / 2), R0 = L0 + torsoW; // 身子左右边
      let hipY;
      // 背着的东西（在身子后面，朝右时在左边）
      const backItem = (tY) => {
        if (sitting) return;
        if (F.back === 'pack') { p.box(L0 - s(7), tY - s(5), s(10), s(19), RP.olive, { r: 2, v: 0.55 }); p.ell(L0 - s(2), tY - s(6), s(6), s(3), RP.cloth); p.rect(L0 - s(5), tY + s(4), s(6), 1, RP.olive[1]); }
        if (F.back === 'sack') p.ell(L0 - s(3), tY + s(3), s(8), s(9), rampOf('#9a8a64'));
        if (F.back === 'guitar') { p.box(L0 - s(3), tY - s(12), s(3), s(16), RP.crate, { v: 0.5 }); p.ell(L0 - s(2), tY + s(8), s(6), s(7), rampOf('#a8653d')); p.disc(L0 - s(2), tY + s(7), 1.5 * k, INK); }
        if (F.back === 'box') { p.box(L0 - s(9), tY - s(3), s(12), s(13), RP.red, { r: 1, v: 0.7 }); p.rect(L0 - s(7), tY + s(1), s(8), s(2), RP.white[4]); }
      };
      if (sitting) { // 坐着：大腿朝前平放，小腿往下
        hipY = base - s(8);
        p.box(cx - s(6), hipY - s(1), s(16), s(6), BT, { r: 2, v: 0.6 });
        p.box(cx + s(8), hipY + s(2), s(5), s(7), BT, { r: 1, v: 0.5 });
        p.box(cx + s(7), base - s(2), s(7), s(3), SH, { r: 1 });
      } else { // 站着 / 走路：两条腿，大腿、小腿分开画；走路四帧：迈开（胯低一点）→ 一脚抬起过身子 → 换脚迈开 → 另一脚抬起
        const step = fr === 1 || fr === 3; // 两脚着地，腿叉开，胯往下沉一个像素
        hipY = base - legH + (step ? 1 : 0);
        // 每条腿：[脚往前挪多少（朝右为前）, 抬多高]
        const G = { 0: [[0, 0], [0, 0]], 1: [[-3, 0], [3, 0]], 2: [[0, 0], [1, 2]], 3: [[3, 0], [-3, 0]], 4: [[1, 2], [0, 0]] }[fr] || [[0, 0], [0, 0]];
        backItem(hipY - torsoH + s(2) + (A('b') ? 1 : 0));
        for (let i = 0; i < 2; i++) {
          const f = s(G[i][0]), up = s(G[i][1]), lx = cx + (i ? s(1) : -s(6)) + (b > 1.1 ? (i ? s(1) : -s(1)) : 0);
          const knee = hipY + Math.round((base - hipY) / 2) - up, v = i ? 0.5 : 0.62;
          p.box(lx + Math.round(f / 2), hipY, s(5), knee - hipY + 1, BT, { r: 1, v });           // 大腿
          p.box(lx + f, knee, s(5), Math.max(1, base - s(3) - up - knee + 1), BT, { r: 1, v }); // 小腿
          p.box(lx + f, base - up - s(3), s(6), s(3), SH, { r: 1 });                            // 鞋
        }
      }
      // 胳膊跟着腿反着甩：sw>0 前面那只手往前
      const sw = s({ 1: 2, 2: 0, 3: -2, 4: 0 }[fr] || 0);
      const tY = hipY - torsoH + s(2) + (A('b') ? 1 : 0);
      const armR = F.outfit === 'tank' ? SK : TP, hand2 = [R0 + s(1) - Math.round(sw / 2), tY + s(14)]; // 后面那只手（朝右时在右边）拿东西
      // 一只胳膊：上臂贴着肩，小臂往前（dx）摆；手跟着
      const arm = (ax, dx, v) => { p.box(ax, tY + s(2), s(4), s(7), armR, { r: 1, v }); p.box(ax + dx, tY + s(8), s(4), s(6), armR, { r: 1, v }); };
      const twoHand = /^(bowl|baby|tray|book)$/.test(F.hand || '');
      const gest = !twoHand && (A('g') ? 1 : A('h') ? 2 : 0); // 前面那只手在比划
      // 斗篷 / 长外套 / 裙子先画（盖住腿的上半截）
      if (F.outfit === 'cloak') p.box(L0 - s(3), tY - s(2), torsoW + s(6), base - tY - s(3), TP, { r: s(4), v: 0.55 });
      if (F.outfit === 'longcoat') p.box(L0 - 1, tY, torsoW + 2, torsoH + s(9), TP, { r: s(2), v: 0.6 });
      if (F.outfit === 'dress') p.box(L0 - s(2), hipY - s(3), torsoW + s(4), s(10), TP, { r: s(2), v: 0.62 });
      // 后面那只手臂、身子、前面那只手臂
      arm(R0 - s(2), -Math.round(sw / 2), 0.42);
      if (F.outfit !== 'cloak') p.box(L0, tY, torsoW, torsoH, TP, { r: s(3), v: 0.66 });
      // 身上的
      const o = F.outfit;
      if (o === 'apron') p.box(cx - s(5), tY + s(5), s(10), torsoH - s(4), RP.white, { r: 1, v: 0.75 });
      if (o === 'whitecoat') { p.box(L0, tY, torsoW, torsoH + s(3), RP.white, { r: s(3), v: 0.72 }); p.rect(cx + s(2), tY + s(4), s(3), 1, '#e83a4a', true); p.rect(cx + s(3), tY + s(3), 1, s(3), '#e83a4a', true); }
      if (o === 'vest') { p.box(L0 + 1, tY + 1, torsoW - 2, torsoH - s(3), rampOf('#ff8a2a'), { r: s(2), v: 0.72 }); p.rect(L0 + 1, tY + s(7), torsoW - 2, s(2), '#e8f0ff', true); }
      if (o === 'suit') { p.box(cx - s(2), tY + 1, s(4), s(8), RP.white, { v: 0.85 }); p.rect(cx, tY + s(2), 1, s(7), '#c82e3a'); }
      if (o === 'uniform') { p.rect(cx, tY + s(4), 1, 1, '#ffd860'); p.rect(cx, tY + s(8), 1, 1, '#ffd860'); p.box(L0, tY, torsoW, s(3), rampOf(D.mixHex(L.top, '#000000', 0.3)), { r: 1 }); p.rect(L0 + s(2), tY + s(5), s(3), s(2), '#ffd860'); }
      if (o === 'tank') p.box(cx - s(4), tY, s(8), s(4), SK, { r: 1, v: 0.6 });
      if (o === 'belly') p.ell(R0 - s(1), tY + s(10), s(5), s(5), TP);
      if (o === 'blanket') { p.box(L0 - s(3), tY - s(1), torsoW + s(6), s(11), rampOf('#7a4a3a'), { r: s(3), v: 0.6 }); p.rect(L0 - s(2), tY + s(3), torsoW + s(4), 1, '#c8a060'); p.rect(L0 - s(2), tY + s(7), torsoW + s(4), 1, '#c8a060'); }
      if (o === 'scarf') p.box(cx - s(6), tY - s(1), s(12), s(4), rampOf('#d2b48c'), { r: 2 });
      if (o === 'badge') { p.rect(cx + s(2), tY + s(4), s(3), s(3), '#ffd27a', true); p.px(cx + s(2), tY + s(4), '#fff4c0', true); }
      if (F.back === 'bag' && !sitting) { p.line(L0 + 1, tY, R0 - 1, tY + s(10), RP.cloth[2]); p.box(R0 - s(2), tY + s(9), s(6), s(6), RP.crate, { r: 1 }); }
      if (F.back === 'pack' && !sitting) { p.rect(L0 + s(2), tY, s(2), torsoH - s(2), RP.olive[1]); }
      // 前面那只手臂和手
      const ax = L0 - s(2);
      if (gest === 1) { // 小臂横过来往前指：手停在胸口前面
        p.box(ax, tY + s(2), s(4), s(7), armR, { r: 1, v: 0.7 });
        p.box(ax + s(1), tY + s(7), torsoW + s(4), s(4), armR, { r: 1, v: 0.7 });
        p.ell(ax + torsoW + s(6), tY + s(9), 2.2 * k, 2 * k, SK);
      } else if (gest === 2) { // 手抬到肩膀那么高，往前摊开
        p.box(ax, tY + s(2), s(4), s(7), armR, { r: 1, v: 0.7 });
        p.box(ax + s(1), tY + s(7), torsoW - s(2), s(4), armR, { r: 1, v: 0.7 });
        p.box(ax + torsoW - s(2), tY + s(4), s(5), s(6), armR, { r: 1, v: 0.7 });
        p.ell(ax + torsoW + s(4), tY + s(4), 2.4 * k, 2.2 * k, SK); p.px(ax + torsoW + s(6), tY + s(2), D.mixHex(L.skin, '#ffffff', 0.3)); // 手心朝上摊开
      } else {
        arm(ax, sw, 0.7);
        p.ell(ax + s(1) + sw, tY + s(14), 2.2 * k, 2 * k, SK);
      }
      // 手里拿的（大多在右手，朝右时在身前）
      const h = F.hand, [hx, hy2] = hand2;
      if (h === 'cane' && !sitting) { p.box(hx + s(1), hy2, s(2), base - hy2, RP.crate, { v: 0.6 }); p.box(hx - s(1), hy2 - s(1), s(4), s(2), RP.crate); }
      if (h === 'crutch' && !sitting) { p.box(hx + s(2), tY + s(2), s(2), base - tY - s(2), RP.silver, { v: 0.6 }); p.box(hx, tY + s(1), s(5), s(2), RP.silver); p.box(L0, tY + s(4), torsoW, s(3), RP.white, { v: 0.85 }); }
      if (h === 'broom' && !sitting) { p.line(hx + s(4), tY - s(4), hx - s(2), base - s(4), RP.crate[3]); p.line(hx + s(5), tY - s(4), hx - s(1), base - s(4), RP.crate[2]); p.box(hx - s(6), base - s(5), s(8), s(5), RP.yellow, { v: 0.5 }); }
      if (h === 'rod' && !sitting) { p.line(hx, hy2, hx + s(12), tY - s(16), RP.gunmetal[3]); p.line(hx + s(12), tY - s(16), hx + s(13), tY - s(4), '#c8cbd6'); }
      if (h === 'sign' && !sitting) { p.box(hx + s(1), tY - s(18), s(2), base - tY + s(14), RP.crate, { v: 0.55 }); p.box(hx - s(4), tY - s(20), s(12), s(9), RP.white, { r: 1, v: 0.8 }); p.rect(hx - s(1), tY - s(18), s(6), 1, '#5a2a10'); p.rect(hx, tY - s(15), s(4), 1, '#5a2a10'); }
      if (h === 'baton' && !sitting) p.box(hx, hy2 - s(1), s(2), s(8), RP.dark, { v: 0.7 });
      if (h === 'briefcase' && !sitting) { p.box(hx - s(2), hy2, s(8), s(6), RP.cloth, { r: 1, v: 0.6 }); p.rect(hx, hy2 - 1, s(4), 1, RP.cloth[1]); }
      if (h === 'toolbox' && !sitting) { p.box(hx - s(2), hy2, s(8), s(5), RP.red, { r: 1, v: 0.6 }); p.rect(hx, hy2 - 1, s(4), 1, RP.gunmetal[2]); }
      if (h === 'basket') { p.ell(hx + s(1), hy2 + s(2), s(5), s(3), RP.crate); p.ell(hx - s(1), hy2 - 1, s(2), s(2), RP.green); p.ell(hx + s(3), hy2 - 1, s(2), s(2), RP.red); }
      if (h === 'flowers') { p.ell(hx + s(1), hy2 + s(2), s(5), s(3), RP.crate); for (const [dx, c] of [[-3, RP.red], [0, RP.yellow], [3, RP.magenta], [1, RP.white]]) p.ell(hx + s(dx) + s(1), hy2 - s(2) - (dx === 1 ? s(2) : 0), s(2), s(2), c); }
      if (h === 'cable') p.ell(R0 - s(1), tY + s(3), s(4), s(4), RP.copper), p.disc(R0 - s(1), tY + s(3), 1.6 * k, INK);
      if (h === 'tray') { p.line(L0 + 1, tY, cx, tY + s(8), RP.cloth[2]); p.line(R0 - 1, tY, cx, tY + s(8), RP.cloth[2]); p.box(L0 - s(3), tY + s(8), torsoW + s(6), s(3), RP.crate, { v: 0.6 }); for (let i = 0; i < 4; i++) p.rect(L0 - s(2) + i * s(4), tY + s(6), s(3), s(2), [RP.red[4], RP.yellow[4], RP.green[4], RP.blue[4]][i]); }
      if (h === 'baby') { p.ell(cx + s(2), tY + s(7), s(5), s(4), RP.white, { bias: 0.1 }); p.ell(cx + s(5), tY + s(4), s(2.5), s(2.5), SK, { bias: 0.15 }); }
      if (h === 'book') { p.box(cx - s(1), tY + s(6), s(7), s(5), RP.red, { r: 1, v: 0.6 }); p.rect(cx, tY + s(7), s(5), 1, RP.white[5]); }
      if (h === 'bowl') p.ell(L0 - s(1) + sw, tY + s(12), 3.5 * k, 2 * k, RP.silver, { spec: true });
      // 脖子、头、头发、眼睛（朝右；朝左时整张翻过来）；n 低头点一下：头往下、往前各挪一点
      const hy = tY - headR + s(1) + (A('n') ? 1 : 0), hood = F.hairS === 'hood';
      p.box(cx - s(2), tY - s(2), s(4), s(3), SK, { v: 0.4 });
      if (hood) p.ell(cx, hy - 1, headR + s(2), headR + s(2), TP, { bias: -0.05 });           // 兜帽（后面）
      if (F.hairS === 'long') p.box(cx - s(7), hy - s(3), s(6), s(15), HA, { r: 2, v: 0.5 }); // 长发垂到肩
      p.ell(cx + s(1), hy, headR, headR + 0.6 * k, SK, { bias: 0.18 });                         // 脸
      if (F.hairS === 'bald') { p.px(cx + s(2), hy - s(4), '#fff4e0'); p.box(cx - s(5), hy - s(1), s(2), s(3), HA, { v: 0.5 }); }
      else if (!hood) {
        p.ell(cx - s(1), hy - s(4), headR + 0.4 * k, headR * 0.45, HA, { flat: true });      // 头顶的头发
        p.box(cx - s(6), hy - s(4), s(3), s(6), HA, { r: 1, v: 0.45 });                      // 脑后的头发
        if (F.hairS === 'bun') p.ell(cx - s(4), hy - s(7), s(3), s(3), HA);
        if (F.hairS === 'ponytail') p.box(cx - s(9), hy - s(3), s(3), s(8), HA, { r: 1, v: 0.5 });
      } else p.box(cx - s(5), hy - s(6), s(10), s(3), TP, { r: 1, v: 0.7 });                // 兜帽的边
      // 眼睛：c 转过脸看镜头（眼睛往脸中间挪），e 眨眼（闭成一道线）
      const gx = A('c') ? -s(2) : 0, e1 = cx + s(3) + gx, e2 = cx + s(6) + gx, lid = D.mixHex(L.skin, INK, 0.55);
      const eyes = (h1) => { if (A('e')) { p.rect(e1, hy + 1, 1, 1, lid); p.rect(e2, hy + 1, 1, 1, lid); } else { p.rect(e1, hy, 1, h1, INK); p.rect(e2, hy, 1, h1, INK); } };
      eyes(s(2));
      const fc = F.face, mx = cx + s(5) + Math.round(gx / 2);
      if (A('m') && fc !== 'mask' && fc !== 'gasmask') { p.rect(mx - 1, hy + s(3), 2, 2, D.mixHex(L.skin, INK, 0.7)); p.px(mx - 1, hy + s(3) + 1, D.mixHex(L.skin, '#c84a4a', 0.5)); } // 张嘴
      else p.px(mx, hy + s(3), D.mixHex(L.skin, INK, 0.45));                                    // 嘴
      // 脸上的
      if (fc === 'beard') p.ell(cx + s(3), hy + s(4), s(4), s(3), HA, { flat: true });
      if (fc === 'glasses') { p.rect(e1 - 1, hy - 1, s(3), s(2), '#c8cbd6'); p.rect(e2 - 1, hy - 1, s(3), s(2), '#c8cbd6'); eyes(1); }
      if (fc === 'eyepatch') { p.rect(cx + s(5), hy - 1, s(3), s(3), INK); p.line(cx - s(4), hy - s(3), cx + s(6), hy - 1, INK); }
      if (fc === 'bandage') { p.box(cx - s(5), hy - s(4), s(12), s(3), RP.white, { v: 0.85 }); p.px(cx + s(3), hy - s(3), '#c82e3a'); }
      if (fc === 'mask') p.box(cx + s(1), hy + s(1), s(6), s(4), RP.white, { r: 1, v: 0.85 });
      if (fc === 'gasmask') { p.box(cx, hy + 1, s(7), s(5), RP.gunmetal, { r: 2 }); p.ell(cx + s(6), hy + s(4), s(2.5), s(2.5), RP.gunmetal); p.rect(cx + s(2), hy - 1, s(2), s(2), '#7fd8ff', true); p.rect(cx + s(5), hy - 1, s(2), s(2), '#7fd8ff', true); }
      if (fc === 'phones') { p.ell(cx - s(4), hy, s(2.5), s(3), RP.red); p.line(cx - s(4), hy - s(3), cx + s(2), hy - s(6), RP.gunmetal[3]); }
      if (fc === 'headset') { p.rect(cx - s(6), hy - s(6), s(12), 1, RP.gunmetal[3]); p.box(cx - s(7), hy - s(2), s(3), s(5), RP.gunmetal, { r: 1 }); p.rect(cx - s(6), hy + s(3), s(5), 1, RP.gunmetal[2]); p.px(cx - s(2), hy + s(3), '#ff4d5e', true); }
      // 帽子
      const ht = F.hat, cap = (ramp, brim) => { p.box(cx - s(6), hy - s(7), s(13), s(4), ramp, { r: 1 }); if (brim) p.rect(cx + s(4), hy - s(4), s(5), 1, ramp[1]); };
      if (ht === 'cap') cap(RP.gunmetal, true);
      if (ht === 'beanie') p.ell(cx, hy - s(4), headR + 1, headR * 0.6, rampOf(L.top));
      if (ht === 'kerchief') p.box(cx - s(6), hy - s(7), s(13), s(4), rampOf('#d07b3c'), { r: 2 });
      if (ht === 'hardhat') { p.ell(cx, hy - s(4), headR + 1, headR * 0.7, RP.yellow, { spec: true }); p.rect(cx - s(7), hy - s(2), s(15), 1, RP.yellow[2]); }
      if (ht === 'chef') { p.box(cx - s(5), hy - s(12), s(10), s(8), RP.white, { r: 1, v: 0.85 }); p.ell(cx, hy - s(12), s(6), s(3), RP.white, { bias: 0.1 }); }
      if (ht === 'beret') p.ell(cx - s(1), hy - s(5), headR + s(1), s(3), rampOf('#5a2a3a'), { flat: true });
      if (ht === 'bucket') { p.box(cx - s(5), hy - s(8), s(10), s(5), rampOf('#8a8a6a'), { r: 2 }); p.box(cx - s(8), hy - s(4), s(16), s(2), rampOf('#7a7a5a')); }
      if (ht === 'straw') { p.ell(cx, hy - s(4), s(11), s(3), rampOf('#d8c07a'), { flat: true }); p.ell(cx, hy - s(7), s(4), s(3), rampOf('#c8b06a')); }
      if (ht === 'riot') { p.ell(cx, hy - s(1), headR + s(1), headR + s(1), RP.gunmetal, { spec: true }); p.box(cx + s(1), hy - s(2), s(7), s(5), RP.glass, { v: 0.6 }); }
      if (ht === 'moto') { p.ell(cx, hy - s(1), headR + s(1), headR + s(1), rampOf(L.top), { spec: true }); p.box(cx + s(2), hy - s(2), s(6), s(4), RP.dark, { v: 0.5 }); }
      if (ht === 'nursecap') { p.box(cx - s(4), hy - s(9), s(9), s(4), RP.white, { r: 1, v: 0.85 }); p.rect(cx, hy - s(8), 1, s(2), '#e83a4a'); p.rect(cx - 1, hy - s(7), s(3), 1, '#e83a4a'); }
    });
    return (sprCache[key] = spr);
  }
  D.humanSprite = humanSprite;

  // ── 人怎么动（所有画人的地方共用：小镇、剧情屋、站里的对话、人群）
  // D.humanAnim(p, t, o) → { fr, an, bob }：交给 humanSprite(L, pose, fr, an)，bob 加在脚底 y 上（负的往上）
  //   o.pose 姿势（默认 p.pose）、o.moving 在走（默认 p.moving）、o.talk 正在说话、o.listen 在听别人说
  //   走路：一圈四帧，抬脚那两帧身子高半个像素；站着 / 坐着：呼吸、隔几秒眨一下眼（偶尔连眨两下）、
  //   时不时转过脸看一眼镜头；说话：嘴一张一合（停顿处合上）、手跟着比划、偶尔点头；听的人偶尔点头。
  //   每个人的节奏按自己的 seed 错开，不会一起眨眼、一起喘气。
  const hstr = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; };
  const frac = x => x - Math.floor(x);
  const noise = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453); // 一个整数 → 0..1（同一个数每次一样）
  D.humanAnim = function (p, t, o) {
    o = o || {};
    const pose = o.pose || p.pose || 'stand', moving = o.moving != null ? o.moving : p.moving;
    if (p._as == null) p._as = typeof p.seed === 'number' ? p.seed % 997 : hstr(String(p.id || p.who || '') + ((p.look || p.L || {}).top || '') + ':' + Math.round(p.x || 0)); // 没有 seed 的按名字、衣服、站的位置算一个
    const sd = p._as, an = [];
    let fr = 0, bob = 0;
    if (moving && (pose === 'stand' || pose === 'kidrun')) {
      fr = 1 + (Math.floor(t * (pose === 'kidrun' ? 13 : 8.5) + sd) & 3);
      bob = fr === 2 || fr === 4 ? -0.5 : 0;
      return { fr, an: '', bob };
    }
    // 呼吸：一呼一吸 2.6–3.8 秒，呼气那一小半上身沉下去
    const per = 2.6 + (sd % 13) / 10;
    if (Math.sin((t / per + sd * 0.137) * Math.PI * 2) > 0.25) an.push('b');
    // 眨眼：每 2.5–5.5 秒一下，0.12 秒；四次里有一次连眨两下
    const bp = 2.5 + (sd % 31) / 10, bt = t + sd * 0.71, cyc = Math.floor(bt / bp), ph = bt - cyc * bp;
    if (ph < 0.12 || (noise(cyc + sd) < 0.25 && ph > 0.24 && ph < 0.36)) an.push('e');
    if (o.talk) {
      // 说话：嘴按音节一张一合，每 0.9 秒左右换个手势（不比划 / 往前指 / 摊开），偶尔点一下头
      const sy = Math.floor(t * 9 + sd), beat = Math.floor((t + sd * 0.3) / 0.9), r = noise(beat * 3 + sd);
      if (noise(sy) < 0.68) an.push('m');
      if (r < 0.4) an.push('g'); else if (r < 0.62) an.push('h');
      if (frac((t + sd) / 1.7) < 0.12) an.push('n');
    } else {
      if (o.listen && frac((t + sd * 0.53) / 3.1) < 0.1) an.push('n'); // 听着，点点头
      // 时不时转过脸看一眼镜头（每 6–10 秒，看 0.9 秒）
      const lp = 6 + (sd % 41) / 10, lt = frac((t + sd * 1.9) / lp) * lp;
      if (lt < 0.9 && pose !== 'lie') an.push('c');
    }
    return { fr, an: an.join(''), bob };
  };
  // 有对话 R（D.Dlg.run / D.TalkB.run 返回的）时：这个人是不是正在说（字还在往外蹦）
  D.humanSpeaking = function (R, isMe) {
    const v = R && !R.done && R.view ? R.view() : null;
    if (!v || v.kind !== 'say') return false;
    return isMe(v) && v.shown < ((v.glyphs && v.glyphs.length) || 0);
  };

  // 一个人：(X, y) 是脚下的点
  function person(ctx, ex, S, p, time) {
    const L = lookOf(p), X = Math.round(p.x), y = Math.round(p.y), pose = p.pose || 'stand';
    const T = S.talk, inTalk = T && T.op && T.obj === p;
    const chatting = S.town && S.town.chats && S.town.chats.some(c => c.p === p && c.t < 1.6); // 小镇里随口说一句：头上冒字那会儿也动嘴
    const talk = chatting || (inTalk && D.humanSpeaking(T.R, v => v.who !== '旁白'));
    const A = D.humanAnim(p, time, { pose, talk, listen: inTalk && !talk });
    const fr = A.fr, spr = humanSprite(L, pose, fr, A.an), flip = (p.face || 1) < 0, bob = A.bob;
    ctx.fillStyle = 'rgba(5,4,12,0.45)'; ctx.beginPath(); ctx.ellipse(X, y - 0.5, pose === 'lie' ? 10 : 5, 1.6, 0, 0, Math.PI * 2); ctx.fill(); // 影子
    D.blit(ctx, spr, X, y + bob, flip);
    ex.globalAlpha = 0.14; D.blit(ex, spr, X, y + bob, flip); ex.globalAlpha = 1; // 和站里的角色一样，暗处也稍微看得清
    if (spr.emit) D.blit(ex, spr, X, y + bob, flip, 'emit');
    // 有名字的人：头顶一个小光点，颜色是他的
    if (p.named) { const top = spr.h / 2; ex.fillStyle = dotCol(p.id); ex.fillRect(X - 1, y - top - 4 + Math.round(Math.sin(time * 3 + p.seed) * 0.8), 2, 2); }
  }

  // ── 装饰
  const CAR_COL = [['#7a3b2e', '#b0583e'], ['#3f5f6f', '#5f8a9a'], ['#6a6a3a', '#9a9a52'], ['#5a4060', '#80608a']];
  const flame = (ex, x, y, time, s, seed) => { // 一簇火苗（画在发光层）
    for (let i = 0; i < 5; i++) {
      const h = Math.round((3 + 3 * Math.abs(Math.sin(time * (7 + i) + seed + i * 1.7))) * s), w = Math.max(1, Math.round(2 * s)), xx = Math.round(x + (i - 2) * 2 * s);
      ex.fillStyle = i === 2 ? 'rgba(255,230,150,0.8)' : i % 2 ? 'rgba(255,120,40,0.7)' : 'rgba(255,170,70,0.7)'; ex.fillRect(xx, y - h, w, h);
    }
  };
  // 装饰的精灵：也用 D.mkSprite 画（倒角 / 球面着色、抖动、黑边），画一次缓存。只有火苗、灯泡、窗里的光、火星这些光效直接画在发光层上
  const dsCache = new Map();
  const dspr = (key, w, h, fn) => { let s = dsCache.get(key); if (!s) { s = D.mkSprite(w, h, fn); dsCache.set(key, s); } return s; };
  const put = (ctx, ex, spr, x, y) => { D.blit(ctx, spr, x, y); if (spr.emit) D.blit(ex, spr, x, y, false, 'emit'); };
  const hash = n => { let s = (n | 0) || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
  function decor(ctx, ex, d, time, S) {
    const E = (x, y, w, h, c) => { ex.fillStyle = c; ex.fillRect(x, y, w, h); }, RP = D.RAMP;
    if (d.k === 'carTop') { // 车厢远处那面车壁和两头的车壁（里面是空的，看得见车厢里）
      const [body] = CAR_COL[d.n % CAR_COL.length], W = (d.w + 12) * 2, H = (9 * TS + 2) * 2;
      const spr = dspr('carTop|' + d.n + '|' + d.w, W, H, p => {
        p.box(0, 0, W, 36, rampOf(body), { r: 3, v: 0.5 });
        for (let x = 20; x < W - 40; x += 40) p.box(x, 8, 24, 14, RP.glass, { r: 1, v: 0.25 });
        p.box(0, 30, 8, H - 30, rampOf(body), { v: 0.45 }); p.box(W - 8, 30, 8, H - 30, rampOf(body), { v: 0.4 });
      });
      put(ctx, ex, spr, d.x + d.w / 2, 12 * TS);
    } else if (d.k === 'car') { // 对着站台、开着门的那面：车身、腰线、亮着暖光的窗、门框、拉开的门
      const [body] = CAR_COL[d.n % CAR_COL.length], W = (d.w + 12) * 2, dx = (d.door - d.x + 6) * 2, dw = 2 * TS * 2;
      const spr = dspr('car|' + d.n + '|' + d.w + '|' + dx, W, 66, p => {
        const seg = (a, b) => {
          if (b - a < 6) return;
          p.box(a, 2, b - a, 62, rampOf(body), { r: 3, v: 0.62 });
          p.box(a, 38, b - a, 6, RP.yellow, { v: 0.72 });
          for (let x = a + 8; x < b - 26; x += 36) { p.box(x, 10, 24, 18, RP.dark, { r: 1 }); p.grad(x + 2, 12, 20, 14, rampOf('#ffb060'), true); p.rect(x + 11, 12, 2, 14, '#2a1a10'); }
        };
        seg(0, dx - 6); seg(dx + dw + 6, W);
        p.box(dx - 8, 0, dw + 16, 10, rampOf(body), { r: 2, v: 0.72 });   // 门楣
        p.box(dx - 8, 8, 6, 56, RP.silver, { r: 1, v: 0.55 }); p.box(dx + dw + 2, 8, 6, 56, RP.silver, { r: 1, v: 0.45 }); // 拉开的两扇门
      });
      put(ctx, ex, spr, d.x + d.w / 2, 12 * TS);
      E(d.door, 12 * TS - 2, 2 * TS, 1, 'rgba(255,190,110,0.35)'); // 门里透出来的光
      D.text(ctx, 'E-' + (11 + d.n * 3), (d.x - 6 + d.door) / 2, 10 * TS + 24, '#e8d8a8', { align: 'center' });
    } else if (d.k === 'awning') { // 摊位的布篷：两色条纹，下沿一排小弧，两根木杆
      const [a, b] = d.col, W = (d.w + 4) * 2;
      const spr = dspr('awn|' + a + b + '|' + d.w, W, 60, p => {
        p.box(0, 18, 4, 42, RP.crate, { v: 0.5 }); p.box(W - 4, 18, 4, 42, RP.crate, { v: 0.4 });
        for (let x = 0, i = 0; x < W; x += 12, i++) { const rp = rampOf(i % 2 ? b : a), w = Math.min(12, W - x); p.box(x, 2, w, 14, rp, { v: 0.72 }); p.ell(x + w / 2, 16, w / 2, 4, rp, { flat: true }); }
      });
      put(ctx, ex, spr, d.x + d.w / 2, d.y + 22);
    } else if (d.k === 'string') { // 串灯：电线一段段往下垂（细线），灯泡一闪一闪（光效）
      const seg = 4 * TS, cols = ['255,190,90', '255,230,150', '255,140,90', '255,160,210', '160,230,255'];
      ctx.fillStyle = '#2a1f19';
      for (let s = 0; s < d.w; s += seg) {
        for (let i = 0; i <= seg && s + i <= d.w; i++) ctx.fillRect(d.x + s + i, d.y + Math.round(Math.sin(i / seg * Math.PI) * 5), 1, 0.5);
        for (let j = 1; j < 4; j++) {
          const i = Math.round(j * seg / 4), yy = d.y + Math.round(Math.sin(i / seg * Math.PI) * 5) + 1, k = 0.55 + 0.45 * Math.sin(time * 2.2 + (s + i) * 0.37 + d.seed);
          ctx.fillStyle = '#2a1f19'; ctx.fillRect(d.x + s + i - 1, yy - 0.5, 2, 0.5);
          E(d.x + s + i - 1, yy, 2, 2, `rgba(${cols[((s / seg) * 3 + j) % cols.length]},${k.toFixed(2)})`);
          ctx.fillStyle = '#2a1f19';
        }
      }
    } else if (d.k === 'fire') { // 篝火：石圈、交叉的木柴（精灵）；火苗、火星（光效）
      const spr = dspr('fire', 52, 22, p => {
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; p.ell(26 + Math.cos(a) * 21, 13 + Math.sin(a) * 6, 4, 3, RP.silver, { bias: -0.35 }); }
        p.box(10, 9, 32, 5, RP.crate, { r: 2, v: 0.6 }); p.box(16, 6, 20, 5, RP.crate, { r: 2, v: 0.7 });
        p.rect(14, 11, 24, 2, '#ff8a3a', true); p.rect(18, 8, 14, 1, '#ffb050', true);
      });
      put(ctx, ex, spr, d.x, d.y + 4);
      flame(ex, d.x - 2, d.y - 6, time, 1, 0.3); flame(ex, d.x + 3, d.y - 6, time, 0.7, 2.1);
      for (let i = 0; i < 4; i++) { const t = (time * 0.5 + i / 4) % 1; E(d.x + Math.round(Math.sin(t * 9 + i) * 6), d.y - 12 - Math.round(t * 26), 1, 1, `rgba(255,200,120,${(1 - t).toFixed(2)})`); }
    } else if (d.k === 'board') { // 站牌：两根柱子，一块黑板（精灵）；E-17 · 23:40（停住的时间，像素字）
      const spr = dspr('board', 68, 56, p => {
        p.box(6, 26, 5, 30, RP.gunmetal, { v: 0.55 }); p.box(57, 26, 5, 30, RP.gunmetal, { v: 0.45 });
        p.box(0, 0, 68, 32, RP.gunmetal, { r: 2, v: 0.5 }); p.box(4, 4, 60, 24, RP.dark, { v: 0.25 });
      });
      put(ctx, ex, spr, d.x, d.y);
      const y = d.y - 26;
      D.text(ctx, 'E-17', d.x, y + 3, '#ffb057', { align: 'center' }); D.text(ex, 'E-17', d.x, y + 3, 'rgba(255,176,87,0.6)', { align: 'center' });
      const on = (time * 1.2 | 0) % 2; D.text(ctx, '23:40', d.x, y + 9, on ? '#ff3047' : '#7a1a24', { align: 'center' }); if (on) D.text(ex, '23:40', d.x, y + 9, 'rgba(255,48,71,0.7)', { align: 'center' });
    } else if (d.k === 'names') { // 名字墙：木板墙，钉满写了名字的纸片
      const W = d.w * 2;
      const spr = dspr('names|' + d.w + '|' + d.seed, W, 48, p => {
        for (let x = 0; x < W; x += 12) p.box(x, 2, Math.min(12, W - x), 46, RP.crate, { v: 0.5 + (x / 12 % 2) * 0.08 });
        const rnd = hash(d.seed);
        for (let n = 0; n < Math.floor(W / 4); n++) { const px = 2 + Math.floor(rnd() * (W - 12)), py = 4 + Math.floor(rnd() * 34); p.box(px, py, 9, 7, rnd() < 0.2 ? RP.yellow : RP.white, { v: 0.85 }); p.rect(px + 2, py + 2, 5, 1, '#5a4a3a'); p.rect(px + 2, py + 4, 3, 1, '#5a4a3a'); }
      });
      put(ctx, ex, spr, d.x + d.w / 2, d.y);
    } else if (d.k === 'sandbag') { // 沙袋：三层，一层错开半个
      const W = d.w * 2;
      const spr = dspr('sand|' + d.w, W, 30, p => {
        for (let row = 0; row < 3; row++) for (let x = 7 + (row % 2) * 7; x < W - 4; x += 14) p.ell(x, 24 - row * 8, 7.5, 5, rampOf(row % 2 ? '#8a7a5a' : '#9a8a64'));
      });
      put(ctx, ex, spr, d.x + d.w / 2, d.y);
    } else if (d.k === 'gate') { // 路障门：铁架、警示条、探照灯
      const W = (d.w + 9) * 2, H = (3 * TS - 2) * 2 + 8;
      const spr = dspr('gate|' + d.w, W, H, p => {
        p.box(0, 8, 6, H - 8, RP.gunmetal, { v: 0.6 }); p.box(W - 6, 8, 6, H - 8, RP.gunmetal, { v: 0.45 });
        for (let x = 0, i = 0; x < W; x += 8, i++) p.box(x, 8, Math.min(8, W - x), 10, i % 2 ? RP.dark : RP.yellow, { v: 0.7 });
        p.box(W / 2 - 7, 0, 14, 10, RP.gunmetal, { r: 2 }); p.rect(W / 2 - 4, 4, 8, 3, '#fff5d2', true);
      });
      put(ctx, ex, spr, d.x + (d.w - 4) / 2 + 2, d.y);
    } else if (d.k === 'brazier') { // 火盆：铁桶（精灵），上面一团火（光效）
      const spr = dspr('brazier', 22, 26, p => {
        p.box(1, 4, 20, 22, RP.gunmetal, { r: 2, v: 0.55 }); p.rect(2, 11, 18, 2, RP.gunmetal[0]); p.rect(2, 19, 18, 2, RP.gunmetal[0]);
        p.box(0, 1, 22, 5, RP.rust, { r: 2 }); p.rect(3, 2, 16, 2, '#ff8a3a', true);
      });
      put(ctx, ex, spr, d.x, d.y);
      flame(ex, d.x, d.y - 12, time, 1, d.x);
    } else if (d.k === 'bell') { // 叫车铃：一根柱子挂一口铜铃；没叫车的时候铃边一闪一闪
      const spr = dspr('bell', 28, 58, p => {
        p.box(12, 6, 5, 52, RP.gunmetal, { v: 0.55 }); p.box(2, 2, 24, 5, RP.gunmetal, { r: 1 });
        p.ell(14, 15, 7, 7.5, RP.gold, { spec: true }); p.box(5, 19, 18, 4, RP.gold, { r: 1, v: 0.7 }); p.ell(14, 25, 2.2, 2.2, RP.copper);
      });
      put(ctx, ex, spr, d.x, d.y);
      if (S && S.sched && S.sched.st === 'off') E(d.x - 5, d.y - 28, 10, 1, `rgba(255,216,96,${(0.4 + 0.4 * Math.sin(time * 4)).toFixed(2)})`);
    } else if (d.k === 'laundry') { // 晾衣绳：细绳往下垂，挂着几件衣服（衣服是小精灵，跟着风轻轻晃）
      const yy = d.y + 6, n = Math.max(2, Math.floor(d.w / 14)), cols = ['#c8a0a0', '#a0c8c8', '#d8d0a0', '#a0a8d8', '#c8c0b0'];
      ctx.fillStyle = '#2a2420'; for (let i = 0; i <= d.w; i++) ctx.fillRect(d.x + i, yy + Math.round(Math.sin((i / d.w) * Math.PI) * 4), 1, 0.5);
      for (let k = 0; k < n; k++) {
        const i = Math.round((k + 0.5) * d.w / n), sag = Math.round(Math.sin((i / d.w) * Math.PI) * 4), wave = Math.sin(time * 1.5 + k) * 0.6, c = cols[k % cols.length], w = 4 + (k % 3);
        const spr = dspr('cloth|' + c + '|' + w, w * 2 + 2, 12, p => p.box(1, 0, w * 2, 11, rampOf(c), { r: 1, v: 0.7 }));
        put(ctx, ex, spr, d.x + i + w / 2 + wave, yy + sag + 7);
      }
    } else if (d.k === 'stove') { // 炉灶：铁炉、锅（精灵）；炉口的火、往上飘的烟
      const spr = dspr('stove', 26, 26, p => { p.box(1, 8, 24, 18, RP.gunmetal, { r: 1, v: 0.5 }); p.ell(13, 6, 9, 4, RP.dark, { spec: true }); p.rect(9, 18, 8, 3, '#ff8a3a', true); });
      put(ctx, ex, spr, d.x + 6, d.y + 12);
      const fire = (Math.sin(time * 9) + 1) / 2; E(d.x + 4, d.y + 9, 4, 2, 'rgba(255,' + (120 + ((fire * 80) | 0)) + ',60,0.6)');
      for (let i = 0; i < 3; i++) { const t = (time * 0.6 + i / 3) % 1; ctx.fillStyle = 'rgba(220,220,220,' + ((1 - t) * 0.4).toFixed(2) + ')'; ctx.fillRect(d.x + 5 + Math.round(Math.sin(t * 6 + i) * 2), d.y - Math.round(t * 16), 2, 2); }
    } else if (d.k === 'chalk') { // 地上的粉笔画（画在地上的线条，本来就是平的）：一列小火车，车头一盏灯
      ctx.fillStyle = 'rgba(255,240,138,0.5)'; ctx.fillRect(d.x, d.y, 16, 4); ctx.fillRect(d.x + 16, d.y + 1, 4, 2); ctx.fillRect(d.x + 22, d.y, 10, 4);
      ctx.fillRect(d.x + 2, d.y + 4, 2, 2); ctx.fillRect(d.x + 11, d.y + 4, 2, 2); ctx.fillRect(d.x + 26, d.y + 4, 2, 2);
      E(d.x + 32, d.y + 1, 1, 1, 'rgba(255,240,138,0.8)');
    }
  }
  // 什么时候画：脚底在哪就按哪排序；车厢远壁、粉笔画垫底
  const sortY = d => (d.k === 'chalk' ? -1e6 : d.k === 'carTop' ? 3 * TS : d.k === 'car' ? 12 * TS : d.k === 'awning' ? d.y + 1 : d.k === 'string' ? d.y + 40 : d.y);

  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    const r = de0 ? de0.apply(this, arguments) : undefined;
    const F = S.floors && S.floors[S.f];
    if (F && F.decor) for (const d of F.decor) { list.push({ y: sortY(d), f: () => decor(ctx, ex, d, S.t, S) }); if (d.k === 'car') list.push({ y: sortY({ k: 'carTop' }), f: () => decor(ctx, ex, Object.assign({}, d, { k: 'carTop' }), S.t, S) }); }
    for (const p of S.people || []) if (p.f === S.f) list.push({ y: p.y, f: () => person(ctx, ex, S, p, S.t) });
    return r;
  };
})(D);
