# Go
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOINSTALL=$(GOCMD) install
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

.DEFAULT_GOAL := build

test:
	$(GOTEST) -v ./...
clean:
	@$(GOCLEAN)
	-@$(RM) $(DIST_DIR)/*
deps: deps-web
deps-web:
	@git submodule init
	@git submodule update
	@yarn global add @vue/cli
	@cd ./web && yarn
build-prepare: clean
	@$(GOINSTALL) github.com/mitchellh/gox@v1.0.1
build: build-prepare build-web build-server-only
build-server-only: build-prepare
	@cd ./server && gox --osarch "windows/amd64 darwin/amd64 linux/amd64" --output ../$(DIST_DIR)/${BINARY_NAME}_{{.OS}}_{{.Arch}} ./
build-web:
	@cd ./web && yarn run build
	@$(MKDIR) ./$(SERVER_DIR)/static
	@$(RM) ./$(SERVER_DIR)/static/*
	@$(CP) ./web/dist/* ./$(SERVER_DIR)/static/
	@$(RM) ./$(SERVER_DIR)/vMixMultiview/
	@$(MKDIR) ./$(SERVER_DIR)/vMixMultiview/vMixLayouts
	@$(MKDIR) ./$(SERVER_DIR)/vMixMultiview/vMixPreset
	@$(CP) ./vMixMultiview/vMixLayouts/index.html ./$(SERVER_DIR)/vMixMultiview/vMixLayouts/
	@$(CP) ./vMixMultiview/vMixPreset/index.html ./$(SERVER_DIR)/vMixMultiview/vMixPreset/
	@$(CP) ./vMixMultiview/favicon.ico ./$(SERVER_DIR)/vMixMultiview/
	@$(CP) ./vMixMultiview/index.html ./$(SERVER_DIR)/vMixMultiview/
	@$(CP) ./vMixMultiview/jquery.js ./$(SERVER_DIR)/vMixMultiview/
	@$(CP) ./vMixMultiview/mask.png ./$(SERVER_DIR)/vMixMultiview/
	@$(CP) ./vMixMultiview/script.js ./$(SERVER_DIR)/vMixMultiview/
	@$(CP) ./vMixMultiview/style.css ./$(SERVER_DIR)/vMixMultiview/