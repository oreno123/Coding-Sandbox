# AI Hedge Fund 源码深度拆解

> 项目地址：https://github.com/virattt/ai-hedge-fund
> 本文档对项目架构、计算逻辑、权重分配、信号合成、回测引擎做完整拆解。
> 仅供学习参考，不构成任何投资建议。

---

## 一、整体架构

```
                    ┌─────────────┐
                    │  start_node │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │ fan-out: 所有分析师并行执行       │
          ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ 巴菲特   │    │ 林奇     │    │ 技术面   │  ... ×18
   │ Agent    │    │ Agent    │    │ Agent    │
   └────┬─────┘    └────┬─────┘    └────┬─────┘
        │               │               │
        └───────────────┼───────────────┘
                        │ fan-in: 等所有完成
                        ▼
                 ┌──────────────┐
                 │ 风险管理Agent │  纯代码，计算仓位上限
                 └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ 组合经理Agent │  LLM 做最终 buy/sell/hold
                 └──────┬───────┘
                        │
                        ▼
                       END
```

### 技术栈

| 组件 | 技术 |
|------|------|
| Agent 编排 | LangGraph `StateGraph` |
| LLM 调用 | LangChain + 多 provider（OpenAI/DeepSeek/Anthropic/Ollama 等） |
| 数据源 | Financial Datasets API（股价、财报、新闻、内部人交易） |
| 指标计算 | pandas + numpy（纯 Python，无 TA-Lib） |
| 包管理 | Poetry |
| 回测引擎 | 自建，基于交易日循环 |

### Agent 全览

项目共 18 个分析师 Agent + 2 个决策 Agent：

| 类别 | Agent | 决策方式 |
|------|-------|----------|
| 投资大师 | 巴菲特、芒格、林奇、费舍、阿克曼、凯瑟琳·伍德、迈克尔·布瑞、达摩达兰、Druckenmiller、Pabrai、Jhunjhunwala、格雷厄姆 | **LLM 角色扮演**：拉财务数据 → 塞给 LLM（不同 system prompt）→ 输出信号 |
| 量化分析 | 技术面 Agent | **纯代码**：EMA/布林带/RSI/ADX/Hurst 指标计算，加权投票 |
| 量化分析 | 基本面 Agent | **纯代码**：ROE/净利率/营收增长等硬阈值打分 |
| 量化分析 | 估值 Agent | **纯代码**：DCF + Owner Earnings + EV/EBITDA + 残余收益模型 |
| 量化分析 | 情绪 Agent | **纯代码**：内部人交易 + 新闻情绪加权 |
| 量化分析 | 新闻情绪 Agent | LLM 分析新闻文本 |
| 量化分析 | 成长 Agent | LLM 分析成长性 |
| 风控 | 风险管理 Agent | **纯代码**：波动率 × 相关性双重调整 |
| 决策 | 组合经理 Agent | **LLM**：汇总所有信号做最终决策 |

---

## 二、LangGraph 编排机制

### 2.1 状态定义

```python
# src/graph/state.py
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]  # 追加合并
    data: Annotated[dict[str, any], merge_dicts]              # 字典合并
    metadata: Annotated[dict[str, any], merge_dicts]          # 字典合并
```

**关键设计**：`Annotated` + 合并函数让 LangGraph 知道多个 Agent 并行写入同一字段时怎么合并。

- `messages`：用 `operator.add`（列表追加），每个 Agent 往里加一条 `HumanMessage`
- `data`：用 `merge_dicts`（`{**a, **b}`），所有 Agent 的输出合并到同一个字典
- 每个 Agent 把自己的分析结果写入 `state["data"]["analyst_signals"][agent_id]`

### 2.2 图的构建

```python
# src/main.py → create_workflow()
workflow = StateGraph(AgentState)
workflow.add_node("start_node", start)

# 1. 注册所有分析师（并行）
for analyst_key in selected_analysts:
    node_name, node_func = analyst_nodes[analyst_key]
    workflow.add_node(node_name, node_func)
    workflow.add_edge("start_node", node_name)  # start → 每个分析师

# 2. 注册风控和组合经理（串行）
workflow.add_node("risk_management_agent", risk_management_agent)
workflow.add_node("portfolio_manager", portfolio_management_agent)

# 3. 每个分析师 → 风控
for analyst_key in selected_analysts:
    workflow.add_edge(analyst_nodes[analyst_key][0], "risk_management_agent")

# 4. 风控 → 组合经理 → 结束
workflow.add_edge("risk_management_agent", "portfolio_manager")
workflow.add_edge("portfolio_manager", END)

workflow.set_entry_point("start_node")
```

