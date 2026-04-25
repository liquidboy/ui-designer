# Phase 8 Resource Dictionary Fixtures

These fixtures cover the first runtime resource dictionary slice.

| Fixture | Expected result |
| --- | --- |
| `runtime-resource-dictionary.xaml` | Runtime lowering collects primitive resources and resolves top-level `{StaticResource ...}` references. |
| `scoped-resource-dictionary.xaml` | Child `Resources` dictionaries shadow parent resource keys for descendants. |
| `missing-static-resource.xaml` | Validation preserves the reference, and runtime lowering fails when the resource key is unresolved. |
| `resource-dictionary-missing-key.xaml` | Resource dictionary entries without `x:Key` produce `missing-dictionary-key`. |
| `resource-dictionary-duplicate-key.xaml` | Duplicate resource dictionary keys produce `duplicate-dictionary-key`. |
| `resource-dictionary-invalid-item.xaml` | Unsupported resource dictionary item types produce `invalid-collection-item-type`. |
