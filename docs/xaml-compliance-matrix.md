# XAML Compliance Matrix

## Purpose

This matrix is the Phase 0 source of truth for XAML compliance work.

The target is core `MS-XAML-2017` language/object-mapping behavior plus a custom `ui-designer` vocabulary. Full WPF vocabulary parity is out of scope unless a row explicitly calls it in later as compatibility work.

## Status Key

| Status | Meaning |
| --- | --- |
| Current | Supported by the repo today through the active parser/validator/lowering stack. |
| Partial | Implemented for part of the target surface, but not complete enough to claim full feature support. |
| Phase 1 | Required for the first infoset/schema parser slice. |
| Phase 2 | Required after infoset support, usually because it needs vocabulary metadata. |
| Phase 3+ | Required for later compliance phases. |
| Missing | Planned but not implemented yet. |
| Deferred | Valid XAML concept, but not needed for the first compliance target. |
| Out of scope | Not part of core compliance for this repo. |

## Handling Policy

| Construct | Parse behavior | Validation behavior | Runtime behavior | Round-trip behavior |
| --- | --- | --- | --- | --- |
| Malformed XML | Fail parse. | Not reached. | Not reached. | Not reached. |
| Well-formed unknown type | Preserve as object node. | Error unless the active vocabulary resolves it. | Not lowered. | Preserve if source is reserialized from infoset. |
| Well-formed unknown member | Preserve as member node. | Error unless the active vocabulary resolves it. | Not lowered. | Preserve if source is reserialized from infoset. |
| Unsupported intrinsic directive | Preserve structurally. | Warning or error based on row-level policy. | Ignored only when row says preserved-only. | Preserve. |
| Unsupported markup extension | Preserve as structured extension AST. | Warning until runtime support exists. | Supported extensions evaluate only in runtime lowering. | Preserve. |
| Valid but unrenderable vocabulary member | Preserve and validate if schema allows it. | Warning when runtime lowering skips it. | Skip with diagnostic, never silently. | Preserve. |

Default rule: parser support should be broader than runtime execution support. Unsupported but well-formed constructs should be represented structurally before validation decides whether they are allowed.

## Core Language Matrix

| Feature | Current status | Target status | First implementation slice | Notes |
| --- | --- | --- | --- | --- |
| XML well-formedness | Current | Current | Keep `DOMParser` error handling until parser replacement. | Existing parser fails on malformed XML. |
| Source spans | Current | Current | Add span fields to infoset nodes and diagnostics. | Used by diagnostics and editor-facing parse results. |
| Namespace declarations | Current | Current | Preserve prefix, namespace URI, and declaration scope. | Known namespaces now validate against active registries. |
| Qualified names | Current | Current | Add `XamlQualifiedName` with `prefix`, `localName`, and `namespaceUri`. | Applies to object types, members, directives, and attached members. |
| XAML document node | Current | Current | Add document root containing namespace table, root object, diagnostics. | Legacy `XamlDocument.root` still exists behind lowering adapters. |
| Object nodes | Current | Current | Model object elements separately from members and text. | Legacy `XamlNode.type` is now the lowered compatibility shape. |
| Member nodes | Current | Current | Model attribute members and property elements as members. | Includes directives and attached-member forms. |
| Text nodes | Current | Current | Preserve text as ordered text nodes. | Infoset preserves authoring text; compatibility lowering applies default whitespace normalization unless `xml:space` preserves it. |
| Object element syntax | Current | Current | Convert XML elements to object nodes when schema says they are types. | Active vocabularies now cover runtime and designer config types. |
| Attribute member syntax | Current | Current | Convert XML attributes to member nodes. | Lowering still uses legacy primitive coercion for compatibility. |
| Property element syntax | Current | Current | Convert dotted child elements to member nodes. | Attribute/property-element equivalence is covered by lowering fixtures. |
| Content property inference | Current | Current | Use vocabulary metadata to route child objects/text into content members. | Implemented for the current runtime and designer vocabularies. |
| Attached member syntax | Current | Current | Represent attached owner/member names structurally. | Lowered to canonical `Owner.Member` attribute names for compatibility. |
| Collection members | Partial | Phase 3+ | Add list semantics to vocabulary metadata and lowering. | Known list containers now validate allowed item types; semantic collection lowering is still compatibility-shaped. |
| Dictionary members | Partial | Phase 3+ | Add dictionary semantics, key validation, and lowering. | Designer theme `Colors` validates dictionary items with explicit `x:Key` or implicit `Color.Id`; runtime `ResourceDictionary` now lowers primitive resources and known control object resources for scoped `StaticResource` and `DynamicResource` lookup. |
| Text syntax conversion | Partial | Phase 2 | Move primitive conversion into schema-defined text syntax. | Validation is schema-aware today, but legacy lowering still uses shared primitive coercion. |
| Whitespace handling | Partial | Phase 3+ | Add schema-aware whitespace preservation/collapse rules. | Default lowering now collapses XML whitespace runs and trims text values, while `xml:space="preserve"` keeps exact text and `xml:space="default"` resets inherited preservation. Remaining gaps are edge-case whitespace rules around future templates/object islands. |
| Markup extension AST | Partial | Phase 5 | Parse brace syntax into structured expressions. | Attribute values and property-element text now parse into a structured AST; runtime lowering evaluates supported extensions while authoring lowering preserves raw text. |
| Nested markup extensions | Partial | Phase 5 | Support nested extension arguments. | Nested attribute-value extensions now parse recursively; unsupported nested extensions still warn and preserve. |
| Semantic serializer | Partial | Phase 7 | Serialize from infoset/semantic model, not string concatenation. | `serializeXamlDocumentNode` now canonicalizes namespace declarations, directives, markup extensions, property elements, and collection content; designer attribute edits and child insert/remove/move operations update the infoset when the lowered path maps safely. |
| Semantic round-trip tests | Partial | Phase 8 | Add fixtures for parse, validate, lower, serialize, parse. | Phase 9 fixtures cover namespaces/directives, markup extensions, and resource collections; designer serializer fixtures cover edit propagation for attributes, property elements, inserts, deletes, moves, and resource-wrapper path mapping. |

