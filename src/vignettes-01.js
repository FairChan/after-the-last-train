/* 站内地图第二代 P3 · 小场景第一批（一）：大厅 14 个（plan-p3.md 任务 2）。格式见 src/gen2/vignette.js：
   '#' 墙、'.' 空地、空格不管、字母查 key；宽 2 格的摆设连写两个字母。新摆设（沙袋、翻倒的长椅、睡袋、篝火桶、路障、隔离带立柱、纸箱、
   漏水桶、售票机、机器残骸、推倒的柜子、被撬开的售货机）画在 arena.js 的 makeProp 里。粉笔画只画符号，不写字。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const V = D.gen2.vig, H = ['hall'];
  // 通用
  V({ id: 'hall_queue_rope', rooms: H, at: 'wall', flip: true, map: ['######', '.t.t.t', '..d...'], key: { t: { prop: 'stanchion' }, d: { decal: 'paper' } } }); // 排队隔离带
  V({ id: 'hall_ticket_glass', rooms: H, at: 'wall', flip: true, map: ['###', 'm.m', 'g.g'], key: { m: { prop: 'tvm' }, g: { decal: 'glass' } } }); // 售票机旁的碎玻璃
  V({ id: 'hall_carton_pile', out: true, rooms: H, at: 'wall', flip: true, map: ['####', 'kkp.', 'k..l'], key: { k: { prop: 'cartons' }, p: { decal: 'paper' }, l: { loose: 1 } } }); // 成堆的纸箱（大厅的四个角多半通着走廊，角落的小场景放不进去，大厅里一律靠墙）
  V({ id: 'hall_chalk_map', out: true, rooms: H, at: 'center', flip: true, map: ['c.c', '.l.', '.c.'], key: { c: { decal: 'chalk' }, l: { loose: 1 } } }); // 粉笔画的地图和箭头
  // 交火
  V({ id: 'hall_fallen_traveler', out: true, rooms: H, at: 'center', flip: true, hist: ['firefight'], map: ['p.x', '.b.', 'x.p'], key: { b: { cont: 'corpse' }, x: { decal: 'blood' }, p: { decal: 'paper' } } }); // 倒地的人和散落的包
  V({ id: 'hall_shells_blood', out: true, rooms: H, at: 'door', flip: true, hist: ['firefight'], map: ['e.e', '.x.', 'e.s'], key: { e: { decal: 'shells' }, x: { decal: 'blood' }, s: { spawn: 1 } } }); // 门口的弹壳和血迹
  // 路障防守
  V({ id: 'hall_sandbag_nest', out: true, rooms: H, at: 'door', flip: true, hist: ['barricade'], map: ['bbb', 'e.s', '.e.'], key: { b: { prop: 'sandbag' }, e: { decal: 'shells' }, s: { spawn: 1 } } }); // 沙袋掩体
  V({ id: 'hall_bench_barricade', out: true, rooms: H, at: 'door', flip: true, hist: ['barricade', 'firefight'], map: ['BB.RR', 'e.r.e'], key: { B: { prop: 'benchfall' }, R: { prop: 'roadblock' }, e: { decal: 'shells' }, r: { decal: 'rubble' } } }); // 翻倒的长椅路障
  // 逃难时有人住过
  V({ id: 'hall_bedroll_bench', rooms: H, at: 'wall', flip: true, hist: ['squat'], map: ['####', 'BB.c', 'p..l'], key: { B: { prop: 'bedroll' }, c: { decal: 'chalk' }, p: { decal: 'paper' }, l: { loose: 1 } } }); // 墙边的睡袋
  V({ id: 'hall_firebarrel_camp', rooms: H, at: 'wall', flip: true, hist: ['squat'], map: ['#####', 'fqBB.', '.c...'], key: { f: { prop: 'firebarrel' }, q: { cont: 'parcel' }, B: { prop: 'bedroll' }, c: { decal: 'chalk' } } }); // 墙边篝火桶
  // 水淹
  V({ id: 'hall_leak_bucket', rooms: H, at: 'wall', flip: true, hist: ['flood'], map: ['###', '.u.', 'w.w'], key: { u: { prop: 'bucket' }, w: { decal: 'water' } } }); // 积水和漏水桶
  // 失火
  V({ id: 'hall_burnt_corner', out: true, rooms: H, at: 'wall', flip: true, hist: ['fire'], map: ['###', 'sos', '.s.'], key: { s: { decal: 'soot' }, o: { cont: 'wreck' } } }); // 烧黑的一段墙根
  // 机器清剿过
  V({ id: 'hall_bot_tracks', out: true, rooms: H, at: 'center', flip: true, hist: ['purge'], map: ['t..', '.wL', '..t'], key: { t: { decal: 'tread' }, w: { prop: 'botwreck' }, L: { light: '#ff3047' } } }); // 机器履带印和残骸
  // 被搜刮过
  V({ id: 'hall_vendor_pried', rooms: H, at: 'wall', flip: true, hist: ['looted'], map: ['###', 'vg.', 'pg.'], key: { v: { prop: 'vendbroke' }, g: { decal: 'glass' }, p: { decal: 'paper' } } }); // 被撬开的售货机
})(D);
