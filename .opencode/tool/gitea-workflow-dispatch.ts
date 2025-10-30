import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Trigger a Gitea workflow dispatch event to manually run a workflow",
  args: {
    owner: tool.schema.string().describe("Repository owner username or organization"),
    repo: tool.schema.string().describe("Repository name"),
    workflow: tool.schema.string().describe("Workflow filename (e.g., build-speaches-cuda.yml)"),
    ref: tool.schema.string().optional().describe("Git reference (branch, tag, or commit SHA). Defaults to 'main'"),
    inputs: tool.schema.record(tool.schema.string(), tool.schema.string()).optional().describe("Workflow input parameters as key-value pairs"),
  },
  async execute(args) {
    const giteaHost = process.env.GITEA_HOST || "https://git.holdenitdown.net"
    const giteaToken = process.env.GITEA_ACCESS_TOKEN
    
    if (!giteaToken) {
      return "Error: GITEA_ACCESS_TOKEN environment variable is not set"
    }

    const ref = args.ref || "main"
    const url = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/workflows/${args.workflow}/dispatches`
    
    const body: { ref: string; inputs?: Record<string, string> } = { ref }
    if (args.inputs && Object.keys(args.inputs).length > 0) {
      body.inputs = args.inputs as Record<string, string>
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `token ${giteaToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return `Error: ${response.status} ${response.statusText} - ${errorText}`
      }

      return JSON.stringify({
        success: true,
        message: `Workflow '${args.workflow}' triggered successfully on ref '${ref}'`,
        owner: args.owner,
        repo: args.repo,
        workflow: args.workflow,
        ref: ref,
        inputs: args.inputs || {}
      }, null, 2)
    } catch (error) {
      return `Error triggering workflow: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
