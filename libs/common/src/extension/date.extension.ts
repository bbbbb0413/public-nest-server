declare global {
  interface Date {
    toTimestamp(): number;
  }
}

Date.prototype.toTimestamp = function (): number {
  return this.getTime();
};

export {};
