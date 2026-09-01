const API = "/.netlify/functions/command-data";
const SESSION = "/.netlify/functions/command-session";

const DEFAULT_ACCOUNTS = () => [
  {id:1, platform:"TikTok", handle:"", profileUrl:"", followers:0, goal:1000, status:"Setup"},
  {id:2, platform:"Instagram", handle:"", profileUrl:"", followers:0, goal:1000, status:"Setup"},
  {id:3, platform:"YouTube", handle:"", profileUrl:"", followers:0, goal:500, status:"Setup"}
];
const DEFAULT_MERCH = () => [
  {id:1, product:"Built in the Crease Hoodie", collection:"Built in the Crease", status:"Idea", price:0, unitCost:0, goalUnits:50, sold:0, notes:"Prototype / pricing TBD."},
  {id:2, product:"Every Team Needs a Draper Tee", collection:"Every Team Needs a Draper", status:"Idea", price:0, unitCost:0, goalUnits:50, sold:0, notes:"Potential first limited drop."},
  {id:3, product:"DRAPER Stickers", collection:"Core", status:"Idea", price:0, unitCost:0, goalUnits:100, sold:0, notes:"Low-cost supporter / rink item."}
];
const DEFAULT_GOALS = () => ({partnerValue:5000, merchRevenue:3000, merchProfit:1800, offsetPercent:50});
const EMPTY = () => ({
  version: 3,
  actions: [], milestones: [], development: [], watchlist: [], film: [], contacts: [], partners: [], budget: [], web: [], notes: [],
  socialAccounts: DEFAULT_ACCOUNTS(), socialSnapshots: [], socialPosts: [], merch: DEFAULT_MERCH(), otherOffsets: [], goals: DEFAULT_GOALS(),
  _meta: { version: 3 }
});

let state = EMPTY();
let saveTimer = null;
let currentTab = "dashboard";
let session = null;
let migratedOnLoad = false;
const tabs = [
  ["dashboard","Command"],["roadmap","Roadmap"],["actions","Actions"],["development","Development"],
  ["watchlist","Watchlist"],["film","Film / Klevr"],["social","Social / Growth"],["partners","Partners"],
  ["merch","Merch"],["money","Money / Offset"],["network","Network"],["website","Website / Brand"],["notes","Notes"]
];

const esc = (s="") => String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const nextId = arr => Math.max(0, ...arr.map(x => Number(x.id)||0)) + 1;
const num = n => Number(n)||0;
const money = n => "$" + num(n).toLocaleString(undefined,{maximumFractionDigits:0});
const compact = n => num(n).toLocaleString(undefined,{notation:"compact",maximumFractionDigits:1});
const priorityRank = p => ({High:0,Medium:1,Low:2}[p] ?? 3);
const pct = (a,b) => b>0 ? Math.max(0,Math.min(100,(num(a)/num(b))*100)) : 0;
function badge(v){ const c=String(v||"").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,""); return v ? `<span class="badge ${c}">${esc(v)}</span>` : ""; }
function progress(value,goal,label=""){ const p=pct(value,goal); return `<div class="progress-wrap"><div class="progress-meta"><span>${esc(label)}</span><b>${Math.round(p)}%</b></div><div class="progress"><i style="width:${p}%"></i></div></div>`; }

