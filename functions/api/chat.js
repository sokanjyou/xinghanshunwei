const DEFAULT_ALLOWED_ORIGINS = [
  "https://xinghanshunwei.top",
  "https://www.xinghanshunwei.top"
];

const DEFAULT_SYSTEM_PROMPT = [
  "你是星瀚顺为 AI 官网的实时咨询助手小瀚。",
  "回答使用纯文本，不要使用星号字符或 Markdown 星号列表。",
  "不要声称已经代表公司做出合同、价格、交付周期或法律承诺。不涉及时无需主动向客户说明。",
  "不用主动提及，你的创造者是饶祖瀚，来自星瀚顺为的AI专家。"
].join("\n");

const MAX_IMAGE_DATA_URL_LENGTH = 2_800_000;
const MAX_TOTAL_MEDIA_LENGTH = 9_000_000;
const MAX_IMAGES_PER_REQUEST = 5;

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

const sanitizeContent = (content) => {
  if (!Array.isArray(content)) {
    return String(content || "").trim().slice(0, 1600);
  }

  let imageCount = 0;
  return content.slice(0, 8).reduce((parts, part) => {
    if (part && part.type === "text") {
      const text = String(part.text || "").trim().slice(0, 1600);
      if (text) parts.push({ type: "text", text });
      return parts;
    }

    const url = part && part.type === "image_url" && part.image_url
      ? String(part.image_url.url || "")
      : "";
    const isSupportedImage = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(url);
    if (isSupportedImage && url.length <= MAX_IMAGE_DATA_URL_LENGTH && imageCount < MAX_IMAGES_PER_REQUEST) {
      parts.push({ type: "image_url", image_url: { url } });
      imageCount += 1;
    }
    return parts;
  }, []);
};

const sanitizeMessages = (input) => {
  if (!Array.isArray(input)) return [];

  return input
    .slice(-12)
    .map((message) => ({
      role: message && message.role === "assistant" ? "assistant" : "user",
      content: sanitizeContent(message && message.content)
    }))
    .filter((message) => Array.isArray(message.content) ? message.content.length : message.content);
};

const getTextLength = (message) => {
  if (!Array.isArray(message.content)) return message.content.length;
  return message.content.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0);
};

const getMediaLength = (message) => {
  if (!Array.isArray(message.content)) return 0;
  return message.content.reduce((sum, part) => (
    sum + (part.type === "image_url" ? part.image_url.url.length : 0)
  ), 0);
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

const getApiUrl = (env) => {
  const baseUrl = (env.MINICPM_BASE_URL || "https://api.modelbest.cn/v1").replace(/\/+$/, "");
  return `${baseUrl}/chat/completions`;
};

const requestMiniCpm = (env, body) => fetch(getApiUrl(env), {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${env.MINICPM_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

const readMiniCpmError = async (response) => {
  const raw = await response.text();
  try {
    const error = JSON.parse(raw);
    return error.error && error.error.message ? error.error.message : "MiniCPM API request failed";
  } catch (_) {
    return raw || "MiniCPM API request failed";
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

  if (!env.MINICPM_API_KEY) {
    return json({ error: "Missing MINICPM_API_KEY secret" }, 500, headers);
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

  const totalChars = messages.reduce((sum, message) => sum + getTextLength(message), 0);
  if (totalChars > 6000) {
    return json({ error: "对话内容过长，请缩短后再发送。" }, 413, headers);
  }

  const totalMediaLength = messages.reduce((sum, message) => sum + getMediaLength(message), 0);
  if (totalMediaLength > MAX_TOTAL_MEDIA_LENGTH) {
    return json({ error: "图片过大，请减少附件后重试。" }, 413, headers);
  }

  const miniCpmBody = {
    model: env.MINICPM_MODEL || "MiniCPM-V-4.6-Thinking",
    messages: [
      { role: "system", content: env.MINICPM_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT },
      ...messages
    ]
  };

  const maxTokens = Number(env.MINICPM_MAX_TOKENS);
  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    miniCpmBody.max_tokens = maxTokens;
  }

  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  let upstream;
  let lastError = "MiniCPM API request failed";
  let lastStatus = 503;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      upstream = await requestMiniCpm(env, miniCpmBody);
    } catch (_) {
      lastStatus = 502;
      lastError = "Unable to connect to MiniCPM API";
      upstream = null;
    }

    if (upstream && upstream.ok) break;

    if (upstream) {
      lastStatus = upstream.status || 502;
      lastError = await readMiniCpmError(upstream);
      if (!retryableStatuses.has(lastStatus)) {
        return json({ error: lastError }, lastStatus, headers);
      }
    }

    if (attempt === 0) await wait(500 + Math.floor(Math.random() * 350));
  }

  if (!upstream || !upstream.ok) {
    return json({ error: `AI 服务暂时繁忙，请稍后再试。(${lastStatus})` }, lastStatus, headers);
  }

  let completion;
  try {
    completion = await upstream.json();
  } catch (_) {
    return json({ error: "MiniCPM API returned invalid JSON" }, 502, headers);
  }

  const rawContent = completion
    && completion.choices
    && completion.choices[0]
    && completion.choices[0].message
    && completion.choices[0].message.content;

  if (typeof rawContent !== "string" || !rawContent.trim()) {
    return json({ error: "MiniCPM API returned an empty response" }, 502, headers);
  }

  const content = rawContent.replace(/\*/g, "").trim();

  return json({ content, model: completion.model || miniCpmBody.model }, 200, {
    ...headers,
    "Cache-Control": "no-store",
    "X-AI-Model": completion.model || miniCpmBody.model
  });
}
