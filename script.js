// script.js

// 获取 DOM 元素 (聊天部分)
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 获取 DOM 元素 (规划本部分)
const planDateInput = document.getElementById('plan-date-input');
const planItemInput = document.getElementById('plan-item-input');
const addPlanBtn = document.getElementById('add-plan-btn');
const planList = document.getElementById('plan-list');
const noPlansMessage = planList.querySelector('.no-plans');

// 获取 DOM 元素 (周历部分)
const currentWeekDisplay = document.getElementById('current-week-display');
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');
const weekDaysContainer = document.getElementById('week-days-container');

// 后端服务的URL
const BACKEND_CHAT_URL = 'http://localhost:3000/chat';
const BACKEND_HISTORY_URL = 'http://localhost:3000/history';
const BACKEND_PLANS_URL = 'http://localhost:3000/get_plans';
const BACKEND_ADD_PLAN_URL = 'http://localhost:3000/add_plan';
const BACKEND_DELETE_PLAN_URL = 'http://localhost:3000/delete_plan';

// 全局变量：用于追踪当前周历显示的起始日期
let currentWeekStartDate = new Date();

// 辅助函数：向聊天框添加消息
function addMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = message; 
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 辅助函数：加载聊天历史记录
async function loadHistory() {
    try {
        const response = await fetch(BACKEND_HISTORY_URL);
        if (!response.ok) {
            throw new Error(`Failed to load history: ${response.status} ${response.statusText}`);
        }
        const history = await response.json();
        
        chatBox.innerHTML = ''; // 清空聊天框
        
        // 添加初始欢迎语
        addMessage('ai', '欢迎使用AI智能日程规划！请告诉我您的安排。');

        history.forEach(record => {
            if (record.role === 'user' || record.role === 'assistant') {
                 addMessage(record.role === 'user' ? 'user' : 'ai', record.content);
            }
        });
    } catch (error) {
        console.error('Error loading chat history:', error);
        // 如果加载历史记录失败，仍然显示欢迎消息
        if (chatBox.children.length === 0) {
            addMessage('ai', '欢迎使用AI智能日程规划！请告诉我您的安排。');
        }
    }
}

// 辅助函数：计算并格式化倒计时
function getCountdownText(planDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 将今天的时分秒毫秒归零

    const planDate = new Date(planDateStr);
    planDate.setHours(0, 0, 0, 0); // 将规划日期的时分秒毫秒归零

    const diffTime = planDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 向上取整，确保当天显示0天差

    if (diffDays === 0) {
        return { text: '今天', class: 'countdown-today' };
    } else if (diffDays > 0) {
        return { text: `还有 ${diffDays} 天`, class: 'countdown-future' };
    } else {
        return { text: '已过期', class: 'countdown-past' };
    }
}

// 加载规划本内容 (修改以在加载后更新周历)
async function loadPlans() {
    try {
        const response = await fetch(BACKEND_PLANS_URL);
        if (!response.ok) {
            throw new Error(`Failed to load plans: ${response.status} ${response.statusText}`);
        }
        let plans = await response.json();

        // --- 新增逻辑：过滤掉一周前的计划 ---
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 将今天的时分秒毫秒归零

        // 获取本周的星期一日期
        let currentMonday = new Date(today);
        const dayOfWeek = currentMonday.getDay(); // 0 for Sunday, 1 for Monday
        // 调整到本周的星期一
        currentMonday.setDate(currentMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        currentMonday.setHours(0,0,0,0); // 确保时间为00:00:00

        // 获取上周的星期一日期
        let lastMonday = new Date(currentMonday);
        lastMonday.setDate(lastMonday.getDate() - 7);

        // 过滤计划：只保留日期在“上周一”或之后（包括未来）的计划
        plans = plans.filter(plan => {
            const planDate = new Date(plan.date);
            planDate.setHours(0,0,0,0); // 归零，用于对比
            return planDate >= lastMonday;
        });
        // --- 过滤逻辑结束 ---

        // **更新：将加载到的所有规划存储起来，供周历使用**
        window.allPlans = plans; 

        planList.innerHTML = ''; // 清空现有规划列表

        if (plans.length === 0) {
            noPlansMessage.style.display = 'block'; // 显示“暂无规划”消息
        } else {
            noPlansMessage.style.display = 'none'; // 隐藏“暂无规划”消息
            plans.forEach(plan => {
                const planItem = document.createElement('div');
                planItem.classList.add('plan-item');

                // 格式化日期
                const dateObj = new Date(plan.date);
                const formattedDate = dateObj.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                // 获取倒计时文本和类名
                const countdown = getCountdownText(plan.date);
                
                planItem.innerHTML = `
                    <div class="plan-info">
                        <div class="plan-date">${formattedDate} <span class="countdown ${countdown.class}">(${countdown.text})</span></div>
                        <div class="plan-content">${plan.item}</div>
                    </div>
                    <button class="delete-btn" data-id="${plan.id}">删除</button>
                `;
                planList.appendChild(planItem);
            });

            // 为每个删除按钮绑定事件监听器
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const planId = event.target.dataset.id;
                    deletePlan(planId);
                });
            });
        }
        // **新增：在加载规划后更新周历显示**
        renderWeekCalendar(currentWeekStartDate); 
    } catch (error) {
        console.error('Error loading plans:', error);
        planList.innerHTML = '<p class="error-message">加载规划失败，请稍后再试。</p>';
        // 如果加载规划失败，仍然尝试渲染周历，但没有数据
        renderWeekCalendar(currentWeekStartDate);
    }
}

