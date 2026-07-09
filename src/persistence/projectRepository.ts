import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ProjectRecord, RawSource } from '../domain/projectTypes'

export const RAW_PERSISTENCE_LIMIT_BYTES = 10 * 1024 * 1024
export const RAW_WARNING_LIMIT_BYTES = 100 * 1024 * 1024

type JsonHunterDb = DBSchema & {
  projects: {
    key: string
    value: ProjectRecord
    indexes: {
      'by-updated': number
    }
  }
}

export function getRawSizeBytes(rawJsonText: string): number {
  return new TextEncoder().encode(rawJsonText).byteLength
}

export function shouldPersistRawText(source: RawSource, rawJsonText: string): boolean {
  if (source.type === 'url') return false
  return getRawSizeBytes(rawJsonText) <= RAW_PERSISTENCE_LIMIT_BYTES
}

export function sanitizeProjectForPersistence(project: ProjectRecord): ProjectRecord {
  const { rawJsonText, ...projectWithoutRawText } = project
  const shouldPersistRaw = shouldPersistRawText(project.rawSource, rawJsonText ?? '')

  return {
    ...projectWithoutRawText,
    ...(shouldPersistRaw && rawJsonText !== undefined ? { rawJsonText } : {}),
  }
}

export class ProjectRepository {
  private dbPromise: Promise<IDBPDatabase<JsonHunterDb>>

  constructor(dbName = 'jsonhunter') {
    this.dbPromise = openDB<JsonHunterDb>(dbName, 1, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('by-updated', 'updatedAt')
      },
    })
  }

  async listProjects(): Promise<ProjectRecord[]> {
    const db = await this.dbPromise
    const projects = await db.getAllFromIndex('projects', 'by-updated')
    return projects.reverse()
  }

  async getProject(id: string): Promise<ProjectRecord | undefined> {
    const db = await this.dbPromise
    return db.get('projects', id)
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    const db = await this.dbPromise
    const persistedProject = {
      ...sanitizeProjectForPersistence(project),
      updatedAt: Date.now(),
    }

    await db.put('projects', persistedProject)
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.dbPromise
    await db.delete('projects', id)
  }
}
