# Changelog

Every tag has a section here, and the section is the body of the GitHub
release. A tag without one is refused at the pre-push and fails the release
workflow. Write under `Unreleased` as work lands; `lateregate release vX.Y.Z`
turns that into the tag's section, commits, tags and pushes.

A section says what changed for whoever uses the release, not what was
committed: the commit log already holds that.

## Unreleased

- A reader who administers the installation is recognised by the
  `platform_admin` role their sign-in carries, not by the account flag the
  family retired. Moderating another reader's comment needs that role; an
  organisation owner or admin has no say over the book's comments.
- A release refuses to cut while this repository's CI is red, and the
  refusal says who acts: a budget or policy stop is the maintainer's, a
  flake is re-run, a code failure is fixed and pushed first (ci-gate
  v0.42.0). Nothing changes for a reader of the book.
