/**
 * PDF Utilities
 * Extract text content from PDF files
 */

import * as pdfjsLib from 'pdfjs-dist'
// @ts-expect-error - pdfjs-dist worker import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure pdf.js worker using inline worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export interface PdfExtractionResult {
  text: string
  pageCount: number
  pages: PdfPageContent[]
}

export interface PdfPageContent {
  pageNumber: number
  text: string
}

export interface TextSegment {
  index: number
  text: string
  pageNumber: number
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPdf(file: File): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  
  const pages: PdfPageContent[] = []
  let fullText = ''
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    
    const pageText = textContent.items
      .map((item: unknown) => {
        if (typeof item === 'object' && item !== null && 'str' in item) {
          return (item as { str: string }).str
        }
        return ''
      })
      .join(' ')
    
    pages.push({
      pageNumber: i,
      text: pageText,
    })
    
    fullText += pageText + '\n\n'
  }
  
  return {
    text: fullText.trim(),
    pageCount: pdf.numPages,
    pages,
  }
}

/**
 * Split text into segments for translation
 * Each segment is approximately maxChars characters
 */
export function splitTextIntoSegments(
  text: string, 
  maxChars: number = 2000
): TextSegment[] {
  const segments: TextSegment[] = []
  const paragraphs = text.split(/\n\n+/)
  
  let currentSegment = ''
  let segmentIndex = 0
  
  for (const paragraph of paragraphs) {
    if (currentSegment.length + paragraph.length + 2 > maxChars && currentSegment.length > 0) {
      segments.push({
        index: segmentIndex++,
        text: currentSegment.trim(),
        pageNumber: 0,
      })
      currentSegment = paragraph
    } else {
      currentSegment += (currentSegment ? '\n\n' : '') + paragraph
    }
  }
  
  if (currentSegment.trim()) {
    segments.push({
      index: segmentIndex,
      text: currentSegment.trim(),
      pageNumber: 0,
    })
  }
  
  return segments
}

/**
 * Split PDF pages into segments for translation
 * Preserves page number information
 */
export function splitPagesIntoSegments(
  pages: PdfPageContent[],
  maxChars: number = 2000
): TextSegment[] {
  const segments: TextSegment[] = []
  let segmentIndex = 0
  
  for (const page of pages) {
    const pageSegments = splitTextIntoSegments(page.text, maxChars)
    
    for (const segment of pageSegments) {
      segments.push({
        index: segmentIndex++,
        text: segment.text,
        pageNumber: page.pageNumber,
      })
    }
  }
  
  return segments
}

/**
 * Merge translated segments back into full text
 */
export function mergeTranslatedSegments(
  segments: { index: number; original: string; translated: string }[]
): string {
  return segments
    .sort((a, b) => a.index - b.index)
    .map(s => s.translated)
    .join('\n\n')
}
