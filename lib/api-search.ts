// Academic API search functions

import axios from 'axios'
import { RelatedPaper, Citation, StatementWithPosition } from '@/types'
import { 
  API_TIMEOUT, 
  API_RESULT_LIMITS,
  SIMILARITY_THRESHOLDS,
  CONFIDENCE
} from './constants'
import { 
  withTimeout, 
  extractKeyTermsFromStatement, 
  extractSupportingQuote,
  generateId,
  cleanExternalText,
  resolveExternalUrl,
  toDoiUrl
} from './utils'
import { embedText, cosineSimilarity } from './embeddings'

interface SearchImplementations {
  searchArxiv: typeof searchArxiv
  searchOpenAlex: typeof searchOpenAlex
  searchCrossRef: typeof searchCrossRef
  searchPubMed: typeof searchPubMed
  calculateSimilarityScore: typeof calculateSimilarityScore
  getSemanticSimilarity: typeof getSemanticSimilarity
}

interface OpenAlexAuthorship {
  author?: { display_name?: string | null }
}

interface CrossRefAuthor {
  given?: string
  family?: string
}

interface PubMedAuthor {
  name?: string
}

function extractPubMedAbstract(articleXml: string): string {
  const abstractMatches = [...articleXml.matchAll(/<AbstractText\b[^>]*>([\s\S]*?)<\/AbstractText>/g)]
  if (abstractMatches.length === 0) {
    return 'No abstract available.'
  }

  const abstract = abstractMatches
    .map((match) => cleanExternalText(match[1]))
    .filter(Boolean)
    .join(' ')

  return abstract || 'No abstract available.'
}

function publicationYear(value: string | undefined): string {
  if (!value) return 'Unknown'
  const match = value.match(/\b(?:19|20)\d{2}\b/)
  return match ? match[0] : 'Unknown'
}

function hasWholeTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
}

function normalizeArxivUrl(url: string): string {
  return url.trim().replace(/^http:\/\/(?:export\.)?arxiv\.org/i, 'https://arxiv.org')
}

/**
 * Build arXiv queries from the user's terms.
 * A category-only fallback is intentionally omitted: it returns unrelated papers.
 */
export function buildArxivQueries(searchQuery: string): string[] {
  const keyTerms = searchQuery.split(' ').filter(term => term.length > 2)
  if (keyTerms.length === 0) return []

  const words = keyTerms.slice(0, 8)
  const phrases: string[] = []
  for (let i = 0; i < Math.min(words.length - 1, 3); i++) {
    phrases.push(`"${words[i]} ${words[i + 1]}"`)
  }

  const queries = [
    phrases.length > 0
      ? `${phrases[0]} AND (${keyTerms.slice(0, 4).join(' OR ')})`
      : keyTerms.slice(0, 5).join(' AND '),
    keyTerms.slice(0, 5).join(' AND ')
  ]

  return [...new Set(queries.map(query => query.trim()).filter(Boolean))]
}

export function normalizeRelatedPapers(papers: RelatedPaper[]): RelatedPaper[] {
  return papers.map((paper) => ({
    ...paper,
    abstract: paper.abstract?.trim() ? paper.abstract : 'No abstract available.'
  }))
}

export function missingAbstractWarning(papers: RelatedPaper[]): string | undefined {
  if (papers.some((paper) => /no abstract available/i.test(paper.abstract || ''))) {
    return 'Some sources do not provide abstracts, so those matches were ranked using titles and available metadata only.'
  }
  return undefined
}

function buildSearchImplementations(overrides: Partial<SearchImplementations> = {}): SearchImplementations {
  return {
    searchArxiv,
    searchOpenAlex,
    searchCrossRef,
    searchPubMed,
    calculateSimilarityScore,
    getSemanticSimilarity,
    ...overrides
  }
}

/**
 * Search arXiv API
 */
