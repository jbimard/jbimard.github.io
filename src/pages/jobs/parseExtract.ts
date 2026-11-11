// Reads text back out of the stored files, the way a parser would. Both libraries load only when the check is run.

// PDF.js: text items grouped into lines by their vertical position, so a column layout shows up as it would to a parser.
export const extractPdfText = async (blob: Blob): Promise<{ text: string; pages: number }> => {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
  const document = await task.promise
  const pages: string[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const content = await (await document.getPage(number)).getTextContent()
    let line = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      line += item.str
      line += item.hasEOL ? '\n' : ''
    }
    pages.push(line)
  }
  await task.destroy()
  return { text: pages.join('\n'), pages: document.numPages }
}

// Mammoth: the document's raw text. Headers, footers and text boxes are not part of it, which is the point: whatever
// sits there is invisible to a parser that works this way.
export const extractDocxText = async (blob: Blob): Promise<string> => {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() })
  return value
}
