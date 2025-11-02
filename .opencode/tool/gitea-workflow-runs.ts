import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "List workflow runs for a Gitea repository",
  args: {
    owner: tool.schema.string().describe("Repository owner username or organization"),
    repo: tool.schema.string().describe("Repository name"),
    workflow: tool.schema.string().optional().describe("Filter by workflow filename (e.g., build-vllm-rocm.yml)"),
    page: tool.schema.number().optional().describe("Page number (default: 1)"),
    limit: tool.schema.number().optional().describe("Page size limit (default: 10, max: 50)"),
    status: tool.schema.enum([
      "success", "failure", "cancelled", "running", "waiting", "blocked", "skipped"
    ]).optional().describe("Filter by workflow run status"),
  },
  async execute(args) {
    const giteaHost = process.env.GITEA_HOST || "https://git.holdenitdown.net"
    const giteaToken = process.env.GITEA_ACCESS_TOKEN
    
    if (!giteaToken) {
      return "Error: GITEA_ACCESS_TOKEN environment variable is not set"
    }

    const page = args.page || 1
    const limit = Math.min(args.limit || 10, 50)
    
    let url = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/tasks?page=${page}&limit=${limit}`
    
    if (args.status) {
      url += `&status=${args.status}`
    }

    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `token ${giteaToken}`,
          "Accept": "application/json"
        }
      })

      if (!response.ok) {
        return `Error: ${response.status} ${response.statusText} - ${await response.text()}`
      }

      const data = await response.json()
      
      let workflow_runs = (data.workflow_runs || []).map((run: any) => ({
        workflow_run_id: run.id,
        run_number: run.run_number,
        workflow_id: run.workflow_id,
        name: run.name,
        status: run.status,
        event: run.event,
        head_branch: run.head_branch,
        head_sha: run.head_sha,
        created_at: run.created_at,
        updated_at: run.updated_at,
        url: run.url
      }))
      
      if (args.workflow) {
        workflow_runs = workflow_runs.filter((run: any) => run.workflow_id === args.workflow)
      }
      
      return JSON.stringify({
        total_count: args.workflow ? workflow_runs.length : data.total_count || 0,
        workflow_runs: workflow_runs,
        workflow_filter: args.workflow || "none",
        summary: args.workflow 
          ? `Found ${workflow_runs.length} runs for workflow '${args.workflow}'`
          : `Found ${data.total_count || 0} workflow runs (page ${page}/${Math.ceil((data.total_count || 0) / limit)})`
      }, null, 2)
    } catch (error) {
      return `Error fetching workflow runs: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
