// Browser telemetry for the deployed reader, through the shared client in
// latere-ui/telemetry. It records page loads, same-origin requests and Core
// Web Vitals as OpenTelemetry spans and posts them to the Go server's
// /v1/telemetry relay, which forwards them to the collector. The SDK loads
// only after the page has finished loading and gone idle.

import { startTelemetry } from "latere-ui/telemetry";

// Hosts that serve the book behind the relay, and the deployment each one is.
// Anywhere else (the dev server, a local `make serve`) has no collector behind
// the relay, so the reader reports nothing.
const DEPLOYMENTS: Record<string, string> = {
  "aaai.latere.ai": "production",
  "aaai-staging.latere.ai": "staging",
};

// deploymentFor names the deployment a host serves, or null where the reader
// should not report.
export function deploymentFor(hostname: string): string | null {
  return DEPLOYMENTS[hostname] ?? null;
}

// startReaderTelemetry starts reporting when the page is served by a deployed
// book. The service name follows the `<product>-web` rule for browser
// telemetry, apart from the server's own `aaai`.
export function startReaderTelemetry(): void {
  const environment = deploymentFor(location.hostname);
  if (environment) startTelemetry({ service: "aaai-web", environment });
}
