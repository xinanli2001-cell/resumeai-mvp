import type { ImportResult, LLMProvider, ResumeFileInput } from "@/lib/llm/types";
import { extractDocxText } from "@/lib/import/docx-text";

const docxMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function hasUsableLocalText(text: string) {
  return text.replace(/\s+/g, "").length >= 12;
}

function decodeTextUpload(dataBase64: string) {
  return Buffer.from(dataBase64, "base64").toString("utf8").trim();
}

export async function breakdownFreeText(
  rawText: string,
  provider: LLMProvider,
): Promise<ImportResult> {
  const text = rawText.trim();
  if (!text) throw new Error("rawText is required");
  return provider.extractStructuredExperience(text);
}

export async function breakdownResumeFile(
  file: ResumeFileInput,
  provider: LLMProvider,
): Promise<ImportResult> {
  if (!file.filename.trim()) throw new Error("filename is required");
  if (!file.mimeType.trim()) throw new Error("mimeType is required");
  if (!file.dataBase64.trim()) throw new Error("file data is required");

  if (file.mimeType === "text/plain" || file.filename.toLowerCase().endsWith(".txt")) {
    const localText = decodeTextUpload(file.dataBase64);
    if (!localText) throw new Error("Uploaded text file is empty");
    return provider.extractStructuredExperience(localText);
  }

  if (file.mimeType === docxMimeType || file.filename.toLowerCase().endsWith(".docx")) {
    try {
      const localText = await extractDocxText(Buffer.from(file.dataBase64, "base64"));
      if (hasUsableLocalText(localText)) {
        return provider.extractStructuredExperience(localText);
      }
    } catch {
      // Fall through to file input. The multimodal/document provider may still recover.
    }
  }

  if (!provider.extractStructuredExperienceFromFile) {
    throw new Error("Resume file uploads require LLM_PROVIDER=openai and OPENAI_API_KEY");
  }
  return provider.extractStructuredExperienceFromFile(file);
}
