import assert from 'node:assert/strict'
import { extractStatements } from '../lib/citation-processing'
import { buildArxivQueries, calculateLexicalSimilarity, findRelatedPapersFromStatements, searchRelatedPapers } from '../lib/api-search'
import { cleanExternalText, resolveExternalUrl, toDoiUrl } from '../lib/utils'
import { formatInTextCitation, formatReference, formatReferenceList } from '../lib/references'
import type { Citation, RelatedPaper, StatementWithPosition } from '../types'

async function testStatementPositionsSurviveNormalization() {
  const text = [
    'Intro line with spacing.',
    '',
    'Results show the model improves accuracy by 12% across the benchmark dataset.',
    'Closing context line.'
  ].join('\n')

  const statements = extractStatements(text)
  assert.ok(statements.length > 0, 'expected at least one extracted statement')

  const target = statements.find((statement) => statement.text.includes('improves accuracy by 12%'))
  assert.ok(target, 'expected quantitative statement to be extracted')
  assert.ok(target.startIndex > 0, 'statement should not collapse to index 0 after normalization')
  assert.match(target.contextBefore || '', /Intro line with spacing\./, 'contextBefore should come from surrounding source text')
  assert.match(target.snippet || '', /Results show the model improves accuracy by 12%/, 'snippet should include the original statement text')
}

async function testFallbackExtractionIsStableAcrossMultipleMatches() {
  const text = [
    'Alpha study covers baseline calibration for the field',
    'Beta research examines deployment constraints in practice',
    'Gamma analysis reviews downstream outcomes carefully'
  ].join('\n')

  const statements = extractStatements(text)
  assert.equal(statements.length, 3, 'fallback extraction should keep all academic sentences instead of skipping alternating matches')
  assert.deepEqual(
    statements.map((statement) => statement.text),
    [
      'Alpha study covers baseline calibration for the field.',
      'Beta research examines deployment constraints in practice.',
      'Gamma analysis reviews downstream outcomes carefully.'
    ]
  )
}

async function testExistingCitationSearchUsesPerCitationCap() {
  const citations: Citation[] = [
    { id: 'c1', text: 'Citation One', title: 'Citation One', confidence: 0.8 },
    { id: 'c2', text: 'Citation Two', title: 'Citation Two', confidence: 0.8 }
  ]

  const makePaper = (id: string): RelatedPaper => ({
    id,
    title: `Paper ${id}`,
    authors: ['Test Author'],
    year: '2024',
    abstract: 'Detailed abstract with enough overlap for scoring.',
    similarity: 0
  })

  const result = await searchRelatedPapers(citations, [], {
    searchArxiv: async (query: string) => query === 'Citation One'
      ? Array.from({ length: 6 }, (_, index) => makePaper(`one-${index + 1}`))
      : Array.from({ length: 6 }, (_, index) => makePaper(`two-${index + 1}`)),
    searchOpenAlex: async () => [],
    searchCrossRef: async () => [],
    searchPubMed: async () => [],
    calculateSimilarityScore: async (_query: string, paper: RelatedPaper) => {
      const fromSecondCitation = paper.id.startsWith('two-')
      return fromSecondCitation ? 88 : 92
    }
  })

  assert.equal(result.length, 8, 'search should use the total budget while allowing later citations to contribute results')
  assert.ok(result.some((paper) => paper.id.startsWith('two-')), 'later citations should still contribute papers after earlier ones consume their per-citation budget')
}

async function testPercentageClaimsAreExtracted() {
  const text = 'Classification accuracy reached 95% on the held-out benchmark dataset today.'
  const statements = extractStatements(text)
  assert.ok(
    statements.some((statement) => statement.text.includes('95%')),
    'quantitative claims should match even though % is not a word character'
  )
}

