const fs = require('fs');
const crypto = require('crypto');

async function test() {
  const fileData = fs.readFileSync('server/storage/googledrive/googledrive_1.shard');
  console.log('Downloaded size:', fileData.length);
  const iv = fileData.slice(0, 12);
  const chunk = fileData.slice(12);
  console.log('IV size:', iv.length, 'Chunk size:', chunk.length);
}

test();
