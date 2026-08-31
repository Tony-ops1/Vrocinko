(() => {
  const KEY='vrocinko-v3';
  const LAST_USER_KEY='vrocinko-last-user-v2';
  const ACTIVE_CHILD_KEY='vrocinko-active-child-v1';
  const SUPABASE_URL='https://ndmepipotkkubuuscfnm.supabase.co';
  const SUPABASE_KEY='sb_publishable_CQJYpxpxsIxGtFCdrqdAtA_dlLTYh2a';
  const $=id=>document.getElementById(id);
  const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  let state=load();
  let selectedSymptoms=new Set();
  let tempSelectedSymptoms=new Set();
  let session=null;
  let cloudChildId=null;
  let cloudIllnessId=null;
  let cloudChildren=[];
  let syncPromise=null;

  function emptyState(){return {childName:'',startedAt:new Date().toISOString(),entries:[],deletedIds:[]};}
  function load(){
    try{
      const raw=localStorage.getItem(KEY)||localStorage.getItem('vrocinko-v2')||localStorage.getItem('vrocinko-v1');
      if(raw){
        const p=JSON.parse(raw);
        return {
          childName:String(p.childName||''),
          startedAt:p.startedAt||new Date().toISOString(),
          entries:Array.isArray(p.entries)?p.entries:[],
          deletedIds:Array.isArray(p.deletedIds)?p.deletedIds:[]
        };
      }
    }catch(e){}
    return emptyState();
  }
  function save(){localStorage.setItem(KEY,JSON.stringify(state));}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function pad(n){return String(n).padStart(2,'0');}
  function uuid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;}
  function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));}
  function localDateValue(d=new Date()){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
  function localTimeValue(d=new Date()){return `${pad(d.getHours())}:${pad(d.getMinutes())}`;}
  function formatDate(iso){return new Intl.DateTimeFormat('sl-SI',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));}
  function formatTime(iso){return new Intl.DateTimeFormat('sl-SI',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}
  function formatDateTime(iso){return `${formatDate(iso)} ob ${formatTime(iso)}`;}
  function illnessDay(){
    const a=new Date(state.startedAt),b=new Date();
    const x=Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()),y=Date.UTC(b.getFullYear(),b.getMonth(),b.getDate());
    return Math.max(1,Math.floor((y-x)/86400000)+1);
  }
  function normalizeIds(){
    let changed=false;
    state.entries=state.entries.map(e=>{
      if(isUuid(e.id)) return e;
      changed=true;
      return {...e,id:uuid()};
    });
    state.deletedIds=state.deletedIds.filter(isUuid);
    if(changed) save();
  }
  function activeCloudChild(){return cloudChildren.find(c=>c.id===cloudChildId)||null;}

  function showApp(){
    const ok=state.childName.trim().length>0;
    $('setup').classList.toggle('hide',ok);
    $('main').classList.toggle('hide',!ok);
    if(ok){
      $('editChild').textContent=`${state.childName} ▾`;
      $('illnessDay').textContent=`Dan ${illnessDay()}`;
      renderTimeline();
    }
    renderAccount();
    renderChildren();
  }
  function openSheet(id){$(id).classList.remove('hide');document.body.style.overflow='hidden';}
  function closeSheet(id){$(id).classList.add('hide');document.body.style.overflow='';}
  function pushEntry(type,title,detail='',at=null){
    const entry={id:uuid(),type,title,detail,at:at||new Date().toISOString()};
    state.entries.push(entry);
    return entry;
  }
  function persistAndSync(){
    save();renderTimeline();showApp();
    if(session) syncCloud().catch(()=>{});
  }
  function addEntry(type,title,detail='',at=null){
    pushEntry(type,title,detail,at);
    persistAndSync();
  }

  function renderTimeline(){
    const box=$('timeline');
    if(!box) return;
    if(!state.entries.length){
      box.innerHTML='<div class="empty">Še ni nobenega zapisa.<br><strong>Začni s temperaturo, zdravilom ali simptomi.</strong></div>';
      return;
    }
    const icons={temp:'🌡️',med:'💊',sym:'🤧'};
    const sorted=[...state.entries].sort((a,b)=>new Date(b.at)-new Date(a.at));
    box.innerHTML=sorted.map(e=>`<div class="event"><div class="eventIcon">${icons[e.type]||'•'}</div><div><div class="eventTitle">${esc(e.title)}</div><div class="eventMeta">${e.detail?esc(e.detail)+' · ':''}${esc(formatDateTime(e.at))}</div></div><button class="delete" type="button" data-delete="${esc(e.id)}" aria-label="Izbriši zapis">×</button></div>`).join('');
    box.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteEntry(btn.dataset.delete)));
  }
  function deleteEntry(id){
    if(!confirm('Izbrišem ta zapis?')) return;
    state.entries=state.entries.filter(e=>e.id!==id);
    if(isUuid(id)&&!state.deletedIds.includes(id)) state.deletedIds.push(id);
    persistAndSync();
  }
  function buildReport(){
    const lines=['VROČINKO – POTEK BOLEZNI',`Otrok: ${state.childName}`,`Začetek spremljanja: ${formatDate(state.startedAt)}`,''];
    if(!state.entries.length) lines.push('Ni zabeleženih podatkov.');
    else{
      let last='';
      [...state.entries].sort((a,b)=>new Date(a.at)-new Date(b.at)).forEach(e=>{
        const d=formatDate(e.at);
        if(d!==last){if(last)lines.push('');lines.push(d);last=d;}
        lines.push(`${formatTime(e.at)}  ${e.title}${e.detail?' – '+e.detail:''}`);
      });
    }
    lines.push('','Zapis je pripravil starš v aplikaciji Vročinko.');
    return lines.join('\n');
  }

  function setCloudMessage(text,kind=''){
    if($('syncStatus')) $('syncStatus').textContent=text;
    if(!$('cloudBanner')) return;
    if(!text){$('cloudBanner').classList.add('hide');return;}
    $('cloudBanner').textContent=text;
    $('cloudBanner').classList.remove('hide','warn');
    if(kind==='warn') $('cloudBanner').classList.add('warn');
  }
  function renderAccount(){
    const signed=!!session;
    if($('signedOutBox')) $('signedOutBox').classList.toggle('hide',signed);
    if($('signedInBox')) $('signedInBox').classList.toggle('hide',!signed);
    if($('accountEmail')) $('accountEmail').textContent=signed?(session.user.email||'Vročinko račun'):'';
    if($('accountBtn')) $('accountBtn').textContent=signed?'☁️ Shranjeno':'☁️ Račun';
    if(signed){
      if(navigator.onLine) setCloudMessage('☁️ Podatki se shranjujejo v vaš Vročinko račun.');
      else setCloudMessage('⚠️ Trenutno ni povezave. Vnosi ostanejo na telefonu in se bodo sinhronizirali pozneje.','warn');
    }else if(state.childName){
      setCloudMessage('☁️ Zapisi so trenutno samo na tem telefonu. Pritisnite Račun za varnostno kopijo.','warn');
    }else{
      setCloudMessage('');
    }
  }

  function renderChildren(){
    const box=$('childList');
    if(!box) return;
    if(!session){
      box.innerHTML=state.childName?`<div class="childChoice active"><span>${esc(state.childName)}</span><span>✓</span></div>`:'<div class="empty">Najprej dodajte otroka.</div>';
      return;
    }
    if(!cloudChildren.length){
      box.innerHTML='<div class="empty">Ni dodanih otrok.</div>';
      return;
    }
    box.innerHTML=cloudChildren.map(c=>`<button class="childChoice ${c.id===cloudChildId?'active':''}" type="button" data-child-id="${esc(c.id)}"><span>${esc(c.name)}</span><span>${c.id===cloudChildId?'✓':'›'}</span></button>`).join('');
    box.querySelectorAll('[data-child-id]').forEach(btn=>btn.addEventListener('click',()=>switchChild(btn.dataset.childId)));
  }

  async function refreshCloudChildren(){
    if(!session||!db) return [];
    const result=await db.from('vrocinko_children').select('id,name,created_at').order('created_at',{ascending:true});
    if(result.error) throw result.error;
    cloudChildren=result.data||[];
    renderChildren();
    return cloudChildren;
  }

  async function loadChildFromCloud(childId){
    if(!session||!db) return;
    let child=cloudChildren.find(c=>c.id===childId);
    if(!child){
      const result=await db.from('vrocinko_children').select('id,name,created_at').eq('id',childId).single();
      if(result.error) throw result.error;
      child=result.data;
      cloudChildren.push(child);
    }
    cloudChildId=child.id;
    localStorage.setItem(ACTIVE_CHILD_KEY,child.id);

    let illnessResult=await db.from('vrocinko_illnesses')
      .select('id,started_at,created_at')
      .eq('child_id',child.id)
      .is('ended_at',null)
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(illnessResult.error) throw illnessResult.error;
    let illness=illnessResult.data;
    if(!illness){
      const created=await db.from('vrocinko_illnesses')
        .insert({user_id:session.user.id,child_id:child.id,started_at:new Date().toISOString()})
        .select('id,started_at')
        .single();
      if(created.error) throw created.error;
      illness=created.data;
    }
    cloudIllnessId=illness.id;

    const entriesResult=await db.from('vrocinko_entries')
      .select('id,type,title,detail,recorded_at')
      .eq('illness_id',cloudIllnessId)
      .order('recorded_at',{ascending:true});
    if(entriesResult.error) throw entriesResult.error;

    state={
      childName:child.name,
      startedAt:illness.started_at||new Date().toISOString(),
      entries:(entriesResult.data||[]).map(e=>({id:e.id,type:e.type,title:e.title,detail:e.detail||'',at:e.recorded_at})),
      deletedIds:[]
    };
    save();
    showApp();
  }

  async function addChild(){
    if(!session){
      renderAccount();
      openSheet('accountSheet');
      showAuthMessage('Za dodajanje več otrok se najprej prijavite z Googlom.','bad');
      return;
    }
    if(!navigator.onLine){alert('Za dodajanje otroka potrebujete internetno povezavo.');return;}
    const raw=prompt('Ime novega otroka:','');
    if(raw===null) return;
    const name=raw.trim().slice(0,30);
    if(!name){alert('Vpišite ime otroka.');return;}
    if(cloudChildren.some(c=>c.name.trim().toLowerCase()===name.toLowerCase())){
      alert('Otrok s tem imenom je že dodan.');
      return;
    }
    try{
      if(cloudChildId) await syncCloud().catch(()=>{});
      const created=await db.from('vrocinko_children')
        .insert({user_id:session.user.id,name})
        .select('id,name,created_at')
        .single();
      if(created.error) throw created.error;
      cloudChildren.push(created.data);
      cloudChildId=created.data.id;
      localStorage.setItem(ACTIVE_CHILD_KEY,cloudChildId);
      const illness=await db.from('vrocinko_illnesses')
        .insert({user_id:session.user.id,child_id:cloudChildId,started_at:new Date().toISOString()})
        .select('id,started_at')
        .single();
      if(illness.error) throw illness.error;
      cloudIllnessId=illness.data.id;
      state=emptyState();
      state.childName=name;
      state.startedAt=illness.data.started_at;
      save();showApp();renderChildren();closeSheet('childSheet');
    }catch(e){
      console.error('Dodaj otroka:',e);
      alert('Otroka trenutno ni bilo mogoče dodati. Poskusite znova.');
    }
  }

  async function switchChild(childId){
    if(!session||!childId||childId===cloudChildId){closeSheet('childSheet');return;}
    if(!navigator.onLine){alert('Za preklop na drugega otroka trenutno potrebujete internetno povezavo.');return;}
    try{
      if(cloudChildId) await syncCloud().catch(()=>{});
      await loadChildFromCloud(childId);
      closeSheet('childSheet');
    }catch(e){
      console.error('Preklop otroka:',e);
      alert('Podatkov za tega otroka trenutno ni bilo mogoče naložiti.');
    }
  }

  async function renameCurrentChild(){
    const raw=prompt('Ime otroka:',state.childName);
    if(raw===null) return;
    const name=raw.trim().slice(0,30);
    if(!name) return;
    try{
      if(session&&cloudChildId){
        const result=await db.from('vrocinko_children').update({name}).eq('id',cloudChildId);
        if(result.error) throw result.error;
        const child=activeCloudChild();
        if(child) child.name=name;
      }
      state.childName=name;
      save();showApp();renderChildren();
    }catch(e){
      alert('Imena trenutno ni bilo mogoče spremeniti.');
    }
  }

  async function ensureCloudContext(){
    if(!session||!db) return false;
    const userId=session.user.id;
    if(!cloudChildren.length) await refreshCloudChildren();

    let child=activeCloudChild();
    if(!child&&cloudChildren.length){
      const stored=localStorage.getItem(ACTIVE_CHILD_KEY);
      child=cloudChildren.find(c=>c.id===stored)
        ||cloudChildren.find(c=>c.name.trim().toLowerCase()===state.childName.trim().toLowerCase())
        ||cloudChildren[0];
      cloudChildId=child.id;
      localStorage.setItem(ACTIVE_CHILD_KEY,child.id);
    }

    if(!child){
      if(!state.childName.trim()) return false;
      const created=await db.from('vrocinko_children')
        .insert({user_id:userId,name:state.childName.trim()})
        .select('id,name,created_at')
        .single();
      if(created.error) throw created.error;
      child=created.data;
      cloudChildren=[child];
      cloudChildId=child.id;
      localStorage.setItem(ACTIVE_CHILD_KEY,child.id);
    }

    if(!state.childName.trim()) state.childName=child.name;

    let {data:illness,error:illnessError}=await db.from('vrocinko_illnesses')
      .select('id,started_at,created_at')
      .eq('child_id',cloudChildId)
      .is('ended_at',null)
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(illnessError) throw illnessError;

    if(!illness){
      const created=await db.from('vrocinko_illnesses')
        .insert({user_id:userId,child_id:cloudChildId,started_at:state.startedAt||new Date().toISOString()})
        .select('id,started_at')
        .single();
      if(created.error) throw created.error;
      illness=created.data;
    }else{
      const localStart=new Date(state.startedAt).getTime();
      const cloudStart=new Date(illness.started_at).getTime();
      if(!state.entries.length||!Number.isFinite(localStart)) state.startedAt=illness.started_at;
      else if(cloudStart<localStart) state.startedAt=illness.started_at;
    }
    cloudIllnessId=illness.id;
    save();showApp();
    return true;
  }

  async function doSync(){
    if(!session||!db||!navigator.onLine) return;
    normalizeIds();
    if($('syncStatus')) $('syncStatus').textContent='☁️ Sinhroniziram …';
    if($('accountBtn')) $('accountBtn').textContent='☁️ …';

    const ready=await ensureCloudContext();
    if(!ready){renderAccount();return;}
    const userId=session.user.id;

    if(state.childName.trim()){
      const renamed=await db.from('vrocinko_children').update({name:state.childName.trim()}).eq('id',cloudChildId);
      if(renamed.error) throw renamed.error;
      const child=activeCloudChild();
      if(child) child.name=state.childName.trim();
    }

    const illnessUpdate=await db.from('vrocinko_illnesses').update({started_at:state.startedAt}).eq('id',cloudIllnessId);
    if(illnessUpdate.error) throw illnessUpdate.error;

    if(state.deletedIds.length){
      const ids=[...state.deletedIds];
      const deleted=await db.from('vrocinko_entries').delete().in('id',ids);
      if(deleted.error) throw deleted.error;
      state.deletedIds=[];
      save();
    }

    if(state.entries.length){
      const rows=state.entries.map(e=>({
        id:e.id,
        user_id:userId,
        illness_id:cloudIllnessId,
        type:e.type,
        title:e.title,
        detail:e.detail||'',
        recorded_at:e.at
      }));
      const upserted=await db.from('vrocinko_entries').upsert(rows,{onConflict:'id'});
      if(upserted.error) throw upserted.error;
    }

    const fetched=await db.from('vrocinko_entries')
      .select('id,type,title,detail,recorded_at')
      .eq('illness_id',cloudIllnessId)
      .order('recorded_at',{ascending:true});
    if(fetched.error) throw fetched.error;
    state.entries=(fetched.data||[]).map(e=>({id:e.id,type:e.type,title:e.title,detail:e.detail||'',at:e.recorded_at}));
    save();showApp();
    if($('syncStatus')) $('syncStatus').textContent='✓ Vse je shranjeno v oblaku';
    if($('accountBtn')) $('accountBtn').textContent='☁️ Shranjeno';
    setCloudMessage('');
  }
  function syncCloud(){
    if(syncPromise) return syncPromise;
    syncPromise=doSync().catch(err=>{
      console.error('Vročinko sync:',err);
      if($('syncStatus')) $('syncStatus').textContent='⚠️ Sinhronizacija trenutno ni uspela';
      if($('accountBtn')) $('accountBtn').textContent='☁️ Račun';
      setCloudMessage('⚠️ Podatki so varno ostali na telefonu. Oblak bomo poskusili znova ob naslednji povezavi.','warn');
      throw err;
    }).finally(()=>{syncPromise=null;});
    return syncPromise;
  }

  async function handleSignedIn(nextSession){
    session=nextSession;
    cloudChildId=null;cloudIllnessId=null;cloudChildren=[];
    const currentUser=session.user.id;
    const lastUser=localStorage.getItem(LAST_USER_KEY);
    if(lastUser&&lastUser!==currentUser){
      state=emptyState();
      localStorage.removeItem(ACTIVE_CHILD_KEY);
      save();
    }
    localStorage.setItem(LAST_USER_KEY,currentUser);
    renderAccount();showApp();
    try{
      await refreshCloudChildren();
      if(!cloudChildren.length){
        if(state.childName.trim()) await syncCloud();
      }else{
        const stored=localStorage.getItem(ACTIVE_CHILD_KEY);
        const matching=state.childName.trim()?cloudChildren.find(c=>c.name.trim().toLowerCase()===state.childName.trim().toLowerCase()):null;
        const chosen=matching||cloudChildren.find(c=>c.id===stored)||cloudChildren[0];
        cloudChildId=chosen.id;
        localStorage.setItem(ACTIVE_CHILD_KEY,chosen.id);
        if(matching) await syncCloud();
        else await loadChildFromCloud(chosen.id);
      }
      renderChildren();
      closeSheet('accountSheet');
    }catch(e){
      console.error('Prijava/sinhronizacija:',e);
    }
  }
  function handleSignedOut(){
    session=null;cloudChildId=null;cloudIllnessId=null;cloudChildren=[];
    renderAccount();showApp();
  }

  async function initAuth(){
    if(!db){
      setCloudMessage('⚠️ Povezava z računom trenutno ni na voljo.','warn');
      return;
    }
    const current=await db.auth.getSession();
    if(current.data?.session) await handleSignedIn(current.data.session);
    else handleSignedOut();

    db.auth.onAuthStateChange((event,nextSession)=>{
      if(event==='SIGNED_OUT') handleSignedOut();
      else if(event==='SIGNED_IN'&&nextSession) handleSignedIn(nextSession);
      else if(nextSession){session=nextSession;renderAccount();}
    });
  }

  async function sendLogin(){
    if(!db){showAuthMessage('Google prijava trenutno ni na voljo.','bad');return;}
    $('sendLoginBtn').disabled=true;
    showAuthMessage('Odpiram Google prijavo …');
    try{
      const redirectTo=`${location.origin}${location.pathname}`;
      const result=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
      if(result.error) throw result.error;
    }catch(e){
      console.error('Google login:',e);
      showAuthMessage('Google prijava trenutno ni uspela. Poskusite znova.','bad');
      $('sendLoginBtn').disabled=false;
    }
  }
  async function verifyCode(){}
  function showAuthMessage(text,kind=''){
    const el=$('authMessage');
    el.textContent=text;el.className='authMessage';
    if(kind) el.classList.add(kind);
  }


  function ensureChildUi(){
    if(!document.getElementById('childUiStyle')){
      const style=document.createElement('style');
      style.id='childUiStyle';
      style.textContent='.addChildBtn{border:1px solid #dbeafe;background:#fff;color:#2563eb;box-shadow:var(--shadow);border-radius:999px;padding:10px 12px;font-weight:800;white-space:nowrap}.childList{display:grid;gap:9px;margin:12px 0}.childChoice{width:100%;min-height:56px;border:1px solid var(--line);border-radius:17px;background:#fff;color:var(--text);padding:12px 15px;font-weight:800;display:flex;align-items:center;justify-content:space-between;text-align:left}.childChoice.active{border-color:#93c5fd;background:var(--blue-soft);color:#1d4ed8}@media(max-width:430px){.addChildBtn{padding:9px 10px;font-size:13px}.topActions{flex-wrap:wrap;justify-content:flex-end}}';
      document.head.appendChild(style);
    }
    const top=document.querySelector('.topActions');
    if(top&&!$('addChildBtn')){
      const btn=document.createElement('button');
      btn.id='addChildBtn';
      btn.className='addChildBtn';
      btn.type='button';
      btn.textContent='＋ Dodaj otroka';
      top.insertBefore(btn,$('editChild'));
    }
    if(!$('childSheet')){
      const back=document.createElement('div');
      back.id='childSheet';
      back.className='sheetBack hide';
      back.setAttribute('role','dialog');
      back.setAttribute('aria-modal','true');
      back.innerHTML='<div class="sheet"><div class="grab"></div><div class="sheetHead"><h2>👧👦 Otroci</h2><button class="close" data-close="childSheet" type="button">×</button></div><div class="sub">Izberite otroka. Vsak otrok ima svoj ločen potek bolezni in svoje zapise.</div><div id="childList" class="childList"></div><button id="childAddBtn" class="primary" type="button">＋ Dodaj otroka</button><button id="renameChildBtn" class="secondary wide" type="button">Preimenuj izbranega otroka</button><div class="freeBadge">TESTNA RAZLIČICA · VSE FUNKCIJE BREZPLAČNE</div></div>';
      document.body.appendChild(back);
    }
  }

  ensureChildUi();

  $('startBtn').addEventListener('click',()=>{
    const n=$('childNameInput').value.trim();
    if(!n){$('setupError').textContent='Vpišite ime otroka.';return;}
    state.childName=n;
    if(!state.startedAt) state.startedAt=new Date().toISOString();
    save();$('setupError').textContent='';showApp();
    if(session) syncCloud().catch(()=>{});
  });

  $('editChild').addEventListener('click',async()=>{
    if(session){
      try{await refreshCloudChildren();}catch(e){}
      renderChildren();openSheet('childSheet');
    }else{
      renameCurrentChild();
    }
  });
  $('addChildBtn').addEventListener('click',addChild);
  $('childAddBtn').addEventListener('click',addChild);
  $('renameChildBtn').addEventListener('click',renameCurrentChild);

  $('openTemp').addEventListener('click',()=>{
    $('tempInput').value='';$('tempMedName').value='';$('tempError').textContent='';
    tempSelectedSymptoms.clear();
    document.querySelectorAll('#tempSymptomGrid .symptom').forEach(b=>b.classList.remove('selected'));
    const now=new Date();
    $('tempDate').value=localDateValue(now);$('tempTime').value=localTimeValue(now);$('tempDate').max=localDateValue(now);
    openSheet('tempSheet');setTimeout(()=>$('tempInput').focus(),120);
  });
  document.querySelectorAll('#tempSymptomGrid .symptom').forEach(btn=>btn.addEventListener('click',()=>{
    const s=btn.dataset.tempSymptom;
    tempSelectedSymptoms.has(s)?tempSelectedSymptoms.delete(s):tempSelectedSymptoms.add(s);
    btn.classList.toggle('selected',tempSelectedSymptoms.has(s));
  }));
  $('saveTemp').addEventListener('click',()=>{
    const value=Number($('tempInput').value.trim().replace(',','.'));
    if(!Number.isFinite(value)||value<34||value>43){$('tempError').textContent='Vpišite temperaturo med 34,0 in 43,0 °C.';return;}
    const date=$('tempDate').value,time=$('tempTime').value;
    if(!date||!time){$('tempError').textContent='Izberite datum in čas meritve.';return;}
    const chosen=new Date(`${date}T${time}:00`);
    if(Number.isNaN(chosen.getTime())){$('tempError').textContent='Datum ali čas ni veljaven.';return;}
    if(chosen.getTime()>Date.now()+300000){$('tempError').textContent='Datum in čas ne moreta biti v prihodnosti.';return;}
    if(chosen<new Date(state.startedAt)) state.startedAt=chosen.toISOString();
    const at=chosen.toISOString();
    pushEntry('temp',`${value.toFixed(1).replace('.',',')} °C`,'Izmerjena temperatura',at);
    const med=$('tempMedName').value.trim();
    if(med) pushEntry('med',med,'',at);
    const symptoms=[...tempSelectedSymptoms];
    if(symptoms.length) pushEntry('sym',symptoms.join(', '),'',at);
    persistAndSync();closeSheet('tempSheet');
  });

  $('openMed').addEventListener('click',()=>{$('medName').value='';$('medError').textContent='';openSheet('medSheet');setTimeout(()=>$('medName').focus(),120);});
  $('saveMed').addEventListener('click',()=>{const n=$('medName').value.trim();if(!n){$('medError').textContent='Vpišite ime zdravila.';return;}addEntry('med',n,'');closeSheet('medSheet');});

  $('openSym').addEventListener('click',()=>{selectedSymptoms.clear();$('symNote').value='';$('symError').textContent='';document.querySelectorAll('#symptomGrid .symptom').forEach(b=>b.classList.remove('selected'));openSheet('symSheet');});
  document.querySelectorAll('#symptomGrid .symptom').forEach(btn=>btn.addEventListener('click',()=>{const s=btn.dataset.symptom;selectedSymptoms.has(s)?selectedSymptoms.delete(s):selectedSymptoms.add(s);btn.classList.toggle('selected',selectedSymptoms.has(s));}));
  $('saveSym').addEventListener('click',()=>{const note=$('symNote').value.trim();if(!selectedSymptoms.size&&!note){$('symError').textContent='Izberite vsaj en simptom ali napišite kratko opombo.';return;}const arr=[...selectedSymptoms];addEntry('sym',arr.length?arr.join(', '):'Opomba',note||'Trenutno opaženi simptomi');closeSheet('symSheet');});

  $('doctorBtn').addEventListener('click',()=>{$('reportText').value=buildReport();$('reportMsg').textContent='';openSheet('reportSheet');});
  $('copyReport').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('reportText').value);$('reportMsg').textContent='Poročilo je kopirano.';}catch(e){$('reportText').focus();$('reportText').select();$('reportMsg').textContent='Besedilo je označeno. Izberite Kopiraj.';}});
  $('shareReport').addEventListener('click',async()=>{const text=$('reportText').value;if(navigator.share){try{await navigator.share({title:`Vročinko – ${state.childName}`,text});return;}catch(e){if(e&&e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(text);$('reportMsg').textContent='Poročilo je kopirano.';}catch(e){$('reportText').focus();$('reportText').select();}});

  $('newIllnessBtn').addEventListener('click',async()=>{
    if(!confirm('Začnem novo bolezen? Trenutni potek se bo zaključil, v računu pa bo ostal shranjen.')) return;
    if(session&&cloudIllnessId&&navigator.onLine){
      try{await db.from('vrocinko_illnesses').update({ended_at:new Date().toISOString()}).eq('id',cloudIllnessId);}catch(e){}
    }
    state.entries=[];state.deletedIds=[];state.startedAt=new Date().toISOString();
    cloudIllnessId=null;save();showApp();
    if(session) syncCloud().catch(()=>{});
  });

  $('accountBtn').addEventListener('click',()=>{renderAccount();openSheet('accountSheet');});
  $('setupAccountBtn').addEventListener('click',()=>{renderAccount();openSheet('accountSheet');});
  $('sendLoginBtn').addEventListener('click',sendLogin);
  $('verifyCodeBtn').addEventListener('click',verifyCode);
  $('syncNowBtn').addEventListener('click',()=>syncCloud().catch(()=>{}));
  $('signOutBtn').addEventListener('click',async()=>{if(db)await db.auth.signOut();closeSheet('accountSheet');});

  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeSheet(btn.dataset.close)));
  document.querySelectorAll('.sheetBack').forEach(back=>back.addEventListener('click',e=>{if(e.target===back)closeSheet(back.id);}));
  window.addEventListener('online',()=>{renderAccount();if(session)syncCloud().catch(()=>{});});
  window.addEventListener('offline',renderAccount);

  normalizeIds();
  showApp();
  initAuth().catch(()=>{});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();