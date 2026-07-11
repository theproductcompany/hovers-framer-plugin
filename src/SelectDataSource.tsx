import { framer, useIsAllowedTo, type ManagedCollection } from "framer-plugin"
import { useEffect, useState } from "react"
import { type DataSource, getDataSource, PLUGIN_KEYS } from "./data"
import { type HoversConfig } from "./hoversApi"
import { clearHoversConfig } from "./config"
import { MANAGED_COLLECTION_PERMISSION_MESSAGE, syncMethods } from "./permissions"

interface SelectDataSourceProps {
    readonly onSelectDataSource: (dataSource: DataSource) => void
    readonly hoversConfig: HoversConfig
    readonly collection: ManagedCollection
    readonly onReconfigure: () => void
}

export function SelectDataSource({
    onSelectDataSource,
    hoversConfig,
    collection,
    onReconfigure,
}: SelectDataSourceProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [fetchAll, setFetchAll] = useState(false)
    const [maxPages, setMaxPages] = useState<string>("")
    const [status, setStatus] = useState<"draft" | "ready" | "published" | "scheduled" | undefined>(undefined)
    const isAllowedToSync = useIsAllowedTo(...syncMethods)

    useEffect(() => {
        if (!isAllowedToSync) {
            return
        }

        collection
            .getPluginData(PLUGIN_KEYS.STATUS_FILTER)
            .then(savedStatus => {
                if (savedStatus) {
                    setStatus(savedStatus as "draft" | "ready" | "published" | "scheduled")
                }
            })
            .catch(error => {
                console.error("Failed to load saved status filter:", error)
            })
    }, [collection, isAllowedToSync])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!isAllowedToSync) {
            framer.notify(MANAGED_COLLECTION_PERMISSION_MESSAGE, { variant: "error" })
            return
        }

        try {
            setIsLoading(true)

            const dataSource = await getDataSource("articles", {
                config: hoversConfig,
                fetchAll,
                maxPages: fetchAll && maxPages.trim() ? Number.parseInt(maxPages.trim(), 10) || undefined : undefined,
                status: status || undefined,
                saveStatus: true,
                collection: collection,
            })
            onSelectDataSource(dataSource)
        } catch (error) {
            console.error(error)
            let errorMessage = "Failed to load articles. Check the logs for more details."

            if (error instanceof Error) {
                if (error.message.includes(MANAGED_COLLECTION_PERMISSION_MESSAGE)) {
                    errorMessage = error.message
                } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
                    errorMessage = "Invalid API credentials. Please reconfigure your Hovers connection."
                } else if (error.message.includes("429")) {
                    errorMessage = "Rate limit exceeded. Please try again in a moment."
                } else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
                    errorMessage = "Network error. Please check your internet connection and base URL."
                }
            }

            framer.notify(errorMessage, { variant: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    const handleReconfigure = async () => {
        await clearHoversConfig()
        onReconfigure()
    }

    return (
        <main className="setup">
            <div className="intro">
                <div className="logo-container">
                    <img src="/hovers-logo-light.png" alt="Hovers" className="logo-img logo-img-light" />
                    <img src="/hovers-logo-dark.png" alt="Hovers" className="logo-img logo-img-dark" />
                </div>
                <div className="content">
                    <h2>Sync Articles</h2>
                    <p>Choose which articles to sync from Hovers</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {!isAllowedToSync && <div className="error-message">{MANAGED_COLLECTION_PERMISSION_MESSAGE}</div>}

                <label htmlFor="status" className="status-filter-row">
                    <span>Status</span>
                    <select
                        id="status"
                        onChange={event =>
                            setStatus(
                                event.target.value === ""
                                    ? undefined
                                    : (event.target.value as "draft" | "ready" | "published" | "scheduled")
                            )
                        }
                        value={status || ""}
                        disabled={isLoading || !isAllowedToSync}
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="ready">Ready</option>
                        <option value="published">Published</option>
                        <option value="scheduled">Scheduled</option>
                    </select>
                </label>

                <label htmlFor="fetchAll" className="checkbox-row">
                    <input
                        id="fetchAll"
                        type="checkbox"
                        checked={fetchAll}
                        onChange={event => setFetchAll(event.target.checked)}
                        disabled={isLoading || !isAllowedToSync}
                    />
                    <span>Fetch all articles (paginated)</span>
                </label>

                {fetchAll && (
                    <label htmlFor="maxPages">
                        <span>Max Pages (optional)</span>
                        <input
                            id="maxPages"
                            type="number"
                            min="1"
                            value={maxPages}
                            onChange={event => setMaxPages(event.target.value)}
                            disabled={isLoading || !isAllowedToSync}
                            placeholder="Leave empty for all pages"
                        />
                    </label>
                )}

                <button type="submit" disabled={isLoading || !isAllowedToSync}>
                    {isLoading ? <div className="framer-spinner" /> : "Continue"}
                </button>

                <button type="button" className="reconfigure-btn" onClick={handleReconfigure} disabled={isLoading}>
                    Disconnect
                </button>
            </form>
        </main>
    )
}
