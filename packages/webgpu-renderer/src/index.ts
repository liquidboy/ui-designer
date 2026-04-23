import type { ColorRgba, DrawCommand, DrawTextCommand } from '@ui-designer/ui-core';

interface AtlasTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  lineHeight: number;
}

interface GlyphEntry {
  atlasX: number;
  atlasY: number;
  width: number;
  height: number;
  advance: number;
  left: number;
  ascent: number;
  visible: boolean;
}

interface FontMetrics {
  font: string;
  ascent: number;
  descent: number;
  lineHeight: number;
}

interface GlyphRunItem {
  character: string;
  glyph: GlyphEntry;
  advance: number;
}

interface TextLayoutLine {
  items: GlyphRunItem[];
  width: number;
}

interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RendererDebugSnapshot {
  rectCommands: number;
  textCommands: number;
  textGlyphs: number;
  atlasGlyphs: number;
  atlasUploads: number;
  lastError: string | null;
}

const rectShaderSource = `
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

const textShaderSource = `
struct VertexOut {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
  @location(1) color : vec4<f32>,
};

@group(0) @binding(0) var atlasSampler : sampler;
@group(0) @binding(1) var atlasTexture : texture_2d<f32>;

@vertex
fn vs_main(
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) color: vec4<f32>
) -> VertexOut {
  var out: VertexOut;
  out.position = vec4<f32>(position, 0.0, 1.0);
  out.uv = uv;
  out.color = color;
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let coverage = textureSample(atlasTexture, atlasSampler, in.uv).a;
  return vec4<f32>(in.color.rgb, in.color.a * coverage);
}
`;

class GlyphAtlas {
  readonly width: number;
  readonly height: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly glyphs = new Map<string, GlyphEntry>();
  private readonly fonts = new Map<string, FontMetrics>();
  private readonly padding = 2;
  private cursorX = 0;
  private cursorY = 0;
  private rowHeight = 0;
  private dirty = false;

  constructor(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create 2D canvas context for text atlas.');
    }

    context.clearRect(0, 0, width, height);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#ffffff';

    this.width = width;
    this.height = height;
    this.canvas = canvas;
    this.context = context;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  markClean(): void {
    this.dirty = false;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getImageData(): ImageData {
    return this.context.getImageData(0, 0, this.width, this.height);
  }

  getGlyphCount(): number {
    return this.glyphs.size;
  }

  getFontMetrics(style: AtlasTextStyle): FontMetrics {
    const key = this.fontKey(style);
    const existing = this.fonts.get(key);
    if (existing) {
      return existing;
    }

    const font = this.fontString(style);
    this.context.font = font;

    const metrics = this.context.measureText('Hg');
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || style.fontSize * 0.8);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || style.fontSize * 0.2);
    const lineHeight = Math.max(Math.ceil(style.lineHeight), ascent + descent);

    const next = {
      font,
      ascent,
      descent,
      lineHeight
    };
    this.fonts.set(key, next);
    return next;
  }

  getGlyph(style: AtlasTextStyle, character: string): GlyphEntry {
    const key = `${this.fontKey(style)}\u0000${character}`;
    const existing = this.glyphs.get(key);
    if (existing) {
      return existing;
    }

    const fontMetrics = this.getFontMetrics(style);
    this.context.font = fontMetrics.font;

    const measurement = this.context.measureText(character || ' ');
    const advance = measurement.width;
    const left = Number.isFinite(measurement.actualBoundingBoxLeft) ? measurement.actualBoundingBoxLeft : 0;
    const right = Number.isFinite(measurement.actualBoundingBoxRight)
      ? measurement.actualBoundingBoxRight
      : advance;
    const ascent = Number.isFinite(measurement.actualBoundingBoxAscent)
      ? measurement.actualBoundingBoxAscent
      : fontMetrics.ascent;
    const descent = Number.isFinite(measurement.actualBoundingBoxDescent)
      ? measurement.actualBoundingBoxDescent
      : fontMetrics.descent;
    const pixelWidth = Math.ceil(Math.max(advance, left + right));
    const pixelHeight = Math.ceil(ascent + descent);

    if (pixelWidth <= 0 || pixelHeight <= 0) {
      const invisible = {
        atlasX: 0,
        atlasY: 0,
        width: 0,
        height: 0,
        advance,
        left,
        ascent,
        visible: false
      };
      this.glyphs.set(key, invisible);
      return invisible;
    }

    const allocationWidth = pixelWidth + this.padding * 2;
    const allocationHeight = pixelHeight + this.padding * 2;
    const slot = this.allocate(allocationWidth, allocationHeight);

    this.context.clearRect(slot.x, slot.y, allocationWidth, allocationHeight);
    this.context.font = fontMetrics.font;
    this.context.fillStyle = '#ffffff';
    this.context.fillText(character, slot.x + this.padding + left, slot.y + this.padding + ascent);

    const glyph = {
      atlasX: slot.x + this.padding,
      atlasY: slot.y + this.padding,
      width: pixelWidth,
      height: pixelHeight,
      advance,
      left,
      ascent,
      visible: true
    };

    this.glyphs.set(key, glyph);
    this.dirty = true;
    return glyph;
  }

  private fontKey(style: AtlasTextStyle): string {
    const fontSize = Math.max(1, Math.round(style.fontSize));
    return `${style.fontStyle}|${style.fontWeight}|${fontSize}|${style.fontFamily}`;
  }

  private fontString(style: AtlasTextStyle): string {
    const fontSize = Math.max(1, Math.round(style.fontSize));
    return `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  }

  private allocate(width: number, height: number): { x: number; y: number } {
    if (width > this.width || height > this.height) {
      throw new Error('Text atlas glyph exceeds atlas dimensions.');
    }

    if (this.cursorX + width > this.width) {
      this.cursorX = 0;
      this.cursorY += this.rowHeight;
      this.rowHeight = 0;
    }

    if (this.cursorY + height > this.height) {
      throw new Error('Text atlas is full. Increase atlas dimensions for this scene.');
    }

    const slot = {
      x: this.cursorX,
      y: this.cursorY
    };

    this.cursorX += width;
    this.rowHeight = Math.max(this.rowHeight, height);
    return slot;
  }
}

