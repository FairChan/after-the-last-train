/* 末班之后 · 小样二：灯光效果库（77 种）。
   一盏灯 = 灯具形状（灯怎么画、光怎么铺）+ 动画（亮度怎么变）+ 颜色 + 安装方式（灯挂在哪）。
   安装方式（mount）：
     wall   挂在墙上（天花板灯）：挂板和挂杆连到墙上；
     floor  立在地上：底座落在地面上；
     self   自己带底座 / 本身就在墙上或天上（窗户、月亮）；
     art    灯具已经画在美术图里（招牌、环境道具、隧道口）：只让它发光和闪，不再画灯具。
   画法：灯具外壳用 sprite.js 的画板画（D.mkSprite，死亡细胞画风：球面 / 倒角着色、黑描边、发光像素进发光层）；
   光晕、光柱、灯带、细线（挂杆、电线）是光效，直接画。
   站里的灯在站生成好以后按所在位置挑一种（dressFloor，包在 D.makeStation 外面；用哈希挑，不碰关卡的随机数）。
   画法接在 draw.js：灯具走 D.LFX.fixture，照亮的光走 D.LFX.light；没有 fx 字段的老灯照旧。
   效果表见 design/features/lights/design.md（那份表由这里的 FX 生成）。
   3D 摆放（第三轮）：画面是斜俯视，地面上一点的画面 y 就是它的地面 y，离地越高画得越往上。后墙只有挨着地面的那一格
   是朝着镜头的立面（墙脚 wb 往上 16），再往上是黑的墙顶。墙上的灯一律挂在立面上，光分三处：立面上一圈墙光（只画在
   立面里）、灯前地上一块压扁的光斑（椭圆，宽 : 高 = 2 : 1）、往下照的灯从灯具到光斑一道很淡的光锥；吊下来的灯泡
   挂绳看得见，光斑落在灯泡正下方的地上。立在地上的灯脚下一圈压扁的光斑。不再在空中画大光团。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TAU = Math.PI * 2, TS = 16;
  const P = D.PAL;
  const rg = (c, a) => D.rgba(c, Math.max(0, Math.min(1, a)).toFixed(3));

  // ── 效果表
  // shape：灯具和光怎么铺；anim：亮度怎么变；keep：颜色沿用这盏灯（站的主题色），否则用 col；
  // col2：第二种颜色（警灯、变色）；rm：半径倍数；am：亮度倍数；len：灯管 / 光带长度；spread：光柱宽度；lenC：光柱长度；
  // speed / amp：动画快慢和幅度；ca：光柱透明度；mount：安装方式（不写就由形状决定）；
  // pair / dust / term / big / mode：各形状的小变化
  const FX = {
    // 日光灯（灯管，挂在墙上）
    tube_cold:         { shape: 'strip', anim: 'steady', col: '#e6f6ff', len: 34, am: 0.9 },
    tube_warm:         { shape: 'strip', anim: 'steady', col: '#ffd9a0', len: 34, am: 0.85 },
    tube_buzz:         { shape: 'strip', anim: 'buzz', col: '#dff4ff', len: 30, am: 0.9 },
    tube_flicker:      { shape: 'strip', anim: 'flicker', col: '#e6f6ff', len: 30, am: 0.9 },
    tube_dying:        { shape: 'strip', anim: 'dying', col: '#fff0d0', len: 26, am: 0.9 },
    tube_pair:         { shape: 'strip', anim: 'steady', col: '#e6f6ff', len: 50, pair: true, am: 0.9 },
    tube_hospital:     { shape: 'strip', anim: 'steady', col: '#c8ffe0', len: 40, am: 0.85 },
    tube_dim:          { shape: 'strip', anim: 'pulse', col: '#ffe0c0', len: 34, am: 0.7, speed: 0.5 },
    // 吊灯、筒灯、聚光灯（光柱，挂在墙上）
    cone_warm:         { shape: 'cone', anim: 'steady', keep: true, spread: 30 },
    cone_cold:         { shape: 'cone', anim: 'steady', col: '#dce8ff', spread: 26 },
    cone_broken:       { shape: 'cone', anim: 'broken', keep: true, spread: 30 },
    cone_dim:          { shape: 'cone', anim: 'steady', keep: true, spread: 22, am: 0.7 },
    cone_pulse:        { shape: 'cone', anim: 'pulse', keep: true, spread: 30, speed: 0.8 },
    cone_fade:         { shape: 'cone', anim: 'fade', keep: true, spread: 34, speed: 0.8 },
    cone_dust:         { shape: 'cone', anim: 'steady', keep: true, spread: 26, dust: true },
    cone_wide:         { shape: 'cone', anim: 'steady', keep: true, spread: 46, lenC: 90, ca: 0.09, am: 0.8 },
    downlight:         { shape: 'dot', anim: 'steady', keep: true, rm: 0.7 },
    downlight_flicker: { shape: 'dot', anim: 'flicker', keep: true, rm: 0.7 },
    spot_narrow:       { shape: 'spot', anim: 'steady', col: '#fff2d0', spread: 8, lenC: 110 },
    spot_drift:        { shape: 'spot', anim: 'drift', col: '#ffe8b0', spread: 9, lenC: 100 },
    // 挂灯、灯串（挂在墙上）
    chandelier:        { shape: 'chand', anim: 'wave', keep: true },
    hang_bulb:         { shape: 'hang', anim: 'steady', keep: true },
    hang_swing:        { shape: 'hang', anim: 'swing', keep: true },
    festoon:           { shape: 'festoon', anim: 'steady', col: '#ffd27a', len: 56 },
    festoon_chase:     { shape: 'festoon', anim: 'chase', col: '#ffd27a', len: 56 },
    // 应急与警示（警示灯立在地上，EXIT 牌挂在墙上）
    exit_green:        { shape: 'exit', anim: 'steady', col: '#3dd66a' },
    exit_flicker:      { shape: 'exit', anim: 'flicker', col: '#3dd66a' },
    beacon_red:        { shape: 'beacon', anim: 'blink', col: '#ff3047' },
    beacon_rotate:     { shape: 'beacon', anim: 'rotate', col: '#ffb020' },
    beacon_double:     { shape: 'beacon', anim: 'double', col: '#ff3047' },
    strobe_red:        { shape: 'beacon', anim: 'strobe', col: '#ff2030' },
    police_alt:        { shape: 'beacon', anim: 'alt', col: '#ff3047', col2: '#3a7bff' },
    alarm_pulse:       { shape: 'beacon', anim: 'pulse', col: '#ff4040', speed: 1.6 },
    hazard_stripe:     { shape: 'stripe', anim: 'blink', col: '#ffb020', len: 40 },
    // 霓虹招牌（画在墙上的招牌里，只让招牌发光；颜色沿用招牌本身）
    neon_steady:       { shape: 'sign', anim: 'steady', keep: true, mode: 'all' },
    neon_buzz:         { shape: 'sign', anim: 'buzz', keep: true, mode: 'all' },
    neon_flicker:      { shape: 'sign', anim: 'flicker', keep: true, mode: 'all' },
    neon_dead:         { shape: 'sign', anim: 'broken', keep: true, mode: 'dead' },
    neon_breathe:      { shape: 'sign', anim: 'pulse', keep: true, mode: 'all', speed: 0.5 },
    neon_chase:        { shape: 'sign', anim: 'chase', keep: true, mode: 'chase' },
    neon_heart:        { shape: 'sign', anim: 'heartbeat', keep: true, mode: 'all' },
    neon_scan:         { shape: 'sign', anim: 'scan', keep: true, mode: 'scan' },
    // 屏幕、机柜、电弧（立在地上）
    screen_blue:       { shape: 'screen', anim: 'steady', col: '#3a7bff' },
    screen_term:       { shape: 'screen', anim: 'steady', col: '#6bff8a', term: true },
    screen_flash:      { shape: 'screen', anim: 'arc', col: '#dff0ff' },
    rack_led:          { shape: 'rack', anim: 'twinkle', col: '#3ee8ff' },
    arc_spark:         { shape: 'arc', anim: 'arc', col: '#9be8ff' },
    // 营地与火光（立在地上，挂灯笼挂在墙上）
    candle:            { shape: 'candle', anim: 'candle', col: '#ffb060' },
    brazier:           { shape: 'brazier', anim: 'flame', col: '#ff9040' },
    campfire:          { shape: 'brazier', anim: 'flame', col: '#ff8030', big: true },
    lantern_swing:     { shape: 'lantern', anim: 'swing', col: '#ffc070' },
    tent_glow:         { shape: 'tent', anim: 'steady', col: '#ffb070' },
    // 地面灯带、光缝、排气口（贴着地面）
    track_red:         { shape: 'led', anim: 'steady', col: '#ff3047', len: 60, am: 0.9 },
    track_warn:        { shape: 'led', anim: 'pulse', col: '#ff3047', len: 60, am: 0.9, speed: 0.7 },
    track_chase:       { shape: 'led', anim: 'chase', col: '#ff3047', len: 60, am: 0.9 },
    stair_nosing:      { shape: 'led', anim: 'steady', col: '#ffe08a', len: 24 },
    floor_chase:       { shape: 'led', anim: 'chase', col: '#3ee8ff', len: 60 },
    underglow:         { shape: 'pool', anim: 'wave', col: '#3a7bff', rm: 1.2 },
    vent_up:           { shape: 'vent', anim: 'steady', col: '#ff9a50' },
    gutter_green:      { shape: 'led', anim: 'pulse', col: '#3dd66a', len: 40, speed: 1.2 },
    // 探照、扫射、激光（挂在墙上）
    searchlight:       { shape: 'sweep', anim: 'sweep', col: '#ffe2b0', spread: 14, lenC: 150, speed: 0.8, amp: 0.9 },
    patrol_pan:        { shape: 'sweep', anim: 'wave', col: '#eef6ff', spread: 20, lenC: 130, speed: 0.25, amp: 1.4 },
    sweep_cyan:        { shape: 'sweep', anim: 'pulse', col: '#3ee8ff', spread: 10, lenC: 140 },
    laser_scan:        { shape: 'laser', anim: 'scan', col: '#ff3047', len: 120 },
    laser_static:      { shape: 'laser', anim: 'steady', col: '#ff5a5a', len: 90 },
    // 氛围（窗户自带窗框，月亮在天上，雾和热浪从小机器里冒出来，水光贴着地面，墙面变色灯贴着墙）
    window_light:      { shape: 'window', anim: 'wave', col: '#fff3d6' },
    moon_glow:         { shape: 'moon', anim: 'steady', col: '#c8d8ff' },
    hologram:          { shape: 'holo', anim: 'scan', col: '#3ee8ff' },
    plasma_orb:        { shape: 'orb', anim: 'pulse', col: '#b06bff', speed: 1.2 },
    caustic:           { shape: 'caustic', anim: 'wave', col: '#7fd8ff' },
    fog_pool:          { shape: 'fog', anim: 'steady', col: '#c0c8e0' },
    aurora:            { shape: 'wash', anim: 'drift', col: '#ff7ad9', col2: '#3ee8ff' },
    heat_haze:         { shape: 'haze', anim: 'wave', col: '#ffb070' },
    ember_dying:       { shape: 'orb', anim: 'dead', col: '#ff7040' },
    // 环境道具、隧道口上的灯：灯具已经画在美术图里，这里只让它发光（沿用它自己的颜色）
    lamp_glow:         { shape: 'pool', anim: 'steady', keep: true, rm: 0.5, am: 0.9, mount: 'art' },
    lamp_pulse:        { shape: 'pool', anim: 'pulse', keep: true, rm: 0.5, speed: 0.6, mount: 'art' },
    lamp_flicker:      { shape: 'pool', anim: 'flicker', keep: true, rm: 0.5, mount: 'art' },
    // 补光：哪儿都挂不上、放不下的灯，不画灯具，只照亮原来那片地方（等于镜头外的天花板灯）
    fill_soft:         { shape: 'fill', anim: 'steady', keep: true, mount: 'art' },
  };

  // ── 亮度动画：返回 0 .. 1.2 左右的倍数。t 是时间（秒），s 是这盏灯自己的错开量
  const H = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; // 整数 → 0..1 伪随机
  const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return H(i) * (1 - u) + H(i + 1) * u; };
  const FLASHY = { flicker: 1, buzz: 1, dying: 1, broken: 1, strobe: 1, blink: 1, double: 1, alt: 1, arc: 1, dead: 1 };
  const ANIM = {
    steady: () => 1,
    flicker: (t, s) => { const n = vn(t * 3 + s); return n < 0.12 ? 0.2 : n < 0.22 ? 0.65 : 1; },
    buzz: (t, s) => 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 73 + s)),
    dying: (t, s) => { const p = (t * 0.16 + s * 0.031) % 1; return p < 0.1 ? 0.08 : p < 0.18 ? 0.7 : 0.92 + 0.08 * Math.sin(t * 9 + s); },
    broken: (t, s) => { const n = vn(t * 4.5 + s); return n < 0.25 ? 0.2 : 0.6 + 0.4 * n; },
    pulse: (t, s, d) => 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 * (d.speed || 1) + s)),
    fade: (t, s, d) => 0.7 + 0.3 * Math.sin(t * 0.45 * (d.speed || 1) + s),
    strobe: (t, s) => ((t * 6 + s * 0.13) % 1) < 0.3 ? 1 : 0.03,
    blink: (t, s) => ((t * 1.1 + s * 0.13) % 1) < 0.3 ? 1 : 0.06,
    double: (t, s) => { const p = (t * 0.9 + s * 0.1) % 1; return (p < 0.08 || (p > 0.16 && p < 0.24)) ? 1 : 0.04; },
    alt: (t, s) => (Math.floor(t * 3.5 + s) % 2 ? 1 : 0.45),
    rotate: (t, s) => 0.2 + 0.8 * Math.pow(Math.max(0, Math.cos(t * 2.4 + s)), 2),
    chase: () => 1,
    wave: (t, s) => 0.8 + 0.2 * Math.sin(t * 0.7 + s),
    candle: (t, s) => 0.8 + 0.12 * vn(t * 6 + s) + 0.08 * Math.sin(t * 13 + s),
    flame: (t, s) => 0.68 + 0.26 * vn(t * 9 + s) + 0.06 * Math.sin(t * 17 + s),
    heartbeat: (t, s) => { const p = (t * 1.1 + s * 0.05) % 1; return p < 0.08 ? 1 : p < 0.16 ? 0.35 : p < 0.24 ? 0.8 : 0.22; },
    scan: (t, s) => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.3 + s)),
    arc: (t, s) => (H(Math.floor(t * 2.5 + s)) > 0.85 ? 1 : 0.1),
    dead: (t, s) => (H(Math.floor(t * 1.3 + s)) > 0.93 ? 1 : 0.04),
    drift: (t, s) => 0.7 + 0.3 * vn(t * 0.3 + s),
    sweep: (t, s) => 0.7 + 0.3 * Math.sin(t * 0.9 + s),
    twinkle: (t, s) => 0.55 + 0.45 * (H(Math.floor(t * 4 + s)) > 0.5 ? 1 : 0),
    swing: () => 1,
  };
  // 减少闪光（设置里）：会闪的效果改成稳定的 0.6
  const level = (d, l, t) => (D.settings && D.settings.reduceFlash && FLASHY[d.anim] ? 0.6 : ANIM[d.anim](t, l.sd || 0, d));
  // 颜色：警灯两色交替，变色灯两色慢慢混
  const hue = (d, l, t) => {
    if (d.anim === 'alt') return Math.floor(t * 3.5 + (l.sd || 0)) % 2 ? (l.col2 || l.col) : l.col;
    if (d.anim === 'drift' && l.col2) return D.mixHex(l.col, l.col2, 0.5 + 0.5 * Math.sin(t * 0.3 + (l.sd || 0)));
    return l.col;
  };

  // ── 安装方式：每种形状默认挂在哪（墙上 / 地上 / 自己带底座 / 美术图里）
  const WALL_SHAPES = new Set(['strip', 'cone', 'dot', 'spot', 'chand', 'hang', 'festoon', 'exit', 'lantern', 'laser', 'sweep', 'wash']);
  const FLOOR_SHAPES = new Set(['led', 'stripe', 'pool', 'vent', 'candle', 'brazier', 'tent', 'orb', 'holo', 'rack', 'screen', 'arc', 'beacon', 'fog', 'caustic', 'haze']);
  const SELF_SHAPES = new Set(['window', 'moon']);
  const mountOf = d => d.mount || (WALL_SHAPES.has(d.shape) ? 'wall' : FLOOR_SHAPES.has(d.shape) ? 'floor' : SELF_SHAPES.has(d.shape) ? 'self' : 'art');
  // 挂在墙上的灯：挂点（挂杆接到墙上的地方）。y 是灯具顶端
  function attachPts(l, d) {
    const x = l.x, y = l.y;
    switch (d.shape) {
      case 'strip': { const w = l.len || 34; return [[x - w / 2 + 2, y], [x + w / 2 - 2, y]]; }
      case 'festoon': { const L = l.len || 80; return [[x - L / 2, y], [x + L / 2, y]]; }
      case 'laser': { const L = l.len || 120; return [[x - L / 2 + 1, y - 1], [x + L / 2 - 1, y - 1]]; }
      case 'wash': return [[x - 20, y - 6], [x + 20, y - 6]];
      case 'sweep': return [[x, y - 4]];
      case 'chand': return [[x, y - 1]];
      case 'cone': case 'spot': return [[x, y - 2]];
      case 'dot': case 'exit': return [[x, y - 1]];
      default: return [[x, y]];
    }
  }

  // ── 画图的小工具（g 是画布上下文；坐标是世界单位）
  // 精灵：画板尺寸都是画板像素（世界单位的 2 倍）；同一种外壳只画一次，之后从缓存里取
  const SPR = new Map();
  const spr = (key, pw, ph, fn) => { let s = SPR.get(key); if (!s) { s = D.mkSprite(pw, ph, fn); SPR.set(key, s); } return s; };
  // 贴图：x 是中心，yFoot 是精灵的底边（世界单位）；发光像素进发光层，亮度用 k 压
  const put = (g, e, s, x, yFoot, k) => {
    D.blit(g, s, x, yFoot);
    if (s.emit) { const a = e.globalAlpha; e.globalAlpha = Math.max(0, Math.min(1, k == null ? 1 : k)); D.blit(e, s, x, yFoot, false, 'emit'); e.globalAlpha = a; }
  };
  // 发光面的色阶：从暗到亮，最亮的一级是灯光本身
  const rampCache = new Map();
  const rampOf = c => { let r = rampCache.get(c); if (!r) { r = [D.mixHex(c, '#000000', 0.7), D.mixHex(c, '#000000', 0.4), c, D.mixHex(c, '#ffffff', 0.25), D.mixHex(c, '#ffffff', 0.55), D.mixHex(c, '#ffffff', 0.8)]; rampCache.set(c, r); } return r; };
  // 光效（不是画物件）：光晕、光柱、灯带、线
  const glow = (g, x, y, r, c, a) => { if (a < 0.004 || r <= 0) return; const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, rg(c, a)); q.addColorStop(1, rg(c, 0)); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); };
  const line = (g, x0, y0, x1, y1, c, w) => { g.strokeStyle = c; g.lineWidth = w || 0.5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const chaseLv = (t, s, i, n) => ((((i - Math.floor(t * 6 + s)) % n) + n) % n < 2 ? 1 : 0.18);
  // ── 3D：墙脚、地面光斑、墙光、光锥（见文件头）
  const FLAT = 0.5, FACE = TS, CORD = '#16131c';
  const wbFrom = y => (Math.floor((y - 9) / TS) + 1) * TS;          // 挂点所在那格墙的下沿 = 墙脚
  const wbOf = l => (l.wb != null ? l.wb : wbFrom(l.y));
  // 地面光斑（发光层，很淡，泛光把它托起来）：按透视压扁的椭圆
  const floorGlow = (g, x, y, R, c, a) => {
    if (a < 0.004 || R <= 0) return;
    g.save(); g.translate(x, y); g.scale(1, FLAT);
    const q = g.createRadialGradient(0, 0, 0, 0, 0, R); q.addColorStop(0, rg(c, a)); q.addColorStop(0.5, rg(c, a * 0.5)); q.addColorStop(1, rg(c, 0));
    g.fillStyle = q; g.fillRect(-R, -R, R * 2, R * 2); g.restore();
  };
  // 墙光：只画在立面那一格里（wb-16 .. wb），不溢到黑的墙顶上
  const wallGlow = (g, x, y, wb, R, c, a) => {
    if (a < 0.004 || R <= 0) return;
    g.save(); g.beginPath(); g.rect(x - R, wb - FACE, R * 2, FACE); g.clip();
    const q = g.createRadialGradient(x, y, 0, x, y, R); q.addColorStop(0, rg(c, a)); q.addColorStop(1, rg(c, 0));
    g.fillStyle = q; g.fillRect(x - R, wb - FACE, R * 2, FACE); g.restore();
  };
  // 光锥：灯具（y0，半宽 w0）往下到地上的光斑（y1，半宽 w1），上浓下淡，到光斑中间淡完（光斑接着它）
  const beam = (g, x0, y0, w0, x1, y1, w1, c, a) => {
    if (a < 0.004 || y1 <= y0) return;
    const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, rg(c, a)); q.addColorStop(0.6, rg(c, a * 0.45)); q.addColorStop(1, rg(c, 0));
    g.fillStyle = q; g.beginPath(); g.moveTo(x0 - w0, y0); g.lineTo(x0 + w0, y0); g.lineTo(x1 + w1, y1); g.lineTo(x1 - w1, y1); g.closePath(); g.fill();
  };
  // 照明层只认圆：三个圆横着并排，拼成一块压扁的光斑
  const poolLT = (LT, x, y, R, c, I) => { const r = R * 0.62, o = R * 0.42; LT(x - o, y, r, c, I * 0.55); LT(x, y, r * 1.05, c, I * 0.7); LT(x + o, y, r, c, I * 0.55); };
  // 墙上的灯照亮：立面上一圈 + 地上的光斑 + 往房间里铺开的余光（房间要看得清，总亮度和原来的灯差不多）
  //   o.x 光斑的 x（吊灯摆动、聚光灯漂移）；o.d 光斑离墙多远；o.R 光斑半宽；o.wall 墙光半径（0 不画）；wk / pk / fk 三处的强度
  function wallLit(l, LT, c, I, o) {
    const wb = wbOf(l), x = o.x != null ? o.x : l.x;
    if (o.wall) LT(l.x, wb - 8, o.wall, c, I * (o.wk || 0.45));
    poolLT(LT, x, wb + o.d, o.R, c, I * (o.pk || 0.8));
    LT(x, wb + Math.max(o.d + 10, 32), (l.r || 90) * (o.fr || 0.85), c, I * (o.fk || 0.5));
  }
  // 立在地上的灯：脚下一圈压扁的光斑（光源本身在灯具上）
  const FLOOR_POOL = new Set(['candle', 'brazier', 'beacon', 'orb', 'screen', 'rack', 'tent', 'holo', 'arc', 'vent', 'haze', 'fog']);
  const footR = l => Math.min(36, (l.r || 60) * 0.32);
  // 各种灯的光斑位置
  const coneGeo = l => { const sp = l.spread || 30; return { d: Math.round(14 + sp * 0.5), R: sp + 4 }; };
  const spotD = l => Math.round((l.lenC || 110) * 0.32);
  const spotDx = (d, l, t) => (d.anim === 'drift' ? Math.sin(t * 0.4 + (l.sd || 0)) * 12 : 0);
  const hangX = (d, l, t) => (d.anim === 'swing' ? l.x + Math.sin(t * 1.1 + (l.sd || 0)) * 3 : l.x);
  // 灯串：两个挂钩挂在立面上部（墙脚往上 13），电线中间垂到墙脚往上 7；灯泡挂在线上，整串都在立面上
  const festoonPts = l => { const n = 7, L = l.len || 56, wb = wbOf(l), out = []; for (let i = 0; i < n; i++) { const u = i / (n - 1); out.push([l.x - L / 2 + L * u, wb - 13 + 24 * u * (1 - u)]); } return out; };
  const CH_D = 16; // 三盏挂灯：光斑离墙
  const chandBulbs = l => [-9, 0, 9].map(o => [l.x + o, l.y + (o ? 8 : 11)]);
  const blobs = (l, t) => [0, 1, 2, 3].map(i => [l.x + Math.sin(t * 0.8 + (l.sd || 0) + i * 1.7) * 10, l.y + Math.cos(t * 0.6 + i * 2.1 + (l.sd || 0)) * 4]);
  const beamA = (d, l, t) => Math.PI / 2 + Math.sin(t * (d.speed || 0.8) + (l.sd || 0)) * (d.amp || 0.9);
  const segLv = (mode, t, s, i, n) => {
    if (mode === 'dead') return H(i * 3.7 + s) > 0.6 ? 1 : 0;
    if (mode === 'chase') return chaseLv(t, s, i, n);
    if (mode === 'scan') { const p = (t * 2 + s) % n; return Math.exp(-Math.pow(i - p, 2) * 0.8) * 0.9 + 0.1; }
    return 1;
  };

  // 墙上的支撑：每个挂点一块挂板（贴在墙里），一根挂杆接到灯具上
  function wallSupport(g, e, l, pts) {
    for (const [ax, ay] of pts) {
      const plate = spr('plate', 16, 8, p => { p.box(0, 0, 16, 8, P_RAMP.steel, { r: 2, v: 0.6 }); p.rect(3, 1, 10, 1, '#dbe5fa'); });
      put(g, e, plate, ax, ay - 6, 1);
      line(g, ax, ay - 6, ax, ay - 1, '#96a0c4', 1.5);
    }
  }
  // 画板里要用的色阶（sprite.js 的 D.RAMP；画的时候才取，没有就退回墨色）
  const P_RAMP = new Proxy({}, { get: (_, k) => (D.RAMP && D.RAMP[k]) || ['#0c0e17', '#151a29', '#20263b', '#2d3550', '#3d4766'] });

  // ── 灯具形状：fix 画灯具（外壳用画板，光效直接画），lit 把光铺进照明层（LT(x, y, r, 颜色, 强度)）；
  //    art（可选）只画招牌上会亮的部分（灯具本身在美术图里）
  const SH = {
    strip: { // 日光灯管：贴在立面上；照亮身后的墙，往下一层光幕落成墙脚前的一长条光斑
      fix(g, e, l, d, t, k) {
        const w = l.len || 34, x = l.x, y = l.y, c = l.col, pair = !!d.pair, wb = wbOf(l);
        const body = spr('strip:' + w + ':' + (pair ? 2 : 1) + ':' + c, (w + 2) * 2, pair ? 12 : 8, p => {
          const W = (w + 2) * 2, face = rampOf(c)[5];
          p.box(0, 0, W, pair ? 12 : 8, P_RAMP.steel, { r: 1, v: 0.55 });
          p.rect(3, 4, W - 6, 2, face, true); if (pair) p.rect(3, 8, W - 6, 2, face, true);
        });
        wallGlow(e, x, y + 1, wb, w * 0.5 + 12, c, 0.2 * k);
        beam(e, x, y + 3, w * 0.5, x, wb + 12, w * 0.5 + 10, c, 0.07 * k);
        floorGlow(e, x, wb + 12, w * 0.5 + 16, c, 0.1 * k);
        put(g, e, body, x, y + (pair ? 4 : 2), k);
      },
      lit(l, d, t, I, c, LT) { const w = l.len || 34; wallLit(l, LT, c, I, { d: 12, R: w * 0.5 + 24, wall: w * 0.5 + 12 }); },
    },
    cone: { // 带灯罩的壁灯：灯罩朝下，光锥落到灯前地上一块光斑
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, s = l.sd || 0, wb = wbOf(l), G3 = coneGeo(l), y1 = wb + G3.d, w1 = G3.R * 0.75;
        const head = spr('cone:' + c, 24, 8, p => { p.box(0, 0, 24, 8, P_RAMP.steel, { r: 1, v: 0.6 }); p.rect(4, 5, 16, 2, rampOf(c)[5], true); });
        wallGlow(e, x, y, wb, 12, c, 0.12 * k);
        beam(e, x, y + 3, 5, x, y1, w1, c, (d.ca || 0.13) * k);
        floorGlow(e, x, y1, G3.R, c, 0.14 * k);
        put(g, e, head, x, y + 2, k);
        if (d.dust) for (let i = 0; i < 9; i++) { const u = (t * 0.09 + H(i + s)) % 1, py = y + 4 + u * (y1 - y - 4), w = 5 + (w1 - 5) * u, px = x + (H(i * 7 + s) * 2 - 1) * w * 0.8 + Math.sin(t * 1.3 + i) * 1.2; e.fillStyle = rg(c, 0.55 * k * (1 - u)); e.fillRect(Math.round(px), Math.round(py), 1, 1); }
      },
      lit(l, d, t, I, c, LT) { const G3 = coneGeo(l); wallLit(l, LT, c, I, { d: G3.d, R: G3.R, wall: 14, wk: 0.3 }); },
    },
    dot: { // 筒灯：小圆灯口朝下，正下方一小块亮斑
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, wb = wbOf(l), y1 = wb + 16;
        const ring = spr('dot:' + c, 20, 4, p => { p.box(0, 0, 20, 4, P_RAMP.steel, { r: 1 }); p.ell(10, 2, 4, 1.5, rampOf(c), { emit: true }); });
        beam(e, x, y + 2, 3, x, y1, 13, c, 0.1 * k);
        floorGlow(e, x, y1, 20, c, 0.16 * k);
        put(g, e, ring, x, y + 1, k);
      },
      lit(l, d, t, I, c, LT) { wallLit(l, LT, c, I, { d: 16, R: 24, wall: 10, wk: 0.25, pk: 0.95 }); },
    },
    spot: { // 聚光灯：细光束斜着打到远一点的地上，落成一小块很亮的光斑
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, wb = wbOf(l), dx = spotDx(d, l, t), y1 = wb + spotD(l);
        const head = spr('spot:' + c, 12, 8, p => { p.box(0, 0, 12, 8, P_RAMP.steel, { r: 2 }); p.rect(3, 6, 6, 2, rampOf(c)[5], true); });
        beam(e, x, y + 3, 2, x + dx, y1, 8, c, 0.13 * k);
        floorGlow(e, x + dx, y1, 16, c, 0.42 * k);
        put(g, e, head, x, y + 2, k);
      },
      lit(l, d, t, I, c, LT) { wallLit(l, LT, c, I, { x: l.x + spotDx(d, l, t), d: spotD(l), R: 22, pk: 1.1, fk: 0.3, fr: 0.6 }); },
    },
    chand: { // 墙上一根横杆，下面用看得见的挂绳吊三盏灯泡；光斑落在灯泡正下方的地上
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, wb = wbOf(l);
        const bar = spr('chandbar', 52, 6, p => p.box(0, 0, 52, 6, P_RAMP.steel, { r: 1 }));
        const bulb = spr('bulb:' + c, 6, 7, p => { p.rect(2, 0, 2, 1, '#3d4766'); p.ell(3, 4, 3, 3, rampOf(c), { emit: true }); });
        wallGlow(e, x, y + 2, wb, 22, c, 0.14 * k);
        floorGlow(e, x, wb + CH_D, 26, c, 0.12 * k);
        put(g, e, bar, x, y + 2, k);
        for (const [bx, by] of chandBulbs(l)) {
          line(g, bx, y + 1.5, bx, by - 2, CORD, 1);
          put(g, e, bulb, bx, by + 1.5, k); glow(e, bx, by, 4, c, 0.4 * k);
        }
      },
      lit(l, d, t, I, c, LT) { wallLit(l, LT, c, I, { d: CH_D, R: 30, wall: 20, wk: 0.4 }); },
    },
    hang: { // 吊灯：挂杆下面一根电线吊着灯罩和灯泡；光斑落在灯泡正下方的地上（离灯泡十几单位）
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, wb = wbOf(l), bx = hangX(d, l, t);
        const shade = spr('hshade', 12, 5, p => p.box(0, 0, 12, 5, P_RAMP.steel, { r: 2, v: 0.6 }));
        const bulb = spr('hbulb:' + c, 6, 6, p => p.ell(3, 3, 3, 3, rampOf(c), { emit: true }));
        wallGlow(e, x, y + 2, wb, 16, c, 0.12 * k);
        beam(e, bx, y + 13, 3, bx, wb + 22, 14, c, 0.08 * k);
        floorGlow(e, bx, wb + 22, 22, c, 0.14 * k);
        line(g, x, y - 1, bx, y + 9, CORD, 1);
        put(g, e, shade, bx, y + 11.5, k); put(g, e, bulb, bx, y + 14, k);
        glow(e, bx, y + 12.5, 5, c, 0.45 * k);
      },
      lit(l, d, t, I, c, LT) { wallLit(l, LT, c, I, { x: hangX(d, l, t), d: 22, R: 28, wall: 14, wk: 0.35 }); },
    },
    festoon: { // 灯串：立面上两个挂钩之间搭一根电线，小灯泡挂在线上；照亮身后的墙和墙脚前的一长条地面
      fix(g, e, l, d, t, k) {
        const pts = festoonPts(l), c = l.col, wb = wbOf(l), L = l.len || 56, n = pts.length, s = l.sd || 0;
        const hook = spr('hook', 6, 6, p => p.box(0, 0, 6, 6, P_RAMP.steel, { r: 1 }));
        const gb = spr('gbulb:' + c, 4, 6, p => { p.rect(1, 0, 2, 1, '#3d4766'); p.ell(2, 3.5, 2, 2.5, rampOf(c), { emit: true }); });
        wallGlow(e, l.x, wb - 8, wb, L * 0.6, c, 0.13 * k);
        floorGlow(e, l.x, wb + 8, L * 0.6, c, 0.07 * k);
        put(g, e, hook, pts[0][0], pts[0][1] + 1.5, 1); put(g, e, hook, pts[n - 1][0], pts[n - 1][1] + 1.5, 1);
        for (let i = 0; i < n - 1; i++) { line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], CORD, 1); line(e, pts[i][0], pts[i][1] - 0.5, pts[i + 1][0], pts[i + 1][1] - 0.5, rg(c, 0.3 * k), 0.5); } // 电线 + 灯泡照在线上的一道细亮边
        for (let i = 1; i < n - 1; i++) { const [bx, by] = pts[i], lv = d.anim === 'chase' ? chaseLv(t, s, i, n) : 1; put(g, e, gb, bx, by + 3, k * lv); glow(e, bx, by + 1.5, 3, c, 0.35 * lv * k); }
      },
      lit(l, d, t, I, c, LT) {
        const L = l.len || 56, wb = wbOf(l), pts = festoonPts(l), n = pts.length;
        for (let i = 1; i < n - 1; i += 2) { const lv = d.anim === 'chase' ? chaseLv(t, l.sd || 0, i, n) : 1; LT(pts[i][0], wb - 8, 16, c, I * 0.3 * lv); }
        poolLT(LT, l.x, wb + 8, L * 0.6, c, I * 0.5);
        LT(l.x, wb + 30, (l.r || 90) * 0.6, c, I * 0.3);
      },
    },
    exit: { // EXIT 牌：直接贴在立面上（不用挂板），墙脚前一小片绿光
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, wb = wbOf(l);
        const panel = spr('exit:' + c, 48, 20, p => { p.box(0, 0, 48, 20, P_RAMP.dark, { r: 2 }); p.rect(4, 4, 40, 12, rampOf(c)[4], true); });
        wallGlow(e, x, y - 6, wb, 22, c, 0.16 * k);
        floorGlow(e, x, wb + 8, 18, c, 0.1 * k);
        put(g, e, panel, x, y - 1, k);
        D.text(e, 'EXIT', x, y - 8.5, '#06240f', { align: 'center', shadow: false });
        glow(e, x, y - 6, 14, c, 0.22 * k);
      },
      lit(l, d, t, I, c, LT) { wallLit(l, LT, c, I * 0.8, { d: 8, R: 20, wall: 18, wk: 0.6, fk: 0.25, fr: 0.5 }); },
    },
    beacon: { // 立在地上的警示灯：底座落在地面上（底边就是地面线）
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = hue(d, l, t), dx = d.anim === 'rotate' ? Math.sin(t * 2.4 + (l.sd || 0)) * 2 : 0;
        const base = spr('bbase', 16, 8, p => p.box(0, 0, 16, 8, P_RAMP.steel, { r: 2 }));
        put(g, e, base, x, y, k);
        const dome = spr('bdome:' + c, 12, 12, p => { p.ell(6, 6, 6, 6, P_RAMP.steel, {}); p.ell(6, 8, 3, 2, rampOf(c), { emit: true }); });
        put(g, e, dome, x + dx, y - 4, k);
        glow(e, x + dx, y - 7, 10, c, 0.4 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 7, l.r * 0.5, c, I); },
    },
    stripe: { // 地面警示条（黄黑相间的胶带）
      fix(g, e, l, d, t, k) {
        const L = l.len || 40, x = l.x, y = l.y, c = l.col;
        const tape = spr('stripe:' + L, 2 * L, 6, p => { for (let i = 0; i < L / 4; i++) p.box(i * 8, 0, 8, 6, i % 2 ? P_RAMP.dark : P_RAMP.yellow, { r: 0, v: 0.7 }); });
        put(g, e, tape, x, y + 3, k);
        e.fillStyle = rg(c, 0.5 * k); e.fillRect(x - L / 2, y - 1, L, 1); floorGlow(e, x, y + 1, L * 0.55, c, 0.22 * k);
      },
      lit(l, d, t, I, c, LT) { const L = l.len || 40; for (let i = 0; i < 3; i++) LT(l.x - L / 2 + L * i / 2, l.y - 4, l.r * 0.35, c, I * 0.5); },
    },
    // 招牌：墙上的招牌（板子和底色是美术图画的），这里只让里面的几根灯管按动画亮灭
    sign: {
      art(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, s = l.sd || 0;
        for (let i = 0; i < 3; i++) { const lv = segLv(d.mode, t, s, i, 3) * k; e.fillStyle = rg(c, 0.95 * lv); e.fillRect(x - 5, y - 7 + i * 3, 10, 1.5); }
        glow(e, x, y - 4, 12, c, 0.35 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 4, l.r * 0.4, c, I * 0.7); },
    },
    screen: { // 立在桌上的显示器：桌子落在地面上
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = hue(d, l, t), s = l.sd || 0, dy = y - 7;
        const desk = spr('desk', 44, 4, p => p.box(0, 0, 44, 4, P_RAMP.crate, { r: 1 }));
        put(g, e, desk, x, dy + 2, k);
        line(g, x - 9, dy + 2, x - 9, y, '#2a2420', 1); line(g, x + 9, dy + 2, x + 9, y, '#2a2420', 1);
        const mon = spr('mon:' + c, 32, 28, p => { p.box(0, 0, 32, 22, P_RAMP.dark, { r: 2 }); p.rect(4, 4, 24, 14, rampOf(c)[4], true); p.box(12, 22, 8, 4, P_RAMP.steel, { r: 0 }); });
        put(g, e, mon, x, dy, k);
        const top = dy - 12;   // 屏幕上沿（世界单位）
        if (d.term) for (let r = 0; r < 5; r++) { const len = 4 + H(r * 3 + s) * 8; e.fillStyle = rg('#d8ffe4', 0.55 * k); e.fillRect(x - 6, top + r * 1.6, len, 0.8); }
        e.fillStyle = 'rgba(0,0,0,0.28)'; for (let yy = top + ((t * 8 + s) % 2); yy < top + 7; yy += 2) e.fillRect(x - 6, Math.round(yy), 12, 1);
        glow(e, x, top + 4, 13, c, 0.24 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 9, l.r * 0.45, c, I); },
    },
    rack: {
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, s = l.sd || 0;
        const body = spr('rack', 24, 44, p => p.box(0, 0, 24, 44, P_RAMP.steel, { r: 1 }));
        put(g, e, body, x, y, k);
        for (let r = 0; r < 8; r++) for (let q = 0; q < 4; q++) { const lv = (H(Math.floor(t * 4) + r * 4 + q + s) > 0.5 ? 1 : 0.35) * k; e.fillStyle = rg(c, 0.9 * lv); e.fillRect(x - 4.5 + q * 3, y - 20 + r * 2.5, 1.2, 1.2); }
        glow(e, x, y - 10, 12, c, 0.2 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 10, l.r * 0.4, c, I * 0.6); },
    },
    arc: {
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, s = Math.floor(t * 20) + (l.sd || 0);
        const post = spr('apost', 4, 8, p => p.box(0, 0, 4, 8, P_RAMP.steel, { r: 0 }));
        put(g, e, post, x - 4, y, k); put(g, e, post, x + 4, y, k);
        if (k > 0.5) { e.strokeStyle = rg(c, 0.9); e.lineWidth = 0.5; e.beginPath(); e.moveTo(x - 3, y - 4); for (let i = 1; i < 6; i++) e.lineTo(x - 3 + i, y - 4 + (H(s + i) - 0.5) * 5); e.lineTo(x + 3, y - 4); e.stroke(); }
        glow(e, x, y - 4, 10, c, 0.7 * k * (k > 0.5 ? 1 : 0.3));
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 4, l.r * 0.35, c, I); },
    },
    candle: {
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, fy = y - 9 + Math.sin(t * 11 + (l.sd || 0)) * 0.4;
        const body = spr('cbody', 6, 12, p => { p.box(0, 0, 6, 12, P_RAMP.white, { r: 1 }); p.px(3, 0, '#0b0a14'); });
        put(g, e, body, x, y, k);
        e.fillStyle = rg('#ffd27a', 0.9 * k); e.beginPath(); e.ellipse(x, fy, 1.4, 2.6, 0, 0, TAU); e.fill();
        glow(e, x, y - 8, 8, c, 0.45 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 6, l.r * 0.25, c, I); },
    },
    brazier: {
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, big = d.big ? 1.8 : 1, s = l.sd || 0;
        const basin = spr('basin', 24, 8, p => p.box(0, 0, 24, 8, P_RAMP.rust, { r: 2 }));
        put(g, e, basin, x, y, k);
        if (d.big) { line(g, x - 6, y - 1, x + 5, y - 6, '#3a2418', 1.5); line(g, x + 6, y - 1, x - 5, y - 6, '#3a2418', 1.5); }
        for (let i = 0; i < 5; i++) { const fx = x - 5 + i * 2.5, fh = (4 + H(Math.floor(t * 9) + i * 5 + s) * 6) * big * k; e.fillStyle = rg(c, 0.8); e.beginPath(); e.moveTo(fx - 1.5, y - 4); e.lineTo(fx, y - 4 - fh); e.lineTo(fx + 1.5, y - 4); e.fill(); }
        glow(e, x, y - 8, 13 * big, c, 0.4 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 8, l.r * (d.big ? 0.7 : 0.5), c, I); },
    },
    lantern: { // 灯笼用挂绳挂在墙上（绳子从挂点垂下来）
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, dx = Math.sin(t * 1.2 + (l.sd || 0)) * 3, wb = wbOf(l);
        const body = spr('lantern:' + c, 12, 16, p => { p.box(0, 0, 12, 16, P_RAMP.copper, { r: 2 }); p.rect(3, 4, 6, 8, rampOf(c)[4], true); });
        wallGlow(e, x, y + 2, wb, 16, c, 0.12 * k);
        floorGlow(e, x + dx, wb + 24, 22, c, 0.13 * k);
        line(g, x, y - 1, x + dx, y + 8, CORD, 1);
        put(g, e, body, x + dx, y + 16, k);
        glow(e, x + dx, y + 12, 7, c, 0.4 * k);
      },
      lit(l, d, t, I, c, LT) { wallLit(l, LT, c, I, { x: l.x + Math.sin(t * 1.2 + (l.sd || 0)) * 3, d: 24, R: 26, wall: 12, wk: 0.3 }); },
    },
    tent: {
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col;
        const tent = spr('tent:' + c, 56, 36, p => { for (let j = 0; j < 36; j++) { const w = Math.max(2, Math.round(56 * (j + 1) / 36)); p.box(28 - w / 2, j, w, 1, P_RAMP.cloth, { v: 0.55 }); } p.rect(24, 22, 8, 14, rampOf(c)[4], true); });
        put(g, e, tent, x, y, k);
        glow(e, x, y - 6, 15, c, 0.3 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 6, l.r * 0.5, c, I); },
    },
    led: { // 地面灯带：一根暗的细线，上面的亮段是光
      fix(g, e, l, d, t, k) { const L = l.len || 40, x = l.x, y = l.y, c = l.col, n = Math.max(2, Math.floor(L / 5)), s = l.sd || 0; line(g, x - L / 2, y, x + L / 2, y, '#0b0a14', 1); for (let i = 0; i < n; i++) { const lv = d.anim === 'chase' ? chaseLv(t, s, i, n) : 1; e.fillStyle = rg(c, 0.9 * lv * k); e.fillRect(x - L / 2 + i * (L / n) + 0.5, y - 0.5, L / n - 1, 1.5); } floorGlow(e, x, y, 8 + L * 0.35, c, 0.2 * k); },
      lit(l, d, t, I, c, LT) { const L = l.len || 40; for (let i = 0; i < 3; i++) LT(l.x - L / 2 + L * i / 2, l.y - 2, l.r * 0.35, c, I * 0.5); },
    },
    pool: { // 地面上的小灯盘（嵌在地面里，一圈暗边、中间一颗亮点）
      fix(g, e, l, d, t, k) {
        const c = l.col;
        const puck = spr('puck:' + c, 16, 6, p => { p.ell(8, 3, 8, 3, P_RAMP.dark, { flat: true }); p.ell(8, 3, 2, 1, rampOf(c), { emit: true }); });
        put(g, e, puck, l.x, l.y + 1, k);
        floorGlow(e, l.x, l.y, (l.r || 60) * 0.6, c, 0.25 * k);
      },
      lit(l, d, t, I, c, LT) { if (mountOf(d) === 'floor') poolLT(LT, l.x, l.y, l.r, c, I * 0.8); else LT(l.x, l.y, l.r, c, I * 0.8); }, // 地上的灯盘压扁；道具上的灯照旧（光源在道具的灯头上）
    },
    vent: { // 排气口：格栅落在地上，热气往上冒
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col;
        const grate = spr('vent', 24, 6, p => { p.box(0, 0, 24, 6, P_RAMP.dark, { r: 1 }); for (let i = 0; i < 4; i++) p.rect(4 + i * 5, 1, 1, 4, '#0b0a14'); });
        put(g, e, grate, x, y + 2, k);
        const q = e.createLinearGradient(0, y, 0, y - 40); q.addColorStop(0, rg(c, 0.22 * k)); q.addColorStop(1, rg(c, 0)); e.fillStyle = q; e.fillRect(x - 6, y - 40, 12, 40);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 6, l.r * 0.5, c, I); },
    },
    sweep: { // 探照灯：灯头用挂板挂在墙上，光束往下扫
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, ln = l.lenC || 150, h = (l.spread || 14) * 0.018, a = beamA(d, l, t);
        const head = spr('shead:' + c, 16, 12, p => { p.box(0, 0, 16, 12, P_RAMP.steel, { r: 2 }); p.ell(8, 9, 4, 2, rampOf(c), { emit: true }); });
        put(g, e, head, x, y + 2, k);
        const q = e.createRadialGradient(x, y, 0, x, y, ln); q.addColorStop(0, rg(c, 0.2 * k)); q.addColorStop(1, rg(c, 0)); e.fillStyle = q; e.beginPath(); e.moveTo(x, y); e.lineTo(x + Math.cos(a - h) * ln, y + Math.sin(a - h) * ln); e.lineTo(x + Math.cos(a + h) * ln, y + Math.sin(a + h) * ln); e.closePath(); e.fill();
        floorGlow(e, x + Math.cos(a) * ln * 0.9, y + Math.sin(a) * ln * 0.9, 20, c, 0.45 * k); // 光束打到地上：压扁的一块
      },
      lit(l, d, t, I, c, LT) { const ln = l.lenC || 150, a = beamA(d, l, t); poolLT(LT, l.x + Math.cos(a) * ln * 0.9, l.y + Math.sin(a) * ln * 0.9, l.r * 0.5, c, I * 1.2); },
    },
    laser: { // 激光：两端各一个发射口，挂在墙上
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, L = l.len || 120;
        const em = spr('emitter', 6, 6, p => p.box(0, 0, 6, 6, P_RAMP.steel, { r: 1 }));
        put(g, e, em, x - L / 2 + 1, y + 2, 1); put(g, e, em, x + L / 2 - 1, y + 2, 1);
        e.strokeStyle = rg(c, 0.9 * k); e.lineWidth = 1; e.beginPath(); e.moveTo(x - L / 2, y); e.lineTo(x + L / 2, y); e.stroke();
        if (d.anim === 'scan') { const px = x - L / 2 + L * ((t * 0.6 + (l.sd || 0)) % 1); e.fillStyle = rg(c, k); e.fillRect(px - 1, y - 1, 3, 2); glow(e, px, y, 8, c, 0.5 * k); }
      },
      lit(l, d, t, I, c, LT) { const L = l.len || 120; for (let i = 0; i < 3; i++) LT(l.x - L / 2 + L * i / 2, l.y, l.r * 0.3, c, I * 0.5); },
    },
    window: { // 窗户：窗框画在墙上，透进来的光落在地上
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, s = l.sd || 0;
        const frame = spr('winfr', 44, 32, p => { p.box(0, 0, 44, 32, P_RAMP.dark, { r: 1 }); p.rect(21, 2, 2, 28, '#0b0a14'); p.rect(2, 16, 40, 2, '#0b0a14'); });
        put(g, e, frame, x, y, k);
        for (let i = 0; i < 4; i++) { const px = x - 10 + i * 6 + Math.sin(t * 0.5 + i + s) * 2, a = (0.5 + 0.5 * H(Math.floor(t) + i)) * 0.14 * k; e.fillStyle = rg(c, a); e.fillRect(px, y + 2, 4, 10); }
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y + 6, l.r * 0.9, c, I * 0.7); },
    },
    fill: { // 补光：没有灯具，按老灯的位置和半径铺一片柔光（亮度和老灯一样：老灯约 a，这里 I 里乘过 GAIN）
      lit(l, d, t, I, c, LT) { LT(l.x, l.y + (l.oy || 0), l.r || 80, c, I * 0.55); },
    },
    moon: { // 月亮在天上（只在露天的场景里出现）
      fix(g, e, l, d, t, k) { e.fillStyle = rg(l.col, 0.3 * k); e.beginPath(); e.arc(l.x, l.y - 40, 12, 0, TAU); e.fill(); glow(e, l.x, l.y - 40, 40, l.col, 0.25 * k); },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 40, l.r * 1.1, c, I * 0.5); },
    },
    holo: { // 全息投影仪立在地上，光柱从它上面升起来
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col, Hh = 30, s = l.sd || 0;
        const base = spr('hbase', 20, 4, p => p.box(0, 0, 20, 4, P_RAMP.steel, { r: 1 }));
        put(g, e, base, x, y, k);
        e.fillStyle = rg(c, 0.06 * k); e.fillRect(x - 7, y - 2 - Hh, 14, Hh); e.fillStyle = rg(c, 0.05 * k); for (let i = 0; i < Hh; i += 3) e.fillRect(x - 7, y - 2 - Hh + i, 14, 0.7);
        const yb = y - 2 - Hh + ((t * 18 + s) % Hh); e.fillStyle = rg(c, 0.8 * k); e.fillRect(x - 7, yb, 14, 2);
        glow(e, x, y - 15, 12, c, 0.14 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 15, l.r * 0.6, c, I * 0.7); },
    },
    orb: { // 立在台座上的光球
      fix(g, e, l, d, t, k) {
        const x = l.x, y = l.y, c = l.col;
        const ped = spr('ped', 16, 6, p => p.box(0, 0, 16, 6, P_RAMP.steel, { r: 1 }));
        put(g, e, ped, x, y, k);
        const ball = spr('ball:' + c, 16, 16, p => p.ell(8, 8, 8, 8, rampOf(c), { emit: true }));
        put(g, e, ball, x, y - 4, k);
        glow(e, x, y - 8, 10, c, 0.55 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 8, l.r * 0.6, c, I); },
    },
    caustic: { // 水面反光：地面上一小汪水，光斑在水里晃
      fix(g, e, l, d, t, k) {
        const c = l.col;
        const puddle = spr('puddle', 104, 20, p => p.ell(52, 10, 52, 10, P_RAMP.glass, { flat: true }));
        put(g, e, puddle, l.x, l.y + 6, k);
        blobs(l, t).forEach(([bx, by], i) => { e.fillStyle = rg(c, 0.14 * k); e.beginPath(); e.ellipse(bx, by, 6 + 2 * Math.sin(t + i), 2.5, 0, 0, TAU); e.fill(); });
      },
      lit(l, d, t, I, c, LT) { for (const [bx, by] of blobs(l, t)) LT(bx, by, l.r * 0.3, c, I * 0.3); },
    },
    fog: { // 雾从地上的小机器里冒出来
      fix(g, e, l, d, t, k) { const x = l.x, y = l.y; const m = spr('fogm', 16, 6, p => p.box(0, 0, 16, 6, P_RAMP.steel, { r: 1 })); put(g, e, m, x, y, k); floorGlow(e, x, y - 2, 64, l.col, 0.14 * k); glow(e, x, y - 6, 18, l.col, 0.08 * k); },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 8, l.r * 1.2, c, I * 0.4); },
    },
    wash: { // 墙面变色灯：贴着墙顶的灯带，颜色往下淌
      fix(g, e, l, d, t, k) { const x = l.x, y = l.y, c = hue(d, l, t), wb = wbOf(l); line(g, x - 20, y - 6, x + 20, y - 6, '#0b0a14', 1); wallGlow(e, x, y - 4, wb, 44, c, 0.22 * k); floorGlow(e, x, wb + 10, 40, c, 0.08 * k); },
      lit(l, d, t, I, c, LT) { wallLit(l, LT, c, I * 0.8, { d: 12, R: 44, wall: 36, wk: 0.6, fk: 0.4 }); },
    },
    haze: { // 热浪从地上的热管里冒出来
      fix(g, e, l, d, t, k) {
        const c = l.col;
        const pipe = spr('hazeb', 20, 4, p => p.box(0, 0, 20, 4, P_RAMP.steel, { r: 1 }));
        put(g, e, pipe, l.x, l.y, k);
        for (let i = 0; i < 3; i++) { e.strokeStyle = rg(c, 0.12 * k); e.lineWidth = 0.6; e.beginPath(); for (let j = 0; j <= 12; j++) { const yy = l.y - 2 - j * 3, xx = l.x + Math.sin(t * 3 + j * 0.9 + i) * 2 * (j / 12) + (i - 1) * 2; if (j) e.lineTo(xx, yy); else e.moveTo(xx, yy); } e.stroke(); }
        glow(e, l.x, l.y - 4, 10, c, 0.22 * k);
      },
      lit(l, d, t, I, c, LT) { LT(l.x, l.y - 6, l.r * 0.5, c, I * 0.6); },
    },
  };

  // ── 挑效果、套到灯上
  // 老的灯只有 col / r / a；套上 fx 以后按效果改颜色、半径、长度。keep 的效果不改颜色
  function apply(l, name, sd) {
    const d = FX[name]; if (!d) return null;
    l.fx = name; l.sd = sd;
    if (!d.keep && d.col) l.col = d.col;
    if (d.col2) l.col2 = d.col2;
    if (d.rm) l.r = (l.r || 60) * d.rm;
    if (d.len != null) l.len = d.len;
    if (d.spread != null) l.spread = d.spread;
    if (d.lenC != null) l.lenC = d.lenC;
    return d;
  }
  // 照明总增益：效果有暗的时候（闪、灭、渐暗），平均亮度要和老灯一样（老灯平均约 0.8）
  const GAIN = 1.6;
  // 画灯具（draw.js 在站内画灯具的地方调）：先画安装的东西（挂板 / 挂杆），再画灯具；art 的灯只画招牌上会亮的部分
  function fixture(ctx, ex, l, time) {
    const d = FX[l.fx]; if (!d) return;
    const m = mountOf(d), S = SH[d.shape];
    const k = level(d, l, time);
    if (m === 'art') { if (S.art) S.art(ctx, ex, l, d, time, k); return; }
    if (m === 'wall' && !NO_PLATE.has(d.shape)) wallSupport(ctx, ex, l, attachPts(l, d));
    if (m === 'floor' && FLOOR_POOL.has(d.shape)) floorGlow(ex, l.x, l.y + 1, footR(l), hue(d, l, time), 0.08 * k); // 脚下的光斑
    S.fix(ctx, ex, l, d, time, k);
  }
  const NO_PLATE = new Set(['festoon', 'exit']); // 灯串自己带挂钩、EXIT 牌直接贴墙，不画挂板挂杆
  // 照亮的光（draw.js 在照明的地方调）
  function light(l, time, LT) {
    const d = FX[l.fx];
    if (!d) { LT(l.x, l.y + (l.oy || 0), l.r, l.col, l.a); return; }
    const k = level(d, l, time), I = (l.a == null ? 0.85 : l.a) * k * (d.am || 1) * GAIN, c = hue(d, l, time);
    SH[d.shape].lit(l, d, time, I, c, LT);
    if (mountOf(d) === 'floor' && FLOOR_POOL.has(d.shape)) poolLT(LT, l.x, l.y + 1, footR(l) * 1.4, c, I * 0.35);
  }

  // ── 站里的灯：每盏灯属于哪一类（决定候选表和安装方式）
  //   sign 招牌（墙上的招牌，美术图里）；track 轨道灯；tunnel 隧道口；prop 环境道具上的灯（道具美术里）；
  //   open 露天；room 房间里的天花板灯 / 墙灯；other 其他（走廊节点等）
  function kindOf(F, l) {
    if (l.kind) return l.kind; // 挑效果的时候记下来的（之后灯可能挪了位置，不能再按位置猜）
    if (F.open) return 'open';
    if ((F.signs || []).some(s => s.x === l.x && s.y + 10 === l.y)) return 'sign';
    if (F.track && l.y === (F.track.y0 + 2) * TS) return 'track';
    if ((F.tunnels || []).some(t => t.x === l.x && t.y === l.y)) return 'tunnel';
    if ((F.props || []).some(p => p.light && p.light.x === l.x && p.light.y === l.y)) return 'prop';
    if (l.shaft) return 'room';
    return 'other';
  }
  // 房间的候选：天花板（墙上）挂的灯和立在地上的灯都能用；招牌、月亮、只发光的小灯不放进房间（它们要有美术图才立得住）
  const ROOM_FX = {
    hall: ['cone_warm', 'cone_cold', 'chandelier', 'tube_flicker', 'cone_dust', 'cone_broken', 'downlight', 'cone_fade', 'tube_warm', 'floor_chase'],
    platform: ['cone_warm', 'cone_dim', 'tube_flicker', 'cone_pulse', 'hang_bulb', 'exit_green', 'cone_wide', 'tube_dying', 'cone_dust', 'stair_nosing'],
    ticket: ['tube_cold', 'tube_pair', 'downlight', 'downlight_flicker', 'screen_term', 'spot_narrow', 'cone_cold'],
    shop: ['tube_cold', 'spot_drift', 'downlight', 'tube_warm', 'cone_wide'],
    security: ['screen_blue', 'beacon_red', 'beacon_double', 'tube_flicker', 'downlight', 'alarm_pulse', 'hazard_stripe', 'police_alt', 'patrol_pan'],
    medic: ['tube_hospital', 'tube_buzz', 'tube_pair', 'downlight', 'tube_cold', 'screen_term'],
    storage: ['tube_flicker', 'tube_dying', 'cone_broken', 'tube_buzz', 'downlight', 'cone_dim', 'hang_swing', 'underglow'],
    workshop: ['arc_spark', 'tube_buzz', 'spot_narrow', 'cone_dim', 'tube_flicker', 'brazier', 'hazard_stripe', 'rack_led', 'vent_up'],
    power: ['arc_spark', 'tube_dying', 'strobe_red', 'cone_broken', 'rack_led', 'hazard_stripe', 'screen_flash'],
    control: ['screen_blue', 'screen_term', 'rack_led', 'hologram', 'tube_cold', 'downlight', 'sweep_cyan'],
    factory: ['searchlight', 'cone_warm', 'cone_broken', 'hazard_stripe', 'arc_spark', 'beacon_rotate', 'brazier', 'gutter_green'],
    secure: ['laser_scan', 'laser_static', 'beacon_red', 'spot_narrow', 'screen_blue', 'hazard_stripe'],
    hidden: ['candle', 'ember_dying', 'tube_dying', 'cone_dim', 'lantern_swing'],
    vault: ['chandelier', 'spot_narrow', 'downlight', 'aurora', 'cone_warm', 'spot_drift'],
    server: ['rack_led', 'screen_blue', 'hologram', 'tube_cold', 'screen_flash', 'arc_spark', 'plasma_orb'],
    jewelry: ['chandelier', 'spot_drift', 'aurora', 'downlight', 'spot_narrow', 'tube_cold'],
    gallery: ['spot_narrow', 'downlight', 'spot_drift', 'window_light', 'cone_warm', 'chandelier'],
    arsenal: ['tube_buzz', 'beacon_red', 'spot_narrow', 'cone_warm', 'alarm_pulse', 'strobe_red'],
    waithall: ['chandelier', 'hang_bulb', 'hang_swing', 'tube_warm', 'cone_broken', 'cone_dust', 'cone_wide'],
    canteen: ['tube_flicker', 'hang_bulb', 'festoon_chase', 'cone_warm', 'candle', 'lantern_swing'],
    tents: ['candle', 'lantern_swing', 'tent_glow', 'campfire', 'brazier', 'tube_dim'],
    barter: ['festoon_chase', 'spot_drift', 'tube_warm', 'lantern_swing', 'downlight'],
    fixshop: ['tube_buzz', 'arc_spark', 'spot_drift', 'lantern_swing', 'downlight', 'tube_flicker', 'screen_flash'],
    nursery: ['festoon', 'hang_bulb', 'candle', 'downlight', 'tube_warm', 'cone_pulse'],
    memwall: ['screen_term', 'tube_dim', 'cone_dim', 'candle', 'downlight', 'window_light'],
    radio: ['screen_term', 'screen_blue', 'candle', 'rack_led', 'screen_flash', 'tube_dim'],
    gatehouse: ['beacon_red', 'exit_green', 'exit_flicker', 'tube_flicker', 'downlight', 'police_alt', 'hazard_stripe'],
  };
  const ROLE_FX = {
    track: ['track_red', 'track_warn', 'track_chase'],                                  // 轨道边的红灯（贴着地面）
    sign: ['neon_steady', 'neon_buzz', 'neon_flicker', 'neon_dead', 'neon_breathe', 'neon_chase', 'neon_heart', 'neon_scan'], // 招牌
    art: ['lamp_glow', 'lamp_pulse', 'lamp_flicker'],                                   // 道具、隧道口：只发光
    open: ['moon_glow', 'fog_pool', 'window_light', 'caustic', 'heat_haze'],            // 露天
    default: ['cone_warm', 'cone_cold', 'downlight', 'tube_flicker', 'tube_buzz', 'cone_dust', 'cone_broken', 'cone_dim', 'cone_pulse', 'cone_fade', 'hang_bulb', 'spot_narrow', 'candle', 'tube_cold', 'tube_warm', 'screen_term', 'rack_led', 'lantern_swing', 'chandelier'], // 走廊里不放帐篷、火盆、电弧桩
  };
  // FNV-1a：字符串 → 无符号整数（挑效果用，不碰关卡的随机数）
  function hs(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pickOf = (list, key) => list[hs(key) % list.length];
  function roomAt(F, x, y) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    for (const dy of [0, 1, 2, -1, 3]) {
      const ty2 = ty + dy; if (tx < 0 || ty2 < 0 || tx >= F.tw || ty2 >= F.tht) continue;
      const ri = F.room[ty2 * F.tw + tx]; if (ri >= 0 && F.rooms[ri]) return F.rooms[ri];
    }
    return null;
  }
  // 挂得住吗：墙挂的灯，挂点上方要是墙；窗户要在墙里；立在地上的，底座下面要是地面
  const tileKind = (F, x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return tx < 0 || ty < 0 || tx >= F.tw || ty >= F.tht ? -9 : F.kind[ty * F.tw + tx]; };
  const isWall = kd => kd === 1 || kd === 3;
  // 立面：墙脚上面那格是墙、下面那格是地面（朝着镜头的那面墙）。墙上的灯只挂在立面上，
  // 整个灯具（灯管、灯串、激光两头）横跨的每一段下面都得是地面，不能伸出房间、挂到黑的墙顶上
  const facade = (F, x, wb) => isWall(tileKind(F, x, wb - 8)) && tileKind(F, x, wb + 8) === 0;
  function supportOk(F, l, d) {
    const m = mountOf(d);
    if (m === 'wall') {
      const wb = wbFrom(l.y), pts = attachPts({ x: l.x, y: wb - 4, len: d.len }, d);   // 墙上的灯统一挂在墙脚往上 4（dressFloor 里挪过去）
      if (!pts.every(([ax, ay]) => isWall(tileKind(F, ax, ay - 9)))) return false;
      const xs = pts.map(p => p[0]).concat(l.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
      for (let x = x0; x <= x1 + 0.01; x += 8) if (!facade(F, x, wb)) return false;
      return facade(F, x1, wb);
    }
    if (m === 'self' && d.shape === 'window') return isWall(tileKind(F, l.x, l.y - 8));
    if (m === 'floor') return tileKind(F, l.x, l.y + (l.shaft ? 4 : 2)) === 0;
    return true;
  }
  // ── 摆灯（第四轮，用户："灯的位置太诡异了"）：
  //   生成站的时候很多灯只是一个光点（走廊路口、站台一排、灯串上的灯泡、火盆的火光）。以前挂不上墙就地换成
  //   一件随机的落地灯具，于是桌子显示器、帐篷、机柜立在站台正中间、压在沙袋上，火盆上又多一根蜡烛。现在：
  //   1. 装饰自带的光（灯串、火盆、炉子、篝火……）只让装饰发光，不另配灯具；
  //   2. 天花板灯挂不上，就往上 / 左右找最近的立面挂过去；
  //   3. 落地灯具（屏幕桌、机柜、火盆、蜡烛……）只靠墙放：背贴立面、站在墙前那一格，不压道具、装饰、容器、楼梯；
  //   4. 同一面墙上的灯留间距，落地灯具之间也留间距；
  //   5. 哪儿都放不下，就只留一片补光（看不见灯具，等于镜头外的天花板灯），房间亮度照旧。
  const LIT_DECOR = new Set(['string', 'brazier', 'fire', 'stove', 'bell', 'lamp']); // 自己会亮的装饰
  function decorLit(F, l) {
    for (const d of F.decor || []) {
      if (!LIT_DECOR.has(d.k)) continue;
      if (d.w) { if (l.x >= d.x - 4 && l.x <= d.x + d.w + 4 && Math.abs(l.y - d.y) <= 16) return true; }
      else if (Math.hypot(l.x - d.x, l.y - d.y) <= 26) return true;
    }
    return false;
  }
  // 占地方的东西（世界坐标矩形 x0, y0, x1, y1）：道具、地上的装饰、容器、楼梯、隧道口、招牌
  const OVERHEAD = new Set(['string', 'awning', 'laundry', 'chalk']); // 头顶上的 / 画在地上的，不挡灯具
  function blockersOf(F) {
    const out = [];
    for (const p of F.props || []) out.push([p.x - p.w / 2 - 2, p.y - Math.min(p.h || 16, 40), p.x + p.w / 2 + 2, p.y + 4]);
    for (const d of F.decor || []) { if (OVERHEAD.has(d.k)) continue; const x0 = d.w ? d.x : d.x - 14, x1 = d.w ? d.x + d.w : d.x + 14; out.push([x0, d.y - 22, x1, d.y + 6]); }
    for (const c of F.contSpots || []) out.push([c.x - 14, c.y - 20, c.x + 14, c.y + 4]);
    for (const s of F.stairs || []) out.push([s.x - 34, s.y - 36, s.x + 34, s.y + 26]);
    for (const t of F.tunnels || []) out.push([t.x - 28, t.y - 40, t.x + 28, t.y + 10]);
    for (const s of F.signs || []) out.push([s.x - 14, s.y - 12, s.x + 14, s.y + 12]);
    return out;
  }
  const hits = (B, x0, y0, x1, y1) => B.some(b => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);
  const isFloor = (F, x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); if (tx < 0 || ty < 0 || tx >= F.tw || ty >= F.tht) return false; const i = ty * F.tw + tx; return F.kind[i] === 0 && !F.solid[i]; };
  // 这一列往上找最近的立面（中间一路都是地面，不穿墙）：返回墙脚 wb，没有就 null
  function facadeAbove(F, x, y) {
    let ty = Math.floor((y + 4) / TS);
    if (!isFloor(F, x, ty * TS + 8)) ty++;               // 灯在墙根线上：从下面那格地面开始
    for (let n = 0; n < 6; n++, ty--) {
      if (tileKind(F, x, ty * TS + 8) !== 0) return null;
      if (isWall(tileKind(F, x, ty * TS - 8))) return ty * TS;
    }
    return null;
  }
  const halfW = (d, l) => (d.shape === 'strip' || d.shape === 'festoon' || d.shape === 'laser') ? (l.len || d.len || 34) / 2 : d.shape === 'chand' ? 13 : d.shape === 'exit' || d.shape === 'wash' ? 12 : 7;
  const DX = [0, 8, -8, 16, -16, 24, -24, 32, -32, 40, -40, 48, -48];
  const WALL_GAP = 40, FLOOR_GAP = 40;
  // 墙上的灯在 (x, wb) 挂得住、不挡招牌和靠墙的道具、和同一面墙上的灯隔得开吗
  function wallFits(F, B, placed, d, x, wb) {
    if (!supportOk(F, { x, y: wb - 4 }, d)) return false;
    const h = halfW(d, { len: d.len });
    if (hits(B, x - h, wb - FACE, x + h, wb - 1)) return false;
    return !placed.wall.some(o => o.wb === wb && Math.abs(o.x - x) < Math.max(WALL_GAP, o.h + h + 10));
  }
  // 落地灯具：脚落在墙前那一格（背贴立面），整张桌子 / 整个台座底下都是地面，不压东西，和别的落地灯具、墙灯正下方隔开
  const FOOT = 9, FLAT_SHAPES = new Set(['led', 'stripe', 'pool', 'caustic']); // 贴地的灯带、警示条、灯盘、水洼：贴着墙脚（墙脚往下 3）
  function floorFits(F, B, placed, x, wb) {
    const y = wb + FOOT;
    if (!isFloor(F, x - 11, y) || !isFloor(F, x + 11, y) || !isFloor(F, x, y)) return false;
    if (hits(B, x - 13, y - 24, x + 13, y + 4)) return false;
    if (placed.floor.some(o => Math.hypot(o.x - x, o.y - y) < FLOOR_GAP)) return false;
    return !placed.wall.some(o => o.wb === wb && Math.abs(o.x - x) < o.h + 12);
  }
  // 在灯附近找位置：先原地那一列，再左右挪（最多 48）；每列都往上找最近的立面
  function findSpot(F, B, placed, l, d) {
    const wall = mountOf(d) === 'wall';
    for (const dx of DX) {
      const x = l.x + dx, wb = facadeAbove(F, x, l.y);
      if (wb == null) continue;
      if (wall ? wallFits(F, B, placed, d, x, wb) : floorFits(F, B, placed, x, wb)) return { x, wb };
    }
    return null;
  }
  // 只留补光的灯：没有灯具，光照原来的位置铺（亮度和老的灯一样）
  const FILL = 'fill_soft';
  function dressFloor(F, st) {
    const base = st.id + '|' + F.name, B = blockersOf(F), placed = { wall: [], floor: [] };
    F.lights.forEach((l, i) => {
      if (l.fx) return;
      const key = base + '|' + i;
      let k = kindOf(F, l);
      if ((k === 'room' || k === 'other') && decorLit(F, l)) k = 'prop';   // 装饰自带的光：只让装饰发光
      l.kind = k;
      let list;
      if (k === 'sign') list = ROLE_FX.sign;
      else if (k === 'track') { list = ROLE_FX.track; if (tileKind(F, l.x, l.y) !== 2) l.x = Math.min(F.tw - 3, Math.floor(l.x / TS)) * TS + 8; } // 轨道灯：最右边那盏落在墙上的，挪回轨道上
      else if (k === 'tunnel' || k === 'prop') list = ROLE_FX.art;
      else if (k === 'open') list = ROLE_FX.open;
      else if (k === 'room') { const room = roomAt(F, l.x, l.y + (l.oy || 0)); list = room && ROOM_FX[room.kind] ? ROOM_FX[room.kind] : ROLE_FX.default; }
      else list = ROLE_FX.default;
      let name = pickOf(list, key), d = FX[name];
      if (k === 'open') {
        if (!supportOk(F, { x: l.x, y: l.y, shaft: !!l.shaft }, d)) { name = 'moon_glow'; d = FX[name]; } // 露天的灯挂不住就当成天上的光
      } else if (k === 'room' || k === 'other') {
        // 先用挑中的那种找位置；不行就按候选表里别的墙灯、落地灯依次试（顺序按哈希打乱，各站不一样）；都不行只留补光
        const alt = list.filter(n => n !== name && (mountOf(FX[n]) === 'wall' || mountOf(FX[n]) === 'floor'))
          .sort((a, b) => hs(key + a) - hs(key + b));
        let spot = null;
        for (const n of [name, ...alt]) {
          const m = mountOf(FX[n]);
          if (m === 'self' && n === name && supportOk(F, l, FX[n])) { spot = 'self'; break; } // 窗户：本来就嵌在墙里
          if (m !== 'wall' && m !== 'floor') continue;
          spot = findSpot(F, B, placed, l, FX[n]); if (spot) { name = n; break; }
        }
        d = FX[spot ? name : FILL];
        if (!spot) { name = FILL; l.kind = 'fill'; }
        else if (spot === 'self') { /* 原地 */ }
        else if (mountOf(d) === 'wall') { l.x = spot.x; l.wb = spot.wb; l.y = spot.wb - 4; placed.wall.push({ x: l.x, wb: l.wb, h: halfW(d, { len: d.len }) }); }
        else { l.x = spot.x; l.y = spot.wb + (FLAT_SHAPES.has(d.shape) ? 3 : FOOT); l.wb = spot.wb; l.oy = 0; placed.floor.push({ x: l.x, y: spot.wb + FOOT }); }
      }
      apply(l, name, (hs(key) % 997) / 31);
      // 墙上的灯（招牌以外的老路子）：记下墙脚，灯具挂在立面上墙脚往上 4 的地方
      if (mountOf(d) === 'wall' && l.wb == null) { l.wb = wbFrom(l.y); l.y = l.wb - 4; }
    });
  }
  // 包在 D.makeStation 外面：站生成完再给灯挑效果（教学站不挑，教学脚本要的画面不动）
  const mk0 = D.makeStation;
  D.makeStation = function (rng, st, opt) {
    const floors = mk0.apply(this, arguments);
    if (!opt || !opt.tut) for (const F of floors) dressFloor(F, st);
    return floors;
  };

  // ── 单独画一种效果（图鉴用）：一个 320×180 的小房间；墙上的灯挂在墙上，地上的灯放在地上
  function frame(name, time) {
    const d = FX[name], Z = D.Z, Post = D.Post, [c, g] = D.canvas(D.W, D.H), m = mountOf(d);
    // 墙上的灯、地上的灯：和站里一样，黑的墙顶 + 一格立面（墙脚 y=106）+ 地面；招牌、窗户、月亮：一整面高墙
    const fl = m === 'floor', wl = m === 'wall', low = fl || wl, WB = 106, x0 = 160, y0 = fl ? 132 : wl ? WB - 4 : 40;
    const l = { x: x0, y: y0, oy: fl ? 0 : 40, r: 100, col: d.col || '#ffb057', a: 0.85 };
    if (wl) l.wb = WB;
    apply(l, name, 7.3);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05050a'; g.fillRect(0, 0, D.W, D.H);
    g.setTransform(Z, 0, 0, Z, 0, 0);
    if (low) { g.fillStyle = '#0b0c14'; g.fillRect(0, 0, 320, WB - 16); g.fillStyle = '#1d2030'; g.fillRect(0, WB - 16, 320, 16); g.fillStyle = '#0a0b12'; g.fillRect(0, WB - 16, 320, 1.5); g.fillStyle = '#12141f'; g.fillRect(0, WB - 2.5, 320, 2.5); g.fillStyle = '#20232e'; g.fillRect(0, WB, 320, 180 - WB); }
    else { g.fillStyle = '#15171f'; g.fillRect(0, 0, 320, 122); g.fillStyle = '#20232e'; g.fillRect(0, 122, 320, 58); g.fillStyle = '#0a0b10'; g.fillRect(0, 0, 320, 14); }
    // 美术图里已经画好的东西（招牌板、道具箱）：图鉴里补上，让灯看着有地方附着（只是图鉴的背景）
    if (m === 'art' && d.shape === 'sign') { g.fillStyle = '#0d0e18'; g.fillRect(x0 - 7, y0 - 10, 14, 12); }
    else if (m === 'art') { g.fillStyle = '#2a2420'; g.fillRect(x0 - 9, y0 - 22, 18, 22); }
    Post.ex.setTransform(1, 0, 0, 1, 0, 0); Post.ex.clearRect(0, 0, D.W, D.H); Post.ex.setTransform(Z, 0, 0, Z, 0, 0);
    fixture(g, Post.ex, l, time);
    const LT = (x, y, r, col, a) => Post.addLight(x * Z, y * Z, r * Z, col, a);
    light(l, time, LT);
    g.setTransform(1, 0, 0, 1, 0, 0);
    Post.render(g, '#2a2c3a', {});
    return c;
  }
  // 一张图：所有效果排成格子，每格左下角是编号（编号对应 D.LFX.names 的顺序）
  function sheet(time) {
    const names = Object.keys(FX), cols = 10, tw = 128, th = 72, rows = Math.ceil(names.length / cols);
    const [c, g] = D.canvas(cols * tw, rows * th);
    names.forEach((n, i) => {
      const f = frame(n, time), x = (i % cols) * tw, y = Math.floor(i / cols) * th;
      g.drawImage(f, x, y, tw, th);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y + th - 8, 14, 8);
      D.text(g, String(i + 1), x + 2, y + th - 7, '#ffffff', { shadow: false });
    });
    return c;
  }

  D.LFX = { FX, SH, ANIM, ROOM_FX, ROLE_FX, names: Object.keys(FX), level, hue, apply, fixture, light, dress: dressFloor, frame, sheet, mountOf, kindOf, attachPts, GAIN };
})(D);
