type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function serializeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
    };
  }
  return { error_message: String(error) };
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  const payload = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export const log = {
  info(event: string, fields?: LogFields): void {
    emit("info", event, fields);
  },
  warn(event: string, fields?: LogFields): void {
    emit("warn", event, fields);
  },
  error(event: string, fields?: LogFields, error?: unknown): void {
    emit("error", event, {
      ...fields,
      ...(error !== undefined ? serializeError(error) : {}),
    });
  },
};
