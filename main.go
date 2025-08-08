package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"

	"embed"

	vmixutility "github.com/FlowingSPDG/vmix-utility/server"
	"github.com/gin-gonic/gin"
)

//go:embed web/dist/*
var staticFS embed.FS

//go:embed vMixMultiview/index.html
//go:embed vMixMultiview/script.js
//go:embed vMixMultiview/jquery.js
//go:embed vMixMultiview/style.css
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
	index, err := staticFS.ReadFile("web/dist/index.html")
	if err != nil {
		panic(err)
	}

	favicon, err := staticFS.ReadFile("web/dist/favicon.ico")
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
		b, err := staticFS.ReadFile("web/dist/css" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "text/css", b)
	})
	r.GET("/js/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := staticFS.ReadFile("web/dist/js" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "application/javascript", b)
	})
	r.GET("/img/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := staticFS.ReadFile("web/dist/img" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "image/*", b)
	})
	r.GET("/fonts/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := staticFS.ReadFile("web/dist/fonts" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "font/woff2", b)
	})
	r.GET("/multiviewer/*file", func(c *gin.Context) {
		file := c.Param("file")
		b, err := multiviewFS.ReadFile("vMixMultiview" + file)
		if err != nil {
			c.AbortWithError(http.StatusNotFound, err)
			return
		}
		c.Data(http.StatusOK, "text/html", b)
	})

	api := r.Group("/api")
	{
		api.GET("/shortcuts", util.GetvMixShortcuts)
		api.GET("/raw", util.GetRawXMLHandler)
		api.GET("/inputs", util.GetInputsHandler)
		api.POST("/refresh", util.RefreshInputHandler)
		api.POST("/multiple", util.DoMultipleFunctionsHandler)
		api.POST("/setinputname", util.SetInputNameHandler)
	}

	// Windowsの場合、自動的にブラウザを開く
	if runtime.GOOS == "windows" {
		url := fmt.Sprintf("http://localhost:%d/", hostPort)
		if err := exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start(); err != nil {
			log.Println("Failed to open link. ignoring...")
			log.Printf("ERR : %v\n", err)
		}
	}

	log.Panicf("failed to listen port %d : %v\n", hostPort, r.Run(fmt.Sprintf(":%d", hostPort)))
}
