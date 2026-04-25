# XAML Spec Compliance Plan

## Goal

Bring the repo into compliance with the core XAML object mapping rules defined by Microsoft in `MS-XAML-2017`, while keeping our custom UI vocabulary and runtime architecture intact.

The practical target is:

1. Parse XAML according to the core language/object-mapping rules.
2. Validate documents against a declared XAML vocabulary.
3. Lower valid documents into our existing runtime/designer model.

This is intentionally different from "implement all of WPF". The core XAML spec defines the language, infoset, schema model, and XML-to-XAML transformation rules. WPF is a separate vocabulary layered on top of that model.

## Recommended Compliance Target

### Phase 1 target

Implement compliance for:

1. `MS-XAML-2017` core language rules.
2. The intrinsic `x:` language namespace and directives we choose to support.
3. A custom `ui-designer` vocabulary declared through a schema registry.

### Phase 2 target

Optionally add a compatibility profile for selected WPF vocabulary concepts where they are useful to our product, but do not block core compliance on full WPF parity.

That keeps the scope sane:

1. Core spec compliance is achievable without implementing every WPF type.
2. Our existing controls can remain custom types as long as they are modeled through a valid XAML schema/vocabulary.
3. WPF compatibility becomes an explicit follow-on track instead of an implicit rewrite goal.

## Current Checkpoint

The repo now has the core compliance foundation in place:

1. `packages/xaml-schema` models qualified names, infoset nodes, source spans, vocabulary metadata, and validation diagnostics.
2. `packages/xaml-parser` parses XML into the spec-shaped infoset, validates against active vocabularies, and lowers back into the legacy `XamlDocument` shape through compatibility adapters.
3. `packages/ui-runtime-web` uses the runtime parse/validate/lower path for app documents, including supported runtime markup-extension evaluation.
4. `packages/designer-core` and the designer config loaders use the registry-backed strict authoring parser for validated, source-compatible documents and designer vocabularies.
5. Attribute-value and property-element text markup extensions now parse into structured AST nodes, including nested extensions, escaped `{}{...}` literals, and prefixed intrinsic forms such as `{x:Null}`.
6. Runtime lowering evaluates v1 `Binding` paths against a supplied data context and maps `{x:Null}` to semantic `null`, while authoring lowering still preserves raw markup text.
7. Runtime lowering also collects scoped primitive and known control object `ResourceDictionary` entries and resolves `{StaticResource ...}` references during lowering.
8. The infoset semantic serializer round-trips namespace declarations, directives, markup extensions, property elements, and resource collection structures.
9. Designer source import/export now serializes from the semantic infoset, and mapped designer mutations propagate attribute, property-element, insert, remove, and move edits into that infoset.
10. XML scope handling now preserves whitespace-only text under `xml:space="preserve"`, resets that behavior with `xml:space="default"`, and propagates `xml:lang` through infoset objects and lowered compatibility nodes.
11. Object-valued runtime resources now support scoped known control resources, key validation, and object resources that depend on earlier primitive resources in the same dictionary.
12. `DynamicResource` runtime lowering now supports primitive/object fallback to scoped resources and runtime override maps for update semantics without changing XAML source.
13. Default text lowering now collapses XML whitespace runs and trims text values, while `xml:space="preserve"` keeps exact scoped text and `xml:space="default"` resets back to normalized behavior.
14. The validator currently covers known namespaces/types/members, duplicate scalar members, content rules, enum/primitive checks, namescope collisions for `x:Name`, root-only placement for `x:Class`, collection item-type constraints, dictionary key validation, and warning-only preservation for unsupported markup extensions.

The main remaining gaps are now:

1. Deferred intrinsic forms such as `x:Array`, `x:Static`, and `x:Reference`.
2. Richer namescope boundaries for future templates, resources, and object islands.
3. Full schema-driven text conversion and whitespace edge cases for deferred intrinsic object forms.

Current limitation:

1. Structured markup extension parsing currently applies to attribute values and property-element text. Object-element intrinsic forms such as `x:Array` remain deferred.
2. Runtime resource lookup supports primitive and known control object resources plus dynamic resource overrides; full WPF-style resource invalidation and dependency tracking are still outside the current target.
3. Runtime `Binding` support is intentionally v1-only: one-way path lookup, no converters, and no multi-binding.
4. Designer infoset edit propagation is intentionally conservative: if a lowered compatibility path cannot be mapped safely back to the infoset, the designer falls back to lowered serialization instead of risking stale or corrupt semantic output.
5. `xml:space` handling and default text normalization are implemented for current scalar/content lowering, but whitespace behavior around deferred intrinsic collections/templates is still partial.

This document remains the long-term roadmap. The current implementation status now lives in [XAML Compliance Matrix](./xaml-compliance-matrix.md).

## Recommended Architecture

Keep the current package layout, but give each layer a clearer responsibility:

### `packages/xaml-schema`

