/**
 * Stealth mode utilities for evading bot detection.
 *
 * These techniques help avoid triggering CAPTCHAs and bot detection systems
 * by making the browser appear more like a regular user's browser.
 */

/**
 * Chrome launch arguments that help evade detection.
 */
export const STEALTH_ARGS = [
	// Disable automation-controlled feature that sets navigator.webdriver
	"--disable-blink-features=AutomationControlled",
	// Disable infobars like "Chrome is being controlled by automated software"
	"--disable-infobars",
	// Use a real-looking window size
	"--window-size=1920,1080",
	// Disable automation extension
	"--disable-extensions",
	// Disable dev shm usage (helps in Docker/CI)
	"--disable-dev-shm-usage",
];

/**
 * Realistic viewport dimensions (Full HD, most common desktop resolution).
 */
export const STEALTH_VIEWPORT = {
	width: 1920,
	height: 1080,
};

/**
 * Get a realistic Chrome user agent string.
 * Uses a recent stable Chrome version on the current platform.
 */
export function getRealisticUserAgent(): string {
	const chromeVersion = "131.0.0.0";
	const platform = process.platform;

	if (platform === "darwin") {
		return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
	} else if (platform === "win32") {
		return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
	} else {
		return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
	}
}

/**
 * JavaScript to inject into every page to patch detection vectors.
 * This runs before any page scripts execute.
 */
export const STEALTH_INIT_SCRIPT = `
(() => {
	// 1. Hide webdriver property
	Object.defineProperty(navigator, 'webdriver', {
		get: () => undefined,
		configurable: true,
	});

	// 2. Mock chrome runtime (Playwright doesn't have this by default)
	if (!window.chrome) {
		window.chrome = {};
	}
	if (!window.chrome.runtime) {
		window.chrome.runtime = {
			connect: () => {},
			sendMessage: () => {},
			onMessage: { addListener: () => {}, removeListener: () => {} },
		};
	}

	// 3. Fix permissions API to not reveal automation
	const originalQuery = navigator.permissions?.query?.bind(navigator.permissions);
	if (originalQuery) {
		navigator.permissions.query = (parameters) => {
			if (parameters.name === 'notifications') {
				return Promise.resolve({ state: 'prompt', onchange: null });
			}
			return originalQuery(parameters);
		};
	}

	// 4. Mock plugins array (empty array is suspicious)
	Object.defineProperty(navigator, 'plugins', {
		get: () => {
			const plugins = [
				{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
				{ name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
				{ name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
			];
			plugins.item = (i) => plugins[i] || null;
			plugins.namedItem = (name) => plugins.find(p => p.name === name) || null;
			plugins.refresh = () => {};
			return plugins;
		},
		configurable: true,
	});

	// 5. Mock mimeTypes (empty is suspicious)
	Object.defineProperty(navigator, 'mimeTypes', {
		get: () => {
			const mimeTypes = [
				{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
			];
			mimeTypes.item = (i) => mimeTypes[i] || null;
			mimeTypes.namedItem = (name) => mimeTypes.find(m => m.type === name) || null;
			return mimeTypes;
		},
		configurable: true,
	});

	// 6. Fix languages (should match Accept-Language header)
	Object.defineProperty(navigator, 'languages', {
		get: () => ['en-US', 'en'],
		configurable: true,
	});

	// 7. Ensure hardwareConcurrency returns a realistic value
	if (navigator.hardwareConcurrency === 0 || navigator.hardwareConcurrency > 32) {
		Object.defineProperty(navigator, 'hardwareConcurrency', {
			get: () => 8,
			configurable: true,
		});
	}

	// 8. Ensure deviceMemory returns a realistic value
	if (!navigator.deviceMemory || navigator.deviceMemory < 1) {
		Object.defineProperty(navigator, 'deviceMemory', {
			get: () => 8,
			configurable: true,
		});
	}

	// 9. Fix WebGL vendor/renderer to not reveal headless
	const getParameterProto = WebGLRenderingContext.prototype.getParameter;
	WebGLRenderingContext.prototype.getParameter = function(parameter) {
		// UNMASKED_VENDOR_WEBGL
		if (parameter === 37445) {
			return 'Intel Inc.';
		}
		// UNMASKED_RENDERER_WEBGL
		if (parameter === 37446) {
			return 'Intel Iris OpenGL Engine';
		}
		return getParameterProto.call(this, parameter);
	};

	// Same for WebGL2
	if (typeof WebGL2RenderingContext !== 'undefined') {
		const getParameter2Proto = WebGL2RenderingContext.prototype.getParameter;
		WebGL2RenderingContext.prototype.getParameter = function(parameter) {
			if (parameter === 37445) {
				return 'Intel Inc.';
			}
			if (parameter === 37446) {
				return 'Intel Iris OpenGL Engine';
			}
			return getParameter2Proto.call(this, parameter);
		};
	}

	// 10. Prevent detection via toString checks
	const originalToString = Function.prototype.toString;
	Function.prototype.toString = function() {
		if (this === navigator.permissions.query) {
			return 'function query() { [native code] }';
		}
		return originalToString.call(this);
	};
})();
`;

/**
 * Generate a random delay within a range (for human-like timing).
 * @param min Minimum delay in milliseconds
 * @param max Maximum delay in milliseconds
 */
export function randomDelay(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a random duration (for human-like timing).
 * @param min Minimum delay in milliseconds
 * @param max Maximum delay in milliseconds
 */
export async function humanDelay(min = 50, max = 150): Promise<void> {
	const delay = randomDelay(min, max);
	return new Promise((resolve) => setTimeout(resolve, delay));
}