export async function searchArxiv(searchQuery: string): Promise<RelatedPaper[]> {
  try {
    const searchQueries = buildArxivQueries(searchQuery)
    
    for (const query of searchQueries) {
      const response = await axios.get('http://export.arxiv.org/api/query', {
        params: {
          search_query: query,
          start: 0,
          max_results: API_RESULT_LIMITS.ARXIV,
          sortBy: 'relevance',
          sortOrder: 'descending'
        },
        timeout: API_TIMEOUT.ARXIV
      })

      const papers: RelatedPaper[] = []
      const xmlText = response.data
      const entryMatches = xmlText.match(/<entry>([\s\S]*?)<\/entry>/g)
      
      if (entryMatches && entryMatches.length > 0) {
        for (const entry of entryMatches) {
          if (papers.length >= API_RESULT_LIMITS.ARXIV) break
          
          const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
          const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/)
          const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/)
          const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/)
          
          const authorMatches = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)
          const authors: string[] = []
          if (authorMatches) {
            for (const authorMatch of authorMatches) {
              const nameMatch = authorMatch.match(/<name>([\s\S]*?)<\/name>/)
              if (nameMatch) {
                authors.push(nameMatch[1].trim())
              }
            }
          }
          
          if (titleMatch && summaryMatch && idMatch) {
            const title = cleanExternalText(titleMatch[1])
            const summary = cleanExternalText(summaryMatch[1])
            const arxivUrl = normalizeArxivUrl(idMatch[1])
            const published = publishedMatch ? publishedMatch[1] : ''
            const year = publicationYear(published)
            
            papers.push({
              id: generateId('arxiv'),
              title,
              authors: authors.length > 0 ? authors : ['Unknown Author'],
              year,
              abstract: summary,
              url: arxivUrl,
              similarity: 0
            })
          }
        }
        
        if (papers.length > 0) {
          return papers
        }
      }
    }
    
    return []
  } catch (error) {
    console.error('ArXiv API error:', error)
    return []
  }
}

/**
 * Search OpenAlex API
 */
export async function searchOpenAlex(query: string): Promise<RelatedPaper[]> {
  try {
    const response = await axios.get('https://api.openalex.org/works', {
      params: {
        search: query,
        per_page: API_RESULT_LIMITS.OPENALEX,
        sort: 'relevance_score:desc',
        filter: 'type:article,publication_year:>2000',
        select: 'id,title,authorships,publication_year,abstract_inverted_index,doi,open_access,primary_location'
      },
      timeout: API_TIMEOUT.OPENALEX
    })

    const papers: RelatedPaper[] = []
    const results = response.data.results || []

    for (const work of results) {
      const authors = work.authorships
        ? (work.authorships as OpenAlexAuthorship[])
            .map((authorship) => authorship.author?.display_name?.trim() || '')
            .filter((name) => name.length > 0)
        : []
      const year = work.publication_year ? work.publication_year.toString() : 'Unknown'

      // Reconstruct abstract from inverted index
      let abstract = 'No abstract available.'
      if (work.abstract_inverted_index && typeof work.abstract_inverted_index === 'object') {
        try {
          const wordPositions: { [key: number]: string } = {}
          for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
            if (Array.isArray(positions)) {
              for (const pos of positions) {
                wordPositions[pos] = word
              }
            }
          }
          const sortedPositions = Object.keys(wordPositions)
            .map(pos => parseInt(pos))
            .sort((a, b) => a - b)
          const reconstructed = sortedPositions.map(pos => wordPositions[pos]).join(' ')
          if (reconstructed.length > 50) {
            abstract = reconstructed.length > 400 
              ? reconstructed.substring(0, 400) + '...' 
              : reconstructed
          }
        } catch {
          // Keep default abstract
        }
      }

      papers.push({
        id: generateId('openalex'),
        title: work.title || 'Untitled',
        authors: authors.length > 0 ? authors : ['Unknown Author'],
        year,
        abstract,
        url: resolveExternalUrl({
          doi: work.doi,
          oaUrl: work.open_access?.oa_url,
          landingPageUrl: work.primary_location?.landing_page_url,
          fallbackId: work.id
        }),
        similarity: 0
      })
    }

    return papers
  } catch (error) {
    console.error('OpenAlex API error:', error)
    return []
  }
}

