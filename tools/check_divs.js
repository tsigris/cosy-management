const fs=require('fs');
const s=fs.readFileSync('d:/cosy-management/src/app/goals/page.tsx','utf8');
const lines=s.split('\n');
const stack=[];
for(let i=0;i<lines.length;i++){
  const l=lines[i];
  // count opening <div that are NOT self-closing (i.e. not <div ... />)
  const open=(l.match(/<div(\s|>)(?:(?!\/>)?)/g)||[]).length;
  const close=(l.match(/<\/div>/g)||[]).length;
  for(let j=0;j<open;j++) {
    stack.push({line:i+1,text:l.trim().slice(0,120)});
  }
  for(let j=0;j<close;j++){
    if(stack.length) stack.pop(); else console.log('extra close at',i+1);
  }
  if(i<1200 && (open>0 || close>0)) {
    const bal = stack.length;
    if(bal>0) console.log('line',i+1,'balance',bal,'recent open at',stack[stack.length-1]);
  }
}
if(stack.length) console.log('unclosed stack (top last):', stack.slice(-40));
else console.log('all closed');
