# Phase 2 Validation Fixtures

These fixtures document the first registry-backed validation behaviors.

They should become executable cases once the XAML compliance test runner is added.

| Fixture | Expected result |
| --- | --- |
| `valid-basic.xaml` | No validation errors. |
| `valid-directive-preserved.xaml` | No validation errors; `x:Name` is preserved with a runtime-support warning. |
| `valid-class-root.xaml` | No validation errors; root `x:Class` is preserved with a runtime-support warning. |
| `valid-metadata-directives.xaml` | No validation errors; `x:Uid`, `x:TypeArguments`, `xml:lang`, and `xml:space` are recognized and preserved with warnings. |
| `duplicate-namescope.xaml` | `namescope-collision` error for duplicate `x:Name` values in the current document namescope. |
| `invalid-class-child.xaml` | `invalid-directive-placement` error for `x:Class` on a non-root object. |
| `unknown-type.xaml` | `unknown-type` error. |
| `unknown-member.xaml` | `unknown-member` error. |
| `duplicate-member.xaml` | `duplicate-member` error. |
| `invalid-enum.xaml` | `invalid-enum-value` error. |
| `invalid-content.xaml` | `content-children-not-allowed` error. |
