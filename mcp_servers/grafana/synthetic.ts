/**
 * Synthetic Grafana / Prometheus responses for use when GRAFANA_URL +
 * GRAFANA_API_TOKEN aren't both set. Shaped to support the oncall-companion's
 * triage flow: a small set of named metrics, each with a realistic
 * time-series and a couple of stored dashboards.
 */

export interface MetricSeries {
  metric: string;
  labels: Record<string, string>;
  /** [unix-seconds, value] pairs covering the last ~30 min in 30s buckets. */
  values: Array<[number, number]>;
}

export interface Dashboard {
  uid: string;
  title: string;
  tags: string[];
  panels: Array<{ title: string; query: string }>;
}

const now = Math.floor(Date.now() / 1000);
const bucket = (i: number) => now - (60 - i) * 30; // 60 30s buckets back, oldest first

function spikeSeries(base: number, spike_at: number, spike_height: number): MetricSeries["values"] {
  return Array.from({ length: 60 }, (_, i) => {
    const t = bucket(i);
    // gaussian-ish bump centered on spike_at
    const d = (i - spike_at) / 4;
    const v = base + spike_height * Math.exp(-d * d);
    return [t, Math.round(v * 100) / 100] as [number, number];
  });
}

export const metrics: MetricSeries[] = [
  {
    metric: "auth_service_p99_latency_ms",
    labels: { service: "auth-service", route: "/v1/biometric/validate" },
    values: spikeSeries(180, 45, 1000),
  },
  {
    metric: "auth_service_request_rate",
    labels: { service: "auth-service", route: "/v1/biometric/validate" },
    values: spikeSeries(120, 45, 30),
  },
  {
    metric: "flexpay_api_5xx_rate",
    labels: { service: "flexpay-api", route: "/plans" },
    values: spikeSeries(0.001, 50, 0.04),
  },
  {
    metric: "mobile_app_crash_rate_pct",
    labels: { service: "mobile-app", platform: "ios" },
    values: spikeSeries(0.4, 30, 0.0),
  },
];

export const dashboards: Dashboard[] = [
  {
    uid: "auth-latency",
    title: "Auth service latency + saturation",
    tags: ["auth", "oncall", "biometric"],
    panels: [
      { title: "p99 latency by route", query: "histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket{service='auth-service'}[1m])))" },
      { title: "Request rate by route", query: "sum by (route) (rate(http_requests_total{service='auth-service'}[1m]))" },
      { title: "Biometric library cache hit %", query: "sum(rate(biometric_lib_cache_hits[1m])) / sum(rate(biometric_lib_total[1m]))" },
    ],
  },
  {
    uid: "flexpay-product",
    title: "FlexPay plan creation health",
    tags: ["flexpay", "product", "oncall"],
    panels: [
      { title: "Plan-create error rate", query: "sum(rate(flexpay_plans_create_errors[1m])) / sum(rate(flexpay_plans_create_total[1m]))" },
      { title: "Plan-create p95", query: "histogram_quantile(0.95, sum by (le) (rate(flexpay_plans_create_duration_seconds_bucket[1m])))" },
    ],
  },
];

export function searchMetricsByName(query: string): MetricSeries[] {
  const q = query.toLowerCase();
  return metrics.filter((m) => m.metric.toLowerCase().includes(q));
}
