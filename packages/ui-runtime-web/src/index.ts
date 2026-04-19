import { parseXaml } from '@ui-designer/xaml-parser';
import {
  buildDrawCommands,
  buildUiTree,
  hitTest,
  runLayout,
  type UiElement
} from '@ui-designer/ui-core';
import { WebGPUCanvasRenderer } from '@ui-designer/webgpu-renderer';

export interface RuntimeBootOptions {
  xaml: string;
  canvas: HTMLCanvasElement;
  onHoveredElementChange?: (elementId: string | null) => void;
  onSelectedElementChange?: (elementId: string | null) => void;
}

export class RuntimeHost {
  private readonly renderer: WebGPUCanvasRenderer;
  private readonly canvas: HTMLCanvasElement;
  private root: UiElement | null = null;
  private isRunning = false;
  private frameHandle = 0;
  private selectedElementId: string | null = null;
  private hoveredElementId: string | null = null;
  private onHoveredElementChange?: (elementId: string | null) => void;
  private onSelectedElementChange?: (elementId: string | null) => void;
  private readonly pointerMoveHandler = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly pointerDownHandler = (event: PointerEvent) => this.handlePointerDown(event);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPUCanvasRenderer(canvas);
    this.canvas = canvas;
  }

  async boot(options: RuntimeBootOptions): Promise<void> {
    const xamlDocument = parseXaml(options.xaml);
    this.root = buildUiTree(xamlDocument.root);
    this.onHoveredElementChange = options.onHoveredElementChange;
    this.onSelectedElementChange = options.onSelectedElementChange;

    await this.renderer.initialize();
    this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
    this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
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
    this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
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

    const commands = buildDrawCommands(this.root, {
      hoveredElementId: this.hoveredElementId,
      selectedElementId: this.selectedElementId
    });
    this.renderer.render(commands);
  }

  private toCanvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private pickElementId(event: PointerEvent): string | null {
    if (!this.root) {
      return null;
    }

    const point = this.toCanvasPoint(event);
    const target = hitTest(this.root, point);
    return target ? target.id : null;
  }

  private handlePointerMove(event: PointerEvent): void {
    const next = this.pickElementId(event);
    if (next === this.hoveredElementId) {
      return;
    }

    this.hoveredElementId = next;
    if (this.onHoveredElementChange) {
      this.onHoveredElementChange(next);
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    const next = this.pickElementId(event);
    if (next === this.selectedElementId) {
      return;
    }

    this.selectedElementId = next;
    if (this.onSelectedElementChange) {
      this.onSelectedElementChange(next);
    }
  }
}
