# Browser-Use "三棵树"原始获取流程深度剖析

## 1. 获取流程概览

### 1.1 核心函数调用链

```
DomService.get_serialized_dom_tree (Line 776)
    └─> DomService.get_dom_tree (Line 423)
        └─> DomService._get_all_trees (Line 248) ← 数据采集核心
            ├─> DOMSnapshot.captureSnapshot
            ├─> DOM.getDocument  
            ├─> Accessibility.getFullAXTree
            └─> Page.getLayoutMetrics
```

**关键设计思想**（Line 248-421）：

```python
async def _get_all_trees(self, target_id: TargetID) -> TargetAllTrees:
    """
    一次性并发获取四种数据源：
    1. DOMSnapshot - 布局树（Layout Tree）+ 可见性 + CSS
    2. DOM Tree - 完整节点结构（含 iframe/shadow DOM）
    3. AX Tree - 可访问性树（屏幕阅读器视角）
    4. Device Pixel Ratio - 坐标转换系数
    """
```

### 1.2 为什么需要"三棵树"而非单一 HTML？

**对比传统方案的不足：**

| 方案 | 获取内容 | 缺陷 |
|------|---------|------|
| `page.content()` | 原始 HTML 字符串 | ❌ 无布局信息（bounds/visibility）<br>❌ 无动态状态（JS修改的属性）<br>❌ 无可访问性语义 |
| `page.evaluate('outerHTML')` | 当前 DOM | ❌ 无 CSS 计算值<br>❌ 跨域 iframe 无法访问 |
| 只用 DOM Tree | 节点结构 | ❌ 不知道哪些元素可见<br>❌ 不知道元素的屏幕坐标 |

**browser-use 的"三合一"方案优势：**

```python
# Line 193-198: TargetAllTrees 数据结构
@dataclass
class TargetAllTrees:
    snapshot: CaptureSnapshotReturns    # 布局 + 可见性 + CSS
    dom_tree: GetDocumentReturns        # 完整节点结构
    ax_tree: GetFullAXTreeReturns       # 可访问性语义
    device_pixel_ratio: float           # 高DPI屏幕坐标校准
    cdp_timing: dict[str, float]        # 性能监控
```

✅ **三棵树互补关系**：
- **DOM Tree** 提供结构（父子关系、属性、Shadow DOM）
- **Snapshot Tree** 提供布局（边界框、可见性、CSS computed styles）
- **AX Tree** 提供语义（role、name、可操作状态）

---

## 2. CDP 任务清单详解

### 2.1 Task 1: DOMSnapshot.captureSnapshot

**代码位置**（Line 302-312）：

```python
def create_snapshot_request():
    return cdp_session.cdp_client.send.DOMSnapshot.captureSnapshot(
        params={
            'computedStyles': REQUIRED_COMPUTED_STYLES,  # Line 18-30
            'includePaintOrder': True,       # 绘制顺序（遮挡检测）
            'includeDOMRects': True,         # 边界框坐标
            'includeBlendedBackgroundColors': False,  # 节省带宽
            'includeTextColorOpacities': False,       # 节省带宽
        },
        session_id=cdp_session.session_id,
    )
```

**REQUIRED_COMPUTED_STYLES 明细**（enhanced_snapshot.py Line 18-30）：

```python
REQUIRED_COMPUTED_STYLES = [
    'display',           # 是否 display: none
    'visibility',        # 是否 visibility: hidden
    'opacity',           # 透明度（0 表示不可见）
    'overflow',          # 滚动容器检测
    'overflow-x',        # 横向滚动
    'overflow-y',        # 纵向滚动
    'cursor',            # 鼠标指针样式（pointer=可点击）
    'pointer-events',    # 是否响应点击
    'position',          # 定位方式
    'background-color',  # 背景色（透明度检测）
]
```

**返回数据结构**（CaptureSnapshotReturns）：

