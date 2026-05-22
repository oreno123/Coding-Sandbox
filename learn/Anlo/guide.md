# 🎯 Anlo 页面结构化工具 - 核心技术原理文档

本文档阐述 Anlo 插件的核心技术原理，重点解释如何在动态网页中实现稳定的元素定位和数据提取。

---

## 📌 核心问题：为什么传统选择器会失效？

### 问题场景

许多现代网页使用前端框架（React、Vue、Angular、jqx 等）动态生成 DOM 元素，导致：

**1. 动态 ID 生成**
```html
<!-- 刷新前 -->
<input id="jqxWidgetd6e0a20d" name="ZRS" />

<!-- 刷新后（ID 变了！） -->
<input id="jqxWidget8f3a192c" name="ZRS" />
```

**2. 动态 Class 生成**
```html
<!-- 框架生成的随机 class -->
<div class="css-1n7v3ny-control css-15m2sg2">
  <input />
</div>
```

**3. DOM 结构重新渲染**
- 异步数据加载后整个表单重新生成
- 框架 diff 算法导致节点替换
- 条件渲染导致元素顺序变化

### 传统方案的局限性

❌ **直接 ID 选择器**：`#jqxWidgetd6e0a20d` → 刷新后失效  
❌ **动态 Class**：`.css-1n7v3ny-control` → 不稳定  
❌ **绝对路径**：`body > div:nth-child(2) > form:nth-child(3)` → 结构变化就失效

---

## 🔑 核心技术 1：容器选择器策略

### 原理

**即使可提取元素（输入框、文本框、显示元素等）本身的属性会变化，但它的父容器结构往往是稳定的。**

### 实际案例

```html
<!-- 这个结构在页面刷新后通常不变 -->
<div class="bh-form-group bh-required">
  <label class="bh-form-label" title="总人数">总人数</label>
  <div class="bh-ph-8 bh-form-readonly-input" emap-role="input-wrap">
    <!-- ❌ 输入框的 id/class 可能变化 -->
    <input class="bh-form-control jqx-input jqxWidget123abc" 
           id="jqxWidgetXXXX" 
           name="ZRS" 
           type="text">
  </div>
</div>
```

### 定位思路

1. **找到稳定的容器**（如 `.bh-form-group`）
2. **在容器内查找输入框**（而不是直接定位输入框）
3. **结合 label 语义验证**（确保找到的是正确的输入框）

### 容器查找优先级

Anlo 按以下顺序查找容器：

```
1. [data-name] 属性容器     ← 最稳定
2. [data-field] 属性容器
3. [data-caption] 属性容器
4. .bh-form-group 类容器    ← 业务系统常用
5. 包含 "form" 的类容器
6. 包含 "field" 的类容器
7. 直接父元素               ← 最后手段
```

---

## 🔑 核心技术 2：稳定选择器生成算法

### 生成策略

从目标元素向上遍历 DOM 树，构建一条**尽可能稳定**的选择器链。

### 选择器优先级（从高到低）

#### 1️⃣ **稳定 ID**（最优）

```typescript
// ✅ 稳定的 ID
#userForm
#mainContainer

// ❌ 动态 ID（排除）
#jqxWidgetd6e0a20d    // 包含 jqx
#random12345          // 包含 random
#widget1234567890     // 包含长数字
```

**排除规则**：正则匹配 `/jqx|random|dynamic|\d{6,}/i`

#### 2️⃣ **稳定 Class**

```typescript
// ✅ 稳定的 class
.bh-form-group
.user-input-wrapper

// ❌ 动态 class（排除）
.css-1n7v3ny-control  // CSS-in-JS 生成
.jqx-widget-content   // jqx 框架
.random-abc123        // 包含 random
```

**过滤策略**：
- 排除包含 `jqx`、`random`、`dynamic` 的 class
- 排除包含长数字串（5位以上）的 class
- 最多取前 2 个稳定 class

#### 3️⃣ **语义属性**（关键！）

```html
<!-- 这些属性通常是开发者定义的，非常稳定 -->
<div data-name="userInfo">
<div data-field="totalCount">
<div data-caption="总人数">
<div emap-role="input-wrap">
<div data-role="form-control">
```

