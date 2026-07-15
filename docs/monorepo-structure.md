# Monorepo Structure

```text
apps/
  web/          Next.js web app and BFF routes
  android/      Android app
services/
  api/          Go API and Temporal worker
packages/
  contracts/     Shared TypeScript API contract types and OpenAPI snapshot
  wasm-erasure/ Rust/WASM erasure-coding package
infra/
  minio/        Local MinIO infrastructure
tools/
  migrations/  Local migration utilities and scratch migration work
archive/
  client-old/   Legacy Vite client retained for reference
```

Root commands:

```sh
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm build
pnpm typecheck
pnpm test
pnpm check
pnpm lint
```

The Next.js app imports the generated WASM package through the workspace package `wasm-erasure`.

Architecture notes:

- [Auth](./auth.md)
