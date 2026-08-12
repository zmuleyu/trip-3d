import base64
import json
import time
import urllib.request
import websocket

DEBUGGER = "http://127.0.0.1:9333"
TARGET_URL = "http://127.0.0.1:5199/?mobile-e2e"

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

def evaluate(expression, await_promise=False):
    result = call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": await_promise})
    value = result.get("result", {})
    if value.get("subtype") == "error":
        raise RuntimeError(value.get("description"))
    return value.get("value")

call("Runtime.enable")
call("Page.enable")
call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
nonce = str(int(time.time() * 1000))
call("Page.navigate", {"url": f"{TARGET_URL}&run={nonce}"})
deadline = time.time() + 45
while time.time() < deadline:
    booted = evaluate(f"location.href.includes('run={nonce}') && !!window.__exp?.dem")
    if booted:
        break
    time.sleep(0.2)
assert booted, evaluate("({href:location.href,title:document.title,exp:!!window.__exp,body:document.body?.innerText?.slice(0,200)})")

evaluate("""(()=>{
  window.__exp.params.demLat=41.61;
  window.__exp.params.demLon=113.08;
  window.__exp.params.demZoom=10;
  window.__exp.params.demLocation='Custom';
  window.__exp.loadRealTerrain();
  return 'terrain-started';
})()""")

deadline = time.time() + 45
while time.time() < deadline:
    ready = evaluate("window.__exp.dem?.zoom===10")
    if ready:
        break
    time.sleep(0.2)
assert ready, evaluate("({dem:window.__exp.dem&&{lat:window.__exp.dem.lat,lon:window.__exp.dem.lon,zoom:window.__exp.dem.zoom},params:{lat:window.__exp.params.demLat,lon:window.__exp.params.demLon,zoom:window.__exp.params.demZoom},loading:document.querySelector('#loading')?.className})")
evaluate("document.querySelector('[data-id=admin]').click()")
deadline = time.time() + 45
while time.time() < deadline:
    ready = evaluate("!window.__exp.adminState.loading && !!window.__exp.adminState.demKey")
    if ready:
        break
    time.sleep(0.2)
assert ready, "mobile admin layer did not finish loading"
evaluate("document.querySelector('[data-id=admin]').click()")

result = evaluate("""(()=>{
  const panel=document.querySelector('.admin-panel').getBoundingClientRect();
  const inspect=document.querySelector('.admin-inspect').getBoundingClientRect();
  const levels=[...document.querySelectorAll('.admin-levels button')].map(x=>x.getBoundingClientRect().height);
  return {
    viewport:[innerWidth,innerHeight],
    media:matchMedia('(max-width:720px)').matches,
    panel:{top:panel.top,bottom:panel.bottom,height:panel.height,width:panel.width,left:panel.left,right:panel.right},
    mapVisiblePx:panel.top,
    inspectHeight:inspect.height,
    levelHeights:levels,
    overflow:panel.bottom>innerHeight||panel.left<0||panel.right>innerWidth,
    breadcrumb:window.__exp.adminState.breadcrumb,
    rings:window.__exp.adminState.rings.length
  }
})()""")

assert result["viewport"] == [390, 844], result
assert result["media"] is True, result
assert result["inspectHeight"] >= 44, result
assert min(result["levelHeights"]) >= 44, result
assert result["mapVisiblePx"] >= 250, result
assert result["overflow"] is False, result
assert result["panel"]["left"] >= 52, result
assert result["panel"]["right"] == 390, result
assert result["rings"] == 7, result

shot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
with open("collab/trip3d-l2-admin-interaction-2026-08-13/mobile-e2e.png", "wb") as handle:
    handle.write(base64.b64decode(shot["data"]))
print(json.dumps(result, ensure_ascii=False))
ws.close()
