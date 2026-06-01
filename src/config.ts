import { framer } from "framer-plugin"
import { type HoversConfig } from "./hoversApi"

const CONFIG_KEYS = {
    API_TOKEN: "hovers_api_token",
} as const

export const HOVERS_BASE_URL = "https://www.hovers.ai"

export async function saveHoversConfig(config: HoversConfig): Promise<void> {
    await framer.setPluginData(CONFIG_KEYS.API_TOKEN, config.apiToken)
}

export async function getHoversConfig(): Promise<HoversConfig | null> {
    const apiToken = await framer.getPluginData(CONFIG_KEYS.API_TOKEN)

    if (!apiToken) {
        return null
    }

    return {
        apiToken: apiToken as string,
        baseUrl: HOVERS_BASE_URL,
    }
}

export async function clearHoversConfig(): Promise<void> {
    await framer.setPluginData(CONFIG_KEYS.API_TOKEN, null)
}
