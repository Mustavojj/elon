import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'gram_pirates_jwt_2026_x7k9m2n4v8w6';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'gram_pirates_refresh_2026_a1c3e5g7i9k0';

const requestCooldown = new Map();
const notifiedUsers = new Set();
const getUserCache = new Map();

console.log('🔍 Server starting...');
console.log('🔍 BOT_TOKEN exists:', !!BOT_TOKEN);
console.log('🔍 JWT_SECRET exists:', !!JWT_SECRET);
console.log('🔍 SUPABASE_URL exists:', !!supabaseUrl);
console.log('🔍 SUPABASE_KEY exists:', !!supabaseKey);

function logError(endpoint, error, req = null) {
    console.error(`❌ [${endpoint}] Error:`, error.message || error);
    if (req) {
        console.error(`📥 Request body:`, JSON.stringify(req.body).substring(0, 500));
        console.error(`👤 User:`, req._userId || req.body?.userId || 'unknown');
    }
    if (error.stack) {
        console.error(`📚 Stack:`, error.stack.substring(0, 500));
    }
}

function logInfo(endpoint, message, data = null) {
    console.log(`ℹ️ [${endpoint}] ${message}`);
    if (data) {
        console.log(`📊 Data:`, JSON.stringify(data).substring(0, 300));
    }
}

async function isDeviceUsedByOtherUser(deviceId, currentUserId) {
    if (!deviceId) return false;
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, device_id')
            .eq('device_id', deviceId)
            .neq('id', currentUserId)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            logError('isDeviceUsedByOtherUser', error);
        }
        return !!data;
    } catch (error) {
        logError('isDeviceUsedByOtherUser', error);
        return false;
    }
}

function checkCooldown(userId, endpoint) {
    const now = Date.now();
    const key = `${userId}_${endpoint}`;
    const lastCall = requestCooldown.get(key) || 0;
    if (now - lastCall < 3000) return false;
    requestCooldown.set(key, now);
    return true;
}

function validateUserId(userId) {
    return userId && typeof userId === 'number' && userId > 0;
}

function generateJWT(userId, deviceId) {
    return jwt.sign({ userId, deviceId }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logInfo('verifyJWT', 'Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            logInfo('verifyJWT', 'Invalid token:', error.message);
        }
        return null;
    }
}

function authenticate(req, res, next) {
    let token = req.cookies?.token;
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }
    
    if (!token) {
        logInfo('authenticate', '❌ No token provided');
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = verifyJWT(token);
    if (!decoded) {
        logInfo('authenticate', '❌ Invalid or expired token');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    logInfo('authenticate', `✅ Token verified for user: ${decoded.userId}`);
    req._userId = decoded.userId;
    req._deviceId = decoded.deviceId;
    next();
}

async function validateDevice(userId, deviceId) {
    if (!deviceId) return true;
    try {
        const { data: user } = await supabase
            .from('users')
            .select('device_id')
            .eq('id', userId)
            .single();
        if (!user) return true;
        if (user.device_id && user.device_id !== deviceId) {
            logInfo('validateDevice', `❌ Device mismatch: ${user.device_id} vs ${deviceId}`);
            return false;
        }
        return true;
    } catch (error) {
        logError('validateDevice', error);
        return true;
    }
}

async function checkBotIsAdminInChannel(channelUsername) {
    if (!BOT_TOKEN) {
        logInfo('checkBotIsAdminInChannel', '❌ BOT_TOKEN not configured');
        return false;
    }
    try {
        logInfo('checkBotIsAdminInChannel', `🔍 Checking bot admin in @${channelUsername}`);
        
        const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
        if (!botInfo.ok) {
            logInfo('checkBotIsAdminInChannel', `❌ Telegram API error: ${botInfo.description}`);
            return false;
        }
        const botId = botInfo.result.id;
        
        const botMember = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channelUsername}&user_id=${botId}`
        ).then(r => r.json());
        
        if (!botMember.ok) {
            logInfo('checkBotIsAdminInChannel', `❌ Failed to check bot membership: ${botMember.description}`);
            return false;
        }
        
        const isAdmin = ['administrator', 'creator'].includes(botMember.result?.status);
        logInfo('checkBotIsAdminInChannel', `✅ Bot admin: ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        logError('checkBotIsAdminInChannel', error);
        return false;
    }
}

const APP_CONFIG = {
    APP_NAME: "GRAM PIRATES 🏴‍☠️",
    BOT_USERNAME: "GramPirateBot",
    MINIMUM_WITHDRAW: 150,
    WITHDRAWAL_FEES: 50,
    REFERRAL_PERCENTAGE: 10,
    MINING_SESSION_HOURS: 12,
    POWER_PER_DAY_RATE: 0.005,
    TASK_VERIFICATION_DELAY: 10,
    DEFAULT_USER_AVATAR: "https://i.ibb.co/W4FRWY3z/c53854a65b5a.jpg",
    TON_WALLET_ADDRESS: "UQCrXfE4_ktpwyZJzmGuCt6zXE5mErFV8VczSjEZvRuLy9_q",
    PAYMENT_WALLET: "UQCrXfE4_ktpwyZJzmGuCt6zXE5mErFV8VczSjEZvRuLy9_q",
    INTERSTITIAL_AD_BLOCK_ID: "int-41677",
    REWARD_AD_BLOCK_ID: "41675",
    BOT_LINK: "https://t.me/GramPirateBot/app?startapp=",
    TASK_REWARD: 100,
    TASK_IMAGE: "https://i.ibb.co/0jQS8FTT/d9e462774511.jpg",
    GRAM_ICON: "https://i.ibb.co/Q3LyfHL6/file-00000000aec481f4a4599f4c3a9fee9a.png",
    GOLD_ICON: "https://cdn-icons-png.flaticon.com/512/6466/6466968.png",
    MINING_ICON: "https://i.ibb.co/W4FRWY3z/c53854a65b5a.jpg",
    PIRATE_TO_GRAM_RATE: 10000,
    GOLD_TO_POWER_RATE: 1,
    POWER_BONUS_PERCENTAGE: 10,
    REFERRAL_TASKS_PERCENTAGE: 20,
    REFERRAL_PROMO_PERCENTAGE: 20,
    REFERRAL_MINING_PERCENTAGE: 10,
    REFERRAL_MAX_PERCENTAGE: 50,
    REFERRAL_MAX_COMMISSION_GOLD: 20,
    REFERRAL_MAX_COMMISSION_POWER: 100,
    AD_REWARD_POWER: 20,
    MONETAG_AD_REWARD_POWER: 20,
    AD_COOLDOWN_MINUTES: 5,
    MONETAG_AD_COOLDOWN_MINUTES: 3,
    AD_DAILY_LIMIT: 10,
    MIN_CLAIM_GOLD: 1,
    PRICE_PER_100: 0.001,
    SOCIAL_GOLD_REWARD: 1,
    PAYMENTS_CHANNEL: "https://t.me/Pirates_Proof",
    QUESTS: {
        welcome_bonus: { reward: 1000, type: "power" },
        level_quests: [
            { target_level: 2, reward: 1000 },
            { target_level: 3, reward: 2000 },
            { target_level: 4, reward: 3000 },
            { target_level: 5, reward: 4000 },
            { target_level: 6, reward: 5000 },
            { target_level: 7, reward: 6000 },
            { target_level: 8, reward: 7000 },
            { target_level: 9, reward: 8000 },
            { target_level: 10, reward: 9000 }
        ],
        task_quests: [
            { target_tasks: 10, reward: 500 },
            { target_tasks: 50, reward: 1000 },
            { target_tasks: 100, reward: 2000 },
            { target_tasks: 500, reward: 3000 },
            { target_tasks: 1000, reward: 5000 }
        ],
        referral_quests: [
            { target_referrals: 5, reward: 1000 },
            { target_referrals: 10, reward: 2000 },
            { target_referrals: 25, reward: 4000 },
            { target_referrals: 50, reward: 7000 },
            { target_referrals: 100, reward: 10000 },
            { target_referrals: 250, reward: 15000 },
            { target_referrals: 500, reward: 20000 },
            { target_referrals: 1000, reward: 30000 }
        ]
    }
};

