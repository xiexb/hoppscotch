# md-editor-v3 Theming for Hoppscotch

How to make md-editor-v3 (used in `MarkdownDoc.vue`) visually consistent with Hoppscotch's light/dark/black themes.

## Core Technique

md-editor-v3 uses its own CSS custom properties internally. Override them with Hoppscotch's theme variables using `:deep()` scoped styles:

```vue
<style scoped>
:deep(.md-editor) {
  --md-bk-color: var(--primary-color) !important;
  --md-bk-color-outstand: var(--primary-dark-color) !important;
  --md-bk-hover-color: var(--primary-light-color) !important;
  --md-border-color: var(--divider-color) !important;
  --md-border-hover-color: var(--divider-dark-color) !important;
  --md-color: var(--secondary-color) !important;
  --md-hover-color: var(--secondary-dark-color) !important;
  border: none !important;
}

:deep(.md-editor-dark) {
  /* Same overrides — dark theme uses same Hoppscotch variables */
  --md-bk-color: var(--primary-color) !important;
  /* ... same as above ... */
}
</style>
```

## Key CSS Variable Mapping

| md-editor-v3 variable | Hoppscotch variable | Purpose |
|---|---|---|
| `--md-bk-color` | `--primary-color` | Main background (editor, dropdowns, modals) |
| `--md-bk-color-outstand` | `--primary-dark-color` | Hover/active toolbar items |
| `--md-bk-hover-color` | `--primary-light-color` | Menu item hover |
| `--md-color` | `--secondary-color` | Default text color |
| `--md-hover-color` | `--secondary-dark-color` | Text on hover |
| `--md-border-color` | `--divider-color` | Borders |
| `--md-border-hover-color` | `--divider-dark-color` | Border on hover/focus |

## Component-Specific Overrides

Beyond CSS variables, some components need direct `background-color` overrides:

- **Toolbar**: `.md-editor-toolbar-wrapper` → `background-color: var(--primary-color)`
- **Dropdowns**: `.md-editor-dropdown` → `background-color`, `border`, `box-shadow`
- **Menus**: `.md-editor-menu`, `.md-editor-menu-item:hover`
- **Modals**: `.md-editor-modal`, `.md-editor-modal-header`
- **Inputs**: `.md-editor-input` → focus state uses `--accent-color`
- **Buttons**: `.md-editor-btn`, `.md-editor-btn:hover`
- **Table picker**: `.md-editor-table-shape`
- **Footer/Catalog**: `.md-editor-footer`, `.md-editor-catalog-editor`

## Common Pitfall

Do NOT set `--md-bk-color: transparent` — this makes dropdown menus, modals, and table pickers transparent, rendering them unusable. Always use a solid theme color.

## Theme Prop

Pass `:theme="isDark ? 'dark' : 'light'"` to `<MdEditor>` and `<MdPreview>`. The `isDark` computed should check `BG_COLOR` setting for "dark"/"black"/"system".
