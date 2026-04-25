# Phase 5 Markup Extension Fixtures

These fixtures cover the first structured brace-syntax parsing slice for XAML markup extensions.

| Fixture | Expected result |
| --- | --- |
| `binding-attribute.xaml` | `{Binding Path=Title}` parses into a structured markup extension AST and authoring lowering preserves raw text. |
| `nested-extension.xaml` | Nested extensions such as `Converter={StaticResource TitleConverter}` are parsed recursively; unsupported nested extensions still warn. |
| `escaped-literal.xaml` | `{}{...}` remains literal text instead of a markup extension node. |
| `x-null-attribute.xaml` | Prefixed intrinsic extensions such as `{x:Null}` resolve their namespace and authoring lowering preserves raw text. |
| `invalid-markup-extension.xaml` | Unterminated brace syntax surfaces `invalid-markup-extension-syntax`. |
