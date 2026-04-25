# Phase 3 Lowering Fixtures

These fixtures cover schema-aware lowering from the spec-shaped infoset back into the current legacy `XamlDocument` runtime/designer shape.

| Fixture | Expected result |
| --- | --- |
| `text-attribute.xaml` | Lowers `TextBlock Text="Hello"` to a `Text` attribute. |
| `text-property-element.xaml` | Lowers `<TextBlock.Text>Hello</TextBlock.Text>` to the same shape as attribute syntax. |
| `border-child-property.xaml` | Lowers `Border.Child` object content to a direct child node. |
| `namespaced-ui.xaml` | Lowers known `ui:` types to legacy local type names. |
| `attached-members.xaml` | Lowers attached members to canonical `Owner.Member` attributes. |

