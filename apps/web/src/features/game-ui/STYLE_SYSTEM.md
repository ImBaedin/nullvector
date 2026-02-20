# Neon Dockyard Style System

## Purpose
A dark-first, colony-centric UI system for game routes. This system separates reusable UI chrome from page content and enforces consistent composition.

## Layers
- Theme layer: tokens, typography, motion, focus behavior.
- Primitive layer: `Nv*` components only.
- Shell layer: layered nav + resource strip + content rails.

## Composition Rules
- Global shell always includes top nav, resource strip, and context tabs.
- Colony-local data is always visible in resource strip.
- Alerts should use severity tones and pulse only for danger.

## Media Slots
See `contracts/media-slots.ts` for stable image slot contracts and fallback behavior.

## Accessibility
- Use visible focus rings.
- Honor `prefers-reduced-motion` for decorative effects.
- Keep text contrast at high readability on dark surfaces.
