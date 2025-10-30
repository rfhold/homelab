import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Get a quick summary of workflow runs status for a Gitea repository",
  args: {
    owner: tool.schema.string().describe("Repository owner username or organization"),
    repo: tool.schema.string().describe("Repository name"),
    limit: tool.schema.number().optional().describe("Number of recent runs to analyze (default: 20, max: 50)"),
  },
  async execute(args) {
    const giteaHost = process.env.GITEA_HOST || "https://git.holdenitdown.net"
    const giteaToken = process.env.GITEA_ACCESS_TOKEN
    
    if (!giteaToken) {
      return "Error: GITEA_ACCESS_TOKEN environment variable is not set"
    }

    const limit = Math.min(args.limit || 20, 50)
    const url = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/tasks?page=1&limit=${limit}`

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
      const runs = data.workflow_runs || []
      
      const summary = {
        total_count: data.total_count || 0,
        analyzed_runs: runs.length,
        status_breakdown: {
          success: 0,
          failure: 0,
          cancelled: 0,
          running: 0,
          waiting: 0,
          blocked: 0,
          skipped: 0
        },
        recent_runs: runs.slice(0, 5).map((run: any) => ({
          id: run.id,
          name: run.name,
          status: run.status,
          event: run.event,
          branch: run.head_branch,
          created_at: run.created_at,
          duration_seconds: run.run_finished_at && run.run_started_at 
            ? Math.round((new Date(run.run_finished_at).getTime() - new Date(run.run_started_at).getTime()) / 1000)
            : null
        }))
      }

      runs.forEach((run: any) => {
        const status = run.status?.toLowerCase()
        if (status in summary.status_breakdown) {
          summary.status_breakdown[status as keyof typeof summary.status_breakdown]++
        }
      })

      return JSON.stringify(summary, null, 2)
    } catch (error) {
      return `Error fetching workflow summary: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
