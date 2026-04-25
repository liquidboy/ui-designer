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

- Registry-backed XAML infoset parsing, validation, and lowering through compatibility adapters
- Intrinsic directive validation for namescopes, root-only `x:Class`, dictionary `x:Key`, attribute/property-element `Binding`/`x:Null`, and scoped primitive/object `StaticResource` lookup
- Scoped `xml:space` whitespace preservation and `xml:lang` inheritance through infoset parsing and compatibility lowering
- Infoset-based semantic serialization with round-trip fixtures for namespaces, directives, markup extensions, collections, and designer edits
- WebGPU-backed rectangle rendering in the browser runtime
- Infinite-canvas designer with pan, zoom, selection, snapping, drag-move, and resize handles
- Inspector-driven editing for position, size, and color with undo/redo
- Component palette with container-aware template insertion rules
- Component tree browsing with create, delete, button-based reparenting, and drag-drop structural editing
- Editable XAML source panel with parse/apply error handling
- Designer source import/export and visual edits preserve semantic infoset XAML when edits can be mapped safely
- File import/export for XAML documents plus local draft persistence

## Documentation

- [Architecture](./docs/architecture.md)
- [XAML Subset v1](./docs/xaml-subset-v1.md)
- [XAML Compliance Matrix](./docs/xaml-compliance-matrix.md)
- [XAML Spec Compliance Plan](./docs/xaml-spec-compliance-plan.md)
- [Milestone Plan](./docs/milestone-plan.md)
