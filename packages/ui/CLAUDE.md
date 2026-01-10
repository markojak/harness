# UI Package Guidelines

- Always use Radix UI components - never use plain HTML elements with custom styles
- Let Radix and capsize handle typography sizing - don't set fontSize or lineHeight manually
- Use Radix's style props (size, color, variant, etc.) instead of inline styles
- For code/monospace content, use the `Code` component
- Use TanStack DB's `useLiveQuery` for all data operations - no JS filtering/sorting/ordering. Use `.orderBy()`, `.where()`, `.select()` etc. in the query builder
