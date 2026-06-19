const DEFAULT_ALLOWED_ORIGINS = [
  "https://xinghanshunwei.top",
  "https://www.xinghanshunwei.top"
];

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});

const getAllowedOrigin = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]).has(origin)) return origin;
  try {
    const url = new URL(origin);
    if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return origin;
  } catch (_) { /* invalid origin */ }
  return "";
};

const json = (body, status, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
});

export async function onRequestOptions({ request, env }) {
  const origin = getAllowedOrigin(request, env);
  return new Response(null, { status: origin ? 204 : 403, headers: origin ? corsHeaders(origin) : {} });
}

export async function onRequestPost({ request, env }) {
  return json({ error: "This endpoint has been replaced" }, 410);

  const origin = getAllowedOrigin(request, env);
  if (!origin) return json({ error: "Forbidden origin" }, 403);
  if (!env.MINICPM_API_KEY) return json({ error: "Missing API key" }, 500, corsHeaders(origin));

  let payload;
  try { payload = await request.json(); } catch (_) {
    return json({ error: "Invalid JSON body" }, 400, corsHeaders(origin));
  }
  const audio = String(payload.audio || "");
  if (!/^[a-z0-9+/=]+$/i.test(audio) || audio.length > 2_000_000) {
    return json({ error: "Invalid audio" }, 400, corsHeaders(origin));
  }

  const baseUrl = String(env.MINICPM_BASE_URL || "https://api.modelbest.cn/v1").replace(/\/+$/, "");
  let upstream;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.MINICPM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.MINICPM_AUDIO_MODEL || "MiniCPM-o-4.5",
        messages: [{
          role: "user",
          content: [
            { type: "audio", data: audio },
            { type: "text", text: "请准确转写这段用户语音。只输出用户说出的文字，不要解释或回答。" }
          ]
        }],
        max_tokens: 256
      })
    });
  } catch (_) {
    return json({ error: "Unable to connect to transcription service" }, 502, corsHeaders(origin));
  }

  if (!upstream.ok) return json({ error: "Transcription service unavailable" }, 502, corsHeaders(origin));
  const completion = await upstream.json();
  const text = String(completion?.choices?.[0]?.message?.content || "").trim();
  return text
    ? json({ text }, 200, { ...corsHeaders(origin), "Cache-Control": "no-store" })
    : json({ error: "Empty transcription" }, 502, corsHeaders(origin));
}
