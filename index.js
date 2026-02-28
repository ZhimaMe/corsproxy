const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 443;

// 启用 CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 健康检查
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok' });
});

// 代理路由处理
app.use((req, res, next) => {
  // 跳过健康检查路由
  if (req.originalUrl === '/health') {
    return next();
  }
  
  try {
    // 提取目标 URL（移除开头的 /）
    const targetUrl = req.originalUrl.substring(1);
    
    // 检查是否是有效的 HTTP/HTTPS URL
    if (!targetUrl.match(/^https?:\/\//)) {
      console.log('Invalid URL format:', targetUrl);
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    console.log('Proxying to:', targetUrl);
    
    // 解析目标 URL
    const urlObj = new URL(targetUrl);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: req.method,
      headers: req.headers
    };
    
    // 移除可能导致问题的头
    delete options.headers.host;
    delete options.headers.origin;
    
    console.log('Proxy options:', {
      hostname: options.hostname,
      port: options.port,
      path: options.path,
      method: options.method
    });
    
    // 创建代理请求
    const proxyReq = (urlObj.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
      console.log('Proxy response received:', proxyRes.statusCode);
      
      // 设置响应头
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // 管道响应数据
      proxyRes.pipe(res);
    });
    
    // 处理代理错误
    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.status(500).json({ error: 'Proxy error', message: error.message });
    });
    
    // 管道请求数据
    req.pipe(proxyReq);
    
  } catch (error) {
    console.error('Error in proxy setup:', error);
    res.status(400).json({ error: 'Invalid proxy URL', message: error.message });
  }
});

// 404 处理
app.use((req, res) => {
  console.log('404 Not Found:', req.url);
  res.status(404).json({ error: 'Not Found' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`CORS Proxy server running on port ${PORT}`);
  console.log(`Usage: http://localhost:${PORT}/https://example.com`);
});