## Intrinsic Namespace Matrix

| Directive or namespace feature | Current status | Target | Current behavior | Runtime behavior | Notes |
| --- | --- | --- | --- | --- | --- |
| `x:Name` | Current | Phase 4 | Parse, preserve, and validate uniqueness within the current document namescope. | Lowered to `Name` in the legacy adapter; runtime still does not resolve object references by name. | Bare `Name` is still not a schema alias. |
| `x:Key` | Partial | Phase 4 | Parse and validate as a dictionary item key. | Valid dictionary keys are accepted without preserved-only warnings; runtime resource lookup uses them for primitive and known control object `ResourceDictionary` entries. | Misplaced `x:Key`, missing dictionary keys, duplicate dictionary keys, and invalid dictionary item types now produce deterministic errors. |
| `x:Class` | Current | Phase 4 | Parse, preserve, and enforce root-only placement. | Preserved-only; no markup compilation. | Non-root usage now raises `invalid-directive-placement`. |
| `x:Uid` | Current | Phase 4 | Parse and preserve with warning. | Preserved-only. | Useful for localization metadata, not rendering. |
| `x:TypeArguments` | Current | Phase 4 | Parse and preserve with warning. | Preserved-only. | Generic type execution can remain unsupported. |
| `x:Type` / `x:TypeExtension` | Partial | Phase 5 | Parse structured type markup extensions, validate required type names, and validate known simple object type names. | Runtime lowering evaluates supported `{x:Type ...}` forms to type-name strings; authoring lowering preserves raw source. | CLR type resolution, primitive CLR types, generic type arguments, and object-element `x:Type` forms remain deferred. |
| `x:Null` | Partial | Phase 5 | Parse as markup extension or intrinsic null expression. | Runtime lowering maps `{x:Null}` to semantic `null`; authoring lowering preserves raw text. | Serializer support for emitting `x:` namespace declarations from null values is still pending. |
| `x:Array` | Partial | Phase 5 | Parse and validate intrinsic `x:Array` object elements, required `Type`, direct content, `x:Array.Items`, and simple `{x:Type ...}` item-type expressions. | Lowers structurally as an `Array` node with item children; runtime lowering evaluates `{x:Type ...}` item type values to type-name strings. | True array-valued runtime assignment and primitive CLR item types remain deferred. |
| `x:Static` / `x:StaticExtension` | Partial | Phase 5 | Parse structured static markup extensions and validate required type-qualified member references. | Runtime lowering evaluates supported `{x:Static ...}` forms to stable member-token strings; authoring lowering preserves raw source. | CLR/static value resolution and object-element static forms remain deferred. |
| `x:Reference` / `x:ReferenceExtension` | Partial | Phase 5 | Parse structured reference markup extensions, validate required `Name`, and resolve against the current document-wide `x:Name` table including forward references. | Runtime lowering clones the referenced compatibility object into object-valued members; authoring lowering preserves raw source. | True object identity, nested namescope boundaries, and template/resource namescopes remain deferred. |
| `xml:lang` | Current | Phase 4 | Parse, preserve, validate, and propagate as effective object metadata. | Compatibility lowering emits inherited `lang` metadata on descendants. | Runtime text/layout consumers can now read inherited language metadata from lowered attributes. |
| `xml:space` | Partial | Phase 4 | Parse, preserve, validate, and apply scoped whitespace preservation/reset. | Preserved whitespace-only text lowers into text-capable content; default text lowering collapses and trims XML whitespace. | Edge-case whitespace behavior around future templates/object islands is still pending. |

