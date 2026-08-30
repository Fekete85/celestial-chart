// The library's central object.
//
// It lives in its own module rather than in celestial.js because nearly every
// module refers to it — several of them already at load time (for example
// `Celestial.settings = ...`). The module graph is circular
// (celestial <-> config <-> form <-> svg), and in a cycle what matters is which
// module is evaluated first. This file imports nothing, so it always runs
// first, and by the time anyone touches the object it already exists.
export var Celestial = {
  // Must match the package version — guarded by test/package.test.mjs.
  version: '0.8.1',
  container: null,
  data: []
};