function calculateLevel(power) {
    if (power >= 600000) return 10;
    if (power >= 500000) return 9;
    if (power >= 400000) return 8;
    if (power >= 300000) return 7;
    if (power >= 200000) return 6;
    if (power >= 100000) return 5;
    if (power >= 80000) return 4;
    if (power >= 40000) return 3;
    if (power >= 20000) return 2;
    return 1;
}

async function updateUserLevel(userId) {
    const user = await getUser(userId);
    if (!user) return;
    const newLevel = calculateLevel(user.power_balance || 0);
    if (user.level !== newLevel) {
        await updateUser(userId, { level: newLevel });
    }
    return newLevel;
}

function getCurrentTime() {
    return Date.now();
}

function calculateMiningReward(powerBalance, startTime, endTime) {
    const sessionHours = (endTime - startTime) / 3600000;
    const dailyRate = (powerBalance / 1000) * 5;
    const hourlyRate = dailyRate / 24;
    return hourlyRate * sessionHours;
}

async function addReferralCommission(referrerId, amount, type) {
    if (!referrerId || amount <= 0) return;
    
    const referrer = await getUser(referrerId);
    if (!referrer || referrer.state === 'ban') return;

    const MAX_GOLD = APP_CONFIG.REFERRAL_MAX_COMMISSION_GOLD || 20;
    const MAX_POWER = APP_CONFIG.REFERRAL_MAX_COMMISSION_POWER || 100;

    let updates = {};
    let actualAmount = 0;

    if (type === 'gold') {
        const current = referrer.referral_gold_earnings || 0;
        actualAmount = Math.min(amount, MAX_GOLD);
        updates.referral_gold_earnings = current + actualAmount;
    } else if (type === 'power') {
        const current = referrer.referral_power_earnings || 0;
        actualAmount = Math.min(amount, MAX_POWER);
        updates.referral_power_earnings = current + actualAmount;
    }

    if (Object.keys(updates).length > 0) {
        await updateUser(referrerId, updates);
    }
}

async function checkLargeTransaction(userId, amount, source) {
    if (amount >= 500) {
        const user = await getUser(userId);
        const adminId = process.env.ADMIN_USER_ID;
        if (adminId) {
            await sendTelegramNotification(
                adminId,
                '💰 LARGE TRANSACTION!',
                `User: ${user.first_name} (${userId})\n💎 Amount: +${amount.toFixed(3)} GOLD\n📌 Source: ${source}`
            );
        }
    }
}

async function checkUserBanned(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('state')
            .eq('id', userId)
            .single();
        if (error) return false;
        return user.state === 'ban';
    } catch (error) {
        return false;
    }
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
        return data;
    } catch (error) {
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
        throw error;
    }
}

async function getTasks(category, userId) {
    try {
        let query = supabase
            .from('tasks')
            .select('*')
            .eq('status', 'active');
        
        if (category) {
            query = query.eq('category', category);
        }
        
        const { data: tasks, error } = await query;
        if (error) throw error;
        
        const { data: completed } = await supabase
            .from('user_completed_tasks')
            .select('task_id')
            .eq('user_id', userId);
        
        const completedIds = new Set(completed.map(t => t.task_id));
        const availableTasks = tasks.filter(task => !completedIds.has(task.id));
        
        return availableTasks || [];
    } catch (error) {
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
        return data;
    } catch (error) {
        throw error;
    }
}

async function incrementPromoUses(code) {
    try {
        const { data: promo } = await supabase
            .from('promo_codes')
            .select('total_uses')
            .eq('code', code)
            .single();
            
        const newTotal = (promo?.total_uses || 0) + 1;
        
        const { data, error } = await supabase
            .from('promo_codes')
            .update({ total_uses: newTotal })
            .eq('code', code)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    } catch (error) {
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
        return data;
    } catch (error) {
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
    } catch (error) {}
}

async function sendTelegramNotification(userId, title, message, inlineButton = null) {
    if (!BOT_TOKEN) {
        logInfo('sendTelegramNotification', '❌ BOT_TOKEN not configured, skipping notification');
        return;
    }
    try {
        const payload = {
            chat_id: userId,
            text: `*${title}*\n\n${message}`,
            parse_mode: 'Markdown'
        };

        if (inlineButton) {
            payload.reply_markup = {
                inline_keyboard: [
                    [{
                        text: inlineButton.text,
                        url: inlineButton.url
                    }]
                ]
            };
        }

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        logInfo('sendTelegramNotification', `✅ Notification sent to user ${userId}`);
    } catch (error) {
        logError('sendTelegramNotification', error);
    }
}

async function sendWithdrawalProof(channelId, userId, wallet, gramAmount, goldAmount, txHash) {
    if (!BOT_TOKEN || !channelId) {
        logInfo('sendWithdrawalProof', '❌ BOT_TOKEN or channel not configured');
        return;
    }
    try {
        const userIdStr = userId.toString();
        const lastThree = userIdStr.slice(-3);
        const maskedUserId = userIdStr.slice(0, -3) + '***';
        
        const walletFirst = wallet.substring(0, 5);
        const walletLast = wallet.substring(wallet.length - 5);
        const maskedWallet = walletFirst + '****' + walletLast;
        
        const explorerUrl = txHash ? `https://tonviewer.com/transaction/${txHash}` : '#';
        
        const message = `🆕 NEW WITHDRAWAL REQUEST!\n\n` +
            `💀 User: ${maskedUserId}\n` +
            `💰 Amount: ${gramAmount.toFixed(4)} GRAM (${goldAmount.toFixed(0)} Gold)\n` +
            `🔰 Wallet: ${maskedWallet}\n` +
            `⏳ Status: ✅ Confirmed\n\n` +
            `🏴‍☠️ GRAM PIRATES | MINE & EARN`;
        
        const payload = {
            chat_id: channelId,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🔘 View on Explorer',
                        url: explorerUrl
                    }],
                    [{
                        text: '🏴‍☠️ GRAM PIRATES',
                        url: 'https://t.me/GramPirateBot/app'
                    }]
                ]
            }
        };
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        logInfo('sendWithdrawalProof', `✅ Proof sent to channel ${channelId}`);
    } catch (error) {
        logError('sendWithdrawalProof', error);
    }
}

