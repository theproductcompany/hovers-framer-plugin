import { useState } from "react"
import { HoversAPI, HoversAPIError, type HoversConfig } from "./hoversApi"
import { HOVERS_BASE_URL, saveHoversConfig } from "./config"

interface ConfigureHoversProps {
    readonly onConfigured: (config: HoversConfig) => void
}

export function ConfigureHovers({ onConfigured }: ConfigureHoversProps) {
    const [apiToken, setApiToken] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)

        if (!apiToken.trim()) {
            setError("API token is required")
            return
        }

        if (!apiToken.trim().startsWith("hovers_framer_")) {
            setError("Invalid token format. Your token should start with hovers_framer_")
            return
        }

        try {
            setIsLoading(true)

            const config: HoversConfig = {
                apiToken: apiToken.trim(),
                baseUrl: HOVERS_BASE_URL,
            }

            const api = new HoversAPI(config)
            await api.testConnection()
            await saveHoversConfig(config)
            onConfigured(config)
        } catch (err) {
            console.error(err)
            if (err instanceof HoversAPIError) {
                if (err.statusCode === 401 || err.statusCode === 403) {
                    setError("Invalid API token. Please check your token and try again.")
                } else if (err.statusCode === 429) {
                    setError("Rate limit exceeded. Please try again in a moment.")
                } else {
                    setError(`Connection failed: ${err.message}`)
                }
            } else if (err instanceof Error) {
                if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
                    setError("Network error. Please check your internet connection.")
                } else {
                    setError(`Connection failed: ${err.message}`)
                }
            } else {
                setError("Failed to connect. Please check your token and try again.")
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="setup">
            <div className="intro">
                <div className="logo-container">
                    <img src="/hovers-logo-light.png" alt="Hovers" className="logo-img logo-img-light" />
                    <img src="/hovers-logo-dark.png" alt="Hovers" className="logo-img logo-img-dark" />
                </div>
                <div className="content">
                    <h2>Connect to Hovers</h2>
                    <p>Paste your API token from the Hovers dashboard to sync articles into Framer</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {error && <div className="error-message">{error}</div>}

                <label htmlFor="apiToken">
                    <span>API Token</span>
                    <input
                        id="apiToken"
                        type="password"
                        value={apiToken}
                        onChange={event => setApiToken(event.target.value)}
                        placeholder="hovers_framer_..."
                        disabled={isLoading}
                        autoFocus
                        required
                    />
                </label>

                <button type="submit" disabled={isLoading || !apiToken.trim()}>
                    {isLoading ? <div className="framer-spinner" /> : "Connect"}
                </button>

                <p className="help-text">
                    Find your token in{" "}
                    <a href="https://www.hovers.ai/settings/integrations" target="_blank" rel="noreferrer">
                        Hovers → Settings → Integrations
                    </a>
                </p>
            </form>
        </main>
    )
}
