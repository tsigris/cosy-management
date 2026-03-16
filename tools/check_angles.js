const fs=require('fs');
const s=fs.readFileSync('d:/cosy-management/src/app/goals/page.tsx','utf8');
let bal=0;for(let i=0;i<s.length;i++){const ch=s[i]; if(ch=='<') bal++; if(ch=='>') bal--; }
console.log('angle balance',bal);
