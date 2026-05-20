# MemMachine 记忆模块架构分析

本文档梳理 MemMachine 项目中与「记忆」相关的核心源码、模块依赖关系，以及各核心类/函数的职责与协同方式。

---

## 1. 核心源码文件（按目录结构）

### 1.1 情节记忆（Episodic Memory）——会话级「事件序列」记忆

```
src/memmachine/
├── episodic_memory/
│   ├── __init__.py                    # 导出 EpisodicMemory
│   ├── episodic_memory.py             # 核心：EpisodicMemory 编排短期+长期
│   ├── episodic_memory_manager.py     # 按 session 管理 EpisodicMemory 实例（缓存、生命周期）
│   ├── service_locator.py             # 从配置组装 EpisodicMemoryParams（短期/长期）
│   ├── instance_lru_cache.py          # EpisodicMemory 实例 LRU 缓存
│   │
│   ├── short_term_memory/             # 短期记忆（Session Memory）
│   │   ├── __init__.py
│   │   ├── short_term_memory.py       # ShortTermMemory + ShortTermMemoryConsolidator
│   │   └── service_locator.py         # ShortTermMemoryParams 从配置构建
│   │
│   ├── long_term_memory/              # 长期记忆（Declarative 门面）
│   │   ├── __init__.py
│   │   ├── long_term_memory.py        # LongTermMemory：Episode ↔ DeclarativeMemory 适配
│   │   └── service_locator.py         # LongTermMemoryParams 从配置构建
│   │
│   └── declarative_memory/            # 声明式记忆（向量图存储上的逻辑层）
│       ├── __init__.py
│       ├── declarative_memory.py      # DeclarativeMemory：Derivative 向量检索 + 重排 + 上下文扩展
│       └── data_types.py             # Episode/Derivative/ContentType 等数据类型
```

### 1.2 语义记忆（Semantic Memory）——按 set_id 的「特征/知识」记忆

```
src/memmachine/
├── semantic_memory/
│   ├── __init__.py
│   ├── semantic_memory.py            # SemanticService：写入/检索/后台摄入
│   ├── semantic_model.py             # SemanticFeature, SemanticCategory, SemanticCommand 等
│   ├── semantic_ingestion.py         # IngestionService：历史 → LLM 抽取 → 特征写入
│   ├── semantic_llm.py              # LLM 特征抽取/合并（llm_feature_update, llm_consolidate_features）
│   ├── semantic_session_manager.py   # 会话层封装（与 API/业务对接）
│   ├── util/
│   │   └── semantic_prompt_template.py
│   ├── config_store/                  # 语义配置（set_id → embedder/llm/categories）
│   │   ├── config_store.py           # SemanticConfigStorage 抽象
│   │   ├── config_store_sqlalchemy.py
│   │   └── caching_semantic_config_storage.py
│   └── storage/                      # 语义存储后端
│       ├── storage_base.py           # SemanticStorage 抽象 + VectorSearchOpts
│       ├── sqlalchemy_pgvector_semantic.py   # PG + pgvector 实现
│       ├── neo4j_semantic_storage.py        # Neo4j 实现
│       └── alembic_pg/               # 数据库迁移
```

### 1.3 公共基础设施（Episode、向量图、Embedder、会话）

```
src/memmachine/common/
├── episode_store/
│   ├── __init__.py
│   ├── episode_model.py              # Episode, EpisodeEntry, EpisodeResponse, EpisodeIdT
│   ├── episode_storage.py            # EpisodeStorage 抽象
│   └── count_caching_episode_storage.py  # 带计数的 Episode 存储实现
│
├── vector_graph_store/               # 情节长期记忆的底层存储（图+向量）
│   ├── __init__.py
│   ├── vector_graph_store.py        # VectorGraphStore 抽象
│   ├── data_types.py                # Node, Edge, OrderedPropertyValue
│   └── neo4j_vector_graph_store.py  # Neo4j 实现
│
├── vector_store/                    # 若存在，多为语义或通用向量检索（本项目中情节长期用 vector_graph_store）
│   └── vector_store.py
│
├── embedder/                        # 文本 → 向量
│   └── openai_embedder.py 等
├── reranker/                        # 检索结果重排（长期记忆检索用）
├── filter/                          # FilterExpr 解析与求值（episode/feature 过滤）
├── configuration/
│   └── episodic_config.py           # EpisodicMemoryConf, ShortTermMemoryConf, LongTermMemoryConf
├── session_manager/                 # 会话元数据与短期记忆持久化
│   ├── session_data_manager.py
│   └── session_data_manager_sql_impl.py
└── resource_manager/                # Embedder / LLM / VectorGraphStore / SessionDataManager 等工厂
```

