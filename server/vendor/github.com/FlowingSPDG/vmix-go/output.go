package vmixgo

import (
	"strconv"
)

// Fullscreen Toggles Fullscreen On or Off
func (v *Vmix) Fullscreen() error {
	return v.SendFunction("Fullscreen", nil)
}

// FullscreenOff ?
func (v *Vmix) FullscreenOff() error {
	return v.SendFunction("FullscreenOff", nil)
}

// FullscreenOn ?
func (v *Vmix) FullscreenOn() error {
	return v.SendFunction("FullscreenOn", nil)
}

// SetOutput2 Change what is displayed on Output 2 output. Preview,MultiView,Input?
func (v *Vmix) SetOutput2(input interface{}, value string) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	params["Value"] = value
	return v.SendFunction("SetOutput2", params)
}

// SetOutput3 Change what is displayed on Output 3 output. Preview,MultiView,Input?
func (v *Vmix) SetOutput3(input interface{}, value string) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	params["Value"] = value
	return v.SendFunction("SetOutput3", params)
}

// SetOutput4 Change what is displayed on Output 4 output. Preview,MultiView,Input?
func (v *Vmix) SetOutput4(input interface{}, value string) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	params["Value"] = value
	return v.SendFunction("SetOutput4", params)
}

// SetOutputExternal2 Change what is displayed on the External2 output. Preview,MultiView,Input?
func (v *Vmix) SetOutputExternal2(input interface{}, value string) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	params["Value"] = value
	return v.SendFunction("SetOutputExternal2", params)
}

// SetOutputFullscreen Change what is displayed on the Fullscreen output. Preview,MultiView,Input?
func (v *Vmix) SetOutputFullscreen(input interface{}, value string) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	params["Value"] = value
	return v.SendFunction("SetOutputFullscreen", params)
}

// SetOutputFullscreen2 Change what is displayed on the Fullscreen2 output. Preview,MultiView,Input?
func (v *Vmix) SetOutputFullscreen2(input interface{}, value string) error {
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params := make(map[string]string)
	params["Input"] = in
	params["Value"] = value
	return v.SendFunction("SetOutputFullscreen2", params)
}

// Snapshot Create a snapshot iamge of the current Output. Optional Value specifies save Filename, otherwise a save file window will appear.
func (v *Vmix) Snapshot(savedir string) error {
	params := make(map[string]string)
	params["Value"] = savedir
	return v.SendFunction("Snapshot", params)
}

// SnapshotInput Create a snapshot iamge of the selected Output. Optional Value specifies save Filename, otherwise a save file window will appear.
func (v *Vmix) SnapshotInput(input interface{}, savedir string) error {
	params := make(map[string]string)
	params["Value"] = savedir
	in, err := resolveInput(input)
	if err != nil {
		return err
	}
	params["Input"] = in
	return v.SendFunction("SnapShotInput", params)
}

// StartExternal ?
func (v *Vmix) StartExternal() error {
	return v.SendFunction("StartExternal", nil)
}

// StartMultiCorder ?
func (v *Vmix) StartMultiCorder() error {
	return v.SendFunction("StartMultiCorder", nil)
}

// StartRecording ?
func (v *Vmix) StartRecording() error {
	return v.SendFunction("StartRecording", nil)
}

// StartStopExternal ?
func (v *Vmix) StartStopExternal() error {
	return v.SendFunction("StartStopExternal", nil)
}

// StartStopMultiCorder ?
func (v *Vmix) StartStopMultiCorder() error {
	return v.SendFunction("StartStopMultiCorder", nil)
}

// StartStopRecording ?
func (v *Vmix) StartStopRecording() error {
	return v.SendFunction("StartStopRecording", nil)
}

// StartStopStreaming Optional stream number starting from 0
func (v *Vmix) StartStopStreaming(stream uint) error {
	params := make(map[string]string)
	params["Value"] = strconv.Itoa(int(stream))
	return v.SendFunction("StartStopStreaming", params)
}

// StartStreaming Optional stream number starting from 0
func (v *Vmix) StartStreaming(stream uint) error {
	params := make(map[string]string)
	params["Value"] = strconv.Itoa(int(stream))
	return v.SendFunction("StartStreaming", params)
}

// StopExternal ?
func (v *Vmix) StopExternal() error {
	return v.SendFunction("StopExternal", nil)
}

// StopMultiCorder ?
func (v *Vmix) StopMultiCorder() error {
	return v.SendFunction("StopMultiCorder", nil)
}

// StopRecording ?
func (v *Vmix) StopRecording() error {
	return v.SendFunction("StopRecording", nil)
}

// StopStreaming Optional stream number starting from 0
func (v *Vmix) StopStreaming(stream uint) error {
	params := make(map[string]string)
	params["Value"] = strconv.Itoa(int(stream))
	return v.SendFunction("StopStreaming", params)
}

// StreamingSetKey Set Key on Custom RTMP Stream
func (v *Vmix) StreamingSetKey(stream string) error {
	params := make(map[string]string)
	params["Value"] = stream
	return v.SendFunction("StreamingSetKey", params)
}

// StreamingSetPassword Set Password on Custom RTMP Stream
func (v *Vmix) StreamingSetPassword(stream string) error {
	params := make(map[string]string)
	params["Value"] = stream
	return v.SendFunction("StreamingSetPassword", params)
}

// StreamingSetURL Set URL on Custom RTMP Stream
func (v *Vmix) StreamingSetURL(stream string) error {
	params := make(map[string]string)
	params["Value"] = stream
	return v.SendFunction("StreamingSetURL", params)
}

// StreamingSetUsername Set Username on Custom RTMP Stream
func (v *Vmix) StreamingSetUsername(stream string) error {
	params := make(map[string]string)
	params["Value"] = stream
	return v.SendFunction("StreamingSetUsername", params)
}

// WriteDurationToRecordingLog Write current recording duration to log file with optional tag text Value
func (v *Vmix) WriteDurationToRecordingLog(tagtext string) error {
	params := make(map[string]string)
	params["Value"] = tagtext
	return v.SendFunction("WriteDurationToRecordingLog", params)
}
