type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Chaves cujo valor nunca deve aparecer em log. */
const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|api[-_]?key|cookie|email|cpf|card/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message, ...(redact({ ...value }, depth + 1) as object) };
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(inner, depth + 1);
  }
  return out;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(
  bindings: Record<string, unknown> = {},
  options: { minLevel?: Level; write?: (line: string) => void } = {},
): Logger {
  const minLevel = options.minLevel ?? ((process.env.LOG_LEVEL as Level | undefined) ?? 'info');
  const write = options.write ?? ((line: string) => console.log(line));

  const log = (level: Level, message: string, context?: Record<string, unknown>) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      message,
      ...(redact(bindings) as object),
      ...(context ? (redact(context) as object) : {}),
    };
    write(JSON.stringify(entry));
  };

  return {
    debug: (m, c) => log('debug', m, c),
    info: (m, c) => log('info', m, c),
    warn: (m, c) => log('warn', m, c),
    error: (m, c) => log('error', m, c),
    child: (more) => createLogger({ ...bindings, ...more }, options),
  };
}

export const logger = createLogger({ app: 'tabelinha' });
