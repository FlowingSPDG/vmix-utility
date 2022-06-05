package main

import (
	"flag"
	"fmt"
	"strings"

	"github.com/gocolly/colly/v2"
)

var (
	helpVer int
)

type Shortcut struct {
	Name        string
	Description string
	Parameters  []string // comma-separated queries
}

func main() {
	flag.IntVar(&helpVer, "helpver", 25, "vMix help version")
	flag.Parse()

	shortcuts := make([]Shortcut, 0, 500)

	c := colly.NewCollector()

	// Find and visit all links
	c.OnHTML("table", func(e *colly.HTMLElement) {
		e.ForEach("tr", func(i int, h *colly.HTMLElement) {
			// Filter header column somehow?
			s := Shortcut{}
			h.ForEach("td", func(i int, j *colly.HTMLElement) {
				// fmt.Println("td text:", i, j.Text)
				switch i {
				case 0:
					if j.Text != "" {
						t := strings.ReplaceAll(j.Text, "\n", "")
						s.Name = t
					}
				case 1:
					if j.Text != "" {
						t := strings.ReplaceAll(j.Text, "\n", "")
						s.Description = t
					}
				case 2:
					if j.Text != "" && j.Text != "None" {
						t := strings.ReplaceAll(j.Text, "\n", "")
						ts := strings.Split(t, ",")
						s.Parameters = ts
					}
				}
			})
			shortcuts = append(shortcuts, s)
		})
	})

	c.OnRequest(func(r *colly.Request) {
		fmt.Println("Visiting", r.URL)
	})

	u := fmt.Sprintf("https://www.vmix.com/help%d/ShortcutFunctionReference.html", helpVer)

	c.Visit(u)

	fmt.Printf("Got %d Functions\n", len(shortcuts))
	for i, f := range shortcuts {
		fmt.Printf("Shortcut[%d] : %s(%s) . Queries:%v\n", i, f.Name, f.Description, f.Parameters)
	}
}