// ✅ دالة متابعة السحوبات المعلقة
async function checkPendingWithdrawals() {
    try {
        logInfo('checkPendingWithdrawals', '🔄 Checking pending withdrawals...');
        
        const { data: withdrawals, error } = await supabase
            .from('withdrawals')
            .select('*')
            .in('status', ['pending', 'processing'])
            .limit(50);
        
        if (error) {
            logError('checkPendingWithdrawals', error);
            return;
        }
        
        if (!withdrawals || withdrawals.length === 0) {
            return;
        }
        
        logInfo('checkPendingWithdrawals', `📋 Found ${withdrawals.length} pending withdrawals`);
        
        const oxapay = new OxaPay({
            apiKey: process.env.OXAPAY_API_KEY,
            sandbox: process.env.NODE_ENV !== 'production'
        });
        
        for (const withdrawal of withdrawals) {
            try {
                const statusResult = await oxapay.getPayoutStatus(withdrawal.tx_id);
                
                if (statusResult && statusResult.data) {
                    const newStatus = statusResult.data.status === 'completed' ? 'completed' : 'processing';
                    const newTxHash = statusResult.data.tx_hash || withdrawal.tx_hash;
                    
                    await supabase
                        .from('withdrawals')
                        .update({ 
                            status: newStatus,
                            tx_hash: newTxHash
                        })
                        .eq('id', withdrawal.id);
                    
                    if (newStatus === 'completed' && withdrawal.status !== 'completed') {
                        logInfo('checkPendingWithdrawals', `✅ Withdrawal ${withdrawal.id} completed!`);
                        
                        await sendTelegramNotification(
                            withdrawal.user_id,
                            '✅ Withdrawal Completed!',
                            `🏴‍☠️ Your withdrawal of ${withdrawal.gram_amount} GRAM has been completed.\n\n🔗 Transaction: ${newTxHash ? `https://tonviewer.com/transaction/${newTxHash}` : 'View on blockchain'}`
                        );
                        
                        const proofChannel = APP_CONFIG.PAYMENTS_CHANNEL || process.env.PAYMENTS_CHANNEL;
                        if (proofChannel) {
                            const channelMatch = proofChannel.match(/t\.me\/([^\/\?]+)/);
                            if (channelMatch) {
                                await sendWithdrawalProof(
                                    '@' + channelMatch[1],
                                    withdrawal.user_id,
                                    withdrawal.wallet,
                                    withdrawal.gram_amount,
                                    withdrawal.amount,
                                    newTxHash
                                );
                            }
                        }
                    }
                }
            } catch (error) {
                logError('checkPendingWithdrawals', error);
            }
        }
        
    } catch (error) {
        logError('checkPendingWithdrawals', error);
    }
}

class OxaPay {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.sandbox = config.sandbox || false;
        this.baseUrl = this.sandbox 
            ? 'https://sandbox.oxapay.com/v1' 
            : 'https://api.oxapay.com/v1';
    }

    async request(endpoint, data) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'payout_api_key': this.apiKey
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                throw new Error('Invalid response from OxaPay');
            }

            if (!response.ok || result.status !== 200) {
                throw new Error(result.message || result.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return result;
        } catch (error) {
            logError('OxaPay.request', error);
            throw error;
        }
    }

    async createPayout(data) {
        try {
            const payload = {
                address: data.toAddress,
                amount: data.amount,
                currency: data.currency || 'GRAM',
                network: data.network || 'TON',
                description: data.description || 'Withdrawal',
                memo: data.memo || 'GRAM PIRATES 🏴‍☠️'
            };

            const result = await this.request('/payout', payload);

            const trackId = result?.data?.track_id || result?.track_id;
            const status = result?.data?.status || result?.status || 'processing';
            const txHash = result?.data?.tx_hash || result?.tx_hash || null;

            return { 
                ...result, 
                trackId: trackId || 'N/A',
                status: status,
                txHash: txHash,
                success: true
            };
        } catch (error) {
            logError('OxaPay.createPayout', error);
            throw error;
        }
    }

    // ✅ الطريقة الصحيحة لـ getPayoutStatus
    async getPayoutStatus(trackId) {
        const url = `${this.baseUrl}/payout/status/${trackId}`;
        const headers = {
            'payout_api_key': this.apiKey
        };

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                throw new Error('Invalid response from OxaPay');
            }

            if (!response.ok || result.status !== 200) {
                throw new Error(result.message || result.error || `HTTP ${response.status}`);
            }

            return result;
        } catch (error) {
            logError('OxaPay.getPayoutStatus', error);
            throw error;
        }
    }
}

// ✅ بدء متابعة السحوبات كل دقيقة
setInterval(async () => {
    await checkPendingWithdrawals();
}, 60000);

// ✅ تشغيل أول فحص بعد 10 ثوانٍ
setTimeout(() => {
    checkPendingWithdrawals();
}, 10000);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: getCurrentTime() });
});

app.get('/api/config', (req, res) => {
    res.json(APP_CONFIG);
});

app.get('/api/current-time', (req, res) => {
    res.json({ serverTime: getCurrentTime() });
});

