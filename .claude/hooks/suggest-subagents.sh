#!/usr/bin/env bash
# UserPromptSubmit hook: voltagent-subagents 플러그인 중 이 프론트 레포(Next.js/React/TS)에
# 맞는 서브에이전트를 안내한다. 핵심 3개는 매번, 상황별 4개는 키워드 매칭 시에만 붙인다.
set -euo pipefail

prompt=$(jq -r '.prompt // empty' | tr '[:upper:]' '[:lower:]')

match() {
  grep -qiE "$1" <<<"$prompt"
}

situational=""
if match "인증|로그인|로그아웃|oauth|jwt|토큰|리프레시|refresh.?token|\bauth\b"; then
  situational+=$'\n- 인증/OAuth 작업 → voltagent-core-dev:auth-integration-engineer'
fi
if match "디자인|스타일|tailwind|다크\s?모드|디자인\s?시스템|\bui\b"; then
  situational+=$'\n- UI/디자인 시스템 작업 → voltagent-core-dev:ui-designer'
fi
if match "접근성|a11y|aria|스크린\s?리더|screen.?reader|wcag|키보드\s?접근"; then
  situational+=$'\n- 접근성 점검 → voltagent-qa-sec:accessibility-tester'
fi
if match "테스트|\btest\b|vitest|playwright|e2e|단위\s?테스트"; then
  situational+=$'\n- 테스트 작성/자동화 → voltagent-qa-sec:test-automator'
fi

message="[voltagent-subagents] 핵심: nextjs-developer, react-specialist, typescript-pro"
if [ -n "$situational" ]; then
  message+=$'\n상황별 추천:'"$situational"
fi

jq -n --arg msg "$message" '{systemMessage: $msg}'
