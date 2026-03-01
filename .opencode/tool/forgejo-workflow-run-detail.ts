import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Get detailed information about a specific Forgejo workflow run",
  args: {
    owner: tool.schema.string().describe("Repository owner username or organization"),
    repo: tool.schema.string().describe("Repository name"),
    run_id: tool.schema.number().describe("Workflow run ID"),
  },
  async execute(args) {
    const forgejoHost = process.env.FORGEJO_HOST || "https://git.holdenitdown.net"
    const forgejoToken = process.env.FORGEJO_ACCESS_TOKEN
    
    if (!forgejoToken) {
      return "Error: FORGEJO_ACCESS_TOKEN environment variable is not set"
    }

    const url = `${forgejoHost}/api/v1/repos/${args.owner}/${args.repo}/actions/tasks?limit=50`

    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `token ${forgejoToken}`,
          "Accept": "application/json"
        }
      })

      if (!response.ok) {
        return `Error: ${response.status} ${response.statusText} - ${await response.text()}`
      }

      const data = await response.json()
      const runs = data.workflow_runs || []
      const run = runs.find((r: any) => r.id === args.run_id)
      
      if (!run) {
        return `Error: Workflow run with ID ${args.run_id} not found in recent runs. Try using forgejo-workflow-runs to list available runs.`
      }
      
      return JSON.stringify({
        workflow_run_id: run.id,
        run_number: run.run_number,
        workflow_id: run.workflow_id,
        name: run.name,
        display_title: run.display_title,
        status: run.status,
        event: run.event,
        head_branch: run.head_branch,
        head_sha: run.head_sha,
        run_started_at: run.run_started_at,
        created_at: run.created_at,
        updated_at: run.updated_at,
        url: run.url,
        note: `Use forgejo-job-logs with run_number=${run.run_number} and workflow="${run.workflow_id}" to fetch execution logs`
      }, null, 2)
    } catch (error) {
      return `Error fetching workflow run details: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
