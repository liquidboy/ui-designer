# XAML Compliance Matrix

## Purpose

This matrix is the Phase 0 source of truth for XAML compliance work.

The target is core `MS-XAML-2017` language/object-mapping behavior plus a custom `ui-designer` vocabulary. Full WPF vocabulary parity is out of scope unless a row explicitly calls it in later as compatibility work.

## Status Key

| Status | Meaning |
| --- | --- |
| Current | Supported by the repo today through the legacy flat AST. |
| Phase 1 | Required for the first infoset/schema parser slice. |
| Phase 2 | Required after infoset support, usually because it needs vocabulary metadata. |
| Phase 3+ | Required for later compliance phases. |
| Deferred | Valid XAML concept, but not needed for the first compliance target. |
| Out of scope | Not part of core compliance for this repo. |

## Handling Policy

| Construct | Parse behavior | Validation behavior | Runtime behavior | Round-trip behavior |
| --- | --- | --- | --- | --- |
| Malformed XML | Fail parse. | Not reached. | Not reached. | Not reached. |
| Well-formed unknown type | Preserve as object node. | Error unless the active vocabulary resolves it. | Not lowered. | Preserve if source is reserialized from infoset. |
| Well-formed unknown member | Preserve as member node. | Error unless the active vocabulary resolves it. | Not lowered. | Preserve if source is reserialized from infoset. |
| Unsupported intrinsic directive | Preserve structurally. | Warning or error based on row-level policy. | Ignored only when row says preserved-only. | Preserve. |
| Unsupported markup extension | Preserve as structured extension AST. | Warning until runtime support exists. | Not evaluated. | Preserve. |
| Valid but unrenderable vocabulary member | Preserve and validate if schema allows it. | Warning when runtime lowering skips it. | Skip with diagnostic, never silently. | Preserve. |

Default rule: parser support should be broader than runtime execution support. Unsupported but well-formed constructs should be represented structurally before validation decides whether they are allowed.

## Core Language Matrix

| Feature | Current status | Target status | First implementation slice | Notes |
| --- | --- | --- | --- | --- |
| XML well-formedness | Current | Current | Keep `DOMParser` error handling until parser replacement. | Existing parser fails on malformed XML. |
| Source spans | Missing | Phase 1 | Add span fields to infoset nodes and diagnostics. | Needed for editor highlighting and golden diagnostics. |
| Namespace declarations | Missing | Phase 1 | Preserve prefix, namespace URI, and declaration scope. | Do not flatten prefixed names into raw strings. |
| Qualified names | Missing | Phase 1 | Add `XamlQualifiedName` with `prefix`, `localName`, and `namespaceUri`. | Applies to object types, members, directives, and attached members. |
| XAML document node | Missing | Phase 1 | Add document root containing namespace table, root object, diagnostics. | Replaces `XamlDocument.root` as the long-term parser contract. |
| Object nodes | Partial | Phase 1 | Model object elements separately from members and text. | Legacy `XamlNode.type` maps to object type today. |
| Member nodes | Missing | Phase 1 | Model attribute members and property elements as members. | Required for `<Grid.RowDefinitions>`. |
| Text nodes | Partial | Phase 1 | Preserve text as ordered text nodes. | Current parser only stores text for single-text-child elements. |
| Object element syntax | Partial | Phase 1 | Convert XML elements to object nodes when schema says they are types. | Current parser treats every element as a node type. |
| Attribute member syntax | Partial | Phase 1 | Convert XML attributes to member nodes. | Current parser stores attributes as primitive map entries. |
| Property element syntax | Missing | Phase 1 | Convert dotted child elements to member nodes. | Enables semantic equivalence with attributes where allowed. |
| Content property inference | Missing | Phase 2 | Use vocabulary metadata to route child objects/text into content members. | Needed for `Border`, `Button`, panels, and future collections. |
| Attached member syntax | String-only | Phase 2 | Represent attached owner/member names structurally. | Current `Grid.Row` survives only as an attribute key. |
| Collection members | Missing | Phase 3+ | Add list semantics to vocabulary metadata and lowering. | Needed for richer grid definitions and resource collections. |
| Dictionary members | Missing | Phase 3+ | Add dictionary semantics, key validation, and lowering. | Needed for resource dictionaries and `x:Key`. |
| Text syntax conversion | Partial | Phase 2 | Move primitive conversion into schema-defined text syntax. | Current parser eagerly converts numbers/booleans for every attribute. |
| Whitespace handling | Missing | Phase 3+ | Add schema-aware whitespace preservation/collapse rules. | Include `xml:space` once directive propagation exists. |
| Markup extension AST | Missing | Phase 5 | Parse brace syntax into structured expressions. | Do not treat `{Binding path=Title}` as plain text long-term. |
| Nested markup extensions | Missing | Phase 5 | Support nested extension arguments. | Not required for Phase 1. |
| Semantic serializer | Partial | Phase 7 | Serialize from infoset/semantic model, not string concatenation. | Byte-for-byte formatting preservation is not required. |
| Semantic round-trip tests | Missing | Phase 8 | Add fixtures for parse, validate, lower, serialize, parse. | Matrix rows should eventually map to tests. |

