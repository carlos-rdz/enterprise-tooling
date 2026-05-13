/**
 * Shared structured logger for all MCP servers.
 *
 * pino writes JSON to stderr so it doesn't interfere with stdio MCP transport
 * on stdout. Level is controlled via LOG_LEVEL env (debug/info/warn/error).
 * Default is `info`.
 */

import pino, { type Logger } from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export function makeLogger(serverName: string): Logger {
  return pino(
    {
      level,
      base: { server: serverName, pid: process.pid },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    pino.destination(2), // stderr — must not pollute MCP stdout
  );
}