### 1.4 入口与 API

```
src/memmachine/
├── main/
│   └── memmachine.py                # MemMachine：统一入口，add_episodes / query_search / 语义 CRUD
├── server/
│   └── api_v2/
│       ├── service.py               # API 层调用 MemMachine（add/search/list/delete）
│       └── router.py
```

---

## 2. 模块依赖关系（文字描述）

### 2.1 短期记忆（Episodic Memory — Short-Term）

- **ShortTermMemory**（`short_term_memory/short_term_memory.py`）
  - 内存：进程内 `deque[Episode]`，按 `message_capacity`（字符数）限制容量。
  - 写入：`add_episodes()` 把 Episode 追加到 deque；超容时触发 `_do_evict()`。
  - 驱逐与摘要：`ShortTermMemoryConsolidator` 异步将待驱逐的 episodes 交给 LLM 做摘要，摘要可持久化到 `SessionDataManager`（`save_short_term_memory`），并作为「当前摘要」参与后续检索。
  - 检索：`get_short_term_memory_context()` 在锁内按「当前摘要 + 最近若干条 Episode」返回，支持 `FilterExpr` 过滤。
- **依赖**：`LanguageModel`（摘要）、`SessionDataManager`（可选，持久化摘要）、配置中的 `summary_prompt_*`、`message_capacity`。

**数据流（写入）**：  
API/应用 → MemMachine.add_episodes → EpisodicMemory.add_memory_episodes → ShortTermMemory.add_episodes → deque + 可能触发 Consolidator 摘要。

**数据流（检索）**：  
query → EpisodicMemory.query_memory → ShortTermMemory.get_short_term_memory_context → (episodes, summary)。

### 2.2 长期记忆（Episodic Memory — Long-Term / Vector Graph Store）

- **LongTermMemory**（`long_term_memory/long_term_memory.py`）
  - 门面：把通用 `Episode` 转成 DeclarativeMemory 的 `Episode`（含 `filterable_properties`），再委托给 DeclarativeMemory；检索时把 DeclarativeMemory 的 scored 结果转回通用 `Episode`，并做 `score_threshold` 过滤。
- **DeclarativeMemory**（`declarative_memory/declarative_memory.py`）
  - 存储模型：每个 session 两个集合——`Episode_{session_id}`（原始事件节点）、`Derivative_{session_id}`（派生节点，带向量）；关系 `DERIVED_FROM_{session_id}`：Derivative → Episode。
  - 写入：`add_episodes()` 对每个 Episode 按内容类型做 `_derive_derivatives()`（整条或按句切分），对 Derivative 做 embed → 写入 VectorGraphStore（Episode 节点无向量，Derivative 节点带 embedding），并建立 Derivative→Episode 边。
  - 检索：`search_scored()`：query 向量 → `search_similar_nodes` 在 Derivative 集合上做向量检索 → 通过边找对应 Episode 节点 → 按 `expand_context` 做前后文扩展（`_contextualize_episode`）→ 用 Reranker 对「 Episode 上下文片段」打分 → 合并去重、按时间排序后返回 (score, Episode)。
- **VectorGraphStore**（`common/vector_graph_store/`）
  - 抽象：节点（含可选向量）、边、按向量相似度检索、按关系找相邻节点、按属性/顺序的范围查询。
  - 实现：`Neo4jVectorGraphStore`（Neo4j + 向量索引）。

**依赖链**：  
LongTermMemory → DeclarativeMemory → VectorGraphStore + Embedder + Reranker；DeclarativeMemory 内部用 Embedder 做 ingest_embed / search_embed。

**数据流（写入）**：  
EpisodicMemory.add_memory_episodes → LongTermMemory.add_episodes → DeclarativeMemory.add_episodes → _derive_derivatives + embed → VectorGraphStore.add_nodes / add_edges。

**数据流（检索）**：  
query → LongTermMemory.search_scored → DeclarativeMemory.search_scored → Embedder.search_embed → VectorGraphStore.search_similar_nodes → search_related_nodes（拿 Episode）→ _contextualize_episode → Reranker.score → 合并排序 → 返回 (score, Episode)。

### 2.3 语义记忆（Semantic Memory / 按 set_id 的特征与向量）

