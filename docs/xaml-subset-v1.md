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

## Collections and Keys

Current status:

1. Runtime child containers such as `Canvas`, `StackPanel`, and `Grid` validate their child content as list collections of known controls.
2. Designer theme `Colors` validates as a dictionary, with entries keyed by explicit `x:Key` or implicit `Color.Id`.
3. Missing keys, duplicate keys, invalid collection item types, and `x:Key` outside dictionary items produce validation errors.
4. Runtime resource lookup and semantic dictionary lowering are not available yet.

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
5. `{x:Null}` lowers to semantic `null` in runtime mode and remains raw text in authoring mode.

Current constraints:

1. One-way binding only.
2. Path lookup on a supplied data context object.
3. No converters or multi-binding in v1.

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
