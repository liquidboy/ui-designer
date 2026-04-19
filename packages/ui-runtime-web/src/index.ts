import { parseXaml } from '@ui-designer/xaml-parser';
import {
  buildDrawCommands,
  buildUiTree,
  type DrawCommand,
  findElementById,
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

export interface RuntimeCamera {
  x: number;
  y: number;
  zoom: number;
}

export class RuntimeHost {
  private readonly renderer: WebGPUCanvasRenderer;
  private readonly canvas: HTMLCanvasElement;
  private root: UiElement | null = null;
  private isRunning = false;
  private frameHandle = 0;
  private camera: RuntimeCamera = { x: 0, y: 0, zoom: 1 };
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

  getElementById(id: string): UiElement | null {
    if (!this.root) {
      return null;
    }

    return findElementById(this.root, id);
  }

  setCamera(camera: RuntimeCamera): void {
    this.camera = {
      x: camera.x,
      y: camera.y,
      zoom: Math.max(0.05, camera.zoom)
    };
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
    this.renderer.render(this.projectCommands(commands));
  }

  private toCanvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const offsetX = this.canvas.clientLeft;
    const offsetY = this.canvas.clientTop;
    return {
      x: event.clientX - rect.left - offsetX,
      y: event.clientY - rect.top - offsetY
    };
  }

  private pickElementId(event: PointerEvent): string | null {
    if (!this.root) {
      return null;
    }

    const point = this.toCanvasPoint(event);
    const worldPoint = this.screenToWorld(point);
    const target = hitTest(this.root, worldPoint);
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
    if (event.button !== 0) {
      return;
    }

    const next = this.pickElementId(event);
    if (next === this.selectedElementId) {
      return;
    }

    this.selectedElementId = next;
    if (this.onSelectedElementChange) {
      this.onSelectedElementChange(next);
    }
  }

  private worldToScreen(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: (point.x - this.camera.x) * this.camera.zoom,
      y: (point.y - this.camera.y) * this.camera.zoom
    };
  }

  private screenToWorld(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: point.x / this.camera.zoom + this.camera.x,
      y: point.y / this.camera.zoom + this.camera.y
    };
  }

  private projectCommands(commands: DrawCommand[]): DrawCommand[] {
    if (this.camera.zoom === 1 && this.camera.x === 0 && this.camera.y === 0) {
      return commands;
    }

    return commands.map((command: DrawCommand) => {
      const origin = this.worldToScreen({ x: command.x, y: command.y });
      return {
        ...command,
        x: origin.x,
        y: origin.y,
        width: command.width * this.camera.zoom,
        height: command.height * this.camera.zoom
      };
    });
  }
}
