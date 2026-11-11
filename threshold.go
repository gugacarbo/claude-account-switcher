package main

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
)

var thresholds = []float64{90, 94, 96, 98}

// parseThreshold reads a typed threshold such as "85" or "85 %".
func parseThreshold(text string) (float64, bool) {
	n, err := strconv.Atoi(strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(text), "%")))
	if err != nil || n < 1 || n > 99 {
		return 0, false
	}
	return float64(n), true
}

func customLabel(threshold float64) string {
	if slices.Contains(thresholds, threshold) {
		return tr("Custom…", "自定义…")
	}
	return fmt.Sprintf(tr("Custom (%.0f%%)…", "自定义（%.0f%%）…"), threshold)
}
