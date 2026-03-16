const fs=require('fs');
const s=fs.readFileSync('d:/cosy-management/src/app/goals/page.tsx','utf8');
const open=(s.match(/<>/g)||[]).length;
const close=(s.match(/<\/\>/g)||[]).length;
console.log('fragments open',open,'fragments close',close);
