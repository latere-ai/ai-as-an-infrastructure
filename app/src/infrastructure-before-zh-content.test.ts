import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/orientation/04-infrastructure-before.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/orientation/04-infrastructure-before.qmd"), "utf8");

test("Chapter 4 defines its predecessor and follows one request through it", () => {
  expect(en).toContain("This chapter calls that body of work **large-scale predictive ML**");
  expect(zh).toContain("**大规模预测式机器学习**");
  expect(zh).toContain("不是早期 AI 的完整历史");
  expect(zh).toContain("## 一次请求怎样穿过旧技术栈");
  expect(zh).toContain("这些数字来自 Facebook 实测的工作负载，并不代表所有数据中心");
  for (const stage of ["**候选生成**", "**排序**", "**日志与实验**"]) {
    expect(zh).toContain(stage);
  }
});

test("retrieval and ranking equations define the funnel without invented scale labels", () => {
  expect(zh).toContain("a_i=e_u^{\\mathsf T}e_i");
  expect(zh).toContain("C_k(u)=\\operatorname{TopK}_{i\\in\\mathcal I}(a_i)");
  expect(zh).toContain("\\operatorname{Sort}_{i\\in C_k(u)} r_\\psi(u,i,z_i)");
  expect(zh).toContain("这个式子先用用户嵌入与条目嵌入的相似度打分，再选出分数最高的候选");
  expect(zh).toContain("$C_k(u)$ 是检索得到的 $k$ 个候选组成的集合");
  expect(zh).toContain("牺牲一部分检索召回率，换取更低的延迟和内存流量");
  expect(zh).toContain("推荐系统与检索增强生成共享逐步收窄的结构");
  expect(zh).not.toContain("约 10⁹ 个条目");
  expect(zh).not.toContain("2016 年的推荐漏斗与 2024 年的检索增强生成漏斗");
});

test("transferred practices preserve operational and measurement boundaries", () => {
  expect(zh).toContain("## 继承下来的做法");
  expect(zh).toContain("| 领域 | 成熟的预测式机器学习实践 | 在生成式系统中的调整 |");
  for (const area of ["检索", "运营", "度量"]) expect(zh).toContain(`| **${area}** |`);
  expect(zh).toContain("数据依赖、反馈回路、配置和外围代码");
  expect(zh).toContain("训练与服务使用一致的转换");
  expect(zh).toContain("移动搜索广告量减少了 50%");
  expect(zh).toContain("共同教训更窄");
});

test("Netflix example separates three deployment gates", () => {
  expect(zh).toContain("## 离线改进不等于产品改进");
  expect(zh).toContain("2007 年进展奖");
  expect(zh).toContain("后来大奖方案增加的方法并未采用");
  for (const gate of ["**离线质量：**", "**系统可行性：**", "**产品价值：**"]) {
    expect(zh).toContain(gate);
  }
  expect(zh).toContain("更好的离线数字只是证据，不是部署决定");
});

test("serving comparison keeps workload-specific state and cost explicit", () => {
  expect(zh).toContain("## 服务为何发生变化");
  expect(zh).toContain('| <span style="white-space: nowrap">维度</span> | <span style="display: inline-block; min-width: 14em">以嵌入为主的推荐模型</span> | <span style="display: inline-block; min-width: 14em">自回归语言模型</span> |');
  for (const dimension of ["主要算子", "内存压力", "请求状态", "输出与延迟", "调度后果"]) {
    expect(zh).toContain(`| **<span style="white-space: nowrap">${dimension}</span>** |`);
  }
  expect(zh).toContain("比较的是有代表性的工作负载，而不是所有推荐模型和所有语言模型");
  expect(zh).toContain("M_{\\mathrm{KV}}\\approx 2L H_{\\mathrm{KV}}d_h S b");
  expect(zh).toContain("逐序列注意力状态");
  expect(zh).toContain("PagedAttention");
  expect(zh).toContain("迭代级调度");
});

test("tabular scope reports measured limits instead of a progress ladder", () => {
  expect(zh).toContain("## 哪些内容仍不在本书范围内");
  expect(zh).toContain("45 个经过筛选的中等规模表格数据集");
  expect(zh).toContain("最多 10,000 个样本和 500 个特征");
  expect(zh).toContain("超出这些限制后的表现仍需进一步研究");
  expect(zh).toContain("单样本推断速度慢于 CatBoost");
  expect(zh).toContain("模型族应按工作负载选择，不是一条进步阶梯");
  expect(zh).not.toContain("仍是树模型的领地");
});

test("convergence evidence remains scoped for TIGER, HSTU, and closed-loop data", () => {
  expect(zh).toContain("## 两套技术栈开始合流的地方");
  expect(zh).toContain("公开实验并不能证明它已经在网页规模上取代旧方案");
  expect(zh).toContain("1.5 万亿参数");
  expect(zh).toContain("某一项披露的在线指标提高 12.4%");
  expect(zh).toContain("三个数量级");
  expect(zh).toContain("仍然保留多个检索生成器");
  expect(zh).toContain("不同于把模型生成的样本放进训练语料");
  expect(zh).toContain("现有证据支持的是混合共存");
  expect(zh).not.toContain("两位数优势击败其经典技术栈");
});

test("the final boundary table replaces the stale runnable and sweeping conclusion", () => {
  expect(zh).toContain("## 本书其余部分的边界");
  expect(zh).toContain("| 状态 | 包含的内容 |");
  for (const status of ["继承", "调整", "工作负载特有", "不在范围内"]) {
    expect(zh).toContain(`| **${status}** |`);
  }
  expect(zh).toContain("相邻的基础设施，不是同一个模型生命周期的早期章节");
  expect(zh).not.toContain("np.argsort");
  expect(zh).not.toContain(":::: {.runnable}");
  expect(zh).not.toContain("样本量是整个文明");
});
