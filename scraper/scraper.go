package scraper

import (
	"fmt"
	"strings"

	"github.com/gocolly/colly/v2"
)

type Shortcut struct {
	Name        string
	Description string
	Parameters  []string // comma-separated queries
}

// OverrideShortcuts is a list of shortcuts that are not on the official documentation.
var OverrideShortcuts = []Shortcut{
	{
		Name:        "Cut",
		Description: "Cut",
		Parameters: []string{
			"Input",
			"Mix",
		},
	},
	{
		Name:        "Fade",
		Description: "Fade",
		Parameters: []string{
			"Input",
			"Mix",
		},
	},
	{
		Name:        "Merge",
		Description: "Merge",
		Parameters: []string{
			"Input",
		},
	},
}

func GetShortcuts(helpVer int) ([]Shortcut, error) {
	shortcuts := make([]Shortcut, 0, 500)
	shortcuts = append(shortcuts, OverrideShortcuts...)

	c := colly.NewCollector()

	// Find and visit all links
	c.OnHTML("table", func(e *colly.HTMLElement) {
		e.ForEach("tr", func(i int, h *colly.HTMLElement) {
			// Filter header column somehow?
			s := Shortcut{}
			h.ForEach("td", func(i int, j *colly.HTMLElement) {
				switch i {
				case 0:
					if strings.Contains(j.Attr("style"), "background-color: #ccffcc;") {
						return
					}
					if j.Text != "" {
						t := strings.ReplaceAll(j.Text, "\n", "")
						t = strings.TrimSpace(t)
						s.Name = t
					}
				case 1:
					if j.Text != "" {
						t := strings.ReplaceAll(j.Text, "\n", "")
						t = strings.TrimSpace(t)
						s.Description = t
					}
				case 2:
					if j.Text != "" {
						t := strings.ReplaceAll(j.Text, "\n", "")
						t = strings.TrimSpace(t)
						if t == "None" {
							s.Parameters = nil
						} else {
							ts := strings.Split(t, ",")
							s.Parameters = make([]string, 0, len(ts))
							for _, p := range ts {
								p = strings.TrimSpace(p)
								s.Parameters = append(s.Parameters, p)
							}
						}
					}
				}
			})
			if s.Name == "" {
				return
			}
			shortcuts = append(shortcuts, s)
		})
	})

	c.OnRequest(func(r *colly.Request) {
		// fmt.Println("Visiting", r.URL)
	})

	u := fmt.Sprintf("https://www.vmix.com/help%d/ShortcutFunctionReference.html", helpVer)

	if err := c.Visit(u); err != nil {
		return nil, err
	}

	return shortcuts, nil
}
