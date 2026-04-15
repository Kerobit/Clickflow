export function quoteIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return name;
}

export function formatQualifiedName(fullName: string): string {
  const parts = fullName.split(".").map((part) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
      throw new Error(`Invalid name segment: ${part}`);
    }
    return part;
  });
  return parts.join(".");
}

export function formatIdentifierList(names: readonly string[]): string {
  return names.map(quoteIdentifier).join(", ");
}
