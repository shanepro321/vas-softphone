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

// 內存中的設備列表備用存儲
let inMemoryDevices = {};

// 將所有API路由添加到apiRouter
apiRouter.post('/register-device', async (req, res) => {
    console.log('收到註冊請求:', req.body);
    const { extension, token, platform, company_code } = req.body;

    if (!extension || !token || !platform || !company_code) {
        console.warn('註冊請求缺少參數:', req.body);
        return res.status(400).json({
            success: false,
            message: '缺少必要參數'
        });
    }

    try {
        console.log('開始處理設備註冊請求...');
        const deviceInfo = {
            extension,
            token,
            platform,
            company_code,
            updated_at: new Date().toISOString()
        };

        if (edgeConfig) {
            try {
                // 獲取現有設備列表
                let devices = await edgeConfig.get('devices') || {};
                // 使用公司代碼和分機號的組合作為唯一標識
                const deviceKey = `${company_code}-${extension}`;
                devices[deviceKey] = deviceInfo;
                
                // 更新Edge Config
                await edgeConfig.set('devices', devices);
                console.log('Edge Config更新成功');
            } catch (error) {
                console.error('Edge Config操作失敗，使用內存存儲:', error);
                // 如果Edge Config失敗，使用內存存儲
                const deviceKey = `${company_code}-${extension}`;
                inMemoryDevices[deviceKey] = deviceInfo;
            }
        } else {
            // 直接使用內存存儲
            console.log('使用內存存儲設備信息');
            const deviceKey = `${company_code}-${extension}`;
            inMemoryDevices[deviceKey] = deviceInfo;
        }

        // 設置緩存控制頭部
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.json({
            success: true,
            message: '設備註冊成功',
            device: deviceInfo
        });
        console.log('註冊響應已發送');
    } catch (error) {
        console.error('註冊設備錯誤:', error);
        res.status(500).json({
            success: false,
            message: '設備註冊失敗',
            error: error.message
        });
    }
});

apiRouter.get('/devices', async (req, res) => {
    try {
        let devices = {};
        if (edgeConfig) {
            try {
                devices = await edgeConfig.get('devices') || {};
                console.log('成功從Edge Config獲取設備列表');
            } catch (error) {
                console.error('從Edge Config獲取設備列表失敗:', error);
                // 如果Edge Config失敗，使用內存存儲
                devices = inMemoryDevices;
                console.log('使用內存存儲作為備用');
            }
        } else {
            devices = inMemoryDevices;
            console.log('使用內存存儲獲取設備列表');
        }

        const deviceList = Object.values(devices);
        console.log(`成功獲取設備列表，共${deviceList.length}個設備`);

        res.json({
            success: true,
            devices: deviceList.sort((a, b) => 
                new Date(b.updated_at) - new Date(a.updated_at)
            )
        });
    } catch (error) {
        console.error('獲取設備列表時發生錯誤:', error);
        console.error('錯誤詳情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: '獲取設備列表失敗',
            error: error.message
        });
    }
});

apiRouter.delete('/devices/:company_code/:extension', async (req, res) => {
    const { company_code, extension } = req.params;
    const deviceKey = `${company_code}-${extension}`;

    try {
        const devices = await edgeConfig.get('devices') || {};
        if (!devices[deviceKey]) {
            return res.status(404).json({
                success: false,
                message: '未找到指定設備'
            });
        }

        delete devices[deviceKey];
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
let edgeConfig;

// 初始化Edge Config
const initializeEdgeConfig = async () => {
    if (!checkRequiredEnvVars()) {
        process.exit(1);
    }

    try {
        edgeConfig = createClient(ENV_CONFIG.EDGE_CONFIG);
        // 測試Edge Config連接
        const testResult = await edgeConfig.get('devices');
        if (!testResult) {
            // 如果devices為空，初始化為空對象
            await edgeConfig.set('devices', {});
            console.log('初始化空的設備列表');
        } else {
            console.log('成功連接到Vercel Edge Config，當前設備列表:', testResult);
        }
    } catch (error) {
        console.error('Vercel Edge Config連接錯誤:', error);
        console.error('錯誤詳情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        // 不要立即退出，而是繼續運行服務器
        console.log('Edge Config連接失敗，將使用內存存儲作為備用');
        edgeConfig = null;
    }
};

initializeEdgeConfig();



// 啟動服務器
app.listen(port, () => {
    console.log(`服務器運行在 http://localhost:${port}`);
});
