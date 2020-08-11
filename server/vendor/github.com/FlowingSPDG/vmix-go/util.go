package vmixgo

import (
	"fmt"
	"reflect"
	"strconv"
)

// resolveInput resolves vmix keys, number, scene name to string.
func resolveInput(input interface{}) (string, error) {
	s := reflect.ValueOf(input)
	if !s.IsValid() {
		return "", fmt.Errorf("Input is nil")
	}
	switch s.Type().String() {
	case "int":
		return strconv.Itoa(input.(int)), nil
	case "string":
		return input.(string), nil
	case "vmixgo.Input":
		in := input.(Input)
		return in.Key, nil
	default:
		return "", fmt.Errorf("Interface type not correct")
	}
}
