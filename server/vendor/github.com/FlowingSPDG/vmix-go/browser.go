package vmixgo

// BrowserBack ?
func (v *Vmix) BrowserBack(input interface{}) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	return v.SendFunction("BrowserBack", params)
}

// BrowserForward ?
func (v *Vmix) BrowserForward(input interface{}) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	return v.SendFunction("BrowserForward", params)
}

// BrowserKeyboardDisabled ?
func (v *Vmix) BrowserKeyboardDisabled(input interface{}) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	return v.SendFunction("BrowserKeyboardDisabled", params)
}

// BrowserKeyboardEnabled ?
func (v *Vmix) BrowserKeyboardEnabled(input interface{}) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	return v.SendFunction("BrowserKeyboardEnabled", params)
}

// BrowserMouseDisabled ?
func (v *Vmix) BrowserMouseDisabled(input interface{}) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	return v.SendFunction("BrowserMouseDisabled", params)
}

// BrowserMouseEnabled ?
func (v *Vmix) BrowserMouseEnabled(input interface{}) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	return v.SendFunction("BrowserMouseEnabled", params)
}

// BrowserNavigate ?
func (v *Vmix) BrowserNavigate(input interface{}, url string) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	params["Value"] = url
	return v.SendFunction("BrowserNavigate", params)
}

// BrowserReload ?
func (v *Vmix) BrowserReload(input interface{}) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	return v.SendFunction("BrowserReload", params)
}
