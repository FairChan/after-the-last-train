/* Underdog：语言层的挂钩（在界面文件之后、main.js 之前加载）。
   - 设置里加一行"语言 / Language"（中文 / English），存在 D.settings.lang。
   - 切换后把当前画面重画一遍（标题、据点、出发准备、线路图、站里、结算），开着的设置窗口也重开。
   - 站名是"字 + 字 + 后缀"拼出来的，英文用拼音 + 方位词（金庭东 → Jinting East），城市生成时登记进词典。
   - 样式表里写死的中文（租来的格子角标"租"）在英文下换掉。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const I = D.I18N;

  // ── 站名：拼音 + 后缀
  const PY = {
    金: 'jin', 南: 'nan', 旧: 'jiu', 岚: 'lan', 水: 'shui', 机: 'ji', 东: 'dong', 纺: 'fang', 电: 'dian', 青: 'qing', 北: 'bei', 环: 'huan', 冷: 'leng', 七: 'qi', 柳: 'liu',
    铸: 'zhu', 中: 'zhong', 星: 'xing', 调: 'diao', 白: 'bai', 石: 'shi', 铁: 'tie', 新: 'xin', 西: 'xi', 云: 'yun', 港: 'gang', 江: 'jiang', 花: 'hua', 工: 'gong', 望: 'wang',
    长: 'chang', 春: 'chun', 霞: 'xia', 松: 'song', 桥: 'qiao', 庭: 'ting', 栈: 'zhan', 街: 'jie', 川: 'chuan', 门: 'men', 库: 'ku', 堤: 'di', 台: 'tai', 仓: 'cang', 城: 'cheng',
    闸: 'zha', 岸: 'an', 坊: 'fang', 塔: 'ta', 路: 'lu', 场: 'chang', 口: 'kou', 湾: 'wan', 园: 'yuan', 村: 'cun', 坪: 'ping', 坡: 'po', 湖: 'hu', 巷: 'xiang', 厂: 'chang', 河: 'he', 山: 'shan',
  };
  const SUF = { '': '', 站: '', 东: ' East', 西: ' West', 南: ' South', 北: ' North', 广场: ' Square', 大道: ' Avenue', 公园: ' Park' };
  I.stationName = function (zh) {
    if (I.has(zh)) return null;
    const a = PY[zh[0]], b = PY[zh[1]]; if (!a || !b) return null;
    const suf = zh.slice(2); if (!(suf in SUF)) return null;
    const w = a + (/^[aeo]/.test(b) ? "'" : '') + b;
    return w[0].toUpperCase() + w.slice(1) + SUF[suf];
  };
  function registerCity(C) {
    if (!C || !C.stations) return; const add = {};
    for (const s of C.stations) { if (!s || !s.name || add[s.name]) continue; const e = I.stationName(s.name); if (e) add[s.name] = e; }
    I.add(add);
  }
  I.registerCity = registerCity;
  if (D.makeCity) { const mk = D.makeCity; D.makeCity = function () { const C = mk.apply(this, arguments); try { registerCity(C); } catch (e) { console.error(e); } return C; }; }

  // ── 地区名（map.js）：两个字 + 后缀，画成字间空一格的水印；英文是大写拼音 + 后缀（丰浦老城 → FENGPU OLD TOWN）
  const DPY = { 鹤: 'he', 樟: 'zhang', 梅: 'mei', 桐: 'tong', 沙: 'sha', 渡: 'du', 泉: 'quan', 枫: 'feng', 荷: 'he', 苇: 'wei', 杉: 'shan', 榕: 'rong', 芦: 'lu', 槐: 'huai', 雁: 'yan', 兰: 'lan', 丰: 'feng', 安: 'an', 宁: 'ning', 鲤: 'li', 莲: 'lian', 竹: 'zhu',
    岭: 'ling', 洲: 'zhou', 浦: 'pu', 岗: 'gang', 埠: 'bu', 塘: 'tang', 原: 'yuan', 津: 'jin', 汀: 'ting', 屿: 'yu', 滩: 'tan', 营: 'ying' };
  const DSUF = { 工业区: 'Industrial Zone', 货场: 'Freight Yard', 厂区: 'Works', 新区: 'New District', 商圈: 'Mall', 广场: 'Plaza', 老城: 'Old Town', 旧街: 'Old Street', 里: 'Quarter',
    区: 'District', 片区: 'Ward', 新村: 'New Village', 中心区: 'Central District', 中央城: 'Central City', 金融城: 'Financial City' };
  I.districtName = zh => zh === '无名区' ? 'UNNAMED DISTRICT' : DPY[zh[0]] && DPY[zh[1]] && DSUF[zh.slice(2)] ? (DPY[zh[0]] + DPY[zh[1]] + ' ' + DSUF[zh.slice(2)]).toUpperCase() : null;
  if (D.cityDistricts) { const cd = D.cityDistricts; D.cityDistricts = function () { const out = cd.apply(this, arguments); try { const add = {}; for (const d of out || []) { const e = I.districtName(d.name); if (e) { add[d.name] = e; add[[...d.name].join(' ')] = e; } } I.add(add); } catch (e) { console.error(e); } return out; }; }

  // ── 首饰的"银 / 金"前缀是单字（单字不进词典，免得"金"把别的词拆坏），拼好的名字在这里登记
  // 生成的战利品名字是"前缀 + 本名"，逐字最长匹配有时会切错（"精密轴承座"先认出了"精密轴承"）：这里按前缀 + 本名拼好登记
  { const add = {}, PRE = { 银: 'Silver', 金: 'Gold' }, ZH = /[㐀-鿿]/;
    for (const id in D.ITEMS || {}) {
      const it = D.ITEMS[id], n = it && it.name; if (!n || !it.gen || I.has(n)) continue;
      if (PRE[n[0]] && it.gen === 'jw') { add[n] = PRE[n[0]] + ' ' + I.peek(n.slice(1)); continue; }
      if (!ZH.test(I.peek(n))) continue;
      for (let k = 1; k < n.length; k++) if (I.has(n.slice(0, k)) && I.has(n.slice(k))) { add[n] = I.peek(n.slice(0, k)) + ' ' + I.peek(n.slice(k)); break; }
    }
    I.add(add); }

  // ── 切换后重画当前画面
  function rerender() {
    const G = D.Game, U = D.UI; if (!G || !U || !U.title) return;
    const had = !!document.querySelector('#ui .modal.settings');
    try {
      if (G.pf && G.pf.city) registerCity(G.pf.city);
      if (G.raid && G.raid.city) registerCity(G.raid.city);
      switch (G.mode) {
        case 'title': U.title(); break;
        case 'hub': U.hub(G.pf, G.tab); break;
        case 'brief': U.brief(G.pf, G.briefAt); break;
        case 'travel': U.travel(G.raid, G.hover); break;
        case 'station': U.station(G.S); if (G.S && G.S.talk) U.talkRender(G.S); break; // 对话面板（ui-metro.js）跟着重画
        case 'result': U.result(G.out, G.raid); break;
        default: I.walk(document.getElementById('ui'));
      }
    } catch (e) { console.error(e); }
    if (had && U.settings) U.settings();
  }
  I.onChange(rerender);
  I.rerender = rerender;

  // 设置读进来以后按设置里的语言来（网址上带了 ?lang= 就按网址）
  const ap0 = D.applySettings;
  D.applySettings = function () {
    const r = ap0 ? ap0.apply(this, arguments) : undefined;
    const want = I.urlLang || (D.settings && D.settings.lang);
    if (want && want !== I.lang) I.set(want);
    return r;
  };

  // ── 设置里的"语言 / Language"
  if (D.UI && D.UI.settings) {
    const us = D.UI.settings;
    D.UI.settings = function () {
      const r = us.apply(this, arguments);
      const box = document.querySelector('#ui .modal.settings .mbox'), first = box && box.querySelector('.set-group');
      if (first && !box.querySelector('[data-lang]')) {
        const g = document.createElement('div'); g.className = 'set-group'; g.setAttribute('data-notr', '');
        const cur = I.lang;
        g.innerHTML = `<label class="set-row tog"><span>语言 / Language</span><select data-lang>${[['zh', '中文'], ['en', 'English']].map(([v, n]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${n}</option>`).join('')}</select><em class="dim"></em></label>`;
        first.parentNode.insertBefore(g, first);
        g.querySelector('select').onchange = e => {
          const v = e.target.value; if (D.settings) D.settings.lang = v;
          if (D.Save && D.Save.saveSettings) D.Save.saveSettings();
          if (D.Sfx) D.Sfx.play('click');
          I.set(v);
        };
      }
      return r;
    };
  }

  // ── 样式表里的中文
  const css = document.createElement('style');
  // 剧情卡（战略黑匣子那张）原来中文就超出舞台底边：限高、滚动（"知道了"跟着滚到底）
  // 英文比中文宽：顶栏标签、出发准备页的难度按钮、三个数字的说明、门禁卡包标题改用 10px 字
  css.textContent = 'html.lang-en .item.free::after { content: "R"; }\n' +
    'html.lang-en .tabs .tab { font: 400 10px var(--f10); padding: 2px 3px; } html.lang-en .tb-stat { font: 400 10px var(--f10); }\n' +
    'html.lang-en .bf-diff .btn, html.lang-en .bf-diff > span { font: 400 10px var(--f10); } html.lang-en .bf-facts div { font: 400 10px var(--f10); } html.lang-en .kc-h, html.lang-en .kc-h em { font: 400 10px var(--f10); }\n' +
    'html.lang-en .bf-diff { flex-wrap: wrap; row-gap: 3px; } html.lang-en .bf-diff > span { flex-basis: 100%; } html.lang-en .bf-diff .btn { flex: 1 1 0; min-width: 0; padding: 1px 0; } html.lang-en .bf-bags { flex-wrap: wrap; }\n' +
    'html.lang-en .rb-alert, html.lang-en .rb-alert b { font: 400 10px var(--f10); }\n' +
    'html.lang-en .item .it-name { font: 400 10px var(--f10); max-width: 100%; overflow: hidden; text-overflow: ellipsis; } html.lang-en .item .it-sub { font: 400 10px var(--f10); }\n' +
    '.storycard { max-height: 300px; overflow-y: auto; } .m-station .storycard { max-height: 240px; }';
  (document.head || document.documentElement).appendChild(css);
})(D);