```typescript
// CDP 原始返回格式
{
  documents: [
    {
      documentURL: "https://example.com",
      nodes: {
        backendNodeId: [101, 102, 103, ...],  // 🔑 关键：节点ID列表
        nodeType: [1, 1, 3, ...],
        nodeName: ["HTML", "BODY", "#text", ...],
        attributes: [[0, 1], [2, 3], ...],  // 索引对（指向strings数组）
        isClickable: {index: [0, 5, 12]},   // 稀疏数组：只存可点击的
      },
      layout: {
        nodeIndex: [0, 1, 2, ...],          // 对应 nodes 的索引
        bounds: [[0,0,100,50], [0,50,100,50], ...],  // 🔑 [x,y,w,h]
        styles: [[0,1,2], [3,4,5], ...],    // 指向 strings 的 CSS 值
        paintOrders: [1, 2, 1, ...],        // 🔑 Z-index 绘制顺序
        clientRects: [...],                 // 视口坐标
        scrollRects: [...],                 // 滚动区域
      }
    }
  ],
  strings: ["html", "body", "none", "block", ...]  // 字符串池
}
```

**关键优势**：
- ✅ 一次性获取**所有可见元素的布局信息**（bounds）
- ✅ 通过 `backendNodeId` 与 DOM Tree 对应
- ✅ 包含 CSS computed styles（比 JS `getComputedStyle` 快 10x）

### 2.2 Task 2: DOM.getDocument

**代码位置**（Line 314-317）：

```python
def create_dom_tree_request():
    return cdp_session.cdp_client.send.DOM.getDocument(
        params={
            'depth': -1,      # 🔑 -1 = 递归获取整个树（无限深度）
            'pierce': True    # 🔑 True = 穿透 Shadow DOM
        },
        session_id=cdp_session.session_id,
    )
```

**返回数据结构**（GetDocumentReturns）：

```typescript
// CDP 原始返回格式
{
  root: {
    nodeId: 1,                    // 节点ID（会话内唯一）
    backendNodeId: 101,           // 🔑 后端节点ID（跨会话稳定）
    nodeType: 9,                  // DOCUMENT_NODE
    nodeName: "#document",
    children: [
      {
        nodeId: 2,
        backendNodeId: 102,
        nodeType: 1,              // ELEMENT_NODE
        nodeName: "HTML",
        attributes: ["lang", "en"],
        children: [...],          // 递归子节点
        shadowRoots: [...],       // 🔑 Shadow DOM 子树
        contentDocument: {...},   // 🔑 iframe 内的文档
      }
    ]
  }
}
```

**关键优势**：
- ✅ `depth: -1` 确保获取**完整树结构**（不遗漏深层节点）
- ✅ `pierce: True` 穿透 **Shadow DOM**（React/Vue 组件可见）
- ✅ 包含 `contentDocument`（iframe 递归结构）
- ✅ 提供 `attributes` 原始值（非 computed）

### 2.3 Task 3: Accessibility.getFullAXTree

**代码位置**（Line 211-246）：

```python
async def _get_ax_tree_for_all_frames(self, target_id: TargetID):
    """递归收集所有 frame 的 AX 树并合并"""
    
    # 1. 获取 frame 树结构
    frame_tree = await cdp_session.cdp_client.send.Page.getFrameTree(...)
    
    # 2. 提取所有 frame ID
    all_frame_ids = collect_all_frame_ids(frame_tree['frameTree'])
    
    # 3. 并发获取每个 frame 的 AX 树
    ax_tree_requests = []
    for frame_id in all_frame_ids:
        ax_tree_request = cdp_session.cdp_client.send.Accessibility.getFullAXTree(
            params={'frameId': frame_id},  # 🔑 指定 frame
            session_id=cdp_session.session_id
        )
        ax_tree_requests.append(ax_tree_request)
    
    # 4. 合并所有 AX 节点
    ax_trees = await asyncio.gather(*ax_tree_requests)
    merged_nodes: list[AXNode] = []
    for ax_tree in ax_trees:
        merged_nodes.extend(ax_tree['nodes'])
    
    return {'nodes': merged_nodes}
```

**返回数据结构**（GetFullAXTreeReturns）：

```typescript
// CDP 原始返回格式（每个 frame 一份）
{
  nodes: [
    {
      nodeId: "ax_1",                // AX 树的节点ID
      backendDOMNodeId: 102,         // 🔑 关联到 DOM Tree
      ignored: false,                // 是否被屏幕阅读器忽略
      role: {value: "button"},       // ARIA role
      name: {value: "Submit"},       // 可访问性名称（屏幕阅读器读出的文本）
      properties: [
        {name: "focusable", value: {value: true}},
        {name: "disabled", value: {value: false}},
        {name: "pressed", value: {value: false}},
      ],
      childIds: ["ax_2", "ax_3"]     // AX 树的子节点
    },
    ...
  ]
}
```

