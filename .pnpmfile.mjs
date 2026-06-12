// No-op pnpmfile.
//
// pnpm (v11+) attempts to import a `.pnpmfile.mjs` during initialization. When
// the file is absent in this environment, the import throws a fatal error and
// the dev server fails to start ("Cannot find module '.pnpmfile.mjs'").
// Providing this empty hooks export satisfies the import without changing any
// install/resolution behavior.
export const hooks = {};
