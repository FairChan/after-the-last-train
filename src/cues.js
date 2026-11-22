/* Underdog · 演出编号和触发时机（开发用）。
   每场戏、每句短句、每句教学的话、每件遗物都有一个写死的编号（S / B / T / R + 数字），写在 story/剧情脚本.md 里，
   tools/build-dlg.mjs 编进 dlg-data.js（场次的 code / when / on、D.CUE_DATA）。
   D.Cues.test(条件, pf)：@when 的条件写法（和 build-dlg.mjs 的 badWhen 一致）——空格连 = 都要，| = 或，2/3 a b c = 三个里有两个。
   D.Cues.shows(场次 id, pf)：story.js 的 BEATS 用它判断这一场现在该不该出现。
   D.Cues.param(短句类, 参数, 默认)：barks.js 读短句的时机（@gap @chance @every @near）。
   开发模式：网址加 ?dev=1 打开（记在本机），?dev=0 关；开着时剧情屋、短句、教学提示前面显示编号，F9 打开调度面板（dev/ui-dev.js，开发模式才加载）。
   面板里改的触发时机存在本机（覆盖脚本里的），"写回脚本"用 tools/cue.mjs。
   设计：design/features/cues/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const C = D.Cues = {};
  const LS = { dev: 'ud.dev', ov: 'ud.cueOverrides' };
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } } };

  // ── 开发模式
  C.dev = (() => {
    let q = null; try { q = new URLSearchParams(location.search).get('dev'); } catch (e) { }
    if (q === '1' || q === '0') ls.set(LS.dev, q === '1' ? '1' : null);
    return (q != null ? q === '1' : ls.get(LS.dev) === '1');
  })();
  C.setDev = on => { C.dev = !!on; ls.set(LS.dev, on ? '1' : null); };

  // ── 本机的改动：{ S05: '条件', 'pa.chance': '0.02', … }
  let ov = {}; try { ov = JSON.parse(ls.get(LS.ov) || '{}') || {}; } catch (e) { ov = {}; }
  C.overrides = () => Object.assign({}, ov);
  C.override = (key, val) => { if (val == null || val === '') delete ov[key]; else ov[key] = String(val); ls.set(LS.ov, Object.keys(ov).length ? JSON.stringify(ov) : null); };
  C.clearOverrides = () => { ov = {}; ls.set(LS.ov, null); };

  // ── 条件
  const S0 = pf => D.Story.S(pf);
  function token(t, pf) {
    if (t[0] === '!') return !token(t.slice(1), pf);
    const s = S0(pf);
    if (t === 'always' || t === 'new') return true;
    if (t === 'copy') return !!s.copy;
    if (t === 'ending') return !!s.ending;
    if (t === 'tut') return !!pf.tut;
    let m = t.match(/^clues>=(\d+)$/); if (m) return s.clues.length >= +m[1];
    m = t.match(/^raids>=(\d+)$/); if (m) return (pf.raids | 0) >= +m[1];
    m = t.match(/^seen:(\S+)$/); if (m) { const id = C.idOf(m[1]) || m[1]; return !!(s.seen && s.seen[id]) || s.talk[id] != null; }
    return D.Dlg.cond(pf, t);
  }
  // 一组（都要）
  function group(toks, pf) {
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i].match(/^(\d+)\/(\d+)$/);
      if (k) { const sub = toks.slice(i + 1, i + 1 + +k[2]); i += +k[2]; if (sub.filter(x => token(x, pf)).length < +k[1]) return false; continue; }
      if (!token(toks[i], pf)) return false;
    }
    return true;
  }
  C.test = function (expr, pf) {
    if (!expr) return false;
    const toks = String(expr).trim().split(/\s+/), groups = [[]];
    for (const t of toks) { if (t === '|') groups.push([]); else groups[groups.length - 1].push(t); }
    return groups.some(g => g.length && group(g, pf));
  };
  // ── 场次
  const SC = () => (D.Dlg && D.Dlg.SCENES) || {};
  C.idOf = code => { for (const id in SC()) if (SC()[id].code === code) return id; return null; };
  C.codeOf = id => (SC()[id] && SC()[id].code) || null;
  C.when = id => { const s = SC()[id]; if (!s) return null; return ov[s.code] != null ? ov[s.code] : s.when; };
  C.shows = (id, pf) => { const w = C.when(id); return !!w && C.test(w, pf); };

  // ── 短句
  const BK = () => (D.CUE_DATA && D.CUE_DATA.barks) || {};
  C.barkCode = (kind, i) => { const b = BK()[kind]; return b && b.codes[i] ? b.codes[i][0] : null; };
  C.param = function (kind, name, def) {
    const b = BK()[kind], raw = ov[kind + '.' + name] != null ? ov[kind + '.' + name] : b && b.params[name];
    if (raw == null || raw === '') return def;
    const r = String(raw), m = r.match(/^([\d.]+)\/([\d.]+)$/), n = r.match(/^([\d.]+)-([\d.]+)$/);
    if (m) return +m[1] / +m[2];
    if (n) return [+n[1], +n[2]];
    return isNaN(+r) ? def : +r;
  };
  C.tutLine = k => (D.CUE_DATA && D.CUE_DATA.tut && D.CUE_DATA.tut[k]) || null;
  C.relic = k => (D.CUE_DATA && D.CUE_DATA.relics && D.CUE_DATA.relics[k]) || null;
  C.tag = code => (C.dev && code ? '[' + code + '] ' : '');

  // 遗物的标题、正文、编号以剧情脚本为准（story.js 里那份只是没编译时的备用）
  if (D.Story && D.Story.RELICS && D.CUE_DATA) for (const k in D.CUE_DATA.relics) { const r = D.CUE_DATA.relics[k]; D.Story.RELICS[k] = Object.assign(D.Story.RELICS[k] || {}, { code: r.code, car: r.car, title: r.title, text: r.text }); }

  // 开发模式：加载调度面板（dev/ 下的文件只给开发用，不进 src，不用翻英文；部署时没有也不影响游戏）
  if (C.dev && typeof document !== 'undefined') {
    for (const f of ['dev/cue-meta.js', 'dev/ui-dev.js', 'dev/gen-preview.js']) { const el = document.createElement('script'); el.src = f; el.async = false; document.head.appendChild(el); }
  }
})(D);
