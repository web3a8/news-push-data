export function section(title) {
  console.log(`[stage] ${title}`);
}

export function info(message) {
  console.log(message);
}

export function ok(message) {
  console.log(`[ok] ${message}`);
}

export function warn(message) {
  console.warn(`[warn] ${message}`);
}

export function formatError(error) {
  if (!error) {
    return "unknown error";
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return "timeout";
  }

  return error.message || String(error);
}
