import re

with open('tplink/soul_profile_app/app/page.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
imports = """import { readAnalyzeNdjsonStream, readAnalyzeNdjsonStreamWithEvents } from '@/lib/api/stream';
import { readDebugModeFromLocation, readUserSnapshot, persistUserSnapshot, readDebugSkipAutoLogin } from '@/lib/utils/client';
import { PrivacyNavLink } from '@/components/PrivacyNavLink';
import { FamiliarityHeart } from '@/components/FamiliarityHeart';
"""

content = content.replace("import { APP_BASE_PATH } from '@/lib/appBasePath';", "import { APP_BASE_PATH } from '@/lib/appBasePath';\n" + imports)

# 2. Remove stream functions (lines 12 to 169)
# We can use regex to match the block
pattern_stream = re.compile(r'/\*\* 解析 /api/analyze 的 NDJSON 流（服务端定时 ping，避免反代 502） \*/.*?return done;\n}\n', re.DOTALL)
content = pattern_stream.sub('', content)

# 3. Remove storage and UI functions
pattern_privacy = re.compile(r'const SESSION_USER_SNAPSHOT_KEY = \'soulmatch_user_snapshot\';\n\n/\*\* 逐渐替换 Link 的隐私跳转，确保在同一标签页内导航并支持返回 \*/\nfunction PrivacyNavLink.*?}\n', re.DOTALL)
content = pattern_privacy.sub('', content)

pattern_debug = re.compile(r'function readDebugModeFromLocation\(\): boolean \{.*?\n\}\n', re.DOTALL)
content = pattern_debug.sub('', content)

pattern_user = re.compile(r'function readUserSnapshot\(\): \{ id: string; name: string \} \| null \{.*?\n\}\n', re.DOTALL)
content = pattern_user.sub('', content)

pattern_persist = re.compile(r'function persistUserSnapshot\(user: \{ id: string; name: string \} \| null\) \{.*?\n\}\n', re.DOTALL)
content = pattern_persist.sub('', content)

pattern_skip = re.compile(r'/\*\* Debug：是否跳过自动登录（仅手动点登录） \*/\nfunction readDebugSkipAutoLogin\(\): boolean \{.*?\n\}\n', re.DOTALL)
content = pattern_skip.sub('', content)

pattern_heart = re.compile(r'function FamiliarityHeart\(\{ pct \}: \{ pct: number \}\) \{.*?\n\}\n', re.DOTALL)
content = pattern_heart.sub('', content)

with open('tplink/soul_profile_app/app/page.tsx', 'w') as f:
    f.write(content)
