import { inferTextDirection, type ColorRgba, type DrawCommand, type DrawImageCommand, type DrawTextCommand, type TextDirection } from '@ui-designer/ui-core';

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

interface TextWrapToken {
  text: string;
  width: number;
  isWhitespace: boolean;
}

interface TextLayoutLine {
  text: string;
  width: number;
  direction: Exclude<TextDirection, 'auto'>;
}

interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageTextureEntry {
  texture: GPUTexture;
  bindGroup: GPUBindGroup;
  width: number;
  height: number;
}

export interface RendererFontFaceDefinition {
  family: string;
  source: string;
  weight?: string | number;
  style?: string;
  stretch?: string;
  display?: string;
  unicodeRange?: string;
}

export interface RendererDebugSnapshot {
  rectCommands: number;
  textCommands: number;
  imageCommands: number;
  textGlyphs: number;
  atlasGlyphs: number;
  atlasUploads: number;
  imageTextures: number;
  pendingImageLoads: number;
  pendingFontLoads: number;
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

const imageShaderSource = `
struct VertexOut {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
  @location(1) color : vec4<f32>,
};

@group(0) @binding(0) var imageSampler : sampler;
@group(0) @binding(1) var imageTexture : texture_2d<f32>;

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
  return textureSample(imageTexture, imageSampler, in.uv) * in.color;
}
`;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
const wordSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null;

function segmentText(text: string): string[] {
  if (!text) {
    return [];
  }

  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment);
  }

  return [...text];
}

function tokenizeWords(text: string): string[] {
  if (!text) {
    return [];
  }

  if (wordSegmenter) {
    const segments = Array.from(wordSegmenter.segment(text), (segment) => segment.segment);
    if (segments.length > 0) {
      return segments;
    }
  }

  return text.match(/\s+|\S+/g) ?? [];
}

function normalizeFontFaceStyle(value: string | undefined): FontFaceDescriptors['style'] | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'italic' || normalized === 'oblique' || normalized === 'normal') {
    return normalized;
  }

  return undefined;
}

function normalizeFontFaceWeight(value: string | number | undefined): FontFaceDescriptors['weight'] | undefined {
  if (value == null) {
    return undefined;
  }

  return `${value}`;
}

