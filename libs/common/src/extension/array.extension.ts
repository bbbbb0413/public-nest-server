declare global {
  interface Array<T> {
    isEmpty(): boolean;

    isNotEmpty(): boolean;

    sum(): number;

    hasDuplicates(): boolean;

    distinct(): T[];

    hasCommonElements(items: (T | ConcatArray<T>)[]): boolean;

    generateSubsets(): T[][];

    hasSameElements(this: T[], a: T[]): boolean;
  }
}

// Use Object.defineProperty so extensions are non-enumerable.
// pdfjs-dist v4 throws UnknownErrorException if Array.prototype has any
// enumerable properties (it validates this at load time).
function defineArrayMethod(
  name: string,
  fn: (...args: unknown[]) => unknown,
): void {
  Object.defineProperty(Array.prototype, name, {
    value: fn,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

defineArrayMethod('isEmpty', function (this: unknown[]): boolean {
  return this.length === 0;
});

defineArrayMethod('isNotEmpty', function (this: unknown[]): boolean {
  return this.length !== 0;
});

defineArrayMethod('sum', function (this: number[]): number {
  return this.reduce((acc: number, cur: number) => acc + cur, 0);
});

defineArrayMethod('hasDuplicates', function (this: unknown[]): boolean {
  const uniqueSet = new Set(this);
  return this.length - uniqueSet.size > 0;
});

defineArrayMethod('distinct', function <T>(this: T[]): T[] {
  return [...new Set(this)] as T[];
});

defineArrayMethod('hasCommonElements', function <
  T,
>(this: T[], items: (T | ConcatArray<T>)[]): boolean {
  const combinedSet = new Set([...this, ...(items as T[])]);
  return combinedSet.size < this.length + items.length;
});

defineArrayMethod('generateSubsets', function (this: number[]): number[][] {
  if (this.length === 0) {
    return [];
  }

  const result: number[][] = [];
  const n = this.length;

  for (let i = 0; i < Math.pow(2, n); i++) {
    const subset = new Array(n).fill(0);

    for (let j = 0; j < n; j++) {
      if ((i >> j) & 1) {
        subset[j] = this[j];
      }
    }

    if (!result.some((it) => JSON.stringify(it) === JSON.stringify(subset))) {
      result.push(subset);
    }
  }

  return result;
});

/**
 * Checks whether the current array and the given array contain the same elements,
 * ignoring the order and duplicates.
 *
 * This performs a set-like comparison:
 * - Order does not matter
 * - Duplicates are ignored
 *
 * @template T - The type of elements in the arrays
 * @param {T[]} a - The array to compare with
 * @returns {boolean} `true` if both arrays contain the same unique elements, otherwise `false`
 *
 * @example
 * [1, 2, 3].hasSameElements([3, 2, 1]); // true
 * [1, 1, 2].hasSameElements([1, 2, 2]); // true
 * [1, 2].hasSameElements([1, 2, 3]);   // false
 */
defineArrayMethod('hasSameElements', function <T>(this: T[], a: T[]): boolean {
  if (!Array.isArray(a)) return false;
  if (this.length !== a.length) return false;

  const setA = new Set(this);
  const setB = new Set(a);

  if (setA.size !== setB.size) return false;

  return [...setA].every((v) => setB.has(v));
});

export {};
