# Changelog

Every tag has a section here, and the section is the body of the GitHub
release. A tag without one is refused at the pre-push and fails the release
workflow. Write under `Unreleased` as work lands; `lateregate release vX.Y.Z`
turns that into the tag's section, commits, tags and pushes.

A section says what changed for whoever uses the release, not what was
committed: the commit log already holds that.

## Unreleased

## v0.10.7 - 2026-09-26

### Changed

- robots.txt, the sitemap and the llms.txt files may now be cached for up
  to five minutes, so a change to them reaches crawlers and agents within
  minutes of a release, and the large llms-full.txt is answered from the
  edge on repeated fetches.

## v0.10.6 - 2026-09-26

### Added

- Every page, in both languages, has a Markdown version at its address plus
  `.md`: `/en/foundations/scaling-laws.md` for a chapter, `/en/index.md` for
  the home page. It is written for AI agents and other tools that read text
  rather than render the reader. It opens with the page's title, address,
  part, review date, license, and the address of the same page in the other
  language. Equations come as TeX, tables as Markdown tables, callouts as
  quoted notes, runnable cells as code blocks, and each figure as its
  numbered caption linked to the figure on the page. Every link is a full
  address, so the text reads the same when copied out of the site. The home
  page's version lists the whole book's contents.
- `/agentweb.json` lists every page in reading order, English first, with
  its title, description, part, review date, the address of its Markdown
  version, and the same page in the other language. It is the index the
  site's robots.txt, sitemap, llms.txt and Markdown responses are generated
  from.
- The site states how crawlers and AI tools may use the book, and gives them
  the book in a form they read directly. `/robots.txt` allows search indexing
  and use in AI answers and refuses AI training, in the Content Signals
  format, with the policy text that makes the refusal a reservation of rights
  under EU copyright law. `/llms.txt` and `/zh/llms.txt` list every page of
  their edition with its description and a link to its Markdown version, and
  `/llms-full.txt` and `/zh/llms-full.txt` hold every page's Markdown in
  reading order. A tool that asks for Markdown at a page's own address
  (`Accept: text/markdown`) receives the Markdown version, and every page
  names that version in its head. `/sitemap.xml` now gives each page's review
  date. Each page also describes itself in schema.org structured data: the
  home page as its edition of the book, with author, publisher and license,
  and every other page as a chapter of it, with its place in the book and the
  same chapter in the other language.

### Fixed

- Every link on every page is now written from the site root
  (`/en/foundations/...`) instead of relative to the page it sits on. A
  crawler that resolved relative links against the address it had asked for,
  not the page it received, turned each link into a new invented address;
  a root-relative link names the same page from anywhere.
- Eight reference titles showed a fragment of markup, such as
  `<span class="nocase">TPU v4</span>`, around a word the bibliography
  protects from lowercasing. They now show the word alone.

## v0.10.5 - 2026-09-26

### Added

- The reader measures how pages load for the people reading them: load
  timing, Core Web Vitals (largest contentful paint, interaction to next
  paint, layout shift) and the book's own requests. The measurements go to
  the book's server, never to a third party, and carry no cookie and nothing
  that identifies a reader; query strings are removed from the addresses they
  record. The measuring code is fetched only after a page has finished
  loading and gone idle, so it does not slow reading.

## v0.10.4 - 2026-09-25

### Changed

- An address that matches no page now answers 404 with a short page, in
  English and Chinese, that links to both editions. It used to redirect to
  the home page. A crawler that resolved the home page's links against the
  address it had asked for turned every such redirect into more invented
  addresses, at about twenty requests a second; a 404 gives it nothing to
  follow, and search engines no longer see those addresses as copies of the
  home page. Old chapter addresses from before the reorganization still
  redirect to their new pages.

## v0.10.3 - 2026-09-25

### Changed

- Server telemetry names each request by the route it took instead of its
  raw URL: a language home, a part or top-level page, a chapter, a build file
  such as the search index, an asset by type, a legacy redirect, an API
  endpoint, or an unknown path that falls back to the home page. The name is
  the span name and the `http.route` attribute on traces and on the request
  metrics, which are recorded for every request, so traffic, errors and
  latency can now be split by route. A crawler composing URLs out of the home
  page's relative links had produced over ten thousand distinct operation
  names a day; those requests now appear together as `GET /{unknown}`.

## v0.10.2 - 2026-09-25

### Fixed

