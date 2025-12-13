/**
 * Human-like timing utilities for browser automation.
 */

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