## `ui-designer` Vocabulary Matrix

| Type | Current support | Phase 2 schema target | Content property | Notes |
| --- | --- | --- | --- | --- |
| `Canvas` | Current | Type with layout children and sizing members. | Children | Keep `Width`, `Height`, `X`, `Y`, and designer offset compatibility during migration. |
| `StackPanel` | Current | Type with ordered layout children and spacing/orientation members. | Children | Current samples rely on `Spacing`. |
| `Grid` | Current | Type with layout children plus attached cell members. | Children | `Rows` and `Columns` remain simplified v1 members until row/column definition collections exist. |
| `Border` | Current | Type with visual members and a single child/content member. | Child | Validate at most one logical child once schema validation exists. |
| `Rectangle` | Current | Leaf visual type. | None | Visual fill maps to `Fill`. |
| `TextBlock` | Current | Leaf text type with text syntax members. | Text | `Text` attribute remains the primary v1 text member. |
| `Image` | Current | Leaf image type with source/stretch metadata. | None | Preserve natural-size runtime behavior outside schema. |
| `Button` | Current | Content control with button label/content members. | Content | Event members stay declared but not executed until routing expands. |

## Member Matrix

| Member family | Current support | Target status | Notes |
| --- | --- | --- | --- |
| Common sizing: `Width`, `Height` | Current | Phase 2 schema metadata | Values should use schema text syntax instead of parser-wide coercion. |
| Box model: `Margin`, `Padding`, `BorderThickness` | Partial | Phase 2 schema metadata | Runtime support can remain incremental. |
| Alignment: `HorizontalAlignment`, `VerticalAlignment` | Partial | Phase 2 schema metadata | Validate enum values later. |
| Visual color: `Background`, `BorderBrush`, `Fill`, `Foreground` | Current | Phase 2 schema metadata | Preserve color parsing in runtime for now. |
| Text: `Text`, `Content`, `FontSize`, `FontWeight`, `FontFamily`, `FontStyle`, `LineHeight`, `TextAlignment`, `TextWrapping`, `TextOverflow`, `TextTrimming`, `FlowDirection`, `Direction` | Current | Phase 2 schema metadata | `Direction` should remain a compatibility alias for `FlowDirection`. |
| Image: `Source`, `Stretch`, `Opacity` | Current | Phase 2 schema metadata | Validate `Stretch` enum values later. |
| Panel placement: `Grid.Row`, `Grid.Column`, `Grid.RowSpan`, `Grid.ColumnSpan` | Current | Phase 2 attached member metadata | Attached member metadata and canonical lowering are now in place. |
| Canvas placement: `Canvas.Left`, `Canvas.Top` | Current | Phase 2 attached member metadata | Attached member metadata exists even though most current documents still use `X`, `Y`, or designer offsets. |
| Designer metadata: `Designer.OffsetX`, `Designer.OffsetY` | Current | Custom attached metadata namespace | Keep as authoring metadata, not core XAML language. |
| Events: `PointerDown`, `PointerMove`, `PointerUp`, `Click` | Declared in subset | Deferred | Parse as members; execution/routing is outside Phase 1. |

## Validation Policy