export class WebGPUCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private format: GPUTextureFormat | null = null;
  private rectPipeline: GPURenderPipeline | null = null;
  private textPipeline: GPURenderPipeline | null = null;
  private textAtlas: GlyphAtlas | null = null;
  private textTexture: GPUTexture | null = null;
  private textSampler: GPUSampler | null = null;
  private textBindGroup: GPUBindGroup | null = null;
  private atlasUploadCount = 0;
  private debugSnapshot: RendererDebugSnapshot = {
    rectCommands: 0,
    textCommands: 0,
    textGlyphs: 0,
    atlasGlyphs: 0,
    atlasUploads: 0,
    lastError: null
  };

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

    this.rectPipeline = this.createRectPipeline();
    this.textPipeline = this.createTextPipeline();
    this.initializeTextResources();
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
    if (!this.device || !this.context || !this.rectPipeline) {
      return;
    }

    const rectVertices = this.buildRectVertexArray(commands);
    let textVertices: Float32Array<ArrayBufferLike> = new Float32Array(0);
    let textError: string | null = null;

    try {
      textVertices = this.buildTextVertexArray(commands);
      if (textVertices.length > 0) {
        this.uploadTextAtlas();
      }
    } catch (error) {
      textError = error instanceof Error ? error.message : String(error);
      textVertices = new Float32Array(0);
    }

    this.debugSnapshot = {
      rectCommands: commands.filter((command) => command.kind === 'rect').length,
      textCommands: commands.filter((command) => command.kind === 'text').length,
      textGlyphs: textVertices.length / 48,
      atlasGlyphs: this.textAtlas?.getGlyphCount() ?? 0,
      atlasUploads: this.atlasUploadCount,
      lastError: textError
    };

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

    if (rectVertices.length > 0) {
      const vertexBuffer = this.createVertexBuffer(rectVertices);
      pass.setPipeline(this.rectPipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(rectVertices.length / 6);
    }

    if (textVertices.length > 0 && this.textPipeline && this.textBindGroup) {
      const vertexBuffer = this.createVertexBuffer(textVertices);
      pass.setPipeline(this.textPipeline);
      pass.setBindGroup(0, this.textBindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(textVertices.length / 8);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  renderClear(r: number, g: number, b: number): void {
    this.render([], { r, g, b, a: 1 });
  }

  getDebugSnapshot(): RendererDebugSnapshot {
    return { ...this.debugSnapshot };
  }

  private initializeTextResources(): void {
    if (!this.device || !this.textPipeline) {
      throw new Error('Cannot initialize text resources before the renderer is ready.');
    }

    this.textAtlas = new GlyphAtlas(2048, 2048);
    this.textTexture = this.device.createTexture({
      size: [this.textAtlas.width, this.textAtlas.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    this.textSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });
    this.textBindGroup = this.device.createBindGroup({
      layout: this.textPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.textSampler
        },
        {
          binding: 1,
          resource: this.textTexture.createView()
        }
      ]
    });
  }

  private uploadTextAtlas(): void {
    if (!this.device || !this.textAtlas || !this.textTexture || !this.textAtlas.isDirty()) {
      return;
    }

    const imageData = this.textAtlas.getImageData();
    this.device.queue.writeTexture(
      { texture: this.textTexture },
      imageData.data,
      {
        bytesPerRow: this.textAtlas.width * 4,
        rowsPerImage: this.textAtlas.height
      },
      {
        width: this.textAtlas.width,
        height: this.textAtlas.height
      }
    );

    this.atlasUploadCount += 1;
    this.textAtlas.markClean();
  }

  private createRectPipeline(): GPURenderPipeline {
    if (!this.device || !this.format) {
      throw new Error('Cannot create pipeline before renderer is initialized.');
    }

    const shaderModule = this.device.createShaderModule({
      code: rectShaderSource
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
        targets: [
          {
            format: this.format,
            blend: this.createAlphaBlendState()
          }
        ]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
  }

  private createTextPipeline(): GPURenderPipeline {
    if (!this.device || !this.format) {
      throw new Error('Cannot create pipeline before renderer is initialized.');
    }

    const shaderModule = this.device.createShaderModule({
      code: textShaderSource
    });

    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' },
              { shaderLocation: 2, offset: 16, format: 'float32x4' }
            ]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.format,
            blend: this.createAlphaBlendState()
          }
        ]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
  }

  private createAlphaBlendState(): GPUBlendState {
    return {
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add'
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add'
      }
    };
  }

  private buildRectVertexArray(commands: DrawCommand[]): Float32Array {
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

      offset = this.pushRectVertex(array, offset, x1, y1, command.color);
      offset = this.pushRectVertex(array, offset, x2, y1, command.color);
      offset = this.pushRectVertex(array, offset, x1, y2, command.color);

      offset = this.pushRectVertex(array, offset, x2, y1, command.color);
      offset = this.pushRectVertex(array, offset, x2, y2, command.color);
      offset = this.pushRectVertex(array, offset, x1, y2, command.color);
    }

    return array.subarray(0, offset);
  }

  private buildTextVertexArray(commands: DrawCommand[]): Float32Array {
    if (!this.textAtlas) {
      return new Float32Array(0);
    }

    const vertices: number[] = [];

    for (const command of commands) {
      if (command.kind !== 'text' || !command.text) {
        continue;
      }

      this.pushTextVertices(vertices, command);
    }

    return new Float32Array(vertices);
  }

  private pushTextVertices(target: number[], command: DrawTextCommand): void {
    if (!this.textAtlas) {
      return;
    }

    const style = this.normalizeTextStyle(command);
    const fontMetrics = this.textAtlas.getFontMetrics(style);
    const lineHeight = Math.max(style.lineHeight, fontMetrics.lineHeight);
    const clipRect = command.overflow === 'visible' ? null : command;
    const lines = this.applyOverflowToLines(command, style, this.layoutTextLines(command, style), lineHeight);
    const totalHeight = lineHeight * Math.max(lines.length, 1);
    let lineTop = this.resolveVerticalOrigin(command, totalHeight);

    for (const line of lines) {
      let penX = this.resolveHorizontalOrigin(command, line.width);
      const baselineY = lineTop + (lineHeight - fontMetrics.lineHeight) / 2 + fontMetrics.ascent;

      for (const item of line.items) {
        if (item.glyph.visible && item.glyph.width > 0 && item.glyph.height > 0) {
          const x = penX - item.glyph.left;
          const y = baselineY - item.glyph.ascent;
          this.pushGlyphQuad(target, x, y, item.glyph.width, item.glyph.height, item.glyph, command.color, clipRect);
        }

        penX += item.advance;
      }

      lineTop += lineHeight;
    }
  }

  private layoutTextLines(command: DrawTextCommand, style: AtlasTextStyle): TextLayoutLine[] {
    const paragraphs = command.text.replace(/\t/g, '    ').split(/\r?\n/);
    const maxWidth = Math.max(0, command.width);
    const lines = paragraphs.flatMap((paragraph) =>
      this.layoutParagraphItems(this.createGlyphRunItems(style, paragraph), maxWidth, command.wrapping)
    );

    return lines.length > 0 ? lines : [{ items: [], width: 0 }];
  }

  private createGlyphRunItems(style: AtlasTextStyle, text: string): GlyphRunItem[] {
    if (!this.textAtlas) {
      return [];
    }

    return [...text].map((character) => {
      const glyph = this.textAtlas!.getGlyph(style, character);
      return {
        character,
        glyph,
        advance: glyph.advance
      };
    });
  }

  private layoutParagraphItems(
    items: GlyphRunItem[],
    maxWidth: number,
    wrapping: DrawTextCommand['wrapping']
  ): TextLayoutLine[] {
    if (items.length === 0) {
      return [{ items: [], width: 0 }];
    }

    if (wrapping !== 'wrap' || maxWidth <= 0) {
      const trimmed = this.trimTrailingWhitespaceItems(items);
      return [{ items: trimmed, width: this.sumAdvance(trimmed) }];
    }

    const lines: TextLayoutLine[] = [];
    let remaining = items.slice();

    while (remaining.length > 0) {
      let width = 0;
      let end = 0;
      let lastBreak = -1;

      while (end < remaining.length) {
        const item = remaining[end];
        const nextWidth = width + item.advance;

        if (this.isBreakCharacter(item.character)) {
          lastBreak = end;
        }

        if (end > 0 && nextWidth > maxWidth) {
          break;
        }

        width = nextWidth;
        end += 1;
      }

      if (end >= remaining.length) {
        const trimmed = this.trimTrailingWhitespaceItems(remaining);
        lines.push({ items: trimmed, width: this.sumAdvance(trimmed) });
        break;
      }

      const lineEnd = lastBreak >= 0 ? lastBreak + 1 : Math.max(1, end);
      const lineItems = this.trimTrailingWhitespaceItems(remaining.slice(0, lineEnd));
      lines.push({ items: lineItems, width: this.sumAdvance(lineItems) });
      remaining = this.trimLeadingWhitespaceItems(remaining.slice(lineEnd));
    }

    return lines.length > 0 ? lines : [{ items: [], width: 0 }];
  }

  private applyOverflowToLines(
    command: DrawTextCommand,
    style: AtlasTextStyle,
    lines: TextLayoutLine[],
    lineHeight: number
  ): TextLayoutLine[] {
    if (command.overflow !== 'ellipsis') {
      return lines;
    }

    const maxVisibleLines =
      command.height > 0 ? Math.max(1, Math.floor(command.height / lineHeight)) : Number.POSITIVE_INFINITY;
    const visibleLines = Number.isFinite(maxVisibleLines) ? lines.slice(0, maxVisibleLines) : lines.slice();
    const hiddenLines = lines.length > visibleLines.length;

    return visibleLines.map((line, index) => {
      const shouldForceEllipsis = hiddenLines && index === visibleLines.length - 1;
      const shouldTrimWidth = line.width > command.width;

      if (!shouldForceEllipsis && !shouldTrimWidth) {
        return line;
      }

      return this.fitLineWithEllipsis(line.items, command.width, style, shouldForceEllipsis);
    });
  }

  private fitLineWithEllipsis(
    items: GlyphRunItem[],
    maxWidth: number,
    style: AtlasTextStyle,
    forceEllipsis: boolean
  ): TextLayoutLine {
    if (!this.textAtlas) {
      return { items: [], width: 0 };
    }

    const trimmed = this.trimTrailingWhitespaceItems(items);
    const width = this.sumAdvance(trimmed);
    if (!forceEllipsis && width <= maxWidth) {
      return { items: trimmed, width };
    }

    const ellipsisGlyph = this.textAtlas.getGlyph(style, '…');
    const ellipsisItem: GlyphRunItem = {
      character: '…',
      glyph: ellipsisGlyph,
      advance: ellipsisGlyph.advance
    };

    if (maxWidth <= 0) {
      return { items: [], width: 0 };
    }

    const result: GlyphRunItem[] = [];
    let resultWidth = 0;

    for (const item of trimmed) {
      const nextWidth = resultWidth + item.advance + ellipsisItem.advance;
      if (result.length > 0 && nextWidth > maxWidth) {
        break;
      }

      if (result.length === 0 && ellipsisItem.advance > maxWidth) {
        break;
      }

      if (nextWidth > maxWidth) {
        break;
      }

      result.push(item);
      resultWidth += item.advance;
    }

    return {
      items: [...result, ellipsisItem],
      width: resultWidth + ellipsisItem.advance
    };
  }

  private trimLeadingWhitespaceItems(items: GlyphRunItem[]): GlyphRunItem[] {
    let start = 0;
    while (start < items.length && this.isBreakCharacter(items[start].character)) {
      start += 1;
    }

    return items.slice(start);
  }

  private trimTrailingWhitespaceItems(items: GlyphRunItem[]): GlyphRunItem[] {
    let end = items.length;
    while (end > 0 && this.isBreakCharacter(items[end - 1].character)) {
      end -= 1;
    }

    return items.slice(0, end);
  }

  private sumAdvance(items: GlyphRunItem[]): number {
    return items.reduce((sum, item) => sum + item.advance, 0);
  }

  private isBreakCharacter(character: string): boolean {
    return /\s/.test(character);
  }

  private pushGlyphQuad(
    target: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    glyph: GlyphEntry,
    color: ColorRgba,
    clipRect: ClipRect | null
  ): void {
    if (!this.textAtlas) {
      return;
    }

    let quadX1 = x;
    let quadY1 = y;
    let quadX2 = x + width;
    let quadY2 = y + height;

    const baseU1 = glyph.atlasX / this.textAtlas.width;
    const baseV1 = glyph.atlasY / this.textAtlas.height;
    const baseU2 = (glyph.atlasX + glyph.width) / this.textAtlas.width;
    const baseV2 = (glyph.atlasY + glyph.height) / this.textAtlas.height;
    let u1 = baseU1;
    let v1 = baseV1;
    let u2 = baseU2;
    let v2 = baseV2;

    if (clipRect) {
      const clipX1 = clipRect.x;
      const clipY1 = clipRect.y;
      const clipX2 = clipRect.x + clipRect.width;
      const clipY2 = clipRect.y + clipRect.height;
      const nextX1 = Math.max(quadX1, clipX1);
      const nextY1 = Math.max(quadY1, clipY1);
      const nextX2 = Math.min(quadX2, clipX2);
      const nextY2 = Math.min(quadY2, clipY2);

      if (nextX1 >= nextX2 || nextY1 >= nextY2) {
        return;
      }

      const du = baseU2 - baseU1;
      const dv = baseV2 - baseV1;
      u1 = baseU1 + ((nextX1 - quadX1) / width) * du;
      v1 = baseV1 + ((nextY1 - quadY1) / height) * dv;
      u2 = baseU1 + ((nextX2 - quadX1) / width) * du;
      v2 = baseV1 + ((nextY2 - quadY1) / height) * dv;
      quadX1 = nextX1;
      quadY1 = nextY1;
      quadX2 = nextX2;
      quadY2 = nextY2;
    }

    const x1 = this.toNdcX(quadX1);
    const y1 = this.toNdcY(quadY1);
    const x2 = this.toNdcX(quadX2);
    const y2 = this.toNdcY(quadY2);

    this.pushTextVertex(target, x1, y1, u1, v1, color);
    this.pushTextVertex(target, x2, y1, u2, v1, color);
    this.pushTextVertex(target, x1, y2, u1, v2, color);

    this.pushTextVertex(target, x2, y1, u2, v1, color);
    this.pushTextVertex(target, x2, y2, u2, v2, color);
    this.pushTextVertex(target, x1, y2, u1, v2, color);
  }

  private normalizeTextStyle(command: DrawTextCommand): AtlasTextStyle {
    return {
      fontFamily: command.fontFamily,
      fontWeight: command.fontWeight,
      fontStyle: command.fontStyle,
      fontSize: Math.max(1, Math.round(command.fontSize)),
      lineHeight: Math.max(1, Math.round(command.lineHeight))
    };
  }

  private resolveHorizontalOrigin(command: DrawTextCommand, textWidth: number): number {
    switch (command.align) {
      case 'center':
        return command.x + (command.width - textWidth) / 2;
      case 'right':
        return command.x + command.width - textWidth;
      default:
        return command.x;
    }
  }

  private resolveVerticalOrigin(command: DrawTextCommand, textHeight: number): number {
    switch (command.verticalAlign) {
      case 'middle':
        return command.y + (command.height - textHeight) / 2;
      case 'bottom':
        return command.y + command.height - textHeight;
      default:
        return command.y;
    }
  }

  private createVertexBuffer(vertices: Float32Array): GPUBuffer {
    if (!this.device) {
      throw new Error('Cannot allocate a vertex buffer before the renderer is initialized.');
    }

    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });

    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();
    return vertexBuffer;
  }

  private pushRectVertex(target: Float32Array, offset: number, x: number, y: number, color: ColorRgba): number {
    target[offset++] = x;
    target[offset++] = y;
    target[offset++] = color.r;
    target[offset++] = color.g;
    target[offset++] = color.b;
    target[offset++] = color.a;
    return offset;
  }

  private pushTextVertex(target: number[], x: number, y: number, u: number, v: number, color: ColorRgba): void {
    target.push(x, y, u, v, color.r, color.g, color.b, color.a);
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
