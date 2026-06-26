import { onRequestOptions, onRequestPost } from "./functions/api/chat.js";

const buildContext = (request, env, executionContext) => ({
  request,
  env,
  params: {},
  waitUntil: executionContext.waitUntil.bind(executionContext),
  passThroughOnException: executionContext.passThroughOnException
    ? executionContext.passThroughOnException.bind(executionContext)
    : () => {}
});

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") {
        return onRequestOptions(buildContext(request, env, executionContext));
      }
      if (request.method === "POST") {
        return onRequestPost(buildContext(request, env, executionContext));
      }
      return new Response(null, {
        status: 405,
        headers: { "Allow": "POST, OPTIONS" }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
