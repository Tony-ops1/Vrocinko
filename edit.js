(() => {
  const KEY='vrocinko-v3';
  const SYMPTOMS=['Kašelj','Zamašen nos','Izcedek iz nosu','Boleče grlo','Glavobol','Utrujenost','Mrzlica','Bolečine v mišicah','Bruhanje','Driska'];
  let editingId=null;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const dateValue=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const timeValue=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;

  function loadState(){
    try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){return null;}
  }

  function saveState(state){localStorage.setItem(KEY,JSON.stringify(state));}

  function ensureUi(){
    if(!document.getElementById('editEntryStyle')){
      const style=document.createElement('style');
      style.id='editEntryStyle';
      style.textContent=`
        .eventActions{display:flex;align-items:flex-start;gap:2px}
        .editEntry,.delete{width:34px;height:34px;border:0;border-radius:10px;background:transparent;display:grid;place-items:center;padding:0;line-height:1}
        .editEntry{color:#2563eb;font-size:17px}.editEntry:active{background:#eff6ff}.delete:active{background:#f3f4f6}
        .editSymptoms{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 4px}
        .editSymptom{min-height:50px;border:1px solid var(--line);border-radius:15px;background:#fff;color:var(--text);font-weight:700;padding:9px}
        .editSymptom.selected{border-color:#86efac;background:var(--green-soft);color:#166534}
        .editHint{font-size:13px;color:var(--muted);line-height:1.4;margin:-6px 0 8px}
        @media(max-width:360px){.editSymptoms{grid-template-columns:1fr}}
      `;
      document.head.appendChild(style);
    }
    if($('editEntrySheet')) return;
    const back=document.createElement('div');
    back.id='editEntrySheet';
    back.className='sheetBack hide';
    back.setAttribute('role','dialog');
    back.setAttribute('aria-modal','true');
    back.innerHTML=`<div class="sheet">
      <div class="grab"></div>
      <div class="sheetHead"><h2 id="editEntryTitle">Uredi zapis</h2><button id="editEntryClose" class="close" type="button">×</button></div>
      <div id="editEntryBody"></div>
      <div id="editEntryError" class="error"></div>
      <button id="editEntrySave" class="save blue" type="button">Shrani spremembe</button>
    </div>`;
    document.body.appendChild(back);
    $('editEntryClose').addEventListener('click',closeEdit);
    back.addEventListener('click',e=>{if(e.target===back) closeEdit();});
    $('editEntrySave').addEventListener('click',saveEdit);
  }

  function enhanceTimeline(){
    ensureUi();
    document.querySelectorAll('#timeline .event').forEach(event=>{
      if(event.querySelector('.editEntry')) return;
      const del=event.querySelector('[data-delete]');
      if(!del) return;
      const wrap=document.createElement('div');
      wrap.className='eventActions';
      del.parentNode.insertBefore(wrap,del);
      wrap.appendChild(del);
      const edit=document.createElement('button');
      edit.className='editEntry';
      edit.type='button';
      edit.textContent='✎';
      edit.setAttribute('aria-label','Uredi zapis');
      edit.dataset.edit=del.dataset.delete;
      wrap.insertBefore(edit,del);
      edit.addEventListener('click',()=>openEdit(edit.dataset.edit));
    });
  }

  function openEdit(id){
    const state=loadState();
    const entry=state?.entries?.find(e=>e.id===id);
    if(!entry){alert('Zapisa ni bilo mogoče odpreti.');return;}
    editingId=id;
    const d=new Date(entry.at);
    const date=Number.isNaN(d.getTime())?dateValue(new Date()):dateValue(d);
    const time=Number.isNaN(d.getTime())?timeValue(new Date()):timeValue(d);
    let html='';

    if(entry.type==='temp'){
      $('editEntryTitle').textContent='Uredi temperaturo';
      const value=String(entry.title||'').replace(/[^0-9,.]/g,'').replace('.',',');
      html=`<label class="label" for="editTempValue">Temperatura</label>
        <div class="bigTemp"><input id="editTempValue" inputmode="decimal" value="${esc(value)}"><span class="degree">°C</span></div>`;
    }else if(entry.type==='med'){
      $('editEntryTitle').textContent='Uredi zdravilo';
      html=`<label class="label" for="editMedValue">Ime zdravila</label><input id="editMedValue" class="input" autocomplete="off" value="${esc(entry.title||'')}">`;
    }else if(entry.type==='sym'){
      $('editEntryTitle').textContent='Uredi simptome';
      const selected=new Set(String(entry.title||'').split(',').map(s=>s.trim()).filter(s=>SYMPTOMS.includes(s)));
      const note=entry.detail==='Trenutno opaženi simptomi'?'':(entry.detail||'');
      html=`<div class="label">Simptomi</div><div class="editSymptoms">${SYMPTOMS.map(s=>`<button class="editSymptom ${selected.has(s)?'selected':''}" type="button" data-edit-symptom="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <label class="label" for="editSymNote">Drugo ali opomba</label><input id="editSymNote" class="input" autocomplete="off" value="${esc(note)}">`;
    }else{
      alert('Tega zapisa ni mogoče urejati.');return;
    }

    html+=`<div class="dateRow"><div><label class="label" for="editDate">Datum</label><input id="editDate" class="input" type="date" value="${date}"></div><div><label class="label" for="editTime">Čas</label><input id="editTime" class="input" type="time" value="${time}"></div></div>`;
    $('editEntryBody').innerHTML=html;
    $('editEntryError').textContent='';
    $('editDate').max=dateValue(new Date());
    document.querySelectorAll('[data-edit-symptom]').forEach(btn=>btn.addEventListener('click',()=>btn.classList.toggle('selected')));
    $('editEntrySheet').classList.remove('hide');
    document.body.style.overflow='hidden';
  }

  function closeEdit(){
    editingId=null;
    if($('editEntrySheet')) $('editEntrySheet').classList.add('hide');
    document.body.style.overflow='';
  }

  function saveEdit(){
    const state=loadState();
    const entry=state?.entries?.find(e=>e.id===editingId);
    if(!entry){$('editEntryError').textContent='Zapisa ni bilo mogoče shraniti.';return;}
    const date=$('editDate')?.value,time=$('editTime')?.value;
    if(!date||!time){$('editEntryError').textContent='Izberite datum in čas.';return;}
    const chosen=new Date(`${date}T${time}:00`);
    if(Number.isNaN(chosen.getTime())){$('editEntryError').textContent='Datum ali čas ni veljaven.';return;}
    if(chosen.getTime()>Date.now()+300000){$('editEntryError').textContent='Datum in čas ne moreta biti v prihodnosti.';return;}

    if(entry.type==='temp'){
      const value=Number(($('editTempValue')?.value||'').trim().replace(',','.'));
      if(!Number.isFinite(value)||value<34||value>43){$('editEntryError').textContent='Vpišite temperaturo med 34,0 in 43,0 °C.';return;}
      entry.title=`${value.toFixed(1).replace('.',',')} °C`;
      entry.detail='Izmerjena temperatura';
    }else if(entry.type==='med'){
      const name=($('editMedValue')?.value||'').trim();
      if(!name){$('editEntryError').textContent='Vpišite ime zdravila.';return;}
      entry.title=name;
    }else if(entry.type==='sym'){
      const selected=[...document.querySelectorAll('[data-edit-symptom].selected')].map(b=>b.dataset.editSymptom);
      const note=($('editSymNote')?.value||'').trim();
      if(!selected.length&&!note){$('editEntryError').textContent='Izberite vsaj en simptom ali napišite opombo.';return;}
      entry.title=selected.length?selected.join(', '):'Opomba';
      entry.detail=note;
    }

    entry.at=chosen.toISOString();
    const currentStart=new Date(state.startedAt).getTime();
    if(!Number.isFinite(currentStart)||chosen.getTime()<currentStart) state.startedAt=entry.at;
    saveState(state);
    closeEdit();
    location.reload();
  }

  ensureUi();
  enhanceTimeline();
  const timeline=$('timeline');
  if(timeline){
    new MutationObserver(()=>enhanceTimeline()).observe(timeline,{childList:true,subtree:true});
  }
})();