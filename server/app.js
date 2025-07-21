const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // 引入 UUID 库生成唯一ID

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080']
}));
app.use(express.json());

const HISTORY_FILE = 'history.json';
const PLANS_FILE = 'plans.json';

// 辅助函数：读取历史记录
const readHistory = () => {
    try {
        if (!fs.existsSync(HISTORY_FILE)) {
            fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
        }
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading history file, creating new one or returning empty:', error.message);
        return [];
    }
};

// 辅助函数：写入历史记录
const writeHistory = (history) => {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing history file:', error.message);
    }
};

// 辅助函数：读取规划
const readPlans = () => {
    try {
        if (!fs.existsSync(PLANS_FILE)) {
            fs.writeFileSync(PLANS_FILE, '[]', 'utf8');
        }
        const data = fs.readFileSync(PLANS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading plans file, creating new one or returning empty:', error.message);
        return [];
    }
};

// 辅助函数：写入规划
const writePlans = (plans) => {
    try {
        fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing plans file:', error.message);
    }
};

// 路由：处理聊天请求
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const qwenApiKey = process.env.QWEN_API_KEY;
        if (!qwenApiKey) {
            console.error('QWEN_API_KEY is not set in .env file');
            return res.status(500).json({ error: 'Server configuration error: API key missing.' });
        }

        let conversationHistory = readHistory();
        const maxHistoryLength = 10;
        if (conversationHistory.length > maxHistoryLength) {
            conversationHistory = conversationHistory.slice(conversationHistory.length - maxHistoryLength);
        }

        const messages = conversationHistory.map(record => ({
            role: record.role,
            content: record.content
        }));
        messages.push({ role: 'user', content: userMessage });

        // **修改后的 systemPrompt**
        const systemPrompt = {
            role: 'system',
            content: `你是一个多功能的智能助手，能够处理用户的日程规划和食谱查询请求，并能够从口语化输入中提取关键信息。

            你的主要任务有以下两种：

            **模式一：日程规划 (Plan)**
            如果用户明确或暗示要记录一个“日程”、“代办事项”或“提醒”，请你精准地从用户的输入中，过滤掉无关的语气词、情绪表达、抱怨等非核心信息，只保留最具体的“做什么事”和“什么时候做”。
            * **日期解析：** 尽力解析出明确的日期，并转换为 YYYY-MM-DD 格式。如果无法确定具体日期，可以填写“待定”。
            * **事项提炼：** 将用户的描述提炼成一个简洁明了的代办事项内容，移除冗余信息。
            成功提取后，请严格以以下JSON格式返回，不要有任何其他额外文字、解释或寒暄：
            {
              "type": "plan",
              "date": "YYYY-MM-DD", // 或 "待定"
              "item": "精炼后的规划事项内容"
            }
            **示例 (Plan):**
            用户: 明天晚上我要去新荣记和张吃饭，诶呀真的事情好多
            AI回复: { "type": "plan", "date": "2025-07-22", "item": "与张在新荣记吃饭" } (假设今天是2025-07-21)

            **模式二：食谱推荐 (Recipe)**
            如果用户询问或要求提供食谱（例如“我想吃健康的”、“推荐一个晚餐食谱”、“有什么中餐菜谱”、“我想做一份西餐”），请你根据用户的要求，提供专业、健康的食谱。食谱应包含菜名、食材、主要步骤，并可包含健康提示或营养信息。食谱内容应清晰、易于理解和操作。
            成功生成食谱后，请严格以以下JSON格式返回，不要有任何其他额外文字、解释或寒暄：
            {
              "type": "recipe",
              "name": "菜肴名称",
              "cuisine": "菜系 (如: 中餐, 西餐, 意式, 川菜等)",
              "health_tip": "健康小贴士 (可选)",
              "ingredients": [ // 列表形式的食材
                "食材1: 用量",
                "食材2: 用量"
              ],
              "instructions": [ // 列表形式的步骤
                "步骤1描述",
                "步骤2描述"
              ]
            }
            **示例 (Recipe):**
            用户: 给我来个健康的晚餐食谱
            AI回复: { "type": "recipe", "name": "香煎三文鱼配烤蔬菜", "cuisine": "西餐", "health_tip": "三文鱼富含Omega-3脂肪酸，有益心血管健康。", "ingredients": ["三文鱼: 200克", "西兰花: 100克", "彩椒: 50克", "橄榄油: 1汤匙", "盐: 适量", "黑胡椒: 适量"], "instructions": ["1. 预热烤箱至200°C。", "2. 西兰花和彩椒切块，与橄榄油、盐、黑胡椒拌匀，放入烤盘。", "3. 三文鱼用盐和黑胡椒腌制。", "4. 烤箱烤蔬菜15分钟，同时用平底锅煎三文鱼至两面金黄。", "5. 将烤好的蔬菜和三文鱼摆盘即可。"] }

            **普通对话 (Chat Reply)**
            如果用户的请求不属于上述任何一种模式（例如闲聊、提问、或没有明确的日程或食谱意图），则正常进行对话，直接返回纯文本回复，不要返回JSON格式。

            请你根据用户的最新消息，智能判断属于哪种模式并给出相应回复。`
        };

        const fullMessages = [systemPrompt, ...messages];

        const response = await axios.post(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
                model: 'qwen-turbo',
                input: {
                    messages: fullMessages
                },
                parameters: {
                    result_format: 'message'
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${qwenApiKey}`,
                }
            }
        );

        let aiReplyContent = '抱歉，未能获取到有效的AI回复。';
        if (response.data && response.data.output &&
            Array.isArray(response.data.output.choices) &&
            response.data.output.choices.length > 0 &&
            response.data.output.choices[0].message &&
            typeof response.data.output.choices[0].message.content === 'string') {
            aiReplyContent = response.data.output.choices[0].message.content;
        } else {
            console.error('Unexpected Qwen API response structure or missing content:', response.data);
        }

        let parsedPlan = null;
        let parsedRecipe = null;
        let responseType = 'chat_reply';

        try {
            const potentialResponse = JSON.parse(aiReplyContent);
            if (potentialResponse.type === 'plan' && potentialResponse.date && potentialResponse.item) {
                parsedPlan = {
                    id: uuidv4(),
                    date: potentialResponse.date,
                    item: potentialResponse.item,
                    timestamp: new Date().toISOString()
                };
                responseType = 'plan_saved';
            } else if (potentialResponse.type === 'recipe' && potentialResponse.name && potentialResponse.ingredients && potentialResponse.instructions) {
                // 确保ingredients和instructions是数组
                if (Array.isArray(potentialResponse.ingredients) && Array.isArray(potentialResponse.instructions)) {
                    parsedRecipe = potentialResponse;
                    responseType = 'recipe';
                }
            }
        } catch (e) {
            // Not a JSON, or invalid JSON, proceed as normal chat reply
        }

        if (responseType === 'plan_saved') {
            const plans = readPlans();
            plans.push(parsedPlan);
            writePlans(plans);
            res.json({ reply: `好的，已为您记录：${parsedPlan.item}，日期：${parsedPlan.date}`, type: responseType, plan: parsedPlan });
        } else if (responseType === 'recipe') {
            res.json({ reply: '好的，这是为您推荐的食谱：', type: responseType, recipe: parsedRecipe });
        }
        else {
            res.json({ reply: aiReplyContent, type: responseType });
        }

        // 只有在非食谱响应时才将AI的原始文本回复加入历史，避免食谱JSON直接进入历史
        if (responseType === 'chat_reply') {
            conversationHistory.push({ role: 'user', content: userMessage });
            conversationHistory.push({ role: 'assistant', content: aiReplyContent });
            writeHistory(conversationHistory);
        } else if (responseType === 'plan_saved') {
             // 对于日程，将AI的确认回复加入历史
            conversationHistory.push({ role: 'user', content: userMessage });
            conversationHistory.push({ role: 'assistant', content: `[已记录日程] ${parsedPlan.item} (${parsedPlan.date})` });
            writeHistory(conversationHistory);
        } else if (responseType === 'recipe') {
             // 对于食谱，将AI的摘要加入历史
            conversationHistory.push({ role: 'user', content: userMessage });
            conversationHistory.push({ role: 'assistant', content: `[已提供食谱] ${parsedRecipe.name}` });
            writeHistory(conversationHistory);
        }


    } catch (error) {
        console.error('Error in /chat endpoint:', error);
        if (error.response && error.response.data && error.response.data.code && error.response.data.message) {
            console.error('Qwen API Error Details:', error.response.data);
            res.status(error.response.status).json({ error: `AI模型错误：${error.response.data.code} - ${error.response.data.message}` });
        } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
             res.status(503).json({ error: '网络连接问题：无法连接到AI模型服务。' });
        }
        else {
            res.status(500).json({ error: 'Failed to get response from AI model.' });
        }
    }
});

// 路由：获取历史记录
app.get('/history', (req, res) => {
    const history = readHistory();
    res.json(history);
});

// 路由：获取规划本内容
app.get('/get_plans', (req, res) => {
    const plans = readPlans();
    plans.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(plans);
});

// 新增路由：手动添加规划
app.post('/add_plan', (req, res) => {
    const { date, item } = req.body;
    if (!date || !item) {
        return res.status(400).json({ error: 'Date and item are required for adding a plan.' });
    }

    const newPlan = {
        id: uuidv4(), // 为手动添加的规划生成唯一ID
        date: date,
        item: item,
        timestamp: new Date().toISOString()
    };

    const plans = readPlans();
    plans.push(newPlan);
    writePlans(plans);

    res.status(200).json({ message: 'Plan added successfully', plan: newPlan });
});

// 新增路由：删除规划
app.post('/delete_plan', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: 'Plan ID is required for deleting a plan.' });
    }

    let plans = readPlans();
    const initialLength = plans.length;
    plans = plans.filter(plan => plan.id !== id);

    if (plans.length < initialLength) {
        writePlans(plans);
        res.status(200).json({ message: 'Plan deleted successfully' });
    } else {
        res.status(404).json({ error: 'Plan not found.' });
    }
});


// 启动服务器
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});