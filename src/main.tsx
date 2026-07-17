import "framer-plugin/framer.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { StartupError } from "./StartupError.tsx"
import { PLUGIN_KEYS } from "./data"

async function bootstrap() {
    try {
        framer.showUI({ width: 300, height: 370 })

        const activeCollection = await framer.getActiveManagedCollection()
        const previousSlugFieldId = await loadPreviousSlugFieldId(activeCollection)

        renderApp(activeCollection, previousSlugFieldId)
    } catch (error) {
        console.error("Plugin startup failed:", error)
        renderStartupError(error)
    }
}

async function loadPreviousSlugFieldId(collection: ManagedCollection): Promise<string | null> {
    try {
        return await collection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID)
    } catch (error) {
        console.warn("Could not load previous slug field setting:", error)
        return null
    }
}

function renderApp(collection: ManagedCollection, previousSlugFieldId: string | null) {
    const root = getRootElement()
    if (!root) {
        renderStartupError(new Error("Plugin UI could not be loaded."))
        return
    }

    createRoot(root).render(
        <StrictMode>
            <App collection={collection} previousSlugFieldId={previousSlugFieldId} />
        </StrictMode>
    )
}

function renderStartupError(error: unknown) {
    const root = getRootElement()
    if (!root) {
        console.error("Plugin startup failed and root element is missing:", error)
        return
    }

    createRoot(root).render(
        <StrictMode>
            <StartupError error={error} />
        </StrictMode>
    )
}

function getRootElement(): HTMLElement | null {
    return document.getElementById("root")
}

void bootstrap()
