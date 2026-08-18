import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function readProjectFile(filePath: string) {
  return readFileSync(path.join(root, filePath), "utf8");
}

describe("folded materials visual system", () => {
  it("keeps the folded materials theme available globally", () => {
    const css = readProjectFile("src/app/globals.css");

    expect(css).toContain("--fold-vermilion: #c72413");
    expect(css).toContain("--fold-clay: #c99573");
    expect(css).toContain("--fold-ink: #1c1714");
    expect(css).toContain("--fold-paper: #fff8ef");
  });

  it("keeps an auditable Impeccable direction contract in the root layout", () => {
    const layout = readProjectFile("src/app/layout.tsx");

    expect(layout).toContain("IMPECCABLE-DIRECTION: Folded Materials Desk");
    expect(layout).toContain("折纸材料台");
  });
});