**并行原理**：从 `start_node` 出发有多条 edge，LangGraph 自动 fan-out 并行执行。多个 edge 指向同一个 `risk_management_agent` 时，LangGraph 自动等所有上游完成后才触发（fan-in）。

### 2.3 Agent 统一接口

每个 Agent 函数签名一致：

```python
def xxx_agent(state: AgentState, agent_id: str = "xxx") -> dict:
    # 1. 从 state 读输入
    tickers = state["data"]["tickers"]
    end_date = state["data"]["end_date"]

    # 2. 干活（拉数据 / 算指标 / 调 LLM）
    analysis = ...  # {ticker: {signal, confidence, reasoning}}

    # 3. 写回 state
    state["data"]["analyst_signals"][agent_id] = analysis
    return {
        "messages": [HumanMessage(content=json.dumps(analysis), name=agent_id)],
        "data": state["data"],
    }
```

所有 Agent 的输出格式统一：`{signal: "bullish"/"bearish"/"neutral", confidence: 0-100, reasoning: ...}`

---

## 三、技术面 Agent — 五大策略详解

**这是整个项目中最有学习价值的部分。完全纯代码，不依赖 LLM。**

### 3.1 整体框架

对每只股票计算 5 个子策略，然后加权投票：

```python
strategy_weights = {
    "trend": 0.25,           # 趋势跟踪
    "mean_reversion": 0.20,  # 均值回归
    "momentum": 0.25,        # 动量
    "volatility": 0.15,      # 波动率分析
    "stat_arb": 0.15,        # 统计套利
}
```

### 3.2 策略一：趋势跟踪（权重 25%）

**原理**：用多条 EMA 判断趋势方向，用 ADX 判断趋势强度。

```
EMA(8)  — 短期趋势线
EMA(21) — 中期趋势线
EMA(55) — 长期趋势线
```

**信号判定**：

| 条件 | 信号 | 置信度 |
|------|------|--------|
| EMA8 > EMA21 且 EMA21 > EMA55 | bullish | ADX / 100 |
| EMA8 < EMA21 且 EMA21 < EMA55 | bearish | ADX / 100 |
| 其他 | neutral | 0.5 |

**ADX（Average Directional Index）计算**：

```
TR = max(high-low, |high-prev_close|, |low-prev_close|)
+DM = max(high - prev_high, 0)  当 high-prev_high > prev_low-low
-DM = max(prev_low - low, 0)    当 prev_low-low > high-prev_high
+DI = 100 × EMA(+DM) / EMA(TR)
-DI = 100 × EMA(-DM) / EMA(TR)
DX = 100 × |+DI - -DI| / (+DI + -DI)
ADX = EMA(DX)
```

ADX > 25 表示强趋势，< 20 表示无趋势。用 ADX/100 作为置信度，趋势越强越确定。

### 3.3 策略二：均值回归（权重 20%）

**原理**：价格偏离均值过多时会回归。

**指标**：

```
Z-score = (当前价 - MA50) / 标准差50
布林带位置 = (当前价 - 下轨) / (上轨 - 下轨)
RSI(14) 和 RSI(28)
```

**信号判定**：

| 条件 | 信号 | 置信度 |
|------|------|--------|
| Z < -2 且 布林带位置 < 0.2 | bullish（超卖） | min(|Z| / 4, 1.0) |
| Z > 2 且 布林带位置 > 0.8 | bearish（超买） | min(|Z| / 4, 1.0) |
| 其他 | neutral | 0.5 |

**布林带计算**：

```
中轨 = SMA(close, 20)
上轨 = 中轨 + 2 × std(close, 20)
下轨 = 中轨 - 2 × std(close, 20)
```

**RSI 计算**：

```
delta = close.diff()
gain = max(delta, 0) 的 period 日均值
loss = max(-delta, 0) 的 period 日均值
RS = gain / loss
RSI = 100 - 100 / (1 + RS)
```

### 3.4 策略三：动量（权重 25%）

**原理**：趋势有延续性，放量确认更可靠。

```
momentum_score = 0.4 × 1月动量 + 0.3 × 3月动量 + 0.3 × 6月动量

其中 X月动量 = 过去 X 个交易日收益率之和
volume_confirmation = 当前成交量 > 21日均量
```

| 条件 | 信号 | 置信度 |
|------|------|--------|
| 动量 > 5% 且放量 | bullish | min(|动量| × 5, 1.0) |
| 动量 < -5% 且放量 | bearish | min(|动量| × 5, 1.0) |
| 其他 | neutral | 0.5 |

