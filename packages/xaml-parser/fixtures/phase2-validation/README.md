# Phase 2 Validation Fixtures

These fixtures document the first registry-backed validation behaviors.

They should become executable cases once the XAML compliance test runner is added.

| Fixture | Expected result |
| --- | --- |
| `valid-basic.xaml` | No validation errors. |
| `valid-directive-preserved.xaml` | No validation errors; `x:Name` is preserved with a runtime-support warning. |
| `unknown-type.xaml` | `unknown-type` error. |
| `unknown-member.xaml` | `unknown-member` error. |
| `duplicate-member.xaml` | `duplicate-member` error. |
| `invalid-enum.xaml` | `invalid-enum-value` error. |
| `invalid-content.xaml` | `content-children-not-allowed` error. |

