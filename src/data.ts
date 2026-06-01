import {
    type FieldDataInput,
    type ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
    type ProtectedMethod,
} from "framer-plugin"
import { type HoversConfig, HoversAPI, type Article } from "./hoversApi"

export const PLUGIN_KEYS = {
    DATA_SOURCE_ID: "dataSourceId",
    SLUG_FIELD_ID: "slugFieldId",
    STATUS_FILTER: "statusFilter",
} as const

export interface DataSource {
    id: string
    fields: readonly ManagedCollectionFieldInput[]
    items: FieldDataInput[]
}

export const dataSourceOptions = [{ id: "articles", name: "Articles" }] as const

export interface GetDataSourceOptions {
    config: HoversConfig
    fetchAll?: boolean
    maxPages?: number
    status?: "draft" | "ready" | "published" | "scheduled"
    abortSignal?: AbortSignal
    saveStatus?: boolean
    collection?: ManagedCollection
}

export async function getDataSource(dataSourceId: string, options: GetDataSourceOptions): Promise<DataSource> {
    if (dataSourceId !== "articles") {
        throw new Error(`Unknown data source: ${dataSourceId}`)
    }

    const api = new HoversAPI(options.config)

    if (options.saveStatus && options.collection) {
        await options.collection.setPluginData(
            PLUGIN_KEYS.STATUS_FILTER,
            options.status !== undefined ? options.status : null
        )
    }

    let articles: Article[]
    if (options.fetchAll) {
        articles = await api.getAllArticles({
            status: options.status,
            maxPages: options.maxPages,
            abortSignal: options.abortSignal,
        })
    } else {
        const response = await api.getArticles({
            page: 1,
            limit: 100,
            status: options.status,
            abortSignal: options.abortSignal,
        })
        articles = response.articles
    }

    const fields: ManagedCollectionFieldInput[] = [
        { id: "id", name: "ID", type: "string" },
        { id: "title", name: "Title", type: "string" },
        { id: "slug", name: "Slug", type: "string" },
        { id: "body_html", name: "Content", type: "formattedText" },
        { id: "excerpt", name: "Excerpt", type: "string" },
        { id: "featured_image", name: "Featured Image", type: "link" },
        { id: "status", name: "Status", type: "string" },
        { id: "created_at", name: "Created At", type: "date" },
        { id: "updated_at", name: "Updated At", type: "date" },
    ]

    const items: FieldDataInput[] = articles.map(article => ({
        id: { type: "string", value: article.id },
        title: { type: "string", value: article.title ?? "" },
        slug: { type: "string", value: article.slug ?? "" },
        body_html: { type: "formattedText", value: article.body_html ?? "" },
        excerpt: { type: "string", value: article.excerpt ?? "" },
        // null featured_image must stay null — empty string is rejected by Framer's link type
        featured_image: { type: "link", value: article.featured_image ?? null },
        status: { type: "string", value: article.status ?? "" },
        created_at: { type: "date", value: article.created_at },
        updated_at: { type: "date", value: article.updated_at ?? article.created_at },
    }))

    return { id: dataSourceId, fields, items }
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly ManagedCollectionFieldInput[],
    existingFields: readonly ManagedCollectionFieldInput[]
): ManagedCollectionFieldInput[] {
    return sourceFields.map(sourceField => {
        const existingField = existingFields.find(f => f.id === sourceField.id)
        return existingField ? { ...sourceField, name: existingField.name } : sourceField
    })
}

export async function syncCollection(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: readonly ManagedCollectionFieldInput[],
    slugField: ManagedCollectionFieldInput
) {
    const items: ManagedCollectionItemInput[] = []

    const existingItemIds = new Set(await collection.getItemIds())
    const seenIds = new Set<string>()

    for (let i = 0; i < dataSource.items.length; i++) {
        const item = dataSource.items[i]
        if (!item) continue

        const slugValue = item[slugField.id]
        if (!slugValue || typeof slugValue.value !== "string" || !slugValue.value) {
            console.warn(`Skipping item at index ${i}: missing or empty slug`)
            continue
        }

        const idValue = item["id"]
        const itemId =
            idValue && typeof idValue.value === "string" && idValue.value
                ? idValue.value
                : slugValue.value

        seenIds.add(itemId)

        const fieldData: FieldDataInput = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = fields.find(f => f.id === fieldName)
            if (!field) continue
            fieldData[field.id] = value
        }

        // All synced items are live — the status filter on the sync screen
        // is the publish gate. Only articles the user chose to sync come in.
        items.push({
            id: itemId,
            slug: slugValue.value,
            draft: false,
            fieldData,
        })
    }

    const staleIds = Array.from(existingItemIds).filter(id => !seenIds.has(id))
    if (staleIds.length > 0) {
        await collection.removeItems(staleIds)
    }

    await collection.addItems(items)
    await collection.setPluginData(PLUGIN_KEYS.DATA_SOURCE_ID, dataSource.id)
    await collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, slugField.id)
}

export const syncMethods = [
    "ManagedCollection.removeItems",
    "ManagedCollection.addItems",
    "ManagedCollection.setPluginData",
] as const satisfies ProtectedMethod[]

export async function syncExistingCollection(collection: ManagedCollection, config: HoversConfig): Promise<{ didSync: boolean }> {
    const [dataSourceId, slugFieldId, savedStatus] = await Promise.all([
        collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID),
        collection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID),
        collection.getPluginData(PLUGIN_KEYS.STATUS_FILTER),
    ])

    if (!dataSourceId || !slugFieldId) {
        return { didSync: false }
    }

    const dataSource = await getDataSource(dataSourceId, {
        config,
        fetchAll: true,
        status: (savedStatus as "draft" | "ready" | "published" | "scheduled") || undefined,
        collection,
    })

    const fields = await collection.getFields()
    const slugField = dataSource.fields.find(f => f.id === slugFieldId)
    if (!slugField) return { didSync: false }

    await collection.setFields(fields)
    await syncCollection(collection, dataSource, fields, slugField)

    return { didSync: true }
}
