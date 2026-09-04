(() => {
  const SESSION_KEY='vrocinko-visit-counted-v1';
  const SUPABASE_URL='https://ndmepipotkkubuuscfnm.supabase.co';
  const SUPABASE_KEY='sb_publishable_CQJYpxpxsIxGtFCdrqdAtA_dlLTYh2a';

  try{
    if(sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY,'pending');

    const xhr=new XMLHttpRequest();
    xhr.open('POST',`${SUPABASE_URL}/rest/v1/rpc/vrocinko_count_visit`,true);
    xhr.setRequestHeader('apikey',SUPABASE_KEY);
    xhr.setRequestHeader('Authorization',`Bearer ${SUPABASE_KEY}`);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.setRequestHeader('Prefer','return=minimal');

    xhr.onload=()=>{
      if(xhr.status>=200&&xhr.status<300) sessionStorage.setItem(SESSION_KEY,'1');
      else sessionStorage.removeItem(SESSION_KEY);
    };
    xhr.onerror=()=>sessionStorage.removeItem(SESSION_KEY);
    xhr.send('{}');
  }catch(e){}
})();
