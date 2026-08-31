(() => {
  const KEY='vrocinko-v3';
  const LAST_USER_KEY='vrocinko-last-user-v1';
  const SUPABASE_URL='https://ceudducaxmwcwscguzle.supabase.co';
  const SUPABASE_KEY='sb_publishable_1_22EsQWMl5_OI2XmNhjRg_xdloiS8g';
  const $=id=>document.getElementById(id);
  const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  let state=load();
  let selectedSymptoms=new Set();
  let tempSelectedSymptoms=new Set();
  let session=null;
  let cloudChildId=null;
  let cloudIllnessId=null;
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
  function uuid(){return crypto.randomUUID();}
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

  function showApp(){
    const ok=state.childName.trim().length>0;
    $('setup').classList.toggle('hide',ok);
    $('main').classList.toggle('hide',!ok);
    if(ok){
      $('editChild').textContent=state.childName;
      $('illnessDay').textContent=`Dan ${illnessDay()}`;
      renderTimeline();
    }
    renderAccount();
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

  async function ensureCloudContext(){
    if(!session||!db) return false;
    const userId=session.user.id;

    let {data:child,error:childError}=await db.from('vrocinko_children')
      .select('id,name,created_at')
      .order('created_at',{ascending:true})
      .limit(1)
      .maybeSingle();
    if(childError) throw childError;

    if(!child){
      if(!state.childName.trim()) return false;
      const created=await db.from('vrocinko_children')
        .insert({user_id:userId,name:state.childName.trim()})
        .select('id,name')
        .single();
      if(created.error) throw created.error;
      child=created.data;
    }else{
      if(!state.childName.trim()) state.childName=child.name;
      else if(state.entries.length===0) state.childName=child.name;
    }
    cloudChildId=child.id;

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
    cloudChildId=null;cloudIllnessId=null;
    const currentUser=session.user.id;
    const lastUser=localStorage.getItem(LAST_USER_KEY);
    if(lastUser&&lastUser!==currentUser){
      state=emptyState();
      save();
    }
    localStorage.setItem(LAST_USER_KEY,currentUser);
    renderAccount();showApp();
    try{
      await syncCloud();
      closeSheet('accountSheet');
    }catch(e){}
  }
  function handleSignedOut(){
    session=null;cloudChildId=null;cloudIllnessId=null;
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
    const email=$('authEmail').value.trim().toLowerCase();
    if(!email||!email.includes('@')){showAuthMessage('Vpišite veljaven e-poštni naslov.','bad');return;}
    $('sendLoginBtn').disabled=true;
    $('sendLoginBtn').textContent='Pošiljam …';
    showAuthMessage('');
    try{
      const redirectTo=`${location.origin}${location.pathname}`;
      const result=await db.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:redirectTo}});
      if(result.error) throw result.error;
      showAuthMessage('E-pošta je poslana. Odprite sporočilo in pritisnite prijavno povezavo. Če prejmete 6-mestno kodo, jo vpišite spodaj.','good');
    }catch(e){
      showAuthMessage('Prijavne e-pošte trenutno ni bilo mogoče poslati. Poskusite znova.','bad');
    }finally{
      $('sendLoginBtn').disabled=false;
      $('sendLoginBtn').textContent='Pošlji prijavno povezavo';
    }
  }
  async function verifyCode(){
    const email=$('authEmail').value.trim().toLowerCase();
    const token=$('authCode').value.trim().replace(/\s/g,'');
    if(!email||!token){showAuthMessage('Vpišite e-pošto in kodo iz sporočila.','bad');return;}
    $('verifyCodeBtn').disabled=true;
    try{
      const result=await db.auth.verifyOtp({email,token,type:'email'});
      if(result.error) throw result.error;
      showAuthMessage('Prijava je uspela.','good');
    }catch(e){
      showAuthMessage('Koda ni veljavna ali je potekla.','bad');
    }finally{$('verifyCodeBtn').disabled=false;}
  }
  function showAuthMessage(text,kind=''){
    const el=$('authMessage');
    el.textContent=text;el.className='authMessage';
    if(kind) el.classList.add(kind);
  }

  $('startBtn').addEventListener('click',()=>{
    const n=$('childNameInput').value.trim();
    if(!n){$('setupError').textContent='Vpišite ime otroka.';return;}
    state.childName=n;
    if(!state.startedAt) state.startedAt=new Date().toISOString();
    save();$('setupError').textContent='';showApp();
    if(session) syncCloud().catch(()=>{});
  });

  $('editChild').addEventListener('click',()=>{
    const n=prompt('Ime otroka:',state.childName);
    if(n!==null&&n.trim()){
      state.childName=n.trim().slice(0,30);
      save();showApp();
      if(session) syncCloud().catch(()=>{});
    }
  });

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