**为什么需要完整 AX 树？**
1. ✅ **语义理解**：`<div onclick="...">` 在 DOM 中只是 div，但 AX 树显示它是 `role=button`
2. ✅ **状态感知**：动态属性如 `aria-pressed`、`aria-expanded` 反映当前状态
3. ✅ **文本提取**：`name` 字段包含元素的"有效文本"（优于纯 textContent）
4. ✅ **交互判断**：`focusable`、`editable` 属性直接指示可操作性

### 2.4 Task 4: Page.getLayoutMetrics

**代码位置**（Line 95-122）：

```python
async def _get_viewport_ratio(self, target_id: TargetID) -> float:
    metrics = await cdp_session.cdp_client.send.Page.getLayoutMetrics(
        session_id=cdp_session.session_id
    )
    
    # 🔑 关键：区分设备像素和 CSS 像素
    visual_viewport = metrics.get('visualViewport', {})
    css_visual_viewport = metrics.get('cssVisualViewport', {})
    
    # 计算 device pixel ratio
    device_width = visual_viewport.get('clientWidth', width)
    css_width = css_visual_viewport.get('clientWidth', width)
    device_pixel_ratio = device_width / css_width if css_width > 0 else 1.0
    
    return float(device_pixel_ratio)
```

**返回数据结构**：

```typescript
{
  visualViewport: {
    clientWidth: 1920,      // 设备像素（物理像素）
    clientHeight: 1080,
    pageX: 0,
    pageY: 0
  },
  cssVisualViewport: {
    clientWidth: 1280,      // CSS 像素（逻辑像素）
    clientHeight: 720
  },
  layoutViewport: {...}
}
```

**关键作用**：
- ✅ **坐标校准**：高DPI屏幕（如 Retina）的 `device_pixel_ratio = 2.0`
- ✅ **bounds 转换**：Snapshot 返回的坐标是设备像素，需除以 ratio 转为 CSS 像素
- ✅ **点击精度**：确保 Agent 点击的坐标与屏幕显示一致

**应用示例**（enhanced_snapshot.py Line 111-121）：

```python
# IMPORTANT: CDP coordinates are in device pixels, convert to CSS pixels
raw_x, raw_y, raw_width, raw_height = bounds[0], bounds[1], bounds[2], bounds[3]

# Apply device pixel ratio scaling
bounding_box = DOMRect(
    x=raw_x / device_pixel_ratio,      # 🔑 设备像素 → CSS 像素
    y=raw_y / device_pixel_ratio,
    width=raw_width / device_pixel_ratio,
    height=raw_height / device_pixel_ratio,
)
```

---

## 3. 异步并发模型分析

### 3.1 并发任务创建（Line 321-327）

```python
# 创建 4 个独立的异步任务
tasks = {
    'snapshot': create_task_with_error_handling(create_snapshot_request(), name='get_snapshot'),
    'dom_tree': create_task_with_error_handling(create_dom_tree_request(), name='get_dom_tree'),
    'ax_tree': create_task_with_error_handling(self._get_ax_tree_for_all_frames(target_id), name='get_ax_tree'),
    'device_pixel_ratio': create_task_with_error_handling(self._get_viewport_ratio(target_id), name='get_viewport_ratio'),
}
```

**create_task_with_error_handling 作用**：
- 捕获单个任务的异常，不影响其他任务
- 提供任务名称用于调试日志

### 3.2 超时控制与重试策略（Line 329-360）

```python
# ===== 第一次尝试：10秒超时 =====
done, pending = await asyncio.wait(tasks.values(), timeout=10.0)

# ===== 重试未完成的任务 =====
if pending:
    # 取消超时的任务
    for task in pending:
        task.cancel()
    
    # 重新创建失败的任务
    retry_map = {
        tasks['snapshot']: lambda: create_task_with_error_handling(
            create_snapshot_request(), name='get_snapshot_retry'
        ),
        # ... 其他任务的重试工厂
    }
    
    # 创建新任务替换失败的
    for key, task in tasks.items():
        if task in pending and task in retry_map:
            tasks[key] = retry_map[task]()
    
    # ===== 第二次尝试：2秒超时 =====
    done2, pending2 = await asyncio.wait(
        [t for t in tasks.values() if not t.done()], 
        timeout=2.0
    )
    
    if pending2:
        for task in pending2:
            task.cancel()
```

