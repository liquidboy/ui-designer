export class WebGPUCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private format: GPUTextureFormat | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<void> {
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
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  renderClear(r: number, g: number, b: number): void {
    if (!this.device || !this.context) {
      return;
    }

    const encoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r, g, b, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
