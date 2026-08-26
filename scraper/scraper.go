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

func transitionShortcut(name string, params ...string) Shortcut {
	return Shortcut{Name: name, Description: name, Parameters: params}
}

// OverrideShortcuts is a list of shortcuts that are not on the official documentation.
// Transition names match the vMix UI and can be used as Functions; Duration is a
// Developer API parameter for transitions and is not listed in the reference table.
var OverrideShortcuts = []Shortcut{
	transitionShortcut("Cut", "Input", "Mix"),
	transitionShortcut("Fade", "Input", "Mix", "Duration"),
	transitionShortcut("Zoom", "Input", "Mix", "Duration"),
	transitionShortcut("Wipe", "Input", "Mix", "Duration"),
	transitionShortcut("Slide", "Input", "Mix", "Duration"),
	transitionShortcut("Fly", "Input", "Mix", "Duration"),
	transitionShortcut("CrossZoom", "Input", "Mix", "Duration"),
	transitionShortcut("FlyRotate", "Input", "Mix", "Duration"),
	transitionShortcut("Cube", "Input", "Mix", "Duration"),
	transitionShortcut("CubeZoom", "Input", "Mix", "Duration"),
	transitionShortcut("VerticalWipe", "Input", "Mix", "Duration"),
	transitionShortcut("VerticalSlide", "Input", "Mix", "Duration"),
	transitionShortcut("Merge", "Input", "Duration"),
	transitionShortcut("WipeReverse", "Input", "Mix", "Duration"),
	transitionShortcut("SlideReverse", "Input", "Mix", "Duration"),
	transitionShortcut("VerticalWipeReverse", "Input", "Mix", "Duration"),
	transitionShortcut("VerticalSlideReverse", "Input", "Mix", "Duration"),
	transitionShortcut("BarnDoor", "Input", "Mix", "Duration"),
	transitionShortcut("RollerDoor", "Input", "Mix", "Duration"),
	transitionShortcut("AlphaFade", "Input", "Mix", "Duration"),
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
