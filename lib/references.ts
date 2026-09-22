import { RelatedPaper } from '@/types'

export type ReferenceFormat = 'apa' | 'mla' | 'chicago' | 'harvard' | 'bibtex'

function citationYear(year: string | undefined): string {
  return year && /^\d{4}$/.test(year) ? year : 'n.d.'
}

function sourceUrl(paper: RelatedPaper): string | undefined {
  const url = paper.url?.trim()
  if (!url || url === '#' || url.startsWith('about:')) return undefined
  return url
}

export function authorLastName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || /^unknown author$/i.test(trimmed)) return 'Author'

  if (trimmed.includes(',')) {
    return trimmed.split(',')[0]?.trim() || 'Author'
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  const givenNamesLookLikeInitials = parts.length >= 2 && parts.slice(1).every((part) => /^[A-Za-z]{1,3}\.?$/.test(part) && part.replace(/\./g, '').length <= 3 && part === part.toUpperCase())
  if (givenNamesLookLikeInitials) {
    return parts[0]
  }

  return parts[parts.length - 1] || 'Author'
}

function authorSignal(authors: string[], format: ReferenceFormat): string {
  const names = (authors.length > 0 ? authors : ['Author']).map(authorLastName)
  if (names.length === 1) return names[0]
  if (names.length === 2) {
    const joiner = format === 'apa' || format === 'harvard' ? '&' : 'and'
    return `${names[0]} ${joiner} ${names[1]}`
  }
  return `${names[0]} et al.`
}

function escapeBibtex(value: string): string {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, (character) => `\\${character}`)
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

export function bibtexKey(paper: RelatedPaper): string {
  const last = authorLastName(paper.authors[0] || 'author').toLowerCase().replace(/[^a-z0-9]/g, '') || 'author'
  const year = /^\d{4}$/.test(paper.year) ? paper.year : 'nd'
  const slug = paper.title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24)
  const suffix = paper.id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6)
  return `${last}${year}${slug}${suffix}`
}

export function formatInTextCitation(paper: RelatedPaper, format: ReferenceFormat): string {
  const year = citationYear(paper.year)

  switch (format) {
    case 'mla':
      return `(${authorSignal(paper.authors, format)})`
    case 'chicago':
      return `(${authorSignal(paper.authors, format)} ${year})`
    case 'bibtex':
      return `\\cite{${bibtexKey(paper)}}`
    case 'apa':
    case 'harvard':
    default:
      return `(${authorSignal(paper.authors, format)}, ${year})`
  }
}

export function formatReference(paper: RelatedPaper, format: ReferenceFormat): string {
  const authors = paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Author'
  const title = paper.title
  const year = citationYear(paper.year)
  const url = sourceUrl(paper)

  switch (format) {
    case 'apa':
      return `${authors}. (${year}). ${title}.${url ? ` ${url}` : ''}`
    case 'mla':
      return `${authors}. "${title}." ${year}.${url ? ` ${url}` : ''}`
    case 'chicago':
      return `${authors}. "${title}." ${year}.${url ? ` ${url}` : ''}`
    case 'harvard':
      return `${authors} (${year}) ${title}.${url ? ` Available at: ${url}` : ''}`
    case 'bibtex': {
      const lines = [
        `@article{${bibtexKey(paper)},`,
        `  author = {${paper.authors.map(escapeBibtex).join(' and ') || 'Unknown Author'}},`,
        `  title = {${escapeBibtex(title)}},`,
        `  year = {${year}},`
      ]
      if (url) lines.push(`  url = {${url}},`)
      lines.push('}')
      return lines.join('\n')
    }
    default:
      return `${authors}. (${year}). ${title}.`
  }
}

export function formatReferenceList(papers: RelatedPaper[], format: ReferenceFormat): string {
  if (papers.length === 0) {
    return 'No papers selected. Please select papers from the Related Papers section above.'
  }

  if (format === 'bibtex') {
    return papers.map((paper) => formatReference(paper, format)).join('\n\n')
  }

  if (papers.length === 1) {
    return formatReference(papers[0], format)
  }

  return papers
    .map((paper, index) => `${index + 1}. ${formatReference(paper, format)}`)
    .join('\n\n')
}
