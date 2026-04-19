import { parseXaml } from '@ui-designer/xaml-parser';
import { buildDrawCommands, buildUiTree, runLayout, type UiElement } from '@ui-designer/ui-core';
import { WebGPUCanvasRenderer } from '@ui-designer/webgpu-renderer';

export interface RuntimeBootOptions {
  xaml: string;
  canvas: HTMLCanvasElement;
}

export class RuntimeHost {
  private readonly renderer: WebGPUCanvasRenderer;
  private readonly canvas: HTMLCanvasElement;
  private root: UiElement | null = null;
  private isRunning = false;
  private frameHandle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPUCanvasRenderer(canvas);
    this.canvas = canvas;
  }

  async boot(options: RuntimeBootOptions): Promise<void> {
    const xamlDocument = parseXaml(options.xaml);
    this.root = buildUiTree(xamlDocument.root);

    await this.renderer.initialize();
    this.layoutAndRender();
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const frame = () => {
      this.layoutAndRender();
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

  private layoutAndRender(): void {
    this.renderer.resize();

    if (!this.root) {
      this.renderer.render([]);
      return;
    }

    runLayout(this.root, {
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight
    });

    const commands = buildDrawCommands(this.root);
    this.renderer.render(commands);
  }
}
