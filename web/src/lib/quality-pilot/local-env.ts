export function applyEnvFileDefaults(source: string, target: Record<string, string | undefined>) {
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || target[key] !== undefined) continue;

    target[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
  }
}
