/**
 * Obsidian 同步：Markdown 写入/删除
 * 使用 File System Access API，句柄由侧栏选择后存入 IndexedDB
 */

import type { Episode } from '../shared/memory-types'
import { MEMORY_DB_NAME, MEMORY_DB_VERSION, STORE_OBSIDIAN } from '../shared/memory-db-constants'
import { getObsidianSettings } from './memoryDb'

/** 与 saveObsidianHandle 相同的读法，直接从 IDB 取 default 记录，避免合并时丢失句柄 */
function getObsidianRawFromIDB(): Promise<{ rootDirHandle?: unknown; subDir?: string; frontmatterFormat?: 'yaml' | 'json' } | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEMORY_DB_NAME, MEMORY_DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_OBSIDIAN)) {
        db.close()
        resolve(null)
        return
      }
      const tx = db.transaction(STORE_OBSIDIAN, 'readonly')
      const getReq = tx.objectStore(STORE_OBSIDIAN).get('default')
      getReq.onsuccess = () => {
        db.close()
        resolve(getReq.result ?? null)
      }
      getReq.onerror = () => {
        db.close()
        reject(getReq.error)
      }
    }
  })
}

async function getDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const raw = await getObsidianRawFromIDB()
  const root = raw?.rootDirHandle as FileSystemDirectoryHandle | undefined
  if (!root) return null
  try {
    if (typeof root.requestPermission === 'function') {
      const state = await root.requestPermission({ mode: 'readwrite' })
      if (state !== 'granted') return null
    }
    return root
  } catch {
    return null
  }
}

function getSubDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  return getDirHandle().then(async (root) => {
    if (!root) return null
    try {
      const settings = await getObsidianSettings()
      return await root.getDirectoryHandle(settings.subDir, { create: true })
    } catch {
      return null
    }
  })
}

function episodeToMarkdown(ep: Episode, format: 'yaml' | 'json'): string {
  const fm =
    format === 'yaml'
      ? `---
uid: ${ep.uid}
created_at: "${new Date(ep.createdAt).toISOString()}"
updated_at: "${new Date(ep.lastAccessed).toISOString()}"
weight: ${ep.weight}
pinned: ${ep.pinned}
sync_status: ${ep.syncStatus}
---
# 记忆
${ep.summary ? ep.summary + '\n\n' : ''}${ep.content}
${ep.metadata.source ? `\n> 来源：${ep.metadata.source}` : ''}
${ep.metadata.remark ? `\n> 备注：${ep.metadata.remark}` : ''}
`
      : `---
${JSON.stringify({
  uid: ep.uid,
  created_at: new Date(ep.createdAt).toISOString(),
  updated_at: new Date(ep.lastAccessed).toISOString(),
  weight: ep.weight,
  pinned: ep.pinned,
  sync_status: ep.syncStatus,
}, null, 2)}
---
# 记忆
${ep.summary ? ep.summary + '\n\n' : ''}${ep.content}
${ep.metadata.source ? `\n> 来源：${ep.metadata.source}` : ''}
${ep.metadata.remark ? `\n> 备注：${ep.metadata.remark}` : ''}
`
  return fm
}

/**
 * 将单条记忆写入 Obsidian 库子目录为 .md 文件。
 * 路径：MadokaMemory / 板块 / [子模块] / 可读标题.md 或 MadokaMemory/未分类/可读标题.md
 * @returns 写入后的相对路径 markdownPath，用于后续删除
 */
