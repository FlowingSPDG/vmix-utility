package scraper

//go:generate stringer -type=ParameterType

type ParameterType int

const (
	ParameterTypeNone ParameterType = iota
	ParameterTypeValue
	ParameterTypeInput
	ParameterTypeDuration
	ParameterTypeChannel
	ParameterTypeUnknown
)

func resolveParameterType(s string) ParameterType {
	switch s {
	case "Value":
		return ParameterTypeValue
	case "Input":
		return ParameterTypeInput
	case "Duration":
		return ParameterTypeDuration
	case "Channel":
		return ParameterTypeChannel
	default:
		return ParameterTypeUnknown
	}
}
