export class WebGPURenderer {
  private readonly canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private format: GPUTextureFormat | null = null;
  private animationFrame = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<string> {
    if (!('gpu' in navigator)) {
      throw new Error('This browser does not support WebGPU.');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No compatible GPU adapter found.');
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');

    if (!this.context) {
      throw new Error('Unable to create WebGPU canvas context.');
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.resize();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque'
    });

    return 'WebGPU ready. Rendering in real time.';
  }

  start(): void {
    if (!this.device || !this.context || !this.format) {
      return;
    }

    const frame = () => {
      this.resize();
      this.renderFrame();
      this.animationFrame = requestAnimationFrame(frame);
    };

    this.animationFrame = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  private resize(): void {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * devicePixelRatio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * devicePixelRatio));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private renderFrame(): void {
    if (!this.device || !this.context) {
      return;
    }

    const encoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.04, g: 0.09, b: 0.18, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });

    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }
}
