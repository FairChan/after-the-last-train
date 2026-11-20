var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  // 威胁专属敌人（2026-11-15 用户："增加更多威胁等级，增多更多种类怪物"）：威胁 3 级起，每一级多 3 种，到 10 级一共 24 种。
  // 威胁到了它的等级（threat），哪一站都可能刷出来（不分站的类型），越新解锁的越常见（enemy.js 的 spawnGarrison）。
  // 行为沿用 7 种基础 AI（base），外形由 enemy-art-ext.js 按 body 程序生成，图鉴里的"和原型的区别"按数值算。
  // 键一律 th_ 开头，别和老敌人、扩充包重名（以前 mannequin 撞过一次，把伏击机盖成了狙击机）。
  const T = {
    // 3 戒备
    th_alarmhound: { name: '警戒犬', hp: 26, r: 6, speed: 80, loot: 1, base: 'crawler', body: 'crawler', sight: 130, dmgMul: 1.1, pack: 2, threat: 3, tag: '戒备时放出来的巡逻犬机，两只一组' },
    th_sirenball: { name: '警笛球', hp: 30, r: 6, speed: 42, loot: 1, base: 'drone', body: 'ball', sight: 170, spreadMul: 0.9, threat: 3, tag: '一边飞一边鸣笛的巡查球' },
    th_riotguard: { name: '防暴队员', hp: 46, r: 5, speed: 70, loot: 2, base: 'raider', body: 'human', human: true, dmgMul: 1.05, threat: 3, tag: '举着盾牌的防暴队，城里雇来的人' },
    // 4 搜捕
    th_tracker: { name: '追踪蛛', hp: 30, r: 6, speed: 86, loot: 1, base: 'crawler', body: 'bug', sight: 150, dmgMul: 1.15, threat: 4, tag: '顺着热量追过来的追踪蛛' },
    th_searchship: { name: '探照飞艇', hp: 34, r: 6, speed: 40, loot: 1, base: 'drone', body: 'flyer', sight: 190, threat: 4, tag: '挂着探照灯的小飞艇' },
    th_netter: { name: '捕网手', hp: 50, r: 5, speed: 74, loot: 2, base: 'raider', body: 'human', human: true, dmgMul: 1.1, threat: 4, tag: '专门抓人的搜捕队员' },
    // 5 围剿
    th_flanker: { name: '包抄兵', hp: 54, r: 5, speed: 80, loot: 2, base: 'raider', body: 'human', human: true, dmgMul: 1.15, pack: 2, threat: 5, tag: '两人一组从两边绕过来' },
    th_mortarcart: { name: '炮车', hp: 60, r: 8, speed: 0, loot: 2, base: 'turret', body: 'cart', dmgMul: 1.15, threat: 5, tag: '推到站里的移动炮位' },
    th_swarmer: { name: '蜂群', hp: 12, r: 5, speed: 102, loot: 0, base: 'bomber', body: 'flyer', dmgMul: 1.2, pack: 3, threat: 5, tag: '一放就是一群的自爆蜂' },
    // 6 封锁
    th_blockade: { name: '封锁炮', hp: 80, r: 8, speed: 0, loot: 2, base: 'turret', body: 'tank', dmgMul: 1.2, threat: 6, tag: '堵在路口的履带炮位' },
    th_jammer: { name: '干扰塔', hp: 34, r: 6, speed: 46, loot: 3, base: 'medic', body: 'pod', threat: 6, tag: '给周围的机器修理、套护盾的干扰塔' },
    th_lockeye: { name: '封锁哨', hp: 40, r: 6, speed: 44, loot: 2, base: 'drone', body: 'ball', sight: 190, dmgMul: 1.2, spreadMul: 0.85, threat: 6, tag: '封站以后到处飘的哨兵球' },
    // 7 猎杀
    th_hunter: { name: '猎手', hp: 64, r: 5, speed: 82, loot: 3, base: 'raider', body: 'human', human: true, dmgMul: 1.25, spreadMul: 0.85, threat: 7, tag: '专门追你的赏金猎人' },
    th_longshot: { name: '远猎', hp: 34, r: 6, speed: 36, loot: 3, base: 'sniper', body: 'walker', sight: 250, dmgMul: 1.3, threat: 7, tag: '站在高处的远程猎杀机' },
    th_stalker: { name: '潜行蛛', hp: 40, r: 6, speed: 92, loot: 2, base: 'crawler', body: 'crawler', sight: 150, dmgMul: 1.3, threat: 7, tag: '贴着墙根追来的猎杀蛛' },
    // 8 清场
    th_sweeper: { name: '清扫者', hp: 72, r: 5, speed: 76, loot: 3, base: 'raider', body: 'human', human: true, dmgMul: 1.3, pack: 2, threat: 8, tag: '两人一组挨个房间清场' },
    th_burner: { name: '焚化机', hp: 90, r: 8, speed: 0, loot: 3, base: 'turret', body: 'turret', dmgMul: 1.35, threat: 8, tag: '把整片站台烧干净的焚化炮' },
    th_cleanbee: { name: '清场蜂', hp: 18, r: 5, speed: 110, loot: 0, base: 'bomber', body: 'bug', dmgMul: 1.35, pack: 3, threat: 8, tag: '贴地冲过来的清场自爆机' },
    // 9 灭迹
    th_eraser: { name: '抹除者', hp: 80, r: 5, speed: 84, loot: 3, base: 'raider', body: 'human', human: true, dmgMul: 1.35, spreadMul: 0.8, threat: 9, tag: '不留活口的灭迹队员' },
    th_blackeye: { name: '黑瞳', hp: 40, r: 6, speed: 30, loot: 3, base: 'sniper', body: 'pod', sight: 270, dmgMul: 1.4, threat: 9, tag: '看得最远的黑色狙击眼' },
    th_shade: { name: '幽影球', hp: 46, r: 6, speed: 52, loot: 3, base: 'drone', body: 'ball', sight: 200, dmgMul: 1.35, spreadMul: 0.8, threat: 9, tag: '几乎没有声音的黑色哨兵' },
    // 10 终局
    th_executor: { name: '处决者', hp: 96, r: 5, speed: 86, loot: 3, base: 'raider', body: 'human', human: true, dmgMul: 1.45, spreadMul: 0.75, threat: 10, tag: '终局时才出动的处决队' },
    th_doomcart: { name: '末日炮车', hp: 110, r: 8, speed: 0, loot: 3, base: 'turret', body: 'cart', dmgMul: 1.45, threat: 10, tag: '最后才推出来的重炮车' },
    th_reaper: { name: '收割蛛', hp: 52, r: 6, speed: 96, loot: 2, base: 'crawler', body: 'bug', sight: 160, dmgMul: 1.45, pack: 2, threat: 10, tag: '两只一组的收割蛛' },
  };
  for (const k in T) { if (D.ENEMIES[k]) throw new Error('敌人键名重复：' + k); T[k].at = []; } // at 为空：不按站的类型进刷新表，按威胁进（enemy.js）
  Object.assign(D.ENEMIES, T);
  D.THREAT_FOES = Object.keys(T);
})(D);