### 3.5 策略四：波动率分析（权重 15%）

**原理**：波动率有均值回归特性——极端高/低波动率会回归。

```
历史波动率 = 近21日收益率标准差 × √252（年化）
波动率体制 = 当前波动率 / 63日平均波动率
波动率Z-score = (当前波动率 - 均值) / 标准差
```

| 条件 | 信号 | 置信度 |
|------|------|--------|
| 体制 < 0.8 且 Z < -1 | bullish（低波动，可能突破） | min(|Z| / 3, 1.0) |
| 体制 > 1.2 且 Z > 1 | bearish（高波动，可能收缩） | min(|Z| / 3, 1.0) |
| 其他 | neutral | 0.5 |

### 3.6 策略五：统计套利（权重 15%）

**原理**：Hurst 指数判断价格序列是均值回归型还是趋势型。

```
H < 0.5 → 均值回归型（会回归均值）
H = 0.5 → 随机游走（不可预测）
H > 0.5 → 趋势型（趋势会延续）
```

Hurst 指数通过 R/S 分析法计算：

```python
def calculate_hurst_exponent(price_series, max_lag=20):
    lags = range(2, max_lag)
    tau = [sqrt(std(price_series[lag:] - price_series[:-lag])) for lag in lags]
    reg = polyfit(log(lags), log(tau), 1)
    return reg[0]  # 斜率即 Hurst 指数
```

| 条件 | 信号 | 置信度 |
|------|------|--------|
| H < 0.4 且 偏度 > 1 | bullish | (0.5 - H) × 2 |
| H < 0.4 且 偏度 < -1 | bearish | (0.5 - H) × 2 |
| 其他 | neutral | 0.5 |

还计算了收益率的偏度（skewness）和峰度（kurtosis）作为辅助指标。

### 3.7 加权信号合成

```python
signal_values = {"bullish": 1, "neutral": 0, "bearish": -1}

weighted_sum = Σ (信号值 × 权重 × 置信度)
total_confidence = Σ (权重 × 置信度)

final_score = weighted_sum / total_confidence

if final_score > 0.2  → bullish
if final_score < -0.2 → bearish
else                  → neutral

final_confidence = |final_score|
```

**阈值 0.2 的含义**：不是简单的多数投票，而是加权置信度要超过 20% 才算明确信号，避免噪声。

---

## 四、基本面 Agent — 硬阈值打分

**纯代码，不用 LLM**。对四个维度分别打分，然后多数投票。

### 4.1 盈利能力

```
ROE > 15%   → +1
净利率 > 20% → +1
营业利润率 > 15% → +1

≥ 2 项达标 → bullish
= 0 项达标 → bearish
其他 → neutral
```

### 4.2 成长性

```
营收增长 > 10%   → +1
盈利增长 > 10%   → +1
账面价值增长 > 10% → +1

≥ 2 项 → bullish
= 0 项 → bearish
```

### 4.3 财务健康

```
流动比率 > 1.5       → +1（流动性好）
负债/权益 < 0.5      → +1（负债低）
FCF/股 > EPS × 0.8   → +1（现金流质量高）

≥ 2 项 → bullish
= 0 项 → bearish
```

### 4.4 估值比率（反向逻辑：比率越高越看空）

```
P/E > 25 → 贵了
P/B > 3  → 贵了
P/S > 5  → 贵了

≥ 2 项偏高 → bearish
= 0 项偏高 → bullish
其他 → neutral
```

### 4.5 最终信号

```python
bullish_count = 4个维度中 bullish 的数量
bearish_count = 4个维度中 bearish 的数量

bullish > bearish → bullish
bearish > bullish → bearish
else → neutral

confidence = max(bullish_count, bearish_count) / 4 × 100
```

---

## 五、估值 Agent — 四模型加权

**纯代码，不用 LLM**。实现四个经典估值模型，加权合成一个信号。

### 5.1 模型一：增强 DCF（权重 35%）

三阶段增长模型 + 三情景分析：

```
阶段1（1-3年）：高增长，增长率 = min(营收增长, 25%)
                大市值公司 cap 在 10%
阶段2（4-7年）：过渡增长，增长率 = (高增长 + 3%) / 2，线性衰减
阶段3（永续）： 终端增长 = min(3%, 高增长 × 60%)
```

**WACC（加权平均资本成本）计算**：

