class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunkSize = options.processorOptions?.chunkSize || 16000;
    this.samples = [];
    this.active = false;
    this.port.onmessage = (event) => {
      if (event.data?.command === "start") {
        this.samples = [];
        this.active = true;
      } else if (event.data?.command === "stop") {
        this.samples = [];
        this.active = false;
      }
    };
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!this.active || !input?.length) return true;

    for (let index = 0; index < input.length; index += 1) this.samples.push(input[index]);
    while (this.samples.length >= this.chunkSize) {
      const chunk = new Float32Array(this.samples.splice(0, this.chunkSize));
      this.port.postMessage({ type: "chunk", audio: chunk }, [chunk.buffer]);
    }
    return true;
  }
}

registerProcessor("voice-capture-processor", VoiceCaptureProcessor);
