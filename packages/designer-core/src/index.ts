export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export function createCameraState(): CameraState {
  return { x: 0, y: 0, zoom: 1 };
}

export function worldToScreen(point: Vec2, camera: CameraState): Vec2 {
  return {
    x: (point.x - camera.x) * camera.zoom,
    y: (point.y - camera.y) * camera.zoom
  };
}

export function screenToWorld(point: Vec2, camera: CameraState): Vec2 {
  return {
    x: point.x / camera.zoom + camera.x,
    y: point.y / camera.zoom + camera.y
  };
}

export interface DesignerCommand {
  id: string;
  apply(): void;
  undo(): void;
}

export class CommandStack {
  private readonly undoStack: DesignerCommand[] = [];
  private readonly redoStack: DesignerCommand[] = [];

  execute(command: DesignerCommand): void {
    command.apply();
    this.undoStack.push(command);
    this.redoStack.length = 0;
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.apply();
    this.undoStack.push(cmd);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
