const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Supabase ==========
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ========== Middleware ==========
app.use(cors());
app.use(express.json());

// ========== Serve Static Files ==========
app.use(express.static(path.join(__dirname, '..')));

// ========== APP_CONFIG ==========
const APP_CONFIG = {
    APP_NAME: "ELONGON",
    MINIMUM_WITHDRAW: 0.03,
    WITHDRAWAL_FEES: 0,
    REFERRAL_PERCENTAGE: 10,
    REFERRAL_POWER_REWARD: 3000,
    MINING_SESSION_HOURS: 5,
    POWER_PER_TON_RATE: 0.0000125,
    TASK_REWARD: 100,
    DAILY_BONUS_AMOUNT: 250,
    TASK_VERIFICATION_DELAY: 10,
    BOT_USERNAME: "Zentrxbot",
    DAILY_CHECK_NEWS_LINK: "https://t.me/Zentrxb",
    BOT_LINK: "https://t.me/Zentrxbot/mine?startapp=",
    GRAM_ICON: "https://i.ibb.co/bgX518dY/IMG-20260622-025621-420.png",
    MINING_ICON: "https://i.ibb.co/S4bGL6HP/file-00000000d87c81f4840d26bb2cef4d7d.png",
    LOGO: "https://i.ibb.co/S4bGL6HP/file-00000000d87c81f4840d26bb2cef4d7d.png",
    DEFAULT_USER_AVATAR: "https://i.ibb.co/S4bGL6HP/file-00000000d87c81f4840d26bb2cef4d7d.png",
    INTERSTITIAL_AD_BLOCK_ID: "int-34445",
    TON_WALLET_ADDRESS: "UQCrXfE4_ktpwyZJzmGuCt6zXE5mErFV8VczSjEZvRuLy9_q",
    QUESTS: {
        welcome_bonus: { reward: 3000, type: "power" },
        level_quests: [
            { target_level: 2, reward: 1000 },
            { target_level: 3, reward: 2000 },
            { target_level: 4, reward: 3000 },
            { target_level: 5, reward: 3000 },
            { target_level: 6, reward: 3000 },
            { target_level: 7, reward: 3000 },
            { target_level: 8, reward: 3000 },
            { target_level: 9, reward: 3000 },
            { target_level: 10, reward: 3000 }
        ],
        mining_quests: [
            { target_starts: 3, reward: 1000 },
            { target_starts: 5, reward: 2000 },
            { target_starts: 10, reward: 3000 },
            { target_starts: 20, reward: 3000 },
            { target_starts: 30, reward: 3000 },
            { target_starts: 40, reward: 3000 },
            { target_starts: 50, reward: 3000 },
            { target_starts: 75, reward: 3000 },
            { target_starts: 100, reward: 3000 }
        ]
    }
};

