package vmixutility

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"

	vmixgo "github.com/FlowingSPDG/vmix-go"
	"github.com/FlowingSPDG/vmix-utility/server/scraper"
)

type utilityClient struct {
	hostPort  int                // API Listen port to listen
	vmixAddr  string             // Target vMix host address
	vmix      *vmixgo.Vmix       // vMix instance. Never be nil but could be disconnected.
	shortcuts []scraper.Shortcut // vMix Shortcuts. Neber be nil but could be empty.
}

type UtilityClient interface {
	GetvMixURLHandler(c *gin.Context)
	GetvMixShortcuts(c *gin.Context)
	RefreshInputHandler(c *gin.Context)
	GetInputsHandler(c *gin.Context)
	DoMultipleFunctionsHandler(c *gin.Context)
}

func NewUtilityClient(hostPort int, vmixAddr string) (UtilityClient, error) {
	vmix, err := vmixgo.NewVmix(vmixAddr)
	if err != nil {
		return nil, err
	}
	return &utilityClient{
		hostPort:  hostPort,
		vmixAddr:  vmixAddr,
		vmix:      vmix,
		shortcuts: nil,
	}, nil
}

// GetvMixURLHandler returns vMix API Endpoint.
func (u *utilityClient) GetvMixURLHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"url": u.vmixAddr,
	})
}

// GetvMixURLHandler returns vMix API Endpoint.
func (u *utilityClient) GetvMixShortcuts(c *gin.Context) {
	if u.shortcuts == nil {
		s, err := scraper.GetShortcuts(27) // TODO: 実際のバージョンを使用する
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}
		u.shortcuts = s
	}

	c.JSON(http.StatusOK, u.shortcuts)
}

// RefreshInputHandler returns vMix API Endpoint.
func (u *utilityClient) RefreshInputHandler(c *gin.Context) {
	vmix, err := u.vmix.Refresh()
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
func (u *utilityClient) GetInputsHandler(c *gin.Context) {
	if u.vmix.Inputs.Input == nil {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
			"error": "Input not loaded",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"inputs": u.vmix.Inputs.Input,
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
func (u *utilityClient) DoMultipleFunctionsHandler(c *gin.Context) {
	req := DoMultipleFunctionsRequest{}
	if err := c.BindJSON(&req); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	if err := req.Validate(); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	// パラメタをmap化
	params := make(map[string]string)
	for _, v := range req.Queries {
		params[v.Key] = v.Value
	}

	// 同時実行のためのgoroutineを準備する
	// TODO: errgroupを使う
	wg := &sync.WaitGroup{}
	numerrors := 0
	for i := 0; i < req.Num; i++ {
		wg.Add(1)
		go func() {
			if err := u.vmix.SendFunction(req.Function, params); err != nil {
				numerrors++
				log.Printf("Error sending function %s with %v queries. ERR : %v\n", req.Function, params, err)
			}
			wg.Done()
		}()
	}
	// goroutine合流
	wg.Wait()

	// 結果を返す
	if numerrors == 0 {
		c.String(http.StatusOK, "Done with no errors")
	} else {
		c.String(http.StatusAccepted, fmt.Sprintf("Done with %d errors", numerrors))
	}
}
