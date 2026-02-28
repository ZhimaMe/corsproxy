// CORS Proxy for Cloudflare Workers

// 处理 CORS 预检请求
function handleCORS(request) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24小时
  });

  return new Response(null, { 
    status: 204, // No Content
    headers 
  });
}

// 主处理函数
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 1. 健康检查
  if (url.pathname === '/health') {
    console.log('Health check requested');
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 2. 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }
  
  try {
    // 3. 提取目标 URL（移除开头的 /）
    const targetUrl = url.pathname.substring(1) + url.search;
    
    // 验证 URL 格式
    if (!targetUrl.match(/^https?:\/\//)) {
      console.log('Invalid URL format:', targetUrl);
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Proxying to:', targetUrl);
    
    // 4. 创建目标请求
    const targetRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // 注意：Workers 会自动处理 streaming
    });
    
    // 5. 移除可能导致问题的头
    targetRequest.headers.delete('host');
    targetRequest.headers.delete('origin');
    
    // 6. 发起代理请求
    const proxyResponse = await fetch(targetRequest);
    
    console.log('Proxy response received:', proxyResponse.status);
    
    // 7. 创建响应，添加 CORS 头
    const responseHeaders = new Headers(proxyResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ 
      error: 'Proxy error', 
      message: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Worker 入口
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};