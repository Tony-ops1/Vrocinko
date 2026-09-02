(() => {
  const CONSENT_KEY='vrocinko-cloud-consent-v1';
  const CONSENT_VERSION='2026-09-02-v1';
  const SUPABASE_ORIGIN='https://ndmepipotkkubuuscfnm.supabase.co';
  let consentPromise=null;

  function hasCloudConsent(){
    try{
      const saved=JSON.parse(localStorage.getItem(CONSENT_KEY)||'null');
      return !!saved&&saved.accepted===true&&saved.version===CONSENT_VERSION;
    }catch(e){
      return false;
    }
  }

  function saveCloudConsent(){
    localStorage.setItem(CONSENT_KEY,JSON.stringify({
      accepted:true,
      version:CONSENT_VERSION,
      acceptedAt:new Date().toISOString()
    }));
  }

  function requestCloudConsent(){
    if(hasCloudConsent()) return Promise.resolve(true);
    if(consentPromise) return consentPromise;

    consentPromise=new Promise(resolve=>{
      const back=document.createElement('div');
      back.id='cloudConsentBack';
      back.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center;padding-top:40px';
      back.innerHTML=`
        <div style="width:min(560px,100%);max-height:90vh;overflow:auto;background:#f8fafc;border-radius:28px 28px 0 0;padding:20px 18px calc(env(safe-area-inset-bottom) + 20px);box-shadow:0 -10px 40px rgba(15,23,42,.2);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#172033">
          <div style="width:44px;height:5px;border-radius:999px;background:#d0d5dd;margin:0 auto 18px"></div>
          <h2 style="font-size:24px;margin:0 0 10px">☁️ Soglasje za shranjevanje v oblak</h2>
          <p style="font-size:15px;line-height:1.5;color:#667085;margin:0 0 14px">Če se prijavite v Vročinko račun, se podatki, ki jih vnesete (ime ali kratica otroka, temperatura, simptomi, zdravila, opombe ter datum in čas), shranjujejo v vaš račun v oblaku prek Supabase. Namen je shranjevanje dnevnika, preteklih bolezni in uporaba na več napravah.</p>
          <label style="display:flex;align-items:flex-start;gap:11px;background:#fff;border:1px solid #d0d5dd;border-radius:16px;padding:14px;line-height:1.45;font-size:15px">
            <input id="cloudConsentCheck" type="checkbox" style="width:20px;height:20px;margin-top:1px;flex:none">
            <span><strong>Izrecno soglašam</strong>, da se podatki o zdravju, ki jih vnesem v Vročinko, shranjujejo v moj Vročinko račun za namen vodenja dnevnika bolezni in sinhronizacije.</span>
          </label>
          <p style="font-size:13px;line-height:1.45;color:#667085;margin:12px 2px"><a href="privacy.html" target="_blank" rel="noopener" style="color:#2563eb">Preberi Politiko zasebnosti</a></p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button id="cloudConsentNo" type="button" style="min-height:54px;border:1px solid #d0d5dd;border-radius:17px;background:#fff;color:#172033;font-weight:800">Ne soglašam</button>
            <button id="cloudConsentYes" type="button" disabled style="min-height:54px;border:0;border-radius:17px;background:#172033;color:#fff;font-weight:800;opacity:.45">Soglašam in nadaljuj</button>
          </div>
        </div>`;

      document.body.appendChild(back);
      const check=back.querySelector('#cloudConsentCheck');
      const yes=back.querySelector('#cloudConsentYes');
      const no=back.querySelector('#cloudConsentNo');

      function finish(value){
        back.remove();
        consentPromise=null;
        resolve(value);
      }

      check.addEventListener('change',()=>{
        yes.disabled=!check.checked;
        yes.style.opacity=check.checked?'1':'.45';
      });
      no.addEventListener('click',()=>finish(false));
      yes.addEventListener('click',()=>{
        if(!check.checked) return;
        saveCloudConsent();
        finish(true);
      });
    });

    return consentPromise;
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(String(url).startsWith(SUPABASE_ORIGIN)&&!hasCloudConsent()){
      return Promise.reject(new Error('VROCINKO_CLOUD_CONSENT_REQUIRED'));
    }
    return nativeFetch(input,init);
  };

  const originalCreateClient=window.supabase?.createClient;
  if(typeof originalCreateClient==='function'){
    window.supabase.createClient=function(...args){
      const client=originalCreateClient.apply(this,args);
      const auth=client?.auth;
      if(auth&&!auth.__vrocinkoConsentWrapped){
        Object.defineProperty(auth,'__vrocinkoConsentWrapped',{value:true});

        const originalGetSession=auth.getSession.bind(auth);
        auth.getSession=()=>{
          if(!hasCloudConsent()) return Promise.resolve({data:{session:null},error:null});
          return originalGetSession();
        };

        const originalOnAuthStateChange=auth.onAuthStateChange.bind(auth);
        auth.onAuthStateChange=(callback)=>originalOnAuthStateChange((event,nextSession)=>{
          if(nextSession&&!hasCloudConsent()) return callback('SIGNED_OUT',null);
          return callback(event,nextSession);
        });

        const originalSignInWithOAuth=auth.signInWithOAuth.bind(auth);
        auth.signInWithOAuth=async(...loginArgs)=>{
          if(!hasCloudConsent()){
            const accepted=await requestCloudConsent();
            if(!accepted){
              setTimeout(()=>{
                const msg=document.getElementById('authMessage');
                if(msg){
                  msg.textContent='Brez soglasja se podatki ne shranjujejo v oblak. Vročinko lahko še naprej uporabljate lokalno na tej napravi.';
                  msg.className='authMessage';
                }
                const btn=document.getElementById('sendLoginBtn');
                if(btn) btn.disabled=false;
              },0);
              return {data:null,error:new Error('CONSENT_REQUIRED')};
            }
          }
          return originalSignInWithOAuth(...loginArgs);
        };
      }
      return client;
    };
  }

  window.VrocinkoCloudConsent={
    has:hasCloudConsent,
    request:requestCloudConsent,
    version:CONSENT_VERSION
  };
})();

