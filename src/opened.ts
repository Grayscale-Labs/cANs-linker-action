import { getInput, debug, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Client } from "@notionhq/client";
import { CreateCommentResponse } from "@notionhq/client/build/src/api-endpoints";
import { PullRequest, PullRequestEvent } from "@octokit/webhooks-types";

// Matches (username)/(1234)-(ticket-name)
// Ticket number match is optional
const BRANCH_PATTERN = /([a-z]*)\/(\d*)-?([a-z\d\-]*)/;

const GITHUB_TOKEN = getInput("github-token");
const NOTION_TOKEN = getInput("notion-token");
const STORIES_DB_ID = getInput("stories-db-id");

// Init notion client
const notion = new Client({
  auth: NOTION_TOKEN,
});

interface TicketPage {
  id: string;
  url: string;
  properties: Record<
    string,
    {
      id: string;
    }
  >;
}

async function opened() {
  if (GITHUB_TOKEN && NOTION_TOKEN && STORIES_DB_ID) {
    debug(
      "Exiting because some required inputs (GITHUB_TOKEN, NOTION_TOKEN, STORIES_DB_ID) are empty"
    );
    return;
  }

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

  // Get/create ticket
  // Fails if it can't find the specified ticket
  let ticket: TicketPage;
  if (ticketNumStr !== "") {
    const ticketNum = parseInt(ticketNumStr);

    const fetchedTicket = await getTicket(ticketNum);
    if (fetchedTicket === null) {
      debug(`No ticket found with ID ${ticketNumStr}`);
      return;
    }

    debug(`Found ticket with ID ${ticketNum}`);
    ticket = fetchedTicket;
  } else {
    debug(`Creating ticket with name ${payload.pull_request.title}`);
    ticket = await createTicket(payload.pull_request.title);
  }

  // Set outputs
  setOutput("ticket-id", ticketNumStr);
  setOutput("ticket-name", ticket.properties["title"] || "unknown");
  setOutput("ticket-url", ticket.url);

  debug("Commenting PR on Notion ticket");
  await commentOnNotionTicket(ticket.id, payload.pull_request);

  debug("Commenting Notion ticket on PR");
  await commentOnPullRequest(
    payload,
    ticketNumStr === ""
      ? `Linked to [new ticket](${ticket.url})`
      : `Linked to [NT-${ticketNumStr}](${ticket.url})`
  );
}

async function getTicket(ticketNum: number): Promise<TicketPage | null> {
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

  if (response.results.length === 0) {
    return null;
  }

  return response.results[0] as TicketPage;
}

async function createTicket(ticketName: string): Promise<TicketPage> {
  const response = await notion.pages.create({
    parent: { database_id: STORIES_DB_ID },
    properties: {
      Story: {
        // @ts-ignore: Notion types do not include "status"
        type: "title",
        title: [{ type: "text", text: { content: ticketName } }],
      },
      Status: {
        // @ts-ignore: Notion types do not include "status"
        status: {
          name: "Review",
        },
      },
    },
  });

  return response as TicketPage;
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
            url: pullRequest.html_url,
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
    debug(
      `HTTP ${
        commentResponse.status
      } octokit.issues.createComment(${JSON.stringify(params)})`
    );
    return false;
  }
  return true;
}

export default opened;
