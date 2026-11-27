/* 画面処理（バックエンドなし）。計算は shichu.js、文章は texts.js */
(function () {
  var T = window.SHICHU_TEXTS, S = window.Shichu;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
  if ($('target')) $('target').value = todayStr;
  if ($('notime')) $('notime').addEventListener('change', function () { $('time').disabled = this.checked; });
  if ($('aNotime')) $('aNotime').addEventListener('change', function () { $('aTime').disabled = this.checked; });
  if ($('bNotime')) $('bNotime').addEventListener('change', function () { $('bTime').disabled = this.checked; });
  if (/(?:^|[?&])debug=1(?:&|$)/.test(location.search || '') && $('debugSettings')) $('debugSettings').hidden = false;

  function ymd(s) {
 s=String(s||'').trim().replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-65248);});
 if(/^\d{8}$/.test(s))s=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('生年月日は8けた（例：19870617）または1987-06-17の形で入力してください');
 var a=s.split('-').map(Number),dt=new Date(Date.UTC(a[0],a[1]-1,a[2]));
 if(dt.getUTCFullYear()!==a[0]||dt.getUTCMonth()!==a[1]-1||dt.getUTCDate()!==a[2])throw Error('実在する日付を入力してください');
 return {y:a[0],m:a[1],d:a[2]};
 }
  function fmtD(o) { return o.y + '年' + o.m + '月' + o.d + '日'; }
  function tsuText(star) { var o = T.tsuhen[star]; return o ? o.text : ''; }
  function tsuKaku(star) { var o = T.tsuhen[star]; return o ? o.kaku : ''; }
  function tsuUn(star) { var o = T.tsuhen[star]; return o ? o.un : ''; }
  function junText(j) { var o = T.juniun[j]; return o ? '（' + o.stage + '）' + o.text : ''; }
  function junUn(j) { var o = T.juniun[j]; return o ? o.un : ''; }

  function splitSentences(s) {
    s = String(s || '').trim();
    if (!s) return [];
    return s.split(/(?<=。)/).map(function (t) { return t.trim(); }).filter(Boolean);
  }
  function firstSentence(s) {
    var a = splitSentences(s);
    return a.length ? a[0] : String(s || '').trim();
  }
  function parasHtml(s) {
    return splitSentences(s).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
  }
  var CARE_RE = /たら|ときは|すぎ|ひと呼吸|注意|確認|ペース配分|休息|余裕|おいて|整え|見直|過ぎない|押さえ/;
  function unkiBody(stemStar, juniun) {
    var sents = splitSentences(tsuUn(stemStar));
    var period = [], care = [], tips = [];
    sents.forEach(function (t, i) {
      if (i === 0) period.push(t);
      else if (CARE_RE.test(t)) care.push(t);
      else tips.push(t);
    });
    var ju = junUn(juniun);
    if (ju) period.push(ju);
    var h = '';
    function blk(title, arr) {
      if (!arr.length) return;
      h += '<h4>' + esc(title) + '</h4>' + arr.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
    }
    blk('どんな時期？', period);
    blk('気をつけること', care);
    blk('おすすめの過ごし方', tips);
    return h;
  }
  var BRANCH_BODY_STEM = { 子: '壬', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丁', 午: '丙', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '癸' };
  function mod60app(x) { var m = ((x % 60) + 60) % 60; return m === 0 ? 60 : m; }
  function daiunTo100(r, fromAge, toAge) {
    var info = r.daiunInfo, mon = r.pillars && r.pillars.month;
    if (!info || !mon) return r.daiun || [];
    var un = info.un, forward = info.forward, D = r.dayIdx, M = mon.idx;
    var out = [], k = fromAge == null ? 0 : Math.max(0, Math.floor((fromAge - 1) / un));
    var end = toAge == null ? Math.min(30, Math.ceil(100 / un)) : Math.ceil(toAge / un);
    for (; k < end; k++) {
      if (r.daiun[k]) {
        out.push(r.daiun[k]);
        continue;
      }
      var di = mod60app(forward ? M + k : M - k);
      var dk = S.kanshi(di);
      out.push({
        from: k * un + 1, to: (k + 1) * un, idx: di, name: dk,
        stemStar: S.tsuhen(D, dk.charAt(0)),
        juniun: S.juniun(D, dk.charAt(1)),
        branchStar: S.tsuhen(D, BRANCH_BODY_STEM[dk.charAt(1)])
      });
    }
    return out;
  }
  function gogyoSummaryLine(r, forCompat) {
    var g = r.gogyo, E = ['木', '火', '土', '金', '水'];
    var P = T.gogyoPlain || {};
    var balance = T.elemManyFew(g, E), many = balance.many, zero = balance.few;
    function shortG(e) { return (P.glossShort && P.glossShort[e]) || (P.gloss && P.gloss[e]) || ''; }
    var s = '';
    if (many.length >= 2) {
      s = many[0] + 'と' + many[1] + 'の気（' + shortG(many[0]) + 'と' + shortG(many[1]) + '）が多め。';
    } else if (many.length === 1) {
      s = many[0] + 'の気（' + shortG(many[0]) + '）が多め。';
    }
    if (zero.length) {
      var z = zero[0];
      s += zero.map(function (x) { return x + 'の気（' + shortG(x) + '）'; }).join('・') + 'は少なめです。';
      if (forCompat) return s;
      var people = (P.people && P.people[z]) || (z + 'の気を持つ人との付き合い');
      var life = (P.life && P.life[z]) || '';
      var lifeBit = life.split('、').slice(0, 2).join('、');
      s += people + (lifeBit ? 'や、' + lifeBit : '') + 'で補えます。';
    } else {
      s += '五行の気がひととおりそろっていて、バランスのとりやすい命式です。';
    }
    return s;
  }
  function summaryHtml(r) {
    var nk = T.nikkan[r.dayStem] || { img: '', text: '' };
    var yearLine = '生年月日を基準に、今年の流れを見られます。';
    if (r.current && r.current.ryunen) yearLine = firstSentence(tsuUn(r.current.ryunen.stemStar));
    var title = r.displayName ? esc(r.displayName) + 'さんの鑑定' : 'あなたはこういう人';
    return '<section class="card summary" id="guide-summary"><h2>' + title + '</h2><div class="sum-lines">' +
      '<div class="sum-item"><span class="lbl">' + ty('日干') + '＝あなた</span><p>' + kanYomi(r.dayStem) + '（' + esc(nk.img) + '）　' + esc(nk.text) + '</p></div>' +
      '<div class="sum-item"><span class="lbl">' + ty('五行') + 'の特徴</span><p>' + esc(gogyoSummaryLine(r)) + '</p></div>' +
      '<div class="sum-item"><span class="lbl">今年のひとこと</span><p>' + esc(yearLine) + '</p></div>' +
      '</div></section>';
  }
  function ryunenYear(r) {
    var t = r.input.target;
    return S.serial(t.y, t.m, t.d) < S.setsuPoint(t.y, 2, r.mode) ? t.y - 1 : t.y;
  }
  function currentForRyunenYear(r, year, currentYear) {
    // 6月1日はその年の立春後。
    return year === currentYear ? r.current :
      S.compute(Object.assign({}, r.input, { target: { y: year, m: 6, d: 1 } })).current;
  }
  function fortuneTimeline(bands, birthYear, year, kubouStart, pinLines) {
    var first = Math.min(year, bands.length ? birthYear + bands[0].from - 1 : year - 10);
    var last = Math.max(year + 14, bands.length ? birthYear + bands[bands.length - 1].to : year + 14);
    var step = 25, margin = 33, width = (last - first) * step + margin * 2;
    var x = function (y) { return margin + (y - first) * step; };
    var now = x(year + 0.5);
    var palette = ['#f4dff1', '#dceceb', '#ffedce', '#e5e4fa', '#eaf0d9'];
    var rects = '', labels = '', cycles = '';
    bands.forEach(function (d) {
      var start = birthYear + d.from - 1, end = birthYear + d.to;
      var active = start <= year && year < end;
      var fill = active ? '#ffd7e4' : palette[Math.floor((d.from - 1) / (d.to - d.from + 1)) % palette.length];
      rects += `<rect x="${x(start) + 1}" y="103" width="${x(end) - x(start) - 2}" height="73" rx="10" fill="${fill}" stroke="${active ? '#c9537b' : '#e6cdd6'}"/>`;
      labels += `<text x="${x((start + end) / 2)}" y="126" font-size="17" font-weight="bold">${esc(d.name)}</text>
        <text x="${x((start + end) / 2)}" y="147" font-size="13">${esc(d.stemStar)}</text>
        <text x="${x((start + end) / 2)}" y="166" font-size="12">${d.from}〜${d.to}歳</text>`;
    });
    for (var k = kubouStart + Math.floor((first - kubouStart) / 12) * 12; k < last; k += 12) {
      var left = Math.max(first, k), right = Math.min(last, k + 12);
      var middle = x((left + right) / 2);
      cycles += `<path d="M${x(left)},96 Q${middle},63 ${x(right)},96" fill="none" stroke="#df9eb2" stroke-width="1.5"/>`;
      if (right - left >= 6) labels += `<text x="${middle}" y="73" font-size="12" fill="#835464" stroke="#fff5f3" stroke-width="4" stroke-linejoin="round" paint-order="stroke">12年のひと回り</text>`;
      if (k + 2 <= first) continue;
      var end = Math.min(last, k + 2);
      var center = x((left + end) / 2);
      rects += `<rect x="${x(left)}" y="98" width="${x(end) - x(left)}" height="85" rx="5" fill="#77727e" opacity=".23"/>`;
      labels += `<text x="${center}" y="198" font-size="13" font-weight="bold">空亡</text>
        <text x="${center}" y="215" font-size="11">${left}${end - left === 2 ? '・' + (left + 1) : ''}</text>`;
    }
    var axis = `<path d="M${x(first)},229 H${x(last)}" stroke="#c8a8b4"/>`;
    for (var y = first; y < last; y++) {
      if (y !== first && (y % 5 !== 0 || y - first < 3)) continue;
      axis += `<path d="M${x(y)},225 v8" stroke="#c8a8b4"/><text x="${x(y)}" y="248" font-size="12">${y}年</text>`;
    }
    var pinLeft = Math.max(100, Math.min(width - 100, now));
    return `<div class="fortune-scroll" role="region" tabindex="0" aria-label="大運の年表（横にスクロールできます）">
      <svg class="fortune-timeline" role="img" aria-label="${esc(pinLines.join('、'))}" width="${width}" height="258" viewBox="0 0 ${width} 258" style="--fortune-width:${width}px" text-anchor="middle" fill="#624752">
        ${cycles}${rects}
        <path d="M${now},55 V110 M${now},170 V226" fill="none" stroke="#c24470" stroke-width="2"/>
        ${labels}${axis}
        <text x="${pinLeft}" y="16" font-size="14" font-weight="bold" fill="#9d345c">${esc(pinLines[0])}</text>
        <text x="${pinLeft}" y="34" font-size="12" fill="#9d345c">${esc(pinLines[1])}</text>
        <circle class="fortune-pin" cx="${now}" cy="53" r="13" fill="#be416c"/>
        <text x="${now}" y="58" font-size="13" font-weight="bold" fill="#fff">今</text>
      </svg></div>`;
  }
  function fortuneClock(year, branch, kubou) {
    var first = year - S.BRANCHES.indexOf(branch);
    var fills = { depart: '#f8d0de', challenge: '#fddcc4', focus: '#f9e6b8', growth: '#d8f3ec', inherit: '#e4d7f6', release: '#d9d5dc' };
    var point = function (radius, angle) {
      return [145 + radius * Math.cos(angle), 145 + radius * Math.sin(angle)];
    };
    var h = `<svg class="fortune-clock" viewBox="0 0 290 290" role="img" aria-label="12年の時計。今は${year}年の${branch}、空亡の地支は${kubou}" text-anchor="middle" dominant-baseline="central" fill="#624752">`;
    Array.from(S.BRANCHES).forEach(function (b, i) {
      var angle = i * Math.PI / 6 - Math.PI / 2, a = angle - Math.PI / 12, z = angle + Math.PI / 12;
      var active = b === branch;
      var phase = fortunePhaseAt(fortuneCycleOffset(b, kubou));
      var fill = active ? '#be416c' : (fills[phase.style] || '#fae0e8');
      var inner = 46, outer = 105;
      var label = point(75, angle), date = point(123, angle);
      h += `<path d="M${point(inner, a)} L${point(outer, a)} A${outer},${outer} 0 0 1 ${point(outer, z)}
        L${point(inner, z)} A${inner},${inner} 0 0 0 ${point(inner, a)} Z"
        fill="${fill}" stroke="${active ? '#9d345c' : '#fffaf7'}" stroke-width="${active ? 4 : 2}"/>
        <text x="${label[0]}" y="${label[1]}" font-size="18" font-weight="bold" fill="${active ? '#fff' : '#624752'}">${b}</text>
        <text x="${date[0]}" y="${date[1]}" font-size="11" ${active ? 'font-weight="bold" fill="#9d345c"' : ''}>${first + i}</text>`;
    });
    return h + `<text x="145" y="137" font-size="17" font-weight="bold">${year}年</text>
      <text x="145" y="157" font-size="13">${branch}年</text></svg>`;
  }
  var fortunePhaseTexts = {
    '旅立ち': ['学んだことを手に、自分の足で歩き出す2年です。まだ形は見えなくても大丈夫。人の声より自分の感覚を信じて、「次は何を大事にするか」を決めていきます。', '「これからやってみたいこと」を一つ書き出して、今週できる小さな一歩を決めてみてください。'],
    '挑戦と広がり': ['いろいろな流れがやってきて、あれこれ試してみる2年です。うまくいくかより、気になったことに手を出してみることが、次の時期の手がかりになります。', '気になる誘いや場所があれば、まず一度だけ試してみてください。やってみた感想を短くメモしておくと、あとで選ぶときの手がかりになります。'],
    '選択と集中': ['試してきたものの中から「これ」と決めて、人・モノ・カネを注ぎこむ2年です。広げることより、しぼって育てることを意識してみてください。', '続けたいことを一つ選び、そのために使う時間や予算を先に決めてみてください。ほかのことは、少しお休みしても大丈夫です。'],
    '成長と成果': ['注いできたものが大きく伸びて、外からも声がかかる2年です。成果が見えやすいぶん忙しくなるので、ひとりで抱えこまず、まわりと分け合っていきましょう。', '新しく引き受ける前に、今の予定に入るかを一度確かめてみてください。任せられることは、早めにまわりに頼んでみましょう。'],
    '整理と継承': ['伸びがひと段落して、やってきたことを振り返る2年です。体験を整理して言葉にし、人に教えたり渡したりすることで、それが次の人の力になります。', 'うまくいったやり方を、人に伝わる言葉でまとめてみてください。仲間や後輩に話してみると、自分の学びもはっきりします。'],
    '手放しと新たな学び': ['12年の巡りの区切りの2年です。これまでの成果を味わいながら、次に持っていくものと、ここで終わりにするものを選びます。自分から押すより、人にゆだねたほうがうまく運びやすい時期です。そのぶん、次の12年に使える新しいことを学んでおきましょう。', '終わりにしてよいことを一つ決めて、空いた時間で前から気になっていた分野を学んでみてください。迷うときは、信頼できる人の考えを聞いてみましょう。']
  };
  function fortunePhaseAt(offset) {
    if (!window.Hoshi || !window.Hoshi.phaseForOffset) {
      throw new Error('星の巡りの計算を読み込めませんでした');
    }
    return window.Hoshi.phaseForOffset(offset);
  }
  function fortunePhaseGuide(start, year, current) {
    var phases = window.Hoshi.phases;
    var blocks = phases.map(function (phase) {
      var first = start + phase.from;
      var years = Array.from({ length: phase.length }, function (_, i) {
        var y = first + i;
        return `<span title="${y}年"${y === year ? ' aria-current="date"' : ''}>${y === year ? '今' : ''}</span>`;
      }).join('');
      var active = phase.name === current.name;
      return `<li class="${esc(phase.style)} span-${phase.length}"${active ? ' aria-current="true"' : ''}>
        <strong>${esc(phase.name)}</strong><span class="fortune-phase-range">${first}–${first + phase.length - 1}</span>
        <div class="fortune-phase-track cols-${phase.length}">${years}</div></li>`;
    }).join('');
    var explanations = phases.map(function (phase) {
      var texts = fortunePhaseTexts[phase.name] || ['', ''];
      var active = phase.name === current.name;
      return `<div${active ? ' class="fortune-phase-active"' : ''}><dt>${esc(phase.name)}</dt>
        <dd>${esc(texts[0])}${active ? esc(texts[1]) : ''}</dd></div>`;
    }).join('');
    return `<p class="note fortune-preface">空亡を区切りにした12年の巡りは、四柱推命の十神の流れをもとにした、このサイト独自の読み方です。</p><p class="fortune-story">物語は「旅立ち」から始まります。自分の足で歩き出し、「挑戦と広がり」であれこれ試し、「選択と集中」でこれと決めたものに力を注ぎ、「成長と成果」で大きく伸びて、「整理と継承」で体験を人に渡します。そして空亡の「手放しと新たな学び」で次に持っていくものを選び、また新しい12年へと旅立っていきます。</p><ol class="fortune-phases" aria-label="今年を含む12年の流れ" role="list">${blocks}</ol>
      <dl class="fortune-phase-guide">${explanations}</dl>`;
  }
  function fortuneCycleOffset(branch, kubou) {
    return (S.BRANCHES.indexOf(branch) - S.BRANCHES.indexOf(kubou.charAt(0)) - 2 + 24) % 12;
  }
  function yearKubou(kanshi) {
    return ['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑'][Math.floor((S.kanshiIndex(kanshi) - 1) / 10)];
  }
  function fortuneRyunen(r, year) {
    var cards = '';
    for (var y = year - 3; y <= year + 6; y++) {
      var c = currentForRyunenYear(r, y, year), star = c.ryunen;
      var offset = fortuneCycleOffset(star.name.charAt(1), r.kubou);
      var phase = fortunePhaseAt(offset);
      cards += `<li class="fortune-ryunen-card"${y === year ? ' aria-current="date"' : ''}>
        <div class="fortune-ryunen-date"><strong>${y}年</strong>${y === year ? '<span>今年</span>' : ''}</div>
        <div class="fortune-ryunen-pillar"><strong>${esc(star.name)}</strong><span>${c.age >= 1 ? '数え' + c.age + '歳' : '生年より前'}</span></div>
        <div class="fortune-ryunen-stars"><strong>${ty(star.stemStar)}</strong><span>年支 ${ty(star.branchStar)}</span></div>
        <div class="fortune-ryunen-details"><span>大運 ${c.age >= 1 && c.daiun ? esc(c.daiun.name) : '—'}</span>
          <span>年の空亡: ${yearKubou(star.name)}</span></div>
        <div class="fortune-ryunen-tags">
          <span class="fortune-ryunen-phase" data-phase="${esc(phase.style)}">${esc(phase.name)}</span>
          ${phase.kubou ? '<span class="fortune-ryunen-kubou">空亡</span>' : ''}
        </div>
      </li>`;
    }
    return `<section id="guide-fortune-ryunen" aria-labelledby="fortune-ryunen-title">
      <h3 id="fortune-ryunen-title">年ごとの${ty('流年')}</h3>
      <ol class="fortune-ryunen-list" role="list">${cards}</ol>
    </section>`;
  }
  function fortuneHtml(r) {
    var c = r.current, info = r.daiunInfo;
    var year = ryunenYear(r), birthYear = year - c.age + 1;
    var branch = c.ryunen.name.charAt(1);
    var offset = fortuneCycleOffset(branch, r.kubou);
    var cycleStart = year - offset;
    var kubouStart = offset >= 10 ? cycleStart + 10 : cycleStart - 2;
    var phase = fortunePhaseAt(offset);
    var phaseYear = offset - phase.from + 1;
    var nextPhase = fortunePhaseAt((phase.from + phase.length) % 12);
    var nextYear = cycleStart + phase.from + phase.length;
    var phaseText = phase.name + 'の' + phaseYear + '年目';
    var span = function (start, end) { return '<span class="fortune-years">' + start + '〜' + end + '年</span>'; };
    var current = c.age >= 1 && c.daiun;
    var bands = info && c.age + 14 >= 1 ? daiunTo100(r, c.age - 10, c.age + 14) : [];
    var next = bands.find(function (d) { return current ? d.from === current.to + 1 : d.from === 1; });
    var step = current ? c.age - current.from + 1 : 0;
    var number = current ? (current.from - 1) / info.un + 1 : 0;
    var pinLines = [year + '年' + (c.age >= 1 ? '（数え' + c.age + '歳）' : ''), current ?
      number + '番目の大運・' + step + '年目' : c.age < 1 ? '生年より前' : '大運の表示なし'];
    var name = r.displayName ? esc(r.displayName) + 'さん' : 'あなた';
    var h = `<section class="card" id="guide-fortune"><h2>運勢</h2>
      <figure class="fortune-figure">
        <figcaption>${name}の大運と空亡サイクル</figcaption>
        <p class="fortune-note">${info ? '大運は' + info.un + '年ごと。' : ''}年と数え歳は立春で切り替わります。</p>
        ${fortuneTimeline(bands, birthYear, year, kubouStart, pinLines)}
        <p class="fortune-scroll-hint fortune-note">年表は左右にスクロールできます。</p>
        <div class="fortune-cycle">
          <div class="fortune-wheel"><h3>12年の時計</h3>${fortuneClock(year, branch, r.kubou)}</div>
          <ul class="fortune-legend">
            <li><i class="fortune-pink"></i>今年</li>
            <li><i class="phase-depart"></i>旅立ち</li>
            <li><i class="phase-challenge"></i>挑戦と広がり</li>
            <li><i class="phase-focus"></i>選択と集中</li>
            <li><i class="phase-growth"></i>成長と成果</li>
            <li><i class="phase-inherit"></i>整理と継承</li>
            <li><i class="phase-release"></i>手放しと新たな学び（空亡）</li>
          </ul>
        </div>
      </figure>
      <p class="hoshi-bar"><a class="hoshi-btn" href="hoshi.html">✦ 星の巡りを見る</a></p>
      <div class="fortune-reading"><div><h3>今の大運</h3>
        <p>${current ? '<strong>' + esc(current.name + '・' + current.stemStar + '・' + step + '年目') + '</strong>（' +
          span(birthYear + current.from - 1, birthYear + current.to - 1) + '）' : pinLines[1]}</p>
        ${next ? '<p>' + (current ? '次の大運' : '最初の大運') + ' <strong>' + esc(next.name) + '</strong> は ' + (birthYear + next.from - 1) + '年から。</p>' : ''}
      </div><div><h3>空亡サイクル</h3>
        <p><strong>${esc(phaseText)}</strong>。${nextYear}年から${esc(nextPhase.name)}。</p>
        ${fortunePhaseGuide(cycleStart, year, phase)}
        <p>${offset >= 10 ? '今の空亡' : '前回の空亡'}は${span(kubouStart, kubouStart + 1)}。次は${span(kubouStart + 12, kubouStart + 13)}。</p>
      </div></div>
      ${fortuneRyunen(r, year)}
    </section>`;
    return h;
  }
  function periodTable(head, rows, r, id) {
    var h = '<div class="stars-wrap"><table class="stars"' + (id ? ' id="' + id + '"' : '') +
      '><tr><th>' + head + '</th><th>' + ty('干支') + '</th><th>' + ty('通変星') + '</th><th>' + ty('十二運') + '</th><th>' + ty('地支') + '<br>' + ty('通変星') + '</th></tr>';
    var hasKubou = false;
    rows.forEach(function (row) {
      var d = row.star;
      var kubou = r.kubou && r.kubou.indexOf(d.name.charAt(1)) >= 0;
      if (kubou) hasKubou = true;
      h += '<tr' + (row.current ? ' class="cur" aria-current="true"' : '') + '><td>' + row.label +
        '</td><td>' + kanshiYomi(d.name) + (kubou ? '<span class="kubou-mark">空亡</span>' : '') + '</td><td>' +
        tyCell(d.stemStar) + '</td><td>' + tyCell(d.juniun) + '</td><td>' + tyCell(d.branchStar) + '</td></tr>';
    });
    h += '</table></div>';
    if (hasKubou) h += '<p class="note">空亡のめぐりのときは、ひと息ついて、自分のペースを大切にすると運が開けます。</p>';
    return h;
  }
  function ryunenTable(r) {
    var first = ryunenYear(r), rows = [];
    for (var y = first; y < first + 12; y++) {
      var current = y === first;
      var c = currentForRyunenYear(r, y, first);
      rows.push({ label: y + '年<br>（数え' + c.age + '歳）', star: c.ryunen, current: current });
    }
    return '<div class="unki-table" id="guide-ryunen"><h3>' + ty('流年') + 'のながれ</h3>' +
      '<p class="note">流年は立春で切り替わります。色のついた行が、鑑定する日を含む流年です。</p>' +
      periodTable('年<br>（数え歳）', rows, r, 'ryunen-table') + '</div>';
  }
  function unkiHeading(kind, item, r) {
    var ks = item ? kanshiYomi(item.name) : '';
    if (kind === 'daiun') {
      return 'この10年（' + ty('大運') + '）';
    }
    var tg = r.input && r.input.target;
    if (kind === 'year') return '今年（' + (tg ? ryunenYear(r) + '年' : '') + (ks ? '・' + ks : '') + '）';
    if (kind === 'month') return '今月' + (tg ? '（' + tg.m + '月' : '（') + (ks ? (tg ? '・' : '') + ks : '') + '）';
    if (kind === 'day') return '今日' + (tg ? '（' + tg.d + '日' : '（') + (ks ? (tg ? '・' : '') + ks : '') + '）';
    return '';
  }

  function luckElemSets(r) {
    var daiun = {}, ryunen = {};
    var add = function (set, name) {
      if (!name || name.length < 2) return;
      var se = S.STEM_ELEM[name.charAt(0)], be = S.BRANCH_ELEM[name.charAt(1)];
      if (se) set[se] = true;
      if (be) set[be] = true;
    };
    if (r.current && r.current.daiun) add(daiun, r.current.daiun.name);
    if (r.current && r.current.ryunen) add(ryunen, r.current.ryunen.name);
    return { daiun: daiun, ryunen: ryunen };
  }
  var SHENG_NEXT = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  var PARENT_ELEM = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
  var KE_PAIRS = [['木', '土'], ['土', '水'], ['水', '火'], ['火', '金'], ['金', '木']];
  function isShengAdj(a, b) { return SHENG_NEXT[a] === b || SHENG_NEXT[b] === a; }
  function isKePair(a, b) { return SHENG_NEXT[SHENG_NEXT[a]] === b || SHENG_NEXT[SHENG_NEXT[b]] === a; }
  function fillNowLine(e, luck, B) {
    var parts = [];
    if (luck.daiun[e]) parts.push(String(B.fillNowDaiun).replace(/○の気/g, e + 'の気').replace(/○/g, e));
    if (luck.ryunen[e]) parts.push(String(B.fillNowRyunen).replace(/○の気/g, e + 'の気').replace(/○/g, e));
    return parts.join('');
  }
  function gogyoBalanceItems(r) {
    var B = T.gogyoBalance, g = r.gogyo, E = GEL, luck = luckElemSets(r), items = [];
    if (!B) return items;
    E.forEach(function (e) {
      var n = g[e] || 0;
      var level = n === 0 ? 'zero' : n === 1 ? 'few' : n >= 3 ? 'many' : null;
      if (!level) return;
      var title = e + 'の気' + (level === 'zero' ? 'が少なめ' : level === 'few' ? 'が少なめ' : 'が多い');
      var text = B.elem[e][level];
      if (level === 'zero' || level === 'few') text += fillNowLine(e, luck, B);
      items.push({ title: title, text: text, pattern: title });
    });
    var ranked = E.map(function (e) { return { e: e, n: g[e] || 0 }; });
    ranked.sort(function (a, b) { return b.n - a.n || E.indexOf(a.e) - E.indexOf(b.e); });
    var maxn = ranked[0].n, zeroN = E.filter(function (e) { return (g[e] || 0) === 0; }).length;
    var allPresent = E.every(function (e) { return (g[e] || 0) >= 1; });
    var overall = null;
    if (maxn >= 4) {
      overall = { title: '全体の傾向：1つに強くかたよる', pattern: '1つに強くかたよる', text: String(B.overall.strongBias).replace(/○の気/g, ranked[0].e + 'の気').replace(/○/g, ranked[0].e) };
    } else {
      var e1 = ranked[0].e, e2 = ranked[1].e, sum2 = ranked[0].n + ranked[1].n;
      if (sum2 >= 5 && isShengAdj(e1, e2)) {
        overall = { title: '全体の傾向：相生で隣り合う2つに集中', pattern: '相生で隣り合う2つに集中', text: String(B.overall.shoseiFocus).replace(/○の気/g, e1 + 'の気').replace(/△の気/g, e2 + 'の気').replace(/○/g, e1).replace(/△/g, e2) };
      } else if (sum2 >= 5 && isKePair(e1, e2)) {
        overall = { title: '全体の傾向：相剋する2つに集中', pattern: '相剋する2つに集中', text: String(B.overall.shokokuFocus).replace(/○の気/g, e1 + 'の気').replace(/△の気/g, e2 + 'の気').replace(/○/g, e1).replace(/△/g, e2) };
      } else if (zeroN >= 2) {
        overall = { title: '全体の傾向：2つ以上の気が欠けている', pattern: '2つ以上欠け', text: B.overall.multiMissing };
      } else if (allPresent) {
        overall = { title: '全体の傾向：全部そろう', pattern: '全部そろう', text: B.overall.allPresent };
      }
    }
    if (overall) items.push(overall);
    var kokuBest = null;
    KE_PAIRS.forEach(function (pair) {
      var a = pair[0], b = pair[1], na = g[a] || 0, nb = g[b] || 0;
      if (na >= 3 && nb <= 1) {
        var gap = na - nb;
        if (!kokuBest || gap > kokuBest.gap) kokuBest = { a: a, b: b, gap: gap };
      }
    });
    if (kokuBest) {
      var kk = kokuBest.a + kokuBest.b;
      items.push({ title: '相剋の流れ：' + kokuBest.a + 'の気と' + kokuBest.b + 'の気', pattern: kokuBest.a + '剋' + kokuBest.b, text: B.koku[kk] });
    }
    var dayElem = S.STEM_ELEM[r.dayStem];
    var power = (g[dayElem] || 0) + (g[PARENT_ELEM[dayElem]] || 0);
    var nk = power >= 5 ? 'strong' : power >= 3 ? 'mid' : 'soft';
    var ntitle = nk === 'strong' ? '日干の力：強め' : nk === 'mid' ? '日干の力：中くらい' : '日干の力：まわりの力で伸びる';
    var npat = nk === 'strong' ? '日干が強め' : nk === 'mid' ? '日干が中くらい' : '日干はまわりの力で伸びる';
    items.push({ title: ntitle, pattern: npat, text: B.nikkan[nk] });
    return items;
  }

  function gogyoAdvice(g) {
    var E = ['木', '火', '土', '金', '水'], mx = Math.max.apply(null, E.map(function (e) { return g[e]; }));
    var many = E.filter(function (e) { return g[e] >= 3; }); if (!many.length) many = E.filter(function (e) { return g[e] === mx; }).slice(0, 1);
    var out = many.map(function (e) { return [e + 'がたっぷり', T.gogyoAdvice[e].many]; });
    E.filter(function (e) { return g[e] === 0; }).forEach(function (e) { out.push([e + 'をとり入れる', T.gogyoAdvice[e].few]); });
    return out;
  }
  function nikkanHtml(o) {
    var s = '<p class="lead">' + esc(o.text) + '</p>';
    Object.keys(o.secs || {}).forEach(function (k) { s += '<h4>' + esc(k) + '</h4>' + parasHtml(o.secs[k]); });
    return s;
  }
  function readInput(prefix) {
    prefix = prefix || '';
    var birthId = prefix ? prefix + 'Birth' : 'birth';
    var timeId = prefix ? prefix + 'Time' : 'time';
    var notimeId = prefix ? prefix + 'Notime' : 'notime';
    var genderId = prefix ? prefix + 'Gender' : 'gender';
    var b = ymd($(birthId).value);
    if (!b.y || b.y < 1901 || b.y > 2099) throw new Error('生年月日は1901〜2099年で入力してください');
    var hour = null, minute = 0;
    if (!$(notimeId).checked && $(timeId).value) { var t = $(timeId).value.split(':').map(Number); hour = t[0]; minute = t[1]; }
    var gender = $(genderId).value;
    var mode = $('mode') ? $('mode').value : 'precise';
    var zokanMode = $('zokanMode') ? $('zokanMode').value : 'since';
    var target = !prefix && $('target');
    if (target && target.validity.badInput) throw new Error('鑑定する日を日付で入力してください。');
    var tg = (target && target.value) ? ymd(target.value) : { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
    if (target && S.serial(tg.y, tg.m, tg.d) < S.serial(b.y, b.m, b.d)) {
      throw new Error('鑑定する日は、生年月日より前にできません。生年月日以降の日付を入れてください。');
    }
    return { y: b.y, m: b.m, d: b.d, hour: hour, minute: minute, gender: gender, mode: mode, zokanMode: zokanMode, target: tg };
  }

  function hasSetsuiriTimeNote(input) {
    if (input.mode !== 'precise' || (input.hour != null && input.hour !== '')) return false;
    var day = Math.floor(S.serial(input.y, input.m, input.d));
    for (var y = input.y - 1; y <= input.y + 1; y++) {
      for (var m = 1; m <= 12; m++) {
        var t = S.setsuPoint(y, m, input.mode);
        if (t > day && Math.floor(t) === day) return true;
      }
    }
    return false;
  }

  function setsuiriTimeNoteHtml(id, names) {
    return '<p id="' + id + '" class="note setsuiri-time-note">' +
      (names ? '<strong>' + esc(names) + '：</strong>' : '') +
      'この日は季節の変わり目のため、生まれた時間によって結果が変わることがあります。時間がわかれば入れてみてください。</p>';
  }

  var GEL = ['木', '火', '土', '金', '水'];
  var GCOL = { 木: '#9fdcc0', 火: '#f7a3bf', 土: '#f5cf94', 金: '#eedc8c', 水: '#a8cdf2' };
  function gogyoOrder(dayElem) {
    var i = GEL.indexOf(dayElem);
    if (i < 0) i = 0;
    return GEL.slice(i).concat(GEL.slice(0, i));
  }
  function gogyoGeom(gogyo, dayElem) {
    var cx = 180, cy = 165, R = 100, rad = Math.PI / 180;
    var order = gogyoOrder(dayElem);
    var nodes = order.map(function (e, i) {
      var a = (-90 + 72 * i) * rad, n = gogyo[e] || 0, rr = 14 + 5 * Math.min(n, 5);
      return { e: e, n: n, a: a, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), r: rr, day: e === dayElem };
    });
    var pt = function (a) { return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
    var arcs = nodes.map(function (p, i) {
      var q = nodes[(i + 1) % 5], a1 = p.a + (p.r + 5) / R, a2 = p.a + 72 * rad - (q.r + 7) / R, s1 = pt(a1), s2 = pt(a2);
      return 'M' + s1[0].toFixed(1) + ' ' + s1[1].toFixed(1) + ' A' + R + ' ' + R + ' 0 0 1 ' + s2[0].toFixed(1) + ' ' + s2[1].toFixed(1);
    });
    var lines = nodes.map(function (p, i) {
      var q = nodes[(i + 2) % 5], dx = q.x - p.x, dy = q.y - p.y, L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L;
      return [p.x + ux * (p.r + 4), p.y + uy * (p.r + 4), q.x - ux * (q.r + 7), q.y - uy * (q.r + 7)].map(function (v) { return +v.toFixed(1); });
    });
    var labels = nodes.map(function (p) {
      var d = R + p.r + 18, c = Math.cos(p.a), sn = Math.sin(p.a);
      return { x: +(cx + d * c).toFixed(1), y: +(cy + d * sn + (sn > 0.5 ? 12 : sn < -0.5 ? -2 : 5)).toFixed(1), anchor: Math.abs(c) < 0.3 ? 'middle' : c > 0 ? 'start' : 'end' };
    });
    return { nodes: nodes, arcs: arcs, lines: lines, labels: labels };
  }
  var MARK_R = 9;
  var MARK_COL = { plus: '#f24e94', yen: '#7a45e8', tri: '#0ea886', triF: '#f05648', cross: '#c43ad4', natal: '#5a3d4e' };
  function angNorm(d) { d = d % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; }
  function angAbs(a, b) { return Math.abs(angNorm(a - b)); }
  function markPos(p, deg, hr) {
    var h = hr == null ? p.r + 22 : hr;
    var a = deg * Math.PI / 180;
    return [+(p.x + h * Math.cos(a)).toFixed(1), +(p.y + h * Math.sin(a)).toFixed(1)];
  }
  function placeMarks(p, specs) {
    var outDeg = p.a * 180 / Math.PI, hr = p.r + 22;
    var slot = Math.max(26, (2 * MARK_R + 6) / hr * 180 / Math.PI);
    var items = [];
    specs.forEach(function (sp, si) {
      if (!sp.n) return;
      var base = outDeg + (si - (specs.length - 1) / 2) * slot;
      var inner = Math.max(18, (2 * MARK_R + 6) / hr * 180 / Math.PI);
      for (var j = 0; j < sp.n; j++) items.push({ deg: base + (sp.n > 1 ? (j - (sp.n - 1) / 2) * inner : 0), kind: sp.kind, color: sp.color });
    });
    return items;
  }
  function inwardXY(p, dist) {
    var a = p.a + Math.PI;
    return [+(p.x + dist * Math.cos(a)).toFixed(1), +(p.y + dist * Math.sin(a)).toFixed(1)];
  }
  function markSvg(x, y, kind, color) {
    var s = '<g transform="translate(' + x + ',' + y + ')">';
    s += '<circle r="' + MARK_R + '" fill="#fffef9" stroke="' + color + '" stroke-width="1.5"/>';
    var cap = ' stroke-linecap="round" stroke-linejoin="round"';
    if (kind === 'plus') s += '<path d="M-5 0 H5 M0 -5 V5" fill="none" stroke="' + color + '" stroke-width="2.4"' + cap + '/>';
    else if (kind === 'yen') {
      s += '<circle r="4.7" fill="none" stroke="' + color + '" stroke-width="2.2"/>';
      s += '<path d="M-4.1 0 H4.1 M0 -4.1 V4.1" fill="none" stroke="' + color + '" stroke-width="2.2"' + cap + '/>';
    } else if (kind === 'cross') s += '<path d="M-4.4 -4.4 L4.4 4.4 M4.4 -4.4 L-4.4 4.4" fill="none" stroke="' + color + '" stroke-width="2.6"' + cap + '/>';
    else if (kind === 'tri') s += '<path d="M0 -5.3 L5.4 4.3 L-5.4 4.3 Z" fill="none" stroke="' + color + '" stroke-width="2.3"' + cap + '/>';
    else if (kind === 'triF') s += '<path d="M0 -5.3 L5.4 4.3 L-5.4 4.3 Z" fill="' + color + '" stroke="' + color + '" stroke-width="1.2"' + cap + '/>';
    else if (kind === 'dot') s += '<circle r="4.4" fill="' + color + '"/>';
    return s + '</g>';
  }
  function dayTag(p, text) {
    var deg = (p.a + Math.PI) * 180 / Math.PI + 58, rad = deg * Math.PI / 180, dist = p.r + 16;
    var c = [p.x + dist * Math.cos(rad), p.y + dist * Math.sin(rad)];
    var fs = 9, w = String(text).length * fs + 14, h = 15;
    var x = Math.max(2, Math.min(358 - w, c[0] - w / 2)), y = Math.max(2, Math.min(348 - h, c[1] - h / 2));
    return '<g>' +
      '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '" fill="#ffe3ee" stroke="#f24e94" stroke-width="1.2"/>' +
      '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + 3.3).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="#c45a86">' + esc(text) + '</text>' +
      '</g>';
  }
  function gogyoSvg(r, sid, who) {
    sid = sid || 'g';
    who = who || 'あなた';
    var dayElem = r.groups['比劫'].elem, G = gogyoGeom(r.gogyo, dayElem), grp = {};
    var marks = S.gogyoMarks(r);
    Object.keys(r.groups).forEach(function (g) { grp[r.groups[g].elem] = g; });
    var s = '<svg class="gogyo" viewBox="0 0 360 350" role="img" aria-label="五行図">' +
      '<defs><marker id="' + sid + 'S" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ee8fb3"/></marker>' +
      '<marker id="' + sid + 'K" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#b9a3e3"/></marker></defs>';
    G.lines.forEach(function (l) { s += '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '" stroke="#c9b6ee" stroke-width="1.6" stroke-dasharray="4 4" marker-end="url(#' + sid + 'K)"/>'; });
    G.arcs.forEach(function (d) { s += '<path d="' + d + '" fill="none" stroke="#f2a7c3" stroke-width="2.6" marker-end="url(#' + sid + 'S)"/>'; });
    G.nodes.forEach(function (p, i) {
      var mk = marks[p.e];
      s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.r + '" fill="' + (p.n ? GCOL[p.e] : '#fff') + '" stroke="' + GCOL[p.e] + '" stroke-width="2"' + (p.n ? '' : ' stroke-dasharray="3 3"') + '/>';
      var fs = Math.max(13, Math.round(p.r * 0.7));
      var ty = p.n ? p.y - Math.min(5, p.r * 0.15) : p.y;
      s += '<text x="' + p.x.toFixed(1) + '" y="' + (ty + fs * 0.36).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" font-weight="bold" fill="#4a3b47">' + p.e + '</text>';
      if (p.n) {
        var gap = Math.min(7, (p.r * 1.4) / Math.max(p.n, 1));
        var x0 = p.x - (gap * (p.n - 1)) / 2, dy = p.y + Math.max(7, p.r * 0.38);
        for (var k = 0; k < p.n; k++) s += '<circle cx="' + (x0 + gap * k).toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="2.3" fill="#4a3b47"/>';
      }
      var placed = mk ? placeMarks(p, [
        { deg: -90, kind: 'cross', color: MARK_COL.cross, n: mk.getsurei ? 1 : 0 },
        { deg: -40, kind: 'plus', color: MARK_COL.plus, n: mk.daiun },
        { deg: -140, kind: 'yen', color: MARK_COL.yen, n: mk.ryunen },
        { deg: 150, kind: 'tri', color: MARK_COL.tri, n: mk.gou },
        { deg: 30, kind: 'triF', color: MARK_COL.triF, n: mk.sankyoku }
      ]) : [];
      placed.forEach(function (it) {
        var xy = markPos(p, it.deg);
        s += markSvg(xy[0], xy[1], it.kind, it.color);
      });
      var gl = inwardXY(p, p.r + 12);
      s += '<text x="' + gl[0] + '" y="' + (gl[1] + 4) + '" text-anchor="middle" font-size="11" fill="#8a6aa8">' + esc(grp[p.e]) + '</text>';
      if (p.day) s += dayTag(p, who);
    });
    return s + '</svg>';
  }
  function legendIcon(kind, color) {
    return '<svg width="18" height="18" viewBox="-10.5 -10.5 21 21" aria-hidden="true">' + markSvg(0, 0, kind, color) + '</svg>';
  }
  function legendHtml() {
    return '<div class="legend">' +
      '<span class="pill">' + legendIcon('dot', MARK_COL.natal) + '命式</span>' +
      '<span class="pill">' + legendIcon('plus', MARK_COL.plus) + '10年の運（大運）</span>' +
      '<span class="pill">' + legendIcon('yen', MARK_COL.yen) + '今年（流年）</span>' +
      '<span class="pill">' + legendIcon('tri', MARK_COL.tri) + '合</span>' +
      '<span class="pill">' + legendIcon('triF', MARK_COL.triF) + '三局</span>' +
      '<span class="pill">' + legendIcon('cross', MARK_COL.cross) + '季節（月令）</span>' +
      '</div>';
  }

  var REL_NAMES = { kangou: '干合', shigou: '支合', hankai: '半会', sankyoku: '三合局', chuu: '冲', tensen: '天戦地冲', kei: '刑', gai: '害', ha: '破' };
  function rolePhrase(lab) {
    var r = T.pillarRole && T.pillarRole[lab];
    if (!r) return lab;
    if (lab === '大運' || lab === '流年' || lab === '流月' || lab === '流日') return lab + '（' + r + '）';
    return lab + '柱（' + r + '）';
  }
  function parsePairLabels(s) {
    var m = String(s).match(/^([時日月年]|大運|流年|流月|流日)・([時日月年]|大運|流年|流月|流日)/);
    if (m) return [m[1], m[2]];
    var m2 = String(s).match(/\(([^)]+)\)－[^(]*\(([^)]+)\)/);
    return m2 ? [m2[1], m2[2]] : null;
  }
  function selfPairLine(kind, item) {
    var labs = parsePairLabels(item);
    if (!labs) return '';
    var a = rolePhrase(labs[0]), b = rolePhrase(labs[1]);
    var elem = (String(item).match(/→([木火土金水])/) || String(item).match(/（([木火土金水])局/) || [])[1];
    if (kind === 'kangou') return a + 'の天干と、' + b + 'の天干が干合し' + (elem ? '、' + elem + 'の気へととけ合います。' : 'ます。') + 'ふたつの分野の持ち味が混ざり、新しい流れを生みやすいサインです。';
    if (kind === 'shigou') return a + 'の地支と、' + b + 'の地支が支合し' + (elem ? '、' + elem + 'の気へととけ合います。' : 'ます。') + '生活のリズムがつながり、その分野どうしが支え合いやすいでしょう。';
    if (kind === 'chuu') return a + 'の地支と、' + b + 'の地支が冲です。ふたつの分野のペースが刺激し合い、動きが出やすいめぐりです。間合いを取ると、その刺激が前進の力に変わります。';
    if (kind === 'tensen') return a + 'と' + b + 'に、天戦地冲が見られます。変化の波がやや大きめに訪れやすい組み合わせなので、自分のペースと休みを大切にすると、成長のきっかけにしやすいでしょう。';
    if (kind === 'kei') return a + 'と' + b + 'に刑があります。自分の中のちがう分野の癖やこだわりが見えやすいサイン。ゆるやかに整えると、学びとして活きていきます。';
    if (kind === 'gai') return a + 'と' + b + 'に害があります。感じ方がすこしすれやすい組み合わせです。急がず気持ちを確かめると、安心が深まります。';
    if (kind === 'ha') return a + 'と' + b + 'に破があります。流れが切り替わりやすいめぐりなので、習慣や役割の見直しがしやすい時期です。';
    return '';
  }
  function relPairNotes(rel, skip) {
    skip = skip || {};
    var elemTx = T.gouElemSelf || T.gouElem || {};
    var s = '', seen = {};
    Object.keys(REL_NAMES).forEach(function (k) {
      if (!(rel[k] && rel[k].length)) return;
      rel[k].forEach(function (x) {
        if (skip[k] && skip[k].indexOf(x) >= 0) return;
        var line = selfPairLine(k, x);
        if (line) s += '<p>' + esc(line) + '</p>';
      });
      if (k === 'kangou' || k === 'shigou' || k === 'hankai' || k === 'sankyoku') {
        rel[k].forEach(function (x) {
          if (skip[k] && skip[k].indexOf(x) >= 0) return;
          var m = String(x).match(/→([木火土金水])/) || String(x).match(/（([木火土金水])局/);
          if (m && elemTx[m[1]] && !seen[m[1]]) { seen[m[1]] = 1; s += '<p>' + esc(elemTx[m[1]]) + '</p>'; }
        });
      }
    });
    return s;
  }
  function yomiOf(ch) { return (T.yomi && T.yomi[ch]) || ''; }
  function kanYomi(ch) {
    var y = yomiOf(ch);
    if (!ch) return '—';
    if (!y) return esc(ch);
    var ys = y.length >= 5 ? ' ky-long' : (y.length >= 4 ? ' ky-mid' : '');
    return '<a class="kan-yomi' + ys + '" href="#t-' + encodeURIComponent(ch) + '" title="' + esc(ch) + '（' + esc(y) + '）"><span class="ky-k">' + esc(ch) + '</span><span class="ky-y">' + esc(y) + '</span></a>';
  }
  function kanshiYomi(name) {
    if (!name) return '—';
    var html = '';
    for (var i = 0; i < name.length; i++) html += kanYomi(name.charAt(i));
    return '<span class="kanshi-yomi">' + html + '</span>';
  }

  var _termKeys = null;
  function termKeys() {
    if (_termKeys) return _termKeys;
    var a = Object.keys(T.termYomi || {}), b = Object.keys(T.nayinYomi || {});
    _termKeys = a.concat(b).sort(function (x, y) { return y.length - x.length; });
    return _termKeys;
  }
  function termOf(kanji) { return (T.termYomi && T.termYomi[kanji]) || (T.nayinYomi && T.nayinYomi[kanji]) || ''; }
  function ty(term, entry) {
    var y = termOf(term) || termOf(entry);
    if (!term) return '';
    if (!y) return esc(term);
    var nayin = !!(T.nayinYomi && T.nayinYomi[term]);
    var cls = 'term-yomi' + (nayin ? ' ty-nayin' : '') + (y.length >= 6 ? ' ty-long' : y.length >= 4 ? ' ty-mid' : '');
    return '<a class="' + cls + '" href="#t-' + encodeURIComponent(entry || term) + '" title="' + esc(term) + '（' + esc(y) + '）"><span class="ty-k">' + esc(term) + '</span><span class="ty-y">' + esc(y) + '</span></a>';
  }
  function tyWrap(s) {
    s = String(s == null ? '' : s);
    if (!s) return '';
    if (T.termYomi && T.termYomi[s]) return ty(s);
    var keys = termKeys(), out = '', i = 0;
    while (i < s.length) {
      var hit = null;
      for (var k = 0; k < keys.length; k++) {
        if (s.indexOf(keys[k], i) === i) { hit = keys[k]; break; }
      }
      if (hit) { out += ty(hit); i += hit.length; }
      else { out += esc(s.charAt(i)); i++; }
    }
    return out;
  }
  function tyCell(s) {
    if (s == null || s === '') return '—';
    return (T.termYomi && T.termYomi[s]) ? ty(s) : tyWrap(s);
  }
  function meishikiTable(r) {
    var P = r.pillars, cols = ['hour', 'day', 'month', 'year'], lab = { hour: '時柱', day: '日柱', month: '月柱', year: '年柱' };
    function row(name, f, cls) {
      return '<tr><th>' + name + '</th>' + cols.map(function (c) { var p = P[c]; return '<td class="' + (cls || '') + (c === 'day' ? ' day' : '') + '">' + (p ? f(p) : '—') + '</td>'; }).join('') + '</tr>';
    }
    var h = '<table class="meishiki"><tr><th></th>' + cols.map(function (c) { return '<th>' + ty(lab[c]) + '</th>'; }).join('') + '</tr>';
    h += row(qText('tenkan', '天干'), function (p) { return kanYomi(p.stem); }, 'big');
    h += row(qText('chishi', '地支'), function (p) { return kanYomi(p.branch); }, 'big');
    h += row(ty('天干') + '<br>' + ty('通変星') + qTip('tsuhen', '通変星'), function (p) {
      var s = p.stemStar;
      if (s === '（日主）' || s === '日主') return '<span class="cell-unit meishiki-star">' + ty('日主') + '</span>';
      return '<span class="cell-unit meishiki-star">' + tyCell(s) + '</span>';
    });
    h += row(qText('juniun', '十二運'), function (p) { return '<span class="cell-unit">' + tyCell(p.juniun) + '</span>'; });
    h += row(ty('地支') + '<br>' + ty('通変星') + qTip('tsuhen', '通変星'), function (p) { return '<span class="cell-unit">' + tyCell(p.branchStar) + '</span>'; });
    h += row(qText('zokan', '蔵干'), function (p) { return '<span class="cell-stack">' + kanYomi(p.zokan) + '<span class="cell-unit meishiki-star">' + tyCell(p.zokanStar) + '</span></span>'; });
    h += row(qText('nayin', '納音'), function (p) { return '<span class="cell-unit">' + tyCell(p.nayin) + '</span>'; });
    h += '</table><p class="meishiki-kubou">' + ty('空亡', '空亡') + '　' + kanshiYomi(r.kubou) + '</p>';
    return h;
  }
  function pointRow(label, value) {
    return '<div class="point-label">' + label + '</div><div>' + value + '</div>';
  }
  function pointDates(r) {
    return pointRow(ty('節入り'), '<span class="point-date">' + esc(r.setsu.prevName) + ' ' + fmtD(r.setsu.prevDate) +
      '</span> ／ <span class="point-date">次 ' + esc(r.setsu.nextName) + ' ' + fmtD(r.setsu.nextDate) + '</span>') +
      pointRow(ty('蔵干判定日数'), r.zokanDays + '日');
  }
  function pointsKv(r) {
    var mk = r.meikyu ? kanshiYomi(r.meikyu.name) + '（' + tyCell(r.meikyu.stemStar) + '・' + tyCell(r.meikyu.juniun) + '）' : '— （時刻が必要）';
    var h = '<div class="kv points-kv">' +
      pointRow(ty('日干'), kanYomi(r.dayStem) + '（' + esc(T.nikkan[r.dayStem].img) + '）') +
      pointRow(ty('月令'), ty(r.getsurei.name, '月令') + '（' + esc(r.getsurei.season) + '生まれ）') +
      pointRow(ty('空亡'), kanshiYomi(r.kubou)) +
      pointRow(ty('天乙貴人'), kanshiYomi(r.tenotsu)) +
      pointRow(ty('天徳（合）', '天徳貴人'), kanshiYomi(r.tentoku)) +
      pointRow(ty('羊刃'), kanshiYomi(r.youjin)) +
      pointRow(ty('納音（日柱）', '納音'), tyCell(r.nayinDay)) +
      pointRow(ty('命宮'), mk) + pointDates(r);
    Object.keys(CALM_RELATIONS).forEach(function (key) {
      var pairs = r.relations[key].map(function (item) { return natalPairSource(r, item); });
      if (pairs.length) h += pointRow(ty(REL_NAMES[key]), esc(pairs.join('、')));
    });
    return h + '</div>';
  }


  var guideOn = false, tourStep = 0, tourDismissed = false, lastK = null, lastA = null, openTipId = null;
  var TIPS = {
    meishiki: { t: '命式', b: '生まれたときの四つの柱を、一枚の表にしたものです。時・日・月・年の組み合わせが、あなたのリズムを教えてくれます。' },
    tenkan: { t: '天干', b: '十種類の「天のきぶん」です（甲・乙・丙・丁・戊・己・庚・辛・壬・癸）。柱の上の文字で、その柱の方向や雰囲気を見ます。' },
    chishi: { t: '地支', b: '十二種類の「地のリズム」です（子・丑・寅・卯・辰・巳・午・未・申・酉・戌・亥）。柱の下の文字で、暮らしのペースに近いサインを見ます。' },
    tsuhen: { t: '通変星', b: '日干から見た、それぞれの天干の役割の名前です。良い悪いではなく、「力の使い方」をわかりやすい言葉で示してくれます。' },
    juniun: { t: '十二運', b: 'その柱のエネルギーが、めばえ・盛り・ひとやすみなど、どの段階にいるかを十二の目安で見たものです。調子の波を知る手がかりです。' },
    zokan: { t: '蔵干', b: '地支の中に隠れている天干です。表に出にくい、内側の気配を見るときに使います。' },
    nayin: { t: '納音', b: 'この柱の雰囲気を、ひとつの質感や音色で表した呼び名です。日々のあなたらしさに、そっと色を添えます。' },
    nikkan: { t: '日干', b: '日柱の天干で、あなたのまんなかの気質です。五行図では「あなた」（相性では「お相手」）のラベルがつきます。' },
    gogyo: { t: '五行', b: '木・火・土・金・水の五つの気です。どれが多い・少ないが欠点なのではなく、今ある力の活かし方と、とり入れると伸びるヒントです。' },
    marks: { t: '五行図の記号', b: '●は命式の数。＋は十年の運（大運）、⊕は今年（流年）、△は合、▲は三局、×は生まれ月の季節。記号は、各まるの外側にいつも同じ並びでつきます。' },
    anata: { t: '「あなた」のラベル', b: '日干の五行、つまりあなたのまんなかの気があるまるです。相性では、左側が「あなた」、右側が「お相手」です。' },
    daiun: { t: '大運', b: 'およそ十年ごとのテーマです。今の時期に、どんな力を活かしやすいかを見る目安になります。' },
    ryunen: { t: '流年', b: '今年一年の流れです。今年の過ごし方を整えるときの、やさしいヒントになります。' },
    ryugetsu: { t: '月運', b: '今月の小さな流れです。日々の調子を整えるときの参考になります。' },
    gou: { t: '合', b: '気と気が出会って、新しいリズムが生まれやすい関係です。力を合わせたり、役割を分けたりすると活きやすいでしょう。' },
    chuu: { t: '冲', b: 'おたがいのペースがはっきり見えやすい関係です。こわい意味ではなく、間合いを取ると、その刺激が前進の力に変わります。' },
    aisho: { t: '相性', b: 'ふたりの命式を並べて、日干を中心に「どう活かし合えるか」を見るものです。決まった答えを出すものではありません。' },
    dayrel: { t: '日干の関係', b: 'おふたりのまんなかの気どうしの流れです。同じ五行（比和）、育て合う流れ（相生）、引きしめる流れ（相剋）などがあります。' },
    hiwa: { t: '比和', b: '同じ五行どうし。感じ方や大切にしたいことが響き合いやすい組み合わせです。似ているからこそ、ちがいを楽しむと新鮮です。' },
    shosei: { t: '相生', b: '一方の気が、もう一方を育てる流れです。後押しと受けとめが自然に生まれやすいでしょう。' },
    shokoku: { t: '相剋', b: '一方の気が、もう一方を引きしめる流れです。ぶつかりというより、磨いて伸びるきっかけにもなります。' }
  };
  var TIPS_SELF = {
    gou: { t: '合', b: '合は、あなたの柱どうし、または大運・流年とその柱が結び合う流れです。干合はふたつの天干、支合はふたつの地支が、ひとつの五行へととけ合います。年柱はルーツや家族、月柱は社会や仕事、日柱は自分やパートナー、時柱はこれからや子どもです。' },
    kangou: { t: '干合', b: '命式のなかのふたつの天干が結び合い、ひとつの五行へととけ合う流れです。その柱があらわす分野（年＝ルーツや家族、月＝社会や仕事、日＝自分やパートナー、時＝これからや子ども）の持ち味が混ざります。大運や流年との干合は、その時期の気が柱と結び合うサインです。' },
    shigou: { t: '支合', b: '命式のなかのふたつの地支が寄り添い、ひとつの五行へととけ合う流れです。生活のリズムがつながり、その分野どうしが支え合いやすいでしょう。大運や流年との支合は、その時期のリズムが柱となじむめぐりです。' },
    hankai: { t: '半会', b: '同じ五行の三合局のうち、ふたつの地支がそろっている状態です。同じ方向のテーマが半分ずつ芽生えているサイン。学びや習慣で足りない一角を補うと、まとまりやすくなります。' },
    sankyoku: { t: '三局', b: '同じ方向の地支が三つそろい、ひとつの五行に力が集まりやすいめぐりです。命式や大運・流年を含めたときに見られると、そのテーマが生活のなかでまとまりやすくなります。' },
    chuu: { t: '冲', b: '命式のなかのふたつの地支が向かい合い、刺激が生まれやすい流れです。こわい意味ではなく、ふたつの分野のペースが動き出すサイン。大運や流年との冲は、その時期に変化の波が来やすいめぐりです。' },
    tensen: { t: '天戦地冲', b: '天干と地支の両方で冲に近い刺激が重なる組み合わせです。命式や大運・流年のなかで見られると、変化の波がやや大きめに訪れやすいでしょう。自分のペースと休みを大切にすると、成長のきっかけにしやすいでしょう。' },
    kei: { t: '刑', b: '命式のなかの地支どうしで、癖やこだわりが出やすい組み合わせです。自分の中の異なる分野が、互いのやり方を映し出しやすいサイン。ゆるやかに整えると、学びとして活きていきます。' },
    gai: { t: '害', b: '感じ方のすれが生まれやすい地支の組み合わせです。ふたつの分野の気持ちが、すこし食い違いやすいサイン。急がず自分の気持ちを確かめると、安心が深まります。' },
    ha: { t: '破', b: 'これまでの流れが切り替わりやすい地支の組み合わせです。命式や大運・流年のなかで見られると、習慣や役割の見直しがしやすい時期です。' },
    daiun: { t: '大運', b: 'およそ十年ごとのテーマで、いまの命式に重なる「時期の気」です。柱と合していると、その分野と時期の気が結び合います。今の時期に、どんな力を活かしやすいかを見る目安です。' },
    ryunen: { t: '流年', b: '今年一年の流れで、命式に重なる今年の気です。柱と合していると、その分野と今年のリズムが結び合います。今年の過ごし方を整えるときのヒントになります。' },
    ryugetsu: { t: '月運', b: '今月の小さな流れで、命式に重なる今月の気です。日々の調子を整えるときの参考になります。' },
    marks: { t: '五行図の記号', b: '●は命式の数。＋は十年の運（大運）、⊕は今年（流年）、△は命式や大運・流年の中の合、▲は三局、×は生まれ月の季節。記号は、各まるの外側にいつも同じ並びでつきます。' }
  };
  function tipOf(id) {
    var aisho = $('panel-aisho') && $('panel-aisho').classList.contains('on');
    if (!aisho && TIPS_SELF[id]) return TIPS_SELF[id];
    return TIPS[id];
  }
  function qTip(id, label) {
    if (!guideOn || !tipOf(id)) return '';
    return '<button type="button" class="qbtn" data-tip="' + id + '" aria-label="' + esc(label || tipOf(id).t) + 'の説明">？</button>';
  }
  function qText(id, text) { return ty(text) + qTip(id, text); }
  function closeTip() {
    var pop = $('qpop'); if (!pop) return;
    pop.hidden = true; pop.innerHTML = ''; openTipId = null;
  }
  function showTip(id, btn) {
    var tip = tipOf(id), pop = $('qpop');
    if (!tip || !pop) return;
    if (openTipId === id) { closeTip(); return; }
    openTipId = id;
    pop.innerHTML = '<b>' + esc(tip.t) + '</b><p>' + esc(tip.b) + '</p>';
    pop.hidden = false;
    var r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.max(8, Math.min(vw - pw - 8, r.left + r.width / 2 - pw / 2));
    var top = r.bottom + 8;
    if (top + ph > vh - 12) top = Math.max(8, r.top - ph - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function tourStepsK(r) {
    var day = r && r.pillars && r.pillars.day, stem = r ? r.dayStem : '', img = stem && T.nikkan[stem] ? T.nikkan[stem].img : '';
    return [
      { tg: null, title: 'はじめてガイド', body: '結果の見方を、いっしょにひととおり歩きます。むずかしい言葉のそばにある「？」を押すと、いつでも短い説明が出ます。' },
      { tg: 'guide-summary', title: 'まずはここから', body: 'いちばん上に、日干（あなた）、五行の特徴、今年のひとことをまとめました。鑑定で出てくる命式は、あなたという人の取扱説明書。大運や流年は、人生の天気予報のようなものです。まずはこの3行だけ読んでも大丈夫です。' + (stem ? 'いまの日干は「' + stem + '」（' + img + '）です。' : '') },
      { tg: 'guide-meishiki', title: 'これが命式です', body: '時・日・月・年の四つの柱が並んでいます。日の柱が、あなたのまんなかです。占い師さんから表をもらえなくても、ここで自分の命式を確認できます。' + (day ? 'いまの日柱は「' + day.name + '」です。' : '') },
      { tg: 'guide-honmei', title: 'あなたの本質（日干）', body: 'いつの時期も変わらない、あなたの芯がここにあります。未来を縛るものではなく、今ある力の地図です。' },
      { tg: 'guide-month', title: '人生の中心（月の柱）', body: '月の柱は、成年期（働き盛り）を見る、命式のなかでもいちばん大切に見られる、人生の中心です。天の通変星と、地の蔵干の深みをあわせて読みます。' },
      { tg: 'guide-stages', title: '人生の時期', body: '年・月・日・時の柱を、人生の流れの目安として並べています。若いころ、成年期（働き盛り）、人生を通じての自分、晩年、という読み方です。年齢の数字では区切りません。' },
      { tg: 'guide-rels', title: '命式の中の結びつき', body: '干合は天のきぶんどうし、支合は地のリズムどうしが手をつなぐ流れです。こわい意味ではなく、分野が混ざったり支え合ったりするサインとして読みます。' },
      { tg: 'guide-gogyo', title: '五行のバランス', body: '結びつきも含めて見た、五つの気のバランスです。いちばん上はあなたの日干の五行。丸の大きさや●の数は量です。「ない」ことは欠点ではなく、人・暮らし・時期で補うと伸びるヒントです。' },
      { tg: 'guide-unki', title: '大運・今年・今月', body: '大運は数年〜十年ごとの大きなテーマ、流年は今年、月運は今月、流日は今日の流れです。見出しごとに短く読めるようにしてあります。' },
      { tg: null, title: 'ガイドはここまで', body: 'お疲れさまでした。あとは「？」をタップすると、言葉の意味をすぐ確認できます。あなたのペースで読んでみてください。' }
    ];
  }
  function tourStepsA(rA, rB, na, nb) {
    na = na || 'あなた'; nb = nb || 'お相手';
    var sa = rA ? rA.dayStem : '', sb = rB ? rB.dayStem : '';
    return [
      { tg: null, title: '相性の見方', body: 'ふたりの命式を並べて、「どう活かし合えるか」を見ます。決まった点数や良い悪いを出すものではありません。' },
      { tg: 'guide-a-sum', title: 'まずはまとめから', body: 'いちばん上に、おふたりの日干と関係の要点をまとめました。まずはそこから読んでみてください。' },
      { tg: 'guide-a-mei', title: 'ふたりの命式', body: na + 'と' + nb + 'の四つの柱を並べています。占い師さんから表をもらえなくても、ここでおふたりの命式を確認できます。' },
      { tg: 'guide-a-gogyo', title: '五行のバランス', body: '図と棒グラフに続いて、比劫から印星へと進み、比劫に戻る流れから、ふたりがどこで補い合えるかを見ます。' },
      { tg: 'guide-a-read', title: '相性の鑑定', body: '日干を中心に、お互いのエネルギーをどう生かすかを書いた文章です。相手を変えるより、自分の力の使い方を整えることが鍵です。' },
      { tg: 'guide-a-day', title: '日干の関係', body: 'おふたりのまんなかの気どうしの流れです。' + (sa && sb ? na + 'は「' + sa + '」、' + nb + 'は「' + sb + '」。' : '') + '比和・相生・相剋は、育て合い方のちがいを示す言葉です。' },
      { tg: 'guide-a-rels', title: 'ふたりの結びつき', body: '柱どうしの干合や支合、冲などを見ます。合は新しい流れ、冲はペースのちがいが見えやすいサインです。' },
      { tg: null, title: 'ガイドはここまで', body: '「？」からも、言葉の意味をすぐ確認できます。ふたりらしい調和のヒントとして、ゆるく読んでみてください。' }
    ];
  }
  function currentSteps() {
    var aisho = $('panel-aisho') && $('panel-aisho').classList.contains('on');
    return aisho ? tourStepsA(lastA && lastA.rA, lastA && lastA.rB, lastA && lastA.na, lastA && lastA.nb) : tourStepsK(lastK);
  }
  function clearHighlight() {
    var nodes = document.querySelectorAll('.guide-hl');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('guide-hl');
  }
  function updateTour() {
    var box = $('tour');
    if (!box) return;
    if (!guideOn || tourDismissed) { box.hidden = true; clearHighlight(); return; }
    var steps = currentSteps();
    if (tourStep < 0) tourStep = 0;
    if (tourStep > steps.length - 1) tourStep = steps.length - 1;
    var s = steps[tourStep];
    box.hidden = false;
    box.innerHTML = '<div class="tour-top"><b>' + esc(s.title) + '</b><span class="num">' + (tourStep + 1) + ' / ' + steps.length + '</span><button type="button" class="tour-x" id="tourClose" aria-label="ツアーを閉じる">×</button></div><p>' + esc(s.body) + '</p><div class="tour-nav"><button type="button" class="prev" id="tourPrev"' + (tourStep === 0 ? ' disabled' : '') + '>戻る</button><button type="button" class="next" id="tourNext">' + (tourStep === steps.length - 1 ? 'おわり' : '次へ') + '</button></div>';
    clearHighlight();
    if (s.tg) {
      var el = document.getElementById(s.tg);
      if (el) {
        var det = el.closest ? el.closest('details') : null;
        if (det) det.open = true;
        el.classList.add('guide-hl');
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
      }
    }
  }
  function setGuide(on) {
    guideOn = !!on;
    tourDismissed = false;
    if (on) tourStep = 0;
    document.body.classList.toggle('guide-on', guideOn);
    var btn = $('guideToggle');
    if (btn) { btn.classList.toggle('on', guideOn); btn.setAttribute('aria-pressed', guideOn ? 'true' : 'false'); }
    closeTip();
    if (lastK) render(lastK);
    if (lastA) renderCompat(lastA.rA, lastA.rB, lastA.na, lastA.nb);
    updateTour();
  }

  function gogyoPlain() { return T.gogyoPlain || {}; }
  function elemGloss(e, short) {
    var P = gogyoPlain();
    var g = short ? (P.glossShort || P.gloss) : (P.gloss || {});
    return g[e] || '';
  }
  function elemPhrase(e, withGloss, short) {
    var g = withGloss ? elemGloss(e, short) : '';
    return e + 'の気' + (g ? '（' + g + '）' : '');
  }
  function fillHints(e) {
    var P = gogyoPlain();
    var parts = [];
    if (P.people && P.people[e]) parts.push(P.people[e]);
    if (P.life && P.life[e]) parts.push(P.life[e]);
    if (P.time && P.time[e]) parts.push(P.time[e]);
    return parts;
  }
  function subElemToken(text, token, e) {
    var phrase = elemPhrase(e, true);
    var re1 = new RegExp(token + 'の気', 'g');
    var re2 = new RegExp(token, 'g');
    return String(text).replace(re1, phrase).replace(re2, phrase);
  }

  var ZOKAN_LAYERS = {
    子: [{ k: '本気', stem: '癸' }],
    丑: [{ k: '余気', stem: '癸' }, { k: '中気', stem: '辛' }, { k: '本気', stem: '己' }],
    寅: [{ k: '余気', stem: '戊' }, { k: '中気', stem: '丙' }, { k: '本気', stem: '甲' }],
    卯: [{ k: '本気', stem: '乙' }],
    辰: [{ k: '余気', stem: '乙' }, { k: '中気', stem: '癸' }, { k: '本気', stem: '戊' }],
    巳: [{ k: '余気', stem: '戊' }, { k: '中気', stem: '庚' }, { k: '本気', stem: '丙' }],
    午: [{ k: '中気', stem: '己' }, { k: '本気', stem: '丁' }],
    未: [{ k: '余気', stem: '丁' }, { k: '中気', stem: '乙' }, { k: '本気', stem: '己' }],
    申: [{ k: '余気', stem: '戊' }, { k: '中気', stem: '壬' }, { k: '本気', stem: '庚' }],
    酉: [{ k: '本気', stem: '辛' }],
    戌: [{ k: '余気', stem: '辛' }, { k: '中気', stem: '丁' }, { k: '本気', stem: '戊' }],
    亥: [{ k: '中気', stem: '甲' }, { k: '本気', stem: '壬' }]
  };

  function starSoft(star) {
    if (!star || star === '（日主）' || star === '日主') return ty('日主');
    return tyCell(star);
  }
  function pillarStarHtml(star) {
    return starSoft(star) + '（' + esc(T.pillarStars[star][0]) + '）';
  }

  function pillarAction(p, key) {
    var visible = T.pillarStars[p.stemStar];
    var inner = T.pillarStars[p.zokanStar];
    var step = T.pillarStages[p.juniun][1];
    var check = '「' + inner[2] + '」';
    if (key === 'year') return '学校や家で興味を持ったことに取り組むなら、' + step + '、' + visible[1] + 'と、' + check + 'を確かめやすくなります。';
    if (key === 'month') return '仕事で迷ったら、' + check + 'を目安に、' + step + '、' + visible[1] + 'ところから。';
    if (key === 'hour') return '趣味や地域の活動では、' + check + 'を考えながら、' + step + '、' + visible[1] + '機会を作ってみてください。';
    return '毎日の暮らしでは、' + step + '、' + inner[1] + 'ところから始めてみてください。';
  }

  function zokanLayersHtml(pillar, r) {
    if (!pillar) return '';
    var layers = ZOKAN_LAYERS[pillar.branch] || [];
    var active = pillar.zokan;
    var h = '<p class="note">' + esc(T.zokanIntro || '') + '</p>';
    h += '<ul class="zokan-layers">';
    layers.forEach(function (ly) {
      var on = ly.stem === active;
      var st = S.tsuhen(r.pillars.day.idx, ly.stem);
      h += '<li class="' + (on ? 'on' : '') + '"><b>' + ty(ly.k) + '</b>　' + kanYomi(ly.stem) + '（' + starSoft(st) + '）';
      if (on) h += '　<span class="now">いま表に出ている蔵干</span>';
      h += '</li>';
    });
    h += '</ul>';
    if (active && layers.every(function (ly) { return ly.stem !== active; })) {
      h += '<p>いま表に出ている蔵干は、' + kanYomi(active) + '（' + starSoft(pillar.zokanStar) + '）です。</p>';
    }
    return h;
  }

  function monthCoreHtml(r) {
    var mon = r.pillars.month;
    var h = '<section class="card text featured" id="guide-month"><h2>人生の中心（' + ty('月柱') + '）</h2>';
    h += '<p class="note">' + esc(T.monthCoreIntro || '') + '</p>';
    h += '<h3>' + ty('月柱') + 'の天干の' + ty('通変星') + '（' + starSoft(mon.stemStar) + '）</h3>';
    h += parasHtml(tsuText(mon.stemStar));
    h += '<h3>社会で育てていく持ち味（' + ty('格局') + '：' + tyWrap(r.kakkyoku) + '）</h3>';
    h += '<p>仕事や人と関わるとき、あなたの持ち味はこんなふうに生きてきます。</p>';
    h += parasHtml(tsuKaku(r.genmei));
    if (mon.juniun) {
      h += '<h3>' + ty('十二運') + 'の現れ方（' + tyCell(mon.juniun) + '）</h3>';
      if (['死', '墓', '絶', '病'].indexOf(mon.juniun) >= 0) {
        h += '<p class="note">この名前は、怖い出来事を意味するものではありません。今のあなたに、どんな力が働きやすいかを示す言葉です。</p>';
      }
      h += parasHtml(junText(mon.juniun));
    }
    h += '<p class="ikashi"><b>生かし方：</b>' + esc(pillarAction(mon, 'month')) + '</p>';
    return h + '</section>';
  }

  function dayStageBody(p, elements) {
    var features = T.nicchu[p.name];
    var romanceHeadings = ['好きになり方', '恋人といるときのあなた', '合う相手', '気をつけたいこととひと工夫'];
    var romance = T.dayRomance[p.name].map(function (paragraph, i) {
      return '<h5>' + romanceHeadings[i] + '</h5><p>' + esc(paragraph) + '</p>';
    }).join('');
    var stage = T.pillarStages[p.juniun];
    return '<h4>特徴</h4><p class="stage-signs">' + elements + esc(splitSentences(features).slice(0, 2).join('')) +
      '内側では、蔵干の' + pillarStarHtml(p.zokanStar) + 'が持ち味を支えます。</p>' +
      '<div class="stage-romance"><h4>恋愛</h4>' + romance + '</div>' +
      '<h4>十二運</h4><p class="stage-signs">' + tyCell(p.juniun) + 'は、' + esc(stage[0]) +
      'です。' + esc(stage[2]) + '</p>';
  }

  function pillarStageCard(r, key) {
    var stg = (T.lifeStages || {})[key] || {};
    var p = r.pillars[key];
    var h = '<article class="stage-card" id="stage-' + key + '">';
    h += '<h3>' + esc(stg.title || '') + '<span class="age">' + esc(stg.age || '') + '</span></h3>';
    if (!p) {
      h += '<p>' + esc(T.lifeStages.noHour || '') + '</p></article>';
      return h;
    }
    var elements = kanshiYomi(p.name) + '（' + esc(p.stemElem + 'と' + p.branchElem) + '）。';
    var SEE = { year: ['若いころ', '年柱'], month: ['成年期', '月柱'], day: ['人生を通じて、あなた自身は', '日柱'], hour: ['晩年', '時柱'] }[key];
    if (SEE) h += '<p class="stage-signs">' + SEE[0] + (key === 'day' ? '' : 'は') + ty(SEE[1]) + 'に現れてきます。</p>';
    if (key === 'day') {
      h += dayStageBody(p, elements);
    } else {
      var traits = T.pillarTraits;
      var body = stg.body.replace('{stem}', traits.stem[p.stem]).replace('{branch}', traits.branch[p.branch]);
      h += '<h4>特徴</h4><p class="stage-signs">' + elements + esc(body);
      if (p.stemStar === p.zokanStar) {
        h += pillarStarHtml(p.stemStar) + 'の持ち味が、外にも内にも表れやすいでしょう。';
      } else {
        h += '表に出やすい' + pillarStarHtml(p.stemStar) + 'を、内側から' + pillarStarHtml(p.zokanStar) + 'が支えます。';
      }
      h += '</p><p class="stage-signs">十二運の' + tyCell(p.juniun) + 'は、' +
        esc(T.pillarStages[p.juniun][0]) + 'です。</p>';
    }
    h += '<p class="ikashi"><b>生かし方：</b>' + esc(pillarAction(p, key)) + '</p>';
    h += '</article>';
    return h;
  }

  function stagesHtml(r) {
    var L = T.lifeStages || {};
    var h = '<section class="card text" id="guide-stages"><h2>人生の時期</h2>';
    h += '<p class="note">' + esc(L.note || '') + '</p>';
    h += '<div class="stage-list">';
    h += pillarStageCard(r, 'day');
    h += pillarStageCard(r, 'year');
    h += pillarStageCard(r, 'month');
    h += pillarStageCard(r, 'hour');
    h += '</div></section>';
    return h;
  }

  var CALM_RELATIONS = { chuu: true, kei: true, gai: true, ha: true, tensen: true };
  function natalPairSource(r, item) {
    var columns = { 時: 'hour', 日: 'day', 月: 'month', 年: 'year' };
    var labels = parsePairLabels(item);
    return labels ? labels.map(function (label) {
      return label + '柱の' + r.pillars[columns[label]].branch;
    }).join('と') : item;
  }
  function chartWordsOf(r) {
    var words = new Map();
    function add(name, source) {
      if (!words.has(name)) words.set(name, []);
      words.get(name).push(source);
    }
    if (r.kubou) add('空亡', '命式のポイント（' + r.kubou + '）');
    var columns = { year: '年柱', month: '月柱', day: '日柱', hour: '時柱' };
    Object.keys(columns).forEach(function (c) {
      var p = r.pillars[c], label = columns[c];
      if (!p) return;
      if (['死', '墓', '絶', '病'].indexOf(p.juniun) >= 0) add(p.juniun, label + 'の十二運');
      [['天干通変星', p.stemStar], ['地支通変星', p.branchStar], ['蔵干', p.zokanStar]].forEach(function (row) {
        if (['傷官', '敗財', '劫財', '偏官'].indexOf(row[1]) >= 0) add(row[1], label + 'の' + row[0]);
      });
      if (p.branch === r.youjin) add('羊刃', '命式のポイント（' + label + 'の' + p.branch + '）');
    });
    Object.keys(CALM_RELATIONS).forEach(function (key) {
      r.relations[key].forEach(function (item) { add(REL_NAMES[key], natalPairSource(r, item)); });
    });
    return words;
  }
  function calmByName(name) {
    var list = T.calmWords || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }
  function calmLabel(name) {
    return name === '偏官' ? '偏官（七殺）' : name;
  }
  function chipRowHtml(words) {
    var h = '<p class="chip-label">あなたの命式にある言葉</p><ul class="calm-words">';
    words.forEach(function (sources, name) {
      h += '<li><button type="button" class="calm-chip" data-calm="' + esc(name) + '">' +
        esc(calmLabel(name)) + '</button><span class="calm-sources">' + sources.map(function (source, i) {
          return '<span>' + esc(source) + (i < sources.length - 1 ? '、' : '') + '</span>';
        }).join('') + '</span></li>';
    });
    return h + '</ul><div class="calm-panel" hidden></div>';
  }
  function calmSectionHtml(r) {
    var h = '<section class="card" id="guide-calm">';
    h += '<h2>こわい言葉を言われたら</h2>';
    h += '<p class="note">命式に出てくる言葉には、段階や役割を表す名前があります。気になる言葉を押すと、やさしい意味を読めます。</p>';
    h += chipRowHtml(chartWordsOf(r));
    h += '<p class="note">ほかの言葉は<a href="#sec-calm">用語ずかんの「こわい言葉を言われたら」</a>から探せます。</p>';
    return h + '</section>';
  }
  function reassureHtml() {
    return '<p class="reassure">' + esc(T.reassure || '') + '</p>';
  }
  function openCalm(name, btn) {
    var c = calmByName(name);
    var section = btn.closest('#guide-calm');
    var panel = section && section.querySelector('.calm-panel');
    if (!panel) return;
    if (!c) { panel.hidden = true; return; }
    var href = '#' + (c.z || ('t-' + c.name));
    panel.hidden = false;
    panel.innerHTML = '<p><b>' + esc(calmLabel(c.name)) + '</b>　' + esc(c.blurb) + '</p><p>' + esc(c.why) + '</p><p class="note"><a href="' + href + '">用語ずかんで見る</a></p>';
  }

  function periodRelMap(r, label, star) {
    var empty = {};
    Object.keys(REL_NAMES).forEach(function (k) { empty[k] = []; });
    if (!star || star.idx == null) return empty;
    var all = S.relations(S.natalItems(r).concat([{ label: label, idx: star.idx }]));
    var natal = r.relations || {};
    var out = {};
    Object.keys(REL_NAMES).forEach(function (k) {
      out[k] = (all[k] || []).filter(function (x) { return !((natal[k] || []).indexOf(x) >= 0); });
    });
    return out;
  }
  function relElemOf(item) {
    var m = String(item).match(/→([木火土金水])/) || String(item).match(/（([木火土金水])局/);
    return m ? m[1] : '';
  }
  function timingCard(kind, item, periodLabel) {
    var labs = parsePairLabels(item);
    var elem = relElemOf(item);
    var who = 'あなた';
    if (labs) {
      var other = labs[0] === periodLabel.replace('大運', '大運').replace('流年', '流年').replace('流月', '流月') ? labs[1] : labs[0];
      if (['時', '日', '月', '年'].indexOf(labs[0]) >= 0 && ['大運', '流年', '流月'].indexOf(labs[1]) >= 0) other = labs[0];
      if (['時', '日', '月', '年'].indexOf(labs[1]) >= 0 && ['大運', '流年', '流月'].indexOf(labs[0]) >= 0) other = labs[1];
      var role = { 時: '晩年の分野', 日: 'あなた自身（日柱）', 月: '働き盛り・人生の中心（月柱）', 年: '若いころ・ルーツの分野（年柱）' };
      who = role[other] || (other + 'の柱');
    }
    var relName = REL_NAMES[kind] || kind;
    var elemBit = elem ? elemPhrase(elem, true) + 'がめぐりやすい時期。' : '新しい流れが生まれやすい時期。';
    var body = periodLabel + 'が、' + who + 'と結びつき（' + relName + '）、' + elemBit;
    var elemActions = {
      木: '気になっていたことを一つ選び、入門の本を開いてみましょう。',
      火: '一緒に取り組む人に、自分が面白いと思った点を一つ伝えてみてください。',
      土: '続けたい予定を一つ選び、曜日と時間を決めておきましょう。',
      金: '抱えている用事を並べ、先に終えるものを一つ決めてみてください。',
      水: '状況が変わったら、詳しい人に話を聞いて次の手を考えてみましょう。'
    };
    var relActions = {
      kangou: 'それぞれの案から良いところを一つずつ選び、小さな試作品にしてみましょう。',
      shigou: '一緒に過ごす人と、次に会う日や時間を相談してみてください。',
      hankai: '共通の関心がある人に、おすすめを一つ聞いてみましょう。',
      sankyoku: '一緒に進めたいことを一つ選び、それぞれの役割を話してみましょう。',
      chuu: '予定がぶつかったら、先に動かせる日時を一つずつ出してみてください。',
      kei: '譲りにくいことがあれば、大切にしたい理由を一行書いてみましょう。',
      gai: '話がかみ合わないと感じたら、相手の意図を一度聞き返してみてください。',
      ha: '続けづらくなった手順を一つ選び、次に試すやり方を考えてみましょう。',
      tensen: '予定を変える前に、今週中にすませておきたい用事を一つ確認しましょう。'
    };
    var live = elemActions[elem] || relActions[kind];
    return '<article class="rel-card"><p>' + esc(body) + '</p><p class="ikashi"><b>過ごし方：</b>' + esc(live) + '</p></article>';
  }
  function luckRelHtml(r, label, star, periodTitle) {
    var rel = periodRelMap(r, label, star);
    var soft = ['kangou', 'shigou', 'hankai', 'sankyoku'];
    var change = ['chuu', 'kei', 'gai', 'ha', 'tensen'];
    var h = '';
    var anySoft = soft.some(function (k) { return rel[k] && rel[k].length; });
    var anyCh = change.some(function (k) { return rel[k] && rel[k].length; });
    if (!anySoft && !anyCh) return '';
    if (anySoft) {
      h += '<h4>' + esc(periodTitle) + 'とあなた</h4>';
      soft.forEach(function (k) {
        (rel[k] || []).forEach(function (x) { h += timingCard(k, x, periodTitle); });
      });
    }
    if (anyCh) {
      h += '<details class="more inner"><summary>変化のサイン</summary>';
      h += '<p class="note">流れが動きやすいめぐりです。こわい意味ではなく、間合いや休みを大切にすると、前進の力になります。</p>';
      change.forEach(function (k) {
        (rel[k] || []).forEach(function (x) { h += timingCard(k, x, periodTitle); });
      });
      h += '</details>';
    }
    return h;
  }

  function chapterHead(n, title) {
    return '<p class="ch-label">' + n + '. ' + esc(title) + '</p>';
  }
  function natalRelsHtml(r) {
 var h='<section class="card" id="guide-rels"><h2>あなたの持ち味が重なるところ</h2><p>上の「人生の中心（月柱）」で見た月の柱と、日の柱を、今度は組み合わせて見ます。書かれていることを今の暮らしと照らし合わせ、しっくりくる部分だけを使ってください。</p>';
 var rel=r.relations||{}, n=0;
 var titles={kangou:'考え方を重ねて、新しい形をつくる',shigou:'暮らしのリズムを合わせる',hankai:'共通の関心を育てる',sankyoku:'力を一つのテーマに集める',chuu:'違うペースの間に余白をつくる',kei:'自分のこだわりと付き合う',gai:'言葉にして、すれ違いをほどく',ha:'いつものやり方を見直す',tensen:'変化の前に、足もとを整える'};
 Object.keys(REL_NAMES).forEach(function(k){(rel[k]||[]).forEach(function(x){
 n++;var labs=parsePairLabels(x)||[],roles={年:'育ってきた環境や家族との関わり',月:'仕事や人との関わり',日:'自分の気持ちや親しい人との関係',時:'これから育てたいこと'};
 var domains=labs.map(function(l){return roles[l]||'暮らしの一場面';}).join('と');
 var ideas={kangou:'持ち味を持ち寄る見方ができます。自分ひとりで抱えず、相手の得意な方法も試してみましょう。',shigou:'生活のペースをすり合わせる手がかりです。気持ちよく続く小さな習慣を一緒につくってみましょう。',hankai:'共通する関心を少しずつ育てる見方ができます。まずは気になることに触れる時間をつくってみましょう。',sankyoku:'一つのテーマへ力を集める見方ができます。何を大切にしたいかを一言にすると、選びやすくなります。',chuu:'異なるペースに気づく手がかりです。すぐに結論を出さず、それぞれの希望を聞いてみましょう。',kei:'大切にしたいことの違いを見つめる手がかりです。正解を争うより、無理のない約束を一つ決めてみましょう。',gai:'言わずに伝わると思っていることを確かめる手がかりです。短い言葉でも、希望を伝えてみましょう。',ha:'いつものやり方を見直す手がかりです。手放すことと残すことを分けると、次の一歩を選びやすくなります。',tensen:'いくつかの思いを整理する手がかりです。大きな決断を急がず、休む時間や相談相手を確保しましょう。'};
 var line=(domains?domains+'の間で、':'いくつかの暮らしの場面で、')+ideas[k];
 h+='<article class="rel-card"><h3>'+esc(titles[k])+'</h3><p>あなたの場合は、'+esc(line)+'</p><details class="more inner"><summary>対応する言葉と組み合わせを読む</summary><p>'+esc(x)+'</p><p>'+ty(REL_NAMES[k], k === 'sankyoku' ? '三局' : REL_NAMES[k]) + 'を用語ずかんで読む</p></details></article>';
 });});
 if(!n)h+='<p>あなたの場合は、ここで扱う目立った組み合わせは見られません。足りないという意味ではありません。上で見た一つひとつの持ち味から、使いやすいものを見つけてください。</p>';
 return h+'</section>';
 }

  function cycleGuideHtml(groups) {
    var order = Object.keys(groups);
    return '<p class="note">上の丸が日干の五行（比劫）です。図の相生の矢印は ' +
      esc(order.concat(order[0]).join(' → ')) + ' とめぐります。丸の大きさと●は、命式にある五行の数を表します。</p>' +
      '<p>自分の力（比劫）が思いを形にする力（食傷）を生み、それが人やお金とのご縁（財星）を呼び、ご縁が役割や信頼（官星）を育て、役割から得た学びや支え（印星）が、またあなた自身の力に戻ってきます。図の矢印は、そんなめぐりを表しています。</p>';
  }

  function gogyoAdjustmentHtml(gogyo) {
    var items = [];
    GEL.forEach(function (elem) {
      var count = gogyo[elem];
      if (count < 2) {
        var source = GEL.find(function (e) { return SHENG_NEXT[e] === elem; });
        items.push({ title: elem + '（' + T.cycleAmount(count) + '）を補う',
          advice: T.gogyoSupportAdvice(elem, source, gogyo[source] >= 2) });
      } else if (count >= 3) {
        var controller = KE_PAIRS.find(function (pair) { return pair[1] === elem; })[0];
        items.push({ title: elem + '（' + T.cycleAmount(count) + '）を整える',
          advice: T.gogyoBalanceAdvice(elem, controller, SHENG_NEXT[elem]) });
      }
    });
    if (!items.length) return '';
    return '<div id="individual-gogyo-adjustment"><h3>五行の整え方</h3>' + items.map(function (item) {
      return '<p><strong>' + esc(item.title) + '</strong><br>' + esc(item.advice) + '</p>';
    }).join('') + '</div>';
  }

  function gogyoSectionHtml(r, sid, who) {
    sid = sid || 'g1';
    var h = '<section class="card text" id="guide-gogyo"><h2>' + ty('五行') + 'のバランス' + qTip('gogyo', '五行') + qTip('marks', '記号') + qTip('anata', 'あなた') + '</h2>';
    h += '<p class="lead">組み合わせも含めて見ると、あなたの五行はこんなバランスです。</p>';
    h += gogyoSvg(r, sid, who || 'あなた') + legendHtml();
    h += '<div id="individual-cycle"><h3>あなたの相生の循環</h3>';
    h += cycleGuideHtml(r.groups);
    T.individualCycleReading(r).forEach(function (paragraph) { h += '<p>' + esc(paragraph) + '</p>'; });
    h += '</div>';
    h += gogyoAdjustmentHtml(r.gogyo);
    var bal = gogyoBalanceItems(r);
    h+='<details class="more inner"><summary>もっと読む</summary>';
    h+=bal.map(function(a){return '<h4>'+tyWrap(a.title)+'</h4><p>'+esc(a.text)+'</p>';}).join('');
    h+='<p class="note">●は生まれ持った柱の数です。生まれ月の季節や組み合わせの記号とは分けて見てください。</p></details>';
    h+='<h3>今の流れ</h3><p>＋はこの10年、⊕は今年のテーマです。生まれ持った数が増減したわけではありません。下の「大運・今年・今月」で、いま試したいことを一つ選んでみましょう。</p></section>';
    return h;
  }


  function isiOSLike() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function setSaveStatus(msg) {
    var el = $('saveChartStatus');
    if (el) el.textContent = msg || '';
  }
  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    if (isiOSLike()) {
      try { window.open(url, '_blank'); } catch (e1) {}
      setSaveStatus('保存を開始しました。iPhone/iPadでは、開いたページから共有→「ファイルに保存」が使えます。');
    } else {
      setSaveStatus('保存を開始しました。保存先をご確認ください。');
    }
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 20000);
  }
  function captureElement(el, opt) {
    if (typeof html2canvas !== 'function') return Promise.reject(new Error('画像ライブラリを読み込めませんでした'));
    return html2canvas(el, Object.assign({
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 0,
      ignoreElements: function (node) {
        if (!node || !node.classList) return false;
        if (node.classList.contains('actions')) return true;
        if (node.id === 'saveChartStatus') return true;
        if (node.classList.contains('qpop') || node.id === 'qpop' || node.id === 'tour') return true;
        return false;
      }
    }, opt || {}));
  }
  function canvasToPngBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('画像を作れませんでした')); }, 'image/png');
      } else {
        try {
          var data = canvas.toDataURL('image/png');
          var bin = atob(data.split(',')[1]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/png' }));
        } catch (e) { reject(e); }
      }
    });
  }
  function saveChartImage() {
    var el = $('meishiki-capture') || document.querySelector('#guide-meishiki table.meishiki');
    if (!el) { setSaveStatus('命式の表が見つかりません。先に鑑定してください。'); return; }
    setSaveStatus('画像を準備しています…');
    captureElement(el, { backgroundColor: '#ffffff' }).then(function (canvas) {
      return canvasToPngBlob(canvas).then(function (blob) { saveBlob(blob, '四柱推命_命式.png'); });
    }).catch(function (err) { setSaveStatus('画像の保存に失敗しました: ' + (err && err.message ? err.message : err)); });
  }
  function pdfBreaks(root, pageHeight) {
    var origin = root.getBoundingClientRect().top;
    var breaks = [];
    // カードの境目で改ページし、収まらないカードは中の段落や小見出しの境目で分ける。
    function collect(parent) {
      var blocks = Array.from(parent.children).filter(function (child) {
        return child.getBoundingClientRect().height > 0;
      });
      blocks.forEach(function (child, i) {
        var rect = child.getBoundingClientRect();
        var previous = blocks[i - 1];
        if (previous && !previous.matches('h2,h3,h4,.ch-label,summary')) {
          var bottom = previous.getBoundingClientRect().bottom;
          if (bottom <= rect.top) breaks.push((bottom + rect.top) / 2 - origin);
        }
        if (child.classList.contains('chapter') || rect.height > pageHeight) collect(child);
      });
    }
    collect(root);
    return breaks.sort(function (a, b) { return a - b; });
  }
  function saveChartPdf() {
    var el = $('out');
    if (!el || !el.querySelector('table.meishiki')) { setSaveStatus('鑑定結果がまだありません。先に鑑定してください。'); return; }
    var JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (typeof html2canvas !== 'function' || !JsPDF) { setSaveStatus('PDFライブラリを読み込めませんでした'); return; }
    setSaveStatus('PDFを準備しています…');
    var width = 820, scale = 2, breaks;
    Promise.resolve().then(function () {
      var pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      var margin = 10;
      var usableW = pdf.internal.pageSize.getWidth() - margin * 2;
      var usableH = pdf.internal.pageSize.getHeight() - margin * 2;
      var pageCanvasH = Math.floor(width * scale * usableH / usableW);
      var sourceSvg = el.querySelector('svg.gogyo');
      var art = sourceSvg && sourceSvg.cloneNode(true);
      return captureElement(el, {
        backgroundColor: '#fff7fa',
        width: width,
        windowWidth: width + 36,
        scale: scale,
        onclone: function (doc, root) {
          root.style.width = width + 'px';
          root.style.display = 'flow-root';
          root.querySelectorAll('button,.guide-hl').forEach(function (node) {
            if (node.matches('button')) node.remove();
            else node.classList.remove('guide-hl');
          });
          root.querySelectorAll('details:not([open]) > :not(summary)').forEach(function (node) {
            node.remove();
          });
          var svg = root.querySelector('svg.gogyo');
          if (svg && art) {
            // SVG に画面上の位置や寸法がインライン化される前の図を使う。
            art.setAttribute('width', '360');
            art.setAttribute('height', '350');
            art.setAttribute('font-family', doc.defaultView.getComputedStyle(svg).fontFamily);
            var img = doc.createElement('img');
            img.width = 360;
            img.height = 350;
            img.alt = svg.getAttribute('aria-label');
            img.style.cssText = 'display:block;margin:0 auto';
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(art));
            svg.replaceWith(img);
          }
          breaks = pdfBreaks(root, pageCanvasH / scale).map(function (y) { return Math.round(y * scale); });
        }
      }).then(function (canvas) {
        breaks.push(canvas.height);
        var slice = document.createElement('canvas');
        slice.width = canvas.width;
        var y = 0, next = 0;
        while (y < canvas.height) {
          var end = y;
          while (next < breaks.length && breaks[next] <= y + pageCanvasH) end = breaks[next++];
          if (end <= y) throw new Error('この表示をページに収められませんでした。「印刷する」から保存してください。');
          slice.height = end - y;
          slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, slice.width, slice.height);
          if (y) pdf.addPage();
          pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, slice.height * usableW / slice.width);
          y = end;
        }
        saveBlob(pdf.output('blob'), '四柱推命_鑑定結果.pdf');
      });
    }).catch(function (err) { setSaveStatus('PDFの保存に失敗しました: ' + (err && err.message ? err.message : err)); });
  }
  function printChart() { window.print(); }
  function render(r) {
    var h = '';
    lastK = r;

    h += '<div class="chapter" id="ch-intro">';
    h += reassureHtml();
    h += summaryHtml(r);
    if (hasSetsuiriTimeNote(r.input)) h += setsuiriTimeNoteHtml('setsuiri-time-note');
    h += '</div>';

    h += '<div class="chapter" id="ch1">' + chapterHead('1', '基本の命式と、あなたのなりたち');
    h += '<section class="card" id="guide-meishiki"><h2>' + ty('命式') + qTip('meishiki', '命式') + '</h2>';
    h += '<div id="meishiki-capture" class="meishiki-capture">';
    h += '<p class="note lead-mei">これがあなたの命式です。保存しておくと、いつでも見返せます。</p>';
    h += meishikiTable(r);
    h += '</div>';
    h += '<div class="actions"><button type="button" id="saveChartImage">命式を画像で保存</button><button type="button" id="saveChartPdf">鑑定結果をPDFで保存</button><button type="button" id="printChart">印刷する</button></div><p id="saveChartStatus" role="status"></p>';
    h += '<p class="note">漢字をタップすると、用語ずかんでやさしい説明を見られます。「死」「絶」「墓」や「傷官」などは、段階や役割の名前で、人生の出来事を決める言葉ではありません。</p>';
    h += '</section>';

    h += '<section class="card text featured" id="guide-honmei"><h2>' + ty('本命') + 'の鑑定</h2>';
    h += '<h3>あなたの本質（' + ty('日干') + '：' + kanYomi(r.dayStem) + '＝' + esc(T.nikkan[r.dayStem].img) + '）</h3>';
    h += '<p class="note">いつの時期も変わらない、あなたの芯がここにあります。</p>';
    h += nikkanHtml(T.nikkan[r.dayStem]);
    h += '</section>';

    h += monthCoreHtml(r);
    h += stagesHtml(r);
    h += calmSectionHtml(r);
    h += '</div>';

    h += '<div class="chapter" id="ch2">' + chapterHead('2', 'あなたの中の組み合わせ');
    h += natalRelsHtml(r);
    h += gogyoSectionHtml(r, 'g1', 'あなた');
    h += '</div>';

    if (r.daiunInfo || r.current) {
      h += '<div class="chapter" id="ch3">' + chapterHead('3', 'この10年・今年・今月');
      if (r.current) h += fortuneHtml(r);
      h += '<section class="card text" id="guide-unki"><h2>' + ty('大運') + qTip('daiun', '大運') + '・今年・今月</h2>';
      if (r.current) {
        var c = r.current;
        if (c.daiun) {
          h += '<div class="unki-block"><h3>' + unkiHeading('daiun', c.daiun, r) + qTip('daiun', '大運') + '</h3><p class="note">' + (c.daiun.from ? '数え' + c.daiun.from + '〜' + c.daiun.to + '歳' : '') + (c.daiun.name ? '・' + kanshiYomi(c.daiun.name) : '') + (c.daiun.stemStar ? '・' + tyCell(c.daiun.stemStar) : '') + '</p>' + unkiBody(c.daiun.stemStar, c.daiun.juniun);
          h += luckRelHtml(r, '大運', c.daiun, 'この10年（大運' + (c.daiun.name ? ' ' + c.daiun.name : '') + '）');
          h += '</div>';
        }
        if (c.ryunen) {
          h += '<div class="unki-block"><h3>' + unkiHeading('year', c.ryunen, r) + qTip('ryunen', '流年') + '</h3>' + unkiBody(c.ryunen.stemStar, c.ryunen.juniun);
          h += luckRelHtml(r, '流年', c.ryunen, '今年（' + ryunenYear(r) + (c.ryunen.name ? ' ' + c.ryunen.name : '') + '）');
          h += '</div>';
        }
        if (c.ryugetsu) {
          h += '<div class="unki-block"><h3>' + unkiHeading('month', c.ryugetsu, r) + qTip('ryugetsu', '月運') + '</h3>' + unkiBody(c.ryugetsu.stemStar, c.ryugetsu.juniun);
          h += luckRelHtml(r, '流月', c.ryugetsu, '今月');
          h += '</div>';
        }
        if (c.ryujitsu) h += '<div class="unki-block"><h3>' + unkiHeading('day', c.ryujitsu, r) + '</h3>' + unkiBody(c.ryujitsu.stemStar, c.ryujitsu.juniun) + '</div>';
        var lines = [['大運', c.daiun], ['今年（流年）', c.ryunen], ['今月', c.ryugetsu], ['今日', c.ryujitsu]];
        h += '<div class="unki-table"><h3>いまの運の一覧</h3><div class="stars-wrap"><table class="stars"><tr><th></th><th>' + ty('干支') + '</th><th>' + ty('通変星') + '</th><th>' + ty('十二運') + '</th><th>' + ty('地支') + '<br>' + ty('通変星') + '</th></tr>';
        lines.forEach(function (l) { if (l[1]) h += '<tr><th>' + tyWrap(l[0]) + '</th><td>' + kanshiYomi(l[1].name) + '</td><td>' + tyCell(l[1].stemStar) + '</td><td>' + tyCell(l[1].juniun) + '</td><td>' + tyCell(l[1].branchStar) + '</td></tr>'; });
        h += '</table></div></div>';
      }
      if (r.daiunInfo) {
        var list = daiunTo100(r);
        var cur = r.current;
        h += '<div class="unki-table"><h3>' + ty('大運') + 'のながれ（およそ100歳まで）</h3>';
        if (r.daiunInfo.replaced) h += '<p class="note">節入りまでの日数から求めた値が範囲外のため、10年運としています。</p>';
        h += '<p class="note">数え歳は、生まれたときを1歳と数える、占いでよく使う年齢です。大運の区切りは人によって6〜10年ほど。色のついた行が、いまの大運です。</p>';
        var rows = list.map(function (d) {
          return { label: d.from + '〜' + d.to + '歳', star: d, current: cur && cur.daiun && cur.daiun.from === d.from };
        });
        h += periodTable('年齢<br>（数え）', rows, r) + '</div>';
      }
      if (r.current) h += ryunenTable(r);
      h += '</section></div>';
    }

    h += '<details class="more" id="guide-detail"><summary>命式のポイントを見る</summary>';
    h += '<section class="card" id="guide-points"><h2>' + ty('命式') + 'のポイント</h2>' + pointsKv(r) + '</section>';
    h += '</details>';

    $('out').innerHTML = h;
    var pin = $('out').querySelector('.fortune-pin');
    if (pin) {
      var timeline = pin.closest('svg'), scroll = timeline.parentElement;
      scroll.scrollLeft = pin.cx.baseVal.value * timeline.clientWidth / timeline.viewBox.baseVal.width - scroll.clientWidth / 2;
    }
    if ($('saveChartImage')) $('saveChartImage').onclick = function () { saveChartImage(); };
    if ($('saveChartPdf')) $('saveChartPdf').onclick = function () { saveChartPdf(); };
    if ($('printChart')) $('printChart').onclick = function () { printChart(); };
    if (guideOn) updateTour();
  }

  function gogyoCompare(a, b, na, nb) {
    var max = Math.max.apply(null, GEL.map(function (e) { return Math.max(a[e], b[e]); }));
    function bar(n) {
      return '<span class="cmp-value"><span class="cmp-track" aria-hidden="true"><span class="b" style="width:' +
        (n / max * 100) + '%"></span></span><span>' + n + '</span></span>';
    }
    var h = '<div class="cmp"><div class="row cmp-head"><span></span><b>' + esc(na) + '</b><b>' + esc(nb) + '</b></div>';
    GEL.forEach(function (e) {
      h += '<div class="row"><b>' + e + '</b>' + bar(a[e]) + bar(b[e]) + '</div>';
    });
    return h + '</div>';
  }

  function compatRelDetails(item, nameA, nameB) {
    // compat の固定ラベルを読んでから氏名を入れる。
    var pair = item.match(/^Aの([時日月年])・Bの([時日月年])（(.+)）$/);
    if (!pair) {
      var branches = item.match(/^(.+)\(Aの([時日月年])\)－(.+)\(Bの([時日月年])\)$/);
      if (!branches) return item.replace(/（(.+)）$/, '・$1');
      pair = [item, branches[2], branches[4], branches[1] + branches[3]];
    }
    var detail = pair[3].replace(/→([木火土金水])$/, '・$1の合');
    return detail + '、' + nameA + 'の' + pair[1] + '柱と' + nameB + 'の' + pair[2] + '柱';
  }

  function compatRelsHtml(rel, nameA, nameB) {
    var html = '', links = [];
    Object.keys(REL_NAMES).forEach(function (key) {
      var matches = rel[key];
      if (!matches.length) return;
      var kind = REL_NAMES[key];
      var details = matches.map(function (item) { return compatRelDetails(item, nameA, nameB); });
      var intro = nameA + 'と' + nameB + 'の間には、' + kind + '（' + details.join('／') + '）があります。';
      var elems = S.ELEMS.filter(function (elem) {
        return matches.some(function (item) { return item.includes('→' + elem + '）') || item.includes('（' + elem + '局'); });
      });
      html += '<article class="rel-card"><p><strong>' + esc(intro) + '</strong></p><p>' + esc(T.gouAdvice[key]) + '</p>';
      elems.forEach(function (elem) { html += '<p>' + esc(T.gouElem[elem]) + '</p>'; });
      html += '</article>';
      links.push('<a href="#t-' + encodeURIComponent(key === 'sankyoku' ? '三局' : kind) + '">' + esc(kind) + '</a>');
    });
    if (!html) {
      return '<p>' + esc(nameA + 'と' + nameB + 'の柱どうしには、ここで見る特別な組み合わせは見られませんでした。おふたりの心地よいペースは、日々のやりとりの中で見つけていけます。') + '</p>';
    }
    return html + '<p class="note">用語ずかんで読む　' + links.join('・') + '</p>';
  }

  function elementRelation(a, b) {
    if (a === b) return { kind: '比和', direction: '同じ五行', fromA: true };
    var grows = isShengAdj(a, b);
    var fromA = grows ? SHENG_NEXT[a] === b : KE_PAIRS.some(function (pair) {
      return pair[0] === a && pair[1] === b;
    });
    return {
      kind: grows ? '相生' : '相剋',
      direction: (fromA ? a : b) + (grows ? '生' : '剋') + (fromA ? b : a),
      fromA: fromA
    };
  }

  function strongElementPairs(a, b) {
    function entries(person) {
      return Object.keys(person.chart.groups).map(function (group) {
        var entry = person.chart.groups[group];
        return { person: person, group: group, elem: entry.elem, count: entry.count };
      }).filter(function (entry) { return entry.count >= 2; });
    }
    var pairs = [], right = entries(b);
    entries(a).forEach(function (x) {
      right.forEach(function (y) {
        var rel = elementRelation(x.elem, y.elem);
        pairs.push({
          kind: rel.kind,
          label: rel.kind + '（' + rel.direction + '）',
          from: rel.fromA ? x : y,
          to: rel.fromA ? y : x,
          weight: x.count + y.count
        });
      });
    });
    return pairs.sort(function (x, y) { return y.weight - x.weight; });
  }

  function renderCompat(rA, rB, nameA, nameB) {
    nameA = nameA || 'あなた'; nameB = nameB || 'お相手';
    lastA = { rA: rA, rB: rB, na: nameA, nb: nameB };
    var c = S.compat(rA, rB, 'A', 'B');
    var dr = c.dayRel;
    var dayDirection = elementRelation(dr.elemA, dr.elemB).direction;
    var dayDetail = dayDirection + (dr.kind === '比和' ? '' : '・' + dr.dir);
    var imgA = T.nikkan[rA.dayStem] ? T.nikkan[rA.dayStem].img : rA.dayStem;
    var imgB = T.nikkan[rB.dayStem] ? T.nikkan[rB.dayStem].img : rB.dayStem;
    var text = T.compatReading(c, rA, rB, nameA, nameB);
    var paras = text.split('\n\n').filter(Boolean);
    var heads = ['おふたりの中心', '日干の流れ'];
    var joins = ['kangou', 'shigou', 'hankai', 'sankyoku'].filter(function (key) { return c.between[key].length; });
    var h = '';
    h += '<section class="card summary" id="guide-a-sum"><h2>ふたりの相性</h2><div class="sum-lines">';
    h += '<div class="sum-item"><span class="lbl">' + ty('日干') + 'の関係</span><p>' + esc(nameA) + 'は' + kanYomi(rA.dayStem) + '（' + esc(imgA) + '）、' + esc(nameB) + 'は' + kanYomi(rB.dayStem) + '（' + esc(imgB) + '）。' + tyCell(dr.kind) + '（' + esc(dayDetail) + '）です。</p></div>';
    h += '<div class="sum-item"><span class="lbl">五行の特徴</span><p>' + esc(nameA) + 'は' + esc(gogyoSummaryLine(rA, true)) + '　' + esc(nameB) + 'は' + esc(gogyoSummaryLine(rB, true)) + '</p></div>';
    h += '<div class="sum-item"><span class="lbl">ひとこと</span><p>' + (joins.length ? 'おふたりの命式には、' + joins.map(function (key) { return REL_NAMES[key]; }).join('・') + 'が見られます。力を合わせるときに、自然とつながりやすい組み合わせです。' : '目立つ合は少なめです。個性を保ったまま、ちょうどよい距離で歩ける組み合わせと見ることもできます。') + '</p></div>';
    h += '</div></section>';

    var setsuiriNames = [];
    if (hasSetsuiriTimeNote(rA.input)) setsuiriNames.push(nameA === 'あなた' ? nameA : 'あなた（' + nameA + '）');
    if (hasSetsuiriTimeNote(rB.input)) setsuiriNames.push(nameB === 'お相手' ? nameB : 'お相手（' + nameB + '）');
    if (setsuiriNames.length) h += setsuiriTimeNoteHtml('setsuiri-time-note-aisho', setsuiriNames.join('・'));

    h += '<div class="two" id="guide-a-mei">';
    h += '<p class="note lead-mei" style="flex-basis:100%">これがおふたりの命式です。保存しておくと、いつでも見返せます。</p>';
    h += '<section class="card"><h2>' + esc(nameA) + 'の' + ty('命式') + qTip('meishiki', '命式') + '</h2>' + meishikiTable(rA) +
      '<p class="note">漢字をタップすると、用語ずかんでやさしい説明を見られます。</p></section>';
    h += '<section class="card"><h2>' + esc(nameB) + 'の' + ty('命式') + '</h2>' + meishikiTable(rB) +
      '<p class="note">漢字をタップすると、用語ずかんでやさしい説明を見られます。</p></section>';
    h += '</div>';

    h += '<section class="card" id="guide-a-gogyo"><h2>' + ty('五行') + 'のバランス比較' + qTip('gogyo', '五行') + qTip('anata', 'あなた') + '</h2>';
    h += '<div class="gogyo-comparison"><div class="two">' + gogyoSvg(rA, 'ga', 'あなた') + gogyoSvg(rB, 'gb', 'お相手') + '</div>';
    h += legendHtml();
    h += gogyoCompare(c.gogyoA, c.gogyoB, nameA, nameB) + '</div>';
    var a = { chart: rA, name: nameA, stars: T.starsByGroup(rA, S) };
    var b = { chart: rB, name: nameB, stars: T.starsByGroup(rB, S) };
    h += '<div id="aisho-cycle-reading"><h3>ふたりで回す相生の循環</h3>';
    var pairs = strongElementPairs(a, b);
    var cycle = T.compatCycleReading(a, b, pairs.find(function (pair) { return pair.kind === '相生'; }));
    h += '<div class="gogyo-reading" id="aisho-cycle-summary"><p>' + esc(cycle.summary) + '</p></div>';
    cycle.rows.forEach(function (reading) {
      h += '<p><strong>' + esc(reading.group) + '</strong><br><span class="note">' + esc(reading.counts) + '</span><br>' + esc(reading.detail) + '</p>';
    });
    var opposing = pairs.filter(function (pair) { return pair.kind === '相剋'; });
    var tension = opposing.find(function (pair) { return pair.to.count >= 3; }) || opposing[0];
    if (tension) h += '<h4>お互いを高めるひと工夫</h4><p id="aisho-star-reading">' + esc(T.starCompatReading(tension)) + '</p>';
    h += '</div>' + cycleGuideHtml(rA.groups);
    h += '<div id="aisho-element-reading"><h3>五行ごとの内訳</h3>';
    T.gogyoCompatReading(rA, rB, nameA, nameB, S.ELEMS).forEach(function (reading) {
      h += '<p><strong>' + esc(reading.elem) + '</strong>　' + esc(reading.counts);
      if (reading.detail) h += '<br>' + esc(reading.detail);
      h += '</p>';
    });
    h += '</div>';
    h += '</section>';

    h += '<section class="card text" id="guide-a-read"><h2>相性の鑑定' + qTip('aisho', '相性') + '</h2>';
    paras.forEach(function (para, i) { h += '<h4>' + esc(heads[i] || '続き') + '</h4>' + parasHtml(para); });
    h += '</section>';

    h += '<section class="card" id="guide-a-day"><h2>' + ty('日干') + 'の関係' + qTip('dayrel', '日干の関係') + qTip('hiwa', '比和') + ' ' + ty('比和') + qTip('shosei', '相生') + ' ' + ty('相生') + qTip('shokoku', '相剋') + ' ' + ty('相剋') + '</h2>';
    h += '<p>' + esc(nameA) + '：' + esc(rA.dayStem) + '（' + esc(imgA) + '・' + esc(dr.elemA) + '）　／　' +
      esc(nameB) + '：' + esc(rB.dayStem) + '（' + esc(imgB) + '・' + esc(dr.elemB) + '）</p>';
    h += '<p><b>' + tyCell(dr.kind) + '</b>（' + esc(dayDetail) + '）' + (dr.kangou ? '　' + ty('日干') + 'の' + ty('干合') + '（' + kanshiYomi(rA.dayStem + rB.dayStem) + '→' + esc(dr.kangou) + '）' : '') +
      (c.dayShigou ? '　日支の' + ty('支合') + '→' + esc(c.dayShigou) : '') +
      (c.dayChuu ? '　日支の' + ty('冲') + '（' + esc(c.dayChuu) + '）' : '') + '</p></section>';

    h += '<section class="card" id="guide-a-rels"><h2>ふたりの結びつき</h2>';
    h += '<p>合（ごう）と冲（ちゅう）は、ふたりの命式をかけ合わせたときに出てくる、気と気の結びつきです。合は手をつなぐ関係で、自然と歩調が合い、力を合わせやすいところ。冲は向かい合う関係で、刺激し合い、お互いを動かすきっかけになるところです。</p>';
    h += compatRelsHtml(c.between, nameA, nameB);
    h += '</section>';

    h += '<details class="more" id="guide-a-detail"><summary>命式のポイントを見る</summary>';
    h += '<div class="two" id="guide-a-points">';
    h += '<section class="card"><h2>' + esc(nameA) + 'の' + ty('命式') + 'のポイント</h2>' + pointsKv(rA) + '</section>';
    h += '<section class="card"><h2>' + esc(nameB) + 'の' + ty('命式') + 'のポイント</h2>' + pointsKv(rB) + '</section>';
    h += '</div></details>';

    $('outA').innerHTML = h;
    if (guideOn) updateTour();
  }

  var initialKanteiHtml = $('empty-kantei').outerHTML;
  var initialAishoHtml = $('empty-aisho').outerHTML;
  function emptyKanteiHtml() {
    return initialKanteiHtml;
  }
  function showInputError(isAisho, message) {
    if (isAisho) {
      lastA = null;
      $('outA').innerHTML = initialAishoHtml;
    } else {
      lastK = null;
      $('out').innerHTML = emptyKanteiHtml();
    }
    $(isAisho ? 'errA' : 'err').textContent = message;
    closeTip();
    if (guideOn) updateTour();
  }
  var TIME_HINT = '生まれた時間がわかれば入れてください。わからないときは「時間がわからない」を選んでください。';
  function missingTime(prefix, who) {
    var timeId = prefix ? prefix + 'Time' : 'time';
    var notimeId = prefix ? prefix + 'Notime' : 'notime';
    if ($(notimeId) && !$(notimeId).checked && $(timeId) && !$(timeId).value) {
      return (who ? who + 'の' : '') + TIME_HINT;
    }
    return '';
  }
  function saveLastInput(input) {
    try {
      var unknown = input.hour == null || input.hour === '';
      localStorage.setItem('shichu_last_input', JSON.stringify({
        y: input.y, m: input.m, d: input.d,
        hour: unknown ? null : input.hour,
        minute: unknown ? null : input.minute,
        gender: input.gender
      }));
    } catch (err) {}
  }
  function run(e) {
    if (e) e.preventDefault();
    var msg = missingTime('', '');
    if (msg) { showInputError(false, msg); return; }
    $('err').textContent = '';
    try {
      var input = readInput('');
      var result = S.compute(input);
      result.displayName = $('birthName').value.trim();
      saveLastInput(input);
      render(result);
      if ($('out')) try { $('out').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) {}
    } catch (err) { showInputError(false, 'エラー: ' + err.message); }
  }
  function runAisho(e) {
    if (e) e.preventDefault();
    var msg = missingTime('a', 'あなた') || missingTime('b', 'お相手');
    if (msg) { showInputError(true, msg); return; }
    $('errA').textContent = '';
    try {
      var rA = S.compute(readInput('a')), rB = S.compute(readInput('b'));
      var na = ($('aName').value || '').trim() || 'あなた';
      var nb = ($('bName').value || '').trim() || 'お相手';
      renderCompat(rA, rB, na, nb);
      if ($('outA')) try { $('outA').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) {}
    } catch (err) { showInputError(true, 'エラー: ' + err.message); }
  }

  function showTab(name) {
    var k = name === 'aisho';
    $('tab-kantei').classList.toggle('on', !k);
    $('tab-aisho').classList.toggle('on', k);
    $('panel-kantei').classList.toggle('on', !k);
    $('panel-aisho').classList.toggle('on', k);
    if ($('lead')) $('lead').textContent = k ? 'ふたりの生年月日を入れて、関係の活かし方を見てみましょう' : '生年月日を入れて、自分らしさと今の過ごし方を考えてみましょう';
  }
  function afterTab() { closeTip(); tourStep = 0; tourDismissed = false; if (guideOn) updateTour(); }
  var _showTab = showTab;
  showTab = function (name) { _showTab(name); afterTab(); };
  $('tab-kantei').addEventListener('click', function () { showTab('kantei'); });
  $('tab-aisho').addEventListener('click', function () { showTab('aisho'); });
  $('f').addEventListener('submit', run);
  $('fa').addEventListener('submit', runAisho);
  if ($('guideToggle')) $('guideToggle').addEventListener('click', function () { setGuide(!guideOn); });
  document.addEventListener('click', function (ev) {
    var calmBtn = ev.target.closest && ev.target.closest('.calm-chip[data-calm]');
    if (calmBtn) { ev.preventDefault(); openCalm(calmBtn.getAttribute('data-calm'), calmBtn); return; }
    var btn = ev.target.closest && ev.target.closest('.qbtn');
    if (btn && btn.getAttribute('data-tip')) { ev.preventDefault(); showTip(btn.getAttribute('data-tip'), btn); return; }
    if (ev.target.id === 'tourClose') { tourDismissed = true; updateTour(); return; }
    if (ev.target.id === 'tourPrev') { tourStep = Math.max(0, tourStep - 1); updateTour(); return; }
    if (ev.target.id === 'tourNext') {
      var n = currentSteps().length;
      if (tourStep >= n - 1) { tourDismissed = true; updateTour(); } else { tourStep += 1; updateTour(); }
      return;
    }
    if (!ev.target.closest || !ev.target.closest('.qpop')) closeTip();
  });
  var q = (location.search || '').replace(/^\?/, '');
  if (q.indexOf('shot=kantei') >= 0) {
    $('birth').value = '1985-09-18'; $('time').value = '12:00'; $('gender').value = '女'; $('notime').checked = false; $('time').disabled = false;
    showTab('kantei'); run();
  } else if (q.indexOf('shot=aisho') >= 0) {
    $('aBirth').value = '1985-09-18'; $('aTime').value = '12:00'; $('aGender').value = '女'; $('aNotime').checked = false; $('aTime').disabled = false;
    $('bBirth').value = '1992-04-14'; $('bTime').value = '12:00'; $('bGender').value = '男'; $('bNotime').checked = false; $('bTime').disabled = false;
    showTab('aisho'); runAisho();
  }
  if (q.indexOf('guide=1') >= 0) {
    setGuide(true);
    var gs = q.match(/tour=(\d+)/);
    if (gs) { tourStep = Math.max(0, parseInt(gs[1], 10) || 0); tourDismissed = false; updateTour(); }
  }

  function zukanHashOf(href) {
    if (!href) return '';
    if (href === 'zukan.html' || href === './zukan.html') return '#zukan-root';
    var m = String(href).match(/^(?:zukan\.html)?(#[^#]*)$/);
    return m ? m[1] : '';
  }
  function isZukanHash(hash) {
    var id = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    if (!id) return false;
    if (id === 'zukan-root' || id === 'zukan') return true;
    return /^(t-|sec-|d-)/.test(id);
  }
  function scrollZukanTo(root, target) {
    if (!target || !root.contains(target)) { root.scrollTop = 0; return; }
    var rr = root.getBoundingClientRect();
    var tr = target.getBoundingClientRect();
    if (tr.width === 0 && tr.height === 0) return;
    var bar = root.querySelector('.zukan-toolbar');
    var nav = root.querySelector('.navwrap');
    var extra = (bar ? bar.getBoundingClientRect().height : 0) + (nav ? nav.getBoundingClientRect().height : 0) + 8;
    var y = tr.top - rr.top + root.scrollTop - extra;
    root.scrollTop = Math.max(0, y);
  }
  function openZukan(hash) {
    var root = $('zukan-root');
    if (!root) return;
    closeTip();
    root.classList.add('is-open');
    document.body.classList.add('zukan-open');
    var id = decodeURIComponent(String(hash || '#zukan-root').replace(/^#/, '')) || 'zukan-root';
    var target = (id && id !== 'zukan-root' && id !== 'zukan') ? document.getElementById(id) : null;
    var go = function () {
      if (!root.classList.contains('is-open')) return;
      if (target && root.contains(target)) scrollZukanTo(root, target);
      else root.scrollTop = 0;
    };
    requestAnimationFrame(function () { requestAnimationFrame(go); });
    [50, 150, 350, 700, 1200].forEach(function (ms) { setTimeout(go, ms); });
    root.querySelectorAll('img').forEach(function (img) { img.addEventListener('load', go); });
    if (root._zukanRO) { try { root._zukanRO.disconnect(); } catch (e3) {} }
    if (typeof ResizeObserver === 'function') {
      root._zukanRO = new ResizeObserver(function () { go(); });
      root._zukanRO.observe(root.querySelector('.zukan-inner') || root);
    }
    var closeBtn = $('zukanClose');
    if (closeBtn) try { closeBtn.focus(); } catch (e2) {}
  }
  function closeZukan() {
    var root = $('zukan-root');
    if (!root) return;
    if (root._zukanRO) { try { root._zukanRO.disconnect(); } catch (e0) {} root._zukanRO = null; }
    root.classList.remove('is-open');
    document.body.classList.remove('zukan-open');
    if (isZukanHash(location.hash)) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    }
  }
  document.addEventListener('click', function (ev) {
    var closeEl = ev.target.closest && ev.target.closest('#zukanClose, .zukan-close, .zukan-close-link');
    if (closeEl) { ev.preventDefault(); closeZukan(); return; }
    var a = ev.target.closest && ev.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var hash = zukanHashOf(href);
    if (href.indexOf('zukan.html') === 0 || isZukanHash(hash)) {
      ev.preventDefault();
      openZukan(hash || '#zukan-root');
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && $('zukan-root') && $('zukan-root').classList.contains('is-open')) closeZukan();
  });
  if (isZukanHash(location.hash)) openZukan(location.hash);
})();
