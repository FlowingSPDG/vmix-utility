package vmixgo

// ActivatorRefresh Refresh all activator device lights and controls
func (v *Vmix) ActivatorRefresh() error {
	return v.SendFunction("ActivatorRefresh", nil)
}

// CallManagerShowHide ?
func (v *Vmix) CallManagerShowHide() error {
	return v.SendFunction("CallManagerShowHide", nil)
}

// KeyPress ?
func (v *Vmix) KeyPress(key string) error {
	params := make(map[string]string)
	params["Value"] = key
	return v.SendFunction("KeyPress", params)
}

// SendKeys Send keys to active window
func (v *Vmix) SendKeys(keys string) error {
	params := make(map[string]string)
	params["Value"] = keys
	return v.SendFunction("SendKeys", params)
}
