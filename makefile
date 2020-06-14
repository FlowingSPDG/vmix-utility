# Go
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
BINARY_NAME=vmix_gen
DIST_DIR=build
SERVER_DIR=server
WEB_DIR=web

# Replacing "RM" command for Windows PowerShell.
RM = rm -rf
ifeq ($(OS),Windows_NT)
    RM = Remove-Item -Recurse -Force
endif

# Replacing "MKDIR" command for Windows PowerShell.
MKDIR = mkdir -p
ifeq ($(OS),Windows_NT)
    MKDIR = New-Item -ItemType Directory
endif

# Replacing "CP" command for Windows PowerShell.
CP = cp -R
ifeq ($(OS),Windows_NT)
	CP = powershell -Command Copy-Item -Recurse -Force
endif

# Replacing "GOPATH" command for Windows PowerShell.
GOPATHDIR = $GOPATH
ifeq ($(OS),Windows_NT)
    GOPATHDIR = $$env:GOPATH
endif

.DEFAULT_GOAL := build-windows

test:
	$(GOTEST) -v ./...
clean:
	@$(GOCLEAN)
	-@$(RM) $(DIST_DIR)/*
deps: deps-web deps-go
deps-web:
	@yarn global add @vue/cli
	@cd ./web && yarn
deps-go:
	@cd ./server && $(GOGET) -v -u
build-prepare:
	@cd ./server && $(GOGET) github.com/mitchellh/gox \
	github.com/konsorten/go-windows-terminal-sequences
	-@$(RM) ./$(DIST_DIR)/*/static
build-windows: build-prepare build-web build-windows-server-only
	@$(MKDIR) ./$(DIST_DIR)/static
	@$(CP) ./web/dist/* ./$(DIST_DIR)/static
build-windows-server-only: build-prepare
	@cd ./server && GOOS=windows GOARCH=386 go build -o ../$(DIST_DIR)/${BINARY_NAME}.exe main.go
build-web:
	@cd ./web && yarn run build