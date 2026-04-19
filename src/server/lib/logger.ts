/**
 * Structured logging utility with correlation IDs for production debugging.
 *
 * Features:
 * - Environment-aware formatting (JSON in prod, colorized in dev)
 * - Log level filtering via LOG_LEVEL env var
 * - Child loggers for adding context
 * - Correlation IDs for tracing requests/jobs
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  module?: string;
  jobId?: string;
  clientId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
  child: (additionalContext: LogContext) => Logger;
}

// Environment detection
const isProd = process.env.NODE_ENV === "production";
const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

// Log level priority for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Determines if a log entry should be emitted based on current log level.
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel];
}

// ANSI color codes for dev output
const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
} as const;

/**
 * Formats a log entry for output.
 * - Production: JSON for log aggregation
 * - Development: Colorized human-readable format
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext,
  data?: Record<string, unknown>,
  error?: Error,
): string {
  const timestamp = new Date().toISOString();
  const moduleName = context.module || "app";

  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp,
    ...context,
    ...data,
  };

  if (error) {
    entry.error = error.message;
    entry.stack = error.stack;
  }

  if (isProd) {
    return JSON.stringify(entry);
  }

  // Dev: colorized pretty print
  const color = COLORS[level];
  const levelPadded = level.toUpperCase().padEnd(5);
  const moduleTag = `[${moduleName}]`;

  // Build data string if present
  let dataStr = "";
  const extraData = { ...data };
  if (error) {
    extraData.error = error.message;
  }
  if (Object.keys(extraData).length > 0) {
    dataStr = ` ${COLORS.dim}${JSON.stringify(extraData)}${COLORS.reset}`;
  }

  return `${COLORS.dim}${timestamp}${COLORS.reset} ${color}${levelPadded}${COLORS.reset} ${moduleTag} ${message}${dataStr}`;
}

/**
 * Creates a structured logger with correlation context.
 *
 * @param context - Static context fields included in every log entry (jobId, clientId, etc.)
 * @returns Logger instance with info, error, warn, debug, and child methods
 *
 * @example
 * const logger = createLogger({ module: 'audit-worker', jobId: job.id });
 * logger.info('Processing started', { mode: 'incremental' });
 * logger.error('API call failed', error, { endpoint: '/api/gsc' });
 *
 * // Create child logger with additional context
 * const childLogger = logger.child({ step: 'discovery' });
 */
export function createLogger(context: LogContext = {}): Logger {
  const logger: Logger = {
    info: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog("info")) {
        // eslint-disable-next-line no-console
        console.log(formatLogEntry("info", message, context, data));
      }
    },

    error: (message: string, error?: Error, data?: Record<string, unknown>) => {
      if (shouldLog("error")) {
        // eslint-disable-next-line no-console
        console.error(formatLogEntry("error", message, context, data, error));
      }
    },

    warn: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog("warn")) {
        // eslint-disable-next-line no-console
        console.warn(formatLogEntry("warn", message, context, data));
      }
    },

    debug: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog("debug")) {
        // eslint-disable-next-line no-console
        console.log(formatLogEntry("debug", message, context, data));
      }
    },

    child: (additionalContext: LogContext): Logger => {
      return createLogger({ ...context, ...additionalContext });
    },
  };

  return logger;
}

/**
 * Default logger instance for module-level logging without specific context.
 * Use createLogger() for contexts that need jobId, clientId, etc.
 */
export const defaultLogger = createLogger({ module: "open-seo" });

/**
 * Global app logger - convenience export for quick imports.
 * Equivalent to defaultLogger but with a more intuitive name.
 */
export const logger = defaultLogger;
