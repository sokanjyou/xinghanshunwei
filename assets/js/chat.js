(function () {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const log = document.querySelector("#chat-log");
  const status = document.querySelector("#chat-status");
  const submit = document.querySelector("#chat-submit");
  const clear = document.querySelector("#chat-clear");

  if (!form || !input || !log || !status || !submit || !clear) return;

  const messages = [];
  let controller = null;

  const scrollToBottom = () => {
    log.scrollTop = log.scrollHeight;
  };

  const setStatus = (text, isError) => {
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  };

  const appendMessage = (role, text) => {
    const article = document.createElement("article");
    article.className = `chat-message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    avatar.textContent = role === "user" ? "你" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = text;

    article.append(avatar, bubble);
    log.append(article);
    scrollToBottom();
    return bubble;
  };

  const setBusy = (busy) => {
    submit.disabled = busy;
    input.disabled = busy;
    clear.disabled = busy;
    submit.textContent = busy ? "生成中" : "发送";
  };

  const ask = async (content) => {
    controller = new AbortController();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages.concat({ role: "user", content })
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      let detail = "AI 服务暂时不可用";
      try {
        const error = await response.json();
        detail = error.error || detail;
      } catch (_) {
        detail = response.statusText || detail;
      }
      throw new Error(detail);
    }

    const result = await response.json();
    const assistantContent = result.content
      || (result.choices
        && result.choices[0]
        && result.choices[0].message
        && result.choices[0].message.content)
      || "";
    const bubble = appendMessage("assistant", assistantContent);
    scrollToBottom();

    const assistantText = bubble.textContent.trim();
    if (assistantText) {
      messages.push({ role: "user", content });
      messages.push({ role: "assistant", content: assistantText });
      while (messages.length > 12) messages.shift();
    } else {
      bubble.textContent = "这次没有收到有效回复，请稍后再试。";
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    appendMessage("user", content);
    input.value = "";
    setBusy(true);
    setStatus("正在生成");

    try {
      await ask(content);
      setStatus("已连接");
    } catch (error) {
      appendMessage("assistant", error.message || "AI 服务暂时不可用，请稍后再试。");
      setStatus("连接异常", true);
    } finally {
      setBusy(false);
      controller = null;
      input.focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  clear.addEventListener("click", () => {
    controller?.abort();
    messages.length = 0;
    log.innerHTML = "";
    appendMessage("assistant", "你好，我是星瀚顺为 AI 助手。你可以直接描述业务场景、系统现状或想解决的问题。");
    setStatus("已连接");
    input.focus();
  });
})();
