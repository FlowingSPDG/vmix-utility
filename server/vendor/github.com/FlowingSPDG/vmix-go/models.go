package vmixgo

import (
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
)

// Vmix main object
type Vmix struct {
	Addr *url.URL `xml:"-"` // vmix API destination.

	// Available informations in /api endpoint (XML).
	XMLName xml.Name `xml:"vmix"`
	Version string   `xml:"version"` // vmix Version. e.g. "23.0.0.31"
	Edition string   `xml:"edition"` // vmix Edition. e.g. "4K"
	Preset  string   `xml:"preset"`  // vmix profile directory. e.g. "C:\my-profile.vmix"
	// Scenes slice
	Inputs struct {
		Input []Input `xml:"input"`
	} `xml:"inputs"`
	// Overlays slice
	Overlays struct {
		Overlay []Overlay `xml:"overlay"`
	} `xml:"overlays"`
	Preview       uint `xml:"preview"`     // Preview scene number
	Active        uint `xml:"active"`      // Active scene number
	IsFadeToBlack bool `xml:"fadeToBlack"` // FTB activated or not
	// vmix transition
	Transitions struct {
		Transition []Transition `xml:"transition"`
	} `xml:"transitions"`
	Recording   bool `xml:"recording"`   // Recording enabled
	External    bool `xml:"external"`    // External output enabled
	Streaming   bool `xml:"streaming"`   // RTMP Streaming enabled
	PlayList    bool `xml:"playList"`    // Playlist enabled
	MultiCorder bool `xml:"multiCorder"` // MultiCorder enabled
	FullScreen  bool `xml:"fullscreen"`  // FullScreen enabled
	// Audio?
	Audios struct {
		Master []Audio `xml:"master"`
	} `xml:"audio"`
}

// SendFunction sends request to /api?Function=funcname&Key=Value...
func (v *Vmix) SendFunction(funcname string, params map[string]string) error {
	q := v.Addr.Query()
	q.Add("Function", funcname)
	if params != nil {
		for k, v := range params {
			q.Add(k, v)
		}
	}
	req := *v.Addr
	url := q.Encode()
	req.RawQuery = url
	resp, err := http.Get(req.String())
	if err != nil {
		return fmt.Errorf("Failed to send function... %v", err)
	}
	if resp.StatusCode == http.StatusInternalServerError {
		return fmt.Errorf("vMix returned Internal error")
	}
	_, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("Failed to Read body... %v", err)
	}
	return nil
}

// Refresh Inputs
func (v *Vmix) Refresh() (*Vmix, error) {
	resp, err := http.Get(v.Addr.String())
	if err != nil {
		return nil, fmt.Errorf("Failed to connect vmix... %v", err)
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("Failed to Read body... %v", err)
	}
	vnew := Vmix{}
	//fmt.Printf("body : %v\n", string(body))
	err = xml.Unmarshal(body, &vnew)
	if err != nil {
		return nil, fmt.Errorf("Failed to unmarshal XML... %v", err)
	}
	vnew.Addr = v.Addr
	v = &vnew
	return v, nil
}

type Input struct {
	// Common properties
	Name       string `xml:",chardata"`
	Key        string `xml:"key,attr"`
	Number     uint   `xml:"number,attr"`
	SceneType  string `xml:"type,attr"`
	Title      string `xml:"title,attr"` // same as Name??
	ShortTitle string `xml:"shorttite,attr"`
	State      string `xml:"state,attr"` // Paused | Running
	Position   int    `xml:"position,attr"`
	Duration   int    `xml:"duration,attr"`
	Loop       bool   `xml:"loop,attr"`

	// Sound related
	Muted       bool    `xml:"muted,attr"`
	Volume      float64 `xml:"volume,attr"`
	Balance     int     `xml:"balance,attr"`
	Solo        bool    `xml:"solo,attr"`
	AudioBusses string  `xml:"audiobusses,attr"`
	MeterF1     float64 `xml:"meterF1,attr"`
	MeterF2     float64 `xml:"meterF2,attr"`
}

type Overlay struct {
	Number uint `xml:"number,attr"`
}

type Audio struct {
	Volume           float64 `xml:"volume,attr"`
	Muted            bool    `xml:"muted,attr"`
	MeterF1          float64 `xml:"meterF1,attr"`
	MeterF2          float64 `xml:"meterF2,attr"`
	HeadphonesVolume float64 `xml:"headphonesVolume,attr"`
}

type Transition struct {
	Number   uint   `xml:"number,attr"`
	Effect   string `xml:"effect,attr"`
	Duration uint   `xml:"duration,attr"`
}
