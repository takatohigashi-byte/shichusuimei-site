(function () {
  'use strict';

  var S = (typeof globalThis !== 'undefined' && globalThis.Shichu) || (typeof window !== 'undefined' && window.Shichu);
  var phases = [
    { name: '選別', from: 0, length: 2, stars: '比肩・敗財', style: 'sort',
      summary: '自分の星をふり返り、大事なものを選び直す。',
      advice: '自分の星をふり返り、今も大事にしたいことを書き出してみましょう。続けたいことに、少し時間を取ってみてもよさそうです。' },
    { name: '仕込み', from: 2, length: 2, stars: '食神・傷官', style: 'prepare',
      summary: 'アイデアや好きなことを形にし始める。',
      advice: '気になっていたアイデアを、小さな形にしてみましょう。好きなことに手を動かしながら、続けやすいやり方を探してみてください。' },
    { name: '育成', from: 4, length: 3, stars: '偏財・正財', style: 'nurture',
      summary: '人やお金とのご縁を見つけ、育てていく。',
      advice: '身近なご縁のなかで、これからも大事にしたい関わりを見つけてみましょう。時間やお金は、無理なく続けられる使い方を考えてみてください。' },
    { name: '伸長', from: 7, length: 3, stars: '偏官・正官', style: 'extend',
      summary: '責任や挑戦を引き受け、できることを広げる。',
      advice: '関心のある役割や挑戦があれば、自分のペースで手を挙げてみましょう。抱えることが増えたら、周りと分け合えることを考えてみてください。' },
    { name: '実り', from: 10, length: 2, stars: '偏印・印綬', style: 'reflect',
      summary: 'やってきたことを仕組みにし、学びを深める。',
      advice: '続けてきた工夫をメモにまとめ、あとから見返せるようにしてみましょう。もう少し知りたいことがあれば、調べたり話を聞いたりしてみてください。' }
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

  function buildCycle(input, target) {
    var birth = Object.assign({}, input, { mode: 'precise' });
    var result = S.compute(Object.assign({}, birth, { target: target }));
    var year = S.serial(target.y, target.m, target.d) < S.setsuPoint(target.y, 2, result.mode)
      ? target.y - 1 : target.y;
    var firstBranch = S.BRANCHES.indexOf(result.kubou.charAt(0));

    function offsetOf(branch) {
      return (S.BRANCHES.indexOf(branch) - firstBranch + 12) % 12;
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
      phaseYear: offset - current.from + 1, kubou: result.kubou, dayStem: result.pillars.day.stem
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
        esc(phase.name) + (phase.from === 0 ? '（空亡）' : '') + '</li>';
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

  function render(cycle) {
    var current = cycle.current;
    document.getElementById('cycle').innerHTML = renderCycle(cycle);
    document.getElementById('present').innerHTML =
      '<h2 id="present-title">' + esc(cycle.year) + '年のフェーズ</h2>' +
      '<p class="present-phase"><strong>' + esc(current.name) + '</strong> ' +
      esc(cycle.phaseYear) + '年目</p><p class="note">象徴の十神　' + esc(current.stars) + '</p>' +
      '<p>' + esc(current.advice) + '</p><p class="next">次の「' + esc(cycle.next.name) + '」は' +
      esc(cycle.nextYear) + '年から</p>';

    document.getElementById('phases').innerHTML = phases.map(function (phase) {
      var active = phase === current;
      return '<li class="phase ' + esc(phase.style) + '"' + (active ? ' aria-current="true"' : '') +
        '><div class="phase-heading"><strong>' + esc(phase.name) + '</strong><span>' +
        range(cycle.start + phase.from, phase.length) + '</span>' +
        (active ? '<span class="now">今</span>' : '') + '</div><div>' + esc(phase.summary) + '</div></li>';
    }).join('');
    document.getElementById('loop').innerHTML =
      '次の巡りは ' + range(cycle.start + 12, phases[0].length) + 'の選別から始まります。';

    document.getElementById('years').innerHTML = cycle.years.map(function (row) {
      var active = row.year === cycle.year;
      return '<tr' + (active ? ' class="cur" aria-current="true"' : '') + '><th scope="row">' +
        esc(row.year) + '年' + (active ? ' <span class="now">今</span>' : '') + '</th>' +
        '<td data-label="年干支">' + esc(row.name) + '</td>' +
        '<td data-label="フェーズ">' + esc(row.phase.name) + '</td>' +
        '<td data-label="象徴の十神">' + esc(row.phase.stars) + '</td>' +
        '<td class="annual-star" data-label="流年通変星">' + esc(row.star) + '</td>' +
        '<td data-label="空亡">' + (row.kubou ? '<span class="kubou">空亡</span>' : '—') + '</td></tr>';
    }).join('');
    document.getElementById('guidance').hidden = true;
    document.getElementById('reading').hidden = false;
  }

  var api = {
    phases: phases,
    phaseForOffset: phaseForOffset,
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
  render(buildCycle(input, { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }));
})();
