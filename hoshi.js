(function () {
  'use strict';

  var S = (typeof globalThis !== 'undefined' && globalThis.Shichu) || (typeof window !== 'undefined' && window.Shichu);
  var phases = [
    { name: '旅立ち', monthHint: 'この2か月でやってみたいことを一つ決めて、最初の一歩を予定に書きこんでみてください。', from: 0, length: 2, stars: '比肩・敗財', style: 'depart',
      summary: '学んだことを手に、自分の足で歩き出す2年です。まだ形は見えなくても大丈夫。人の声より自分の感覚を信じて、「次は何を大事にするか」を決めていきます。',
      advice: '「これからやってみたいこと」を一つ書き出して、今週できる小さな一歩を決めてみてください。' },
    { name: '挑戦と広がり', monthHint: '気になっていた場所や集まりに、一度足を運んでみてください。', from: 2, length: 2, stars: '食神・傷官', style: 'challenge',
      summary: 'いろいろな流れがやってきて、あれこれ試してみる2年です。うまくいくかより、気になったことに手を出してみることが、次の時期の手がかりになります。',
      advice: '気になる誘いや場所があれば、まず一度だけ試してみてください。やってみた感想を短くメモしておくと、あとで選ぶときの手がかりになります。' },
    { name: '選択と集中', monthHint: '続けたいことを一つにしぼって、そのための時間を先に予定に入れてみてください。', from: 4, length: 2, stars: '偏財・正財', style: 'focus',
      summary: '試してきたものの中から「これ」と決めて、人・モノ・カネを注ぎこむ2年です。広げることより、しぼって育てることを意識してみてください。',
      advice: '続けたいことを一つ選び、そのために使う時間や予算を先に決めてみてください。ほかのことは、少しお休みしても大丈夫です。' },
    { name: '成長と成果', monthHint: '予定が増えやすい2か月なので、頼めることは早めにまわりにお願いしてみてください。', from: 6, length: 2, stars: '偏官・正官', style: 'growth',
      summary: '注いできたものが大きく伸びて、外からも声がかかる2年です。成果が見えやすいぶん忙しくなるので、ひとりで抱えこまず、まわりと分け合っていきましょう。',
      advice: '新しく引き受ける前に、今の予定に入るかを一度確かめてみてください。任せられることは、早めにまわりに頼んでみましょう。' },
    { name: '整理と継承', monthHint: '最近うまくいったことを短いメモにまとめて、だれかに話してみてください。', from: 8, length: 2, stars: '偏印・印綬', style: 'inherit',
      summary: '伸びがひと段落して、やってきたことを振り返る2年です。体験を整理して言葉にし、人に教えたり渡したりすることで、それが次の人の力になります。',
      advice: 'うまくいったやり方を、人に伝わる言葉でまとめてみてください。仲間や後輩に話してみると、自分の学びもはっきりします。' },
    { name: '手放しと新たな学び', monthHint: 'やめてもよいことを一つ決めて、空いた時間で気になることを少し学んでみてください。', from: 10, length: 2, stars: '', style: 'release', kubou: true,
      summary: '12年の巡りの区切りの2年です。これまでの成果を味わいながら、次に持っていくものと、ここで終わりにするものを選びます。自分から押すより、人にゆだねたほうがうまく運びやすい時期です。そのぶん、次の12年に使える新しいことを学んでおきましょう。',
      advice: '終わりにしてよいことを一つ決めて、空いた時間で前から気になっていた分野を学んでみてください。迷うときは、信頼できる人の考えを聞いてみましょう。' }
  ];

  function toInt(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return parseInt(value, 10);
    return NaN;
  }
  function validTime(value, max) {
    if (value == null || value === '') return true;
    var n = toInt(value);
    return Number.isInteger(n) && n >= 0 && n <= max;
  }

  function parseInput(raw) {
    var data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return null;
    }
    if (!data) return null;
    var y = toInt(data.y), m = toInt(data.m), d = toInt(data.d);
    if (!Number.isInteger(y) || y < 1 || !Number.isInteger(m) || !Number.isInteger(d) ||
        (data.gender !== '男' && data.gender !== '女') ||
        !validTime(data.hour, 23) || !validTime(data.minute, 59)) return null;

    var date = new Date(0);
    date.setUTCFullYear(y, m - 1, d);
    if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m ||
        date.getUTCDate() !== d) return null;

    var hour = (data.hour == null || data.hour === '') ? null : toInt(data.hour);
    return {
      y: y, m: m, d: d,
      hour: hour, minute: hour == null ? null : (data.minute == null || data.minute === '' ? null : toInt(data.minute)),
      gender: data.gender
    };
  }

  function phaseForOffset(offset) {
    return phases.find(function (phase) { return offset < phase.from + phase.length; });
  }

  function offsetFrom(branch, kubou) {
    return (S.BRANCHES.indexOf(branch) - S.BRANCHES.indexOf(kubou.charAt(0)) - 2 + 24) % 12;
  }

  // 四柱推命の1年（立春から次の立春まで）を、節入りで区切った12か月にして、2か月ずつのフェーズにまとめる。
  function buildMonths(year, kubou, mode, now) {
    var months = Array.from({ length: 12 }, function (_, index) {
      var m = index + 2, y = year;
      if (m > 12) { m -= 12; y += 1; }
      var nm = m + 1, ny = y;
      if (nm > 12) { nm -= 12; ny += 1; }
      return {
        branch: S.BRANCHES.charAt(m % 12),
        start: S.setsuPoint(y, m, mode),
        end: S.setsuPoint(ny, nm, mode)
      };
    });
    var groups = [];
    for (var i = 0; i < 12; i += 2) {
      var a = months[i], b = months[i + 1];
      groups.push({
        branches: a.branch + '・' + b.branch,
        phase: phaseForOffset(offsetFrom(a.branch, kubou)),
        start: a.start, end: b.end,
        current: now >= a.start && now < b.end
      });
    }
    return groups;
  }

  function buildCycle(input, target) {
    var birth = Object.assign({}, input, { mode: 'precise' });
    var result = S.compute(Object.assign({}, birth, { target: target }));
    var year = S.serial(target.y, target.m, target.d) < S.setsuPoint(target.y, 2, result.mode)
      ? target.y - 1 : target.y;
    function offsetOf(branch) {
      return offsetFrom(branch, result.kubou);
    }

    var offset = offsetOf(result.current.ryunen.name.charAt(1));
    var start = year - offset;
    var current = phaseForOffset(offset);
    var next = phaseForOffset((current.from + current.length) % 12);
    var years = Array.from({ length: 12 }, function (_, index) {
      var y = start + index;
      var annual = S.compute(Object.assign({}, birth, { target: { y: y, m: 6, d: 1 } })).current.ryunen;
      var branch = annual.name.charAt(1);
      return {
        year: y,
        name: annual.name,
        phase: phaseForOffset(offsetOf(branch)),
        star: annual.stemStar === '劫財' ? '敗財' : annual.stemStar,
        kubou: result.kubou.includes(branch)
      };
    });

    return {
      year: year, start: start, years: years, current: current, next: next,
      nextYear: start + current.from + current.length,
      phaseYear: offset - current.from + 1, kubou: result.kubou, dayStem: result.pillars.day.stem,
      months: buildMonths(year, result.kubou, result.mode,
        S.serial(target.y, target.m, target.d) + ((target.hour || 0) * 60 + (target.minute || 0)) / 1440)
    };
  }

  var entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (character) { return entities[character]; });
  }

  function point(position, radius) {
    var angle = (position / 12 - 0.25) * 2 * Math.PI;
    return [170 + radius * Math.cos(angle), 170 + radius * Math.sin(angle)];
  }

  function renderCycle(cycle) {
    var marks = cycle.years.map(function (row, index) {
      var edgeGap = row.kubou ? 0.11 : 0.035;
      var start = point(index - 0.5 + edgeGap, 108);
      var end = point(index + 0.5 - edgeGap, 108);
      var label = point(index, 142);
      var pin = point(index, 75);
      return '<g><path class="arc ' + esc(row.phase.style) + '" d="M ' + start.join(' ') +
        ' A 108 108 0 0 1 ' + end.join(' ') + '"/>' +
        '<text class="year-label" x="' + label[0] + '" y="' + label[1] + '">' + esc(row.year) + '</text>' +
        (row.year === cycle.year
          ? '<g class="pin" transform="translate(' + pin.join(' ') + ')"><circle r="13"/><text>今</text></g>'
          : '') + '</g>';
    }).join('');
    var legend = phases.map(function (phase) {
      return '<li><span class="swatch ' + esc(phase.style) + '"></span>' +
        esc(phase.name) + (phase.kubou ? '（空亡）' : '') + '</li>';
    }).join('');

    return '<svg viewBox="0 0 340 340" role="img" aria-labelledby="diagram-title diagram-desc">' +
      '<title id="diagram-title">12年の巡り</title>' +
      '<desc id="diagram-desc">' + esc(cycle.start) + '年から時計回りに12年。' +
      esc(cycle.year) + '年の' + esc(cycle.current.name) + 'に「今」の印があります。</desc>' +
      marks + '<text class="wheel-center" x="170" y="170">空亡 ' + esc(cycle.kubou) + '</text></svg>' +
      '<ul class="legend">' + legend + '</ul>';
  }

  function range(start, length) {
    return esc(start) + '〜' + esc(start + length - 1) + '年';
  }

  function monthDay(point) {
    var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(point) * 86400000);
    return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
  }

  function yearOf(point) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(point) * 86400000).getUTCFullYear();
  }

  function renderMonths(cycle) {
    var list = document.getElementById('months');
    if (!list) return;
    list.innerHTML = cycle.months.map(function (group) {
      return '<li class="phase ' + esc(group.phase.style) + '"' + (group.current ? ' aria-current="true"' : '') +
        '><div class="phase-heading"><strong>' + esc(group.phase.name) + '</strong><span>' +
        esc(monthDay(group.start)) + '〜' + (yearOf(group.end - 1) > yearOf(group.start) ? '翌年' : '') +
        esc(monthDay(group.end - 1)) + '</span><span class="month-branch">' +
        esc(group.branches) + 'の月</span>' + (group.current ? '<span class="now">今</span>' : '') +
        '</div><div>' + esc(group.phase.monthHint) + '</div></li>';
    }).join('');
  }

  function render(cycle) {
    var current = cycle.current;
    var month = cycle.months.find(function (group) { return group.current; });
    document.getElementById('cycle').innerHTML = renderCycle(cycle);
    document.getElementById('present').innerHTML =
      '<h2 id="present-title">' + esc(cycle.year) + '年のフェーズ</h2>' +
      '<p class="present-phase"><strong>' + esc(current.name) + '</strong> ' +
      esc(cycle.phaseYear) + '年目</p>' +
      '<p>' + esc(current.advice) + '</p>' +
      (month ? '<p class="present-month">今月は、小さな巡りの「' + esc(month.phase.name) + '」にあたります。</p>' : '') +
      '<p class="next">次の「' + esc(cycle.next.name) + '」は' +
      esc(cycle.nextYear) + '年から</p>';

    document.getElementById('phases').innerHTML = phases.map(function (phase) {
      var active = phase === current;
      return '<li class="phase ' + esc(phase.style) + '"' + (active ? ' aria-current="true"' : '') +
        '><div class="phase-heading"><strong>' + esc(phase.name) + '</strong><span>' +
        range(cycle.start + phase.from, phase.length) + '</span>' +
        (active ? '<span class="now">今</span>' : '') + '</div><div>' + esc(phase.summary) + '</div></li>';
    }).join('');
    document.getElementById('loop').innerHTML =
      '次の巡りは ' + range(cycle.start + 12, phases[0].length) + 'の旅立ちから始まります。';

    renderMonths(cycle);
    document.getElementById('years').innerHTML = cycle.years.map(function (row) {
      var active = row.year === cycle.year;
      return '<tr' + (active ? ' class="cur" aria-current="true"' : '') + '><th scope="row">' +
        esc(row.year) + '年' + (active ? ' <span class="now">今</span>' : '') + '</th>' +
        '<td data-label="年干支">' + esc(row.name) + '</td>' +
        '<td data-label="フェーズ">' + esc(row.phase.name) + '</td>' +
        '<td class="annual-star" data-label="流年通変星">' + esc(row.star) + '</td>' +
        '<td data-label="空亡">' + (row.kubou ? '<span class="kubou">空亡</span>' : '—') + '</td></tr>';
    }).join('');
    document.getElementById('guidance').hidden = true;
    document.getElementById('reading').hidden = false;
  }

  var api = {
    phases: phases,
    phaseForOffset: phaseForOffset,
    offsetFrom: offsetFrom,
    buildMonths: buildMonths,
    parseInput: parseInput,
    buildCycle: buildCycle
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') window.Hoshi = api;
  if (typeof document === 'undefined') return;
  if (!document.getElementById('cycle') || !document.getElementById('reading')) return;

  var raw;
  try {
    raw = window.localStorage.getItem('shichu_last_input');
  } catch (_) {
    return;
  }
  var input = parseInput(raw);
  if (!input) return;

  var today = new Date();
  render(buildCycle(input, { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate(),
    hour: today.getHours(), minute: today.getMinutes() }));
})();
