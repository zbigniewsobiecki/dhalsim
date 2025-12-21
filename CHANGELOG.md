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
