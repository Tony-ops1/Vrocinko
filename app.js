(() => {
  const KEY='vrocinko-v2';
  const $=id=>document.getElementById(id);
  let state=load();
  let selectedSymptoms=new Set();

  function load(){
    try{
      const raw=localStorage.getItem(KEY)||localStorage.getItem('vrocinko-v1');
      if(raw){
        const p=JSON.parse(raw);
        return {childName:String(p.childName||''),startedAt:p.startedAt||new Date().toISOString(),entries:Array.isArray(p.entries)?p.entries:[]};
      }
    }catch(e){}
    return {childName:'',startedAt:new Date().toISOString(),entries:[]};
  }
  function save(){localStorage.setItem(KEY,JSON.stringify(state));}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
  function pad(n){return String(n).padStart(2,'0');}
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
  function showApp(){
    const ok=state.childName.trim().length>0;
    $('setup').classList.toggle('hide',ok);
    $('main').classList.toggle('hide',!ok);
    if(ok){$('editChild').textContent=state.childName;$('illnessDay').textContent=`Dan ${illnessDay()}`;renderTimeline();}
  }
  function openSheet(id){$(id).classList.remove('hide');document.body.style.overflow='hidden';}
  function closeSheet(id){$(id).classList.add('hide');document.body.style.overflow='';}
  function pushEntry(type,title,detail='',at=null){
    state.entries.push({id:(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`),type,title,detail,at:at||new Date().toISOString()});
  }
  function addEntry(type,title,detail='',at=null){
    pushEntry(type,title,detail,at);
    save();renderTimeline();showApp();
  }
  function renderTimeline(){
    const box=$('timeline');
    if(!state.entries.length){box.innerHTML='<div class="empty">Še ni nobenega zapisa.<br><strong>Začni s temperaturo, zdravilom ali simptomi.</strong></div>';return;}
    const icons={temp:'🌡️',med:'💊',sym:'🤧'};
    const sorted=[...state.entries].sort((a,b)=>new Date(b.at)-new Date(a.at));
    box.innerHTML=sorted.map(e=>`<div class="event"><div class="eventIcon">${icons[e.type]||'•'}</div><div><div class="eventTitle">${esc(e.title)}</div><div class="eventMeta">${e.detail?esc(e.detail)+' · ':''}${esc(formatDateTime(e.at))}</div></div><button class="delete" type="button" data-delete="${esc(e.id)}" aria-label="Izbriši zapis">×</button></div>`).join('');
    box.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Izbrišem ta zapis?')){state.entries=state.entries.filter(e=>e.id!==btn.dataset.delete);save();renderTimeline();}}));
  }
  function buildReport(){
    const lines=['VROČINKO – POTEK BOLEZNI',`Otrok: ${state.childName}`,`Začetek spremljanja: ${formatDate(state.startedAt)}`,''];
    if(!state.entries.length) lines.push('Ni zabeleženih podatkov.');
    else{
      let last='';
      [...state.entries].sort((a,b)=>new Date(a.at)-new Date(b.at)).forEach(e=>{
        const d=formatDate(e.at);if(d!==last){if(last)lines.push('');lines.push(d);last=d;}
        lines.push(`${formatTime(e.at)}  ${e.title}${e.detail?' – '+e.detail:''}`);
      });
    }
    lines.push('','Zapis je pripravil starš v aplikaciji Vročinko.');
    return lines.join('\n');
  }

  $('startBtn').addEventListener('click',()=>{const n=$('childNameInput').value.trim();if(!n){$('setupError').textContent='Vpišite ime otroka.';return;}state.childName=n;state.startedAt=new Date().toISOString();save();$('setupError').textContent='';showApp();});
  $('editChild').addEventListener('click',()=>{const n=prompt('Ime otroka:',state.childName);if(n!==null&&n.trim()){state.childName=n.trim().slice(0,30);save();showApp();}});

  $('openTemp').addEventListener('click',()=>{
    $('tempInput').value='';
    $('tempMedName').value='';
    $('tempError').textContent='';
    const now=new Date();
    $('tempDate').value=localDateValue(now);
    $('tempTime').value=localTimeValue(now);
    $('tempDate').max=localDateValue(now);
    openSheet('tempSheet');
    setTimeout(()=>$('tempInput').focus(),120);
  });
  $('saveTemp').addEventListener('click',()=>{
    const value=Number($('tempInput').value.trim().replace(',','.'));
    if(!Number.isFinite(value)||value<34||value>43){$('tempError').textContent='Vpišite temperaturo med 34,0 in 43,0 °C.';return;}
    const date=$('tempDate').value,time=$('tempTime').value;
    if(!date||!time){$('tempError').textContent='Izberite datum in čas meritve.';return;}
    const chosen=new Date(`${date}T${time}:00`);
    if(Number.isNaN(chosen.getTime())){$('tempError').textContent='Datum ali čas ni veljaven.';return;}
    if(chosen.getTime()>Date.now()+300000){$('tempError').textContent='Datum in čas ne moreta biti v prihodnosti.';return;}
    if(chosen<new Date(state.startedAt)) state.startedAt=chosen.toISOString();

    pushEntry('temp',`${value.toFixed(1).replace('.',',')} °C`,'Izmerjena temperatura',chosen.toISOString());
    const med=$('tempMedName').value.trim();
    if(med) pushEntry('med',med,'',chosen.toISOString());

    save();
    renderTimeline();
    showApp();
    closeSheet('tempSheet');
  });

  $('openMed').addEventListener('click',()=>{$('medName').value='';$('medError').textContent='';openSheet('medSheet');setTimeout(()=>$('medName').focus(),120);});
  $('saveMed').addEventListener('click',()=>{const n=$('medName').value.trim();if(!n){$('medError').textContent='Vpišite ime zdravila.';return;}addEntry('med',n,'');closeSheet('medSheet');});

  $('openSym').addEventListener('click',()=>{selectedSymptoms.clear();$('symNote').value='';$('symError').textContent='';document.querySelectorAll('.symptom').forEach(b=>b.classList.remove('selected'));openSheet('symSheet');});
  document.querySelectorAll('.symptom').forEach(btn=>btn.addEventListener('click',()=>{const s=btn.dataset.symptom;selectedSymptoms.has(s)?selectedSymptoms.delete(s):selectedSymptoms.add(s);btn.classList.toggle('selected',selectedSymptoms.has(s));}));
  $('saveSym').addEventListener('click',()=>{const note=$('symNote').value.trim();if(!selectedSymptoms.size&&!note){$('symError').textContent='Izberite vsaj en simptom ali napišite kratko opombo.';return;}const arr=[...selectedSymptoms];addEntry('sym',arr.length?arr.join(', '):'Opomba',note||'Trenutno opaženi simptomi');closeSheet('symSheet');});

  $('doctorBtn').addEventListener('click',()=>{$('reportText').value=buildReport();$('reportMsg').textContent='';openSheet('reportSheet');});
  $('copyReport').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('reportText').value);$('reportMsg').textContent='Poročilo je kopirano.';}catch(e){$('reportText').focus();$('reportText').select();$('reportMsg').textContent='Besedilo je označeno. Izberite Kopiraj.';}});
  $('shareReport').addEventListener('click',async()=>{const text=$('reportText').value;if(navigator.share){try{await navigator.share({title:`Vročinko – ${state.childName}`,text});return;}catch(e){if(e&&e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(text);$('reportMsg').textContent='Poročilo je kopirano.';}catch(e){$('reportText').focus();$('reportText').select();}});
  $('newIllnessBtn').addEventListener('click',()=>{if(!confirm('Začnem novo bolezen? Trenutni zapisi bodo izbrisani.'))return;state.entries=[];state.startedAt=new Date().toISOString();save();showApp();});
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeSheet(btn.dataset.close)));
  document.querySelectorAll('.sheetBack').forEach(back=>back.addEventListener('click',e=>{if(e.target===back)closeSheet(back.id);}));

  showApp();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
