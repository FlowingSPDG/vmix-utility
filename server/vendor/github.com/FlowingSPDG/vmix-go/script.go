package vmixgo

// ScriptStart ?
func (v *Vmix) ScriptStart(scriptname string) error {
	params := make(map[string]string)
	params["Value"] = scriptname
	return v.SendFunction("ScriptStart", params)
}

// ScriptStartDynamic Start a dynamic script using code specified as the Value
func (v *Vmix) ScriptStartDynamic(code string) error {
	params := make(map[string]string)
	params["Value"] = code
	return v.SendFunction("ScriptStartDynamic", params)
}

// ScriptStop ?
func (v *Vmix) ScriptStop(scriptname string) error {
	params := make(map[string]string)
	params["Value"] = scriptname
	return v.SendFunction("ScriptStop", params)
}

// ScriptStopAll ?
func (v *Vmix) ScriptStopAll() error {
	return v.SendFunction("ScriptStopAll", nil)
}

// ScriptStopDynamic ?
func (v *Vmix) ScriptStopDynamic() error {
	return v.SendFunction("ScriptStopDynamic", nil)
}
