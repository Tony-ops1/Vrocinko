(() => {
  async function loadBackground(){
    try{
      const files=['assets/bgw1.txt','assets/bgw2.txt','assets/bgw3.txt','assets/bgw4.txt','assets/bgw5.txt','assets/bgw6.txt'];
      const parts=await Promise.all(files.map(async file=>{
        const response=await fetch(file,{cache:'no-store'});
        if(!response.ok) throw new Error(`Background ${response.status}`);
        return (await response.text()).trim();
      }));
      const dataUrl=`data:image/webp;base64,${parts.join('')}`;
      document.documentElement.style.setProperty('--vrocinko-bg',`url("${dataUrl}")`);
      document.body.classList.add('has-child-background');
    }catch(error){
      console.warn('Ozadja ni bilo mogoče naložiti.',error);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadBackground,{once:true});
  else loadBackground();
})();
