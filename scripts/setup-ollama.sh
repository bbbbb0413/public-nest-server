#!/bin/bash
# Ollama 로컬 설치 및 모델 다운로드 스크립트
# 사용법: bash scripts/setup-ollama.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup-ollama]${NC} $1"; }
warn() { echo -e "${YELLOW}[setup-ollama]${NC} $1"; }
err()  { echo -e "${RED}[setup-ollama]${NC} $1"; }

# ── 1. Ollama 설치 확인 ───────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  log "Ollama 이미 설치됨: $(ollama --version)"
else
  warn "Ollama 미설치. Homebrew로 설치합니다..."
  if ! command -v brew &>/dev/null; then
    err "Homebrew가 없습니다. https://brew.sh 에서 먼저 설치해주세요."
    exit 1
  fi
  brew install ollama
  log "Ollama 설치 완료"
fi

# ── 2. Ollama 서버 실행 ───────────────────────────────────────────────────────
if curl -s http://localhost:11434/api/tags &>/dev/null; then
  log "Ollama 서버 이미 실행 중"
else
  log "Ollama 서버 시작 중..."
  ollama serve &>/tmp/ollama.log &
  OLLAMA_PID=$!
  sleep 3

  if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    err "Ollama 서버 시작 실패. /tmp/ollama.log 확인하세요."
    exit 1
  fi
  log "Ollama 서버 시작 완료 (PID: $OLLAMA_PID)"
fi

# ── 3. 모델 다운로드 ──────────────────────────────────────────────────────────
LLM_MODEL="${OLLAMA_MODEL:-qwen2.5:14b}"
EMBED_MODEL="${OLLAMA_EMBEDDING_MODEL:-bge-m3}"

log "LLM 모델 다운로드: $LLM_MODEL"
ollama pull "$LLM_MODEL"

log "임베딩 모델 다운로드: $EMBED_MODEL"
ollama pull "$EMBED_MODEL"

# ── 4. 동작 확인 ─────────────────────────────────────────────────────────────
log "모델 동작 확인 중..."

EMBED_TEST=$(curl -s http://localhost:11434/api/embeddings \
  -d "{\"model\": \"$EMBED_MODEL\", \"prompt\": \"test\"}" \
  | grep -c '"embedding"' || true)

if [ "$EMBED_TEST" -gt 0 ]; then
  log "임베딩 모델 정상 동작 확인"
else
  warn "임베딩 모델 응답 확인 실패. 서버 로그를 확인하세요."
fi

# ── 5. 설치된 모델 목록 출력 ──────────────────────────────────────────────────
echo ""
log "설치된 모델 목록:"
ollama list

echo ""
log "설정 완료! .env 파일에 아래 내용을 추가하세요:"
echo ""
echo "  LLM_PROVIDER=ollama"
echo "  EMBEDDING_PROVIDER=ollama"
echo "  OLLAMA_BASE_URL=http://localhost:11434"
echo "  OLLAMA_MODEL=$LLM_MODEL"
echo "  OLLAMA_EMBEDDING_MODEL=$EMBED_MODEL"
echo ""
warn "※ MongoDB Atlas Vector Search 없이 로컬 테스트할 경우:"
warn "  MONGODB_VECTOR_URI=mongodb://root:root@localhost:27017"
warn "  docker compose -f docker/docker-compose.ai.yml up mongo -d"
