"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const client_1 = require("@notionhq/client");
// Matches (username)/(1234)-(ticket-name)
const BRANCH_PATTERN = /([a-z]*)\/(\d*)-([a-z\-]*)/;
const GITHUB_TOKEN = (0, core_1.getInput)("github-token", {
    required: true,
});
const NOTION_TOKEN = (0, core_1.getInput)("notion-token", {
    required: true,
});
const STORIES_DB_ID = (0, core_1.getInput)("stories-db-id", {
    required: true,
});
// Init notion client
const notion = new client_1.Client({
    auth: NOTION_TOKEN,
});
function opened() {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = github_1.context.payload;
        const branchName = payload.pull_request.head.ref;
        // Return if branch does not match
        const matches = branchName.match(BRANCH_PATTERN);
        if (matches === null) {
            (0, core_1.setFailed)("Branch name does not match pattern username/1234-ticket-name");
            return;
        }
        // Query for ticket page object
        const [_, username, ticketNumStr, ticketName] = matches;
        const ticket = yield getTicket(parseInt(ticketNumStr));
        if (ticket === null) {
            (0, core_1.setFailed)(`No ticket found with ID ${ticketNumStr}`);
            return;
        }
        (0, core_1.debug)(`Found ticket for ID ${ticketNumStr} at ${ticket.url}`);
        // Set outputs
        (0, core_1.setOutput)("ticket-id", ticketNumStr);
        (0, core_1.setOutput)("ticket-name", ticket.properties["title"] || "unknown");
        (0, core_1.setOutput)("ticket-url", ticket.url);
        // Comment PR link
        (0, core_1.debug)("Commenting PR on Notion ticket");
        yield commentOnNotionTicket(ticket.id, payload.pull_request);
        (0, core_1.debug)("Commenting Notion ticket on PR");
        yield commentOnPullRequest(payload, `Linked to [NT-${ticketNumStr}](${ticket.url})`);
    });
}
function getTicket(ticketNum) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield notion.databases.query({
            database_id: STORIES_DB_ID,
            filter: {
                property: "ID",
                number: {
                    equals: ticketNum,
                },
            },
            page_size: 1,
        });
        if (response.results.length === 0)
            return null;
        return response.results[0];
    });
}
function commentOnNotionTicket(ticketPageId, pullRequest) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
function commentOnPullRequest(payload, comment) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = (0, github_1.getOctokit)(GITHUB_TOKEN);
        const params = {
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            issue_number: payload.pull_request.number,
            body: comment,
        };
        const commentResponse = yield octokit.rest.issues.createComment(params);
        if (commentResponse.status !== 201) {
            (0, core_1.setFailed)(`HTTP ${commentResponse.status} octokit.issues.createComment(${JSON.stringify(params)})`);
            return false;
        }
        return true;
    });
}
exports.default = opened;
