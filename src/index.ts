import { debug } from "@actions/core";
import { context } from "@actions/github";
import { PullRequestEvent } from "@octokit/webhooks-types";
import opened from "./opened";

async function run() {
  debug("Running cANs-linker-action");

  if (context.eventName !== "pull_request") {
    debug("This action only works with `pull_request` events");
    return;
  }

  const payload = context.payload as PullRequestEvent;

  switch (payload.action) {
    case "opened":
      debug("Running `opened` task");

      return opened();
    default:
      debug(
        "This action only works with the `opened` action for `pull_request` events"
      );

      return;
  }
}

run();
