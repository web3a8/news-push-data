export function toIsoString(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

export function isRecentDate(isoString, nowIsoString, windowHours) {
  if (!isoString) {
    return false;
  }

  const articleTime = Date.parse(isoString);
  const nowTime = Date.parse(nowIsoString);
  const windowMs = windowHours * 60 * 60 * 1000;

  if (Number.isNaN(articleTime) || Number.isNaN(nowTime)) {
    return false;
  }

  return articleTime >= nowTime - windowMs;
}

export function comparePublishedDesc(left, right) {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  const leftValid = !Number.isNaN(leftTime);
  const rightValid = !Number.isNaN(rightTime);

  if (leftValid && rightValid) {
    return rightTime - leftTime;
  }

  if (leftValid) {
    return -1;
  }

  if (rightValid) {
    return 1;
  }

  return 0;
}
