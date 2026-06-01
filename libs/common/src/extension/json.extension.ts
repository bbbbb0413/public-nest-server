import { isArray } from 'class-validator';

declare global {
  interface JSON {
    /**
     * json to object 시 string date convert to Date object
     */
    parseDate(text: string): any;
    /**
     * json object string number property convert to number
     */
    stringifyNumber<T>(object: T): string;
  }
}

JSON.parseDate = function (text: string): unknown {
  return JSON.parse(text, (key, value) => {
    return key.includes('At') ? (value ? new Date(value) : null) : value;
  });
};

JSON.stringifyNumber = function <T>(object: T): string {
  return JSON.stringify(object, (key, value) => {
    if (
      value !== null &&
      !isNaN(value) &&
      value !== '' &&
      typeof value !== 'boolean' &&
      !isArray(value)
    ) {
      return Number(value);
    }

    return value;
  });
};

export {};
