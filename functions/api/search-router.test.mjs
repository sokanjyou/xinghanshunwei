import assert from "node:assert/strict";
import test from "node:test";

import { parseClassifierOutput, precheckSearch, routeSearch } from "./search-router.js";

test("freshness and explicit-search phrases bypass the classifier", async () => {
  let classifierCalls = 0;
  const classify = async () => {
    classifierCalls += 1;
    return { needsSearch: false, query: "" };
  };

  for (const text of ["比特币现在多少钱", "今天东京天气", "帮我上网查一下量子计算新闻", "2025 年的新政策"]) {
    const route = await routeSearch({ text, messages: [], classify });
    assert.equal(route.needsSearch, true, text);
  }
  assert.equal(classifierCalls, 0);
});

test("casual messages bypass the classifier without searching", async () => {
  const result = await routeSearch({
    text: "你好！",
    messages: [],
    classify: async () => assert.fail("classifier should not run")
  });
  assert.equal(result.needsSearch, false);
  assert.equal(result.reason, "casual");
});

test("uncertain messages use the LLM decision and optimized query", async () => {
  const result = await routeSearch({
    text: "MiniCPM-o 是谁开发的？",
    messages: [],
    classify: async () => ({ needsSearch: true, query: "MiniCPM-o developer organization" })
  });
  assert.deepEqual(result, {
    needsSearch: true,
    query: "MiniCPM-o developer organization",
    reason: "llm_classifier"
  });
});

test("classifier JSON parser accepts fenced output and rejects missing decisions", () => {
  assert.deepEqual(
    parseClassifierOutput("```json\n{\"needs_search\":true,\"search_query\":\"Bitcoin current price USD\"}\n```", "fallback"),
    { needsSearch: true, query: "Bitcoin current price USD" }
  );
  assert.throws(() => parseClassifierOutput("{\"search_query\":\"x\"}", "fallback"));
});

test("precheck leaves stable knowledge questions to the classifier", () => {
  assert.equal(precheckSearch("解释一下什么是傅里叶变换").decision, null);
});
