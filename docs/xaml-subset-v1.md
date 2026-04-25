# XAML Subset v1

## Scope

Version 1 intentionally includes a small control and property set so layout, rendering, and interaction can stabilize quickly.

## Controls

1. `Canvas`
2. `StackPanel`
3. `Grid`
4. `Border`
5. `Rectangle`
6. `TextBlock`
7. `Image`
8. `Button`

## Common Properties

1. `Width`, `Height`
2. `Margin`, `Padding`
3. `HorizontalAlignment`, `VerticalAlignment`
4. `Opacity`, `Visibility`
5. `Background`, `BorderBrush`, `BorderThickness`
6. `Transform` (translation + scale for v1)

## Text Properties

Supported on `TextBlock` and button labels where applicable:

1. `Text` / `Content`
2. `Foreground`
3. `FontSize`
4. `FontWeight`
5. `FontFamily`
6. `FontStyle`
7. `LineHeight`
8. `TextAlignment`
9. `TextWrapping`
10. `TextOverflow`
11. `TextTrimming`
12. `FlowDirection` / `Direction`

Runtime notes:

1. `FontFamily` values are treated as CSS font-family lists and the runtime appends a sane fallback chain when the declaration does not include one.
2. Browser font loading is warmed before first paint when possible, then refreshed during subsequent renders as new text styles appear.
3. Text direction defaults to `Auto`, which currently infers left-to-right or right-to-left layout from the first strong script characters in the string.

## Image Properties

Supported on `Image`:

1. `Source`
2. `Stretch`
3. `Opacity`
4. `Background`

Runtime notes:

1. Image natural size is cached from the source asset when possible and now participates in default layout sizing.
2. When only one dimension is explicit, the runtime preserves the natural aspect ratio while resolving the other dimension.

## Events

1. `PointerDown`
2. `PointerMove`
3. `PointerUp`
4. `Click`

## Text Syntax

Current status:

1. Known member values validate and lower through schema-owned `valueSyntax` metadata.
2. `number` and `boolean` members coerce to runtime primitives only when the schema declares those syntaxes.
3. `decimal`, `string`, `uri`, `color`, `enum`, and `any` members remain string-valued for runtime consumption.
4. Invalid number, decimal, boolean, enum, and hex color values produce validation errors.
5. Unknown preserved compatibility members still use the legacy fallback coercion path until they are modeled in schema metadata.

## Collections and Keys

Current status:

1. Runtime child containers such as `Canvas`, `StackPanel`, and `Grid` validate their child content as list collections of known controls.
2. Designer theme `Colors` validates as a dictionary, with entries keyed by explicit `x:Key` or implicit `Color.Id`.
3. Missing keys, duplicate keys, invalid collection item types, and `x:Key` outside dictionary items produce validation errors.
4. Runtime `ResourceDictionary` supports primitive `Color`, `Number`, and `String` resources keyed by `x:Key`.
5. Runtime `ResourceDictionary` also supports known control object resources keyed by `x:Key`.
6. `{StaticResource ...}` references resolve against the nearest scoped runtime resources during runtime lowering.
7. Object-valued resources can depend on earlier primitive resources in the same dictionary.
8. `{DynamicResource ...}` references resolve against scoped resources by default and runtime override maps when present.
9. `RuntimeHost` can update and clear dynamic resource overrides without changing XAML source.
10. `ResourceDictionary` creates a local namescope boundary for `x:Name` and `{x:Reference ...}`.
11. Full WPF-style resource invalidation and dependency tracking are outside v1.

Supported runtime form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Canvas.Resources>
    <ResourceDictionary>
      <Color x:Key="Accent">#67c7ff</Color>
    </ResourceDictionary>
  </Canvas.Resources>
  <TextBlock Foreground="{StaticResource Accent}" Text="Resource-backed text" />
</Canvas>
```

Supported object-resource form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Canvas.Resources>
    <ResourceDictionary>
      <TextBlock x:Key="SharedLabel" Text="Reusable label" />
    </ResourceDictionary>
  </Canvas.Resources>
  <Border>
    <Border.Child>{StaticResource SharedLabel}</Border.Child>
  </Border>
</Canvas>
```

Supported dynamic-resource form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Canvas.Resources>
    <ResourceDictionary>
      <Color x:Key="Accent">#67c7ff</Color>
    </ResourceDictionary>
  </Canvas.Resources>
  <TextBlock Foreground="{DynamicResource Accent}" Text="Live resource-backed text" />
