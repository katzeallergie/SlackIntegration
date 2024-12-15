// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface IssueRequest {
  title: string;
  body?: string;
  labels?: string[];
}

Deno.serve(async (req) => {
  try {
    // GitHub API configuration
    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
    const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER');
    const GITHUB_REPO = Deno.env.get('GITHUB_REPO');
    const PROJECT_NUMBER = 1

    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !PROJECT_NUMBER) {
      throw new Error('Required environment variables are not set');
    }

    // Parse request body
    const { title, body, labels }: IssueRequest = await req.json();

    if (!title) {
      throw new Error('Issue title is required');
    }

    // Create GitHub issue
    const issueResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          labels,
        }),
      }
    );

    if (!issueResponse.ok) {
      const error = await issueResponse.json();
      throw new Error(`GitHub API error: ${JSON.stringify(error)}`);
    }

    const issue = await issueResponse.json();

    // Get project ID
    const projectQuery = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const projectResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: projectQuery,
        variables: {
          owner: GITHUB_OWNER,
          number: parseInt(PROJECT_NUMBER),
        },
      }),
    });

    const projectData = await projectResponse.json();
    const projectId = projectData.data.organization.projectV2.id;
    
    // Find Status field and Icebox option
    const statusField = projectData.data.organization.projectV2.fields.nodes.find(
      (field: any) => field.name === 'Status'
    );
    const iceboxOption = statusField.options.find(
      (option: any) => option.name === 'Icebox'
    );

    if (!statusField || !iceboxOption) {
      throw new Error('Status field or Icebox option not found in the project');
    }

    // Add issue to project
    const addToProjectMutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {
          projectId: $projectId
          contentId: $contentId
        }) {
          item {
            id
          }
        }
      }
    `;

    const addToProjectResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: addToProjectMutation,
        variables: {
          projectId: projectId,
          contentId: issue.node_id,
        },
      }),
    });

    const projectItemData = await addToProjectResponse.json();
    const itemId = projectItemData.data.addProjectV2ItemById.item.id;

    // Set status to Icebox
    const updateFieldMutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { 
            singleSelectOptionId: $optionId
          }
        }) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: updateFieldMutation,
        variables: {
          projectId: projectId,
          itemId: itemId,
          fieldId: statusField.id,
          optionId: iceboxOption.id,
        },
      }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          issue_url: issue.html_url,
          issue_number: issue.number,
          project_url: `https://github.com/orgs/${GITHUB_OWNER}/projects/${PROJECT_NUMBER}`,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-github-issue' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"title":"Issue Title", "body":"Issue description", "labels":["bug"]}'

  Note: You need to set the following environment variables:
  - GITHUB_TOKEN: Personal access token with repo and project scopes
  - GITHUB_OWNER: GitHub repository owner/organization name
  - GITHUB_REPO: GitHub repository name
  - GITHUB_PROJECT_NUMBER: Project number (visible in the project URL)
*/
