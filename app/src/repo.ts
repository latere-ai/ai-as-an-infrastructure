// The book is open source, so every page can point at the file behind it. One
// place holds the repository address and the two deep links a reader needs: an
// issue prefilled with the chapter they were reading, and GitHub's editor open
// on that chapter's source.

export const REPO_URL = "https://github.com/latere-ai/ai-as-an-infrastructure";

/** GitHub's web editor for one source file, on the default branch. */
export function editUrl(sourcePath: string): string {
  return `${REPO_URL}/edit/main/${sourcePath}`;
}

/**
 * A new issue, prefilled with the chapter as the title and the page address in
 * the body, so a report arrives already saying which page it is about. The
 * reader still types what is wrong; the routing is done for them.
 */
export function issueUrl(title: string, pageUrl: string): string {
  const q = new URLSearchParams({ title, body: `\n\n${pageUrl}\n` });
  return `${REPO_URL}/issues/new?${q}`;
}
