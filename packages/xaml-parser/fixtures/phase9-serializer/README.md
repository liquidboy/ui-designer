# Phase 9 Semantic Serializer Fixtures

These fixtures cover the first infoset-based semantic serializer slice.

| Fixture | Expected result |
| --- | --- |
| `namespaces-directives.xaml` | Namespace declarations and intrinsic directives survive parse -> serialize -> parse. |
| `markup-extensions.xaml` | Attribute and property-element markup extensions serialize as XAML expressions, while escaped literals remain literal. |
| `collections-resources.xaml` | Collection/property-element structures, `x:Key`, and resource dictionaries survive semantic round-trip. |
