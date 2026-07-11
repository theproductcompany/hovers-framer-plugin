import { framer } from "framer-plugin"
import { type HoversConfig } from "./hoversApi"

const API_TOKEN_STORAGE_KEY = "hovers_api_token"
const LEGACY_PLUGIN_DATA_API_TOKEN_KEY = "hovers_api_token"

export const HOVERS_BASE_URL = "https://www.hovers.ai"

let migrationPromise: Promise<void> | null = null

async function migrateApiTokenFromPluginData(): Promise<void> {
    const legacyToken = await framer.getPluginData(LEGACY_PLUGIN_DATA_API_TOKEN_KEY)
    if (!legacyToken) {
        return
    }

    if (!localStorage.getItem(API_TOKEN_STORAGE_KEY)) {
        localStorage.setItem(API_TOKEN_STORAGE_KEY, legacyToken as string)
    }

    await framer.setPluginData(LEGACY_PLUGIN_DATA_API_TOKEN_KEY, null)
}

async function ensureApiTokenMigration(): Promise<void> {
    if (!migrationPromise) {
        migrationPromise = migrateApiTokenFromPluginData()
    }

    await migrationPromise
}

export async function saveHoversConfig(config: HoversConfig): Promise<void> {
    await ensureApiTokenMigration()
    localStorage.setItem(API_TOKEN_STORAGE_KEY, config.apiToken)
}

export async function getHoversConfig(): Promise<HoversConfig | null> {
    await ensureApiTokenMigration()

    const apiToken = localStorage.getItem(API_TOKEN_STORAGE_KEY)
    if (!apiToken) {
        return null
    }

    return {
        apiToken,
        baseUrl: HOVERS_BASE_URL,
    }
}

export async function clearHoversConfig(): Promise<void> {
    await ensureApiTokenMigration()
    localStorage.removeItem(API_TOKEN_STORAGE_KEY)
    await framer.setPluginData(LEGACY_PLUGIN_DATA_API_TOKEN_KEY, null)
}
