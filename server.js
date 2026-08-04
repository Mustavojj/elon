import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.stdout._handle.setBlocking(true);
process.send && process.send('ready');

if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
}

function writeLog(level, context, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        context,
        message,
        data: data || null
    };
    
    const colors = {
        error: '\x1b[31m',
        warn: '\x1b[33m',
        info: '\x1b[36m',
        success: '\x1b[32m',
        reset: '\x1b[0m'
    };
    
    const color = colors[level] || colors.info;
    const logLine = `${color}[${level.toUpperCase()}] ${timestamp} | ${context} | ${message}${colors.reset}`;
    console.log(logLine);
    process.stdout.write(logLine + '\n');
    
    if (data) {
        const dataLine = JSON.stringify(data, null, 2);
        console.log(dataLine);
        process.stdout.write(dataLine + '\n');
    }
    
    try {
        const logFile = `./logs/app-${new Date().toISOString().split('T')[0]}.log`;
        const logText = `[${level.toUpperCase()}] ${timestamp} | ${context} | ${message}\n`;
        fs.appendFileSync(logFile, logText);
        if (data) {
            fs.appendFileSync(logFile, JSON.stringify(data, null, 2) + '\n');
        }
    } catch (e) {}
}

function logError(context, error, userId = null) {
    const errorData = {
        userId: userId || 'unknown',
        message: error.message || error,
        stack: error.stack || 'No stack trace'
    };
    const errorMessage = error.message || error;
    writeLog('error', context, errorMessage, errorData);
    process.stderr.write(`[ERROR] ${context}: ${errorMessage}\n`);
    return errorData;
}

function logInfo(context, message, data = null) {
    writeLog('info', context, message, data);
}

function logSuccess(context, message, data = null) {
    writeLog('success', context, message, data);
}

function logWarn(context, message, data = null) {
    writeLog('warn', context, message, data);
}

logInfo('SERVER', '🏴‍☠️ PIRATE TEAM Server Starting...');
logInfo('SERVER', `Environment: ${process.env.NODE_ENV || 'development'}`);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.BOT_TOKEN;

const APP_CONFIG = {
    APP_NAME: "PIRATE TEAM",
    BOT_USERNAME: "PirateTeamBot",
    MINIMUM_WITHDRAW: 0.03,
    WITHDRAWAL_FEES: 0,
    REFERRAL_PERCENTAGE: 10,
    REFERRAL_POWER_REWARD: 3000,
    MINING_SESSION_HOURS: 5,
    POWER_PER_TON_RATE: 0.0000125,
    TASK_VERIFICATION_DELAY: 10,
    DEFAULT_USER_AVATAR: "https://i.ibb.co/XxXhyZYf/file-000000006f8c720e9ab4c76b6e560062.png",
    TON_WALLET_ADDRESS: "UQCrXfE4_ktpwyZJzmGuCt6zXE5mErFV8VczSjEZvRuLy9_q",
    INTERSTITIAL_AD_BLOCK_ID: "int-34445",
    BOT_LINK: "https://t.me/PirateTeamBot/mine?startapp=",
    DAILY_CHECK_NEWS_LINK: "https://t.me/PirateTeamNews",
    REFERRAL_REQUIRED_TASKS: 5,
    REFERRAL_REQUIRED_MINES: 2,
    TASK_REWARD: 100,
    TASK_IMAGE: "https://i.ibb.co/bjyVgYqJ/256e636cf3a0.jpg",
    GRAM_ICON: "https://i.ibb.co/Q3LyfHL6/file-00000000aec481f4a4599f4c3a9fee9a.png",
    PIRATE_ICON: "https://i.ibb.co/TqFMpkmh/file-00000000a1e482439c3eb9ba48a9444c.png",
    MINING_ICON: "https://i.ibb.co/bgCmP0nc/file-000000000a7c81f4951741e43e428778.png",
    REFERRAL_LINK: "https://t.me/PirateTeamChannel",
    PIRATE_TO_GRAM_RATE: 10000,
    PIRATE_TO_POWER_RATE: 1000,
    POWER_BONUS_PERCENTAGE: 10,
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
        ],
        referral_quests: [
            { target_referrals: 5, reward: 5000 },
            { target_referrals: 10, reward: 10000 },
            { target_referrals: 25, reward: 25000 },
            { target_referrals: 50, reward: 50000 }
        ]
    }
};

