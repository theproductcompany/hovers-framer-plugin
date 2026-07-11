import { framer, type ProtectedMethod } from "framer-plugin"

export const MANAGED_COLLECTION_SYNC_METHOD_NAMES = [
    "ManagedCollection.getItemIds",
    "ManagedCollection.removeItems",
    "ManagedCollection.addItems",
    "ManagedCollection.setPluginData",
    "ManagedCollection.setFields",
] as const

const managedCollectionSyncMethods = MANAGED_COLLECTION_SYNC_METHOD_NAMES as unknown as [
    ProtectedMethod,
    ...ProtectedMethod[],
]

export const syncMethods = managedCollectionSyncMethods

export const MANAGED_COLLECTION_PERMISSION_MESSAGE =
    "You don't have permission to sync this CMS collection. Ask a project admin for the required CMS permissions."

export function hasManagedCollectionSyncPermissions(): boolean {
    return framer.isAllowedTo(...managedCollectionSyncMethods)
}

export function getManagedCollectionPermissionError(operation: string): string {
    return `${MANAGED_COLLECTION_PERMISSION_MESSAGE} Failed while calling ${operation}.`
}

export async function withManagedCollectionOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn()
    } catch (error) {
        if (isPermissionError(error)) {
            throw new Error(getManagedCollectionPermissionError(operation))
        }

        throw error
    }
}

function isPermissionError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false
    }

    return /permission|not allowed|insufficient|denied|forbidden|unauthorized/i.test(error.message)
}