## Intrinsic Namespace Matrix

| Directive or namespace feature | Target | First behavior | Runtime behavior | Notes |
| --- | --- | --- | --- | --- |
| `x:Name` | Phase 4 | Parse and preserve in Phase 1; validate namescope uniqueness in Phase 4. | Lower to element identity/name metadata when supported. | Also decide whether bare `Name` aliases it in our vocabulary. |
| `x:Key` | Phase 4 | Parse and preserve in Phase 1. | Runtime ignores until dictionaries/resources exist. | Validation becomes meaningful with dictionary members. |
| `x:Class` | Phase 4 | Parse and preserve in Phase 1. | Preserved-only; no markup compilation. | Validate root-only placement later. |
| `x:Uid` | Phase 4 | Parse and preserve in Phase 1. | Preserved-only. | Useful for localization metadata, not rendering. |
| `x:TypeArguments` | Phase 4 | Parse and preserve in Phase 1. | Preserved-only. | Generic type execution can remain unsupported. |
| `x:Null` | Phase 5 | Parse as markup extension or intrinsic null expression. | Lower to null where member schema allows nullable values. | Optional early once markup extensions land. |
| `x:Array` | Deferred | Preserve as unsupported intrinsic object/extension. | Not lowered. | Needs array/list semantics first. |
| `x:Static` | Deferred | Preserve as unsupported markup extension. | Not evaluated. | Requires a static member resolution model. |
| `x:Reference` | Deferred | Preserve as unsupported markup extension. | Not evaluated. | Requires namescope and object reference resolution. |
| `xml:lang` | Phase 4 | Parse and preserve in Phase 1. | May lower to text/layout metadata later. | Treat as propagated metadata once schema supports it. |
| `xml:space` | Phase 4 | Parse and preserve in Phase 1. | Affects text node whitespace handling later. | Keep separate from custom vocabulary members. |

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
| Panel placement: `Grid.Row`, `Grid.Column`, `Grid.RowSpan`, `Grid.ColumnSpan` | Partial | Phase 2 attached member metadata | Current parser preserves dotted attributes only as strings. |
| Canvas placement: `Canvas.Left`, `Canvas.Top` | Missing | Phase 2 attached member metadata | Current documents mostly use direct `X`, `Y`, or designer offsets. |
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
| Invalid directive placement | Error | Placement rules are part of the language target. |
| Namescope collision | Error | Required once `x:Name` validation exists. |
| Unrenderable but schema-valid member | Warning | Valid source should not disappear silently at runtime. |

## Phase 1 Implementation Target

The next implementation slice should add the new model behind compatibility adapters. Existing apps should keep calling `parseXaml` while the compliance parser is introduced.

Deliverables:

1. Add these schema primitives in `packages/xaml-schema`:
   - `XamlQualifiedName`
   - `XamlNamespaceDeclaration`
   - `XamlSourceSpan`
   - `XamlDocumentNode`
   - `XamlObjectNode`
   - `XamlMemberNode`
   - `XamlTextNode`
   - `XamlDiagnostic`
2. Add parser result types:
   - `XamlParseResult`
   - `XamlParseDiagnostic`
   - `XamlParseOptions`
3. Update `packages/xaml-parser` to expose a new parse entry point that preserves:
   - namespace declarations
   - qualified names
   - ordered object/member/text nodes
   - parser diagnostics
4. Keep a legacy adapter that lowers the new object tree back into the existing `XamlDocument` shape for `designer-core` and `ui-core`.
5. Add fixture coverage for:
   - plain object elements
   - namespaced root elements
   - attribute members
   - property elements
   - mixed text/content preservation
   - invalid XML diagnostics

Exit criteria:

1. Existing designer/runtime behavior still works through the compatibility adapter.
2. New parser output can represent object nodes, member nodes, text nodes, namespaces, and source spans without relying on flat `type/attributes/children/text`.
3. The Phase 2 vocabulary registry can be built without changing the Phase 1 node model.

