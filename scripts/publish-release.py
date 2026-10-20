import urllib.request
import json
import os

TOKEN = os.environ.get('GITHUB_TOKEN', '')
REPO = 'Hamza35779/Intelligent-TimeTable-Engine'
TAG = 'v1.0.0'

headers = {
    'Authorization': f'token {TOKEN}',
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Python'
}

body_text = """## Intelligent Timetable Engine v1.0.0

### What is Included
- **Android APK Package**: Download `intelligent-timetable.apk` below and install directly on any Android smartphone or tablet.
- **Enterprise Scheduling Solver**: Google OR-Tools CP-SAT engine for mathematical conflict-free timetabling.
- **Interactive Visual Builder**: Real-time clash detection, drag-and-drop interface, and quick CSV data imports.
- **Voice-Driven Command Engine**: Natural language schedule navigation and voice controls.
- **Export System**: Export schedules to Excel (XLSX), CSV, JSON, and PDF formats.

### Mobile App Installation:
1. Download `intelligent-timetable.apk` from the Assets list below.
2. Open the file on your Android device.
3. Allow *Install from unknown sources* if prompted.
"""

# Check if release already exists
req_get = urllib.request.Request(
    f'https://api.github.com/repos/{REPO}/releases/tags/{TAG}',
    headers=headers
)
release_data = None
try:
    with urllib.request.urlopen(req_get) as resp:
        release_data = json.loads(resp.read().decode())
        print(f"Existing release found: {release_data['html_url']}")
except Exception:
    pass

if not release_data:
    release_payload = {
        'tag_name': TAG,
        'target_commitish': 'main',
        'name': 'Intelligent Timetable Engine v1.0.0 (Android APK & Web Engine)',
        'body': body_text,
        'draft': False,
        'prerelease': False
    }

    req_create = urllib.request.Request(
        f'https://api.github.com/repos/{REPO}/releases',
        data=json.dumps(release_payload).encode('utf-8'),
        headers=headers,
        method='POST'
    )

    with urllib.request.urlopen(req_create) as resp:
        release_data = json.loads(resp.read().decode())
        print(f"Release created: {release_data['html_url']}")

upload_url_template = release_data['upload_url']
upload_url = upload_url_template.split('{')[0] + '?name=intelligent-timetable.apk'

apk_path = os.path.join(r'd:\My Softwares\Time Table Generator', 'mobile-apk', 'intelligent-timetable.apk')
with open(apk_path, 'rb') as f:
    apk_bytes = f.read()

upload_headers = {
    'Authorization': f'token {TOKEN}',
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Length': str(len(apk_bytes)),
    'User-Agent': 'Python'
}

upload_req = urllib.request.Request(upload_url, data=apk_bytes, headers=upload_headers, method='POST')
try:
    with urllib.request.urlopen(upload_req) as upload_resp:
        asset_data = json.loads(upload_resp.read().decode())
        print(f"Asset uploaded: {asset_data['name']} ({round(asset_data['size'] / (1024*1024), 2)} MB)")
        print(f"Direct download URL: {asset_data['browser_download_url']}")
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8', errors='ignore')
    print("Upload error:", e.code, err_body)
