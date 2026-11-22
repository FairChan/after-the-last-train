/* 站内地图第二代 P7 · 小场景第六批：户外通用 10、站台通用 3、场景 / 环境自己的房间 15、少见的功能房 12（plan-p7.md 任务 1）。
   格式见 src/gen2/vignette.js；字母约定同 vignettes-04.js。
   户外（rooms: ['outdoor']）的不放积水、漏水桶、售票机、隔离带、隔离帘这些要屋顶的东西，用锥桶、护柱、消防栓、轮胎、破烂堆。
   场景 / 环境的房间：rooms 直接写它自己的种类（会议室 meeting、开放办公区 openoffice、集装箱 shipbox、冷库大厅 coldhall、溶洞 cavern……），
   这些房间多半摆满了东西，小场景做得小（贴墙一两格、或者只有贴花和地上的东西）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2;
  const BASE = { p: { decal: 'paper' }, x: { decal: 'blood' }, g: { decal: 'glass' }, c: { decal: 'chalk' }, e: { decal: 'shells' }, s: { decal: 'soot' }, w: { decal: 'water' }, r: { decal: 'rubble' }, t: { decal: 'tread' }, y: { decal: 'spray' }, z: { decal: 'tape' }, a: { decal: 'arc' }, l: { loose: 1 }, n: { spawn: 1 } };
  const V = o => G2.vig(Object.assign({ flip: true }, o, { key: Object.assign({}, BASE, o.key) }));
  const PLAT = ['platform'], OUT = ['outdoor'];

  // ── 户外通用
  V({ id: 'out_cone_line', rooms: OUT, at: 'center', map: ['O.O.O', '..r..'], key: { O: { prop: 'cone' } } }); // 一排锥桶
  V({ id: 'out_bollard_boxes', rooms: OUT, at: 'center', map: ['B.r', '.k.', 'r.B'], key: { B: { prop: 'bollard' }, k: { prop: 'cartons' } } }); // 护柱中间扔下的纸箱
  V({ id: 'out_tire_stack', rooms: OUT, at: 'center', map: ['U.U', '.r.'], key: { U: { prop: 'tires' } } });
  V({ id: 'out_luggage_flight', rooms: OUT, at: 'center', map: ['L.p', '.L.', 'p.l'], key: { L: { prop: 'luggage' } } }); // 逃的时候扔下的行李
  V({ id: 'out_hydrant_debris', rooms: OUT, at: 'center', map: ['H.r', '.p.'], key: { H: { prop: 'hydrant' } } });
  V({ id: 'out_junk_heap', rooms: OUT, at: 'center', map: ['J.J', '.l.'], key: { J: { prop: 'junkpile' } } });
  V({ id: 'out_crate_drop', rooms: OUT, at: 'center', map: ['C.k', '.l.', 'p..'], key: { C: { prop: 'crate' }, k: { prop: 'cartons' } } }); // 空投下来的箱子
  V({ id: 'out_vent_rubble', rooms: OUT, at: 'center', map: ['r.r', '.X.'], key: { X: { prop: 'vent' } } });
  V({ id: 'out_barrel_warm', rooms: OUT, at: 'center', map: ['F.p', '.l.'], key: { F: { prop: 'firebarrel' } } }); // 有人围着烤过火的油桶
  V({ id: 'out_bench_tipped', rooms: OUT, at: 'center', map: ['BB.', '.p.'], key: { B: { prop: 'benchfall' } } });

  // ── 站台通用
  V({ id: 'plat_lost_bags', rooms: PLAT, at: 'center', map: ['L.L', '.p.'], key: { L: { prop: 'luggage' } } });
  V({ id: 'plat_stock_boxes', rooms: PLAT, at: 'wall', map: ['###', 'k.k', '.p.'], key: { k: { prop: 'cartons' } } }); // 墙边没运走的货
  V({ id: 'plat_chalk_count', rooms: PLAT, at: 'center', map: ['c.c', '.l.'] }); // 等车的人画的记号

  // ── 场景 / 环境自己的房间
  V({ id: 'tower_meeting_papers', rooms: ['meeting', 'openoffice', 'exec', 'office'], at: 'center', map: ['p.p', '.l.'] }); // 会议桌之间散落的文件
  V({ id: 'tower_open_boxes', rooms: ['openoffice', 'office', 'lobby', 'exec'], at: 'wall', map: ['###', 'k.k'], key: { k: { prop: 'cartons' } } }); // 搬家搬到一半的纸箱
  V({ id: 'tower_exec_plant', rooms: ['exec', 'meeting', 'openoffice', 'lobby'], at: 'wall', map: ['##', 'Pp'], key: { P: { prop: 'planter' } } }); // 没人浇的盆栽
  V({ id: 'ship_goods_side', rooms: ['shipbox', 'cargo', 'quay', 'warehouse', 'coldhall'], at: 'wall', map: ['#k', '#p'], key: { k: { prop: 'cartons' } } }); // 集装箱里靠边的货
  V({ id: 'cold_ice_stock', rooms: ['coldhall', 'freezer', 'storage', 'cargo'], at: 'wall', map: ['#kl', '#p.'], key: { k: { prop: 'cartons' } } });
  V({ id: 'cave_rubble_rest', rooms: ['cavern', 'grotto', 'mine', 'hidden'], at: 'center', map: ['r.r', '.l.', 'r..'] }); // 塌下来的石头
  V({ id: 'cave_dropped_crate', rooms: ['cavern', 'grotto', 'mine'], at: 'center', map: ['C.r', '.l.'], key: { C: { prop: 'crate' } } });
  V({ id: 'sewer_bucket_side', rooms: ['sewermain', 'sump', 'pumproom', 'pump'], at: 'wall', map: ['#u', '#w'], key: { u: { prop: 'bucket' } } });
  V({ id: 'sewer_pipe_debris', rooms: ['sewermain', 'sump', 'pumproom'], at: 'center', map: ['r.w', '.l.'] });
  V({ id: 'parking_oil_cones', rooms: ['parking', 'garage'], at: 'center', map: ['O.t', '.r.', 't.O'], key: { O: { prop: 'cone' } } }); // 地库里的锥桶和车辙
  V({ id: 'diner_trays', rooms: ['diner', 'streetshop', 'canteen', 'giftshop'], at: 'center', map: ['p.g', '.i.'], key: { i: { prop: 'bin' } } });
  // 摆满了东西的小房间（集装箱、工地 / 码头的办公室、冷库、泵房）：只剩贴墙那一两格空地，放只有贴花、地上东西的小场景（权重低，算补空）
  V({ id: 'small_wall_papers', rooms: ['shipbox', 'siteoffice', 'toolshed', 'freezer', 'lotoffice', 'harboroffice', 'parkoffice', 'pumproom', 'sump'], at: 'wall', w: 1, map: ['##', 'pl'] });
  V({ id: 'small_corner_rubble', rooms: ['shipbox', 'siteoffice', 'toolshed', 'freezer', 'warehouse', 'storagecage', 'grotto', 'mine'], at: 'corner', w: 1, map: ['##', '#r'] });
  V({ id: 'traincar_seat_bags', rooms: ['traincar'], at: 'wall', map: ['##', 'Lp'], key: { L: { prop: 'luggage' } } }); // 车厢里座位边上的行李
  V({ id: 'lobby_bags', rooms: ['lobby', 'atrium', 'aquahall', 'aquatunnel', 'tankroom', 'traincar', 'lounge'], at: 'center', map: ['L.p', '.L.'], key: { L: { prop: 'luggage' } } }); // 大堂里扔下的行李

  // ── 少见的功能房
  V({ id: 'jewelry_glass_floor', rooms: ['jewelry', 'gallery', 'shop'], at: 'center', map: ['g.g', '.p.', 'g.l'] }); // 柜台前一地碎玻璃
  V({ id: 'jewelry_boxes', rooms: ['jewelry', 'gallery', 'vault'], at: 'wall', map: ['###', 'k.k', 'g.p'], key: { k: { prop: 'cartons' } } });
  V({ id: 'gallery_crated_art', rooms: ['gallery', 'storage', 'vault'], at: 'wall', map: ['###', 'kpk', '.l.'], key: { k: { prop: 'crate' } } }); // 装了箱没运走的藏品
  V({ id: 'gallery_bench_view', rooms: ['gallery', 'hall', 'lobby'], at: 'center', map: ['BB', 'p.'], key: { B: { prop: 'bench' } } });
  V({ id: 'vault_dropped_bars', rooms: ['vault', 'secure', 'hidden'], at: 'center', map: ['p.l', '.r.'] }); // 撬门的碎块、掉下的东西
  V({ id: 'lab_broken_glass', rooms: ['lab', 'medic', 'server'], at: 'center', map: ['g.p', '.A.', 'p.g'], key: { A: { prop: 'aidkit' } } });
  V({ id: 'archive_paper_drift', rooms: ['archive', 'office', 'control', 'dispatchroom', 'radio'], at: 'wall', map: ['####', 'kpkp', 'pp.l'], key: { k: { prop: 'cartons' } } }); // 档案箱和散了一地的纸
  V({ id: 'canteen_stock', rooms: ['canteen', 'shop', 'storage', 'diner'], at: 'corner', map: ['###', '#kD', '#.p'], key: { k: { prop: 'cartons' }, D: { prop: 'barrel' } } });
  V({ id: 'pump_valve_wet', rooms: ['pump', 'power', 'sewermain', 'washroom'], at: 'wall', map: ['###', 'DwD', 'w.w'], key: { D: { prop: 'barrel' } } });
  V({ id: 'arsenal_ammo_boxes', rooms: ['arsenal', 'security', 'secure', 'storage'], at: 'wall', map: ['###', 'kek', '.e.'], key: { k: { prop: 'cartons' } } }); // 拆开的弹药箱
  V({ id: 'office_paper_storm', rooms: ['office', 'dispatchroom', 'radio', 'archive', 'ticket'], at: 'center', map: ['p.p', '.p.'] });
  V({ id: 'washroom_mop_corner', rooms: ['washroom', 'medic', 'pump'], at: 'corner', map: ['###', '#ui', '#w.'], key: { u: { prop: 'bucket' }, i: { prop: 'bin' } } });
})(D);
