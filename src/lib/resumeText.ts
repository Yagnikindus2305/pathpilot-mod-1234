import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n');
}

async function extractDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

export interface ExtractedResume {
  text: string;
  extracted: boolean;
}

export async function extractResumeText(file: File): Promise<ExtractedResume> {
  const name = file.name.toLowerCase();
  try {
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      const text = await extractPdfText(file);
      return { text, extracted: text.trim().length > 0 };
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
      const text = await extractDocxText(file);
      return { text, extracted: text.trim().length > 0 };
    }
    if (file.type === 'text/plain' || name.endsWith('.txt')) {
      const text = await file.text();
      return { text, extracted: text.trim().length > 0 };
    }
  } catch {
    return { text: '', extracted: false };
  }
  return { text: '', extracted: false };
}
