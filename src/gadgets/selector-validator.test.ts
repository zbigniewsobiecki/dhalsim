import { describe, it, expect } from "vitest";
import {
	validateSelector,
	validateSelectors,
	selectorSchema,
	optionalSelectorSchema,
	selectorsArraySchema,
} from "./selector-validator";

describe("selector-validator", () => {
	describe("validateSelector", () => {
		describe("allows valid selectors", () => {
			const validSelectors = [
				"#login-btn",
				".core_b1q5ean9",
				"[name='email']",
				"button[type=submit]",
				"a[href='https://example.com']",
				".tiles_o1859gd9",
				"[aria-label='Submit']",
				"input[placeholder='Enter username']",
				// Exact attribute match is fine
				"[data-test=offer-title]",
				// Descendant selectors that appear as-is in CurrentBrowserState
				".modal .close-btn",
				"form button",
			];

			for (const selector of validSelectors) {
				it(`allows: ${selector}`, () => {
					const result = validateSelector(selector);
					expect(result.valid).toBe(true);
					expect(result.reason).toBeUndefined();
				});
			}
		});

		describe("rejects positional pseudo-selectors", () => {
			const forbiddenSelectors = [
				":nth-child(1)",
				".item:nth-child(2)",
				"li:nth-child(odd)",
				":nth-of-type(3)",
				"div:nth-of-type(even)",
				":first-child",
				".list > :first-child",
				":last-child",
				"ul > li:last-child",
				":first-of-type",
				"p:first-of-type",
				":last-of-type",
				"span:last-of-type",
			];

			for (const selector of forbiddenSelectors) {
				it(`rejects: ${selector}`, () => {
					const result = validateSelector(selector);
					expect(result.valid).toBe(false);
					expect(result.reason).toContain("appears to be constructed");
					expect(result.reason).toContain("CurrentBrowserState");
				});
			}
		});

		describe("rejects wildcard attribute selectors", () => {
			const forbiddenSelectors = [
				"[href*=pid]",
				"[class*=button]",
				"a[href*='example']",
				"[data-id*=123]",
				"[href^=https]",
				"[class^=prefix]",
				"a[href^='/api']",
				"[href$=.pdf]",
				"[src$=.jpg]",
				"img[src$='.png']",
			];

			for (const selector of forbiddenSelectors) {
				it(`rejects: ${selector}`, () => {
					const result = validateSelector(selector);
					expect(result.valid).toBe(false);
					expect(result.reason).toContain("appears to be constructed");
					expect(result.reason).toContain("CurrentBrowserState");
				});
			}
		});

		describe("real-world examples from session analysis", () => {
			it("rejects the exact selector pattern that violated rules", () => {
				const constructed =
					".tiles_cnb3rfy:nth-child(1) .tiles_o1859gd9";
				const result = validateSelector(constructed);
				expect(result.valid).toBe(false);
				expect(result.reason).toContain(":nth-child");
			});

			it("rejects wildcard href selector from session", () => {
				const constructed = '.tiles_cnb3rfy:nth-child(1) a[href*="pid="]';
				const result = validateSelector(constructed);
				expect(result.valid).toBe(false);
				// Should catch at least one of the forbidden patterns
				expect(result.reason).toContain("appears to be constructed");
			});

			it("allows the proper selector that should have been used", () => {
				// These are actual selectors from CurrentBrowserState
				const proper = ".tiles_o1859gd9";
				expect(validateSelector(proper).valid).toBe(true);

				const properLink =
					"a[href='https://pracodawcy.pracuj.pl/company/20055623?pid=1004533508']";
				expect(validateSelector(properLink).valid).toBe(true);
			});
		});
	});

	describe("validateSelectors", () => {
		it("returns valid for empty array", () => {
			expect(validateSelectors([]).valid).toBe(true);
		});

		it("returns valid when all selectors pass", () => {
			const result = validateSelectors([
				"#btn",
				".class",
				"[name='test']",
			]);
			expect(result.valid).toBe(true);
		});

		it("returns invalid on first bad selector", () => {
			const result = validateSelectors([
				"#btn",
				".item:nth-child(1)",
				".other",
			]);
			expect(result.valid).toBe(false);
			expect(result.reason).toContain(":nth-child");
		});
	});

	describe("zod schemas (non-blocking)", () => {
		describe("selectorSchema", () => {
			it("accepts any string selector", () => {
				expect(selectorSchema.safeParse("#btn").success).toBe(true);
				expect(selectorSchema.safeParse(".class").success).toBe(true);
				// Now allows constructed selectors (validation is separate)
				expect(selectorSchema.safeParse(":nth-child(1)").success).toBe(true);
				expect(selectorSchema.safeParse("[href*=test]").success).toBe(true);
			});
		});

		describe("optionalSelectorSchema", () => {
			it("accepts undefined", () => {
				expect(optionalSelectorSchema.safeParse(undefined).success).toBe(true);
			});

			it("accepts any string selector", () => {
				expect(optionalSelectorSchema.safeParse("#btn").success).toBe(true);
				// Now allows constructed selectors
				expect(optionalSelectorSchema.safeParse(":first-child").success).toBe(true);
			});
		});

		describe("selectorsArraySchema", () => {
			it("accepts undefined", () => {
				expect(selectorsArraySchema.safeParse(undefined).success).toBe(true);
			});

			it("accepts any array of string selectors", () => {
				expect(selectorsArraySchema.safeParse(["#a", ".b"]).success).toBe(true);
				// Now allows constructed selectors
				expect(selectorsArraySchema.safeParse(["#good", "[href*=test]"]).success).toBe(true);
			});
		});
	});
});
