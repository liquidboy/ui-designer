# Phase 5 Markup Extension Fixtures

These fixtures cover the first structured brace-syntax parsing slice for XAML markup extensions.

| Fixture | Expected result |
| --- | --- |
| `binding-attribute.xaml` | `{Binding Path=Title}` parses into a structured markup extension AST and authoring lowering preserves raw text. |
| `binding-property-element.xaml` | Property-element text such as `<TextBlock.Text>{Binding Path=Title}</TextBlock.Text>` parses into the same structured AST shape. |
| `nested-extension.xaml` | Nested extensions such as `Converter={StaticResource TitleConverter}` are parsed recursively and preserved. |
| `escaped-literal.xaml` | `{}{...}` remains literal text instead of a markup extension node. |
| `escaped-property-element.xaml` | Escaped property-element text remains literal instead of becoming a markup extension node. |
| `x-null-attribute.xaml` | Prefixed intrinsic extensions such as `{x:Null}` resolve their namespace and authoring lowering preserves raw text. |
| `x-null-property-element.xaml` | Prefixed intrinsic extensions also resolve when they appear in property-element text. |
| `invalid-markup-extension.xaml` | Unterminated brace syntax surfaces `invalid-markup-extension-syntax`. |
| `invalid-property-element.xaml` | Unterminated property-element brace syntax surfaces `invalid-markup-extension-syntax`. |