</Canvas>
```

## Template and Object-Island Namescopes

Current status:

1. `ControlTemplate`, `DataTemplate`, and `ObjectIsland` are validation-only vocabulary shapes.
2. Each shape creates a local namescope for `x:Name` and `{x:Reference ...}` validation.
3. Duplicate names inside the same template or object island still fail, while identical names in separate boundaries are allowed.
4. Boundary-local names cannot be referenced from the outer visual tree.
5. `Button.Template` and `Button.ContentTemplate` are schema-valid host members, but they emit unrenderable warnings until template/style runtime support exists.

Supported validation-only form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <TextBlock x:Name="SharedName" Text="Outer label" />
  <Button>
    <Button.Template>
      <ControlTemplate TargetType="{x:Type Button}">
        <TextBlock x:Name="SharedName" Text="Template label" />
      </ControlTemplate>
    </Button.Template>
  </Button>
</Canvas>
```

## Generic Metadata

Current status:

1. `x:TypeArguments` parses as an intrinsic XAML directive and is preserved during semantic serialization.
2. The directive validates comma-separated type-name lists, including nested parenthesized generic-looking forms.
3. Type names resolve through in-scope XML namespace declarations, including namespace-qualified `ui-designer` types, validation-only `clr-namespace:System` primitive aliases, and configured no-execution `Liquidboy.UI.Designer*` CLR namespace aliases.
4. Valid `x:TypeArguments` metadata still produces an unsupported-directive warning because runtime generic execution remains outside v1.

Supported preserved form:

```xaml
<ui:Canvas
  xmlns:ui="https://liquidboy.dev/ui-designer"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sys="clr-namespace:System;assembly=mscorlib"
  x:TypeArguments="sys:Int32, ui:TextBlock, x:Decimal" />
```

## Construction Directives

Current status:

1. `x:FactoryMethod`, `x:Arguments`, `x:ConstructorArgs`, and `x:InitializationText` parse as intrinsic XAML directives.
2. `x:Arguments` and `x:ConstructorArgs` parse as directive property elements rather than object elements.
3. `x:FactoryMethod` requires a CLR identifier such as `Create`.
4. Construction argument directives must use property-element syntax and provide at least one object or markup-extension argument value.
5. Text-only argument lists, empty argument lists, and duplicate `x:Arguments`/`x:ConstructorArgs` forms produce validation errors.
6. Construction directives are preserved and serialized with unsupported-directive warnings; constructors and factory methods are not executed in v1.

Supported preserved form:

```xaml
<Button xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:FactoryMethod="Create">
  <x:Arguments>
    <x:String>Primary action</x:String>
    <x:Int32>3</x:Int32>
  </x:Arguments>
</Button>
```

## Markup Compilation and XML Data Directives

Current status:

1. `x:ClassModifier` and `x:FieldModifier` parse as preserved intrinsic XAML directives.
2. `x:ClassModifier` is valid only on the document root object and requires `x:Class` on that object.
3. `x:FieldModifier` requires root `x:Class` and same-object `x:Name`.
4. `x:Class` requires a non-empty CLR-style qualified type name such as `Example.RootView`.
5. `x:Code` parses as an intrinsic XAML object and is valid only as direct document-root content when the root has `x:Class`.
6. `x:XData` parses as an intrinsic XAML object and preserves raw XML island content without validating island elements as UI objects.
7. These constructs are preserved and serialized with warnings; no code is compiled, generated, or executed in v1.

Supported preserved forms:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="Example.RootView" x:ClassModifier="internal">
  <TextBlock x:Name="TitleText" x:FieldModifier="private" Text="Named field" />
  <x:Code><![CDATA[
    void WireUp() { /* preserved only */ }
  ]]></x:Code>
</Canvas>
```

```xaml
<Button xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Button.Content>
    <x:XData>
      <payload xmlns="urn:example">
        <item name="A">{literal}</item>
      </payload>
    </x:XData>
  </Button.Content>
</Button>
```

## Declaration Intrinsics

Current status:

1. `x:Subclass` parses as a preserved intrinsic XAML directive.
2. `x:Subclass` is valid only on the document root object, requires `x:Class` on that object, and requires a CLR-style qualified type name.
3. `x:Members` parses as a preserved directive property element on the document root object and requires root `x:Class`.
4. `x:Members` accepts only `x:Member` and `x:Property` object declarations.
5. `x:Member` and `x:Property` declarations require `Name` and `Type` metadata.
6. Declaration `Name` values must be CLR identifiers such as `Title` or `_Title2`.
7. Declaration `Type` values validate against in-scope XML namespace mappings, including namespace-qualified `ui-designer` types, XAML primitive types, validation-only `clr-namespace:System` primitive aliases, and configured no-execution `Liquidboy.UI.Designer*` CLR namespace aliases.
8. Declaration metadata is preserved and serialized with warnings; no CLR members or types are generated in v1.

Supported preserved form:

```xaml
<Canvas
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="https://liquidboy.dev/ui-designer"
  xmlns:sys="clr-namespace:System;assembly=mscorlib"
  x:Class="Example.RootView"
  x:Subclass="Example.RootViewBase">
  <x:Members>
    <x:Property Name="Title" Type="x:String" />
    <x:Property Name="Child" Type="ui:TextBlock" />
    <x:Member Name="Count" Type="sys:Int32" />
  </x:Members>
