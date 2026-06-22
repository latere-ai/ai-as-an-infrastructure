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
  var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
  var BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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
  // figure via savefig.
  var HARNESS = [
    'import sys, io, base64, json',
    'def __style_mpl(__t):',
    '    import matplotlib',
    '    matplotlib.use("Agg")',
    '    import matplotlib as mpl',
    '    fg = __t.get("fg", "#222222"); grid = __t.get("grid", "#cccccc")',
    '    cyc = ["#5b8def", "#ff7a66", "#3dbd8a", "#b07ae0", "#e8b13c", "#3fc1d4"]',
    '    mpl.rcParams.update({',
    '        "figure.figsize": (6.2, 4.2), "figure.dpi": 130,',
    // Transparent canvas (themed panel shows through -> fits light/dark) and
    // text-as-paths so SVG labels render identically inside the <img>.
    '        "figure.facecolor": "none", "axes.facecolor": "none",',
    '        "svg.fonttype": "path",',
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
    'def __run_user_code(__src, __theme_json):',
    '    __out = io.StringIO()',
    '    __old = sys.stdout',
    '    sys.stdout = __out',
    '    __img = None',
    '    try:',
    '        try:',
    '            __style_mpl(json.loads(__theme_json))',
    '        except Exception:',
    '            pass',
    '        exec(__src, {"__name__": "__main__"})',
    '        try:',
    '            import matplotlib',
    '            if "matplotlib.pyplot" in sys.modules:',
    '                import matplotlib.pyplot as plt',
    '                if plt.get_fignums():',
    '                    __b = io.BytesIO()',
    '                    plt.savefig(__b, format="svg", bbox_inches="tight", transparent=True)',
    '                    plt.close("all")',
    '                    __img = base64.b64encode(__b.getvalue()).decode()',
    '        except Exception:',
    '            pass',
    '    finally:',
    '        sys.stdout = __old',
    '    return json.dumps({"out": __out.getvalue(), "img": __img})'
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

  async function run(cell, code, status, outEl, imgEl) {
    cell.classList.add('ran');
    outEl.textContent = ''; imgEl.src = BLANK; imgEl.style.display = 'none';
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
      status('Running...');
      py.runPython(HARNESS);
      var res = py.globals.get('__run_user_code')(code, JSON.stringify(theme));
      var data = JSON.parse(res);
      outEl.textContent = data.out || '';
      if (data.img) { imgEl.src = 'data:image/svg+xml;base64,' + data.img; imgEl.style.display = 'block'; }
      status(data.out || data.img ? '' : 'Ran (no output).');
    } catch (e) {
      outEl.textContent = String(e && e.message ? e.message : e);
      status('Error.');
    }
  }

  function enhance(block) {
    var codeEl = block.querySelector('code');
    if (!codeEl) return;
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
    ta.rows = Math.min(24, source.split('\n').length + 1);

    var bar = document.createElement('div'); bar.className = 'live-bar';
    var runBtn = document.createElement('button'); runBtn.className = 'live-run'; runBtn.textContent = 'Run';
    var resetBtn = document.createElement('button'); resetBtn.className = 'live-reset'; resetBtn.textContent = 'Reset';
    var status = document.createElement('span'); status.className = 'live-status';
    bar.appendChild(runBtn); bar.appendChild(resetBtn); bar.appendChild(status);
    var out = document.createElement('pre'); out.className = 'live-out';
    var img = document.createElement('img'); img.className = 'live-img'; img.alt = 'figure output'; img.style.display = 'none';
    img.src = BLANK;

    // Keep the highlight layer in sync with the textarea (content + scroll).
    function paint() { hlCode.innerHTML = highlightPy(ta.value); }
    function syncScroll() { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
    paint();
    ta.addEventListener('input', function () { paint(); syncScroll(); });
    ta.addEventListener('scroll', syncScroll, { passive: true });
    // Insert a tab as spaces instead of moving focus.
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 4; paint();
      }
    });

    function setStatus(t) { status.textContent = t; }
    runBtn.addEventListener('click', function () { run(wrap, ta.value, setStatus, out, img); });
    resetBtn.addEventListener('click', function () {
      ta.value = source; paint(); syncScroll();
      out.textContent = ''; img.style.display = 'none'; setStatus('');
      wrap.classList.remove('ran');
    });
    ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(wrap, ta.value, setStatus, out, img); }
    });

    if (pre) pre.style.display = 'none';
    edit.appendChild(hl); edit.appendChild(ta);
    codeCol.appendChild(edit); codeCol.appendChild(bar);
    resultCol.appendChild(out); resultCol.appendChild(img);
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
export { init as mountRunnable };
