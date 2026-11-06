/* One durable state value; automatic backups are separate recoverable values. */
window.LocalBackups=(()=>{
 const key=window.JIDELNICKY_CONFIG?.storageKey||'jidelnicky2_static_v1';
 const prefix=key+':backup:';
 const keys=()=>Object.keys(localStorage).filter(k=>k.startsWith(prefix)).sort();
 function commit(state){
  const serial=JSON.stringify(state),previous=localStorage.getItem(key);
  if(serial===previous)return;
  if(previous){
   // Do not delete any backup before the new durable state is written.
   const backupKey=prefix+new Date().toISOString()+':'+Math.random().toString(36).slice(2,8);
   localStorage.setItem(backupKey,previous);
  }
  localStorage.setItem(key,serial);
  for(const old of keys().slice(0,-5))try{localStorage.removeItem(old)}catch{}
 }
 function latest(){const k=keys().at(-1);return k?{key:k,state:JSON.parse(localStorage.getItem(k))}:null}
 return {commit,latest};
})();
