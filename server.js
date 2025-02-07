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

// 初始化Vercel KV存儲
const initializeKV = async () => {
    try {
        console.log('成功連接到Vercel KV存儲');
    } catch (error) {
        console.error('Vercel KV存儲連接錯誤:', error);
    }
};

initializeKV();

// 設備註冊端點
app.post('/api/register-device', async (req, res) => {
    const { extension, token, platform } = req.body;

    if (!extension || !token || !platform) {
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

        res.json({
            success: true,
            message: '設備註冊成功',
            device
        });
    } catch (error) {
        console.error('註冊設備錯誤:', error);
        res.status(500).json({
            success: false,
            message: '設備註冊失敗'
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