**优先属性列表**：
```typescript
['data-name', 'data-field', 'data-caption', 'emap-role', 'data-role']
```

#### 4️⃣ **nth-child 定位**（兜底）

```typescript
// 只在有相同兄弟元素时添加
div.form-item:nth-child(3)
```

**判断逻辑**：
- 检查父元素下是否有多个相同选择器的元素
- 如果有，则添加 `:nth-child(n)` 进行区分

### 生成示例

**假设 DOM 结构：**
```html
<div class="page-container">
  <div class="bh-form-group" data-field="ZRS">
    <label class="bh-form-label">总人数</label>
    <div emap-role="input-wrap">
      <input class="jqx-widget123" id="jqxWidgetXXXX" name="ZRS">
    </div>
  </div>
</div>
```

**生成的容器选择器：**
```css
div.bh-form-group[data-field="ZRS"]
```

**为什么稳定？**
- ✅ `div` 标签不变
- ✅ `.bh-form-group` 是业务系统的标准 class
- ✅ `[data-field="ZRS"]` 是开发者定义的语义属性
- ✅ 这个组合在页面刷新后仍然存在

---

## 🔑 核心技术 3：多层次提取策略

### 为什么需要多层次？

即使容器选择器设计得很稳定，也可能因为：
- 页面结构改版
- 框架升级
- CSS 类名重构

导致选择器失效。因此需要**多重保险机制**。

### 提取策略（按优先级）

#### 🥇 策略 1：容器选择器 + Label 验证（最可靠）

```typescript
// 1. 通过容器选择器找到容器
const container = document.querySelector('div.bh-form-group[data-field="ZRS"]');

// 2. 在容器内找到 input
const input = container.querySelector('input');

// 3. 验证 label 是否匹配
const label = container.querySelector('.bh-form-label');
if (label.textContent.trim() === '总人数') {
  // ✅ 确认找到正确的输入框
}
```

**优点**：
- 结构稳定性 + 语义验证
- 即使有多个相同 name 的输入框也能区分

#### 🥈 策略 2：Name 属性 + Label 验证（备选）

```typescript
// 1. 通过 name 属性找到候选输入框
const candidates = document.querySelectorAll('input[name="ZRS"]');

// 2. 遍历候选，找到 label 匹配的
for (const input of candidates) {
  const container = input.closest('.bh-form-group');
  const label = container?.querySelector('.bh-form-label');
  if (label?.textContent.trim() === '总人数') {
    // ✅ 通过 label 确认这是正确的输入框
  }
}
```

**适用场景**：
- 容器选择器失效时
- name 属性相对稳定的表单

#### 🥉 策略 3：Placeholder 匹配（最后手段）

```typescript
// 通过 placeholder 查找
const input = document.querySelector('input[placeholder="请输入总人数"]');
```

**局限性**：
- placeholder 可能变化（多语言、文案调整）
- 不够精确

### 提取流程图

```
输入：SavedConfig { containerSelector, label, name, placeholder }
  ↓
尝试 1：容器选择器 + label 验证
  ↓ 失败
尝试 2：name 属性 + label 验证
  ↓ 失败
尝试 3：placeholder 匹配
  ↓ 失败
返回：未找到
```

---

## 🔑 核心技术 4：语义信息辅助定位

### Label 的重要性

**Label 文本通常是最稳定的**，因为：
- 它是给用户看的，轻易不会改
- 即使底层 DOM 结构变化，label 文本也不变
- 可以用来验证是否找到了正确的输入框

### 实际案例

**场景**：页面有多个 `input[name="count"]`

```html
<!-- 输入框 1 -->
<div class="bh-form-group">
  <label>总人数</label>
  <input name="count" />
</div>

<!-- 输入框 2 -->
<div class="bh-form-group">
  <label>完成人数</label>
  <input name="count" />
</div>
```

**通过 label 区分**：

```typescript
// ✅ 精确定位到"总人数"输入框
const targetInput = Array.from(document.querySelectorAll('input[name="count"]'))
  .find(input => {
    const label = input.closest('.bh-form-group')?.querySelector('label');
    return label?.textContent.trim() === '总人数';
  });
```