- **SemanticService**（`semantic_memory/semantic_memory.py`）
  - 对外：`search(set_ids, query)`（多 set 并行向量检索）、`add_messages`/`add_message_to_sets`、`add_new_feature`、`get_feature`/`get_set_features`、`update_feature`/`delete_*`、set_id 与 category/tag 管理。
  - 检索：按 set_id 取 embedder（可能每 set 不同），对 query 做 search_embed → 各 set 内 `SemanticStorage.get_feature_set(..., vector_search_opts)`。
  - 后台：`_background_ingestion_task()` 周期性找出「未摄入消息数/时间超阈值」的 set_id，交给 `IngestionService.process_set_ids()`。
- **IngestionService**（`semantic_ingestion.py`）
  - 对每个 set_id：从 `SemanticStorage.get_history_messages(..., is_ingested=False)` 取未摄入的 history_id，用 `EpisodeStorage.get_episode()` 取正文，再按 set 的 `SemanticCategory` 用 LLM 做 `llm_feature_update`（生成 SemanticCommand：add/delete），应用到 `SemanticStorage`（add_feature/delete_feature_set 等），最后 `mark_messages_ingested`；可选地做 consolidate（合并冗余特征）。
- **SemanticStorage**（`storage/storage_base.py`）
  - 抽象：feature CRUD、按 filter + 向量检索 `get_feature_set`、history 与 set 的关联、citations、ingestion 状态。
  - 实现：SQLAlchemy+pgvector、Neo4j 等（见 `storage/` 下具体实现）。

**依赖**：  
SemanticService 依赖 SemanticStorage、EpisodeStorage（取历史消息内容）、SemanticConfigStorage（set_id 的 embedder/llm/categories）、ResourceManager（get_embedder / get_language_model）、默认/default_category_retriever。  
IngestionService 依赖 SemanticStorage、EpisodeStorage、ResourceRetriever（按 set_id 拿 embedder/llm/categories）。

**数据流（写入 - 对话历史进语义）**：  
历史先进入 EpisodeStorage（情节侧）；SemanticStorage 记录「某 history_id 属于某 set_id」。后台任务：IngestionService 拉未摄入的 history_id → EpisodeStorage.get_episode → LLM 抽取特征 → SemanticStorage.add_feature（含 embedding） + mark_messages_ingested。

**数据流（检索）**：  
query → SemanticService.search → 各 set_id embedder.search_embed → SemanticStorage.get_feature_set(filter_expr, vector_search_opts) → 返回 SemanticFeature 列表。

### 2.4 记忆检索与写入的核心流程（统一视角）

- **写入（情节）**  
  - API：MemMachine.add_episodes(session_data, episode_entries, target_memories)。  
  - 若含 episodic：解析 session_key → EpisodicMemoryManager.open_episodic_memory(session_key) → EpisodicMemory.add_memory_episodes(episodes)。  
  - add_memory_episodes 并发写入 ShortTermMemory 和 LongTermMemory（若有）；ShortTerm 可能触发摘要；LongTerm 经 DeclarativeMemory 写 VectorGraphStore。

- **写入（语义）**  
  - 先有 Episode 写入（同上），再通过「把 history_id 加入 set_id」的关系（例如 add_message_to_sets）标记为待摄入；实际特征写入由后台 IngestionService + LLM 完成。

- **检索（情节）**  
  - MemMachine.query_search(..., target_memories 含 episodic) → 打开 EpisodicMemory → query_memory(query, limit, expand_context, score_threshold, property_filter) → 并发 ShortTermMemory.get_short_term_memory_context 与 LongTermMemory.search_scored → 去重（以 short 为准）、合并 → 返回 QueryResponse（short_term_memory + long_term_memory）。

- **检索（语义）**  
  - query_search(..., target_memories 含 semantic) → SemanticSessionManager / SemanticService.search(set_ids, query, ...) → 各 set 向量检索并汇总。

- **统一入口**  
  - MemMachine 根据 target_memories 同时调情节与语义两套路径，结果在 API 层拼成 SearchResult（episodic_memory + semantic_memory）。

---

## 3. 核心类/函数职责与协同

### 3.1 情节记忆

