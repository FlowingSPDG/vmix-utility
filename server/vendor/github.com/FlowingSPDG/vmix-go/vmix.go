package vmixgo

import (
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
)

// NewVmix Creates Vmix instance
func NewVmix(addr string) (*Vmix, error) {
	u, err := url.Parse(addr)
	if err != nil {
		return nil, fmt.Errorf("Failed to parse URL... %v", err)
	}
	u.Path = path.Join(u.Path, "/api")
	resp, err := http.Get(u.String())
	if err != nil {
		return nil, fmt.Errorf("Failed to connect vmix... %v", err)
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("Failed to Read body... %v", err)
	}
	v := Vmix{}
	err = xml.Unmarshal(body, &v)
	if err != nil {
		return nil, fmt.Errorf("Failed to unmarshal XML... %v", err)
	}
	v.Addr = u
	return &v, nil
}
