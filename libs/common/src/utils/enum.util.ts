export function enumToString<T>(enumClass: T, enumName: string): string {
  return `${enumName}: { ${Object.entries(enumClass)
    .filter((it) => typeof it[1] !== 'number')
    .map((it) => `${it[1]}: ${it[0]}`)} }`.replaceAll(',', ', ');
}

export function enumToValues<T>(enumClass: T): number[] {
  const arr = [];
  Object.entries(enumClass)
    .filter((it) => typeof it[1] !== 'number')
    .map((it) => {
      arr.push(Number(it[0]));
    });

  return arr;
}

export function enumToEnumString<T>(enumClass: T): string[] {
  const arr = [];
  Object.entries(enumClass)
    .filter((it) => typeof it[1] !== 'string')
    .map((it) => {
      arr.push(it[0]);
    });

  return arr;
}

export function constToString<T>(constObject: T, objectName?: string): string {
  if (objectName) {
    return `${objectName}: { ${Object.entries(constObject).map((it) => {
      if (typeof it[1] === 'object') {
        return `${it[0]}: ${constToString(it[1])}`;
      }
      return `${it[0]}: ${it[1]}`;
    })} }`.replaceAll(',', ', ');
  } else {
    return `{ ${Object.entries(constObject).map((it) => {
      if (typeof it[1] === 'object') {
        return `${it[0]}: ${constToString(it[1])}`;
      }
      return `${it[0]}: ${it[1]}`;
    })} }`.replaceAll(',', ', ');
  }
}