</Canvas>
```

## Intrinsic Arrays

Current status:

1. `x:Array` object elements validate as intrinsic XAML language objects.
2. `Type` is required and simple object item types are checked against direct content or `x:Array.Items`.
3. `{x:Type ...}` item-type expressions validate known simple object type names, namespace-qualified `ui-designer` object type names, supported XAML/`clr-namespace:System` primitive type names, and configured no-execution `Liquidboy.UI.Designer*` CLR namespace aliases, then runtime-lower to type-name strings.
4. `<x:Type TypeName="..." />` object elements validate and runtime-lower to type-name strings in scalar member positions.
5. Authoring serialization preserves `x:Array` namespace prefixes, property-element form, and raw/object `x:Type` source.
6. Authoring compatibility lowering emits a structural `Array` node with item children so source round-tripping remains stable.
7. Runtime lowering evaluates single `x:Array` member values and keyed `ResourceDictionary` entries to JavaScript arrays of supported runtime values.
8. Supported primitive item elements such as `x:String`, `x:Int32`, `x:Double`, and `x:Boolean` coerce to JavaScript string, number, and boolean values.
9. Integer primitive aliases and `x:Single` enforce scoped numeric ranges; `x:Decimal` enforces 28-scale and 96-bit decimal limits while lowering as a string to avoid JavaScript number precision loss.
10. `System.Int32`-style primitive type tokens and `xmlns:sys="clr-namespace:System;assembly=mscorlib"` aliases such as `sys:Int32` are accepted for validation-only primitive resolution.
11. Configured `Liquidboy.UI.Designer*` CLR namespace aliases validate known schema types without reflection, arbitrary assembly loading, or CLR execution.
12. Arbitrary CLR type loading and generic type execution remain outside v1.

Supported structural form:

```xaml
<x:Array xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Type="TextBlock">
  <TextBlock Text="First" />
  <TextBlock Text="Second" />
</x:Array>
```

Supported `x:Type` form:

```xaml
<x:Array xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Type="{x:Type TextBlock}">
  <TextBlock Text="Typed" />
</x:Array>
```

Supported runtime member/resource form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Canvas.Resources>
    <ResourceDictionary>
      <x:Array x:Key="Labels" Type="TextBlock">
        <TextBlock Text="First resource item" />
        <TextBlock Text="Second resource item" />
      </x:Array>
    </ResourceDictionary>
  </Canvas.Resources>
  <Button Content="{StaticResource Labels}" />
</Canvas>
```

Supported primitive item form:

```xaml
<Button xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Button.Content>
    <x:Array Type="{x:Type x:Int32}">
      <x:Int32>1</x:Int32>
      <x:Int32>2</x:Int32>
    </x:Array>
  </Button.Content>
</Button>
```

Supported primitive boundary form:

```xaml
<Button xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Button.Content>
    <x:Array Type="x:Int32">
      <x:Int32>-2147483648</x:Int32>
      <x:Int32>2147483647</x:Int32>
    </x:Array>
  </Button.Content>
</Button>
```

Supported CLR primitive namespace form:

```xaml
<Button
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sys="clr-namespace:System;assembly=mscorlib">
  <Button.Content>
    <x:Array Type="{x:Type sys:Int32}">
      <x:Int32>7</x:Int32>
      <x:Int32>8</x:Int32>
    </x:Array>
  </Button.Content>
</Button>
```

Supported schema-backed CLR namespace form:

```xaml
<x:Array
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:local="clr-namespace:Liquidboy.UI.Designer;assembly=ui-designer"
  Type="{x:Type local:TextBlock}">
  <local:TextBlock Text="CLR schema alias" />
</x:Array>
```

Supported decimal form:

```xaml
<Button xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Button.Content>
    <x:Array Type="x:Decimal">
      <x:Decimal>79228162514264337593543950335</x:Decimal>
      <x:Decimal>0.1234567890123456789012345678</x:Decimal>
    </x:Array>
  </Button.Content>
</Button>
```

## Intrinsic Static Members

Current status:

1. `{x:Static ...}` and `{x:Static Member=...}` markup extensions parse as intrinsic XAML language expressions.
2. `<x:Static Member="..." />` object elements parse as intrinsic XAML language objects.
3. Static references must provide a type-qualified member token, such as `TextBlock.Text`.
4. Authoring serialization preserves the original extension or object-element source structure.
5. Runtime lowering emits the stable member-token string.
6. Validation resolves known schema member tokens, attached member tokens such as `Grid.Row`, and supported `clr-namespace:System` primitive constants such as `sys:Double.NaN`.
7. CLR/static value execution remains outside v1.

