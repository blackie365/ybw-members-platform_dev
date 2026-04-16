const http = require('http');

http.get('http://localhost:9229/json/list', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const list = JSON.parse(data);
    const wsUrl = list[0].webSocketDebuggerUrl;
    
    // We can use the ws module from ybw-frontend/node_modules/next/dist/compiled/ws
    const WebSocket = require('./node_modules/next/dist/compiled/ws');
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: 'JSON.stringify(process.env)',
          returnByValue: true
        }
      }));
    });
    
    ws.on('message', (msg) => {
      const resp = JSON.parse(msg);
      if (resp.id === 1) {
        const env = JSON.parse(resp.result.result.value);
        console.log(env);
        process.exit(0);
      }
    });
  });
});