/**
 * Search CrossRef API
 */
export async function searchCrossRef(query: string): Promise<RelatedPaper[]> {
  try {
    const response = await axios.get('https://api.crossref.org/works', {
      params: {
        query: query,
        rows: API_RESULT_LIMITS.CROSSREF,
        sort: 'relevance',
        filter: 'type:journal-article,from-pub-date:2000'
      },
      timeout: API_TIMEOUT.CROSSREF,
      headers: {
        'User-Agent': 'CiteFinder/1.0 (https://citefinder.app; mailto:support@citefinder.app)'
      }
    })

    const papers: RelatedPaper[] = []
    const items = response.data.message?.items || []

    for (const item of items) {
      if (item.title && item.title[0]) {
        const authors = item.author
          ? (item.author as CrossRefAuthor[])
              .map((author) => `${author.given || ''} ${author.family || ''}`.trim())
              .filter((name) => name.length > 0)
          : []
        const year = item.published?.['date-parts']?.[0]?.[0]?.toString() || 'Unknown'
        
        let abstract = 'No abstract available.'
        if (item.abstract) {
          const cleaned = cleanExternalText(String(item.abstract))
          if (cleaned) {
            abstract = cleaned.length > 300
              ? `${cleaned.substring(0, 300)}...`
              : cleaned
          }
        }

        papers.push({
          id: generateId('crossref'),
          title: cleanExternalText(String(item.title[0])) || 'Untitled',
          authors: authors.length > 0 ? authors : ['Unknown Author'],
          year,
          abstract,
          url: toDoiUrl(item.DOI) || item.URL || '#',
          similarity: 0
        })
      }
    }

    return papers
  } catch (error) {
    console.error('CrossRef API error:', error)
    return []
  }
}

/**
 * Search PubMed API
 */
export async function searchPubMed(query: string): Promise<RelatedPaper[]> {
  try {
    const searchResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
      params: {
        db: 'pubmed',
        term: query,
        retmode: 'json',
        retmax: API_RESULT_LIMITS.PUBMED,
        sort: 'relevance'
      },
      timeout: API_TIMEOUT.PUBMED
    })

    const papers: RelatedPaper[] = []
    const idList = (searchResponse.data.esearchresult?.idlist || []).slice(0, API_RESULT_LIMITS.PUBMED)

    if (idList.length > 0) {
      const ids = idList.join(',')
      const [detailResponse, fetchResponse] = await Promise.all([
        axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', {
          params: {
            db: 'pubmed',
            id: ids,
            retmode: 'json'
          },
          timeout: API_TIMEOUT.PUBMED
        }),
        axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', {
          params: {
            db: 'pubmed',
            id: ids,
            retmode: 'xml'
          },
          timeout: API_TIMEOUT.PUBMED
        })
      ])

      const summaries = detailResponse.data.result || {}
      const articleXmlMatches = [...String(fetchResponse.data).matchAll(/<PubmedArticle>[\s\S]*?<PMID[^>]*>(\d+)<\/PMID>[\s\S]*?<\/PubmedArticle>/g)]
      const abstractById = new Map<string, string>()

      for (const match of articleXmlMatches) {
        abstractById.set(match[1], extractPubMedAbstract(match[0]))
      }

      for (const id of idList) {
        const summary = summaries[id]
        if (summary && summary.title) {
          const authors = summary.authors
            ? (summary.authors as PubMedAuthor[])
                .map((author) => author.name?.trim() || '')
                .filter((name) => name.length > 0)
            : []
          const year = publicationYear(summary.pubdate)

          papers.push({
            id: generateId('pubmed'),
            title: cleanExternalText(String(summary.title)) || 'Untitled',
            authors: authors.length > 0 ? authors : ['Unknown Author'],
            year,
            abstract: abstractById.get(id) || 'No abstract available.',
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            similarity: 0
          })
        }
      }
    }

    return papers
  } catch (error) {
    console.error('PubMed API error:', error)
    return []
  }
}

