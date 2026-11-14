let repClients=[];
const rsay=t=>{$('rmsg').textContent=t};
const d0=new Date();$('rdate').value=d0.getFullYear()+'-'+String(d0.getMonth()+1).padStart(2,'0')+'-'+String(d0.getDate()).padStart(2,'0');
const fmtDate=iso=>{const a=iso.split('-').map(Number);return new Date(a[0],a[1]-1,a[2]).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})};
const safeName=s=>s.replace(/[^\w\- ]+/g,'_').trim().slice(0,80)||'client';
function repInit(rows){
  const p=RepCore.parseClients(rows);
  repClients=p.error?[]:p.clients.filter(c=>c.hasAny);
  if(!repClients.length){$('rep').classList.add('hide');return}
  const skip=p.clients.length-repClients.length;
  $('rinfo').textContent=repClients.length+' client'+(repClients.length===1?'':'s')+' ready for an individual report'+(skip?' ('+skip+' with no results skipped).':'.');
  const opts=repClients.map((c,i)=>'<option value="'+i+'"></option>').join('');
  ['rfrom','rto'].forEach(id=>{$(id).innerHTML=opts;[...$(id).options].forEach((o,i)=>{o.textContent=(i+1)+'. '+repClients[i].name})});
  $('rfrom').value='0';$('rto').value=String(repClients.length-1);
  $('rep').classList.remove('hide');
}
$('rgen').onclick=async()=>{
  if(!repClients.length)return;
  const fmt=$('rfmt').value,asZip=$('rzip').value==='zip',btn=$('rgen');
  btn.disabled=true;rsay('Generating reports...');
  try{
    const zip=await JSZip.loadAsync(TPL_B64,{base64:true});
    const xml=await zip.file('word/document.xml').async('string');
    const common={date:$('rdate').value?fmtDate($('rdate').value):'',testName:$('rtest').value.trim(),subject:$('rsubj').value.trim(),conducted:$('rcond').value.trim()};
    const used=new Map(),bundle=asZip?new JSZip():null,out=[];
    let a=+$('rfrom').value,z=+$('rto').value;if(a>z){const t=a;a=z;z=t}
    const list=repClients.slice(a,z+1);
    if(asZip&&fmt==='docx'&&list.length>200&&!confirm('Word files are large (about 1.7 MB each). '+list.length+' clients in one ZIP may use a lot of memory and could freeze the browser. Tip: split into batches of 200 or fewer, or use PDF. Continue anyway?')){btn.disabled=false;rsay('');return}
    for(let i=0;i<list.length;i++){
      const c=list[i];
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      RepCore.fillDoc(doc,Object.assign({},common,{name:c.name,results:c.results}));
      let data;
      if(fmt==='pdf'){data=RepCore.renderPdf(doc,window.jspdf.jsPDF,(pdf,o)=>pdf.autoTable(o)).output('arraybuffer')}
      else{
        zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/,''),{createFolders:false});
        data=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
      }
      const base=safeName(c.name),n=(used.get(base)||0)+1;used.set(base,n);
      const fname=base+(n>1?'-'+n:'')+'-report.'+fmt;
      if(asZip)bundle.file(fname,data,{createFolders:false});else out.push([fname,data]);
      if(i%5===4||i===list.length-1){rsay('Generating '+(i+1)+' / '+list.length+'...');await new Promise(r=>setTimeout(r,0))}
    }
    if(asZip){
      rsay('Creating ZIP...');
      const blob=await bundle.generateAsync({type:'uint8array',compression:fmt==='docx'?'STORE':'DEFLATE',compressionOptions:{level:1}});
      await save('individual-reports-'+fmt+'.zip',blob);
      rsay('Done: '+list.length+' report'+(list.length>1?'s':'')+' in one ZIP.');
    }else{
      for(let i=0;i<out.length;i++){
        rsay('Saving '+(i+1)+' of '+out.length+'...');
        await save(out[i][0],out[i][1]);
        if(i<out.length-1)await new Promise(r=>setTimeout(r,600));
      }
      rsay('Done: '+out.length+' report'+(out.length>1?'s':'')+' saved as separate files.');
    }
  }catch(e){console.error(e);rsay('Something went wrong while generating the reports. Please try again.')}
  btn.disabled=false;
};