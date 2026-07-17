interface StartupErrorProps {
    readonly error: unknown
}

export function StartupError({ error }: StartupErrorProps) {
    const message = getStartupErrorMessage(error)

    return (
        <main className="setup">
            <div className="intro">
                <div className="logo-container">
                    <img src="/hovers-logo-light.png" alt="Hovers" className="logo-img logo-img-light" />
                    <img src="/hovers-logo-dark.png" alt="Hovers" className="logo-img logo-img-dark" />
                </div>
                <div className="content">
                    <h2>Unable to Start</h2>
                    <p>The plugin could not open in the current context.</p>
                </div>
            </div>

            <div className="error-message">{message}</div>
            <p className="help-text">
                Open this plugin from a managed CMS collection using Configure or Sync in Framer.
            </p>
        </main>
    )
}

function getStartupErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message
    }

    return "The required managed collection context is unavailable."
}