/**
 * Calculate lexical similarity score
 */
export function calculateLexicalSimilarity(searchQuery: string, paper: RelatedPaper): number {
  const query = searchQuery.toLowerCase()
  const title = paper.title.toLowerCase()
  const abstract = paper.abstract.toLowerCase()
  
  const queryWords = query.split(/\s+/).filter(word => word.length > 2)
  const titleWords = title.split(/\s+/).filter(word => word.length > 2)
  const abstractWords = abstract.split(/\s+/).filter(word => word.length > 2)
  
  let score = 0
  let totalMatches = 0
  
  for (const word of queryWords) {
    if (titleWords.includes(word)) {
      score += 3
      totalMatches++
    }
  }
  
  for (const word of queryWords) {
    if (abstractWords.includes(word)) {
      score += 1
      totalMatches++
    }
  }
  
  const maxPossibleScore = queryWords.length * 4
  let percentage = maxPossibleScore > 0 ? (score / maxPossibleScore) * 100 : 0
  
  if (title.includes(query)) {
    percentage += 30
  } else if (abstract.includes(query)) {
    percentage += 20
  }
  
  if (totalMatches === 0) return 0
  if (totalMatches < 2) percentage = Math.min(percentage, 30)
  if (totalMatches >= 3) percentage = Math.max(percentage, 50)
  
  const domainTerms = ['research', 'study', 'analysis', 'method', 'approach', 'technique', 'system', 'model', 'data', 'results', 'conclusion']
  const domainMatches = domainTerms.filter(term => hasWholeTerm(title, term) || hasWholeTerm(abstract, term)).length
  percentage += domainMatches * 2
  
  return Math.min(percentage, 100)
}

/**
 * Get semantic similarity using embeddings
 */
export async function getSemanticSimilarity(text: string, paper: RelatedPaper): Promise<number> {
  if (!text || !paper.title) return 0

  try {
    const abstractText = (paper.abstract || '').trim()
    const useTitleOnly = abstractText.length < 40 || /no abstract available/i.test(abstractText)
    const paperText = useTitleOnly ? paper.title : `${paper.title}. ${abstractText}`

    const [textEmbedding, paperEmbedding] = await Promise.all([
      embedText(text),
      embedText(paperText)
    ])

    if (textEmbedding.length === 0 || paperEmbedding.length === 0) return 0

    const similarity = cosineSimilarity(textEmbedding, paperEmbedding)
    return Number.isFinite(similarity) ? Math.max(similarity, 0) : 0
  } catch (error) {
    console.error('Semantic similarity error:', error)
    return 0
  }
}

/**
 * Calculate combined similarity score
 */
export async function calculateSimilarityScore(searchQuery: string, paper: RelatedPaper): Promise<number> {
  const semanticSimilarity = await getSemanticSimilarity(searchQuery, paper)
  const semanticScore = Math.round(semanticSimilarity * 100)
  const lexicalScore = Math.round(calculateLexicalSimilarity(searchQuery, paper))
  return Math.max(semanticScore, lexicalScore)
}

/**
 * Calculate statement overlap score
 */
export function calculateStatementOverlapScore(statement: string, paper: RelatedPaper): number {
  const statementTerms = extractKeyTermsFromStatement(statement).toLowerCase().split(' ')
  const paperTitleTerms = paper.title.toLowerCase().split(' ')
  const paperAbstractTerms = paper.abstract.toLowerCase().split(' ')

  let relevance = 0
  let totalMatches = 0

  for (const term of statementTerms) {
    if (paperTitleTerms.includes(term)) {
      relevance += 1
      totalMatches++
    }
  }

  for (const term of statementTerms) {
    if (paperAbstractTerms.includes(term)) {
      relevance += 0.5
      totalMatches++
    }
  }

  const maxPossibleRelevance = statementTerms.length * 1.5
  return maxPossibleRelevance > 0 ? (relevance / maxPossibleRelevance) * 100 : 0
}

