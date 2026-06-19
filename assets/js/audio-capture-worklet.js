class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunkSize = options.processorOptions?.chunkSize || 16000;
    this.samples = new Float32Array(this.chunkSize);
    this.sampleCount = 0;
    this.active = false;
    this.port.onmessage = (event) => {
      if (event.data?.command === "start") {
        this.sampleCount = 0;
        this.active = true;
      } else if (event.data?.command === "stop") {
        this.sampleCount = 0;
        this.active = false;
      }
    };
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!this.active || !input?.length) return true;

    let inputOffset = 0;
    while (inputOffset < input.length) {
      const copyCount = Math.min(input.length - inputOffset, this.chunkSize - this.sampleCount);
      this.samples.set(input.subarray(inputOffset, inputOffset + copyCount), this.sampleCount);
      this.sampleCount += copyCount;
      inputOffset += copyCount;

      if (this.sampleCount === this.chunkSize) {
        const chunk = this.samples;
        this.samples = new Float32Array(this.chunkSize);
        this.sampleCount = 0;
        this.port.postMessage({ type: "chunk", audio: chunk }, [chunk.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("voice-capture-processor", VoiceCaptureProcessor);
