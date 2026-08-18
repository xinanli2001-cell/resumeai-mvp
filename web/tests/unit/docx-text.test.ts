import { describe, expect, it } from "vitest";
import { extractDocxText } from "../../src/lib/import/docx-text";

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

function localFileHeader(filename: string, content: Buffer) {
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

function centralDirectoryHeader(filename: string, content: Buffer, offset: number) {
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

function endOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

function createDocxBuffer(documentXml: string) {
  const files = [
    {
      filename: "[Content_Types].xml",
      content: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
    },
    {
      filename: "_rels/.rels",
      content: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
    },
    { filename: "word/document.xml", content: Buffer.from(documentXml) },
  ];

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const local = localFileHeader(file.filename, file.content);
    localParts.push(local);
    centralParts.push(centralDirectoryHeader(file.filename, file.content, offset));
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  return Buffer.concat([...localParts, central, endOfCentralDirectory(files.length, central.length, offset)]);
}

describe("extractDocxText", () => {
  it("extracts readable paragraphs from a docx document.xml", async () => {
    const docx = createDocxBuffer(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
        "<w:body>",
        "<w:p><w:r><w:t>Jane Doe</w:t></w:r></w:p>",
        "<w:p><w:r><w:t>Product Manager</w:t></w:r></w:p>",
        "<w:p><w:r><w:t>Built resume parsing.</w:t></w:r></w:p>",
        "</w:body></w:document>",
      ].join(""),
    );

    await expect(extractDocxText(docx)).resolves.toBe("Jane Doe\nProduct Manager\nBuilt resume parsing.");
  });
});
