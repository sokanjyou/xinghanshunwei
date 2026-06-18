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
  const CHAT_API_URL = window.location.hostname === "www.xinghanshunwei.top"
    ? "https://xinghanshunwei.top/api/chat"
    : "/api/chat";
  let controller = null;
  let recognition = null;
  let isRecording = false;
  let hasMicrophonePermission = false;
  let isRequestingMicrophone = false;
  let recognitionStartTimer = null;

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
    const response = await fetch(CHAT_API_URL, {
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

  const resetVoiceButton = () => {
    isRequestingMicrophone = false;
    voiceButton.disabled = false;
    voiceButton.classList.remove("is-requesting");
    if (!isRecording) {
      voiceButton.setAttribute("aria-pressed", "false");
      voiceButtonLabel.textContent = "语音输入";
    }
  };

  const getMicrophoneErrorMessage = (error) => {
    const name = error && error.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "麦克风权限被拒绝，请在浏览器的网站设置中允许麦克风后刷新页面。";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "未检测到可用麦克风。";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "麦克风正被其他应用占用，请关闭占用后重试。";
    }
    if (name === "SecurityError" || name === "InsecureContextError") {
      return "麦克风只能在 HTTPS 安全页面中使用。";
    }
    return "无法访问麦克风，请检查浏览器权限后重试。";
  };

  const requestMicrophonePermission = async () => {
    if (!window.isSecureContext) {
      const error = new Error("Insecure context");
      error.name = "InsecureContextError";
      throw error;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error = new Error("Media devices unavailable");
      error.name = "NotSupportedError";
      throw error;
    }

    if (hasMicrophonePermission) return;

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permission = await navigator.permissions.query({ name: "microphone" });
        if (permission.state === "denied") {
          const error = new Error("Microphone permission denied");
          error.name = "NotAllowedError";
          throw error;
        }
        hasMicrophonePermission = permission.state === "granted";
      } catch (error) {
        if (error.name === "NotAllowedError") throw error;
        // Safari does not consistently support querying microphone permission.
      }
    }

    if (hasMicrophonePermission) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    stream.getTracks().forEach((track) => track.stop());
    hasMicrophonePermission = true;
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  };

  const isAppleMobileDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const startRecognition = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("当前浏览器不支持网页语音识别，请使用最新版 Chrome、Edge 或 Safari。", true);
      return;
    }

    if (isRecording) {
      stopRecognition();
      return;
    }

    if (isRequestingMicrophone) return;

    const isAppleMobile = isAppleMobileDevice();

    // Safari requires SpeechRecognition.start() to run inside a fresh user gesture.
    // Use the first tap for microphone permission and the second tap for recognition.
    if (isAppleMobile && !hasMicrophonePermission) {
      isRequestingMicrophone = true;
      voiceButton.disabled = true;
      voiceButton.classList.add("is-requesting");
      voiceButtonLabel.textContent = "请求权限";
      setStatus("请允许 Safari 使用麦克风");

      try {
        await requestMicrophonePermission();
        resetVoiceButton();
        setStatus("麦克风权限已开启，请再次点击语音输入并开始说话");
      } catch (error) {
        resetVoiceButton();
        setStatus(getMicrophoneErrorMessage(error), true);
      }
      return;
    }

    if (!isAppleMobile) {
      isRequestingMicrophone = true;
      voiceButton.disabled = true;
      voiceButton.classList.add("is-requesting");
      voiceButtonLabel.textContent = "请求权限";
      setStatus("请允许浏览器使用麦克风");

      try {
        await requestMicrophonePermission();
      } catch (error) {
        resetVoiceButton();
        setStatus(getMicrophoneErrorMessage(error), true);
        return;
      }

      resetVoiceButton();
    }

    recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = !isAppleMobile;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    const existingText = input.value.trim();
    let finalTranscript = "";
    let receivedTranscript = false;
    let recognitionHadError = false;

    recognition.onstart = () => {
      window.clearTimeout(recognitionStartTimer);
      isRecording = true;
      voiceButton.classList.add("is-recording");
      voiceButton.setAttribute("aria-pressed", "true");
      voiceButtonLabel.textContent = "停止录音";
      setStatus("正在聆听，请开始说话");
    };

    recognition.onaudiostart = () => {
      setStatus("麦克风已连接，正在聆听");
    };

    recognition.onspeechstart = () => {
      setStatus("已检测到语音，正在识别");
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      const startIndex = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;

      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result && result[0];
        const segment = alternative && alternative.transcript
          ? String(alternative.transcript).trim()
          : "";
        if (!segment) continue;

        receivedTranscript = true;
        if (result.isFinal) {
          finalTranscript += `${finalTranscript ? " " : ""}${segment}`;
        } else {
          interimTranscript += `${interimTranscript ? " " : ""}${segment}`;
        }
      }

      const transcript = [finalTranscript, interimTranscript].filter(Boolean).join(" ");
      input.value = `${existingText}${existingText && transcript ? " " : ""}${transcript}`;
      input.dispatchEvent(new Event("input", { bubbles: true }));

      if (finalTranscript) {
        setStatus("语音已转写，请确认后发送");
      } else if (interimTranscript) {
        setStatus("正在识别，请继续说话");
      }
    };

    recognition.onerror = (event) => {
      recognitionHadError = true;
      window.clearTimeout(recognitionStartTimer);
      const messagesByError = {
        "not-allowed": "麦克风权限被拒绝，请在浏览器的网站设置中允许麦克风后刷新页面。",
        "service-not-allowed": isAppleMobile
          ? "Safari 拒绝启动语音识别，请确认系统已开启听写功能后再次点击语音输入。"
          : "浏览器禁止使用语音识别服务，请检查网站权限。",
        "audio-capture": "无法获取麦克风音频，请确认麦克风未被其他应用占用。",
        "no-speech": "没有检测到语音，请靠近麦克风后重试。",
        "network": "语音识别服务连接失败，请检查网络后重试。",
        "language-not-supported": "当前浏览器不支持中文语音识别。"
      };
      setStatus(messagesByError[event.error] || "语音识别失败，请重试。", true);
    };

    recognition.onnomatch = () => {
      recognitionHadError = true;
      setStatus("没有识别出有效内容，请放慢语速后重试。", true);
    };

    recognition.onend = () => {
      window.clearTimeout(recognitionStartTimer);
      isRecording = false;
      voiceButton.classList.remove("is-recording");
      voiceButton.setAttribute("aria-pressed", "false");
      voiceButtonLabel.textContent = "语音输入";
      if (!receivedTranscript && !recognitionHadError) {
        setStatus("没有收到语音识别结果，请再次点击语音输入并清晰说话。", true);
      }
      if (!window.matchMedia("(pointer: coarse)").matches) input.focus();
    };

    try {
      recognitionStartTimer = window.setTimeout(() => {
        if (!isRecording) {
          setStatus("语音识别服务未启动，请更换 Chrome、Edge 或 Safari 重试。", true);
        }
      }, 6000);
      recognition.start();
    } catch (error) {
      window.clearTimeout(recognitionStartTimer);
      resetVoiceButton();
      setStatus("语音识别启动失败，请刷新页面后重试。", true);
    }
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
