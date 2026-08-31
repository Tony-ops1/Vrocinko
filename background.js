(() => {
  async function loadBackground(){
    try{
      const files=['assets/bg1.txt','assets/bg2.txt','assets/bg3.txt','assets/bg4.txt','assets/bg5.txt'];
      const parts=await Promise.all(files.map(async file=>{
        const response=await fetch(file,{cache:'force-cache'});
        if(!response.ok) throw new Error(`Background ${response.status}`);
        return (await response.text()).trim();
      }));
      const dataUrl=`data:image/jpeg;base64,${parts.join('')}`;
      document.documentElement.style.setProperty('--vrocinko-bg',`url("${dataUrl}")`);
      document.body.classList.add('has-child-background');
    }catch(error){
      console.warn('Ozadja ni bilo mogoče naložiti.',error);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadBackground,{once:true});
  else loadBackground();
})();
