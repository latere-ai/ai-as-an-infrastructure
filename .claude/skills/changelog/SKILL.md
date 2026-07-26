---
name: changelog
description: Update the book's reader-facing changelog page (en/changelog.qmd and zh/changelog.qmd) with a new weekly entry generated from git history. Use when asked to "update the changelog", "add this week to the changelog", after a batch of book work lands, or before cutting a release. Writes both language twins, marks released versions, and verifies the build.
---

# Weekly changelog

The book ships continuously, so readers need a page that answers two questions:
did the chapter I read change, and is anything new worth coming back for. That
page is `en/changelog.qmd` and its twin `zh/changelog.qmd`. This skill adds one
week to it.

## The rule that decides everything

**Write for readers of the book, not for contributors.** They do not know what a
commit is, do not care about refactors, test baselines, CI, deploy manifests or
lint rules, and will never open the repository. Every entry is a translation from
engineering history into reader-visible change.

| Commit subject | Not an entry | An entry |
| --- | --- | --- |
| `refs: escape % in bibliography text fields` | "Escaped percent signs in BibTeX" | "Reference summaries were being cut off at the first percent sign and now read in full" |
| `ci: run bun test` | "Added bun test to CI" | omit, or fold into the week's opening sentence |
| `book: split Part IX` | "Split Part IX into two parts" | "Part IX had grown into two parts under one name. Infrastructure and Compute keeps the substrate chapters; a new Part X, Frontiers and Limits, takes the three about what compute converts into. Old links redirect." |

A week whose work was entirely internal gets **one honest sentence** saying the
machinery moved, not a bulleted list of it.

## Steps

1. **Find the boundary.** Read the top entry's date range in `en/changelog.qmd`.
   The new week starts the day after it ends. Weeks run Monday to Sunday.

2. **Collect the history.**
   ```sh
   git log --since=<start> --until=<end+1day> --format='%h %ad %s' --date=short
   git log --since=<start> --until=<end+1day> --format='%h %s%n%b' --date=short
   ```
   Read the diff of anything whose subject is opaque or looks reader-visible:
   `git show --stat <sha>`, then `git show <sha>`. **Trust the diff over the
   subject line when they disagree.** Commit subjects overstate and understate.

3. **Check for a release.** `git tag --contains <first sha of the week>` or
   `git log --oneline --decorate <range>`. If a version was tagged, say so in the
   opening sentence: "Released as v0.2.0."

4. **Write the entry** in the format below, in English, then write the Chinese
   twin. Invoke the `prose-style` skill first, and read `CONVENTIONS.md` for
   voice. The ZH entry is the same entry written natively in Chinese, not a
   translation of the English sentences: same structure, same claims, same bullet
   count, full-width punctuation, code and version numbers byte-verbatim.

5. **Insert at the top**, directly under the page's intro paragraph and above the
   previous week. The page is reverse chronological.

6. **Verify**: `make build` must compile both books, and `cd app && bun test`
   must stay green. Then commit both files together:
   `git add en/changelog.qmd zh/changelog.qmd`.

## Entry format

```markdown
## <Month D to D, YYYY>

<One or two sentences on what the week was about, in plain language. Most
readers read only this. If a version shipped, say so here.>

**New**

- <chapter or section added, by its title, and one clause on what question it answers>

**Changed**

- <restructuring, renaming or reworking a reader would notice>

**Corrected**

- <a claim that was wrong and now is not, stated plainly enough that a reader who
  believed the old text learns they should not have>
```

ZH headings are `**新增**`, `**调整**`, `**更正**`, and the ZH date heading reads
`## 2026 年 7 月 20 日至 26 日`.

## Rules for the body

- **Omit an empty group.** Never write "None".
- **Name chapters and parts by title**, never by file path or chapter number, and
  never with `@sec` references. The page sits outside the numbered chapter flow.
- **Five to twelve bullets for a heavy week**, fewer for a light one. Merge
  related commits into one bullet. Never enumerate every commit.
- **Corrections are the most valuable group** for a reader who already read the
  book. Do not bury them under New, do not soften them, and do not omit one
  because it is embarrassing. If a number was wrong, say what it was and what it
  is.
- **Do not sell.** No "comprehensive", no "exciting", no "we are thrilled". A
  changelog that praises its own additions reads as marketing and stops being
  trusted.
- **No em dashes**, no filler openings, no intensifiers. Complete declarative
  sentences.
- **Skip a dead week.** If nothing reader-visible happened, add no entry rather
  than manufacturing one. Gaps in the dates are honest; padding is not.

## Where this fits

`en/book.yml` and `zh/book.yml` list `changelog.qmd` among the back-matter pages
alongside `glossary.qmd` and `references.qmd`, so it renders at
`/{lang}/changelog` and appears in the sidebar. Nothing generates the page: the
entries are the source. If you find yourself wanting a data file or a build-time
generator for it, that is a change of design, not a step in this skill.