/**
 * Find related papers from extracted statements
 */
export async function findRelatedPapersFromStatements(
  statements: StatementWithPosition[],
  overrides: Partial<SearchImplementations> = {}
): Promise<Citation[]> {
  const citations: Citation[] = []
  let idCounter = 1
  const implementations = buildSearchImplementations(overrides)
  
  for (const statement of statements) {
    try {
      const keyTerms = extractKeyTermsFromStatement(statement.text)
      
      const searchPromises = [
        withTimeout(implementations.searchArxiv(keyTerms), API_TIMEOUT.SEARCH_BATCH, [] as RelatedPaper[]),
        withTimeout(implementations.searchOpenAlex(keyTerms), API_TIMEOUT.SEARCH_BATCH, [] as RelatedPaper[]),
        withTimeout(implementations.searchCrossRef(keyTerms), API_TIMEOUT.SEARCH_BATCH, [] as RelatedPaper[]),
        withTimeout(implementations.searchPubMed(keyTerms), API_TIMEOUT.SEARCH_BATCH, [] as RelatedPaper[])
      ]
      
      const results = await Promise.allSettled(searchPromises)
      const [arxivResults, openAlexResults, crossRefResults, pubmedResults] = results.map(r => 
        r.status === 'fulfilled' ? r.value : []
      )
      
      const allResults = [...arxivResults, ...openAlexResults, ...crossRefResults, ...pubmedResults]
      const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.title.toLowerCase() === result.title.toLowerCase())
      )

      const scoredResults = await Promise.all(
        uniqueResults.map(async (result) => {
          const semanticSimilarity = await implementations.getSemanticSimilarity(statement.text, result)
          const overlapScore = calculateStatementOverlapScore(statement.text, result)
          const combinedScore = Math.max(Math.round(semanticSimilarity * 100), Math.round(overlapScore))

          return { result, semanticSimilarity, overlapScore, combinedScore }
        })
      )

      const rankedResults = scoredResults
        .filter((item) => item.combinedScore >= SIMILARITY_THRESHOLDS.MIN_DISPLAY)
        .sort((a, b) => {
          if (b.semanticSimilarity !== a.semanticSimilarity) {
            return b.semanticSimilarity - a.semanticSimilarity
          }
          return b.combinedScore - a.combinedScore
        })
        .slice(0, API_RESULT_LIMITS.MAX_PAPERS_PER_CITATION)

      for (const { result, semanticSimilarity, overlapScore, combinedScore } of rankedResults) {
        const authors = result.authors.join(', ')
        const year = result.year

        result.similarity = combinedScore

        const supportingQuote = extractSupportingQuote(statement.text, result.abstract)

        const semanticConfidence = semanticSimilarity > 0 
          ? CONFIDENCE.SEMANTIC_BASE + semanticSimilarity * CONFIDENCE.SEMANTIC_MULTIPLIER 
          : 0
        const overlapConfidence = overlapScore > 0 
          ? CONFIDENCE.OVERLAP_BASE + (overlapScore / 100) * CONFIDENCE.OVERLAP_MULTIPLIER 
          : 0
        const rawConfidence = Math.max(semanticConfidence, overlapConfidence, CONFIDENCE.MIN)
        const confidence = Math.min(rawConfidence, CONFIDENCE.MAX)
        const usableAbstract = result.abstract && !/no abstract available/i.test(result.abstract)
          ? result.abstract
          : undefined

        citations.push({
          id: `discovered-${idCounter++}`,
          text: `${authors} (${year}). ${result.title}.`,
          authors,
          authorList: result.authors,
          year,
          title: result.title,
          confidence,
          statement: statement.text,
          supportingQuote: supportingQuote || usableAbstract,
          url: result.url && result.url !== '#' ? result.url : undefined,
          abstract: usableAbstract,
          similarity: combinedScore
        })
      }
    } catch (error) {
      console.error('Error searching for statement:', error)
    }
  }
  
  return citations.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Search for related papers using multiple academic APIs
 */
