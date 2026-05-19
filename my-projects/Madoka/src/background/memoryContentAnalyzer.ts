/**
 * 记忆内容分析器 - 改进版
 * 基于多维度评分体系自动判定是否值得记忆
 */

// 评分维度接口
export interface ScoringDimension {
  name: string
  score: number
  weight: number
  weightedScore: number
  reasons: string[]
}

// 评分详情输出
export interface ContentAnalysisResult {
  totalScore: number
  threshold: number
  isWorthRemembering: boolean
  breakdown: ScoringDimension[]
  reasons: string[] // 兼容旧接口
  score: number // 兼容旧接口
}

// 个人信息关键词 - 扩展
const PERSONAL_INFO_PATTERNS = [
  /我(\d+)岁/, /今年(\d+)岁/, /(\d+)年出生/,
  /我是(一名|个)?[\u4e00-\u9fa5]{2,6}(工程师|医生|教师|学生|程序员|开发|设计师|经理|总监|律师|会计|销售|运营|产品|测试|运维|架构师|主管|助理)/,
  /我在[\u4e00-\u9fa5]{2,10}(公司|学校|单位|厂|机构|医院|银行)/,
  /我住在|我家在|我来自|我的家乡是|籍贯是/,
  /我叫|我的名字是|记住.*名字是|请叫我|你可以叫我/,
  /我是(男|女)生?/, /我的性别是/,
  /我的生日是|我生于|出生于/,
  /我的(手机|电话|邮箱|微信|QQ)是/,
]

// 偏好关键词 - 扩展
const PREFERENCE_PATTERNS = [
  /我喜欢/, /我爱/, /我偏好/, /我倾向于/, /我更喜欢/,
  /我不喜欢/, /我讨厌/, /我厌恶/, /我反感/, /我不爱/,
  /我感兴趣/, /我热衷于/, /我痴迷于/, /我对.*感兴趣/,
  /我最爱/, /我的最爱是/, /我的首选是/,
  /我觉得.*(好吃|好玩|好看|好用|不错|很棒)/,
]

// 重要事实关键词 - 扩展
const IMPORTANT_FACT_PATTERNS = [
  /我正在学习/, /我在学/, /我在做/, /我在研究/, /我在准备/,
  /我的目标是/, /我想成为/, /我计划/, /我打算/, /我希望/,
  /我擅长/, /我的专长是/, /我的优势是/, /我的特长是/,
  /我不擅长/, /我的弱点是/, /我需要改进/, /我想提升/,
  /我正在准备/, /我在备考/, /我在复习/, /我要考/,
  /我在(读|上).*(大学|学校|课程|培训)/,
  /我(已经|已|有).*年.*经验/,
]

// 明确记忆指令
const MEMORY_COMMAND_PATTERNS = [
  /记住/, /请记住/, /保存/, /记下来/, /别忘了/, /记住.*我/,
  /帮我记住/, /请记录/, /记录下来/, /存档/,
]

// 寒暄/无意义内容模式（用于减分或提高阈值）
const TRIVIAL_PATTERNS = [
  /^你好[\s\S]{0,20}$/, /^在吗[\s\S]{0,10}$/, /^在不在/,
  /^谢谢[\s\S]{0,20}$/, /^好的[\s\S]{0,10}$/, /^知道了/,
  /^再见[\s\S]{0,10}$/, /^拜拜/, /^晚安/, /^早安/, /^午安/,
  /^哈喽/, /^嗨/, /^嘿/, /^您好/,
]

// 职业关键词 - 用于增强检测
const PROFESSION_KEYWORDS = [
  '工程师', '程序员', '开发', '设计师', '产品经理', '测试', '运维',
  '教师', '老师', '教授', '医生', '护士', '律师', '会计',
  '销售', '运营', '市场', '人事', '行政', '财务', '经理', '总监',
  '学生', '研究生', '博士', '本科生',
]

// 学习相关关键词
const LEARNING_KEYWORDS = [
  '学习', '学', '备考', '复习', '准备', '考试', '课程',
  '培训', '进修', '研究', '钻研', '练习', '训练',
]

/**
 * 计算个人信息维度得分
 */
function calculatePersonalInfoScore(content: string): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  let matchCount = 0

  for (const pattern of PERSONAL_INFO_PATTERNS) {
    if (pattern.test(content)) {
      matchCount++
    }
  }

  if (matchCount > 0) {
    score = Math.min(40, 15 + matchCount * 8)
    reasons.push(`检测到${matchCount}项个人信息`)
  }

  // 额外检测职业关键词
  for (const keyword of PROFESSION_KEYWORDS) {
    if (content.includes(keyword)) {
      score += 5
      reasons.push(`职业信息: ${keyword}`)
      break
    }
  }

  return { score: Math.min(40, score), reasons }
}

/**
 * 计算偏好维度得分
 */
function calculatePreferenceScore(content: string): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  let matchCount = 0

  for (const pattern of PREFERENCE_PATTERNS) {
    if (pattern.test(content)) {
      matchCount++
    }
  }

  if (matchCount > 0) {
    score = Math.min(30, 10 + matchCount * 5)
    reasons.push(`检测到${matchCount}项偏好信息`)
  }

  return { score, reasons }
}

/**
 * 计算重要事实维度得分
 */
function calculateImportantFactScore(content: string): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  let matchCount = 0

  for (const pattern of IMPORTANT_FACT_PATTERNS) {
    if (pattern.test(content)) {
      matchCount++
    }
  }

  if (matchCount > 0) {
    score = Math.min(25, 10 + matchCount * 4)
    reasons.push(`检测到${matchCount}项重要事实`)
  }

  // 额外检测学习关键词
  for (const keyword of LEARNING_KEYWORDS) {
    if (content.includes(keyword)) {
      score += 3
      reasons.push(`学习相关信息: ${keyword}`)
      break
    }
  }

  return { score: Math.min(25, score), reasons }
}

