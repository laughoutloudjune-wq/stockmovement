// js/api.js
const API_URL = "https://script.google.com/macros/s/AKfycbwEJDNfo63e0LjEZa-bhXmX3aY2PUs96bUBGz186T-pVlphV4NGNYxGT2tcx1DWgbDI/exec"; // change if needed

function safeJson(t){ try{ return JSON.parse(t); } catch(e){ return {ok:false,error:"Bad JSON"}; } }

async function fetchWithTimeout(url, options = {}, ms = 12000){
  const controller = new AbortController();
  const id = setTimeout(()=>controller.abort(), ms);
  try{
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id); return res;
  }catch(e){ clearTimeout(id); throw e; }
}

export async function apiGet(fn, payload = {}, { retries = 1 } = {}){
  const q = new URLSearchParams(); q.set("fn", fn);
  if (payload && Object.keys(payload).length) q.set("payload", JSON.stringify(payload));
  for (let i=0;i<=retries;i++){
    try{
      const r = await fetchWithTimeout(`${API_URL}?${q.toString()}`, { method:"GET" });
      const text = await r.text(); const data = safeJson(text);
      return data.result !== undefined ? data.result : data;
    }catch(e){
      if (i === retries) throw e;
      await new Promise(res=>setTimeout(res, 300*(i+1)));
    }
  }
}

export async function apiPost(fn, payload = {}, { retries = 0 } = {}){
  for (let i=0;i<=retries;i++){
    try{
      const r = await fetchWithTimeout(API_URL, {
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify({ fn, payload })
      }, 15000);
      const text = await r.text(); const data = safeJson(text);
      return data.result !== undefined ? data.result : data;
    }catch(e){
      if (i === retries) throw e;
      await new Promise(res=>setTimeout(res, 400*(i+1)));
    }
  }
}
