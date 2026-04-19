# Milestone Plan

## M0 Foundations

1. Stabilize monorepo workspace structure.
2. Define schema and parser contracts.
3. Add AST fixtures and parser diagnostics tests.

## M1 Runtime Core

1. Build scene graph from parsed XAML.
2. Implement measure/arrange for `Canvas`, `StackPanel`, `Grid`.
3. Add hit-testing and pointer routing interfaces.

## M2 WebGPU Renderer

1. Draw rectangles and borders.
2. Add clipping and z-order.
3. Integrate image pipeline and basic text placeholders.

## M3 Infinite Canvas Designer

1. Camera pan/zoom and world-space coordinates.
2. Selection, resize handles, and snapping guides.
3. Overlay rendering pass for editor-only visuals.

## M4 Authoring UX

1. Component tree and selection sync.
2. Property inspector editing.
3. Undo/redo command stack with XAML serialization.

## M5 Advanced Runtime

1. Templates and style system.
2. Data binding expansion (two-way, converters).
3. Virtualized lists and performance instrumentation.
