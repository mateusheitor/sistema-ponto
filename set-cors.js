// Lista todos os buckets do projeto para encontrar o nome correto
async function main() {
  const fs = require('fs');
  const https = require('https');

  const config = JSON.parse(fs.readFileSync('C:\\Users\\mateu\\.config\\configstore\\firebase-tools.json', 'utf8'));
  const token = config.tokens?.access_token;
  const PROJECT = 'sistema-ponto-ce2f0';

  console.log('Token expira:', new Date(config.tokens?.expires_at).toLocaleString('pt-BR'));

  // Lista buckets do projeto
  const result = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b?project=${PROJECT}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end();
  });

  console.log('Status:', result.status);
  if (result.status === 200) {
    const data = JSON.parse(result.body);
    console.log('Buckets encontrados:');
    (data.items || []).forEach(b => console.log(' -', b.id, '|', b.name));
  } else {
    console.log('Erro:', result.body.slice(0, 400));
  }
}

main().catch(e => console.error(e));
