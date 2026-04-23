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

## Events

1. `PointerDown`
2. `PointerMove`
3. `PointerUp`
4. `Click`

## Binding v1

Supported expression:

```xaml
<TextBlock Text="{Binding path=Title}" />
```

Constraints:

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