### 保存的元数据

```typescript
interface SavedConfig {
  containerSelector: string;  // 容器选择器
  label: string | null;       // ⭐ 用于验证
  name: string | null;        // 备选方案
  placeholder: string | null; // 最后手段
}
```

---

## 🎯 完整工作流程

### 阶段 1：扫描（Scan）

```
用户点击"扫描" 
  ↓
1. 查找所有可见输入框
   querySelectorAll('input:not([type="hidden"])...')
  ↓
2. 对每个输入框：
   a. 向上查找稳定容器
   b. 生成容器选择器
   c. 提取 label/name/placeholder
   d. 高亮显示 + 编号
  ↓
3. 返回 InputInfo[]
```

### 阶段 2：保存（Save）

```
用户选择需要的输入框，点击"保存配置"
  ↓
1. 根据选中的索引过滤 InputInfo
  ↓
2. 构建 SavedConfig[] 
   - containerSelector: 生成的稳定选择器
   - label: 用于验证
   - name: 备选方案
   - placeholder: 最后手段
  ↓
3. 存储到 localStorage/Storage API
```

### 阶段 3：提取（Extract）

```
页面刷新后，用户点击"提取"
  ↓
读取 SavedConfig[]
  ↓
对每个配置：
  ├─ 尝试 1：容器选择器 + label 验证 ✅
  ├─ 尝试 2：name 属性 + label 验证
  └─ 尝试 3：placeholder 匹配
  ↓
高亮找到的输入框，标记 ✓
  ↓
返回 ExtractResult[]
```

---

## 💡 关键技术要点总结

### 1. 向上查找容器，而非直接定位输入框
- ❌ 直接定位：`#jqxWidgetXXXX` → 不稳定
- ✅ 容器定位：`div.bh-form-group[data-field="ZRS"] > input` → 稳定

### 2. 选择器生成要智能过滤
- 排除动态 ID/Class
- 优先使用语义属性（`data-*`）
- 按需添加 `nth-child`

### 3. 多层次备选机制
- 主策略：容器选择器
- 备选 1：name 属性
- 备选 2：placeholder
- 关键：都要结合 label 验证

### 4. 语义信息是核心
- Label 文本最稳定
- 用于验证是否找到正确元素
- 可区分相同 name/class 的输入框

### 5. 容错与降级
- 选择器失效时自动尝试下一个策略
- 日志记录每个输入框的查找方式
- 失败时提示具体原因

---

## 🔑 核心技术 5：固定定位覆盖层（Overlay）方案

### 为什么使用 Overlay？

传统方案直接修改元素样式（`outline`、`box-shadow`）存在问题：
- ❌ 对于 `display: none` 的元素无法显示高亮
- ❌ 元素被其他层遮挡时，高亮可能看不见
- ⚠️ 修改元素样式可能影响页面布局

**Overlay 方案**使用独立的覆盖层，完美解决这些问题！

### 技术原理

#### 1️⃣ 固定定位 + 最高层级

```typescript
overlay.style.cssText = `
  position: fixed;              // 相对于视口固定定位
  z-index: 2147483647;          // 最大 z-index，确保在最上层
  pointer-events: none;         // 不响应鼠标事件，不阻挡操作
  user-select: none;            // 不可选择
`;
```

**优势**：
- `position: fixed` - 不受页面滚动和 DOM 层级影响
- `z-index: 2147483647` - 总在最上层，不被遮挡
- `pointer-events: none` - 不干扰用户操作

#### 2️⃣ 精确定位

```typescript
const rect = element.getBoundingClientRect();
overlay.style.left = `${rect.left}px`;
overlay.style.top = `${rect.top}px`;
overlay.style.width = `${rect.width}px`;
overlay.style.height = `${rect.height}px`;
```

**工作原理**：
- `getBoundingClientRect()` 获取元素相对于视口的精确位置
- 即使元素被遮挡、在 iframe 中、或有复杂的 transform，都能准确定位

#### 3️⃣ 处理隐藏元素

