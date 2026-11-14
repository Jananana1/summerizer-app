(function(root){
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const norm=s=>String(s).replace(/€/g,'(E)').toLowerCase().replace(/[^a-z0-9]/g,'');
const kids=(el,n)=>[...el.childNodes].filter(c=>c.nodeType===1&&c.localName===n);
const tNodes=el=>[...el.getElementsByTagNameNS(NS,'t')];
const tText=el=>tNodes(el).map(t=>t.textContent).join('');
const val=e=>e?e.getAttributeNS(NS,'val'):null;
function setText(t,s){t.textContent=s;t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve')}

function parseClients(rows){
  if(!rows.length)return{clients:[],cols:[]};
  const headers=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(h=>h.trim()&&!/^__EMPTY/.test(h));
  const nameKey=headers.find(h=>/name/i.test(h));
  const emailKey=headers.find(h=>/e-?mail/i.test(h));
  if(!nameKey)return{clients:[],cols:[],error:'No column with "Name" in its header was found in the Excel file.'};
  const cols=headers.filter(h=>h!==nameKey&&h!==emailKey);
  const clients=[];
  rows.forEach(r=>{
    const name=String(r[nameKey]==null?'':r[nameKey]).trim();
    if(!name)return;
    const results=new Map();let any=false;
    cols.forEach(h=>{const v=String(r[h]==null?'':r[h]).trim();results.set(norm(h),v);if(v)any=true});
    clients.push({name,results,hasAny:any});
  });
  return{clients,cols};
}

function fillDoc(doc,v){
  tNodes(doc).forEach(t=>{
    const s=t.textContent;
    if(s==='[DATE]'&&v.date)setText(t,v.date);
    else if(s==='[Name]')setText(t,v.name);
    else if((s==='XXXXX'||s==='xxxxx')&&v.testName)setText(t,v.testName);
    else if(s==='XXX'&&v.conducted)setText(t,v.conducted);
    else if(s==='XXX XXXX'&&v.subject)setText(t,v.subject);
  });
  let filled=0;
  [...doc.getElementsByTagNameNS(NS,'tr')].forEach(tr=>{
    const tcs=kids(tr,'tc');
    if(tcs.length!==2)return;
    const key=norm(tText(tcs[0]));
    if(!v.results.has(key))return;
    const ts=tNodes(tcs[1]);
    if(!ts.length)return;
    setText(ts[0],v.results.get(key)||'\u2014');
    ts.slice(1).forEach(t=>{t.textContent=''});
    filled++;
  });
  return filled;
}

const on=(rPr,tag)=>{const e=rPr&&kids(rPr,tag)[0];if(!e)return false;const x=val(e);return !(x==='0'||x==='false')};
const colorOf=rPr=>{const c=rPr&&val(kids(rPr,'color')[0]);return c&&c!=='auto'?c:null};
const sizeOf=rPr=>{const s=rPr&&val(kids(rPr,'sz')[0]);return s?+s/2:null};
const hex=h=>h?[0,2,4].map(k=>parseInt(h.substr(k,2),16)):[0,0,0];

function runsOf(p){
  const out=[];
  [...p.getElementsByTagNameNS(NS,'r')].forEach(r=>{
    const rPr=kids(r,'rPr')[0];
    const st={b:on(rPr,'b'),i:on(rPr,'i'),c:colorOf(rPr),s:sizeOf(rPr)||10};
    [...r.childNodes].forEach(n=>{
      if(n.localName==='t')out.push({...st,t:n.textContent});
      else if(n.localName==='tab')out.push({...st,t:'    '});
      else if(n.localName==='br'&&n.getAttributeNS(NS,'type')==='page')out.push({...st,page:true});
    });
  });
  return out;
}

function renderPdf(doc,JSPDF,AT){
  const pdf=new JSPDF({unit:'pt',format:'a4'});
  const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight(),M=64,CW=W-2*M;
  let y=M;
  const font=(b,i,s)=>{pdf.setFont('helvetica',b&&i?'bolditalic':b?'bold':i?'italic':'normal');pdf.setFontSize(s)};
  function draw(lines,indent,list){
    lines.forEach((ln,li)=>{
      while(ln.length&&/^\s+$/.test(ln[ln.length-1].t))ln.pop();
      if(!ln.length)return;
      const lh=Math.max(...ln.map(t=>t.s))*1.4;
      if(y+lh>H-M){pdf.addPage();y=M}
      let x=M+indent;
      if(list&&li===0){font(ln[0].b,false,ln[0].s);pdf.setTextColor(0,0,0);pdf.text('\u2022',M+4,y+lh*0.75)}
      ln.forEach(t=>{font(t.b,t.i,t.s);const c=hex(t.c);pdf.setTextColor(c[0],c[1],c[2]);pdf.text(t.t,x,y+lh*0.75);x+=t.w});
      y+=lh;
    });
  }
  function para(p){
    const pPr=kids(p,'pPr')[0],list=!!(pPr&&kids(pPr,'numPr').length);
    const runs=runsOf(p);
    if(!runs.some(r=>r.page||(r.t&&r.t.trim()))){y+=10;return}
    const indent=list?16:0,avail=CW-indent;
    let lines=[[]],lw=0;
    runs.forEach(r=>{
      if(r.page){draw(lines,indent,list);lines=[[]];lw=0;pdf.addPage();y=M;return}
      font(r.b,r.i,r.s);
      r.t.split(/(\s+)/).filter(s=>s!=='').forEach(tok=>{
        const sp=/^\s+$/.test(tok),w=pdf.getTextWidth(tok),cur=lines[lines.length-1];
        if(!sp&&lw+w>avail&&cur.length){lines.push([]);lw=0}
        const ln=lines[lines.length-1];
        if(sp&&!ln.length)return;
        ln.push({t:tok,w,b:r.b,i:r.i,c:r.c,s:r.s});lw+=w;
      });
    });
    draw(lines,indent,list);y+=6;
  }
  function table(tbl){
    const body=kids(tbl,'tr').map(tr=>kids(tr,'tc').map(tc=>{
      const pr=kids(tc,'tcPr')[0],gs=pr&&kids(pr,'gridSpan')[0],shd=pr&&kids(pr,'shd')[0];
      const fill=shd&&shd.getAttributeNS(NS,'fill');
      const r0=tc.getElementsByTagNameNS(NS,'r')[0],rPr=r0&&kids(r0,'rPr')[0];
      const st={};
      if(on(rPr,'b'))st.fontStyle='bold';
      const c=colorOf(rPr);if(c)st.textColor=hex(c);
      if(fill&&fill!=='auto'&&fill.toUpperCase()!=='FFFFFF')st.fillColor=hex(fill);
      return{content:kids(tc,'p').map(tText).filter(Boolean).join('\n'),colSpan:gs?+val(gs):1,styles:st};
    }));
    AT(pdf,{startY:y,body,theme:'plain',styles:{fontSize:9.5,cellPadding:{top:4,bottom:4,left:5,right:5},lineColor:[207,218,213],lineWidth:0.3,font:'helvetica',textColor:[0,0,0]},columnStyles:{0:{cellWidth:CW*0.58}},margin:{left:M,right:M}});
    y=pdf.lastAutoTable.finalY+14;
  }
  const bodyEl=doc.getElementsByTagNameNS(NS,'body')[0];
  [...bodyEl.childNodes].filter(n=>n.nodeType===1).forEach(n=>{
    if(n.localName==='p')para(n);else if(n.localName==='tbl')table(n);
  });
  return pdf;
}
const api={norm,parseClients,fillDoc,renderPdf};
if(typeof module!=='undefined')module.exports=api;else root.RepCore=api;
})(typeof window!=='undefined'?window:globalThis);