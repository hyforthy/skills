# image-generator

AI图像生成专家 skill，围绕四大核心维度（主体、风格、比例、约束）自动解析用户输入，构建高质量提示词，调用图像生成模型输出图片。

## 功能

- 支持两类图片：**场景图**（人物/风景/氛围）和**信息展示图**（思维导图/路线图/流程图/海报等）
- 自动匹配最佳风格，或使用用户指定风格
- 自动推断画面比例
- 构建结构化提示词（内容层 + 风格层 + 技术层）
- 支持两个图像生成提供商，用户可指定，未指定时默认使用 Seedream

## 提供商

| 提供商 | 脚本 | 触发关键词 | 默认 |
|--------|------|-----------|------|
| **Seedream**（即梦） | `scripts/seedream_generate.py` | "seedream"、"即梦"、"火山"、"volcengine" | ✓ |
| **Gemini** | `scripts/generate.py` | "gemini"、"谷歌"、"google"、"nanobanana" | — |

## 依赖

将 API 密钥写入 skill 根目录的 `.env` 文件（脚本自动读取），或直接配置为环境变量。

### Seedream（默认）

```bash
# .env
VOLC_ACCESSKEY=your_access_key
VOLC_SECRETKEY=your_secret_key
```

密钥申请：[火山引擎控制台](https://console.volcengine.com/iam/keymanage/)

```bash
pip install volcengine requests
```

### Gemini

```bash
# .env
GEMINI_API_KEY=your_api_key_here
```

API Key 申请：[Google AI Studio](https://aistudio.google.com/apikey)

```bash
pip install google-genai
```

## 文件结构

```
image-generator/
├── SKILL.md              # skill 主体逻辑
├── README.md             # 本文件
├── .env                  # API 密钥（自行创建，不提交）
├── scripts/
│   ├── generate.py       # Gemini 图像生成脚本
│   └── seedream_generate.py  # Seedream 图像生成脚本
└── references/
    └── styles.md         # 完整风格词库（13种单一风格 + 组合推荐）
```

## 使用方式

直接向 Claude 描述你想要的图片即可触发，例如：

- `画一张赛博朋克风格的城市夜景`
- `生成一张 AI 学习路线图，风景版`
- `帮我做一个励志金句卡片：不积跬步，无以至千里`
- `用 gemini 画一张赛博朋克城市`
- `用即梦生成一张人像写真`

## 风格词库

`references/styles.md` 包含 13 种预设风格的完整词条：

| 风格 | 适用场景 |
|------|---------|
| 写实摄影风 | 人物、产品、商业 |
| 电影感风格 | 情绪表达、故事叙述 |
| 商业插画风 | 知识类、信息图 |
| 动漫风格 | 人物角色 |
| 游戏概念艺术风 | 史诗场景、幻想世界 |
| 赛博朋克风 | 科技、AI、未来感 |
| 蒸汽波风格 | 复古潮流 |
| 油画风格 | 艺术感、古典 |
| 水彩手绘风格 | 治愈、自然、温柔 |
| 3D渲染风 | 产品展示、科技感 |
| 极简设计风 | 高级感、留白构图 |
| 超现实主义风 | 情绪、哲学表达 |
| 吉卜力风 | 奇幻、治愈、自然 |
