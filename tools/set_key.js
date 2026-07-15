const { spawnSync } = require('child_process');

const key = "*eF$%?hv<Fv{ga+)[|{^jfQ'k\\%G~ebg";
spawnSync('railway', ['variables', 'set', `PROVIDER_ENCRYPTION_KEY=${key}`, '--service', 'aether-backend'], { stdio: 'inherit' });
