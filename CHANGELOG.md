## [2.1.9](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.8...v2.1.9) (2026-01-01)

### Bug Fixes

* **ci:** use --branch main to override semantic-release branch detection ([44daa32](https://github.com/zbigniewsobiecki/dhalsim/commit/44daa3264cc890da28d3205b010b6c3f616a561d))

## [2.1.8](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.7...v2.1.8) (2026-01-01)

### Bug Fixes

* **ci:** add explicit branch check to release workflow ([add8362](https://github.com/zbigniewsobiecki/dhalsim/commit/add83629b34ec6287bc4e5c1874af92195f60821))

## [2.1.7](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.6...v2.1.7) (2026-01-01)

### Bug Fixes

* **ci:** explicitly checkout main branch in release workflow ([22d4bd7](https://github.com/zbigniewsobiecki/dhalsim/commit/22d4bd7ba191e853808ed7de7d8d3e6768e1f20f))

## [2.1.6](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.5...v2.1.6) (2026-01-01)

## [2.1.5](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.4...v2.1.5) (2026-01-01)

## [2.1.4](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.3...v2.1.4) (2026-01-01)

## [2.1.3](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.2...v2.1.3) (2026-01-01)

### Bug Fixes

* **deps:** update camoufox-js to use better-sqlite3 ^12.0.0 ([a03ac45](https://github.com/zbigniewsobiecki/dhalsim/commit/a03ac45be83871bb7c0cd4792222730abb2c9d3c))

## [2.1.2](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.1...v2.1.2) (2026-01-01)

### Bug Fixes

* **deps:** pin camoufox-js to specific commit instead of master ([64c91dd](https://github.com/zbigniewsobiecki/dhalsim/commit/64c91dddf603a044ef9a1e27fc497a527674e2b2))

## [2.1.1](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.1.0...v2.1.1) (2026-01-01)

### Bug Fixes

* **deps:** update camoufox-js to master with better-sqlite3 fix ([dd797d9](https://github.com/zbigniewsobiecki/dhalsim/commit/dd797d9bb64bcedf756a314a474c483ef9921148))

## [2.1.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v2.0.0...v2.1.0) (2025-12-31)

### Features

* lazy install camoufox browser on first use ([75cae30](https://github.com/zbigniewsobiecki/dhalsim/commit/75cae30e0b8d2e229cb8c83b55f11e5213e56e52))

## [2.0.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.7.0...v2.0.0) (2025-12-30)

### ⚠ BREAKING CHANGES

* Now requires Node.js and npm instead of Bun.

- Replace bun build with tsup for dual ESM + CJS output
- Update CI/release workflows to use Node.js 22 and npm
- Update package.json exports for dual format support
- Update llmist dependencies to ^12.0.0
- Update README examples from bunx to npx
- Remove bun-types and bunfig.toml

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

* migrate from bun-first to node-first ([898f5b0](https://github.com/zbigniewsobiecki/dhalsim/commit/898f5b0c2ef1d1443fec29372e8584ed790ef488))

### Bug Fixes

* **ci:** add --legacy-peer-deps for npm install ([6a13be1](https://github.com/zbigniewsobiecki/dhalsim/commit/6a13be17fa32876e96b699f5c507c8a4a91610eb))

## [1.7.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.6.1...v1.7.0) (2025-12-29)

### Features

* make RequestUserAssistance optional with custom callback support ([89c9b69](https://github.com/zbigniewsobiecki/dhalsim/commit/89c9b69ff08ec799d47ca2ae0a31ec448439262b))

## [1.6.1](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.6.0...v1.6.1) (2025-12-29)

### Bug Fixes

* **deps:** bump llmist to ^11.1.0 ([fcd1fe4](https://github.com/zbigniewsobiecki/dhalsim/commit/fcd1fe4b745bae34e8929675723c2cca5a1986ce))

## [1.6.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.5.0...v1.6.0) (2025-12-23)

### Features

* add navigationTimeoutMs and use domcontentloaded for faster loads ([a530d8c](https://github.com/zbigniewsobiecki/dhalsim/commit/a530d8cf3106c49b37e11b39eac129d104f3b2a2))

## [1.5.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.4.0...v1.5.0) (2025-12-23)

### Features

* add disableCache option to reduce browser memory usage ([#22](https://github.com/zbigniewsobiecki/dhalsim/issues/22)) ([f469bf9](https://github.com/zbigniewsobiecki/dhalsim/commit/f469bf9fce2eaf143593d60d38eaaf7541295b8b))

## [1.4.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.3.5...v1.4.0) (2025-12-23)

### Features

* add configurable timeoutMs for BrowseWeb subagent ([#18](https://github.com/zbigniewsobiecki/dhalsim/issues/18)) ([1f0a8c3](https://github.com/zbigniewsobiecki/dhalsim/commit/1f0a8c3dbcfa00d1172374268d9ed66a52648c0e)), closes [#265](https://github.com/zbigniewsobiecki/dhalsim/issues/265)

## [1.3.5](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.3.4...v1.3.5) (2025-12-22)

### Bug Fixes

* **deps:** update camoufox-js to ignore unzip unicode warnings ([#16](https://github.com/zbigniewsobiecki/dhalsim/issues/16)) ([17cbe13](https://github.com/zbigniewsobiecki/dhalsim/commit/17cbe136b27f35da0eab017b0a57d89438e96ef5))

## [1.3.4](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.3.3...v1.3.4) (2025-12-22)

### Bug Fixes

* **deps:** update camoufox-js with memory-efficient extraction ([#14](https://github.com/zbigniewsobiecki/dhalsim/issues/14)) ([c6acd5f](https://github.com/zbigniewsobiecki/dhalsim/commit/c6acd5f38ad4ede99d4452e1b592047fc708a1e0))

## [1.3.3](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.3.2...v1.3.3) (2025-12-22)

### Bug Fixes

* **deps:** remove sharp and better-sqlite3 native dependencies ([#12](https://github.com/zbigniewsobiecki/dhalsim/issues/12)) ([98c546c](https://github.com/zbigniewsobiecki/dhalsim/commit/98c546c2272ffe2f446fa1a642d8bf35ad347540))

## [1.3.2](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.3.1...v1.3.2) (2025-12-22)

### Bug Fixes

* **deps:** add playwright-core as direct dependency ([8c24419](https://github.com/zbigniewsobiecki/dhalsim/commit/8c24419d417b5bd358ed55a2c1dfbc423c576396))

## [1.3.1](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.3.0...v1.3.1) (2025-12-22)

### Bug Fixes

* **ci:** sync dev via PR instead of direct push ([#8](https://github.com/zbigniewsobiecki/dhalsim/issues/8)) ([feda646](https://github.com/zbigniewsobiecki/dhalsim/commit/feda646b2a875491d7e84f1d5e874fce54f4fc4b))
* use npx for camoufox-js postinstall ([#9](https://github.com/zbigniewsobiecki/dhalsim/issues/9)) ([79f3d68](https://github.com/zbigniewsobiecki/dhalsim/commit/79f3d68ea148449afa25eafbf34ac95f7c30d918))

## [1.3.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.2.0...v1.3.0) (2025-12-21)

### Features

* add GitHub ruleset templates for branch protection ([#6](https://github.com/zbigniewsobiecki/dhalsim/issues/6)) ([953dcbc](https://github.com/zbigniewsobiecki/dhalsim/commit/953dcbc3e76bb55ff2e9f83b93b93ff3b72f9469))
* export VERSION constant ([#7](https://github.com/zbigniewsobiecki/dhalsim/issues/7)) ([15167f7](https://github.com/zbigniewsobiecki/dhalsim/commit/15167f73c492f71964b56a85b3d4c3b0acc5d340))

### Bug Fixes

* **ci:** fail release workflow on dev branch sync failure ([#5](https://github.com/zbigniewsobiecki/dhalsim/issues/5)) ([da2c194](https://github.com/zbigniewsobiecki/dhalsim/commit/da2c1940a95b3b4481f5729e1f326701b63a7d27))

## [1.2.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.1.0...v1.2.0) (2025-12-21)

### Features

* **subagent:** add human input capability for 2FA/CAPTCHA handling ([8c9a14b](https://github.com/zbigniewsobiecki/dhalsim/commit/8c9a14be96924138d2ea51d03a78ef32579409ae))

## [1.1.0](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.0.2...v1.1.0) (2025-12-21)

### Features

* add postinstall script to fetch Camoufox browser ([#3](https://github.com/zbigniewsobiecki/dhalsim/issues/3)) ([8a3a8ba](https://github.com/zbigniewsobiecki/dhalsim/commit/8a3a8ba854e864a955027bbc4eb0b0bd1b7b1beb))

## [1.0.2](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.0.1...v1.0.2) (2025-12-21)

### Bug Fixes

* **ci:** skip lefthook install in CI environments ([503a0a6](https://github.com/zbigniewsobiecki/dhalsim/commit/503a0a659fffb453462e1fcc32726501a2d8b157))

## [1.0.1](https://github.com/zbigniewsobiecki/dhalsim/compare/v1.0.0...v1.0.1) (2025-12-21)

### Bug Fixes

* **ci:** disable lefthook during npm publish in Release workflow ([0703850](https://github.com/zbigniewsobiecki/dhalsim/commit/0703850645ed58a7ffb86643db89f39f057bda20))

## 1.0.0 (2025-12-21)

### Features

* add Camoufox anti-detect browser integration ([7b90ea9](https://github.com/zbigniewsobiecki/dhalsim/commit/7b90ea90aaeb1f20b368716f076d2e2f92bd39e2))
* add CHECKBOXES capture to PageStateScanner ([b404cab](https://github.com/zbigniewsobiecki/dhalsim/commit/b404cab58b1493fd12471f5440914c5520f4ad25))
* add debug logging to gadgets and session manager ([9651e02](https://github.com/zbigniewsobiecki/dhalsim/commit/9651e0267de73bff9f46876fe002c3a3a7637624))
* add debug logging to gadgets and session manager ([b612199](https://github.com/zbigniewsobiecki/dhalsim/commit/b612199aac21c182b66863e781e01f99e79a36de))
* add DOM selector visibility for ExecuteScript ([f5b6ab1](https://github.com/zbigniewsobiecki/dhalsim/commit/f5b6ab156da1bfcfa723c39687fb88172c03a38b))
* add iteration tracking and parallel thinking prompt to BrowseWeb ([86167e3](https://github.com/zbigniewsobiecki/dhalsim/commit/86167e342c5b0ae3b434d11c51c4760ccccffcda))
* add session manager injection and improve error logging ([2f6d61f](https://github.com/zbigniewsobiecki/dhalsim/commit/2f6d61f0ae257fc972470abb6947d83e7d99238f))
* auto-fetch page content on BrowseWeb startup ([e344fcf](https://github.com/zbigniewsobiecki/dhalsim/commit/e344fcf39c31bb10c402ba9cc0680bb0d520fe12))
* capture console.log output in ExecuteScript for LLM debugging ([ba2c7a0](https://github.com/zbigniewsobiecki/dhalsim/commit/ba2c7a0ca3620f595e93a7a90b696ad77e04fa6a))
* change headless to be default, add --headed flag ([9ba2a4c](https://github.com/zbigniewsobiecki/dhalsim/commit/9ba2a4cd82b36f4c1cba39a9aae9c143aca93d1d))
* **cost:** use ModelRegistry for accurate LLM cost estimation ([bc3c165](https://github.com/zbigniewsobiecki/dhalsim/commit/bc3c16550026065c78d5faa90fac5c601918405d))
* implement browser automation gadgets with stealth mode ([597e685](https://github.com/zbigniewsobiecki/dhalsim/commit/597e685cea2f5b2c324d4423f0877d0515b3cc13))
* prepare for public release with Node.js/Bun compatibility ([931f149](https://github.com/zbigniewsobiecki/dhalsim/commit/931f149d639dbeb8f7f812b86d4d5dea9930588d))
* rich CLI output for gadget results ([837a459](https://github.com/zbigniewsobiecki/dhalsim/commit/837a459b8ec983c367a30587168b18073cf1408c))
* **state:** add [hidden] marker to non-visible elements in STRUCTURE ([015ccd4](https://github.com/zbigniewsobiecki/dhalsim/commit/015ccd42b2f9e6eaa9cab0049aab46afd7ad0c17))
* use getHostExports for proper llmist tree sharing ([#2](https://github.com/zbigniewsobiecki/dhalsim/issues/2)) ([44a78d0](https://github.com/zbigniewsobiecki/dhalsim/commit/44a78d01ba5315efd17331d0e9c4f25c1e2e57bd))
* use synthetic gadget calls for auto-executed actions ([0f1f3cf](https://github.com/zbigniewsobiecki/dhalsim/commit/0f1f3cf77e5923c45ab1439220bfed79241dfef8))

### Bug Fixes

* add ReportResult gadget to capture BrowseWeb findings ([e9db12d](https://github.com/zbigniewsobiecki/dhalsim/commit/e9db12de31811161851f4060a823449180880f58))
* build both CLI and library entry points ([3cb6a0b](https://github.com/zbigniewsobiecki/dhalsim/commit/3cb6a0b014bf6d8bedc717d81f7e68641af43af5))
* **ci:** add CI environment to Release workflow for secrets access ([64e3045](https://github.com/zbigniewsobiecki/dhalsim/commit/64e3045d4e96ca6be31c249b770ed7c3e2e6f1d4))
* **ci:** install Playwright browsers before running tests ([6e43ab4](https://github.com/zbigniewsobiecki/dhalsim/commit/6e43ab4e559079a3aeb676b72c6b5ecd4669cdd8))
* closing browsers correctly ([601122e](https://github.com/zbigniewsobiecki/dhalsim/commit/601122e4e49d0369162b445eb9d4d8887281343f))
* detect when GoBack/GoForward fail and report clearly ([8589dfc](https://github.com/zbigniewsobiecki/dhalsim/commit/8589dfc033497af5c02ede330b3272bbaa774cbf))
* lazy-load camoufox-js for Node.js compatibility ([8b86923](https://github.com/zbigniewsobiecki/dhalsim/commit/8b86923c4b8cbc791c84e175ef1c767993dc6d8c))
* limit links in PageStateScanner to prevent context flooding ([dd30348](https://github.com/zbigniewsobiecki/dhalsim/commit/dd30348144ad548a46df0f196bc939e1015bd4d4))
* pin camoufox-js to commit with sqlite-compat fix ([4ea6ff8](https://github.com/zbigniewsobiecki/dhalsim/commit/4ea6ff87bb9a5b35a822872769be3a7b221d837f))
* prevent LLM from constructing selectors ([d4460cc](https://github.com/zbigniewsobiecki/dhalsim/commit/d4460cc30c815ecddb3505015ed00178a8f021e4))
* race condition and sequential bottleneck in PageStateScanner ([a8c853b](https://github.com/zbigniewsobiecki/dhalsim/commit/a8c853b3fd2b2b10d3da9b054d4bf0c059db6033))
* remove raw gadget class exports to prevent broken instantiation ([1ed9cfa](https://github.com/zbigniewsobiecki/dhalsim/commit/1ed9cfa3dca8168c7d340d152b72511077bc6c02))
* remove SYSTEM_PROMPT rules that teach bad selector patterns ([dc9b2ca](https://github.com/zbigniewsobiecki/dhalsim/commit/dc9b2cabfc7a3efa9a3a5f4dd2e409fc2ed387eb))
* **state:** extend menuitem detection for custom dropdowns ([60125c5](https://github.com/zbigniewsobiecki/dhalsim/commit/60125c57bd68de577a874a29f9b813830b72cbb1))
* use camoufox-js fork with impit fallback ([97a93bb](https://github.com/zbigniewsobiecki/dhalsim/commit/97a93bb859972ebf94880cd51f8ee2764858eb36))
* use host logger and add browser launch timeout/retry ([9fe40c9](https://github.com/zbigniewsobiecki/dhalsim/commit/9fe40c950eaaf958423fe194957154c1c9c93ec4))

### Performance Improvements

* auto-dismiss overlays to save first LLM call ([a24f274](https://github.com/zbigniewsobiecki/dhalsim/commit/a24f2748838fad22f1a9496eaf13620ae0665bac))
