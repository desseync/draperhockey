const API = "/.netlify/functions/command-data";
const SESSION = "/.netlify/functions/command-session";
const EMPTY = () => ({
  version: 2,
  actions: [], milestones: [], development: [], watchlist: [], film: [], contacts: [], partners: [], budget: [], web: [], notes: [],
  _meta: { version: 2 }
});

let state = EMPTY();
let saveTimer = null;
let currentTab = "dashboard";
let session = null;
const tabs = [
  ["dashboard","Command"],["roadmap","Roadmap"],["actions","Actions"],["development","Development"],
  ["watchlist","Watchlist"],["film","Film / Klevr"],["network","Network"],["partners","Partners / Travel"],
  ["budget","Budget"],["website","Website / Brand"],["notes","Notes"]
];

const esc = (s="") => String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const nextId = arr => Math.max(0, ...arr.map(x => Number(x.id)||0)) + 1;
const money = n => "$" + (Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:0});
const priorityRank = p => ({High:0,Medium:1,Low:2}[p] ?? 3);
function badge(v){ const c=String(v||"").toLowerCase().replace(/\s+/g,"-"); return v ? `<span class="badge ${c}">${esc(v)}</span>` : ""; }

async function loadSession(){
  const res = await fetch(SESSION,{cache:"no-store"});
  if(!res.ok){ location.replace("/command-login/"); return null; }
  const s = await res.json();
  if(!s.canAccessCommand){ location.replace("/command-login/"); return null; }
  return s;
}
async function loadState(){
  const res = await fetch(API,{cache:"no-store"});
  if(res.status===401 || res.status===403){ location.replace("/command-login/"); return; }
  if(!res.ok) throw new Error("Could not load command data.");
  const body = await res.json();
  state = body.state || EMPTY();
  for(const k of ["actions","milestones","development","watchlist","film","contacts","partners","budget","web","notes"]) if(!Array.isArray(state[k])) state[k]=[];
}
function setSaveStatus(text,cls=""){
  const el=document.getElementById("saveState"); if(!el)return; el.textContent=text; el.className="save-state "+cls;
}
function queueSave(){ clearTimeout(saveTimer); setSaveStatus("SAVING","saving"); saveTimer=setTimeout(saveNow,650); }
async function saveNow(){
  try{
    const res=await fetch(API,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(state)});
    if(!res.ok) throw new Error();
    const body=await res.json(); if(body.updatedAt) state._meta={...(state._meta||{}),updatedAt:body.updatedAt};
    setSaveStatus("SYNCED"); renderMetrics();
  }catch{ setSaveStatus("SAVE ERROR","error"); }
}
function del(source,id){ state[source]=state[source].filter(x=>x.id!==id); queueSave(); render(); }
function toggle(source,id,value){ const x=state[source].find(x=>x.id===id); if(x)x.done=value; queueSave(); render(); }
function edit(source,id,key,value){ const x=state[source].find(x=>x.id===id); if(x)x[key]=value; queueSave(); }

function task(x,source){
  return `<div class="item ${x.done?"done":""}"><input class="check" type="checkbox" ${x.done?"checked":""} data-toggle="${source}" data-id="${x.id}"><div><div class="title">${esc(x.title)}</div><div class="badges">${badge(x.category)}${badge(x.priority)}${badge(x.status)}</div>${x.notes?`<div class="sub">${esc(x.notes)}</div>`:""}</div><button class="x" data-delete="${source}" data-id="${x.id}">×</button></div>`;
}
function basic(x,source,title=x.title){
  return `<div class="item"><div></div><div><div class="title">${esc(title)}</div><div class="badges">${badge(x.org)}${badge(x.status)}${badge(x.priority)}${badge(x.verified)}</div>${x.window?`<div class="sub">${esc(x.window)}</div>`:""}${x.notes?`<div class="sub">${esc(x.notes)}</div>`:""}</div><button class="x" data-delete="${source}" data-id="${x.id}">×</button></div>`;
}
function empty(msg="Nothing here yet."){ return `<div class="empty">${esc(msg)}</div>`; }
function card(label,title,content,wide="",action=""){ return `<section class="card ${wide}"><div class="cardhead"><div><div class="section-label">${esc(label)}</div><h3>${esc(title)}</h3></div>${action}</div>${content}</section>`; }
function actionBtn(kind,label="+"){ return `<button class="btn" data-add="${kind}">${label}</button>`; }

