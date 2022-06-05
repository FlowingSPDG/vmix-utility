package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/FlowingSPDG/vmix-utility/scraper"
)

var (
	helpVer int
)

func main() {
	flag.IntVar(&helpVer, "helpver", 25, "vMix help version")
	flag.Parse()

	shortcuts, err := scraper.GetShortcuts(helpVer)
	if err != nil {
		log.Fatalln(err)
	}

	fmt.Printf("Got %d Functions\n", len(shortcuts))
	for i, f := range shortcuts {
		fmt.Printf("Shortcut[%d] : %s(%s) . Queries:%v\n", i, f.Name, f.Description, f.Parameters)
	}
}
