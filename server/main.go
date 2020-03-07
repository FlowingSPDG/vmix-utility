package main

import (
	"flag"
	vmixgo "github.com/FlowingSPDG/vmix-go"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

// vMixFunction contains vMix's available function names and value type, and Input information.
type vMixFunction struct {
	Name           string              `json:"name"`            // function name. e.g. "Fade" .
	ValueType      string              `json:"value_type"`      // value types. string,int and others.
	InputAvaialble bool                `json:"input_available"` // &Input="..." usable or not.
	Options        []map[string]string `json:"options"`         // other options types, such as "Duration":"int" .
}

var (
	hostaddr      *string        // API Listen host
	vmixaddr      *string        // Target vMix host address
	inputs        []vmixgo.Input // vMix Inputs
	vMixFunctions []vMixFunction // vMix functions slice. TODO!
)

// GetScenesHandler returns available vmix inputs for [GET] /api/scenes as JSON.
func GetScenesHandler(c *gin.Context) {
	if inputs == nil {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
			"error": "Input not loaded",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"scenes": inputs,
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

func init() {
	vmixaddr = flag.String("vmix", "http://localhost:8088", "vMix API Address")
	hostaddr = flag.String("host", ":8080", "Server listen port")
	flag.Parse()
}

func main() {
	log.Println("STARTING...")
	vmix, err := vmixgo.NewVmix(*vmixaddr)
	if err != nil {
		panic(err)
	}
	inputs = vmix.Inputs.Input
	r := gin.Default()
	entrypoint := "./static/index.html"
	r.GET("/", func(c *gin.Context) { c.File(entrypoint) })
	r.Use(static.Serve("/css", static.LocalFile("./static/css", false)))
	r.Use(static.Serve("/js", static.LocalFile("./static/js", false)))
	r.Use(static.Serve("/img", static.LocalFile("./static/img", false)))
	r.Use(static.Serve("/fonts", static.LocalFile("./static/fonts", false)))

	api := r.Group("/api")
	{
		api.GET("/scenes", GetScenesHandler)
		api.GET("/functions", GetFunctionsHandler)
	}

	log.Panicf("Failed to listen port %s : %v\n", *hostaddr, r.Run(*hostaddr))
}
