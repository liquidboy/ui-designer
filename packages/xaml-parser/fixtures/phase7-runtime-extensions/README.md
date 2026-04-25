# Phase 7 Runtime Markup Extension Fixtures

These fixtures cover runtime evaluation for the first supported markup extensions.

| Fixture | Expected result |
| --- | --- |
| `binding-text.xaml` | Runtime lowering evaluates `{Binding Path=Title}` against the supplied data context. |
| `binding-property-element.xaml` | Runtime lowering evaluates property-element text bindings against the supplied data context. |
| `binding-positional.xaml` | Runtime lowering accepts a positional binding path. |
| `binding-nested-path.xaml` | Dot-separated binding paths traverse nested objects. |
| `x-null-content.xaml` | Runtime lowering maps `{x:Null}` to a semantic `null` attribute value. |
| `x-null-property-element.xaml` | Runtime lowering maps property-element text `{x:Null}` to a semantic `null` attribute value. |
| `escaped-literal.xaml` | Escaped `{}{...}` values stay literal even when runtime evaluation is enabled. |
| `object-content.xaml` | Object-only content does not synthesize an empty scalar `Content` value during runtime lowering. |
