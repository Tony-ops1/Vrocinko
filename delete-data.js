(() => {
  const SUPABASE_URL='https://ndmepipotkkubuuscfnm.supabase.co';
  const SUPABASE_KEY='sb_publishable_CQJYpxpxsIxGtFCdrqdAtA_dlLTYh2a';
  const AUTH_KEY='sb-ndmepipotkkubuuscfnm-auth-token';
  const $=id=>document.getElementById(id);
  let deleting=false;

  function accessToken(){
    try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')?.access_token||'';}catch(e){return '';}
  }

  function userIdFromToken(token){
    try{
      const part=token.split('.')[1];
      if(!part) return '';
      const normalized=part.replace(/-/g,'+').replace(/_/g,'/');
      const padded=normalized+'='.repeat((4-normalized.length%4)%4);
      return JSON.parse(atob(padded))?.sub||'';
    }catch(e){return '';}
  }

  async function api(path, options={}){
    const token=accessToken();
    if(!token) throw new Error('NOT_SIGNED_IN');
    const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
      method:options.method||'GET',
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:`Bearer ${token}`,
        ...(options.headers||{})
      },
      cache:'no-store'
    });
    if(!response.ok) throw new Error(`HTTP_${response.status}`);
    if(response.status===204) return null;
    const text=await response.text();
    return text?JSON.parse(text):null;
  }

  function ensureUi(){
    const signedIn=$('signedInBox');
    if(signedIn&&!$('deleteAllDataBtn')){
      const btn=document.createElement('button');
      btn.id='deleteAllDataBtn';
      btn.type='button';
      btn.className='secondary wide dangerText';
      btn.style.marginTop='10px';
      btn.textContent='Izbriši vse moje podatke';
      signedIn.appendChild(btn);

      const note=document.createElement('div');
      note.id='deleteAllDataNote';
      note.className='mutedSmall';
      note.style.marginTop='8px';
      note.textContent='Trajno izbriše vse otroke, bolezni, temperature, zdravila in simptome iz Vročinko.';
      signedIn.appendChild(note);

      btn.addEventListener('click',deleteAllData);
    }

    const accountSheet=$('accountSheet')?.querySelector('.sheet');
    if(accountSheet&&!$('privacyAccountLink')){
      const wrap=document.createElement('div');
      wrap.style.textAlign='center';
      wrap.style.marginTop='14px';
      const link=document.createElement('a');
      link.id='privacyAccountLink';
      link.href='privacy.html';
      link.textContent='Politika zasebnosti';
      link.style.color='#667085';
      link.style.textDecoration='underline';
      wrap.appendChild(link);
      accountSheet.appendChild(wrap);
    }

    const mainNote=document.querySelector('main .note');
    if(mainNote&&!$('privacyMainLink')){
      mainNote.appendChild(document.createElement('br'));
      const link=document.createElement('a');
      link.id='privacyMainLink';
      link.href='privacy.html';
      link.textContent='Politika zasebnosti';
      link.style.color='inherit';
      link.style.textDecoration='underline';
      mainNote.appendChild(link);
    }
  }

  function clearLocalVrocinkoData(){
    [
      'vrocinko-v3',
      'vrocinko-v2',
      'vrocinko-v1',
      'vrocinko-active-child-v1',
      'vrocinko-last-user-v2'
    ].forEach(key=>localStorage.removeItem(key));
  }

  async function deleteAllData(){
    if(deleting) return;
    const first=confirm('Ali res želite trajno izbrisati VSE podatke Vročinko? Izbrisani bodo vsi otroci, bolezni in vsi vnosi. Tega ni mogoče razveljaviti.');
    if(!first) return;

    const typed=prompt('Za dokončno potrditev napišite IZBRIŠI');
    if(String(typed||'').trim().toUpperCase()!=='IZBRIŠI') return;

    const btn=$('deleteAllDataBtn');
    deleting=true;
    if(btn){btn.disabled=true;btn.textContent='Brišem podatke …';}

    try{
      if(!navigator.onLine) throw new Error('OFFLINE');
      const token=accessToken();
      const userId=userIdFromToken(token);
      if(!token||!userId) throw new Error('NOT_SIGNED_IN');

      await api(`vrocinko_children?user_id=eq.${encodeURIComponent(userId)}`,{
        method:'DELETE',
        headers:{Prefer:'return=minimal'}
      });

      const remaining=await api(`vrocinko_children?select=id&user_id=eq.${encodeURIComponent(userId)}`);
      if(Array.isArray(remaining)&&remaining.length) throw new Error('DELETE_INCOMPLETE');

      clearLocalVrocinkoData();
      alert('Vsi vaši podatki Vročinko so bili izbrisani.');
      location.reload();
    }catch(error){
      console.error('Izbris podatkov:',error);
      const msg=String(error?.message||'');
      if(msg==='OFFLINE') alert('Za izbris podatkov potrebujete internetno povezavo.');
      else if(msg==='NOT_SIGNED_IN') alert('Za izbris podatkov morate biti prijavljeni v Moj račun.');
      else alert('Podatkov trenutno ni bilo mogoče izbrisati. Poskusite znova.');
      if(btn){btn.disabled=false;btn.textContent='Izbriši vse moje podatke';}
    }finally{
      deleting=false;
    }
  }

  ensureUi();
})();