function getCurrentTime() {
    return Date.now();
}

function extractChatIdFromUrl(url) {
    const match = url.match(/t\.me\/([^\/\?]+)/);
    return match ? match[1] : null;
}

async function getUser(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (error) {
        logError('getUser', error, userId);
        return null;
    }
}

async function createUser(userData) {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
        if (error) throw error;
        logSuccess('createUser', `User ${userData.id} created`, { userId: userData.id });
        return data;
    } catch (error) {
        logError('createUser', error, userData.id);
        throw error;
    }
}

async function updateUser(userId, updates) {
    try {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        logError('updateUser', error, userId);
        throw error;
    }
}

async function getTasks(category) {
    try {
        let query = supabase.from('tasks').select('*').eq('status', 'active');
        if (category) {
            query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (error) {
        logError('getTasks', error);
        return [];
    }
}

async function getCompletedTasks(userId) {
    try {
        const { data, error } = await supabase
            .from('user_completed_tasks')
            .select('task_id')
            .eq('user_id', userId);
        if (error) throw error;
        return data ? data.map(t => t.task_id) : [];
    } catch (error) {
        logError('getCompletedTasks', error, userId);
        return [];
    }
}

async function getWithdrawals(userId) {
    try {
        const { data, error } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(10);
        if (error) throw error;
        return data || [];
    } catch (error) {
        logError('getWithdrawals', error, userId);
        return [];
    }
}

async function getReferrals(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, first_name, username, created_at')
            .eq('referred_by', userId);
        if (error) throw error;
        return data || [];
    } catch (error) {
        logError('getReferrals', error, userId);
        return [];
    }
}

async function getPromoCode(code) {
    try {
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', code)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (error) {
        logError('getPromoCode', error);
        return null;
    }
}

async function usePromoCode(userId, code) {
    try {
        const { data, error } = await supabase
            .from('used_promo_codes')
            .insert([{ user_id: userId, code }])
            .select()
            .single();
        if (error) throw error;
        logSuccess('usePromoCode', `User ${userId} used promo ${code}`);
        return data;
    } catch (error) {
        logError('usePromoCode', error, userId);
        throw error;
    }
}

async function incrementPromoUses(code) {
    try {
        const { data, error } = await supabase
            .from('promo_codes')
            .update({ total_uses: supabase.sql`total_uses + 1` })
            .eq('code', code)
            .select()
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        logError('incrementPromoUses', error);
        throw error;
    }
}

async function createWithdrawal(withdrawalData) {
    try {
        const { data, error } = await supabase
            .from('withdrawals')
            .insert([withdrawalData])
            .select()
            .single();
        if (error) throw error;
        logSuccess('createWithdrawal', `Withdrawal created for user ${withdrawalData.user_id}`, { amount: withdrawalData.amount });
        return data;
    } catch (error) {
        logError('createWithdrawal', error, withdrawalData.user_id);
        throw error;
    }
}

async function updateStats(statName, increment) {
    try {
        const { data } = await supabase
            .from('stats')
            .select('value')
            .eq('key', statName)
            .single();

        if (data) {
            await supabase
                .from('stats')
                .update({ value: (data.value || 0) + increment })
                .eq('key', statName);
        } else {
            await supabase
                .from('stats')
                .insert([{ key: statName, value: increment }]);
        }
    } catch (error) {
        logError('updateStats', error);
    }
}

async function sendTelegramNotification(userId, title, message) {
    if (!BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: userId,
                text: `*${title}*\n\n${message}`,
                parse_mode: 'Markdown'
            })
        });
        logInfo('sendTelegramNotification', `Notification sent to ${userId}`);
    } catch (error) {
        logError('sendTelegramNotification', error, userId);
    }
}

