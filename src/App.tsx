import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { type DataSource, PLUGIN_KEYS } from "./data"
import { FieldMapping } from "./FieldMapping"
import { SelectDataSource } from "./SelectDataSource"
import { ConfigureHovers } from "./ConfigureHovers"
import { SyncConfirmation } from "./SyncConfirmation"
import { getHoversConfig } from "./config"
import { type HoversConfig } from "./hoversApi"

interface AppProps {
    collection: ManagedCollection
    previousSlugFieldId: string | null
}

export function App({ collection, previousSlugFieldId }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [hoversConfig, setHoversConfig] = useState<HoversConfig | null>(null)
    const [isLoadingConfig, setIsLoadingConfig] = useState(true)
    const [isCheckingPreviousSync, setIsCheckingPreviousSync] = useState(false)
    const [showSyncConfirmation, setShowSyncConfirmation] = useState(false)
    const [configError, setConfigError] = useState<string | null>(null)

    useEffect(() => {
        getHoversConfig()
            .then(config => {
                setHoversConfig(config)
            })
            .catch(error => {
                console.error("Failed to load Hovers config:", error)
                setConfigError("Could not load your saved Hovers connection. Please connect again.")
            })
            .finally(() => {
                setIsLoadingConfig(false)
            })
    }, [])

    useEffect(() => {
        if (!hoversConfig) {
            setShowSyncConfirmation(false)
            setIsCheckingPreviousSync(false)
            return
        }

        let cancelled = false
        setIsCheckingPreviousSync(true)

        Promise.all([
            collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID),
            collection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID),
        ])
            .then(([dataSourceId, slugFieldId]) => {
                if (!cancelled) {
                    setShowSyncConfirmation(Boolean(dataSourceId && slugFieldId))
                }
            })
            .catch(error => {
                console.error("Failed to check previous sync settings:", error)
                if (!cancelled) {
                    setShowSyncConfirmation(false)
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsCheckingPreviousSync(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [collection, hoversConfig])

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)
        const isOnSyncConfirmation = showSyncConfirmation && !dataSource

        framer.showUI({
            width: hasDataSourceSelected ? 360 : 300,
            height: hasDataSourceSelected ? 425 : isOnSyncConfirmation ? 390 : hoversConfig ? 370 : 360,
            minWidth: hasDataSourceSelected ? 360 : undefined,
            minHeight: hasDataSourceSelected ? 425 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource, hoversConfig, showSyncConfirmation])

    if (isLoadingConfig || (hoversConfig && isCheckingPreviousSync)) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (configError && !hoversConfig) {
        return (
            <main className="setup">
                <div className="error-message">{configError}</div>
                <ConfigureHovers
                    onConfigured={config => {
                        setConfigError(null)
                        setHoversConfig(config)
                    }}
                />
            </main>
        )
    }

    if (!hoversConfig) {
        return <ConfigureHovers onConfigured={setHoversConfig} />
    }

    if (showSyncConfirmation && !dataSource) {
        return (
            <SyncConfirmation
                collection={collection}
                hoversConfig={hoversConfig}
                onChangeSettings={() => setShowSyncConfirmation(false)}
                onReconfigure={() => {
                    setShowSyncConfirmation(false)
                    setHoversConfig(null)
                }}
            />
        )
    }

    if (!dataSource) {
        return (
            <SelectDataSource
                onSelectDataSource={setDataSource}
                hoversConfig={hoversConfig}
                collection={collection}
                onReconfigure={() => setHoversConfig(null)}
            />
        )
    }

    return <FieldMapping collection={collection} dataSource={dataSource} initialSlugFieldId={previousSlugFieldId} />
}