function renderMetrics(){
  const open=state.actions.filter(x=>!x.done).length+state.web.filter(x=>!x.done).length;
  const high=[...state.actions,...state.development,...state.watchlist,...state.web].filter(x=>x.priority==="High"&&!x.done).length;
  const active=state.watchlist.filter(x=>!["Pass","Closed"].includes(x.status)).length;
  const clips=state.film.length;
  const partners=state.partners.filter(x=>x.stage!=="Pass").length;
  const budget=state.budget.reduce((a,b)=>a+(Number(b.amount)||0),0);
  document.getElementById("metrics").innerHTML=[
    [open,"Open actions"],[high,"High priority"],[active,"Watchlist"],[clips,"Film clips"],[partners,"Partner prospects"],[money(budget),"Tracked cost"]
  ].map(([n,l])=>`<div class="metric"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`).join("");
}
function renderTabs(){ document.getElementById("tabs").innerHTML=tabs.map(([id,label])=>`<button class="tab ${id===currentTab?"active":""}" data-tab="${id}">${label}</button>`).join(""); }
function timeline(limit=99){ const arr=state.milestones.slice(0,limit); return arr.length?`<div class="timeline">${arr.map(x=>`<div class="mile"><div class="mile-date">${esc(x.date)}</div><div class="mile-rail"><div class="mile-dot"></div></div><div><h4>${esc(x.title)}</h4><p>${esc(x.detail)}</p></div></div>`).join("")}</div>`:empty("Add the first milestone."); }
function renderDashboard(){
  const pri=state.actions.filter(x=>!x.done).sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)).slice(0,6);
  const dev=state.development.filter(x=>!x.done).sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)).slice(0,5);
  const watch=state.watchlist.filter(x=>!["Pass","Closed"].includes(x.status)).slice(0,4);
  const film=state.film.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,4);
  return `<div class="grid">${card("NOW","Next Actions",pri.length?`<div class="list">${pri.map(x=>task(x,"actions")).join("")}</div>`:empty("No open actions."),"wide",actionBtn("action","+ ACTION"))}${card("ROADMAP","Major Milestones",timeline(4))}${card("DEVELOPMENT","Current Focus",dev.length?`<div class="list">${dev.map(x=>task(x,"development")).join("")}</div>`:empty())}${card("SCOUTING","Watch Now",watch.length?`<div class="list">${watch.map(x=>basic(x,"watchlist")).join("")}</div>`:empty())}${card("FILM","Latest / Queue",film.length?`<div class="list">${film.map(x=>basic({...x,org:x.type,status:x.quality},"film",x.title)).join("")}</div>`:empty("Add clips or film tasks."))}</div>`;
}
function renderActions(){ return `<div class="grid">${card("EXECUTION","Action Board",state.actions.length?`<div class="list">${state.actions.sort((a,b)=>Number(a.done)-Number(b.done)||priorityRank(a.priority)-priorityRank(b.priority)).map(x=>task(x,"actions")).join("")}</div>`:empty(),"full",actionBtn("action","+ ACTION"))}</div>`; }
function renderRoadmap(){ return `<div class="grid">${card("2026 →","Development & Opportunity Roadmap",timeline(),"full",actionBtn("milestone","+ MILESTONE"))}</div>`; }
function renderDevelopment(){
  const coaches=state.contacts.filter(x=>["Coach","Program","Coach / Program"].includes(x.type));
  return `<div class="grid">${card("HOCKEY","Development Areas",state.development.length?`<div class="list">${state.development.map(x=>task(x,"development")).join("")}</div>`:empty(),"wide",actionBtn("development","+ AREA"))}${card("PEOPLE","Coaches / Programs",coaches.length?`<div class="list">${coaches.map(x=>basic({...x,org:x.organization,notes:[x.role,x.notes].filter(Boolean).join(" • ")},"contacts",x.name)).join("")}</div>`:empty(),"",actionBtn("contact","+"))}</div>`;
}
function renderWatchlist(){
  const rows=state.watchlist.map(x=>`<tr><td><input data-edit="watchlist|${x.id}|program" value="${esc(x.program)}"></td><td><input data-edit="watchlist|${x.id}|birthYear" value="${esc(x.birthYear||"")}"></td><td><input data-edit="watchlist|${x.id}|status" value="${esc(x.status||"")}"></td><td><input data-edit="watchlist|${x.id}|window" value="${esc(x.window||"")}"></td><td><input data-edit="watchlist|${x.id}|lastChecked" value="${esc(x.lastChecked||"")}"></td><td><textarea data-edit="watchlist|${x.id}|next">${esc(x.next||"")}</textarea></td><td><input data-edit="watchlist|${x.id}|source" value="${esc(x.source||"")}"></td><td><button class="x" data-delete="watchlist" data-id="${x.id}">×</button></td></tr>`).join("");
  return `<div class="grid">${card("SCOUTING INTEL","Programs / Camps / Opportunities",`<div class="tablewrap"><table class="table"><thead><tr><th>Program</th><th>Birth Year</th><th>Status</th><th>Window</th><th>Last Checked</th><th>Next Action</th><th>Source</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"full",actionBtn("watch","+ WATCH ITEM"))}</div>`;
}
function renderFilm(){
  const rows=state.film.map(x=>`<tr><td><input data-edit="film|${x.id}|date" value="${esc(x.date||"")}"></td><td><input data-edit="film|${x.id}|title" value="${esc(x.title||"")}"></td><td><input data-edit="film|${x.id}|type" value="${esc(x.type||"")}"></td><td><input data-edit="film|${x.id}|skills" value="${esc(x.skills||"")}"></td><td><input data-edit="film|${x.id}|quality" value="${esc(x.quality||"")}"></td><td><input data-edit="film|${x.id}|klevr" value="${esc(x.klevr||"")}" placeholder="Klevr URL"></td><td><input data-edit="film|${x.id}|submitted" value="${esc(x.submitted||"")}"></td><td><textarea data-edit="film|${x.id}|notes">${esc(x.notes||"")}</textarea></td><td><button class="x" data-delete="film" data-id="${x.id}">×</button></td></tr>`).join("");
  const workflow=`<div class="quickgrid"><div class="quick"><b>1 • CAPTURE</b><p>Save original game/training footage by date and event.</p></div><div class="quick"><b>2 • KLEVR</b><p>Clip technical sequences, annotate development themes, collect coach feedback.</p></div><div class="quick"><b>3 • EVALUATE</b><p>Tag each clip: Development, Scouting, Public, or Archive.</p></div><div class="quick"><b>4 • SHARE</b><p>Use program-specific submissions only when the film is useful and requested.</p></div></div>`;
  return `<div class="grid">${card("KLEVR PIPELINE","Film Library",`<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Clip</th><th>Type</th><th>Skills</th><th>Use</th><th>Klevr</th><th>Submitted</th><th>Notes</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"full",actionBtn("film","+ CLIP"))}${card("WORKFLOW","Camera → Klevr → Command → Share",workflow,"full")}</div>`;
}
function renderNetwork(){
  const rows=state.contacts.map(x=>`<tr><td><input data-edit="contacts|${x.id}|name" value="${esc(x.name||"")}"></td><td><input data-edit="contacts|${x.id}|role" value="${esc(x.role||"")}"></td><td><input data-edit="contacts|${x.id}|organization" value="${esc(x.organization||"")}"></td><td><input data-edit="contacts|${x.id}|type" value="${esc(x.type||"")}"></td><td><textarea data-edit="contacts|${x.id}|notes">${esc(x.notes||"")}</textarea></td><td><button class="x" data-delete="contacts" data-id="${x.id}">×</button></td></tr>`).join("");
  return `<div class="grid">${card("RELATIONSHIPS","Hockey Network",`<div class="tablewrap"><table class="table"><thead><tr><th>Name / Program</th><th>Role</th><th>Organization</th><th>Type</th><th>Notes</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"full",actionBtn("contact","+ CONTACT"))}</div>`;
}
function renderPartners(){
  const rows=state.partners.map(x=>`<tr><td><input data-edit="partners|${x.id}|business" value="${esc(x.business||"")}"></td><td><input data-edit="partners|${x.id}|type" value="${esc(x.type||"")}"></td><td><input data-edit="partners|${x.id}|stage" value="${esc(x.stage||"")}"></td><td><input data-edit="partners|${x.id}|value" value="${esc(x.value||"")}"></td><td><textarea data-edit="partners|${x.id}|next">${esc(x.next||"")}</textarea></td><td><button class="x" data-delete="partners" data-id="${x.id}">×</button></td></tr>`).join("");
  const travel=`<div class="quickgrid"><div class="quick"><b>TRAVEL PARTNER</b><p>Hotel credits, hosted room nights, or travel support where tournament lodging rules permit.</p></div><div class="quick"><b>DEVELOPMENT PARTNER</b><p>Support tied to real media/brand value — not athletic performance.</p></div><div class="quick"><b>RETROSPECTIVE CONTENT</b><p>Never publish a minor's live hotel/location. Post partnership content after checkout/travel.</p></div><div class="quick"><b>STAY-TO-PLAY CHECK</b><p>Verify tournament lodging requirements before promising a hotel partner placement.</p></div></div>`;
  return `<div class="grid">${card("PARTNERSHIP PIPELINE","Prospects / Travel Support",`<div class="tablewrap"><table class="table"><thead><tr><th>Business</th><th>Type</th><th>Stage</th><th>Value / Ask</th><th>Next Step</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"wide",actionBtn("partner","+ PROSPECT"))}${card("TRAVEL","Partnership Rules",travel)}</div>`;
}
function renderBudget(){
  const rows=state.budget.map(x=>`<tr><td><input data-edit="budget|${x.id}|item" value="${esc(x.item||"")}"></td><td><input data-edit="budget|${x.id}|category" value="${esc(x.category||"")}"></td><td><input type="number" data-edit="budget|${x.id}|amount" value="${esc(x.amount||0)}"></td><td><input data-edit="budget|${x.id}|frequency" value="${esc(x.frequency||"")}"></td><td><input data-edit="budget|${x.id}|status" value="${esc(x.status||"")}"></td><td><button class="x" data-delete="budget" data-id="${x.id}">×</button></td></tr>`).join("");
  return `<div class="grid">${card("COST CONTROL","Development / Travel Budget",`<div class="tablewrap"><table class="table"><thead><tr><th>Item</th><th>Category</th><th>Amount</th><th>Frequency / Date</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"full",actionBtn("budget","+ COST"))}</div>`;
}
function renderWebsite(){ return `<div class="grid">${card("DRAPERHOCKEY.COM","Website / Brand Backlog",state.web.length?`<div class="list">${state.web.map(x=>task(x,"web")).join("")}</div>`:empty(),"wide",actionBtn("web","+ TASK"))}${card("PUBLIC-SAFE RULE","What Goes Public",`<div class="quickgrid"><div class="quick"><b>PUBLIC</b><p>Edited game/training clips, development themes, brand photography, community work and retrospective tournament stories.</p></div><div class="quick"><b>PRIVATE</b><p>Live schedules, hotels, exact travel plans, private contacts, scouting strategy, finances and partnership negotiations.</p></div></div>`)}</div>`; }
function renderNotes(){ return `<div class="grid">${card("BRAIN DUMP","Notes",state.notes.length?`<div class="notes">${state.notes.map(x=>`<div class="note"><div class="notehead"><input data-edit="notes|${x.id}|title" value="${esc(x.title||"")}"><button class="x" data-delete="notes" data-id="${x.id}">×</button></div><textarea data-edit="notes|${x.id}|text">${esc(x.text||"")}</textarea></div>`).join("")}</div>`:empty(),"full",actionBtn("note","+ NOTE"))}</div>`; }
function render(){
  renderMetrics(); renderTabs();
  const map={dashboard:renderDashboard,roadmap:renderRoadmap,actions:renderActions,development:renderDevelopment,watchlist:renderWatchlist,film:renderFilm,network:renderNetwork,partners:renderPartners,budget:renderBudget,website:renderWebsite,notes:renderNotes};
  document.getElementById("views").innerHTML=(map[currentTab]||renderDashboard)();
  bindDynamic();
}
function bindDynamic(){
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>del(b.dataset.delete,Number(b.dataset.id)));
  document.querySelectorAll("[data-toggle]").forEach(b=>b.onchange=()=>toggle(b.dataset.toggle,Number(b.dataset.id),b.checked));
  document.querySelectorAll("[data-edit]").forEach(el=>el.onchange=()=>{const [s,id,k]=el.dataset.edit.split("|"); edit(s,Number(id),k,el.value)});
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>openAdd(b.dataset.add));
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;render()});
}

