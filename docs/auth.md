# Auth

This document describes the current auth architecture after removing the long-lived Go JWT bridge from the web session.

## Trust Boundaries

The project has two explicit client auth modes:

- Web: NextAuth owns the browser session. The web BFF mints a short-lived assertion for each Go API request.
- Android: the app signs in directly to Go and uses a revocable Go session JWT.

The Go API accepts both token types on protected endpoints, but they have different issuers, lifetimes, and purposes.

## Web Flow

### Sign-In

Email/password sign-in:

1. The browser submits credentials to the NextAuth Credentials provider.
2. NextAuth derives the existing auth hash.
3. NextAuth calls Go `POST /api/v1/auth/verify`.
4. Go verifies the hash and returns `{ userId, username }` without issuing a Go session JWT.
5. NextAuth stores only identity claims such as `email` and `sub`.

OAuth sign-in:

1. Google or GitHub authenticates the user through NextAuth.
2. NextAuth derives the deterministic OAuth identity hash.
3. NextAuth registers the Go user when needed.
4. NextAuth calls Go `/api/v1/auth/verify`.
5. NextAuth stores only identity claims.

The NextAuth JWT/session does not contain `goToken`, `goTokenExpiresAt`, or `goTokenError`.

### BFF Assertion

Before a BFF route calls Go, `getGoAssertion()` creates a new HS256 JWT with:

- issuer: `aether-web`
- audience: `aether-api`
- subject: normalized user email
- token use: `bff`
- lifetime: 60 seconds
- unique `jti`

The assertion is created server-side and sent directly to Go as a Bearer token. It is never returned to browser JavaScript or persisted in the NextAuth session.

Go verifies the issuer, audience, signature, and expiry, then resolves the subject to the Go user id.

## Android Flow

Android remains a direct Go API client:

1. Android calls Go `/api/v1/auth/login`.
2. Go returns `{ token, expiresAt }`.
3. Android stores the session JWT in encrypted preferences.
4. Protected calls send it as a Bearer token.

Go session JWTs include:

- `user_id`
- `auth_version`
- `iat`
- `exp`

`/api/v1/auth/refresh` renews a valid mobile session. `/api/v1/auth/logout` increments `auth_version`, invalidating older mobile JWTs.

## Secrets

- `NEXTAUTH_SECRET`: signs/encrypts the browser NextAuth session.
- `AETHER_BFF_JWT_SECRET`: preferred shared secret for web BFF assertions.
- `GO_JWT_SECRET`: signs Android Go session JWTs.
- `AUTH_JWT_SECRET`: transitional web fallback for BFF assertions and legacy Go fallback.

Production should configure distinct random values for `AETHER_BFF_JWT_SECRET`, `GO_JWT_SECRET`, and `NEXTAUTH_SECRET`.

For local compatibility, Go falls back from `AETHER_BFF_JWT_SECRET` to `GO_JWT_SECRET` or `AUTH_JWT_SECRET`, while web falls back from `AETHER_BFF_JWT_SECRET` to `AUTH_JWT_SECRET`.

## Endpoint Matrix

Web/NextAuth:

- `POST /api/auth/signup`: registers in Go, then signs in through NextAuth credentials.
- `POST /api/auth/login`: retired; returns `410 Gone`.
- `POST /api/auth/refresh`: retired; returns `410 Gone`.
- `POST /api/auth/logout`: clears legacy cookies; NextAuth `signOut()` ends the browser session.
- `/api/auth/[...nextauth]`: canonical browser auth handler.

Go:

- `POST /api/v1/auth/register`: stores username and auth hash.
- `POST /api/v1/auth/verify`: verifies identity for web sign-in without issuing a session JWT.
- `POST /api/v1/auth/login`: issues an Android Go session JWT.
- `POST /api/v1/auth/refresh`: refreshes an Android session JWT.
- `POST /api/v1/auth/logout`: revokes Android session JWTs through `auth_version`.

## Invariants

- The browser session authority is NextAuth only.
- No long-lived Go JWT is stored inside the NextAuth JWT/session.
- Web BFF assertions are minted per request and expire after 60 seconds.
- Browser JavaScript never receives a BFF assertion.
- Android Go JWTs remain revocable through `auth_version`.
- Legacy `aether_access`, `aether_refresh`, and `aether_go_token` cookies never authorize requests.
- Zustand state is UI bootstrap state, not an access-control authority.

## Relevant Files

- NextAuth config: `apps/web/lib/auth-options.ts`
- BFF assertion issuer: `apps/web/lib/bff-assertion.ts`
- BFF Go client: `apps/web/lib/go-backend.ts`
- Middleware: `apps/web/middleware.ts`
- Go auth handlers and token verification: `services/api/internal/handlers/auth.go`
- Go route registration: `services/api/cmd/api/main.go`
- Android auth repository: `apps/android/app/src/main/java/com/aetheros/api/AuthRepository.kt`
- Shared contract types: `packages/contracts/src/index.ts`
- OpenAPI snapshot: `packages/contracts/openapi/aether-api.yaml`
