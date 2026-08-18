import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "../../src/lib/llm/mock";
import { breakdownFreeText, breakdownResumeFile } from "../../src/lib/import/import-service";
import { db } from "../../src/lib/db";
import type { LLMProvider } from "../../src/lib/llm/types";

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createLocalHeader(filename: string, content: Buffer) {
  const name = Buffer.from(filename);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(0, 10);
  header.writeUInt32LE(crc32(content), 14);
  header.writeUInt32LE(content.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name, content]);
}

function createCentralHeader(filename: string, content: Buffer, offset: number) {
  const name = Buffer.from(filename);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(crc32(content), 16);
  header.writeUInt32LE(content.length, 20);
  header.writeUInt32LE(content.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

function createFallbackDocxBase64(text: string) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  const files = [
    {
      filename: "[Content_Types].xml",
      content: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
    },
    { filename: "word/document.xml", content: Buffer.from(documentXml) },
  ];
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const local = createLocalHeader(file.filename, file.content);
    localParts.push(local);
    centralParts.push(createCentralHeader(file.filename, file.content, offset));
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]).toString("base64");
}

describe("breakdownFreeText", () => {
  it("returns an editable draft without persisting anything", async () => {
    const before = await db.experience.count();

    const draft = await breakdownFreeText("Built an ABSA project with BERT.", new MockLLMProvider());

    const after = await db.experience.count();
    expect(after).toBe(before);
    expect(draft.experiences).toHaveLength(1);
    expect(draft.experiences[0].pendingClaims.length).toBeGreaterThan(0);
  });

  it("requires a provider that explicitly supports file uploads", async () => {
    await expect(
      breakdownResumeFile(
        { filename: "resume.pdf", mimeType: "application/pdf", dataBase64: "JVBERi0=" },
        new MockLLMProvider(),
      ),
    ).rejects.toThrow("Resume file uploads require LLM_PROVIDER=openai and OPENAI_API_KEY");
  });

  it("returns uploaded resume drafts without persisting anything", async () => {
    const provider: LLMProvider = {
      name: "openai",
      async extractStructuredExperience() {
        return { experiences: [] };
      },
      async extractStructuredExperienceFromFile() {
        return {
          experiences: [
            {
              type: "PROJECT",
              title: "Uploaded resume project",
              organization: "",
              role: "",
              startDate: "",
              endDate: "",
              summary: "Parsed from uploaded resume.",
              responsibilities: [],
              achievements: [],
              skills: ["resume"],
              tags: ["upload"],
              pendingClaims: ["organization"],
            },
          ],
        };
      },
      async parseJobDescription() {
        return { title: "", company: "", language: "mixed", requirements: [], skills: [], keywords: [] };
      },
      async rewriteExperience() {
        return { rewrittenText: "", pendingClaims: [] };
      },
    };
    const before = await db.experience.count();

    const draft = await breakdownResumeFile(
      { filename: "resume.pdf", mimeType: "application/pdf", dataBase64: "JVBERi0=" },
      provider,
    );

    await expect(db.experience.count()).resolves.toBe(before);
    expect(draft.experiences[0].title).toBe("Uploaded resume project");
  });

  it("uses text uploads as local text before requiring file-input support", async () => {
    const provider = new MockLLMProvider();
    const rawText = "Jane Doe\nAI Product Manager\nBuilt a resume upload parser.";

    const draft = await breakdownResumeFile(
      {
        filename: "resume.txt",
        mimeType: "text/plain",
        dataBase64: Buffer.from(rawText, "utf8").toString("base64"),
      },
      provider,
    );

    expect(draft.experiences[0].title).toBe("Jane Doe");
    expect(draft.experiences[0].summary).toContain("resume upload parser");
  });

  it("uses local docx text extraction before falling back to file input", async () => {
    let textInput = "";
    let fileInputCalls = 0;
    const provider: LLMProvider = {
      name: "openai",
      async extractStructuredExperience(rawText) {
        textInput = rawText;
        return {
          experiences: [
            {
              type: "PROJECT",
              title: rawText,
              organization: "",
              role: "",
              startDate: "",
              endDate: "",
              summary: rawText,
              responsibilities: [],
              achievements: [],
              skills: [],
              tags: [],
              pendingClaims: [],
            },
          ],
        };
      },
      async extractStructuredExperienceFromFile() {
        fileInputCalls += 1;
        return { experiences: [] };
      },
      async parseJobDescription() {
        return { title: "", company: "", language: "mixed", requirements: [], skills: [], keywords: [] };
      },
      async rewriteExperience() {
        return { rewrittenText: "", pendingClaims: [] };
      },
    };

    const draft = await breakdownResumeFile(
      {
        filename: "resume.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        dataBase64: createFallbackDocxBase64("docx fallback text"),
      },
      provider,
    );

    expect(fileInputCalls).toBe(0);
    expect(textInput).toBe("docx fallback text");
    expect(draft.experiences[0].title).toBe("docx fallback text");
  });
});
