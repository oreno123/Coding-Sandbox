# My Skills Collection

这是一个由我个人创建和维护的 Skills 合集，旨在通过结构化的提示词或脚本工具，提升 AI 在特定任务（如文档编写、软件工程作业等）上的表现。

## 已有 Skills

### 📝 [Assignment Writer](./assignment-writer/SKILL.md)

**Assignment Writer** 是一个专为**软件工程学科**和**主观题**设计的作业生成工具。它能够深度解析作业要求，并生成高质量的文字报告。

#### 核心功能
*   **需求解析**：输入形式为 Markdown 格式的作业要求文档。
*   **文字报告生成**：根据作业要求，产出满足标准的完整作业内容。
*   **风格自选**：
    *   **论文体 (Essay Style)**：适合深度分析和综述类题目。
    *   **分点陈述 (Bullet Points)**：适合逻辑清晰、多步骤或多问题的题目。
*   **多格式输出**：
    *   **Markdown**（默认）：方便快速预览和进一步修改。
    *   **LaTeX**：提供完整的 `.tex` 源码，适合需要排版精美的学术提交。

#### 💡 推荐搭配
由于老师提供的作业要求通常是 **PDF 格式**，强烈建议将此 Skill 与 **PDF 解析类 Skill** 搭配使用。先将 PDF 转换为结构化的 Markdown，再交给 **Assignment Writer** 处理，效果最佳。

---

## 项目结构
*   `[assignment-writer/](./assignment-writer/)`: 自动作业助手
    *   `SKILL.md`: Skill 的详细定义与执行规则。
    *   `references/style_guide.md`: 写作规范，确保生成的作业符合特定的文风要求。
