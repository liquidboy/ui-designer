# Phase 4 Designer Config Fixtures

These fixtures cover the first non-runtime designer vocabularies that now validate through the main schema registry.

| Fixture | Expected result |
| --- | --- |
| `theme-valid.xaml` | Theme namespace validates and lowers to `DesignerTheme`/`Colors`/`Color`. |
| `chrome-valid.xaml` | Chrome namespace validates and lowers menu, dock, tool, and status items. |
| `panels-valid.xaml` | Panels namespace validates and lowers panel and inspector-group items. |
| `theme-unknown-member.xaml` | Unknown member on a theme type produces `unknown-member`. |
