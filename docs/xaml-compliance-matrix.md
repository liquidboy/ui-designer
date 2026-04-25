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
| Namespace declarations | Current | Current | Preserve prefix, namespace URI, and declaration scope. | Known namespaces validate against active registries, and lexical namespace scope now resolves type references such as `{x:Type ui:TextBlock}` and validation-only `clr-namespace:System` primitive aliases. |
| Qualified names | Current | Current | Add `XamlQualifiedName` with `prefix`, `localName`, and `namespaceUri`. | Applies to object types, members, directives, and attached members. |
| XAML document node | Current | Current | Add document root containing namespace table, root object, diagnostics. | Legacy `XamlDocument.root` still exists behind lowering adapters. |
| Object nodes | Current | Current | Model object elements separately from members and text. | Legacy `XamlNode.type` is now the lowered compatibility shape. |
| Member nodes | Current | Current | Model attribute members and property elements as members. | Includes directives and attached-member forms. |
| Text nodes | Current | Current | Preserve text as ordered text nodes. | Infoset preserves authoring text; compatibility lowering applies default whitespace normalization unless `xml:space` preserves it. |
| Object element syntax | Current | Current | Convert XML elements to object nodes when schema says they are types. | Active vocabularies now cover runtime and designer config types. |
| Attribute member syntax | Current | Current | Convert XML attributes to member nodes. | Known member values lower through schema-owned `valueSyntax`; unresolved compatibility shapes keep a legacy fallback. |
| Property element syntax | Current | Current | Convert dotted child elements to member nodes. | Attribute/property-element equivalence is covered by lowering fixtures. |
| Content property inference | Current | Current | Use vocabulary metadata to route child objects/text into content members. | Implemented for the current runtime and designer vocabularies. |
| Attached member syntax | Current | Current | Represent attached owner/member names structurally. | Lowered to canonical `Owner.Member` attribute names for compatibility. |
| Collection members | Partial | Phase 3+ | Add list semantics to vocabulary metadata and lowering. | Known list containers now validate allowed item types; semantic collection lowering is still compatibility-shaped. |
| Dictionary members | Partial | Phase 3+ | Add dictionary semantics, key validation, and lowering. | Designer theme `Colors` validates dictionary items with explicit `x:Key` or implicit `Color.Id`; runtime `ResourceDictionary` now lowers primitive resources and known control object resources for scoped `StaticResource` and `DynamicResource` lookup, and `ResourceDictionary` remains a schema-marked nested namescope boundary. |
| Text syntax conversion | Current | Current | Move primitive conversion into schema-defined text syntax. | Known members validate and lower through `XamlMemberDefinition.valueSyntax` for string, number, decimal, boolean, enum, color, URI, object, and any-valued members; unknown preserved shapes keep a legacy fallback. |
| Whitespace handling | Partial | Phase 3+ | Add schema-aware whitespace preservation/collapse rules. | Default lowering now collapses XML whitespace runs and trims text values, while `xml:space="preserve"` keeps exact text and `xml:space="default"` resets inherited preservation. Remaining gaps are edge-case whitespace rules around future templates/object islands. |
| Markup extension AST | Partial | Phase 5 | Parse brace syntax into structured expressions. | Attribute values and property-element text now parse into a structured AST; runtime lowering evaluates supported extensions while authoring lowering preserves raw text. |
| Nested markup extensions | Partial | Phase 5 | Support nested extension arguments. | Nested attribute-value extensions now parse recursively; unsupported nested extensions still warn and preserve. |
| Semantic serializer | Partial | Phase 7 | Serialize from infoset/semantic model, not string concatenation. | `serializeXamlDocumentNode` now canonicalizes namespace declarations, directives, markup extensions, property elements, and collection content; designer attribute edits and child insert/remove/move operations update the infoset when the lowered path maps safely. |
| Semantic round-trip tests | Partial | Phase 8 | Add fixtures for parse, validate, lower, serialize, parse. | Phase 9 fixtures cover namespaces/directives, markup extensions, and resource collections; designer serializer fixtures cover edit propagation for attributes, property elements, inserts, deletes, moves, and resource-wrapper path mapping. |