async function testSourceLinksAndMatchScoresStayHonest() {
  assert.equal(toDoiUrl('https://doi.org/10.1000/xyz'), 'https://doi.org/10.1000/xyz')
  assert.equal(toDoiUrl('10.1000/xyz'), 'https://doi.org/10.1000/xyz')
  assert.equal(
    resolveExternalUrl({ doi: 'https://doi.org/10.1000/xyz', fallbackId: 'https://openalex.org/W1' }),
    'https://doi.org/10.1000/xyz'
  )
  assert.equal(resolveExternalUrl({ fallbackId: 'https://openalex.org/W1' }), 'https://openalex.org/W1')
  assert.equal(cleanExternalText('<jats:p>Fish &amp; chips</jats:p>'), 'Fish & chips')
  assert.ok(buildArxivQueries('environmental monitoring drones').every((query) => !query.includes('cat:')))
  assert.deepEqual(buildArxivQueries('a an'), [])

  const lexicalScore = calculateLexicalSimilarity('alpha beta gamma', {
    id: 'lexical',
    title: 'Gamma database alpha beta',
    authors: ['Author'],
    year: '2024',
    abstract: 'No abstract available.',
    similarity: 0
  })
  assert.equal(lexicalScore, 75, 'words inside longer tokens such as database should not count as the term data')

  const statement: StatementWithPosition = {
    text: 'Quantum error correction improves qubit fidelity by 12 percent in the lab.',
    startIndex: 0,
    endIndex: 70,
    confidence: 0.8
  }
  const goodPaper: RelatedPaper = {
    id: 'good-paper',
    title: 'Quantum error correction',
    authors: ['Doe, Jane', 'Smith JA'],
    year: '2020',
    abstract: 'Quantum error correction improves qubit fidelity in superconducting devices.',
    url: 'https://doi.org/10.1000/good',
    similarity: 0
  }
  const weakPaper: RelatedPaper = {
    id: 'weak-paper',
    title: 'Cooking pasta',
    authors: ['Chef'],
    year: '2019',
    abstract: 'Boil water and salt the pot thoroughly before dinner service begins.',
    url: 'https://doi.org/10.1000/weak',
    similarity: 0
  }

  const discovered = await findRelatedPapersFromStatements([statement], {
    searchArxiv: async () => [goodPaper, weakPaper],
    searchOpenAlex: async () => [],
    searchCrossRef: async () => [],
    searchPubMed: async () => [],
    getSemanticSimilarity: async (_text: string, paper: RelatedPaper) => paper.id === 'good-paper' ? 0.82 : 0.05
  })

  assert.equal(discovered.length, 1, 'papers below the 50% match threshold should not be returned')
  assert.equal(discovered[0].url, 'https://doi.org/10.1000/good')
  assert.ok((discovered[0].similarity || 0) >= 50)
  assert.deepEqual(discovered[0].authorList, ['Doe, Jane', 'Smith JA'])

  const related = await searchRelatedPapers(discovered, [statement])
  assert.equal(related.length, 1)
  assert.equal(related[0].url, 'https://doi.org/10.1000/good')
  assert.deepEqual(related[0].authors, ['Doe, Jane', 'Smith JA'])
  assert.ok(related[0].similarity >= 50)
}

async function testReferenceFormatting() {
  const paper: RelatedPaper = {
    id: 'paper-1',
    title: 'Crop & Soil Monitoring',
    authors: ['Doe, Jane', 'Smith JA', 'Lee, Ann'],
    year: '2020',
    abstract: 'Abstract',
    similarity: 80,
    url: 'https://doi.org/10.1000/crop'
  }
  const second: RelatedPaper = {
    ...paper,
    id: 'paper-2',
    title: 'Second Study',
    authors: ['Ada Lovelace']
  }

  assert.equal(formatInTextCitation(paper, 'apa'), '(Doe et al., 2020)')
  assert.equal(
    formatInTextCitation({ ...paper, authors: ['Doe, Jane', 'Smith JA'] }, 'apa'),
    '(Doe & Smith, 2020)'
  )
  assert.match(formatReference(paper, 'apa'), /https:\/\/doi\.org\/10\.1000\/crop/)
  const bibtex = formatReference(paper, 'bibtex')
  assert.match(bibtex, /author = \{Doe, Jane and Smith JA and Lee, Ann\}/)
  assert.match(bibtex, /title = \{Crop \\& Soil Monitoring\}/)
  assert.match(bibtex, /url = \{https:\/\/doi\.org\/10\.1000\/crop\}/)
  const key = bibtex.match(/@article\{([^,]+),/)?.[1]
  assert.ok(key)
  assert.equal(formatInTextCitation(paper, 'bibtex'), `\\cite{${key}}`)
  const list = formatReferenceList([paper, second], 'bibtex')
  assert.doesNotMatch(list, /^1\./m)
  assert.equal(list.match(/@article\{/g)?.length, 2)
}

async function main() {
  const tests: Array<[string, () => Promise<void>]> = [
    ['statement positions survive normalization', testStatementPositionsSurviveNormalization],
    ['fallback extraction keeps every academic sentence', testFallbackExtractionIsStableAcrossMultipleMatches],
    ['existing citation search uses per-citation cap', testExistingCitationSearchUsesPerCitationCap],
    ['percentage claims are extracted', testPercentageClaimsAreExtracted],
    ['source links and match scores stay honest', testSourceLinksAndMatchScoresStayHonest],
    ['reference formatting keeps authors, urls, and bibtex valid', testReferenceFormatting]
  ]

  for (const [name, test] of tests) {
    await test()
    console.log(`PASS ${name}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
