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

Array.prototype.isEmpty = function (): boolean {
  return this.length === 0;
};

Array.prototype.isNotEmpty = function (): boolean {
  return this.length !== 0;
};

Array.prototype.sum = function (): number {
  return this.reduce((acc: number, cur: number) => acc + cur, 0);
};

Array.prototype.hasDuplicates = function (): boolean {
  const uniqueSet = new Set(this);
  return this.length - uniqueSet.size > 0;
};

Array.prototype.distinct = function <T>(): T[] {
  return [...new Set(this)] as T[];
};

Array.prototype.hasCommonElements = function <T>(
  items: (T | ConcatArray<T>)[],
): boolean {
  const combinedSet = new Set([...this, ...items]);

  return combinedSet.size < this.length + items.length;
};

Array.prototype.generateSubsets = function (): number[][] {
  if (this.isEmpty()) {
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

    // check duplicate
    if (!result.some((it) => JSON.stringify(it) === JSON.stringify(subset))) {
      result.push(subset);
    }
  }

  return result;
};

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
Array.prototype.hasSameElements = function <T>(this: T[], a: T[]): boolean {
  if (!Array.isArray(a)) return false;
  if (this.length !== a.length) return false;

  const setA = new Set(this);
  const setB = new Set(a);

  if (setA.size !== setB.size) return false;

  return [...setA].every((v) => setB.has(v));
};

export {};