export async function searchRelatedPapers(
  citations: Citation[],
  statements: StatementWithPosition[] = [],
  overrides: Partial<SearchImplementations> = {}
): Promise<RelatedPaper[]> {
  const allPapers: RelatedPaper[] = []
  const seenTitles = new Set<string>()
  const implementations = buildSearchImplementations(overrides)

  const discoveredCitations = citations.filter(c => c.statement)
  const existingCitations = citations.filter(c => !c.statement)

  // Process discovered citations
  for (const citation of discoveredCitations) {
    if (!citation.statement) continue

    const authorList = citation.authorList && citation.authorList.length > 0
      ? citation.authorList
      : citation.authors
        ? citation.authors.split(', ').map((name) => name.trim()).filter(Boolean)
        : []
    const similarity = typeof citation.similarity === 'number'
      ? citation.similarity
      : Math.round((citation.confidence || 0.5) * 100)

    if (similarity < SIMILARITY_THRESHOLDS.MIN_DISPLAY) continue

    const paper: RelatedPaper = {
      id: citation.id,
      title: citation.title || 'Unknown Title',
      authors: authorList.length > 0 ? authorList : ['Unknown Author'],
      year: citation.year || 'Unknown',
      abstract: citation.abstract?.trim() || citation.supportingQuote || 'No abstract available.',
      url: citation.url && citation.url !== '#'
        ? citation.url
        : citation.title
          ? `https://scholar.google.com/scholar?q=${encodeURIComponent(citation.title)}`
          : '#',
      similarity,
      statement: citation.statement,
      supportingQuote: citation.supportingQuote
    }

    if (!seenTitles.has(paper.title.toLowerCase())) {
      seenTitles.add(paper.title.toLowerCase())
      allPapers.push(paper)
    }
  }

  // Process existing citations
  for (const citation of existingCitations) {
    const searchQuery = citation.title || citation.authors || citation.text.substring(0, 100)
    if (!searchQuery || allPapers.length >= API_RESULT_LIMITS.MAX_PAPERS_TOTAL) continue

    try {
      const [arxivResults, openAlexResults, crossrefResults, pubmedResults] = await Promise.allSettled([
        withTimeout(implementations.searchArxiv(searchQuery), API_TIMEOUT.SEARCH_RELATED, [] as RelatedPaper[]),
        withTimeout(implementations.searchOpenAlex(searchQuery), API_TIMEOUT.SEARCH_RELATED, [] as RelatedPaper[]),
        withTimeout(implementations.searchCrossRef(searchQuery), API_TIMEOUT.SEARCH_RELATED, [] as RelatedPaper[]),
        withTimeout(implementations.searchPubMed(searchQuery), API_TIMEOUT.SEARCH_RELATED, [] as RelatedPaper[])
      ])

      const results = [arxivResults, openAlexResults, crossrefResults, pubmedResults]
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => (result as PromiseFulfilledResult<RelatedPaper[]>).value)

      let addedForCitation = 0

      for (const paper of results) {
        if (allPapers.length >= API_RESULT_LIMITS.MAX_PAPERS_TOTAL || addedForCitation >= API_RESULT_LIMITS.MAX_PAPERS_PER_CITATION) {
          break
        }

        if (!seenTitles.has(paper.title.toLowerCase())) {
          const similarityScore = await implementations.calculateSimilarityScore(searchQuery, paper)

          if (similarityScore < SIMILARITY_THRESHOLDS.MIN_DISPLAY) continue

          seenTitles.add(paper.title.toLowerCase())
          paper.similarity = similarityScore
          allPapers.push(paper)
          addedForCitation++
        }
      }
    } catch (error) {
      console.error('Error searching for citations:', error)
    }
  }

  return allPapers.sort((a, b) => b.similarity - a.similarity)
}
