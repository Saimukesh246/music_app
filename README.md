# AURA

Your Music. Your Sound.

Phase 1: monorepo scaffold + mobile UI shell on mock data. See
`docs/superpowers/specs/2026-09-22-aura-phase1-design.md` for scope.

## Layout

- `apps/mobile` — Expo/React Native app
- `apps/api` — reserved for the Phase 4 FastAPI backend
- `packages/types` — shared TypeScript types
- `packages/shared` — `MusicProvider` interface + `MockProvider`

## Development

```bash
pnpm install
pnpm mobile
```
