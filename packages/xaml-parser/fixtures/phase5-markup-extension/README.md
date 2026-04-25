# Phase 5 Markup Extension Fixtures

These fixtures cover the first structured brace-syntax parsing slice for XAML markup extensions.

| Fixture | Expected result |
| --- | --- |
| `binding-attribute.xaml` | `{Binding Path=Title}` parses into a structured markup extension AST and lowers back to raw text. |
| `nested-extension.xaml` | Nested extensions such as `Converter={StaticResource TitleConverter}` are parsed recursively and preserved. |
| `escaped-literal.xaml` | `{}{...}` remains literal text instead of a markup extension node. |
| `x-null-attribute.xaml` | Prefixed intrinsic extensions such as `{x:Null}` resolve their namespace and are preserved with warnings only. |
| `invalid-markup-extension.xaml` | Unterminated brace syntax surfaces `invalid-markup-extension-syntax`. |
