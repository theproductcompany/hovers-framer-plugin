export interface HoversConfig {
    apiToken: string
    baseUrl: string
}

export interface Article {
    id: string
    title: string
    slug: string
    body: string
    body_html: string
    excerpt: string
    featured_image: string | null
    status: "draft" | "ready" | "published" | "scheduled"
    created_at: string
    updated_at: string
    metadata: {
        keywords?: string[]
        seo_data?: Record<string, unknown>
        outline?: string[]
        content_settings?: Record<string, unknown>
        schema_data?: Record<string, unknown> | null
    }
}

export interface Pagination {
    page: number
    limit: number
    total: number
    total_pages: number
}

export interface ArticlesResponse {
    articles: Article[]
    pagination: Pagination
}

export interface ErrorResponse {
    error: string
    details?: string
}

export class HoversAPIError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public details?: string
    ) {
        super(message)
        this.name = "HoversAPIError"
    }
}

export class HoversAPI {
    private config: HoversConfig

    constructor(config: HoversConfig) {
        this.config = config
    }

    private async requestWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn()
            } catch (error) {
                if (error instanceof HoversAPIError && error.statusCode === 429 && attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }
                throw error
            }
        }
        throw new Error("Max retries exceeded")
    }

    private async request<T>(endpoint: string, options: RequestInit = {}, abortSignal?: AbortSignal): Promise<T> {
        const baseUrl = this.config.baseUrl.replace(/\/$/, "")
        const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
        const url = `${baseUrl}/api/framer${cleanEndpoint}`

        const response = await fetch(url, {
            ...options,
            signal: abortSignal,
            mode: "cors",
            credentials: "omit",
            headers: {
                Authorization: `Bearer ${this.config.apiToken}`,
                "Content-Type": "application/json",
                ...options.headers,
            },
        })

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`
            let errorDetails: string | undefined

            try {
                const errorData: ErrorResponse = await response.json()
                errorMessage = errorData.error || errorMessage
                errorDetails = errorData.details
            } catch {
                errorMessage = response.statusText || errorMessage
            }

            throw new HoversAPIError(errorMessage, response.status, errorDetails)
        }

        return response.json()
    }

    async getArticles(params?: {
        page?: number
        limit?: number
        status?: "draft" | "ready" | "published" | "scheduled"
        since?: string
        abortSignal?: AbortSignal
    }): Promise<ArticlesResponse> {
        const queryParams = new URLSearchParams()

        if (params?.page) queryParams.append("page", params.page.toString())
        if (params?.limit) queryParams.append("limit", params.limit.toString())
        if (params?.status) queryParams.append("status", params.status)
        if (params?.since) queryParams.append("since", params.since)

        const query = queryParams.toString()
        const url = `/articles${query ? `?${query}` : ""}`

        return this.requestWithRetry(() => this.request<ArticlesResponse>(url, {}, params?.abortSignal))
    }

    async getAllArticles(params?: {
        limit?: number
        status?: "draft" | "ready" | "published" | "scheduled"
        since?: string
        maxPages?: number
        abortSignal?: AbortSignal
    }): Promise<Article[]> {
        const allArticles: Article[] = []
        let page = 1
        let hasMore = true
        const maxPages = params?.maxPages || Infinity

        while (hasMore && page <= maxPages) {
            const response = await this.getArticles({
                page,
                limit: params?.limit || 100,
                status: params?.status,
                since: params?.since,
                abortSignal: params?.abortSignal,
            })

            allArticles.push(...response.articles)
            hasMore = page < response.pagination.total_pages
            page++
        }

        return allArticles
    }

    async getArticle(articleId: string, abortSignal?: AbortSignal): Promise<Article> {
        return this.requestWithRetry(() =>
            this.request<Article>(`/articles/${articleId}`, {}, abortSignal)
        )
    }

    async testConnection(abortSignal?: AbortSignal): Promise<void> {
        try {
            await this.getArticles({ page: 1, limit: 1, abortSignal })
        } catch (error) {
            if (error instanceof TypeError && error.message.includes("fetch")) {
                throw new HoversAPIError(
                    "Network error: Could not reach the Hovers API. Please check your internet connection.",
                    0,
                    error.message
                )
            }
            throw error
        }
    }
}