```
权益成本 = 无风险利率(4.5%) + β(1.0) × 市场风险溢价(6%) = 10.5%
债务成本 = 无风险利率 + min(10/利息覆盖率, 5%)
权益权重 = 市值 / (市值 + 净债务)
债务权重 = 净债务 / (市值 + 净债务)
WACC = 权益权重 × 权益成本 + 债务权重 × 债务成本 × (1 - 税率25%)

WACC 下限 6%，上限 20%
```

**三情景 DCF**：

| 情景 | 增长率调整 | WACC调整 | 终端增长调整 | 概率权重 |
|------|-----------|---------|-------------|---------|
| 熊市 | ×0.5 | ×1.2 | ×0.8 | 20% |
| 基准 | ×1.0 | ×1.0 | ×1.0 | 60% |
| 牛市 | ×1.5 | ×0.9 | ×1.2 | 20% |

```
期望价值 = 熊市估值 × 0.2 + 基准估值 × 0.6 + 牛市估值 × 0.2
```

**质量调整**：FCF 波动率（变异系数）越高，估值打折越多：

```
quality_factor = max(0.7, 1 - FCF波动率 × 0.5)
最终估值 = (PV阶段1 + PV阶段2 + PV终端) × quality_factor
```

### 5.2 模型二：Owner Earnings 估值（权重 35%）

巴菲特最喜欢的"所有者盈余"模型：

```
Owner Earnings = 净利润 + 折旧摊销 - 维持性资本支出 - 营运资本变化
```

**维持性资本支出估算**（三种方法取中位数）：

```
方法1: 总资本支出 × 85%（假设15%是增长性投资）
方法2: 100% 折旧摊销（替换磨损资产）
方法3: 历史 capex/营收比率 × 当期营收
```

**估值**：对 Owner Earnings 做两阶段 DCF + 25% 安全边际折扣。

```
阶段1（5年）：增长率 = min(earnings_growth, 8%)
终端增长 = min(growth_rate, 3%)
折现率 = 15%（巴菲特风格的高要求回报率）

内在价值 = PV(阶段1) + PV(终端)
最终估值 = 内在价值 × (1 - 25%)  ← 安全边际折扣
```

### 5.3 模型三：EV/EBITDA 隐含价值（权重 20%）

```
当前 EBITDA = 企业价值 / EV/EBITDA 倍数
中位数倍数 = median(历史各期 EV/EBITDA)
隐含 EV = 中位数倍数 × 当前 EBITDA
净债务 = 企业价值 - 市值
隐含权益价值 = 隐含 EV - 净债务
```

逻辑：如果当前倍数低于历史中位数，说明可能被低估。

### 5.4 模型四：残余收益模型（权重 10%）

Edwards-Bell-Ohlson 模型：

```
账面价值 = 市值 / P/B
残余收益 = 净利润 - 权益成本 × 账面价值
权益成本 = 10%

内在价值 = 账面价值 + PV(未来5年残余收益) + PV(终端残余收益)
最终估值 = 内在价值 × 0.8  ← 20% 安全边际
```

### 5.5 四模型加权合成

```python
method_values = {
    "dcf":            {"value": dcf_val,    "weight": 0.35},
    "owner_earnings":  {"value": owner_val,  "weight": 0.35},
    "ev_ebitda":       {"value": ev_val,     "weight": 0.20},
    "residual_income": {"value": rim_val,    "weight": 0.10},
}

# 每个模型计算与市值的差距
gap = (估值 - 市值) / 市值

# 加权平均差距
weighted_gap = Σ (weight × gap) / Σ weight  (只计有效模型)

# 信号判定
gap > 15%  → bullish（被低估）
gap < -15% → bearish（被高估）
其他       → neutral

# 置信度
confidence = min(|gap| / 30% × 100, 100)
```

---

## 六、情绪 Agent — 双源加权

**纯代码，不用 LLM。**

### 6.1 数据源

| 数据源 | 权重 | 判定逻辑 |
|--------|------|----------|
| 内部人交易 | 30% | 买入（transaction_shares > 0）→ bullish，卖出 → bearish |
| 新闻情绪 | 70% | positive → bullish, negative → bearish, neutral → neutral |

### 6.2 加权合成

```python
weighted_bullish = 内部人买入次数 × 0.3 + 正面新闻数 × 0.7
weighted_bearish = 内部人卖出次数 × 0.3 + 负面新闻数 × 0.7

bullish > bearish → bullish
bearish > bullish → bearish
else → neutral

confidence = max(weighted_bullish, weighted_bearish) / 总加权信号数 × 100
```

新闻权重 (70%) 远高于内部人交易 (30%)，因为新闻数据量更大且更及时。

