/**
 * 元素类型枚举
 */
export type ElementType = 'input' | 'select-display' | 'text-display' | 'button';

/**
 * 输入框/可提取元素信息结构
 */
export interface InputInfo {
  index: number;
  label: string | null;
  name: string | null;
  id: string | null;
  type: string;
  elementType: ElementType;  // 新增：元素类型
  dataName: string | null;   // 新增：data-name 属性
  xtype: string | null;      // 新增：xtype 属性
  containerPath: string;
  placeholder: string | null;
  buttonText?: string | null;    // 新增：按钮文本
  disabled?: boolean;              // 新增：按钮是否禁用
}

/**
 * 保存的配置结构
 */
export interface SavedConfig {
  index: number;
  label: string | null;
  name: string | null;
  containerSelector: string;
  fallbackName: string | null;
  placeholder: string | null;
  elementType: ElementType;      // 新增：元素类型
  dataName: string | null;       // 新增：data-name 属性
  xtype: string | null;          // 新增：xtype 属性
  buttonText?: string | null;    // 新增：按钮文本
  foundBy?: string;
}

/**
 * 提取结果结构
 */
export interface ExtractResult {
  configIndex: number;
  label: string | null;
  element: HTMLElement;  // 改为 HTMLElement 以支持多种元素类型
  value: string;
  foundBy?: string;
}

/**
 * 消息类型定义
 */
export interface Message {
  type: string;
  payload?: any;
}

/**
 * 复刻页面元素数据
 */
export interface ReplicaElementData {
  configIndex: number;        // 对应 SavedConfig 的索引
  label: string | null;        // 元素标签
  elementType: ElementType;    // 元素类型
  value: string;               // 当前值
  x: number;                   // 位置 X（百分比 0-1）
  y: number;                   // 位置 Y（百分比 0-1）
  width: number;               // 宽度（百分比 0-1）
  height: number;              // 高度（百分比 0-1）
}

/**
 * 内容脚本 API
 */
export interface ContentScriptAPI {
  scanAll(): Promise<InputInfo[]>;
  saveByIndexes(indexes: number[]): Promise<SavedConfig[]>;
  extractByConfig(config: SavedConfig[]): Promise<ExtractResult[]>;
  generateReplicaData(config: SavedConfig[]): Promise<ReplicaElementData[]>;
  highlightByIndex(index: number): Promise<void>;
  highlightByConfigIndex(payload: { configIndex: number; config: SavedConfig }): Promise<void>;
  clearHighlight(): Promise<void>;
}