// 处理用户发送消息的函数
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    addMessage('user', message);
    userInput.value = '';

    try {
        const response = await fetch(BACKEND_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message }),
        });

        if (!response.ok) {
            let errorText = '未知错误';
            try {
                const errorData = await response.json();
                errorText = errorData.error || JSON.stringify(errorData);
            } catch (jsonError) {
                errorText = `后端服务返回错误: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorText);
        }

        const data = await response.json();

        // 根据后端返回的 type 字段进行不同处理
        if (data.type === 'plan_saved' && data.plan) {
            // 处理日程规划
            addMessage('ai', data.reply); // 显示AI的确认回复
            await loadPlans(); // 重新加载规划列表 (会触发周历更新)
        } else if (data.type === 'recipe' && data.recipe) { // 处理食谱推荐
            // 格式化食谱信息以在聊天框中显示为纯文本
            const recipe = data.recipe;
            let recipeText = `食谱推荐：${recipe.name} (${recipe.cuisine})\n\n`;
            if (recipe.health_tip) {
                recipeText += `健康小贴士：${recipe.health_tip}\n\n`;
            }
            recipeText += '食材：\n' + recipe.ingredients.map(ing => `• ${ing}`).join('\n') + '\n\n';
            recipeText += '步骤：\n' + recipe.instructions.map((inst, index) => `${index + 1}. ${inst}`).join('\n');
            recipeText += '\n\n希望你喜欢这份食谱！';

            addMessage('ai', recipeText); // 在聊天框中显示食谱文本
            
        } else if (data.type === 'chat_reply' && data.reply) {
            // 正常聊天回复
            addMessage('ai', data.reply);
        } else {
            addMessage('ai', '抱歉，未能获取到有效的AI回复。');
        }

    } catch (error) {
        console.error('Error communicating with backend:', error);
        addMessage('ai', `抱歉，与AI通信时发生错误：${error.message} 请稍后再试。`);
    }
}

// 手动添加规划 (修改以在添加后更新周历)
async function addManualPlan() {
    const date = planDateInput.value;
    const item = planItemInput.value.trim();

    if (!date || !item) {
        alert('请填写日期和规划事项！');
        return;
    }

    try {
        const response = await fetch(BACKEND_ADD_PLAN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date, item }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add plan.');
        }

        planDateInput.value = ''; // 清空日期输入框
        planItemInput.value = '';
        await loadPlans(); // 重新加载规划 (会触发周历更新)
        alert('规划事项添加成功！');
    } catch (error) {
        console.error('Error adding plan:', error);
        alert(`添加规划失败：${error.message}`);
    }
}

// 删除规划 (修改以在删除后更新周历)
async function deletePlan(id) {
    if (!confirm('确定要删除这条规划吗？')) {
        return;
    }

    try {
        const response = await fetch(BACKEND_DELETE_PLAN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete plan.');
        }

        await loadPlans(); // 重新加载规划 (会触发周历更新)
        alert('规划事项删除成功！');
    } catch (error) {
        console.error('Error deleting plan:', error);
        alert(`删除规划失败：${error.message}`);
    }
}


// --- 周历功能相关函数 ---

// 新的辅助函数：计算一个月中的第几周
// 约定：每个月的第一周是包含该月第一个星期一的周。
function getWeekNumberInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    
    // 获取该月的第一天
    const firstDayOfMonth = new Date(year, month, 1);
    firstDayOfMonth.setHours(0,0,0,0);

    // 获取该月第一天的星期几 (0: Sunday, 1: Monday, ..., 6: Saturday)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    // 转换为 ISO 星期几 (1: Monday, ..., 7: Sunday)
    const isoFirstDayOfWeek = firstDayOfWeek === 0 ? 7 : firstDayOfWeek;

    // 计算该月第一个星期一的日期
    let firstMondayOfMonth = new Date(firstDayOfMonth);
    if (isoFirstDayOfWeek !== 1) { // 如果第一天不是星期一
        firstMondayOfMonth.setDate(firstDayOfMonth.getDate() + (8 - isoFirstDayOfWeek)); // 跳到第一个星期一
    }
    firstMondayOfMonth.setHours(0,0,0,0);

    // 如果该月的第一天在星期一之后（例如，8月1日是星期五，那么第一个星期一就是8月4日），
    // 并且当前日期在第一个星期一之前，那么它仍算作第一周。
    // 但是，为了简化，我们定义“第一周”为“从包含该月第一个星期一的周开始”。
    // 更好的方法是计算当前日期距离该月第一个星期一有多少天，然后除以7。
    
    const currentDate = new Date(date);
    currentDate.setHours(0,0,0,0);

    // 如果当前日期在第一个星期一之前，我们仍可以将其视为第1周
    if (currentDate < firstMondayOfMonth) {
        // 如果该月1号就是星期一，或者该月1号之前的日子也算1周
        // 这里需要更精确的定义，我采用“从包含该月第一个星期一的周算起”
        // 简化：如果当前日期在第一个星期一所在周，则为第一周。
        const startOfWeekForCurrentDate = new Date(currentDate);
        const currentDayOfWeek = startOfWeekForCurrentDate.getDay();
        const isoCurrentDayOfWeek = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
        startOfWeekForCurrentDate.setDate(startOfWeekForCurrentDate.getDate() - (isoCurrentDayOfWeek - 1)); // 调整到当前周的星期一
        startOfWeekForCurrentDate.setHours(0,0,0,0);

        if (startOfWeekForCurrentDate.getFullYear() === year && startOfWeekForCurrentDate.getMonth() === month) {
             // 如果当前周的星期一仍然在当前月份内，说明是本月的第一周或后续周
             // 但如果当前周的星期一早于或等于该月第一个星期一，那就是第一周。
             if (startOfWeekForCurrentDate.getTime() <= firstMondayOfMonth.getTime()) {
                return 1;
             }
        }
    }


    // 计算当前日期距离该月第一个星期一有多少毫秒
    const diffTime = currentDate.getTime() - firstMondayOfMonth.getTime();
    // 转换为天数，并向上取整除以7，得到周数
    // 例如：0-6天是第1周，7-13天是第2周
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // 向下取整，计算相差的完整天数

    if (diffDays < 0) { // 如果当前日期在第一个星期一之前，通常这会是上个月的最后一周或本月的第一周
        // 这种情况下，需要特殊处理，通常仍算作第1周（如果它属于本月）
        // 这里简化为：如果日期小于该月第一个星期一，且月份相同，则为第1周
        if (currentDate.getMonth() === month && currentDate.getFullYear() === year) {
             return 1;
        } else { // 如果是上个月的日期，不应该调用此函数
            return 0; // 错误或不适用
        }
    }
    
    // 从第一个星期一算起，每7天为一周
    // 0-6天是第一周，7-13天是第二周，以此类推
    const weekNumber = Math.floor(diffDays / 7) + 1;
    return weekNumber;
}


// 辅助函数：格式化日期为 YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 渲染周历的函数
function renderWeekCalendar(startDate) {
    weekDaysContainer.innerHTML = ''; // 清空日历内容
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 归零，用于对比

    // 确保 startDate 是本周的星期一
    let tempDate = new Date(startDate);
    const dayOfWeek = tempDate.getDay(); // 0 for Sunday, 1 for Monday
    // 如果是周日，则 dayOfWeek 是 0，需要减去 6 天才能到上周一
    // 如果是周一，则 dayOfWeek 是 1，需要减去 0 天
    // 统一转换为 ISO week-day (1-7, Monday-Sunday)
    const isoDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 (Sun) -> 6 (Sat), 1 (Mon) -> 0 (Sun)
    tempDate.setDate(tempDate.getDate() - isoDayOfWeek); // 将日期调整到本周的星期一

    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(tempDate);
        currentDate.setDate(tempDate.getDate() + i);
        weekDates.push(currentDate);
    }

    // 更新周标题：yyyy年mm月第w周
    const year = weekDates[0].getFullYear();
    const month = weekDates[0].getMonth() + 1; // 获取起始月的月份
    // *** 关键修改：调用新的 getWeekNumberInMonth 函数 ***
    const weekNumber = getWeekNumberInMonth(weekDates[0]); 
    currentWeekDisplay.textContent = `${year}年${month}月第${weekNumber}周`;

    // 渲染每一天
    weekDates.forEach(date => {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day-cell');

        const formattedDate = formatDate(date);
        // 判断是否是今天
        if (formattedDate === formatDate(today)) {
            dayCell.classList.add('today');
        }

        dayCell.innerHTML = `
            <div class="day-header">
                <span>${days[date.getDay() === 0 ? 6 : date.getDay() - 1]}</span> <span class="date-number">${date.getDate()}</span>
            </div>
            <div class="day-events" data-date="${formattedDate}">
                </div>
        `;
        weekDaysContainer.appendChild(dayCell);
    });

    // 将所有规划事项加载到对应的日期格中
    loadPlansIntoCalendar();
}

// 将所有已加载的规划事项放入日历中
function loadPlansIntoCalendar() {
    if (!window.allPlans) return; // 如果还没有加载规划数据，则不执行

    // 清空所有日历格中的日程
    document.querySelectorAll('.day-events').forEach(eventDiv => {
        eventDiv.innerHTML = '';
    });

    window.allPlans.forEach(plan => {
        const planDate = plan.date; // 规划的日期 'YYYY-MM-DD'
        const targetDayEvents = document.querySelector(`.day-events[data-date="${planDate}"]`);

        if (targetDayEvents) {
            const eventItem = document.createElement('div');
            eventItem.classList.add('day-event-item');
            eventItem.textContent = plan.item;
            targetDayEvents.appendChild(eventItem);
        }
    });
}

// 导航到上一周
function showPrevWeek() {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
    renderWeekCalendar(currentWeekStartDate);
}

// 导航到下一周
function showNextWeek() {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
    renderWeekCalendar(currentWeekStartDate);
}

// 绑定事件监听器 (聊天部分)
if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
} else {
    console.error("Error: sendBtn element not found!");
}

if (userInput) {
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
} else {
    console.error("Error: userInput element not found!");
}

// 绑定事件监听器 (规划本部分)
if (addPlanBtn) {
    addPlanBtn.addEventListener('click', addManualPlan);
} else {
    console.error("Error: addPlanBtn element not found!");
}

if (planItemInput) {
    planItemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addManualPlan();
        }
    });
}

// 绑定事件监听器 (周历部分)
if (prevWeekBtn) {
    prevWeekBtn.addEventListener('click', showPrevWeek);
}
if (nextWeekBtn) {
    nextWeekBtn.addEventListener('click', showNextWeek);
}


// 页面加载完成后，同时加载聊天历史和规划本
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    // 首次加载时，将当前日期设置为周历的起始日期
    // renderWeekCalendar(currentWeekStartDate); // 这行会在loadPlans里调用，避免重复
    loadPlans(); // loadPlans 会触发 renderWeekCalendar 和 loadPlansIntoCalendar

    // 设置日期输入框的默认值为今天
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    planDateInput.value = `${year}-${month}-${day}`;
});