async function loadSession(){
  const res = await fetch(SESSION,{cache:"no-store"});
  if(!res.ok){ location.replace("/command-login/"); return null; }
  const s = await res.json();
  if(!s.canAccessCommand){ location.replace("/command-login/"); return null; }
  return s;
}
function migrateState(){
  let changed=false;
  const arrays=["actions","milestones","development","watchlist","film","contacts","partners","budget","web","notes","socialAccounts","socialSnapshots","socialPosts","merch","otherOffsets"];
  for(const k of arrays){ if(!Array.isArray(state[k])){ state[k]=[]; changed=true; } }
  if(!state.socialAccounts.length){ state.socialAccounts=DEFAULT_ACCOUNTS(); changed=true; }
  if(!state.merch.length){ state.merch=DEFAULT_MERCH(); changed=true; }
  if(!state.goals || typeof state.goals!=="object" || Array.isArray(state.goals)){ state.goals=DEFAULT_GOALS(); changed=true; }
  for(const [k,v] of Object.entries(DEFAULT_GOALS())) if(state.goals[k]===undefined){ state.goals[k]=v; changed=true; }
  for(const p of state.partners){
    if(p.contact===undefined){p.contact="";changed=true}
    if(p.contactInfo===undefined){p.contactInfo="";changed=true}
    if(p.cashValue===undefined){p.cashValue=0;changed=true}
    if(p.inKindValue===undefined){p.inKindValue=0;changed=true}
    if(p.deliverables===undefined){p.deliverables="";changed=true}
    if(p.nextDate===undefined){p.nextDate="";changed=true}
  }
  state.version=3;
  state._meta={...(state._meta||{}),version:3};
  return changed;
}
async function loadState(){
  const res = await fetch(API,{cache:"no-store"});
  if(res.status===401 || res.status===403){ location.replace("/command-login/"); return; }
  if(!res.ok) throw new Error("Could not load command data.");
  const body = await res.json();
  state = body.state || EMPTY();
  migratedOnLoad=migrateState();
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
function edit(source,id,key,value){ const x=state[source].find(x=>x.id===id); if(x)x[key]=value; queueSave(); renderMetrics(); }
function editGoal(key,value){ state.goals[key]=num(value); queueSave(); render(); }

function task(x,source){
  return `<div class="item ${x.done?"done":""}"><input class="check" type="checkbox" ${x.done?"checked":""} data-toggle="${source}" data-id="${x.id}"><div><div class="title">${esc(x.title)}</div><div class="badges">${badge(x.category)}${badge(x.priority)}${badge(x.status)}</div>${x.notes?`<div class="sub">${esc(x.notes)}</div>`:""}</div><button class="x" data-delete="${source}" data-id="${x.id}">×</button></div>`;
}
function basic(x,source,title=x.title){
  return `<div class="item"><div></div><div><div class="title">${esc(title)}</div><div class="badges">${badge(x.org)}${badge(x.status)}${badge(x.priority)}${badge(x.verified)}</div>${x.window?`<div class="sub">${esc(x.window)}</div>`:""}${x.notes?`<div class="sub">${esc(x.notes)}</div>`:""}</div><button class="x" data-delete="${source}" data-id="${x.id}">×</button></div>`;
}
function empty(msg="Nothing here yet."){ return `<div class="empty">${esc(msg)}</div>`; }
function card(label,title,content,wide="",action=""){ return `<section class="card ${wide}"><div class="cardhead"><div><div class="section-label">${esc(label)}</div><h3>${esc(title)}</h3></div>${action}</div>${content}</section>`; }
function actionBtn(kind,label="+"){ return `<button class="btn" data-add="${kind}">${label}</button>`; }

function latestSnapshots(){
  const out={};
  const sorted=state.socialSnapshots.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  for(const x of sorted) out[x.platform]=x;
  return out;
}
function socialTotals(){
  const followers=state.socialAccounts.reduce((a,x)=>a+num(x.followers),0);
  const latest=latestSnapshots();
  const views=Object.values(latest).reduce((a,x)=>a+num(x.views),0);
  return {followers,views};
}
function partnerTotals(activeOnly=true){
  const activeWords=["active","partner","signed","live"];
  const arr=activeOnly?state.partners.filter(x=>activeWords.some(w=>String(x.stage||"").toLowerCase().includes(w))):state.partners;
  return {
    cash:arr.reduce((a,x)=>a+num(x.cashValue),0),
    inKind:arr.reduce((a,x)=>a+num(x.inKindValue),0)
  };
}
function merchTotals(){
  let revenue=0,cost=0,units=0,goalUnits=0;
  for(const x of state.merch){ const sold=num(x.sold), price=num(x.price), c=num(x.unitCost); units+=sold;goalUnits+=num(x.goalUnits);revenue+=sold*price;cost+=sold*c; }
  return {revenue,cost,profit:revenue-cost,units,goalUnits};
}
function moneyTotals(){
  const cost=state.budget.reduce((a,b)=>a+num(b.amount),0);
  const p=partnerTotals(true), m=merchTotals();
  const other=state.otherOffsets.reduce((a,x)=>a+num(x.amount),0);
  const offset=p.cash+p.inKind+m.profit+other;
  return {cost,partnerCash:p.cash,partnerInKind:p.inKind,merchProfit:m.profit,other,offset,percent:cost>0?(offset/cost)*100:0};
}
function renderMetrics(){
  const open=state.actions.filter(x=>!x.done).length+state.web.filter(x=>!x.done).length;
  const active=state.watchlist.filter(x=>!["Pass","Closed"].includes(x.status)).length;
  const s=socialTotals(), p=partnerTotals(true), m=merchTotals(), mt=moneyTotals();
  const partnerValue=p.cash+p.inKind;
  document.getElementById("metrics").innerHTML=[
    [open,"Open actions"],[active,"Watchlist"],[compact(s.followers),"Total audience"],[compact(s.views),"Latest views"],
    [money(partnerValue),"Active partner value"],[money(m.profit),"Merch profit"],[`${Math.round(mt.percent)}%`,"Hockey cost offset"],[money(mt.cost),"Tracked hockey cost"]
  ].map(([n,l])=>`<div class="metric"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`).join("");
}
function renderTabs(){ document.getElementById("tabs").innerHTML=tabs.map(([id,label])=>`<button class="tab ${id===currentTab?"active":""}" data-tab="${id}">${label}</button>`).join(""); }
function timeline(limit=99){ const arr=state.milestones.slice(0,limit); return arr.length?`<div class="timeline">${arr.map(x=>`<div class="mile"><div class="mile-date">${esc(x.date)}</div><div class="mile-rail"><div class="mile-dot"></div></div><div><h4>${esc(x.title)}</h4><p>${esc(x.detail)}</p></div></div>`).join("")}</div>`:empty("Add the first milestone."); }

function renderBrandScore(){
  const s=socialTotals(), p=partnerTotals(true), m=merchTotals(), mt=moneyTotals();
  return `<div class="scoregrid">
    <div class="scorebox"><small>AUDIENCE</small><b>${compact(s.followers)}</b><span>${compact(s.views)} latest-period views</span></div>
    <div class="scorebox"><small>PARTNERS</small><b>${money(p.cash+p.inKind)}</b><span>${state.partners.filter(x=>String(x.stage||"").toLowerCase().includes("active")||String(x.stage||"").toLowerCase().includes("partner")).length} active</span></div>
    <div class="scorebox"><small>MERCH</small><b>${money(m.profit)}</b><span>${m.units} units sold</span></div>
    <div class="scorebox"><small>OFFSET</small><b>${Math.round(mt.percent)}%</b><span>${money(mt.offset)} of ${money(mt.cost)}</span></div>
  </div>`;
}
function renderGoalBoard(){
  const p=partnerTotals(true), m=merchTotals(), mt=moneyTotals();
  return `<div class="goal-list">
    <div class="goal-row"><div><b>Partner value</b><span>${money(p.cash+p.inKind)} / ${money(state.goals.partnerValue)}</span></div>${progress(p.cash+p.inKind,state.goals.partnerValue)}</div>
    <div class="goal-row"><div><b>Merch revenue</b><span>${money(m.revenue)} / ${money(state.goals.merchRevenue)}</span></div>${progress(m.revenue,state.goals.merchRevenue)}</div>
    <div class="goal-row"><div><b>Merch profit</b><span>${money(m.profit)} / ${money(state.goals.merchProfit)}</span></div>${progress(m.profit,state.goals.merchProfit)}</div>
    <div class="goal-row"><div><b>Hockey cost offset</b><span>${Math.round(mt.percent)}% / ${num(state.goals.offsetPercent)}%</span></div>${progress(mt.percent,state.goals.offsetPercent)}</div>
  </div>`;
}
function renderDashboard(){
  const pri=state.actions.filter(x=>!x.done).sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)).slice(0,6);
  const watch=state.watchlist.filter(x=>!["Pass","Closed"].includes(x.status)).slice(0,4);
  const film=state.film.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,4);
  return `<div class="grid">
    ${card("NOW","Next Actions",pri.length?`<div class="list">${pri.map(x=>task(x,"actions")).join("")}</div>`:empty("No open actions."),"wide",actionBtn("action","+ ACTION"))}
    ${card("BRAND","Growth Scoreboard",renderBrandScore())}
    ${card("GOALS","Funding the Long Game",renderGoalBoard(),"wide")}
    ${card("ROADMAP","Major Milestones",timeline(4))}
    ${card("SCOUTING","Watch Now",watch.length?`<div class="list">${watch.map(x=>basic(x,"watchlist")).join("")}</div>`:empty())}
    ${card("FILM","Latest / Queue",film.length?`<div class="list">${film.map(x=>basic({...x,org:x.type,status:x.quality},"film",x.title)).join("")}</div>`:empty("Add clips or film tasks."))}
  </div>`;
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
function renderSocial(){
  const accountRows=state.socialAccounts.map(x=>`<tr><td><input data-edit="socialAccounts|${x.id}|platform" value="${esc(x.platform||"")}"></td><td><input data-edit="socialAccounts|${x.id}|handle" value="${esc(x.handle||"")}" placeholder="@handle"></td><td><input data-edit="socialAccounts|${x.id}|profileUrl" value="${esc(x.profileUrl||"")}" placeholder="Profile URL"></td><td><input type="number" data-edit="socialAccounts|${x.id}|followers" value="${num(x.followers)}"></td><td><input type="number" data-edit="socialAccounts|${x.id}|goal" value="${num(x.goal)}"></td><td>${progress(num(x.followers),num(x.goal),"")}</td><td><input data-edit="socialAccounts|${x.id}|status" value="${esc(x.status||"")}"></td><td><button class="x" data-delete="socialAccounts" data-id="${x.id}">×</button></td></tr>`).join("");
  const snapshots=state.socialSnapshots.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(x=>`<tr><td><input data-edit="socialSnapshots|${x.id}|date" value="${esc(x.date||"")}"></td><td><input data-edit="socialSnapshots|${x.id}|platform" value="${esc(x.platform||"")}"></td><td><input type="number" data-edit="socialSnapshots|${x.id}|followers" value="${num(x.followers)}"></td><td><input type="number" data-edit="socialSnapshots|${x.id}|views" value="${num(x.views)}"></td><td><input data-edit="socialSnapshots|${x.id}|engagement" value="${esc(x.engagement||"")}" placeholder="e.g. 7.2%"></td><td><input data-edit="socialSnapshots|${x.id}|topPost" value="${esc(x.topPost||"")}" placeholder="Top post / URL"></td><td><input type="number" data-edit="socialSnapshots|${x.id}|topViews" value="${num(x.topViews)}"></td><td><textarea data-edit="socialSnapshots|${x.id}|notes">${esc(x.notes||"")}</textarea></td><td><button class="x" data-delete="socialSnapshots" data-id="${x.id}">×</button></td></tr>`).join("");
  const posts=state.socialPosts.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(x=>`<tr><td><input data-edit="socialPosts|${x.id}|date" value="${esc(x.date||"")}"></td><td><input data-edit="socialPosts|${x.id}|platform" value="${esc(x.platform||"")}"></td><td><input data-edit="socialPosts|${x.id}|title" value="${esc(x.title||"")}"></td><td><input data-edit="socialPosts|${x.id}|url" value="${esc(x.url||"")}" placeholder="Post URL"></td><td><input type="number" data-edit="socialPosts|${x.id}|views" value="${num(x.views)}"></td><td><input type="number" data-edit="socialPosts|${x.id}|likes" value="${num(x.likes)}"></td><td><input type="number" data-edit="socialPosts|${x.id}|comments" value="${num(x.comments)}"></td><td><input type="number" data-edit="socialPosts|${x.id}|shares" value="${num(x.shares)}"></td><td><input data-edit="socialPosts|${x.id}|sponsor" value="${esc(x.sponsor||"")}" placeholder="Partner if any"></td><td><button class="x" data-delete="socialPosts" data-id="${x.id}">×</button></td></tr>`).join("");
  const summary=state.socialAccounts.map(x=>`<div class="platform-card"><div><small>${esc(x.platform)}</small><b>${compact(x.followers)}</b><span>${esc(x.handle||"Handle not set")}</span></div>${progress(num(x.followers),num(x.goal),`${compact(x.followers)} / ${compact(x.goal)} goal`)}</div>`).join("");
  return `<div class="grid">
    ${card("AUDIENCE","Platform Goals",`<div class="platform-grid">${summary}</div>`,"full")}
    ${card("ACCOUNTS","Social Profiles",`<div class="tablewrap"><table class="table social-accounts"><thead><tr><th>Platform</th><th>Handle</th><th>Profile</th><th>Followers</th><th>Goal</th><th>Progress</th><th>Status</th><th></th></tr></thead><tbody>${accountRows}</tbody></table></div>`,"full",actionBtn("socialAccount","+ PLATFORM"))}
    ${card("SNAPSHOTS","Weekly / Monthly Performance",snapshots?`<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Platform</th><th>Followers</th><th>Views</th><th>Engagement</th><th>Top Post</th><th>Top Views</th><th>Notes</th><th></th></tr></thead><tbody>${snapshots}</tbody></table></div>`:empty("Add the first social snapshot."),"full",actionBtn("snapshot","+ SNAPSHOT"))}
    ${card("POST PERFORMANCE","What Actually Works",posts?`<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Platform</th><th>Post</th><th>URL</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Partner</th><th></th></tr></thead><tbody>${posts}</tbody></table></div>`:empty("Track standout posts here."),"wide",actionBtn("socialPost","+ POST"))}
    ${card("SECURITY","Keep Credentials Out",`<div class="quickgrid one"><div class="quick"><b>NO PASSWORDS</b><p>Do not store TikTok, Instagram, YouTube, payment credentials, API keys or recovery codes in Command.</p></div><div class="quick"><b>MANUAL FIRST</b><p>Weekly snapshots take about two minutes. We can automate supported platform data later without redesigning this dashboard.</p></div></div>`) }
  </div>`;
}
function renderPartners(){
  const rows=state.partners.map(x=>`<tr><td><input data-edit="partners|${x.id}|business" value="${esc(x.business||"")}"></td><td><input data-edit="partners|${x.id}|type" value="${esc(x.type||"")}"></td><td><input data-edit="partners|${x.id}|stage" value="${esc(x.stage||"")}"></td><td><input data-edit="partners|${x.id}|contact" value="${esc(x.contact||"")}" placeholder="Name"></td><td><input data-edit="partners|${x.id}|contactInfo" value="${esc(x.contactInfo||"")}" placeholder="Email / phone"></td><td><input type="number" data-edit="partners|${x.id}|cashValue" value="${num(x.cashValue)}"></td><td><input type="number" data-edit="partners|${x.id}|inKindValue" value="${num(x.inKindValue)}"></td><td><textarea data-edit="partners|${x.id}|deliverables">${esc(x.deliverables||x.value||"")}</textarea></td><td><input data-edit="partners|${x.id}|nextDate" value="${esc(x.nextDate||"")}" placeholder="YYYY-MM-DD"></td><td><textarea data-edit="partners|${x.id}|next">${esc(x.next||"")}</textarea></td><td><button class="x" data-delete="partners" data-id="${x.id}">×</button></td></tr>`).join("");
  const pipeline={}; for(const x of state.partners){const k=x.stage||"Idea";pipeline[k]=(pipeline[k]||0)+1}
  const pipelineHtml=Object.entries(pipeline).map(([k,v])=>`<div class="pipeline-step"><b>${v}</b><span>${esc(k)}</span></div>`).join("")||`<div class="empty">No partner prospects yet.</div>`;
  const pAll=partnerTotals(false),pAct=partnerTotals(true);
  return `<div class="grid">
    ${card("PIPELINE","Sponsor / Travel CRM",`<div class="pipeline">${pipelineHtml}</div>`,"wide")}
    ${card("VALUE","Partner Economics",`<div class="scoregrid two"><div class="scorebox"><small>ACTIVE VALUE</small><b>${money(pAct.cash+pAct.inKind)}</b><span>cash + in-kind</span></div><div class="scorebox"><small>PIPELINE VALUE</small><b>${money(pAll.cash+pAll.inKind)}</b><span>all entered prospects</span></div></div>${progress(pAct.cash+pAct.inKind,state.goals.partnerValue,`Goal ${money(state.goals.partnerValue)}`)}`)}
    ${card("PARTNERSHIP PIPELINE","Partners / Sponsors / Travel",`<div class="tablewrap"><table class="table partner-table"><thead><tr><th>Business</th><th>Type</th><th>Stage</th><th>Contact</th><th>Contact Info</th><th>Cash $</th><th>In-kind $</th><th>Deliverables / Ask</th><th>Follow-up</th><th>Next Step</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"full",actionBtn("partner","+ PROSPECT"))}
    ${card("TRAVEL","Partnership Rules",`<div class="quickgrid"><div class="quick"><b>TRAVEL PARTNER</b><p>Hotel credits, hosted room nights, or travel support where tournament lodging rules permit.</p></div><div class="quick"><b>REAL VALUE</b><p>Offer website placement, retrospective content and genuine media value — not payment tied to performance.</p></div><div class="quick"><b>NO LIVE LOCATION</b><p>Never publish a minor's hotel or travel location in real time. Partnership posts happen after travel/check-out.</p></div><div class="quick"><b>STAY-TO-PLAY</b><p>Check tournament lodging rules before promising a hotel partner that Draper will stay at a specific property.</p></div></div>`,"full")}
  </div>`;
}
function renderMerch(){
  const m=merchTotals();
  const rows=state.merch.map(x=>{const revenue=num(x.sold)*num(x.price),profit=revenue-(num(x.sold)*num(x.unitCost));return `<tr><td><input data-edit="merch|${x.id}|product" value="${esc(x.product||"")}"></td><td><input data-edit="merch|${x.id}|collection" value="${esc(x.collection||"")}"></td><td><input data-edit="merch|${x.id}|status" value="${esc(x.status||"")}"></td><td><input type="number" step="0.01" data-edit="merch|${x.id}|price" value="${num(x.price)}"></td><td><input type="number" step="0.01" data-edit="merch|${x.id}|unitCost" value="${num(x.unitCost)}"></td><td><input type="number" data-edit="merch|${x.id}|goalUnits" value="${num(x.goalUnits)}"></td><td><input type="number" data-edit="merch|${x.id}|sold" value="${num(x.sold)}"></td><td class="calc">${money(revenue)}</td><td class="calc">${money(profit)}</td><td><textarea data-edit="merch|${x.id}|notes">${esc(x.notes||"")}</textarea></td><td><button class="x" data-delete="merch" data-id="${x.id}">×</button></td></tr>`}).join("");
  const products=state.merch.map(x=>`<div class="product-goal"><div><small>${esc(x.status||"Idea")}</small><b>${esc(x.product)}</b><span>${num(x.sold)} sold / ${num(x.goalUnits)} goal</span></div>${progress(num(x.sold),num(x.goalUnits),money(num(x.sold)*num(x.price))+" revenue")}</div>`).join("");
  return `<div class="grid">
    ${card("MERCH SCOREBOARD","Sales + Goals",`<div class="scoregrid"><div class="scorebox"><small>UNITS SOLD</small><b>${m.units}</b><span>${m.goalUnits} total unit goal</span></div><div class="scorebox"><small>REVENUE</small><b>${money(m.revenue)}</b><span>goal ${money(state.goals.merchRevenue)}</span></div><div class="scorebox"><small>COGS</small><b>${money(m.cost)}</b><span>product cost on sold units</span></div><div class="scorebox"><small>PROFIT</small><b>${money(m.profit)}</b><span>goal ${money(state.goals.merchProfit)}</span></div></div>`,"full")}
    ${card("PRODUCT GOALS","Drop Progress",`<div class="product-grid">${products}</div>`,"full")}
    ${card("CATALOG","Products / Drops",`<div class="tablewrap"><table class="table merch-table"><thead><tr><th>Product</th><th>Collection</th><th>Status</th><th>Price</th><th>Unit Cost</th><th>Unit Goal</th><th>Sold</th><th>Revenue</th><th>Profit</th><th>Notes</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"full",actionBtn("merch","+ PRODUCT"))}
  </div>`;
}
function renderMoney(){
  const mt=moneyTotals();
  const budgetRows=state.budget.map(x=>`<tr><td><input data-edit="budget|${x.id}|item" value="${esc(x.item||"")}"></td><td><input data-edit="budget|${x.id}|category" value="${esc(x.category||"")}"></td><td><input type="number" step="0.01" data-edit="budget|${x.id}|amount" value="${num(x.amount)}"></td><td><input data-edit="budget|${x.id}|frequency" value="${esc(x.frequency||"")}"></td><td><input data-edit="budget|${x.id}|status" value="${esc(x.status||"")}"></td><td><button class="x" data-delete="budget" data-id="${x.id}">×</button></td></tr>`).join("");
  const offsetRows=state.otherOffsets.map(x=>`<tr><td><input data-edit="otherOffsets|${x.id}|date" value="${esc(x.date||"")}"></td><td><input data-edit="otherOffsets|${x.id}|source" value="${esc(x.source||"")}"></td><td><input data-edit="otherOffsets|${x.id}|type" value="${esc(x.type||"")}"></td><td><input type="number" step="0.01" data-edit="otherOffsets|${x.id}|amount" value="${num(x.amount)}"></td><td><textarea data-edit="otherOffsets|${x.id}|notes">${esc(x.notes||"")}</textarea></td><td><button class="x" data-delete="otherOffsets" data-id="${x.id}">×</button></td></tr>`).join("");
  const goals=`<div class="goal-editor"><label>Partner value goal <input type="number" data-goal="partnerValue" value="${num(state.goals.partnerValue)}"></label><label>Merch revenue goal <input type="number" data-goal="merchRevenue" value="${num(state.goals.merchRevenue)}"></label><label>Merch profit goal <input type="number" data-goal="merchProfit" value="${num(state.goals.merchProfit)}"></label><label>Hockey cost offset goal % <input type="number" data-goal="offsetPercent" value="${num(state.goals.offsetPercent)}"></label></div>`;
  return `<div class="grid">
    ${card("THE NUMBER","Hockey Cost Offset",`<div class="offset-hero"><div><small>BRAND-FUNDED / OFFSET</small><b>${Math.round(mt.percent)}%</b><span>${money(mt.offset)} of ${money(mt.cost)} tracked hockey cost</span></div><div class="offset-breakdown"><span>Partner cash <b>${money(mt.partnerCash)}</b></span><span>Partner in-kind <b>${money(mt.partnerInKind)}</b></span><span>Merch profit <b>${money(mt.merchProfit)}</b></span><span>Other offset <b>${money(mt.other)}</b></span></div></div>${progress(mt.percent,state.goals.offsetPercent,`Target ${state.goals.offsetPercent}%`)}`,"full")}
    ${card("GOALS","Annual Brand Goals",goals,"full")}
    ${card("COSTS","Hockey / Development Spend",`<div class="tablewrap"><table class="table"><thead><tr><th>Item</th><th>Category</th><th>Amount</th><th>Frequency / Date</th><th>Status</th><th></th></tr></thead><tbody>${budgetRows}</tbody></table></div>`,"wide",actionBtn("budget","+ COST"))}
    ${card("OTHER OFFSET","Affiliate / Gift / Other Value",offsetRows?`<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Source</th><th>Type</th><th>Amount</th><th>Notes</th><th></th></tr></thead><tbody>${offsetRows}</tbody></table></div>`:empty("Use this for brand value that is not already counted in Partners or Merch."),"",actionBtn("offset","+ OFFSET"))}
  </div>`;
}
function renderNetwork(){
  const rows=state.contacts.map(x=>`<tr><td><input data-edit="contacts|${x.id}|name" value="${esc(x.name||"")}"></td><td><input data-edit="contacts|${x.id}|role" value="${esc(x.role||"")}"></td><td><input data-edit="contacts|${x.id}|organization" value="${esc(x.organization||"")}"></td><td><input data-edit="contacts|${x.id}|type" value="${esc(x.type||"")}"></td><td><textarea data-edit="contacts|${x.id}|notes">${esc(x.notes||"")}</textarea></td><td><button class="x" data-delete="contacts" data-id="${x.id}">×</button></td></tr>`).join("");
  return `<div class="grid">${card("RELATIONSHIPS","Hockey Network",`<div class="tablewrap"><table class="table"><thead><tr><th>Name / Program</th><th>Role</th><th>Organization</th><th>Type</th><th>Notes</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,"full",actionBtn("contact","+ CONTACT"))}</div>`;
}
function renderWebsite(){ return `<div class="grid">${card("DRAPERHOCKEY.COM","Website / Brand Backlog",state.web.length?`<div class="list">${state.web.map(x=>task(x,"web")).join("")}</div>`:empty(),"wide",actionBtn("web","+ TASK"))}${card("PUBLIC-SAFE RULE","What Goes Public",`<div class="quickgrid"><div class="quick"><b>PUBLIC</b><p>Edited game/training clips, development themes, brand photography, community work, sponsor content and retrospective tournament stories.</p></div><div class="quick"><b>PRIVATE</b><p>Live schedules, hotels, exact travel plans, private contacts, scouting strategy, finances and partnership negotiations.</p></div></div>`)}</div>`; }
function renderNotes(){ return `<div class="grid">${card("BRAIN DUMP","Notes",state.notes.length?`<div class="notes">${state.notes.map(x=>`<div class="note"><div class="notehead"><input data-edit="notes|${x.id}|title" value="${esc(x.title||"")}"><button class="x" data-delete="notes" data-id="${x.id}">×</button></div><textarea data-edit="notes|${x.id}|text">${esc(x.text||"")}</textarea></div>`).join("")}</div>`:empty(),"full",actionBtn("note","+ NOTE"))}</div>`; }

function render(){
  renderMetrics(); renderTabs();
  const map={dashboard:renderDashboard,roadmap:renderRoadmap,actions:renderActions,development:renderDevelopment,watchlist:renderWatchlist,film:renderFilm,social:renderSocial,partners:renderPartners,merch:renderMerch,money:renderMoney,network:renderNetwork,website:renderWebsite,notes:renderNotes};
  document.getElementById("views").innerHTML=(map[currentTab]||renderDashboard)();
  bindDynamic();
}
function bindDynamic(){
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>del(b.dataset.delete,Number(b.dataset.id)));
  document.querySelectorAll("[data-toggle]").forEach(b=>b.onchange=()=>toggle(b.dataset.toggle,Number(b.dataset.id),b.checked));
  document.querySelectorAll("[data-edit]").forEach(el=>el.onchange=()=>{const [s,id,k]=el.dataset.edit.split("|"); edit(s,Number(id),k,el.value); if(["partners","merch","budget","otherOffsets","socialAccounts","socialSnapshots"].includes(s)) render();});
  document.querySelectorAll("[data-goal]").forEach(el=>el.onchange=()=>editGoal(el.dataset.goal,el.value));
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
  if(kind==="socialAccount") return modal("Add Social Platform",field("sa1","Platform")+field("sa2","Handle")+field("sa3","Profile URL","text",true)+field("sa4","Current Followers","number")+field("sa5","Follower Goal","number")+field("sa6","Status"),()=>{state.socialAccounts.push({id:nextId(state.socialAccounts),platform:val("sa1"),handle:val("sa2"),profileUrl:val("sa3"),followers:num(val("sa4")),goal:num(val("sa5")),status:val("sa6")||"Active"});closeModal();queueSave();render()});
  if(kind==="snapshot") return modal("Add Social Snapshot",field("ss1","Date")+field("ss2","Platform")+field("ss3","Followers","number")+field("ss4","Views for Period","number")+field("ss5","Engagement")+field("ss6","Top Post / URL","text",true)+field("ss7","Top Post Views","number")+field("ss8","Notes","textarea",true),()=>{const platform=val("ss2");const followers=num(val("ss3"));state.socialSnapshots.push({id:nextId(state.socialSnapshots),date:val("ss1"),platform,followers,views:num(val("ss4")),engagement:val("ss5"),topPost:val("ss6"),topViews:num(val("ss7")),notes:val("ss8")});const account=state.socialAccounts.find(x=>String(x.platform).toLowerCase()===platform.toLowerCase());if(account&&followers)account.followers=followers;closeModal();queueSave();render()});
  if(kind==="socialPost") return modal("Add Social Post",field("sp1","Date")+field("sp2","Platform")+field("sp3","Post / Caption")+field("sp4","URL","text",true)+field("sp5","Views","number")+field("sp6","Likes","number")+field("sp7","Comments","number")+field("sp8","Shares","number")+field("sp9","Partner / Sponsor")+field("sp10","Notes","textarea",true),()=>{state.socialPosts.push({id:nextId(state.socialPosts),date:val("sp1"),platform:val("sp2"),title:val("sp3"),url:val("sp4"),views:num(val("sp5")),likes:num(val("sp6")),comments:num(val("sp7")),shares:num(val("sp8")),sponsor:val("sp9"),notes:val("sp10")});closeModal();queueSave();render()});
  if(kind==="partner") return modal("Add Partner Prospect",field("p1","Business")+field("p2","Type")+field("p3","Stage")+field("p4","Contact")+field("p5","Contact Info")+field("p6","Cash Value","number")+field("p7","In-kind Value","number")+field("p8","Deliverables / Ask","textarea",true)+field("p9","Next Follow-up")+field("p10","Next Step","textarea",true),()=>{state.partners.push({id:nextId(state.partners),business:val("p1"),type:val("p2"),stage:val("p3")||"Idea",contact:val("p4"),contactInfo:val("p5"),cashValue:num(val("p6")),inKindValue:num(val("p7")),deliverables:val("p8"),nextDate:val("p9"),next:val("p10"),value:""});closeModal();queueSave();render()});
  if(kind==="merch") return modal("Add Merch Product",field("me1","Product")+field("me2","Collection")+field("me3","Status")+field("me4","Price","number")+field("me5","Unit Cost","number")+field("me6","Unit Goal","number")+field("me7","Units Sold","number")+field("me8","Notes","textarea",true),()=>{state.merch.push({id:nextId(state.merch),product:val("me1"),collection:val("me2"),status:val("me3")||"Idea",price:num(val("me4")),unitCost:num(val("me5")),goalUnits:num(val("me6")),sold:num(val("me7")),notes:val("me8")});closeModal();queueSave();render()});
  if(kind==="budget") return modal("Add Hockey Cost",field("b1","Item")+field("b2","Category")+field("b3","Amount","number")+field("b4","Frequency / Date")+field("b5","Status"),()=>{state.budget.push({id:nextId(state.budget),item:val("b1"),category:val("b2"),amount:num(val("b3")),frequency:val("b4"),status:val("b5")||"Planning"});closeModal();queueSave();render()});
  if(kind==="offset") return modal("Add Other Offset",field("o1","Date")+field("o2","Source")+field("o3","Type")+field("o4","Amount","number")+field("o5","Notes","textarea",true),()=>{state.otherOffsets.push({id:nextId(state.otherOffsets),date:val("o1"),source:val("o2"),type:val("o3"),amount:num(val("o4")),notes:val("o5")});closeModal();queueSave();render()});
  if(kind==="web") return modal("Add Website / Brand Task",field("e1","Task","text",true)+field("e2","Category")+field("e3","Priority"),()=>{state.web.push({id:nextId(state.web),title:val("e1"),category:val("e2")||"Website",priority:val("e3")||"Medium",done:false});closeModal();queueSave();render()});
  if(kind==="note") return modal("Add Note",field("n1","Title")+field("n2","Note","textarea",true),()=>{state.notes.push({id:nextId(state.notes),title:val("n1")||"Note",text:val("n2")});closeModal();queueSave();render()});
}
function exportBackup(){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"})); a.download=`draper-command-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
async function importBackup(file){ const text=await file.text(); const incoming=JSON.parse(text); if(!incoming || typeof incoming!=="object" || Array.isArray(incoming)) throw new Error("Invalid backup file."); state={...EMPTY(),...incoming}; migrateState(); queueSave(); render(); }
async function logout(){ await fetch("/.netlify/functions/command-logout",{method:"POST"}); location.replace("/command-login/"); }

(async function boot(){
  try{
    session=await loadSession(); if(!session)return;
    document.getElementById("userEmail").textContent=session.email||"Authorized";
    const first=(session.email||"C").slice(0,1).toUpperCase();document.getElementById("logoutBtn").textContent=first;
    await loadState();
    document.getElementById("loading").remove(); document.getElementById("app").hidden=false;
    render();
    if(migratedOnLoad) setTimeout(saveNow,250);
    document.getElementById("quickAddBtn").onclick=()=>openAdd("action");
    document.getElementById("exportBtn").onclick=exportBackup;
    document.getElementById("importBtn").onclick=()=>document.getElementById("importFile").click();
    document.getElementById("importFile").onchange=async e=>{try{if(e.target.files[0])await importBackup(e.target.files[0])}catch(err){alert(err.message)}e.target.value=""};
    document.getElementById("logoutBtn").onclick=logout;
    document.getElementById("modalBack").onclick=e=>{if(e.target===e.currentTarget)closeModal()};
  }catch(err){ document.getElementById("loading").innerHTML=`<div class="loadmark">!</div><div>COMMAND CENTER COULD NOT LOAD</div>`; }
})();
