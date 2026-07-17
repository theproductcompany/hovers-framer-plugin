interface RemovalConfirmationProps {
    readonly staleCount: number
    readonly itemCount: number
    readonly isSyncing: boolean
    readonly error: string | null
    readonly onSyncWithRemovals: () => void
    readonly onSyncWithoutRemovals: () => void
    readonly onCancel: () => void
}

export function RemovalConfirmation({
    staleCount,
    itemCount,
    isSyncing,
    error,
    onSyncWithRemovals,
    onSyncWithoutRemovals,
    onCancel,
}: RemovalConfirmationProps) {
    const itemLabel = staleCount === 1 ? "item" : "items"

    return (
        <main className="setup">
            <div className="intro">
                <div className="logo-container">
                    <img src="/hovers-logo-light.png" alt="Hovers" className="logo-img logo-img-light" />
                    <img src="/hovers-logo-dark.png" alt="Hovers" className="logo-img logo-img-dark" />
                </div>
                <div className="content">
                    <h2>Confirm Removals</h2>
                    <p>This sync would delete CMS items that are no longer in Hovers.</p>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="sync-summary warning-summary">
                <p>
                    <strong>{staleCount}</strong> CMS {itemLabel} will be permanently removed from this collection.
                </p>
                <p>
                    {itemCount} article{itemCount === 1 ? "" : "s"} will be created or updated.
                </p>
                <p>Choose whether to remove missing items, or only create and update existing ones.</p>
            </div>

            <div className="sync-actions">
                <button type="button" className="danger-btn" onClick={onSyncWithRemovals} disabled={isSyncing}>
                    {isSyncing ? <div className="framer-spinner" /> : `Remove ${staleCount} ${itemLabel} & Sync`}
                </button>

                <button type="button" onClick={onSyncWithoutRemovals} disabled={isSyncing}>
                    {isSyncing ? <div className="framer-spinner" /> : "Update Only (Keep Missing Items)"}
                </button>

                <button type="button" className="reconfigure-btn" onClick={onCancel} disabled={isSyncing}>
                    Cancel
                </button>
            </div>
        </main>
    )
}
