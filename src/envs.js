/* Underdog：十二种新环境（用户 2026-11-15："增多至少 10 种环境，现在的环境太重复了，很没意思，甚至可以做地上的"）
   每种环境是一种新骨架（D.LAYOUTS），站厅层整个换成这个环境：自己的布局、配色、地面花纹、墙、摆设、房间、灯、敌人。
     地面上（出站就是露天）：街区、街心公园、楼顶、码头、工地、夜市。
     地下：下水道、地下车库、海洋馆、温室、冷库、溶洞（站台层也换成这个环境的墙和地面）。
   跟原来的骨架一样按站号定死；城市生成时保证每种环境至少有两座站。站卡片上写"环境：…"。
   画在 env-art.js；挂钩：D.genConcourseX、D.floorsX、D.stationMod、D.stationExtras、D.makeCity（都在原来的上面包一层）。
   设计：design/features/envs/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16;
  const LV = () => D.LV;
  const HV_FORCE = { bank: 'vault', datacenter: 'server', museum: 'gallery' }, HV = ['vault', 'server', 'jewelry', 'gallery'];

  // ── 主题：配色 + 地面花纹（env-art.js 认 pattern）
  Object.assign(D.THEMES, {
    street:     { name: '街区', floor: ['#2a2c33', '#2d2f37', '#282a31'], grout: '#1b1c22', wall: '#0b0c12', face: ['#262836', '#30323f'], neon: ['#ff3d8b', '#3ee8ff', '#ffd23a'], ambient: '#262c48', lamp: '#ffcf8a', pattern: 'asphalt' },
    park:       { name: '街心公园', floor: ['#24402a', '#27452d', '#223c27'], grout: '#1a2e1e', wall: '#0a120c', face: ['#1c3020', '#243a28'], neon: ['#ffe9a8', '#8dff6a'], ambient: '#22304a', lamp: '#ffe2a8', pattern: 'grass' },
    rooftop:    { name: '楼顶', floor: ['#3a3a40', '#3e3e45', '#36363c'], grout: '#26262c', wall: '#05070f', face: ['#4a4a52', '#55555e'], neon: ['#ff3047', '#3ee8ff'], ambient: '#343c66', lamp: '#cfe0ff', pattern: 'roof' },
    harbor:     { name: '码头', floor: ['#3b3e44', '#3f4248', '#373a40'], grout: '#24262b', wall: '#0a0f1a', face: ['#2e3a48', '#384656'], neon: ['#ffb057', '#3ee8ff', '#ff3047'], ambient: '#222e46', lamp: '#ffc070', pattern: 'quay' },
    site:       { name: '工地', floor: ['#4a3c2c', '#4e402f', '#463829'], grout: '#2e251b', wall: '#0f0c0a', face: ['#2e4a7a', '#dfe4ec'], neon: ['#ffd23a', '#ff7a2e'], ambient: '#2c2634', lamp: '#ffd9a0', pattern: 'dirt' },
    nightmkt:   { name: '夜市', floor: ['#4a2e2a', '#52342e', '#442a28'], grout: '#22181a', wall: '#0c0a10', face: ['#2a1e26', '#36262f'], neon: ['#ff3d3d', '#ffb057', '#ffe14a', '#ff3d8b'], ambient: '#30202c', lamp: '#ffb070', pattern: 'bricks' },
    sewer:      { name: '下水道', floor: ['#2a2f2a', '#2d332d', '#272c27'], grout: '#171b17', wall: '#0a0c0a', face: ['#4a3428', '#553a2c'], neon: ['#8dff6a', '#c8ff5a'], ambient: '#141a14', lamp: '#c8e8a0', pattern: 'sewer' },
    garage:     { name: '地下车库', floor: ['#4a4c52', '#4e5056', '#46484e'], grout: '#35373c', wall: '#0e0f13', face: ['#5a5c62', '#66686e'], neon: ['#ffd23a', '#3ee8ff'], ambient: '#22252e', lamp: '#e8f4ff', pattern: 'parking' },
    aquarium:   { name: '海洋馆', floor: ['#14223a', '#162640', '#121e34'], grout: '#0c1628', wall: '#050a16', face: ['#0e3a5a', '#145070'], neon: ['#3ee8ff', '#7fd8ff', '#ff9be0'], ambient: '#183660', lamp: '#7fe0ff', pattern: 'aqua' },
    greenhouse: { name: '温室', floor: ['#5a3a2a', '#62402e', '#543628'], grout: '#2a1d17', wall: '#08100a', face: ['#1a3326', '#22402f'], neon: ['#ff6ad8', '#8dff6a'], ambient: '#1e2c28', lamp: '#ffb0f0', pattern: 'terra' },
    coldstore:  { name: '冷库', floor: ['#3e4a56', '#42505c', '#3a4652'], grout: '#2a3440', wall: '#0c1018', face: ['#c8d4e0', '#dde6ef'], neon: ['#7fd8ff', '#e8f4ff'], ambient: '#2a3c56', lamp: '#d8f0ff', pattern: 'frost' },
    cave:       { name: '溶洞', floor: ['#2e2a28', '#322d2a', '#2a2624'], grout: '#1c1917', wall: '#0b0909', face: ['#3a332e', '#463d36'], neon: ['#3ee8ff', '#8dff6a', '#b36bff'], ambient: '#17151c', lamp: '#9fe9ff', pattern: 'rock' },
  });

  // ── 房间（outdoor：露天，顶上没有吊灯；thin：decorate 摆的东西留几成；pat：地面花纹）
  const Rm = (name, floor, props, cont, nCont, o) => Object.assign({ name, floor, props, cont, nCont }, o || {});
  Object.assign(D.ROOMS, {
    road:       Rm('马路', 'theme', [['cone', 3], ['barrel', 1], ['bin', 1], ['crate', 1]], [['wreck', 2], ['newsstand', 1], ['wastebin', 2], ['corpse', 1], ['parcel', 1]], [3, 5], { outdoor: true, thin: 0.3 }),
    parkland:   Rm('公园', 'theme', [['bush', 3], ['bin', 1], ['planter', 1]], [['wishpool', 1], ['sandbox', 1], ['wastebin', 2], ['newsstand', 1], ['corpse', 1]], [3, 5], { outdoor: true, thin: 0.3 }),
    roof:       Rm('楼顶', 'theme', [['vent', 3], ['crate', 1], ['barrel', 1]], [['locker', 1], ['crate', 1], ['tankunit', 1], ['corpse', 1], ['supply', 1]], [1, 2], { outdoor: true, thin: 0.5 }),
    helipad:    Rm('停机坪', 'theme', [['cone', 1]], [['supply', 2], ['crate', 1]], [1, 2], { outdoor: true, thin: 0.1, bonus: 1 }),
    quay:       Rm('码头', 'theme', [['crate', 2], ['barrel', 2], ['bollard', 1]], [['netpile', 2], ['ropedrum', 2], ['dockcart', 1], ['fueltank', 1], ['crate', 1]], [3, 5], { outdoor: true, thin: 0.3 }),
    pier:       Rm('栈桥', ['#5a4030', '#664a36'], [['bollard', 2]], [['netpile', 1], ['fishchest', 2], ['liferaft', 1]], [1, 2], { outdoor: true, thin: 0.6, pat: 'quay' }),
    siteyard:   Rm('工地', 'theme', [['cone', 3], ['barrel', 2], ['crate', 1]], [['toolbox', 2], ['tirepile', 1], ['oilbarrel', 1], ['partscart', 1], ['wreck', 1]], [5, 7], { outdoor: true, thin: 0.3 }),
    mktstreet:  Rm('夜市街', 'theme', [['table', 3], ['bin', 1], ['crate', 1]], [['mealcart', 2], ['snackvend', 1], ['drinkvend', 1], ['wastebin', 1], ['register', 1]], [3, 5], { outdoor: true, thin: 0.35 }),
    sewermain:  Rm('主下水道', 'theme', [['barrel', 1], ['crate', 1]], [['scrapheap', 2], ['sacks', 1], ['wastebin', 1], ['corpse', 1]], [2, 4], { thin: 0.3, dim: true }),
    parking:    Rm('停车场', 'theme', [['cone', 2], ['barrel', 1], ['bin', 1]], [['wreck', 3], ['tirepile', 1], ['trash', 1], ['parcel', 1]], [3, 5], { thin: 0.25 }),
    aquahall:   Rm('海洋馆大厅', 'theme', [['planter', 1], ['bench', 1]], [['lostfound', 1], ['snackvend', 1], ['drinkvend', 1], ['locker', 1]], [2, 4], { thin: 0.5, lamp: '#7fe0ff' }),
    aquatunnel: Rm('海底隧道', 'theme', [['bench', 1]], [['lostfound', 1], ['locker', 1]], [1, 2], { thin: 0.3, lamp: '#3ee8ff' }),
    glasshouse: Rm('温室', 'theme', [['bush', 3], ['growlamp', 1]], [['potshelf', 2], ['seedchest', 1], ['irrigtank', 1], ['hydrotray', 1]], [3, 5], { thin: 0.4, lamp: '#ffd0f0' }),
    coldhall:   Rm('冷库通道', 'theme', [['iceblock', 2], ['crate', 1], ['barrel', 1]], [['frozenpallet', 2], ['coldshelf', 1], ['dockcart', 1]], [2, 3], { thin: 0.4 }),
    cavern:     Rm('溶洞', 'theme', [['stalagmite', 3], ['mushroom', 2], ['crystal', 1]], [['oreheap', 1], ['gemgeode', 1], ['sacks', 1], ['corpse', 1]], [2, 4], { thin: 0.6 }),
    // 边上的房间
    streetshop: Rm('临街店铺', ['#2e2a36', '#322d3a'], [['shelf', 2], ['kiosk', 1]], [['register', 2], ['shoecab', 1], ['snackvend', 1], ['crate', 1]], [2, 3]),
    diner:      Rm('小饭馆', ['#3a2c22', '#3e3025'], [['table', 3]], [['pantry', 2], ['stovecab', 1], ['mealcart', 1], ['swillbin', 1]], [2, 3], { lamp: '#ffc070' }),
    parkoffice: Rm('园务室', ['#2c3028', '#30352c'], [['desk', 1], ['cabinet', 1]], [['gardenshed', 2], ['filecab', 1], ['toolbox', 1]], [2, 3]),
    pavilion:   Rm('茶室', ['#3a3024', '#3f3427'], [['table', 2], ['planter', 1]], [['register', 1], ['pantry', 1], ['drinkvend', 1]], [1, 2], { lamp: '#ffd27a' }),
    warehouse:  Rm('货仓', ['#33302a', '#37342d'], [['crate', 4], ['barrel', 2], ['shelf', 1]], [['customspal', 2], ['crate', 2], ['ropedrum', 1], ['pallet', 1]], [3, 4]),
    harboroffice: Rm('港务室', ['#262c38', '#2a303c'], [['desk', 2], ['cabinet', 1]], [['filecab', 1], ['seizedcrate', 1], ['pc', 1], ['safe', 1]], [2, 3], { lamp: '#bfe8ff' }),
    shipbox:    Rm('集装箱', ['#2a2a2e', '#2d2d31'], [['crate', 1]], [['seachest', 2], ['customspal', 1], ['seizedcrate', 1], ['liferaft', 1]], [1, 2], { bonus: 1 }),
    siteoffice: Rm('工棚', ['#2c2e34', '#303238'], [['desk', 1]], [['planchest', 1], ['filecab', 1], ['lockbox', 1], ['footlocker', 1]], [1, 2]),
    toolshed:   Rm('材料库', ['#33302a', '#37342d'], [['crate', 2], ['barrel', 1]], [['toolbox', 2], ['partscart', 1], ['weldrack', 1], ['blastbox', 1]], [2, 3]),
    pumproom:   Rm('泵房', ['#22282a', '#262c2e'], [['machine', 2], ['barrel', 1]], [['toolbox', 1], ['partsbin', 1], ['oilbarrel', 1], ['powerbox', 1]], [2, 3], { dim: true }),
    sump:       Rm('集水井', ['#1e2420', '#222823'], [['barrel', 2], ['crate', 1]], [['scrapheap', 2], ['sacks', 1], ['corpse', 1], ['wastebin', 1]], [2, 3], { dim: true }),
    lotoffice:  Rm('车库管理处', ['#262a34', '#2a2e38'], [['desk', 2], ['cabinet', 1]], [['pc', 1], ['filecab', 1], ['lockbox', 1], ['register', 1]], [2, 3]),
    storagecage: Rm('储物笼', ['#3a3c40', '#3e4044'], [['shelf', 2], ['crate', 2]], [['tirepile', 1], ['batterystack', 1], ['crate', 1], ['parcel', 1], ['suitcase', 1]], [2, 4]),
    tankroom:   Rm('展缸厅', 'theme', [['tankpillar', 2], ['bench', 1]], [['fishchest', 1], ['lostfound', 1], ['locker', 1]], [1, 2], { lamp: '#3ee8ff', thin: 0.6 }),
    giftshop:   Rm('纪念品店', ['#2e2440', '#322845'], [['shelf', 2], ['kiosk', 1]], [['register', 2], ['showcase', 1], ['coindisplay', 1]], [2, 3], { lamp: '#ff9be0' }),
    feedroom:   Rm('饲料间', ['#26302e', '#2a3432'], [['shelf', 1], ['barrel', 2]], [['fishchest', 2], ['coldshelf', 1], ['sacks', 1]], [2, 3]),
    seedroom:   Rm('育苗间', ['#2e3226', '#323629'], [['growlamp', 1], ['bush', 2]], [['seedchest', 2], ['potshelf', 1], ['hydrotray', 1], ['incubator', 1]], [2, 3], { lamp: '#ff9be0' }),
    beeroom:    Rm('蜂房', ['#3a3220', '#3e3622'], [['bush', 2]], [['beehive', 3], ['seedchest', 1]], [2, 3], { lamp: '#ffd27a' }),
    freezer:    Rm('冻库', ['#4a5866', '#4e5c6a'], [['iceblock', 2], ['hanging', 2]], [['coldshelf', 2], ['frozenpallet', 1], ['meatlocker', 1], ['fishchest', 1]], [2, 4], { lamp: '#d8f0ff', thin: 0.7 }),
    compressor: Rm('压缩机房', ['#2a3038', '#2e343c'], [['machine', 3]], [['toolbox', 1], ['powerbox', 1], ['transformer', 1]], [1, 2], { dim: true }),
    mine:       Rm('旧矿道', ['#2e2620', '#322a23'], [['barrel', 1], ['crate', 1]], [['orecart', 2], ['blastbox', 1], ['lamprack', 1], ['oreheap', 1]], [2, 3], { pat: 'rock' }),
    grotto:     Rm('晶洞', 'theme', [['crystal', 3]], [['gemgeode', 2], ['relicbox', 1]], [1, 2], { bonus: 1, lamp: '#c890ff', thin: 0.8 }),
    camp:       Rm('流民营地', ['#2e2822', '#322b24'], [['crate', 1], ['barrel', 1]], [['sacks', 1], ['rationcrate', 1], ['footlocker', 1], ['corpse', 1]], [2, 3], { lamp: '#ffb070', pat: 'rock' }),
  });

  // ── 十二种环境
  const ENVS = D.ENVS = {
    street:     { name: '街区', above: true, theme: 'street', main: 'road', desc: '出站就是夜里的一条马路：路边停着车，两边是店面和小饭馆', rooms: [['streetshop', 3], ['diner', 2]], foes: [['raider', 2], ['dog', 2], ['drone', 1]], gen: genStreet },
    park:       { name: '街心公园', above: true, theme: 'park', main: 'parkland', desc: '一片草地和石板路，中间一座喷泉，角上一个池塘；树后面藏着人', rooms: [['parkoffice', 2], ['pavilion', 2]], foes: [['dog', 2], ['crawler', 2], ['bomber', 1]], gen: genPark },
    rooftop:    { name: '楼顶', above: true, theme: 'rooftop', main: 'roof', desc: '几栋楼的楼顶，用木板桥连着；脚下是很远的街灯', rooms: [['storage', 1], ['power', 1]], foes: [['sniper', 2], ['drone', 3]], noShaft: true, gen: genRooftop },
    harbor:     { name: '码头', above: true, theme: 'harbor', main: 'quay', desc: '集装箱码成墙，下面是海；有几只能钻进去的箱子和伸进海里的栈桥', rooms: [['warehouse', 3], ['harboroffice', 2]], foes: [['raider', 3], ['drone', 1], ['dog', 1]], gen: genHarbor },
    site:       { name: '工地', above: true, theme: 'site', main: 'siteyard', desc: '没盖完的楼：水泥柱子、脚手架、大坑和几间板房', rooms: [['siteoffice', 2], ['toolshed', 2]], foes: [['welder', 2], ['raider', 1], ['drone', 1]], gen: genSite },
    nightmkt:   { name: '夜市', above: true, theme: 'nightmkt', main: 'mktstreet', desc: '一条挂满灯笼的老街，两排摊子，后面是饭馆和小店', rooms: [['diner', 3], ['streetshop', 2]], foes: [['raider', 2], ['mannequin', 1], ['crawler', 2]], gen: genNightMarket },
    sewer:      { name: '下水道', theme: 'sewer', main: 'sewermain', desc: '主管道中间一条浅水沟（走进去会慢），两边是泵房和集水井', rooms: [['pumproom', 3], ['sump', 3]], foes: [['crawler', 3], ['mite', 2], ['bomber', 1]], dark: true, gen: genSewer },
    garage:     { name: '地下车库', theme: 'garage', main: 'parking', desc: '一大片停车位和编号柱子，车停得七零八落', rooms: [['lotoffice', 2], ['storagecage', 3]], foes: [['raider', 2], ['crawler', 2], ['bomber', 1]], gen: genGarage },
    aquarium:   { name: '海洋馆', theme: 'aquarium', main: 'aquahall', desc: '一条海底隧道穿过大厅，墙全是发光的鱼缸', rooms: [['tankroom', 2], ['giftshop', 2], ['feedroom', 2]], foes: [['drone', 2], ['medic', 1], ['crawler', 2]], gen: genAquarium },
    greenhouse: { name: '温室', theme: 'greenhouse', main: 'glasshouse', desc: '玻璃顶下面一排排种植床和棕榈，补光灯是粉色的', rooms: [['seedroom', 3], ['beeroom', 1]], foes: [['crawler', 2], ['bomber', 2], ['medic', 1]], gen: genGreenhouse },
    coldstore:  { name: '冷库', theme: 'coldstore', main: 'coldhall', desc: '一条冷气通道连着一间间冻库，货架上结着霜', rooms: [['freezer', 5], ['compressor', 1]], foes: [['turret', 1], ['drone', 2], ['crawler', 1]], gen: genColdstore },
    cave:       { name: '溶洞', theme: 'cave', main: 'cavern', desc: '天然的溶洞连着弯弯曲曲的洞道：钟乳石、发光的蘑菇和晶石，还有一片地下湖', rooms: [['cavern', 2], ['mine', 2], ['grotto', 1], ['camp', 1]], foes: [['crawler', 3], ['stalker', 1], ['mite', 2]], dark: true, noShaft: true, gen: genCave },
  };
  for (const k in ENVS) { D.LAYOUTS[k] = { name: ENVS[k].name, desc: ENVS[k].desc, env: true, above: !!ENVS[k].above }; D.LAYOUT_W.push([k, 1.3]); if (D.SCENE_LAYOUTS) D.SCENE_LAYOUTS.push(k); }

  // ── 工具
  // 配色只往线路主题靠两成（原来是五成五），环境自己的颜色更明显
  function lightTint(th, lineKey) {
    const Lt = D.LINE_THEMES[lineKey]; if (!Lt) return Object.assign({}, th);
    const t = Lt.tint, k = 0.2, mixArr = (a, b) => a.map((c, i) => D.mixHex(c, b[i % b.length], k));
    return Object.assign({}, th, { floor: mixArr(th.floor, t.floor), grout: D.mixHex(th.grout, t.grout, k), face: mixArr(th.face, t.face), neon: th.neon.concat(t.neon.slice(0, 1)), ambient: D.mixHex(th.ambient, t.ambient, k), lamp: D.mixHex(th.lamp, t.lamp, k), line: lineKey });
  }
  function envFloor(key, w, h) {
    const E = ENVS[key], L = LV(), F = L.newFloor(w, h, E.above ? '地面 · {0}'.replace('{0}', E.name) : E.name, E.theme);
    F.th = lightTint(D.THEMES[E.theme], L.line()); F.ambient = F.th.ambient;
    F.env = key; F.outdoor = !!E.above; F.surf = new Uint8Array(w * h); F._keep = new Uint8Array(w * h);
    if (E.dark) F.dark = true; if (E.foes) F.foes = E.foes;
    return F;
  }
  // 房间池：环境自己的房间（权重翻倍）+ 这种站本来的房间
  const poolOf = (st, E) => E.rooms.map(([k, w]) => [k, w * 2]).concat(LV().pool(st));
  const reserve = (F, x, y, w, h) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < F.tw && yy < F.tht) F._keep[yy * F.tw + xx] = 1; };
  const floorAt = (F, x, y) => x >= 0 && y >= 0 && x < F.tw && y < F.tht && F.solid[y * F.tw + x] === 0 && F.kind[y * F.tw + x] === 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 摆一个占 tw×th 格的摆设：格子都得是空地面；默认四周留一圈空（不会把路堵死）
  function put(F, k, tx, ty, tw, th, rng, o) {
    o = o || {};
    if (tx < 1 || ty < 2 || tx + tw > F.tw - 1 || ty + th > F.tht - 1) return false;
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) { const i = y * F.tw + x; if (F.solid[i] || F.kind[i] || F._keep[i] || (o.dry && F.surf[i])) return false; }
    if (o.ring !== false) for (let y = ty - 1; y <= ty + th; y++) for (let x = tx - 1; x <= tx + tw; x++) { if (y >= ty && y < ty + th && x >= tx && x < tx + tw) continue; if (!floorAt(F, x, y)) return false; }
    if (F.stairs.some(s => Math.abs(s.x / TS - (tx + tw / 2)) < 2 + tw / 2 && Math.abs(s.y / TS + 0.5 - (ty + th / 2)) < 2 + th / 2)) return false;
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) F.solid[y * F.tw + x] = 1;
    const p = D.ENV_PROP(k, tx, ty, F.th, rng, tw, th, o); p.mine = true; F.props.push(p);
    return true;
  }
  // 门口（走廊接进来的地方）往里三格不摆东西
  function keepDoors(F, r) {
    for (let x = r.x; x < r.x + r.w; x++) { if (floorAt(F, x, r.y - 1)) reserve(F, x - 1, r.y, 3, 3); if (floorAt(F, x, r.y + r.h)) reserve(F, x - 1, r.y + r.h - 3, 3, 3); }
    for (let y = r.y; y < r.y + r.h; y++) { if (floorAt(F, r.x - 1, y)) reserve(F, r.x, y - 1, 3, 3); if (floorAt(F, r.x + r.w, y)) reserve(F, r.x + r.w - 3, y - 1, 3, 3); }
  }
  function stairsDown(F, x, y) { F.stairs.push({ x: x * TS + 8, y: y * TS, dir: 'down', label: '下到站台层', to: 1 }); reserve(F, x - 2, y - 1, 5, 4); }
  const relayAt = (F, opt, st, x, y) => { if (st.type === 'relay') opt.relay = { f: 0, x: x * TS, y: y * TS }; };
  // 沿着主区域摆一圈房间：高价值区域、门禁房、隐藏房间的规矩和原来的站厅一样
  function fillSlots(F, rng, st, opt, slots, hubs, pool, n) {
    const L = LV(), t = st.tier || 0, out = [];
    let hv = HV_FORCE[st.type] || (t >= 1 && rng.chance(0.18 + t * 0.12) ? rng.pick(HV) : null);
    const lockLv = !opt.tut && rng.chance(0.25 + t * 0.12) ? (t >= 2 ? rng.pick([2, 3]) : t === 1 ? rng.pick([1, 2]) : 1) : 0;
    let hid = false, locked = !lockLv;
    rng.shuffle(slots);
    for (let i = 0; i < Math.min(n, slots.length); i++) {
      const [sx, sy, sw, sh] = slots[i], w = Math.max(5, sw - rng.int(0, 2)), h = Math.max(4, sh - rng.int(0, 1)), x = sx + rng.int(0, sw - w), y = sy + rng.int(0, sh - h);
      const hidden = !hid && i >= 2 && rng.chance(0.5);
      let kind = hidden ? 'hidden' : rng.weighted(pool);
      if (!hidden && hv && w * h >= 28) { kind = hv; hv = null; }
      const lock = !hidden && !locked && !D.ROOMS[kind].hv && i >= 1 ? lockLv : 0;
      if (lock) { kind = 'secure'; locked = true; }
      const r = L.addRoom(F, x, y, w, h, kind, { hidden, hv: !!D.ROOMS[kind].hv, lock });
      if (hidden) hid = true;
      const dist = q => Math.hypot(q.x + q.w / 2 - x - w / 2, q.y + q.h / 2 - y - h / 2), near = hubs.reduce((a, b) => dist(b) < dist(a) ? b : a, hubs[0]);
      L.corridor(F, r, near, rng, hidden || !!lock);
      if (lock) F.breakables[F.breakables.length - 1].lock = lock;
      out.push(r);
    }
    return out;
  }
  // 盒子房间（集装箱、板房）：外面一圈是墙，门开在下沿正中；lock 时门是一道门禁
  function boxFits(F, x, y, w, h) {
    for (let yy = y - 1; yy <= y + h + 1; yy++) for (let xx = x - 1; xx <= x + w; xx++) { if (xx < 1 || yy < 2 || xx >= F.tw - 1 || yy >= F.tht - 1) return false; const i = yy * F.tw + xx; if (F.solid[i] || F.kind[i] || F._keep[i]) return false; }
    return true;
  }
  function box(F, x, y, w, h, kind, o) {
    const r = { x: x + 1, y: y + 1, w: w - 2, h: h - 2, kind, name: D.ROOMS[kind].name, i: F.rooms.length, seen: false, hv: !!D.ROOMS[kind].hv };
    F.rooms.push(r);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = yy * F.tw + xx, edge = yy === y || yy === y + h - 1 || xx === x || xx === x + w - 1; F.solid[i] = edge ? 1 : 0; F.kind[i] = edge ? 1 : 0; F.room[i] = edge ? -1 : r.i; F.surf[i] = 0; }
    const dx = x + Math.floor(w / 2) - 1;
    for (const xx of [dx, dx + 1]) { const i = (y + h - 1) * F.tw + xx; if (o.lock) { F.solid[i] = 1; F.kind[i] = 3; } else { F.solid[i] = 0; F.kind[i] = 0; F.room[i] = r.i; } }
    if (o.lock) { r.lock = o.lock; F.breakables.push({ tx: dx, ty: y + h - 1, hp: 40, room: r.i, open: false, x: dx * TS + 8, y: (y + h - 1) * TS + 8, lock: o.lock }); }
    (F.boxes = F.boxes || []).push({ x, y, w, h, door: dx, style: o.style, col: o.col });
    reserve(F, x - 1, y - 1, w + 2, h + 3);
    return r;
  }
  const scatter = (F, rng, k, n, x0, y0, x1, y1, tw, th, o) => { let m = 0; for (let t = 0; m < n && t < n * 30; t++) if (put(F, k, rng.int(x0, x1), rng.int(y0, y1), tw || 1, th || 1, rng, o)) m++; return m; };

  // ── 街区：中间一条马路（人行道 + 四条车道 + 斑马线），上下两排临街店面
  function genStreet(rng, st, opt) {
    const F = envFloor('street', 60, 34), road = LV().addRoom(F, 1, 12, 58, 10, 'road');
    F.road = { y0: 12, y1: 21, walk: 2 };
    for (let y = 12; y <= 21; y++) for (let x = 1; x <= 58; x++) if (y < 14 || y > 19) F.surf[y * F.tw + x] = 1;
    F.zebra = [rng.int(8, 18), rng.int(40, 50)];
    fillSlots(F, rng, st, opt, [[2, 2, 12, 8], [16, 2, 12, 8], [30, 2, 12, 8], [44, 2, 14, 8], [2, 24, 12, 8], [16, 24, 12, 8], [30, 24, 12, 8], [44, 24, 14, 8]], [road], poolOf(st, ENVS.street), rng.int(6, 8));
    keepDoors(F, road);
    const sx = rng.int(24, 34); stairsDown(F, sx, 12); relayAt(F, opt, st, sx + 6, 13);
    for (const z of F.zebra) reserve(F, z, 14, 3, 6);
    for (const ly of [14, 18]) for (let x = 2; x < 56;) { if (rng.chance(0.55) && put(F, 'car', x, ly, 3, 2, rng)) x += 4 + rng.int(0, 3); else x += rng.int(2, 4); }
    if (rng.chance(0.6)) scatter(F, rng, 'car', 1, 6, 16, 50, 16, 3, 2); // 横在路中间的一辆
    for (let x = 4; x < 58; x += 9) put(F, 'streetlamp', x, 12, 1, 1, rng, { ring: false });
    for (let x = 8; x < 58; x += 9) put(F, 'streetlamp', x, 21, 1, 1, rng, { ring: false });
    scatter(F, rng, 'hydrant', 3, 2, 13, 57, 13, 1, 1, { ring: false }); scatter(F, rng, 'dumpster', 2, 2, 20, 56, 20, 2, 1, { ring: false });
    scatter(F, rng, 'barrier', 2, 4, 15, 54, 18, 2, 1); scatter(F, rng, 'cone', 5, 3, 14, 56, 19, 1, 1);
    return F;
  }
  // ── 街心公园：十字石板路 + 绕喷泉一圈，角上一个池塘，草地上是树
  function genPark(rng, st, opt) {
    const F = envFloor('park', 58, 34), park = LV().addRoom(F, 8, 4, 42, 23, 'parkland'), cx = 29, cy = 15;
    const S = (x, y, v) => { if (x >= 8 && x <= 49 && y >= 4 && y <= 26) F.surf[y * F.tw + x] = v; };
    for (let x = 8; x <= 49; x++) for (const y of [cy - 1, cy, cy + 1]) S(x, y, 1);
    for (let y = 4; y <= 26; y++) for (const x of [cx - 1, cx, cx + 1]) S(x, y, 1);
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 8; x <= cx + 8; x++) { const d = Math.hypot((x - cx) / 1.25, y - cy); if (d >= 4 && d <= 5.4) S(x, y, 1); }
    const q = rng.pick([[-1, -1], [1, -1], [-1, 1], [1, 1]]), px0 = cx + q[0] * 13, py0 = cy + q[1] * 6;
    F.envWater = new Uint8Array(F.tw * F.tht);
    for (let y = py0 - 4; y <= py0 + 4; y++) for (let x = px0 - 7; x <= px0 + 7; x++) if (((x - px0) / 6.2) ** 2 + ((y - py0) / 3.4) ** 2 < 1 && x > 8 && x < 49 && y > 4 && y < 26 && F.surf[y * F.tw + x] !== 1) { F.surf[y * F.tw + x] = 3; F.envWater[y * F.tw + x] = 1; }
    fillSlots(F, rng, st, opt, [[1, 3, 6, 7], [1, 12, 6, 7], [1, 21, 6, 7], [51, 3, 6, 7], [51, 12, 6, 7], [51, 21, 6, 7], [10, 29, 11, 4], [24, 29, 11, 4], [38, 29, 11, 4]], [park], poolOf(st, ENVS.park), rng.int(6, 8));
    keepDoors(F, park);
    stairsDown(F, cx, cy + 8); relayAt(F, opt, st, cx + 4, cy + 3);
    put(F, 'fountain', cx - 1, cy - 1, 3, 3, rng);
    for (let x = 10; x <= 48; x += 6) if (Math.abs(x - cx) > 6) put(F, 'parklamp', x, cy - 2, 1, 1, rng, { ring: false });
    for (let y = 6; y <= 25; y += 6) if (Math.abs(y - cy) > 4) put(F, 'parklamp', cx + 2, y, 1, 1, rng, { ring: false });
    for (let x = 12; x <= 46; x += 9) if (Math.abs(x - cx) > 7) put(F, 'bench', x, cy + 2, 2, 1, rng, { ring: false });
    scatter(F, rng, 'tree', 16, 9, 5, 48, 25, 1, 1, { dry: true }); scatter(F, rng, 'bush', 12, 9, 5, 48, 25, 1, 1, { dry: true });
    return F;
  }
  // ── 楼顶：六栋楼的楼顶（两排三列），木板桥连着；最大的一块是停机坪
  function genRooftop(rng, st, opt) {
    const F = envFloor('rooftop', 60, 34), L = LV(), isl = [];
    [[3, 14], [19, 31]].forEach(([y0, y1], ri) => [[2, 17], [21, 37], [41, 57]].forEach(([x0, x1], ci) => {
      const w = rng.int(Math.max(9, x1 - x0 - 5), x1 - x0), h = rng.int(Math.max(7, y1 - y0 - 4), y1 - y0);
      isl.push({ x: x0 + rng.int(0, x1 - x0 - w), y: y0 + rng.int(0, y1 - y0 - h), w, h, ri, ci });
    }));
    const t = st.tier || 0; let hv = HV_FORCE[st.type] || (t >= 1 && rng.chance(0.2 + t * 0.12) ? rng.pick(HV) : null);
    const order = [4, 0, 1, 2, 3, 5], others = rng.shuffle([0, 1, 2, 3, 5]), heli = others.reduce((a, b) => isl[b].w * isl[b].h > isl[a].w * isl[a].h ? b : a, others[0]);
    const pool = poolOf(st, ENVS.rooftop), roofs = new Set([4, heli, others.find(i => i !== heli)]);
    for (const i of order) {
      const s = isl[i]; let kind = i === heli ? 'helipad' : roofs.has(i) ? 'roof' : rng.weighted(pool);
      if (!roofs.has(i) && hv) { kind = hv; hv = null; }
      s.r = L.addRoom(F, s.x, s.y, s.w, s.h, kind, { hv: !!D.ROOMS[kind].hv });
    }
    // 木板桥：同一排相邻的都连，上下两排随便连一到两座
    const bridgeH = (a, b) => { const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h) - 2, y = rng.int(y0, Math.max(y0, y1)), x0 = a.x + a.w; L.carve(F, x0, y, b.x - x0, 2); for (let x = x0; x < b.x; x++) for (const yy of [y, y + 1]) F.surf[yy * F.tw + x] = 2; };
    const bridgeV = (a, b) => { const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w) - 2, x = rng.int(x0, Math.max(x0, x1)), y0 = a.y + a.h; L.carve(F, x, y0, 2, b.y - y0); for (let y = y0; y < b.y; y++) for (const xx of [x, x + 1]) F.surf[y * F.tw + xx] = 5; };
    for (const r of [0, 3]) { bridgeH(isl[r], isl[r + 1]); bridgeH(isl[r + 1], isl[r + 2]); }
    const vs = rng.shuffle([0, 1, 2]); bridgeV(isl[vs[0]], isl[vs[0] + 3]); if (rng.chance(0.6)) bridgeV(isl[vs[1]], isl[vs[1] + 3]);
    for (const s of isl) keepDoors(F, s.r);
    const m = isl[4]; stairsDown(F, m.x + Math.floor(m.w / 2), m.y + m.h - 2); relayAt(F, opt, st, m.x + 3, m.y + 2);
    const H = isl[heli]; F.heli = { cx: (H.x + H.w / 2) * TS, cy: (H.y + H.h / 2) * TS, r: Math.max(2, Math.min(H.w, H.h) / 2 - 1.5) }; reserve(F, H.x + 1, H.y + 1, H.w - 2, H.h - 2);
    for (const s of isl) {
      const r = s.r; put(F, 'floodlamp', r.x + 1, r.y + 1, 1, 1, rng, { ring: false }); put(F, 'floodlamp', r.x + r.w - 2, r.y + r.h - 2, 1, 1, rng, { ring: false });
      if (r.kind !== 'roof') continue;
      scatter(F, rng, 'acunit', rng.int(1, 3), r.x + 1, r.y + 1, r.x + r.w - 3, r.y + r.h - 2, 2, 1);
      if (rng.chance(0.55)) scatter(F, rng, 'watertank', 1, r.x + 1, r.y + 1, r.x + r.w - 3, r.y + r.h - 3, 2, 2);
      if (rng.chance(0.45)) scatter(F, rng, 'antenna', 1, r.x + 1, r.y + 1, r.x + r.w - 2, r.y + r.h - 2);
      scatter(F, rng, 'vent', rng.int(1, 3), r.x + 1, r.y + 1, r.x + r.w - 2, r.y + r.h - 2);
    }
    return F;
  }
  // ── 码头：上面一排货仓，中间码头堆着集装箱（两只能进去），下面是海和栈桥
  function genHarbor(rng, st, opt) {
    const F = envFloor('harbor', 60, 34), L = LV(), quay = L.addRoom(F, 2, 11, 56, 12, 'quay');
    F.seaY = 23; F.rails = [21]; F.moonX = rng.int(10, 48);
    for (const x of rng.shuffle([5, 16, 28, 40, 51]).slice(0, 3)) { const len = rng.int(5, 9); L.addRoom(F, x, 23, 4, len, 'pier'); reserve(F, x - 1, 20, 6, 3); F.lights.push({ x: (x + 2) * TS, y: (22 + len) * TS, r: 54, col: x % 2 ? '#3dd66a' : '#ff3047', a: 0.6, flick: 0.12, seed: x }); }
    fillSlots(F, rng, st, opt, [[2, 2, 13, 7], [17, 2, 12, 7], [31, 2, 12, 7], [45, 2, 13, 7]], [quay], poolOf(st, ENVS.harbor), rng.int(3, 4));
    keepDoors(F, quay);
    const sx = rng.int(26, 34); stairsDown(F, sx, 11); relayAt(F, opt, st, sx + 5, 12);
    const CCOL = [D.RAMP.red, D.RAMP.blue, D.RAMP.copper, D.RAMP.olive];
    for (let n = 0, tr = 0; n < 2 && tr < 60; tr++) { const x = rng.int(3, 51), y = rng.int(13, 15); if (boxFits(F, x, y, 7, 5)) { box(F, x, y, 7, 5, 'shipbox', { style: 'container', col: rng.pick(CCOL), lock: n === 1 && (st.tier || 0) >= 1 && rng.chance(0.5) ? 1 : 0 }); n++; } }
    for (const y of [13, 17]) for (let x = 3; x < 54;) { if (rng.chance(0.6) && put(F, rng.chance(0.35) ? 'container2' : 'container', x, y, 4, 2, rng)) x += 5 + rng.int(1, 3); else x += rng.int(2, 3); }
    scatter(F, rng, 'crane', 2, 4, 19, 54, 21, 1, 1, { ring: false });
    for (let x = 4; x < 57; x += rng.int(4, 6)) put(F, 'bollard', x, 22, 1, 1, rng, { ring: false });
    for (let x = 6; x < 56; x += 10) put(F, 'floodlamp', x, 12, 1, 1, rng, { ring: false });
    return F;
  }
  // ── 工地：一大片土地，中间是浇好的地基和水泥柱子，四周几间板房，一个大坑
  function genSite(rng, st, opt) {
    const F = envFloor('site', 58, 34), yard = LV().addRoom(F, 2, 3, 54, 28, 'siteyard');
    stairsDown(F, 6, 27); relayAt(F, opt, st, 10, 27);
    const fx = rng.int(18, 22), fy = rng.int(7, 9), fw = 18, fh = 10;
    for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) F.surf[y * F.tw + x] = 1;
    F.ruts = [rng.int(4, 6), rng.int(20, 22), rng.int(27, 29)];
    // 板房
    const t = st.tier || 0, pool = poolOf(st, ENVS.site), kinds = ['siteoffice', 'toolshed', rng.weighted(pool), rng.weighted(pool), rng.weighted(pool)];
    const hv = HV_FORCE[st.type] || (t >= 1 && rng.chance(0.2 + t * 0.12) ? rng.pick(HV) : null); if (hv) kinds[2] = hv;
    const lockLv = rng.chance(0.25 + t * 0.12) ? (t >= 2 ? 2 : 1) : 0, nB = rng.int(5, 6); let n = 0; kinds.push(rng.weighted(pool));
    for (const [x, y] of rng.shuffle([[4, 5], [4, 13], [45, 5], [45, 13], [45, 21], [28, 21], [37, 21], [13, 20], [32, 3], [12, 3]])) {
      if (n >= nB) break; if (!boxFits(F, x, y, 8, 6)) continue;
      box(F, x, y, 8, 6, kinds[n], { style: 'cabin', lock: n === 3 ? lockLv : 0 }); n++;
    }
    // 大坑（不能走）
    F.pits = new Uint8Array(F.tw * F.tht);
    for (let tr = 0; tr < 60; tr++) {
      const w = rng.int(6, 8), h = rng.int(3, 4), x = rng.int(4, 50 - w), y = rng.int(18, 28 - h); let ok = true;
      for (let yy = y - 1; yy <= y + h && ok; yy++) for (let xx = x - 1; xx <= x + w && ok; xx++) { const i = yy * F.tw + xx; if (!floorAt(F, xx, yy) || F._keep[i] || F.surf[i]) ok = false; }
      if (!ok) continue;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = yy * F.tw + xx; F.solid[i] = 1; F.kind[i] = 1; F.pits[i] = 1; }
      F.pitLadder = x + 1; reserve(F, x - 1, y - 1, w + 2, h + 2); break;
    }
    for (let y = fy + 1; y < fy + fh - 1; y += 4) for (let x = fx + 1; x < fx + fw - 1; x += 4) put(F, 'column', x, y, 1, 1, rng);
    for (let x = fx; x < fx + fw - 2; x += 5) put(F, 'scaffold', x, fy - 2, 2, 1, rng);
    scatter(F, rng, 'rebar', 3, 4, 4, 52, 28, 2, 1); scatter(F, rng, 'mixer', rng.int(1, 2), 4, 4, 52, 28, 2, 1); scatter(F, rng, 'toilet', 2, 4, 4, 54, 28);
    scatter(F, rng, 'barrier', 3, 4, 4, 52, 28, 2, 1); scatter(F, rng, 'cone', 6, 3, 4, 54, 29); scatter(F, rng, 'crane', 1, 6, 6, 50, 26, 1, 1);
    for (const [x, y] of [[3, 4], [54, 4], [3, 29], [54, 29], [28, 4]]) put(F, 'floodlamp', x, y, 1, 1, rng, { ring: false });
    return F;
  }
  // ── 夜市：一条老街，两排摊子夹着中间的走道，后面是饭馆和小店
  function genNightMarket(rng, st, opt) {
    const F = envFloor('nightmkt', 60, 34), street = LV().addRoom(F, 1, 11, 58, 12, 'mktstreet');
    fillSlots(F, rng, st, opt, [[2, 2, 12, 8], [16, 2, 12, 8], [30, 2, 12, 8], [44, 2, 14, 8], [2, 25, 12, 7], [16, 25, 12, 7], [30, 25, 12, 7], [44, 25, 14, 7]], [street], poolOf(st, ENVS.nightmkt), rng.int(6, 8));
    keepDoors(F, street);
    const sx = rng.int(24, 34); stairsDown(F, sx, 21); relayAt(F, opt, st, sx + 5, 21);
    for (const y of [13, 20]) for (let x = 3; x < 56;) { if (put(F, 'stall', x, y, 2, 1, rng)) x += 3 + rng.int(0, 1); else x += 1; }
    scatter(F, rng, 'table', 8, 3, 15, 56, 18);
    for (let x = 5; x < 57; x += 7) { put(F, 'lanternpost', x, 12, 1, 1, rng, { ring: false }); put(F, 'lanternpost', x + 3, 22, 1, 1, rng, { ring: false }); }
    const LC = ['#ff6a4a', '#ffd27a', '#ff3d8b', '#ffb057'];
    for (const y of [15, 18]) for (let x = 2 + (y % 2) * 2; x < 58; x += 5) F.lights.push({ x: x * TS + 8, y: y * TS, r: 36, col: LC[(x + y) % LC.length], a: 0.5, flick: 0.15, seed: x * 7 + y });
    return F;
  }
  // ── 下水道：一条主管道，中间三格宽的浅水沟（两座木板桥），上下是泵房和集水井
  function genSewer(rng, st, opt) {
    const F = envFloor('sewer', 56, 34), main = LV().addRoom(F, 2, 14, 52, 7, 'sewermain');
    F.envWater = new Uint8Array(F.tw * F.tht);
    for (let x = 2; x <= 53; x++) for (const y of [16, 17, 18]) { F.surf[y * F.tw + x] = 1; F.envWater[y * F.tw + x] = 1; }
    for (const bx of [rng.int(10, 18), rng.int(36, 44)]) for (const y of [16, 17, 18]) for (const x of [bx, bx + 1]) { F.surf[y * F.tw + x] = 2; F.envWater[y * F.tw + x] = 0; }
    for (let x = 5; x < 53; x += 7) for (const y of [14, 20]) if (!F.surf[y * F.tw + x]) F.surf[y * F.tw + x] = 4;
    fillSlots(F, rng, st, opt, [[2, 2, 11, 9], [16, 2, 11, 9], [30, 2, 11, 9], [43, 2, 11, 9], [2, 24, 11, 8], [16, 24, 11, 8], [30, 24, 11, 8], [43, 24, 11, 8]], [main], poolOf(st, ENVS.sewer), rng.int(6, 8));
    keepDoors(F, main);
    stairsDown(F, 6, 14); relayAt(F, opt, st, 10, 15);
    for (let x = 8; x < 52; x += 9) F.lights.push({ x: x * TS, y: 14 * TS - 4, oy: 36, r: 90, col: '#c8e8a0', a: 0.6, flick: 0.3, seed: x, shaft: true });
    return F;
  }
  // ── 地下车库：一大片停车位（三排）、编号柱子、坡道
  function genGarage(rng, st, opt) {
    const F = envFloor('garage', 58, 34), hall = LV().addRoom(F, 9, 4, 40, 24, 'parking');
    F.level = rng.pick(['B1', 'B2', 'B3']);
    fillSlots(F, rng, st, opt, [[1, 3, 6, 7], [1, 12, 6, 7], [1, 21, 6, 8], [51, 3, 6, 7], [51, 12, 6, 7], [51, 21, 6, 8], [10, 29, 12, 4], [25, 29, 10, 4], [38, 29, 10, 4]], [hall], poolOf(st, ENVS.garage), rng.int(6, 8));
    keepDoors(F, hall);
    stairsDown(F, 12, 25); relayAt(F, opt, st, 16, 25);
    F.bays = [{ x: 10, y: 5, w: 36, h: 2, up: true }, { x: 10, y: 12, w: 36, h: 2, up: false }, { x: 10, y: 19, w: 36, h: 2, up: true }];
    F.ramp = { x: 41, y: 24, w: 7, h: 4 }; reserve(F, 41, 24, 7, 4);
    F.arrows = [{ tx: 15, ty: 8, d: 1 }, { tx: 31, ty: 8, d: 1 }, { tx: 23, ty: 15, d: -1 }, { tx: 39, ty: 15, d: -1 }, { tx: 15, ty: 22, d: 1 }, { tx: 31, ty: 22, d: 1 }];
    ['A', 'B', 'C'].forEach((ch, ri) => [13, 21, 29, 37, 45].forEach((x, ci) => put(F, 'pillarnum', x, [9, 16, 23][ri], 1, 1, rng, { ring: false, label: ch + (ci + 1) })));
    for (const b of F.bays) for (let i = 0; i < 12; i++) if (rng.chance(0.55)) put(F, 'car', b.x + i * 3, b.y, 3, 2, rng);
    for (const y of [8, 15, 22]) for (let x = 13; x < 48; x += 8) { const bad = rng.chance(0.2); F.lights.push({ x: x * TS + 8, y: y * TS, oy: 20, r: 92, col: '#e8f4ff', a: bad ? 0.5 : 0.8, flick: bad ? 0.55 : 0.03, seed: x + y, shaft: true }); }
    return F;
  }
  // ── 海洋馆：一条海底隧道横穿竖着的大厅，墙全是鱼缸；四个角是展缸厅、纪念品店、饲料间
  function genAquarium(rng, st, opt) {
    const F = envFloor('aquarium', 56, 34), L = LV(), hall = L.addRoom(F, 20, 6, 16, 22, 'aquahall'), tun = L.addRoom(F, 2, 15, 52, 4, 'aquatunnel');
    const rooms = fillSlots(F, rng, st, opt, [[2, 2, 8, 11], [11, 2, 7, 11], [38, 2, 8, 11], [47, 2, 7, 11], [2, 21, 8, 11], [11, 21, 7, 11], [38, 21, 8, 11], [47, 21, 7, 11]], [hall, tun], poolOf(st, ENVS.aquarium), rng.int(6, 8));
    keepDoors(F, hall); keepDoors(F, tun); rooms.forEach(r => keepDoors(F, r));
    stairsDown(F, 28, 26); relayAt(F, opt, st, 24, 25);
    for (const [x, y] of [[22, 8], [33, 8], [22, 23], [33, 23], [22, 12], [33, 12]]) put(F, 'tankpillar', x, y, 1, 1, rng);
    for (const r of rooms) if (r.kind === 'tankroom') for (let y = r.y + 1; y < r.y + r.h - 1; y += 3) put(F, 'fishtank', r.x + 1, y, 2, 1, rng);
    scatter(F, rng, 'fishtank', 2, 21, 7, 33, 26, 2, 1);
    for (let x = 4; x < 54; x += 5) F.lights.push({ x: x * TS + 8, y: 16.5 * TS, r: 80, col: x % 2 ? '#3ee8ff' : '#7fd8ff', a: 0.55, flick: 0.14, seed: x });
    for (const [x, y] of [[24, 10], [32, 10], [24, 22], [32, 22]]) F.lights.push({ x: x * TS, y: y * TS, r: 90, col: '#7fe0ff', a: 0.45, flick: 0.1, seed: x + y });
    return F;
  }
  // ── 温室：一大间玻璃房，石板路十字，种植床一排排，棕榈和补光灯；上下是育苗间和蜂房
  function genGreenhouse(rng, st, opt) {
    const F = envFloor('greenhouse', 58, 34), gh = LV().addRoom(F, 3, 9, 52, 18, 'glasshouse');
    for (let x = 3; x <= 54; x++) for (const y of [17, 18]) F.surf[y * F.tw + x] = 1;
    for (let y = 9; y <= 26; y++) for (const x of [28, 29]) F.surf[y * F.tw + x] = 1;
    fillSlots(F, rng, st, opt, [[3, 2, 12, 5], [17, 2, 12, 5], [31, 2, 12, 5], [45, 2, 10, 5], [3, 29, 12, 4], [17, 29, 12, 4], [31, 29, 12, 4], [45, 29, 10, 4]], [gh], poolOf(st, ENVS.greenhouse), rng.int(6, 8));
    keepDoors(F, gh);
    stairsDown(F, 6, 17); relayAt(F, opt, st, 10, 17);
    for (const [x, y] of [[25, 14], [32, 14], [25, 21], [32, 21]]) put(F, 'palm', x, y, 1, 1, rng, { dry: true });
    for (const y of [11, 14, 21, 24]) for (let x = 5; x < 52; x += 5) put(F, 'plantbed', x, y, 2, 1, rng, { dry: true });
    for (const y of [12, 22]) for (let x = 7; x < 52; x += 10) put(F, 'growlamp', x, y, 1, 1, rng, { ring: false, dry: true });
    return F;
  }
  // ── 冷库：一条冷气通道，两边一间间冻库（货架成排），右头是装卸口
  function genColdstore(rng, st, opt) {
    const F = envFloor('coldstore', 56, 32), hall = LV().addRoom(F, 2, 13, 52, 6, 'coldhall');
    const rooms = fillSlots(F, rng, st, opt, [[2, 2, 12, 9], [16, 2, 12, 9], [30, 2, 12, 9], [44, 2, 10, 9], [2, 21, 12, 9], [16, 21, 12, 9], [30, 21, 12, 9], [44, 21, 10, 9]], [hall], poolOf(st, ENVS.coldstore), rng.int(6, 8));
    keepDoors(F, hall); rooms.forEach(r => keepDoors(F, r));
    stairsDown(F, 5, 13); relayAt(F, opt, st, 9, 14);
    F.dock = { x: 49, y: 13, w: 5, h: 6 };
    for (const r of rooms) if (r.kind === 'freezer') for (let y = r.y + 1; y < r.y + r.h - 1; y += 3) for (let x = r.x + 1; x + 1 < r.x + r.w - 1; x += 3) put(F, 'freezerrack', x, y, 2, 1, rng);
    scatter(F, rng, 'iceblock', 4, 3, 14, 50, 17);
    return F;
  }
  // ── 溶洞：六个天然洞厅（几个椭圆叠出来的不规则形状），弯弯曲曲的洞道连着，一片地下湖
  function genCave(rng, st, opt) {
    const F = envFloor('cave', 58, 34), pool = poolOf(st, ENVS.cave), t = st.tier || 0; F.allPat = true;
    let hv = HV_FORCE[st.type] || (t >= 1 && rng.chance(0.2 + t * 0.12) ? rng.pick(HV) : null);
    const cs = []; for (const gy of [9, 24]) for (const gx of [10, 29, 48]) cs.push([gx + rng.int(-3, 3), gy + rng.int(-2, 2)]);
    const start = rng.int(3, 5); [cs[0], cs[start]] = [cs[start], cs[0]]; // 下面一排的某个当入口
    const blobs = cs.map(([cx, cy], i) => {
      let kind = i === 0 ? 'cavern' : rng.weighted(pool); if (i > 0 && hv) { kind = hv; hv = null; }
      const cells = new Set(), add = (x, y) => { if (x > 1 && y > 2 && x < F.tw - 2 && y < F.tht - 2) cells.add(y * F.tw + x); };
      for (let k = rng.int(3, 4); k > 0; k--) { const ex = cx + rng.int(-3, 3), ey = cy + rng.int(-2, 2), rx = rng.range(3.5, 6.5), ry = rng.range(2.5, 4.2); for (let y = Math.floor(ey - ry); y <= ey + ry; y++) for (let x = Math.floor(ex - rx); x <= ex + rx; x++) if (((x + 0.5 - ex) / rx) ** 2 + ((y + 0.5 - ey) / ry) ** 2 < 1) add(x, y); }
      for (let y = cy - 1; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 1; x++) add(x, y);
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const i2 of cells) { const x = i2 % F.tw, y = Math.floor(i2 / F.tw); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const r = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, kind, name: D.ROOMS[kind].name, i: F.rooms.length, seen: false, hv: !!D.ROOMS[kind].hv };
      F.rooms.push(r); for (const i2 of cells) { F.solid[i2] = 0; F.kind[i2] = 0; F.room[i2] = r.i; }
      return { r, cx, cy, cells, deg: 0 };
    });
    // 洞道：按距离连成一棵树，再多连一条；两格宽、走得歪歪扭扭
    const tunnel = (a, b) => { let x = a.cx, y = a.cy; const path = []; for (let g = 0; (x !== b.cx || y !== b.cy) && g < 900; g++) {
        const dx = b.cx - x, dy = b.cy - y; let mx = 0, my = 0;
        if (rng.chance(0.15)) { if (rng.chance(0.5)) mx = rng.chance(0.5) ? 1 : -1; else my = rng.chance(0.5) ? 1 : -1; }
        else if (dx && (!dy || rng() < Math.abs(dx) / (Math.abs(dx) + Math.abs(dy)))) mx = Math.sign(dx); else my = Math.sign(dy);
        x = clamp(x + mx, 2, F.tw - 4); y = clamp(y + my, 3, F.tht - 4);
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = (y + oy) * F.tw + x + ox; if (F.solid[i]) { F.solid[i] = 0; F.kind[i] = 0; } }
        path.push([x, y]);
      } return path; };
    const inTree = [0], edges = [];
    while (inTree.length < blobs.length) { let best = null; for (const a of inTree) for (let b = 0; b < blobs.length; b++) if (!inTree.includes(b)) { const d = Math.hypot(blobs[a].cx - blobs[b].cx, blobs[a].cy - blobs[b].cy); if (!best || d < best.d) best = { a, b, d }; } inTree.push(best.b); edges.push(best); blobs[best.a].deg++; blobs[best.b].deg++; }
    const paths = edges.map(e => ({ e, path: tunnel(blobs[e.a], blobs[e.b]) }));
    const leaf = paths.find(q => q.e.b !== 0 && blobs[q.e.b].deg === 1 && !blobs[q.e.b].r.hv), hideB = leaf && rng.chance(0.55) ? leaf.e.b : -1;
    const extra = rng.shuffle([[1, 4], [2, 5], [0, 2], [3, 5]]).find(([a, b]) => a !== hideB && b !== hideB && !edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)));
    if (extra) tunnel(blobs[extra[0]], blobs[extra[1]]);
    // 隐藏洞：只连着一条洞道的洞，洞口（3×3）是一道裂缝墙；要是别的洞道碰巧也通到这个洞，就不藏了
    if (hideB > 0) {
      const B = blobs[hideB], j = leaf.path.findIndex(([x, y]) => [[0, 0], [1, 0], [0, 1], [1, 1]].some(([ox, oy]) => F.room[(y + oy) * F.tw + x + ox] === B.r.i));
      if (j > 1) {
        const [dx, dy] = leaf.path[j - 1], set = [];
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const i = (dy + oy) * F.tw + dx + ox; if (F.solid[i] === 0 && F.room[i] < 0) { F.solid[i] = 1; F.kind[i] = 3; set.push(i); } }
        const seen = new Uint8Array(F.tw * F.tht), q = [blobs[0].cy * F.tw + blobs[0].cx]; seen[q[0]] = 1; let leak = false;
        while (q.length && !leak) { const c = q.pop(), x = c % F.tw, y = Math.floor(c / F.tw); for (const [a, b] of N4) { const i = (y + b) * F.tw + x + a; if (seen[i] || F.solid[i]) continue; seen[i] = 1; if (F.room[i] === B.r.i) { leak = true; break; } q.push(i); } }
        if (leak) for (const i of set) { F.solid[i] = 0; F.kind[i] = 0; }
        else { F.breakables.push({ tx: dx, ty: dy, hp: 40, room: B.r.i, open: false, x: dx * TS + 8, y: dy * TS + 8 }); Object.assign(B.r, { kind: 'hidden', name: D.ROOMS.hidden.name, hidden: true }); }
      }
    }
    // 地下湖
    const lake = blobs.find((b, i) => i > 0 && !b.r.hidden && b.cells.size > 40);
    if (lake) { F.envWater = new Uint8Array(F.tw * F.tht); for (const i of lake.cells) { const x = i % F.tw, y = Math.floor(i / F.tw); if (((x - lake.cx) / 4.5) ** 2 + ((y - lake.cy) / 2.6) ** 2 < 1) { F.envWater[i] = 1; F.surf[i] = 3; } } }
    const b0 = blobs[0]; stairsDown(F, b0.cx, b0.cy); relayAt(F, opt, st, b0.cx + 2, b0.cy - 1);
    for (const b of blobs) if (b.r.kind === 'camp' || b.r.kind === 'mine') F.lights.push({ x: b.cx * TS + 8, y: b.cy * TS, r: 92, col: '#ffb070', a: 0.6, flick: 0.18, seed: b.cx });
    for (const b of blobs) for (let n = 0; n < 2; n++) { const arr = [...b.cells], i = arr[Math.floor(rng() * arr.length)]; F.lights.push({ x: (i % F.tw) * TS + 8, y: Math.floor(i / F.tw) * TS + 8, r: 58, col: rng.pick(F.th.neon), a: 0.35, flick: 0.1, seed: i }); }
    return F;
  }

  // ── 挂钩：站厅层换成环境
  const gx0 = D.genConcourseX;
  D.genConcourseX = function (rng, st, opt, lay) { const E = ENVS[lay]; if (E && !opt.safe && !opt.tut) return E.gen(rng, st, opt); return gx0 ? gx0.apply(this, arguments) : null; };
  // 别的楼层：地下环境的站台层也换成这个环境的墙和地面；地上的站台楼梯写"上到地面"；楼上大厦的入口挪到能走的地方
  const fx0 = D.floorsX;
  D.floorsX = function (floors, rng, st, opt, lay) {
    if (fx0) fx0.apply(this, arguments);
    const E = ENVS[lay]; if (!E || opt.safe || opt.tut || !floors[0].env) return;
    const P = floors[1];
    if (E.above) { for (const s of P.stairs) if (s.to === 0) s.label = '上到地面'; }
    else { P.theme = E.theme; P.th = Object.assign(lightTint(D.THEMES[E.theme], LV().line()), { ambient: P.th.ambient, lamp: P.th.lamp }); P.env = lay; P.surf = new Uint8Array(P.tw * P.tht); if (E.allPat || lay === 'cave') P.allPat = true; } // 站台照旧亮着：只换墙和地面
    const F = floors[0];
    for (const s of F.stairs) if (s.tower) { const tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS); if (floorAt(F, tx, ty) && floorAt(F, tx, ty + 1)) continue;
      const m = F.rooms[0]; let best = null; for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x; x < m.x + m.w; x++) if (floorAt(F, x, y) && floorAt(F, x, y + 1) && !F._keep[y * F.tw + x]) { const d = Math.hypot(x - (m.x + m.w), y - m.y); if (!best || d < best.d) best = { x, y, d }; }
      if (best) { s.x = best.x * TS + 8; s.y = best.y * TS + 6; } }
  };
  // 生成完（摆设、灯都放好以后）：大片露天区少摆点东西、去掉露天的吊灯、浅水、保证每间房走得到
  const sm0 = D.stationMod;
  D.stationMod = function (F, rng, st, fi) {
    if (sm0) sm0(F, rng, st, fi);
    if (!F.env) return;
    const E = ENVS[F.env];
    for (const r of F.rooms) { const RD = D.ROOMS[r.kind]; if (!RD || RD.thin == null) continue; for (let i = F.props.length - 1; i >= 0; i--) { const p = F.props[i]; if (p.mine) continue; const [tx, ty] = tilesOf(p)[0]; if (F.room[ty * F.tw + tx] === r.i && rng.chance(1 - RD.thin)) removeProp(F, i); } }
    if (F.outdoor || E.noShaft) F.lights = F.lights.filter(l => !(l.shaft && (E.noShaft || F.rooms.some(r => (D.ROOMS[r.kind] || {}).outdoor && Math.abs(l.y - (r.y * TS - 4)) < 1 && l.x >= r.x * TS && l.x <= (r.x + r.w) * TS))));
    if (F.envWater) { if (!F.water) F.water = new Uint8Array(F.tw * F.tht); for (let i = 0; i < F.envWater.length; i++) if (F.envWater[i]) F.water[i] = 1; }
    if (st.type === 'dispatch' && fi === 0 && !(F.terminals || []).length) { const m = F.rooms[0]; for (let y = m.y + 1; y < m.y + m.h - 1 && !(F.terminals || []).length; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) if (floorAt(F, x, y) && floorAt(F, x, y + 1) && floorAt(F, x + 1, y)) { F.terminals = [{ x: x * TS + 8, y: y * TS + 12, used: false }]; break; } }
    ensureReach(F);
  };
  // 摆设占的格子
  function tilesOf(p) {
    const tx = p.tx != null ? p.tx : Math.floor((p.x - p.w / 2) / TS + 0.01), ty = p.ty != null ? p.ty : Math.round(p.y / TS) - 1, tw = p.tw || (p.w > 20 ? 2 : 1), th = p.th || 1, out = [];
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) out.push([x, y]);
    return out;
  }
  function removeProp(F, i) {
    const p = F.props[i], cont = new Set(F.contSpots.map(c => Math.floor(c.y / TS) * F.tw + Math.floor(c.x / TS)));
    for (const [x, y] of tilesOf(p)) { const k = y * F.tw + x; if (k >= 0 && k < F.solid.length && !cont.has(k) && F.kind[k] === 0) F.solid[k] = 0; }
    if (p.light) F.lights = F.lights.filter(l => !(l.x === p.light.x && l.y === p.light.y && l.r === p.light.r));
    F.props.splice(i, 1);
  }
  // 从第一道楼梯往外走一遍：有房间走不到、有容器够不着，就拿掉离它最近的挡路摆设，再走一遍
  function flood(F) {
    const s0 = F.stairs[0], seen = new Uint8Array(F.tw * F.tht); if (!s0) return seen;
    const q = [[Math.floor(s0.x / TS), Math.floor(s0.y / TS) + 1]], pass = i => F.solid[i] === 0 || F.kind[i] === 3;
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * F.tw + nx; if (nx < 0 || ny < 0 || nx >= F.tw || ny >= F.tht || seen[i] || !pass(i)) continue; seen[i] = 1; q.push([nx, ny]); } }
    return seen;
  }
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function ensureReach(F) {
    for (let it = 0; it < 80; it++) {
      const seen = flood(F);
      const room = F.rooms.find(r => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (seen[y * F.tw + x]) return false; return true; });
      const cont = !room && F.contSpots.find(c => { const x = Math.floor(c.x / TS), y = Math.floor(c.y / TS); return !N4.some(([a, b]) => seen[(y + b) * F.tw + x + a]); });
      const tgt = room ? { x: room.x + room.w / 2, y: room.y + room.h / 2 } : cont ? { x: c2t(cont.x), y: c2t(cont.y) } : null;
      if (!tgt) return;
      let best = -1, bd = 1e9;
      F.props.forEach((p, i) => { const ts = tilesOf(p); if (!ts.some(([x, y]) => N4.some(([a, b]) => seen[(y + b) * F.tw + x + a]))) return; const d = Math.min(...ts.map(([x, y]) => Math.hypot(x - tgt.x, y - tgt.y))); if (d < bd) { bd = d; best = i; } });
      if (best < 0) return;
      removeProp(F, best);
    }
  }
  const c2t = v => Math.floor(v / TS);

  // ── 城市：每种骨架（新环境和原来的都算）至少两座站（从站多的骨架里挑几座改过来；按城市种子定死）
  const mc0 = D.makeCity;
  D.makeCity = function () {
    const C = mc0.apply(this, arguments);
    try {
      const ok = s => !s.dead && !s.home && !s.hidden && !s.reserve && !s.tut && !(D.STATION_TYPES[s.type] || {}).safe && s.type !== 'event';
      const sts = C.stations.filter(ok), rng = D.rng('envs:' + C.seed), count = () => { const m = {}; for (const s of sts) { const k = D.layoutOf(s); m[k] = (m[k] || 0) + 1; } return m; };
      // 每种站至少留一座原来的站厅（站型自己的主题还看得到）
      const scene = new Set(D.SCENE_LAYOUTS || []);
      for (const t of new Set(sts.map(s => s.type))) { const of = sts.filter(s => s.type === t); if (of.some(s => !scene.has(D.layoutOf(s)))) continue; const m = count(), s = of.slice().sort((a, b) => (m[D.layoutOf(b)] || 0) - (m[D.layoutOf(a)] || 0))[0]; s.layout = 'standard'; }
      for (const k of Object.keys(D.LAYOUTS)) {
        for (let n = count()[k] || 0; n < 2; n++) { const m = count(), cand = sts.filter(s => !s.layout && (m[D.layoutOf(s)] || 0) > 3); if (!cand.length) break; rng.pick(cand).layout = k; }
      }
    } catch (e) { /* 老城市数据缺字段时不管 */ }
    return C;
  };
  // ── 站卡片：写上环境
  const se0 = D.stationExtras;
  D.stationExtras = function (s) {
    const E = ENVS[D.layoutOf(s)], rest = se0 ? se0(s) : '';
    return (E ? `<div class="sc-desc"><b>环境</b>：${E.name}${E.above ? ' · 地面' : ''} · ${E.desc}</div>` : '') + rest;
  };
})(D);
