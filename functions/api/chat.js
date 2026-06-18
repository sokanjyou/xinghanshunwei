const DEFAULT_ALLOWED_ORIGINS = [
  "https://xinghanshunwei.top",
  "https://www.xinghanshunwei.top"
];

const DEFAULT_SYSTEM_PROMPT = [
  "你是星瀚顺为 AI 官网的实时咨询助手。",
  "你帮助用户围绕企业数字化、工业 AI、定制机器人、区块链可信协同、系统集成与项目落地进行清晰、务实的沟通。",
  "回答要专业、简洁、可执行。涉及合作、报价、定制需求或现场调研时，引导用户联系 xinghanshunwei@gmail.com。",
  "不要声称已经代表公司做出合同、价格、交付周期或法律承诺。"
].join("\n");

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  }
});

const parseAllowedOrigins = (request, env) => {
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const currentOrigin = new URL(request.url).origin;
  return new Set(configured.length ? configured : [currentOrigin, ...DEFAULT_ALLOWED_ORIGINS]);
};

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});

const isOriginAllowed = (request, env) => {
  const origin = request.headers.get("Origin");
  if (!origin) return { allowed: false, origin: "" };
  return { allowed: parseAllowedOrigins(request, env).has(origin), origin };
};

const sanitizeMessages = (input) => {
  if (!Array.isArray(input)) return [];

  return input
    .slice(-12)
    .map((message) => ({
      role: message && message.role === "assistant" ? "assistant" : "user",
      content: String((message && message.content) || "").trim().slice(0, 1600)
    }))
    .filter((message) => message.content);
};

const getClientId = (request) => {
  return request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")
    || "unknown";
};

const enforceRateLimit = async (request, env) => {
  const limit = Number(env.RATE_LIMIT_PER_MINUTE || 12);
  if (!Number.isFinite(limit) || limit <= 0) return { allowed: true };

  const now = Date.now();
  const windowId = Math.floor(now / 60000);
  const clientId = getClientId(request);
  const key = new Request(`https://rate-limit.local/chat/${encodeURIComponent(clientId)}/${windowId}`);
  const cache = caches.default;
  const existing = await cache.match(key);
  const count = existing ? Number(await existing.text()) || 0 : 0;

  if (count >= limit) {
    return { allowed: false, retryAfter: 60 - Math.floor((now % 60000) / 1000) };
  }

  await cache.put(key, new Response(String(count + 1), {
    headers: {
      "Cache-Control": "s-maxage=70"
    }
  }));

  return { allowed: true };
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getModelCandidates = (env) => {
  const primary = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const fallbacks = (env.GEMINI_FALLBACK_MODELS || "gemini-3-flash-preview,gemini-2.5-flash")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return [...new Set([primary, ...fallbacks])].slice(0, 3);
};

const requestGemini = (env, model, body) => fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  }
);

const readGeminiError = async (response) => {
  try {
    const error = await response.json();
    return error.error && error.error.message ? error.error.message : "Gemini API request failed";
  } catch (_) {
    return await response.text() || "Gemini API request failed";
  }
};

export async function onRequestOptions(context) {
  const { request, env } = context;
  const { allowed, origin } = isOriginAllowed(request, env);
  if (!allowed) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { allowed, origin } = isOriginAllowed(request, env);
  const headers = allowed ? corsHeaders(origin) : {};

  if (!allowed) {
    return json({ error: "Forbidden origin" }, 403);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: "Missing GEMINI_API_KEY secret" }, 500, headers);
  }

  const rate = await enforceRateLimit(request, env);
  if (!rate.allowed) {
    return json({ error: "请求过于频繁，请稍后再试。" }, 429, {
      ...headers,
      "Retry-After": String(rate.retryAfter || 60)
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const messages = sanitizeMessages(payload.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "请输入有效的问题。" }, 400, headers);
  }

  const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalChars > 6000) {
    return json({ error: "对话内容过长，请缩短后再发送。" }, 413, headers);
  }

  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));

  const geminiBody = {
    system_instruction: {
      parts: [{ text: env.GEMINI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT }]
    },
    contents,
    generationConfig: {
      maxOutputTokens: Number(env.GEMINI_MAX_OUTPUT_TOKENS || 1200)
    }
  };

  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  const modelCandidates = getModelCandidates(env);
  let upstream;
  let selectedModel = modelCandidates[0];
  let lastError = "Gemini API request failed";
  let lastStatus = 503;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const model = modelCandidates[modelIndex];
    const attempts = modelIndex === 0 ? 2 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      upstream = await requestGemini(env, model, geminiBody);
      if (upstream.ok && upstream.body) {
        selectedModel = model;
        break;
      }

      lastStatus = upstream.status || 502;
      lastError = await readGeminiError(upstream);
      if (!retryableStatuses.has(lastStatus)) {
        return json({ error: lastError }, lastStatus, headers);
      }

      if (attempt + 1 < attempts) {
        await wait(500 + Math.floor(Math.random() * 350));
      }
    }

    if (upstream && upstream.ok && upstream.body) break;
  }

  if (!upstream || !upstream.ok || !upstream.body) {
    return json({ error: `AI 服务暂时繁忙，请稍后再试。(${lastStatus})` }, lastStatus, headers);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-AI-Model": selectedModel
    }
  });
}
