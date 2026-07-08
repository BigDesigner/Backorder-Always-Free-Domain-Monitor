# Project Rules

## The Golden Rule of Modernization
- **Zero Behavior Regression**: When performing library upgrades (such as React 19, Tailwind CSS v4, TypeScript 6), the system's operational logic, APIs, and rendering behavior must remain completely unchanged.
- **Zero Style Deviation**: Upgrading UI libraries (like Tailwind v4) must preserve the existing look and feel, colors, fonts, responsive layouts, and UI transitions exactly.
- **Verification Gates**: Every upgrade step must be validated locally via TypeScript compiler checks, builds, lint runs, and local dev server visual inspection before deployment.
