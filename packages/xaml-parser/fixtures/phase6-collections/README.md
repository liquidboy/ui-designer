# Phase 6 Collection and Dictionary Fixtures

These fixtures cover schema-backed collection behavior and dictionary key validation.

| Fixture | Expected result |
| --- | --- |
| `theme-dictionary-xkey.xaml` | `Colors` validates as a dictionary and accepts explicit `x:Key` plus implicit `Color.Id` keys. |
| `theme-dictionary-duplicate-key.xaml` | Reusing the same dictionary key produces `duplicate-dictionary-key`. |
| `theme-dictionary-missing-key.xaml` | Dictionary items without `x:Key` or an implicit key property produce `missing-dictionary-key`. |
| `theme-dictionary-invalid-item.xaml` | A known type that is not allowed by the dictionary produces `invalid-collection-item-type`. |
| `list-invalid-item.xaml` | A known type that is not allowed by a list collection produces `invalid-collection-item-type`. |
| `xkey-outside-dictionary.xaml` | `x:Key` outside a dictionary item produces `invalid-directive-placement`. |
