package prompts

import "github.com/mark3labs/mcp-go/server"

// RegisterAll registers all MCP prompts on the server.
func RegisterAll(s *server.MCPServer) {
	addReadDesignStrategy(s)
	addDesignStrategy(s)
	addTextReplacementStrategy(s)
	addAnnotationConversionStrategy(s)
	addSwapOverridesInstances(s)
	addReactionToConnectorStrategy(s)
	addStyleAuditStrategy(s)
	addBulkRenameStrategy(s)
	addDesignTokenGenerationStrategy(s)
	addGenerateColorPalette(s)
	addGenerateTypeScale(s)
	addGenerateComponentVariants(s)
	addDesignSystemHealthCheck(s)
	addDesignSystemRefactor(s)
	// Design system knowledge prompts (adapted from design-systems-mcp knowledge base)
	addWCAGAccessibilityAudit(s)
	addDesignSystemFromReference(s)
	addAtomicDesignComponentBuilder(s)
	addDesignTokenNamingStandards(s)
}
