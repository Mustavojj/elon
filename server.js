import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.BOT_TOKEN;

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const strictLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);

const APP_CONFIG = {
    APP_NAME: "GRAM PIRATES 🏴‍☠️",
    BOT_USERNAME: "GramPirateBot",
    MINIMUM_WITHDRAW: 0.03,
    WITHDRAWAL_FEES: 0,
    REFERRAL_PERCENTAGE: 10,
    MINING_SESSION_HOURS: 12,
    POWER_PER_DAY_RATE: 0.003,
    TASK_VERIFICATION_DELAY: 10,
    DEFAULT_USER_AVATAR: "https://i.ibb.co/XxXhyZYf/file-000000006f8c720e9ab4c76b6e560062.png",
    TON_WALLET_ADDRESS: "UQCrXfE4_ktpwyZJzmGuCt6zXE5mErFV8VczSjEZvRuLy9_q",
    INTERSTITIAL_AD_BLOCK_ID: "int-41677",
    REWARD_AD_BLOCK_ID: "41675",
    BOT_LINK: "https://t.me/GramPirateBot/app?startapp=",
    TASK_REWARD: 100,
    TASK_IMAGE: "https://i.ibb.co/bjyVgYqJ/256e636cf3a0.jpg",
    GRAM_ICON: "https://i.ibb.co/Q3LyfHL6/file-00000000aec481f4a4599f4c3a9fee9a.png",
    GOLD_ICON: "https://cdn-icons-png.flaticon.com/512/2460/2460494.png",
    MINING_ICON: "https://i.ibb.co/bgCmP0nc/file-000000000a7c81f4951741e43e428778.png",
    PIRATE_TO_GRAM_RATE: 10000,
    GOLD_TO_POWER_RATE: 1,
    POWER_BONUS_PERCENTAGE: 10,
    REFERRAL_TASKS_PERCENTAGE: 20,
    REFERRAL_PROMO_PERCENTAGE: 20,
    REFERRAL_MINING_PERCENTAGE: 10,
    REFERRAL_MAX_PERCENTAGE: 50,
    AD_REWARD_POWER: 50,
    AD_COOLDOWN_MINUTES: 5,
    AD_DAILY_LIMIT: 10,
    VERIFICATION_CODE_LIFETIME: 60000,
    SESSION_TOKEN_LIFETIME: 3600000,
    MIN_CLAIM_GOLD: 1,
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
        mining_quests: [
            { target_starts: 3, reward: 500 },
            { target_starts: 5, reward: 1000 },
            { target_starts: 10, reward: 2000 },
            { target_starts: 20, reward: 2500 },
            { target_starts: 30, reward: 3000 },
            { target_starts: 40, reward: 3500 },
            { target_starts: 50, reward: 4000 },
            { target_starts: 75, reward: 4500 },
            { target_starts: 100, reward: 5000 }
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

function getCurrentTime() {
    return Date.now();
}

function generateVerificationCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function calculateMiningReward(powerBalance, startTime, endTime) {
    const sessionHours = APP_CONFIG.MINING_SESSION_HOURS || 12;
    const elapsedSeconds = (endTime - startTime) / 1000;
    const elapsedHours = Math.min(elapsedSeconds / 3600, sessionHours);
    
    const dailyRate = (powerBalance / 1000) * 3;
    const hourlyRate = dailyRate / 24;
    
    return hourlyRate * elapsedHours;
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
        const { data, error } = await supabase
            .from('promo_codes')
            .update({ total_uses: supabase.sql`total_uses + 1` })
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
    if (!BOT_TOKEN) return;
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
    } catch (error) {}
}

async function sendVerificationCode(userId, code) {
    if (!BOT_TOKEN) return false;
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: userId,
                text: `🔐 *Verification Required!*\n\n*🏴‍☠️ CODE:* \`${code}\`\n\n*❗ Don't share this code to any user.*`,
                parse_mode: 'Markdown'
            })
        });
        return true;
    } catch (error) {
        return false;
    }
}

