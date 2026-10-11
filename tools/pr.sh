#!/bin/bash
# usage: pr.sh <branch> <title> <bodyfile> ; commits, pushes, opens PR, merges
cd /home/claude/idle-guardians-claude2
BR=$1; TITLE=$2; BODY=$3
python3 - "$BR" "$TITLE" "$BODY" <<'PY'
import json,sys
br,title,bf=sys.argv[1:4]
body=open(bf).read()+"\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nhttps://claude.ai/code/session_019ZrmjdJQwc5wfcshxDCkrX"
json.dump({"title":title,"head":br,"base":"main","body":body},open('/tmp/prx.json','w'))
PY
git add -A && git commit -qm "$TITLE" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019ZrmjdJQwc5wfcshxDCkrX" && timeout 60 git push -q -u origin $BR 2>&1 | tail -1
n=$(timeout 60 gh api repos/BrutalPeanut/idle-guardians-claude2/pulls --input /tmp/prx.json --jq .number)
# merge locally so the merge commit is authored/committed by Claude (GitHub-made merges show Unverified)
git checkout -q main && timeout 60 git pull -q origin main 2>&1 | tail -1
git merge -q --no-ff $BR -m "Merge pull request #$n from BrutalPeanut/$BR" -m "$TITLE" && timeout 60 git push -q origin main 2>&1 | tail -1
timeout 60 git fetch -q -f origin main:refs/remotes/origin/main
