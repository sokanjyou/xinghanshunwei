import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "./chat.js";

const makeRequest = (content) => new Request("https://xinghanshunwei.top/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Origin": "https://xinghanshunwei.top"
  },
  body: JSON.stringify({ messages: [{ role: "user", content }] })
});

test("image requests retry with the vision fallback when thinking cleanup is empty", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const body = JSON.parse(options.body);
    calls.push({ url: String(url), body });
    if (calls.length === 1) {
      return Response.json({
        choices: [{ message: { content: "{\"needs_search\":false,\"search_query\":\"\"}" } }]
      });
    }
    if (calls.length === 2) {
      return Response.json({ choices: [{ message: { content: "<think>分析图片中</think>" } }] });
    }
    return Response.json({
      choices: [{ message: { content: [{ type: "text", text: "图片中有一个蓝色方块。" }] } }]
    });
  };

  try {
    const response = await onRequestPost({
      request: makeRequest([
        { type: "text", text: "请分析这张图片。" },
        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } }
      ]),
      env: { MINICPM_API_KEY: "test", RATE_LIMIT_PER_MINUTE: "0" }
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.content, "图片中有一个蓝色方块。");
    assert.equal(calls[1].body.model, "MiniCPM-o-4.5");
    assert.equal(calls[2].body.model, "MiniCPM-V-4.6-Instruct");
    assert.equal(calls[2].body.messages[1].content[1].type, "image_url");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retryable upstream failures switch to the fallback text model", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const body = JSON.parse(options.body);
    calls.push({ url: String(url), body });
    if (calls.length === 1) {
      return Response.json({ error: { message: "model busy" } }, { status: 503 });
    }
    return Response.json({
      choices: [{ message: { content: "你好，我可以继续为你服务。" } }]
    });
  };

  try {
    const response = await onRequestPost({
      request: makeRequest("你好"),
      env: { MINICPM_API_KEY: "test", RATE_LIMIT_PER_MINUTE: "0" }
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.content, "你好，我可以继续为你服务。");
    assert.equal(calls[0].body.model, "MiniCPM-o-4.5");
    assert.equal(calls[1].body.model, "MiniCPM-V-4.6-Instruct");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
