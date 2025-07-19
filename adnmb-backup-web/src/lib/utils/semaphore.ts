export class Semaphore {
	private permits: number;
	private waiting: (() => void)[] = [];

	constructor(permits: number) {
		this.permits = permits;
	}

	async acquire(): Promise<void> {
		if (this.permits > 0) {
			this.permits--;
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			this.waiting.push(resolve);
		});
	}

	release(): void {
		this.permits++;
		if (this.waiting.length > 0) {
			const resolve = this.waiting.shift();
			this.permits--;
			resolve?.();
		}
	}
}
