package main

import (
	"flag"
	"fmt"
	"strings"

	"github.com/gocolly/colly/v2"
)

var (
	helpVer int
	funcs   map[string][]string // map[FunctionName] - Query slice
)

func main() {
	flag.IntVar(&helpVer, "helpver", 25, "vMix help version")
	flag.Parse()

	funcs = make(map[string][]string)

	c := colly.NewCollector()

	// Find and visit all links
	// #topic_content > div > table > tbody > tr:nth-child(3) > td:nth-child(1)
	c.OnHTML("tr", func(e *colly.HTMLElement) {
		// fmt.Printf("e:%#v\n", e)
		e.ForEach("td", func(i int, h *colly.HTMLElement) {
			if i != 0 {
				return
			}

			if h.Text != "" {
				t := strings.TrimSuffix(h.Text, "\n")
				funcs[t] = make([]string, 0)
			}
		})
	})

	c.OnRequest(func(r *colly.Request) {
		fmt.Println("Visiting", r.URL)
	})

	u := fmt.Sprintf("https://www.vmix.com/help%d/ShortcutFunctionReference.html", helpVer)

	c.Visit(u)
	fmt.Printf("Got %d Functions\n", len(funcs))
	for f := range funcs {
		fmt.Println("Found", f)
	}
}