| Case | Diagnostic level | Reason |
| --- | --- | --- |
| Unknown namespace URI | Error | Cannot resolve language or vocabulary rules. |
| Unknown object type in known namespace | Error | The active vocabulary does not define the type. |
| Unknown member in known type | Error | The active vocabulary does not define the member. |
| Duplicate member assignment | Error | Attribute syntax and property-element syntax cannot both set the same scalar member. |
| Multiple values for single-child content property | Error | Prevents ambiguous lowering. |
| Unsupported but preserved directive | Warning unless placement is invalid. | Keeps parser round-trip broader than runtime support. |
| Unsupported markup extension | Warning until a member requires concrete value evaluation. | Keeps source round-trippable without pretending runtime support exists. |
| Supported runtime markup extension | No warning. | `Binding`, `StaticResource`, `DynamicResource`, and `{x:Null}` are evaluated by runtime lowering and preserved by authoring lowering. |
| Invalid directive placement | Error | Placement rules are part of the language target. |
| Namescope collision | Error | Required once `x:Name` validation exists. |
| Invalid collection item type | Error | Collection metadata controls which known item types can appear in a list or dictionary. |
| Missing or duplicate dictionary key | Error | Dictionary items require a stable key, either explicit `x:Key` or a type-level implicit key property. |
| Unrenderable but schema-valid member | Warning | Valid source should not disappear silently at runtime. |

Current limitation:

1. Namescope validation and `x:Reference` resolution currently treat the document root as the only namescope. Nested namescopes for templates, resources, or future object islands are still deferred.
2. Markup extension parsing currently covers attribute values and property-element text; `x:Array` object elements are now structural, while remaining object-element intrinsic forms are still deferred.
3. Runtime resource lookup supports primitive resources, known control object resources, dynamic resource overrides, and structural object resources; true array-valued resource execution, CLR type resolution, and CLR static value resolution remain deferred.
4. Runtime `Binding` evaluation is v1-only: one-way path lookup against a supplied data context, without converters or multi-binding.
5. Designer infoset edit propagation currently covers mapped object paths, attribute/property-element values, and child insert/remove/move operations. If a future edit targets a lowered compatibility shape that cannot be mapped back to an infoset node safely, serialization still falls back to the lowered shape rather than saving stale semantic source.

## Current Implementation Checkpoint

Completed foundation work:

1. Infoset/schema primitives, vocabulary registries, and compatibility lowering are in place.
2. Runtime parse/validate/lower paths now back rendered app documents, while strict authoring parse/validate/lower paths back `designer-core` and the designer config vocabularies.
3. Validation fixtures cover parser structure, registry-backed validation, lowering behavior, and designer config namespaces.
4. Intrinsic directive validation now includes `x:Name` document-namescope checks and root-only `x:Class` placement.
5. Attribute-value and property-element text markup extensions now parse into structured AST nodes, including nested extensions, escaped `{}{...}` literals, and prefixed forms such as `{x:Null}`, while authoring lowering preserves the original raw text for source compatibility.
6. Collection metadata now validates allowed item types for list containers, and dictionary metadata validates explicit `x:Key`, implicit key properties, missing keys, and duplicate keys.
7. Runtime lowering now evaluates v1 `Binding` paths against a supplied data context, maps `{x:Null}` to semantic `null`, and resolves scoped primitive `{StaticResource ...}` references.
8. Infoset semantic serialization now round-trips namespace declarations, directives, markup extensions, property elements, and resource collection structures through fixture coverage.
9. Designer source import/export now serializes from the parsed infoset, and mapped designer edits propagate into that infoset so namespace prefixes, directives, property elements, markup extensions, and resource property elements survive common visual editing flows.
10. XML scope handling now applies `xml:space` preserve/default behavior to text parsing and propagates `xml:lang` through object metadata and compatibility lowering.
11. Runtime resource lowering now supports scoped object-valued resources for known controls, including object resources that depend on earlier primitive resources in the same dictionary.
12. `DynamicResource` now evaluates from scoped resources by default and from runtime override maps when present; `RuntimeHost` can update and clear dynamic resource overrides without changing XAML source.
13. Default text lowering now applies XML whitespace normalization, while `xml:space` preserve/default controls opt-in exact whitespace preservation.
14. Intrinsic `x:Array` object elements now parse, validate required `Type`, validate simple object item types, serialize, and lower as structural `Array` compatibility nodes.
15. `{x:Type ...}` now validates known simple object type names, preserves authoring source, and runtime-lowers to type-name strings for scenarios such as `x:Array Type`.
16. `{x:Static ...}` now validates required type-qualified member references, preserves authoring source, and runtime-lowers to stable member-token strings.
17. `{x:Reference ...}` now validates required names, supports forward references within the document namescope, preserves authoring source, and runtime-lowers object-valued references to cloned compatibility nodes.

Next slice:

1. Expand namescope support beyond the current document-wide namescope.
2. Add true object identity/reference semantics beyond cloned compatibility nodes.