- The site went down after v0.10.0: the server compressed every response on
  the fly from a full in-memory copy of the file, and a few concurrent
  requests for the large search indexes (8.5 MB in Chinese) ran the pod past
  its 192 MiB memory limit, so it was killed and restarted in a loop. Pages
  and search indexes are now compressed once at build time and streamed as
  stored, and the pod's limits are raised to 512 MiB and one CPU.
- The book on the home page showed jagged edges while tilting. Its tilted
  layers now carry a transparent outline so their edges are smoothed.

### Changed

- Share cards for Slack, X and LinkedIn are redrawn in the site's ink palette
  with one red accent. Each keeps its content in the center square that
  Slack's thumbnail shows: the book's cover on the home card, the part,
  chapter number and title on a chapter card.

- Wiring the Application Stack is restructured as one arc: the reference
  architecture, the three paths, then one section per seam (model gateway,
  tool seam, retrieval and evidence, identity and credentials, telemetry),
  each holding its tools, configuration and contract, then the reference
  stacks and the integration release. It had been a concrete first half
  followed by a separate run of rules that revisited the same components.
  Its code example is vendor-neutral: an OpenAI-compatible client against the
  gateway and an MCP tool server over Streamable HTTP.
- The chapter's address is now practice/wiring-the-application-stack; the
  old addresses redirect to it.

## v0.10.1 - 2026-09-25

### Fixed

- On phones, the home page's title page repeated the cover's title,
  subtitle and author in large type directly under the cover. Stacked, it
  now shows only the reading actions and the edition details; the title
  remains the page's heading for screen readers.

## v0.10.0 - 2026-09-25

### Added

- A new Practice chapter, Wiring the Training Stack, assembles the stack a
  model builder runs: a reference architecture from data plane to release,
  the stages from pretraining to agentic RL, one section per seam (data
  plane, cluster and job, checkpoint store, rollout fleet, environments and
  verifiers, evaluation gate, release artifact) with its tools, configuration
  and contract, three reference stacks, the arithmetic of a run, and what
  releasing a model as a provider involves. It has a runnable simulation of
  synchronous against asynchronous RL. The theory chapters whose mechanisms
  it puts into practice now point to it.

### Changed

- Wiring the Stack is now titled Wiring the Application Stack, to pair with
  the new training chapter. Its address is unchanged; the Practice chapters
  after it are numbered one higher.
- The home page opens like a book: a title spread with the cover beside a
  title page (title, subtitle, author, a Start reading action, the edition,
  language and license), then the contents by part, then the Preface.
- The cover is drawn in SVG instead of two raster images, in the site's ink
  palette with one red accent, in both languages and both themes, and shows
  in full without script. The front is a cross-section of the book's parts
  from compute to governance with a capability's path through them; the back
  is an engineering drawing of a rack row with a title block. Hovering tilts
  the book toward the pointer; a click, a tap, Enter or Space turns it over.
  Under reduced motion it does not tilt, and the faces swap without turning.
- "On this page" starts closed on the home page, where it would cover the
  title spread.

## v0.9.7 - 2026-09-25

### Changed

- Callout text is set a step smaller and in a muted color, so it reads as an
  aside next to the body text. Where the window leaves a margin beside the
  text, the callout's label hangs in that margin as a marginal note.

## v0.9.6 - 2026-09-25

### Fixed

- Scrollbars in the reader, the sidebar's among them, were always visible,
  because the reader styled them and a styled scrollbar is never hidden. The
  style now applies only where the system shows scrollbars permanently;
  elsewhere they hide until scrolling, as the system does.

## v0.9.5 - 2026-09-25

### Added

- Every section heading ends in a link to that section. It appears on hover
  or keyboard focus (faintly on touch screens), puts the section's address in
  the address bar, and copies the full link, so a section can be shared and
  opens at its own position.

## v0.9.4 - 2026-09-25

### Fixed

- Bullets and numbers of top-level lists hung outside the text column, left
  of the section heading, since v0.9.1. Lists are indented inside the column
  again.

### Changed

