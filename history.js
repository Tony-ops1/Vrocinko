(() => {
  const SUPABASE_URL='https://ndmepipotkkubuuscfnm.supabase.co';
  const SUPABASE_KEY='sb_publishable_CQJYpxpxsIxGtFCdrqdAtA_dlLTYh2a';
  const AUTH_KEY='sb-ndmepipotkkubuuscfnm-auth-token';
  const ACTIVE_CHILD_KEY='vrocinko-active-child-v1';
  const STATE_KEY='vrocinko-v3';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function token(){
    try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')?.access_token||'';}catch(e){return '';}
  }
  function state(){
    try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')||{};}catch(e){return {};}
  }
  function fmtDate(iso){return new Intl.DateTimeFormat('sl-SI',{day:'numeric',month:'numeric',year:'numeric'}).format(new Date(iso));}
  function fmtTime(iso){return new Intl.DateTimeFormat('sl-SI',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}
  async function api(path){
    const access=token();
    if(!access) throw new Error('NOT_SIGNED_IN');
    const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${access}`},
      cache:'no-store'
    });
    if(!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  function ensureUi(){
    if(!$('historyStyle')){
      const style=document.createElement('style');
      style.id='historyStyle';
      style.textContent=`
        .historyButton{width:100%;min-height:50px;border:1px solid var(--line);border-radius:16px;background:var(--card);color:#344054;font-weight:750;margin-top:10px}
        .historyStatus{font-size:14px;color:var(--muted);line-height:1.5;margin:4px 0 12px}
        .historyList{display:grid;gap:10px}
        .historyCard{border:1px solid var(--line);border-radius:18px;background:#fff;overflow:hidden}
        .historyHead{width:100%;border:0;background:#fff;color:var(--text);padding:14px 15px;text-align:left;display:flex;justify-content:space-between;gap:12px;font-weight:800}
        .historyHead small{display:block;color:var(--muted);font-weight:600;margin-top:4px}
        .historyDetails{border-top:1px solid var(--line);padding:7px 14px 12px}
        .historyEntry{padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;line-height:1.4}
        .historyEntry:last-child{border-bottom:0}
      `;
      document.head.appendChild(style);
    }
    if(!$('historyBtn')){
      const newIllness=$('newIllnessBtn');
      if(newIllness){
        const btn=document.createElement('button');
        btn.id='historyBtn';
        btn.className='historyButton';
        btn.type='button';
        btn.textContent='Pretekle bolezni';
        newIllness.insertAdjacentElement('afterend',btn);
        btn.addEventListener('click',openHistory);
      }
    }
    if(!$('historySheet')){
      const back=document.createElement('div');
      back.id='historySheet';
      back.className='sheetBack hide';
      back.setAttribute('role','dialog');
      back.setAttribute('aria-modal','true');
      back.innerHTML='<div class="sheet"><div class="grab"></div><div class="sheetHead"><h2>Pretekle bolezni</h2><button id="historyClose" class="close" type="button">×</button></div><div id="historyStatus" class="historyStatus"></div><div id="historyList" class="historyList"></div></div>';
      document.body.appendChild(back);
      $('historyClose').addEventListener('click',closeHistory);
      back.addEventListener('click',e=>{if(e.target===back)closeHistory();});
    }
  }

  function closeHistory(){
    $('historySheet')?.classList.add('hide');
    document.body.style.overflow='';
  }

  async function currentChildId(){
    const stored=localStorage.getItem(ACTIVE_CHILD_KEY);
    const children=await api('vrocinko_children?select=id,name,created_at&order=created_at.asc');
    if(stored&&children.some(c=>c.id===stored)) return stored;
    const name=String(state().childName||'').trim().toLowerCase();
    const match=children.find(c=>String(c.name||'').trim().toLowerCase()===name)||children[0];
    return match?.id||'';
  }

  async function openHistory(){
    ensureUi();
    $('historySheet').classList.remove('hide');
    document.body.style.overflow='hidden';
    $('historyStatus').textContent='Nalagam …';
    $('historyList').innerHTML='';
    if(!navigator.onLine){
      $('historyStatus').textContent='Za ogled preteklih bolezni potrebujete internetno povezavo.';
      return;
    }
    try{
      const childId=await currentChildId();
      if(!childId){
        $('historyStatus').textContent='Izbranega otroka ni bilo mogoče določiti.';
        return;
      }
      const illnesses=await api(`vrocinko_illnesses?select=id,started_at,ended_at&child_id=eq.${encodeURIComponent(childId)}&ended_at=not.is.null&order=started_at.desc`);
      if(!illnesses.length){
        $('historyStatus').textContent='Za tega otroka še ni shranjenih preteklih bolezni.';
        return;
      }
      const entriesByIllness=new Map();
      await Promise.all(illnesses.map(async illness=>{
        const entries=await api(`vrocinko_entries?select=type,title,detail,recorded_at&illness_id=eq.${encodeURIComponent(illness.id)}&order=recorded_at.asc`);
        entriesByIllness.set(illness.id,entries);
      }));
      $('historyStatus').textContent=`Shranjene pretekle bolezni: ${illnesses.length}`;
      $('historyList').innerHTML=illnesses.map((illness,index)=>{
        const entries=entriesByIllness.get(illness.id)||[];
        const start=fmtDate(illness.started_at);
        const end=fmtDate(illness.ended_at);
        const range=start===end?start:`${start} – ${end}`;
        return `<div class="historyCard"><button class="historyHead" type="button" data-history="${index}"><span>${esc(range)}<small>${entries.length} ${entries.length===1?'zapis':'zapisov'}</small></span><span>⌄</span></button><div id="historyDetail${index}" class="historyDetails hide">${entries.length?entries.map(entry=>`<div class="historyEntry"><strong>${esc(fmtTime(entry.recorded_at))} · ${esc(entry.title)}</strong>${entry.detail?`<br>${esc(entry.detail)}`:''}</div>`).join(''):'<div class="historyEntry">Ni zabeleženih vnosov.</div>'}</div></div>`;
      }).join('');
      document.querySelectorAll('[data-history]').forEach(btn=>btn.addEventListener('click',()=>{
        $(`historyDetail${btn.dataset.history}`)?.classList.toggle('hide');
      }));
    }catch(error){
      $('historyStatus').textContent=String(error.message)==='NOT_SIGNED_IN'?'Za ogled preteklih bolezni se prijavite v Moj račun.':'Preteklih bolezni trenutno ni bilo mogoče naložiti.';
    }
  }

  ensureUi();
})();
