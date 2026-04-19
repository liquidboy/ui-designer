import { parseXaml } from '@ui-designer/xaml-parser';
import { buildUiTree, runLayout } from '@ui-designer/ui-core';
import { WebGPUCanvasRenderer } from '@ui-designer/webgpu-renderer';

export interface RuntimeBootOptions {
  xaml: string;
  canvas: HTMLCanvasElement;
}

export class RuntimeHost {
  private readonly renderer: WebGPUCanvasRenderer;
  private isRunning = false;
  private frameHandle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPUCanvasRenderer(canvas);
  }

  async boot(options: RuntimeBootOptions): Promise<void> {
    const xamlDocument = parseXaml(options.xaml);
    const tree = buildUiTree(xamlDocument.root);

    runLayout(tree, {
      width: options.canvas.clientWidth,
      height: options.canvas.clientHeight
    });

    await this.renderer.initialize();
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const frame = () => {
      this.renderer.resize();
      this.renderer.renderClear(0.08, 0.1, 0.14);
      this.frameHandle = requestAnimationFrame(frame);
    };

    this.frameHandle = requestAnimationFrame(frame);
  }

  stop(): void {
    this.isRunning = false;
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }
}