**超时策略分析**：
- **首次 10秒**：正常情况下 CDP 调用应在 1-3 秒完成
- **重试 2秒**：如果首次失败，大概率是网络/浏览器问题，快速重试
- **失败即抛异常**：两次尝试都失败则中止，不继续等待

### 3.3 结果提取与错误处理（Line 361-377）

```python
# 提取成功的结果
results = {}
failed = []
for key, task in tasks.items():
    if task.done() and not task.cancelled():
        try:
            results[key] = task.result()
        except Exception as e:
            self.logger.warning(f'CDP request {key} failed with exception: {e}')
            failed.append(key)
    else:
        self.logger.warning(f'CDP request {key} timed out')
        failed.append(key)

# 如果任何必需任务失败，抛出异常
if failed:
    raise TimeoutError(f'CDP requests failed or timed out: {", ".join(failed)}')
```

**错误处理特点**：
- ✅ **All-or-Nothing**：任何一个任务失败，整个 `_get_all_trees` 失败
- ✅ **明确失败原因**：区分超时和异常
- ✅ **不使用默认值**：确保数据完整性

### 3.4 多 Tab/iframe 上下文切换

**Target 级别隔离**（Line 248）：

```python
async def _get_all_trees(self, target_id: TargetID) -> TargetAllTrees:
    # 每个 target_id 对应一个独立的浏览上下文
    cdp_session = await self.browser_session.get_or_create_cdp_session(
        target_id=target_id, 
        focus=False  # 🔑 不切换焦点（避免干扰用户操作）
    )
```

**Frame 级别遍历**（Line 217-228）：

```python
def collect_all_frame_ids(frame_tree_node) -> list[str]:
    """递归收集所有 frame ID"""
    frame_ids = [frame_tree_node['frame']['id']]
    
    # 递归处理子 frame
    if 'childFrames' in frame_tree_node and frame_tree_node['childFrames']:
        for child_frame in frame_tree_node['childFrames']:
            frame_ids.extend(collect_all_frame_ids(child_frame))
    
    return frame_ids
```

**并发 vs 串行**：
- ✅ **4个主任务并发**：DOMSnapshot、DOM、AX、Metrics 同时发起
- ✅ **AX 子任务并发**：所有 frame 的 AX 树同时请求（Line 239）
- ❌ **iframe DOM 串行**：跨域 iframe 的 DOM 树串行递归（service.py Line 735）

---

## 4. 原始数据关联点分析

### 4.1 backendNodeId 作为"通用键"

**在三棵树中的分布：**

| 树类型 | backendNodeId 位置 | 说明 |
|--------|-------------------|------|
| **DOM Tree** | `node.backendNodeId` | 每个节点都有 |
| **Snapshot Tree** | `nodes.backendNodeId[i]` | 数组形式，索引对应 |
| **AX Tree** | `node.backendDOMNodeId` | 🔑 注意：字段名不同！ |

**关联建立过程**（service.py Line 459-472）：

```python
# Step 1: 建立 AX 树索引（Line 460-463）
ax_tree_lookup: dict[int, AXNode] = {
    ax_node['backendDOMNodeId']: ax_node  # 🔑 用 backendDOMNodeId 作 key
    for ax_node in ax_tree['nodes'] 
    if 'backendDOMNodeId' in ax_node
}

# Step 2: 建立 Snapshot 索引（Line 470-471）
snapshot_lookup = build_snapshot_lookup(snapshot, device_pixel_ratio)
# 返回: dict[int, EnhancedSnapshotNode]
#      ↑ key = backendNodeId
```

**build_snapshot_lookup 实现**（enhanced_snapshot.py Line 67-89）：

