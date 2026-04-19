import { parseXaml } from '@ui-designer/xaml-parser';
import {
  buildDrawCommands,
  type ColorRgba,
  type DrawRectCommand,
  buildUiTree,
  type DrawCommand,
  findElementById,
  runLayout,
  type Point,
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

export interface RuntimeOverridesSnapshot {
  offsets: Record<string, Point>;
  sizes: Record<string, { width: number; height: number }>;
  colors: Record<string, ColorRgba>;
}

export class RuntimeHost {
  private readonly renderer: WebGPUCanvasRenderer;
  private readonly canvas: HTMLCanvasElement;
  private root: UiElement | null = null;
  private isRunning = false;
  private frameHandle = 0;
  private camera: RuntimeCamera = { x: 0, y: 0, zoom: 1 };
  private screenCommands: DrawCommand[] = [];
  private readonly elementOffsets = new Map<string, Point>();
  private readonly elementSizeOverrides = new Map<string, { width: number; height: number }>();
  private readonly elementColorOverrides = new Map<string, ColorRgba>();
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

    const element = findElementById(this.root, id);
    if (!element) {
      return null;
    }

    const offset = this.getElementOffset(id);
    const size = this.getElementSize(id, element.layout.width, element.layout.height);
    return {
      ...element,
      layout: {
        ...element.layout,
        x: element.layout.x + offset.x,
        y: element.layout.y + offset.y,
        width: size.width,
        height: size.height
      }
    };
  }

  setCamera(camera: RuntimeCamera): void {
    this.camera = {
      x: camera.x,
      y: camera.y,
      zoom: Math.max(0.05, camera.zoom)
    };
  }

  getElementOffset(id: string): Point {
    return this.elementOffsets.get(id) ?? { x: 0, y: 0 };
  }

  getElementOffsetOverride(id: string): Point | null {
    return this.elementOffsets.get(id) ?? null;
  }

  setElementOffset(id: string, offset: Point): void {
    this.elementOffsets.set(id, { x: offset.x, y: offset.y });
  }

  clearElementOffset(id: string): void {
    this.elementOffsets.delete(id);
  }

  moveElementBy(id: string, delta: Point): void {
    const current = this.getElementOffset(id);
    this.setElementOffset(id, {
      x: current.x + delta.x,
      y: current.y + delta.y
    });
  }

  getElementSize(id: string, fallbackWidth: number, fallbackHeight: number): { width: number; height: number } {
    const current = this.elementSizeOverrides.get(id);
    if (!current) {
      return { width: fallbackWidth, height: fallbackHeight };
    }

    return current;
  }

  getElementSizeOverride(id: string): { width: number; height: number } | null {
    return this.elementSizeOverrides.get(id) ?? null;
  }

  setElementSize(id: string, size: { width: number; height: number }): void {
    this.elementSizeOverrides.set(id, {
      width: Math.max(1, size.width),
      height: Math.max(1, size.height)
    });
  }

  clearElementSize(id: string): void {
    this.elementSizeOverrides.delete(id);
  }

  getElementColor(id: string): ColorRgba | null {
    return this.elementColorOverrides.get(id) ?? null;
  }

  setElementColor(id: string, color: ColorRgba | null): void {
    if (!color) {
      this.elementColorOverrides.delete(id);
      return;
    }

    this.elementColorOverrides.set(id, color);
  }

  clearElementColor(id: string): void {
    this.elementColorOverrides.delete(id);
  }

  clearElementOverrides(id: string): void {
    this.elementOffsets.delete(id);
    this.elementSizeOverrides.delete(id);
    this.elementColorOverrides.delete(id);
  }

  clearAllOverrides(): void {
    this.elementOffsets.clear();
    this.elementSizeOverrides.clear();
    this.elementColorOverrides.clear();
  }

  exportOverridesSnapshot(): RuntimeOverridesSnapshot {
    return {
      offsets: Object.fromEntries(this.elementOffsets.entries()),
      sizes: Object.fromEntries(this.elementSizeOverrides.entries()),
      colors: Object.fromEntries(this.elementColorOverrides.entries())
    };
  }

  importOverridesSnapshot(snapshot: RuntimeOverridesSnapshot | null): void {
    this.clearAllOverrides();
    if (!snapshot) {
      return;
    }

    for (const [id, point] of Object.entries(snapshot.offsets ?? {})) {
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
        this.elementOffsets.set(id, { x: point.x, y: point.y });
      }
    }

    for (const [id, size] of Object.entries(snapshot.sizes ?? {})) {
      if (Number.isFinite(size.width) && Number.isFinite(size.height)) {
        this.elementSizeOverrides.set(id, {
          width: Math.max(1, size.width),
          height: Math.max(1, size.height)
        });
      }
    }

    for (const [id, color] of Object.entries(snapshot.colors ?? {})) {
      if (
        Number.isFinite(color.r) &&
        Number.isFinite(color.g) &&
        Number.isFinite(color.b) &&
        Number.isFinite(color.a)
      ) {
        this.elementColorOverrides.set(id, {
          r: Math.max(0, Math.min(1, color.r)),
          g: Math.max(0, Math.min(1, color.g)),
          b: Math.max(0, Math.min(1, color.b)),
          a: Math.max(0, Math.min(1, color.a))
        });
      }
    }
  }

  pickElementAtScreenPoint(point: Point): string | null {
    for (let i = this.screenCommands.length - 1; i >= 0; i -= 1) {
      const command = this.screenCommands[i];
      if (command.kind !== 'rect') {
        continue;
      }

      if (this.containsPoint(command, point)) {
        return command.elementId;
      }
    }

    return null;
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

    const worldCommands = this.applyElementColors(this.applyElementSizes(this.applyElementOffsets(commands)));
    this.screenCommands = this.projectCommands(worldCommands);
    this.renderer.render(this.screenCommands);
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
    const point = this.toCanvasPoint(event);
    return this.pickElementAtScreenPoint(point);
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

  private applyElementOffsets(commands: DrawCommand[]): DrawCommand[] {
    return commands.map((command: DrawCommand) => {
      if (command.kind !== 'rect') {
        return command;
      }

      const offset = this.getElementOffset(command.elementId);
      if (offset.x === 0 && offset.y === 0) {
        return command;
      }

      return {
        ...command,
        x: command.x + offset.x,
        y: command.y + offset.y
      };
    });
  }

  private applyElementSizes(commands: DrawCommand[]): DrawCommand[] {
    const baseBounds = new Map<string, DrawRectCommand>();
    for (const command of commands) {
      if (command.kind === 'rect' && command.isBounds) {
        baseBounds.set(command.elementId, command);
      }
    }

    return commands.map((command: DrawCommand) => {
      if (command.kind !== 'rect') {
        return command;
      }

      const current = this.elementSizeOverrides.get(command.elementId);
      if (!current) {
        return command;
      }

      if (command.isBounds) {
        return {
          ...command,
          width: current.width,
          height: current.height
        };
      }

      const originalBounds = baseBounds.get(command.elementId);
      if (!originalBounds) {
        return command;
      }

      const epsilon = 0.5;
      const isTop = Math.abs(command.y - originalBounds.y) <= epsilon;
      const isBottom =
        Math.abs(command.y + command.height - (originalBounds.y + originalBounds.height)) <= epsilon;
      const isLeft = Math.abs(command.x - originalBounds.x) <= epsilon;
      const isRight =
        Math.abs(command.x + command.width - (originalBounds.x + originalBounds.width)) <= epsilon;

      if (isTop && command.height <= 6) {
        return {
          ...command,
          x: originalBounds.x,
          y: originalBounds.y,
          width: current.width
        };
      }

      if (isBottom && command.height <= 6) {
        return {
          ...command,
          x: originalBounds.x,
          y: originalBounds.y + current.height - command.height,
          width: current.width
        };
      }

      if (isLeft && command.width <= 6) {
        return {
          ...command,
          x: originalBounds.x,
          y: originalBounds.y,
          height: current.height
        };
      }

      if (isRight && command.width <= 6) {
        return {
          ...command,
          x: originalBounds.x + current.width - command.width,
          y: originalBounds.y,
          height: current.height
        };
      }

      return command;
    });
  }

  private applyElementColors(commands: DrawCommand[]): DrawCommand[] {
    return commands.map((command: DrawCommand) => {
      if (command.kind !== 'rect') {
        return command;
      }

      const color = this.elementColorOverrides.get(command.elementId);
      if (!color) {
        return command;
      }

      return {
        ...command,
        color
      };
    });
  }

  private containsPoint(rect: DrawRectCommand, point: Point): boolean {
    return (
      point.x >= rect.x &&
      point.y >= rect.y &&
      point.x <= rect.x + rect.width &&
      point.y <= rect.y + rect.height
    );
  }
}
