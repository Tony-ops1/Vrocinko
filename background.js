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
