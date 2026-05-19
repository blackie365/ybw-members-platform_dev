---
name: "clerk-auth"
description: "Integrates Clerk Authentication into Next.js. Invoke when setting up auth, adding sign-in/up components, or configuring Clerk middleware/providers."
---

# Clerk Authentication Skill

This skill provides a structured workflow for integrating Clerk into a Next.js application.

## Workflow

### 1. Setup & Initialization
- Install CLI: `npm install -g clerk`
- Login: `clerk auth login`
- Initialize: `clerk init --framework next --pm npm`

### 2. Provider Integration
Wrap the `RootLayout` in `ClerkProvider`.
- `ClerkProvider` must be inside the `<body>` tag.
- Apply themes if using shadcn: `<ClerkProvider appearance={{ theme: shadcn }}>`

### 3. Middleware Configuration
Create `src/middleware.ts` with Clerk protection:
```typescript
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### 4. Auth Components
Use standard Clerk components for UI:
- `<SignIn />`, `<SignUp />` for dedicated pages.
- `<UserButton />` for profile management.
- `<SignInButton />`, `<SignUpButton />` for triggers.

### 5. Verification
- Run `clerk doctor` to check environment variables.
- Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are in `.env`.

## Critical Rules
- Always use `@clerk/nextjs`.
- `auth()` is async in Next.js 15+.
- Never expose `CLERK_SECRET_KEY` on the client side.
