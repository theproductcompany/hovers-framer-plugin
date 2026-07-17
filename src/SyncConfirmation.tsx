import { framer, useIsAllowedTo, type ManagedCollection } from "framer-plugin"
import { useEffect, useState } from "react"
import { applyCollectionSync, PLUGIN_KEYS, prepareExistingCollectionSync, type SyncPlan } from "./data"
import { type HoversConfig } from "./hoversApi"
import { clearHoversConfig } from "./config"
import { RemovalConfirmation } from "./RemovalConfirmation"
import { MANAGED_COLLECTION_PERMISSION_MESSAGE, syncMethods } from "./permissions"

interface SyncConfirmationProps {
    readonly collection: ManagedCollection
    readonly hoversConfig: HoversConfig
    readonly onChangeSettings: () => void
    readonly onReconfigure: () => void
}

const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    ready: "Ready",
    published: "Published",
    scheduled: "Scheduled",
}

export function SyncConfirmation({ collection, hoversConfig, onChangeSettings, onReconfigure }: SyncConfirmationProps) {
    const [savedStatus, setSavedStatus] = useState<string | null>(null)
    const [isLoadingSettings, setIsLoadingSettings] = useState(true)
    const [isPreparing, setIsPreparing] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pendingPlan, setPendingPlan] = useState<SyncPlan | null>(null)
    const isAllowedToSync = useIsAllowedTo(...syncMethods)

    useEffect(() => {
        let cancelled = false

        collection
            .getPluginData(PLUGIN_KEYS.STATUS_FILTER)
            .then(status => {
                if (!cancelled) {
                    setSavedStatus(status)
                }
            })
            .catch(loadError => {
                console.error("Failed to load saved sync settings:", loadError)
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingSettings(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [collection])

    const applyPlan = async (plan: SyncPlan, removeMissingItems: boolean) => {
        try {
            setIsSyncing(true)
            setError(null)
            await applyCollectionSync(collection, plan, { removeMissingItems })
            framer.closePlugin("Synchronization successful", { variant: "success" })
        } catch (syncError) {
            console.error("Sync failed:", syncError)
            const message =
                syncError instanceof Error ? syncError.message : "Sync failed. Please try again or change settings."
            setError(message)
        } finally {
            setIsSyncing(false)
        }
    }

    const handleSync = async () => {
        if (!isAllowedToSync) {
            setError(MANAGED_COLLECTION_PERMISSION_MESSAGE)
            return
        }

        setError(null)

        try {
            setIsPreparing(true)
            const plan = await prepareExistingCollectionSync(collection, hoversConfig)

            if (!plan) {
                setError("Could not sync with the saved settings. Please choose sync options manually.")
                onChangeSettings()
                return
            }

            if (plan.staleIds.length > 0) {
                setPendingPlan(plan)
                return
            }

            await applyPlan(plan, false)
        } catch (syncError) {
            console.error("Sync failed:", syncError)
            const message =
                syncError instanceof Error ? syncError.message : "Sync failed. Please try again or change settings."
            setError(message)
        } finally {
            setIsPreparing(false)
        }
    }

    const handleDisconnect = async () => {
        await clearHoversConfig()
        onReconfigure()
    }

    if (pendingPlan) {
        return (
            <RemovalConfirmation
                staleCount={pendingPlan.staleIds.length}
                itemCount={pendingPlan.items.length}
                isSyncing={isSyncing}
                error={error}
                onSyncWithRemovals={() => void applyPlan(pendingPlan, true)}
                onSyncWithoutRemovals={() => void applyPlan(pendingPlan, false)}
                onCancel={() => {
                    setPendingPlan(null)
                    setError(null)
                }}
            />
        )
    }

    const statusLabel = savedStatus ? (STATUS_LABELS[savedStatus] ?? savedStatus) : "All statuses"
    const isBusy = isPreparing || isSyncing

    return (
        <main className="setup">
            <div className="intro">
                <div className="logo-container">
                    <img src="/hovers-logo-light.png" alt="Hovers" className="logo-img logo-img-light" />
                    <img src="/hovers-logo-dark.png" alt="Hovers" className="logo-img logo-img-dark" />
                </div>
                <div className="content">
                    <h2>Sync Articles</h2>
                    <p>Your Hovers connection is ready. Confirm before syncing this collection.</p>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {!isAllowedToSync && <div className="error-message">{MANAGED_COLLECTION_PERMISSION_MESSAGE}</div>}

            <div className="sync-summary">
                <p>
                    <strong>Status filter:</strong> {isLoadingSettings ? "Loading..." : statusLabel}
                </p>
                <p>This will update articles in the current managed collection using your saved settings.</p>
                <p>If any CMS items are missing from Hovers, you will be asked to confirm before they are removed.</p>
            </div>

            <div className="sync-actions">
                <button type="button" onClick={handleSync} disabled={isBusy || !isAllowedToSync || isLoadingSettings}>
                    {isBusy ? <div className="framer-spinner" /> : "Sync Now"}
                </button>

                <button type="button" className="reconfigure-btn" onClick={onChangeSettings} disabled={isBusy}>
                    Change Settings
                </button>

                <button type="button" className="reconfigure-btn" onClick={handleDisconnect} disabled={isBusy}>
                    Disconnect
                </button>
            </div>
        </main>
    )
}