## Intrinsic Namespace Matrix

| Directive or namespace feature | Current status | Target | Current behavior | Runtime behavior | Notes |
| --- | --- | --- | --- | --- | --- |
| `x:Name` | Current | Phase 4 | Parse, preserve, and validate uniqueness within the active namescope, including root scope, `ResourceDictionary`, `ControlTemplate`, `DataTemplate`, and `ObjectIsland` boundaries. | Lowered to `Name` in the legacy adapter; runtime `x:Reference` uses scoped named-object maps for supported object-valued references. | Bare `Name` is still not a schema alias. Template/object-island vocabulary is validation-only until rendering support exists. |
| `x:Key` | Partial | Phase 4 | Parse and validate as a dictionary item key. | Valid dictionary keys are accepted without preserved-only warnings; runtime resource lookup uses them for primitive and known control object `ResourceDictionary` entries. | Misplaced `x:Key`, missing dictionary keys, duplicate dictionary keys, and invalid dictionary item types now produce deterministic errors. |
| `x:Class` | Current | Phase 4 | Parse, preserve, and enforce root-only placement. | Preserved-only; no markup compilation. | Non-root usage now raises `invalid-directive-placement`. |
| `x:Uid` | Current | Phase 4 | Parse and preserve with warning. | Preserved-only. | Useful for localization metadata, not rendering. |
| `x:TypeArguments` | Partial | Phase 4 | Parse, preserve with warning, and validate comma-separated/nested type-name lists against in-scope namespaces, including `clr-namespace:System` primitive aliases. | Preserved-only. | Generic type execution remains unsupported. |
| `x:FactoryMethod`, `x:Arguments`, `x:ConstructorArgs`, `x:InitializationText` | Partial | Construction directive support | Parse, preserve, validate placement for construction argument property elements, reject empty construction argument lists, reject text-only argument lists, and prevent duplicate `x:Arguments`/`x:ConstructorArgs` forms on the same object. | Preserved-only with warnings; no constructor or factory execution. | `x:Arguments` is accepted as the XAML 2009 form, while `x:ConstructorArgs` covers the MS-XAML schema-style construction argument name. |
| `x:ClassModifier`, `x:FieldModifier`, `x:Code`, `x:XData` | Partial | Markup-compilation/XML data metadata support | Parse, preserve, validate markup-compilation dependencies, require `x:Code` on the document root with `x:Class`, and preserve raw `x:XData` XML islands without validating island elements as UI objects. | Preserved-only with warnings; no code execution, type generation, or XML data provider execution. | `x:FieldModifier` requires root `x:Class` and same-object `x:Name`; `x:XData` is accepted only as a member value in the scoped subset. |
| `x:Subclass`, `x:Members`, `x:Member`, `x:Property` | Partial | Declaration/schema intrinsic support | Parse, preserve, require `x:Subclass` and `x:Members` on the root object with `x:Class`, require `x:Members` property-element syntax, allow only `x:Member`/`x:Property` declaration objects, and require `Name`/`Type` metadata on each declaration. | Preserved-only with warnings; no CLR member generation or type execution. | Declaration `Type` values are preserved as metadata; deeper namespace-aware validation is the next safe slice. |
| `x:Type` / `x:TypeExtension` | Partial | Phase 5 | Parse structured type markup extensions and object elements, validate required type names, known simple object type names, namespace-qualified UI type references, and supported XAML/`clr-namespace:System` primitive type names. | Runtime lowering evaluates supported `{x:Type ...}` and `<x:Type TypeName="..." />` forms to type-name strings; authoring serialization preserves source structure. | Arbitrary CLR type loading, generic type execution, and CLR static value resolution remain deferred. |
| `x:Null` | Partial | Phase 5 | Parse as markup extension or intrinsic object element. | Runtime lowering maps `{x:Null}` and `<x:Null />` member values to semantic `null`; authoring serialization preserves source structure. | Serializer support for emitting `x:` namespace declarations from synthesized null values is still pending. |
| `x:Array` | Partial | Phase 5 | Parse and validate intrinsic `x:Array` object elements, required `Type`, direct content, `x:Array.Items`, namespace-qualified `{x:Type ...}` item-type expressions, and supported primitive item types such as `x:String`, `x:Int32`, `x:Boolean`, `x:Decimal`, `System.Int32`, and `sys:Int32` when `sys` maps to `clr-namespace:System`. | Authoring lowering preserves structural `Array` compatibility nodes; runtime lowering evaluates single member values and keyed resources to JavaScript arrays, coercing supported primitive item objects/text to JS primitives with range-aware integer, `Single`, and 96-bit decimal checks. Decimal runtime values lower as strings to avoid JavaScript number precision loss. | Arbitrary CLR array type execution and generic array type execution remain deferred. |
| `x:Static` / `x:StaticExtension` | Partial | Phase 5 | Parse structured static markup extensions and object elements, validate required type-qualified member references, resolve known schema owner/member tokens, and accept supported `clr-namespace:System` primitive constants. | Runtime lowering evaluates supported `{x:Static ...}` and `<x:Static Member="..." />` forms to stable member-token strings; authoring serialization preserves source structure. | CLR/static value execution remains deferred. |
| `x:Reference` / `x:ReferenceExtension` | Partial | Phase 5 | Parse structured reference markup extensions and object elements, validate required `Name`, and resolve against the active namescope including forward references; `ResourceDictionary`, `ControlTemplate`, `DataTemplate`, and `ObjectIsland` create local namescope boundaries. | Runtime lowering preserves object identity for supported object-valued references from both extension and object-element forms; authoring serialization preserves source structure. | Template/object-island rendering semantics remain deferred; their namescope validation is current. |
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
| `ControlTemplate` | Partial | Validation-only template namescope boundary. | VisualTree | Schema-valid for `Button.Template` and resource dictionary entries; emits unrenderable warnings until template runtime support exists. |
| `DataTemplate` | Partial | Validation-only data-template namescope boundary. | VisualTree | Schema-valid for `Button.ContentTemplate` and resource dictionary entries; emits unrenderable warnings until data templating exists. |
| `ObjectIsland` | Partial | Validation-only object-island namescope boundary. | Content | Provides a future object-island shape for namescope validation without claiming runtime rendering support. |