---

## 七、投资大师 Agent — LLM 角色扮演

以巴菲特 Agent 为例，展示这类 Agent 的工作模式。

### 7.1 数据收集

```python
# 拉取的财务数据
metrics = get_financial_metrics(ticker, end_date, period="ttm", limit=10)
line_items = search_line_items(ticker, [
    "capital_expenditure", "depreciation_and_amortization", "net_income",
    "outstanding_shares", "total_assets", "total_liabilities",
    "shareholders_equity", "dividends_and_other_cash_distributions",
    "issuance_or_purchase_of_equity_shares", "gross_profit",
    "revenue", "free_cash_flow"
], end_date, limit=10)
market_cap = get_market_cap(ticker, end_date)
```

### 7.2 代码预分析（纯计算）

巴菲特 Agent 有 **7 个纯代码分析模块**：

| 分析模块 | 评估内容 | 评分范围 |
|---------|---------|---------|
| `analyze_fundamentals` | ROE > 15%, D/E < 0.5, 营业利润率 > 15%, 流动比率 > 1.5 | 0-7 |
| `analyze_consistency` | 盈利连续增长趋势 | 0-3 |
| `analyze_moat` | ROE一致性(80%+>15%), 利润率稳定性, 资产效率, 竞争稳定性 | 0-5 |
| `analyze_pricing_power` | 毛利率趋势（扩张/稳定/收缩），平均毛利率水平 | 0-5 |
| `analyze_book_value_growth` | 每股账面价值增长一致性 + CAGR | 0-5 |
| `analyze_management_quality` | 回购行为 + 分红记录 | 0-2 |
| `calculate_intrinsic_value` | 三阶段 DCF + Owner Earnings + 15% 安全边际 | 输出估值 |

**护城河分析的亮点**：

```python
# 1. ROE 一致性：过去多期中 80%+ 时间 ROE > 15% → 有护城河
# 2. 营业利润率稳定性：变异系数越低越好
# 3. 资产效率：资产周转率 > 1.0 说明运营效率高
# 4. 综合稳定性 = (ROE稳定性 + 利润率稳定性) / 2 > 70% → 强护城河
```

**Owner Earnings（所有者盈余）计算**：

```
Owner Earnings = 净利润 + 折旧 - 维持性CapEx - 营运资本变化

维持性CapEx 估算（取三种方法中位数）:
  - 总CapEx × 85%
  - 折旧 × 100%
  - 历史CapEx/营收比 × 当期营收
```

**三阶段 DCF 内在价值**：

```
阶段1（5年）: 增长率 = min(历史增长×70%, 8%)
阶段2（5年）: 增长率 = 阶段1增长率 × 50%，cap 在 4%
终端增长 = 2.5%（GDP增速）
折现率 = 10%

最终 = (PV阶段1 + PV阶段2 + PV终端) × 0.85  ← 额外15%折扣
```

### 7.3 LLM 最终判断

把所有预分析结果压缩成 facts，喂给 LLM：

```python
template = ChatPromptTemplate.from_messages([
    ("system",
     "You are Warren Buffett. Decide bullish, bearish, or neutral using only the provided facts.\n"
     "Checklist: Circle of competence, Competitive moat, Management quality, "
     "Financial strength, Valuation vs intrinsic value, Long-term prospects\n"
     "Signal rules:\n"
     "- Bullish: strong business AND margin_of_safety > 0\n"
     "- Bearish: poor business OR clearly overvalued\n"
     "- Neutral: good business but margin_of_safety <= 0, or mixed evidence"
     # ... confidence scale 定义 ...
    ),
    ("human",
     "Ticker: {ticker}\nFacts:\n{facts}\n"
     "Return: {signal, confidence, reasoning}"
    ),
])
```

### 7.4 其他大师 Agent 的区别

12 个大师 Agent 的**代码预分析部分大同小异**（都拉类似的财务数据），主要区别在 LLM 的 system prompt：

| 大师 | prompt 侧重点 |
|------|-------------|
| 巴菲特 | 护城河 + 安全边际 + 管理层质量 |
| 芒格 | 好生意 + 公道价格 + 理性 |
| 林奇 | "买你懂的" + 十倍股 + PEG 比率 |
| 阿克曼 | 激进主义 + 价值释放 + 逆向投资 |
| 伍德 | 颠覆性创新 + 增长 + 技术变革 |
| 布瑞 | 深度价值 + 逆向 + 做空泡沫 |
| 达摩达兰 | 严格估值 + 故事与数字匹配 |
| 格雷厄姆 | 安全边际 + 净流动资产价值 |

