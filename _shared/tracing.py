"""
Shared OpenTelemetry tracer setup.

By default uses the ConsoleSpanExporter — every span is printed to stderr as
JSON-ish text. In production you'd swap this for an OTLP exporter pointed at
your collector (Honeycomb, Tempo, Datadog APM, etc.) by setting:

    OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.example.com:4317

and replacing `ConsoleSpanExporter` with `OTLPSpanExporter` from
`opentelemetry.exporter.otlp.proto.grpc.trace_exporter`. The agent code
doesn't change — it just calls `get_tracer()` and uses `start_as_current_span`.

Disabled entirely when OTEL_DISABLED=true (use this in CI to keep test output
clean).
"""

from __future__ import annotations

import os
import sys
from typing import Any

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

_INITIALIZED = False


def setup_tracing(service_name: str) -> trace.Tracer:
    """Configure global tracer provider once per process and return a tracer."""
    global _INITIALIZED
    if os.environ.get("OTEL_DISABLED") == "true":
        return trace.get_tracer(service_name)

    if not _INITIALIZED:
        provider = TracerProvider(
            resource=Resource.create(
                {
                    "service.name": service_name,
                    "service.version": "0.3.0",
                    "deployment.environment": os.environ.get("ENVIRONMENT", "local"),
                }
            )
        )
        # ConsoleSpanExporter writes to stderr by default — keeps stdout clean
        # for the agent's user-facing output.
        exporter = ConsoleSpanExporter(out=sys.stderr)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        _INITIALIZED = True

    return trace.get_tracer(service_name)


def safe_attr(value: Any) -> str | int | float | bool:
    """Coerce arbitrary values to OTel-attribute-safe types."""
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)
