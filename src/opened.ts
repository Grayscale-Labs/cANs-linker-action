import { getInput, debug, setOutput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Client } from "@notionhq/client";
import {
  CreateCommentResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { PullRequest, PullRequestEvent } from "@octokit/webhooks-types";

// Matches (username)/(1234)-(ticket-name)
const BRANCH_PATTERN = /([a-z]*)\/(\d*)-([a-z\-]*)/;

const GITHUB_TOKEN = getInput("github-token", {
  required: true,
});

const NOTION_TOKEN = getInput("notion-token", {
  required: true,
});

const STORIES_DB_ID = getInput("stories-db-id", {
  required: true,
});

// Init notion client
const notion = new Client({
  auth: NOTION_TOKEN,
});

async function opened() {
  const payload = context.payload as PullRequestEvent;
  const branchName = payload.pull_request.head.ref;

  // Return if branch does not match
  const matches = branchName.match(BRANCH_PATTERN);
  if (matches === null) {
    debug(
      "Branch name does not match pattern {username}/{ticket_num}-{ticket_name}"
    );
    return;
  }

  // Query for ticket page object
  const [_, username, ticketNumStr, ticketName] = matches;
  const ticket = await getTicket(parseInt(ticketNumStr));

  if (ticket === null) {
    setFailed(`No ticket found with ID ${ticketNumStr}`);
    return;
  }

  debug(`Found ticket for ID ${ticketNumStr} at ${ticket.url}`);

  // Set outputs
  setOutput("ticket-id", ticketNumStr);
  setOutput("ticket-name", ticket.properties["title"] || "unknown");
  setOutput("ticket-url", ticket.url);

  // Comment PR link
  debug("Commenting PR on Notion ticket");
  await commentOnNotionTicket(ticket.id, payload.pull_request);

  debug("Commenting Notion ticket on PR");
  await commentOnPullRequest(
    payload,
    `Linked to [NT-${ticketNumStr}](${ticket.url})`
  );
}

async function getTicket(
  ticketNum: number
): Promise<PageObjectResponse | null> {
  const response = await notion.databases.query({
    database_id: STORIES_DB_ID,
    filter: {
      property: "ID",
      number: {
        equals: ticketNum,
      },
    },
    page_size: 1,
  });

  if (response.results.length === 0) return null;
  return response.results[0] as PageObjectResponse;
}

async function commentOnNotionTicket(
  ticketPageId: string,
  pullRequest: PullRequest
): Promise<CreateCommentResponse> {
  return notion.comments.create({
    parent: {
      page_id: ticketPageId,
    },
    rich_text: [
      {
        text: {
          content: "Linked to ",
        },
      },
      {
        text: {
          content: `PR#${pullRequest.number}`,
          link: {
            url: pullRequest.url,
          },
        },
      },
    ],
  });
}

async function commentOnPullRequest(
  payload: PullRequestEvent,
  comment: string
): Promise<boolean> {
  const octokit = getOctokit(GITHUB_TOKEN);
  const params = {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.pull_request.number,
    body: comment,
  };
  const commentResponse = await octokit.rest.issues.createComment(params);
  if (commentResponse.status !== 201) {
    setFailed(
      `HTTP ${
        commentResponse.status
      } octokit.issues.createComment(${JSON.stringify(params)})`
    );
    return false;
  }
  return true;
}

export default opened;
