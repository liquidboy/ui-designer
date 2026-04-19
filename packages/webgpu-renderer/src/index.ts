import type { ColorRgba, DrawCommand } from '@ui-designer/ui-core';

const shaderSource = `
struct VertexOut {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec4<f32>,
};

@vertex
fn vs_main(
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>
) -> VertexOut {
  var out: VertexOut;
  out.position = vec4<f32>(position, 0.0, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
  return color;
}
`;

export class WebGPUCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private format: GPUTextureFormat | null = null;
  private pipeline: GPURenderPipeline | null = null;

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

    this.pipeline = this.createPipeline();
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

  render(commands: DrawCommand[], clearColor: ColorRgba = { r: 0.08, g: 0.1, b: 0.14, a: 1 }): void {
    if (!this.device || !this.context || !this.pipeline) {
      return;
    }

    const vertices = this.buildVertexArray(commands);
    const encoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: clearColor,
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });

    if (vertices.length > 0) {
      const vertexBuffer = this.device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });

      new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
      vertexBuffer.unmap();

      pass.setPipeline(this.pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(vertices.length / 6);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  renderClear(r: number, g: number, b: number): void {
    this.render([], { r, g, b, a: 1 });
  }

  private createPipeline(): GPURenderPipeline {
    if (!this.device || !this.format) {
      throw new Error('Cannot create pipeline before renderer is initialized.');
    }

    const shaderModule = this.device.createShaderModule({
      code: shaderSource
    });

    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x4' }
            ]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
  }

  private buildVertexArray(commands: DrawCommand[]): Float32Array {
    const floatsPerVertex = 6;
    const verticesPerRect = 6;
    const array = new Float32Array(commands.length * verticesPerRect * floatsPerVertex);

    let offset = 0;

    for (const command of commands) {
      if (command.kind !== 'rect') {
        continue;
      }

      const x1 = this.toNdcX(command.x);
      const y1 = this.toNdcY(command.y);
      const x2 = this.toNdcX(command.x + command.width);
      const y2 = this.toNdcY(command.y + command.height);

      offset = this.pushVertex(array, offset, x1, y1, command.color);
      offset = this.pushVertex(array, offset, x2, y1, command.color);
      offset = this.pushVertex(array, offset, x1, y2, command.color);

      offset = this.pushVertex(array, offset, x2, y1, command.color);
      offset = this.pushVertex(array, offset, x2, y2, command.color);
      offset = this.pushVertex(array, offset, x1, y2, command.color);
    }

    return array.subarray(0, offset);
  }

  private pushVertex(
    target: Float32Array,
    offset: number,
    x: number,
    y: number,
    color: ColorRgba
  ): number {
    target[offset++] = x;
    target[offset++] = y;
    target[offset++] = color.r;
    target[offset++] = color.g;
    target[offset++] = color.b;
    target[offset++] = color.a;
    return offset;
  }

  private toNdcX(pixelX: number): number {
    const logicalWidth = Math.max(this.canvas.clientWidth, 1);
    return (pixelX / logicalWidth) * 2 - 1;
  }

  private toNdcY(pixelY: number): number {
    const logicalHeight = Math.max(this.canvas.clientHeight, 1);
    return 1 - (pixelY / logicalHeight) * 2;
  }
}
