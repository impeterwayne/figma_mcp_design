package internal

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// maxSVGBytes caps SVG markup sent to the plugin.
const maxSVGBytes = 500_000

var (
	svgScriptRe        = regexp.MustCompile(`(?is)<script\b.*?</script\s*>|<script\b[^>]*/>`)
	svgForeignObjectRe = regexp.MustCompile(`(?is)<foreignObject\b.*?</foreignObject\s*>|<foreignObject\b[^>]*/>`)
	svgEventAttrRe     = regexp.MustCompile(`(?i)\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)`)
	svgExternalHrefRe  = regexp.MustCompile(`(?i)\s+(xlink:)?href\s*=\s*("\s*(https?:|javascript:|data:text|data:application)[^"]*"|'\s*(https?:|javascript:|data:text|data:application)[^']*')`)
	svgCommentRe       = regexp.MustCompile(`(?s)<!--.*?-->`)
	svgPrologRe        = regexp.MustCompile(`(?is)<\?xml.*?\?>|<!DOCTYPE[^>]*>`)
	svgMetadataRe      = regexp.MustCompile(`(?is)<metadata\b.*?</metadata\s*>|<title\b.*?</title\s*>|<desc\b.*?</desc\s*>`)
	svgBetweenTagsRe   = regexp.MustCompile(`>\s+<`)
)

// cleanSVG strips active content (scripts, event handlers, external links; embedded
// data:image links stay) and
// size-only noise (comments, prolog, metadata, whitespace between tags), so the
// markup is safe to import and cheaper to send.
func cleanSVG(svg string) string {
	for _, re := range []*regexp.Regexp{svgScriptRe, svgForeignObjectRe, svgCommentRe, svgPrologRe, svgMetadataRe} {
		svg = re.ReplaceAllString(svg, "")
	}
	svg = svgEventAttrRe.ReplaceAllString(svg, "")
	svg = svgExternalHrefRe.ReplaceAllString(svg, "")
	svg = svgBetweenTagsRe.ReplaceAllString(svg, "><")
	return strings.TrimSpace(svg)
}

// readSVGFile reads an .svg file that must sit inside workDir, following
// symlinks before the check so a link cannot point outside it.
func readSVGFile(path, workDir string) (string, error) {
	if !strings.EqualFold(filepath.Ext(path), ".svg") {
		return "", fmt.Errorf("path must point to a .svg file, got: %s", path)
	}
	resolved := filepath.Clean(path)
	if !filepath.IsAbs(resolved) {
		resolved = filepath.Join(workDir, resolved)
	}
	real, err := filepath.EvalSymlinks(resolved)
	if err != nil {
		return "", fmt.Errorf("cannot read %s: %v", path, err)
	}
	realWorkDir, err := filepath.EvalSymlinks(workDir)
	if err != nil {
		realWorkDir = workDir
	}
	if _, err := mustBeInsideDir(real, realWorkDir); err != nil {
		return "", fmt.Errorf("path must be inside the working directory: %s", workDir)
	}
	info, err := os.Stat(real)
	if err != nil {
		return "", fmt.Errorf("cannot read %s: %v", path, err)
	}
	if info.Size() > maxSVGBytes {
		return "", fmt.Errorf("SVG file is %d bytes, max %d", info.Size(), maxSVGBytes)
	}
	data, err := os.ReadFile(real)
	if err != nil {
		return "", fmt.Errorf("cannot read %s: %v", path, err)
	}
	return string(data), nil
}
