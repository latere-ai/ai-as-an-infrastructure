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
      'u-shape': function (x, p) { var d = (x - 51) / 50; return 0.25 + 0.75 * Math.pow(Math.abs(d), Math.max(0.2, p)); },
      // Bradley-Terry / Elo win probability; x-1 maps to a 0..800 rating gap, p is the scale.
      elo: function (x, p) { return 1 / (1 + Math.pow(10, -((x - 1) * 8) / p)); }
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

  // Attention-weight matrix: rows are queries, columns are keys; click a row to
  // read its normalized attention distribution as bars. The weights are an
  // ILLUSTRATIVE pattern (self + neighbor decay + one structured link), not a
  // trained model's; the caption says so. Tokens come from data-tokens.
  R['attention-heatmap'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh' || document.documentElement.lang.indexOf('zh') === 0;
    var toks = (host.getAttribute('data-tokens') || 'the,cat,sat,on,the,mat,.')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var n = toks.length;
    var pattern = host.getAttribute('data-pattern') || 'diagonal';
    // Build a row-normalized illustrative weight matrix. 'diagonal' (default):
    // self + neighbor decay + one structured link. 'sink': mass parks on the
    // first key column(s) plus a recent window — the attention-sink phenomenon.
    var W = [];
    for (var i = 0; i < n; i++) {
      var row = [], sum = 0, link = (i * 3 + 2) % n;
      for (var j = 0; j < n; j++) {
        var w;
        if (pattern === 'sink') {
          w = 0.03 + 0.85 * Math.exp(-Math.abs(i - j) / 1.1); // recent window
          if (j === 0) w += 1.5;                              // the sink
          if (j === 1) w += 0.45;                             // weaker second sink
          if (j > i) w = 0;                                   // causal mask
        } else {
          w = 0.05 + 0.6 * Math.exp(-Math.abs(i - j) / 1.5);
          if (j === i) w += 1.0;
          if (j === link) w += 0.5;
        }
        row.push(w); sum += w;
      }
      for (var k = 0; k < n; k++) row[k] /= sum;
      W.push(row);
    }
    var sel = Math.min(2, n - 1); // default selected query row
    var t = host.getAttribute('data-cap-query') || (zh ? '查询' : 'query');
    var keyLabel = host.getAttribute('data-cap-key') || (zh ? '键' : 'key');
    var toLabel = zh ? '到' : 'to';

    var wrap = el('div', 'viz-attn');
    var grid = el('div', 'viz-attn-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', zh ? '注意力权重矩阵' : 'attention-weight matrix');
    grid.style.gridTemplateColumns = 'auto repeat(' + n + ', 30px)';
    var rowEls = []; // [{lbl, cells:[]}] per query row, for highlight
    // header: empty corner + column (key) labels
    grid.appendChild(el('div'));
    for (var c = 0; c < n; c++) { var cl = el('div', 'viz-attn-lbl col'); cl.textContent = toks[c]; grid.appendChild(cl); }
    for (var r = 0; r < n; r++) {
      (function (r) {
        var lbl = el('button', 'viz-attn-lbl'); lbl.type = 'button'; lbl.textContent = toks[r];
        lbl.setAttribute('aria-label', t + ' ' + toks[r]);
        lbl.addEventListener('click', function () { select(r); });
        grid.appendChild(lbl);
        var cells = [];
        for (var cc = 0; cc < n; cc++) {
          (function (cc) {
            var cell = el('div', 'viz-attn-cell');
            cell.style.background = 'color-mix(in srgb, var(--accent, #c2603f) ' + (W[r][cc] * 100).toFixed(1) + '%, transparent)';
            cell.title = toks[r] + ' → ' + toks[cc] + ': ' + (W[r][cc] * 100).toFixed(0) + '%';
            cell.setAttribute('role', 'img');
            cell.setAttribute('aria-label', t + ' ' + toks[r] + ' ' + toLabel + ' ' + keyLabel + ' ' + toks[cc] + ': ' + (W[r][cc] * 100).toFixed(0) + '%');
            cell.addEventListener('click', function () { select(r); });
            grid.appendChild(cell); cells.push(cell);
          })(cc);
        }
        rowEls.push({ lbl: lbl, cells: cells });
      })(r);
    }

    var bars = el('div', 'viz-attn-bars');
    var qTitle = el('div', 'viz-attn-q');
    qTitle.setAttribute('aria-live', 'polite');
    bars.appendChild(qTitle);
    var barEls = []; // [{fill, pct}]
    for (var b = 0; b < n; b++) {
      var bar = el('div', 'viz-attn-bar');
      var name = el('span'); name.textContent = toks[b];
      var track = el('div', 'viz-attn-track');
      var fill = el('div', 'viz-attn-fill'); track.appendChild(fill);
      var pct = el('span', 'viz-attn-pct');
      bar.appendChild(name); bar.appendChild(track); bar.appendChild(pct);
      bars.appendChild(bar); barEls.push({ fill: fill, pct: pct });
    }

    var hint = el('div', 'viz-attn-hint');
    hint.textContent = host.getAttribute('data-hint') || 'Click any cell or row label to choose the query.';

    function select(r) {
      sel = r;
      rowEls.forEach(function (re, i) {
        var on = i === r;
        re.lbl.classList.toggle('viz-attn-sel', on);
        re.lbl.setAttribute('aria-pressed', on ? 'true' : 'false');
        re.cells.forEach(function (cell) {
          cell.classList.toggle('viz-attn-sel', on);
        });
      });
      qTitle.textContent = t + ' “' + toks[r] + '”';
      for (var j = 0; j < n; j++) {
        barEls[j].fill.style.width = (W[r][j] * 100).toFixed(1) + '%';
        barEls[j].pct.textContent = Math.round(W[r][j] * 100) + '%';
      }
    }

    wrap.appendChild(grid); wrap.appendChild(bars); wrap.appendChild(hint);
    host.appendChild(wrap);
    select(sel);
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

  // ROI balance: a dimensionless sensitivity explorer in common normalized
  // value units. Benefits and costs are never inferred by adding raw percentage
  // changes; the surrounding chapter explains how to build the monetary ledger.
  R['roi-balance'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh';
    var capacity = 28, quality = 10, model = 12, review = 18, fixed = 8, risk = 10;
    var labels = zh ? {
      capacity: '产能收益',
      quality: '质量 / 收入收益',
      model: '模型成本',
      review: '审查与返工',
      fixed: '固定采用成本',
      risk: '预期事故损失',
      net: '净值',
      capacityBenefit: '产能收益',
      qualityBenefit: '质量 / 收入收益',
      modelCost: '模型成本',
      reviewCost: '审查 / 返工成本',
      fixedCost: '固定采用成本',
      riskCost: '预期事故损失',
      read: '净值 '
    } : {
      capacity: 'capacity benefit',
      quality: 'quality / revenue benefit',
      model: 'model cost',
      review: 'review + rework',
      fixed: 'fixed adoption cost',
      risk: 'expected incident loss',
      net: 'net value',
      capacityBenefit: 'capacity benefit',
      qualityBenefit: 'quality / revenue benefit',
      modelCost: 'model cost',
      reviewCost: 'review / rework cost',
      fixedCost: 'fixed adoption cost',
      riskCost: 'expected incident loss',
      read: 'net value '
    };
    var bar = el('div', 'viz-pa-bar');
    var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 330);
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      ctx.clearRect(0, 0, W, H);
      var net = capacity + quality - model - review - fixed - risk;
      var rows = [
        { label: labels.capacity, v: capacity, color: t.accent },
        { label: labels.quality, v: quality, color: t.accent },
        { label: labels.model, v: -model, color: t.accent2 },
        { label: labels.review, v: -review, color: t.accent2 },
        { label: labels.fixed, v: -fixed, color: t.accent2 },
        { label: labels.risk, v: -risk, color: t.accent2 },
        { label: labels.net, v: net, color: net >= 0 ? t.accent : t.accent2 }
      ];
      var maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.v); }));
      maxAbs = Math.max(20, maxAbs * 1.2);
      var left = 8 * cv.dpr, right = W - left, zero = W / 2;
      var scale = (W / 2 - 16 * cv.dpr) / maxAbs;
      var rowH = 42 * cv.dpr;
      rows.forEach(function (r, i) {
        var y = 7 * cv.dpr + i * rowH;
        var barY = y + 18 * cv.dpr;
        var w = r.v * scale;
        if (i === rows.length - 1) {
          ctx.strokeStyle = t.grid; ctx.lineWidth = cv.dpr;
          ctx.beginPath(); ctx.moveTo(left, y - 5 * cv.dpr); ctx.lineTo(right, y - 5 * cv.dpr); ctx.stroke();
        }
        ctx.fillStyle = t.ink; ctx.font = (11.5 * cv.dpr) + 'px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(r.label, left, y + 11 * cv.dpr);
        ctx.textAlign = 'right';
        ctx.fillText((r.v >= 0 ? '+' : '') + r.v.toFixed(0), right, y + 11 * cv.dpr);
        ctx.strokeStyle = t.grid; ctx.lineWidth = cv.dpr;
        ctx.beginPath(); ctx.moveTo(zero, barY - 2 * cv.dpr); ctx.lineTo(zero, barY + 15 * cv.dpr); ctx.stroke();
        ctx.fillStyle = r.color;
        ctx.fillRect(w >= 0 ? zero : zero + w, barY, Math.abs(w), 12 * cv.dpr);
      });
      read.textContent = labels.read + (net >= 0 ? '+' : '') + net.toFixed(0) + ' / 100';
    }
    host.appendChild(slider(labels.capacityBenefit, 0, 60, 1, capacity, function (v) { capacity = v; draw(); }).wrap);
    host.appendChild(slider(labels.qualityBenefit, 0, 40, 1, quality, function (v) { quality = v; draw(); }).wrap);
    host.appendChild(slider(labels.modelCost, 0, 60, 1, model, function (v) { model = v; draw(); }).wrap);
    host.appendChild(slider(labels.reviewCost, 0, 60, 1, review, function (v) { review = v; draw(); }).wrap);
    host.appendChild(slider(labels.fixedCost, 0, 60, 1, fixed, function (v) { fixed = v; draw(); }).wrap);
    host.appendChild(slider(labels.riskCost, 0, 60, 1, risk, function (v) { risk = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Tree of thoughts: the same reasoning space searched three ways. A chain
  // follows one path. A tree explores every branch (wide but costly). A
  // value-guided beam scores each node and keeps only the best few, pruning the
  // rest (grey) and thickening the surviving best path. Auto-reveals by depth.
  R['tree-of-thoughts'] = function (host) {
    var D = 3, mode = 'guided', reveal = 0, timer;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var byLevel = [], nodes = [];
    (function build() {
      for (var d = 0; d <= D; d++) {
        byLevel[d] = [];
        for (var i = 0; i < Math.pow(2, d); i++) {
          var n = { depth: d, children: [], value: 0 };
          nodes.push(n); byLevel[d].push(n);
          if (d > 0) { var par = byLevel[d - 1][i >> 1]; n.parent = par; par.children.push(n); }
        }
      }
      byLevel[D].forEach(function (n, i) { n.value = Math.sin(i * 2.3 + 1) * 0.5 + 0.5; });
      for (var d = D - 1; d >= 0; d--) byLevel[d].forEach(function (n) { n.value = Math.max.apply(null, n.children.map(function (c) { return c.value; })); });
      byLevel[D].forEach(function (n, i) { n.ux = (i + 0.5) / byLevel[D].length; });
      for (var d2 = D - 1; d2 >= 0; d2--) byLevel[d2].forEach(function (n) { n.ux = (n.children[0].ux + n.children[n.children.length - 1].ux) / 2; });
    })();
    function active() {
      if (mode === 'tree') return new Set(nodes);
      if (mode === 'chain') { var s = new Set(), n = byLevel[0][0]; s.add(n); while (n.children.length) { n = n.children.reduce(function (a, b) { return b.value > a.value ? b : a; }); s.add(n); } return s; }
      var keep = new Set(byLevel[0]), fr = byLevel[0].slice();
      for (var d = 0; d < D; d++) { var c = []; fr.forEach(function (n) { n.children.forEach(function (k) { c.push(k); }); }); c.sort(function (a, b) { return b.value - a.value; }); fr = c.slice(0, 2); fr.forEach(function (n) { keep.add(n); }); }
      return keep;
    }
    function bestPath() { var s = new Set(), n = byLevel[0][0]; s.add(n); while (n.children.length) { n = n.children.reduce(function (a, b) { return b.value > a.value ? b : a; }); s.add(n); } return s; }
    var bar = el('div', 'viz-pa-bar');
    var btn = el('button', 'viz-pa-toggle'); btn.type = 'button';
    var read = el('span', 'viz-pa-read');
    bar.appendChild(btn); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 280);
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 30 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      var act = active(), best = bestPath();
      function X(u) { return pd + u * (W - 2 * pd); }
      function Y(d) { return pd + d / D * (H - 2.4 * pd); }
      // edges
      nodes.forEach(function (n) {
        if (!n.parent || n.depth > reveal) return;
        var on = act.has(n) && act.has(n.parent);
        var onBest = mode !== 'tree' && best.has(n) && best.has(n.parent);
        ctx.strokeStyle = on ? t.accent : t.grid; ctx.lineWidth = (onBest ? 3.2 : on ? 1.8 : 1) * cv.dpr;
        ctx.beginPath(); ctx.moveTo(X(n.parent.ux), Y(n.parent.depth)); ctx.lineTo(X(n.ux), Y(n.depth)); ctx.stroke();
      });
      // nodes
      nodes.forEach(function (n) {
        if (n.depth > reveal) return;
        var on = act.has(n), onBest = mode !== 'tree' && best.has(n);
        ctx.fillStyle = onBest ? t.accent : on ? t.accent : t.grid;
        ctx.globalAlpha = on ? 1 : 0.35;
        ctx.beginPath(); ctx.arc(X(n.ux), Y(n.depth), (onBest ? 7 : 5.5) * cv.dpr, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      });
      var explored = nodes.filter(function (n) { return n.depth <= reveal && active().has(n); }).length;
      btn.textContent = 'strategy: ' + (mode === 'chain' ? 'single chain' : mode === 'tree' ? 'explore every branch' : 'value-guided search');
      read.textContent = explored + ' of ' + nodes.length + ' thoughts kept';
    }
    function tick() { reveal++; if (reveal > D + 1) reveal = 0; draw(); }
    btn.addEventListener('click', function () { mode = mode === 'chain' ? 'tree' : mode === 'tree' ? 'guided' : 'chain'; reveal = D; draw(); });
    function restart() { if (timer) clearInterval(timer); if (reduceMotion) return; timer = setInterval(tick, 700); }
    host.addEventListener('mouseenter', function () { if (timer) { clearInterval(timer); timer = null; } });
    host.addEventListener('mouseleave', restart);
    reveal = D; draw();
    watchTheme(host, draw);
    restart();
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

  // Three process cadences shown as concentric rings. The geometry compares
  // their rates; it does not claim that training is nested inside runtime.
  // Training sweeps before release, decoding advances per generated token, and
  // an agent task advances through model and tool steps.
  R['nested-loops'] = function (host) {
    var zh = document.documentElement.lang.indexOf('zh') === 0;
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', zh
      ? '三个过程的节奏：训练发生在发布前，解码按词元推进，智能体循环按任务步骤推进。'
      : 'Three process cadences: training before release, decoding per token, and the agent loop per task step.');
    var cv = canvas(host, 340);
    var t0 = 0, sweep = 0, timer = null;
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      var cx = W / 2, cy = H / 2 + 8 * cv.dpr, R = Math.min(W * 0.5, H * 0.43);
      ctx.clearRect(0, 0, W, H);
      var rings = [
        { r: 0.96, speed: 0.5, accent: false, label: zh ? '智能体循环 · 每个任务步骤' : 'agent loop · per task step' },
        { r: 0.62, speed: 2.3, accent: false, label: zh ? '解码 · 每个词元' : 'decoding · per token' },
        { r: 0.28, speed: 0, accent: true, label: zh ? '训练 · 发布前' : 'training · before release' }
      ];
      rings.forEach(function (ring) {
        var rr = R * ring.r;
        ctx.strokeStyle = t.grid; ctx.lineWidth = 1.3 * cv.dpr;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.stroke();
        var ang = ring.speed === 0 ? (-Math.PI / 2 + Math.min(sweep, 1) * 2 * Math.PI) : (-Math.PI / 2 + t0 * ring.speed);
        var col = ring.accent ? t.accent2 : t.accent;
        var dx = cx + Math.cos(ang) * rr, dy = cy + Math.sin(ang) * rr;
        if (ring.speed === 0 && sweep < 1) { // draw the partial sweep as a thick arc
          ctx.strokeStyle = t.accent2; ctx.lineWidth = 3 * cv.dpr;
          ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + sweep * 2 * Math.PI); ctx.stroke();
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(dx, dy, 6 * cv.dpr, 0, 7); ctx.fill();
        ctx.fillStyle = ring.accent ? t.accent2 : t.accent; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(ring.label, cx, cy - rr - 8 * cv.dpr);
      });
    }
    function loop() { timer = requestAnimationFrame(loop); t0 += 0.016; if (sweep < 1.2) sweep += 0.004; draw(); }
    // No hover-pause: this is an ambient illustration with no controls to
    // inspect, so freezing it on hover only reads as the animation breaking.
    // Training sweeps and rests to represent an upstream released artifact;
    // decoding and agent execution continue at runtime.
    watchTheme(host, draw);
    loop();
  };

  // Three data-movement boundaries. Animation speeds preserve the qualitative
  // locality hierarchy without claiming fixed ratios; sustained rates depend
  // on the deployed device, domain, topology, direction, and traffic pattern.
  R['bandwidth-tiers'] = function (host) {
    var cv = canvas(host, 230);
    var tiers = [
      { label: 'HBM · device memory', rate: 'measure sustained', speed: 1.0 },
      { label: 'NVLink / scale-up', rate: 'domain-specific', speed: 0.55 },
      { label: 'IB / Ethernet scale-out', rate: 'topology-specific', speed: 0.28 }
    ];
    var pos = [0.0, 0.0, 0.0], timer = null;
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 26 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      var laneH = (H - 2 * pd) / 3, x0 = pd + 150 * cv.dpr, x1 = W - pd;
      tiers.forEach(function (tier, i) {
        var y = pd + laneH * (i + 0.5);
        ctx.strokeStyle = t.grid; ctx.lineWidth = 2 * cv.dpr;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        var px = x0 + (x1 - x0) * pos[i];
        ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(px, y, 7 * cv.dpr, 0, 7); ctx.fill();
        ctx.fillStyle = t.ink; ctx.textAlign = 'left'; ctx.font = (12.5 * cv.dpr) + 'px sans-serif';
        ctx.fillText(tier.label, pd, y - 5 * cv.dpr);
        ctx.fillStyle = 'rgba(128,128,128,0.75)'; ctx.font = (10.5 * cv.dpr) + 'px ui-monospace, monospace';
        ctx.fillText(tier.rate, pd, y + 13 * cv.dpr);
      });
    }
    function tick() { timer = requestAnimationFrame(tick); tiers.forEach(function (tier, i) { pos[i] += tier.speed * 0.013; if (pos[i] > 1) pos[i] = 0; }); draw(); }
    host.addEventListener('mouseenter', function () { if (timer) { cancelAnimationFrame(timer); timer = null; } });
    host.addEventListener('mouseleave', function () { if (!timer) tick(); });
    watchTheme(host, draw);
    tick();
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

  // MinHash + LSH candidate probability. For b bands of r rows and true
  // Jaccard similarity s, the probability that at least one band matches is
  // 1 - (1 - s^r)^b. Increasing rows per band makes the gate stricter; it does
  // not remove the false-positive/false-negative tradeoff.
  R['minhash-buckets'] = function (host) {
    var rows = 5, bands = 20;
    var xLabel = host.getAttribute('data-xlabel') || 'Jaccard similarity';
    var yLabel = host.getAttribute('data-ylabel') || 'candidate probability';
    var parameterLabel = host.getAttribute('data-plabel') || 'rows per band';
    var bandsLabel = host.getAttribute('data-bands-label') || 'bands';
    var rowsLabel = host.getAttribute('data-rows-label') || 'rows';
    var midpointLabel = host.getAttribute('data-midpoint-label') || '50% candidate at';
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 250);
    function candidateProbability(s) {
      return 1 - Math.pow(1 - Math.pow(s, rows), bands);
    }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      var left = 45 * cv.dpr, right = 16 * cv.dpr, top = 18 * cv.dpr, bottom = 38 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(s) { return left + s * (W - left - right); }
      function Y(p) { return H - bottom - p * (H - top - bottom); }

      ctx.strokeStyle = t.grid; ctx.lineWidth = cv.dpr;
      for (var tick = 0; tick <= 4; tick++) {
        var value = tick / 4, x = X(value), y = Y(value);
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, H - bottom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(W - right, y); ctx.stroke();
      }

      ctx.strokeStyle = t.accent; ctx.lineWidth = 2.2 * cv.dpr; ctx.beginPath();
      for (var i = 0; i <= 200; i++) {
        var s = i / 200, xCurve = X(s), yCurve = Y(candidateProbability(s));
        if (i === 0) ctx.moveTo(xCurve, yCurve); else ctx.lineTo(xCurve, yCurve);
      }
      ctx.stroke();

      var s50 = Math.pow(1 - Math.pow(0.5, 1 / bands), 1 / rows);
      ctx.strokeStyle = t.accent2; ctx.setLineDash([4 * cv.dpr, 3 * cv.dpr]);
      ctx.beginPath(); ctx.moveTo(X(s50), Y(0)); ctx.lineTo(X(s50), Y(0.5)); ctx.lineTo(X(0), Y(0.5)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = t.accent2; ctx.beginPath(); ctx.arc(X(s50), Y(0.5), 4 * cv.dpr, 0, 7); ctx.fill();

      ctx.fillStyle = t.ink; ctx.font = (10.5 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(xLabel, (left + W - right) / 2, H - 8 * cv.dpr);
      ctx.save(); ctx.translate(12 * cv.dpr, (top + H - bottom) / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText(yLabel, 0, 0); ctx.restore();
      read.textContent = bands + ' ' + bandsLabel + ' × ' + rows + ' ' + rowsLabel + ' · ' + midpointLabel + ' J=' + s50.toFixed(2);
    }
    host.appendChild(slider(parameterLabel, 1, 12, 1, rows, function (v) { rows = Math.round(v); draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Blast radius of ambient authority: one standing token reaches every resource
  // its scope covers, so a single injected instruction acts on the union. Widen
  // the scope and the reachable set fans out; a longer TTL brightens the exposure.
  // A short-lived capability token, minted per call, collapses the radius to one.
  R['blast-radius'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh' || document.documentElement.lang.indexOf('zh') === 0;
    var L = zh
      ? { token: '令牌', standing: '长期令牌', capability: '单次能力令牌', reachable: '可达', of: '个资源，共', ttl: '有效期', min: '分钟', scope: '范围宽度', ttlSlider: '有效期（分钟）', description: '令牌可达资源范围的示意图' }
      : { token: 'token', standing: 'standing token', capability: 'single-call capability token', reachable: 'reachable', of: 'of', ttl: 'TTL', min: 'min', scope: 'scope breadth', ttlSlider: 'TTL (minutes)', description: 'Diagram of resources reachable by a token' };
    var scope = 0.5, ttl = 30, mode = 'standing', N = 18, cols = 6, rows = 3;
    var bar = el('div', 'viz-pa-bar'); var btn = el('button', 'viz-pa-toggle'); btn.type = 'button'; var read = el('span', 'viz-pa-read');
    read.setAttribute('aria-live', 'polite');
    bar.appendChild(btn); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 280);
    cv.c.setAttribute('role', 'img');
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      ctx.clearRect(0, 0, W, H);
      var ax = W * 0.13, ay = H / 2;
      var reach = (mode === 'capability') ? 1 : Math.max(1, Math.round(N * scope));
      var linkA = (mode === 'capability') ? 0.5 : (0.12 + 0.4 * (ttl / 240));
      var gx = W * 0.3, gw = W * 0.62, gy = 26 * cv.dpr, gh = H - 56 * cv.dpr;
      for (var i = 0; i < N; i++) {
        var r = Math.floor(i / cols), c = i % cols;
        var x = gx + (c + 0.5) * gw / cols, y = gy + (r + 0.5) * gh / rows, on = i < reach;
        if (on) { ctx.strokeStyle = t.accent; ctx.globalAlpha = linkA; ctx.lineWidth = cv.dpr; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.fillStyle = on ? t.accent : t.grid;
        ctx.fillRect(x - 8 * cv.dpr, y - 8 * cv.dpr, 16 * cv.dpr, 16 * cv.dpr);
      }
      ctx.fillStyle = t.accent2; ctx.beginPath(); ctx.arc(ax, ay, 11 * cv.dpr, 0, 7); ctx.fill();
      ctx.fillStyle = t.ink; ctx.font = (11 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(L.token, ax, ay - 16 * cv.dpr);
      var modeLabel = mode === 'standing' ? L.standing : L.capability;
      var summary = zh
        ? L.reachable + ' ' + reach + ' ' + L.of + ' ' + N + ' 个资源 · ' + L.ttl + ' ' + Math.round(ttl) + ' ' + L.min
        : L.reachable + ' ' + reach + ' ' + L.of + ' ' + N + ' resources · ' + L.ttl + ' ' + Math.round(ttl) + ' ' + L.min;
      btn.textContent = L.token + ': ' + modeLabel;
      read.textContent = summary;
      cv.c.setAttribute('aria-label', zh ? L.description + '。' + modeLabel + '，' + summary : L.description + '. ' + modeLabel + '. ' + summary);
    }
    btn.addEventListener('click', function () { mode = (mode === 'standing') ? 'capability' : 'standing'; draw(); });
    host.appendChild(slider(L.scope, 0.05, 1, 0.05, scope, function (v) { scope = v; draw(); }).wrap);
    host.appendChild(slider(L.ttlSlider, 1, 240, 1, ttl, function (v) { ttl = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Agent-RL systems have two independent design axes: resource placement
  // (shared or separate pools) and update synchronization (barriered or async).
  // This view switches axes instead of incorrectly equating disaggregation with
  // stale data or colocation with an on-policy update.
  R['rl-timeline'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh' || document.documentElement.lang.indexOf('zh') === 0;
    var L = zh ? {
      placement: '资源位置', schedule: '更新时序', colocated: '共享资源池', separate: '独立资源池',
      shared: '同一 GPU 池', rollout: '推演', learn: '学习', rolloutPool: '推演池', learnPool: '学习池',
      sync: '同步屏障', async: '异步重叠', update: '更新', weights: '权重同步', versioned: '带版本的数据',
      placementRead: '资源位置决定角色运行在哪里；它本身不决定数据是否在策略。',
      scheduleRead: '更新时序决定何时等待；异步模式必须测量策略陈旧度。',
      placementDesc: '资源位置比较：共享 GPU 池与独立推演、学习池。',
      scheduleDesc: '更新时序比较：同步屏障与带策略版本的异步重叠。'
    } : {
      placement: 'placement', schedule: 'update schedule', colocated: 'colocated', separate: 'separate pools',
      shared: 'shared GPU pool', rollout: 'rollout', learn: 'learn', rolloutPool: 'rollout pool', learnPool: 'learning pool',
      sync: 'synchronous', async: 'asynchronous', update: 'update', weights: 'weight sync', versioned: 'versioned data',
      placementRead: 'Placement decides where roles run; it does not determine whether data is on-policy.',
      scheduleRead: 'Update timing decides when roles wait; asynchronous runs must measure policy lag.',
      placementDesc: 'Resource placement comparison: a shared GPU pool and separate rollout and learning pools.',
      scheduleDesc: 'Update schedule comparison: a synchronous barrier and asynchronous overlap with policy versions.'
    };
    var axis = 'placement';
    var bar = el('div', 'viz-pa-bar');
    var placementBtn = el('button', 'viz-pa-toggle'); placementBtn.type = 'button'; placementBtn.textContent = L.placement;
    var scheduleBtn = el('button', 'viz-pa-toggle'); scheduleBtn.type = 'button'; scheduleBtn.textContent = L.schedule;
    var read = el('span', 'viz-pa-read'); read.setAttribute('aria-live', 'polite');
    bar.appendChild(placementBtn); bar.appendChild(scheduleBtn); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 250);
    cv.c.setAttribute('role', 'img');
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      ctx.clearRect(0, 0, W, H);
      var d = cv.dpr, pad = 12 * d, gap = 10 * d, top = 38 * d, panelH = H - top - 12 * d;
      var panelW = (W - 2 * pad - gap) / 2;
      ctx.font = (11 * d) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = t.ink;
      ctx.fillText(axis === 'placement' ? L.placement : L.schedule, W / 2, 20 * d);
      function panel(x, title) {
        ctx.strokeStyle = t.grid; ctx.lineWidth = d; ctx.strokeRect(x, top, panelW, panelH);
        ctx.fillStyle = t.ink; ctx.font = (10 * d) + 'px sans-serif'; ctx.fillText(title, x + panelW / 2, top + 18 * d);
      }
      function box(x, y, w, h, label, accent) {
        ctx.fillStyle = accent === 2 ? 'rgba(224,147,107,0.18)' : 'rgba(59,130,246,0.16)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = accent === 2 ? t.accent2 : t.accent; ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = t.ink; ctx.font = (9 * d) + 'px sans-serif'; ctx.fillText(label, x + w / 2, y + h / 2 + 3 * d);
      }
      function link(x1, y1, x2, y2, dashed) {
        ctx.save(); ctx.strokeStyle = t.ink; ctx.lineWidth = d; if (dashed) ctx.setLineDash([4 * d, 3 * d]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      }
      var left = pad, right = pad + panelW + gap, inner = 10 * d, bw = panelW - 2 * inner, bh = 30 * d;
      if (axis === 'placement') {
        panel(left, L.colocated); panel(right, L.separate);
        box(left + inner, top + 40 * d, bw, panelH - 54 * d, L.shared, 1);
        box(left + 2 * inner, top + 70 * d, bw - 2 * inner, bh, L.rollout, 1);
        box(left + 2 * inner, top + 118 * d, bw - 2 * inner, bh, L.learn, 2);
        box(right + inner, top + 55 * d, bw, bh, L.rolloutPool, 1);
        box(right + inner, top + 125 * d, bw, bh, L.learnPool, 2);
        link(right + panelW / 2, top + 85 * d, right + panelW / 2, top + 125 * d, true);
        read.textContent = L.placementRead; cv.c.setAttribute('aria-label', L.placementDesc + ' ' + L.placementRead);
      } else {
        panel(left, L.sync); panel(right, L.async);
        box(left + inner, top + 48 * d, bw, bh, L.rollout, 1);
        box(left + inner, top + 96 * d, bw, bh, L.update, 2);
        box(left + inner, top + 144 * d, bw, bh, L.weights, 1);
        link(left + panelW / 2, top + 78 * d, left + panelW / 2, top + 96 * d, false);
        link(left + panelW / 2, top + 126 * d, left + panelW / 2, top + 144 * d, false);
        box(right + inner, top + 58 * d, bw, bh, L.rollout, 1);
        box(right + inner, top + 132 * d, bw, bh, L.learn, 2);
        link(right + panelW / 2, top + 88 * d, right + panelW / 2, top + 132 * d, true);
        ctx.fillStyle = t.ink; ctx.font = (8 * d) + 'px sans-serif'; ctx.fillText(L.versioned, right + panelW / 2, top + 112 * d);
        read.textContent = L.scheduleRead; cv.c.setAttribute('aria-label', L.scheduleDesc + ' ' + L.scheduleRead);
      }
      placementBtn.setAttribute('aria-pressed', axis === 'placement' ? 'true' : 'false');
      scheduleBtn.setAttribute('aria-pressed', axis === 'schedule' ? 'true' : 'false');
    }
    placementBtn.addEventListener('click', function () { axis = 'placement'; draw(); });
    scheduleBtn.addEventListener('click', function () { axis = 'schedule'; draw(); });
    draw(); watchTheme(host, draw);
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

  // Reasoning search budget: exact node counts for a full tree and a
  // layer-wise beam under fixed branching, no duplicates, and no early exits.
  R['reasoning-search-budget'] = function (host) {
    var lang = host.getAttribute('data-lang') === 'zh' ? 'zh' : 'en';
    var L = lang === 'zh' ? {
      branching: '分支数', depth: '深度', width: '束宽',
      full: '完整树', beam: '束搜索', peak: '峰值前沿',
      nodes: '生成节点', log: '对数刻度'
    } : {
      branching: 'branching', depth: 'depth', width: 'beam width',
      full: 'full tree', beam: 'beam search', peak: 'peak frontier',
      nodes: 'generated nodes', log: 'log scale'
    };
    var branching = 3, depth = 4, width = 4;
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 285);
    cv.c.setAttribute('role', 'img');
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 42 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      var fullNodes = 1, fullLevel = 1;
      for (var d = 0; d < depth; d++) { fullLevel *= branching; fullNodes += fullLevel; }
      var beamNodes = 1, beamFrontier = 1, peakFrontier = 1;
      for (var level = 0; level < depth; level++) {
        var generated = beamFrontier * branching;
        beamNodes += generated;
        beamFrontier = Math.min(width, generated);
        peakFrontier = Math.max(peakFrontier, beamFrontier);
      }
      var bars = [
        { n: L.full, v: fullNodes, c: 'rgba(128,128,128,0.55)' },
        { n: L.beam, v: beamNodes, c: t.accent },
        { n: L.peak, v: peakFrontier, c: t.accent2 }
      ];
      var maxLog = Math.max.apply(null, bars.map(function (b) { return Math.log10(1 + b.v); }));
      function X(i) { return pd + (i + 0.5) * (W - 2 * pd) / 3; }
      function Y(v) { return H - pd - Math.log10(1 + v) / maxLog * (H - 2 * pd); }
      ctx.strokeStyle = t.grid; ctx.beginPath(); ctx.moveTo(pd, H - pd); ctx.lineTo(W - pd, H - pd); ctx.moveTo(pd, pd); ctx.lineTo(pd, H - pd); ctx.stroke();
      bars.forEach(function (b, i) {
        var x = X(i), bw = 58 * cv.dpr, y = Y(b.v);
        ctx.fillStyle = b.c; ctx.fillRect(x - bw / 2, y, bw, H - pd - y);
        ctx.fillStyle = t.ink; ctx.font = (11 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(b.n, x, H - pd + 20 * cv.dpr);
        ctx.fillText(b.v.toLocaleString('en-US'), x, y - 8 * cv.dpr);
      });
      ctx.fillStyle = t.ink; ctx.font = (10 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(L.log, W - pd, pd - 10 * cv.dpr);
      read.textContent = L.full + '=' + fullNodes.toLocaleString('en-US') + ' · ' + L.beam + '=' + beamNodes.toLocaleString('en-US');
      cv.c.setAttribute('aria-label', L.nodes + ': ' + read.textContent + ' · ' + L.peak + '=' + peakFrontier.toLocaleString('en-US'));
    }
    host.appendChild(slider(L.branching, 1, 6, 1, branching, function (v) { branching = Math.round(v); draw(); }).wrap);
    host.appendChild(slider(L.depth, 1, 7, 1, depth, function (v) { depth = Math.round(v); draw(); }).wrap);
    host.appendChild(slider(L.width, 1, 16, 1, width, function (v) { width = Math.round(v); draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Mid-training mixture: an exact linear ramp from broad-only data to a
  // configured specialist share. The integrated area is total specialist-token
  // exposure when the token rate is constant; no capability score is invented.
  R['midtraining-bridge'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh';
    var L = zh
      ? { start: '引入时点', share: '专门数据占比', x: '训练进度', y: '数据占比',
          broad: '宽泛数据', specialist: '专门数据', final: '最终专门占比', run: '全程专门词元占比',
          summary: '线性混合' }
      : { start: 'introduction point', share: 'specialist share', x: 'training progress', y: 'data share',
          broad: 'broad data', specialist: 'specialist data', final: 'final specialist share', run: 'whole-run specialist tokens',
          summary: 'linear mixture' };
    var start = 0.58, share = 0.26;
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); read.setAttribute('aria-live', 'polite'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 280);
    cv.c.setAttribute('role', 'img');
    function ramp(t) {
      if (t < start) return 0;
      var u = (t - start) / Math.max(0.05, 1 - start);
      return share * Math.min(1, u);
    }
    function draw() {
      var th = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      var left = 52 * cv.dpr, right = 28 * cv.dpr, top = 26 * cv.dpr, bottom = 52 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(t) { return left + t * (W - left - right); }
      function Y(v) { return H - bottom - v * (H - top - bottom); }

      ctx.fillStyle = 'rgba(75,159,107,0.18)';
      ctx.fillRect(left, top, W - left - right, H - top - bottom);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      for (var i = 0; i <= 100; i++) {
        var tt = i / 100;
        ctx.lineTo(X(tt), Y(ramp(tt)));
      }
      ctx.lineTo(X(1), Y(0)); ctx.closePath();
      ctx.fillStyle = 'rgba(224,147,107,0.72)'; ctx.fill();

      ctx.strokeStyle = th.grid; ctx.lineWidth = cv.dpr; ctx.beginPath();
      for (var j = 0; j <= 4; j++) {
        var gx = X(j / 4), gy = Y(j / 4);
        ctx.moveTo(gx, top); ctx.lineTo(gx, H - bottom);
        ctx.moveTo(left, gy); ctx.lineTo(W - right, gy);
      }
      ctx.stroke();

      ctx.strokeStyle = th.accent2; ctx.lineWidth = 2 * cv.dpr; ctx.beginPath();
      for (var k = 0; k <= 100; k++) {
        var t = k / 100, x = X(t), y = Y(ramp(t));
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = th.grid; ctx.setLineDash([4 * cv.dpr, 5 * cv.dpr]); ctx.beginPath(); ctx.moveTo(X(start), top); ctx.lineTo(X(start), H - bottom + 26 * cv.dpr); ctx.stroke(); ctx.setLineDash([]);

      ctx.fillStyle = th.ink; ctx.font = (11 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(L.broad, X(0.08), Y(0.78));
      ctx.fillStyle = th.ink; ctx.fillText(L.specialist, X(0.74), Y(ramp(0.86) / 2));
      ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.font = (12 * cv.dpr) + 'px sans-serif';
      ctx.fillText(L.x, (left + W - right) / 2, H - 12 * cv.dpr);
      ctx.save(); ctx.translate(14 * cv.dpr, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(L.y, 0, 0); ctx.restore();
      var runShare = 0.5 * share * (1 - start);
      var sep = zh ? '：' : ': ';
      read.textContent = L.summary + sep + L.final + ' ' + Math.round(share * 100) + '% · ' + L.run + ' ' + (runShare * 100).toFixed(1) + '%';
      cv.c.setAttribute('aria-label', read.textContent);
    }
    host.appendChild(slider(L.start, 0.25, 0.85, 0.01, start, function (v) { start = v; draw(); }).wrap);
    host.appendChild(slider(L.share, 0.05, 0.55, 0.01, share, function (v) { share = v; draw(); }).wrap);
    draw();
    watchTheme(host, draw);
  };

  // Preference-signal mixer: a pairwise preference label is a weighted
  // multi-attribute judgment. Change the implicit rubric weights and the chosen
  // answer can flip even though the candidate responses do not move.
  R['preference-signal-mixer'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh';
    var labels = zh
      ? { read: '当前偏好', a: 'A：简洁、准确', b: 'B：谨慎、详细', score: '加权分数',
          attrs: ['正确性', '有用性', '安全性', '简洁性'] }
      : { read: 'current preference', a: 'A: concise, correct', b: 'B: cautious, detailed', score: 'weighted score',
          attrs: ['correctness', 'helpfulness', 'safety', 'brevity'] };
    var scores = [
      [0.92, 0.64, 0.72, 0.90],
      [0.78, 0.88, 0.95, 0.48]
    ];
    var weights = [0.38, 0.25, 0.25, 0.12];
    var colors = ['#3b82f6', '#e0936b', '#4b9f6b', '#8b6bb8'];
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 270);
    function normWeights() {
      var s = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
      return weights.map(function (w) { return w / s; });
    }
    function total(row, w) {
      return row.reduce(function (a, v, i) { return a + v * w[i]; }, 0);
    }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 42 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      var w = normWeights(), ta = total(scores[0], w), tb = total(scores[1], w);
      var rows = [[labels.a, scores[0], ta], [labels.b, scores[1], tb]];
      var labelWidth = 150 * cv.dpr;
      var maxWidth = W - 2 * pd - labelWidth, rowH = 52 * cv.dpr, startY = pd + 18 * cv.dpr;
      ctx.fillStyle = t.ink; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'left';
      rows.forEach(function (r, ri) {
        var x = pd + 88 * cv.dpr, y = startY + ri * rowH, acc = 0;
        ctx.fillStyle = t.ink; ctx.textAlign = 'right'; ctx.fillText(r[0], x - 10 * cv.dpr, y + 16 * cv.dpr);
        r[1].forEach(function (v, i) {
          var seg = maxWidth * v * w[i];
          ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.82;
          ctx.fillRect(x + acc, y, seg, 24 * cv.dpr);
          acc += seg;
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = r[2] === Math.max(ta, tb) ? t.ink : t.grid; ctx.lineWidth = r[2] === Math.max(ta, tb) ? 2 * cv.dpr : cv.dpr;
        ctx.strokeRect(x, y, maxWidth * r[2], 24 * cv.dpr);
        ctx.fillStyle = t.ink; ctx.textAlign = 'left';
        ctx.fillText(labels.score + ' ' + r[2].toFixed(2), x + maxWidth * r[2] + 8 * cv.dpr, y + 17 * cv.dpr);
      });
      var lx = pd, ly = H - 54 * cv.dpr;
      labels.attrs.forEach(function (name, i) {
        var x = lx + i * Math.max(92 * cv.dpr, (W - 2 * pd) / 4);
        ctx.fillStyle = colors[i]; ctx.fillRect(x, ly, 12 * cv.dpr, 12 * cv.dpr);
        ctx.fillStyle = t.ink; ctx.textAlign = 'left'; ctx.font = (11 * cv.dpr) + 'px sans-serif';
        ctx.fillText(name + ' ' + Math.round(w[i] * 100) + '%', x + 17 * cv.dpr, ly + 11 * cv.dpr);
      });
      read.textContent = labels.read + ': ' + (ta >= tb ? labels.a : labels.b);
    }
    labels.attrs.forEach(function (name, i) {
      host.appendChild(slider(name, 0, 1, 0.01, weights[i], function (v) { weights[i] = v; draw(); }).wrap);
    });
    draw();
    watchTheme(host, draw);
  };

  // Verifier-threshold: best-of-N remains useful when the selector is reliable;
  // with a weak proxy, more candidates increase the chance of finding an
  // over-optimized false positive. The curves are qualitative.
  R['verifier-threshold'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh';
    var rel = 0.82;
    var labels = zh
      ? { rel: '选择器可靠性', x: '候选数 N', y: '期望真实质量', ideal: '理想核查器', proxy: '当前选择器', peak: '峰值' }
      : { rel: 'selector reliability', x: 'candidates N', y: 'expected true quality', ideal: 'ideal oracle', proxy: 'current selector', peak: 'peak' };
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 270);
    function ideal(n) { return 0.42 + 0.50 * (1 - Math.exp(-n / 16)); }
    function proxy(n) {
      var gain = 0.44 * (1 - Math.exp(-n * rel / 15));
      var exploit = (1 - rel) * 0.095 * Math.pow(Math.log(n + 1), 1.7);
      return 0.42 + gain - exploit;
    }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height, pd = 44 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(n) { return pd + (n - 1) / 63 * (W - 2 * pd); }
      function Y(q) { return H - pd - (q - 0.25) / 0.75 * (H - 2 * pd); }
      ctx.strokeStyle = t.grid; ctx.beginPath(); ctx.moveTo(pd, H - pd); ctx.lineTo(W - pd, H - pd); ctx.moveTo(pd, pd); ctx.lineTo(pd, H - pd); ctx.stroke();
      function line(fn, col, dash) {
        ctx.strokeStyle = col; ctx.lineWidth = 2 * cv.dpr; ctx.setLineDash(dash ? [5 * cv.dpr, 4 * cv.dpr] : []); ctx.beginPath();
        for (var n = 1; n <= 64; n++) { var x = X(n), y = Y(fn(n)); if (n === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      line(ideal, '#4b9f6b', true); line(proxy, t.accent, false);
      var bestN = 1, bestQ = -Infinity;
      for (var n = 1; n <= 64; n++) { var q = proxy(n); if (q > bestQ) { bestQ = q; bestN = n; } }
      ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(X(bestN), Y(bestQ), 5 * cv.dpr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.ink; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(labels.x, W / 2, H - 12 * cv.dpr);
      ctx.save(); ctx.translate(14 * cv.dpr, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(labels.y, 0, 0); ctx.restore();
      ctx.textAlign = 'left'; ctx.fillText(labels.ideal, pd + 8 * cv.dpr, pd + 4 * cv.dpr);
      ctx.fillStyle = t.accent; ctx.fillText(labels.proxy, pd + 8 * cv.dpr, pd + 22 * cv.dpr);
      read.textContent = labels.rel + '=' + rel.toFixed(2) + ' · ' + labels.peak + ' N=' + bestN;
    }
    host.appendChild(slider(labels.rel, 0.55, 0.98, 0.01, rel, function (v) { rel = v; draw(); }).wrap);
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

  // Verification frontier: generation can expand the stream of plausible
  // claims faster than proof, replication, and oversight can accept them. The
  // shaded gap is the part that must be deferred or treated as unsafe.
  R['verification-frontier'] = function (host) {
    var zh = host.getAttribute('data-lang') === 'zh';
    var L = zh
      ? { gen: '生成强度', formal: '形式化覆盖', oversight: '辅助监督',
          x: '主张复杂度', y: '主张流比例', claims: '候选主张', accepted: '可接受',
          human: '纯人工容量', deferred: '延后', unsafe: '风险', summary: '缺口' }
      : { gen: 'generator strength', formal: 'formalized coverage', oversight: 'assisted oversight',
          x: 'claim complexity', y: 'share of claim stream', claims: 'candidate claims', accepted: 'accepted',
          human: 'human-only capacity', deferred: 'deferred', unsafe: 'unsafe', summary: 'gap' };
    var gen = 0.72, formal = 0.34, oversight = 0.46;
    var bar = el('div', 'viz-pa-bar'); var read = el('span', 'viz-pa-read'); bar.appendChild(read); host.appendChild(bar);
    var cv = canvas(host, 305);
    function claim(x) {
      return Math.min(1, (0.12 + 0.78 * Math.pow(x, 1.12)) * (0.55 + 0.78 * gen));
    }
    function capacity(x) {
      var executable = 0.08 + 0.78 * formal * Math.exp(-1.55 * x);
      var assisted = 0.52 * oversight * (1 - Math.exp(-3.0 * x)) * Math.exp(-0.58 * x);
      var empirical = 0.16 * (1 - 0.45 * x);
      return Math.min(0.95, executable + assisted + empirical);
    }
    function humanOnly(x) {
      return 0.24 - 0.11 * x;
    }
    // Fraction of the candidate-vs-accepted gap that is unsafe rather than just
    // deferred: weaker oversight and thinner formalization push more of the gap
    // into the risk band. Independent of x, so the chart's red band and the side
    // bar's risk proportion stay in lockstep.
    function unsafeFrac() {
      return 0.18 + 0.48 * (1 - oversight) * (1 - formal * 0.45);
    }
    function draw() {
      var t = theme(), ctx = cv.ctx, W = cv.c.width, H = cv.c.height;
      var cssWidth = W / cv.dpr, compactLegend = cssWidth < 430;
      var left = 50 * cv.dpr, right = 112 * cv.dpr, top = 24 * cv.dpr, bottom = 52 * cv.dpr;
      ctx.clearRect(0, 0, W, H);
      function X(x) { return left + x * (W - left - right); }
      function Y(v) { return H - bottom - v * (H - top - bottom); }
      ctx.strokeStyle = t.grid; ctx.lineWidth = cv.dpr; ctx.beginPath();
      for (var i = 0; i <= 4; i++) {
        var gx = X(i / 4), gy = Y(i / 4);
        ctx.moveTo(gx, top); ctx.lineTo(gx, H - bottom);
        ctx.moveTo(left, gy); ctx.lineTo(W - right, gy);
      }
      ctx.stroke();
      ctx.strokeStyle = t.grid; ctx.beginPath(); ctx.moveTo(left, H - bottom); ctx.lineTo(W - right, H - bottom); ctx.moveTo(left, top); ctx.lineTo(left, H - bottom); ctx.stroke();

      // The gap between candidate claims (top) and accepted capacity (bottom)
      // splits into a deferred band (lower, orange) and a risk band (upper, red,
      // against the claim curve), matching the side-bar legend. The split height
      // at each x is split(x) = claim - unsafeFrac * (claim - accepted).
      var uf = unsafeFrac();
      function accAt(x) { return Math.min(claim(x), capacity(x)); }
      function splitAt(x) { var c = claim(x); return c - uf * (c - accAt(x)); }
      // Risk band: between the split line and the claim curve.
      ctx.beginPath();
      for (var j = 0; j <= 140; j++) {
        var x = j / 140;
        if (j === 0) ctx.moveTo(X(x), Y(claim(x))); else ctx.lineTo(X(x), Y(claim(x)));
      }
      for (var k = 140; k >= 0; k--) { var xr = k / 140; ctx.lineTo(X(xr), Y(splitAt(xr))); }
      ctx.closePath(); ctx.fillStyle = 'rgba(165,70,70,0.32)'; ctx.fill();
      // Deferred band: between the accepted curve and the split line.
      ctx.beginPath();
      for (var jd = 0; jd <= 140; jd++) {
        var xd = jd / 140;
        if (jd === 0) ctx.moveTo(X(xd), Y(splitAt(xd))); else ctx.lineTo(X(xd), Y(splitAt(xd)));
      }
      for (var kd = 140; kd >= 0; kd--) { var xrd = kd / 140; ctx.lineTo(X(xrd), Y(accAt(xrd))); }
      ctx.closePath(); ctx.fillStyle = 'rgba(224,147,107,0.28)'; ctx.fill();

      function line(fn, col, dash) {
        ctx.strokeStyle = col; ctx.lineWidth = 2 * cv.dpr; ctx.setLineDash(dash ? [6 * cv.dpr, 5 * cv.dpr] : []);
        ctx.beginPath();
        for (var n = 0; n <= 140; n++) {
          var x = n / 140, y = fn(x);
          if (n === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      line(claim, t.accent, false);
      line(function (x) { return Math.min(claim(x), capacity(x)); }, '#4b9f6b', false);
      line(humanOnly, t.accent2, true);

      var at = 0.78, c0 = claim(at), a0 = Math.min(c0, capacity(at)), gap = Math.max(0, c0 - a0);
      var unsafe = gap * uf;
      var deferred = Math.max(0, gap - unsafe);
      var bx = W - right + (compactLegend ? 50 : 34) * cv.dpr;
      var by = top + 20 * cv.dpr, bw = 28 * cv.dpr, bh = 170 * cv.dpr;
      ctx.strokeStyle = t.grid; ctx.strokeRect(bx, by, bw, bh);
      function seg(offset, height, color) { ctx.fillStyle = color; ctx.fillRect(bx, by + bh - offset - height, bw, height); }
      function segmentCenter(offset, height) { return by + bh - offset - height / 2; }
      seg(0, bh * a0, '#4b9f6b');
      seg(bh * a0, bh * deferred, 'rgba(224,147,107,0.72)');
      seg(bh * (a0 + deferred), bh * unsafe, 'rgba(165,70,70,0.72)');
      if (compactLegend) {
        ctx.font = (9 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'right';
        [[L.accepted, '#4b9f6b', 0, bh * a0],
         [L.deferred, t.accent2, bh * a0, bh * deferred],
         [L.unsafe, '#a54646', bh * (a0 + deferred), bh * unsafe]].forEach(function (r) {
          ctx.fillStyle = r[1];
          ctx.fillText(r[0], bx - 6 * cv.dpr, segmentCenter(r[2], r[3]) + 3 * cv.dpr);
        });
      } else {
        ctx.fillStyle = t.ink; ctx.font = (11 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'left';
        [[L.accepted, '#4b9f6b', 0], [L.deferred, t.accent2, 1], [L.unsafe, '#a54646', 2]].forEach(function (r) {
          var yy = by + 16 * cv.dpr + r[2] * 19 * cv.dpr;
          ctx.fillStyle = r[1]; ctx.fillRect(bx + 42 * cv.dpr, yy - 9 * cv.dpr, 10 * cv.dpr, 10 * cv.dpr);
          ctx.fillStyle = t.ink; ctx.fillText(r[0], bx + 58 * cv.dpr, yy);
        });
      }

      ctx.fillStyle = t.ink; ctx.font = (12 * cv.dpr) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(L.x, (left + W - right) / 2, H - 14 * cv.dpr);
      ctx.save(); ctx.translate(14 * cv.dpr, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(L.y, 0, 0); ctx.restore();
      ctx.textAlign = 'left'; ctx.font = (11 * cv.dpr) + 'px sans-serif';
      ctx.fillStyle = t.accent; ctx.fillText(L.claims, left + 12 * cv.dpr, top + 16 * cv.dpr);
      ctx.fillStyle = '#4b9f6b'; ctx.fillText(L.accepted, left + 12 * cv.dpr, top + 35 * cv.dpr);
      ctx.fillStyle = t.accent2; ctx.fillText(L.human, left + 12 * cv.dpr, top + 54 * cv.dpr);
      read.textContent = L.summary + ': ' + L.accepted + ' ' + Math.round(a0 * 100) + '% · ' + L.deferred + ' ' + Math.round(deferred * 100) + '% · ' + L.unsafe + ' ' + Math.round(unsafe * 100) + '%';
    }
    host.appendChild(slider(L.gen, 0.2, 1, 0.01, gen, function (v) { gen = v; draw(); }).wrap);
    host.appendChild(slider(L.formal, 0.05, 0.8, 0.01, formal, function (v) { formal = v; draw(); }).wrap);
    host.appendChild(slider(L.oversight, 0.05, 0.85, 0.01, oversight, function (v) { oversight = v; draw(); }).wrap);
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
