package main

import (
	"embed"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"

	vmixgo "github.com/FlowingSPDG/vmix-go"
	"github.com/FlowingSPDG/vmix-utility/scraper"
)

// vMix variables
var (
	hostaddr  *string            // API Listen host
	vmixaddr  *string            // Target vMix host address
	shortcuts []scraper.Shortcut // vMix functions slice. TODO!
	vmix      *vmixgo.Vmix
)

// Static files
//go:embed static/*
var staticFS embed.FS

//go:embed vMixMultiview/*
var multiviewFS embed.FS

// GetvMixURLHandler returns vMix API Endpoint.
func GetvMixURLHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"url": *vmixaddr,
	})
}

// GetvMixURLHandler returns vMix API Endpoint.
func GetvMixShortcuts(c *gin.Context) {
	if shortcuts == nil {
		s, err := scraper.GetShortcuts(25)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}
		shortcuts = s
	}

	c.JSON(http.StatusOK, shortcuts)
}

// RefreshInputHandler returns vMix API Endpoint.
func RefreshInputHandler(c *gin.Context) {
	var err error
	vmix, err = vmix.Refresh()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"err": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"inputs": vmix.Inputs.Input,
	})
}

// GetInputsHandler returns available vmix inputs for [GET] /api/inputs as JSON.
func GetInputsHandler(c *gin.Context) {
	if vmix == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": "vmix instance not loaded",
		})
		return
	}
	if vmix.Inputs.Input == nil {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
			"error": "Input not loaded",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"inputs": vmix.Inputs.Input,
	})
	return
}

// DoMultipleFunctionsRequest Request JSON for DoMultipleFunctionsHandler
type DoMultipleFunctionsRequest struct {
	Function string `json:"function"` // function name. e.g. "Fade" .
	Queries  []struct {
		Key   string `json:"key"`   // Key.
		Value string `json:"value"` // Value.
	} `json:"queries"` // Key-Value queries.
	Num int `json:"num"`
}

// Validate form
func (r *DoMultipleFunctionsRequest) Validate() error {
	if strings.TrimSpace(r.Function) == "" {
		return fmt.Errorf("Function empty")
	}
	for _, v := range r.Queries {
		if v.Key == "" || v.Value == "" {
			return fmt.Errorf("Invalid queries")
		}
	}
	if r.Num <= 0 {
		return fmt.Errorf("Invalid Number length")
	}
	return nil
}

// DoMultipleFunctionsHandler Sends multiple functions to vMix.
func DoMultipleFunctionsHandler(c *gin.Context) {
	req := DoMultipleFunctionsRequest{}
	c.BindJSON(&req)
	if err := req.Validate(); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}
	params := make(map[string]string)
	for _, v := range req.Queries {
		params[v.Key] = v.Value
	}

	wg := &sync.WaitGroup{}
	numerrors := 0
	for i := 0; i < req.Num; i++ {
		wg.Add(1)
		go func() {
			if err := vmix.SendFunction(req.Function, params); err != nil {
				numerrors++
				log.Printf("Error sending function %s with %v queries. ERR : %v\n", req.Function, params, err)
			}
			wg.Done()
		}()
	}
	wg.Wait()
	if numerrors == 0 {
		c.String(http.StatusOK, "Done with no errors")
	} else {
		c.String(http.StatusAccepted, fmt.Sprintf("Done with %d errors", numerrors))
	}
}

func init() {
	vmixaddr = flag.String("vmix", "http://localhost:8088", "vMix API Address")
	hostaddr = flag.String("host", ":8080", "Server listen port")
	flag.Parse()
}

func main() {
	log.Println("STARTING...")

	// Init vMix
	var err error
	vmix, err = vmixgo.NewVmix(*vmixaddr)
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
		api.GET("/vmix", GetvMixURLHandler)
		api.GET("/shortcuts", GetvMixShortcuts)
		api.GET("/inputs", GetInputsHandler)
		api.POST("/refresh", RefreshInputHandler)
		api.POST("/multiple", DoMultipleFunctionsHandler)
	}

	url := fmt.Sprintf("http://localhost%s/", *hostaddr)
	if runtime.GOOS == "windows" {
		if err := exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start(); err != nil {
			log.Println("Failed to open link. ignoring...")
			log.Printf("ERR : %v\n", err)
		}
	}

	log.Panicf("Failed to listen port %s : %v\n", *hostaddr, r.Run(*hostaddr))
}
