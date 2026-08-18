import { inflateRawSync } from "node:zlib";

type ZipEntry = {
  filename: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectorySignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;

function findEndOfCentralDirectory(buffer: Buffer) {
  const maxCommentLength = 0xffff;
  const minOffset = Math.max(0, buffer.length - maxCommentLength - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) return offset;
  }
  throw new Error("Invalid DOCX zip: central directory not found");
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralDirectorySignature) {
      throw new Error("Invalid DOCX zip: central directory entry is malformed");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const filename = buffer.toString("utf8", offset + 46, offset + 46 + filenameLength);

    entries.push({ filename, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return entries;
}

function readEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== localFileHeaderSignature) {
    throw new Error(`Invalid DOCX zip: local header missing for ${entry.filename}`);
  }

  const filenameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + filenameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) {
    const inflated = inflateRawSync(compressed);
    if (entry.uncompressedSize > 0 && inflated.length !== entry.uncompressedSize) {
      throw new Error(`Invalid DOCX zip: decompressed size mismatch for ${entry.filename}`);
    }
    return inflated;
  }

  throw new Error(`Unsupported DOCX compression method ${entry.compressionMethod}`);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTextFromParagraph(paragraphXml: string) {
  const normalized = paragraphXml
    .replace(/<[\w-]+:tab\b[^>]*\/>/g, "\t")
    .replace(/<[\w-]+:br\b[^>]*\/>/g, "\n");
  const matches = Array.from(normalized.matchAll(/<[\w-]+:t\b[^>]*>([\s\S]*?)<\/[\w-]+:t>/g));
  if (matches.length > 0) {
    return matches.map((match) => decodeXmlEntities(match[1] ?? "")).join("");
  }
  return decodeXmlEntities(normalized.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractDocumentXmlText(documentXml: string) {
  const paragraphs = Array.from(documentXml.matchAll(/<[\w-]+:p\b[^>]*>([\s\S]*?)<\/[\w-]+:p>/g))
    .map((match) => extractTextFromParagraph(match[1] ?? "").trim())
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs.join("\n");

  return decodeXmlEntities(documentXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export async function extractDocxText(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const documentEntry = entries.find((entry) => entry.filename === "word/document.xml");
  if (!documentEntry) {
    throw new Error("Invalid DOCX: word/document.xml not found");
  }

  const documentXml = readEntry(buffer, documentEntry).toString("utf8");
  return extractDocumentXmlText(documentXml);
}
