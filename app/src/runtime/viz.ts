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
