import { NextRequest, NextResponse } from 'next/server'
import { Citation, RelatedPaper, StatementWithPosition } from '@/types'
import { parsePDF } from '@/lib/pdf-parser'
import { FILE_LIMITS } from '@/lib/constants'
import { extractCitations, extractStatements } from '@/lib/citation-processing'
import { findRelatedPapersFromStatements, missingAbstractWarning, normalizeRelatedPapers, searchRelatedPapers } from '@/lib/api-search'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf') as File
    const warnings: string[] = []

    if (!file) {
      return NextResponse.json(
        { error: 'PDF file is required' },
        { status: 400 }
      )
    }

    // Validate file type (some browsers may send empty type)
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF.' },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'The uploaded PDF is empty.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > FILE_LIMITS.MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size too large. Please upload a PDF smaller than ${FILE_LIMITS.MAX_SIZE_MB}MB.` },
        { status: 400 }
      )
    }

    // Convert PDF to text
    const arrayBuffer = await file.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

    if (!pdfBuffer.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
      return NextResponse.json(
        { error: 'Invalid file. Please upload a PDF.' },
        { status: 400 }
      )
    }
    
    let text = ''
    let pages = 1
    try {
      const data = await parsePDF(pdfBuffer)
      text = data.text
      pages = Number.isFinite(data.numpages) && data.numpages > 0
        ? data.numpages
        : Math.max(1, Math.ceil(text.length / 2000))
      
      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          { error: 'PDF appears to be empty or unreadable. Please ensure the PDF contains text and is not password-protected.' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse PDF. Please ensure the file is a valid, unlocked PDF and try again.' },
        { status: 400 }
      )
    }

    // Extract existing citations
    let existingCitations: Citation[] = []
    try {
      existingCitations = extractCitations(text)
    } catch (error) {
      warnings.push('We could not extract existing citations from the PDF.')
      existingCitations = []
    }
    
    // Extract statements
    let statements: StatementWithPosition[] = []
    try {
      statements = extractStatements(text)
    } catch (error) {
      warnings.push('We could not extract supporting statements from the PDF.')
      statements = []
    }
    
    // Find related papers from statements
    let discoveredCitations: Citation[] = []
    try {
      discoveredCitations = await findRelatedPapersFromStatements(statements)
    } catch (error) {
      warnings.push('We could not match statements to supporting papers from every source.')
      discoveredCitations = []
    }
    
    // Combine all citations
    const allCitations = [...existingCitations, ...discoveredCitations]
    
    // Search for related papers
    let relatedPapers: RelatedPaper[] = []
    try {
      relatedPapers = await searchRelatedPapers(allCitations, statements)
    } catch (error) {
      warnings.push('We could not finish searching all academic databases for related papers.')
      relatedPapers = []
    }

    const normalizedPapers = normalizeRelatedPapers(relatedPapers)
    const abstractWarning = missingAbstractWarning(normalizedPapers)
    if (abstractWarning) warnings.push(abstractWarning)

    return NextResponse.json({
      citations: allCitations,
      relatedPapers: normalizedPapers,
      statementsWithPositions: statements,
      textLength: text.length,
      pages,
      statementsFound: statements.map(s => s.text),
      existingCitationsCount: existingCitations.length,
      discoveredCitationsCount: discoveredCitations.length,
      warnings,
      fileName: file.name,
      pdfUrl: ''
    })

  } catch {
    return NextResponse.json(
      { error: 'Failed to process PDF. Please ensure the file is a valid PDF and try again.' },
      { status: 500 }
    )
  }
}