export async function writeEpisodeToObsidian(ep: Episode): Promise<{ markdownPath: string }> {
  const root = await getSubDirHandle()
  if (!root) {
    throw new Error(
      'Obsidian 写入失败：未选择库目录、权限已过期或句柄无效，请到设置中重新选择 Obsidian 库目录（选好后需保存设置）'
    )
  }
  const settings = await getObsidianSettings()
  const relDir = getEpisodeRelativeDir(ep)
  const dir = await getDirByPath(root, relDir)
  const baseName = getEpisodeBaseFilename(ep)
  const name = await getUniqueFilename(dir, baseName)
  try {
    const file = await dir.getFileHandle(name, { create: true })
    const w = await file.createWritable()
    const body = episodeToMarkdown(ep, settings.frontmatterFormat)
    await w.write(body)
    await w.close()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Obsidian 写入文件失败（${relDir}/${name}）：${msg}`)
  }
  const markdownPath = relDir + '/' + name
  return { markdownPath }
}

export async function runObsidianDeleteForEpisodes(episodes: Episode[]): Promise<void> {
  const root = await getSubDirHandle()
  if (!root) return
  for (const ep of episodes) {
    try {
      const path = ep.markdownPath?.trim() || `${ep.uid}.md`
      if (path.includes('/')) {
        await removeByRelativePath(root, path)
        await removeEmptyParentDirs(root, path)
      } else {
        await root.removeEntry(path)
      }
    } catch {
      /* single file failure does not stop */
    }
  }
}

const DEFAULT_SUB_DIR = 'MadokaMemory'
const UNCLASSIFIED_DIR = '未分类'

/** 路径/文件名非法字符替换为 -， trim，限制长度 */
function sanitizeForPath(s: string, maxLen = 80): string {
  const t = s.replace(/[/\\:*?"<>|]/g, '-').replace(/-+/g, '-').trim()
  return t.slice(0, maxLen) || 'untitled'
}

/** 该条记忆应写入的相对目录（相对于 MadokaMemory）：未分类 | block | block/subBlock */
function getEpisodeRelativeDir(ep: Episode): string {
  const block = ep.block?.trim()
  if (!block) return UNCLASSIFIED_DIR
  const safeBlock = sanitizeForPath(block, 50)
  const sub = ep.subBlock?.trim()
  if (!sub) return safeBlock
  return `${safeBlock}/${sanitizeForPath(sub, 50)}`
}

/** 从 content（用户/助手对话）中取前几句可读文字作为文件名备选 */
function contentToBaseName(content: string, maxLen = 20): string {
  if (!content?.trim()) return ''
  const t = content
    .replace(/^\s*用户\s*:\s*/i, '')
    .replace(/^\s*助手\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const slice = t.slice(0, maxLen)
  return slice.length >= 2 ? slice : ''
}

/** 用于文件名的基底名：shortTitle 优先，否则 summary，否则从 content 抽一句，避免用 uid 当标题 */
function getEpisodeBaseFilename(ep: Episode): string {
  let raw = ep.shortTitle?.trim() || ep.summary?.trim().slice(0, 20) || ''
  if (!raw || /^ep-\d+-[a-z0-9]+$/.test(raw)) {
    raw = contentToBaseName(ep.content, 20) || raw
  }
  if (!raw) raw = ep.uid
  return sanitizeForPath(raw, 50)
}

async function listDirNames(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const [name] of dir.entries()) names.push(name)
  return names
}

async function getUniqueFilename(dir: FileSystemDirectoryHandle, baseName: string): Promise<string> {
  const names = await listDirNames(dir)
  const ext = '.md'
  const base = baseName + ext
  if (!names.includes(base)) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${baseName}-${n}${ext}`
    if (!names.includes(candidate)) return candidate
  }
  return `${baseName}-${Date.now()}${ext}`
}

/** 在 root 下按相对路径取得目录（自动 create） */
async function getDirByPath(
  root: FileSystemDirectoryHandle,
  relativeDir: string
): Promise<FileSystemDirectoryHandle> {
  const parts = relativeDir.split('/').filter(Boolean)
  let dir = root
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true })
  }
  return dir
}

/** 从 MadokaMemory root 删除相对路径文件 */
async function removeByRelativePath(root: FileSystemDirectoryHandle, relativePath: string): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean)
  if (parts.length === 0) return
  const fileName = parts.pop()!
  let dir = root
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p)
  }
  await dir.removeEntry(fileName)
}

