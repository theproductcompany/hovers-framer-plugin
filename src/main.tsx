import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { PLUGIN_KEYS, syncExistingCollection } from "./data"
import { getHoversConfig } from "./config"

const activeCollection = await framer.getActiveManagedCollection()
const previousSlugFieldId = await activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID)
const config = await getHoversConfig()

// Auto-sync if already configured — no UI needed
if (config) {
    try {
        const { didSync } = await syncExistingCollection(activeCollection, config)
        if (didSync) {
            framer.closePlugin("Synchronization successful", { variant: "success" })
        } else {
            // Configured but first time — show UI to complete setup
            showUI()
        }
    } catch (error) {
        // Auto-sync failed — fall back to UI so user can retry or reconfigure
        console.error("Auto-sync failed:", error)
        framer.notify("Auto-sync failed. Please sync manually.", { variant: "warning" })
        showUI()
    }
} else {
    showUI()
}

function showUI() {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    createRoot(root).render(
        <StrictMode>
            <App collection={activeCollection} previousSlugFieldId={previousSlugFieldId} />
        </StrictMode>
    )
}
