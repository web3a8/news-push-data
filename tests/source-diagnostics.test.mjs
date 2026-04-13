import test from "node:test";
import assert from "node:assert/strict";

import { HttpStatusError, classifyFetchFailure } from "../scripts/utils/source-diagnostics.mjs";

test("classifyFetchFailure marks HTTP 403 as access denied", () => {
  const failure = classifyFetchFailure(new HttpStatusError(403, "https://example.com/feed.xml"));

  assert.equal(failure.category, "access_denied");
  assert.equal(failure.detail, "HTTP 403");
  assert.equal(failure.httpStatus, 403);
});

test("classifyFetchFailure marks entity expansion failures separately", () => {
  const failure = classifyFetchFailure(new Error("Entity expansion limit exceeded: 1160 > 1000"));

  assert.equal(failure.category, "xml_entity_limit");
  assert.match(failure.detail, /Entity expansion limit exceeded/);
});
