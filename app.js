const $=id=>document.getElementById(id);
let wb=null,fileName='',plain='',curRows=[],curS=[];
const f=n=>Number.isInteger(n)?n.toLocaleString():n.toLocaleString(undefined,{maximumFractionDigits:2});
const pct=(a,b)=>(100*a/b).toFixed(1)+'%';
const num=v=>typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''&&isFinite(v.replace(/,/g,''))?+v.replace(/,/g,''):NaN);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const quant=(s,q)=>{const p=(s.length-1)*q,i=Math.floor(p);return s[i]+(s[Math.min(i+1,s.length-1)]-s[i])*(p-i)};
const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/Math.max(a.length-1,1))};
function corr(x,y){const mx=mean(x),my=mean(y);let n=0,dx=0,dy=0;for(let i=0;i<x.length;i++){n+=(x[i]-mx)*(y[i]-my);dx+=(x[i]-mx)**2;dy+=(y[i]-my)**2}return n/Math.sqrt(dx*dy)}

function analyze(rows){
  const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const N=rows.length,S=[];
  const info=cols.map(c=>{
    const raw=rows.map(r=>r[c]),vals=raw.filter(v=>v!==null&&v!==''&&v!==undefined);
    const nums=vals.map(num).filter(x=>!isNaN(x));
    const isNum=vals.length>0&&nums.length/vals.length>=0.8;
    const uniq=new Set(vals.map(String));
    const kind=vals.length===0?'empty':isNum?'num':(uniq.size<=Math.max(15,N*0.3)?'cat':'text');
    return{c,raw,vals,nums,kind,uniq,missing:N-vals.length};
  });
  const nu=info.filter(i=>i.kind==='num'),ca=info.filter(i=>i.kind==='cat');
  // overview
  const ov=[`The dataset has ${f(N)} rows and ${cols.length} columns (${nu.length} numeric, ${ca.length} categorical, ${info.filter(i=>i.kind==='text').length} text/ID, ${info.filter(i=>i.kind==='empty').length} empty).`];
  const mis=info.filter(i=>i.missing>0&&i.kind!=='empty').sort((a,b)=>b.missing-a.missing);
  if(!mis.length)ov.push('No missing values were found.');
  else ov.push('Missing values: '+mis.slice(0,5).map(i=>`${i.c} (${f(i.missing)}, ${pct(i.missing,N)})`).join('; ')+(mis.length>5?`; and ${mis.length-5} more columns.`:'.'));
  S.push(['Overview',ov]);
  // numeric
  const nl=[];
  nu.forEach(i=>{
    const a=i.nums,s=[...a].sort((x,y)=>x-y),m=mean(a),med=quant(s,.5);
    const q1=quant(s,.25),q3=quant(s,.75),iqr=q3-q1;
    const out=a.filter(x=>x<q1-1.5*iqr||x>q3+1.5*iqr).length;
    let t=`${i.c}: average ${f(m)}, median ${f(med)}, range ${f(s[0])} to ${f(s[s.length-1])}, total ${f(a.reduce((x,y)=>x+y,0))}, std. deviation ${f(sd(a))}.`;
    if(Math.abs(m-med)>0.15*(Math.abs(med)||1)&&s.length>3)t+=` The average is ${m>med?'higher':'lower'} than the median, so the values lean ${m>med?'toward high':'toward low'} extremes.`;
    if(out)t+=` ${f(out)} possible outlier${out>1?'s':''} detected.`;
    nl.push(t);
  });
  if(nl.length)S.push(['Numeric columns',nl]);
  // categorical
  const cl=[];
  ca.forEach(i=>{
    const cnt=Object.create(null);i.vals.forEach(v=>{v=String(v);cnt[v]=(cnt[v]||0)+1});
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
    let t=`${i.c}: ${top.length} distinct values. Most common is "${top[0][0]}" (${f(top[0][1])}, ${pct(top[0][1],i.vals.length)})`;
    if(top.length>1)t+=`, then "${top[1][0]}" (${pct(top[1][1],i.vals.length)})`;
    if(top.length>2)t+=`. Least common is "${top[top.length-1][0]}" (${f(top[top.length-1][1])}).`;else t+='.';
    cl.push(t);
  });
  if(cl.length)S.push(['Categories',cl]);
  // group comparison
  const gl=[];
  ca.filter(i=>i.uniq.size>=2&&i.uniq.size<=15).slice(0,2).forEach(g=>{
    nu.slice(0,3).forEach(n=>{
      const grp=Object.create(null);
      rows.forEach(r=>{const k=r[g.c],v=num(r[n.c]);if(k!==null&&k!==''&&k!==undefined&&!isNaN(v))(grp[k]=grp[k]||[]).push(v)});
      const e=Object.entries(grp).map(([k,v])=>[k,mean(v),v.length]).sort((a,b)=>b[1]-a[1]);
      if(e.length<2)return;
      const hi=e[0],lo=e[e.length-1];
      gl.push(`By ${g.c}, average ${n.c} is highest for "${hi[0]}" (${f(hi[1])}) and lowest for "${lo[0]}" (${f(lo[1])}), a gap of ${f(hi[1]-lo[1])}.`);
    });
  });
  if(gl.length)S.push(['Comparisons',gl]);
  // relationships
  const rl=[],pairs=[],cn=nu.filter(i=>i.nums.length===N&&new Set(i.nums).size>2).slice(0,8);
  for(let a=0;a<cn.length;a++)for(let b=a+1;b<cn.length;b++){const r=corr(cn[a].nums,cn[b].nums);if(isFinite(r)&&Math.abs(r)>=0.5)pairs.push([cn[a].c,cn[b].c,r])}
  pairs.sort((a,b)=>Math.abs(b[2])-Math.abs(a[2])).slice(0,4).forEach(p=>{
    const k=Math.abs(p[2])>=0.8?'strong':'moderate';
    rl.push(`${p[0]} and ${p[1]} show a ${k} ${p[2]>0?'positive':'negative'} relationship (r = ${p[2].toFixed(2)}). Correlation does not prove cause.`);
  });
  if(rl.length)S.push(['Relationships',rl]);
  return S;
}

function render(){
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{defval:null});
  const box=$('report');box.innerHTML='';box.classList.add('hide');
  if(!rows.length){box.textContent='The first sheet of this file is empty.';box.classList.remove('hide');$('rep').classList.add('hide');return}
  repInit(rows);
}
function load(file){
  if(!file)return;
  const bad=m=>{$('report').textContent=m;$('report').classList.remove('hide')};
  if(!/\.(xlsx|xls|csv)$/i.test(file.name))return bad('Unsupported file type. Please use .xlsx, .xls, or .csv.');
 if(file.size>30*1024*1024)return bad('File is too large (max 30 MB).');
  fileName=file.name;
  const r=new FileReader();
  r.onload=e=>{
    try{
      wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      render();
    }catch(err){console.error(err);$('report').textContent='Could not read the file. Make sure it is .xlsx, .xls, or .csv.';$('report').classList.remove('hide')}
  };
  r.readAsArrayBuffer(file);
}
const drop=$('drop'),inp=$('file');
drop.onclick=()=>inp.click();
drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}};
inp.onchange=()=>load(inp.files[0]);
drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};
drop.ondragleave=()=>drop.classList.remove('over');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');load(e.dataTransfer.files[0])};
function save(name,data){
  const type=name.endsWith('.pdf')?'application/pdf':name.endsWith('.zip')?'application/zip':name.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/plain;charset=utf-8';
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}