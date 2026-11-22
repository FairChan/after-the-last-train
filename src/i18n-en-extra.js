/* Underdog English dictionary (extra): short labels and cross-file sentences found by the English test. Loaded last, so it wins.
   Single-character keys only ever match a whole text node (never inside a sentence). */
D.I18N.add({
  // key labels in the rebind grid
  "上": "Up",
  "下": "Down",
  "左": "Left",
  "右": "Right",
  "空": "Empty",
  "{0} 空": "{0} empty",
  // People page avatars (first letter of the name)
  "林": "L",
  "阿": "A",
  "陆": "Z",
  // frame roles / line theme short tags
  "通用": "General",
  "工": "Ind",
  "商": "Com",
  "旧": "Old",
  "工业": "Industrial",
  "商业": "Commercial",
  "旧城": "Old Town",
  "正在用": "equipped",
  // item card: where an item is used
  "{0}升 {1} 级": "{0} Lv{1}",
  "做{0}": "craft {0}",
  "{0} 等 {1} 处": "{0} +{1} more",
  "卖 {0}": "Sell {0}",
  "卖": "Sell",
  // ui-card.js rewrites "Z 扔向准星，…" to "扔向准星：，…"
  "扔向准星：，0.6 秒后爆炸：范围 30 伤害。按住 Z 滚滚轮换手雷种类": "Throw at crosshair: blows after 0.6s, 30 area Dmg. Hold Z and scroll to switch grenade type",
  "主武器卡": "Gun card",
  "近战卡": "Melee card",
  "模块卡": "Module card",
  "被动卡": "Passive card",
  // tooltips the scanner first saw with their data-tip="..." wrapper
  "情报：揭开 6 个未知站": "Intel: reveals 6 unknown stations",
  "空：在仓库里点一张这类卡装上": "Empty: click a card of this type in the stash to fit it",
  "被动槽空着（在据点的配装页装）": "Passive slot empty (fit in Loadout at base)",
  // whole elements with an inline name (see elTpl in i18n.js)
  "从 {0} 出发": "Deploy from {0}",
  "站": "Stops",
  "选择出发站": "Pick Entry",
  // entry picker after "deploy straight into the entry station" (main aa70ef8)
  "南栈是据点：选它旁边的一站出发": "Nanzhan is the base: pick a station next to it",
  "还不能出发：南栈旁边的站，或者撤出来过的线路尽头才行": "Can't deploy here: only stations next to Nanzhan, or line ends you have extracted from",
  "确认出发后直接进这一站探索。可以从南栈旁边的站进城；走到线路尽头（地图上的绿色\"撤离\"牌）撤出来一次，那一站也能当出发站。": "Deploying drops you straight into this station. Enter from a station next to Nanzhan; extract once at a line end (green \"Extract\" sign on the map) to unlock it as an entry.",
  "选南栈旁边的一站": "Pick a station next to Nanzhan",
  // auto-pickup-ammo setting (main 57cc04f)
  "这把枪没子弹了：B 键切换弹种；敌人掉的弹药堆走过去按 F 捡（设置里能改成自动捡）；近战不用子弹。": "This gun is empty: B switches ammo type; walk to dropped ammo and press F (Settings can make it automatic); melee needs no ammo.",
  "自动捡弹药": "Auto-pick ammo",
  "走近就把地上的弹药捡进背包；关着时和别的东西一样，按 F 或在拾取框里捡": "Walk over ammo to bag it; when off, pick it up like anything else (F or the pickup box)",
  "维修包、电池走近就捡": "Repair kits and cells picked up on contact",
  "去下一站": "Next stop",
  "已知撤离站": "Known exits",
});
// canvas-only: the green signs on the route map are 33px wide
D.I18N.addCanvas({ "撤离": "EXIT", "隐藏": "?EXIT" });
// canvas-only: floor names in the minimap title (short box)
D.I18N.addCanvas({ "站厅层": "Concourse", "站台层": "Platform", "设备层": "Utility", "换乘层": "Transfer" });
// 试玩反馈第 5 轮：新车站场景、检修管道、楼上的大厦（scenes.js）
D.I18N.add({
    '枢纽大厅': 'Hub Atrium', '车辆段': 'Train Yard', '高架': 'Elevated', '检修管道': 'Service Ducts', '写字楼': 'Office Tower',
    '中庭': 'Atrium', '轨道区': 'Tracks', '列车车厢': 'Train Car', '检修坑': 'Service Pit', '调度塔': 'Control Tower', '管道交汇处': 'Duct Junction', '大堂': 'Lobby', '开放办公区': 'Open Office', '会议室': 'Meeting Room', '高管办公室': 'Executive Office',
    '换乘枢纽': 'Interchange Hub', '一个特别大的中庭，柱子排成方阵，顶上一块天光；房间围一圈': 'A huge atrium with a grid of pillars and a skylight; rooms ring it',
    '站厅是停车场：几条轨道上停着列车，车厢能进去搜；还有检修坑和调度塔': 'The concourse is a yard: parked trains you can search, a service pit and a control tower',
    '高架站': 'Elevated Station', '站在半空：四周是夜空和城市灯光': 'Up in the air: night sky and city lights all around',
    '楼上': 'Upstairs', '站台上方有检修口': 'a hatch above the platform', '大厦': 'Tower', '{0} · 大堂': '{0} · Lobby', '{0} · 办公层': '{0} · Offices',
    '钻进检修管道': 'Climb into the service ducts', '爬出检修口': 'Climb out of the hatch', '上到{0}': 'Up to {0}', '上到办公层': 'Up to the offices', '下到大堂': 'Down to the lobby',
    '上到': 'Up to', '· 大堂': '· Lobby', '· 办公层': '· Offices', '：站台上方有检修口': ': a hatch above the platform',
});
D.I18N.addCanvas({ "车辆段": "Yard", "检修管道": "Ducts" });

