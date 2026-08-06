declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseOptions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pagerender?: (pageData: any) => Promise<string> | string;
    max?: number;
  }
  interface PdfParseResult {
    numpages: number;
    text: string;
    info: unknown;
  }
  export default function pdfParse(buffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
}
