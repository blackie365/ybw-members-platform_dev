require('dotenv').config({ path: '.env.local' });
const { POST } = require('./src/app/api/auth/reset-password/route.ts');
console.log(POST);
