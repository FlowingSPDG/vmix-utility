package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path"

	"github.com/FlowingSPDG/vmix-utility/scraper"
)

func main() {
	helpVer := 0
	flag.IntVar(&helpVer, "helpver", 28, "vMix Help Version")

	sc, err := scraper.GetShortcuts(helpVer)
	if err != nil {
		panic(err)
	}

	// create new file
	dumpPath := path.Join(".", "app", "src", "assets", "shortcuts.json")
	dumpFile, err := os.Create(dumpPath)
	if err != nil {
		panic(err)
	}
	defer dumpFile.Close()

	if err := json.NewEncoder(dumpFile).Encode(sc); err != nil {
		panic(err)
	}

	fmt.Println("Done")
}
