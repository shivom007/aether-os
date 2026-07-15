const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('C:\\Users\\Shiv OM\\.railway\\config.json', 'utf8'));
const token = config.user.accessToken;

const query = `
  query {
    projects {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const req = https.request({
  hostname: 'backboard.railway.com',
  path: '/graphql/v2',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  });
});

req.write(JSON.stringify({ query }));
req.end();