- Callouts (the dated "As of" blocks, "What's contested" and "Constraint
  arrow") are set like a printed sidebar: a rule above, a small label, text a
  step smaller than the body and a hairline below, instead of a tinted box
  with a colored left bar.

## v0.9.3 - 2026-09-25

### Fixed

- The search field and the other header items moved sideways when the
  reading progress reached 100%, because the count was set in a box narrower
  than "100%". The count now keeps one width.

### Changed

- "On this page" shows its full list whenever it is open, at every window
  width; the header button opens and closes it. The title-only form that
  opened on hover is gone.

## v0.9.2 - 2026-09-25

### Fixed

- The header and sidebar moved with the page when it bounced at the top or
  bottom of a chapter. They are now fixed to the window, so only the page
  bounces.

### Changed

- "On this page" floats over the top right of the page instead of taking a
  column, so opening or closing it no longer moves the text. Where the full
  card would cover the ends of the text lines, it shows only its title and
  opens on hover, keyboard focus or a tap.

## v0.9.1 - 2026-09-25

### Changed

- The reading measure is wider: Codex, the default, sets 828 px of text in
  English and 756 px in Chinese, Manuscript 720 px and 684 px. Code cells,
  code blocks, tables and display math break out of the measure into the
  full column, up to 1,296 px: a code cell sets its code beside its output,
  and code blocks and tables grow only as far as their content needs.
- "On this page" is a card pinned to the top right, as tall as its list,
  instead of a full-height column with its own rule.

## v0.9.0 - 2026-09-25

### Fixed

- The Codex and Manuscript layouts rendered the same 640 px column at the
  default text size, because both widths fell below the column's minimum.
  Codex, the default, is now 756 px in English and 720 px in Chinese, and
  Manuscript 666 px and 648 px.
- A malformed response from the view counter made the reader fail after
  load and remove the chapter text from the page. The counts now render only
  from a well-formed response, and the account, view-count, bookmark and
  comment widgets each fail on their own without affecting the page.

### Changed

- Eight chapters outside the Practice part regain explanation and evidence
  the August 2026 rewrite had removed, each item checked and updated or
  dropped: Memory Systems, The Harness, Embeddings and Representation
  Learning, Security and Authorization, Benchmarks as Measurement Contracts,
  Evaluating Agents and Capabilities, Frameworks and Automatic
  Differentiation, and Compute Markets and Unit Economics.
  Each gains a runnable example that implements its mechanism and checks
  the result.
- Search opens with the pages read most recently, or starting pages on a
  first visit, and a row of suggested topics.
- Runnable Python cells show every figure a cell draws, in order, and play a
  matplotlib animation with the same play, pause, step and scrub controls as
  the book's figures, with a frame counter. Under reduced motion nothing plays
  and the step buttons move one frame at a time.
- The runnable cells across the book implement the mechanism of their
  section, draw the result, and check it against a closed form, an exact
  computation or a second method, instead of printing a few numbers. Among
  them: a BPE trainer and encoder, KV-cache decoding against full
  recomputation, a ring all-reduce, continuous batching until the knee,
  speculative decoding that matches the target distribution, a 2-D diffusion
  sampler, DPO converging to its closed-form optimum, tree search against a
  misleading heuristic, checkpointing under random failures, hybrid retrieval
  with rank fusion, a cluster bootstrap, and a sparse autoencoder recovering
  planted features. Cells that only restated a table or a figure were
  removed, and chapters whose mechanism is algorithmic and had no cell gained
  one.

## v0.8.0 - 2026-09-24

### Changed

- The eight Practice chapters regain the concrete material a rewrite in
  August 2026 had removed, each item checked against current sources and
  updated or dropped: comparison tables of hosted and open-weight models,
  serving engines, on-device runtimes, fine-tuning engines and managed
  services, queues, vector stores and evaluation tools, configuration
  examples and worked cost numbers. Wiring the Stack again draws a
  reference architecture with named components and adds reference stacks
  for three kinds of product. Their runnable examples now implement the
  mechanism they illustrate and check a result.
- The reading frame is flat and edge to edge: a 48 px sticky header, a
  navigation column on the left and an "On this page" column on the right,
  separated by 1 px rules, with no floating panels, article card or glass.
  The page itself scrolls, so elastic scrolling, scroll restoration, links
  to a section and find-in-page behave as in any web page. Body text is full
  contrast at about 70 characters per line, the "On this page" column moves
  into a drawer where it would narrow the article, phones get 16 px margins,
  and the chapter details, previous and next links, comments and page
  footer take less space.

## v0.7.0 - 2026-09-24

### Added

- Figures across the book are rebuilt on a native figure system: one
  TypeScript module per figure under `app/src/figures/`, rendered to SVG at
  build time for a script-free still and hydrated in the browser with
  controls, a play, pause and scrub timeline, and reduced-motion keyframes.
  Figures on measured data are regenerated by scripts under
  `tools/figure-data/`.
- Multi-Agent Systems covers large agent populations on shared
  infrastructure: channels formed through shared services, coordination
  with no designed topology, state that re-enters later runs, and agents
  that do not escalate to humans.
- Scalable Oversight and Control covers the 2026 alignment audits and
  control research beneath the evaluation incidents; Runtime Safety covers
  the containment lessons; the State of the Field page adds coordination,
  containment and disclosure items.

### Changed

- Graphviz diagrams lay out with the rendered font's metrics, scale to the
  column with an 11 px text floor, ship a narrow phone layout, and take their
  colors from theme tokens, so none scrolls sideways on a phone and dark mode
  covers every color.
- Mermaid is removed from the reader and its CDN loader is gone; lint and the
  tests reject a mermaid fence. Old canvas components are removed as their
  last embeds were replaced.
- `app/scripts/figure-shots.ts` requires a standalone headless Chrome and
  waits for every figure to hydrate.

### Fixed

- Figures that contradicted their captions or data are replaced, and two
  prose claims are corrected (the effect of a KL penalty on over-optimization,
  and when activity P90s add up).
- KaTeX square-root signs no longer collapse under the article's SVG sizing
  rule.

## v0.6.0 - 2026-09-23

### Changed

- Every chapter was reread for wording in English and Chinese: definitions are
  stated positively, slogans and contrast headings are plain claims, terms are
  defined at first use, and second-person address and emphasis-only bold are
  gone. The English text uses American spelling.
- The chapters on fast-moving topics carry evidence checked against primary
  sources as of September 2026, in marked "As of September 2026" blocks that a
  monthly refresh replaces. New material covers latent-space reasoning,
  test-time training, calibration rewards and TypeSafe AI's RLCD, recursive
  self-improvement and AI R&D thresholds, olympiad grading and formal
  verification at scale, evaluation incidents, coding agents, trained sparse
  attention, FP4 caches, current accelerators and export inputs, and the grid
  registration of large computing loads.

### Added

- A dated State of the Field page, `field/2026-09`, after the Epilogue, with
  every item linked to the chapter that explains it. Page URLs strip only a
  two-digit chapter ordinal, so monthly editions keep distinct addresses.
- A review date under every chapter title, read from
  `app/src/data/review-dates.json`, and a Techniques index on the glossary page
  driven by new `status`, `added` and `section` fields in `glossary.yml`.

### Fixed

- Chinese pages no longer show literal asterisks where bold closes next to
  full-width punctuation; the pipeline applies CJK-aware emphasis rules.
- Citation keys that named two different works are split, so each citation
  renders its own source; a test now fails when one key names two works.
  Reference summaries no longer stop at a percent sign.
- Factual corrections, among them METR's corrected time horizon for Claude
  Opus 4.5 (293 minutes, not 320), the compute-matched Chinchilla comparison,
  Kaplan's compute law, the vLLM PagedAttention kernel's removal, Hopper's
  confidential multi-GPU limits, and Chinese display math that now matches
  the English on every page.

### Tests

- Tests check English and Chinese parity (headings, anchors, citations,
  cross-references, display math, interactive figures), that every page
  renders without leaking markup, runnable cells, citations, and links. The
  roughly two hundred tests that pinned prose wording were removed, so a
  wording edit needs no test edit. Nothing changes for a reader.

## v0.5.0 - 2026-09-19

- The comment store serves through the family's database pooler. Serving
  traffic opens `DATABASE_POOL_URL` when the deployment carries it and falls
  back to `DATABASE_URL`, so an installation whose secret predates the pool
  starts unchanged. Migrations keep `DATABASE_URL`: they hold a lock across
  statements that a transaction pooler cannot keep on one connection. The
  pool's own size, and no longer this service's replica count, is its claim
  on the shared database. Nothing changes for a reader of the book.

## v0.4.0 - 2026-09-18

- A reader who administers the installation is recognised by the
  `platform_admin` role their sign-in carries, not by the account flag the
  family retired. Moderating another reader's comment needs that role; an
  organisation owner or admin has no say over the book's comments.
- A release refuses to cut while this repository's CI is red, and the
  refusal says who acts: a budget or policy stop is the maintainer's, a
  flake is re-run, a code failure is fixed and pushed first (ci-gate
  v0.42.0). Nothing changes for a reader of the book.
