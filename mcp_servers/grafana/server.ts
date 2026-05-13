/**
 * grafana MCP server
 *
 * Read-only metrics access for the oncall-companion. Exposes:
 *   - query_metric (PromQL via Grafana's datasource proxy)
 *   - get_metric_series (one named metric over the last N minutes)
 *   - list_dashboards (find dashboards by tag or service)
 *   - get_dashboard (full panel list for one dashboard)
 *
 * Operational modes:
 *   - GRAFANA_URL + GRAFANA_API_TOKEN unset → SYNTHETIC mode with a small
 *     time-series fixture matching the oncall scenario.
 *   - Both set → live read via Grafana's `/api/datasources/proxy` endpoint.
 *
 * Read-only on purpose — no write tools exposed.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { makeLogger } from "../_shared/logger.js";
import { LRUCache } from "../_shared/cache.js";
import { retry, RetryableHttpError } from "../_shared/retry.js";
import { metrics as synthMetrics, dashboards as synthDashboards, searchMetricsByName } from "./synthetic.js";

const log = makeLogger("grafana");
const URL_BASE = process.env.GRAFANA_URL;
const TOKEN = process.env.GRAFANA_API_TOKEN;
const DEFAULT_DS = Number(process.env.GRAFANA_PROM_DATASOURCE_ID ?? "1");
const SYNTHETIC = !(URL_BASE && TOKEN);
const FETCH_TIMEOUT_MS = Number(process.env.GRAFANA_FETCH_TIMEOUT_MS ?? "15000");

const dashboardCache = new LRUCache<string, unknown>({ capacity: 16, ttlMs: 5 * 60 * 1000 });

async function grafanaFetch<T>(path: string, op = "grafana"): Promise<T> {
  return retry(
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${URL_BASE}${path}`, {
          signal: ctrl.signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${TOKEN}`,
            "User-Agent": "enterprise-coordination-grafana",
          },
        });
        if (res.ok) return (await res.json()) as T;
        if (res.status === 429) {
          const ra = res.headers.get("Retry-After");
          throw new RetryableHttpError(429, `grafana ${path}`, ra ? Number(ra) * 1000 : undefined);
        }
        if (res.status >= 500) throw new RetryableHttpError(res.status, `grafana ${path} ${res.status}`);
        const body = await res.text();
        throw new Error(`grafana ${path} ${res.status}: ${body.slice(0, 200)}`);
      } finally {
        clearTimeout(timer);
      }
    },
    { logger: log, operationName: op },
  );
}

const server = new McpServer({ name: "grafana", version: "0.1.0" });

server.tool(
  "health_check",
  "Verify grafana MCP server is reachable. Returns mode and (in live mode) Grafana health endpoint result.",
  {},
  async () => {
    const base = { mode: SYNTHETIC ? "synthetic" : "live", url: URL_BASE ?? "(synthetic)" } as Record<string, unknown>;
    if (SYNTHETIC) {
      return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", synthetic_metrics: synthMetrics.length, synthetic_dashboards: synthDashboards.length }, null, 2) }] };
    }
    try {
      const h = await grafanaFetch<{ database: string; version: string }>("/api/health", "health");
      return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", grafana_version: h.version }, null, 2) }] };
    } catch (err) {
      throw new McpError(ErrorCode.InternalError, `grafana health check failed: ${(err as Error).message}`);
    }
  },
);

server.tool(
  "get_metric_series",
  "Fetch the recent values of one metric over the last 30 minutes. Returns timestamps + values. Use this when triaging a page to confirm the alert with real data.",
  {
    metric: z.string().min(1).describe("Metric name, e.g. 'auth_service_p99_latency_ms'"),
    minutes: z.number().int().positive().max(720).default(30),
  },
  async ({ metric, minutes }) => {
    if (SYNTHETIC) {
      const hits = synthMetrics.filter((m) => m.metric === metric);
      if (hits.length === 0) {
        const available = synthMetrics.map((m) => m.metric);
        throw new McpError(
          ErrorCode.InvalidParams,
          `metric '${metric}' not found in synthetic fixtures. Available: ${available.join(", ")}`,
        );
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mode: "synthetic",
                metric,
                window_minutes: minutes,
                series: hits.map((h) => ({ labels: h.labels, points: h.values })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }
    const end = Math.floor(Date.now() / 1000);
    const start = end - minutes * 60;
    const step = Math.max(15, Math.floor((minutes * 60) / 60));
    const promQL = `${metric}`;
    const path = `/api/datasources/proxy/${DEFAULT_DS}/api/v1/query_range?query=${encodeURIComponent(promQL)}&start=${start}&end=${end}&step=${step}`;
    type PromRes = { data: { result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }> } };
    const res = await grafanaFetch<PromRes>(path, "query_range");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "live",
              metric,
              window_minutes: minutes,
              series: res.data.result.map((r) => ({
                labels: r.metric,
                points: r.values.map(([t, v]) => [t, parseFloat(v)]),
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "search_metrics",
  "Search known metric names by substring. Use this when you don't know the exact metric name to query.",
  { query: z.string().min(1) },
  async ({ query }) => {
    if (SYNTHETIC) {
      const hits = searchMetricsByName(query).map((m) => ({ metric: m.metric, labels: m.labels }));
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", query, hit_count: hits.length, hits }, null, 2) }] };
    }
    type Labels = { data: string[] };
    const res = await grafanaFetch<Labels>(`/api/datasources/proxy/${DEFAULT_DS}/api/v1/label/__name__/values`, "metric.names");
    const q = query.toLowerCase();
    const hits = res.data.filter((m) => m.toLowerCase().includes(q)).slice(0, 50).map((m) => ({ metric: m }));
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", query, hit_count: hits.length, hits }, null, 2) }] };
  },
);

server.tool(
  "list_dashboards",
  "List Grafana dashboards, optionally filtered by tag. Cached 5 min.",
  { tag: z.string().optional() },
  async ({ tag }) => {
    const key = `dashboards|${tag ?? ""}`;
    if (SYNTHETIC) {
      const hits = synthDashboards.filter((d) => !tag || d.tags.includes(tag));
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", dashboards: hits.map((d) => ({ uid: d.uid, title: d.title, tags: d.tags })) }, null, 2) }] };
    }
    const cached = dashboardCache.get(key);
    if (cached) {
      return { content: [{ type: "text", text: JSON.stringify({ mode: "live", dashboards: cached, cache: "hit" }, null, 2) }] };
    }
    const path = tag ? `/api/search?tag=${encodeURIComponent(tag)}&type=dash-db` : `/api/search?type=dash-db`;
    type DashList = Array<{ uid: string; title: string; tags: string[] }>;
    const list = await grafanaFetch<DashList>(path, "dashboards.list");
    dashboardCache.set(key, list);
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", dashboards: list }, null, 2) }] };
  },
);

server.tool(
  "get_dashboard",
  "Fetch one dashboard by uid, including panel titles + queries.",
  { uid: z.string().min(1) },
  async ({ uid }) => {
    if (SYNTHETIC) {
      const d = synthDashboards.find((x) => x.uid === uid);
      if (!d) {
        throw new McpError(ErrorCode.InvalidParams, `dashboard uid '${uid}' not found. Available: ${synthDashboards.map((x) => x.uid).join(", ")}`);
      }
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", dashboard: d }, null, 2) }] };
    }
    type Dash = { dashboard: { uid: string; title: string; tags: string[]; panels: Array<{ title: string; targets?: Array<{ expr?: string }> }> } };
    const res = await grafanaFetch<Dash>(`/api/dashboards/uid/${encodeURIComponent(uid)}`, "dashboard.get");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "live",
              dashboard: {
                uid: res.dashboard.uid,
                title: res.dashboard.title,
                tags: res.dashboard.tags,
                panels: res.dashboard.panels.map((p) => ({
                  title: p.title,
                  query: p.targets?.[0]?.expr ?? "",
                })),
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

log.info({ mode: SYNTHETIC ? "synthetic" : "live" }, `grafana MCP server starting`);
await server.connect(new StdioServerTransport());