```typescript
// 检测元素是否可见
if (rect.width === 0 && rect.height === 0) {
  // 查找关联的可见元素（如 contenteditable div）
  const visibleElement = findVisibleRelatedElement(element);
  if (visibleElement) {
    rect = visibleElement.getBoundingClientRect();
  }
}
```

**应用场景**：
- GPT 等应用的隐藏 textarea
- ProseMirror 等富文本编辑器
- 自定义组件的隐藏原生控件

#### 4️⃣ 实时跟踪

```typescript
// 监听滚动和窗口调整
window.addEventListener('scroll', updatePositions, true);
window.addEventListener('resize', updatePositions);

function updatePositions() {
  overlays.forEach((overlay, element) => {
    const rect = element.getBoundingClientRect();
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
  });
}
```

**优势**：
- 使用捕获阶段（`true`）监听，捕获所有滚动容器
- 页面滚动或窗口调整时，overlay 实时跟随

#### 5️⃣ 完全隔离

```typescript
// ✅ 添加特殊标识
overlay.setAttribute('data-anlo-overlay', 'true');

// ✅ 直接挂在 body 下
document.body.appendChild(overlay);

// ✅ 扫描时排除
const elements = document.querySelectorAll(`
  input:not([data-anlo-overlay]),
  textarea:not([data-anlo-overlay])
`);
```

**隔离策略**：
1. **标识隔离** - `data-anlo-overlay` 属性
2. **位置隔离** - 直接挂 body，不干扰原始 DOM
3. **扫描排除** - `:not([data-anlo-overlay])`
4. **属性隔离** - 不使用业务属性（data-name 等）
5. **事件隔离** - `pointer-events: none`

### 对比分析

| 特性 | 直接修改样式 | Overlay 方案 |
|------|------------|-------------|
| 隐藏元素 | ❌ 无法显示 | ✅ 可以显示（找关联元素） |
| 被遮挡元素 | ⚠️ 可能看不见 | ✅ 总在最上层 |
| 影响页面 | ⚠️ 修改元素样式 | ✅ 完全隔离 |
| 选择器稳定性 | ✅ 不影响 | ✅ 不影响 |
| 支持滚动跟踪 | ⚠️ 需要额外处理 | ✅ 自动跟踪 |
| 性能 | 好 | 好 |

### 实现细节

Anlo 的 Overlay 实现位于 `src/utils/overlay-manager.ts`：

```typescript
class OverlayManager {
  createOverlay(id: string, element: HTMLElement, options: {
    color: string;
    label?: string;
  }): HTMLDivElement | null;
  
  updateOverlayColor(id: string, color: string): void;
  removeOverlay(id: string): void;
  clearAll(): void;
  destroy(): void;
}
```

**核心特性**：
- 支持多个 overlay 同时管理
- 自动处理隐藏元素
- 自动滚动跟踪
- 完整的生命周期管理
- ✨ **呼吸灯脉冲动画**（60fps 流畅动画）

#### 6️⃣ 呼吸灯脉冲动画

为了提升视觉吸引力，Anlo 为 overlay 添加了优雅的呼吸灯效果：

**动画特性**：
```typescript
// 正弦波计算脉冲强度
const intensity = Math.sin(progress * Math.PI * 2);
const blur = 10 + 10 * Math.abs(intensity);      // 10-20px 阴影变化
const alpha = 0.5 + 0.3 * Math.abs(intensity);   // 0.5-0.8 透明度变化
```

**参数设置**：
- **周期**：2000ms（2秒一个循环）
- **阴影范围**：10-20px（正弦波动，适中不刺眼）
- **透明度范围**：50%-80%（随阴影同步变化）
- **帧率**：60fps（使用 `requestAnimationFrame`）
- **颜色**：跟随状态色（蓝/绿/橙）

