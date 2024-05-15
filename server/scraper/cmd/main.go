package main

import (
	"flag"
	"fmt"

	"github.com/FlowingSPDG/vmix-utility/server/scraper"
)

func main() {
	helpVer := 0
	flag.IntVar(&helpVer, "helpver", 27, "vMix Help Version")

	sc, err := scraper.GetShortcuts(helpVer)
	if err != nil {
		panic(err)
	}

	for _, s := range sc {
		fmt.Printf("%#v: ", s)
		for _, p := range s.Parameters {
			fmt.Println(p)
		}
	}
}
