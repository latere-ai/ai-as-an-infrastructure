// Guard the bespoke 2D-canvas viz components and their homes.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
function src(p: string) { return readFileSync(new URL("../../" + p, import.meta.url), "utf8"); }

test("the viz runtime registers the superposition component", () => {
  expect(rt).toMatch(/R\['superposition'\]\s*=\s*function/);
});

test("the attention heatmap exposes keyboard row controls without 64 tab stops", () => {
  const start = rt.indexOf("R['attention-heatmap']");
  const end = rt.indexOf("R['stepper']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("el('button', 'viz-attn-lbl')");
  expect(component).toContain("el('div', 'viz-attn-cell')");
  expect(component).toContain("cell.setAttribute('aria-label'");
  expect(component).toContain("qTitle.setAttribute('aria-live', 'polite')");
  expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  expect(component).toContain("if (j > i) w = 0");
});

test("viz theme reads palette vars from .reader, not body's default-black color", () => {
  // getComputedStyle(document.body).color defaults to black, invisible on the
  // dark canvas. The theme must read --fg-1/--bg-surface off .reader instead.
  const theme = rt.slice(rt.indexOf("function theme()"), rt.indexOf("function el("));
  expect(theme).toContain("querySelector('.reader')");
  expect(theme).toContain("getPropertyValue('--fg-1')");
  expect(theme).toContain("getPropertyValue('--bg-surface')");
  expect(theme).not.toContain("getComputedStyle(document.body)");
});

test("canvas visualizations redraw after a viewport resize clears the backing buffer", () => {
  const watcher = rt.slice(rt.indexOf("function watchTheme("), rt.indexOf("var R = {}"));
  expect(watcher).toContain("window.addEventListener('resize', schedule)");
  expect(watcher).toContain("host.querySelector('canvas.viz-canvas')");
  expect(watcher).toContain("var width = host.clientWidth || 600");
  expect(watcher).toContain("requestAnimationFrame(function () { raf = 0; resizeCanvas(); draw(); })");
});

test("ch32 mechanistic-interpretability uses superposition in both languages", () => {
  expect(src("en/safety/01-mechanistic-interpretability.qmd")).toContain('data-viz="superposition"');
  expect(src("zh/safety/01-mechanistic-interpretability.qmd")).toContain('data-viz="superposition"');
});

test("the viz runtime registers the paged-attention component", () => {
  expect(rt).toMatch(/R\['paged-attention'\]\s*=\s*function/);
});

test("paged attention is localized, accessible, and reports allocation efficiency", () => {
  const start = rt.indexOf("R['paged-attention']");
  const end = rt.indexOf("R['moe-routing']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("host.getAttribute('data-lang')");
  expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  expect(component).toContain("allocation efficiency");
  expect(component).toContain("分配效率");
  expect(component).toContain("grid.setAttribute('role', 'img')");
  expect(component).toContain("grid.setAttribute('aria-label'");
  expect(component).toContain("read.setAttribute('aria-live', 'polite')");
  expect(component).toContain("Math.round(used / reserved * 100)");
  expect(component).not.toContain("Math.round(used / B * 100) + '%'   (");
});

test("paged attention stops animation for reduced motion, focus, and detached hosts", () => {
  const start = rt.indexOf("R['paged-attention']");
  const end = rt.indexOf("R['moe-routing']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("prefers-reduced-motion: reduce");
  expect(component).toContain("if (reduceMotion) return");
  expect(component).toContain("host.addEventListener('focusin', pause)");
  expect(component).toContain("host.addEventListener('focusout', restart)");
  expect(component).toContain("if (!host.isConnected) { pause(); return; }");
});

test("the KV-cache calculator exposes localized labels and an accessible summary", () => {
  const start = rt.indexOf("R['kv-cache']");
  const end = rt.indexOf("R['embeddings-3d']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("document.documentElement.lang === 'zh'");
  expect(component).toContain("cached tokens per request");
  expect(component).toContain("logical KV memory (GB)");
  expect(component).toContain("每个请求的缓存词元数");
  expect(component).toContain("逻辑 KV 内存（GB）");
  expect(component).toContain("cv.c.setAttribute('role', 'img')");
  expect(component).toContain("cv.c.setAttribute('aria-label', L.desc + ': ' + summary)");
  expect(component).toContain("var read = el('span', 'viz-pa-read')");
});

test("ch17 memory-scheduling uses paged-attention in both languages", () => {
  expect(src("en/inference/02-memory-scheduling.qmd")).toContain('data-viz="paged-attention"');
  expect(src("zh/inference/02-memory-scheduling.qmd")).toContain('data-viz="paged-attention"');
});

test("the viz runtime registers the moe-routing component", () => {
  expect(rt).toMatch(/R\['moe-routing'\]\s*=\s*function/);
});

test("ch07 moe-ssm-hybrids uses moe-routing in both languages", () => {
  expect(src("en/foundations/05-moe-ssm-hybrids.qmd")).toContain('data-viz="moe-routing"');
  expect(src("zh/foundations/05-moe-ssm-hybrids.qmd")).toContain('data-viz="moe-routing"');
});

test("Chapter 9 visualizations localize controls and live summaries", () => {
  const moeStart = rt.indexOf("R['moe-routing']");
  const moeEnd = rt.indexOf("R['tree-of-thoughts']", moeStart);
  const moe = rt.slice(moeStart, moeEnd);
  const ssmStart = rt.indexOf("R['ssm-vs-attention']");
  const ssmEnd = rt.indexOf("R['rl-timeline']", ssmStart);
  const ssm = rt.slice(ssmStart, ssmEnd);

  for (const component of [moe, ssm]) {
    expect(component).toContain("host.getAttribute('data-lang')");
    expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  }
  for (const phrase of ["路由器：均衡", "路由器：集中", "容量系数", "已路由", "已丢弃", "容量"]) {
    expect(moe).toContain(phrase);
  }
  for (const phrase of ["序列长度", "注意力记录随长度增长", "递归状态槽位保持固定", "注意力：逐位置记录", "递归层：固定状态"]) {
    expect(ssm).toContain(phrase);
  }
});

test("the viz runtime registers the tree-of-thoughts component", () => {
  expect(rt).toMatch(/R\['tree-of-thoughts'\]\s*=\s*function/);
});

test("tree-of-thoughts redraws its canvas after responsive layout changes", () => {
  const start = rt.indexOf("R['tree-of-thoughts']");
  const end = rt.indexOf("R['infonce-field']", start);
  expect(rt.slice(start, end)).toContain("watchTheme(host, draw)");
});

test("tree-of-thoughts honors reduced-motion before starting its reveal loop", () => {
  const start = rt.indexOf("R['tree-of-thoughts']");
  const end = rt.indexOf("R['infonce-field']", start);
  const tree = rt.slice(start, end);
  expect(tree).toContain("prefers-reduced-motion: reduce");
  expect(tree).toContain("if (reduceMotion) return");
});

test("ch13 eliciting-reasoning uses tree-of-thoughts in both languages", () => {
  expect(src("en/reasoning/01-eliciting-reasoning.qmd")).toContain('data-viz="tree-of-thoughts"');
  expect(src("zh/reasoning/01-eliciting-reasoning.qmd")).toContain('data-viz="tree-of-thoughts"');
});

test("the viz runtime registers the infonce-field component", () => {
  expect(rt).toMatch(/R\['infonce-field'\]\s*=\s*function/);
});

test("Chapter 45 embeddings-representation uses infonce-field in both languages", () => {
  expect(src("en/orchestration/09-embeddings-representation.qmd")).toContain('data-viz="infonce-field"');
  expect(src("zh/orchestration/09-embeddings-representation.qmd")).toContain('data-viz="infonce-field"');
  expect(src("zh/orchestration/09-embeddings-representation.qmd")).toContain('data-lang="zh"');
});

test("infonce-field localizes its labels, controls, and live summary", () => {
  const body = rt.slice(rt.indexOf("R['infonce-field']"), rt.indexOf("R['comparison-explorer']"));
  for (const label of ["查询", "正样本", "损失", "最难负样本的相似度", "负样本难度", "温度"]) {
    expect(body).toContain(label);
  }
  expect(body).toContain("host.getAttribute('data-lang') === 'zh'");
});

test("the viz runtime registers the comparison-explorer component with both datasets", () => {
  expect(rt).toMatch(/R\['comparison-explorer'\]\s*=\s*function/);
  expect(rt).toContain("'agent-frameworks':");
  expect(rt).toContain("'agent-frameworks-zh':");
});

test("the Chinese chapter retains its localized comparison explorer", () => {
  expect(src("en/practice/05-agents-and-sandboxes.qmd")).not.toContain('data-set="agent-frameworks"');
  expect(src("zh/practice/05-agents-and-sandboxes.qmd")).toContain('data-set="agent-frameworks-zh"');
});

test("the viz runtime registers nested-loops and bandwidth-tiers", () => {
  expect(rt).toMatch(/R\['nested-loops'\]\s*=\s*function/);
  expect(rt).toMatch(/R\['bandwidth-tiers'\]\s*=\s*function/);
});

test("bandwidth-tiers does not present illustrative lanes as universal ratios", () => {
  expect(rt).toContain("measure sustained");
  expect(rt).toContain("domain-specific");
  expect(rt).toContain("topology-specific");
  expect(rt).not.toContain("≈10× slower");
  expect(rt).not.toContain("≈100× slower");
});

test("the three-cadence viz does not present training as a nested runtime cost", () => {
  expect(rt).toContain("agent loop · per task step");
  expect(rt).toContain("decoding · per token");
  expect(rt).toContain("training · before release");
  expect(rt).not.toContain("training · paid once");
});

test("the three-cadence viz localizes its labels and accessible name", () => {
  const start = rt.indexOf("R['nested-loops']");
  const end = rt.indexOf("R['bandwidth-tiers']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  expect(component).toContain("智能体循环 · 每个任务步骤");
  expect(component).toContain("解码 · 每个词元");
  expect(component).toContain("训练 · 发布前");
  expect(component).toContain("host.setAttribute('role', 'img')");
  expect(component).toContain("host.setAttribute('aria-label'");
  expect(component).toContain("watchTheme(host, draw);");
});

test("ch01 whole-stack uses nested-loops in both languages", () => {
  expect(src("en/orientation/01-whole-stack.qmd")).toContain('data-viz="nested-loops"');
  expect(src("zh/orientation/01-whole-stack.qmd")).toContain('data-viz="nested-loops"');
});

test("ch30 accelerators-networking uses bandwidth-tiers in both languages", () => {
  expect(src("en/infrastructure/01-accelerators-networking.qmd")).toContain('data-viz="bandwidth-tiers"');
  expect(src("zh/infrastructure/01-accelerators-networking.qmd")).toContain('data-viz="bandwidth-tiers"');
});

// Wave 2: steppers + curve reuses authored on existing components, both langs.
test("ch48 machine-that-breaks adds a prefill/decode stepper in both languages", () => {
  expect(src("en/infrastructure/08-the-machine-that-breaks.qmd")).toContain('data-chip="PREFILL"');
  expect(src("zh/infrastructure/08-the-machine-that-breaks.qmd")).toContain('data-chip="PREFILL"');
});

test("human-interface oversight adds an approval stepper in both languages", () => {
  expect(src("en/practice/11-human-interface-oversight.qmd")).toContain('data-viz="stepper"');
  expect(src("en/practice/11-human-interface-oversight.qmd")).toContain('data-chip="APPROVE"');
  expect(src("zh/practice/11-human-interface-oversight.qmd")).toContain('data-viz="stepper"');
  expect(src("zh/practice/11-human-interface-oversight.qmd")).toContain('data-chip="批准"');
});

test("the stepper exposes localized controls and current-step state", () => {
  const start = rt.indexOf("R['stepper']");
  const end = rt.indexOf("R['cost-crossover']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("host.getAttribute('data-lang')");
  expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  expect(component).toContain("Previous step");
  expect(component).toContain("上一步");
  expect(component).toContain("ch.type = 'button'");
  expect(component).toContain("ch.setAttribute('aria-pressed'");
  expect(component).toContain("d.setAttribute('aria-current'");
  expect(component).toContain("cap.setAttribute('aria-live', 'polite')");
});

test("the stepper stops animation for reduced motion, focus, and detached hosts", () => {
  const start = rt.indexOf("R['stepper']");
  const end = rt.indexOf("R['cost-crossover']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("prefers-reduced-motion: reduce");
  expect(component).toContain("if (reduceMotion) return");
  expect(component).toContain("wrap.addEventListener('focusin', pause)");
  expect(component).toContain("wrap.addEventListener('focusout', restart)");
  expect(component).toContain("if (!host.isConnected) { pause(); return; }");
});

test("the stepper does not insert separators that can wrap away from their controls", () => {
  const start = rt.indexOf("R['stepper']");
  const end = rt.indexOf("R['cost-crossover']", start);
  expect(rt.slice(start, end)).not.toContain("el('span', 'viz-step-arrow')");
});

test("ch03 scaling-laws adds a u-shape compute-optimal curve in both languages", () => {
  expect(src("en/foundations/01-scaling-laws.qmd")).toContain('data-viz="curve" data-family="u-shape"');
  expect(src("zh/foundations/01-scaling-laws.qmd")).toContain('data-viz="curve" data-family="u-shape"');
});

test("ch36 adversarial-robustness adds swiss-cheese stepper + many-shot power-law, both languages", () => {
  for (const lang of ["en", "zh"]) {
    const t = src(`${lang}/safety/05-adversarial-robustness.qmd`);
    expect(t).toContain('data-chip="CIRCUIT BREAKERS"');
    expect(t).toContain('data-viz="curve" data-family="power-grow"');
  }
});

// Wave 3: bespoke canvas components for the remaining catalog spots.
test("the viz runtime registers judge-kappa, outlier-quant, minhash-buckets, blast-radius", () => {
  for (const name of ["judge-kappa", "outlier-quant", "minhash-buckets", "blast-radius"]) {
    expect(rt).toMatch(new RegExp("R\\['" + name + "'\\]\\s*=\\s*function"));
  }
});

test("outlier quantization uses a correct signed INT4 range and explicit scale groups", () => {
  const start = rt.indexOf("R['outlier-quant']");
  const end = rt.indexOf("R['minhash-buckets']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("var bits = 4");
  expect(component).toContain("var qmax = Math.pow(2, bits - 1) - 1");
  expect(component).toContain("var qmin = -qmax");
  expect(component).toContain("mode === 'shared'");
  expect(component).toContain("separate scales");
  expect(component).not.toContain("per-channel");
  expect(component).not.toContain("L = 8");
});

test("outlier quantization localizes and exposes its changing result", () => {
  const start = rt.indexOf("R['outlier-quant']");
  const end = rt.indexOf("R['minhash-buckets']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  expect(component).toContain("共享尺度");
  expect(component).toContain("分组尺度");
  expect(component).toContain("read.setAttribute('aria-live', 'polite')");
  expect(component).toContain("btn.setAttribute('aria-pressed'");
  expect(component).toContain("cv.c.setAttribute('role', 'img')");
  expect(component).toContain("cv.c.setAttribute('aria-label'");
  expect(component).toContain("viz-pa-legend");
  expect(component).toContain("filled dots");
  expect(component).toContain("实心点");
});

test("the MinHash viz uses the LSH banding probability rather than hidden clusters", () => {
  const start = rt.indexOf("R['minhash-buckets']");
  const end = rt.indexOf("R['blast-radius']", start);
  const component = rt.slice(start, end);

  expect(rt).toContain("1 - Math.pow(1 - Math.pow(s, rows), bands)");
  expect(rt).toContain("rows per band");
  expect(rt).not.toContain("function bucketOf(c)");
  expect(rt).not.toContain("var clusters = [0, 0, 0, 0");
  for (const attr of ["data-xlabel", "data-ylabel", "data-plabel", "data-bands-label", "data-rows-label", "data-midpoint-label"]) {
    expect(component).toContain(`host.getAttribute('${attr}')`);
  }
  const zh = src("zh/foundations/02-data-curation.qmd");
  expect(zh).toContain('data-xlabel="Jaccard 相似度"');
  expect(zh).toContain('data-ylabel="候选概率"');
  expect(zh).toContain('data-plabel="每个分带的行数"');
});

test("wave-3 components are used in their chapters, both languages", () => {
  const uses: [string, string][] = [
    ["practice/07-evaluation-and-observability", "judge-kappa"],
    ["inference/04-quantization-kernels", "outlier-quant"],
    ["foundations/02-data-curation", "minhash-buckets"],
    ["safety/03-security-authorization", "blast-radius"],
  ];
  for (const [path, viz] of uses) {
    for (const lang of ["en", "zh"]) {
      expect(src(`${lang}/${path}.qmd`)).toContain(`data-viz="${viz}"`);
    }
  }
});

// Wave 4: ch09 LoRA low-rank reconstruction + task arithmetic.
test("the viz runtime registers lora-lowrank and task-arithmetic", () => {
  expect(rt).toMatch(/R\['lora-lowrank'\]\s*=\s*function/);
  expect(rt).toMatch(/R\['task-arithmetic'\]\s*=\s*function/);
});

test("lora-lowrank clamps reconstruction rank to available components", () => {
  // Regression: the rank slider can exceed the synthetic update's intrinsic
  // rank. Reading past sv[] produced NaN colors, so the right heatmap inherited
  // the previous dark fill style and turned black.
  expect(rt).toContain("var eff = Math.min(rank, RANK);");
  expect(rt).toContain("k < eff");
});

test("ch09 sft-peft uses lora-lowrank and task-arithmetic in both languages", () => {
  for (const lang of ["en", "zh"]) {
    const t = src(`${lang}/adaptation/01-sft-peft.qmd`);
    expect(t).toContain('data-viz="lora-lowrank"');
    expect(t).toContain('data-viz="task-arithmetic"');
  }
});

test("the viz runtime registers the post-training adaptation components", () => {
  for (const name of ["preference-signal-mixer", "verifier-threshold", "safety-frontier"]) {
    expect(rt).toMatch(new RegExp("R\\['" + name + "'\\]\\s*=\\s*function"));
  }
});

test("preference signal mixer reserves space for its score labels", () => {
  const start = rt.indexOf("R['preference-signal-mixer']");
  const end = rt.indexOf("R['verifier-threshold']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("labelWidth = 150 * cv.dpr");
  expect(component).toContain("maxWidth = W - 2 * pd - labelWidth");
});

test("the viz runtime registers the mid-training bridge component", () => {
  expect(rt).toMatch(/R\['midtraining-bridge'\]\s*=\s*function/);
  expect(rt).toContain("introduction point");
  expect(rt).toContain("专门数据占比");
  expect(rt).toContain("var runShare = 0.5 * share * (1 - start);");
  expect(rt).toContain("ctx.fillStyle = th.ink; ctx.fillText(L.specialist");
  expect(rt).not.toContain("function targetFit(t)");
  expect(rt).not.toContain("function abruptRetention(t)");
});

test("the mid-training bridge exposes its changing token accounting", () => {
  const start = rt.indexOf("R['midtraining-bridge']");
  const end = rt.indexOf("R['preference-signal-mixer']", start);
  const bridge = rt.slice(start, end);

  expect(bridge).toContain("read.setAttribute('aria-live', 'polite')");
  expect(bridge).toContain("cv.c.setAttribute('role', 'img')");
  expect(bridge).toContain("cv.c.setAttribute('aria-label', read.textContent)");
  expect(bridge).toContain("var sep = zh ? '：' : ': '");
  expect(bridge).toContain("L.summary + sep + L.final");
});

test("mid-training uses the bridge visualization in both languages", () => {
  expect(src("en/foundations/07-mid-training.qmd")).toContain('data-viz="midtraining-bridge"');
  expect(src("zh/foundations/07-mid-training.qmd")).toContain('data-viz="midtraining-bridge"');
  expect(src("zh/foundations/07-mid-training.qmd")).toContain('data-lang="zh"');
});

test("expanded adaptation chapters use the post-training visualizations in both languages", () => {
  const uses: [string, string][] = [
    ["adaptation/02-behavior-specs-preference-data", "preference-signal-mixer"],
    ["adaptation/05-verifiable-rewards-reasoning", "verifier-threshold"],
    ["adaptation/06-safety-tuning-instruction-hierarchy", "safety-frontier"],
  ];
  for (const [path, viz] of uses) {
    for (const lang of ["en", "zh"]) {
      expect(src(`${lang}/${path}.qmd`)).toContain(`data-viz="${viz}"`);
    }
  }
});

// Wave 5: the deep-catalog tail of bespoke components.
test("the viz runtime registers the wave-5 components", () => {
  for (const name of ["grpo-advantage", "ssm-vs-attention", "rl-timeline", "rrf-fusion", "decision-tree", "float-bits", "pipeline-bubble"]) {
    expect(rt).toMatch(new RegExp("R\\['" + name + "'\\]\\s*=\\s*function"));
  }
});

test("wave-5 components are used in their chapters, both languages", () => {
  const uses: [string, string][] = [
    ["reasoning/05-training-to-reason", "grpo-advantage"],
    ["foundations/05-moe-ssm-hybrids", "ssm-vs-attention"],
    ["orchestration/01-training-agents-to-act", "rl-timeline"],
    ["orchestration/08-rag-retrieval", "rrf-fusion"],
    ["practice/01-choosing-a-model", "decision-tree"],
    ["foundations/06-training-at-scale", "float-bits"],
    ["foundations/06-training-at-scale", "pipeline-bubble"],
  ];
  for (const [path, viz] of uses) {
    for (const lang of ["en", "zh"]) {
      expect(src(`${lang}/${path}.qmd`)).toContain(`data-viz="${viz}"`);
    }
  }
});

test("Chapter 10 visualizations localize labels, controls, and accessible summaries", () => {
  const floatStart = rt.indexOf("R['float-bits']");
  const floatEnd = rt.indexOf("R['pipeline-bubble']", floatStart);
  const floatBits = rt.slice(floatStart, floatEnd);
  const bubbleStart = rt.indexOf("R['pipeline-bubble']");
  const bubbleEnd = rt.indexOf("R['eval-power']", bubbleStart);
  const bubble = rt.slice(bubbleStart, bubbleEnd);

  for (const component of [floatBits, bubble]) {
    expect(component).toContain("host.getAttribute('data-lang')");
    expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  }
  for (const phrase of ["符号", "指数（范围）", "尾数（精度）", "位 = 1 位符号"]) {
    expect(floatBits).toContain(phrase);
  }
  expect(floatBits).toContain("b.setAttribute('aria-pressed'");
  expect(floatBits).toContain("bits.setAttribute('role', 'img')");
  expect(floatBits).toContain("bits.setAttribute('aria-label'");

  for (const phrase of ["阶段 ", "理想 GPipe", "个阶段", "个微批", "气泡", "流水线阶段数 p", "微批数 m"]) {
    expect(bubble).toContain(phrase);
  }
  expect(bubble).toContain("read.setAttribute('aria-live', 'polite')");
  expect(bubble).toContain("cv.c.setAttribute('role', 'img')");
  expect(bubble).toContain("cv.c.setAttribute('aria-label'");
});

test("the RL systems view separates placement from synchronization", () => {
  const start = rt.indexOf("R['rl-timeline']");
  const end = rt.indexOf("R['rrf-fusion']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("document.documentElement.lang.indexOf('zh') === 0");
  expect(component).toContain("var axis = 'placement'");
  expect(component).toContain("placementBtn.setAttribute('aria-pressed'");
  expect(component).toContain("scheduleBtn.setAttribute('aria-pressed'");
  expect(component).toContain("read.setAttribute('aria-live', 'polite')");
  expect(component).toContain("cv.c.setAttribute('role', 'img')");
  expect(component).toContain("cv.c.setAttribute('aria-label'");
  expect(component).toContain("watchTheme(host, draw)");
  expect(component).toContain("资源位置");
  expect(component).toContain("更新时序");
  expect(component).not.toContain("~1 step off-policy");
  expect(component).not.toContain("near-full utilization");
});

test("the SSM comparison visualizes state shape without inventing recall accuracy", () => {
  const start = rt.indexOf("R['ssm-vs-attention']");
  const end = rt.indexOf("R['rl-timeline']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("attention records grow with length");
  expect(component).toContain("recurrent state slots stay fixed");
  expect(component).not.toContain("exact");
  expect(component).not.toContain("far recall");
  expect(component).not.toContain("Math.exp");
});

test("the viz runtime registers the ROI balance component", () => {
  expect(rt).toMatch(/R\['roi-balance'\]\s*=\s*function/);
});

test("adoption-productivity uses ROI balance in both languages", () => {
  expect(src("en/ecosystem/06-adoption-productivity.qmd")).toContain('data-viz="roi-balance"');
  expect(src("zh/ecosystem/06-adoption-productivity.qmd")).toContain('data-viz="roi-balance"');
  expect(src("zh/ecosystem/06-adoption-productivity.qmd")).toContain('data-lang="zh"');
});

test("the viz runtime registers evaluation power and frontier components", () => {
  expect(rt).toMatch(/R\['eval-power'\]\s*=\s*function/);
  expect(rt).toMatch(/R\['eval-frontier'\]\s*=\s*function/);
});

test("expanded evaluation chapters use the new interactive visualizations in both languages", () => {
  for (const lang of ["en", "zh"]) {
    expect(src(`${lang}/evaluation/02-statistical-reliability.qmd`)).toContain('data-viz="eval-power"');
    expect(src(`${lang}/evaluation/07-operational-evaluation.qmd`)).toContain('data-viz="eval-frontier"');
  }
});

test("evaluation precision visual does not present a Wald half-width as a power or release rule", () => {
  const start = rt.indexOf("R['eval-power']");
  const end = rt.indexOf("R['eval-frontier']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("rough iid screen");
  expect(component).toContain("Wald half-width");
  expect(component).toContain("reference effect");
  expect(component).not.toContain("decision-grade");
  expect(component).not.toContain("investigate only");
});

test("evaluation precision visual localizes every visible label in Chinese", () => {
  const start = rt.indexOf("R['eval-power']");
  const end = rt.indexOf("R['eval-frontier']", start);
  const component = rt.slice(start, end);

  for (const label of [
    "独立同分布粗略检查",
    "参考效应",
    "Wald 半宽",
    "留出样本数（对数刻度）",
    "95% 半宽（百分点）",
    "样本量 n",
  ]) expect(component).toContain(label);
  expect(component).toContain("document.documentElement.lang.indexOf('zh')");
  expect(component).toContain("setAttribute('aria-label'");
  expect(src("zh/evaluation/02-statistical-reliability.qmd")).toContain('data-lang="zh"');
});

test("the viz runtime registers expanded reasoning components", () => {
  for (const name of ["reasoning-search-budget", "rlvr-boundary", "ttc-budget"]) {
    expect(rt).toMatch(new RegExp("R\\['" + name + "'\\]\\s*=\\s*function"));
  }
});

test("reasoning-search budget reports exact node growth instead of invented quality", () => {
  const start = rt.indexOf("R['reasoning-search-budget']");
  const end = rt.indexOf("R['rlvr-boundary']", start);
  const searchBudget = rt.slice(start, end);
  expect(searchBudget).toContain("fullNodes");
  expect(searchBudget).toContain("beamNodes");
  expect(searchBudget).toContain("beam width");
  expect(searchBudget).toContain("Math.log10(1 + b.v)");
  expect(searchBudget).toContain("setAttribute('role', 'img')");
  expect(searchBudget).toContain("setAttribute('aria-label'");
  expect(searchBudget).not.toContain("Math.exp(-states / 75)");
  expect(searchBudget).not.toContain("verifier quality");
});

test("test-time compute budget exposes its synthetic status to assistive technology", () => {
  const start = rt.indexOf("R['ttc-budget']");
  const end = rt.indexOf("R['midtraining-bridge']", start);
  const component = rt.slice(start, end);
  expect(component).toContain("setAttribute('role', 'img')");
  expect(component).toContain("setAttribute('aria-label'");
  expect(component).toContain("Synthetic adaptive test-time compute curve");
  expect(component).toContain("合成的自适应测试时计算曲线");
});

test("expanded reasoning chapters use the new interactive visualizations in both languages", () => {
  const uses: [string, string][] = [
    ["reasoning/02-structured-reasoning-search", "reasoning-search-budget"],
    ["reasoning/05-training-to-reason", "rlvr-boundary"],
    ["reasoning/07-inference-time-scaling", "ttc-budget"],
  ];
  for (const [path, viz] of uses) {
    for (const lang of ["en", "zh"]) {
      expect(src(`${lang}/${path}.qmd`)).toContain(`data-viz="${viz}"`);
    }
  }
});

test("the viz runtime registers the verification frontier component", () => {
  expect(rt).toMatch(/R\['verification-frontier'\]\s*=\s*function/);
  expect(rt).toContain("formalized coverage");
  expect(rt).toContain("形式化覆盖");
});

test("verification frontier keeps its stacked-bar legend readable on mobile", () => {
  const start = rt.indexOf("R['verification-frontier']");
  const end = rt.indexOf("R['", start + 10);
  const component = rt.slice(start, end < 0 ? undefined : end);
  expect(component).toContain("compactLegend");
  expect(component).toContain("cssWidth < 430");
  expect(component).toContain("segmentCenter");
});

test("verification frontier chapter uses the interactive visualization in both languages", () => {
  expect(src("en/frontiers/03-verification-frontier.qmd")).toContain('data-viz="verification-frontier"');
  expect(src("zh/frontiers/03-verification-frontier.qmd")).toContain('data-viz="verification-frontier"');
  expect(src("zh/frontiers/03-verification-frontier.qmd")).toContain('data-lang="zh"');
});

// Regression: the RRF "constant k" slider re-ranked nothing because the synthetic
// dense/sparse lists made the fused order invariant to k over the whole slider
// range. The data must produce a fused top-1 flip inside the slider's k range.
test("rrf-fusion localizes its controls, status, columns, and document labels", () => {
  const body = rt.slice(rt.indexOf("R['rrf-fusion']"), rt.indexOf("R['decision-tree']"));
  for (const label of ["打乱稀疏排名", "融合首位：文档", "稠密", "稀疏", "融合", "文档", "RRF 常数 k"]) {
    expect(body).toContain(label);
  }
  expect(body).toContain("host.getAttribute('data-lang') === 'zh'");
});

test("rrf-fusion default data makes the fused top-1 flip as k moves in range", () => {
  // Mirror the component's scoring on its default (rot = 0) state.
  const names = ["A", "B", "C", "D", "E"];
  const dense = [0, 1, 2, 3, 4];
  // SB is the base sparse order the component ships (rot = 0 picks it as-is).
  const sbMatch = rt.match(/var SB = \[([0-9, ]+)\];/);
  expect(sbMatch).not.toBeNull();
  const sp = sbMatch![1].split(",").map((s) => Number(s.trim()));
  // The slider's min/max define the in-range k values the user can reach.
  const slMatch = rt.match(/slider\(L\.slider, (\d+), (\d+),/);
  expect(slMatch).not.toBeNull();
  const kMin = Number(slMatch![1]);
  const kMax = Number(slMatch![2]);
  const rankOf = (order: number[], d: number) => order.indexOf(d) + 1;
  const topAt = (k: number) => {
    const score = names.map((_, d) => 1 / (k + rankOf(dense, d)) + 1 / (k + rankOf(sp, d)));
    const fused = names.map((_, d) => d).sort((a, b) => score[b] - score[a]);
    return fused[0];
  };
  expect(topAt(kMin)).not.toBe(topAt(kMax));
});

// Regression: the infonce-field "temperature" slider changed nothing visible
// because draw() used tau only for the loss readout; the negatives' line widths
// and dot emphasis were keyed off raw similarity. They must depend on tau.
test("infonce-field draws negatives with a tau-dependent emphasis", () => {
  const body = rt.slice(rt.indexOf("R['infonce-field']"), rt.indexOf("R['comparison-explorer']"));
  // Emphasis is exp((s - maxs) / tau): a softmax sharpening that tau controls.
  expect(body).toMatch(/Math\.exp\(\(o\.s - maxs\) \/ tau\)/);
});
