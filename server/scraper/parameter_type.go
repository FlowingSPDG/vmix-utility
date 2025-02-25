package scraper

//go:generate stringer -type=ParameterType

type ParameterType int

const (
	_ ParameterType = iota
	ParameterTypeValue
	ParameterTypeInput
	ParameterTypeMix
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
	case "Mix":
		return ParameterTypeMix
	default:
		return ParameterTypeUnknown
	}
}
