# Phase 1 XAML Parser Fixtures

These fixtures cover the first spec-shaped parser target from `docs/xaml-compliance-matrix.md`.

They are intentionally small and should become executable parser compliance tests when the repo gets a dedicated test runner.

| Fixture | Purpose |
| --- | --- |
| `plain-object.xaml` | Object elements and nested content objects. |
| `namespaced-root.xaml` | Namespace declarations and qualified intrinsic directive names. |
| `attribute-members.xaml` | Attribute members, dotted attached members, and legacy primitive coercion. |
| `property-element.xaml` | Property/member element syntax. |
| `mixed-content.xaml` | Ordered text/object/text content preservation. |
| `invalid-xml.xaml` | Invalid XML diagnostic path. |

