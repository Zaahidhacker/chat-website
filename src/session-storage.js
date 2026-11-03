// Auth survives storage restrictions in memory. Unchecked “remember” never
// falls back to persistent storage; secrets are never logged or duplicated.
export function createSessionStorage({remember=()=>true,local=()=>localStorage,session=()=>sessionStorage}={}){
 const fallback=new Map();
 const read=(store,key)=>{try{return store().getItem(key)}catch{return null}};
 const write=(store,method,key,value)=>{try{store()[method](key,value);return true}catch{return false}};
 return {
  getItem(key){return fallback.has(key)?fallback.get(key):read(session,key)||read(local,key)},
  setItem(key,value){const chosen=remember()?local:session,other=remember()?session:local;
   const saved=write(chosen,'setItem',key,value),cleared=write(other,'removeItem',key);
   if(saved&&cleared)fallback.delete(key);else fallback.set(key,value);
  },
  removeItem(key){const a=write(session,'removeItem',key),b=write(local,'removeItem',key);
   if(a&&b)fallback.delete(key);else fallback.set(key,null);
  }
 };
}
