// Book-wide checks for runnable Python cells. Every `{.runnable}` cell on every
// page of both manifests is executed with the python3 on PATH (CI installs
// requirements-test.txt, which provides numpy and matplotlib; matplotlib runs on
// its non-interactive Agg backend) and must exit with status 0. Printed output
// is not compared, so a cell can change its numbers or labels without a test
// edit. The English and Chinese copies of a page carry the same program: string
// literals (localized labels), comments, and alignment whitespace may differ,
// nothing else.

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { loadBook } from "./pipeline/book.ts";
import type { Lang } from "./types.ts";

const repoRoot = join(import.meta.dir, "../..");

// A cell is a fenced div carrying the runnable class around one python fence;
// the pipeline and the client runtime (runtime/live.ts) accept exactly this.
const CELL = /^(:{3,})[ \t]*\{\.runnable\}[ \t]*\n```python[ \t]*\n([\s\S]*?)\n```[ \t]*\n\1[ \t]*$/gm;
const MARKER = /\{\.runnable\b[^}]*\}/g;

// A cell is killed after CELL_TIMEOUT_MS. A cold matplotlib font cache costs
// about ten seconds on first import, so the per-test limit leaves room above it.
const CELL_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 45_000;

interface Page {
  lang: Lang;
  path: string; // repo-relative source path
  page: string; // manifest path shared by the two trees
  markers: number;
  cells: string[];
}

function pages(lang: Lang): Page[] {
  return loadBook(lang, repoRoot).chapters.map((ch) => {
    const source = readFileSync(ch.qmdPath, "utf8");
    return {
      lang,
      path: ch.srcRel,
      page: ch.srcRel.slice(lang.length + 1),
      markers: source.match(MARKER)?.length ?? 0,
      cells: [...source.matchAll(CELL)].map((match) => match[2]),
    };
  });
}

const book = [...pages("en"), ...pages("zh")];
const cells = book.flatMap((page) => page.cells.map((code, index) => ({ id: `${page.path} cell ${index + 1}`, code })));

interface Run {
  exitCode: number | null;
  signal: string | null;
  stderr: string;
}

const python = Bun.which("python3") ?? Bun.which("python");

async function execute(code: string): Promise<Run> {
  if (!python) return { exitCode: null, signal: null, stderr: "python3 is not on PATH" };
  const proc = Bun.spawn([python, "-c", code], {
    cwd: tmpdir(),
    env: { ...process.env, MPLBACKEND: "Agg" },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
    timeout: CELL_TIMEOUT_MS,
  });
  const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  return { exitCode, signal: proc.signalCode ?? null, stderr };
}

// Cells are independent processes, so they run in parallel from module load
// and each test awaits its own result.
const results = new Map<string, Promise<Run>>();
{
  const settle = new Map<string, (run: Run) => void>();
  for (const cell of cells) results.set(cell.id, new Promise((resolve) => settle.set(cell.id, resolve)));
  let next = 0;
  const worker = async () => {
    while (next < cells.length) {
      const cell = cells[next++];
      const run = await execute(cell.code).catch(
        (error: unknown): Run => ({ exitCode: null, signal: null, stderr: `spawn failed: ${error}` }),
      );
      settle.get(cell.id)!(run);
    }
  };
  for (let i = 0; i < Math.max(2, availableParallelism()); i++) void worker();
}

// The program a reader runs, with what a translation may change removed:
// string literals become "", comments are dropped, runs of interior whitespace
// collapse to one space, and blank lines are skipped. Strings and comments are
// matched in one left-to-right pass, so a quote inside a comment and a # inside
// a string are both handled.
function program(code: string): string {
  return code
    .replace(
      /(?<!\w)[rRbBuUfF]{0,2}("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|#[^\n]*/g,
      (match, literal) => (literal ? '""' : ""),
    )
    .split("\n")
    .map((line) => {
      const indent = line.match(/^[ \t]*/)![0];
      return indent + line.slice(indent.length).replace(/[ \t]+/g, " ").trimEnd();
    })
    .filter((line) => line.trim() !== "")
    .join("\n");
}

test("every runnable marker wraps one python fence", () => {
  const malformed = book
    .filter((page) => page.markers !== page.cells.length)
    .map((page) => `${page.path}: ${page.markers} markers, ${page.cells.length} cells`);
  expect(malformed).toEqual([]);
  expect(cells.length).toBeGreaterThan(0);
});

for (const cell of cells) {
  test(`${cell.id} runs without error`, async () => {
    const run = await results.get(cell.id)!;
    const reason = run.signal ? `killed by ${run.signal}` : `exit ${run.exitCode}`;
    expect(run.exitCode, `${cell.id}: ${reason}\n${run.stderr}`).toBe(0);
  }, TEST_TIMEOUT_MS);
}

test("English and Chinese pages carry the same runnable programs", () => {
  const zh = new Map(book.filter((page) => page.lang === "zh").map((page) => [page.page, page]));
  const divergent: string[] = [];
  for (const en of book.filter((page) => page.lang === "en")) {
    const twin = zh.get(en.page)?.cells ?? [];
    if (twin.length !== en.cells.length) {
      divergent.push(`${en.page}: ${en.cells.length} English cells, ${twin.length} Chinese cells`);
      continue;
    }
    en.cells.forEach((code, i) => {
      if (program(code) !== program(twin[i])) divergent.push(`${en.page}: cell ${i + 1} differs outside strings and comments`);
    });
  }
  expect(divergent).toEqual([]);
});