/**
 * 计算指令维度得分
 */
function calculateCommandScore(content: string): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  let matchCount = 0

  for (const pattern of MEMORY_COMMAND_PATTERNS) {
    if (pattern.test(content)) {
      matchCount++
    }
  }

  if (matchCount > 0) {
    score = Math.min(35, 20 + matchCount * 8)
    reasons.push(`检测到${matchCount}个记忆指令`)
  }

  return { score, reasons }
}

/**
 * 计算内容质量维度得分
 */
function calculateQualityScore(userContent: string, assistantContent: string): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const combinedLength = userContent.length + assistantContent.length

  // 长度评分
  if (combinedLength > 300) {
    score += 15
    reasons.push('内容非常详细')
  } else if (combinedLength > 150) {
    score += 10
    reasons.push('内容较详细')
  } else if (combinedLength > 50) {
    score += 5
    reasons.push('内容长度适中')
  }

  // 深度问题评分
  const deepQuestionPatterns = [
    /为什么/, /怎么/, /如何/, /什么/, /怎样/,
    /区别/, /差异/, /比较/, /对比/,
    /建议/, /推荐/, /意见/, /看法/,
  ]
  let deepQuestionCount = 0
  for (const pattern of deepQuestionPatterns) {
    if (pattern.test(userContent)) {
      deepQuestionCount++
    }
  }
  if (deepQuestionCount > 0) {
    score += Math.min(10, deepQuestionCount * 3)
    reasons.push('包含深度问题')
  }

  return { score, reasons }
}

/**
 * 检测是否为寒暄内容
 */
function isTrivialContent(content: string): boolean {
  for (const pattern of TRIVIAL_PATTERNS) {
    if (pattern.test(content)) {
      return true
    }
  }
  return false
}

/**
 * 计算动态阈值
 */
function calculateThreshold(
  personalInfoScore: number,
  commandScore: number,
  isTrivial: boolean
): number {
  // 基础阈值
  let threshold = 40

  // 如果包含明确记忆指令，降低阈值
  if (commandScore > 0) {
    threshold = 25
  }
  // 如果包含个人信息，使用较低阈值
  else if (personalInfoScore > 0) {
    threshold = 30
  }
  // 如果是寒暄内容，提高阈值
  else if (isTrivial) {
    threshold = 50
  }

  return threshold
}

/**
 * 分析内容是否值得记忆 - 改进版
 * @param userContent 用户输入内容
 * @param assistantContent 助手回复内容
 * @returns 详细分析结果
 */
export function analyzeContentForMemory(
  userContent: string,
  assistantContent: string
): ContentAnalysisResult {
  const combinedContent = `${userContent} ${assistantContent}`

  // 计算各维度得分
  const personalInfo = calculatePersonalInfoScore(combinedContent)
  const preference = calculatePreferenceScore(combinedContent)
  const importantFact = calculateImportantFactScore(combinedContent)
  const command = calculateCommandScore(combinedContent)
  const quality = calculateQualityScore(userContent, assistantContent)

  // 构建评分维度详情
  const breakdown: ScoringDimension[] = [
    {
      name: '个人信息',
      score: personalInfo.score,
      weight: 1.5,
      weightedScore: personalInfo.score * 1.5,
      reasons: personalInfo.reasons,
    },
    {
      name: '偏好',
      score: preference.score,
      weight: 1.2,
      weightedScore: preference.score * 1.2,
      reasons: preference.reasons,
    },
    {
      name: '重要事实',
      score: importantFact.score,
      weight: 1.0,
      weightedScore: importantFact.score * 1.0,
      reasons: importantFact.reasons,
    },
    {
      name: '记忆指令',
      score: command.score,
      weight: 1.3,
      weightedScore: command.score * 1.3,
      reasons: command.reasons,
    },
    {
      name: '内容质量',
      score: quality.score,
      weight: 0.8,
      weightedScore: quality.score * 0.8,
      reasons: quality.reasons,
    },
  ]

  // 计算加权总分
  const totalScore = Math.round(
    breakdown.reduce((sum, dim) => sum + dim.weightedScore, 0)
  )

  // 检测是否为寒暄
  const isTrivial = isTrivialContent(combinedContent)

  // 计算动态阈值
  const threshold = calculateThreshold(personalInfo.score, command.score, isTrivial)

  // 判断是否值得记忆
  const isWorthRemembering = totalScore >= threshold

  // 收集所有原因
  const allReasons: string[] = []
  breakdown.forEach(dim => {
    if (dim.score > 0) {
      allReasons.push(...dim.reasons)
    }
  })

  // 输出详细的评分日志
  console.log('[memoryContentAnalyzer] Detailed scoring:', {
    totalScore,
    threshold,
    isWorthRemembering,
    breakdown: breakdown.map(d => ({
      name: d.name,
      rawScore: d.score,
      weight: d.weight,
      weightedScore: d.weightedScore,
    })),
    isTrivial,
  })

  return {
    totalScore,
    threshold,
    isWorthRemembering,
    breakdown,
    reasons: allReasons,
    score: totalScore, // 兼容旧接口
  }
}

/**
 * 快速检查内容是否值得记忆
 * @param userContent 用户输入内容
 * @param assistantContent 助手回复内容
 * @returns 是否值得记忆
 */
export function shouldRememberContent(
  userContent: string,
  assistantContent: string
): boolean {
  const result = analyzeContentForMemory(userContent, assistantContent)
  return result.isWorthRemembering
}