**本质**：同一个 LLM 换不同 system prompt，产出 12 个"不同视角"的信号。实际上相关性很高。

---

## 八、风险管理 Agent — 波动率 × 相关性双重调整

**纯代码，不用 LLM。这是整个项目风控质量最高的模块。**

### 8.1 波动率计算

```python
daily_returns = prices_df["close"].pct_change().dropna()
recent_returns = daily_returns.tail(60)  # 近60个交易日

daily_vol = recent_returns.std()
annualized_vol = daily_vol × √252  # 年化
```

### 8.2 波动率 → 仓位上限

| 年化波动率 | 乘数 | 最大仓位（基准20%） |
|-----------|------|-----------------|
| < 15%（低波动） | 1.25 | 25% |
| 15-30%（中等） | 1.0 → 0.625 | 12.5-20% |
| 30-50%（高） | 0.75 → 0.25 | 5-15% |
| > 50%（极高） | 0.50 | 10% |

公式：

```python
if vol < 0.15:   multiplier = 1.25
elif vol < 0.30: multiplier = 1.0 - (vol - 0.15) × 0.5   # 线性衰减
elif vol < 0.50: multiplier = 0.75 - (vol - 0.30) × 0.5  # 继续衰减
else:            multiplier = 0.50

position_limit = portfolio_value × 0.20 × multiplier
```

### 8.3 相关性调整

计算所有持仓之间的日收益率 Pearson 相关系数矩阵：

```python
returns_df = pd.DataFrame(returns_by_ticker).dropna()
correlation_matrix = returns_df.corr()
```

根据目标股票与已有持仓的平均相关性调整：

| 平均相关性 | 乘数 | 含义 |
|-----------|------|------|
| ≥ 0.80 | ×0.70 | 高度相关，大幅减仓避免同涨同跌 |
| 0.60-0.80 | ×0.85 | 较高相关，适度减仓 |
| 0.40-0.60 | ×1.00 | 中等相关，不调整 |
| 0.20-0.40 | ×1.05 | 低相关，微微加仓鼓励分散 |
| < 0.20 | ×1.10 | 非常不相关，鼓励配置 |

### 8.4 最终限额计算

```python
combined_limit = portfolio_value × base_pct × vol_multiplier × corr_multiplier
remaining = combined_limit - current_position_value
actual_available = min(remaining, cash)
```

**设计理念**：波动率控制**单票风险**（高波动少买），相关性控制**组合集中度风险**（高相关少买）。两层独立调整，乘法叠加。

---

## 九、组合经理 Agent — LLM 最终决策

### 9.1 输入准备

```python
# 压缩所有分析师信号为 {agent: {sig, conf}} 格式
ticker_signals = {}
for agent, signals in analyst_signals.items():
    if not agent.startswith("risk_management"):
        sig = signals[ticker]["signal"]
        conf = signals[ticker]["confidence"]
        ticker_signals[agent] = {"sig": sig, "conf": conf}
```

### 9.2 确定性约束（代码计算，不让 LLM 算）

```python
# 对每只股票计算允许的操作和最大数量
allowed = {
    "AAPL": {"buy": 50, "sell": 0, "hold": 0},    # 只有买入和持有
    "MSFT": {"sell": 30, "hold": 0},                # 只有卖出和持有
}

# 如果只有 hold 选项，直接填 hold，不浪费 LLM 调用
if set(allowed.keys()) == {"hold"}:
    prefilled_decisions[ticker] = {"action": "hold", ...}
```

这一步很聪明——**不让 LLM 做算术**，代码先算好每种操作最多能做多少股，LLM 只需要从允许的操作中选一个。

### 9.3 LLM Prompt

```python
template = ChatPromptTemplate.from_messages([
    ("system",
     "You are a portfolio manager.\n"
     "Inputs per ticker: analyst signals and allowed actions with max qty.\n"
     "Pick one allowed action per ticker and a quantity ≤ the max. "
     "Keep reasoning very concise (max 100 chars). Return JSON only."
    ),
    ("human",
     "Signals:\n{signals}\n\n"
     "Allowed:\n{allowed}\n\n"
     "Return: {decisions: {TICKER: {action, quantity, confidence, reasoning}}}"
    ),
])
```

### 9.4 结构化输出

用 Pydantic 模型强制 LLM 输出格式：

```python
class PortfolioDecision(BaseModel):
    action: Literal["buy", "sell", "short", "cover", "hold"]
    quantity: int
    confidence: int       # 0-100
    reasoning: str        # ≤100 字符

class PortfolioManagerOutput(BaseModel):
    decisions: dict[str, PortfolioDecision]
```

