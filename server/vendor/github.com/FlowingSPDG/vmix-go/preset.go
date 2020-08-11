package vmixgo

// LastPreset Load the last preset
func (v *Vmix) LastPreset() error {
	return v.SendFunction("LastPreset", nil)
}

// OpenPreset Load preset from the specified Filename
func (v *Vmix) OpenPreset(filename string) error {
	params := make(map[string]string)
	params["Value"] = filename
	return v.SendFunction("OpenPreset", params)
}

// SavePreset Save preset to the specified FIlename
func (v *Vmix) SavePreset(filename string) error {
	params := make(map[string]string)
	params["Value"] = filename
	return v.SendFunction("SavePreset", params)
}
