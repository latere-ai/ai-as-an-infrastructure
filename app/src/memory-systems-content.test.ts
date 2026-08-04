import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/orchestration/03-memory-systems.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/memory-systems.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter separates execution, workspace, memory, and external state", () => {
  for (const phrase of [
    "execution history",
    "workspace",
    "long-term memory",
    "external systems",
    "system of record",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the state an agent leaves behind comes in three shapes");
});

test("durable replay records unknown outcomes instead of claiming exactly-once effects", () => {
  for (const phrase of [
    "outcome is unknown",
    "at-least-once",
    "at-most-once",
    "idempotency key",
    "reconciliation",
    "compensation",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("gap closed");
  expect(flat).not.toContain("durable step log closes the gap");
});

test("replay is deterministic and binds executions to code versions", () => {
  for (const phrase of [
    "deterministic replay",
    "workflow version",
    "recorded result",
    "non-deterministic",
  ]) expect(flat).toContain(phrase);
});

test("the effect protocol binds a stable key to the requested input", () => {
  for (const phrase of [
    "stable across retries",
    "input fingerprint",
    "tenant",
    "retention",
    "lookup",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("idempotency_key=key");
});

test("workspace guarantees distinguish lifetime, topology, snapshots, and consistency", () => {
  for (const phrase of [
    "volume lifetime",
    "access mode",
    "topology",
    "reclaim policy",
    "recovery point objective",
    "copy-on-write",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("\\frac{\\Delta}{2}");
  expect(flat).not.toContain("a readwriteonce pvc is backed by a zonal block device");
});

test("replay, rewind, and fork have different state semantics", () => {
  for (const phrase of [
    "replay",
    "rewind",
    "fork",
    "shared ancestor",
    "semantic merge",
    "external side effects",
  ]) expect(flat).toContain(phrase);
});

test("memory is a governed write-manage-read loop rather than a vector database", () => {
  for (const phrase of [
    "write policy",
    "provenance",
    "validity",
    "supersedes",
    "retrieval policy",
    "deletion",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the base layer is a vector store");
});

test("memory evaluation covers abilities, isolation, and operating cost", () => {
  for (const phrase of [
    "knowledge updates",
    "abstention",
    "selective forgetting",
    "same model checkpoint",
    "cross-tenant",
    "latency",
    "token cost",
  ]) expect(flat).toContain(phrase);
});

test("the evidence trail uses primary or official sources", () => {
  for (const marker of [
    "docs.aws.amazon.com",
    "kubernetes.io/docs",
    "proceedings.iclr.cc",
    "aclanthology.org/2024.acl-long.747",
    "10.1145/3586183.3606763",
  ]) expect(bibliography).toContain(marker);
  expect(flat).not.toContain("reported agent retry rates of 15 to 30 percent");
  expect(flat).not.toContain("the pattern is no longer framework-specific");
});

test("synthetic evidence and false product history are removed", () => {
  for (const phrase of [
    "/figures/memory-systems-1.svg",
    "openai's codex cli",
    "dominant failure is zone scoping",
    "session stopped being a list",
    "filter-at-read-time is one bug away",
  ]) expect(flat).not.toContain(phrase);
});
