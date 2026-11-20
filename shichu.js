/*
 * 市中水明 四柱推命エンジン（試作）
 * 計算ロジックは Excel「四柱暫定.xlsx」(シート「四柱相性」) の数式を JavaScript に移植したもの。
 * 各関数のコメントに、対応する Excel セルを記載。
 * 「精密モード」は天文計算による節入り時刻(JST)を使う追加オプション（Excel には無い）。
 */
(function (root) {
  'use strict';
  var T = root.SHICHU_TABLES, SETSU = root.SHICHU_SETSU_TRUE;
  if (typeof require === 'function' && (!T || !SETSU)) {
    var t = require('./tables.js'); T = t.SHICHU_TABLES; SETSU = t.SHICHU_SETSU_TRUE;
  }

  // ---- 基本表 ----
  // Excel 流の番号: 六十干支 1=甲子 … 60=癸亥。天干番号 = idx%10 (甲1…壬9, 癸0)。地支番号 = idx%12 (子1…戌11, 亥0)
  var STEM_BY_NUM = ['癸', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬'];
  var BRANCH_BY_NUM = ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'];
  var STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  var STEM_ELEM = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var BRANCH_ELEM = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  // 地支の通変星（体の陰陽）: 鑑定書PDFの最下段と一致することを確認済み（spec.md 参照）
  var BRANCH_BODY_STEM = { 子: '壬', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丁', 午: '丙', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '癸' };
  var ELEMS = ['木', '火', '土', '金', '水'];
  // 節（月の始まり）: Excel AD207:AJ222 の定数 D, A
  var SETSU_NAME = { 1: '小寒', 2: '立春', 3: '啓蟄', 4: '清明', 5: '立夏', 6: '芒種', 7: '小暑', 8: '立秋', 9: '白露', 10: '寒露', 11: '立冬', 12: '大雪' };
  var SETSU_DA = { 1: [6.3811, 0.242778], 2: [4.8693, 0.242713], 3: [6.3968, 0.242512], 4: [5.628, 0.242231], 5: [6.3771, 0.241945], 6: [6.5733, 0.241731], 7: [8.0091, 0.241642], 8: [8.4102, 0.241703], 9: [8.5186, 0.241898], 10: [9.1414, 0.242179], 11: [8.2396, 0.242469], 12: [7.9152, 0.242689] };

  function mod(a, n) { return ((a % n) + n) % n; }
  function mod60(x) { var m = mod(x, 60); return m === 0 ? 60 : m; }
  function kanshi(idx) { return STEM_BY_NUM[idx % 10] + BRANCH_BY_NUM[idx % 12]; }
  function kanshiIndex(name) { for (var i = 1; i <= 60; i++) if (kanshi(i) === name) return i; return null; }
  function stemNum(s) { return STEM_BY_NUM.indexOf(s); }
  function branchNum(b) { return BRANCH_BY_NUM.indexOf(b); }

  // Excel シリアル値（1900-03-01 以降は Excel と一致）
  var BASE = Date.UTC(1899, 11, 30);
  function serial(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - BASE) / 86400000); }
  function fromSerial(s) { var d = new Date(BASE + s * 86400000); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
  function excelRound(x) { return x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5); }

  // ---- 節入り ----
  // Excel AI209 等: 日 = INT(D + A*(年補正-1900) - INT((年補正-1900)/4))、1・2月は 年補正 = 年-1
  function excelSetsuDay(y, m) {
    var yc = m < 3 ? y - 1 : y, da = SETSU_DA[m], t = yc - 1900;
    return Math.floor(da[0] + da[1] * t - Math.floor(t / 4));
  }
  // 節入りの時点（シリアル値、小数部=時刻）。excel モードは日付のみ（その日の 0:00 扱い）
  function setsuPoint(y, m, mode) {
    if (mode === 'precise' && SETSU[String(y)]) {
      var s = SETSU[String(y)][m - 1];
      var mm = +s.slice(0, 2), dd = +s.slice(2, 4), hh = +s.slice(4, 6), mi = +s.slice(6, 8);
      return serial(y, mm, dd) + (hh * 60 + mi) / 1440;
    }
    return serial(y, m, excelSetsuDay(y, m));
  }
  // 出生時点の前後の節入り
  function setsuAround(t, mode) {
    var d = fromSerial(Math.floor(t)), list = [];
    for (var y = d.y - 1; y <= d.y + 1; y++) for (var m = 1; m <= 12; m++) list.push({ y: y, m: m, t: setsuPoint(y, m, mode) });
    list.sort(function (a, b) { return a.t - b.t; });
    var prev = null, next = null;
    for (var i = 0; i < list.length; i++) { if (list[i].t <= t) prev = list[i]; else { next = list[i]; break; } }
    return { prev: prev, next: next };
  }

  // ---- 四柱 ----
  // 年柱 Excel O1: MOD(年-1900+37,60)、立春前なら -1
  function yearPillar(y, t, mode) {
    var raw = mod60(y - 1900 + 37);
    return t < setsuPoint(y, 2, mode) ? mod60(raw - 1) : raw;
  }
  // 月柱 Excel N1: MOD(年干支番号(立春補正なし)*12 + 月 - 10, 60)、その月の節入り前なら -2、以後なら -1
  function monthPillar(y, m, t, mode) {
    var rawY = mod60(y - 1900 + 37), base = mod60(rawY * 12 + m - 10);
    return t < setsuPoint(y, m, mode) ? mod60(base - 2) : mod60(base - 1);
  }
  // 日柱 Excel M1: MOD(生年月日 - 1900/1/1 + 10, 60)
  function dayPillar(s) { return mod60(s - 1 + 10); }
  // 時柱 Excel L3: VLOOKUP(時刻, C193:H205, MOD(日干支,5)+2)
  //   子0:00 丑1:00 寅3:00 … 亥21:00 子23:00（23時以降は日柱はそのまま、時干は翌日の子の刻）
  function hourOffset(minutes) {
    if (minutes < 60) return 0;
    if (minutes >= 1380) return 12;
    return Math.floor((minutes - 60) / 120) + 1;
  }
  function hourPillar(dayIdx, minutes) {
    var ziStart = mod60((mod(dayIdx, 5) - 1) * 12 + 1);
    return mod60(ziStart + hourOffset(minutes));
  }

  // ---- 星 ----
  // 通変星 Excel G4 等: 日干が陽(番号奇数)なら Q228:AA237（「敗財」表記）、陰なら D228:N237（「劫財」表記）
  function tsuhen(dayIdx, stem) {
    var tbl = (dayIdx % 2 === 0) ? T.tsu_even : T.tsu_odd;
    return tbl[dayIdx % 10][stemNum(stem)];
  }
  // 十二運 Excel G5 等: VLOOKUP(MOD(日,10), D242:P251, MOD(柱,12)+2)
  function juniun(dayIdx, branch) { return T.juni[dayIdx % 10][branchNum(branch)]; }
  // 蔵干 Excel G7 等: VLOOKUP(O8, K297:W326, 地支) ／ O8 = 次の節入り日 - 生年月日 + 1（30超は30）
  function zokanExcel(daysIdx, branch) { var r = Math.max(1, Math.min(30, daysIdx)); return T.zokan[r - 1][branchNum(branch)]; }
  // 空亡 Excel M8
  function kubou(dayIdx) {
    if (dayIdx < 11) return '戌亥'; if (dayIdx < 21) return '申酉'; if (dayIdx < 31) return '午未';
    if (dayIdx < 41) return '辰巳'; if (dayIdx < 51) return '寅卯'; return '子丑';
  }
  // 納音（一般的な定義。Excel C270:I329 にも列があるが一部データ破損あり）
  var NAYIN = ['海中金', '爐中火', '大林木', '路傍土', '剣鋒金', '山頭火', '澗下水', '城頭土', '白鑞金', '楊柳木', '泉中水', '屋上土', '霹靂火', '松柏木', '長流水', '沙中金', '山下火', '平地木', '壁上土', '金箔金', '覆燈火', '天河水', '大駅土', '釵釧金', '桑柘木', '大渓水', '沙中土', '天上火', '石榴木', '大海水'];
  function nayin(idx) { return NAYIN[Math.floor((idx - 1) / 2)]; }

  // ---- 神殺（Excel には無い。鑑定書PDFの表示と照合して一致した一般的定義のみ） ----
  var TENOTSU = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 辛: '寅午', 壬: '卯巳', 癸: '卯巳' };
  var YOUJIN = { 甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' };
  var TENTOKU = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
  var KANGOU = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
  var SHIGOU = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  function tentoku(monthBranch) {
    var t = TENTOKU[monthBranch];
    var gou = STEMS.indexOf(t) >= 0 ? KANGOU[t] : SHIGOU[t];
    return t + gou;
  }
  // 月令（旺相休囚死）: 日干の五行と月支の季節（寅卯辰=春木、巳午未=夏火、申酉戌=秋金、亥子丑=冬水）
  var SEASON = { 寅: ['春', '木'], 卯: ['春', '木'], 辰: ['春', '木'], 巳: ['夏', '火'], 午: ['夏', '火'], 未: ['夏', '火'], 申: ['秋', '金'], 酉: ['秋', '金'], 戌: ['秋', '金'], 亥: ['冬', '水'], 子: ['冬', '水'], 丑: ['冬', '水'] };
  function relation(a, b) { // a から見た b: 0比和 1 aがbを生む 2 aがbを剋す 3 bがaを剋す 4 bがaを生む
    return mod(ELEMS.indexOf(b) - ELEMS.indexOf(a), 5);
  }
  function getsurei(dayStem, monthBranch) {
    var se = SEASON[monthBranch], r = relation(STEM_ELEM[dayStem], se[1]);
    var name = ['旺', '休', '囚', '死', '相'][r];
    return { name: name + '令', season: se[0] };
  }

  // 命宮（中級⑩ p4「命宮表」）: 時支と月支から命宮の地支、年干から命宮の天干
  //   地支 = 巳 - 月支 - 時支 (mod 12, 子=0) / 天干 = 年干による寅月の干（甲己→丙…）から寅=0…丑=11 で順に進める
  var TORA_START = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' };
  function meikyu(yearStem, monthBranch, hourBranch) {
    var b = BRANCHES[mod(5 - BRANCHES.indexOf(monthBranch) - BRANCHES.indexOf(hourBranch), 12)];
    var off = mod(BRANCHES.indexOf(b) - 2, 12);
    var st = STEMS[mod(STEMS.indexOf(TORA_START[yearStem]) + off, 10)];
    return st + b;
  }

  // ---- 干支の関係 ----
  var KANGOU_ELEM = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' };
  var SHIGOU_ELEM = { 子丑: '土', 寅亥: '木', 卯戌: '火', 辰酉: '金', 巳申: '水', 午未: '火' }; // 午未: Excel は火
  var SANGOU = [['申', '子', '辰', '水'], ['亥', '卯', '未', '木'], ['寅', '午', '戌', '火'], ['巳', '酉', '丑', '金']];
  var CHUU = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
  var KEI = ['子卯', '寅巳', '巳申', '寅申', '丑戌', '戌未', '丑未']; // 三刑（ペア単位）
  var JIKEI = '辰午酉亥';
  var GAI = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
  var HA = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'];
  function pairIn(list, a, b) { return list.indexOf(a + b) >= 0 || list.indexOf(b + a) >= 0; }
  function findKey(obj, a, b) { return obj[a + b] || obj[b + a] || null; }

  function relations(items) { // items: [{label, idx}]
    var res = { kangou: [], shigou: [], hankai: [], sankyoku: [], chuu: [], tensen: [], kei: [], gai: [], ha: [] };
    for (var i = 0; i < items.length; i++) for (var j = i + 1; j < items.length; j++) {
      var A = items[i], B = items[j];
      var sa = kanshi(A.idx)[0], sb = kanshi(B.idx)[0], ba = kanshi(A.idx)[1], bb = kanshi(B.idx)[1];
      var pair = A.label + '・' + B.label;
      var e = findKey(KANGOU_ELEM, sa, sb); if (e) res.kangou.push(pair + '（' + sa + sb + '→' + e + '）');
      e = findKey(SHIGOU_ELEM, ba, bb); if (e) res.shigou.push(pair + '（' + ba + bb + '→' + e + '）');
      if (pairIn(CHUU, ba, bb)) res.chuu.push(pair + '（' + ba + bb + '）');
      if (Math.abs(A.idx - B.idx) === 30) res.tensen.push(pair + '（' + kanshi(A.idx) + '・' + kanshi(B.idx) + '）');
      if (pairIn(KEI, ba, bb) || (ba === bb && JIKEI.indexOf(ba) >= 0)) res.kei.push(ba + '(' + A.label + ')－' + bb + '(' + B.label + ')');
      if (pairIn(GAI, ba, bb)) res.gai.push(ba + '(' + A.label + ')－' + bb + '(' + B.label + ')');
      if (pairIn(HA, ba, bb)) res.ha.push(ba + '(' + A.label + ')－' + bb + '(' + B.label + ')');
    }
    var bs = items.map(function (x) { return kanshi(x.idx)[1]; });
    SANGOU.forEach(function (g) {
      var have = g.slice(0, 3).filter(function (b) { return bs.indexOf(b) >= 0; });
      if (have.length === 3) res.sankyoku.push(g.slice(0, 3).join('') + '（' + g[3] + '局）');
      else if (have.length === 2) res.hankai.push(have.join('') + '（' + g[3] + '局の半会）');
    });
    return res;
  }

  // ---- メイン計算 ----
  // input: {y,m,d, hour (null=不明), minute, gender:'男'|'女', mode:'excel'|'precise', zokanMode:'excel'|'since', target:{y,m,d}}
  function compute(input) {
    var mode = input.mode || 'excel';
    var minutes = (input.hour === null || input.hour === undefined || input.hour === '') ? null : (+input.hour * 60 + (+input.minute || 0));
    var s = serial(input.y, input.m, input.d);
    var t = (mode === 'precise' && minutes !== null) ? s + minutes / 1440 : s; // excel モードは日付のみで比較
    var Y = yearPillar(input.y, t, mode);
    var M = monthPillar(input.y, input.m, t, mode);
    var D = dayPillar(s);
    var H = minutes === null ? null : hourPillar(D, minutes);
    var dayStem = kanshi(D)[0];

    var around = setsuAround(t, mode);
    // 蔵干の日数: 講義資料（上級① p8「地支蔵干一覧表 理論①」）は「節入りよりの日数」。
    // Excel O8 は「次の節入り日 - 生年月日 + 1」（＝次の節入りまでの日数）になっており、資料と逆向き。
    // 既定は資料どおり 'since'。'excel' を指定すると Excel の値を再現する。
    var zokanDays = input.zokanMode === 'excel'
      ? Math.floor(around.next.t) - Math.floor(t) + 1 // Excel O8
      : Math.floor(t) - Math.floor(around.prev.t) + 1;

    function pillarInfo(idx, isDay) {
      if (idx === null) return null;
      var k = kanshi(idx), st = k[0], br = k[1], zk = zokanExcel(zokanDays, br);
      return {
        idx: idx, name: k, stem: st, branch: br,
        stemStar: isDay ? '（日主）' : tsuhen(D, st),
        juniun: juniun(D, br),
        branchStar: tsuhen(D, BRANCH_BODY_STEM[br]),
        zokan: zk, zokanStar: tsuhen(D, zk),
        stemElem: STEM_ELEM[st], branchElem: BRANCH_ELEM[br], nayin: nayin(idx)
      };
    }
    var pillars = { hour: pillarInfo(H), day: pillarInfo(D, true), month: pillarInfo(M), year: pillarInfo(Y) };

    // 大運 Excel P1/P3/P4/J1
    var gender = input.gender;
    var forward = null, unRaw = null, un = null, P1 = null;
    if (gender === '男' || gender === '女') {
      forward = gender === '男' ? (Y % 2 === 1) : (Y % 2 === 0);
      P1 = forward ? Math.abs(Math.floor(around.next.t) - Math.floor(t)) + 1 : Math.abs(Math.floor(t) - Math.floor(around.prev.t)) + 1;
      unRaw = forward ? Math.floor(P1 / 3) : excelRound(P1 / 3);
      un = (P1 < 6 || P1 > 30) ? 10 : unRaw;
    }
    var daiun = [];
    if (un) for (var k = 0; k < 10; k++) {
      var di = mod60(forward ? M + k : M - k), dk = kanshi(di);
      daiun.push({ from: k * un + 1, to: (k + 1) * un, idx: di, name: dk, stemStar: tsuhen(D, dk[0]), juniun: juniun(D, dk[1]), branchStar: tsuhen(D, BRANCH_BODY_STEM[dk[1]]) });
    }

    // 対象日（流年・流月・流日）と年齢 Excel P5
    var tg = input.target, cur = null;
    if (tg) {
      var ts = serial(tg.y, tg.m, tg.d);
      var birthBefore = t < setsuPoint(input.y, 2, mode), tgBefore = ts < setsuPoint(tg.y, 2, mode);
      var age = (tgBefore ? tg.y - input.y : tg.y - input.y + 1) + (birthBefore ? 1 : 0);
      var ly = yearPillar(tg.y, ts, mode), lm = monthPillar(tg.y, tg.m, ts, mode), ld = dayPillar(ts);
      var dCur = null;
      if (un) { var kk = Math.floor((age - 1) / un); dCur = daiun[kk] || { idx: mod60(forward ? M + kk : M - kk), from: kk * un + 1, to: (kk + 1) * un }; dCur.name = kanshi(dCur.idx); }
      function star(idx) { var kk2 = kanshi(idx); return { idx: idx, name: kk2, stemStar: tsuhen(D, kk2[0]), juniun: juniun(D, kk2[1]), branchStar: tsuhen(D, BRANCH_BODY_STEM[kk2[1]]) }; }
      cur = { age: age, ryunen: star(ly), ryugetsu: star(lm), ryujitsu: star(ld), daiun: dCur ? Object.assign(star(dCur.idx), { from: dCur.from, to: dCur.to }) : null };
    }

    // 五行（四柱の天干・地支の数）Excel BG12:BG16 (●)
    var gogyo = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    ['hour', 'day', 'month', 'year'].forEach(function (p) { var q = pillars[p]; if (q) { gogyo[q.stemElem]++; gogyo[q.branchElem]++; } });
    // 通変星の五行グループ Excel D79:F83
    var dayElem = STEM_ELEM[dayStem], groups = {};
    ['比劫', '食傷', '財星', '官星', '印星'].forEach(function (g, i) { groups[g] = { elem: ELEMS[mod(ELEMS.indexOf(dayElem) + i, 5)] }; groups[g].count = gogyo[groups[g].elem]; });

    var items = [];
    if (H !== null) items.push({ label: '時', idx: H });
    items.push({ label: '日', idx: D }, { label: '月', idx: M }, { label: '年', idx: Y });
    var rel = relations(items);
    var relRun = null;
    if (cur) {
      var it2 = items.slice(); if (cur.daiun) it2.push({ label: '大運', idx: cur.daiun.idx }); it2.push({ label: '流年', idx: cur.ryunen.idx });
      relRun = relations(it2);
    }

    // 元命（格局）: 月柱の地支蔵干の通変星（上級① p2「格式(局)＝月支元命」）。比肩→建禄格、劫財/敗財→月刃格（外格）
    var gStar = pillars.month.zokanStar;
    var kakkyoku = gStar === '比肩' ? '建禄格' : (gStar === '劫財' || gStar === '敗財') ? '月刃格' : gStar === '偏官' ? '偏官格（七殺格）' : gStar === '偏印' ? '偏印格（倒食格）' : gStar + '格';

    var mk = H === null ? null : meikyu(kanshi(Y)[0], kanshi(M)[1], kanshi(H)[1]);
    var meikyuInfo = mk ? { name: mk, stemStar: tsuhen(D, mk[0]), juniun: juniun(D, mk[1]) } : null;

    return {
      input: input, mode: mode, genmei: gStar, meikyu: meikyuInfo, kakkyoku: kakkyoku, pillars: pillars, dayStem: dayStem, dayIdx: D,
      kubou: kubou(D), tenotsu: TENOTSU[dayStem], youjin: YOUJIN[dayStem], tentoku: tentoku(kanshi(M)[1]),
      getsurei: getsurei(dayStem, kanshi(M)[1]), nayinDay: nayin(D),
      setsu: { prev: around.prev, next: around.next, prevName: SETSU_NAME[around.prev.m], nextName: SETSU_NAME[around.next.m], prevDate: fromSerial(Math.floor(around.prev.t)), nextDate: fromSerial(Math.floor(around.next.t)) },
      zokanDays: zokanDays,
      daiunInfo: un ? { forward: forward, P1: P1, unRaw: unRaw, un: un, replaced: un !== unRaw } : null,
      daiun: daiun, current: cur, gogyo: gogyo, groups: groups, relations: rel, relationsRun: relRun
    };
  }

  function natalItems(r) {
    var items = [], P = r.pillars;
    if (P.hour) items.push({ label: '時', idx: P.hour.idx });
    items.push({ label: '日', idx: P.day.idx }, { label: '月', idx: P.month.idx }, { label: '年', idx: P.year.idx });
    return items;
  }
  function luckItems(r) {
    var items = [];
    if (!r.current) return items;
    if (r.current.daiun) items.push({ label: '大運', idx: r.current.daiun.idx });
    if (r.current.ryunen) items.push({ label: '流年', idx: r.current.ryunen.idx });
    if (r.current.ryugetsu) items.push({ label: '流月', idx: r.current.ryugetsu.idx });
    return items;
  }
  function relationsAll(r) { return relations(natalItems(r).concat(luckItems(r))); }

  function parseGouElem(s) {
    var m = String(s).match(/→([木火土金水])/);
    if (m) return m[1];
    m = String(s).match(/（([木火土金水])局/);
    return m ? m[1] : null;
  }

  // 五行図の記号（●は compute() の gogyo＝四柱天干+地支）。
  // △は干合・支合・半会の化気（変化先の五行）、▲は三局の五行。
  // 命式内に加え、大運・流年・流月との合も印す（Excel の BH は四柱の干合+支合のみで半会は含まない）。
  // ＋／⊕は大運・流年の天干と地支の五行。×は生まれ月の季節五行（寅卯辰=木・巳午未=火・申酉戌=金・亥子丑=水）。
  function gogyoMarks(r) {
    var marks = {};
    ELEMS.forEach(function (e) {
      marks[e] = { natal: r.gogyo[e] || 0, daiun: 0, ryunen: 0, gou: 0, sankyoku: 0, getsurei: false };
    });
    function addKS(name, key) {
      if (!name) return;
      marks[STEM_ELEM[name[0]]][key]++;
      marks[BRANCH_ELEM[name[1]]][key]++;
    }
    if (r.current && r.current.daiun) addKS(r.current.daiun.name, 'daiun');
    if (r.current && r.current.ryunen) addKS(r.current.ryunen.name, 'ryunen');
    if (r.pillars && r.pillars.month) marks[SEASON[r.pillars.month.branch][1]].getsurei = true;
    // 五行図の合印は四柱＋大運＋流年（Excel の四柱合＋行運合に相当）。月運の合は関係の文章側で示す。
    var figItems = natalItems(r);
    if (r.current) {
      if (r.current.daiun) figItems.push({ label: '大運', idx: r.current.daiun.idx });
      if (r.current.ryunen) figItems.push({ label: '流年', idx: r.current.ryunen.idx });
    }
    var rel = relations(figItems);
    function bump(list, key) {
      var seen = {};
      (list || []).forEach(function (s) {
        var e = parseGouElem(s);
        if (!e || seen[e]) return;
        seen[e] = 1;
        marks[e][key]++;
      });
    }
    bump(rel.kangou, 'gou');
    bump(rel.shigou, 'gou');
    bump(rel.hankai, 'gou');
    bump(rel.sankyoku, 'sankyoku');
    return marks;
  }

  function dayRel(stemA, stemB) {
    var ea = STEM_ELEM[stemA], eb = STEM_ELEM[stemB];
    var k = findKey(KANGOU_ELEM, stemA, stemB);
    var rel = relation(ea, eb);
    var kind = ['比和', '相生', '相剋', '相剋', '相生'][rel];
    var dir = ['同じ五行', 'あなたが相手を生む', 'あなたが相手を引きしめる', '相手があなたを引きしめる', '相手があなたを生む'][rel];
    return { stemA: stemA, stemB: stemB, elemA: ea, elemB: eb, kangou: k, kind: kind, dir: dir, code: rel };
  }

  function relationsBetween(rA, rB, labA, labB) {
    labA = labA || 'あなた'; labB = labB || 'お相手';
    var a = natalItems(rA).map(function (x) { return { label: labA + 'の' + x.label, idx: x.idx }; });
    var b = natalItems(rB).map(function (x) { return { label: labB + 'の' + x.label, idx: x.idx }; });
    var res = { kangou: [], shigou: [], hankai: [], sankyoku: [], chuu: [], tensen: [], kei: [], gai: [], ha: [] };
    var i, j;
    for (i = 0; i < a.length; i++) for (j = 0; j < b.length; j++) {
      var A = a[i], B = b[j];
      var sa = kanshi(A.idx)[0], sb = kanshi(B.idx)[0], ba = kanshi(A.idx)[1], bb = kanshi(B.idx)[1];
      var pair = A.label + '・' + B.label;
      var e = findKey(KANGOU_ELEM, sa, sb); if (e) res.kangou.push(pair + '（' + sa + sb + '→' + e + '）');
      e = findKey(SHIGOU_ELEM, ba, bb); if (e) res.shigou.push(pair + '（' + ba + bb + '→' + e + '）');
      if (pairIn(CHUU, ba, bb)) res.chuu.push(pair + '（' + ba + bb + '）');
      if (Math.abs(A.idx - B.idx) === 30) res.tensen.push(pair + '（' + kanshi(A.idx) + '・' + kanshi(B.idx) + '）');
      if (pairIn(KEI, ba, bb) || (ba === bb && JIKEI.indexOf(ba) >= 0)) res.kei.push(ba + '(' + A.label + ')－' + bb + '(' + B.label + ')');
      if (pairIn(GAI, ba, bb)) res.gai.push(ba + '(' + A.label + ')－' + bb + '(' + B.label + ')');
      if (pairIn(HA, ba, bb)) res.ha.push(ba + '(' + A.label + ')－' + bb + '(' + B.label + ')');
    }
    var aB = a.map(function (x) { return kanshi(x.idx)[1]; });
    var bB = b.map(function (x) { return kanshi(x.idx)[1]; });
    var bs = aB.concat(bB);
    SANGOU.forEach(function (g) {
      var haveA = g.slice(0, 3).filter(function (br) { return aB.indexOf(br) >= 0; });
      var haveB = g.slice(0, 3).filter(function (br) { return bB.indexOf(br) >= 0; });
      var have = g.slice(0, 3).filter(function (br) { return bs.indexOf(br) >= 0; });
      if (!(haveA.length && haveB.length && have.length >= 2)) return;
      if (have.length === 3) res.sankyoku.push(g.slice(0, 3).join('') + '（' + g[3] + '局）');
      else res.hankai.push(have.join('') + '（' + g[3] + '局の半会）');
    });
    return res;
  }

  function compat(rA, rB, labA, labB) {
    labA = labA || 'あなた'; labB = labB || 'お相手';
    var dayA = rA.pillars.day, dayB = rB.pillars.day;
    return {
      dayRel: dayRel(rA.dayStem, rB.dayStem),
      dayShigou: findKey(SHIGOU_ELEM, dayA.branch, dayB.branch),
      dayChuu: pairIn(CHUU, dayA.branch, dayB.branch) ? (dayA.branch + dayB.branch) : null,
      between: relationsBetween(rA, rB, labA, labB),
      gogyoA: rA.gogyo,
      gogyoB: rB.gogyo
    };
  }

  var api = { compute: compute, kanshi: kanshi, kanshiIndex: kanshiIndex, tsuhen: tsuhen, juniun: juniun, nayin: nayin, excelSetsuDay: excelSetsuDay, setsuPoint: setsuPoint, serial: serial, STEMS: STEMS, BRANCHES: BRANCHES, SETSU_NAME: SETSU_NAME, relations: relations, relationsAll: relationsAll, gogyoMarks: gogyoMarks, compat: compat, natalItems: natalItems, luckItems: luckItems, KANGOU_ELEM: KANGOU_ELEM, SHIGOU_ELEM: SHIGOU_ELEM, SANGOU: SANGOU, STEM_ELEM: STEM_ELEM, BRANCH_ELEM: BRANCH_ELEM, SEASON: SEASON, ELEMS: ELEMS };
  root.Shichu = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