| 类/函数 | 职责 | 协同方式 |
|--------|------|----------|
| **EpisodicMemoryManager** | 按 session_key 管理 EpisodicMemory 实例；创建/打开/关闭/删除会话；LRU 缓存与引用计数 | 被 MemMachine 使用；open_episodic_memory / create_episodic_memory 返回 EpisodicMemory |
| **EpisodicMemory** | 单会话记忆编排：并发写入/检索短期与长期，去重与合并结果；提供 formalize_query_with_context | 持有 ShortTermMemory、LongTermMemory；add_memory_episodes 并发写两者；query_memory 并发查两者并去重 |
| **ShortTermMemory** | 进程内近期 Episode 队列 + 容量驱逐 + 异步摘要 | 被 EpisodicMemory 调用 add_episodes / get_short_term_memory_context；摘要由 Consolidator 调 LLM，可选写 SessionDataManager |
| **ShortTermMemoryConsolidator** | 接收待摘要 episodes，后台顺序执行 LLM 摘要并更新当前 summary | 由 ShortTermMemory 在 _do_evict 时调用 summarize()；get_short_term_memory_context 会 wait_until_done 再读 summary |
| **LongTermMemory** | Episode ↔ DeclarativeMemory Episode 的转换；score_threshold；委托 DeclarativeMemory | EpisodicMemory 调用 add_episodes / search_scored；内部转成 DeclarativeMemory 的 Episode 并调 DeclarativeMemory |
| **DeclarativeMemory** | 基于 VectorGraphStore 的声明式记忆：Derivative 向量化、Episode 不向量；检索为「向量找 Derivative → 边找 Episode → 扩展上下文 → Reranker → 合并」 | 被 LongTermMemory 唯一使用；依赖 VectorGraphStore、Embedder、Reranker |
| **VectorGraphStore** | 图+向量存储抽象：节点/边增删、相似节点检索、按关系找邻接、按属性/顺序范围查询 | DeclarativeMemory 唯一写入/查询；实现为 Neo4jVectorGraphStore |
| **EpisodeStorage** | Episode 持久化抽象（按 session 等） | 情节写入由上层写到 ShortTerm/LongTerm，不直接写 EpisodeStorage；语义侧 IngestionService 用其 get_episode 取历史内容 |

### 3.2 语义记忆

| 类/函数 | 职责 | 协同方式 |
|--------|------|----------|
| **SemanticService** | 语义记忆对外门面：检索/增删改特征、set 与 category 管理、后台摄入任务调度 | MemMachine 通过 SemanticSessionManager 或直接拿 SemanticService；start() 启动 _background_ingestion_task |
| **IngestionService** | 对未摄入的 set_id：拉 history → LLM 抽取 → 写 SemanticStorage + mark ingested；可选 consolidate | SemanticService._background_ingestion_task 周期性调 process_set_ids(dirty_sets) |
| **SemanticStorage** | 语义特征与 history-set 关联的存储抽象（向量检索、CRUD、citations、ingestion 状态） | SemanticService 和 IngestionService 都依赖；实现有 SQLAlchemy+pgvector、Neo4j 等 |
| **SemanticConfigStorage** | set_id 的 embedder/llm/categories/disabled_categories 等配置 | SemanticService 的 _set_id_resource / _set_ids_embedders 等依赖 |
| **llm_feature_update / llm_consolidate_features** | 用 LLM 从对话生成 SemanticCommand（add/delete）或合并特征 | IngestionService 在 _process_single_set 中调用 |

### 3.3 配置与资源

| 类/函数 | 职责 | 协同方式 |
|--------|------|----------|
| **episodic_memory_params_from_config** | 从 EpisodicMemoryConf + ResourceManager 组装 EpisodicMemoryParams（ShortTerm/LongTerm 实例） | EpisodicMemoryManager._create_episodic_memory 调用 |
| **short_term_memory_params_from_config** | 从 ShortTermMemoryConf 拉 SessionDataManager、LLM、prompt、message_capacity → ShortTermMemoryParams | 被 episodic_memory_params_from_config 使用 |
| **long_term_memory_params_from_config** | 从 LongTermMemoryConf 拉 VectorGraphStore、Embedder、Reranker → LongTermMemoryParams | 同上 |
| **MemMachine** | 配置解析、ResourceManager 创建、EpisodicMemoryManager 与 Semantic 服务生命周期、add_episodes/query_search/语义 CRUD 的统一入口 | 在 server 层被注入到 app.state，API 通过 get_memmachine 调用 |

---

## 4. 小结

- **短期记忆（Episodic Short-Term）**：单会话、进程内 deque + 容量驱逐 + LLM 摘要，可选持久化摘要；检索为「摘要 + 最近 N 条」。
- **长期记忆（Episodic Long-Term）**：同一会话内 DeclarativeMemory + VectorGraphStore（Neo4j）；Episode 不向量，Derivative 向量化并连到 Episode；检索为向量→图→扩展上下文→Reranker→合并。
- **语义记忆**：按 set_id 的 SemanticFeature 存储与向量检索；写入来自「历史消息 + 后台 LLM 抽取」；检索为多 set 并行向量 search。
- **协同**：EpisodicMemory 同时写/查短期与长期并去重；MemMachine 在 API 层同时支持情节与语义两种 target_memories，并在 query_search 中汇总结果。

以上即 MemMachine 记忆模块的整体架构与依赖关系。