Expand this package so it represents both:

1. The XAML infoset node model we parse into.
2. The schema metadata we validate against.

Recommended additions:

1. Qualified names: local name, prefix, namespace URI.
2. Infoset nodes:
   - document node
   - object node
   - member node
   - text node
3. Schema metadata:
   - `XamlType`
   - `XamlMember`
   - text syntax metadata
   - content property metadata
   - list/dictionary flags
   - name property and dictionary key property
   - whitespace and namescope flags
4. Source spans for diagnostics.

### `packages/xaml-parser`

Turn this into a real XML-to-XAML transformation layer:

1. Parse XML while preserving namespace mappings and mixed content order.
2. Apply spec-style transformation rules into infoset nodes.
3. Parse attribute values into:
   - literal text
   - text-syntax values
   - markup extension expressions
4. Return rich diagnostics with line/column ranges.

### New lowering stage

Add a lowering step between XAML and runtime consumption:

1. `XAML infoset + schema`
2. `validated document model`
3. `runtime/designer tree`

This is the key design change. `ui-core` and `designer-core` should no longer consume the raw parsed XML shape directly.

## Implementation Phases

## Phase 0: Lock Scope and Compliance Definitions

Deliverables:

1. Decide that "spec compliant" means core `MS-XAML-2017` compliance first, not full WPF parity.
2. Decide which intrinsic directives are in scope for v1:
   - required: `x:Name`, `x:Key`, `x:Class`, `x:Uid`, `x:TypeArguments`
   - optional early: `xml:lang`, `xml:space`
   - optional later: `x:Reference`, `x:Array`, `x:Null`, `x:Static`
3. Decide whether unsupported but well-formed constructs should:
   - fail validation
   - parse and round-trip with warnings
   - parse and be ignored at runtime
4. Create a compliance matrix keyed by spec feature and repo support status.

Phase 0 source of truth:

1. [XAML Compliance Matrix](./xaml-compliance-matrix.md)

Exit criteria:

1. We have one written source of truth for in-scope vs deferred features.
2. We stop using "XAML-compatible" and "WPF-compatible" interchangeably.

## Phase 1: Replace the Flat AST with a Spec-Shaped Infoset

Deliverables:

1. Introduce infoset node types in `packages/xaml-schema`.
2. Preserve qualified names and namespace mappings.
3. Model object nodes separately from member nodes.
4. Model text nodes separately from element content.
5. Preserve source spans for diagnostics and editor highlighting.

Repo impact:

1. `packages/xaml-schema`
2. `packages/xaml-parser`
3. Every consumer of `XamlNode`

Exit criteria:

1. The parser no longer returns only `type/attributes/children/text`.
2. We can represent `<Grid.RowDefinitions>...</Grid.RowDefinitions>` and other member elements without flattening them away.

## Phase 2: Introduce a Vocabulary Registry

Deliverables:

1. Add a schema registry for our custom controls and intrinsic `x:` language constructs.
2. Define each control type with:
   - members
   - content property
   - name property alias
   - dictionary/list behavior where relevant
   - text syntax metadata where relevant
3. Encode attached members such as `Grid.Row`, `Grid.Column`, `Canvas.Left`, and `Canvas.Top`.

Recommended approach:

1. Keep the current control catalog, but upgrade it into declarative schema entries.
2. Make schema resolution namespace-aware from day one.

Exit criteria:

1. The parser can resolve whether a given element/member belongs to the `ui-designer` vocabulary or to the intrinsic `x:` namespace.
2. Validation errors can identify unknown types, unknown members, and invalid placement.

## Phase 3: Implement XML-to-XAML Transformation Rules

Deliverables:

1. Support object element syntax.
2. Support property/member element syntax.
3. Support content-property inference.
4. Support attribute-to-member mapping.
5. Support attached member names.
6. Support list and dictionary item population rules.
7. Support directive placement rules on valid nodes.
8. Implement whitespace handling compatible with schema metadata.

Exit criteria:

1. Equivalent XAML written in attribute syntax vs property-element syntax lowers to the same semantic model.
2. Mixed content and text nodes are preserved or rejected according to schema rules, not accidentally lost.

## Phase 4: Implement Directives and Namescopes

Deliverables:

1. Support `x:Name` uniqueness within namescopes.
2. Support `x:Key` for dictionary members and resource-style scenarios.
3. Support `x:Class` root-only validation even if we do not execute markup compilation.
4. Support `x:Uid` as a preserved directive with validation rules.
5. Support `x:TypeArguments` in the infoset and schema model, even if runtime usage is initially limited.
6. Support `xml:lang` and `xml:space` propagation where relevant.

Exit criteria:

1. Directive validation is schema-aware and location-aware.
2. Namescope collisions produce deterministic diagnostics.

## Phase 5: Implement Markup Extension Parsing

Deliverables:

