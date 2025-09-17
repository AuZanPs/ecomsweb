const http = require('http');

// Test the health endpoint
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  
  res.on('data', (d) => {
    process.stdout.write(d);
    console.log('\n--- Health check complete ---');
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();