Supported form:

```xaml
<TextBlock xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Text="{x:Static TextBlock.Text}" />
```

Supported object-element form:

```xaml
<TextBlock xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <TextBlock.Text>
    <x:Static Member="TextBlock.Text" />
  </TextBlock.Text>
</TextBlock>
```

Supported CLR primitive constant form:

```xaml
<TextBlock
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sys="clr-namespace:System;assembly=mscorlib"
  Text="{x:Static sys:Double.NaN}" />
```

## Intrinsic References

Current status:

1. `{x:Reference ...}` and `{x:Reference Name=...}` markup extensions parse as intrinsic XAML language expressions.
2. `<x:Reference Name="..." />` object elements parse as intrinsic XAML language objects.
3. Reference names must resolve to an `x:Name` in the active namescope, including forward references.
4. Authoring serialization preserves the original extension or object-element source structure.
5. Runtime lowering emits the same lowered object instance for supported object-valued reference members.
6. `ResourceDictionary`, `ControlTemplate`, `DataTemplate`, and `ObjectIsland` are local namescope boundaries: boundary-local references can see boundary-local names, while outer visual-tree references cannot see names hidden inside the boundary.
7. Circular reference chains fail during runtime lowering.
8. Template/object-island namescope validation is schema-only; rendering and style application remain outside v1.

Supported form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <TextBlock x:Name="SharedLabel" Text="Shared label" />
  <Border>
    <Border.Child>{x:Reference SharedLabel}</Border.Child>
  </Border>
</Canvas>
```

Supported object-element form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <TextBlock x:Name="SharedLabel" Text="Shared label" />
  <Border>
    <Border.Child>
      <x:Reference Name="SharedLabel" />
    </Border.Child>
  </Border>
</Canvas>
```

Supported resource-local reference form:

```xaml
<Canvas xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Canvas.Resources>
    <ResourceDictionary>
      <TextBlock x:Key="SharedLabel" x:Name="SharedLabel" Text="Resource label" />
      <Border x:Key="SharedBorder">
        <Border.Child>{x:Reference SharedLabel}</Border.Child>
      </Border>
    </ResourceDictionary>
  </Canvas.Resources>
  <Border>
    <Border.Child>{StaticResource SharedBorder}</Border.Child>
  </Border>
</Canvas>
```

## Binding v1

Supported runtime form:

```xaml
<TextBlock Text="{Binding path=Title}" />
<TextBlock>
  <TextBlock.Text>{Binding Path=Title}</TextBlock.Text>
</TextBlock>
```

Current status:

1. Attribute-based and property-element text binding expressions now parse into a structured markup extension AST instead of plain text.
2. Runtime lowering evaluates one-way `Binding` paths against the supplied runtime data context.
3. Authoring lowering still preserves parsed binding expressions as raw strings for source compatibility.
4. Escaped literals such as `{}{Binding Path=Title}` stay as literal text, and nested attribute-value extensions are preserved structurally.
5. `{x:Null}` and `<x:Null />` lower to semantic `null` in runtime mode and preserve source structure in authoring mode.

Current constraints:

1. One-way binding only.
2. Path lookup on a supplied data context object.
3. No converters or multi-binding in v1.

## Authoring Serialization

Current status:

1. Documents loaded through the designer source panel, import flow, draft load, or startup parse keep their semantic infoset for source serialization.
2. Semantic serialization preserves namespace prefixes, directives, markup extensions, property elements, and resource collection structures.
3. Inspector, palette, component-tree, drag, and resize edits now propagate mapped attribute, property-element, insert, remove, and move operations into the semantic infoset.
4. If a future lowered compatibility edit cannot be mapped safely to the infoset, the designer drops back to lowered serialization rather than saving stale semantic source.

## XML Scope Directives

Current status:

1. `xml:space="preserve"` preserves whitespace-only text nodes within its scope.
2. `xml:space="default"` resets inherited whitespace preservation for descendants.
3. Default scalar/content lowering collapses XML whitespace runs and trims text values when `xml:space` is not preserving the text.
4. `xml:lang` is inherited by descendant object nodes and lowers to compatibility `lang` metadata.
5. Whitespace edge cases around future templates/object islands remain outside the v1 subset.

## Example Document

```xaml
<Canvas Width="1280" Height="720">
  <Grid Width="640" Height="360">
    <Border Background="#1F2937" BorderBrush="#334155" BorderThickness="1" Padding="16">
      <StackPanel>
        <TextBlock Text="WebGPU UI Runtime" />
        <Button Content="Run" Width="120" />
      </StackPanel>
    </Border>
  </Grid>
</Canvas>
```
