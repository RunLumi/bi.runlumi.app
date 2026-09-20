const $=selector=>document.querySelector(selector);
let demo=false,persona='alpha-owner',tenantId='',dashboards=[],catalog=[],generation=0,controller;
const label={ 'quote-preparation':'Chuẩn bị báo giá','data-reconciliation':'Đối soát dữ liệu','weekly-report':'Báo cáo định kỳ' };
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;}
function format(value,unit){if(typeof value!=='number'||!Number.isFinite(value))return 'Chưa có dữ liệu';return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:unit==='hours'?1:0}).format(value)+(unit==='VND'?' ₫':unit==='hours'?' giờ':'');}
async function api(path,options={}){
 const response=await fetch(path,{...options,credentials:'same-origin',headers:{...(demo?{'x-demo-user':persona}:{}),...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await response.json();if(!response.ok)throw new Error(`${data.error?.code??'Không đọc được dữ liệu'} · ${data.error?.requestId??''}`);return data;
}
function message(text,error=false){$('#message').textContent=text;$('#message').className=error?'error':'';}
async function session(){
 controller?.abort();controller=new AbortController();const current=++generation;$('#widgets').replaceChildren();$('#source-list').replaceChildren();$('#metric-list').replaceChildren();$('#watermark').textContent='Đang xác thực...';$('#editor').hidden=true;$('#duplicate').hidden=true;
 const data=await api('/api/session',{signal:controller.signal});if(current!==generation)return;demo=data.demo;$('#demo-controls').hidden=!demo;
 $('#dataset-label').textContent=demo?'Dữ liệu minh họa, không phải case study':'Dữ liệu doanh nghiệp';
 $('#tenant').replaceChildren(...data.tenants.map(t=>{const o=el('option',t.name);o.value=t.id;o.dataset.role=t.role;return o;}));
 tenantId=data.tenants[0]?.id??'';if(!tenantId){message('Tài khoản chưa có quyền truy cập doanh nghiệp.',true);return;}
 await loadTenant();
}
async function loadTenant(){
 controller?.abort();controller=new AbortController();const current=++generation;const signal=controller.signal;$('#widgets').replaceChildren();$('#source-list').replaceChildren();$('#metric-list').replaceChildren();$('#watermark').textContent='Đang kiểm tra nguồn...';$('#editor').hidden=true;$('#duplicate').hidden=true;
 tenantId=$('#tenant').value;
 const [d,m]=await Promise.all([api(`/api/tenants/${tenantId}/dashboards`,{signal}),api(`/api/tenants/${tenantId}/metrics`,{signal})]);if(current!==generation)return;
 dashboards=d.dashboards;catalog=m.metrics;
 $('#dashboard').replaceChildren(...dashboards.map(d=>{const o=el('option',d.definition.title);o.value=d.id;return o;}));
 const editable=$('#tenant').selectedOptions[0]?.dataset.role!=='viewer';$('#editor').hidden=!editable;$('#duplicate').hidden=!editable;
 for(const metric of catalog){const item=el('article');item.append(el('h3',metric.label),el('p',metric.definition),el('code',metric.id));$('#metric-list').append(item);}
 await render();
}
async function render(){
 controller?.abort();controller=new AbortController();const signal=controller.signal;const current=++generation;
 const selected=dashboards.find(d=>d.id===$('#dashboard').value);if(!selected){$('#widgets').replaceChildren();message('Chưa có bảng điều khiển trong doanh nghiệp này.');return;}
 $('#config').value=JSON.stringify(selected.definition,null,2);$('#widgets').replaceChildren();$('#widgets').setAttribute('aria-busy','true');message('Đang đọc snapshot và đối chiếu định nghĩa...');
 try{
  const promises=selected.definition.widgets.map(async w=>({w,r:await api(`/api/tenants/${tenantId}/query`,{method:'POST',body:JSON.stringify({metrics:w.metrics,groupBy:w.groupBy,from:$('#from').value,to:$('#to').value}),signal})}));
  const values=await Promise.all(promises);if(current!==generation)return;
  const fingerprints=values.map(({r})=>JSON.stringify([r.meta.tenantId,r.meta.definitionVersion,r.meta.from,r.meta.toExclusive,r.meta.provenance.map(p=>[p.source_id,p.id,p.content_hash])]));
  if(new Set(fingerprints).size>1)throw new Error('Snapshot vừa thay đổi trong lúc tải. Hãy cập nhật lại để các biểu đồ dùng cùng dữ liệu.');
  for(const {w,r}of values){const card=el('article',undefined,`widget ${w.kind}`);card.append(el('h2',w.title));
   const metric=catalog.find(m=>m.id===w.metrics[0]);
   if(w.kind==='kpi'){const noData=r.meta.noPublishedData||!r.data.length||!r.data[0].matched_rows;card.append(el('strong',noData?'Chưa có dữ liệu':format(r.data[0][w.metrics[0]],metric?.unit),'kpi-value'));card.append(el('p',metric?.definition??'','metric-hint'));}
   if(w.kind==='bar'){const max=Math.max(1,...r.data.map(row=>Math.abs(row[w.metrics[0]])));for(const row of r.data){const line=el('div',undefined,'bar-row');line.append(el('span',label[row.dimension]??row.dimension),el('strong',format(row[w.metrics[0]],metric?.unit)));const bar=el('meter');bar.min=Math.min(0,...r.data.map(x=>x[w.metrics[0]]));bar.max=max;bar.value=row[w.metrics[0]];bar.setAttribute('aria-label',String(row.dimension));line.append(bar);card.append(line);}}
   if(w.kind==='table'){const wrap=el('div',undefined,'table-scroll'),table=el('table'),thead=el('thead'),head=el('tr');for(const name of ['Quy trình',...w.metrics.map(id=>catalog.find(m=>m.id===id)?.label??id)]){const th=el('th',name);th.scope='col';head.append(th);}thead.append(head);table.append(thead);const body=el('tbody');for(const row of r.data){const tr=el('tr');const th=el('th',label[row.dimension]??row.dimension??'Tổng');th.scope='row';tr.append(th);for(const name of w.metrics)tr.append(el('td',format(row[name],catalog.find(m=>m.id===name)?.unit)));body.append(tr);}table.append(body);wrap.append(table);card.append(wrap);}
   $('#widgets').append(card);
  }
  const meta=values[0]?.r.meta;$('#source-list').replaceChildren();
  if(meta?.provenance.length){$('#watermark').textContent=`Dữ liệu đến ${meta.provenance.map(p=>p.observed_through).sort()[0]} · Múi giờ báo cáo: TP.HCM`;for(const p of meta.provenance){const item=el('article',undefined,'source');item.append(el('strong',p.source_id),el('span',`Quan sát đến ${p.observed_through}`),el('small',`Snapshot ${p.id.slice(0,12)} · SHA-256 ${p.content_hash.slice(0,16)}…`));$('#source-list').append(item);}}
  else{$('#watermark').textContent='Chưa có snapshot được công bố';$('#source-list').append(el('p','Chưa có dữ liệu. Không diễn giải thành kết quả kinh doanh bằng 0.'));}
  message(`Đã đọc ${selected.definition.widgets.length} khối dữ liệu · cấu hình v${selected.revision}. Khoảng thời gian có cận trên không bao gồm.`);
 }catch(error){if(error.name!=='AbortError'&&current===generation){$('#widgets').replaceChildren();message(error.message,true);}}
 finally{if(current===generation)$('#widgets').setAttribute('aria-busy','false');}
}
$('#refresh').onclick=()=>render();$('#dashboard').onchange=()=>render();
$('#tenant').onchange=()=>loadTenant().catch(e=>{if(e.name!=='AbortError')message(e.message,true);});
$('#persona').onchange=()=>{persona=$('#persona').value;session().catch(e=>{if(e.name!=='AbortError')message(e.message,true);});};
$('#save').onclick=async()=>{try{const current=generation;const selected=dashboards.find(d=>d.id===$('#dashboard').value);if(!selected)return;const definition=JSON.parse($('#config').value);const updated=await api(`/api/tenants/${tenantId}/dashboards/${selected.id}`,{method:'PUT',headers:{'if-match':`"${selected.revision}"`},body:JSON.stringify(definition)});if(current!==generation)return;Object.assign(selected,updated);$('#dashboard').selectedOptions[0].textContent=updated.definition.title;await render();}catch(e){message(e.message,true);}};
$('#duplicate').onclick=async()=>{try{const current=generation;const selected=dashboards.find(d=>d.id===$('#dashboard').value);if(!selected)return;const definition=structuredClone(selected.definition);definition.title+=' · bản sao';const result=await api(`/api/tenants/${tenantId}/dashboards`,{method:'POST',body:JSON.stringify({id:`dashboard-${Date.now()}`,definition})});if(current!==generation)return;dashboards.push(result);const o=el('option',result.definition.title);o.value=result.id;$('#dashboard').append(o);$('#dashboard').value=result.id;await render();}catch(e){message(e.message,true);}};
session().catch(e=>message(e.message,true));
