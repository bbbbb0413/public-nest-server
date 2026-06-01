export abstract class ValueObject<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.validate(value);
    this.value = Object.freeze(value) as T;
  }

  protected abstract validate(value: T): void;

  equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }

  getValue(): T {
    return this.value;
  }
}