## Member Matrix

| Member family | Current support | Target status | Notes |
| --- | --- | --- | --- |
| Common sizing: `Width`, `Height` | Current | Phase 2 schema metadata | Numeric values validate and coerce through schema text syntax. |
| Box model: `Margin`, `Padding`, `BorderThickness` | Partial | Phase 2 schema metadata | Runtime support can remain incremental. |
| Alignment: `HorizontalAlignment`, `VerticalAlignment` | Partial | Phase 2 schema metadata | Declared enum values validate through schema text syntax; runtime layout support can remain incremental. |
| Visual color: `Background`, `BorderBrush`, `Fill`, `Foreground` | Current | Phase 2 schema metadata | Hex color values validate through schema text syntax and remain string values for runtime color parsing. |
| Text: `Text`, `Content`, `FontSize`, `FontWeight`, `FontFamily`, `FontStyle`, `LineHeight`, `TextAlignment`, `TextWrapping`, `TextOverflow`, `TextTrimming`, `FlowDirection`, `Direction` | Current | Phase 2 schema metadata | `Direction` should remain a compatibility alias for `FlowDirection`. |
| Templates: `Button.Template`, `Button.ContentTemplate` | Partial | Template/style compatibility metadata | Schema-valid and namescope-aware, but unrenderable until the style/template runtime exists. |
| Image: `Source`, `Stretch`, `Opacity` | Current | Phase 2 schema metadata | `Stretch` enum and numeric opacity values validate through schema text syntax. |
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
| Invalid text syntax value | Error | Number, boolean, enum, and color member values are validated from schema metadata. |
| Invalid collection item type | Error | Collection metadata controls which known item types can appear in a list or dictionary. |
| Missing or duplicate dictionary key | Error | Dictionary items require a stable key, either explicit `x:Key` or a type-level implicit key property. |
| Unrenderable but schema-valid member | Warning | Valid source should not disappear silently at runtime. |
| Unrenderable but schema-valid type | Warning | Validation-only vocabulary shapes such as templates should be round-trippable without pretending runtime support exists. |