// ========== Helper Functions ==========
function generateDeviceId(userAgent, screen, timezone, platform, language) {
    const seed = `${userAgent}|${screen}|${timezone}|${platform}|${language}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `dev_${Math.abs(hash).toString(16).padStart(32, '0').substring(0, 32)}`;
}

function extractChatId(url) {
    const match = url.match(/t\.me\/([^\/\?]+)/);
    return match ? match[1] : null;
}

// ========== API Routes ==========

// Config
app.get('/api/config', (req, res) => {
    res.json({ config: APP_CONFIG });
});

// Device Check
app.post('/api/device/check', async (req, res) => {
    const { userId, deviceInfo } = req.body;
    
    const deviceId = generateDeviceId(
        deviceInfo.userAgent,
        deviceInfo.screen,
        deviceInfo.timezone,
        deviceInfo.platform,
        deviceInfo.language
    );
    
    const { data: existing } = await supabase
        .from('devices')
        .select('user_id')
        .eq('device_id', deviceId)
        .single();
    
    if (existing) {
        if (existing.user_id !== userId) {
            return res.status(403).json({ 
                error: 'Device already registered with different user',
                blocked: true 
            });
        }
        return res.json({ deviceId, registered: true });
    }
    
    await supabase
        .from('devices')
        .insert([{ device_id: deviceId, user_id: userId }]);
    
    res.json({ deviceId, registered: false });
});

// User State
app.get('/api/user/:userId/state', async (req, res) => {
    const { userId } = req.params;
    
    const { data, error } = await supabase
        .from('users')
        .select('state')
        .eq('id', userId)
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    
    if (data?.state === 'banned') {
        return res.status(403).json({ error: 'User banned', banned: true });
    }
    
    res.json({ state: data?.state || 'active' });
});

// Get User
app.get('/api/user/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });
    
    if (data.state === 'banned') {
        return res.status(403).json({ error: 'User banned', banned: true });
    }
    
    res.json({ user: data });
});

// Create User
app.post('/api/user', async (req, res) => {
    const { id, username, firstName, photoUrl, referredBy } = req.body;
    
    const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
    
    if (existing) {
        return res.json({ user: existing });
    }
    
    let referrerId = null;
    if (referredBy && referredBy !== id) {
        const { data: referrer } = await supabase
            .from('users')
            .select('id')
            .eq('id', referredBy)
            .single();
        if (referrer) referrerId = referredBy;
    }
    
    const { data, error } = await supabase
        .from('users')
        .insert([{
            id,
            username,
            first_name: firstName,
            photo_url: photoUrl,
            referred_by: referrerId,
            power_balance: 1000,
            ton_balance: 0,
            level: 1,
            state: 'active',
            completed_tasks: [],
            used_promocodes: [],
            quests: {
                welcomeBonusClaimed: false,
                currentLevelQuestIndex: 0,
                currentMiningQuestIndex: 0
            }
        }])
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    
    if (referrerId) {
        await supabase
            .from('users')
            .update({ total_referrals: supabase.raw('total_referrals + 1') })
            .eq('id', referrerId);
    }
    
    res.json({ user: data });
});

// Update User
app.put('/api/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const updates = req.body;
    
    const { data: existing } = await supabase
        .from('users')
        .select('state')
        .eq('id', userId)
        .single();
    
    if (existing?.state === 'banned') {
        return res.status(403).json({ error: 'User banned' });
    }
    
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: data });
});

// Mining Start
app.post('/api/mining/start', async (req, res) => {
    const { userId } = req.body;
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('mining_active, state')
        .eq('id', userId)
        .single();
    
    if (fetchError) return res.status(400).json({ error: fetchError.message });
    if (user?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    if (user?.mining_active) return res.status(400).json({ error: 'Mining already active' });
    
    const now = Date.now();
    const endTime = now + (APP_CONFIG.MINING_SESSION_HOURS * 3600000);
    
    const { data, error } = await supabase
        .from('users')
        .update({
            mining_active: true,
            mining_start_time: now,
            mining_end_time: endTime,
            total_mining_starts: supabase.raw('total_mining_starts + 1')
        })
        .eq('id', userId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data });
});

// Mining Stop
app.post('/api/mining/stop', async (req, res) => {
    const { userId } = req.body;
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('power_balance, mining_start_time, mining_active, state')
        .eq('id', userId)
        .single();
    
    if (fetchError) return res.status(400).json({ error: fetchError.message });
    if (user?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    if (!user?.mining_active) return res.status(400).json({ error: 'Mining not active' });
    
    const elapsedHours = Math.min((Date.now() - user.mining_start_time) / 3600000, APP_CONFIG.MINING_SESSION_HOURS);
    const hourlyRate = (user.power_balance / 1000) * APP_CONFIG.POWER_PER_TON_RATE;
    const reward = hourlyRate * elapsedHours;
    
    const { data, error } = await supabase
        .from('users')
        .update({
            mining_active: false,
            mining_start_time: null,
            mining_end_time: null,
            pending_ton_reward: reward
        })
        .eq('id', userId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, reward, data });
});

// Mining Claim
app.post('/api/mining/claim', async (req, res) => {
    const { userId } = req.body;
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('ton_balance, pending_ton_reward, state')
        .eq('id', userId)
        .single();
    
    if (fetchError) return res.status(400).json({ error: fetchError.message });
    if (user?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    
    const reward = user.pending_ton_reward || 0;
    if (reward <= 0) return res.status(400).json({ error: 'No rewards to claim' });
    
    const newBalance = (user.ton_balance || 0) + reward;
    
    const { data, error } = await supabase
        .from('users')
        .update({
            ton_balance: newBalance,
            pending_ton_reward: 0
        })
        .eq('id', userId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data, claimed: reward });
});

// Quest Claim
app.post('/api/mining/quest/claim', async (req, res) => {
    const { userId, questType } = req.body;
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('power_balance, level, total_mining_starts, quests, state')
        .eq('id', userId)
        .single();
    
    if (fetchError) return res.status(400).json({ error: fetchError.message });
    if (user?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    
    const quests = user.quests || { welcomeBonusClaimed: false, currentLevelQuestIndex: 0, currentMiningQuestIndex: 0 };
    let reward = 0;
    let updatedQuests = { ...quests };
    
    if (questType === 'welcome') {
        if (quests.welcomeBonusClaimed) {
            return res.status(400).json({ error: 'Already claimed' });
        }
        reward = APP_CONFIG.QUESTS.welcome_bonus.reward;
        updatedQuests.welcomeBonusClaimed = true;
    } else if (questType === 'level') {
        const currentQuest = APP_CONFIG.QUESTS.level_quests[quests.currentLevelQuestIndex];
        if (!currentQuest) return res.status(400).json({ error: 'No quest available' });
        if (user.level < currentQuest.target_level) {
            return res.status(400).json({ error: 'Level requirement not met' });
        }
        reward = currentQuest.reward;
        updatedQuests.currentLevelQuestIndex = quests.currentLevelQuestIndex + 1;
    } else if (questType === 'mining') {
        const currentQuest = APP_CONFIG.QUESTS.mining_quests[quests.currentMiningQuestIndex];
        if (!currentQuest) return res.status(400).json({ error: 'No quest available' });
        if (user.total_mining_starts < currentQuest.target_starts) {
            return res.status(400).json({ error: 'Mining count requirement not met' });
        }
        reward = currentQuest.reward;
        updatedQuests.currentMiningQuestIndex = quests.currentMiningQuestIndex + 1;
    } else {
        return res.status(400).json({ error: 'Invalid quest type' });
    }
    
    const newPower = (user.power_balance || 0) + reward;
    
    const { data, error } = await supabase
        .from('users')
        .update({
            power_balance: newPower,
            quests: updatedQuests
        })
        .eq('id', userId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data, reward });
});

// Complete Task
app.post('/api/task/complete', async (req, res) => {
    const { userId, taskId, reward, url, verification, isMainTask, isSocialTask, taskData } = req.body;
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('power_balance, completed_tasks, state')
        .eq('id', userId)
        .single();
    
    if (fetchError) return res.status(400).json({ error: fetchError.message });
    if (user?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    
    const completedTasks = user.completed_tasks || [];
    if (completedTasks.includes(taskId)) {
        return res.status(400).json({ error: 'Task already completed' });
    }
    
    if (verification && url) {
        const chatId = extractChatId(url);
        if (chatId) {
            const BOT_TOKEN = process.env.BOT_TOKEN;
            if (BOT_TOKEN) {
                try {
                    const botIdResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
                    const botData = await botIdResponse.json();
                    const botId = botData.result?.id;
                    
                    if (botId) {
                        const botMember = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${chatId}&user_id=${botId}`);
                        const botMemberData = await botMember.json();
                        const isBotAdmin = ['administrator', 'creator'].includes(botMemberData.result?.status);
                        
                        if (isBotAdmin) {
                            const memberResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${chatId}&user_id=${userId}`);
                            const memberData = await memberResponse.json();
                            const isMember = ['member', 'administrator', 'creator'].includes(memberData.result?.status);
                            
                            if (!isMember) {
                                return res.status(400).json({ error: 'User not member of channel' });
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Verification check failed:', e);
                }
            }
        }
    }
    
    const newPower = (user.power_balance || 0) + reward;
    const newCompletedTasks = [...completedTasks, taskId];
    
    const updates = {
        power_balance: newPower,
        completed_tasks: newCompletedTasks
    };
    
    if (isSocialTask && taskData) {
        updates.total_tasks_completed = supabase.raw('total_tasks_completed + 1');
        const { data: taskOwner } = await supabase
            .from('social_tasks')
            .select('total_completions')
            .eq('id', taskId)
            .single();
        
        if (taskOwner) {
            await supabase
                .from('social_tasks')
                .update({ total_completions: (taskOwner.total_completions || 0) + 1 })
                .eq('id', taskId);
        }
    }
    
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data });
});

// Promo Code Apply
app.post('/api/promo/apply', async (req, res) => {
    const { userId, code } = req.body;
    
    const { data: promo, error: promoError } = await supabase
        .from('promoCodes')
        .select('*')
        .eq('code', code)
        .single();
    
    if (promoError || !promo) {
        return res.status(400).json({ error: 'Invalid promo code' });
    }
    
    if (promo.total_uses >= promo.max_uses) {
        return res.status(400).json({ error: 'Promo code expired' });
    }
    
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('power_balance, ton_balance, used_promocodes, state')
        .eq('id', userId)
        .single();
    
    if (userError) return res.status(400).json({ error: userError.message });
    if (user?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    
    const usedPromocodes = user.used_promocodes || [];
    if (usedPromocodes.includes(code)) {
        return res.status(400).json({ error: 'Promo code already used' });
    }
    
    let updateField = {};
    let rewardAmount = promo.reward;
    
    if (promo.reward_type === 'power') {
        updateField = { power_balance: (user.power_balance || 0) + promo.reward };
    } else {
        updateField = { ton_balance: (user.ton_balance || 0) + promo.reward };
    }
    
    updateField.used_promocodes = [...usedPromocodes, code];
    
    const { data, error } = await supabase
        .from('users')
        .update(updateField)
        .eq('id', userId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    
    await supabase
        .from('promoCodes')
        .update({ total_uses: (promo.total_uses || 0) + 1 })
        .eq('code', code);
    
    res.json({ success: true, reward: rewardAmount, type: promo.reward_type, data });
});

// Withdraw
app.post('/api/withdraw', async (req, res) => {
    const { userId, amount, wallet } = req.body;
    
    if (amount < APP_CONFIG.MINIMUM_WITHDRAW) {
        return res.status(400).json({ error: `Minimum withdrawal is ${APP_CONFIG.MINIMUM_WITHDRAW} GRAM` });
    }
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('ton_balance, state')
        .eq('id', userId)
        .single();
    
    if (fetchError) return res.status(400).json({ error: fetchError.message });
    if (user?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    
    const totalRequired = amount + APP_CONFIG.WITHDRAWAL_FEES;
    if (totalRequired > (user.ton_balance || 0)) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const newBalance = (user.ton_balance || 0) - totalRequired;
    
    const { error: updateError } = await supabase
        .from('users')
        .update({ ton_balance: newBalance })
        .eq('id', userId);
    
    if (updateError) return res.status(400).json({ error: updateError.message });
    
    const { error: withdrawError } = await supabase
        .from('withdrawals')
        .insert([{
            id: Date.now(),
            user_id: userId,
            amount: amount,
            fees: APP_CONFIG.WITHDRAWAL_FEES,
            wallet: wallet,
            status: 'pending',
            created_at: new Date().toISOString()
        }]);
    
    if (withdrawError) return res.status(400).json({ error: withdrawError.message });
    
    res.json({ success: true, newBalance });
});

// Get Withdrawals
app.get('/api/withdrawals/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ withdrawals: data || [] });
});

// Team Stats
app.get('/api/team/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('total_referrals')
        .eq('id', userId)
        .single();
    
    if (userError) return res.status(400).json({ error: userError.message });
    
    const { data: referrals, error: refError } = await supabase
        .from('users')
        .select('id, first_name, photo_url, created_at')
        .eq('referred_by', userId)
        .limit(20);
    
    if (refError) return res.status(400).json({ error: refError.message });
    
    res.json({
        totalReferrals: user?.total_referrals || 0,
        referrals: referrals || []
    });
});

// Referral Reward
app.post('/api/referral/reward', async (req, res) => {
    const { referrerId, reward } = req.body;
    
    const { data: referrer, error: fetchError } = await supabase
        .from('users')
        .select('power_balance, state')
        .eq('id', referrerId)
        .single();
    
    if (fetchError) return res.status(400).json({ error: fetchError.message });
    if (referrer?.state === 'banned') return res.status(403).json({ error: 'User banned' });
    
    const { data, error } = await supabase
        .from('users')
        .update({
            power_balance: (referrer.power_balance || 0) + reward,
            total_referrals: supabase.raw('total_referrals + 1')
        })
        .eq('id', referrerId)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data });
});

// Bot Check Channel
app.post('/api/bot/check-channel', async (req, res) => {
    const { userId, channel } = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        return res.json({ isMember: true, error: 'bot_not_configured' });
    }
    
    try {
        const botIdResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botData = await botIdResponse.json();
        const botId = botData.result?.id;
        
        if (!botId) {
            return res.json({ isMember: true, error: 'bot_not_found' });
        }
        
        const botMember = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${botId}`);
        const botMemberData = await botMember.json();
        const isBotAdmin = ['administrator', 'creator'].includes(botMemberData.result?.status);
        
        if (!isBotAdmin) {
            return res.json({ isMember: true, error: 'bot_not_admin' });
        }
        
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${userId}`);
        const data = await response.json();
        const isMember = ['member', 'administrator', 'creator'].includes(data.result?.status);
        
        return res.json({ isMember });
    } catch (error) {
        return res.json({ isMember: false, error: error.message });
    }
});

// Bot Check Admin
app.post('/api/bot/check-admin', async (req, res) => {
    const { channel } = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        return res.json({ isAdmin: false, error: 'bot_not_configured' });
    }
    
    try {
        const botIdResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botData = await botIdResponse.json();
        const botId = botData.result?.id;
        
        if (!botId) {
            return res.json({ isAdmin: false, error: 'bot_not_found' });
        }
        
        const botMember = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${botId}`);
        const botMemberData = await botMember.json();
        const isBotAdmin = ['administrator', 'creator'].includes(botMemberData.result?.status);
        
        return res.json({ isAdmin: isBotAdmin });
    } catch (error) {
        return res.json({ isAdmin: false, error: error.message });
    }
});

// Bot Check Admin By URL
app.post('/api/bot/check-admin-url', async (req, res) => {
    const { taskUrl } = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        return res.json({ isAdmin: false, error: 'bot_not_configured' });
    }
    
    const chatId = extractChatId(taskUrl);
    if (!chatId) {
        return res.json({ isAdmin: false, error: 'Invalid channel URL' });
    }
    
    try {
        const botIdResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botData = await botIdResponse.json();
        const botId = botData.result?.id;
        
        if (!botId) {
            return res.json({ isAdmin: false, error: 'bot_not_found' });
        }
        
        const botMember = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${chatId}&user_id=${botId}`);
        const botMemberData = await botMember.json();
        const isBotAdmin = ['administrator', 'creator'].includes(botMemberData.result?.status);
        
        return res.json({ isAdmin: isBotAdmin, chatId });
    } catch (error) {
        return res.json({ isAdmin: false, error: error.message });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ========== Serve Index.html for all other routes ==========
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ========== Start Server ==========
app.listen(PORT, () => {
    console.log(`🚀 ELONGON API running on port ${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '..')}`);
});
