package vmixutility

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/FlowingSPDG/vmix-utility/server/scraper"

	vmixgo "github.com/FlowingSPDG/vmix-go"
	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
)

// vMixSupportedVersion Supported vMix Version
const vMixSupportedVersion = 28

type utilityClient struct {
	hostPort  int                // API Listen port to listen
	vmixAddr  string             // Target vMix host address
	vmix      *vmixgo.Vmix       // vMix instance. Never be nil but could be disconnected.
	shortcuts []scraper.Shortcut // vMix Shortcuts. Neber be nil but could be empty.
}

type UtilityClient interface {
	GetRawXMLHandler(c *gin.Context)
	GetvMixShortcuts(c *gin.Context)
	RefreshInputHandler(c *gin.Context)
	GetInputsHandler(c *gin.Context)
	DoMultipleFunctionsHandler(c *gin.Context)
}

func NewUtilityClient(hostPort int, vmixAddr string) (UtilityClient, error) {
	vmix, err := vmixgo.NewVmix(vmixAddr)
	if err != nil {
		return nil, xerrors.Errorf("failed to create vmix instance: %w", err)
	}

	shortcuts, err := scraper.GetShortcuts(vMixSupportedVersion)
	if err != nil {
		log.Println("Failed to get shortcuts:", err)
	}

	return &utilityClient{
		hostPort:  hostPort,
		vmixAddr:  vmixAddr,
		vmix:      vmix,
		shortcuts: shortcuts,
	}, nil
}

func (u *utilityClient) GetRawXMLHandler(c *gin.Context) {
	resp, err := http.Get(u.vmixAddr + "/api")
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.Header("Content-Type", "application/xml")
	c.String(http.StatusOK, string(b))
}

// GetvMixURLHandler returns vMix API Endpoint.
func (u *utilityClient) GetvMixShortcuts(c *gin.Context) {
	if u.shortcuts == nil {
		s, err := scraper.GetShortcuts(vMixSupportedVersion)
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
		return xerrors.Errorf("function empty")
	}
	for _, v := range r.Queries {
		if v.Key == "" || v.Value == "" {
			return xerrors.Errorf("invalid queries")
		}
	}
	if r.Num <= 0 {
		return xerrors.Errorf("invalid Number length")
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
	eg := &errgroup.Group{}
	for range req.Num {
		eg.Go(func() error {
			if err := u.vmix.SendFunction(req.Function, params); err != nil {
				log.Printf("Error sending function %s with %v queries. ERR : %v\n", req.Function, params, err)
				return err
			}
			return nil
		})
	}
	// goroutine合流
	if err := eg.Wait(); err != nil {
		c.String(http.StatusAccepted, fmt.Sprintf("Done with errors: %v", err))
		return
	}

	// 結果を返す
	c.String(http.StatusAccepted, "Done with no errors")
}
