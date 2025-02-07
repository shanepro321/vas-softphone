const express = require('express');
const cors = require('cors');
const { createClient } = require('@vercel/edge-config');
const bodyParser = require('body-parser');

// 環境變量配置
const ENV_CONFIG = {
    KV_REST_API_URL: 'https://vas-softphone-api-store.com',
    KV_REST_API_TOKEN: 'AZHjASQgNDY4MjE0ZjAtZjM4Yy00ZjQ5LWI5ZjYtZDY2ZjE3ZmQ0ZjFmZDJlZjE4ZDY5ZjE0NDVhZTk5ZjJmZTY4ZjE5ZjE5ZmE=',
    EDGE_CONFIG: 'https://edge-config.vercel.com/ecfg_ms8rteg96tlbsld0kuzjq4od3ex6?token=b9ee41d5-60a1-4268-8339-5eb4915ba3e1',
    EDGE_CONFIG_DIGEST: '5bf6b008a9ec05f6870c476d10b53211797aa000f95aae344ae60f9b422286da'
};

const app = express();
const port = process.env.PORT || 3000;

// 中間件配置
app.use(cors());
app.use(bodyParser.json());

// API路由處理
const apiRouter = express.Router();

// 將所有API路由添加到apiRouter
apiRouter.post('/register-device', async (req, res) => {
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
        console.log('開始處理設備註冊請求...');
        // 驗證Edge Config連接
        if (!edgeConfig) {
            throw new Error('Edge Config客戶端未初始化');
        }

        // 獲取現有設備列表
        let devices;
        try {
            devices = await edgeConfig.get('devices');
            console.log('成功獲取當前設備列表:', devices);
        } catch (getError) {
            console.error('獲取設備列表失敗:', getError);
            devices = {};
            console.log('初始化空的設備列表');
        }

        if (!devices) {
            devices = {};
            console.log('設備列表為空，初始化為空對象');
        }
        
        // 更新或插入設備記錄
        const deviceInfo = {
            extension,
            token,
            platform,
            updated_at: new Date().toISOString()
        };
        devices[extension] = deviceInfo;

        // 更新Edge Config
        console.log('準備更新Edge Config...');
        try {
            await edgeConfig.set('devices', devices);
            console.log('Edge Config更新成功');

            res.json({
                success: true,
                message: '設備註冊成功',
                device: deviceInfo
            });
            console.log('註冊響應已發送');
        } catch (setError) {
            console.error('更新Edge Config失敗:', {
                error: setError,
                errorName: setError.name,
                errorMessage: setError.message,
                errorStack: setError.stack
            });
            throw new Error('更新設備信息失敗: ' + setError.message);
        }
    } catch (error) {
        console.error('註冊設備錯誤:', {
            error,
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack
        });
        res.status(500).json({
            success: false,
            message: '設備註冊失敗',
            error: error.message
        });
    }
});

apiRouter.get('/devices', async (req, res) => {
    try {
        const devices = await edgeConfig.get('devices') || {};
        const deviceList = Object.values(devices);

        res.json({
            success: true,
            devices: deviceList.sort((a, b) => 
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

apiRouter.delete('/devices/:extension', async (req, res) => {
    const { extension } = req.params;

    try {
        const devices = await edgeConfig.get('devices') || {};
        if (!devices[extension]) {
            return res.status(404).json({
                success: false,
                message: '未找到指定設備'
            });
        }

        delete devices[extension];
        await edgeConfig.set('devices', devices);

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

// 將API路由掛載到/api前綴
app.use('/api', apiRouter);

// 靜態文件服務
app.use(express.static('public'));

// 根路由處理
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

// 檢查必要的環境變量
const checkRequiredEnvVars = () => {
    // 由於環境變量已經硬編碼，不需要檢查
    return true;
};

// 初始化Edge Config客戶端
const edgeConfig = createClient(ENV_CONFIG.EDGE_CONFIG);

// 初始化Edge Config
const initializeEdgeConfig = async () => {
    if (!checkRequiredEnvVars()) {
        process.exit(1);
    }

    try {
        // 測試Edge Config連接
        const testResult = await edgeConfig.get('devices');
        console.log('成功連接到Vercel Edge Config，當前設備列表:', testResult);
    } catch (error) {
        console.error('Vercel Edge Config連接錯誤:', error);
        console.error('錯誤詳情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
};

initializeEdgeConfig();



// 啟動服務器
app.listen(port, () => {
    console.log(`服務器運行在 http://localhost:${port}`);
});
