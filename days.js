(() => {
  const KEY='vrocinko-v3';
  const $=id=>document.getElementById(id);
  let grouping=false;
  let queued=false;

  function loadEntries(){
    try{
      const state=JSON.parse(localStorage.getItem(KEY)||'null');
      return Array.isArray(state?.entries)?state.entries:[];
    }catch(e){return [];}
  }

  function dayKey(iso){
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function dayLabel(iso){
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return '';
    const today=new Date();
    const a=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    const b=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    const diff=Math.round((a-b)/86400000);
    const date=new Intl.DateTimeFormat('sl-SI',{day:'numeric',month:'numeric',year:'numeric'}).format(d);
    if(diff===0) return `Danes · ${date}`;
    if(diff===1) return `Včeraj · ${date}`;
    return date;
  }

  function ensureStyle(){
    if(document.getElementById('dayGroupStyle')) return;
    const style=document.createElement('style');
    style.id='dayGroupStyle';
    style.textContent=`
      .timeline{gap:16px}
      .dayGroup{display:grid;gap:9px}
      .dayGroup+.dayGroup{margin-top:3px}
      .dayHeader{display:flex;align-items:center;gap:10px;margin:2px 2px 1px;color:#475467;font-size:14px;font-weight:850;letter-spacing:-.01em}
      .dayHeader:after{content:"";height:1px;background:rgba(148,163,184,.45);flex:1}
      .dayHeaderText{background:rgba(255,255,255,.74);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);padding:6px 10px;border-radius:999px;border:1px solid rgba(226,232,240,.9)}
    `;
    document.head.appendChild(style);
  }

  function groupTimeline(){
    const timeline=$('timeline');
    if(!timeline||grouping) return;
    const events=[...timeline.querySelectorAll('.event')];
    if(!events.length) return;

    const directEvents=[...timeline.children].filter(el=>el.classList?.contains('event'));
    const groups=[...timeline.children].filter(el=>el.classList?.contains('dayGroup'));
    if(!directEvents.length&&groups.length&&groups.reduce((n,g)=>n+g.querySelectorAll('.event').length,0)===events.length) return;

    const entries=loadEntries();
    const byId=new Map(entries.map(e=>[String(e.id),e]));
    const fallback=entries.slice().sort((a,b)=>new Date(b.at)-new Date(a.at));
    const grouped=[];
    const groupMap=new Map();

    events.forEach((event,index)=>{
      const id=event.querySelector('[data-delete]')?.dataset.delete||event.querySelector('[data-edit]')?.dataset.edit||'';
      const entry=byId.get(String(id))||fallback[index];
      if(!entry?.at) return;
      const key=dayKey(entry.at);
      if(!groupMap.has(key)){
        const item={key,label:dayLabel(entry.at),events:[]};
        groupMap.set(key,item);grouped.push(item);
      }
      groupMap.get(key).events.push(event);
    });

    if(!grouped.length) return;
    grouping=true;
    try{
      timeline.innerHTML='';
      grouped.forEach(item=>{
        const group=document.createElement('section');
        group.className='dayGroup';
        group.dataset.day=item.key;
        const header=document.createElement('div');
        header.className='dayHeader';
        header.innerHTML=`<span class="dayHeaderText">${item.label}</span>`;
        group.appendChild(header);
        item.events.forEach(event=>group.appendChild(event));
        timeline.appendChild(group);
      });
    }finally{grouping=false;}
  }

  function queueGroup(){
    if(queued) return;
    queued=true;
    setTimeout(()=>{queued=false;groupTimeline();},0);
  }

  ensureStyle();
  queueGroup();
  const timeline=$('timeline');
  if(timeline) new MutationObserver(queueGroup).observe(timeline,{childList:true,subtree:true});
})();
