// @ts-nocheck
// Interactive viz components, client-side. Relocated verbatim from the old
// viz-runtime.html into the client bundle (registered on window by hydrate.tsx,
// run by the reader after hydration). @ts-nocheck preserves the original
// framework-free JS; it can be incrementally typed later.
// Interactive visualizations, client-side. A chapter embeds one with:
//   ```{=html}
//   <div class="viz" data-viz="kv-cache"></div>
//   ```
// Components init lazily when scrolled into view. Colors are read from the
// page so they follow the light/dark theme.
  function theme() {
    // Palette vars live on .reader (they inherit from the <html> data-theme),
    // not on <body> whose computed `color` defaults to black, which is
    // invisible on the dark canvas. Read --fg-1/--bg-surface like the runnable
    // runtime does so labels track the active light/dark theme.
    var host = document.querySelector('.reader') || document.documentElement;
    var cs = getComputedStyle(host);
    var pick = function (v, fb) { v = (v || '').trim(); return v || fb; };
    return { ink: pick(cs.getPropertyValue('--fg-1'), cs.color || '#1b1813'),
             paper: pick(cs.getPropertyValue('--bg-surface'), cs.backgroundColor || '#faf8f3'),
             grid: 'rgba(128,128,128,0.18)', accent: '#3b82f6', accent2: '#e0936b' };
  }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  // Format a slider value for the readout. Whole numbers print without a
  // trailing ".00"; large values get thousands separators so a price like
  // 2000000 reads as "2,000,000" instead of "2000000.00"; everything else keeps
  // two decimals for the small fractional sliders most viz use.
  function fmtVal(n) {
    if (Number.isInteger(n)) return n.toLocaleString('en-US');
    if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
    return n.toFixed(2);
  }
  function slider(label, min, max, step, val, on) {
    var w = el('label', 'viz-slider');
    var s = el('span'); s.textContent = label;
    var i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val;
    var v = el('span', 'viz-val'); v.textContent = fmtVal(+val);
    i.addEventListener('input', function () { v.textContent = fmtVal(+i.value); on(+i.value); });
    w.appendChild(s); w.appendChild(i); w.appendChild(v);
    return { wrap: w, input: i };
  }
  function canvas(host, h) {
    var c = el('canvas', 'viz-canvas');
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var resizeRaf = 0, lastWidth = 0;
    function size() {
      var w = host.clientWidth || 600;
      c.width = w * dpr; c.height = (h || 300) * dpr;
      c.style.width = w + 'px'; c.style.height = (h || 300) + 'px';
    }
    function scheduleSize() {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      lastWidth = 0;
      function settle() {
        var width = host.clientWidth || 600;
        if (width === lastWidth) { resizeRaf = 0; size(); return; }
        lastWidth = width;
        resizeRaf = requestAnimationFrame(settle);
      }
      resizeRaf = requestAnimationFrame(settle);
    }
    size(); host.appendChild(c);
    window.addEventListener('resize', scheduleSize);
    return { c: c, ctx: c.getContext('2d'), dpr: dpr };
  }
  function watchTheme(host, draw) {
    var raf = 0;
    function resizeCanvas() {
      var c = host.querySelector('canvas.viz-canvas');
      if (!c) return;
      var oldWidth = parseFloat(c.style.width) || host.clientWidth || 600;
      var dpr = c.width / oldWidth || Math.max(1, window.devicePixelRatio || 1);
      var width = host.clientWidth || 600;
      var height = parseFloat(c.style.height) || 300;
      c.width = width * dpr; c.height = height * dpr;
      c.style.width = width + 'px'; c.style.height = height + 'px';
    }
    function schedule() {
      if (!host.isConnected) {
        if (obs) obs.disconnect();
        if (resizeObs) resizeObs.disconnect();
        window.removeEventListener('resize', schedule);
        return;
      }
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        raf = requestAnimationFrame(function () { raf = 0; resizeCanvas(); draw(); });
      });
    }
    // Responsive React layout can settle one frame after the resize event.
    // Re-measure after two frames, then redraw the cleared backing buffer.
    window.addEventListener('resize', schedule);
    var obs = window.MutationObserver ? new MutationObserver(schedule) : null;
    if (obs) obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
    var resizeObs = window.ResizeObserver ? new ResizeObserver(schedule) : null;
    if (resizeObs) resizeObs.observe(host);
  }

  var R = {};

  // Generic single-parameter curve with a slider. Pick a family and labels
  // via data attributes; no arbitrary code. Families cover the book's common
  // shapes (power law, decay, roofline, diminishing returns, logistic).
  R['curve'] = function (host) {
    var fam = host.getAttribute('data-family') || 'powerlaw';
    var xlabel = host.getAttribute('data-xlabel') || 'x';
    var ylabel = host.getAttribute('data-ylabel') || 'y';
    var plabel = host.getAttribute('data-plabel') || 'parameter';
    var pmin = +(host.getAttribute('data-pmin') || 0.1);
    var pmax = +(host.getAttribute('data-pmax') || 2);
    var p = +(host.getAttribute('data-p') || 0.5);
    var logx = host.getAttribute('data-logx') === 'true';
    var logy = host.getAttribute('data-logy') === 'true';
    var fns = {
      powerlaw: function (x, p) { return Math.pow(x, -p); },
      'power-grow': function (x, p) { return Math.pow(x, p); },
      'exp-decay': function (x, p) { return Math.exp(-p * x / 20); },
      sqrt: function (x, p) { return Math.sqrt(p * x); },
      roofline: function (x, p) { return Math.min(p, x / 10); },
      logistic: function (x, p) { return 1 / (1 + Math.exp(-p * (x - 50) / 8)); },
      diminishing: function (x, p) { return 1 - Math.exp(-x / (p * 20)); },
      // p^x: x is the step count n, p is the per-step reliability (reliability pⁿ).
      'pow-base': function (x, p) { return Math.pow(p, x); },
      // U over position: high recall at the ends, low in the middle (lost-in-the-middle).
      'u-shape': function (x, p) { var d = (x - 51) / 50; return 0.25 + 0.75 * Math.pow(Math.abs(d), Math.max(0.2, p)); }
    };
    var f = fns[fam] || fns.powerlaw;
    var cv = canvas(host, 260);
    // Fix the axes across the slider's whole range, then redraw only the curve.
    // Re-ranging Y to the current curve's own min/max (the old behavior) made
    // every parameter look identical: the line always filled the box corner to
    // corner, so the slider appeared to do nothing.
    var XS = [], i;
    for (i = 0; i <= 200; i++) XS.push(1 + i * 0.5);
    var xmin = XS[0], xmax = XS[XS.length - 1];
    var ymin = Infinity, ymax = -Infinity;
    for (var k = 0; k <= 20; k++) {
      var pv = pmin + (pmax - pmin) * k / 20;
      for (i = 0; i < XS.length; i++) { var yv = f(XS[i], pv); if (yv < ymin) ymin = yv; if (yv > ymax) ymax = yv; }
    }
    if (!(ymax > ymin)) ymax = ymin + 1;
    function formatTick(v) {
      var a = Math.abs(v);
      if (a >= 10000 || (a > 0 && a < 0.01)) return v.toExponential(0).replace('+', '');
      if (a >= 100) return String(Math.round(v));
      if (a >= 10) return (Math.round(v * 10) / 10).toString();
      if (a >= 1) return (Math.round(v * 100) / 100).toString();
      return (Math.round(v * 1000) / 1000).toString();
    }
    function linearTicks(min, max) {
      var out = [];
      for (var j = 0; j <= 4; j++) out.push(min + (max - min) * j / 4);
      return out;
    }
    function logTicks(min, max) {
      var lo = Math.max(min, 1e-9), hi = Math.max(max, lo * 1.001), out = [];
      var start = Math.floor(Math.log(lo) / Math.LN10), end = Math.ceil(Math.log(hi) / Math.LN10);
      for (var e = start; e <= end; e++) {
        var v = Math.pow(10, e);
        if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v);
      }
      if (out.length >= 3) return out;
      out = [];
      for (var j = 0; j <= 4; j++) out.push(Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * j / 4));
      return out;
    }
    function axisScaleLabel(label, isLog) {
      if (!isLog || /log|对数/i.test(label)) return label;
      if (/[\u3400-\u9fff]/.test(label)) return /）$/.test(label) ? label.replace(/）$/, '，对数）') : label + '（对数）';
      return /\)$/.test(label) ? label.replace(/\)$/, ', log scale)') : label + ' (log scale)';
    }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      var left = 60 * cv.dpr, right = 28 * cv.dpr, top = 22 * cv.dpr, bottom = 52 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(x) { var u = logx ? (Math.log(x) - Math.log(xmin)) / (Math.log(xmax) - Math.log(xmin)) : (x - xmin) / (xmax - xmin); return left + u * (W - left - right); }
      function Y(y) { var yc = Math.min(ymax, Math.max(ymin, y)); var u = logy ? (Math.log(Math.max(yc, 1e-9)) - Math.log(Math.max(ymin, 1e-9))) / (Math.log(Math.max(ymax, 1e-9)) - Math.log(Math.max(ymin, 1e-9))) : (yc - ymin) / (ymax - ymin); return H - bottom - u * (H - top - bottom); }
      var xTicks = logx ? logTicks(xmin, xmax) : linearTicks(xmin, xmax);
      var yTicks = logy ? logTicks(ymin, ymax) : linearTicks(ymin, ymax);
      ctx.strokeStyle = t.grid; ctx.lineWidth = cv.dpr; ctx.beginPath();
      xTicks.forEach(function (v) { var x = X(v); ctx.moveTo(x, top); ctx.lineTo(x, H - bottom + 4 * cv.dpr); });
      yTicks.forEach(function (v) { var y = Y(v); ctx.moveTo(left - 4 * cv.dpr, y); ctx.lineTo(W - right, y); });
      ctx.stroke();
      ctx.strokeStyle = t.grid; ctx.beginPath(); ctx.moveTo(left, H - bottom); ctx.lineTo(W - right, H - bottom); ctx.moveTo(left, top); ctx.lineTo(left, H - bottom); ctx.stroke();
      ctx.strokeStyle = t.accent; ctx.lineWidth = 2 * cv.dpr; ctx.beginPath();
      XS.forEach(function (xx, i) { var px = X(xx), py = Y(f(xx, p)); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.stroke();
      ctx.fillStyle = t.ink; ctx.font = (10 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      xTicks.forEach(function (v) { ctx.fillText(formatTick(v), X(v), H - bottom + 7 * cv.dpr); });
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      yTicks.forEach(function (v) { ctx.fillText(formatTick(v), left - 8 * cv.dpr, Y(v)); });
      ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(axisScaleLabel(xlabel, logx), W / 2, H - bottom + 36 * cv.dpr);
      ctx.save(); ctx.translate(14 * cv.dpr, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(axisScaleLabel(ylabel, logy), 0, 0); ctx.restore();
    }
    host.appendChild(slider(plabel, pmin, pmax, (pmax - pmin) / 100, p, function (v) { p = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Stepper: walk a process as a row of stage chips + an auto-advancing caption.
  // Authored by putting one child <div data-chip="X" data-title="1 · Input">body
  // text</div> per step inside the .viz host. Avoid $..$ math in bodies — raw
  // HTML blocks bypass KaTeX; use unicode (QKᵀ, √d).
  R['stepper'] = function (host) {
    var steps = Array.prototype.slice.call(host.children).map(function (d) {
      return { chip: d.getAttribute('data-chip') || '', title: d.getAttribute('data-title') || '', body: d.innerHTML };
    }).filter(function (s) { return s.chip || s.title || s.body; });
    if (!steps.length) return;
    host.textContent = '';
    var n = steps.length, cur = 0, timer = null;
    var DELAY = +(host.getAttribute('data-interval') || 3600);
    var zh = host.getAttribute('data-lang') === 'zh' || document.documentElement.lang.indexOf('zh') === 0;
    var L = zh
      ? { group: '交互流程', previous: '上一步', next: '下一步', step: '第' }
      : { group: 'Interactive process', previous: 'Previous step', next: 'Next step', step: 'Step ' };
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var wrap = el('div', 'viz-stepper');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', L.group);
    var chipRow = el('div', 'viz-step-chips');
    var chipEls = [];
    steps.forEach(function (s, i) {
      var ch = el('button', 'viz-step-chip'); ch.type = 'button'; ch.textContent = s.chip || String(i + 1);
      ch.setAttribute('aria-label', zh ? L.step + (i + 1) + '步' : L.step + (i + 1));
      ch.addEventListener('click', function () { go(i, true); });
      chipRow.appendChild(ch); chipEls.push(ch);
    });

    var cap = el('div', 'viz-step-cap');
    cap.setAttribute('aria-live', 'polite');
    var capTitle = el('div', 'viz-step-title');
    var capBody = el('div', 'viz-step-body');
    cap.appendChild(capTitle); cap.appendChild(capBody);

    var nav = el('div', 'viz-step-nav');
    var prev = el('button', 'viz-step-btn'); prev.type = 'button'; prev.textContent = '‹'; prev.setAttribute('aria-label', L.previous);
    var dots = el('div', 'viz-step-dots');
    var dotEls = [];
    steps.forEach(function (_, i) { var d = el('button', 'viz-step-dot'); d.type = 'button'; d.setAttribute('aria-label', zh ? L.step + (i + 1) + '步' : L.step + (i + 1)); d.addEventListener('click', function () { go(i, true); }); dots.appendChild(d); dotEls.push(d); });
    var next = el('button', 'viz-step-btn'); next.type = 'button'; next.textContent = '›'; next.setAttribute('aria-label', L.next);
    prev.addEventListener('click', function () { go((cur - 1 + n) % n, true); });
    next.addEventListener('click', function () { go((cur + 1) % n, true); });
    nav.appendChild(prev); nav.appendChild(dots); nav.appendChild(next);

    function render() {
      chipEls.forEach(function (ch, i) { ch.classList.toggle('on', i === cur); ch.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); });
      dotEls.forEach(function (d, i) { d.classList.toggle('on', i === cur); d.setAttribute('aria-current', i === cur ? 'step' : 'false'); });
      capTitle.textContent = steps[cur].title;
      capBody.innerHTML = steps[cur].body;
    }
    function pause() { if (timer) { clearInterval(timer); timer = null; } }
    function go(i, manual) { cur = i; render(); if (manual) pause(); }
    function tick() { if (!host.isConnected) { pause(); return; } cur = (cur + 1) % n; render(); }
    function restart() { pause(); if (reduceMotion) return; timer = setInterval(tick, DELAY); }

    wrap.appendChild(chipRow); wrap.appendChild(cap); wrap.appendChild(nav);
    host.appendChild(wrap);
    // Pause auto-advance while the reader is hovering or using the controls.
    wrap.addEventListener('mouseenter', pause);
    wrap.addEventListener('mouseleave', restart);
    wrap.addEventListener('focusin', pause);
    wrap.addEventListener('focusout', restart);
    render(); restart();
  };

  // Cost crossover: two cost lines (each fixed + rate·x) with draggable sliders
  // and a live break-even marker. Each of the four params (a/b × fixed/rate)
  // becomes a slider iff data-<key>-min/max are given; otherwise it is constant.
  R['cost-crossover'] = function (host) {
    function attr(n, d) { var v = host.getAttribute(n); return v == null ? d : v; }
    function num(n, d) { var v = host.getAttribute(n); return v == null ? d : parseFloat(v); }
    var xMax = num('data-x-max', 100);
    var xLabel = attr('data-x-label', 'volume'), yLabel = attr('data-y-label', 'cost');
    var crossoverLabel = attr('data-crossover-label', 'break-even');
    var L = [
      { label: attr('data-a-label', 'A'), fixed: num('data-a-fixed', 0), rate: num('data-a-rate', 1) },
      { label: attr('data-b-label', 'B'), fixed: num('data-b-fixed', 0), rate: num('data-b-rate', 1) }
    ];
    var keys = ['a', 'b'], props = ['fixed', 'rate'];
    var cv = canvas(host, 280);
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 46 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      var yMax = 0; L.forEach(function (l) { yMax = Math.max(yMax, l.fixed + l.rate * xMax, l.fixed); });
      yMax = yMax > 0 ? yMax * 1.12 : 1;
      function X(x) { return pd + (W - 1.5 * pd) * (x / xMax); }
      function Y(y) { return H - pd - (H - 1.7 * pd) * (y / yMax); }
      ctx.strokeStyle = t.grid; ctx.lineWidth = cv.dpr;
      ctx.beginPath(); ctx.moveTo(pd, Y(0)); ctx.lineTo(W - 0.5 * pd, Y(0)); ctx.moveTo(pd, Y(0)); ctx.lineTo(pd, Y(yMax)); ctx.stroke();
      var col = [t.accent, t.accent2];
      L.forEach(function (l, i) {
        ctx.strokeStyle = col[i]; ctx.lineWidth = 2.4 * cv.dpr;
        ctx.beginPath(); ctx.moveTo(X(0), Y(l.fixed)); ctx.lineTo(X(xMax), Y(l.fixed + l.rate * xMax)); ctx.stroke();
        ctx.fillStyle = col[i]; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(l.label, X(0) + 8 * cv.dpr, Y(l.fixed + l.rate * xMax) + (i ? 16 : -8) * cv.dpr);
      });
      var d = L[0].rate - L[1].rate, xc = d !== 0 ? (L[1].fixed - L[0].fixed) / d : -1;
      if (xc > 0 && xc < xMax) {
        var yc = L[0].fixed + L[0].rate * xc;
        ctx.setLineDash([4 * cv.dpr, 4 * cv.dpr]); ctx.strokeStyle = t.grid;
        ctx.beginPath(); ctx.moveTo(X(xc), Y(0)); ctx.lineTo(X(xc), Y(yc)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = t.ink; ctx.beginPath(); ctx.arc(X(xc), Y(yc), 4.5 * cv.dpr, 0, 7); ctx.fill();
        ctx.textAlign = 'center'; ctx.font = (12 * cv.dpr) + 'px sans-serif';
        var a = Math.abs(xc), fmt = a >= 1e6 ? (xc / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M'
          : a >= 1e3 ? (xc / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k'
          : a >= 10 ? Math.round(xc) : xc.toFixed(1);
        ctx.fillText(crossoverLabel + ' ≈ ' + fmt, X(xc), Y(0) + 17 * cv.dpr);
      }
      ctx.fillStyle = t.ink; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(xLabel, W / 2, H - 7 * cv.dpr);
      ctx.save(); ctx.translate(13 * cv.dpr, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore();
    }
    keys.forEach(function (k, i) {
      props.forEach(function (p) {
        var mn = host.getAttribute('data-' + k + '-' + p + '-min');
        if (mn == null) return;
        var mx = +host.getAttribute('data-' + k + '-' + p + '-max');
        var lab = attr('data-' + k + '-' + p + '-label', L[i].label + ' ' + p);
        host.appendChild(slider(lab, +mn, mx, (mx - +mn) / 100, L[i][p], function (v) { L[i][p] = v; draw(); }).wrap);
      });
    });
    draw();
    watchTheme(host, draw);
  };

  // InfoNCE pull/push field: a query, its positive, and a cloud of negatives.
  // The contrastive loss pulls the positive in and pushes negatives out, but an
  // easy (far) negative barely moves it. The hardness slider drags the negatives
  // toward the query; their similarity rises, the softmax denominator swells, and
  // the loss climbs. Temperature sharpens how much the single hardest negative
  // dominates the gradient. Geometry mirrors the chapter's runnable demo, where
  // a negative is hardness*q + (1-hardness)*random.
  R['infonce-field'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh' || document.documentElement.lang.indexOf('zh') === 0;
    var L = zh ? {
      query: '查询', positive: '正样本', loss: '损失', hardest: '最难负样本的相似度',
      hardness: '负样本难度', temperature: '温度', description: '正样本与候选负样本的对比得分示意图'
    } : {
      query: 'query', positive: 'positive', loss: 'loss', hardest: 'hardest negative similarity',
      hardness: 'negative hardness', temperature: 'temperature', description: 'Contrastive scores for a positive and candidate negatives'
    };
    var q = { x: 0.28, y: 0.5 }, pos = { x: 0.46, y: 0.4 };
    var negs = [];
    for (var i = 0; i < 14; i++) {
      var a = -0.5 + Math.random() * 2.4, r = 0.34 + Math.random() * 0.3;
      negs.push({ hx: q.x + Math.cos(a) * r, hy: q.y + Math.sin(a) * r * 0.78 });
    }
    var hard = 0, tau = 0.25;
    var bar = el('div', 'viz-pa-bar');
    var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 300);
    function sim(p) { var dx = p.x - q.x, dy = p.y - q.y, d = Math.sqrt(dx * dx + dy * dy); return Math.exp(-Math.pow(d / 0.28, 2)); }
    function curNeg(n) { return { x: n.hx + (q.x - n.hx) * hard, y: n.hy + (q.y - n.hy) * hard }; }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 26 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(u) { return pd + u * (W - 2 * pd); } function Y(v) { return pd + v * (H - 2 * pd); }
      var sp = sim(pos), denom = Math.exp(sp / tau), maxs = 0;
      var nc = negs.map(function (n) { var c = curNeg(n); var s = sim(c); denom += Math.exp(s / tau); if (s > maxs) maxs = s; return { c: c, s: s }; });
      var loss = -Math.log(Math.exp(sp / tau) / denom);
      // Temperature sharpens the softmax: rel is each negative's pull relative to
      // the hardest one, so a low tau concentrates emphasis on the single hardest
      // negative and a high tau spreads it evenly.
      nc.forEach(function (o) {
        var rel = Math.exp((o.s - maxs) / tau);
        ctx.strokeStyle = t.grid; ctx.lineWidth = (0.4 + rel * 3) * cv.dpr;
        ctx.beginPath(); ctx.moveTo(X(q.x), Y(q.y)); ctx.lineTo(X(o.c.x), Y(o.c.y)); ctx.stroke();
      });
      ctx.strokeStyle = '#3dbd8a'; ctx.lineWidth = 2.4 * cv.dpr;
      ctx.beginPath(); ctx.moveTo(X(q.x), Y(q.y)); ctx.lineTo(X(pos.x), Y(pos.y)); ctx.stroke();
      nc.forEach(function (o) {
        var h = Math.exp((o.s - maxs) / tau);
        ctx.fillStyle = 'rgba(' + Math.round(150 + 90 * h) + ',' + Math.round(110 - 72 * h) + ',' + Math.round(112 - 74 * h) + ',' + (0.42 + 0.5 * h) + ')';
        ctx.beginPath(); ctx.arc(X(o.c.x), Y(o.c.y), (4 + 3 * h) * cv.dpr, 0, 7); ctx.fill();
      });
      ctx.fillStyle = '#3dbd8a'; ctx.beginPath(); ctx.arc(X(pos.x), Y(pos.y), 7 * cv.dpr, 0, 7); ctx.fill();
      ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), 8 * cv.dpr, 0, 7); ctx.fill();
      ctx.fillStyle = t.ink; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(L.query, X(q.x), Y(q.y) - 13 * cv.dpr);
      ctx.fillText(L.positive, X(pos.x), Y(pos.y) - 12 * cv.dpr);
      read.textContent = L.loss + ' ' + loss.toFixed(2) + '  ·  ' + L.hardest + ' ' + maxs.toFixed(2);
      cv.c.setAttribute('aria-label', L.description + (zh ? '。' : '. ') + read.textContent);
    }
    host.appendChild(slider(L.hardness, 0, 0.92, 0.01, hard, function (v) { hard = v; draw(); }).wrap);
    host.appendChild(slider(L.temperature, 0.08, 0.6, 0.01, tau, function (v) { tau = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Judge agreement vs Cohen's kappa: two judges label items good or bad, each
  // correct with a fixed accuracy. As the base rate of "good" skews, raw
  // agreement stays high while kappa collapses, which is why "the judge agrees
  // 90% of the time" proves little. Sliders sweep the base rate and accuracy.
  R['judge-kappa'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh' || document.documentElement.lang.indexOf('zh') === 0;
    var L = zh ? {
      agreement: '原始一致率', judgeA: '裁判 A', judgeB: '裁判 B',
      base: '“好”标签的基率', accuracy: '每名裁判的准确率',
      description: '裁判一致率与标签基率关系的示意图'
    } : {
      agreement: 'raw agreement', judgeA: 'judge A', judgeB: 'judge B',
      base: 'base rate of “good”', accuracy: 'each judge’s accuracy',
      description: 'Illustration of judge agreement as label prevalence changes'
    };
    var base = 0.5, acc = 0.85, N = 1000;
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); read.setAttribute('aria-live', 'polite'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 250);
    cv.c.setAttribute('role', 'img');
    function cells() {
      function p(labelGood, truthGood) { var pg = truthGood ? acc : (1 - acc); return labelGood ? pg : 1 - pg; }
      var c = {}; var g = base, b = 1 - base;
      [['g', true], ['b', false]].forEach(function (a) {
        [['g', true], ['b', false]].forEach(function (bl) {
          c[a[0] + bl[0]] = g * p(a[1], true) * p(bl[1], true) + b * p(a[1], false) * p(bl[1], false);
        });
      });
      return c;
    }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      ctx.clearRect(0, 0, W, H);
      var c = cells();
      var po = c.gg + c.bb;
      var rowG = c.gg + c.gb, rowB = c.bg + c.bb, colG = c.gg + c.bg, colB = c.gb + c.bb;
      var pe = rowG * colG + rowB * colB;
      var kappa = (1 - pe) > 1e-9 ? (po - pe) / (1 - pe) : 0;
      var sz = Math.min(W * 0.46, H - 36 * cv.dpr), x0 = (W - sz) / 2, y0 = 14 * cv.dpr;
      [['gg', 0, 0], ['gb', 1, 0], ['bg', 0, 1], ['bb', 1, 1]].forEach(function (e) {
        var v = c[e[0]], x = x0 + e[1] * sz / 2, y = y0 + e[2] * sz / 2, diag = (e[0] === 'gg' || e[0] === 'bb');
        ctx.fillStyle = (diag ? 'rgba(61,189,138,' : 'rgba(224,147,107,') + Math.min(0.85, 0.12 + v * 1.7) + ')';
        ctx.fillRect(x, y, sz / 2 - 3 * cv.dpr, sz / 2 - 3 * cv.dpr);
        ctx.fillStyle = t.ink; ctx.font = (14 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(Math.round(v * N), x + sz / 4, y + sz / 4 + 5 * cv.dpr);
      });
      ctx.fillStyle = t.ink; ctx.font = (11 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(L.judgeB, x0 + sz / 2, y0 - 2 * cv.dpr);
      ctx.save(); ctx.translate(x0 - 8 * cv.dpr, y0 + sz / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(L.judgeA, 0, 0); ctx.restore();
      var summary = L.agreement + ' ' + po.toFixed(2) + '  ·  Cohen’s κ ' + kappa.toFixed(2);
      read.textContent = summary;
      cv.c.setAttribute('aria-label', L.description + '. ' + summary);
    }
    host.appendChild(slider(L.base, 0.5, 0.97, 0.01, base, function (v) { base = v; draw(); }).wrap);
    host.appendChild(slider(L.accuracy, 0.6, 0.98, 0.01, acc, function (v) { acc = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // A signed INT4 group quantizer with one adjustable outlier. Shared mode
  // uses one scale for all values; separate mode assigns one scale to the bulk
  // group and another to the outlier group. The latter is intentionally not
  // called per-channel: these synthetic scalars do not model tensor channels.
  R['outlier-quant'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh' || document.documentElement.lang.indexOf('zh') === 0;
    var L = zh ? {
      shared: '共享尺度', separate: '分组尺度', mode: '尺度模式', error: '主体均方根误差',
      spacing: '主体网格间距', outlier: '离群值幅度', desc: '共享尺度与分组尺度的 INT4 量化误差',
      legend: '实心点：原值；空心圆：重建值；横线：主体组量化网格'
    } : {
      shared: 'shared scale', separate: 'separate scales', mode: 'scale mode', error: 'bulk RMS error',
      spacing: 'bulk grid spacing', outlier: 'outlier magnitude', desc: 'INT4 quantization error with one shared scale versus separate scales',
      legend: 'filled dots: original values; rings: reconstructed values; lines: bulk-group quantization grid'
    };
    var bits = 4;
    var qmax = Math.pow(2, bits - 1) - 1;
    var qmin = -qmax;
    var outlier = 7, mode = 'shared';
    var bulk = [0.7, -0.4, 0.9, -0.8, 0.3, -0.6, 0.5, -0.2, 0.75, -0.5, 0.6];
    var bulkMax = 0.9;
    var bar = el('div', 'viz-pa-bar'); var btn = el('button', 'viz-pa-toggle'); btn.type = 'button'; var read = el('span', 'viz-pa-read');
    btn.setAttribute('aria-label', L.mode); read.setAttribute('aria-live', 'polite');
    bar.appendChild(btn); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 250);
    cv.c.setAttribute('role', 'img');
    var legend = el('p', 'viz-pa-legend'); legend.textContent = L.legend; host.appendChild(legend);
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 26 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      var vals = bulk.concat([outlier]);
      var amax = Math.max(outlier, bulkMax);
      var sharedScale = amax / qmax;
      function Y(v) { return H / 2 - (v / amax) * (H / 2 - pd); }
      var gridScale = (mode === 'shared') ? sharedScale : bulkMax / qmax;
      ctx.strokeStyle = t.grid; ctx.lineWidth = cv.dpr;
      for (var k = qmin; k <= qmax; k++) { var y = Y(k * gridScale); if (y > 4 && y < H - 4) { ctx.beginPath(); ctx.moveTo(pd, y); ctx.lineTo(W - pd, y); ctx.stroke(); } }
      var n = vals.length, bw = (W - 2 * pd) / n, err = 0;
      vals.forEach(function (v, i) {
        var x = pd + bw * (i + 0.5);
        var isOut = (i === n - 1);
        var scale = (mode === 'shared') ? sharedScale : ((isOut ? outlier : bulkMax) / qmax);
        var code = Math.max(qmin, Math.min(qmax, Math.round(v / scale)));
        var q = code * scale;
        if (!isOut) err += (v - q) * (v - q);
        ctx.fillStyle = isOut ? t.accent2 : t.accent;
        ctx.beginPath(); ctx.arc(x, Y(v), 5 * cv.dpr, 0, 7); ctx.fill();
        ctx.strokeStyle = isOut ? t.accent2 : t.accent; ctx.lineWidth = 1.5 * cv.dpr;
        ctx.beginPath(); ctx.arc(x, Math.max(pd, Math.min(H - pd, Y(q))), 7.5 * cv.dpr, 0, 7); ctx.stroke();
      });
      var rms = Math.sqrt(err / bulk.length);
      var modeLabel = mode === 'shared' ? L.shared : L.separate;
      btn.textContent = L.mode + ': ' + modeLabel;
      btn.setAttribute('aria-pressed', mode === 'separate' ? 'true' : 'false');
      var summary = L.error + ' ' + rms.toFixed(3) + ' · ' + L.spacing + ' ' + gridScale.toFixed(3);
      read.textContent = summary;
      cv.c.setAttribute('aria-label', L.desc + '. ' + modeLabel + '. ' + summary + '. ' + L.legend);
    }
    btn.addEventListener('click', function () { mode = (mode === 'shared') ? 'separate' : 'shared'; draw(); });
    host.appendChild(slider(L.outlier, 1, 16, 0.5, outlier, function (v) { outlier = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Decision tree: a product-neutral walk through the model-selection gates
  // (the selection-contract tree), in English or Chinese.
  R['decision-tree'] = function (host) {
    var mode = host.getAttribute('data-mode');
    var lang = host.getAttribute('data-lang') || (document.documentElement.lang.indexOf('zh') === 0 ? 'zh' : 'en');
    var zh = lang === 'zh';
    var SELECTION_EN = { q: 'Satisfies every hard constraint?', opts: [
      { a: 'No', r: 'Reject or use the explicit exception process' },
      { a: 'Yes', next: { q: 'Supports the required interface and capacity?', opts: [
        { a: 'No', r: 'Reject or complete a production-shaped capacity test' },
        { a: 'Yes', next: { q: 'Clears the declared quality gate?', opts: [
          { a: 'No', r: 'Reject; inspect failures and revise only on the development set' },
          { a: 'Yes', next: { q: 'Pareto-efficient on cost, latency, availability, and risk?', opts: [
            { a: 'No', r: 'Remove as dominated or document the exceptional value' },
            { a: 'Yes', r: 'Shortlist for shadow and canary rollout' }
          ] } }
        ] } }
      ] } }
    ] };
    var SELECTION_ZH = { q: '满足所有硬约束？', opts: [
      { a: '否', r: '淘汰，或进入明确的例外流程' },
      { a: '是', next: { q: '支持所需接口和容量？', opts: [
        { a: '否', r: '淘汰，或先完成符合生产形态的容量测试' },
        { a: '是', next: { q: '通过已经声明的质量门？', opts: [
          { a: '否', r: '淘汰；检查失败，只能在开发集上修改方案' },
          { a: '是', next: { q: '在成本、延迟、可用性和风险上处于帕累托前沿？', opts: [
            { a: '否', r: '作为被支配方案删除，或记录其特殊价值' },
            { a: '是', r: '进入影子流量和金丝雀发布候选名单' }
          ] } }
        ] } }
      ] } }
    ] };
    // Only the selection-contract tree exists; a missing or unknown data-mode
    // falls back to it.
    var TREES = { 'selection-contract': zh ? SELECTION_ZH : SELECTION_EN };
    var TREE = Object.prototype.hasOwnProperty.call(TREES, mode) ? TREES[mode] : TREES['selection-contract'];
    var wrap = el('div', 'viz-dt'), path = el('div', 'viz-dt-path'), qEl = el('div', 'viz-dt-q'), opts = el('div', 'viz-ce-chips');
    var resetBtn = el('button', 'viz-pa-toggle'); resetBtn.type = 'button'; resetBtn.textContent = zh ? '重新开始' : 'start over';
    wrap.appendChild(path); wrap.appendChild(qEl); wrap.appendChild(opts); host.appendChild(wrap); host.appendChild(resetBtn);
    var crumbs = [];
    function show(node) {
      opts.textContent = ''; path.textContent = crumbs.join('  ›  '); qEl.textContent = node.q;
      node.opts.forEach(function (o) {
        var b = el('button', 'viz-ce-chip'); b.type = 'button'; b.textContent = o.a;
        b.addEventListener('click', function () {
          crumbs.push(o.a); path.textContent = crumbs.join('  ›  ');
          if (o.r) { qEl.textContent = zh ? '结果' : 'Outcome'; opts.textContent = ''; var res = el('div', 'viz-dt-result'); res.textContent = o.r; opts.appendChild(res); }
          else show(o.next);
        });
        opts.appendChild(b);
      });
    }
    resetBtn.addEventListener('click', function () { crumbs = []; show(TREE); });
    show(TREE);
  };

  // Operational frontier: quality alone is not the production decision. A
  // model can be dominated once cost and latency count. Weight the two penalties
  // and see which point survives as the operating choice.
  R['eval-frontier'] = function (host) {
    var cw = 0.25, lw = 0.15;
    var lang = host.getAttribute('data-lang') || (document.documentElement.lang.indexOf('zh') === 0 ? 'zh' : 'en');
    var L = lang === 'zh' ? {
      small: '小模型', routed: '路由组合', frontier: '前沿点', slow: '慢速大模型', cheap: '低价弱模型',
      xAxis: '每项任务的相对成本', yAxis: '任务质量',
      costWeight: '成本权重', latencyWeight: '延迟权重', chosen: '当前选择'
    } : {
      small: 'small', routed: 'routed', frontier: 'frontier', slow: 'slow giant', cheap: 'cheap weak',
      xAxis: 'relative cost per task', yAxis: 'task quality',
      costWeight: 'cost weight', latencyWeight: 'latency weight', chosen: 'chosen'
    };
    var pts = [
      { n: L.small, q: 0.68, c: 0.22, l: 0.18 },
      { n: L.routed, q: 0.80, c: 0.55, l: 0.32 },
      { n: L.frontier, q: 0.87, c: 1.35, l: 0.72 },
      { n: L.slow, q: 0.875, c: 2.25, l: 1.2 },
      { n: L.cheap, q: 0.55, c: 0.12, l: 0.12 }
    ];
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 260);
    cv.c.setAttribute('role', 'img');
    read.setAttribute('aria-live', 'polite');
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 42 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(c) { return pd + c / 2.5 * (W - 2 * pd); }
      function Y(q) { return H - pd - (q - 0.5) / 0.42 * (H - 2 * pd); }
      var best = 0, bestU = -Infinity;
      pts.forEach(function (p, i) { var u = p.q - cw * p.c - lw * p.l; if (u > bestU) { bestU = u; best = i; } });
      ctx.strokeStyle = t.grid; ctx.beginPath(); ctx.moveTo(pd, H - pd); ctx.lineTo(W - pd, H - pd); ctx.moveTo(pd, pd); ctx.lineTo(pd, H - pd); ctx.stroke();
      ctx.strokeStyle = t.accent; ctx.lineWidth = 1.5 * cv.dpr; ctx.beginPath(); [0, 1, 2].forEach(function (i, k) { var p = pts[i]; if (k === 0) ctx.moveTo(X(p.c), Y(p.q)); else ctx.lineTo(X(p.c), Y(p.q)); }); ctx.stroke();
      pts.forEach(function (p, i) {
        var r = (7 + 10 * p.l) * cv.dpr;
        ctx.fillStyle = i === best ? t.accent : 'rgba(128,128,128,0.33)';
        ctx.beginPath(); ctx.arc(X(p.c), Y(p.q), r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = i === best ? '#fff' : t.ink; ctx.font = (11 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(p.n, X(p.c), Y(p.q) + 3 * cv.dpr);
      });
      ctx.fillStyle = t.ink; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(L.xAxis, W / 2, H - 12 * cv.dpr);
      ctx.save(); ctx.translate(14 * cv.dpr, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(L.yAxis, 0, 0); ctx.restore();
      read.textContent = L.costWeight + '=' + cw.toFixed(2) + ' · ' + L.latencyWeight + '=' + lw.toFixed(2) + ' · ' + L.chosen + ': ' + pts[best].n;
      cv.c.setAttribute('aria-label', read.textContent);
    }
    host.appendChild(slider(L.costWeight, 0, 0.8, 0.01, cw, function (v) { cw = v; draw(); }).wrap);
    host.appendChild(slider(L.latencyWeight, 0, 0.8, 0.01, lw, function (v) { lw = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Safety frontier: threshold selection moves the operating point between
  // unsafe answers and benign refusals. Better training moves the curve; a
  // deployment still chooses a point on it.
  R['safety-frontier'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh';
    var th = 0.52;
    var labels = zh
      ? { th: '风险分数阈值', x: '无害请求被拒绝', y: '有害请求被放行', point: '工作点' }
      : { th: 'risk-score cutoff', x: 'benign requests refused', y: 'harmful requests allowed', point: 'operating point' };
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 270);
    function xy(s) {
      return { x: 0.04 + 0.46 * Math.pow(1 - s, 2.05), y: 0.035 + 0.46 * Math.pow(s, 2.0) };
    }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 44 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(v) { return pd + v / 0.55 * (W - 2 * pd); }
      function Y(v) { return H - pd - v / 0.55 * (H - 2 * pd); }
      ctx.strokeStyle = t.grid; ctx.beginPath(); ctx.moveTo(pd, H - pd); ctx.lineTo(W - pd, H - pd); ctx.moveTo(pd, pd); ctx.lineTo(pd, H - pd); ctx.stroke();
      ctx.strokeStyle = t.accent; ctx.lineWidth = 2 * cv.dpr; ctx.beginPath();
      for (var i = 0; i <= 100; i++) {
        var p = xy(i / 100), x = X(p.x), y = Y(p.y);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      var op = xy(th);
      ctx.fillStyle = t.accent2; ctx.beginPath(); ctx.arc(X(op.x), Y(op.y), 6 * cv.dpr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.ink; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(labels.x, W / 2, H - 12 * cv.dpr);
      ctx.save(); ctx.translate(14 * cv.dpr, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(labels.y, 0, 0); ctx.restore();
      ctx.textAlign = 'left'; ctx.fillText(labels.point, X(op.x) + 8 * cv.dpr, Y(op.y) - 8 * cv.dpr);
      read.textContent = labels.th + '=' + th.toFixed(2) + ' · ' + labels.x + ' ' + Math.round(op.x * 100) + '% · ' + labels.y + ' ' + Math.round(op.y * 100) + '%';
    }
    host.appendChild(slider(labels.th, 0.05, 0.95, 0.01, th, function (v) { th = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  function init(host) {
    var name = host.getAttribute('data-viz');
    // The wrapping <figure class="figure"> is inline-block (Bootstrap), which
    // collapses the empty host to zero width. Force it to full-width block
    // before measuring, so the canvas gets a real width.
    var fig = host.closest && host.closest('figure');
    if (fig) { fig.style.display = 'block'; fig.style.width = '100%'; }
    if (R[name] && !host.classList.contains('viz-ready')) { host.classList.add('viz-ready'); try { R[name](host); } catch (e) { host.textContent = 'viz error: ' + e.message; } }
  }
  function boot() {
    // Init eagerly: the reader calls boot() after hydration when layout is
    // settled, so widths are real. (Lazy IntersectionObserver init was
    // unreliable once <main> became the scroll container, not the viewport.)
    document.querySelectorAll('.viz[data-viz]').forEach(init);
  }
  // The React reader owns the article DOM (dangerouslySetInnerHTML), so it must
  // drive init AFTER hydration — auto-booting on DOMContentLoaded races
  // hydration and hooks nodes that get replaced. Expose boot for the reader.
export { boot as mountViz };
