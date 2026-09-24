// @ts-nocheck
// Runnable Python cells, client-side via Pyodide. Relocated verbatim from the
// old live-runtime.html into the client bundle (registered on window by
// hydrate.tsx, run by the reader after hydration). @ts-nocheck preserves the
// original framework-free JS; it can be incrementally typed later.
// Runnable Python, client-side via Pyodide. Mark a code block in Markdown with
//   ::: {.runnable}
//   ```python
//   ...
//   ```
//   :::
// and it becomes an editable, runnable cell (no server). Pyodide loads lazily
// on the first Run, once per page.
import { Transport } from '../figures/runtime/transport.ts';

  var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
  var pyPromise = null;
  // Matplotlib's bundled fonts (DejaVu Sans) have no CJK glyphs, so Chinese
  // labels in zh runnable cells render as tofu boxes. Fetch a CJK font on
  // demand (only when the code contains CJK) and register it with matplotlib.
  var CJK_FONT_URL = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf';
  var CJK_FONT_PATH = '/fonts/NotoSansSC-Regular.otf';
  var CJK_FONT_NAME = 'Noto Sans SC';
  var CJK_RE = /[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;
  var cjkFontPromise = null;

  // Minimal, dependency-free Python highlighter for the editor overlay. Strings
  // and comments are matched before identifiers so keywords inside them stay
  // plain. Identifiers are \w-only, so they need no HTML escaping.
  var PY_KW = /^(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|match|case)$/;
  var PY_BI = /^(print|len|range|int|float|str|list|dict|set|tuple|bool|bytes|abs|min|max|sum|sorted|reversed|enumerate|zip|map|filter|open|type|isinstance|issubclass|super|object|format|repr|round|input|any|all|getattr|setattr|hasattr|next|iter|id|hash|ord|chr|bin|hex|oct|pow|divmod|vars|dir)$/;
  var PY_RE = /(#[^\n]*)|([rbuf]{0,3}"""[\s\S]*?"""|[rbuf]{0,3}'''[\s\S]*?'''|[rbuf]{0,3}"(?:\\.|[^"\\\n])*"|[rbuf]{0,3}'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?\b)|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)/g;
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function highlightPy(src) {
    var out = '', last = 0, m;
    PY_RE.lastIndex = 0;
    while ((m = PY_RE.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += '<span class="lt-com">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="lt-str">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="lt-num">' + esc(m[3]) + '</span>';
      else if (m[4]) out += '<span class="lt-dec">' + esc(m[4]) + '</span>';
      else if (PY_KW.test(m[5])) out += '<span class="lt-kw">' + m[5] + '</span>';
      else if (PY_BI.test(m[5])) out += '<span class="lt-bi">' + m[5] + '</span>';
      else out += m[5];
      last = PY_RE.lastIndex;
    }
    out += esc(src.slice(last));
    return out;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function getPyodide(status) {
    if (!pyPromise) {
      pyPromise = (async function () {
        status('Loading Python (Pyodide), first run only...');
        await loadScript(PYODIDE + 'pyodide.js');
        var py = await loadPyodide({ indexURL: PYODIDE });
        await py.loadPackage('micropip');
        return py;
      })();
    }
    return pyPromise;
  }

  // Fetch the CJK font once and register it with matplotlib's font manager so
  // Chinese labels in zh cells render instead of tofu boxes. Cached per page;
  // failures degrade to tofu rather than breaking execution.
  function ensureCjkFont(py, status) {
    if (!cjkFontPromise) {
      cjkFontPromise = (async function () {
        status('Loading CJK font, first run only...');
        var buf = await fetch(CJK_FONT_URL).then(function (r) {
          if (!r.ok) throw new Error('font ' + r.status);
          return r.arrayBuffer();
        });
        py.FS.mkdirTree('/fonts');
        py.FS.writeFile(CJK_FONT_PATH, new Uint8Array(buf));
        py.runPython([
          'import matplotlib.font_manager as __fm',
          '__fm.fontManager.addfont(' + JSON.stringify(CJK_FONT_PATH) + ')'
        ].join('\n'));
      })().catch(function (e) { cjkFontPromise = null; throw e; });
    }
    return cjkFontPromise;
  }

  // Style matplotlib to match the reader: paper-colored canvas (so it blends
  // into the cell instead of a white rectangle), themed text/grid, despined
  // axes, thicker lines, a calmer color cycle. Colors come from the live CSS
  // variables, so it tracks the active light/dark palette. Agg backend means
  // plt.show() is a no-op (no canvas leaks into the page body); we capture the
  // figures via savefig.
  //
  // Every open pyplot figure is captured, in creation order. A static figure
  // becomes one inline SVG. A figure that a matplotlib Animation held in the
  // cell's globals draws into becomes a frame sequence instead: the harness
  // steps the animation through its own draw function, at most FRAME_CAP
  // frames, and saves each frame with one bounding box so the image does not
  // shift between frames. Frames are SVG when the whole sequence fits the
  // cell's share of PAYLOAD_BUDGET bytes; otherwise PNG, at a lower resolution
  // when full resolution would not fit, and evenly thinned when the frames
  // still exceed it.
  var FRAME_CAP = 60;
  var PAYLOAD_BUDGET = 3000000;
  var HARNESS = [
    'import sys, io, json, base64, itertools',
    '__FRAME_CAP = ' + FRAME_CAP,
    '__BUDGET = ' + PAYLOAD_BUDGET,
    'def __style_mpl(__t):',
    '    import matplotlib',
    '    matplotlib.use("Agg")',
    '    import matplotlib as mpl',
    '    fg = __t.get("fg", "#222222"); grid = __t.get("grid", "#cccccc")',
    '    cyc = ["#5b8def", "#ff7a66", "#3dbd8a", "#b07ae0", "#e8b13c", "#3fc1d4"]',
    '    mpl.rcParams.update({',
    '        "figure.figsize": (6.2, 4.2), "figure.dpi": 130,',
    // Transparent canvas (themed panel shows through -> fits light/dark) and
    // live SVG text nodes so labels can be selected in the page.
    '        "figure.facecolor": "none", "axes.facecolor": "none",',
    '        "svg.fonttype": "none",',
    '        "text.color": fg, "axes.labelcolor": fg, "axes.titlecolor": fg, "axes.edgecolor": grid,',
    '        "xtick.color": fg, "ytick.color": fg, "xtick.labelcolor": fg, "ytick.labelcolor": fg,',
    '        "axes.grid": True, "grid.color": grid, "grid.alpha": 0.32, "grid.linewidth": 0.7,',
    '        "axes.spines.top": False, "axes.spines.right": False, "axes.linewidth": 0.9,',
    '        "axes.prop_cycle": mpl.cycler(color=cyc),',
    '        "lines.linewidth": 2.1, "font.size": 11, "legend.frameon": False,',
    '    })',
    // When the cell contains CJK, prefer the registered CJK font (it also
    // carries Latin glyphs) and disable the Unicode-minus glyph, which the
    // CJK font lacks, so axis numbers keep their hyphen-minus.
    '    if __t.get("cjk"):',
    '        mpl.rcParams["font.family"] = "sans-serif"',
    '        mpl.rcParams["font.sans-serif"] = ["' + CJK_FONT_NAME + '", "DejaVu Sans"]',
    '        mpl.rcParams["axes.unicode_minus"] = False',
    // One frame of an animation, as SVG text or base64 PNG.
    'def __frame(fig, fmt, box, dpi):',
    '    b = io.BytesIO()',
    '    fig.savefig(b, format=fmt, bbox_inches=box, transparent=True, dpi=dpi)',
    '    v = b.getvalue()',
    '    return v.decode("utf-8", "replace") if fmt == "svg" else base64.b64encode(v).decode("ascii")',
    // Step an animation through at most __FRAME_CAP frames within budget
    // bytes. The first frame decides the format and the resolution.
    'def __animate(anim, fig, budget):',
    '    seq = list(itertools.islice(anim.new_frame_seq(), __FRAME_CAP))',
    '    if not seq:',
    '        return None',
    '    anim._init_draw()',
    '    anim._draw_next_frame(seq[0], False)',
    '    box = fig.get_tightbbox().padded(0.1)',
    // Later frames can be larger than the first (points spread out, labels
    // lengthen), so the estimate keeps a quarter of the budget in reserve.
    '    fmt, dpi, room = "svg", fig.dpi, 0.75 * budget',
    '    first = __frame(fig, fmt, box, dpi)',
    '    if len(first) * len(seq) > room:',
    '        fmt = "png"',
    '        first = __frame(fig, fmt, box, dpi)',
    '        if len(first) * len(seq) > room:',
    '            dpi = max(48.0, dpi * (room / (len(first) * len(seq))) ** 0.5)',
    '            first = __frame(fig, fmt, box, dpi)',
    '    frames = [first]',
    '    for d in seq[1:]:',
    '        anim._draw_next_frame(d, False)',
    '        frames.append(__frame(fig, fmt, box, dpi))',
    // Over budget after all: keep every step-th frame and the last one, so
    // the sequence still runs from start to end, and stretch the interval so
    // it plays for the same time.
    '    step, keep = 1, frames',
    '    while sum(map(len, keep)) > budget and step < len(frames):',
    '        step += 1',
    '        keep = frames[::step] + ([frames[-1]] if (len(frames) - 1) % step else [])',
    '    interval = float(getattr(anim, "_interval", 200) or 200) * len(frames) / len(keep)',
    '    return {"kind": "anim", "fmt": fmt, "frames": keep, "bytes": sum(map(len, keep)), "interval": interval}',
    // Capture every open figure in creation order; animated figures become
    // frame sequences that share what the static figures leave of the budget.
    'def __capture(__g):',
    '    if "matplotlib.pyplot" not in sys.modules:',
    '        return []',
    '    import matplotlib.pyplot as plt',
    '    anims = {}',
    '    if "matplotlib.animation" in sys.modules:',
    '        from matplotlib.animation import Animation',
    '        for v in list(__g.values()):',
    '            if isinstance(v, Animation):',
    '                anims.setdefault(id(v._fig), v)',
    '    figs = [plt.figure(n) for n in plt.get_fignums()]',
    '    out = [None] * len(figs)',
    '    left = __BUDGET',
    '    for i, fig in enumerate(figs):',
    '        if id(fig) not in anims:',
    '            __b = io.BytesIO()',
    '            fig.savefig(__b, format="svg", bbox_inches="tight", transparent=True)',
    '            out[i] = {"kind": "svg", "data": __b.getvalue().decode("utf-8", "replace")}',
    '            left -= len(out[i]["data"])',
    '    moving = [i for i, fig in enumerate(figs) if id(fig) in anims]',
    '    for j, i in enumerate(moving):',
    '        out[i] = __animate(anims[id(figs[i])], figs[i], max(0, left) // (len(moving) - j))',
    '        left -= out[i]["bytes"] if out[i] else 0',
    '    plt.close("all")',
    '    return [o for o in out if o]',
    'def __run_user_code(__src, __theme_json):',
    '    __out = io.StringIO()',
    '    __old = sys.stdout',
    '    sys.stdout = __out',
    '    __figs = []',
    '    try:',
    '        try:',
    '            __style_mpl(json.loads(__theme_json))',
    '        except Exception:',
    '            pass',
    '        if "matplotlib.pyplot" in sys.modules:',
    '            sys.modules["matplotlib.pyplot"].close("all")',
    '        __g = {"__name__": "__main__"}',
    '        exec(__src, __g)',
    // A failure while drawing (an animation function that raises) is shown
    // under the cell's printed output instead of discarding the figures.
    '        try:',
    '            __figs = __capture(__g)',
    '        except Exception:',
    '            import traceback',
    '            __out.write(traceback.format_exc())',
    '            import matplotlib.pyplot as plt',
    '            plt.close("all")',
    '    finally:',
    '        sys.stdout = __old',
    '    return json.dumps({"out": __out.getvalue(), "figs": __figs})'
  ].join('\n');

  // Resolve a CSS color (hex or rgb/rgba) to "#rrggbb" for matplotlib.
  function cssHex(v) {
    v = (v || '').trim();
    if (v.charAt(0) === '#') return v;
    var m = v.match(/[\d.]+/g);
    if (!m || m.length < 3) return '';
    return '#' + m.slice(0, 3).map(function (n) {
      var h = Math.round(parseFloat(n)).toString(16);
      return h.length < 2 ? '0' + h : h;
    }).join('');
  }
  function readTheme() {
    var el = document.querySelector('.reader') || document.documentElement;
    var cs = getComputedStyle(el);
    return {
      face: cssHex(cs.getPropertyValue('--bg-surface')) || '#ffffff',
      fg: cssHex(cs.getPropertyValue('--fg-1')) || '#222222',
      grid: cssHex(cs.getPropertyValue('--fg-3')) || '#cccccc'
    };
  }

  function clearFigs(figsEl) {
    figsEl.replaceChildren();
    figsEl.style.display = 'none';
  }

  // Parse one SVG document from the harness and strip anything executable
  // before it is placed in the page.
  function safeSvg(markup) {
    var doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('invalid svg output');
    var svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('invalid svg output');
    var blocked = svg.querySelectorAll('script, foreignObject');
    for (var i = 0; i < blocked.length; i++) blocked[i].remove();
    var nodes = [svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*')));
    for (var n = 0; n < nodes.length; n++) {
      var attrs = Array.prototype.slice.call(nodes[n].attributes || []);
      for (var a = 0; a < attrs.length; a++) {
        var name = attrs[a].name;
        var value = String(attrs[a].value || '').trim();
        if (/^on/i.test(name) || (/^(?:href|xlink:href)$/i.test(name) && /^javascript:/i.test(value))) {
          nodes[n].removeAttribute(name);
        }
      }
    }
    return document.importNode(svg, true);
  }

  var reducedMotion = function () {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  // An animation's frames behind the figures' transport: play, pause, step
  // and scrub, with a frame counter. Playing starts on its own after Run;
  // under prefers-reduced-motion nothing plays, the cell opens on the last
  // frame, and the step buttons move one frame at a time.
  function mountAnim(fig, labels) {
    var box = document.createElement('div'); box.className = 'live-anim';
    var stage = document.createElement('div'); stage.className = 'live-svg live-frame';
    stage.setAttribute('role', 'img'); stage.setAttribute('aria-label', labels.animation);
    var frames = fig.frames.map(function (f) {
      if (fig.fmt === 'svg') return safeSvg(f);
      var img = new Image(); img.alt = ''; img.src = 'data:image/png;base64,' + f;
      return img;
    });
    var n = frames.length;
    var reduced = reducedMotion();
    var transport = new Transport({
      lang: labels.lang,
      duration: Math.max(0, n - 1),
      rate: 1000 / Math.max(16, fig.interval || 200),
      discrete: true,
      keyframes: [],
      reduced: reduced,
      t: reduced ? n - 1 : 0,
      readout: function (t) { return labels.frame(Math.round(t) + 1, n); },
      onSeek: function (t) { stage.replaceChildren(frames[Math.round(t)]); }
    });
    stage.replaceChildren(frames[transport.shown()]);
    box.appendChild(stage); box.appendChild(transport.root);
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting && transport.isPlaying) transport.pause();
        }
      }).observe(box);
    }
    return { node: box, start: function () { if (!reduced && n > 1) transport.play(); } };
  }

  // Place the captured figures in creation order: static figures as inline
  // SVG, animations as frame players.
  function mountFigs(figsEl, figs, labels) {
    clearFigs(figsEl);
    var starts = [];
    for (var i = 0; i < figs.length; i++) {
      if (figs[i].kind === 'anim') {
        var anim = mountAnim(figs[i], labels);
        figsEl.appendChild(anim.node);
        starts.push(anim.start);
      } else {
        var fig = document.createElement('div'); fig.className = 'live-svg';
        fig.setAttribute('role', 'img'); fig.setAttribute('aria-label', labels.figure);
        fig.appendChild(safeSvg(figs[i].data));
        figsEl.appendChild(fig);
      }
    }
    figsEl.style.display = figs.length ? 'block' : 'none';
    for (var s = 0; s < starts.length; s++) starts[s]();
  }

  async function run(cell, code, status, outEl, figsEl, labels) {
    cell.classList.add('ran');
    outEl.textContent = ''; clearFigs(figsEl);
    var py;
    try { py = await getPyodide(status); }
    catch (e) { status('Failed to load Python: ' + e.message); return; }
    status('Running...');
    try {
      // Load common packages on demand if the code imports them.
      var pkgs = [];
      var usesMpl = /matplotlib|pyplot|plt/.test(code);
      if (/\b(numpy|np)\b/.test(code)) pkgs.push('numpy');
      if (usesMpl) pkgs.push('matplotlib');
      if (pkgs.length) { status('Loading ' + pkgs.join(', ') + '...'); await py.loadPackage(pkgs); }
      var theme = readTheme();
      // CJK labels only matter once matplotlib is loaded; fetch the font lazily.
      if (usesMpl && CJK_RE.test(code)) {
        try { await ensureCjkFont(py, status); theme.cjk = true; }
        catch (e) { /* fall back to tofu rather than failing the run */ }
      }
      status(/Animation\b/.test(code) ? labels.rendering : 'Running...');
      // Let the status paint before the synchronous Python call blocks.
      await new Promise(function (r) { setTimeout(r, 0); });
      py.runPython(HARNESS);
      var res = py.globals.get('__run_user_code')(code, JSON.stringify(theme));
      var data = JSON.parse(res);
      outEl.textContent = data.out || '';
      var figs = data.figs || [];
      if (figs.length) mountFigs(figsEl, figs, labels);
      status(data.out || figs.length ? '' : 'Ran (no output).');
    } catch (e) {
      outEl.textContent = String(e && e.message ? e.message : e);
      status('Error.');
    }
  }

  function enhance(block) {
    var codeEl = block.querySelector('code');
    if (!codeEl) return;
    var zh = (document.documentElement.lang || '').toLowerCase().indexOf('zh') === 0;
    var labels = {
      editor: zh
        ? '可运行的 Python 代码。按 Escape，然后按 Tab 退出编辑器。'
        : 'Runnable Python code. Press Escape, then Tab, to leave the editor.',
      run: zh ? '运行' : 'Run',
      reset: zh ? '重置' : 'Reset',
      output: zh ? 'Python 输出' : 'Python output',
      figure: zh ? 'Python 图形输出' : 'Python figure output',
      animation: zh ? 'Python 动画输出' : 'Python animation output',
      rendering: zh ? '正在运行并渲染动画帧...' : 'Running and rendering frames...',
      frame: function (i, n) { return zh ? '第 ' + i + ' 帧 / 共 ' + n + ' 帧' : 'frame ' + i + ' of ' + n; },
      lang: zh ? 'zh' : 'en'
    };
    var source = codeEl.textContent.replace(/\n$/, '');
    block.classList.add('live-ready');
    var pre = block.querySelector('pre, div.sourceCode');

    var wrap = document.createElement('div'); wrap.className = 'live-cell';
    var grid = document.createElement('div'); grid.className = 'live-grid';
    var codeCol = document.createElement('div'); codeCol.className = 'live-code';
    var resultCol = document.createElement('div'); resultCol.className = 'live-result';

    var edit = document.createElement('div'); edit.className = 'live-edit';
    var hl = document.createElement('pre'); hl.className = 'live-hl'; hl.setAttribute('aria-hidden', 'true');
    var hlCode = document.createElement('code'); hl.appendChild(hlCode);
    var ta = document.createElement('textarea'); ta.className = 'live-editor';
    ta.spellcheck = false; ta.value = source;
    ta.setAttribute('aria-label', labels.editor);
    ta.rows = Math.min(24, source.split('\n').length + 1);

    var bar = document.createElement('div'); bar.className = 'live-bar';
    var runBtn = document.createElement('button'); runBtn.className = 'live-run'; runBtn.type = 'button'; runBtn.textContent = labels.run;
    var resetBtn = document.createElement('button'); resetBtn.className = 'live-reset'; resetBtn.type = 'button'; resetBtn.textContent = labels.reset;
    var status = document.createElement('span'); status.className = 'live-status';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    bar.appendChild(runBtn); bar.appendChild(resetBtn); bar.appendChild(status);
    var out = document.createElement('pre'); out.className = 'live-out';
    out.setAttribute('role', 'region'); out.setAttribute('aria-label', labels.output); out.setAttribute('aria-live', 'polite');
    var figs = document.createElement('div'); figs.className = 'live-figs'; figs.style.display = 'none';

    // Keep the highlight layer in sync with the textarea (content + scroll).
    function paint() { hlCode.innerHTML = highlightPy(ta.value); }
    function syncScroll() { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
    paint();
    ta.addEventListener('input', function () { paint(); syncScroll(); });
    ta.addEventListener('scroll', syncScroll, { passive: true });
    // Insert a tab as spaces. Escape releases the next Tab so keyboard users
    // can leave the editor without getting trapped.
    var releaseTab = false;
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { releaseTab = true; return; }
      if (e.key === 'Tab') {
        if (releaseTab) { releaseTab = false; return; }
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 4; paint();
        return;
      }
      releaseTab = false;
    });

    function setStatus(t) { status.textContent = t; }
    runBtn.addEventListener('click', function () { run(wrap, ta.value, setStatus, out, figs, labels); });
    resetBtn.addEventListener('click', function () {
      ta.value = source; paint(); syncScroll();
      out.textContent = ''; clearFigs(figs); setStatus('');
      wrap.classList.remove('ran');
    });
    ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(wrap, ta.value, setStatus, out, figs, labels); }
    });

    if (pre) pre.style.display = 'none';
    edit.appendChild(hl); edit.appendChild(ta);
    codeCol.appendChild(edit); codeCol.appendChild(bar);
    resultCol.appendChild(out); resultCol.appendChild(figs);
    grid.appendChild(codeCol); grid.appendChild(resultCol);
    wrap.appendChild(grid);
    block.appendChild(wrap);
  }

  function init() {
    var blocks = document.querySelectorAll('.runnable');
    for (var i = 0; i < blocks.length; i++) {
      if (!blocks[i].classList.contains('live-ready')) enhance(blocks[i]);
    }
  }
export { init as mountRunnable, HARNESS, FRAME_CAP, PAYLOAD_BUDGET };
