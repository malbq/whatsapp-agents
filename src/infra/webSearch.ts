export interface SearchParams {
  query: string
  signal?: AbortSignal
}

export interface SearchResult {
  url: string
  title: string
  description: string
  age: string
  snippets: Array<string>
}

export interface WebSearch {
  (params: SearchParams): Promise<SearchResult[]>
}
