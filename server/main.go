package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"sync"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"

	vmixgo "github.com/FlowingSPDG/vmix-go"
)

// vMixFunction contains vMix's available function names and value type, and Input information.
type vMixFunction struct {
	Name           string            `json:"name"`            // function name. e.g. "Fade" .
	ValueType      string            `json:"value_type"`      // value types. string,int and others.
	InputAvaialble bool              `json:"input_available"` // &Input="..." usable or not.
	Options        map[string]string `json:"options"`         // other options types, such as "Duration":"int" .
}

var (
	hostaddr      *string        // API Listen host
	vmixaddr      *string        // Target vMix host address
	vMixFunctions []vMixFunction // vMix functions slice. TODO!
	vmix          *vmixgo.Vmix
)

// GetvMixURLHandler returns vMix API Endpoint.
func GetvMixURLHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"url": *vmixaddr,
	})
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

// GetFunctionsHandler returns available functions/value/input combinations for [GET] /api/functions as JSON.
func GetFunctionsHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"functions": vMixFunctions,
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
	for i := 0; i < req.Num; i++ {
		wg.Add(1)
		go func() {
			if err := vmix.SendFunction(req.Function, params); err != nil {
				log.Printf("Error sending function %s with %v queries. ERR : %v\n", req.Function, params, err)
			}
			wg.Done()
		}()
	}
	wg.Wait()
	c.String(http.StatusOK, "OK")
}

func init() {
	vmixaddr = flag.String("vmix", "http://localhost:8088", "vMix API Address")
	hostaddr = flag.String("host", ":8080", "Server listen port")
	flag.Parse()
}

func main() {
	log.Println("STARTING...")
	var err error
	vmix, err = vmixgo.NewVmix(*vmixaddr)
	if err != nil {
		panic(err)
	}
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	entrypoint := "./static/index.html"
	r.GET("/", func(c *gin.Context) { c.File(entrypoint) })
	r.Use(static.Serve("/css", static.LocalFile("./static/css", false)))
	r.Use(static.Serve("/js", static.LocalFile("./static/js", false)))
	r.Use(static.Serve("/img", static.LocalFile("./static/img", false)))
	r.Use(static.Serve("/fonts", static.LocalFile("./static/fonts", false)))

	api := r.Group("/api")
	{
		api.GET("/vmix", GetvMixURLHandler)
		api.GET("/inputs", GetInputsHandler)
		api.GET("/functions", GetFunctionsHandler)
		api.POST("/refresh", RefreshInputHandler)
		api.POST("/multiple", DoMultipleFunctionsHandler)
	}

	url := fmt.Sprintf("http://localhost%s/", *hostaddr)
	err = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start()
	if err != nil {
		log.Println("Failed to open link. ignoring...")
		log.Printf("ERR : %v\n", err)
	}
	log.Panicf("Failed to listen port %s : %v\n", *hostaddr, r.Run(*hostaddr))
}