app.post('/api/check-bot-admin', authenticate, async (req, res) => {
    try {
        const { channel } = req.body;
        logInfo('/api/check-bot-admin', `Checking bot admin for channel: ${channel}`);
        
        if (!channel) {
            return res.status(400).json({ error: 'Channel is required' });
        }
        
        const isAdmin = await checkBotIsAdminInChannel(channel);
        res.json({ isAdmin });
    } catch (error) {
        logError('/api/check-bot-admin', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth', async (req, res) => {
    try {
        const { userId, deviceId, firstName, username, photoUrl } = req.body;
        logInfo('/api/auth', `User: ${userId}, device: ${deviceId}`);
        
        if (!validateUserId(userId)) {
            logInfo('/api/auth', '❌ Invalid userId');
            return res.status(400).json({ error: 'Invalid user' });
        }

        const deviceUsed = await isDeviceUsedByOtherUser(deviceId, userId);
        if (deviceUsed) {
            logInfo('/api/auth', `❌ Device already used by another account: ${deviceId}`);
            return res.status(403).json({ 
                error: 'device_already_used',
                message: 'This device is already linked to another account' 
            });
        }

        let user = await getUser(userId);

        if (!user) {
            logInfo('/api/auth', `🆕 Creating new user: ${userId}`);
            const userData = {
                id: userId,
                username: username || '',
                first_name: firstName || 'User',
                photo_url: photoUrl || APP_CONFIG.DEFAULT_USER_AVATAR,
                created_at: getCurrentTime(),
                power_balance: 0,
                gold_balance: 0,
                gram_balance: 0,
                referral_power_earnings: 0,
                referral_gold_earnings: 0,
                level: 1,
                total_tasks_completed: 0,
                total_mining_starts: 0,
                referral_reward_given: false,
                state: 'active',
                verified: true,
                device_id: deviceId || null,
                quests: {
                    welcome_bonus_claimed: false,
                    current_level_quest_index: 0,
                    current_task_quest_index: 0,
                    current_referral_quest_index: 0
                },
                mining_active: false,
                mining_start_time: null,
                mining_end_time: null,
                pending_gold_reward: 0,
                total_referrals: 0,
                referral_power: 0,
                ad_watch_count: 0,
                ad_last_watch: 0,
                monetag_ad_last_watch: 0,
                promotion: null,
                last_withdraw_time: 0,
                referred_by_verified: false,
                wallet: null,
                task_count: 0
            };

            user = await createUser(userData);
            const token = generateJWT(userId, deviceId);
            
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            logInfo('/api/auth', `✅ New user created: ${userId}`);
            return res.json({ success: true, newUser: true, user, token });
        }

        if (user.device_id && user.device_id !== deviceId) {
            logInfo('/api/auth', `🔐 New device detected for user: ${userId}`);
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            
            await supabase
                .from('verification_codes')
                .upsert({
                    user_id: userId,
                    code: code,
                    expires_at: getCurrentTime() + 300000,
                    created_at: getCurrentTime(),
                    used: false
                });
            
            await sendTelegramNotification(
                userId,
                '🔐 New Device Detected!',
                `A new device is trying to access your account.\n\n🔑 Verification Code: \`${code}\`\n\n⏳ Valid for 5 minutes.`
            );
            
            return res.status(403).json({ error: 'new_device' });
        }

        if (!user.device_id && deviceId) {
            await updateUser(userId, { device_id: deviceId });
            logInfo('/api/auth', `🔒 Device registered for user: ${userId}`);
        }

        const token = generateJWT(userId, deviceId);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        logInfo('/api/auth', `✅ Authenticated user: ${userId}`);
        res.json({ success: true, newUser: false, user, token });

    } catch (error) {
        logError('/api/auth', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-device', async (req, res) => {
    try {
        const { userId, deviceId, code } = req.body;
        logInfo('/api/verify-device', `User: ${userId}, code: ${code}`);
        
        if (!validateUserId(userId) || !code) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const { data: verification, error } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('user_id', userId)
            .eq('code', code)
            .eq('used', false)
            .single();

        if (error || !verification) {
            logInfo('/api/verify-device', '❌ Invalid code');
            return res.status(400).json({ error: 'Invalid code' });
        }

        if (getCurrentTime() > verification.expires_at) {
            logInfo('/api/verify-device', '⏰ Code expired');
            await supabase
                .from('verification_codes')
                .update({ used: true })
                .eq('id', verification.id);
            return res.status(400).json({ error: 'Code expired' });
        }

        await updateUser(userId, { device_id: deviceId });
        await supabase
            .from('verification_codes')
            .update({ used: true })
            .eq('id', verification.id);

        const token = generateJWT(userId, deviceId);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        const user = await getUser(userId);
        logInfo('/api/verify-device', `✅ Device verified for user: ${userId}`);
        res.json({ success: true, token, user });

    } catch (error) {
        logError('/api/verify-device', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/resend-device-code', async (req, res) => {
    try {
        const { userId } = req.body;
        logInfo('/api/resend-device-code', `User: ${userId}`);
        
        if (!validateUserId(userId)) {
            return res.status(400).json({ error: 'Invalid user' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        await supabase
            .from('verification_codes')
            .upsert({
                user_id: userId,
                code: code,
                expires_at: getCurrentTime() + 300000,
                created_at: getCurrentTime(),
                used: false
            });
        
        await sendTelegramNotification(
            userId,
            '🔄 New Verification Code',
            `🔑 Your new verification code: \`${code}\`\n\n⏳ Valid for 5 minutes.`
        );
        
        logInfo('/api/resend-device-code', `✅ New code sent to user: ${userId}`);
        res.json({ success: true });

    } catch (error) {
        logError('/api/resend-device-code', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/refresh', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const deviceId = req._deviceId;
        logInfo('/api/refresh', `User: ${userId}`);
        
        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.state === 'ban') {
            return res.status(403).json({ error: 'Account banned' });
        }
        
        const token = generateJWT(userId, deviceId);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
        logInfo('/api/refresh', `✅ Token refreshed for user: ${userId}`);
        res.json({ success: true, token });

    } catch (error) {
        logError('/api/refresh', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', authenticate, async (req, res) => {
    try {
        logInfo('/api/logout', `User: ${req._userId}`);
        res.clearCookie('token');
        res.json({ success: true });
    } catch (error) {
        logError('/api/logout', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-mining-status', async (req, res) => {
    try {
        logInfo('/api/check-mining-status', 'Checking mining status');
        const { data: users } = await supabase
            .from('users')
            .select('id, mining_active, mining_end_time, mining_start_time, power_balance')
            .eq('mining_active', true)
            .lt('mining_end_time', getCurrentTime());

        let notified = 0;
        let rateLimit = 0;

        for (const user of users || []) {
            if (notifiedUsers.has(user.id)) continue;

            if (rateLimit >= 20) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                rateLimit = 0;
            }

            const reward = calculateMiningReward(
                user.power_balance || 0,
                user.mining_start_time,
                user.mining_end_time
            );

            await supabase
                .from('users')
                .update({
                    mining_active: false,
                    mining_start_time: null,
                    mining_end_time: null,
                    pending_gold_reward: reward
                })
                .eq('id', user.id);

            await sendTelegramNotification(
                user.id,
                '⛏️ Mining Stopped!',
                `🏴‍☠️ Your mining session has ended.\n\n📊 You earned ${reward.toFixed(3)} Gold\n\n🎁 Claim your rewards and restart mining!`,
                { text: 'CLAIM NOW', url: 'https://t.me/GramPirateBot/app' }
            );

            notifiedUsers.add(user.id);
            notified++;
            rateLimit++;
        }

        logInfo('/api/check-mining-status', `✅ Notified ${notified} users`);
        res.json({ success: true, notified });
    } catch (error) {
        logError('/api/check-mining-status', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-welcome-bonus', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/claim-welcome-bonus', `User: ${userId}`);

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.quests?.welcome_bonus_claimed || user.power_balance > 1000) {
            logInfo('/api/claim-welcome-bonus', `❌ Already claimed: ${userId}`);
            return res.status(400).json({ error: 'Already claimed' });
        }

        const reward = APP_CONFIG.QUESTS.welcome_bonus.reward || 1000;

        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + reward,
            quests: {
                ...user.quests,
                welcome_bonus_claimed: true
            }
        });

        await updateUserLevel(userId);

        logInfo('/api/claim-welcome-bonus', `✅ Claimed ${reward} power for user: ${userId}`);
        res.json({
            success: true,
            user: updatedUser,
            reward: reward
        });
    } catch (error) {
        logError('/api/claim-welcome-bonus', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-user', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { referredBy } = req.body;
        logInfo('/api/get-user', `User: ${userId}`);

        const cacheKey = `getUser_${userId}`;
        const cached = getUserCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < 5000) {
            logInfo('/api/get-user', `📦 Returning cached data for user: ${userId}`);
            return res.json(cached.data);
        }

        if (!checkCooldown(userId, req.path)) {
            return res.status(429).json({ error: 'Too many requests. Please wait 5 seconds.' });
        }

        let user = await getUser(userId);
        if (!user) {
            logInfo('/api/get-user', `❌ User not found: ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.state === 'ban') {
            logInfo('/api/get-user', `❌ User banned: ${userId}`);
            return res.status(403).json({ error: 'Account banned', banned: true });
        }

        if (referredBy && !user.referred_by && referredBy !== userId) {
            logInfo('/api/get-user', `🔗 Setting referred_by for user: ${userId} to ${referredBy}`);
            await updateUser(userId, { referred_by: referredBy });
            user = await getUser(userId);
        }

        const [completedTasks, withdrawals] = await Promise.all([
            getCompletedTasks(userId),
            getWithdrawals(userId)
        ]);

        await updateUserLevel(userId);

        const responseData = {
            user: user,
            completedTasks,
            withdrawals
        };

        getUserCache.set(cacheKey, { data: responseData, timestamp: now });
        logInfo('/api/get-user', `✅ Data returned for user: ${userId}`);
        res.json(responseData);

    } catch (error) {
        logError('/api/get-user', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update-user', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { powerBalance, goldBalance, gramBalance, quests, miningActive, miningStartTime, miningEndTime, pendingGoldReward } = req.body;
        logInfo('/api/update-user', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const updates = {};
        if (powerBalance !== undefined) updates.power_balance = powerBalance;
        if (goldBalance !== undefined) updates.gold_balance = goldBalance;
        if (gramBalance !== undefined) updates.gram_balance = gramBalance;
        if (quests !== undefined) updates.quests = quests;
        if (miningActive !== undefined) updates.mining_active = miningActive;
        if (miningStartTime !== undefined) updates.mining_start_time = miningStartTime;
        if (miningEndTime !== undefined) updates.mining_end_time = miningEndTime;
        if (pendingGoldReward !== undefined) updates.pending_gold_reward = pendingGoldReward;

        if (Object.keys(updates).length === 0) {
            return res.json({ success: true });
        }

        const updatedUser = await updateUser(userId, updates);
        await updateUserLevel(userId);

        logInfo('/api/update-user', `✅ User updated: ${userId}`);
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        logError('/api/update-user', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/start-mining', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { serverTime } = req.body;
        logInfo('/api/start-mining', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.mining_active) {
            return res.status(400).json({ error: 'Mining already active' });
        }

        const currentTime = serverTime || getCurrentTime();
        const sessionHours = APP_CONFIG.MINING_SESSION_HOURS || 1;
        const miningEndTime = currentTime + (sessionHours * 3600000);

        notifiedUsers.delete(userId);

        let updatedUser = await updateUser(userId, {
            mining_active: true,
            mining_start_time: currentTime,
            mining_end_time: miningEndTime,
            pending_gold_reward: 0,
            total_mining_starts: (user.total_mining_starts || 0) + 1
        });

        if (!user.referred_by_verified && user.referred_by) {
            const referrer = await getUser(user.referred_by);
            if (referrer) {
                const newTotal = (referrer.total_referrals || 0) + 1;
                await updateUser(user.referred_by, {
                    total_referrals: newTotal
                });
                await updateUser(userId, { referred_by_verified: true });
                updatedUser = await getUser(userId);
            }
        }

        await updateUserLevel(userId);

        logInfo('/api/start-mining', `✅ Mining started for user: ${userId}`);
        res.json({ success: true, user: updatedUser });

    } catch (error) {
        logError('/api/start-mining', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/stop-mining', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/stop-mining', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.mining_active) {
            return res.status(400).json({ error: 'No active mining session' });
        }

        const currentTime = getCurrentTime();

        if (user.mining_end_time && currentTime < user.mining_end_time) {
            return res.status(400).json({ error: 'Mining session not ended yet' });
        }

        const rewardAmount = calculateMiningReward(
            user.power_balance || 0,
            user.mining_start_time,
            user.mining_end_time || currentTime
        );

        const updatedUser = await updateUser(userId, {
            mining_active: false,
            mining_start_time: null,
            mining_end_time: null,
            pending_gold_reward: rewardAmount
        });

        logInfo('/api/stop-mining', `✅ Mining stopped for user: ${userId}, reward: ${rewardAmount}`);
        res.json({ success: true, user: updatedUser, reward: rewardAmount });

    } catch (error) {
        logError('/api/stop-mining', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-mining', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/claim-mining', `💰 User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const level = calculateLevel(user.power_balance || 0);
        if (user.level !== level) {
            await updateUser(userId, { level: level });
            user.level = level;
        }

        if (user.mining_active) {
            return res.status(400).json({ error: 'Mining session still active' });
        }

        const rewardAmount = user.pending_gold_reward || 0;
        if (rewardAmount <= 0) {
            return res.status(400).json({ error: 'No rewards to claim' });
        }

        if (rewardAmount > 1000) {
            logInfo('/api/claim-mining', `❌ Reward too high: ${rewardAmount}`);
            return res.status(400).json({ error: 'Failed to claim reward' });
        }
        
        const maxReward = (user.power_balance / 1000) * 5 * 13;
        
        if (rewardAmount > maxReward) {
            logInfo('/api/claim-mining', `❌ Reward exceeds max: ${rewardAmount} > ${maxReward}`);
            return res.status(400).json({ error: 'Failed to claim reward' });
        }
        
        const newGoldBalance = (user.gold_balance || 0) + rewardAmount;
        
        const updatedUser = await updateUser(userId, {
            gold_balance: newGoldBalance,
            pending_gold_reward: 0,
            mining_start_time: null,
            mining_end_time: null,
            mining_active: false
        });

        notifiedUsers.delete(userId);

        await checkLargeTransaction(userId, rewardAmount, 'Mining Claim');

        if (user.referred_by) {
            const referralEarning = rewardAmount * (APP_CONFIG.REFERRAL_MINING_PERCENTAGE / 100);
            await addReferralCommission(user.referred_by, referralEarning, 'gold');
        }

        await updateUserLevel(userId);

        logInfo('/api/claim-mining', `✅ Claimed ${rewardAmount} gold for user: ${userId}`);
        res.json({ success: true, user: updatedUser, claimed: rewardAmount });

    } catch (error) {
        logError('/api/claim-mining', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-quest', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { questType } = req.body;
        logInfo('/api/claim-quest', `User: ${userId}, type: ${questType}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let reward = 0;
        let newIndex = 0;
        let quests = { ...user.quests };

        if (questType === 'level') {
            const index = user.quests?.current_level_quest_index || 0;
            const quest = APP_CONFIG.QUESTS.level_quests[index];
            
            if (!quest) {
                return res.status(400).json({ error: 'No level quest available' });
            }
            
            if (user.level < quest.target_level) {
                return res.status(400).json({ error: 'Level requirement not met' });
            }
            
            reward = quest.reward;
            newIndex = index + 1;
            quests.current_level_quest_index = newIndex;
            
        } else if (questType === 'task') {
            const index = user.quests?.current_task_quest_index || 0;
            const quest = APP_CONFIG.QUESTS.task_quests[index];
            
            if (!quest) {
                return res.status(400).json({ error: 'No task quest available' });
            }
            
            if (user.total_tasks_completed < quest.target_tasks) {
                return res.status(400).json({ error: 'Task requirement not met' });
            }
            
            reward = quest.reward;
            newIndex = index + 1;
            quests.current_task_quest_index = newIndex;
            
        } else if (questType === 'referral') {
            const index = user.quests?.current_referral_quest_index || 0;
            const quest = APP_CONFIG.QUESTS.referral_quests[index];
            
            if (!quest) {
                return res.status(400).json({ error: 'No referral quest available' });
            }
            
            if (user.total_referrals < quest.target_referrals) {
                return res.status(400).json({ error: 'Referral requirement not met' });
            }
            
            reward = quest.reward;
            newIndex = index + 1;
            quests.current_referral_quest_index = newIndex;
            
        } else {
            return res.status(400).json({ error: 'Invalid quest type' });
        }

        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + reward,
            quests: quests
        });

        await updateUserLevel(userId);

        logInfo('/api/claim-quest', `✅ Claimed ${reward} power for user: ${userId}`);
        res.json({
            success: true,
            user: updatedUser,
            reward: reward,
            questType: questType,
            questIndex: newIndex
        });

    } catch (error) {
        logError('/api/claim-quest', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/complete-task', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { taskId, isPartner, taskOwner } = req.body;
        logInfo('/api/complete-task', `User: ${userId}, task: ${taskId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('reward, total, category')
            .eq('id', taskId)
            .single();

        if (taskError || !task) {
            logInfo('/api/complete-task', `❌ Task not found: ${taskId}`);
            return res.status(404).json({ error: 'Task not found' });
        }

        const { data: completed } = await supabase
            .from('user_completed_tasks')
            .select('task_id')
            .eq('user_id', userId)
            .eq('task_id', taskId)
            .single();

        if (completed) {
            logInfo('/api/complete-task', `❌ Task already completed: ${taskId}`);
            return res.status(400).json({ error: 'Task already completed' });
        }

        await supabase
            .from('tasks')
            .update({ total: (task.total || 0) + 1 })
            .eq('id', taskId);

        await supabase
            .from('user_completed_tasks')
            .insert([{ user_id: userId, task_id: taskId, completed_at: getCurrentTime() }]);

        let totalCompleted = (user.total_tasks_completed || 0) + 1;
        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + task.reward,
            total_tasks_completed: totalCompleted
        });

        if (user.referred_by) {
            const referralEarning = task.reward * (APP_CONFIG.REFERRAL_TASKS_PERCENTAGE / 100);
            await addReferralCommission(user.referred_by, referralEarning, 'power');
        }

        await updateUserLevel(userId);

        logInfo('/api/complete-task', `✅ Task completed for user: ${userId}`);
        res.json({
            success: true,
            user: updatedUser,
            reward: task.reward
        });

    } catch (error) {
        logError('/api/complete-task', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/convert-gold-to-power', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { goldAmount } = req.body;
        logInfo('/api/convert-gold-to-power', `User: ${userId}, amount: ${goldAmount}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const amount = parseFloat(goldAmount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        if (amount > (user.gold_balance || 0)) {
            return res.status(400).json({ error: 'Insufficient Gold balance' });
        }

        const powerAmount = amount * APP_CONFIG.GOLD_TO_POWER_RATE;
        const bonusPower = powerAmount * (APP_CONFIG.POWER_BONUS_PERCENTAGE / 100);
        const totalPower = powerAmount + bonusPower;

        const updatedUser = await updateUser(userId, {
            gold_balance: (user.gold_balance || 0) - amount,
            power_balance: (user.power_balance || 0) + totalPower
        });

        await updateUserLevel(userId);

        logInfo('/api/convert-gold-to-power', `✅ Converted ${amount} gold to ${totalPower} power for user: ${userId}`);
        res.json({
            success: true,
            user: updatedUser,
            converted: powerAmount,
            bonus: bonusPower,
            total: totalPower
        });

    } catch (error) {
        logError('/api/convert-gold-to-power', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-referral-earnings', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { type } = req.body;
        logInfo('/api/claim-referral-earnings', `User: ${userId}, type: ${type}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hasPromotionBonus = user.promotion?.status === 'approved';
        const bonusMultiplier = hasPromotionBonus ? 1.10 : 1;

        let amount = 0;
        let updates = {};

        if (type === 'power') {
            amount = (user.referral_power_earnings || 0) * bonusMultiplier;
            if (amount < APP_CONFIG.MIN_CLAIM_GOLD) {
                return res.status(400).json({ error: `Minimum claim: ${APP_CONFIG.MIN_CLAIM_GOLD} Power` });
            }
            updates = {
                power_balance: (user.power_balance || 0) + amount,
                referral_power_earnings: 0
            };
        } else if (type === 'gold') {
            amount = (user.referral_gold_earnings || 0) * bonusMultiplier;
            if (amount < APP_CONFIG.MIN_CLAIM_GOLD) {
                return res.status(400).json({ error: `Minimum claim: ${APP_CONFIG.MIN_CLAIM_GOLD} Gold` });
            }
            updates = {
                gold_balance: (user.gold_balance || 0) + amount,
                referral_gold_earnings: 0
            };
            
            await checkLargeTransaction(userId, amount, 'Referral Earnings');
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'No earnings to claim' });
        }

        const updatedUser = await updateUser(userId, updates);
        await updateUserLevel(userId);

        logInfo('/api/claim-referral-earnings', `✅ Claimed ${amount} ${type} for user: ${userId}`);
        res.json({
            success: true,
            user: updatedUser,
            claimed: amount,
            type: type,
            bonusApplied: hasPromotionBonus
        });

    } catch (error) {
        logError('/api/claim-referral-earnings', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/apply-promo', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { code } = req.body;
        logInfo('/api/apply-promo', `User: ${userId}, code: ${code}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { data: usedData } = await supabase
            .from('used_promo_codes')
            .select('*')
            .eq('user_id', userId)
            .eq('code', code)
            .single();

        if (usedData) {
            return res.status(400).json({ error: 'Code already used' });
        }

        const promo = await getPromoCode(code);
        if (!promo) {
            return res.status(400).json({ error: 'Invalid promo code' });
        }

        if (promo.max_uses && (promo.total_uses || 0) >= promo.max_uses) {
            return res.status(400).json({ error: 'Promo code expired' });
        }

        await usePromoCode(userId, code);
        await incrementPromoUses(code);

        let updates = {};
        let rewardMessage = '';
        let rewardType = '';

        if (promo.reward_type === 'power') {
            updates.power_balance = (user.power_balance || 0) + promo.reward_amount;
            rewardMessage = `+${promo.reward_amount} Power`;
            rewardType = 'power';
        } else if (promo.reward_type === 'gold') {
            updates.gold_balance = (user.gold_balance || 0) + promo.reward_amount;
            rewardMessage = `+${promo.reward_amount} Gold`;
            rewardType = 'gold';
            
            await checkLargeTransaction(userId, promo.reward_amount, 'Promo Code');
        } else if (promo.reward_type === 'gram') {
            updates.gram_balance = (user.gram_balance || 0) + promo.reward_amount;
            rewardMessage = `+${promo.reward_amount} GRAM`;
            rewardType = 'gram';
        }

        if (user.referred_by && (rewardType === 'power' || rewardType === 'gold')) {
            const referralEarning = promo.reward_amount * (APP_CONFIG.REFERRAL_PROMO_PERCENTAGE / 100);
            const type = rewardType === 'power' ? 'power' : 'gold';
            await addReferralCommission(user.referred_by, referralEarning, type);
        }

        const updatedUser = await updateUser(userId, updates);
        await updateUserLevel(userId);

        logInfo('/api/apply-promo', `✅ Promo applied for user: ${userId}`);
        res.json({
            success: true,
            user: updatedUser,
            reward: rewardMessage
        });

    } catch (error) {
        logError('/api/apply-promo', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/watch-ad', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/watch-ad', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = getCurrentTime();
        const cooldownMs = APP_CONFIG.AD_COOLDOWN_MINUTES * 60 * 1000;

        if (user.ad_last_watch && (now - user.ad_last_watch) < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - user.ad_last_watch)) / 1000);
            return res.status(400).json({ error: `Cooldown: ${remaining}s remaining` });
        }

        const reward = APP_CONFIG.AD_REWARD_POWER || 20;
        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + reward,
            ad_watch_count: (user.ad_watch_count || 0) + 1,
            ad_last_watch: now
        });

        await updateUserLevel(userId);

        logInfo('/api/watch-ad', `✅ Ad watched for user: ${userId}, reward: ${reward}`);
        res.json({
            success: true,
            user: updatedUser,
            reward: reward
        });

    } catch (error) {
        logError('/api/watch-ad', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/watch-monetag-ad', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/watch-monetag-ad', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = getCurrentTime();
        const cooldownMs = APP_CONFIG.MONETAG_AD_COOLDOWN_MINUTES * 60 * 1000;

        if (user.monetag_ad_last_watch && (now - user.monetag_ad_last_watch) < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - user.monetag_ad_last_watch)) / 1000);
            return res.status(400).json({ error: `Cooldown: ${remaining}s remaining` });
        }

        const reward = APP_CONFIG.MONETAG_AD_REWARD_POWER || 20;
        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + reward,
            monetag_ad_last_watch: now
        });

        await updateUserLevel(userId);

        logInfo('/api/watch-monetag-ad', `✅ Monetag ad watched for user: ${userId}, reward: ${reward}`);
        res.json({
            success: true,
            user: updatedUser,
            reward: reward
        });

    } catch (error) {
        logError('/api/watch-monetag-ad', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:category', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { category } = req.params;
        logInfo('/api/tasks', `User: ${userId}, category: ${category}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        if (!checkCooldown(userId, req.path)) {
            return res.status(429).json({ error: 'Too many requests. Please wait 5 seconds.' });
        }
        
        const tasks = await getTasks(category, userId);
        logInfo('/api/tasks', `✅ Returned ${tasks.length} tasks for category: ${category}`);
        res.json({ tasks });
        
    } catch (error) {
        logError('/api/tasks', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/my-tasks', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/my-tasks', `User: ${userId}`);
        
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('owner', userId)
            .eq('category', 'social')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        logInfo('/api/my-tasks', `✅ Returned ${tasks?.length || 0} tasks for user: ${userId}`);
        res.json({ tasks: tasks || [] });
    } catch (error) {
        logError('/api/my-tasks', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/delete-task', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { taskId } = req.body;
        logInfo('/api/delete-task', `User: ${userId}, task: ${taskId}`);
        
        const { data: task, error: checkError } = await supabase
            .from('tasks')
            .select('owner')
            .eq('id', taskId)
            .single();
        
        if (checkError || !task) {
            logInfo('/api/delete-task', `❌ Task not found: ${taskId}`);
            return res.status(404).json({ error: 'Task not found' });
        }
        
        if (task.owner !== userId) {
            logInfo('/api/delete-task', `❌ Unauthorized: user ${userId} trying to delete task ${taskId}`);
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        await supabase
            .from('tasks')
            .update({ status: 'inactive' })
            .eq('id', taskId);
        
        logInfo('/api/delete-task', `✅ Task deleted: ${taskId}`);
        res.json({ success: true });
    } catch (error) {
        logError('/api/delete-task', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-payment', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { memo, amount, taskData } = req.body;
        logInfo('/api/check-payment', `User: ${userId}, memo: ${memo}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const address = APP_CONFIG.PAYMENT_WALLET || APP_CONFIG.TON_WALLET_ADDRESS;
        if (!address) {
            logInfo('/api/check-payment', '❌ Payment wallet not configured');
            return res.status(500).json({ error: 'Payment wallet not configured' });
        }

        logInfo('/api/check-payment', `🔍 Checking transactions for address: ${address}`);
        const response = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${address}&limit=50`);
        const data = await response.json();
        
        if (!data.ok) {
            logInfo('/api/check-payment', '❌ TON API error');
            return res.status(500).json({ error: 'Payment API error' });
        }
        
        let foundTx = null;
        if (data.result && data.result.length > 0) {
            foundTx = data.result.find(tx => {
                const msg = tx.in_msg?.message;
                const msgMatch = msg && msg.includes(memo);
                if (msgMatch) {
                    logInfo('/api/check-payment', `📦 Found transaction with memo: ${memo}`);
                }
                return msgMatch;
            });
        }
        
        if (foundTx) {
            const txAmount = parseFloat(foundTx.in_msg?.value) / 1000000000 || 0;
            const requiredAmount = (taskData.total * taskData.reward / 1000) * (APP_CONFIG.PRICE_PER_100 || 0.001);
            
            logInfo('/api/check-payment', `💰 Tx amount: ${txAmount}, Required: ${requiredAmount}`);
            
            if (txAmount >= requiredAmount * 0.95) {
                let verification = taskData.verification || false;
                if (verification && taskData.link) {
                    const channelMatch = taskData.link.match(/t\.me\/([^\/\?]+)/);
                    if (channelMatch) {
                        const isAdmin = await checkBotIsAdminInChannel(channelMatch[1]);
                        if (!isAdmin) {
                            logInfo('/api/check-payment', `❌ Bot not admin in channel: ${channelMatch[1]}`);
                            return res.json({
                                success: false,
                                error: 'Bot is not admin in the channel. Please add @GramPirateBot as admin.'
                            });
                        }
                    }
                }
                
                const taskId = crypto.randomUUID();
                const taskToAdd = {
                    id: taskId,
                    name: taskData.name,
                    url: taskData.link,
                    category: 'social',
                    reward: taskData.reward,
                    total: taskData.total,
                    verification: verification,
                    owner: userId,
                    status: 'active',
                    created_at: getCurrentTime(),
                    total_completed: 0
                };

                logInfo('/api/check-payment', `📝 Adding task: ${taskData.name}`);
                const { data: taskResult, error: taskError } = await supabase
                    .from('tasks')
                    .insert([taskToAdd])
                    .select()
                    .single();

                if (taskError) {
                    logError('/api/check-payment', taskError);
                    return res.status(500).json({ error: 'Failed to add task' });
                }

                await updateUser(userId, { task_count: (user.task_count || 0) + 1 });

                await sendTelegramNotification(
                    userId,
                    '✅ Task Added Successfully!',
                    `🏴‍☠️ Your social task "${taskData.name}" has been added.\n\n📊 Total: ${taskData.total}\n💎 Reward: ${taskData.reward} Power\n🪙 Gold: ${APP_CONFIG.SOCIAL_GOLD_REWARD || 1}\n🔗 Link: ${taskData.link}`
                );

                logInfo('/api/check-payment', `✅ Task added successfully: ${taskResult.id}`);
                return res.json({
                    success: true,
                    task: taskResult,
                    message: 'Payment verified and task added'
                });
            } else {
                logInfo('/api/check-payment', `❌ Insufficient amount: ${txAmount} < ${requiredAmount}`);
                return res.json({
                    success: false,
                    error: 'Insufficient payment amount'
                });
            }
        } else {
            logInfo('/api/check-payment', `❌ Payment not found for memo: ${memo}`);
            return res.json({
                success: false,
                error: 'Payment not found'
            });
        }

    } catch (error) {
        logError('/api/check-payment', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/withdraw-gram', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        const { goldAmount } = req.body;
        logInfo('/api/withdraw-gram', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const walletAddress = user.wallet;
        if (!walletAddress) {
            logInfo('/api/withdraw-gram', `❌ No wallet set for user: ${userId}`);
            return res.status(400).json({ error: 'No wallet set. Please set your wallet first.' });
        }
        
        const gold = parseFloat(goldAmount);
        if (isNaN(gold) || gold <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        const fees = APP_CONFIG.WITHDRAWAL_FEES || 50;
        const netGold = gold - fees;
        
        if (netGold <= 0) {
            return res.status(400).json({ error: `Amount must be greater than fees (${fees} Gold)` });
        }
        
        if (gold < APP_CONFIG.MINIMUM_WITHDRAW) {
            return res.status(400).json({ error: `Minimum withdrawal: ${APP_CONFIG.MINIMUM_WITHDRAW} Gold` });
        }
        
        if (gold > 3000) {
            logInfo('/api/withdraw-gram', `❌ Amount too high: ${gold}`);
            return res.status(400).json({ error: 'Failed to create withdrawal request.' });
        }

        if ((user.power_balance || 0) < 2100) {
            logInfo('/api/withdraw-gram', `❌ Insufficient power: ${user.power_balance}`);
            return res.status(400).json({ error: 'Failed to create withdrawal request.' });
        }

        const accountAge = (Date.now() - user.created_at) / 86400000;
        if (accountAge < 1) {
            logInfo('/api/withdraw-gram', `❌ Account too new: ${accountAge} days`);
            return res.status(400).json({ error: 'Failed to create withdrawal request.' });
        }

        if ((user.total_mining_starts || 0) < 3) {
            logInfo('/api/withdraw-gram', `❌ Not enough mining starts: ${user.total_mining_starts}`);
            return res.status(400).json({ error: 'Failed to create withdrawal request.' });
        }
        
        if ((user.gold_balance || 0) < gold) {
            return res.status(400).json({ error: 'Insufficient Gold balance' });
        }

        const gramAmount = netGold / 10000;
        
        const now = Date.now();
        const cooldownMs = 6 * 3600000;
        if (user.last_withdraw_time && (now - user.last_withdraw_time) < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - user.last_withdraw_time)) / 3600000);
            return res.status(400).json({ error: `Wait ${remaining}h before next withdrawal` });
        }
        
        const oxapay = new OxaPay({
            apiKey: process.env.OXAPAY_API_KEY,
            sandbox: process.env.NODE_ENV !== 'production'
        });
        
        logInfo('/api/withdraw-gram', `💰 Creating payout for user: ${userId}`);
        const payout = await oxapay.createPayout({
            toAddress: walletAddress,
            amount: gramAmount,
            currency: 'GRAM',
            network: 'TON',
            description: `Withdraw ${gramAmount} GRAM for user ${userId}`,
            memo: 'GRAM PIRATES 🏴‍☠️'
        });
        
        if (!payout || !payout.success) {
            logInfo('/api/withdraw-gram', `❌ Payout failed: ${payout?.message || 'Unknown error'}`);
            return res.status(500).json({ 
                error: payout?.message || payout?.error || 'Payout failed' 
            });
        }
        
        const trackId = payout?.data?.track_id || payout?.trackId || 'N/A';
        const status = 'processing';
        const txHash = payout?.data?.tx_hash || payout?.txHash || null;
        
        const updatedUser = await updateUser(userId, {
            gold_balance: (user.gold_balance || 0) - gold,
            last_withdraw_time: now
        });
        
        const withdrawal = await createWithdrawal({
            user_id: userId,
            amount: gold,
            fees: fees,
            gram_amount: gramAmount,
            wallet: walletAddress,
            status: status,
            timestamp: now,
            tx_id: trackId,
            tx_hash: txHash
        });
        
        await sendTelegramNotification(userId, '🔄 Withdrawal Processing', 
            `🏴‍☠️ Your withdrawal of ${gramAmount} GRAM is being processed.\n\n⏳ You will receive a confirmation shortly.`,
            { text: '🏴‍☠️ Earn More', url: 'https://t.me/GramPirateBot/app' }
        );
        
        const adminId = process.env.ADMIN_USER_ID;
        if (adminId) {
            await sendTelegramNotification(adminId, '🆕 New Withdrawal', 
                `🏴‍☠️ User: ${userId}\n\n🏅 Amount: ${gold} Gold (${gramAmount} GRAM)\n\n💳 Wallet: ${walletAddress}\n\n📋 Track ID: ${trackId}`
            );
        }
        
        logInfo('/api/withdraw-gram', `✅ Withdrawal processed for user: ${userId}`);
        res.json({
            success: true,
            user: updatedUser,
            withdrawal: withdrawal,
            gramAmount: gramAmount,
            trackId: trackId,
            status: status,
            txHash: txHash
        });
        
    } catch (error) {
        logError('/api/withdraw-gram', error, req);
        res.status(500).json({ error: 'Failed to send withdrawal request: ' + error.message });
    }
});

app.post('/api/get-withdrawals', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/get-withdrawals', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const withdrawals = await getWithdrawals(userId);
        logInfo('/api/get-withdrawals', `✅ Returned ${withdrawals.length} withdrawals`);
        res.json({ withdrawals });

    } catch (error) {
        logError('/api/get-withdrawals', error, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-referrals', authenticate, async (req, res) => {
    try {
        const userId = req._userId;
        logInfo('/api/get-referrals', `User: ${userId}`);

        const validDevice = await validateDevice(userId, req._deviceId);
        if (!validDevice) {
            return res.status(403).json({ error: 'Device mismatch' });
        }

        const referrals = await getReferrals(userId);
        logInfo('/api/get-referrals', `✅ Returned ${referrals.length} referrals`);
        res.json({ referrals });

    } catch (error) {
        logError('/api/get-referrals', error, req);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏴‍☠️ GRAM PIRATES server running on port ${PORT}`);
    console.log(`🔍 BOT_TOKEN exists: ${!!BOT_TOKEN}`);
    console.log(`🔍 JWT_SECRET exists: ${!!JWT_SECRET}`);
    console.log(`🔍 SUPABASE_URL exists: ${!!supabaseUrl}`);
    console.log(`🔍 SUPABASE_KEY exists: ${!!supabaseKey}`);
});

server.on('error', (error) => {
    console.error('Server error:', error);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});
