import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchContext,
  parseClassifierOutput,
  precheckSearch,
  routeSearch,
  sanitizeUserFacingContent
} from "./search-router.js";

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

test("search citations never leak into the user-facing answer", () => {
  assert.equal(sanitizeUserFacingContent("结论 [1]，补充【2、3】。"), "结论，补充。");
  const context = buildSearchContext({
    results: [{ title: "Example", url: "https://example.com", content: "A result" }]
  });
  assert.equal(context.includes("[1]"), false);
});

test("sources, URLs, and half-width hyphens are removed from answers", () => {
  assert.equal(
    sanitizeUserFacingContent("结论如下\n- 第一项\n来源：https://example.com/a-b"),
    "结论如下\n第一项"
  );
});