```python
# 第一层：建立 backendNodeId → snapshot_index 映射
backend_node_to_snapshot_index = {}
if 'backendNodeId' in nodes:
    for i, backend_node_id in enumerate(nodes['backendNodeId']):
        backend_node_to_snapshot_index[backend_node_id] = i
        
# 第二层：建立 snapshot_index → layout_index 映射
layout_index_map = {}
if layout and 'nodeIndex' in layout:
    for layout_idx, node_index in enumerate(layout['nodeIndex']):
        if node_index not in layout_index_map:
            layout_index_map[node_index] = layout_idx

# 第三层：通过两级索引提取布局数据
for backend_node_id, snapshot_index in backend_node_to_snapshot_index.items():
    if snapshot_index in layout_index_map:
        layout_idx = layout_index_map[snapshot_index]
        bounds = layout['bounds'][layout_idx]
        styles = layout['styles'][layout_idx]
        # ...
    
    snapshot_lookup[backend_node_id] = EnhancedSnapshotNode(...)
```

### 4.2 数据合并时机（Line 474-583）

```python
async def _construct_enhanced_node(node: Node, ...) -> EnhancedDOMTreeNode:
    # 🔑 通过 backendNodeId 查询另外两棵树
    ax_node = ax_tree_lookup.get(node['backendNodeId'])        # Line 506
    snapshot_data = snapshot_lookup.get(node['backendNodeId']) # Line 527
    
    # 合并数据
    if ax_node:
        enhanced_ax_node = self._build_enhanced_ax_node(ax_node)
    
    if snapshot_data and snapshot_data.bounds:
        absolute_position = DOMRect(
            x=snapshot_data.bounds.x + total_frame_offset.x,
            y=snapshot_data.bounds.y + total_frame_offset.y,
            ...
        )
    
    # 创建增强节点
    dom_tree_node = EnhancedDOMTreeNode(
        backend_node_id=node['backendNodeId'],
        ax_node=enhanced_ax_node,           # 来自 AX Tree
        snapshot_node=snapshot_data,        # 来自 Snapshot Tree
        absolute_position=absolute_position, # 计算得出
        ...
    )
```

### 4.3 backendNodeId 的生命周期

**稳定性保证**：
- ✅ **会话内唯一**：同一个 CDP 会话中，节点 ID 不变
- ✅ **跨 frame 一致**：主文档和 iframe 中的节点 ID 不冲突
- ❌ **会话间不稳定**：页面刷新后，同一元素的 ID 会变化

**使用场景**：
1. **短期操作**：点击、输入等交互（使用 backendNodeId）
2. **长期记忆**：Agent 历史记录（使用 element_hash，views.py Line 837-863）

### 4.4 原始数据的内存占用估算

以一个中等复杂度页面为例：

```
DOM Tree:     ~500 nodes × 1KB  = 500KB
Snapshot:     ~300 layout × 2KB = 600KB (包含 bounds/styles)
AX Tree:      ~400 nodes × 0.5KB = 200KB
Total:        ~1.3MB 原始 JSON 数据
```

**优化策略**（service.py Line 393-397）：

```python
# 限制 iframe 数量，防止内存爆炸
if original_doc_count > self.max_iframes:
    self.logger.warning(
        f'⚠️ Limiting processing of {original_doc_count} iframes '
        f'to only first {self.max_iframes} to prevent crashes!'
    )
    snapshot['documents'] = snapshot['documents'][:self.max_iframes]
```

---

## 5. 对比总结：为什么不用 Playwright 的高级 API？

| Playwright API | 局限性 | browser-use 方案 |
|----------------|--------|-----------------|
| `page.content()` | 只有 HTML 字符串 | ✅ DOM Tree (完整结构) |
| `locator.boundingBox()` | 每次调用需单独请求 | ✅ Snapshot (批量获取所有 bounds) |
| `locator.getAttribute()` | 只有静态属性 | ✅ AX Tree (动态状态 + ARIA) |
| `page.evaluate(getComputedStyle)` | 需执行 JS，慢且不稳定 | ✅ Snapshot (CDP 直接返回) |
| 无对应 API | - | ✅ Paint Order (检测遮挡) |

**核心优势**：
1. **批量采集**：一次 CDP 调用获取整页元素信息（vs. 逐个查询）
2. **底层数据**：绕过 JS 执行，直接访问浏览器内核状态
3. **语义完整**：结合 DOM 结构 + 布局信息 + 可访问性语义

这就是为什么 browser-use 能实现**亚秒级页面理解**，而传统的 Playwright 脚本需要多次往返通信。