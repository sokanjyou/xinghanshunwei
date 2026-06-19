# AI 联网检索配置

聊天接口位于 Cloudflare Pages Function `functions/api/chat.js`。模型密钥和搜索密钥必须配置为服务端环境变量，不要写入前端文件或提交到 Git。

## 模型必需变量

- `MINICPM_API_KEY`：MiniCPM API 密钥。

## 联网搜索模式

接口固定使用 Tavily Keyless mode，不读取或使用 `TAVILY_API_KEY`、`WEB_SEARCH_API_KEY`。Keyless 只适合试用和低流量场景，公共额度触发限流后会降级为普通模型回答。

聊天请求默认使用自动模式：明确要求联网，或问题包含最近、最新、便宜、附近、周边、优惠、价格比较、营业状态、当前推荐，以及新闻、天气、行情、政策、世界杯、球赛、联赛、球队近况等时才调用搜索；寒暄、常识和普通咨询直接由模型回答。搜索会根据问题补充当前日期。附近类问题没有具体城市、区域或地标时，助手会先要求用户补充位置。接口中的 `web_search: true` 可强制搜索，`web_search: false` 可明确关闭搜索。

在 Cloudflare Dashboard 中进入 Pages 项目，然后在 Settings > Environment variables 中分别为 Production 和 Preview 添加变量，重新部署后生效。

本地使用 Wrangler 调试时，可创建不会被 Git 跟踪的 `.dev.vars`：

```text
MINICPM_API_KEY=your_minicpm_key
```

## 可选变量

- `WEB_SEARCH_DEPTH`：`basic`（默认）或 `advanced`。
- `WEB_SEARCH_TIMEOUT_MS`：搜索超时毫秒数，默认 `8000`。
- `TAVILY_API_URL`：搜索端点，默认 `https://api.tavily.com/search`。
- `MINICPM_MODEL`、`MINICPM_BASE_URL`、`MINICPM_MAX_TOKENS`：沿用原模型配置。
- `RATE_LIMIT_PER_MINUTE`：每个客户端每分钟请求数，默认 `12`。

Keyless 公共额度耗尽或搜索服务暂时失败时，接口会降级为普通模型回答，并在聊天状态栏明确提示客户该回答没有经过联网检索。

## 本地预览

从 `http://localhost`、`http://127.0.0.1` 或 `http://[::1]` 打开的页面会自动调用线上聊天接口，因此普通静态服务器也能测试聊天功能。线上 Function 必须先部署最新版本，才能允许这些本机来源通过 CORS。

不要直接双击 HTML 以 `file://` 打开；浏览器的空来源不在允许列表中。
