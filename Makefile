# Makefile

# 설정 부분
HARBOR_REGISTRY = infra-harbor.test.com
PROJECT = app
IMAGE_NAME = server

# git short sha 가져오기
GIT_SHA := $(shell git rev-parse --short HEAD)

# 기본 목표 (make만 치면 build)
.PHONY: all
all: build push

# Build
.PHONY: build
build:
	docker build --platform linux/amd64 --build-arg APP_NAME=identity \
	             -t $(HARBOR_REGISTRY)/$(PROJECT)/$(IMAGE_NAME):$(GIT_SHA) \
	             -t $(HARBOR_REGISTRY)/$(PROJECT)/$(IMAGE_NAME):latest .

# Login
.PHONY: login
login:
	docker login $(HARBOR_REGISTRY)

# Push
.PHONY: push
push:
	docker push $(HARBOR_REGISTRY)/$(PROJECT)/$(IMAGE_NAME):$(GIT_SHA)
	docker push $(HARBOR_REGISTRY)/$(PROJECT)/$(IMAGE_NAME):latest

# Clean local images
.PHONY: clean
clean:
	docker rmi $(HARBOR_REGISTRY)/$(PROJECT)/$(IMAGE_NAME):$(GIT_SHA) || true
	docker rmi $(HARBOR_REGISTRY)/$(PROJECT)/$(IMAGE_NAME):latest || true
