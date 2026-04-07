import re

with open('tplink/soul_profile_app/app/page.tsx', 'r') as f:
    content = f.read()

# Remove types
content = re.sub(r'type AnalyzeStageEvent = \{.*?\};\n', '', content, flags=re.DOTALL)
content = re.sub(r'type AnalyzeStageDurationEvent = \{.*?\};\n', '', content, flags=re.DOTALL)
content = re.sub(r'type StageTimelineEntry = AnalyzeStageDurationEvent & \{ timestamp: number \};\n', '', content, flags=re.DOTALL)

# Remove readAnalyzeNdjsonStreamWithEvents
content = re.sub(r'async function readAnalyzeNdjsonStreamWithEvents\(.*?return done;\n}\n', '', content, flags=re.DOTALL)

with open('tplink/soul_profile_app/app/page.tsx', 'w') as f:
    f.write(content)
