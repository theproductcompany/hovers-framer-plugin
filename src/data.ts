import {
    type FieldDataInput,
    type ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
} from "framer-plugin"
import { type HoversConfig, HoversAPI, type Article } from "./hoversApi"
import {
    hasManagedCollectionSyncPermissions,
    MANAGED_COLLECTION_PERMISSION_MESSAGE,
    withManagedCollectionOperation,
} from "./permissions"
import { sanitizeHtml } from "./sanitizeHtml"

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

export interface SyncPlan {
    dataSourceId: string
    fields: readonly ManagedCollectionFieldInput[]
    slugField: ManagedCollectionFieldInput
    items: ManagedCollectionItemInput[]
    staleIds: string[]
}

export interface ApplySyncOptions {
    removeMissingItems: boolean
}

export async function getDataSource(dataSourceId: string, options: GetDataSourceOptions): Promise<DataSource> {
    if (dataSourceId !== "articles") {
        throw new Error(`Unknown data source: ${dataSourceId}`)
    }

    const api = new HoversAPI(options.config)

    if (options.saveStatus && options.collection) {
        if (!hasManagedCollectionSyncPermissions()) {
            throw new Error(MANAGED_COLLECTION_PERMISSION_MESSAGE)
        }

        await withManagedCollectionOperation("ManagedCollection.setPluginData", () =>
            options.collection!.setPluginData(
                PLUGIN_KEYS.STATUS_FILTER,
                options.status !== undefined ? options.status : null
            )
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
        body_html: { type: "formattedText", value: sanitizeHtml(article.body_html ?? "") },
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

export async function prepareCollectionSync(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: readonly ManagedCollectionFieldInput[],
    slugField: ManagedCollectionFieldInput
): Promise<SyncPlan> {
    if (!hasManagedCollectionSyncPermissions()) {
        throw new Error(MANAGED_COLLECTION_PERMISSION_MESSAGE)
    }

    const items: ManagedCollectionItemInput[] = []
    const existingItemIds = new Set(
        await withManagedCollectionOperation("ManagedCollection.getItemIds", () => collection.getItemIds())
    )
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
        const itemId = idValue && typeof idValue.value === "string" && idValue.value ? idValue.value : slugValue.value

        seenIds.add(itemId)

        const fieldData: FieldDataInput = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = fields.find(f => f.id === fieldName)
            if (!field) continue
            fieldData[field.id] = value
        }

        items.push({
            id: itemId,
            slug: slugValue.value,
            draft: false,
            fieldData,
        })
    }

    return {
        dataSourceId: dataSource.id,
        fields,
        slugField,
        items,
        staleIds: Array.from(existingItemIds).filter(id => !seenIds.has(id)),
    }
}

export async function applyCollectionSync(
    collection: ManagedCollection,
    plan: SyncPlan,
    options: ApplySyncOptions
): Promise<void> {
    if (!hasManagedCollectionSyncPermissions()) {
        throw new Error(MANAGED_COLLECTION_PERMISSION_MESSAGE)
    }

    await withManagedCollectionOperation("ManagedCollection.setFields", () => collection.setFields([...plan.fields]))

    if (options.removeMissingItems && plan.staleIds.length > 0) {
        await withManagedCollectionOperation("ManagedCollection.removeItems", () =>
            collection.removeItems(plan.staleIds)
        )
    }

    await withManagedCollectionOperation("ManagedCollection.addItems", () => collection.addItems(plan.items))
    await withManagedCollectionOperation("ManagedCollection.setPluginData", () =>
        collection.setPluginData(PLUGIN_KEYS.DATA_SOURCE_ID, plan.dataSourceId)
    )
    await withManagedCollectionOperation("ManagedCollection.setPluginData", () =>
        collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, plan.slugField.id)
    )
}

export async function syncCollection(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: readonly ManagedCollectionFieldInput[],
    slugField: ManagedCollectionFieldInput,
    options: ApplySyncOptions = { removeMissingItems: true }
): Promise<SyncPlan> {
    const plan = await prepareCollectionSync(collection, dataSource, fields, slugField)
    await applyCollectionSync(collection, plan, options)
    return plan
}

export async function prepareExistingCollectionSync(
    collection: ManagedCollection,
    config: HoversConfig
): Promise<SyncPlan | null> {
    if (!hasManagedCollectionSyncPermissions()) {
        throw new Error(MANAGED_COLLECTION_PERMISSION_MESSAGE)
    }

    const [dataSourceId, slugFieldId, savedStatus] = await Promise.all([
        collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID),
        collection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID),
        collection.getPluginData(PLUGIN_KEYS.STATUS_FILTER),
    ])

    if (!dataSourceId || !slugFieldId) {
        return null
    }

    const dataSource = await getDataSource(dataSourceId, {
        config,
        fetchAll: true,
        status: (savedStatus as "draft" | "ready" | "published" | "scheduled") || undefined,
        collection,
    })

    const existingFields = await collection.getFields()
    const fields = mergeFieldsWithExistingFields(dataSource.fields, existingFields)
    const slugField = dataSource.fields.find(f => f.id === slugFieldId)
    if (!slugField) return null

    return prepareCollectionSync(collection, dataSource, fields, slugField)
}

export async function syncExistingCollection(
    collection: ManagedCollection,
    config: HoversConfig,
    options: ApplySyncOptions = { removeMissingItems: true }
): Promise<{ didSync: boolean; staleCount: number }> {
    const plan = await prepareExistingCollectionSync(collection, config)
    if (!plan) {
        return { didSync: false, staleCount: 0 }
    }

    await applyCollectionSync(collection, plan, options)
    return { didSync: true, staleCount: plan.staleIds.length }
}
