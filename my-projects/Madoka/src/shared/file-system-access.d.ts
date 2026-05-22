/**
 * File System Access API (minimal typings for Chrome/Edge)
 * 仅用于通过 TypeScript 编译；运行时以浏览器实现为准。
 */

interface FileSystemWritableFileStream {
  write(data: string | ArrayBuffer | ArrayBufferView | Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  entries(): AsyncIterable<[string, FileSystemHandle]>
  values(): AsyncIterable<FileSystemHandle>
  keys(): AsyncIterable<string>
}

interface Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}