(() => {
  function cleanAndLabelUi(){
    document.querySelectorAll('.freeBadge').forEach(el=>el.remove());

    const accountBtn=document.getElementById('accountBtn');
    if(accountBtn&&accountBtn.textContent.trim()!=='☁️ Moj račun') accountBtn.textContent='☁️ Moj račun';

    const accountTitle=document.getElementById('accountTitle');
    if(accountTitle&&accountTitle.textContent.trim()!=='☁️ Moj račun') accountTitle.textContent='☁️ Moj račun';
  }

  cleanAndLabelUi();
  new MutationObserver(cleanAndLabelUi).observe(document.documentElement,{childList:true,subtree:true});

  async function loadBackground(){
    try{
      const files=['assets/bgw1.txt','assets/bgw2.txt','assets/bgw3.txt','assets/bgw4.txt','assets/bgw5.txt','assets/bgw6.txt'];
      const parts=await Promise.all(files.map(async file=>{
        const response=await fetch(file,{cache:'no-store'});
        if(!response.ok) throw new Error(`Background ${response.status}`);
        return (await response.text()).trim();
      }));
      const dataUrl=`data:image/webp;base64,${parts.join('')}`;
      document.documentElement.style.setProperty('--vrocinko-bg',`url("${dataUrl}")`);
      document.body.classList.add('has-child-background');
    }catch(error){
      console.warn('Ozadja ni bilo mogoče naložiti.',error);
    }
  }

  function loadDays(){
    if(document.querySelector('script[data-vrocinko-days]')) return;
    const script=document.createElement('script');
    script.src='days.js';
    script.dataset.vrocinkoDays='1';
    document.body.appendChild(script);
  }

  function loadHistory(){
    if([...document.scripts].some(script=>(script.getAttribute('src')||'').endsWith('history.js'))) return;
    const script=document.createElement('script');
    script.src='history.js';
    script.dataset.vrocinkoHistory='1';
    document.body.appendChild(script);
  }

  function loadNewIllnessGuard(){
    if([...document.scripts].some(script=>(script.getAttribute('src')||'').endsWith('new-illness-guard.js'))) return;
    const script=document.createElement('script');
    script.src='new-illness-guard.js';
    script.dataset.vrocinkoNewIllnessGuard='1';
    document.body.appendChild(script);
  }

  function loadDeleteData(){
    if([...document.scripts].some(script=>(script.getAttribute('src')||'').endsWith('delete-data.js'))) return;
    const script=document.createElement('script');
    script.src='delete-data.js';
    script.dataset.vrocinkoDeleteData='1';
    document.body.appendChild(script);
  }

  function loadExtras(){
    cleanAndLabelUi();
    loadDays();
    loadHistory();
    loadNewIllnessGuard();
    loadDeleteData();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{cleanAndLabelUi();loadBackground();},{once:true});
  else {cleanAndLabelUi();loadBackground();}
  if(document.readyState==='complete') loadExtras();
  else window.addEventListener('load',loadExtras,{once:true});
})();
