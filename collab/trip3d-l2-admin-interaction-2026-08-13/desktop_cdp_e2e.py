import json
import time
import urllib.request
import websocket

DEBUGGER = "http://127.0.0.1:9333"
TARGET_URL = "http://127.0.0.1:5199/?desktop-e2e"

with urllib.request.urlopen(f"{DEBUGGER}/json/list", timeout=5) as response:
    targets = json.load(response)
target = next(item for item in targets if item.get("type") == "page")
ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=60, suppress_origin=True)
next_id = 0

def call(method, params=None):
    global next_id
    next_id += 1
    current = next_id
    ws.send(json.dumps({"id": current, "method": method, "params": params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get("id") == current:
            if "error" in message:
                raise RuntimeError(message["error"])
            return message.get("result", {})

def evaluate(expression):
    value = call("Runtime.evaluate", {"expression": expression, "returnByValue": True}).get("result", {})
    if value.get("subtype") == "error":
        raise RuntimeError(value.get("description"))
    return value.get("value")

def wait_for(expression, timeout=45):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if evaluate(expression):
            return
        time.sleep(0.2)
    raise AssertionError(evaluate("({href:location.href,dem:window.__exp?.dem,admin:window.__exp?.adminState})"))

call("Runtime.enable")
call("Page.enable")
call("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 720, "deviceScaleFactor": 1, "mobile": False})
nonce = str(int(time.time() * 1000))
call("Page.navigate", {"url": f"{TARGET_URL}&run={nonce}"})
wait_for(f"location.href.includes('run={nonce}') && !!window.__exp?.dem")
evaluate("window.__exp.params.demLat=41.61;window.__exp.params.demLon=113.08;window.__exp.params.demZoom=10;window.__exp.params.demLocation='Custom';window.__exp.loadRealTerrain()")
wait_for("window.__exp.dem?.zoom===10")
evaluate("document.querySelector('[data-id=admin]').click()")
wait_for("!window.__exp.adminState.loading && window.__exp.adminState.rings.length===7")
evaluate("document.querySelector('[data-id=admin]').click()")

base = evaluate("""(()=>({
  panelOpen:!document.querySelector('.admin-panel').classList.contains('hidden'),
  breadcrumb:window.__exp.adminState.breadcrumb,
  rings:window.__exp.adminState.rings.length,
  regions:window.__exp.adminState.regions.length,
  children:window.__exp.adminLayer.group.children.length,
  lineColors:window.__exp.adminLayer.group.children.filter(x=>x.userData.kind==='boundary').map(x=>'#'+x.material.color.getHexString()),
  labelBackground:Array.from(document.querySelectorAll('.admin-crumb')).map(x=>getComputedStyle(x).backgroundColor)
}))()""")
assert base["panelOpen"] and base["rings"] == 7 and base["regions"] >= 20 and base["children"] == 14, base
assert "#6d8795" in base["lineColors"], base

evaluate("document.querySelector('[data-level=district]').click();document.querySelector('[data-action=inspect]').click();window.__exp.params.planning=true")
select = evaluate("""(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,before=window.__exp.route.waypoints.length;c.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,button:0,bubbles:true,pointerId:88}));c.dispatchEvent(new PointerEvent('pointerup',{clientX:x,clientY:y,button:0,bubbles:true,pointerId:88}));return {before,after:window.__exp.route.waypoints.length,selected:window.__exp.adminInteraction.selected?.name,inspect:window.__exp.adminInteraction.inspecting,level:window.__exp.adminInteraction.level,visibleLevels:[...new Set(window.__exp.adminLayer.group.children.filter(x=>x.visible).map(x=>x.userData.level))]}})()""")
assert select["before"] == select["after"] and select["selected"] and select["visibleLevels"] == ["district"], select

evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
escape = evaluate("({inspect:window.__exp.adminInteraction.inspecting,selected:window.__exp.adminInteraction.selected,body:document.body.classList.contains('admin-inspecting')})")
assert escape == {"inspect": False, "selected": None, "body": False}, escape

evaluate("window.__exp.params.demZoom=12;window.__exp.loadRealTerrain()")
wait_for("window.__exp.dem?.zoom===12")
wait_for("!window.__exp.adminState.loading && window.__exp.adminState.demKey.includes('12x3')")
empty = evaluate("({rings:window.__exp.adminState.rings.length,hidden:document.querySelector('.admin-empty').classList.contains('hidden'),text:document.querySelector('.admin-empty').textContent})")
assert empty["rings"] == 0 and empty["hidden"] is False and "当前视图完全位于" in empty["text"], empty

print(json.dumps({"base": base, "select": select, "escape": escape, "empty": empty}, ensure_ascii=False))
ws.close()
