package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path"

	"github.com/FlowingSPDG/vmix-utility/scraper"
)

var (
	helpVer  int
	dumpPath string
)

func main() {
	flag.IntVar(&helpVer, "helpver", 28, "vMix Help Version")
	flag.StringVar(&dumpPath, "dumppath", "../app/src/assets", "Path to dump the shortcuts.json file")
	flag.Parse()

	sc, err := scraper.GetShortcuts(helpVer)
	if err != nil {
		panic(err)
	}

	// create new file
	dumpPath := path.Join(dumpPath, "shortcuts.json")
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