**视觉效果**：
- 🔵 **扫描状态**：蓝色脉冲 (#00bfff)
- 🟢 **已保存**：绿色脉冲 (#4caf50)
- 🟠 **提取结果**：橙色脉冲 (#ff9800)

**智能性能优化**：
```typescript
// 根据 overlay 数量自动调整
if (overlayCount <= 20) {
  // ✅ 少量元素：启用呼吸灯动画
  startPulseAnimation(id, overlay, color);
} else {
  // ⚠️ 大量元素：使用静态加强阴影（避免性能问题）
  overlay.style.boxShadow = `0 0 20px ${color}`;
}
```

**优势**：
- ✅ 非常醒目，用户一眼就能看到高亮元素
- ✅ 正弦波变化自然流畅，不会突兀
- ✅ 智能降级，大量元素时不影响性能
- ✅ 完整的动画生命周期管理（自动清理）

---

## 🎨 支持的元素类型

### 1️⃣ Input 元素（可编辑）
```html
<!-- 文本输入框 -->
<input type="text" name="username" />

<!-- 数字输入框 -->
<input type="number" name="age" />

<!-- 日期选择器 -->
<input type="date" name="birthday" />
```
**提取方式**：`element.value`

### 2️⃣ Textarea 元素（多行文本）
```html
<!-- 文本域 -->
<textarea name="description" placeholder="请输入描述">
  这是一段文本
</textarea>
```
**提取方式**：`element.value`

### 3️⃣ Button 元素（按钮）
```html
<!-- 原生按钮 -->
<button type="submit">提交</button>

<!-- Input 按钮 -->
<input type="button" value="取消" />

<!-- 链接按钮 -->
<a class="bh-btn" data-action="提交">提交</a>
```
**提取方式**：`element.textContent` 或 `element.value`  
**特点**：支持 `<button>`、`<input type="button/submit/reset">` 和按钮样式的 `<a>` 标签，通过 buttonText 精确区分

### 4️⃣ Select-Display 元素（选择框显示值）
```html
<!-- jqx/自定义框架的选择框显示 -->
<p xtype="select" 
   data-name="JYDWDM" 
   class="bh-form-static">
   数学学院
</p>
```
**提取方式**：`element.textContent`  
**特点**：显示用户选择的结果，值可能变化

### 5️⃣ Text-Display 元素（文本显示）
```html
<!-- 只读文本显示 -->
<span data-name="userName">张三</span>
<div data-name="totalCount">42</div>
```
**提取方式**：`element.textContent`  
**特点**：纯文本信息展示

---

## 🖼️ 复刻页面预览

### 原理

提取元素后，在 sidepanel 中生成页面的可视化复刻预览，使用响应式百分比布局展示所有配置的元素。

### 特性

- **可视化布局**：根据元素在真实页面中的位置生成预览
- **点击交互**：点击预览中的元素，真实页面对应元素高亮（红色框）
- **响应式缩放**：支持 50%、75%、100%、自适应等缩放比例
- **颜色区分**：不同元素类型使用不同颜色
  - 📝 Input（蓝色）
  - 🔘 Button（橙色）
  - 📋 Select-display（绿色）
  - 📄 Text-display（紫色）

### 工作流程

```
提取元素 → 生成预览数据（在 content script 中计算位置）
  ↓
传递到 sidepanel → 渲染复刻页面
  ↓
点击预览元素 → 传入配置和索引到 content script
  ↓
查找并高亮真实页面元素（红色框，持续2秒）
```

---

## 🔧 适用场景

✅ **动态 ID 生成的表单**（jqx、EasyUI 等）  
✅ **前端框架渲染的页面**（React、Vue 等）  
✅ **重复刷新后需要重新定位的场景**  
✅ **多个相同 name 的输入框需要区分**  
✅ **页面结构经常变化的"烂网页"**  
✅ **需要提取只读显示元素的值**（select-display、text-display）  
✅ **同一容器内多个相同类型的按钮区分**（通过 buttonText 精确匹配）  
✅ **可视化页面布局管理**（复刻页面预览）  

---

## 📚 延伸阅读

- **CSS 选择器稳定性**：为什么 `data-*` 属性比 class 更稳定
- **DOM 遍历策略**：`.closest()` vs `.querySelector()`
- **选择器性能优化**：如何减少查询次数
- **MutationObserver**：监听 DOM 变化自动重新定位

---

**Made with 🧠 for dynamic web automation**

*Anlo - 页面结构化工具，让动态网页的数据提取和自动化变得可靠*