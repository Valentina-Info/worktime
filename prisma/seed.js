/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const prismaPath = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
const seedPath = path.join(__dirname, 'seed.sql');

execFileSync(process.execPath, [prismaPath, 'db', 'execute', '--file', seedPath], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});

console.log('Test user is ready:');
console.log('  Email: test@example.com');
console.log('  Password: password123');
