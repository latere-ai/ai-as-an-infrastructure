// Build-time syntax highlighting for static code fences. This ports the proven,
// dependency-free Python highlighter from live-runtime.html (the runnable-editor
// overlay) VERBATIM, emitting the same .lt-* token classes, so a static
// ```python block renders identically to an interactive one. markdown-it's
// `highlight` hook returns the inner HTML; markdown-it adds the
// <pre><code class="language-X"> wrapper. Python only for now (122 of 150
// fences); other languages return "" and fall back to default escaping.
//
// Escaping contract (do not "improve"): every non-\w slice (gaps, strings,
// comments, numbers, decorators) goes through esc(); only \w-only identifiers
// and keywords are emitted raw. That is what keeps literal <, >, & in code safe.

const PY_KW = /^(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|match|case)$/;
const PY_BI = /^(print|len|range|int|float|str|list|dict|set|tuple|bool|bytes|abs|min|max|sum|sorted|reversed|enumerate|zip|map|filter|open|type|isinstance|issubclass|super|object|format|repr|round|input|any|all|getattr|setattr|hasattr|next|iter|id|hash|ord|chr|bin|hex|oct|pow|divmod|vars|dir)$/;
const PY_RE = /(#[^\n]*)|([rbuf]{0,3}"""[\s\S]*?"""|[rbuf]{0,3}'''[\s\S]*?'''|[rbuf]{0,3}"(?:\\.|[^"\\\n])*"|[rbuf]{0,3}'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?\b)|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)/g;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightPy(src: string): string {
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  PY_RE.lastIndex = 0;
  while ((m = PY_RE.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += '<span class="lt-com">' + esc(m[1]) + "</span>";
    else if (m[2]) out += '<span class="lt-str">' + esc(m[2]) + "</span>";
    else if (m[3]) out += '<span class="lt-num">' + esc(m[3]) + "</span>";
    else if (m[4]) out += '<span class="lt-dec">' + esc(m[4]) + "</span>";
    else if (PY_KW.test(m[5])) out += '<span class="lt-kw">' + m[5] + "</span>";
    else if (PY_BI.test(m[5])) out += '<span class="lt-bi">' + m[5] + "</span>";
    else out += m[5];
    last = PY_RE.lastIndex;
  }
  out += esc(src.slice(last));
  return out;
}

// markdown-it highlight hook. Returns highlighted inner HTML for supported
// languages, or "" to let markdown-it escape the source itself.
export function highlightCode(str: string, lang: string): string {
  if (lang === "python" || lang === "py") return highlightPy(str);
  return "";
}