// ── 护甲（armor.js，2026-11-15）
D.I18N.add({
    '护甲': 'Armor', '甲': 'AR', '没穿': 'none',
    '铁皮护甲': 'Tin Armor', '钢板护甲': 'Steel Armor', '插板护甲': 'Plate Carrier', '陶瓷护甲': 'Ceramic Armor', '钛板护甲': 'Titanium Armor', '重型护甲': 'Heavy Armor',
    '{0} 级护甲 · 耐久 {1}/{2}': 'Class {0} armor · durability {1}/{2}', '{0} 级护甲 · 碎了': 'Class {0} armor · broken',
    '{0}【{1} 级护甲】耐久 {2}/{3}｜挡子弹、会被打穿、都掉耐久｜单击或拖到护甲槽穿上｜价值 {4}': '{0} [Class {1} armor] durability {2}/{3} | Stops shots, can be penetrated, wears either way | Click or drag to the armor slot to wear | Value {4}',
    '{0}【{1} 级护甲】碎了，回据点修｜挡子弹、会被打穿、都掉耐久｜单击或拖到护甲槽穿上｜价值 {2}': '{0} [Class {1} armor] broken, repair at base | Stops shots, can be penetrated, wears either way | Click or drag to the armor slot to wear | Value {2}',
    '{0}【{1} 级护甲】': '{0} [Class {1} armor]',
    '挡子弹、会被打穿、都掉耐久': 'Stops shots, can be penetrated, wears either way', '单击或拖到护甲槽穿上': 'Click or drag to the armor slot to wear', '碎了，回据点修': 'broken, repair at base',
    '{0} 级': 'Class {0}', '等级': 'Class', '移动': 'Speed', '挡住时': 'When it holds', '机身只吃两成': 'chassis takes 20%', '修满': 'Full repair', '{0} 元': '{0} cr',
    '碎了：穿着也不管用，回据点配装页修。': 'Broken: does nothing while worn. Repair it on the Loadout page at base.',
    '和护盾一样是一条蓝条，但不会自己掉。穿透比等级高的攻击容易打穿；不管打没打穿都掉耐久。': 'A blue bar like the shield, but it does not drain on its own. Attacks with more penetration than its class tend to go through; it loses durability either way.',
    '穿上了{0}（{1} 级 · 耐久 {2}/{3}）': 'Put on {0} (class {1} · durability {2}/{3})', '穿上了{0}': 'Put on {0}', '护甲修好了': 'Armor repaired', '钱不够': 'Not enough money',
    '右键脱下': 'Right-click to take off', '护甲：空。单击仓库里的护甲穿上（对局里捡）': 'Armor: empty. Click armor in the stash to wear it (found in runs)',
    '{0} 级 {1}/{2}': 'C{0} {1}/{2}', '修满耐久：{0} 元': 'Full repair: {0} cr', '修 {0}': 'Fix {0}',
    '空：把护甲拖上来，或者单击背包里的护甲': 'Empty: drag armor here, or click armor in your bag',
    '穿透': 'PIERCED', '护甲碎了': 'ARMOR BROKE',
});
D.I18N.addCanvas({ "穿透": "PIERCED", "护甲碎了": "ARMOR BROKE" });

// ── 丢掉的东西捡不回来（loot.js，2026-11-15）
D.I18N.add({ '丢掉的东西捡不回来': "Discarded items can't be picked back up" });

// ── X 释放电容（ammo.js，2026-11-15）
D.I18N.add({ '释放电容': 'Release charge' });
// 护甲耐久（armor-dur.js）：碎了的护甲格子中间写这个
D.I18N.add({ '碎了': 'Broken' });
// 主菜单底边的行情滚动条（ui-menu.js）
D.I18N.add({ '行情': 'Market', '今日': 'Today' });
// 电梯（lift.js）：走楼梯到过顶层以后通电，之后每层都能坐，上下都行
D.I18N.add({ '电梯没通电：先走楼梯上到顶层（{0}）': 'The elevator has no power. Take the stairs up to the top floor ({0})', '乘电梯（进去选楼层）': 'Take the elevator (pick a floor inside)', '电梯通电了': 'Elevator powered', '到过顶层：每层的电梯都能坐，上下都行': 'You reached the top floor. Every elevator works now, up or down', '坐电梯下来': 'Came down by elevator', '坐电梯上来': 'Came up by elevator', '电梯': 'Elevator', '选楼层': 'Pick a floor', '出去': 'Step out' });
// 首页交易行磁贴（ui-home.js）：不写第 N 天
D.I18N.add({ '今日行情': "Today's market" });
// 屋里的剧情（roomtalk.js）底部提示
D.I18N.add({ '按数字键或点选项 · Esc 跳过': 'Number keys or click an option · Esc Skip', '空格 / F 下一句 · Esc 跳过': 'Space / F Next · Esc Skip' });
