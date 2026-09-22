// transformIgnorePatterns intentionally omitted (falls back to jest-expo's
// preset default): pnpm's content-addressable store resolves RN/Expo
// packages through `node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg>/...`
// real paths, which a `node_modules/(?!pkg)` style pattern cannot match
// reliably. Transforming everything keeps CJS/Flow-annotated RN internals
// working under pnpm at the cost of a slightly slower first run.
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [],
};
