package vmixgo

import (
	"strconv"
)

// NDICommand Send specified command to NDI source
func (v *Vmix) NDICommand(input interface{}, command string) error {
	params := make(map[string]string)
	params["Value"] = command
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params["Input"] = in
	return v.SendFunction("NDICommand", params)
}

// NDISelectSourceByIndex Index 0~100
func (v *Vmix) NDISelectSourceByIndex(input interface{}, index uint) error {
	params := make(map[string]string)
	params["Value"] = strconv.Itoa(int(index))
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params["Input"] = in
	return v.SendFunction("NDISelectSourceByIndex", params)
}

// NDISelectSourceByName ?
func (v *Vmix) NDISelectSourceByName(input interface{}, name string) error {
	params := make(map[string]string)
	params["Value"] = name
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params["Input"] = in
	return v.SendFunction("NDISelectSourceByName", params)
}

// NDIStartRecording ?
func (v *Vmix) NDIStartRecording(input interface{}) error {
	params := make(map[string]string)
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params["Input"] = in
	return v.SendFunction("NDIStartRecording", nil)
}

// NDIStopRecording ?
func (v *Vmix) NDIStopRecording(input interface{}) error {
	params := make(map[string]string)
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params["Input"] = in
	return v.SendFunction("NDIStopRecording", params)
}
