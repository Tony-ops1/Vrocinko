(() => {
  const SUPABASE_URL='https://ndmepipotkkubuuscfnm.supabase.co';
  const SUPABASE_KEY='sb_publishable_CQJYpxpxsIxGtFCdrqdAtA_dlLTYh2a';
  const AUTH_KEY='sb-ndmepipotkkubuuscfnm-auth-token';
  const ACTIVE_CHILD_KEY='vrocinko-active-child-v1';
  const STATE_KEY='vrocinko-v3';
  const $=id=>document.getElementById(id);
  let busy=false;

  function token(){
    try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')?.access_token||'';}catch(e){return '';}
  }
  function state(){
    try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')||{};}catch(e){return {};}
  }
  function saveState(value){localStorage.setItem(STATE_KEY,JSON.stringify(value));}
  function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));}

  async function api(path,{method='GET',body=null,prefer=''}={}){
    const access=token();
    if(!access) throw new Error('NOT_SIGNED_IN');
    const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${access}`};
    if(body!==null) headers['Content-Type']='application/json';
    if(prefer) headers.Prefer=prefer;
    const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
      method,
      headers,
      body:body===null?undefined:JSON.stringify(body),
      cache:'no-store'
    });
    if(!response.ok) throw new Error(`HTTP_${response.status}`);
    if(response.status===204) return null;
    const text=await response.text();
    return text?JSON.parse(text):null;
  }

  async function currentChild(currentState){
    const children=await api('vrocinko_children?select=id,name,created_at&order=created_at.asc');
    const stored=localStorage.getItem(ACTIVE_CHILD_KEY);
    if(stored){
      const exact=children.find(c=>c.id===stored);
      if(exact) return exact;
    }
    const name=String(currentState.childName||'').trim().toLowerCase();
    if(!name) return null;
    return children.find(c=>String(c.name||'').trim().toLowerCase()===name)||null;
  }

  async function safeStart(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    if(busy) return;
    if(!confirm('Začnem novo bolezen? Trenutni potek bo ostal shranjen med preteklimi boleznimi.')) return;

    if(!navigator.onLine){
      alert('Za varno shranitev trenutne bolezni potrebujete internetno povezavo. Poskusite znova, ko bo povezava na voljo.');
      return;
    }
    if(!token()){
      alert('Za začetek nove bolezni se najprej prijavite v Moj račun, da trenutni potek ostane varno shranjen.');
      return;
    }

    busy=true;
    const btn=$('newIllnessBtn');
    if(btn) btn.disabled=true;
    const currentState=state();
    let oldIllnessId='';
    let oldWasEnded=false;

    try{
      const child=await currentChild(currentState);
      if(!child) throw new Error('CHILD_NOT_FOUND');

      const open=await api(`vrocinko_illnesses?select=id,user_id,started_at&child_id=eq.${encodeURIComponent(child.id)}&ended_at=is.null&order=created_at.desc&limit=1`);
      const currentIllness=Array.isArray(open)?open[0]:null;
      if(!currentIllness?.id) throw new Error('ILLNESS_NOT_FOUND');
      oldIllnessId=currentIllness.id;

      const entries=Array.isArray(currentState.entries)?currentState.entries:[];
      if(entries.some(e=>!isUuid(e.id))) throw new Error('INVALID_ENTRY_ID');
      if(entries.length){
        const rows=entries.map(e=>({
          id:e.id,
          user_id:currentIllness.user_id,
          illness_id:currentIllness.id,
          type:e.type,
          title:e.title,
          detail:e.detail||'',
          recorded_at:e.at
        }));
        await api('vrocinko_entries?on_conflict=id',{
          method:'POST',
          body:rows,
          prefer:'resolution=merge-duplicates,return=minimal'
        });
      }

      const endedAt=new Date().toISOString();
      await api(`vrocinko_illnesses?id=eq.${encodeURIComponent(currentIllness.id)}`,{
        method:'PATCH',
        body:{ended_at:endedAt},
        prefer:'return=minimal'
      });
      oldWasEnded=true;

      const startedAt=new Date().toISOString();
      const created=await api('vrocinko_illnesses',{
        method:'POST',
        body:{user_id:currentIllness.user_id,child_id:child.id,started_at:startedAt},
        prefer:'return=representation'
      });
      if(!Array.isArray(created)||!created[0]?.id) throw new Error('CREATE_FAILED');

      const nextState={
        childName:String(currentState.childName||child.name||''),
        startedAt:created[0].started_at||startedAt,
        entries:[],
        deletedIds:[]
      };
      saveState(nextState);
      localStorage.setItem(ACTIVE_CHILD_KEY,child.id);
      location.reload();
    }catch(error){
      if(oldWasEnded&&oldIllnessId){
        try{
          await api(`vrocinko_illnesses?id=eq.${encodeURIComponent(oldIllnessId)}`,{
            method:'PATCH',
            body:{ended_at:null},
            prefer:'return=minimal'
          });
        }catch(e){}
      }
      console.error('Varni začetek nove bolezni:',error);
      alert('Nove bolezni trenutno ni bilo mogoče začeti. Obstoječa bolezen in njeni zapisi so ostali shranjeni.');
    }finally{
      busy=false;
      if(btn) btn.disabled=false;
    }
  }

  function install(){
    const btn=$('newIllnessBtn');
    if(!btn||btn.dataset.safeNewIllness==='1') return;
    btn.dataset.safeNewIllness='1';
    btn.addEventListener('click',safeStart,true);
  }

  install();
})();