/** 只读打开相对目录（不 create），用于列目录判断是否为空 */
async function getDirByPathReadOnly(
  root: FileSystemDirectoryHandle,
  relativeDir: string
): Promise<FileSystemDirectoryHandle | null> {
  const parts = relativeDir.split('/').filter(Boolean)
  if (parts.length === 0) return root
  try {
    let dir = root
    for (const p of parts) {
      dir = await dir.getDirectoryHandle(p)
    }
    return dir
  } catch {
    return null
  }
}

/** 删除文件后自底向上移除空父目录，直到某级非空或到 root */
async function removeEmptyParentDirs(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean)
  if (parts.length <= 1) return
  parts.pop()
  while (parts.length > 0) {
    const dir = await getDirByPathReadOnly(root, parts.join('/'))
    if (!dir) break
    const names = await listDirNames(dir)
    if (names.length > 0) break
    const leaf = parts.pop()!
    const parentParts = parts
    const parentDir =
      parentParts.length === 0 ? root : await getDirByPathReadOnly(root, parentParts.join('/'))
    if (!parentDir) break
    try {
      await parentDir.removeEntry(leaf)
    } catch {
      break
    }
  }
}

/**
 * 用「当前选目录」得到的句柄，一次性写入多条记忆到该库的 MadokaMemory 子目录。
 * 不依赖 IndexedDB 里存的句柄，适合自动同步失败时手动同步。
 * 返回写入成功的条目的 uid 与 markdownPath，便于调用方更新 DB 的同步状态，避免下次重复同步。
 */
export async function writeEpisodesToObsidianWithHandle(
  rootHandle: FileSystemDirectoryHandle,
  episodes: Episode[]
): Promise<{ written: number; failed: number; writtenEntries: { uid: string; markdownPath: string }[] }> {
  const settings = await getObsidianSettings()
  const subDirName = settings.subDir || DEFAULT_SUB_DIR
  const format = settings.frontmatterFormat || 'yaml'
  const root = await rootHandle.getDirectoryHandle(subDirName, { create: true })
  let written = 0
  let failed = 0
  const writtenEntries: { uid: string; markdownPath: string }[] = []
  for (const ep of episodes) {
    try {
      // 若之前用 uid 等写过旧路径，先删掉旧文件，避免留下乱码文件名
      const oldPath = ep.markdownPath?.trim()
      if (oldPath && oldPath.includes('/')) {
        try {
          await removeByRelativePath(root, oldPath)
        } catch {
          /* 旧文件可能已不存在，忽略 */
        }
      } else if (oldPath && /^[^/]+\.md$/.test(oldPath)) {
        try {
          await root.removeEntry(oldPath)
        } catch {
          /* 同上 */
        }
      }
      const relDir = getEpisodeRelativeDir(ep)
      const dir = await getDirByPath(root, relDir)
      const baseName = getEpisodeBaseFilename(ep)
      const name = await getUniqueFilename(dir, baseName)
      const file = await dir.getFileHandle(name, { create: true })
      const w = await file.createWritable()
      await w.write(episodeToMarkdown(ep, format))
      await w.close()
      const markdownPath = relDir === '' ? name : `${relDir}/${name}`
      writtenEntries.push({ uid: ep.uid, markdownPath })
      written += 1
    } catch {
      failed += 1
    }
  }
  return { written, failed, writtenEntries }
}

/**
 * 批量导出到当前已保存的 Obsidian 库（自动导出规则等调用）
 */
export async function runObsidianExport(
  episodes: Episode[],
  _exportPath?: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const raw = await getObsidianRawFromIDB()
    const rootHandle = raw?.rootDirHandle as
      | FileSystemDirectoryHandle
      | undefined
    if (!rootHandle) {
      return { success: false, error: '未设置 Obsidian 目录' }
    }
    const settings = await getObsidianSettings()
    const result = await writeEpisodesToObsidianWithHandle(rootHandle, episodes)
    return {
      success: result.failed === 0,
      path: settings.subDir || 'MadokaMemory',
      error:
        result.failed > 0 ? `${result.failed} 条写入失败` : undefined,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
