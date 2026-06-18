(function () {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const log = document.querySelector("#chat-log");
  const status = document.querySelector("#chat-status");
  const submit = document.querySelector("#chat-submit");
  const clear = document.querySelector("#chat-clear");
  const mediaButton = document.querySelector("#chat-media-button");
  const mediaInput = document.querySelector("#chat-media-input");
  const attachmentList = document.querySelector("#chat-attachments");
  const voiceButton = document.querySelector("#chat-voice-button");
  const voiceButtonLabel = voiceButton && voiceButton.querySelector(".chat-tool-label");

  if (!form || !input || !log || !status || !submit || !clear
    || !mediaButton || !mediaInput || !attachmentList || !voiceButton || !voiceButtonLabel) return;

  const messages = [];
  const attachments = [];
  const MAX_IMAGES = 5;
  let controller = null;
  let recognition = null;
  let isRecording = false;

  const scrollToBottom = () => {
    log.scrollTop = log.scrollHeight;
  };

  const setStatus = (text, isError) => {
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  };

  const stripStars = (text) => String(text || "").replace(/\*/g, "").trim();

  const appendMessage = (role, text, imageUrls = []) => {
    const article = document.createElement("article");
    article.className = `chat-message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    avatar.textContent = role === "user" ? "你" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    const messageText = role === "assistant" ? stripStars(text) : text;
    if (messageText) {
      const textBlock = document.createElement("div");
      textBlock.className = "chat-message-text";
      textBlock.textContent = messageText;
      bubble.append(textBlock);
    }

    if (imageUrls.length) {
      const imageGrid = document.createElement("div");
      imageGrid.className = "chat-message-images";
      imageUrls.forEach((url) => {
        const thumbnail = document.createElement("img");
        thumbnail.src = url;
        thumbnail.alt = "用户上传的图片";
        thumbnail.width = 200;
        thumbnail.height = 200;
        imageGrid.append(thumbnail);
      });
      bubble.append(imageGrid);
    }

    article.append(avatar, bubble);
    log.append(article);
    scrollToBottom();
    return bubble;
  };

  const setBusy = (busy, label) => {
    submit.disabled = busy;
    input.disabled = busy;
    clear.disabled = busy;
    mediaButton.disabled = busy;
    mediaInput.disabled = busy;
    voiceButton.disabled = busy;
    submit.textContent = busy ? (label || "生成中") : "发送";
  };

  const getMediaPartCount = () => attachments.reduce((sum, item) => sum + item.urls.length, 0);

  const renderAttachments = () => {
    attachmentList.innerHTML = "";
    attachmentList.classList.toggle("has-items", attachments.length > 0);

    attachments.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "chat-attachment";

      const preview = document.createElement("img");
      preview.src = item.urls[0];
      preview.alt = item.name;
      preview.width = 200;
      preview.height = 200;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chat-attachment-remove";
      remove.dataset.index = String(index);
      remove.setAttribute("aria-label", `移除 ${item.name}`);
      remove.textContent = "×";

      card.append(preview, remove);
      attachmentList.append(card);
    });
  };

  const fitInside = (width, height, maxDimension) => {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  };

  const drawFrame = (source, width, height, maxDimension, quality) => {
    const size = fitInside(width, height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(source, 0, 0, size.width, size.height);
    return canvas.toDataURL("image/jpeg", quality);
  };

  const loadImageAttachment = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        resolve(drawFrame(image, image.naturalWidth, image.naturalHeight, 1600, 0.84));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取这张图片。"));
    };
    image.src = url;
  });

  const processFiles = async (files) => {
    setBusy(true, "处理中");
    setStatus("正在处理图片");

    try {
      for (const file of files) {
        if (getMediaPartCount() >= MAX_IMAGES) {
          throw new Error(`每次最多发送 ${MAX_IMAGES} 张图片。`);
        }

        if (file.type.startsWith("image/")) {
          const dataUrl = await loadImageAttachment(file);
          attachments.push({ name: file.name, urls: [dataUrl] });
        } else {
          throw new Error(`不支持 ${file.name} 的文件格式。`);
        }
        renderAttachments();
      }
      setStatus("附件已就绪");
    } catch (error) {
      setStatus(error.message || "附件处理失败", true);
    } finally {
      mediaInput.value = "";
      setBusy(false);
      input.focus();
    }
  };

  const ask = async (requestContent, historyContent) => {
    controller = new AbortController();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages.concat({ role: "user", content: requestContent })
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
    const assistantContent = stripStars(result.content
      || (result.choices
        && result.choices[0]
        && result.choices[0].message
        && result.choices[0].message.content));

    if (!assistantContent) throw new Error("这次没有收到有效回复，请稍后再试。");

    appendMessage("assistant", assistantContent);
    messages.push({ role: "user", content: historyContent });
    messages.push({ role: "assistant", content: assistantContent });
    while (messages.length > 12) messages.shift();
  };

  const stopRecognition = () => {
    if (recognition && isRecording) recognition.stop();
  };

  const startRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("当前浏览器不支持语音识别，请使用最新版 Chrome 或 Edge。", true);
      return;
    }

    if (isRecording) {
      stopRecognition();
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    const existingText = input.value.trim();

    recognition.onstart = () => {
      isRecording = true;
      voiceButton.classList.add("is-recording");
      voiceButton.setAttribute("aria-pressed", "true");
      voiceButtonLabel.textContent = "停止录音";
      setStatus("正在聆听，请开始说话");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
        isFinal = isFinal || event.results[index].isFinal;
      }
      input.value = `${existingText}${existingText && transcript ? " " : ""}${transcript}`;
      if (isFinal) {
        setStatus("语音已转写，请确认后发送");
      }
    };

    recognition.onerror = (event) => {
      const permissionDenied = event.error === "not-allowed" || event.error === "service-not-allowed";
      setStatus(permissionDenied ? "未获得麦克风权限。" : "语音识别失败，请重试。", true);
    };

    recognition.onend = () => {
      isRecording = false;
      voiceButton.classList.remove("is-recording");
      voiceButton.setAttribute("aria-pressed", "false");
      voiceButtonLabel.textContent = "语音输入";
      input.focus();
    };

    recognition.start();
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const typedContent = input.value.trim();
    if (!typedContent && !attachments.length) {
      setStatus("请输入问题，或添加图片、语音。", true);
      input.focus();
      return;
    }

    const prompt = typedContent || "请分析我上传的内容。";
    const historyContent = prompt;
    const mediaParts = attachments.flatMap((item) => item.urls.map((url) => ({
      type: "image_url",
      image_url: { url }
    })));
    const requestContent = mediaParts.length
      ? [{ type: "text", text: prompt }, ...mediaParts]
      : prompt;
    const displayImages = attachments.flatMap((item) => item.urls);

    appendMessage("user", prompt, displayImages);
    input.value = "";
    setBusy(true);
    setStatus("正在生成");

    try {
      await ask(requestContent, historyContent);
      attachments.length = 0;
      renderAttachments();
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

  mediaButton.addEventListener("click", () => mediaInput.click());
  mediaInput.addEventListener("change", () => processFiles(Array.from(mediaInput.files || [])));
  voiceButton.addEventListener("click", startRecognition);

  attachmentList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".chat-attachment-remove");
    if (!removeButton) return;
    const index = Number(removeButton.dataset.index);
    if (Number.isInteger(index)) attachments.splice(index, 1);
    renderAttachments();
    setStatus(attachments.length ? "附件已就绪" : "已连接");
  });

  clear.addEventListener("click", () => {
    controller?.abort();
    stopRecognition();
    messages.length = 0;
    attachments.length = 0;
    input.value = "";
    renderAttachments();
    log.innerHTML = "";
    appendMessage("assistant", "你好，我是星瀚顺为 AI 助手。你可以直接描述业务场景、系统现状或想解决的问题。");
    setStatus("已连接");
    input.focus();
  });
})();