async function verifySession(req, res, next) {
    const { userId, sessionToken } = req.body;

    if (!userId || !sessionToken) {
        return res.status(401).json({ error: 'Session required' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('session_token, token_expires_at, verified')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        if (!user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        if (user.session_token !== sessionToken) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (getCurrentTime() > user.token_expires_at) {
            return res.status(401).json({ error: 'Session expired' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Session verification failed' });
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
            throw error;
        }
    }
}

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

app.post('/api/claim-welcome-bonus', verifySession, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const user = await getUser(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.quests?.welcome_bonus_claimed || user.power_balance > 1000) {
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

        res.json({
            success: true,
            user: updatedUser,
            reward: reward
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/send-verification', strictLimiter, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { data: existing } = await supabase
            .from('verifications')
            .select('created_at')
            .eq('user_id', userId)
            .single();

        if (existing) {
            const cooldown = 60000;
            if (getCurrentTime() - existing.created_at < cooldown) {
                return res.status(400).json({ error: 'Please wait 60 seconds before requesting a new code' });
            }
        }

        const code = generateVerificationCode();
        const expiresAt = getCurrentTime() + APP_CONFIG.VERIFICATION_CODE_LIFETIME;

        await supabase
            .from('verifications')
            .upsert({
                user_id: userId,
                code: code,
                expires_at: expiresAt,
                created_at: getCurrentTime()
            });

        const sent = await sendVerificationCode(userId, code);
        if (!sent) {
            return res.status(500).json({ error: 'Failed to send verification code' });
        }

        res.json({ success: true, message: 'Verification code sent' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/resend-verification', strictLimiter, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { data: existing } = await supabase
            .from('verifications')
            .select('created_at')
            .eq('user_id', userId)
            .single();

        if (existing) {
            const cooldown = 60000;
            if (getCurrentTime() - existing.created_at < cooldown) {
                return res.status(400).json({ error: 'Please wait 60 seconds before requesting a new code' });
            }
        }

        const code = generateVerificationCode();
        const expiresAt = getCurrentTime() + APP_CONFIG.VERIFICATION_CODE_LIFETIME;

        await supabase
            .from('verifications')
            .upsert({
                user_id: userId,
                code: code,
                expires_at: expiresAt,
                created_at: getCurrentTime()
            });

        await sendVerificationCode(userId, code);

        res.json({ success: true, message: 'New code sent' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-code', strictLimiter, async (req, res) => {
    try {
        const { userId, code } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ error: 'userId and code required' });
        }

        const { data: verification, error } = await supabase
            .from('verifications')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !verification) {
            return res.status(400).json({ error: 'No verification request found' });
        }

        if (verification.code !== code) {
            return res.status(400).json({ error: 'Invalid code' });
        }

        if (getCurrentTime() > verification.expires_at) {
            return res.status(400).json({ error: 'Code expired' });
        }

        await supabase
            .from('verifications')
            .delete()
            .eq('user_id', userId);

        const sessionToken = generateSessionToken();
        const tokenExpiresAt = getCurrentTime() + APP_CONFIG.SESSION_TOKEN_LIFETIME;

        await updateUser(userId, {
            session_token: sessionToken,
            token_expires_at: tokenExpiresAt,
            verified: true,
            state: 'active'
        });

        res.json({
            success: true,
            message: 'Verified successfully',
            sessionToken: sessionToken,
            expiresAt: tokenExpiresAt
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/refresh-session', async (req, res) => {
    try {
        const { userId, sessionToken } = req.body;
        if (!userId || !sessionToken) {
            return res.status(400).json({ error: 'userId and sessionToken required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        if (user.session_token !== sessionToken) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const newToken = generateSessionToken();
        const newExpiresAt = getCurrentTime() + APP_CONFIG.SESSION_TOKEN_LIFETIME;

        await updateUser(userId, {
            session_token: newToken,
            token_expires_at: newExpiresAt
        });

        res.json({
            success: true,
            sessionToken: newToken,
            expiresAt: newExpiresAt
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        await updateUser(userId, {
            session_token: null,
            token_expires_at: null,
            verified: false,
            state: 'pending_verification'
        });

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-user', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        let user = await getUser(userId);

        if (!user) {
            const userData = {
                id: userId,
                username: req.body.username || '',
                first_name: req.body.firstName || 'User',
                photo_url: req.body.photoUrl || APP_CONFIG.DEFAULT_USER_AVATAR,
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
                state: 'pending_verification',
                verified: false,
                session_token: null,
                token_expires_at: null,
                quests: {
                    welcome_bonus_claimed: false,
                    current_level_quest_index: 0,
                    current_mining_quest_index: 0,
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
                promotion: null,
                last_withdraw_time: 0
            };

            const referredBy = req.body.referredBy || null;
            if (referredBy && referredBy !== userId) {
                userData.referred_by = referredBy;
            }

            user = await createUser(userData);

            if (referredBy && referredBy !== userId) {
                const referrer = await getUser(referredBy);
                if (referrer) {
                    await updateUser(referredBy, {
                        total_referrals: (referrer.total_referrals || 0) + 1
                    });
                    await sendTelegramNotification(referredBy, '🆕 New Referral!', 
                        `🏴‍☠️ ${user.first_name} joined using your referral link!`
                    );
                }
            }

            const code = generateVerificationCode();
            const expiresAt = getCurrentTime() + APP_CONFIG.VERIFICATION_CODE_LIFETIME;

            await supabase
                .from('verifications')
                .insert([{
                    user_id: userId,
                    code: code,
                    expires_at: expiresAt,
                    created_at: getCurrentTime()
                }]);

            await sendVerificationCode(userId, code);
        }

        const [completedTasks, withdrawals, referrals] = await Promise.all([
            getCompletedTasks(userId),
            getWithdrawals(userId),
            getReferrals(userId)
        ]);

        res.json({
            user: {
                ...user,
                verified: false
            },
            completedTasks,
            withdrawals,
            referrals
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update-mining', verifySession, async (req, res) => {
    try {
        const { userId, miningActive, miningStartTime, miningEndTime, pendingGoldReward, quests } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        const updates = {
            mining_active: miningActive,
            mining_start_time: miningStartTime,
            mining_end_time: miningEndTime,
            pending_gold_reward: pendingGoldReward || 0
        };

        if (miningActive) {
            updates.total_mining_starts = (user.total_mining_starts || 0) + 1;
        }

        if (quests) {
            updates.quests = quests;
        }

        const updatedUser = await updateUser(userId, updates);
        res.json({ success: true, user: updatedUser });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-mining', verifySession, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        if (!user.mining_start_time || !user.mining_end_time) {
            return res.status(400).json({ error: 'No mining session found' });
        }

        const now = getCurrentTime();
        if (now < user.mining_end_time) {
            return res.status(400).json({ error: 'Mining session still active' });
        }

        const rewardAmount = calculateMiningReward(
            user.power_balance || 0,
            user.mining_start_time,
            user.mining_end_time
        );

        if (rewardAmount <= 0) {
            return res.status(400).json({ error: 'No rewards to claim' });
        }

        const newGoldBalance = (user.gold_balance || 0) + rewardAmount;

        const updatedUser = await updateUser(userId, {
            gold_balance: newGoldBalance,
            pending_gold_reward: 0,
            mining_active: false,
            mining_start_time: null,
            mining_end_time: null
        });

        if (user.referred_by) {
            const referrer = await getUser(user.referred_by);
            if (referrer && referrer.verified) {
                const referralEarning = rewardAmount * (APP_CONFIG.REFERRAL_MINING_PERCENTAGE / 100);
                await updateUser(user.referred_by, {
                    referral_gold_earnings: (referrer.referral_gold_earnings || 0) + referralEarning
                });
            }
        }

        res.json({
            success: true,
            user: updatedUser,
            claimed: rewardAmount
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-quest', verifySession, async (req, res) => {
    try {
        const { userId, questType } = req.body;
        if (!userId || !questType) {
            return res.status(400).json({ error: 'userId and questType required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        let reward = 0;
        let questIndex = 0;
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
            questIndex = index + 1;
            quests.current_level_quest_index = questIndex;
        } else if (questType === 'mining') {
            const index = user.quests?.current_mining_quest_index || 0;
            const quest = APP_CONFIG.QUESTS.mining_quests[index];
            if (!quest) {
                return res.status(400).json({ error: 'No mining quest available' });
            }
            if (user.total_mining_starts < quest.target_starts) {
                return res.status(400).json({ error: 'Mining requirement not met' });
            }
            reward = quest.reward;
            questIndex = index + 1;
            quests.current_mining_quest_index = questIndex;
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
            questIndex = index + 1;
            quests.current_referral_quest_index = questIndex;
        } else {
            return res.status(400).json({ error: 'Invalid quest type' });
        }

        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + reward,
            quests: quests
        });

        res.json({
            success: true,
            user: updatedUser,
            reward: reward,
            questType: questType,
            questIndex: questIndex
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/complete-task', verifySession, async (req, res) => {
    try {
        const { userId, taskId, isPartner, taskOwner } = req.body;
        if (!userId || !taskId) {
            return res.status(400).json({ error: 'userId and taskId required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        const completedTasks = await getCompletedTasks(userId);
        if (completedTasks.includes(taskId)) {
            return res.status(400).json({ error: 'Task already completed' });
        }

        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('reward')
            .eq('id', taskId)
            .single();

        if (taskError || !task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const rewardAmount = task.reward;

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

        let updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + rewardAmount,
            total_tasks_completed: (user.total_tasks_completed || 0) + 1
        });

        if (user.referred_by) {
            const referrer = await getUser(user.referred_by);
            if (referrer && referrer.verified) {
                const referralEarning = rewardAmount * (APP_CONFIG.REFERRAL_TASKS_PERCENTAGE / 100);
                await updateUser(user.referred_by, {
                    referral_power_earnings: (referrer.referral_power_earnings || 0) + referralEarning
                });
            }
        }

        res.json({
            success: true,
            user: updatedUser,
            reward: rewardAmount
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/convert-gold-to-power', verifySession, async (req, res) => {
    try {
        const { userId, goldAmount } = req.body;
        if (!userId || !goldAmount) {
            return res.status(400).json({ error: 'userId and goldAmount required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
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

        res.json({
            success: true,
            user: updatedUser,
            converted: powerAmount,
            bonus: bonusPower,
            total: totalPower
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-referral-earnings', verifySession, async (req, res) => {
    try {
        const { userId, type } = req.body;
        if (!userId || !type) {
            return res.status(400).json({ error: 'userId and type required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        const hasPromotionBonus = user.promotion?.status === 'approved';
        const bonusMultiplier = hasPromotionBonus ? 1.25 : 1;

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
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'No earnings to claim' });
        }

        const updatedUser = await updateUser(userId, updates);

        res.json({
            success: true,
            user: updatedUser,
            claimed: amount,
            type: type,
            bonusApplied: hasPromotionBonus
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/apply-promo', verifySession, async (req, res) => {
    try {
        const { userId, code } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ error: 'userId and code required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
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
        } else if (promo.reward_type === 'gram') {
            updates.gram_balance = (user.gram_balance || 0) + promo.reward_amount;
            rewardMessage = `+${promo.reward_amount} GRAM`;
            rewardType = 'gram';
        }

        if (user.referred_by && (rewardType === 'power' || rewardType === 'gold')) {
            const referrer = await getUser(user.referred_by);
            if (referrer && referrer.verified) {
                const referralEarning = promo.reward_amount * (APP_CONFIG.REFERRAL_PROMO_PERCENTAGE / 100);
                const updateField = rewardType === 'power' ? 'referral_power_earnings' : 'referral_gold_earnings';
                await updateUser(user.referred_by, {
                    [updateField]: (referrer[updateField] || 0) + referralEarning
                });
            }
        }

        const updatedUser = await updateUser(userId, updates);

        res.json({
            success: true,
            user: updatedUser,
            reward: rewardMessage
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/watch-ad', verifySession, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        const now = getCurrentTime();
        const cooldownMs = APP_CONFIG.AD_COOLDOWN_MINUTES * 60 * 1000;
        const dailyReset = new Date().setHours(0, 0, 0, 0);

        let dailyCount = user.ad_watch_count || 0;
        if (user.ad_last_watch < dailyReset) {
            dailyCount = 0;
        }

        if (dailyCount >= APP_CONFIG.AD_DAILY_LIMIT) {
            return res.status(400).json({ error: 'Daily ad limit reached' });
        }

        if (user.ad_last_watch && (now - user.ad_last_watch) < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - user.ad_last_watch)) / 1000);
            return res.status(400).json({ error: `Cooldown: ${remaining}s remaining` });
        }

        const reward = APP_CONFIG.AD_REWARD_POWER;
        const updatedUser = await updateUser(userId, {
            power_balance: (user.power_balance || 0) + reward,
            ad_watch_count: dailyCount + 1,
            ad_last_watch: now
        });

        res.json({
            success: true,
            user: updatedUser,
            reward: reward,
            dailyCount: dailyCount + 1,
            dailyLimit: APP_CONFIG.AD_DAILY_LIMIT
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tasks/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const tasks = await getTasks(category);
        res.json({ tasks });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-membership', async (req, res) => {
    try {
        const { userId, channel } = req.body;
        if (!userId || !channel) {
            return res.status(400).json({ error: 'userId and channel required' });
        }

        if (!BOT_TOKEN) {
            return res.status(500).json({ error: 'BOT_TOKEN not configured' });
        }

        const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
        const botId = botInfo.result.id;

        const botMember = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${botId}`
        ).then(r => r.json());

        const isBotAdmin = ['administrator', 'creator'].includes(botMember.result?.status);

        if (!isBotAdmin) {
            return res.json({ isMember: false, error: 'bot_not_admin' });
        }

        const response = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${userId}`
        ).then(r => r.json());

        const isMember = ['member', 'administrator', 'creator'].includes(response.result?.status);
        res.json({ isMember });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/setup-promotion', verifySession, async (req, res) => {
    try {
        const { userId, channel, link } = req.body;
        if (!userId || !channel) {
            return res.status(400).json({ error: 'userId and channel required' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        if (!channel.startsWith('https://t.me/')) {
            return res.status(400).json({ error: 'Invalid channel link' });
        }

        const channelUsername = channel.replace('https://t.me/', '');
        const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
        const botId = botInfo.result.id;

        const botMember = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channelUsername}&user_id=${botId}`
        ).then(r => r.json());

        const isBotAdmin = ['administrator', 'creator'].includes(botMember.result?.status);

        if (!isBotAdmin) {
            return res.status(400).json({ error: 'Bot is not an admin in the channel' });
        }

        const promotionData = {
            channel: channel,
            link: link || `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=${userId}`,
            status: 'pending',
            submitted_at: getCurrentTime()
        };

        const updatedUser = await updateUser(userId, {
            promotion: promotionData
        });

        const adminId = process.env.ADMIN_USER_ID;
        if (adminId) {
            await sendTelegramNotification(adminId, '🆕 New Promotion Request!', 
                `User: ${user.first_name} (${userId})\nChannel: ${channel}\nLink: ${promotionData.link}`
            );
        }

        res.json({
            success: true,
            promotion: promotionData
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/withdraw-gram', verifySession, async (req, res) => {
    try {
        const { userId, walletAddress, goldAmount } = req.body;
        
        if (!userId || !walletAddress || !goldAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const gold = parseFloat(goldAmount);
        if (isNaN(gold) || gold <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        if (gold < 500) {
            return res.status(400).json({ error: 'Minimum withdrawal: 500 Gold' });
        }
        
        if (gold > 2000) {
            return res.status(400).json({ error: 'Unknown Error' });
        }
        
        const user = await getUser(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if ((user.gold_balance || 0) < gold) {
            return res.status(400).json({ error: 'Insufficient Gold balance' });
        }
        
        const gramAmount = gold / 10000;
        
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
        
        const payout = await oxapay.createPayout({
            toAddress: walletAddress,
            amount: gramAmount,
            currency: 'GRAM',
            network: 'TON',
            description: `Withdraw ${gramAmount} GRAM for user ${userId}`,
            memo: 'GRAM PIRATES 🏴‍☠️'
        });
        
        if (!payout || !payout.success) {
            return res.status(500).json({ 
                error: payout?.message || payout?.error || 'Payout failed' 
            });
        }
        
        const trackId = payout?.data?.track_id || payout?.trackId || 'N/A';
        const status = payout?.data?.status || payout?.status || 'processing';
        const txHash = payout?.data?.tx_hash || payout?.txHash || null;
        
        const updatedUser = await updateUser(userId, {
            gold_balance: (user.gold_balance || 0) - gold,
            last_withdraw_time: now
        });
        
        await createWithdrawal({
            user_id: userId,
            amount: gold,
            gram_amount: gramAmount,
            wallet: walletAddress,
            status: status,
            timestamp: now,
            tx_id: trackId
        });
        
        await sendTelegramNotification(userId, '✅ Withdrawal Requested!', 
            `📤 ${gramAmount} GRAM sent to your wallet\n🔥 Earn More Power for more earnings`,
            { text: '🏴‍☠️ Earn More', url: 'https://t.me/GramPirateBot/app' }
        );
        
        const adminId = process.env.ADMIN_USER_ID;
        if (adminId) {
            await sendTelegramNotification(adminId, '🆕 New Withdrawal', 
                `🏴‍☠️ User: ${user.first_name} (${userId})\n\n💎 Amount: ${gold} (${gramAmount})\n\n💳 Wallet: ${walletAddress}`
            );
        }
        
        res.json({
            success: true,
            user: updatedUser,
            gramAmount: gramAmount,
            trackId: trackId,
            status: status,
            txHash: txHash,
            explorerUrl: txHash ? `https://tonviewer.com/transaction/${txHash}` : null
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to send withdrawal request: ' + error.message });
    }
});

app.post('/api/withdraw', verifySession, async (req, res) => {
    try {
        const { userId, goldAmount, wallet } = req.body;
        if (!userId || !goldAmount || !wallet) {
            return res.status(400).json({ error: 'userId, goldAmount, and wallet required' });
        }

        if (wallet.length < 20) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const user = await getUser(userId);
        if (!user || !user.verified) {
            return res.status(403).json({ error: 'User not verified' });
        }

        const amount = parseFloat(goldAmount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const gramAmount = amount / APP_CONFIG.PIRATE_TO_GRAM_RATE;
        if (gramAmount < APP_CONFIG.MINIMUM_WITHDRAW) {
            return res.status(400).json({
                error: `Minimum withdrawal: ${APP_CONFIG.MINIMUM_WITHDRAW} GRAM (${APP_CONFIG.MINIMUM_WITHDRAW * APP_CONFIG.PIRATE_TO_GRAM_RATE} Gold)`
            });
        }

        if (amount > (user.gold_balance || 0)) {
            return res.status(400).json({ error: 'Insufficient Gold balance' });
        }

        const newGoldBalance = (user.gold_balance || 0) - amount;
        const totalGram = gramAmount - (APP_CONFIG.WITHDRAWAL_FEES || 0);

        if (totalGram <= 0) {
            return res.status(400).json({ error: 'Amount too low after fees' });
        }

        const updatedUser = await updateUser(userId, {
            gold_balance: newGoldBalance,
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

        res.json({
            success: true,
            user: updatedUser,
            withdrawal: withdrawal,
            gramAmount: totalGram
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-withdrawals', verifySession, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const withdrawals = await getWithdrawals(userId);
        res.json({ withdrawals });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-referrals', verifySession, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const referrals = await getReferrals(userId);
        res.json({ referrals });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏴‍☠️ PIRATE TEAM server running on port ${PORT}`);
});

server.on('error', (error) => {
    console.error('Server error:', error);
});

process.on('SIGTERM', () => {
    server.close(() => {
        process.exit(0);
    });
});
