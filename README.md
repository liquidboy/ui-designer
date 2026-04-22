# UI Designer

XAML-inspired UI framework targeting WebGPU, with an infinite-canvas visual designer.

## Workspace Layout

- `packages/` shared framework and designer libraries
- `apps/playground` runtime sandbox
- `apps/designer` visual editor shell
- `docs/` architecture and roadmap documentation

## Getting Started

1. `npm run dev:playground`
2. `npm run dev:designer`
3. `npm run typecheck`

## Current MVP

- XAML parsing into a shared schema and scene graph
- WebGPU-backed rectangle rendering in the browser runtime
- Infinite-canvas designer with pan, zoom, selection, snapping, drag-move, and resize handles
- Inspector-driven editing for position, size, and color with undo/redo
- Component tree browsing plus serialized XAML draft preview
- Document-backed designer edits persisted as XAML drafts in local storage

## Documentation

- [Architecture](./docs/architecture.md)
- [XAML Subset v1](./docs/xaml-subset-v1.md)
- [Milestone Plan](./docs/milestone-plan.md)
