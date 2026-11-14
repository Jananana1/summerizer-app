(function(){
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(standalone())return;
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const secure=location.protocol==='https:'||(location.protocol==='http:'&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname));
const KEY='installDismissedAt',WAIT=7*24*3600*1000;
const get=()=>{try{return +localStorage.getItem(KEY)||0}catch(e){return 0}};
const set=()=>{try{localStorage.setItem(KEY,String(Date.now()))}catch(e){}};
let deferred=null;
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){navigator.serviceWorker.register('sw.js').catch(()=>{})}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e});

const st=document.createElement('style');
st.textContent='#ib{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:480px;margin:0 auto;background:var(--surface,#fff);color:var(--ink,#14231C);border:1px solid var(--line,#CFDAD5);border-radius:14px;padding:14px 16px;box-shadow:0 8px 28px rgba(0,0,0,.22);z-index:99;display:flex;flex-direction:column;gap:10px;animation:ibup .25s ease-out}'
+'#ib b{display:block}#ib span{color:var(--muted,#5B6B63);font-size:.92rem}'
+'#ib .r{display:flex;gap:10px;justify-content:flex-end}'
+'@keyframes ibup{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}';
document.head.appendChild(st);

function open(){
  if(document.getElementById('ib')||Date.now()-get()<WAIT)return;
  const b=document.createElement('div');b.id='ib';b.setAttribute('role','dialog');b.setAttribute('aria-label','Install app');
  b.innerHTML='<div><b>Install Excel Results Summarizer</b><span id="ibt">Add it to your device and open it from the app icon.</span></div>'
   +'<div class="r"><button type="button" id="ibn">Not now</button><button type="button" id="ibi" class="primary">Install</button></div>';
  document.body.appendChild(b);
  const close=()=>b.remove();
  document.getElementById('ibn').onclick=()=>{set();close()};
  document.getElementById('ibi').onclick=async()=>{
    if(deferred){deferred.prompt();try{await deferred.userChoice}catch(e){}deferred=null;close();return}
    document.getElementById('ibt').textContent=!secure
      ?'Install is not available here because the app was opened as a local file or over plain HTTP. Host the folder on an HTTPS link (e.g. Netlify Drop or GitHub Pages) and open that link to install.'
      :ios?'Tap the Share button in Safari, then choose "Add to Home Screen".'
      :'Open your browser menu and choose "Install app" or "Add to Home screen".';
    document.getElementById('ibi').remove();
    document.getElementById('ibn').textContent='Close';
  };
}
window.addEventListener('appinstalled',()=>{const b=document.getElementById('ib');if(b)b.remove()});
window.addEventListener('load',()=>setTimeout(open,1200));
})();