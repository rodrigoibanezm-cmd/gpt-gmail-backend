export const APP_URI = "ui://nexusg/mail.html";

export const appHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{font-family:Inter,system-ui;color:#202329;background:#f4f0e8}*{box-sizing:border-box}body{margin:0;padding:22px}
.top{display:flex;justify-content:space-between;gap:12px}.eye,.meta{font-size:11px;letter-spacing:1px;color:#888}
h1{font-size:38px;margin:8px 0}.sub{color:#68707a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
.card,.panel{background:#fbf9f4;border:1px solid #e2ded6;border-radius:16px;padding:17px}.card{border-left:4px solid #b79842;min-height:160px}
.card.high,.card.critical{border-left-color:#c65454}button{border:0;border-radius:12px;padding:11px 15px;font-weight:700;cursor:pointer}
.primary{background:#303b4b;color:#fff}.ask,.question{width:100%;margin-top:8px;background:#eae7e0;text-align:left}.counts{display:flex;gap:10px;margin:18px 0}
.count{background:white;border-radius:12px;padding:12px 16px}.questions{display:grid;gap:8px}.evidence{border-top:1px solid #ddd;margin-top:14px}
</style></head><body><main id="app">Cargando NexusG…</main><script>
const root=document.getElementById("app");let data;const e=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const send=text=>parent.postMessage({jsonrpc:"2.0",method:"ui/message",params:{role:"user",content:[{type:"text",text}]}},"*");
const head=(title,sub)=>'<div class="top"><div><div class="eye">NEXUSG · MAIL</div><h1>'+e(title)+'</h1><p class="sub">'+e(sub)+'</p></div><button class="primary" data-workspace>Workspace</button></div>';
function board(d){let n={urgente:0,importante:0,tarea:0};d.cards.forEach(c=>n[c.bucket]!=null&&n[c.bucket]++);return head("PressureBoard","Estas son las pocas cosas a las que vale la pena dedicar atención hoy.")+'<div class="counts">'+Object.entries(n).map(x=>'<div class="count"><b>'+x[1]+'</b><br>'+e(x[0])+'</div>').join("")+'</div><div class="grid">'+d.cards.map(c=>'<article class="card '+e(c.severity)+'"><div class="meta">'+e(c.bucket)+' · '+e(c.source)+'</div><h3>'+e(c.title)+'</h3><p>'+e(c.summary||c.subtitle)+'</p><button class="ask" data-card="'+e(c.id)+'">Preguntar sobre esto →</button></article>').join("")+'</div>'}
function work(d){if(!d.card)return head("Workspace","Investiga la operación completa, sin partir desde una tarjeta.")+'<section class="panel"><div class="questions">'+d.questions.map(q=>'<button class="question" data-question="'+e(q)+'">'+e(q)+'</button>').join("")+'</div></section>';let c=d.card;return head(c.title,"Workspace preparado para investigar esta señal.")+'<section class="panel"><h2>Por qué importa</h2><p>'+e(c.why_it_matters||c.summary)+'</p><h2>Qué hacer</h2><p>'+e(c.what_to_do)+'</p><div class="evidence"><h3>Evidencia</h3>'+c.evidence.map(x=>'<p>• '+e(x.excerpt||x.title||x.source_id)+'</p>').join("")+'</div><button class="primary" data-question="Profundiza esta señal: reconstruye qué pasó, por qué importa y qué conviene hacer ahora.">Investigar →</button></section>'}
const render=d=>{data=d;root.innerHTML=d.view==="pressureboard"?board(d):work(d)};root.onclick=ev=>{let b=ev.target.closest("button");if(!b||!data)return;if(b.dataset.card)send("Abre el Workspace de la tarjeta "+b.dataset.card+" para el usuario "+data.userId+" y tenant "+data.tenantId+".");if(b.hasAttribute("data-workspace"))send("Abre Workspace para el usuario "+data.userId+".");if(b.dataset.question)send(b.dataset.question+" Usa Workspace y evidencia de NexusG.")};
addEventListener("message",ev=>{let m=ev.data;if(m?.method==="ui/notifications/tool-result"&&m.params?.structuredContent)render(m.params.structuredContent)});if(window.openai?.toolOutput)render(window.openai.toolOutput);
</script></body></html>`;