1. Add a markup-extension lexer/parser for brace syntax.
2. Represent markup extensions as structured values, not raw strings.
3. Support nested markup extensions.
4. Support escaping rules for literal braces.

Suggested support tiers:

1. Core parse support:
   - generic extension AST
   - positional arguments
   - named arguments
2. Runtime support first:
   - `Binding`
   - `x:Null`
3. Runtime support later:
   - `x:Static`
   - `x:Reference`
   - resource-reference style extensions if we add dictionary resources

Exit criteria:

1. `{Binding path=Title}` is parsed as a binding expression, not a plain string.
2. Unsupported extensions can be preserved and surfaced as diagnostics instead of being silently misread.

## Phase 6: Lower to Runtime and Designer Models

Deliverables:

1. Add a lowering layer from validated infoset to the runtime element tree.
2. Normalize content-property children into the shape expected by `ui-core`.
3. Resolve attached layout members into the runtime props model.
4. Decide how the runtime handles unsupported but valid constructs:
   - ignore with warning
   - preserve for round-trip but do not execute
   - hard fail
5. Keep the designer working over the lowered semantic model, not the raw XML tree.

Recommended rule:

1. Parser compliance should be broader than runtime execution support.
2. The app should be able to parse and round-trip more constructs than it can render on day one.

Exit criteria:

1. `ui-core` and `designer-core` no longer depend directly on the legacy flat AST contract.
2. The designer tree, selection model, and serializer operate on the validated/lowered model.

## Phase 7: Rebuild Serialization and Round-Trip Guarantees

Deliverables:

1. Replace the current string-concatenation serializer with a semantic serializer.
2. Emit namespace declarations and prefixes correctly.
3. Emit member elements when attribute syntax is not valid.
4. Emit directives in valid locations.
5. Escape attribute and text values correctly.
6. Support canonical serialization for semantically equivalent trees.

Important note:

1. We do not need byte-for-byte formatting preservation to be compliant.
2. We do need semantic round-tripping and valid output.

Exit criteria:

1. Parse -> serialize -> parse produces the same semantic document.
2. Namespaces, directives, markup extensions, and property-element syntax survive round-trip.

## Phase 8: Add a Compliance Test Harness

Deliverables:

1. Add a real test runner for the repo.
2. Create fixture categories:
   - positive parse cases
   - negative validation cases
   - round-trip cases
   - namespace resolution cases
   - directive cases
   - whitespace cases
   - markup extension cases
3. Add golden diagnostics for error scenarios.
4. Add CI gating for the compliance suite.

Recommended command surface:

1. `npm run test:xaml`
2. `npm run test:xaml-compliance`

Exit criteria:

1. Spec-sensitive regressions are caught automatically.
2. The compliance matrix is backed by executable tests, not just docs.

## Order of Operations Inside the Repo

Recommended sequence:

1. `packages/xaml-schema`
2. `packages/xaml-parser`
3. new schema registry / vocabulary definitions
4. lowering layer
5. `packages/ui-core`
6. `packages/designer-core`
7. `apps/designer`
8. round-trip serializer
9. compliance tests

This order minimizes churn because runtime/designer code should be migrated onto a stabilized parser contract once, not repeatedly.

## Definition of Done

We should call this initiative complete only when all of the following are true:

1. The parser implements the core XML-to-XAML transformation rules we scoped from `MS-XAML-2017`.
2. The repo has an explicit schema/vocabulary model, not a hard-coded flat element list.
3. Directives, namespace mappings, property-element syntax, and markup extensions are represented structurally.
4. Serialization produces valid XAML for the supported feature set.
5. A compliance suite proves parse, validate, and round-trip behavior.
6. The designer and runtime operate on lowered semantic models instead of raw XML assumptions.

## Risks and Decision Points

1. **Core spec vs WPF parity**
   Full WPF parity is a separate project. Treating it as part of core compliance will delay the parser rewrite substantially.

2. **Parser compliance vs runtime support**
   We should allow the parser to understand more than the renderer can execute. That separation makes compliance feasible.

3. **Serializer strategy**
   Choose canonical semantic serialization, not formatting-preserving source editing, unless we explicitly decide to build a source-preserving editor.

4. **Schema ownership**
   Our custom controls must be represented as a first-class XAML vocabulary. If we skip that step, we will keep re-encoding schema behavior in ad hoc runtime code.

5. **Testing debt**
   This refactor is risky without a dedicated compliance suite; the repo currently does not have one.

## Immediate Next Step

If we want to start implementation, the first concrete work item should be:

1. implement the Phase 1 target from the [XAML Compliance Matrix](./xaml-compliance-matrix.md)
2. design the new infoset and schema types in `packages/xaml-schema`
3. migrate `packages/xaml-parser` to emit the new model behind a compatibility adapter
4. add fixture coverage for object, member, namespace, text, and invalid XML cases

That gives us a controlled migration path instead of a flag-day rewrite.
