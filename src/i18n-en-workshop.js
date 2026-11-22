/* 英文：工坊（workshop.js / ui-workshop.js）和交易行的"护盾"一栏 */
var D = globalThis.D || (globalThis.D = {});
D.I18N.add({
  '五级': 'Tier 5', '四级弹药': 'Tier 4 Ammo', '五级弹药': 'Tier 5 Ammo', '蓝图 · {0}': 'Blueprint · {0}',
  '带回据点，在工坊学会以后就能做{0}（七种口径都行）': 'Bring it to base and learn it in the Workshop to make {0} (any caliber)',
  '工坊': 'Workshop', '工坊：仓库里有没学的蓝图': 'Workshop: you have an unlearned blueprint', '工坊：学蓝图、做四级五级弹药': 'Workshop: learn blueprints, make tier 4 and 5 ammo',
  '城里搜到的蓝图带回来，在这里学会；学会的东西用零件和材料做。四级、五级弹药只能在这里做。': 'Bring blueprints back from the city and learn them here, then build with parts and materials. Tier 4 and 5 ammo can only be made here.',
  '已学会 {0} / {1}': 'Learned {0} / {1}', '已学会': 'Learned', '蓝图册': 'Blueprints', '全部': 'All', '弹药': 'Ammo', '配件': 'Attachments', '改装件': 'Mods',
  '能学': 'Learnable', '还没有': 'Missing', '绘图台 · {0}': 'Drafting table · {0}', '绘图台': 'Drafting table',
  '仓库里有这张蓝图，还卷着': 'This blueprint is in storage, still rolled up', '还没有这张蓝图': "You don't have this blueprint yet",
  '城里传说级的箱子偶尔有；首领常掉。': 'Sometimes in legendary crates in the city; bosses often drop it.',
  '城里史诗以上的箱子偶尔有；精英偶尔掉，首领常掉。': 'Sometimes in epic or better crates; elites sometimes drop it, bosses often do.',
  '危险的站里，史诗以上的箱子偶尔有。': 'Sometimes in epic or better crates at dangerous stations.',
  '当前枪': 'Current gun', '（当前这把枪用的）': ' (used by your current gun)', '{0} ×{1} 发': '{0} ×{1} rds', '伤害 ×{0} · 一次做一盒': 'Damage ×{0} · one box per run',
  '做好的放进仓库': 'Finished items go to storage', '仓库里 {0}': 'In storage {0}', '仓库里': 'In storage', '材料': 'Materials', '制造': 'Make',
  '零件或材料不够': 'Not enough parts or materials', '仓库放不下': 'Storage is full', '工作台要 {0} 级（设施页升级）': 'Needs workbench lv {0} (upgrade on Facilities)',
  '学会这张蓝图': 'Learn this blueprint', '学会以后蓝图就用掉了': 'The blueprint is used up once learned', '从哪来：{0}': 'Where to find: {0}',
  '仓库里没有这张蓝图': "This blueprint isn't in storage", '学会了：{0}': 'Learned: {0}', '做不了': "Can't make that",
  '做好了：{0}，放进仓库': 'Done: {0}, sent to storage', '做好了：{0} ×{1}，放进仓库': 'Done: {0} ×{1}, sent to storage',
  // 交易行
  '护盾': 'Shields', '药、手雷、情报': 'Meds, grenades, intel', '一到四级护甲、护盾电池、护盾模块、护盾发生器': 'Armor tiers 1-4, shield cells, shield module, shield generator',
  '七种口径、一到三级（四级、五级在工坊用蓝图做）；当前这把枪用的排在最前': 'Seven calibers, tiers 1-3 (make tiers 4 and 5 in the Workshop from blueprints); your current gun\'s caliber comes first',
  '{0} 级护甲 · 耐久 {1}': 'Tier {0} armor · durability {1}',
  '五级、六级护甲交易行不卖，只能在城里捡': "Tier 5 and 6 armor isn't sold; find it in the city",
});
