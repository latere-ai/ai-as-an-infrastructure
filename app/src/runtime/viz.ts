// @ts-nocheck
// Interactive viz components, client-side. Relocated verbatim from the old
// viz-runtime.html into the client bundle (registered on window by hydrate.tsx,
// run by the reader after hydration). @ts-nocheck preserves the original
// framework-free JS; it can be incrementally typed later.
// Interactive visualizations, client-side. A chapter embeds one with:
//   ```{=html}
//   <div class="viz" data-viz="outlier-quant"></div>
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
