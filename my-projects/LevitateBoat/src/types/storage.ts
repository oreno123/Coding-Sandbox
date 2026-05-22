export interface DBConfig {
  name: string
  version: number
}

export interface Migration {
  version: number
  up: (db: IDBDatabase) => Promise<void>
  down: (db: IDBDatabase) => Promise<void>
}
