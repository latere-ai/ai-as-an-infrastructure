# AI as an Infrastructure

From Systems to Agents: history, design decisions, and foundations.

A bilingual book that treats AI as an infrastructure and explains it
design-first. It follows one continuous arc, the lifecycle of a capability,
from raw compute to a deployed and governed behavior, asking at every step
how each piece got its shape, what trade-offs that shape encodes, and the
theory underneath. Released under [latere.ai](https://latere.ai), to be
served at [aaai.latere.ai](https://aaai.latere.ai).

## Structure

The spine is the lifecycle of a capability, read as a stack.

- **Part 0, Orientation.** The whole stack in one pass, and how to read.
- **Part I, Foundations and Pretraining.** Scaling, data, tokenization,
  architecture, training at scale.
- **Part II, Generative and Multimodal Architectures.** Diffusion and flow
  matching, diffusion language models, speech, multimodal fusion.
- **Part III, Adaptation and Alignment.** Fine-tuning, RLHF, preference
  optimization, self-improvement.
- **Part IV, Reasoning and Test-Time Compute.**
- **Part V, Inference and Serving.**
- **Part VI, Orchestration.** Training agents to act, memory, the harness,
  multi-agent, retrieval, context.
- **Part VII, Evaluation.**
- **Part VIII, Safety, Interpretability, and Governance.**
- **Part IX, Infrastructure, Compute, and Frontiers.** Accelerators,
  networking, data infrastructure, and the compute frontier.
- **Part X, Ecosystem and Economics.**
- **Part XI, Practice and Operations.** The hands-on 2026 stack, plus
  deployment, reliability, and the production data engine.

Two motifs recur: the **three loops** (training, inference, agentic) and the
**capability, efficiency, trust** lens. Watch the **constraint arrows**,
where a lower layer dictates an upper layer's choice.

## Layout

- `en/` and `zh/` are two standalone Quarto book projects, same chapter
  paths and labels under each. Chapters live at `en/pN-*/NN-slug.qmd`.
- `CONVENTIONS.md`: how chapters are written. `INTEGRATION.md`: how the
  research notes and blog series map into chapters (the book is canonical).

## Philosophy

Design-first, after [golang.design/under-the-hood](https://golang.design/under-the-hood):
every section moves through Problem, Design, Evolution, Trade-offs, and
Implementation, so a reader finishes able to answer "why is it built this
way?". Live debates get a "what's contested" box rather than being papered
over. See [`CONVENTIONS.md`](CONVENTIONS.md).

## Build

A custom React + Bun reader (`app/`) compiles the bilingual `.qmd` sources to
static HTML in `_book/{en,zh}`. The book is web-only: its runnable cells, viz
components, and interactive diagrams do not survive a static PDF or EPUB.

```sh
make dev     # live reader dev server (hot client rebuild)
make build   # build both languages into _book/{en,zh} (what the pre-commit hook and CI run)
make og      # regenerate the vendored social-share cards (on demand)
make lint    # style/diagram lint on the .qmd sources
```

CI builds both `en` and `zh` on every push and pull request.

## License

Content is licensed
[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). See
[`LICENSE`](LICENSE). Copyright © 2026 latere.ai. The variant is a
deliberate, swappable choice; switch to BY-SA or BY if wider reuse and
translation become the goal.