Current limitation:

1. Namescope validation and `x:Reference` resolution now support the document root, `ResourceDictionary`, validation-only template types, and validation-only object islands; full template/style runtime behavior is still deferred.
2. Markup extension parsing currently covers attribute values and property-element text; supported intrinsic object elements now cover `x:Array`, `x:Null`, `x:Type`, `x:Static`, and `x:Reference`, while unsupported object-element extension forms remain deferred.
3. Runtime resource lookup supports primitive resources, known control object resources, dynamic resource overrides, structural object resources, and keyed `x:Array` resources with range-aware primitive item coercion; resource object retrieval still creates resource instances, while arbitrary CLR type loading and CLR static value resolution remain deferred.
4. Runtime `Binding` evaluation is v1-only: one-way path lookup against a supplied data context, without converters or multi-binding.
5. Designer infoset edit propagation currently covers mapped object paths, attribute/property-element values, and child insert/remove/move operations. If a future edit targets a lowered compatibility shape that cannot be mapped back to an infoset node safely, serialization still falls back to the lowered shape rather than saving stale semantic source.

## Current Implementation Checkpoint

Completed foundation work:

1. Infoset/schema primitives, vocabulary registries, and compatibility lowering are in place.
2. Runtime parse/validate/lower paths now back rendered app documents, while strict authoring parse/validate/lower paths back `designer-core` and the designer config vocabularies.
3. Validation fixtures cover parser structure, registry-backed validation, lowering behavior, and designer config namespaces.
4. Intrinsic directive validation now includes scoped `x:Name` checks and root-only `x:Class` placement.
5. Attribute-value and property-element text markup extensions now parse into structured AST nodes, including nested extensions, escaped `{}{...}` literals, and prefixed forms such as `{x:Null}`, while authoring lowering preserves the original raw text for source compatibility.
6. Collection metadata now validates allowed item types for list containers, and dictionary metadata validates explicit `x:Key`, implicit key properties, missing keys, and duplicate keys.
7. Runtime lowering now evaluates v1 `Binding` paths against a supplied data context, maps `{x:Null}` to semantic `null`, and resolves scoped primitive `{StaticResource ...}` references.
8. Infoset semantic serialization now round-trips namespace declarations, directives, markup extensions, property elements, and resource collection structures through fixture coverage.
9. Designer source import/export now serializes from the parsed infoset, and mapped designer edits propagate into that infoset so namespace prefixes, directives, property elements, markup extensions, and resource property elements survive common visual editing flows.
10. XML scope handling now applies `xml:space` preserve/default behavior to text parsing and propagates `xml:lang` through object metadata and compatibility lowering.
11. Runtime resource lowering now supports scoped object-valued resources for known controls, including object resources that depend on earlier primitive resources in the same dictionary.
12. `DynamicResource` now evaluates from scoped resources by default and from runtime override maps when present; `RuntimeHost` can update and clear dynamic resource overrides without changing XAML source.
13. Default text lowering now applies XML whitespace normalization, while `xml:space` preserve/default controls opt-in exact whitespace preservation.
14. Intrinsic `x:Array` object elements now parse, validate required `Type`, validate simple object and supported primitive item types, enforce scoped numeric ranges, serialize, preserve structural authoring compatibility nodes, and runtime-lower single member/resource values to JavaScript arrays.
15. `{x:Type ...}` now validates known simple object and supported primitive type names, preserves authoring source, and runtime-lowers to type-name strings for scenarios such as `x:Array Type`.
16. `{x:Static ...}` now validates required type-qualified member references, resolves known schema owner/member tokens and supported CLR primitive constants, preserves authoring source, and runtime-lowers to stable member-token strings.
17. `{x:Reference ...}` now validates required names, supports forward references within the active namescope, preserves authoring source, and runtime-lowers supported object-valued references to the same lowered object instance.
18. `ResourceDictionary` now creates a local namescope boundary, so duplicate names inside resources do not collide with visual-tree names, visual-tree references cannot see dictionary-local names, and dictionary-local references can resolve locally.
19. Runtime lowering caches lowered object nodes for `x:Reference`, preserves shared references during resource graph cloning, and still rejects circular reference chains.
20. Text syntax conversion now belongs to schema metadata: known members coerce number/boolean values, preserve decimal values as strings, and preserve string-like numeric text without parser-wide guessing, while invalid number, decimal, boolean, enum, and color values produce schema diagnostics.
21. Object-element forms for supported intrinsic `x:Null`, `x:Type`, `x:Static`, and `x:Reference` now validate, serialize, and runtime-lower when the target member can safely represent the value.
22. Type-name validation for `x:Type` and `x:Array Type` now uses in-scope XML namespace declarations, including prefix-qualified `ui-designer` types, validation-only `clr-namespace:System` primitive aliases such as `sys:Int32`, and deterministic errors for unknown prefixes, CLR namespaces, or CLR primitive types.
23. `x:Decimal` now has decimal-specific lexical validation, 28-scale and 96-bit range checks, boundary fixtures, overflow fixtures, and runtime lowering that keeps decimal text exact instead of coercing through JavaScript `number`.
24. Validation-only `x:Static` member resolution now catches unknown owners and unknown members for known schema types and supports scoped CLR primitive constants such as `sys:Double.NaN`, `sys:Int32.MaxValue`, and `sys:Decimal.MaxValue`.
25. Validation-only `x:TypeArguments` support now parses comma-separated and nested type-name lists, validates namespace-qualified UI types and scoped CLR primitive aliases, preserves valid generic metadata, and rejects malformed or unknown type arguments.
26. Validation-only `ControlTemplate`, `DataTemplate`, and `ObjectIsland` types now create schema-marked namescope boundaries, so duplicate names are isolated across boundaries, local `x:Reference` values resolve inside the boundary, and outside references cannot see boundary-local names.
27. Preserved-only construction directives now cover `x:FactoryMethod`, `x:Arguments`, `x:ConstructorArgs`, and `x:InitializationText`, including property-element parsing for construction argument directives, placement validation, duplicate argument-form detection, and serialization round-trip coverage.
28. Preserved-only markup-compilation/XML data metadata now covers `x:ClassModifier`, `x:FieldModifier`, `x:Code`, and `x:XData`, including dependency validation and raw XML island serialization.
29. Preserved-only declaration intrinsics now cover `x:Subclass`, `x:Members`, `x:Member`, and `x:Property`, including root/class dependency validation, declaration item validation, and serialization round-trip coverage.

Approximate targeted core `MS-XAML-2017` support: **95%**. This estimate covers the scoped language/object-mapping target in this matrix, not full WPF vocabulary parity.

Next slice:

1. Add namespace-aware validation for `x:Member`/`x:Property` declaration `Type` values.
2. Keep arbitrary CLR execution deferred until declaration metadata can be validated without loading CLR types.