function normalizeFontFaceDisplay(value: string | undefined): FontFaceDescriptors['display'] | undefined {
  if (!value) {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case 'auto':
    case 'block':
    case 'swap':
    case 'fallback':
    case 'optional':
      return value.trim().toLowerCase() as FontDisplay;
    default:
      return undefined;
  }
}

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

  measureTextWidth(style: AtlasTextStyle, text: string, direction: Exclude<TextDirection, 'auto'>): number {
    if (!text) {
      return 0;
    }

    const fontMetrics = this.getFontMetrics(style);
    this.context.font = fontMetrics.font;
    this.context.direction = direction;
    return this.context.measureText(text).width;
  }

  getGlyph(style: AtlasTextStyle, text: string, direction: Exclude<TextDirection, 'auto'>): GlyphEntry {
    const key = `${this.fontKey(style)}|${direction}\u0000${text}`;
    const existing = this.glyphs.get(key);
    if (existing) {
      return existing;
    }

    const fontMetrics = this.getFontMetrics(style);
    this.context.font = fontMetrics.font;
    this.context.direction = direction;

    const measurement = this.context.measureText(text || ' ');
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
    this.context.direction = direction;
    this.context.fillStyle = '#ffffff';
    this.context.fillText(text, slot.x + this.padding + left, slot.y + this.padding + ascent);

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
  private imagePipeline: GPURenderPipeline | null = null;
  private textAtlas: GlyphAtlas | null = null;
  private textTexture: GPUTexture | null = null;
  private textSampler: GPUSampler | null = null;
  private textBindGroup: GPUBindGroup | null = null;
  private imageSampler: GPUSampler | null = null;
  private readonly imageTextures = new Map<string, ImageTextureEntry>();
  private readonly pendingImageLoads = new Map<string, Promise<void>>();
  private readonly pendingFontLoads = new Map<string, Promise<void>>();
  private readonly pendingFontFaceRegistrations = new Map<string, Promise<void>>();
  private readonly resolvedFontLoads = new Set<string>();
  private readonly registeredFontFaces = new Set<string>();
  private atlasUploadCount = 0;
  private lastResourceError: string | null = null;
  private debugSnapshot: RendererDebugSnapshot = {
    rectCommands: 0,
    textCommands: 0,
    imageCommands: 0,
    textGlyphs: 0,
    atlasGlyphs: 0,
    atlasUploads: 0,
    imageTextures: 0,
    pendingImageLoads: 0,
    pendingFontLoads: 0,
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
    this.imagePipeline = this.createImagePipeline();
    this.initializeTextResources();
    this.initializeImageResources();
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

  async registerFontFaces(fontFaces: readonly RendererFontFaceDefinition[] = []): Promise<void> {
    const tasks = fontFaces.map((definition) => this.registerFontFace(definition));
    if (tasks.length === 0) {
      return;
    }

    await Promise.allSettled(tasks);
  }

  async preloadResources(commands: DrawCommand[]): Promise<void> {
    const tasks = [
      ...this.collectFontLoadTasks(commands),
      ...this.collectImageLoadTasks(commands)
    ];

    if (tasks.length === 0) {
      return;
    }

    await Promise.allSettled(tasks);
  }

  render(commands: DrawCommand[], clearColor: ColorRgba = { r: 0.08, g: 0.1, b: 0.14, a: 1 }): void {
    if (!this.device || !this.context || !this.rectPipeline) {
      return;
    }

    this.queueResourceLoads(commands);

    const rectVertices = this.buildRectVertexArray(commands);
    let textVertices: Float32Array<ArrayBufferLike> = new Float32Array(0);
    let textError: string | null = null;
    let imageBatches = new Map<string, Float32Array<ArrayBufferLike>>();
    let imageError: string | null = null;

    try {
      textVertices = this.buildTextVertexArray(commands);
      if (textVertices.length > 0) {
        this.uploadTextAtlas();
      }
    } catch (error) {
      textError = error instanceof Error ? error.message : String(error);
      textVertices = new Float32Array(0);
    }

    try {
      imageBatches = this.buildImageVertexBatches(commands);
    } catch (error) {
      imageError = error instanceof Error ? error.message : String(error);
      imageBatches = new Map<string, Float32Array<ArrayBufferLike>>();
    }

    this.debugSnapshot = {
      rectCommands: commands.filter((command) => command.kind === 'rect').length,
      textCommands: commands.filter((command) => command.kind === 'text').length,
      imageCommands: commands.filter((command) => command.kind === 'image').length,
      textGlyphs: textVertices.length / 48,
      atlasGlyphs: this.textAtlas?.getGlyphCount() ?? 0,
      atlasUploads: this.atlasUploadCount,
      imageTextures: this.imageTextures.size,
      pendingImageLoads: this.pendingImageLoads.size,
      pendingFontLoads: this.pendingFontLoads.size + this.pendingFontFaceRegistrations.size,
      lastError: imageError ?? textError ?? this.lastResourceError
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

    if (imageBatches.size > 0 && this.imagePipeline) {
      pass.setPipeline(this.imagePipeline);

      for (const [source, vertices] of imageBatches) {
        const entry = this.imageTextures.get(source);
        if (!entry || vertices.length === 0) {
          continue;
        }

        const vertexBuffer = this.createVertexBuffer(vertices);
        pass.setBindGroup(0, entry.bindGroup);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertices.length / 8);
      }
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

  private initializeImageResources(): void {
    if (!this.device) {
      throw new Error('Cannot initialize image resources before the renderer is ready.');
    }

    this.imageSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
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

  private createImagePipeline(): GPURenderPipeline {
    if (!this.device || !this.format) {
      throw new Error('Cannot create pipeline before renderer is initialized.');
    }

    const shaderModule = this.device.createShaderModule({
      code: imageShaderSource
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

  private queueResourceLoads(commands: DrawCommand[]): void {
    for (const task of this.collectFontLoadTasks(commands)) {
      void task.catch(() => undefined);
    }

    for (const task of this.collectImageLoadTasks(commands)) {
      void task.catch(() => undefined);
    }
  }

  private collectFontLoadTasks(commands: DrawCommand[]): Promise<void>[] {
    const tasks: Promise<void>[] = [];
    const seen = new Set<string>();

    for (const command of commands) {
      if (command.kind !== 'text') {
        continue;
      }

      const style = this.normalizeTextStyle(command);
      const key = this.fontStyleKey(style);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const task = this.ensureFontLoaded(style);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  private collectImageLoadTasks(commands: DrawCommand[]): Promise<void>[] {
    const tasks: Promise<void>[] = [];
    const seen = new Set<string>();

    for (const command of commands) {
      if (command.kind !== 'image' || !command.source || seen.has(command.source)) {
        continue;
      }

      seen.add(command.source);
      tasks.push(this.ensureImageLoaded(command.source));
    }

    return tasks;
  }

  private ensureFontLoaded(style: AtlasTextStyle): Promise<void> | null {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      return null;
    }

    const key = this.fontStyleKey(style);
    if (this.resolvedFontLoads.has(key)) {
      return null;
    }

    const pending = this.pendingFontLoads.get(key);
    if (pending) {
      return pending;
    }

    const font = this.fontString(style);
    const task = document.fonts
      .load(font, 'Hamburgefontsiv')
      .then(() => undefined)
      .catch((error: unknown) => {
        this.lastResourceError = `Font load failed for ${font}: ${error instanceof Error ? error.message : String(error)}`;
      })
      .finally(() => {
        this.pendingFontLoads.delete(key);
        this.resolvedFontLoads.add(key);
      });

    this.pendingFontLoads.set(key, task);
    return task;
  }

  private async registerFontFace(definition: RendererFontFaceDefinition): Promise<void> {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !definition.source.trim()) {
      return;
    }

    const key = [
      definition.family,
      definition.style ?? 'normal',
      definition.weight ?? '400',
      definition.stretch ?? 'normal',
      definition.source
    ].join('|');

    if (this.registeredFontFaces.has(key)) {
      return;
    }

    const pending = this.pendingFontFaceRegistrations.get(key);
    if (pending) {
      return pending;
    }

    const task = (async () => {
      try {
        const fontFace = new FontFace(definition.family, definition.source, {
          style: normalizeFontFaceStyle(definition.style),
          weight: normalizeFontFaceWeight(definition.weight),
          stretch: definition.stretch,
          display: normalizeFontFaceDisplay(definition.display),
          unicodeRange: definition.unicodeRange
        });
        await fontFace.load();
        document.fonts.add(fontFace);
        this.registeredFontFaces.add(key);
      } catch (error) {
        this.lastResourceError = `Font face registration failed for ${definition.family}: ${
          error instanceof Error ? error.message : String(error)
        }`;
      } finally {
        this.pendingFontFaceRegistrations.delete(key);
      }
    })();

    this.pendingFontFaceRegistrations.set(key, task);
    return task;
  }

  private async ensureImageLoaded(source: string): Promise<void> {
    if (!this.device || !this.imagePipeline || !this.imageSampler) {
      return;
    }

    if (this.imageTextures.has(source)) {
      return;
    }

    const pending = this.pendingImageLoads.get(source);
    if (pending) {
      return pending;
    }

    const task = (async () => {
      try {
        const image = await this.loadImageBitmap(source);
        const texture = this.device!.createTexture({
          size: [image.width, image.height, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });

        this.device!.queue.copyExternalImageToTexture(
          { source: image },
          { texture },
          { width: image.width, height: image.height }
        );

        const bindGroup = this.device!.createBindGroup({
          layout: this.imagePipeline!.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: this.imageSampler!
            },
            {
              binding: 1,
              resource: texture.createView()
            }
          ]
        });

        this.imageTextures.set(source, {
          texture,
          bindGroup,
          width: image.width,
          height: image.height
        });

        image.close();
      } catch (error) {
        this.lastResourceError = `Image load failed for ${source}: ${error instanceof Error ? error.message : String(error)}`;
      } finally {
        this.pendingImageLoads.delete(source);
      }
    })();

    this.pendingImageLoads.set(source, task);
    return task;
  }

  private async loadImageBitmap(source: string): Promise<ImageBitmap> {
    if (typeof createImageBitmap !== 'function') {
      throw new Error('createImageBitmap is not available in this browser.');
    }

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    return createImageBitmap(blob);
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

  private buildImageVertexBatches(commands: DrawCommand[]): Map<string, Float32Array> {
    const batches = new Map<string, number[]>();

    for (const command of commands) {
      if (command.kind !== 'image' || !command.source) {
        continue;
      }

      const image = this.imageTextures.get(command.source);
      if (!image) {
        continue;
      }

      let batch = batches.get(command.source);
      if (!batch) {
        batch = [];
        batches.set(command.source, batch);
      }

      this.pushImageVertices(batch, command, image);
    }

    return new Map(Array.from(batches, ([source, vertices]) => [source, new Float32Array(vertices)]));
  }

  private pushTextVertices(target: number[], command: DrawTextCommand): void {
    if (!this.textAtlas) {
      return;
    }

    const style = this.normalizeTextStyle(command);
    const lines = this.layoutTextLines(command, style);
    const fontMetrics = this.textAtlas.getFontMetrics(style);
    const lineHeight = Math.max(style.lineHeight, fontMetrics.lineHeight);
    const clipRect = command.overflow === 'visible' ? null : command;
    const visibleLines = this.applyOverflowToLines(command, style, lines, lineHeight);
    const totalHeight = lineHeight * Math.max(visibleLines.length, 1);
    let lineTop = this.resolveVerticalOrigin(command, totalHeight);

    for (const line of visibleLines) {
      const glyph = line.text ? this.textAtlas.getGlyph(style, line.text, line.direction) : null;
      const baselineY = lineTop + (lineHeight - fontMetrics.lineHeight) / 2 + fontMetrics.ascent;
      const originX = this.resolveHorizontalOrigin(command, line.width);

      if (glyph && glyph.visible && glyph.width > 0 && glyph.height > 0) {
        const x = originX - glyph.left;
        const y = baselineY - glyph.ascent;
        this.pushGlyphQuad(target, x, y, glyph.width, glyph.height, glyph, command.color, clipRect);
      }

      lineTop += lineHeight;
    }
  }

  private pushImageVertices(target: number[], command: DrawImageCommand, image: ImageTextureEntry): void {
    const quad = this.resolveImageQuad(command, image);
    if (!quad) {
      return;
    }

    this.pushTexturedQuad(
      target,
      quad.x,
      quad.y,
      quad.width,
      quad.height,
      quad.u1,
      quad.v1,
      quad.u2,
      quad.v2,
      { r: 1, g: 1, b: 1, a: command.opacity },
      null
    );
  }

  private layoutTextLines(command: DrawTextCommand, style: AtlasTextStyle): TextLayoutLine[] {
    const paragraphs = command.text.replace(/\t/g, '    ').split(/\r?\n/);
    const maxWidth = Math.max(0, command.width);
    const lines = paragraphs.flatMap((paragraph) =>
      this.layoutParagraphText(
        paragraph,
        maxWidth,
        command.wrapping,
        style,
        this.resolveCommandTextDirection(command, paragraph)
      )
    );

    return lines.length > 0
      ? lines
      : [{ text: '', width: 0, direction: this.resolveCommandTextDirection(command, command.text) }];
  }

  private layoutParagraphText(
    paragraph: string,
    maxWidth: number,
    wrapping: DrawTextCommand['wrapping'],
    style: AtlasTextStyle,
    direction: Exclude<TextDirection, 'auto'>
  ): TextLayoutLine[] {
    if (!paragraph) {
      return [{ text: '', width: 0, direction }];
    }

    if (wrapping !== 'wrap' || maxWidth <= 0) {
      const trimmed = paragraph.trimEnd();
      return [
        {
          text: trimmed,
          width: this.measureTextWidth(style, trimmed, direction),
          direction
        }
      ];
    }

    const items = this.tokenizeWrapTokens(style, paragraph, maxWidth, direction);
    const lines: TextLayoutLine[] = [];
    let remaining = items.slice();

    while (remaining.length > 0) {
      let current = '';
      let currentWidth = 0;
      let end = 0;
      let lastBreak = -1;

      while (end < remaining.length) {
        const item = remaining[end];
        if (item.isWhitespace && current.length === 0) {
          end += 1;
          continue;
        }

        const text = current.length === 0 ? item.text.replace(/^\s+/, '') : item.text;
        if (!text) {
          end += 1;
          continue;
        }

        const candidate = current + text;
        const nextWidth = this.measureTextWidth(style, candidate, direction);

        if (item.isWhitespace) {
          lastBreak = end;
        }

        if (end > 0 && nextWidth > maxWidth) {
          break;
        }

        current = candidate;
        currentWidth = nextWidth;
        end += 1;
      }

      if (end >= remaining.length) {
        const text = current.trimEnd();
        lines.push({
          text,
          width: text ? this.measureTextWidth(style, text, direction) : currentWidth,
          direction
        });
        break;
      }

      const lineEnd = lastBreak >= 0 ? lastBreak + 1 : Math.max(1, end);
      const lineText = this.concatenateTokens(remaining.slice(0, lineEnd)).trimEnd();
      lines.push({
        text: lineText,
        width: this.measureTextWidth(style, lineText, direction),
        direction
      });
      remaining = this.trimLeadingWhitespaceTokens(remaining.slice(lineEnd));
    }

    return lines.length > 0 ? lines : [{ text: '', width: 0, direction }];
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

      return this.fitLineWithEllipsis(line.text, command.width, style, line.direction, shouldForceEllipsis);
    });
  }

  private fitLineWithEllipsis(
    text: string,
    maxWidth: number,
    style: AtlasTextStyle,
    direction: Exclude<TextDirection, 'auto'>,
    forceEllipsis: boolean
  ): TextLayoutLine {
    const trimmed = text.trimEnd();
    const width = this.measureTextWidth(style, trimmed, direction);
    if (!forceEllipsis && width <= maxWidth) {
      return { text: trimmed, width, direction };
    }

    const ellipsis = '…';
    const ellipsisWidth = this.measureTextWidth(style, ellipsis, direction);
    if (ellipsisWidth <= 0 || ellipsisWidth > maxWidth) {
      return { text: '', width: 0, direction };
    }

    let result = '';

    for (const segment of segmentText(trimmed)) {
      const candidate = result + segment;
      const nextWidth = this.measureTextWidth(style, `${candidate}${ellipsis}`, direction);
      if (result.length > 0 && nextWidth > maxWidth) {
        break;
      }

      if (result.length === 0 && nextWidth > maxWidth) {
        break;
      }

      result = candidate;
    }

    const nextText = result ? `${result.trimEnd()}${ellipsis}` : ellipsis;
    return {
      text: nextText,
      width: this.measureTextWidth(style, nextText, direction),
      direction
    };
  }

  private tokenizeWrapTokens(
    style: AtlasTextStyle,
    text: string,
    maxWidth: number,
    direction: Exclude<TextDirection, 'auto'>
  ): TextWrapToken[] {
    const tokens: TextWrapToken[] = [];

    for (const segment of tokenizeWords(text)) {
      if (!segment) {
        continue;
      }

      const isWhitespace = /^\s+$/.test(segment);
      const width = this.measureTextWidth(style, segment, direction);
      if (!isWhitespace && maxWidth > 0 && width > maxWidth) {
        tokens.push(...this.splitLongToken(style, segment, maxWidth, direction));
        continue;
      }

      tokens.push({
        text: segment,
        width,
        isWhitespace
      });
    }

    return tokens;
  }

  private splitLongToken(
    style: AtlasTextStyle,
    token: string,
    maxWidth: number,
    direction: Exclude<TextDirection, 'auto'>
  ): TextWrapToken[] {
    const parts: TextWrapToken[] = [];
    let current = '';

    for (const segment of segmentText(token)) {
      const candidate = current + segment;
      const width = this.measureTextWidth(style, candidate, direction);
      if (current && width > maxWidth) {
        parts.push({
          text: current,
          width: this.measureTextWidth(style, current, direction),
          isWhitespace: false
        });
        current = segment;
        continue;
      }

      current = candidate;
    }

    if (current) {
      parts.push({
        text: current,
        width: this.measureTextWidth(style, current, direction),
        isWhitespace: false
      });
    }

    return parts;
  }

  private trimLeadingWhitespaceTokens(items: TextWrapToken[]): TextWrapToken[] {
    let start = 0;
    while (start < items.length && items[start].isWhitespace) {
      start += 1;
    }

    return items.slice(start);
  }

  private concatenateTokens(items: TextWrapToken[]): string {
    return items.map((item) => item.text).join('');
  }

  private measureTextWidth(
    style: AtlasTextStyle,
    text: string,
    direction: Exclude<TextDirection, 'auto'>
  ): number {
    if (!this.textAtlas || !text) {
      return text.length * style.fontSize * 0.58;
    }

    return this.textAtlas.measureTextWidth(style, text, direction);
  }

  private resolveCommandTextDirection(
    command: DrawTextCommand,
    text: string
  ): Exclude<TextDirection, 'auto'> {
    return command.direction === 'auto' ? inferTextDirection(text) : command.direction;
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

    this.pushTexturedQuad(
      target,
      x,
      y,
      width,
      height,
      glyph.atlasX / this.textAtlas.width,
      glyph.atlasY / this.textAtlas.height,
      (glyph.atlasX + glyph.width) / this.textAtlas.width,
      (glyph.atlasY + glyph.height) / this.textAtlas.height,
      color,
      clipRect
    );
  }

  private pushTexturedQuad(
    target: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    u1: number,
    v1: number,
    u2: number,
    v2: number,
    color: ColorRgba,
    clipRect: ClipRect | null
  ): void {
    if (width <= 0 || height <= 0 || color.a <= 0) {
      return;
    }

    let quadX1 = x;
    let quadY1 = y;
    let quadX2 = x + width;
    let quadY2 = y + height;
    let nextU1 = u1;
    let nextV1 = v1;
    let nextU2 = u2;
    let nextV2 = v2;

    if (clipRect) {
      const clipX1 = clipRect.x;
      const clipY1 = clipRect.y;
      const clipX2 = clipRect.x + clipRect.width;
      const clipY2 = clipRect.y + clipRect.height;
      const clippedX1 = Math.max(quadX1, clipX1);
      const clippedY1 = Math.max(quadY1, clipY1);
      const clippedX2 = Math.min(quadX2, clipX2);
      const clippedY2 = Math.min(quadY2, clipY2);

      if (clippedX1 >= clippedX2 || clippedY1 >= clippedY2) {
        return;
      }

      const du = u2 - u1;
      const dv = v2 - v1;
      nextU1 = u1 + ((clippedX1 - quadX1) / width) * du;
      nextV1 = v1 + ((clippedY1 - quadY1) / height) * dv;
      nextU2 = u1 + ((clippedX2 - quadX1) / width) * du;
      nextV2 = v1 + ((clippedY2 - quadY1) / height) * dv;
      quadX1 = clippedX1;
      quadY1 = clippedY1;
      quadX2 = clippedX2;
      quadY2 = clippedY2;
    }

    const x1 = this.toNdcX(quadX1);
    const y1 = this.toNdcY(quadY1);
    const x2 = this.toNdcX(quadX2);
    const y2 = this.toNdcY(quadY2);

    this.pushTexturedVertex(target, x1, y1, nextU1, nextV1, color);
    this.pushTexturedVertex(target, x2, y1, nextU2, nextV1, color);
    this.pushTexturedVertex(target, x1, y2, nextU1, nextV2, color);

    this.pushTexturedVertex(target, x2, y1, nextU2, nextV1, color);
    this.pushTexturedVertex(target, x2, y2, nextU2, nextV2, color);
    this.pushTexturedVertex(target, x1, y2, nextU1, nextV2, color);
  }

  private resolveImageQuad(
    command: DrawImageCommand,
    image: ImageTextureEntry
  ): { x: number; y: number; width: number; height: number; u1: number; v1: number; u2: number; v2: number } | null {
    const width = Math.max(0, command.width);
    const height = Math.max(0, command.height);
    if (width <= 0 || height <= 0 || image.width <= 0 || image.height <= 0) {
      return null;
    }

    const imageAspect = image.width / image.height;
    const boundsAspect = width / height;
    let drawX = command.x;
    let drawY = command.y;
    let drawWidth = width;
    let drawHeight = height;
    let u1 = 0;
    let v1 = 0;
    let u2 = 1;
    let v2 = 1;

    switch (command.stretch) {
      case 'uniform': {
        const scale = Math.min(width / image.width, height / image.height);
        drawWidth = image.width * scale;
        drawHeight = image.height * scale;
        drawX += (width - drawWidth) / 2;
        drawY += (height - drawHeight) / 2;
        break;
      }
      case 'uniformToFill': {
        if (boundsAspect > imageAspect) {
          const visibleSourceHeight = image.width / boundsAspect;
          const crop = Math.max(0, (image.height - visibleSourceHeight) / 2);
          v1 = crop / image.height;
          v2 = (crop + visibleSourceHeight) / image.height;
        } else {
          const visibleSourceWidth = image.height * boundsAspect;
          const crop = Math.max(0, (image.width - visibleSourceWidth) / 2);
          u1 = crop / image.width;
          u2 = (crop + visibleSourceWidth) / image.width;
        }
        break;
      }
      case 'none': {
        drawWidth = Math.min(width, image.width);
        drawHeight = Math.min(height, image.height);
        u2 = drawWidth / image.width;
        v2 = drawHeight / image.height;
        break;
      }
      case 'fill':
      default:
        break;
    }

    return {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
      u1,
      v1,
      u2,
      v2
    };
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

  private pushTexturedVertex(target: number[], x: number, y: number, u: number, v: number, color: ColorRgba): void {
    target.push(x, y, u, v, color.r, color.g, color.b, color.a);
  }

  private fontStyleKey(style: AtlasTextStyle): string {
    return `${style.fontStyle}|${style.fontWeight}|${Math.max(1, Math.round(style.fontSize))}|${style.fontFamily}`;
  }

  private fontString(style: AtlasTextStyle): string {
    return `${style.fontStyle} ${style.fontWeight} ${Math.max(1, Math.round(style.fontSize))}px ${style.fontFamily}`;
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
