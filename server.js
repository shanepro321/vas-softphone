const express = require('express');
const cors = require('cors');
const { kv } = require('@vercel/kv');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// 中間件配置
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 檢查必要的環境變量
const checkRequiredEnvVars = () => {
    const required = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('環境變量配置錯誤：');
        console.error(`缺少必要的環境變量: ${missing.join(', ')}`);
        console.error('請在Vercel項目設置中配置以下環境變量：');
        console.error('1. KV_REST_API_URL - 從Vercel KV存儲服務獲取');
        console.error('2. KV_REST_API_TOKEN - 從Vercel KV存儲服務獲取');
        return false;
    }
    return true;
};

// 初始化Vercel KV存儲
const initializeKV = async () => {
    if (!checkRequiredEnvVars()) {
        process.exit(1);
    }

    try {
        // 測試KV連接
        await kv.set('test_connection', 'ok');
        await kv.del('test_connection');
        console.log('成功連接到Vercel KV存儲');
    } catch (error) {
        console.error('Vercel KV存儲連接錯誤:', error);
        process.exit(1);
    }
};

initializeKV();

// 設備註冊端點
app.post('/api/register-device', async (req, res) => {
    console.log('收到註冊請求:', req.body);
    const { extension, token, platform } = req.body;

    if (!extension || !token || !platform) {
        console.warn('註冊請求缺少參數:', req.body);
        return res.status(400).json({
            success: false,
            message: '缺少必要參數'
        });
    }

    try {
        // 更新或插入設備記錄
        const device = {
            extension,
            token,
            platform,
            updated_at: new Date().toISOString()
        };

        await kv.set(`device:${extension}`, device);
        console.log('設備註冊成功:', device);

        res.json({
            success: true,
            message: '設備註冊成功',
            device
        });
    } catch (error) {
        console.error('註冊設備錯誤:', error);
        res.status(500).json({
            success: false,
            message: '設備註冊失敗',
            error: error.message
        });
    }
});

// 獲取所有註冊設備
app.get('/api/devices', async (req, res) => {
    try {
        const keys = await kv.keys('device:*');
        const devices = await Promise.all(
            keys.map(key => kv.get(key))
        );

        res.json({
            success: true,
            devices: devices.sort((a, b) => 
                new Date(b.updated_at) - new Date(a.updated_at)
            )
        });
    } catch (error) {
        console.error('獲取設備列表錯誤:', error);
        res.status(500).json({
            success: false,
            message: '獲取設備列表失敗'
        });
    }
});

// 刪除設備註冊
app.delete('/api/devices/:extension', async (req, res) => {
    const { extension } = req.params;

    try {
        const device = await kv.get(`device:${extension}`);
        if (!device) {
            return res.status(404).json({
                success: false,
                message: '未找到指定設備'
            });
        }

        await kv.del(`device:${extension}`);

        res.json({
            success: true,
            message: '設備已成功刪除'
        });
    } catch (error) {
        console.error('刪除設備錯誤:', error);
        res.status(500).json({
            success: false,
            message: '刪除設備失敗'
        });
    }
});

// 啟動服務器
app.listen(port, () => {
    console.log(`服務器運行在 http://localhost:${port}`);
});