通过 `llm.with_structured_output(PortfolioManagerOutput)` 确保 LLM 输出符合 schema。

---

## 十、LLM 调用层 — call_llm 封装

### 10.1 统一调用接口

```python
def call_llm(prompt, pydantic_model, agent_name, state, max_retries=3, default_factory=None):
    # 1. 从 state 提取 agent 专属模型配置（支持 Web UI 给不同 agent 配不同模型）
    model_name, model_provider = get_agent_model_config(state, agent_name)

    # 2. 获取 LLM 实例
    llm = get_model(model_name, model_provider)

    # 3. 启用结构化输出（如果模型支持）
    if model_info.has_json_mode():
        llm = llm.with_structured_output(pydantic_model, method="json_mode")

    # 4. 带重试调用
    for attempt in range(max_retries):
        try:
            result = llm.invoke(prompt)
            return result
        except Exception:
            if attempt == max_retries - 1:
                # 失败时用 default_factory 或 create_default_response 兜底
                return default_factory() if default_factory else create_default_response(pydantic_model)
```

### 10.2 默认值兜底

```python
def create_default_response(model_class):
    """根据 Pydantic 字段类型生成安全默认值"""
    str  → "Error in analysis, using default"
    float → 0.0
    int   → 0
    dict  → {}
    Literal → 取第一个允许值
```

### 10.3 多 Provider 支持

支持 12 种 LLM provider：OpenAI、Anthropic、DeepSeek、Google、Groq、Ollama、OpenRouter、xAI、GigaChat、Azure OpenAI 等。通过 LangChain 统一接口。

---

## 十一、回测引擎

### 11.1 回测循环

```python
class BacktestEngine:
    def run_backtest(self):
        self._prefetch_data()  # 预拉取所有数据+SPY基准数据

        dates = pd.date_range(start_date, end_date, freq="B")  # 只在工作日运行

        for current_date in dates:
            # 1. 获取当前价格
            current_prices = get_price_data(...)

            # 2. 调用 Agent 做决策（start_date 设为一个月前，end_date 设为当前日）
            agent_output = run_hedge_fund(
                tickers=tickers,
                start_date=一个月前,
                end_date=当前日,
                portfolio=当前组合状态,
                ...
            )
            decisions = agent_output["decisions"]

            # 3. 执行交易
            for ticker in tickers:
                executor.execute_trade(ticker, action, qty, price, portfolio)

            # 4. 计算组合价值
            total_value = calculate_portfolio_value(portfolio, current_prices)
            exposures = compute_exposures(portfolio, current_prices)

            # 5. 计算绩效指标（需要 > 3 个数据点）
            if len(portfolio_values) > 3:
                metrics = compute_metrics(portfolio_values)
```

### 11.2 绩效指标

```python
# Sharpe Ratio
日无风险利率 = 4.34% / 252
超额收益 = 日收益率 - 日无风险利率
Sharpe = √252 × mean(超额收益) / std(超额收益)

# Sortino Ratio
下行偏差 = sqrt(mean(min(超额收益, 0)²))
Sortino = √252 × mean(超额收益) / 下行偏差

# Max Drawdown
滚动最高 = cummax(组合价值)
回撤 = (组合价值 - 滚动最高) / 滚动最高
最大回撤 = min(回撤) × 100
```

### 11.3 基准对比

预加载 SPY 数据，每天计算 SPY 同期收益率作为基准。

---

## 十二、数据流全景

