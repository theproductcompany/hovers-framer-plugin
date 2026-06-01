import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { type DataSource } from "./data"
import { FieldMapping } from "./FieldMapping"
import { SelectDataSource } from "./SelectDataSource"
import { ConfigureHovers } from "./ConfigureHovers"
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

    // Load Hovers config on mount
    useEffect(() => {
        getHoversConfig()
            .then(config => {
                setHoversConfig(config)
            })
            .catch(error => {
                console.error("Failed to load Hovers config:", error)
            })
            .finally(() => {
                setIsLoadingConfig(false)
            })
    }, [])

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        framer.showUI({
            width: hasDataSourceSelected ? 360 : 300,
            height: hasDataSourceSelected ? 425 : hoversConfig ? 370 : 360,
            minWidth: hasDataSourceSelected ? 360 : undefined,
            minHeight: hasDataSourceSelected ? 425 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource, hoversConfig])

    // Don't auto-load data source - let user choose status filter each time
    // This allows users to change the status filter on each sync

    if (isLoadingConfig) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (!hoversConfig) {
        return <ConfigureHovers onConfigured={setHoversConfig} />
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
