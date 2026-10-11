#!/bin/bash
# build + inline game into /home/claude/idle-guardians.html and the artifact fragment
cd /home/claude/idle-guardians-claude2 && export npm_config_noproxy="" && npx tsc -p tsconfig.app.json --noEmit && npx vite build 2>&1 | tail -1 && python3 - <<'PY'
import re
h=open('dist/app.html').read()
css=''.join(open('dist'+m).read() for m in re.findall(r'href="(/assets/[^"]+\.css)"',h))
js=''.join(open('dist'+m).read() for m in re.findall(r'src="(/assets/[^"]+\.js)"',h))
h=re.sub(r'<link[^>]*stylesheet[^>]*>','',h); h=re.sub(r'<script[^>]*src=[^>]*></script>','',h)
inl=h.replace('</head>','<style>'+css+'</style></head>')
h=inl.replace('</body>','<script>'+js.replace('</script>','<\\/script>')+'</script></body>')
import zlib
loader="""<script>
fetch('game.js?v=%s').then(function(r){ showErr('game.js HTTP '+r.status+' '+r.headers.get('content-type')); return r.text() }).then(function(t){
  showErr('game.js bytes='+t.length)
  try { var s=document.createElement('script'); s.textContent=t; document.body.appendChild(s); showErr('executed; stage='+window.__igStage) } catch(e) { showErr('run threw: '+(e&&e.message)) }
}).catch(function(e){ showErr('fetch failed: '+e) })
</script>""" % zlib.crc32(js.encode())
ext=inl.replace('</body>',loader+'</body>')
import os
os.makedirs('/home/claude/idle-guardians-claude2/play',exist_ok=True)
for d in ('docs','.','play'):
    open('/home/claude/idle-guardians-claude2/'+d+'/index.html','w').write(ext)
    open('/home/claude/idle-guardians-claude2/'+d+'/game.js','w').write(js)
open('/home/claude/idle-guardians-claude2/docs/game.js','w').write(js)
import os
os.makedirs('/home/claude/idle-guardians-claude2/docs/play',exist_ok=True)
open('/home/claude/idle-guardians-claude2/docs/play/index.html','w').write(ext)
open('/home/claude/idle-guardians-claude2/docs/play/game.js','w').write(js)
open('/home/claude/idle-guardians.html','w').write(h)
css=re.findall(r'<style>(.*?)</style>',h,re.S)[0]; b=re.search(r'<body[^>]*>(.*)</body>',h,re.S).group(1)
open('/tmp/claude-0/-home-claude/bb4a0b91-ab13-54ff-a753-3965443f1142/scratchpad/idle-guardians-artifact.html','w').write('<title>Woof Wars</title>\n<style>'+css+'</style>\n'+b)
PY
