"""Regression sweep: auto-plays a set of stages headless and fails if any stage does not clear within the time budget.

Usage (from the repo root):
  1. Build with the test hook (adds window.__sim):
       cp src/game/input.ts /tmp/input.bak
       echo "import * as SIMDBG from './sim'; (window as any).__sim = SIMDBG" >> src/game/input.ts
       /home/claude/tools/build.sh
  2. python3 tests/stage_sweep.py
  3. Restore and rebuild: cp /tmp/input.bak src/game/input.ts && /home/claude/tools/build.sh
Requires Playwright with the pre-installed Chromium at /opt/pw-browsers/chromium.
"""
import asyncio, sys
from playwright.async_api import async_playwright

STAGES = [1, 3, 6, 9, 11, 15, 19, 21, 24, 26]
BUDGET_S = 300            # simulated seconds allowed per stage
GAME = 'file:///home/claude/idle-guardians.html'

RUN = """((st)=>{const s=__sim,G=s.G;const w=(k)=>Math.max(0,Math.min(12,Math.floor(st*k)));
  const bench=[w(0.8)+1,w(0.7)+1,w(0.6)+1,w(0.6),w(0.5)+1,w(0.5),w(0.4)+1,w(0.4)].map(v=>Math.min(12,v));
  localStorage.setItem('ig_save',JSON.stringify({gold:1e9,stage:st,bs:st,best:st,bought:50,bench,maxLevel:st,stash:0,t:Date.now()}));
  s.load(); G.stage=st; s.startStage(); G.auto={on:true,shield:true,frenzy:true,nade:true,tank:true,panic:true};
  let i=0; for(;i<60*BUDGET_S;i++){ s.update(1/60); if(G.hp.every(h=>h<=0))G.hp=G.mhp.slice(); if(G.stage!==st)break }
  return {st, secs: Math.round(i/60), advanced: G.stage!==st, left: G.enemies.length}})(%d)"""

async def main():
    failed = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
        # Fresh browser context per stage so state from one run cannot leak into the next.
        for st in STAGES:
            c = await b.new_context(viewport={'width': 400, 'height': 800}, is_mobile=True, has_touch=True)
            await c.add_init_script("localStorage.setItem('ig_tut','1')")
            pg = await c.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(GAME); await pg.wait_for_timeout(2500)
            r = await pg.evaluate(RUN.replace("BUDGET_S", str(BUDGET_S)) % st)
            ok = r['advanced'] and not errs and r['secs'] < BUDGET_S
            print(('PASS' if ok else 'FAIL'), r, errs[:2], flush=True)
            if not ok: failed.append(st)
            await c.close()
        await b.close()
    if failed: print('failed stages:', failed); sys.exit(1)
    print('all stages cleared within budget')

asyncio.run(main())
