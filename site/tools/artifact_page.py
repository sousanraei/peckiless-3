"""Build the Artifact version of index.html.

The Artifact host wraps the published page in its own <!doctype>/<html>/<head>/
<body> skeleton, so this strips those wrappers and keeps everything inside.
Usage: python3 tools/artifact_page.py OUT.html   (run from site/)
"""
import re, sys

src = open('index.html', encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body[^>]*>(.*?)</body>', src, re.S).group(1)
# The skeleton already sets charset + viewport (with viewport-fit=cover).
head = re.sub(r'\s*<meta (charset|name="viewport")[^>]*>', '', head)
out = head.strip() + '\n' + body.strip() + '\n'
open(sys.argv[1], 'w', encoding='utf-8').write(out)
print(f'wrote {sys.argv[1]} ({len(out)} bytes)')