app.get('/', (req, res) => {
    logInfo('GET /', 'Serving index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: getCurrentTime() });
});

app.get('/api/config', (req, res) => {
    logInfo('GET /api/config', 'Config requested');
    res.json(APP_CONFIG);
});

app.get('/api/current-time', (req, res) => {
    res.json({ serverTime: getCurrentTime() });
});

app.post('/api/get-user', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            logWarn('getUser endpoint', 'userId required');
            return res.status(400).json({ error: 'userId required' });
        }

        logInfo('getUser endpoint', `Fetching user ${userId}`);
        let user = await getUser(userId);
        
        if (!user) {
            const { referredBy } = req.body;
            const userData = {
                id: userId,
                username: req.body.username || '',
                first_name: req.body.firstName || 'User',
                photo_url: req.body.photoUrl || APP_CONFIG.DEFAULT_USER_AVATAR,
                referred_by: referredBy || null,
                created_at: getCurrentTime(),
                power_balance: 1000,
                pirate_balance: 0,
                gram_balance: 0,
                level: 1,
                total_tasks_completed: 0,
                total_mining_starts: 0,
                referral_reward_given: false,
                state: 'active',
                quests: {
                    welcome_bonus_claimed: false,
                    current_level_quest_index: 0,
                    current_mining_quest_index: 0,
                    current_referral_quest_index: 0
                },
                mining_active: false,
                mining_start_time: null,
                mining_end_time: null,
                pending_pirate_reward: 0,
                total_referrals: 0,
                referral_power: 0
            };
            
            user = await createUser(userData);
            
            if (referredBy && referredBy !== userId) {
                const referrer = await getUser(referredBy);
                if (referrer) {
                    await updateUser(referredBy, { 
                        total_referrals: (referrer.total_referrals || 0) + 1 
                    });
                    await sendTelegramNotification(
                        referredBy,
                        'New Referral',
                        `${userData.first_name} joined using your link!`
                    );
                }
            }
            
            await updateStats('total_users', 1);
        }

        const [completedTasks, withdrawals, referrals] = await Promise.all([
            getCompletedTasks(userId),
            getWithdrawals(userId),
            getReferrals(userId)
        ]);

        logSuccess('getUser endpoint', `User ${userId} loaded successfully`);
        res.json({
            user,
            completedTasks,
            withdrawals,
            referrals
        });

    } catch (error) {
        logError('getUser endpoint', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update-mining', async (req, res) => {
    try {
        const { userId, miningActive, miningStartTime, miningEndTime, pendingPirateReward } = req.body;
        if (!userId) {
            logWarn('updateMining', 'userId required');
            return res.status(400).json({ error: 'userId required' });
        }

        const updates = {
            mining_active: miningActive,
            mining_start_time: miningStartTime,
            mining_end_time: miningEndTime,
            pending_pirate_reward: pendingPirateReward || 0
        };

        if (miningActive) {
            const user = await getUser(userId);
            if (user) {
                updates.total_mining_starts = (user.total_mining_starts || 0) + 1;
                logInfo('updateMining', `User ${userId} started mining (${user.total_mining_starts + 1} total)`);
            }
        }

        const user = await updateUser(userId, updates);
        res.json({ success: true, user });

    } catch (error) {
        logError('updateMining', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-mining', async (req, res) => {
    try {
        const { userId, pirateAmount } = req.body;
        if (!userId) {
            logWarn('claimMining', 'userId required');
            return res.status(400).json({ error: 'userId required' });
        }

        const user = await getUser(userId);
        if (!user) {
            logWarn('claimMining', `User ${userId} not found`);
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.pending_pirate_reward <= 0) {
            logWarn('claimMining', `No rewards to claim for user ${userId}`);
            return res.status(400).json({ error: 'No rewards to claim' });
        }

        const rewardAmount = parseFloat(pirateAmount) || user.pending_pirate_reward;
        const newPirateBalance = (user.pirate_balance || 0) + rewardAmount;
        const updatedUser = await updateUser(userId, {
            pirate_balance: newPirateBalance,
            pending_pirate_reward: 0,
            mining_active: false,
            mining_start_time: null,
            mining_end_time: null
        });

        logSuccess('claimMining', `User ${userId} claimed ${rewardAmount} Pirate`);
        res.json({ 
            success: true, 
            user: updatedUser,
            claimed: rewardAmount
        });

    } catch (error) {
        logError('claimMining', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/complete-task', async (req, res) => {
    try {
        const { userId, taskId, reward, isPartner, taskOwner } = req.body;
        if (!userId || !taskId) {
            logWarn('completeTask', 'userId and taskId required');
            return res.status(400).json({ error: 'userId and taskId required' });
        }

        const user = await getUser(userId);
        if (!user) {
            logWarn('completeTask', `User ${userId} not found`);
            return res.status(404).json({ error: 'User not found' });
        }

        const completedTasks = await getCompletedTasks(userId);
        if (completedTasks.includes(taskId)) {
            logWarn('completeTask', `Task ${taskId} already completed by user ${userId}`);
            return res.status(400).json({ error: 'Task already completed' });
        }

        const rewardAmount = parseFloat(reward) || APP_CONFIG.TASK_REWARD;

        await supabase
            .from('user_completed_tasks')
            .insert([{ user_id: userId, task_id: taskId, completed_at: getCurrentTime() }]);

        if (isPartner && taskOwner) {
            const { data: taskData } = await supabase
                .from('tasks')
                .select('total_completions')
                .eq('id', taskId)
                .single();
            if (taskData) {
                await supabase
                    .from('tasks')
                    .update({ total_completions: (taskData.total_completions || 0) + 1 })
                    .eq('id', taskId);
            }
        }

        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + rewardAmount,
            total_tasks_completed: (user.total_tasks_completed || 0) + 1
        });

        logSuccess('completeTask', `User ${userId} completed task ${taskId} (+${rewardAmount} Power)`);
        await checkReferralReward(userId);

        res.json({ 
            success: true, 
            user: updatedUser,
            reward: rewardAmount
        });

    } catch (error) {
        logError('completeTask', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/convert-pirate-to-power', async (req, res) => {
    try {
        const { userId, pirateAmount } = req.body;
        if (!userId || !pirateAmount) {
            logWarn('convertPirateToPower', 'userId and pirateAmount required');
            return res.status(400).json({ error: 'userId and pirateAmount required' });
        }

        const user = await getUser(userId);
        if (!user) {
            logWarn('convertPirateToPower', `User ${userId} not found`);
            return res.status(404).json({ error: 'User not found' });
        }

        const amount = parseFloat(pirateAmount);
        if (isNaN(amount) || amount <= 0) {
            logWarn('convertPirateToPower', `Invalid amount: ${pirateAmount}`);
            return res.status(400).json({ error: 'Invalid amount' });
        }

        if (amount > (user.pirate_balance || 0)) {
            logWarn('convertPirateToPower', `Insufficient balance for user ${userId}: ${amount} > ${user.pirate_balance}`);
            return res.status(400).json({ error: 'Insufficient Pirate balance' });
        }

        const powerAmount = amount * APP_CONFIG.PIRATE_TO_POWER_RATE;
        const bonusPower = powerAmount * (APP_CONFIG.POWER_BONUS_PERCENTAGE / 100);
        const totalPower = powerAmount + bonusPower;

        const updatedUser = await updateUser(userId, {
            pirate_balance: (user.pirate_balance || 0) - amount,
            power_balance: (user.power_balance || 0) + totalPower
        });

        logSuccess('convertPirateToPower', `User ${userId} converted ${amount} Pirate to ${totalPower} Power (+${bonusPower} bonus)`);
        res.json({
            success: true,
            user: updatedUser,
            converted: powerAmount,
            bonus: bonusPower,
            total: totalPower
        });

    } catch (error) {
        logError('convertPirateToPower', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/apply-promo', async (req, res) => {
    try {
        const { userId, code } = req.body;
        if (!userId || !code) {
            logWarn('applyPromo', 'userId and code required');
            return res.status(400).json({ error: 'userId and code required' });
        }

        const user = await getUser(userId);
        if (!user) {
            logWarn('applyPromo', `User ${userId} not found`);
            return res.status(404).json({ error: 'User not found' });
        }

        const { data: usedData } = await supabase
            .from('used_promo_codes')
            .select('*')
            .eq('user_id', userId)
            .eq('code', code)
            .single();

        if (usedData) {
            logWarn('applyPromo', `Code ${code} already used by user ${userId}`);
            return res.status(400).json({ error: 'Code already used' });
        }

        const promo = await getPromoCode(code);
        if (!promo) {
            logWarn('applyPromo', `Invalid promo code: ${code}`);
            return res.status(400).json({ error: 'Invalid promo code' });
        }

        if (promo.max_uses && (promo.total_uses || 0) >= promo.max_uses) {
            logWarn('applyPromo', `Promo code ${code} expired (max uses reached)`);
            return res.status(400).json({ error: 'Promo code expired' });
        }

        await usePromoCode(userId, code);
        await incrementPromoUses(code);

        let updates = {};
        let rewardMessage = '';

        if (promo.reward_type === 'power') {
            updates.power_balance = (user.power_balance || 0) + promo.reward_amount;
            rewardMessage = `+${promo.reward_amount} Power`;
        } else if (promo.reward_type === 'pirate') {
            updates.pirate_balance = (user.pirate_balance || 0) + promo.reward_amount;
            rewardMessage = `+${promo.reward_amount} Pirate`;
        } else if (promo.reward_type === 'gram') {
            updates.gram_balance = (user.gram_balance || 0) + promo.reward_amount;
            rewardMessage = `+${promo.reward_amount} GRAM`;
        }

        const updatedUser = await updateUser(userId, updates);
        logSuccess('applyPromo', `User ${userId} applied promo ${code}: ${rewardMessage}`);

        res.json({
            success: true,
            user: updatedUser,
            reward: rewardMessage
        });

    } catch (error) {
        logError('applyPromo', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tasks/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const tasks = await getTasks(category);
        res.json({ tasks });
    } catch (error) {
        logError('getTasks endpoint', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-membership', async (req, res) => {
    try {
        const { userId, channel } = req.body;
        if (!userId || !channel) {
            logWarn('checkMembership', 'userId and channel required');
            return res.status(400).json({ error: 'userId and channel required' });
        }

        if (!BOT_TOKEN) {
            logError('checkMembership', 'BOT_TOKEN not configured');
            return res.status(500).json({ error: 'BOT_TOKEN not configured' });
        }

        const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
        const botId = botInfo.result.id;

        const botMember = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${botId}`
        ).then(r => r.json());

        const isBotAdmin = ['administrator', 'creator'].includes(botMember.result?.status);

        if (!isBotAdmin) {
            logWarn('checkMembership', `Bot is not admin in channel ${channel}`);
            return res.json({ isMember: false, error: 'bot_not_admin' });
        }

        const response = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${userId}`
        ).then(r => r.json());

        const isMember = ['member', 'administrator', 'creator'].includes(response.result?.status);
        logInfo('checkMembership', `User ${userId} membership in ${channel}: ${isMember}`);
        res.json({ isMember });

    } catch (error) {
        logError('checkMembership', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/withdraw', async (req, res) => {
    try {
        const { userId, pirateAmount, wallet } = req.body;
        if (!userId || !pirateAmount || !wallet) {
            logWarn('withdraw', 'userId, pirateAmount, and wallet required');
            return res.status(400).json({ error: 'userId, pirateAmount, and wallet required' });
        }

        if (wallet.length < 20) {
            logWarn('withdraw', `Invalid wallet address: ${wallet}`);
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const user = await getUser(userId);
        if (!user) {
            logWarn('withdraw', `User ${userId} not found`);
            return res.status(404).json({ error: 'User not found' });
        }

        const amount = parseFloat(pirateAmount);
        if (isNaN(amount) || amount <= 0) {
            logWarn('withdraw', `Invalid amount: ${pirateAmount}`);
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const gramAmount = amount / APP_CONFIG.PIRATE_TO_GRAM_RATE;
        if (gramAmount < APP_CONFIG.MINIMUM_WITHDRAW) {
            logWarn('withdraw', `Amount below minimum: ${gramAmount} GRAM`);
            return res.status(400).json({ 
                error: `Minimum withdrawal: ${APP_CONFIG.MINIMUM_WITHDRAW} GRAM (${APP_CONFIG.MINIMUM_WITHDRAW * APP_CONFIG.PIRATE_TO_GRAM_RATE} Pirate)`
            });
        }

        if (amount > (user.pirate_balance || 0)) {
            logWarn('withdraw', `Insufficient balance: ${amount} > ${user.pirate_balance}`);
            return res.status(400).json({ error: 'Insufficient Pirate balance' });
        }

        const newPirateBalance = (user.pirate_balance || 0) - amount;
        const totalGram = gramAmount - (APP_CONFIG.WITHDRAWAL_FEES || 0);

        if (totalGram <= 0) {
            logWarn('withdraw', `Amount too low after fees: ${totalGram}`);
            return res.status(400).json({ error: 'Amount too low after fees' });
        }

        const updatedUser = await updateUser(userId, {
            pirate_balance: newPirateBalance,
            gram_balance: (user.gram_balance || 0) + totalGram
        });

        const withdrawal = {
            user_id: userId,
            amount: amount,
            gram_amount: totalGram,
            fees: APP_CONFIG.WITHDRAWAL_FEES || 0,
            wallet: wallet,
            status: 'pending',
            timestamp: getCurrentTime()
        };

        await createWithdrawal(withdrawal);
        await updateStats('total_withdrawals', 1);
        await updateStats('total_gram_paid', totalGram);

        logSuccess('withdraw', `User ${userId} withdrew ${amount} Pirate → ${totalGram} GRAM`);
        res.json({
            success: true,
            user: updatedUser,
            withdrawal: withdrawal,
            gramAmount: totalGram
        });

    } catch (error) {
        logError('withdraw', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-withdrawals', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            logWarn('getWithdrawals', 'userId required');
            return res.status(400).json({ error: 'userId required' });
        }

        const withdrawals = await getWithdrawals(userId);
        res.json({ withdrawals });

    } catch (error) {
        logError('getWithdrawals endpoint', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-referrals', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            logWarn('getReferrals', 'userId required');
            return res.status(400).json({ error: 'userId required' });
        }

        const referrals = await getReferrals(userId);
        res.json({ referrals });

    } catch (error) {
        logError('getReferrals endpoint', error, req.body.userId);
        res.status(500).json({ error: error.message });
    }
});

async function checkReferralReward(userId) {
    try {
        const user = await getUser(userId);
        if (!user || user.referral_reward_given) return;

        const conditionsMet = (user.total_tasks_completed || 0) >= APP_CONFIG.REFERRAL_REQUIRED_TASKS ||
                              (user.total_mining_starts || 0) >= APP_CONFIG.REFERRAL_REQUIRED_MINES;

        if (conditionsMet && user.referred_by) {
            const referrer = await getUser(user.referred_by);
            if (referrer) {
                const rewardPower = APP_CONFIG.REFERRAL_POWER_REWARD;
                await updateUser(user.referred_by, {
                    power_balance: (referrer.power_balance || 0) + rewardPower,
                    referral_power: (referrer.referral_power || 0) + rewardPower
                });

                await updateUser(userId, { referral_reward_given: true });

                await sendTelegramNotification(
                    user.referred_by,
                    'Referral Bonus',
                    `You received ${rewardPower} Power! Your referral ${user.first_name} completed the requirements.`
                );
                logSuccess('checkReferralReward', `Referral reward given: ${userId} → ${user.referred_by}`);
            }
        }
    } catch (error) {
        logError('checkReferralReward', error, userId);
    }
}

process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
    process.stderr.write(`UNCAUGHT EXCEPTION: ${error.message}\n`);
    logError('uncaughtException', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    process.stderr.write(`UNHANDLED REJECTION: ${reason}\n`);
    logError('unhandledRejection', reason);
});

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
    logSuccess('SERVER', `🏴‍☠️ PIRATE TEAM server running on port ${PORT}`);
    logInfo('SERVER', `⚓ http://localhost:${PORT}`);
    logInfo('SERVER', `📋 Logs enabled - errors will be displayed in console and saved to /logs`);
    logInfo('SERVER', `📁 Logs directory: ${path.join(__dirname, 'logs')}`);
});

server.on('error', (error) => {
    logError('SERVER', error);
    console.error('Server error:', error);
    process.stderr.write(`SERVER ERROR: ${error.message}\n`);
});

process.on('SIGTERM', () => {
    logInfo('SERVER', 'SIGTERM received, closing server...');
    server.close(() => {
        logInfo('SERVER', 'Server closed');
        process.exit(0);
    });
});
