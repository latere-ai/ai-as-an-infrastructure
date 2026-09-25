// The reader reports only from the hosts that serve the book behind the relay;
// the dev server and local runs have no collector behind it.

import { test, expect } from "bun:test";
import { deploymentFor } from "./telemetry.ts";

test("reports from the deployed hosts only", () => {
  expect(deploymentFor("aaai.latere.ai")).toBe("production");
  expect(deploymentFor("aaai-staging.latere.ai")).toBe("staging");
  for (const host of ["localhost", "127.0.0.1", "latere.ai", "aaai.latere.ai.example.com", "evil-aaai.latere.ai"]) {
    expect(deploymentFor(host)).toBeNull();
  }
});
