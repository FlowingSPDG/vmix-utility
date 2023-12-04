package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"

	"embed"

	vmixutility "github.com/FlowingSPDG/vmix-utility/server/core"
	"github.com/gin-gonic/gin"
)

// Static files
//
//go:embed static/*
var staticFS embed.FS

//go:embed vMixMultiview/*
var multiviewFS embed.FS

func main() {
	log.Println("STARTING...")

	// Parse flags
	vmixAddr := ""
	hostPort := 0
	flag.StringVar(&vmixAddr, "vmix", "http://localhost:8088", "vMix API Address")
	flag.IntVar(&hostPort, "host", 8080, "Server listen port")
	flag.Parse()

	// Init utility instance
	util, err := vmixutility.NewUtilityClient(hostPort, vmixAddr)
	if err != nil {
		panic(err)
	}

	// Init Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// Cache files
	index, err := staticFS.ReadFile("static/index.html")
	if err != nil {
		panic(err)
	}

	favicon, err := staticFS.ReadFile("static/favicon.ico")
	if err != nil {
		panic(err)
	}
	// serve static files
	r.GET("/", func(c *gin.Context) {
		c.Writer.WriteString(string(index))
	})
	r.GET("/favicon.ico", func(c *gin.Context) {
		c.Data(http.StatusOK, "image/x-icon", favicon)
	})
	r.GET("/css/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := staticFS.ReadFile("static/css" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "text/css", b)
	})
	r.GET("/js/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := staticFS.ReadFile("static/js" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "text/css", b)
	})
	r.GET("/img/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := staticFS.ReadFile("static/img" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "text/css", b)
	})
	r.GET("/fonts/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := staticFS.ReadFile("static/fonts" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "text/css", b)
	})
	r.GET("/multiviewer/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := multiviewFS.ReadFile("vMixMultiview" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "", b)
	})

	api := r.Group("/api")
	{
		api.GET("/vmix", util.GetvMixURLHandler)
		api.GET("/shortcuts", util.GetvMixShortcuts)
		api.GET("/inputs", util.GetInputsHandler)
		api.POST("/refresh", util.RefreshInputHandler)
		api.POST("/multiple", util.DoMultipleFunctionsHandler)
	}

	// Windowsの場合、自動的にブラウザを開く
	if runtime.GOOS == "windows" {
		url := fmt.Sprintf("http://localhost:%d/", hostPort)
		if err := exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start(); err != nil {
			log.Println("Failed to open link. ignoring...")
			log.Printf("ERR : %v\n", err)
		}
	}

	log.Panicf("Failed to listen port %s : %v\n", hostPort, r.Run(fmt.Sprintf(":%d", hostPort)))
}