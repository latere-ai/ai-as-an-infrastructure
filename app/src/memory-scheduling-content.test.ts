import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/inference/02-memory-scheduling.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/memory-scheduling.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the memory chapter remains plain UTF-8 with locally owned citations", () => {
  expect(chapter).not.toContain("\0");
  expect(bibliography).not.toContain("\0");
  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(6);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the chapter bridges from reservation without inventing a dependency chain", () => {
  for (const phrase of [
    "reserve the state required by a token plan before executing it",
    "these mechanisms compose",
    "they are not stages in a required historical sequence",
  ]) expect(flat).toContain(phrase);
});

test("KV accounting defines exact block capacity and separates three waste classes", () => {
  for (const expression of [
    "2L\\,n_{\\mathrm{kv}}\\,d_{\\mathrm{head}}\\,b_{\\mathrm{kv}}",
    "q_i=\\left\\lceil\\frac{T_i}{B}\\right\\rceil",
    "M_i^{\\mathrm{alloc}}=q_i B\\kappa",
    "0\\le w_i<B",
  ]) expect(chapter).toContain(expression);
  for (const phrase of ["over-reservation", "external fragmentation", "tail waste"]) {
    expect(flat).toContain(phrase);
  }
});

test("the runnable performs exact discrete block accounting", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "block  entries  allocated  tail-waste",
    "    1      459        459           0",
    "    8       60        480          21",
    "   16       32        512          53",
    "   32       17        544          85",
    "   64       10        640         181",
    "contiguous max-reservation slots: 1024",
  ]);
  expect(flat).toContain("does not turn block-table entries into a synthetic runtime cost");
});

test("PagedAttention explains indirection, analogy limits, and scoped evidence", () => {
  for (const expression of ["\\pi_i:", "\\longrightarrow\\mathcal P", "| Physical block $\\pi_i(j)$ | 7 | 2 | 9 |"]) {
    expect(chapter).toContain(expression);
  }
  for (const phrase of [
    "it is not a hardware page table",
    "there need not be demand faults",
    "models, workloads, and fastertransformer and orca baselines evaluated",
    "not a hardware-independent multiplier",
  ]) expect(flat).toContain(phrase);
});

test("planning preserves capacity through reserve, commit, and rollback", () => {
  for (const expression of [
    "\\Delta q_i",
    "\\sum_{i\\in\\mathcal S}\\Delta q_i",
    "\\le q_{\\mathrm{free}}",
    "q_{\\mathrm{free}}\n+q_{\\mathrm{reserved}}\n+q_{\\mathrm{committed}}\n=q_{\\mathrm{capacity}}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "reserve, execute, and commit protocol",
    "rolls uncommitted reservations back",
    "no referenced block may be reassigned",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("fig-memory-block-lifecycle");
});

test("prefix sharing defines identity, ownership, and reclamation", () => {
  for (const expression of [
    "\\left|\\bigcup_{i\\in\\mathcal R}\\mathcal B_i\\right|",
    "q_{\\mathrm{live}}\\le q_{\\mathrm{capacity}}",
    "r_p=0",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "equal visible text is not enough",
    "model weights or revision",
    "active adapters",
    "tenant and isolation policy",
    "copy-on-write or an equivalent rule",
    "matched prefix tokens or bytes",
  ]) expect(flat).toContain(phrase);
});

test("pressure and chunking policies state costs, fairness, and limits", () => {
  for (const action of [
    "evict reusable prefix state",
    "defer admission",
    "preempt and recompute",
    "offload and reload",
    "reject or fail explicitly",
  ]) expect(flat).toContain(action);
  for (const expression of [
    "\\sum_{i\\in\\mathcal D}d_i",
    "\\sum_{j\\in\\mathcal P_f}c_j",
    "\\le K",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "not permission to spin forever",
    "does not remove all prefill-decode interference",
    "starve new prefills",
  ]) expect(flat).toContain(phrase);
});

test("state movement accounts for transfer, load, and operational caveats", () => {
  for (const expression of [
    "\\tau_{\\mathrm{transfer}}",
    "\\tau_{\\mathrm{fixed}}+\\frac{S}{\\beta}",
    "\\widehat C_{ij}",
    "Q_j",
    "C_{\\mathrm{prefill}}(P_i-H_{ij};j)",
    "+X_{ij}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "achieved rather than advertised link bandwidth",
    "queues, contention, retries, and backpressure",
    "do not establish disaggregation or tiering as the universal choice",
    "capacity, fairness, fault domains, prediction error, and tenant isolation",
  ]) expect(flat).toContain(phrase);
});

test("verification covers failures, namespaces, conservation, and service results", () => {
  for (const phrase of [
    "cancel a request between reservation and commit",
    "final reference disappears",
    "inject execution and transfer failures",
    "exhaust the pool",
    "change model revision, adapter, position, modality, or tenant namespace",
    "reconcile every scheduled token and every physical block",
    "service result",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes unsupported shortcuts, figures, and mutable source paths", () => {
  for (const phrase of [
    "dependency chain",
    "two facts that make one problem",
    "two faces of one resource problem",
    "the analogy is precise",
    "single change that lets",
    "only internal waste",
    "reset the throughput baseline",
    "next thing to break",
    "never stalls decode",
    "neither interferes",
    "most recent move",
    "frontier fleets",
    "vllm/v1/engine/core.py",
    "/figures/memory-scheduling-1.svg",
    "/figures/memory-scheduling-2.svg",
    "np.sqrt",
    "w_indir",
    "b_formula",
  ]) expect(flat).not.toContain(phrase);
});
