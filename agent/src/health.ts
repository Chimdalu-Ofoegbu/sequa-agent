// health.ts
// The D-38 observability endpoint: a tiny HTTP server exposing GET /healthz, plus the shared mutable
// status object the poll loop updates each tick. UptimeRobot (or any external pinger) hits /healthz
// and alerts if lastTickAt goes stale (> ~3× the 30s poll), catching the silent-VPS-dead scenario
// before demo day (Pitfall 5).
//
// The response contract (D-38):
//   { lastTickAt, lastSignalAt, fallbackRate, paused }
//     - lastTickAt    ISO-8601 of the most recent poll tick (liveness; staleness = hung loop)
//     - lastSignalAt  ISO-8601 of the most recent recorded signal (null until the first signal)
//     - fallbackRate  fraction of narrations that fell back to fallbackThesis (quality signal, AI-SPEC §7)
//     - paused        the agent's own pause flag (D-11)

import { createServer, type Server } from 'node:http';

/** The shared liveness/quality status the poll loop mutates and /healthz serializes. */
export interface HealthStatus {
  /** ISO-8601 of the last completed poll tick (null before the first tick). */
  lastTickAt: string | null;
  /** ISO-8601 of the last recorded signal (null until the first signal). */
  lastSignalAt: string | null;
  /** Total narrations attempted (for fallbackRate). */
  narrationsTotal: number;
  /** Narrations that fell back to fallbackThesis (validation/fidelity/phrase/call failures). */
  narrationsFallback: number;
  /** The agent pause flag (D-11). When true, the loop skips trading. */
  paused: boolean;
}

/** A fresh, zeroed status object. The loop owns and mutates this; /healthz reads it. */
export function createHealthStatus(): HealthStatus {
  return {
    lastTickAt: null,
    lastSignalAt: null,
    narrationsTotal: 0,
    narrationsFallback: 0,
    paused: false,
  };
}

/** The /healthz JSON shape (D-38). fallbackRate is derived from the counters. */
export interface HealthResponse {
  lastTickAt: string | null;
  lastSignalAt: string | null;
  fallbackRate: number;
  paused: boolean;
}

/** Project the mutable status into the public /healthz response (derives fallbackRate). */
export function toHealthResponse(status: HealthStatus): HealthResponse {
  const fallbackRate =
    status.narrationsTotal > 0 ? status.narrationsFallback / status.narrationsTotal : 0;
  return {
    lastTickAt: status.lastTickAt,
    lastSignalAt: status.lastSignalAt,
    fallbackRate: Number(fallbackRate.toFixed(4)),
    paused: status.paused,
  };
}

/**
 * startHealthServer — boot the /healthz HTTP server reading from the shared `status` object the loop
 * updates. Returns the Node Server so the caller can close it on shutdown. Any non-/healthz path 404s.
 */
export function startHealthServer(status: HealthStatus, port: number): Server {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      const body = JSON.stringify(toHealthResponse(status));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });
  server.listen(port, () => {
    console.log({ event: 'health_server_listening', port, path: '/healthz' });
  });
  return server;
}