function field(id,label,type="text",full=false,placeholder=""){ return `<div class="field ${full?"full":""}"><label for="${id}">${label}</label>${type==="textarea" ? `<textarea class="textarea" id="${id}" placeholder="${esc(placeholder)}"></textarea>` : `<input class="input" id="${id}" type="${type}" placeholder="${esc(placeholder)}">`}</div>`; }
function modal(title,body,onSave){ const back=document.getElementById("modalBack"),m=document.getElementById("modal"); m.innerHTML=`<h2>${esc(title)}</h2><div class="formgrid">${body}</div><div class="modalactions"><button class="btn ghost" id="cancelModal">CANCEL</button><button class="btn" id="saveModal">SAVE</button></div>`;back.classList.add("open");document.getElementById("cancelModal").onclick=closeModal;document.getElementById("saveModal").onclick=onSave; }
function closeModal(){document.getElementById("modalBack").classList.remove("open")}
const val=id=>(document.getElementById(id)?.value||"").trim();
function openAdd(kind){
  if(kind==="action") return modal("Add Action",field("a1","Action","text",true)+field("a2","Category")+field("a3","Priority")+field("a4","Notes","textarea",true),()=>{state.actions.push({id:nextId(state.actions),title:val("a1"),category:val("a2")||"Hockey",priority:val("a3")||"Medium",notes:val("a4"),done:false});closeModal();queueSave();render()});
  if(kind==="milestone") return modal("Add Milestone",field("m1","Date / Window")+field("m2","Milestone")+field("m3","Detail","textarea",true),()=>{state.milestones.push({id:nextId(state.milestones),date:val("m1"),title:val("m2"),detail:val("m3")});closeModal();queueSave();render()});
  if(kind==="development") return modal("Add Development Area",field("d1","Area")+field("d2","Priority"),()=>{state.development.push({id:nextId(state.development),title:val("d1"),priority:val("d2")||"Medium",done:false});closeModal();queueSave();render()});
  if(kind==="watch") return modal("Add Watch Item",field("w1","Program")+field("w2","Birth Year")+field("w3","Status")+field("w4","Window")+field("w5","Official Source","text",true)+field("w6","Next Action","textarea",true),()=>{state.watchlist.push({id:nextId(state.watchlist),program:val("w1"),birthYear:val("w2"),status:val("w3")||"Watch",window:val("w4"),source:val("w5"),next:val("w6"),lastChecked:"",priority:"Medium"});closeModal();queueSave();render()});
  if(kind==="film") return modal("Add Film / Klevr Item",field("f1","Date")+field("f2","Clip / Task")+field("f3","Type")+field("f4","Skills")+field("f5","Use / Quality")+field("f6","Klevr URL")+field("f7","Notes","textarea",true),()=>{state.film.push({id:nextId(state.film),date:val("f1"),title:val("f2"),type:val("f3"),skills:val("f4"),quality:val("f5"),klevr:val("f6"),submitted:"",notes:val("f7")});closeModal();queueSave();render()});
  if(kind==="contact") return modal("Add Hockey Contact",field("c1","Name / Program")+field("c2","Role")+field("c3","Organization")+field("c4","Type")+field("c5","Notes","textarea",true),()=>{state.contacts.push({id:nextId(state.contacts),name:val("c1"),role:val("c2"),organization:val("c3"),type:val("c4"),notes:val("c5")});closeModal();queueSave();render()});
  if(kind==="partner") return modal("Add Partner Prospect",field("p1","Business")+field("p2","Type")+field("p3","Stage")+field("p4","Value / Ask")+field("p5","Next Step","textarea",true),()=>{state.partners.push({id:nextId(state.partners),business:val("p1"),type:val("p2"),stage:val("p3")||"Idea",value:val("p4"),next:val("p5")});closeModal();queueSave();render()});
  if(kind==="budget") return modal("Add Cost",field("b1","Item")+field("b2","Category")+field("b3","Amount","number")+field("b4","Frequency / Date")+field("b5","Status"),()=>{state.budget.push({id:nextId(state.budget),item:val("b1"),category:val("b2"),amount:Number(val("b3"))||0,frequency:val("b4"),status:val("b5")||"Planning"});closeModal();queueSave();render()});
  if(kind==="web") return modal("Add Website / Brand Task",field("e1","Task","text",true)+field("e2","Category")+field("e3","Priority"),()=>{state.web.push({id:nextId(state.web),title:val("e1"),category:val("e2")||"Website",priority:val("e3")||"Medium",done:false});closeModal();queueSave();render()});
  if(kind==="note") return modal("Add Note",field("n1","Title")+field("n2","Note","textarea",true),()=>{state.notes.push({id:nextId(state.notes),title:val("n1")||"Note",text:val("n2")});closeModal();queueSave();render()});
}
function exportBackup(){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"})); a.download=`draper-command-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
async function importBackup(file){ const text=await file.text(); const incoming=JSON.parse(text); if(!incoming || typeof incoming!=="object" || Array.isArray(incoming)) throw new Error("Invalid backup file."); state={...EMPTY(),...incoming}; queueSave(); render(); }
async function logout(){ await fetch("/.netlify/functions/command-logout",{method:"POST"}); location.replace("/command-login/"); }

(async function boot(){
  try{
    session=await loadSession(); if(!session)return;
    document.getElementById("userEmail").textContent=session.email||"Authorized";
    const first=(session.email||"C").slice(0,1).toUpperCase();document.getElementById("logoutBtn").textContent=first;
    await loadState();
    document.getElementById("loading").remove(); document.getElementById("app").hidden=false;
    render();
    document.getElementById("quickAddBtn").onclick=()=>openAdd("action");
    document.getElementById("exportBtn").onclick=exportBackup;
    document.getElementById("importBtn").onclick=()=>document.getElementById("importFile").click();
    document.getElementById("importFile").onchange=async e=>{try{if(e.target.files[0])await importBackup(e.target.files[0])}catch(err){alert(err.message)}e.target.value=""};
    document.getElementById("logoutBtn").onclick=logout;
    document.getElementById("modalBack").onclick=e=>{if(e.target===e.currentTarget)closeModal()};
  }catch(err){ document.getElementById("loading").innerHTML=`<div class="loadmark">!</div><div>COMMAND CENTER COULD NOT LOAD</div>`; }
})();