```
用户输入 ticker + 日期范围
        │
        ▼
   StateGraph.invoke({
       messages: [HumanMessage("Make trading decisions")],
       data: {
           tickers: ["AAPL", "MSFT"],
           portfolio: {cash: 100000, positions: {...}},
           start_date: "2024-01-01",
           end_date: "2024-03-01",
           analyst_signals: {}   ← 初始为空
       },
       metadata: {
           model_name: "gpt-4.1",
           model_provider: "OpenAI",
           show_reasoning: True
       }
   })
        │
        ▼ (并行)
   ┌─ 技术面Agent ─→ 拉价格数据 → 算5个策略 → 加权投票 → analyst_signals["technical_analyst_agent"] = {AAPL: {signal, conf}, MSFT: {signal, conf}}
   ├─ 基本面Agent ─→ 拉财务数据 → 4维度打分 → 多数投票 → analyst_signals["fundamentals_analyst_agent"] = {...}
   ├─ 估值Agent   ─→ 拉财务数据 → 4模型估值 → 加权合成 → analyst_signals["valuation_analyst_agent"] = {...}
   ├─ 情绪Agent   ─→ 拉内部人+新闻 → 加权 → analyst_signals["sentiment_analyst_agent"] = {...}
   ├─ 巴菲特Agent ─→ 拉财务数据 → 7模块预分析 → LLM判断 → analyst_signals["warren_buffett_agent"] = {...}
   └─ ...其他Agent...
        │ (全部完成)
        ▼
   风控Agent: 读取 analyst_signals + portfolio → 算波动率+相关性 → 输出 position_limits
   analyst_signals["risk_management_agent"] = {AAPL: {remaining_position_limit, current_price, ...}}
        │
        ▼
   组合经理Agent: 读取所有 analyst_signals → 代码计算允许操作 → LLM 从允许操作中选 → 输出最终决策
   返回: {decisions: {AAPL: {action: "buy", quantity: 50, confidence: 80}}, analyst_signals: {...}}
```

---

## 十三、权重与阈值汇总

### Agent 输出权重（影响组合经理决策）

项目本身**没有给不同 Agent 分配权重**。所有 Agent 的信号以 `{sig, conf}` 形式平等地传给 Portfolio Manager 的 LLM。LLM 自行判断各信号的可信度。

### 技术面子策略权重

| 策略 | 权重 | 理由 |
|------|------|------|
| 趋势跟踪 | 25% | 趋势是最基本的市场特征 |
| 动量 | 25% | 与趋势互补，捕捉中短期价格动量 |
| 均值回归 | 20% | 对冲趋势信号，捕捉超买超卖 |
| 波动率 | 15% | 辅助判断市场环境 |
| 统计套利 | 15% | 高级统计特征（Hurst）作为补充 |

### 估值模型权重

| 模型 | 权重 | 理由 |
|------|------|------|
| DCF | 35% | 最严谨的绝对估值法 |
| Owner Earnings | 35% | 巴菲特偏好的方法，与 DCF 互补 |
| EV/EBITDA | 20% | 相对估值法，反映市场定价 |
| 残余收益 | 10% | 学术性强但实用性较低 |

### 情绪信号权重

| 来源 | 权重 |
|------|------|
| 新闻情绪 | 70% |
| 内部人交易 | 30% |

### 关键阈值

| 阈值 | 含义 |
|------|------|
| 技术面 ±0.2 | 加权信号超过 20% 才算明确信号 |
| 估值 ±15% | 估值差距超过 15% 才发出买卖信号 |
| 估值置信度 ÷ 30% | 差距 30% 时置信度封顶 100% |
| 风控波动率分界 15%/30%/50% | 四档波动率对应不同仓位上限 |
| 风控相关性分界 0.2/0.4/0.6/0.8 | 五档相关性对应不同调整系数 |
| 巴菲特安全边际 | Owner Earnings 估值打 25% 折，DCF 打 15% 折 |
| 回测无风险利率 | 4.34% 年化（美国国债利率） |
| WACC 范围 | 6%-20% |

---

## 十四、学到了什么 / 不该学什么

### 值得学习的工程实践

1. **LangGraph StateGraph 的 fan-out/fan-in 模式**：声明式图构建，自动并行和同步
2. **LLM 结构化输出**：Pydantic 模型 + `with_structured_output` + 重试 + 默认值兜底
3. **技术面指标计算**：EMA/ADX/布林带/RSI/Hurst 的纯 Python 实现，不依赖 TA-Lib
4. **风控双重调整**：波动率控制单票风险，相关性控制集中度风险
5. **确定性约束前置**：代码先算好允许的操作范围，LLM 只在范围内选择，避免幻觉
6. **估值多模型加权**：DCF + Owner Earnings + EV/EBITDA + 残余收益，互补验证

### 不该学习的做法

1. **12 个大师 Agent 换皮复读**：代码预分析几乎一样，只是 LLM prompt 不同，产出高度相关的信号
2. **LLM 做最终交易决策**：不可解释、不可复现、不可回测调优
3. **单日快照式分析**：没有时序持续性，没有策略衰减检测
4. **Agent 间无权重分配**：所有信号平等传给 LLM，没有根据历史准确率加权
5. **回测过拟合风险**：在已知数据上跑策略，没有样本外验证

### 一句话总结

> **量化部分（技术面 + 基本面 + 估值 + 风控）用代码硬算，可靠可复现——这是精华。LLM 部分（大师分析 + 最终决策）本质上是不确定的角色扮演——这是噱头。**
